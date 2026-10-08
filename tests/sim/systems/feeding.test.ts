import { describe, expect, it } from 'vitest';
import { TICK_MS } from '../../../src/config/constants';
import { TUNING } from '../../../src/config/tuning';
import { drainEvents, type SimEvent } from '../../../src/sim/events';
import { createSheep, type GameState, type Sheep } from '../../../src/sim/state';
import { createCarcass } from '../../../src/sim/systems/carcass';
import { createBreedingPiece, createFoodPiece, updateFeeding } from '../../../src/sim/systems/feeding';
import { innerFence, newGame, runFor } from '../helpers';

/** A game with no founders: sheep at the given spots and Fullness (default: hungry enough to seek). */
function gameWith(spots: readonly { x: number; y: number; fullness?: number }[]): GameState {
  const state = newGame(31);
  state.sheep.length = 0;
  for (const p of spots) {
    const s = createSheep(state, { x: p.x, y: p.y, bornAt: -TUNING.startAdultAgeMs });
    s.fullness = p.fullness ?? TUNING.seekBelowFullness - 30;
    // Grazing, so the sheep stays put in tests that step the sim.
    s.restUntil = 1e9;
  }
  return state;
}

function mid(state: GameState): { x: number; y: number } {
  const r = innerFence(state);
  return { x: (r.left + r.right) / 2, y: (r.top + r.bottom) / 2 };
}

function drained(): SimEvent[] {
  const out: SimEvent[] = [];
  drainEvents((e) => out.push(e));
  return out;
}

function seekers(state: GameState, pieceId: number): Sheep[] {
  return state.sheep.filter((s) => s.activity === 'seekFood' && s.targetId === pieceId);
}

describe('createFoodPiece', () => {
  it('clamps into the inner fence and takes a fresh id', () => {
    const state = gameWith([]);
    const r = innerFence(state);
    const id = state.nextId;
    const p = createFoodPiece(state, r.left - 30, r.bottom + 30);
    expect(p).toEqual({ id, x: r.left, y: r.bottom });
    expect(state.foodPieces).toEqual([p]);
  });
});

describe('updateFeeding claims', () => {
  it('sends the nearest eligible sheep to a piece', () => {
    const c0 = mid(newGame());
    const state = gameWith([
      { x: c0.x - 100, y: c0.y },
      { x: c0.x + 20, y: c0.y },
    ]);
    const p = createFoodPiece(state, c0.x, c0.y);
    updateFeeding(state);
    expect(state.sheep[1]).toMatchObject({ activity: 'seekFood', targetId: p.id });
    expect(state.sheep[0].activity).toBe('wander');
    expect('targetId' in state.sheep[0]).toBe(false);
  });

  it('never assigns a sheep at or above seekBelowFullness', () => {
    const c = mid(newGame());
    const state = gameWith([{ x: c.x + 10, y: c.y, fullness: TUNING.seekBelowFullness }]);
    createFoodPiece(state, c.x, c.y);
    updateFeeding(state);
    expect(state.sheep[0].activity).toBe('wander');
  });

  it('gives two pieces to two sheep, never two seekers on one piece', () => {
    const c = mid(newGame());
    const state = gameWith([
      { x: c.x - 60, y: c.y },
      { x: c.x - 50, y: c.y },
      { x: c.x - 40, y: c.y },
    ]);
    const a = createFoodPiece(state, c.x - 70, c.y);
    const b = createFoodPiece(state, c.x + 80, c.y);
    updateFeeding(state);
    expect(seekers(state, a.id)).toHaveLength(1);
    expect(seekers(state, b.id)).toHaveLength(1);
    expect(state.sheep.filter((s) => s.activity === 'seekFood')).toHaveLength(2);
  });

  it('lets the chosen sheep take its own nearest unclaimed piece', () => {
    const c = mid(newGame());
    // The old piece's nearest sheep stands right on a newer piece: it takes that one.
    const state = gameWith([{ x: c.x, y: c.y }]);
    const older = createFoodPiece(state, c.x - 80, c.y);
    const newer = createFoodPiece(state, c.x + 2, c.y);
    updateFeeding(state);
    expect(state.sheep[0].targetId).toBe(newer.id);
    expect(seekers(state, older.id)).toHaveLength(0);
  });

  it('does not throw when the only eligible sheep has a non-finite position (corrupt save)', () => {
    const c = mid(newGame());
    const state = gameWith([{ x: c.x, y: c.y }]);
    state.sheep[0].x = Number.NaN;
    createFoodPiece(state, c.x, c.y);
    expect(() => updateFeeding(state)).not.toThrow();
    expect(state.sheep[0].activity).toBe('wander');
  });

  it('reverts a stale claim to wander with targetId omitted', () => {
    const c = mid(newGame());
    const state = gameWith([{ x: c.x + 50, y: c.y }]);
    createFoodPiece(state, c.x, c.y);
    updateFeeding(state);
    expect(state.sheep[0].activity).toBe('seekFood');
    state.foodPieces.length = 0;
    updateFeeding(state);
    expect(state.sheep[0].activity).toBe('wander');
    expect('targetId' in state.sheep[0]).toBe(false);
  });
});

