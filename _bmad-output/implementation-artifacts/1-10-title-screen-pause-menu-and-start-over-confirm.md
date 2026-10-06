---
baseline_commit: 8d14fbee7ce1b15449dbd531eab7cf975e929423
---

# Story 1.10: Title Screen, Pause Menu and Start-Over Confirm

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a player,
I want a title screen to continue or start a game and a pause menu I can open with Esc,
so that I can control my session.

## Acceptance Criteria

1. **Title screen (UX-DR12, UX-DR21, AR6).** Given the game loads, when `TitleScene` shows (Boot → Preload → **Title** → Game):
   - the title logo "Sheep Civilization" appears in `display` type (bark, on a wool `panel`), over the lighter `menu-scrim-start` (dusk-deep at 40%), with three decorative sheep wandering behind it;
   - `button-menu` buttons in one centred stack: **Continue** (only when a save exists and can run, listed first; hidden, not greyed, otherwise), **New Game** and **Credits**;
   - **Continue** resumes exactly where play stopped (a lost save resumes to the lose screen, as in 1.9);
   - **New Game** with no save starts a new game directly;
   - **Credits** shows a placeholder panel with **Back** until Story 5.9.
2. **Start-over confirm from the title (UX-DR13, UX-DR18).** Given a save exists, when I click **New Game**, the start-over confirm replaces the title panel: "Start over? Your flock will be lost." with **Cancel** (left, `button-menu`) and **Start over** (right, `button-menu-destructive`: awning fill, wool label, hover `alert`).
   - **Start over** wipes the save (`wipeSave`, settings untouched) and starts a new game.
   - **Cancel** or `Esc` returns to the title panel.
3. **Pause menu (UX-DR14, FR44 partial).** Given play is running, when I press `Esc`, the pause menu opens: a `panel` headed "Paused" (`title` type) over the 72% `menu-scrim` and a frozen, still-rendered field, with **Resume, Volume, Stats, Restart, Credits** in that order.
   - Sim accumulation stops **without** `scene.pause()` on `GameScene`: a `paused` flag beside the 1.9 `hidden` flag stops the clock. Either flag stops it, and the tab becoming visible again never unpauses a paused menu.
   - `Esc` or **Resume** returns to play with no catch-up burst.
   - **Volume**, **Stats** and **Credits** show placeholder panels with **Back** (Stories 5.7, 5.4, 5.9). Back or `Esc` returns to the pause panel. The sim stays paused.
   - **Restart** opens the start-over confirm. **Start over** wipes the save and starts a new game (`GameScene.newGame()`); **Cancel** or `Esc` returns to the pause panel.
4. **Modal rules (UX-DR20, UX-DR10).** Given any modal (title, title confirm, title credits, pause, sub-panel, pause confirm, lose):
   - it is one centred panel over the scrim, and clicking the scrim does nothing;
   - modals replace each other and never stack (one panel visible at a time);
   - `F` is ignored and the Farm button cannot be clicked (`G` arrives in 2.2 and goes through the same check);
   - no tooltip (Farm button or sheep hover) shows under a modal.
5. **Esc priority chain (FR43, UX-DR73, AR8).** Given `Esc` is pressed in game, `InputController` runs the agreed chain: close start-over confirm → close sub-panel (Volume/Stats/Credits) → cancel drag (2.7) → exit breed mode (2.3) → close shop (3.2) → open/close pause.
   - The drag, breed and shop steps are documented, empty slots for later stories. The chain is built so a later story adds its step without reordering the others.
   - On the lose screen, `Esc` does nothing (no pause over a lost game).
   - `Esc` ignores key repeat, like `F`.
6. **Copy (UX-DR95, AR22).** "Paused", "Continue", "New Game", "Credits", "Resume", "Volume", "Stats", "Restart", "Back", "Start over? Your flock will be lost.", "Cancel", "Start over", the logo text, the placeholder line and the Pause button label and tooltip all come from `src/view/strings.ts`, exactly as EXPERIENCE.md writes them. No "!" anywhere. Colours and sizes come from `COLORS`/`COMPONENTS`/`TYPOGRAPHY`/`SPACING`; there are no hex or text literals in components.
7. **Mouse-only and pacing (UX-DR76, UX-DR91).** Every menu action is reachable by left-click, **including opening the pause menu**: a **Pause** button sits at the top-left of the field (added 2026-10-06, Rylan). It opens the same pause menu as `Esc`. Under any modal (including the lose screen) the scrim covers it, so it cannot be clicked. `Esc` pauses at any time while playing. No menu action needs speed (a paused game cannot lose a sheep).
8. **Regressions stay fixed.** Autosave, hide-save, resume, Restart wipe, the forced save, the lose screen and listener hygiene from 1.8 and 1.9 all still work. After 3 Restarts (from the pause menu and from the lose screen), every listener count is unchanged and one `F` press fills one pip.
9. **Green gate.** `npm test`, `npm run typecheck`, `npm run lint` and `npm run build` all pass, and the debug overlay is absent from `dist/`.

## Tasks / Subtasks

- [x] **Task 1: Strings** (AC: 1, 2, 3, 6)
  - [x] 1.1 In `src/view/strings.ts`, add the menu copy (EXPERIENCE.md Voice table and IA, UX-DR95):
    - `gameTitle: 'Sheep Civilization'` (the logo);
    - `continue: 'Continue'`, `newGame: 'New Game'`, `credits: 'Credits'`;
    - `paused: 'Paused'`, `resume: 'Resume'`, `volume: 'Volume'`, `stats: 'Stats'`, `back: 'Back'`;
    - `restart` is already there (Lose), so reuse it for the pause menu;
    - `startOverQuestion: 'Start over? Your flock will be lost.'`, `cancel: 'Cancel'`, `startOver: 'Start over'`;
    - `comingSoon: 'Coming soon.'`, marked `[ASSUMPTION]` like the other off-table strings: the body of the Volume, Stats and Credits placeholders until 5.7, 5.4 and 5.9.
- [x] **Task 2: Widget fixes for in-place hide/show** (AC: 4, 8; deferred "`Button` hide/show in place", 1.8 review)
  - [x] 2.1 `Button.setVisible(false)` while hovered: also call `this.scene.input.resetCursor()` (Phaser 4 `InputPlugin#resetCursor`, since 3.85; verified in `node_modules/phaser/src/input/InputPlugin.js` ~line 569). Without it the hand cursor stays over the field after Resume hides the panel.
  - [x] 2.2 Showing a button under a still pointer gives no hover highlight until the pointer moves. This is acceptable: Phaser hit-tests on pointer down, so a click still works. Write a comment saying so; do not add per-frame polling.
  - [x] 2.3 Panel sizes stay **fixed constants** (deferred "Baked box textures", 1.6): `boxTexture` never evicts, so every modal uses one or two fixed sizes, never a size computed from text at runtime.
