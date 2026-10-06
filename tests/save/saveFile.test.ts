import { describe, expect, it } from 'vitest';
import { SAVE_SCHEMA_VERSION } from '../../src/config/constants';
import { decodeSave, encodeSave } from '../../src/save/saveFile';
import { newGame, runFor } from '../sim/helpers';

const NOW = new Date('2026-10-06T12:34:56.789Z');

describe('encodeSave / decodeSave', () => {
  it('round-trips a game that has been running', () => {
    const state = newGame(4242);
    runFor(state, 10_000);
    expect(decodeSave(encodeSave(state, NOW))).toStrictEqual(state);
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
      ['a missing schemaVersion', JSON.stringify({ savedAt: good.savedAt, state: good.state })],
      ['a missing state', JSON.stringify({ schemaVersion: SAVE_SCHEMA_VERSION, savedAt: good.savedAt })],
      ['a state that is an array', JSON.stringify({ ...good, state: [] })],
      ['sheep that is not an array', withState({ sheep: {} })],
      ['foodPieces that is not an array', withState({ foodPieces: null })],
      ['carcasses that is not an array', withState({ carcasses: 'none' })],
      ['a string time', withState({ time: '100' })],
      ['a missing time', withState({ time: undefined })],
      // JSON cannot carry NaN or Infinity; a huge exponent parses to Infinity.
      ['a non-finite time', JSON.stringify({ ...good, state: { ...(good.state as object), time: 0 } }).replace('"time":0', '"time":1e999')],
    ];

    it.each(cases)('%s', (_name, raw) => {
      expect(decodeSave(raw)).toBeNull();
    });
  });
});
