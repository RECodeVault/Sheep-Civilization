// Life stages (FR7): stage is derived from age (selectors.stageOf), so ageing needs no state; only
// adults can be ready to breed, so readiness is cleared outside that stage (FR8a). This system starts
// a life (gestation and birth, FR9) and ends one: an elder dies of old age, through the single death
// pipeline, on the tick its age reaches oldAgeMs. Story 4.3 adds the Abomination victim's delayed
// death (doomedAt).
import { TUNING } from '../../config/tuning';
import { emit } from '../events';
import { innerFence, pregnancySpot } from '../selectors';
import { createSheep, type GameState } from '../state';
import { killSheep } from './carcass';

// Module-scope scratch for the birth spot, so a tick allocates nothing.
const spot = { x: 0, y: 0 };

export function updateLifecycle(state: GameState): void {
  // Births first, so a lamb due on the tick the last adult dies of old age keeps the flock alive.
  births(state);
  // killSheep replaces state.sheep, so iterate the array as it is now, after the births (a newborn is
  // age 0 and does nothing below). Deaths happen in array order.
  const sheep = state.sheep;
  for (let i = 0; i < sheep.length; i++) {
    const s = sheep[i];
    const age = state.time - s.bornAt;
    // FR8a: only adults can breed, so a ready adult loses its readiness on turning elder (and a ready
    // lamb, which only a corrupt save can hold, loses it at once).
    if (s.breedReady && (age < TUNING.lambUntilMs || age >= TUNING.elderFromMs)) s.breedReady = false;
    // Story 4.1: the Abomination never dies of old age (skip isAbomination).
    if (age >= TUNING.oldAgeMs) killSheep(state, s.id, 'oldAge');
  }
}

/**
 * FR9: every lamb due by now is born beside its parents (or where they bred, if both are gone),
 * clamped to the inner fence. A pregnancy outlives its parents: it already holds a capacity slot.
 */
function births(state: GameState): void {
  const list = state.pregnancies;
  // Forwards, so lambs due on one tick are born (ids, rng draws) in pregnancy order; the index stays
  // put after a splice. A birth is a rare event: only it allocates.
  for (let i = 0; i < list.length; ) {
    const g = list[i];
    if (state.time < g.dueAt) {
      i++;
      continue;
    }
    pregnancySpot(state, g, spot);
    const r = innerFence(state);
    const lamb = createSheep(state, {
      x: Math.min(r.right, Math.max(r.left, spot.x)),
      y: Math.min(r.bottom, Math.max(r.top, spot.y)),
      bornAt: state.time,
    });
    list.splice(i, 1);
    emit({ type: 'LambBorn', id: lamb.id, pregnancyId: g.id, x: lamb.x, y: lamb.y });
  }
}
