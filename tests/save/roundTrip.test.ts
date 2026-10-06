import { describe, expect, it } from 'vitest';
import { TUNING } from '../../src/config/tuning';
import { decodeSave, encodeSave } from '../../src/save/saveFile';
import { applyCommand } from '../../src/sim/commands';
import type { SimEvent } from '../../src/sim/events';
import { isLost } from '../../src/sim/selectors';
import type { GameState } from '../../src/sim/state';
import { newGame, runFor } from '../sim/helpers';
import { busyGame, isBusy } from './busy';

function reload(state: GameState): GameState {
  const loaded = decodeSave(encodeSave(state));
  if (loaded === null) throw new Error('save did not load');
  return loaded;
}

describe('save round trip', () => {
  it('a busy game round-trips unchanged', () => {
    const state = busyGame();
    // Guard against a vacuous pass: the state must really use seekers, targets, pieces and the bar.
    expect(isBusy(state)).toBe(true);
    expect(reload(state)).toStrictEqual(state);
  });

  it('10 save/load cycles give the same game as an uninterrupted run (NFR7)', () => {
    const chunk = 5_000;
    // A plays straight through; B is saved and reloaded after every chunk. Both get a full Farm bar
    // (one new piece) at the start of each chunk, so feeding keeps running across the reloads.
    const a = busyGame(2);
    let b = busyGame(2);
    expect(isBusy(a)).toBe(true);
    const farmBar = (state: GameState): void => {
      for (let i = 0; i < TUNING.farmPipsPerFood; i++) applyCommand(state, { type: 'Farm' });
    };

    const eventsA: SimEvent[] = [];
    const eventsB: SimEvent[] = [];
    for (let i = 0; i < 10; i++) {
      farmBar(a);
      eventsA.push(...runFor(a, chunk));
      farmBar(b);
      eventsB.push(...runFor(b, chunk));
      b = reload(b);
    }

    expect(b).toStrictEqual(a);
    expect(eventsB).toStrictEqual(eventsA);
    // The run must have done something worth comparing.
    expect(eventsA.filter((e) => e.type === 'FoodEaten').length).toBeGreaterThanOrEqual(5);
  });

  it('a lost game round-trips and is still lost', () => {
    const state = newGame(17);
    runFor(state, TUNING.starveMs);
    expect(isLost(state)).toBe(true);
    const loaded = reload(state);
    expect(loaded).toStrictEqual(state);
    expect(isLost(loaded)).toBe(true);
    expect(loaded.lostAt).toBe(state.lostAt);
  });
});
