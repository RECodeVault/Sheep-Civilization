// The single serializable game state and the new-game factory. GameState is plain JSON data only:
// no classes, Map/Set, Date, functions or cycles; entities reference each other by numeric id.
import { TUNING } from '../config/tuning';
import { rngRange, seedFromNumber } from './rng';
import { fenceBounds } from './selectors';

/**
 * The sheep's explicit state machine; feeding.ts owns the seekFood/seekBreedingFood/eating
 * transitions. Later stories add seekCarcass (2.5), stalking (4.3) and dragged (2.7).
 */
export type SheepActivity = 'wander' | 'seekFood' | 'seekBreedingFood' | 'eating';

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
   * Id of the piece a `seekFood` (food piece) or `seekBreedingFood` (breeding piece) sheep walks to.
   * Omitted (deleted) when there is none.
   */
  targetId?: number;
  /** Ate a breeding piece and can be paired by the Breed tool (FR8a). Cleared on turning elder. */
  breedReady: boolean;
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

export interface Carcass {
  id: number;
  x: number;
  y: number;
  createdAt: number;
}

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
