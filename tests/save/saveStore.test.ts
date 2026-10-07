import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { AUTOSAVE_MS, SAVE_BACKUP_KEY, SAVE_KEY, SAVE_SCHEMA_VERSION, SETTINGS_KEY } from '../../src/config/constants';
import { encodeSave } from '../../src/save/saveFile';
import {
  allowSaving,
  blockSaving,
  discardSave,
  isSavingBlocked,
  loadSave,
  resetSaveStoreForTests,
  startAutosave,
  wipeSave,
  writeSave,
  type StorageLike,
} from '../../src/save/saveStore';
import type { GameState } from '../../src/sim/state';
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
  resetSaveStoreForTests();
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

  it('saves mid-drag: the dragged sheep loads back wandering, and the live state keeps its drag', () => {
    const storage = new MemoryStorage();
    const state = busyGame();
    state.sheep[0].activity = 'dragged';
    delete state.sheep[0].targetId;
    expect(writeSave(state, storage, NOW)).toBe(true);
    expect(state.sheep[0].activity).toBe('dragged');
    expect(loadSave(storage)?.sheep[0].activity).toBe('wander');
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

  it.each(bad)('discards %s: warns once, backs it up, removes the key, returns null', (_name, raw) => {
    const storage = new MemoryStorage();
    storage.setItem(SAVE_KEY, raw);
    storage.setItem(SETTINGS_KEY, '{"music":0.5}');
    expect(loadSave(storage)).toBeNull();
    expect(saveWarnings()).toBe(1);
    expect(storage.items.has(SAVE_KEY)).toBe(false);
    expect(storage.items.get(SAVE_BACKUP_KEY)).toBe(raw);
    expect(storage.items.get(SETTINGS_KEY)).toBe('{"music":0.5}');
  });

  it('discards a newer-version save too, keeping the backup', () => {
    const storage = new MemoryStorage();
    const raw = encodeSave(newGame(2)).replace(`"schemaVersion":${SAVE_SCHEMA_VERSION}`, `"schemaVersion":${SAVE_SCHEMA_VERSION + 1}`);
    storage.setItem(SAVE_KEY, raw);
    expect(loadSave(storage)).toBeNull();
    expect(storage.items.get(SAVE_BACKUP_KEY)).toBe(raw);
    expect(warn.mock.calls.some((c) => String(c[0]).includes('newer version'))).toBe(true);
  });

  it('keeps the save when reading throws (a transient failure must not destroy progress)', () => {
    const storage = new ThrowingStorage();
    const raw = encodeSave(newGame(2));
    storage.setItem(SAVE_KEY, raw);
    storage.failGet = true;
    expect(loadSave(storage)).toBeNull();
    expect(saveWarnings()).toBe(1);
    expect(storage.items.get(SAVE_KEY)).toBe(raw);
  });

  it('does not throw when a rejected save cannot be backed up or removed', () => {
    const storage = new ThrowingStorage();
    storage.setItem(SAVE_KEY, 'not json {');
    storage.failSet = true;
    storage.failRemove = true;
    expect(() => loadSave(storage)).not.toThrow();
    expect(loadSave(storage)).toBeNull();
    expect(storage.items.get(SAVE_KEY)).toBe('not json {');
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

  it('refuses to write an invalid state, keeps the earlier save and warns once until a success', () => {
    const storage = new MemoryStorage();
    const good = newGame(2);
    writeSave(good, storage, NOW);
    const before = storage.items.get(SAVE_KEY);
    const broken = newGame(2);
    broken.sheep[0].fullness = Number.NaN;
    expect(writeSave(broken, storage)).toBe(false);
    expect(writeSave(broken, storage)).toBe(false);
    expect(storage.items.get(SAVE_KEY)).toBe(before);
    expect(saveWarnings()).toBe(1);
    expect(writeSave(good, storage)).toBe(true);
    expect(writeSave(broken, storage)).toBe(false);
    expect(saveWarnings()).toBe(2);
  });

  it('refuses a state that JSON cannot encode, without throwing', () => {
    const storage = new MemoryStorage();
    const cyclic = newGame(2) as GameState & { self?: unknown };
    cyclic.self = cyclic;
    expect(() => writeSave(cyclic, storage)).not.toThrow();
    expect(writeSave(cyclic, storage)).toBe(false);
    expect(storage.items.has(SAVE_KEY)).toBe(false);
  });

  it('writes nothing while saving is blocked, and again once allowed', () => {
    const storage = new MemoryStorage();
    writeSave(newGame(2), storage, NOW);
    const before = storage.items.get(SAVE_KEY);
    expect(isSavingBlocked()).toBe(false);
    blockSaving('test');
    expect(isSavingBlocked()).toBe(true);
    blockSaving('test again');
    expect(writeSave(newGame(3), storage)).toBe(false);
    expect(storage.items.get(SAVE_KEY)).toBe(before);
    expect(saveWarnings()).toBe(1);
    allowSaving();
    expect(isSavingBlocked()).toBe(false);
    expect(writeSave(newGame(3), storage)).toBe(true);
    expect(storage.items.get(SAVE_KEY)).not.toBe(before);
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

describe('discardSave', () => {
  it('backs up the stored save when no raw text is given, then removes it', () => {
    const storage = new MemoryStorage();
    writeSave(newGame(2), storage, NOW);
    const raw = storage.items.get(SAVE_KEY);
    discardSave(storage);
    expect(storage.items.has(SAVE_KEY)).toBe(false);
    expect(storage.items.get(SAVE_BACKUP_KEY)).toBe(raw);
  });

  it('copes with no storage', () => {
    expect(() => discardSave(null)).not.toThrow();
  });
});

describe('startAutosave', () => {
  /** A stand-in for `document`: Vitest runs in Node, which has EventTarget but no DOM. */
  class FakeDocument extends EventTarget {
    hidden = false;
  }
  let doc: FakeDocument;

  beforeEach(() => {
    vi.useFakeTimers();
    doc = new FakeDocument();
    vi.stubGlobal('document', doc);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  const hide = (hidden: boolean): void => {
    doc.hidden = hidden;
    doc.dispatchEvent(new Event('visibilitychange'));
  };
  const savedTime = (storage: MemoryStorage): number | undefined => {
    const raw = storage.items.get(SAVE_KEY);
    return raw === undefined ? undefined : (JSON.parse(raw) as { state: GameState }).state.time;
  };

  it('saves every AUTOSAVE_MS, reading the current state each time', () => {
    const storage = new MemoryStorage();
    let state = newGame(2);
    const stop = startAutosave(() => state, storage);
    expect(storage.items.has(SAVE_KEY)).toBe(false);
    vi.advanceTimersByTime(AUTOSAVE_MS);
    expect(savedTime(storage)).toBe(0);
    state = newGame(3);
    state.time = 5_000;
    vi.advanceTimersByTime(AUTOSAVE_MS);
    expect(savedTime(storage)).toBe(5_000);
    stop();
  });

  it('saves at once on hide, and skips timer saves while hidden', () => {
    const storage = new MemoryStorage();
    const state = newGame(2);
    const stop = startAutosave(() => state, storage);
    hide(true);
    expect(savedTime(storage)).toBe(0);
    storage.items.delete(SAVE_KEY);
    vi.advanceTimersByTime(AUTOSAVE_MS * 3);
    expect(storage.items.has(SAVE_KEY)).toBe(false);
    hide(false);
    expect(storage.items.has(SAVE_KEY)).toBe(false);
    vi.advanceTimersByTime(AUTOSAVE_MS);
    expect(savedTime(storage)).toBe(0);
    stop();
  });

  it('stop() ends the timer and the hide listener, and is idempotent', () => {
    const storage = new MemoryStorage();
    const state = newGame(2);
    const stop = startAutosave(() => state, storage);
    stop();
    stop();
    vi.advanceTimersByTime(AUTOSAVE_MS * 2);
    hide(true);
    expect(storage.items.has(SAVE_KEY)).toBe(false);
  });

  it('never throws out of a timer when getState throws', () => {
    const stop = startAutosave(() => {
      throw new Error('scene gone');
    }, new MemoryStorage());
    expect(() => vi.advanceTimersByTime(AUTOSAVE_MS)).not.toThrow();
    expect(saveWarnings()).toBe(1);
    stop();
  });
});
