import { describe, expect, it } from 'vitest';
import { TICK_MS } from '../../../src/config/constants';
import { TUNING } from '../../../src/config/tuning';
import { createSheep, type GameState, type Sheep } from '../../../src/sim/state';
import { step } from '../../../src/sim/step';
import { createCarcass } from '../../../src/sim/systems/carcass';
import { createBreedingPiece, createFoodPiece } from '../../../src/sim/systems/feeding';
import { updateMovement } from '../../../src/sim/systems/movement';
import { fillFlock, innerFence, newGame, runFor } from '../helpers';

const MAX_STEP = (TUNING.walkSpeedPxPerS * TICK_MS) / 1000;
const FAR_FUTURE = 1e9;

/** A game whose flock is replaced by sheep at the given spots. */
function gameWith(spots: readonly { x: number; y: number; heading?: number; restUntil?: number }[]): GameState {
  const state = newGame(99);
  state.sheep.length = 0;
  for (const p of spots) {
    const s = createSheep(state, { x: p.x, y: p.y, bornAt: -TUNING.startAdultAgeMs });
    if (p.heading !== undefined) s.heading = p.heading;
    if (p.restUntil !== undefined) s.restUntil = p.restUntil;
  }
  return state;
}

function centre(state: GameState): { x: number; y: number } {
  const r = innerFence(state);
  return { x: (r.left + r.right) / 2, y: (r.top + r.bottom) / 2 };
}

function dist(a: Sheep, b: Sheep): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

