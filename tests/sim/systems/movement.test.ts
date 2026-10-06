import { describe, expect, it } from 'vitest';
import { TICK_MS } from '../../../src/config/constants';
import { TUNING } from '../../../src/config/tuning';
import { createSheep, type GameState, type Sheep } from '../../../src/sim/state';
import { step } from '../../../src/sim/step';
import { fillFlock, innerFence, newGame, runFor } from '../helpers';

const MAX_STEP = (TUNING.walkSpeedPxPerS * TICK_MS) / 1000;
const FAR_FUTURE = 1e9;

/** A game whose flock is replaced by sheep at the given spots. */
function gameWith(spots: readonly { x: number; y: number; heading?: number; restUntil?: number }[]): GameState {
  const state = newGame(99);
  state.sheep.length = 0;
  for (const p of spots) {
    const s = createSheep(state, { x: p.x, y: p.y, bornAt: -TUNING.startAdultAgeMs });
    if (p.heading !== undefined) s.heading = p.heading;
    if (p.restUntil !== undefined) s.restUntil = p.restUntil;
  }
  return state;
}

function centre(state: GameState): { x: number; y: number } {
  const r = innerFence(state);
  return { x: (r.left + r.right) / 2, y: (r.top + r.bottom) / 2 };
}

function dist(a: Sheep, b: Sheep): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

describe('updateMovement', () => {
  it('never moves a sheep further than the walk speed allows in one tick', () => {
    const state = newGame(11);
    fillFlock(state, 30);
    for (let t = 0; t < 600; t++) {
      const before = state.sheep.map((s) => [s.x, s.y]);
      step(state);
      state.sheep.forEach((s, i) => {
        expect(Math.hypot(s.x - before[i][0], s.y - before[i][1])).toBeLessThanOrEqual(MAX_STEP + 1e-9);
      });
    }
  });

  it('moves a lone walking sheep on most ticks', () => {
    const state = gameWith([{ ...centre(newGame()), restUntil: 0 }]);
    const s = state.sheep[0];
    let moved = 0;
    let total = 0;
    for (let t = 0; t < 10_000 / TICK_MS; t++) {
      const [x, y] = [s.x, s.y];
      step(state);
      const d = Math.hypot(s.x - x, s.y - y);
      if (d > 0) moved++;
      total += d;
    }
    expect(moved).toBeGreaterThan(10_000 / TICK_MS / 2);
    expect(total).toBeGreaterThan(0);
  });

  it('keeps a grazing sheep with no neighbours still until its rest ends', () => {
    const c = centre(newGame());
    const state = gameWith([{ ...c, restUntil: 5_000 }]);
    const heading = state.sheep[0].heading;
    runFor(state, 5_000 - TICK_MS);
    expect([state.sheep[0].x, state.sheep[0].y, state.sheep[0].heading]).toEqual([c.x, c.y, heading]);
    runFor(state, TICK_MS * 20);
    expect(state.sheep[0].x !== c.x || state.sheep[0].y !== c.y).toBe(true);
  });

  it('pushes two close sheep apart', () => {
    const c = centre(newGame());
    const state = gameWith([
      { x: c.x, y: c.y, restUntil: FAR_FUTURE },
      { x: c.x + 1, y: c.y, restUntil: FAR_FUTURE },
    ]);
    const [a, b] = state.sheep;
    const target = 0.9 * TUNING.personalSpacePx;
    let d = dist(a, b);
    for (let t = 0; t < 2_000 / TICK_MS && d < target; t++) {
      step(state);
      const next = dist(a, b);
      expect(next).toBeGreaterThan(d);
      d = next;
    }
    expect(d).toBeGreaterThanOrEqual(target);
    // Once apart, grazing sheep do not drift back together.
    runFor(state, 3_000);
    expect(dist(a, b)).toBeGreaterThanOrEqual(target);
  });

  it('separates sheep standing on exactly the same point', () => {
    const c = centre(newGame());
    const state = gameWith([
      { ...c, restUntil: FAR_FUTURE },
      { ...c, restUntil: FAR_FUTURE },
      { ...c, restUntil: 0 },
    ]);
    runFor(state, 2_000);
    for (const s of state.sheep) expect(Number.isFinite(s.x) && Number.isFinite(s.y) && Number.isFinite(s.heading)).toBe(true);
    expect(dist(state.sheep[0], state.sheep[1])).toBeGreaterThan(TUNING.personalSpacePx / 2);
    expect(dist(state.sheep[0], state.sheep[2])).toBeGreaterThan(TUNING.personalSpacePx / 2);
  });

  it('keeps a sheep walking straight at the fence inside it', () => {
    const r = innerFence(newGame());
    const mid = (r.top + r.bottom) / 2;
    const state = gameWith([
      { x: r.left, y: mid, heading: Math.PI, restUntil: 0 },
      { x: r.right, y: mid, heading: 0, restUntil: 0 },
      { x: (r.left + r.right) / 2, y: r.top, heading: -Math.PI / 2, restUntil: 0 },
      { x: (r.left + r.right) / 2, y: r.bottom, heading: Math.PI / 2, restUntil: 0 },
    ]);
    for (let t = 0; t < 100; t++) {
      step(state);
      for (const s of state.sheep) {
        expect(s.x).toBeGreaterThanOrEqual(r.left);
        expect(s.x).toBeLessThanOrEqual(r.right);
        expect(s.y).toBeGreaterThanOrEqual(r.top);
        expect(s.y).toBeLessThanOrEqual(r.bottom);
      }
    }
  });

  it('gives new sheep a heading and no rest', () => {
    for (const s of newGame(5).sheep) {
      expect(s.heading).toBeGreaterThanOrEqual(0);
      expect(s.heading).toBeLessThan(2 * Math.PI);
      expect(s.restUntil).toBe(0);
    }
  });
});
