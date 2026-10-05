// Pattern N3: keeps pooled sprites in sync with sim entities by id, every frame, with no
// per-frame allocation. Sprites hold only their bound id and view state, never game data.
import { ObjectPool } from './ObjectPool';

export interface PooledEntitySprite<TPublic> {
  bind(id: number): void;
  sync(item: TPublic, alpha: number): void;
  /** Hides the sprite as its entity leaves; exit animations (juice) arrive in later stories. */
  playExit(): void;
}

export class EntityLayer<TPublic extends { id: number }, TSprite extends PooledEntitySprite<TPublic>> {
  private readonly pool: ObjectPool<TSprite>;
  private readonly live = new Map<number, TSprite>();
  private readonly seen = new Set<number>();
  // Bound once so the per-frame sweep allocates no closure.
  private readonly sweep = (spr: TSprite, id: number): void => {
    if (this.seen.has(id)) return;
    this.live.delete(id);
    spr.playExit();
    this.pool.release(spr);
  };

  constructor(pool: ObjectPool<TSprite>) {
    this.pool = pool;
  }

  sync(items: readonly TPublic[], alpha: number): void {
    this.seen.clear();
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      this.seen.add(it.id);
      let spr = this.live.get(it.id);
      if (spr === undefined) {
        spr = this.pool.acquire();
        spr.bind(it.id);
        this.live.set(it.id, spr);
      }
      spr.sync(it, alpha);
    }
    // Deleting the current entry during Map.forEach is safe.
    this.live.forEach(this.sweep);
  }

  get size(): number {
    return this.live.size;
  }
}
