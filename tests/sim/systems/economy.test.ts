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

  it('buys Medicine again and again: a dose each, never in owned (FR26, Story 4.5)', () => {
    const state = newGame(5);
    const price = shopPrice('medicine');
    state.money = price * 2;
    const { rng, nextId } = state;
    const earned = state.stats.moneyEarned;
    drained();
    applyCommand(state, { type: 'Buy', item: 'medicine' });
    applyCommand(state, { type: 'Buy', item: 'medicine' });
    expect(state.medicine).toBe(2);
    expect(state.money).toBe(0);
    expect(state.owned).toEqual([]);
    expect(state.stats.moneyEarned).toBe(earned);
    expect(state.rng).toBe(rng);
    expect(state.nextId).toBe(nextId);
    expect(drained()).toEqual([
      { type: 'Bought', item: 'medicine', price },
      { type: 'Bought', item: 'medicine', price },
    ]);
    // A third with no money left: nothing.
    applyCommand(state, { type: 'Buy', item: 'medicine' });
    expect(state.medicine).toBe(2);
    expect(drained()).toEqual([]);
  });

  it('refuses Medicine a dollar short: nothing changes and nothing is emitted', () => {
    const state = newGame(5);
    state.money = shopPrice('medicine') - 1;
    drained();
    const before = structuredClone(state);
    buy(state, 'medicine');
    expect(state).toStrictEqual(before);
    expect(drained()).toEqual([]);
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

  it('locks Better Hoe II behind I, buys each once, and emits Bought with its price (FR24, Story 4.7)', () => {
    const state = newGame(5);
    state.money = shopPrice('hoe1') + shopPrice('hoe2');
    const { rng } = state;
    const earned = state.stats.moneyEarned;
    drained();
    const before = structuredClone(state);
    buy(state, 'hoe2');
    expect(state).toStrictEqual(before);
    expect(drained()).toEqual([]);
    buy(state, 'hoe1');
    buy(state, 'hoe1');
    expect(state.owned).toEqual(['hoe1']);
    expect(drained()).toEqual([{ type: 'Bought', item: 'hoe1', price: shopPrice('hoe1') }]);
    buy(state, 'hoe2');
    expect(state.owned).toEqual(['hoe1', 'hoe2']);
    expect(state.money).toBe(0);
    expect(state.stats.moneyEarned).toBe(earned);
    expect(state.rng).toBe(rng);
    expect(drained()).toEqual([{ type: 'Bought', item: 'hoe2', price: shopPrice('hoe2') }]);
    // A hoe is not land: capacity is unchanged.
    expect(capacity(state)).toBe(TUNING.landCapacities[0]);
  });

  it('buys the Auto-feeder once and emits Bought with its price; earnings and rng untouched (FR25, Story 4.8)', () => {
    const state = newGame(5);
    state.money = shopPrice('autoFeeder') * 2;
    const { rng } = state;
    const earned = state.stats.moneyEarned;
    drained();
    buy(state, 'autoFeeder');
    expect(state.owned).toEqual(['autoFeeder']);
    expect(state.money).toBe(shopPrice('autoFeeder'));
    expect(drained()).toEqual([{ type: 'Bought', item: 'autoFeeder', price: shopPrice('autoFeeder') }]);
    // One only: a second Buy changes nothing and emits nothing.
    const before = structuredClone(state);
    buy(state, 'autoFeeder');
    expect(state).toStrictEqual(before);
    expect(drained()).toEqual([]);
    expect(state.stats.moneyEarned).toBe(earned);
    expect(state.rng).toBe(rng);
    // Not land: capacity is unchanged.
    expect(capacity(state)).toBe(TUNING.landCapacities[0]);
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
