// View → sim player intents. Commands are applied at the start of the next tick, before step().
import { TUNING } from '../config/tuning';
import { assertNever } from '../core/types';
import { emit } from './events';
import { rngRange } from './rng';
import { innerFence } from './selectors';
import type { GameState } from './state';
import { createFoodPiece } from './systems/feeding';

// Later stories append FarmBreeding, ClearCarcass, Breed, Sell, Sacrifice, Buy, …
export type Command = { type: 'Farm' };

export function applyCommand(state: GameState, cmd: Command): void {
  switch (cmd.type) {
    case 'Farm':
      farm(state);
      return;
    default:
      // Narrow on the discriminant: a one-variant union does not narrow `cmd` itself to never.
      assertNever(cmd.type);
  }
}

/**
 * FR3 (changed 2026-10-06): a click fills pips of the Farm bar, and every full bar drops one food
 * piece at a random reachable spot in the pen. There is no food stock. Better Hoe (4.7) and the
 * boost (2.8) change the pips per click here, so one click may complete several bars.
 */
function farm(state: GameState): void {
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
