// Advances the sim by one fixed tick. The only place systems are called from.
import { TICK_MS } from '../config/constants';
import type { GameState } from './state';
import { updateFeeding } from './systems/feeding';
import { updateHunger } from './systems/hunger';
import { updateLifecycle } from './systems/lifecycle';
import { updateMovement } from './systems/movement';

/*
 * Systems run in this fixed order, after time has advanced. Intended order as systems arrive:
 *   movement → feeding → hunger → lifecycle → virus → abomination → overcrowding → autoFeeder → eras
 * Systems never call each other; they share data only through GameState.
 */
export type System = (state: GameState) => void;

const SYSTEMS: readonly System[] = [
  updateMovement,
  updateFeeding,
  updateHunger,
  updateLifecycle,
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
