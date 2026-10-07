import { describe, expect, it } from 'vitest';
import { TUNING } from '../../src/config/tuning';
import { applyCommand } from '../../src/sim/commands';
import {
  boostRemainingMs,
  breedBlock,
  canBreed,
  capacity,
  carcassIndex,
  farmPipsPerClick,
  FULLNESS_EPSILON,
  isBoosted,
  hungerOf,
  isLost,
  onCooldown,
  publicSheep,
  buyBlock,
  salePrice,
  selectShopView,
  SHOP_ITEMS,
  shopPrice,
  shopRequires,
  type ShopRowView,
  selectBreedingPieces,
  selectCarcasses,
  selectFoodPieces,
  selectHudView,
  selectLoseView,
  selectPregnancies,
  selectPublicSheep,
  slotsUsed,
  stageOf,
  type HudView,
  type LoseView,
  type PublicPregnancy,
  type PublicSheep,
} from '../../src/sim/selectors';
import { createCarcass, killSheep } from '../../src/sim/systems/carcass';
import { infectSheep } from '../../src/sim/systems/virus';
import { busyGame } from '../save/busy';
import { fillFlock, newGame, runFor } from './helpers';

describe('hungerOf', () => {
  it('is fed only above fedAbove', () => {
    expect(hungerOf(TUNING.fullnessMax)).toBe('fed');
    expect(hungerOf(TUNING.fedAbove + 0.0001)).toBe('fed');
    expect(hungerOf(TUNING.fedAbove)).toBe('hungry');
  });

  it('is hungry down to starvingBelow inclusive', () => {
    expect(hungerOf(TUNING.starvingBelow)).toBe('hungry');
    expect(hungerOf(TUNING.starvingBelow - 0.0001)).toBe('starving');
    expect(hungerOf(0)).toBe('starving');
  });
});

describe('stageOf', () => {
  it('derives the stage from age at the thresholds', () => {
    const state = newGame();
    const s = state.sheep[0];
    state.time = 1_000_000;
    const at = (ageMs: number) => {
      s.bornAt = state.time - ageMs;
      return stageOf(s, state);
    };
    expect(at(0)).toBe('lamb');
    expect(at(TUNING.lambUntilMs - 1)).toBe('lamb');
    expect(at(TUNING.lambUntilMs)).toBe('adult');
    expect(at(TUNING.elderFromMs - 1)).toBe('adult');
    expect(at(TUNING.elderFromMs)).toBe('elder');
  });

  it('reads the founding adults as adults and the newborn as a lamb at time 0', () => {
    const state = newGame();
    expect(state.sheep.map((s) => stageOf(s, state))).toEqual(['adult', 'adult', 'lamb']);
  });
});

describe('publicSheep / selectPublicSheep', () => {
  it('exposes stage and hunger', () => {
    const state = newGame();
    const s = state.sheep[0];
    s.fullness = TUNING.starvingBelow - 1;
    expect(publicSheep(s, state)).toEqual({ id: s.id, x: s.x, y: s.y, stage: 'adult', hunger: 'starving', ready: false, onCooldown: false, canBreed: false, infected: false });
  });

  it('exposes breedReady as ready', () => {
    const state = newGame();
    const s = state.sheep[0];
    s.breedReady = true;
    expect(publicSheep(s, state).ready).toBe(true);
    const out: PublicSheep[] = [];
    selectPublicSheep(state, out);
    expect(out.map((p) => p.ready)).toEqual([true, false, false]);
    s.breedReady = false;
    selectPublicSheep(state, out);
    expect(out[0].ready).toBe(false);
  });

  it('exposes infected from infectedAt (FR15), and updates a reused out object', () => {
    const state = newGame();
    const s = state.sheep[0];
    expect(publicSheep(s, state).infected).toBe(false);
    const out: PublicSheep[] = [];
    selectPublicSheep(state, out);
    expect(out.map((p) => p.infected)).toEqual([false, false, false]);
    s.infectedAt = state.time;
    expect(publicSheep(s, state).infected).toBe(true);
    const first = out[0];
    selectPublicSheep(state, out);
    expect(out[0]).toBe(first);
    expect(out.map((p) => p.infected)).toEqual([true, false, false]);
    delete s.infectedAt;
    selectPublicSheep(state, out);
    expect(out[0].infected).toBe(false);
  });

  it('fills stage and hunger into the objects already in out', () => {
    const state = newGame();
    const out: PublicSheep[] = [];
    selectPublicSheep(state, out);
    const first = out[0];
    state.sheep[0].fullness = TUNING.fedAbove;
    selectPublicSheep(state, out);
    expect(out[0]).toBe(first);
    expect(out[0].hunger).toBe('hungry');
    expect(out).toHaveLength(state.sheep.length);
    expect(out.map((p) => p.stage)).toEqual(['adult', 'adult', 'lamb']);
    expect(out).toEqual(state.sheep.map((x) => publicSheep(x, state)));
  });
});

