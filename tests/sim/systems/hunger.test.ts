import { describe, expect, it } from 'vitest';
import { TICK_MS } from '../../../src/config/constants';
import { TUNING } from '../../../src/config/tuning';
import { createSheep, type GameState } from '../../../src/sim/state';
import { step } from '../../../src/sim/step';
import { innerFence, newGame, runFor } from '../helpers';

const DRAIN_PER_TICK = (TUNING.fullnessMax * TICK_MS) / TUNING.starveMs;

/** A game whose flock is replaced by adults at the given Fullness values. */
function gameWith(fullness: readonly number[]): GameState {
  const state = newGame(42);
  state.sheep.length = 0;
  const r = innerFence(state);
  fullness.forEach((f, i) => {
    const s = createSheep(state, { x: r.left + 40 * i, y: r.top, bornAt: -TUNING.startAdultAgeMs });
    s.fullness = f;
  });
  return state;
}

describe('updateHunger', () => {
  it('starves a full sheep on exactly the starveMs tick', () => {
    const state = gameWith([TUNING.fullnessMax]);
    expect(runFor(state, TUNING.starveMs - TICK_MS)).toEqual([]);
    expect(state.sheep).toHaveLength(1);
    expect(state.sheep[0].fullness).toBeGreaterThan(0);
    const events = runFor(state, TICK_MS);
    expect(state.sheep).toHaveLength(0);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ type: 'SheepDied', cause: 'starved' });
  });

  it('drains by the derived amount every tick and never goes below 0', () => {
    const state = gameWith([TUNING.fullnessMax]);
    let prev = state.sheep[0].fullness;
    for (let t = 0; t < 100; t++) {
      step(state);
      const f = state.sheep[0].fullness;
      expect(f).toBeLessThan(prev);
      expect(prev - f).toBeCloseTo(DRAIN_PER_TICK, 9);
      expect(f).toBeGreaterThanOrEqual(0);
      prev = f;
    }
  });

  it('kills a sheep at the starting Fullness after its share of starveMs', () => {
    const state = gameWith([TUNING.startFullness]);
    const ms = (TUNING.startFullness / TUNING.fullnessMax) * TUNING.starveMs;
    runFor(state, ms - TICK_MS);
    expect(state.sheep).toHaveLength(1);
    runFor(state, TICK_MS);
    expect(state.sheep).toHaveLength(0);
  });

  it('kills every sheep that empties on the same tick, in array order', () => {
    const state = gameWith([DRAIN_PER_TICK, TUNING.fullnessMax, DRAIN_PER_TICK]);
    const [a, b, c] = state.sheep;
    const events = runFor(state, TICK_MS);
    expect(events.map((e) => e.id)).toEqual([a.id, c.id]);
    expect(state.sheep.map((s) => s.id)).toEqual([b.id]);
    expect(state.stats.died).toBe(2);
  });

  it('kills a sheep that is already empty on the next tick', () => {
    const state = gameWith([0]);
    expect(runFor(state, TICK_MS)).toHaveLength(1);
    expect(state.sheep).toHaveLength(0);
  });
});
