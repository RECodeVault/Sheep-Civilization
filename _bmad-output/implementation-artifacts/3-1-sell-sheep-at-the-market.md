---
baseline_commit: 26fdb5b
---

# Story 3.1: Sell Sheep at the Market

Status: review

<!-- Created 2026-10-07 by create-story. Builds on 2.7 (drag, SheepDrag, BetterPlace, removeSheep, play-area camera, suction ghost), 2.8 (save bump pattern, HUD popups) and 1.9 (save encode/validate/migrate). -->

## Story

As a player,
I want to drag adults and elders onto the Market stall to sell them,
so that I can earn money — at the cost of a smaller flock.

## Acceptance Criteria

1. **The Market stall (UX-DR46, UX-DR48).** The field shows a wooden, red-and-cream striped, **rectangular** stall outside the fence on the right of the play area, at world x 1100–1260, y 190–370 (the mockup position; see Dev Notes, "Placement and camera"). It reads as the Better Place's opposite in hue (warm `awning`/`wood`/`wool`), value, shape (rectangle, not ring) and motion (a flapping awning, not a spinning, sucking ring). It never moves, and sheep never walk into it (it is outside the fence).
2. **The camera keeps it in view.** A game still **opens** with the same view as 2.7: centred on the pen plus the Better Place (scroll ≈ (49, 24)), so the hole stays at screen x ≈ 393–549, clear of 3.2's shop panel. The right-drag pan is now **pinned** to the pen ∪ the Better Place ∪ the Market, so the whole stall, its outline and its price tag always stay in view.
3. **Both targets highlight together (UX-DR51, UX-DR67, Q7).** When a drag of an **adult or elder** starts, the Market arms (`drop-target-market`) in the same frame the Better Place arms: a pulsing `awning` rectangle outline around the stall and a price tag (`awning` box, `wool` text, `label` type) above it reading "$10" (adult) or "$5" (elder). While the **pointer** is over the stall, the Market **intensifies**: the awning flaps (frames cycle) and the tag grows. The tag follows the dragged sheep's current stage every frame (an adult that turns elder mid-drag reads "$5").
4. **Selling (FR17, FR20, FR21, UX-DR68, UX-DR82, UX-DR93, AR17).** Releasing an adult or elder with the pointer over the stall (and not on a HUD control) sells it, with no confirmation:
   - A `Sell` command removes the sheep through `removeSheep(state, id, 'sold')`: **no carcass**, `stats.sold += 1`, `stats.died` unchanged.
   - `state.money` and `stats.moneyEarned` both rise by the price: `TUNING.sellPriceAdult` ($10) or `TUNING.sellPriceElder` ($5), decided by the sheep's stage **when the command applies**.
   - It emits `Sold { id, price }` before any `Lost`.
   - A "$10"/"$5" coin popup (`float-popup`, `popup` type) rises from the stall, and the sheep hops into the stall (a pooled ghost; see Dev Notes, "Sale animation").
   - An announcement toast reads "A sheep sold. $10." or "A sheep sold. $5." (names arrive in 5.3).
   - Selling the last sheep loses the game through `checkLastSheepAndLoss` (FR38): the lose screen follows as for a sacrifice.
   - Any adult or elder can be sold: infected, Starving, ready, on cooldown or a parent of a pending lamb (the lamb is still born).
5. **Lambs cannot be sold (FR17, UX-DR53).** While a **lamb** is dragged, the Market stays plain until the pointer is over it; over it, the Market shows `drop-target-invalid`: the stall art desaturates to `disabled`, the outline is `disabled`, and the tag reads "Too young" (`disabled` box, `disabled-ink` text). Releasing there **puts the lamb back on the field**: a `Drop` at the release point, which the sim clamps to the nearest point inside the fence (no sale, no money, no event). The Abomination (Epic 4) is a lamb in `PublicSheep`, so it gets exactly this.
6. **The sim is the authority.** A `Sell` for a sheep that is gone is ignored silently (a sale can race a death on the same tick). A `Sell` for a sheep whose stage is lamb sells nothing and emits nothing; if it is dragged it is put down at its sim position (`wander`), so no sheep is ever left hanging.
7. **Misdrops (UX-DR68).** Whatever the sheep was meant for, a release on the stall sells (or bounces a lamb) and a release in the hole sacrifices. No confirm, no undo. The Market and the hole never overlap, so a release is in at most one.
8. **Everything from 2.7 still holds.** Click vs drag, drop on the field (clamped), drop on the bar or a HUD control (dropped on the field), cancel (Esc, release off the canvas, blur, hide, modal, loss), death mid-drag, no snap-back or double image, and the sacrifice itself. A release on the stall that is over a HUD control is a drop, never a sale.
9. **Money is saved.** `GameState.money` (integer dollars, 0 at a new game) is saved and restored. `SAVE_SCHEMA_VERSION` becomes **7**; a version-6 save migrates with `money: 0`; validation requires an integer in [0, 2^48]. The round-trip, corrupt-save and migration tests stay green, and `busyGame` exercises a non-zero balance.
10. **Secrecy (AR18, UX-DR64).** The view reads only `PublicSheep`. `PublicSheep` gains no field; `Sold` carries no secret. Nothing in `src/view/` or `src/input/` reads `isAbomination`, `stalk` or `wasAbomination`.
11. `npm test`, `npm run typecheck` and `npm run lint` all pass. Browser checks (Task 9) pass with no console errors, with recorded evidence for each.

## Tasks / Subtasks

