import { describe, expect, it } from 'vitest';
import { TICK_MS } from '../../../src/config/constants';
import { TUNING } from '../../../src/config/tuning';
import { drainEvents, type SimEvent } from '../../../src/sim/events';
import { rng, rngInt } from '../../../src/sim/rng';
import { createNewGame, createSheep, type GameState, type Sheep } from '../../../src/sim/state';
import { abominationAlive, makeAbomination, onBirth, pickVictim, updateAbomination } from '../../../src/sim/systems/abomination';
import { sacrifice } from '../../../src/sim/systems/betterPlace';
import { removeSheep } from '../../../src/sim/systems/carcass';
import { drop, pickUp } from '../../../src/sim/systems/drag';
import { sell } from '../../../src/sim/systems/market';
import { innerFence, newGame, runFor } from '../helpers';

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
    const roll = { rng: state.rng };
    onBirth(state, s);
    expect(s.isAbomination).toBe(true);
    // No spawn roll at the guaranteed birth; its one draw schedules the first visit (Story 4.3).
    expect(state.abomination.nextKillAt).toBe(state.time + rngInt(roll, TUNING.abominationKillMinMs, TUNING.abominationKillMaxMs));
    expect(state.rng).toBe(roll.rng);
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

// ---- Story 4.3: the kill cycle (FR31) ----

const CONTACT = TUNING.abominationContactPx;
const FAR_FUTURE = Number.MAX_SAFE_INTEGER;

/**
 * A hand-placed pen: the Abomination (a lamb) at the centre and `others` resting adults in a row to the
 * right, `gap` px apart, everyone full. The visit is due now unless `due` is false.
 */
function killGame(others = 3, gap = 80, due = true): { state: GameState; abom: Sheep; flock: Sheep[] } {
  const state = newGame(11);
  state.sheep.length = 0;
  const r = innerFence(state);
  const cx = (r.left + r.right) / 2 - 120;
  const cy = (r.top + r.bottom) / 2;
  const abom = createSheep(state, { x: cx, y: cy, bornAt: state.time });
  makeAbomination(state, abom);
  abom.fullness = TUNING.fullnessMax;
  const flock: Sheep[] = [];
  for (let k = 1; k <= others; k++) {
    const s = createSheep(state, { x: cx + gap * k, y: cy, bornAt: state.time - TUNING.startAdultAgeMs });
    s.fullness = TUNING.fullnessMax;
    s.restUntil = FAR_FUTURE;
    flock.push(s);
  }
  if (due) state.abomination.nextKillAt = state.time;
  drainEvents(() => {});
  return { state, abom, flock };
}

function dist(a: Sheep, b: Sheep): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Steps until `done` holds (at most `maxMs`), returning every event; fails the test on time-out. */
function runUntil(state: GameState, done: () => boolean, maxMs = 30_000): SimEvent[] {
  const events: SimEvent[] = [];
  for (let t = 0; t < maxMs && !done(); t += TICK_MS) events.push(...runFor(state, TICK_MS));
  expect(done(), 'condition reached in time').toBe(true);
  return events;
}

describe('makeAbomination (FR31, AC 1)', () => {
  it('flags the sheep and schedules the first visit 45–60 s ahead', () => {
    const seen = new Set<number>();
    for (let seed = 1; seed <= 200; seed++) {
      const state = newGame(seed);
      const s = lamb(state);
      makeAbomination(state, s);
      expect(s.isAbomination).toBe(true);
      const dt = state.abomination.nextKillAt - state.time;
      expect(Number.isInteger(dt)).toBe(true);
      expect(dt).toBeGreaterThanOrEqual(TUNING.abominationKillMinMs);
      expect(dt).toBeLessThanOrEqual(TUNING.abominationKillMaxMs);
      seen.add(dt);
    }
    expect(seen.size).toBeGreaterThan(100);
  });

  it('a birth past the guarantee that loses the chance roll draws only that roll (no kill schedule)', () => {
    // Find a seeded birth after the guaranteed one whose 5% roll fails, with none alive.
    const state = newGame(7);
    state.abomination.birthsSeen = state.abomination.guaranteedAtBirth;
    let checked = 0;
    for (let i = 0; i < 50 && checked < 10; i++) {
      const s = lamb(state);
      const roll = { rng: state.rng };
      const spawns = rng(roll) < TUNING.abominationBirthChance;
      const before = state.abomination.nextKillAt;
      onBirth(state, s);
      if (spawns) {
        // Not this case: take it out again and go on.
        removeSheep(state, s.id, 'sacrificed');
        continue;
      }
      expect(s.isAbomination).toBe(false);
      expect(state.rng).toBe(roll.rng);
      expect(state.abomination.nextKillAt).toBe(before);
      checked++;
    }
    expect(checked).toBe(10);
  });
});

