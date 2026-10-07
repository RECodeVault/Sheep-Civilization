import { describe, expect, it } from 'vitest';
import { TICK_MS } from '../../../src/config/constants';
import { TUNING } from '../../../src/config/tuning';
import { applyCommand } from '../../../src/sim/commands';
import { drainEvents, type SimEvent } from '../../../src/sim/events';
import { createSheep, type GameState, type Sheep } from '../../../src/sim/state';
import { updateCarcassEating, createCarcass } from '../../../src/sim/systems/carcass';
import { drop, pickUp } from '../../../src/sim/systems/drag';
import { createBreedingPiece, createFoodPiece, updateFeeding } from '../../../src/sim/systems/feeding';
import { updateMovement } from '../../../src/sim/systems/movement';
import { innerFence, newGame, runFor } from '../helpers';

// Hungry enough to seek food (FR5), well clear of Starving.
const HUNGRY = TUNING.seekBelowFullness - 10;
// Fullness that runs out in 5 ticks.
const NEARLY_EMPTY = (TUNING.fullnessMax * 5 * TICK_MS) / TUNING.starveMs;

function drained(): SimEvent[] {
  const out: SimEvent[] = [];
  drainEvents((e) => out.push(e));
  return out;
}

/** A game with a single adult at the pen centre (the founders removed), events cleared. */
function oneSheep(): { state: GameState; s: Sheep } {
  const state = newGame(99);
  const r = innerFence(state);
  state.sheep = [];
  const s = createSheep(state, {
    x: (r.left + r.right) / 2,
    y: (r.top + r.bottom) / 2,
    bornAt: state.time - TUNING.startAdultAgeMs,
  });
  drained();
  return { state, s };
}

describe('pickUp (PickUp command)', () => {
  it('makes the sheep dragged and drops any claim', () => {
    const { state, s } = oneSheep();
    s.activity = 'seekFood';
    s.targetId = 42;
    applyCommand(state, { type: 'PickUp', id: s.id });
    expect(s.activity).toBe('dragged');
    expect(s.targetId).toBeUndefined();
    expect(drained()).toEqual([]);
  });

  it('ignores an unknown id or a sheep already dragged, and draws no rng', () => {
    const { state, s } = oneSheep();
    const rng = state.rng;
    let before = structuredClone(state);
    pickUp(state, 9_999);
    expect(state).toStrictEqual(before);
    pickUp(state, s.id);
    before = structuredClone(state);
    pickUp(state, s.id);
    expect(state).toStrictEqual(before);
    expect(state.rng).toBe(rng);
  });
});

describe('drop (Drop command)', () => {
  it('places a dragged sheep exactly inside the inner fence and sets it wandering', () => {
    const { state, s } = oneSheep();
    pickUp(state, s.id);
    const r = innerFence(state);
    applyCommand(state, { type: 'Drop', id: s.id, x: r.left + 10, y: r.bottom - 7 });
    expect([s.x, s.y]).toEqual([r.left + 10, r.bottom - 7]);
    expect(s.activity).toBe('wander');
    expect(drained()).toEqual([]);
  });

  it.each([
    ['left', -500, 400],
    ['right', 5_000, 400],
    ['top', 700, -300],
    ['bottom', 700, 5_000],
    ['top-left corner', -1, -1],
    ['bottom-right corner', 9_999, 9_999],
  ])('clamps a drop beyond the %s to the nearest point inside', (_name, x, y) => {
    const { state, s } = oneSheep();
    pickUp(state, s.id);
    drop(state, s.id, x, y);
    const r = innerFence(state);
    expect(s.x).toBe(Math.min(r.right, Math.max(r.left, x)));
    expect(s.y).toBe(Math.min(r.bottom, Math.max(r.top, y)));
  });

  it('keeps the position for non-finite coordinates', () => {
    const { state, s } = oneSheep();
    const [x, y] = [s.x, s.y];
    pickUp(state, s.id);
    drop(state, s.id, Number.NaN, Number.POSITIVE_INFINITY);
    expect([s.x, s.y]).toEqual([x, y]);
    expect(s.activity).toBe('wander');
  });

  it('ignores a sheep that is not dragged, and an unknown id', () => {
    const { state, s } = oneSheep();
    const before = structuredClone(state);
    drop(state, s.id, s.x + 20, s.y);
    drop(state, 9_999, 0, 0);
    expect(state).toStrictEqual(before);
  });
});

