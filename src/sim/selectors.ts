// Read-only views of GameState. The view layer reads state only through these.
import { TUNING, type Rect } from '../config/tuning';
import type { FoodPiece, GameState, Sheep } from './state';

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

/** The only sheep shape the view may consume. Later stories add name, infected, gait, activity. */
export interface PublicSheep {
  id: number;
  x: number;
  y: number;
  stage: Stage;
  hunger: Hunger;
}

export function publicSheep(s: Sheep, state: GameState): PublicSheep {
  return { id: s.id, x: s.x, y: s.y, stage: stageOf(s, state), hunger: hungerOf(s.fullness) };
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
      p = { id: 0, x: 0, y: 0, stage: 'adult', hunger: 'fed' };
      out[i] = p;
    }
    p.id = s.id;
    p.x = s.x;
    p.y = s.y;
    p.stage = stageOf(s, state);
    p.hunger = hungerOf(s.fullness);
  }
  out.length = sheep.length;
  return out;
}

/** Index of the food piece with `id` in state.foodPieces, or -1. A plain loop: no closure per call. */
export function pieceIndex(state: GameState, id: number): number {
  const pieces = state.foodPieces;
  for (let i = 0; i < pieces.length; i++) if (pieces[i].id === id) return i;
  return -1;
}

/** Food pieces hold no secrets: the view reads the live array (no copy, no allocation). */
export function selectFoodPieces(state: GameState): readonly FoodPiece[] {
  return state.foodPieces;
}

/** What the HUD shows. Later stories add breeding food, money, flock, capacity, threats and boost. */
export interface HudView {
  /** Pips in the current Farm bar, out of farmPipsPerFood (FR3). */
  farmProgress: number;
  farmPipsPerFood: number;
}

/** Fills `out` in place (no allocation) and returns it. HudScene calls this once per frame. */
export function selectHudView(state: GameState, out: HudView): HudView {
  out.farmProgress = state.farmProgress;
  out.farmPipsPerFood = TUNING.farmPipsPerFood;
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