describe('starting a visit (FR31, AC 1, 2)', () => {
  it('does nothing before nextKillAt, and starts on the tick it is reached', () => {
    const { state, abom } = killGame(3, 80, false);
    state.abomination.nextKillAt = state.time + 5 * TICK_MS;
    runFor(state, 4 * TICK_MS);
    expect(abom.activity).toBe('wander');
    expect(abom.stalk).toBeUndefined();
    runFor(state, TICK_MS);
    expect(abom.activity).toBe('stalking');
    expect(abom.stalk).toEqual({ victimId: expect.any(Number), phase: 'approach', until: state.time + TUNING.abominationApproachMaxMs });
  });

  it.each(['seekFood', 'eating', 'dragged'] as const)('waits while the Abomination is %s, then starts once it wanders', (activity) => {
    const { state, abom } = killGame();
    abom.activity = activity;
    abom.restUntil = FAR_FUTURE;
    if (activity === 'seekFood') abom.targetId = 99_999;
    updateAbomination(state);
    expect(abom.activity).toBe(activity);
    expect(abom.stalk).toBeUndefined();
    abom.activity = 'wander';
    delete abom.targetId;
    updateAbomination(state);
    expect(abom.activity).toBe('stalking');
  });

  it('never picks itself, a dragged sheep or a doomed one; every other sheep gets picked', () => {
    const picked = new Map<number, number>();
    for (let seed = 1; seed <= 300; seed++) {
      const state = newGame(seed);
      state.sheep.length = 0;
      const abom = createSheep(state, { x: 700, y: 450, bornAt: state.time });
      makeAbomination(state, abom);
      const ids: number[] = [];
      for (let k = 0; k < 5; k++) ids.push(createSheep(state, { x: 600 + k * 40, y: 400, bornAt: state.time }).id);
      state.sheep[2].activity = 'dragged';
      state.sheep[4].doomedAt = state.time + TUNING.abominationDoomMaxMs;
      const v = pickVictim(state, 0);
      expect(v).toBeGreaterThan(0);
      expect([2, 4]).not.toContain(v);
      picked.set(state.sheep[v].id, (picked.get(state.sheep[v].id) ?? 0) + 1);
    }
    expect(picked.size).toBe(3);
  });

  it('idles with no draw when there is no victim, and starts as soon as one exists', () => {
    const { state, abom, flock } = killGame(1);
    flock[0].activity = 'dragged';
    const rngBefore = state.rng;
    updateAbomination(state);
    expect(state.rng).toBe(rngBefore);
    expect(abom.activity).toBe('wander');
    expect(abom.stalk).toBeUndefined();
    expect(state.abomination.nextKillAt).toBeLessThanOrEqual(state.time);
    flock[0].activity = 'wander';
    updateAbomination(state);
    expect(abom.stalk?.victimId).toBe(flock[0].id);
  });

  it('idles when it is alone', () => {
    const { state, abom } = killGame(0);
    const events = runFor(state, 2_000);
    expect(abom.activity).toBe('wander');
    expect(events).toEqual([]);
  });
});

