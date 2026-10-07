import { describe, expect, it } from 'vitest';
import { TUNING } from '../../src/config/tuning';
import { applyCommand } from '../../src/sim/commands';
import { drainEvents, type SimEvent } from '../../src/sim/events';
import type { GameState } from '../../src/sim/state';
import { createCarcass, killSheep } from '../../src/sim/systems/carcass';
import { innerFence, newGame } from './helpers';

function drained(): SimEvent[] {
  const out: SimEvent[] = [];
  drainEvents((e) => out.push(e));
  return out;
}

function farm(state: GameState, times: number): void {
  for (let i = 0; i < times; i++) applyCommand(state, { type: 'Farm' });
}

describe('applyCommand Farm (8-pip bar)', () => {
  it('fills a pip per click and drops nothing until the bar is full', () => {
    const state = newGame();
    farm(state, TUNING.farmPipsPerFood - 1);
    expect(state.farmProgress).toBe((TUNING.farmPipsPerFood - 1) * TUNING.farmPipsPerClick);
    expect(state.foodPieces).toEqual([]);
    const events = drained();
    expect(events).toHaveLength(TUNING.farmPipsPerFood - 1);
    for (const e of events) expect(e).toEqual({ type: 'Farmed', resource: 'food', added: 0 });
  });

  it('turns a full bar into one piece in the pen, inside the inner fence, and empties the bar', () => {
    const state = newGame();
    farm(state, TUNING.farmPipsPerFood);
    expect(state.farmProgress).toBe(0);
    expect(state.foodPieces).toHaveLength(1);
    const p = state.foodPieces[0];
    const r = innerFence(state);
    expect(p.x).toBeGreaterThanOrEqual(r.left);
    expect(p.x).toBeLessThanOrEqual(r.right);
    expect(p.y).toBeGreaterThanOrEqual(r.top);
    expect(p.y).toBeLessThanOrEqual(r.bottom);
    // FoodDropped first, so the field has the piece before the HUD reacts to Farmed.
    expect(drained().slice(-2)).toEqual([
      { type: 'FoodDropped', id: p.id, x: p.x, y: p.y },
      { type: 'Farmed', resource: 'food', added: 1 },
    ]);
  });

  it('starts a corrupt bar over (NaN, negative, fractional, huge) instead of breaking or hanging', () => {
    for (const bad of [Number.NaN, -1000, 2.5, TUNING.farmPipsPerFood, 1e20]) {
      const state = newGame();
      state.farmProgress = bad;
      applyCommand(state, { type: 'Farm' });
      expect(state.farmProgress).toBe(TUNING.farmPipsPerClick);
      expect(state.foodPieces).toEqual([]);
      farm(state, TUNING.farmPipsPerFood - TUNING.farmPipsPerClick);
      expect(state.foodPieces).toHaveLength(1);
    }
  });

  it('keeps dropping with no cap, so food can pile up in the pen', () => {
    const state = newGame();
    farm(state, TUNING.farmPipsPerFood * 30);
    expect(state.foodPieces).toHaveLength(30);
  });

  it('places the pieces deterministically per seed', () => {
    const spots = [1, 2].map(() => {
      const state = newGame(4242);
      farm(state, TUNING.farmPipsPerFood * 3);
      return state.foodPieces.map((p) => [p.x, p.y]);
    });
    expect(spots[0]).toHaveLength(3);
    expect(spots[0]).toEqual(spots[1]);
  });
});

describe('applyCommand', () => {
  it('throws on an unknown variant', () => {
    expect(() => applyCommand(newGame(), { type: 'Nope' } as never)).toThrow(/Unexpected variant/);
  });
});

