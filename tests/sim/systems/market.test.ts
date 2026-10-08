import { describe, expect, it } from 'vitest';
import { TUNING } from '../../../src/config/tuning';
import { applyCommand } from '../../../src/sim/commands';
import { drainEvents, type SimEvent } from '../../../src/sim/events';
import { createSheep } from '../../../src/sim/state';
import { pickUp } from '../../../src/sim/systems/drag';
import { sell } from '../../../src/sim/systems/market';
import { infectSheep } from '../../../src/sim/systems/virus';
import { newGame } from '../helpers';

function drained(): SimEvent[] {
  const out: SimEvent[] = [];
  drainEvents((e) => out.push(e));
  return out;
}

describe('sell (Sell command, FR17)', () => {
  it('sells an adult: removed with no carcass, money and stats counted, Sold emitted, no rng', () => {
    const state = newGame(5);
    const s = state.sheep[0];
    const others = [state.sheep[1], state.sheep[2]];
    const nextId = state.nextId;
    const rng = state.rng;
    applyCommand(state, { type: 'Sell', id: s.id });
    expect(state.sheep).toEqual(others);
    expect(state.carcasses).toEqual([]);
    expect(state.money).toBe(TUNING.sellPriceAdult);
    expect(state.stats.moneyEarned).toBe(TUNING.sellPriceAdult);
    expect(state.stats.sold).toBe(1);
    expect(state.stats.died).toBe(0);
    expect(state.stats.sacrificed).toBe(0);
    expect(state.nextId).toBe(nextId);
    expect(state.rng).toBe(rng);
    expect(state.boostUntil).toBe(0);
    expect(drained()).toEqual([{ type: 'Sold', id: s.id, price: TUNING.sellPriceAdult }]);
  });

  it('sells an elder for the elder price', () => {
    const state = newGame(5);
    const s = state.sheep[0];
    // Well into the elder stage (the exact boundary has its own test below).
    s.bornAt = state.time - (TUNING.elderFromMs + TUNING.oldAgeMs) / 2;
    drained();
    sell(state, s.id);
    expect(state.money).toBe(TUNING.sellPriceElder);
    expect(state.stats.moneyEarned).toBe(TUNING.sellPriceElder);
    expect(drained()).toEqual([{ type: 'Sold', id: s.id, price: TUNING.sellPriceElder }]);
  });

  it('prices by the stage when the command applies: an adult that just turned elder fetches the elder price', () => {
    const state = newGame(5);
    const s = state.sheep[0];
    state.time = s.bornAt + TUNING.elderFromMs;
    sell(state, s.id);
    expect(state.money).toBe(TUNING.sellPriceElder);
  });

  it('never sells a lamb: nothing changes and nothing is emitted', () => {
    const state = newGame(5);
    const lamb = state.sheep[2];
    drained();
    const before = structuredClone(state);
    sell(state, lamb.id);
    expect(state).toStrictEqual(before);
    expect(drained()).toEqual([]);
  });

  it('puts a dragged lamb down where the sim holds it, so it is never left hanging', () => {
    const state = newGame(5);
    const lamb = state.sheep[2];
    pickUp(state, lamb.id);
    drained();
    const before = structuredClone(state);
    sell(state, lamb.id);
    before.sheep[2].activity = 'wander';
    expect(state).toStrictEqual(before);
    expect(drained()).toEqual([]);
  });

  it('never sells the Abomination, at any age: it stays a lamb (FR30, Story 4.1)', () => {
    const state = newGame(5);
    const abom = state.sheep[2];
    abom.isAbomination = true;
    // Old enough to be an elder: its age never makes it sellable.
    abom.bornAt = state.time - TUNING.elderFromMs - 1;
    pickUp(state, abom.id);
    drained();
    const before = structuredClone(state);
    sell(state, abom.id);
    before.sheep[2].activity = 'wander';
    expect(state).toStrictEqual(before);
    expect(state.money).toBe(0);
    expect(drained()).toEqual([]);
  });

  it('silently ignores an unknown id', () => {
    const state = newGame(5);
    const before = structuredClone(state);
    sell(state, 9_999);
    expect(state).toStrictEqual(before);
    expect(drained()).toEqual([]);
  });

  it('selling the last sheep loses the game: Sold, then Lost', () => {
    const state = newGame(5);
    state.time = 3_000;
    const [a, b, lamb] = state.sheep;
    lamb.bornAt = state.time - TUNING.lambUntilMs;
    sell(state, a.id);
    sell(state, b.id);
    drained();
    sell(state, lamb.id);
    expect(state.lostAt).toBe(state.time);
    expect(state.money).toBe(TUNING.sellPriceAdult * 3);
    expect(drained()).toEqual([
      { type: 'Sold', id: lamb.id, price: TUNING.sellPriceAdult },
      { type: 'Lost', survivedMs: state.time, peakFlock: TUNING.startFlockAdults + TUNING.startFlockLambs },
    ]);
  });

  it('a lost game ignores Sell', () => {
    const state = newGame(5);
    state.lostAt = state.time;
    const before = structuredClone(state);
    applyCommand(state, { type: 'Sell', id: state.sheep[0].id });
    expect(state).toStrictEqual(before);
  });

  it('sells any adult: dragged, infected, Starving, ready and on cooldown', () => {
    const state = newGame(5);
    const adults = [0, 1, 2, 3, 4].map((i) =>
      createSheep(state, { x: state.sheep[0].x, y: state.sheep[0].y, bornAt: state.time - TUNING.startAdultAgeMs - i }),
    );
    pickUp(state, adults[0].id);
    infectSheep(state, adults[1]);
    adults[2].fullness = TUNING.starvingBelow / 2;
    adults[3].breedReady = true;
    adults[4].cooldownUntil = state.time + TUNING.breedCooldownMs;
    drained();
    for (const s of adults) sell(state, s.id);
    for (const s of adults) expect(state.sheep.map((o) => o.id)).not.toContain(s.id);
    expect(state.stats.sold).toBe(adults.length);
    expect(state.money).toBe(TUNING.sellPriceAdult * adults.length);
    expect(drained().map((e) => e.type)).toEqual(adults.map(() => 'Sold'));
  });
});