describe('selectHudView', () => {
  it('fills the Farm bar from state and TUNING into the given object', () => {
    const state = newGame();
    const out: HudView = { farmProgress: -1, farmPipsPerFood: -1, breedingProgress: -1, breedingPipsPerFood: -1, breedBlock: 'capacity', boostRemainingMs: -1, money: -1, threats: { starving: -1, infected: -1, carcasses: -1 } };
    expect(selectHudView(state, out)).toBe(out);
    expect(out).toEqual({
      farmProgress: 0,
      farmPipsPerFood: TUNING.farmPipsPerFood,
      breedingProgress: 0,
      breedingPipsPerFood: TUNING.breedingPipsPerFood,
      breedBlock: 'notReady',
      boostRemainingMs: 0,
      money: 0,
      threats: { starving: 0, infected: 0, carcasses: 0 },
    });
  });

  it('reflects a Farm on the next read', () => {
    const state = newGame();
    const out: HudView = { farmProgress: 0, farmPipsPerFood: 0, breedingProgress: 0, breedingPipsPerFood: 0, breedBlock: null, boostRemainingMs: -1, money: -1, threats: { starving: -1, infected: -1, carcasses: -1 } };
    selectHudView(state, out);
    applyCommand(state, { type: 'Farm' });
    selectHudView(state, out);
    expect(out.farmProgress).toBe(TUNING.farmPipsPerClick);
  });

  it('fills the balance (UX-DR34)', () => {
    const state = newGame();
    state.money = 145;
    const out: HudView = { farmProgress: 0, farmPipsPerFood: 0, breedingProgress: 0, breedingPipsPerFood: 0, breedBlock: null, boostRemainingMs: -1, money: -1, threats: { starving: -1, infected: -1, carcasses: -1 } };
    expect(selectHudView(state, out).money).toBe(145);
  });

  it('reflects a FarmBreeding on the next read', () => {
    const state = newGame();
    const out: HudView = { farmProgress: 0, farmPipsPerFood: 0, breedingProgress: 0, breedingPipsPerFood: 0, breedBlock: null, boostRemainingMs: -1, money: -1, threats: { starving: -1, infected: -1, carcasses: -1 } };
    selectHudView(state, out);
    applyCommand(state, { type: 'FarmBreeding' });
    selectHudView(state, out);
    expect(out.breedingProgress).toBe(TUNING.breedingPipsPerClick);
  });
});

describe('selectHudView threats (UX-DR39)', () => {
  const emptyOut = (): HudView => ({
    farmProgress: 0,
    farmPipsPerFood: 0,
    breedingProgress: 0,
    breedingPipsPerFood: 0,
    breedBlock: null,
    boostRemainingMs: -1,
    money: -1,
    threats: { starving: -1, infected: -1, carcasses: -1 },
  });

  it('counts nothing in a new game', () => {
    const state = newGame();
    expect(selectHudView(state, emptyOut()).threats).toEqual({ starving: 0, infected: 0, carcasses: 0 });
  });

  it('counts Starving sheep with the hunger epsilon, infected sheep and carcasses, in place', () => {
    const state = newGame();
    const out = emptyOut();
    const threats = out.threats;
    const [a, b, c] = state.sheep;
    a.fullness = TUNING.starvingBelow - 1;
    // On the bound is Hungry, not Starving, and so is a value drifted just under it by float error.
    b.fullness = TUNING.starvingBelow;
    c.fullness = TUNING.starvingBelow - FULLNESS_EPSILON / 2;
    selectHudView(state, out);
    expect(out.threats).toBe(threats);
    expect(threats).toEqual({ starving: 1, infected: 0, carcasses: 0 });
    c.fullness = TUNING.fullnessMax;
    infectSheep(state, c);
    createCarcass(state, 100, 100);
    createCarcass(state, 120, 100);
    selectHudView(state, out);
    expect(out.threats).toBe(threats);
    expect(threats).toEqual({ starving: 1, infected: 1, carcasses: 2 });
  });

  it('counts a sheep that is both Starving and infected in both', () => {
    const state = newGame();
    const s = state.sheep[0];
    s.fullness = 0.5;
    infectSheep(state, s);
    expect(selectHudView(state, emptyOut()).threats).toEqual({ starving: 1, infected: 1, carcasses: 0 });
  });

  it('agrees with the PublicSheep the field shows (AC 7)', () => {
    const agree = (state: ReturnType<typeof newGame>) => {
      const pub = selectPublicSheep(state, []);
      const t = selectHudView(state, emptyOut()).threats;
      expect(t.starving).toBe(pub.filter((p) => p.hunger === 'starving').length);
      expect(t.infected).toBe(pub.filter((p) => p.infected).length);
      expect(t.carcasses).toBe(selectCarcasses(state).length);
    };
    const busy = busyGame();
    agree(busy);
    expect(selectHudView(busy, emptyOut()).threats.infected).toBeGreaterThan(0);
    const unfed = newGame(77);
    fillFlock(unfed, 8);
    runFor(unfed, TUNING.starveMs / 2);
    agree(unfed);
    expect(selectHudView(unfed, emptyOut()).threats.starving).toBeGreaterThan(0);
  });

  it('changes nothing and draws no rng', () => {
    const state = busyGame();
    const before = structuredClone(state);
    selectHudView(state, emptyOut());
    expect(state).toStrictEqual(before);
  });
});

