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

## Deferred from: code review of 1-3-sheep-wander-the-pasture (2026-10-06)

- **Non-finite values in a save (Story 1.9):** a `NaN` or `Infinity` `x`, `y` or `heading` gets past the movement fence clamp (comparisons with `NaN` are false) and stays non-finite; JSON then turns it into `null`. One `NaN` point passed to `rebuildGrid` also overwrites another sheep's grid slot. Save validation must reject non-finite numbers and duplicate sheep ids.
- **Sprites across a state swap (Story 1.9):** `SheepSprite` keeps `lastTick` and its prev/curr positions. If load-or-new replaces `GameScene.state` in place while the `EntityLayer` lives (ids restart at 1), sheep slide from the old run's spots or freeze for a tick. Release or reset all sprites when the state is replaced.
- **Stale grid indices (Stories 4.2/4.3):** `queryNeighbours` returns indices into the array last passed to `rebuildGrid`, with no guard. Any system that queries neighbours after a death has filtered `state.sheep` must rebuild first (see the `grid.ts` header).
