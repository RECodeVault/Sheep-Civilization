---
baseline_commit: e64819a
---

# Story 3.2: Money and the Shop Panel

Status: done

<!-- Created 2026-10-07 by create-story. Builds on 3.1 (state.money, Sold, formatMoney, salePrice pattern, save schema 7), 2.8 (boost timer, bar layout and SHOP_RESERVE), 2.6 (pings and the world-overlay band), 1.10 (Esc chain, modals) and 1.6 (BottomBar, Button). -->

## Story

As a player,
I want to see my money and open a shop panel,
so that I can spend earnings while keeping an eye on the flock.

## Acceptance Criteria

1. **Money counter (UX-DR34, UX-DR4, UX-DR5).** The bottom bar shows a `money-counter`: a `hay` coin icon and "${n}" from `formatMoney` (no K/M, no separators) in `numeric` type, `bark`, right-aligned in a fixed-width box so the icon never moves as digits change. It is read-only (no press, no hand cursor). It reads `HudView.money` (from `state.money`) once per frame and updates on the frame the balance changes; when the balance changes it **ticks** from the shown value to the new one (a sale counts up, a purchase counts down) over a short roll (see Dev Notes, "Money tick").
2. **Shop toggle (UX-DR40, UX-DR25).** A `shop-toggle` button "Shop" sits at the right end of the bar, ending at the 16 px safe edge: `wood` fill, `bark` 2 px outline, `wool` label; while the panel is open it shows the open look (`hay` fill, `bark` label). Clicking it opens the panel; clicking it again closes it. It has no keyboard shortcut. The bar is re-spaced so nothing overlaps (see Dev Notes, "Bar layout").
3. **Shop panel (UX-DR23, UX-DR63, UX-DR10, UX-DR101).** When open, a 360 px `shop-panel` (wool fill, 2 px `wood` border, `rounded.lg` top corners, padding 16, the header "Shop" in `label` type) stands on the bottom bar at the left safe margin (x 16–376), its bottom edge hidden under the bar ("rises from the bottom bar"). It lists one row per shop item. The sim **keeps running** (it is not a modal: no scrim, no pause, F/G/Breed/drag all work). It never covers the Market, the Better Place or the toasts (see AC 6). Alert pings, infection markers, hearts, float popups, particles, a dragged sheep and the sheep tooltip all draw **above** it (deferred-work "Pings above the shop panel").
4. **Closing (UX-DR73, AR8).** `Esc` closes the panel at its place in the agreed chain: close confirm → close sub-panel → cancel drag → exit breed mode → **close shop** → open/close pause. So with the shop open and nothing else active, the first Esc closes the shop and a second Esc pauses. With a drag or breed mode active, Esc ends that first and leaves the shop open. Opening the pause menu over an open shop leaves it open under the scrim; it is still open on Resume. A new game, Restart, debug Load and Main Menu → Continue start with it closed (view state, never saved).
5. **Rows (UX-DR24, UX-DR4).** Each `shop-item-row` is 56 px tall, `wool-shade`, `rounded.md`, the panel's inner width: an icon (28 px, from the `ui` atlas) at the left; line 1 the name (left) and the price (right) in `label` type, `bark`; line 2 the one-line effect in `caption` type, `bark-soft`. The rows, in GDD order: **Land I $50 "Capacity 10 → 25", Land II $150 "Capacity 25 → 50", Land III $400 "Capacity 50 → 100", Flower Patch $40 "Cosmetic", Scarecrow $80 "Cosmetic"** (Must tier only; Epic 4 appends Better Hoe I–II, Auto-feeder and Medicine). Every row shows exactly one look:
   - **buyable** (affordable, not owned, unlocked): the colours above; hover → `hay` fill and the hand cursor;
   - **unaffordable** (`money < price`): stays visible; name, price and effect all `disabled-ink`; no hover, default cursor;
   - **locked** (its Land prerequisite is not owned): the effect line reads "Needs Land I" / "Needs Land II" and the row is greyed like an unaffordable one (it cannot be bought);
   - **owned** (a one-time item already bought): the price slot reads "Owned" in `bark-soft`; name and effect stay `bark`/`bark-soft`; no hover, default cursor.
   Rows redraw only when their look changes (money crossing a price, a purchase).
6. **Buying (FR21, FR22 lock, UX-DR24, UX-DR68).** Clicking a buyable row (press and release on it) dispatches `{ type: 'Buy', item }` immediately with no confirmation. The sim (`economy.ts` `buy`) is the authority:
   - if the item is owned, locked or unaffordable **when the command applies**, nothing changes and nothing is emitted;
   - otherwise `state.money -= price`, the item is appended to `state.owned`, and `Bought { item, price }` is emitted. Buying draws no rng, takes no id, and never touches `stats.moneyEarned` (that counts earnings only).
   The money counter ticks down and the row turns "Owned" on that frame. The item's **effect** is not this story's: Land raises capacity and grows the fence in 3.3, decorations appear in the pasture in 3.4. A click on an unaffordable, locked or owned row does nothing.
7. **The panel stays clear (UX-DR23, UX-DR47, DESIGN Layout).** While the shop is open, the field camera keeps the whole play area (pen ∪ Better Place ∪ Market) **right of the panel**: the pan's left limit becomes the panel's right edge + 16 px (screen x 392) instead of the 16 px safe edge. Opening the shop while the view is panned so that the play area reaches under the panel re-clamps the camera at once. Closing it restores the normal limits (no camera move). At the opening view (scroll (49, 24)) opening the shop moves nothing (the hole is at screen x ≈ 393).
8. **The panel is not field (AR8, UX-DR65).** A left press on the open panel (rows, gaps, header) never clicks the field, picks up a sheep or clears a carcass; a right press there never pans; the sheep tooltip never shows through it. A dragged sheep released over the panel is a plain **drop** (clamped into the fence), never a sale or sacrifice. A press that started on a row and is released off it buys nothing.
9. **Money is the one balance.** `HudView` gains `money` (a number, filled in place). The DEV overlay gains an **"+$100"** button (`src/debug/`, DEV only) that adds 100 to `state.money` only (not `stats.moneyEarned`), through `GameScene.debugMutate`.
10. **Save (AR9, NFR6, NFR7).** `GameState.owned: ShopItemId[]` (one-time purchases, in purchase order, `[]` in a new game) is saved and restored. `SAVE_SCHEMA_VERSION` becomes **8**; a version-7 save migrates with `owned: []`; validation requires an array of known item ids with no duplicates and every Land tier's prerequisite present. The round-trip, corrupt-save and migration tests stay green, and `busyGame` owns at least one item.
11. **Secrecy and layering.** No new `PublicSheep` field; `Bought` carries no secret. `src/view/` never writes `money` or `owned`; the panel reads selectors and dispatches `Buy`.
12. `npm test`, `npm run typecheck` and `npm run lint` all pass. Browser checks (Task 9) pass with no console errors, with recorded evidence for each.

## Tasks / Subtasks