describe('updateFeeding eating', () => {
  it('eats on arrival: +foodPieceFullness, piece gone, FoodEaten, then wanders after eatMs', () => {
    const c = mid(newGame());
    const start = TUNING.seekBelowFullness - 30;
    const state = gameWith([{ x: c.x + TUNING.eatReachPx / 2, y: c.y, fullness: start }]);
    const s = state.sheep[0];
    const p = createFoodPiece(state, c.x, c.y);
    drained();
    updateFeeding(state); // claim
    updateFeeding(state); // already within reach: eat
    expect(s.fullness).toBe(start + TUNING.foodPieceFullness);
    expect(state.foodPieces).toEqual([]);
    expect(s.activity).toBe('eating');
    expect('targetId' in s).toBe(false);
    expect(drained()).toEqual([{ type: 'FoodEaten', sheepId: s.id, pieceId: p.id, x: p.x, y: p.y }]);
    state.time = s.restUntil - TICK_MS;
    updateFeeding(state);
    expect(s.activity).toBe('eating');
    state.time = s.restUntil;
    updateFeeding(state);
    expect(s.activity).toBe('wander');
  });

  it('caps Fullness at fullnessMax', () => {
    const c = mid(newGame());
    const state = gameWith([{ x: c.x, y: c.y, fullness: TUNING.seekBelowFullness - 1 }]);
    createFoodPiece(state, c.x, c.y);
    updateFeeding(state);
    updateFeeding(state);
    expect(state.sheep[0].fullness).toBe(TUNING.fullnessMax);
  });
});

describe('feeding over time', () => {
  it('leaves pieces on the field indefinitely when nobody can eat them', () => {
    const state = gameWith([]);
    const c = mid(state);
    createFoodPiece(state, c.x, c.y);
    createFoodPiece(state, c.x + 30, c.y);
    runFor(state, 10 * TUNING.starveMs);
    expect(state.foodPieces).toHaveLength(2);
  });

  it('a seeker that starves on the way frees its piece for another sheep', () => {
    const c = mid(newGame());
    const r = innerFence(newGame());
    const state = gameWith([
      { x: r.left, y: c.y, fullness: 0.05 },
      { x: r.right, y: c.y, fullness: TUNING.fedAbove },
    ]);
    // The other sheep is Fed but still hungry enough to seek.
    expect(TUNING.fedAbove).toBeLessThan(TUNING.seekBelowFullness);
    const [doomed, other] = state.sheep;
    // Nearer the doomed sheep, so it claims the piece first.
    const p = createFoodPiece(state, r.left + 100, c.y);
    runFor(state, TICK_MS);
    expect(state.sheep).not.toContain(doomed);
    runFor(state, TICK_MS);
    expect(other).toMatchObject({ activity: 'seekFood', targetId: p.id });
  });

  it('reaches and eats a piece that another sheep is standing on', () => {
    const c = mid(newGame());
    const state = gameWith([
      { x: c.x, y: c.y, fullness: TUNING.seekBelowFullness + 5 }, // full, grazing on the spot
      { x: c.x + 60, y: c.y },
    ]);
    const eater = state.sheep[1];
    const before = eater.fullness;
    createFoodPiece(state, c.x, c.y);
    // Keep the grazer above the threshold for the whole run, so only the hungry sheep may eat.
    state.sheep[0].fullness = TUNING.fullnessMax;
    const events = runFor(state, 5_000);
    expect(events.some((e) => e.type === 'FoodEaten' && e.sheepId === eater.id)).toBe(true);
    expect(eater.fullness).toBeGreaterThan(before);
  });
});

describe('createBreedingPiece', () => {
  it('clamps into the inner fence, takes a fresh id and goes to breedingPieces', () => {
    const state = gameWith([]);
    const r = innerFence(state);
    const id = state.nextId;
    const p = createBreedingPiece(state, r.right + 30, r.top - 30);
    expect(p).toEqual({ id, x: r.right, y: r.top });
    expect(state.breedingPieces).toEqual([p]);
    expect(state.foodPieces).toEqual([]);
  });
});

