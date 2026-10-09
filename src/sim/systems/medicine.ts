// Medicine (FR26, GDD Medicine, Story 4.5): the Should-tier counter to the virus. A dose bought in the
// shop (economy.ts) and dropped on an infected sheep cures it at once by deleting `infectedAt`, so the
// virus death (virus.ts) never comes. It cures infection only: it never reads or clears the
// Abomination's secret doom (`doomedAt`, AR18), so a cured victim still dies on schedule. The command
// side only, so this module has no update function and is not in step.ts.
// Draws no rng.
import { emit } from '../events';
import { sheepIndex } from '../selectors';
import type { GameState } from '../state';

/**
 * Cures sheep `id` with one dose. Nothing happens (and no dose is used) with no dose owned, an id that
 * is gone (it died, was sold or sacrificed between the drop and the tick) or a sheep that is not
 * infected: the view's look is only a hint.
 */
export function applyMedicine(state: GameState, id: number): void {
  if (state.medicine < 1) return;
  const i = sheepIndex(state, id);
  if (i < 0) return;
  const s = state.sheep[i];
  if (s.infectedAt === undefined) return;
  delete s.infectedAt;
  state.medicine -= 1;
  emit({ type: 'Cured', id: s.id, x: s.x, y: s.y });
}
