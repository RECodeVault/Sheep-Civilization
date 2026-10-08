import { describe, expect, it } from 'vitest';
import { TUNING } from '../../../src/config/tuning';
import { drainEvents, type SimEvent } from '../../../src/sim/events';
import { currentEra, ERAS } from '../../../src/sim/selectors';
import type { GameState } from '../../../src/sim/state';
import { syncEra, updateEras } from '../../../src/sim/systems/eras';
import { fillFlock, newGame } from '../helpers';

/** A fresh game whose flock is exactly `count` sheep (founders trimmed or adults added). */
function gameWithFlock(count: number): GameState {
  const state = newGame(3501);
  state.sheep.length = Math.min(state.sheep.length, count);
  fillFlock(state, count);
  return state;
}

function runEras(state: GameState): SimEvent[] {
  const events: SimEvent[] = [];
  updateEras(state);
  drainEvents((e) => events.push(e));
  return events;
}

describe('currentEra (FR27)', () => {
  it('starts in Pasture', () => {
    expect(currentEra(newGame(3501))).toBe('pasture');
  });

  it('changes era exactly at each threshold, from the TUNING table', () => {
    TUNING.eraThresholds.forEach((t, i) => {
      expect(currentEra(gameWithFlock(t - 1))).toBe(ERAS[i]);
      expect(currentEra(gameWithFlock(t))).toBe(ERAS[i + 1]);
    });
    expect(currentEra(gameWithFlock(0))).toBe('pasture');
    expect(currentEra(gameWithFlock(100))).toBe('wool-empire');
  });

  it('does not count pending lambs (they hold a slot but are not alive)', () => {
    const t = TUNING.eraThresholds[0];
    const state = gameWithFlock(t - 1);
    const [a, b] = state.sheep;
    state.pregnancies.push({ id: 9_999, parentA: a.id, parentB: b.id, dueAt: state.time + 1, x: a.x, y: a.y });
    expect(currentEra(state)).toBe('pasture');
  });
});

describe('updateEras (FR28, pattern N4)', () => {
  it('emits nothing while the era is unchanged', () => {
    const state = gameWithFlock(TUNING.eraThresholds[0] - 1);
    expect(runEras(state)).toEqual([]);
    expect(state.lastEra).toBe('pasture');
  });

  it('emits one EraChanged and updates lastEra on a change, then nothing', () => {
    const state = gameWithFlock(TUNING.eraThresholds[0]);
    expect(runEras(state)).toEqual([{ type: 'EraChanged', from: 'pasture', to: 'village' }]);
    expect(state.lastEra).toBe('village');
    expect(runEras(state)).toEqual([]);
  });

  it('emits a single event for a jump over two thresholds', () => {
    const state = gameWithFlock(TUNING.eraThresholds[1]);
    expect(runEras(state)).toEqual([{ type: 'EraChanged', from: 'pasture', to: 'town' }]);
    expect(state.lastEra).toBe('town');
  });

  it('regresses: a smaller flock moves the era back (FR28)', () => {
    const state = gameWithFlock(TUNING.eraThresholds[0] - 1);
    state.lastEra = 'wool-empire';
    expect(runEras(state)).toEqual([{ type: 'EraChanged', from: 'wool-empire', to: 'pasture' }]);
    expect(state.lastEra).toBe('pasture');
  });

  it('draws no rng', () => {
    const state = gameWithFlock(TUNING.eraThresholds[2]);
    const rng = state.rng;
    runEras(state);
    expect(state.rng).toBe(rng);
  });

  it('syncEra sets the cache to the current era with no event, so the next tick is quiet', () => {
    const state = gameWithFlock(TUNING.eraThresholds[1]);
    state.lastEra = 'pasture';
    syncEra(state);
    drainEvents(() => {
      throw new Error('syncEra emitted an event');
    });
    expect(state.lastEra).toBe('town');
    expect(runEras(state)).toEqual([]);
  });
});
