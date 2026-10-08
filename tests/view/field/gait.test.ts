import { describe, expect, it } from 'vitest';
import { GAIT, gaitDipPx, isStepBeat } from '../../../src/view/field/gait';
import type { Gait } from '../../../src/sim/selectors';

const SAMPLE_PX = 0.05;
const RUN_PX = 2_000;

/** The lengths (px of stride) of the consecutive pose/step beats over a long walk, in order. */
function beats(gait: Gait): { step: boolean; px: number }[] {
  const out: { step: boolean; px: number }[] = [];
  for (let p = 0; p < RUN_PX; p += SAMPLE_PX) {
    const step = isStepBeat(gait, p);
    const last = out[out.length - 1];
    if (last !== undefined && last.step === step) last.px += SAMPLE_PX;
    else out.push({ step, px: SAMPLE_PX });
  }
  // The first and last runs are cut by the window; drop them.
  return out.slice(1, -1);
}

describe('walk gait (FR32, Story 4.2)', () => {
  it('normal: pose and step beats alternate, each one stride long', () => {
    const b = beats('normal');
    expect(b.length).toBeGreaterThan(100);
    for (const beat of b) expect(beat.px).toBeCloseTo(GAIT.stepPx, 0);
  });

  it('normal: never dips', () => {
    for (let p = 0; p < RUN_PX; p += SAMPLE_PX) expect(gaitDipPx('normal', p)).toBe(0);
  });

  it('off-step: the beats alternate long and short, so the rhythm limps', () => {
    const b = beats('offstep');
    expect(b.length).toBeGreaterThan(100);
    for (const beat of b) {
      const expected = GAIT.stepPx * (beat.step ? GAIT.offstepShort : GAIT.offstepLong);
      expect(beat.px).toBeCloseTo(expected, 0);
    }
    expect(GAIT.offstepLong).toBeGreaterThan(GAIT.offstepShort);
  });

  it('off-step: covers ground at the same mean beat length as a normal walk', () => {
    const mean = (b: { px: number }[]): number => b.reduce((t, x) => t + x.px, 0) / b.length;
    // Whole cycles only (pose + step pairs), so a cut-off beat does not skew the mean.
    const off = beats('offstep');
    expect(mean(off.slice(0, off.length - (off.length % 2)))).toBeCloseTo(mean(beats('normal')), 0);
  });

  it('off-step: dips on the short beat only', () => {
    let dipped = 0;
    for (let p = 0; p < RUN_PX; p += SAMPLE_PX) {
      const dip = gaitDipPx('offstep', p);
      if (isStepBeat('offstep', p)) {
        expect(dip).toBeGreaterThan(0);
        expect(dip).toBeLessThanOrEqual(GAIT.offstepDipPx);
        dipped++;
      } else {
        expect(dip).toBe(0);
      }
    }
    expect(dipped).toBeGreaterThan(0);
  });

  it('is frozen', () => {
    expect(Object.isFrozen(GAIT)).toBe(true);
  });
});
