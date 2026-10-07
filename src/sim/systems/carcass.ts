// Pattern N1, the single death pipeline: killSheep is the only way a sheep dies. Hunger, lifecycle
// (2.1), virus (2.5) and the Abomination (4.3) all call it, so every death is counted, announced and
// leaves a carcass (FR12, since Story 2.4). Nothing else removes sheep from state.sheep (removeSheep, for
// selling and sacrifice, arrives in Epic 2). Both end with checkLastSheepAndLoss: selling or
// sacrificing the last sheep is a loss too.
//
// Carcasses live here too (System Location Mapping): createCarcass, clearCarcass (FR13, the player's
// click), and from Story 2.5 starving sheep eating them.
//
// Callers: killSheep *replaces* state.sheep with a new, shorter array. A system that kills while
// looping must loop over the array it captured before the loop (see updateHunger), never re-read
// state.sheep[i] mid-loop (it would skip the sheep after each death), and must rebuild the grid
// before any later neighbour query (grid indices point into the old array).
import { TUNING } from '../../config/tuning';
import { invariant } from '../../core/invariant';
import { emit, type DeathCause } from '../events';
import { carcassIndex } from '../selectors';
import { nextId, type Carcass, type GameState } from '../state';

export function killSheep(state: GameState, id: number, cause: DeathCause): void {
  const s = state.sheep.find((x) => x.id === id);
  if (s === undefined) {
    invariant(false, `killSheep: unknown sheep ${id}`);
    return;
  }
  // Allocates, which is fine: a death is a rare event, not per-tick work.
  state.sheep = state.sheep.filter((x) => x.id !== id);
  state.stats.died += 1;
  emit({ type: 'SheepDied', id, cause, x: s.x, y: s.y });
  // FR12: the carcass lies where the sheep stood. Its event follows the death it came from.
  if (TUNING.carcassesEnabled) {
    const c = createCarcass(state, s.x, s.y);
    emit({ type: 'CarcassSpawned', id: c.id, x: c.x, y: c.y });
  }
  // Last, so Lost follows the SheepDied that caused it.
  checkLastSheepAndLoss(state);
}

/** Adds a carcass at (x, y). No rng and no event: killSheep emits CarcassSpawned; debug spawns silently. */
export function createCarcass(state: GameState, x: number, y: number): Carcass {
  const c: Carcass = { id: nextId(state), x, y, createdAt: state.time };
  state.carcasses.push(c);
  return c;
}

/**
 * FR13: the player clicked a carcass away. An id that is not a carcass is ignored without a fuss: the
 * view is a tick behind, so a double click sends two ClearCarcass for one carcass before it is gone.
 */
export function clearCarcass(state: GameState, id: number): void {
  const i = carcassIndex(state, id);
  if (i < 0) return;
  const c = state.carcasses[i];
  // A rare event, so the splice is fine.
  state.carcasses.splice(i, 1);
  emit({ type: 'CarcassCleared', id: c.id, x: c.x, y: c.y });
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
