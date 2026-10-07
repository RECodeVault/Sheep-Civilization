---
baseline_commit: d1289e6
---

# Story 2.6: Alert Pings and Threat Summary

Status: done

<!-- Created 2026-10-07 by create-story. Builds on 2.5 (PublicSheep.infected, infection marker and the overlay stack in SheepSprite), 2.4 (carcasses, CarcassSprite), 1.5 (hunger states) and 1.6/2.3 (BottomBar, HudScene tooltips). -->

## Story

As a player,
I want threats to ping on the field and a live threat count in the HUD,
so that I can spot problems across a big flock.

## Acceptance Criteria

1. **Ping on entry (UX-DR54).** An `alert-ping` pops above a sheep or carcass when:
   - a sheep enters Starving (`PublicSheep.hunger` becomes `'starving'`);
   - a sheep becomes infected (`PublicSheep.infected` becomes true);
   - a carcass spawns (it appears in `selectCarcasses`).

   The ping is a 20 px `alert` circle with a `wool` "!" glyph and a 2 px `bark` outline. It pops in, bobs for about 3 s (`PING.bobMs`), then settles to a small static `alert` dot.
2. **Until the state resolves.** The ping (or dot) stays while the threat lasts:
   - A sheep keeps it while it is Starving **or** infected. It goes when neither is true (it ate), or when the sheep leaves the field (death; later sale or sacrifice).
   - A carcass keeps it until the carcass is cleared or eaten.
   - A sheep that is already pinged and gets a **second** threat (a Starving sheep that becomes infected, or an infected sheep that starts starving) pops again: each entry is news. It still shows only one ping.
   - A sheep that recovers and then starves again pops again.
3. **On load.** Sheep and carcasses that are already threatened when a game starts or loads pop their pings, as carcasses flop in and pieces bounce in on load.
4. **Drawn in the world-overlay band (UX-DR10).** The ping follows the drawn (interpolated) sheep, stacked above the infection marker and any heart, and pans with the field camera. Pings draw above every sheep, piece, carcass, heart, marker and particle. The sheep tooltip still draws above them. The "above the shop panel" half of UX-DR10 lands with the shop in Story 3.2 (see Open Question 1 and Task 7.2).
5. **Threat summary (UX-DR39).** The bottom bar shows a `threat-summary`: three icon and count pairs, in this order:
   - Starving: an `alert` drooping sheep icon.
   - Infected: an `infection` bubble cluster icon.
   - Carcasses: a `bark-soft` X-eyes icon.

   The counts update live, on the frame of the change. They are in `numeric` type, `bark`, in fixed-width boxes so the pairs never move (UX-DR5), left-aligned against their icon (changed in code review, Rylan 2026-10-07: a right-aligned single digit read as belonging to the next pair). A zero count dims to `disabled-ink`. A sheep that is both Starving and infected counts in both.
6. **Hover, no click (UX-DR39, UX-DR96).** Hovering a pair for `HOVER_DELAY_MS` shows the HUD tooltip:
   - "{n} starving"
   - "{n} infected"
   - "1 carcass" or "{n} carcasses"

   Clicking a pair does nothing, and the pointer stays the default arrow (it is not a button).
7. **Secrecy (UX-DR64, AR18).** Pings and counts read only `PublicSheep`, `selectCarcasses` and `selectHudView`. The Abomination (Epic 4) is therefore pinged and counted exactly like any lamb when it starves or is infected, never on its own account. Its stalking and its victim's doom show nothing; the victim's carcass pings like any other. Nothing in `src/view/` reads `isAbomination`, `stalk` or `doomedAt`.
8. **No save change.** Pings and counts are derived each frame. `GameState`, `SAVE_SCHEMA_VERSION` and validation are unchanged.
9. `npm test`, `npm run typecheck` and `npm run lint` all pass.

## Tasks / Subtasks

- [x] **Task 1: Threat counts selector (AC: 5, 7)** in `src/sim/selectors.ts`
  - [x] 1.1 Add `ThreatCounts { starving: number; infected: number; carcasses: number }` and `HudView.threats: ThreatCounts`. The architecture's `hudView` sketch already lists `threats`.
  - [x] 1.2 In `selectHudView`, fill `out.threats` **in place** with one plain loop over `state.sheep`:
    - `starving` counts `hungerOf(s.fullness) === 'starving'`. Use the selector, which has the float epsilon; never write `fullness < 25`.
    - `infected` counts `s.infectedAt !== undefined`.
    - `carcasses` is `state.carcasses.length`.

    No allocation, no closures. Use exactly the derivations `publicSheep` uses, so the counts can never disagree with what the field shows (AC 7).
  - [x] 1.3 Update the `HudView` doc comment ("Later stories add money, flock, capacity and boost"). Update the `HudScene.view` initial literal to `threats: { starving: 0, infected: 0, carcasses: 0 }`.
- [x] **Task 2: Depth bands (AC: 4)**, new `src/view/field/depths.ts`
  - [x] 2.1 One module for GameScene's depth bands, replacing the scattered constants:
    - World entities draw at depth = y (≤ 720 today), as now.
    - `FIELD_DEPTH.overlay = 9_997`: ready, pinned and pregnancy hearts and the infection marker (was `READY_DEPTH`, 9 998).
    - `FIELD_DEPTH.particles = 9_998`: the munch, poof and dust emitters (were `TOOLTIP_DEPTH - 1`).
    - `FIELD_DEPTH.ping = 9_999`: alert pings and dots.
    - `FIELD_DEPTH.tooltip = 10_000`: the sheep tooltip.
  - [x] 2.2 Replace `READY_DEPTH` (`SheepSprite.ts`, `PregnancyHeart.ts`) and GameScene's `TOOLTIP_DEPTH` with these. Keep a short comment on why the band sits above any world y. Remove the now-stale "the world-overlay layer itself arrives with pings in Story 2.6" comment in `SheepSprite.ts`.
