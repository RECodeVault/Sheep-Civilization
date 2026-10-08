import { describe, expect, it } from 'vitest';
import { SAVE_SCHEMA_VERSION, TICK_MS } from '../../src/config/constants';
import { TUNING } from '../../src/config/tuning';
import { normalizeTuned } from '../../src/save/normalize';
import { validateState } from '../../src/save/validate';
import { decodeSaveResult, encodeSave } from '../../src/save/saveFile';
import type { GameState } from '../../src/sim/state';
import { runFor } from '../sim/helpers';
import { busyGame, isBusy } from './busy';

// Story 3.6 (deferred 2.8 "Validation bounds follow live tuning"): a save made under older, larger
// tuning values must still load after a retune lowers them. Each case writes a value the live TUNING
// would reject (as a bigger old value would have produced) and checks the load clamps it instead.

type Raw = Record<string, unknown> & { sheep: Record<string, unknown>[]; pregnancies: Record<string, unknown>[] };

function busyRaw(): Raw {
  const state = busyGame();
  expect(isBusy(state)).toBe(true);
  return JSON.parse(JSON.stringify(state)) as Raw;
}

function envelope(state: unknown): string {
  return JSON.stringify({ schemaVersion: SAVE_SCHEMA_VERSION, savedAt: '2026-10-08T12:00:00.000Z', state });
}

function load(raw: Raw): GameState {
  const r = decodeSaveResult(envelope(raw));
  if (!r.ok) throw new Error(`expected the save to load, got: ${r.reason}`);
  return r.state;
}

describe('normalizeTuned: a retune never loses a save (AC 7)', () => {
  it('clamps a Farm bar fuller than the current bar size to its last pip', () => {
    const raw = busyRaw();
    raw.farmProgress = TUNING.farmPipsPerFood + 3;
    expect(load(raw).farmProgress).toBe(TUNING.farmPipsPerFood - 1);
  });

  it('clamps a breeding bar fuller than the current bar size to its last pip', () => {
    const raw = busyRaw();
    raw.breedingProgress = TUNING.breedingPipsPerFood + 3;
    expect(load(raw).breedingProgress).toBe(TUNING.breedingPipsPerFood - 1);
  });

  it('clamps a boost further ahead than boostMs', () => {
    const raw = busyRaw();
    const time = raw.time as number;
    raw.boostUntil = time + TUNING.boostMs * 2;
    expect(load(raw).boostUntil).toBe(time + TUNING.boostMs);
  });

  it('clamps a breeding cooldown further ahead than breedCooldownMs', () => {
    const raw = busyRaw();
    const time = raw.time as number;
    raw.sheep[3].cooldownUntil = time + TUNING.breedCooldownMs * 2;
    expect(load(raw).sheep[3].cooldownUntil).toBe(time + TUNING.breedCooldownMs);
  });

  it('clamps a pregnancy due further ahead than gestationMs', () => {
    const raw = busyRaw();
    const time = raw.time as number;
    raw.pregnancies[0].dueAt = time + TUNING.gestationMs * 2;
    expect(load(raw).pregnancies[0].dueAt).toBe(time + TUNING.gestationMs);
  });

  it('clamps a Fullness above fullnessMax', () => {
    const raw = busyRaw();
    raw.sheep[0].fullness = TUNING.fullnessMax + 20;
    expect(load(raw).sheep[0].fullness).toBe(TUNING.fullnessMax);
  });

  it('keeps an infection past a shorter virus death, which then kills on the first tick', () => {
    const raw = busyRaw();
    const i = raw.sheep.findIndex((s) => 'infectedAt' in s);
    expect(i).toBeGreaterThanOrEqual(0);
    // As if the save was made under a longer virus: the clock is well past this infection's death now.
    const time = (raw.sheep[i].infectedAt as number) + TUNING.virusDeathMs * 2;
    raw.time = time;
    const state = load(raw);
    const inf = state.sheep[i].infectedAt as number;
    // Still infected and still saved; the deadline is due before the next tick's time.
    expect(inf + TUNING.virusDeathMs).toBeGreaterThan(time);
    expect(inf + TUNING.virusDeathMs).toBeLessThanOrEqual(time + TICK_MS);
    const id = state.sheep[i].id;
    const events = runFor(state, TICK_MS);
    expect(events).toContainEqual(expect.objectContaining({ type: 'SheepDied', id, cause: 'virus' }));
  });

  it('leaves a save already inside every bound unchanged', () => {
    const state = busyGame();
    const r = decodeSaveResult(encodeSave(state));
    expect(r.ok && r.state).toStrictEqual(state);
  });

  describe('a retuned Abomination spawn window (Story 4.1, code review)', () => {
    const MIN = TUNING.abominationGuaranteedBirthMin;
    const MAX = TUNING.abominationGuaranteedBirthMax;
    const loadWith = (birthsSeen: number, guaranteedAtBirth: number): number => {
      const raw = busyRaw();
      raw.abomination = { birthsSeen, guaranteedAtBirth };
      return load(raw).abomination.guaranteedAtBirth;
    };

    it('moves a pending guaranteed birth into the window', () => {
      expect(loadWith(0, MAX + 5)).toBe(MAX);
      expect(loadWith(0, MIN - 3)).toBe(MIN);
    });

    it('never moves a pending one to a birth already counted, so it still comes', () => {
      // Clamped down to MAX would be behind birth MAX + 1 and never come: the next birth is it.
      expect(loadWith(MAX + 1, MAX + 5)).toBe(MAX + 2);
      // Clamped up stays above the count.
      expect(loadWith(MIN, MIN + 1)).toBe(MIN + 1);
    });

    it('never moves one already passed, so there is no second guaranteed spawn', () => {
      expect(loadWith(MIN - 1, MIN - 2)).toBe(MIN - 2);
      expect(loadWith(MAX + 10, MAX + 5)).toBe(MAX + 5);
      expect(loadWith(MIN, MIN)).toBe(MIN);
    });
  });

  it('never repairs a malformed value: those still fail validation', () => {
    for (const [field, bad] of [
      ['farmProgress', 1.5],
      ['farmProgress', -1],
      ['boostUntil', 'soon'],
      ['breedingProgress', null],
      ['abomination', { birthsSeen: 0, guaranteedAtBirth: 'soon' }],
    ] as const) {
      const raw = busyRaw();
      raw[field] = bad;
      expect(decodeSaveResult(envelope(raw)).ok, `${field} = ${String(bad)}`).toBe(false);
    }
  });

  it('leaves NaN and Infinity alone for validation to reject (JSON cannot carry them, so straight in)', () => {
    for (const bad of [Number.NaN, Number.POSITIVE_INFINITY]) {
      const raw = busyRaw();
      raw.breedingProgress = bad;
      raw.sheep[3].cooldownUntil = bad;
      normalizeTuned(raw);
      expect(Object.is(raw.breedingProgress, bad)).toBe(true);
      expect(Object.is(raw.sheep[3].cooldownUntil, bad)).toBe(true);
      expect(validateState(raw).ok).toBe(false);
    }
  });

  it('does nothing to a non-object or to missing fields (validation reports those)', () => {
    expect(() => normalizeTuned(null)).not.toThrow();
    expect(() => normalizeTuned({ sheep: 'x', pregnancies: [null] })).not.toThrow();
  });
});
