import { describe, expect, it } from 'vitest';
import { TUNING } from '../../../src/config/tuning';
import { drainEvents, type SimEvent } from '../../../src/sim/events';
import { createSheep, type GameState } from '../../../src/sim/state';
import {
  checkLastSheepAndLoss,
  clearCarcass,
  createCarcass,
  killSheep,
  removeSheep,
  updateCarcassEating,
} from '../../../src/sim/systems/carcass';
import { createBreedingPiece, createFoodPiece } from '../../../src/sim/systems/feeding';
import { innerFence, newGame } from '../helpers';

function drained(): SimEvent[] {
  const out: SimEvent[] = [];
  drainEvents((e) => out.push(e));
  return out;
}

describe('killSheep', () => {
  it('removes exactly that sheep and keeps the others in order', () => {
    const state = newGame(7);
    const [a, b, c] = state.sheep;
    killSheep(state, b.id, 'starved');
    expect(state.sheep).toEqual([a, c]);
  });

  it('counts the death and emits SheepDied, then CarcassSpawned, at the sheep position', () => {
    const state = newGame(7);
    const s = state.sheep[1];
    const carcassId = state.nextId;
    killSheep(state, s.id, 'starved');
    expect(state.stats.died).toBe(1);
    expect(drained()).toEqual([
      { type: 'SheepDied', id: s.id, cause: 'starved', x: s.x, y: s.y },
      { type: 'CarcassSpawned', id: carcassId, x: s.x, y: s.y },
    ]);
  });

  it('leaves a carcass at the sheep position (FR12), taking the next id and no rng', () => {
    expect(TUNING.carcassesEnabled).toBe(true);
    const state = newGame(7);
    state.time = 4_200;
    const s = state.sheep[0];
    const nextId = state.nextId;
    const rng = state.rng;
    killSheep(state, s.id, 'oldAge');
    expect(state.carcasses).toEqual([{ id: nextId, x: s.x, y: s.y, createdAt: state.time }]);
    expect(state.nextId).toBe(nextId + 1);
    expect(state.rng).toBe(rng);
  });

  it('rejects an unknown id without changing the state', () => {
    const state = newGame(7);
    const before = structuredClone(state);
    expect(() => killSheep(state, 9_999, 'starved')).toThrow(/killSheep/);
    expect(state).toEqual(before);
    expect(drained()).toEqual([]);
  });
});

describe('removeSheep', () => {
  it('removes exactly that sheep in order, with no carcass, no events, no rng and no new id', () => {
    const state = newGame(7);
    const [a, b, c] = state.sheep;
    const nextId = state.nextId;
    const rng = state.rng;
    removeSheep(state, b.id, 'sacrificed');
    expect(state.sheep).toEqual([a, c]);
    expect(state.carcasses).toEqual([]);
    expect(state.stats).toMatchObject({ sacrificed: 1, sold: 0, died: 0 });
    expect(state.nextId).toBe(nextId);
    expect(state.rng).toBe(rng);
    expect(drained()).toEqual([]);
  });

  it("counts a 'sold' removal as sold", () => {
    const state = newGame(7);
    removeSheep(state, state.sheep[0].id, 'sold');
    expect(state.stats).toMatchObject({ sacrificed: 0, sold: 1, died: 0 });
  });

  it('rejects an unknown id without changing the state', () => {
    const state = newGame(7);
    const before = structuredClone(state);
    expect(() => removeSheep(state, 9_999, 'sacrificed')).toThrow(/removeSheep/);
    expect(state).toEqual(before);
  });

  it('removing the last sheep loses the game', () => {
    const state = newGame(7);
    state.time = 4_200;
    for (const s of state.sheep.slice()) removeSheep(state, s.id, 'sacrificed');
    expect(state.lostAt).toBe(4_200);
    expect(drained()).toEqual([
      { type: 'Lost', survivedMs: 4_200, peakFlock: TUNING.startFlockAdults + TUNING.startFlockLambs },
    ]);
  });
});

