// The Abomination (FR29–FR33, pattern N2): a lamb that is secretly a monster. Story 4.1 decides which
// lamb it is: the birth rolled at new game (state.abomination.guaranteedAtBirth, 8th–15th) is
// guaranteed, and every birth after it has abominationBirthChance, with at most one alive. Its
// identity lives in `Sheep.isAbomination`, read only by the sim, debug and save code; the view sees
// PublicSheep, where it is a lamb (stageOf keeps it one for ever) whose only difference is `gait`.
// Story 4.3 adds the kill cycle and the victim's delayed death here.
import { TUNING } from '../../config/tuning';
import { rng } from '../rng';
import type { GameState, Sheep } from '../state';

/** True while an Abomination is alive. A plain loop: no allocation. Derived, never stored. */
export function abominationAlive(state: GameState): boolean {
  const sheep = state.sheep;
  for (let i = 0; i < sheep.length; i++) if (sheep[i].isAbomination) return true;
  return false;
}

/**
 * FR29: called by lifecycle.ts for each lamb born from a pregnancy, right after it is created (a shared
 * helper owned by this concept, like killSheep). Counts the birth, then makes `lamb` the Abomination
 * when none is alive and this is the guaranteed birth, or a later birth that wins the chance roll. No
 * rng is drawn before the guaranteed birth or while one is alive. Emits nothing: LambBorn looks the
 * same for the Abomination, so the view never learns of the spawn.
 */
export function onBirth(state: GameState, lamb: Sheep): void {
  const a = state.abomination;
  a.birthsSeen++;
  if (abominationAlive(state)) return;
  if (a.birthsSeen === a.guaranteedAtBirth) {
    lamb.isAbomination = true;
  } else if (a.birthsSeen > a.guaranteedAtBirth && rng(state) < TUNING.abominationBirthChance) {
    lamb.isAbomination = true;
  }
}
