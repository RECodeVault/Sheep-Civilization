import { describe, expect, it } from 'vitest';
import { TUNING } from '../../src/config/tuning';
import { applyCommand } from '../../src/sim/commands';
import { newGame } from './helpers';

describe('applyCommand', () => {
  it('Farm adds farmFoodPerClick food', () => {
    const state = newGame();
    applyCommand(state, { type: 'Farm' });
    expect(state.food).toBe(TUNING.startFood + TUNING.farmFoodPerClick);
  });

  it('Farm never exceeds foodCap', () => {
    const state = newGame();
    for (let i = 0; i < TUNING.foodCap + 5; i++) applyCommand(state, { type: 'Farm' });
    expect(state.food).toBe(TUNING.foodCap);
  });

  it('Farm never lowers food that is already above foodCap', () => {
    const state = newGame();
    state.food = TUNING.foodCap + 5;
    applyCommand(state, { type: 'Farm' });
    expect(state.food).toBe(TUNING.foodCap + 5);
  });

  it('throws on an unknown variant', () => {
    expect(() => applyCommand(newGame(), { type: 'Nope' } as never)).toThrow(/Unexpected variant/);
  });
});
