// Read-only views of GameState. The view layer reads state only through these.
import { TUNING, type Rect } from '../config/tuning';
import type { BreedingPiece, Carcass, FoodPiece, GameState, Pregnancy, Sheep } from './state';

/** The fenced area sheep live in. Epic 3 makes it depend on the land tier. */
export function fenceBounds(_state: GameState): Rect {
  return TUNING.startFence;
}

/** Edges of the area a sheep centre (and so a food piece) may occupy: the fence inset by fenceInset. */
export interface InnerFence {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/** Allocates; for events (piece creation), not per-tick loops. Movement inlines the same rect. */
export function innerFence(state: GameState): InnerFence {
  const f = fenceBounds(state);
  const i = TUNING.fenceInset;
  return { left: f.x + i, right: f.x + f.width - i, top: f.y + i, bottom: f.y + f.height - i };
}

export type Hunger = 'fed' | 'hungry' | 'starving';

/**
 * Float tolerance for Fullness comparisons. The per-tick drain (100/1 200) is not exact, so a value
 * that should be exactly 50 or 25 reads 50.0000000000016 or 24.9999999999993, and an empty sheep
 * reads about 1e-13. Values this close to a bound count as on it. Numerical, not a balance value.
 */
export const FULLNESS_EPSILON = 1e-6;

/** FR2: Fed above `fedAbove`, Starving below `starvingBelow`, Hungry in between (inclusive). Never stored. */
export function hungerOf(fullness: number): Hunger {
  if (fullness > TUNING.fedAbove + FULLNESS_EPSILON) return 'fed';
  if (fullness < TUNING.starvingBelow - FULLNESS_EPSILON) return 'starving';
  return 'hungry';
}

export type Stage = 'lamb' | 'adult' | 'elder';

/**
 * FR7: stage from age (`state.time - bornAt`). Never stored. There is no upper bound: lifecycle.ts
 * kills an elder on the tick it reaches oldAgeMs.
 */
export function stageOf(s: Sheep, state: GameState): Stage {
  const age = state.time - s.bornAt;
  if (age < TUNING.lambUntilMs) return 'lamb';
  if (age < TUNING.elderFromMs) return 'adult';
  return 'elder';
}

/** FR10: true until the tick time reaches cooldownUntil. Derived, never stored. */
export function onCooldown(s: Sheep, state: GameState): boolean {
  return state.time < s.cooldownUntil;
}

/**
 * FR9/FR10: the one pairing rule, for the sim's Breed and (through PublicSheep) the Breed tool: a
 * ready adult that is off cooldown.
 */
export function canBreed(s: Sheep, state: GameState): boolean {
  return s.breedReady && stageOf(s, state) === 'adult' && !onCooldown(s, state);
}

/** Land capacity (FR11). Story 3.3 adds the land tiers. */
export function capacity(_state: GameState): number {
  return TUNING.baseCapacity;
}

/** AR21: capacity counts living sheep plus pending lambs. */
export function slotsUsed(state: GameState): number {
  return state.sheep.length + state.pregnancies.length;
}

/** Why the Breed tool is greyed (FR11, UX-DR31), or null when breeding is possible. */
export type BreedBlock = 'capacity' | 'notReady' | null;

/** Capacity wins when both apply. A plain loop: no allocation. */
export function breedBlock(state: GameState): BreedBlock {
  if (slotsUsed(state) >= capacity(state)) return 'capacity';
  let eligible = 0;
  const sheep = state.sheep;
  for (let i = 0; i < sheep.length && eligible < 2; i++) if (canBreed(sheep[i], state)) eligible++;
  return eligible < 2 ? 'notReady' : null;
}

/** The only sheep shape the view may consume. Later stories add name, gait, activity. */
export interface PublicSheep {
  id: number;
  x: number;
  y: number;
  stage: Stage;
  hunger: Hunger;
  /** Ready to breed (FR8a). Not secret: the Abomination never grows past a lamb, so it is never ready. */
  ready: boolean;
  /** On breeding cooldown (FR10): the tooltip's heart-outline icon. */
  onCooldown: boolean;
  /** May be picked by the Breed tool (canBreed). Not secret either: the Abomination is never an adult. */
  canBreed: boolean;
  /** Infected (FR15): the tint, marker and wobble. Not secret: the Abomination can catch it like any lamb. */
  infected: boolean;
}

export function publicSheep(s: Sheep, state: GameState): PublicSheep {
  return {
    id: s.id,
    x: s.x,
    y: s.y,
    stage: stageOf(s, state),
    hunger: hungerOf(s.fullness),
    ready: s.breedReady,
    onCooldown: onCooldown(s, state),
    canBreed: canBreed(s, state),
    infected: s.infectedAt !== undefined,
  };
}

/**
 * Fills `out` with one PublicSheep per living sheep, reusing the objects already in `out` so a
 * per-frame call allocates nothing unless the flock has grown. Returns `out`.
 */
export function selectPublicSheep(state: GameState, out: PublicSheep[]): PublicSheep[] {
  const sheep = state.sheep;
  for (let i = 0; i < sheep.length; i++) {
    const s = sheep[i];
    let p = out[i];
    if (p === undefined) {
      p = { id: 0, x: 0, y: 0, stage: 'adult', hunger: 'fed', ready: false, onCooldown: false, canBreed: false, infected: false };
      out[i] = p;
    }
    p.id = s.id;
    p.x = s.x;
    p.y = s.y;
    p.stage = stageOf(s, state);
    p.hunger = hungerOf(s.fullness);
    p.ready = s.breedReady;
    p.onCooldown = onCooldown(s, state);
    p.canBreed = canBreed(s, state);
    p.infected = s.infectedAt !== undefined;
  }
  out.length = sheep.length;
  return out;
}

/** Index of the sheep with `id` in state.sheep, or -1. A plain loop: no closure per call. */
export function sheepIndex(state: GameState, id: number): number {
  const sheep = state.sheep;
  for (let i = 0; i < sheep.length; i++) if (sheep[i].id === id) return i;
  return -1;
}

/** A lamb on the way, as the view draws it: a heart between the parents (UX-DR56). */
export interface PublicPregnancy {
  id: number;
  /** The parents' ids (not secret), so the view can place the heart between their drawn sprites. */
  parentA: number;
  parentB: number;
  x: number;
  y: number;
}

/**
 * Where a pending lamb is (UX-DR56) and is born (FR9): the midpoint of the parents still alive, the
 * one left, or the stored spot. Writes into `out` (no allocation) and returns it.
 */
export function pregnancySpot<T extends { x: number; y: number }>(state: GameState, g: Pregnancy, out: T): T {
  const a = sheepIndex(state, g.parentA);
  const b = sheepIndex(state, g.parentB);
  if (a >= 0 && b >= 0) {
    out.x = (state.sheep[a].x + state.sheep[b].x) / 2;
    out.y = (state.sheep[a].y + state.sheep[b].y) / 2;
  } else if (a >= 0 || b >= 0) {
    const s = state.sheep[a >= 0 ? a : b];
    out.x = s.x;
    out.y = s.y;
  } else {
    out.x = g.x;
    out.y = g.y;
  }
  return out;
}

/** Fills `out` with one PublicPregnancy per pending lamb, reusing its objects like selectPublicSheep. */
export function selectPregnancies(state: GameState, out: PublicPregnancy[]): PublicPregnancy[] {
  const list = state.pregnancies;
  for (let i = 0; i < list.length; i++) {
    let p = out[i];
    if (p === undefined) {
      p = { id: 0, parentA: 0, parentB: 0, x: 0, y: 0 };
      out[i] = p;
    }
    p.id = list[i].id;
    p.parentA = list[i].parentA;
    p.parentB = list[i].parentB;
    pregnancySpot(state, list[i], p);
  }
  out.length = list.length;
  return out;
}

/** Index of the food piece with `id` in state.foodPieces, or -1. A plain loop: no closure per call. */
export function pieceIndex(state: GameState, id: number): number {
  const pieces = state.foodPieces;
  for (let i = 0; i < pieces.length; i++) if (pieces[i].id === id) return i;
  return -1;
}

/** Index of the breeding piece with `id` in state.breedingPieces, or -1. A plain loop, like pieceIndex. */
export function breedingPieceIndex(state: GameState, id: number): number {
  const pieces = state.breedingPieces;
  for (let i = 0; i < pieces.length; i++) if (pieces[i].id === id) return i;
  return -1;
}

/** Breeding pieces hold no secrets either: the live array, as selectFoodPieces. */
export function selectBreedingPieces(state: GameState): readonly BreedingPiece[] {
  return state.breedingPieces;
}

/** Index of the carcass with `id` in state.carcasses, or -1. A plain loop, like pieceIndex. */
export function carcassIndex(state: GameState, id: number): number {
  const list = state.carcasses;
  for (let i = 0; i < list.length; i++) if (list[i].id === id) return i;
  return -1;
}

/**
 * Carcasses hold no secrets either (an Abomination victim's carcass is just a carcass): the live
 * array, as selectFoodPieces.
 */
export function selectCarcasses(state: GameState): readonly Carcass[] {
  return state.carcasses;
}

/** Food pieces hold no secrets: the view reads the live array (no copy, no allocation). */
export function selectFoodPieces(state: GameState): readonly FoodPiece[] {
  return state.foodPieces;
}

/**
 * The threat summary's live counts (UX-DR39). A sheep that is both Starving and infected counts in
 * both. Derived exactly as PublicSheep's `hunger` and `infected`, so the HUD never counts anything the
 * field does not show (the Abomination counts like any lamb, never on its own account; UX-DR64).
 */
export interface ThreatCounts {
  starving: number;
  infected: number;
  carcasses: number;
}

/**
 * FR19: a sacrifice food boost is running. It ends exactly at boostUntil. A lost game is never boosted:
 * time stops with the loss (often a last-sheep sacrifice), so its deadline would otherwise stay ahead.
 */
export function isBoosted(state: GameState): boolean {
  return state.lostAt === undefined && state.time < state.boostUntil;
}

/** Game-ms left of the food boost, or 0 when none is running (the HUD's boost timer). */
export function boostRemainingMs(state: GameState): number {
  return isBoosted(state) ? state.boostUntil - state.time : 0;
}

/**
 * The pips one Farm click fills (FR3, FR19). Better Hoe (4.7) raises the base here; the boost
 * doubles whatever the base is. The breeding bar never uses this (FR8).
 */
export function farmPipsPerClick(state: GameState): number {
  return TUNING.farmPipsPerClick * (isBoosted(state) ? TUNING.boostPipMultiplier : 1);
}

/** What the HUD shows. Later stories add money, flock and capacity. */
export interface HudView {
  /** Pips in the current Farm bar, out of farmPipsPerFood (FR3). */
  farmProgress: number;
  farmPipsPerFood: number;
  /** Pips in the current breeding bar, out of breedingPipsPerFood (FR8). */
  breedingProgress: number;
  breedingPipsPerFood: number;
  /** Why Breed is greyed, or null (FR11). */
  breedBlock: BreedBlock;
  /** Game-ms left of the food boost, 0 when none (FR19): the Farm glow and the boost timer. */
  boostRemainingMs: number;
  /** The threat summary (UX-DR39), filled in place. */
  threats: ThreatCounts;
}

/** Fills `out` in place (no allocation) and returns it. HudScene calls this once per frame. */
export function selectHudView(state: GameState, out: HudView): HudView {
  out.farmProgress = state.farmProgress;
  out.farmPipsPerFood = TUNING.farmPipsPerFood;
  out.breedingProgress = state.breedingProgress;
  out.breedingPipsPerFood = TUNING.breedingPipsPerFood;
  out.breedBlock = breedBlock(state);
  out.boostRemainingMs = boostRemainingMs(state);
  const t = out.threats;
  let starving = 0;
  let infected = 0;
  const sheep = state.sheep;
  for (let i = 0; i < sheep.length; i++) {
    const s = sheep[i];
    if (hungerOf(s.fullness) === 'starving') starving++;
    if (s.infectedAt !== undefined) infected++;
  }
  t.starving = starving;
  t.infected = infected;
  t.carcasses = state.carcasses.length;
  return out;
}

/** FR38: the flock reached 0 and the sim has stopped. Derived from state.lostAt. */
export function isLost(state: GameState): boolean {
  return state.lostAt !== undefined;
}

/** What the lose screen shows (UX-DR19). */
export interface LoseView {
  /** Game-ms survived: the loss time, or the current time while still playing. */
  survivedMs: number;
  peakFlock: number;
}

/** Fills `out` in place (no allocation) and returns it. */
export function selectLoseView(state: GameState, out: LoseView): LoseView {
  out.survivedMs = state.lostAt ?? state.time;
  out.peakFlock = state.stats.peakFlock;
  return out;
}
