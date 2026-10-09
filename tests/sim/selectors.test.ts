import { describe, expect, it } from 'vitest';
import { TICK_MS } from '../../src/config/constants';
import { TUNING } from '../../src/config/tuning';
import { applyCommand } from '../../src/sim/commands';
import {
  boostRemainingMs,
  breedBlock,
  canBreed,
  capacity,
  carcassIndex,
  crowdedAt,
  crowdThreshold,
  isCrowded,
  currentEra,
  ERAS,
  eraIndex,
  farmPipsPerClick,
  hoeTier,
  isHoe,
  fenceBounds,
  FULLNESS_EPSILON,
  DECORATIONS,
  isDecoration,
  isLand,
  landTier,
  isBoosted,
  hungerOf,
  isLost,
  onCooldown,
  publicSheep,
  buyBlock,
  salePrice,
  selectShopView,
  SHOP_ITEMS,
  SHOP_ROWS,
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
import type { Sheep } from '../../src/sim/state';
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
    expect(publicSheep(s, state)).toEqual({ id: s.id, x: s.x, y: s.y, stage: 'adult', hunger: 'starving', ready: false, onCooldown: false, canBreed: false, infected: false, gait: 'normal', activity: 'wander' });
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

describe('Abomination secrecy (AR18, UX-DR64; the mandatory secrecy test, Story 4.1 AC 5)', () => {
  /** A copy of `s` with the flag set: every other field equal, the id included. */
  function twin(s: Sheep): Sheep {
    return { ...structuredClone(s), isAbomination: true };
  }

  it('an Abomination and a lamb with equal fields differ in PublicSheep only in gait', () => {
    const state = newGame();
    const lamb = state.sheep[2];
    expect(stageOf(lamb, state)).toBe('lamb');
    // A busy lamb: hungry, infected, walking to food. None of it may differ.
    lamb.fullness = TUNING.fedAbove - 1;
    lamb.infectedAt = state.time;
    lamb.activity = 'seekFood';
    const plain = publicSheep(lamb, state);
    const abom = publicSheep(twin(lamb), state);
    expect(plain.gait).toBe('normal');
    expect(abom.gait).toBe('offstep');
    expect({ ...abom, gait: plain.gait }).toStrictEqual(plain);
  });

  it('a stalking Abomination and a wandering lamb with equal fields differ in PublicSheep only in gait (Story 4.3)', () => {
    const state = newGame();
    const lamb = state.sheep[2];
    lamb.activity = 'wander';
    const abom = twin(lamb);
    abom.activity = 'stalking';
    abom.stalk = { victimId: state.sheep[0].id, phase: 'approach', until: state.time + TUNING.abominationApproachMaxMs };
    const plain = publicSheep(lamb, state);
    const p = publicSheep(abom, state);
    expect(p.activity).toBe('wander');
    expect({ ...p, gait: plain.gait }).toStrictEqual(plain);
    for (const phase of ['linger', 'leave'] as const) {
      abom.stalk.phase = phase;
      expect({ ...publicSheep(abom, state), gait: plain.gait }).toStrictEqual(plain);
    }
    expect(Object.keys(p)).not.toContain('stalk');
  });

  it('a doomed sheep looks exactly like one that is not (Story 4.3)', () => {
    const state = newGame();
    const s = state.sheep[0];
    const doomed = { ...structuredClone(s), doomedAt: state.time + TUNING.abominationDoomMinMs };
    expect(publicSheep(doomed, state)).toStrictEqual(publicSheep(s, state));
    expect(Object.keys(publicSheep(doomed, state))).not.toContain('doomedAt');
  });

  it('selectPublicSheep matches publicSheep with a stalking Abomination and a doomed sheep (Story 4.3)', () => {
    const state = newGame();
    const abom = state.sheep[2];
    abom.isAbomination = true;
    abom.activity = 'stalking';
    abom.stalk = { victimId: state.sheep[0].id, phase: 'linger', until: state.time + TUNING.abominationLingerMs };
    state.sheep[0].doomedAt = state.time + TUNING.abominationDoomMaxMs;
    const out: PublicSheep[] = [];
    selectPublicSheep(state, out);
    expect(out).toEqual(state.sheep.map((x) => publicSheep(x, state)));
    expect(out.map((p) => p.activity)).toEqual(['wander', 'wander', 'wander']);
  });

  it('stays a lamb past elderFromMs: never breedable, and no secret key on the output', () => {
    const state = newGame();
    const old = state.sheep[2];
    old.bornAt = state.time - TUNING.elderFromMs - 1;
    const abom = twin(old);
    expect(stageOf(old, state)).toBe('elder');
    expect(stageOf(abom, state)).toBe('lamb');
    const p = publicSheep(abom, state);
    expect(p.stage).toBe('lamb');
    expect(p.ready).toBe(false);
    expect(p.canBreed).toBe(false);
    // Even forced ready, the pairing rule refuses it: it is never an adult.
    expect(canBreed({ ...abom, breedReady: true }, state)).toBe(false);
    expect(Object.keys(p)).not.toContain('isAbomination');
    expect(Object.keys(p)).not.toContain('stalk');
    expect(Object.keys(p)).not.toContain('doomedAt');
    expect(Object.keys(p).sort()).toEqual(Object.keys(publicSheep(old, state)).sort());
  });

  it('a ready Abomination at adult age (a crafted save) loses readiness on the next tick, so no heart shows', () => {
    const state = newGame();
    const abom = state.sheep[2];
    abom.isAbomination = true;
    abom.bornAt = state.time - TUNING.lambUntilMs - 1;
    abom.breedReady = true;
    runFor(state, TICK_MS);
    expect(abom.breedReady).toBe(false);
    expect(publicSheep(abom, state).ready).toBe(false);
  });

  it('selectPublicSheep reports the Abomination exactly as publicSheep does, reusing its objects', () => {
    const state = newGame();
    state.sheep[2].isAbomination = true;
    state.sheep[2].bornAt = state.time - TUNING.lambUntilMs - 1;
    const out: PublicSheep[] = [];
    selectPublicSheep(state, out);
    const first = out[2];
    selectPublicSheep(state, out);
    expect(out[2]).toBe(first);
    expect(out).toEqual(state.sheep.map((x) => publicSheep(x, state)));
    expect(out.map((p) => p.gait)).toEqual(['normal', 'normal', 'offstep']);
    expect(out[2].stage).toBe('lamb');
    for (const p of out) expect(Object.keys(p)).not.toContain('isAbomination');
  });

  it('counts in capacity and eras like any sheep (FR30)', () => {
    const state = newGame();
    fillFlock(state, TUNING.eraThresholds[0] - 1);
    expect(currentEra(state)).toBe('pasture');
    const lamb = state.sheep[2];
    const used = slotsUsed(state);
    lamb.isAbomination = true;
    expect(slotsUsed(state)).toBe(used);
    // One more sheep, an Abomination, reaches Village.
    const extra = twin(lamb);
    extra.id = state.nextId++;
    state.sheep.push(extra);
    expect(slotsUsed(state)).toBe(used + 1);
    expect(currentEra(state)).toBe('village');
  });
});

describe('selectHudView', () => {
  it('fills the Farm bar from state and TUNING into the given object', () => {
    const state = newGame();
    const out: HudView = { farmProgress: -1, farmPipsPerFood: -1, breedingProgress: -1, breedingPipsPerFood: -1, breedBlock: 'capacity', boostRemainingMs: -1, money: -1, flock: -1, capacity: -1, medicine: -1, crowded: false, hoeTier: 0, threats: { starving: -1, infected: -1, carcasses: -1 } };
    expect(selectHudView(state, out)).toBe(out);
    expect(out).toEqual({
      farmProgress: 0,
      farmPipsPerFood: TUNING.farmPipsPerFood,
      breedingProgress: 0,
      breedingPipsPerFood: TUNING.breedingPipsPerFood,
      breedBlock: 'notReady',
      boostRemainingMs: 0,
      money: 0,
      flock: state.sheep.length,
      capacity: TUNING.landCapacities[0],
      medicine: 0,
      crowded: false,
      hoeTier: 0,
      threats: { starving: 0, infected: 0, carcasses: 0 },
    });
  });

  it('fills the doses owned (the Medicine slot, UX-DR33, Story 4.5)', () => {
    const state = newGame();
    state.medicine = 3;
    const out: HudView = { farmProgress: 0, farmPipsPerFood: 0, breedingProgress: 0, breedingPipsPerFood: 0, breedBlock: null, boostRemainingMs: -1, money: -1, flock: -1, capacity: -1, medicine: -1, crowded: false, hoeTier: 0, threats: { starving: -1, infected: -1, carcasses: -1 } };
    expect(selectHudView(state, out).medicine).toBe(3);
  });

  it('reflects a Farm on the next read', () => {
    const state = newGame();
    const out: HudView = { farmProgress: 0, farmPipsPerFood: 0, breedingProgress: 0, breedingPipsPerFood: 0, breedBlock: null, boostRemainingMs: -1, money: -1, flock: -1, capacity: -1, medicine: -1, crowded: false, hoeTier: 0, threats: { starving: -1, infected: -1, carcasses: -1 } };
    selectHudView(state, out);
    applyCommand(state, { type: 'Farm' });
    selectHudView(state, out);
    expect(out.farmProgress).toBe(TUNING.farmPipsPerClick);
  });

  it('fills the balance (UX-DR34)', () => {
    const state = newGame();
    state.money = 145;
    const out: HudView = { farmProgress: 0, farmPipsPerFood: 0, breedingProgress: 0, breedingPipsPerFood: 0, breedBlock: null, boostRemainingMs: -1, money: -1, flock: -1, capacity: -1, medicine: -1, crowded: false, hoeTier: 0, threats: { starving: -1, infected: -1, carcasses: -1 } };
    expect(selectHudView(state, out).money).toBe(145);
  });

  it('reflects a FarmBreeding on the next read', () => {
    const state = newGame();
    const out: HudView = { farmProgress: 0, farmPipsPerFood: 0, breedingProgress: 0, breedingPipsPerFood: 0, breedBlock: null, boostRemainingMs: -1, money: -1, flock: -1, capacity: -1, medicine: -1, crowded: false, hoeTier: 0, threats: { starving: -1, infected: -1, carcasses: -1 } };
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
    flock: -1,
    capacity: -1,
    medicine: -1,
    crowded: false,
    hoeTier: 0,
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
    expect(capacity(state)).toBe(TUNING.landCapacities[0]);
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
    fillFlock(state, TUNING.landCapacities[0]);
    expect(breedBlock(state)).toBe('capacity');
    state.sheep[1].breedReady = false;
    expect(breedBlock(state)).toBe('capacity');
  });

  it('breedBlock counts pending lambs toward capacity', () => {
    const state = newGame();
    state.sheep[0].breedReady = state.sheep[1].breedReady = true;
    fillFlock(state, TUNING.landCapacities[0] - 1);
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
    const out: HudView = { farmProgress: 0, farmPipsPerFood: 0, breedingProgress: 0, breedingPipsPerFood: 0, breedBlock: null, boostRemainingMs: -1, money: -1, flock: -1, capacity: -1, medicine: -1, crowded: false, hoeTier: 0, threats: { starving: -1, infected: -1, carcasses: -1 } };
    expect(selectHudView(state, out).breedBlock).toBe('notReady');
    state.sheep[0].breedReady = state.sheep[1].breedReady = true;
    expect(selectHudView(state, out).breedBlock).toBe(null);
  });
});

describe('crowding (FR34, UX-DR35, Story 4.6)', () => {
  it('crowdThreshold rounds up, and is exact where the float product overshoots a whole number', () => {
    expect(crowdThreshold(10, 0.9)).toBe(9);
    expect(crowdThreshold(25, 0.9)).toBe(23);
    expect(crowdThreshold(50, 0.9)).toBe(45);
    expect(crowdThreshold(100, 0.9)).toBe(90);
    // 0.56 × 25 = 14.000000000000002 and 0.55 × 100 = 55.00000000000001 in floats (a retune must not
    // make an exact 56 % / 55 % flock uncrowded).
    expect(crowdThreshold(25, 0.56)).toBe(14);
    expect(crowdThreshold(100, 0.55)).toBe(55);
    expect(crowdThreshold(10, 1)).toBe(10);
  });

  it('crowdedAt is crowded from the first whole flock at overcrowdFraction of each land capacity', () => {
    for (const cap of TUNING.landCapacities) {
      const first = crowdThreshold(cap, TUNING.overcrowdFraction);
      expect(crowdedAt(first, cap), `${first}/${cap}`).toBe(true);
      expect(crowdedAt(first - 1, cap), `${first - 1}/${cap}`).toBe(false);
      expect(crowdedAt(cap, cap)).toBe(true);
      expect(crowdedAt(cap + 5, cap)).toBe(true);
    }
  });

  it('isCrowded counts living sheep against land capacity, not pending lambs', () => {
    const cap = TUNING.landCapacities[0];
    const first = crowdThreshold(cap, TUNING.overcrowdFraction);
    const state = newGame();
    fillFlock(state, first - 1);
    // A pending lamb holds a capacity slot (AR21) but is not alive.
    state.pregnancies.push({ id: state.nextId++, parentA: state.sheep[0].id, parentB: state.sheep[1].id, dueAt: state.time + TUNING.gestationMs, x: state.sheep[0].x, y: state.sheep[0].y });
    expect(slotsUsed(state)).toBe(first);
    expect(isCrowded(state)).toBe(false);
    fillFlock(state, first);
    expect(isCrowded(state)).toBe(true);
    // Land raises capacity, so the same flock is no longer crowded.
    state.owned.push('land1');
    expect(isCrowded(state)).toBe(false);
  });

  it('selectHudView fills crowded from the same rule', () => {
    const state = newGame();
    const out: HudView = { farmProgress: 0, farmPipsPerFood: 0, breedingProgress: 0, breedingPipsPerFood: 0, breedBlock: null, boostRemainingMs: -1, money: -1, flock: -1, capacity: -1, medicine: -1, crowded: true, hoeTier: 0, threats: { starving: -1, infected: -1, carcasses: -1 } };
    expect(selectHudView(state, out).crowded).toBe(false);
    fillFlock(state, crowdThreshold(TUNING.landCapacities[0], TUNING.overcrowdFraction));
    expect(selectHudView(state, out).crowded).toBe(true);
    expect(out.crowded).toBe(isCrowded(state));
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

  it('hoeTier is the highest Better Hoe owned; II wins even without I (Story 4.7)', () => {
    const state = newGame();
    expect(hoeTier(state)).toBe(0);
    state.owned.push('hoe1');
    expect(hoeTier(state)).toBe(1);
    state.owned.push('hoe2');
    expect(hoeTier(state)).toBe(2);
    state.owned = ['hoe2'];
    expect(hoeTier(state)).toBe(2);
  });

  it('a Better Hoe replaces the base click value and the boost doubles it (FR24, FR19)', () => {
    const state = newGame();
    state.time = 10_000;
    const bases = [TUNING.farmPipsPerClick, TUNING.hoePipsPerClick[0], TUNING.hoePipsPerClick[1]];
    const owned = [[], ['hoe1'], ['hoe1', 'hoe2']] as const;
    for (let tier = 0; tier < bases.length; tier++) {
      state.owned = [...owned[tier]];
      state.boostUntil = 0;
      expect(farmPipsPerClick(state), `tier ${tier}`).toBe(bases[tier]);
      state.boostUntil = state.time + TUNING.boostMs;
      expect(farmPipsPerClick(state), `tier ${tier} boosted`).toBe(bases[tier] * TUNING.boostPipMultiplier);
    }
    // The tiers rise (2 then 3 pips), so each purchase is worth something.
    expect(bases[1]).toBeGreaterThan(bases[0]);
    expect(bases[2]).toBeGreaterThan(bases[1]);
  });

  it('a lost game with Better Hoe II and a boost deadline ahead is not boosted', () => {
    const state = newGame();
    state.owned = ['hoe1', 'hoe2'];
    state.boostUntil = state.time + TUNING.boostMs;
    state.lostAt = state.time;
    expect(farmPipsPerClick(state)).toBe(TUNING.hoePipsPerClick[1]);
  });

  it('selectHudView reports the Better Hoe owned (the Farm button icon, Story 4.7)', () => {
    const state = newGame();
    const out: HudView = { farmProgress: 0, farmPipsPerFood: 0, breedingProgress: 0, breedingPipsPerFood: 0, breedBlock: null, boostRemainingMs: -1, money: -1, flock: -1, capacity: -1, medicine: -1, crowded: false, hoeTier: 2, threats: { starving: -1, infected: -1, carcasses: -1 } };
    expect(selectHudView(state, out).hoeTier).toBe(0);
    state.owned.push('hoe1');
    expect(selectHudView(state, out).hoeTier).toBe(1);
    state.owned.push('hoe2');
    expect(selectHudView(state, out).hoeTier).toBe(2);
  });

  it('selectHudView reports the time left', () => {
    const state = newGame();
    state.boostUntil = state.time + TUNING.boostMs;
    const out: HudView = { farmProgress: 0, farmPipsPerFood: 0, breedingProgress: 0, breedingPipsPerFood: 0, breedBlock: null, boostRemainingMs: -1, money: -1, flock: -1, capacity: -1, medicine: -1, crowded: false, hoeTier: 0, threats: { starving: -1, infected: -1, carcasses: -1 } };
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
  it('lists the one-time items in GDD order: the Must items, then Better Hoe I–II (Story 4.7)', () => {
    expect(SHOP_ITEMS).toEqual(['land1', 'land2', 'land3', 'flowerPatch', 'scarecrow', 'hoe1', 'hoe2']);
  });

  it('prices Better Hoe I–II from TUNING; II needs I, I needs nothing (FR24)', () => {
    expect(shopPrice('hoe1')).toBe(TUNING.hoePrices[0]);
    expect(shopPrice('hoe2')).toBe(TUNING.hoePrices[1]);
    expect(shopRequires('hoe1')).toBeNull();
    expect(shopRequires('hoe2')).toBe('hoe1');
  });

  it('buyBlock: Better Hoe II is locked without I even when affordable, then poor, buyable, owned', () => {
    const state = newGame();
    state.money = shopPrice('hoe2') + shopPrice('hoe1');
    expect(buyBlock(state, 'hoe1')).toBeNull();
    expect(buyBlock(state, 'hoe2')).toBe('locked');
    applyCommand(state, { type: 'Buy', item: 'hoe1' });
    expect(buyBlock(state, 'hoe1')).toBe('owned');
    expect(buyBlock(state, 'hoe2')).toBeNull();
    state.money = shopPrice('hoe2') - 1;
    expect(buyBlock(state, 'hoe2')).toBe('poor');
    state.money = shopPrice('hoe2');
    applyCommand(state, { type: 'Buy', item: 'hoe2' });
    expect(buyBlock(state, 'hoe2')).toBe('owned');
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

  it('lists the panel rows: the one-time items, then Medicine last (GDD Upgrade Trees, Story 4.5)', () => {
    expect(SHOP_ROWS).toEqual([...SHOP_ITEMS, 'medicine']);
  });

  it('prices Medicine from TUNING; it needs nothing first (FR26)', () => {
    expect(shopPrice('medicine')).toBe(TUNING.medicinePrice);
    expect(shopRequires('medicine')).toBeNull();
  });

  it('buyBlock: Medicine is only ever poor or buyable, never owned or locked (repeatable, UX-DR24)', () => {
    const state = newGame();
    expect(buyBlock(state, 'medicine')).toBe('poor');
    state.money = shopPrice('medicine') * 2;
    expect(buyBlock(state, 'medicine')).toBeNull();
    // A real purchase (not a hand-set count): the row stays buyable while money lasts, then is poor.
    applyCommand(state, { type: 'Buy', item: 'medicine' });
    expect(state.medicine).toBe(1);
    expect(buyBlock(state, 'medicine')).toBeNull();
    const out: ShopRowView[] = SHOP_ROWS.map((item) => ({ item, price: -1, block: 'owned' as const }));
    expect(selectShopView(state, out).find((r) => r.item === 'medicine')?.block).toBeNull();
    applyCommand(state, { type: 'Buy', item: 'medicine' });
    expect(state.medicine).toBe(2);
    expect(state.owned).not.toContain('medicine');
    expect(buyBlock(state, 'medicine')).toBe('poor');
  });

  it('selectShopView fills the given rows in place, one per row', () => {
    const state = newGame();
    state.money = shopPrice('flowerPatch');
    // The pinned looks below need the Flower Patch money to buy Hoe I and Medicine but not Land I or Scarecrow.
    expect(shopPrice('hoe1')).toBeLessThanOrEqual(state.money);
    expect(shopPrice('scarecrow')).toBeGreaterThan(state.money);
    const out: ShopRowView[] = SHOP_ROWS.map((item) => ({ item, price: -1, block: 'owned' as const }));
    const rows = out.slice();
    expect(selectShopView(state, out)).toBe(out);
    expect(out).toHaveLength(SHOP_ROWS.length);
    for (let i = 0; i < out.length; i++) expect(out[i]).toBe(rows[i]);
    expect(out.map((r) => [r.item, r.price, r.block])).toEqual([
      ['land1', shopPrice('land1'), 'poor'],
      ['land2', shopPrice('land2'), 'locked'],
      ['land3', shopPrice('land3'), 'locked'],
      ['flowerPatch', shopPrice('flowerPatch'), null],
      ['scarecrow', shopPrice('scarecrow'), 'poor'],
      ['hoe1', shopPrice('hoe1'), null],
      ['hoe2', shopPrice('hoe2'), 'locked'],
      ['medicine', shopPrice('medicine'), null],
    ]);
  });
});

describe('land selectors (FR11, FR22, Story 3.3)', () => {
  it('landTier is the highest Land tier owned; decorations do not count', () => {
    const state = newGame();
    expect(landTier(state)).toBe(0);
    state.owned.push('flowerPatch');
    expect(landTier(state)).toBe(0);
    state.owned.push('land1');
    expect(landTier(state)).toBe(1);
    state.owned.push('scarecrow', 'land2');
    expect(landTier(state)).toBe(2);
    state.owned.push('land3');
    expect(landTier(state)).toBe(3);
  });

  it('capacity and fenceBounds follow the tier, from TUNING', () => {
    const state = newGame();
    const items = ['land1', 'land2', 'land3'] as const;
    for (let tier = 0; tier <= items.length; tier++) {
      if (tier > 0) state.owned.push(items[tier - 1]);
      expect(capacity(state)).toBe(TUNING.landCapacities[tier]);
      expect(fenceBounds(state)).toBe(TUNING.landFences[tier]);
    }
  });

  it('isLand picks out the Land tiers', () => {
    expect(SHOP_ITEMS.filter(isLand)).toEqual(['land1', 'land2', 'land3']);
  });

  it('isDecoration picks out the decorations, in shop order (FR23, Story 3.4)', () => {
    expect(SHOP_ITEMS.filter(isDecoration)).toEqual(['flowerPatch', 'scarecrow']);
    expect(DECORATIONS).toEqual(SHOP_ITEMS.filter(isDecoration));
  });

  it('isHoe picks out Better Hoe I–II (Story 4.7)', () => {
    expect(SHOP_ITEMS.filter(isHoe)).toEqual(['hoe1', 'hoe2']);
  });

  it('every shop item is exactly one of Land, a decoration or a Better Hoe (a new item must be classified on purpose)', () => {
    for (const item of SHOP_ITEMS) {
      expect(Number(isLand(item)) + Number(isDecoration(item)) + Number(isHoe(item)), item).toBe(1);
    }
  });

  it('selectHudView fills the flock (living sheep only) and the capacity (UX-DR35)', () => {
    const state = newGame();
    state.pregnancies.push({ id: state.nextId++, parentA: 1, parentB: 2, dueAt: 1, x: 0, y: 0 });
    state.owned.push('land1');
    const out = selectHudView(state, {
      farmProgress: 0,
      farmPipsPerFood: 0,
      breedingProgress: 0,
      breedingPipsPerFood: 0,
      breedBlock: null,
      boostRemainingMs: 0,
      money: 0,
      flock: -1,
      capacity: -1,
      medicine: -1,
      crowded: false,
      hoeTier: 0,
      threats: { starving: 0, infected: 0, carcasses: 0 },
    });
    expect(out.flock).toBe(state.sheep.length);
    expect(out.capacity).toBe(TUNING.landCapacities[1]);
  });
});

describe('era selectors (FR27, Story 3.5)', () => {
  it('ERAS lists the four eras in order; eraIndex rises with them (FR27)', () => {
    expect(ERAS).toEqual(['pasture', 'village', 'town', 'wool-empire']);
    expect(Object.isFrozen(ERAS)).toBe(true);
    ERAS.forEach((era, i) => expect(eraIndex(era)).toBe(i));
  });

  it('currentEra counts living sheep only', () => {
    const state = newGame();
    expect(currentEra(state)).toBe('pasture');
    // Carcasses are not sheep: a flock one short of Village stays in Pasture with any number of them.
    fillFlock(state, TUNING.eraThresholds[0] - 1);
    for (let i = 0; i < 5; i++) createCarcass(state, state.sheep[0].x, state.sheep[0].y);
    expect(currentEra(state)).toBe('pasture');
    fillFlock(state, TUNING.eraThresholds[0]);
    expect(currentEra(state)).toBe('village');
  });
});