describe('breeding selectors (FR10, FR11, AR21)', () => {
  it('capacity is the base capacity, and slotsUsed counts pending lambs', () => {
    const state = newGame();
    expect(capacity(state)).toBe(TUNING.baseCapacity);
    expect(slotsUsed(state)).toBe(state.sheep.length);
    state.pregnancies.push({ id: state.nextId++, parentA: 1, parentB: 2, dueAt: 1, x: 0, y: 0 });
    expect(slotsUsed(state)).toBe(state.sheep.length + 1);
  });

  it('onCooldown holds until the tick time reaches cooldownUntil', () => {
    const state = newGame();
    const s = state.sheep[0];
    expect(onCooldown(s, state)).toBe(false);
    s.cooldownUntil = state.time + 1;
    expect(onCooldown(s, state)).toBe(true);
    s.cooldownUntil = state.time;
    expect(onCooldown(s, state)).toBe(false);
  });

  it('canBreed needs a ready adult off cooldown', () => {
    const state = newGame();
    const [a, , lamb] = state.sheep;
    expect(canBreed(a, state)).toBe(false);
    a.breedReady = true;
    expect(canBreed(a, state)).toBe(true);
    a.cooldownUntil = state.time + 1;
    expect(canBreed(a, state)).toBe(false);
    a.cooldownUntil = 0;
    a.bornAt = state.time - TUNING.elderFromMs;
    expect(canBreed(a, state)).toBe(false);
    lamb.breedReady = true;
    expect(canBreed(lamb, state)).toBe(false);
  });

  it('breedBlock: notReady below 2 eligible adults, null at 2, capacity first when both apply', () => {
    const state = newGame();
    expect(breedBlock(state)).toBe('notReady');
    state.sheep[0].breedReady = true;
    expect(breedBlock(state)).toBe('notReady');
    state.sheep[1].breedReady = true;
    expect(breedBlock(state)).toBe(null);
    fillFlock(state, TUNING.baseCapacity);
    expect(breedBlock(state)).toBe('capacity');
    state.sheep[1].breedReady = false;
    expect(breedBlock(state)).toBe('capacity');
  });

  it('breedBlock counts pending lambs toward capacity', () => {
    const state = newGame();
    state.sheep[0].breedReady = state.sheep[1].breedReady = true;
    fillFlock(state, TUNING.baseCapacity - 1);
    expect(breedBlock(state)).toBe(null);
    state.pregnancies.push({ id: state.nextId++, parentA: 1, parentB: 2, dueAt: 1, x: 0, y: 0 });
    expect(breedBlock(state)).toBe('capacity');
  });

  it('PublicSheep carries onCooldown and canBreed', () => {
    const state = newGame();
    const [a, b] = state.sheep;
    a.breedReady = true;
    b.cooldownUntil = state.time + 1;
    const out: PublicSheep[] = [];
    selectPublicSheep(state, out);
    expect(out.map((p) => [p.canBreed, p.onCooldown])).toEqual([
      [true, false],
      [false, true],
      [false, false],
    ]);
    expect(out[0]).toEqual(publicSheep(a, state));
  });

  it('selectHudView fills breedBlock', () => {
    const state = newGame();
    const out: HudView = { farmProgress: 0, farmPipsPerFood: 0, breedingProgress: 0, breedingPipsPerFood: 0, breedBlock: null, boostRemainingMs: -1, money: -1, threats: { starving: -1, infected: -1, carcasses: -1 } };
    expect(selectHudView(state, out).breedBlock).toBe('notReady');
    state.sheep[0].breedReady = state.sheep[1].breedReady = true;
    expect(selectHudView(state, out).breedBlock).toBe(null);
  });
});

