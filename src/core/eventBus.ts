// Typed, engine-free event emitter.
// Listener lists are copy-on-write, so emit iterates a stable list without copying it.
// Removal takes effect immediately: a listener removed (or a once listener fired) during an emit
// is skipped for the rest of that emit, including re-entrant emits of the same event.
// Listeners added during an emit run from the next emit. Emit allocates only when a once
// listener fires (its list is rebuilt without it).

type Listener<P> = (payload: P) => void;

interface Entry<P> {
  readonly fn: Listener<P>;
  readonly context: unknown;
  readonly once: boolean;
  removed: boolean;
}

const NONE: readonly Entry<never>[] = [];

// Constraint written as a mapped type so both `type` aliases and `interface` event maps qualify.
export class EventBus<Events extends { [K in keyof Events]: unknown }> {
  private readonly listeners = new Map<keyof Events, readonly Entry<never>[]>();

  on<K extends keyof Events>(event: K, fn: Listener<Events[K]>, context?: unknown): this {
    return this.add(event, { fn, context, once: false, removed: false });
  }

  once<K extends keyof Events>(event: K, fn: Listener<Events[K]>, context?: unknown): this {
    return this.add(event, { fn, context, once: true, removed: false });
  }

  /**
   * Removes listeners for `event`: all of them when only the event is given, otherwise those
   * matching `fn` and/or `context`.
   */
  off<K extends keyof Events>(event: K, fn?: Listener<Events[K]>, context?: unknown): this {
    const list = this.get(event);
    if (list.length === 0) return this;
    const all = fn === undefined && context === undefined;
    const kept: Entry<Events[K]>[] = [];
    for (const e of list) {
      if (all || ((fn === undefined || e.fn === fn) && (context === undefined || e.context === context))) {
        e.removed = true;
      } else {
        kept.push(e);
      }
    }
    this.set(event, kept);
    return this;
  }

  emit<K extends keyof Events>(event: K, payload: Events[K]): void {
    const list = this.get(event);
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (e.removed) continue;
      if (e.once) {
        e.removed = true;
        this.set(event, this.get(event).filter((x) => x !== e));
      }
      e.fn.call(e.context, payload);
    }
  }

  removeAllListeners(event?: keyof Events): this {
    if (event === undefined) {
      for (const list of this.listeners.values()) for (const e of list) e.removed = true;
      this.listeners.clear();
    } else {
      for (const e of this.get(event)) e.removed = true;
      this.listeners.delete(event);
    }
    return this;
  }

  private add<K extends keyof Events>(event: K, entry: Entry<Events[K]>): this {
    this.set(event, [...this.get(event), entry]);
    return this;
  }

  private get<K extends keyof Events>(event: K): readonly Entry<Events[K]>[] {
    return (this.listeners.get(event) ?? NONE) as readonly Entry<Events[K]>[];
  }

  private set<K extends keyof Events>(event: K, list: readonly Entry<Events[K]>[]): void {
    if (list.length === 0) this.listeners.delete(event);
    else this.listeners.set(event, list as readonly Entry<never>[]);
  }
}
