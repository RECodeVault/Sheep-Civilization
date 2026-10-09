import { describe, expect, it } from 'vitest';
import { TICK_MS } from '../../../src/config/constants';
import { TUNING } from '../../../src/config/tuning';
import { clearEvents, drainEvents, type SimEvent } from '../../../src/sim/events';
import { rng, rngInt } from '../../../src/sim/rng';
import { capacity, crowdThreshold, isCrowded } from '../../../src/sim/selectors';
import type { GameState } from '../../../src/sim/state';
import { step } from '../../../src/sim/step';
import { makeAbomination } from '../../../src/sim/systems/abomination';
import { updateOvercrowding } from '../../../src/sim/systems/overcrowding';
import { infectSheep } from '../../../src/sim/systems/virus';
import { fillFlock, newGame } from '../helpers';

/** The first whole flock that is crowded at the state's land capacity. */
function crowdedCount(state: GameState): number {
  return crowdThreshold(capacity(state), TUNING.overcrowdFraction);
}

/** A crowded new game whose overcrowding roll is due now, with an empty event queue. */
function dueCrowded(seed: number): GameState {
  const state = newGame(seed);
  fillFlock(state, crowdedCount(state));
  state.nextOvercrowdRollAt = state.time;
  clearEvents();
  return state;
}

/** What the roll will do on `state`'s rng: the chance first, then (on a hit) the victim's index. */
function predict(state: GameState): { hit: boolean; victim: number; rngAfter: number } {
  const probe = { rng: state.rng };
  const hit = rng(probe) < TUNING.overcrowdInfectChance;
  const victim = hit ? rngInt(probe, 0, state.sheep.length - 1) : -1;
  return { hit, victim, rngAfter: probe.rng };
}

function drain(): SimEvent[] {
  const out: SimEvent[] = [];
  drainEvents((e) => out.push(e));
  return out;
}

/**
 * A fed flock exactly at the crowded threshold whose overcrowding roll falls on the next tick. With
 * `dying`, one of its sheep dies of the virus on that same tick, taking the flock just below 90%.
 */
function deadlineNextTick(seed: number, dying: boolean): GameState {
  const state = newGame(seed);
  fillFlock(state, crowdedCount(state));
  for (const s of state.sheep) s.fullness = TUNING.fullnessMax;
  if (dying) state.sheep[0].infectedAt = state.time + TICK_MS - TUNING.virusDeathMs;
  state.nextOvercrowdRollAt = state.time + TICK_MS;
  clearEvents();
  return state;
}

/** The first seed from 1 whose due roll on a crowded new game hits (`hit`) or misses. */
function seedWhere(hit: boolean): number {
  for (let seed = 1; seed < 1000; seed++) if (predict(dueCrowded(seed)).hit === hit) return seed;
  throw new Error('no seed found');
}

