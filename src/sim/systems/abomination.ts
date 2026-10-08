// The Abomination (FR29–FR33, pattern N2): a lamb that is secretly a monster. Story 4.1 decides which
// lamb it is: the birth rolled at new game (state.abomination.guaranteedAtBirth, 8th–15th) is
// guaranteed, and every birth after it has abominationBirthChance, with at most one alive. Its
// identity lives in `Sheep.isAbomination`, read only by the sim, debug and save code; the view sees
// PublicSheep, where it is a lamb (stageOf keeps it one for ever) whose only difference is `gait`.
// Story 4.2's other tell, the wider space the flock keeps from it, is applied in movement.ts.
//
// The kill cycle (FR31, Story 4.3), run by updateAbomination after the virus each tick. At nextKillAt a
// free (wandering) Abomination picks a random victim and stalks it: `approach` (movement.ts walks it at
// the victim), contact within abominationContactPx, `linger` for abominationLingerMs (standing), then the
// victim is doomed (`doomedAt`, 5–10 s on) and the Abomination walks away (`leave`) while the next visit
// is scheduled. A busy Abomination (eating, seeking, dragged) makes the visit wait. A victim lost or
// lifted before contact is replaced (the approach keeps its deadline); one lifted at the end of the
// linger is spared. The doomed victim
// dies here too, through killSheep(…, 'abomination'), whatever the Abomination does in between.
// Nothing here emits an event: the visit itself is the only tell (UX-DR64), and the death surfaces like
// any other. The victim is found by sheepIndex: O(n), once per tick, for one sheep.
import { TUNING } from '../../config/tuning';
import { invariant } from '../../core/invariant';
import { wrapAngle } from '../angle';
import { rng, rngInt } from '../rng';
import { sheepIndex } from '../selectors';
import type { GameState, Sheep } from '../state';
import { killSheep } from './carcass';

/**
 * The living Abomination's index in `state.sheep`, or -1. At most one is alive (FR29), so the first
 * found is it. A plain loop: no allocation. Derived, never stored (indices shift on every death).
 */
export function abominationIndex(state: GameState): number {
  const sheep = state.sheep;
  for (let i = 0; i < sheep.length; i++) if (sheep[i].isAbomination) return i;
  return -1;
}

/** True while an Abomination is alive. Derived, never stored. */
export function abominationAlive(state: GameState): boolean {
  return abominationIndex(state) >= 0;
}

/**
 * FR29: called by lifecycle.ts for each lamb born from a pregnancy, right after it is created (a shared
 * helper owned by this concept, like killSheep). Counts the birth, then makes `lamb` the Abomination
 * when none is alive and this is the guaranteed birth, or a later birth that wins the chance roll. No
 * rng is drawn before the guaranteed birth or while one is alive. Emits nothing: LambBorn looks the
 * same for the Abomination, so the view never learns of the spawn.
 */
export function onBirth(state: GameState, lamb: Sheep): void {
  const a = state.abomination;
  a.birthsSeen++;
  if (abominationAlive(state)) return;
  if (a.birthsSeen === a.guaranteedAtBirth) {
    makeAbomination(state, lamb);
  } else if (a.birthsSeen > a.guaranteedAtBirth && rng(state) < TUNING.abominationBirthChance) {
    makeAbomination(state, lamb);
  }
}

/**
 * Makes `s` the Abomination and schedules its first visit (FR31): the one spawn path, for births
 * (onBirth) and the DEV tools alike. The caller makes sure none is alive already (at most one, FR29).
 */
export function makeAbomination(state: GameState, s: Sheep): void {
  s.isAbomination = true;
  state.abomination.nextKillAt = state.time + rngInt(state, TUNING.abominationKillMinMs, TUNING.abominationKillMaxMs);
}

/** FR31: doomed deaths, then the living Abomination's visit. Plain loops: no allocation per tick. */
export function updateAbomination(state: GameState): void {
  // killSheep replaces state.sheep, so iterate the array as it is now. Deaths happen in array order.
  const sheep = state.sheep;
  for (let i = 0; i < sheep.length; i++) {
    const s = sheep[i];
    if (s.doomedAt !== undefined && state.time >= s.doomedAt) {
      killSheep(state, s.id, 'abomination');
      if (state.lostAt !== undefined) return;
    }
  }

  // On the array after the deaths.
  const i = abominationIndex(state);
  if (i < 0) return;
  const s = state.sheep[i];
  if (s.activity === 'stalking') {
    advanceStalk(state, s, i);
  } else if (s.activity === 'wander' && state.time >= state.abomination.nextKillAt) {
    // Anything else (seeking, eating, dragged) makes the visit wait: hunger always gets its turn.
    startApproach(state, s, i);
  }
}

