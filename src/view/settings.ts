// The live player settings (Story 5.6): loaded once from sheepciv.settings on first use, changed only
// through updateSettings, which saves them and announces 'settings:changed' on the bus. Story 5.7's
// Volume panel edits them (live while a slider drags, saved on release); the DEV debug overlay
// toggles captions and reduced motion.
import { loadSettings, saveSettings, validSettings, type Settings } from '../save/settingsStore';
import { bus } from './bus';

let current: Readonly<Settings> | null = null;
// A live change not saved yet (a slider mid-drag). Saved when the page is hidden or goes (as saveStore
// does: mobile browsers may discard a hidden tab without `pagehide`), so closing the tab before the
// release keeps it. The listeners are added on the first unsaved change, once per page.
let unsaved = false;
let flushHooked = false;

function flushUnsaved(): void {
  if (!unsaved || current === null) return;
  // A failed write (full quota, blocked storage) stays unsaved, for the next hide or release.
  unsaved = !saveSettings(current);
}

function onVisibility(): void {
  if (document.visibilityState === 'hidden') flushUnsaved();
}

/** The current settings. The object is replaced on every change, so read it when needed. */
export function getSettings(): Readonly<Settings> {
  if (current === null) current = Object.freeze(loadSettings());
  return current;
}

/**
 * Reduced motion (UX-DR84): juice moves less (fades or instant changes), gameplay animation never.
 * A property read with no allocation, so frame code may call it; read it when an effect starts.
 */
export function reducedMotion(): boolean {
  return getSettings().reducedMotion;
}

export interface UpdateOptions {
  /**
   * Write `sheepciv.settings` (default true). False applies and announces the change only: a slider
   * drag updates live on every move and saves once on release (no storage writes per pointer move), or
   * when the page is hidden or goes before the release.
   */
  persist?: boolean;
}

/**
 * Merges `patch`, saves (a failed write keeps the change for this page), and announces the change. An
 * invalid field (NaN, out of range, undefined) keeps its current value, so live and saved settings agree.
 */
export function updateSettings(patch: Partial<Settings>, { persist = true }: UpdateOptions = {}): Readonly<Settings> {
  const next = Object.freeze(validSettings(patch, getSettings()));
  current = next;
  if (persist) {
    unsaved = false;
    saveSettings(next);
  } else {
    unsaved = true;
    if (!flushHooked && typeof window !== 'undefined') {
      flushHooked = true;
      window.addEventListener('pagehide', flushUnsaved);
      if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVisibility);
    }
  }
  bus.emit('settings:changed', next);
  return next;
}
