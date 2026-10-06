import { TUNING } from '../../src/config/tuning';
import { applyCommand } from '../../src/sim/commands';
import { drainEvents } from '../../src/sim/events';
import type { GameState } from '../../src/sim/state';
import { fillFlock, newGame, runFor } from '../sim/helpers';

/**
 * A mid-game state with every saved field in use: a 12-sheep flock, pieces on the ground with
 * seekers walking to them, a half-filled Farm bar and an advanced rng. Callers assert it is busy.
 */
export function busyGame(seed = 31337): GameState {
  const state = newGame(seed);
  fillFlock(state, 12);
  for (let i = 0; i < TUNING.farmPipsPerFood * 3 + 3; i++) applyCommand(state, { type: 'Farm' });
  drainEvents(() => {});
  runFor(state, 1_000);
  return state;
}

/** True when the state exercises seekers, targets, pieces and a part-filled bar. */
export function isBusy(state: GameState): boolean {
  return (
    state.sheep.some((s) => s.activity === 'seekFood' && s.targetId !== undefined) &&
    state.foodPieces.length > 0 &&
    state.farmProgress > 0
  );
}