/**
 * Starts (or restarts) the approach on a random victim, or idles when there is none: the stalk ends and
 * nextKillAt stays due, so the visit starts as soon as there is a victim.
 */
function startApproach(state: GameState, s: Sheep, abom: number): void {
  const v = pickVictim(state, abom);
  if (v < 0) {
    endStalk(s);
    return;
  }
  // A re-pick keeps the approach's deadline (Rylan, Story 4.3 review): one approach lasts at most
  // abominationApproachMaxMs however often its victim is lost, so lifting targets cannot keep it
  // stalking (and away from food) for ever.
  const until = s.stalk?.phase === 'approach' ? s.stalk.until : state.time + TUNING.abominationApproachMaxMs;
  const victimId = state.sheep[v].id;
  if (s.stalk === undefined) {
    // A rare event (once per visit), so the object is fine.
    s.stalk = { victimId, phase: 'approach', until };
  } else {
    s.stalk.victimId = victimId;
    s.stalk.phase = 'approach';
    s.stalk.until = until;
  }
  s.activity = 'stalking';
  delete s.targetId;
}

function advanceStalk(state: GameState, s: Sheep, abom: number): void {
  const st = s.stalk;
  if (st === undefined) {
    // Only a corrupt state: validation rejects stalking without a stalk.
    invariant(false, 'updateAbomination: stalking without a stalk');
    s.activity = 'wander';
    return;
  }
  const v = sheepIndex(state, st.victimId);
  switch (st.phase) {
    case 'approach': {
      const lost = v < 0 || state.sheep[v].activity === 'dragged';
      if (!lost) {
        const o = state.sheep[v];
        const dx = o.x - s.x;
        const dy = o.y - s.y;
        if (dx * dx + dy * dy <= TUNING.abominationContactPx * TUNING.abominationContactPx) {
          st.phase = 'linger';
          st.until = state.time + TUNING.abominationLingerMs;
          return;
        }
      }
      if (state.time >= st.until) {
        // AC 7: the hunt is given up, with no doom, and the next visit is scheduled. Checked before a
        // re-pick, so losing victims cannot keep an approach going past its deadline.
        endStalk(s);
        scheduleNext(state);
      } else if (lost) {
        // AC 6: a victim gone (died, sold, sacrificed) or lifted before contact is replaced now.
        startApproach(state, s, abom);
      }
      return;
    }
    case 'linger': {
      if (state.time < st.until) return;
      // A victim lost during the linger, or held in the air when it ends (Rylan, Story 4.3 review), gets
      // no doom; the visit still ends as usual. It walks away from where the victim is in the sim, or,
      // with no victim, turns around so it does not walk on through the spot.
      if (v >= 0) {
        const o = state.sheep[v];
        if (o.activity !== 'dragged') {
          o.doomedAt = state.time + rngInt(state, TUNING.abominationDoomMinMs, TUNING.abominationDoomMaxMs);
        }
        s.heading = wrapAngle(Math.atan2(s.y - o.y, s.x - o.x));
      } else {
        s.heading = wrapAngle(s.heading + Math.PI);
      }
      st.phase = 'leave';
      st.until = state.time + TUNING.abominationLeaveMs;
      scheduleNext(state);
      return;
    }
    case 'leave':
      if (state.time >= st.until) endStalk(s);
      return;
    default:
      invariant(false, 'updateAbomination: unknown stalk phase');
      endStalk(s);
  }
}

function scheduleNext(state: GameState): void {
  state.abomination.nextKillAt = state.time + rngInt(state, TUNING.abominationKillMinMs, TUNING.abominationKillMaxMs);
}

function endStalk(s: Sheep): void {
  delete s.stalk;
  s.activity = 'wander';
}

/** A victim may be any living sheep but the Abomination, one in the air (dragged) or one already doomed. */
function isCandidate(o: Sheep, k: number, abom: number): boolean {
  return k !== abom && o.activity !== 'dragged' && o.doomedAt === undefined;
}

/**
 * FR31: a random victim's index in state.sheep, or -1 when there is none (no rng is drawn then). One draw
 * over the candidates in array order; two counting passes, no filtered array.
 */
export function pickVictim(state: GameState, abom: number): number {
  const sheep = state.sheep;
  let count = 0;
  for (let k = 0; k < sheep.length; k++) if (isCandidate(sheep[k], k, abom)) count++;
  if (count === 0) return -1;
  let n = rngInt(state, 0, count - 1);
  for (let k = 0; k < sheep.length; k++) {
    if (!isCandidate(sheep[k], k, abom)) continue;
    if (n === 0) return k;
    n--;
  }
  return -1;
}
