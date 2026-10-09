# Sheep Civilization GDD: Decision Log

## 2026-10-05 · v0.1 · Workspace created (Create intent)
- Source: game brief (final), addendum, brief decision log, docs/concept/ideas.md, extracted via subagent.
- Carried in from the brief as settled: desktop web only; Phaser 3 + TS + Vite (tech spec only); 7-day solo build (Must days 1–4, Should 5–6, polish day 7); active, no offline progress; pause on visibilitychange; autosave to localStorage; hard loss on flock wipe; 4 pillars (Attention is the resource / Cute surface, consequences underneath / Every sheep is a decision / Growth you can see); loop Farm → Feed → Contain → Breed → Decide → Grow.
- Open going in: genre match; era count vs thresholds; all economy numbers; sacrifice boost value; Abomination rate/kill rate/tells; auto-feeder limit; virus timings; elder sale rule; first-minute menace vs no scripted dark moment; camera/view.

## 2026-10-05 · Discovery round 1 (Rylan)
- **Game type:** Idle/Incremental confirmed. Genre guide: idle-incremental.md; Prestige subsection → N/A (cut in brief).
- **Eras:** 4 eras. Pasture (start) → Village (10) → Town (25) → Wool Empire (50). Era change = background swap only for v1; unlocks deferred.
- **Elders: CAN be sold.** Overrides brief ("only adults can be bred or sold"). Price TBD.
- **Infection in Must tier:** stays fatal. Medicine remains Should. Player's cheap counter = drag infected sheep to the Better Place (no carcass → breaks contagion chain).
- **Abomination kill pattern:** picks a target, subtly walks up to it, walks away; victim dies 5–10 s later. Kills happen on screen, no obvious tell at the moment of contact.
- **First-minute menace:** a sheep visibly goes thin within ~45 s (systemic, not scripted). Resolves addendum vs brief conflict.
- **Pace:** "somewhat frantic". Unfed sheep starves in ~60 s. Shifts away from brief's "leave Insaniquarium's frantic pace"; pillar 1 (Attention is the resource) strengthened.
- **Working mode:** Express (proposed; user answered questions directly).

## 2026-10-05 · Discovery round 2: numbers (Rylan)
- Proposed number table accepted except as changed below.
- **Breeding food:** option (a), a second Farm button ("Farm Breeding Food").
- **Starvation time:** 120 s full → dead (was 60 s). Hungry state at 60 s unfed, Starving (thin) at 90 s.
  - Consequence: to keep "thin within ~45 s" in the first minute, the starting flock spawns at hunger 60 (Starving at ~42 s). [designer to confirm at review]
- **Era counting:** sheep alive right now. Eras can regress after losses (background reverts).