describe('selectPregnancies', () => {
  it('places the heart between the living parents, at the one left, or at the stored spot; reuses out', () => {
    const state = newGame();
    const [a, b] = state.sheep;
    state.pregnancies.push({ id: 77, parentA: a.id, parentB: b.id, dueAt: 1, x: 1, y: 2 });
    const out: PublicPregnancy[] = [];
    expect(selectPregnancies(state, out)).toBe(out);
    expect(out).toEqual([{ id: 77, parentA: a.id, parentB: b.id, x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }]);
    const first = out[0];

    killSheep(state, b.id, 'starved');
    selectPregnancies(state, out);
    expect(out[0]).toBe(first);
    expect(out[0]).toMatchObject({ id: 77, x: a.x, y: a.y });

    killSheep(state, a.id, 'starved');
    selectPregnancies(state, out);
    expect(out[0]).toMatchObject({ id: 77, x: 1, y: 2 });

    state.pregnancies.length = 0;
    selectPregnancies(state, out);
    expect(out).toEqual([]);
  });
});

describe('selectBreedingPieces', () => {
  it('returns the live breeding pieces array without copying', () => {
    const state = newGame();
    expect(selectBreedingPieces(state)).toBe(state.breedingPieces);
  });
});

describe('selectCarcasses / carcassIndex', () => {
  it('returns the live carcasses array without copying', () => {
    const state = newGame();
    expect(selectCarcasses(state)).toBe(state.carcasses);
  });

  it('finds a carcass index by id, or -1', () => {
    const state = newGame();
    createCarcass(state, 600, 400);
    const b = createCarcass(state, 650, 420);
    expect(carcassIndex(state, b.id)).toBe(1);
    expect(carcassIndex(state, state.sheep[0].id)).toBe(-1);
    expect(carcassIndex(state, 9_999)).toBe(-1);
  });
});

describe('selectFoodPieces', () => {
  it('returns the live pieces array without copying', () => {
    const state = newGame();
    expect(selectFoodPieces(state)).toBe(state.foodPieces);
  });
});

describe('isLost / selectLoseView', () => {
  it('is not lost on a new game, and lost once the flock is gone', () => {
    const state = newGame();
    expect(isLost(state)).toBe(false);
    for (const id of state.sheep.map((s) => s.id)) killSheep(state, id, 'starved');
    expect(isLost(state)).toBe(true);
  });

  it('fills out in place with the loss time and the peak flock', () => {
    const state = newGame();
    runFor(state, 3_000);
    for (const id of state.sheep.map((s) => s.id)) killSheep(state, id, 'starved');
    const out: LoseView = { survivedMs: -1, peakFlock: -1 };
    expect(selectLoseView(state, out)).toBe(out);
    expect(out).toEqual({ survivedMs: 3_000, peakFlock: TUNING.startFlockAdults + TUNING.startFlockLambs });
  });
});

