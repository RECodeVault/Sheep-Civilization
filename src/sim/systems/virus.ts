// The virus (FR15): eating a carcass infects a sheep 100% of the time (carcass.ts), and an infected
// sheep dies virusDeathMs later through the single death pipeline (N1), leaving a carcass that keeps
// the chain going. Infected is derived from `infectedAt`, and so is the death deadline. The Must-tier
// counters are feeding, clearing carcasses and the Better Place (2.7); Story 4.5's medicine cures by
// deleting `infectedAt`.
import { TUNING } from '../../config/tuning';
import { emit } from '../events';
import type { GameState, Sheep } from '../state';
import { killSheep } from './carcass';

/**
 * Infects `s` now and emits Infected; the shared helper for carcass eating, overcrowding (4.6) and
 * debug. A sheep is infected once: an infected sheep keeps its first deadline and emits nothing.
 */
export function infectSheep(state: GameState, s: Sheep): void {
  if (s.infectedAt !== undefined) return;
  s.infectedAt = state.time;
  emit({ type: 'Infected', id: s.id, x: s.x, y: s.y });
}

export function updateVirus(state: GameState): void {
  // killSheep replaces state.sheep, so iterate the start-of-tick array. Deaths happen in array order.
  const sheep = state.sheep;
  for (let i = 0; i < sheep.length; i++) {
    const s = sheep[i];
    if (s.infectedAt !== undefined && state.time >= s.infectedAt + TUNING.virusDeathMs) killSheep(state, s.id, 'virus');
  }
}
