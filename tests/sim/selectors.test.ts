import { describe, expect, it } from 'vitest';
import { TUNING } from '../../src/config/tuning';
import { applyCommand } from '../../src/sim/commands';
import {
  breedBlock,
  canBreed,
  capacity,
  hungerOf,
  isLost,
  onCooldown,
  publicSheep,
  selectBreedingPieces,
  selectFoodPieces,
  selectHudView,
  selectLoseView,
  selectPregnancies,
  selectPublicSheep,
  slotsUsed,
  stageOf,
  type HudView,
  type LoseView,
  type PublicPregnancy,
  type PublicSheep,
} from '../../src/sim/selectors';
import { killSheep } from '../../src/sim/systems/carcass';
import { fillFlock, newGame, runFor } from './helpers';

describe('hungerOf', () => {
  it('is fed only above fedAbove', () => {
    expect(hungerOf(TUNING.fullnessMax)).toBe('fed');
    expect(hungerOf(TUNING.fedAbove + 0.0001)).toBe('fed');
    expect(hungerOf(TUNING.fedAbove)).toBe('hungry');
  });

  it('is hungry down to starvingBelow inclusive', () => {
    expect(hungerOf(TUNING.starvingBelow)).toBe('hungry');
    expect(hungerOf(TUNING.starvingBelow - 0.0001)).toBe('starving');
    expect(hungerOf(0)).toBe('starving');
  });
});

describe('stageOf', () => {
  it('derives the stage from age at the thresholds', () => {
    const state = newGame();
    const s = state.sheep[0];
    state.time = 1_000_000;
    const at = (ageMs: number) => {
      s.bornAt = state.time - ageMs;
      return stageOf(s, state);
    };
    expect(at(0)).toBe('lamb');
    expect(at(TUNING.lambUntilMs - 1)).toBe('lamb');
    expect(at(TUNING.lambUntilMs)).toBe('adult');
    expect(at(TUNING.elderFromMs - 1)).toBe('adult');
    expect(at(TUNING.elderFromMs)).toBe('elder');
  });

  it('reads the founding adults as adults and the newborn as a lamb at time 0', () => {
    const state = newGame();
    expect(state.sheep.map((s) => stageOf(s, state))).toEqual(['adult', 'adult', 'lamb']);
  });
});

describe('publicSheep / selectPublicSheep', () => {
  it('exposes stage and hunger', () => {
    const state = newGame();
    const s = state.sheep[0];
    s.fullness = TUNING.starvingBelow - 1;
    expect(publicSheep(s, state)).toEqual({ id: s.id, x: s.x, y: s.y, stage: 'adult', hunger: 'starving', ready: false, onCooldown: false, canBreed: false });
  });

  it('exposes breedReady as ready', () => {
    const state = newGame();
    const s = state.sheep[0];
    s.breedReady = true;
    expect(publicSheep(s, state).ready).toBe(true);
    const out: PublicSheep[] = [];
    selectPublicSheep(state, out);
    expect(out.map((p) => p.ready)).toEqual([true, false, false]);
    s.breedReady = false;
    selectPublicSheep(state, out);
    expect(out[0].ready).toBe(false);
  });

  it('fills stage and hunger into the objects already in out', () => {
    const state = newGame();
    const out: PublicSheep[] = [];
    selectPublicSheep(state, out);
    const first = out[0];
    state.sheep[0].fullness = TUNING.fedAbove;
    selectPublicSheep(state, out);
    expect(out[0]).toBe(first);
    expect(out[0].hunger).toBe('hungry');
    expect(out).toHaveLength(state.sheep.length);
    expect(out.map((p) => p.stage)).toEqual(['adult', 'adult', 'lamb']);
    expect(out).toEqual(state.sheep.map((x) => publicSheep(x, state)));
  });
});

describe('selectHudView', () => {
  it('fills the Farm bar from state and TUNING into the given object', () => {
    const state = newGame();
    const out: HudView = { farmProgress: -1, farmPipsPerFood: -1, breedingProgress: -1, breedingPipsPerFood: -1, breedBlock: 'capacity' };
    expect(selectHudView(state, out)).toBe(out);
    expect(out).toEqual({
      farmProgress: 0,
      farmPipsPerFood: TUNING.farmPipsPerFood,
      breedingProgress: 0,
      breedingPipsPerFood: TUNING.breedingPipsPerFood,
      breedBlock: 'notReady',
    });
  });

  it('reflects a Farm on the next read', () => {
    const state = newGame();
    const out: HudView = { farmProgress: 0, farmPipsPerFood: 0, breedingProgress: 0, breedingPipsPerFood: 0, breedBlock: null };
    selectHudView(state, out);
    applyCommand(state, { type: 'Farm' });
    selectHudView(state, out);
    expect(out.farmProgress).toBe(TUNING.farmPipsPerClick);
  });

  it('reflects a FarmBreeding on the next read', () => {
    const state = newGame();
    const out: HudView = { farmProgress: 0, farmPipsPerFood: 0, breedingProgress: 0, breedingPipsPerFood: 0, breedBlock: null };
    selectHudView(state, out);
    applyCommand(state, { type: 'FarmBreeding' });
    selectHudView(state, out);
    expect(out.breedingProgress).toBe(TUNING.breedingPipsPerClick);
  });
});