describe('updateMovement', () => {
  it('never moves a sheep further than the walk speed allows in one tick', () => {
    const state = newGame(11);
    fillFlock(state, 30);
    let moves = 0;
    for (let t = 0; t < 600; t++) {
      const before = state.sheep.map((s) => [s.x, s.y]);
      step(state);
      state.sheep.forEach((s, i) => {
        const d = Math.hypot(s.x - before[i][0], s.y - before[i][1]);
        expect(d).toBeLessThanOrEqual(MAX_STEP + 1e-9);
        if (d > 0) moves++;
      });
    }
    // Guards against a vacuous pass: the flock really moved on most sheep-ticks.
    expect(moves).toBeGreaterThan((30 * 600) / 2);
  });

  it('moves a lone walking sheep on most ticks', () => {
    const state = gameWith([{ ...centre(newGame()), restUntil: 0 }]);
    const s = state.sheep[0];
    let moved = 0;
    for (let t = 0; t < 10_000 / TICK_MS; t++) {
      const [x, y] = [s.x, s.y];
      step(state);
      if (s.x !== x || s.y !== y) moved++;
    }
    expect(moved).toBeGreaterThan(10_000 / TICK_MS / 2);
  });

  it('keeps a grazing sheep with no neighbours still until its rest ends', () => {
    const c = centre(newGame());
    const state = gameWith([{ ...c, restUntil: 5_000 }]);
    const heading = state.sheep[0].heading;
    runFor(state, 5_000 - TICK_MS);
    expect([state.sheep[0].x, state.sheep[0].y, state.sheep[0].heading]).toEqual([c.x, c.y, heading]);
    runFor(state, TICK_MS * 20);
    expect(state.sheep[0].x !== c.x || state.sheep[0].y !== c.y).toBe(true);
  });

  it('pushes two close sheep apart', () => {
    const c = centre(newGame());
    const state = gameWith([
      { x: c.x, y: c.y, restUntil: FAR_FUTURE },
      { x: c.x + 1, y: c.y, restUntil: FAR_FUTURE },
    ]);
    const [a, b] = state.sheep;
    const target = 0.9 * TUNING.personalSpacePx;
    let d = dist(a, b);
    for (let t = 0; t < 2_000 / TICK_MS && d < target; t++) {
      step(state);
      const next = dist(a, b);
      expect(next).toBeGreaterThan(d);
      d = next;
    }
    expect(d).toBeGreaterThanOrEqual(target);
    // Once apart, grazing sheep do not drift back together.
    runFor(state, 3_000);
    expect(dist(a, b)).toBeGreaterThanOrEqual(target);
  });

  it('separates sheep standing on exactly the same point', () => {
    const c = centre(newGame());
    const state = gameWith([
      { ...c, restUntil: FAR_FUTURE },
      { ...c, restUntil: FAR_FUTURE },
      { ...c, restUntil: 0 },
    ]);
    runFor(state, 2_000);
    for (const s of state.sheep) expect(Number.isFinite(s.x) && Number.isFinite(s.y) && Number.isFinite(s.heading)).toBe(true);
    expect(dist(state.sheep[0], state.sheep[1])).toBeGreaterThan(TUNING.personalSpacePx / 2);
    expect(dist(state.sheep[0], state.sheep[2])).toBeGreaterThan(TUNING.personalSpacePx / 2);
  });

  it('keeps a sheep walking straight at the fence inside it', () => {
    const r = innerFence(newGame());
    const mid = (r.top + r.bottom) / 2;
    const state = gameWith([
      { x: r.left, y: mid, heading: Math.PI, restUntil: 0 },
      { x: r.right, y: mid, heading: 0, restUntil: 0 },
      { x: (r.left + r.right) / 2, y: r.top, heading: -Math.PI / 2, restUntil: 0 },
      { x: (r.left + r.right) / 2, y: r.bottom, heading: Math.PI / 2, restUntil: 0 },
    ]);
    for (let t = 0; t < 100; t++) {
      step(state);
      for (const s of state.sheep) {
        expect(s.x).toBeGreaterThanOrEqual(r.left);
        expect(s.x).toBeLessThanOrEqual(r.right);
        expect(s.y).toBeGreaterThanOrEqual(r.top);
        expect(s.y).toBeLessThanOrEqual(r.bottom);
      }
    }
  });

  it('turns a walker back from the fence before it reaches the rail', () => {
    const r = innerFence(newGame());
    const mid = (r.top + r.bottom) / 2;
    // Inside the turn margin, heading straight out: the soft turn alone must bring it back.
    const state = gameWith([{ x: r.left + TUNING.fenceTurnMarginPx / 2, y: mid, heading: Math.PI, restUntil: 0 }]);
    const s = state.sheep[0];
    for (let t = 0; t < 20; t++) {
      step(state);
      expect(s.x).toBeGreaterThan(r.left);
    }
    expect(s.x).toBeGreaterThan(r.left + TUNING.fenceTurnMarginPx);
  });

  it('keeps an inward-facing sheep facing inward when a neighbour pushes it into the rail', () => {
    const r = innerFence(newGame());
    const mid = (r.top + r.bottom) / 2;
    const state = gameWith([
      { x: r.left, y: mid, heading: 0, restUntil: FAR_FUTURE },
      { x: r.left + 4, y: mid, heading: 0, restUntil: FAR_FUTURE },
    ]);
    // Checked every tick: a wrong flip toggles each tick, so an end-only check could land on 0.
    for (let t = 0; t < 10; t++) {
      step(state);
      expect(state.sheep[0].x).toBe(r.left);
      expect(state.sheep[0].heading).toBe(0);
    }
  });

  it('handles a flock larger than its initial scratch capacity', () => {
    const state = newGame(31);
    fillFlock(state, 300);
    const r = innerFence(state);
    const start = state.sheep.map((s) => [s.x, s.y]);
    runFor(state, 5_000);
    for (const s of state.sheep) {
      expect(Number.isFinite(s.x) && Number.isFinite(s.y)).toBe(true);
      expect(s.x >= r.left && s.x <= r.right && s.y >= r.top && s.y <= r.bottom).toBe(true);
    }
    expect(state.sheep.filter((s, i) => s.x !== start[i][0] || s.y !== start[i][1]).length).toBeGreaterThan(150);
  });

  it('gives new sheep a heading and no rest', () => {
    for (const s of newGame(5).sheep) {
      expect(s.heading).toBeGreaterThanOrEqual(0);
      expect(s.heading).toBeLessThan(2 * Math.PI);
      expect(s.restUntil).toBe(0);
    }
  });
});

