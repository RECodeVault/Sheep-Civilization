// Heading arithmetic shared by the steering systems (movement.ts, abomination.ts).
const TAU = 2 * Math.PI;

/** Wraps to [0, 2π). A tiny negative input can round up to exactly 2π, and `+ 0` turns -0 into 0. */
export function wrapAngle(a: number): number {
  a %= TAU;
  if (a < 0) a += TAU;
  return a >= TAU ? 0 : a + 0;
}
