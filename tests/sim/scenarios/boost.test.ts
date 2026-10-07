import { describe, expect, it } from 'vitest';
import { TICK_MS } from '../../../src/config/constants';
import { TUNING } from '../../../src/config/tuning';
import { applyCommand } from '../../../src/sim/commands';
import type { GameState } from '../../../src/sim/state';
import { fillFlock, newGame, runFor } from '../helpers';

const BOOSTED = TUNING.farmPipsPerClick * TUNING.boostPipMultiplier;

/** A well-fed flock of 6, so nobody starves or runs out over a minute of play. */
function game(): GameState {
  const state = newGame(2808);
  fillFlock(state, 6);
  for (const s of state.sheep) s.fullness = TUNING.fullnessMax;
  return state;
}

function sacrificeOne(state: GameState): void {
  applyCommand(state, { type: 'Sacrifice', id: state.sheep[0].id });
}

/** The pips one Farm click fills right now, from an empty bar. */
function clickValue(state: GameState): number {
  state.farmProgress = 0;
  applyCommand(state, { type: 'Farm' });
  return state.farmProgress;
}

describe('the sacrifice food boost in play (FR19)', () => {
  it('doubles Farm clicks for 30 s of game time: 2 pips at 29 s, 1 pip at 31 s', () => {
    const state = game();
    sacrificeOne(state);
    runFor(state, TUNING.boostMs - 1_000);
    expect(clickValue(state)).toBe(BOOSTED);
    runFor(state, 2_000);
    expect(clickValue(state)).toBe(TUNING.farmPipsPerClick);
  });

  it('a second sacrifice at 20 s resets the boost, so it lasts 50 s in all, never stacking', () => {
    const state = game();
    const start = state.time;
    sacrificeOne(state);
    runFor(state, 20_000);
    sacrificeOne(state);
    expect(state.boostUntil).toBe(start + 20_000 + TUNING.boostMs);
    runFor(state, TUNING.boostMs - TICK_MS);
    expect(state.time).toBe(start + 20_000 + TUNING.boostMs - TICK_MS);
    expect(clickValue(state)).toBe(BOOSTED);
    runFor(state, TICK_MS);
    expect(clickValue(state)).toBe(TUNING.farmPipsPerClick);
  });

  it('never boosts the breeding bar', () => {
    const state = game();
    sacrificeOne(state);
    runFor(state, 1_000);
    applyCommand(state, { type: 'FarmBreeding' });
    expect(state.breedingProgress).toBe(TUNING.breedingPipsPerClick);
  });

  it('sacrificing the last sheep sets the boost, but the lost game takes no more Farm clicks', () => {
    const state = newGame(2808);
    while (state.sheep.length > 0) sacrificeOne(state);
    expect(state.lostAt).toBe(state.time);
    expect(state.boostUntil).toBe(state.time + TUNING.boostMs);
    applyCommand(state, { type: 'Farm' });
    expect(state.farmProgress).toBe(0);
  });
});
