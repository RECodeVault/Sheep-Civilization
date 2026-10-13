import { describe, expect, it } from 'vitest';
import { thumbX, valueAt } from '../../../src/view/widgets/sliderMath';

const X = 100;
const W = 200;

describe('valueAt', () => {
  it('maps the track ends to 0 and 1', () => {
    expect(valueAt(X, X, W)).toBe(0);
    expect(valueAt(X + W, X, W)).toBe(1);
  });

  it('clamps a pointer left or right of the track', () => {
    expect(valueAt(X - 50, X, W)).toBe(0);
    expect(valueAt(X + W + 50, X, W)).toBe(1);
  });

  it('maps the middle to 0.5', () => {
    expect(valueAt(X + W / 2, X, W)).toBe(0.5);
  });

  it('rounds to 2 decimals', () => {
    expect(valueAt(X + 1, X, 300)).toBe(0);
    expect(valueAt(X + 100, X, 300)).toBe(0.33);
  });

  it('returns 0, never NaN, for a zero-width or non-finite input', () => {
    expect(valueAt(X, X, 0)).toBe(0);
    expect(valueAt(Number.NaN, X, W)).toBe(0);
  });
});

describe('thumbX', () => {
  it('puts the thumb at the track ends for 0 and 1, clamped beyond', () => {
    expect(thumbX(0, X, W)).toBe(X);
    expect(thumbX(1, X, W)).toBe(X + W);
    expect(thumbX(-1, X, W)).toBe(X);
    expect(thumbX(2, X, W)).toBe(X + W);
  });

  it('round-trips with valueAt', () => {
    for (const v of [0, 0.1, 0.25, 0.5, 0.8, 1]) {
      expect(valueAt(thumbX(v, X, W), X, W)).toBeCloseTo(v, 2);
    }
  });
});
