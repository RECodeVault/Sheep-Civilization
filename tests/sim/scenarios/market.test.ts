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
  boostRemainingMs: 0,
  threats: { starving: 0, infected: 0, carcasses: 0 },
});

describe('the Market in play', () => {
  it('selling an infected adult breaks the contagion chain: no virus death, no carcass', () => {
    const run = (sold: boolean): { died: number; carcasses: number; infected: number } => {
      const state = newGame(78);
      for (const o of state.sheep) o.fullness = TUNING.fullnessMax;
      const s = state.sheep[0];
      infectSheep(state, s);
      if (sold) applyCommand(state, { type: 'Sell', id: s.id });
      const events = runFor(state, TUNING.virusDeathMs + TICK_MS);
      return {
        died: events.filter((e) => e.type === 'SheepDied').length,
        carcasses: state.carcasses.length,
        infected: selectHudView(state, hud()).threats.infected,
      };
    };
    // Control: left alone, the infected sheep dies of the virus and leaves a carcass.
    expect(run(false)).toEqual({ died: 1, carcasses: 1, infected: 0 });
    expect(run(true)).toEqual({ died: 0, carcasses: 0, infected: 0 });
  });

  it('a pregnancy outlives a sold parent: the lamb is still born', () => {
    const state = newGame(78);
    const [a, b] = state.sheep;
    a.breedReady = b.breedReady = true;
    applyCommand(state, { type: 'Breed', a: a.id, b: b.id });
    expect(state.pregnancies).toHaveLength(1);
    applyCommand(state, { type: 'Sell', id: a.id });
    const events = runFor(state, TUNING.gestationMs);
    expect(events.filter((e) => e.type === 'LambBorn')).toHaveLength(1);
    expect(state.pregnancies).toEqual([]);
  });

  it('money adds up exactly across sales, with no cap (FR21)', () => {
    const state = newGame(78);
    state.sheep[1].bornAt = state.time - TUNING.elderFromMs;
    applyCommand(state, { type: 'Sell', id: state.sheep[0].id });
    applyCommand(state, { type: 'Sell', id: state.sheep[0].id });
    expect(state.money).toBe(TUNING.sellPriceAdult + TUNING.sellPriceElder);
    expect(state.stats.moneyEarned).toBe(TUNING.sellPriceAdult + TUNING.sellPriceElder);

    const rich = newGame(78);
    rich.money = 2 ** 40;
    applyCommand(rich, { type: 'Sell', id: rich.sheep[0].id });
    expect(rich.money).toBe(2 ** 40 + TUNING.sellPriceAdult);
  });

  it('the view path: picked up on one tick, sold on the next', () => {
    const state = newGame(78);
    const s = state.sheep[0];
    applyCommand(state, { type: 'PickUp', id: s.id });
    runFor(state, TICK_MS);
    applyCommand(state, { type: 'Sell', id: s.id });
    runFor(state, TICK_MS);
    expect(state.sheep.map((o) => o.id)).not.toContain(s.id);
    expect(state.money).toBe(TUNING.sellPriceAdult);
  });

  it('a lamb dropped on the Market (a Drop) walks again on the next tick', () => {
    const state = newGame(78);
    const lamb = state.sheep[2];
    applyCommand(state, { type: 'PickUp', id: lamb.id });
    applyCommand(state, { type: 'Sell', id: lamb.id });
    expect(lamb.activity).toBe('wander');
    expect(state.money).toBe(0);
    const [x, y] = [lamb.x, lamb.y];
    // Long enough to outlast any grazing stop.
    runFor(state, TUNING.wanderRestMaxMs * 2);
    expect(lamb.x !== x || lamb.y !== y).toBe(true);
  });
});
