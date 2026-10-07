import { describe, expect, it } from 'vitest';
import { TUNING } from '../../../src/config/tuning';
import { applyCommand } from '../../../src/sim/commands';
import { drainEvents, type SimEvent } from '../../../src/sim/events';
import { stageOf } from '../../../src/sim/selectors';
import type { GameState } from '../../../src/sim/state';
import { step } from '../../../src/sim/step';
import { newGame } from '../helpers';

/** Steps tick by tick for `ms` with every sheep kept full. Returns the events. */
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

/** Farms two breeding bars and runs until both founders have eaten a piece. */
function feedFoundersBreedingFood(state: GameState): void {
  for (let i = 0; i < TUNING.breedingPipsPerFood * 2; i++) applyCommand(state, { type: 'FarmBreeding' });
  drainEvents(() => {});
  runFed(state, 20_000);
}

function roundTrips(state: GameState): void {
  expect(JSON.parse(JSON.stringify(state))).toStrictEqual(state);
}

describe('breeding scenario (FR9, FR10)', () => {
  it('two ready founders make a lamb 10 s later; the same pair waits out its cooldown', () => {
    const state = newGame(2303);
    const [a, b] = state.sheep;
    feedFoundersBreedingFood(state);
    expect(a.breedReady && b.breedReady).toBe(true);

    applyCommand(state, { type: 'Breed', a: a.id, b: b.id });
    roundTrips(state);
    const bredAt = state.time;
    const events = runFed(state, TUNING.gestationMs);
    expect(events.filter((e) => e.type === 'LambBorn')).toHaveLength(1);
    expect(state.sheep).toHaveLength(4);
    expect(stageOf(state.sheep[3], state)).toBe('lamb');
    expect(state.pregnancies).toEqual([]);
    roundTrips(state);

    // Ready again, but still on cooldown: ignored.
    a.breedReady = b.breedReady = true;
    applyCommand(state, { type: 'Breed', a: a.id, b: b.id });
    expect(state.pregnancies).toEqual([]);
    expect(a.breedReady).toBe(true);

    // On cooldown they do not eat breeding food either; once it ends they do, and can breed again.
    a.breedReady = b.breedReady = false;
    runFed(state, bredAt + TUNING.breedCooldownMs - state.time);
    // The first lamb has grown up by now; a ready sheep ignores breeding food, so the pieces go to the founders.
    for (const s of state.sheep) if (s !== a && s !== b) s.breedReady = true;
    feedFoundersBreedingFood(state);
    expect(a.breedReady && b.breedReady).toBe(true);
    applyCommand(state, { type: 'Breed', a: a.id, b: b.id });
    expect(state.pregnancies).toHaveLength(1);
    roundTrips(state);
  });
});
