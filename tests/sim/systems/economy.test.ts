import { describe, expect, it } from 'vitest';
import { TUNING } from '../../../src/config/tuning';
import { applyCommand } from '../../../src/sim/commands';
import { drainEvents, type SimEvent } from '../../../src/sim/events';
import { capacity, shopPrice } from '../../../src/sim/selectors';
import { buy } from '../../../src/sim/systems/economy';
import { newGame } from '../helpers';

function drained(): SimEvent[] {
  const out: SimEvent[] = [];
  drainEvents((e) => out.push(e));
  return out;
}

describe('buy (Buy command, UX-DR24)', () => {
  it('spends the price, records the item and emits Bought; earnings, rng and ids are untouched', () => {
    const state = newGame(5);
    const price = shopPrice('flowerPatch');
    state.money = price;
    const { rng, nextId } = state;
    const earned = state.stats.moneyEarned;
    drained();
    applyCommand(state, { type: 'Buy', item: 'flowerPatch' });
    expect(state.money).toBe(0);
    expect(state.owned).toEqual(['flowerPatch']);
    expect(state.stats.moneyEarned).toBe(earned);
    expect(state.rng).toBe(rng);
    expect(state.nextId).toBe(nextId);
    expect(drained()).toEqual([{ type: 'Bought', item: 'flowerPatch', price }]);
  });

  it('refuses an unaffordable item: nothing changes and nothing is emitted', () => {
    const state = newGame(5);
    state.money = shopPrice('scarecrow') - 1;
    drained();
    const before = structuredClone(state);
    buy(state, 'scarecrow');
    expect(state).toStrictEqual(before);
    expect(drained()).toEqual([]);
  });

  it('refuses a one-time item already owned', () => {
    const state = newGame(5);
    state.money = shopPrice('scarecrow') * 2;
    buy(state, 'scarecrow');
    drained();
    const before = structuredClone(state);
    buy(state, 'scarecrow');
    expect(state).toStrictEqual(before);
    expect(drained()).toEqual([]);
  });

  it('locks each Land tier behind the previous one', () => {
    const state = newGame(5);
    state.money = shopPrice('land1') + shopPrice('land2') + shopPrice('land3');
    const before = structuredClone(state);
    buy(state, 'land2');
    buy(state, 'land3');
    expect(state).toStrictEqual(before);
    buy(state, 'land1');
    buy(state, 'land3');
    expect(state.owned).toEqual(['land1']);
    buy(state, 'land2');
    buy(state, 'land3');
    expect(state.owned).toEqual(['land1', 'land2', 'land3']);
    expect(state.money).toBe(0);
  });

  it('buys with exactly the price', () => {
    const state = newGame(5);
    state.money = shopPrice('land1');
    buy(state, 'land1');
    expect(state.owned).toEqual(['land1']);
    expect(state.money).toBe(0);
  });

  it('a lost game takes no Buy', () => {
    const state = newGame(5);
    state.money = shopPrice('land1');
    state.lostAt = state.time;
    applyCommand(state, { type: 'Buy', item: 'land1' });
    expect(state.owned).toEqual([]);
    expect(state.money).toBe(shopPrice('land1'));
  });

  it('Land I raises capacity to the next tier (Story 3.3)', () => {
    const state = newGame(5);
    expect(capacity(state)).toBe(TUNING.landCapacities[0]);
    state.money = shopPrice('land1');
    buy(state, 'land1');
    expect(capacity(state)).toBe(TUNING.landCapacities[1]);
  });
});