- [x] **Task 3: Reusable modal pieces — `src/view/overlay/`** (AC: 1–4, 6)
  The architecture names `PausePanel`, `ConfirmPanel` and friends here (directory tree, "Menus & modals"). Build small classes that both `TitleScene` and `OverlayScene` use, following `LosePanel`: built once, hidden, `setVisible(v)` toggles every part, and fixed sizes.
  - [x] 3.1 `MenuPanel.ts`: a wool `panel` with an optional header in `title` type and a vertical stack of `button-menu` buttons. `labelAlign: 'center'`, `activateOn: 'release'`, `COMPONENTS.buttonMenu` 280×52, gap `SPACING[3]` (12), padding `SPACING[4]` (16), header gap `SPACING[3]` (mockups `pause.html` `.panel-hd`, `.stack`). It takes `{ header?, buttons: { label, onActivate }[] }` and has `setButtonVisible(i, v)` for Continue.
    - Pause panel: header "Paused" plus 5 buttons, which makes it about 312 × 390. Measure it and use the measured constant.
  - [x] 3.2 Title panel: the logo in `display` type, bark (`COMPONENTS.panel.textColor`), with padding `SPACING[6]` (32) and a `SPACING[5]` (24) gap to the stack (mockups `title.html` `.title-panel`, `.logo`).
    - It holds 2 or 3 buttons: Continue is shown only with a save. Use **two fixed heights**, with and without Continue, and re-centre the stack, so the panel never shows a gap where Continue would be.
    - Either extend `MenuPanel` with a `display` header option or write a `TitlePanel.ts`. Pick whichever keeps the code smaller.
  - [x] 3.3 `ConfirmPanel.ts` (UX-DR18; mockups `pause.html` `.confirm`):
    - a wool panel; the question in `title` type, bark, centred, word-wrapped at 440 px (`wordWrap: { width: 440 }`);
    - padding 32 top and 24 sides and bottom, and a 24 px gap to the button pair;
    - the pair side by side with a 12 px gap: **Cancel** (`COMPONENTS.buttonMenu`) on the left, **Start over** (`COMPONENTS.buttonMenuDestructive`) on the right. That makes the panel 280 + 12 + 280 + 48 = 620 wide; measure the height.
    - `onCancel` and `onConfirm` callbacks.
  - [x] 3.4 `PlaceholderPanel.ts` (Volume / Stats / Credits until their stories):
    - a wool panel; the header (`title` type, e.g. "Volume") and `STRINGS.comingSoon` in `body` type (Nunito; credits are body type per UX-DR17), then one **Back** menu button;
    - one fixed size for all three; `setHeader(text)` swaps the header text only;
    - Stories 5.4, 5.7 and 5.9 replace it with `StatsPanel`, `VolumePanel` and `CreditsPanel`.
  - [x] 3.5 `ModalController.ts`: the one scrim plus "which panel is up", shared by Title and Overlay so the never-stack rule lives in one place.
    - It owns a full-canvas `Rectangle` scrim (interactive with no handlers, as `OverlayScene` does today) at a given opacity: `menuScrimStart` (0.4) for the title, `menuScrim` (0.72) in game.
    - `show(id)` hides the current panel and shows `id`; it never shows two. `hideAll()` hides everything and turns the scrim off (when the title's scrim stays up, the title panel is simply the base modal).
    - `current` returns the id or null. `previous` is the panel to go back to (a confirm or sub-panel returns to the panel it was opened from: title or pause).
    - `back()` returns to `previous`.
    - Keep it small and view-only: no `GameState`, no bus.
  - [x] 3.6 Every button handler is wrapped in `try { … } catch (err) { reportError('ui', err); }` (it runs inside Phaser's input step; see `OverlayScene.restart`).
- [x] **Task 4: `TitleScene` (new) and the load decision** (AC: 1, 2, 7; deferred "Load decision moves to the Title screen", 1.9)
  - [x] 4.1 Create `src/view/scenes/TitleScene.ts` (scene key `'TitleScene'` = class name). Register it in `src/main.ts` between `PreloadScene` and `GameScene`: `[BootScene, PreloadScene, TitleScene, GameScene, HudScene, OverlayScene]`. Keep the array-order comment.
  - [x] 4.2 Move the load from `PreloadScene.create` into `TitleScene.create`, unchanged in logic:
    ```ts
    const loaded = loadSave();
    this.saved = loaded !== null && stateCanRun(loaded) ? loaded : null;
    if (loaded !== null && this.saved === null) discardSave();
    ```
    `PreloadScene.create` keeps the atlas check and toast, then calls `this.scene.start('TitleScene')`. Update both header comments (Preload: "then the title"; GameScene: "loaded before it starts (TitleScene)").
  - [x] 4.3 Buttons:
    - **Continue** (visible only when `this.saved !== null`) → `this.scene.start('GameScene', { state: this.saved })`.
    - **New Game** → if `this.saved !== null`, show the confirm; else `this.scene.start('GameScene', {})`.
    - Confirm **Start over** → `wipeSave()` and then `this.scene.start('GameScene', {})`. **Cancel** → back to the title panel.
    - **Credits** → placeholder panel; **Back** → title panel.
    - `scene.start` from TitleScene shuts TitleScene down; GameScene then launches HUD and Overlay exactly as today.
  - [x] 4.4 Esc on the title: TitleScene registers its own `keydown-ESC` listener (an event listener, not `addKey`, which would capture the key page-wide; see the `InputController` F comment) and removes it on SHUTDOWN. Behaviour:
    - confirm or credits up → `back()` to the title panel;
    - title panel up → nothing.
    - TitleScene is not gameplay, so this does not break the single-InputController rule: InputController lives in GameScene and owns gameplay input.
  - [x] 4.5 Background: `this.cameras.main.setBackgroundColor(COLORS.pasture)`, the same placeholder ground as GameScene until the era art in Epic 3. No fence and no HUD.
  - [x] 4.6 Decorative sheep, `src/view/field/TitleFlock.ts` (view-only, cosmetic):
    - Three `Phaser.GameObjects.Sprite`s using `ATLAS.sheepWorld` / `FRAME.adultIdle` at the same 2× scale as `SheepSprite`. Do **not** use `SheepSprite`/`EntityLayer`, which expect `PublicSheep` from a sim.
    - Each walks with tweens to a random point in the visible meadow outside the title panel's rect (plus a margin, and above the bottom edge), at `TUNING.walkSpeedPxPerS`: duration = distance / speed. It rests a random `TUNING.wanderRestMinMs`–`wanderRestMaxMs` between walks, flips by direction, and sets depth = y.
    - `Math.random()` is allowed here (project rule: cosmetic view code). Tweens and timers are fine because nothing touches `GameState`.
    - Kill the tweens on SHUTDOWN (`this.tweens.killAll()` is fine, since Title owns all its tweens).
    - **Do not** run a sim state or call `updateMovement` on the title. Only GameScene steps the sim (project-context Engine rules).
  - [x] 4.7 Depth order inside TitleScene: sheep (y ≤ 720), then the scrim, then the panels. The scrim is always up on the title.
  - [x] 4.8 Fonts: `main.ts` already loads both fonts before `new Phaser.Game`, so the title's Text is safe. Do not move font loading.
- [x] **Task 5: Pause in `GameScene`** (AC: 3, 8; deferred "Two pause sources", 1.9, and "Commands and pausing" / "Paused Farm bursts", 1.2 and 1.6)
  - [x] 5.1 Add `private paused = false;` beside `hidden`. Reset it in `create()` (a restart always starts unpaused). Add `setPaused(p: boolean): void` and a `get isPaused(): boolean`.
  - [x] 5.2 In `update()`: the clock advances only when `!this.hidden && !this.paused` (the lost branch stays first). Keep `render()` and `sheepHover.update` running so the field stays drawn. The clock is not advanced, so `alpha` stays put and the sheep hold still: a frozen field.
  - [x] 5.3 Unpausing sets `skipDelta = true`, like `onVisible`, so the first frame back adds no time. Do **not** `clock.reset()` on unpause: the leftover accumulator keeps interpolation continuous, so sheep do not snap.
  - [x] 5.4 `onVisible` must not touch `paused`, and `setPaused(false)` must not touch `hidden`. Write a comment saying so. Do not use `simClock.speed` (the debug pause) for either.
  - [x] 5.5 **Commands while paused (deferred decision):**
    - Farm is ignored while a modal is open, both the `F` key (Task 7) and a click (the scrim blocks it; `HudScene.farm` also guards on `isPaused`, as it does on `isLost`). So no commands queue while paused, and nothing bursts on resume.
    - The queue stays unbounded only while the clock runs, where each tick empties it.
    - The `pendingCommands = []` reset in `create()` stays: no input arrives between SHUTDOWN and `create()`.
    - Mark the two deferred items resolved this way.
  - [x] 5.6 `newGame()` is unchanged (it stops autosave, clears the forced save, wipes, restarts). The pause confirm's **Start over** calls it.
- [x] **Task 6: `OverlayScene` — pause, sub-panels and confirm** (AC: 3, 4, 5)
  - [x] 6.1 Replace the hand-made scrim with `ModalController` at `COMPONENTS.menuScrim.opacity`. Keep the lose screen's 250 ms scrim fade and its at-once show on a loaded lost state; the lose panel becomes one of the controller's panels.
  - [x] 6.2 Add the pause `MenuPanel` (Resume, Volume, Stats, Restart, Credits), a `PlaceholderPanel`, and a `ConfirmPanel`. Their actions:
    - **Resume** → `closePause()`;
    - **Volume** / **Stats** / **Credits** → the placeholder with that header;
    - **Back** → the pause panel;
    - **Restart** → confirm;
    - confirm **Cancel** → the pause panel;
    - confirm **Start over** → `this.gameScene.newGame()`.
  - [x] 6.3 `openPause()` → `gameScene.setPaused(true)`, then show the pause panel at once ([ASSUMPTION] no fade: pause must feel instant). `closePause()` → hide all, then `gameScene.setPaused(false)`. Any modal open in game (pause, sub-panel, confirm) means paused.
  - [x] 6.4 Public methods for the Esc chain, each returning `true` when it consumed the press:
    - `closeConfirm()`: if the confirm is up → `back()` to pause;
    - `closeSubPanel()`: if a placeholder is up → `back()` to pause;
    - `togglePause()`: if lost → return `true` and do nothing (Esc is swallowed); if pause is up → `closePause()`; if nothing is up → `openPause()`.
  - [x] 6.5 `get modalOpen(): boolean` is true for any panel, including lose. HUD and input read it (through GameScene; see Task 7) to block F, the Farm click and tooltips.
  - [x] 6.6 The lose screen replaces any open pause or confirm. A loss cannot happen while paused (the sim is stopped), but a debug Load of a lost state can. `showLose` calls `show('lose')`, which hides the others; the never-stack rule covers it.
- [x] **Task 7: `InputController` — Esc chain and modal check** (AC: 4, 5)
  - [x] 7.1 Give the constructor a second argument with the hooks GameScene wires up:
    ```ts
    export interface InputHooks {
      /** True while any modal is up (pause, sub-panel, confirm, lose): shortcuts are ignored. */
      modalOpen(): boolean;
      /** The Esc chain (UX-DR73), in order; each returns true when it consumed the press. */
      readonly esc: readonly (() => boolean)[];
    }
    ```
    GameScene builds `esc` in the documented order:
    ```ts
    [() => overlay().closeConfirm(), () => overlay().closeSubPanel(),
     /* 2.7 cancelDrag, 2.3 exitBreedMode, 3.2 closeShop slot in here */
     () => overlay().togglePause()]
    ```
    with `overlay = () => this.scene.get('OverlayScene') as OverlayScene` (lazy: OverlayScene is launched after InputController is built, and it is replaced on every restart, so never cache it).
    - Drag and breed modes belong to InputController itself (2.3, 2.7). When they arrive, their steps are its own methods placed in the same array. Write that in the doc comment.
  - [x] 7.2 `keyboard.on('keydown-ESC', this.onEscKey, this)` (remove it in `destroy()`):
    - Ignore `event.repeat`.
    - Run the chain in order, and stop at the first `true`.
    - Wrap the call in try/catch → `reportError('ui', …)`: keyboard handlers run inside Phaser's input step.
  - [x] 7.3 `onFarmKey`: replace the "Story 1.10: ignore shortcuts while a modal is open" comment with `if (this.hooks.modalOpen()) return;`.
  - [x] 7.4 `modalOpen` in GameScene: `() => this.paused || isLost(this.state)`. Pause covers every in-game modal, since OverlayScene pauses for each (6.3), and the lose check covers the lose panel. Expose `get modalOpen()` on GameScene for HudScene too.
  - [x] 7.5 Update the class doc comment: 1.10 added the Esc chain and the modal check.
- [x] **Task 8: HUD and sheep tooltips under a modal** (AC: 4)
  - [x] 8.1 `HudScene.farm`: guard `if (this.gameScene.modalOpen) return;` (this replaces the `isLost` check, which `modalOpen` now covers). The scrim already blocks the click; this covers anything else that calls `farm`.
  - [x] 8.2 `HudScene.refresh` → `updateTooltip(now, this.gameScene.modalOpen)`, generalising the `lost` parameter. A hover that began before Esc must not pop the Farm tooltip under the scrim.
  - [x] 8.3 `GameScene.update`: when `this.paused`, skip `sheepHover.update` and call a new `SheepHover.clear()` (make the existing private `clear` public). `SheepHover` reads raw pointer coordinates, not hit objects, so without this a sheep tooltip shows under the pause scrim. (On the lose screen there are no sheep, so it never came up in 1.8.)
- [x] **Task 8b: Pause button, top-left of the field** (AC: 3, 7; decision 2026-10-06, Rylan: "we can add a pause button to the top left")
  - [x] 8b.1 Add a `buttonPause` component to `COMPONENTS` in `src/config/constants.ts`. It is a new component spec, not a new token, and uses only existing tokens:
    - `wool` fill, `bark` border, `bark` text, hover `hay` (the `button-menu` look, since it opens a menu);
    - `label` typography, `rounded: 'md'`;
    - height 40 (`LAYOUT.hitMin`).
    - Mark it `[ASSUMPTION]` in a comment.
  - [x] 8b.2 Strings: `pauseLabel: 'Pause'` and `pauseTooltip: 'Pause (Esc)'`, both `[ASSUMPTION]` (not in the Voice table). The key hint goes in the tooltip, not a key box: the 26 px key box fits one letter, not "Esc".
  - [x] 8b.3 Build it in `HudScene` (UX layer 3, HUD) as a `Button`:
    - at `x = y = LAYOUT.safeMargin` (16, 16), the top-left corner, which is clear of the toasts (top-centre), the era badge (top-right, Epic 3) and the Better Place (x ≈ 450–590);
    - width fixed at about 96 px (measure "Pause" in label type, plus padding `SPACING[3]` each side);
    - `labelAlign: 'center'`, `activateOn: 'release'`.
    - Its handler, guarded with try/catch → `reportError('ui')`: `if (this.gameScene.modalOpen) return;` then `(this.scene.get('OverlayScene') as OverlayScene).openPause()`. Look it up on each click; never cache it (Gotcha 2).
  - [x] 8b.4 Its tooltip uses the same delay and `Tooltip` as the Farm button. Generalise `HudScene.updateTooltip` to the hovered button of the two (one tooltip at a time), keeping the `modalOpen` hide rule from 8.2. A tooltip at the top edge must flip below the button: check that `Tooltip.showAt` clamps it inside the canvas.
  - [x] 8b.5 While a modal is up, the overlay scrim covers the button (Overlay draws above Hud, and Phaser's top-only input applies), so it needs no extra disabled state. After **Resume** hides the panel with the pointer over this button's spot, the cursor is reset (Task 2.1).
  - [x] 8b.6 Record the change in the UX spec (the docs are the source of truth). Mark each addition "(added 2026-10-06, Rylan)":
    - `DESIGN.md`: a `button-pause` entry in the front-matter `components` and in the Components prose, and the button at the top-left in the Layout sketch/positions;
    - `EXPERIENCE.md`: the Information Architecture "Pause menu" row ("opened by `Esc` or the Pause button"), Component Patterns (Pause button: opens pause; covered by the scrim under modals), and Input Schemes (mouse-only completeness);
    - `epics.md`: UX-DR14 and UX-DR101 (positions) mention it.
- [x] **Task 9: Browser verification** (AC: 1–8)
  Use the 1.8/1.9 approach: a scratchpad `playwright-core` probe with system Chrome, a DEV server, and a temporary `window.__probeGame` hook in `main.ts`, removed afterwards. Check these:
  - **Boot with no save:** the title shows the logo, New Game and Credits only (Continue is hidden, not greyed), the 40% scrim, 3 sheep moving, and no GameScene/HUD active. New Game → game with 3 sheep at "0/8".
  - **Boot with a save:** Continue is first; Continue → the same game (ids, time, bar). New Game → confirm; Cancel → title; Esc on the confirm → title; Start over → the save key is gone, the settings key is unchanged, and a new game runs.
  - **Corrupt save:** the title shows no Continue, and the `[save]` warn, backup and removal from 1.9 still happen (now from TitleScene).
  - **Lost save:** Continue → the lose screen at once.
  - **Pause:**
    - `Esc` → "Paused" and 5 buttons, 72% scrim. `state.time` stays fixed over 2 s; sheep do not move; F and a Farm click do nothing; no Farm or sheep tooltip shows.
    - `Esc` again → play resumes, and time grows by at most one tick in the first frame.
    - Resume does the same, and the cursor is not left as a hand.
    - The **Pause button** (top-left, 16,16) opens the same menu. Its "Pause (Esc)" tooltip shows inside the canvas. It cannot be clicked under the pause or lose scrim.
  - **Sub-panels:** Volume, Stats and Credits each show the placeholder with the right header. Back and Esc → pause.
  - **Pause confirm:** Restart → confirm (it replaces the pause panel, which is not drawn). Cancel → pause; Esc → pause; Start over → new game (save wiped, unpaused, no modal).
  - **Hidden while paused:** hide, then show the tab → still paused, the panel is still up, and time has not moved.
  - **Lose:** Esc does nothing and F does nothing. Restart works as in 1.8.
  - **Hygiene:** after 3 Restarts from pause and 1 from lose, the bus `sim`/`farm:pressed` listener counts, `game.events` hidden/visible counts and the keyboard `keydown-ESC`/`keydown-F` counts are all unchanged, and one F = one pip. Autosave still writes once per 10 s.
  - **960×540:** the title, pause and confirm all fit and work, and the 20 px labels are ≥ 13.5 px on screen.
  - No console errors. Remove the hook and check that `dist/` has no `__probe` or debug strings.
- [x] **Task 10: Docs and deferred work** (AC: 9)
  - [x] 10.1 In `deferred-work.md`, mark these **Resolved in Story 1.10**, with one line each:
    - "Commands and pausing" (1.2) and "Paused Farm bursts" (1.6): Farm is ignored while a modal is open, so nothing queues;
    - "Esc and shortcuts on the lose screen" (1.8);
    - "`Button` hide/show in place" (1.8 review): cursor reset, plus the no-hover-until-move note;
    - "Load decision moves to the Title screen" and "Two pause sources" (1.9).
  - [x] 10.2 "HudScene lifetime" (1.6): still not triggered. There is no path from the game back to the title in v1 (the pause menu has no Quit). Add a line saying so, and leave it open for whoever adds one.
  - [x] 10.3 Add a section, "Deferred from: story 1-10-title-screen-pause-menu-and-start-over-confirm", for anything new. Expected:
    - **(3.5)** the era badge must stay visible top-right **above** the pause and confirm scrim (UX-DR20, DESIGN Layout), so it must render in OverlayScene or above it, not in HudScene;
    - **(5.7)** reduced motion for the lose scrim fade (if kept);
    - **(5.4, 5.7, 5.9)** replace `PlaceholderPanel`.

### Review Findings

- [x] [Review][Decision] Main Menu when the save fails. **Resolved (Rylan): option 1, now a patch.** If the save fails, hand the in-memory game to the title, which offers Continue for it. If saving was blocked by a sim error, the in-memory state may be bad: stay in the paused game with a short "couldn't save" toast (option 2). `quitToTitle` ignores `writeSave`'s result, so when storage is blocked or full, or saving stopped after a sim error, the title reloads an older save (or none) and the session's flock is lost without a word, although the comment says "nothing is lost". (edge+blind)
- [x] [Review][Patch] Main Menu save failure (from the decision above): hand the unsaved game to TitleScene for Continue; after a sim-error block, stay paused and show a toast [src/view/scenes/GameScene.ts:224]
- [x] [Review][Patch] The sheep tooltip clears only while paused, not under every modal (the lose screen, e.g. debug sheep after a loss). Use `modalOpen` [src/view/scenes/GameScene.ts:256] (blind+auditor)
- [x] [Review][Patch] Stale HUD hover after a modal: the scrim stops HUD pointer-out, so the Farm/Pause tooltip, hover look or hand cursor come back wrongly. Clear button hover when a modal opens [src/view/scenes/HudScene.ts:133] (blind+edge)
- [x] [Review][Patch] Sheep hover shows through HUD controls (the Pause button can sit over the panned pen; two tooltips at once). Skip the hover while the pointer is over a HUD control [src/view/field/SheepHover.ts:79] (edge+blind)
- [x] [Review][Patch] The hover hit test uses `getWorldPoint`, which reads last frame's camera matrix while panning. Use pointer + scroll, as the tooltip does [src/view/field/SheepHover.ts:79] (edge)
- [x] [Review][Patch] Pan and hover errors are reported as `sim` errors, which block saving. Give them their own `ui` guard [src/view/scenes/GameScene.ts:253] (blind)
- [x] [Review][Patch] The pan stays armed if the right button is released while the window has lost focus (alt-tab). Disarm on game BLUR/HIDDEN [src/input/InputController.ts:68] (blind)
- [x] [Review][Patch] Phaser's keyboard queue can re-dispatch an earlier Esc/F within one step (with 3 or more key events, its dedupe only checks the previous event). Ignore an event object already handled [src/input/InputController.ts:115] (edge)
- [x] [Review][Patch] `disableContextMenu` adds a permanent canvas listener on every GameScene start. Call it once at boot (it also covers the title) [src/input/InputController.ts:51] (edge)
- [x] [Review][Patch] TitleFlock timer and tween callbacks are unguarded (Gotcha 11) [src/view/field/TitleFlock.ts:39] (blind+auditor)
- [x] [Review][Patch] The title's Esc listener does not ignore key repeat [src/view/scenes/TitleScene.ts:95] (auditor)
- [x] [Review][Patch] `buttonPause` drifts from DESIGN.md (`padding` is only in code; the width is the literal `PAUSE_W`). Put the width in the component and DESIGN.md, and drop the unused padding [src/config/constants.ts:205] (auditor)
- [x] [Review][Patch] The title scrim takes its colour from `menuScrim`, not `menuScrimStart` [src/view/overlay/ModalController.ts:5] (auditor)
- [x] [Review][Patch] `ModalController.open()` with nothing showing leaves no way back, and the `GameScene.isPaused` getter is unused [src/view/overlay/ModalController.ts:51] (blind)
- [x] [Review][Patch] DEV: the debug panel (top-left, z-index 999) covers the Pause button. Move it [src/debug/DebugOverlay.ts:47] (edge)
- [x] [Review][Patch] The Dev Agent Record deviation list is out of order (…6, 8, 9, 7) [1-10 story file] (auditor)

## Dev Notes

### What exists today (read before changing)

- **`src/main.ts`:** loads fonts, then `new Phaser.Game` with `scene: [BootScene, PreloadScene, GameScene, HudScene, OverlayScene]`. The array order is render order, and updates run in reverse. The debug overlay is imported dynamically under `import.meta.env.DEV`.
- **`src/view/scenes/PreloadScene.ts`:** the loading bar and atlases. `create()` checks the atlases (toast if one is missing), then `loadSave()` → `stateCanRun` → `discardSave()` on failure → `scene.start('GameScene', data)`. **This load moves to TitleScene** (Task 4.2).
- **`src/view/scenes/GameScene.ts`:**
  - It owns the clock, `hidden`/`skipDelta`, `pendingCommands`, pools, `SheepHover` and `InputController`.
  - It starts autosave and the forced save, and handles HIDDEN/VISIBLE on `game.events` (removed on SHUTDOWN).
  - It launches `HudScene` and `OverlayScene` on every create.
  - `newGame()` stops autosave, clears the forced save, calls `wipeSave()` and restarts.
  - `stateCanRun(state)` is exported (used by Preload today, TitleScene after this story).
  - `update()`: the lost branch drops pending commands; otherwise it advances unless hidden; then `render()` and `sheepHover.update`.
  - **Preserve:** the `rawDelta` comment, `reportError('sim')`, the debug API (`simClock`, `stepOnce`, `debugMutate`, `loadState`), and the `data.state` consumption.
- **`src/view/scenes/HudScene.ts`:**
  - It reads the sim on PRE_RENDER (not `update`, because of the reverse update order).
  - `farm` is shared by the click and `bus 'farm:pressed'` (the F key); it guards `isLost`, squashes and dispatches.
  - `updateTooltip(now, lost)` stops the Farm tooltip under the lose scrim.
- **`src/view/scenes/OverlayScene.ts`:**
  - It has one interactive full-canvas scrim `Rectangle` (no handlers, so it swallows clicks; Phaser's top-only input keeps them from the HUD). `setScrim` also toggles `input.enabled`.
  - `LosePanel` is shown on the `Lost` event (250 ms fade), or at once in `create()` when the state is already lost.
  - The header comment says "Story 1.10 adds pause and the start-over confirm, reusing the one scrim".
- **`src/view/overlay/LosePanel.ts`:** **the pattern to copy.** A fixed-size `Panel` plus Texts plus a `Button` (`labelAlign: 'center'`, `activateOn: 'release'`), built once and toggled with `setVisible`.
- **`src/view/widgets/Button.ts`:**
  - It takes a `ButtonSpec`; `COMPONENTS.buttonMenu` and `buttonMenuDestructive` (`hoverBackgroundColor: 'alert'`) already exist and fit.
  - `setVisible` disables the zone and clears hover and press, but **does not reset the cursor** (Task 2.1).
  - `onUp` activates on release only if the press started on the button.
- **`src/view/widgets/Panel.ts` / `box.ts`:** baked box textures, cached per size and style. Fixed sizes only.
- **`src/input/InputController.ts`:** listens on `keydown-F` (not `addKey`), ignores repeat and modifier keys, emits `bus 'farm:pressed'`, and has a marked "Story 1.10" comment. `destroy()` removes it. The context menu is disabled.
- **`src/view/field/SheepHover.ts`:** reads `activePointer` world x/y against sprite bounds. It does **not** use hit objects, so it ignores the scrim (Task 8.3).
- **`src/config/constants.ts` `COMPONENTS`:** `buttonMenu`, `buttonMenuDestructive`, `panel` (wool, bark border, `insetColor`, lg, padding 16), `menuScrim` 0.72 and `menuScrimStart` 0.4. Everything needed exists; **no new tokens**.
- **`src/save/saveStore.ts`:** `loadSave`, `discardSave(storage?, raw?)`, `wipeSave`, `writeSave`, `startAutosave`, `allowSaving`/`blockSaving`. **Do not change it.**
- **`src/debug/DebugOverlay.ts`:** `activeScene()` returns null unless GameScene is active, so it is safe on the title (its actions do nothing there). Its speed re-apply works off POST_RENDER. Nothing to change. Do not use the debug speed for pause.
- **`assets/CREDITS.md`:** the source for the real Credits screen (5.9). Not used yet.

### Design decisions (made here; change only with Rylan)

1. **Pause lives in GameScene as a flag, and its UI lives in OverlayScene.** OverlayScene calls `gameScene.setPaused`, so the clock rule stays where the clock is. Architecture: "Pause (Esc menu, `visibilitychange` hidden) stops accumulation; nothing else is required."
2. **The Esc chain is an ordered array of "consume?" steps owned by InputController.** Later stories insert their step at the documented slot. Overlay steps come first, because a modal blocks the field (no drag or breed mode can start under it).
3. **Two modal hosts share one `ModalController`:** the title (40% scrim) and the overlay (72% scrim). The never-stack rule and `back()` exist once.
4. **No commands queue while paused.** Farm input is ignored under any modal, which closes the 1.2/1.6 burst items without touching `GameScene.dispatch`.
5. **Title sheep are cosmetic tweens, not a sim.** That keeps "only GameScene steps the sim" true, and three sprites cost nothing.
6. **A lost save still shows Continue** (it resumes to the lose screen, matching 1.9 AC 2). New Game on a lost save still confirms (Rylan, 2026-10-06).
7. **A Pause button at the top-left** (Rylan, 2026-10-06) makes pausing mouse-reachable. It lives in HudScene and calls `OverlayScene.openPause()`, the same path as `Esc`.

### Gotchas

1. **`keydown-ESC`, not `addKey(ESC)`.** `addKey` captures the key page-wide. In browser fullscreen (the itch.io button), the first `Esc` exits fullscreen and the page never gets it. That is browser behaviour; do not fight it.
2. **The OverlayScene instance changes on every GameScene restart** (`launch` restarts it). Never cache it in InputController or HudScene; resolve it with `scene.get` when needed, as HudScene does for GameScene.
3. **`scene.start('GameScene', …)` from TitleScene** shuts TitleScene down, so its SHUTDOWN handler must remove the Esc listener and kill its tweens. Pass `{}`, never `undefined`, for a new game (GameScene consumes `data.state`).
4. **Unpause without `clock.reset()`**, but with `skipDelta`. Reset drops the accumulator, and the sheep would snap back by up to one tick of interpolation.
5. **The hidden and paused flags are independent.** VISIBLE sets `skipDelta` and `clock.reset()` as in 1.9, and nothing else; a pause menu open before hiding is still open after.
6. **Clicking the scrim does nothing:** keep the scrim interactive with no handlers, and disable its input when no modal is up (`OverlayScene.setScrim`), or it blocks the HUD during play.
7. **`Button.setVisible(true)` under a still pointer shows no hover** until the pointer moves; clicks still work (Task 2.2).
8. **Fixed panel sizes:** measure once in the browser, then hard-code each as a commented constant (as `LosePanel` did: "measured 248").
9. **Phaser 4, not 3:** check `node_modules/phaser/skills/{scenes,input-keyboard-mouse-touch,tweens}/SKILL.md` before using `scene.start`/`launch`, keyboard events or tween configs from memory.
10. **No logging, storage or `JSON.stringify` in frame code.** The title's load runs once in `create()`, which is fine.
11. **Every handler that runs outside a tick** (button `onActivate`, key handlers, tween `onComplete`) is wrapped in try/catch → `reportError('ui', …)`. A throw inside Phaser's input step stops the game loop.
12. **Title text renders before GameScene,** so `markGameStarted()` has not run. A title error shows the boot toast (`STRINGS.bootErrorToast`), which is right: there is no flock to save yet.

### Architecture compliance

- **Scenes:** Boot → Preload → Title → Game, plus parallel Hud and Overlay. The scene key is the class name (AR6).
- **Pause = stop accumulating;** never `scene.pause()` (project-context Engine rules).
- **The view never mutates `GameState`.** Title only reads the loaded save and passes it to GameScene. Overlay/HUD call `dispatch`, `newGame` and `setPaused` only.
- **Only `src/save/` touches storage:** Title calls `loadSave`/`discardSave`/`wipeSave`.
- **Listener cleanup on SHUTDOWN** for every `bus.on`, `keyboard.on`, `events.on` and `game.events.on`.
- **Copy in `strings.ts`, colours from `COMPONENTS`/`COLORS`** (AR22). UI events, if any are added, are named `noun:verb` (e.g. `pause:opened`); none are required by this design.
- **No new dependencies; no `GameState` change; no `SAVE_SCHEMA_VERSION` bump.**

### File list (expected)

- **New:**
  - `src/view/scenes/TitleScene.ts`
  - `src/view/field/TitleFlock.ts`
  - `src/view/overlay/ModalController.ts`, `MenuPanel.ts`, `ConfirmPanel.ts`, `PlaceholderPanel.ts` (and `TitlePanel.ts` if not folded into `MenuPanel`)
- **Modified:**
  - `src/main.ts` (scene list)
  - `src/view/scenes/PreloadScene.ts` (start Title; the load moved out)
  - `src/view/scenes/GameScene.ts` (`paused`, `setPaused`, `isPaused`, `modalOpen`, input hooks, sheep tooltip clear)
  - `src/view/scenes/OverlayScene.ts` (`ModalController`; pause, sub-panels, confirm; Esc methods)
  - `src/view/scenes/HudScene.ts` (`modalOpen` guards, the Pause button, a tooltip for two buttons)
  - `src/config/constants.ts` (`COMPONENTS.buttonPause`)
  - UX docs: `DESIGN.md`, `EXPERIENCE.md`, `epics.md` (the Pause button, Task 8b.6)
  - `src/input/InputController.ts` (Esc chain, modal check)
  - `src/view/widgets/Button.ts` (cursor reset)
  - `src/view/field/SheepHover.ts` (public `clear`)
  - `src/view/strings.ts`
  - `_bmad-output/implementation-artifacts/deferred-work.md`
- **Tests:** there are no new unit tests. This story touches only the view and input layers, which Vitest does not cover (project rule: never mock Phaser). The existing 258 tests must stay green. Behaviour is proven by the browser probe (Task 9).

### Previous story intelligence (1.8, 1.9)

- **Patterns that worked:**
  - `LosePanel`: a fixed-size panel, built once and toggled with `setVisible`.
  - One interactive scrim with no handlers.
  - `labelAlign: 'center'` for menu buttons.
  - Show at once when the state is already lost.
  - Guarded handlers with `reportError('ui')`.
  - "Exactly one listener after 3 restarts" checks.
- **1.9 left these for this story:**
  - the load decision (Preload → Title);
  - the two pause flags;
  - autosave runs only in GameScene, so the title never saves;
  - `stateCanRun` is exported for this reuse.
- **1.8 review:**
  - The lose screen must swallow Esc and F (AC 5, Task 6.4).
  - `Button` hide/show in place (Task 2).
  - Vacuous checks were caught in review, so make each browser check prove a change (e.g. time **advances** after Resume, not just "no error").
- **1.9 review:** `newGame()` and `loadState()` stop autosave and the forced save before restarting; keep that when the confirm calls `newGame()`. The title's Start over has no running autosave, so it simply calls `wipeSave()` then `scene.start`.
- **Browser probes:** keep them in the scratchpad, use system Chrome on SwiftShader and a DEV server, remove the hook afterwards, and check that `dist/` is clean.

### Git intelligence

- Commits follow "Implement story X", then "Apply story X code review fixes". The last is `8d14fbe` (1.9 review fixes).
- This story's branch is `story/1-10-title-screen-pause-menu-and-start-over-confirm`, off `main` at `8d14fbe`.
- The files this story touches were last changed in 1.8 (`OverlayScene`, `LosePanel`, `Button.setVisible`/`labelAlign`) and 1.9 (`GameScene` hidden/autosave, `PreloadScene` load).

### Latest tech information

- **No new dependencies.** Stack pinned: Phaser ~4.2.1, TS ~6.0, Vite 8, Vitest ~4.1, Node ≥ 24.
- **Phaser 4 APIs this story uses** (all present in the installed 4.2.1; verify the exact signatures in `node_modules/phaser`):
  - `ScenePlugin.start(key, data)` stops the caller;
  - `launch` restarts a running scene;
  - `InputPlugin.resetCursor()` (since 3.85);
  - `KeyboardPlugin` events `'keydown-ESC'` (`KeyCodes.ESC = 27`);
  - `Text` style `wordWrap: { width }`;
  - tweens with `onComplete` (visual only).
- **Esc in the browser:** in element or browser fullscreen, Chrome, Firefox and Edge use the first `Esc` to leave fullscreen and do not deliver it to the page. Pressing it again pauses. Nothing to code; mention it in the probe notes if the itch.io embed is tested later (5.2).

### Project Structure Notes

- `TitleScene.ts` goes in `src/view/scenes/`, and the panels in `src/view/overlay/` (architecture directory tree: "PausePanel, … ConfirmPanel, LosePanel").
- **Variance:** the architecture names `PausePanel`; here the pause panel is a `MenuPanel` instance (the same widget the title uses). `CreditsPanel`, `VolumePanel` and `StatsPanel` are one `PlaceholderPanel` until 5.9, 5.7 and 5.4.
- **Variance:** `TitleFlock.ts` sits in `src/view/field/` (field art); the architecture lists only "decorative sheep" under Title.
- **Variance:** TitleScene owns its own Esc listener. It is a menu, not gameplay, and InputController (gameplay) lives in GameScene.

### Project Context Rules

- Scenes: Boot → Preload → Title → Game + Hud + Overlay; the key equals the class name; only GameScene runs the sim loop.
- Pausing = stop accumulating sim time in GameScene; never `scene.pause()` on GameScene.
- No Phaser timers or tweens may change `GameState`; tweens are for visuals only.
- Listener cleanup on SHUTDOWN; a restart must not double-subscribe.
- Input: one `InputController` for gameplay; UI widgets in HUD/Overlay may `setInteractive`. Esc priority: confirm → sub-panel → cancel drag → exit breed mode → close shop → pause. Ignore key repeats and ignore shortcuts while a modal is open.
- Fonts are loaded before any `Text` (already done in `main.ts`).
- Colours from `COLORS`/`COMPONENTS`, copy from `strings.ts`; no "!" except "Last sheep!".
- The only confirm is start-over (New Game with a save / pause Restart); Lose → Restart wipes without confirm; settings survive.
- Only `src/save/` touches `localStorage`; the game must run with storage unavailable (Title then shows no Continue).
- `Math.random()` only in cosmetic view code (title sheep).
- Done = `npm test`, `npm run typecheck`, `npm run lint` and `npm run build` pass; behaviour is verified in the browser.

### References

- Epic story: `_bmad-output/planning-artifacts/epics.md`, "Story 1.10"; FR43, FR44; AR6, AR8; UX-DR12–DR14, DR18, DR20, DR21, DR73, DR76, DR91, DR95.
- Architecture: `_bmad-output/game-architecture.md`:
  - Scene Structure and Communication (the Title and Overlay rows);
  - Input Handling (the Esc priority);
  - Game Time ("Pause … stops accumulation");
  - Data Persistence ("New Game (with save) and Restart wipe the save after the UX confirm");
  - Directory Structure (`overlay/`); System Location Mapping ("Menus & modals").
- UX:
  - `EXPERIENCE.md`: Information Architecture table and flow; Voice and Tone (the confirm and "Paused"); Component Patterns (Menu button, Panel / menu scrim, Start-over confirm); State Patterns ("No save", "Save exists", "Paused"); Interaction Primitives (Keys, Esc chain); Accessibility Floor ("Pausing").
  - `DESIGN.md`: Components (`button-menu`, `button-menu-destructive`, `panel`), Elevation & Depth (layer 4; modals never stack), Typography (`display` for the logo, `title` for "Paused").
  - Mockups: `mockups/title.html` (`.title-panel`, `.logo`, `.stack`) and `mockups/pause.html` (`.panel-hd`, `.confirm`, `.q`, `.pair`). They are illustrative; the spec wins on conflict.
- Project rules: `_bmad-output/project-context.md`.
- Previous stories: `1-8-losing-the-flock.md`, `1-9-save-resume-and-hidden-tab-pause.md`. Deferred items: `deferred-work.md` (every "Story 1.10" entry).

### Decisions from Rylan (2026-10-06)

1. **Pause by mouse:** add a Pause button at the top-left of the field (Task 8b), so a mouse-only player can reach the pause menu and, later, Volume.
2. **Lost save on the title:** keep it as built in 1.9. Continue shows the lose screen, and New Game still confirms.
3. **Placeholder copy:** "Coming soon." under the Volume, Stats and Credits headers until their stories. Approved.
4. **Pause appears at once** (no scrim fade); the lose screen keeps its 250 ms fade. Approved.

## Dev Agent Record

### Agent Model Used

Claude Opus 5.5 (1M context), `claude-opus-5-5[1m]`

### Implementation Plan

- **Shared modal pieces (`src/view/overlay/`):**
  - `MenuPanel`: a header plus a stack of menu buttons. It also exports `lineBox` (the panel size comes from typography tokens, so it is fixed) and `guarded` (try/catch → `reportError('ui')`).
  - `ConfirmPanel`, `PlaceholderPanel`.
  - `ModalController`: one scrim, one panel at a time, `open`/`back` for confirm and sub-panels, and the lose fade.
  - `LosePanel` became a `Modal` (`show` → `setView`).
- **Title:** `TitleScene` owns the boot load (moved from `PreloadScene`).
  - Its panel is built with or without Continue, so there are two fixed sizes.
  - The confirm wipes the save, then `scene.start('GameScene', {})`.
  - It has its own Esc listener.
  - `TitleFlock`: three cosmetic tween sheep outside the panel rect.
- **Pause:**
  - `GameScene.paused` sits beside `hidden`. `setPaused(false)` sets `skipDelta` (no `clock.reset()`).
  - `modalOpen` = paused or lost.
  - The sheep hover clears while paused.
  - `OverlayScene` runs pause, sub-panels, confirm and lose through `ModalController` and exposes the Esc steps.
- **Input:** `InputController` takes `InputHooks { modalOpen, esc[] }`. GameScene builds the chain in the documented order, with slots for 2.7/2.3/3.2. F is ignored under a modal; Esc ignores repeat and is guarded.
- **HUD:** `modalOpen` guards on `farm`, and one tooltip for the Farm and Pause buttons. The Pause button (top-left, `COMPONENTS.buttonPause`) calls `OverlayScene.openPause()`.

### Debug Log References

- **Measurement probe** (scratchpad `measure.mjs`):
  - The logo is 485 px wide in display type, so `TITLE_W` is 560 (37 px each side).
  - "Pause" is 59 px wide, so the 96 px button fits.
  - The confirm question wraps to 2 lines (66 px tall), as planned.
  - Screenshots `title.png`, `pause.png` and `confirm.png` were reviewed against the mockups.
- **Bug found by the probe:**
  - Title buttons ignored clicks: `Button.setDepth` raised the visuals but left the hit zone at depth 0, under the title scrim (depth 1000), and Phaser's top-only input picks by depth.
  - The fix sets the zone's depth too. The 1.8 lose panel had only worked because its scrim and zones were all at depth 0.
- **Full probe** (`probe110.mjs`): `playwright-core`, system Chrome on SwiftShader, a DEV server on port 5199, real mouse clicks, and a temporary `__probeGame` hook. **ALL PASS (47 checks)**:
  - **Title, no save:** New Game and Credits only; no Game/HUD/Overlay running; 40% scrim; 3 sheep moving.
  - **Title Credits:** Credits → placeholder, then back by Esc and by Back; Esc on the title panel does nothing.
  - **New Game:** starts 3 sheep at 0/8.
  - **Pause (Esc):**
    - Time is frozen for 2 s (2600 → 2600) and the sheep are still.
    - F and a Farm click do nothing (bar stays 1, 0 pending).
    - No Farm tooltip (which showed before) and no sheep tooltip under the scrim.
    - Esc resumes with +0 ms in the first frames, then time advances.
  - **Pause button:** opens the menu. Resume closes it, the cursor resets, and time advances. Its tooltip "Pause (Esc)" shows inside the canvas.
  - **Sub-panels:** Volume, Stats and Credits each show the right header with the pause panel hidden. Back or Esc returns to pause, still paused.
  - **Pause confirm:** Restart → confirm replaces the pause panel. Cancel and Esc both return to pause.
  - **Hidden tab:** hide/show while paused keeps it paused, with the panel up and time unchanged.
  - **Start over (pause):** a new game, unpaused; the save is wiped and the settings are kept.
  - **Hygiene:** after 3 pause Restarts and 1 lose Restart, the hidden/visible/ESC/F listener counts are unchanged (2,3,1,1), and one F = one pip.
  - **Lose screen:** Esc, F and the Pause button all do nothing.
  - **Autosave:** still writes every 10 s.
  - **Title, save:** Continue is listed first, and Continue resumes the same game (saved t 20600, live 20800).
  - **Title New Game with a save:** confirm. Cancel and Esc return to the title, and the save is kept. Start over wipes the save, keeps the settings, and starts a new game.
  - **Corrupt save:** no Continue, a `[save]` warn, the backup written and the key removed.
  - **Lost save:** Continue → lose screen.
  - No console errors.
- **Probe artifacts fixed (not code bugs):**
  - Reloading fires the hide-save, which overwrote a corrupt key planted before the reload. It is now planted from an init script.
  - Teleporting the pointer from Resume onto the Pause button gave Phaser no OVER (the HUD saw no pointer events under the scrim). The probe now moves through a point in between (noted in `deferred-work.md`).
- **Main Menu re-check** (`probe110.mjs`, extended, with pause-panel coordinates for 6 buttons): **ALL PASS on two runs (60 checks)**. New checks, done twice:
  - Pause → Main Menu shows the title with Game, HUD and Overlay all stopped.
  - The save equals the state at quit (time, `nextId`, bar).
  - Continue is offered, and F and Esc on the title do nothing.
  - Continue resumes the same game, unpaused.
  - After both round trips the listener counts are unchanged and one F = one pip.
  - Screenshot `pause6.png` reviewed.
- **Camera probe** (`pan.mjs`, run at 1280 and at 960): **ALL PASS at both sizes (15 checks each)**:
  - The pen is centred above the bar.
  - A right-click does not pan; a right-drag of 200/50 px pans exactly (±1.5 px at 960, where Chrome sends whole CSS pixels).
  - A left-drag, and a right-drag from the bar, do not pan.
  - Dragging far in each of the 4 directions keeps the whole pen in view (stops at 16 px).
  - Dragging across the HUD Pause button keeps panning.
  - The sheep tooltip shows beside the panned sheep.
  - No pan while paused.
  - Restart and Main Menu → Continue both re-centre.
  - No console errors.
  - **Fixed along the way:** per-step rounding lost 2 px per 200 at 960, so the exact scroll is now kept in `PenCamera`.
  - The full `probe110.mjs` re-ran 60/60 twice; screenshots `pan-centre.png` and `pan-moved.png` were reviewed.
- **960×540** (`small.mjs`): scale 0.75 (labels 15 px ≥ 13.5). The Pause button → pause → Restart → confirm → Cancel → pause all work by click. No errors.
- **Cleanup:** the hook was removed (`src/main.ts` differs from HEAD only by the TitleScene import and registration), the dev server was stopped, and `dist/` has no `__probe` or debug strings.

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created
- **AC verdicts:**
  - **AC 1:** Boot → Preload → Title. The title shows the logo, Continue (only with a runnable save, first), New Game and Credits (placeholder), over the 40% scrim, with three moving sheep. Continue resumes, including a lost save to the lose screen (browser).
  - **AC 2:** New Game with a save → confirm. Start over wipes and starts; Cancel or Esc return to the title (browser).
  - **AC 3:** Esc or the Pause button opens "Paused" with the 5 buttons over the 72% scrim, with the field frozen and still drawn. The clock stops through `paused` (no `scene.pause()`). Resume and Esc return with no burst. The placeholders and confirm behave as specified, and Start over runs `newGame()` (browser).
  - **AC 4:** one panel at a time (`ModalController`); the scrim swallows clicks; F, the Farm click and all tooltips are off under any modal (browser).
  - **AC 5:** the Esc chain is an ordered array (confirm → sub-panel → [2.7, 2.3, 3.2 slots] → pause). The lose screen swallows Esc, and repeat is ignored.
  - **AC 6:** all copy is in `STRINGS`; colours and sizes come from `COMPONENTS`, `COLORS`, `TYPOGRAPHY` and `SPACING`. No "!".
  - **AC 7:** every menu action works by left-click, including pausing (the Pause button), and Esc pauses at any time in play.
  - **AC 8:** autosave, resume, wipe on Restart, the lose screen and listener counts are all intact (browser).
  - **AC 9:** `npm test` 258/258 in 26 files. Typecheck, lint and build are clean (only the existing Phaser chunk-size warning), and `dist/` is clean.
- **Deviations and decisions:**
  1. **No `MenuPanel.setButtonVisible`** (Task 3.1). The title knows whether a save exists in `create()`, so it builds its panel with or without Continue. That gives the two fixed sizes the story asked for without moving buttons (`Button` has no `setPosition`).
  2. **The title panel is a `MenuPanel` with a `display` header** (Task 3.2 allowed either); there is no `TitlePanel.ts`.
  3. **Panel sizes come from typography line boxes** (`lineBox`), not measured Text. They are still fixed numbers (pause 312×454 with Main Menu, confirm 620×209, placeholder 312×182, title 560×266/330). Texts are centred in their line boxes, so a fallback font cannot shift them.
  4. **`Button.setDepth` now sets the hit zone's depth** (bug found by the probe; see Debug Log).
  5. **A constants test change:** `tests/config/constants.test.ts` now expects 36 DESIGN.md components (`button-pause` was added to DESIGN.md in Task 8b.6).
  6. **No new unit tests.** This story touches only the view and input layers (project rule: Vitest covers sim and save only). The browser probe is the proof.
  7. **Commands while paused:** nothing queues (Farm is ignored under a modal), so the 1.2/1.6 deferred items close without a queue cap.

  8. **Main Menu in the pause menu (Rylan, after implementation, 2026-10-06):** it is the last button. `GameScene.quitToTitle()` saves (validated `writeSave`, so it is refused after a sim error and the last good save stays), stops autosave and the forced save, stops HUD and Overlay, and starts the title, where Continue resumes. There is no confirm, because nothing is lost. The label "Main Menu" is an `[ASSUMPTION]` (not in the Voice table). This also closes the 1.6 "HudScene lifetime" item. EXPERIENCE.md and epics.md (UX-DR14, UX-DR95) record it.
  9. **Field camera (Rylan, 2026-10-06; outside the story's scope, built on this branch at his request):**
     - Every game (new, continued, restarted) opens with the pen centred in the field above the bottom bar (scroll 106,151).
     - A right-drag past 6 px pans, and the field follows the pointer. It is pinned so the whole pen stays at least 16 px inside the field.
     - A right-click under 6 px, a left-drag, a press on the bar, and any drag while a modal is up do not pan.
     - `PenCamera` keeps the exact scroll and shows whole pixels. `InputController` polls the pointer each frame, because Phaser stops sending moves to the game scene while the HUD is on top.
     - `SheepHover` now hit-tests with `camera.getWorldPoint`, and `Tooltip` is fixed to the screen.
     - UX docs, the architecture, project-context and `deferred-work.md` (notes for 2.3, 2.4, 2.7, 3.1, 3.3) record it.
### Review Follow-up (2026-10-06)

The review found 1 decision, 15 patches, 0 deferred items and 6 dismissed. The decision became a 16th patch.

- **Decision (Rylan): option 1.** If Main Menu's save fails, the in-memory game goes to the title, and Continue resumes it. If saving was blocked by a sim error, the game stays paused with the toast "Your flock couldn't be saved, so it stays here." (`TitleSceneData.unsaved`, `isSavingBlocked`).
- **16 patches applied:**
  - **Hover and tooltips:**
    - The sheep tooltip is off under every modal (`modalOpen`) and while the pointer is on a HUD control (`HudScene.pointerOverControl`).
    - The hit test uses pointer + scroll, not last frame's `getWorldPoint` matrix.
    - `Button.clearHover` runs on both HUD buttons when a modal opens (no stale tooltip, fill or hand cursor).
  - **Errors:** pan and hover have their own `ui` guard.
  - **Input:**
    - The pan is cancelled on game BLUR and HIDDEN.
    - Esc and F ignore an event object Phaser's keyboard queue dispatches twice.
    - The context menu is disabled once in `BootScene` (no more listener per game).
  - **Title:** the TitleFlock callbacks are guarded (`guarded` moved to `safetyNet`), and the title's Esc ignores repeat.
  - **Spec drift:**
    - `buttonPause` has width 96 in `COMPONENTS` and DESIGN.md, and its unused padding is dropped.
    - `ModalController` takes the scrim spec, so the title uses `menuScrimStart`.
    - `open()` with no panel up is an invariant.
    - The unused `isPaused` getter is removed.
  - **Other:** the DEV debug panel moved to the top-right, and the deviation list was renumbered.
- **Verification:**
  - `npm test` 258/258 (`isSavingBlocked` asserts added to the blocked-saving test). Typecheck, lint and build are clean, and `dist/` is clean.
  - Browser: `review110.mjs` 11/11.
    - Storage failing → Continue from memory resumes the game (bar 5 kept); later saves work again.
    - Blocked saving → the game stays paused with the toast.
    - No Farm tooltip after a menu closes elsewhere; no hand cursor over the scrim.
    - A sheep under the Pause button shows only the Pause tooltip.
    - Blur drops a pan; the context menu is blocked on the title.
    - No console errors.
  - `probe110.mjs` 60/60 and `pan.mjs` 15/15 re-ran green.

### File List

- `src/view/scenes/TitleScene.ts` (new)
- `src/view/field/TitleFlock.ts` (new)
- `src/view/scenes/BootScene.ts` (modified in review: context menu disabled once)
- `src/view/safetyNet.ts` (modified in review: `guarded` moved here)
- `src/save/saveStore.ts` (modified in review: `isSavingBlocked`)
- `tests/save/saveStore.test.ts` (modified in review: `isSavingBlocked`)
- `src/view/field/PenCamera.ts` (new: field camera, centre and pinned pan)
- `src/view/widgets/Tooltip.ts` (modified: fixed to the screen)
- `_bmad-output/game-architecture.md` (modified: right-drag pan)
- `_bmad-output/project-context.md` (modified: camera-aware hit tests)
- `src/view/overlay/ModalController.ts` (new)
- `src/view/overlay/MenuPanel.ts` (new)
- `src/view/overlay/ConfirmPanel.ts` (new)
- `src/view/overlay/PlaceholderPanel.ts` (new)
- `src/view/overlay/LosePanel.ts` (modified: `Modal`, `setView`)
- `src/view/scenes/OverlayScene.ts` (modified: `ModalController`; pause, sub-panels, confirm; Esc steps; `openPause`)
- `src/view/scenes/GameScene.ts` (modified: `paused`, `setPaused`, `isPaused`, `modalOpen`, input hooks, sheep tooltip clear, `quitToTitle`)
- `src/view/scenes/HudScene.ts` (modified: Pause button, `modalOpen` guards, a tooltip for two buttons)
- `src/view/scenes/PreloadScene.ts` (modified: starts the title; the load moved out)
- `src/main.ts` (modified: `TitleScene` registered)
- `src/input/InputController.ts` (modified: `InputHooks`, the Esc chain, the modal check, right-drag pan)
- `src/view/widgets/Button.ts` (modified: cursor reset on hide, zone depth)
- `src/view/field/SheepHover.ts` (modified: public `clear`, camera-aware hit test and tooltip)
- `src/view/strings.ts` (modified: menu copy, Pause button, Main Menu)
- `src/config/constants.ts` (modified: `COMPONENTS.buttonPause`)
- `src/debug/DebugOverlay.ts` (modified: comment only)
- `tests/config/constants.test.ts` (modified: 36 components)
- `_bmad-output/planning-artifacts/ux-designs/ux-sheep-civilization-2026-10-05/DESIGN.md` (modified: `button-pause`)
- `_bmad-output/planning-artifacts/ux-designs/ux-sheep-civilization-2026-10-05/EXPERIENCE.md` (modified: Pause button)
- `_bmad-output/planning-artifacts/epics.md` (modified: UX-DR14, UX-DR74, UX-DR95, UX-DR98, UX-DR101)
- `_bmad-output/implementation-artifacts/deferred-work.md` (modified)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modified)
- `_bmad-output/implementation-artifacts/1-10-title-screen-pause-menu-and-start-over-confirm.md` (this story)

## Change Log

| Date | Change |
|---|---|
| 2026-10-06 | Story created (ready-for-dev). Rylan's decisions added: a top-left Pause button, keep the lost-save Continue, "Coming soon." placeholders, an instant pause. |
| 2026-10-06 | Implemented: TitleScene (load decision, Continue / New Game / Credits, start-over confirm, decorative sheep), the pause menu with placeholder sub-panels and confirm (`ModalController`), the Esc chain and modal checks in InputController, the Pause button, and the `Button` depth and cursor fixes. UX docs updated. 258 tests; browser probe 47/47. Status → review. |
| 2026-10-06 | Rylan: added **Main Menu** as the last pause-menu button (it saves and returns to the title, with no confirm). `GameScene.quitToTitle()` stops HUD and Overlay with the game. EXPERIENCE.md and epics.md updated. 258 tests; browser probe 60/60 on two runs. Status stays review. |
| 2026-10-06 | Rylan: field camera. Every game opens with the pen centred above the bar; right-drag pans, pinned so the pen stays in view (`PenCamera`, `InputController` pan, camera-aware `SheepHover`, screen-fixed `Tooltip`). Docs updated. 258 tests; camera probe passes at 1280 and 960; full probe 60/60. Status stays review. |
| 2026-10-06 | Code review: 1 decision (Rylan: Main Menu keeps an unsaved game in memory for Continue; stays paused after a sim error) and 15 patches applied, 0 deferred, 6 dismissed. 258 tests; browser probes 11/11, 60/60, 15/15. Status → done. |
