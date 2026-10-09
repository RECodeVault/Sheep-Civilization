import { TUNING, type Rect } from '../../src/config/tuning';
import { applyCommand } from '../../src/sim/commands';
import { drainEvents } from '../../src/sim/events';
import { createSheep, type GameState } from '../../src/sim/state';
import { makeAbomination } from '../../src/sim/systems/abomination';
import { createCarcass } from '../../src/sim/systems/carcass';
import { infectSheep } from '../../src/sim/systems/virus';
import { fillFlock, innerFence, newGame, runFor } from '../sim/helpers';

/**
 * A mid-game state with every saved field in use: a 12-sheep flock, pieces on the ground with
 * seekers walking to them, a half-filled Farm bar, breeding pieces with seekers and a part-filled
 * breeding bar, a ready sheep, a pregnancy with its parents on cooldown, a carcass, an infected
 * sheep, an active sacrifice boost, money from sales, three shop purchases (Land I and both decorations),
 * a living Abomination with births counted (Story 4.1) on a visit beside a doomed victim (Story 4.3), and
 * an advanced rng and two doses of medicine (Story 4.5). Callers assert it is busy.
 */
// Seed 31339 since Story 4.1: the new-game Abomination roll shifted the rng, and with 31337 every food
// piece was eaten inside the 1 s run (no seekFood left). Any seed for which isBusy holds will do.
export function busyGame(seed = 31339): GameState {
  const state = newGame(seed);
  // Shop purchases (Stories 3.2, 3.3), made before the flock is placed, so fillFlock spreads it over the
  // Land I pen and the round-trip covers positions outside the start fence. Set directly: a Buy needs
  // money, which is set below.
  state.owned = ['land1', 'flowerPatch', 'scarecrow'];
  state.medicine = 2;
  fillFlock(state, 12);
  for (let i = 0; i < TUNING.farmPipsPerFood * 3 + 3; i++) applyCommand(state, { type: 'Farm' });
  for (let i = 0; i < TUNING.breedingPipsPerFood * 2 + 3; i++) applyCommand(state, { type: 'FarmBreeding' });
  // A ready sheep (it would have eaten a breeding piece), and two fed adults that will claim the
  // breeding pieces (hungry sheep go for food first).
  state.sheep[0].breedReady = true;
  state.sheep[1].fullness = TUNING.fullnessMax;
  state.sheep[2].fullness = TUNING.fullnessMax;
  // A pregnancy (Story 2.3): two more adults bred, so they are on cooldown and their lamb is on the way.
  // Set directly: a Breed command needs two ready sheep, and readiness is set above for other reasons.
  const [a, b] = [state.sheep[3], state.sheep[4]];
  const r = innerFence(state);
  a.cooldownUntil = b.cooldownUntil = state.time + TUNING.breedCooldownMs;
  state.pregnancies.push({
    id: state.nextId++,
    parentA: a.id,
    parentB: b.id,
    dueAt: state.time + TUNING.gestationMs,
    // Clamped as breed() does: validation requires the inner fence.
    x: Math.min(r.right, Math.max(r.left, (a.x + b.x) / 2)),
    y: Math.min(r.bottom, Math.max(r.top, (a.y + b.y) / 2)),
  });
  // A carcass (Story 2.4), inside the fence like the sheep that left it.
  createCarcass(state, (r.left + r.right) / 2, (r.top + r.bottom) / 2);
  // An infected sheep (Story 2.5); the 1 s run below is far short of its virus death.
  infectSheep(state, state.sheep[5]);
  // An active food boost (Story 2.8). Set directly: a Sacrifice would change the flock above.
  state.boostUntil = state.time + TUNING.boostMs;
  // Money from three sales (Story 3.1). Set directly: a Sell would change the flock above.
  const earned = TUNING.sellPriceAdult * 2 + TUNING.sellPriceElder;
  state.money = earned;
  state.stats.moneyEarned += earned;
  state.stats.sold += 3;
  // The Abomination (Story 4.1): a lamb born at its guaranteed birth. Set directly: births need
  // pregnancies to come due. Made after createSheep, as onBirth makes it.
  const abom = createSheep(state, { x: (r.left + r.right) / 2, y: r.top, bornAt: state.time });
  makeAbomination(state, abom);
  state.abomination.birthsSeen = state.abomination.guaranteedAtBirth;
  // Its visit (Story 4.3): due now, so it is stalking inside the 1 s run, and an earlier victim still
  // doomed after it. Set directly: a full visit takes longer than the run.
  state.abomination.nextKillAt = state.time;
  state.sheep[6].doomedAt = state.time + TUNING.abominationDoomMaxMs;
  drainEvents(() => {});
  runFor(state, 1_000);
  return state;
}

function insideFence(f: Rect, x: number, y: number): boolean {
  return x >= f.x && x <= f.x + f.width && y >= f.y && y <= f.y + f.height;
}

/**
 * True when the state exercises both kinds of seeker, targets, pieces, both part-filled bars, a ready
 * sheep, a sheep on cooldown, a pregnancy, a carcass, an infected sheep, an active boost, money, shop purchases, doses of medicine and a sheep
 * outside the start fence (the grown Land I pen, Story 3.3), and the Abomination on a visit beside a
 * doomed sheep (Story 4.3).
 */
export function isBusy(state: GameState): boolean {
  return (
    state.sheep.some((s) => s.activity === 'seekFood' && s.targetId !== undefined) &&
    state.foodPieces.length > 0 &&
    state.farmProgress > 0 &&
    state.breedingProgress > 0 &&
    state.breedingPieces.length > 0 &&
    state.sheep.some((s) => s.activity === 'seekBreedingFood' && s.targetId !== undefined) &&
    state.sheep.some((s) => s.breedReady) &&
    state.sheep.some((s) => state.time < s.cooldownUntil) &&
    state.pregnancies.length > 0 &&
    state.carcasses.length > 0 &&
    state.sheep.some((s) => s.infectedAt !== undefined) &&
    state.time < state.boostUntil &&
    state.money > 0 &&
    state.owned.length > 0 &&
    state.medicine > 0 &&
    state.sheep.some((s) => !insideFence(TUNING.landFences[0], s.x, s.y)) &&
    state.sheep.some((s) => s.isAbomination) &&
    state.abomination.birthsSeen > 0 &&
    state.sheep.some((s) => s.activity === 'stalking' && s.stalk !== undefined) &&
    state.sheep.some((s) => s.doomedAt !== undefined)
  );
}
