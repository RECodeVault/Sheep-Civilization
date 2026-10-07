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
    const run = (sacrificed: boolean): { died: number; carcasses: number; infected: number } => {
      const state = newGame(77);
      for (const o of state.sheep) o.fullness = TUNING.fullnessMax;
      const s = state.sheep[0];
      infectSheep(state, s);
      if (sacrificed) applyCommand(state, { type: 'Sacrifice', id: s.id });
      const events = runFor(state, TUNING.virusDeathMs + TICK_MS);
      return {
        died: events.filter((e) => e.type === 'SheepDied').length,
        carcasses: state.carcasses.length,
        infected: selectHudView(state, hud()).threats.infected,
      };
    };
    // Control: left alone, the infected sheep dies of the virus and leaves a carcass for the chain.
    expect(run(false)).toEqual({ died: 1, carcasses: 1, infected: 0 });
    expect(run(true)).toEqual({ died: 0, carcasses: 0, infected: 0 });
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
    // Runs out in 5 ticks.
    s.fullness = (TUNING.fullnessMax * 5 * TICK_MS) / TUNING.starveMs;
    applyCommand(state, { type: 'PickUp', id: s.id });
    runFor(state, 10 * TICK_MS);
    expect(state.sheep.find((o) => o.id === s.id)).toBeUndefined();
    expect(state.carcasses).toEqual([expect.objectContaining({ x, y })]);
  });
});
