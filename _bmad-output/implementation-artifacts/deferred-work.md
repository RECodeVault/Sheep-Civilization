# Deferred Work

Real issues found in reviews that are not actionable in the story where they were found. Pick them up in the named story.

## Deferred from: code review of 1-1-scaffold-the-project-from-the-phaser-template (2026-10-05)

- **Typing for `scripts/`:**
  - `tsconfig.json` sets `"types": ["vite/client"]` only, so Node globals (`process`, `fs`) in `scripts/*.ts` won't typecheck without `@types/node`.
  - `allowImportingTsExtensions` is not set. Node type-stripping needs explicit `.ts` import specifiers, which tsc will reject.
  - Resolve this in Story 1.2, when `scripts/build-assets.ts` becomes real.
  - **Resolved in Story 1.2:** `scripts/tsconfig.json` (Node types, `nodenext`, `allowImportingTsExtensions`); `typecheck` runs both configs.
- **Duplicated font files:** fonts exist in both `assets/fonts/` (source) and `public/assets/fonts/` (runtime) with nothing keeping them in sync. The Story 1.2 `npm run assets` pipeline should copy them.
  - **Resolved in Story 1.2:** `npm run assets` copies `assets/fonts/*.woff2` to `public/assets/fonts/`.
- **`isAbomination` lint rule versus saving:**
  - The rule in `eslint.config.js` applies to `src/save/**`, but Story 1.9's save validation and migrations must read and write that field.
  - Add `src/save/**` to that block's `ignores` in Story 1.9.
  - **Resolved in Story 1.9:** the `src/save/**` lint group sets `secrecy: false`.

## Deferred from: code review of 1-2-simulation-core-and-game-clock (2026-10-05)

- **Commands and pausing (Story 1.10):** `GameScene.pendingCommands` is reset in `create()`, so a command dispatched between shutdown and `create()` is lost. While the clock is paused, Farm presses pile up with no bound and all apply on the first tick after unpause. Decide both when pausing arrives.
  - **Resolved in Story 1.10:** Farm (F and the click) is ignored while any modal is up, so nothing queues while paused and nothing bursts on resume; the queue only fills while the clock runs, and each tick empties it. No input arrives between SHUTDOWN and `create()`.
- **Exit animations (Story 2.4):** `PooledEntitySprite.playExit()` returns nothing and `EntityLayer` releases the sprite immediately. The architecture's N3 contract is `playExit(done)`, releasing to the pool only when the exit animation ends. Change the interface and the sweep when death puffs or sell animations arrive.
  - **Moved to Stories 2.7 / 3.1 (sacrifice suction, sale):** 2.4 put the death's slapstick beat on the carcass's spawn (a flop and a dust puff), so the dying sheep's sprite still hides at once and `playExit()` stays synchronous.
  - **Resolved in Story 2.7 (no interface change):** the suction plays on a pooled ghost image in `GameScene` (`suck`), started from `Sacrificed` while the real sprite is still bound; the sprite leaves through the normal sweep and `playExit()` stays synchronous. 3.1 can reuse the ghost for the sale.
  - **Done in Story 3.1:** the sale hops a ghost into the stall from `Sold`; both exits share `GameScene.ghostOf`.
- **Fence growth (Story 3.3):** `Fence.setBounds` destroys and re-creates its images, and `GameScene` keeps no reference to the `Fence`. Growing the fence during play must reuse or pool the parts (project rule: never `destroy()` during play) and keep the instance.
  - **Resolved in Story 3.3 (code review):** `GameScene` keeps the `Fence`, and `Fence.setBounds` reuses its rail and post images, adding only the extra parts a larger fence needs; nothing is destroyed during play.
- **Failed asset load (Story 1.4):** `PreloadScene` logs `FILE_LOAD_ERROR` and still starts `GameScene`, so a missing atlas renders the sheep and fence as Phaser missing-texture boxes with no message. Decision 2026-10-05: keep log-and-continue; the Story 1.4 error safety net should show the player a message when an atlas fails to load.
  - **Resolved in Story 1.4:** after loading, `PreloadScene` checks that both atlas textures exist. If one is missing it logs a warn and shows "Some of the pasture didn't load. Try reloading the page." once; the game still starts.

## Deferred from: code review of 1-3-sheep-wander-the-pasture (2026-10-06)

- **Non-finite values in a save (Story 1.9):** a `NaN` or `Infinity` `x`, `y` or `heading` gets past the movement fence clamp (comparisons with `NaN` are false) and stays non-finite; JSON then turns it into `null`. One `NaN` point passed to `rebuildGrid` also overwrites another sheep's grid slot. Save validation must reject non-finite numbers and duplicate sheep ids.
  - **Resolved in Story 1.9:** `src/save/validate.ts` rejects non-finite numbers, positions outside the fence and duplicate ids (unique across sheep, pieces and carcasses).
- **Sprites across a state swap (Story 1.9):** `SheepSprite` keeps `lastTick` and its prev/curr positions. If load-or-new replaces `GameScene.state` in place while the `EntityLayer` lives (ids restart at 1), sheep slide from the old run's spots or freeze for a tick. Release or reset all sprites when the state is replaced.
  - **Resolved in Story 1.9:** a load is always a scene start (PreloadScene) or restart (debug Load), so every sprite and pool is rebuilt; the state is never replaced in place.
- **Stale grid indices (Stories 4.2/4.3):** `queryNeighbours` returns indices into the array last passed to `rebuildGrid`, with no guard. Any system that queries neighbours after a death has filtered `state.sheep` must rebuild first (see the `grid.ts` header).

## Deferred from: code review of 1-4-developer-debug-overlay-and-error-safety-net (2026-10-06)

- **Watchdog in embeds (Story 5.2):** browsers throttle rAF in offscreen cross-origin iframes (the itch.io embed) without setting `document.hidden`. A still frame counter can then trigger a needless `loop.sleep()/wake()`, which runs one extra frame and logs a false "Game loop restarted after error" warn. Check it in the real embed and gate the watchdog on visibility (for example with an `IntersectionObserver`) if it misfires.
- **Saving after a sim error (Story 1.9):** when `step()` throws mid-tick, `GameScene` catches it and play continues on a half-mutated state. The safety net's `forceSave()` hook (comment in `src/view/safetyNet.ts`) would write that state to disk. Decide whether to validate before forcing a save after a sim error, or to skip the forced save for `sim` errors.
  - **Resolved in Story 1.9:** every write goes through `writeSave`, which validates the state first. A half-mutated state that is still valid is saved; an invalid one is refused and the last good save stays. The forced save runs on the error toast's 10 s cooldown.
- **NFR1 on target hardware (Story 5.11, or any time before it):** the formal 100-sheep, 5-minute run at ×1 was recorded only in headless Chrome (SwiftShader, CPU rendering): 103 sheep, mean 51.7 FPS, p95 33.4 ms. The 1.3 baseline gets 50.2 FPS under the same conditions, so there is no regression. 60 FPS on an integrated-GPU laptop in Chrome and Firefox is still unverified. Decision 2026-10-06 (Rylan): close 1.4 and carry this over. Reason: it needs a real browser on Rylan's hardware. How: DEV build, backtick, "+10 sheep" ×10, and run for 5 minutes. Since Story 1.5 sheep starve: new and added sheep start at Fullness 60 and die 72 s later, and a fed sheep dies 120 s after Feed all. So press **Feed all** within 60 s of adding sheep and then about every 90 s, until Story 1.7's feeding exists. Reopen the overlay with backtick to press it, and close it again so it is not in the measurement.

## Deferred from: code review of 1-5-hunger-and-starvation (2026-10-06)

- **Non-finite hunger fields in a save (Story 1.9):** a missing or `NaN` `fullness` survives the drain (`NaN <= ε` is false), so the sheep never starves and `hungerOf` returns 'hungry' forever. `Infinity` makes it permanently 'fed'. A `NaN` `bornAt` makes `stageOf` return 'elder'. `decodeSave` checks only `time`. Add `fullness` and `bornAt` to the non-finite checks already listed above for `x`, `y` and `heading`.
  - **Resolved in Story 1.9:** `fullness` (finite, in [0, fullnessMax]) and `bornAt` (finite, not after `time`) are validated.
- **Tooltip wider than the canvas (Stories 1.6, 5.3):** `Tooltip.showAt` clamps right, then left, so a box wider (or taller) than the canvas minus the margins is pinned at the left or top margin and runs off the other edge. There is no `wordWrap`. Current copy cannot reach it; button tooltips and name lines might.
  - **Resolved in Story 1.6:** the tooltip `Text` wraps at a 360 px box width (`wordWrap`), so long copy grows downward instead of running off the canvas.
- **Stage-aware sheep frames (Story 2.1):** `SheepSprite.sync` re-sets its frame only when `hunger` changes (`shownHunger`). When lamb and elder frames arrive, cache the (stage, hunger) pair, or a sheep that ages while its hunger is steady keeps the old frame.
  - **Resolved in Story 2.1:** `SheepSprite` caches `shownStage` beside `shownHunger` and picks `SHEEP_FRAME[stage][hunger]` when either changes.

## Deferred from: code review of 1-6-hud-bottom-bar-farm-button-and-food-meter (2026-10-06)

- **Paused Farm bursts (Story 1.10):** this extends "Commands and pausing" above.
  - While the clock is paused, each Farm press squashes at once with no result.
  - On resume, all queued Farms apply in one tick and spawn N identical popups stacked at the same spot (up to the 8-popup pool), and the queue is unbounded.
  - Decide whether to ignore Farm while paused, and whether to merge a tick's `Farmed` events into one popup.
  - **Resolved in Story 1.10:** as "Commands and pausing" above: Farm is ignored under a modal (InputController and `HudScene.farm` check `GameScene.modalOpen`).
- **Unvalidated `food` in a save (Story 1.9):** add `food` to the save validation's finite-number checks, and require a non-negative integer.
  - A fractional value shows a raw popup ("+0.5", or "+0.9999999999999996").
  - `NaN` or a missing value shows "NaN/20" / "undefined/20", and `FoodMeter.set` redoes its pips and text every frame.
  - A string value ("5") jumps straight to the cap.
