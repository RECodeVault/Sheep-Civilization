---
baseline_commit: 243313ff8652f81111fd3a0dd4ddeddb5ea562d3
---

# Story 1.6: HUD Bottom Bar, Farm Button and Food Meter

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a player,
I want a Farm button and a food meter in a bottom bar,
so that I can grow food to feed my flock.

## Acceptance Criteria

1. **HUD scene and bottom bar (UX-DR25, UX-DR8, UX-DR9, UX-DR101).** Given the game is running, when `HudScene` is launched in parallel with `GameScene`:
   - A full-width, 112 px `wool` bottom bar is drawn at the bottom of the canvas (y 608 to 720), with a 2 px `bark` rule along its top edge.
   - The Farm button is at the left, with the food meter beneath it.
   - It uses `COLORS` and the shared widgets in `src/view/widgets/`: `Button`, `Panel` and `Tooltip`.
   - Everything stays inside the 16 px safe margin and follows the DESIGN.md layout positions.
2. **Farm (FR3, UX-DR26, UX-DR44, UX-DR77).** Given food below 20, when I click Farm or press `F`:
   - A `Farm` command adds 1 food.
   - The button squashes.
   - A "+1" float popup rises about 24 px and fades over 600 ms.
   - The meter updates on the same frame as the food change.
3. **Farm at the cap (UX-DR26).** Given food at 20, when I farm, the button still squashes, no popup appears, and the meter does a small bump.
4. **No key repeat (FR43, UX-DR72).** Given I hold `F`, when the key repeats, only one Farm action happens per key press (`event.repeat` is ignored).
5. **Food meter, tooltip and strings (UX-DR29, UX-DR75, AR22, UX-DR96).**
   - The food meter shows 20 discrete `hay` pips on a `wool-shade` track, and "{n}/20" in `numeric` type.
   - Hovering the Farm button shows the tooltip "Farm: +1 food (F)".
   - Every player-facing string, including HUD labels and tooltips, comes from `src/view/strings.ts`.
6. **Green gate.** `npm test`, `npm run typecheck`, `npm run lint` and `npm run build` all pass. No existing test breaks, and the debug overlay is still absent from `dist/`.

## Tasks / Subtasks

- [x] **Task 1: `Farmed` sim event** (AC: 2, 3)
  - [x] 1.1 In `src/sim/events.ts`, widen `SimEvent` with `{ type: 'Farmed'; resource: 'food'; added: number }`.
    - `added` is the food actually gained: `farmFoodPerClick` below the cap, a partial amount if the cap cuts it short, and `0` at the cap.
    - Story 2.2 widens `resource` to `'food' | 'breedingFood'`. Story 2.8's boost makes `added` 2, which is why the popup reads the event and not a constant.
    - Update the header comment, which today names only `SheepDied`.
  - [x] 1.2 In `applyCommand`'s `Farm` case (`src/sim/commands.ts`), compute `before`, apply the existing capped add unchanged, then `emit({ type: 'Farmed', resource: 'food', added: state.food - before })`.
    - Emit on **every** Farm, including at the cap (`added: 0`). The HUD needs that event to bump the meter (AC 3).
    - Keep the existing rule that food already above the cap is never lowered. In that case `added` is 0.
    - Remove the "Story 1.6 wires…" comment and replace it with a one-liner that the HUD reacts to `Farmed`.
  - [x] 1.3 `Farmed` has no `id`. Any existing test or code that reads `e.id` on a bare `SimEvent` stops compiling. `tests/sim/events.test.ts` builds `SheepDied` events and maps `e.id`. Narrow it there (a typed helper or `e.type === 'SheepDied'` guard). Do not add a fake `id` to `Farmed`.