- [x] **Task 3: The `AlertPing` view helper (AC: 1, 2, 4)**, new `src/view/field/AlertPing.ts`
  - [x] 3.1 A small class owned by a sprite and pooled with it (like `SheepSprite`'s hearts). It is not a Phaser game object itself. It owns:
    - `ping`: an `Image` of `FRAME.alertPing` at scale 2, origin (0.5, 1), depth `FIELD_DEPTH.ping`, hidden.
    - `dot`: an `Image` of `FRAME.alertDot`, the same setup.
    - `bob = { y: 0 }`, a plain tweened object (as `pinBob` and `markerBob` are).
    - `poppedAt` (game ms) and a `state: 'off' | 'bobbing' | 'settled'`.
  - [x] 3.2 API, each call doing work only on a change and allocating nothing per frame:
    - `pop(simTime)`: show the ping, hide the dot. Kill and restart the pop-in tween (scale from about 40 % of its size up to its full 2× scale with `Back.easeOut`, about 150 ms) and the looping bob tween (about 3 px over 400 ms, yoyo). Set `poppedAt = simTime` and `state = 'bobbing'`.
    - `place(x, y, simTime)`: called every frame while not `'off'`, with the anchor point (bottom-centre). While bobbing, position the ping at `y + bob.y`. Once `simTime >= poppedAt + PING.bobMs`, settle: kill both tweens, hide the ping, show the dot. While settled, move the dot only when the anchor moved.
    - `hide()`: kill tweens, hide both, `state = 'off'`.
    - `get height()`: the shown image's display height (for stacking), 0 when off.
  - [x] 3.3 The settle is timed on **game time** (`simTime`), not with a Phaser timer or `delayedCall`. A ping that pops just before the pause menu opens is still bobbing after Resume. Tweens are visual only; nothing here touches `GameState`.
  - [x] 3.4 Named constants, marked `[ASSUMPTION, tune in the browser]`: `PING = { bobMs: 3_000, bobPx: 3, bobPeriodMs: 400, popMs: 150 }`. Comment: the pop and bob are juice, which Story 5.7's reduced motion may turn off (appear at once, no bob). The ping and the dot themselves are information and must never be turned off.
- [x] **Task 4: Sheep pings (AC: 1–4, 7)** in `src/view/field/SheepSprite.ts`
  - [x] 4.1 Own an `AlertPing`, created in the constructor next to the hearts and marker.
  - [x] 4.2 In `sync`, after the infection change, derive the entries from `pub` only:
    - `starving = pub.hunger === 'starving'`; `infected = pub.infected`.
    - Track `pingStarving` and `pingInfected` (what the ping last saw).
    - Pop when either flag **turns on** (false → true): `ping.pop(simTime)`.
    - Hide when both are off.
    - A fresh sprite starts with both tracked flags false, so a sheep that is already threatened on its first sync pops (AC 3).
  - [x] 4.3 Place it every frame while shown, at the top of the overlay stack:
    - Over the head when nothing else is shown.
    - Above the infection marker (`overlayLift`).
    - Above the ready or pinned heart when one shows (its display height + `READY_GAP_PX`).

    Add a private `stackTopY(y)` helper next to `heartY`/`headY`, so the hearts, the marker and the ping share one stacking rule. Include the marker's and pin's bob amplitudes, as `overlayLift` does, so nothing overlaps at the top of a bob.
  - [x] 4.4 `reset()`: `ping.hide()` and clear both tracked flags. A recycled sprite must never come back pinged. (2.5's rule: `reset()` undoes everything.)
  - [x] 4.5 Never read any field beyond `PublicSheep` (AC 7). There is no special case for any kind of sheep.
- [x] **Task 5: Carcass pings (AC: 1–4)** in `src/view/field/CarcassSprite.ts`
  - [x] 5.1 Own an `AlertPing`. In the `fresh` branch of `sync` (a new binding, which includes a carcass present on load), call `ping.pop(simTime)` and place it above the carcass's resting spot: `c.y - displayHeight / 2 - gap`. `sync` must then take `(c, alpha, simTime)`; `EntityLayer` already passes all three.
  - [x] 5.2 Every later `sync` calls `ping.place(...)` so the bob and the settle advance. The carcass never moves, so the anchor is constant. Use the resting y, not the flop's tweened y, so the ping does not bounce with the flop.
  - [x] 5.3 `reset()`/`playExit()` hide the ping. A cleared or eaten carcass leaves through the layer sweep and takes its ping with it.
- [x] **Task 6: Threat summary widget (AC: 5, 6)**, new `src/view/hud/ThreatSummary.ts`, plus a hover widget
  - [x] 6.1 New `src/view/widgets/HoverZone.ts`: a non-clickable tooltip source. It is a `Zone` with `setInteractive()` and **no** hand cursor. It tracks:
    - `hovered` and `hoverSince` (real ms, -1 when none), set on `GAMEOBJECT_POINTER_OVER`/`OUT`;
    - `GAME_OUT` (removed on SHUTDOWN, as `Button` does);
    - `tooltip` / `setTooltip(text)`;
    - `x`, `y`, `width`, `height` (the box the tooltip anchors to);
    - `clearHover()`.

    Model it on `Button`'s hover code (`onOver`/`onOut`/`clearHover`/`hoverSince`). Do not copy press, squash or enable logic.
  - [x] 6.2 Extract a `TooltipSource` interface (`hoverSince`, `tooltip`, `x`, `y`, `width`, `height`, `isHovered`, `clearHover()`), implemented by both `Button` and `HoverZone`. Put it in `widgets/Tooltip.ts` or a tiny `widgets/tooltipSource.ts`. `HudScene.tooltipButtons` becomes `tooltipSources: readonly TooltipSource[]`, and `updateTooltip` works unchanged over it.
  - [x] 6.3 `ThreatSummary(scene, x, y)` builds three pairs, each made of:
    - an `Image` icon from the `ui` atlas (`FRAME.iconStarving`, `iconInfected`, `iconCarcass`), shown at 2×;
    - a count `Text` in `TYPOGRAPHY.numeric` (via `textStyle(..., 'bark')`), origin (1, 0.5), right edge at the end of a fixed-width box (`COUNT_BOX_W` ≈ 36 px, enough for "100" at 22 px; browser-check);
    - a `HoverZone` over icon + count, at least `LAYOUT.hitMin` (40 px) tall (UX-DR90).

    Pair order: Starving, Infected, Carcasses. The icon-to-count gap is `SPACING[1]`, and pairs sit `SPACING[2]` apart (mockups/hud.html `.threat` uses 10 and 4 px; use the nearest tokens).
  - [x] 6.4 `set(threats: ThreatCounts)` does work only on a change, per pair:
    - `setText(String(n))`.
    - `setColor(COLORS[n === 0 ? spec.zeroTextColor : spec.textColor])`.
    - `zone.setTooltip(STRINGS.threatTooltip.<kind>(n))`.

    Cache the shown numbers; never `setText` every frame (project rule). Icons are not dimmed: the spec dims the count only.
  - [x] 6.5 `get sources(): readonly TooltipSource[]` (built once in the constructor) for HudScene's tooltip list.
- [x] **Task 7: Bottom bar and HudScene (AC: 5, 6)**
  - [x] 7.1 `src/view/hud/BottomBar.ts`: add `readonly threats: ThreatSummary`, vertically centred in the bar. Place it right of the space the mockup's order reserves for later widgets: Medicine slot (4.5), money counter (3.2) and flock counter (3.3).
    - `THREAT_X ≈ 860` [ASSUMPTION; mockups/hud.html order: Breed · Medicine · sep · money · flock · sep · **threat** · spacer · boost timer · Shop].
    - Keep its right edge at or left of about x 1 080, so the boost timer (2.8) and the Shop toggle (3.2) fit at the right end.
    - Name the constants. Record the measured x range in the Dev Agent Record.
    - Update the class comment (2.6 adds the threat summary).
  - [x] 7.2 `src/view/scenes/HudScene.ts`:
    - `refresh` calls `this.bar.threats.set(v.threats)` after `selectHudView`.
    - Add the summary's sources to the tooltip list after the buttons.
    - `clearHover()` on modal open covers them, through the shared list.
    - `pointerOverControl` must be true over a threat zone too. It gates GameScene's sheep hover, so make it check every source's `isHovered`.
    - `hoveredButton` stays buttons-only: GameScene uses it to restore the hand cursor after a breed-mode change, and a zone has no hand.
  - [x] 7.3 `src/view/strings.ts`, under a `// Threat summary hover (UX-DR39, UX-DR96)` comment:
    - `threatTooltip: { starving: (n) => `${n} starving`, infected: (n) => `${n} infected`, carcasses: (n) => (n === 1 ? '1 carcass' : `${n} carcasses`) }`.
    - Freeze it like `STAGE`.
    - No "!" and no banned words ("carcass" is allowed, UX-DR97).
- [x] **Task 8: Art (AC: 1, 5)**. Placeholder pixel art in the DESIGN palette, made with a throwaway scratchpad encoder (the 2.1–2.5 pattern). Commit only the PNGs.
  - [x] 8.1 `assets/art/world/alert-ping.png`, 10 × 10, shown at 2× = 20 px (AC 1):
    - an `alert` (#E8503A) disc with a 1 px `bark` (#3A2A1F) ring (2 px on screen, UX-DR85);
    - a `wool` (#FBF4E4) "!" 1 px wide: a 4 px bar, a 1 px gap, a 1 px dot;
    - match `mockups/hud.html` `#g-ping`.
  - [x] 8.2 `assets/art/world/alert-dot.png`, about 5 × 5 (10 px on screen): an `alert` disc with a 1 px `bark` outline, no glyph. It must stay round, a ping's small sibling. Round "!" shapes are reserved for pings (UX-DR9), so the dot has no "!".
  - [x] 8.3 `assets/art/ui/icon-starving.png`, about 14 × 12 (28 × 24 on screen): the thin, drooping sheep silhouette of `#g-starving` with `alert` wool and `bark` legs/face.
  - [x] 8.4 `assets/art/ui/icon-infected.png`, about 11 × 11: three `infection` (#B4E03C) bubbles with a 1 px `bark` outline (as `#g-bubbles`; the field's `infection-marker` scaled up is fine).
  - [x] 8.5 `assets/art/ui/icon-carcass.png`, about 10 × 10: a `bark-soft` (#6B5444) rounded square with two `wool` X-eyes (as `#g-carcass`).
  - [x] 8.6 Run `npm run assets`. Both atlases change (`sheep-world` for the ping and dot, `ui` for the icons), and nothing else. Add `FRAME.alertPing`, `alertDot`, `iconStarving`, `iconInfected` and `iconCarcass` to `assetKeys.ts`, and extend the `assets/CREDITS.md` placeholder row and its file list.
- [x] **Task 9: Tests (AC: 5, 7, 8, 9)**. Vitest covers sim/save only, so the view parts are browser-checked (Task 10). Write each test to fail first; use `TUNING` values and literal seeds.
  - [x] 9.1 `tests/sim/selectors.test.ts`, `selectHudView` threats:
    - A new game is `{ starving: 0, infected: 0, carcasses: 0 }`.
    - Set one sheep's fullness to `TUNING.starvingBelow - 1` → `starving: 1`.
    - A sheep at **exactly** `starvingBelow` is not counted (it is Hungry, with the epsilon).
    - `infectSheep` on another → `infected: 1`.
    - A sheep both Starving and infected counts in both.
    - Pushing two carcasses (or using `killSheep`) → `carcasses: 2`.
    - The `out.threats` object is the same object across calls (filled in place), and its values update when the state changes.
  - [x] 9.2 **Agreement (AC 7):** on `busyGame()` and after a `runFor` of an unfed flock, `selectHudView(...).threats.starving`/`.infected` equal the counts of `hunger === 'starving'` / `infected` over `selectPublicSheep(state, [])`. This is the test that stops a future story from counting from hidden fields.
  - [x] 9.3 Purity: `selectHudView` leaves `structuredClone(state)` `toStrictEqual` and draws no rng.
  - [x] 9.4 Run `npm test`, `npm run typecheck` and `npm run lint` (baseline: 420 tests pass). No save test should change; if one does, the state shape changed by mistake (AC 8).
- [x] **Task 10: Browser check (AC: 1–7)**. Use a scratchpad Playwright probe (the 2.3–2.5 pattern), driving the DEV debug overlay through the DOM. Check:
  - [x] 10.1 **Starving:** `Starve one` → the sheep goes thin, a ping pops above its head, bobs about 3 s, then settles to a dot. The Starving count goes 0 → 1, from `disabled-ink` to `bark`. Feed it (F until a piece drops and it eats): the dot vanishes and the count drops.
  - [x] 10.2 **Carcass:** it starves → the sheep's ping goes, the carcass flops in with its own ping (not bouncing with the flop). Carcasses 0 → 1. Click the carcass: the ping and the count go.
  - [x] 10.3 **Infected:** `Infect one` → a ping pops above the bubble marker (stacked, no overlap at the top of either bob). Infected 0 → 1. A Starving sheep that eats a carcass: the Starving ping is replaced by a fresh pop (now infected), Starving −1, Infected +1, Carcasses −1. On its virus death the ping goes and the new carcass pings.
  - [x] 10.4 **Stacking:** in breed mode, an infected, ready, Starving adult shows, bottom to top, marker → heart → ping, with no overlap. Pinned A the same. A pregnancy heart over a pinged parent: note whether they overlap; if they do, lift the pregnancy heart by the ping too (as 2.5 did with `overlayLift`) and record it.
  - [x] 10.5 **Lamb and elder:** the ping sits at the right height over each (2.5's `LAMB_HEAD_INSET_PX`).
  - [x] 10.6 **Hover:** each pair shows its tooltip after about 300 ms ("2 starving", "1 infected", "1 carcass" / "3 carcasses"). There is no hand cursor, a click does nothing, and the sheep tooltip never shows through the bar. Under the pause menu nothing hovers. The sheep tooltip draws above nearby pings.
  - [x] 10.7 **Pause:** open the pause menu mid-bob, wait more than 3 s, then Resume. The ping is still bobbing (game-time settle), then settles.
  - [x] 10.8 **Pan:** right-drag the field. Pings and dots move with their sheep and carcasses, never lagging a frame.
  - [x] 10.9 **Reload → Continue:** threatened sheep and carcasses pop their pings on load, and the counts are right on the first frame.
  - [x] 10.10 **Recycling:** let pinged sheep die and new lambs or added sheep reuse the sprites. They come back clean, with no ping or dot.
  - [x] 10.11 **Layout:** at 960 × 540 the counts and icons are legible (text floor 13.5 px). Check that the summary's x range leaves room for the later widgets on both sides (Task 7.1).
  - [x] 10.12 No console errors or warnings beyond SwiftShader's GL notices.
  - [x] 10.13 **Performance** (project rule for rendering stories): DEV overlay at ×1 with about 100 sheep (`+10 sheep` ×10, `Feed all`), then let about 30 starve or use `Infect one` repeatedly. FPS should be in line with the 2.5 baseline (43–49 FPS in SwiftShader). `sync` and `set` must allocate nothing per frame.
- [x] **Task 11: Bookkeeping**
  - [x] 11.1 `deferred-work.md`, a new section for this story:
    - **Pings above the shop panel (Story 3.2):** UX-DR10/UX-DR63 keep pings above the open shop panel. Pings live in GameScene's world-overlay band (`FIELD_DEPTH.ping`), so a shop panel in `OverlayScene` or `HudScene` would cover them. 3.2 must either draw the shop panel in GameScene (screen-fixed, below `FIELD_DEPTH.overlay`), or move the world-overlay band into its own scene between the shop and the modals (Open Question 1).
    - **Reduced motion (Story 5.7):** the ping's pop and bob are juice; the ping and dot stay.
    - Any review deferrals.
  - [x] 11.2 Update the architecture only if Rylan asks.

### Review Findings

- [x] [Review][Decision] Threat counts are left-aligned, but AC 5 / UX-DR5 / Task 6.3 say right-aligned in fixed-width boxes — The dev changed it in the browser: right-aligned, a single digit sat nearer the next pair's icon than its own. Left-aligned in the 34 px box, the pairs still never move, but the digit's right edge shifts with width ("1" → "8"). Alternatives: keep left alignment and amend AC 5, or go back to right alignment with a wider pair gap (the bar's slot has 0 px of slack). — resolved (Rylan): keep left alignment; AC 5 amended.
- [x] [Review][Patch] The pregnancy heart can sit under a pinged parent's ping. The Dev Record's "sheep keep at least 24 px apart" is wrong: separation is soft, and even at 24 px the 18 px heart and the 20 px ping overlap. Lift the heart above the ping when a parent shows one [src/view/scenes/GameScene.ts:473]
- [x] [Review][Patch] A new carcass's ping pops at the resting anchor while the tipped carcass is still flopping down from 12 px higher, so they overlap for about 300 ms; pop when the flop lands [src/view/field/CarcassSprite.ts:50]
- [x] [Review][Patch] `SheepSprite.sync` computes `stackTopY` and calls `ping.place` every frame for every sheep, even with no ping; guard with `ping.shown`. Also, `AlertPing.height` is unused and returns the mid-pop scaled height; make it the full height so it can serve the pregnancy-heart lift [src/view/field/SheepSprite.ts:206]
- [x] [Review][Patch] The sheep tooltip depth comment was orphaned above `GameSceneData` when `TOOLTIP_DEPTH` was removed; move it to the tooltip's creation [src/view/scenes/GameScene.ts:87]
- [x] [Review][Patch] The threat test claims to cover "the hunger epsilon" but never probes it; add a fullness just inside `starvingBelow - FULLNESS_EPSILON` that must still count as Hungry [tests/sim/selectors.test.ts:170]
- [x] [Review][Defer] The carcass count overflows its 34 px box at 4 digits (1 000+ uncleared carcasses) [src/view/hud/ThreatSummary.ts:19] — deferred: unreachable in normal play (starving and infected are capped at 100 by capacity); revisit in the 3.6 pacing pass

## Dev Notes

### Current code to build on (read these first)

- **`src/sim/selectors.ts`:**
  - `hungerOf` (with `FULLNESS_EPSILON`), `PublicSheep.infected` (2.5), `selectCarcasses`.
  - `selectHudView` fills `out` in place and is called once per frame by HudScene.
  - `HudView` today: `farmProgress`, `farmPipsPerFood`, `breedingProgress`, `breedingPipsPerFood`, `breedBlock`.
- **`src/view/scenes/HudScene.ts`:**
  - `refresh` runs on `PRE_RENDER`, after GameScene's ticks, so values show on the frame of the change (do not move it to `update`; Phaser updates scenes in reverse order).
  - `tooltipButtons` + `updateTooltip` (one tooltip for all, `HOVER_DELAY_MS`, hidden under a modal), `wasModal` → `clearHover`.
  - `pointerOverControl` and `hoveredButton` (GameScene uses both).
  - Every listener is removed on SHUTDOWN.
- **`src/view/hud/BottomBar.ts`:** the layout constants (`BAR_TOP`, `FARM_Y`, `GROUP_GAP`, `BREED_X`/`BREED_W` = 472/104). New widgets go "to the right". The bar Panel spans the full width.
- **`src/view/hud/FarmProgress.ts`:** the pattern for a cached count `Text` (right-aligned in a fixed box, origin (1, 0.5), `textStyle(spec.valueTypography, 'bark')`, `setText` only on change) and for `ui` atlas images (`setFrame(frame, false, false)` keeps origin and size; atlas frames carry a 0.5 pivot).
- **`src/view/widgets/Button.ts`:** the hover code to model `HoverZone` on: zone + `GAMEOBJECT_POINTER_OVER/OUT`, `GAME_OUT` with SHUTDOWN removal, `hoverSinceMs`, `clearHover`. `setInteractive({ useHandCursor: true })` there; the threat zones use plain `setInteractive()`.
- **`src/view/field/SheepSprite.ts`:**
  - The overlay stack: `headY` (lamb inset), `overlayLift` (marker height + gap + bob), `heartY`.
  - `readyHeart`/`pinnedHeart`/`infectionMarker` are owned, pooled images.
  - `setInfected` and `stopInfection`; `reset()` undoes everything.
  - `sync(pub, alpha, simTime)` already receives `simTime`.
- **`src/view/field/CarcassSprite.ts`:** the `fresh` flop on bind (including on load); `sync(c)` ignores alpha/simTime today; `reset()`.
- **`src/view/field/PregnancyHeart.ts`:** imports `READY_DEPTH` (moves to `FIELD_DEPTH.overlay`).
- **`src/view/scenes/GameScene.ts`:** `TOOLTIP_DEPTH`, and the particle emitters at `TOOLTIP_DEPTH - 1`. `render()` syncs carcasses → pieces → sheep → pregnancies. `drawnPregnancies` lifts the heart by `overlayLift`.
- **`src/config/constants.ts`:** `COMPONENTS.threatSummary` (textColor `bark`, zeroTextColor `disabledInk`, icon colours, typography `numeric`) and `COMPONENTS.alertPing` (fill `alert`, outline `bark`, glyph `wool`, size 20) already exist; use them, do not re-declare them.
- **`src/debug/DebugOverlay.ts`:** `Starve one`, `Spawn carcass` and `Infect one` already produce every threat. The counts line already shows carcasses and infected. No new button is needed.

### What must be preserved

- **The sim is untouched** apart from the `selectHudView` addition: no new events, systems, state fields, rng draws or save changes (AC 8). Pings are **derived** from `PublicSheep` edges, not driven by `Infected`/`CarcassSpawned` events. Events would miss threats present on load and have no "Starving" event, and state derivation is the architecture's view rule. GameScene's `onSim` juice (dust, munch, poof) stays as is.
- **2.5 infection visuals:** tint, marker bob, wobble, `overlayLift` and the pregnancy-heart lift. Adding the ping must not move the marker or hearts.
- **2.3 breed mode:** markers, shake (it owns the angle; the ping is a separate image and is unaffected by the sheep's wobble or shake angle) and picking.
- **2.4 carcasses:** the flop, the dust and click-to-clear (`carcassAt` hit-tests the carcass sprite, not the ping; keep it so).
- **HUD:** Farm, Farm Breeding Food and Breed tooltips, Breed's reason tooltip, modal `clearHover`, and the F/G guards.
- **No allocation** in `sync`, `place`, `set`, `refresh` or `selectHudView`. No `setText` or `setColor` without a change.
- **Listener cleanup:** `HoverZone`'s `GAME_OUT` listener is removed on SHUTDOWN. Zone listeners die with the scene's display list.

### Architecture compliance

- **Locations:** ThreatSummary in `src/view/hud/` (architecture tree: "hud/ … ThreatSummary"); AlertPing in `src/view/field/`; HoverZone in `src/view/widgets/`; counts in `selectors.ts` (`hudView … threats`).
- **N2 secrecy:** the view consumes `PublicSheep` only. The ESLint restricted-property rule on `isAbomination` stays green. Do not add a `threatened` flag to `PublicSheep` that anything hidden could feed; derive it in the sprite from `hunger` and `infected`.
- **N3:** pings are pooled with their owning sprite (no `new`/`destroy` during play). `EntityLayer` is unchanged.
- **Colours** from `COLORS`/`COMPONENTS` (no hex in view code; art PNGs carry their own colours); **copy** from `STRINGS`.
- **No Phaser timers for game logic:** the settle is a view rule timed on `simTime`, and tweens are visual only.
- **Layers (UX-DR10):** world (depth = y) → world overlays (`FIELD_DEPTH` band) → HUD scene → Overlay scene. Pings above the shop panel is 3.2's (see Open Question 1).

### Library / framework notes (Phaser 4.2.1, installed; no new dependencies)

- `scene.add.zone(x, y, w, h).setOrigin(0, 0).setInteractive()` gives a hover area with the default cursor. `Button` already uses zones the same way, with `useHandCursor`.
- `Text#setColor(hex)` re-renders the text, so call it on a change only. `Image#setFrame(frame, false, false)` keeps origin and size.
- Tweens on plain objects and `killTweensOf` are already used in `SheepSprite`. `Back.easeOut` exists in Phaser 4's ease map. Check `node_modules/phaser/skills/` for anything not already used in this codebase. Do not write Phaser 3 APIs from memory (`setTintFill`, `preFX`, …).
- No web research was needed: this story adds no library, and every API it needs is already in use here.

### Testing standards

- Vitest covers `src/sim/` and `src/save/` only, in `tests/<same path as src>/`. Use `newGame(seed)`, `runFor`, `fillFlock` and `busyGame` (`tests/save/busy.ts`). Assert with `TUNING` values. No fake timers, no Phaser, no mocking.
- Use `structuredClone` + `toStrictEqual` for "nothing changed" cases.
- The view (pings, summary, hover, stacking) is browser-checked in Task 10.

### Previous story intelligence (2.5)

- The overlay stack lives in `SheepSprite`. Review found two 1 px overlaps at the top of a bob, so include every bob amplitude in the stacking offsets from the start.
- Overlays over a lamb sit on its drawn head via `LAMB_HEAD_INSET_PX`. Use `headY` and never `displayHeight / 2` alone.
- `reset()` must undo everything a sprite can show. 2.5's browser check verified recycled sprites come back clean; do the same for pings (Task 10.10).
- The infection wobble is always on (Rylan's decision). The ping is a separate image and never wobbles.
- **Browser probe:** `playwright-core` from `/home/rylanevans/nr-csp/frontend/node_modules` with `/usr/bin/google-chrome` (SwiftShader). Run the DEV server on its own port (5200 worked in 2.5; 5199 may be taken, so leave it alone). Stop it with `kill <vite node pid>`, never `pkill -f`. Plant saves via the debug Load save (clipboard) and read state with Dump state.
- Art: `npm run assets` packs deterministically (only touched atlases change). Record any deviation from the art brief (2.5's marker was first drawn too small and fixed in review).
- **Commit style:** `Implement story 2.6: Alert Pings and Threat Summary`.

### Git intelligence

- Recent commits: 2.3/2.4/2.5 implementation plus review fixes, and the adulthood retune (`elderFromMs` 420 s, `oldAgeMs` 540 s).
- The per-story pattern: sim rule plus tests, save, view sprite and juice, placeholder art plus atlas, a debug button and `deferred-work.md` notes. This story is mostly view: a selector, two field helpers, a HUD widget and art.

### Out of scope

- **3.2:** the shop panel, and keeping pings above it (deferred, Task 11.1). Money counter.
- **3.3:** flock counter. **3.6:** tuning the ping timings.
- **4.x:** the Abomination itself. Its secrecy is already guaranteed by AC 7; there is nothing to add for it here. Medicine (4.5): a cure clears `infected`, and the ping hides by the same rule (no code needed). Overcrowding (4.6) infections ping through `infected`.
- **5.6:** the `[frantic bleating]` caption and SFX on Starving entry. **5.7:** reduced motion for the pop and bob.
- Clicking a threat count (for example to jump to a sheep) is not in v1 (UX-DR39).
- A Hungry sheep gets no ping (only Starving).
- Food pieces, breeding pieces and pregnancies are never pinged.

### Open questions (defaults chosen; confirm or change)

1. **Where the world-overlay band lives (UX-DR10: "above the HUD panels").**
   - **Default:** in GameScene, as the top depth band (`FIELD_DEPTH`), below the sheep tooltip. Today the only HUD panel is the bottom bar, and the pen is pinned above it, so no ping can reach the bar. Story 3.2 then keeps the open shop below the pings by drawing the shop panel in GameScene (screen-fixed, under the band), or by moving the band into a scene of its own.
   - **Alternative now:** a new `FieldOverlayScene` launched between `HudScene` and `OverlayScene`, with its camera scroll mirrored from GameScene each frame. The sheep tooltip would then have to move there too, or pings would cover it. This is more plumbing for a panel that does not exist yet.
2. **Re-pop on a second threat.**
   - **Default:** yes. A Starving sheep that becomes infected (or the reverse) pops again, because each entry is news (EXPERIENCE: "pops once … when it enters Starving, becomes Infected").
   - **Alternative:** one pop per continuous threatened spell.
3. **Pings on load.**
   - **Default:** threatened sheep and carcasses pop on load, like the carcass flop and piece bounce.
   - **Alternative:** show them already settled as dots.
4. **Zero-count icons.**
   - **Default:** only the count dims to `disabled-ink` (the spec's words). The icon keeps its colour.
   - **Alternative:** dim the icon too (for example with alpha 0.5).
5. **The settled dot** [ASSUMPTION]: about 10 px, round, no glyph, at the same anchor as the ping. "Small static dot" has no size in the spec.

### Project Structure Notes

- New files:
  - `src/view/field/AlertPing.ts`, `src/view/field/depths.ts`
  - `src/view/hud/ThreatSummary.ts`
  - `src/view/widgets/HoverZone.ts`
  - `assets/art/world/{alert-ping,alert-dot}.png`, `assets/art/ui/{icon-starving,icon-infected,icon-carcass}.png`
- Modified:
  - `src/sim/selectors.ts`
  - `src/view/field/{SheepSprite,CarcassSprite,PregnancyHeart}.ts`
  - `src/view/hud/BottomBar.ts`
  - `src/view/scenes/{GameScene,HudScene}.ts`
  - `src/view/widgets/{Button,Tooltip}.ts` (the `TooltipSource` interface)
  - `src/view/{strings,assetKeys}.ts`
  - `assets/CREDITS.md`
  - `tests/sim/selectors.test.ts`
- Regenerated: `public/assets/atlases/{sheep-world,ui}.{png,json}`.
- There is no `src/view/hud/` file for counters yet. `ThreatSummary` is the first read-out widget, and 3.2/3.3 can follow its cached-Text pattern.

### Project Context Rules (from `_bmad-output/project-context.md`)

- **Phaser 4, not 3.** Verify any API not already used in the codebase.
- **The view never mutates `GameState`.** It reads selectors and dispatches commands. Game logic only in `src/sim/`. Tweens and timers never change state.
- **The Abomination is secret:** the view, HUD, tooltip and stats use `PublicSheep` only; it is never pinged or counted separately (UX-DR64).
- **No allocation in hot paths** (`update()`, `EntityLayer.sync`, sprite `sync`, selectors called per frame). Selectors are computed once per frame and passed down.
- **HUD numbers:** cached `Text` updated only on a value change, never re-`setText` every frame.
- **Pooling:** never `new`/`destroy()` sprites during play. A ping is pooled with its sprite.
- **Rendering:** sprites come from the two atlases (`sheep-world` for the field, `ui` for the HUD). No `Graphics` redrawn per frame.
- **Colours** from `COLORS` (DESIGN tokens), **copy** from `strings.ts`. No "!" in copy except "Last sheep!"; never "corpse", "blood" or "kill".
- **Infection is never colour-only;** pings and markers carry the 2 px `bark` outline (UX-DR85).
- **Listener cleanup** on SHUTDOWN; no double-subscribe after Restart.
- **Done:** `npm test`, `npm run typecheck` and `npm run lint` pass, and the visuals are verified in the browser. Run the 100-sheep performance spot check for rendering stories.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.6; UX-DR5, UX-DR9, UX-DR10, UX-DR39, UX-DR54, UX-DR63, UX-DR64, UX-DR85, UX-DR90, UX-DR96, UX-DR97; AR18]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-sheep-civilization-2026-10-05/DESIGN.md: components `threat-summary`, `alert-ping`; Colors (`alert`, `infection`, `bark-soft`, contrast note on pings); Layout (bottom bar order); Elevation & Depth (four layers); Shapes (ping glyph reserved); Do's and Don'ts]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-sheep-civilization-2026-10-05/EXPERIENCE.md: Component Patterns (Threat summary, Alert ping); State Patterns (Starving, Infected, Carcass, Shop open); HUD & Diegetic UI (three threat-surfacing layers; Abomination never surfaces)]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-sheep-civilization-2026-10-05/mockups/hud.html: `.threat`, `#g-ping`, `#g-bubbles`, `#g-starving`, `#g-carcass`]
- [Source: _bmad-output/game-architecture.md: Scene Structure (Hud: threat summary), Project Structure (`view/hud/ThreatSummary`), Data Patterns (`hudView … threats`), N2 (PublicSheep only), N3 (pooling)]
- [Source: _bmad-output/implementation-artifacts/2-5-carcass-eating-and-the-virus.md (overlay stack, review findings); deferred-work.md]
- [Source: _bmad-output/project-context.md]

## Dev Agent Record

### Agent Model Used

Claude Opus 5.5 (1M context), `claude-opus-5-5[1m]`

### Implementation Plan

- **Sim (selector only):** `HudView.threats: ThreatCounts`, filled in place by `selectHudView` in one allocation-free loop. It counts `hungerOf(fullness) === 'starving'` and `infectedAt !== undefined` (the same derivations as `PublicSheep`), plus `state.carcasses.length`.
- **Depths:** a new `view/field/depths.ts` with `FIELD_DEPTH` (overlay 9 997, particles 9 998, ping 9 999, tooltip 10 000). It replaces `READY_DEPTH`, GameScene's `TOOLTIP_DEPTH` and the `TOOLTIP_DEPTH - 1` particle depth.
- **Pings:** `view/field/AlertPing.ts` owns a ping image and a dot image, pooled with its sprite.
  - `pop(simTime)` scales the ping in and starts the bob.
  - `place(x, y, simTime)` runs every frame; it settles to the dot after `PING.bobMs` of game time.
  - `hide()` turns both off.
  - **SheepSprite** pops on a false → true edge of Starving or of infected, and hides when neither holds. It places the ping at a new `stackTopY` (above the marker, then the ready or pinned heart at the top of its pulse or bob). `setBreedMarker` re-places it at once, and `reset()` clears it.
  - **CarcassSprite** pops on bind (a new carcass, or one loaded with the game), anchored above the resting carcass, not the flop.
- **HUD:**
  - `widgets/tooltipSource.ts` (interface), implemented by `Button` and the new `widgets/HoverZone.ts` (hover and tooltip only; default cursor).
  - `hud/ThreatSummary.ts`: three icon + count pairs with cached text, colour and tooltip per pair.
  - `BottomBar` places it at x 858 (`THREAT_X`, asserted to end by 1 080).
  - `HudScene` feeds it from `selectHudView` and serves its zones through the shared tooltip list. `pointerOverControl` covers the zones; `hoveredButton` stays buttons-only.
  - `STRINGS.threatTooltip`.
- **Art:**
  - `world/alert-ping.png` (10×10) and `world/alert-dot.png` (5×5);
  - `ui/icon-starving.png` (14×12), `ui/icon-infected.png` (11×11) and `ui/icon-carcass.png` (10×10);
  - atlases rebuilt.

### Debug Log References

- **Red phase:** 5 new `selectHudView` threat tests failed first (no `threats`), then passed. The existing `HudView` literals in `selectors.test.ts` gained a `threats` field. No other test changed, and no save test was touched (AC 8: no state change).
- **Test spec adjusted:** the agreement test (9.2) runs the unfed flock for `starveMs / 2`, not "nearly `starveMs`". New sheep start at Fullness 60, so a longer run starves them all, and the test needs a living Starving flock.
- **Browser probe:**
  - **Setup:** scratchpad `playwright-core` (from nr-csp), system Chrome with SwiftShader, DEV server on port 5200. Saves were planted with debug Copy/Load save through the clipboard (granted permissions).
  - The first planted carcass lacked `createdAt` and validation rejected it (found with a throwaway vitest probe, since deleted).
- **Layout change found in the browser:**
  - With the count right-aligned in its box (Task 6.3), a single digit sat nearer the next pair's icon than its own, so "🦠 2" read as one pair.
  - Counts are now left-aligned against their icon inside the fixed box (the pairs never move as a count grows), and pairs are `SPACING[3]` apart.
  - The box is 34 px: "100" measured 33 px in the game font.
  - This is a deliberate deviation from Task 6.3's "origin (1, 0.5)".
- **Checks (Task 10), all passed, no console errors or warnings beyond SwiftShader's GL notices:**
  - **Pings:** they pop and bob, then settle to dots after about 3 s. The ping stacks above the bubbles and the ready heart, and above the heart in breed mode (candidate pulse and pinned) with no overlap. A carcass pings above its resting spot.
  - **Counts:** they are live. A starving lamb ate the carcass and the counts moved: Starving −1, Infected +1, Carcasses −1.
  - **Hover:** each pair shows "0 starving" / "3 infected" / "1 carcass" with the default cursor; a click does nothing; zero counts are grey.
  - **Pause:** mid-bob, with more than 3 s in the menu, the ping is still bobbing after Resume, then settles.
  - **Pan:** right-drag moves the pings with their sheep.
  - **Sheep tooltip:** it draws over nearby overlays.
  - **Reload → Continue:** the pings pop on load, and the counts are right on the first frame.
  - **Recycling:** after infected sheep died and 20 sheep were added, no healthy sheep shows a ping. The three carcasses show dots, and the counts read 0 · 0 · 3.
  - **960×540:** legible.
  - **Pregnancy heart:** over an infected, Starving parent pair it stays clear of their pings (it sits at the midpoint; sheep keep at least 24 px apart). No lift change was needed.
- **Performance** (Task 10.13): 103 sheep at ×1 with the overlay open (SwiftShader).
  - 40 FPS with no pings, then 37–38 FPS with 30 infected (pinged, bobbing) sheep, in the same run. That is about 5 %, from the extra bob tweens.
  - The machine read lower than 2.5's run (43–49), including its own no-ping baseline.
  - Nothing new allocates per frame: `place` and `set` only write on a change.

### Completion Notes List

- 2026-10-07: Story created. The context engine analysis is complete, and this file is the developer guide.
- Open questions are implemented at their defaults:
  - the world-overlay band lives in GameScene, and 3.2 owns "above the shop" (in `deferred-work.md`);
  - a second threat re-pops the ping;
  - threats pop on load;
  - only the count dims at zero;
  - the dot is about 10 px, round, with no glyph.
- AC 1–3: ping on a Starving/infected entry and on carcass spawn; it bobs for 3 s of game time, settles to a dot, re-pops on a second threat, hides when resolved and pops on load. Browser.
- AC 4: `FIELD_DEPTH` band; the ping sits at the top of the overlay stack and pans with the field; the sheep tooltip draws above it. Browser. The shop half is deferred to 3.2.
- AC 5–6: threat summary with live counts (selector unit tests), grey zero counts, hover tooltips, no click and no hand cursor. Browser.
- AC 7: view code reads `PublicSheep`, `selectCarcasses` and `selectHudView` only. The agreement test checks the counts against `selectPublicSheep`; lint is green.
- AC 8: no state, schema or validation change; save tests untouched.
- AC 9: `npm test` (425 passed, from 420), `npm run typecheck` and `npm run lint` are clean.
- **Art:** the ping's "!" is 2 art px wide (4 px on screen), not 1, so it sits centred in the 10 px disc. The mockup's 2 px glyph would need an odd-width disc.
- **Layout:** the summary is at x 858–1 080 (222 px). The left gap (588–846) for the Medicine slot, money and flock is tight at mockup sizes; noted in `deferred-work.md`.
- No architecture change.
- **Code review (2026-10-07):** 3 layers (Blind Hunter, Edge Case Hunter, Acceptance Auditor).
  - Totals: 1 decision, 5 patches applied, 1 deferred, 14 dismissed.
  - **Decision (Rylan):** the threat counts stay left-aligned against their icon; AC 5 is amended.
  - **Patches:**
    - the pregnancy heart lifts clear of a parent's ping (`SheepSprite.pregnancyLift`). This corrects the Dev Record's wrong claim that sheep keep 24 px apart;
    - a carcass's ping pops when its flop lands;
    - `SheepSprite` skips ping placement while there is no ping, and `AlertPing.height` returns the full, unscaled height;
    - the orphaned tooltip-depth comment moved to the tooltip's creation;
    - the epsilon case was added to the threat-count test.
  - **Deferred:** 4-digit counts overflow the box (3.6).
  - **Dismissed:**
    - `lastTick` units (it is ms, this frame's simTime);
    - `this.y` vs the interpolated y (the same value);
    - the real-time bob vs the game-time settle (by design, Task 3.3);
    - `tooltipButtons`/`hoveredButton` "orphaned" (GameScene uses `hoveredButton`);
    - sharing a helper for the count derivations (the same functions, and the agreement test guards it);
    - the `stackTopY` doc (`overlayLift` includes the marker bob);
    - re-binding re-pops (EntityLayer keeps a binding while the entity lives);
    - HoverZone visibility gating (the bar is never hidden);
    - the module-load invariant's slack;
    - a missing `out.threats` (typed);
    - the breed cursor over a count;
    - hover after a modal (as Button);
    - float popups' layer (out of scope).
  - **Verification:** tests (425), typecheck and lint are clean. Browser re-check: the pregnancy heart floats above two pinged parents standing 20 px apart; a spawned carcass pings after landing.

### File List

- `src/sim/selectors.ts` (modified)
- `src/view/field/AlertPing.ts`, `src/view/field/depths.ts` (new)
- `src/view/field/SheepSprite.ts`, `src/view/field/CarcassSprite.ts`, `src/view/field/PregnancyHeart.ts` (modified)
- `src/view/hud/ThreatSummary.ts` (new)
- `src/view/hud/BottomBar.ts` (modified)
- `src/view/widgets/HoverZone.ts`, `src/view/widgets/tooltipSource.ts` (new)
- `src/view/widgets/Button.ts` (modified)
- `src/view/scenes/GameScene.ts`, `src/view/scenes/HudScene.ts` (modified)
- `src/view/strings.ts`, `src/view/assetKeys.ts` (modified)
- `assets/art/world/alert-ping.png`, `assets/art/world/alert-dot.png` (new)
- `assets/art/ui/icon-starving.png`, `assets/art/ui/icon-infected.png`, `assets/art/ui/icon-carcass.png` (new)
- `assets/CREDITS.md` (modified)
- `public/assets/atlases/sheep-world.{png,json}`, `public/assets/atlases/ui.{png,json}` (regenerated)
- `tests/sim/selectors.test.ts` (modified)
- `_bmad-output/implementation-artifacts/2-6-alert-pings-and-threat-summary.md` (new)
- `_bmad-output/implementation-artifacts/sprint-status.yaml`, `_bmad-output/implementation-artifacts/deferred-work.md` (modified)

### Change Log

- 2026-10-07: Implemented alert pings and the threat summary:
  - `HudView.threats` counts;
  - the `FIELD_DEPTH` world-overlay band;
  - `AlertPing` on sheep (Starving/infected entries) and carcasses, settling to a dot after 3 s of game time;
  - the `ThreatSummary` HUD widget with hover tooltips (`HoverZone`, `TooltipSource`);
  - placeholder ping, dot and threat icons.

  Status → review.
- 2026-10-07: Code review: counts stay left-aligned (Rylan's decision, AC 5 amended); 5 patches applied; 1 item deferred to 3.6. Status → done.
