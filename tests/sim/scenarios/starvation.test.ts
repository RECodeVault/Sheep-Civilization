import { describe, expect, it } from 'vitest';
import { TUNING } from '../../../src/config/tuning';
import { newGame, runFor } from '../helpers';

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
    const events = runFor(state, TUNING.starveMs);

    const lost = events.filter((e) => e.type === 'Lost');
    expect(lost).toHaveLength(1);
    expect(events[events.length - 1]).toBe(lost[0]);
    // Every sheep starts at the same Fullness, so all die on one tick: the stopped time.
    expect(state.lostAt).toBe(state.time);
    expect(lost[0]).toEqual({ type: 'Lost', survivedMs: state.lostAt, peakFlock: TUNING.interimFlockAdults });
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

    const events = runFor(state, TUNING.starveMs);

    const deaths = events.filter((e) => e.type === 'SheepDied');
    expect(deaths[0].id).toBe(firstId);
    const lostIndex = events.findIndex((e) => e.type === 'Lost');
    expect(lostIndex).toBe(events.length - 1);
    expect(events.slice(0, lostIndex).filter((e) => e.type === 'SheepDied')).toHaveLength(TUNING.interimFlockAdults);
    // The early death did not stop the game: it ran on to the later starvation tick.
    const earlyDeathMs = (TUNING.starvingBelow * TUNING.starveMs) / TUNING.fullnessMax;
    expect(state.lostAt).toBeGreaterThan(earlyDeathMs);
    expect(state.lostAt).toBe(state.time);
  });
});