describe('a lost game', () => {
  it('ignores PickUp, Drop and Sacrifice', () => {
    const { state, s } = oneSheep();
    state.lostAt = state.time;
    const before = structuredClone(state);
    applyCommand(state, { type: 'PickUp', id: s.id });
    applyCommand(state, { type: 'Drop', id: s.id, x: 600, y: 400 });
    applyCommand(state, { type: 'Sacrifice', id: s.id });
    expect(state).toStrictEqual(before);
    expect(drained()).toEqual([]);
  });
});

describe('a dragged sheep in the systems', () => {
  it('is not steered: position and heading hold over 2 s', () => {
    const { state, s } = oneSheep();
    pickUp(state, s.id);
    const [x, y, h] = [s.x, s.y, s.heading];
    runFor(state, 2_000);
    expect([s.x, s.y, s.heading]).toEqual([x, y, h]);
  });

  it('neither pushes nor is pushed by a neighbour (a grazing sheep draws no rng)', () => {
    const run = (dragged: boolean): number[] => {
      const { state, s } = oneSheep();
      const o = createSheep(state, { x: s.x + 6, y: s.y, bornAt: s.bornAt });
      s.restUntil = o.restUntil = 1e12;
      if (dragged) pickUp(state, s.id);
      for (let i = 0; i < 5; i++) {
        state.time += TICK_MS;
        updateMovement(state);
      }
      return [s.x, s.y, o.x, o.y];
    };
    const { s } = oneSheep();
    const start = [s.x, s.y, s.x + 6, s.y];
    expect(run(true)).toEqual(start);
    // Control: grounded, the same pair separates.
    expect(run(false)).not.toEqual(start);
  });

  it('claims no food piece while dragged, and does again once dropped', () => {
    const { state, s } = oneSheep();
    s.fullness = HUNGRY;
    createFoodPiece(state, s.x + 5, s.y);
    pickUp(state, s.id);
    updateFeeding(state);
    expect(s.activity).toBe('dragged');
    expect(state.foodPieces).toHaveLength(1);
    drop(state, s.id, s.x, s.y);
    updateFeeding(state);
    expect(s.activity).toBe('seekFood');
  });

  it('ignores breeding pieces while dragged, and goes for them once dropped', () => {
    const { state, s } = oneSheep();
    s.fullness = TUNING.fullnessMax;
    const p = createBreedingPiece(state, s.x + 30, s.y);
    pickUp(state, s.id);
    updateFeeding(state);
    expect(s.activity).toBe('dragged');
    expect(s.targetId).toBeUndefined();
    expect(state.breedingPieces).toHaveLength(1);
    drop(state, s.id, s.x, s.y);
    updateFeeding(state);
    expect(s.activity).toBe('seekBreedingFood');
    expect(s.targetId).toBe(p.id);
  });

  it('ignores a carcass while Starving and dragged', () => {
    const { state, s } = oneSheep();
    s.fullness = TUNING.starvingBelow - 5;
    createCarcass(state, s.x + 5, s.y);
    pickUp(state, s.id);
    updateCarcassEating(state);
    expect(s.activity).toBe('dragged');
    expect(state.carcasses).toHaveLength(1);
    expect(s.infectedAt).toBeUndefined();
    // Put down beside it, it eats it at once (FR14).
    drop(state, s.id, s.x, s.y);
    updateCarcassEating(state);
    expect(state.carcasses).toHaveLength(0);
    expect(s.infectedAt).toBe(state.time);
  });

  it('frees its piece when picked up mid-seek, and another sheep claims it', () => {
    const { state, s } = oneSheep();
    s.fullness = HUNGRY;
    const p = createFoodPiece(state, s.x + 30, s.y);
    updateFeeding(state);
    expect(s.targetId).toBe(p.id);
    const o = createSheep(state, { x: s.x - 30, y: s.y, bornAt: s.bornAt });
    o.fullness = HUNGRY;
    pickUp(state, s.id);
    updateFeeding(state);
    expect(o.activity).toBe('seekFood');
    expect(o.targetId).toBe(p.id);
  });

  it('still hungers and can starve mid-drag, leaving its carcass at the pickup spot', () => {
    const { state, s } = oneSheep();
    const [x, y] = [s.x, s.y];
    s.fullness = NEARLY_EMPTY;
    pickUp(state, s.id);
    const events = runFor(state, 10 * TICK_MS);
    expect(events.some((e) => e.type === 'SheepDied' && e.id === s.id && e.cause === 'starved')).toBe(true);
    expect(state.carcasses).toEqual([expect.objectContaining({ x, y })]);
  });
});
