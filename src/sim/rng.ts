// Seeded mulberry32 PRNG. Its whole state is one unsigned 32-bit integer kept in `state.rng`, so a
// save resumes the exact same random sequence. Every random draw in the sim goes through here.
import { invariant } from '../core/invariant';

/** Normalises any number to a valid rng state (an unsigned 32-bit integer). */
export function seedFromNumber(n: number): number {
  return n >>> 0;
}

/** Next float in [0, 1); advances `state.rng`. */
export function rng(state: { rng: number }): number {
  let t = (state.rng = (state.rng + 0x6d2b79f5) >>> 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** Float in [min, max). */
export function rngRange(state: { rng: number }, min: number, max: number): number {
  invariant(min <= max, `rngRange: min ${min} > max ${max}`);
  return min + rng(state) * (max - min);
}

/** Integer in [min, maxInclusive]. */
export function rngInt(state: { rng: number }, min: number, maxInclusive: number): number {
  invariant(
    Number.isInteger(min) && Number.isInteger(maxInclusive) && min <= maxInclusive,
    `rngInt: bad bounds [${min}, ${maxInclusive}]`,
  );
  return min + Math.floor(rng(state) * (maxInclusive - min + 1));
}
