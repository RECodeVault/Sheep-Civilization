import { describe, expect, it } from 'vitest';
import { TICK_MS } from '../../../src/config/constants';
import { TUNING } from '../../../src/config/tuning';
import { drainEvents, type SimEvent } from '../../../src/sim/events';
import { createSheep, type GameState, type Sheep } from '../../../src/sim/state';
import { createFoodPiece, updateFeeding } from '../../../src/sim/systems/feeding';
import { innerFence, newGame, runFor } from '../helpers';

/** A game with no founders: sheep at the given spots and Fullness (default: hungry enough to seek). */
function gameWith(spots: readonly { x: number; y: number; fullness?: number }[]): GameState {
  const state = newGame(31);
  state.sheep.length = 0;
  for (const p of spots) {
    const s = createSheep(state, { x: p.x, y: p.y, bornAt: -TUNING.startAdultAgeMs });
    s.fullness = p.fullness ?? TUNING.seekBelowFullness - 30;
    // Grazing, so the sheep stays put in tests that step the sim.
    s.restUntil = 1e9;
  }
  return state;
}

function mid(state: GameState): { x: number; y: number } {
  const r = innerFence(state);
  return { x: (r.left + r.right) / 2, y: (r.top + r.bottom) / 2 };
}

function drained(): SimEvent[] {
  const out: SimEvent[] = [];
  drainEvents((e) => out.push(e));
  return out;
}

function seekers(state: GameState, pieceId: number): Sheep[] {
  return state.sheep.filter((s) => s.activity === 'seekFood' && s.targetId === pieceId);
}

describe('createFoodPiece', () => {
  it('clamps into the inner fence and takes a fresh id', () => {
    const state = gameWith([]);
    const r = innerFence(state);
    const id = state.nextId;
    const p = createFoodPiece(state, r.left - 30, r.bottom + 30);
    expect(p).toEqual({ id, x: r.left, y: r.bottom });
    expect(state.foodPieces).toEqual([p]);
  });
});

describe('updateFeeding claims', () => {
  it('sends the nearest eligible sheep to a piece', () => {
    const c0 = mid(newGame());
    const state = gameWith([
      { x: c0.x - 100, y: c0.y },
      { x: c0.x + 20, y: c0.y },
    ]);
    const p = createFoodPiece(state, c0.x, c0.y);
    updateFeeding(state);
    expect(state.sheep[1]).toMatchObject({ activity: 'seekFood', targetId: p.id });
    expect(state.sheep[0].activity).toBe('wander');
    expect('targetId' in state.sheep[0]).toBe(false);
  });

  it('never assigns a sheep at or above seekBelowFullness', () => {
    const c = mid(newGame());
    const state = gameWith([{ x: c.x + 10, y: c.y, fullness: TUNING.seekBelowFullness }]);
    createFoodPiece(state, c.x, c.y);
    updateFeeding(state);
    expect(state.sheep[0].activity).toBe('wander');
  });

  it('gives two pieces to two sheep, never two seekers on one piece', () => {
    const c = mid(newGame());
    const state = gameWith([
      { x: c.x - 60, y: c.y },
      { x: c.x - 50, y: c.y },
      { x: c.x - 40, y: c.y },
    ]);
    const a = createFoodPiece(state, c.x - 70, c.y);
    const b = createFoodPiece(state, c.x + 80, c.y);
    updateFeeding(state);
    expect(seekers(state, a.id)).toHaveLength(1);
    expect(seekers(state, b.id)).toHaveLength(1);
    expect(state.sheep.filter((s) => s.activity === 'seekFood')).toHaveLength(2);
  });

  it('lets the chosen sheep take its own nearest unclaimed piece', () => {
    const c = mid(newGame());
    // The old piece's nearest sheep stands right on a newer piece: it takes that one.
    const state = gameWith([{ x: c.x, y: c.y }]);
    const older = createFoodPiece(state, c.x - 80, c.y);
    const newer = createFoodPiece(state, c.x + 2, c.y);
    updateFeeding(state);
    expect(state.sheep[0].targetId).toBe(newer.id);
    expect(seekers(state, older.id)).toHaveLength(0);
  });

  it('does not throw when the only eligible sheep has a non-finite position (corrupt save)', () => {
    const c = mid(newGame());
    const state = gameWith([{ x: c.x, y: c.y }]);
    state.sheep[0].x = Number.NaN;
    createFoodPiece(state, c.x, c.y);
    expect(() => updateFeeding(state)).not.toThrow();
    expect(state.sheep[0].activity).toBe('wander');
  });

  it('reverts a stale claim to wander with targetId omitted', () => {
    const c = mid(newGame());
    const state = gameWith([{ x: c.x + 50, y: c.y }]);
    createFoodPiece(state, c.x, c.y);
    updateFeeding(state);
    expect(state.sheep[0].activity).toBe('seekFood');
    state.foodPieces.length = 0;
    updateFeeding(state);
    expect(state.sheep[0].activity).toBe('wander');
    expect('targetId' in state.sheep[0]).toBe(false);
  });
});

