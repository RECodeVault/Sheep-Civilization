import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { SAVE_KEY, SETTINGS_KEY } from '../../src/config/constants';
import {
  DEFAULT_SETTINGS,
  loadSettings,
  resetSettingsStoreForTests,
  saveSettings,
  validSettings,
  type Settings,
} from '../../src/save/settingsStore';
import { wipeSave, writeSave, type StorageLike } from '../../src/save/saveStore';
import { newGame } from '../sim/helpers';

class MemoryStorage implements StorageLike {
  readonly items = new Map<string, string>();
  getItem(key: string): string | null {
    return this.items.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.items.set(key, value);
  }
  removeItem(key: string): void {
    this.items.delete(key);
  }
}

class ThrowingStorage extends MemoryStorage {
  override getItem(): string | null {
    throw new Error('SecurityError: storage blocked');
  }
  override setItem(): void {
    throw new Error('QuotaExceededError');
  }
}

const CUSTOM: Settings = { musicVolume: 0.25, sfxVolume: 1, reducedMotion: true, captions: true };

let warn: MockInstance<typeof console.warn>;
const saveWarnings = (): number => warn.mock.calls.filter((c) => String(c[0]).startsWith('[save]')).length;

beforeEach(() => {
  resetSettingsStoreForTests();
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  warn.mockRestore();
});

describe('settingsStore (Story 5.6, UX-DR88, UX-DR89)', () => {
  it('defaults to captions off and both volumes in [0, 1]', () => {
    expect(DEFAULT_SETTINGS.captions).toBe(false);
    expect(DEFAULT_SETTINGS.reducedMotion).toBe(false);
    for (const v of [DEFAULT_SETTINGS.musicVolume, DEFAULT_SETTINGS.sfxVolume]) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
    expect(Object.isFrozen(DEFAULT_SETTINGS)).toBe(true);
  });

  it('returns the defaults when nothing is stored, and when storage is unavailable', () => {
    expect(loadSettings(new MemoryStorage())).toEqual(DEFAULT_SETTINGS);
    expect(loadSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(saveWarnings()).toBe(0);
  });

  it('round-trips through sheepciv.settings', () => {
    const storage = new MemoryStorage();
    expect(saveSettings(CUSTOM, storage)).toBe(true);
    expect(storage.items.has(SETTINGS_KEY)).toBe(true);
    expect(loadSettings(storage)).toEqual(CUSTOM);
  });

  it('returns a fresh object each load (callers may not mutate the defaults)', () => {
    const a = loadSettings(new MemoryStorage());
    expect(a).not.toBe(DEFAULT_SETTINGS);
  });

  it.each<[string, unknown]>([
    ['musicVolume', 1.5],
    ['musicVolume', -0.1],
    ['musicVolume', 'loud'],
    ['musicVolume', null],
    ['sfxVolume', 2],
    ['sfxVolume', Number.NaN],
    ['reducedMotion', 'yes'],
    ['captions', 1],
  ])('falls back for a bad %s (%s) and keeps the other fields', (field, bad) => {
    const storage = new MemoryStorage();
    storage.setItem(SETTINGS_KEY, JSON.stringify({ ...CUSTOM, [field]: bad }));
    expect(loadSettings(storage)).toEqual({ ...CUSTOM, [field]: DEFAULT_SETTINGS[field as keyof Settings] });
  });

  it('falls back per missing field (a settings file from an older build)', () => {
    const storage = new MemoryStorage();
    storage.setItem(SETTINGS_KEY, JSON.stringify({ captions: true }));
    expect(loadSettings(storage)).toEqual({ ...DEFAULT_SETTINGS, captions: true });
  });

  it.each(['not json', '[1,2]', 'null', '42'])('falls back to the defaults for %j and warns once', (raw) => {
    const storage = new MemoryStorage();
    storage.setItem(SETTINGS_KEY, raw);
    expect(loadSettings(storage)).toEqual(DEFAULT_SETTINGS);
    expect(saveWarnings()).toBe(1);
  });

  it('never throws on blocked storage', () => {
    const storage = new ThrowingStorage();
    expect(loadSettings(storage)).toEqual(DEFAULT_SETTINGS);
    expect(saveSettings(CUSTOM, storage)).toBe(false);
    expect(saveSettings(CUSTOM, storage)).toBe(false);
    // Warn once per failing streak, not on every write.
    expect(saveWarnings()).toBe(2);
  });

  it('survives Restart: wiping the save keeps the settings (UX-DR89)', () => {
    const storage = new MemoryStorage();
    saveSettings(CUSTOM, storage);
    writeSave(newGame(1), storage);
    expect(storage.items.has(SAVE_KEY)).toBe(true);
    wipeSave(storage);
    expect(storage.items.has(SAVE_KEY)).toBe(false);
    expect(loadSettings(storage)).toEqual(CUSTOM);
  });
});

describe('validSettings', () => {
  const current: Settings = { musicVolume: 0.3, sfxVolume: 0.6, reducedMotion: true, captions: false };

  it('takes every valid field', () => {
    const next = { musicVolume: 1, sfxVolume: 0, reducedMotion: false, captions: true };
    expect(validSettings(next, current)).toEqual(next);
  });

  it('keeps the fallback for NaN, out-of-range, undefined and wrong-typed fields', () => {
    const raw = { musicVolume: Number.NaN, sfxVolume: 1.5, reducedMotion: undefined, captions: 'yes' };
    expect(validSettings(raw, current)).toEqual(current);
    expect(validSettings({ sfxVolume: -0.1, musicVolume: Infinity }, current)).toEqual(current);
  });

  it('applies a partial patch over the fallback', () => {
    expect(validSettings({ captions: true }, current)).toEqual({ ...current, captions: true });
  });
});
