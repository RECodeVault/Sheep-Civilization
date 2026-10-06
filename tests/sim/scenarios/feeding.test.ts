import { describe, expect, it } from 'vitest';
import { TICK_MS } from '../../../src/config/constants';
import { TUNING } from '../../../src/config/tuning';
import { applyCommand } from '../../../src/sim/commands';
import { hungerOf } from '../../../src/sim/selectors';
import { createFoodPiece } from '../../../src/sim/systems/feeding';
import { fillFlock, innerFence, newGame, runFor } from '../helpers';

/** Rounds `ms` up to a whole number of ticks, as runFor requires. */
function ticks(ms: number): number {
  return Math.ceil(ms / TICK_MS) * TICK_MS;
}

describe('feeding scenario', () => {
  it('a starving sheep eats a piece that lands beside it within the travel time and is Fed again', () => {
    const state = newGame(2026);
    const s = state.sheep[0];
    s.fullness = TUNING.starvingBelow - 5;
    expect(hungerOf(s.fullness)).toBe('starving');
    // The other founders are full, so the piece is this sheep's alone.
    for (const o of state.sheep) if (o !== s) o.fullness = TUNING.fullnessMax;

    const r = innerFence(state);
    const gap = 30;
    createFoodPiece(state, s.x + gap <= r.right ? s.x + gap : s.x - gap, s.y);

    // Up to a tick to claim, the walk (the sheep may have strayed a tick's worth), then a tick to eat.
    const budget = ticks(((gap + 2 * TUNING.eatReachPx) / TUNING.walkSpeedPxPerS) * 1000 + 3 * TICK_MS);
    const half = runFor(state, ticks(budget / 2));
    expect(JSON.parse(JSON.stringify(state))).toStrictEqual(state);
    const events = [...half, ...runFor(state, budget - ticks(budget / 2))];

    expect(events.some((e) => e.type === 'FoodEaten' && e.sheepId === s.id)).toBe(true);
    expect(hungerOf(s.fullness)).toBe('fed');
    expect(state.foodPieces).toEqual([]);
    expect(JSON.parse(JSON.stringify(state))).toStrictEqual(state);
  });

  it('a full Farm bar drops a piece in the pen that a hungry sheep eats', () => {
    const state = newGame(7);
    for (let i = 0; i < TUNING.farmPipsPerFood; i++) applyCommand(state, { type: 'Farm' });
    expect(state.foodPieces).toHaveLength(1);
    const events = runFor(state, 20_000);
    expect(events.some((e) => e.type === 'FoodEaten')).toBe(true);
    expect(state.foodPieces).toEqual([]);
  });

  it('runs a 100-sheep flock over a 300-piece pile deterministically, one seeker per piece', () => {
    const run = () => {
      const state = newGame(99);
      fillFlock(state, 100);
      for (const s of state.sheep) s.fullness = TUNING.fedAbove;
      const r = innerFence(state);
      for (let i = 0; i < 300; i++) {
        createFoodPiece(state, r.left + ((i * 37) % (r.right - r.left)), r.top + ((i * 53) % (r.bottom - r.top)));
      }
      let pieces = state.foodPieces.length;
      for (let t = 0; t < 50; t++) {
        runFor(state, TICK_MS);
        const claimed = state.sheep.filter((s) => s.activity === 'seekFood').map((s) => s.targetId);
        expect(new Set(claimed).size).toBe(claimed.length);
        expect(state.foodPieces.length).toBeLessThanOrEqual(pieces);
        pieces = state.foodPieces.length;
      }
      return state;
    };
    const a = run();
    expect(a.foodPieces.length).toBeLessThan(300);
    expect(run()).toStrictEqual(a);
  });
});