describe('the visit (FR31, AC 3, 4)', () => {
  it('approaches, makes contact within abominationContactPx, lingers, dooms, leaves and reschedules', () => {
    const { state, abom, flock } = killGame(1, 120);
    const victim = flock[0];
    const start = state.time;
    runUntil(state, () => abom.stalk?.phase === 'linger');
    expect(dist(abom, victim)).toBeLessThanOrEqual(CONTACT);
    // Walked up to it: well within the approach limit for a resting victim 120 px away.
    expect(state.time - start).toBeLessThan(5_000);
    const contactAt = state.time;
    expect(abom.stalk?.until).toBe(contactAt + TUNING.abominationLingerMs);
    const at = { x: abom.x, y: abom.y };
    runFor(state, TUNING.abominationLingerMs - TICK_MS);
    expect(abom.stalk?.phase).toBe('linger');
    expect(victim.doomedAt).toBeUndefined();
    // Stood still (nobody else is near enough to push it).
    expect(Math.hypot(abom.x - at.x, abom.y - at.y)).toBeLessThan(0.5);
    runFor(state, TICK_MS);
    const leaveAt = state.time;
    expect(leaveAt).toBe(contactAt + TUNING.abominationLingerMs);
    expect(abom.stalk?.phase).toBe('leave');
    expect(victim.doomedAt).toBeGreaterThanOrEqual(leaveAt + TUNING.abominationDoomMinMs);
    expect(victim.doomedAt).toBeLessThanOrEqual(leaveAt + TUNING.abominationDoomMaxMs);
    expect(state.abomination.nextKillAt).toBeGreaterThanOrEqual(leaveAt + TUNING.abominationKillMinMs);
    expect(state.abomination.nextKillAt).toBeLessThanOrEqual(leaveAt + TUNING.abominationKillMaxMs);
    const before = dist(abom, victim);
    runFor(state, TUNING.abominationLeaveMs - TICK_MS);
    expect(abom.stalk?.phase).toBe('leave');
    // Walked away from the victim.
    expect(dist(abom, victim)).toBeGreaterThan(before + 60);
    runFor(state, TICK_MS);
    expect(abom.activity).toBe('wander');
    expect(abom.stalk).toBeUndefined();
  });

  it('kills the doomed victim on the first tick its doom is reached, through the death pipeline', () => {
    const { state, abom, flock } = killGame(2);
    const victim = flock[0];
    runUntil(state, () => victim.doomedAt !== undefined);
    const doomedAt = victim.doomedAt!;
    // The first tick at or after the doom (it is any game-ms, not only a tick time).
    const dieTick = Math.ceil(doomedAt / TICK_MS) * TICK_MS;
    runFor(state, dieTick - state.time - TICK_MS);
    expect(state.sheep).toContain(victim);
    const events = runFor(state, TICK_MS);
    expect(state.time).toBe(dieTick);
    expect(state.sheep).not.toContain(victim);
    expect(events).toEqual([
      { type: 'SheepDied', id: victim.id, cause: 'abomination', x: victim.x, y: victim.y },
      { type: 'CarcassSpawned', id: expect.any(Number), x: victim.x, y: victim.y },
    ]);
    expect(state.carcasses.some((c) => c.x === victim.x && c.y === victim.y)).toBe(true);
    expect(state.sheep).toContain(abom);
  });

  it('emits nothing for the whole visit: only the death surfaces (UX-DR64, AC 8)', () => {
    const { state, flock } = killGame(1);
    // A second sheep far off, so the death does not leave the Abomination alone (that would also lose).
    const far = createSheep(state, { x: flock[0].x + 200, y: flock[0].y, bornAt: state.time - TUNING.startAdultAgeMs });
    far.fullness = TUNING.fullnessMax;
    far.restUntil = FAR_FUTURE;
    far.doomedAt = FAR_FUTURE;
    const victim = flock[0];
    const visit = runUntil(state, () => victim.doomedAt !== undefined);
    expect(visit).toEqual([]);
    const rest = runFor(state, TUNING.abominationDoomMaxMs);
    // Not vacuous: the death itself does surface.
    expect(rest.map((e) => e.type)).toEqual(['SheepDied', 'CarcassSpawned']);
  });

  it('a doom that leaves only the Abomination loses the game (Story 4.3 review)', () => {
    const { state, abom, flock } = killGame(1);
    runUntil(state, () => flock[0].doomedAt !== undefined);
    const events = runFor(state, TUNING.abominationDoomMaxMs);
    expect(state.sheep).toEqual([abom]);
    expect(state.lostAt).toBeDefined();
    expect(events.map((e) => e.type)).toEqual(['SheepDied', 'CarcassSpawned', 'Lost']);
  });

  it('a doom on the last sheep loses the game, Lost after the SheepDied', () => {
    const { state, abom, flock } = killGame(1);
    runUntil(state, () => flock[0].doomedAt !== undefined);
    sacrifice(state, abom.id);
    drainEvents(() => {});
    const events = runFor(state, TUNING.abominationDoomMaxMs);
    expect(events.map((e) => e.type)).toEqual(['SheepDied', 'CarcassSpawned', 'Lost']);
    expect(state.lostAt).toBeDefined();
  });
});

