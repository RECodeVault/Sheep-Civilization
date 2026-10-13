// Pattern N1, the single death pipeline: killSheep is the only way a sheep dies. Hunger, lifecycle
// (2.1), virus (2.5) and the Abomination (4.3) all call it, so every death is counted, announced and
// leaves a carcass (FR12, since Story 2.4). removeSheep is the only other way out of state.sheep: a
// sacrifice (2.7) or a sale (3.1), with no carcass. Both end with checkLastSheepAndLoss: selling or
// sacrificing the last sheep is a loss too, and so is leaving only the Abomination (Story 4.3 review).
//
// Carcasses live here too (System Location Mapping): createCarcass, clearCarcass (FR13, the player's
// click), and updateCarcassEating (FR14): a Starving sheep walks to its nearest carcass and eats it,
// but only while no food piece is free for it (breeding pieces are not food; a piece another sheep has
// claimed is not free, so a second Starving sheep keeps its carcass). There is no exclusive
// claim: several sheep may head for one carcass, the first to reach it eats it, and the others pick
// again. Eating infects the sheep through virus.ts's infectSheep (FR15). feeding.ts ends the munch.
//
// Callers: killSheep *replaces* state.sheep with a new, shorter array. A system that kills while
// looping must loop over the array it captured before the loop (see updateHunger), never re-read
// state.sheep[i] mid-loop (it would skip the sheep after each death), and must rebuild the grid
// before any later neighbour query (grid indices point into the old array).
import { TUNING } from '../../config/tuning';
import { invariant } from '../../core/invariant';
import { emit, type DeathCause } from '../events';
import { carcassIndex, hungerOf } from '../selectors';
import { nextId, type Carcass, type GameState, type Sheep } from '../state';
import { infectSheep } from './virus';

export function killSheep(state: GameState, id: number, cause: DeathCause): void {
  const s = state.sheep.find((x) => x.id === id);
  if (s === undefined) {
    invariant(false, `killSheep: unknown sheep ${id}`);
    return;
  }
  // Allocates, which is fine: a death is a rare event, not per-tick work.
  state.sheep = state.sheep.filter((x) => x.id !== id);
  state.stats.died += 1;
  // FR12: the carcass lies where the sheep stood. Its event follows the death it came from.
  const c = TUNING.carcassesEnabled ? createCarcass(state, s.x, s.y) : undefined;
  emit({ type: 'SheepDied', id, cause, x: s.x, y: s.y });
  if (c !== undefined) emit({ type: 'CarcassSpawned', id: c.id, x: c.x, y: c.y });
  // Last, so Lost follows the SheepDied that caused it.
  checkLastSheepAndLoss(state);
}

/** Why a sheep left without dying (pattern N1). */
export type RemoveReason = 'sold' | 'sacrificed';

/**
 * Pattern N1: the only way a sheep leaves without dying (FR18 sacrifice; 3.1 sale). No carcass, and no
 * event of its own: the caller emits Sacrificed (or Sold) first, so a Lost from the loss check follows
 * it. Like killSheep it replaces state.sheep with a new, shorter array.
 */
export function removeSheep(state: GameState, id: number, reason: RemoveReason): void {
  if (!state.sheep.some((x) => x.id === id)) {
    invariant(false, `removeSheep: unknown sheep ${id}`);
    return;
  }
  // Allocates, which is fine: a removal is a rare event, not per-tick work.
  state.sheep = state.sheep.filter((x) => x.id !== id);
  if (reason === 'sacrificed') state.stats.sacrificed += 1;
  else state.stats.sold += 1;
  checkLastSheepAndLoss(state);
}

/** Adds a carcass at (x, y). No rng and no event: killSheep emits CarcassSpawned; debug spawns silently. */
export function createCarcass(state: GameState, x: number, y: number): Carcass {
  const c: Carcass = { id: nextId(state), x, y, createdAt: state.time };
  state.carcasses.push(c);
  return c;
}

/**
 * FR13: the player clicked a carcass away. An id that is not a carcass is ignored without a fuss: the
 * view is a tick behind, so a double click sends two ClearCarcass for one carcass before it is gone.
 */
export function clearCarcass(state: GameState, id: number): void {
  const i = carcassIndex(state, id);
  if (i < 0) return;
  const c = state.carcasses[i];
  // A rare event, so the splice is fine.
  state.carcasses.splice(i, 1);
  emit({ type: 'CarcassCleared', id: c.id, x: c.x, y: c.y });
}

/**
 * FR14/FR15: Starving sheep seek and eat carcasses while no food piece is free. Pass 1 releases
 * seekers that can no longer eat and eats on arrival; pass 2 sends each free Starving sheep to its
 * nearest carcass, eating it at once if it is already in reach. Plain loops: no allocation and no rng, except when a carcass is eaten (an event).
 */
