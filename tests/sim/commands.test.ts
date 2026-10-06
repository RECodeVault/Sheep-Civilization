import { describe, expect, it } from 'vitest';
import { TUNING } from '../../src/config/tuning';
import { applyCommand } from '../../src/sim/commands';
import { drainEvents, type SimEvent } from '../../src/sim/events';
import type { GameState } from '../../src/sim/state';
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

  it('carries leftover pips and completes every whole bar in one click', () => {
    const state = newGame();
    const preset = 2 * TUNING.farmPipsPerFood + 1;
    state.farmProgress = preset;
    applyCommand(state, { type: 'Farm' });
    const total = preset + TUNING.farmPipsPerClick;
    const bars = Math.floor(total / TUNING.farmPipsPerFood);
    expect(state.farmProgress).toBe(total % TUNING.farmPipsPerFood);
    expect(state.foodPieces).toHaveLength(bars);
    expect(drained().at(-1)).toEqual({ type: 'Farmed', resource: 'food', added: bars });
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
