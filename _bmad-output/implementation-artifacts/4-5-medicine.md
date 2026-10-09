---
baseline_commit: 8e0283a
---

# Story 4.5: Medicine

Status: done

<!-- Created 2026-10-08 by create-story. Fifth story of Epic 4 (Should tier). The player's paid counter to the virus: buy a dose in the shop ($15, repeatable), drag it from a new bottom-bar Medicine slot onto a green sheep, and it is cured on the next tick. Most of the pieces exist: the view already undoes infection when `PublicSheep.infected` turns false (SheepSprite.setInfected(false), AlertPing.hide, the threat count), `COMPONENTS.medicineSlot` is defined, and the state.ts / virus.ts / commands.ts comments already reserve the design ("Medicine is a consumable with its own dose count, never in `owned`"; "medicine cures by deleting `infectedAt`"). New: a `medicine` dose count in GameState (schema 10 → 11), `ApplyMedicine` + `Cured`, a `medicine` shop row, the `medicine-slot` widget, a dose drag in InputController, and a bottom-bar re-space (there is no room for the slot today: deferred-work "A crowded bottom bar"). Key findings: (1) the slot lives in HudScene, whose zones capture the press, so the drag is started over the bus like the Breed tool (`'medicine:pressed'`), and the dragged bottle must be drawn in HudScene to show above the bar; (2) `SHOP_ITEMS` is the one-time list that save validation trusts for `owned`, so the panel gets a separate `SHOP_ROWS`; (3) curing must never touch the Abomination's secret `doomedAt`. -->

## Story

As a player,
I want to buy medicine and drag it onto an infected sheep,
so that I can save a sheep instead of sacrificing it.

## Acceptance Criteria

