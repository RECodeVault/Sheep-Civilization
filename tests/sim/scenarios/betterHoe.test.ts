import { describe, expect, it } from 'vitest';
import { TUNING } from '../../../src/config/tuning';
import { applyCommand } from '../../../src/sim/commands';
import { drainEvents } from '../../../src/sim/events';
import { shopPrice } from '../../../src/sim/selectors';
import type { GameState } from '../../../src/sim/state';
import { fillFlock, newGame, runFor } from '../helpers';

/** A well-fed flock of 6, so nobody starves over a minute of play (as boost.test.ts). */
function game(): GameState {
  const state = newGame(4707);
  fillFlock(state, 6);
  for (const s of state.sheep) s.fullness = TUNING.fullnessMax;
  drainEvents(() => {});
  return state;
}

/** Farm clicks, through commands only, until one food piece drops; returns how many it took. */
function clicksToFirstPiece(state: GameState): number {
  state.farmProgress = 0;
  const pieces = state.foodPieces.length;
  let clicks = 0;
  while (state.foodPieces.length === pieces) {
    applyCommand(state, { type: 'Farm' });
    clicks++;
    if (clicks > TUNING.farmPipsPerFood) throw new Error('no piece after a full bar of clicks');
  }
  return clicks;
}

describe('Better Hoe in play (FR24, Story 4.7)', () => {
  it('buying Hoe I, then II, cuts the clicks per food piece; the boost cuts them again; it ends with the boost', () => {
    const state = game();
    const base = clicksToFirstPiece(state);
    expect(base).toBe(Math.ceil(TUNING.farmPipsPerFood / TUNING.farmPipsPerClick));

    state.money = shopPrice('hoe1') + shopPrice('hoe2');
    applyCommand(state, { type: 'Buy', item: 'hoe1' });
    const one = clicksToFirstPiece(state);
    expect(one).toBe(Math.ceil(TUNING.farmPipsPerFood / TUNING.hoePipsPerClick[0]));
    expect(one).toBeLessThan(base);

    applyCommand(state, { type: 'Buy', item: 'hoe2' });
    expect(state.money).toBe(0);
    const two = clicksToFirstPiece(state);
    expect(two).toBe(Math.ceil(TUNING.farmPipsPerFood / TUNING.hoePipsPerClick[1]));
    expect(two).toBeLessThan(one);

    // A sacrifice starts the boost: Hoe II's pips double.
    applyCommand(state, { type: 'Sacrifice', id: state.sheep[0].id });
    const boosted = clicksToFirstPiece(state);
    expect(boosted).toBe(Math.ceil(TUNING.farmPipsPerFood / (TUNING.hoePipsPerClick[1] * TUNING.boostPipMultiplier)));
    expect(boosted).toBeLessThan(two);

    // The boost ends; the hoe stays.
    runFor(state, TUNING.boostMs);
    expect(clicksToFirstPiece(state)).toBe(two);
  });

  it('a Buy of Hoe II without Hoe I changes nothing, so clicks stay at the base value', () => {
    const state = game();
    state.money = shopPrice('hoe2');
    applyCommand(state, { type: 'Buy', item: 'hoe2' });
    expect(state.owned).toEqual([]);
    expect(state.money).toBe(shopPrice('hoe2'));
    expect(clicksToFirstPiece(state)).toBe(Math.ceil(TUNING.farmPipsPerFood / TUNING.farmPipsPerClick));
  });
});
