import { describe, expect, it } from 'vitest';
import { TICK_MS } from '../../../src/config/constants';
import { TUNING } from '../../../src/config/tuning';
import { applyCommand, type Command } from '../../../src/sim/commands';
import { drainEvents, type SimEvent } from '../../../src/sim/events';
import { capacity, DECORATIONS, fenceBounds, landTier, shopPrice, stageOf } from '../../../src/sim/selectors';
import type { GameState } from '../../../src/sim/state';
import { fillFlock, newGame, runFor } from '../helpers';

/** One frame's command batch, applied in queue order as GameScene does, then one tick. */
function tickWith(state: GameState, cmds: readonly Command[]): SimEvent[] {
  for (const c of cmds) applyCommand(state, c);
  const out: SimEvent[] = [];
  drainEvents((e) => out.push(e));
  return out.concat(runFor(state, TICK_MS));
}

/** Buys both decorations through the real commands, with exactly their prices in hand. */
function buyDecorations(state: GameState): SimEvent[] {
  state.money = shopPrice('flowerPatch') + shopPrice('scarecrow');
  return tickWith(
    state,
    DECORATIONS.map((item) => ({ type: 'Buy', item }) as const),
  );
}

/** The same frames for any game: clicks every few ticks, and a sale once an adult can be sold. */
function playScript(state: GameState): SimEvent[] {
  const events: SimEvent[] = [];
  const ticks = TUNING.lambUntilMs / TICK_MS;
  const saleTick = Math.floor(ticks / 2);
  for (let t = 0; t < ticks; t++) {
    const cmds: Command[] = [];
    if (t % 5 === 0) cmds.push({ type: 'Farm' });
    if (t % 7 === 0) cmds.push({ type: 'FarmBreeding' });
    if (t === saleTick) {
      const adult = state.sheep.find((s) => stageOf(s, state) === 'adult');
      if (adult !== undefined) cmds.push({ type: 'Sell', id: adult.id });
    }
    events.push(...tickWith(state, cmds));
  }
  return events;
}

describe('decorations are cosmetic (FR23, Story 3.4)', () => {
  it('a purchase changes only money and owned, and emits only Bought', () => {
    const state = newGame(41);
    fillFlock(state, 6);
    state.money = shopPrice('flowerPatch') + shopPrice('scarecrow');
    const control = structuredClone(state);
    const events = buyDecorations(state);
    const controlEvents = tickWith(control, []);

    expect(state.owned).toEqual(['flowerPatch', 'scarecrow']);
    expect(state.money).toBe(0);
    expect(events.filter((e) => e.type === 'Bought')).toEqual([
      { type: 'Bought', item: 'flowerPatch', price: shopPrice('flowerPatch') },
      { type: 'Bought', item: 'scarecrow', price: shopPrice('scarecrow') },
    ]);
    expect(events.filter((e) => e.type !== 'Bought')).toStrictEqual(controlEvents);
    expect({ ...state, money: control.money, owned: control.owned }).toStrictEqual(control);
  });

  it('a game that owns both plays out exactly like one that does not', () => {
    const a = newGame(77);
    const b = newGame(77);
    fillFlock(a, 5);
    fillFlock(b, 5);
    const money = a.money;
    buyDecorations(b);
    // The purchase tick: run A through the same tick, then give B the same money back.
    tickWith(a, []);
    b.money = money;
    expect(b.owned).toEqual(['flowerPatch', 'scarecrow']);

    const eventsA = playScript(a);
    const eventsB = playScript(b);
    // Guard against a vacuous pass: the script's sale must really happen.
    expect(eventsA.some((e) => e.type === 'Sold')).toBe(true);
    expect(eventsB).toStrictEqual(eventsA);
    expect({ ...b, owned: a.owned }).toStrictEqual(a);
  });

  it('owning decorations leaves capacity and the fence at the start tier', () => {
    const state = newGame(5);
    buyDecorations(state);
    expect(state.owned).toEqual(['flowerPatch', 'scarecrow']);
    expect(landTier(state)).toBe(0);
    expect(capacity(state)).toBe(TUNING.landCapacities[0]);
    expect(fenceBounds(state)).toBe(TUNING.landFences[0]);
  });
});