describe('checkLastSheepAndLoss', () => {
  it('killing the last sheep loses the game: lostAt is set and Lost follows the last SheepDied', () => {
    const state = newGame(7);
    state.time = 4_200;
    const ids = state.sheep.map((s) => s.id);
    for (const id of ids.slice(0, -1)) killSheep(state, id, 'starved');
    drained();
    const last = state.sheep[0];
    const carcassId = state.nextId;
    killSheep(state, last.id, 'starved');
    expect(state.lostAt).toBe(state.time);
    expect(drained()).toEqual([
      { type: 'SheepDied', id: last.id, cause: 'starved', x: last.x, y: last.y },
      { type: 'CarcassSpawned', id: carcassId, x: last.x, y: last.y },
      { type: 'Lost', survivedMs: state.time, peakFlock: TUNING.startFlockAdults + TUNING.startFlockLambs },
    ]);
  });

  it('a death that leaves sheep alive is not a loss', () => {
    const state = newGame(7);
    killSheep(state, state.sheep[0].id, 'starved');
    expect('lostAt' in state).toBe(false);
    expect(drained().some((e) => e.type === 'Lost')).toBe(false);
  });

  it('does nothing while sheep are alive', () => {
    const state = newGame(7);
    const before = structuredClone(state);
    checkLastSheepAndLoss(state);
    expect(state).toStrictEqual(before);
    expect(drained()).toEqual([]);
  });

  it('fires once: a second check on a lost game changes nothing', () => {
    const state = newGame(7);
    for (const id of state.sheep.map((s) => s.id)) killSheep(state, id, 'starved');
    drained();
    state.time += 1_000;
    const before = structuredClone(state);
    checkLastSheepAndLoss(state);
    expect(state).toStrictEqual(before);
    expect(drained()).toEqual([]);
  });
});

describe('checkLastSheepAndLoss: only the Abomination left (Rylan, Story 4.3 review)', () => {
  /** A new game whose lamb (the founders' last sheep) is the Abomination, events cleared. */
  function withAbomination(): GameState {
    const state = newGame(4);
    state.sheep[state.sheep.length - 1].isAbomination = true;
    state.abomination.nextKillAt = Number.MAX_SAFE_INTEGER;
    drainEvents(() => {});
    return state;
  }
  const drained = (): SimEvent[] => {
    const out: SimEvent[] = [];
    drainEvents((e) => out.push(e));
    return out;
  };

  it.each(['sold', 'sacrificed'] as const)('is a loss once the last other sheep is %s', (reason) => {
    const state = withAbomination();
    const others = state.sheep.filter((s) => !s.isAbomination);
    removeSheep(state, others[0].id, reason);
    expect(state.lostAt).toBeUndefined();
    removeSheep(state, others[1].id, reason);
    expect(state.lostAt).toBe(state.time);
    expect(state.sheep.map((s) => s.isAbomination)).toEqual([true]);
    expect(drained()).toEqual([{ type: 'Lost', survivedMs: state.time, peakFlock: state.stats.peakFlock }]);
  });

  it('is a loss once the last other sheep dies, Lost after its SheepDied and carcass', () => {
    const state = withAbomination();
    const others = state.sheep.filter((s) => !s.isAbomination);
    killSheep(state, others[0].id, 'starved');
    drained();
    killSheep(state, others[1].id, 'virus');
    expect(drained().map((e) => e.type)).toEqual(['SheepDied', 'CarcassSpawned', 'Lost']);
  });

  it('a pending lamb does not keep it going (as for an empty pen)', () => {
    const state = withAbomination();
    const [a, b] = state.sheep.filter((s) => !s.isAbomination);
    state.pregnancies.push({ id: state.nextId++, parentA: a.id, parentB: b.id, dueAt: state.time + TUNING.gestationMs, x: a.x, y: a.y });
    removeSheep(state, a.id, 'sold');
    removeSheep(state, b.id, 'sold');
    expect(state.lostAt).toBeDefined();
  });

  it('sacrificing the Abomination itself is not a loss while others live', () => {
    const state = withAbomination();
    const abom = state.sheep.find((s) => s.isAbomination)!;
    removeSheep(state, abom.id, 'sacrificed');
    expect(state.lostAt).toBeUndefined();
  });
});