1. **Medicine is a repeatable shop row (FR26, UX-DR23, UX-DR24).** The shop panel shows a sixth row, **Medicine**, last (GDD Upgrade Trees order; Better Hoe and Auto-feeder will be inserted before it in 4.7/4.8): bottle icon, name "Medicine", price "$15" (`TUNING.medicinePrice`), effect line "Cures 1 infected sheep" (GDD). Clicking it with ≥ $15 dispatches `Buy { item: 'medicine' }`: `money −= 15`, `state.medicine += 1`, `Bought { item: 'medicine', price: 15 }`. It never shows "Owned" and is never locked; under $15 it is greyed (`disabled-ink`) like any unaffordable row. `'medicine'` never enters `state.owned`.
2. **The Medicine slot (UX-DR33, UX-DR25).** While `state.medicine ≥ 1`, a `medicine-slot` shows in the bottom bar right after Breed: a `wool` tile (rounded.md, bark-soft border, the usual drop), the infection-coloured bottle icon, and "×{n}" in `numeric` `bark`. With 0 doses it is hidden (not greyed) and takes no input, but its space stays reserved (nothing else in the bar moves). It updates on the frame the count changes. Hovering it (~300 ms) shows a tooltip (`STRINGS.medicineTooltip`, [ASSUMPTION] "Drag onto a green sheep to cure it.").
3. **Drag a dose (UX-DR33, UX-DR66, AR8).** A left press on the slot that moves past 6 px picks up one dose: a bottle follows the pointer (drawn above the bar and the field), the slot's count shows one less (it may read "×0" while the last dose is in hand), the sheep tooltip and HUD hover are off (as for a sheep drag). A press released within 6 px does nothing. A press on the slot in breed mode exits breed mode first, then behaves as above [ASSUMPTION].
4. **Drop on an infected sheep cures it (FR26).** Releasing over an infected sheep (hit-tested against infected sheep only, world coordinates, same box rule as `spriteIndexAt`) dispatches `ApplyMedicine { id }`. When it applies (next tick) the sim deletes `infectedAt`, sets `medicine −= 1` and emits `Cured { id, x, y }`. The view's existing recovery path then removes the green tint, the bubble marker, the wobble and the ping, and the threat summary's infected count drops. The slot shows the new count (and hides at 0) with no flicker back to the old count between release and tick.
5. **Drop anywhere else returns the dose (UX-DR33, UX-DR73).** A release over a healthy sheep, empty field, the Market, the Better Place, the shop panel, a HUD control or off the canvas; `Esc` mid-drag (the Esc chain's "cancel drag" step); a modal opening; or window blur: the bottle disappears, the slot count returns, **no command is sent** and no dose is used.
6. **The sim is the authority.** `ApplyMedicine` does nothing (dose kept, no event) when: no dose is owned (`medicine < 1`), the id is gone (it died, was sold or sacrificed between release and tick), the sheep is not infected, or the game is lost (`applyCommand` already returns on `lostAt`). It draws no rng.
7. **Secrecy holds (AR18, UX-DR64).** Medicine cures infection only. It never reads or clears `doomedAt`, `stalk`, `isAbomination` or `state.abomination`: an infected Abomination victim that is cured still dies at its `doomedAt` (cause `abomination`, the vague toast). The Abomination itself can be infected and cured like any lamb; `Cured` is identical for it. No view code reads a secret field (lint unchanged).
8. **Save (AR9).** `GameState.medicine: number` (whole doses, ≥ 0, 0 at new game). `SAVE_SCHEMA_VERSION` 10 → 11 with migration step `10: (s) => ({ ...s, medicine: 0 })`. `validateState` requires an integer ≥ 0. A dose in hand is view-only: a save mid-drag holds the full count (the dose was never spent).
9. **Bottom bar re-spaced (deferred-work "A crowded bottom bar", "The Medicine slot").** The slot fits between Breed and the money counter without overlapping the threat summary, and the existing `invariant`s in `BottomBar.ts` are extended to cover it. Default: Farm button 232 → 160 px wide (see Task 6.1; its 6-pip bar is 144 px). Checked in the browser at 1280×720 and 960×540.
10. **Audio, juice and reduced motion are deferred.** No sound (AudioDirector is 5.6): record a cure sound on `Cured` and a pick-up/put-back sound. A cure sparkle is optional juice ([ASSUMPTION], Task 7.4). No toast for a cure (the Voice table has none).
11. **Done = `npm test`, `npm run typecheck` and `npm run lint` all pass**, and the browser checks in Task 9 pass.

## Tasks / Subtasks

- [x] **Task 1: Tuning, state, save (AC 1, 8)**
  - [x] 1.1 `src/config/tuning.ts`: `medicinePrice: 15` next to `scarecrowPrice`, comment `FR26 / GDD Upgrade Trees: "Medicine (per dose) | Consumable | $15"`. Check `tests/config/tuning.test.ts` for a GDD-values block and add it there if prices are pinned.
  - [x] 1.2 `src/sim/state.ts`:
    - Add `export type ShopRowId = ShopItemId | 'medicine';` with a doc comment: a row in the shop panel; `'medicine'` is a consumable, counted in `GameState.medicine`, never in `owned`. Update the `ShopItemId` comment (Epic 4 still appends `'hoe1' | 'hoe2' | 'autoFeeder'` there; medicine is a row, not an item).
    - `GameState.medicine: number` after `owned`, doc: "Doses of medicine owned (FR26, Story 4.5): bought in the shop (economy.ts), used by ApplyMedicine (medicine.ts). Whole number ≥ 0. A dose in the player's hand is view-only and still counted here."
    - `createNewGame`: `medicine: 0`.
  - [x] 1.3 `src/config/constants.ts`: `SAVE_SCHEMA_VERSION = 11`.
  - [x] 1.4 `src/save/migrations.ts`: step `10: (s) => ({ ...s, medicine: 0 })` with a comment in the file's style ("Story 4.5: no dose had been bought (FR26).").
  - [x] 1.5 `src/save/validate.ts`: `int(s, 'medicine', 'state', 0);` beside `money`, comment: FR26 doses, no cap; not tied to money (DEV +$100). **Do not** change the `owned` check: it must keep rejecting `'medicine'` in `owned` (it uses `SHOP_ITEMS`, which stays one-time items only; Task 2.1).
  - [x] 1.6 Tests (`tests/save/`): `migrations.test.ts` (a version-10 state gains `medicine: 0`, and the chain from the oldest supported version still reaches 11; update any "current version" literal tests and the `fromVersion8.ts` fixture expectations if they assert the full migrated shape); `validate.test.ts` (rejects missing, negative, fractional, string `medicine`; rejects `owned: ['medicine']`); `busy.ts` gives the busy save `medicine: 2` and its "is busy" check includes it; `roundTrip.test.ts` stays green.

- [x] **Task 2: Shop rows and the purchase (AC 1)**
  - [x] 2.1 `src/sim/selectors.ts`:
    - Keep `SHOP_ITEMS` exactly as is (one-time items; save validation and `isLand`/`isDecoration` tests rely on it).
    - Add `export const SHOP_ROWS: readonly ShopRowId[] = Object.freeze([...SHOP_ITEMS, 'medicine']);` — "The shop panel's rows, in display order (GDD Upgrade Trees): the one-time items, then the consumables. 4.7/4.8 add Better Hoe and the Auto-feeder to SHOP_ITEMS, before Medicine."
    - Widen `shopPrice`, `shopRequires`, `buyBlock` to `ShopRowId`. `shopPrice('medicine') = TUNING.medicinePrice` (keep the `assertNever` default). `shopRequires('medicine') = null`. `buyBlock`: medicine is never `'owned'` (skip `isOwned` for it; `isOwned` keeps its `ShopItemId` parameter), never locked, `'poor'` under its price.
    - `ShopRowView.item: ShopRowId`; `selectShopView` iterates `SHOP_ROWS`.
    - `isLand` / `isDecoration` take `ShopRowId` (so `Bought.item` can be passed; they stay false for medicine).
    - `HudView.medicine: number` (doses owned, the slot) filled in `selectHudView`.
  - [x] 2.2 `src/sim/commands.ts`: `Buy { item: ShopRowId }` (update the comment). `src/sim/events.ts`: `Bought { item: ShopRowId; price }`.
  - [x] 2.3 `src/sim/systems/economy.ts` `buy(state, item: ShopRowId)`: after the `buyBlock` check and `money -= price`, `if (item === 'medicine') state.medicine += 1; else state.owned.push(item);` then `Bought`. Update the header comment (medicine is the one consumable; repeatable).
  - [x] 2.4 Tests: `tests/sim/systems/economy.test.ts` — buying medicine twice with $30 gives 2 doses, $0, two `Bought` events, `owned` unchanged; at $14 nothing happens; `stats.moneyEarned` untouched. `tests/sim/selectors.test.ts` — `SHOP_ROWS` ends with `'medicine'` and starts with `SHOP_ITEMS`; `buyBlock(…, 'medicine')` is `'poor'`/`null` only (never `'owned'` even after buying); `selectShopView` has `SHOP_ROWS.length` rows; `selectHudView(...).medicine`. Leave the `SHOP_ITEMS` literal test as is.

- [x] **Task 3: The cure (`src/sim/systems/medicine.ts`, new) (AC 4, 6, 7)**
  - [x] 3.1 Header comment in the systems' style: FR26 / GDD Medicine; the command side only (no update function, like economy.ts; not registered in `step.ts`); cures infection only and never touches the Abomination's secret doom (AR18); draws no rng.
  - [x] 3.2 `export function applyMedicine(state: GameState, id: number): void`: return if `state.medicine < 1`; `const i = sheepIndex(state, id)`; return if `i < 0`; `const s = state.sheep[i]`; return if `s.infectedAt === undefined`; `delete s.infectedAt` (omit, never `undefined`/`null`: project rule on optional fields); `state.medicine -= 1`; `emit({ type: 'Cured', id: s.id, x: s.x, y: s.y })`.
  - [x] 3.3 `commands.ts`: `| { type: 'ApplyMedicine'; id: number }` with a comment (FR26: a dose was dropped on sheep `id`; medicine.ts; an id that is gone, a healthy sheep or no dose → nothing), and the `case 'ApplyMedicine': applyMedicine(state, cmd.id); return;`. Remove the "Later stories append ApplyMedicine (4.5)" line.
  - [x] 3.4 `events.ts`: `| { type: 'Cured'; id: number; x: number; y: number }` with a comment (sheep `id` was cured by medicine at (x, y); the view's infection look follows `PublicSheep.infected`; Story 5.6 can add a sound). Add `Cured` to the header's variant list.
  - [x] 3.5 Update stale comments: `virus.ts` header ("Story 4.5's medicine cures by deleting `infectedAt`" → past tense, medicine.ts), `state.ts` `infectedAt` doc (cleared by medicine).
  - [x] 3.6 Tests `tests/sim/systems/medicine.test.ts`: cures (infectedAt gone, dose −1, one `Cured` with the sheep's position); the cured sheep is **not** killed at the old `infectedAt + virusDeathMs` (`runFor(state, TUNING.virusDeathMs)`); can be re-infected later (`infectSheep` gives a new deadline); no dose → nothing; healthy sheep → nothing, dose kept; gone id → nothing; lost game → nothing; rng unchanged in every case. Secrecy (AC 7): a sheep with both `infectedAt` and `doomedAt` (set by hand, as the 4.3 tests do) is cured and still dies at `doomedAt` with cause `abomination`; an infected Abomination (`makeAbomination`) is cured and stays the Abomination.
  - [x] 3.7 Scenario `tests/sim/scenarios/medicine.test.ts`: carcass → a starving sheep eats it → infected → buy a dose (money set by hand) → `ApplyMedicine` → `runFor` past the virus window: no virus death, no new carcass from it. A second sheep infected and not treated dies as before (paired, so the test is not vacuous).

- [x] **Task 4: Art (AC 1, 2)**
  - [x] 4.1 `assets/art/ui/icon-medicine.png`, 12×16, from the mockup's `g-bottle` glyph (`mockups/hud.html` line 132: cork `bark-soft` #6B5444 at (4,0,4,2); neck `wool` (4,2,4,2); shoulder `bark` (2,4,8,1); body outline `bark` (1,5,10,10); glass `wool` (2,6,8,8); liquid `infection` #B4E03C (2,9,8,5); highlight white (3,7,1,2)). Throwaway scratchpad encoder as in 3.2–3.4; commit only the PNG.
  - [x] 4.2 `npm run assets` → regenerate `public/assets/atlases/ui.{png,json}`. `FRAME.iconMedicine: 'icon-medicine'` in `assetKeys.ts` (comment: the Medicine slot, its dragged dose and its shop row, UX-DR33, Story 4.5). Add it to the placeholder row of `assets/CREDITS.md`.

- [x] **Task 5: Strings (AC 1, 2)**
  - [x] 5.1 `src/view/strings.ts`: `SHOP_NAME` / `SHOP_EFFECT` become `Record<ShopRowId, string>` with `medicine: 'Medicine'` and `medicine: 'Cures 1 infected sheep'` (GDD Upgrade Trees effect). Add `medicineCount: (n: number): string => \`×${n}\`` (U+00D7, as the boost badge) and `medicineTooltip: 'Drag onto a green sheep to cure it.'` `[ASSUMPTION]` (no "!", UX-DR97; UX-DR75 lists no Medicine tooltip).

- [x] **Task 6: The bottom bar and the slot (`src/view/hud/`) (AC 2, 9)**
  - [x] 6.1 Re-space `BottomBar.ts`. Today: Breed ends at x 576, money 588–668, flock 680–800, threat summary starts at 816 (`THREAT_X = 1068 − 12 − 240`), so 4 px are spare and the 64 px slot needs 76. **Default:** `FARM_W` 232 → 160 (the Farm group's 6-pip bar is 144 px, `farmProgressWidth(6)`; the `FARM_PROGRESS_W <= FARM_W` invariant still holds; a retune up to 7 pips still fits exactly at 160, 8 pips would need 176; Better Hoe changes pips per click, not the bar). Result: Breed food 188–388, Breed 400–504, **slot 516–580**, money 592–672, flock 684–804, threat 816. Then:
    - `MEDICINE_X = BREED_X + BREED_W + GROUP_GAP`, `MONEY_X = MEDICINE_X + MEDICINE_SLOT_W + GROUP_GAP`; keep `FLOCK_X` relative to money.
    - Keep the existing flock/threat `invariant` (it now also proves the slot fits) and update the comment block (remove "has no room reserved yet").
    - Browser-check the Farm button at 160: label "Farm", key hint "F", the boosted glow (`FarmBoost`, built from `FARM_W`) and its "×2" badge, the "+1"/"×2" popups centred on it.
    - If the narrower Farm button reads badly, the fallback is narrowing `GROUP_GAP` to 8 between the read-outs **and** the slot to 56 px; record which in the Debug Log. Do not overlap the threat summary.
  - [x] 6.2 `src/view/hud/MedicineSlot.ts` (new), a `TooltipSource`:
    - Geometry from `mockups/hud.html .med` [ASSUMPTION, browser-check]: 64×56, vertically centred in the bar (like the read-outs), `boxTexture` with `fill: 'wool'`, `border: 'barkSoft'`, `radius: RADIUS.md`, `drop: true` (UX-DR8); the bottle at 2× (24×32) and "×{n}" (`numeric`, `bark`, `textStyle`) side by side, 2 px apart, centred. Colours via `COMPONENTS.medicineSlot` tokens only.
    - Interactive zone with the hand cursor (a HUD widget may `setInteractive`, project rule). `GAMEOBJECT_POINTER_DOWN` with the left button: `bus.emit('medicine:pressed', undefined)`, inside `try/catch` → `reportError('ui', err)`. Hover tracking mirrors `HoverZone` (over/out/GAME_OUT; GAME_OUT listener removed on SHUTDOWN).
    - `set(owned: number, inHand: boolean)`: shown = `owned − (inHand ? 1 : 0)`; visible iff `owned ≥ 1`; `setText` only on a change; hidden → zone input disabled and hover cleared. The count box fits "×99" (invariant like `FlockCounter`); above 99 it shows "×99" [ASSUMPTION; $1 485 of medicine is not a real case].
    - **A hidden slot is not a HUD control:** `controlAt` and `pointerOverControl` in HudScene loop over `tooltipSources`' boxes, so a hidden slot would swallow sheep drops at x 516–580. Give `TooltipSource` an `active` flag (or make the slot's `width`/`height` 0 while hidden) and have both loops skip inactive sources. Keep it allocation-free.
    - The held bottle: one `Image` of `FRAME.iconMedicine` at 2×, depth above the bar and popups, below the tooltip (`HudScene` depth constants), hidden unless a dose is in hand. `setHeld(x, y, overTarget)` places it at the pointer (screen coords; HudScene does not scroll) and scales it ×1.2 when over an infected sheep [ASSUMPTION: the only drop affordance; reduced motion keeps it, it is information]. `hideHeld()`.
  - [x] 6.3 `BottomBar`: build the slot, expose `readonly medicine: MedicineSlot`; update the class doc ("4.5 adds the Medicine slot after Breed").

- [x] **Task 7: The dose drag (`src/input/`, `src/view/`) (AC 3–5)**
  - [x] 7.1 `src/view/bus.ts`: `'medicine:pressed': undefined` — "A left press on the Medicine slot (HudScene), which captures it from GameScene; InputController arms a dose drag (Story 4.5)."
  - [x] 7.2 `src/view/field/MedicineDrag.ts` (new), the dose drag's geometry and command, modelled on `SheepDrag` (reads the frame's `PublicSheep` list only; never touches GameState; allocates nothing per frame):
    - `begin(sx, sy): boolean` (false if no dose is free to take: `hudView.medicine − pending < 1`), `move(sx, sy, onHud)`, `end(sx, sy, onHud, time)`, `cancel()`, `sync(sheep, time)`, getters `live`, `screenX`, `screenY`, `overTarget`, `inHand(time)`.
    - Target = the front-most **infected** sheep whose sprite box contains the world point (pointer + camera scroll), using the same box as `spriteIndexAt`. Extract the box test from `hitTest.ts` into an exported `spriteContains(spr, x, y, minHalf)` and use it in both, rather than copying the maths (no `skip` closure that searches the list per sprite: that is O(n²) per frame).
    - `end`: if `!onHud` and a target is under the pointer → `dispatch({ type: 'ApplyMedicine', id })` and remember `releasedAt = time` (the dose stays "in hand" for the count until `time > releasedAt`, exactly like `SheepDrag`'s pending slot, so "×2 → ×1" never flickers back to ×2 for a frame). Otherwise nothing is dispatched.
    - `cancel`: nothing dispatched; the dose is simply back.
    - `sync`: re-reads the target under the held point each frame (a green sheep may wander under or away from a still pointer); a target that stops being infected (cured by another dose, died) is no target.
  - [x] 7.3 `src/input/InputController.ts`:
    - Keep `mode: 'idle' | 'breeding' | 'dragging'` (AR8) and add `private dragKind: 'sheep' | 'dose' = 'sheep'`. `dragging` stays true for both (HudScene's input-off, the hover clear and the shop's `setLive` then cover the dose drag too). Update the class doc.
    - Listen to `bus.on('medicine:pressed', this.onMedicinePress, this)` (remove it in `destroy`). `onMedicinePress`: ignore under a modal or while dragging; in breed mode call `exitBreedMode()`; then arm: `doseArmed = true`, `doseDownX/Y = activePointer.x/y`, `doseDownTime = activePointer.downTime`.
    - `update()`: a new `updateDoseArm()` before `updateDrag()`: disarm when the left button is up or the press changed (`downTime`); past `DRAG_THRESHOLD2` → `hooks.beginDose(downX, downY)`; on true set `mode = 'dragging'`, `dragKind = 'dose'`, `dragDownTime = downTime`, then `moveDose(p.x, p.y)` (or `finishDrag` at `upX/upY` if already released, as the sheep path does).
    - `updateDrag` / `finishDrag` / `cancelDrag` branch on `dragKind` to the dose hooks (`moveDose`, `endDose`, `cancelDose`); `dragAlive()` is sheep-only (a dose cannot die). `cancelDrag` returns true for a live dose drag, so `Esc` stops at that step (UX-DR73). `cancelPress` (blur/hide) and a modal opening cancel it; `onUpOutside` (left release off the canvas) cancels it.
    - New hooks in `InputHooks` with doc comments: `beginDose(sx, sy): boolean`, `moveDose(sx, sy): void`, `endDose(sx, sy): void`, `cancelDose(): void`.
  - [x] 7.4 `src/view/scenes/GameScene.ts`:
    - Build `MedicineDrag` beside `SheepDrag`; wire the four hooks (`endDose` passes `this.hudControlAt(sx, sy)` and `this.state.time`, as `endDrag` does).
    - Call `medicineDrag.sync(this.publicSheep, this.state.time)` where `sheepDrag.sync` runs.
    - Public getters for HudScene: `medicineInHand: boolean` (live or pending), and the held point/target for the bottle (or one small read-only view object reused per frame).
    - Optional juice [ASSUMPTION]: on `Cured` in `onSim`, a small burst of the existing `sparkle` emitter at (x, y). Skip it if it needs a new emitter; Story 5.8 owns juice.
  - [x] 7.5 `src/view/scenes/HudScene.ts`:
    - `view` gains `medicine: 0`. In `refresh`: `this.bar.medicine.set(v.medicine, this.gameScene.medicineInHand)`; place or hide the held bottle from GameScene's getters.
    - Add the slot to `tooltipButtons`/`tooltipSources` handling (it is not a `Button`; add it to `tooltipSources`) so it gets hover clear under modals and drags, `controlAt`, and the tooltip.
    - The drag turns HudScene input off (`gameScene.dragging`) — check the bottle still follows (it reads GameScene's pointer state, not HUD input).

- [x] **Task 8: DEV tools (optional, small)**
  - [x] 8.1 `DebugOverlay`: none required (+$100 then buy; "Infect one" exists). If a "+1 dose" button is added, it adds to `state.medicine` only, DEV-gated like the others.

- [x] **Task 9: Browser check (AC 1–5, 9, 11)**
  - [x] 9.1 `npm run dev`. Fresh game: no slot; bar layout clean at 1280×720 and 960×540 (Farm button, glow, popups).
  - [x] 9.2 +$100, open the shop: the Medicine row is last, "$15", "Cures 1 infected sheep"; buy 3 → money rolls down by 45, slot shows "×3"; the panel top clears the Pause button; at < $15 the row greys.
  - [x] 9.3 "Infect one" ×2. Drag a dose: bottle follows, slot "×2", no sheep tooltip, Breed/Farm don't light. Drop on a green sheep: green tint, bubbles, wobble and ping go; infected count −1; slot "×2" with no flicker; it never dies of the virus.
  - [x] 9.4 Drop on a healthy sheep, the grass, the Market, the Better Place, the open shop panel, the Farm button, outside the canvas; press Esc mid-drag; press the Pause button mid-drag (Esc → pause): every time the dose comes back and nothing else happens (no sale, no sacrifice, no purchase).
  - [x] 9.5 Last dose: the slot reads "×0" while in hand, hides after the cure, reappears on the next purchase. A short click on the slot does nothing. Slot press in breed mode leaves breed mode.
  - [x] 9.6 Save mid-drag (wait for the 10 s autosave or hide the tab), reload: the full count is there. Restart mid-drag: no bottle left on screen, no stale count.
  - [x] 9.7 Sheep drag regression: sell, sacrifice, drop, Esc-cancel all as before; a sheep released over the (hidden) slot area with 0 doses is a plain field/bar drop, and over the visible slot it is a HUD drop.
  - [x] 9.8 `npm run build`; no DEV strings in `dist/`. FPS at 100 sheep (debug overlay, ×1) not worse than before while dragging a dose.

- [x] **Task 10: Docs (AC 10)**
  - [x] 10.1 `_bmad-output/game-architecture.md`: the Command list already names `ApplyMedicine`; record `Cured` as built, `medicine.ts` (command-only, no update), the `ShopRowId`/`SHOP_ROWS` split, schema 11, and that `dragging` covers the dose drag (`dragKind`), started over `'medicine:pressed'`.
  - [x] 10.2 `deferred-work.md`: mark resolved "The Medicine slot (Story 4.5)" and the 4.5 part of "A crowded bottom bar" (with the new x ranges); update "More rows" (6 rows now, panel top y ≈ 194; 4.7/4.8 add 3 more → y ≈ 14, meets Pause). Add "Deferred from: story 4-5-medicine": **5.6** a cure sound on `Cured`, pick-up / put-back sounds, a caption only if 5.6's list grows; **5.7** the bottle's ×1.2 over a target is information (kept), any sparkle is juice; **5.8** a cure sparkle/pop if not done here, a proper bottle sprite; **5.4** a "cured" stat is not in FR36 (none added); **4.6** overcrowding infections are cured the same way (no extra work).
  - [x] 10.3 Story file, `sprint-status.yaml` and `deferred-work.md` in the same commit as the code (repo pattern).

### Review Findings

- [x] [Review][Patch] A dose released on the bottom bar's background (not a control: money, flock, a gap) can cure an infected sheep whose sprite reaches under the bar; AC 5 says a release over the HUD returns the dose [src/view/field/MedicineDrag.ts:84 / src/view/scenes/GameScene.ts:411-412]
- [x] [Review][Patch] Esc does not disarm a slot press still under the 6 px threshold; moving afterwards takes a dose the player cancelled [src/input/InputController.ts:222]
- [x] [Review][Patch] `MedicineSlot.clearHover` does not reset the hand cursor (Button does), so a dose drag or a modal starting over the slot keeps the hand cursor [src/view/hud/MedicineSlot.ts:95]
- [x] [Review][Patch] Pressing the slot in breed mode resets the cursor to the arrow over the hovered slot: `hoveredButton` scans only `tooltipButtons`, not the slot [src/view/scenes/GameScene.ts:272]
- [x] [Review][Patch] The slot's tooltip can pop while the press is held (under the threshold); Button suppresses its tooltip on press [src/view/hud/MedicineSlot.ts:149]
- [x] [Review][Patch] A left press on the slot during a right-drag pan arms a dose while the camera keeps panning under it [src/input/InputController.ts:317]
- [x] [Review][Patch] Stale comment "Farm up to 11" after FARM_W went to 160 (the real limit is 7 pips; the invariant still guards it) [src/view/hud/BottomBar.ts:30]
- [x] [Review][Patch] The shop panel grows upward with each row and nothing checks it stays below the canvas top / Pause (4.7/4.8 add 3 more rows) [src/view/hud/ShopPanel.ts:23]
- [x] [Review][Patch] The "never owned after buying" selectors test sets `state.medicine` by hand instead of running a real `Buy` (Task 2.4) [tests/sim/selectors.test.ts]
- [x] [Review][Patch] Dev Agent Record does not note the built signatures that differ from the tasks: `MedicineDrag.sync(sheep)` (no time), `MedicineSlot.set(owned, inHand: number)`, GameScene `dosesInHand`/`heldDose` instead of `medicineInHand: boolean` [_bmad-output/implementation-artifacts/4-5-medicine.md]
- [x] [Review][Defer] The slot press reads `activePointer`, not the pressing pointer (multi-touch could arm from the wrong finger) [src/input/InputController.ts:319] — deferred, pre-existing (same pattern as `'breedTool:pressed'`; mouse-first game)
- [x] [Review][Defer] A slot that reappears (dose bought / last cure done) under a still pointer gets no hover or tooltip until the pointer moves [src/view/hud/MedicineSlot.ts:112] — deferred, pre-existing (Phaser sends pointer-over only on movement; same for any re-enabled zone)

## Dev Notes

### What this story is (and is not)

- **Is:** a dose count in the sim, a repeatable shop row, the cure command and event, the Medicine slot widget, a second kind of drag (dose) in the one InputController, a bar re-space, placeholder bottle art, save schema 11, tests.
- **Is not:** overcrowding (4.6), Better Hoe (4.7), Auto-feeder (4.8), any audio (5.6), names (5.3), a cure stat (FR36 has none), a cure toast (no Voice line). No change to how infection starts or kills.

### Current code to build on (read these first)

| File | Today | This story |
|---|---|---|
| `src/sim/state.ts` | `ShopItemId = 'land1'…'scarecrow'`; comment: "Medicine is a consumable with its own dose count (Story 4.5), never in `owned`"; `infectedAt?` | `ShopRowId`, `medicine: number`, `createNewGame` |
| `src/sim/systems/virus.ts` | `infectSheep`, `updateVirus` kills at `infectedAt + virusDeathMs` | header comment only |
| `src/sim/systems/economy.ts` | `buy(state, item: ShopItemId)` → `owned.push` | branch for medicine |
| `src/sim/selectors.ts:107–180` | `SHOP_ITEMS`, `shopPrice` (assertNever), `shopRequires`, `isOwned`, `buyBlock`, `ShopRowView`, `selectShopView` | `SHOP_ROWS`, widen to `ShopRowId` |
| `src/sim/selectors.ts:468–513` | `HudView`, `selectHudView` (threat counts loop) | `medicine` |
| `src/sim/commands.ts` | `Command` union, `applyCommand` switch with `assertNever`, returns early on `lostAt` | `ApplyMedicine` |
| `src/sim/events.ts` | `SimEvent` union, `Bought { item: ShopItemId }` | `Cured`, widen `Bought` |
| `src/save/{migrations,validate}.ts` | schema 10; `owned` validated with `SHOP_ITEMS` | step 10, `medicine` int |
| `src/view/hud/ShopPanel.ts` | rows from `SHOP_ITEMS`, `SHOP_ICON: Record<ShopItemId>`, `PANEL_H` from `SHOP_ITEMS.length`, `onBuy(item: ShopItemId)` | `SHOP_ROWS`, `ShopRowId`, medicine icon |
| `src/view/hud/BottomBar.ts` | layout constants + `invariant`s; comment: "The Medicine slot (4.5) has no room reserved yet" | re-space, slot |
| `src/view/scenes/HudScene.ts` | `refresh` on PRE_RENDER; `tooltipSources`; `controlAt`; input off while `gameScene.dragging` | slot + held bottle |
| `src/input/InputController.ts` | modes idle/breeding/dragging; `breedTool:pressed` over the bus; `updateClick` → `beginDrag`; Esc chain via hooks | dose drag |
| `src/view/field/SheepDrag.ts` | drag geometry + pending-until-tick pattern | the model for `MedicineDrag` |
| `src/view/field/hitTest.ts` | `spriteIndexAt(items, layer, x, y, minHalf, skip)` | extract `spriteContains` |
| `src/view/field/SheepSprite.ts:343–380` | `setInfected(false)` → `stopInfection()`: tint, marker, wobble cleared; comment already says "undone on recovery (medicine, Story 4.5)" | **no change** |
| `src/view/field/SheepSprite.ts:268–278` | ping hides when neither starving nor infected | **no change** |
| `src/config/constants.ts:419` | `COMPONENTS.medicineSlot { backgroundColor: 'wool', iconColor: 'infection', textColor: 'bark', rounded: 'md' }` | use it |

### What must be preserved

- **`owned` integrity.** `SHOP_ITEMS` stays the one-time list; `validate.ts` keeps rejecting unknown and duplicate items, and `'medicine'` in `owned`. `isLand`/`isDecoration`/`landTier` see only one-time items.
- **The sheep drag (Stories 2.7, 3.1).** Everything about picking up, selling, sacrificing, dropping and cancelling a sheep is unchanged. The drag threshold, the press-at-down hit test, the same-frame press-release handling and the `downTime` check apply to the dose drag too.
- **The Esc chain order (UX-DR73)**: confirm → sub-panel → cancel drag (either kind) → exit breed mode → close shop → pause.
- **Top-only input.** HudScene's zones capture presses; GameScene never sees a press on the slot. That is why the drag starts over the bus (same pattern as `'breedTool:pressed'` and `'hud:rightPressed'`).
- **Secrecy.** Nothing in this story reads `doomedAt`/`stalk`/`isAbomination`/`state.abomination` outside the existing sim code. Medicine must not become a way to detect the doom (a cured victim dies anyway, with the vague toast).
- **No allocation in per-frame code** (MedicineDrag.sync, the slot's `set`, the hit test). Commands and events are rare and may allocate.
- **No game logic in the view.** The view's "is it infected?" check only decides whether to send the command; the sim decides the cure.
- **Listener cleanup** on SHUTDOWN / `destroy` for `'medicine:pressed'` and the slot's GAME_OUT.

### Design decisions (defaults chosen; see Open Questions)

- **Doses in `GameState.medicine`, purchases through the existing `Buy`** with a widened `ShopRowId`: one purchase rule (`buyBlock`), one `Bought` event, one panel. A separate `BuyMedicine` command would duplicate the price/poor logic.
- **`SHOP_ROWS` vs `SHOP_ITEMS`:** keeps the save validation and the land/decoration helpers on one-time items only.
- **The dose leaves the count only when the cure applies.** In hand it is a view-side "−1", so a cancel, a miss, a save or a crash mid-drag never loses a dose.
- **Target = infected sheep only.** A dose dropped where a healthy sheep overlaps a green one goes to the green one (the player aimed at the green one). A healthy-only drop returns the dose, as the UX says.
- **The bottle is drawn in HudScene,** because the drag starts on the bar and HudScene draws above GameScene. GameScene owns the hit test (it owns the camera and the sheep layer).
- **Farm button narrower (160 px)** to make room: it is the widest control and its label is one word. Its bar still fits.

### Architecture compliance

- New rule → `src/sim/systems/medicine.ts` (architecture "Medicine | `src/sim/systems/medicine.ts` | Cure command"). Command-only: no `updateMedicine`, nothing added to `step.ts`.
- New player action → `Command` union; new signal → `SimEvent` union (`Cured`, named in the architecture's event list); new tunable → `TUNING.medicinePrice`; schema change → bump + migration + validation (project-context "Adding fields to GameState without bumping SAVE_SCHEMA_VERSION" is a listed mistake).
- `InputController` stays the single owner of gameplay input (AR8: "dragging (sheep or medicine)").
- UI event `noun:verb`: `'medicine:pressed'`.
- Exhaustive switches: `applyCommand` and `shopPrice` keep their `assertNever` defaults so the new variants are forced through.

### Library / framework notes

- Phaser **4.2.1** (installed). APIs used are all already in the codebase: `Image`, `Zone.setInteractive({ useHandCursor })`, `GAMEOBJECT_POINTER_DOWN/OVER/OUT`, `GAME_OUT`, `Pointer.downTime/upX/upY/leftButtonDown`, `boxTexture`. No tint work is needed (SheepSprite already clears it with `clearTint()`; v4 has no `setTintFill`).
- No new packages. No web research needed beyond the installed typings (`node_modules/phaser/types/phaser.d.ts`).

### Testing standards

- Vitest for `src/sim/` and `src/save/` only; the slot, drag and bottle are browser-checked (never mock Phaser).
- `newGame(seed)`, `createSheep`, `fillFlock`, `infectSheep`, `makeAbomination`, `applyCommand`, `runFor` in `TICK_MS` steps (`tests/sim/helpers.ts`). Assert on state and drained events; read `TUNING` (`medicinePrice`, `virusDeathMs`), never literals.
- Pair the scenario (treated vs untreated) so "no death" cannot pass vacuously (4.2/4.4 lesson).
- Save tests stay mandatory and green (round trip of the busy save, corrupt/old-schema load).

### Previous story intelligence (4.1–4.4)

- 4.4: toasts are DOM (`safetyNet.showToast`), not Phaser text — a browser probe must read the DOM. HUD widgets in HudScene; world juice in GameScene. Phaser 4.2.1 `killTweensOf` fires no `onStop` (not needed here). Review findings were about stale comments, one-frame ordering (HudScene's `onSim` runs after GameScene's) and vacuous tests.
- 4.3: a sheep's `doomedAt` is independent of infection; the "still lands after…" tests show how to set secret fields by hand in tests.
- 4.1: the `PublicSheep` boundary and the lint rule; `publicSheep().infected` is not secret.
- 3.2: the shop panel lives in GameScene (`FIELD_DEPTH.shop`), counts as a HUD control for drops, and `setLive(false)` during drags. The row's look comes only from `buyBlock`.
- 3.3/3.2: bar layout is guarded by `invariant`s and was browser-checked at both window sizes; the deferred-work bar entries say to re-space rather than overlap.
- Pattern from every story: code, story file, `deferred-work.md` and `sprint-status.yaml` in one "Implement story 4.5: Medicine" commit; review fixes in a separate commit.

### Git intelligence

- Recent: `8e0283a` 4.4, `4a25830` 4.3, `c224c83` 4.2, `e3ef9aa` 4.1, `82e20e5` 3.6. The last schema bump was 4.3 (9 → 10, migration with rng roll); this one needs no rng.
- Branch: `story-4.5` (created from `main` at `8e0283a`).
- Baseline before starting: run `npm test` and note the pass count (4.4 ended at 751 passed, 1 skipped).

### Open questions (defaults chosen; confirm or change)

1. **Bar space:** Farm button 232 → 160 px. Alternatives: 8 px gaps between the read-outs plus a 56 px slot; or narrower money/flock boxes.
2. **Slot tooltip** "Drag onto a green sheep to cure it." (no spec line). Alternative: no tooltip.
3. **Target rule:** infected sheep only under the pointer (generous). Alternative: the front-most sheep only, so a healthy one in front blocks the cure.
4. **Last dose in hand shows "×0"** rather than hiding the slot mid-drag.
5. **No cure feedback beyond the infection look going away** (plus an optional sparkle). Alternative: a "+" popup or a toast such as "A sheep feels better." (would need a Voice line).
6. **Breed mode:** pressing the slot leaves breed mode. Alternative: the slot ignores presses in breed mode.

### Project Structure Notes

- New: `src/sim/systems/medicine.ts`, `src/view/hud/MedicineSlot.ts`, `src/view/field/MedicineDrag.ts`, `assets/art/ui/icon-medicine.png`, `tests/sim/systems/medicine.test.ts`, `tests/sim/scenarios/medicine.test.ts`.
- Modified: `src/config/{tuning,constants}.ts`, `src/sim/{state,selectors,commands,events}.ts`, `src/sim/systems/{economy,virus}.ts`, `src/save/{migrations,validate}.ts`, `src/view/{bus,strings,assetKeys}.ts`, `src/view/field/hitTest.ts`, `src/view/hud/{BottomBar,ShopPanel}.ts`, `src/view/widgets/tooltipSource.ts` (if the `active` flag is used), `src/view/scenes/{GameScene,HudScene}.ts`, `src/input/InputController.ts`, `assets/CREDITS.md`, `public/assets/atlases/ui.{png,json}` (regenerated), tests under `tests/save/` and `tests/sim/`, `_bmad-output/game-architecture.md`, `deferred-work.md`, `sprint-status.yaml`.
- `SAVE_SCHEMA_VERSION` 10 → 11.

### Project Context Rules (from `_bmad-output/project-context.md`)

- **Layers:** `src/sim/` pure TS (no Phaser, no `Math.random`, no `Date.now`); the view and input never mutate `GameState` — they dispatch `ApplyMedicine` / `Buy`.
- **State is plain JSON;** optional fields are omitted (`delete s.infectedAt`), never `undefined`/`null`.
- **Schema changes** bump `SAVE_SCHEMA_VERSION` with a migration and validation.
- **Input:** one `InputController`; 6 px threshold; Esc priority chain; no `setInteractive` on field sprites for gameplay (the slot is a HUD widget, which may); field hit tests use world coordinates (camera scroll).
- **The Abomination is secret;** view code uses `PublicSheep` only.
- **Colours** from `COLORS`/`COMPONENTS` tokens, **copy** from `strings.ts`; no "!" in copy; never "kill"/"corpse"/"blood" in UI text.
- **Infection is never colour-only**, and the cure removes all three cues together (already true in SheepSprite).
- **No allocation in hot paths;** selectors once per frame (`selectHudView`).
- **Listener cleanup** on SHUTDOWN.
- **Audio** only through `AudioDirector` (5.6).
- Done = `npm test`, `npm run typecheck`, `npm run lint` all green; rendering checked manually in the browser.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 4.5: Medicine]
- [Source: _bmad-output/planning-artifacts/epics.md#Requirements Inventory] FR15, FR26; AR3, AR7, AR8, AR9, AR13, AR16, AR18, AR22; UX-DR8, UX-DR23, UX-DR24, UX-DR25, UX-DR33, UX-DR55, UX-DR58, UX-DR64, UX-DR66, UX-DR73, UX-DR85, UX-DR97
- [Source: _bmad-output/planning-artifacts/gdds/gdd-sheep-civilization-2026-10-05/gdd.md#Medicine (Should tier)], #Virus, #Upgrade Trees (Medicine $15, "Cures 1 infected sheep")
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-sheep-civilization-2026-10-05/EXPERIENCE.md] Component Patterns (Shop row, Medicine slot, Infection marker); Interaction Primitives (6 px, Esc chain)
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-sheep-civilization-2026-10-05/DESIGN.md] `medicine-slot` component; Layout (bar order)
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-sheep-civilization-2026-10-05/mockups/hud.html] `.med` (64×56, bark-soft border), `g-bottle` glyph
- [Source: _bmad-output/game-architecture.md] Commands/events (`ApplyMedicine`, `Cured`); InputController modes; systems table (`medicine.ts`)
- [Source: _bmad-output/implementation-artifacts/deferred-work.md] "A crowded bottom bar", "The Medicine slot (Story 4.5)", "More rows (Stories 4.5, 4.7, 4.8)"
- [Source: _bmad-output/implementation-artifacts/4-4-sacrifice-reveal.md], [3-2-money-and-the-shop-panel.md], [2-7-drag-a-sheep-into-the-better-place.md], [2-5-carcass-eating-and-the-virus.md]
- [Source: _bmad-output/project-context.md]

## Dev Agent Record

### Agent Model Used

Claude Opus 5.5 (claude-opus-5-5[1m])

### Implementation Plan

- Sim: `GameState.medicine` (schema 11, migration 10, validation). `ShopRowId = ShopItemId | 'medicine'`; `SHOP_ROWS` = `SHOP_ITEMS` + `'medicine'` for the panel, `SHOP_ITEMS` untouched (save validation of `owned`). `buy` adds a dose for medicine; `buyBlock` never reports medicine owned or locked. `medicine.ts` `applyMedicine` (command-only): no dose / gone / healthy → nothing; else delete `infectedAt`, −1 dose, `Cured`. `HudView.medicine`.
- View: `MedicineSlot` (HudScene, a `TooltipSource` with an `active` flag so a hidden slot is no HUD control) draws the tile, the count and the dose in hand; a left press emits `'medicine:pressed'`. `InputController` arms on it and, past 6 px, enters `dragging` with `dragKind: 'dose'`; Esc/modal/blur/off-canvas release go through `cancelDrag`. `MedicineDrag` (GameScene) hit-tests infected sheep only (`spriteContains`, extracted from `spriteIndexAt`) and sends `ApplyMedicine` on a release over one; a dropped dose stays "in hand" until a tick has run, so the count never flickers back.
- Bar: Farm button 232 → 160 px; slot at 516–580 (reserved while hidden).

### Debug Log References

- **Baseline (8e0283a):** 751 passed, 1 skipped. After: 774 passed, 1 skipped (+23: 11 medicine unit/scenario, 2 economy, 4 selectors, 1 migration, 5 validation cases). Typecheck and lint clean.
- **Red checks:** the shop/economy/selectors tests failed (8) before the selector and economy changes; the medicine tests failed before `medicine.ts` existed, and with `delete s.infectedAt` commented out 6 of 11 failed (restored; the cure tests are not vacuous, the scenario is paired treated/untreated).
- **Count font (deviation from Task 6.2):** the 64 px tile's inside is 60 px; measured in Chrome, "×99" in Nunito 800 is 40 px at 22, 36 at 20 (the mockup's size) and 33 at 18, so with the 24 px bottle only 18 px fits. The DEV `invariant` caught it on first load. The count is 18 px (the UX-DR5 floor) and the invariant checks the tile's inside.
- **`COMPONENTS.medicineSlot`** gained `borderColor: 'barkSoft'` (mockup `.med`) and `typography: 'numeric'`, so the widget reads every colour and face from tokens.
- **Browser (Task 9):** a scratchpad Playwright probe on the DEV server driving real mouse drags (`main.ts` exposed the game temporarily; removed, no diff). 31 checks; 4 passes in a row at 1280×720 and 1 at 960×540 after pinning the sheep apart (two earlier runs failed only because the second green sheep had wandered under the "grass"/"healthy" drop points and was, correctly, cured: the target rule prefers an infected sheep under the pointer). Covered: no slot at 0; the Medicine row last ("Medicine", "$15", "Cures 1 infected sheep"), greyed under $15, panel top y 194; 3 bought through the real shop for $45 with `owned` empty; "×3"; in hand "×2" with the bottle, which grows over a green sheep; the cure clears tint and marker, "×2" after; put back on a healthy sheep, the grass, the Market (no sale), the Better Place (no sacrifice), the Farm button, Esc (no pause), a release off the canvas; a click on the slot does nothing; "×0" with the last dose in hand, the slot hides after it; a slot press leaves breed mode; a sheep still sells by drag; a mid-drag state still counts the held dose; no console errors.
- **Visual:** screenshots of the bar (empty and with "×3"), the open shop at both sizes, the boosted Farm button at 160 px (glow, "×2" badge, popups) and "×12" in the slot: all clear.
- **FPS (software GL, relative):** 103 sheep, idle 31.3 / 34.5, dose held 34.5 / 35.9: no cost.
- **Build:** `npm run build` passes; no "Make Abomination", "Kill now" or the probe hook in `dist/`; the medicine strings are bundled.
- **Task 8:** no DEV button added (+$100 then buy, and "Infect one", cover it).

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created
- Implemented Medicine (FR26, UX-DR33): a repeatable $15 shop row (last), a dose count in the save (schema 11), the `medicine-slot` after Breed, and a dose drag that cures an infected sheep on release (`ApplyMedicine` → `Cured`); every other release, Esc, a modal, blur or a release off the canvas puts the dose back with no command.
- The cure only deletes `infectedAt`: a doomed Abomination victim still dies on schedule, and the Abomination is cured like any lamb (tested).
- Bar re-spaced: Farm button 160 px (Open Question 1 default). Other Open Question defaults kept: the slot tooltip, infected-only targeting, "×0" while the last dose is held, no cure toast (a small sparkle only), a slot press leaves breed mode.
- Deviation: the slot's count is 18 px, not the mockup's 20 px (does not fit "×99"); recorded in deferred-work.
- Built signatures that differ from the task text (behaviour unchanged, ACs 3–4 met): `MedicineDrag.sync(sheep)` takes no `time` (the pending count is timed in `inHand(time)`/`end(…, time)` instead); `MedicineSlot.set(owned, inHand: number)` takes a count, not a boolean, so two doses dropped in one frame both show as out of the slot; GameScene exposes `dosesInHand: number` and `heldDose: MedicineDrag` instead of `medicineInHand: boolean`.
- Code review (2026-10-09): 10 patches applied — a dose released anywhere on the bottom bar is a HUD drop (`GameScene.doseOnHud`; no cure through the bar onto a sheep drawn under it); Esc drops a slot press not yet past the threshold; the slot resets the hand cursor on `clearHover`, suppresses its tooltip on press, and keeps its hand cursor after a breed-mode change (`HudScene.medicineHovered`); a slot press is ignored mid-pan; the Farm pip comment fixed (up to 7); a `ShopPanel` invariant that the panel top stays below the Pause button; the selectors test buys for real; these notes. 2 deferred (multi-touch `activePointer`, no hover on a reappearing slot under a still pointer).

### File List

- `src/sim/systems/medicine.ts` (new)
- `src/view/hud/MedicineSlot.ts` (new)
- `src/view/field/MedicineDrag.ts` (new)
- `assets/art/ui/icon-medicine.png` (new)
- `tests/sim/systems/medicine.test.ts` (new)
- `tests/sim/scenarios/medicine.test.ts` (new)
- `src/config/constants.ts`
- `src/config/tuning.ts`
- `src/sim/state.ts`
- `src/sim/selectors.ts`
- `src/sim/commands.ts`
- `src/sim/events.ts`
- `src/sim/systems/economy.ts`
- `src/sim/systems/virus.ts`
- `src/save/migrations.ts`
- `src/save/validate.ts`
- `src/input/InputController.ts`
- `src/view/bus.ts`
- `src/view/strings.ts`
- `src/view/assetKeys.ts`
- `src/view/field/hitTest.ts`
- `src/view/hud/BottomBar.ts`
- `src/view/hud/ShopPanel.ts`
- `src/view/widgets/tooltipSource.ts`
- `src/view/scenes/GameScene.ts`
- `src/view/scenes/HudScene.ts`
- `assets/CREDITS.md`
- `public/assets/atlases/ui.json` (regenerated)
- `public/assets/atlases/ui.png` (regenerated)
- `tests/save/busy.ts`
- `tests/save/fromVersion8.ts`
- `tests/save/migrations.test.ts`
- `tests/save/validate.test.ts`
- `tests/sim/selectors.test.ts`
- `tests/sim/state.test.ts`
- `tests/sim/systems/economy.test.ts`
- `tests/sim/scenarios/market.test.ts`
- `tests/sim/scenarios/sacrifice.test.ts`
- `_bmad-output/game-architecture.md`
- `_bmad-output/implementation-artifacts/deferred-work.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/4-5-medicine.md`

## Change Log

- 2026-10-08: Story 4.5 implemented. Medicine: shop row ($15, repeatable), dose count (schema 11), `ApplyMedicine`/`Cured`, the Medicine slot and dose drag, Farm button narrowed to 160 px for the slot. Gates: 774 passed, 1 skipped; typecheck and lint clean; browser probe passes (31 checks, both window sizes); build clean.
- 2026-10-09: Code review: 10 patches applied (bar drop, Esc disarm, slot cursor/tooltip, pan guard, panel invariant, comment, test, notes), 2 deferred, 13 dismissed. Gates: 774 passed, 1 skipped; typecheck, lint, build clean; browser probe (+6 checks) passes at both sizes; the bar-drop fix red-checked in the browser. Status → done.
