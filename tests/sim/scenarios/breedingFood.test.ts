import { describe, expect, it } from 'vitest';
import { TUNING } from '../../../src/config/tuning';
import { applyCommand } from '../../../src/sim/commands';
import { drainEvents, type SimEvent } from '../../../src/sim/events';
import type { GameState } from '../../../src/sim/state';
import { step } from '../../../src/sim/step';
import { newGame } from '../helpers';

/** Steps tick by tick for `ms` with every sheep kept full, so food never comes first. Returns the events. */
function runFed(state: GameState, ms: number): SimEvent[] {
  const events: SimEvent[] = [];
  const until = state.time + ms;
  while (state.time < until) {
    if (state.lostAt !== undefined) throw new Error(`lost at ${state.lostAt} ms`);
    for (const s of state.sheep) s.fullness = TUNING.fullnessMax;
    step(state);
    drainEvents((e) => events.push(e));
  }
  return events;
}

describe('breeding food scenario (FR8, FR8a)', () => {
  it('two full breeding bars drop two pieces; both founding adults eat one and become ready, the lamb does not', () => {
    const state = newGame(2202);
    const founders = state.sheep.slice(0, TUNING.startFlockAdults);
    const lamb = state.sheep[TUNING.startFlockAdults];
    for (let i = 0; i < TUNING.breedingPipsPerFood * 2; i++) applyCommand(state, { type: 'FarmBreeding' });
    expect(state.breedingPieces).toHaveLength(2);
    drainEvents(() => {});

    // Long enough to walk across the pen and munch, short of the lamb growing up.
    const events = runFed(state, 20_000);
    expect(state.breedingPieces).toEqual([]);
    for (const f of founders) expect(f.breedReady).toBe(true);
    expect(lamb.breedReady).toBe(false);
    const eaten = events.filter((e) => e.type === 'BreedingFoodEaten');
    expect(eaten.map((e) => e.type === 'BreedingFoodEaten' && e.sheepId).sort()).toEqual(founders.map((f) => f.id).sort());
    // The save shape survives JSON.
    expect(JSON.parse(JSON.stringify(state))).toStrictEqual(state);
  });
});