## 2026-10-05 · v0.2 · Full draft (Express)
- gdd.md and epics.md drafted. Starter numbers adopted (tune flags inline).
- Proposed during drafting, pending designer confirmation:
  - Selling via a Market stall drag target (parallel to the Better Place → comedic mis-drops).
  - Abomination never grows past lamb (can't be sold; long-horizon tell).
  - Land shown as fence expansion.
  - Should-tier values: medicine $15; overcrowding ≥90% cap → 20%/30 s; Better Hoe $30/$100; auto-feeder $120, 1 piece/10 s (sustains ~4 sheep).
  - Decorations: Flower Patch $40, Scarecrow $80 (cosmetic).
- Flagged: at 5% per birth, a short session may never spawn an Abomination (≈54% over 15 births).

## 2026-10-05 · Finalize: input reconciliation autofixes
- Added: Comparables Take/Leave table, Narrative note, Risks & Mitigations (brief's 4 risks), single-state-object tech line, portal non-targets, build size 10 → 8 MB.
- Out of Scope additions from ideas.md: last-sheep grace period, random events, Abomination bonus payout, oldest-sheep statue.
- Drafting change logged retroactively: brief's "Feed button" became "click the field to drop food" (designer to confirm).

## 2026-10-05 · Finalize: validator autofixes
- game_type id canonicalized; visibilitychange wording moved out of Win/Loss (kept in Tech Specs); pending-lamb capacity wording; Epic-1 lose screen shows time survived + peak flock (stats panel is Should); Abomination-odds note moved to Notes for designer.
- epics.md: Esc/F/G controls added to Epic 1; starting flock 2 adults + 1 lamb restored in Epic 2; mis-drop handling added to Epic 2 story 5.

## 2026-10-05 · v0.3 · Finalize: designer decisions (Rylan)
- **Pacing fix (a):** 60 s per-adult breeding cooldown (covers pregnant pairs). Pacing target revised to Village ~3–5 min, Town ~10–15 min (hand-sim); still an [ASSUMPTION] to validate after Epic 3.
- **Starting ages:** adults at 60 s, lamb at 0 s; founders die of old age at ~6 min (first carcass for short visits).
- **Overcrowding at era thresholds:** kept as deliberate pressure.
- **Sacrifice reveal:** Abomination flashes true form; innocents get "…that was just {name}." No payout.
- **Schedule:** upgrades + auto-feeder moved to Epic 4 (day 5); Epic 5 = names/stats/playtest (day 6), juice/audio/deploy (day 7).
- **Fullness** is the internal stat name; player-facing states stay Fed/Hungry/Starving.
- **Feeding:** click the field to drop food (replaces brief's Feed button), confirmed.
- **Confirmed:** Market stall drag target; Abomination stays a lamb forever; first Abomination guaranteed in births 8–15, then 5%; fence expansion shows land; Should-tier values.
- Applied validator recommendations (low-risk): Abomination never dies of old age, counts toward capacity/eras, targets any other sheep; avoidance 36 px vs 24 px personal space; boost bounded by food cap noted.

## 2026-10-05 · v1.0 · Finalized
- Open items: 1 non-blocking [ASSUMPTION] (pacing targets), deferred to the playtest after Epic 3. No phase-blockers.
- Polish standards: none configured. Narrative handoff: not flagged by the idle-incremental guide. External handoffs: none configured.
- Next step: gds-game-architecture.

## 2026-10-06 · Farm progress bar (Rylan)
- **Farm:** each click (or `F`) fills 1 pip of an **8-pip** progress bar (was +1 food per click; Rylan first proposed 10, then 8 so the player need not click as fast). A full bar adds +1 food to the stock (cap 20, start 5) and resets; leftover pips carry over.
- **Overflow:** a bar completed while the stock is full drops 1 food piece at a random reachable spot on the field. Pieces never spoil and the field has no cap, so food can be stockpiled on the field.
- **Upgrades:** Better Hoe I / II fill 2 / 3 pips per click; the sacrifice boost doubles the pips per click. The stock cap no longer limits the boost.
- **Unchanged:** Farm Breeding Food (+1 per click, cap 10); field click spends 1 food per piece; auto-feeder takes from the stock.
- **HUD:** under Farm, the 8-pip bar and the stock as a hay icon + "{n}/20"; "+1" popup only when a bar completes into the stock; tooltip "Farm: fill the bar for 1 food (F)".
- **Risk:** feed load is ~8× the clicks (10 sheep ≈ 1.9 Farm clicks/s, 25 ≈ 4.8 before upgrades). [ASSUMPTION] Retune `farmPipsPerFood` and reconsider Better Hoe's tier in Story 3.6.
- Source: `planning-artifacts/sprint-change-proposal-2026-10-06.md`.

## 2026-10-06 · No food stock: the Farm bar drops food (Rylan)
- Supersedes parts of the previous entry, after playing the Story 1.7 build.
- **Farm** is the only way to make food: every full 8-pip bar drops 1 food piece at a random reachable spot in the pen (seeded RNG). The bar shows its count "{n}/8", starting at "0/8".
- **Removed:** the food stock (x/20, start 5), click-the-field-to-drop (FR4), the empty-food-meter shake (UX-DR61). A field click does nothing until carcass clicks (Story 2.4).
- Pieces pile up in the pen with no cap and never spoil; "+1" pops over the button when a bar completes.
- **Open:** the auto-feeder (Story 4.8) drew from the food stock; what feeds it is decided when 4.8 is created.
- Pacing: one fewer click per piece (no field click), so feeding is about 8 Farm clicks per piece. Still for Story 3.6 to tune.

## 2026-10-06 · Breeding food works like the Farm bar (Rylan)
- Reverses "Unchanged: Farm Breeding Food (+1 per click, cap 10)" from the Farm-bar entries above, after the Story 2.2 build.
- **Farm Breeding Food:** each click (or `G`) fills 1 pip of an **8-pip** breeding bar ("{n}/8"). A full bar drops 1 **breeding-food piece** (pink, heart-shaped) at a seeded-random reachable spot in the pen; leftover pips carry over. No stock, no cap, pieces never spoil; never boosted and Better Hoe does not apply.
- **Eating:** an adult that is not ready and not on cooldown walks to the nearest breeding piece and eats it, becoming **ready to breed** (no Fullness). Food comes first. Lambs and elders ignore pieces; a ready adult that turns elder loses readiness. Breeding pieces never count as food (carcass rule, auto-feeder).
- **Breeding:** the Breed tool pairs two ready adults; no cost. Both lose readiness and start the 60 s cooldown. Breed greys out at capacity or with fewer than 2 ready adults ("Needs 2 ready sheep.").
- **HUD:** the 10-heart breeding meter, its cost tick and its empty shake are removed; a heart-pip bar "{n}/8" sits under the button; ready sheep show a small heart above them.
- **Risk:** a breeding now takes 16 clicks (2 pieces) instead of 3. [ASSUMPTION] Story 3.6 tunes `breedingPipsPerFood`.
- Source: `planning-artifacts/sprint-change-proposal-2026-10-06-breeding-food.md`.

## 2026-10-08 · MVP pacing playtest and tuning pass (Rylan, Story 3.6)
- Resolves the open [ASSUMPTION] items deferred to "the playtest after Epic 3" (pacing targets, `farmPipsPerFood`, `breedingPipsPerFood`, Better Hoe's tier).
- **Farm bar: 8 → 6 pips** (`TUNING.farmPipsPerFood`). Feed load drops from ~1.9 to ~1.4 clicks/s at 10 sheep and from ~4.8 to ~3.6 at 25. The HUD bar now draws one pip per tuned pip ("{n}/6").
- **Breeding bar: kept at 8 pips** (`TUNING.breedingPipsPerFood`). The probe showed it barely moves the first breeding (~0:12–0:20) or Village.
- **Land I: $50 → $80** (`TUNING.landPrices[0]`; 8 adult sales instead of 5), from the 3.6 code review (Rylan): with $50 the reference player reached Town before 10 min at 6 clicks/s. Land II and III kept.
- **Better Hoe stays Should** (Story 4.7). No scope change.
- **First breeding in the first minute: accepted.** The founders start as adults, so a breeding at 0:10–0:20 is expected; the GDD Difficulty Curve now says so instead of "1–5 min".
- **Everything else kept**: breeding cooldown 60 s, gestation 10 s, life stages (lamb 60 s, elder 420 s, old age 540 s), starvation 120 s, +35 per piece, era thresholds 10/25/50 (still equal to the land capacities), land capacities and prices, sale prices, and the feel values (`eatReachPx`, `eatMs`, `carcassFullness`, wander, separation, personal space, fences).
- **Measured (scripted reference player, no boosts, no Better Hoe; seeds 3606/11/2026):** with 6/8 pips and Land I $80, Village at 3:54–4:11 at 3 clicks/s (in the 3–5 min window); Town at 12:26–14:30 at 6 clicks/s over 6 seeds (12:08–12:49 at 7), and not reached at 3–5 clicks/s (the flock plateaus at 14–23 when feeding plus replacing old-age deaths use the whole budget). Before the code review's bot fix (it could sell the flock without affording land) and the $80 price, Town was 8:50–9:54 at 6 clicks/s. In play, the sacrifice boost is what carries a normal clicker to Town before Better Hoe exists. `tests/sim/scenarios/pacing.test.ts` now guards Village in 3–5 min at 3 clicks/s and Town in 10–15 min at 6 clicks/s (3 seeds).
- **Performance:** with 100 sheep at Land III and a 300-piece pile (food, or food + breeding), the sim tick averages ≤ 0.21 ms (p99 ≤ 0.9 ms over 4 runs) against the 2 ms budget (`npm run bench`); one 13–15 ms sample in the first pile case in 3 of 4 runs, likely a GC pause in the bench harness.
- **Session (Rylan):** Rylan looked at the Phase A build and reported "everything looks good", then waived recording per-run times in the code review. The pacing above is the probe's, not a human session's; human times are deferred to the external playtest (Story 5.10).
- Source: `implementation-artifacts/3-6-mvp-pacing-playtest-and-tuning-pass.md` (Playtest Record).

## 2026-10-09 · The Auto-feeder makes its own food (Rylan, Story 4.8)
- Resolves the open item from 2026-10-06 ("what feeds the auto-feeder"). Chosen from: free food, moving existing field food to the hungriest sheep, a hopper filled by Farm, or free food only while a sheep is Hungry.
- **Free food:** once bought ($120, one only), it creates 1 food piece every 10 s of game time, `TUNING.autoFeederDropPx` (28 px) from the hungriest sheep (lowest Fullness, ties to the first, a dragged sheep skipped), at a seeded-random angle. Food pieces only; never breeding food. The Farm bar is untouched.
- **Limit:** its rate. 3.5 Fullness/s against 0.83/s per sheep feeds about 4. The hidden-tab pause, old age and click-only breeding keep walking away from being viable.
- **Clock:** derived from game time (it fires on the tick that crosses each 10 s), so there is no save field and no schema bump.
- **Guarded by `tests/sim/scenarios/autoFeeder.test.ts`** (seeds 3606/11/2026, 5 min, no commands): 4 adults never starve; 8 do, though fewer than 8 without it; 4 without it starve.
- **Measured by a throwaway probe (same seeds, not a test):** 4 sheep bottom out at 15–20 Fullness; 5 lose one at 156–198 s; 8 lose two by 72 s. In the code review, 4 young sheep on 15 seeds had no starvation over 60 min.
- **Target (code review, Rylan):** the hungriest non-dragged sheep, even one that cannot eat now (walking to another piece, eating, or the Abomination mid-visit). The piece then goes to the nearest sheep that can eat, or lies there. Kept as specified: it is rare, and any sheep already seeking food passes a piece by the same way, so it is not a tell.
- **Open (defaults kept):** a single sheep lets free pieces pile up, about 1 a minute (69 in an hour; 2–3 sheep build none), since pieces never spoil; no feeder sprite or HUD indicator; the pacing bot does not buy it.
- Source: `implementation-artifacts/4-8-auto-feeder.md`.
