// View → sim player intents. Commands are applied at the start of the next tick, before step().
import { TUNING } from '../config/tuning';
import { assertNever } from '../core/types';
import { emit } from './events';
import { rngRange } from './rng';
import { innerFence } from './selectors';
import type { GameState } from './state';
import { breed } from './systems/breeding';
import { clearCarcass } from './systems/carcass';
import { createBreedingPiece, createFoodPiece } from './systems/feeding';

// Later stories append Sell, Sacrifice, Buy, …
export type Command =
  | { type: 'Farm' }
  | { type: 'FarmBreeding' }
  // FR9: the Breed tool picked sheep a, then sheep b. breeding.ts checks the pair again.
  | { type: 'Breed'; a: number; b: number }
  // FR13: a left click on a carcass in the default input mode. carcass.ts ignores an id that is gone.
  | { type: 'ClearCarcass'; id: number };

export function applyCommand(state: GameState, cmd: Command): void {
  // FR38: a lost game takes no more commands. The sim is the authority; view guards are for feel.
  if (state.lostAt !== undefined) return;
  switch (cmd.type) {
    case 'Farm':
      farm(state);
      return;
    case 'FarmBreeding':
      farmBreeding(state);
      return;
    case 'Breed':
      breed(state, cmd.a, cmd.b);
      return;
    case 'ClearCarcass':
      clearCarcass(state, cmd.id);
      return;
    default:
      assertNever(cmd);
  }
}

/**
 * FR3 (changed 2026-10-06): a click fills pips of the Farm bar, and every full bar drops one food
 * piece at a random reachable spot in the pen. There is no food stock. Better Hoe (4.7) and the
 * boost (2.8) change the pips per click here, so one click may complete several bars.
 */
function farm(state: GameState): void {
  // Between clicks a valid bar is a whole number below farmPipsPerFood. A loaded save may hold NaN, a
  // negative or a huge value (1e20 - 8 === 1e20 would loop for ever): start that bar over instead.
  const p = state.farmProgress;
  if (!(Number.isInteger(p) && p >= 0 && p < TUNING.farmPipsPerFood)) state.farmProgress = 0;
  state.farmProgress += TUNING.farmPipsPerClick;
  let added = 0;
  while (state.farmProgress >= TUNING.farmPipsPerFood) {
    state.farmProgress -= TUNING.farmPipsPerFood;
    const r = innerFence(state);
    const p = createFoodPiece(state, rngRange(state, r.left, r.right), rngRange(state, r.top, r.bottom));
    emit({ type: 'FoodDropped', id: p.id, x: p.x, y: p.y });
    added++;
  }
  emit({ type: 'Farmed', resource: 'food', added });
}

/**
 * FR8 (changed 2026-10-06): Farm Breeding Food works like Farm. A click fills pips of the breeding
 * bar, and every full bar drops one breeding piece at a random reachable spot in the pen; adults eat
 * them to become ready (FR8a). No stock, no cap. Never boosted (2.8), and Better Hoe does not apply.
 */
function farmBreeding(state: GameState): void {
  // The same corrupt-bar guard as farm(): a bad value from a loaded save starts the bar over.
  const b = state.breedingProgress;
  if (!(Number.isInteger(b) && b >= 0 && b < TUNING.breedingPipsPerFood)) state.breedingProgress = 0;
  state.breedingProgress += TUNING.breedingPipsPerClick;
  let added = 0;
  while (state.breedingProgress >= TUNING.breedingPipsPerFood) {
    state.breedingProgress -= TUNING.breedingPipsPerFood;
    const r = innerFence(state);
    const p = createBreedingPiece(state, rngRange(state, r.left, r.right), rngRange(state, r.top, r.bottom));
    emit({ type: 'BreedingFoodDropped', id: p.id, x: p.x, y: p.y });
    added++;
  }
  emit({ type: 'Farmed', resource: 'breedingFood', added });
}
