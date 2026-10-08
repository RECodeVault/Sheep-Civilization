---
baseline_commit: 8cf1e6a
---

# Story 3.5: Eras and Their Transitions

Status: done

<!-- Created 2026-10-07 by create-story. Builds on 1.2 (`step` system order, `GameState.lastEra` and the `Era` type, already saved and validated), 1.10 (OverlayScene modals and scrim, the deferred "era badge above the modals" note), 2.4–2.8 (the sim → bus → view event pattern), 3.3 (the land table, PenCamera limits, DEV layout invariants, `growLand`'s once-per-frame flag) and 3.4 (decoration spots that must stay readable in every era). No save schema bump: `lastEra` has existed since 1.2. -->

## Story

As a player,
I want the pasture to change through four eras as my flock grows, and fall back when it shrinks,
so that I can see my progress and feel the cost of losses.

## Acceptance Criteria

1. **The era is derived (FR27, AR20, pattern N4).** `currentEra(state)` returns Pasture (< 10 living sheep), Village (≥ 10), Town (≥ 25) or Wool Empire (≥ 50). It counts `state.sheep.length` only: living sheep, the Abomination included (FR30) when it exists, pending lambs not. The thresholds come from `TUNING`, never literals. The era is never stored. `state.lastEra` is only the change-detection cache, and nothing outside `updateEras` reads it.
2. **One event per change.** `updateEras` is the last system in `step`. On every tick where `currentEra(state) !== state.lastEra`, it emits exactly one `EraChanged { from, to }` and sets `lastEra = to`. A jump over more than one threshold in a single tick (for example, debug "+N sheep") emits one event, `pasture → town`, not two. A tick that loses the game emits no `EraChanged`, because `step` stops before `updateEras` once `lostAt` is set.
3. **Seeded test (epic AC).** In a seeded game, growing the flock to 10 and then dropping it to 9 fires exactly two `EraChanged` events: `{ from: 'pasture', to: 'village' }`, then `{ from: 'village', to: 'pasture' }`.
4. **Era up (FR28, UX-DR37, UX-DR50, UX-DR94).** When the era advances:
   - the field background crossfades over about 1 s to the new era's art;
   - a full-width `dusk` `era-banner` shows the era name ("Village" / "Town" / "Wool Empire") in `display` type and `halo` colour. It slides in, holds, then fades out;
   - the era fanfare plays. **Audio is deferred to Story 5.6**: there is no `AudioDirector` yet, and every earlier story deferred its sounds the same way. Record it in deferred-work.
5. **Era regress (FR28, UX-DR37).** When the flock drops below a threshold, the previous era's background returns with the same crossfade. The banner reads "Back to {era}." (for example "Back to Pasture.") in `wool-shade`. There is no fanfare; the soft descending note is also deferred to 5.6.
6. **Era badge (UX-DR36, UX-DR20).** An `era-badge` (a `dusk` pill with `wool` text in `label` type, 40 px tall) sits at the top-right of the field at the 16 px safe margin. It always shows the current era, and it stays visible above the scrim under the pause menu, its sub-panels, the start-over confirm and the lose screen. It is not interactive.
7. **Load and restart.** A continued, loaded or restarted game shows its current era's background and badge on its first frame, with no crossfade and no banner. If a save's `lastEra` is stale (a hand-edited or debug-loaded save), the first tick emits one `EraChanged`. Its banner plays, but the background is already right, so no visible jump happens.
8. **Readable in every era (GDD pillar 4, NFR10; 3.4 deferred note).** Every era's art leaves the play area readable: sheep, pieces, carcasses, the infection tint, the fence, the Better Place, the Market and both decorations. The background covers every world point the camera can show at every land tier, shop open or closed, so no bare canvas colour is ever visible. A DEV invariant checks the coverage.
9. **Done.** `npm test`, `npm run typecheck` and `npm run lint` pass. The browser checks in Task 7 are recorded with evidence, including an FPS spot check at 100 sheep during era changes.

## Tasks / Subtasks

- [x] **Task 1: Tuning, selectors and the eras system (AC 1, 2)**
  - [x] 1.1 `src/config/tuning.ts`: add `eraThresholds: Object.freeze([10, 25, 50] as const)`, the living-sheep counts for Village, Town and Wool Empire. Comment it with FR27 and the GDD Meta-Progression table, and note the GDD's deliberate link: each threshold equals a land capacity, so the player enters each era at full capacity (GDD Level Progression note; decision log "Overcrowding at era thresholds"). Mark it as a 3.6 tuning candidate.
  - [x] 1.2 `src/sim/selectors.ts`:
    - `export const ERAS: readonly Era[] = Object.freeze(['pasture', 'village', 'town', 'wool-empire'])`, in era order. Index `i ≥ 1` needs `TUNING.eraThresholds[i − 1]` living sheep.
    - `export function currentEra(state: GameState): Era`, a plain descending comparison of `state.sheep.length` against `TUNING.eraThresholds`. It must not allocate: it runs every tick and every frame.
    - `export function eraIndex(era: Era): number`, so the view can tell up from down (`eraIndex(to) > eraIndex(from)`). A small switch or an `ERAS.indexOf` is fine, because it is only called on a change.
    - Update the `HudView` doc comment ("A later story adds the era (3.5)"). Do **not** add `era` to `HudView`: the badge lives in OverlayScene (AC 6) and reads `currentEra` itself. Change the comment to say so.
  - [x] 1.3 `src/save/validate.ts`: replace its private `ERAS` copy with the one from `selectors.ts` (it already imports `SHOP_ITEMS` from there), so there is one list.
  - [x] 1.4 New `src/sim/systems/eras.ts`: `export function updateEras(state: GameState): void`, exactly as in architecture N4. The header comment should say: the era is derived (FR27); `lastEra` is the change-detection cache only (AR20); eras regress (FR28); it draws no rng and takes no id.
  - [x] 1.5 `src/sim/events.ts`: add `| { type: 'EraChanged'; from: Era; to: Era }` with a comment (`updateEras`, once per change, never on the losing tick), and add `EraChanged` to the header's variant list. Today no `switch` over `SimEvent['type']` ends in `assertNever` (the listeners use `if` chains that ignore unknown types; the existing `assertNever` calls cover `Command`, `ShopItemId`, activities and input modes). So there is nothing to update, but re-check with `grep -rn "assertNever" src` in case that changed.
  - [x] 1.6 `src/sim/step.ts`: append `updateEras` to `SYSTEMS` and import it. The intended-order comment already ends in `→ eras`; keep eras last, after the systems Epic 4 will add.
- [x] **Task 2: Sim tests (AC 1, 2, 3)**
  - [x] 2.1 New `tests/sim/systems/eras.test.ts`:
    - `currentEra` at each boundary, derived from `TUNING.eraThresholds` (`t − 1` and `t` for each threshold): 0–9 is pasture, then village, town and wool-empire, and 100 is still wool-empire.
    - Pending pregnancies do not count: push a pregnancy at `t − 1` living sheep and the era stays put.
    - `updateEras` emits nothing while the era is unchanged.
    - It emits one event and updates `lastEra` on a change.
    - A two-threshold jump (`fillFlock` to `eraThresholds[1]` from pasture) emits a single `{ from: 'pasture', to: 'town' }`.
    - It draws no rng (`state.rng` is unchanged).
  - [x] 2.2 New `tests/sim/scenarios/eras.test.ts`:
    - (a) **Epic AC.** `newGame(<literal seed>)`, `fillFlock(state, TUNING.eraThresholds[0])`, run one tick, then remove one sheep through a real path and run one tick. Exactly two `EraChanged` events: pasture → village, then village → pasture. Use `Sell` through `applyCommand` on an adult (fillFlock adds adults), or `killSheep(state, id, 'starved')`. Use a real path, not a splice.
    - (b) **Regress through deaths.** A Village flock (10) with no food dropped. As sheep starve below 10, exactly one `village → pasture` event fires, on the tick the count first drops below the threshold. Keep it short: set every sheep's `fullness` low, the way the starvation tests do, rather than running 120 s.
    - (c) **Up through births.** A breeding path that takes the flock from 9 to 10 emits `pasture → village` on the `LambBorn` tick (after `LambBorn` in the event list). Reuse the setup of `tests/sim/scenarios/breeding.test.ts`.
    - (d) **Loss.** Kill a Village flock in one tick (the `step.test.ts` "lose mid-tick" pattern, or every sheep starving on one tick). The events hold `Lost` and no `EraChanged`, and `lastEra` keeps its old value.
    - (e) **Determinism.** Two runs from the same seed that cross a threshold are `toStrictEqual`.
  - [x] 2.3 `tests/sim/step.test.ts`: if it pins the system list or order, add eras last. `tests/config/tuning.test.ts`: `eraThresholds` is strictly ascending, positive and integer. `tests/sim/selectors.test.ts`: `ERAS` has 4 entries in order, and `eraIndex` is increasing.
  - [x] 2.4 **Regression sweep.** Any existing test that grows a flock to 10 or more and asserts an exact event list (`toEqual([...])` / `toStrictEqual`) will now see `EraChanged`. Run `npm test` right after Task 1 and fix each failure deliberately: add the event to the expected list, or filter by type where the test is about something else. Known candidates are `land.test.ts:57` (`fillFlock(state, 10)`), `selectors.test.ts:298` and `breeding.test.ts:115` (fill to `landCapacities[0]`), `movement.test.ts` (30 and 300) and the 100-sheep scenarios. Never loosen an assertion that is about events.
  - [x] 2.5 **Save (AC 7).** No schema change: `lastEra` is already saved and validated (`validate.test.ts` rejects an unknown era). `tests/save/busy.ts` fills 12 sheep and then runs `runFor(state, 1_000)`, so once `updateEras` is in `step`, its `lastEra` becomes `'village'` by itself: a consistent snapshot, as a real save always is. No edit is needed. Check that the busy round-trip still passes and that `lastEra === currentEra(busyGame())`. Add one save test: a round-tripped state with a **stale** `lastEra` loads, and its first `step` emits exactly one `EraChanged` to `currentEra`.
- [x] **Task 3: Placeholder era backgrounds and the asset pipeline (AC 4, 5, 8)**
  - [x] 3.1 Coverage numbers (world px; see "Background coverage" in Dev Notes). The camera can show world x 12–1706 and y −12–664 across all tiers. Make each background **864 × 344 px drawn, shown at 2× (1728 × 688)**, placed with its top-left at world (0, −16), so it covers x 0–1728 and y −16–672.
  - [x] 3.2 Draw four PNGs in `assets/art/backgrounds/`: `pasture.png`, `village.png`, `town.png`, `wool-empire.png`. The file names are the `Era` ids, which double as texture keys (state.ts comment). Use a throwaway scratchpad encoder, as in 2.x–3.4, and commit only the PNGs. Follow the art rules in "Era art brief" in Dev Notes: the pen region is plain grass in every era, features go only in the keep-out-free margins, and use DESIGN.md colours.
  - [x] 3.3 `scripts/build-assets.ts`: add `syncBackgrounds()`, modelled on `syncCursors()`. It copies `assets/art/backgrounds/*.png` to `public/assets/backgrounds/` and prunes stale files. It throws an `AssetError` unless exactly the four era files are present (a missing or misnamed era fails the build, not the game). Log `[assets] backgrounds: 4 copied`. Update the header comment. Run `npm run assets` and commit `public/assets/backgrounds/*.png` (the atlases should come out unchanged).
  - [x] 3.4 `src/view/assetKeys.ts`: `export function backgroundUrl(era: Era): string` returns `assets/backgrounds/${era}.png` (a relative URL, like `atlasUrls`). `src/view/scenes/PreloadScene.ts`: `this.load.image(era, backgroundUrl(era))` for each of `ERAS`, and add the four keys to the "missing after load" check, using the same toast as a missing atlas.
  - [x] 3.5 `assets/CREDITS.md`: add the four backgrounds to the placeholder row (`art/backgrounds/{…}`).
- [x] **Task 4: The field background and its crossfade (AC 4, 5, 7, 8)**
  - [x] 4.1 New `src/view/field/EraBackground.ts` (the name is from the architecture tree). Its constructor builds **two** `Image`s at the background's world spot, origin (0, 0), scale 2, at a new `FIELD_DEPTH.background` (below `ground`, e.g. `-100`; the incoming image is `background + 1`). It also needs:
    - `show(era)`: no fade. The base image takes `era`'s texture at alpha 1, and the top image is hidden. Used in `create`.
    - `fadeTo(era)`: the top image takes `era`'s texture at alpha 0 and tweens to 1 over `ERA_FADE_MS` (about 1 000 ms, [ASSUMPTION, tune in the browser]), `Linear` or `Sine.easeInOut`. On complete, the base takes `era`'s texture and the top is hidden. If a fade is already running, first `killTweensOf(top)` and snap the base to the running fade's target, then start the new one. Two quick changes never leave a half-faded or wrong era. A `fadeTo` for the era already shown does nothing.
    - Visual only: tweens change no `GameState`. Never create or destroy images after the constructor.
    - If a texture is missing (failed load, AC of 1.4), `show`/`fadeTo` do nothing and the camera's `pasture` background colour shows through.
  - [x] 4.2 `src/view/field/depths.ts`: add `background` (and say the incoming crossfade image uses `background + 1`) under `ground`, and update the header comment. The decorations (depth = foot y ≈ 176), the fence back rails (depth 0) and the Better Place parts (−10) all stay above it.
  - [x] 4.3 `GameScene`:
    - In `create`, before the fence: `this.eraBackground = new EraBackground(this)` and `this.eraBackground.show(currentEra(this.state))`. Keep `setBackgroundColor(COLORS.pasture)` as the fallback, and replace the "Placeholder ground until the era backgrounds arrive in Epic 3" comment with what is true now.
    - In `onSim`, `EraChanged` sets `this.eraChanged = true` and does nothing else. In `update`, inside its own `ui` try/catch next to the `landBought` block: if the flag is set, clear it and call `this.eraBackground.fadeTo(currentEra(this.state))`. This handles once per frame, like `growLand`, so at ×16 speed several changes in one frame fade once, straight to the era the state is in now.
    - Reset the flag in `create`. No new `bus.on`, since this rides the existing `sim` handler.
  - [x] 4.4 DEV invariant (AC 8), in the existing `if (import.meta.env.DEV)` block. For each `TUNING.landFences` tier, and for the shop both closed (`LAYOUT.safeMargin`) and open (`SHOP_PANEL_RIGHT + LAYOUT.safeMargin`), the world rect the camera can show must lie inside `ERA_BACKGROUND_BOUNDS` (exported from `EraBackground.ts`). That rect is the scroll range for the tier's play area plus `VIEW_W × VIEW_H`. Export a small pure helper from `PenCamera.ts` (for example `viewExtent(area, protect, leftInset): Rect`) built from its private `minX`/`maxX`/`minY`/`maxY`, so the limits are not re-derived. The message reads "GameScene: an era background does not cover a land tier's view". Also add a DEV frame-size check in `EraBackground` (each texture is 864 × 344, like `Decorations`' `FRAME_SIZE` check), so new art cannot shrink the coverage.
  - [x] 4.5 `TitleScene` (small, keeps the comments honest): replace its placeholder `setBackgroundColor` comment, and show the `pasture` background behind the title through `EraBackground.show('pasture')` (or a single image). The title camera does not pan, so check the opening framing looks right. If this fights the title layout, keep the colour and update the comment to say why.
- [x] **Task 5: The era banner (AC 4, 5)**
  - [x] 5.1 `src/view/strings.ts`: add `eraName: Readonly<Record<Era, string>>` ("Pasture", "Village", "Town", "Wool Empire") and `eraBack: (name: string) => \`Back to ${name}.\`` (UX-DR94; the full stop is in the Voice table; no "!"). Comment both with UX-DR94/UX-DR95.
  - [x] 5.2 New `src/view/hud/EraBanner.ts`. It is built once and hidden, and never creates objects after construction:
    - a full-width band across the canvas (`dusk`, `COMPONENTS.eraBanner.backgroundColor`), 88 px tall [ASSUMPTION] (`display` 56 × 1.1 ≈ 62 px of text plus `SPACING[3]` above and below), centred at canvas y ≈ 204 [ASSUMPTION, browser-check]. That is below the Pause button (y 16–56), the era badge (16–56) and a full 3-toast stack (about y 16–152 at 1280 × 720), and in the "upper field" (DESIGN Layout);
    - one `Text` in `display` type, using `textStyle(...)` from `widgets/box.ts` as the other widgets do;
    - `play(text, regress)`: kill running tweens, set the text and colour (`textColor` halo for up, `regressTextColor` woolShade for regress), slide the band in from the left over about 300 ms, hold about 2 000 ms, then fade out over about 400 ms and hide. [ASSUMPTION] timings; tune in the browser. A new `play` while one is showing restarts it cleanly with the new text;
    - not interactive (no `setInteractive`), so it never blocks a click, drag or drop under it;
    - built from a `boxTexture` like the other bars, or a plain rectangle texture made once. No `Graphics` redrawn per frame.
  - [x] 5.3 `HudScene`:
    - Build the banner at a depth below `POPUP_DEPTH` and `TOOLTIP_DEPTH` (for example 50), so it is above the bar but under popups and tooltips.
    - In `onSim`, on `EraChanged`, record it for this frame: keep the **first** `from` and the **last** `to` since the last refresh (two fields, no allocation).
    - In `refresh` (PRE_RENDER, after the ticks), if a change is pending and `from !== to`, call `banner.play(...)`: `eraIndex(to) > eraIndex(from)` → `STRINGS.eraName[to]`, else `STRINGS.eraBack(STRINGS.eraName[to])` with `regress = true`. Then clear the pending pair. A flip there and back within one frame shows nothing; a jump over several eras shows only the last era's name.
    - Reset the pending fields in `create`.
  - [x] 5.4 **Reduced motion (5.7):** the slide-in becomes a fade when reduced motion exists. There is no setting yet; note it in deferred-work.
- [x] **Task 6: The era badge (AC 6, 7)**
  - [x] 6.1 New `src/view/overlay/EraBadge.ts`, modelled on `hud/BoostTimer.ts`:
    - a `dusk` pill (`boxTexture` with `radius: H / 2`, `drop: false`), `ERA_BADGE_H = 40` (mockup `.era-badge` height: 40 px, padding 0 16 px, label type), and a **fixed** width sized for the widest name ("Wool Empire") plus `SPACING[4]` each side, so the pill never resizes. Add a DEV `invariant` that every `STRINGS.eraName` fits, as BoostTimer does;
    - right edge at `CANVAS_WIDTH − LAYOUT.safeMargin`, top at `LAYOUT.safeMargin`;
    - `wool` text in `label` type, centred;
    - `set(era)` changes the text only when the era changes;
    - not interactive.
  - [x] 6.2 `OverlayScene`:
    - Build the badge in `create` at a depth **above `SCRIM_DEPTH` and below `PANEL_DEPTH`** (for example 5), so the 72 % scrim never covers it (the 1.10 deferred note) and no panel hides it either. Panels are centred, so they never meet the top-right corner.
    - Set it from `currentEra(this.gameScene.simState)` in `create`, inside the existing guarded block.
    - In `onSim`, add an `EraChanged` branch that calls `badge.set(e.to)`. The handler today returns early unless the event is `Lost`, so restructure it: keep the `Lost` path as it is, and keep the `ui` try/catch.
    - The badge shows during play as well as under modals. OverlayScene is drawn in every game state, and its scrim and panels are hidden when no modal is up, so the badge needs no other scene.
  - [x] 6.3 Check that the badge does not block input: it is not interactive, and the Overlay scene's input sees only scrim and panel hits. A click on the field under the badge's corner must still reach GameScene, and a sheep under it must still be draggable. Test this in 7.4.
- [x] **Task 7: Verify in the browser (AC 4–9).** Use the DEV server and a scratchpad Playwright probe, as in 3.1–3.4 (see Previous story intelligence). Record evidence for every item.
  - [x] 7.1 New game: the Pasture background and the "Pasture" badge on the first frame, with no banner. Screenshot.
  - [x] 7.2 Up: use DEV "+N sheep" (and "Feed all" to keep them alive) to cross 10 → 25 → 50 one at a time. Each step shows the about-1 s crossfade (capture a mid-fade frame at about 500 ms), the halo banner "Village" / "Town" / "Wool Empire", and the badge update. Screenshot each.
  - [x] 7.3 Down: sell or starve the flock back below 50 → 25 → 10. Each step shows the reverse crossfade, the `wool-shade` banner "Back to Town." / "Back to Village." / "Back to Pasture.", and the badge update. Also check a regress caused by deaths, where the death toasts and the banner show together: toasts are top-centre above the band, and both are readable.
  - [x] 7.4 Badge under modals: open Pause, a sub-panel and the start-over confirm, and lose the game. The badge stays visible top-right above the scrim every time. Check that clicking the field and dragging a sheep near the badge corner still work.
  - [x] 7.5 Coverage: at tiers 0, I, II and III, with the shop open and closed, pan with right-drag to every limit. No bare canvas colour shows in any era (load planted saves per era/tier, or buy land then add sheep). The decorations, the Better Place, the Market and the fence stay readable in all four eras. Use a contact sheet for this.
  - [x] 7.6 Readability: in each era, a Starving sheep, an infected sheep (green tint), a carcass, a food piece and a breeding piece are easy to tell apart against the ground.
  - [x] 7.7 Load/restart: Pause → Main Menu → reload → Continue in Town shows the Town background and badge at once, with no fade and no banner. Restart from Town starts a new Pasture game. Debug Load of a save with a stale `lastEra` plays one banner with no background jump.
  - [x] 7.8 Rapid changes: at ×16 with the flock oscillating around 10 (births and deaths), there are no stuck half-faded backgrounds or overlapping banners, and the background always matches the badge when the fade settles.
  - [x] 7.9 Window at 960 × 540: the badge and banner text are legible, and the banner band spans the canvas width.
  - [x] 7.10 FPS: 100 sheep at Land III (Wool Empire), ×1, overlay open, sampled every 5 s for at least 150 s, with at least one crossfade in the window (drop to 49 and back). Compare against 3.4's median of 33 (load average noted). Two full-screen images and a fade should cost little; if the median drops by more than about 3, investigate (texture size, depth sorting).
  - [x] 7.11 No console errors throughout.
- [x] **Task 8: Wrap-up**
  - [x] 8.1 `deferred-work.md`:
    - Mark resolved: "Era badge above the modals (Story 3.5)" (1.10 section), "Era badge vs the Scarecrow (Story 3.5)" and "Era backgrounds (Story 3.5)" (3.4 section), each with one line of evidence.
    - Add a 3.5 section:
      - **5.6**: the era fanfare on up, the soft descending note on regress, and the `[fanfare]` / `[descending note]` captions (UX-DR83, UX-DR88);
      - **5.7**: reduced motion (the banner fades instead of sliding; decide whether the crossfade stays);
      - **3.6 / 5.x**: real free-pack era art replaces the placeholders, keeps 864 × 344 (or updates `ERA_BACKGROUND_BOUNDS`, where the DEV checks catch a mismatch), and keeps the pen region plain;
      - **3.6**: `TUNING.eraThresholds` is tuned with pacing; the era-equals-capacity link is a GDD decision, so change both or log why;
      - the background coverage invariant is DEV-only (the same pattern as the 3.3/3.4 notes).
  - [x] 8.2 Fill in the Dev Agent Record (plan, debug log with browser evidence and FPS, completion notes, file list, change log), as in 3.4.


### Review Findings

- [x] [Review][Patch] Stale `lastEra` plays a fake era banner on Continue/Load (decision, Rylan 2026-10-08: fix it at load — `syncEra(state)` in `systems/eras.ts` called from `GameScene.create` sets `lastEra = currentEra` with no event; AC 7's "one banner on a stale save" becomes "no banner") [src/sim/systems/eras.ts, src/view/scenes/GameScene.ts:create]
- [x] [Review][Patch] Lose screen shows the pre-loss era (AC 6 "always the current era") [src/view/scenes/OverlayScene.ts:onSim, src/view/scenes/GameScene.ts:onSim]
- [x] [Review][Patch] `syncBackgrounds` validates after atlases/fonts/cursors are written; OS junk files fail the build; directories and wrong image sizes are not caught [scripts/build-assets.ts:syncBackgrounds/main]
- [x] [Review][Patch] `era-far` overlaps `era-left`/`era-mid` by 4 texels, double-blending a band during the crossfade [src/view/field/EraBackground.ts:STRIPS]
- [x] [Review][Patch] Nothing committed checks the art outside `STRIPS` is flat `pasture`; the coverage invariant checks the undrawn full rect; deferred-work and the Debug Log overclaim what the DEV checks catch [src/view/field/EraBackground.ts, deferred-work.md]
- [x] [Review][Patch] `flushEraBanner` shares `refresh`'s try: a banner throw skips the frame's HUD refresh [src/view/scenes/HudScene.ts:refresh]
- [x] [Review][Patch] Test: the birth scenario's `while (pregnancies)` loop has no tick cap [tests/sim/scenarios/eras.test.ts]
- [x] [Review][Patch] Test: "currentEra counts living sheep only" never adds a carcass [tests/sim/selectors.test.ts]
- [x] [Review][Defer] Reversing an era mid-crossfade snaps to the full previous era (as Task 4.1 specifies), which at ×16 with a full flock at a threshold can flicker hard between eras [src/view/field/EraBackground.ts:fadeTo] — deferred, spec-mandated behaviour; revisit with the banner-flicker note after playtests
- [x] [Review][Defer] The badge fit invariant can measure the fallback font after a font-load timeout and throw in DEV (same pattern as BoostTimer) [src/view/overlay/EraBadge.ts] — deferred, pre-existing pattern

## Dev Notes

### Current code to build on (read these first)

- **`src/sim/state.ts:89–90`**: `export type Era = 'pasture' | 'village' | 'town' | 'wool-empire'` ("Era ids double as background texture keys"). **`state.ts:131–132`**: `lastEra: Era` ("Change-detection cache for EraChanged only; display reads currentEra(state)"). `createNewGame` sets `lastEra: 'pasture'`. Do not add another field.
- **`src/save/validate.ts:18, 99`**: a private `ERAS` list and the "state.lastEra is not a known era" rule. Save schema is **8**; nothing about eras needs a bump.
- **`src/sim/step.ts`**: `SYSTEMS = [movement, feeding, carcassEating, hunger, lifecycle, virus]`. `stepWith` returns as soon as `lostAt` is set, so a system after the losing one never runs. That is what makes AC 2's "no EraChanged on the losing tick" true for free. The comment already plans `… → autoFeeder → eras`.
- **`src/sim/events.ts`**: the `SimEvent` union and its header list. Events are drained per tick by GameScene onto `bus` (`'sim'`). There is no `EraChanged` variant yet.
- **`src/sim/selectors.ts`**:
  - `capacity`/`landTier` show the TUNING-table style;
  - `selectHudView` (line ~420) and its comment "A later story adds the era (3.5)";
  - `ERAS` does not exist yet.
- **`src/config/tuning.ts`**: there is no era value yet. `landCapacities: [10, 25, 50, 100]`, and the first three equal the era thresholds by design (GDD).
- **`src/view/scenes/GameScene.ts`**:
  - `create` sets `this.cameras.main.setBackgroundColor(COLORS.pasture)` with a "Placeholder ground until the era backgrounds arrive in Epic 3" comment (line ~255), then builds Fence → BetterPlace → Market → Decorations;
  - `onSim` (line ~206) is the `ui`-guarded juice switch;
  - `update` handles `landBought` once per frame in its own `ui` try/catch (line ~600). Copy that shape for `eraChanged`;
  - the DEV invariant block at the bottom has `union`/`intersects`/`contains`.
- **`src/view/scenes/HudScene.ts`**: `refresh` runs on PRE_RENDER (after GameScene's ticks; see the comment on Phaser's reverse update order). `onSim` is `ui`-guarded, and death toasts are batched per frame (`deaths` + `flushDeathToasts`). The banner's per-frame coalescing follows the same idea. Depths: `POPUP_DEPTH 100`, `TOOLTIP_DEPTH 200`. The Pause button is at (16, 16), 96 × 40.
- **`src/view/scenes/OverlayScene.ts`**: `SCRIM_DEPTH 0`, `PANEL_DEPTH 10`, and `ModalController` owns the scrim. `onSim` only handles `Lost` today. `create` already has a guarded block reading `gameScene.simState`.
- **`src/view/hud/BoostTimer.ts`**: the pill pattern to copy for the badge (`boxTexture` + `textStyle`, a fixed width with a fit invariant, text set only on a change).
- **`src/view/field/PenCamera.ts`**: `VIEW_W = 1280`, `VIEW_H = 608`, `EDGE = 16`. The private `minX`/`maxX`/`minY`/`maxY` give the scroll limits, so export a helper for the coverage invariant (Task 4.4) rather than re-deriving them.
- **`src/view/field/depths.ts`**: `ground: -10` is the lowest band today.
- **`src/view/safetyNet.ts`**: toasts are DOM, fixed top-centre at the canvas top + 16 px, about 40 px each with an 8 px gap, up to 3. They are **not scaled** with the canvas. They draw over the canvas, so over the banner too if they overlap.
- **`scripts/build-assets.ts`**: `syncFonts`/`syncCursors` show the copy-and-prune pattern; `prune` is shared. Architecture expects `assets/art/backgrounds/` → `public/assets/backgrounds/{pasture,village,town,wool-empire}.png` (architecture source tree, lines ~410–416).
- **`src/view/scenes/PreloadScene.ts`**: loads the two atlases and checks `textures.exists` after load, with a toast on failure.
- **`src/debug/DebugOverlay.ts`**: "+N sheep" (`addSheep`), "Feed all" and "+$100" are enough to reach every era. Optionally add the era to the counts line (`sheep … · era village`), read through `currentEra`.

### Sim design notes

- **Derived, never stored.** The project-context lists "storing derived values (… era …)" as a common agent mistake. Only `lastEra` exists, and only `updateEras` reads it. View code calls `currentEra(state)` or uses the `to` of `EraChanged`.
- **What counts.** `state.sheep.length` is every living sheep. A sheep being dragged is still in `state.sheep`, so it counts. The Abomination counts (FR30, from 4.1). Pending lambs hold a capacity slot (AR21) but are **not** sheep alive, so they do not count. Carcasses do not count.
- **Order.** `updateEras` runs last, so it sees the tick's births (`lifecycle`), deaths (`hunger`, `lifecycle`, `virus`) and the commands applied before `step` (a `Sell` or `Sacrifice` from a drag). One tick's net change emits at most one event.
- **No hysteresis in the sim.** The epic AC requires exactly two events for 10 → 9 → (and back). Any anti-flicker belongs in the view, which coalesces per frame (Tasks 4.3 and 5.3). See Open Question 2.
- **Determinism.** `updateEras` draws no rng, so existing seeded runs stay identical. Only their event lists gain `EraChanged` (Task 2.4).
- **Pacing.** Capacity before land is 10, the same as Village's threshold, so a new game can reach Village without buying land. Town needs Land I (25), and Wool Empire needs Land II (50). That is the GDD's "enter each era at full capacity, while overcrowding rolls are active (Epic 4)".

### Background coverage (worked numbers; the DEV invariant is the source of truth)

These come from the PenCamera limits (`minX = area.right + 16 − 1280`, `maxX = area.x − leftInset` or the protected rule, `minY = area.bottom + 16 − 608`, `maxY = area.y − 16`), with play area = fence ∪ Better Place (442–598 × 72–186) ∪ Market (1080–1276 × 120–390):

| Tier | Play area (x, y) | Scroll x range | Scroll y range | World shown |
|---|---|---|---|---|
| 0 | 442–1276 × 72–580 | 12 … 426 (open: 12 … 50) | −12 … 56 | x 12–1706, y −12–664 |
| I | 430–1276 × 72–598 | 12 … 414 | 6 … 56 | x 12–1694, y 6–664 |
| II | 236–1276 × 72–648 | 12 … 220 (open: 12 … 50) | 56 | x 12–1500, y 56–664 |
| III | 32–1276 × 72–648 | 12 … 16 | 56 | x 12–1296, y 56–664 |

So the background must cover at least **x 12–1706, y −12–664**. Shown at 1728 × 688 from world (0, −16), it covers x 0–1728 and y −16–672, which leaves a few px of slack on every side. If the DEV invariant disagrees with this table, trust the invariant and fix the table in the Dev Agent Record.

### Era art brief (placeholders; real art in 3.6/5.x)

- **Keep the pen plain.** The Land III fence (world 32–1062 × 184–648) and everything inside it is open grass in **every** era. Sheep, pieces, carcasses and the green infection tint must read on it (GDD readability rules; infection is never colour-only, but the tint must still show). A gentle grass texture (2–3 tones around `pasture` #86B85C) is fine. No buildings, paths or strong patterns inside it.
- **Where era features go.** These regions are never inside any tier's fence:
  - the **top band** (world y < 176): left of the Better Place glow (x < 380), and between the glow and the Market (x 660–1080). Keep the decoration spots (Flower Patch 696–752 × 148–176, Scarecrow 980–1020 × 112–176) clear, or plain behind them, so they stay readable;
  - **right of the Market** (x > 1280);
  - the **bottom strip** (y > 652).

  Remember what the opening view shows: at tier 0 it is about x 49–1329 × y 22–630, so the top band and a sliver right of the Market are what a new player sees. Put each era's signature there.
- **Content (GDD Level Progression):**
  - Pasture: an open field (maybe a few tufts and a distant hedge);
  - Village: huts and a path (the path runs through the top band, never into the pen);
  - Town: buildings and a wall;
  - Wool Empire: banners and a castle silhouette.

  Each era should be recognisable at a glance from the top band alone.
- **Palette.** Use DESIGN.md tokens (`wood`, `bark`, `wool`, `wool-shade`, `hay`, `awning`, `dusk`, `halo`). Never use `alert`, `infection` or `void` (reserved meanings, constants.ts colour rules), and avoid `awning`-red near the Market so the stall stays distinct. The tone is cute and cozy (NFR10).
- **Format.** 864 × 344, shown at 2× with `pixelArt` nearest-neighbour. Flat colours keep each PNG small (tens of KB at most); the build stays well under 8 MB.

### UX details

- **Badge:**
  - mockup `.era-badge`: `top: 16; right: 16; height: 40px; padding: 0 16px; background: dusk; color: wool; border-radius: full; font: 500 20px/1.2 Pixelify Sans`;
  - `COMPONENTS.eraBadge` already holds `{ backgroundColor: 'dusk', textColor: 'wool', typography: 'label', rounded: 'full' }`;
  - a pill means status, not a button (UX-DR9), so no hover and no hand cursor.
- **Banner:**
  - `COMPONENTS.eraBanner` = `{ backgroundColor: 'dusk', textColor: 'halo', regressTextColor: 'woolShade', typography: 'display' }`;
  - "full-width dusk band across the upper field" (DESIGN Components, Layout);
  - contrast: halo on dusk is 9.8:1 and wool on dusk is 12.6:1 (DESIGN). Wool-shade on dusk is close to wool, so it stays readable but quieter.
- **Copy (UX-DR94):** "Village" / "Town" / "Wool Empire" going up; "Back to {era}." going down, which can include "Back to Pasture.". The badge says "Pasture" at the start. Pasture has no "up" banner, because a game starts there.
- **Timing (UX-DR37, UX-DR83):** the crossfade is about 1 s; the banner slides in. Hold lengths are [ASSUMPTION] values, so tune them in the browser and record them.
- **Layering:** the background is below everything in GameScene. The banner is in HudScene (above the field and the shop panel, below popups, tooltips and the Overlay). The badge is in OverlayScene (above the scrim). Toasts are DOM, above all canvas.

### What must be preserved

- **3.3/3.4 layout:** the fence growth, the camera limits and the opening view, `growLand` once per frame, every DEV invariant, and the decoration spots. The background is not added to `playArea`/`focus`.
- **Input:** the background, banner and badge are never interactive. `InputController` hit tests, drag, drop, pan, the Esc chain and the HUD's `controlAt`/`pointerOverControl` are unchanged (do not add the badge to `tooltipSources`, which would make it a "HUD control" that swallows drops).
- **Modals:** `ModalController` scrim and panel behaviour, the lose fade, and Esc order. The badge sits between scrim and panels and must not change their depths.
- **Sim:** system order (eras appended last), the `stepWith` loss guard, determinism, and the save schema (8).
- **Performance:** nothing new per frame except a cheap `currentEra` where it is needed. There are no per-frame allocations or per-frame `setText`. The images are created once per scene `create`.

### Architecture compliance

- **N4** exactly: `currentEra` selector, `lastEra` cache, `updateEras` system, `EraChanged` event. The view listens and plays the background crossfade, banner and (later) audio.
- **File homes:**
  - `src/sim/systems/eras.ts` and `selectors.ts` (architecture "Eras" row);
  - `src/view/field/EraBackground.ts` (architecture `view/field/` list names `EraBackground`);
  - the banner in `view/hud/`;
  - the badge in `view/overlay/` (it must be above the scrim; the architecture lists it as HUD, so deviate and say why in the Dev Agent Record);
  - backgrounds as 4 separate images, not in an atlas ("Era backgrounds: 4 separate images (large, swapped rarely)").
- **Events:** `EraChanged` is past-tense PascalCase in the `SimEvent` union. Any exhaustive switch that exists by then must handle it.
- **Tuning/colours/copy:** thresholds go in `TUNING`. Colours come only from `COMPONENTS`/`COLORS` and copy only from `strings.ts`. View timings (fade, banner) are view constants in their modules, like `SUCTION`/`SALE` in GameScene, not `TUNING` (they are not game rules).

### Library / framework notes (Phaser 4.2.1 installed; no new dependencies)

- Everything needed is already in use:
  - `this.load.image` (as `load.atlas` in PreloadScene);
  - `scene.add.image(...).setOrigin/setScale/setDepth/setAlpha/setTexture`;
  - `this.tweens.add` / `killTweensOf` (GameScene `suck`, `Decorations.pop`, `BoostTimer.pop`);
  - `boxTexture`/`textStyle` (`widgets/box.ts`).
- `Image.setTexture(key)` swaps the texture in place, so there is no need to create new images for a crossfade.
- Do not use Phaser 3 APIs from memory (`setTintFill`, `preFX`, camera `fade` effects for this crossfade). Two images with alpha tweens are enough. If unsure, check `node_modules/phaser/skills/` (`v3-to-v4-migration`) or Context7.
- No web research is needed: no library or version changes.

### Testing standards

- Vitest covers `src/sim/`, `src/save/` and `src/config/` only. `EraBackground`, `EraBanner` and `EraBadge` are Phaser code and are checked in the browser (Task 7).
- Test files go in `tests/<same path as src>/`, and scenarios in `tests/sim/scenarios/`.
- Helpers (`tests/sim/helpers.ts`): `newGame(seed)` with a literal seed, `runFor(state, ms)` with ms a multiple of `TICK_MS`, and `fillFlock`. Use `busyGame` for save tests.
- Every number comes from `TUNING` (`TUNING.eraThresholds[0]`, never `10`). Use real paths for sheep removal (`Sell` via `applyCommand`, or `killSheep`) and never splice `state.sheep` (project rule).
- Assert on state and emitted events only; no spies on systems.

### Previous story intelligence (3.4, 3.3)

- **3.4 left three notes for 3.5** (deferred-work):
  - put the badge in OverlayScene, above the scrim;
  - check the badge against the Scarecrow at every tier on screen (by the numbers it clears: world y 72–112, x ≥ 1112 at the Land II/III scroll, against the Scarecrow at x ≤ 1020);
  - draw era art below `FIELD_DEPTH.ground`, and keep the decoration strip readable in each era.
- **3.3/3.4 review lessons:**
  - Build images once in `create`, then toggle them; never create or destroy them during play.
  - Put view work in `ui` try/catch, never in the sim's.
  - Handle rare events that touch layout or the camera once per frame, after the ticks.
  - Derive layout bounds from module constants (the review sent back re-typed numbers), and add DEV frame-size checks for art the layout depends on.
  - Every Task 7 item needs recorded evidence (screenshots or probe output); FPS runs must last as long as asked.
- **Browser probe setup:**
  - `playwright-core` from `/home/rylanevans/nr-csp/frontend/node_modules` with `/usr/bin/google-chrome` (SwiftShader);
  - run the DEV server on its own port (5200–5203 worked) and stop it with `kill <vite node pid>`, never `pkill -f`;
  - plant saves via debug Load save, read state via Dump state, and move the mouse in steps.
  - Known flake: the first drag after the first debug Load sometimes never starts (deferred). Do not chase it.
- **FPS baseline:** 3.4 measured 103 sheep at Land III, ×1, 150 s: median 33 (min 29, max 34), with the load average going from 2.3 to 7.9.

### Git intelligence

- Recent commits: `8cf1e6a` (3.4), `3f3f24e` (3.3 review fixes), `ebf276a` (3.3), `a903488` (3.2), `e64819a` (3.1 review).
- Per-story pattern: selectors and sim tests, a view object, placeholder art with a pipeline run, `deferred-work.md`, and a Dev Agent Record with browser evidence and FPS.
- Commit message: `Implement story 3.5: Eras and Their Transitions`.
- Branch: `story/3-5-eras-and-their-transitions` (already created from `main` at `8cf1e6a`).

### Out of scope

- **5.6:** the era fanfare, the descending note and captions (no `AudioDirector` yet).
- **5.7:** reduced motion for the banner slide (and possibly the crossfade).
- **3.6:** tuning the thresholds and pacing (time-to-Village and time-to-Town).
- **v2 (GDD "Era unlocks beyond the background swap", "Era-specific music"):** in v1, an era change is **only** a background swap plus its banner and badge. No gameplay effect, no unlocks.
- **4.6:** overcrowding at era thresholds (it is Epic 4's rule; eras only provide the count).

### Open questions (defaults chosen; confirm or change)

1. **Where the badge lives.**
   - **Default:** OverlayScene, between the scrim and the panels. It is the only scene drawn above the scrim (the 1.10 deferred note).
   - **Alternative:** HudScene with a new "above-modal" HUD layer. This would need a cross-scene depth trick, because Phaser scenes draw in order.
2. **Flicker at a threshold.**
   - **Default:** no sim hysteresis (the epic AC needs two events for 10 → 9). The view coalesces per frame only, so a flock hovering at 9/10 can replay the banner every few seconds.
   - **Alternative:** a view-only cooldown, for example no new banner within 3 s of the last, with the background and badge still following at once. Pick this if playtesting finds the default noisy.
3. **Banner placement.**
   - **Default:** a band centred at canvas y ≈ 204, below the toast stack, the Pause button and the badge.
   - **Alternative:** at the very top (y 16–104), which would sit under toasts and over the Pause button and badge for about 3 s.
4. **Title screen background.**
   - **Default:** show the Pasture art behind the title (Task 4.5).
   - **Alternative:** keep the flat `pasture` colour.

### Project Structure Notes

- New files:
  - `src/sim/systems/eras.ts`
  - `src/view/field/EraBackground.ts`
  - `src/view/hud/EraBanner.ts`
  - `src/view/overlay/EraBadge.ts`
  - `assets/art/backgrounds/{pasture,village,town,wool-empire}.png`
  - `public/assets/backgrounds/{pasture,village,town,wool-empire}.png` (generated, committed)
  - tests: `tests/sim/systems/eras.test.ts`, `tests/sim/scenarios/eras.test.ts`
- Modified:
  - sim and config: `src/config/tuning.ts`, `src/sim/selectors.ts`, `src/sim/events.ts`, `src/sim/step.ts`
  - save: `src/save/validate.ts` (shared `ERAS`)
  - view: `src/view/strings.ts`, `src/view/assetKeys.ts`, `src/view/field/depths.ts`, `src/view/field/PenCamera.ts` (exported `viewExtent`)
  - scenes: `src/view/scenes/{PreloadScene,GameScene,HudScene,OverlayScene,TitleScene}.ts`
  - pipeline and credits: `scripts/build-assets.ts`, `assets/CREDITS.md`
  - debug: `src/debug/DebugOverlay.ts` (optional era readout)
  - tests: `tests/sim/step.test.ts`, `tests/sim/selectors.test.ts`, `tests/config/tuning.test.ts`, `tests/save/busy.ts`, `tests/save/*` (stale-`lastEra` load), and any test fixed in the 2.4 sweep
  - `_bmad-output/implementation-artifacts/deferred-work.md`
- One deliberate variance: the badge goes in `view/overlay/` instead of the HUD scene, for the reason above.

### Project Context Rules (from `_bmad-output/project-context.md`)

- **The era is derived** from the live sheep count every time (`currentEra`). Never store or increment an era. `lastEra` exists only to emit `EraChanged`. Eras regress.
- **The sim is pure:** no Phaser, DOM, `Date.now()` or `Math.random()` in `src/sim/`. A new rule goes in `src/sim/systems/<system>.ts`, registered in `step.ts`. A new sim → view signal goes in the `SimEvent` union with `assertNever` coverage. New tunables go in `TUNING`.
- **View rules:**
  - Game logic never lives in sprites, scenes or tweens (crossfade and banner tweens are visual only).
  - Colours come from `COLORS`/`COMPONENTS`, copy from `strings.ts`; no hex or text literals in components.
  - Changing text is set only on a change, never every frame.
- **Listeners:** every `bus.on`/`events.on` is removed on SHUTDOWN. This story should add none beyond the existing `sim` handlers; if HudScene or OverlayScene gains one, remove it there.
- **Performance:** no allocation in `step()`, systems or per-frame code (`currentEra` is a plain comparison). Use no `Graphics` redrawn per frame. Check FPS at 100 sheep, ×1.
- **Assets:** relative URLs only (`assets/backgrounds/…`), no unused assets in `public/assets/`, and the total build stays under 8 MB.
- **Copy rules:** no "!" (except "Last sheep!"); the Voice table strings are used exactly.
- **Done:** `npm test`, `npm run typecheck` and `npm run lint` pass, plus the browser checks.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.5; FR27, FR28, FR30; AR20, AR21; UX-DR4, UX-DR7, UX-DR9, UX-DR20, UX-DR36, UX-DR37, UX-DR50, UX-DR83, UX-DR88, UX-DR94, UX-DR101]
- [Source: _bmad-output/game-architecture.md: Novel pattern N4 (Derived Era with Change Signal); Event naming (`EraChanged`); Asset Management ("Era backgrounds: 4 separate images"); source tree (`assets/art/backgrounds`, `public/assets/backgrounds/{pasture,village,town,wool-empire}.png`, `systems/eras.ts`, `view/field/EraBackground`); "Eras" and "Field rendering" rows; Tuning row ("era thresholds")]
- [Source: _bmad-output/planning-artifacts/gdds/gdd-sheep-civilization-2026-10-05/gdd.md: Meta-Progression (era table; regress; "only a background swap"); Level Progression (era art content; ~1 s crossfade and banner); thresholds equal capacities ("deliberate"); pacing targets; Audio (era fanfare)]
- [Source: _bmad-output/planning-artifacts/gdds/gdd-sheep-civilization-2026-10-05/decision-log.md: Eras; Era counting; Overcrowding at era thresholds]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-sheep-civilization-2026-10-05/DESIGN.md: components `era-badge`, `era-banner`; Colors (dusk, halo; contrast table); Typography (display, label); Layout (badge top-right under modals, banner across the upper field); Shapes (pills are status)]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-sheep-civilization-2026-10-05/EXPERIENCE.md: Voice (era up / regress banners); Components (badge always current; banner with crossfade); State Patterns (Era advance / Era regress); Game Feel (era change); Accessibility (captions)]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-sheep-civilization-2026-10-05/mockups/hud.html: `.era-badge` CSS, "Village" badge in place]
- [Source: _bmad-output/implementation-artifacts/deferred-work.md: "Era badge above the modals (Story 3.5)", "Era badge vs the Scarecrow (Story 3.5)", "Era backgrounds (Story 3.5)"]
- [Source: _bmad-output/implementation-artifacts/3-4-decorations.md (spots, review lessons, probe setup, FPS baseline)]
- [Source: _bmad-output/project-context.md]

