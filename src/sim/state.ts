// The single serializable game state and the new-game factory. GameState is plain JSON data only:
// no classes, Map/Set, Date, functions or cycles; entities reference each other by numeric id.
import { TUNING } from '../config/tuning';
import { rngRange, seedFromNumber } from './rng';
import { fenceBounds } from './selectors';

/** Later stories widen this (seekFood, eating, seekCarcass, dragged, …). */
export type SheepActivity = 'wander';

export interface Sheep {
  id: number;
  x: number;
  y: number;
  /** Game-ms; negative for sheep born before the save began. Stage is derived from it. */
  bornAt: number;
  fullness: number;
  activity: SheepActivity;
}

export interface FoodPiece {
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
  food: number;
  foodPieces: FoodPiece[];
  carcasses: Carcass[];
  stats: Stats;
  /** Change-detection cache for EraChanged only; display reads currentEra(state). */
  lastEra: Era;
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
  };
  state.sheep.push(s);
  return s;
}

export function createNewGame(seed: number): GameState {
  const state: GameState = {
    time: 0,
    nextId: 1,
    rng: seedFromNumber(seed),
    sheep: [],
    food: TUNING.startFood,
    foodPieces: [],
    carcasses: [],
    stats: { died: 0, sold: 0, sacrificed: 0, moneyEarned: 0, peakFlock: 0 },
    lastEra: 'pasture',
  };
  const f = fenceBounds(state);
  const inset = TUNING.spawnInset;
  for (let i = 0; i < TUNING.interimFlockAdults; i++) {
    createSheep(state, {
      x: Math.round(rngRange(state, f.x + inset, f.x + f.width - inset)),
      y: Math.round(rngRange(state, f.y + inset, f.y + f.height - inset)),
      bornAt: -TUNING.startAdultAgeMs,
    });
  }
  state.stats.peakFlock = state.sheep.length;
  return state;
}
