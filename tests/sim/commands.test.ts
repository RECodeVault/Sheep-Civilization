import { describe, expect, it } from 'vitest';
import { TUNING } from '../../src/config/tuning';
import { applyCommand } from '../../src/sim/commands';
import { drainEvents, type SimEvent } from '../../src/sim/events';
import { newGame } from './helpers';

function drained(): SimEvent[] {
  const out: SimEvent[] = [];
  drainEvents((e) => out.push(e));
  return out;
}

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

  it('Farm below the cap emits one Farmed with the food gained', () => {
    const state = newGame();
    applyCommand(state, { type: 'Farm' });
    expect(drained()).toEqual([{ type: 'Farmed', resource: 'food', added: TUNING.farmFoodPerClick }]);
  });

  it('Farm at the cap emits Farmed with added 0 and leaves food unchanged', () => {
    const state = newGame();
    state.food = TUNING.foodCap;
    applyCommand(state, { type: 'Farm' });
    expect(state.food).toBe(TUNING.foodCap);
    expect(drained()).toEqual([{ type: 'Farmed', resource: 'food', added: 0 }]);
  });

  it('Farm above the cap emits Farmed with added 0', () => {
    const state = newGame();
    state.food = TUNING.foodCap + 5;
    applyCommand(state, { type: 'Farm' });
    expect(drained()).toEqual([{ type: 'Farmed', resource: 'food', added: 0 }]);
  });

  it('Farm that the cap cuts short reports only the food actually gained', () => {
    const state = newGame();
    state.food = TUNING.foodCap - 0.5;
    applyCommand(state, { type: 'Farm' });
    expect(state.food).toBe(TUNING.foodCap);
    expect(drained()).toEqual([{ type: 'Farmed', resource: 'food', added: 0.5 }]);
  });

  it('throws on an unknown variant', () => {
    expect(() => applyCommand(newGame(), { type: 'Nope' } as never)).toThrow(/Unexpected variant/);
  });
});
