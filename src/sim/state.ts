// The single serializable game state and the new-game factory. GameState is plain JSON data only:
// no classes, Map/Set, Date, functions or cycles; entities reference each other by numeric id.
import { TUNING } from '../config/tuning';
import { rngRange, seedFromNumber } from './rng';
import { fenceBounds } from './selectors';

/**
 * The sheep's explicit state machine; feeding.ts owns the seekFood/seekBreedingFood/eating
 * transitions, carcass.ts owns seekCarcass (FR14) and drag.ts owns dragged (FR16, 2.7). A later story
 * adds stalking (4.3).
 */
export type SheepActivity = 'wander' | 'seekFood' | 'seekBreedingFood' | 'seekCarcass' | 'eating' | 'dragged';

export interface Sheep {
  id: number;
  x: number;
  y: number;
  /** Game-ms; negative for sheep born before the save began. Stage is derived from it. */
  bornAt: number;
  fullness: number;
  activity: SheepActivity;
  /** Wander direction in radians. Saved, so a resumed game continues the same walk. */
  heading: number;
  /**
   * Game-ms deadline: while `time < restUntil` the sheep stands still, grazing (`wander`) or
   * munching (`eating`).
   */
  restUntil: number;
  /**
   * Id of what a seeker walks to: a food piece (`seekFood`), a breeding piece (`seekBreedingFood`) or a
   * carcass (`seekCarcass`). Omitted (deleted) when there is none.
   */
  targetId?: number;
  /** Ate a breeding piece and can be paired by the Breed tool (FR8a). Cleared on turning elder. */
  breedReady: boolean;
  /** Game-ms deadline of the breeding cooldown (FR10); 0 = never bred. On cooldown is derived. */
  cooldownUntil: number;
  /**
   * Game-ms of infection (FR15), omitted while healthy. Infected is derived from it, and so is the
   * virus death at `infectedAt + TUNING.virusDeathMs` (virus.ts).
   */
  infectedAt?: number;
}

export interface FoodPiece {
  id: number;
  x: number;
  y: number;
}

/** A breeding-food piece in the pen (FR8): an adult that eats it becomes ready to breed. */
export interface BreedingPiece {
  id: number;
  x: number;
  y: number;
}

/**
 * A lamb on the way (FR9): born at `dueAt` beside its parents. It takes a capacity slot from the
 * moment of breeding (AR21). `id` is for view reconciliation (N3); (x, y) is where the pair bred,
 * used when both parents are gone by the birth.
 */
export interface Pregnancy {
  id: number;
  parentA: number;
  parentB: number;
  dueAt: number;
  x: number;
  y: number;
}

/**
 * FR12/FR13: left by every non-sacrifice death at the sheep's spot (killSheep); it stays until the
 * player clears it (ClearCarcass). `createdAt` is game-ms.
 */
export interface Carcass {
  id: number;
  x: number;
  y: number;
  createdAt: number;
}

/**
 * A one-time shop item (FR22, FR23; Story 3.2). Epic 4 appends 'hoe1' | 'hoe2' | 'autoFeeder'. Medicine
 * is a consumable with its own dose count (Story 4.5), never in `owned`.
 */
export type ShopItemId = 'land1' | 'land2' | 'land3' | 'flowerPatch' | 'scarecrow';

/** Era ids double as background texture keys. */
export type Era = 'pasture' | 'village' | 'town' | 'wool-empire';

export interface Stats {
  died: number;
  sold: number;
  sacrificed: number;
  moneyEarned: number;
  peakFlock: number;
}

export interface GameState {
  /** Game-ms since the save began; advanced only by step(). */
  time: number;
  nextId: number;
  /** mulberry32 state (see rng.ts). */
  rng: number;
  sheep: Sheep[];
  /** Pips in the current Farm bar, 0 to `TUNING.farmPipsPerFood − 1` (FR3). */
  farmProgress: number;
  foodPieces: FoodPiece[];
  /** Pips in the current breeding bar, 0 to `TUNING.breedingPipsPerFood − 1` (FR8). */
  breedingProgress: number;
  breedingPieces: BreedingPiece[];
  /**
   * Game-ms deadline of the sacrifice food boost (FR19); 0 = never boosted. Boosted is derived:
   * `time < boostUntil` (selectors.ts isBoosted).
   */
  boostUntil: number;
  /**
   * Whole dollars to spend (FR21): earned only by selling (3.1, market.ts), spent in the shop (3.2).
   * No cap. `stats.moneyEarned` counts every dollar ever earned.
   */
  money: number;
  /**
   * One-time shop purchases (FR22, FR23), in purchase order (economy.ts). The land tier and the
   * decorations shown are derived from it (Stories 3.3, 3.4), never stored.
   */
  owned: ShopItemId[];
  pregnancies: Pregnancy[];
  carcasses: Carcass[];
  stats: Stats;
  /** Change-detection cache for EraChanged only; display reads currentEra(state). */
  lastEra: Era;
  /**
   * Game-ms of the loss (the flock reached 0, FR38), which is also the time survived. Omitted while
   * playing; set once by checkLastSheepAndLoss. While present the sim does not step.
   */
  lostAt?: number;
}

export function nextId(state: GameState): number {
  return state.nextId++;
}

export function createSheep(state: GameState, o: { x: number; y: number; bornAt: number }): Sheep {
  const s: Sheep = {
    id: nextId(state),
    x: o.x,
    y: o.y,
    bornAt: o.bornAt,
    fullness: TUNING.startFullness,
    activity: 'wander',
    heading: rngRange(state, 0, 2 * Math.PI),
    restUntil: 0,
    breedReady: false,
    cooldownUntil: 0,
  };
  state.sheep.push(s);
  // The one place a sheep is added, so the peak covers new games, births and debug sheep alike.
  if (state.sheep.length > state.stats.peakFlock) state.stats.peakFlock = state.sheep.length;
  return s;
}

export function createNewGame(seed: number): GameState {
  const state: GameState = {
    time: 0,
    nextId: 1,
    rng: seedFromNumber(seed),
    sheep: [],
    farmProgress: 0,
    foodPieces: [],
    breedingProgress: 0,
    breedingPieces: [],
    boostUntil: 0,
    money: 0,
    owned: [],
    pregnancies: [],
    carcasses: [],
    stats: { died: 0, sold: 0, sacrificed: 0, moneyEarned: 0, peakFlock: 0 },
    lastEra: 'pasture',
  };
  const f = fenceBounds(state);
  const inset = TUNING.fenceInset;
  // FR6: the adults first, then the newborn lamb (bornAt 0, the new game's time).
  const total = TUNING.startFlockAdults + TUNING.startFlockLambs;
  for (let i = 0; i < total; i++) {
    createSheep(state, {
      x: Math.round(rngRange(state, f.x + inset, f.x + f.width - inset)),
      y: Math.round(rngRange(state, f.y + inset, f.y + f.height - inset)),
      bornAt: i < TUNING.startFlockAdults ? -TUNING.startAdultAgeMs : state.time,
    });
  }
  return state;
}
