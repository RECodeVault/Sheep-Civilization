// Sim → view events. The sim appends to a per-tick queue that lives outside GameState (events are
// never saved); after each tick GameScene drains it onto the EventBus. Variants: SheepDied, Farmed,
// FoodDropped, FoodEaten, Lost.

export type DeathCause = 'starved' | 'oldAge' | 'virus' | 'abomination';

/** Story 2.2 widens this with 'breedingFood'. */
export type FarmResource = 'food';

export type SimEvent =
  // killSheep (systems/carcass.ts) emits SheepDied; Story 5.3 adds `name`.
  | { type: 'SheepDied'; id: number; cause: DeathCause; x: number; y: number }
  // Every Farm command emits Farmed, after any FoodDropped it caused. `added` is the food it made:
  // pieces dropped into the pen (0 until a bar completes). Story 2.2 reuses it for breeding food.
  | { type: 'Farmed'; resource: FarmResource; added: number }
  // A food piece landed at (x, y) in the pen (a full Farm bar).
  | { type: 'FoodDropped'; id: number; x: number; y: number }
  // A sheep ate a piece; (x, y) is where the piece was (the munch particle spot).
  | { type: 'FoodEaten'; sheepId: number; pieceId: number; x: number; y: number }
  // The flock reached 0 (checkLastSheepAndLoss). Emitted once per game, after the last SheepDied.
  // survivedMs is state.lostAt; peakFlock is stats.peakFlock.
  | { type: 'Lost'; survivedMs: number; peakFlock: number };

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
