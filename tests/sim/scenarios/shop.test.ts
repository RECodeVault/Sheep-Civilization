import { describe, expect, it } from 'vitest';
import { TICK_MS } from '../../../src/config/constants';
import { TUNING } from '../../../src/config/tuning';
import { applyCommand, type Command } from '../../../src/sim/commands';
import { drainEvents, type SimEvent } from '../../../src/sim/events';
import { shopPrice, stageOf } from '../../../src/sim/selectors';
import type { GameState } from '../../../src/sim/state';
import { fillFlock, newGame, runFor } from '../helpers';

/** Five adults to sell (the founding lamb cannot be sold). */
function fiveAdults(state: GameState): GameState['sheep'] {
  fillFlock(state, 8);
  const adults = state.sheep.filter((s) => stageOf(s, state) === 'adult').slice(0, 5);
  expect(adults).toHaveLength(5);
  return adults;
}

/** One frame's command batch, applied in queue order as GameScene does, then one tick. */
function tickWith(state: GameState, cmds: readonly Command[]): SimEvent[] {
  for (const c of cmds) applyCommand(state, c);
  const out: SimEvent[] = [];
  drainEvents((e) => out.push(e));
  return out.concat(runFor(state, TICK_MS));
}

describe('the shop in play (FR21, UX-DR24)', () => {
  it('sales fund a purchase queued after them in the same batch', () => {
    const state = newGame(9);
    const [a, b, c, d, e] = fiveAdults(state);
    // Five adults sold pay for Land I (GDD Pacing: "$50 = 5 adults").
    expect(TUNING.sellPriceAdult * 5).toBeGreaterThanOrEqual(shopPrice('land1'));
    const events = tickWith(state, [
      { type: 'Sell', id: a.id },
      { type: 'Sell', id: b.id },
      { type: 'Sell', id: c.id },
      { type: 'Sell', id: d.id },
      { type: 'Sell', id: e.id },
      { type: 'Buy', item: 'land1' },
    ]);
    expect(state.owned).toEqual(['land1']);
    expect(state.money).toBe(TUNING.sellPriceAdult * 5 - shopPrice('land1'));
    expect(state.stats.moneyEarned).toBe(TUNING.sellPriceAdult * 5);
    expect(events.filter((x) => x.type === 'Bought')).toEqual([{ type: 'Bought', item: 'land1', price: shopPrice('land1') }]);
  });

  it('a purchase queued before the sales that would fund it does nothing', () => {
    const state = newGame(9);
    const sells: Command[] = fiveAdults(state).map((s) => ({ type: 'Sell', id: s.id }));
    const events = tickWith(state, [{ type: 'Buy', item: 'land1' }, ...sells]);
    expect(state.owned).toEqual([]);
    expect(state.money).toBe(TUNING.sellPriceAdult * 5);
    expect(events.some((x) => x.type === 'Bought')).toBe(false);
  });

  it('a fast double click buys once and money never goes negative', () => {
    const state = newGame(9);
    state.money = shopPrice('scarecrow') + shopPrice('flowerPatch') - 1;
    tickWith(state, [
      { type: 'Buy', item: 'scarecrow' },
      { type: 'Buy', item: 'scarecrow' },
      { type: 'Buy', item: 'flowerPatch' },
    ]);
    expect(state.owned).toEqual(['scarecrow']);
    expect(state.money).toBe(shopPrice('flowerPatch') - 1);
    expect(state.money).toBeGreaterThanOrEqual(0);
  });
});
