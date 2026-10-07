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
- **Farm bar size defined twice (Story 3.6):** `COMPONENTS.farmProgress.segmentCount` (pips drawn) and `TUNING.farmPipsPerFood` (pips per food) are both 8. `FarmProgress.set` scales between them and the "{n}/8" text always reads the tuning value. If 3.6 retunes the bar, change both, or build the pips from the tuning value.

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
- **Music on hide (Story 5.6):** AR25 also pauses music when the tab is hidden; there is no audio yet.

## Deferred from: code review of 1-9-save-resume-and-hidden-tab-pause (2026-10-06)

- **Two open tabs share one save:** each tab autosaves its own game to `sheepciv.save.v1`, so the last tab to save wins, and Restart in one tab is undone by the other tab's next autosave or hide-save. Deferred (Rylan): rare for this kind of game. Fix when needed: listen for the `storage` event and stop autosaving when another tab writes the key, or put a per-run id in the envelope.

## Deferred from: story 1-10-title-screen-pause-menu-and-start-over-confirm (2026-10-06)

- **Era badge above the modals (Story 3.5):** UX-DR20 and DESIGN Layout keep the era badge visible top-right under the pause and confirm modals. OverlayScene draws above HudScene, so the badge must render in OverlayScene (or above it), not in HudScene, or the 72% scrim covers it.
- **Reduced motion (Story 5.7):** the lose screen's 250 ms scrim fade and the title sheep's walks are motion; check them against the reduced-motion toggle when it exists.
- **Placeholder panels (Stories 5.4, 5.7, 5.9):** `PlaceholderPanel` stands in for Stats, Volume and Credits (in the pause menu, and Credits on the title). Replace it with `StatsPanel`, `VolumePanel` and `CreditsPanel` (built from `assets/CREDITS.md`).
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

## Deferred from: story 2-6-alert-pings-and-threat-summary (2026-10-07)

- **Pings above the shop panel (Story 3.2):** UX-DR10/UX-DR63 keep alert pings (and the other world overlays) above the open shop panel. Pings live in GameScene's world-overlay band (`FIELD_DEPTH.ping`, `src/view/field/depths.ts`), so a shop panel drawn in `OverlayScene` or `HudScene` would cover them. 3.2 must either draw the shop panel in GameScene (screen-fixed, below `FIELD_DEPTH.overlay`, with field clicks over it ignored), or move the world-overlay band into its own scene between the shop and the modals (2.6 Open Question 1).
- **A crowded bottom bar (Stories 2.8, 3.2, 3.3, 4.5):** the threat summary takes x 858–1080 (`THREAT_X`, 222 px). The mockup's order puts the Medicine slot, money and flock counters (with separators) in the 588–846 gap, and the boost timer and Shop toggle in the last ~184 px. Both gaps are tight at the mockup's sizes; whichever story overflows first should re-space the bar (for example, shrink `GROUP_GAP` or drop the separators) rather than overlap. `BottomBar` asserts the summary's slot with `invariant`.
  - **Story 2.8:** the boost timer now sits at x 1 092–1 196 (`BOOST_X`, `BOOST_TIMER_W` 104), leaving 68 px to the 1 264 safe edge. `BottomBar` asserts that at least 64 px (`SHOP_RESERVE`) remain for 3.2's Shop toggle (mockup about 80 px). 3.2 must re-space the bar (or narrow the timer) rather than overlap.
- **Reduced motion (Story 5.7):** the ping's pop-in and bob (`PING` in `AlertPing.ts`) are juice; under reduced motion the ping should appear at once without bobbing. The ping and its settled dot are information and stay.

## Deferred from: code review of 2-6-alert-pings-and-threat-summary (2026-10-07)

- **Four-digit threat counts (Story 3.6):** `ThreatSummary`'s count box is 34 px, sized for "100". Starving and infected are capped by capacity, but carcasses stay until cleared, so 1 000+ uncleared carcasses would draw "1000" into the next slot. Unreachable in normal play; if 3.6 finds it can happen, clamp the text (for example "999+") and re-space the bar.

## Deferred from: story 2-7-drag-a-sheep-into-the-better-place (2026-10-07)

- **The Market (Story 3.1):** add its bounds to `GameScene.playArea` (union with the pen and the Better Place), its armed and hovered highlight next to `BetterPlace.setHighlight`, and the invalid "Too young" target for lambs. `SheepDrag.end` decides the target from the pointer: add the Market test beside `inBetterPlace`.
  - **Resolved in Story 3.1:** `view/field/Market.ts` (`MARKET_BOUNDS`, `inMarket`, `setHighlight('off' | 'armed' | 'hovered' | 'invalid', price)`), and `SheepDrag` sends `Sell` over the stall (a lamb there gets a `Drop`).
