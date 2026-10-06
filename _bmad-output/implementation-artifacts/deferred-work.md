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

## Deferred from: code review of 1-2-simulation-core-and-game-clock (2026-10-05)

- **Commands and pausing (Story 1.10):** `GameScene.pendingCommands` is reset in `create()`, so a command dispatched between shutdown and `create()` is lost. While the clock is paused, Farm presses pile up with no bound and all apply on the first tick after unpause. Decide both when pausing arrives.
- **Exit animations (Story 2.4):** `PooledEntitySprite.playExit()` returns nothing and `EntityLayer` releases the sprite immediately. The architecture's N3 contract is `playExit(done)`, releasing to the pool only when the exit animation ends. Change the interface and the sweep when death puffs or sell animations arrive.
- **Fence growth (Story 3.3):** `Fence.setBounds` destroys and re-creates its images, and `GameScene` keeps no reference to the `Fence`. Growing the fence during play must reuse or pool the parts (project rule: never `destroy()` during play) and keep the instance.
- **Failed asset load (Story 1.4):** `PreloadScene` logs `FILE_LOAD_ERROR` and still starts `GameScene`, so a missing atlas renders the sheep and fence as Phaser missing-texture boxes with no message. Decision 2026-10-05: keep log-and-continue; the Story 1.4 error safety net should show the player a message when an atlas fails to load.
  - **Resolved in Story 1.4:** after loading, `PreloadScene` checks that both atlas textures exist. If one is missing it logs a warn and shows "Some of the pasture didn't load. Try reloading the page." once; the game still starts.

## Deferred from: code review of 1-3-sheep-wander-the-pasture (2026-10-06)

- **Non-finite values in a save (Story 1.9):** a `NaN` or `Infinity` `x`, `y` or `heading` gets past the movement fence clamp (comparisons with `NaN` are false) and stays non-finite; JSON then turns it into `null`. One `NaN` point passed to `rebuildGrid` also overwrites another sheep's grid slot. Save validation must reject non-finite numbers and duplicate sheep ids.
- **Sprites across a state swap (Story 1.9):** `SheepSprite` keeps `lastTick` and its prev/curr positions. If load-or-new replaces `GameScene.state` in place while the `EntityLayer` lives (ids restart at 1), sheep slide from the old run's spots or freeze for a tick. Release or reset all sprites when the state is replaced.
- **Stale grid indices (Stories 4.2/4.3):** `queryNeighbours` returns indices into the array last passed to `rebuildGrid`, with no guard. Any system that queries neighbours after a death has filtered `state.sheep` must rebuild first (see the `grid.ts` header).

## Deferred from: code review of 1-4-developer-debug-overlay-and-error-safety-net (2026-10-06)

- **Watchdog in embeds (Story 5.2):** browsers throttle rAF in offscreen cross-origin iframes (the itch.io embed) without setting `document.hidden`. A still frame counter can then trigger a needless `loop.sleep()/wake()`, which runs one extra frame and logs a false "Game loop restarted after error" warn. Check it in the real embed and gate the watchdog on visibility (for example with an `IntersectionObserver`) if it misfires.
- **Saving after a sim error (Story 1.9):** when `step()` throws mid-tick, `GameScene` catches it and play continues on a half-mutated state. The safety net's `forceSave()` hook (comment in `src/view/safetyNet.ts`) would write that state to disk. Decide whether to validate before forcing a save after a sim error, or to skip the forced save for `sim` errors.
- **NFR1 on target hardware (Story 5.11, or any time before it):** the formal 100-sheep, 5-minute run at ×1 was recorded only in headless Chrome (SwiftShader, CPU rendering): 103 sheep, mean 51.7 FPS, p95 33.4 ms. The 1.3 baseline gets 50.2 FPS under the same conditions, so there is no regression. 60 FPS on an integrated-GPU laptop in Chrome and Firefox is still unverified. Decision 2026-10-06 (Rylan): close 1.4 and carry this over. Reason: it needs a real browser on Rylan's hardware. How: DEV build, backtick, "+10 sheep" ×10, and run for 5 minutes. Since Story 1.5 sheep starve: new and added sheep start at Fullness 60 and die 72 s later, and a fed sheep dies 120 s after Feed all. So press **Feed all** within 60 s of adding sheep and then about every 90 s, until Story 1.7's feeding exists. Reopen the overlay with backtick to press it, and close it again so it is not in the measurement.

## Deferred from: code review of 1-5-hunger-and-starvation (2026-10-06)

- **Non-finite hunger fields in a save (Story 1.9):** a missing or `NaN` `fullness` survives the drain (`NaN <= ε` is false), so the sheep never starves and `hungerOf` returns 'hungry' forever. `Infinity` makes it permanently 'fed'. A `NaN` `bornAt` makes `stageOf` return 'elder'. `decodeSave` checks only `time`. Add `fullness` and `bornAt` to the non-finite checks already listed above for `x`, `y` and `heading`.
- **Tooltip wider than the canvas (Stories 1.6, 5.3):** `Tooltip.showAt` clamps right, then left, so a box wider (or taller) than the canvas minus the margins is pinned at the left or top margin and runs off the other edge. There is no `wordWrap`. Current copy cannot reach it; button tooltips and name lines might.
- **Stage-aware sheep frames (Story 2.1):** `SheepSprite.sync` re-sets its frame only when `hunger` changes (`shownHunger`). When lamb and elder frames arrive, cache the (stage, hunger) pair, or a sheep that ages while its hunger is steady keeps the old frame.