describe('applyCommand FarmBreeding (FR8: an 8-pip bar that drops breeding pieces)', () => {
  function farmBreeding(state: GameState, times: number): void {
    for (let i = 0; i < times; i++) applyCommand(state, { type: 'FarmBreeding' });
  }

  it('fills a pip per press and drops nothing until the bar is full', () => {
    const state = newGame();
    drained();
    farmBreeding(state, TUNING.breedingPipsPerFood - 1);
    expect(state.breedingProgress).toBe((TUNING.breedingPipsPerFood - 1) * TUNING.breedingPipsPerClick);
    expect(state.breedingPieces).toEqual([]);
    const events = drained();
    expect(events).toHaveLength(TUNING.breedingPipsPerFood - 1);
    for (const e of events) expect(e).toEqual({ type: 'Farmed', resource: 'breedingFood', added: 0 });
  });

  it('turns a full bar into one breeding piece inside the inner fence, and empties the bar', () => {
    const state = newGame();
    farmBreeding(state, TUNING.breedingPipsPerFood - 1);
    drained();
    farmBreeding(state, 1);
    expect(state.breedingProgress).toBe(0);
    expect(state.breedingPieces).toHaveLength(1);
    const p = state.breedingPieces[0];
    const r = innerFence(state);
    expect(p.x).toBeGreaterThanOrEqual(r.left);
    expect(p.x).toBeLessThanOrEqual(r.right);
    expect(p.y).toBeGreaterThanOrEqual(r.top);
    expect(p.y).toBeLessThanOrEqual(r.bottom);
    // BreedingFoodDropped first, so the field has the piece before the HUD reacts to Farmed.
    expect(drained()).toEqual([
      { type: 'BreedingFoodDropped', id: p.id, x: p.x, y: p.y },
      { type: 'Farmed', resource: 'breedingFood', added: 1 },
    ]);
  });

  it('has no cap: every full bar drops another piece', () => {
    const state = newGame();
    farmBreeding(state, TUNING.breedingPipsPerFood * 5);
    expect(state.breedingPieces).toHaveLength(5);
    expect(state.breedingProgress).toBe(0);
  });

  it('changes nothing but the breeding bar until a bar completes: no food, no rng draw, no id', () => {
    const state = newGame();
    state.farmProgress = TUNING.farmPipsPerFood - 1;
    const before = structuredClone(state);
    farmBreeding(state, 1);
    expect({ ...state, breedingProgress: before.breedingProgress }).toStrictEqual(before);
  });

  it('leaves the Farm bar and food pieces alone on a press that drops a breeding piece', () => {
    const state = newGame();
    state.farmProgress = TUNING.farmPipsPerFood - 1;
    farmBreeding(state, TUNING.breedingPipsPerFood);
    expect(state.breedingPieces).toHaveLength(1);
    expect(state.farmProgress).toBe(TUNING.farmPipsPerFood - 1);
    expect(state.foodPieces).toEqual([]);
  });

  it.each([Number.NaN, -1, 1.5, 1e20])('starts a corrupt bar (%s) over instead of breaking or hanging', (bad) => {
    const state = newGame();
    state.breedingProgress = bad;
    farmBreeding(state, 1);
    expect(state.breedingProgress).toBe(TUNING.breedingPipsPerClick);
    expect(state.breedingPieces).toEqual([]);
  });

  it('places the pieces deterministically per seed', () => {
    const a = newGame(77);
    farmBreeding(a, TUNING.breedingPipsPerFood * 3);
    const b = newGame(77);
    farmBreeding(b, TUNING.breedingPipsPerFood * 3);
    expect(a.breedingPieces).toEqual(b.breedingPieces);
  });
});

describe('applyCommand on a lost game', () => {
  it('ignores Farm: no pip, no piece, no event', () => {
    const state = newGame();
    for (const id of state.sheep.map((s) => s.id)) killSheep(state, id, 'starved');
    drained();
    // One pip short of a full bar, so an unguarded Farm would visibly drop a piece.
    state.farmProgress = TUNING.farmPipsPerFood - 1;
    const before = structuredClone(state);
    applyCommand(state, { type: 'Farm' });
    expect(state).toStrictEqual(before);
    expect(drained()).toEqual([]);
  });

  it('ignores FarmBreeding: no pip, no piece, no event', () => {
    const state = newGame();
    for (const id of state.sheep.map((s) => s.id)) killSheep(state, id, 'starved');
    drained();
    // One pip short of a full bar, so an unguarded FarmBreeding would visibly drop a piece.
    state.breedingProgress = TUNING.breedingPipsPerFood - 1;
    const before = structuredClone(state);
    applyCommand(state, { type: 'FarmBreeding' });
    expect(state).toStrictEqual(before);
    expect(drained()).toEqual([]);
  });

  it('ignores ClearCarcass: the carcass stays, no event', () => {
    const state = newGame();
    for (const id of state.sheep.map((s) => s.id)) killSheep(state, id, 'starved');
    drained();
    const c = state.carcasses[0];
    const before = structuredClone(state);
    applyCommand(state, { type: 'ClearCarcass', id: c.id });
    expect(state).toStrictEqual(before);
    expect(drained()).toEqual([]);
  });
});

