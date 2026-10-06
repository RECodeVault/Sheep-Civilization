// Save migrations (AR9: parse → migrate → validate). MIGRATIONS[v] turns a version-v state into a
// version-(v + 1) state; migrate() chains them up to SAVE_SCHEMA_VERSION. The story that bumps the
// schema adds its step here. There is no step from version 1: no version-1 save was ever persisted
// (saving starts in 1.9, at version 2), so version 1 is rejected rather than migrated.
import { SAVE_SCHEMA_VERSION } from '../config/constants';

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
