import { describe, expect, it } from 'vitest';
import { TICK_MS } from '../../src/config/constants';
import { TUNING } from '../../src/config/tuning';
import { validateState } from '../../src/save/validate';
import { fenceBounds, innerFence } from '../../src/sim/selectors';
import type { GameState } from '../../src/sim/state';
import { killSheep } from '../../src/sim/systems/carcass';
import { newGame, runFor } from '../sim/helpers';
import { busyGame, isBusy } from './busy';

type Raw = Record<string, unknown> & {
  sheep: Record<string, unknown>[];
  foodPieces: Record<string, unknown>[];
  breedingPieces: Record<string, unknown>[];
  pregnancies: Record<string, unknown>[];
  carcasses: Record<string, unknown>[];
  stats: Record<string, unknown>;
};

/** A JSON copy of a busy game, to break one field at a time. */
function raw(): Raw {
  return JSON.parse(JSON.stringify(busyGame())) as Raw;
}

/** The busy fixture's Abomination (on a visit), its stalk, and its doomed sheep (Story 4.3). */
function abom(r: Raw): Record<string, unknown> {
  return r.sheep.find((x) => x.isAbomination === true)!;
}
function stalk(r: Raw): Record<string, unknown> {
  return abom(r).stalk as Record<string, unknown>;
}
function doomed(r: Raw): Record<string, unknown> {
  return r.sheep.find((x) => 'doomedAt' in x)!;
}

function lostGame(): GameState {
  const state = newGame(5);
  runFor(state, TUNING.starveMs);
  return state;
}

