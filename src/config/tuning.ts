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
  // FR1: Fullness runs 0–100 per sheep; a sheep dies at 0.
  fullnessMax: 100,
  // GDD Hunger: "100 → 0 over 120 s". The per-tick drain is derived from these two.
  starveMs: 120_000,
  // FR2: Fed above 50, Starving below 25, Hungry in between (both bounds inclusive).
  fedAbove: 50,
  starvingBelow: 25,
  // Architecture N1 Epic 1 staging: killSheep spawns no carcass until Story 2.4 turns this on.
  carcassesEnabled: false,
  // FR7 stage thresholds by age: Lamb 0–60 s, Adult 60–300 s, Elder from 300 s.
  lambUntilMs: 60_000,
  elderFromMs: 300_000,
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
  // Closest a sheep's centre may come to the fence, for spawning and movement alike. Clears a 64×52
  // sheep (half-width 32) plus the fence's 4 px side rail and its 12 px pair of top/bottom rails.
  fenceInset: 40,
  // GDD Feeding: "Walk speed 60 px/s (tune)". The cap on any sheep's total speed.
  walkSpeedPxPerS: 60,
  // GDD Abomination tells: "normal 24 px personal space (tune)". Story 4.2 adds the 36 px value.
  personalSpacePx: 24,
  // Architecture (Movement and Flock Spacing): 48 px uniform grid for neighbour queries.
  gridCellPx: 48,
  // [ASSUMPTION, tune in 3.6] Wander feel: the most a heading turns per tick, the per-tick chance a
  // walking sheep stops to graze (mean walk about 5 s), and how long a grazing stop lasts.
  wanderTurnRad: 0.35,
  wanderRestChance: 0.02,
  wanderRestMinMs: 1_500,
  wanderRestMaxMs: 4_000,
  // [ASSUMPTION, tune in 3.6] Separation speed at full overlap, as a multiple of walk speed (before
  // the walk-speed cap), and how close to the inner fence edge a walking sheep starts turning back.
  separationWeight: 1.5,
  fenceTurnMarginPx: 24,
});
