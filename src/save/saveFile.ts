// The versioned save envelope (architecture Data Persistence): `{ schemaVersion, savedAt, state }`.
// Pure encode/decode only; storage, autosave and the visibility hook live in saveStore.ts.
import { SAVE_SCHEMA_VERSION } from '../config/constants';
import type { GameState } from '../sim/state';
import { migrate } from './migrations';
import { validateState, type ValidationResult } from './validate';

export interface SaveFile {
  schemaVersion: number;
  /** ISO 8601 wall-clock time of the save; only src/save/ builds it. */
  savedAt: string;
  state: GameState;
}

export function encodeSave(state: GameState, now: Date = new Date()): string {
  const file: SaveFile = { schemaVersion: SAVE_SCHEMA_VERSION, savedAt: now.toISOString(), state };
  return JSON.stringify(file);
}

/** Parses a save: JSON → envelope check → migrate → validate (AR9). Never throws. */
export function decodeSaveResult(raw: string): ValidationResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, reason: 'not valid JSON' };
  }
  if (!isPlainObject(parsed)) return { ok: false, reason: 'save is not an object' };
  if (typeof parsed.schemaVersion !== 'number') return { ok: false, reason: 'schemaVersion is missing' };
  if (typeof parsed.savedAt !== 'string') return { ok: false, reason: 'savedAt is missing' };
  if (!('state' in parsed)) return { ok: false, reason: 'state is missing' };
  const migrated = migrate(parsed.schemaVersion, parsed.state);
  if (!migrated.ok) return migrated;
  return validateState(migrated.state);
}

/** Like decodeSaveResult, for callers that only need the state (the debug overlay's Load save). */
export function decodeSave(raw: string): GameState | null {
  const r = decodeSaveResult(raw);
  return r.ok ? r.state : null;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
