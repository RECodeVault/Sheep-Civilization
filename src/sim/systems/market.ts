// The Market (FR17, Story 3.1): an adult or elder dropped on the stall is sold, with no carcass and no
// confirmation (FR20). It leaves through removeSheep (pattern N1), so selling the last sheep is a loss.
// The price comes from salePrice (adult $10, elder $5), by the sheep's stage when the command applies;
// selling is the only way to earn money (FR21). A lamb is never sold. stageOf reports the Abomination
// as a lamb at any age (FR30), so it can never be sold either: no secret is read here. Pick-up and the
// sale are commands, so this module has no update function.
import { emit } from '../events';
import { salePrice, sheepIndex, stageOf } from '../selectors';
import type { GameState } from '../state';
import { removeSheep } from './carcass';

/**
 * Sells sheep `id`, whatever it is doing (usually dragged). An id that is gone is ignored without a
 * fuss: a sale can race a death on the same tick. A lamb is not sold; one that is dragged is put down
 * where the sim holds it (its pickup spot), so it never hangs in the air. Draws no rng and takes no id.
 */
export function sell(state: GameState, id: number): void {
  const i = sheepIndex(state, id);
  if (i < 0) return;
  const s = state.sheep[i];
  const price = salePrice(stageOf(s, state));
  if (price === 0) {
    if (s.activity === 'dragged') s.activity = 'wander';
    return;
  }
  // First, so a Lost from removeSheep follows the Sold that caused it.
  emit({ type: 'Sold', id, price });
  state.money += price;
  state.stats.moneyEarned += price;
  removeSheep(state, id, 'sold');
}
