// Retune-safe loading (Story 3.6; deferred 2.8 "Validation bounds follow live tuning"). Some validation
// bounds come from the live TUNING: a bar can hold at most farmPipsPerFood − 1 pips, a boost runs at
// most boostMs ahead, and so on. A save made before a retune lowered one of those values breaks such a
// bound, and rejecting it would lose the flock. This step runs on load only (after migrate, before
// validate) and clamps those values into the current bounds.
//
// It only clamps well-formed values (integers or finite numbers of the right kind). Anything malformed is
// left alone for validation to reject, as before. validateState itself stays strict, because writeSave
// also uses it on the live state, where an out-of-bound value is a bug, not an old tuning.
import { TUNING } from '../config/tuning';

type Obj = Record<string, unknown>;

function isObj(v: unknown): v is Obj {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Lowers `o[key]` to `max` when it is a number of the right kind above it. */
function clampDown(o: Obj, key: string, max: number, integer: boolean): void {
  const v = o[key];
  if (typeof v !== 'number' || !(integer ? Number.isInteger(v) : Number.isFinite(v))) return;
  if (v > max) o[key] = max;
}

/** Clamps tuning-derived values in a parsed, migrated save state, in place. Never throws. */
export function normalizeTuned(state: unknown): void {
  if (!isObj(state)) return;
  const time = state.time;
  clampDown(state, 'farmProgress', TUNING.farmPipsPerFood - 1, true);
  clampDown(state, 'breedingProgress', TUNING.breedingPipsPerFood - 1, true);
  // Story 4.1: a retuned spawn window moves a pending guaranteed birth into the new one, but never to a
  // birth already counted (it would never come) and never moves one already passed (it would spawn a
  // second guaranteed Abomination). If the whole window is behind the count, the next birth is it.
  const a = state.abomination;
  if (isObj(a) && Number.isInteger(a.birthsSeen) && Number.isInteger(a.guaranteedAtBirth)) {
    const seen = a.birthsSeen as number;
    const g = a.guaranteedAtBirth as number;
    if (seen < g) {
      const lo = Math.max(TUNING.abominationGuaranteedBirthMin, seen + 1);
      a.guaranteedAtBirth = Math.max(lo, Math.min(g, TUNING.abominationGuaranteedBirthMax));
    }
  }
  // Deadlines are relative to `time`; without a valid time there is nothing to clamp against.
  if (!Number.isInteger(time)) return;
  const t = time as number;
  clampDown(state, 'boostUntil', t + TUNING.boostMs, true);
  // Story 4.6: a shorter overcrowding interval pulls a saved roll in.
  clampDown(state, 'nextOvercrowdRollAt', t + TUNING.overcrowdIntervalMs, true);
  // Story 4.3: a shorter kill interval, doom delay or visit phase brings a saved deadline inside the new
  // bound (each stays after `time`, since every bound is at least one tick).
  if (isObj(a)) clampDown(a, 'nextKillAt', t + TUNING.abominationKillMaxMs, true);
  if (Array.isArray(state.sheep)) {
    for (const s of state.sheep) {
      if (!isObj(s)) continue;
      clampDown(s, 'fullness', TUNING.fullnessMax, false);
      clampDown(s, 'cooldownUntil', t + TUNING.breedCooldownMs, false);
      clampDown(s, 'doomedAt', t + TUNING.abominationDoomMaxMs, true);
      const st = s.stalk;
      if (isObj(st)) {
        const len =
          st.phase === 'approach'
            ? TUNING.abominationApproachMaxMs
            : st.phase === 'linger'
              ? TUNING.abominationLingerMs
              : st.phase === 'leave'
                ? TUNING.abominationLeaveMs
                : undefined;
        if (len !== undefined) clampDown(st, 'until', t + len, true);
      }
      // A shorter virusDeathMs can put a saved infection past its death. Move it forward so the death
      // falls due by the first tick (updateVirus kills at time ≥ infectedAt + virusDeathMs): the sheep
      // still dies of the virus, now, instead of the save being rejected.
      const inf = s.infectedAt;
      if (Number.isInteger(inf) && (inf as number) <= t && (inf as number) + TUNING.virusDeathMs <= t) {
        s.infectedAt = t - TUNING.virusDeathMs + 1;
      }
    }
  }
  if (Array.isArray(state.pregnancies)) {
    for (const p of state.pregnancies) if (isObj(p)) clampDown(p, 'dueAt', t + TUNING.gestationMs, false);
  }
}