## Dev Agent Record

### Agent Model Used

Claude Opus 5.5 (claude-opus-5-5[1m])

### Implementation Plan

- **Sim (pattern N4):** `TUNING.eraThresholds` [10, 25, 50]; `ERAS`, `currentEra` (plain descending comparison, no allocation) and `eraIndex` in `selectors.ts`; `updateEras` (`systems/eras.ts`) appended last to `SYSTEMS`; `EraChanged { from, to }` in the `SimEvent` union. `validate.ts` now imports the shared `ERAS`. No save schema change.
- **Background:** `EraBackground` builds two layers once (base + incoming top), each a container of strip images (see the FPS note below) at `FIELD_DEPTH.background` (−100) / −99, 864 × 344 shown at 2× from world (0, −16). `show` (no fade) for create/load; `fadeTo` crossfades over 1 000 ms, snapping a running fade to its target first. GameScene sets `eraChanged` in `onSim` and fades once per frame in `update` to `currentEra(state)`, in its own `ui` try/catch, like `landBought`.
- **Coverage:** new pure `PenCamera.viewExtent(area, protect, leftInset)` from the private limit helpers; GameScene's DEV block checks it lies inside `ERA_BACKGROUND_BOUNDS` for every tier, shop open and closed. `EraBackground` has a DEV frame-size check.
- **Banner:** `EraBanner` (HudScene, depth 50): a full-width `dusk` band 88 px tall (`ceil(56 × 1.1) + 2 × 12`), centred at canvas y 204; slide in 300 ms, hold 2 000 ms, fade 400 ms. HudScene keeps the frame's first `from` and last `to` and plays once in `refresh` (`flushEraBanner`).
- **Badge:** `EraBadge` (OverlayScene, depth 5, between scrim 0 and panels 10): a 160 × 40 `dusk` pill, right edge at 1264, top at 16, with a DEV fit check for every era name. Set in `create` from `currentEra` and on `EraChanged`. Architecture lists it under HUD; it lives in `view/overlay/` because only OverlayScene draws above the modal scrim (1.10 deferred note).
- **Title:** shows the Pasture background (via `EraBackground.show('pasture')`); the 48 px below the art at the title's 720 px is the matching pasture camera colour.
- **Debug:** the counts line shows `era <id>` (read through `currentEra`).

