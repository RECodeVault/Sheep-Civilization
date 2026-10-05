// Every GDD (tune) value and balance number lives here; sim code reads TUNING, never literals.
// Values are added by the stories that introduce each rule.

/** Axis-aligned rectangle in canvas px. */
export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export const TUNING = Object.freeze({
  // GDD Starting flock: every founding sheep starts at Fullness 60.
  startFullness: 60,
  // FR3/FR6: the food meter starts at 5 and is capped at 20; one Farm click adds 1.
  startFood: 5,
  foodCap: 20,
  farmFoodPerClick: 1,
  // GDD Starting flock: the founding adults are aged 60 s.
  startAdultAgeMs: 60_000,
  // Epic 1 interim flock (3 adults); Story 2.1 replaces it with the GDD's 2 adults + 1 lamb.
  interimFlockAdults: 3,
  // [ASSUMPTION, tune in 3.6] Starting fence, inside the Land I fence of mockups/hud.html so it can
  // grow in place; clear of the Better Place (upper-left), the Market (right) and the 112 px bar.
  startFence: Object.freeze({ x: 556, y: 330, width: 380, height: 250 }) satisfies Rect,
  // Distance from the fence edge to the nearest spawn point (a sheep's centre). Clears a 64×52 sheep
  // (half-width 32) plus the fence's 4 px side rail and its 12 px pair of top/bottom rails.
  spawnInset: 40,
});
