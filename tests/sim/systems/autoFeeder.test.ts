import { describe, expect, it } from 'vitest';
import { TICK_MS } from '../../../src/config/constants';
import { TUNING } from '../../../src/config/tuning';
import { clearEvents, drainEvents, type SimEvent } from '../../../src/sim/events';
import { rngRange } from '../../../src/sim/rng';
import { innerFence } from '../../../src/sim/selectors';
import type { GameState } from '../../../src/sim/state';
import { step, stepWith, SYSTEMS } from '../../../src/sim/step';
import { updateAutoFeeder } from '../../../src/sim/systems/autoFeeder';
import { fillFlock, newGame, runFor } from '../helpers';

const INTERVAL = TUNING.autoFeederIntervalMs;
const SYSTEMS_WITHOUT_FEEDER = SYSTEMS.filter((sys) => sys !== updateAutoFeeder);

/** A new game with `n` sheep, all full (none seeks food, so pieces stay countable), and an empty queue. */
function fedGame(seed: number, n = 4, feeder = true): GameState {
  const state = newGame(seed);
  fillFlock(state, n);
  for (const s of state.sheep) s.fullness = TUNING.fullnessMax;
  if (feeder) state.owned.push('autoFeeder');
  clearEvents();
  return state;
}

function drain(): SimEvent[] {
  const out: SimEvent[] = [];
  drainEvents((e) => out.push(e));
  return out;
}

/** Runs the system alone at `time` (a boundary tick when `time` is a multiple of the interval). */
function fireAt(state: GameState, time: number): SimEvent[] {
  state.time = time;
  updateAutoFeeder(state);
  return drain();
}

/** Where the drop beside the sheep at `index` lands on `state`'s rng (one draw: the angle). */
function predictSpot(state: GameState, index: number): { x: number; y: number } {
  const probe = { rng: state.rng };
  const a = rngRange(probe, 0, 2 * Math.PI);
  const s = state.sheep[index];
  const r = innerFence(state);
  return {
    x: Math.min(r.right, Math.max(r.left, s.x + Math.cos(a) * TUNING.autoFeederDropPx)),
    y: Math.min(r.bottom, Math.max(r.top, s.y + Math.sin(a) * TUNING.autoFeederDropPx)),
  };
}

