import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { SAVE_KEY, SAVE_SCHEMA_VERSION, SETTINGS_KEY } from '../../src/config/constants';
import { encodeSave } from '../../src/save/saveFile';
import { loadSave, wipeSave, writeSave, type StorageLike } from '../../src/save/saveStore';
import { newGame } from '../sim/helpers';
import { busyGame } from './busy';

const NOW = new Date('2026-10-06T08:00:00.000Z');

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

/** Each method throws while its flag is set, like blocked storage or a full quota. */
class ThrowingStorage extends MemoryStorage {
  failGet = false;
  failSet = false;
  failRemove = false;
  override getItem(key: string): string | null {
    if (this.failGet) throw new Error('SecurityError: storage blocked');
    return super.getItem(key);
  }
  override setItem(key: string, value: string): void {
    if (this.failSet) throw new Error('QuotaExceededError');
    super.setItem(key, value);
  }
  override removeItem(key: string): void {
    if (this.failRemove) throw new Error('SecurityError: storage blocked');
    super.removeItem(key);
  }
}

/** console.warn is the log sink for log.warn; count only the [save] lines. */
let warn: MockInstance<typeof console.warn>;
const saveWarnings = (): number => warn.mock.calls.filter((c) => String(c[0]).startsWith('[save]')).length;

beforeEach(() => {
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'info').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('writeSave / loadSave', () => {
  it('writes the versioned envelope and loads the same state back', () => {
    const storage = new MemoryStorage();
    const state = busyGame();
    expect(writeSave(state, storage, NOW)).toBe(true);
    const stored = JSON.parse(storage.items.get(SAVE_KEY) ?? 'null') as Record<string, unknown>;
    expect(stored).toStrictEqual({ schemaVersion: SAVE_SCHEMA_VERSION, savedAt: NOW.toISOString(), state });
    expect(loadSave(storage)).toStrictEqual(state);
    expect(saveWarnings()).toBe(0);
  });

  it('returns null with no warning when there is no save', () => {
    expect(loadSave(new MemoryStorage())).toBeNull();
    expect(saveWarnings()).toBe(0);
  });

  const bad: [string, string][] = [
    ['garbage', 'not json {'],
    ['an empty object', '{}'],
    ['a version 1 save', encodeSave(newGame(2)).replace(`"schemaVersion":${SAVE_SCHEMA_VERSION}`, '"schemaVersion":1')],
    ['a NaN field', encodeSave(newGame(2)).replace('"fullness":60', '"fullness":null')],
  ];

  it.each(bad)('discards %s: warns once, removes the key, returns null', (_name, raw) => {
    const storage = new MemoryStorage();
    storage.setItem(SAVE_KEY, raw);
    storage.setItem(SETTINGS_KEY, '{"music":0.5}');
    expect(loadSave(storage)).toBeNull();
    expect(saveWarnings()).toBe(1);
    expect(storage.items.has(SAVE_KEY)).toBe(false);
    expect(storage.items.get(SETTINGS_KEY)).toBe('{"music":0.5}');
  });

  it('falls back when reading throws, even if removing throws too', () => {
    const storage = new ThrowingStorage();
    storage.setItem(SAVE_KEY, encodeSave(newGame(2)));
    storage.failGet = true;
    storage.failRemove = true;
    expect(() => loadSave(storage)).not.toThrow();
    expect(loadSave(storage)).toBeNull();
    expect(saveWarnings()).toBeGreaterThan(0);
  });

  it('warns once on repeated write failures and re-arms after a success', () => {
    const storage = new ThrowingStorage();
    storage.failSet = true;
    const state = newGame(2);
    expect(writeSave(state, storage)).toBe(false);
    expect(writeSave(state, storage)).toBe(false);
    expect(saveWarnings()).toBe(1);
    storage.failSet = false;
    expect(writeSave(state, storage)).toBe(true);
    storage.failSet = true;
    expect(writeSave(state, storage)).toBe(false);
    expect(saveWarnings()).toBe(2);
  });

  it('refuses to write an invalid state and keeps the earlier save', () => {
    const storage = new MemoryStorage();
    const good = newGame(2);
    writeSave(good, storage, NOW);
    const before = storage.items.get(SAVE_KEY);
    const broken = newGame(2);
    broken.sheep[0].fullness = Number.NaN;
    expect(writeSave(broken, storage)).toBe(false);
    expect(storage.items.get(SAVE_KEY)).toBe(before);
    expect(saveWarnings()).toBe(1);
  });

  it('copes with no storage at all', () => {
    expect(loadSave(null)).toBeNull();
    expect(writeSave(newGame(2), null)).toBe(false);
    expect(() => wipeSave(null)).not.toThrow();
  });
});

describe('wipeSave', () => {
  it('removes the save and keeps the settings (UX-DR89)', () => {
    const storage = new MemoryStorage();
    storage.setItem(SETTINGS_KEY, '{"captions":true}');
    writeSave(newGame(2), storage);
    wipeSave(storage);
    expect(storage.items.has(SAVE_KEY)).toBe(false);
    expect(storage.items.get(SETTINGS_KEY)).toBe('{"captions":true}');
    expect(loadSave(storage)).toBeNull();
  });

  it('never throws when removing fails', () => {
    const storage = new ThrowingStorage();
    storage.failRemove = true;
    expect(() => wipeSave(storage)).not.toThrow();
  });
});
