---
baseline_commit: 6e910c6
---

# Story 4.7: Better Hoe Upgrades

Status: done

<!-- Created 2026-10-09 by create-story. Seventh story of Epic 4 (Should tier). Two one-time shop items, Better Hoe I ($30) and Better Hoe II ($100, needs I), raise the pips one Farm click fills from 1 to 2, then 3 (FR24); the sacrifice boost doubles whatever the base is (4 / 6). Most of the hooks already exist: `farm()` (commands.ts) reads `farmPipsPerClick(state)` (selectors.ts), whose doc says "Better Hoe (4.7) raises the base here"; the shop is data-driven (`SHOP_ITEMS`, `shopPrice`, `shopRequires`, `buyBlock`, `STRINGS.shopName/shopEffect`, `SHOP_ICON`), and save validation already checks `owned` against `SHOP_ITEMS` and `shopRequires`. New: two `ShopItemId`s, two TUNING tables, a hoe tier in the selector, two shop rows with a hoe icon, tests, and the pacing re-check that deferred-work.md assigns to this story. No new GameState field, so no schema bump. Key risks: (1) the shop panel grows 2 rows (60 px each); 8 rows put its top at y 74, which still clears the Pause button (needs ≥ 64), but 4.8's 9th row will not fit; (2) the pacing re-check may not bring Town back into 10–15 min, and the skipped guard must stay skipped with the reason recorded rather than be weakened. -->

## Story

As a player,
I want to buy better hoes that increase food per Farm click,
so that I can keep up with a growing flock.

## Acceptance Criteria

