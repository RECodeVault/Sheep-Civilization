import { describe, expect, it } from 'vitest';
import { TUNING } from '../../../src/config/tuning';
import { applyCommand } from '../../../src/sim/commands';
import { drainEvents, type SimEvent } from '../../../src/sim/events';
import { createSheep } from '../../../src/sim/state';
import { sacrifice } from '../../../src/sim/systems/betterPlace';
import { pickUp } from '../../../src/sim/systems/drag';
import { infectSheep } from '../../../src/sim/systems/virus';
import { newGame } from '../helpers';

function drained(): SimEvent[] {
  const out: SimEvent[] = [];
  drainEvents((e) => out.push(e));
  return out;
}

describe('sacrifice (Sacrifice command)', () => {
  it('removes the sheep with no carcass, counts it and emits only Sacrificed', () => {
    const state = newGame(5);
    const s = state.sheep[1];
    const others = [state.sheep[0], state.sheep[2]];
    const nextId = state.nextId;
    const rng = state.rng;
    applyCommand(state, { type: 'Sacrifice', id: s.id });
    expect(state.sheep).toEqual(others);
    expect(state.carcasses).toEqual([]);
    expect(state.stats.sacrificed).toBe(1);
    expect(state.stats.died).toBe(0);
    expect(state.nextId).toBe(nextId);
    expect(state.rng).toBe(rng);
    expect(drained()).toEqual([{ type: 'Sacrificed', id: s.id, wasAbomination: false }]);
  });

  it('sacrificing the last sheep loses the game: Sacrificed, then Lost', () => {
    const state = newGame(5);
    state.time = 3_000;
    const ids = state.sheep.map((s) => s.id);
    for (const id of ids.slice(0, -1)) sacrifice(state, id);
    drained();
    const last = ids[ids.length - 1];
    sacrifice(state, last);
    expect(state.lostAt).toBe(state.time);
    expect(drained()).toEqual([
      { type: 'Sacrificed', id: last, wasAbomination: false },
      { type: 'Lost', survivedMs: state.time, peakFlock: TUNING.startFlockAdults + TUNING.startFlockLambs },
    ]);
  });

  it('silently ignores an unknown id', () => {
    const state = newGame(5);
    const before = structuredClone(state);
    sacrifice(state, 9_999);
    expect(state).toStrictEqual(before);
    expect(drained()).toEqual([]);
  });

  it('takes any sheep: dragged, infected, lamb and elder', () => {
    const state = newGame(5);
    const [adult, , lamb] = state.sheep;
    pickUp(state, adult.id);
    infectSheep(state, adult);
    const elder = createSheep(state, { x: adult.x, y: adult.y, bornAt: state.time - TUNING.elderFromMs });
    drained();
    for (const id of [adult.id, lamb.id, elder.id]) sacrifice(state, id);
    expect(state.sheep.map((s) => s.id)).not.toContain(adult.id);
    expect(state.sheep.map((s) => s.id)).not.toContain(lamb.id);
    expect(state.sheep.map((s) => s.id)).not.toContain(elder.id);
    expect(state.stats.sacrificed).toBe(3);
    expect(drained().map((e) => e.type)).toEqual(['Sacrificed', 'Sacrificed', 'Sacrificed']);
  });
});
