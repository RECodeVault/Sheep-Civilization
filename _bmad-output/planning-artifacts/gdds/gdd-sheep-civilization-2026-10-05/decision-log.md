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
