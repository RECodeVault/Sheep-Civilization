import { describe, expect, it } from 'vitest';
import type { GameState } from '../../../src/sim/state';
import { step } from '../../../src/sim/step';
import { fillFlock, innerFence, newGame, runFor } from '../helpers';

function flockOf100(seed: number): GameState {
  const state = newGame(seed);
  fillFlock(state, 100);
  return state;
}

describe('scenario: 100 sheep wander for 600 ticks', () => {
  it('keeps every sheep inside the fence on every tick, with finite coordinates', () => {
    const state = flockOf100(2026);
    const r = innerFence(state);
    for (let t = 0; t < 600; t++) {
      step(state);
      for (const s of state.sheep) {
        if (!(Number.isFinite(s.x) && Number.isFinite(s.y) && Number.isFinite(s.heading))) {
          throw new Error(`tick ${t}: sheep ${s.id} has a non-finite value`);
        }
        if (!(s.heading >= 0 && s.heading < 2 * Math.PI) || Object.is(s.heading, -0)) {
          throw new Error(`tick ${t}: sheep ${s.id} heading ${s.heading} is outside [0, 2π)`);
        }
        if (s.x < r.left || s.x > r.right || s.y < r.top || s.y > r.bottom) {
          throw new Error(`tick ${t}: sheep ${s.id} left the fence at (${s.x}, ${s.y})`);
        }
      }
    }
    expect(state.sheep).toHaveLength(100);
  });

  it('is deterministic for the same seed and differs for another', () => {
    const a = flockOf100(41);
    const b = flockOf100(41);
    const c = flockOf100(42);
    const start = a.sheep.map((s) => [s.x, s.y]);
    runFor(a, 60_000);
    runFor(b, 60_000);
    runFor(c, 60_000);
    expect(a).toStrictEqual(b);
    // Not vacuous: the flock actually moved, and the same seed moved it the same way.
    expect(a.sheep.filter((s, i) => s.x !== start[i][0] || s.y !== start[i][1]).length).toBeGreaterThan(90);
    expect(a.sheep.map((s) => [s.x, s.y])).not.toEqual(c.sheep.map((s) => [s.x, s.y]));
  });

  it('resumes identically from a JSON copy taken mid-run', () => {
    const original = flockOf100(7);
    runFor(original, 30_000);
    const copy = JSON.parse(JSON.stringify(original)) as GameState;
    expect(copy).toStrictEqual(original);
    runFor(original, 30_000);
    runFor(copy, 30_000);
    expect(copy).toStrictEqual(original);
  });
});
