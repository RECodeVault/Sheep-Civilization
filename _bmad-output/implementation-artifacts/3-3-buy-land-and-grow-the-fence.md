---
baseline_commit: a903488
---

# Story 3.3: Buy Land and Grow the Fence

Status: done

<!-- Created 2026-10-07 by create-story. Builds on 3.2 (`owned`, `Buy`/`Bought`, `buyBlock`, shop rows, FLOCK_RESERVE, PenCamera shop inset), 3.1 (Market geometry, playArea ∪ MARKET_BOUNDS), 2.7 (Better Place geometry, SheepDrag, playArea), 2.3 (capacity, breedBlock) and 1.3 (fence, movement containment). No save schema bump: land is derived from `owned`. -->

## Story

As a player,
I want to buy land that visibly expands my fence and raises capacity,
so that my flock can grow.

## Acceptance Criteria

1. **Land rows (FR22, UX-DR24, UX-DR95).** The shop lists Land I ($50), Land II ($150), Land III ($400) in that order, before the decorations. A tier whose predecessor is not owned is greyed and shows "Needs Land I" / "Needs Land II" on its effect line and cannot be bought (sim refuses it too). Story 3.2 already built this. 3.3 keeps it and makes the effect lines come from the land table: "Capacity 10 → 25", "Capacity 25 → 50", "Capacity 50 → 100", built from `TUNING`, not typed literals (see Dev Notes, "One land table").
2. **Capacity follows land (FR11, FR22, AR21).** `capacity(state)` returns 10 with no land, 25 with Land I, 50 with Land II and 100 with Land III, from one `TUNING` land table. It is derived from `state.owned` every call, never stored. Breeding (`breeding.ts`), `breedBlock` and the Breed tool's greyed state and tooltip use it unchanged. Capacity still counts living sheep plus `state.pregnancies`.
3. **The fence grows in place (FR22, UX-DR49, DESIGN Layout).** `fenceBounds(state)` returns the fence rect for the owned tier: Start ⊂ Land I ⊂ Land II ⊂ Land III. Each rect fully contains the one before, so the fence only ever grows. The fence rects are in "Fence rects" below. On the frame a land purchase is applied (`Bought` with a land item), the drawn fence is rebuilt at the new bounds, with a short [ASSUMPTION] dust burst along the new rails as the "it grew" cue. A loaded or continued game with land draws its grown fence from the start.
4. **Everything that uses the pen follows it.** These read `fenceBounds` or `innerFence` already, so they pick up the new rect with no change of their own: movement containment, food and breeding piece drops (`commands.ts`), birth spots (`lifecycle.ts`), the drag drop clamp (`drag.ts`), the breeding spot (`breeding.ts`), save validation positions (`validate.ts`) and DEV "add sheep". Tests prove that sheep, pieces and drops can reach the new area after a purchase.
5. **Existing sheep stay put.** On the tick a land purchase applies, no sheep, piece, carcass or pregnancy moves or changes. Afterwards, wandering sheep can use the larger area: a seeded scenario shows at least one sheep beyond the old fence's inner edge within a bounded time. Fences only ever grow, so no entity is ever outside the fence.
6. **Flock counter (UX-DR35, UX-DR4, EXPERIENCE Status).** The bottom bar shows a read-only `flock-counter` in the reserved slot after the money counter. It has a sheep icon from the `ui` atlas and "{alive}/{capacity}" (for example "3/10" or "12/25") in `numeric` type, `bark`, in a fixed-width box sized for "100/100". `alive` is `state.sheep.length`, the living sheep, so pending lambs are not counted even though they hold a capacity slot. It reads `HudView.flock` and `HudView.capacity` once per frame and calls `setText` only when either changes. The crowded style (≥ 90%, `alert` plus a crowd icon) is **not** part of this story; it belongs to 4.6 (Should) and goes in deferred-work.
7. **The play area fits one screen at every tier (GDD Camera: "within the same screen"; Stories 2.7, 3.1, 3.2).** `GameScene.playArea` (fence ∪ Better Place ∪ Market) and the camera's opening focus are rebuilt when land is bought. `PenCamera` is re-clamped at once, moving only as far as the new limits require: no re-centre, no jump. At every tier the whole play area fits in the field above the bar with the 16 px safe edge, so the Market and the Better Place are always on screen and every sheep can be dragged to both. A DEV `invariant` checks this for all four tiers when the module loads.
8. **The open shop still never covers the Better Place or the Market (UX-DR23, 3.2 AC 7, deferred "open shop vs a wide play area").** While the shop is open, the camera's left limit keeps the **Better Place** (not the whole pen) right of the panel, at screen x ≥ 392. The Market stays inside the right safe edge as before. At Land II/III the left part of the pen may sit under the open panel. That is allowed: drops there are plain drops (3.2), and pings draw above the panel. Opening or closing the shop and buying land in any order never centres the play area in a way that puts the Better Place or the Market under the panel or off screen.
9. **No new state, no save bump (AR9, N4 spirit).** No `GameState` field is added. The land tier, capacity and fence are derived from `owned`. `SAVE_SCHEMA_VERSION` stays **8**. Save validation still checks `owned` before positions, so sheep and pieces are validated against the owned tier's inner fence. A save with Land II has sheep outside the Land I fence, and it validates and loads. The round-trip, corrupt-save and migration tests stay green, and `busyGame` owns at least Land I.
10. **Secrecy and layering.** No `PublicSheep` change. `src/view/` never writes `owned` or reads `isAbomination`. The flock count is a plain count (the Abomination counts like any sheep, FR30). The sim stays pure, and the new numbers live in `TUNING`.
11. **Done.** `npm test`, `npm run typecheck` and `npm run lint` pass. The browser checks in Task 8 are recorded with evidence, including a 100-sheep FPS spot check at Land III.

## Tasks / Subtasks

- [x] **Task 1: One land table in TUNING (AC 1, 2, 3)**
  - [x] 1.1 In `src/config/tuning.ts`, replace `baseCapacity` and `startFence` with one land table, indexed by tier 0–3 (0 = no land): `landCapacities: [10, 25, 50, 100]` and `landFences: [start, landI, landII, landIII]` (frozen `Rect`s, values in "Fence rects"). Keep the comment style: each value cites FR22 / GDD / mockup and marks `[ASSUMPTION, tune in 3.6]` where it is ours. `landPrices` stays.
  - [x] 1.2 Update every reader of `TUNING.baseCapacity` / `TUNING.startFence` (`selectors.ts`, `BetterPlace.ts` comment, `tests/sim/selectors.test.ts`, `tests/sim/systems/breeding.test.ts`) to the table (`TUNING.landCapacities[0]`). Use `grep -rn "startFence\|baseCapacity" src tests` to find them.
  - [x] 1.3 Add a config test (`tests/config/tuning.test.ts`, new): 4 capacities, strictly rising; 4 fences, each containing the one before (fences only grow); every fence wider and taller than `2 × fenceInset` plus a sheep; capacities match the shop effect numbers (FR22: 10/25/50/100).
