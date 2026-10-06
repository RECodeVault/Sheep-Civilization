import { describe, expect, it } from 'vitest';
import { SAVE_SCHEMA_VERSION } from '../../src/config/constants';
import { MIGRATIONS, migrate, type Migration } from '../../src/save/migrations';
import { newGame } from '../sim/helpers';

describe('migrate', () => {
  it('passes a current-version state through unchanged', () => {
    const state = newGame(3);
    expect(migrate(SAVE_SCHEMA_VERSION, state)).toStrictEqual({ ok: true, state });
  });

  it('has no migration from version 1 (never persisted), so a v1 save is rejected', () => {
    expect(MIGRATIONS[1]).toBeUndefined();
    const r = migrate(1, newGame(3));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain('no migration from version 1');
  });

  it('rejects a save from a newer version', () => {
    const r = migrate(SAVE_SCHEMA_VERSION + 1, newGame(3));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain('newer version');
  });

  it.each([0, -1, 1.5, Number.NaN, '2', null])('rejects the version %s', (v) => {
    expect(migrate(v as number, newGame(3)).ok).toBe(false);
  });

  it('runs the chain up to the current version', () => {
    const table: Record<number, Migration> = {
      [SAVE_SCHEMA_VERSION - 1]: (s) => ({ ...s, migrated: true }),
    };
    const r = migrate(SAVE_SCHEMA_VERSION - 1, { time: 0 }, table);
    expect(r).toStrictEqual({ ok: true, state: { time: 0, migrated: true } });
  });

  it('rejects a non-object state when a migration must run', () => {
    const table: Record<number, Migration> = { [SAVE_SCHEMA_VERSION - 1]: (s) => s };
    expect(migrate(SAVE_SCHEMA_VERSION - 1, 'nope', table).ok).toBe(false);
  });

  it('rejects with the message of a migration that throws', () => {
    const table: Record<number, Migration> = {
      [SAVE_SCHEMA_VERSION - 1]: () => {
        throw new Error('bad field');
      },
    };
    const r = migrate(SAVE_SCHEMA_VERSION - 1, { time: 0 }, table);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain('bad field');
  });
});
