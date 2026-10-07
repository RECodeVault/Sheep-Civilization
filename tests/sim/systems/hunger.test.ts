import { describe, expect, it } from 'vitest';
import { TICK_MS } from '../../../src/config/constants';
import { TUNING } from '../../../src/config/tuning';
import { hungerOf } from '../../../src/sim/selectors';
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
  it('a starvation leaves a carcass at the sheep’s last position (FR12)', () => {
    const state = gameWith([TUNING.fullnessMax, 0]);
    const starved = state.sheep[1];
    runFor(state, TICK_MS);
    expect(state.sheep).toHaveLength(1);
    expect(state.carcasses).toHaveLength(1);
    expect(state.carcasses[0]).toMatchObject({ x: starved.x, y: starved.y, createdAt: state.time });
  });

  it('starves a full sheep on exactly the starveMs tick', () => {
    const state = gameWith([TUNING.fullnessMax]);
    expect(runFor(state, TUNING.starveMs - TICK_MS)).toEqual([]);
    expect(state.sheep).toHaveLength(1);
    expect(state.sheep[0].fullness).toBeGreaterThan(0);
    const events = runFor(state, TICK_MS);
    expect(state.sheep).toHaveLength(0);
    // The only sheep, so its death is also the loss (Story 1.8).
    expect(events.map((e) => e.type)).toEqual(['SheepDied', 'CarcassSpawned', 'Lost']);
    expect(events[0]).toMatchObject({ type: 'SheepDied', cause: 'starved' });
  });

  it('drains by the derived amount every tick', () => {
    const state = gameWith([TUNING.fullnessMax]);
    let prev = state.sheep[0].fullness;
    for (let t = 0; t < 100; t++) {
      step(state);
      const f = state.sheep[0].fullness;
      expect(f).toBeLessThan(prev);
      expect(prev - f).toBeCloseTo(DRAIN_PER_TICK, 9);
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
    // Each death is followed by its carcass.
    expect(events.map((e) => e.type)).toEqual(['SheepDied', 'CarcassSpawned', 'SheepDied', 'CarcassSpawned']);
    expect(events.filter((e) => e.type === 'SheepDied').map((e) => e.id)).toEqual([a.id, c.id]);
    expect(state.sheep.map((s) => s.id)).toEqual([b.id]);
    expect(state.stats.died).toBe(2);
  });

  it('a sheep that empties is at exactly 0 when it dies, never below', () => {
    const state = gameWith([DRAIN_PER_TICK / 2]);
    const s = state.sheep[0];
    runFor(state, TICK_MS);
    expect(state.sheep).toHaveLength(0);
    expect(s.fullness).toBe(0);
  });

  it('crosses the hunger bands on their exact inclusive ticks despite float drift', () => {
    // From fullnessMax: Hungry from the tick it reaches fedAbove; Starving only after starvingBelow.
    const ticksTo = (f: number) => ((TUNING.fullnessMax - f) / TUNING.fullnessMax) * (TUNING.starveMs / TICK_MS);
    const fedTicks = ticksTo(TUNING.fedAbove);
    const hungryTicks = ticksTo(TUNING.starvingBelow);
    const state = gameWith([TUNING.fullnessMax]);
    const s = state.sheep[0];
    runFor(state, (fedTicks - 1) * TICK_MS);
    expect(hungerOf(s.fullness)).toBe('fed');
    runFor(state, TICK_MS);
    expect(hungerOf(s.fullness)).toBe('hungry');
    runFor(state, (hungryTicks - fedTicks) * TICK_MS);
    expect(hungerOf(s.fullness)).toBe('hungry');
    runFor(state, TICK_MS);
    expect(hungerOf(s.fullness)).toBe('starving');
  });

  // About 120 000 ticks: ~1 s alone, but past Vitest's 5 s default under a loaded parallel run
  // (deferred-work, Story 3.2), so it gets its own timeout.
  it('every half-point start value lands in the band its exact Fullness says, every tick', { timeout: 30_000 }, () => {
    const exactBand = (f: number) => (f > TUNING.fedAbove ? 'fed' : f < TUNING.starvingBelow ? 'starving' : 'hungry');
    for (let start = 0.5; start <= TUNING.fullnessMax; start += 0.5) {
      const state = gameWith([start]);
      const s = state.sheep[0];
      for (let t = 1; state.sheep.length > 0; t++) {
        step(state);
        const exact = Math.round((start - t * DRAIN_PER_TICK) * 1e9) / 1e9;
        if (state.sheep.length > 0) expect(hungerOf(s.fullness), `start ${start}, tick ${t}`).toBe(exactBand(exact));
      }
    }
  });

  it('kills a sheep that is already empty on the next tick', () => {
    const state = gameWith([0]);
    expect(runFor(state, TICK_MS).filter((e) => e.type === 'SheepDied')).toHaveLength(1);
    expect(state.sheep).toHaveLength(0);
  });
});