- [x] **Task 1: Sim: money, prices and the `Sell` command (AC: 4, 6, 7, 10)**
  - [x] 1.1 `src/config/tuning.ts`: add `sellPriceAdult: 10` and `sellPriceElder: 5`, with a comment citing FR17 / GDD Life Stages ("Can sell: Yes, $10 / $5"; lambs no).
  - [x] 1.2 `src/sim/state.ts`: add `money: number` to `GameState` (doc: "Whole dollars to spend (FR21): earned only by selling (3.1), spent in the shop (3.2). No cap.") and `money: 0` in `createNewGame`. Place it after `boostUntil` or near `stats`; keep the field order sensible for the save.
  - [x] 1.3 `src/sim/selectors.ts`: add `salePrice(stage: Stage): number` — `TUNING.sellPriceAdult` for adult, `TUNING.sellPriceElder` for elder, 0 for lamb (0 = cannot be sold). Pure, no state. Both the sim (`market.ts`) and the view (the tag text) use it, so they can never disagree.
  - [x] 1.4 New `src/sim/systems/market.ts` (architecture System Location Mapping: "Market | `src/sim/systems/market.ts` | Selling rules and prices"). Command-only, like `betterPlace.ts` and `breeding.ts` (no update function). Header comment: what it owns, that it leaves through `removeSheep` (N1), and that the Abomination is never sold because it never grows past a lamb (4.1 must keep `stageOf` reporting lamb for it).
    - `sell(state, id)`: `sheepIndex`; a missing id returns silently (no invariant: a race with a death is normal).
    - `const price = salePrice(stageOf(s, state))`. If `price === 0` (a lamb): if `s.activity === 'dragged'` set it to `'wander'` (put down where the sim holds it); emit nothing; return.
    - Otherwise, in this order: `emit({ type: 'Sold', id, price })`; `state.money += price`; `state.stats.moneyEarned += price`; `removeSheep(state, id, 'sold')` (last, so a `Lost` follows the `Sold`).
    - Draws no rng and takes no id.
  - [x] 1.5 `src/sim/commands.ts`: append `| { type: 'Sell'; id: number }` with a comment ("FR17: sheep `id` was dropped on the Market stall (market.ts). A lamb or an id that is gone sells nothing.") and route it. Update the "Later stories append Sell, Buy, …" comment (Buy is 3.2). Keep the `assertNever` default.
  - [x] 1.6 `src/sim/events.ts`: add `| { type: 'Sold'; id: number; price: number }` with a comment ("Sheep `id` was sold for `price` dollars (FR17; market.ts), before any Lost it caused. Story 5.3 adds `name`."). Add `Sold` to the header's variant list.
  - [x] 1.7 `src/sim/systems/carcass.ts`: `removeSheep` already handles `'sold'` (`stats.sold += 1`). Only touch its comments if they still say "3.1 adds sell".
- [x] **Task 2: Save: schema 7 (AC: 9)**
  - [x] 2.1 `src/config/constants.ts`: `SAVE_SCHEMA_VERSION = 7`, extending the version comment ("7 since Story 3.1: `money`, the spendable balance (a version-6 save gets 0)").
  - [x] 2.2 `src/save/migrations.ts`: `6: (s) => ({ ...s, money: 0 })` with a comment ("Story 3.1: nothing had been sold, so there is no money (FR21)"). A version-2 save now runs 2 → … → 7.
  - [x] 2.3 `src/save/validate.ts`: `int(s, 'money', 'state', 0)` (the default ceiling is `COUNTER_MAX`), next to the other top-level fields. Do **not** cross-check `money <= stats.moneyEarned`: the DEV "Add money" button (3.2) will break it.
  - [x] 2.4 `tests/save/busy.ts`: give `busyGame` a non-zero balance set directly (as `boostUntil` is), e.g. `state.money = TUNING.sellPriceAdult * 2 + TUNING.sellPriceElder` and the same added to `stats.moneyEarned` and `stats.sold += 3` — a `Sell` would change the flock the other fields rely on. Add `state.money > 0` to `isBusy` and its doc comment.