describe('createCarcass', () => {
  it('adds a carcass at (x, y) with the next id and the current time, emitting nothing', () => {
    const state = newGame(7);
    state.time = 1_000;
    const id = state.nextId;
    const c = createCarcass(state, 600, 400);
    expect(c).toEqual({ id, x: 600, y: 400, createdAt: 1_000 });
    expect(state.carcasses).toEqual([c]);
    expect(drained()).toEqual([]);
  });
});

describe('clearCarcass (FR13)', () => {
  it('removes exactly that carcass, keeps the others in order and emits CarcassCleared', () => {
    const state = newGame(7);
    const a = createCarcass(state, 600, 400);
    const b = createCarcass(state, 650, 420);
    const c = createCarcass(state, 700, 440);
    clearCarcass(state, b.id);
    expect(state.carcasses).toEqual([a, c]);
    expect(drained()).toEqual([{ type: 'CarcassCleared', id: b.id, x: b.x, y: b.y }]);
  });

  it.each([
    ['an unknown id', (_s: ReturnType<typeof newGame>) => 9_999],
    ["a sheep's id", (s: ReturnType<typeof newGame>) => s.sheep[0].id],
  ])('ignores %s: no change, no event, no throw', (_name, idOf) => {
    const state = newGame(7);
    createCarcass(state, 600, 400);
    const before = structuredClone(state);
    clearCarcass(state, idOf(state));
    expect(state).toStrictEqual(before);
    expect(drained()).toEqual([]);
  });

  it('a second clear of the same id changes nothing', () => {
    const state = newGame(7);
    const c = createCarcass(state, 600, 400);
    clearCarcass(state, c.id);
    drained();
    const before = structuredClone(state);
    clearCarcass(state, c.id);
    expect(state).toStrictEqual(before);
    expect(drained()).toEqual([]);
  });
});

/** Starving: just under the Starving bound. */
const STARVING = TUNING.starvingBelow - 5;

/** A game with no founders: adults at the given spots and Fullness (default Starving), standing still. */
function gameWith(spots: readonly { x: number; y: number; fullness?: number }[]): GameState {
  const state = newGame(52);
  state.sheep.length = 0;
  for (const p of spots) {
    const s = createSheep(state, { x: p.x, y: p.y, bornAt: -TUNING.startAdultAgeMs });
    s.fullness = p.fullness ?? STARVING;
    s.restUntil = 1e9;
  }
  drained();
  return state;
}

function mid(state: GameState): { x: number; y: number } {
  const r = innerFence(state);
  return { x: (r.left + r.right) / 2, y: (r.top + r.bottom) / 2 };
}

describe('updateCarcassEating claims (FR14)', () => {
  it('sends a Starving sheep to its nearest carcass when no food piece is on the field', () => {
    const c = mid(newGame());
    const state = gameWith([{ x: c.x, y: c.y }]);
    createCarcass(state, c.x + 80, c.y);
    const near = createCarcass(state, c.x - 40, c.y);
    updateCarcassEating(state);
    expect(state.sheep[0]).toMatchObject({ activity: 'seekCarcass', targetId: near.id });
  });

  it('does not seek a carcass while a food piece is on the field', () => {
    const c = mid(newGame());
    const state = gameWith([{ x: c.x, y: c.y }]);
    createCarcass(state, c.x + 40, c.y);
    createFoodPiece(state, c.x - 100, c.y);
    updateCarcassEating(state);
    expect(state.sheep[0].activity).toBe('wander');
    expect(state.sheep[0].targetId).toBeUndefined();
  });

  it('breeding pieces are not food: a Starving sheep still seeks the carcass', () => {
    const c = mid(newGame());
    const state = gameWith([{ x: c.x, y: c.y }]);
    const k = createCarcass(state, c.x + 40, c.y);
    createBreedingPiece(state, c.x - 40, c.y);
    updateCarcassEating(state);
    expect(state.sheep[0]).toMatchObject({ activity: 'seekCarcass', targetId: k.id });
  });

  it('ignores a sheep that is not Starving (Fullness exactly at the bound is Hungry)', () => {
    const c = mid(newGame());
    const state = gameWith([{ x: c.x, y: c.y, fullness: TUNING.starvingBelow }]);
    createCarcass(state, c.x + 40, c.y);
    const before = structuredClone(state);
    updateCarcassEating(state);
    expect(state).toStrictEqual(before);
  });

  it('does not take an eating or food-seeking sheep, but takes a breeding-food seeker', () => {
    const c = mid(newGame());
    const state = gameWith([
      { x: c.x - 60, y: c.y },
      { x: c.x, y: c.y - 60 },
      { x: c.x + 60, y: c.y },
    ]);
    const [eater, foodSeeker, breeder] = state.sheep;
    eater.activity = 'eating';
    foodSeeker.activity = 'seekFood';
    foodSeeker.targetId = 9_999;
    breeder.activity = 'seekBreedingFood';
    breeder.targetId = 9_998;
    const k = createCarcass(state, c.x, c.y);
    updateCarcassEating(state);
    expect(eater.activity).toBe('eating');
    expect(foodSeeker).toMatchObject({ activity: 'seekFood', targetId: 9_999 });
    expect(breeder).toMatchObject({ activity: 'seekCarcass', targetId: k.id });
  });

  it('lets several Starving sheep head for the same carcass', () => {
    const c = mid(newGame());
    const state = gameWith([
      { x: c.x - 60, y: c.y },
      { x: c.x + 60, y: c.y },
    ]);
    const k = createCarcass(state, c.x, c.y);
    updateCarcassEating(state);
    expect(state.sheep.map((s) => s.targetId)).toEqual([k.id, k.id]);
  });
});

