import { describe, expect, it } from 'vitest';
import { TUNING } from '../../../src/config/tuning';
import { applyCommand } from '../../../src/sim/commands';
import { drainEvents, type SimEvent } from '../../../src/sim/events';
import { publicSheep } from '../../../src/sim/selectors';
import type { GameState, Sheep } from '../../../src/sim/state';
import { makeAbomination } from '../../../src/sim/systems/abomination';
import { killSheep } from '../../../src/sim/systems/carcass';
import { applyMedicine } from '../../../src/sim/systems/medicine';
import { infectSheep } from '../../../src/sim/systems/virus';
import { fillFlock, newGame, runFor } from '../helpers';

function drained(): SimEvent[] {
  const out: SimEvent[] = [];
  drainEvents((e) => out.push(e));
  return out;
}

/** A fed flock of 6 with one dose and sheep[2] infected now; the event queue is empty. */
function setup(): { state: GameState; sick: Sheep } {
  const state = newGame(4505);
  fillFlock(state, 6);
  state.medicine = 1;
  const sick = state.sheep[2];
  infectSheep(state, sick);
  drained();
  return { state, sick };
}

/** Keeps every sheep fed, so nothing but the virus (or a doom) can end one. */
function feedAll(state: GameState): void {
  for (const s of state.sheep) s.fullness = TUNING.fullnessMax;
}

describe('applyMedicine (ApplyMedicine command, FR26)', () => {
  it('cures an infected sheep: infectedAt is gone, one dose is used, Cured at its spot; no rng drawn', () => {
    const { state, sick } = setup();
    const { rng, nextId } = state;
    applyCommand(state, { type: 'ApplyMedicine', id: sick.id });
    expect('infectedAt' in sick).toBe(false);
    expect(state.medicine).toBe(0);
    expect(publicSheep(sick, state).infected).toBe(false);
    expect(drained()).toEqual([{ type: 'Cured', id: sick.id, x: sick.x, y: sick.y }]);
    expect(state.rng).toBe(rng);
    expect(state.nextId).toBe(nextId);
  });

  it('a cured sheep does not die at its old virus deadline', () => {
    const { state, sick } = setup();
    applyCommand(state, { type: 'ApplyMedicine', id: sick.id });
    feedAll(state);
    const events = runFor(state, TUNING.virusDeathMs + 1_000);
    expect(events.some((e) => e.type === 'SheepDied')).toBe(false);
    expect(state.sheep.some((s) => s.id === sick.id)).toBe(true);
    expect(state.carcasses).toHaveLength(0);
  });

  it('a cured sheep can catch it again, with a fresh deadline', () => {
    const { state, sick } = setup();
    applyCommand(state, { type: 'ApplyMedicine', id: sick.id });
    feedAll(state);
    runFor(state, 5_000);
    drained();
    infectSheep(state, sick);
    expect(sick.infectedAt).toBe(state.time);
    expect(drained()).toEqual([{ type: 'Infected', id: sick.id, x: sick.x, y: sick.y }]);
  });

  it('with no dose it does nothing', () => {
    const { state, sick } = setup();
    state.medicine = 0;
    const before = structuredClone(state);
    applyMedicine(state, sick.id);
    expect(state).toStrictEqual(before);
    expect(drained()).toEqual([]);
  });

  it('on a healthy sheep it does nothing and keeps the dose', () => {
    const { state } = setup();
    const healthy = state.sheep[0];
    const before = structuredClone(state);
    applyMedicine(state, healthy.id);
    expect(state).toStrictEqual(before);
    expect(drained()).toEqual([]);
  });

  it('on a sheep that is gone (died between the drop and the tick) it does nothing and keeps the dose', () => {
    const { state, sick } = setup();
    killSheep(state, sick.id, 'virus');
    drained();
    const before = structuredClone(state);
    applyMedicine(state, sick.id);
    expect(state).toStrictEqual(before);
    expect(drained()).toEqual([]);
  });

  it('in a lost game it does nothing', () => {
    const { state, sick } = setup();
    state.lostAt = state.time;
    const before = structuredClone(state);
    applyCommand(state, { type: 'ApplyMedicine', id: sick.id });
    expect(state).toStrictEqual(before);
    expect(drained()).toEqual([]);
  });

  it('two doses on one sheep in one batch use only one', () => {
    const { state, sick } = setup();
    state.medicine = 2;
    applyCommand(state, { type: 'ApplyMedicine', id: sick.id });
    applyCommand(state, { type: 'ApplyMedicine', id: sick.id });
    expect(state.medicine).toBe(1);
    expect(drained().filter((e) => e.type === 'Cured')).toHaveLength(1);
  });
});

describe('medicine and the Abomination (AC 7, AR18)', () => {
  it('cures the infection only: a doomed victim that is cured still dies at its doom, cause abomination', () => {
    const { state, sick } = setup();
    // The Abomination's visit doom, set by hand as the 4.3 tests do.
    const doomedAt = state.time + 5_000;
    sick.doomedAt = doomedAt;
    applyCommand(state, { type: 'ApplyMedicine', id: sick.id });
    expect(sick.doomedAt).toBe(doomedAt);
    feedAll(state);
    const events = runFor(state, 6_000);
    expect(events).toContainEqual(expect.objectContaining({ type: 'SheepDied', id: sick.id, cause: 'abomination' }));
  });

  it('an infected Abomination is cured like any lamb and stays the Abomination', () => {
    const state = newGame(4506);
    fillFlock(state, 6);
    const abom = state.sheep[state.sheep.length - 1];
    makeAbomination(state, abom);
    const { abomination } = state;
    const schedule = structuredClone(abomination);
    infectSheep(state, abom);
    state.medicine = 1;
    drained();
    applyCommand(state, { type: 'ApplyMedicine', id: abom.id });
    expect(abom.isAbomination).toBe(true);
    expect('infectedAt' in abom).toBe(false);
    expect(state.abomination).toStrictEqual(schedule);
    expect(drained()).toEqual([{ type: 'Cured', id: abom.id, x: abom.x, y: abom.y }]);
  });
});