- **Fence growth vs the hole (Story 3.3):** the hole is fixed at world (520, 108). The Land I fence (mockup 430–1062 × 184–598) stays clear of it, but check the later tiers, and recompute `GameScene.playArea` (and re-clamp the camera) when the fence grows.
- **A victim picked up mid-approach (Story 4.3):** a dragged sheep keeps its sim position (the pickup spot), so the Abomination would walk to where it was picked up. Decide whether a dragged victim is re-picked like a sacrificed one.
- **The reveal (Story 4.4):** `Sacrificed.wasAbomination` is always false today; the HUD toast and `GameScene.suck` must branch on it only there.
- **Audio (Story 5.6):** the `[suction]` caption and SFX on `Sacrificed`.
- **Reduced motion (Story 5.7):** the suction spiral (`SUCTION`), the ring spin and hole suck (`BP_MOTION` in `BetterPlace.ts`) and the 4 px lift are juice; the lit rim, glow and label are information and stay.

## Deferred from: code review of 2-7-drag-a-sheep-into-the-better-place (2026-10-07)

- **Stale camera play area (Story 3.3):** `GameScene.playArea` (pen ∪ Better Place) is built once in `create`, so when the fence grows in place the pan clamp and centring still use the old pen. Rebuild it (and re-clamp `PenCamera`) when the land tier changes. `fenceBounds` is constant until then.

## Deferred from: story 2-8-sacrifice-food-boost (2026-10-07)

- **Audio (Story 5.6):** a cue when a boost starts (`BoostStarted`). An end cue would need a `BoostEnded` event, which is not emitted (the end is derived from `boostUntil`); 5.6 would add a small system that emits it once when `time` reaches `boostUntil`.
- **Reduced motion (Story 5.7):** the Farm glow pulse (`BOOST_MOTION` in `FarmBoost.ts`), the timer pop (`BOOST_TIMER_MOTION` in `BoostTimer.ts`) and the "×2" float popup are juice. The glow itself, the badge and the timer are information and stay.
- **Better Hoe (Story 4.7):** raise the base in `farmPipsPerClick(state)` (`selectors.ts`); the boost doubles whatever the base is (2 → 4, 3 → 6).
- **Stats panel (Story 5.4):** FR36 lists sheep alive, sold, died, sacrificed and money earned, with no boost count. Leave boosts out unless 5.4 decides otherwise; `stats.sacrificed` already counts every boost started.

## Deferred from: code review of 2-8-sacrifice-food-boost (2026-10-07)

- **Validation bounds follow live tuning (Story 3.6):** `validate.ts` caps `boostUntil` at `time + TUNING.boostMs` and `cooldownUntil` at `time + TUNING.breedCooldownMs`. If 3.6 lowers either, saves made mid-boost or mid-cooldown are rejected and the flock is lost. When retuning, clamp these deadlines on load, or validate them against a fixed ceiling, instead of failing.
- **Shop toggle space (Story 3.2):** the boost timer kept its 104 px width and `SHOP_RESERVE` is 64 px, below the mockup's ~80 px toggle. 3.2 narrows the timer's padding or re-spaces the bar.

## Deferred from: story 3-1-sell-sheep-at-the-market (2026-10-07)

- **Money counter (Story 3.2):** `state.money` exists (schema 7) but nothing on the HUD shows it; the DEV overlay's sheep line shows the balance and sales until then. 3.2 adds `money` to `HudView` and the `money-counter`, and its DEV "Add money" adds to `money` only (validation does not tie `money` to `stats.moneyEarned`, on purpose).
- **Land tiers vs the stall (Story 3.3):** the stall is fixed at world x 1100–1260 (`MARKET`, outline from x 1080). Land I ends at x 1062; check that Land II/III never reach x 1080, and rebuild both camera rects (the focus and `playArea`) when the fence grows.
- **The Abomination stays unsellable (Story 4.1):** `market.ts` relies on `stageOf` reporting the Abomination as a lamb (it never grows past one). Keep it so; the view's "Too young" reads only `PublicSheep.stage`.
- **Names (Story 5.3):** the sold toast says "A sheep sold. $10."; 5.3 puts the name in place of "A sheep", in `halo`.
- **Audio (Story 5.6):** the cash-register ding on `Sold` (UX-DR82), and a caption if captions cover it.
- **Reduced motion (Story 5.7):** the outline pulse, awning flap, tag growth and stall nudge (`MARKET_MOTION` in `Market.ts`) and the sale hop (`SALE` in `GameScene.ts`) are juice; the outline, tag and "Too young" are information and stay.
- **An intermittent first drag in the browser probe (investigate any time):** in the scratchpad Playwright probe, about 1 in 10 runs the first drag after the session's first debug Load never starts (the sheep stays put; no command is sent). It happens on the pre-3.1 commit too (2 of 10 runs), so 3.1 did not cause it, and it never happened on a later drag in the same session (10 of 10 fast sales passed). Unknown whether it is the probe's synthetic pointer timing or a real drag-start edge case in `InputController.updateClick`; worth a look with real mouse input.
