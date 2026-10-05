// Advances the sim by one fixed tick. The only place systems are called from.
import { TICK_MS } from '../config/constants';
import type { GameState } from './state';

/*
 * Systems run in this fixed order, after time has advanced. Intended order as systems arrive:
 *   movement → feeding → hunger → lifecycle → virus → abomination → overcrowding → autoFeeder → eras
 * Systems never call each other; they share data only through GameState.
 */
const SYSTEMS: readonly ((state: GameState) => void)[] = [];

export function step(state: GameState): void {
  // Time advances first, so systems compare deadlines against the new time (`state.time >= diesAt`).
  state.time += TICK_MS;
  for (let i = 0; i < SYSTEMS.length; i++) SYSTEMS[i](state);
}
