import { describe, expect, it } from 'vitest';
import { TUNING } from '../../src/config/tuning';
import { fenceBounds, stageOf } from '../../src/sim/selectors';
import { createNewGame, nextId } from '../../src/sim/state';
import { killSheep } from '../../src/sim/systems/carcass';
import { fillFlock, newGame, runFor } from './helpers';

const START_FLOCK = TUNING.startFlockAdults + TUNING.startFlockLambs;

describe('createNewGame', () => {
  it('has exactly the GameState fields', () => {
    expect(Object.keys(newGame()).sort()).toEqual(
      ['breedingPieces', 'breedingProgress', 'carcasses', 'farmProgress', 'foodPieces', 'lastEra', 'nextId', 'rng', 'sheep', 'stats', 'time'].sort(),
    );
  });

  it('starts the GDD flock: the adults aged startAdultAgeMs, then a newborn lamb (FR6)', () => {
    const state = newGame();
    expect(state.time).toBe(0);
    expect(state.sheep).toHaveLength(START_FLOCK);
    state.sheep.forEach((s, i) => {
      expect(s.fullness).toBe(TUNING.startFullness);
      expect(s.bornAt).toBe(i < TUNING.startFlockAdults ? -TUNING.startAdultAgeMs : 0);
      expect(stageOf(s, state)).toBe(i < TUNING.startFlockAdults ? 'adult' : 'lamb');
      expect(s.activity).toBe('wander');
      // FR6: nobody is ready to breed at the start.
      expect(s.breedReady).toBe(false);
    });
    expect(state.farmProgress).toBe(0);
    // FR6: an empty breeding bar and no breeding pieces.
    expect(state.breedingProgress).toBe(0);
    expect(state.breedingPieces).toEqual([]);
    expect(state.foodPieces).toEqual([]);
    expect(state.carcasses).toEqual([]);
    expect(state.lastEra).toBe('pasture');
    expect(state.stats).toEqual({
      died: 0,
      sold: 0,
      sacrificed: 0,
      moneyEarned: 0,
      peakFlock: START_FLOCK,
    });
  });

  it('places every sheep inside the starting fence, inset by fenceInset', () => {
    for (const seed of [1, 2, 3, 1234, 0xffffffff]) {
      const state = createNewGame(seed);
      const f = fenceBounds(state);
      for (const s of state.sheep) {
        expect(Number.isInteger(s.x) && Number.isInteger(s.y)).toBe(true);
        expect(s.x).toBeGreaterThanOrEqual(f.x + TUNING.fenceInset);
        expect(s.x).toBeLessThanOrEqual(f.x + f.width - TUNING.fenceInset);
        expect(s.y).toBeGreaterThanOrEqual(f.y + TUNING.fenceInset);
        expect(s.y).toBeLessThanOrEqual(f.y + f.height - TUNING.fenceInset);
      }
    }
  });

  it('gives unique ids below nextId', () => {
    const state = newGame();
    const ids = state.sheep.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toBeLessThan(state.nextId);
    const before = state.nextId;
    expect(nextId(state)).toBe(before);
    expect(state.nextId).toBe(before + 1);
  });

  it('round-trips through JSON unchanged, fresh and after running', () => {
    const state = newGame();
    expect(JSON.parse(JSON.stringify(state))).toStrictEqual(state);
    runFor(state, 10_000);
    expect(JSON.parse(JSON.stringify(state))).toStrictEqual(state);
  });

  it('starts with no lostAt (omitted, not undefined)', () => {
    expect('lostAt' in newGame()).toBe(false);
  });

  it('is deterministic per seed', () => {
    expect(createNewGame(77)).toStrictEqual(createNewGame(77));
    const a = createNewGame(77).sheep.map((s) => [s.x, s.y]);
    const b = createNewGame(78).sheep.map((s) => [s.x, s.y]);
    expect(a).not.toEqual(b);
  });
});

describe('stats.peakFlock', () => {
  it('createSheep raises it, and deaths never lower it', () => {
    const state = newGame();
    fillFlock(state, 5);
    expect(state.stats.peakFlock).toBe(5);
    killSheep(state, state.sheep[0].id, 'starved');
    expect(state.sheep).toHaveLength(4);
    expect(state.stats.peakFlock).toBe(5);
    fillFlock(state, 5);
    expect(state.stats.peakFlock).toBe(5);
    fillFlock(state, 6);
    expect(state.stats.peakFlock).toBe(6);
  });
});