### Debug Log References

Browser checks: DEV server on port 5203, Playwright probes in the session scratchpad (`p1`–`p9`, `pab`), SwiftShader Chrome at 1280 × 720 unless noted. No console or page errors in any run (7.11).

- **7.1 New game:** Pasture background and "Pasture" badge on the first frame, no banner (`p1-a-new.png`). Title screen shows the Pasture art behind its scrim (`p6-c` title frame).
- **7.2 Up:** "+10 sheep" ×1/×2/×2 → Village / Town / Wool Empire. Mid-fade frames at ~450 ms show the blend (`p1-b*-midfade.png`), halo banners "Village", "Town", "Wool Empire" (`p1-c*-banner.png`), and the badge updated each time (`p1-d*-settled.png`). Final state: 53 sheep, `lastEra` wool-empire.
- **7.3 Down:** starving back to 49 / 24 / 9 shows wool-shade banners "Back to Town.", "Back to Village.", "Back to Pasture." with the reverse fade and badge (`p2-*`). Death toasts stack top-centre (y 16–152) above the band (y 160–248), both readable.
- **7.4 Badge under modals:** visible top-right above the scrim under Pause (`p3-a-pause.png`), the Volume sub-panel (`p4-a`), the start-over confirm (`p4-b`) and the lose screen (`p4-d`). A right-drag starting on the badge pans the field (`p3-b`); a sheep dragged under the badge and back drops normally (`p4-c`: sheep 1 moved 751,512 → 719,462, not sold or sacrificed). The badge draws over a dragged sheep, as expected for the Overlay scene.
- **7.5 Coverage:** first build (full image): with the camera colour set to magenta, 0 magenta pixels at all 32 cases (tiers 0–III × shop closed/open × 4 pan corners). Scroll limits matched the Dev Notes table (tier 0: x 12–426, y −12–56, open x 12–50; I: x 12–414, y 6–56, open x 12–38; II: x 12–220, open 12–50; III: x 12–16; y 56). After the strip change the camera colour is part of the background by design; a DEV art check (scratchpad generator) asserts every pixel outside the strips is `pasture`, and the frames are visually seamless (`p1-*` rerun). Decorations, Better Place, Market and fence readable in every era (`p7-read-*.png`).
- **7.6 Readability:** in each era, two Starving sheep (alert dots), infected sheep (green tint + marker), carcasses, 5 food and 5 breeding pieces all distinct (`p7-read-{pasture,village,town,wool-empire}.png`).
- **7.7 Load/restart:** Pause → Main Menu → reload → Continue in Town: Town background and badge at 150 ms, top layer hidden (no fade), no banner (`p6-c`, `p6-d`). Debug Load with `lastEra` rewritten to wool-empire: one "Back to Town." banner, background already Town (no top layer, no jump) (`p6-e`). Restart → 3 sheep, Pasture.
- **7.8 Rapid changes:** ×16, six forced 9 ↔ 19 flips: at every check the fade target equals the badge and `lastEra`; after settling base = badge = Village, top hidden, banner hidden (`p7-x16-*`).
- **7.9 960 × 540:** badge and banner legible, band spans the canvas (`p8-960-banner.png`).
- **7.5 note (code review):** the magenta proof above predates the strip change. For the shipped build, coverage is the strips plus the camera's `pasture` clear colour; `npm run assets` checks each background's size and a DEV check (`flatOutsideStrips`) checks every texel outside the strips is `pasture`, run in the browser with no errors.
- **Review fixes (browser):** a debug Load of a Village save with `lastEra` rewritten to pasture shows no banner (badge, background and cache all Village); a one-tick wipe of a 13-sheep Village flock shows the Pasture badge and background under the lose screen (`p10-wipe-lose.png`). No console errors.
- **7.10 FPS:** 103 sheep, Land III, both decorations, ×1, overlay open, a Town ↔ Wool Empire crossfade pair in each window. The machine was busy (load average 4–10 from other sessions), so runs alternated this branch against a worktree of `8cf1e6a` on port 5204 instead of comparing with 3.4's absolute 33:
  - first build (one full-field image per layer): 150 s run median 17; alternating 90 s runs 18 / 14 vs baseline 26 / 26. Shrinking the background to nothing restored 26 / 27, so the whole cost was the full-field image's fill in the software renderer;
  - strips (band + side): 28 / 29 vs 32 / 33;
  - final strips (far line, left, mid, side): **31 / 29 vs baseline 30 / 33**, within run-to-run noise. Rylan then asked to stop the FPS comparison.

