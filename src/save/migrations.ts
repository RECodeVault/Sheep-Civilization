// Save migrations (AR9: parse → migrate → validate). MIGRATIONS[v] turns a version-v state into a
// version-(v + 1) state; migrate() chains them up to SAVE_SCHEMA_VERSION. The story that bumps the
// schema adds its step here. There is no step from version 1: no version-1 save was ever persisted
// (saving starts in 1.9, at version 2), so version 1 is rejected rather than migrated.
import { SAVE_SCHEMA_VERSION } from '../config/constants';
import { TUNING } from '../config/tuning';
import { rngInt } from '../sim/rng';

export type Migration = (state: Record<string, unknown>) => Record<string, unknown>;

export const MIGRATIONS: Readonly<Record<number, Migration>> = Object.freeze({
  // Story 2.2: the breeding bar and pieces arrive empty, and no sheep is ready (FR6, FR8, FR8a). A
  // malformed sheep list is passed through for validation to reject.
  2: (s) => ({
    ...s,
    breedingProgress: 0,
    breedingPieces: [],
    sheep: Array.isArray(s.sheep) ? s.sheep.map((x: unknown) => (isObj(x) ? { ...x, breedReady: false } : x)) : s.sheep,
  }),
  // Story 2.3: nobody has bred yet, so nobody is on cooldown and no lamb is on the way (FR9, FR10).
  3: (s) => ({
    ...s,
    pregnancies: [],
    sheep: Array.isArray(s.sheep) ? s.sheep.map((x: unknown) => (isObj(x) ? { ...x, cooldownUntil: 0 } : x)) : s.sheep,
  }),
  // Story 2.5: `infectedAt` (optional, absent = healthy) and the `seekCarcass` activity arrive. No
  // version-4 save holds either, so the state is unchanged.
  4: (s) => s,
  // Story 2.8: no boost was running in a version-5 save (FR19).
  5: (s) => ({ ...s, boostUntil: 0 }),
  // Story 3.1: nothing had been sold, so there is no money (FR21).
  6: (s) => ({ ...s, money: 0 }),
  // Story 3.2: nothing had been bought (FR22, FR23).
  7: (s) => ({ ...s, owned: [] }),
  // Story 4.1: nobody is the Abomination yet (FR29). The births before this save are not known, so it
  // counts births from its load, and its guaranteed birth is rolled from its own rng, so a reload
  // migrates the same way. A malformed rng is left for validation to reject.
  8: (s) => {
    const sheep = Array.isArray(s.sheep)
      ? s.sheep.map((x: unknown) => (isObj(x) ? { ...x, isAbomination: false } : x))
      : s.sheep;
    const roll = { rng: s.rng as number };
    const validRng = Number.isInteger(s.rng) && (s.rng as number) >= 0 && (s.rng as number) <= 0xffffffff;
    const guaranteedAtBirth = validRng
      ? rngInt(roll, TUNING.abominationGuaranteedBirthMin, TUNING.abominationGuaranteedBirthMax)
      : TUNING.abominationGuaranteedBirthMax;
    return {
      ...s,
      sheep,
      abomination: { birthsSeen: 0, guaranteedAtBirth },
      ...(validRng ? { rng: roll.rng } : {}),
    };
  },
  // Story 4.3: the kill cycle's deadline arrives. A living Abomination gets its next visit 45–60 s from
  // the save's time, rolled from the save's own rng (so a reload migrates the same way); with none it is
  // 0 (unused until one is born). No version-9 save holds `stalking`, `stalk` or `doomedAt`. A malformed
  // abomination, time or rng is left for validation to reject.
  9: (s) => {
    if (!isObj(s.abomination)) return s;
    const alive = Array.isArray(s.sheep) && s.sheep.some((x: unknown) => isObj(x) && x.isAbomination === true);
    const validRng = Number.isInteger(s.rng) && (s.rng as number) >= 0 && (s.rng as number) <= 0xffffffff;
    if (!alive || !validRng || !Number.isInteger(s.time)) return { ...s, abomination: { ...s.abomination, nextKillAt: 0 } };
    const roll = { rng: s.rng as number };
    const nextKillAt = (s.time as number) + rngInt(roll, TUNING.abominationKillMinMs, TUNING.abominationKillMaxMs);
    return { ...s, rng: roll.rng, abomination: { ...s.abomination, nextKillAt } };
  },
  // Story 4.5: no dose had been bought (FR26).
  10: (s) => ({ ...s, medicine: 0 }),
  // Story 4.6: the first overcrowding roll comes a full interval after the load (FR34); no rng. A
  // malformed time is left for validation to reject.
  11: (s) => (Number.isInteger(s.time) ? { ...s, nextOvercrowdRollAt: (s.time as number) + TUNING.overcrowdIntervalMs } : s),
});

export type MigrationResult = { ok: true; state: unknown } | { ok: false; reason: string };

/** Upgrades `state` from `version` to the current schema. `table` is for tests only. */
export function migrate(version: number, state: unknown, table: Readonly<Record<number, Migration>> = MIGRATIONS): MigrationResult {
  if (!Number.isInteger(version) || version < 1) return { ok: false, reason: `bad schemaVersion ${String(version)}` };
  if (version > SAVE_SCHEMA_VERSION) return { ok: false, reason: `save is from a newer version (${version})` };
  let current = state;
  for (let v = version; v < SAVE_SCHEMA_VERSION; v++) {
    const step = table[v];
    if (step === undefined) return { ok: false, reason: `no migration from version ${v}` };
    if (typeof current !== 'object' || current === null || Array.isArray(current)) {
      return { ok: false, reason: `state is not an object (migrating from version ${v})` };
    }
    try {
      current = step(current as Record<string, unknown>);
    } catch (err) {
      return { ok: false, reason: `migration from version ${v} failed: ${err instanceof Error ? err.message : String(err)}` };
    }
  }
  return { ok: true, state: current };
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
