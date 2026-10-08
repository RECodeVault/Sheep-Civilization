// Eras (FR27, FR28; architecture pattern N4). The era is derived from the living flock by
// selectors.ts currentEra, never stored. state.lastEra is only the change-detection cache for
// EraChanged, and nothing else reads it (AR20). Eras regress when the flock shrinks. Runs last in
// step(), so one tick's net change emits at most one event. Draws no rng and takes no id.
import { emit } from '../events';
import { currentEra } from '../selectors';
import type { GameState } from '../state';

export function updateEras(state: GameState): void {
  const era = currentEra(state);
  if (era === state.lastEra) return;
  emit({ type: 'EraChanged', from: state.lastEra, to: era });
  state.lastEra = era;
}

/**
 * Sets the change-detection cache to the era the flock is in, with no event (Story 3.5 review). Called
 * when a game is created or loaded, so a save whose `lastEra` is stale (every save from before 3.5, a
 * hand-edited one, or one written after a debug change while paused) never announces an era change that
 * did not happen: the view already shows `currentEra` on its first frame.
 */
export function syncEra(state: GameState): void {
  state.lastEra = currentEra(state);
}