### Completion Notes List

- 2026-10-07: Story created. Ultimate context engine analysis completed - comprehensive developer guide created.
- 2026-10-08: Implemented. The era is derived (`currentEra`), `updateEras` runs last in `step` and emits one `EraChanged` per tick's net change, never on the losing tick. 13 new sim tests (`tests/sim/systems/eras.test.ts`, `tests/sim/scenarios/eras.test.ts`, including the epic AC 10 → 9 = exactly two events), plus tuning, selector and save tests (busy saves hold a consistent `lastEra`; a stale `lastEra` loads and emits one event). 583 tests pass; typecheck, lint and build clean.
- The 2.4 regression sweep found nothing to fix: no existing test asserts an exact event list once a flock reaches 10.
- **FPS deviation from the Dev Notes:** the four PNGs are still 864 × 344 shown at 2×, but only four strips of each are drawn (frames cut from the same texture). The rest of the art is flat `pasture`, which the camera colour draws. A full-field image cost ~10 FPS in the probe's software renderer; the strips bring it within noise. The art therefore has no grass tufts.
- **The era at a loss:** the losing tick emits no `EraChanged` (AC 2), so a flock wiped out in one tick keeps its era's background and badge under the lose screen; logged in deferred-work.
- `tests/save/busy.ts` needed no edit: its `runFor(1_000)` leaves `lastEra` = `village`, matching `currentEra`.
- Open Questions 1–4 kept their defaults (badge in OverlayScene, no banner cooldown, banner at y ≈ 204, Pasture art on the title). The banner briefly covers the Market's awning at the opening scroll (deferred-work).

