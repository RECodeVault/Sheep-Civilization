import { afterEach, describe, expect, it, vi } from 'vitest';
import { MAX_FRAME_MS, TICK_MS } from '../../src/config/constants';
import { FixedStepClock } from '../../src/core/fixedStep';

describe('FixedStepClock', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('runs whole ticks only and carries the remainder', () => {
    const clock = new FixedStepClock();
    let ticks = 0;
    for (let i = 0; i < 6; i++) ticks += clock.advance(16.67);
    expect(ticks).toBe(1);
    expect(clock.alpha).toBeCloseTo((6 * 16.67 - TICK_MS) / TICK_MS, 6);
  });

  it('clamps a long frame to MAX_FRAME_MS', () => {
    const clock = new FixedStepClock();
    expect(clock.advance(1000)).toBe(Math.floor(MAX_FRAME_MS / TICK_MS));
    expect(clock.alpha).toBeCloseTo((MAX_FRAME_MS % TICK_MS) / TICK_MS, 9);
  });

  it('keeps alpha in [0, 1)', () => {
    const clock = new FixedStepClock();
    for (const d of [0, 7, 33, 99.9, 100, 250, 3, 1e6]) {
      clock.advance(d);
      expect(clock.alpha).toBeGreaterThanOrEqual(0);
      expect(clock.alpha).toBeLessThan(1);
    }
  });

  it('reset() zeroes the accumulator', () => {
    const clock = new FixedStepClock();
    clock.advance(90);
    clock.reset();
    expect(clock.alpha).toBe(0);
    expect(clock.advance(20)).toBe(0);
  });

  it('treats NaN, infinite and negative deltas as 0', () => {
    const clock = new FixedStepClock();
    expect(clock.advance(Number.NaN)).toBe(0);
    expect(clock.advance(-50)).toBe(0);
    expect(clock.advance(Number.POSITIVE_INFINITY)).toBe(0);
    expect(clock.alpha).toBe(0);
  });

  it('rejects non-finite or negative speed and tick sizes', () => {
    const clock = new FixedStepClock();
    for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, -1]) {
      expect(() => {
        clock.speed = bad;
      }).toThrow(/bad speed/);
    }
    expect(clock.speed).toBe(1);
    expect(clock.advance(100)).toBe(1);
    expect(() => new FixedStepClock(0)).toThrow(/bad tickMs/);
  });

  it('ignores a bad speed in production instead of hanging or freezing', () => {
    vi.stubEnv('DEV', false);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const clock = new FixedStepClock();
    clock.speed = 4;
    clock.speed = Number.POSITIVE_INFINITY;
    clock.speed = Number.NaN;
    expect(clock.speed).toBe(4);
    expect(clock.advance(100)).toBe(4);
  });

  it('runs no ticks at speed 0 (debug pause) and resumes where it left off', () => {
    const clock = new FixedStepClock();
    clock.advance(TICK_MS / 2);
    const alpha = clock.alpha;
    clock.speed = 0;
    for (let i = 0; i < 10; i++) expect(clock.advance(MAX_FRAME_MS)).toBe(0);
    expect(clock.alpha).toBe(alpha);
    clock.speed = 1;
    expect(clock.advance(TICK_MS / 2)).toBe(1);
  });

  it('applies speed after clamping', () => {
    const clock = new FixedStepClock();
    clock.speed = 4;
    expect(clock.advance(100)).toBe(4);
    expect(clock.advance(1000)).toBe((MAX_FRAME_MS * 4) / TICK_MS);
  });
});
