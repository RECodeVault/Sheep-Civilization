---
baseline_commit: 4d2d1dacbf96b41a341cb4d957dbca4cf7352c4c
---

# Story 1.4: Developer Debug Overlay and Error Safety Net

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want an in-game debug overlay and a global error handler,
so that I can speed up, inspect and reproduce the simulation while players never see a stack trace.

## Acceptance Criteria

1. **Debug overlay.** Given a DEV build (`npm run dev`), when I press backtick (`` ` ``), an overlay toggles. It shows:
   - FPS, frame time, and the sheep, food-piece and carcass counts plus the food meter.
   - Controls for sim speed ×1/×4/×16, pause, step one tick, add food, dump `GameState` to the console, and copy or load save JSON through the clipboard (AR15).
2. **Stripped from production.** Given a production build (`npm run build`), when the bundle in `dist/` is inspected, the debug module is absent. It is imported only behind `import.meta.env.DEV`.
3. **Global safety net.** Given an unhandled error or promise rejection, when it occurs, the global handler logs it with `log.error`.
   - In production it shows the toast "Something went wrong — your flock was saved." and the game keeps running.
   - Save forcing is wired once saving exists in Story 1.9; this story leaves a marked hook point and no save code.
4. **Failed asset load (deferred from 1.2).** Given an atlas that fails to load in `PreloadScene`, when the game starts anyway, the player sees a message instead of silent missing-texture boxes (decision 2026-10-05 in `deferred-work.md`).
5. **Formal performance check (carried over from 1.3).** With the overlay, 100 sheep run at ×1 for 5 minutes, and the FPS and frame time are recorded against the 60 FPS budget (NFR1).
6. **Green gate.** `npm test`, `npm run typecheck`, `npm run lint` and `npm run build` all pass.

## Tasks / Subtasks

- [x] **Task 1: Player-facing strings** (AC: 3, 4)
  - [x] 1.1 Create `src/view/strings.ts` exporting a frozen `STRINGS` object. This is the file the project rules name for all copy; Story 1.6 adds HUD labels to it.
    - `errorToast: 'Something went wrong — your flock was saved.'` Copy it from the epic and architecture exactly, with the em dash.
    - `assetLoadFailed: "Some of the pasture didn't load. Try reloading the page."` This is an **[ASSUMPTION]**: the EXPERIENCE.md Voice table has no line for it. It follows the voice rules (no "!", no grim words). Flag it for Rylan in the completion notes.
  - [x] 1.2 Debug-overlay labels are developer-only, not player-facing. They may stay inline in `src/debug/`.
- [x] **Task 2: The safety net, `src/view/safetyNet.ts`** (AC: 3, 4)
  - [x] 2.1 Export `installSafetyNet(game: Phaser.Game | null)` (or install first and attach the game later with `attachGame(game)`), plus `reportError(source: string, err: unknown)`, so a caught error can enter the same path, and `showToast(text: string)` for non-error messages (Task 4).
    - Install it in `main.ts` **before** `loadFonts()`, so boot errors are caught too.
    - It lives in `src/view/` because it touches `window` and `document`, which lint forbids in `src/core/`.
  - [x] 2.2 Listen with `window.addEventListener('error', …)` and `window.addEventListener('unhandledrejection', …)`.
    - For `error`, handle only `ErrorEvent`s (`event instanceof ErrorEvent`); resource-load `error` events on elements are not script errors.
    - Call `event.preventDefault()` on both, so the browser does not also print its own "Uncaught" line. `log.error` is the single record; pass the `Error` object as `data` so the stack stays clickable in DEV.
    - Rejection reasons may be any value, not only an `Error`.
  - [x] 2.3 **Don't spam (NFR8).** An error inside `update()` repeats every frame.
    - Log the first occurrence of each distinct message in full. Count repeats, and log one `log.error('ui', 'Repeated N×: …')` summary at most every 10 s while repeats continue.
    - Show at most one toast per 10 s (the "toast cooldown").
    - Keep the timing in the view. `setTimeout` and `performance.now()` are fine here: this is not game logic.
  - [x] 2.4 **Toast.** Show it in both DEV and production, so it can be checked during development. The AC requires it in production.
    - Use a single DOM element (not a Phaser object), created once and reused.
    - Place it top-centre over `#game-container`, with `pointer-events: none` (toasts never block clicks), and remove it after about 4 s (EXPERIENCE.md: announcement toasts last about 4 s).
    - Style it from the `announcementToast` spec in `COMPONENTS`: `COLORS.dusk` background, `COLORS.wool` text, `TYPOGRAPHY.body` (Nunito 18/600) and `RADIUS.md`, with `SPACING` padding. Use no hex literals.
    - Why DOM: the safety net must work when Phaser itself is broken, before any scene exists, and with no `HudScene` yet (Story 1.6). Story 2.4's Phaser announcement toasts are separate; the safety net keeps its DOM toast.
    - Set the text with `textContent`, never `innerHTML`.
  - [x] 2.5 **Keep the game running.** Phaser's `RequestAnimationFrame.step` calls the game loop **before** it requests the next frame (`node_modules/phaser/src/dom/RequestAnimationFrame.js:95-103`). A throw anywhere inside a frame therefore stops the loop for good: the canvas freezes, even though `window.onerror` fires.
    - After any reported error, schedule a watchdog check about 250 ms later. If `game.loop.frame` has not advanced, `game.loop.running` is true and `document.hidden` is false, restart the loop with `game.loop.sleep(); game.loop.wake(true);` and log one `log.warn('ui', 'Game loop restarted after error')`.
    - Skip the check when the tab is hidden: Phaser's own visibility handler pauses the loop then (`Game.onHidden` → `loop.pause()`).
    - Verify that `TimeStep.sleep`/`wake(seamless)` and `frame` exist (`TimeStep.js` lines ~299, 705, 781, 800) before relying on them.
  - [x] 2.6 **Save hook point.** Before showing the toast, add a comment where Story 1.9 forces a save (for example `// Story 1.9: forceSave() here, inside its own try/catch`). Do **not** add save code, a callback registry or a stub function.
  - [x] 2.7 `reportError` must never throw. Wrap its own body in try/catch and fall back to a bare `console.error` only if `log.error` itself fails.
  - [x] 2.8 In `main.ts`, route the existing `start().catch(...)` through `reportError('boot', err)`.
- [x] **Task 3: Contain sim errors in `GameScene`** (AC: 3)
  - [x] 3.1 Move the per-tick body (apply pending commands, `step`, `drainEvents`) into a private `tick()` method; it is also used for debug stepping (Task 5).
  - [x] 3.2 Wrap the body of `update()` (the tick loop plus `render()`) in a `try/catch` that calls `reportError('sim', err)`. The frame then finishes and Phaser's loop is untouched.
    - In DEV, `invariant` still throws; the catch turns it into a loud `log.error` plus the toast, which is the intended DEV behaviour.
    - If a tick throws, drop the remaining ticks of that frame (`break`), so one bad state does not throw up to 40 times in a ×16 frame.
    - No allocation is added: `try/catch` is free in V8 when nothing throws.
  - [x] 3.3 Keep `this.game.loop.rawDelta` (see Previous story intelligence). Keep `forwardEvent` bound once.
- [x] **Task 4: The atlas-load message** (AC: 4)
  - [x] 4.1 In `PreloadScene`, keep the `FILE_LOAD_ERROR` `log.warn` and record that a file failed. In `create()`, if any file failed, call a safety-net export, for example `showToast(STRINGS.assetLoadFailed)`, once, then start `GameScene` as today (keep log-and-continue).
    - This is a recoverable boundary failure, so it is logged at `warn`, not `error` (architecture Error Handling table).
    - It uses the same DOM toast, but not the "flock was saved" text.
  - [x] 4.2 Remove the listener on shutdown, or register it with `once`/inside `preload` as now. The scene runs once, so the current registration is fine. Do not add a second listener on restart.
- [x] **Task 5: A narrow debug API on `GameScene`** (AC: 1)
  - [x] 5.1 Add a small public surface that the overlay calls. It ships in production but does nothing there (the overlay is never loaded):
    - `get simState(): Readonly<GameState>`: the live state, for counts and dumps.
    - `get simClock(): FixedStepClock`: for speed. **Pause = `clock.speed = 0`.** The setter already accepts 0, and `advance` then returns 0 ticks. The overlay remembers the previous speed to resume.
    - `stepOnce(): void`: runs `tick()` once and then `render()`. Use it only while paused; the overlay disables the button otherwise.
    - `debugMutate(fn: (s: GameState) => void): void`: runs `fn(this.state)` immediately, then `render()`.
      - This is safe because DOM click handlers run between `requestAnimationFrame` callbacks, never mid-tick.
      - Document it as the **only** sanctioned view-side mutation path, for `src/debug/` only.
    - `loadState(state: GameState): void`: calls `this.scene.restart({ state })`.
  - [x] 5.2 `create(data?: { state?: GameState })` uses `data.state` when it is given, otherwise `createNewGame(...)`. A restart rebuilds the pools, the `EntityLayer` and the `Fence`, and clears the event queue, the commands and the clock.
    - This resolves the "sprites across a state swap" hazard in `deferred-work.md` for the debug load path: sheep ids restart at 1, and old sprites must not keep `lastTick` or prev/curr positions.
    - Story 1.9's load-or-new can reuse the same `create(data)` path. Do not tick the deferred item as done; 1.9 still owns it for real saves.
  - [x] 5.3 Keep these members free of debug-only types and imports. `GameScene` must **not** import anything from `src/debug/`.
- [x] **Task 6: `src/debug/DebugOverlay.ts`** (AC: 1, 2, 5)
  - [x] 6.1 Export `installDebugOverlay(game: Phaser.Game): void`. Build a **DOM** panel (absolutely positioned top-left over `#game-container`, `COLORS.duskDeep` background, `COLORS.wool` text, `z-index` above the canvas). It starts hidden.
    - Why DOM: buttons need no atlas frames or font-metric work, clicks never reach the Phaser canvas or the future `InputController`, and a click on a real DOM button is the user gesture the Clipboard API needs.
  - [x] 6.2 **Toggle:** a `window` `keydown` listener with `e.code === 'Backquote'` that ignores `e.repeat`. Use `code`, not `key`, so a keyboard layout where backtick is a dead key still works.
    - Use a DOM listener, not the Phaser keyboard plugin: the project's single-owner rule is for **gameplay** input (`InputController`, Story 1.7), and the overlay must also work in scenes that have no input set up.
  - [x] 6.3 **Finding the scene:** `game.scene.getScene('GameScene') as GameScene`. Before reading anything, check that it exists and `scene.sys.isActive()`. While it is not active (Preload, or Title later), show the counts as "—" and disable the sim controls.
  - [x] 6.4 **Readout:** sample on `game.events.on(Phaser.Core.Events.POST_RENDER, …)` with one bound handler (no per-frame closures). Write the DOM text at most every 250 ms, and only while the panel is visible.
    - FPS: `game.loop.actualFps`, rounded.
    - Frame time: the mean and the max of `game.loop.rawDelta` over the last 250 ms window. The max shows hitches that the mean hides.
    - Counts: `sheep.length`, `foodPieces.length`, `carcasses.length`, `food`/`TUNING.foodCap`, `state.time` via `formatGameTime`, the current speed, and "paused".
    - Use `textContent` on pre-built spans; never rebuild the DOM each update.
  - [x] 6.5 **Controls (buttons):**
    - **Speed ×1 / ×4 / ×16:** sets `simClock.speed`. Show the active one.
    - **Pause / Resume:** `speed = 0`, or restore the remembered speed.
    - **Step:** `stepOnce()`, enabled only while paused.
    - **+5 food:** `debugMutate(s => { s.food = Math.min(TUNING.foodCap, s.food + 5); })`. It respects the cap, so it can never create a state the sim cannot produce.
    - **+10 sheep:** `createSheep` from `src/sim/state.ts` at rng positions inside the inset fence, the same way the `fillFlock` test helper does. Update `stats.peakFlock` if it is exceeded. This is the tool for the AC 5 check and every later 100-sheep check, with no need to edit `TUNING`.
    - **Dump state:** `log.debug('debug', 'GameState', JSON.parse(JSON.stringify(state)))`. Log a snapshot, so the console does not show a live object that changes later.
    - **Copy save:** `navigator.clipboard.writeText(encodeSave(state))` (Task 7). Show a short "copied" or "copy failed" status in the panel; log failures with `log.warn('debug', …)`.
    - **Load save:** `navigator.clipboard.readText()`. If that is unavailable or rejected (Firefox may show a paste prompt; permissions may be denied), fall back to `window.prompt('Paste save JSON')`. Then `decodeSave(text)`: if null, show "invalid save" and log a warning; otherwise call `loadState(state)`.
    - **Throw test error** and **Reject test promise** (DEV-only safety-net probes): the first throws inside a one-shot `POST_STEP` listener, so the error happens inside Phaser's loop and exercises the 2.5 watchdog; the second runs `Promise.reject(new Error('debug probe'))`. These make AC 3 checkable without editing code.
  - [x] 6.6 Do **not** add Reveal Abomination, Spawn carcass, Infect sheep or Add money. The data does not exist yet. The stories that introduce carcasses (2.4), infection (2.5), money (3.2) and the Abomination (4.1) each add their button.
    - `src/debug/` is the **only** non-sim place allowed to read `isAbomination` (lint: secrecy is off for `src/debug/**`).
  - [x] 6.7 Clean up with one bound handler per listener. The overlay lives for the page lifetime (it is installed once in `main.ts`), so no teardown is needed. Do not register Phaser scene listeners that would survive a `GameScene` restart twice. `game.events` belongs to the game, not the scene, so registering once at install time is correct.
- [x] **Task 7: Save envelope codec, `src/save/saveFile.ts`** (AC: 1)
  - [x] 7.1 Story 1.9 owns saving; this story adds only the pure encode/decode that the clipboard needs, in the layer the architecture assigns (only `src/save/` builds `savedAt`).
    - `export interface SaveFile { schemaVersion: number; savedAt: string; state: GameState }`.
    - `encodeSave(state: GameState, now = new Date()): string` returns `JSON.stringify({ schemaVersion: SAVE_SCHEMA_VERSION, savedAt: now.toISOString(), state })`.
    - `decodeSave(raw: string): GameState | null`: try `JSON.parse`, then require a plain object with `schemaVersion === SAVE_SCHEMA_VERSION` and a `state` that is a plain object with a finite number `time` and array `sheep`, `foodPieces` and `carcasses`. Otherwise (including on a thrown parse) return null.
    - Add a header comment: "Story 1.9 replaces this shape check with migrate → validate (non-finite numbers, duplicate ids: see deferred-work.md)." Do not implement the full validation here.
  - [x] 7.2 No `localStorage` in this file; storage is Story 1.9. Lint allows storage in `src/save/`, but this story does not need it.
- [x] **Task 8: Wire it in `main.ts`** (AC: 1, 2, 3)
  - [x] 8.1 Call `installSafetyNet(...)` first, before fonts. Attach the game once `new Phaser.Game(...)` returns.
  - [x] 8.2 After the game is created:

    ```ts
    if (import.meta.env.DEV) {
      const { installDebugOverlay } = await import('./debug/DebugOverlay');
      installDebugOverlay(game);
    }
    ```

    - **Dynamic** import inside the DEV guard only. A static top-level `import` of `src/debug/` would put the module in the production graph even if it is never called.
    - Vite replaces `import.meta.env.DEV` with `false` in a production build, the branch is dead-code-eliminated, and the chunk is never emitted.
- [x] **Task 9: Tests** (AC: 6)
  - [x] 9.1 `tests/save/saveFile.test.ts` (the first file in `tests/save/`; delete its `.gitkeep`):
    - A round trip of a game built with `newGame(seed)` from `tests/sim/helpers.ts` and advanced with `runFor(state, …)` is `toStrictEqual` the original state.
    - `savedAt` is the ISO string of the injected `now`, and `schemaVersion` is `SAVE_SCHEMA_VERSION`.
    - Each of these returns null: non-JSON, `null`, an array, a wrong `schemaVersion`, a missing `state`, `state.sheep` not an array, and a non-finite `time` (feed raw JSON text with a string or missing field, since JSON cannot carry `NaN`).
  - [x] 9.2 The safety net, overlay and scene changes are view/DOM code, which Vitest does not cover (project testing rules: no Phaser or DOM in tests). Verify them manually (Task 10) and record the evidence.
  - [x] 9.3 Existing tests stay green; `tests/core/fixedStep.test.ts` already covers `speed` (including 0).
- [x] **Task 10: Verification** (AC: 1–6)
  - [x] 10.1 `npm test`, `npm run typecheck`, `npm run lint` and `npm run build` are green. Record the counts.
  - [x] 10.2 **AC 2, tree-shaking:** after `npm run build`, `grep -r` `dist/` for strings unique to the overlay (for example `installDebugOverlay`, `Backquote`, `debug probe`, `+10 sheep`). Expect no matches, and no extra JS chunk compared with `main`. Record the command and its output.
  - [x] 10.3 **AC 1, DEV browser check** (headless system Chrome with scratchpad `playwright-core`, as in Stories 1.2 and 1.3, or a real browser):
    - The backtick toggle works.
    - ×4 and ×16 make the sheep move visibly faster (`state.time` grows 4× / 16× per real second).
    - Pause freezes `state.time`; Step advances it by exactly `TICK_MS`.
    - +5 food stops at 20.
    - Dump prints a snapshot.
    - Copy, then Load, round-trips (`state.time` and the sheep ids match after the load, and no sprite slides from an old position).
    - Loading garbage shows "invalid save" and changes nothing.
    - Headless clipboard: grant `clipboard-read`/`clipboard-write` in the Playwright context, or test through the prompt fallback.
  - [x] 10.4 **AC 3, safety net:**
    - DEV: "Throw test error" logs one `[ui]`/`[sim]` error, shows the toast, and the loop keeps running (`game.loop.frame` keeps increasing; the sheep keep moving).
    - DEV: "Reject test promise" behaves the same.
    - Production (`npm run build && npm run preview`): with `page.evaluate`, `setTimeout(() => { throw new Error('probe'); })` and `Promise.reject(new Error('probe'))` each give exactly one `log.error` line and the toast text exactly as specified.
    - **Watchdog in production:** in a Playwright `addInitScript`, wrap `window.requestAnimationFrame` so that one callback throws **before** calling Phaser's step. That reproduces the frozen loop. Confirm the watchdog restarts it (frames advance again) and logs the `warn`.
    - Record that no stack trace or browser "Uncaught" line appears beyond the `log.error` entries.
  - [x] 10.5 **AC 4:** temporarily rename `public/assets/atlases/ui.json` (or point `atlasUrls` at a missing key locally), confirm the `assetLoadFailed` toast and the `warn`, then **revert**. `git status` must be clean for `public/`.
  - [x] 10.6 **AC 5, the formal 100-sheep check:** in DEV, use "+10 sheep" until there are 100, then run at ×1 for 5 minutes with the overlay open and record mean FPS, mean and max frame time, and any hitches. Headless SwiftShader is not the target laptop GPU; if a real browser on Rylan's laptop is not available to you, record the headless numbers and say clearly that the on-hardware run is still open (Story 5.11 repeats it for release).
  - [x] 10.7 Remove every temporary probe (`grep` for it in `src/` and `dist/`) and record evidence for every manual check in the Dev Agent Record.

## Dev Notes

### Scope

| Story | Owns (do **not** start here) |
|---|---|
| 1.5 | `hunger.ts`, `killSheep`, tooltip |
| 1.6 | `HudScene`, widgets, HUD strings in `strings.ts` |
| 1.7 | `InputController` (gameplay input; the overlay's DOM listener is not gameplay input) |
| 1.9 | `saveStore.ts` (localStorage), autosave, `migrations.ts`/`validate.ts`, **forcing a save from the safety net**, the visibility pause, load-or-new in `GameScene.create` |
| 1.10 | Gameplay pause (Esc). It must not fight the debug pause: see gotcha 6. |
| 2.4 / 2.5 / 3.2 / 4.1 | Debug buttons: Spawn carcass / Infect sheep / Add money / Reveal Abomination |
| 2.4 | Phaser announcement toasts in `src/view/hud/` |
| 5.11 | The release performance check |

### Resolved decisions and gotchas (read first)

1. **A thrown error freezes Phaser for good.** `RequestAnimationFrame.step` runs `callback(time)` and only then requests the next frame. Any throw inside a frame (a scene `update`, a render, an event listener) ends the loop, while `window.onerror` still fires. The AC's "the game keeps running" therefore needs two layers: a `try/catch` in `GameScene.update` (Task 3) and the loop watchdog (Task 2.5).
2. **The toast is DOM, not Phaser.** It must work with no `HudScene`, before boot finishes, and when the renderer is the thing that broke. It still uses the `announcementToast` tokens. If Rylan wants it moved into the HUD later, that is Story 1.6 or 2.4 work.
3. **The overlay is DOM too** (Task 6.1). It is dev-only, so the atlas, Pixelify Sans and the "no `Graphics` per frame" rules do not apply. Do still throttle DOM writes to 4 Hz: layout thrash would distort the very FPS numbers it shows.
4. **Tree-shaking needs a dynamic import.** Use `if (import.meta.env.DEV) await import('./debug/DebugOverlay')`. The architecture's boundary rule 4 says the same. Prove it with the grep in Task 10.2.
5. **Debug mutation is the one exception** to "the view never mutates `GameState`". It is confined to `GameScene.debugMutate`, called only from `src/debug/`, and it runs between frames. Keep every debug mutation inside rule limits (food ≤ cap, sheep made with `createSheep`), so a debug session never produces a state the sim cannot.
6. **Debug pause = `clock.speed = 0`.** It needs no new flag. Story 1.10's gameplay pause will stop accumulation in its own way; when it lands, it must not reset `speed`. Note that in a comment next to the overlay's pause.
7. **Loading a state restarts the scene.** `scene.restart({ state })` is the only clean way to drop every pooled sprite, the `EntityLayer`'s id map, the fence and the clock. Swapping `this.state` in place would cause the stale-sprite bug recorded in `deferred-work.md`.
8. **`decodeSave` is deliberately shallow.** A malformed state that passes it can still throw in `step`; the Task 3 catch then reports it. Full validation is Story 1.9's.
9. **Don't double-log.** `preventDefault()` in the window handlers keeps the browser from printing its own copy. `log.error` with the `Error` object as `data` keeps the stack in DEV. Production players never see the console anyway; the requirement is that nothing appears **on screen** except the toast.
10. **`log.info`/`log.debug` are stripped in production** by the `manualPureFunctions` treeshake in `vite.config.ts`, and lint guards the `log` name. Only import `log` from `core/log`; never alias it.

### Current state of files this story changes

- **`src/main.ts`:** loads two fonts with a 3 s timeout, then creates `Phaser.Game` (`Boot`, `Preload`, `Game` scenes); `start().catch(...)` logs boot failures. It does not keep a reference to the game. **Changes:** install the safety net first, keep the `game` reference, and import the DEV overlay. **Preserve:** fonts load before any `Text` exists, and `COLORS.duskDeep` is on the body and container.
- **`src/view/scenes/GameScene.ts`:** `create()` clears events, builds a new game with a `Math.random` seed, makes a `FixedStepClock`, a `Fence` and a pooled `EntityLayer<PublicSheep, SheepSprite>`; `update()` advances the clock with `game.loop.rawDelta` and runs ticks (commands → `step` → `drainEvents(forwardEvent)`), then `render()`. **Changes:** `tick()`, `try/catch`, the debug API and `create(data)`. **Preserve:** `rawDelta`, the once-bound `forwardEvent`, `clearEvents()` first in `create`, no per-frame allocation, and no `scene.pause()`.
- **`src/view/scenes/PreloadScene.ts`:** a loading bar on `dusk`; `FILE_LOAD_ERROR` → `log.warn`; starts `GameScene`. **Changes:** remember the failure and show the toast once. **Preserve:** log-and-continue.
- **`src/core/fixedStep.ts`:** `speed` getter/setter (≥ 0, finite), clamp-then-multiply, `alpha`, `reset()`. **No change.**
- **`src/core/log.ts`, `src/core/invariant.ts`:** **no change.** `invariant` throws in DEV.

### Architecture compliance

- **Boundaries (lint-enforced, see `eslint.config.js`):**
  - `src/debug/**` may use DOM and read `isAbomination`, but not storage.
  - `src/save/**` may use storage.
  - `src/view/**` may use DOM, but not storage or `isAbomination`.
  - `src/core`, `src/sim` and `src/config` stay pure. **Do not** put the safety net in `src/core/`: it needs `window`.
- `GameScene` never imports `src/debug/`. Only `main.ts` does, behind the DEV guard.
- Naming: `safetyNet.ts` and `saveFile.ts` are camelCase modules that export functions; `DebugOverlay.ts` follows the architecture's file name. The log tags used are `ui` (safety net), `sim` (caught tick errors), `boot` (startup) and `debug` (overlay), which are all existing `LogTag`s.
- No logging per tick or per frame. The safety net logs only on errors (deduplicated), and the overlay only on button presses.

### Library / framework requirements

- **No new packages.** Phaser `~4.2.1`, Vite `^8.3.2`, TypeScript `~6.0.3` and Vitest `~4.1.11` stay as installed. Do not add a debug-GUI library (dat.gui, lil-gui, Tweakpane): the project allows no runtime deps without an architecture change, and the overlay is about 150 lines of DOM.
- **Phaser 4 APIs used, all verified in `node_modules/phaser/src` (4.2.1):**
  - `game.loop.actualFps`, `rawDelta`, `frame`, `running`, `sleep()` and `wake(seamless)`.
  - `Phaser.Core.Events.POST_RENDER` and `POST_STEP`.
  - `game.scene.getScene(key)`, `scene.sys.isActive()`, `scene.restart(data)`.
  - Check anything else in `node_modules/phaser/skills/` (for example `scenes`, `events-system`) before using it; do not write v3 code from memory.
- **Browser APIs:** `navigator.clipboard.writeText`/`readText` need a secure context (localhost counts) and a user gesture (a DOM button click is one). Firefox 125+ supports `readText` with a paste prompt; keep the `prompt()` fallback.

### File structure

| File | Status |
|---|---|
| `src/view/safetyNet.ts` | new |
| `src/view/strings.ts` | new |
| `src/debug/DebugOverlay.ts` | new (delete `src/debug/.gitkeep`) |
| `src/save/saveFile.ts` | new (delete `src/save/.gitkeep`) |
| `src/main.ts` | modified |
| `src/view/scenes/GameScene.ts` | modified |
| `src/view/scenes/PreloadScene.ts` | modified |
| `tests/save/saveFile.test.ts` | new (delete `tests/save/.gitkeep`) |

### Testing requirements

- Vitest, node environment; it covers `src/sim/` and `src/save/` only. Import only from `src/save`, `src/sim`, `src/config` and `src/core`; never from Phaser or `src/view`.
- Fixed literal seeds; advance with `runFor`. No fake timers, no `Math.random`. `decodeSave` tests pass raw JSON text.
- **Done = `npm test`, `npm run typecheck` and `npm run lint` green**, plus `npm run build` and the evidence from Task 10.

### Project context rules (from `_bmad-output/project-context.md`)

- **Dev-only code** is gated by `import.meta.env.DEV` (debug overlay, `invariant` throws, `log.debug/info`). Production builds must contain none of it.
- **Error handling:** players never see stack traces; errors never pause the game unless the sim itself cannot step.
- **No allocation in hot paths** (`update()`, `step()`, `EntityLayer.sync`). The `try/catch` and the bound `POST_RENDER` handler add none; the overlay builds no strings while it is hidden.
- **No logging, `JSON.stringify` or localStorage in tick or frame code.** `JSON.stringify` runs only on a debug button press.
- **Strings** come from `src/view/strings.ts`, and colours from `COLORS`, with no hex literals in components. The overlay uses `COLORS` too.
- **Listener cleanup:** scene-level `bus.on`/`input.on`/`events.on` are removed on `SHUTDOWN`. The overlay's listeners are on `window` and `game.events` (page-lifetime), registered once.
- **Verify** with the debug overlay at ×1, 100 sheep, 5 minutes, before closing any story that touches movement, rendering or pooling. From now on that check is possible; this story does the first formal run (AC 5).
- Common mistakes: Phaser 3 APIs from memory, game logic in `update()`, `Math.random` in the sim, and forgetting to remove listeners on restart.

### Previous story intelligence (1.3)

- **`rawDelta`, not the smoothed delta,** in `GameScene.update` (the 1.2 finding). Keep it.
- **Multi-tick frames** (×4, ×16) are already handled by `SheepSprite`'s one-tick blend estimate (1.3 review). The ×16 control will exercise it. Expect a maximum per-frame step of about 16 px at ×16 with 3 sheep, which is what the 1.3 review measured.
- **Hot-path strings:** build invariant messages only when the check fails (`if (bad) invariant(false, …)`). Do the same in anything new that runs per frame.
- **Headless verification:** system `google-chrome` driven by `playwright-core` installed in the scratchpad, never as a project dependency. Temporary DEV probes (`window.__probeGame`) must be removed and grep-verified absent from `src/` and `dist/`.
- **Tooling:** `pkill -f 'vite --port …'` matched its own shell in 1.3 (exit 144). Stop the dev/preview server by PID instead.
- **Review lessons:** record evidence for every manual check, list every deviation from the story text, and do not claim a red phase that did not happen.
- **For this story from `deferred-work.md`:** the failed-asset-load message (AC 4). The stale-sprite hazard on a state swap is avoided for the debug load by restarting the scene (gotcha 7), but it stays open for Story 1.9.

### Git intelligence

- The latest commits are `4d2d1da` (1.3 review fixes), `09d896b` (1.3), `8842ba4` (1.2) and `ed1be12` (1.1). The commit style is one commit per story ("Implement story 1.4: developer debug overlay and error safety net"), plus a separate commit for review fixes.
- This story's branch is `story/1-4-developer-debug-overlay-and-error-safety-net`, created from `main` at `4d2d1da`.

### Latest technical notes (checked 2026-10-06)

- The stack is unchanged since 1.3 (Phaser 4.2.1, Vite 8.3.2, TypeScript 6.0.3, Vitest 4.1.11). Vite 8 builds with Rolldown; `import.meta.env.DEV` is statically replaced, so a dynamic import inside a `false` branch is dropped.
- Phaser 4.2.1's `TimeStep.actualFps` is a smoothed per-second estimate (`0.25 × framesThisSecond + 0.75 × previous`). Pair it with the raw frame-time max to see hitches.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.4: Developer Debug Overlay and Error Safety Net]
- [Source: _bmad-output/planning-artifacts/epics.md#Additional Requirements] AR14, AR15; NFR1, NFR8
- [Source: _bmad-output/game-architecture.md#Error Handling], [#Logging], [#Debug Tools], [#Tuning and Debug], [#Architectural Boundaries] rule 4, [#Data Persistence] (save envelope), [#Formats] (`savedAt` in `src/save/` only)
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-sheep-civilization-2026-10-05/DESIGN.md] `announcement-toast` component, Elevation & Depth (toasts in the HUD layer, top-centre)
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-sheep-civilization-2026-10-05/EXPERIENCE.md#Voice and Tone], [#Component Patterns] (toasts: about 4 s, never block clicks)
- [Source: _bmad-output/project-context.md] Platform & Build Rules (dev-only code), Performance Rules
- [Source: _bmad-output/implementation-artifacts/deferred-work.md] Failed asset load (Story 1.4); Sprites across a state swap (Story 1.9)
- [Source: _bmad-output/implementation-artifacts/1-3-sheep-wander-the-pasture.md] Dev Agent Record, Review Findings
- [Source: node_modules/phaser/src/dom/RequestAnimationFrame.js#step], [node_modules/phaser/src/core/TimeStep.js] (`actualFps`, `frame`, `sleep`, `wake`)

## Dev Agent Record

### Agent Model Used

Claude Opus 5.5 (claude-opus-5-5[1m]) via Claude Code, gds-dev-story workflow.

### Implementation Plan

- **`src/view/strings.ts`:** `STRINGS.errorToast` (exact text from the epic) and `STRINGS.assetLoadFailed` ([ASSUMPTION]).
- **`src/view/safetyNet.ts`:**
  - `installSafetyNet(container)`, `attachGame(game)`, `reportError(source, err)` and `showToast(text)`.
  - Window `error` (only `ErrorEvent`s) and `unhandledrejection` handlers call `preventDefault()` and report.
  - Dedupe: the first occurrence of each `source|message` is logged in full with the `Error`; repeats are summarised at most every 10 s; the table is capped at 50 messages.
  - At most one error toast per 10 s.
  - Loop watchdog: 250 ms after an error, if `game.loop.frame` has not moved, the tab is visible and the loop is "running", it runs `loop.sleep(); loop.wake(true)` and logs a `warn`.
  - The toast is one reused DOM element: `announcementToast` tokens, `role="status"`, `pointer-events: none`, placed top-centre 16 px below the canvas's top edge, hidden after 4 s.
  - The Story 1.9 `forceSave()` hook point is a comment.
- **`GameScene`:**
  - `tick()` was extracted, and `update()` is wrapped in `try/catch` → `reportError('sim', …)`, which drops the rest of that frame.
  - `create(data?: GameSceneData)` resumes `data.state` when given.
  - Debug API: `simState`, `simClock`, `stepOnce()`, `debugMutate(fn)` and `loadState(state)` (a scene restart). GameScene does not import `src/debug/`.
- **`PreloadScene`:** after loading, checks `textures.exists` for both atlases. If any is missing it logs a `warn` and shows `assetLoadFailed` once; the `FILE_LOAD_ERROR` warn is kept.
- **`src/save/saveFile.ts`:** `encodeSave(state, now)` builds the `{ schemaVersion, savedAt, state }` envelope; `decodeSave(raw)` does the shallow shape check.
- **`src/debug/DebugOverlay.ts`:**
  - A DOM panel toggled by backtick (`e.code === 'Backquote'`, repeats ignored).
  - Readout from one `POST_RENDER` handler, rewritten every 250 ms: FPS, frame mean and max, time, speed or paused, sheep, carcasses, food meter and pieces, plus a status line.
  - Buttons: ×1/×4/×16, Pause/Resume, Step, +5 food (capped), +10 sheep, Dump state, Copy save, Load save, Throw test error, Reject test promise.
- **`main.ts`:** installs the safety net before fonts load, then attaches the game. Imports the overlay with `if (import.meta.env.DEV) await import(...)`. Boot failures go through `reportError('boot', …)`.

### Debug Log References

- **Red phase (Task 7):** `tests/save/saveFile.test.ts` was written first and failed because `src/save/saveFile` did not exist; after implementation: 18/18. The other new code is view/DOM code, which Vitest does not cover, so it was verified in the browser (below).
- **Speed-0 test (Task 9.3):** the story said `fixedStep.test.ts` already covered speed 0. It did not, so a test was added. It passed on its first run, because the behaviour already existed: it is a characterization test, not red-green.
- **Tree-shaking (AC 2):** after `npm run build`, `grep -rl` over `dist/` for `installDebugOverlay`, `Backquote`, `debug probe`, `Dump state`, `Paste save JSON` and `Copy save` finds 0 files each.
  - There is still exactly one JS chunk (`index-*.js`, 1 394.8 kB; it was 1 394.7 kB before the overlay and safety-net changes reached `dist/`).
  - `simClock` appears once in `dist/`: that is GameScene's debug API, which ships by design (Task 5.1) but is never called.
- **DEV browser check (AC 1, AC 3):** headless system Chrome (SwiftShader) with scratchpad `playwright-core`, clipboard permissions granted. It reads only the overlay's own readout; no probe was added to `src/`. **27/27 checks:**
  - The overlay starts hidden; backtick shows and hides it.
  - ×1/×4/×16 measured 997 / 3 633 / 16 205 game-ms per real second.
  - Pause freezes time; Step adds exactly 100 ms and is disabled while running.
  - +5 food goes 10, 15, 20, 20, 20.
  - Dump logs a snapshot whose `time` matches.
  - Copy writes the envelope (`schemaVersion` 1, ISO `savedAt`).
  - +10 sheep takes 3 sheep to 13. Load restores 3 sheep and the copied time, the dumped state deep-equals the copy, the status reads "save loaded", and the game stays paused.
  - Garbage on the clipboard gives "invalid save" and changes nothing.
  - Throw test error (inside Phaser's `POST_STEP`): one `[ui] Unhandled error` line, the exact toast, the watchdog `warn`, and time keeps advancing (59 800 → 61 600 ms in 1.5 s).
  - Reject test promise: one error line, the toast, and the game keeps running.
  - The toast hides after about 4 s.
  - 0 non-`[tag]` console errors and 0 CDP `pageerror` events.
  - Screenshots: `dev-overlay.png` and `dev-toast.png` in the scratchpad.
- **Production check (AC 3):** `npm run build && vite preview`, with a test-only Playwright init script wrapping `requestAnimationFrame` (rAF counter, plus an optional throw before Phaser's step). **15/15 checks:**
  - No overlay buttons exist and backtick does nothing.
  - A `setTimeout` throw gives one `[ui] Unhandled error: Error: …` line, the exact toast, and frames keep running.
  - `Promise.reject` behaves the same.
  - A frozen loop (rAF callback throws) gives the error line, the toast and the `[ui] Game loop restarted after error` warn; frames run again at 61 rAF/s and the canvas keeps changing.
  - 20 identical errors give 1 log line.
  - No browser "Uncaught" console line and 0 `pageerror` events.
  - **Mutation check:** with `loop.sleep()/wake(true)` commented out, "frames run again" fails (0 rAF/s), so the watchdog is what restores the loop. It was reverted (`git diff` of `safetyNet.ts` is empty against the kept copy).
  - The same mutant showed that the canvas-changed check passed vacuously (its first screenshot was taken before the freeze). Both screenshots are now taken after recovery, and the rerun against the real build passes 15/15.
- **Asset failure (AC 4):** three runs. `ui.json` was moved out and restored every time; `git status public/` is clean.
  - **Vite dev:** the missing file is answered with `index.html` (200 OK), Phaser's JSON parse fails, and **`FILE_LOAD_ERROR` never fires**. Phaser's `JSONFile.onProcess` rethrows the `SyntaxError`, which the safety net reports. With the original event-only check, the player saw only the generic error toast, so `PreloadScene` now checks `textures.exists()` after loading.
  - **Dev again, after the fix:** toast "Some of the pasture didn't load. Try reloading the page." and `[boot] Atlases missing after load [ui]`.
  - **`vite preview`:** the same parse path, with the same result.
  - **Real 404** (`python3 -m http.server` over `dist/`, as on static hosts): `[boot] Asset failed to load: ui …`, the missing-atlas warn, and the asset toast.
- **100-sheep performance check (AC 5):** DEV, 103 sheep (3 + 10 × "+10 sheep"), ×1, 5 minutes, overlay open, headless SwiftShader.
  - **Overall:** 15 530 frames, mean 19.35 ms (**51.7 FPS**), p50 16.7 ms, p95 33.4 ms, max 83.3 ms.
  - **Hitches:** 390 frames over 33 ms. The overlay readout stayed between 44 and 58 FPS.
  - **Errors:** none in 5 minutes, and all sheep stayed in the pen.
  - **Comparison, 60 s each with 103 sheep:**
    - This story, overlay visible: 47.9 FPS.
    - This story, overlay hidden: 54.2 FPS.
    - **Baseline `4d2d1da`** (1.3, no overlay; `interimFlockAdults: 103` in a temporary worktree, now removed): **50.2 FPS**.
  - **Conclusion:** this story causes no regression. Headless SwiftShader (CPU rendering) cannot hold 60 FPS with about 100 sheep over a sustained run. The 1.3 record's 10 s figure (16.6 ms mean) was optimistic. The visible overlay costs about 6 FPS here, because DOM text writes force SwiftShader compositing.
  - **NFR1 on the target hardware (60 FPS on an integrated-GPU laptop in Chrome and Firefox) is still unverified;** it needs a real browser on Rylan's machine. Use the overlay with "+10 sheep" ×10, then close it during the run.
- **Cleanup:**
  - Harness globals (`__rafCalls`, `__throwNextRaf`, `__dts`, `__probe`) are found in neither `src/` nor `dist/`.
  - `interimFlockAdults` is still 3.
  - The temporary worktree was removed, and the dev, preview, baseline and static servers were stopped by PID; no ports are left listening. Killing the saved `npx` PIDs left the Vite children running, so they were stopped by their listening PIDs.

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created
- **AC 1:** all overlay readouts and controls work in DEV (27/27 browser checks).
- **AC 2:** the overlay is absent from `dist/` (grep evidence; one chunk).
- **AC 3:**
  - Unhandled errors and rejections are logged once via `log.error`, with the exact toast in both builds; nothing else appears on screen.
  - The game keeps running for errors in timers, in promises, in the sim (caught in `GameScene`), and inside Phaser's frame (watchdog restart, mutation-checked).
  - Forcing a save is left as a marked hook for Story 1.9.
- **AC 4:** a missing or corrupt atlas shows the asset toast, through either failure path.
- **AC 5:** the formal run was done and recorded in headless Chrome. No regression from this story; the on-hardware 60 FPS check is still open (see the Debug Log).
- **AC 6:** `npm test` 97/97 in 16 files; typecheck (both configs), lint and build are clean (the existing Phaser chunk-size warning only).
- **Deviations from the story text:**
  1. **Asset failure detection:** `PreloadScene` checks `textures.exists()` after loading instead of setting a flag from `FILE_LOAD_ERROR` (Task 4.1). The event never fires for a file that downloads but fails to parse. The warn stays on the event, and a second warn names the missing atlases.
  2. **Debug speed survives Load:** the overlay re-applies its chosen speed (including pause) when GameScene's clock instance changes after a restart. Without this, loading a save while paused un-paused the game. The story did not specify it.
  3. **Speed-0 test added** to `tests/core/fixedStep.test.ts`. The story claimed one already existed.
  4. **Safety-net API:** `installSafetyNet(container)` plus `attachGame(game)`, one of the two shapes the story allowed. `reportError` takes a `LogTag` as its source.
  5. **Toast position:** top-centre of the viewport horizontally, and 16 px below the canvas's top edge (from `getBoundingClientRect`), so it stays inside the letterboxed canvas.
  6. **Repeat summaries:** logged as `[tag] Repeated N×: …` at most every 10 s, and only when another repeat arrives after the window (not on a timer).
- **For Rylan:**
  - `STRINGS.assetLoadFailed` ("Some of the pasture didn't load. Try reloading the page.") is an [ASSUMPTION]; it is not in the Voice table.
  - The error toast says "your flock was saved" although saving arrives only in Story 1.9, as the AC allows.
  - **A fixed asset path can still look broken in dev:** a dev or preview server serves `index.html` for missing files, so a wrong asset path shows up as a JSON parse error in the console, not a 404.

### File List

- `src/view/safetyNet.ts` (new)
- `src/view/strings.ts` (new)
- `src/debug/DebugOverlay.ts` (new)
- `src/save/saveFile.ts` (new)
- `src/main.ts` (modified)
- `src/view/scenes/GameScene.ts` (modified)
- `src/view/scenes/PreloadScene.ts` (modified)
- `tests/save/saveFile.test.ts` (new)
- `tests/core/fixedStep.test.ts` (modified)
- `src/debug/.gitkeep` (deleted)
- `src/save/.gitkeep` (deleted)
- `tests/save/.gitkeep` (deleted)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modified)
- `_bmad-output/implementation-artifacts/1-4-developer-debug-overlay-and-error-safety-net.md` (this story)

## Change Log

| Date | Change |
|---|---|
| 2026-10-06 | Implemented the global error safety net (dedupe, DOM toast, loop watchdog), sim error containment in `GameScene`, the DEV-only debug overlay (speed, pause, step, food, sheep, dump, clipboard save copy and load, safety-net probes), the save envelope codec, and the missing-atlas toast. Tests 97/97. The formal 103-sheep, 5-minute run was recorded headless. Status → review. |