1. **Two shop rows (FR24, UX-DR23, UX-DR24, GDD Upgrade Trees).** The shop panel shows **Better Hoe I** and **Better Hoe II** after the Scarecrow and before Medicine (mockups/hud.html order: Land I–III, Flower Patch, Scarecrow, Better Hoe I, Better Hoe II, [Auto-feeder in 4.8], Medicine). Each row has the hoe icon, the name, the price ("$30" / "$100" from TUNING), and an effect line built from TUNING: "Farm click fills 2 pips" / "Farm click fills 3 pips" (GDD: "Farm click fills 2 / 3 pips"; the mockup's "+2" / "+3" text predates the 2026-10-06 change and is **not** used).
2. **Buying (FR21, FR24, UX-DR24, UX-DR68).** Both are one-time items stored in `state.owned`. A click with enough money buys at once with no confirmation: money drops by the price, the row shows "Owned", `Bought { item, price }` is emitted. Better Hoe II needs Better Hoe I: until I is owned, II is **locked** and its effect line reads "Needs Better Hoe I" (greyed), and a `Buy { item: 'hoe2' }` does nothing. Unaffordable rows are greyed (`poor`). Owned wins over locked, locked over poor (the existing `buyBlock` order).
3. **The click value (FR3, FR24).** One Farm click (button or `F`) fills 1 pip with no hoe, **2** with Better Hoe I, **3** with Better Hoe II (`TUNING.hoePipsPerClick`). Leftover pips carry into the next bar as today; a full bar still drops one food piece and the "+1" popup. Owning II means 3 whether or not I's effect is counted (the tiers replace, never add).
4. **With the boost (FR19).** While a sacrifice boost runs, a Farm click fills `base × boostPipMultiplier`: **2 / 4 / 6** pips for no hoe / I / II. A lost game is never boosted (unchanged).
5. **Unchanged.** The Farm button's tooltip stays "Farm: fill the bar for 1 food (F)" (sprint change 2026-10-06, R4). The breeding bar still fills `TUNING.breedingPipsPerClick` (1) pip per Farm Breeding Food click, with any hoe and with the boost. The Farm bar and the boost glow/badge look the same.
10. **The hoe on the HUD (Rylan, 2026-10-09, Open Question 4).** Once a hoe is owned, the Farm button shows its icon left of the "Farm" label (as the Breed tool shows its heart): the Better Hoe I icon with I, an upgraded Better Hoe II icon with II. No icon without a hoe. It changes only when the tier changes (no per-frame work), stays clear of the key hint and the boost badge, and the shop rows use the same two icons.
6. **Save.** `owned` may hold `'hoe1'` and `'hoe2'`; validation accepts them (via `SHOP_ITEMS`), rejects `'hoe2'` before or without `'hoe1'` (via `shopRequires`), and a save with both round-trips. No new `GameState` field, so `SAVE_SCHEMA_VERSION` stays 12 and there is no migration.
7. **Shop panel fits, with room for 4.8 (Rylan, 2026-10-09, Open Question 3).** The panel holds **9** rows (today's 8 plus 4.8's Auto-feeder) with its top at or below the Pause button's bottom + 8 px (y 64). The geometry moves to `layout.ts` so a Vitest test checks 9 rows; the DEV invariant stays. Rows shrink from 56 to 50 px (gap 4), a deliberate deviation from DESIGN.md's 56 px `shop-item-row`; both text lines still fit, at 1280×720 and 960×540.
8. **Pacing re-check (deferred-work.md "Town needs fast clicking", "The Town pacing guard is skipped", "The pacing bot cannot survive the Abomination").** `tests/sim/scenarios/pacing.test.ts` gains a hoe-buying policy and reports the milestone table with and without it. If the skipped Town guard passes on all its seeds with the hoe policy at an honest rate, re-enable it; otherwise keep it skipped, update its comment with the new numbers, and record them in deferred-work.md for Rylan (see Open Question 2). Never loosen the 10–15 min window to make it pass.
9. **Done = `npm test`, `npm run typecheck` and `npm run lint` all pass**, and the browser checks in Task 7 pass.

## Tasks / Subtasks

- [x] **Task 1: Tuning (AC 1, 3)**
  - [x] 1.1 `src/config/tuning.ts`, after `medicinePrice` (the shop-price block): `hoePrices: Object.freeze([30, 100] as const)` with a comment in the file's style: `// FR24 / GDD Upgrade Trees (Should tier): "Better Hoe I / II | Click power | $30 / $100". II needs I (selectors.ts shopRequires). Story 4.7.`
  - [x] 1.2 Next to `farmPipsPerClick` / `boostPipMultiplier`: `hoePipsPerClick: Object.freeze([2, 3] as const)` with a comment: `// FR24 / GDD Click value progression: Better Hoe I / II make a Farm click fill 2 / 3 pips (replacing farmPipsPerClick, not adding to it); the boost doubles them (4 / 6). Farm (food) only, never the breeding bar.` Update the `farmPipsPerFood` comment's "Better Hoe (4.7) raises…" to the present tense, pointing at `selectors.ts farmPipsPerClick`.
  - [x] 1.3 `tests/config/tuning.test.ts`: if it pins table shapes (it checks `landPrices.length`), add `hoePrices.length === hoePipsPerClick.length === 2` and that the pips rise (`farmPipsPerClick < hoePipsPerClick[0] < hoePipsPerClick[1]`).

- [x] **Task 2: Shop items and the click value (AC 1–4, 6)**
  - [x] 2.1 `src/sim/state.ts`: `export type ShopItemId = 'land1' | 'land2' | 'land3' | 'flowerPatch' | 'scarecrow' | 'hoe1' | 'hoe2';`. Update its doc: "Epic 4 appends 'hoe1' | 'hoe2' (4.7) and 'autoFeeder' (4.8)" → Better Hoe I/II added in 4.7; 4.8 appends `'autoFeeder'`.
  - [x] 2.2 `src/sim/selectors.ts`:
    - `SHOP_ITEMS`: append `'hoe1', 'hoe2'` after `'scarecrow'` (display order = mockup). Update the `SHOP_ITEMS` / `SHOP_ROWS` docs ("4.7/4.8 add…" → 4.7 added Better Hoe; 4.8 adds the Auto-feeder before Medicine).
    - `shopPrice`: `case 'hoe1': return TUNING.hoePrices[0]; case 'hoe2': return TUNING.hoePrices[1];` (the `assertNever` default forces this).
    - `shopRequires`: `if (item === 'hoe2') return 'hoe1';`. Update its doc: the GDD says "each Land tier needs the previous one"; Better Hoe II needs I (epics 4.7 AC: "requires I").
    - `farmPipsPerClick(state)`: base = `TUNING.hoePipsPerClick[1]` if `isOwned(state, 'hoe2')`, else `TUNING.hoePipsPerClick[0]` if `isOwned(state, 'hoe1')`, else `TUNING.farmPipsPerClick`; return `base * (isBoosted(state) ? TUNING.boostPipMultiplier : 1)`. Check II first so a (hand-built) state with II but not I still gets 3. Keep it allocation-free (`includes` on ≤ 8 strings is fine; it runs once per click). Rewrite its doc in the present tense: FR3, FR19, FR24; the breeding bar never uses it (FR8).
    - `isOwned` is declared below `shopRequires`; `farmPipsPerClick` is further down, so no ordering issue.
  - [x] 2.3 `src/sim/systems/economy.ts`: header comment "Better Hoe (4.7)" → "Better Hoe (selectors.ts farmPipsPerClick, Story 4.7)". `buy()` needs **no** change: `buyBlock` already handles owned/locked/poor and `owned.push` records the hoe.
  - [x] 2.4 `src/sim/commands.ts`: the `farm()` doc says "Better Hoe (4.7) raises the base" — present tense; `farmBreeding()` doc already says Better Hoe never applies. **No logic change** in either: `farm()` already loops `while (farmProgress >= farmPipsPerFood)`, so 6 pips on a 5-pip bar drops one piece and keeps 5.
  - [x] 2.5 Save: **no change** to `migrations.ts`, `normalize.ts`, `SAVE_SCHEMA_VERSION`. `validate.ts` checks `owned` against `SHOP_ITEMS` and orders each item after `shopRequires(item)`, so `'hoe1'`/`'hoe2'` are accepted and `['hoe2', 'hoe1']` / `['hoe2']` are rejected automatically. Read lines 98–108 to confirm, and add tests (Task 5.5).

- [x] **Task 3: Strings (AC 1, 2, 5)**
  - [x] 3.1 `src/view/strings.ts`: add a helper in the `landEffect` style, built from TUNING so a retune keeps it true: `/** "Farm click fills 2 pips": what Better Hoe tier `tier` (1–2) does to a Farm click (FR24). */ function hoeEffect(tier: 1 | 2): string { return \`Farm click fills ${TUNING.hoePipsPerClick[tier - 1]} pips\`; }`.
  - [x] 3.2 `SHOP_NAME`: `hoe1: 'Better Hoe I'`, `hoe2: 'Better Hoe II'`. `SHOP_EFFECT`: `hoe1: hoeEffect(1)`, `hoe2: hoeEffect(2)`, with a comment citing GDD Upgrade Trees ("Farm click fills 2 / 3 pips"; the mockup's "Farm click +2" is the pre-2026-10-06 wording). The locked line comes from the existing `shopNeeds(shopName['hoe1'])` → "Needs Better Hoe I" (no new string).
  - [x] 3.3 Leave `farmTooltip` and its comment ("does not depend on Better Hoe") as they are.

- [x] **Task 4: The hoe icon and the rows (AC 1, 7)**
  - [x] 4.1 Art: `assets/art/ui/icon-hoe.png`, **14×14** like `icon-land.png` / `icon-scarecrow.png` (shown at ×2 in the 28 px slot), from the mockup's `g-hoe` glyph (`mockups/hud.html` line 133, 16×16 viewBox: handle `#8E5A30` at (3,2,2,13); blade `#6B5444` at (5,2,7,3); blade tip `#6B5444` at (10,5,2,2)). The glyph's bounding box is x 3–11, y 2–14 (9×13): shift every rect by (−1, −1) so it sits at x 2–10, y 1–13 of the 14×14 canvas, pixel-exact. Same throwaway scratchpad encoder approach as 4.5 Task 4.1 / 4.6 Task 4.1; commit only the PNG. Both hoe rows share it (as Land I–III share `icon-land`).
  - [x] 4.2 `npm run assets` → regenerate `public/assets/atlases/ui.{png,json}`. `src/view/assetKeys.ts`: `iconHoe: 'icon-hoe'` under the shop-row icons comment ("Land I–III share one; Better Hoe I–II share one"). Add `icon-hoe.png` to the placeholder row of `assets/CREDITS.md` (as 4.5/4.6 did).
  - [x] 4.3 `src/view/hud/ShopPanel.ts`: `SHOP_ICON` gains `hoe1: FRAME.iconHoe, hoe2: FRAME.iconHoe2` (the `Record<ShopRowId, …>` type forces it); update its comment.
  - [x] 4.3a **(Rylan, OQ 3)** Panel height: move the panel geometry (header, row height, gap, `shopPanelHeight(rows)`, `shopPanelTop(rows)`, the Pause clearance) into `src/view/field/layout.ts` next to `SHOP_PANEL_X/W`; `ShopPanel` reads it. Rows 56 → 50 px (`COMPONENTS.shopItemRow.height`, with a comment on the DESIGN.md deviation), gap 4, text lines re-centred. `SHOP_PANEL_MAX_ROWS = 9` (8 + 4.8's Auto-feeder). Test in `tests/view/field/layout.test.ts`: `shopPanelTop(SHOP_PANEL_MAX_ROWS) ≥ safeMargin + buttonPause.height + SPACING[2]`, and `SHOP_ROWS.length ≤ SHOP_PANEL_MAX_ROWS`. Keep the DEV invariant on the live row count.
  - [x] 4.3b Art: `assets/art/ui/icon-hoe-2.png`, 14×14, Better Hoe II: the same hoe with a bigger steel blade (`wool` fill, `bark` outline) so it reads on the `hay` Farm button and differs from tier I in shape, not only colour. `FRAME.iconHoe2: 'icon-hoe-2'`; CREDITS placeholder row; `npm run assets`.
  - [x] 4.4 `FarmProgress`, `FarmBoost` and `HudScene`'s "+N" popup are unchanged (one click can complete at most one bar: ≤ 5 leftover + 6 pips < 12).
  - [x] 4.5 **(Rylan, OQ 4)** The hoe on the Farm button (AC 10): `selectors.ts` `hoeTier(state): 0 | 1 | 2` (II first), used by `farmPipsPerClick`; `HudView.hoeTier` filled in `selectHudView` (HudScene's initial view gains `hoeTier: 0`). `Button.setIcon(frame: string | null)` (re-lays out icon + label as the constructor does; no-op without a change). `HudScene` passes the tier each frame; BottomBar/HudScene map 0/1/2 → none / `iconHoe` / `iconHoe2`. Check the label + icon clear the key hint in the 160 px button. Tests: `hoeTier` per owned set; `selectHudView(...).hoeTier`.

- [x] **Task 5: Tests (AC 2–6)** — `newGame(seed)`, `applyCommand`, `runFor` from `tests/sim/helpers.ts`; assert with `TUNING.hoePrices`, `hoePipsPerClick`, `farmPipsPerClick`, `boostPipMultiplier`, `farmPipsPerFood`, `breedingPipsPerClick`, never literals.
  - [x] 5.0 **Expected break:** `tests/sim/selectors.test.ts:657` pins `SHOP_ITEMS` to the 5 current ids; update it to the 7 (this is the one intended pre-existing test change). The `isLand` / `isDecoration` filter tests (~761–766) must still give only the lands / decorations: both are explicit allowlists (`selectors.ts:10–23`), so a hoe is neither and `GameScene`'s `Bought` handler (line 256–257: fence grow / decoration drop) ignores it — keep it that way.
  - [x] 5.1 `tests/sim/selectors.test.ts` (shop block near line 691): `SHOP_ITEMS` ends `…'scarecrow', 'hoe1', 'hoe2'` and `SHOP_ROWS` still ends with `'medicine'` (the existing `toEqual([...SHOP_ITEMS, 'medicine'])` stays); `shopPrice('hoe1'/'hoe2')` from `TUNING.hoePrices`; `shopRequires('hoe2') === 'hoe1'`, `shopRequires('hoe1') === null`; `buyBlock`: hoe2 `locked` without hoe1 even when affordable, `poor` with hoe1 owned and too little money, `null` when affordable, `owned` after purchase; `selectShopView` row count is `SHOP_ROWS.length` (8).
  - [x] 5.2 Same file, the boost block (~line 600): `farmPipsPerClick` for each tier × boost — none/I/II unboosted = `farmPipsPerClick` / `hoePipsPerClick[0]` / `hoePipsPerClick[1]`; boosted = each × `boostPipMultiplier`; owned `['hoe1','hoe2']` → tier II; a lost game with hoe II and a live deadline → unboosted tier II. Leave the existing tests as they are (they run with no hoe).
  - [x] 5.3 `tests/sim/systems/economy.test.ts`: buying hoe1 spends `hoePrices[0]`, pushes `'hoe1'`, emits `Bought { item: 'hoe1', price }`, leaves `stats.moneyEarned` and rng untouched; `Buy hoe2` without hoe1 does nothing and emits nothing; after hoe1, hoe2 buys; a second `Buy hoe1` is refused (owned). Mirror the "locks each Land tier" test's shape.
  - [x] 5.4 `tests/sim/commands.test.ts` (Farm block, ~line 20–60 and the boost block ~218–265): with hoe1 one Farm fills `hoePipsPerClick[0]`; with hoe2 `hoePipsPerClick[1]`; carry-over — set `farmProgress = farmPipsPerFood − 1`, hoe2 + boost: one click drops exactly one piece (`Farmed { added: 1 }`, one `FoodDropped`) and leaves `(farmPipsPerFood − 1 + 6) − farmPipsPerFood`; `FarmBreeding` with hoe2 + boost still adds `breedingPipsPerClick`.
  - [x] 5.5 `tests/save/validate.test.ts`: `owned: ['hoe1', 'hoe2']` valid; `['hoe2']` and `['hoe2', 'hoe1']` rejected ("before hoe1"); `['hoe1', 'hoe1']` rejected (twice). `roundTrip.test.ts`: either add `'hoe1'` (and money spent) to the busy fixture in `tests/save/busy.ts` — only if it does not change the fixture's rng path (pushing to `owned` draws nothing) — or add one round-trip case with both hoes owned.
  - [x] 5.6 `tests/sim/scenarios/boost.test.ts` (or a new `tests/sim/scenarios/betterHoe.test.ts`): a scenario through commands only — give money, `Buy hoe1`, `Buy hoe2`; Farm until the first piece: it takes `ceil(farmPipsPerFood / hoePipsPerClick[1])` clicks (2 at 6 pips); then sacrifice an adult for the boost: every click now drops a piece (6 pips); after `runFor(state, TUNING.boostMs)` back to 3 pips. Pair it with the same clicks without a hoe so the count difference is shown (not vacuous).
  - [x] 5.7 Run the full suite. The hoe changes nothing unless bought, so no seeded test should move; if one does, find out why before touching it.

- [x] **Task 6: Pacing re-check (AC 8)** — `tests/sim/scenarios/pacing.test.ts`
  - [x] 6.1 Add a hoe policy to the reference player, off by default so the existing guards keep their meaning: `runProbe(cps, seed, { hoe: true })`. [ASSUMPTION, default] In `freeActions`, **after** the Land I logic: buy `hoe1` when `buyBlock(s, 'hoe1') === null`, then `hoe2` likewise, but never spend money the Land I purchase needs: while Land I is not owned, buy a hoe only if `s.money − price ≥ 0` and the flock is below capacity (i.e. the bot is not about to sell for land) — or simpler, only after Land I is owned. Pick the simpler rule that the numbers support and describe it in the policy comment at the top of the file. Money only comes from sales, which the bot only makes for Land I, so also decide whether the hoe policy sells for the hoe (default: it does **not**; it buys from the change left after Land I).
  - [x] 6.2 Report: print the table for `REPORT_CPS` both without and with the hoe (two blocks, the second labelled "with Better Hoe"); add a determinism check for the hoe run.
  - [x] 6.3 Run seeds `SEED, 11, 2026` (the guard's) at `TOWN_CPS` (6) with the hoe policy. If Town lands in 10–15 min on all three, change the guard to use the hoe policy, rename it ("…with Better Hoe, without boosts"), remove `.skip`, and update its comment and the `TOWN_CPS` doc. If not, keep `.skip`, update its comment with the new numbers (the date, the policy, the times per seed and rate), and leave the decision to Rylan (Open Question 2). Do **not** widen the window, raise `TOWN_CPS` above a human rate, or retune TUNING values in this story without Rylan's say.
  - [x] 6.4 Keep `LIMIT_MS` and the run time under the 60 s test timeout (the probe now runs twice as many games in the report test; split it into two `it`s if needed).
  - [x] 6.5 GDD Number Balancing (`gdd.md` ~line 298) says "Town relies on the sacrifice boost (and, later, Better Hoe)": add one sentence with the 4.7 measurement only if the result is clear; otherwise leave the GDD for Rylan.

- [x] **Task 7: Browser checks (AC 1, 2, 5, 7)** — `npm run dev`, DEV overlay "+$100".
  - [x] 7.1 Open the shop: 8 rows in order, Better Hoe I "$30" "Farm click fills 2 pips", Better Hoe II "$100" greyed "Needs Better Hoe I"; the panel's top clears the Pause button with a visible gap; the hoe icon reads as a hoe at ×2.
  - [x] 7.2 With $0: both hoe rows grey. +$100: buy I → money rolls down by 30, row shows "Owned", II turns buyable ("Farm click fills 3 pips", "$100" in normal ink only once money ≥ 100).
  - [x] 7.3 Farm (click and `F`): 2 pips per click with I ("0/6" → "2/6" → "4/6" → piece, "+1"), 3 with II. Sacrifice a sheep: 6 per click, a piece every click; after 30 s back to 3. Farm Breeding Food stays 1 pip per click throughout. The Farm tooltip is unchanged.
  - [x] 7.4 At 960×540: the effect lines are not clipped; the panel still fits.
  - [x] 7.5 Save with both hoes, reload: rows still "Owned", 3 pips per click. `npm run build`; no DEV strings in `dist/`; `icon-hoe` is in the built atlas.

- [x] **Task 8: Docs and tracking**
  - [x] 8.1 `_bmad-output/game-architecture.md` (Economy & shop row, ~line 485): add "Story 4.7: Better Hoe I/II (`hoe1`/`hoe2`, one-time, II needs I) set the Farm click's base pips (`selectors.ts farmPipsPerClick`, `TUNING.hoePipsPerClick`); no state field."
  - [x] 8.2 `deferred-work.md`: mark resolved "Better Hoe (Story 4.7)" (2-8 section); under "More rows", add a 4.7 line: 8 rows, top y 74; **4.8's Auto-feeder row does not fit** (y 14) — 4.8 must shrink the row gap/padding/header or move Pause; update the three pacing entries with the 4.7 result. Add "Deferred from: story 4-7-better-hoe-upgrades": **5.6** a purchase sound already deferred on `Bought` (no hoe-specific sound); **5.8** the placeholder hoe icon art; **5.10** whether players buy the hoe early and whether Town is reachable at a human rate with hoe + boost.
  - [x] 8.3 `sprint-status.yaml`: this story → `review` when done (create-story set it to `ready-for-dev`).

### Review Findings

- [x] [Review][Decision] When the pacing bot's hoe policy starts selling elders — resolved by Rylan (2026-10-09): option 1, sell elders only once Land I is owned (now a patch below)
- [x] [Review][Patch] The hoe policy sells elders from game start; sell them only once Land I is owned so the run matches the no-hoe run up to Land I [tests/sim/scenarios/pacing.test.ts:168]
- [x] [Review][Patch] The hoe loop `break`s on an owned Hoe I, so Hoe II is never bought; the recorded "Hoe II never" and the Town numbers come from this bug [tests/sim/scenarios/pacing.test.ts:176]
- [x] [Review][Patch] The hoe policy and `sellFor` queue a second `Sell` for the same elders in one batch (harmless only because `sell` ignores missing ids) [tests/sim/scenarios/pacing.test.ts:172]
- [x] [Review][Patch] Task 8.2 is marked done, but the third pacing entry ("The pacing bot cannot survive the Abomination") was not updated with the 4.7 result [_bmad-output/implementation-artifacts/deferred-work.md:353]
- [x] [Review][Patch] The `selectShopView` hoe1 expectation is computed from the state under test (`shopPrice('hoe1') <= state.money ? null : 'poor'`); pin it [tests/sim/selectors.test.ts:803]
- [x] [Review][Patch] Layout tests: the `SHOP_PANEL_MIN_TOP` assertion repeats its definition, and the row step asserts only `> row height` instead of `= row height + SHOP_ROW_GAP` [tests/view/field/layout.test.ts:81]
- [x] [Review][Patch] The Hoe round-trip test compares `farmPipsPerClick(loaded)` with the original (implied by `toStrictEqual`) instead of the expected Hoe II value [tests/save/roundTrip.test.ts:87]
- [x] [Review][Patch] `isHoe` returns `boolean`, not a type predicate like `isLand`/`isDecoration`, and its doc does not say it is only used by the classification test [src/sim/selectors.ts:26]
- [x] [Review][Patch] One invariant covers both "too many rows" and "meets Pause", so a 10th row that still clears Pause is reported as a Pause collision [src/view/hud/ShopPanel.ts:38]
- [x] [Review][Patch] The `LINE1_Y`/`LINE2_Y` comment says the lines are "centred in the row's halves" (12.5 / 37.5), but they are at 14 / 36, so their line boxes overlap by about 1 px (the glyphs are clear in the browser) [src/view/hud/ShopPanel.ts:49]
- [x] [Review][Patch] The Dev Agent Record omits deviations: `isHoe` not a predicate, Task 8.2's "4.8 does not fit (y 14)" note superseded by OQ 3, and the third pacing entry left unchanged [_bmad-output/implementation-artifacts/4-7-better-hoe-upgrades.md]

## Dev Notes

### What this story is (and is not)

- **Is:** two one-time shop items (`hoe1`, `hoe2`), two TUNING tables, the hoe tier in `farmPipsPerClick`, two shop rows with a placeholder hoe icon, tests, and the pacing re-check deferred to 4.7.
- **Is not:** a change to the breeding bar, the boost's length or multiplier, the Farm tooltip, the bottom bar, the save schema, the Auto-feeder (4.8), audio (5.6) or final art (5.8). No new HUD indicator of the hoe level (the GDD and UX specs have none; the bigger pip jumps are the feedback).

### Current code to build on (read these first)

| File | Today | This story |
|---|---|---|
| `src/sim/selectors.ts:108–184` | `SHOP_ITEMS` (5 one-time items), `SHOP_ROWS = [...SHOP_ITEMS, 'medicine']`, `shopPrice` (switch + `assertNever`), `shopRequires` (land2→land1, land3→land2), `isOwned`, `buyBlock` (owned > locked > poor), `selectShopView` (fills in place) | append hoe1/hoe2; prices; hoe2→hoe1 |
| `src/sim/selectors.ts:470–476` | `farmPipsPerClick(state) = TUNING.farmPipsPerClick × (boosted ? boostPipMultiplier : 1)`; doc names 4.7 | hoe tier base |
| `src/sim/commands.ts:80–125` | `farm()`: guards a corrupt bar, adds `farmPipsPerClick`, loops full bars → `createFoodPiece` at a seeded spot, `FoodDropped`, `Farmed { added }`; `farmBreeding()` adds `breedingPipsPerClick` only | comments only |
| `src/sim/systems/economy.ts` | `buy()`: `buyBlock` → spend → medicine count or `owned.push` → `Bought` | comment only |
| `src/sim/state.ts:121–131` | `ShopItemId` (5 ids), `ShopRowId = ShopItemId | 'medicine'`; `owned: ShopItemId[]` | add 2 ids |
| `src/save/validate.ts:98–108` | `owned` must be an array of `SHOP_ITEMS`, no repeats, each after its `shopRequires` | **no change** (tests only) |
| `src/config/tuning.ts:34–68` | `farmPipsPerFood 6`, `farmPipsPerClick 1`, `boostMs`, `boostPipMultiplier 2`, `breedingPipsPer*`, `landPrices`, decoration prices, `medicinePrice 15` | `hoePrices`, `hoePipsPerClick` |
| `src/view/strings.ts:29–60, 76–80, 158–160` | `landEffect(tier)`, `SHOP_NAME` / `SHOP_EFFECT` (`Record<ShopRowId, string>`), `farmTooltip` constant, `shopOwned`, `shopNeeds(name)` | names, `hoeEffect` |
| `src/view/hud/ShopPanel.ts` | rows from `SHOP_ROWS`; `PANEL_H = 2 + 16 + 20 + n × 60 + 16`, `PANEL_Y = 608 − PANEL_H`; DEV `invariant(PANEL_Y ≥ 16 + 40 + 8)`; `SHOP_ICON` record; locked effect → `shopNeeds(shopName[req])` | `SHOP_ICON`, comment |
| `src/view/assetKeys.ts:78–83` | shop icons `iconLand`, `iconFlowerPatch`, `iconScarecrow`, `iconMedicine` | `iconHoe` |
| `tests/sim/scenarios/pacing.test.ts` | scripted player, no boost/no hoe; Village guard runs; Town guard `it.skip` since 4.1 "re-enable … after 4.3 and 4.7" | hoe policy, re-check |

### What must be preserved

- **The breeding bar is never touched** by the hoe or the boost (FR8, sprint change 2026-10-06 D1). `farmBreeding()` must keep reading `TUNING.breedingPipsPerClick` directly, not `farmPipsPerClick`.
- **One click-value rule.** Only `farmPipsPerClick(state)` decides the pips; nothing else multiplies or adds them.
- **Purchase side effects stay per kind.** `isLand` and `isDecoration` stay explicit lists, so buying a hoe never grows the fence or drops a decoration (`GameScene.ts:256–257`).
- **One purchase rule.** The rows' look and the sim's `Buy` both come from `buyBlock`; do not add hoe-specific checks to `buy()` or the panel.
- **Determinism.** Buying a hoe draws no rng; a game without a hoe behaves byte-identically to before (all existing seeded tests unchanged).
- **Save compatibility.** No schema bump: old saves have no hoe and load as before. `SHOP_ITEMS` must hold one-time items only (validation trusts it; `'medicine'` stays out).
- **The bar's +N popup, the boost badge and timer** behave as before.
- **No allocation** in `farmPipsPerClick` / `selectShopView` beyond what exists.

### Design decisions (defaults chosen; see Open Questions)

- **Tiers replace the base** (1 → 2 → 3), not add (+1, +2); the GDD and the epics both say "fills 2 / 3 pips".
- **TUNING tables** `hoePrices [30, 100]` and `hoePipsPerClick [2, 3]`, parallel to `landPrices` / `landCapacities`, so the effect strings and tests read them.
- **Effect line** "Farm click fills N pips", built from TUNING (GDD Upgrade Trees wording, singular row form). The mockup's "Farm click +2" is obsolete.
- **Order** after the decorations, before Medicine (mockup and `SHOP_ROWS` doc).
- **One shared icon** for both tiers, from the mockup glyph.
- **No schema bump**; validation already covers the new ids.

### Architecture compliance

- Click value is a derived selector over `owned` (never a stored "pips per click" in state): pattern N4 "store facts, derive the rest".
- New tunables → `TUNING`; copy → `strings.ts`; icon frame → `assetKeys.ts` + the `ui` atlas via `npm run assets`.
- The view never mutates state: the row dispatches `Buy` through the existing `onBuy`.
- `switch` over ids keeps its `assertNever` default.

### Library / framework notes

- Phaser **4.2.1**, TypeScript 6, Vitest 4.1 — no new API is used (the rows reuse existing `Text`/`Image` calls). No new packages; no web research needed for this story.

### Testing standards

- Vitest for `src/sim/` and `src/save/` only; the rows and icon are browser-checked.
- Use TUNING values in assertions; build state with `newGame(seed)`; buy through `applyCommand({ type: 'Buy', … })` rather than pushing into `owned`, except in pure selector tests.
- Pair "with hoe" against "without" so a count difference cannot pass vacuously (4.2/4.4/4.5/4.6 lesson).
- Save tests stay mandatory and green.

### Previous story intelligence (4.6 and earlier)

- **4.6 (Overcrowding):** the review caught float edges in threshold math, step tests that did not prove the effect, missing order tests, and Dev Agent Record notes that left out fixture edits or deviations from task text. Record every deviation from this file's task text in the Dev Agent Record.
- **4.5 (Medicine):** introduced `ShopRowId`/`SHOP_ROWS` so consumables sit after one-time items; added the `ShopPanel` height invariant (the 4.5 review patch) precisely because 4.7/4.8 add rows. The icon workflow: a throwaway scratchpad PNG encoder from the mockup glyph, commit only the PNG, `npm run assets`, `CREDITS.md` placeholder row.
- **3.6 (Pacing):** `farmPipsPerFood` 6, Land I $80; Better Hoe stays Should (decision log); the probe proposes, Rylan decides. The Town guard has been skipped since 4.1; since 4.3 the bot sacrifices the Abomination after 2 victims and no longer reaches Town at any rate (seed 3606 at 6 cps: 18:00).
- **3.2–3.4 (Shop, Land, Decorations):** one-time items in `owned`, `buyBlock` order, "Needs {name}" on locked rows, no confirmation.
- **2.8 (Boost):** `boostPipMultiplier` doubles Farm only; "Better Hoe: raise the base in `farmPipsPerClick`; the boost doubles whatever the base is (2 → 4, 3 → 6)" (deferred-work).
- Pattern from every story: code, story file, `deferred-work.md` and `sprint-status.yaml` in one "Implement story 4.7: Better Hoe Upgrades" commit; review fixes in a separate commit.

### Git intelligence

- Recent: `6e910c6` 4.6 Overcrowding (schema 11 → 12, `overcrowding.ts`, `icon-crowd`), `2ea66de` 4.5 Medicine (`ShopRowId`, `SHOP_ROWS`, `icon-medicine`, panel invariant), `8e0283a` 4.4, `4a25830` 4.3, `c224c83` 4.2.
- Work on a `story-4.7` branch from `main` at `6e910c6`.

### Open questions (defaults chosen; confirm or change)

Answered by Rylan, 2026-10-09:
1. **Effect text:** keep "Farm click fills 2 pips" / "…3 pips".
2. **Pacing:** if the hoe policy does not bring Town into 10–15 min, keep the Town guard skipped (default).
3. **Shop panel room for 4.8:** fix it in this story (Task 4.3a, AC 7).
4. **Hoe indicator:** show it on the HUD (Task 4.5, AC 10).

### Project Structure Notes

- New: `assets/art/ui/icon-hoe.png`, optionally `tests/sim/scenarios/betterHoe.test.ts`.
- Modified: `src/config/tuning.ts`, `src/sim/{state,selectors,commands}.ts` (commands: comment only), `src/sim/systems/economy.ts` (comment), `src/view/strings.ts`, `src/view/assetKeys.ts`, `src/view/hud/ShopPanel.ts`, `assets/CREDITS.md`, `public/assets/atlases/ui.{png,json}` (regenerated), tests under `tests/config/`, `tests/sim/`, `tests/save/`, `tests/sim/scenarios/pacing.test.ts`, `_bmad-output/game-architecture.md`, `deferred-work.md`, `sprint-status.yaml`.
- No conflicts with the unified structure: the rule stays a selector, the purchase stays in `economy.ts`.

### Project Context Rules

- Phaser 4 APIs only; no new npm packages.
- `src/sim/` stays pure (no Phaser, DOM, `Math.random`, `Date.now`); the view reads selectors and dispatches commands.
- New tunable → `TUNING`; new copy → `strings.ts` (no "!", no "kill"/"corpse"/"blood"); colours via `COLORS`/`COMPONENTS` tokens.
- No confirmations on shop purchases (UX-DR68).
- Any `GameState` field change needs a schema bump + migration (none here: `owned` already exists).
- Tests: `tests/<same path>`, fixed seeds, `runFor` in `TICK_MS` steps, TUNING in assertions, no fake timers.
- Done = `npm test`, `npm run typecheck`, `npm run lint` green; rendering verified in the browser.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 4.7: Better Hoe Upgrades] ACs; FR24 (line 55), FR3, FR8, FR19; UX-DR23, UX-DR24, UX-DR26, UX-DR27, UX-DR68
- [Source: _bmad-output/planning-artifacts/gdds/gdd-sheep-civilization-2026-10-05/gdd.md#Upgrade Trees] line 265 "Better Hoe I / II | Click power | $30 / $100 | Farm click fills 2 / 3 pips | Should"; line 246 click value progression; lines 294–298, 331 pacing
- [Source: _bmad-output/planning-artifacts/gdds/gdd-sheep-civilization-2026-10-05/decision-log.md] lines 31, 63, 91 (Better Hoe stays Should)
- [Source: _bmad-output/planning-artifacts/sprint-change-proposal-2026-10-06.md] Better Hoe and boost table; R4 tooltip independent of the hoe
- [Source: _bmad-output/planning-artifacts/sprint-change-proposal-2026-10-06-breeding-food.md] D1: Better Hoe never applies to breeding
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-sheep-civilization-2026-10-05/mockups/hud.html] `.shop` / `.row` geometry, row order, `g-hoe` glyph (line 133)
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-sheep-civilization-2026-10-05/DESIGN.md] line 441 Farm progress ("more with Better Hoe or the boost")
- [Source: _bmad-output/game-architecture.md] Economy & shop row (line 485)
- [Source: _bmad-output/implementation-artifacts/deferred-work.md] "Better Hoe (Story 4.7)", "More rows", "Town needs fast clicking", "The Town pacing guard is skipped", "The pacing bot cannot survive the Abomination"
- [Source: _bmad-output/project-context.md] all rules above

## Change Log

- 2026-10-09: Rylan answered the open questions before dev: the shop panel is re-sized for 9 rows now (AC 7, Task 4.3a, 4.3b) and the hoe shows on the Farm button (AC 10, Task 4.5).
- 2026-10-09: Code review (Blind Hunter, Edge Case Hunter, Acceptance Auditor): 1 decision (Rylan: the pacing bot sells elders only after Land I), 11 patches applied (the hoe policy's Hoe II loop and duplicate sells, pacing numbers and the third deferred-work entry, pinned shop-row and layout-step tests, a real Hoe II round-trip value, `isHoe` as a type predicate, split ShopPanel invariants, the line-position comment, the Dev Agent Record), 4 dismissed. Status → done.
- 2026-10-09: Implemented (dev-story). Better Hoe I/II in the shop, the hoe tier in `farmPipsPerClick`, the hoe icon on the Farm button, the 9-row shop panel, tests, the pacing re-check (Town guard stays skipped). Status → review.

## Dev Agent Record

### Agent Model Used

Claude Opus 5.5 (claude-opus-5-5[1m])

### Debug Log References

- `npm test`: 61 files, 826 passed, 1 skipped (the Town pacing guard, skipped since 4.1). `npm run typecheck`, `npm run lint`: clean. `npm run build`: passes (the existing chunk-size warning only); no DEV strings in `dist/`; `icon-hoe` and `icon-hoe-2` are in the built atlas.
- Browser (scratchpad Playwright probe on the DEV server, GameScene captured by patching its prototype from the page, no source change), at 1280×720 and 960×540: shop shows 8 rows, top y 122, clear of Pause; Hoe II greyed "Needs Better Hoe I" and a click on it does nothing; Hoe I bought ($130 → $100, "Owned"), Farm click 2 pips; Hoe II bought ($0), click 3 pips, `F` 3 more → a piece; boosted click 6 pips → a piece; `G` still 1 pip; Farm tooltip unchanged; boost badge clear of the icon; save, reload, Continue → both hoes owned, 3 pips, Hoe II icon shown.

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created
- **Sim:** `ShopItemId` + `SHOP_ITEMS` gain `hoe1`/`hoe2`; `shopPrice` from `TUNING.hoePrices` [30, 100]; `shopRequires('hoe2') = 'hoe1'`; new `hoeTier(state)` (II checked first) and `farmPipsPerClick` = `hoePipsPerClick[tier − 1]` (or `farmPipsPerClick`) × boost. `HudView.hoeTier`. `buy()`, `farm()`, `farmBreeding()` unchanged (comments only). No schema bump: validation already checks `owned` via `SHOP_ITEMS` + `shopRequires`.
- **Shop panel (Rylan, OQ 3):** geometry moved to `view/field/layout.ts` (`SHOP_PANEL_BORDER`, `SHOP_HEADER_H`, `SHOP_ROW_GAP`, `SHOP_PANEL_MAX_ROWS` = 9, `SHOP_PANEL_MIN_TOP`, `shopPanelHeight`, `shopPanelTop`); `COMPONENTS.shopItemRow.height` 56 → 50 (DESIGN.md deviation, commented); text lines re-centred (14 / 36). 8 rows: top y 122; 9 rows: y 68. `SHOP_PANEL_BORDER` is a local 2 because `widgets/box.ts` imports Phaser types and `layout.ts` promises none; `ShopPanel` checks it equals `OUTLINE_PX` (DEV invariant).
- **Hoe on the HUD (Rylan, OQ 4):** `Button.setIcon(frame | null)` (the constructor now uses it too), `BottomBar.setHoeTier`, called each frame from `HudScene` (no-op without a change). Found in the browser: the atlas gives every frame a `pivot`, so `Image.setFrame` resets the origin to 0.5; `setIcon` re-applies `(0, 0.5)` after `setFrame` (the Hoe II icon was drawn 14 px left before the fix). A new icon takes the current state's tint via `refresh()`.
- **Art:** `icon-hoe.png` / `icon-hoe-2.png`, 14×14. The first draft from the mockup's `g-hoe` glyph read as a flag at ×2 in the browser, so both were redrawn (diagonal handle, blade bent at its end; II has a bigger `wool` blade with a `bark` outline and a glint). Deviation from Task 4.1's "from the mockup glyph" text. Both rows use their own icon (Task 4.3 said a shared one; 4.3b added II's).
- **Deviation, `isHoe`:** Task 5.0 expected the `isLand`/`isDecoration` tests to stay as they were, but the 3.4 test "every shop item is Land or a decoration" failed by design (it forces new items to be classified). Added `selectors.ts isHoe` and made the test "exactly one of Land, decoration or Better Hoe"; 4.8 must classify the Auto-feeder (noted in deferred-work).
- **Pre-existing tests changed:** `selectors.test.ts` (the `SHOP_ITEMS` list, the `selectShopView` rows, the classification test), and type-only `hoeTier: 0` in hand-built `HudView` fixtures in `selectors.test.ts`, `market.test.ts`, `sacrifice.test.ts` (and `HudScene`'s initial view). No seeded test changed outcome.
- **Pacing (Task 6, AC 8):** `pacing.test.ts` gained `ProbeOptions { hoe }`, a "with Better Hoe" report over seeds 3606/11/2026 × 2/3/5/6 cps (asserts at least one run buys the hoe), and a hoe determinism check. The first policy (sell breeders for Hoe I at the first full pen) lost on 11 of 12 runs and was replaced. After the code review (a loop that could never buy Hoe II was fixed; Rylan chose to sell elders only once Land I is owned), the policy plays as the plain bot up to Land I, then sells elders as they age and buys Hoe I, then II. Result: Hoe I at 17–19 min where bought at all, Hoe II never ($100 of $5 elders does not arrive by 20 min); Town at 6 cps 19:53 / 16:13 / lost 6:57 (seed 3606 plain: 17:51). The Town guard stays skipped with these numbers in its comment (Rylan's default, OQ 2). GDD left unchanged for Rylan (Task 6.5: not a clear-cut result to write in).
- **Deviations noted in the code review:** `isHoe` was first written as a plain `boolean` and is now a type predicate (`item is Hoe`) like `isLand`/`isDecoration`; it is used only by the classification test. Task 8.2's "4.8's Auto-feeder row does not fit (y 14)" note was superseded by OQ 3 (the panel now fits 9 rows; deferred-work records y 68). The third pacing entry in deferred-work ("The pacing bot cannot survive the Abomination") was at first left unchanged and was updated in the review.
- **Red/green:** the sim code and the tests were written in the same pass rather than strictly test-first; every new test was run and passes, and the browser checks confirmed the view.

### File List

- `_bmad-output/game-architecture.md` (modified)
- `_bmad-output/implementation-artifacts/4-7-better-hoe-upgrades.md` (new)
- `_bmad-output/implementation-artifacts/deferred-work.md` (modified)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modified)
- `assets/CREDITS.md` (modified)
- `assets/art/ui/icon-hoe.png` (new)
- `assets/art/ui/icon-hoe-2.png` (new)
- `public/assets/atlases/ui.json` (regenerated)
- `public/assets/atlases/ui.png` (regenerated)
- `src/config/constants.ts`
- `src/config/tuning.ts`
- `src/sim/commands.ts` (comment)
- `src/sim/selectors.ts`
- `src/sim/state.ts`
- `src/sim/systems/economy.ts` (comment)
- `src/view/assetKeys.ts`
- `src/view/field/layout.ts`
- `src/view/hud/BottomBar.ts`
- `src/view/hud/ShopPanel.ts`
- `src/view/scenes/HudScene.ts`
- `src/view/strings.ts`
- `src/view/widgets/Button.ts`
- `tests/config/tuning.test.ts`
- `tests/save/roundTrip.test.ts`
- `tests/save/validate.test.ts`
- `tests/sim/commands.test.ts`
- `tests/sim/scenarios/betterHoe.test.ts` (new)
- `tests/sim/scenarios/market.test.ts` (fixture field)
- `tests/sim/scenarios/pacing.test.ts`
- `tests/sim/scenarios/sacrifice.test.ts` (fixture field)
- `tests/sim/selectors.test.ts`
- `tests/sim/systems/economy.test.ts`
- `tests/view/field/layout.test.ts`