describe('validateState', () => {
  it('accepts a new game and returns the same object', () => {
    const state = newGame(1);
    const r = validateState(state);
    expect(r).toStrictEqual({ ok: true, state });
    if (r.ok) expect(r.state).toBe(state);
  });

  it('accepts a busy game', () => {
    const state = busyGame();
    expect(isBusy(state)).toBe(true);
    expect(validateState(state).ok).toBe(true);
  });

  it('accepts a lost game with no sheep', () => {
    const state = lostGame();
    expect(state.sheep).toHaveLength(0);
    expect(validateState(state).ok).toBe(true);
  });

  it('accepts sheep alive in a lost game (debug sheep added after a loss)', () => {
    const r = raw();
    r.lostAt = r.time;
    expect(validateState(r).ok).toBe(true);
  });

  it('accepts a sheep with no targetId and extra unknown keys', () => {
    const r = raw();
    delete r.sheep[0].targetId;
    r.sheep[0].activity = 'wander';
    r.futureField = { anything: true };
    r.sheep[1].futureFlag = 3;
    expect(validateState(r).ok).toBe(true);
  });

  it('accepts a sheep seeking breeding food, and a full-minus-one breeding bar', () => {
    const r = raw();
    r.sheep[1].activity = 'seekBreedingFood';
    r.sheep[1].targetId = r.breedingPieces[0].id;
    r.breedingProgress = TUNING.breedingPipsPerFood - 1;
    expect(validateState(r).ok).toBe(true);
  });

  it('accepts a sheep seeking a carcass and an infected sheep (Story 2.5)', () => {
    const r = raw();
    r.sheep[2].activity = 'seekCarcass';
    r.sheep[2].targetId = r.carcasses[0].id;
    // Later in the game, with the fixture's own infection moved along with the clock.
    r.time = (r.time as number) + TUNING.virusDeathMs;
    for (const x of r.sheep) if ('infectedAt' in x) x.infectedAt = r.time;
    r.sheep[3].infectedAt = r.time;
    // The earliest a saved infection can be: one tick earlier would have killed the sheep already.
    r.sheep[4].infectedAt = (r.time as number) - TUNING.virusDeathMs + TICK_MS;
    // The fixture's kill-cycle deadlines move along with the clock too (Story 4.3).
    for (const x of r.sheep) {
      if ('doomedAt' in x) x.doomedAt = (x.doomedAt as number) + TUNING.virusDeathMs;
      if (x.stalk !== undefined) (x.stalk as Record<string, number>).until += TUNING.virusDeathMs;
    }
    (r.abomination as Record<string, number>).nextKillAt += TUNING.virusDeathMs;
    expect(validateState(r).ok).toBe(true);
  });

  it('accepts a guaranteed birth outside the live spawn window: a retune must not reject a save (4.1 review)', () => {
    for (const g of [1, TUNING.abominationGuaranteedBirthMin - 1, TUNING.abominationGuaranteedBirthMax + 20]) {
      const r = raw();
      (r.abomination as Record<string, unknown>).guaranteedAtBirth = g;
      expect(validateState(r).ok, `guaranteedAtBirth ${g}`).toBe(true);
    }
  });

  it('accepts a due nextKillAt, a visit in each phase, and a doom at its full delay (Story 4.3)', () => {
    const r = raw();
    // Due: the visit is waiting for a busy Abomination.
    (r.abomination as Record<string, unknown>).nextKillAt = (r.time as number) - TICK_MS;
    expect(validateState(r).ok).toBe(true);
    for (const [phase, len] of [
      ['approach', TUNING.abominationApproachMaxMs],
      ['linger', TUNING.abominationLingerMs],
      ['leave', TUNING.abominationLeaveMs],
    ] as const) {
      stalk(r).phase = phase;
      stalk(r).until = (r.time as number) + len;
      expect(validateState(r).ok, phase).toBe(true);
    }
    doomed(r).doomedAt = (r.time as number) + TUNING.abominationDoomMaxMs;
    // A victim that is gone (the visit picks another): a stale id is fine, as for targetId. An issued
    // id that names no sheep (a food piece's).
    stalk(r).victimId = r.foodPieces[0].id;
    expect(r.sheep.some((x) => x.id === stalk(r).victimId)).toBe(false);
    expect(validateState(r).ok).toBe(true);
  });

  it('accepts one living Abomination and none (Story 4.1)', () => {
    const r = raw();
    expect(r.sheep.filter((x) => x.isAbomination === true)).toHaveLength(1);
    expect(validateState(r).ok).toBe(true);
    // With none, nobody is on a visit either (Story 4.3).
    for (const x of r.sheep) {
      x.isAbomination = false;
      if (x.activity === 'stalking') x.activity = 'wander';
      delete x.stalk;
    }
    expect(validateState(r).ok).toBe(true);
  });

  it('accepts a pregnancy whose parents have died', () => {
    const r = raw();
    // Ids that were issued (below nextId) but name no living sheep.
    r.pregnancies[0].parentA = r.foodPieces[0].id;
    r.pregnancies[0].parentB = r.pregnancies[0].id;
    expect(validateState(r).ok).toBe(true);
  });

  it('accepts a boost that never ran, one that has ended and one at its full length (Story 2.8)', () => {
    for (const at of [0, 'past', 'full'] as const) {
      const r = raw();
      r.boostUntil = at === 0 ? 0 : at === 'past' ? (r.time as number) - 1 : (r.time as number) + TUNING.boostMs;
      expect(validateState(r).ok).toBe(true);
    }
  });

  it('accepts no money and a large balance (Story 3.1)', () => {
    for (const m of [0, 2 ** 48]) {
      const r = raw();
      r.money = m;
      expect(validateState(r).ok).toBe(true);
    }
  });

  it('accepts owning nothing, everything, and a valid set in purchase order (Story 3.2)', () => {
    // The busy game's flock spreads over Land I, so it keeps Land I; a new game (start pen) owns nothing.
    const fresh = JSON.parse(JSON.stringify(newGame(3))) as Raw;
    expect(fresh.owned).toEqual([]);
    expect(validateState(fresh).ok).toBe(true);
    const sets: unknown[][] = [
      ['land1'],
      ['land1', 'land2', 'land3', 'flowerPatch', 'scarecrow'],
      ['scarecrow', 'land1', 'flowerPatch', 'land2', 'land3'],
    ];
    for (const owned of sets) {
      const r = raw();
      r.owned = owned;
      expect(validateState(r).ok).toBe(true);
    }
  });

  it("checks positions against the owned land tier's fence (Story 3.3)", () => {
    // A sheep outside the start fence but inside the Land II inner fence.
    const land2 = TUNING.landFences[2];
    const x = land2.x + TUNING.fenceInset;
    const y = land2.y + land2.height - TUNING.fenceInset;
    const withLand = (owned: unknown[]): Raw => {
      const r = raw();
      r.owned = owned;
      r.sheep[0].x = x;
      r.sheep[0].y = y;
      return r;
    };
    expect(validateState(withLand(['land1', 'land2'])).ok).toBe(true);
    // With no land, only the moved sheep is out: the rest are put back in the start pen first.
    const r0 = withLand([]);
    const start = TUNING.landFences[0];
    for (let i = 1; i < r0.sheep.length; i++) {
      r0.sheep[i].x = start.x + start.width / 2;
      r0.sheep[i].y = start.y + start.height / 2;
    }
    for (const list of [r0.foodPieces, r0.breedingPieces, r0.carcasses, r0.pregnancies]) {
      for (const o of list) {
        o.x = start.x + start.width / 2;
        o.y = start.y + start.height / 2;
      }
    }
    const none = validateState(r0);
    expect(none.ok).toBe(false);
    if (!none.ok) expect(none.reason).toContain('sheep[0]');
    const land1 = validateState(withLand(['land1']));
    expect(land1.ok).toBe(false);
    if (!land1.ok) expect(land1.reason).toContain('sheep[0]');
  });

  it('does not mutate its input', () => {
    const r = raw();
    r.sheep[0].fullness = Number.NaN;
    const before = structuredClone(r);
    validateState(r);
    expect(r).toStrictEqual(before);
    const good = raw();
    const goodBefore = structuredClone(good);
    validateState(good);
    expect(good).toStrictEqual(goodBefore);
  });

  // The busy game's tier (Land I): positions are checked against the owned land's fence. Built once.
  const busy = busyGame();
  const f = fenceBounds(busy);
  const inner = innerFence(busy);

  const cases: [string, (r: Raw) => void, string][] = [
    ['state that is null', (r) => Object.assign(r, { __replace: null }), 'state is not an object'],
    ['a NaN time', (r) => (r.time = Number.NaN), 'time'],
    ['a negative time', (r) => (r.time = -100), 'time'],
    ['a fractional time', (r) => (r.time = 100.5), 'time'],
    ['a string time', (r) => (r.time = '100'), 'time'],
    ['a nextId of 0', (r) => (r.nextId = 0), 'nextId'],
    ['a nextId above the counter ceiling', (r) => (r.nextId = 2 ** 48 + 1), 'state.nextId'],
    ['a time above the counter ceiling', (r) => (r.time = 2 ** 50), 'state.time'],
    ['a stats.died above the counter ceiling', (r) => (r.stats.died = Number.MAX_SAFE_INTEGER), 'stats.died'],
    ['a huge stats.moneyEarned', (r) => (r.stats.moneyEarned = 1e300), 'stats.moneyEarned'],
    ['a nextId not above every id', (r) => (r.nextId = r.sheep[0].id), 'nextId'],
    ['a negative rng', (r) => (r.rng = -1), 'rng'],
    ['an rng above 2^32-1', (r) => (r.rng = 2 ** 32), 'rng'],
    ['a fractional rng', (r) => (r.rng = 1.5), 'rng'],
    ['a fractional farmProgress', (r) => (r.farmProgress = 1.5), 'farmProgress'],
    ['a negative farmProgress', (r) => (r.farmProgress = -1), 'farmProgress'],
    ['a full farmProgress', (r) => (r.farmProgress = TUNING.farmPipsPerFood), 'farmProgress'],
    ['a missing breedingProgress', (r) => delete r.breedingProgress, 'breedingProgress'],
    ['a missing money', (r) => delete r.money, 'state.money'],
    ['a NaN money', (r) => (r.money = Number.NaN), 'state.money'],
    ['an infinite money', (r) => (r.money = Number.POSITIVE_INFINITY), 'state.money'],
    ['a negative money', (r) => (r.money = -1), 'state.money'],
    ['a fractional money', (r) => (r.money = 2.5), 'state.money'],
    ['a string money', (r) => (r.money = '10'), 'state.money'],
    ['a money above the counter ceiling', (r) => (r.money = 2 ** 48 + 1), 'state.money'],
    ['a missing medicine', (r) => delete r.medicine, 'state.medicine'],
    ['a negative medicine', (r) => (r.medicine = -1), 'state.medicine'],
    ['a fractional medicine', (r) => (r.medicine = 1.5), 'state.medicine'],
    ['a string medicine', (r) => (r.medicine = '2'), 'state.medicine'],
    ['medicine in owned (a consumable, never a one-time item)', (r) => (r.owned = ['medicine']), 'state.owned'],
    ['a missing owned', (r) => delete r.owned, 'state.owned'],
    ['an owned that is not an array', (r) => (r.owned = 'land1'), 'state.owned'],
    ['an unknown owned item', (r) => (r.owned = ['land1', 'castle']), 'state.owned'],
    ['a non-string owned item', (r) => (r.owned = [1]), 'state.owned'],
    ['an owned item bought twice', (r) => (r.owned = ['flowerPatch', 'flowerPatch']), 'state.owned'],
    ['Land II without Land I', (r) => (r.owned = ['land2']), 'state.owned'],
    ['Land III without Land II', (r) => (r.owned = ['land1', 'land3']), 'state.owned'],
    ['Land II bought before Land I', (r) => (r.owned = ['land2', 'land1']), 'state.owned'],
    ['a missing boostUntil', (r) => delete r.boostUntil, 'state.boostUntil'],
    ['a fractional boostUntil', (r) => (r.boostUntil = 1.5), 'state.boostUntil'],
    ['a negative boostUntil', (r) => (r.boostUntil = -1), 'state.boostUntil'],
    ['a string boostUntil', (r) => (r.boostUntil = '100'), 'state.boostUntil'],
    ['a boostUntil beyond time + boostMs', (r) => (r.boostUntil = (r.time as number) + TUNING.boostMs + 1), 'state.boostUntil'],
    ['a fractional breedingProgress', (r) => (r.breedingProgress = 1.5), 'breedingProgress'],
    ['a negative breedingProgress', (r) => (r.breedingProgress = -1), 'breedingProgress'],
    ['a full breedingProgress', (r) => (r.breedingProgress = TUNING.breedingPipsPerFood), 'breedingProgress'],
    ['breedingPieces that is not an array', (r) => ((r as Record<string, unknown>).breedingPieces = {}), 'breedingPieces'],
    ['a breeding piece outside the inner fence', (r) => (r.breedingPieces[0].x = inner.right + 1), 'breedingPieces[0].x'],
    ['a NaN breeding piece y', (r) => (r.breedingPieces[0].y = Number.NaN), 'breedingPieces[0].y'],
    ['a breeding piece sharing a food piece id', (r) => (r.breedingPieces[0].id = r.foodPieces[0].id), 'breedingPieces[0].id'],
    ['two breeding pieces with one id', (r) => (r.breedingPieces[1].id = r.breedingPieces[0].id), 'breedingPieces[1].id'],
    ['a fractional breeding piece id', (r) => (r.breedingPieces[0].id = 2.5), 'breedingPieces[0].id'],
    ['a missing breeding piece id', (r) => delete r.breedingPieces[0].id, 'breedingPieces[0].id'],
    ['a missing breedReady', (r) => delete r.sheep[0].breedReady, 'sheep[0].breedReady'],
    ['a string breedReady', (r) => (r.sheep[0].breedReady = 'yes'), 'sheep[0].breedReady'],
    ['a NaN cooldownUntil', (r) => (r.sheep[0].cooldownUntil = Number.NaN), 'sheep[0].cooldownUntil'],
    ['a missing cooldownUntil', (r) => delete r.sheep[0].cooldownUntil, 'sheep[0].cooldownUntil'],
    ['a negative cooldownUntil', (r) => (r.sheep[0].cooldownUntil = -1), 'sheep[0].cooldownUntil'],
    [
      'a cooldownUntil past a fresh cooldown',
      (r) => (r.sheep[0].cooldownUntil = (r.time as number) + TUNING.breedCooldownMs + 1),
      'sheep[0].cooldownUntil',
    ],
    ['pregnancies that is not an array', (r) => ((r as Record<string, unknown>).pregnancies = {}), 'pregnancies'],
    ['two pregnancies with one id', (r) => r.pregnancies.push({ ...r.pregnancies[0] }), 'pregnancies[1].id'],
    ['a pregnancy sharing a sheep id', (r) => (r.pregnancies[0].id = r.sheep[0].id), 'pregnancies[0].id'],
    ['a pregnancy parentA of 0', (r) => (r.pregnancies[0].parentA = 0), 'pregnancies[0].parentA'],
    ['a fractional pregnancy parentB', (r) => (r.pregnancies[0].parentB = 1.5), 'pregnancies[0].parentB'],
    ['a pregnancy naming one parent twice', (r) => (r.pregnancies[0].parentB = r.pregnancies[0].parentA), 'pregnancies[0].parentB'],
    ['a pregnancy parent id not yet issued', (r) => (r.pregnancies[0].parentA = r.nextId), 'pregnancies[0].parentA'],
    ['a NaN pregnancy dueAt', (r) => (r.pregnancies[0].dueAt = Number.NaN), 'pregnancies[0].dueAt'],
    [
      'a pregnancy dueAt past a fresh gestation',
      (r) => (r.pregnancies[0].dueAt = (r.time as number) + TUNING.gestationMs + 1),
      'pregnancies[0].dueAt',
    ],
    ['a pregnancy outside the inner fence', (r) => (r.pregnancies[0].x = inner.right + 1), 'pregnancies[0].x'],
    ['an unknown lastEra', (r) => (r.lastEra = 'space-age'), 'lastEra'],
    ['missing stats', (r) => delete (r as Record<string, unknown>).stats, 'stats'],
    ['a negative stats.died', (r) => (r.stats.died = -1), 'stats.died'],
    ['a fractional stats.sold', (r) => (r.stats.sold = 0.5), 'stats.sold'],
    ['a NaN stats.moneyEarned', (r) => (r.stats.moneyEarned = Number.NaN), 'stats.moneyEarned'],
    ['a peakFlock below the flock', (r) => (r.stats.peakFlock = r.sheep.length - 1), 'stats.peakFlock'],
    ['sheep that is not an array', (r) => ((r as Record<string, unknown>).sheep = {}), 'sheep'],
    ['foodPieces that is null', (r) => ((r as Record<string, unknown>).foodPieces = null), 'foodPieces'],
    ['a carcass that is not an object', (r) => ((r as Record<string, unknown>).carcasses = [3]), 'carcasses[0]'],
    ['a NaN sheep x', (r) => (r.sheep[0].x = Number.NaN), 'sheep[0].x'],
    ['an Infinity sheep y', (r) => (r.sheep[1].y = Number.POSITIVE_INFINITY), 'sheep[1].y'],
    ['a NaN heading', (r) => (r.sheep[2].heading = Number.NaN), 'sheep[2].heading'],
    ['a NaN fullness', (r) => (r.sheep[0].fullness = Number.NaN), 'sheep[0].fullness'],
    ['a missing fullness', (r) => delete r.sheep[0].fullness, 'sheep[0].fullness'],
    ['a fullness above the max', (r) => (r.sheep[0].fullness = TUNING.fullnessMax + 1), 'sheep[0].fullness'],
    ['a negative fullness', (r) => (r.sheep[0].fullness = -1), 'sheep[0].fullness'],
    ['a NaN bornAt', (r) => (r.sheep[0].bornAt = Number.NaN), 'sheep[0].bornAt'],
    ['a bornAt after time', (r) => (r.sheep[0].bornAt = (r.time as number) + 100), 'sheep[0].bornAt'],
    ['a NaN restUntil', (r) => (r.sheep[0].restUntil = Number.NaN), 'sheep[0].restUntil'],
    ['an unknown activity', (r) => (r.sheep[0].activity = 'dancing'), 'sheep[0].activity'],
    // Never saved: encodeSave writes a dragged sheep as wander (Story 2.7).
    ['the dragged activity', (r) => (r.sheep[0].activity = 'dragged'), 'sheep[0].activity'],
    ['a null targetId', (r) => (r.sheep[0].targetId = null), 'sheep[0].targetId'],
    ['a fractional targetId', (r) => (r.sheep[0].targetId = 1.5), 'sheep[0].targetId'],
    ['a sheep left of the fence', (r) => (r.sheep[0].x = f.x - 1), 'sheep[0].x'],
    ['a sheep below the fence', (r) => (r.sheep[0].y = f.y + f.height + 1), 'sheep[0].y'],
    ['a piece outside the inner fence', (r) => (r.foodPieces[0].x = inner.left - 1), 'foodPieces[0].x'],
    ['a NaN piece y', (r) => (r.foodPieces[0].y = Number.NaN), 'foodPieces[0].y'],
    ['duplicate sheep ids', (r) => (r.sheep[1].id = r.sheep[0].id), 'sheep[1].id'],
    ['a piece sharing a sheep id', (r) => (r.foodPieces[0].id = r.sheep[0].id), 'foodPieces[0].id'],
    ['a zero id', (r) => (r.sheep[0].id = 0), 'sheep[0].id'],
    ['a fractional id', (r) => (r.sheep[0].id = 2.5), 'sheep[0].id'],
    ['a carcass with a NaN createdAt', (r) => (r.carcasses[0].createdAt = Number.NaN), 'carcasses[0].createdAt'],
    ['a carcass with a fractional createdAt', (r) => (r.carcasses[0].createdAt = 0.5), 'carcasses[0].createdAt'],
    ['a carcass with a negative createdAt', (r) => (r.carcasses[0].createdAt = -100), 'carcasses[0].createdAt'],
    ['a carcass created after time', (r) => (r.carcasses[0].createdAt = (r.time as number) + 100), 'carcasses[0].createdAt'],
    ['a carcass left of the fence', (r) => (r.carcasses[0].x = f.x - 1), 'carcasses[0].x'],
    ['a carcass below the fence', (r) => (r.carcasses[0].y = f.y + f.height + 1), 'carcasses[0].y'],
    ['a NaN carcass x', (r) => (r.carcasses[0].x = Number.NaN), 'carcasses[0].x'],
    ['a NaN infectedAt', (r) => (r.sheep[0].infectedAt = Number.NaN), 'sheep[0].infectedAt'],
    ['a string infectedAt', (r) => (r.sheep[0].infectedAt = '0'), 'sheep[0].infectedAt'],
    ['a null infectedAt', (r) => (r.sheep[0].infectedAt = null), 'sheep[0].infectedAt'],
    ['a fractional infectedAt', (r) => (r.sheep[0].infectedAt = 0.5), 'sheep[0].infectedAt'],
    ['a negative infectedAt', (r) => (r.sheep[0].infectedAt = -100), 'sheep[0].infectedAt'],
    ['an infectedAt after time', (r) => (r.sheep[0].infectedAt = (r.time as number) + 100), 'sheep[0].infectedAt'],
    [
      'an infectedAt before bornAt',
      (r) => {
        r.sheep[0].bornAt = r.time;
        r.sheep[0].infectedAt = (r.time as number) - 100;
      },
      'sheep[0].infectedAt',
    ],
    [
      'an infection past its virus death',
      (r) => {
        r.time = (r.time as number) + TUNING.virusDeathMs;
        r.sheep[0].infectedAt = (r.time as number) - TUNING.virusDeathMs;
      },
      'sheep[0].infectedAt',
    ],
    ['a carcass outside the inner fence', (r) => (r.carcasses[0].x = inner.left - 1), 'carcasses[0].x'],
    ['a null lostAt', (r) => (r.lostAt = null), 'lostAt'],
    ['a string lostAt', (r) => (r.lostAt = '0'), 'lostAt'],
    ['a negative lostAt', (r) => (r.lostAt = -100), 'lostAt'],
    ['a fractional lostAt', (r) => (r.lostAt = 0.5), 'lostAt'],
    ['a lostAt after time', (r) => (r.lostAt = (r.time as number) + 100), 'lostAt'],
    ['an empty pen that is not lost', (r) => (r.sheep.length = 0), 'sheep'],
    // Story 4.1: the Abomination (FR29).
    ['a sheep with no isAbomination', (r) => delete r.sheep[0].isAbomination, 'sheep[0].isAbomination'],
    ['a string isAbomination', (r) => (r.sheep[0].isAbomination = 'no'), 'sheep[0].isAbomination'],
    [
      'two Abominations alive',
      (r) => {
        const i = r.sheep.findIndex((x) => x.isAbomination === true);
        const j = i === 0 ? 1 : 0;
        r.sheep[j].isAbomination = true;
      },
      'second Abomination',
    ],
    ['a missing abomination', (r) => delete r.abomination, 'abomination'],
    ['an abomination that is not an object', (r) => (r.abomination = 3), 'abomination'],
    ['a negative birthsSeen', (r) => ((r.abomination as Record<string, unknown>).birthsSeen = -1), 'birthsSeen'],
    ['a fractional birthsSeen', (r) => ((r.abomination as Record<string, unknown>).birthsSeen = 1.5), 'birthsSeen'],
    ['a guaranteedAtBirth of 0', (r) => ((r.abomination as Record<string, unknown>).guaranteedAtBirth = 0), 'guaranteedAtBirth'],
    ['a fractional guaranteedAtBirth', (r) => ((r.abomination as Record<string, unknown>).guaranteedAtBirth = 9.5), 'guaranteedAtBirth'],
    // Story 4.3: the kill cycle (FR31). The busy fixture's Abomination is on a visit.
    ['stalking without a stalk', (r) => delete abom(r).stalk, 'stalk'],
    ['a stalk while wandering', (r) => (abom(r).activity = 'wander'), 'stalk'],
    [
      'a stalk on a sheep that is not the Abomination',
      (r) => {
        const o = r.sheep.find((x) => x.isAbomination === false && !('doomedAt' in x))!;
        o.activity = 'stalking';
        o.stalk = { ...(abom(r).stalk as object) };
      },
      'stalk',
    ],
    ['a stalk that is not an object', (r) => (abom(r).stalk = 3), 'stalk'],
    ['a stalk victimId of 0', (r) => (stalk(r).victimId = 0), 'stalk.victimId'],
    ['an unknown stalk phase', (r) => (stalk(r).phase = 'pounce'), 'stalk.phase'],
    ['an inherited name as the stalk phase', (r) => (stalk(r).phase = 'constructor'), 'stalk.phase'],
    ['a non-string stalk phase', (r) => (stalk(r).phase = 3), 'stalk.phase'],
    ['a stalk on the Abomination itself', (r) => (stalk(r).victimId = abom(r).id), 'stalk.victimId'],
    ['a stalk victim id never issued', (r) => (stalk(r).victimId = r.nextId), 'stalk.victimId'],
    [
      'a pen holding only the Abomination that is not lost',
      (r) => {
        const a = abom(r);
        a.activity = 'wander';
        delete a.stalk;
        r.sheep = [a];
        r.stats.peakFlock = Math.max(r.stats.peakFlock as number, 1);
      },
      'only the Abomination',
    ],
    ['a stalk until at time', (r) => (stalk(r).until = r.time), 'stalk.until'],
    [
      'a linger longer than abominationLingerMs',
      (r) => {
        stalk(r).phase = 'linger';
        stalk(r).until = (r.time as number) + TUNING.abominationLingerMs + TICK_MS;
      },
      'stalk.until',
    ],
    ['a doomedAt on the Abomination', (r) => (abom(r).doomedAt = (r.time as number) + TICK_MS), 'doomedAt'],
    ['a doomedAt at time', (r) => (doomed(r).doomedAt = r.time), 'doomedAt'],
    ['a doomedAt past abominationDoomMaxMs', (r) => (doomed(r).doomedAt = (r.time as number) + TUNING.abominationDoomMaxMs + TICK_MS), 'doomedAt'],
    ['a fractional doomedAt', (r) => (doomed(r).doomedAt = (r.time as number) + 0.5), 'doomedAt'],
    ['a missing nextKillAt', (r) => delete (r.abomination as Record<string, unknown>).nextKillAt, 'nextKillAt'],
    ['a negative nextKillAt', (r) => ((r.abomination as Record<string, unknown>).nextKillAt = -1), 'nextKillAt'],
    [
      'a nextKillAt past abominationKillMaxMs',
      (r) => ((r.abomination as Record<string, unknown>).nextKillAt = (r.time as number) + TUNING.abominationKillMaxMs + TICK_MS),
      'nextKillAt',
    ],
  ];

  it.each(cases)('rejects %s and names the field', (_name, breakIt, field) => {
    const r = raw();
    breakIt(r);
    const input = '__replace' in r ? r.__replace : r;
    const result = validateState(input);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain(field);
  });

  it('rejects non-object inputs', () => {
    for (const v of [null, undefined, 3, 'state', [], true]) expect(validateState(v).ok).toBe(false);
  });

  it('never throws, even on a getter that throws', () => {
    const r = raw();
    Object.defineProperty(r, 'time', {
      get() {
        throw new Error('boom');
      },
      enumerable: true,
    });
    expect(() => validateState(r)).not.toThrow();
    expect(validateState(r).ok).toBe(false);
  });

  it('accepts a game after a death (the id gap is fine)', () => {
    const state = busyGame();
    killSheep(state, state.sheep[3].id, 'starved');
    expect(validateState(state).ok).toBe(true);
  });
});
