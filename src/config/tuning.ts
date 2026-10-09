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
  // Kept in 3.6 (2026-10-08).
  starveMs: 120_000,
  // FR2: Fed above 50, Starving below 25, Hungry in between (both bounds inclusive).
  fedAbove: 50,
  starvingBelow: 25,
  // Architecture N1: off in Epic 1 (staging); on since Story 2.4, so every non-sacrifice death leaves a
  // carcass (FR12) for the contagion chain.
  carcassesEnabled: true,
  // FR7 stage thresholds by age: Lamb 0–60 s, Adult 60–420 s, Elder from 420 s. Adulthood was 60–300 s
  // in the GDD; Rylan lengthened it to 6 minutes on 2026-10-07 to give the player time to breed.
  // Both kept in 3.6 (2026-10-08): a 2-minute-longer life did not bring Town in at 3 clicks/s.
  lambUntilMs: 60_000,
  elderFromMs: 420_000,
  // FR7 / GDD Life Stages: the elder stage lasts 2 minutes (shifted with adulthood, 2026-10-07): dies of
  // old age at 540 s (lifecycle.ts).
  // Kept in 3.6 (2026-10-08); the old-age toast builds its minutes from it.
  oldAgeMs: 540_000,
  // GDD Starting flock: every founding sheep starts at Fullness 60.
  startFullness: 60,
  // FR3 (changed 2026-10-06): a Farm click fills farmPipsPerClick pips of a 6-pip bar; every full
  // bar drops 1 food piece at a random spot in the pen. There is no food stock. Better Hoe (4.7)
  // raises the pips per click and the boost doubles them (selectors.ts farmPipsPerClick).
  // Tuned in 3.6 (Rylan, 2026-10-08): was 8. Feeding 10 sheep takes ~1.4 clicks/s, 25 sheep ~3.6.
  farmPipsPerFood: 6,
  farmPipsPerClick: 1,
  // FR19 / GDD The Better Place: each sacrifice "doubles the pips each Farm click fills, for 30 s". A
  // sacrifice during a boost resets it to 30 s; boosts never stack. Farm (food) only, never breeding.
  boostMs: 30_000,
  boostPipMultiplier: 2,
  // FR8 (changed 2026-10-06): Farm Breeding Food works like Farm. A click fills breedingPipsPerClick
  // pips of an 8-pip bar; every full bar drops 1 breeding piece in the pen, which an adult eats to
  // become ready (FR8a). No stock, no cap. Never boosted, and Better Hoe does not apply.
  // Kept at 8 in 3.6 (Rylan, 2026-10-08): it barely moves the first breeding or Village.
  breedingPipsPerFood: 8,
  breedingPipsPerClick: 1,
  // FR17 / GDD Life Stages ("Can sell: Yes, $10" / "$5"): what the Market pays for an adult and an
  // elder. Lambs cannot be sold (selectors.ts salePrice gives them 0).
  // Both kept in 3.6 (2026-10-08).
  sellPriceAdult: 10,
  sellPriceElder: 5,
  // FR22 / FR23 / GDD Upgrade Trees: shop prices. Land I, II and III ($50 / $150 / $400; each needs the
  // one before, selectors.ts shopRequires) and the two decorations. Epic 4 adds its own items' prices.
  // Land I tuned in 3.6 (Rylan, 2026-10-08): was $50 (5 adult sales), now $80 (8), so Town lands in the
  // GDD's 10–15 min at the pacing probe's 6 clicks/s instead of ~9:30. Land II and III kept.
  landPrices: Object.freeze([80, 150, 400] as const),
  flowerPatchPrice: 40,
  scarecrowPrice: 80,
  // FR26 / GDD Upgrade Trees: "Medicine (per dose) | Consumable | $15". Repeatable (Story 4.5).
  medicinePrice: 15,
  // FR10 / GDD Breeding: "each adult can breed once every 60 s (tune)", starting at breeding.
  // Kept in 3.6 (2026-10-08): Town is click-bound, not cooldown-bound.
  breedCooldownMs: 60_000,
  // FR9 / GDD Breeding: "a lamb is born beside them 10 s later".
  gestationMs: 10_000,
  // FR11 / FR22 / GDD Upgrade Trees: land capacity by land tier (0 = no land, then Land I, II, III).
  // Capacity counts living sheep plus pending lambs (AR21); selectors.ts capacity reads it by tier.
  // Kept in 3.6 (2026-10-08).
  landCapacities: Object.freeze([10, 25, 50, 100] as const),
  // FR27 / GDD Meta-Progression: living sheep needed for Village, Town and Wool Empire (Pasture below
  // the first). Each equals a land capacity on purpose (GDD Level Progression; decision log
  // "Overcrowding at era thresholds"): the player enters each era at full capacity. Kept in 3.6
  // (2026-10-08); a later retune changes both tables together or logs why.
  eraThresholds: Object.freeze([10, 25, 50] as const),
  // FR5: sheep below 90 Fullness may seek food (feeding.ts pairs each piece with its nearest such
  // sheep); a piece is worth +35, capped at fullnessMax.
  seekBelowFullness: 90,
  // Kept in 3.6 (2026-10-08).
  foodPieceFullness: 35,
  // [ASSUMPTION; kept in 3.6, 2026-10-08; 12 → 14 in Story 4.2 review, Rylan] A seeker eats once its centre is
  // this close to the piece. Must stay above the hold-off: a sheep standing on the piece holds a seeker
  // off at space × (1 − 1 / separationWeight), 8 px for personalSpacePx and 12 px for the Abomination's
  // abominationSpacePx (an Abomination pinned against the rail cannot be pushed off it). Then it stands
  // munching for eatMs before it wanders again.
  eatReachPx: 14,
  eatMs: 1_500,
  // FR15 / GDD Virus: "Death 20 s after infection".
  virusDeathMs: 20_000,
  // FR34 / GDD Overcrowding (Should tier): "While the flock is at 90% or more of capacity, every 30 s one
  // random sheep has a 20% chance to become infected." (tune) Story 4.6, overcrowding.ts. Living sheep
  // only, against land capacity (selectors.ts crowdedAt); the roll's clock runs from new game.
  overcrowdFraction: 0.9,
  overcrowdIntervalMs: 30_000,
  overcrowdInfectChance: 0.2,
  // [ASSUMPTION, Story 2.5 Open Question 1; kept in 3.6, 2026-10-08] A carcass feeds like a food piece, so the virus
  // (not hunger) is what kills the sheep that ate it.
  carcassFullness: 35,
  // GDD Starting flock: the founding adults are aged 60 s.
  startAdultAgeMs: 60_000,
  // FR6 / GDD Starting flock: 2 adults aged 60 s and 1 newborn lamb.
  startFlockAdults: 2,
  startFlockLambs: 1,
  // FR22 / UX-DR49: the fence by land tier, as landCapacities. Each contains the one before, so the fence
  // only ever grows in place (Story 3.3). World px equal the mockup's canvas px.
  // - Start [ASSUMPTION; kept in 3.6, 2026-10-08]: inside the Land I fence; clear of the Better Place (upper-left),
  //   the Market (right) and the 112 px bar.
  // - Land I: mockups/hud.html (430–1062 × 184–598).
  // - Land II, III [ASSUMPTION; kept in 3.6, 2026-10-08; tests/view/field/layout.test.ts checks the fit]: grow left and down only, so the whole play area (fence,
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
  // GDD Abomination tells: "normal 24 px personal space (tune)": the separation radius between ordinary
  // sheep, and the one the Abomination itself feels. Kept in 3.6 (2026-10-08): no spacing issue in the
  // playtest; the tell needs the gap to abominationSpacePx.
  personalSpacePx: 24,
  // GDD The Abomination (Should tier) → Moment-to-moment tells: "other sheep keep 36 px from it instead
  // of the normal 24 px personal space (tune)" (FR32, Story 4.2). Every other sheep's separation radius
  // from the living Abomination; it feels only personalSpacePx itself (movement.ts). Must stay above
  // personalSpacePx (the tell is the gap). Applied by a direct distance check, not a grid query, but kept
  // within gridCellPx so it could become one; eatReachPx must clear its hold-off (see there).
  abominationSpacePx: 36,
  // GDD The Abomination (Should tier) → Spawn: "The first Abomination is guaranteed on a random birth
  // between the 8th and 15th birth of a save. After that, 5% per birth. At most 1 alive at a time."
  // A birth is a pending lamb coming due (FR29, Story 4.1); the founding lamb is not one.
  abominationGuaranteedBirthMin: 8,
  abominationGuaranteedBirthMax: 15,
  abominationBirthChance: 0.05,
  // GDD The Abomination (Should tier) → Kill cycle: "Every 45–60 s (random) it picks a random victim
  // (any sheep except itself), walks up to it, pauses for 1 s next to it, then walks away. The victim
  // dies 5–10 s later (random)" (FR31, Story 4.3). The interval runs from the spawn to the first visit,
  // then from the start of each leave (or a given-up approach) to the next. Lifting the Abomination
  // mid-visit reschedules nothing: the next visit is due at once.
  abominationKillMinMs: 45_000,
  abominationKillMaxMs: 60_000,
  abominationLingerMs: 1_000,
  abominationDoomMinMs: 5_000,
  abominationDoomMaxMs: 10_000,
  // [ASSUMPTION] "Next to it": the centre distance at which the approach counts as contact, with sprites
  // drawn 44–64 px wide. Must stay above personalSpacePx (the Abomination's own push would slow the
  // approach) and below abominationSpacePx: the victim is pushed away inside 36 px, and only 30 px in it
  // flees slowly enough (15 px/s) to be reached without a chase across the pen.
  abominationContactPx: 30,
  // [ASSUMPTION] How long it walks away after the linger (about 120 px at walk speed).
  abominationLeaveMs: 2_000,
  // [ASSUMPTION] A safety valve: an approach that has not made contact by then gives up (no doom) and
  // schedules the next visit.
  abominationApproachMaxMs: 20_000,
  // Architecture (Movement and Flock Spacing): 48 px uniform grid for neighbour queries.
  gridCellPx: 48,
  // [ASSUMPTION; kept in 3.6, 2026-10-08] Wander feel: the most a heading turns per tick, the per-tick chance a
  // walking sheep stops to graze (mean walk about 5 s), and how long a grazing stop lasts.
  wanderTurnRad: 0.35,
  wanderRestChance: 0.02,
  wanderRestMinMs: 1_500,
  wanderRestMaxMs: 4_000,
  // [ASSUMPTION; kept in 3.6, 2026-10-08] Separation speed at full overlap, as a multiple of walk speed (before
  // the walk-speed cap), and how close to the inner fence edge a walking sheep starts turning back.
  separationWeight: 1.5,
  fenceTurnMarginPx: 24,
});
