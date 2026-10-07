import { describe, expect, it } from 'vitest';
import { SAVE_SCHEMA_VERSION } from '../../src/config/constants';
import { TUNING } from '../../src/config/tuning';
import { decodeSave, decodeSaveResult, encodeSave } from '../../src/save/saveFile';
import { newGame, runFor } from '../sim/helpers';

const NOW = new Date('2026-10-06T12:34:56.789Z');

describe('encodeSave / decodeSave', () => {
  it('round-trips a game that has been running', () => {
    const state = newGame(4242);
    runFor(state, 10_000);
    expect(decodeSave(encodeSave(state, NOW))).toStrictEqual(state);
  });

  it('round-trips a lost game with its lostAt', () => {
    const state = newGame(4242);
    runFor(state, TUNING.starveMs);
    expect(state.lostAt).toBeDefined();
    expect(decodeSave(encodeSave(state, NOW))).toStrictEqual(state);
  });

  it('decodes a version-2 save (before breeding food) with an empty bar, no pieces and nobody ready', () => {
    const state = newGame(7);
    const v2 = JSON.parse(JSON.stringify(state)) as Record<string, unknown>;
    delete v2.breedingProgress;
    delete v2.breedingPieces;
    delete v2.pregnancies;
    for (const s of v2.sheep as Record<string, unknown>[]) {
      delete s.breedReady;
      delete s.cooldownUntil;
    }
    const raw = JSON.stringify({ schemaVersion: 2, savedAt: NOW.toISOString(), state: v2 });
    expect(decodeSave(raw)).toStrictEqual(state);
  });

  it('decodes a version-3 save (before breeding) with no pregnancies and nobody on cooldown', () => {
    const state = newGame(7);
    const v3 = JSON.parse(JSON.stringify(state)) as Record<string, unknown>;
    delete v3.pregnancies;
    for (const s of v3.sheep as Record<string, unknown>[]) delete s.cooldownUntil;
    const raw = JSON.stringify({ schemaVersion: 3, savedAt: NOW.toISOString(), state: v3 });
    expect(decodeSave(raw)).toStrictEqual(state);
  });

  it('wraps the state in the versioned envelope with an ISO savedAt', () => {
    const state = newGame(7);
    const file: unknown = JSON.parse(encodeSave(state, NOW));
    expect(file).toStrictEqual({ schemaVersion: SAVE_SCHEMA_VERSION, savedAt: NOW.toISOString(), state });
  });

  it('defaults savedAt to the current time', () => {
    const file = JSON.parse(encodeSave(newGame(7))) as { savedAt: string };
    expect(new Date(file.savedAt).toISOString()).toBe(file.savedAt);
  });

  describe('rejects', () => {
    const good = JSON.parse(encodeSave(newGame(9), NOW)) as Record<string, unknown>;
    const withState = (patch: Record<string, unknown>): string =>
      JSON.stringify({ ...good, state: { ...(good.state as object), ...patch } });

    const cases: [string, string][] = [
      ['non-JSON text', 'not a save {'],
      ['an empty string', ''],
      ['null', 'null'],
      ['an array', '[]'],
      ['a number', '42'],
      ['a wrong schemaVersion', JSON.stringify({ ...good, schemaVersion: SAVE_SCHEMA_VERSION + 1 })],
      ['a pre-1.7 version 1 save', JSON.stringify({ ...good, schemaVersion: 1 })],
      ['a missing schemaVersion', JSON.stringify({ savedAt: good.savedAt, state: good.state })],
      ['a missing state', JSON.stringify({ schemaVersion: SAVE_SCHEMA_VERSION, savedAt: good.savedAt })],
      ['a state that is an array', JSON.stringify({ ...good, state: [] })],
      ['sheep that is not an array', withState({ sheep: {} })],
      ['foodPieces that is not an array', withState({ foodPieces: null })],
      ['carcasses that is not an array', withState({ carcasses: 'none' })],
      ['a string time', withState({ time: '100' })],
      ['a missing time', withState({ time: undefined })],
      ['a missing savedAt', JSON.stringify({ schemaVersion: SAVE_SCHEMA_VERSION, state: good.state })],
      ['a numeric savedAt', JSON.stringify({ ...good, savedAt: 0 })],
      ['a NaN fullness (JSON null)', withState({ sheep: [{ ...(good.state as { sheep: object[] }).sheep[0], fullness: null }] })],
      // JSON cannot carry NaN or Infinity; a huge exponent parses to Infinity.
      ['a non-finite time', JSON.stringify({ ...good, state: { ...(good.state as object), time: 0 } }).replace('"time":0', '"time":1e999')],
    ];

    it.each(cases)('%s', (_name, raw) => {
      expect(decodeSave(raw)).toBeNull();
    });
  });

  describe('decodeSaveResult', () => {
    it('returns the state of a good save', () => {
      const state = newGame(11);
      expect(decodeSaveResult(encodeSave(state, NOW))).toStrictEqual({ ok: true, state });
    });

    it('names the reason for a bad save', () => {
      const r = decodeSaveResult('not a save {');
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.reason).toMatch(/JSON/);
      const state = newGame(11);
      state.sheep[0].fullness = Number.NaN;
      const r2 = decodeSaveResult(encodeSave(state, NOW));
      expect(r2.ok).toBe(false);
      if (!r2.ok) expect(r2.reason).toContain('sheep[0].fullness');
    });
  });
});