- **HudScene lifetime (Story 1.10):** GameScene relaunches the HUD on every restart, but nothing stops it if GameScene stops for good (Title, lose flows). It would keep calling `dispatch` and reading `simState` on a dead scene. Stop or sleep `HudScene` together with GameScene.
  - **Story 1.8:** the lose flow does not trigger this: GameScene keeps running (rendering the frozen field) after a loss, so the HUD's reads stay valid. `OverlayScene` (new in 1.8) is launched the same way and has the same lifetime question for the Title flow.
  - **Resolved in Story 1.10:** Pause → Main Menu (added at Rylan's request) is the path back to the title. `GameScene.quitToTitle()` saves, stops autosave and the forced save, stops `HudScene` and `OverlayScene`, then starts `TitleScene`. Browser-verified: all three scenes inactive on the title, and listener counts unchanged after two round trips.
- **Button disabled state (Story 2.3):** the generic `Button` has several gaps that the greyed Breed tool will need fixed.
  - It shows no tooltip while disabled, but UX-DR31 needs the reason ("No room. Buy land.").
  - A button re-enabled under the pointer gets no tooltip until the pointer re-enters.
  - The hand cursor is not updated while the pointer is over a button that changes state.
  - The F path (`HudScene.farm`) does not check `enabled`.
  - **Resolved in Story 2.3:**
    - A disabled button still hovers, so its tooltip gives the reason, and `setTooltip` changes the text; `HudScene` re-sets a shown tooltip when its text changes.
    - Re-enabled under the pointer, the tooltip comes back and the canvas cursor follows at once.
    - `HudScene.farm`/`farmBreeding` return early on a disabled button.
- **Farm tooltip value (Story 4.7):** `BottomBar` builds the tooltip once from `TUNING.farmFoodPerClick`, and `Button.tooltip` is readonly. Better Hoe must be able to update it.
  - **Resolved in Story 1.7:** the Farm progress bar change (2026-10-06) made the tooltip a constant ("Farm: fill the bar for 1 food (F)") that does not depend on the hoe.
- **Baked box textures (Stories 1.8, 1.10, 3.2):** `boxTexture` caches one texture per size and style in the game `TextureManager` and never evicts. Keep `Panel` sizes fixed, or remove stale keys when a panel resizes.

## Deferred from: story 1-7-drop-food-and-sheep-eat (2026-10-06)

- **Save validation for the new fields (Story 1.9):** extend the checks listed above.
  - `activity` must be one of the `SheepActivity` values (`wander`, `seekFood`, `eating` today).
  - `targetId`, when present, must be a finite integer. A stale id is already tolerated at runtime: feeding reverts the sheep to `wander`.
  - `farmProgress` must be an integer in `[0, TUNING.farmPipsPerFood)`. Since the 1.7 review, `Farm` resets a bad value on the next click, so a bad value only shows wrongly on the HUD until then. Validation should still reject or clamp it on load.
  - **Resolved in Story 1.9:** `activity`, `targetId` (absent or a positive integer) and `farmProgress` (integer in [0, farmPipsPerFood)) are validated.
- **Pointer input (Story 2.4):** 1.7 first built `idle`-mode pointer clicks (6 px click/drag threshold tracked as the maximum distance, resolved on release at the down point, `pointerupoutside`/`GAME_OUT` disarm, `input` error guards). It was removed when field clicks stopped dropping food (Addendum A). It was never committed, so rebuild it in 2.4 from the design in Story 1.7's Task 9 (9.1–9.4 and 9.7; 9.6, the context menu off, still stands), which the 1.7 browser checks verified. `sheepIndexAt` in `SheepHover.ts` is already shared.
  - **Resolved in Story 2.4:** the 2.3 breed-mode click now arms in both modes; in `idle` a click on a carcass dispatches `ClearCarcass` (hit-tested at the press). The shared hit test is `spriteIndexAt` in `view/field/hitTest.ts`.
- **`food` is gone (Addendum A):** the 1.6 item "Unvalidated `food` in a save" no longer applies.
  - **Resolved in the 1.7 review:** `SAVE_SCHEMA_VERSION` is now 2, so pre-1.7 (version 1) debug saves are rejected outright.

## Deferred from: code review of 1-7-drop-food-and-sheep-eat (2026-10-06)

- **Claims never time out (Stories 1.9, 3.6):** `updateFeeding` releases a claim only when its piece is gone.
  - A piece outside the inner fence (only possible from a corrupt save or a future smaller fence) leaves its seeker pressing on the rail until it starves, while the piece stays claimed.
  - Two full sheep resting on a piece also hold a seeker off: their separation push beats its walk within about 12 px. Today that clears within 4 s, when they stop resting.
  - Fix: Story 1.9 validates piece positions, and Story 3.6 considers a claim timeout.
  - **Resolved in Story 1.9:** the 1.9 part: food pieces must lie inside the inner fence. The claim timeout is still 3.6's.
  - **Story 3.6: not needed (observed).** `tests/sim/scenarios/pile.test.ts` runs 100 sheep at Land III through a 300-piece mixed pile for 120 s: in an ad-hoc run over 8 seeds the longest claim held was 9.8–17.6 s, no longer than the walk across the pen's diagonal (about 17 s at 60 px/s); claims ≈ pieces eaten (250–251 claims for 250 eaten), so none was dropped or stuck. The committed test runs one seed (3606) and fails if a claim outlasts 1.5 × that walk + `eatMs`. Revisit only if a playtest shows a sheep stuck on a piece.
- **Farm bar size defined twice (Story 3.6):** `COMPONENTS.farmProgress.segmentCount` (pips drawn) and `TUNING.farmPipsPerFood` (pips per food) are both 8. `FarmProgress.set` scales between them and the "{n}/8" text always reads the tuning value. If 3.6 retunes the bar, change both, or build the pips from the tuning value.
  - **Resolved in Story 3.6:** `segmentCount` is gone from `COMPONENTS`; `FarmProgress` draws one pip per `TUNING` pip (both bars), and `BottomBar` sizes each bar from its tuning value. The Farm bar is now 6 pips.

## Deferred from: story 1-8-losing-the-flock (2026-10-06)

- **Restart wipes the save (Story 1.9):** Lose → Restart calls `GameScene.newGame()`, which has a marked hook for `saveStore.wipe()` (no confirm; settings must survive, UX-DR89).
  - **Resolved in Story 1.9:** `GameScene.newGame()` stops autosave, then `wipeSave()` (save key only), then restarts.
- **Validating `lostAt` (Story 1.9):** an absent `lostAt` is a game in progress. A present one must be a finite, non-negative integer no greater than `time`; otherwise reject the save. A valid lost save resumes straight to the lose screen: `OverlayScene` shows it at once when it starts on a lost state (verified with a debug Load).
  - **Resolved in Story 1.9:** absent, or an integer in [0, time]. A lost save resumes to the lose screen (browser-verified).
- **Esc and shortcuts on the lose screen (Story 1.10):** the `Esc` chain must do nothing while the lose panel is up (no pause over a lost game), and the modal check that ignores F/G must include it. Today F is already a no-op when lost (`HudScene.farm` and `applyCommand` both guard). The one scrim lives in `OverlayScene` for the pause and confirm modals to reuse.
  - **Resolved in Story 1.10:** the Esc chain's last step swallows the press when lost, `modalOpen` includes the lose screen (F and the Farm click are ignored), and the Pause button sits under the lose scrim.
- **`removeSheep` (Story 2.7, sacrifice; 3.1, sell):** it must end with `checkLastSheepAndLoss(state)`, exported from `systems/carcass.ts`; selling or sacrificing the last sheep is a loss.
  - **Resolved in Story 2.7:** `removeSheep(state, id, 'sold' | 'sacrificed')` in `carcass.ts` counts the stat and ends with the loss check (no carcass, no event of its own). 3.1 emits `Sold` and adds the money.
- **`LastSheep` (Story 5.5):** emit it from `checkLastSheepAndLoss` when the flock drops to 1 (marked comment).

## Deferred from: code review of 1-8-losing-the-flock (2026-10-06)

- **0 sheep without `lostAt` (Story 1.9):** `checkLastSheepAndLoss` runs only from `killSheep`, so a decoded save with `sheep: []` and no `lostAt` runs forever on an empty pen. Validation should run the loss check on load, or reject the save.
  - **Resolved in Story 1.9:** validation rejects it.
- **`lostAt` shape (Story 1.9):** `null` makes `isLost` true while `selectLoseView`'s `??` shows `time`. String, negative or `> time` values pass `decodeSave`. This extends the "Validating `lostAt`" item above.
  - **Resolved in Story 1.9:** `null`, strings, negatives, fractions and values above `time` are rejected.
- **Systems after the loss tick (Stories 2.1, 2.3):** `lostAt` is set inside `updateHunger`, and any system after it in the same `step` still runs. That is harmless while hunger is last. Once lifecycle or births run after hunger, a game could be lost with live sheep: return early from `step` after a loss, or check `lostAt` in those systems.
  - **Resolved in Story 2.1:** `step()` returns after any system that sets `lostAt`, so no later system (lifecycle, births) runs on a lost game.
- **`Button` hide/show in place (Story 1.10):** `setVisible(false)` while hovered never fires OUT, so the hand cursor stays. `setVisible(true)` under the pointer shows no hover until it moves. The lose panel never hides in place, but pause and confirm will.
  - **Resolved in Story 1.10:** `setVisible(false)` while hovered resets the canvas cursor (`input.resetCursor()`). Shown under a still pointer there is no hover until it moves; clicks still work. `setDepth` now moves the hit zone too (found in 1.10: a zone left at depth 0 under a raised scrim never got clicks).

## Deferred from: story 1-9-save-resume-and-hidden-tab-pause (2026-10-06)

- **Load decision moves to the Title screen (Story 1.10):** `PreloadScene` loads the save and starts `GameScene` with it, or with a new game. TitleScene takes this over: show **Continue** only when `loadSave()` (plus `stateCanRun`) succeeds; New Game with a save → start-over confirm → `wipeSave()` → new game. Keep `GameScene` free of storage reads.
  - **Resolved in Story 1.10:** `TitleScene.create` runs `loadSave` → `stateCanRun` → `discardSave` on failure, and shows Continue only for a save that can run. New Game with a save → confirm → `wipeSave` → new game. GameScene still never reads storage.
- **Two pause sources (Story 1.10):** the hidden-tab pause is `GameScene.hidden` (set from Phaser's HIDDEN/VISIBLE game events). The Esc pause needs its own flag beside it; either one stops the clock, and unhiding must not unpause a paused menu.
  - **Resolved in Story 1.10:** `GameScene.paused` (set by OverlayScene) sits beside `hidden`; either stops the clock, and neither handler touches the other flag (browser-verified: hide/show while paused stays paused).
- **Settings store (Story 5.7):** there is no `settingsStore.ts` yet. Add it under `SETTINGS_KEY` with the same pattern as `saveStore` (injected `StorageLike`, try/catch on every access). `wipeSave` already leaves the settings key alone (unit-tested).
  - **Resolved in Story 5.6:** `src/save/settingsStore.ts` (`loadSettings` / `saveSettings`, field-by-field fallback, tested in `tests/save/settingsStore.test.ts`).
- **Music on hide (Story 5.6):** AR25 also pauses music when the tab is hidden; there is no audio yet.
  - **Resolved in Story 5.6:** `AudioDirector` pauses the music on `HIDDEN` and resumes it on `VISIBLE` (only a pause it made).

## Deferred from: code review of 1-9-save-resume-and-hidden-tab-pause (2026-10-06)

- **Two open tabs share one save:** each tab autosaves its own game to `sheepciv.save.v1`, so the last tab to save wins, and Restart in one tab is undone by the other tab's next autosave or hide-save. Deferred (Rylan): rare for this kind of game. Fix when needed: listen for the `storage` event and stop autosaving when another tab writes the key, or put a per-run id in the envelope.

## Deferred from: story 1-10-title-screen-pause-menu-and-start-over-confirm (2026-10-06)

- **Era badge above the modals (Story 3.5):** UX-DR20 and DESIGN Layout keep the era badge visible top-right under the pause and confirm modals. OverlayScene draws above HudScene, so the badge must render in OverlayScene (or above it), not in HudScene, or the 72% scrim covers it.
  - **Resolved in Story 3.5:** `EraBadge` (`view/overlay/`) is drawn in OverlayScene between the scrim (depth 0) and the panels (10); browser-checked visible under pause, a sub-panel, the start-over confirm and the lose screen.
- **Reduced motion (Story 5.7):** the lose screen's 250 ms scrim fade and the title sheep's walks are motion; check them against the reduced-motion toggle when it exists.
  - **Resolved in Story 5.7:** both kept under reduced motion: the scrim fade is a fade, and the title sheep walk like the pasture's (gameplay-style animation).
- **Placeholder panels (Stories 5.4, 5.7, 5.9):** `PlaceholderPanel` stands in for Stats, Volume and Credits (in the pause menu, and Credits on the title). Replace it with `StatsPanel`, `VolumePanel` and `CreditsPanel` (built from `assets/CREDITS.md`).
  - **Partly resolved in Story 5.7:** Volume is `VolumePanel` (`view/overlay/VolumePanel.ts`, its own modal id `'volume'`). Stats (5.4) and Credits (5.9) still use the placeholder.
  - **Partly resolved in Story 5.4:** Stats is `StatsPanel` (`view/overlay/StatsPanel.ts`, modal id `'stats'`). Only Credits (5.9) still uses the placeholder.
- **Stale pointer state across the scrim:** while a scrim is up, the scenes under it get no pointer events (global top-only input), so a HUD button keeps its last hover state until the pointer next moves after the modal closes. A real mouse moves, so it is harmless; a test that teleports the pointer must pass through another point first.
  - **Partly resolved in the 1.10 review:** HUD buttons now clear their hover when a modal opens (`Button.clearHover`), so no stale tooltip, fill or hand cursor comes back. Hover returns once the pointer leaves and re-enters the button.
- **Field camera (Rylan, 2026-10-06; built in 1.10):** right-drag pans the field, pinned to the pen (`view/field/PenCamera.ts`). Later stories must account for it:
  - **2.3:** a right press that never passes 6 px is a right-click. Cancel breed mode in `InputController.update`, where the pan disarms (marked comment).
    - **Resolved in Story 2.3:** any right-click on the canvas (field or bar) cancels breed mode; only a press that began on the field pans. Breed-mode clicks hit-test in world coordinates (`sheepIndexAt` at pointer + scroll).
  - **2.4 / 2.7:** field clicks and sheep drags must hit-test in world coordinates (`camera.getWorldPoint`, as `SheepHover` does), and the sheep drag must not start on a right press.
    - **2.4 part resolved:** carcass clicks hit-test at pointer + camera scroll (as `SheepHover` does, not `getWorldPoint`). The 2.7 drag part stays open.
    - **Resolved in Story 2.7:** the drag picks the sheep at the press (pointer + scroll) and only on a left press.
  - **2.7 / 3.1:** the Better Place and the Market were placed in canvas terms (upper-left x ≈ 450–590; right edge). They are world objects now, so place them relative to the pen, and consider pinning the camera to the pen plus both targets so a drag can always reach them.
    - **2.7 part resolved:** the Better Place is fixed at world (520, 108) (the mockup, clear of the Land I fence). The camera centres on and pins to the play area (pen ∪ `BETTER_PLACE_BOUNDS`); this revises 1.10's "centred on the pen" (2.7 Open Question 1). 3.1 adds the Market to `GameScene.playArea`.
    - **3.1 part resolved:** `playArea` is pen ∪ Better Place ∪ `MARKET_BOUNDS` (the pan limits), but the game still opens centred on pen ∪ Better Place (`PenCamera.centreOn(focus, area)`): centring on all three would put the hole under 3.2's shop panel (3.1 Open Question 1).
  - **3.3:** when the fence grows, re-clamp (or re-centre) the camera; `PenCamera` centres a pen too big to fit.

## Deferred from: code review of 2-1-life-stages-and-the-gdd-starting-flock (2026-10-06)

- **Long dev runs end by ~7 min (Story 2.3):** every sheep now dies of old age by 420 s, and "+10 sheep" gives all ten the same `bornAt`, so they die on one tick 360 s after the click. With no births until Story 2.3, the NFR1 100-sheep, 5-minute run above must start within ~1 min of adding sheep (or re-add them), and nothing can soak longer than ~6 min. Once births exist, or if needed earlier, give the debug overlay a way to keep sheep young (for example a "rejuvenate" button that resets `bornAt`).
  - **Resolved in Story 2.3:** births exist, and the debug overlay's **Ready adults** button makes every adult pickable, so a long run can breed its way on.
  - **Update 2026-10-07:** adulthood was lengthened (Rylan): sheep now die of old age at 540 s, and "+10 sheep" all die 480 s after the click.

## Deferred from: code review of 2-4-carcasses-and-death-announcements (2026-10-07)

- **Old-age toast vs tuning (Story 3.6):** "A sheep died of old age. A long, full nine minutes." is Voice-table copy that matches `TUNING.oldAgeMs` (540 s) only by a comment in `strings.ts`. If 3.6 retunes the lifespan, update the copy (or build the minutes from `TUNING.oldAgeMs`).
  - **Resolved in Story 3.6:** the toast builds its minutes with `formatMinutesInWords(TUNING.oldAgeMs)` (`src/core/format.ts`, tested). The lifespan was kept at 540 s.

## Deferred from: story 2-6-alert-pings-and-threat-summary (2026-10-07)

- **Pings above the shop panel (Story 3.2):** UX-DR10/UX-DR63 keep alert pings (and the other world overlays) above the open shop panel. Pings live in GameScene's world-overlay band (`FIELD_DEPTH.ping`, `src/view/field/depths.ts`), so a shop panel drawn in `OverlayScene` or `HudScene` would cover them. 3.2 must either draw the shop panel in GameScene (screen-fixed, below `FIELD_DEPTH.overlay`, with field clicks over it ignored), or move the world-overlay band into its own scene between the shop and the modals (2.6 Open Question 1).
  - **Resolved in Story 3.2:** option 1. The panel is drawn by GameScene, screen-fixed, in `FIELD_DEPTH.shop` (9 000), below a dragged sheep and the world-overlay band; GameScene treats the open panel as a HUD control, so no field press, pan, hover or target goes through it.
- **A crowded bottom bar (Stories 2.8, 3.2, 3.3, 4.5):** the threat summary takes x 858–1080 (`THREAT_X`, 222 px). The mockup's order puts the Medicine slot, money and flock counters (with separators) in the 588–846 gap, and the boost timer and Shop toggle in the last ~184 px. Both gaps are tight at the mockup's sizes; whichever story overflows first should re-space the bar (for example, shrink `GROUP_GAP` or drop the separators) rather than overlap. `BottomBar` asserts the summary's slot with `invariant`.
  - **Story 2.8:** the boost timer now sits at x 1 092–1 196 (`BOOST_X`, `BOOST_TIMER_W` 104), leaving 68 px to the 1 264 safe edge. `BottomBar` asserts that at least 64 px (`SHOP_RESERVE`) remain for 3.2's Shop toggle (mockup about 80 px). 3.2 must re-space the bar (or narrow the timer) rather than overlap.
  - **Story 3.2:** the right group is packed from the safe edge (Shop 1 184–1 264, boost timer 1 068–1 172, threat summary 834–1 056); money sits at 588–684 after Breed, with a 100 px reserve for 3.3's flock counter. The Medicine slot (4.5) has no room reserved (see the 3.2 section).
  - **Resolved in Story 4.5:** the Farm button is 160 px (was 232), which makes room for the 64 px Medicine slot after Breed: Farm 16–176, Farm Breeding Food 188–388, Breed 400–504, Medicine 516–580 (reserved while hidden), money 592–672, flock 684–804, threat summary 816–1 056. `BottomBar`'s invariant covers the slot; checked at 1280×720 and 960×540. The bar now has no spare pixel before the threat summary: the next widget there needs another re-space.
- **Reduced motion (Story 5.7):** the ping's pop-in and bob (`PING` in `AlertPing.ts`) are juice; under reduced motion the ping should appear at once without bobbing. The ping and its settled dot are information and stay.
  - **Resolved in Story 5.7:** under reduced motion the ping appears at full size with no bob (read per frame, so it stills at once); it still settles to the dot on the same timing.

## Deferred from: code review of 2-6-alert-pings-and-threat-summary (2026-10-07)

- **Four-digit threat counts (Story 3.6):** `ThreatSummary`'s count box is 34 px, sized for "100". Starving and infected are capped by capacity, but carcasses stay until cleared, so 1 000+ uncleared carcasses would draw "1000" into the next slot. Unreachable in normal play; if 3.6 finds it can happen, clamp the text (for example "999+") and re-space the bar.
  - **Story 3.6:** not reached in play; still open, owner "any time".

## Deferred from: story 2-7-drag-a-sheep-into-the-better-place (2026-10-07)

- **The Market (Story 3.1):** add its bounds to `GameScene.playArea` (union with the pen and the Better Place), its armed and hovered highlight next to `BetterPlace.setHighlight`, and the invalid "Too young" target for lambs. `SheepDrag.end` decides the target from the pointer: add the Market test beside `inBetterPlace`.
  - **Resolved in Story 3.1:** `view/field/Market.ts` (`MARKET_BOUNDS`, `inMarket`, `setHighlight('off' | 'armed' | 'hovered' | 'invalid', price)`), and `SheepDrag` sends `Sell` over the stall (a lamb there gets a `Drop`).
- **Fence growth vs the hole (Story 3.3):** the hole is fixed at world (520, 108). The Land I fence (mockup 430–1062 × 184–598) stays clear of it, but check the later tiers, and recompute `GameScene.playArea` (and re-clamp the camera) when the fence grows.
  - **Resolved in Story 3.3:** every tier's fence top stays at y 184, under the hole (`TUNING.landFences`; a DEV invariant in `GameScene` checks it), and `playArea` is rebuilt and the camera re-clamped on a land purchase (`GameScene.growLand`).
- **A victim picked up mid-approach (Story 4.3):** a dragged sheep keeps its sim position (the pickup spot), so the Abomination would walk to where it was picked up. Decide whether a dragged victim is re-picked like a sacrificed one.
  - **Resolved in Story 4.3:** a victim lifted before contact is re-picked on that tick, like one sold or sacrificed, and a dragged sheep is never picked (`abomination.ts` `pickVictim`).
- **The reveal (Story 4.4):** `Sacrificed.wasAbomination` carries the sheep's real `isAbomination` since Story 4.1, but the view still ignores it: the HUD toast and `GameScene.suck` must branch on it only in 4.4.
  - **Resolved in Story 4.4:** `GameScene.suck` plays the true-form flash for the Abomination, and HudScene shows "Good riddance." / "…that was just a sheep." when the ghost lands (`sacrifice:landed`).
- **Audio (Story 5.6):** the `[suction]` caption and SFX on `Sacrificed`.
  - **Done in Story 5.6:** `sfx-suction` and `[suction]` on every `Sacrificed`.
- **Reduced motion (Story 5.7):** the suction spiral (`SUCTION`), the ring spin and hole suck (`BP_MOTION` in `BetterPlace.ts`) and the 4 px lift are juice; the lit rim, glow and label are information and stay.
  - **Resolved in Story 5.7:** under reduced motion the ghost fades out in place (no spin or travel), the ring holds still and the hole neither sucks nor gulps; sparkles, lit rim, glow and label stay. The 4 px lift is the held sheep's "in the hand" pose (`SheepSprite` `LIFT_PX`), a static state, not motion, so it stays.

## Deferred from: code review of 2-7-drag-a-sheep-into-the-better-place (2026-10-07)

- **Stale camera play area (Story 3.3):** `GameScene.playArea` (pen ∪ Better Place) is built once in `create`, so when the fence grows in place the pan clamp and centring still use the old pen. Rebuild it (and re-clamp `PenCamera`) when the land tier changes. `fenceBounds` is constant until then.
  - **Resolved in Story 3.3:** `GameScene.buildPlayArea` rebuilds the focus and `playArea` in `create` and on every land purchase, then `PenCamera.reclamp`.

## Deferred from: story 2-8-sacrifice-food-boost (2026-10-07)

- **Audio (Story 5.6):** a cue when a boost starts (`BoostStarted`). An end cue would need a `BoostEnded` event, which is not emitted (the end is derived from `boostUntil`); 5.6 would add a small system that emits it once when `time` reaches `boostUntil`.
  - **Resolved in Story 5.6 (no cue):** the suction already marks the sacrifice that starts the boost; no `BoostEnded` system was added.
- **Reduced motion (Story 5.7):** the Farm glow pulse (`BOOST_MOTION` in `FarmBoost.ts`), the timer pop (`BOOST_TIMER_MOTION` in `BoostTimer.ts`) and the "×2" float popup are juice. The glow itself, the badge and the timer are information and stay.
  - **Resolved in Story 5.7:** the glow holds at full alpha (re-checked when the HUD unfreezes, so a change in the Volume panel applies on Resume), the timer does not pop, and the "×2" popup fades in place (FloatPopups).
- **Better Hoe (Story 4.7):** raise the base in `farmPipsPerClick(state)` (`selectors.ts`); the boost doubles whatever the base is (2 → 4, 3 → 6).
  - **Resolved in Story 4.7:** `hoeTier(state)` picks `TUNING.hoePipsPerClick[tier − 1]` in place of `farmPipsPerClick`; boosted 4 / 6.
- **Stats panel (Story 5.4):** FR36 lists sheep alive, sold, died, sacrificed and money earned, with no boost count. Leave boosts out unless 5.4 decides otherwise; `stats.sacrificed` already counts every boost started.
  - **Resolved in Story 5.4:** no boost line; the panel shows exactly FR36's five (Alive, Sold, Died, Sacrificed, Money earned).

## Deferred from: code review of 2-8-sacrifice-food-boost (2026-10-07)

- **Validation bounds follow live tuning (Story 3.6):** `validate.ts` caps `boostUntil` at `time + TUNING.boostMs` and `cooldownUntil` at `time + TUNING.breedCooldownMs`. If 3.6 lowers either, saves made mid-boost or mid-cooldown are rejected and the flock is lost. When retuning, clamp these deadlines on load, or validate them against a fixed ceiling, instead of failing.
  - **Resolved in Story 3.6:** `normalizeTuned` (`src/save/normalize.ts`) runs on load between migrate and validate and clamps the bars, boost, cooldowns, gestation and Fullness into the current bounds (an overdue infection dies on the first tick). `validateState` stays strict for `writeSave`. Tested in `tests/save/normalize.test.ts`.
- **Shop toggle space (Story 3.2):** the boost timer kept its 104 px width and `SHOP_RESERVE` is 64 px, below the mockup's ~80 px toggle. 3.2 narrows the timer's padding or re-spaces the bar.
  - **Resolved in Story 3.2:** the bar was re-spaced (above); the toggle is 80 px.

## Deferred from: story 3-1-sell-sheep-at-the-market (2026-10-07)

- **Money counter (Story 3.2):** `state.money` exists (schema 7) but nothing on the HUD shows it; the DEV overlay's sheep line shows the balance and sales until then. 3.2 adds `money` to `HudView` and the `money-counter`, and its DEV "Add money" adds to `money` only (validation does not tie `money` to `stats.moneyEarned`, on purpose).
  - **Resolved in Story 3.2:** `HudView.money` and the `money-counter` (with a roll on change); the DEV overlay's button is "+$100" and adds to `money` only.
- **Land tiers vs the stall (Story 3.3):** the stall is fixed at world x 1100–1260 (`MARKET`, outline from x 1080). Land I ends at x 1062; check that Land II/III never reach x 1080, and rebuild both camera rects (the focus and `playArea`) when the fence grows.
  - **Resolved in Story 3.3:** every tier's fence ends at x 1062, left of the stall (DEV invariant in `GameScene`); both camera rects are rebuilt on purchase.
- **The Abomination stays unsellable (Story 4.1):** `market.ts` relies on `stageOf` reporting the Abomination as a lamb (it never grows past one). Keep it so; the view's "Too young" reads only `PublicSheep.stage`.
  - **Resolved in Story 4.1:** `stageOf` returns `'lamb'` for the Abomination at any age, which also keeps it from breeding and from breeding food. Tested in `market.test.ts` (an elder-aged Abomination is put down unsold) and in the browser (the stall shows "Too young").
- **Names (Story 5.3):** the sold toast says "A sheep sold. $10."; 5.3 puts the name in place of "A sheep", in `halo`.
- **Audio (Story 5.6):** the cash-register ding on `Sold` (UX-DR82), and a caption if captions cover it.
  - **Done in Story 5.6:** `sfx-ding` on `Sold`; no caption (UX-DR88 has none).
- **Reduced motion (Story 5.7):** the outline pulse, awning flap, tag growth and stall nudge (`MARKET_MOTION` in `Market.ts`) and the sale hop (`SALE` in `GameScene.ts`) are juice; the outline, tag and "Too young" are information and stay.
  - **Resolved in Story 5.7:** outline steady at full alpha, no flap, no tag growth, no nudge; the sale ghost fades out in place.
- **An intermittent first drag in the browser probe (investigate any time):** in the scratchpad Playwright probe, about 1 in 10 runs the first drag after the session's first debug Load never starts (the sheep stays put; no command is sent). It happens on the pre-3.1 commit too (2 of 10 runs), so 3.1 did not cause it, and it never happened on a later drag in the same session (10 of 10 fast sales passed). Unknown whether it is the probe's synthetic pointer timing or a real drag-start edge case in `InputController.updateClick`; worth a look with real mouse input.

## Deferred from: code review of 3-1-sell-sheep-at-the-market (2026-10-07)

- **Pending-slot eviction (DEV speed 0 only):** `SheepDrag.settle` lets the oldest of its 4 pending slots go when a fifth release arrives before a tick. If that slot was `leaving` (a sacrifice from 2.7, or a sale since 3.1), the sheep is drawn back at its pickup spot and `begin` no longer refuses it, so it can be grabbed until its queued command removes it. The sim stays consistent (removed once). Only reachable with the debug clock at speed 0; fix by never evicting a `leaving` slot (grow the slots, or refuse the grab) if it ever matters.

## Deferred from: story 3-2-money-and-the-shop-panel (2026-10-07)

- **Land's effect (Story 3.3):** `state.owned` holds the bought Land tiers, but `capacity` and `fenceBounds` ignore it (a 3.2 test asserts that; 3.3 changes it). Grow the fence on `Bought`, put the flock counter in the 100 px reserve after the money counter (`FLOCK_RESERVE` in `BottomBar.ts`), keep the shop's effect strings ("Capacity 10 → 25" …, `strings.ts`) in step with the land capacities (or build them from `TUNING`), and rebuild `playArea` so `PenCamera`'s shop-open inset still fits the larger pen (see the code review note below: if the play area cannot fit right of the panel, it does not stay right of it).
  - **Resolved in Story 3.3:** `landTier`, `capacity` and `fenceBounds` read `owned` (one `TUNING` land table); the fence grows on `Bought`; `FlockCounter` fills the reserve; the land effect strings are built from `TUNING.landCapacities`.
- **Decorations (Story 3.4):** the Flower Patch and Scarecrow can be bought (they show "Owned"); 3.4 draws them from `owned`.
  - **Resolved in Story 3.4:** `Decorations` (`view/field/`) draws each owned decoration at a fixed spot above the fence, from `owned` on load and with a pop-in on `Bought`.
- **The Medicine slot (Story 4.5):** no room is reserved in the bar (Breed ends at 576, money starts at 588). 4.5 re-spaces the read-outs (8 px gaps, narrower boxes, or moving money and the flock reserve right into the ~30 px spare before the threat summary). Medicine is a repeatable row with its own dose count; never put it in `owned`.
  - **Resolved in Story 4.5:** see "A crowded bottom bar" (Farm narrowed to 160 px). Doses live in `GameState.medicine` (schema 11); the panel lists `SHOP_ROWS` (`SHOP_ITEMS` + `'medicine'`), and `SHOP_ITEMS` stays one-time items, so save validation still rejects `'medicine'` in `owned`.
- **More rows (Stories 4.5, 4.7, 4.8):** each row adds 60 px to the panel (`ShopPanel.ts`); with all 9 rows its top reaches y ≈ 14 and meets the Pause button (16–56). Shrink the row gap and padding, or move Pause. Append the new items to `SHOP_ITEMS`, `ShopItemId`, `shopPrice`, the strings and `SHOP_ICON`, and extend the save validation.
  - **Story 4.5:** 6 rows now (Medicine last, via `SHOP_ROWS`); the panel top is at y 194. 4.7/4.8 add their one-time items to `SHOP_ITEMS` (so they land before Medicine), 3 more rows → top ≈ y 14, which meets Pause: still open for them.
  - **Resolved in Story 4.7 (Rylan, 2026-10-09):** rows 56 → 50 px (a DESIGN.md deviation, noted at `COMPONENTS.shopItemRow`); the geometry moved to `view/field/layout.ts` (`shopPanelHeight`/`shopPanelTop`, `SHOP_PANEL_MAX_ROWS` = 9), and `tests/view/field/layout.test.ts` checks 9 rows clear Pause. 8 rows today: top y 122; with 4.8's Auto-feeder: y 68 (4 px spare). 4.8 must also classify the Auto-feeder for the "exactly one of Land, decoration or Better Hoe" test (`selectors.test.ts`).
  - **Resolved in Story 4.8:** the Auto-feeder is the 9th row (top y 68, browser-checked at 1280×720 and 960×540) and is classified in that test (`item === 'autoFeeder'`).
- **Audio (Story 5.6):** a purchase sound on `Bought`.
  - **Done in Story 5.6:** `sfx-ding` on every `Bought`.
- **Reduced motion (Story 5.7):** the money counter's roll (`MONEY_MOTION` in `MoneyCounter.ts`) is juice; show the new balance at once.
  - **Resolved in Story 5.7:** the new balance shows at once.
- **The panel appears at once (Story 5.8):** DESIGN's "rises from the bottom bar" is its position; a slide-up on open is optional juice.
- **Hunger test timeout under load (any time):** `tests/sim/systems/hunger.test.ts` "every half-point start value …" steps about 120 000 ticks. It takes 1.1–1.6 s alone, but under heavy machine load (load average 7–8 from repeated full runs and browser probes) the whole suite pushes it past Vitest's 5 s default timeout; it passes on a quiet machine. Give it an explicit timeout or fewer start values if it fails in CI.
  - **Resolved in Story 3.3:** it failed 1 run in 3 under load during 3.3, so it now has its own 30 s timeout (`tests/sim/systems/hunger.test.ts`).

## Deferred from: code review of 3-2-money-and-the-shop-panel (2026-10-07)

- **The open shop vs a wide play area (Story 3.3):** with the shop open, `PenCamera` keeps the play area right of screen x 392, which leaves 872 px. Today's play area is 834 px (pen ∪ Better Place ∪ Market). If 3.3's land makes it wider, `clamp` takes its too-big branch and centres it: the left edge lands at about screen x 828 − w/2 (for w = 1000, x 328), so the Better Place sits under the panel, drops there count as HUD drops (no sacrifice), and horizontal panning stops. 3.3 must choose: narrow or close the shop when the pen is too wide, let the panel cover the hole, or shrink what the play area must keep in view.
  - **Resolved in Story 3.3:** the play area fits one screen at every tier, and with the shop open `PenCamera` keeps only the Better Place right of the panel (the pen may slide under it). The opening view uses that limit too, so opening the shop never moves the camera.
- **Performance re-check (Story 3.6 / 5.11):** 3.2's FPS check ran on a loaded machine (the pre-story commit itself read 30–41 FPS at 103 sheep). Shop open vs closed was about 1 FPS apart in alternating runs; re-measure the 40 FPS baseline against shop open on a quiet machine.
  - **Story 3.6:** not measured (no FPS numbers came back from the session). Moved to **5.11**. The sim side is covered: `npm run bench` puts the tick at ≤ 0.21 ms mean with 100 sheep and a 300-piece pile.
- **Docs for the numbers font and the money counter (docs pass, any time):** Rylan chose before 3.2's review to drop the money counter's coin (just "$n") and to set all numbers in Nunito (`numeric` 800, `popup` 900; shop prices and the Market tag use `numeric`) because Pixelify Sans digits were hard to read. DESIGN.md (`money-counter` `iconColor: hay`; `numeric`/`popup` in Pixelify Sans), epics.md UX-DR3/UX-DR34 and Story 3.2's AC 1 / Tasks 3.1, 6.2, 9.1 still describe the old design. Decision (Rylan, 2026-10-07): update them in a later docs pass, not in 3.2.

## Deferred from: story 3-3-buy-land-and-grow-the-fence (2026-10-07)

- **Crowded flock counter (Story 4.6):** UX-DR35's crowded style (numbers in `alert` and a crowd icon at ≥ 90 % of capacity) is not built; `FlockCounter.set` gets `alive` and `capacity`, so 4.6 adds the style there with the overcrowding rule.
  - **Resolved in Story 4.6:** `FlockCounter.set(alive, capacity, crowded)` from `HudView.crowded` (the same `crowdedAt` rule as the roll): the numbers turn `alert` and the crowd icon (`icon-crowd`) takes the sheep icon's place, so the counter keeps its width (12 px spare before the threat summary).
- **"No room. Buy land." at Land III (Voice decision, any time):** when the flock fills Land III's 100 slots there is no land left to buy, but the Breed tooltip still says "Buy land." The Voice table has no other string; a later copy pass may add one (for example "No room.") for that case (`breedBlock` would need to tell the two apart, e.g. via `landTier(state) === 3`).
- **The Land III pen is dense (Story 3.6):** to fit one screen, Land II/III grow only left and down, so Land III gives about 3.7 k px² per sheep against Land I's 7.4 k. 100 sheep fit the sim (24 px spacing) but overlap visually. If 3.6 finds it too crowded, the alternatives are a bigger world with panning (the Market would move with the fence, and dragging would need edge-pan) or a per-tier camera zoom (Story 3.3 Open Question 1).
  - **Story 3.6:** no change requested in the playtest (Rylan: "everything looks good"). Left as is; revisit if the external playtest (5.10) finds it crowded.
- **Pieces under the open shop (Story 3.6 / 5.x):** at Land II/III the open panel covers the left of the pen, and food or breeding pieces can drop there (pings still draw above the panel). Harmless, since sheep reach them and the panel is transient; revisit if playtests show players missing them.
  - **Story 3.6:** no problem reported in the playtest. Left open for 5.10.
- **Audio (Story 5.6):** a cue when land is bought (the fence grows; `Bought` with a land item).
  - **Done in Story 5.6:** land is a `Bought`, so it dings like any purchase.
- **Reduced motion (Story 5.7):** the dust burst along the new fence (`GameScene.growLand`) is juice; the grown fence is information and stays.
  - **Resolved in Story 5.7:** kept: small particle bursts stay under reduced motion (the Keep/Off rule in the 5.7 story).

## Deferred from: code review of 3-3-buy-land-and-grow-the-fence (2026-10-07)

- **Camera fit has no `npm test` coverage (Story 3.6):** the guarantee that every land tier's play area fits one screen (and stays clear of the Market and the Better Place) is a DEV-only invariant at `GameScene` module load, which Vitest never imports. The slack is 4 px wide at Land III and 0 px tall at Land II/III. A 3.6 retune of `TUNING.landFences` must re-run the DEV build, or add a config-level fit test with the view rects as plain numbers.
  - **Resolved in Story 3.6:** the field layout moved to the Phaser-free `src/view/field/layout.ts`; `layoutProblems()` runs in `tests/view/field/layout.test.ts` and as GameScene's DEV invariant.

## Deferred from: story 3-4-decorations (2026-10-07)

- **Era badge vs the Scarecrow (Story 3.5):** the badge sits top-right of the field (screen x ≈ 1100–1264, y 16–56); at the Land II/III scroll (y 56) that is world y 72–112, x ≥ 1112, clear of the Scarecrow (world 980–1020 × 112–176) by the numbers. Check it on screen at every tier when the badge is built, shop open and closed.
  - **Resolved in Story 3.5:** the badge spans screen x 1104–1264; at every tier's scroll range (x 12–426) the Scarecrow is at screen x ≤ 1008, and the browser checks showed both decorations clear of it in all four eras.
- **Era backgrounds (Story 3.5):** draw the era art below `FIELD_DEPTH.ground`, so the decorations (depth = foot y, about 176) stay above it. Their spots (`DECORATION_SPOTS`, the grass strip above the fence between the Better Place and the Market) stay the same in every era; check that each era's art leaves that strip readable.
  - **Resolved in Story 3.5:** `EraBackground` draws at `FIELD_DEPTH.background` (−100), and the era art keeps the decoration spots plain grass (era features stay out of them); both decorations were browser-checked readable in all four eras.
- **Audio (Story 5.6):** the purchase sound on `Bought` covers decorations too; no separate cue is needed.
  - **Done in Story 5.6:** as planned, the `Bought` ding.
- **Reduced motion (Story 5.7):** the decoration pop-in (`POP` in `Decorations.ts`) and its dust puff (`GameScene.decorationBought`) are juice; under reduced motion show the decoration at once.
  - **Resolved in Story 5.7:** the decoration shows at once; its dust puff (a particle burst) stays.
- **Real art (Story 3.6 / 5.x):** the flower patch (28×14) and scarecrow (20×32) are placeholders. Free-pack art must keep these sizes, or update `FRAME_SIZE`/`DECORATION_SPOTS` in `Decorations.ts`; the DEV checks (frame size, and the layout invariant in `GameScene`) catch a mismatch. Like the land fit (3.3), the decoration layout invariant is DEV-only and not covered by `npm test`.
  - **Story 3.6:** out of scope for the tuning pass; moved to **5.x** (5.8 juice/polish or an art pass).

## Deferred from: code review of 3-4-decorations (2026-10-07)

- **Decoration layout checks are DEV-only (Story 3.6 / any time):** the decoration spot invariant (`GameScene`) and the frame-size check (`Decorations.build`) run only when a DEV build loads `GameScene`; `npm test` never imports view modules. As with 3.3's camera fit, a retune of `landFences` or new decoration art must re-run the DEV build, or the rects could move to a plain-data module with a config-level test.
  - **Resolved in Story 3.6:** the decoration spot checks are part of `layoutProblems()` (npm test). The atlas frame-size check stays DEV-only (it needs the loaded texture).

## Deferred from: story 3-5-eras-and-their-transitions (2026-10-08)

- **Audio and captions (Story 5.6):** the era fanfare on an advance and the soft descending note on a regress, with their `[fanfare]` / `[descending note]` captions (UX-DR83, UX-DR88). Hook them to `EraChanged` the way the banner is: once per frame (HudScene's first `from` / last `to`), so ×16 changes play one cue.
  - **Done in Story 5.6:** HudScene emits `era:announced { regress }` from its once-per-frame fold; AudioDirector plays `sfx-fanfare` / `sfx-descend` and the captions.
- **Reduced motion (Story 5.7):** the era banner's slide-in (`ERA_BANNER_MOTION` in `EraBanner.ts`) becomes a fade. Decide whether the 1 s background crossfade (`ERA_FADE_MS` in `EraBackground.ts`) stays; it is slow and gentle, so it may.
  - **Resolved in Story 5.7:** the banner fades in in place over `slideMs`; the 1 s background crossfade stays (a slow fade, not movement).
- **Real era art (Story 3.6 / 5.x):** the four backgrounds (`assets/art/backgrounds/`) are placeholders. Free-pack art must stay 864 × 344 (shown at 2× from world (0, −16)) or `ERA_BACKGROUND_BOUNDS` changes; the build-time size check and the DEV frame-size check catch a mismatch. Only four strips of each texture are drawn (`STRIPS` in `EraBackground.ts`: the far line along the top, the top band left of the Better Place and between it and the Market, and everything right of the Market); the rest must stay flat `pasture`, which the camera's clear colour stands in for. `npm run assets` rejects a background that is not 864 × 344, and a DEV check (`flatOutsideStrips`) rejects art outside the strips that is not exactly `pasture`. That cut the probe's FPS cost from about 10 to within noise. Keep the decoration spots plain inside the mid strip. A real GPU would draw a full-field image cheaply; if real art wants texture everywhere, re-measure on real hardware first.
  - **Story 3.6:** out of scope for the tuning pass; moved to **5.x**.
- **Era thresholds (Story 3.6):** `TUNING.eraThresholds` (10 / 25 / 50) equals the first three land capacities on purpose (GDD: enter each era at full capacity). A pacing retune changes both tables together, or logs why they part (a config test pins them equal today).
  - **Resolved in Story 3.6:** kept at 10 / 25 / 50, equal to the land capacities (decision log 2026-10-08).
- **Coverage is DEV-only (Story 3.6 / any time):** like the 3.3 fit and 3.4 decoration checks, the background coverage invariant (`GameScene`, via `PenCamera.viewExtent`) runs only in a DEV build. A retune of `landFences`, the camera limits or the art must re-run the DEV build.
  - **Resolved in Story 3.6:** the background coverage check is part of `layoutProblems()` (npm test); the art checks (`flatOutsideStrips`, frame size) stay DEV/build-time.
- **Banner flicker at a threshold (playtest, any time):** a flock hovering at 9/10 replays the banner each time it crosses (the sim emits every change, as the epic AC requires; the view only coalesces within a frame). If playtests find it noisy, add a view-only cooldown on the banner, with the background and badge still following at once (Story 3.5 Open Question 2).
- **The banner covers the Market's awning for ~2.7 s (UX, any time):** the band (canvas y 160–248) crosses the upper field, where the Market's awning sits at the opening scroll. A drop on the stall still works (the banner is not interactive), but the stall is partly hidden while it shows. Move the band up or shorten the hold if playtests find it in the way (Story 3.5 Open Question 3).
- **The era at the loss (UX, any time):** *Resolved in the 3.5 code review:* on `Lost`, the badge and background follow `currentEra` (0 sheep → Pasture), so the live and reloaded lose screens match. Original note: the losing tick emits no `EraChanged` (AC 2), so a flock wiped out at once in the Village keeps the Village background and badge under the lose screen, while a lost save loaded later shows Pasture (the derived era of 0 sheep). Both are honest; if one is wanted, OverlayScene can set the badge (and GameScene the background) to `currentEra` on `Lost`.

## Deferred from: code review of 3-5-eras-and-their-transitions (2026-10-08)

- **Mid-fade reversal snaps (playtest, any time):** `EraBackground.fadeTo` snaps a running fade to its target before starting the next (Story 3.5 Task 4.1), so an era that flips back within 1 s jumps to the full previous art. At ×16 with a full flock sitting on a threshold (thresholds equal capacities) this can flicker between eras every frame or so. Revisit with the banner-flicker note: e.g. reverse the running tween instead of snapping, or a view-only cooldown.
- **Badge fit vs the fallback font (any time):** `EraBadge`'s DEV fit invariant (like `BoostTimer`'s) measures text in whatever font loaded; after a Pixelify Sans timeout, "Wool Empire" in the fallback font could exceed the 160 px pill and throw in `OverlayScene.create` (DEV), or overflow (production). Measure against a font-independent bound, or skip the check when the font failed.

## Deferred from: story 3-6-mvp-pacing-playtest-and-tuning-pass (2026-10-08)

- **Town needs fast clicking in the Must tier (Stories 4.7, 5.10):** with the tuned 6/8 pips and Land I at $80, the scripted reference player (no boosts, no Better Hoe) reaches Town at 12:26–14:30 at 6 clicks/s over 6 seeds (12:08–12:49 at 7); at 3–5 clicks/s the flock plateaus at 14–23 (feeding plus replacing old-age deaths). The 10–15 min guard at 6 clicks/s has about 30 s of margin on the slowest seed. Rylan kept Better Hoe in Should. When 4.7 lands, re-run `tests/sim/scenarios/pacing.test.ts` with a Hoe-buying policy, and check in the external playtest (5.10) whether real players reach Town with the boost.
  - **Re-run in Story 4.7:** see "The Town pacing guard is skipped" below. Better Hoe does not rescue Town for the scripted player.
- **No human session times (Story 5.10):** Rylan waived recording per-run times in the 3.6 code review (AC 1 / AC 6). The pacing was validated by the scripted probe only. The external playtest should paste one **Copy results** text per tester (the DEV overlay records milestones across reloads) and compare them with the probe.
- **A rare 13–15 ms sample in the tick bench (any time):** the "300 food · first tick" case showed one 13–15 ms sample out of 400 in 3 of the 4 runs made in Story 3.6 (means 0.17–0.21 ms, p99 ≤ 0.9 ms). It appears in the first pile case, right after the bench builds its 400 cloned states, so it is likely a GC pause in the harness (inference). Watch for it in the browser's tick line (`worst`) during 5.11.
- **GameScene's DEV tick counters ship (any time):** `takeTickStats` and its three number fields are in the production bundle (like the other GameScene debug members); the timing branch itself is stripped. Harmless; remove with the rest of the debug API if it is ever split out.
- **Bar width (any later retune):** a pip bar may never run past its button (`BottomBar` DEV invariant since the 3.6 code review): the breeding bar fits up to 9 pips under its 200 px button, the Farm bar up to 11 under 232 px. A larger retune narrows `PIP_W` in `FarmProgress` or widens the button.

## Deferred from: code review of 3-6-mvp-pacing-playtest-and-tuning-pass (2026-10-08)

- **Load-time clamping skips fence, lifespan and capacity retunes (any retune of those):** `normalizeTuned` clamps the bars, boost, cooldowns, gestation, Fullness and an overdue infection, but positions are still validated against the live `TUNING.landFences`/`fenceInset`. Shrinking a fence or raising the inset would reject saves with a sheep, piece, pregnancy or carcass near the old edge. Lower `oldAgeMs`/`elderFromMs` or `landCapacities` load fine today (the sim handles them), but are untested. Add position clamping into the inner fence (and a test) in the story that retunes a fence.
- **Bench GC sample:** see "A rare 13–14 ms sample in the tick bench" above; the first-tick pool is allocated in the bench setup, so a GC pause can land in a timed sample.

## Deferred from: story 4-1-the-abomination-is-born-and-stays-hidden (2026-10-08)

- **The Town pacing guard is skipped (Stories 4.3, 4.7):** with the Abomination in, `pacing.test.ts`'s "reaches Town in 10–15 min at TOWN_CPS" failed on seed 11 (15:46). Over seeds 1–40 at 6 clicks/s: mean 14.03 min with 3/40 over 15 before 4.1, mean 14.26 with 5/40 over after. At 7 clicks/s all 40 land in 12.5–14.2 min, but guard seed 3606 sits at 14:56. Rylan chose to skip the guard (`it.skip`, with the reason in the test) and re-check pacing once the kill cycle (4.3) and Better Hoe (4.7) are in: re-enable it then, with a Hoe-buying policy, a new reference rate or a retune. The Village guard and the report table still run.
  - **Re-checked in Story 4.7 (2026-10-09); still skipped (Rylan's default):** the probe gained a hoe policy (`{ hoe: true }`: up to Land I it plays as before; after Land I it sells elders as they age and buys Hoe I, then II; the code review fixed a loop that could never buy II, and Rylan chose elders-after-Land-I so the runs match until then). Seeds 3606 / 11 / 2026 at 6 cps: Town 19:53 / 16:13 / lost 6:57 (seed 3606 without the policy: 17:51); Hoe I at 17–19 min where bought at all; Hoe II never, because $100 of $5 elders does not arrive by 20 min. The elder sales also cost flock (seed 3606 at 2 cps loses at 17:58 with the policy, survives without). The bot's only money is sales and every sale costs flock, so the hoe comes too late to matter. A first policy that sold breeders for Hoe I at the first full pen had it by 3:30 but lost on 11 of 12 runs. Open for Rylan / 5.10: whether money should come from something other than sales, or the hoe be cheaper, or Town's window move.
- **Secrecy lint covers `isAbomination` only (Story 4.3):** `SECRECY_SYNTAX` blocks `isAbomination` outside sim, debug and save, but not `state.abomination` (birth counts) or the `stalk` field 4.3 adds. 4.3 should decide whether to add both selectors; until then review catches view reads.
  - **Resolved in Story 4.3:** the rule also blocks `stalk`, `doomedAt`, `nextKillAt` and member reads of `.abomination` (not the `abomination` property key, which `DeathCause` maps use). Probed: it fires in `src/view/` and `src/input/`, never in sim, debug or save.
- **Old saves count births from their load (by design):** the 8 → 9 migration sets `birthsSeen: 0`, so a pre-Epic-4 save's first Abomination comes 8–15 births after loading (births before the save are not recorded).
- **GameScene's `debugSheepDrawnAt` ships (any time):** like `debugMutate` and the tick counters, it is in the production bundle. It takes an id and returns a sprite position, so it reveals nothing. Remove it with the rest of the debug API if that is ever split out.
- **The Reveal ring is placed after render (DEV only):** `syncOutline` runs on `POST_RENDER`, so the ring shows where the sprite was drawn one frame earlier (under 1 px at walk speed; the browser probe measured 0 px at rest). Harmless for a debug aid.

## Deferred from: code review of 4-1-the-abomination-is-born-and-stays-hidden (2026-10-08)

- **The busy save fixture depends on its seed (any time):** `busyGame` reaches its "busy" state (seekers walking to pieces, and so on) through a seeded 1 s run, so any change to the rng draw order can need a new seed. Story 4.1 moved it from 31337 to 31339. Building the busy conditions directly (e.g. placing seekers far from their pieces) would make it robust.

## Deferred from: story 4-2-the-abominations-tells (2026-10-08)

- **Title-screen sheep do not walk-animate (Story 5.8):** `TitleFlock.ts` tweens its three sheep on their idle frame. Giving them the walk cycle is polish.
- **The walk is two beats only (Story 5.8):** one step frame per pose. Eating/munching frames and a fuller multi-frame walk (the GDD sprite set) are still polish; the off-step must stay readable against whatever 5.8 adds.
- **The off-step's values await a real playtest (Story 5.10):** `GAIT` (long/short 1.6/0.4, a 2 px dip) was checked by a browser probe (rhythm and dip measured) but not by a person watching. GDD success metric: at least one tester spots the Abomination unprompted; if not, exaggerate the off-step first (GDD Risks #2).
- **The flock's gap is modest while everyone walks (Story 5.10):** resting sheep settle about 36 px from it (24 from each other), but in a crowded walking pen its mean nearest-neighbour distance is only about 1–7 px wider than the same lamb's unflagged (`tests/sim/scenarios/abominationTells.test.ts`), because walkers press in at the walk-speed cap. Revisit with the off-step if the playtest finds the tell too subtle.
- **Approach and contact for the kill cycle (Story 4.3):** the Abomination feels only the normal 24 px from other sheep, so walking up to a victim it is held off at about `24 × (1 − 1/separationWeight)` = 8 px (and the victim is pushed away at up to 36 px). Define "contact" at or beyond that distance, or let the stalk ignore separation, so the approach can finish.
  - **Resolved in Story 4.3:** contact is at `abominationContactPx` (30), between 24 and 36, so the approach finishes without a chase (max approach 7.3 s over 8 seeds × 4 min in a scratchpad probe of the same setup; the committed `killCycle.test.ts` runs 4 of those seeds) and separation is unchanged.

## Deferred from: story 4-3-the-kill-cycle (2026-10-08)

- **The pacing bot cannot survive the Abomination (Stories 4.7, 5.10):** at Village the probe sells 8 of its 10 sheep to buy Land I. The Abomination arrives about then (seed 3606: by 6 min), and a 2–4 sheep flock cannot out-breed a visit every ~50 s. By 14 min only the Abomination is left, and the bot (which never sacrifices) fed it to the 20 min limit; since the code review's loss rule (only the Abomination left = lost) it lost there instead (about 12 min at every rate), so the bot now sacrifices the Abomination after its 2nd victim dies (Rylan's choice; `SPOT_AFTER_VISITS`, it reads the secret flag as a stand-in for spotting the tells). With that, seed 3606: Village unchanged, no loss at any rate, Town at 6 cps 18:00 (was 14:57 before 4.3). The 4.7 re-check starts from there. Village times are unchanged (5:13 / 4:03 / 3:41 / 3:30 at 2/3/5/6 cps), and the Village guard passes. Town is no longer reached at any rate (6 cps was 14:57). The Town guard stays skipped. The 4.7 re-check needs a probe policy that removes the Abomination the way an attentive player would (the bot may read `isAbomination`, after a delay that models spotting the tells), or a decision on the kill rate in small flocks.
  - **Story 4.7:** the re-check ran with `SPOT_AFTER_VISITS` unchanged; the flock still collapses after selling 8 of 10 for Land I, and Better Hoe does not change that (see "The Town pacing guard is skipped"). Still open for 5.10 / Rylan.
- **Death sounds must not tell the cause (Story 5.6):** `SheepDied.cause` is `'abomination'` for a victim. The death SFX and the `[thud]` caption must be the same for every cause; the cause only picks the toast (already vague).
  - **Done in Story 5.6:** `sfx-thud` and `[thud]` for every `cause`.
- **Stats by cause (Story 5.4):** the Stats panel may count deaths, but never an "Abomination" line (UX-DR64). Count `abomination` deaths with the rest.
  - **Resolved in Story 5.4:** one Died line, no causes; an Abomination victim counts there, a sacrificed Abomination in Sacrificed (`tests/sim/scenarios/stats.test.ts`).
- **Names in the victim toast (Story 5.3):** "{name} just… fell over." once names exist (`DEATH_TOAST.abomination` today reads "A sheep just… fell over.").
- **A pending doom survives the reveal (Story 4.4):** sacrificing the Abomination does not cancel a victim's doom (FR31: the victim dies 5–10 s after the visit). If 4.4 wants catching it to save the last victim, cancel `doomedAt` there.
  - **Decided in Story 4.4:** kept. The doom still lands (no payout beyond the boost, FR33); `abomination.test.ts` "still lands after the Abomination is sacrificed".
- **The visit's feel awaits a playtest (Story 5.10):** `abominationContactPx` 30, `abominationLeaveMs` 2 s and `abominationApproachMaxMs` 20 s are assumptions, checked by the browser probe (contact at 25–28 px, a still 1 s linger, no toast or event until the death) but not by a person watching.
- **No ring on the doomed sheep (DEV, optional):** the overlay's readout names the doomed sheep and its time left; a Reveal ring on it (Task 6.4, optional) was not added.

## Deferred from: code review of 4-3-the-kill-cycle (2026-10-08)

- **`stalk` ⇔ `stalking` is a hard validation rule (Stories 4.6+):** validation rejects a stalk without the `stalking` activity (or the reverse). A future system that changes the Abomination's activity without deleting `stalk` (e.g. a forced activity) would autosave fine but then fail to load, while the sim only logs an `invariant`. If that becomes possible, repair it in `normalizeTuned` (drop the stalk / set `wander`) instead of rejecting.

## Deferred from: story 4-4-sacrifice-reveal (2026-10-08)

- **Audio and captions (Story 5.6):** the screech, then the sting, on `Sacrificed { wasAbomination: true }` (UX-DR81), started with the true-form flash (`GameScene.revealTrueForm`), and the `[screech]` caption (UX-DR88). The `[suction]` cue stays on every sacrifice (deferred from 2.7).
  - **Done in Story 5.6:** screech at once with `[screech]`, then the sting delayed by the screech's length, in the frame the flash starts.
- **Reduced motion (Story 5.7):** the reveal's swell and shake (`REVEAL.swellScale`, `REVEAL.shakePx` in `GameScene.ts`) are juice and go; the flash itself is information (the truth) and stays.
  - **Resolved in Story 5.7:** no swell or shake under reduced motion; the true-form flashes stay.
- **Names in the reveal (Story 5.3):** "…that was just {name}." (and "{name} went to a Better Place."), the name in `halo`.
- **True-form art (Story 5.8, optional):** the true form is a `void` FILL silhouette of the lamb frame; the GDD art list has no true-form sprite. Art could replace it.
- **The reveal's feel awaits a playtest (Story 5.10):** `REVEAL` (3 flashes × 110 ms, swell ×1.35, 3 px shake) and the two toasts per sacrifice were checked by a browser probe, not by a person watching.
- **An early reveal toast on ghost reuse (any time):** there are 3 pooled ghosts. A 4th sacrifice or sale while 3 are still playing reuses the oldest, which sends its reveal toast at once instead of at its landing (the probe's 4-in-one-frame case: "Good riddance." came first). Rare by hand; more ghosts would avoid it.

## Deferred from: code review of 4-4-sacrifice-reveal (2026-10-08)

- **Ghost reuse cuts the reveal short (any time; Story 5.8 polish):** the 3 round-robin ghosts are shared with sales (`GameScene.sold`), so 3 more sacrifices or sales within the Abomination's ~1.06 s reveal reuse its ghost: `killTweensOf` drops the flash and spiral, and "Good riddance." is sent at once. Picking an idle ghost first, or a larger pool, would avoid it. Complements the "early reveal toast on ghost reuse" entry above.

## Deferred from: story 4-5-medicine (2026-10-08)

- **Audio (Story 5.6):** a cure sound on `Cured`, and pick-up / put-back sounds for the dose; a caption only if 5.6's caption list grows (UX-DR88 has no cure cue).
  - **Done in Story 5.6 (cure only):** `Cured` plays a brighter pop; dose pick-up / put-back sounds are not added (re-deferred to 5.8).
- **Reduced motion (Story 5.7):** the bottle's ×1.2 over an infected sheep is the only drop cue (information, keep it); the cure sparkle (`CURE_SPARKLES` in `GameScene.ts`) is juice.
  - **Resolved in Story 5.7:** the ×1.2 stays (information); the cure sparkle (a small particle burst) stays too.
- **Art (Story 5.8):** the bottle is a placeholder from the mockup's `g-bottle` glyph (`assets/art/ui/icon-medicine.png`); a pack sprite can replace it at the same 12×16. The slot's count is 18 px (the mockup's 20 px does not fit "×99" with the bottle in the 64 px tile).
- **No cure stat (Story 5.4):** FR36 lists alive, sold, died, sacrificed and money earned; none was added for cures.
- **Overcrowding (Story 4.6):** its infections use `infectSheep`, so medicine cures them with no extra work.
  - **Resolved in Story 4.6:** confirmed by `tests/sim/scenarios/overcrowding.test.ts` (an overcrowding infection is cured by `ApplyMedicine`).

## Deferred from: code review of 4-5-medicine (2026-10-09)

- **Slot press uses `activePointer` (any time; touch support):** `'medicine:pressed'` carries no payload, so `InputController.onMedicinePress` arms from `input.activePointer`, as `'breedTool:pressed'` does. With multi-touch another finger could be the active pointer. Passing the pointer id/x/y/downTime in the bus payload would fix both.
- **No hover on a slot that reappears under a still pointer (Story 5.8 polish):** turning the slot's zone back on (a dose bought, or `owned` back above 0) sends no pointer-over until the pointer moves, so no tooltip or hand cursor until then. A re-hit-test when the zone is enabled would fix it; the same applies to any re-enabled zone.

## Deferred from: story 4-6-overcrowding (2026-10-09)

- **Audio (Story 5.6):** no cue when the flock becomes crowded (UX-DR88 lists none); an overcrowding infection sounds like any infection.
  - **Resolved in Story 5.6:** as planned, no crowd cue; an infection is silent (its ping carries it).
- **Playtest (Story 5.10):** watch whether players notice the red flock counter before the first roll, and whether 20 % every 30 s bites at era entry as intended (decision log "Overcrowding at era thresholds"). The clock runs from new game, so a flock that turns crowded just before a deadline can roll within a second; the alternative (a clock that starts when crowding starts) was Story 4.6 Open Question 1.
- **No stat (Story 5.4):** FR36 has no count of overcrowding infections; none was added.
- **Art (Story 5.8):** the crowd icon is a placeholder (`assets/art/ui/icon-crowd.png`, 14×12: two overlapping sheep in the DESIGN.md palette); a pack sprite can replace it at the same size.
- **Tests that opt out:** `tests/sim/scenarios/abominationTells.test.ts` sets `nextOvercrowdRollAt` far ahead (21 sheep in the 10-sheep pen are crowded, and a roll would perturb its paired spacing runs), as it already does for the kill cycle.

## Deferred from: story 4-7-better-hoe-upgrades (2026-10-09)

- **Art (Story 5.8):** the hoe icons are placeholders (`assets/art/ui/icon-hoe.png`, `icon-hoe-2.png`, 14×14: a diagonal handle with the blade bent at its end; II has a bigger steel blade). A pack sprite can replace them at the same size; they also show on the Farm button (`hay` fill), so keep them readable there.
- **Audio (Story 5.6):** no hoe-specific sound; the purchase sound on `Bought` (already deferred) covers it.
  - **Done in Story 5.6:** the `Bought` ding.
- **Playtest (Story 5.10):** whether players buy Better Hoe I early, whether they notice the hoe on the Farm button, and whether Town is reachable at a human rate with hoe + boost (the scripted player says not by itself, see "The Town pacing guard is skipped").
- **The hoe icon has no tooltip of its own (any time):** the Farm tooltip stays "Farm: fill the bar for 1 food (F)" (sprint change 2026-10-06, R4). If players do not connect the icon to the shop row, a tooltip line such as "Better Hoe II: 3 pips per click" would need Voice-table copy.

## Deferred from: story 4-8-auto-feeder (2026-10-09)

- **Audio (Story 5.6):** no drop sound for the feeder's pieces (a soft one, or none); the purchase sound on `Bought` is already deferred.
  - **Resolved in Story 5.6:** no drop sound (`FoodDropped` is silent, and eating is silent too: the munch and the hunger bleats were cut after implementation at the product owner's request).
- **Art (Story 5.8):** the feeder icon is a placeholder (`assets/art/ui/icon-feeder.png`, 14×14, from the mockup's `g-feeder` glyph). An optional feeder sprite in the pasture: today the only feedback is the row's "Owned" and the pieces bouncing in beside the hungriest sheep.
- **Playtest (Story 5.10):** whether players notice it working; whether free pieces pile up with a small flock (they never spoil; a single sheep eats again whenever it drops below 90, so the pile grows about 1 a minute, 69 in an hour, and passes the 300-piece benchmark only after about 4 h; 2–3 sheep build none; the alternative is to skip a drop while no sheep is below `seekBelowFullness`); whether the pacing bot should buy it (it does not, so the pacing guards keep their meaning).
- **No stat (Story 5.4):** FR36 has no count of feeder drops; none was added.

## Deferred from: code review of 4-8-auto-feeder (2026-10-09)

- **Carcass seekers lose their carcass to any food piece (any time; playtest 5.10):** `updateCarcassEating` (`carcass.ts:106–111`) releases every `seekCarcass` sheep whenever `foodPieces.length > 0`, even when the only piece is already claimed by another sheep. A second Starving sheep then wanders with nothing to claim until that piece is eaten, then goes back to the carcass, losing a second or so. Pre-existing with Farm pieces; the Auto-feeder makes it happen every 10 s. A fix would release only when an unclaimed piece exists.

## Deferred from: story 5-6-audio-pass-and-captions (2026-10-09)

- **Last sheep sting (Story 5.5):** `sfx-sting` and `STRINGS.captions.lastSheep` ("[sting] Last sheep!") exist. When 5.5 adds `LastSheep` to `SimEvent`, AudioDirector's exhaustive switch fails to compile until its case plays the sting and raises the caption.
- **Volume panel (Story 5.7):** `src/view/settings.ts` `updateSettings` is the entry point; AudioDirector already applies `musicVolume`, `sfxVolume` and `captions` on `settings:changed`. Release of the SFX slider can preview with a bleat through a new public director method (none exists yet). `reducedMotion` is stored but read by nothing.
  - **Resolved in Story 5.7:** `VolumePanel` with `Slider` / `Toggle` widgets; sliders update live with `updateSettings(patch, { persist: false })` and save on release; `AudioDirector.previewSfx()` bleats on SFX release; `reducedMotion()` (`view/settings.ts`) is read by every juice effect.
- **Real audio (any time):** the 9 SFX and the music loop are synthesised placeholders (`assets/audio/`). Free-pack audio (Kenney CC0 etc.) can replace them under the same file names with no code change; credit each in `assets/CREDITS.md`.
- **Dose sounds (Story 5.8):** no pick-up / put-back sound for the Medicine dose.
- **Planning docs still ask for hunger bleats (cut in 5.6):** the munch and the hunger-scaled and frantic bleats, with the `[frantic bleating]` caption, were cut at the product owner's request. The GDD Hunger table and Audio section, EXPERIENCE State Patterns and UX-DR88's caption list still require them. Update those docs (correct-course) so 5.7 and the 5.10 playtest don't reintroduce them.
- **Mix by ear (playtest 5.10):** `CUE_GAIN`, the default volumes (music 0.5, SFX 0.8) are guesses, tuned only by an automated check, not by ear.

## Deferred from: code review of 5-6-audio-pass-and-captions (2026-10-09)

- **AudioDirector unit tests:** none yet; Phaser does not load in the node test environment. Needs a fake SoundManager/bus harness to cover cause-blind deaths, the autoplay gate, the throttle and voice cap, and `pausedByHide` ownership.
- **ffmpeg for art-only runs:** `npm run assets` always builds audio, so an art-only change needs ffmpeg. A `--no-audio` flag, or skipping when the sources are unchanged, would fix it.
- **Non-reproducible audio encodes:** every assets run re-encodes the OGG/MP3, so different ffmpeg versions create binary diffs. Consider a source-hash manifest or bitexact flags.
- **MP3 encoder delay (Safari):** the markers are not compensated for LAME's delay and padding, and the music loop may have a gap at the seam. Check in Safari once real audio is in.
- **AudioDirector teardown:** the page-lifetime singleton is never destroyed, so Vite HMR leaves a stale director. DEV-only.
- **Debug Captions label:** the label is not refreshed on `settings:changed`, which matters once 5.7's panel toggles captions.
  - **Resolved in Story 5.7:** the debug overlay's Captions (and new Reduced motion) labels follow `settings:changed`.
- **UNLOCKED never firing:** if `context.resume()` rejects, the page stays silent with no retry.

## Deferred from: story 5-7-volume-and-accessibility-settings (2026-10-09)

- **New juice respects reduced motion (Stories 5.5, 5.8):** every new juice effect reads `reducedMotion()` (`src/view/settings.ts`) when it starts: movement juice (slides, rises, bounces, pops, bobs, spins, shakes, rolls) becomes instant or a fade; fades, tints, held glows and small particle bursts stay; gameplay animation is never reduced. The "Last sheep!" banner (5.5) fades in like the era banner; an empty-meter shake (5.8) becomes a flash; any camera shake is off.
- **Volume before the first game (any time):** the Volume panel is reachable from Pause only (EXPERIENCE IA), so a player cannot set volume on the title screen.
- **Slider keyboard control (any time):** sliders and toggles are mouse-only (UX-DR76 mouse completeness is met); no arrow-key or Tab focus.

## Deferred from: code review of 5-7-volume-and-accessibility-settings (2026-10-13)

- **Debug reduced-motion toggle outside a modal:** the DEV debug overlay can flip reduced motion with no modal open; running effects (Farm glow pulse, Market/Better Place highlights, breed markers) keep the old mode until they next start or unfreeze. Players only change it from the Volume panel (game paused), where every effect re-syncs. Subscribe FarmBoost etc. to `settings:changed` if this matters.
- **Tab closed mid-drag:** a slider value applied with `persist: false` is lost if the page closes before release. A `pagehide` flush would fix it.

## Deferred from: code review of 5-4-stats-panel (2026-10-13)

- **Very long Stats values:** `StatsPanel` is a fixed 312 px wide, sized for a 7-digit money value. Save validation allows counters and `moneyEarned` up to 2^48 (15 digits), and such a value would overlap "Money earned". Nothing measures, scales or abbreviates it. This can't happen in normal play, and the HUD MoneyCounter uses the same fixed-box approach. Fix with a width check and `setScale` if 5.10 playtesting ever gets close.