describe('the doom stands (FR31, AC 5)', () => {
  it('still lands after the Abomination is sacrificed', () => {
    const { state, abom, flock } = killGame(2);
    runUntil(state, () => flock[0].doomedAt !== undefined);
    sacrifice(state, abom.id);
    const events = runFor(state, TUNING.abominationDoomMaxMs);
    expect(events).toContainEqual(expect.objectContaining({ type: 'SheepDied', id: flock[0].id, cause: 'abomination' }));
  });

  it('still lands after the Abomination starves', () => {
    const { state, abom, flock } = killGame(2);
    runUntil(state, () => flock.some((s) => s.doomedAt !== undefined));
    const victim = flock.find((s) => s.doomedAt !== undefined)!;
    abom.fullness = 0.01;
    const events = runFor(state, TUNING.abominationDoomMaxMs);
    expect(events).toContainEqual(expect.objectContaining({ type: 'SheepDied', id: abom.id, cause: 'starved' }));
    expect(events).toContainEqual(expect.objectContaining({ type: 'SheepDied', id: victim.id, cause: 'abomination' }));
  });

  it('a doomed victim sold first leaves once, with no death', () => {
    const { state, flock } = killGame(2);
    const victim = flock[0];
    victim.doomedAt = state.time + TUNING.abominationDoomMinMs;
    state.abomination.nextKillAt = FAR_FUTURE;
    sell(state, victim.id);
    const events = runFor(state, TUNING.abominationDoomMaxMs);
    expect(events.filter((e) => e.type === 'SheepDied')).toEqual([]);
    expect(state.stats.sold).toBe(1);
  });

  it('a doomed victim that dies of the virus first dies once', () => {
    const { state, flock } = killGame(2);
    const victim = flock[0];
    state.abomination.nextKillAt = FAR_FUTURE;
    victim.infectedAt = state.time - TUNING.virusDeathMs + TICK_MS;
    victim.doomedAt = state.time + TICK_MS;
    const events = runFor(state, TUNING.abominationDoomMaxMs);
    expect(events.filter((e) => e.type === 'SheepDied')).toEqual([expect.objectContaining({ id: victim.id, cause: 'virus' })]);
  });
});

