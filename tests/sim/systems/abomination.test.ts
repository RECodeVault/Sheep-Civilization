import { describe, expect, it } from 'vitest';
import { TUNING } from '../../../src/config/tuning';
import { drainEvents } from '../../../src/sim/events';
import { createNewGame, createSheep, type GameState, type Sheep } from '../../../src/sim/state';
import { abominationAlive, onBirth } from '../../../src/sim/systems/abomination';
import { newGame } from '../helpers';

const MIN = TUNING.abominationGuaranteedBirthMin;
const MAX = TUNING.abominationGuaranteedBirthMax;

/** A newborn lamb beside the first founder, as lifecycle's births() makes one (without onBirth). */
function lamb(state: GameState): Sheep {
  const f = state.sheep[0];
  return createSheep(state, { x: f.x, y: f.y, bornAt: state.time });
}

/** Runs `n` births through onBirth and returns the lambs flagged as the Abomination. */
function births(state: GameState, n: number): Sheep[] {
  const flagged: Sheep[] = [];
  for (let i = 0; i < n; i++) {
    const s = lamb(state);
    onBirth(state, s);
    if (s.isAbomination) flagged.push(s);
  }
  return flagged;
}

describe('the spawn window (FR29, AC 1)', () => {
  it('starts with no births seen and a guaranteed birth in [min, max] for every seed, covering both ends', () => {
    const seen = new Set<number>();
    for (let seed = 1; seed <= 200; seed++) {
      const a = createNewGame(seed).abomination;
      expect(a.birthsSeen).toBe(0);
      expect(Number.isInteger(a.guaranteedAtBirth)).toBe(true);
      expect(a.guaranteedAtBirth).toBeGreaterThanOrEqual(MIN);
      expect(a.guaranteedAtBirth).toBeLessThanOrEqual(MAX);
      seen.add(a.guaranteedAtBirth);
    }
    for (let g = MIN; g <= MAX; g++) expect(seen.has(g)).toBe(true);
  });

  it('starts with no Abomination in the founding flock', () => {
    const state = newGame();
    expect(state.sheep.every((s) => s.isAbomination === false)).toBe(true);
    expect(abominationAlive(state)).toBe(false);
  });
});

describe('onBirth (FR29, AC 2)', () => {
  it('counts every birth and flags nothing, drawing no rng, before the guaranteed birth', () => {
    const state = newGame(7);
    const g = state.abomination.guaranteedAtBirth;
    for (let i = 1; i < g; i++) {
      const s = lamb(state);
      const rngBefore = state.rng;
      onBirth(state, s);
      expect(state.rng).toBe(rngBefore);
      expect(s.isAbomination).toBe(false);
      expect(state.abomination.birthsSeen).toBe(i);
    }
  });

  it('flags the guaranteed birth', () => {
    const state = newGame(7);
    const g = state.abomination.guaranteedAtBirth;
    births(state, g - 1);
    const s = lamb(state);
    const rngBefore = state.rng;
    onBirth(state, s);
    expect(s.isAbomination).toBe(true);
    expect(state.rng).toBe(rngBefore);
    expect(state.abomination.birthsSeen).toBe(g);
    expect(abominationAlive(state)).toBe(true);
  });

  it('loses the guarantee when one is already alive, then rolls the chance on later births', () => {
    const state = newGame(7);
    const g = state.abomination.guaranteedAtBirth;
    births(state, g - 1);
    // A DEV-made Abomination, alive at the guaranteed birth.
    const dev = lamb(state);
    dev.isAbomination = true;
    const s = lamb(state);
    const rngBefore = state.rng;
    onBirth(state, s);
    expect(s.isAbomination).toBe(false);
    expect(state.rng).toBe(rngBefore);
    // Once the DEV one is gone, the next birth rolls (draws rng) instead of being guaranteed.
    dev.isAbomination = false;
    const next = lamb(state);
    const before = state.rng;
    onBirth(state, next);
    expect(state.rng).not.toBe(before);
  });

  it('never spawns or draws while an Abomination is alive (at most one)', () => {
    const state = newGame(7);
    const g = state.abomination.guaranteedAtBirth;
    const flagged = births(state, g);
    expect(flagged).toHaveLength(1);
    for (let i = 0; i < 500; i++) {
      // createSheep draws a heading; only onBirth must draw nothing.
      const s = lamb(state);
      const rngBefore = state.rng;
      onBirth(state, s);
      expect(state.rng).toBe(rngBefore);
      expect(s.isAbomination).toBe(false);
    }
    expect(state.sheep.filter((s) => s.isAbomination)).toHaveLength(1);
  });

  it('spawns at about abominationBirthChance per birth after the guaranteed one', () => {
    const state = newGame(4242);
    births(state, state.abomination.guaranteedAtBirth);
    const trials = 4_000;
    let spawned = 0;
    for (let i = 0; i < trials; i++) {
      // Clear the one alive, so every trial rolls.
      for (const s of state.sheep) s.isAbomination = false;
      // Keep the flock small: trials only need a lamb to flag.
      state.sheep.length = 1;
      const s = lamb(state);
      onBirth(state, s);
      if (s.isAbomination) spawned++;
    }
    const rate = spawned / trials;
    expect(rate).toBeGreaterThan(TUNING.abominationBirthChance * 0.7);
    expect(rate).toBeLessThan(TUNING.abominationBirthChance * 1.3);
  });

  it('emits no event: the view must not learn of the spawn', () => {
    const state = newGame(7);
    births(state, state.abomination.guaranteedAtBirth);
    const events: unknown[] = [];
    drainEvents((e) => events.push(e));
    expect(events).toEqual([]);
  });
});
