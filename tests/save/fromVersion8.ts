import { TUNING } from '../../src/config/tuning';
import { rngInt } from '../../src/sim/rng';
import type { GameState } from '../../src/sim/state';

/**
 * What the 8 → 9 migration (Story 4.1) makes of `state` saved before Epic 4: nobody is the Abomination,
 * births are counted from 0, and the guaranteed birth is rolled from the save's own rng, which advances
 * by that one draw. Every older save passes through this step too, and then through 9 → 10 (Story 4.3),
 * which with no Abomination alive sets `nextKillAt: 0` and draws nothing, and 10 → 11 (Story 4.5), which
 * gives it no dose of medicine, and 11 → 12 (Story 4.6), which puts its first overcrowding roll one
 * interval after its time.
 */
export function migratedFrom8(state: GameState): GameState {
  const roll = { rng: state.rng };
  const guaranteedAtBirth = rngInt(roll, TUNING.abominationGuaranteedBirthMin, TUNING.abominationGuaranteedBirthMax);
  return {
    ...state,
    rng: roll.rng,
    sheep: state.sheep.map((s) => ({ ...s, isAbomination: false })),
    abomination: { birthsSeen: 0, guaranteedAtBirth, nextKillAt: 0 },
    medicine: 0,
    nextOvercrowdRollAt: state.time + TUNING.overcrowdIntervalMs,
  };
}
