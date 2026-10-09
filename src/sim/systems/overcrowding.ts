// Overcrowding (FR34, GDD Overcrowding, Story 4.6): a full pasture risks disease. A fixed clock rolls
// every overcrowdIntervalMs from new game (`nextOvercrowdRollAt`, rescheduled at every deadline), and a
// roll happens only while the living flock is crowded (selectors.ts isCrowded, the rule the flock
// counter's crowded style shows): overcrowdInfectChance to infect one random living sheep. Not crowded
// at a deadline means no draw at all, so the random sequence of an uncrowded game is unchanged.
// The infection is the virus's own (virus.ts infectSheep): the tells, the ping, the death
// virusDeathMs later and the medicine cure all follow from `infectedAt`. A pick that is already infected
// spends the roll. The era thresholds equal land capacities on purpose (decision log "Overcrowding at
// era thresholds"), so entering an era rolls: reaching one should feel risky.
// Runs after the virus and the Abomination, so it rolls on the tick's flock after their deaths. Never
// reads a secret field; the Abomination is picked and infected like any lamb. No allocation per tick.
import { TUNING } from '../../config/tuning';
import { rng, rngInt } from '../rng';
import { isCrowded } from '../selectors';
import type { GameState } from '../state';
import { infectSheep } from './virus';

export function updateOvercrowding(state: GameState): void {
  if (state.time < state.nextOvercrowdRollAt) return;
  state.nextOvercrowdRollAt = state.time + TUNING.overcrowdIntervalMs;
  if (!isCrowded(state)) return;
  // The chance first, then (on a hit) the victim, so a miss draws one number.
  if (rng(state) >= TUNING.overcrowdInfectChance) return;
  const sheep = state.sheep;
  // Crowded implies at least one sheep while every capacity is positive (tuning.test.ts); kept for safety.
  if (sheep.length === 0) return;
  infectSheep(state, sheep[rngInt(state, 0, sheep.length - 1)]);
}
