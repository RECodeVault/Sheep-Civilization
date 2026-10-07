import { describe, expect, it } from 'vitest';
import { SAVE_SCHEMA_VERSION } from '../../src/config/constants';
import { MIGRATIONS, migrate, type Migration } from '../../src/save/migrations';
import { validateState } from '../../src/save/validate';
import { newGame } from '../sim/helpers';

/** A JSON copy of a current-version state in the version-3 shape (before Story 2.3's breeding fields). */
function toVersion3(state: object): Record<string, unknown> {
  const v3 = JSON.parse(JSON.stringify(state)) as Record<string, unknown>;
  delete v3.pregnancies;
  for (const s of v3.sheep as Record<string, unknown>[]) delete s.cooldownUntil;
  return v3;
}

/** A JSON copy of a current-version state in the version-2 shape (before Story 2.2's breeding fields). */
function toVersion2(state: object): Record<string, unknown> {
  const v2 = toVersion3(state);
  delete v2.breedingProgress;
  delete v2.breedingPieces;
  for (const s of v2.sheep as Record<string, unknown>[]) delete s.breedReady;
  return v2;
}

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

  it('migrates a version-2 state (before breeding food) with an empty bar, no pieces and nobody ready', () => {
    const state = newGame(3);
    const r = migrate(2, toVersion2(state));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state).toStrictEqual(state);
    expect(validateState(r.state).ok).toBe(true);
  });

  it('migrates a version-3 state (before breeding) with no pregnancies and nobody on cooldown', () => {
    const state = newGame(3);
    const r = migrate(3, toVersion3(state));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state).toStrictEqual(state);
    expect(validateState(r.state).ok).toBe(true);
  });

  it('migrates a version-4 state (before the virus) unchanged: nobody infected, nobody seeking a carcass', () => {
    const state = newGame(3);
    const v4 = JSON.parse(JSON.stringify(state)) as Record<string, unknown>;
    const r = migrate(4, v4);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state).toStrictEqual(state);
    expect(validateState(r.state).ok).toBe(true);
  });

  it('leaves a non-array sheep in a version-3 state for validation to reject', () => {
    const r = migrate(3, { time: 0, sheep: 'nope' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(validateState(r.state).ok).toBe(false);
  });

  it('leaves a non-array sheep in a version-2 state for validation to reject', () => {
    const r = migrate(2, { time: 0, sheep: 'nope' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(validateState(r.state).ok).toBe(false);
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