/**
 * True when some food piece has no seeker. Runs right after updateFeeding, which keeps every `seekFood`
 * claim on a live piece and gives each piece at most one seeker, so counting the claims is enough. And
 * feeding has just offered every free piece to the hungry sheep (a Starving carcass seeker among them),
 * so a sheep still free here has no piece to go to: it keeps (or takes) its carcass.
 */
function hasUnclaimedFood(state: GameState): boolean {
  const n = state.foodPieces.length;
  if (n === 0) return false;
  let claims = 0;
  for (let i = 0; i < state.sheep.length; i++) {
    const s = state.sheep[i];
    if (s.activity === 'seekFood' && s.targetId !== undefined) claims++;
  }
  return claims < n;
}

export function updateCarcassEating(state: GameState): void {
  const sheep = state.sheep;
  const noFood = !hasUnclaimedFood(state);
  const reach2 = TUNING.eatReachPx * TUNING.eatReachPx;

  // Pass 1: release and eat.
  for (let i = 0; i < sheep.length; i++) {
    const s = sheep[i];
    if (s.activity !== 'seekCarcass') continue;
    const k = s.targetId === undefined ? -1 : carcassIndex(state, s.targetId);
    if (!noFood || k < 0 || hungerOf(s.fullness) !== 'starving') {
      s.activity = 'wander';
      delete s.targetId;
      continue;
    }
    const c = state.carcasses[k];
    const dx = c.x - s.x;
    const dy = c.y - s.y;
    if (dx * dx + dy * dy <= reach2) eatCarcass(state, s, k);
  }

  // Pass 2: claims.
  const list = state.carcasses;
  if (!noFood || list.length === 0) return;
  for (let i = 0; i < sheep.length; i++) {
    const s = sheep[i];
    // Hunger beats breeding: a Starving adult on its way to a breeding piece turns to the carcass. A
    // seeker whose carcass a sheep later in the array ate this tick picks again now, not a tick late.
    // Not `stalking`: the Abomination's visit is not interrupted (Story 4.3).
    const free =
      s.activity === 'wander' ||
      s.activity === 'seekBreedingFood' ||
      (s.activity === 'seekCarcass' && (s.targetId === undefined || carcassIndex(state, s.targetId) < 0));
    if (!free || hungerOf(s.fullness) !== 'starving') continue;
    // Strict `<` gives ties to the lower index: deterministic.
    let best = -1;
    let bestD = Infinity;
    for (let k = 0; k < list.length; k++) {
      const dx = list[k].x - s.x;
      const dy = list[k].y - s.y;
      const d = dx * dx + dy * dy;
      if (d < bestD) {
        bestD = d;
        best = k;
      }
    }
    // Only a non-finite position (a corrupt save) can leave every distance un-comparable.
    if (best < 0) continue;
    // Already in reach (it was standing there when the carcass appeared): eat now, not next tick.
    if (bestD <= reach2) {
      eatCarcass(state, s, best);
      continue;
    }
    s.activity = 'seekCarcass';
    s.targetId = list[best].id;
  }
}

/** Sheep `s` eats carcass `k`: it is gone, the sheep is fed and munches, and it is infected (FR15). */
function eatCarcass(state: GameState, s: Sheep, k: number): void {
  const c = state.carcasses[k];
  // A rare event, so the splice is fine.
  state.carcasses.splice(k, 1);
  s.fullness = Math.min(TUNING.fullnessMax, s.fullness + TUNING.carcassFullness);
  s.activity = 'eating';
  delete s.targetId;
  s.restUntil = state.time + TUNING.eatMs;
  emit({ type: 'CarcassEaten', sheepId: s.id, carcassId: c.id, x: c.x, y: c.y });
  infectSheep(state, s);
}

/**
 * Pattern N1: runs after every removal (killSheep and removeSheep). Loss = no sheep alive but the
 * Abomination (FR38; Rylan, Story 4.3 review: a lone Abomination can never breed or be sold, so the
 * flock is gone): records the time once and emits Lost; step() and applyCommand() then do nothing.
 * Pending lambs do not count, as before.
 */
export function checkLastSheepAndLoss(state: GameState): void {
  // Story 5.5: emit LastSheep when the flock drops to 1.
  if (state.lostAt !== undefined) return;
  const sheep = state.sheep;
  for (let i = 0; i < sheep.length; i++) if (!sheep[i].isAbomination) return;
  state.lostAt = state.time;
  emit({ type: 'Lost', survivedMs: state.lostAt, peakFlock: state.stats.peakFlock });
}