describe('updateCarcassEating release', () => {
  it('a cleared target sends the sheep to the next nearest carcass on the same call', () => {
    const c = mid(newGame());
    const state = gameWith([{ x: c.x, y: c.y }]);
    const near = createCarcass(state, c.x - 40, c.y);
    const far = createCarcass(state, c.x + 80, c.y);
    updateCarcassEating(state);
    clearCarcass(state, near.id);
    drained();
    updateCarcassEating(state);
    expect(state.sheep[0]).toMatchObject({ activity: 'seekCarcass', targetId: far.id });
  });

  it('a food piece landing sends a carcass seeker back to wander', () => {
    const c = mid(newGame());
    const state = gameWith([{ x: c.x, y: c.y }]);
    createCarcass(state, c.x - 40, c.y);
    updateCarcassEating(state);
    createFoodPiece(state, c.x + 100, c.y);
    updateCarcassEating(state);
    expect(state.sheep[0].activity).toBe('wander');
    expect(state.sheep[0].targetId).toBeUndefined();
  });

  it('a carcass seeker that is no longer Starving goes back to wander', () => {
    const c = mid(newGame());
    const state = gameWith([{ x: c.x, y: c.y }]);
    createCarcass(state, c.x - 40, c.y);
    updateCarcassEating(state);
    state.sheep[0].fullness = TUNING.fedAbove;
    updateCarcassEating(state);
    expect(state.sheep[0].activity).toBe('wander');
    expect(state.sheep[0].targetId).toBeUndefined();
  });
});

