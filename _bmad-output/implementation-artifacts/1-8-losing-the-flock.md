---
baseline_commit: 2c3f034b3ca2db88083d91d10d5e4d0d3abdf2f9
---

# Story 1.8: Losing the Flock

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a player,
I want a clear lose screen when my last sheep dies,
so that I know the run is over and can start again.

## Acceptance Criteria

1. **Loss is detected in the death pipeline (FR38, AR17).** Given the flock drops to 0 sheep, when `checkLastSheepAndLoss` runs inside `killSheep`:
   - `state.lostAt` is set to `state.time` (once only).
   - Exactly one `Lost` event is emitted, after the last `SheepDied`.
   - `checkLastSheepAndLoss` is exported from `systems/carcass.ts`, so Epic 2's `removeSheep` (sell/sacrifice) can call it too.
2. **The sim stops (FR38, UX-DR19).** Once `lostAt` is set:
   - `step()` does nothing: no time advance, no system runs, no events.
   - `applyCommand()` ignores every command.
   - `GameScene` stops ticking (the clock no longer advances and pending commands are dropped). The field stays rendered, frozen behind the scrim.
3. **Lose screen (UX-DR19, UX-DR20, UX-DR21, UX-DR95).** A new `OverlayScene` runs in parallel above `HudScene`. On `Lost` it shows:
   - a full-canvas `menu-scrim` (`duskDeep` at 72%) that swallows clicks (clicking it does nothing, and the HUD below it gets no input);
   - then a centred `lose-panel` (`dusk` fill, `rounded.lg`) with "The flock is gone." in `display` type (`wool`);
   - "Survived {m:ss} · Peak flock {n}" in `halo`, built with `formatGameTime(lostAt)` and `stats.peakFlock`;
   - one **Restart** `button-menu`.
   - If the scene starts on a state that is already lost (debug Load now, Story 1.9 resume later), the screen shows at once, without waiting for an event.
4. **Peak flock is tracked in state.** `stats.peakFlock` is the most sheep ever alive at once in this game.
   - `createSheep` raises it, so new games, debug "+5 sheep" and later births (2.3) are all covered.
   - Deaths never lower it.
5. **Restart (UX-DR19).** When I click **Restart**, a new game starts at once with no confirmation: a fresh `createNewGame` state, an empty Farm bar, and HUD and Overlay rebuilt with no duplicate listeners. Wiping the save is Story 1.9's (there is no `saveStore` yet); leave a marked hook.
6. **Nothing works while lost.** The Farm button and `F` do nothing while lost: no squash, no command. Clicks on the scrim reach nothing.
7. **No win state (FR39).** No code path ends the game except a loss. No win screen or end screen exists.
8. **Copy (AR22, UX-DR95).** "The flock is gone.", the stats line and "Restart" come from `src/view/strings.ts`. Colours and sizes come from `COLORS`, `COMPONENTS` and `TYPOGRAPHY` only.
9. **Green gate.** `npm test`, `npm run typecheck`, `npm run lint` and `npm run build` all pass, and the debug overlay is absent from `dist/`.

## Tasks / Subtasks

- [x] **Task 1: State: `lostAt` and peak flock** (AC: 1, 2, 4)
  - [x] 1.1 In `src/sim/state.ts`, add `lostAt?: number` to `GameState` with a doc comment: "Game-ms of the loss (flock reached 0). Omitted while playing; set once by `checkLastSheepAndLoss`. While present the sim does not step."
    - It is **optional and omitted**. Never write `lostAt: undefined` or `null` (project-context: optional fields are omitted). `createNewGame` does not write it.
    - It follows the `…At` naming rule. Time survived equals `lostAt`, because `state.time` counts game-ms since the save began.
  - [x] 1.2 Move the peak update into `createSheep`, after the push: `if (state.sheep.length > state.stats.peakFlock) state.stats.peakFlock = state.sheep.length;`.
    - Delete the now redundant `state.stats.peakFlock = state.sheep.length;` in `createNewGame`. `stats.peakFlock` still starts at 0 in the literal and ends at `interimFlockAdults`.
    - Delete the hand-rolled peak line in `src/debug/DebugOverlay.ts` `addSheep` (it goes through `createSheep` now).
    - Peak counts living sheep only. It does not count pregnancies (they arrive in 2.3, and the lose copy says "flock").
  - [x] 1.3 **No `SAVE_SCHEMA_VERSION` bump** (stays 2).
    - A version-2 save without `lostAt` means exactly what it meant before ("still playing"), so no migration is needed.
    - Add one line to the `SAVE_SCHEMA_VERSION` comment in `src/config/constants.ts`: "Optional fields whose absence keeps the old meaning (e.g. `lostAt`, 1.8) need no bump."
    - This is a deliberate reading of the project-context rule. Its purpose is to stop a field's meaning from changing under old saves. See Questions.
  - [x] 1.4 `tests/sim/state.test.ts`: the `Object.keys(newGame())` list is unchanged, since `lostAt` is omitted. Add an assertion that `'lostAt' in newGame()` is false.
