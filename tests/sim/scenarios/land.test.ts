import { describe, expect, it } from 'vitest';
import { TICK_MS } from '../../../src/config/constants';
import { TUNING } from '../../../src/config/tuning';
import { applyCommand, type Command } from '../../../src/sim/commands';
import { drainEvents, type SimEvent } from '../../../src/sim/events';
import { capacity, fenceBounds, landTier, shopPrice } from '../../../src/sim/selectors';
import type { GameState, ShopItemId } from '../../../src/sim/state';
import { step } from '../../../src/sim/step';
import { fillFlock, innerFence, newGame, runFor } from '../helpers';

type Inner = ReturnType<typeof innerFence>;

/** Applies `cmds` in queue order, as GameScene does at the start of a tick, and returns their events. */
function apply(state: GameState, cmds: readonly Command[]): SimEvent[] {
  for (const c of cmds) applyCommand(state, c);
  const out: SimEvent[] = [];
  drainEvents((e) => out.push(e));
  return out;
}

/** Buys `item` through the real command, with exactly its price in hand. */
function buy(state: GameState, item: ShopItemId): SimEvent[] {
  state.money = shopPrice(item);
  return apply(state, [{ type: 'Buy', item }]);
}

const inside = (r: Inner, x: number, y: number): boolean => x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;

describe('buying land (FR22, Story 3.3)', () => {
  it('moves and changes nothing in the pasture on the tick it applies', () => {
    const state = newGame(31);
    fillFlock(state, 8);
    runFor(state, 2_000);
    apply(state, [{ type: 'Farm' }]);
    const before = structuredClone({
      sheep: state.sheep,
      food: state.foodPieces,
      breeding: state.breedingPieces,
      carcasses: state.carcasses,
      pregnancies: state.pregnancies,
    });
    const events = buy(state, 'land1');
    expect(events).toEqual([{ type: 'Bought', item: 'land1', price: shopPrice('land1') }]);
    expect({
      sheep: state.sheep,
      food: state.foodPieces,
      breeding: state.breedingPieces,
      carcasses: state.carcasses,
      pregnancies: state.pregnancies,
    }).toStrictEqual(before);
    expect(state.owned).toEqual(['land1']);
    expect(state.money).toBe(0);
  });

  it('lets wandering sheep use the larger area, never leaving the new fence', () => {
    const state = newGame(32);
    fillFlock(state, 10);
    const old = innerFence(state);
    buy(state, 'land1');
    const grown = innerFence(state);
    // A bounded wander: ten of the longest grazing stops, well inside a fed sheep's starveMs.
    const ms = 10 * TUNING.wanderRestMaxMs;
    expect(ms).toBeLessThan((TUNING.startFullness / TUNING.fullnessMax) * TUNING.starveMs);
    expect(ms % TICK_MS).toBe(0);
    let escaped = false;
    for (let t = 0; t < ms / TICK_MS; t++) {
      step(state);
      drainEvents(() => {});
      for (const s of state.sheep) {
        expect(inside(grown, s.x, s.y)).toBe(true);
        if (!inside(old, s.x, s.y)) escaped = true;
      }
    }
    expect(escaped).toBe(true);
  });

  it('drops new food and breeding pieces across the grown pen', () => {
    const state = newGame(33);
    const old = innerFence(state);
    buy(state, 'land3');
    // Land III without II is refused: nothing grew.
    expect(landTier(state)).toBe(0);
    buy(state, 'land1');
    buy(state, 'land2');
    buy(state, 'land3');
    const grown = innerFence(state);
    const farm: Command[] = [];
    for (let i = 0; i < TUNING.farmPipsPerFood * 20; i++) farm.push({ type: 'Farm' }, { type: 'FarmBreeding' });
    apply(state, farm);
    const pieces = [...state.foodPieces, ...state.breedingPieces];
    expect(state.foodPieces.length).toBeGreaterThan(0);
    expect(state.breedingPieces.length).toBeGreaterThan(0);
    for (const p of pieces) expect(inside(grown, p.x, p.y)).toBe(true);
    expect(state.foodPieces.some((p) => !inside(old, p.x, p.y))).toBe(true);
    expect(state.breedingPieces.some((p) => !inside(old, p.x, p.y))).toBe(true);
  });

  it('places a drop outside the old fence where it was dropped, and clamps only to the new one', () => {
    const state = newGame(34);
    buy(state, 'land1');
    const old = TUNING.landFences[0];
    const grown = innerFence(state);
    const id = state.sheep[0].id;
    // Left of the start fence, inside Land I's inner fence.
    const x = old.x - 20;
    const y = old.y - 20;
    expect(inside(grown, x, y)).toBe(true);
    apply(state, [{ type: 'PickUp', id }, { type: 'Drop', id, x, y }]);
    expect([state.sheep[0].x, state.sheep[0].y]).toEqual([x, y]);
    // Far outside everything: clamped to Land I's inner fence.
    apply(state, [{ type: 'PickUp', id }, { type: 'Drop', id, x: -10_000, y: -10_000 }]);
    expect([state.sheep[0].x, state.sheep[0].y]).toEqual([grown.left, grown.top]);
  });

  it('refuses a tier whose predecessor is not owned', () => {
    const state = newGame(35);
    for (const item of ['land2', 'land3'] as const) {
      const before = structuredClone(state);
      expect(buy(state, item)).toEqual([]);
      before.money = shopPrice(item);
      expect(state).toStrictEqual(before);
    }
    buy(state, 'land1');
    const before = structuredClone(state);
    expect(buy(state, 'land3')).toEqual([]);
    before.money = shopPrice('land3');
    expect(state).toStrictEqual(before);
  });

  it('climbs 10 → 25 → 50 → 100 with nested fences through the real Buy path', () => {
    const state = newGame(36);
    const caps = [capacity(state)];
    const fences = [fenceBounds(state)];
    for (const item of ['land1', 'land2', 'land3'] as const) {
      buy(state, item);
      caps.push(capacity(state));
      fences.push(fenceBounds(state));
    }
    expect(caps).toEqual([...TUNING.landCapacities]);
    expect(fences).toEqual([...TUNING.landFences]);
    expect(state.owned).toEqual(['land1', 'land2', 'land3']);
  });
});
