import { describe, expect, it } from 'vitest';
import { TUNING } from '../../../src/config/tuning';
import { drainEvents, type SimEvent } from '../../../src/sim/events';
import { killSheep } from '../../../src/sim/systems/carcass';
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