- **Code review (2026-10-08):** 8 patches applied, 2 deferred, 7 dismissed.
  - Rylan chose to fix stale `lastEra` at load: `syncEra` (`systems/eras.ts`) runs in `GameScene.create`, so a continued or loaded game never announces an era change. This changes AC 7's "a stale save's first tick plays one banner" to "no banner". The sim still emits `EraChanged` for a stale cache if `updateEras` meets one; it just never does after `create`.
  - On `Lost`, the badge and background follow `currentEra` (AC 6).
  - The asset script validates the backgrounds (PNGs only, files, 864 × 344) before writing anything.
  - Strips no longer overlap.
  - A DEV flat-art check guards the art outside the strips.
  - The banner has its own try in `refresh`.
  - The birth test has a tick cap, and the selector test adds carcasses.
  - 585 tests pass; typecheck and lint are clean.

### File List

- `_bmad-output/implementation-artifacts/3-5-eras-and-their-transitions.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/deferred-work.md`
- `assets/CREDITS.md`
- `assets/art/backgrounds/pasture.png` (new)
- `assets/art/backgrounds/village.png` (new)
- `assets/art/backgrounds/town.png` (new)
- `assets/art/backgrounds/wool-empire.png` (new)
- `public/assets/backgrounds/pasture.png` (new, generated)
- `public/assets/backgrounds/village.png` (new, generated)
- `public/assets/backgrounds/town.png` (new, generated)
- `public/assets/backgrounds/wool-empire.png` (new, generated)
- `scripts/build-assets.ts`
- `src/config/tuning.ts`
- `src/debug/DebugOverlay.ts`
- `src/save/validate.ts`
- `src/sim/events.ts`
- `src/sim/selectors.ts`
- `src/sim/step.ts`
- `src/sim/systems/eras.ts` (new)
- `src/view/assetKeys.ts`
- `src/view/field/EraBackground.ts` (new)
- `src/view/field/PenCamera.ts`
- `src/view/field/depths.ts`
- `src/view/hud/EraBanner.ts` (new)
- `src/view/overlay/EraBadge.ts` (new)
- `src/view/scenes/GameScene.ts`
- `src/view/scenes/HudScene.ts`
- `src/view/scenes/OverlayScene.ts`
- `src/view/scenes/PreloadScene.ts`
- `src/view/scenes/TitleScene.ts`
- `src/view/strings.ts`
- `tests/config/tuning.test.ts`
- `tests/save/roundTrip.test.ts`
- `tests/sim/selectors.test.ts`
- `tests/sim/scenarios/eras.test.ts` (new)
- `tests/sim/systems/eras.test.ts` (new)

### Change Log

- 2026-10-08: Code review: 8 patches applied (load-time `syncEra`, era on loss, asset checks before writes, strip overlap, DEV flat-art check, banner guard, two test fixes), 2 deferred. Status → done.
- 2026-10-08: Story 3.5 implemented: derived eras (`currentEra`, `updateEras`, `EraChanged`), era backgrounds with a 1 s crossfade (drawn as strips for fill cost), the era banner (HudScene), the era badge (OverlayScene, above the scrim), the backgrounds asset pipeline, sim and save tests, browser checks with an A/B FPS run. Status → review.

