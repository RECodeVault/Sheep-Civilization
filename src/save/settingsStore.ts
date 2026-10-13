// Player settings (architecture Data Persistence, UX-DR89): music and SFX volume, reduced motion and
// captions, in `sheepciv.settings`, separate from the save, so Restart and Start over keep them.
// AudioDirector reads volumes and captions (Story 5.6); the juice reads reduced motion and the Volume
// panel edits them all (Story 5.7), through view/settings.ts.
// Every storage access is wrapped, as in saveStore.ts: the game runs with storage unavailable.
import { SETTINGS_KEY } from '../config/constants';
import { log } from '../core/log';
import { defaultStorage, type StorageLike } from './saveStore';

export interface Settings {
  /** 0–1. */
  musicVolume: number;
  /** 0–1. */
  sfxVolume: number;
  reducedMotion: boolean;
  captions: boolean;
}

/**
 * Captions off by default (UX-DR88 [ASSUMPTION]). The volumes are [ASSUMPTION, tune by ear]: the music
 * sits under the SFX. Player settings, not GDD tunables, so they live here rather than in TUNING.
 */
export const DEFAULT_SETTINGS: Readonly<Settings> = Object.freeze({
  musicVolume: 0.5,
  sfxVolume: 0.8,
  reducedMotion: false,
  captions: false,
});

// A full quota or blocked storage fails on every change: warn once, then again after a success.
let writeFailing = false;

/** Test-only: resets the module's warning flag. */
export function resetSettingsStoreForTests(): void {
  writeFailing = false;
}

const isVolume = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1;
const isFlag = (v: unknown): v is boolean => typeof v === 'boolean';

/**
 * The stored settings, field by field: each valid field is kept, any other takes its default (a
 * settings file from an older build, or one edited by hand). Never throws.
 */
export function loadSettings(storage: StorageLike | null = defaultStorage()): Settings {
  const out: Settings = { ...DEFAULT_SETTINGS };
  if (storage === null) return out;
  let raw: string | null;
  try {
    raw = storage.getItem(SETTINGS_KEY);
  } catch (err) {
    log.warn('save', 'Settings unreadable; using defaults', err);
    return out;
  }
  if (raw === null) return out;
  let o: unknown;
  try {
    o = JSON.parse(raw);
  } catch {
    o = null;
  }
  if (typeof o !== 'object' || o === null || Array.isArray(o)) {
    log.warn('save', 'Settings corrupt; using defaults');
    return out;
  }
  return validSettings(o as Record<string, unknown>, out);
}

/**
 * `raw`'s fields over `fallback`, field by field: a volume must be a finite number in 0–1 and a flag a
 * boolean; anything else (missing, NaN, out of range, the wrong type) keeps the fallback's value.
 */
export function validSettings(raw: Readonly<Record<string, unknown>>, fallback: Readonly<Settings>): Settings {
  return {
    musicVolume: isVolume(raw.musicVolume) ? raw.musicVolume : fallback.musicVolume,
    sfxVolume: isVolume(raw.sfxVolume) ? raw.sfxVolume : fallback.sfxVolume,
    reducedMotion: isFlag(raw.reducedMotion) ? raw.reducedMotion : fallback.reducedMotion,
    captions: isFlag(raw.captions) ? raw.captions : fallback.captions,
  };
}

/** Writes the settings. Returns whether they were written. Never throws. */
export function saveSettings(s: Readonly<Settings>, storage: StorageLike | null = defaultStorage()): boolean {
  if (storage === null) return false;
  try {
    storage.setItem(
      SETTINGS_KEY,
      JSON.stringify({
        musicVolume: s.musicVolume,
        sfxVolume: s.sfxVolume,
        reducedMotion: s.reducedMotion,
        captions: s.captions,
      }),
    );
  } catch (err) {
    if (!writeFailing) log.warn('save', 'Settings not saved; will keep trying', err);
    writeFailing = true;
    return false;
  }
  writeFailing = false;
  return true;
}
