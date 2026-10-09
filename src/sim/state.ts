// The single serializable game state and the new-game factory. GameState is plain JSON data only:
// no classes, Map/Set, Date, functions or cycles; entities reference each other by numeric id.
import { TUNING } from '../config/tuning';
import { rngInt, rngRange, seedFromNumber } from './rng';
import { fenceBounds } from './selectors';

/**
 * The sheep's explicit state machine; feeding.ts owns the seekFood/seekBreedingFood/eating
 * transitions, carcass.ts owns seekCarcass (FR14), drag.ts owns dragged (FR16, 2.7) and abomination.ts
 * owns stalking (the Abomination's visit, FR31, Story 4.3). PublicSheep reports stalking as wander.
 */
export type SheepActivity =
  | 'wander'
  | 'seekFood'
  | 'seekBreedingFood'
  | 'seekCarcass'
  | 'eating'
  | 'dragged'
  | 'stalking';

/** The three steps of the Abomination's visit (FR31): walk up to the victim, stand by it, walk away. */
export type StalkPhase = 'approach' | 'linger' | 'leave';

/**
 * SECRET (AR18, pattern N2): the Abomination's visit in progress (Story 4.3). `until` is a game-ms
 * deadline whose meaning depends on the phase: approach, when the hunt is given up; linger, when it ends
 * (and the victim is doomed); leave, when the Abomination wanders again.
 */
export interface Stalk {
  victimId: number;
  phase: StalkPhase;
  until: number;
}

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
   * virus death at `infectedAt + TUNING.virusDeathMs` (virus.ts). Medicine deletes it (medicine.ts).
   */
  infectedAt?: number;
  /**
   * SECRET (AR18, pattern N2): this sheep is the Abomination (Story 4.1). Read only in src/sim/,
   * src/debug/ and src/save/ (lint-enforced); the view sees PublicSheep, where it is a lamb like any
   * other except for `gait`. Set at birth by abomination.ts onBirth, never cleared.
   */
  isAbomination: boolean;
  /**
   * SECRET (AR18): the Abomination's visit (Story 4.3). Only on the Abomination, and present exactly
   * while its activity is `stalking`. Omitted otherwise.
   */
  stalk?: Stalk;
  /**
   * SECRET (AR18): game-ms of this victim's delayed death after the Abomination's visit (FR31, Story 4.3;
   * abomination.ts). Never on the Abomination. Omitted otherwise.
   */
  doomedAt?: number;
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

/**
 * A row in the shop panel (Story 4.5): a one-time item, or `'medicine'`, the one consumable. Medicine is
 * counted in `GameState.medicine` and is never in `owned`.
 */
export type ShopRowId = ShopItemId | 'medicine';

/** Era ids double as background texture keys. */
export type Era = 'pasture' | 'village' | 'town' | 'wool-empire';

export interface Stats {
  died: number;
  sold: number;
  sacrificed: number;
  moneyEarned: number;
  peakFlock: number;
}

/**
 * The Abomination's spawn and kill bookkeeping (FR29, FR31, pattern N2). SECRET like
 * `Sheep.isAbomination`: the view never reads it.
 */
export interface AbominationState {
  /** Lambs born from pregnancies so far in this save (the founding lamb is not a birth). */
  birthsSeen: number;
  /**
   * The birth that is guaranteed to be the Abomination, rolled once at new game in
   * [abominationGuaranteedBirthMin, abominationGuaranteedBirthMax]. Births after it roll
   * abominationBirthChance.
   */
  guaranteedAtBirth: number;
  /**
   * Game-ms deadline of the living Abomination's next visit (FR31, Story 4.3): set when a sheep becomes
   * the Abomination and at the start of each leave. It may be past due while the Abomination is busy
   * (eating, seeking, dragged). Meaningless while none is alive; 0 at new game.
   */
  nextKillAt: number;
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
  /**
   * Doses of medicine owned (FR26, Story 4.5): bought in the shop (economy.ts), used by ApplyMedicine
   * (medicine.ts). Whole number >= 0. A dose in the player's hand is view-only and still counted here.
   */
  medicine: number;
  pregnancies: Pregnancy[];
  carcasses: Carcass[];
  stats: Stats;
  abomination: AbominationState;
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
    isAbomination: false,
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
    medicine: 0,
    pregnancies: [],
    carcasses: [],
    stats: { died: 0, sold: 0, sacrificed: 0, moneyEarned: 0, peakFlock: 0 },
    // Rolled below, after the founders, so their positions and headings keep the draws they had
    // before Story 4.1.
    abomination: { birthsSeen: 0, guaranteedAtBirth: 0, nextKillAt: 0 },
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
  // FR29: the birth that will be the first Abomination.
  state.abomination.guaranteedAtBirth = rngInt(
    state,
    TUNING.abominationGuaranteedBirthMin,
    TUNING.abominationGuaranteedBirthMax,
  );
  return state;
}
