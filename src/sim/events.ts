// Sim → view events. The sim appends to a per-tick queue that lives outside GameState (events are
// never saved); after each tick GameScene drains it onto the EventBus. Variants: SheepDied,
// CarcassSpawned, CarcassCleared, Farmed, FoodDropped, FoodEaten, BreedingFoodDropped,
// BreedingFoodEaten, Bred, LambBorn, Lost.

export type DeathCause = 'starved' | 'oldAge' | 'virus' | 'abomination';

/** What a Farm command produced: food (the Farm bar) or breeding food (Farm Breeding Food). */
export type FarmResource = 'food' | 'breedingFood';

export type SimEvent =
  // killSheep (systems/carcass.ts) emits SheepDied; Story 5.3 adds `name`.
  | { type: 'SheepDied'; id: number; cause: DeathCause; x: number; y: number }
  // killSheep left carcass `id` at (x, y), right after its SheepDied (FR12). Story 2.6 pings on it.
  | { type: 'CarcassSpawned'; id: number; x: number; y: number }
  // A ClearCarcass removed carcass `id` from (x, y) (FR13).
  | { type: 'CarcassCleared'; id: number; x: number; y: number }
  // Every Farm and FarmBreeding command emits Farmed, after any FoodDropped it caused. `added` is what
  // it made: the pieces (food or breeding) dropped into the pen, 0 until a bar completes.
  | { type: 'Farmed'; resource: FarmResource; added: number }
  // A food piece landed at (x, y) in the pen (a full Farm bar).
  | { type: 'FoodDropped'; id: number; x: number; y: number }
  // A sheep ate a piece; (x, y) is where the piece was (the munch particle spot).
  | { type: 'FoodEaten'; sheepId: number; pieceId: number; x: number; y: number }
  // A breeding piece landed at (x, y) in the pen (a full breeding bar, FR8).
  | { type: 'BreedingFoodDropped'; id: number; x: number; y: number }
  // An adult ate a breeding piece and is now ready (FR8a); (x, y) is where the piece was.
  | { type: 'BreedingFoodEaten'; sheepId: number; pieceId: number; x: number; y: number }
  // Two ready adults bred (FR9): a lamb is on the way. (x, y) is the pregnancy's stored spot.
  | { type: 'Bred'; pregnancyId: number; parentA: number; parentB: number; x: number; y: number }
  // A pending lamb was born at (x, y) (lifecycle.ts). Story 4.1 spawns the Abomination from this.
  | { type: 'LambBorn'; id: number; pregnancyId: number; x: number; y: number }
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
