// Advances the sim by one fixed tick. The only place systems are called from.
import { TICK_MS } from '../config/constants';
import type { GameState } from './state';
import { updateAbomination } from './systems/abomination';
import { updateAutoFeeder } from './systems/autoFeeder';
import { updateCarcassEating } from './systems/carcass';
import { updateEras } from './systems/eras';
import { updateFeeding } from './systems/feeding';
import { updateHunger } from './systems/hunger';
import { updateLifecycle } from './systems/lifecycle';
import { updateMovement } from './systems/movement';
import { updateOvercrowding } from './systems/overcrowding';
import { updateVirus } from './systems/virus';

/*
 * Systems run in this fixed order, after time has advanced:
 *   movement → feeding → carcassEating → hunger → lifecycle → virus → abomination → overcrowding →
 *   autoFeeder → eras
 * Carcass eating follows feeding, so food claims win first (FR14), and precedes hunger, so a sheep that
 * eats on the tick it would starve lives. The Abomination (Story 4.3) follows movement, so contact is
 * tested on the tick's moved positions, and feeding, so a hungry Abomination is claimed for food before
 * a visit can start. Overcrowding (Story 4.6) follows the virus and the Abomination, so it rolls on the
 * tick's flock after their deaths: a sheep that just died is never picked. The Auto-feeder (Story 4.8)
 * follows them all for the same reason; its piece is claimed by the next tick's feeding pass.
 * Systems never call each other; they share data only through GameState.
 */
export type System = (state: GameState) => void;

/** The systems in their fixed order. Exported for tests that step without one of them; game code calls step(). */
export const SYSTEMS: readonly System[] = Object.freeze([
  updateMovement,
  updateFeeding,
  updateCarcassEating,
  updateHunger,
  updateLifecycle,
  updateVirus,
  updateAbomination,
  updateOvercrowding,
  updateAutoFeeder,
  // Always last: it sees the tick's births, deaths and the commands applied before it (pattern N4).
  updateEras,
]);

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
