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
