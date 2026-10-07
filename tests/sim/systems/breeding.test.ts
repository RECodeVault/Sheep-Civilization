import { describe, expect, it } from 'vitest';
import { TUNING } from '../../../src/config/tuning';
import { applyCommand } from '../../../src/sim/commands';
import { drainEvents, type SimEvent } from '../../../src/sim/events';
import { breedBlock, shopPrice, slotsUsed } from '../../../src/sim/selectors';
import type { GameState } from '../../../src/sim/state';
import { fillFlock, innerFence, newGame } from '../helpers';

/** A new game whose two founding adults are ready; the third sheep is the newborn lamb. */
function readyPair(seed = 99): GameState {
  const state = newGame(seed);
  state.sheep[0].breedReady = true;
  state.sheep[1].breedReady = true;
  return state;
}

function breed(state: GameState, a: number, b: number): SimEvent[] {
  applyCommand(state, { type: 'Breed', a, b });
  const events: SimEvent[] = [];
  drainEvents((e) => events.push(e));
  return events;
}

/** A Breed that must do nothing: no event and the state unchanged. */
function expectIgnored(state: GameState, a: number, b: number): void {
  const before = structuredClone(state);
  expect(breed(state, a, b)).toEqual([]);
  expect(state).toStrictEqual(before);
}

describe('Breed (FR9, FR10, FR11)', () => {
  it('uses up both sheep, starts their cooldown, adds a pregnancy and emits Bred', () => {
    const state = readyPair();
    state.time = 5_000;
    const [a, b] = state.sheep;
    const id = state.nextId;
    const events = breed(state, a.id, b.id);
    const x = (a.x + b.x) / 2;
    const y = (a.y + b.y) / 2;
    expect(a.breedReady).toBe(false);
    expect(b.breedReady).toBe(false);
    expect(a.cooldownUntil).toBe(state.time + TUNING.breedCooldownMs);
    expect(b.cooldownUntil).toBe(state.time + TUNING.breedCooldownMs);
    expect(state.pregnancies).toEqual([{ id, parentA: a.id, parentB: b.id, dueAt: state.time + TUNING.gestationMs, x, y }]);
    expect(state.nextId).toBe(id + 1);
    expect(events).toEqual([{ type: 'Bred', pregnancyId: id, parentA: a.id, parentB: b.id, x, y }]);
  });

  it('clamps the pregnancy spot to the inner fence', () => {
    const state = readyPair();
    const r = innerFence(state);
    // Positions a corrupt save could hold, just outside the reach of a sheep centre.
    state.sheep[0].x = r.left - 30;
    state.sheep[1].x = r.left - 10;
    breed(state, state.sheep[0].id, state.sheep[1].id);
    expect(state.pregnancies[0].x).toBe(r.left);
  });

  it('draws no rng', () => {
    const state = readyPair();
    const rng = state.rng;
    breed(state, state.sheep[0].id, state.sheep[1].id);
    expect(state.rng).toBe(rng);
  });

  it('ignores a sheep paired with itself', () => {
    const state = readyPair();
    expectIgnored(state, state.sheep[0].id, state.sheep[0].id);
  });

  it('ignores an unknown id', () => {
    const state = readyPair();
    expectIgnored(state, state.sheep[0].id, 9_999);
    expectIgnored(state, 9_999, state.sheep[0].id);
  });

  it('ignores a lamb, even a ready one', () => {
    const state = readyPair();
    const lamb = state.sheep[2];
    lamb.breedReady = true;
    expectIgnored(state, state.sheep[0].id, lamb.id);
  });

  it('ignores an elder, even a ready one', () => {
    const state = readyPair();
    state.sheep[1].bornAt = state.time - TUNING.elderFromMs;
    expectIgnored(state, state.sheep[0].id, state.sheep[1].id);
  });

  it('ignores an adult that is not ready', () => {
    const state = readyPair();
    state.sheep[1].breedReady = false;
    expectIgnored(state, state.sheep[0].id, state.sheep[1].id);
  });

  it('ignores an adult on cooldown, up to the tick it ends', () => {
    const state = readyPair();
    state.sheep[1].cooldownUntil = state.time + 1;
    expectIgnored(state, state.sheep[0].id, state.sheep[1].id);
    state.sheep[1].cooldownUntil = state.time;
    expect(breed(state, state.sheep[0].id, state.sheep[1].id)).toHaveLength(1);
  });

  it('ignores a pair at capacity, counting pending lambs (AR21)', () => {
    const state = readyPair();
    fillFlock(state, TUNING.landCapacities[0] - 1);
    state.pregnancies.push({ id: state.nextId++, parentA: 1, parentB: 2, dueAt: state.time + 1, x: 600, y: 400 });
    expectIgnored(state, state.sheep[0].id, state.sheep[1].id);
    state.pregnancies.length = 0;
    expect(breed(state, state.sheep[0].id, state.sheep[1].id)).toHaveLength(1);
  });

  it('a land purchase lifts the capacity block, and a pending lamb still holds a slot (FR11, FR22)', () => {
    const state = readyPair();
    fillFlock(state, TUNING.landCapacities[0]);
    expect(breedBlock(state)).toBe('capacity');
    expectIgnored(state, state.sheep[0].id, state.sheep[1].id);
    state.money = shopPrice('land1');
    applyCommand(state, { type: 'Buy', item: 'land1' });
    drainEvents(() => {});
    expect(breedBlock(state)).toBeNull();
    expect(breed(state, state.sheep[0].id, state.sheep[1].id)).toHaveLength(1);
    // Fill to the new capacity counting the pending lamb: blocked again.
    fillFlock(state, TUNING.landCapacities[1] - state.pregnancies.length);
    expect(slotsUsed(state)).toBe(TUNING.landCapacities[1]);
    expect(breedBlock(state)).toBe('capacity');
  });

  it('ignores a pair on a lost game', () => {
    const state = readyPair();
    state.lostAt = state.time;
    expectIgnored(state, state.sheep[0].id, state.sheep[1].id);
  });
});