describe('updateMovement seekFood / eating', () => {
  it('walks a seeker straight to its piece at no more than walk speed, without overshooting', () => {
    const c = centre(newGame());
    const state = gameWith([{ x: c.x - 50, y: c.y + 7 }]);
    const s = state.sheep[0];
    const p = createFoodPiece(state, c.x, c.y);
    s.activity = 'seekFood';
    s.targetId = p.id;
    let prev = Math.hypot(p.x - s.x, p.y - s.y);
    for (let t = 0; t < 20; t++) {
      const bx = s.x;
      const by = s.y;
      updateMovement(state);
      expect(Math.hypot(s.x - bx, s.y - by)).toBeLessThanOrEqual(MAX_STEP + 1e-9);
      const d = Math.hypot(p.x - s.x, p.y - s.y);
      expect(d).toBeLessThanOrEqual(prev + 1e-9);
      prev = d;
    }
    // 50 px at 6 px per tick: there after 9 ticks, and it stays on the piece instead of orbiting it.
    expect(prev).toBeLessThan(1e-6);
  });

  it('walks a breeding-food seeker straight to its breeding piece the same way', () => {
    const c = centre(newGame());
    const state = gameWith([{ x: c.x - 50, y: c.y - 7 }]);
    const s = state.sheep[0];
    const p = createBreedingPiece(state, c.x, c.y);
    s.activity = 'seekBreedingFood';
    s.targetId = p.id;
    let prev = Math.hypot(p.x - s.x, p.y - s.y);
    for (let t = 0; t < 20; t++) {
      const bx = s.x;
      const by = s.y;
      updateMovement(state);
      expect(Math.hypot(s.x - bx, s.y - by)).toBeLessThanOrEqual(MAX_STEP + 1e-9);
      const d = Math.hypot(p.x - s.x, p.y - s.y);
      expect(d).toBeLessThanOrEqual(prev + 1e-9);
      prev = d;
    }
    expect(prev).toBeLessThan(1e-6);
  });

  it('walks a carcass seeker straight to its carcass the same way (FR14)', () => {
    const c = centre(newGame());
    const state = gameWith([{ x: c.x + 50, y: c.y - 7 }]);
    const s = state.sheep[0];
    const k = createCarcass(state, c.x, c.y);
    s.activity = 'seekCarcass';
    s.targetId = k.id;
    let prev = Math.hypot(k.x - s.x, k.y - s.y);
    for (let t = 0; t < 20; t++) {
      const bx = s.x;
      const by = s.y;
      updateMovement(state);
      expect(Math.hypot(s.x - bx, s.y - by)).toBeLessThanOrEqual(MAX_STEP + 1e-9);
      const d = Math.hypot(k.x - s.x, k.y - s.y);
      expect(d).toBeLessThanOrEqual(prev + 1e-9);
      prev = d;
    }
    expect(prev).toBeLessThan(1e-6);
  });

  it('keeps a seeker inside the inner fence', () => {
    const state = gameWith([{ x: 0, y: 0 }]);
    const r = innerFence(state);
    const s = state.sheep[0];
    s.x = r.left;
    s.y = r.top;
    const p = createFoodPiece(state, r.right, r.bottom);
    s.activity = 'seekFood';
    s.targetId = p.id;
    for (let t = 0; t < 200; t++) {
      updateMovement(state);
      expect(s.x >= r.left && s.x <= r.right && s.y >= r.top && s.y <= r.bottom).toBe(true);
    }
  });

  it('stands still while eating and while its target is missing', () => {
    const c = centre(newGame());
    const state = gameWith([
      { x: c.x - 100, y: c.y },
      { x: c.x + 100, y: c.y },
    ]);
    const [eater, lost] = state.sheep;
    eater.activity = 'eating';
    lost.activity = 'seekFood';
    lost.targetId = 9999;
    const lostCarcass = createSheep(state, { x: c.x, y: c.y + 60, bornAt: -TUNING.startAdultAgeMs });
    lostCarcass.activity = 'seekCarcass';
    lostCarcass.targetId = 9998;
    const before = state.sheep.map((x) => [x.x, x.y]);
    for (let t = 0; t < 10; t++) updateMovement(state);
    expect(state.sheep.map((x) => [x.x, x.y])).toEqual(before);
  });
});

