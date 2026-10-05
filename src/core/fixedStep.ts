// Fixed-step accumulator: turns variable frame deltas into whole sim ticks. Engine-free; the scene
// passes in each frame's delta. Pause = stop calling advance().
import { MAX_FRAME_MS, TICK_MS } from '../config/constants';
import { invariant } from './invariant';

export class FixedStepClock {
  private acc = 0;
  private speedValue = 1;
  private readonly tickMs: number;
  private readonly maxFrameMs: number;

  constructor(tickMs = TICK_MS, maxFrameMs = MAX_FRAME_MS) {
    invariant(tickMs > 0 && Number.isFinite(tickMs), `FixedStepClock: bad tickMs ${tickMs}`);
    invariant(maxFrameMs >= 0 && Number.isFinite(maxFrameMs), `FixedStepClock: bad maxFrameMs ${maxFrameMs}`);
    this.tickMs = tickMs;
    this.maxFrameMs = maxFrameMs;
  }

  /** Debug sim-speed multiplier (×1/×4/×16), applied after the per-frame clamp. */
  get speed(): number {
    return this.speedValue;
  }

  /** Non-finite or negative values are ignored, so a bad value can never hang or freeze the loop. */
  set speed(value: number) {
    invariant(Number.isFinite(value) && value >= 0, `FixedStepClock: bad speed ${value}`);
    if (Number.isFinite(value) && value >= 0) this.speedValue = value;
  }

  /** Adds one frame's real delta and returns how many whole ticks to run now. */
  advance(frameDeltaMs: number): number {
    const d = Number.isFinite(frameDeltaMs) && frameDeltaMs > 0 ? Math.min(frameDeltaMs, this.maxFrameMs) : 0;
    this.acc += d * this.speedValue;
    const ticks = Math.floor(this.acc / this.tickMs);
    this.acc -= ticks * this.tickMs;
    return ticks;
  }

  /** Fraction of the next tick already accumulated, in [0, 1); used to interpolate rendering. */
  get alpha(): number {
    return this.acc / this.tickMs;
  }

  /** Drops any accumulated time (e.g. after the tab becomes visible again). */
  reset(): void {
    this.acc = 0;
  }
}
