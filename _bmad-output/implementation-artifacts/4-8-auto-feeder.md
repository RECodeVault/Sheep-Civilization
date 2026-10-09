---
baseline_commit: aac2c3f
---

# Story 4.8: Auto-feeder

Status: done

<!-- Created 2026-10-09 by create-story. Eighth and last story of Epic 4 (Should tier). Design decision taken at creation (Rylan, 2026-10-09): the food stock is gone (sprint change 2026-10-06), so the Auto-feeder makes its own food. Once owned, it creates 1 food piece every 10 s from nothing, next to the hungriest sheep. Its output (35 Fullness / 10 s = 3.5/s) feeds about 4 sheep (GDD Automation Systems), so it helps without carrying a growing flock. Most hooks exist: the data-driven shop (`SHOP_ITEMS`, `shopPrice`, `buyBlock`, `SHOP_NAME/EFFECT`, `SHOP_ICON`), `createFoodPiece` (clamps to the inner fence), `FoodDropped`, the reserved step slot "overcrowding → autoFeeder → eras", and the shop panel already sized for 9 rows (Story 4.7). New: the `'autoFeeder'` item, a new `autoFeeder.ts` system on a 10 s clock derived from `state.time` (no new GameState field, so no schema bump), three TUNING values, the row and its placeholder icon, tests, and doc updates. Key risks: (1) the "4 sheep live, 8 starve" scenario must hold on fixed seeds without retuning; (2) an unattended pile of free food while the flock is small (see Open Question 1). -->

## Story

As a player,
I want an auto-feeder that drops food for the hungriest sheep,
so that I get a little help without the game playing itself.

## Acceptance Criteria

