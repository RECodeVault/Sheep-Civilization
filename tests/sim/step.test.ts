import { describe, expect, it } from 'vitest';
import { TICK_MS } from '../../src/config/constants';
import { TUNING } from '../../src/config/tuning';
import { clearEvents } from '../../src/sim/events';
import { step } from '../../src/sim/step';
import { killSheep } from '../../src/sim/systems/carcass';
import { newGame, runFor } from './helpers';

describe('step', () => {
  it('advances time by exactly TICK_MS per step', () => {
    const state = newGame();
    step(state);
    expect(state.time).toBe(TICK_MS);
    runFor(state, 5_000 - TICK_MS);
    expect(state.time).toBe(5_000);
  });

  it('is deterministic for the same seed', () => {
    const a = newGame(5);
    const b = newGame(5);
    runFor(a, 3_000);
    runFor(b, 3_000);
    expect(a).toStrictEqual(b);
  });

  it('emits no events before any sheep starves', () => {
    expect(runFor(newGame(), 2_000)).toEqual([]);
  });

  it('does nothing once the game is lost: no time, no systems, no events', () => {
    const state = newGame();
    runFor(state, 1_000);
    for (const id of state.sheep.map((s) => s.id)) killSheep(state, id, 'starved');
    clearEvents();
    const before = structuredClone(state);
    step(state);
    expect(state).toStrictEqual(before);
    expect(runFor(state, 5_000)).toEqual([]);
    expect(state).toStrictEqual(before);
  });

  it('runs no later system once a system loses the game mid-tick', () => {
    // The last sheep both starves and reaches old age on the same tick: hunger (first) loses the
    // game, so lifecycle must not run on the lost state. One death, then Lost, nothing after.
    const state = newGame();
    for (const id of state.sheep.slice(1).map((s) => s.id)) killSheep(state, id, 'starved');
    clearEvents();
    const s = state.sheep[0];
    s.fullness = 0;
    s.bornAt = state.time + TICK_MS - TUNING.oldAgeMs;
    const events = runFor(state, TICK_MS);
    expect(events.map((e) => e.type)).toEqual(['SheepDied', 'Lost']);
    expect(events[0]).toMatchObject({ cause: 'starved' });
    expect(state.lostAt).toBe(state.time);
  });

  it('runFor rejects durations that are not whole ticks', () => {
    expect(() => runFor(newGame(), TICK_MS + 1)).toThrow(/multiple of TICK_MS/);
  });
});
