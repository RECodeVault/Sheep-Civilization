// Advances the sim by one fixed tick. The only place systems are called from.
import { TICK_MS } from '../config/constants';
import type { GameState } from './state';
import { updateCarcassEating } from './systems/carcass';
import { updateEras } from './systems/eras';
import { updateFeeding } from './systems/feeding';
import { updateHunger } from './systems/hunger';
import { updateLifecycle } from './systems/lifecycle';
import { updateMovement } from './systems/movement';
import { updateVirus } from './systems/virus';

/*
 * Systems run in this fixed order, after time has advanced. Intended order as systems arrive:
 *   movement → feeding → carcassEating → hunger → lifecycle → virus → abomination → overcrowding →
 *   autoFeeder → eras
 * Carcass eating follows feeding, so food claims win first (FR14), and precedes hunger, so a sheep that
 * eats on the tick it would starve lives.
 * Systems never call each other; they share data only through GameState.
 */
export type System = (state: GameState) => void;

const SYSTEMS: readonly System[] = [
  updateMovement,
  updateFeeding,
  updateCarcassEating,
  updateHunger,
  updateLifecycle,
  updateVirus,
  // Always last: it sees the tick's births, deaths and the commands applied before it (pattern N4).
  updateEras,
];

export function step(state: GameState): void {
  stepWith(state, SYSTEMS);
}

/** step() over a given system list. Exported for tests of the loop itself; game code calls step(). */
export function stepWith(state: GameState, systems: readonly System[]): void {
  // FR38: a lost game is stopped. Before the time advance, so time survived stays fixed.
  if (state.lostAt !== undefined) return;
  // Time advances first, so systems compare deadlines against the new time (`state.time >= diesAt`).
  state.time += TICK_MS;
  for (let i = 0; i < systems.length; i++) {
    systems[i](state);
    // A death mid-tick may have lost the game: no later system runs on a lost game.
    if (state.lostAt !== undefined) return;
  }
}
