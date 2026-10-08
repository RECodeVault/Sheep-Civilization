import { describe, expect, it } from 'vitest';
import { TICK_MS } from '../../../src/config/constants';
import { TUNING } from '../../../src/config/tuning';
import { drainEvents, type SimEvent } from '../../../src/sim/events';
import { stageOf } from '../../../src/sim/selectors';
import { createSheep, type GameState } from '../../../src/sim/state';
import { step } from '../../../src/sim/step';
import { innerFence, newGame } from '../helpers';

/** A game whose flock is replaced by sheep of the given ages (ms) at time 0, all full. */
function gameWithAges(ages: readonly number[]): GameState {
  const state = newGame(42);
  state.sheep.length = 0;
  // Forget the discarded new-game flock, so peakFlock counts only these sheep.
  state.stats.peakFlock = 0;
  const r = innerFence(state);
  ages.forEach((age, i) => {
    createSheep(state, { x: r.left + 40 * i, y: r.top, bornAt: state.time - age });
  });
  return state;
}

/** Steps `ticks` ticks with every sheep kept full, so hunger never interferes. Returns the events. */
function runFed(state: GameState, ticks: number): SimEvent[] {
  const events: SimEvent[] = [];
  for (let i = 0; i < ticks; i++) {
    for (const s of state.sheep) s.fullness = TUNING.fullnessMax;
    step(state);
    drainEvents((e) => events.push(e));
  }
  return events;
}

