// Pattern N1, the single death pipeline: killSheep is the only way a sheep dies. Hunger, lifecycle
// (2.1), virus (2.5) and the Abomination (4.3) all call it, so every death is counted, announced and,
// from Story 2.4, leaves a carcass. Nothing else removes sheep from state.sheep (removeSheep, for
// selling and sacrifice, arrives in Epic 2).
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
  // Story 1.8: checkLastSheepAndLoss(state) here.
}
