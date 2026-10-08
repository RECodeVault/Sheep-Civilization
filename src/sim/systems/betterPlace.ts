// The Better Place (FR18, Story 2.7): any sheep dropped into the hole is gone, with no carcass and no
// confirmation (FR20). It leaves through removeSheep (pattern N1), so sacrificing the last sheep is a
// loss. Every sacrifice starts the food boost (FR19, Story 2.8): `boostUntil` is reset to 30 s from
// now, never stacked, for innocents and the Abomination alike. `Sacrificed.wasAbomination` carries the
// sheep's isAbomination (Story 4.1): the only channel through which the Abomination's identity reaches
// the view, which reveals it in Story 4.4.
import { TUNING } from '../../config/tuning';
import { emit } from '../events';
import { sheepIndex } from '../selectors';
import type { GameState } from '../state';
import { removeSheep } from './carcass';

/**
 * Sacrifices sheep `id`, whatever it is doing (usually dragged). An id that is gone is ignored without
 * a fuss: a sacrifice can race a death on the same tick. Draws no rng and takes no id.
 */
export function sacrifice(state: GameState, id: number): void {
  const i = sheepIndex(state, id);
  if (i < 0) return;
  // First, so a Lost from removeSheep follows the Sacrificed that caused it.
  emit({ type: 'Sacrificed', id, wasAbomination: state.sheep[i].isAbomination });
  // FR19: reset, not stacked. Before removeSheep, so a Lost still comes last.
  const renewed = state.time < state.boostUntil;
  state.boostUntil = state.time + TUNING.boostMs;
  emit({ type: 'BoostStarted', until: state.boostUntil, renewed });
  removeSheep(state, id, 'sacrificed');
}
