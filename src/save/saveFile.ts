// The versioned save envelope (architecture Data Persistence): `{ schemaVersion, savedAt, state }`.
// Pure encode/decode only; localStorage, autosave and the visibility hook arrive in Story 1.9.
// Story 1.9 replaces the shape check in decodeSave with migrate → validate (non-finite numbers,
// duplicate ids: see deferred-work.md).
import { SAVE_SCHEMA_VERSION } from '../config/constants';
import type { GameState } from '../sim/state';

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

/** Parses a save envelope; returns its state, or null for anything that is not a current-version save. */
export function decodeSave(raw: string): GameState | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isPlainObject(parsed) || parsed.schemaVersion !== SAVE_SCHEMA_VERSION) return null;
  const state = parsed.state;
  if (!isPlainObject(state)) return null;
  if (typeof state.time !== 'number' || !Number.isFinite(state.time)) return null;
  if (!Array.isArray(state.sheep) || !Array.isArray(state.foodPieces) || !Array.isArray(state.carcasses)) {
    return null;
  }
  return state as unknown as GameState;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