- [x] **Task 1: Sim: catalogue, `owned`, `Buy` and `Bought` (AC: 5, 6, 11)**
  - [x] 1.1 `src/config/tuning.ts`: add the GDD Upgrade Trees prices with a comment citing FR22/FR23: `landPrices: Object.freeze([50, 150, 400])` (Land I, II, III), `flowerPatchPrice: 40`, `scarecrowPrice: 80`. Epic 4 adds its own.
  - [x] 1.2 `src/sim/state.ts`: `export type ShopItemId = 'land1' | 'land2' | 'land3' | 'flowerPatch' | 'scarecrow';` (doc: "Story 4.x appends 'hoe1' | 'hoe2' | 'autoFeeder'; Medicine is a consumable with its own count (4.5), never in `owned`"). Add `owned: ShopItemId[]` to `GameState` after `money` (doc: "One-time shop purchases (FR22, FR23), in purchase order. Land tier and decorations are derived from it (3.3, 3.4)."), and `owned: []` in `createNewGame`.
  - [x] 1.3 `src/sim/selectors.ts` (the rules both the sim and the view read, like `salePrice`):
    - `export const SHOP_ITEMS: readonly ShopItemId[]` — the display order (Land I, II, III, Flower Patch, Scarecrow). Frozen.
    - `shopPrice(item): number` from `TUNING` (a `switch` with `assertNever`).
    - `shopRequires(item): ShopItemId | null` — `land2` → `land1`, `land3` → `land2`, else null (GDD: "each Land tier needs the previous one. Everything else is available from the start").
    - `export type BuyBlock = 'owned' | 'locked' | 'poor' | null;` and `buyBlock(state, item): BuyBlock` — in that precedence (owned, then locked, then poor). The one purchase rule.
    - `isOwned(state, item): boolean` (an `includes`; the list is at most a handful of ids).
    - `HudView.money` (filled in `selectHudView`).
    - `ShopRowView { item: ShopItemId; price: number; block: BuyBlock }` and `selectShopView(state, out: ShopRowView[]): ShopRowView[]` that fills a preallocated array in place (one entry per `SHOP_ITEMS`, no allocation per frame).
  - [x] 1.4 New `src/sim/systems/economy.ts` (architecture System Location Mapping: "Economy & shop | `src/sim/systems/economy.ts` | Money, purchases, land tiers, upgrades"). Command-only for now (no update function), like `market.ts`. Header comment: what it owns (the spend side; selling is `market.ts`), that effects of owned items are derived elsewhere (capacity 3.3, decorations 3.4, Better Hoe 4.7), and that it draws no rng.
    - `buy(state, item)`: `if (buyBlock(state, item) !== null) return;` then `const price = shopPrice(item); state.money -= price; state.owned.push(item); emit({ type: 'Bought', item, price });`.
  - [x] 1.5 `src/sim/commands.ts`: append `| { type: 'Buy'; item: ShopItemId }` with a comment ("UX-DR24: a shop row was clicked (economy.ts). Owned, locked or unaffordable when it applies → nothing."), route it, update the "Later stories append Buy (3.2), …" comment. Keep `assertNever`.
  - [x] 1.6 `src/sim/events.ts`: `| { type: 'Bought'; item: ShopItemId; price: number }` with a comment ("A Buy spent `price` on `item` (economy.ts). Story 3.3 grows the fence from it; 5.6 can add a purchase sound."). Add `Bought` to the header's variant list.
- [x] **Task 2: Save: schema 8 (AC: 10)**
  - [x] 2.1 `src/config/constants.ts`: `SAVE_SCHEMA_VERSION = 8`; extend the version comment ("8 since Story 3.2: `owned`, the one-time shop purchases (a version-7 save gets [])").
  - [x] 2.2 `src/save/migrations.ts`: `7: (s) => ({ ...s, owned: [] })` ("Story 3.2: nothing had been bought (FR22, FR23)").
  - [x] 2.3 `src/save/validate.ts`: `owned` must be an array; every entry a string in `SHOP_ITEMS`; no duplicates; for each entry with `shopRequires(item) !== null`, the prerequisite is also present. Do **not** tie `owned` to `money` or `stats.moneyEarned` (DEV "+$100" breaks any such link).
  - [x] 2.4 `tests/save/busy.ts`: set `state.owned = ['land1', 'flowerPatch']` directly (like `money`), and add `state.owned.length > 0` to `isBusy` and its doc comment. Do not run a `Buy` there (it would change `money`, which the fixture sets exactly).
