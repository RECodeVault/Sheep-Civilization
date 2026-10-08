// Story 4.2 (FR32): the flock keeps a wider space from the Abomination, so a careful watcher sees the
// gap around it. Spacing only: the off-step walk is drawn by the view (src/view/field/gait.ts).
import { describe, expect, it } from 'vitest';
import { TICK_MS } from '../../../src/config/constants';
import { TUNING } from '../../../src/config/tuning';
import { stageOf } from '../../../src/sim/selectors';
import { createSheep, type GameState, type Sheep } from '../../../src/sim/state';
import { createFoodPiece } from '../../../src/sim/systems/feeding';
import { fillFlock, innerFence, newGame, runFor } from '../helpers';

/** Distance from `s` to the closest other sheep. */
function nearest(state: GameState, s: Sheep): number {
  let best = Infinity;
  for (const o of state.sheep) if (o !== s) best = Math.min(best, Math.hypot(o.x - s.x, o.y - s.y));
  return best;
}

/** Everyone full, so nobody seeks food and the flock only wanders, rests and spaces out. */
function feedAll(state: GameState): void {
  for (const s of state.sheep) s.fullness = TUNING.fullnessMax;
}

const SETTLE_MS = 3_000;
const SAMPLE_MS = 500;
const SAMPLES = 100;

/**
 * A crowded start pen (most sheep have a close neighbour) with one extra lamb in the middle, flagged
 * the Abomination or not. Everyone kept full while it settles and is sampled; returns the lamb's mean
 * nearest-neighbour distance, and checks it stayed an alive lamb throughout.
 */
function meanNearest(seed: number, abomination: boolean): number {
  const state = newGame(seed);
  fillFlock(state, 20);
  const r = innerFence(state);
  const lamb = createSheep(state, { x: (r.left + r.right) / 2, y: (r.top + r.bottom) / 2, bornAt: state.time });
  lamb.isAbomination = abomination;
  feedAll(state);
  runFor(state, SETTLE_MS);
  let sum = 0;
  for (let k = 0; k < SAMPLES; k++) {
    feedAll(state);
    runFor(state, SAMPLE_MS);
    sum += nearest(state, lamb);
  }
  expect(state.sheep).toContain(lamb);
  expect(stageOf(lamb, state)).toBe('lamb');
  // The flag is the only difference: no other sheep became the Abomination during the run.
  expect(state.sheep.filter((s) => s.isAbomination)).toEqual(abomination ? [lamb] : []);
  return sum / SAMPLES;
}

describe('the flock gives the Abomination room (FR32)', () => {
  it('samples within lamb age, so both runs compare two lambs', () => {
    expect(SETTLE_MS + SAMPLE_MS * SAMPLES).toBeLessThan(TUNING.lambUntilMs);
  });

  // Paired: the same seed and the same lamb, once as the Abomination and once as a normal lamb, so the
  // flag is the only difference. (Comparing two different lambs in one run mostly measures where each
  // stands, and passed with the tell switched off.) The gap is modest while the flock walks (about
  // 1–7 px), and the two runs are not bit-identical even with the tell off: the Abomination's push is
  // summed after the grid loop, so float order differs. Checked by hand (Story 4.2 Debug Log): with
  // abominationSpacePx at 24, 4 of these 5 seeds fail.
  it.each([3, 42, 2026, 31337, 90210])("the Abomination's mean nearest-neighbour distance exceeds a normal lamb's (seed %i)", (seed) => {
    expect(meanNearest(seed, true)).toBeGreaterThan(meanNearest(seed, false));
  });
});

describe('feeding next to the Abomination (AC 7)', () => {
  /**
   * A fed Abomination resting `restMs` on a food piece at `at` (inner-fence coordinates), and a hungry
   * adult offset by (dx, dy) from it.
   */
  function blockedPiece(at: (r: ReturnType<typeof innerFence>) => { x: number; y: number }, restMs: number, dx: number, dy: number) {
    const state = newGame(7);
    state.sheep.length = 0;
    const r = innerFence(state);
    const { x: px, y: py } = at(r);
    const abom = createSheep(state, { x: px, y: py, bornAt: state.time });
    abom.isAbomination = true;
    abom.fullness = TUNING.fullnessMax;
    abom.restUntil = state.time + restMs;
    const seeker = createSheep(state, { x: px + dx, y: py + dy, bornAt: state.time - TUNING.startAdultAgeMs });
    seeker.fullness = TUNING.seekBelowFullness - 30;
    createFoodPiece(state, px, py);
    return { state, abom, seeker, start: seeker.fullness };
  }

  it('a hungry sheep still eats a piece the resting Abomination stands on', () => {
    const { state, seeker, start } = blockedPiece((r) => ({ x: (r.left + r.right) / 2, y: (r.top + r.bottom) / 2 }), TUNING.wanderRestMaxMs, 40, 0);
    // The bound the resting-sheep hold-off already accepts (deferred-work, Story 3.6): the block ends
    // when the blocker's rest does, plus the walk to the piece and a tick to claim and eat.
    const walkMs = ((40 + TUNING.abominationSpacePx) / TUNING.walkSpeedPxPerS) * 1000;
    const budget = Math.ceil((TUNING.wanderRestMaxMs + walkMs) / TICK_MS) * TICK_MS + 3 * TICK_MS;
    const events = runFor(state, budget);
    expect(events.some((e) => e.type === 'FoodEaten' && e.sheepId === seeker.id)).toBe(true);
    expect(state.foodPieces).toEqual([]);
    expect(seeker.fullness).toBeGreaterThan(start);
  });

  // Review (Story 4.2): pinned in a fence corner (a rail alone lets it slide along), the Abomination
  // cannot be pushed off the piece, so the seeker stops at its hold-off: 12 px for 36 px space. With
  // eatReachPx 12 it hovered at 12.009 px and never ate; eatReachPx clears the hold-off, so it eats from
  // there even though the Abomination never stops resting.
  it('a hungry sheep eats a piece the Abomination is pinned on in a fence corner', () => {
    const { state, abom, seeker, start } = blockedPiece((r) => ({ x: r.left, y: r.top }), 1e9, 28, 28);
    const walkMs = (Math.hypot(28, 28) / TUNING.walkSpeedPxPerS) * 1000;
    const events = runFor(state, Math.ceil(walkMs / TICK_MS) * TICK_MS + 10 * TICK_MS);
    expect(events.some((e) => e.type === 'FoodEaten' && e.sheepId === seeker.id)).toBe(true);
    expect(seeker.fullness).toBeGreaterThan(start);
    // It really was pinned: the corner held it on the piece the whole time.
    const r = innerFence(state);
    expect([abom.x, abom.y]).toEqual([r.left, r.top]);
  });
});
