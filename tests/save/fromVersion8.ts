import { TUNING } from '../../src/config/tuning';
import { rngInt } from '../../src/sim/rng';
import type { GameState } from '../../src/sim/state';

/**
 * What the 8 → 9 migration (Story 4.1) makes of `state` saved before Epic 4: nobody is the Abomination,
 * births are counted from 0, and the guaranteed birth is rolled from the save's own rng, which advances
 * by that one draw. Every older save passes through this step too.
 */
export function migratedFrom8(state: GameState): GameState {
  const roll = { rng: state.rng };
  const guaranteedAtBirth = rngInt(roll, TUNING.abominationGuaranteedBirthMin, TUNING.abominationGuaranteedBirthMax);
  return {
    ...state,
    rng: roll.rng,
    sheep: state.sheep.map((s) => ({ ...s, isAbomination: false })),
    abomination: { birthsSeen: 0, guaranteedAtBirth },
  };
}