/**
 * Hashes every sheep's exact position and heading after a run: a fingerprint of the path. A number's
 * default string is its shortest round-trip form, so any change at all in a value changes the hash.
 */
function pathHash(state: GameState): string {
  let h = 0x811c9dc5;
  const str = state.sheep.map((s) => `${s.x},${s.y},${s.heading}`).join(';');
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16);
}

describe('updateMovement around the Abomination (FR32, Story 4.2)', () => {
  /** Two resting sheep 1 px apart, the first optionally the Abomination; settled for 5 s. */
  function settledPair(abomination: boolean): number {
    const c = centre(newGame());
    const state = gameWith([
      { x: c.x, y: c.y, restUntil: FAR_FUTURE },
      { x: c.x + 1, y: c.y, restUntil: FAR_FUTURE },
    ]);
    state.sheep[0].isAbomination = abomination;
    runFor(state, 5_000);
    return dist(state.sheep[0], state.sheep[1]);
  }

  it('lets two ordinary sheep settle at the normal personal space', () => {
    const d = settledPair(false);
    expect(d).toBeGreaterThanOrEqual(0.9 * TUNING.personalSpacePx);
    expect(d).toBeLessThan(TUNING.abominationSpacePx);
  });

  it('makes a sheep settle at the wider Abomination space from it', () => {
    expect(settledPair(true)).toBeGreaterThanOrEqual(0.9 * TUNING.abominationSpacePx);
  });

  it('pushes the other sheep away while the Abomination itself feels only the normal space', () => {
    const c = centre(newGame());
    const gap = (TUNING.personalSpacePx + TUNING.abominationSpacePx) / 2;
    const state = gameWith([
      { x: c.x, y: c.y, restUntil: FAR_FUTURE },
      { x: c.x + gap, y: c.y, restUntil: FAR_FUTURE },
    ]);
    const [abom, other] = state.sheep;
    abom.isAbomination = true;
    updateMovement(state);
    expect([abom.x, abom.y]).toEqual([c.x, c.y]);
    expect(other.x).toBeGreaterThan(c.x + gap);
  });

  it('lets a dragged Abomination push nobody', () => {
    const c = centre(newGame());
    const gap = (TUNING.personalSpacePx + TUNING.abominationSpacePx) / 2;
    const state = gameWith([
      { x: c.x, y: c.y, restUntil: FAR_FUTURE },
      { x: c.x + gap, y: c.y, restUntil: FAR_FUTURE },
    ]);
    state.sheep[0].isAbomination = true;
    state.sheep[0].activity = 'dragged';
    updateMovement(state);
    expect([state.sheep[1].x, state.sheep[1].y]).toEqual([c.x + gap, c.y]);
  });

  it('splits an ordinary sheep standing exactly on the Abomination', () => {
    const c = centre(newGame());
    const state = gameWith([
      { ...c, restUntil: FAR_FUTURE },
      { ...c, restUntil: FAR_FUTURE },
    ]);
    state.sheep[0].isAbomination = true;
    runFor(state, 3_000);
    for (const s of state.sheep) expect(Number.isFinite(s.x) && Number.isFinite(s.y)).toBe(true);
    expect(dist(state.sheep[0], state.sheep[1])).toBeGreaterThan(TUNING.personalSpacePx);
  });

  it('still caps every step at walk speed with an Abomination in the flock', () => {
    const state = newGame(11);
    fillFlock(state, 30);
    state.sheep[5].isAbomination = true;
    for (let t = 0; t < 300; t++) {
      const before = state.sheep.map((s) => [s.x, s.y]);
      step(state);
      state.sheep.forEach((s, i) => expect(Math.hypot(s.x - before[i][0], s.y - before[i][1])).toBeLessThanOrEqual(MAX_STEP + 1e-9));
    }
  });

  // AC 5: with no Abomination the steering path is bit-for-bit what it was before Story 4.2. The hashes
  // and rng were recorded on the baseline commit (e3ef9aa) before movement.ts changed.
  it.each([
    [11, '15e0eb22', 298150454],
    [2026, '4e7e4452', 3073683637],
  ])('takes the pre-4.2 path with no Abomination (seed %i)', (seed, hash, rngAfter) => {
    const state = newGame(seed);
    fillFlock(state, 30);
    runFor(state, 20_000);
    expect(state.sheep.some((s) => s.isAbomination)).toBe(false);
    expect([pathHash(state), state.rng]).toEqual([hash, rngAfter]);
  });
});