describe('updateFeeding breeding food (FR8a)', () => {
  const FED = TUNING.seekBelowFullness;

  it('sends a fed adult to a breeding piece; on arrival it becomes ready, Fullness unchanged', () => {
    const c = mid(newGame());
    const state = gameWith([{ x: c.x + TUNING.eatReachPx / 2, y: c.y, fullness: FED }]);
    const s = state.sheep[0];
    const p = createBreedingPiece(state, c.x, c.y);
    drained();
    updateFeeding(state); // claim
    expect(s).toMatchObject({ activity: 'seekBreedingFood', targetId: p.id });
    updateFeeding(state); // within reach: eat
    expect(s.breedReady).toBe(true);
    expect(s.fullness).toBe(FED);
    expect(state.breedingPieces).toEqual([]);
    expect(s.activity).toBe('eating');
    expect('targetId' in s).toBe(false);
    expect(drained()).toEqual([{ type: 'BreedingFoodEaten', sheepId: s.id, pieceId: p.id, x: p.x, y: p.y }]);
    state.time = s.restUntil;
    updateFeeding(state);
    expect(s.activity).toBe('wander');
  });

  it('ignores lambs, elders and ready adults', () => {
    const c = mid(newGame());
    const state = gameWith([
      { x: c.x - 60, y: c.y, fullness: FED },
      { x: c.x, y: c.y - 40, fullness: FED },
      { x: c.x + 60, y: c.y, fullness: FED },
    ]);
    const [lamb, elder, ready] = state.sheep;
    lamb.bornAt = state.time;
    elder.bornAt = state.time - TUNING.elderFromMs;
    ready.breedReady = true;
    const p = createBreedingPiece(state, c.x, c.y);
    for (let t = 0; t < 3; t++) updateFeeding(state);
    expect(state.sheep.every((x) => x.activity === 'wander')).toBe(true);
    expect(state.breedingPieces).toEqual([p]);
  });

  it('ignores the Abomination at adult age: it stays a lamb, so it never eats breeding food (FR30)', () => {
    const c = mid(newGame());
    const state = gameWith([{ x: c.x + TUNING.eatReachPx / 2, y: c.y, fullness: FED }]);
    const abom = state.sheep[0];
    abom.isAbomination = true;
    abom.bornAt = state.time - TUNING.lambUntilMs - 1;
    const p = createBreedingPiece(state, c.x, c.y);
    for (let t = 0; t < 3; t++) updateFeeding(state);
    expect(abom.activity).toBe('wander');
    expect(abom.breedReady).toBe(false);
    expect(state.breedingPieces).toEqual([p]);
  });

  it('food comes first: a hungry adult takes the food piece, not the breeding piece', () => {
    const c = mid(newGame());
    const state = gameWith([{ x: c.x, y: c.y }]);
    const s = state.sheep[0];
    // The breeding piece is the closer one.
    createBreedingPiece(state, c.x + 5, c.y);
    const food = createFoodPiece(state, c.x + 80, c.y);
    updateFeeding(state);
    expect(s).toMatchObject({ activity: 'seekFood', targetId: food.id });
  });

  it('a hungry adult with no food on the field may take breeding food', () => {
    const c = mid(newGame());
    const state = gameWith([{ x: c.x, y: c.y }]);
    const p = createBreedingPiece(state, c.x + 50, c.y);
    updateFeeding(state);
    expect(state.sheep[0]).toMatchObject({ activity: 'seekBreedingFood', targetId: p.id });
  });

  it('a fed adult (Fullness at seekBelowFullness) still takes breeding food while food lies on the field', () => {
    const c = mid(newGame());
    const state = gameWith([{ x: c.x, y: c.y, fullness: FED }]);
    createFoodPiece(state, c.x + 80, c.y);
    const p = createBreedingPiece(state, c.x + 50, c.y);
    updateFeeding(state);
    expect(state.sheep[0]).toMatchObject({ activity: 'seekBreedingFood', targetId: p.id });
  });

  it('a sheep on its way to breeding food switches to food once it is hungry and food is there', () => {
    const c = mid(newGame());
    const state = gameWith([{ x: c.x, y: c.y, fullness: FED }]);
    const s = state.sheep[0];
    const bp = createBreedingPiece(state, c.x + 100, c.y);
    updateFeeding(state);
    expect(s).toMatchObject({ activity: 'seekBreedingFood', targetId: bp.id });
    s.fullness = FED - 1;
    const food = createFoodPiece(state, c.x - 100, c.y);
    updateFeeding(state);
    expect(s).toMatchObject({ activity: 'seekFood', targetId: food.id });
    expect(state.breedingPieces).toEqual([bp]);
  });

  it('a sheep on its way to a carcass switches to food when a piece lands (FR14)', () => {
    const c = mid(newGame());
    const state = gameWith([{ x: c.x, y: c.y, fullness: TUNING.starvingBelow - 5 }]);
    const s = state.sheep[0];
    s.activity = 'seekCarcass';
    s.targetId = 9_999;
    const food = createFoodPiece(state, c.x - 100, c.y);
    updateFeeding(state);
    expect(s).toMatchObject({ activity: 'seekFood', targetId: food.id });
  });

  it('a Starving adult does not claim breeding food while a carcass and no food lie in the pen (FR14)', () => {
    const c = mid(newGame());
    const state = gameWith([
      { x: c.x - 20, y: c.y, fullness: TUNING.starvingBelow - 5 },
      { x: c.x + 100, y: c.y, fullness: FED },
    ]);
    const [starving, fed] = state.sheep;
    const bp = createBreedingPiece(state, c.x - 30, c.y);
    createCarcass(state, c.x - 150, c.y);
    updateFeeding(state);
    expect(starving.activity).toBe('wander');
    expect(fed).toMatchObject({ activity: 'seekBreedingFood', targetId: bp.id });
  });

  it('gives two breeding pieces to two adults, one each', () => {
    const c = mid(newGame());
    const state = gameWith([
      { x: c.x - 60, y: c.y, fullness: FED },
      { x: c.x + 60, y: c.y, fullness: FED },
    ]);
    const a = createBreedingPiece(state, c.x - 50, c.y);
    const b = createBreedingPiece(state, c.x + 50, c.y);
    updateFeeding(state);
    expect(state.sheep[0]).toMatchObject({ activity: 'seekBreedingFood', targetId: a.id });
    expect(state.sheep[1]).toMatchObject({ activity: 'seekBreedingFood', targetId: b.id });
  });

  it('reverts a stale breeding claim to wander with targetId omitted', () => {
    const c = mid(newGame());
    const state = gameWith([{ x: c.x, y: c.y, fullness: FED }]);
    const s = state.sheep[0];
    s.activity = 'seekBreedingFood';
    s.targetId = 9999;
    updateFeeding(state);
    expect(s.activity).toBe('wander');
    expect('targetId' in s).toBe(false);
  });

  it('releases the claim when the seeker turns elder on the way: the piece stays for an adult', () => {
    const c = mid(newGame());
    const state = gameWith([{ x: c.x - 100, y: c.y, fullness: FED }]);
    const s = state.sheep[0];
    const p = createBreedingPiece(state, c.x + 100, c.y);
    updateFeeding(state);
    expect(s).toMatchObject({ activity: 'seekBreedingFood', targetId: p.id });
    s.bornAt = state.time - TUNING.elderFromMs;
    // Even standing on the piece, an elder must not eat it.
    s.x = p.x;
    s.y = p.y;
    drained();
    updateFeeding(state);
    expect(s.activity).toBe('wander');
    expect('targetId' in s).toBe(false);
    expect(s.breedReady).toBe(false);
    expect(state.breedingPieces).toEqual([p]);
    expect(drained()).toEqual([]);
  });

  it('releases the claim of a seeker that is already ready (a corrupt save) without eating', () => {
    const c = mid(newGame());
    const state = gameWith([{ x: c.x, y: c.y, fullness: FED }]);
    const s = state.sheep[0];
    const p = createBreedingPiece(state, c.x, c.y);
    s.activity = 'seekBreedingFood';
    s.targetId = p.id;
    s.breedReady = true;
    updateFeeding(state);
    expect(s.activity).toBe('wander');
    expect(state.breedingPieces).toEqual([p]);
  });

  it('an adult on breeding cooldown does not claim a breeding piece, until the tick it ends (FR10)', () => {
    const c = mid(newGame());
    const state = gameWith([{ x: c.x, y: c.y, fullness: FED }]);
    const s = state.sheep[0];
    const p = createBreedingPiece(state, c.x + 40, c.y);
    s.cooldownUntil = state.time + 1;
    updateFeeding(state);
    expect(s.activity).toBe('wander');
    state.time = s.cooldownUntil;
    updateFeeding(state);
    expect(s).toMatchObject({ activity: 'seekBreedingFood', targetId: p.id });
  });

  it('releases the claim of a seeker that is on cooldown (a corrupt save) without eating', () => {
    const c = mid(newGame());
    const state = gameWith([{ x: c.x, y: c.y, fullness: FED }]);
    const s = state.sheep[0];
    const p = createBreedingPiece(state, c.x, c.y);
    s.activity = 'seekBreedingFood';
    s.targetId = p.id;
    s.cooldownUntil = state.time + TUNING.breedCooldownMs;
    updateFeeding(state);
    expect(s.activity).toBe('wander');
    expect(s.breedReady).toBe(false);
    expect(state.breedingPieces).toEqual([p]);
  });

  it('walks to a breeding piece and eats it over time, then the piece is gone', () => {
    const c = mid(newGame());
    const state = gameWith([{ x: c.x - 80, y: c.y, fullness: TUNING.fullnessMax }]);
    state.sheep[0].restUntil = 0;
    createBreedingPiece(state, c.x, c.y);
    runFor(state, 3_000);
    expect(state.sheep[0].breedReady).toBe(true);
    expect(state.breedingPieces).toEqual([]);
  });
});