describe('updateCarcassEating eating (FR15)', () => {
  it('eats on arrival: removes the carcass, feeds, munches and infects, emitting CarcassEaten then Infected', () => {
    const c = mid(newGame());
    const state = gameWith([{ x: c.x - 40, y: c.y }]);
    state.time = 5_000;
    const other = createCarcass(state, c.x + 100, c.y);
    const k = createCarcass(state, c.x, c.y);
    updateCarcassEating(state);
    const s = state.sheep[0];
    expect(s).toMatchObject({ activity: 'seekCarcass', targetId: k.id });
    // Walked into reach.
    s.x = c.x - (TUNING.eatReachPx - 1);
    updateCarcassEating(state);
    expect(state.carcasses).toEqual([other]);
    expect(s.fullness).toBeCloseTo(STARVING + TUNING.carcassFullness);
    expect(s.activity).toBe('eating');
    expect(s.restUntil).toBe(state.time + TUNING.eatMs);
    expect(s.targetId).toBeUndefined();
    expect(s.infectedAt).toBe(state.time);
    expect(drained()).toEqual([
      { type: 'CarcassEaten', sheepId: s.id, carcassId: k.id, x: k.x, y: k.y },
      { type: 'Infected', id: s.id, x: s.x, y: s.y },
    ]);
  });

  it('a Starving sheep already in reach of a carcass eats it on the claim, not a tick later', () => {
    const c = mid(newGame());
    const state = gameWith([{ x: c.x, y: c.y }]);
    const k = createCarcass(state, c.x + TUNING.eatReachPx - 1, c.y);
    updateCarcassEating(state);
    const s = state.sheep[0];
    expect(state.carcasses).toEqual([]);
    expect(s).toMatchObject({ activity: 'eating', infectedAt: state.time });
    expect(drained()).toEqual([
      { type: 'CarcassEaten', sheepId: s.id, carcassId: k.id, x: k.x, y: k.y },
      { type: 'Infected', id: s.id, x: s.x, y: s.y },
    ]);
  });

  it('does not eat a carcass in reach while a food piece is on the field', () => {
    const c = mid(newGame());
    const state = gameWith([{ x: c.x - 40, y: c.y }]);
    const k = createCarcass(state, c.x, c.y);
    updateCarcassEating(state);
    state.sheep[0].x = c.x;
    createFoodPiece(state, c.x + 100, c.y);
    updateCarcassEating(state);
    expect(state.carcasses).toEqual([k]);
    expect(state.sheep[0].infectedAt).toBeUndefined();
    expect(state.sheep[0].activity).toBe('wander');
  });

  it('two in reach of one carcass: the first in array order eats it, the other gets nothing', () => {
    const c = mid(newGame());
    const state = gameWith([
      { x: c.x - 2, y: c.y },
      { x: c.x + 2, y: c.y },
    ]);
    createCarcass(state, c.x, c.y);
    updateCarcassEating(state);
    const [a, b] = state.sheep;
    expect(a.infectedAt).toBe(state.time);
    expect(b.activity).toBe('wander');
    expect(b.targetId).toBeUndefined();
    expect(b.infectedAt).toBeUndefined();
  });

  it('a seeker whose carcass a later sheep ate picks the next carcass on the same call', () => {
    const c = mid(newGame());
    const state = gameWith([
      { x: c.x - 60, y: c.y },
      { x: c.x + 60, y: c.y },
    ]);
    const [far, near] = state.sheep;
    const x = createCarcass(state, c.x, c.y);
    const y = createCarcass(state, c.x - 120, c.y + 60);
    // Both head for X (Y is farther for each), then the later sheep reaches it first.
    updateCarcassEating(state);
    expect([far.targetId, near.targetId]).toEqual([x.id, x.id]);
    near.x = c.x + 1;
    updateCarcassEating(state);
    expect(near.infectedAt).toBe(state.time);
    expect(far).toMatchObject({ activity: 'seekCarcass', targetId: y.id });
  });

  it('an infected eater keeps its first infectedAt and emits no second Infected', () => {
    const c = mid(newGame());
    const state = gameWith([{ x: c.x, y: c.y }]);
    const s = state.sheep[0];
    s.infectedAt = 100;
    state.time = 4_000;
    const k = createCarcass(state, c.x, c.y);
    updateCarcassEating(state);
    updateCarcassEating(state);
    expect(s.infectedAt).toBe(100);
    expect(drained()).toEqual([{ type: 'CarcassEaten', sheepId: s.id, carcassId: k.id, x: k.x, y: k.y }]);
  });

  it('draws no rng, and changes nothing with no carcass', () => {
    const c = mid(newGame());
    const state = gameWith([{ x: c.x, y: c.y }]);
    const before = structuredClone(state);
    updateCarcassEating(state);
    expect(state).toStrictEqual(before);
    createCarcass(state, c.x, c.y);
    const rng = state.rng;
    updateCarcassEating(state);
    updateCarcassEating(state);
    expect(state.rng).toBe(rng);
  });

  it('a ClearCarcass for a carcass a sheep already ate is a silent no-op', () => {
    const c = mid(newGame());
    const state = gameWith([{ x: c.x, y: c.y }]);
    const k = createCarcass(state, c.x, c.y);
    updateCarcassEating(state);
    updateCarcassEating(state);
    drained();
    const before = structuredClone(state);
    clearCarcass(state, k.id);
    expect(state).toStrictEqual(before);
    expect(drained()).toEqual([]);
  });
});
