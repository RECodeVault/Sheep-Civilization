// Movement and flock spacing (AR5): per-tick steering from wander, separation and fence
// containment, with neighbour queries through the uniform grid. No physics engine (ADR-3). A dragged
// sheep (FR16) is excluded from steering until it is dropped: it neither moves nor pushes or is pushed.
// Separation keeps personalSpacePx (24) between ordinary sheep. Every other sheep keeps the wider
// abominationSpacePx (36) from the living Abomination (FR32, its designed tell, Story 4.2), while the
// Abomination itself feels only the normal 24: the flock gives it room; it does not shy away. That shows
// only as spacing: nothing here reaches PublicSheep or emits an event. The Abomination's visit
// (`stalking`, Story 4.3) steers here too: approach (seek the victim), linger (stand), leave (walk away).
import { TICK_MS } from '../../config/constants';
import { TUNING } from '../../config/tuning';
import { invariant } from '../../core/invariant';
import { assertNever } from '../../core/types';
import { wrapAngle } from '../angle';
import { queryNeighbours, rebuildGrid } from '../grid';
import { rng, rngRange } from '../rng';
import { breedingPieceIndex, carcassIndex, fenceBounds, pieceIndex, sheepIndex } from '../selectors';
import type { GameState } from '../state';
import { abominationIndex } from './abomination';

const DT = TICK_MS / 1000;

// Module-scope scratch, grown on demand, so a tick allocates nothing.
let vx = new Float64Array(128);
let vy = new Float64Array(128);
const neighbours: number[] = [];

/** The piece or carcass a seeker walks to, or undefined if it is gone. No allocation. */
function seekTarget(
  state: GameState,
  activity: 'seekFood' | 'seekBreedingFood' | 'seekCarcass',
  id: number | undefined,
): { x: number; y: number } | undefined {
  if (id === undefined) return undefined;
  switch (activity) {
    case 'seekFood': {
      const k = pieceIndex(state, id);
      return k < 0 ? undefined : state.foodPieces[k];
    }
    case 'seekBreedingFood': {
      const k = breedingPieceIndex(state, id);
      return k < 0 ? undefined : state.breedingPieces[k];
    }
    case 'seekCarcass': {
      const k = carcassIndex(state, id);
      return k < 0 ? undefined : state.carcasses[k];
    }
    default:
      return assertNever(activity);
  }
}

/**
 * Two passes, so no sheep sees a neighbour that already moved this tick: every velocity is computed
 * from the start-of-tick positions first, then every sheep moves and is clamped inside the fence.
 * Rng draws still happen in array order, so the run is deterministic for a given `state.sheep`.
 */