describe('updateAutoFeeder (FR25, Story 4.8)', () => {
  it('does nothing without the Auto-feeder: the same game as stepping without the system', () => {
    const state = fedGame(7, 4, false);
    const twin = structuredClone(state);
    const withoutFeeder = SYSTEMS_WITHOUT_FEEDER;
    const events = runFor(state, INTERVAL * 3);
    const twinEvents: SimEvent[] = [];
    for (let i = 0; i < (INTERVAL * 3) / TICK_MS; i++) {
      stepWith(twin, withoutFeeder);
      drainEvents((e) => twinEvents.push(e));
    }
    expect(state).toStrictEqual(twin);
    expect(events).toStrictEqual(twinEvents);
    expect(events.some((e) => e.type === 'FoodDropped')).toBe(false);
  });

  it('drops exactly one piece per interval, on the ticks where time reaches a multiple of it', () => {
    const state = fedGame(7);
    const drops: number[] = [];
    for (let i = 0; i < (INTERVAL * 3) / TICK_MS; i++) {
      // Kept full, so no sheep seeks food and the pieces stay on the ground to count.
      for (const s of state.sheep) s.fullness = TUNING.fullnessMax;
      step(state);
      for (const e of drain()) if (e.type === 'FoodDropped') drops.push(state.time);
    }
    expect(drops).toEqual([INTERVAL, INTERVAL * 2, INTERVAL * 3]);
    expect(state.foodPieces).toHaveLength(3);
  });

  it('fires once when a saved time off the tick grid crosses a boundary', () => {
    const state = fedGame(7);
    const off = TICK_MS / 2;
    state.time = INTERVAL - off;
    const drops: number[] = [];
    for (let i = 0; i < 3; i++) {
      step(state);
      for (const e of drain()) if (e.type === 'FoodDropped') drops.push(state.time);
    }
    expect(drops).toEqual([INTERVAL - off + TICK_MS]);
  });

  it('drops the piece autoFeederDropPx from the hungriest sheep, at the seeded angle, and emits FoodDropped', () => {
    const state = fedGame(11, 5);
    state.sheep[3].fullness = 20;
    state.sheep[1].fullness = 40;
    const spot = predictSpot(state, 3);
    const events = fireAt(state, INTERVAL);
    expect(state.foodPieces).toHaveLength(1);
    const p = state.foodPieces[0];
    expect(p).toMatchObject(spot);
    const s = state.sheep[3];
    expect(Math.hypot(p.x - s.x, p.y - s.y)).toBeCloseTo(TUNING.autoFeederDropPx, 9);
    expect(events).toEqual([{ type: 'FoodDropped', id: p.id, x: p.x, y: p.y }]);
  });

  it('breaks a tie for the hungriest to the lower index', () => {
    const state = fedGame(11, 5);
    state.sheep[4].fullness = 30;
    state.sheep[2].fullness = 30;
    const spot = predictSpot(state, 2);
    fireAt(state, INTERVAL);
    expect(state.foodPieces[0]).toMatchObject(spot);
  });

  it('skips a dragged sheep for the next hungriest', () => {
    const state = fedGame(11, 5);
    state.sheep[0].fullness = 10;
    state.sheep[0].activity = 'dragged';
    state.sheep[3].fullness = 30;
    const spot = predictSpot(state, 3);
    fireAt(state, INTERVAL);
    expect(state.foodPieces[0]).toMatchObject(spot);
  });

  it('with every sheep dragged, drops nothing and draws no rng', () => {
    const state = fedGame(11, 3);
    for (const s of state.sheep) s.activity = 'dragged';
    const rng = state.rng;
    expect(fireAt(state, INTERVAL)).toEqual([]);
    expect(state.foodPieces).toEqual([]);
    expect(state.rng).toBe(rng);
  });

  it('clamps a drop beside a sheep in the pen corner inside the inner fence', () => {
    const state = fedGame(11, 3);
    const r = innerFence(state);
    let clamped = 0;
    for (let seed = 0; seed < 8; seed++) {
      state.foodPieces = [];
      state.sheep[0].x = r.left;
      state.sheep[0].y = r.top;
      state.sheep[0].fullness = 0;
      state.rng = seed * 0x9e3779b9 >>> 0;
      fireAt(state, INTERVAL * (seed + 1));
      const p = state.foodPieces[0];
      expect(p.x).toBeGreaterThanOrEqual(r.left);
      expect(p.x).toBeLessThanOrEqual(r.right);
      expect(p.y).toBeGreaterThanOrEqual(r.top);
      expect(p.y).toBeLessThanOrEqual(r.bottom);
      // Pulled in from a point outside the pen: closer to the sheep than autoFeederDropPx.
      if (Math.hypot(p.x - r.left, p.y - r.top) < TUNING.autoFeederDropPx - 1e-9) clamped++;
    }
    // Not vacuous: at least one of the angles pointed out of the corner.
    expect(clamped).toBeGreaterThan(0);
  });

  it('makes food only: no breeding piece, the bars untouched, no Farmed event', () => {
    const state = fedGame(11);
    state.farmProgress = 2;
    state.breedingProgress = 3;
    const events = fireAt(state, INTERVAL);
    expect(state.breedingPieces).toEqual([]);
    expect(state.farmProgress).toBe(2);
    expect(state.breedingProgress).toBe(3);
    expect(events.map((e) => e.type)).toEqual(['FoodDropped']);
  });

  it('drops nothing in a lost game, even with sheep that could be fed', () => {
    const state = fedGame(11);
    state.sheep[0].fullness = 10;
    state.time = INTERVAL - TICK_MS;
    // Lost by flag only: the flock is still there, so only stepWith's lost-game stop can prevent the drop.
    state.lostAt = state.time;
    const twin = structuredClone(state);
    delete twin.lostAt;
    expect(runFor(twin, TICK_MS).some((e) => e.type === 'FoodDropped')).toBe(true);
    expect(runFor(state, INTERVAL)).toEqual([]);
    expect(state.foodPieces).toEqual([]);
  });

  it('runs after the tick deaths: a sheep that dies of the virus on the boundary tick is never the target', () => {
    const state = fedGame(13, 4);
    // Sheep 0 is the hungriest and dies of the virus on the tick that reaches the boundary.
    state.sheep[0].fullness = 60;
    state.sheep[2].fullness = 80;
    state.time = INTERVAL - TICK_MS;
    state.sheep[0].infectedAt = INTERVAL - TUNING.virusDeathMs;
    const survivor = state.sheep[2];
    const dying = { x: state.sheep[0].x, y: state.sheep[0].y };
    // The two sheep stand far enough apart that a drop beside one is never beside the other.
    expect(Math.hypot(dying.x - survivor.x, dying.y - survivor.y)).toBeGreaterThan(TUNING.autoFeederDropPx * 3);
    step(state);
    const events = drain();
    expect(events.some((e) => e.type === 'SheepDied')).toBe(true);
    const drop = events.find((e) => e.type === 'FoodDropped');
    expect(drop).toBeDefined();
    if (drop?.type !== 'FoodDropped') return;
    expect(Math.hypot(drop.x - survivor.x, drop.y - survivor.y)).toBeLessThanOrEqual(TUNING.autoFeederDropPx + 1e-9);
    expect(Math.hypot(drop.x - dying.x, drop.y - dying.y)).toBeGreaterThan(TUNING.autoFeederDropPx);
  });

  it('leaves feeding to decide who eats: a hungry sheep walks over and eats the piece beside it', () => {
    const state = fedGame(17, 4);
    state.sheep[1].fullness = 30;
    runFor(state, INTERVAL);
    expect(state.foodPieces).toHaveLength(1);
    const events = runFor(state, 2_000);
    expect(events.filter((e) => e.type === 'FoodEaten').map((e) => e.type === 'FoodEaten' && e.sheepId)).toEqual([
      state.sheep[1].id,
    ]);
    expect(state.foodPieces).toEqual([]);
  });
});