describe('updateLifecycle', () => {
  it('an old-age death leaves a carcass at the elder’s last position (FR12)', () => {
    const state = gameWithAges([TUNING.oldAgeMs - TICK_MS, TUNING.lambUntilMs]);
    const elder = state.sheep[0];
    runFed(state, 1);
    expect(state.carcasses).toHaveLength(1);
    expect(state.carcasses[0]).toMatchObject({ x: elder.x, y: elder.y, createdAt: state.time });
  });

  it('never kills the Abomination of old age: it stays a lamb past oldAgeMs (FR30)', () => {
    const state = gameWithAges([TUNING.oldAgeMs - TICK_MS, TUNING.lambUntilMs]);
    const [abom, other] = state.sheep;
    abom.isAbomination = true;
    const events = runFed(state, 5);
    expect(state.time - abom.bornAt).toBeGreaterThan(TUNING.oldAgeMs);
    expect(events).toEqual([]);
    expect(state.sheep.map((s) => s.id)).toEqual([abom.id, other.id]);
    expect(stageOf(abom, state)).toBe('lamb');
  });

  it('the Abomination still starves: an ordinary death with a carcass (FR30)', () => {
    const state = gameWithAges([0, TUNING.lambUntilMs]);
    const [abom, other] = state.sheep;
    abom.isAbomination = true;
    // Starvation only: no visit (Story 4.3's kill cycle) before it starves.
    state.abomination.nextKillAt = state.time + TUNING.starveMs + TICK_MS;
    const events: SimEvent[] = [];
    for (let t = 0; t < TUNING.starveMs / TICK_MS; t++) {
      other.fullness = TUNING.fullnessMax;
      step(state);
      drainEvents((e) => events.push(e));
    }
    expect(state.sheep.map((s) => s.id)).toEqual([other.id]);
    expect(events).toEqual([
      { type: 'SheepDied', id: abom.id, cause: 'starved', x: abom.x, y: abom.y },
      { type: 'CarcassSpawned', id: expect.any(Number), x: abom.x, y: abom.y },
    ]);
  });

  it('kills an elder on exactly the tick its age reaches oldAgeMs', () => {
    // After one step this elder is aged oldAgeMs − TICK_MS; after two, exactly oldAgeMs.
    const state = gameWithAges([TUNING.oldAgeMs - 2 * TICK_MS, TUNING.lambUntilMs]);
    const [elder, other] = state.sheep;
    expect(runFed(state, 1)).toEqual([]);
    expect(state.sheep.map((s) => s.id)).toEqual([elder.id, other.id]);
    expect(stageOf(elder, state)).toBe('elder');

    const carcassId = state.nextId;
    const events = runFed(state, 1);
    expect(state.time - elder.bornAt).toBe(TUNING.oldAgeMs);
    expect(state.carcasses.map((c) => c.id)).toEqual([carcassId]);
    expect(events).toEqual([
      { type: 'SheepDied', id: elder.id, cause: 'oldAge', x: elder.x, y: elder.y },
      { type: 'CarcassSpawned', id: carcassId, x: elder.x, y: elder.y },
    ]);
    expect(state.sheep.map((s) => s.id)).toEqual([other.id]);
    expect(state.stats.died).toBe(1);
  });

  it('clears breedReady on exactly the tick a ready adult turns elder (FR8a)', () => {
    // After one step this adult is aged elderFromMs − TICK_MS; after two, exactly elderFromMs.
    const state = gameWithAges([TUNING.elderFromMs - 2 * TICK_MS, TUNING.lambUntilMs]);
    const [ageing, young] = state.sheep;
    ageing.breedReady = true;
    young.breedReady = true;
    runFed(state, 1);
    expect(ageing.breedReady).toBe(true);
    runFed(state, 1);
    expect(state.time - ageing.bornAt).toBe(TUNING.elderFromMs);
    expect(ageing.breedReady).toBe(false);
    expect(young.breedReady).toBe(true);
  });

  it('clears breedReady on a lamb (a corrupt save): only adults can be ready', () => {
    const state = gameWithAges([0, TUNING.lambUntilMs]);
    const [lamb, adult] = state.sheep;
    lamb.breedReady = true;
    adult.breedReady = true;
    runFed(state, 1);
    expect(lamb.breedReady).toBe(false);
    expect(adult.breedReady).toBe(true);
  });

  it('leaves lambs, adults and younger elders alone', () => {
    const state = gameWithAges([0, TUNING.lambUntilMs, TUNING.elderFromMs, TUNING.oldAgeMs - 10 * TICK_MS]);
    const ids = state.sheep.map((s) => s.id);
    expect(runFed(state, 9)).toEqual([]);
    expect(state.sheep.map((s) => s.id)).toEqual(ids);
  });

  it('kills every elder that reaches oldAgeMs on the same tick, in array order', () => {
    const state = gameWithAges([TUNING.oldAgeMs - TICK_MS, TUNING.lambUntilMs, TUNING.oldAgeMs - TICK_MS]);
    const [a, b, c] = state.sheep;
    const events = runFed(state, 1);
    expect(events.filter((e) => e.type === 'SheepDied').map((e) => e.id)).toEqual([a.id, c.id]);
    expect(state.sheep.map((s) => s.id)).toEqual([b.id]);
    expect(state.stats.died).toBe(2);
  });

  it('the last sheep dying of old age loses the game, Lost after SheepDied', () => {
    const state = gameWithAges([TUNING.oldAgeMs - TICK_MS]);
    const s = state.sheep[0];
    const carcassId = state.nextId;
    const events = runFed(state, 1);
    expect(events).toEqual([
      { type: 'SheepDied', id: s.id, cause: 'oldAge', x: s.x, y: s.y },
      { type: 'CarcassSpawned', id: carcassId, x: s.x, y: s.y },
      { type: 'Lost', survivedMs: TICK_MS, peakFlock: 1 },
    ]);
    expect(state.lostAt).toBe(TICK_MS);
  });

  it('a lamb is born on exactly the tick time reaches dueAt, at the parents’ midpoint (FR9)', () => {
    const state = gameWithAges([TUNING.lambUntilMs, TUNING.lambUntilMs]);
    const [a, b] = state.sheep;
    // Grazing, so the parents stay put and the midpoint is known.
    a.restUntil = b.restUntil = 1e9;
    const id = state.nextId++;
    state.pregnancies.push({ id, parentA: a.id, parentB: b.id, dueAt: state.time + 2 * TICK_MS, x: 0, y: 0 });
    expect(runFed(state, 1)).toEqual([]);
    expect(state.sheep).toHaveLength(2);

    const events = runFed(state, 1);
    expect(state.sheep).toHaveLength(3);
    const lamb = state.sheep[2];
    expect(lamb.bornAt).toBe(state.time);
    expect(stageOf(lamb, state)).toBe('lamb');
    expect(lamb.x).toBe((a.x + b.x) / 2);
    expect(lamb.y).toBe((a.y + b.y) / 2);
    expect(state.pregnancies).toEqual([]);
    expect(events).toEqual([{ type: 'LambBorn', id: lamb.id, pregnancyId: id, x: lamb.x, y: lamb.y }]);
    expect(state.stats.peakFlock).toBe(3);
  });

  it('a lamb whose parents are gone is born at the pregnancy’s spot, clamped to the inner fence', () => {
    const state = gameWithAges([TUNING.lambUntilMs]);
    const r = innerFence(state);
    state.pregnancies.push({ id: state.nextId++, parentA: 900, parentB: 901, dueAt: state.time + TICK_MS, x: r.right, y: r.bottom });
    runFed(state, 1);
    const lamb = state.sheep[1];
    expect([lamb.x, lamb.y]).toEqual([r.right, r.bottom]);
  });

  it('with one parent left, the lamb is born at that parent', () => {
    const state = gameWithAges([TUNING.lambUntilMs]);
    const p = state.sheep[0];
    p.restUntil = 1e9;
    state.pregnancies.push({ id: state.nextId++, parentA: 900, parentB: p.id, dueAt: state.time + TICK_MS, x: 0, y: 0 });
    runFed(state, 1);
    expect([state.sheep[1].x, state.sheep[1].y]).toEqual([p.x, p.y]);
  });

  it('lambs due on the same tick are born in pregnancy order (ids and rng draws follow it)', () => {
    const state = gameWithAges([TUNING.lambUntilMs]);
    const r = innerFence(state);
    const first = state.nextId++;
    const second = state.nextId++;
    state.pregnancies.push({ id: first, parentA: 900, parentB: 901, dueAt: state.time + TICK_MS, x: r.left, y: r.top });
    state.pregnancies.push({ id: second, parentA: 902, parentB: 903, dueAt: state.time + TICK_MS, x: r.right, y: r.top });
    const events = runFed(state, 1);
    const born = events.filter((e) => e.type === 'LambBorn');
    expect(born.map((e) => e.type === 'LambBorn' && e.pregnancyId)).toEqual([first, second]);
    const [a, b] = born.map((e) => (e.type === 'LambBorn' ? e.id : 0));
    expect(a).toBeLessThan(b);
    expect(state.pregnancies).toEqual([]);
  });

  it('births run before old age: a lamb due as the last sheep dies keeps the game going', () => {
    const state = gameWithAges([TUNING.oldAgeMs - TICK_MS]);
    const r = innerFence(state);
    const old = state.sheep[0];
    state.pregnancies.push({ id: state.nextId++, parentA: old.id, parentB: 900, dueAt: state.time + TICK_MS, x: r.left, y: r.top });
    const events = runFed(state, 1);
    expect(events.map((e) => e.type)).toEqual(['LambBorn', 'SheepDied', 'CarcassSpawned']);
    expect(state.lostAt).toBeUndefined();
    expect(state.sheep).toHaveLength(1);
  });

  it('a whole flock of elders dying on one tick: every SheepDied and its carcass, then one Lost', () => {
    const state = gameWithAges([TUNING.oldAgeMs - TICK_MS, TUNING.oldAgeMs - TICK_MS]);
    const [a, b] = state.sheep;
    // Each death takes the next id for its carcass, in array order.
    const first = state.nextId;
    const events = runFed(state, 1);
    expect(state.carcasses.map((c) => c.id)).toEqual([first, first + 1]);
    expect(events).toEqual([
      { type: 'SheepDied', id: a.id, cause: 'oldAge', x: a.x, y: a.y },
      { type: 'CarcassSpawned', id: first, x: a.x, y: a.y },
      { type: 'SheepDied', id: b.id, cause: 'oldAge', x: b.x, y: b.y },
      { type: 'CarcassSpawned', id: first + 1, x: b.x, y: b.y },
      { type: 'Lost', survivedMs: TICK_MS, peakFlock: 2 },
    ]);
    expect(state.sheep).toEqual([]);
    expect(state.stats.died).toBe(2);
  });
});
