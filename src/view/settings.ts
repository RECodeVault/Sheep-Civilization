// The live player settings (Story 5.6): loaded once from sheepciv.settings on first use, changed only
// through updateSettings, which saves them and announces 'settings:changed' on the bus. Story 5.7's
// Volume panel edits them; the DEV debug overlay toggles captions.
import { loadSettings, saveSettings, validSettings, type Settings } from '../save/settingsStore';
import { bus } from './bus';

let current: Readonly<Settings> | null = null;

/** The current settings. The object is replaced on every change, so read it when needed. */
export function getSettings(): Readonly<Settings> {
  if (current === null) current = Object.freeze(loadSettings());
  return current;
}

/**
 * Merges `patch`, saves (a failed write keeps the change for this page), and announces the change. An
 * invalid field (NaN, out of range, undefined) keeps its current value, so live and saved settings agree.
 */
export function updateSettings(patch: Partial<Settings>): Readonly<Settings> {
  const next = Object.freeze(validSettings(patch, getSettings()));
  current = next;
  saveSettings(next);
  bus.emit('settings:changed', next);
  return next;
}
