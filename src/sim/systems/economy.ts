// The shop (Story 3.2): the spend side of money (FR21; selling, the earn side, is market.ts). A Buy
// spends the price and records a one-time item in `state.owned`, with no confirmation (UX-DR68). The
// rule for what can be bought is selectors.ts buyBlock, shared with the shop panel. What an owned item
// does is derived elsewhere from `owned`: capacity and the fence (selectors.ts landTier, 3.3), Better
// Hoe (4.7). Decorations have no sim effect at all: the view draws the owned ones (Story 3.4).
// Purchases are commands, so this module has no update function.
// Draws no rng.
import { emit } from '../events';
import { buyBlock, shopPrice } from '../selectors';
import type { GameState, ShopItemId } from '../state';

/**
 * Buys `item` if it can be bought now: not owned, its prerequisite owned and affordable. Otherwise
 * nothing happens (the view's look is only a hint: a fast second click, or money spent by an earlier
 * command in the same batch). Never touches stats.moneyEarned, which counts earnings only.
 */
export function buy(state: GameState, item: ShopItemId): void {
  if (buyBlock(state, item) !== null) return;
  const price = shopPrice(item);
  state.money -= price;
  state.owned.push(item);
  emit({ type: 'Bought', item, price });
}