- [x] **Task 3: Bar layout, money counter and Shop toggle (AC: 1, 2)**
  - [x] 3.1 New `src/view/hud/MoneyCounter.ts` (pattern: `BoostTimer`/`ThreatSummary`): the coin icon (`FRAME.iconCoin`, 2×) and a `Text` in `COMPONENTS.moneyCounter` (`numeric`, `bark`), origin (1, 0.5) at the right of a fixed box. Export `MONEY_COUNTER_W`. Size the box from the widest balance you expect to show ("$99999" measured in numeric type; the mockup's 56 px fits "$145"); a wider string grows left over nothing important — note it, do not clip. `set(money, now)` does nothing unless the target changes or a tick is running; `setText` only when the shown integer changes (UX-DR5, no per-frame string building otherwise).
  - [x] 3.2 **Money tick** (`[ASSUMPTION]`; constants in one `MONEY_MOTION` object for 5.7's reduced motion): on a change, the shown value moves from its current shown value to the new target over `rollMs` (~300 ms, ease-out), recomputed from `now` (`this.game.loop.time`) each frame; a new change mid-roll restarts from the currently shown value. The first `set` after construction shows the value at once (no roll on load or restart).
  - [x] 3.3 `src/view/hud/BottomBar.ts` re-spacing (see Dev Notes, "Bar layout"): pack the right group from the safe edge: Shop toggle `SHOP_X = canvasWidth − safeMargin − SHOP_W`, boost timer `BOOST_X = SHOP_X − GROUP_GAP − BOOST_TIMER_W`, threat summary `THREAT_X = BOOST_X − GROUP_GAP − THREAT_SUMMARY_W`. Money counter at `MONEY_X = BREED_X + BREED_W + GROUP_GAP`. Replace the old `SHOP_RESERVE`/`THREAT_MAX_RIGHT` invariants with: money end + `GROUP_GAP` + `FLOCK_RESERVE` (100 px for 3.3's flock counter, mockup `.readout` 32 + 6 + 62) ≤ `THREAT_X − GROUP_GAP`. Update the layout comments (who owns which slot; the Medicine slot (4.5) is not reserved here — see Dev Notes). No separators.
  - [x] 3.4 Shop toggle: a `Button` in `BottomBar` (`readonly shopButton`), `activateOn: 'release'`, `labelAlign: 'center'`, label `STRINGS.shopLabel`, no key hint, no tooltip (`[ASSUMPTION]`: its label says it all; the Voice table has none). Its spec: `COMPONENTS.shopToggle` has no `borderColor` and names the open look `openBackgroundColor`/`openTextColor`; add `borderColor: 'bark'` (mockup `.shop-toggle` border 2 px bark) to `COMPONENTS.shopToggle`, and build the `ButtonSpec` in `BottomBar` mapping `open*` → `active*`, so `setToggled(open)` shows the open look. Width `SHOP_W` = 80 (mockup; label + 2 × `SPACING[4]`), measure and record. 56 px tall from the spec; vertically centred in the bar.
  - [x] 3.5 `HudScene`: build the counter; in `refresh` call `money.set(v.money, now)`; add `shopButton` to `tooltipButtons` (so hover clears under modals and drags, and `controlAt` covers it) even without a tooltip; on activate call `this.gameScene.toggleShop()` (guarded like `pause`: no-op under a modal; `suppressTooltip`). Listen to `shop:toggled` and `shopButton.setToggled(e.open)`; remove the listener on SHUTDOWN.
- [x] **Task 4: The shop panel in GameScene (AC: 3, 5, 6, 8)**
  - [x] 4.1 **Where:** the panel is drawn by **GameScene**, screen-fixed (`setScrollFactor(0)` on every part), in a new depth band `FIELD_DEPTH.shop` (e.g. `9_000`: above every world `y`, below `dragged` 9 996, `overlay`, `particles`, `ping` and `tooltip`). Update `depths.ts`'s header comment and band list. This is what keeps the world overlays above it (deferred-work "Pings above the shop panel", option 1); HudScene and OverlayScene draw above all of GameScene, so the bar still covers the panel's bottom edge and a modal's scrim covers the panel.
  - [x] 4.2 New `src/view/hud/ShopPanel.ts` (a UI widget; it lives in `hud/` though GameScene builds it). Built once per game in `GameScene.create`, hidden; never created or destroyed during play.
    - Geometry constants (`[ASSUMPTION, mockups/hud.html]`): `x = safeMargin` (16), `width = COMPONENTS.shopPanel.width` (360), padding `COMPONENTS.shopPanel.padding` (16), header line 20 px, row gap 4, rows `COMPONENTS.shopItemRow.height` (56). Height = 2 + 16 + 20 + n × (4 + 56) + 16 (5 rows → 354, top y 254). The box texture is `boxTexture(scene, 360, height + RADIUS.lg, { fill: 'wool', border: 'wood', radius: RADIUS.lg, drop: true })` placed so its bottom `RADIUS.lg` px lie under the bar (bottom corners hidden; mockup `border-bottom: none`). Export `SHOP_PANEL_RIGHT` (376) for the camera.
    - Header `Text` "Shop" (`STRINGS.shopHeader`, `label`, `bark`).
    - One `ShopRow` per `SHOP_ITEMS` entry: a row box `Image` (baked textures for `normal` `wool-shade` and `hover` `hay`, `rounded.md`, no drop, border = fill), the icon `Image` (2×), name `Text`, price `Text` (origin right), effect `Text`, and a `Zone` with `setInteractive({ useHandCursor })` toggled per look (hand only when buyable). Press/release like `Button` with `activateOn: 'release'` (press must start on the row; release on the same row buys). Read `Button.ts` and mirror its hover/press/clearHover bookkeeping rather than inventing new rules.
    - `setOpen(open)`, `get isOpen`, `contains(sx, sy)` (screen-space rect test on the visible panel, allocation-free), `clearHover()`.
    - `update(rows: readonly ShopRowView[])`: per row, derive the look from `block` (`null` buyable, `'poor'` unaffordable, `'locked'` locked, `'owned'` owned) and redraw text and colours **only when the look changed**. Effect text: `STRINGS.shopEffect[item]`, or `STRINGS.shopNeeds(STRINGS.shopName[shopRequires(item)!])` when locked. Price text: `formatMoney(price)` or `STRINGS.shopOwned`.
    - `onBuy: (item) => void` callback from the constructor; GameScene passes `(item) => this.dispatch({ type: 'Buy', item })` (a rare event; the command object is fine).
  - [x] 4.3 `GameScene`:
    - `shopOpen` view state + `toggleShop()`, `closeShop(): boolean` (true if it was open — the Esc step), both emitting `bus.emit('shop:toggled', { open })` on a change (add `'shop:toggled': { open: boolean }` to `BusEvents` with a comment; the architecture names this event). `toggleShop` is a no-op under a modal.
    - In `render()` (or `update`, after the tick), only while open: `selectShopView(this.state, this.shopRows)` (preallocated in `create`) → `shopPanel.update(...)`.
    - Insert `() => this.closeShop()` in the Esc chain right after `exitBreedMode` (replace the "3.2's close shop slots in after breed mode" comment). Update the `InputHooks.esc` doc in `InputController.ts` (drop "(3.2)").
    - `hudControlAt(sx, sy)` and `pointerOnHudControl()` also return true when `shopPanel.isOpen && shopPanel.contains(...)` (for the latter, use `this.input.activePointer` x/y). This gives AC 8 for free: no field press (InputController's `pointerOnHud`), no sheep hover, and a release over the panel is a drop (`SheepDrag.end` gets `onHud = true`).
    - When a modal opens, clear the panel's row hover once (HudScene's `wasModal` pattern) so no stale `hay` row or hand cursor survives the scrim.
  - [x] 4.4 `InputController.onPointerDown`: a **right** press on the panel must not pan. Compute `onField = pointer.y < FIELD_BOTTOM && !this.hooks.pointerOnHud()` once and use it for both buttons (the left branch already checks `pointerOnHud`; keep its behaviour). A right-click there still cancels breed mode (it is still a right-click). Check the Pause button keeps its current behaviour (its right press goes through `hud:rightPressed`).
- [x] **Task 5: Camera clear of the panel (AC: 7)**
  - [x] 5.1 `src/view/field/PenCamera.ts`: give `panBy` and a new `reclamp(area, leftInset)` a `leftInset` (screen px reserved at the left; default `EDGE`). `minX`/`maxX` use it for the left edge: the area's left edge stays at or right of `leftInset`. Keep `centreOn` as is (it centres with the normal limits). Keep the "too big → centre" rule: if the area cannot fit right of the inset, centre it in the space right of the inset (`[ASSUMPTION]`; cannot happen with Land I–III widths — note in deferred-work for 3.3 to check).
  - [x] 5.2 GameScene: `panBy: (dx, dy) => this.penCamera.panBy(dx, dy, this.playArea, this.shopOpen ? SHOP_PANEL_RIGHT + LAYOUT.safeMargin : LAYOUT.safeMargin)`; on opening, `penCamera.reclamp(this.playArea, SHOP_PANEL_RIGHT + LAYOUT.safeMargin)` (instant; view state only). Record the measured limits with the shop open.
- [x] **Task 6: Strings and art (AC: 1, 2, 5)**
  - [x] 6.1 `src/view/strings.ts`: `shopLabel: 'Shop'`, `shopHeader: 'Shop'` (UX-DR95), `shopOwned: 'Owned'` (UX-DR95), `shopNeeds: (name: string) => \`Needs ${name}\`` (UX-DR95 "Needs Land {n}"; the mockup's "Needs Land II"), `shopName: Record<ShopItemId, string>` ("Land I", "Land II", "Land III", "Flower Patch", "Scarecrow"), `shopEffect: Record<ShopItemId, string>` ("Capacity 10 → 25", "Capacity 25 → 50", "Capacity 50 → 100", "Cosmetic", "Cosmetic" — mockup / GDD Upgrade Trees). Frozen records, no "!" and no banned words. The capacity numbers mirror 3.3's `TUNING` land capacities; note that in a comment (3.3 may build them from `TUNING` instead, like the old-age toast note).
  - [x] 6.2 Placeholder pixel art in `assets/art/ui/` (DESIGN palette only, 1× drawn, shown 2×, made with a throwaway scratchpad encoder like 2.x/3.1; commit only the PNGs): `icon-coin.png` (11×11: `hay` disc, `hay-deep` rim and slot — the mockup `#g-coin`), `icon-land.png`, `icon-flower-patch.png`, `icon-scarecrow.png` (14×14 each, shown 28×28). Run `npm run assets` (only `ui` changes); add `FRAME.iconCoin`, `iconLand`, `iconFlowerPatch`, `iconScarecrow`; a `SHOP_ICON: Record<ShopItemId, string>` lives with the panel (Land I–III share `icon-land`). Extend `assets/CREDITS.md`'s placeholder row and file list. Atlas stays ≤ 2048².
- [x] **Task 7: Debug (AC: 9)**
  - [x] 7.1 `src/debug/DebugOverlay.ts`: a `+$100` button (`ADD_MONEY = 100`) in row 2 → `scene.debugMutate((s) => { s.money += ADD_MONEY; })`. Update the "Later stories add their buttons here: Add money (3.2)…" comment. Optionally add `owned n` to the sheep line.
- [x] **Task 8: Tests (AC: 5, 6, 10, 12)**. Vitest covers sim and save only; the panel is browser-checked. Red first, `TUNING` values, literal seeds, no literal prices.
  - [x] 8.1 New `tests/sim/systems/economy.test.ts`:
    - **Buy:** with `money = shopPrice('flowerPatch')`, `Buy flowerPatch` → `money 0`, `owned ['flowerPatch']`, events exactly `[{ type: 'Bought', item: 'flowerPatch', price }]`; `stats.moneyEarned` unchanged; `rng` and `nextId` unchanged.
    - **Unaffordable:** `money = price − 1` → nothing changes (`structuredClone` + `toStrictEqual`), no event.
    - **Owned:** a second `Buy` of the same item → nothing.
    - **Locked:** `Buy land2` without `land1` (enough money) → nothing; after `land1`, `land2` buys; `land3` needs `land2`.
    - **Exact money:** buying with exactly the price works (`>=`, not `>`).
    - **Lost game:** `applyCommand` ignores `Buy` after a loss.
    - **No effect yet:** `capacity(state)` is unchanged after buying `land1` (3.3 changes this test's expectation).
  - [x] 8.2 `tests/sim/selectors.test.ts`: `shopPrice` per item against `TUNING`; `shopRequires`; `buyBlock` precedence (an owned item reports `owned` even when unaffordable; a locked one reports `locked` even when unaffordable); `selectShopView` fills the given array in place (same array and entries returned, one per `SHOP_ITEMS`); `selectHudView` fills `money`.
  - [x] 8.3 Scenario `tests/sim/scenarios/shop.test.ts`: sell two adults (`Sell` via the 3.1 path with aged sheep) then `Buy` an item costing at most the earnings in the same command batch order — the purchase applies after the sales; and a `Buy` queued before the `Sell` that would fund it in the same batch does nothing (commands apply in order). Money never goes negative.
  - [x] 8.4 Save tests: `migrations.test.ts` 7 → 8 adds `owned: []`, a version-2 save migrates through to `owned: []`, "newer version is rejected" uses 9; `validate.test.ts` rejects `owned` missing, not an array, an unknown id, a non-string, a duplicate, `land2` without `land1`, `land3` without `land2`; accepts `[]`, `['land1','land2','land3','flowerPatch','scarecrow']` and any order of a valid set; round-trip / `saveFile` with the busy game; `state.test.ts` new game has `owned: []`.
  - [x] 8.5 Update any test listing every `GameState` key, command or event variant. Existing seeded expectations must not move (buying draws no rng).
  - [x] 8.6 `npm test` (baseline **515** after 3.1's review), `npm run typecheck`, `npm run lint`; the `isAbomination` lint rule stays green with no new disables.
- [x] **Task 9: Browser check (AC: 1–8, 12)**. Scratchpad Playwright probe (the 2.7/3.1 setup; see Previous story intelligence). Record evidence (numbers, dumped state, screenshots looked at) for **every** item.
  - [x] 9.1 **Bar:** a new game shows "$0" with the coin; the Shop toggle ends at x 1264; measure every widget's x range (Farm … Breed, money, threat summary, boost timer while boosted, Shop) and confirm no overlap and the 100 px flock reserve; check legibility at 960×540.
  - [x] 9.2 **Money tick:** sell an adult → the counter counts up to "$10"; "+$100" → counts up; buy → counts down. Reload/Continue shows the balance at once (no roll from $0).
  - [x] 9.3 **Open/close:** toggle opens (open look) and closes; the panel stands on the bar at x 16–376, header "Shop", five rows in order with icons; its bottom corners are hidden by the bar. The sim keeps running (time advances in a dump; sheep move; F/G work; a drag works).
  - [x] 9.4 **Rows:** with $0 all five rows are greyed and Land II/III read "Needs Land I"/"Needs Land II"; with $60 Land I and Flower Patch are buyable (hover `hay`, hand), the rest grey; buy Land I → "Owned", money ticks to $10, Land II's effect now reads "Capacity 25 → 50" (still greyed: unaffordable); dump: `owned ['land1']`, `money 10`, `moneyEarned` unchanged.
  - [x] 9.5 **No buy:** clicking a greyed, locked or owned row changes nothing; pressing a buyable row and releasing off it buys nothing.
  - [x] 9.6 **Esc chain:** shop open → Esc closes it → Esc pauses; shop open + breed mode → Esc exits breed mode, shop still open, Esc closes shop; shop open + mid-drag → Esc cancels the drag only; pause over an open shop → Resume → still open.
  - [x] 9.7 **Layers:** with the panel open, a starving or infected sheep's ping and an infection marker near the panel's edge draw over it (pan the pen toward it or plant a state); a dragged sheep moved over the panel draws above it; a toast is not covered; the sheep tooltip never shows through the panel.
  - [x] 9.8 **Not field:** a click on the panel clears no carcass behind it and picks up nothing; a right-drag starting on it does not pan; a sheep dragged and released over the panel is dropped (clamped) — not sold or sacrificed — even with the hole panned near it.
  - [x] 9.9 **Camera:** at the opening view, opening the shop does not move the camera; pan fully right (play area toward the left) then open the shop → the view jumps so the hole is right of x 392; with it open, pans never bring the play area under the panel; all four limits recorded with the shop open and closed.
  - [x] 9.10 **Save:** buy Land I and the Flower Patch, hide the tab, reload → Continue: `owned` and `money` restored, rows show "Owned"; a planted version-7 save loads with `owned: []`; the shop starts closed.
  - [x] 9.11 **Performance** (SwiftShader, ~100 sheep, ×1, overlay open), shop closed and open: compare with the 3.1 baseline (40 idle, 38 dragging). The panel redraws rows only on a look change; `selectShopView` and `MoneyCounter.set` allocate nothing per frame.
  - [x] 9.12 No console errors or warnings beyond SwiftShader's GL notices.
- [x] **Task 10: Bookkeeping**
  - [x] 10.1 `deferred-work.md`: mark resolved "Pings above the shop panel (Story 3.2)" (option 1, `FIELD_DEPTH.shop`), "Shop toggle space (Story 3.2)", "Money counter (Story 3.2)" and the 3.2 part of "A crowded bottom bar". Add a 3.2 section: **3.3** land's effect (capacity from `owned`, fence growth from `Bought`, flock counter in the reserved 100 px, the effect strings vs `TUNING`, `PenCamera` inset when the play area grows); **3.4** decorations from `owned`; **4.5** the Medicine slot has no reserved space (re-space the readouts: e.g. 8 px gaps or narrower boxes) and Medicine is a repeatable row with its own count; **4.7/4.8** append rows — with 9 rows the panel's top reaches y ≈ 16 and meets the Pause button (16–56): shrink the row gap/padding or move Pause; **5.6** a purchase sound on `Bought`; **5.7** reduced motion for the money tick.

### Review Findings

- [x] [Review][Defer] Update the planning docs for Rylan's two pre-review changes — DESIGN.md (`money-counter` with a `hay` coin; `numeric`/`popup` in Pixelify Sans), UX-DR3/UX-DR34 in epics.md, and this story's AC 1 / Tasks 3.1, 6.2, 9.1 still describe the coin and the pixel digits; the code follows Rylan's decision — deferred (decision resolved by Rylan: a later docs pass)
- [x] [Review][Patch] Shop rows light up (`hay`, hand cursor) while a sheep is dragged or the field is panned across the open panel, unlike HUD buttons, which turn their input off during a drag [src/view/hud/ShopPanel.ts:180]
- [x] [Review][Patch] Leaving breed mode with the pointer on a buyable row resets the canvas cursor to the arrow; `onBreedMode` restores the hand only for a hovered HUD button [src/view/scenes/GameScene.ts:206]
- [x] [Review][Patch] Shop UI work (`refreshShop`, row hover clear) runs inside `render()` under the sim try/catch, so a shop UI throw is reported as a `sim` error and blocks saving [src/view/scenes/GameScene.ts:642]
- [x] [Review][Patch] Save validation accepts `owned` out of purchase order (e.g. `['land2', 'land1']`): check that the prerequisite comes earlier, and add the test [src/save/validate.ts:95]
- [x] [Review][Patch] Threat counts overflow their box in Nunito: "100" measures 40 px (Nunito 800, 22 px) against `COUNT_BOX_W` 34; widen it and re-pack the bar [src/view/hud/ThreatSummary.ts:19]
- [x] [Review][Patch] The money box fits "$9999" with 1 px to spare (67/68 px) and, left-aligned since the coin was removed, a longer balance grows right toward 3.3's flock reserve; size it for "$99999" (80 px) [src/view/hud/MoneyCounter.ts:12]
- [x] [Review][Patch] The money counter shows no change on the frame the balance changes (the roll starts at t = 0, so the first frame repeats the old value), against AC 1 / AC 6 "on that frame" [src/view/hud/MoneyCounter.ts:52]
- [x] [Review][Patch] The `selectShopView` test computes Land I's expected look with the rule under test (`shopPrice('land1') <= state.money ? null : 'poor'`) instead of asserting `'poor'` [tests/sim/selectors.test.ts:500]
- [x] [Review][Patch] The boost badge comment still says "18 px Pixelify 600"; the badge is now `numeric` (Nunito 800) [src/view/hud/FarmBoost.ts:16]
- [x] [Review][Defer] A play area wider than 872 px cannot fit right of the open panel: `clamp`'s too-big branch centres it, which puts its left edge (and the Better Place) under the panel (left edge at screen x ≈ 828 − w/2). Today w = 834 (38 px slack); 3.3's larger land must decide (e.g. close or narrow the shop, or let the hole sit under it). The 3.2 deferred-work note claimed it centres "right of the panel", which is wrong [src/view/field/PenCamera.ts:73] — deferred, forward risk for 3.3
- [x] [Review][Defer] Performance was measured on a loaded machine (the pre-story commit itself read 30–41 FPS); shop open vs closed was about 1 FPS apart in alternating runs, but the drop from the 40 FPS baseline was not ruled out on a quiet machine [Task 9.11] — deferred to the 3.6 playtest / 5.11 performance check

## Dev Notes

### Current code to build on (read these first)

- **`src/sim/systems/market.ts` + `selectors.ts salePrice`:** the model for `economy.ts buy` + `buyBlock` — one rule in `selectors.ts` shared by sim and view, a command-only system, emit an event, no rng, no id.
- **`src/sim/state.ts`:** `money` (3.1) sits after `boostUntil`; put `owned` right after it. `Era` shows how a string-union type lives in `state.ts`.
- **`src/sim/selectors.ts` `HudView` / `selectHudView`:** fill in place; HudScene preallocates the view object in its field initialiser — add `money: 0` there.
- **`src/save/{migrations,validate}.ts`, `tests/save/busy.ts`:** 3.1's 6 → 7 step (`money`) is the exact pattern (migration, validation, busy fixture, tests, all in one story). `validate.ts` already explains why `money` is not tied to `moneyEarned`.
- **`src/view/hud/BottomBar.ts`:** current constants: `FARM_X 16`, `FARM_W 232`, `BREED_FOOD_X 260`, `BREED_FOOD_W 200`, `BREED_X 472`, `BREED_W 104` (Breed ends at 576), `THREAT_X 858`, `THREAT_MAX_RIGHT 1080`, `BOOST_X 1092`, `SHOP_RESERVE 64`; `THREAT_SUMMARY_W 222`, `BOOST_TIMER_W 104`, `GROUP_GAP 12`. Its invariants are the place to encode the new budget.
- **`src/view/widgets/Button.ts`:** `ButtonSpec` needs `borderColor`; `activeBackgroundColor`/`activeTextColor` + `setToggled` give the open look; `activateOn: 'release'`; `clearHover`, `suppressTooltip`. Read its hover/press handling before writing `ShopRow`.
- **`src/view/widgets/box.ts`:** `boxTexture` (baked, cached per size/style), `textStyle(role, colour)`, `OUTLINE_PX`, `DROP_PX`. Never a live `Graphics` (FPS).
- **`src/view/hud/BoostTimer.ts`, `ThreatSummary.ts`:** fixed-width numeric boxes, `set` that works only on change, icons from the `ui` atlas at 2×.
- **`src/view/scenes/HudScene.ts`:** `refresh` on `PRE_RENDER`; `tooltipButtons`/`tooltipSources`, `controlAt`, `pointerOverControl`; the `wasModal` hover clear; `pause` (the guarded cross-scene call pattern).
- **`src/view/scenes/GameScene.ts`:** the Esc chain array in `create` (with the "3.2's close shop slots in after breed mode" comment), `hudControlAt`, `pointerOnHudControl`, `playArea`, `penCamera`, `render`, `debugMutate`, `modalOpen`.
- **`src/view/field/PenCamera.ts`:** `minX/maxX/minY/maxY`, the "too big → centre" clamp, `centreOn(focus, area)`, `panBy(dx, dy, area)`.
- **`src/view/field/depths.ts`:** `FIELD_DEPTH` bands (`ground −10`, world `y`, `dragged 9 996`, `overlay 9 997`, `particles 9 998`, `ping 9 999`, `tooltip 10 000`).
- **`src/input/InputController.ts`:** `InputHooks.esc` doc, `onPointerDown` (`onField`, `pointerOnHud`), `FIELD_BOTTOM`.
- **`src/view/bus.ts`:** `BusEvents` — add `'shop:toggled'`.
- **`src/config/constants.ts`:** `COMPONENTS.shopToggle`, `shopPanel`, `shopItemRow`, `moneyCounter` exist (from DESIGN front matter); `RADIUS`, `SPACING`, `LAYOUT`.
- **`src/debug/DebugOverlay.ts`:** `button(row, label, onClick)`, `scene.debugMutate`, the sheep line already prints `formatMoney(s.money)`.

### Why the panel lives in GameScene

- UX-DR10/UX-DR63/EXPERIENCE: world overlays (pings, infection markers, float popups) always draw **above** the shop panel, but the HUD layer (bar, panel, toasts, tooltip) is above the world. Pings are in GameScene's world-overlay band, and HudScene/OverlayScene draw above all of GameScene, so a panel in HudScene would cover them.
- Deferred-work offered two fixes: (1) draw the panel in GameScene, screen-fixed, below `FIELD_DEPTH.overlay`, with field input over it ignored; (2) move the world-overlay band into its own scene between the shop and the modals. (1) is far smaller and touches no existing renderer. **Chosen: (1).**
- Consequences you must handle: `setScrollFactor(0)` on every panel part (the field camera pans); the panel's interactive zones are UI widgets in GameScene (an exception to "UI widgets in HUD/Overlay may use setInteractive" — note it in the class comment); GameScene's InputController sees scene-level `pointerdown` for presses on the panel too, which is why `pointerOnHud`/`hudControlAt` must include the panel; the HUD tooltip/hover bookkeeping does not cover the rows (they have no tooltip), so clear row hover on modal yourself.
- HudScene is above GameScene; the only HUD object that can overlap the panel's area is the Pause button (16–112 × 16–56), and with 5 rows the panel top is at y ≈ 254, so they don't meet (Epic 4's 9 rows will: deferred).

### Bar layout

- Mockup order: Farm · Farm Breeding Food · Breed · Medicine (4.5) | money · flock (3.3) | threat summary · boost timer · Shop. The bar is already tight (deferred-work "A crowded bottom bar", "Shop toggle space").
- **3.2 plan** (`[ASSUMPTION, browser-check]`): pack the right group from the safe edge — Shop 1184–1264 (80), boost 1068–1172 (104), threat 834–1056 (222) — then money from 588 (Breed end 576 + 12): coin 22 + gap 6 + box (~64) ≈ 588–680; then a 100 px flock reserve for 3.3 (≈ 692–792), leaving ≈ 30 px spare before 822 (threat − gap).
- **Medicine (4.5) is not reserved** (it only appears while doses are owned). 4.5 needs ≈ 76 px; it must re-space (e.g. 8 px gaps between readouts, narrower boxes). Record this in deferred-work.
- Put each slot's width in a named constant and keep `invariant`s so a later story that overflows fails loudly in DEV.

### Money tick

- EXPERIENCE: "the money counter ticks down". View-only: the sim changes `money` instantly; the counter animates its **display** from the shown value to the target over ~300 ms (ease-out), driven by `game.loop.time`, `setText` only when the shown integer changes. Up for sales (and DEV "+$100"), down for purchases. No roll on the first `set` (load/restart/Continue). Constants in `MONEY_MOTION` for 5.7's reduced motion (which may simply show the target at once).

### Sim design notes

- **One rule, two readers:** `buyBlock(state, item)` decides for both `buy` (authority) and the row look. Precedence owned → locked → poor so an owned row never reads "Needs …" and a locked row says what it needs, not "too poor".
- **Command order matters:** commands apply at the start of the next tick in queue order, so a click on a row that became unaffordable (a second fast click) is refused by the sim; the view's look is only a hint.
- **`owned` vs derived state:** store the purchases only; capacity (3.3), fence size (3.3), decorations (3.4), pips per click (4.7) are derived from `owned` by selectors, never stored (project-context: "Storing derived values … in GameState" is a listed mistake).
- **Medicine** (4.5) is repeatable and its dose count is its own field; never put it in `owned`.
- **No toast** on a purchase: the Voice table has none; the row turning "Owned" and the counter ticking down are the feedback (3.3's fence growth adds more).

### What must be preserved

- **3.1 / 2.7 drag semantics:** threshold, press-time hit test, `onHud` guard (a release over a HUD control — now also the open panel — is a drop), cancel paths, pending slots, re-grab rules, the Market and Better Place highlights.
- **Esc chain order** (UX-DR73) and every existing step; Esc does nothing over the lose screen (except what `togglePause` already swallows).
- **The opening camera:** scroll (49, 24), hole at screen x ≈ 393–549 (3.1 Open Question 1 chose this so the open shop never covers the hole).
- **2.8 boost timer** look and behaviour (only its x moves).
- **Determinism:** `buy` draws no rng; existing seeded expectations do not move.
- **Save:** dragged → `wander` mapping in `savable`, corrupt-save tests, the backup slot.
- **Layering:** sim pure; view reads selectors and dispatches; colours from `COLORS`/`COMPONENTS`; copy from `strings.ts`; no per-frame allocation or `setText`.

### Architecture compliance

- **Locations:** `src/sim/systems/economy.ts` (System Location Mapping). The architecture tree lists `ShopPanel` under `view/overlay/`; it moves to `view/hud/` and is drawn by GameScene for the layering reason above — note the deviation in the Dev Agent Record.
- **Commands in, events out:** `Buy` → sim; `Bought` → view. `shop:toggled` is the architecture's own example UI event (`noun:verb`).
- **Money:** `formatMoney` only (no K/M), `hay` coin, never `halo` (UX-DR2).

### Library / framework notes (Phaser 4.2.1 installed; no new dependencies)

- Everything needed is already used here: `Image` from the `ui` atlas, `Text` + `textStyle`, `Zone.setInteractive`, `setScrollFactor`, `boxTexture`, tweens/`game.loop.time`.
- `setScrollFactor(0)` objects hit-test correctly against a scrolled camera in Phaser 4 (the input plugin applies the scroll factor); verify in the browser (Task 9.8) rather than assuming.
- No Phaser 3 APIs from memory (`setTintFill`, `preFX`, `BitmapMask`); check `node_modules/phaser/skills/` if unsure. No web research needed: no library or version changes.

### Testing standards

- Vitest covers `src/sim/` and `src/save/` only, in `tests/<same path as src>/`; scenarios in `tests/sim/scenarios/`.
- Helpers: `newGame(seed)`, `runFor`, `fillFlock`, `innerFence` (`tests/sim/helpers.ts`); `busyGame`/`isBusy` (`tests/save/busy.ts`). `structuredClone` + `toStrictEqual` for "nothing changed"; `drainEvents` to read events; `TUNING` / `shopPrice` for every number.

### Previous story intelligence (3.1, 2.7, 2.8)

- **3.1 review:** tests must exercise the real view path (a lamb on the stall is a `Drop`, not a `Sell`) — here, the scenario must use the real command order; information (tags) draws above moving things — the analogue here is pings above the panel; every Task 9 item needs recorded evidence, or the review sends it back.
- **2.7 review:** a release over a HUD control never triggers a target; no string building per frame; post-action checks.
- **2.8:** the save bump is migration + validation + `busyGame` + tests together; a lost game must not show stale juice (a money roll mid-loss is harmless; check the lose screen after a last-sheep sale with the shop open).
- **Browser probe setup:** `playwright-core` from `/home/rylanevans/nr-csp/frontend/node_modules` with `/usr/bin/google-chrome` (SwiftShader); DEV server on its own port (5200 worked); stop it with `kill <vite node pid>`, never `pkill -f`; plant saves via debug Load save, read state via Dump state; move the mouse in steps. An intermittent "first drag after the first debug Load never starts" exists since before 3.1 (deferred-work) — do not chase it here.
- **Baseline FPS** (SwiftShader, ~103 sheep, ×1, overlay open): 40 idle, 38 dragging.
- **Commit style:** `Implement story 3.2: Money and the Shop Panel`.

### Git intelligence

- Recent: `e64819a` (3.1 review fixes), `4281cec` (3.1), `26fdb5b` (2.8 review; Epic 2 closed), `3ef6b6b` (2.8), `f449be1` (2.7 review).
- Per-story pattern: sim rule + unit and scenario tests; save bump with migration and validation; view widgets; placeholder art + atlas rebuild; `deferred-work.md`; Dev Agent Record with browser evidence and FPS.
- 3.1 touched `GameScene.ts`, `HudScene.ts`, `strings.ts`, `selectors.ts`, `commands.ts`, `events.ts`, `migrations.ts`, `validate.ts`, `busy.ts`, `PenCamera.ts`, `depths.ts`, `DebugOverlay.ts` — read their current versions.

### Out of scope

- **3.3:** land's effect (capacity, fence growth, the flock counter, `PenCamera` area growth). **3.4:** decorations in the pasture. **3.5:** era badge. **Epic 4:** Better Hoe, Auto-feeder and Medicine rows, the Medicine slot. **5.3:** names. **5.6:** purchase/ding sounds. **5.7:** reduced motion. **5.8:** a slide-up animation for the panel (here it appears at once; optional if trivial).
- A purchase confirmation, refunds, selling items back, a shop keyboard shortcut, shop tooltips.

### Open questions (defaults chosen; confirm or change)

1. **Which rows in 3.2.**
   - **Default:** all five Must items, buyable now (money is spent, rows show "Owned"); effects arrive in 3.3/3.4.
   - **Alternative:** list them but grey them until 3.3/3.4 — avoids "paid for nothing" during the sprint, but leaves `Buy` untestable in the browser.
2. **Panel layer.** **Default:** in GameScene (screen-fixed, `FIELD_DEPTH.shop`). **Alternative:** HudScene, with the world overlays moved to their own scene (bigger change).
3. **Camera while the shop is open.** **Default:** pin the play area right of the panel (re-clamp on open). **Alternative:** let the panel cover the panned hole (simpler; breaks DESIGN "never covers the Better Place").
4. **Locked rows.** **Default:** greyed like unaffordable, effect "Needs Land I/II". **Alternative:** normal colours with only the effect line changed.
5. **Money tick.** **Default:** ~300 ms roll both ways. **Alternative:** instant number change.
6. **Bar.** **Default:** right group packed from the edge, money after Breed, 100 px flock reserve, no Medicine reserve. **Alternative:** reserve Medicine now and narrow other widgets.
7. **Shop toggle tooltip.** **Default:** none. **Alternative:** a short `[ASSUMPTION]` tooltip like Pause's.

### Project Structure Notes

- New files:
  - `src/sim/systems/economy.ts`
  - `src/view/hud/MoneyCounter.ts`, `src/view/hud/ShopPanel.ts`
  - `tests/sim/systems/economy.test.ts`, `tests/sim/scenarios/shop.test.ts`
  - `assets/art/ui/{icon-coin,icon-land,icon-flower-patch,icon-scarecrow}.png`
- Modified:
  - `src/config/{tuning,constants}.ts` (constants: schema version, `shopToggle.borderColor`)
  - `src/sim/{state,selectors,commands,events}.ts`
  - `src/save/{migrations,validate}.ts`
  - `src/input/InputController.ts` (right-press `onField`, Esc doc)
  - `src/view/bus.ts`, `src/view/strings.ts`, `src/view/assetKeys.ts`
  - `src/view/field/{PenCamera,depths}.ts`
  - `src/view/hud/BottomBar.ts`
  - `src/view/scenes/{GameScene,HudScene}.ts`
  - `src/debug/DebugOverlay.ts`
  - `assets/CREDITS.md`
  - tests: `tests/sim/{selectors,state,commands}.test.ts`, `tests/save/{busy.ts,migrations.test.ts,validate.test.ts,saveFile.test.ts,roundTrip.test.ts}`
  - `_bmad-output/implementation-artifacts/deferred-work.md`
- Regenerated: `public/assets/atlases/ui.{png,json}`.
- Deviation: `ShopPanel` in `view/hud/`, drawn by GameScene (architecture tree: `view/overlay/`), for the pings-above-panel rule.

### Project Context Rules (from `_bmad-output/project-context.md`)

- **No confirmations** on shop purchases (UX-DR68); the only confirm is start-over.
- **Save:** a new `GameState` field requires a `SAVE_SCHEMA_VERSION` bump, a migration and validation in the same story; round-trip and corrupt-save tests stay green; storage only in `src/save/`.
- **Derived, never stored:** land tier, capacity, decorations shown, pips per click — all from `owned`.
- **The sim is pure:** no Phaser, DOM, `Date.now()`, `Math.random()`; prices in `TUNING`; colours from `COLORS`/`COMPONENTS` (money `hay`, never `halo`; `wood` for the toggle and panel border); copy in `strings.ts` (no "!", no banned words).
- **Input:** a single `InputController`; field hit tests in world coordinates; HUD-type widgets may `setInteractive` (here, in GameScene — documented exception).
- **Performance:** no allocation or `setText` per frame; baked box textures, never live `Graphics`; widgets built once per game.
- **Listener cleanup:** every `bus.on` (`shop:toggled`) removed on SHUTDOWN; restart must not double-subscribe.
- **Done:** `npm test`, `npm run typecheck`, `npm run lint` pass, plus the browser checks and the 100-sheep FPS spot check.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.2; FR21, FR22, FR23; AR7, AR8, AR9, AR13, AR15, AR22; UX-DR2, UX-DR4, UX-DR5, UX-DR10, UX-DR23, UX-DR24, UX-DR25, UX-DR34, UX-DR40, UX-DR63, UX-DR68, UX-DR73, UX-DR95, UX-DR101]
- [Source: _bmad-output/planning-artifacts/gdds/gdd-sheep-civilization-2026-10-05/gdd.md#Upgrade Trees (prices, unlock conditions, one flat shop); Economy and Resources (money: selling only, no cap, hundreds, no K/M)]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-sheep-civilization-2026-10-05/DESIGN.md: components `shop-toggle`, `shop-panel`, `shop-item-row`, `money-counter`; Colors (`wood`, `hay`, money never `halo`); Layout (shop panel left, never covers Market/Better Place; toasts top-centre); Elevation (world overlays above the shop panel)]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-sheep-civilization-2026-10-05/EXPERIENCE.md: IA (Shop panel, running); Component Patterns (Shop toggle, Shop panel / row, Money counter); State Patterns (Shop open); Interaction (Esc chain)]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-sheep-civilization-2026-10-05/mockups/hud.html: `.shop`, `.row`, `.shop-hd`, `.shop-toggle`, `.readout`, `#g-coin`; row texts]
- [Source: _bmad-output/game-architecture.md: System Location Mapping (`economy.ts`), Scene Structure (`Buy` command), Event System (`shop:toggled`), Input Handling (Esc chain), Formats (`formatMoney`)]
- [Source: _bmad-output/implementation-artifacts/deferred-work.md: Pings above the shop panel; A crowded bottom bar; Shop toggle space; Money counter; Baked box textures]
- [Source: _bmad-output/implementation-artifacts/3-1-sell-sheep-at-the-market.md (camera choice for the shop, review lessons, probe setup)]
- [Source: _bmad-output/project-context.md]

## Dev Agent Record

### Agent Model Used

Claude Opus 5.5 (1M context), `claude-opus-5-5[1m]`

### Implementation Plan

- **Sim:** `TUNING.landPrices` / `flowerPatchPrice` / `scarecrowPrice`; `ShopItemId` and `GameState.owned` (`[]` at a new game); in `selectors.ts` `SHOP_ITEMS`, `shopPrice`, `shopRequires`, `isOwned`, `buyBlock` (owned → locked → poor), `ShopRowView` / `selectShopView` (fills in place) and `HudView.money`; command-only `systems/economy.ts` `buy`; the `Buy` command and `Bought` event.
- **Save:** schema 8; migration `7 → owned: []`; validation of `owned` (known ids, no duplicates, Land prerequisites); `busyGame` owns Land I and the Flower Patch.
- **View:**
  - `hud/MoneyCounter.ts`: the coin and a right-aligned 68 px box (fits "$9999"); rolls to a new balance over 300 ms (`MONEY_MOTION`), shows the first value at once, and calls `setText` only when the shown number changes.
  - `BottomBar`: the right group is packed from the safe edge (Shop 1184–1264, boost 1068–1172, threats 834–1056); money is at 588–684, with a 100 px flock reserve; the invariants are updated. The Shop toggle is a `Button` whose toggled look is `shop-toggle`'s open look (`COMPONENTS.shopToggle` gains `borderColor: 'bark'`).
  - `hud/ShopPanel.ts`, built by GameScene:
    - all parts are screen-fixed in `FIELD_DEPTH.shop` (9000);
    - the 360 px box runs `RADIUS.lg` below the bar, so its bottom corners hide under it;
    - five rows: icon, name, price, effect; looks buy / poor / locked / owned; a `hay` hover and hand cursor only when buyable;
    - a row buys on press + release on that row;
    - `contains`, `clearHover`, and `update`, which repaints a row only on a change.
  - `GameScene`:
    - `shopOpen`, `toggleShop`, `closeShop` (an Esc step after breed mode) and `shop:toggled`;
    - `selectShopView` → `update` each frame while open;
    - `hudControlAt` / `pointerOnHudControl` count the open panel;
    - opening re-clamps the camera with `leftInset = SHOP_PANEL_RIGHT + 16`;
    - row hover is cleared when a modal opens.
  - `PenCamera`: `panBy(…, leftInset)` and `reclamp`.
  - `InputController`: `onField` excludes `pointerOnHud()` for right presses too (no pan from the panel).
  - `HudScene`: the counter, the toggle (in `tooltipButtons` without a tooltip) and the `shop:toggled` look.
- **Art:** `ui/icon-coin` (11×11), `icon-land`, `icon-flower-patch`, `icon-scarecrow` (14×14); the `ui` atlas has 11 frames (184×20).
- **Debug:** a "+$100" button; the sheep line shows `owned n`.

### Debug Log References

- **Red phase:**
  - Before the sim code, the new economy, selector and state tests failed (9 failed in `tests/sim`), and the save tests failed (13) before schema 8.
  - After: 515 → 541 tests (26 new), all pass. Typecheck and lint are clean.
  - The first draft of the shop scenario picked the founding lamb as a seller; the scenario now picks five adults.
- **Deviations from the task text:**
  - **`closeShop` passes under a modal (bug found in the browser, Task 9.6):**
    - The first build closed the shop **under the pause scrim** when Esc was pressed in the pause menu, because the close-shop step comes before pause in the chain. The game then stayed paused.
    - Now `closeShop` returns false while a modal is up, so Esc resumes and the shop is still open (AC 4).
    - Over the lose screen, Esc still does nothing.
  - **The money box is 68 px.** The constructor asserts "$9999" fits, rather than measuring "$99999".
  - **The Shop toggle has no tooltip** (Open Question 7 default).
- **Browser probe:**
  - Setup: a scratchpad `playwright-core` with system Chrome (SwiftShader) and the DEV server on port 5200; states were planted through the debug Load save prompt and read with Dump state.
  - No console errors or warnings in any run, apart from SwiftShader's GL notices and the probe's own clipboard-permission notice.
  - **9.1 Bar:**
    - A new game shows the coin and "$0".
    - Measured on screenshots with the boost running: Farm 16–248, Farm Breeding Food 260–460, Breed 472–576, money 588–684, threat summary 834–1056, boost timer 1068–1172, Shop 1184–1264. Nothing overlaps.
    - The 100 px flock reserve is free (696–796), and the Shop toggle ends at the 1264 safe edge.
    - At 960×540 the rows, counter and toggle are legible.
  - **9.2 Money tick:**
    - Loading a $60 state showed "$60" at once (no roll).
    - Buying Land I showed "$11" mid-roll, then "$10".
    - Continue showed "$110" at once.
    - +$100 counted up.
  - **9.3 Open/close:**
    - The toggle opens the panel in its open look (`hay`) and closes it.
    - The panel stands on the bar at x 16–376 with "Shop" and the five rows in order, with icons; its bottom corners are hidden by the bar.
    - The sim kept running: time went from 2400 to 4700 ms with the shop open.
    - Eight F presses with the shop open dropped one food piece.
  - **9.4 Rows:**
    - At $0, every row is greyed and Land II/III read "Needs Land I" / "Needs Land II".
    - At $60, Land I and the Flower Patch are buyable (`hay` hover; the canvas cursor is `pointer`).
    - Buying Land I gave "Owned" and $10; Land II then read "Capacity 25 → 50" (greyed).
    - Dump: `owned ['land1']`, `money 10`, `moneyEarned 0`.
    - (The Pixelify "5" makes "$50" read like "$S0", as noted in 3.1.)
  - **9.5 No buy:**
    - Clicking Land II (unaffordable), Land III (locked), Land I (owned) and the Scarecrow (unaffordable) changed nothing (`money 10`, `owned ['land1']`).
    - With $110, a press on the Flower Patch released off it bought nothing.
  - **9.6 Esc chain:**
    - With the shop open and breed mode on, Esc 1 exited breed mode (shop still open), Esc 2 closed the shop, and Esc 3 paused.
    - Pause over an open shop, then Esc, resumed with the shop still open (after the fix above).
    - With the shop open, Esc mid-drag cancelled the drag only: the sheep went back to its pickup spot and the shop stayed open.
  - **9.7 Layers:**
    - An infected adult dragged over the panel drew above it, together with its alert ping and infection marker.
    - The sale toast showed with the panel open (top-centre, not covered).
    - With the shop open the camera never lets the pen under the panel, so a wandering sheep (and its tooltip) can never be under it.
  - **9.8 Not field:**
    - A sheep dragged and released over the panel was dropped and clamped into the fence (x ≈ 596 + one tick of walking), not sold or sacrificed (`money 0`, `sold 0`, `sacrificed 0`).
    - A right-drag starting on the panel did not pan (the hole stayed at screen x 393).
  - **9.9 Camera:**
    - At the opening view (scroll (49, 24)), opening the shop moves nothing.
    - With the shop closed and panned to the far right, the hole sits under the Pause button (screen x 16–172, scroll x 426). Opening the shop then moves the view at once: the hole is at screen x 392 (scroll x 50).
    - With the shop open, a pan right stops at scroll x 50 and a pan left at scroll x 12 (hole at 430). The vertical limits are unchanged.
  - **9.10 Save:**
    - After buying Land I and the Flower Patch, Pause → Main Menu saved schema 8 with `owned ["land1","flowerPatch"]` and `money 110`.
    - Continue restored both; the rows show "Owned"; the shop starts closed.
    - A version-7 save (no `owned`) loaded with `owned []`.
  - **Last sheep with the shop open:**
    - Selling the last adult showed the lose screen over the panel, with the toast "A sheep sold. $10." and the counter at $10.
    - Esc did nothing (no pause, no shop change).
  - **9.11 Performance** (SwiftShader, 103 sheep, ×1, overlay open):
    - This machine was busy and noisy during the check (load average 6–8 from other processes): the pre-story commit e64819a, measured in a scratch worktree, read 30–41 FPS in two runs.
    - In the story build, alternating the shop closed and open every 3 s in one run gave closed 29.7 / 27.3 / 27.0 / 30.7 (mean 28.7) and open 25.3 / 27.0 / 29.0 / 29.0 (mean 27.6). About 1 FPS, within the noise.
    - `selectShopView` and `MoneyCounter.set` allocate nothing per frame.
    - `ShopPanel.update` repaints only on a change.
  - **Test timeout under load:**
    - With the machine loaded, the existing `hunger.test.ts` "every half-point start value…" test (about 120 000 ticks) sometimes passed Vitest's 5 s default in full-suite runs.
    - It takes 1.1–1.6 s alone, both with and without this story's changes, and the suite passes once the load drops.
    - Recorded in `deferred-work.md`; the test was not changed.

### Completion Notes List

- 2026-10-07: Story created. Ultimate context engine analysis completed — comprehensive developer guide created.
- 2026-10-07: Implemented. All ACs are met; the Open Questions are implemented at their defaults:
  1. all five Must rows can be bought;
  2. the panel is in GameScene;
  3. the camera is pinned right of the panel while it is open;
  4. locked rows are greyed;
  5. the money rolls (300 ms);
  6. the bar layout has no Medicine reserve;
  7. the toggle has no tooltip.
- AC evidence:
  - AC 1–5, 7, 8: browser checks (above).
  - AC 6: `economy.test.ts`, `scenarios/shop.test.ts` and `selectors.test.ts`, plus browser purchases.
  - AC 9: the "+$100" button (browser) and `selectHudView` money (test).
  - AC 10: migration, validation, `busyGame`, round-trip tests and the browser save/Continue/v7 load.
  - AC 11: `PublicSheep` is unchanged; `Bought` carries only `item` and `price`; the view only dispatches `Buy`.
  - AC 12: `npm test` (541), `npm run typecheck` and `npm run lint` pass.
- 2026-10-07, Rylan's changes before review:
  - **No coin on the money counter:** it is just "$n", left-aligned at x 588. The `icon-coin` art, its frame and `COMPONENTS.moneyCounter.iconColor` are removed; the `ui` atlas has 10 frames (167×20).
  - **Numbers in a readable font:** the `numeric` and `popup` roles are now Nunito (800 and 900) instead of Pixelify Sans, whose digits were hard to read (the 5 read as an S).
  - That covers every number: meter counts, money, the boost timer and its "×2" badge, the threat counts, the lose screen's stats and the float popups.
  - Shop prices (`shopItemRow.priceTypography`) and the Market's price tag also moved from `label` to `numeric`. The tag's "Too young" is Nunito too.
  - The F/G key hints are letters, so they keep the pixel face (`title` at 18 px).
  - This departs from DESIGN.md / UX-DR3 (numeric and popup in Pixelify Sans, a coin on the money counter); those docs are not updated here.
  - Browser-checked at 1280×720 and 960×540: "$145", "$50"/"$150"/"$400", "1/8", "×2 0:28", the threat counts, the Market's "$10" tag and "Survived 0:01 · Peak flock 3" all read clearly. No console errors. Tests (541), typecheck and lint pass.
- A purchase has no sound (5.6), and the panel appears at once (5.8). Both are recorded in `deferred-work.md`, with the 3.3/3.4/4.x follow-ups.

### File List

- `src/config/tuning.ts` (modified)
- `src/config/constants.ts` (modified)
- `src/sim/state.ts` (modified)
- `src/sim/selectors.ts` (modified)
- `src/sim/commands.ts` (modified)
- `src/sim/events.ts` (modified)
- `src/sim/systems/economy.ts` (new)
- `src/save/migrations.ts` (modified)
- `src/save/validate.ts` (modified)
- `src/input/InputController.ts` (modified)
- `src/view/bus.ts` (modified)
- `src/view/strings.ts` (modified)
- `src/view/assetKeys.ts` (modified)
- `src/view/field/PenCamera.ts` (modified)
- `src/view/field/depths.ts` (modified)
- `src/view/hud/BottomBar.ts` (modified)
- `src/view/hud/ThreatSummary.ts` (modified: count box for Nunito, review)
- `src/view/hud/FarmBoost.ts` (modified: comment, review)
- `src/view/hud/MoneyCounter.ts` (new)
- `src/view/hud/ShopPanel.ts` (new)
- `src/view/scenes/GameScene.ts` (modified)
- `src/view/scenes/HudScene.ts` (modified)
- `src/debug/DebugOverlay.ts` (modified)
- `assets/art/ui/icon-land.png`, `icon-flower-patch.png`, `icon-scarecrow.png` (new)
- `src/view/field/Market.ts` (modified: the price tag's font)
- `src/view/widgets/Button.ts` (modified: the key hint keeps the pixel font)
- `assets/CREDITS.md` (modified)
- `public/assets/atlases/ui.png`, `public/assets/atlases/ui.json` (regenerated)
- `tests/sim/systems/economy.test.ts` (new)
- `tests/sim/scenarios/shop.test.ts` (new)
- `tests/sim/selectors.test.ts` (modified)
- `tests/sim/state.test.ts` (modified)
- `tests/sim/scenarios/market.test.ts` (modified: `HudView.money`)
- `tests/sim/scenarios/sacrifice.test.ts` (modified: `HudView.money`)
- `tests/save/busy.ts` (modified)
- `tests/save/migrations.test.ts` (modified)
- `tests/save/validate.test.ts` (modified)
- `_bmad-output/implementation-artifacts/deferred-work.md` (modified)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modified)
- `_bmad-output/implementation-artifacts/3-2-money-and-the-shop-panel.md` (this story)

### Change Log

- 2026-10-07: Code review (Blind Hunter, Edge Case Hunter, Acceptance Auditor): 9 patch findings fixed, 3 deferred (the docs for Rylan's font and coin changes — Rylan chose a later docs pass; a play area too wide for the open shop, for 3.3; a performance re-check on a quiet machine), 9 dismissed.
  - **Fixes:**
    - Shop rows no longer hover or take presses while a sheep is dragged or the field is panned (`ShopPanel.setLive`, `InputController.panningField`).
    - Leaving breed mode over a buyable row keeps the hand cursor.
    - The shop's per-frame work runs in its own `ui` try/catch outside `render()`.
    - Save validation requires `owned` in purchase order, with a new test.
    - The threat count box is 40 px ("100" in Nunito 800 measures 40); the bar re-packs, with the threat summary at x 816.
    - The money box is 80 px, so "$99999" fits.
    - The money roll moves on the frame of the change (it starts one frame in and rounds toward the target).
    - The `selectShopView` test asserts `'poor'` directly.
    - The boost badge comment is fixed.
  - **Browser-checked:**
    - Dragging a sheep over Land I: no `hay` hover, and the cursor is the default.
    - In breed mode over a buyable row, Esc exits breed mode and the cursor stays `pointer`.
    - The bar shows "$99999" and the counts without overlap.
    - The roll's first-frame move is from code reasoning: no screenshot caught that exact frame.
    - No console errors.
  - Tests 542; typecheck and lint are clean. Status → done.

- 2026-10-07: Rylan's changes before review: the money counter has no coin icon; numbers (`numeric`, `popup`, shop prices, the Market tag) use Nunito instead of Pixelify Sans for legibility.

- 2026-10-07: Implemented Story 3.2. Money and the shop panel:
  - the `Buy` command, `economy.ts` and the `Bought` event; `state.owned` with save schema 8 (migration and validation); the shop selectors (`buyBlock`, `selectShopView`) and `HudView.money`;
  - the rolling money counter, the Shop toggle and the re-spaced bottom bar;
  - the shop panel, drawn in GameScene below the world overlays, with buy / poor / locked / owned rows;
  - the Esc close-shop step (passes under a modal); the camera kept right of the open panel;
  - DEV "+$100"; placeholder icons; 26 new tests.

  Status → review.