describe('the boost selectors (FR19)', () => {
  it('a new game is not boosted: nothing remains and a click is the base value', () => {
    const state = newGame();
    expect(isBoosted(state)).toBe(false);
    expect(boostRemainingMs(state)).toBe(0);
    expect(farmPipsPerClick(state)).toBe(TUNING.farmPipsPerClick);
  });

  it('while active: the exact time left and the multiplied click value', () => {
    const state = newGame();
    state.time = 10_000;
    state.boostUntil = state.time + TUNING.boostMs;
    expect(isBoosted(state)).toBe(true);
    expect(boostRemainingMs(state)).toBe(TUNING.boostMs);
    expect(farmPipsPerClick(state)).toBe(TUNING.farmPipsPerClick * TUNING.boostPipMultiplier);
    state.time += 12_300;
    expect(boostRemainingMs(state)).toBe(TUNING.boostMs - 12_300);
  });

  it('ends exactly at boostUntil and never goes negative', () => {
    const state = newGame();
    state.boostUntil = 5_000;
    state.time = 5_000;
    expect(isBoosted(state)).toBe(false);
    expect(boostRemainingMs(state)).toBe(0);
    state.time = 9_000;
    expect(boostRemainingMs(state)).toBe(0);
  });

  it('a lost game is never boosted, even with a deadline ahead (the last sheep was sacrificed)', () => {
    const state = newGame();
    state.boostUntil = state.time + TUNING.boostMs;
    state.lostAt = state.time;
    expect(isBoosted(state)).toBe(false);
    expect(boostRemainingMs(state)).toBe(0);
    expect(farmPipsPerClick(state)).toBe(TUNING.farmPipsPerClick);
  });

  it('selectHudView reports the time left', () => {
    const state = newGame();
    state.boostUntil = state.time + TUNING.boostMs;
    const out: HudView = { farmProgress: 0, farmPipsPerFood: 0, breedingProgress: 0, breedingPipsPerFood: 0, breedBlock: null, boostRemainingMs: -1, money: -1, threats: { starving: -1, infected: -1, carcasses: -1 } };
    expect(selectHudView(state, out).boostRemainingMs).toBe(TUNING.boostMs);
  });
});

describe('salePrice (FR17)', () => {
  it('prices an adult and an elder from TUNING, and a lamb at 0 (cannot be sold)', () => {
    expect(salePrice('adult')).toBe(TUNING.sellPriceAdult);
    expect(salePrice('elder')).toBe(TUNING.sellPriceElder);
    expect(salePrice('lamb')).toBe(0);
  });
});

describe('shop selectors (FR22, FR23, UX-DR24)', () => {
  it('lists the Must items in GDD order', () => {
    expect(SHOP_ITEMS).toEqual(['land1', 'land2', 'land3', 'flowerPatch', 'scarecrow']);
  });

  it('prices every item from TUNING', () => {
    expect(shopPrice('land1')).toBe(TUNING.landPrices[0]);
    expect(shopPrice('land2')).toBe(TUNING.landPrices[1]);
    expect(shopPrice('land3')).toBe(TUNING.landPrices[2]);
    expect(shopPrice('flowerPatch')).toBe(TUNING.flowerPatchPrice);
    expect(shopPrice('scarecrow')).toBe(TUNING.scarecrowPrice);
  });

  it('locks each Land tier behind the previous one; everything else is free to buy', () => {
    expect(shopRequires('land1')).toBeNull();
    expect(shopRequires('land2')).toBe('land1');
    expect(shopRequires('land3')).toBe('land2');
    expect(shopRequires('flowerPatch')).toBeNull();
    expect(shopRequires('scarecrow')).toBeNull();
  });

  it('buyBlock: owned, then locked, then poor, else null', () => {
    const state = newGame();
    expect(buyBlock(state, 'land1')).toBe('poor');
    expect(buyBlock(state, 'land2')).toBe('locked');
    state.money = shopPrice('land1');
    expect(buyBlock(state, 'land1')).toBeNull();
    state.owned.push('land1');
    state.money = 0;
    // Owned wins over poor; the next tier is now only poor.
    expect(buyBlock(state, 'land1')).toBe('owned');
    expect(buyBlock(state, 'land2')).toBe('poor');
    // Locked wins over poor.
    expect(buyBlock(state, 'land3')).toBe('locked');
  });

  it('selectShopView fills the given rows in place, one per item', () => {
    const state = newGame();
    state.money = shopPrice('flowerPatch');
    const out: ShopRowView[] = SHOP_ITEMS.map((item) => ({ item, price: -1, block: 'owned' as const }));
    const rows = out.slice();
    expect(selectShopView(state, out)).toBe(out);
    expect(out).toHaveLength(SHOP_ITEMS.length);
    for (let i = 0; i < out.length; i++) expect(out[i]).toBe(rows[i]);
    expect(out.map((r) => [r.item, r.price, r.block])).toEqual([
      ['land1', shopPrice('land1'), 'poor'],
      ['land2', shopPrice('land2'), 'locked'],
      ['land3', shopPrice('land3'), 'locked'],
      ['flowerPatch', shopPrice('flowerPatch'), null],
      ['scarecrow', shopPrice('scarecrow'), 'poor'],
    ]);
  });
});
