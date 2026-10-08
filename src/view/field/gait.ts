// The walk cycle's rhythm (Story 4.2), as pure functions of the stride travelled so the view's sheep
// step in time with how far they really move. A normal walk alternates the pose frame and its step frame
// (legs apart) in even beats. The Abomination's off-step (FR32, `PublicSheep.gait === 'offstep'`, its
// designed tell) uses the same lamb frames in an uneven rhythm, a long pose beat then a short step beat
// with a small dip, so it limps. The view learns of it only through `gait` (UX-DR64).
//
// Gameplay animation, never juice (see GAIT), just as the infection wobble is.
// No Phaser import, so it is testable (tests/view/field/gait.test.ts). Allocates nothing.
import type { Gait } from '../../sim/selectors';

/**
 * [ASSUMPTION, tuned in the browser] GDD Risks #2 / Readability fallback: if playtests find the tell too
 * subtle at pixel scale, exaggerate the off-step first (a wider long/short split, a deeper dip).
 * Never reduced: the reduced-motion setting (Story 5.7) must leave every value here as it is (UX-DR84).
 */
export const GAIT = Object.freeze({
  /** Stride travelled per beat, in world px: about 6 beats a second at the 60 px/s walk. */
  stepPx: 10,
  /** A tick that moves the sheep less than this counts as standing (a full walk tick is 6 px). */
  walkMinPxPerTick: 1,
  /** The off-step's beat lengths as multiples of stepPx: long pose, short step. Their mean is 1. */
  offstepLong: 1.6,
  offstepShort: 0.4,
  /** How far the off-step drops the sprite on its short beat, in world px. */
  offstepDipPx: 2,
});

const OFFSTEP_CYCLE_PX = GAIT.stepPx * (GAIT.offstepLong + GAIT.offstepShort);
const OFFSTEP_POSE_PX = GAIT.stepPx * GAIT.offstepLong;

/** Where in its cycle a stride phase (≥ 0) falls, for the off-step. */
function offstepAt(phasePx: number): number {
  return phasePx % OFFSTEP_CYCLE_PX;
}

/** Whether the step frame (legs apart) shows at stride phase `phasePx` (≥ 0), else the pose frame. */
export function isStepBeat(gait: Gait, phasePx: number): boolean {
  if (gait === 'offstep') return offstepAt(phasePx) >= OFFSTEP_POSE_PX;
  return Math.floor(phasePx / GAIT.stepPx) % 2 === 1;
}

/** How far down the sprite is drawn at stride phase `phasePx`: the off-step's dip on its short beat, else 0. */
export function gaitDipPx(gait: Gait, phasePx: number): number {
  return gait === 'offstep' && offstepAt(phasePx) >= OFFSTEP_POSE_PX ? GAIT.offstepDipPx : 0;
}
