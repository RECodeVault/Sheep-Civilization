import { describe, expect, it } from 'vitest';
import { TICK_MS } from '../../src/config/constants';
import { TUNING, type Rect } from '../../src/config/tuning';

// A placeholder sheep is 64×52 (SheepSprite); a fence must hold one inside its inset.
const SHEEP_W = 64;
const SHEEP_H = 52;

function contains(outer: Rect, inner: Rect): boolean {
  return (
    outer.x <= inner.x &&
    outer.y <= inner.y &&
    outer.x + outer.width >= inner.x + inner.width &&
    outer.y + outer.height >= inner.y + inner.height
  );
}

describe('land table (FR22, Story 3.3)', () => {
  // Shape rules only, no literal values: Story 3.6 may retune the capacities without a test edit.
  it('has a capacity for no land and each of Land I–III: positive whole counts, strictly rising', () => {
    const c = TUNING.landCapacities;
    expect(c).toHaveLength(TUNING.landPrices.length + 1);
    for (const n of c) {
      expect(Number.isInteger(n)).toBe(true);
      expect(n).toBeGreaterThan(0);
    }
    for (let i = 1; i < c.length; i++) expect(c[i]).toBeGreaterThan(c[i - 1]);
  });

  it('has one fence per tier, each containing the one before (fences only grow)', () => {
    const f = TUNING.landFences;
    expect(f).toHaveLength(TUNING.landCapacities.length);
    for (let i = 1; i < f.length; i++) {
      expect(contains(f[i], f[i - 1])).toBe(true);
      expect(f[i]).not.toEqual(f[i - 1]);
    }
  });

  it('every fence holds a sheep inside its inset', () => {
    for (const f of TUNING.landFences) {
      expect(f.width).toBeGreaterThan(2 * TUNING.fenceInset + SHEEP_W);
      expect(f.height).toBeGreaterThan(2 * TUNING.fenceInset + SHEEP_H);
    }
  });

  it('is frozen', () => {
    expect(Object.isFrozen(TUNING.landCapacities)).toBe(true);
    expect(Object.isFrozen(TUNING.landFences)).toBe(true);
    for (const f of TUNING.landFences) expect(Object.isFrozen(f)).toBe(true);
  });
});

describe('era thresholds (FR27, Story 3.5)', () => {
  it('has Village, Town and Wool Empire as positive whole counts, strictly rising', () => {
    const t = TUNING.eraThresholds;
    expect(t).toHaveLength(3);
    for (const n of t) {
      expect(Number.isInteger(n)).toBe(true);
      expect(n).toBeGreaterThan(0);
    }
    for (let i = 1; i < t.length; i++) expect(t[i]).toBeGreaterThan(t[i - 1]);
    expect(Object.isFrozen(t)).toBe(true);
  });

  it('each threshold equals a land capacity (GDD: enter each era at full capacity)', () => {
    TUNING.eraThresholds.forEach((n, i) => expect(n).toBe(TUNING.landCapacities[i]));
  });
});

describe('Abomination spacing (FR32, Story 4.2)', () => {
  it('is wider than the normal personal space, so the flock visibly gives it room', () => {
    expect(TUNING.abominationSpacePx).toBeGreaterThan(TUNING.personalSpacePx);
  });

  // The 36 px push is a direct distance check (movement.ts), so only personalSpacePx goes through the
  // grid; keeping both within a cell lets either move to a grid query without breaking the 3×3 scan.
  it('keeps both radii within one grid cell', () => {
    expect(TUNING.personalSpacePx).toBeLessThanOrEqual(TUNING.gridCellPx);
    expect(TUNING.abominationSpacePx).toBeLessThanOrEqual(TUNING.gridCellPx);
  });

  // A sheep standing on a piece holds a seeker off where its push balances the walk:
  // space × (1 − 1 / separationWeight). The reach must clear that for both radii, or a blocker that cannot
  // be pushed (pinned on the rail) stalls the seeker.
  it('lets a seeker reach past the hold-off of an ordinary sheep and of the Abomination', () => {
    const holdOff = (space: number): number => space * (1 - 1 / TUNING.separationWeight);
    expect(TUNING.eatReachPx).toBeGreaterThan(holdOff(TUNING.personalSpacePx));
    expect(TUNING.eatReachPx).toBeGreaterThan(holdOff(TUNING.abominationSpacePx));
  });
});

describe('Abomination kill cycle (FR31, Story 4.3)', () => {
  it('puts contact inside the flock’s gap: past the Abomination’s own space, inside the space others keep', () => {
    expect(TUNING.abominationContactPx).toBeGreaterThan(TUNING.personalSpacePx);
    expect(TUNING.abominationContactPx).toBeLessThan(TUNING.abominationSpacePx);
  });

  it('has ordered ranges', () => {
    expect(TUNING.abominationKillMinMs).toBeLessThanOrEqual(TUNING.abominationKillMaxMs);
    expect(TUNING.abominationDoomMinMs).toBeLessThanOrEqual(TUNING.abominationDoomMaxMs);
  });

  it('rolls its random delays between whole-ms bounds (rngInt needs integers)', () => {
    for (const ms of [TUNING.abominationKillMinMs, TUNING.abominationKillMaxMs, TUNING.abominationDoomMinMs, TUNING.abominationDoomMaxMs]) {
      expect(Number.isInteger(ms)).toBe(true);
      expect(ms).toBeGreaterThan(0);
    }
  });

  it('gives each visit phase a whole number of ticks (contact, linger end and leave end land on ticks)', () => {
    for (const ms of [TUNING.abominationLingerMs, TUNING.abominationLeaveMs, TUNING.abominationApproachMaxMs]) {
      expect(ms % TICK_MS).toBe(0);
      expect(ms).toBeGreaterThan(0);
    }
  });
});

describe('overcrowding (FR34, Story 4.6)', () => {
  it('has a fraction in (0, 1], a chance in [0, 1] and a whole-tick interval', () => {
    expect(TUNING.overcrowdFraction).toBeGreaterThan(0);
    expect(TUNING.overcrowdFraction).toBeLessThanOrEqual(1);
    expect(TUNING.overcrowdInfectChance).toBeGreaterThanOrEqual(0);
    expect(TUNING.overcrowdInfectChance).toBeLessThanOrEqual(1);
    expect(TUNING.overcrowdIntervalMs).toBeGreaterThan(0);
    expect(TUNING.overcrowdIntervalMs % TICK_MS).toBe(0);
  });
});