- [x] **Task 3: The Market stall (AC: 1, 3, 5)**
  - [x] 3.1 New `src/view/field/Market.ts`, modelled on `BetterPlace.ts` (read it first; mirror its structure, comments and no-allocation rules):
    - Export `MARKET` geometry, marked `[ASSUMPTION, mockups/hud.html; tune in the browser]`: the stall `{ x: 1100, y: 190, width: 160, height: 180 }` (world px; the mockup's awning 1100–1260 × 190–250, counter to y 370) and the hit rect = the mockup's inner outline 1088–1268 × 178–382 (180×204, well above `hit-min`).
    - Export `MARKET_BOUNDS: Rect` for the camera: everything the Market can draw — the outer outline (mockup 1080–1276 × 170–390) and the grown tag above it (mockup tag top 146; allow for the hover growth). Assert in a comment that it does not overlap `BETTER_PLACE_BOUNDS` or the Land I fence (430–1062), so misdrops need a real drag mistake (DESIGN Layout).
    - Export `inMarket(x, y): boolean`: a point-in-rect test on the hit rect. Allocates nothing.
    - Export `type MarketHighlight = 'off' | 'armed' | 'hovered' | 'invalid'`.
    - The class builds every part once per game from the `sheep-world` atlas (never created or destroyed during play), at `FIELD_DEPTH.ground` (+ offsets, like `BetterPlace`): the stall image (`market`, with `market-flap` and `market-disabled` frames), the outline image (`market-outline`, `market-outline-invalid`), and the price tag (an `Image` of a `boxTexture` plus a `Text` in `label` type). Shown at 2× like `BetterPlace` (`SCALE = 2`).
  - [x] 3.2 `setHighlight(level: MarketHighlight, price: number)`: a no-op unless the level or the price changes.
    - `off`: the plain stall only; outline and tag hidden; no tweens.
    - `armed`: the outline shown with a looping alpha pulse (yoyo), the tag shown with `STRINGS.marketPrice(price)` on an `awning` box with `wool` text.
    - `hovered`: as armed, plus the tag scaled up (about 1.25×) and the awning flapping (see `update`).
    - `invalid`: the stall frame `market-disabled`, the outline `market-outline-invalid` (no pulse), and the tag `STRINGS.marketTooYoung` on a `disabled` box with `disabledInk` text.
    - The tag box is `boxTexture(scene, w, h, { fill, border: fill, radius: RADIUS.sm, drop: false })` sized from the measured text plus the BetterPlace label padding, so it is built once per distinct text ("$10", "$5", "Too young") and cached; switch with `setTexture` on a change only.
    - Start and stop tweens only on a change. Put the motion constants in one `MARKET_MOTION` object (5.7 reduced motion).
  - [x] 3.3 `update(now)`: while `hovered`, alternate the stall frame between `market` and `market-flap` from real time (a step of about 120 ms), calling `setFrame` only when the frame changes — the `BetterPlace.update` pattern (precomputed frame names; no string building). Otherwise do nothing.
  - [x] 3.4 `gulp()` (optional name `takeSale()`): a one-shot visual nudge of the stall when a sheep goes in (e.g. a 1.05× squash, yoyo, ~100 ms). Visual only.
- [x] **Task 4: Drag targets in `SheepDrag` (AC: 3, 4, 5, 7, 8)**
  - [x] 4.1 Track the pointer over the stall beside the hole: `overMarket = !onHud && inMarket(wx, wy)` in `move` (the pointer, not the sheep; as `overHole`). The two hit areas never overlap.
  - [x] 4.2 Track the dragged sheep's stage from the frame's `PublicSheep` list in `sync` (it already looks the sheep up there), into a field such as `liveStage`. No allocation.
  - [x] 4.3 Add `get marketHighlight(): MarketHighlight` and `get marketPrice(): number`:
    - no live drag → `'off'`;
    - lamb (`salePrice(liveStage) === 0`) → `overMarket ? 'invalid' : 'off'` (see Open Question 3);
    - adult or elder → `overMarket ? 'hovered' : 'armed'`, with `marketPrice = salePrice(liveStage)`.
  - [x] 4.4 `end(sx, sy, onHud, time)`: after `move`, decide in this order: over the hole → `Sacrifice`; over the stall and `salePrice(liveStage) > 0` → `Sell`; otherwise (including a lamb over the stall) → `Drop` at the held point (the sim clamps into the fence). Rename the pending slot's `sacrifice` flag to `leaving` (true for `Sacrifice` and `Sell`: the sheep is about to vanish, is held lifted, and cannot be re-grabbed) and update its comments.
  - [x] 4.5 Update the class comment and `InputHooks.endDrag`'s doc in `src/input/InputController.ts` ("a sacrifice over the Better Place, a sale on the Market, otherwise a drop"). `InputController` itself needs no logic change.
- [x] **Task 5: GameScene wiring, camera and sale juice (AC: 2, 3, 4)**
  - [x] 5.1 Build `Market` in `create()` beside `BetterPlace`. In `render()`, set `this.market.setHighlight(drag.marketHighlight, drag.marketPrice)` and `this.market.update(this.game.loop.time)` next to the Better Place's two calls.
  - [x] 5.2 **Camera** (Open Question 1): split the focus from the pinned area. `PenCamera.centreOn(focus, area)`: centre on `focus`, clamped by `area` (today it uses one rect for both). GameScene keeps `playArea = union(union(fence, BETTER_PLACE_BOUNDS), MARKET_BOUNDS)` for `panBy` and centres on `union(fence, BETTER_PLACE_BOUNDS)`. Update the `PenCamera` class comment and the `playArea` field comment. The opening scroll must stay (49, 24); record the measured scroll and pan limits in the Dev Agent Record.
  - [x] 5.3 **Sale animation** (UX-DR82; reuses 2.7's ghost pool, see Dev Notes): in `onSim`, on `Sold`, start a ghost from the still-bound sprite (refactor `suck(id)` into a shared `ghostFrom(spr)` helper plus per-target tweens, so the copy of frame, flip, scale, angle, tint and position lives once). The sale tween: to the stall counter (about world (1180, 330)), scale to ~0.5 and alpha to 0 over ~250 ms, `Quad.easeIn`, no spin; on complete call `market.gulp()`. `[ASSUMPTION]` constants in a `SALE` object.
  - [x] 5.4 **Coin popup:** a `FloatPopups` instance in GameScene (world space, depth `FIELD_DEPTH.particles`, built once in `create`), and on `Sold` `spawn(MARKET tag centre x, tag top, STRINGS.salePopup(e.price))` — "$10" / "$5". `FloatPopups` already pools and is depth-parameterised; do not create a second popup class.
  - [x] 5.5 Leave the Esc chain, hover clearing, hold sync order and the suction exactly as they are.
- [x] **Task 6: HUD toast and copy (AC: 4, 5)**
  - [x] 6.1 `src/view/strings.ts`:
    - `marketPrice: (price: number): string => formatMoney(price)` ("$10"/"$5", UX-DR96) — import `formatMoney` from `src/core/format.ts`.
    - `marketTooYoung: 'Too young'` (UX-DR53, UX-DR96).
    - `salePopup: (price: number): string => formatMoney(price)` (UX-DR44, UX-DR82).
    - `soldToast: (price: number): string => \`A sheep sold. ${formatMoney(price)}.\`` (UX-DR93; 5.3 puts the name in place of "A sheep", in `halo`).
    - No "!" and no banned words.
  - [x] 6.2 `HudScene.onSim`: on `Sold`, `showToast(STRINGS.soldToast(e.price), { announcement: true })`, one per event (like `Sacrificed`).
- [x] **Task 7: Art (AC: 1, 3, 5)**. Placeholder pixel art in the DESIGN palette, made with a throwaway scratchpad encoder (the 2.1–2.7 pattern). Commit only the PNGs. All shown at 2×.
  - [x] 7.1 `assets/art/world/market.png`, about 80×90 (160×180 shown): a wooden (`wood` #8E5A30) frame with two posts, a red-and-cream striped awning (`awning` #B8453A and `wool` #FBF4E4 alternating stripes, scalloped bottom edge as in the mockup) and a `wood` counter at the bottom; a 1 px `bark` outline. Rectangular silhouette — no rounded shapes (DESIGN Shapes).
  - [x] 7.2 `market-flap.png`: the same with the awning's scallops lifted 1–2 px (the flap frame).
  - [x] 7.3 `market-disabled.png`: the same stall in `disabled` (#C9BCA6) and `disabled-ink` (#6E6052) tones only (the "desaturated" look; no filter at runtime).
  - [x] 7.4 `market-outline.png`, about 98×106 (shown ≈ 196×212, matching the mockup's 1080–1276 × 170–390 outer ring): an `awning` rectangle outline about 2–3 px (shown 5 px) with a fainter outer ring (the mockup's 45 % stroke), transparent inside. `market-outline-invalid.png`: the same in `disabled`.
  - [x] 7.5 Run `npm run assets` (only `sheep-world` changes). Add the `FRAME` keys (`market`, `marketFlap`, `marketDisabled`, `marketOutline`, `marketOutlineInvalid`) and extend `assets/CREDITS.md`'s placeholder row and file list. Check the atlas stays ≤ 2048².
- [x] **Task 8: Tests (AC: 4–7, 9–11)**. Vitest covers sim and save only; the view is browser-checked. Write each test red first, with `TUNING` values and literal seeds; no literal prices, ages or durations.
  - [x] 8.1 New `tests/sim/systems/market.test.ts`:
    - **Adult:** `Sell` emits exactly `[{ type: 'Sold', id, price: TUNING.sellPriceAdult }]` (no `SheepDied`, no `CarcassSpawned`); the sheep is gone with no carcass; `money` and `stats.moneyEarned` +price; `stats.sold` +1; `stats.died` unchanged; no rng drawn (`state.rng` unchanged); `nextId` unchanged.
    - **Elder:** age a sheep past `TUNING.elderFromMs` (set `bornAt`) → `TUNING.sellPriceElder`.
    - **Lamb:** no change at all (`structuredClone` + `toStrictEqual`), no event; a **dragged** lamb is put down as `wander` at its sim position and nothing else changes.
    - **Unknown id:** silently ignored, no event, no change.
    - **Last sheep:** `Sold` then `Lost`, `lostAt === time`; a lost game ignores `Sell` (`applyCommand` guard).
    - **Works on** a dragged, an infected, a Starving, a ready and an on-cooldown adult.
    - **Stage at apply time:** an adult exactly at `elderFromMs` when the command applies sells for the elder price.
  - [x] 8.2 `tests/sim/selectors.test.ts`: `salePrice` for each stage, against `TUNING`.
  - [x] 8.3 New scenario `tests/sim/scenarios/market.test.ts`:
    - **Selling breaks the chain** (EXPERIENCE flow): infect an adult, sell it, `runFor(state, TUNING.virusDeathMs + TICK_MS)`: no `SheepDied`, no carcass, infected count 0 — with a control run where it is not sold and leaves a carcass.
    - **A pregnancy outlives a sold parent:** the lamb is still born.
    - **Money accumulates and has no cap:** sell an adult and an elder → `money === sellPriceAdult + sellPriceElder`; a large preset `money` plus a sale is exact.
    - **Drag then sell:** `PickUp`, then `Sell` in the next tick's command batch, sells it (the normal view path).
  - [x] 8.4 Save tests:
    - `migrations.test.ts`: version 6 → 7 adds `money: 0`; a version-2 save migrates all the way and ends with `money: 0`; "newer version is rejected" uses 8.
    - `validate.test.ts`: rejects `money` missing, NaN, Infinity, negative, fractional, a string and above 2^48; accepts 0 and a large integer.
    - `roundTrip.test.ts` / `saveFile.test.ts`: the busy game (now with money) round-trips; `encodeSave` of a lost state after a last-sheep sale decodes.
    - `state.test.ts`: a new game has `money: 0`.
  - [x] 8.5 Update any existing test that lists every `GameState` key or event variant. Existing seeded movement and scenario expectations must **not** change (selling draws no rng); if one does, the code under test changed behaviour by mistake.
  - [x] 8.6 `npm test`, `npm run typecheck` and `npm run lint` (record the baseline: 487 tests after 2.8's review). The ESLint `isAbomination` rule must stay green with no new disables.
- [x] **Task 9: Browser check (AC: 1–8, 11)**. Scratchpad Playwright probe (the 2.7/2.8 pattern), driving the mouse with `page.mouse.move/down/up` in steps. Record evidence (numbers, dumped state, screenshots looked at) for **every** item; 2.7's review rejected checks marked done without evidence.
  - [x] 9.1 **Layout:** a new game opens at scroll (49, 24), with the pen, the hole and the whole stall in view; the stall on the right, clear of the fence and the era-badge corner (top-right, 3.5). Right-drag to every limit: the stall, its outline and tag, the hole and the pen never leave the view. Check at 960×540 too.
  - [x] 9.2 **Armed:** drag an adult: in the same frame the hole arms and the Market shows the pulsing outline and "$10"; an elder shows "$5". Hover the stall: the awning flaps and the tag grows; leave: back to armed. The tag never shows over a HUD control.
  - [x] 9.3 **Sell an adult and an elder:** the ghost hops into the stall, "$10"/"$5" rises from the stall, the stall nudges, the toast reads "A sheep sold. $10." / "A sheep sold. $5.", no carcass. Dump state: `money` 15, `stats.sold` 2, `stats.moneyEarned` 15, `died` unchanged. No frame with both the sprite and the ghost.
  - [x] 9.4 **Lamb:** drag a lamb: the Market stays plain; over the stall it greys out with "Too young"; release there → the lamb is put down inside the fence (clamped, no slide from its pickup spot), no money, no toast.
  - [x] 9.5 **Misdrops:** an infected adult dropped on the stall sells (the threat summary's Infected drops by 1); a sheep dropped in the hole still sacrifices, with the boost.
  - [x] 9.6 **Last sheep:** sell down to 0 → "The flock is gone.", and Restart starts a new game with `money: 0`.
  - [x] 9.7 **Save:** after a sale, hide the tab (forced save), reload → Continue: `money` and `stats` survive; the save's `schemaVersion` is 7. Plant a version-6 save (debug Load save with an edited envelope) → it loads with `money: 0`.
  - [x] 9.8 **2.7 regressions:** Esc mid-drag over the stall cancels to the pickup spot; release off the canvas cancels; drop on the field is placed exactly; drop over the Pause button is a drop.
  - [x] 9.9 **Performance** (rendering story): about 100 sheep at ×1 with the overlay open, idle and while dragging over the stall, against the 2.7/2.8 baseline (SwiftShader: 39–41 idle, 35 dragging). `setHighlight`, `update` and `SheepDrag.sync` allocate nothing per frame.
  - [x] 9.10 No console errors or warnings beyond SwiftShader's GL notices.
- [x] **Task 10: Bookkeeping**
  - [x] 10.1 `src/debug/DebugOverlay.ts` (optional, DEV only): show `money $n · sold n` on a readout line, so the balance is visible before 3.2's counter. Keep "Add money" for 3.2 (its marked comment).
  - [x] 10.2 `deferred-work.md`:
    - Mark resolved: "The Market (Story 3.1)" (2.7 section); the 3.1 part of the field-camera note ("3.1 adds the Market to `GameScene.playArea`"); "Exit animations" ("3.1 can reuse the ghost for the sale" → done).
    - Add a 3.1 section: **3.2** money counter reads `state.money` (via `HudView`); **3.3** the later land tiers vs the stall (Land I ends at x 1062; check II/III never reach x 1080) and recompute both camera rects when the fence grows; **4.1** `stageOf` must report lamb for the Abomination, which is what keeps it unsellable; **5.3** names in the sold toast; **5.6** the cash-register ding and a `[ding]` caption if captions cover it; **5.7** reduced motion for the outline pulse, awning flap, tag growth and sale hop.

## Dev Notes

### Current code to build on (read these first)

- **`src/sim/systems/betterPlace.ts` `sacrifice`:** the exact model for `sell` — `sheepIndex` guard, emit first, mutate, `removeSheep` last so `Lost` follows. No rng, no `nextId`.
- **`src/sim/systems/carcass.ts` `removeSheep(state, id, reason)`:** already takes `'sold'` and increments `stats.sold`; no carcass, no event, ends with `checkLastSheepAndLoss`. Its header already names "a sale (3.1)". Do not add another way out of `state.sheep`.
- **`src/sim/systems/drag.ts`:** a dragged sheep keeps its sim position (the pickup spot) until dropped; `drop` clamps into `innerFence`. A lamb released on the stall uses exactly this.
- **`src/sim/selectors.ts`:** `stageOf`, `sheepIndex`, `Stage`. `HudView`'s comment "Later stories add money, flock and capacity" is 3.2's (do not add `money` to `HudView` here unless the debug readout needs it — it can read `simState` directly).
- **`src/view/field/BetterPlace.ts`:** the template for `Market.ts` — fixed world geometry constants, a `*_BOUNDS` rect for the camera, a point test, a `setHighlight` that works only on change, an `update(now)` frame cycler with precomputed names, a `gulp()`, `SCALE = 2`, parts at `FIELD_DEPTH.ground`, the tag as `boxTexture` + `Text`.
- **`src/view/field/SheepDrag.ts`:** `overHole`, `highlight`, `end` (decides the command), the 4 pending slots (`sacrifice` flag → rename `leaving`), `sync(sheep, time)` (already scans the frame's `PublicSheep` list for the live id — read the stage there).
- **`src/view/scenes/GameScene.ts`:** `create` (BetterPlace, `playArea = union(...)`, `penCamera.centreOn`), `render` (`betterPlace.setHighlight(sheepDrag.highlight)` + `update`), `onSim` (field juice, `Sacrificed` → `suck`), `suck(id)` and the 3-ghost pool, `union()`.
- **`src/view/field/PenCamera.ts`:** `centreOn(area)` / `panBy(dx, dy, area)`, `minX/maxX/minY/maxY`, the "too big → centre" clamp.
- **`src/view/juice/FloatPopups.ts`:** `new FloatPopups(scene, depth)`, `spawn(x, y, text)`; pooled (8), rises 24 px over 600 ms.
- **`src/view/scenes/HudScene.ts` `onSim`:** `Sacrificed` → `showToast(STRINGS.sacrificeToast, { announcement: true })`; add `Sold` beside it.
- **`src/core/format.ts` `formatMoney(n)`:** "$" + whole number, no K/M; already tested.
- **`src/config/constants.ts`:** `COMPONENTS.dropTargetMarket` (`highlightColor: 'awning'`, `priceTagBackground: 'awning'`, `priceTagText: 'wool'`, `shape: 'rectangle'`) and `COMPONENTS.dropTargetInvalid` (`tintColor: 'disabled'`) already exist; use them. Also `COMPONENTS.floatPopup`, `RADIUS.sm`, `TYPOGRAPHY.label`.
- **`src/save/{migrations,validate}.ts`, `tests/save/busy.ts`:** 2.8's version-5 → 6 step (`boostUntil`) is the model: migration, validation, busy fixture, tests, all in one story.

### Placement and camera

- **World coordinates = the mockup's canvas coordinates** (2.7 established this). Mockup mid-drag state: awning stripes 1100–1260 × 196–250, top beam y 190, posts at x 1110 and 1240 down to y 366, counter 1100–1260 × 306–370; armed outline 1088–1268 × 178–382 (stroke 5) and outer 1080–1276 × 170–390 (stroke 3, 45 % opacity); "$10" tag at left 1146, top 146. The Land I fence (430–1062) and the Better Place (442–598 × 72–186) are both clear of it.
- **Why the focus and the pinned area must split:** the union of pen, hole and stall spans x 442–1276 (834 px). Centring on it gives scroll x ≈ 219, which puts the hole at screen x ≈ 223–379 — **under 3.2's 360 px shop panel** (16–376) and left of DESIGN's "about x 450–590". Centring on pen ∪ hole (2.7's view, scroll (49, 24)) puts the hole at 393–549 and the stall at screen x ≈ 1031–1227 (outer ring), inside the 1264 safe edge. So: centre as 2.7 does, pin to all three. Pinned limits then become x ∈ [12, 426] and the opening scroll is inside them.
- **Hit test uses the pointer**, like the hole: `inMarket(pointer world point)`; a release over a HUD control is never a sale (`onHud`, as 2.7's review fixed for the hole).

### Sale animation

- Same reason as the suction: `EntityLayer.playExit()` is synchronous, and the deferred-work decision is to play exits on a pooled ghost started from the event while the real sprite is still bound (`onSim` runs inside the tick; `render()`'s sweep comes later the same frame). The sold sprite is held lifted at the release point by its `leaving` pending slot until the tick applies, so the ghost starts exactly where the player let go — no double image, no snap-back.
- Refactor, don't duplicate: one helper copies the sprite into the next ghost; `suck` and the sale add their own tweens. Keep 3 ghosts (a sale and a sacrifice in the same frame is the realistic maximum).

### What must be preserved

- **2.7 drag semantics** (AC 8): threshold, press-time hit test, `onHud` guard, cancel paths, death mid-drag, pending-slot hold and snap, re-grab rules (a `leaving` sheep cannot be re-grabbed), no per-frame allocation.
- **2.8 boost:** only `Sacrifice` boosts; a sale never touches `boostUntil`.
- **Determinism:** `sell` draws no rng; existing seeded expectations do not move.
- **N1:** `killSheep` and `removeSheep` remain the only ways out of `state.sheep`.
- **Save:** the dragged → `wander` mapping in `savable`, the corrupt-save tests, the backup slot behaviour.
- **Layering:** sim pure; the view reads selectors (`salePrice`, `PublicSheep`) and dispatches; tweens never change state; colours from `COLORS`/`COMPONENTS`, copy from `strings.ts`.

### Architecture compliance

- **Locations:** `src/sim/systems/market.ts` (System Location Mapping); `view/field/Market.ts` (architecture tree "field/ … Market"); command `Sell` and event `Sold` are both already in the architecture's lists.
- **Money:** a plain integer field on `GameState` (no cap, FR21), formatted only by `formatMoney`. The architecture's `economy.ts` (purchases, land, upgrades) is 3.2/3.3's; selling owns only the earn side.
- **Commands in, events out:** `Sell` → sim; `Sold` → view (toast, popup, ghost). The view never writes `money`.

### Library / framework notes (Phaser 4.2.1 installed; no new dependencies)

- Everything needed is already used in this codebase: images from the `sheep-world` atlas, `setFrame`, `setTexture`, `boxTexture`, `Text` + `textStyle`, tweens with `yoyo`/`repeat: -1` and `killTweensOf`, `FloatPopups`.
- No filters: the "desaturated" stall is a pre-drawn `market-disabled` frame (the project avoids per-object filters for the FPS budget). No Phaser 3 APIs from memory (`setTintFill`, `preFX`, `BitmapMask`).
- No web research needed: no library or version changes.

### Testing standards

- Vitest covers `src/sim/` and `src/save/` only, in `tests/<same path as src>/`; scenarios in `tests/sim/scenarios/`.
- Helpers: `newGame(seed)`, `runFor` (multiples of `TICK_MS`), `fillFlock`, `innerFence` (`tests/sim/helpers.ts`); `busyGame`/`isBusy` (`tests/save/busy.ts`).
- No fake timers, no Phaser, no mocking. `structuredClone` + `toStrictEqual` for "nothing changed"; `drainEvents` to read events; `TUNING` for every number.

### Previous story intelligence (2.7, 2.8)

- **2.7 review lessons:** a release over a HUD control must never trigger a target (fixed for the hole; do the same for the stall); no string building per frame (precompute frame names); every browser check needs recorded evidence; tests use `TUNING`, not literals; post-action checks (after a lamb bounces, it behaves normally next tick).
- **2.8 lessons:** the save bump is migration + validation + `busyGame` + tests together; a lost game must not show stale juice (the sale popup and ghost are one-shots, so nothing lingers, but check the lose screen after a last-sheep sale).
- **Browser probe setup:** `playwright-core` from `/home/rylanevans/nr-csp/frontend/node_modules` with `/usr/bin/google-chrome` (SwiftShader); DEV server on its own port (5200 worked); stop it with `kill <vite node pid>`, never `pkill -f`; plant saves via debug Load save, read state via Dump state; move the mouse in steps for drags.
- **Baseline FPS** (SwiftShader, ~102 sheep, ×1, overlay open): 39–41 idle, 35 while dragging.
- **Commit style:** `Implement story 3.1: Sell Sheep at the Market`.

### Git intelligence

- Recent commits: `26fdb5b` (2.8 review; Epic 2 closed), `3ef6b6b` (2.8), `f449be1` (2.7 review), `b871bde` (2.7), `7cccafd` (2.6).
- Per-story pattern: a sim rule plus unit and scenario tests; a save bump with migration and validation when the shape changes; view object(s) and juice; placeholder art and atlas rebuild; `deferred-work.md`; a Dev Agent Record with browser evidence and FPS.
- 2.7/2.8 touched `GameScene.ts`, `SheepDrag.ts`, `HudScene.ts`, `strings.ts`, `migrations.ts`, `validate.ts` and `busy.ts` — read their current versions, not older story text.

### Out of scope

- **3.2:** the money counter, `HudView.money`, the Shop toggle and panel, `Buy`, the DEV "Add money" button.
- **3.3:** land tiers and fence growth (and recomputing the camera rects then). **3.5:** the era badge in the top-right corner.
- **5.3:** names in the toast. **5.6:** the cash-register ding (no `AudioDirector` exists yet). **5.7:** reduced motion. **5.8:** a bouncy "bounce back" animation for the lamb (here it is the 2.7 clamp-and-snap).
- Selling lambs, selling by click, a sell confirmation, an undo.

### Open questions (defaults chosen; confirm or change)

1. **Camera.**
   - **Default:** open on pen ∪ Better Place (2.7's view, unchanged); pin the pan to pen ∪ Better Place ∪ Market.
   - **Alternative:** centre on all three. The view shifts ~170 px right and the hole lands under 3.2's shop panel.
2. **Market position.**
   - **Default:** fixed at the mockup's world 1100–1260 × 190–370.
   - **Alternative:** relative to the pen's right edge (moves when land grows; DESIGN says "fixed").
3. **A lamb's drag.**
   - **Default:** the Market stays plain until the pointer is over it, then shows "Too young" (the AC's literal reading).
   - **Alternative:** show the invalid look from drag start, warning the player before they aim.
4. **A lamb released on the stall.**
   - **Default:** a `Drop` at the release point, clamped inside the fence (snaps, like any drop outside the fence).
   - **Alternative:** return to the pickup spot, like a cancel.
5. **Sale animation.**
   - **Default:** the ghost hops into the stall (shrink + fade, ~250 ms) and the stall nudges.
   - **Alternative:** the sheep simply vanishes with the popup.
6. **Price at apply time.** The view's tag may show "$10" for the frame in which an adult turns elder; the sim charges the stage at the tick. **Default:** accept (the toast and popup always show the real price).

### Project Structure Notes

- New files:
  - `src/sim/systems/market.ts`
  - `src/view/field/Market.ts`
  - `tests/sim/systems/market.test.ts`, `tests/sim/scenarios/market.test.ts`
  - `assets/art/world/{market,market-flap,market-disabled,market-outline,market-outline-invalid}.png`
- Modified:
  - `src/config/{tuning,constants}.ts` (constants: schema version only)
  - `src/sim/{state,selectors,commands,events}.ts`
  - `src/save/{migrations,validate}.ts`
  - `src/input/InputController.ts` (comments only)
  - `src/view/field/{SheepDrag,PenCamera}.ts`
  - `src/view/scenes/{GameScene,HudScene}.ts`
  - `src/view/{strings,assetKeys}.ts`
  - `src/debug/DebugOverlay.ts` (optional readout)
  - `assets/CREDITS.md`
  - tests: `tests/sim/{selectors,state,commands}.test.ts`, `tests/save/{busy.ts,migrations.test.ts,validate.test.ts,saveFile.test.ts,roundTrip.test.ts}`
  - `_bmad-output/implementation-artifacts/deferred-work.md`
- Regenerated: `public/assets/atlases/sheep-world.{png,json}`.
- No conflicts with the unified structure.

### Project Context Rules (from `_bmad-output/project-context.md`)

- **N1:** non-sacrifice deaths go through `killSheep`; sell and sacrifice through `removeSheep`; both end with `checkLastSheepAndLoss` — selling the last sheep is a loss. Never splice `state.sheep` elsewhere.
- **No confirmations** on sell (a misdrop is the joke; FR20, UX-DR68).
- **The Abomination is secret:** `PublicSheep` only in the view; it is a lamb there, so it is "Too young" like any lamb. Never read `isAbomination` outside `src/sim/`, `src/debug/`, `src/save/`.
- **Save:** a new `GameState` field requires a `SAVE_SCHEMA_VERSION` bump, a migration and validation in the same story; round-trip and corrupt-save tests stay green; storage only in `src/save/`.
- **The sim is pure:** no Phaser, DOM, `Date.now()` or `Math.random()`; `TUNING` holds every number (prices); `COLORS`/`COMPONENTS` every colour (`awning` = Market, never alerts; `alert` never for the Market; money is `hay`, never `halo`); copy in `strings.ts`.
- **No allocation in hot paths;** world objects built once (no `new`/`destroy` during play); sprites from the atlas; no `Graphics` redrawn per frame.
- **Input:** a single `InputController`; field hit tests in world coordinates (pointer + camera scroll); no `setInteractive` on field sprites.
- **Done:** `npm test`, `npm run typecheck` and `npm run lint` pass, plus the browser checks and the 100-sheep performance spot check.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.1; FR17, FR20, FR21, FR38; AR3, AR9, AR17, AR18, AR19, AR22; UX-DR2, UX-DR10, UX-DR44, UX-DR46, UX-DR48, UX-DR51, UX-DR53, UX-DR67, UX-DR68, UX-DR82, UX-DR90, UX-DR93, UX-DR96]
- [Source: _bmad-output/planning-artifacts/gdds/gdd-sheep-civilization-2026-10-05/gdd.md#Life Stages (Can sell $10/$5); Market (Selling); Economy and Resources (money: selling only, no cap); Controls (drag → Market stall)]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-sheep-civilization-2026-10-05/DESIGN.md: Colors (`awning`, `wood`; Market vs Better Place opposites), components `drop-target-market`, `drop-target-invalid`, `float-popup`; Layout (Market right edge, outside the fence; Better Place clear of the shop panel); Shapes (Market rectangular)]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-sheep-civilization-2026-10-05/EXPERIENCE.md: Interaction Primitives (both targets highlight, awning flaps, "Too young" bounce, no confirmations); Game Feel (Sale: coin popup, ding); Voice ("{name} sold. $10." / "$5.", "Too young"); Key Flows (the misdrop on the Market)]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-sheep-civilization-2026-10-05/mockups/hud.html: "Alternate state: sheep mid-drag" — stall rects, outline strokes, "$10" tag at (1146, 146)]
- [Source: _bmad-output/game-architecture.md: System Location Mapping (`market.ts`), Event System (`Sold`), Commands (`Sell`), N1 (`removeSheep`), Formats (`formatMoney`), Project Structure (`field/ … Market`)]
- [Source: _bmad-output/implementation-artifacts/deferred-work.md: "The Market (Story 3.1)", Exit animations, Field camera (3.1 adds the Market to the play area)]
- [Source: _bmad-output/implementation-artifacts/2-7-drag-a-sheep-into-the-better-place.md, 2-8-sacrifice-food-boost.md (drag pipeline, review findings, save bump pattern, probe setup)]
- [Source: _bmad-output/project-context.md]

## Dev Agent Record

### Agent Model Used

Claude Opus 5.5 (1M context), `claude-opus-5-5[1m]`

### Implementation Plan

- **Sim:**
  - `TUNING.sellPriceAdult` (10) and `sellPriceElder` (5); `GameState.money` (0 at a new game).
  - `salePrice(stage)` in `selectors.ts`: the one price rule, used by both the sim and the Market's tag.
  - New command-only `systems/market.ts` `sell`: unknown id → ignored. A lamb → nothing, and a dragged one is put down as `wander`. Otherwise: `Sold { id, price }`, then `money` and `stats.moneyEarned` += price, then `removeSheep(…, 'sold')`, so `Lost` comes last. No rng, no id.
  - `Sell` command and `Sold` event.
- **Save:** `SAVE_SCHEMA_VERSION` 7; migration `6 → money: 0`; validation requires an integer in [0, 2^48]. `busyGame` holds money from three sales.
- **View:**
  - `field/Market.ts`:
    - `MARKET` (centre x 1180, foot y 372, hit rect 1088–1268 × 178–382), `MARKET_BOUNDS` and `inMarket`;
    - the stall, the outline and a tag container, built once at `FIELD_DEPTH.ground`;
    - `setHighlight('off' | 'armed' | 'hovered' | 'invalid', price)`: the outline pulses; the tag grows on hover; `invalid` swaps in the greyed stall and outline frames and a "Too young" tag on `disabled`;
    - `update(now)` flaps the awning while hovered, cycling 2 precomputed frames; `nudge()`.
  - `SheepDrag`:
    - `overMarket` from the pointer (never on a HUD control);
    - the dragged sheep's stage, read at `begin` and each `sync`;
    - `marketHighlight` / `marketPrice`;
    - `end` → `Sacrifice` / `Sell` / `Drop` (a lamb on the stall is a `Drop`, which the sim clamps into the fence);
    - the pending flag `sacrifice` renamed `leaving`.
  - `PenCamera.centreOn(focus, area)`: GameScene centres on pen ∪ Better Place and pins to pen ∪ Better Place ∪ Market.
  - `GameScene`: builds the Market and a world-space `FloatPopups`. On `Sold`, a "$10"/"$5" popup rises from the stall, and a pooled ghost hops into the counter (shrink and fade, 250 ms), then the stall nudges. `suck` and the sale share `ghostOf(id)`.
  - `HudScene`: the "A sheep sold. $10." toast.
  - `strings.ts`: `marketPrice`, `marketTooYoung`, `salePopup`, `soldToast`.
- **Art:** `world/market{,-flap,-disabled,-outline,-outline-invalid}`; `sheep-world` rebuilt (39 frames, 338×330).
- **Debug:** the DEV sheep line shows `$n · sold n`.

### Debug Log References

- **Red phase:** before implementation, 2 new test files could not load (no `market` module) and many save and selector tests failed (no `money`, no `salePrice`, `busyGame` not busy). After it: 487 → 514 tests (27 new), all pass. Typecheck and lint are clean.
- **Deviations from the task text:**
  - **`MARKET` geometry (3.1):** a centre x and foot y plus the hit rect, not `{ x, y, width, height }`; the stall image is anchored at its foot, so the nudge squashes from the ground.
  - **The one-shot is `nudge()`** (the story allowed either name).
  - **The coin popup** rises from the stall's top (`MARKET.hit.y`, where the tag was), not the tag's exact centre: the tag is already hidden after the release.
  - **The drag stage is also read in `begin`** (from the last frame's `PublicSheep` list), not only in `sync`: a press, move and release in one frame would otherwise sell with a stale stage.
- **Browser probe:** scratchpad `playwright-core` with system Chrome (SwiftShader), DEV server on port 5200, states planted through debug Copy/Load save. There were no console errors or warnings in any run.
  - **9.1 Layout:** the game opens at scroll (49, 24): the stall's left edge is at screen x 1049 = world 1098. The pen, the hole and the whole stall are in view.
  - **9.1 Pan limits:** right-drags to all four limits keep the stall (with its outline and tag), the hole and the pen in view. At the right limit (scroll x 12) the stall ends about 14 px inside the edge. At the left limit the hole sits under the Pause button, as in 2.7.
  - **9.1 960×540:** the tag "$10", the stall and the hole's label are legible.
  - **9.2 Armed:** dragging an adult arms both targets in the same frame: a pulsing awning outline and "$10" over the stall, and the hole lit. An elder shows "$5". (Pixelify Sans draws its 5 with a flat top, so at 20 px it reads close to an "S"; the toast, in Nunito, is unambiguous.) Over the stall the tag grows and the awning flaps.
  - **9.3 Sales:**
    - An adult then an elder: the dumps read `money` 10 then 15, `sold` 1 then 2, `moneyEarned` 15, `died` 0, no carcasses.
    - Toasts "A sheep sold. $10." and "A sheep sold. $5."; the "$10" popup rises from the stall.
    - The release frame shows the sheep held lifted in the stall, then the ghost hop. No frame has both the sheep and its ghost.
  - **9.4 Lamb:** the stall stays plain while the lamb is dragged elsewhere. Over the stall it greys out (greyed art and outline, a "Too young" tag in `disabled`). Released there, the lamb lands clamped inside the fence at (896, 370), `wander`, money unchanged, no toast.
  - **9.5 Misdrops:** an infected adult dropped on the stall is sold: the infected count goes 1 → 0, no carcass, `money` 10. A sheep dropped in the hole is still sacrificed, with the boost (28.9 s left at the dump), and the sale gave no boost.
  - **9.6 Last sheep:** selling the last sheep shows "The flock is gone." (Survived 0:11 · Peak flock 3) with the toasts. Restart gives `money` 0, 3 sheep, no `lostAt`.
  - **9.7 Save:**
    - After a sale, hiding the tab saved schema 7 with `money` 10 and `sold` 1; reload → Continue resumed `money` 10, `sold` 1, `moneyEarned` 10.
    - A planted version-6 save (no `money`) loads with `money` 0.
  - **9.8 2.7 regressions:**
    - Esc mid-drag over the stall puts the sheep back at its pickup spot (750, 420), unsold.
    - A release off the canvas (1600-wide viewport) cancels to the pickup spot.
    - A field drop lands exactly at (720, 500).
    - With the camera at its left limit, a drop on the Pause button is a plain drop, clamped to (596, 370), with nothing sacrificed or sold.
  - **Fast sale stress:** 10 of 10 fast drag-and-release sales onto the stall succeeded.
  - **An intermittent first drag (pre-existing, not from 3.1):**
    - In about 3 of 33 probe runs, the first drag after the session's first debug Load never started: the sheep stayed put and no command was sent.
    - It also happens on the pre-story commit 26fdb5b, checked in a temporary worktree: 2 of 10 runs. It is unaffected by waiting 300 ms or 1.5 s after the load, and never happened on a later drag in the same session.
    - It is recorded in `deferred-work.md` for a look with real mouse input.
  - **9.9 Performance** (SwiftShader, 103 sheep, ×1, overlay open): 40 FPS idle and 38 while dragging over the hovered stall (2.7/2.8 baseline: 39–41 idle, 35 dragging). `Market.setHighlight` and `update` return early without a change, and `SheepDrag.sync` allocates nothing (an index scan).
  - **9.10:** no console errors or warnings.

### Completion Notes List

- 2026-10-07: Story created. Ultimate context engine analysis completed — comprehensive developer guide created.
- 2026-10-07: Implemented. All ACs are met; the Open Questions are implemented at their defaults:
  1. the camera opens on the pen and the Better Place, and the pan is pinned to all three;
  2. the stall is fixed at the mockup position;
  3. a lamb leaves the stall plain until it is over it;
  4. a lamb released on the stall is clamped into the fence;
  5. the ghost hops into the stall;
  6. the price is the stage when the command applies.
- AC evidence:
  - AC 1–3, 5, 7 and 8: browser checks (above).
  - AC 4 and 6: `market.test.ts` (unit) and `scenarios/market.test.ts`, plus the browser sales, toasts and popup.
  - AC 9: the migration, validation, `busyGame` and round-trip tests, plus browser hide → reload → Continue and the v6 load.
  - AC 10: `PublicSheep` is unchanged, `Sold` carries only `id` and `price`, and grepping `src/view` and `src/input` finds no secret reads.
  - AC 11: `npm test` (514), `npm run typecheck` and `npm run lint` pass.
- The cash-register ding is deferred to 5.6 (no `AudioDirector` yet), as the story planned.
- `deferred-work.md`: resolved the 3.1 Market item, the 3.1 part of the field-camera note and the ghost reuse; added a 3.1 section (3.2 money counter, 3.3 land vs stall and camera rects, 4.1 the Abomination stays a lamb, 5.3 names, 5.6 ding, 5.7 reduced motion, the intermittent first drag).

### File List

- `src/config/tuning.ts` (modified)
- `src/config/constants.ts` (modified)
- `src/sim/state.ts` (modified)
- `src/sim/selectors.ts` (modified)
- `src/sim/commands.ts` (modified)
- `src/sim/events.ts` (modified)
- `src/sim/systems/market.ts` (new)
- `src/save/migrations.ts` (modified)
- `src/save/validate.ts` (modified)
- `src/input/InputController.ts` (modified, comments only)
- `src/view/field/Market.ts` (new)
- `src/view/field/SheepDrag.ts` (modified)
- `src/view/field/PenCamera.ts` (modified)
- `src/view/scenes/GameScene.ts` (modified)
- `src/view/scenes/HudScene.ts` (modified)
- `src/view/strings.ts` (modified)
- `src/view/assetKeys.ts` (modified)
- `src/debug/DebugOverlay.ts` (modified)
- `assets/art/world/market.png`, `market-flap.png`, `market-disabled.png`, `market-outline.png`, `market-outline-invalid.png` (new)
- `assets/CREDITS.md` (modified)
- `public/assets/atlases/sheep-world.png`, `public/assets/atlases/sheep-world.json` (regenerated)
- `tests/sim/systems/market.test.ts` (new)
- `tests/sim/scenarios/market.test.ts` (new)
- `tests/sim/selectors.test.ts` (modified)
- `tests/sim/state.test.ts` (modified)
- `tests/save/busy.ts` (modified)
- `tests/save/migrations.test.ts` (modified)
- `tests/save/saveFile.test.ts` (modified)
- `tests/save/validate.test.ts` (modified)
- `_bmad-output/implementation-artifacts/deferred-work.md` (modified)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modified)
- `_bmad-output/implementation-artifacts/3-1-sell-sheep-at-the-market.md` (this story)

### Change Log

- 2026-10-07: Implemented Story 3.1. Selling at the Market:
  - the `Sell` command, `market.ts` and the `Sold` event; `state.money` with save schema 7 (migration and validation); `salePrice`;
  - the Market stall with its armed, hovered and "Too young" drag looks;
  - the sale ghost hop, coin popup and toast; the camera pinned to include the stall;
  - placeholder art; 27 new tests.

  Status → review.