- [x] **Task 2: Events** (AC: 1)
  - [x] 2.1 In `src/sim/events.ts`, add `| { type: 'Lost'; survivedMs: number; peakFlock: number }` with a comment: "The flock reached 0 (checkLastSheepAndLoss). Emitted once per game, after the last SheepDied."
    - Update the header list of variants.
    - The architecture names `Lost` but gives no payload; this one lets audio/stats (5.4/5.6) react without reading state.
  - [x] 2.2 Do **not** add `LastSheep`. It belongs to Story 5.5 (Should tier). Leave a comment in `checkLastSheepAndLoss`: "Story 5.5: emit LastSheep when the flock drops to 1."
  - [x] 2.3 Search for any `switch` over `SimEvent['type']` (today there are only `if` checks in `GameScene`/`HudScene`). Any `switch` must still end in `assertNever`.
- [x] **Task 3: `checkLastSheepAndLoss`** (AC: 1)
  - [x] 3.1 In `src/sim/systems/carcass.ts`, add and export:
    ```ts
    /** Pattern N1: run after every removal (killSheep now, removeSheep in Epic 2). Loss = 0 sheep alive (FR38). */
    export function checkLastSheepAndLoss(state: GameState): void {
      if (state.sheep.length > 0 || state.lostAt !== undefined) return;
      state.lostAt = state.time;
      emit({ type: 'Lost', survivedMs: state.lostAt, peakFlock: state.stats.peakFlock });
    }
    ```
  - [x] 3.2 Call it as the **last** line of `killSheep`, after `emit(SheepDied)`, replacing the `// Story 1.8:` comment.
    - Update the file header: `removeSheep` (Epic 2) must call it too, because selling or sacrificing the last sheep is a loss.
  - [x] 3.3 Multiple deaths in one tick: `updateHunger` loops over the captured start-of-tick array, so every starving sheep in that tick still dies (and is counted), and `Lost` fires only once, after the final death. That is correct: do **not** break out of the hunger loop on loss.
- [x] **Task 4: The sim stops** (AC: 2, 6)
  - [x] 4.1 In `src/sim/step.ts`, add `if (state.lostAt !== undefined) return;` as the first line of `step`, **before** `state.time += TICK_MS`. Comment it (FR38: a lost game is stopped; time survived stays fixed).
  - [x] 4.2 In `src/sim/commands.ts` `applyCommand`, return early when `state.lostAt !== undefined`, before the `switch`. The sim is the authority; the view guards are only for feel.
  - [x] 4.3 In `src/sim/selectors.ts`, add the read-only views. Both are pure, and `selectLoseView` fills `out` with no allocation, like `selectHudView`:
    ```ts
    export function isLost(state: GameState): boolean { return state.lostAt !== undefined; }
    export interface LoseView { survivedMs: number; peakFlock: number; }
    export function selectLoseView(state: GameState, out: LoseView): LoseView { … }
    ```
    `survivedMs` = `state.lostAt ?? state.time`.
- [x] **Task 5: GameScene** (AC: 2, 5)
  - [x] 5.1 In `update()`, when `isLost(this.state)`, do not tick: skip `clock.advance` and empty `pendingCommands` (`length = 0`), but keep `render()` and `sheepHover.update`, so the field stays drawn behind the scrim. Keep the `reportError('sim')` guard around all of it.
    - Do **not** call `scene.pause()` (project-context Pausing rule).
    - `stepOnce` (debug) may still call `tick()`: `step` is a no-op when lost, so this is harmless.
  - [x] 5.2 Add a public `newGame(): void` to the Scene API section: `this.scene.restart({})`.
    - Data is already consumed in `create`, so an empty restart builds a fresh `createNewGame`.
    - Add the marked hook comment: `// Story 1.9: saveStore.wipe() here (Lose → Restart wipes without confirm; settings are kept).`
    - Phaser queues scene operations, so calling this from an OverlayScene pointer handler is safe.
  - [x] 5.3 In `create()`, launch `'OverlayScene'` right after `'HudScene'`. `launch` restarts a running scene, so every restart rebuilds the overlay fresh, as the HUD already does.
- [x] **Task 6: HudScene guard** (AC: 6)
  - [x] 6.1 In `HudScene.farm`, return before `squash()` when `isLost(this.gameScene.simState)`. This covers both the click and the `F` key, which shares this path.
  - [x] 6.2 Leave `refresh` as is. The bar keeps showing its last value under the scrim.
