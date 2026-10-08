// Feeding (FR5, FR8a): food pieces (dropped by full Farm bars, FR3) and breeding pieces (dropped by
// full breeding bars, FR8) in the pen, who walks to which piece, and eating.
// Feeding owns the `seekFood`, `seekBreedingFood` and `eating` activities; movement only reads them.
//
// Claim model: a seeker keeps its `targetId` until it eats the piece or the piece is gone, so sheep
// never jitter between pieces. Each piece has at most one seeker and each sheep at most one piece.
// Food comes first: food claims run before breeding claims and may take a hungry sheep off its way to
// a breeding piece or a carcass (carcass.ts, FR14), and a hungry sheep does not start for breeding food
// while food lies in the pen.
import { TUNING } from '../../config/tuning';
import { emit } from '../events';
import { breedingPieceIndex, hungerOf, innerFence, onCooldown, pieceIndex, stageOf } from '../selectors';
import { nextId, type BreedingPiece, type FoodPiece, type GameState, type Sheep } from '../state';

/** A piece in one of the two piece arrays; both have the same shape. */
type Piece = FoodPiece | BreedingPiece;
type Eligible = (s: Sheep, state: GameState) => boolean;

// Module-scope scratch, grown on demand, so a tick allocates nothing: claimed[i] marks piece i.
let claimed = new Uint8Array(64);

/** Creates a food piece, clamped to where a sheep centre can reach it (a full Farm bar, FR3; debug). */
export function createFoodPiece(state: GameState, x: number, y: number): FoodPiece {
  const p = clampedPiece(state, x, y);
  state.foodPieces.push(p);
  return p;
}

/** Creates a breeding piece, clamped like a food piece (a full breeding bar, FR8; debug). */
export function createBreedingPiece(state: GameState, x: number, y: number): BreedingPiece {
  const p = clampedPiece(state, x, y);
  state.breedingPieces.push(p);
  return p;
}

function clampedPiece(state: GameState, x: number, y: number): Piece {
  // Sheep centres never come within fenceInset of a rail, so a piece there could never be eaten.
  const r = innerFence(state);
  return {
    id: nextId(state),
    x: Math.min(r.right, Math.max(r.left, x)),
    y: Math.min(r.bottom, Math.max(r.top, y)),
  };
}

export function updateFeeding(state: GameState): void {
  const sheep = state.sheep;
  const reach2 = TUNING.eatReachPx * TUNING.eatReachPx;

  // Passes 1 and 2: release stale claims, finish munching, and eat on arrival.
  for (let i = 0; i < sheep.length; i++) {
    const s = sheep[i];
    if (s.activity === 'eating') {
      if (state.time >= s.restUntil) s.activity = 'wander';
      continue;
    }
    const food = s.activity === 'seekFood';
    if (!food && s.activity !== 'seekBreedingFood') continue;
    const k = s.targetId === undefined ? -1 : food ? pieceIndex(state, s.targetId) : breedingPieceIndex(state, s.targetId);
    // A breeding claim is released once the sheep can no longer use the piece (it turned elder on the
    // way, or is already ready or on cooldown), so the piece stays for an adult that can.
    if (k < 0 || (!food && !canUseBreedingFood(s, state))) {
      s.activity = 'wander';
      delete s.targetId;
      continue;
    }
    const pieces = food ? state.foodPieces : state.breedingPieces;
    const p = pieces[k];
    const dx = p.x - s.x;
    const dy = p.y - s.y;
    if (dx * dx + dy * dy > reach2) continue;
    // Removal is an event, not per-tick work.
    pieces.splice(k, 1);
    if (food) {
      s.fullness = Math.min(TUNING.fullnessMax, s.fullness + TUNING.foodPieceFullness);
      emit({ type: 'FoodEaten', sheepId: s.id, pieceId: p.id, x: p.x, y: p.y });
    } else {
      // FR8a: ready to breed; breeding food gives no Fullness.
      s.breedReady = true;
      emit({ type: 'BreedingFoodEaten', sheepId: s.id, pieceId: p.id, x: p.x, y: p.y });
    }
    s.activity = 'eating';
    delete s.targetId;
    s.restUntil = state.time + TUNING.eatMs;
  }

  // Pass 3: food claims. Pass 4: breeding claims, after food, from the sheep still free.
  claimPieces(state, state.foodPieces, true, mayEatFood);
  claimPieces(state, state.breedingPieces, false, mayEatBreedingFood);
}

