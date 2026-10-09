import { describe, expect, it } from 'vitest';
import { TUNING } from '../../../src/config/tuning';
import { applyCommand } from '../../../src/sim/commands';
import { isCrowded, shopPrice } from '../../../src/sim/selectors';
import { fillFlock, newGame, runFor } from '../helpers';

// FR25 / GDD Automation Systems (Story 4.8): the Auto-feeder's free food "sustains about 4 sheep". Five
// minutes with no Farm, no breeding food and no other command: 4 adults live on it, 8 do not (though fewer
// starve than 8 without it), and 4 without it starve (the control, so the first result is not vacuous).
// Seeds of the pacing probe.
const SEEDS = [3606, 11, 2026] as const;
const RUN_MS = 300_000;

/** Starvation deaths in RUN_MS of a new game filled to `n` sheep, with or without the Auto-feeder. */
function starvedIn5Min(seed: number, n: number, feeder: boolean): number {
  const state = newGame(seed);
  fillFlock(state, n);
  // Adults only (AC 7): the founding lamb is aged like the founders and fillFlock's adults.
  for (const s of state.sheep) s.bornAt = state.time - TUNING.startAdultAgeMs;
  if (feeder) {
    state.money = shopPrice('autoFeeder');
    applyCommand(state, { type: 'Buy', item: 'autoFeeder' });
    expect(state.owned).toContain('autoFeeder');
  }
  // Nothing else may interfere: no births (no breeding food), so no Abomination; no overcrowding roll.
  expect(isCrowded(state)).toBe(false);
  const events = runFor(state, RUN_MS);
  expect(state.sheep.some((s) => s.isAbomination)).toBe(false);
  // Every sheep starts 60 s old: after 5 minutes it is short of old age (elder or not; elders eat alike).
  expect(TUNING.startAdultAgeMs + RUN_MS).toBeLessThan(TUNING.oldAgeMs);
  expect(events.some((e) => e.type === 'SheepDied' && e.cause === 'oldAge')).toBe(false);
  return events.filter((e) => e.type === 'SheepDied' && e.cause === 'starved').length;
}

describe('Auto-feeder sustains about 4 sheep (FR25, Story 4.8)', () => {
  for (const seed of SEEDS) {
    it(`seed ${seed}: 4 adults with it never starve; 8 with it, and 4 without it, do`, () => {
      expect(starvedIn5Min(seed, 4, true)).toBe(0);
      const eightWith = starvedIn5Min(seed, 8, true);
      expect(eightWith).toBeGreaterThan(0);
      // Not vacuous: the feeder still saves some of the 8.
      expect(eightWith).toBeLessThan(starvedIn5Min(seed, 8, false));
      expect(starvedIn5Min(seed, 4, false)).toBeGreaterThan(0);
    });
  }
});
