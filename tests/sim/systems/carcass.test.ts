import { describe, expect, it } from 'vitest';
import { TUNING } from '../../../src/config/tuning';
import { drainEvents, type SimEvent } from '../../../src/sim/events';
import { checkLastSheepAndLoss, killSheep } from '../../../src/sim/systems/carcass';
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

  it('counts the death and emits SheepDied at the sheep position', () => {
    const state = newGame(7);
    const s = state.sheep[1];
    killSheep(state, s.id, 'starved');
    expect(state.stats.died).toBe(1);
    expect(drained()).toEqual([{ type: 'SheepDied', id: s.id, cause: 'starved', x: s.x, y: s.y }]);
  });

  it('leaves no carcass while carcasses are disabled (Epic 1)', () => {
    expect(TUNING.carcassesEnabled).toBe(false);
    const state = newGame(7);
    const nextId = state.nextId;
    killSheep(state, state.sheep[0].id, 'starved');
    expect(state.carcasses).toEqual([]);
    expect(state.nextId).toBe(nextId);
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
    killSheep(state, last.id, 'starved');
    expect(state.lostAt).toBe(state.time);
    expect(drained()).toEqual([
      { type: 'SheepDied', id: last.id, cause: 'starved', x: last.x, y: last.y },
      { type: 'Lost', survivedMs: state.time, peakFlock: TUNING.interimFlockAdults },
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
