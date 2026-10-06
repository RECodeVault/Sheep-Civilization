// The storage boundary (architecture Data Persistence, AR9): load, write and wipe the save in
// localStorage, plus the autosave timer and the hide-save (visibility hook). Every storage access is
// wrapped: private mode, a full quota or blocked storage must never stop the game.
//
// Storage is injected (StorageLike) so tests run in Node without a DOM. Only `startAutosave` touches
// `document`, and only when called, never at import time.
import { AUTOSAVE_MS, SAVE_KEY } from '../config/constants';
import { log } from '../core/log';
import type { GameState } from '../sim/state';
import { decodeSaveResult, encodeSave } from './saveFile';
import { validateState } from './validate';

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** null when storage is unavailable. Reading `localStorage` itself can throw (sandboxed iframe, blocked cookies). */
export function defaultStorage(): StorageLike | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

// A full quota or blocked storage fails every 10 s: warn once, then again only after a success.
let writeFailing = false;

/**
 * The saved game, or null when there is none or it cannot be used. A save that cannot be read,
 * migrated or validated is logged and removed (AR9: discard, then New Game).
 */
export function loadSave(storage: StorageLike | null = defaultStorage()): GameState | null {
  if (storage === null) return null;
  let raw: string | null;
  try {
    raw = storage.getItem(SAVE_KEY);
  } catch (err) {
    log.warn('save', 'Save unreadable; starting fresh', err);
    return null;
  }
  if (raw === null) return null;
  const r = decodeSaveResult(raw);
  if (!r.ok) {
    log.warn('save', `Save unreadable; starting fresh: ${r.reason}`);
    wipeSave(storage);
    return null;
  }
  log.info('save', 'Save loaded', { sheep: r.state.sheep.length, time: r.state.time });
  return r.state;
}

/**
 * Writes the save. Validates first, along the same path a load takes, so a state that would not
 * load (NaN becomes null in JSON) never replaces the last good save. Returns whether it was written.
 */
export function writeSave(
  state: GameState,
  storage: StorageLike | null = defaultStorage(),
  now: Date = new Date(),
): boolean {
  if (storage === null) return false;
  const text = encodeSave(state, now);
  const check = validateState((JSON.parse(text) as { state: unknown }).state);
  if (!check.ok) {
    log.warn('save', `Not saving an invalid state; keeping the last save: ${check.reason}`);
    return false;
  }
  try {
    storage.setItem(SAVE_KEY, text);
  } catch (err) {
    if (!writeFailing) log.warn('save', 'Save failed; will keep trying', err);
    writeFailing = true;
    return false;
  }
  writeFailing = false;
  log.info('save', 'Autosaved', { sheep: state.sheep.length, time: state.time });
  return true;
}

/** Removes the save. Never touches the settings key (UX-DR89: Restart keeps settings). */
export function wipeSave(storage: StorageLike | null = defaultStorage()): void {
  if (storage === null) return;
  try {
    storage.removeItem(SAVE_KEY);
  } catch (err) {
    log.warn('save', 'Could not remove the save', err);
  }
}

/**
 * Autosaves every AUTOSAVE_MS of real time and whenever the tab is hidden (FR40). `getState` is read
 * on every save, so it always sees the scene's current state. Returns an idempotent stop().
 */
export function startAutosave(getState: () => GameState, storage: StorageLike | null = defaultStorage()): () => void {
  const save = (): void => {
    try {
      writeSave(getState(), storage);
    } catch (err) {
      // Timer and DOM callbacks must never throw into the page.
      log.warn('save', 'Autosave failed', err);
    }
  };
  // While hidden nothing changes, and the hide handler has already saved.
  const onTimer = (): void => {
    if (!document.hidden) save();
  };
  // visibilitychange → hidden also fires on tab close and navigation: the last reliable chance.
  const onVisibility = (): void => {
    if (document.hidden) save();
  };
  const timer = setInterval(onTimer, AUTOSAVE_MS);
  document.addEventListener('visibilitychange', onVisibility);
  let stopped = false;
  return () => {
    if (stopped) return;
    stopped = true;
    clearInterval(timer);
    document.removeEventListener('visibilitychange', onVisibility);
  };
}
