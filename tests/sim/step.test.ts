import { describe, expect, it } from 'vitest';
import { TICK_MS } from '../../src/config/constants';
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

  it('runFor rejects durations that are not whole ticks', () => {
    expect(() => runFor(newGame(), TICK_MS + 1)).toThrow(/multiple of TICK_MS/);
  });
});