describe('a visit cut short (FR31, AC 6, 7)', () => {
  it('re-picks on the tick the victim is gone before contact', () => {
    const { state, abom, flock } = killGame(3, 140);
    updateAbomination(state);
    const first = abom.stalk!.victimId;
    const firstUntil = abom.stalk!.until;
    runFor(state, 5 * TICK_MS);
    removeSheep(state, first, 'sold');
    runFor(state, TICK_MS);
    expect(abom.stalk?.phase).toBe('approach');
    expect(abom.stalk?.victimId).not.toBe(first);
    expect(flock.map((s) => s.id)).toContain(abom.stalk?.victimId);
    // The approach keeps its first deadline (Rylan, Story 4.3 review).
    expect(abom.stalk?.until).toBe(firstUntil);
  });

  it('keeps the first deadline however often the victim is lost, then gives up (Story 4.3 review)', () => {
    const { state, abom } = killGame(4, 140);
    updateAbomination(state);
    const deadline = abom.stalk!.until;
    const home = { x: abom.x, y: abom.y };
    let picks = 0;
    while (abom.stalk?.phase === 'approach' && state.time < deadline + TICK_MS) {
      // The player lifts every target as soon as it is picked and puts it back down where it was; the
      // Abomination is held at its start so it never makes contact.
      const id = abom.stalk.victimId;
      const v = state.sheep.find((s) => s.id === id)!;
      const at = { x: v.x, y: v.y };
      abom.x = home.x;
      abom.y = home.y;
      pickUp(state, id);
      runFor(state, TICK_MS);
      drop(state, id, at.x, at.y);
      if (abom.stalk?.phase === 'approach') expect(abom.stalk.until).toBe(deadline);
      picks++;
    }
    expect(picks).toBeGreaterThan(1);
    expect(abom.stalk).toBeUndefined();
    expect(state.time).toBeLessThanOrEqual(deadline + TICK_MS);
  });

  it('re-picks when the victim is lifted before contact', () => {
    const { state, abom } = killGame(3, 140);
    updateAbomination(state);
    const first = abom.stalk!.victimId;
    pickUp(state, first);
    runFor(state, TICK_MS);
    expect(abom.stalk?.victimId).not.toBe(first);
  });

  it('idles when the victim is gone and no other is free (the last one is in the air)', () => {
    const { state, abom, flock } = killGame(2, 140);
    updateAbomination(state);
    const other = flock.find((s) => s.id !== abom.stalk!.victimId)!;
    pickUp(state, other.id);
    removeSheep(state, abom.stalk!.victimId, 'sacrificed');
    runFor(state, TICK_MS);
    expect(abom.activity).toBe('wander');
    expect(abom.stalk).toBeUndefined();
  });

  it('a victim held in the air when the linger ends gets no doom (Rylan, Story 4.3 review)', () => {
    const { state, abom, flock } = killGame(2, 120);
    runUntil(state, () => abom.stalk?.phase === 'linger');
    const victim = flock.find((s) => s.id === abom.stalk!.victimId)!;
    pickUp(state, victim.id);
    runFor(state, TUNING.abominationLingerMs);
    expect(abom.stalk?.phase).toBe('leave');
    expect(victim.doomedAt).toBeUndefined();
    // It still walks away from where the victim is in the sim (its pickup spot).
    const before = dist(abom, victim);
    runFor(state, 5 * TICK_MS);
    expect(dist(abom, victim)).toBeGreaterThan(before);
  });

  it('a victim lost during the linger: it turns around rather than walk on through the spot', () => {
    const { state, abom } = killGame(2, 120);
    runUntil(state, () => abom.stalk?.phase === 'linger');
    const h = abom.heading;
    removeSheep(state, abom.stalk!.victimId, 'sold');
    runFor(state, TUNING.abominationLingerMs);
    expect(abom.stalk?.phase).toBe('leave');
    const d = (((abom.heading - h) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    // About half a turn (soft containment may mirror it near a rail).
    expect(Math.abs(d - Math.PI)).toBeLessThan(0.5);
  });

  it('a victim lost during the linger gets no doom, and the visit still ends with a leave', () => {
    const { state, abom, flock } = killGame(2, 120);
    runUntil(state, () => abom.stalk?.phase === 'linger');
    const victimId = abom.stalk!.victimId;
    removeSheep(state, victimId, 'sold');
    runFor(state, TUNING.abominationLingerMs);
    expect(abom.stalk?.phase).toBe('leave');
    expect(flock.every((s) => s.doomedAt === undefined)).toBe(true);
    expect(state.abomination.nextKillAt).toBeGreaterThan(state.time);
  });

  it.each(['approach', 'linger'] as const)('lifting the Abomination during the %s saves the victim; the visit stays due', (phase) => {
    const { state, abom, flock } = killGame(1, 120);
    runUntil(state, () => abom.stalk?.phase === phase);
    pickUp(state, abom.id);
    expect(abom.stalk).toBeUndefined();
    runFor(state, TUNING.abominationLingerMs + TICK_MS);
    drop(state, abom.id, abom.x, abom.y);
    expect(abom.activity).toBe('wander');
    expect(flock[0].doomedAt).toBeUndefined();
    expect(state.abomination.nextKillAt).toBeLessThanOrEqual(state.time);
    runFor(state, TICK_MS);
    expect(abom.stalk?.phase).toBe('approach');
  });

  it('gives up an approach that never makes contact, with no doom, and reschedules', () => {
    const { state, abom, flock } = killGame(1, 140);
    updateAbomination(state);
    // A victim it can never reach: the Abomination is put back at its start before every tick.
    const victim = flock[0];
    const home = { x: abom.x, y: abom.y };
    let events: SimEvent[] = [];
    for (let t = 0; t < TUNING.abominationApproachMaxMs + TICK_MS && abom.stalk !== undefined; t += TICK_MS) {
      abom.x = home.x;
      abom.y = home.y;
      events = events.concat(runFor(state, TICK_MS));
    }
    expect(state.time).toBeGreaterThanOrEqual(TUNING.abominationApproachMaxMs);
    expect(abom.stalk).toBeUndefined();
    expect(abom.activity).toBe('wander');
    expect(victim.doomedAt).toBeUndefined();
    expect(state.abomination.nextKillAt).toBeGreaterThanOrEqual(state.time + TUNING.abominationKillMinMs);
    expect(events).toEqual([]);
  });
});
