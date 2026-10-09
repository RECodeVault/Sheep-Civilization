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
      ['abomination', 'boostUntil', 'breedingPieces', 'breedingProgress', 'carcasses', 'farmProgress', 'foodPieces', 'lastEra', 'medicine', 'money', 'nextId', 'nextOvercrowdRollAt', 'owned', 'pregnancies', 'rng', 'sheep', 'stats', 'time'].sort(),
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
      expect(s.cooldownUntil).toBe(0);
    });
    expect(state.pregnancies).toEqual([]);
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

  it('rolls the Abomination window after the founders, so their draws are as before Story 4.1 (FR29)', () => {
    // Positions and headings recorded on the pre-4.1 build (82e20e5) for these seeds.
    const before: Record<number, [number, number, number][]> = {
      1: [[784, 370, 3.314047491791736], [890, 535, 1.7662253995887838], [780, 493, 2.675361153267824]],
      1234: [[618, 490, 5.6728116736620535], [887, 377, 0.7399274262044432], [645, 506, 2.506549140541327]],
      4294967295: [[865, 402, 4.496578392470317], [879, 514, 3.38751651924877], [800, 451, 0.853619351140894]],
    };
    for (const [seed, founders] of Object.entries(before)) {
      const state = createNewGame(Number(seed));
      expect(state.sheep.map((s) => [s.x, s.y, s.heading])).toEqual(founders);
      expect(state.sheep.every((s) => s.isAbomination === false)).toBe(true);
      expect(state.abomination.birthsSeen).toBe(0);
      expect(state.abomination.guaranteedAtBirth).toBeGreaterThanOrEqual(TUNING.abominationGuaranteedBirthMin);
      expect(state.abomination.guaranteedAtBirth).toBeLessThanOrEqual(TUNING.abominationGuaranteedBirthMax);
    }
  });

  it('starts with no money (FR21)', () => {
    expect(newGame().money).toBe(0);
  });

  it('starts owning nothing from the shop (FR22, FR23)', () => {
    expect(newGame().owned).toEqual([]);
  });

  it('starts with no boost (boostUntil 0)', () => {
    expect(newGame().boostUntil).toBe(0);
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