describe('updateOvercrowding (FR34, Story 4.6)', () => {
  it('schedules the first roll one interval into a new game', () => {
    expect(newGame().nextOvercrowdRollAt).toBe(TUNING.overcrowdIntervalMs);
  });

  it('does nothing before the deadline, even when crowded', () => {
    const state = dueCrowded(5);
    state.nextOvercrowdRollAt = state.time + TICK_MS;
    const rngBefore = state.rng;
    updateOvercrowding(state);
    expect(state.rng).toBe(rngBefore);
    expect(state.nextOvercrowdRollAt).toBe(state.time + TICK_MS);
    expect(drain()).toEqual([]);
  });

  it('reschedules without a draw or an infection when not crowded at the deadline', () => {
    const state = newGame(5);
    fillFlock(state, crowdedCount(state) - 1);
    expect(isCrowded(state)).toBe(false);
    state.nextOvercrowdRollAt = state.time;
    clearEvents();
    const rngBefore = state.rng;
    updateOvercrowding(state);
    expect(state.rng).toBe(rngBefore);
    expect(state.nextOvercrowdRollAt).toBe(state.time + TUNING.overcrowdIntervalMs);
    expect(state.sheep.every((s) => s.infectedAt === undefined)).toBe(true);
    expect(drain()).toEqual([]);
  });

  it('a hit infects the predicted sheep now, with one Infected event', () => {
    const state = dueCrowded(seedWhere(true));
    const p = predict(state);
    expect(p.hit).toBe(true);
    const victim = state.sheep[p.victim];
    updateOvercrowding(state);
    expect(state.rng).toBe(p.rngAfter);
    expect(state.nextOvercrowdRollAt).toBe(state.time + TUNING.overcrowdIntervalMs);
    expect(victim.infectedAt).toBe(state.time);
    expect(state.sheep.filter((s) => s.infectedAt !== undefined)).toEqual([victim]);
    expect(drain()).toEqual([{ type: 'Infected', id: victim.id, x: victim.x, y: victim.y }]);
  });

  it('a miss draws only the chance and infects nobody', () => {
    const state = dueCrowded(seedWhere(false));
    const p = predict(state);
    expect(p.hit).toBe(false);
    updateOvercrowding(state);
    expect(state.rng).toBe(p.rngAfter);
    expect(state.nextOvercrowdRollAt).toBe(state.time + TUNING.overcrowdIntervalMs);
    expect(state.sheep.every((s) => s.infectedAt === undefined)).toBe(true);
    expect(drain()).toEqual([]);
  });

  it('hits at about overcrowdInfectChance over many rolls', () => {
    const state = dueCrowded(77);
    const rolls = 2000;
    let hits = 0;
    for (let i = 0; i < rolls; i++) {
      state.nextOvercrowdRollAt = state.time;
      updateOvercrowding(state);
      const infected = state.sheep.find((s) => s.infectedAt !== undefined);
      if (infected !== undefined) {
        hits++;
        delete infected.infectedAt;
      }
    }
    drain();
    const rate = hits / rolls;
    expect(rate).toBeGreaterThan(TUNING.overcrowdInfectChance - 0.03);
    expect(rate).toBeLessThan(TUNING.overcrowdInfectChance + 0.03);
  });

  it('spends a roll that picks an already-infected sheep: first deadline kept, nothing emitted', () => {
    const state = dueCrowded(seedWhere(true));
    for (const s of state.sheep) infectSheep(state, s);
    const deadlines = state.sheep.map((s) => s.infectedAt);
    state.time += TICK_MS;
    state.nextOvercrowdRollAt = state.time;
    clearEvents();
    const p = predict(state);
    // A real hit, so the pick did land on an infected sheep (infectSheep draws no rng, so the seed's hit holds).
    expect(p.hit).toBe(true);
    updateOvercrowding(state);
    expect(state.rng).toBe(p.rngAfter);
    expect(state.sheep.map((s) => s.infectedAt)).toEqual(deadlines);
    expect(drain()).toEqual([]);
  });

  it('skips a deadline after crowding ends, and rolls at the next one once crowded again', () => {
    const state = dueCrowded(seedWhere(true));
    const removed = state.sheep.pop();
    expect(removed).toBeDefined();
    expect(isCrowded(state)).toBe(false);
    const rngBefore = state.rng;
    updateOvercrowding(state);
    expect(state.rng).toBe(rngBefore);
    expect(state.sheep.every((s) => s.infectedAt === undefined)).toBe(true);
    // Crowded again before the next deadline: it rolls there (the cadence never restarts).
    state.sheep.push(removed!);
    state.time = state.nextOvercrowdRollAt;
    const p = predict(state);
    updateOvercrowding(state);
    expect(state.rng).toBe(p.rngAfter);
    expect(state.nextOvercrowdRollAt).toBe(state.time + TUNING.overcrowdIntervalMs);
  });

  it('infects the Abomination like any lamb, and it stays the Abomination', () => {
    // Every sheep is tried, since making one the Abomination draws its first visit from the rng.
    for (let seed = 1; seed < 1000; seed++) {
      const state = dueCrowded(seed);
      const s = state.sheep[seed % state.sheep.length];
      makeAbomination(state, s);
      const p = predict(state);
      if (p.hit && state.sheep[p.victim] === s) return checkAbomination(state, s);
    }
    throw new Error('no seed found');
  });

  function checkAbomination(state: GameState, victim: GameState['sheep'][number]): void {
    clearEvents();
    updateOvercrowding(state);
    expect(victim.infectedAt).toBe(state.time);
    expect(victim.isAbomination).toBe(true);
    expect(drain()).toEqual([{ type: 'Infected', id: victim.id, x: victim.x, y: victim.y }]);
  }

  it('rolls on its own tick inside step(): over many seeds some deadline ticks infect exactly one sheep', () => {
    const SEEDS = 200;
    let hits = 0;
    for (let seed = 1; seed <= SEEDS; seed++) {
      const state = deadlineNextTick(seed, false);
      step(state);
      expect(state.nextOvercrowdRollAt).toBe(state.time + TUNING.overcrowdIntervalMs);
      const infected = state.sheep.filter((s) => s.infectedAt !== undefined);
      expect(infected.length).toBeLessThanOrEqual(1);
      if (infected.length === 1) {
        expect(infected[0].infectedAt).toBe(state.time);
        hits++;
      }
    }
    // About overcrowdInfectChance of them (step draws other rng first, so per-seed outcomes are not predicted).
    expect(hits).toBeGreaterThan(SEEDS * TUNING.overcrowdInfectChance * 0.5);
    expect(hits).toBeLessThan(SEEDS * TUNING.overcrowdInfectChance * 1.5);
  });

  it('runs after the virus: a death on the deadline tick that leaves the flock below 90% means no roll', () => {
    // Paired with the test above's setup: the same seeds roll ~20% hits when nobody dies on that tick.
    let infections = 0;
    let deaths = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const state = deadlineNextTick(seed, true);
      const before = state.sheep.length;
      step(state);
      deaths += before - state.sheep.length;
      infections += state.sheep.filter((s) => s.infectedAt !== undefined).length;
    }
    expect(deaths).toBe(200);
    expect(infections).toBe(0);
  });

  it('never rolls on a lost game', () => {
    const lost = newGame(5);
    fillFlock(lost, crowdedCount(lost));
    lost.nextOvercrowdRollAt = lost.time;
    lost.lostAt = lost.time;
    const rngBefore = lost.rng;
    step(lost);
    expect(lost.nextOvercrowdRollAt).toBe(lost.time);
    expect(lost.rng).toBe(rngBefore);
  });
});
