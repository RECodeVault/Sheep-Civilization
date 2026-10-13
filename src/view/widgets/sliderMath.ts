// The Slider's value math (Story 5.7), pure so it can be tested without Phaser: a pointer x on a track
// maps to a 0–1 value and back. Values are rounded to 2 decimals so the stored settings stay tidy.

const DECIMALS = 100;

/** The value (0–1, 2 decimals) for a pointer at `x` on a track from `trackX`, `trackW` px long. */
export function valueAt(x: number, trackX: number, trackW: number): number {
  if (!(trackW > 0) || !Number.isFinite(x)) return 0;
  const v = (x - trackX) / trackW;
  const clamped = v <= 0 ? 0 : v >= 1 ? 1 : v;
  return Math.round(clamped * DECIMALS) / DECIMALS;
}

/** The thumb's centre x for `value` (clamped to 0–1) on the track. */
export function thumbX(value: number, trackX: number, trackW: number): number {
  const v = value <= 0 || !Number.isFinite(value) ? 0 : value >= 1 ? 1 : value;
  return trackX + v * trackW;
}
