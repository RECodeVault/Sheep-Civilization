// Pattern N1, the single death pipeline: killSheep is the only way a sheep dies. Hunger, lifecycle
// (2.1), virus (2.5) and the Abomination (4.3) all call it, so every death is counted, announced and,
// from Story 2.4, leaves a carcass. Nothing else removes sheep from state.sheep (removeSheep, for
// selling and sacrifice, arrives in Epic 2). Both end with checkLastSheepAndLoss: selling or
// sacrificing the last sheep is a loss too.
//
// Callers: killSheep *replaces* state.sheep with a new, shorter array. A system that kills while
// looping must loop over the array it captured before the loop (see updateHunger), never re-read
// state.sheep[i] mid-loop (it would skip the sheep after each death), and must rebuild the grid
// before any later neighbour query (grid indices point into the old array).
import { TUNING } from '../../config/tuning';
import { invariant } from '../../core/invariant';
import { emit, type DeathCause } from '../events';
import { nextId, type GameState } from '../state';

export function killSheep(state: GameState, id: number, cause: DeathCause): void {
  const s = state.sheep.find((x) => x.id === id);
  if (s === undefined) {
    invariant(false, `killSheep: unknown sheep ${id}`);
    return;
  }
  // Allocates, which is fine: a death is a rare event, not per-tick work.
  state.sheep = state.sheep.filter((x) => x.id !== id);
  state.stats.died += 1;
  // Off in Epic 1; Story 2.4 turns carcasses on.
  if (TUNING.carcassesEnabled) {
    state.carcasses.push({ id: nextId(state), x: s.x, y: s.y, createdAt: state.time });
  }
  emit({ type: 'SheepDied', id, cause, x: s.x, y: s.y });
  // Last, so Lost follows the SheepDied that caused it.
  checkLastSheepAndLoss(state);
}

/**
 * Pattern N1: runs after every removal (killSheep now, removeSheep in Epic 2). Loss = 0 sheep alive
 * (FR38): records the time once and emits Lost; step() and applyCommand() then do nothing.
 */
export function checkLastSheepAndLoss(state: GameState): void {
  // Story 5.5: emit LastSheep when the flock drops to 1.
  if (state.sheep.length > 0 || state.lostAt !== undefined) return;
  state.lostAt = state.time;
  emit({ type: 'Lost', survivedMs: state.lostAt, peakFlock: state.stats.peakFlock });
}
