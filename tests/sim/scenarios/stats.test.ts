import { describe, expect, it } from 'vitest';
import { TICK_MS } from '../../../src/config/constants';
import { TUNING } from '../../../src/config/tuning';
import { applyCommand } from '../../../src/sim/commands';
import { selectStatsView, shopPrice, type StatsView } from '../../../src/sim/selectors';
import { createSheep, type GameState } from '../../../src/sim/state';
import { makeAbomination } from '../../../src/sim/systems/abomination';
import { killSheep } from '../../../src/sim/systems/carcass';
import { infectSheep } from '../../../src/sim/systems/virus';
import { fillFlock, newGame, runFor } from '../helpers';

// Story 5.4 (FR36): the Stats panel's numbers across the systems that move them. Market and Better
// Place remove a sheep (removeSheep), hunger, virus, old age and the
// Abomination kill one (killSheep).

function stats(state: GameState): StatsView {
  return selectStatsView(state, { alive: 0, sold: 0, died: 0, sacrificed: 0, moneyEarned: 0 });
}

describe('the stats counters (FR36)', () => {
  it('sell, sacrifice, starvation, the virus and old age each move exactly their counter', () => {
    const state = newGame(54);
    fillFlock(state, 8);
    let want = stats(state);
    expect(want).toEqual({ alive: 8, sold: 0, died: 0, sacrificed: 0, moneyEarned: 0 });

    // An adult, then an elder, at the Market.
    applyCommand(state, { type: 'Sell', id: state.sheep[0].id });
    want = { ...want, alive: 7, sold: 1, moneyEarned: TUNING.sellPriceAdult };
    expect(stats(state)).toEqual(want);
    const elder = state.sheep[0];
    elder.bornAt = state.time - (TUNING.elderFromMs + TUNING.oldAgeMs) / 2;
    applyCommand(state, { type: 'Sell', id: elder.id });
    want = { ...want, alive: 6, sold: 2, moneyEarned: TUNING.sellPriceAdult + TUNING.sellPriceElder };
    expect(stats(state)).toEqual(want);

    // A sacrifice: counted, and no money.
    applyCommand(state, { type: 'Sacrifice', id: state.sheep[0].id });
    want = { ...want, alive: 5, sacrificed: 1 };
    expect(stats(state)).toEqual(want);

    // Starvation: one tick at the edge of empty.
    for (const s of state.sheep) s.fullness = TUNING.fullnessMax;
    state.sheep[0].fullness = 0.01;
    runFor(state, TICK_MS);
    want = { ...want, alive: 4, died: 1 };
    expect(stats(state)).toEqual(want);

    // The virus: dies virusDeathMs after infection.
    for (const s of state.sheep) s.fullness = TUNING.fullnessMax;
    infectSheep(state, state.sheep[0]);
    runFor(state, TUNING.virusDeathMs + TICK_MS);
    want = { ...want, alive: 3, died: 2 };
    expect(stats(state)).toEqual(want);

    // Old age: dies on the tick its age reaches oldAgeMs.
    for (const s of state.sheep) s.fullness = TUNING.fullnessMax;
    state.sheep[0].bornAt = state.time - TUNING.oldAgeMs;
    runFor(state, TICK_MS);
    want = { ...want, alive: 2, died: 3 };
    expect(stats(state)).toEqual(want);
  });

  it('spending in the shop lowers money, never money earned', () => {
    const state = newGame(54);
    fillFlock(state, 20);
    const sales = Math.ceil(shopPrice('scarecrow') / TUNING.sellPriceAdult);
    // The last ones: fillFlock's adults (the founders' lamb cannot be sold).
    for (let i = 0; i < sales; i++) applyCommand(state, { type: 'Sell', id: state.sheep[state.sheep.length - 1].id });
    const earned = state.stats.moneyEarned;
    expect(earned).toBe(sales * TUNING.sellPriceAdult);
    applyCommand(state, { type: 'Buy', item: 'scarecrow' });
    expect(state.money).toBe(earned - shopPrice('scarecrow'));
    expect(stats(state).moneyEarned).toBe(earned);
  });
});

describe('the stats keep the Abomination secret (UX-DR64)', () => {
  function withLamb(abomination: boolean): { state: GameState; lambId: number } {
    const state = newGame(54);
    fillFlock(state, 6);
    const lamb = createSheep(state, { x: state.sheep[0].x, y: state.sheep[0].y, bornAt: state.time });
    if (abomination) makeAbomination(state, lamb);
    return { state, lambId: lamb.id };
  }

  it('a living Abomination is alive like any lamb', () => {
    expect(stats(withLamb(true).state)).toEqual(stats(withLamb(false).state));
  });

  it('its victim counts in died; sacrificing it counts in sacrificed', () => {
    const { state, lambId } = withLamb(true);
    const before = stats(state);
    killSheep(state, state.sheep[0].id, 'abomination');
    applyCommand(state, { type: 'Sacrifice', id: lambId });
    expect(stats(state)).toEqual({ ...before, alive: before.alive - 2, died: 1, sacrificed: 1 });
  });
});
