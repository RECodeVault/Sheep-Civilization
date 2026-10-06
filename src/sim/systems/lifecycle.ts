// Life stages (FR7): stage is derived from age (selectors.stageOf), so ageing needs no state. This
// system ends a life: an elder dies of old age, through the single death pipeline, on the tick its
// age reaches oldAgeMs. Story 2.3 adds gestation and birth here, Story 4.3 the Abomination victim's
// delayed death (doomedAt).
import { TUNING } from '../../config/tuning';
import type { GameState } from '../state';
import { killSheep } from './carcass';

export function updateLifecycle(state: GameState): void {
  // killSheep replaces state.sheep, so iterate the start-of-tick array. Deaths happen in array order.
  const sheep = state.sheep;
  for (let i = 0; i < sheep.length; i++) {
    const s = sheep[i];
    // Story 4.1: the Abomination never dies of old age (skip isAbomination).
    if (state.time - s.bornAt >= TUNING.oldAgeMs) killSheep(state, s.id, 'oldAge');
  }
}
