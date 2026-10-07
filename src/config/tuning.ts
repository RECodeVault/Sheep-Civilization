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
  // Architecture N1: off in Epic 1 (staging); on since Story 2.4, so every non-sacrifice death leaves a
  // carcass (FR12) for the contagion chain.
  carcassesEnabled: true,
  // FR7 stage thresholds by age: Lamb 0–60 s, Adult 60–420 s, Elder from 420 s. Adulthood was 60–300 s
  // in the GDD; Rylan lengthened it to 6 minutes on 2026-10-07 to give the player time to breed.
  lambUntilMs: 60_000,
  elderFromMs: 420_000,
  // FR7 / GDD Life Stages: the elder stage lasts 2 minutes (shifted with adulthood, 2026-10-07): dies of
  // old age at 540 s (lifecycle.ts).
  oldAgeMs: 540_000,
  // GDD Starting flock: every founding sheep starts at Fullness 60.
  startFullness: 60,
  // FR3 (changed 2026-10-06): a Farm click fills farmPipsPerClick pips of an 8-pip bar; every full
  // bar drops 1 food piece at a random spot in the pen. There is no food stock. Better Hoe (4.7)
  // raises the pips per click and the boost doubles them (selectors.ts farmPipsPerClick).
  farmPipsPerFood: 8,
  farmPipsPerClick: 1,
  // FR19 / GDD The Better Place: each sacrifice "doubles the pips each Farm click fills, for 30 s". A
  // sacrifice during a boost resets it to 30 s; boosts never stack. Farm (food) only, never breeding.
  boostMs: 30_000,
  boostPipMultiplier: 2,
  // FR8 (changed 2026-10-06): Farm Breeding Food works like Farm. A click fills breedingPipsPerClick
  // pips of an 8-pip bar; every full bar drops 1 breeding piece in the pen, which an adult eats to
  // become ready (FR8a). No stock, no cap. Never boosted, and Better Hoe does not apply.
  breedingPipsPerFood: 8,
  breedingPipsPerClick: 1,
  // FR17 / GDD Life Stages ("Can sell: Yes, $10" / "$5"): what the Market pays for an adult and an
  // elder. Lambs cannot be sold (selectors.ts salePrice gives them 0).
  sellPriceAdult: 10,
  sellPriceElder: 5,
  // FR22 / FR23 / GDD Upgrade Trees: shop prices. Land I, II and III ($50 / $150 / $400; each needs the
  // one before, selectors.ts shopRequires) and the two decorations. Epic 4 adds its own items' prices.
  landPrices: Object.freeze([50, 150, 400] as const),
  flowerPatchPrice: 40,
  scarecrowPrice: 80,
  // FR10 / GDD Breeding: "each adult can breed once every 60 s (tune)", starting at breeding.
  breedCooldownMs: 60_000,
  // FR9 / GDD Breeding: "a lamb is born beside them 10 s later".
  gestationMs: 10_000,
  // FR11 / FR22 / GDD Upgrade Trees: land capacity by land tier (0 = no land, then Land I, II, III).
  // Capacity counts living sheep plus pending lambs (AR21); selectors.ts capacity reads it by tier.
  landCapacities: Object.freeze([10, 25, 50, 100] as const),
  // FR5: sheep below 90 Fullness may seek food (feeding.ts pairs each piece with its nearest such
  // sheep); a piece is worth +35, capped at fullnessMax.
  seekBelowFullness: 90,
  foodPieceFullness: 35,
  // [ASSUMPTION, tune in 3.6] A seeker eats once its centre is this close to the piece. Must stay
  // above ~8 px: a sheep standing on the piece holds a seeker off at personalSpacePx × (1 − 1 /
  // separationWeight). Then it stands munching for eatMs before it wanders again.
  eatReachPx: 12,
  eatMs: 1_500,
  // FR15 / GDD Virus: "Death 20 s after infection".
  virusDeathMs: 20_000,
  // [ASSUMPTION, Story 2.5 Open Question 1; tune in 3.6] A carcass feeds like a food piece, so the virus
  // (not hunger) is what kills the sheep that ate it.
  carcassFullness: 35,
  // GDD Starting flock: the founding adults are aged 60 s.
  startAdultAgeMs: 60_000,
  // FR6 / GDD Starting flock: 2 adults aged 60 s and 1 newborn lamb.
  startFlockAdults: 2,
  startFlockLambs: 1,
  // FR22 / UX-DR49: the fence by land tier, as landCapacities. Each contains the one before, so the fence
  // only ever grows in place (Story 3.3). World px equal the mockup's canvas px.
  // - Start [ASSUMPTION, tune in 3.6]: inside the Land I fence; clear of the Better Place (upper-left),
  //   the Market (right) and the 112 px bar.
  // - Land I: mockups/hud.html (430–1062 × 184–598).
  // - Land II, III [ASSUMPTION, tune in 3.6]: grow left and down only, so the whole play area (fence,
  //   Better Place, Market) still fits one screen (GDD Camera): the right edge stays clear of the Market
  //   (x 1080), the top stays under the Better Place (y 186), and y 72–648 is the field's 576 px.
  landFences: Object.freeze([
    Object.freeze({ x: 556, y: 330, width: 380, height: 250 }) satisfies Rect,
    Object.freeze({ x: 430, y: 184, width: 632, height: 414 }) satisfies Rect,
    Object.freeze({ x: 236, y: 184, width: 826, height: 464 }) satisfies Rect,
    Object.freeze({ x: 32, y: 184, width: 1030, height: 464 }) satisfies Rect,
  ] as const),
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
