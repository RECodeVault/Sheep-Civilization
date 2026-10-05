import { describe, expect, it } from 'vitest';
import { rng, rngInt, rngRange, seedFromNumber } from '../../src/sim/rng';

function sequence(seed: number, n: number): number[] {
  const s = { rng: seedFromNumber(seed) };
  return Array.from({ length: n }, () => rng(s));
}

describe('rng (mulberry32)', () => {
  it('matches the known-answer vector', () => {
    const s = { rng: seedFromNumber(1) };
    expect(rng(s)).toBe(0.6270739405881613);
    expect(rng(s)).toBe(0.002735721180215478);
    expect(rng(s)).toBe(0.5274470399599522);
    expect(s.rng).toBe(1199730144);
    expect(rng({ rng: seedFromNumber(42) })).toBe(0.6011037519201636);
  });

  it('repeats the same sequence for the same seed and diverges for another', () => {
    expect(sequence(7, 1000)).toEqual(sequence(7, 1000));
    expect(sequence(7, 10)).not.toEqual(sequence(8, 10));
  });

  it('returns values in [0, 1) and keeps state an unsigned 32-bit integer', () => {
    const s = { rng: seedFromNumber(-5) };
    expect(s.rng).toBe(4294967291);
    let prev = s.rng;
    for (let i = 0; i < 1000; i++) {
      const v = rng(s);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
      expect(Number.isInteger(s.rng)).toBe(true);
      expect(s.rng).toBeGreaterThanOrEqual(0);
      expect(s.rng).toBeLessThan(2 ** 32);
      expect(s.rng).not.toBe(prev);
      prev = s.rng;
    }
  });

  it('rngInt stays within inclusive bounds and hits both ends', () => {
    const s = { rng: seedFromNumber(99) };
    const seen = new Set<number>();
    for (let i = 0; i < 2000; i++) {
      const v = rngInt(s, 8, 15);
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(8);
      expect(v).toBeLessThanOrEqual(15);
      seen.add(v);
    }
    expect(seen.size).toBe(8);
  });

  it('rejects inverted or non-integer bounds', () => {
    const s = { rng: seedFromNumber(1) };
    expect(() => rngInt(s, 5, 1)).toThrow(/rngInt: bad bounds/);
    expect(() => rngInt(s, 0.5, 2)).toThrow(/rngInt: bad bounds/);
    expect(() => rngRange(s, 10, 1)).toThrow(/rngRange/);
    expect(rngInt(s, 3, 3)).toBe(3);
  });

  it('rngRange stays within [min, max)', () => {
    const s = { rng: seedFromNumber(3) };
    for (let i = 0; i < 1000; i++) {
      const v = rngRange(s, 45_000, 60_000);
      expect(v).toBeGreaterThanOrEqual(45_000);
      expect(v).toBeLessThan(60_000);
    }
  });
});
