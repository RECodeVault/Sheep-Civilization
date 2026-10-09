import { describe, expect, it } from 'vitest';
import { TICK_MS } from '../../../src/config/constants';
import { TUNING } from '../../../src/config/tuning';
import { applyCommand } from '../../../src/sim/commands';
import { drainEvents, type SimEvent } from '../../../src/sim/events';
import { crowdThreshold, isCrowded } from '../../../src/sim/selectors';
import type { GameState } from '../../../src/sim/state';
import { step } from '../../../src/sim/step';
import { fillFlock, newGame } from '../helpers';

type Timed = SimEvent & { at: number };

// Long enough for several rolls and the virus death after the last one, and well short of old age for
// fillFlock's adults (aged like the founders), so the virus is the only way to die.
const ROLLS = 8;
const RUN_MS = TUNING.overcrowdIntervalMs * ROLLS + TUNING.virusDeathMs + 1_000;

/**
 * A Pasture flock of `count` kept fed every tick (so hunger never interferes), run for `ms`. With
 * `treat`, the first sheep infected is given a dose (set by hand) through the real ApplyMedicine.
 */
function run(seed: number, count: number, ms: number, treat = false): { state: GameState; events: Timed[] } {
  const state = newGame(seed);
  fillFlock(state, count);
  drainEvents(() => {});
  const events: Timed[] = [];
  let treated = false;
  for (let i = 0; i < ms / TICK_MS; i++) {
    for (const s of state.sheep) s.fullness = TUNING.fullnessMax;
    const infected = events.find((e) => e.type === 'Infected');
    if (treat && !treated && infected !== undefined && infected.type === 'Infected') {
      state.medicine = 1;
      applyCommand(state, { type: 'ApplyMedicine', id: infected.id });
      treated = true;
    }
    step(state);
    drainEvents((e) => events.push({ ...e, at: state.time }));
    if (state.lostAt !== undefined) break;
  }
  return { state, events };
}

const SEED = 4606;

describe('overcrowding → virus (FR34, FR15, Story 4.6)', () => {
  it('a crowded flock catches the virus from a roll and the victim dies 20 s later, leaving a carcass; a flock just below 90% never does', () => {
    const full = TUNING.landCapacities[0];
    const start = newGame(SEED);
    fillFlock(start, full);
    expect(isCrowded(start)).toBe(true);
    const crowded = run(SEED, full, RUN_MS);

    const infected = crowded.events.find((e) => e.type === 'Infected');
    expect(infected).toBeDefined();
    if (infected?.type !== 'Infected') return;
    // On a roll's tick: the clock runs from new game in whole intervals.
    expect(infected.at % TUNING.overcrowdIntervalMs).toBe(0);
    expect(crowded.events).toContainEqual(
      expect.objectContaining({ type: 'SheepDied', id: infected.id, cause: 'virus', at: infected.at + TUNING.virusDeathMs }),
    );
    expect(crowded.state.stats.died).toBeGreaterThan(0);
    // Everyone is fed, so nobody eats it.
    expect(crowded.state.carcasses.length).toBeGreaterThan(0);

    // Paired: one sheep fewer is below 90% (9/10 is crowded at 0.9, so 8/10), and nothing happens.
    const below = crowdThreshold(full, TUNING.overcrowdFraction) - 1;
    const calm = run(SEED, below, RUN_MS);
    expect(calm.events.some((e) => e.type === 'Infected')).toBe(false);
    expect(calm.events.some((e) => e.type === 'SheepDied')).toBe(false);
    expect(calm.state.carcasses).toHaveLength(0);
  });

  it('medicine cures an overcrowding infection like any other (Story 4.5)', () => {
    const { state, events } = run(SEED, TUNING.landCapacities[0], RUN_MS, true);
    const infected = events.find((e) => e.type === 'Infected');
    expect(infected).toBeDefined();
    if (infected?.type !== 'Infected') return;
    expect(events).toContainEqual(expect.objectContaining({ type: 'Cured', id: infected.id }));
    expect(events.some((e) => e.type === 'SheepDied' && e.id === infected.id)).toBe(false);
    expect(state.sheep.some((s) => s.id === infected.id)).toBe(true);
  });
});
