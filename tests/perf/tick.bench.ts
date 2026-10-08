// Sim tick cost with big piles (Story 3.6, AC 5; NFR1: a tick at 100 sheep stays under 2 ms). Run with
// `npm run bench`; never part of `npm test` (vitest.config.ts includes only *.test.ts), because timing
// assertions would be flaky. Read the mean and p99 columns; record them, with the machine's load, in the
// story's Debug Log.
//
// Every case is 100 adults at Land III, all hungry enough to seek food, so the claim loop works as hard
// as it can. "first tick" times the worst tick: a fresh pile that every hungry sheep claims at once (a
// pool of identical states, one consumed per iteration, so no clone is timed). "steady" times the ticks
// that follow, over a run of the same start.
import { bench, describe } from 'vitest';
import { TUNING } from '../../src/config/tuning';
import { rngRange } from '../../src/sim/rng';
import type { GameState } from '../../src/sim/state';
import { step } from '../../src/sim/step';
import { createBreedingPiece, createFoodPiece } from '../../src/sim/systems/feeding';
import { fillFlock, innerFence, newGame } from '../sim/helpers';

const FIRST_TICK_SAMPLES = 400;
const STEADY_TICKS = 600;

interface Pile {
  food: number;
  breeding: number;
  /** Story 4.2: one of the 100 is the Abomination, so every other sheep also takes its 36 px push. */
  abomination?: boolean;
  /**
   * Story 4.3: the Abomination (full, so it is free) on a visit from the first tick, with ten other sheep
   * already doomed, so the kill cycle and the doomed deaths both run.
   */
  visit?: boolean;
}

/** 100 adults at Land III with a pile of pieces, every sheep hungry (half fed enough to want breeding food). */
function pileGame(pile: Pile): GameState {
  const state = newGame(3606);
  state.owned.push('land1', 'land2', 'land3');
  fillFlock(state, 100);
  const hungry = TUNING.seekBelowFullness - 30;
  state.sheep.forEach((s, i) => {
    // With breeding pieces down, half the flock is fed (above seekBelowFullness): only a fed adult claims
    // breeding food while food lies in the pen, so both claim passes run.
    s.fullness = pile.breeding > 0 && i % 2 === 1 ? TUNING.fullnessMax : hungry;
    s.breedReady = false;
    s.cooldownUntil = 0;
  });
  if (pile.abomination === true || pile.visit === true) state.sheep[0].isAbomination = true;
  if (pile.visit === true) {
    state.sheep[0].fullness = TUNING.fullnessMax;
    state.abomination.nextKillAt = state.time;
    for (let i = 1; i <= 10; i++) state.sheep[i].doomedAt = state.time + TUNING.abominationDoomMinMs + i * 1_000;
  }
  const r = innerFence(state);
  for (let i = 0; i < pile.food; i++) {
    createFoodPiece(state, rngRange(state, r.left, r.right), rngRange(state, r.top, r.bottom));
  }
  for (let i = 0; i < pile.breeding; i++) {
    createBreedingPiece(state, rngRange(state, r.left, r.right), rngRange(state, r.top, r.bottom));
  }
  return state;
}

function firstTickBench(name: string, pile: Pile): void {
  const template = JSON.stringify(pileGame(pile));
  let pool: GameState[] = [];
  let next = 0;
  bench(
    name,
    () => {
      // A spare state if tinybench runs more iterations than planned; it is rare and only costs one clone.
      step(next < pool.length ? pool[next++] : (JSON.parse(template) as GameState));
    },
    {
      time: 0,
      iterations: FIRST_TICK_SAMPLES,
      warmupTime: 0,
      warmupIterations: 0,
      setup: () => {
        pool = Array.from({ length: FIRST_TICK_SAMPLES }, () => JSON.parse(template) as GameState);
        next = 0;
      },
    },
  );
}

function steadyBench(name: string, pile: Pile): void {
  // Built in setup, before each run: nothing is built at collection time.
  let state: GameState | null = null;
  bench(
    name,
    () => {
      step(state as GameState);
    },
    {
      time: 0,
      iterations: STEADY_TICKS,
      warmupTime: 0,
      warmupIterations: 0,
      setup: () => {
        state = pileGame(pile);
        // The first tick is the case above; the steady run starts after it.
        step(state);
      },
    },
  );
}

describe('sim tick, 100 sheep at Land III', () => {
  firstTickBench('no pieces · first tick', { food: 0, breeding: 0 });
  firstTickBench('300 food · first tick', { food: 300, breeding: 0 });
  firstTickBench('150 food + 150 breeding · first tick', { food: 150, breeding: 150 });
  steadyBench('no pieces · steady 600 ticks', { food: 0, breeding: 0 });
  steadyBench('300 food · steady 600 ticks', { food: 300, breeding: 0 });
  steadyBench('150 food + 150 breeding · steady 600 ticks', { food: 150, breeding: 150 });
  steadyBench('300 food + Abomination · steady 600 ticks', { food: 300, breeding: 0, abomination: true });
  steadyBench('Abomination visiting + 10 doomed · steady 600 ticks', { food: 0, breeding: 0, visit: true });
});
