import { describe, expect, it } from 'vitest';
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

  const f = fenceBounds(newGame(1));
  const inner = innerFence(newGame(1));

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
    [
      'a carcass with a NaN createdAt',
      // Entities are checked before nextId, so the unused id does not mask the field error.
      (r) => r.carcasses.push({ id: r.nextId as number, x: 600, y: 400, createdAt: Number.NaN }),
      'carcasses[0]',
    ],
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
