import { describe, expect, it } from 'vitest';
import { TICK_MS } from '../../../src/config/constants';
import { TUNING } from '../../../src/config/tuning';
import { applyCommand } from '../../../src/sim/commands';
import { drainEvents, type SimEvent } from '../../../src/sim/events';
import type { GameState } from '../../../src/sim/state';
import { step } from '../../../src/sim/step';
import { fillFlock, newGame } from '../helpers';

/** Steps `ms` with every sheep but `starving` kept full, round-tripping the state through JSON. */
function runKeepingFed(state: GameState, ms: number, starving = 0): { state: GameState; events: SimEvent[] } {
  const events: SimEvent[] = [];
  let s = state;
  for (let i = 0; i < ms / TICK_MS; i++) {
    for (const sheep of s.sheep) if (sheep.id !== starving) sheep.fullness = TUNING.fullnessMax;
    step(s);
    drainEvents((e) => events.push(e));
    if (i % 100 === 0) {
      const copy = JSON.parse(JSON.stringify(s)) as GameState;
      expect(copy).toEqual(s);
      s = copy;
    }
  }
  return { state: s, events };
}

describe('carcass scenario (FR12, FR13)', () => {
  it('a starved sheep leaves a carcass that stays until it is cleared', () => {
    let state = newGame(2404);
    fillFlock(state, 5);
    const victim = state.sheep[3];
    victim.fullness = TUNING.starvingBelow / 2;

    let run = runKeepingFed(state, TUNING.starveMs, victim.id);
    state = run.state;
    const died = run.events.filter((e) => e.type === 'SheepDied');
    expect(died).toEqual([expect.objectContaining({ id: victim.id, cause: 'starved' })]);
    const spawned = run.events.filter((e) => e.type === 'CarcassSpawned');
    expect(spawned).toHaveLength(1);
    expect(state.carcasses).toHaveLength(1);
    const carcass = state.carcasses[0];
    expect(carcass.id).toBe(spawned[0].type === 'CarcassSpawned' ? spawned[0].id : -1);

    // Carcasses never expire: still there long after (the flock stays fed and young enough).
    run = runKeepingFed(state, TUNING.lambUntilMs * 3);
    state = run.state;
    expect(state.carcasses).toEqual([carcass]);

    applyCommand(state, { type: 'ClearCarcass', id: carcass.id });
    const events: SimEvent[] = [];
    drainEvents((e) => events.push(e));
    expect(state.carcasses).toEqual([]);
    expect(events).toEqual([{ type: 'CarcassCleared', id: carcass.id, x: carcass.x, y: carcass.y }]);
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
  });
});