- [x] **Task 7: OverlayScene and LosePanel** (AC: 3, 5, 8)
  - [x] 7.1 New `src/view/scenes/OverlayScene.ts`, key `'OverlayScene'` (scene key = class name). Register it in `src/main.ts` **after** `HudScene` in the `scene` array (array order = render order, so it draws on top). Update the comment there.
  - [x] 7.2 The scene owns **one scrim**, which Story 1.10's pause and confirm modals will reuse:
    - Build it once, hidden: `this.add.rectangle(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT, COLOR_INT[COMPONENTS.menuScrim.backgroundColor], 1).setOrigin(0, 0)`. Its alpha is tweened up to `COMPONENTS.menuScrim.opacity`.
    - `setInteractive()` it with no handlers, so it swallows clicks. Phaser's `InputManager.globalTopOnly` (default true) stops input from reaching lower scenes once the top scene's object is hit, so the HUD's Farm button under the scrim gets nothing. **Verify this in the browser** (Task 9), and check `node_modules/phaser/skills/input-keyboard-mouse-touch/` rather than memory.
    - Note: a static Shape is fine. Only Graphics redrawn per frame are banned.
  - [x] 7.3 New `src/view/overlay/LosePanel.ts` (the architecture's `overlay/` folder; `src/view/overlay/.gitkeep` exists, so delete it). It builds:
    - A `Panel` with `{ fill: COMPONENTS.losePanel.backgroundColor, radius: RADIUS[COMPONENTS.losePanel.rounded] }`, keeping the default bark border and drop (UX-DR8). **Fixed size** (deferred-work: `boxTexture` never evicts, so keep `Panel` sizes fixed). Starting point **[ASSUMPTION]**: 680 × 256, centred on the canvas at (300, 232). Measure the title at runtime once in the browser and keep at least 32 px of padding each side, adjusting the constant if needed.
    - The title `Text`: `STRINGS.loseTitle`, `textStyle('display', COMPONENTS.losePanel.textColor)`, origin (0.5, 0), centred.
    - The stats `Text`: `textStyle('numeric', COMPONENTS.losePanel.statColor)`, origin (0.5, 0), centred, about 16 px under the title. **[ASSUMPTION]** `numeric` type: the docs say "stats in `halo`" with no role, and UX-DR4 maps numbers to `numeric`.
    - The **Restart** `Button`: `COMPONENTS.buttonMenu`, width `COMPONENTS.buttonMenu.width` (280), centred, about 32 px under the stats, `activateOn: 'release'` (menu button), label `STRINGS.restart`, no key hint, no tooltip.
    - Note: `Panel.setBounds` makes the panel visible, so call `setVisible(false)` after it when building hidden.
    - Methods: `show(view: LoseView)`, which sets the stats text once (`STRINGS.loseStats(formatGameTime(view.survivedMs), view.peakFlock)`) and makes everything visible, and `setVisible(false)` for the start state. The panel is built once in `create`, never per show.
  - [x] 7.4 Order and transition (EXPERIENCE State Patterns: "the sim stops, a scrim appears, then `lose-panel`"):
    - Fade the scrim from 0 to 0.72 over **[ASSUMPTION]** 250 ms, then show the panel.
    - Tweens are visual only: no tween `onComplete` changes `GameState`. Showing the panel from `onComplete` is fine.
    - Reduced motion (5.7) will not change a fade; nothing to add.
  - [x] 7.5 Wiring in `create()`:
    - `gameScene = this.scene.get('GameScene') as GameScene`.
    - Build the scrim and panel hidden.
    - Listen with `bus.on('sim', this.onSim, this)`. `onSim` shows the lose screen on `e.type === 'Lost'`, wrapped in `try/catch → reportError('ui', err)`, because it runs inside GameScene's tick drain.
    - Then, if `isLost(gameScene.simState)`, show it at once with no fade (a loaded lost state).
    - Remove the bus listener in `this.events.once(Phaser.Scenes.Events.SHUTDOWN, …)`. A `showing` flag makes a second `Lost` or a double show a no-op.
  - [x] 7.6 Restart: the button's `onActivate` calls `this.gameScene.newGame()` inside `try/catch → reportError('ui')`, because it runs in Phaser's input step.
  - [x] 7.7 Depth inside the scene: scrim 0, panel 10, its texts and button 11 (constants at the top of the file, as in `HudScene`).
- [x] **Task 8: Strings** (AC: 3, 8)
  - [x] 8.1 In `src/view/strings.ts`, add:
    - `loseTitle: 'The flock is gone.'`
    - `loseStats: (time: string, peak: number): string => \`Survived ${time} · Peak flock ${peak}\``
    - `restart: 'Restart'`
    - Use the comment "Lose screen (UX-DR19, UX-DR95; EXPERIENCE Voice)". The middle dot is U+00B7, as in `sheepTooltip`. No "!".
- [x] **Task 9: Tests (red first for the sim)** (AC: 1, 2, 4, 7, 9)
  - [x] 9.1 `tests/sim/systems/carcass.test.ts`:
    - Killing the last sheep sets `lostAt === state.time` and drains `[SheepDied, Lost{ survivedMs: state.time, peakFlock }]` in that order.
    - Killing a non-last sheep sets no `lostAt` and emits no `Lost`.
    - Calling `checkLastSheepAndLoss` again on a lost state changes nothing and emits nothing.
    - `checkLastSheepAndLoss` with sheep alive does nothing.
  - [x] 9.2 `tests/sim/step.test.ts`: on a lost state (kill every sheep first), `step` leaves the state `toStrictEqual` a `structuredClone` taken before, and `runFor(state, 5_000)` returns `[]`.
  - [x] 9.3 `tests/sim/commands.test.ts`: `Farm` on a lost state leaves `farmProgress`, `foodPieces` and `nextId` unchanged and emits nothing. Set `farmProgress` to `TUNING.farmPipsPerFood - 1` first, so an un-guarded Farm would visibly drop a piece.
  - [x] 9.4 `tests/sim/state.test.ts`:
    - `createSheep` raises `peakFlock` (use `fillFlock(state, 5)`, expect 5).
    - After `killSheep` it stays 5.
    - A new game has `peakFlock === TUNING.interimFlockAdults` (already asserted) and no `lostAt`.
  - [x] 9.5 `tests/sim/selectors.test.ts`: `isLost` is false on a new game and true after the loss. `selectLoseView` reuses `out` (same object returned) and reports `lostAt` and `peakFlock`.
  - [x] 9.6 Scenario `tests/sim/scenarios/starvation.test.ts` (extend; it already starves the flock):
    - Exactly one `Lost`, and it is the last event.
    - `survivedMs === state.lostAt` and equals the time of the last `SheepDied`'s tick. The whole flock starts at Fullness 60, so all three die on the same tick, which is `state.time`.
    - `peakFlock === TUNING.interimFlockAdults`.
    - The state still round-trips through JSON with `lostAt`.
    - A further `runFor(state, TUNING.starveMs)` changes nothing (`time` unchanged).
  - [x] 9.7 Add a scenario where sheep die on **different** ticks, so you can tell "the last death" from "any death":
    - Preset one sheep's `fullness` lower, e.g. `TUNING.starvingBelow`.
    - Assert that `Lost` follows only the final `SheepDied`, and `lostAt` equals that later tick's time.
  - [x] 9.8 Use `TUNING` in assertions, never literals. Use `newGame(seed)` with fixed seeds and no fake timers.
  - [x] 9.9 `tests/save/saveFile.test.ts`: a state with `lostAt` encodes and decodes unchanged.
- [x] **Task 10: Browser verification** (AC: 3, 5, 6, 7)
  Use the 1.7 approach: a scratchpad `playwright-core` probe with system Chrome, a DEV server, and a temporary `window.__probeGame` hook that you remove afterwards. Check these:
  - **Loss:** debug speed ×16 on a new game. The flock starves at about 72 game-seconds (about 4.5 s real time). The scrim fades in, then the panel shows "The flock is gone." and "Survived 1:12 · Peak flock 3" (read the real `lostAt`). There are no sheep on the frozen field, the leftover food pieces are still drawn, and `state.time` stops advancing.
  - **Layout:** the panel is centred inside the canvas, the title fits with at least 32 px padding, the Restart button is 280 × 52, and nothing renders below 18 px. Check at 1280×720 and 960×540.
  - **Input blocked:** clicking the scrim over the Farm button does not squash it, adds no pip, and leaves the sim unchanged. `F` does nothing. Clicking the scrim elsewhere does nothing.
  - **Restart:**
    - Restart gives a new flock of 3, "0/8" and no pieces, with the scrim and panel hidden.
    - After 3 Restarts there is exactly 1 bus `sim` listener per scene, and one F press is one pip.
    - Lose a second time: one panel and one `Lost` handler.
  - **Debug Load of a lost state** (Copy save after losing, then Restart, then Load save): the lose screen shows at once with the same numbers.
  - **Grow peak:** "+5 sheep" twice, then lose. "Peak flock 13".
  - No console errors. Remove the probe hook afterwards and check that `dist/` has no `__probeGame`.
- [x] **Task 11: Docs and deferred work** (AC: 9)
  - [x] 11.1 Append to `_bmad-output/implementation-artifacts/deferred-work.md` under "Deferred from: story 1-8-losing-the-flock":
    - **(1.9)** Lose → Restart must call `saveStore.wipe()` at the `GameScene.newGame` hook, and settings must survive.
    - **(1.9)** Validation must accept an absent `lostAt` and reject a present non-finite or negative one, or one greater than `time`. A saved lost game resumes straight to the lose screen.
    - **(1.10)** The `Esc` chain must do nothing while the lose panel is up (no pause over a lost game). The modal check that ignores F/G must include the lose panel. The scrim lives in `OverlayScene` for reuse.
    - **(1.10)** The deferred "HudScene lifetime" item now also covers `OverlayScene`.
    - **(2.4)** `removeSheep` must call `checkLastSheepAndLoss`.
    - **(5.5)** `LastSheep` is emitted from `checkLastSheepAndLoss`.
  - [x] 11.2 Mark the 1.6 "HudScene lifetime" item as unaffected: GameScene keeps running after a loss, so the HUD's reads stay valid.

## Dev Notes

### What exists today (read before changing)

- **`src/sim/systems/carcass.ts`:** `killSheep` finds the sheep, replaces `state.sheep` with a filtered copy, does `stats.died += 1`, skips the carcass (`TUNING.carcassesEnabled` is false in Epic 1) and emits `SheepDied`. Line 29 is the `// Story 1.8: checkLastSheepAndLoss(state) here.` placeholder. **Preserve** the invariant for unknown ids (the test expects a throw in DEV and no state change).
- **`src/sim/state.ts`:** `Stats` already has `peakFlock`. `createNewGame` sets it from `sheep.length` after the founding loop. `createSheep` is the only sheep factory.
- **`src/sim/step.ts`:** advances time first, then `[updateMovement, updateFeeding, updateHunger]`. Hunger runs last, so a loss happens at the end of a tick.
- **`src/sim/commands.ts`:** only `Farm`. It sanitises a corrupt `farmProgress`, then drops a piece per full bar. Ends in `assertNever(cmd.type)`.
- **`src/sim/selectors.ts`:** `selectHudView(state, out)` is the in-place pattern to copy for `selectLoseView`.
- **`src/core/format.ts`:** `formatGameTime(ms)` gives `m:ss`, or `h:mm:ss` from an hour, and is tested. Use it; do not write a new formatter.
- **`src/view/scenes/GameScene.ts`:**
  - It owns the clock, the commands at the start of each tick, the drain to `bus 'sim'`, and render.
  - `create()` consumes `data.state` (so a plain restart is a new game), resets `pendingCommands`, and launches `HudScene`.
  - **Preserve:** the `reportError('sim')` guard, the `rawDelta` comment, `loadState`'s probe, and the debug API (`simClock`, `stepOnce`, `debugMutate`).
- **`src/view/scenes/HudScene.ts`:** reads on `PRE_RENDER` (Phaser updates scenes in reverse order). `farm()` is shared by click and F. Listeners are removed on SHUTDOWN. Copy this structure for `OverlayScene`.
- **Widgets:**
  - `Panel(scene, {fill, border, radius, drop})` + `setBounds(x, y, w, h)` (bakes a texture per size), `setDepth`, `setVisible`.
  - `Button(scene, spec, {x, y, width, label, activateOn, onActivate})` has `setDepth`. It has **no `setVisible`**: add one that toggles the root container and the zone's input (`zone.setVisible` + `disableInteractive`/`setInteractive`). Otherwise use the panel's own visibility plus the scrim blocking. Simplest: give `Button` `setVisible(v)` that sets `root.setVisible(v)` and `zone.input.enabled = v`.
  - `textStyle(role, colorToken)`.
- **`src/debug/DebugOverlay.ts`:** "+5 sheep" (`addSheep`) bumps `peakFlock` by hand (line 320); remove that line (Task 1.2). Speed ×16 and "Copy/Load save" are your test tools.
- **`src/view/overlay/`:** only `.gitkeep`.

### Gotchas

1. **Order in `killSheep`:** `SheepDied` must be emitted before `checkLastSheepAndLoss`, so `Lost` is the last event of the tick.
2. **Do not stop the hunger loop on loss.** The other sheep starving in the same tick still die, so `stats.died` stays right, and `lostAt` is that tick's time either way.
3. **`step` guard before `time += TICK_MS`.** Otherwise time survived keeps growing behind the panel.
4. **Optional field hygiene:** `lostAt` is never written as `undefined`. Restart builds a fresh state, so there is nothing to `delete`.
5. **Restart path:** `scene.restart({})` → `create()` → `launch('HudScene')` and `launch('OverlayScene')` restart those scenes. Every `bus.on` in `OverlayScene` needs its SHUTDOWN `off`, or a second loss after Restart shows two panels or throws on destroyed objects. `Button` already removes its `GAME_OUT` listener on SHUTDOWN.
6. **`boxTexture` cache:** the panel and button sizes are fixed constants. Never size the panel from measured text at runtime, or every font fallback bakes a new texture.
7. **Fonts:** text is created in `create()`, after `main.ts` has loaded the fonts. Do not build `Text` in a constructor.
8. **Input blocking is cross-scene.** If the browser check shows that HUD clicks leak through the scrim, `HudScene.farm`'s `isLost` guard still keeps the game correct. But fix the leak (for example `this.input.setTopOnly(true)`, or check the `globalTopOnly` setting), because Story 1.10's pause needs the same scrim to block.
9. **Debug "+5 sheep" after a loss** adds sheep to a stopped game. The panel stays and the sim stays stopped. That is acceptable for a DEV tool; do not special-case it.
10. **No Phaser 3 code from memory:** check `node_modules/phaser/skills/{scenes,input-keyboard-mouse-touch,tweens}/`. `scene.launch` restarts a running scene, and `scene.restart(data)` passes data to `create`.
11. **There is no audio or juice for the loss** in any doc. Do not invent an SFX or caption. The death `[thud]` arrives with 5.6.

### Architecture compliance

- **N1:** deaths only through `killSheep`, which now ends with `checkLastSheepAndLoss`. Nothing else splices `state.sheep`.
- **Sim purity:** the new code in `carcass.ts`, `step.ts`, `commands.ts` and `selectors.ts` imports only `config`, `core` and `sim`.
- **The view never mutates state.** Restart builds a new state through `GameScene.newGame()` (a scene restart), not by editing the old one.
- **The sim is stopped in state (`lostAt`),** so a saved lost game cannot resume play (1.9). Pause (1.10) is different: it stops the clock and is not saved.
- **Derived values are not stored.** `isLost` is derived from `lostAt`, and `lostAt` is a real event time. `peakFlock` is a running maximum, which cannot be derived from the current state.
- **Scenes:** `OverlayScene` is a parallel scene that never steps the sim, with listeners removed on SHUTDOWN, as the architecture says (Overlay: "Pause, Volume, Stats, Credits, Shop panel, start-over confirm, Lose").
- **No allocation in hot paths:** `update()` while lost does no new work, and `selectLoseView` fills `out`.

### File list (expected)

- **New:**
  - `src/view/scenes/OverlayScene.ts`
  - `src/view/overlay/LosePanel.ts`
- **Deleted:** `src/view/overlay/.gitkeep`
- **Modified:**
  - Sim and core: `src/sim/state.ts`, `src/sim/events.ts`, `src/sim/step.ts`, `src/sim/commands.ts`, `src/sim/selectors.ts`, `src/sim/systems/carcass.ts`
  - Config: `src/config/constants.ts` (schema comment only)
  - View: `src/view/scenes/GameScene.ts`, `src/view/scenes/HudScene.ts`, `src/view/strings.ts`, `src/view/widgets/Button.ts` (`setVisible`), `src/main.ts`
  - Debug: `src/debug/DebugOverlay.ts`
  - Tests: `tests/sim/systems/carcass.test.ts`, `tests/sim/step.test.ts`, `tests/sim/commands.test.ts`, `tests/sim/state.test.ts`, `tests/sim/selectors.test.ts`, `tests/sim/scenarios/starvation.test.ts`, `tests/save/saveFile.test.ts`
  - Docs: `_bmad-output/implementation-artifacts/deferred-work.md`

### Previous story intelligence (1.7)

- **Red first** for sim rules. Assert on state and drained events. Narrow `SimEvent` on `type`. Use `TUNING` only.
- **Handlers that run inside the tick drain or Phaser's input step need their own `try/catch → reportError('ui')`.**
- **Scene events persist across restarts.** Remove every listener on SHUTDOWN, and repeat the "exactly one listener after 3 restarts" check.
- **Static boxes are baked with `boxTexture`** (live Graphics cost about 5 FPS).
- **The 1.7 review bumped the schema** when a field's meaning changed. This story's field does not change any old meaning (Task 1.3).
- **Browser probes:** keep them in the scratchpad, remove the hook afterwards, and confirm `dist/` is clean.

### Git intelligence

- Commits follow "Implement story X", then "Apply story X code review fixes".
- This story's branch is `story/1-8-losing-the-flock`, off `main` at `2c3f034`.
- The 1.7 diff touched `carcass.ts` not at all, and `killSheep` dates from 1.5. Its tests in `tests/sim/systems/carcass.test.ts` are the place to extend.

### Latest tech information

- No new dependencies. The stack is pinned: Phaser ~4.2.1 (installed 4.2.1), TS ~6.0, Vite 8, Vitest ~4.1.
- Scene APIs are the source of truth in `node_modules/phaser/skills/scenes/SKILL.md`: `launch` runs scenes in parallel, `restart` re-runs `init`/`create`, render order is array order, and SHUTDOWN is the cleanup event.
- The input `topOnly` docs are in `input-keyboard-mouse-touch/SKILL.md` §"Input Debug, topOnly".

### Project Structure Notes

- The loss rule lives in `src/sim/systems/carcass.ts`, the owner of the death pipeline (N1), with the stop guards in `step.ts` and `commands.ts`.
- `OverlayScene.ts` goes in `src/view/scenes/`, and `LosePanel.ts` in `src/view/overlay/`, as the architecture's directory tree shows.
- No conflicts. The architecture puts the shop panel in Overlay while DESIGN puts it in the HUD layer; that is Story 3.2's call, not this story's.

### Project Context Rules

- Phaser 4, not 3. No physics. Do not use `scene.pause()` for gameplay stops.
- No Phaser timers, tween `onComplete` or data stores for game state. The scrim fade is visual only.
- Listener cleanup on SHUTDOWN; restart must not double-subscribe.
- Determinism: fixed seeds, `runFor`, no fake timers, `TUNING` in assertions.
- Colours come from `COLORS`/`COMPONENTS` and copy from `STRINGS`. No "!", "kill", "corpse" or "blood" in UI text.
- GameState is plain JSON, and optional fields are omitted.
- Done = `npm test`, `npm run typecheck`, `npm run lint` and `npm run build` pass. The visuals are verified in the browser.

### References

- Epic story: `_bmad-output/planning-artifacts/epics.md`, "Story 1.8"; FR38, FR39, AR6, AR7, AR17, AR22, UX-DR4, UX-DR10, UX-DR19, UX-DR20, UX-DR21, UX-DR95.
- Architecture: `_bmad-output/game-architecture.md`:
  - Scene Structure (Overlay row, `Lost` event);
  - Game Time (pause = stop accumulating);
  - Data Persistence ("Lose → Restart wipes without confirm");
  - Formats (`formatGameTime`, `m:ss`);
  - N1 Single Death Pipeline (`checkLastSheepAndLoss`, `removeSheep`, Epic 1 staging);
  - Event naming;
  - Directory Structure (`overlay/LosePanel`).
- UX:
  - `DESIGN.md`: components `lose-panel`, `menu-scrim`, `button-menu`, `panel`; the Typography table (display = "The flock is gone."); Elevation layer 4 (Modal).
  - `EXPERIENCE.md`: IA diagram (Lose screen → Restart → new game); State Patterns ("Lose"); Component Patterns ("Lose panel", "Panel / menu scrim"); Voice table ("Survived 12:34 · Peak flock 18").
- GDD: `gdd.md` Win/Loss Conditions (no win; loss at 0; time survived and peak flock; Restart wipes the save).
- Project rules: `_bmad-output/project-context.md`.
- Previous story: `1-7-drop-food-and-sheep-eat.md`. Deferred items: `deferred-work.md` (1.6 "Baked box textures (1.8 …)", "HudScene lifetime"; 1.2/1.6 "Commands and pausing").

### Questions for Rylan (non-blocking; the defaults above apply)

1. **Schema bump:** this story keeps `SAVE_SCHEMA_VERSION` at 2, because `lostAt` is optional and its absence keeps the old meaning. Do you want a strict bump to 3 instead, so every `GameState` field change bumps?
2. **Stats line type:** `numeric` (Pixelify 22) in `halo` is assumed. Prefer `title` (32) for more weight?
3. **Panel size:** 680 × 256 at the canvas centre is a starting point; it is tuned to the measured title in the browser.

## Dev Agent Record

### Agent Model Used

Claude Opus 5.5 (1M context), `claude-opus-5-5[1m]`

### Implementation Plan

- **Red first (sim):** the loss, stop, peak and lose-view tests were written before the code.
  - The red run had 11 failures, all in the new tests: `checkLastSheepAndLoss` not exported, no `lostAt`, no `isLost`/`selectLoseView`, `step`/`Farm` still running after a loss, and the peak not raised by `createSheep`.
- **Sim:**
  - `GameState.lostAt?` was added.
  - The peak update moved into `createSheep`. The duplicate lines in `createNewGame` and the debug `addSheep` were removed.
  - `Lost { survivedMs, peakFlock }` was added.
  - `checkLastSheepAndLoss` is exported and called last in `killSheep`.
  - The lost guards come first in `step()` (before the time advance) and in `applyCommand()`.
  - The selectors `isLost` and `selectLoseView` were added; the latter fills `out` in place.
  - The `SAVE_SCHEMA_VERSION` comment explains why there is no bump.
- **Fallout (expected):** two `hunger.test.ts` tests kill the only sheep in the game, which is now also a loss.
  - One asserts `['SheepDied', 'Lost']`.
  - The other counts `SheepDied` only.
- **View:**
  - `OverlayScene`, registered after `HudScene`, is launched by `GameScene.create` beside the HUD. It owns one interactive full-canvas scrim, which fades to 0.72 over 250 ms before the panel shows.
  - `LosePanel` uses a fixed 680×248 `dusk` Panel, the display title, `numeric` halo stats and a `button-menu` Restart.
  - `GameScene` no longer ticks while lost and drops pending commands, and it has a new `newGame()` with a 1.9 save-wipe hook.
  - `HudScene.farm` returns early when lost.
  - `Button` gained `setVisible` (which also disables the hit zone) and `labelAlign`.

### Debug Log References

- **Headless browser probe:** scratchpad `probe18.mjs` with `playwright-core`, system Chrome (SwiftShader), a DEV server on port 5199 and a temporary `__probeGame`/`__probeBus` hook in `main.ts`. **20/20 pass:**
  - **New game:** the scrim and panel are hidden, the scrim's input is disabled, and there is no `lostAt`.
  - **Loss** (after 16 Farm clicks dropped 2 pieces):
    - The scrim is visible at alpha 0.18 mid-fade with no panel yet. Then alpha is 0.72 with the panel showing "The flock is gone." and "Survived 0:01 · Peak flock 3" (matching `lostAt`).
    - The title is 56 px and the stats are `#F6D86B` (halo).
    - The frozen field shows 0 sheep and 2 drawn pieces.
    - Time stays at 1 800 ms over 1 s.
  - **Layout:**
    - The panel is at (300, 236), 680×248, and the title has 110 px padding each side.
    - The stats sit 16 px under the title.
    - Restart is 280×52 at (500, 393), and the stack ends 39 px above the panel bottom.
  - **Input:** a Farm click under the scrim gives no squash (scaleY 1), no pip and no pending command. `F` does nothing. Clicks on the scrim and the panel body do nothing.
  - **Restart:**
    - A Restart click gives 3 sheep, "0/8", no pieces, no `lostAt`, the overlay hidden and peak 3.
    - After 3 Restarts (losing between them) the bus `sim` listener count is 3 → 3, and one F press is one pip.
    - A later loss gives exactly 1 `Lost` and one panel.
  - **Debug Load of a lost state:** the screen shows at once (alpha 0.72, no fade) with the same stats, and time = `lostAt`.
  - **Peak:** debug "+10 sheep" ×2, then a loss, gives "Peak flock 23".
  - **960×540:** the panel shows at scale 0.75 (22 px stats → 16.5 px ≥ 13.5), and Restart works.
  - No console errors at either size.
- **Natural loss** (`natural18.mjs`): a new game at ×16 with no help starves at `lostAt` 72 000, which shows "Survived 1:12 · Peak flock 3". Screenshot `lose-natural.png` reviewed.
- **Cleanup:** the probe hook was removed (`src/main.ts` now differs from HEAD only by the `OverlayScene` import and registration), the dev server was stopped, and `dist/` has no `__probe`, "Feed all" or debug strings.

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created
- **AC verdicts:**
  - **AC 1:** `killSheep` → `checkLastSheepAndLoss` sets `lostAt` once and emits `Lost` after the last `SheepDied`. It is exported for `removeSheep`. Covered by carcass unit tests and two starvation scenarios (same-tick and staggered deaths).
  - **AC 2:** `step` and `applyCommand` are no-ops when lost (unit tests). `GameScene` stops ticking and the field stays drawn (browser).
  - **AC 3:** scrim, then panel, with the title, stats and Restart, and an instant show for a loaded lost state (browser).
  - **AC 4:** `createSheep` keeps the running maximum (unit test). The browser showed peak 23 after debug sheep.
  - **AC 5:** Restart starts a fresh game with no confirm, and the listener counts are stable after 3 Restarts. The save wipe is a marked 1.9 hook.
  - **AC 6:** Farm clicks under the scrim and F do nothing (browser), and the sim guard is unit-tested.
  - **AC 7:** loss is the only end state; there is no win or end screen anywhere.
  - **AC 8:** all copy is in `STRINGS`; colours and sizes come from `COMPONENTS`, `COLORS`, `TYPOGRAPHY` and `SPACING`.
  - **AC 9:** `npm test` 153/153 in 22 files. Typecheck, lint and build are clean (only the existing Phaser chunk-size warning), and the debug overlay is absent from `dist/`.
- **Deviations and decisions:**
  1. **Menu-button labels are centred.** `Button` gained `labelAlign: 'left' | 'center'` (default left, so the Farm button is unchanged). Restart uses `'center'`, matching `mockups/pause.html` `.btn-menu { justify-content: center }`. The first screenshot showed it left-aligned.
  2. **Panel height is 248** (story starting point 680 × 256). The stack measured 248 with 32 px top padding. The title measured 460 px wide, so 680 leaves 110 px each side.
  3. **Story Task 10 said "Peak flock 13" for "+5 sheep" ×2.** The debug button actually adds 10, so the check is "+10 sheep" ×2 → 23.
  4. **`removeSheep` is listed for Stories 2.7 (sacrifice) and 3.1 (sell)** in `deferred-work.md`, not 2.4 as the story said, since those stories own the removals.
  5. **The scrim is a static `Rectangle`.** Its input is disabled while hidden, so it never blocks the HUD during play.
  6. **No `SAVE_SCHEMA_VERSION` bump,** as the story planned (Question 1 is still open for Rylan).
- **For Rylan:**
  - The three open questions in Dev Notes (schema bump, stats type size, panel size) still stand. The defaults are what is built.
  - No SFX or caption on loss, since no doc defines one.

### File List

- `src/view/scenes/OverlayScene.ts` (new)
- `src/view/overlay/LosePanel.ts` (new)
- `src/view/overlay/.gitkeep` (deleted)
- `src/sim/state.ts` (modified: `lostAt?`, peak in `createSheep`)
- `src/sim/events.ts` (modified: `Lost`)
- `src/sim/systems/carcass.ts` (modified: `checkLastSheepAndLoss`)
- `src/sim/step.ts` (modified: lost guard)
- `src/sim/commands.ts` (modified: lost guard)
- `src/sim/selectors.ts` (modified: `isLost`, `LoseView`, `selectLoseView`)
- `src/config/constants.ts` (modified: schema-version comment)
- `src/view/scenes/GameScene.ts` (modified: stop ticking when lost, `newGame()`, launch `OverlayScene`)
- `src/view/scenes/HudScene.ts` (modified: Farm guard when lost)
- `src/view/widgets/Button.ts` (modified: `setVisible`, `labelAlign`)
- `src/view/strings.ts` (modified: lose copy)
- `src/main.ts` (modified: register `OverlayScene`)
- `src/debug/DebugOverlay.ts` (modified: peak line removed from `addSheep`)
- `tests/sim/systems/carcass.test.ts` (modified)
- `tests/sim/systems/hunger.test.ts` (modified: the only sheep's death is now also `Lost`)
- `tests/sim/step.test.ts` (modified)
- `tests/sim/commands.test.ts` (modified)
- `tests/sim/state.test.ts` (modified)
- `tests/sim/selectors.test.ts` (modified)
- `tests/sim/scenarios/starvation.test.ts` (modified)
- `tests/save/saveFile.test.ts` (modified)
- `_bmad-output/implementation-artifacts/deferred-work.md` (modified)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modified)
- `_bmad-output/implementation-artifacts/1-8-losing-the-flock.md` (this story)

## Change Log

| Date | Change |
|---|---|
| 2026-10-06 | Story created (ready-for-dev). |
| 2026-10-06 | Implemented: loss detection and sim stop (`lostAt`, `Lost`, `checkLastSheepAndLoss`), peak flock in `createSheep`, `OverlayScene` + `LosePanel` with scrim and Restart; 13 new tests (153 total); browser probe 20/20. Status → review. |
