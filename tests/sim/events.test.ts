import { beforeEach, describe, expect, it } from 'vitest';
import { clearEvents, drainEvents, emit, type SimEvent } from '../../src/sim/events';

const died = (id: number): SimEvent => ({ type: 'SheepDied', id, cause: 'starved', x: 0, y: 0 });

function drainAll(): SimEvent[] {
  const out: SimEvent[] = [];
  drainEvents((e) => out.push(e));
  return out;
}

describe('sim event queue', () => {
  beforeEach(() => clearEvents());

  it('drains in emit order and empties the queue', () => {
    emit(died(1));
    emit(died(2));
    expect(drainAll().map((e) => e.id)).toEqual([1, 2]);
    expect(drainAll()).toEqual([]);
  });

  it('delivers events emitted during a drain in the same drain', () => {
    emit(died(1));
    const seen: number[] = [];
    drainEvents((e) => {
      seen.push(e.id);
      if (e.id === 1) emit(died(2));
    });
    expect(seen).toEqual([1, 2]);
    expect(drainAll()).toEqual([]);
  });

  it('delivers each event at most once when a handler throws', () => {
    emit(died(1));
    emit(died(2));
    emit(died(3));
    const seen: number[] = [];
    expect(() =>
      drainEvents((e) => {
        seen.push(e.id);
        if (e.id === 2) throw new Error('listener failed');
      }),
    ).toThrow('listener failed');
    expect(drainAll().map((e) => e.id)).toEqual([3]);
    expect(seen).toEqual([1, 2]);
  });

  it('clearEvents drops pending events', () => {
    emit(died(1));
    clearEvents();
    expect(drainAll()).toEqual([]);
  });
});