describe('applyCommand ClearCarcass (FR13)', () => {
  it('removes the carcass and emits CarcassCleared', () => {
    const state = newGame();
    const c = createCarcass(state, 600, 400);
    applyCommand(state, { type: 'ClearCarcass', id: c.id });
    expect(state.carcasses).toEqual([]);
    expect(drained()).toEqual([{ type: 'CarcassCleared', id: c.id, x: c.x, y: c.y }]);
  });

  it('two ClearCarcass for one id in one batch (a double click) clear it once', () => {
    const state = newGame();
    const c = createCarcass(state, 600, 400);
    const other = createCarcass(state, 650, 420);
    applyCommand(state, { type: 'ClearCarcass', id: c.id });
    applyCommand(state, { type: 'ClearCarcass', id: c.id });
    expect(state.carcasses).toEqual([other]);
    expect(drained()).toEqual([{ type: 'CarcassCleared', id: c.id, x: c.x, y: c.y }]);
  });
});

describe('Farm while boosted (FR19)', () => {
  const boosted = TUNING.farmPipsPerClick * TUNING.boostPipMultiplier;

  function boostedGame(): GameState {
    const state = newGame();
    state.time = 5_000;
    state.boostUntil = state.time + TUNING.boostMs;
    drained();
    return state;
  }

  it('fills farmPipsPerClick × boostPipMultiplier pips per click', () => {
    const state = boostedGame();
    farm(state, 1);
    expect(state.farmProgress).toBe(boosted);
    expect(drained()).toEqual([{ type: 'Farmed', resource: 'food', added: 0 }]);
  });

  it('completes a bar in farmPipsPerFood / boosted clicks, dropping one piece', () => {
    const state = boostedGame();
    farm(state, TUNING.farmPipsPerFood / boosted);
    expect(state.farmProgress).toBe(0);
    expect(state.foodPieces).toHaveLength(1);
    const events = drained();
    expect(events.filter((e) => e.type === 'FoodDropped')).toHaveLength(1);
    expect(events[events.length - 1]).toEqual({ type: 'Farmed', resource: 'food', added: 1 });
  });

  it('carries leftover pips: a bar one short plus a boosted click drops one piece and keeps the rest', () => {
    const state = boostedGame();
    state.farmProgress = TUNING.farmPipsPerFood - 1;
    farm(state, 1);
    expect(state.foodPieces).toHaveLength(1);
    expect(state.farmProgress).toBe(boosted - 1);
  });

  it('fills one click value when never boosted, after the boost and exactly at boostUntil', () => {
    const never = newGame();
    farm(never, 1);
    expect(never.farmProgress).toBe(TUNING.farmPipsPerClick);
    const after = boostedGame();
    after.time = after.boostUntil + 1_000;
    farm(after, 1);
    expect(after.farmProgress).toBe(TUNING.farmPipsPerClick);
    const atEnd = boostedGame();
    atEnd.time = atEnd.boostUntil;
    farm(atEnd, 1);
    expect(atEnd.farmProgress).toBe(TUNING.farmPipsPerClick);
  });

  it('never boosts the breeding bar (FR8)', () => {
    const state = boostedGame();
    applyCommand(state, { type: 'FarmBreeding' });
    expect(state.breedingProgress).toBe(TUNING.breedingPipsPerClick);
  });

  it('still starts a corrupt bar over, then adds the boosted pips', () => {
    const state = boostedGame();
    state.farmProgress = Number.NaN;
    farm(state, 1);
    expect(state.farmProgress).toBe(boosted);
  });
});
