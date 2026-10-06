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
});
