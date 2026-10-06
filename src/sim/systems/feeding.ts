// Farming & feeding (FR4, FR5): food pieces on the field, who walks to which piece, and eating.
// Feeding owns the `seekFood` and `eating` activities; movement only reads them.
//
// Claim model: a seeker keeps its `targetId` until it eats the piece or the piece is gone, so sheep
// never jitter between pieces. Each piece has at most one seeker and each sheep at most one piece.
import { TUNING } from '../../config/tuning';
import { emit } from '../events';
import { innerFence, pieceIndex } from '../selectors';
import { nextId, type FoodPiece, type GameState, type SheepActivity } from '../state';

// Module-scope scratch, grown on demand, so a tick allocates nothing: claimed[i] marks piece i.
let claimed = new Uint8Array(64);

/** Creates a food piece, clamped to where a sheep centre can reach it (FR4, Farm overflow). */
export function createFoodPiece(state: GameState, x: number, y: number): FoodPiece {
  // Sheep centres never come within fenceInset of a rail, so a piece there could never be eaten.
  const r = innerFence(state);
  const p: FoodPiece = {
    id: nextId(state),
    x: Math.min(r.right, Math.max(r.left, x)),
    y: Math.min(r.bottom, Math.max(r.top, y)),
  };
  state.foodPieces.push(p);
  return p;
}

export function updateFeeding(state: GameState): void {
  const sheep = state.sheep;
  const pieces = state.foodPieces;
  const reach2 = TUNING.eatReachPx * TUNING.eatReachPx;

  // Passes 1 and 2: release stale claims, finish munching, and eat on arrival.
  for (let i = 0; i < sheep.length; i++) {
    const s = sheep[i];
    if (s.activity === 'eating') {
      if (state.time >= s.restUntil) s.activity = 'wander';
      continue;
    }
    if (s.activity !== 'seekFood') continue;
    const k = s.targetId === undefined ? -1 : pieceIndex(state, s.targetId);
    if (k < 0) {
      s.activity = 'wander';
      delete s.targetId;
      continue;
    }
    const p = pieces[k];
    const dx = p.x - s.x;
    const dy = p.y - s.y;
    if (dx * dx + dy * dy > reach2) continue;
    s.fullness = Math.min(TUNING.fullnessMax, s.fullness + TUNING.foodPieceFullness);
    // Removal is an event, not per-tick work.
    pieces.splice(k, 1);
    emit({ type: 'FoodEaten', sheepId: s.id, pieceId: p.id, x: p.x, y: p.y });
    s.activity = 'eating';
    delete s.targetId;
    s.restUntil = state.time + TUNING.eatMs;
  }

  // Pass 3: claims. Nothing to do without pieces or without a sheep that may seek.
  let eligible = 0;
  for (let i = 0; i < sheep.length; i++) if (isEligible(sheep[i].activity, sheep[i].fullness)) eligible++;
  const n = pieces.length;
  if (eligible === 0 || n === 0) return;

  if (n > claimed.length) {
    let size = claimed.length;
    while (size < n) size *= 2;
    claimed = new Uint8Array(size);
  }
  claimed.fill(0, 0, n);
  let unclaimed = n;
  for (let i = 0; i < sheep.length; i++) {
    const s = sheep[i];
    if (s.activity !== 'seekFood' || s.targetId === undefined) continue;
    const k = pieceIndex(state, s.targetId);
    if (k >= 0 && claimed[k] === 0) {
      claimed[k] = 1;
      unclaimed--;
    }
  }

  // FR5: the oldest unclaimed piece picks its nearest eligible sheep, which then takes its own nearest
  // unclaimed piece (often the same one). Strict `<` gives ties to the lower index: deterministic.
  let oldest = 0;
  while (eligible > 0 && unclaimed > 0) {
    while (claimed[oldest] === 1) oldest++;
    const p = pieces[oldest];
    let best = -1;
    let bestD = Infinity;
    for (let i = 0; i < sheep.length; i++) {
      const s = sheep[i];
      if (!isEligible(s.activity, s.fullness)) continue;
      const d = dist2(s.x, s.y, p.x, p.y);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
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
    s.activity = 'seekFood';
    s.targetId = pieces[pick].id;
  }
}

function isEligible(activity: SheepActivity, fullness: number): boolean {
  return activity === 'wander' && fullness < TUNING.seekBelowFullness;
}

function dist2(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}