- [x] **Task 2: Derive tier, capacity and fence (AC 2, 3, 9)**
  - [x] 2.1 `selectors.ts`: add `landTier(state): 0 | 1 | 2 | 3`. It is the highest owned land tier, found with a plain loop over `state.owned` with no allocation, because `movement.ts` calls `fenceBounds` every tick. Validation guarantees the prerequisites, so the highest is enough.
  - [x] 2.2 `capacity(state)` → `TUNING.landCapacities[landTier(state)]`; `fenceBounds(state)` → `TUNING.landFences[landTier(state)]`. Both return frozen TUNING values, so there is no allocation. Update their doc comments, removing "Story 3.3 adds…" and "Epic 3 makes it depend…".
  - [x] 2.3 `HudView` gains `flock: number` (`state.sheep.length`) and `capacity: number`, filled in place by `selectHudView`. Add `flock: 0, capacity: 0` to HudScene's preallocated view.
  - [x] 2.4 `economy.ts` does not change: `buy` already appends to `owned`. Remove the "(3.3)" forward reference in its header comment, or reword it.
- [x] **Task 3: Sim tests (AC 2–5, 9, 10)**
  - [x] 3.1 `tests/sim/selectors.test.ts`: `landTier` for [], [land1], [land1, land2], [land1, land2, land3], also with decorations mixed in; `capacity` and `fenceBounds` per tier via TUNING; `selectHudView` flock and capacity. Replace the 3.2 assertion that capacity ignores land.
  - [x] 3.2 `tests/sim/systems/breeding.test.ts` (or `scenarios/breeding.test.ts`): at 10/10 Breed is refused and `breedBlock` is `'capacity'`. After a `Buy land1` with enough money it is `null` (given 2 ready adults), and a Breed now succeeds. A pregnancy still holds a slot at the new capacity.
  - [x] 3.3 New `tests/sim/scenarios/land.test.ts`:
    - (a) On the tick `Buy land1` applies, `structuredClone` the sheep, pieces, carcasses and pregnancies before, and `toStrictEqual` them after (sheep positions unchanged; only `money`/`owned` change and one `Bought` is emitted).
    - (b) After the purchase, `runFor` a bounded time (TUNING-derived, for example `20 × TUNING.wanderRestMaxMs`, checked to be a multiple of `TICK_MS`). At least one sheep's centre lies outside the **old** inner fence, and every sheep stays inside the **new** inner fence on every tick.
    - (c) Food and breeding pieces dropped after the purchase can land outside the old fence: Farm enough bars with a fixed seed and assert that at least one is outside.
    - (d) A drag drop outside the old fence but inside the new one is placed where it was dropped, not clamped to the old fence.
    - (e) Land II without Land I is refused (`owned` unchanged, no event), and so is Land III without Land II.
    - (f) The full chain from no land to Land III gives capacity 10 → 25 → 50 → 100 and nested fences.
  - [x] 3.4 `tests/sim/scenarios/wander100.test.ts` (or a new case): 100 sheep at Land III stay inside the inner fence over the existing run, and the sim tick stays within the existing budget assertion (if there is one).
- [x] **Task 4: Save (AC 9)**
  - [x] 4.1 No migration and no schema bump. Confirm in `validate.ts` that `owned` is validated before `fenceBounds`/`innerFence` are read (today it is, at about lines 89–97 vs 124). Keep that order and add a comment saying the fence depends on it.
  - [x] 4.2 `tests/save/busy.ts`: `busyGame` buys Land I, through the real `Buy` command or by pushing `owned` before placing entities, then places sheep across the Land I area. Some sheep should be outside the start fence, so the round-trip covers grown-fence positions.
  - [x] 4.3 `tests/save/validate.test.ts`: a save with Land I/II and a sheep outside the start fence but inside the Land II fence validates. The same save with `owned: []` fails ("outside the fence"). A sheep outside the owned tier's fence still fails.