describe('the Abomination\'s visit (stalking, FR31, Story 4.3)', () => {
  /** The Abomination (a lamb, not resting) at `a` on a visit to a resting adult at `v`, alone. */
  function visit(phase: 'approach' | 'linger' | 'leave', a: { x: number; y: number }, v: { x: number; y: number }) {
    const state = gameWith([a, { ...v, restUntil: FAR_FUTURE }]);
    const [abom, victim] = state.sheep;
    abom.isAbomination = true;
    abom.bornAt = state.time;
    abom.activity = 'stalking';
    abom.stalk = { victimId: victim.id, phase, until: FAR_FUTURE };
    if (phase === 'leave') abom.heading = Math.atan2(abom.y - victim.y, abom.x - victim.x);
    return { state, abom, victim };
  }

  it('approach: walks straight at the victim at walk speed', () => {
    const c = centre(gameWith([]));
    const { state, abom, victim } = visit('approach', { x: c.x - 60, y: c.y }, { x: c.x + 60, y: c.y });
    const before = dist(abom, victim);
    updateMovement(state);
    const step = (TUNING.walkSpeedPxPerS * TICK_MS) / 1000;
    expect(before - dist(abom, victim)).toBeCloseTo(step, 6);
    expect(abom.y).toBeCloseTo(c.y, 9);
  });

  it('approach: does not walk to a victim that is gone or lifted', () => {
    const c = centre(gameWith([]));
    const { state, abom, victim } = visit('approach', { x: c.x - 60, y: c.y }, { x: c.x + 60, y: c.y });
    victim.activity = 'dragged';
    const at = { x: abom.x, y: abom.y };
    updateMovement(state);
    expect({ x: abom.x, y: abom.y }).toEqual(at);
    abom.stalk!.victimId = 99_999;
    updateMovement(state);
    expect({ x: abom.x, y: abom.y }).toEqual(at);
  });

  it('linger: stands still beside the victim, which eases away inside the flock\'s 36 px', () => {
    const c = centre(gameWith([]));
    const { state, abom, victim } = visit('linger', { x: c.x, y: c.y }, { x: c.x + TUNING.abominationContactPx, y: c.y });
    const at = { x: abom.x, y: abom.y };
    const before = dist(abom, victim);
    runFor(state, TUNING.abominationLingerMs);
    // Outside its own 24 px, so nothing pushes it.
    expect({ x: abom.x, y: abom.y }).toEqual(at);
    expect(dist(abom, victim)).toBeGreaterThan(before);
  });

  it('leave: walks away from the victim along its heading', () => {
    const c = centre(gameWith([]));
    const { state, abom, victim } = visit('leave', { x: c.x, y: c.y }, { x: c.x + TUNING.abominationContactPx, y: c.y });
    const before = dist(abom, victim);
    for (let k = 0; k < 10; k++) updateMovement(state);
    expect(dist(abom, victim)).toBeGreaterThan(before + 50);
  });
});