describe('breeding selectors (FR10, FR11, AR21)', () => {
  it('capacity is the base capacity, and slotsUsed counts pending lambs', () => {
    const state = newGame();
    expect(capacity(state)).toBe(TUNING.baseCapacity);
    expect(slotsUsed(state)).toBe(state.sheep.length);
    state.pregnancies.push({ id: state.nextId++, parentA: 1, parentB: 2, dueAt: 1, x: 0, y: 0 });
    expect(slotsUsed(state)).toBe(state.sheep.length + 1);
  });

  it('onCooldown holds until the tick time reaches cooldownUntil', () => {
    const state = newGame();
    const s = state.sheep[0];
    expect(onCooldown(s, state)).toBe(false);
    s.cooldownUntil = state.time + 1;
    expect(onCooldown(s, state)).toBe(true);
    s.cooldownUntil = state.time;
    expect(onCooldown(s, state)).toBe(false);
  });

  it('canBreed needs a ready adult off cooldown', () => {
    const state = newGame();
    const [a, , lamb] = state.sheep;
    expect(canBreed(a, state)).toBe(false);
    a.breedReady = true;
    expect(canBreed(a, state)).toBe(true);
    a.cooldownUntil = state.time + 1;
    expect(canBreed(a, state)).toBe(false);
    a.cooldownUntil = 0;
    a.bornAt = state.time - TUNING.elderFromMs;
    expect(canBreed(a, state)).toBe(false);
    lamb.breedReady = true;
    expect(canBreed(lamb, state)).toBe(false);
  });

  it('breedBlock: notReady below 2 eligible adults, null at 2, capacity first when both apply', () => {
    const state = newGame();
    expect(breedBlock(state)).toBe('notReady');
    state.sheep[0].breedReady = true;
    expect(breedBlock(state)).toBe('notReady');
    state.sheep[1].breedReady = true;
    expect(breedBlock(state)).toBe(null);
    fillFlock(state, TUNING.baseCapacity);
    expect(breedBlock(state)).toBe('capacity');
    state.sheep[1].breedReady = false;
    expect(breedBlock(state)).toBe('capacity');
  });

  it('breedBlock counts pending lambs toward capacity', () => {
    const state = newGame();
    state.sheep[0].breedReady = state.sheep[1].breedReady = true;
    fillFlock(state, TUNING.baseCapacity - 1);
    expect(breedBlock(state)).toBe(null);
    state.pregnancies.push({ id: state.nextId++, parentA: 1, parentB: 2, dueAt: 1, x: 0, y: 0 });
    expect(breedBlock(state)).toBe('capacity');
  });

  it('PublicSheep carries onCooldown and canBreed', () => {
    const state = newGame();
    const [a, b] = state.sheep;
    a.breedReady = true;
    b.cooldownUntil = state.time + 1;
    const out: PublicSheep[] = [];
    selectPublicSheep(state, out);
    expect(out.map((p) => [p.canBreed, p.onCooldown])).toEqual([
      [true, false],
      [false, true],
      [false, false],
    ]);
    expect(out[0]).toEqual(publicSheep(a, state));
  });

  it('selectHudView fills breedBlock', () => {
    const state = newGame();
    const out: HudView = { farmProgress: 0, farmPipsPerFood: 0, breedingProgress: 0, breedingPipsPerFood: 0, breedBlock: null };
    expect(selectHudView(state, out).breedBlock).toBe('notReady');
    state.sheep[0].breedReady = state.sheep[1].breedReady = true;
    expect(selectHudView(state, out).breedBlock).toBe(null);
  });
});

describe('selectPregnancies', () => {
  it('places the heart between the living parents, at the one left, or at the stored spot; reuses out', () => {
    const state = newGame();
    const [a, b] = state.sheep;
    state.pregnancies.push({ id: 77, parentA: a.id, parentB: b.id, dueAt: 1, x: 1, y: 2 });
    const out: PublicPregnancy[] = [];
    expect(selectPregnancies(state, out)).toBe(out);
    expect(out).toEqual([{ id: 77, parentA: a.id, parentB: b.id, x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }]);
    const first = out[0];

    killSheep(state, b.id, 'starved');
    selectPregnancies(state, out);
    expect(out[0]).toBe(first);
    expect(out[0]).toMatchObject({ id: 77, x: a.x, y: a.y });

    killSheep(state, a.id, 'starved');
    selectPregnancies(state, out);
    expect(out[0]).toMatchObject({ id: 77, x: 1, y: 2 });

    state.pregnancies.length = 0;
    selectPregnancies(state, out);
    expect(out).toEqual([]);
  });
});

describe('selectBreedingPieces', () => {
  it('returns the live breeding pieces array without copying', () => {
    const state = newGame();
    expect(selectBreedingPieces(state)).toBe(state.breedingPieces);
  });
});

describe('selectFoodPieces', () => {
  it('returns the live pieces array without copying', () => {
    const state = newGame();
    expect(selectFoodPieces(state)).toBe(state.foodPieces);
  });
});

describe('isLost / selectLoseView', () => {
  it('is not lost on a new game, and lost once the flock is gone', () => {
    const state = newGame();
    expect(isLost(state)).toBe(false);
    for (const id of state.sheep.map((s) => s.id)) killSheep(state, id, 'starved');
    expect(isLost(state)).toBe(true);
  });

  it('fills out in place with the loss time and the peak flock', () => {
    const state = newGame();
    runFor(state, 3_000);
    for (const id of state.sheep.map((s) => s.id)) killSheep(state, id, 'starved');
    const out: LoseView = { survivedMs: -1, peakFlock: -1 };
    expect(selectLoseView(state, out)).toBe(out);
    expect(out).toEqual({ survivedMs: 3_000, peakFlock: TUNING.startFlockAdults + TUNING.startFlockLambs });
  });
});