- [x] **Task 2: HUD selector** (AC: 1, 5)
  - [x] 2.1 In `src/sim/selectors.ts`, add `export interface HudView { food: number; foodCap: number }` and `export function selectHudView(state: GameState, out: HudView): HudView`. It fills `out` in place (no allocation) and returns it.
    - `foodCap` comes from `TUNING.foodCap`, so the meter never hard-codes 20.
    - Later stories add fields (`breedingFood`, `money`, `flock`, `capacity`, `threats`, `boostRemaining`; see the architecture's Data Patterns `hudView` example). Add only what this story renders.
  - [x] 2.2 The architecture rule: compute the HUD view **once per frame** in the scene and pass values down; widgets never call selectors themselves.
- [x] **Task 3: Shared widgets in `src/view/widgets/`** (AC: 1, 2, 5)
  - [x] 3.1 **Shared box drawing.** Add a small helper (for example `widgets/box.ts`, exporting `drawBox(g, w, h, opts)`). It draws into a `Graphics` (UX-DR8):
    - a `bark` @ 40% "drop" rectangle offset 2 px right and 2 px down (skipped when pressed or disabled),
    - a 2 px outline in the border colour,
    - the fill.
    - Corners use a `RADIUS` token. `fillRoundedRect` is acceptable. True pixel-stepped corners (UX-DR9) are a nice-to-have; if you skip them, say so in the completion notes.
    - It is called only when a widget's size or visual state changes, never per frame.
  - [x] 3.2 **`Panel.ts`**: the `panel` component (`COMPONENTS.panel`: wool fill, bark border, `rounded.lg`, padding 16).
    - A `Graphics` box built with `drawBox`, plus `setBounds(x, y, w, h)` / `setDepth` / `setVisible`.
    - Options let the caller override the radius (the bottom bar uses 0) and turn off the drop.
    - Stories 1.8 and 1.10 (lose, pause, confirm) and 3.2 (shop) reuse it. Keep it generic: no HUD-specific code.
  - [x] 3.3 **`Button.ts`**: a generic button built from a spec. It must cover `button-farm` now and `button-breed-food`, `button-breed-tool`, `button-menu` and `shop-toggle` later, without forking.
    - **Visual states:** `normal`, `hover`, `pressed` and `disabled`. Pressed uses the spec's pressed fill (for Farm, `hayDeep`, per UX-DR26) and loses the drop offset. Disabled uses `COMPONENTS.buttonDisabled` (no drop offset, `disabledInk` label). Redraw only on a state change.
    - **Content:** a label `Text` in `label` type, and an optional key hint. The key hint is a small `wool` box with a 2 px `bark` border and `rounded.sm`, holding the key letter in Pixelify Sans 18 / 600 (mockups/hud.html `.key`, 26×26). The label sits at the left, the hint at the right, with `padding` from the spec.
    - **Input:** `setInteractive` on a hit object (allowed for HUD widgets; project-context Input rule), `useHandCursor: true`.
      - **The Farm button fires on press** (Rylan's decision, 2026-10-06: a clicker should feel snappy). On a left-button `pointerdown` (`pointer.leftButtonDown()`), show the pressed visual and fire the action at once. On `pointerup` or `pointerout`, go back to the hover or normal visual. Releasing does nothing else.
      - Give `Button` an activation option, for example `activateOn: 'press' | 'release'`, with Farm using `'press'`. `'release'` means: fire on `pointerup` only if the press started on the button and the pointer is still over it, and never on `pointerupoutside`. Menu buttons (Story 1.10) can choose either. Implement `'release'` only if it is cheap; otherwise leave the option typed as `'press'` with a comment for 1.10.
      - Left button only. A right-click or middle-click never fires.
      - Each press fires exactly once: no auto-repeat while the button is held (matches AC 4 for the key).
    - **Squash:** a public `squash()` plays a short scale tween (for example `scaleY` 0.85 and `scaleX` 1.05, about 80 ms, yoyo).
      - `killTweensOf` first, and reset the scale, so rapid presses never stack scale drift.
      - Squash from the **bottom centre**: position the container at the button's bottom-centre and lay its children out upward.
      - Tweens are visual only and never touch `GameState` (project-context rule).
    - **Hit-area gotcha:** a `Container` needs an explicit hit area. Phaser 4 container hit areas are offset by the display origin. Check `node_modules/phaser/skills/input-keyboard-mouse-touch` and `groups-and-containers`, or use a child `Zone` or `Rectangle`, rather than guessing. Hit target ≥ 40 px (`LAYOUT.hitMin`).
    - **Tooltip hook:** the button exposes its tooltip text and bounds; `HudScene` shows them through one shared `Tooltip` (Task 5.4).
  - [x] 3.4 **`Tooltip.ts`** (existing; small change). Pay down the deferred "Tooltip wider than the canvas" item: set `wordWrap: { width: … }` with a named max-width constant (for example 360 px), so a long string wraps instead of running off the canvas. Keep `resolution: 1` and the redraw-on-text-change rule.
  - [x] 3.5 **Text rules for every new `Text`:**
    - `resolution: 1`, per Rylan's 1.5 review decision; see the comment in `Tooltip.ts`. DESIGN.md's "match the DPR" line is superseded.
    - Font family, size and weight come from `TYPOGRAPHY`.
    - Colours come from `COLORS`.
    - `setText` is called only when the value changes.
- [x] **Task 4: HUD components in `src/view/hud/`** (AC: 1, 2, 3, 5)
  - [x] 4.1 **`FoodMeter.ts`** (`COMPONENTS.foodMeter`).
    - **Track:** a `woolShade` track, `rounded.sm`, with 3 px padding.
    - **Pips:** 20 pips from `COMPONENTS.foodMeter.segmentCount`, each an `Image` from the `ui` atlas (frames `pip-food` / `pip-empty`, already in `FRAME`).
    - **Value:** "{n}/{cap}" from `STRINGS`, in `numeric` type, `bark`, right-aligned (origin x = 1) in a fixed-width box (about 62 px) so non-tabular digits do not jitter (UX-DR5).
    - **`set(food, cap)`:** does work only when a value changes. It swaps pip frames and calls `setText` once. Allocation-free when nothing changed.
    - **Over-cap values:** food above the cap (old save, debug) shows all pips full and the real number.
    - **`bump()`:** a small scale tween (about 1.08, yoyo, about 120 ms) for AC 3, with `killTweensOf` first.
    - Story 1.7 adds the empty shake and `alert` flash. Leave a one-line comment, no code.
  - [x] 4.2 **Pip art.** The current `assets/art/ui/pip-food.png` and `pip-empty.png` are 12×16 placeholders from Story 1.2. Twenty of them plus the value box would make the meter much wider than the button.
    - Redraw them at the mockup size: 7×14. `pip-food` is solid `hay` (optionally a 1 px `hayDeep` bottom edge). `pip-empty` is transparent, or `woolShade` so it vanishes into the track.
    - Use the same throwaway scratchpad PNG encoder approach as Stories 1.2 and 1.5. Commit only the PNGs.
    - Run `npm run assets` and commit the regenerated `public/assets/atlases/ui.{png,json}`. Update the placeholder row in `assets/CREDITS.md` if it lists these files.
  - [x] 4.3 **`FloatPopups.ts`** (`COMPONENTS.floatPopup`). The architecture puts it in `src/view/juice/`; put it there if you prefer, and delete that folder's `.gitkeep`.
    - **Pool:** a fixed pool of `Text` objects (for example 8), created once in `HudScene.create`.
    - **Style:** `popup` type, `wool` fill, `bark` stroke (`stroke` / `strokeThickness` 3 to 4).
    - **`spawn(x, y, text)`:** takes the next free (or oldest) item, `killTweensOf` it, sets text, position and alpha 1, then tweens `y - 24` and alpha 0 over 600 ms (UX-DR44). On complete it hides the item; it never `destroy()`s it.
    - Never create or destroy `Text` during play (project-context pooling rule).
    - **Reduced motion:** Story 5.7 adds the setting, which turns this into a fade in place (UX-DR84). Keep the motion values in one place so 5.7 is a one-line change. Add no setting now.
  - [x] 4.4 **`BottomBar.ts`** (or inline in `HudScene` if small). It builds:
    - the bar surface as a `Panel` with radius 0, positioned so its outline runs off the left, right and bottom canvas edges. Only the 2 px top rule shows: for example x −2, y 608, width 1284, height 114, no drop. This keeps the bar on the shared widget.
    - the Farm `Button` from `COMPONENTS.buttonFarm` (label `STRINGS.farmLabel`, key hint `STRINGS.farmKey`, tooltip `STRINGS.farmTooltip(TUNING.farmFoodPerClick)`).
    - the `FoodMeter` beneath the button.
- [x] **Task 5: `HudScene`** (AC: 1–5)
  - [x] 5.1 Create `src/view/scenes/HudScene.ts` with key `'HudScene'` (scene key = class name). Register it in `main.ts` **after** `GameScene` in the scene list. Array order is both update order and render order, so the HUD updates after the sim has ticked (same-frame meter) and draws on top of the field.
  - [x] 5.2 **Launching.** At the end of `GameScene.create`, call `this.scene.launch('HudScene')`.
    - Phaser 4.2.1's `SceneManager.start` (which `launch` queues) shuts a running scene down and starts it again. So every `GameScene` restart (debug Load today; Story 1.9 load-or-new and 1.10 Restart later) rebuilds the HUD fresh. That is intended.
    - Because of this, every `bus.on` / `input.on` / keyboard listener in `HudScene` **must** be removed in `this.events.once(Phaser.Scenes.Events.SHUTDOWN, …)`, or a Load doubles every popup.
    - Story 1.10 (Title) owns stopping the HUD when leaving the game. Do not add a Title flow now.
  - [x] 5.3 **Reading state.** In `create`, get `this.scene.get('GameScene') as GameScene`.
    - Each `update()`: `selectHudView(game.simState, this.view)` once, then `bottomBar.foodMeter.set(view.food, view.foodCap)`.
    - Move `GameScene.simState` (and `dispatch`) out of the "Debug API" comment block into a short "Scene API (HudScene, debug)" section. Its doc must now say HudScene reads it every frame and must never mutate it. Do **not** rename it; `DebugOverlay` uses it.
    - The state object is replaced on restart, so read `simState` every frame. Never cache the state object across frames.
  - [x] 5.4 **Tooltip.** One `Tooltip` instance in `HudScene`, at a depth above the bar.
    - On button hover, after the same ~300 ms delay as sheep hover (move `HOVER_DELAY_MS` to a shared view constant, or mirror it with a comment), show the button's tooltip text centred above the button (`showAt(centerX, top, bottom)`).
    - Hide it on `pointerout`, on press, and on scene shutdown.
    - Use real time (`this.game.loop.time` or `this.time.now`), never sim time.
    - Allocation-free per frame.
  - [x] 5.5 **The single Farm action.** `HudScene` owns one private `farm()` method: `farmButton.squash()` then `game.dispatch({ type: 'Farm' })`. It is called by:
    - the Farm button's click callback,
    - the `F` key (Task 6), through the UI bus event `'farm:pressed'`.
    - Do **not** predict the outcome in the view: no `food < cap` check here.
  - [x] 5.6 **Popup and bump from the sim.** `bus.on('sim', handler, this)`.
    - For `e.type === 'Farmed'` with `resource === 'food'`: if `added > 0`, `popups.spawn(<above the Farm button>, STRINGS.farmPopup(e.added))`; otherwise `foodMeter.bump()`.
    - Ignore other event types with plain `if` checks. The `assertNever` rule is for exhaustive switches, and this handler deliberately handles a subset.
    - Bind the handler once (a class field arrow or a bound method), not a closure per frame.
    - Remove it on SHUTDOWN.
  - [x] 5.7 **Errors.** Wrap `update()` in `try/catch` → `reportError('ui', err)`, as `GameScene.update` does with `'sim'`, so a HUD throw never stops the game loop.
- [x] **Task 6: `InputController`, keyboard part** (AC: 2, 4)
  - [x] 6.1 Create `src/input/InputController.ts` (delete `src/input/.gitkeep`). It is the project's single owner of gameplay pointer and keyboard input (AR8). In this story it handles only `F`. Story 1.7 adds the pointer, `idle` mode and `DropFood`. Stories 1.10, 2.3 and 2.7 add Esc, breed mode and drag.
  - [x] 6.2 Construct it in `GameScene.create` with the scene's `this.input.keyboard`, which is `KeyboardPlugin | null` in the typings. Handle `null` with an early return and a `log.warn('input', …)`. Destroy it on `GameScene` SHUTDOWN.
  - [x] 6.3 **`F` key:** `keyboard.on('keydown-F', handler)`.
    - Ignore the event if `event.repeat` is true (AC 4), or if `ctrlKey`, `metaKey` or `altKey` is held (don't hijack Ctrl/Cmd+F).
    - Otherwise `bus.emit('farm:pressed', undefined)`.
    - Use the event listener, **not** `addKey('F')`: `addKey` enables key capture by default, which calls `preventDefault` on F globally.
    - Leave a comment that shortcuts must be ignored while a modal is open (Story 1.10 adds the modal check).
  - [x] 6.4 Add `'farm:pressed': undefined` to `BusEvents` in `src/view/bus.ts` (UI events are `noun:verb`; architecture Event System).
  - [x] 6.5 `src/input/` must not import `src/view/scenes/*` or mutate state. Importing the shared `bus` from `src/view/bus.ts` is fine: no lint boundary forbids input → view/bus. Run `npm run lint` to confirm.
- [x] **Task 7: Strings** (AC: 5)
  - [x] 7.1 Add the following to `STRINGS` in `src/view/strings.ts`:
    - `farmLabel: 'Farm'`
    - `farmKey: 'F'`
    - `farmTooltip: (n: number) => \`Farm: +${n} food (F)\``. With `n = 1` this is exactly "Farm: +1 food (F)" (EXPERIENCE.md Voice table). Better Hoe (Story 4.7) changes the click value, so it is a function.
    - `farmPopup: (n: number) => \`+${n}\``
    - `meterValue: (n: number, cap: number) => \`${n}/${cap}\``
  - [x] 7.2 No inline text literals in widgets or HUD components. No "!" in copy.
- [x] **Task 8: Tests** (AC: 2, 3, 6)
  - [x] 8.1 `tests/sim/commands.test.ts`:
    - `Farm` below the cap emits exactly one `Farmed { resource: 'food', added: TUNING.farmFoodPerClick }`.
    - `Farm` at `foodCap` emits `Farmed { added: 0 }` and food is unchanged.
    - `Farm` above the cap emits `added: 0` and does not lower food.
    - Use `drainEvents` to collect. `newGame()` already clears the queue.
    - Keep the existing four tests.
  - [x] 8.2 `tests/sim/selectors.test.ts`: `selectHudView` returns `food` from state and `foodCap === TUNING.foodCap`, reuses (and returns) the `out` object, and reflects a change after a Farm.
  - [x] 8.3 `tests/sim/events.test.ts`: fix the typing for the widened union (Task 1.3) without weakening any assertion.
  - [x] 8.4 Optional scenario: `runFor` with Farm commands applied between ticks to show food reaches and stays at `foodCap`. Only if it adds coverage beyond 8.1.
  - [x] 8.5 No Phaser, DOM or view imports in tests. Widgets, HUD, key handling and tweens are verified manually (Task 9).
- [x] **Task 9: Manual verification in the browser, with evidence** (AC: 1–5)
  - [x] 9.1 `npm run dev`. Check the bar layout at 1280×720 and at the 960×540 minimum window:
    - wool bar, 2 px bark top rule, Farm button at the left, meter beneath it, all inside the 16 px margin,
    - label, key hint and "5/20" legible.
    - Screenshot both sizes (scratchpad only).
  - [x] 9.2 **Click Farm** from 5 food: squash, "+1" rises and fades, meter "6/20" with 6 pips. Repeat up to 20. At 20: squash, no popup, meter bump.
  - [x] 9.3 **`F` key:**
    - One press gives exactly +1.
    - Holding F for 2 s gives exactly +1 (no repeat).
    - Ctrl+F opens the browser's find bar and does not farm.
  - [x] 9.4 **Hover:**
    - "Farm: +1 food (F)" appears after about 300 ms, above the button and inside the canvas.
    - It hides on pointer-out and on press.
    - The sheep tooltip still works on the field.
  - [x] 9.5 **Press semantics (fires on press):**
    - Pressing Farm farms at once: the squash plays and +1 follows on the next tick, before you release.
    - Holding the mouse button on Farm for 2 s gives exactly +1.
    - Press, drag off and release: exactly +1 (from the press), and the button returns to its normal visual.
    - Right-click Farm: no farm.
  - [x] 9.6 **Restart path.** Use debug **Load** (scene restart), then check:
    - one F press gives exactly +1 and **one** popup,
    - one bar is drawn,
    - one tooltip.
    - Repeat Load three times. This proves the SHUTDOWN cleanup in `HudScene`, `InputController` and the `bus` listeners.
  - [x] 9.7 **Debug speed and step:**
    - At debug pause (speed 0), Farm squashes immediately, and the popup and meter change appear on the next debug step.
    - At ×16, popups still appear once per press.
    - Record this behaviour: the command applies at the next tick (see Dev Notes, gotcha 1).
  - [x] 9.8 **Performance:** with the debug overlay at ×1 and 100 sheep (use **Feed all**), the FPS stays at the 1.5 baseline while idle. HUD `update()` does no `setText` or redraw when food is unchanged.
  - [x] 9.9 **Gate:** `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`. Grep `dist/` for overlay strings ("Feed all"), as in Story 1.4.
  - [x] 9.10 **Headless checks** (if used) follow Story 1.4/1.5's method: scratchpad `playwright-core`, a temporary probe hook removed afterwards, `src/main.ts` byte-identical to its committed version, and the dev server stopped by PID.

## Dev Notes

### Scope

| Story | Owns (do **not** start here) |
|---|---|
| 1.6 (this) | `HudScene`, bottom bar, `Button` / `Panel` widgets, Farm button, food meter, float popups, `Farmed` event, `InputController` keyboard part (F) |
| 1.7 | `InputController` pointer + `idle` mode, `DropFood`, food pieces, `feeding.ts`, meter empty shake + `alert` flash |
| 1.8 | Lose panel (reuses `Panel`), `OverlayScene` |
| 1.9 | Load-or-new, autosave, hidden-tab pause |
| 1.10 | Title, pause, Esc chain, "ignore F/G while a modal is open", stopping `HudScene` outside the game |
| 2.2 | Farm Breeding Food button + breeding meter (reuse `Button`, generalise `FoodMeter` or add `BreedingMeter`), `Farmed.resource` widening |
| 2.6 | Threat summary in the bar |
| 2.8 | Boosted Farm button (halo glow, "×2" badge), `added: 2` popups |
| 3.x | Money, flock counter, shop toggle, shop panel |
| 5.6 | Pop SFX (UX-DR77's sound part); `AudioDirector` doesn't exist yet, so no sound in this story |
| 5.7 | Reduced-motion setting (popups fade in place; meter bump/shake off) |

### Resolved decisions and gotchas (read first)

1. **Commands apply on the next tick; the popup comes from the sim.** The architecture applies `Command`s at the start of the next tick (`GameScene.tick`). So a click becomes +1 food 0–100 ms later, or on the next debug step while paused.
   - The squash plays **immediately** on press (input feedback).
   - The popup and meter bump wait for the `Farmed` event, so they always match what the sim actually did.
   - "Updates the same frame" (AC 2, UX-DR29) means the meter shows the change on the frame the food changes. Because `HudScene` updates after `GameScene` in the same frame, the meter is never a frame late.
   - Do not apply commands immediately, and do not predict `food < cap` in the view. With two clicks in one tick at 19 food, a prediction would show two popups for one +1.
   - Rylan confirmed this next-tick latency on 2026-10-06 ("keep as is").
2. **Why a sim event at all.** The view must not guess the cap outcome, and Story 2.8 (boost) changes the added amount. A `Farmed { resource, added }` event is the architecture's sim → view signal ("New sim → view signal → add to the `SimEvent` union"). Past-tense PascalCase naming.
3. **`HudScene` restarts with `GameScene`.** `launch` on a running scene shuts it down and starts it again (verified in `node_modules/phaser/src/scene/SceneManager.js` `start()`: status RUNNING..SLEEPING → `sys.shutdown()` then `sys.start(data)`). Every HUD listener therefore needs SHUTDOWN cleanup. Story 1.4's review found most of its bugs in exactly this lifecycle area.
4. **Input ownership.**
   - HUD widgets may use `setInteractive` (project-context Input rule).
   - Gameplay keys go through the single `InputController` (AR8). Creating it now, keyboard-only, avoids a throwaway `keydown-F` in `HudScene` that Story 1.7 would have to move.
   - The F path is `InputController` → `bus 'farm:pressed'` → `HudScene.farm()`. Click and key share one code path.
5. **Text resolution is 1, not the DPR.** This is Rylan's decision in the 1.5 review: DPR text is point-sampled down in the fixed 1280×720 `pixelArt` framebuffer and looks rougher. Apply it to every new `Text`.
6. **Layout and safe margin (the mockup versus the spec).** mockups/hud.html centres the Farm group in the 112 px bar, which puts the meter's bottom at about y 709, inside the 16 px safe margin. Spec wins: UX-DR101 says a 16 px safe margin from the canvas edge. Suggested geometry (canvas px):
   - **Bar:** y 608–720, with the top rule at 608–610.
   - **Farm button:** x 16, y 614, 232×64 (mockup width). Drop offset to 248/680.
   - **Meter track:** x 16, y 682, 20 tall (3 px padding, 14 px pips, 2 px gaps → 20 × 7 + 19 × 2 + 6 = 184 wide).
   - **Value box:** about 62 px wide, right edge at about x 270, vertically centred on the track.
   - **Bottom edge:** ≤ 704.
   - Adjust within these constraints if the art reads better, and record the final numbers in the completion notes. Put layout numbers in a `LAYOUT`-style constant block in the HUD file (view layout, not `TUNING`).
7. **No sheep tooltip move.** Sheep hover stays in `GameScene` (Story 1.5's decision 4 allowed either).
   - Sheep are confined to the fence (bottom 580; a sprite's hit box ends by about 599), so they never overlap the bar at 608.
   - The HUD scene draws above the field, so a HUD tooltip is never hidden by sheep.
8. **No `GameState` shape change, so no schema bump.** `food` already exists. `SAVE_SCHEMA_VERSION` stays 1. `Farmed` is an event, and events are never saved.
9. **Debug overlay.** "+5 food" and the food line in `DebugOverlay.ts` stay as they are; the meter will reflect debug food changes on the next frame. The overlay's backtick `keydown` listener on `window` is unrelated to F.

### Current state of files this story changes

- **`src/sim/commands.ts`:** `Command = { type: 'Farm' }`. `applyCommand` caps at `TUNING.foodCap` and never lowers over-cap food. The switch ends in `assertNever(cmd.type)`. **Change:** emit `Farmed`. **Preserve:** cap rules and the `assertNever` default.
- **`src/sim/events.ts`:** `SimEvent` is only `SheepDied`; `emit` / `drainEvents` / `clearEvents` are allocation-free. **Change:** add the `Farmed` variant. **Preserve:** queue semantics.
- **`src/sim/selectors.ts`:** `fenceBounds`, `hungerOf`, `stageOf`, `PublicSheep`, `selectPublicSheep(state, out)` (fill-in-place pattern). **Change:** add `HudView` + `selectHudView` following the same fill-in-place pattern.
- **`src/view/scenes/GameScene.ts`:**
  - `create(data)` consumes `data.state`, clears events, builds the fence, sheep layer and `SheepHover`.
  - `update()` uses `rawDelta` inside try/catch.
  - `dispatch(cmd)` queues commands.
  - Debug API: `simState`, `simClock`, `stepOnce`, `debugMutate`, `loadState`.
  - **Change:** launch `HudScene`; build and destroy `InputController`; move the `simState` / `dispatch` docs into a "Scene API" section.
  - **Preserve:** everything else, especially `delete data.state`, the probe's `clearEvents()`, `rawDelta`, and the bound `forwardEvent`.
- **`src/main.ts`:** scene list `[BootScene, PreloadScene, GameScene]`; debug overlay via dynamic import. **Change:** append `HudScene`.
- **`src/view/bus.ts`:** `BusEvents = { sim: SimEvent }`. **Change:** add `'farm:pressed': undefined`.
- **`src/view/strings.ts`:** frozen `STRINGS` with toasts, stage/hunger labels, `sheepTooltip`. **Change:** add the Farm and meter strings.
- **`src/view/widgets/Tooltip.ts`:** generic; redraws on text change; `showAt(x, anchorTop, anchorBottom)` with flip and clamp; `visible` getter; `resolution: 1`. **Change:** wordWrap max width only.
- **`src/view/assetKeys.ts`:** `FRAME.pipFood` / `pipEmpty` already exist (unused until now). No change unless frames are renamed (don't).
- **`src/config/constants.ts`:** `COMPONENTS.buttonFarm` (hay / hayDeep / bark / label / md / 64 / padding 12), `foodMeter` (woolShade / hay / 20 / alert / numeric), `floatPopup` (wool / bark / popup), `panel`, `buttonDisabled`, `TYPOGRAPHY`, `RADIUS`, `SPACING`, `LAYOUT` (safeMargin 16, hudBarHeight 112, hitMin 40). **Read only.** If you need a pressed fill, add `pressedBackgroundColor: 'hayDeep'` to `buttonFarm` (the `CheckedSpec` type validates `…Color` keys against `COLORS`). Do not put hex anywhere else.
- **`src/config/tuning.ts`:** `startFood: 5`, `foodCap: 20`, `farmFoodPerClick: 1` already exist (Story 1.2). **No change.**

### Architecture compliance

- **Layers:**
  - `src/sim/` stays pure: the `Farmed` emit uses `emit` from `events.ts` only.
  - The view and input never mutate `GameState`; they read `selectHudView` / `simState` and `dispatch` commands.
- **Commands in, events out:** Farm is a `Command`; the HUD's popup and bump come from the `Farmed` `SimEvent` via the `bus`.
- **Scenes:** `HudScene` never steps the sim (project-context Scenes rule). Pausing is never `scene.pause()`.
- **Pooling:** popups are pooled `Text` objects; no `new` or `destroy()` during play. The widgets are built once in `create`.
- **Rendering:**
  - `Graphics` are drawn only on state change (button state, meter value), never per frame.
  - `setText` happens only on value change.
  - Pips are atlas `Image`s.
- **Strings and colours:** `STRINGS` and `COLORS` / `COLOR_INT` / `COMPONENTS` only. No hex or text literals in components.
- **Naming:** `HudScene.ts`, `Button.ts`, `Panel.ts`, `FoodMeter.ts`, `FloatPopups.ts`, `InputController.ts` (PascalCase classes); `Farmed` (past-tense sim event); `'farm:pressed'` (`noun:verb` UI event); frames stay kebab-case.

### Library / framework requirements

- **No new packages.** Phaser `~4.2.1`, Vite `^8.3.2`, TypeScript `~6.0.3`, Vitest `~4.1.11`, as in `package.json`.
- **Phaser 4 APIs this story needs.** Verify each in `node_modules/phaser/skills/` or `node_modules/phaser/src`; do not write v3 code from memory.
  - `this.scene.launch(key)`, `this.scene.get(key)`; scene-list order = update / render order (`scenes` skill, gotchas 1 and 9).
  - `this.input.keyboard.on('keydown-F', (event: KeyboardEvent) => …)`; `event.repeat` is the native flag (`input-keyboard-mouse-touch` skill). `addKey` captures by default; avoid it here.
  - `gameObject.setInteractive({ hitArea, hitAreaCallback, useHandCursor })`; `pointerdown` / `pointerup` / `pointerover` / `pointerout`; `pointer.leftButtonDown()` (`Pointer.js:901`), and `leftButtonReleased()` (`Pointer.js:966`) only if you implement `'release'`.
  - `this.tweens.add({ targets, scaleY, duration, yoyo, ease })`, `this.tweens.killTweensOf(target)` (`tweens` skill). Tweens auto-destroy unless `persist`.
  - `this.add.text(…)` style keys `stroke`, `strokeThickness`, `wordWrap: { width }`, `resolution` (`text-and-bitmaptext` skill).
  - `this.add.graphics()`: `fillStyle(color, alpha)`, `fillRoundedRect`, `fillRect`, `lineStyle`, `strokeRoundedRect`.
  - `this.add.image(x, y, ATLAS.ui, FRAME.pipFood)` / `setFrame`.
- **Placeholder art:** a throwaway Node PNG encoder in the scratchpad, as in Stories 1.2 and 1.5. `npm run assets` validates kebab names and duplicates.

### File structure

| File | Status |
|---|---|
| `src/view/scenes/HudScene.ts` | new |
| `src/view/widgets/Button.ts`, `src/view/widgets/Panel.ts`, `src/view/widgets/box.ts` (or similar) | new |
| `src/view/hud/FoodMeter.ts`, `src/view/hud/BottomBar.ts` | new (delete `src/view/hud/.gitkeep`) |
| `src/view/juice/FloatPopups.ts` (or `src/view/hud/`) | new (delete `src/view/juice/.gitkeep` if used) |
| `src/input/InputController.ts` | new (delete `src/input/.gitkeep`) |
| `assets/art/ui/pip-food.png`, `pip-empty.png` | redrawn (7×14) |
| `public/assets/atlases/ui.{png,json}` | regenerated |
| `src/sim/events.ts`, `src/sim/commands.ts`, `src/sim/selectors.ts` | modified |
| `src/view/scenes/GameScene.ts`, `src/main.ts`, `src/view/bus.ts`, `src/view/strings.ts`, `src/view/widgets/Tooltip.ts` | modified |
| `src/config/constants.ts` | modified only if a pressed colour key is added |
| `assets/CREDITS.md`, `_bmad-output/implementation-artifacts/deferred-work.md` | modified (mark the Tooltip item resolved) |
| `tests/sim/commands.test.ts`, `tests/sim/selectors.test.ts`, `tests/sim/events.test.ts` | modified |

### Testing requirements

- Vitest, node environment, `src/sim/` and `src/save/` only. Import only from `src/sim`, `src/config`, `src/core`, `src/save`.
- Fixed literal seeds via `newGame()` / `runFor` from `tests/sim/helpers.ts`. No fake timers, no `Math.random`.
- Assert on state and emitted `SimEvent`s with `TUNING` values (`TUNING.foodCap`, `TUNING.farmFoodPerClick`, `TUNING.startFood`), never re-typed literals.
- Baseline: 116 tests in 20 files pass on `main` at `243313f`. Expect about 5 more.
- **Done = `npm test`, `npm run typecheck`, `npm run lint` green**, plus `npm run build` and the Task 9 evidence.

### Project context rules (from `_bmad-output/project-context.md`)

- **Phaser 4, not 3.** Check the skills before using any API from memory. No `setTintFill`, `preFX` or Arcade physics.
- **Fonts are loaded before any `Text`** (already done in `main.ts`). HUD `Text` is created in `HudScene.create`, after boot.
- **HUD numbers:** `BitmapText` or cached `Text` updated only on value change; never `setText` every frame.
- **No Phaser timers or tweens for game logic.** Squash, bump and popup tweens are visual only.
- **Listener cleanup:** every `bus.on` / `input.on` / `keyboard.on` / `events.on` is removed on SHUTDOWN. A restart must not double-subscribe.
- **Input:** the single `InputController` owns gameplay keys; ignore `F` key repeats (`event.repeat`); ignore shortcuts while a modal is open (hook comment now, check in 1.10). Mouse is primary: every action is reachable by left-click.
- **Pooling:** popups come from a pool; never `new` or `destroy()` sprites or texts during play.
- **Selectors are computed once per frame** in the scene and passed down.
- **No logging, `JSON.stringify` or localStorage access in frame code.**
- **Colours** from `COLORS` (DESIGN.md tokens); **copy** from `strings.ts`; no "!" except "Last sheep!".
- **Platform:** must stay legible at the 960×540 minimum window. Desktop mouse and keyboard only.
- **Common mistakes:** Phaser 3 APIs from memory, game logic in scenes or tweens, hard-coding GDD numbers (`20`, `+1`) instead of `TUNING`, forgetting listener removal on restart.

### Previous story intelligence (1.5)

- **`Tooltip` is reusable as-is:** `setText` redraws only on change; `showAt(x, anchorTop, anchorBottom)` flips below and clamps to the safe margin; `resolution: 1`. Sheep hover uses `game.loop.time` and `input.manager.isOver` (no listeners), with `HOVER_DELAY_MS = 300` in `SheepHover.ts`.
- **Review lessons:**
  - Record evidence for every manual check.
  - List every deviation from the story text in the completion notes.
  - Do not claim a red phase that didn't happen.
  - Scrutinise restart lifecycles (1.4 had 17 lifecycle patches).
  - 1.5's review applied 7 patches, including world-versus-screen pointer coordinates. Use `pointer.worldX/worldY` if you hit-test anything manually; `setInteractive` handles it for widgets.
- **Deferred to this story:** "Tooltip wider than the canvas" (Task 3.4). Mark it resolved in `deferred-work.md` with a short note.
- **Debug helpers:** **Feed all** keeps 100 sheep alive for the performance check (Task 9.8); "+5 food" shortcuts testing the cap.
- **Headless method:** scratchpad `playwright-core` with system Chrome on a DEV server. Temporary `window.__probeGame` hook in `main.ts`, removed and grep-verified afterwards. Stop servers by PID.

### Git intelligence

- Recent commits: `243313f` (1.5 review fixes), `07e36d4` (1.5), `daf6955` (1.4 review fixes), `2ccdc8e` (1.4), `4d2d1da` (1.3 review fixes). The style is one commit per story ("Implement story 1.6: …"), plus a separate commit for review fixes.
- Branch: `story/1-6-hud-bottom-bar-farm-button-and-food-meter`, created from `main` at `243313f`.
- 1.5 touched `Tooltip.ts`, `SheepHover.ts`, `GameScene.ts`, `strings.ts`, `selectors.ts` and `assetKeys.ts`. This story builds on all of them; reread the current files before editing.

### Latest technical notes (checked 2026-10-06)

- The stack is unchanged since 1.5 (Phaser 4.2.1, Vite 8.3.2, TypeScript 6.0.3, Vitest 4.1.11). No new libraries, so no version research is needed.
- Phaser 4.2.1 `ScenePlugin.launch(key)` queues `SceneManager.start`, which restarts a running scene (gotcha 3). `KeyboardPlugin` `keydown-<KEY>` handlers receive the native `KeyboardEvent` (with `.repeat`).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.6: HUD Bottom Bar, Farm Button and Food Meter]
- [Source: _bmad-output/planning-artifacts/epics.md#Requirements Inventory] FR3, FR43; AR6, AR7, AR8, AR13, AR22; UX-DR4, UX-DR5, UX-DR8, UX-DR9, UX-DR10, UX-DR25, UX-DR26, UX-DR29, UX-DR44, UX-DR72, UX-DR75, UX-DR77, UX-DR84, UX-DR90, UX-DR96, UX-DR101
- [Source: _bmad-output/game-architecture.md#Scene Structure and Communication], [#Input Handling], [#Event System], [#Data Patterns] (`hudView`), [#Project Structure] (`view/hud`, `view/widgets`, `view/juice`, `input/InputController.ts`), [#Consistency Rules]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-sheep-civilization-2026-10-05/DESIGN.md#Layout & Spacing], [#Elevation & Depth], [#Shapes], [#Components] (Farm button, Food meter, Float popup, Panel, Tooltip), [#Typography]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-sheep-civilization-2026-10-05/EXPERIENCE.md#Component Patterns] (Farm button, meters, float popup), [#Voice and Tone] (button tooltips), [#Interaction Primitives] (Keys), [#Game Feel & Juice] (reduced motion)
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-sheep-civilization-2026-10-05/mockups/hud.html] `.hud`, `.btn-farm`, `.key`, `.pips`/`.pip`, `.num` (illustrative; spec wins on conflict)
- [Source: _bmad-output/project-context.md] Engine-Specific Rules, Performance Rules, Code Organization Rules, Platform & Build Rules
- [Source: _bmad-output/implementation-artifacts/1-5-hunger-and-starvation.md] Tooltip widget, Review Findings, decision 4 (tooltip placement)
- [Source: _bmad-output/implementation-artifacts/deferred-work.md] Tooltip wider than the canvas (1.6); Commands and pausing (1.10)
- [Source: node_modules/phaser/src/scene/SceneManager.js#start] restart-on-launch behaviour

## Dev Agent Record

### Agent Model Used

Claude Opus 5.5 (1M context), `claude-opus-5-5[1m]`

### Implementation Plan

- **Red first (sim):** wrote the `Farmed` tests (4) and the `selectHudView` tests (2) before the code. All 6 failed as expected: no event emitted, and `selectHudView is not a function`. Then implemented them, and they went green.
- **Sim:**
  - `SimEvent` gains `Farmed { resource: 'food'; added }`. `applyCommand('Farm')` emits it on every Farm (added 0 at or above the cap).
  - `selectHudView(state, out)` fills `{ food, foodCap }` in place.
  - No `GameState` change, so no schema bump.
- **Widgets:**
  - `box.ts`: `drawBox`, `boxTexture` (bakes a box once into a cached texture) and `textStyle` (resolution 1).
  - `Panel` and `Button` (4 visual states pre-baked; `activateOn` 'press' | 'release'; a separate `Zone` hit area so the squash never moves it).
  - `Tooltip` gains `wordWrap` and exports `HOVER_DELAY_MS`.
- **HUD:**
  - `BottomBar`: a Panel bar with its outline off-canvas, the Farm button and the `FoodMeter`.
  - `FloatPopups` (pool of 8 `Text`s) in `view/juice/`.
  - `HudScene` reads `simState` once per frame, owns the single `farm()` action, and reacts to `Farmed`.
- **Input:** `InputController` (keyboard only): `keydown-F` → `bus 'farm:pressed'`. It ignores repeats and Ctrl/Cmd/Alt.
- **Scenes:** `GameScene.create` builds the `InputController` (destroyed on shutdown) and launches `HudScene`. `main.ts` registers `HudScene` after `GameScene`.

### Debug Log References

- **Headless browser checks:** scratchpad `playwright-core` with system Chrome (SwiftShader), a DEV server on port 5199, and a temporary `window.__probeGame` hook in `main.ts`. 37/37 checks pass after one fix:
  - **Layout:** the Farm button is at (16, 614), 232×64. The meter track is at y 682–702 and the value text at x 218–270. Everything is ≥ 16 px from the canvas edges, and the bar top rule is at 608.
  - **Start:** "5/20" with 5 pips.
  - **Tooltip:** hidden at 150 ms; "Farm: +1 food (F)" after 300 ms, with the box at y 571, above the button and inside the canvas. It hides on press.
  - **Click (fires on press):** the squash plays (scaleY 0.91 mid-tween). +1 lands before release, the meter reads "6/20" with 6 pips, and one "+1" popup appears and is gone by 700 ms.
  - **Holding and dragging:** holding the mouse 2 s gives exactly +1. Press, drag off and release gives exactly +1, and the button returns to normal. Right-click does not farm. 5 rapid clicks give +5.
  - **F key:** one press gives +1 and a popup. Held F with 10 synthetic auto-repeat `keydown`s (`repeat: true`) gives exactly +1. Ctrl+F does not farm.
  - **At the cap:** food stays 20, no popup, the meter bumps (scale > 1 seen), and it shows "20/20" with 20 pips. Debug food 25 shows "25/20" with 20 pips.
  - **Debug pause:** F leaves food unchanged; the next `stepOnce` applies +1 and pops "+1". At ×16, one press gives one +1 and one popup.
  - **Restart path:** 3 debug Loads, then one F gives exactly +1 and one popup. The HUD `Text` count is the same as before the Loads (9). One click gives +1. There is exactly 1 `keydown-F` listener.
  - **Other:** the sheep tooltip still reads "Adult · Fed". 960×540 (canvas scaled to 960×540): legible in the screenshot, and a click farms. No console errors at either size.
  - **The fix:** the first run failed 1/37. The pips were drawn 3.5 px left and 7 px up because `Image.setFrame` re-applies the atlas frame's 0.5 pivot as the origin. `FoodMeter` now calls `setFrame(name, false, false)`.
- **Performance (SwiftShader, 100 sheep, ×1).** Rylan waived further investigation ("Skip performance it is fine").
  - The HUD does no `setText` and no box redraw while food is unchanged (instrumented: 0 and 0 over 600 frames).
  - With live `Graphics` boxes the HUD cost about 5 FPS (54 vs 59). Hiding the 5 `Graphics` restored 60, so the boxes were baked into cached textures.
  - After baking, HUD on vs asleep still measured about 54 vs 60 in SwiftShader, and hiding only the 1286×116 bar image restored about 59.6. This is CPU fill cost in software rendering. It was not investigated further, by Rylan's decision.
- **Cleanup:**
  - The probe hook was removed; `src/main.ts` differs from HEAD only by the `HudScene` registration.
  - `grep` finds no `__probeGame` in `src/` or `dist/`, and "Feed all" appears only in `src/debug/`.
  - The dev server was stopped by its listening PID.

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created
- **AC 1:**
  - `HudScene` is launched by `GameScene` in parallel and drawn above it.
  - The bar is a 112 px wool `Panel` with a 2 px bark top rule. The Farm button is at the left and the food meter is beneath it.
  - Colours come from `COLORS` / `COMPONENTS`, and the widgets live in `src/view/widgets/` (`Button`, `Panel`, `Tooltip`).
  - Everything is inside the 16 px margin, as verified in the browser.
- **AC 2:** a click or F dispatches `Farm`. The squash plays immediately; the "+1" popup (rises 24 px, fades over 600 ms) and the meter change come from the `Farmed` event on the same frame as the food change. Covered by unit tests and browser checks.
- **AC 3:** at the cap the button squashes, there is no popup and the meter bumps. Covered by unit tests (`added: 0`) and browser checks.
- **AC 4:** holding F (with repeats) gives one action. `InputController` ignores `event.repeat`.
- **AC 5:** 20 hay pips on a wool-shade track and "{n}/20" in numeric type. The tooltip reads "Farm: +1 food (F)". All copy comes from `STRINGS` (`farmLabel`, `farmKey`, `farmTooltip`, `farmPopup`, `meterValue`).
- **AC 6:** `npm test` 122/122 in 20 files (was 116). Typecheck, lint and build are clean (the existing Phaser chunk-size warning only). The debug overlay is absent from `dist/`.
- **Deviations from the story text:**
  1. **Boxes are baked textures, not live `Graphics` (Task 3.1–3.3, 4.1).** Measured: live HUD `Graphics` cost about 5 FPS at 100 sheep, and the project rule says to pre-render static shapes to textures. `boxTexture` draws once through `drawBox`, calls `generateTexture`, and caches by style and size in the game `TextureManager`. Button state swaps are `setTexture` calls.
  2. **`Button` implements both `activateOn` modes.** 'release' was cheap: press tracking plus `pointerup` while over. Farm uses 'press' (Rylan, 2026-10-06).
  3. **Layout:** the Farm button is at y 614 (bar top + 6, not centred) and the meter track at y 682, so the meter ends at 702–703 ≤ 704. This follows the story's gotcha 6; the mockup's centring would cross the safe margin.
  4. **The pip art fills empty slots with `woolShade`** (the track colour) instead of transparency. It looks the same as the mockup and avoids a fully transparent frame in the packer.
  5. **Popup position:** "+1" rises from 4 px above the Farm button's top centre.
  6. **Hover delay:** `HOVER_DELAY_MS` moved to `Tooltip.ts` and is shared by sheep hover and button hover.
  7. **Corners** use `fillRoundedRect`, not pixel-stepped 9-slices (UX-DR9 nice-to-have; noted in `box.ts`).
  8. **Tests:** `events.test.ts` and `hunger.test.ts` narrow on `type === 'SheepDied'` before reading `id`. The hunger test keeps an explicit event count so nothing was weakened. Optional Task 8.4 (scenario) was skipped: 8.1 already covers capped farming, and this story adds no tick-time rule.
- **For Rylan:**
  - In the SwiftShader runs, the HUD still costs about 6 FPS at 100 sheep, mostly the full-width bar image's fill. This is waived for now; the deferred NFR1 hardware check (Story 5.11) will show whether it matters on a real GPU.
  - The pip and button art are placeholders.
  - Pop SFX (UX-DR77) arrives with `AudioDirector` in Story 5.6. The reduced-motion popup fade arrives with Story 5.7.

### File List

- `src/view/scenes/HudScene.ts` (new)
- `src/view/widgets/Button.ts` (new)
- `src/view/widgets/Panel.ts` (new)
- `src/view/widgets/box.ts` (new)
- `src/view/hud/BottomBar.ts` (new)
- `src/view/hud/FoodMeter.ts` (new)
- `src/view/juice/FloatPopups.ts` (new)
- `src/input/InputController.ts` (new)
- `src/input/.gitkeep`, `src/view/hud/.gitkeep`, `src/view/juice/.gitkeep` (deleted)
- `assets/art/ui/pip-food.png`, `assets/art/ui/pip-empty.png` (redrawn, 7×14)
- `public/assets/atlases/ui.png`, `public/assets/atlases/ui.json` (regenerated)
- `src/sim/events.ts` (modified)
- `src/sim/commands.ts` (modified)
- `src/sim/selectors.ts` (modified)
- `src/config/constants.ts` (modified: `buttonFarm.pressedBackgroundColor`)
- `src/view/scenes/GameScene.ts` (modified)
- `src/main.ts` (modified)
- `src/view/bus.ts` (modified)
- `src/view/strings.ts` (modified)
- `src/view/widgets/Tooltip.ts` (modified)
- `src/view/field/SheepHover.ts` (modified: shared `HOVER_DELAY_MS`)
- `tests/sim/commands.test.ts` (modified)
- `tests/sim/selectors.test.ts` (modified)
- `tests/sim/events.test.ts` (modified)
- `tests/sim/systems/hunger.test.ts` (modified)
- `_bmad-output/implementation-artifacts/deferred-work.md` (modified)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modified)
- `_bmad-output/implementation-artifacts/1-6-hud-bottom-bar-farm-button-and-food-meter.md` (this story)

## Change Log

| Date | Change |
|---|---|
| 2026-10-06 | Implemented the HUD: `HudScene`, the bottom bar, the `Button`/`Panel` widgets (baked box textures), the Farm button (fires on press), the food meter, pooled float popups, the `Farmed` sim event, `selectHudView`, and the keyboard part of `InputController` (F, no repeat). Tooltip wraps. Tests 122/122; browser checks 37/37. Status → review. |