export function updateMovement(state: GameState): void {
  const sheep = state.sheep;
  const n = sheep.length;
  if (n > vx.length) {
    let size = vx.length;
    while (size < n) size *= 2;
    vx = new Float64Array(size);
    vy = new Float64Array(size);
  }

  const f = fenceBounds(state);
  const left = f.x + TUNING.fenceInset;
  const right = f.x + f.width - TUNING.fenceInset;
  const top = f.y + TUNING.fenceInset;
  const bottom = f.y + f.height - TUNING.fenceInset;
  const margin = TUNING.fenceTurnMarginPx;
  const walk = TUNING.walkSpeedPxPerS;
  const space = TUNING.personalSpacePx;
  const sepScale = TUNING.separationWeight * walk;
  const abomSpace = TUNING.abominationSpacePx;
  // The living Abomination's index, or -1. A dragged one is in the air and pushes nobody, as any
  // dragged sheep. With -1 the separation below is exactly the ordinary path (AC 5).
  let abom = abominationIndex(state);
  if (abom >= 0 && sheep[abom].activity === 'dragged') abom = -1;

  rebuildGrid(sheep);

  // Pass 1: velocities.
  for (let i = 0; i < n; i++) {
    const s = sheep[i];
    let wx = 0;
    let wy = 0;
    let walking = false;

    switch (s.activity) {
      case 'wander':
        if (state.time >= s.restUntil) {
          if (rng(state) < TUNING.wanderRestChance) {
            s.restUntil = state.time + rngRange(state, TUNING.wanderRestMinMs, TUNING.wanderRestMaxMs);
          } else {
            walking = true;
            let h = s.heading + rngRange(state, -TUNING.wanderTurnRad, TUNING.wanderTurnRad);
            // Soft containment: near an inner edge and heading out, mirror the heading back toward
            // the pen, so sheep turn around instead of sliding along the rail.
            if ((s.x < left + margin && Math.cos(h) < 0) || (s.x > right - margin && Math.cos(h) > 0)) h = Math.PI - h;
            if ((s.y < top + margin && Math.sin(h) < 0) || (s.y > bottom - margin && Math.sin(h) > 0)) h = -h;
            s.heading = wrapAngle(h);
            wx = Math.cos(s.heading) * walk;
            wy = Math.sin(s.heading) * walk;
          }
        }
        break;
      case 'seekFood':
      case 'seekBreedingFood':
      case 'seekCarcass': {
        // Straight at the target (a food or breeding piece, or a carcass), slowing onto it so a 6 px
        // step never overshoots or orbits. A missing target means no walk this tick; feeding (pieces)
        // or carcass.ts (carcasses) releases it next tick. `walking` stays false, so the crowd-turn
        // below never rewrites the seek heading.
        const p = seekTarget(state, s.activity, s.targetId);
        if (p === undefined) break;
        const dx = p.x - s.x;
        const dy = p.y - s.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d === 0) break;
        const v = Math.min(walk, d / DT);
        wx = (dx / d) * v;
        wy = (dy / d) * v;
        s.heading = wrapAngle(Math.atan2(dy, dx));
        break;
      }
      case 'eating':
        // Munching in place; separation below still nudges it like a grazer.
        break;
      case 'stalking': {
        // The Abomination's visit (FR31, abomination.ts owns the phases). Approach: straight at the
        // victim, as a seeker walks to food (a victim that is gone or lifted: no walk; the visit system
        // picks another after movement). Linger: stands. Leave: walks along the heading set away from
        // the victim, turning back from the rails as a wanderer does, but without the random turn.
        const st = s.stalk;
        if (st === undefined) {
          invariant(false, 'updateMovement: stalking without a stalk');
          break;
        }
        if (st.phase === 'approach') {
          const k = sheepIndex(state, st.victimId);
          if (k < 0 || sheep[k].activity === 'dragged') break;
          const dx = sheep[k].x - s.x;
          const dy = sheep[k].y - s.y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d === 0) break;
          const v = Math.min(walk, d / DT);
          wx = (dx / d) * v;
          wy = (dy / d) * v;
          s.heading = wrapAngle(Math.atan2(dy, dx));
        } else if (st.phase === 'leave') {
          walking = true;
          let h = s.heading;
          if ((s.x < left + margin && Math.cos(h) < 0) || (s.x > right - margin && Math.cos(h) > 0)) h = Math.PI - h;
          if ((s.y < top + margin && Math.sin(h) < 0) || (s.y > bottom - margin && Math.sin(h) > 0)) h = -h;
          s.heading = wrapAngle(h);
          wx = Math.cos(s.heading) * walk;
          wy = Math.sin(s.heading) * walk;
        }
        break;
      }
      case 'dragged':
        // In the air (FR16): no walk and no separation push; pass 2 leaves it where it was picked up.
        vx[i] = 0;
        vy[i] = 0;
        continue;
      default:
        assertNever(s.activity);
    }

    // Separation: linear falloff from full push at contact to none at the personal-space radius.
    let sx = 0;
    let sy = 0;
    // Everyone but the Abomination takes its push separately below, over the wider radius.
    const skip = i === abom ? -1 : abom;
    const count = queryNeighbours(sheep, i, space, neighbours);
    for (let k = 0; k < count; k++) {
      if (neighbours[k] === skip) continue;
      const o = sheep[neighbours[k]];
      // A dragged sheep is in the air: it pushes nobody (the grid still holds it, so skip on read).
      if (o.activity === 'dragged') continue;
      const dx = s.x - o.x;
      const dy = s.y - o.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d === 0) {
        // Exactly coincident: split along x by id, deterministically and without rng.
        sx += s.id > o.id ? 1 : -1;
      } else {
        const w = 1 - d / space;
        sx += (dx / d) * w;
        sy += (dy / d) * w;
      }
    }
    // FR32: the Abomination's push, same falloff over abominationSpacePx. One sheep, so one direct
    // distance check per sheep (O(n)), and no wider grid query.
    if (skip >= 0) {
      const o = sheep[skip];
      const dx = s.x - o.x;
      const dy = s.y - o.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < abomSpace * abomSpace) {
        const d = Math.sqrt(d2);
        if (d === 0) {
          sx += s.id > o.id ? 1 : -1;
        } else {
          const w = 1 - d / abomSpace;
          sx += (dx / d) * w;
          sy += (dy / d) * w;
        }
      }
    }

    let ux = wx + sx * sepScale;
    let uy = wy + sy * sepScale;
    const speed = Math.sqrt(ux * ux + uy * uy);
    if (speed > walk) {
      ux *= walk / speed;
      uy *= walk / speed;
    }
    // A crowded walker turns with the push, so it does not walk straight back in next tick.
    if (walking && (sx !== 0 || sy !== 0) && speed > 0) s.heading = wrapAngle(Math.atan2(uy, ux));
    vx[i] = ux;
    vy[i] = uy;
  }

  // Pass 2: integrate, then the hard clamp that keeps every sheep inside the fence. A clamped axis
  // flips the heading only if it points outward, so a sheep pushed into the rail by a neighbour
  // keeps facing the pen.
  for (let i = 0; i < n; i++) {
    const s = sheep[i];
    // Not integrated or clamped: it keeps its pickup spot until it is dropped (drag.ts).
    if (s.activity === 'dragged') continue;
    let x = s.x + vx[i] * DT;
    let y = s.y + vy[i] * DT;
    if (x < left || x > right) {
      const out = x < left ? Math.cos(s.heading) < 0 : Math.cos(s.heading) > 0;
      x = x < left ? left : right;
      if (out) s.heading = wrapAngle(Math.PI - s.heading);
    }
    if (y < top || y > bottom) {
      const out = y < top ? Math.sin(s.heading) < 0 : Math.sin(s.heading) > 0;
      y = y < top ? top : bottom;
      if (out) s.heading = wrapAngle(-s.heading);
    }
    s.x = x;
    s.y = y;
  }
}
