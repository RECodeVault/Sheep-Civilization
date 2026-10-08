import { describe, expect, it } from 'vitest';
import { SAVE_SCHEMA_VERSION } from '../../src/config/constants';
import { MIGRATIONS, migrate, type Migration } from '../../src/save/migrations';
import { validateState } from '../../src/save/validate';
import { TUNING } from '../../src/config/tuning';
import { newGame } from '../sim/helpers';
import { busyGame } from './busy';
import { migratedFrom8 } from './fromVersion8';

/** A JSON copy of a current-version state in the version-8 shape (before Story 4.1's Abomination). */
function toVersion8(state: object): Record<string, unknown> {
  const v8 = JSON.parse(JSON.stringify(state)) as Record<string, unknown>;
  delete v8.abomination;
  for (const s of v8.sheep as Record<string, unknown>[]) delete s.isAbomination;
  return v8;
}

/** A JSON copy of a current-version state in the version-7 shape (before Story 3.2's shop). */
function toVersion7(state: object): Record<string, unknown> {
  const v7 = toVersion8(state);
  delete v7.owned;
  return v7;
}

/** A JSON copy of a current-version state in the version-6 shape (before Story 3.1's money). */
function toVersion6(state: object): Record<string, unknown> {
  const v6 = toVersion7(state);
  delete v6.money;
  return v6;
}

/** A JSON copy of a current-version state in the version-5 shape (before Story 2.8's boost). */
function toVersion5(state: object): Record<string, unknown> {
  const v5 = toVersion6(state);
  delete v5.boostUntil;
  return v5;
}

/** A JSON copy of a current-version state in the version-3 shape (before Story 2.3's breeding fields). */
function toVersion3(state: object): Record<string, unknown> {
  const v3 = toVersion5(state);
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
    expect(r.state).toStrictEqual(migratedFrom8(state));
    expect(validateState(r.state).ok).toBe(true);
  });

  it('migrates a version-3 state (before breeding) with no pregnancies and nobody on cooldown', () => {
    const state = newGame(3);
    const r = migrate(3, toVersion3(state));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state).toStrictEqual(migratedFrom8(state));
    expect(validateState(r.state).ok).toBe(true);
  });

  it('migrates a version-4 state (before the virus) unchanged: nobody infected, nobody seeking a carcass', () => {
    const state = newGame(3);
    const v4 = toVersion5(state);
    const r = migrate(4, v4);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state).toStrictEqual(migratedFrom8(state));
    expect(validateState(r.state).ok).toBe(true);
  });

  it('migrates a version-5 state (before the boost) with no boost running', () => {
    const state = newGame(3);
    const r = migrate(5, toVersion5(state));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state).toStrictEqual({ ...migratedFrom8(state), boostUntil: 0 });
    expect(validateState(r.state).ok).toBe(true);
  });

  it('migrates a version-6 state (before selling) with no money', () => {
    const state = newGame(3);
    const r = migrate(6, toVersion6(state));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state).toStrictEqual({ ...migratedFrom8(state), money: 0 });
    expect(validateState(r.state).ok).toBe(true);
  });

  it('migrates a version-7 state (before the shop) owning nothing', () => {
    const state = newGame(3);
    const r = migrate(7, toVersion7(state));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state).toStrictEqual({ ...migratedFrom8(state), owned: [] });
    expect(validateState(r.state).ok).toBe(true);
  });

  it('migrates a version-8 state (before the Abomination): nobody is one, births from 0, a roll in the window', () => {
    const state = busyGame();
    for (const s of state.sheep) s.isAbomination = false;
    const v8 = toVersion8(state);
    const r = migrate(8, v8);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const out = r.state as typeof state;
    expect(out).toStrictEqual(migratedFrom8(state));
    expect(out.sheep.every((s) => s.isAbomination === false)).toBe(true);
    expect(out.abomination.birthsSeen).toBe(0);
    expect(out.abomination.guaranteedAtBirth).toBeGreaterThanOrEqual(TUNING.abominationGuaranteedBirthMin);
    expect(out.abomination.guaranteedAtBirth).toBeLessThanOrEqual(TUNING.abominationGuaranteedBirthMax);
    expect(out.rng).not.toBe(state.rng);
    expect(validateState(out).ok).toBe(true);
    // Deterministic: the same save migrates the same way, and the input is not mutated.
    expect(migrate(8, toVersion8(state))).toStrictEqual(r);
    expect(v8).toStrictEqual(toVersion8(state));
  });

  it('leaves a malformed version-8 rng and sheep list for validation to reject', () => {
    const r = migrate(8, { ...toVersion8(newGame(3)), rng: 'x', sheep: 'nope' });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const out = r.state as Record<string, unknown>;
    expect(out.rng).toBe('x');
    expect(out.sheep).toBe('nope');
    expect(out.abomination).toStrictEqual({ birthsSeen: 0, guaranteedAtBirth: TUNING.abominationGuaranteedBirthMax });
    expect(validateState(out).ok).toBe(false);
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
