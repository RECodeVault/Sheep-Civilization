import { describe, expect, it } from 'vitest';
import { TUNING } from '../../src/config/tuning';
import { applyCommand } from '../../src/sim/commands';
import {
  hungerOf,
  publicSheep,
  selectFoodPieces,
  selectHudView,
  selectPublicSheep,
  stageOf,
  type HudView,
  type PublicSheep,
} from '../../src/sim/selectors';
import { newGame } from './helpers';

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

  it('reads the founding adults as adults at time 0', () => {
    const state = newGame();
    for (const s of state.sheep) expect(stageOf(s, state)).toBe('adult');
  });
});

describe('publicSheep / selectPublicSheep', () => {
  it('exposes stage and hunger', () => {
    const state = newGame();
    const s = state.sheep[0];
    s.fullness = TUNING.starvingBelow - 1;
    expect(publicSheep(s, state)).toEqual({ id: s.id, x: s.x, y: s.y, stage: 'adult', hunger: 'starving' });
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
    expect(out.every((p) => p.stage === 'adult')).toBe(true);
    expect(out).toEqual(state.sheep.map((x) => publicSheep(x, state)));
  });
});

describe('selectHudView', () => {
  it('fills the Farm bar from state and TUNING into the given object', () => {
    const state = newGame();
    const out: HudView = { farmProgress: -1, farmPipsPerFood: -1 };
    expect(selectHudView(state, out)).toBe(out);
    expect(out).toEqual({ farmProgress: 0, farmPipsPerFood: TUNING.farmPipsPerFood });
  });

  it('reflects a Farm on the next read', () => {
    const state = newGame();
    const out: HudView = { farmProgress: 0, farmPipsPerFood: 0 };
    selectHudView(state, out);
    applyCommand(state, { type: 'Farm' });
    selectHudView(state, out);
    expect(out.farmProgress).toBe(TUNING.farmPipsPerClick);
  });
});

describe('selectFoodPieces', () => {
  it('returns the live pieces array without copying', () => {
    const state = newGame();
    expect(selectFoodPieces(state)).toBe(state.foodPieces);
  });
});
