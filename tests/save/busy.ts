import { TUNING } from '../../src/config/tuning';
import { applyCommand } from '../../src/sim/commands';
import { drainEvents } from '../../src/sim/events';
import type { GameState } from '../../src/sim/state';
import { fillFlock, innerFence, newGame, runFor } from '../sim/helpers';

/**
 * A mid-game state with every saved field in use: a 12-sheep flock, pieces on the ground with
 * seekers walking to them, a half-filled Farm bar, breeding pieces with seekers and a part-filled
 * breeding bar, a ready sheep, a pregnancy with its parents on cooldown and an advanced rng. Callers
 * assert it is busy.
 */
export function busyGame(seed = 31337): GameState {
  const state = newGame(seed);
  fillFlock(state, 12);
  for (let i = 0; i < TUNING.farmPipsPerFood * 3 + 3; i++) applyCommand(state, { type: 'Farm' });
  for (let i = 0; i < TUNING.breedingPipsPerFood * 2 + 3; i++) applyCommand(state, { type: 'FarmBreeding' });
  // A ready sheep (it would have eaten a breeding piece), and two fed adults that will claim the
  // breeding pieces (hungry sheep go for food first).
  state.sheep[0].breedReady = true;
  state.sheep[1].fullness = TUNING.fullnessMax;
  state.sheep[2].fullness = TUNING.fullnessMax;
  // A pregnancy (Story 2.3): two more adults bred, so they are on cooldown and their lamb is on the way.
  // Set directly: 12 sheep are over the base capacity, so a Breed command would be refused.
  const [a, b] = [state.sheep[3], state.sheep[4]];
  const r = innerFence(state);
  a.cooldownUntil = b.cooldownUntil = state.time + TUNING.breedCooldownMs;
  state.pregnancies.push({
    id: state.nextId++,
    parentA: a.id,
    parentB: b.id,
    dueAt: state.time + TUNING.gestationMs,
    // Clamped as breed() does: validation requires the inner fence.
    x: Math.min(r.right, Math.max(r.left, (a.x + b.x) / 2)),
    y: Math.min(r.bottom, Math.max(r.top, (a.y + b.y) / 2)),
  });
  drainEvents(() => {});
  runFor(state, 1_000);
  return state;
}

/**
 * True when the state exercises both kinds of seeker, targets, pieces, both part-filled bars, a ready
 * sheep, a sheep on cooldown and a pregnancy.
 */
export function isBusy(state: GameState): boolean {
  return (
    state.sheep.some((s) => s.activity === 'seekFood' && s.targetId !== undefined) &&
    state.foodPieces.length > 0 &&
    state.farmProgress > 0 &&
    state.breedingProgress > 0 &&
    state.breedingPieces.length > 0 &&
    state.sheep.some((s) => s.activity === 'seekBreedingFood' && s.targetId !== undefined) &&
    state.sheep.some((s) => s.breedReady) &&
    state.sheep.some((s) => state.time < s.cooldownUntil) &&
    state.pregnancies.length > 0
  );
}