/**
 * FR5: the oldest unclaimed piece picks its nearest eligible sheep, which then takes its own nearest
 * unclaimed piece (often the same one). Strict `<` gives ties to the lower index: deterministic.
 */
function claimPieces(state: GameState, pieces: readonly Piece[], food: boolean, eligibleFn: Eligible): void {
  const sheep = state.sheep;
  const n = pieces.length;
  if (n === 0) return;
  let eligible = 0;
  for (let i = 0; i < sheep.length; i++) if (eligibleFn(sheep[i], state)) eligible++;
  if (eligible === 0) return;

  if (n > claimed.length) {
    let size = claimed.length;
    while (size < n) size *= 2;
    claimed = new Uint8Array(size);
  }
  claimed.fill(0, 0, n);
  const seeking = food ? 'seekFood' : 'seekBreedingFood';
  let unclaimed = n;
  for (let i = 0; i < sheep.length; i++) {
    const s = sheep[i];
    if (s.activity !== seeking || s.targetId === undefined) continue;
    const k = food ? pieceIndex(state, s.targetId) : breedingPieceIndex(state, s.targetId);
    if (k >= 0 && claimed[k] === 0) {
      claimed[k] = 1;
      unclaimed--;
    }
  }

  let oldest = 0;
  while (eligible > 0 && unclaimed > 0) {
    while (claimed[oldest] === 1) oldest++;
    const p = pieces[oldest];
    let best = -1;
    let bestD = Infinity;
    for (let i = 0; i < sheep.length; i++) {
      const s = sheep[i];
      if (!eligibleFn(s, state)) continue;
      const d = dist2(s.x, s.y, p.x, p.y);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    // Only a non-finite position (a corrupt save) can leave every distance un-comparable.
    if (best < 0) break;
    const s = sheep[best];
    let pick = -1;
    let pickD = Infinity;
    for (let k = 0; k < n; k++) {
      if (claimed[k] === 1) continue;
      const d = dist2(s.x, s.y, pieces[k].x, pieces[k].y);
      if (d < pickD) {
        pickD = d;
        pick = k;
      }
    }
    claimed[pick] = 1;
    unclaimed--;
    eligible--;
    // A sheep on its way to a breeding piece or a carcass drops it for food: its old target is simply
    // replaced.
    s.activity = seeking;
    s.targetId = pieces[pick].id;
  }
}

/**
 * FR5/FR14: a free (or breeding-food- or carcass-bound) sheep below seekBelowFullness may claim food.
 * Not `stalking`: the Abomination's visit is not interrupted for food (it eats once it wanders again).
 */
function mayEatFood(s: Sheep): boolean {
  return (
    (s.activity === 'wander' || s.activity === 'seekBreedingFood' || s.activity === 'seekCarcass') &&
    s.fullness < TUNING.seekBelowFullness
  );
}

/**
 * FR8a: a free adult that is not ready and not on breeding cooldown may claim breeding food, unless
 * it is hungry while food lies in the pen (food first) or Starving while a carcass and no food lie
 * there (FR14). The Abomination is never an adult (stageOf keeps it a lamb, FR30), so it never eats one.
 * Only `wander`, so never a `stalking` sheep either (Story 4.3).
 */
function mayEatBreedingFood(s: Sheep, state: GameState): boolean {
  return (
    s.activity === 'wander' &&
    canUseBreedingFood(s, state) &&
    !(s.fullness < TUNING.seekBelowFullness && state.foodPieces.length > 0) &&
    // FR14: a Starving sheep goes for a carcass when there is no food (carcass.ts runs next and would
    // take it off this piece, wasting the claim for a tick).
    !(state.foodPieces.length === 0 && state.carcasses.length > 0 && hungerOf(s.fullness) === 'starving')
  );
}

/** FR8a/FR10: only an adult that is not ready yet and off cooldown gets anything from a breeding piece. */
function canUseBreedingFood(s: Sheep, state: GameState): boolean {
  return !s.breedReady && stageOf(s, state) === 'adult' && !onCooldown(s, state);
}

function dist2(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}