1. **A shop row (FR25, UX-DR23, UX-DR24, GDD Upgrade Trees, mockups/hud.html).** The shop panel shows **Auto-feeder** after Better Hoe II and before Medicine (mockup order). It shows the feeder icon, the name "Auto-feeder", the price "$120" (`TUNING.autoFeederPrice`), and the effect line **"Drops food every 10 s"** (the mockup's wording, built from `TUNING.autoFeederIntervalMs`). The panel now has 9 rows. Its top is at y 68, below the Pause button, so no layout change is needed (Story 4.7).
2. **Buying (FR21, FR25, UX-DR24, UX-DR68).** It is a one-time item stored in `state.owned`. It has no prerequisite. A click with enough money buys it at once, with no confirmation. Money drops by $120, the row shows "Owned" and `Bought { item: 'autoFeeder', price }` is emitted. A second `Buy` does nothing. The row is greyed while the player cannot afford it.
3. **It feeds (FR25, decision 2026-10-09).** While the Auto-feeder is owned, it **creates** 1 food piece on every tick that crosses a multiple of `TUNING.autoFeederIntervalMs` (10 s) of game time. The first drop comes 0–10 s after purchase. The food is free: it does not touch the Farm bar, money or anything else, and it emits no `Farmed` event. It drops **food pieces only**: it never makes a breeding piece, and it ignores breeding pieces when it places food.
4. **Next to the hungriest sheep.** The target is the living sheep with the lowest Fullness. Ties go to the lowest index in `state.sheep`. A sheep being `dragged` is skipped. The piece lands `TUNING.autoFeederDropPx` from the target's centre, at a seeded-random angle (one `rng` draw), clamped to the inner fence by `createFoodPiece`. A `FoodDropped { id, x, y }` event is emitted, so the piece appears and bounces in like a Farm piece. If no sheep can be the target, nothing drops and no rng is drawn.
5. **Feeding is unchanged.** The piece is an ordinary `FoodPiece`. The existing claim rules (`feeding.ts`, FR5) decide who eats it: usually the hungriest sheep, standing next to it. It never spoils. The Abomination is treated as any lamb: it can be the hungriest and get a piece. This is not a tell, because nothing in the view knows it was chosen.
6. **Nothing changes without it.** A game that does not own the Auto-feeder draws no extra rng and behaves byte-identically to before. All existing seeded tests (pacing included) are unchanged. A lost game never drops food (`stepWith` already stops), and a hidden tab stops it like every other system.
7. **Sustains about 4 sheep (epics 4.8 AC 4, GDD "sustains about 4 sheep").** A seeded scenario owns the Auto-feeder and runs 5 minutes with no Farm, no Farm Breeding Food and no other commands. With 4 adult sheep, none starves. With 8, at least one starves. A paired run without the Auto-feeder shows that the 4 sheep starve, so the first result is not vacuous.
8. **Save.** `owned` may hold `'autoFeeder'`. Validation accepts it through `SHOP_ITEMS`, and it round-trips. The clock is derived from `state.time`, so there is no new `GameState` field. `SAVE_SCHEMA_VERSION` stays 12 and there is no migration. A game reloaded mid-cycle keeps the same drop times.
9. **Done = `npm test`, `npm run typecheck` and `npm run lint` all pass**, and the browser checks in Task 7 pass.

## Tasks / Subtasks

- [x] **Task 1: Tuning (AC 1, 3, 4)** — `src/config/tuning.ts`
  - [x] 1.1 In the shop-price block, after `hoePrices`, add `autoFeederPrice: 120`, with a comment in the file's style: `// FR25 / GDD Upgrade Trees (Should tier): "Auto-feeder | Automation | $120". One only. Story 4.8.`
  - [x] 1.2 After the overcrowding block, add `autoFeederIntervalMs: 10_000` and `autoFeederDropPx: 28`. Comment: FR25 / GDD Automation Systems, "Drops 1 food piece next to the hungriest sheep every 10 s"; the food is free (decision 2026-10-09: there is no stock to draw from); 35 Fullness / 10 s = 3.5/s feeds about 4 sheep at 0.83/s each. Mark `autoFeederDropPx` as `[ASSUMPTION]`: "next to" means the piece lands beside the sheep, not under it. It is above `eatReachPx`, so the sheep takes a step, and well inside one sprite width.
  - [x] 1.3 `tests/config/tuning.test.ts`: add a `describe('Auto-feeder (FR25, Story 4.8)')` block. The interval is a positive multiple of `TICK_MS`. `autoFeederDropPx > TUNING.eatReachPx`. The output sustains between 4 and 5 sheep: `foodPieceFullness / (autoFeederIntervalMs / 1000)` divided by `fullnessMax / (starveMs / 1000)` lies in [4, 5). This guards the GDD claim against a retune. Use no literals other than the GDD's 4 and 5.

- [x] **Task 2: The shop item (AC 1, 2, 8)**
  - [x] 2.1 `src/sim/state.ts`: append `| 'autoFeeder'` to `ShopItemId`. Update its doc: the Auto-feeder was added in Story 4.8 (it no longer "appends").
  - [x] 2.2 `src/sim/selectors.ts`:
    - `SHOP_ITEMS`: append `'autoFeeder'` after `'hoe2'`. `SHOP_ROWS` then puts it before `'medicine'` automatically. Update both docs to the present tense.
    - `shopPrice`: add `case 'autoFeeder': return TUNING.autoFeederPrice;`. The `assertNever` default requires it.
    - `shopRequires`: no change, because the GDD says "Everything else is available from the start".
    - `buyBlock` and `selectShopView`: no change.
  - [x] 2.3 `src/sim/systems/economy.ts`: add the Auto-feeder to the header comment's list of what owned items do ("the Auto-feeder's drops, autoFeeder.ts, 4.8"). `buy()` needs **no** change.
  - [x] 2.4 Save: **no change** to `migrations.ts`, `normalize.ts`, `validate.ts` or `SAVE_SCHEMA_VERSION`. Validation already checks `owned` against `SHOP_ITEMS`, which now includes `'autoFeeder'`, and `shopRequires` returns null for it.

- [x] **Task 3: The system (AC 3–6)** — new `src/sim/systems/autoFeeder.ts`
  - [x] 3.1 Write a header comment in the style of `overcrowding.ts`. It covers FR25 and the 2026-10-09 decision (free food, no stock), the clock, the target rule, food only, its place in the step order, no secret field read, and no per-tick allocation (one piece allocated every 10 s is an event).
  - [x] 3.2 Export `updateAutoFeeder(state: GameState): void`:
    ```ts
    if (!isOwned(state, 'autoFeeder')) return;
    // Fires on the tick that crosses a multiple of the interval. Derived from time, not stored: robust to
    // a saved time that is not a multiple of TICK_MS, and no schema field.
    const i = TUNING.autoFeederIntervalMs;
    if (Math.floor(state.time / i) === Math.floor((state.time - TICK_MS) / i)) return;
    const target = hungriest(state);          // -1 when none
    if (target < 0) return;
    const s = state.sheep[target];
    const a = rngRange(state, 0, 2 * Math.PI);  // the only draw
    const p = createFoodPiece(state, s.x + Math.cos(a) * TUNING.autoFeederDropPx, s.y + Math.sin(a) * TUNING.autoFeederDropPx);
    emit({ type: 'FoodDropped', id: p.id, x: p.x, y: p.y });
    ```
    `hungriest` is a plain loop with no allocation. It returns the index of the lowest `fullness`, skipping `activity === 'dragged'`, and uses strict `<` so ties go to the lowest index. The ownership check comes first, so a game without the feeder pays one `includes` per tick and nothing else.
  - [x] 3.3 `src/sim/step.ts`: register `updateAutoFeeder` after `updateOvercrowding` and before `updateEras`. Turn the "intended order" comment into the actual order. Add one sentence of rationale: it runs after the tick's deaths, so it never targets a sheep that just died, and its piece is claimed on the next tick's feeding pass.
  - [x] 3.4 `src/sim/events.ts`: change the `FoodDropped` comment to "(a full Farm bar, or the Auto-feeder, Story 4.8)". Add no new event: the piece's bounce is the feedback.

- [x] **Task 4: Strings, icon and row (AC 1)**
  - [x] 4.1 `src/view/strings.ts`: `SHOP_NAME.autoFeeder: 'Auto-feeder'`. For `SHOP_EFFECT.autoFeeder`, add a helper in the style of `hoeEffect`: `function autoFeederEffect(): string { return \`Drops food every ${TUNING.autoFeederIntervalMs / 1000} s\`; }`. Comment it with the mockup's "Drops food every 10 s" and GDD Upgrade Trees. Both records are `Record<ShopRowId, string>`, so the compiler requires the new keys.
  - [x] 4.2 Art: create `assets/art/ui/icon-feeder.png` at **14×14**, like the other shop icons (shown at ×2 in the 28 px slot), from the mockup's `g-feeder` glyph (`mockups/hud.html` line 137, 16×16 viewBox: hopper `#8E5A30` (3,1,10,8); grain `#E9A23B` (4,2,8,5); spout `#6B5444` (6,9,4,3); tray `#B86F1C` (2,12,12,3)). The glyph spans x 2–13 and y 1–14 (12×14), so shift it by (−1, 0) to x 1–12, y 1–14. Use a throwaway encoder in the scratchpad, as Stories 4.5–4.7 did, and commit only the PNG. Check that it reads as a feeder at ×2 in the browser. If it doesn't, redraw it (4.7's hoe needed a redraw) and record the deviation.
  - [x] 4.3 `npm run assets` regenerates `public/assets/atlases/ui.{png,json}`. In `src/view/assetKeys.ts`, add `iconFeeder: 'icon-feeder'` with a comment ("The Auto-feeder's shop row (FR25, Story 4.8)"). In `assets/CREDITS.md`, add "Auto-feeder" to the placeholder row's shop icons list and `icon-feeder` to its `art/ui/{…}` list.
  - [x] 4.4 `src/view/hud/ShopPanel.ts`: add `autoFeeder: FRAME.iconFeeder` to `SHOP_ICON` (the `Record` type requires it). Update the invariant comment: "8 rows put the top at y 122, 9 at y 68" becomes "9 rows (since 4.8) put the top at y 68". `src/view/field/layout.ts`: in the `SHOP_PANEL_MAX_ROWS` doc, change "4.8's Auto-feeder" to "the Auto-feeder". Leave the value at 9.
  - [x] 4.5 `GameScene`'s `Bought` handler stays as it is: the Auto-feeder is neither Land nor a decoration, so the fence does not grow and nothing is placed. Do not add a field sprite or a HUD indicator (see Open Question 2).

- [x] **Task 5: Tests (AC 2–8)**. Use `newGame(seed)`, `applyCommand`, `runFor` and `fillFlock` from `tests/sim/helpers.ts`. Assert with `TUNING.autoFeederPrice`, `autoFeederIntervalMs`, `autoFeederDropPx`, `foodPieceFullness` and `TICK_MS`, never literals. Buy through `applyCommand({ type: 'Buy', item: 'autoFeeder' })` after setting `state.money`, except in pure selector tests.
  - [x] 5.0 **Expected breaks.** These are the only intended changes to existing tests:
    - `tests/sim/selectors.test.ts`: the `SHOP_ITEMS` list pin (it now ends `…'hoe2', 'autoFeeder'`).
    - The `selectShopView` row expectations (9 rows; pin the Auto-feeder row as `poor` on a new game).
    - The classification test "every shop item is exactly one of Land, a decoration or a Better Hoe": add a term `Number(item === 'autoFeeder')` and rename it "…a Better Hoe or the Auto-feeder". Do not add an exported predicate that nothing else uses.
  - [x] 5.1 `tests/sim/selectors.test.ts`: `shopPrice('autoFeeder') === TUNING.autoFeederPrice` and `shopRequires('autoFeeder') === null`. `buyBlock` returns `poor` with too little money, `null` with exactly the price, and `owned` after purchase.
  - [x] 5.2 `tests/sim/systems/economy.test.ts`: buying spends the price, pushes `'autoFeeder'`, emits `Bought { item: 'autoFeeder', price }`, and leaves `stats.moneyEarned` and `rng` untouched. A second Buy is refused.
  - [x] 5.3 New `tests/sim/systems/autoFeeder.test.ts`. Call `updateAutoFeeder` directly, setting `state.time` by hand, or use `runFor`:
    - Not owned: after `runFor(state, autoFeederIntervalMs * 3)` no piece was created by the feeder (compare against a twin game without it, piece count and `rng`).
    - Owned: exactly one `FoodDropped` per interval over 3 intervals, at the ticks where `time` is a multiple of the interval. Set the sheep's Fullness to `fullnessMax` with `seekBelowFullness` above, so no one eats and the pieces stay countable.
    - Cadence edge: a hand-set `time` that is not a multiple of `TICK_MS` (for example `interval − 50`) still fires once when the boundary is crossed.
    - Target: with Fullness values set by hand, the piece lies `autoFeederDropPx` (±1e-9) from the lowest-Fullness sheep. On a tie, the lower index wins. A `dragged` hungriest sheep is skipped in favour of the next hungriest.
    - Clamp: a target pinned in an inner-fence corner gets a piece inside `innerFence` (as `createFoodPiece` clamps).
    - No target (every sheep `dragged`): no piece and no rng draw.
    - Food only: `breedingPieces` and `farmProgress` are unchanged and no `Farmed` event is emitted.
    - Lost game: `step` on a state with `lostAt` set drops nothing.
  - [x] 5.4 `tests/sim/step.test.ts`: if it pins the system order or count (check it first), add `updateAutoFeeder` between overcrowding and eras.
  - [x] 5.5 New scenario `tests/sim/scenarios/autoFeeder.test.ts` (AC 7). Run it on fixed seeds; use the 3606 / 11 / 2026 set from `pacing.test.ts` if they pass.
    - Build each game with `newGame(seed)` and `fillFlock(state, n)`. Let the founding lamb grow up or not; it does not matter. Set `money`, buy the feeder, then `runFor(state, 300_000)` with no other commands.
    - **4 sheep with the feeder:** no `SheepDied { cause: 'starved' }`. **8 sheep with the feeder:** at least one. **4 sheep without it:** at least one (the control).
    - Nothing else interferes. No breeding pieces means no births and no Abomination. The founders are aged 60 s, so after 5 minutes they are 360 s old, below `elderFromMs`, and none dies of old age. 4/10 and 8/10 are below the 90% overcrowding threshold. Assert these preconditions (`state.sheep` contains no Abomination, `!isCrowded(state)`) so a retune that breaks them fails loudly, not silently.
    - If 4 sheep starve on a seed, **do not retune** TUNING to make the test pass. Find out why (claim order, a corner clamp), record it in the Dev Agent Record, and ask Rylan.
  - [x] 5.6 Save: in `tests/save/busy.ts`, add `'autoFeeder'` to `state.owned`. It draws no rng in the 1 s run, because `time` stays below 10 s. Update the fixture doc and check that `isBusy` still holds. In `tests/save/validate.test.ts`, `owned: ['autoFeeder']` is valid and `['autoFeeder', 'autoFeeder']` is rejected. In `tests/save/roundTrip.test.ts`, add a case: own the feeder, run to 5 s before a boundary, encode and decode, run both games 10 s, and expect the same `foodPieces` and `rng` (`toStrictEqual`).
  - [x] 5.7 Run the full suite. No seeded test outside the new ones should move. If one does, find out why before touching it.

- [x] **Task 6: Debug overlay (optional, DEV only)**
  - [x] 6.1 If it helps the browser check, add a `Feeder` readout to the sim readout ("owned · next drop in N s", derived as in the system). Add no button: "+$100" twice is enough to buy it. Skip this task if it adds no value, and say so in the Dev Agent Record.

- [x] **Task 7: Browser checks (AC 1, 2, 4, 5)** — `npm run dev`, then the DEV overlay's "+$100" twice
  - [x] 7.1 Open the shop. It shows 9 rows in mockup order, with Auto-feeder between Better Hoe II and Medicine: icon, "$120" and "Drops food every 10 s". The panel's top clears the Pause button. The icon reads as a feeder at ×2.
  - [x] 7.2 With less than $120 the row is grey. Buy it: the money rolls down by 120 and the row shows "Owned".
  - [x] 7.3 Watch 30 s with no clicking. Every 10 s a food piece bounces in beside the hungriest sheep (use "Starve one" to make an obvious target), and that sheep walks over and eats it. No "+1" popup appears over the Farm button.
  - [x] 7.4 Drag a sheep and hold it across a drop: the piece goes to another sheep, not to the held one.
  - [x] 7.5 At 960×540, the effect line is not clipped.
  - [x] 7.6 Save with the feeder, reload and Continue: the row still shows "Owned" and drops continue. Run `npm run build`: no DEV strings in `dist/`, and `icon-feeder` is in the built atlas.

- [x] **Task 8: Docs and tracking**
  - [x] 8.1 Record the design decision (Rylan, 2026-10-09) everywhere the redesign was marked "pending":
    - `epics.md`: in FR25 (line 56), replace the bracketed "redesign pending" note with "the food is free (decision 2026-10-09)". In Story 4.8, replace the "Redesign pending" note with the decision, and rewrite ACs 2–4 to match this file's AC 3, AC 4 and AC 7 (no food meter).
    - `gdds/.../gdd.md` Automation Systems (~line 276): replace the bracketed note with "The food is free: it makes its own pieces (decision 2026-10-09). There is no stock to draw from."
    - `gdds/.../epics.md` line 116: same change.
    - `gdds/.../decision-log.md`: add an entry "## 2026-10-09 · The Auto-feeder makes its own food (Rylan, Story 4.8)". It resolves the open item from 2026-10-06 and records: free food, 1 piece every 10 s next to the hungriest sheep (dragged sheep skipped), food pieces only, a clock derived from game time (no save field), and the 4-vs-8 scenario result.
  - [x] 8.2 `_bmad-output/game-architecture.md`: in the system table row "Auto-feeder | `src/sim/systems/autoFeeder.ts` | 10 s drop next to hungriest sheep" (~line 490), add "free food; clock derived from `time`, no state field (Story 4.8)". Add the Auto-feeder to the Economy & shop row next to the Story 4.7 note.
  - [x] 8.3 `deferred-work.md`: mark "More rows" fully resolved (9 rows, top y 68) and the classification note resolved. Add "Deferred from: story 4-8-auto-feeder":
    - **5.6:** a soft drop sound for feeder pieces, or none (the purchase sound on `Bought` is already deferred).
    - **5.8:** the placeholder feeder icon, and an optional feeder sprite in the pasture.
    - **5.10:** whether players notice it working, whether a free pile builds up with a small flock (Open Question 1), and whether the pacing bot should buy it.
    - **5.4:** no stat for feeder drops (FR36 has none).
  - [x] 8.4 `sprint-status.yaml`: set this story to `review` when it's done (create-story set it to `ready-for-dev`). Epic 4 then has every story done or in review; leave `epic-4` and the retrospective as they are for Rylan.

### Review Findings

- [x] [Review][Decision] The "hungriest" target may be a sheep that can't eat the piece — resolved by Rylan (2026-10-09): option 1, keep it as specified and note it in the decision log (now a patch below)
- [x] [Review][Patch] Note in the decision log that the hungriest sheep is targeted even when it can't eat now (`seekFood`, `eating`, `stalking`); the piece then goes to the nearest eligible sheep [_bmad-output/planning-artifacts/gdds/gdd-sheep-civilization-2026-10-05/decision-log.md]
- (original finding) The "hungriest" target may be a sheep that can't eat the piece — `hungriest()` skips only `dragged`, but feeding's `mayEatFood` also excludes `seekFood` (already walking to another piece), `eating` and `stalking` (the Abomination mid-visit). The piece then lands beside a sheep that walks past it and goes to the nearest eligible sheep or lies there (1 in 268 probe drops was beside a stalking Abomination). The spec chose "any non-dragged sheep" on purpose (Dev Notes), but a hungry-looking lamb ignoring food dropped beside it is a weak tell, though not unique to the Abomination. Options: keep as specified and note it in the decision log; or target only sheep that may claim food now (`wander`, `seekBreedingFood` or `seekCarcass`, below `seekBelowFullness`), falling back to any non-dragged sheep.
- [x] [Review][Patch] The decision log credits the scenario test with figures it does not measure (lowest Fullness, 5 sheep, death times came from the throwaway margin probe) [_bmad-output/planning-artifacts/gdds/gdd-sheep-civilization-2026-10-05/decision-log.md]
- [x] [Review][Patch] The 8-sheep assertion is vacuous (8 unfed sheep starve anyway); compare against 8 sheep without the feeder [tests/sim/scenarios/autoFeeder.test.ts:27]
- [x] [Review][Patch] The "4 sheep" are 3 adults and the founding lamb, and the comment says all are 60 s adults; age the lamb so AC 7's "4 adult sheep" holds [tests/sim/scenarios/autoFeeder.test.ts:15]
- [x] [Review][Patch] The "does nothing without the Auto-feeder" test calls the system at hand-set times and compares 3 fields; Task 5.3 asked for a `runFor` twin comparison [tests/sim/systems/autoFeeder.test.ts]
- [x] [Review][Patch] The "lost game" test empties the flock, so `hungriest` returns −1 whether or not `stepWith` stops on `lostAt`; set `lostAt` on a game that still has sheep [tests/sim/systems/autoFeeder.test.ts]
- [x] [Review][Patch] The corner-clamp test never asserts that any drop was actually clamped [tests/sim/systems/autoFeeder.test.ts]
- [x] [Review][Patch] The off-grid test hard-codes a 50 ms offset that assumes `TICK_MS` is 100; derive it from `TICK_MS` [tests/sim/systems/autoFeeder.test.ts]
- [x] [Review][Patch] The step-order test can pass by geometry; also assert the drop is not beside the sheep that died [tests/sim/systems/autoFeeder.test.ts]
- [x] [Review][Patch] The mid-cycle round-trip computes its run length from `busyGame`'s time and would go negative if that time mod 10 s ever passed 5 s [tests/save/roundTrip.test.ts]
- [x] [Review][Patch] `busyGame` owning the Auto-feeder makes the version-8–11 migration fixtures anachronistic and lets the feeder's pieces satisfy the 10-cycle test's `FoodEaten ≥ 5`; keep it out of the shared fixture and own it in the Auto-feeder round-trip only [tests/save/busy.ts:27]
- [x] [Review][Patch] The small-flock pile rate is wrong: a sheep with spare food eats every time it drops below 90, so 1 sheep piles up about 1.15 pieces/min (measured: 69 in 1 h), not about 5/min; 2–3 sheep build no pile. Correct deferred-work and the change log [_bmad-output/implementation-artifacts/deferred-work.md]
- [x] [Review][Patch] Task 7.3's "no +1 popup" browser check is not recorded in the Debug Log (the unit test shows no `Farmed` event) [_bmad-output/implementation-artifacts/4-8-auto-feeder.md]
- [x] [Review][Defer] Starving carcass-seekers are knocked off their carcass whenever any food piece exists, even one claimed by another sheep; the feeder makes this happen every 10 s [src/sim/systems/carcass.ts:106] — deferred, pre-existing

## Dev Notes

### What this story is (and is not)

- **Is:** one one-time shop item (`autoFeeder`), one new sim system on a derived 10 s clock that makes free food next to the hungriest sheep, three TUNING values, a shop row with a placeholder icon, tests (including the 4-vs-8 scenario), and doc updates that record the design decision.
- **Is not:** a food stock or hopper, any HUD meter or indicator for the feeder, a field sprite, a sound, a stat, a change to Farm, the breeding bar, the boost, Better Hoe, feeding's claim rules, the save schema, or the pacing bot.

### The design decision (Rylan, 2026-10-09)

At story creation Rylan chose **"Free food"** from four options: free food, move existing field food to the hungriest sheep, a hopper filled by Farm, and free food only when someone is Hungry. The Auto-feeder is the game's only passive food. It is limited by its rate: 3.5 Fullness/s against 0.83/s per sheep. At 25 sheep (about 21 Fullness/s needed) the player still hand-feeds most of the flock, as the GDD intends. It never replaces active play, because the hidden tab pauses everything, sheep age out at 9 minutes, and breeding still needs clicks.

### Current code to build on (read these first)

| File | Today | This story |
|---|---|---|
| `src/sim/step.ts` | `SYSTEMS` = movement, feeding, carcassEating, hunger, lifecycle, virus, abomination, overcrowding, eras; the comment already reserves "overcrowding → autoFeeder → eras" | register `updateAutoFeeder` |
| `src/sim/systems/overcrowding.ts` | Template for a timed system: a header comment in this style, a guard first, no allocation, rng drawn only when it acts | new `autoFeeder.ts` in the same shape |
| `src/sim/systems/feeding.ts` | `createFoodPiece(state, x, y)` clamps to `innerFence` and pushes; the claim model (oldest unclaimed piece → nearest eligible sheep → that sheep's nearest piece) | reuse `createFoodPiece`; **do not** touch the claims |
| `src/sim/commands.ts:80–100` | `farm()` drops a piece with `rngRange` and emits `FoodDropped` and then `Farmed` | the feeder emits `FoodDropped` only |
| `src/sim/selectors.ts:120–200` | `SHOP_ITEMS` (7), `SHOP_ROWS = [...SHOP_ITEMS, 'medicine']`, `shopPrice` (switch + `assertNever`), `shopRequires`, `isOwned`, `buyBlock`, `selectShopView` | append `autoFeeder`; add its price |
| `src/sim/state.ts:120–125` | `ShopItemId` (7 ids); `owned: ShopItemId[]` | add the id |
| `src/sim/systems/economy.ts` | `buy()`: `buyBlock`, spend, then the medicine count or `owned.push`, then `Bought` | comment only |
| `src/save/validate.ts` | `owned` must be known `SHOP_ITEMS`, with no repeats and in prerequisite order | **no change** |
| `src/view/strings.ts:29–80` | `landEffect`, `hoeEffect`, `SHOP_NAME`/`SHOP_EFFECT` (`Record<ShopRowId, string>`) | name and effect |
| `src/view/hud/ShopPanel.ts` | `SHOP_ICON` record; panel geometry from `layout.ts`; DEV invariants (≤ `SHOP_PANEL_MAX_ROWS` = 9, top ≥ Pause + 8) | icon entry, comment |
| `src/view/assetKeys.ts:78–90` | shop icon frames | `iconFeeder` |
| `src/view/scenes/GameScene.ts:256–257` | `Bought` handler: Land grows the fence, a decoration pops in; anything else is ignored | **no change** |
| `src/debug/DebugOverlay.ts` | "+$100", "Starve one", "Feed all" and the sim readout | optional readout |

### What must be preserved

- **Determinism without the feeder.** `updateAutoFeeder` returns before any rng draw or allocation unless `'autoFeeder'` is owned. Every existing seeded test, `busyGame`'s rng path (the 1 s run is below the first boundary), and the pacing probe stay byte-identical.
- **Feeding's claim rules.** The feeder only places a piece. It never sets `activity` or `targetId` on a sheep, and it never moves or removes an existing piece.
- **Food first, breeding food separate.** No breeding piece is created or read. `farmProgress`, `breedingProgress` and `Farmed` are untouched. The breeding bar is never boosted or automated (FR8).
- **Secrecy.** The system reads only `fullness`, `activity`, `x` and `y`, never `isAbomination`, `stalk` or `doomedAt`. Picking the Abomination as the hungriest is fine: it is a lamb that eats normally (FR30).
- **One purchase rule.** No feeder-specific checks in `buy()` or the panel. `buyBlock` decides.
- **Save compatibility.** No schema bump. Old saves cannot own the feeder, and new ones round-trip it through `owned`.
- **Hot path.** One `includes` on at most 8 strings per tick when not owned. When owned, two `Math.floor` calls per tick and a linear scan for the target once every 10 s. No allocation except the piece and the `innerFence` rect inside `createFoodPiece`, once per drop.

### Design decisions (defaults chosen; see Open Questions)

- **A derived clock instead of a state deadline.** The project rule is "timers are absolute game-ms deadlines in state, never countdown fields". A boundary crossing of `state.time` is neither a countdown nor stored. It is derived the way stage is derived from `bornAt`, so there is no new field, no migration and no ripple through the `toVersionN` save fixtures. The cost is that the first drop comes 0–10 s after purchase instead of exactly 10 s. Overcrowding (4.6) used a field because its clock is unconditional; this one only runs while owned. If review prefers a field, the fallback is `nextAutoFeedAt` with schema 13 and a migration in the 4.6 pattern.
- **Hungriest = lowest `fullness`, any non-dragged sheep.** This includes sheep already seeking or eating food. It is the simplest reading of "the hungriest sheep", and feeding's claim model sorts out who actually eats.
- **"Next to" = `autoFeederDropPx` (28) at a random angle.** The piece lands beside the sheep (visible, one short step away) and is clamped into the pen. The angle comes from the seeded rng, so a save or reload repeats it.
- **Always drops while owned** (GDD: "every 10 s"), even when every sheep is above `seekBelowFullness`. See Open Question 1.
- **Reuse `FoodDropped`.** The view needs no change, because pieces bounce in on bind in `EntityLayer`. No popup, sound or new event.

### Architecture compliance

- New rule → `src/sim/systems/autoFeeder.ts` exporting `updateAutoFeeder(state)`, registered in `step.ts` in the documented order. Systems don't call each other: it uses the `createFoodPiece` helper that feeding owns, as `farm()` does.
- New tunables → `TUNING`. Copy → `strings.ts`. Icon → `assetKeys.ts` and the `ui` atlas via `npm run assets`.
- Pure sim: no Phaser, DOM, `Math.random` or `Date.now`. The angle comes from `rngRange`.
- Ownership is derived from `owned` and nothing is stored (pattern N4).

### Library / framework notes

- Phaser **4.2.1**, TypeScript 6, Vitest 4.1. No new API and no new package: the row reuses existing `Text`/`Image` calls and the piece reuses `FoodSprite`. No web research is needed.

### Testing standards

- Vitest covers `src/sim/` and `src/save/` only. The row, icon and bounce are checked in the browser.
- Use TUNING values in assertions, fixed literal seeds and `runFor` in `TICK_MS` steps. No fake timers and no `Math.random`.
- Pair each "with feeder" test with a "without" case, so a test can't pass vacuously (lesson from 4.2, 4.4, 4.5, 4.6 and 4.7).
- The save tests are mandatory and must stay green.

### Previous story intelligence (4.7 and earlier)

- **4.7 (Better Hoe):** made the shop panel fit 9 rows ahead of time (top y 68), so 4.8 needs no layout work. It added the "every shop item is classified" test, which 4.8 must extend. The hoe icon drawn from the mockup glyph read as a flag at ×2 and had to be redrawn, so check the feeder icon in the browser early. The atlas gives each frame a `pivot`. `Button.setIcon` handles that for the Farm button, but shop rows use a plain `Image` and are unaffected. Review lessons: record every deviation from the task text in the Dev Agent Record, pin expectations to literals or TUNING (not to values computed from the state under test), and update every deferred-work entry the story names.
- **4.6 (Overcrowding):** the template for a timed system, with an rng draw only when it acts and the clock comment. Its review caught float edges in threshold math (relevant here: compare the boundary crossing with integer `Math.floor`, not a modulo on non-multiples), step tests that didn't prove the effect, and missing order tests.
- **4.5 (Medicine):** `ShopRowId`/`SHOP_ROWS`, and the icon workflow (throwaway scratchpad encoder, commit only the PNG, `npm run assets`, a CREDITS placeholder row).
- **3.6 (Pacing):** the probe proposes and Rylan decides. Never retune to make a test pass.
- **1.7 / 2.2 (sprint changes 2026-10-06):** no food stock. Breeding pieces never count as food, and the Auto-feeder ignores them.
- Pattern from every story: the code, the story file, `deferred-work.md` and `sprint-status.yaml` go in one "Implement story 4.8: Auto-feeder" commit. Review fixes go in a separate commit.

### Git intelligence

- Recent commits: `aac2c3f` 4.7 Better Hoe (`hoe1`/`hoe2`, `hoeTier`, 9-row panel geometry in `layout.ts`, `Button.setIcon`, the icons), `6e910c6` 4.6 Overcrowding (schema 11 → 12, `overcrowding.ts`, `icon-crowd`), `2ea66de` 4.5 Medicine, `8e0283a` 4.4, `4a25830` 4.3.
- Work is on the `story-4.8` branch from `main` at `aac2c3f`.

### Open questions (defaults chosen; confirm or change)

1. **A free pile with a small flock.** With fewer than 4 sheep, the feeder makes more food than they eat, and the pieces never spoil, so a pile slowly builds (about 5 pieces/min with 1 sheep). Default: allow it (GDD: "every 10 s"; the 300-piece pile is already benchmarked within budget). Alternative: skip a drop while no sheep is below `seekBelowFullness`, which is one extra check and still free food.
2. **No feeder visual in the pasture or HUD.** Default: none. The shop row's "Owned" and the bouncing pieces are the feedback, and neither the UX spec nor the GDD has one. A feeder sprite next to the fence is deferred to 5.8.
3. **Clock: derived vs a state field.** Default: derived (no schema bump, first drop 0–10 s after purchase). Alternative: `nextAutoFeedAt` (schema 13, first drop exactly 10 s after purchase).
4. **Pacing bot.** Default: the bot does not buy the feeder, so the existing guards keep their meaning. Whether it helps Town is a 5.10 question.

### Project Structure Notes

- New: `src/sim/systems/autoFeeder.ts`, `assets/art/ui/icon-feeder.png`, `tests/sim/systems/autoFeeder.test.ts`, `tests/sim/scenarios/autoFeeder.test.ts`.
- Modified: `src/config/tuning.ts`, `src/sim/{state,selectors,step,events}.ts` (events: comment only), `src/sim/systems/economy.ts` (comment), `src/view/strings.ts`, `src/view/assetKeys.ts`, `src/view/hud/ShopPanel.ts`, `src/view/field/layout.ts` (comment), `assets/CREDITS.md`, `public/assets/atlases/ui.{png,json}` (regenerated), tests under `tests/config/`, `tests/sim/` and `tests/save/`, the planning docs in Task 8.1, `_bmad-output/game-architecture.md`, `deferred-work.md` and `sprint-status.yaml`. Optionally `src/debug/DebugOverlay.ts`.
- This matches the architecture's planned layout (`game-architecture.md` line 441 lists `autoFeeder.ts` under `sim/systems/`).

### Project Context Rules

- Phaser 4 APIs only, and no new npm packages.
- `src/sim/` stays pure: no Phaser, DOM, `Math.random` or `Date.now`. The view reads selectors and dispatches commands and never mutates `GameState`.
- New tunable → `TUNING`. New copy → `strings.ts` (no "!", never "kill", "corpse" or "blood"). Colours come from `COLORS`/`COMPONENTS` tokens.
- No confirmation on shop purchases (UX-DR68).
- Any `GameState` field change needs a schema bump and a migration. None is needed here: the clock is derived and `owned` already exists.
- No allocation in hot paths (`step()` and systems), except on events such as creating a piece.
- `switch` over ids keeps its `assertNever` default.
- Tests go in `tests/<same path>` and use fixed seeds, `runFor` in `TICK_MS` steps, TUNING in assertions and no fake timers.
- Done = `npm test`, `npm run typecheck` and `npm run lint` green, with rendering checked in the browser.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 4.8: Auto-feeder] ACs, the redesign note; FR25 (line 56); FR5, FR8, FR21; UX-DR23, UX-DR24, UX-DR68
- [Source: _bmad-output/planning-artifacts/gdds/gdd-sheep-civilization-2026-10-05/gdd.md#Automation Systems] lines 273–282: "Drops 1 food piece next to the hungriest sheep every 10 s", "+3.5 Fullness/s sustains about 4 sheep", "at 25 or more sheep, the player still hand-feeds most of the flock", "Only one can be bought"; line 247 "Auto-click: none"; Upgrade Trees line 266
- [Source: _bmad-output/planning-artifacts/gdds/gdd-sheep-civilization-2026-10-05/decision-log.md] line 31 (auto-feeder $120, 1 piece/10 s, about 4 sheep); line 74 (open: what feeds it); line 80 (breeding pieces never count as food)
- [Source: _bmad-output/planning-artifacts/sprint-change-proposal-2026-10-06.md] R2 (Farm pieces land at random, not by the hungriest sheep, so farming does not do the feeder's job); line 291 open item
- [Source: _bmad-output/planning-artifacts/sprint-change-proposal-2026-10-06-breeding-food.md] line 45 (the auto-feeder ignores breeding pieces)
- [Source: _bmad-output/planning-artifacts/briefs/brief-sheep-civilization-2026-10-05/brief.md] line 44 (automation helps; walking away is never viable)
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-sheep-civilization-2026-10-05/mockups/hud.html] `g-feeder` glyph (line 137); row "Auto-feeder · $120 · Drops food every 10 s"; row order
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-sheep-civilization-2026-10-05/EXPERIENCE.md] line 39 (shop contents), line 97 (one-time items show "Owned")
- [Source: _bmad-output/game-architecture.md] line 441 (`autoFeeder.ts`), line 490 (system table)
- [Source: _bmad-output/implementation-artifacts/4-7-better-hoe-upgrades.md] 9-row panel, classification test, icon workflow, review lessons
- [Source: _bmad-output/implementation-artifacts/deferred-work.md] "More rows" (4.7 resolution: y 68, classify the Auto-feeder)
- [Source: _bmad-output/project-context.md] all rules above

## Change Log

- 2026-10-09: Code review (Blind Hunter, Edge Case Hunter, Acceptance Auditor): 1 decision (Rylan: keep the hungriest-sheep target as specified, noted in the decision log), 13 patches applied (stronger scenario and unit tests, `SYSTEMS` exported for the twin test, the Auto-feeder kept out of the shared save fixture, the decision log's measured figures attributed to the probe, the small-flock pile rate corrected from about 5/min to about 1/min), 1 deferred (carcass seekers released by any food piece, pre-existing), 4 dismissed. Status → done.
- 2026-10-09: Implemented (dev-story). The Auto-feeder in the shop (9th row, placeholder icon), `autoFeeder.ts` on a clock derived from game time (free food next to the hungriest sheep, no schema bump), tests (unit, the 4-vs-8 scenario, save), and the decision recorded in the planning docs. Status → review.
- 2026-10-09: Story created. Rylan chose "Free food" for the pending redesign (the Auto-feeder makes its own pieces; there is no stock).

## Dev Agent Record

### Agent Model Used

Claude Opus 5.5 (claude-opus-5-5[1m])

### Debug Log References

- `npm test`: 63 files, 848 passed, 1 skipped (the Town pacing guard, skipped since 4.1). `npm run typecheck` and `npm run lint` are clean. `npm run build` passes (only the existing chunk-size warning); no DEV strings in `dist/`; `icon-feeder` is in the built atlas.
- Margin probe (throwaway, seeds 3606/11/2026, 5 min, no commands): 4 sheep never starve (lowest Fullness after the first minute: 19.8 / 14.7 / 18.2); 5 sheep lose one at 156 / 156 / 198 s; 6 lose one or two from 72–114 s; 8 lose two by 72 s.
- Browser (scratchpad Playwright probe on the DEV server, GameScene captured by patching its prototype, drops observed through the bus, no source change), at 1280×720 and 960×540: 9 rows in mockup order, the Auto-feeder 8th with "$120" and "Drops food every 10 s", greyed at $0; the panel top is at y 68, clear of Pause; the 14×14 icon is drawn at ×2 and reads as a hopper on a tray; the effect line is not clipped at 960×540. A real click bought it ($200 → $80, "Owned"). The first drop came at 10 s, exactly 28 px from the hungriest sheep, which walked over and ate it (20 → 45 Fullness); the Farm bar was untouched. Holding the hungriest sheep in a drag across a drop sent the piece to the next hungriest (28 px). After save, reload and Continue, it was still owned and drops continued. No console errors. One probe check failed by its own design (it expected two drops in a 12 s window that covers only one); the drop it saw was correct.

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created
- **Sim:** `ShopItemId`/`SHOP_ITEMS` gain `'autoFeeder'` (after `hoe2`, so before Medicine); `shopPrice` reads `TUNING.autoFeederPrice` (120); no prerequisite. New `systems/autoFeeder.ts` `updateAutoFeeder`: returns unless owned; fires on the tick whose `time` crosses a multiple of `autoFeederIntervalMs` (`Math.floor` comparison, so a saved time off the tick grid still fires once); targets the lowest-Fullness non-dragged sheep (ties to the lower index); one `rngRange` draw for the angle; `createFoodPiece` at `autoFeederDropPx` (28), clamped into the pen; emits `FoodDropped`. Registered in `step.ts` after overcrowding, before eras. `buy()`, feeding, Farm and the save code are unchanged; there is no new GameState field, so `SAVE_SCHEMA_VERSION` stays 12.
- **View:** `SHOP_NAME`/`SHOP_EFFECT` ("Drops food every 10 s", built from TUNING), `FRAME.iconFeeder`, `SHOP_ICON.autoFeeder`; comments in `ShopPanel` and `layout.ts`. No change to `GameScene` (the `Bought` handler ignores it; the piece bounces in on bind like any food piece).
- **Tests:** tuning (whole-tick interval, drop beyond eat reach, sustains 4–5 sheep); selectors (list, price, no prerequisite, `buyBlock` poor → buyable → owned, the 9th `selectShopView` row, classification); economy (buy once, `Bought`, earnings and rng untouched); `tests/sim/systems/autoFeeder.test.ts` (12 cases: none without it, one per interval, an off-grid time, target and distance, a tie, a dragged sheep skipped, everyone dragged means no draw, corner clamp, food only, a lost game, a sheep that dies on the boundary tick is not the target, feeding eats the piece); `tests/sim/scenarios/autoFeeder.test.ts` (AC 7 on 3 seeds with the preconditions asserted); save (valid and duplicate `owned`, `busyGame` owns it, a mid-cycle reload gives the same drops and rng).
- **Pre-existing tests changed:** in `selectors.test.ts`, the `SHOP_ITEMS` pin, the `selectShopView` rows (plus a guard that $40 cannot buy the feeder) and the classification test, all expected by Task 5.0. `tests/save/busy.ts` now owns the Auto-feeder (Task 5.6). No seeded outcome moved.
- **Deviations from the task text:** (1) Task 4.2 said shift the glyph by (−1, 0) to y 1–14, but a 14-px canvas holds rows 0–13, so the glyph was shifted by (−1, −1) (x 1–12, y 0–13), pixel-exact otherwise; the first draft read well at ×2, so no redraw. (2) The cadence unit test keeps every sheep full each tick, so no piece is eaten before it is counted (sheep that start full drop below 90 within the 30 s run). (3) Task 6 (the optional DEV readout) was skipped: the drops are easy to see in the field and the probe read them from the bus. (4) Task 5.4: `step.test.ts` does not pin the system order, so it needed no change; the order is covered by the "dies on the boundary tick" case in the system test.
- **Docs:** the decision is recorded in `epics.md` (FR25, the 4.8 note and ACs), the GDD's Automation Systems, the GDD epic list, the decision log (new 2026-10-09 entry with the measured margin), `game-architecture.md` (system and economy rows) and `deferred-work.md` ("More rows" resolved; a new 4.8 section for 5.4, 5.6, 5.8 and 5.10).
- **Code review patches (2026-10-09):** the scenario now uses 4 adults (the founding lamb is aged like the others) and checks that 8 sheep with the feeder lose fewer than 8 without it. The "not owned" test compares a full `runFor` against a twin stepped with `stepWith(SYSTEMS minus the feeder)`, so `step.ts` now exports `SYSTEMS` (frozen, documented as for tests). The lost-game test sets `lostAt` on a game that still has a hungry sheep, with a twin proving a drop would happen otherwise. The clamp test asserts that at least one drop was clamped, the off-grid offset is `TICK_MS / 2`, and the step-order test checks that the dying sheep stands far away and the drop is not beside it. `tests/save/busy.ts` is back to its 4.7 contents (a deviation from Task 5.6): owning the feeder there made the version-8–11 migration fixtures anachronistic, so the Auto-feeder round-trip owns it itself and runs to exactly half an interval before a drop. The decision log now separates what the test guards from the probe's measurements, and records the target choice. Deferred-work's small-flock pile rate is corrected: a sheep with spare food eats every time it drops below 90, so 1 sheep piles up about 1 piece a minute (69 in an hour, Edge Case Hunter's probe), not 5, and 2–3 sheep build none. Open Question 1's "about 5 pieces/min" above is superseded by this.
- **Task 7.3 "+1 popup":** the browser probe did not check for the popup directly. `HudScene` spawns it only on `Farmed { resource: 'food', added > 0 }` (`HudScene.ts:328`), and the unit test "makes food only" shows the feeder emits only `FoodDropped`, so no popup can come from a feeder drop.
- **Red/green:** each task's tests were written first and seen failing (tuning: 2 failed; shop: 5 failed; system: module missing), then the code made them pass.

### File List

- `_bmad-output/game-architecture.md` (modified)
- `_bmad-output/implementation-artifacts/4-8-auto-feeder.md` (new)
- `_bmad-output/implementation-artifacts/deferred-work.md` (modified)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modified)
- `_bmad-output/planning-artifacts/epics.md` (modified)
- `_bmad-output/planning-artifacts/gdds/gdd-sheep-civilization-2026-10-05/decision-log.md` (modified)
- `_bmad-output/planning-artifacts/gdds/gdd-sheep-civilization-2026-10-05/epics.md` (modified)
- `_bmad-output/planning-artifacts/gdds/gdd-sheep-civilization-2026-10-05/gdd.md` (modified)
- `assets/CREDITS.md` (modified)
- `assets/art/ui/icon-feeder.png` (new)
- `public/assets/atlases/ui.json` (regenerated)
- `public/assets/atlases/ui.png` (regenerated)
- `src/config/tuning.ts`
- `src/sim/events.ts` (comment)
- `src/sim/selectors.ts`
- `src/sim/state.ts`
- `src/sim/step.ts`
- `src/sim/systems/autoFeeder.ts` (new)
- `src/sim/systems/economy.ts` (comment)
- `src/view/assetKeys.ts`
- `src/view/field/layout.ts` (comment)
- `src/view/hud/ShopPanel.ts`
- `src/view/strings.ts`
- `tests/config/tuning.test.ts`
- `tests/save/roundTrip.test.ts`
- `tests/save/validate.test.ts`
- `tests/sim/scenarios/autoFeeder.test.ts` (new)
- `tests/sim/selectors.test.ts`
- `tests/sim/systems/autoFeeder.test.ts` (new)
- `tests/sim/systems/economy.test.ts`