- [x] **Task 5: Fence growth on screen (AC 3, 7, 8)**
  - [x] 5.1 `GameScene`: keep the `Fence` instance in a field (it is created and discarded today). In `onSim`, on `Bought` with a land item (`item === 'land1' | 'land2' | 'land3'`, a small helper such as `isLand(item)` in `selectors.ts`), call `this.growLand()`. That method (a) calls `fence.setBounds(fenceBounds(state))`, (b) runs the dust bursts along the new fence (a few `dust.explode` calls at the rails' corners and midpoints, using `DUST_SPAWN_PUFFS`), (c) rebuilds `playArea` and the focus, and (d) calls `penCamera.reclamp(playArea, inset)`. A rare event, so allocation is fine. Wrap it in the existing `onSim` try/catch, so any error is reported as `ui`.
  - [x] 5.2 Build `playArea` and focus in one private method, `buildPlayArea()`, used by both `create` and `growLand`, so they cannot drift. Remove the "built once" assumption from the field comment.
  - [x] 5.3 `Fence.setBounds` rebuilds by destroy/add. That is acceptable for a purchase, which happens at most 3 times per game; the pooling rule covers per-entity sprites. Document it in the class comment. The fence keeps depth rules (back rails 0, front rails/posts at their y).
- [x] **Task 6: Camera fits every tier (AC 7, 8)**
  - [x] 6.1 `PenCamera`: change the shop-open rule from "the area's left edge right of `leftInset`" to "the **protected** rect's left edge right of `leftInset`". The protected rect is `BETTER_PLACE_BOUNDS`, passed in by GameScene so `PenCamera` does not import field modules. Concretely, `maxX = min(area.x − EDGE, protect.x − leftInset)`. With the shop closed it equals today's limit (`area.x − EDGE`), because the Better Place is right of the fence's left edge or inside the area. Keep the `centreOn`, `panBy` and `reclamp` signatures as close as possible, and update their doc comments.
  - [x] 6.2 Keep the "too big → centre" branch only as a guard. Add a DEV `invariant` in GameScene (module load or `create`) that for each tier `union(landFences[t], BETTER_PLACE_BOUNDS, MARKET_BOUNDS)` fits `VIEW_W − 2·EDGE` × `VIEW_H − 2·EDGE`, and that each fence's right edge is left of `MARKET_BOUNDS.x` and its top is at or below `BETTER_PLACE_BOUNDS`' bottom − 2 (the mockup's 2 px overlap with the label). Export `VIEW_W`/`VIEW_H`/`EDGE` from `PenCamera.ts` or compute them from `LAYOUT`.
  - [x] 6.3 Check by hand, and record it in the Debug Log, that the opening view and the shop-open limits work at every tier (numbers in "Camera check").
- [x] **Task 7: Flock counter (AC 6)**
  - [x] 7.1 Placeholder art `assets/art/ui/icon-sheep.png`: a 14×14 or 16×16 white-wool sheep with a `bark` outline, in the DESIGN palette, drawn at half size and shown at 2× like the other icons. `npm run assets` regenerates `public/assets/atlases/ui.{png,json}`. Add `FRAME.iconSheep` in `assetKeys.ts` and add the file to the `assets/CREDITS.md` placeholder row.
  - [x] 7.2 New `src/view/hud/FlockCounter.ts`, modelled on `MoneyCounter.ts`/`BoostTimer.ts`. It has an icon plus a fixed-width box, `textStyle(COMPONENTS.flockCounter.typography, COMPONENTS.flockCounter.textColor)`, and `set(alive, capacity)`, which calls `setText` only on change and builds the string only then. Export its total width.
  - [x] 7.3 `strings.ts`: `flockCount: (alive: number, capacity: number): string => \`${alive}/${capacity}\``. Build `SHOP_EFFECT`'s land lines from `TUNING.landCapacities` (for example `` `Capacity ${c[0]} → ${c[1]}` ``) and remove the "keep them in step" comment.
  - [x] 7.4 `BottomBar.ts`: place the counter in the `FLOCK_RESERVE` slot (x = `MONEY_X + MONEY_COUNTER_W + GROUP_GAP`) and vertically centre it like the money counter. Measure "100/100" in Nunito 800 22 px in the browser. If icon + gap + box > 100 px, grow `FLOCK_RESERVE` into the ~30 px spare before the threat summary. The existing `invariant` must still hold. Wire it up in HudScene `refresh` from the per-frame `HudView`.
  - [x] 7.5 Read-only: no `setInteractive`, no hand cursor, no tooltip (none in the Voice table).
- [x] **Task 8: Verify in the browser (AC 3, 5–8, 11)** — DEV server, scratchpad Playwright probe as in 3.1/3.2 (see Previous story intelligence)
  - [x] 8.1 New game: the counter reads "3/10", Land I is buyable at $50 (use DEV "+$100"), and Land II/III read "Needs Land I"/"Needs Land II".
  - [x] 8.2 Buy Land I, then II, then III: the fence grows in place each time, with a dust burst. Sheep do not jump. The counter shows "/25", "/50", "/100". Rows turn "Owned" and the next tier unlocks. Screenshot each tier.
  - [x] 8.3 At each tier: the whole fence, the Better Place and the Market are visible with the shop closed. Open the shop: the Better Place stays right of the panel, and the Market stays on screen. Pan with a right-drag in all directions, both with the shop open and closed. Nothing leaves view, and nothing jumps when the shop toggles or land is bought mid-pan.
  - [x] 8.4 Drag a sheep from the far left of the Land III pen to the Market (sell) and to the Better Place (sacrifice). Both are reachable without panning. A drop over the open panel is a plain drop.
  - [x] 8.5 Breed at capacity: Breed greys out with "No room. Buy land.". After buying land it un-greys (with 2 ready adults).
  - [x] 8.6 Save, reload and Continue at Land II: the grown fence, the capacity and "Owned" rows are restored. Use the debug Load of a planted Land III save, too.
  - [x] 8.7 Window at 960×540: the counter is legible and the bar has no overlap.
  - [x] 8.8 FPS: 100 sheep at Land III (DEV add sheep), ×1, 5 minutes, overlay open. Compare against the 3.2 baseline (~40 FPS SwiftShader, loaded machine), and note the load.
  - [x] 8.9 No console errors throughout.
- [x] **Task 9: Wrap-up**
  - [x] 9.1 `deferred-work.md`: add the crowded flock-counter style (4.6); "No room. Buy land." at Land III when no land is left (see Open Question 3); the denser Land III pen (3.6 tuning); food dropped under the open shop panel. Mark the resolved 3.1/3.2/2.7 land notes ("Fence growth vs the hole", "Stale camera play area", "Land tiers vs the stall", "Land's effect", "The open shop vs a wide play area") as **Resolved in Story 3.3** with one line each.
  - [x] 9.2 Fill in the Dev Agent Record (plan, debug log with browser evidence and FPS, completion notes, file list, change log), as in 3.2.

### Review Findings

- [x] [Review][Patch] Hide the world overlays of sprites under the open shop panel (hearts, breed markers, infection markers, pregnancy hearts); pings stay above it. Decision (Rylan, 2026-10-07): option 2 for sheep and pieces under the open shop at Land II/III [src/view/scenes/GameScene.ts]
- [x] [Review][Patch] `Fence.setBounds` destroys and re-creates about 80 images during play, against the project rule and the open deferred-work entry "Fence growth (Story 3.3)", which asked to reuse or pool the parts. Reuse the existing images and mark the entry resolved [src/view/field/Fence.ts:27]
- [x] [Review][Patch] With the shop open at Land I, the fence sits 4 px from the panel instead of the margin. Keep the whole play area right of the panel when it fits (tiers 0/I, as in 3.2), and protect only the Better Place when it does not (II/III) [src/view/field/PenCamera.ts:85]
- [x] [Review][Patch] The dust burst lands on the open shop panel at Land II/III (left-edge points at screen x 186–224 and 16–20). Skip burst points that are under the open panel [src/view/scenes/GameScene.ts:446]
- [x] [Review][Patch] Two land purchases applied in one tick each run `growLand` (a double rebuild and 16 bursts, both on the final fence). Mark the land as changed in `onSim` and grow once per frame [src/view/scenes/GameScene.ts:504]
- [x] [Review][Patch] The DEV invariant does not check the shop-open limits, so a retune could silently hit the "too big → centre" branch with the shop open. Also assert that `minX(area)` is at most the Better Place's shop-open limit at every tier [src/view/scenes/GameScene.ts:830]
- [x] [Review][Patch] Stale comments that still describe the old camera rules:
  - GameScene "Keep the play area right of the panel (AC 7)" (line 422);
  - the `panLeftInset` doc (line 462);
  - the PenCamera class doc ("opens centred"; opening the shop moves nothing only from the opening view) [src/view/scenes/GameScene.ts:422]
- [x] [Review][Patch] FlockCounter's width check hard-codes "100/100". Measure with the largest capacity in `TUNING.landCapacities` [src/view/hud/FlockCounter.ts:36]
- [x] [Review][Patch] The Land III case in wander100 would pass even if the tier were ignored. Assert that the flock spreads beyond the start fence and that the inner fence is Land III's [tests/sim/scenarios/wander100.test.ts:38]
- [x] [Review][Patch] validate.test runs `busyGame()` twice at collection time, and the no-land case only asserts "sheep" in the reason. Build the busy game once, and assert the moved sheep is the one rejected [tests/save/validate.test.ts:130]
- [x] [Review][Patch] The FPS check ran 150 s per pen, not the 5 minutes AC 11 / Task 8.8 asks for. Re-measure 5 minutes at Land III [story Debug Log]
- [x] [Review][Patch] Task 8.2/8.3 browser evidence is partial. Add pans with the shop open and closed at tiers 0 and II, a land purchase mid-pan, and a screenshot for each tier [story Debug Log]
- [x] [Review][Defer] The camera-fit guarantee is only checked by a DEV runtime invariant in GameScene, never under `npm test`, with 0–4 px slack at Land II/III. A 3.6 retune of `landFences` needs a config-level fit test (or must re-run the DEV build) [src/view/scenes/GameScene.ts:830] — deferred, forward risk for the 3.6 tuning pass

## Dev Notes

### Current code to build on (read these first)

- **`src/sim/selectors.ts`:**
  - `fenceBounds(_state)` returns `TUNING.startFence`, and `capacity(_state)` returns `TUNING.baseCapacity`. These are the two functions this story makes land-aware.
  - `innerFence` (allocates; for events), `slotsUsed`, `breedBlock`, `buyBlock`/`shopRequires`/`isOwned`.
  - `HudView`/`selectHudView` (fill in place).
- **`src/sim/systems/movement.ts:67`:** reads `fenceBounds(state)` once per tick and inlines the inner rect. The new `landTier` must therefore be allocation-free (a plain loop over `owned`, at most 5 entries).
- **`src/sim/state.ts` `createNewGame`:** places the founders in `fenceBounds(state)`, with `owned: []`, so tier 0. It needs no change beyond the TUNING rename.
- **`src/sim/commands.ts:89,111`, `systems/feeding.ts:38`, `lifecycle.ts:47`, `drag.ts:35`, `breeding.ts:31`:** each uses `innerFence(state)` at event time, so they follow the new tier automatically.
- **`src/save/validate.ts`:** `owned` is validated at about lines 89–97, and positions against `fenceBounds`/`innerFence` at about line 124. That order is now load-bearing.
- **`src/view/scenes/GameScene.ts`:**
  - `create` runs `new Fence(this, fenceBounds(this.state))`, then `focus = union(fence, BETTER_PLACE_BOUNDS)`, `playArea = union(focus, MARKET_BOUNDS)` and `penCamera.centreOn(focus, playArea)`.
  - `onSim` (event juice, inside a try/catch), `panLeftInset()`, `setShopOpen` (reclamps on open), `union()` and `stateCanRun` (already probes `fenceBounds`).
- **`src/view/field/PenCamera.ts`:** `minX/maxX/minY/maxY`; `clamp` with the "min > max → centre" branch; `centreOn`, `panBy(dx, dy, area, leftInset)`, `reclamp`.
- **`src/view/field/Fence.ts`:** `setBounds(rect)` already rebuilds from scratch.
- **`src/view/field/BetterPlace.ts` / `Market.ts`:** `BETTER_PLACE_BOUNDS` {442, 72, 156×114}, `MARKET_BOUNDS` {1080, 120, 196×270}. Both are fixed world objects; this story does **not** move them.
- **`src/view/hud/BottomBar.ts`:** `MONEY_X` (588), `MONEY_COUNTER_W` (80), `GROUP_GAP` (12), `FLOCK_RESERVE` (100, from x 680) and the invariant against `THREAT_X − GROUP_GAP`. `MoneyCounter.ts` is the model widget.
- **`src/view/strings.ts`:** `SHOP_EFFECT` has literal "Capacity 10 → 25" lines, and `shopNeeds(name)` gives "Needs Land I". `breedNoRoom` is "No room. Buy land.".
- **`src/debug/DebugOverlay.ts`:** `addSheep` places sheep in `fenceBounds`, so it follows the tier. "+$100" is enough to buy all land ($600).

### One land table

- GDD Upgrade Trees: Land I/II/III cost $50/$150/$400 and raise capacity 10 → 25 → 50 → 100, and each tier needs the previous one.
- A single `TUNING` table indexed by tier (0 = none) holds both capacity and fence. `capacity`, `fenceBounds` and the shop effect strings all read it. When 3.6 retunes, it changes one place and the tests (which use `TUNING`) follow.
- Keep `landPrices` as it is (3.2), with index i = Land i+1.

### Fence rects

These are [ASSUMPTION, browser-check; tune in 3.6] world px, where world = mockup canvas coordinates. The goal is "growth within the same screen" (GDD Camera), so the whole play area fits the 1280×608 field (1248×576 inside the safe edge) at every tier.

| Tier | Rect (x, y, w, h) | Spans | Capacity | Inner area per sheep at capacity |
|---|---|---|---|---|
| 0 Start | 556, 330, 380, 250 | 556–936 × 330–580 | 10 | ≈ 5.1 k px² |
| I | 430, 184, 632, 414 | 430–1062 × 184–598 (mockups/hud.html) | 25 | ≈ 7.4 k px² |
| II | 236, 184, 826, 464 | 236–1062 × 184–648 | 50 | ≈ 5.7 k px² |
| III | 32, 184, 1030, 464 | 32–1062 × 184–648 | 100 | ≈ 3.7 k px² |

- **Why this shape.** The fence grows left and down only:
  - its right edge stays at 1062, clear of the Market (outline from x 1080; 3.1 deferred note);
  - its top stays at 184, under the Better Place (bounds bottom 186, the same 2 px label overlap as the mockup's Land I; 2.7 deferred note);
  - the bottom of 648 is the lowest that still fits: the play area runs from y 72 (the Better Place's top) to 648, which is 576 px, exactly the field minus the two safe edges.
- **Density.** Land III is denser than Land I, because the screen runs out of room. That suits the GDD's overcrowding theme (FR34, Should), but it is a tuning concern for 3.6 (see Open Question 1 for the bigger-world alternative).
- **Sprites.** A sheep is 64×52 (about 3.3 k px²). Separation is 24 px, so 100 sheep fit in the sim, but they overlap visually at Land III. Check the look in Task 8.2.

### Camera check (expected numbers; VIEW 1280×608, EDGE 16, shop inset 392)

The play area is fence ∪ BP {442–598 × 72–186} ∪ Market {1080–1276 × 120–390}.

| Tier | Play area | X scroll range closed [minX, maxX] | X range shop open (BP ≥ 392) | Y range |
|---|---|---|---|---|
| 0 | 442–1276 × 72–580 | [12, 426] | [12, 50] | [−12, 56] |
| I | 430–1276 × 72–598 | [12, 414] | [12, 50] | [6, 56] |
| II | 236–1276 × 72–648 | [12, 220] | [12, 50] | [56, 56] |
| III | 32–1276 × 72–648 | [12, 16] | [12, 16] | [56, 56] |

- minX = area right − 1280 + 16; maxX = area left − 16, or BP.x − 392 = 50 with the shop open (whichever is smaller).
- The opening view today is scroll (49, 24), which is inside every closed range at tiers 0 and I.
- At II/III the vertical range collapses to 56. A land purchase therefore moves the view up by up to 32 px: that is the reclamp, not a jump to centre.
- With the 3.2 rule (whole area right of the panel), the shop-open range at II/III is empty, so the clamp would take its "too big" branch and centre the area, putting the Better Place under the panel. That is the deferred 3.2 review risk, and why AC 8 changes the rule to protect the Better Place only.
- Recompute the table from the final constants and paste the result into the Debug Log.

### Sim design notes

- **Derived, never stored.** The tier comes from `owned`, and `capacity` and `fenceBounds` come from the tier. Do not add `landTier`, `capacity` or `fence` to `GameState` (project-context: storing derived values is a listed mistake). As a result there is no schema bump and no migration.
- **No allocation per tick.** `fenceBounds` returns frozen TUNING rects, and `landTier` is a plain loop over `owned`. Do not use `owned.includes` three times in a chain inside `fenceBounds` unless it is just as cheap; a single loop with a switch is cleaner.
- **Fences only grow, so nothing is ever outside.** No sheep needs re-clamping on purchase, and validation stays strict.
- **The Abomination (Epic 4)** counts toward capacity and the flock counter like any sheep (FR30). The count carries no secret.
- **Determinism.** Buying land draws no rng. Existing seeded tests that never buy land must not change; tier 0 is identical to today's `startFence`/`baseCapacity`.
- **A capacity drop is impossible.** Land is never sold, so capacity never falls below the flock, and no "over capacity" state needs handling.

### What must be preserved

- **3.2 shop behaviour:** rows, looks and precedence (owned → locked → poor), the "Owned" text, the Esc chain, the panel input rules, the pings above the panel, and the money roll.
- **3.1/2.7 drop targets:** `inMarket`, `inBetterPlace`, highlights, the "Too young" check, and the rule that a release over a HUD control or the panel is a plain drop. The Market and Better Place do not move.
- **The opening view** at tiers 0/I: scroll (49, 24), with the hole at screen x ≈ 393. At II/III the opening view is whatever `centreOn` clamps to (see the table).
- **Breed tool** greying and the tooltip strings; breed mode exits when greyed.
- **Performance:** no per-frame `setText` or allocation; the fence is rebuilt only on purchase and in `create`.
- **Save:** the dragged → `wander` mapping in `savable`, corrupt-save fallback, the backup slot, and the schema at 8.

### Architecture compliance

- Capacity and fence selectors live in `sim/selectors.ts` (architecture: "selectors.ts — … flock count, capacity"). Economy stays in `systems/economy.ts`. No new system is needed: land has no per-tick rule.
- `Fence.ts` in `view/field/` (architecture tree). The new `FlockCounter.ts` goes in `view/hud/`, beside `MoneyCounter.ts`.
- **Commands in, events out:** the view reacts to `Bought`, which already exists, and adds no new event. The camera remains view state and is never saved.
- **AR21:** capacity = living sheep + pregnancies (unchanged). FR11 grey-out via `breedBlock`.

### Library / framework notes (Phaser 4.2.1 installed; no new dependencies)

- Everything needed is already in use: atlas `Image`s for the fence (`Fence.ts`), particle `explode` (dust), `Text` + `textStyle`, `setScroll` via `PenCamera`.
- Do not write Phaser 3 APIs from memory. If unsure, check `node_modules/phaser/skills/` or Context7.
- No web research is needed: no library or version changes.

### Testing standards

- Vitest covers `src/sim/`, `src/save/` and `src/config/` (the existing `tests/config/`) only; Phaser code is never tested. Test files go in `tests/<same path as src>/`, and scenarios in `tests/sim/scenarios/`.
- Helpers: `newGame(seed)` with a fixed literal seed, `runFor` (a multiple of `TICK_MS`), `fillFlock`, `innerFence` (`tests/sim/helpers.ts`, which reads `fenceBounds`, so it follows the tier), and `busyGame` (`tests/save/busy.ts`).
- Every number comes from `TUNING`/`shopPrice`, never a literal: `TUNING.landCapacities[2]`, not `50`.
- Buying in a test: set `state.money = shopPrice(item)` and then apply the real `Buy` command (`applyCommand`, or the scenario's `tickWith`), so the real path is exercised (3.1 review lesson).

### Previous story intelligence (3.2, 3.1, 2.7)

- **3.2 left these for 3.3:**
  - the `FLOCK_RESERVE` slot;
  - the "Capacity a → b" strings that must stay in step;
  - the `playArea` rebuild;
  - the shop-open inset that fails for a play area wider than 872 px (its review proved `clamp` would centre the hole under the panel);
  - a selectors test that asserts capacity ignores land, which must now change.
- **3.2 review lessons:**
  - shop UI work belongs outside the sim try/catch, so it reports `ui`, not `sim`. The fence growth goes in `onSim`'s guard, which is already `ui`;
  - numbers are Nunito (`numeric` 800). Measure "100/100" in the browser rather than trusting mockup widths ("100" alone is 40 px);
  - a widget must show a change on the frame it happens.
- **3.1 review:** tests must exercise the real view path; information draws above moving things; every Task 8 item needs recorded evidence, or the review sends it back.
- **Rylan's 3.2 decisions:** the money counter has no coin, just "$n", and all numbers are in Nunito. DESIGN.md is not yet updated (a later docs pass). The flock counter **does** keep its sheep icon (UX-DR35, mockup `.readout`), unless Rylan says otherwise (Open Question 4).
- **Browser probe setup:**
  - `playwright-core` from `/home/rylanevans/nr-csp/frontend/node_modules` with `/usr/bin/google-chrome` (SwiftShader);
  - run the DEV server on its own port (5200 worked), and stop it with `kill <vite node pid>`, never `pkill -f`;
  - plant saves via debug Load save, and read state via Dump state;
  - move the mouse in steps.
  - Known flake: the first drag after the first debug Load sometimes never starts (deferred). Do not chase it.
- **FPS baseline** (SwiftShader, ~103 sheep, ×1): about 40 idle on a quiet-ish machine; 3.2 measured on a loaded machine.

### Git intelligence

- Recent commits: `a903488` (3.2), `e64819a` (3.1 review), `4281cec` (3.1), `26fdb5b` (2.8 review; Epic 2 closed), `3ef6b6b` (2.8).
- Per-story pattern: TUNING plus selectors, then unit and scenario tests; view widgets; placeholder art with an atlas rebuild; `deferred-work.md`; and a Dev Agent Record with browser evidence and FPS.
- Commit message: `Implement story 3.3: Buy Land and Grow the Fence`.
- Branch: `story/3-3-buy-land-and-grow-the-fence` (already created from `main` at `a903488`).

### Out of scope

- **3.4:** decorations drawn in the pasture.
- **3.5:** eras, background crossfade, era badge. The era thresholds equal the land capacities (10/25/50), but 3.5 derives eras from the live count.
- **4.6:** the overcrowding rule and the crowded flock-counter style.
- **4.5/4.7/4.8:** more shop rows and the Medicine slot.
- **5.6:** a land purchase sound.
- **5.8:** a fancier fence-growth animation; the dust burst is enough here.
- Moving the Market or the Better Place, edge-panning during a drag, and camera zoom (see Open Question 1).

### Open questions (defaults chosen; confirm or change)

1. **How big Land II/III get.**
   - **Default:** everything stays within one screen (GDD Camera, "within the same screen"). The fence grows left and down only. The Market and the Better Place are fixed. Land III is denser than Land I (about 3.7 k px² per sheep vs 7.4 k).
   - **Alternative A, a bigger world with panning:** for example Land II 900×560 and Land III 1250×780. The Market moves to stay just outside the fence's right edge, and the camera pans over a world bigger than the screen. That needs edge-pan while dragging (otherwise the far pen cannot reach the Market) and makes off-screen threats possible.
   - **Alternative B, zoom the camera out per tier:** this keeps the GDD's one screen with roomier pens. But non-integer zoom shimmers with `pixelArt`, the screen-fixed shop panel in GameScene would zoom too (it would need its own camera), and every `sx + scrollX` hit test would need `getWorldPoint`.
2. **Open shop at Land II/III.**
   - **Default:** protect only the Better Place and the Market; the panel may cover the left of the pen (pings stay above it).
   - **Alternative:** close the shop automatically on a land purchase.
3. **Breed tooltip at Land III when full.**
   - **Default:** keep "No room. Buy land." (the only Voice-table string), even though no land is left to buy. Note it in deferred-work for a Voice decision.
   - **Alternative:** add a new string such as "No room." for that case.
4. **Flock counter icon.**
   - **Default:** a sheep icon plus "12/25" (UX-DR35, mockup).
   - **Alternative:** text only, like Rylan's coinless money counter.
5. **Growth cue.**
   - **Default:** an instant rebuild with dust bursts along the new rails.
   - **Alternative:** an instant rebuild with no particles, or a short tween of the rails outward (5.8 territory).

### Project Structure Notes

- New files:
  - `src/view/hud/FlockCounter.ts`
  - `tests/sim/scenarios/land.test.ts`, `tests/config/tuning.test.ts`
  - `assets/art/ui/icon-sheep.png`
- Modified:
  - `src/config/tuning.ts`
  - `src/sim/selectors.ts`, `src/sim/systems/economy.ts` (comment only)
  - `src/save/validate.ts` (comment on ordering)
  - `src/view/{strings,assetKeys}.ts`
  - `src/view/field/{PenCamera,Fence,BetterPlace}.ts` (BetterPlace: comment only)
  - `src/view/hud/BottomBar.ts`
  - `src/view/scenes/{GameScene,HudScene}.ts`
  - `assets/CREDITS.md`
  - tests: `tests/sim/{selectors,state}.test.ts`, `tests/sim/systems/breeding.test.ts`, `tests/sim/scenarios/{breeding,wander100}.test.ts`, `tests/save/{busy.ts,validate.test.ts,roundTrip.test.ts}`
  - `_bmad-output/implementation-artifacts/deferred-work.md`
- Regenerated: `public/assets/atlases/ui.{png,json}`.
- No architecture deviations expected.

### Project Context Rules (from `_bmad-output/project-context.md`)

- **Derived, never stored:** the land tier, capacity, fence and flock count all come from selectors. Capacity counts living sheep plus `state.pregnancies`.
- **Tuning:** every new number goes in `config/tuning.ts` (land capacities and fences), and tests use `TUNING`, never literals.
- **The sim is pure:** no Phaser, DOM, `Date.now()` or `Math.random()`; no allocation in per-tick code (`fenceBounds` runs every tick).
- **Save:** a new `GameState` field would need a schema bump, a migration and validation. This story adds none. Keep the round-trip and corrupt-save tests green.
- **View:** colours from `COLORS`/`COMPONENTS` (`flockCounter`: `bark`, `numeric`); copy in `strings.ts`; no hex or text literals in components; and `BitmapText` or a cached `Text` updated only on change.
- **Pooling and performance:** pooled entity sprites are never created during play. A fence rebuild on a purchase is not an entity, and it happens at most 3 times. Verify with 100 sheep at ×1 for 5 minutes in the debug overlay.
- **Listeners:** no new `bus.on`, since land growth rides the existing `sim` handler in GameScene. If one is added, remove it on SHUTDOWN.
- **No confirmations** on shop purchases (UX-DR68).
- **Done:** `npm test`, `npm run typecheck` and `npm run lint` pass, plus the browser checks.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.3; FR11, FR22, FR30; AR13, AR20, AR21; UX-DR4, UX-DR23, UX-DR24, UX-DR35, UX-DR49, UX-DR95, UX-DR101]
- [Source: _bmad-output/planning-artifacts/gdds/gdd-sheep-civilization-2026-10-05/gdd.md: Upgrade Trees (Land prices, capacities, unlock order); Camera ("no camera movement… fence expansion within the same screen"); Overcrowding (90%); era thresholds equal land capacities; pacing]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-sheep-civilization-2026-10-05/DESIGN.md: `flock-counter`; Layout & Spacing (fence grows in place; Better Place just right of the shop footprint; Market outside the fence)]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-sheep-civilization-2026-10-05/EXPERIENCE.md: Status (flock vs land capacity); Fence (its area is the capacity, grows in place); Shop row ("the fence grows"); Breed at capacity]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-sheep-civilization-2026-10-05/mockups/hud.html: Land I fence 430–1062 × 184–598; `.readout` sheep icon + "12/25"]
- [Source: _bmad-output/game-architecture.md: selectors (capacity), Movement (fence containment; drop clamp), PenCamera (pinned play area), System Location Mapping (economy.ts)]
- [Source: _bmad-output/implementation-artifacts/deferred-work.md: Fence growth vs the hole; Stale camera play area; Land tiers vs the stall; Land's effect; The open shop vs a wide play area]
- [Source: _bmad-output/implementation-artifacts/3-2-money-and-the-shop-panel.md (bar layout, camera inset, review lessons, probe setup)]
- [Source: _bmad-output/project-context.md]

## Dev Agent Record

### Agent Model Used

Claude Opus 5.5 (1M context), `claude-opus-5-5[1m]`

### Implementation Plan

- **Sim:** a single land table in `TUNING` (`landCapacities`, `landFences`, tier 0 = no land) replaces `baseCapacity`/`startFence`.
  - `selectors.ts` adds `landTier` (a plain loop over `owned`, with no allocation, because movement calls `fenceBounds` every tick) and `isLand`.
  - `capacity` and `fenceBounds` index the table by tier.
  - `HudView` gains `flock` and `capacity`.
  - No `GameState` field and no save bump: the land tier is derived from `owned`. Validation already checks `owned` before positions; that order is now commented as load-bearing.
- **View:**
  - `GameScene` keeps the `Fence` and rebuilds the focus and `playArea` in one method (`buildPlayArea`). On `Bought` with a land item, `growLand` rebuilds the fence, bursts dust at 8 points on the new rails, rebuilds the play area and re-clamps the camera. This runs inside `onSim`'s `ui` guard.
  - `PenCamera` takes a protected rect (the Better Place). With the shop open, only it must stay right of the panel; with the shop closed the limit is unchanged.
  - `centreOn` takes the same inset, so the opening view never has to move when the shop opens. This is beyond the story text; 3.1 Open Question 1 asked for it, and without it a loaded Land I game would open with the hole under the panel's footprint.
  - A DEV invariant checks that every tier's play area fits the field and that each fence stays clear of the Market and the Better Place.
  - `FlockCounter` is a 28 px sheep icon, a 4 px gap and an 88 px box ("100/100"). It sits in the old reserve at x 680–800, against a limit of 816.
- **Open Questions:** all five are implemented at their defaults: one screen; protect the Better Place only; keep "No room. Buy land."; sheep icon on the counter; dust burst.

### Debug Log References

- **Tests:**
  - New: `tests/config/tuning.test.ts` (4), `tests/sim/scenarios/land.test.ts` (6), land selectors (4), a breeding land test (1), a Land III wander case (1), a validation tier test (1).
  - Updated: every `HudView` literal; the 3.2 economy test, which now expects capacity 25 after Land I; the validation fence cases, which now use the busy game's Land I tier; `busyGame`, which owns Land I before placing the flock, so `isBusy` now requires a sheep outside the start fence.
  - `npm test`: 559 passed (3 consecutive runs); `npm run typecheck` and `npm run lint` clean.
- **Hunger test timeout:** `tests/sim/systems/hunger.test.ts` "every half-point start value…" (deferred in 3.2) timed out in 1 of 3 full runs at load average about 4. It runs in 1.1 s alone and uses nothing this story changed. It now has its own 30 s timeout. This deviates from the story's tasks; recorded in deferred-work.
- **Camera check (Task 6.3), computed from the final constants** (VIEW 1280×608, EDGE 16, shop edge 392; the opening view uses the shop-open X limit):

| Tier | Play area | X closed | X shop open | Y | Opening scroll |
|---|---|---|---|---|---|
| 0 | 442–1276 × 72–580 (834×508) | [12, 426] | [12, 50] | [−12, 56] | (49, 22) |
| I | 430–1276 × 72–598 (846×526) | [12, 414] | [12, 50] | [6, 56] | (50, 31) |
| II | 236–1276 × 72–648 (1040×576) | [12, 220] | [12, 50] | [56, 56] | (12, 56) |
| III | 32–1276 × 72–648 (1244×576) | [12, 16] | [12, 16] | [56, 56] | (12, 56) |

- **Browser (Playwright + Chrome SwiftShader, DEV server on port 5202, scratchpad probes p1–p6; no console errors in any run):**
  - 8.1: a new game shows "3/10". Land I reads $50, and Land II/III read "Needs Land I" / "Needs Land II", greyed.
  - 8.2: Land I, then II, then III were bought through the panel ($600 → $550 → $400 → $0). The fence grew in place each time, with the dust burst caught 60 ms after a click; the counter read "/25", "/50", "/100"; rows turned "Owned" and the next tier unlocked. After 20 s at Land III, 10 of 13 sheep were outside the start fence.
  - 8.3:
    - At Land III the whole fence, the hole and the Market are on screen with the shop closed. With it open, the hole stays right of the panel and the Market stays on screen; the panel covers only the pen's left edge.
    - Right-drag pans of ±600 x and ±400 y move the view only within [12, 16] × 56 (4 px).
    - A loaded Land I game opens at scroll 50, and opening the shop there moves nothing (hole at screen x ≈ 392).
  - 8.4: on a planted Land III save, a sheep at world (80, 300) was dragged to the Market (sold, $10) and one at (80, 560) into the Better Place (sacrificed, boost started), both without panning.
  - 8.5: at 10/10 with two ready adults, Breed is greyed with "No room. Buy land.". After buying Land I it is enabled ("Breed: pick two adults"), the counter reads "10/25" and the camera did not move.
  - 8.6: a planted Land II save (30 sheep, Flower Patch owned) went through Pause → Main Menu → page reload → Continue. The grown fence, "30/50" and "Owned" on Land I, Land II and Flower Patch were all restored.
  - 8.7: at 960×540 the bar has no overlap, and "$0", "30/50" and the threat counts are legible.
  - 8.8: FPS at 103 sheep, ×1, overlay open, 150 s each, sampled every 5 s (30 samples). The machine was loaded (load average 3.7 rising to 5.7, as in 3.2).
    - Land III pen: median 31 (min 26, max 35).
    - Start pen, measured right after: median 33 (min 30, max 36).
    - About 2 FPS apart, inside the load noise; 3.2's loaded-machine figure was 30–41. A quiet-machine re-measure stays with 3.6/5.11 (deferred-work).
  - 8.9: no console errors or page errors in any probe run.

- **Code review fixes (2026-10-07)** — all 12 patches applied:
  - `Fence.setBounds` now reuses its images. It adds only the extra parts a larger fence needs and hides the rest, so nothing is destroyed during play; the deferred-work entry is marked resolved.
  - **Camera:** while the whole play area fits right of the open panel (no land, Land I), all of it stays right of the panel, as in 3.2. At Land II/III only the Better Place does. Land I with the shop open now opens at scroll 38, not 50, which puts the fence at screen x ≥ 392.
  - **New DEV invariant:** `fitsWithInset` (the shop-open limits are not crossed) is checked for every tier.
  - **Land growth:** at most once per frame, after the ticks (the `landBought` flag), and dust points under the open panel are skipped.
  - **Under the open panel (Rylan's decision: option 2):** the hearts, breed markers, infection markers and pregnancy hearts of sprites under it drop to `FIELD_DEPTH.underShop` (8 999, below the panel). Alert pings stay above it. A sheep in the hand keeps its markers above.
  - **Other fixes:**
    - stale camera comments updated;
    - FlockCounter measures the largest capacity in `TUNING`;
    - the Land III case in wander100 now asserts the tier and the spread;
    - validate.test builds the busy game once and asserts `sheep[0]` is the rejected sheep.
  - **Browser (probe p7):**
    - tier 0: pans with the shop closed (all four directions) and open; the play area always stays in view, and the hole stays right of the panel when it is open.
    - Land I bought with the shop open after a pan: the fence's left edge is at the panel's margin.
    - Land II: dust lands only off the panel, and pans at Land II (left, right, up) with the shop closed keep the area in view.
    - Land III: dust off the panel.
    - On a planted Land II save with a ready and an infected sheep under the panel's footprint, opening the shop hides their hearts and bubbles; only the infected sheep's ping shows above the panel. Closing the shop restores them.
    - No console errors.
  - **FPS, now the full 5 minutes:** 103 sheep at Land III, ×1, sampled every 5 s (60 samples): median 31, min 25, max 35. The load average rose from 1.9 to 7.7 during the run. That matches the 150 s run.
  - Tests 559 passed; typecheck and lint clean.

### Completion Notes List

- 2026-10-07: Story created. Ultimate context engine analysis completed - comprehensive developer guide created.
- 2026-10-07: Implemented. All ACs met:
  - AC 1: the land rows are unchanged, and their effect lines are built from `TUNING` (browser 8.1/8.2).
  - AC 2: `capacity` follows the land tier (selectors, economy and breeding tests; 8.5).
  - AC 3, 5: the fence grows in place with dust; existing sheep do not move (`land.test.ts` a/b; 8.2).
  - AC 4: pieces, drops, births and validation follow the fence (`land.test.ts` c/d, validation tests).
  - AC 6: the flock counter (8.1/8.2/8.7, `selectHudView` test).
  - AC 7, 8: the camera fits every tier, and the open shop protects the Better Place (table above; DEV invariant; 8.3/8.4).
  - AC 9: no new state and no bump (busy round-trip, validation tier test, 8.6).
  - AC 10: no `PublicSheep` change; the view only dispatches `Buy`.
  - AC 11: tests, typecheck, lint and the browser checks.
- Beyond the story text: `centreOn` also respects the shop edge (see the Implementation Plan), and the hunger test timeout was fixed (see the Debug Log).
- Open Question 1 (how big Land II/III get) is the main thing to confirm. The default keeps one screen, which makes Land III dense.

### File List

- New:
  - `src/view/hud/FlockCounter.ts`
  - `assets/art/ui/icon-sheep.png`
  - `tests/config/tuning.test.ts`
  - `tests/sim/scenarios/land.test.ts`
- Modified:
  - `src/config/tuning.ts`
  - `src/sim/selectors.ts`
  - `src/sim/systems/economy.ts`
  - `src/save/validate.ts`
  - `src/view/assetKeys.ts`
  - `src/view/strings.ts`
  - `src/view/field/BetterPlace.ts`
  - `src/view/field/Fence.ts`
  - `src/view/field/PenCamera.ts`
  - `src/view/field/PregnancyHeart.ts` (code review)
  - `src/view/field/SheepSprite.ts` (code review)
  - `src/view/field/depths.ts` (code review)
  - `src/view/hud/BottomBar.ts`
  - `src/view/scenes/GameScene.ts`
  - `src/view/scenes/HudScene.ts`
  - `assets/CREDITS.md`
  - `tests/save/busy.ts`
  - `tests/save/validate.test.ts`
  - `tests/sim/selectors.test.ts`
  - `tests/sim/systems/breeding.test.ts`
  - `tests/sim/systems/economy.test.ts`
  - `tests/sim/systems/hunger.test.ts`
  - `tests/sim/scenarios/market.test.ts`
  - `tests/sim/scenarios/sacrifice.test.ts`
  - `tests/sim/scenarios/wander100.test.ts`
  - `src/view/hud/FlockCounter.ts` (code review)
  - `_bmad-output/implementation-artifacts/deferred-work.md`
  - `_bmad-output/implementation-artifacts/sprint-status.yaml`
- Regenerated:
  - `public/assets/atlases/ui.json`
  - `public/assets/atlases/ui.png`

### Change Log

- 2026-10-07: Story 3.3 implemented.
  - Land tiers raise capacity and grow the fence in place (one `TUNING` land table, derived from `owned`).
  - Flock counter added to the bar.
  - The camera's play area is rebuilt on purchase; the open shop protects only the Better Place.
  - Hunger test given its own timeout.
  - Status set to review.
- 2026-10-07: Code review. 1 decision (sprites under the open shop: hide their overlays), 12 patches applied, 1 deferred (camera fit has no `npm test` coverage, for 3.6), 4 dismissed. Status set to done.
