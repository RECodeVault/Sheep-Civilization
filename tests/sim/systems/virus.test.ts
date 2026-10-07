import { describe, expect, it } from 'vitest';
import { TICK_MS } from '../../../src/config/constants';
import { TUNING } from '../../../src/config/tuning';
import { drainEvents, type SimEvent } from '../../../src/sim/events';
import { infectSheep, updateVirus } from '../../../src/sim/systems/virus';
import { newGame } from '../helpers';

function drained(): SimEvent[] {
  const out: SimEvent[] = [];
  drainEvents((e) => out.push(e));
  return out;
}

describe('infectSheep (FR15)', () => {
  it('records the infection time and emits Infected at the sheep', () => {
    const state = newGame(25);
    state.time = 3_000;
    const s = state.sheep[1];
    infectSheep(state, s);
    expect(s.infectedAt).toBe(3_000);
    expect(drained()).toEqual([{ type: 'Infected', id: s.id, x: s.x, y: s.y }]);
  });

  it('infects once: a second call keeps the first time and emits nothing', () => {
    const state = newGame(25);
    const s = state.sheep[0];
    infectSheep(state, s);
    drained();
    state.time = 9_000;
    const before = structuredClone(state);
    infectSheep(state, s);
    expect(state).toStrictEqual(before);
    expect(drained()).toEqual([]);
  });
});

describe('updateVirus (FR15)', () => {
  it('kills an infected sheep exactly virusDeathMs after infection, as a virus death leaving a carcass', () => {
    const state = newGame(25);
    const s = state.sheep[0];
    s.infectedAt = 1_000;
    drained();
    state.time = 1_000 + TUNING.virusDeathMs - TICK_MS;
    updateVirus(state);
    expect(state.sheep).toContain(s);
    expect(drained()).toEqual([]);

    state.time += TICK_MS;
    const carcassId = state.nextId;
    updateVirus(state);
    expect(state.sheep.some((x) => x.id === s.id)).toBe(false);
    expect(state.stats.died).toBe(1);
    expect(state.carcasses).toEqual([{ id: carcassId, x: s.x, y: s.y, createdAt: state.time }]);
    expect(drained()).toEqual([
      { type: 'SheepDied', id: s.id, cause: 'virus', x: s.x, y: s.y },
      { type: 'CarcassSpawned', id: carcassId, x: s.x, y: s.y },
    ]);
  });

  it('leaves healthy sheep alone and draws no rng', () => {
    const state = newGame(25);
    state.time = 10 * TUNING.virusDeathMs;
    const before = structuredClone(state);
    updateVirus(state);
    expect(state).toStrictEqual(before);
    expect(drained()).toEqual([]);
  });

  it('kills every sheep due on one tick, in array order', () => {
    const state = newGame(25);
    const [a, , c] = state.sheep;
    a.infectedAt = 0;
    c.infectedAt = 0;
    state.time = TUNING.virusDeathMs;
    updateVirus(state);
    const died = drained().filter((e) => e.type === 'SheepDied');
    expect(died.map((e) => (e.type === 'SheepDied' ? e.id : 0))).toEqual([a.id, c.id]);
    expect(state.sheep).toHaveLength(1);
  });

  it('a virus death of the last sheep loses the game', () => {
    const state = newGame(25);
    for (const s of state.sheep) s.infectedAt = 0;
    state.time = TUNING.virusDeathMs;
    updateVirus(state);
    expect(state.lostAt).toBe(state.time);
    const types = drained().map((e) => e.type);
    expect(types.at(-1)).toBe('Lost');
    expect(types.filter((t) => t === 'SheepDied')).toHaveLength(3);
  });
});
