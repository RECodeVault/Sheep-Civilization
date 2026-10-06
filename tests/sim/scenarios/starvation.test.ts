import { describe, expect, it } from 'vitest';
import { TICK_MS } from '../../../src/config/constants';
import { TUNING } from '../../../src/config/tuning';
import { drainEvents, type SimEvent } from '../../../src/sim/events';
import type { GameState } from '../../../src/sim/state';
import { step } from '../../../src/sim/step';
import { newGame, runFor } from '../helpers';

const START_FLOCK = TUNING.startFlockAdults + TUNING.startFlockLambs;

/** Steps tick by tick for `ms`, returning the events and the game time of every SheepDied. */
function runRecordingDeaths(state: GameState, ms: number): { events: SimEvent[]; deathTimes: number[] } {
  const events: SimEvent[] = [];
  const deathTimes: number[] = [];
  for (let i = 0; i < ms / TICK_MS; i++) {
    step(state);
    drainEvents((e) => {
      events.push(e);
      if (e.type === 'SheepDied') deathTimes.push(state.time);
    });
  }
  return { events, deathTimes };
}

describe('starvation scenario', () => {
  it('an unfed starting flock has all starved within starveMs', () => {
    const state = newGame(2026);
    const ids = state.sheep.map((s) => s.id);
    expect(state.sheep.every((s) => s.fullness === TUNING.startFullness)).toBe(true);

    const events = runFor(state, TUNING.starveMs);

    expect(state.sheep).toEqual([]);
    expect(state.stats.died).toBe(ids.length);
    const deaths = events.filter((e) => e.type === 'SheepDied');
    expect(deaths).toHaveLength(ids.length);
    expect(deaths.every((e) => e.cause === 'starved')).toBe(true);
    expect(deaths.map((e) => e.id).sort()).toEqual([...ids].sort());
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
  });

  it('losing the whole flock stops the game with one Lost, last', () => {
    const state = newGame(2026);
    const { events, deathTimes } = runRecordingDeaths(state, TUNING.starveMs);

    const lost = events.filter((e) => e.type === 'Lost');
    expect(lost).toHaveLength(1);
    expect(events[events.length - 1]).toBe(lost[0]);
    // Every sheep starts at the same Fullness, so all die on one tick, and that tick is lostAt.
    expect(deathTimes).toHaveLength(START_FLOCK);
    expect(new Set(deathTimes).size).toBe(1);
    expect(state.lostAt).toBe(deathTimes[0]);
    expect(lost[0]).toEqual({ type: 'Lost', survivedMs: state.lostAt, peakFlock: START_FLOCK });
    expect(JSON.parse(JSON.stringify(state))).toStrictEqual(state);

    const stoppedAt = state.time;
    expect(runFor(state, TUNING.starveMs)).toEqual([]);
    expect(state.time).toBe(stoppedAt);
  });

  it('Lost follows the last death, not the first, when sheep starve on different ticks', () => {
    const state = newGame(2026);
    // The first sheep starves well before the others.
    state.sheep[0].fullness = TUNING.starvingBelow;
    const firstId = state.sheep[0].id;

    const { events, deathTimes } = runRecordingDeaths(state, TUNING.starveMs);

    const deaths = events.filter((e) => e.type === 'SheepDied');
    expect(deaths[0].id).toBe(firstId);
    const lostIndex = events.findIndex((e) => e.type === 'Lost');
    expect(lostIndex).toBe(events.length - 1);
    expect(events.slice(0, lostIndex).filter((e) => e.type === 'SheepDied')).toHaveLength(START_FLOCK);
    // The early death did not stop the game: Lost waited for the later tick of the final death.
    const first = deathTimes[0];
    const last = deathTimes[deathTimes.length - 1];
    expect(first).toBeLessThan(last);
    expect(state.lostAt).toBe(last);
  });
});
