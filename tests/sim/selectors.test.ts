import { describe, expect, it } from 'vitest';
import { TUNING } from '../../src/config/tuning';
import { applyCommand } from '../../src/sim/commands';
import {
  hungerOf,
  isLost,
  publicSheep,
  selectBreedingPieces,
  selectFoodPieces,
  selectHudView,
  selectLoseView,
  selectPublicSheep,
  stageOf,
  type HudView,
  type LoseView,
  type PublicSheep,
} from '../../src/sim/selectors';
import { killSheep } from '../../src/sim/systems/carcass';
import { newGame, runFor } from './helpers';

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
    expect(publicSheep(s, state)).toEqual({ id: s.id, x: s.x, y: s.y, stage: 'adult', hunger: 'starving', ready: false });
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
    const out: HudView = { farmProgress: -1, farmPipsPerFood: -1, breedingProgress: -1, breedingPipsPerFood: -1 };
    expect(selectHudView(state, out)).toBe(out);
    expect(out).toEqual({
      farmProgress: 0,
      farmPipsPerFood: TUNING.farmPipsPerFood,
      breedingProgress: 0,
      breedingPipsPerFood: TUNING.breedingPipsPerFood,
    });
  });

  it('reflects a Farm on the next read', () => {
    const state = newGame();
    const out: HudView = { farmProgress: 0, farmPipsPerFood: 0, breedingProgress: 0, breedingPipsPerFood: 0 };
    selectHudView(state, out);
    applyCommand(state, { type: 'Farm' });
    selectHudView(state, out);
    expect(out.farmProgress).toBe(TUNING.farmPipsPerClick);
  });

  it('reflects a FarmBreeding on the next read', () => {
    const state = newGame();
    const out: HudView = { farmProgress: 0, farmPipsPerFood: 0, breedingProgress: 0, breedingPipsPerFood: 0 };
    selectHudView(state, out);
    applyCommand(state, { type: 'FarmBreeding' });
    selectHudView(state, out);
    expect(out.breedingProgress).toBe(TUNING.breedingPipsPerClick);
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
