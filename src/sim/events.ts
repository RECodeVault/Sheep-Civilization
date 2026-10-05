// Sim → view events. The sim appends to a per-tick queue that lives outside GameState (events are
// never saved); after each tick GameScene drains it onto the EventBus.

export type DeathCause = 'starved' | 'oldAge' | 'virus' | 'abomination';

// Story 1.5 emits SheepDied; Story 5.3 adds `name`.
export type SimEvent = { type: 'SheepDied'; id: number; cause: DeathCause; x: number; y: number };

const queue: SimEvent[] = [];

export function emit(e: SimEvent): void {
  queue.push(e);
}

/**
 * Calls `fn` for each queued event in order, then empties the queue. Events emitted by `fn` are
 * delivered in the same drain. Each event is delivered at most once: if `fn` throws, the events
 * already delivered (including the one that threw) are removed and the rest stay queued.
 * Allocates nothing unless `fn` throws.
 */
export function drainEvents(fn: (e: SimEvent) => void): void {
  let i = 0;
  try {
    for (; i < queue.length; i++) fn(queue[i]);
  } finally {
    if (i >= queue.length) queue.length = 0;
    else queue.splice(0, i + 1);
  }
}

/** Drops pending events (tests, New Game). */
export function clearEvents(): void {
  queue.length = 0;
}
