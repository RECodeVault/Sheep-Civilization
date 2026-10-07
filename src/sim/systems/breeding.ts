// Breeding (FR9–FR11): pairing two ready adults with the Breed tool, the per-adult cooldown and the
// capacity check. Pairing is a command, not a per-tick rule, so this module has no update function;
// gestation and birth are lifecycle.ts's (System Location Mapping). The view's eligibility is a frame
// old by the time a Breed applies, so every rule is checked again here.
import { TUNING } from '../../config/tuning';
import { emit } from '../events';
import { canBreed, capacity, innerFence, sheepIndex, slotsUsed } from '../selectors';
import { nextId, type GameState } from '../state';

/**
 * Pairs sheep `a` and `b`, or does nothing (no state change, no event) unless both are distinct
 * living ready adults off cooldown with a free capacity slot. Uses up both sheep's readiness, starts
 * their cooldown and puts a lamb on the way; costs nothing else (FR9). Draws no rng.
 */
export function breed(state: GameState, a: number, b: number): void {
  if (a === b) return;
  const ia = sheepIndex(state, a);
  const ib = sheepIndex(state, b);
  if (ia < 0 || ib < 0) return;
  const sa = state.sheep[ia];
  const sb = state.sheep[ib];
  if (!canBreed(sa, state) || !canBreed(sb, state)) return;
  // AR21: a pending lamb holds its slot from the moment of breeding.
  if (slotsUsed(state) >= capacity(state)) return;

  sa.breedReady = false;
  sb.breedReady = false;
  sa.cooldownUntil = sb.cooldownUntil = state.time + TUNING.breedCooldownMs;
  // A rare event, so innerFence's allocation is fine. Parents always stand inside it, except in a
  // corrupt save; clamping keeps the stored spot (and so a lamb born there) reachable.
  const r = innerFence(state);
  const x = Math.min(r.right, Math.max(r.left, (sa.x + sb.x) / 2));
  const y = Math.min(r.bottom, Math.max(r.top, (sa.y + sb.y) / 2));
  const id = nextId(state);
  state.pregnancies.push({ id, parentA: a, parentB: b, dueAt: state.time + TUNING.gestationMs, x, y });
  emit({ type: 'Bred', pregnancyId: id, parentA: a, parentB: b, x, y });
}
