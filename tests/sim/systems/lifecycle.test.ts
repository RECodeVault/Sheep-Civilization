import { describe, expect, it } from 'vitest';
import { TICK_MS } from '../../../src/config/constants';
import { TUNING } from '../../../src/config/tuning';
import { drainEvents, type SimEvent } from '../../../src/sim/events';
import { stageOf } from '../../../src/sim/selectors';
import { createSheep, type GameState } from '../../../src/sim/state';
import { step } from '../../../src/sim/step';
import { innerFence, newGame } from '../helpers';

/** A game whose flock is replaced by sheep of the given ages (ms) at time 0, all full. */
function gameWithAges(ages: readonly number[]): GameState {
  const state = newGame(42);
  state.sheep.length = 0;
  // Forget the discarded new-game flock, so peakFlock counts only these sheep.
  state.stats.peakFlock = 0;
  const r = innerFence(state);
  ages.forEach((age, i) => {
    createSheep(state, { x: r.left + 40 * i, y: r.top, bornAt: state.time - age });
  });
  return state;
}

/** Steps `ticks` ticks with every sheep kept full, so hunger never interferes. Returns the events. */
function runFed(state: GameState, ticks: number): SimEvent[] {
  const events: SimEvent[] = [];
  for (let i = 0; i < ticks; i++) {
    for (const s of state.sheep) s.fullness = TUNING.fullnessMax;
    step(state);
    drainEvents((e) => events.push(e));
  }
  return events;
}

describe('updateLifecycle', () => {
  it('kills an elder on exactly the tick its age reaches oldAgeMs', () => {
    // After one step this elder is aged oldAgeMs − TICK_MS; after two, exactly oldAgeMs.
    const state = gameWithAges([TUNING.oldAgeMs - 2 * TICK_MS, TUNING.lambUntilMs]);
    const [elder, other] = state.sheep;
    expect(runFed(state, 1)).toEqual([]);
    expect(state.sheep.map((s) => s.id)).toEqual([elder.id, other.id]);
    expect(stageOf(elder, state)).toBe('elder');

    const events = runFed(state, 1);
    expect(state.time - elder.bornAt).toBe(TUNING.oldAgeMs);
    expect(events).toEqual([{ type: 'SheepDied', id: elder.id, cause: 'oldAge', x: elder.x, y: elder.y }]);
    expect(state.sheep.map((s) => s.id)).toEqual([other.id]);
    expect(state.stats.died).toBe(1);
  });

  it('leaves lambs, adults and younger elders alone', () => {
    const state = gameWithAges([0, TUNING.lambUntilMs, TUNING.elderFromMs, TUNING.oldAgeMs - 10 * TICK_MS]);
    const ids = state.sheep.map((s) => s.id);
    expect(runFed(state, 9)).toEqual([]);
    expect(state.sheep.map((s) => s.id)).toEqual(ids);
  });

  it('kills every elder that reaches oldAgeMs on the same tick, in array order', () => {
    const state = gameWithAges([TUNING.oldAgeMs - TICK_MS, TUNING.lambUntilMs, TUNING.oldAgeMs - TICK_MS]);
    const [a, b, c] = state.sheep;
    const events = runFed(state, 1);
    expect(events.filter((e) => e.type === 'SheepDied').map((e) => e.id)).toEqual([a.id, c.id]);
    expect(state.sheep.map((s) => s.id)).toEqual([b.id]);
    expect(state.stats.died).toBe(2);
  });

  it('the last sheep dying of old age loses the game, Lost after SheepDied', () => {
    const state = gameWithAges([TUNING.oldAgeMs - TICK_MS]);
    const s = state.sheep[0];
    const events = runFed(state, 1);
    expect(events).toEqual([
      { type: 'SheepDied', id: s.id, cause: 'oldAge', x: s.x, y: s.y },
      { type: 'Lost', survivedMs: TICK_MS, peakFlock: 1 },
    ]);
    expect(state.lostAt).toBe(TICK_MS);
  });

  it('a whole flock of elders dying on one tick: every SheepDied, then one Lost', () => {
    const state = gameWithAges([TUNING.oldAgeMs - TICK_MS, TUNING.oldAgeMs - TICK_MS]);
    const [a, b] = state.sheep;
    const events = runFed(state, 1);
    expect(events).toEqual([
      { type: 'SheepDied', id: a.id, cause: 'oldAge', x: a.x, y: a.y },
      { type: 'SheepDied', id: b.id, cause: 'oldAge', x: b.x, y: b.y },
      { type: 'Lost', survivedMs: TICK_MS, peakFlock: 2 },
    ]);
    expect(state.sheep).toEqual([]);
    expect(state.stats.died).toBe(2);
  });
});
