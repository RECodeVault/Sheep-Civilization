import { describe, expect, it } from 'vitest';
import { TICK_MS } from '../../../src/config/constants';
import { TUNING } from '../../../src/config/tuning';
import { applyCommand } from '../../../src/sim/commands';
import { selectHudView, type HudView } from '../../../src/sim/selectors';
import { infectSheep } from '../../../src/sim/systems/virus';
import { newGame, runFor } from '../helpers';

const hud = (): HudView => ({
  farmProgress: 0,
  farmPipsPerFood: 0,
  breedingProgress: 0,
  breedingPipsPerFood: 0,
  breedBlock: null,
  threats: { starving: 0, infected: 0, carcasses: 0 },
});

describe('the Better Place in play', () => {
  it('breaks the contagion chain: an infected sheep sacrificed leaves no carcass and no virus death', () => {
    const state = newGame(77);
    const s = state.sheep[0];
    infectSheep(state, s);
    applyCommand(state, { type: 'Sacrifice', id: s.id });
    const events = runFor(state, TUNING.virusDeathMs + TICK_MS);
    expect(events.filter((e) => e.type === 'SheepDied')).toEqual([]);
    expect(state.carcasses).toEqual([]);
    expect(selectHudView(state, hud()).threats.infected).toBe(0);
    expect(state.stats.sacrificed).toBe(1);
  });

  it('a pregnancy outlives a sacrificed parent: the lamb is still born', () => {
    const state = newGame(77);
    const [a, b] = state.sheep;
    a.breedReady = b.breedReady = true;
    applyCommand(state, { type: 'Breed', a: a.id, b: b.id });
    expect(state.pregnancies).toHaveLength(1);
    applyCommand(state, { type: 'Sacrifice', id: a.id });
    const events = runFor(state, TUNING.gestationMs);
    expect(events.filter((e) => e.type === 'LambBorn')).toHaveLength(1);
    expect(state.pregnancies).toEqual([]);
  });

  it('a sheep picked up and held until it starves leaves its carcass at the pickup spot', () => {
    const state = newGame(77);
    const s = state.sheep[0];
    const [x, y] = [s.x, s.y];
    s.fullness = 2;
    applyCommand(state, { type: 'PickUp', id: s.id });
    runFor(state, 5_000);
    expect(state.sheep.find((o) => o.id === s.id)).toBeUndefined();
    expect(state.carcasses).toEqual([expect.objectContaining({ x, y })]);
  });
});
