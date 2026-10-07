import { describe, expect, it } from 'vitest';
import { TUNING } from '../../../src/config/tuning';
import { drainEvents, type SimEvent } from '../../../src/sim/events';
import { checkLastSheepAndLoss, clearCarcass, createCarcass, killSheep } from '../../../src/sim/systems/carcass';
import { newGame } from '../helpers';

function drained(): SimEvent[] {
  const out: SimEvent[] = [];
  drainEvents((e) => out.push(e));
  return out;
}

describe('killSheep', () => {
  it('removes exactly that sheep and keeps the others in order', () => {
    const state = newGame(7);
    const [a, b, c] = state.sheep;
    killSheep(state, b.id, 'starved');
    expect(state.sheep).toEqual([a, c]);
  });

  it('counts the death and emits SheepDied, then CarcassSpawned, at the sheep position', () => {
    const state = newGame(7);
    const s = state.sheep[1];
    const carcassId = state.nextId;
    killSheep(state, s.id, 'starved');
    expect(state.stats.died).toBe(1);
    expect(drained()).toEqual([
      { type: 'SheepDied', id: s.id, cause: 'starved', x: s.x, y: s.y },
      { type: 'CarcassSpawned', id: carcassId, x: s.x, y: s.y },
    ]);
  });

  it('leaves a carcass at the sheep position (FR12), taking the next id and no rng', () => {
    expect(TUNING.carcassesEnabled).toBe(true);
    const state = newGame(7);
    state.time = 4_200;
    const s = state.sheep[0];
    const nextId = state.nextId;
    const rng = state.rng;
    killSheep(state, s.id, 'oldAge');
    expect(state.carcasses).toEqual([{ id: nextId, x: s.x, y: s.y, createdAt: state.time }]);
    expect(state.nextId).toBe(nextId + 1);
    expect(state.rng).toBe(rng);
  });

  it('rejects an unknown id without changing the state', () => {
    const state = newGame(7);
    const before = structuredClone(state);
    expect(() => killSheep(state, 9_999, 'starved')).toThrow(/killSheep/);
    expect(state).toEqual(before);
    expect(drained()).toEqual([]);
  });
});

describe('checkLastSheepAndLoss', () => {
  it('killing the last sheep loses the game: lostAt is set and Lost follows the last SheepDied', () => {
    const state = newGame(7);
    state.time = 4_200;
    const ids = state.sheep.map((s) => s.id);
    for (const id of ids.slice(0, -1)) killSheep(state, id, 'starved');
    drained();
    const last = state.sheep[0];
    const carcassId = state.nextId;
    killSheep(state, last.id, 'starved');
    expect(state.lostAt).toBe(state.time);
    expect(drained()).toEqual([
      { type: 'SheepDied', id: last.id, cause: 'starved', x: last.x, y: last.y },
      { type: 'CarcassSpawned', id: carcassId, x: last.x, y: last.y },
      { type: 'Lost', survivedMs: state.time, peakFlock: TUNING.startFlockAdults + TUNING.startFlockLambs },
    ]);
  });

  it('a death that leaves sheep alive is not a loss', () => {
    const state = newGame(7);
    killSheep(state, state.sheep[0].id, 'starved');
    expect('lostAt' in state).toBe(false);
    expect(drained().some((e) => e.type === 'Lost')).toBe(false);
  });

  it('does nothing while sheep are alive', () => {
    const state = newGame(7);
    const before = structuredClone(state);
    checkLastSheepAndLoss(state);
    expect(state).toStrictEqual(before);
    expect(drained()).toEqual([]);
  });

  it('fires once: a second check on a lost game changes nothing', () => {
    const state = newGame(7);
    for (const id of state.sheep.map((s) => s.id)) killSheep(state, id, 'starved');
    drained();
    state.time += 1_000;
    const before = structuredClone(state);
    checkLastSheepAndLoss(state);
    expect(state).toStrictEqual(before);
    expect(drained()).toEqual([]);
  });
});

describe('createCarcass', () => {
  it('adds a carcass at (x, y) with the next id and the current time, emitting nothing', () => {
    const state = newGame(7);
    state.time = 1_000;
    const id = state.nextId;
    const c = createCarcass(state, 600, 400);
    expect(c).toEqual({ id, x: 600, y: 400, createdAt: 1_000 });
    expect(state.carcasses).toEqual([c]);
    expect(drained()).toEqual([]);
  });
});

describe('clearCarcass (FR13)', () => {
  it('removes exactly that carcass, keeps the others in order and emits CarcassCleared', () => {
    const state = newGame(7);
    const a = createCarcass(state, 600, 400);
    const b = createCarcass(state, 650, 420);
    const c = createCarcass(state, 700, 440);
    clearCarcass(state, b.id);
    expect(state.carcasses).toEqual([a, c]);
    expect(drained()).toEqual([{ type: 'CarcassCleared', id: b.id, x: b.x, y: b.y }]);
  });

  it.each([
    ['an unknown id', (_s: ReturnType<typeof newGame>) => 9_999],
    ["a sheep's id", (s: ReturnType<typeof newGame>) => s.sheep[0].id],
  ])('ignores %s: no change, no event, no throw', (_name, idOf) => {
    const state = newGame(7);
    createCarcass(state, 600, 400);
    const before = structuredClone(state);
    clearCarcass(state, idOf(state));
    expect(state).toStrictEqual(before);
    expect(drained()).toEqual([]);
  });

  it('a second clear of the same id changes nothing', () => {
    const state = newGame(7);
    const c = createCarcass(state, 600, 400);
    clearCarcass(state, c.id);
    drained();
    const before = structuredClone(state);
    clearCarcass(state, c.id);
    expect(state).toStrictEqual(before);
    expect(drained()).toEqual([]);
  });
});
