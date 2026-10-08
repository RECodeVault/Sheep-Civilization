import { describe, expect, it } from 'vitest';
import { TUNING } from '../../src/config/tuning';
import { decodeSave, encodeSave } from '../../src/save/saveFile';
import { applyCommand } from '../../src/sim/commands';
import type { SimEvent } from '../../src/sim/events';
import { currentEra, isLost } from '../../src/sim/selectors';
import { syncEra } from '../../src/sim/systems/eras';
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

  it('a saved game holds the era its flock is in, so loading emits no EraChanged (Story 3.5)', () => {
    const state = busyGame();
    expect(state.lastEra).toBe(currentEra(state));
    expect(state.lastEra).toBe('village');
    const loaded = reload(state);
    expect(runFor(loaded, 100).filter((e) => e.type === 'EraChanged')).toEqual([]);
  });

  it('a save with a stale lastEra loads, and its first tick emits one EraChanged to the current era', () => {
    const state = busyGame();
    state.lastEra = 'wool-empire';
    const loaded = reload(state);
    expect(loaded.lastEra).toBe('wool-empire');
    const events = runFor(loaded, 100).filter((e) => e.type === 'EraChanged');
    expect(events).toEqual([{ type: 'EraChanged', from: 'wool-empire', to: currentEra(loaded) }]);
    expect(loaded.lastEra).toBe(currentEra(loaded));
  });

  it('a stale lastEra synced at load (as GameScene.create does) emits no EraChanged', () => {
    const state = busyGame();
    state.lastEra = 'pasture';
    const loaded = reload(state);
    syncEra(loaded);
    expect(runFor(loaded, 100).filter((e) => e.type === 'EraChanged')).toEqual([]);
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