describe('updateFeeding eating', () => {
  it('eats on arrival: +foodPieceFullness, piece gone, FoodEaten, then wanders after eatMs', () => {
    const c = mid(newGame());
    const start = TUNING.seekBelowFullness - 30;
    const state = gameWith([{ x: c.x + TUNING.eatReachPx / 2, y: c.y, fullness: start }]);
    const s = state.sheep[0];
    const p = createFoodPiece(state, c.x, c.y);
    drained();
    updateFeeding(state); // claim
    updateFeeding(state); // already within reach: eat
    expect(s.fullness).toBe(start + TUNING.foodPieceFullness);
    expect(state.foodPieces).toEqual([]);
    expect(s.activity).toBe('eating');
    expect('targetId' in s).toBe(false);
    expect(drained()).toEqual([{ type: 'FoodEaten', sheepId: s.id, pieceId: p.id, x: p.x, y: p.y }]);
    state.time = s.restUntil - TICK_MS;
    updateFeeding(state);
    expect(s.activity).toBe('eating');
    state.time = s.restUntil;
    updateFeeding(state);
    expect(s.activity).toBe('wander');
  });

  it('caps Fullness at fullnessMax', () => {
    const c = mid(newGame());
    const state = gameWith([{ x: c.x, y: c.y, fullness: TUNING.seekBelowFullness - 1 }]);
    createFoodPiece(state, c.x, c.y);
    updateFeeding(state);
    updateFeeding(state);
    expect(state.sheep[0].fullness).toBe(TUNING.fullnessMax);
  });
});

describe('feeding over time', () => {
  it('leaves pieces on the field indefinitely when nobody can eat them', () => {
    const state = gameWith([]);
    const c = mid(state);
    createFoodPiece(state, c.x, c.y);
    createFoodPiece(state, c.x + 30, c.y);
    runFor(state, 10 * TUNING.starveMs);
    expect(state.foodPieces).toHaveLength(2);
  });

  it('a seeker that starves on the way frees its piece for another sheep', () => {
    const c = mid(newGame());
    const r = innerFence(newGame());
    const state = gameWith([
      { x: r.left, y: c.y, fullness: 0.05 },
      { x: r.right, y: c.y, fullness: TUNING.fedAbove },
    ]);
    // The other sheep is Fed but still hungry enough to seek.
    expect(TUNING.fedAbove).toBeLessThan(TUNING.seekBelowFullness);
    const [doomed, other] = state.sheep;
    // Nearer the doomed sheep, so it claims the piece first.
    const p = createFoodPiece(state, r.left + 100, c.y);
    runFor(state, TICK_MS);
    expect(state.sheep).not.toContain(doomed);
    runFor(state, TICK_MS);
    expect(other).toMatchObject({ activity: 'seekFood', targetId: p.id });
  });

  it('reaches and eats a piece that another sheep is standing on', () => {
    const c = mid(newGame());
    const state = gameWith([
      { x: c.x, y: c.y, fullness: TUNING.seekBelowFullness + 5 }, // full, grazing on the spot
      { x: c.x + 60, y: c.y },
    ]);
    const eater = state.sheep[1];
    const before = eater.fullness;
    createFoodPiece(state, c.x, c.y);
    // Keep the grazer above the threshold for the whole run, so only the hungry sheep may eat.
    state.sheep[0].fullness = TUNING.fullnessMax;
    const events = runFor(state, 5_000);
    expect(events.some((e) => e.type === 'FoodEaten' && e.sheepId === eater.id)).toBe(true);
    expect(eater.fullness).toBeGreaterThan(before);
  });
});
