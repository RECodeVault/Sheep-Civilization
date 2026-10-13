---
baseline_commit: 4260be8
---

# Story 5.7: Volume and Accessibility Settings

Status: done

<!-- Created 2026-10-09 by create-story. Branch `story-5.7` off `main` at 4260be8 (Story 5.6 done).
Story 5.6 already built the settings plumbing: `src/save/settingsStore.ts` (`sheepciv.settings`, field-by-field validation, 22 tests),
`src/view/settings.ts` (`getSettings` / `updateSettings` → saves and emits `settings:changed`), and `AudioDirector` applies
`musicVolume`, `sfxVolume` and `captions` live on `settings:changed`. `reducedMotion` is stored but read by nothing.
This story adds: the Volume panel (two sliders, two toggles, Back) in place of the pause menu's placeholder, the `Slider` and
`Toggle` widgets, an SFX-preview bleat on slider release, and reduced motion wired into every juice effect that earlier stories
flagged with "Story 5.7's reduced motion revisits …".
It does NOT add: the Stats panel (5.4) or Credits panel (5.9) — both keep `PlaceholderPanel`; the "Last sheep!" banner (5.5);
new juice (5.8); a Volume entry on the title screen (the IA puts Volume under Pause only).
No sim change at all: no `SimEvent`, no `GameState` field, `SAVE_SCHEMA_VERSION` stays as is. -->

## Story

As a player,
I want to set music and SFX volume, reduce motion and turn on captions,
so that I can play comfortably.

## Acceptance Criteria

1. **The Volume panel (UX-DR15, UX-DR20, UX-DR22, UX-DR87, UX-DR88).** Given the pause menu, when I click **Volume**, then the "Coming soon." placeholder is replaced by a `VolumePanel`: a wool `panel` headed "Volume" (title type), then four rows — **Music** slider, **SFX** slider, **Reduced motion** toggle, **Captions** toggle — each with its label in label type on the left and the control on the right, then **Back** (`button-menu`). The sim stays paused while it is open. **Back** and `Esc` return to the pause menu (Esc chain step 2, UX-DR73). The scrim swallows clicks outside the panel. Stats and Credits still open the placeholder.
2. **Slider (UX-DR22, UX-DR90).** `wool-shade` track, `hay` fill from the left up to the value, `bark` thumb 40 px tall. Press anywhere on the track (or the thumb) sets the value at the pointer and starts a drag; moving the pointer while held moves the value (clamped to 0–1), even when the pointer leaves the track or the panel; releasing anywhere (including outside the canvas) ends the drag. Hover highlights the slider (hand cursor + a visible hover look). The hit area is at least 40 px tall.
3. **Toggle (UX-DR22, UX-DR90).** 32 px tall; off = `wool-shade`, on = `hay`, `bark` knob (knob left when off, right when on); hover highlights; a click toggles. Hit area at least 40 px tall. A click pops (`button:activated`, same as every Button).
4. **Takes effect at once (UX-DR89).** Every change goes through `updateSettings` and takes effect immediately: music volume changes while dragging the Music slider; the SFX volume used by the next cue is the new one; Captions on/off applies to the next captioned cue; Reduced motion applies to the next juice effect and to running juice loops (Task 5) by the time the player resumes.
5. **SFX preview (UX-DR22, EXPERIENCE Component Patterns).** Releasing the SFX slider plays one `sfx-bleat` at the new SFX level through a new public `AudioDirector.previewSfx()`. At SFX 0 it is silent. Releasing the Music slider plays nothing extra. Nothing else in the panel calls `sound`.
6. **Stored separately and kept (UX-DR89, AR9).** Settings persist in `sheepciv.settings` (never in the save). They survive a reload, pause → Restart → Start over, Lose → Restart, and Main Menu → New Game. The panel opens showing the current values (after a reload too). A slider drag writes storage **once, on release**, not on every pointer move (project-context: no localStorage in frame code). Storage that is unavailable or throws never stops the panel working for this page.
7. **Reduced motion (UX-DR84, EXPERIENCE Game Feel & Juice).** Given reduced motion is on: float popups fade in place (no rise); the era banner fades in instead of sliding; screen-shake-like juice is off (the reveal ghost's shake and swell); and every juice item marked **Off** in the Reduced-motion table (Dev Notes) is replaced by its instant or fade alternative. Every item marked **Keep** is unchanged — in particular gameplay animation is **never** reduced: the Abomination's off-step gait and wider separation, sheep walking/wander and flock avoidance, thin/droop hunger poses, the infection wobble and bubble marker, the reveal flash (the truth), alert pings and their settled dots, and all glows, outlines, labels and tags that carry information. Turning it off restores the full juice.
8. **Debug label (deferred from 5.6).** The DEV debug overlay's "Captions: on/off" label follows `settings:changed`, so it stays right when the Volume panel toggles captions.
9. **Done = `npm test`, `npm run typecheck`, `npm run lint` all pass**, and the browser checks in Task 7 pass. Zero console errors (NFR8).

## Tasks / Subtasks

- [x] **Task 1: Strings and layout constants (AC 1)**
  - [x] 1.1 `src/view/strings.ts`, in the pause-menu group: `volumeMusic: 'Music'`, `volumeSfx: 'SFX'`, `reducedMotion: 'Reduced motion'`, `captionsLabel: 'Captions'` (names per EXPERIENCE IA "Music slider, SFX slider, Reduced motion toggle, Captions toggle"; mark `[ASSUMPTION] Not in the Voice table` like the other panel strings; see Open Question 1). The panel header reuses `STRINGS.volume`. No "!".
  - [x] 1.2 No new colour or typography tokens: `COMPONENTS.slider` (`trackColor woolShade`, `fillColor hay`, `thumbColor bark`, `height 40`) and `COMPONENTS.toggle` (`offColor woolShade`, `onColor hay`, `knobColor bark`, `height 32`) already exist in `src/config/constants.ts`. Any extra size (track length and thickness, thumb width, toggle width, knob inset, row height) is a named `[ASSUMPTION, tune in the browser]` constant at the top of its widget file, built from `SPACING` / `LAYOUT.hitMin` where possible. No literal pixel values inline.

- [x] **Task 2: Pure slider math, tested (AC 2)** — new `src/view/widgets/sliderMath.ts`, tests `tests/view/widgets/sliderMath.test.ts` (the `tests/view/field/layout.test.ts` precedent: a pure view helper with no Phaser import may be tested)
  - [x] 2.1 `valueAt(pointerX, trackX, trackW): number` → clamped to [0, 1]; `thumbX(value, trackX, trackW)`; optionally `snap(value, step)` if you quantise (Open Question 3; default: **no** snap, but round to 2 decimals so the stored JSON stays tidy).
  - [x] 2.2 Tests: both ends clamp (pointer left of / right of the track); midpoint; NaN-safe (a zero-width track returns 0, never NaN, so `validSettings` would never need to reject it); round trip `valueAt(thumbX(v)) ≈ v`.

- [x] **Task 3: Widgets (AC 2, 3)** — new `src/view/widgets/Slider.ts`, `src/view/widgets/Toggle.ts` (architecture tree lists both under `widgets/`)
  - [x] 3.1 **Baked textures, never per-frame Graphics** (`box.ts` header: a live Graphics costs FPS). Track, fill and thumb as Images from `boxTexture` (fill uses a fixed full-length texture shown with `setCrop` or `setDisplaySize`/`scaleX` from the left edge — your pick, no new texture per value); toggle off/on boxes and the knob from `boxTexture` too. Outline 2 px bark and the drop, as every DESIGN.md control (UX-DR8). Hover look: follow Button (e.g. outline/fill change or `woolShade` → a hover variant); keep it visible but small, and say which in a comment.
  - [x] 3.2 **Input** (HUD/Overlay widgets may `setInteractive`, project-context Input rule): one Zone per control at least `LAYOUT.hitMin` tall with `useHandCursor`, `setDepth` passed to the Zone too (Button.setDepth's comment: top-only input picks by depth). Slider: on zone `pointerdown` (left button only) set value + start drag; while dragging listen to `scene.input` `pointermove` and `pointerup` **and** `Phaser.Input.Events.GAME_OUT` / `pointerupoutside` so a release off-canvas still ends the drag (Button already handles `GAME_OUT`; mirror it). Remove every `scene.input.on` in a `SHUTDOWN` once-handler (OverlayScene restarts with GameScene).
  - [x] 3.3 API: `new Slider(scene, { x, y, width, value, onChange(v), onRelease(v) })` with `setValue(v)` (no callback; for showing the stored value), `setVisible`, `setDepth`. `onChange` fires only when the value actually changes; `onRelease` once per drag. `new Toggle(scene, { x, y, on, onToggle(on) })` with `setOn(on)` (no callback), `setVisible`, `setDepth`. A hidden widget takes no input and drops any drag (as `Button.setVisible`): hiding the panel mid-drag (Esc while holding) must end the drag without a stuck state and without calling `onRelease` twice.
  - [x] 3.4 Toggle activation emits `bus.emit('button:activated', undefined)` before `onToggle` (the 5.6 pop path; AudioDirector already listens). Sliders do not pop.
  - [x] 3.5 Copy and colours only from `STRINGS` / `COMPONENTS` / `COLORS`; no hex, no text literals.

- [x] **Task 4: VolumePanel and OverlayScene wiring (AC 1, 4, 5, 6)**
  - [x] 4.1 New `src/view/overlay/VolumePanel.ts` implementing `Modal`: same frame as `PlaceholderPanel` / `MenuPanel` (padding `SPACING[4]`, header gap `SPACING[3]`, `lineBox()` heights, `BODY_GAP` above Back, centred on the canvas, a fixed size so `Panel` bakes one texture). Width: wide enough for "Reduced motion" in label type plus a usable slider; `[ASSUMPTION]` start around 440–480 px and check in the browser. Rows: label left-aligned, control right-aligned, rows `max(LAYOUT.hitMin, slider height) + SPACING[3]` apart. Back centred at the bottom, `activateOn: 'release'`, `guarded(onBack)`.
  - [x] 4.2 `setVisible(true)` refreshes every control from `getSettings()` (so a reload or a debug toggle shows the truth) **before** showing.
  - [x] 4.3 Wiring: Music `onChange` → live `updateSettings({ musicVolume: v }, { persist: false })`; `onRelease` → `updateSettings({ musicVolume: v })` (persists). SFX the same, and `onRelease` also calls `audioDirector()?.previewSfx()` **after** the update so the bleat uses the new level. Toggles → `updateSettings({ reducedMotion })` / `updateSettings({ captions })`. Every callback wrapped with `guarded` / try → `reportError('ui', …)` like other overlay callbacks (Phaser input step).
  - [x] 4.4 `src/view/settings.ts`: add the optional second parameter `updateSettings(patch, { persist = true } = {})`. With `persist: false` it updates `current` and emits `settings:changed` but does not call `saveSettings`. Keep validation exactly as now (`validSettings`). Update the module header ("Story 5.7's Volume panel edits them").
  - [x] 4.5 `src/view/scenes/OverlayScene.ts`: add modal id `'volume'` to `OverlayModal`; build `VolumePanel(this, PANEL_DEPTH, () => this.modals.back())`; the pause item **Volume** calls `this.modals.open('volume')`; Stats and Credits keep `openSubPanel(...)` with the placeholder. `closeSubPanel()` must return true for **both** `'subPanel'` and `'volume'` (Esc chain step 2). Update the class doc comment.
  - [x] 4.6 `src/view/audio/AudioDirector.ts`: add `previewSfx(): void` — plays `SFX.bleat` (rate 1, no jitter so the level is what you judge) through the normal `play()` path with `force = true` (skip the repeat gap and voice cap; still silent while locked, suspended or with no sprite, and silent at volume 0 by the existing `volume <= 0` check). Wrap in try/catch → `reportError('ui', …)`. No other director change is needed: `onSettings` already sets the music volume and stores the settings for SFX and captions.
  - [x] 4.7 Mid-drag Esc / Back: hiding the panel ends the drag (Task 3.3). If a Music/SFX drag is cut short this way, persist the last value (call the `onRelease` path once) so live and stored settings agree; do **not** play the preview in that case. Document the choice in a comment.

- [x] **Task 5: Reduced motion across the juice (AC 7)**
  - [x] 5.1 `src/view/settings.ts`: export `reducedMotion(): boolean` (returns `getSettings().reducedMotion`; a property read, no allocation, fine per frame). Every consumer reads it **when an effect starts**, or per frame for frame-driven loops — never caches it at construction.
  - [x] 5.2 Long-running tween loops that are already running when the setting flips (FarmBoost glow pulse, PregnancyHeart bob, BetterPlace/Market armed loops, AlertPing bob, breed candidate pulse) must switch by the time the player resumes. Either the component reads `reducedMotion()` per frame in its existing update path, or its owning scene subscribes to `settings:changed` (and removes the listener on `SHUTDOWN`) and calls a `setReducedMotion(on)` on it. Pick per component by how it is driven today; read the file first.
  - [x] 5.3 Apply the **Reduced-motion table** in Dev Notes, row by row. Each constant block already carries a "Story 5.7's reduced motion revisits …" comment: replace that comment with what reduced motion now does, so no "revisits" note is left behind (`grep -rn "5.7" src` should only find as-built comments).
  - [x] 5.4 The infection wobble, the off-step gait, wander/avoidance, hunger poses, the reveal **flash**, ping/dot, glows, outlines, tags and labels must be untouched by the setting: do not add `reducedMotion()` to `SheepSprite`'s wobble/marker paths, `gait.ts`, `EntityLayer` movement, or the reveal flash beats.
  - [x] 5.5 No sim reads the setting (sim is pure; lint-enforced). Nothing in `src/sim/` changes.

- [x] **Task 6: Debug overlay and docs (AC 8)**
  - [x] 6.1 `src/debug/DebugOverlay.ts`: refresh the Captions button label on `bus.on('settings:changed', …)` (page-lifetime, like the overlay's other handlers; say so in a comment). Optionally add a "Reduced motion: on/off" debug button next to it for quick A/B checks.
  - [x] 6.2 `_bmad-output/game-architecture.md` (as built): Volume panel in `src/view/overlay/VolumePanel.ts`; `Slider` / `Toggle` widgets; `updateSettings(patch, { persist })` (live during drag, saved on release); `AudioDirector.previewSfx()`; `reducedMotion()` helper and the Keep/Off rule.
  - [x] 6.3 `_bmad-output/implementation-artifacts/deferred-work.md`: mark resolved — every "Reduced motion (Story 5.7)" entry (lines ~148, 182, 201, 212, 235, 256, 280, 295, 308, 382, 396), the "Placeholder panels" entry's Volume part (Stats/Credits remain for 5.4/5.9), the "Volume panel (Story 5.7)" entry (~439), the "Debug Captions label" entry (~452), and the "Settings store (Story 5.7)" entry (~135, already done in 5.6 — close it). Add entries for anything you defer (e.g. 5.8 must call `reducedMotion()` for every new juice item it adds; the "Last sheep!" banner in 5.5 must fade under reduced motion like the era banner).
  - [x] 6.4 `sprint-status.yaml`: 5-7 → `review` when done (create-story already set `ready-for-dev`).

- [x] **Task 7: Verify (AC 9)**
  - [x] 7.1 `npm test`, `npm run typecheck`, `npm run lint` — green. All existing tests unchanged (no sim edits). New tests: `sliderMath.test.ts`; extend `tests/save/settingsStore.test.ts` only if `settingsStore.ts` changes (it should not need to).
  - [x] 7.2 Browser (`npm run dev`, then `npm run build && npm run preview` once), Chrome and Firefox:
    - Pause → Volume: panel shows current values; Back and Esc return to Paused; Esc again resumes. Stats/Credits still show "Coming soon.".
    - Drag Music: the loop's volume follows the drag live; drag off the panel and off the canvas, release outside: the drag ends, the value sticks. Click-to-set on the track works. Music at 0: silent.
    - Drag SFX and release: one bleat at the new level; at 0, no bleat; F key pops at the new level after Resume.
    - Toggles: click flips, pop plays; Captions on → sacrifice shows `[suction]`; off → nothing.
    - Reload: all four values persisted. Restart → Start over, Lose → Restart, Main Menu → New Game: unchanged.
    - Reduced motion on: "+1" popup fades in place; era banner fades in (debug add sheep to cross an era); sacrifice an Abomination (debug reveal): flash but no swell/shake; walk through the Off rows of the table. Then confirm the Keep rows: off-step gait still visible, infection wobble still visible, pings still appear.
    - Toggle reduced motion while a boost is running (sacrifice, then pause → Volume): after Resume the glow no longer pulses (and pulses again when turned off).
    - Storage blocked (DevTools → block site data, or debug): the panel still works for the page, a warning is logged once, no toast, no crash.
    - At a 960×540 window the panel text is legible (UX-DR99).
    - Zero console errors.
    - **Not run — accepted as done by Rylan (2026-10-13):** Firefox; drag released outside the canvas; reduced motion toggled mid-boost (glow on Resume); Restart / Start over and blocked storage, in the browser; the remaining Off rows, by eye. Done in headless Chrome: panel open/Back/Esc, live music drag, save on release only, SFX preview, toggles, reload persistence, 960×540 legibility, reduced-motion popup and banner, zero console errors.

### Review Findings

- [x] [Review][Decision] Task 7.2 / AC 9 checked though several browser checks were not run — resolved: 7.2 unticked, open checks listed under it. Completion Notes list Firefox, release outside the canvas (AC 2), reduced motion toggled mid-boost, Restart/Start over and blocked storage in the browser, and most Off rows as unverified, yet 7.2 is `[x]` and Status is `review`.
- [x] [Review][Decision] Better Place 4 px lift kept under reduced motion, table says Off — `SheepSprite.ts` still applies `LIFT_PX`; the Reduced-motion table row "Better Place ring spin, hole suck, 4 px lift" says **Off**. The as-built note argues the lift is a static "in hand" pose; needs a call: keep (update the table) or drop the lift. Resolved: keep; table updated.
- [x] [Review][Patch] Slider drag sticks when the release is lost (alt-tab, window blur): moving with no button held keeps changing the volume [src/view/widgets/Slider.ts:189]
- [x] [Review][Patch] Slider drag is not bound to the pointer that started it (a second pointer moves or ends it) [src/view/widgets/Slider.ts:182]
- [x] [Review][Patch] Scene SHUTDOWN mid-drag never saves the live value (persist:false) [src/view/widgets/Slider.ts:96]
- [x] [Review][Patch] Rapid clicks on the SFX track stack forced preview bleats past the voice cap [src/view/audio/AudioDirector.ts:145]
- [x] [Review][Patch] AlertPing: turning reduced motion off mid-bob does not restore the bob (no tween was started); always run the bob and mask it per frame, as PregnancyHeart does [src/view/field/AlertPing.ts:69]
- [x] [Review][Patch] stackTopY still reserves the candidate pulse and pin bob under reduced motion, so the ping floats with a gap [src/view/field/SheepSprite.ts:330]
- [x] [Review][Patch] VolumePanel does not follow settings:changed while open (debug toggle), contradicting its doc comment [src/view/overlay/VolumePanel.ts:111]
- [x] [Review][Patch] Reduced-motion suction fade keeps Cubic.easeIn, so the ghost sits then vanishes abruptly [src/view/scenes/GameScene.ts:993]
- [x] [Review][Patch] Slider track baked with drop:false; Task 3.1 asks for the drop on every control [src/view/widgets/Slider.ts:70]
- [x] [Review][Patch] No unit test for updateSettings persist:false (no write, still emits) [src/view/settings.ts:24]
- [x] [Review][Patch] Stale text: OverlayScene "first three pauses" comment, bus.ts settings:changed comment, leftover "Ultimate context engine" Completion Note [src/view/scenes/OverlayScene.ts:34]
- [x] [Review][Defer] Reduced motion toggled from the DEV debug overlay with no modal open leaves running effects (Farm glow, highlights, breed markers) in the old mode until they restart [src/view/hud/FarmBoost.ts] — deferred, DEV-only path
- [x] [Review][Defer] Closing the tab mid-drag loses the live (unsaved) slider value; no pagehide flush [src/view/settings.ts] — deferred, rare edge

## Dev Notes

### What this story is (and is not)

- **Is:** `VolumePanel`, `Slider`, `Toggle`, a tiny tested `sliderMath`, a `persist` option on `updateSettings`, `AudioDirector.previewSfx()`, the `reducedMotion()` helper and its use across existing juice, a debug label fix, docs.
- **Is not:** Stats (5.4), Credits (5.9), Last sheep banner (5.5), new juice (5.8), keyboard control of sliders (mouse-only completeness is the bar, UX-DR76), a Volume entry on the title screen. No sim, save schema or asset changes.

### Reduced-motion table (defaults; [ASSUMPTION] where the UX spec is silent — see Open Question 2)

Rule: reduced motion removes **juice movement** — slides, rises, bounces, pops (scale-in), bobs, spins, hops, squashes, shakes, rolls — replacing each with an instant change or a fade. It keeps **information** and **gameplay animation**, and keeps fades, tints, glows (held steady instead of pulsing) and small particle bursts.

| Effect | Where | Reduced motion |
|---|---|---|
| Float popup rise ("+1", "$10", "×2") | `juice/FloatPopups.ts` `RISE_PX` | **Off**: fade in place (UX-DR44, UX-DR84) |
| Era banner slide-in | `hud/EraBanner.ts` `ERA_BANNER_MOTION.slideMs` | **Off**: appears at x 0 and fades in over `slideMs`, then holds and fades out as now (UX-DR84) |
| Reveal ghost swell + shake | `GameScene.ts` `REVEAL.swellScale`, `REVEAL.shakePx` | **Off** (the "screen shake" item). The flashes **Keep** — the truth |
| Suction spiral | `GameScene.ts` `SUCTION` | **Off**: ghost fades out at the hole, no spin/travel. Halo sparkles **Keep** |
| Sale hop into the stall | `GameScene.ts` `SALE` | **Off**: ghost fades out in place |
| Cure sparkle, death dust puff, land dust burst, decoration dust | `GameScene.ts` | **Keep** (small particle cues) |
| Button squash | `widgets/Button.ts` `SQUASH` | **Off** (pressed fill still shows) |
| Food landing bounce | `field/FoodSprite.ts` `BOUNCE_*` | **Off**: lands at once |
| Carcass flop | `field/CarcassSprite.ts` `FLOP` | **Off**: appears flat at once |
| Decoration pop-in | `field/Decorations.ts` `POP` | **Off**: shown at once |
| Pregnancy heart pop + bob | `field/PregnancyHeart.ts` | **Off**: shown at once, no bob (heart **Keep**) |
| Breed candidate pulse, pinned-heart bob | `field/SheepSprite.ts` `CANDIDATE_PULSE`, `PIN_BOB` | **Off**: static heart (marker **Keep**) |
| Ineligible-sheep shake | `field/SheepSprite.ts` `SHAKE` | **Keep** — the only "no" feedback in breed mode (UX-DR70) |
| Infection wobble + bubble marker bob | `field/SheepSprite.ts` `WOBBLE`, `MARKER_BOB` | **Keep** — gameplay information (UX-DR84, UX-DR85) |
| Off-step gait, wider separation, wander, avoidance, hunger poses | `field/gait.ts`, `EntityLayer`, sim | **Keep** — never touched |
| Alert ping pop + bob | `field/AlertPing.ts` `PING.popMs`, `bobPx` | **Off**: appears at once, no bob; ping → settled dot timing **Keep** |
| Better Place ring spin, hole suck | `field/BetterPlace.ts` `BP_MOTION` | **Off**: static ring; lit rim, glow, label **Keep**. The held sheep's 4 px lift **Keep** (a static "in hand" pose; review decision 2026-10-13) |
| Market outline pulse, awning flap, tag growth, stall nudge | `field/Market.ts` `MARKET_MOTION` | **Off**: outline steady at full alpha; outline, tag, "Too young" **Keep** |
| Farm boost glow pulse | `hud/FarmBoost.ts` `BOOST_MOTION` | **Off**: glow held at full; glow, "×2" badge **Keep** |
| Boost timer pop | `hud/BoostTimer.ts` `BOOST_TIMER_MOTION` | **Off** |
| Money counter roll | `hud/MoneyCounter.ts` `MONEY_MOTION` | **Off**: new balance at once |
| Era background crossfade (1 s) | `field/EraBackground.ts` `ERA_FADE_MS` | **Keep** (a slow fade, not movement; deferred-work said "it may") |
| Lose-screen scrim fade (250 ms) | `OverlayScene.ts` `SCRIM_FADE_MS` | **Keep** (a fade) |
| Caption fade-out (200 ms) | `hud/Captions.ts` | **Keep** (a fade) |
| Title screen sheep walks | `field/TitleFlock.ts` | **Keep** (sheep walking is gameplay-style animation, as in the pasture) |
| Held medicine ×1.2 over an infected sheep | `hud/MedicineSlot.ts` | **Keep** — the only drop cue |
| Empty-meter shake | — | Does not exist (the food meter was replaced by the Farm progress bar on 2026-10-06, no stock). 5.8 must respect `reducedMotion()` if it adds one |
| Screen (camera) shake | — | None exists (`grep cameras.main.shake` finds nothing). 5.8 must respect the setting if it adds one |

### Current code to build on (read these first)

- `src/view/settings.ts` (25 lines) — `getSettings()` (cached, frozen, replaced on change), `updateSettings(patch)` → `validSettings(patch, current)` → `saveSettings` → `bus.emit('settings:changed', next)`. Add `persist` and `reducedMotion()` here.
- `src/save/settingsStore.ts` — `Settings { musicVolume, sfxVolume, reducedMotion, captions }`, `DEFAULT_SETTINGS` (0.5 / 0.8 / false / false), `loadSettings`, `validSettings`, `saveSettings` (warn once while failing). Already tested incl. "settings survive Restart" (`wipeSave` leaves the key). **No change expected.**
- `src/view/audio/AudioDirector.ts` — `onSettings` stores the settings and calls `music.setVolume`; `play(marker, rate, delayS, force)` reads `settings.sfxVolume` per play and returns at volume ≤ 0; `caption()` reads `settings.captions`. Add `previewSfx()`. `audioDirector()` returns the page singleton or null.
- `src/view/scenes/OverlayScene.ts` — `ModalController<'pause' | 'subPanel' | 'confirm' | 'lose'>`; pause items; `openSubPanel(header)`; `closeSubPanel()` (Esc step 2, called by GameScene's InputController hooks at `GameScene.ts:375`). Restarted with GameScene on every Restart: listeners off on SHUTDOWN.
- `src/view/overlay/ModalController.ts` — `open(id)` remembers where it came from; `back()` returns; modals replace, never stack; the scrim swallows clicks.
- `src/view/overlay/PlaceholderPanel.ts`, `MenuPanel.ts` — the frame and `lineBox()`; copy their layout constants (PAD, HEADER_GAP, BODY_GAP) for the VolumePanel. `PlaceholderPanel` stays for Stats/Credits (pause) and Credits (title).
- `src/view/widgets/Button.ts` — the model for Slider/Toggle: Zone-based input separate from visuals, `setDepth` on the zone, `GAME_OUT` handling, `setVisible` dropping hover/press and resetting the cursor, baked per-state textures, `activate()` emitting `button:activated`.
- `src/view/widgets/box.ts` — `boxTexture(scene, w, h, { fill, border, radius, drop })` cached by key; `textStyle(role, color)`; `OUTLINE_PX`, `DROP_PX`.
- `src/config/constants.ts` — `COMPONENTS.slider` / `toggle` (~line 279), `COMPONENTS.buttonMenu`, `COMPONENTS.panel`, `SPACING`, `RADIUS`, `LAYOUT.hitMin`, `CANVAS_WIDTH/HEIGHT`.
- `src/debug/DebugOverlay.ts` (~line 370) — the 5.6 captions button whose label goes stale.
- The juice files in the table above, each with its named motion constants and a "Story 5.7 … revisits" comment.
- Phaser 4 input: `node_modules/phaser/skills/input-keyboard-mouse-touch/SKILL.md` — verify `pointerupoutside`, `GAME_OUT`, `pointer.leftButtonDown()` / `leftButtonReleased()` against the installed source before use.

### What must be preserved

- Pause menu order and behaviour (Resume, Volume, Stats, Restart, Credits, Main Menu); start-over confirm; lose screen; the era badge above the scrim.
- Esc chain order (confirm → sub-panel → drag → breed → shop → pause); the Volume panel is a sub-panel.
- Settings validation (NaN / out of range / wrong type keep the current value) and the warn-once write failure.
- AudioDirector: autoplay gate, lock/suspend silence, voice cap, the 5.6 cue map. `previewSfx` must not bypass the lock gate.
- All gameplay animation and every information-bearing visual (Keep rows). Secrecy: nothing here reads the Abomination; the off-step gait must look identical with reduced motion on.
- Pools and no hot-path allocation: no new objects per frame in any juice path; reading `getSettings().reducedMotion` is fine.
- Every seeded sim test, unchanged.

### Design decisions (defaults chosen; see Open Questions)

- **Live during drag, saved on release** (`persist: false` while moving): "takes effect immediately" for the ear, with one storage write per gesture.
- **Preview on SFX release only**, via a director method, forced past the repeat gap so repeated releases always sound.
- **Separate modal id `'volume'`** rather than reusing `'subPanel'`: the placeholder still serves Stats and Credits until 5.4/5.9.
- **Read the setting when an effect starts**; loops already running switch via a frame read or `settings:changed`.
- **The Keep/Off rule** above: fades and particles stay, movement juice goes, information never goes.

### Architecture compliance

- Only `src/save/` touches `localStorage` (lint): the panel calls `updateSettings`, never storage.
- Sounds only through `AudioDirector`: the panel calls `previewSfx()`; the toggle pops via `button:activated`.
- Copy from `strings.ts`; colours from `COMPONENTS`/`COLORS`; typography from `TYPOGRAPHY` via `textStyle`.
- Listener cleanup on SHUTDOWN for every `scene.input.on` / `bus.on` the panel, widgets or scenes add; the debug overlay's listener is page-lifetime (documented).
- Baked textures, no per-frame Graphics; no allocation in frame paths.
- `src/view/widgets/{Slider,Toggle}.ts` and `src/view/overlay/VolumePanel.ts` match the architecture's directory tree (`overlay/ … VolumePanel`, `widgets/ … Slider, Toggle`).
- No new npm packages.

### Library / framework notes

- **Phaser 4.2.x, not 3.** Input events: `Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN/OVER/OUT/UP`, scene-level `POINTER_MOVE`, `POINTER_UP`, `POINTER_UP_OUTSIDE`, `GAME_OUT`. Check names in `node_modules/phaser/src/input/events/` rather than from memory.
- `Image.setCrop(x, y, w, h)` works on a texture-backed image without a new texture (for the slider fill); or scale a 1-px-wide fill — either avoids per-value textures.
- `BaseSound.setVolume(v)` takes 0–1; `playAudioSprite` volume 0 is legal but the director already returns early.
- No web research needed beyond the installed source: the stack is pinned (Phaser 4.2.x, TS 6, Vite 8, Vitest 4.1) and nothing new is added.

### Testing standards

- Vitest covers `src/sim/` and `src/save/` plus pure view helpers with no Phaser import (precedent: `tests/view/field/layout.test.ts`, `tests/view/assetKeys.test.ts`). New: `tests/view/widgets/sliderMath.test.ts`. Never mock Phaser.
- If you touch `settingsStore.ts`, extend its tests; `src/view/settings.ts` imports the bus (no Phaser) and could be tested too (`persist: false` emits but does not write) — optional, with a fake storage only if `loadSettings`/`saveSettings` accept one through it; don't restructure for it.
- Widgets, panel, audio and reduced motion are verified in the browser (Task 7).

### Previous story intelligence (5.6 and earlier)

- 5.6 set the plumbing and left the hooks: `updateSettings` is the entry point; AudioDirector already applies volumes and captions on `settings:changed`; "Release of the SFX slider can preview with a bleat through a new public director method (none exists yet)"; the debug Captions label goes stale (deferred).
- 5.6 review: `updateSettings` validates every field — keep it that way for the `persist: false` path too.
- Hunger bleats and munch were **cut** in 5.6 at Rylan's request. Do not reintroduce them; `sfx-bleat` exists and is used for lamb births and now the preview.
- Reviews keep flagging: listener double-subscription after restart, per-frame allocation, literal numbers instead of named `[ASSUMPTION]` constants, stale docs/comments, and hover/cursor glitches when a modal hides a control under the pointer (Button.setVisible / clearHover handle this; copy that care into the widgets).
- Every overlay callback runs inside Phaser's input step: wrap with `guarded` / try → `reportError('ui', …)`, never let a throw escape.

### Git intelligence

- Recent commits: one commit per story ("Implement story 5.6: Audio Pass and Captions") containing code, story file, deferred-work, architecture "as built" and sprint-status, after code review. Same pattern here, on branch `story-5.7`.
- 5.6 touched `settings.ts`, `settingsStore.ts`, `AudioDirector.ts`, `bus.ts`, `Button.ts`, `DebugOverlay.ts`, `HudScene.ts` — this story builds directly on those.

### Open questions (defaults chosen; confirm or change)

1. **Row labels.** Default "Music", "SFX", "Reduced motion", "Captions" (EXPERIENCE IA wording). "SFX" is jargon; "Sounds" or "Effects" may read better for players.
2. **Reduced-motion scope.** The UX spec names only meter shake, banner slide, popups and screen shake. The table extends "Off" to every movement juice item that earlier stories flagged (and their deferred-work entries). Keep-rows to confirm: ineligible-sheep shake, particle bursts, era crossfade, title sheep walks.
3. **Slider steps.** Default continuous (rounded to 0.01). Alternative: 10 % steps.
4. **Volume on the title screen.** Default no (IA: Volume under Pause only). A player can't set volume before the first game; acceptable for now.

### Project Structure Notes

- New: `src/view/overlay/VolumePanel.ts`, `src/view/widgets/Slider.ts`, `src/view/widgets/Toggle.ts`, `src/view/widgets/sliderMath.ts`, `tests/view/widgets/sliderMath.test.ts`.
- Modified: `src/view/settings.ts`, `src/view/strings.ts`, `src/view/scenes/OverlayScene.ts`, `src/view/audio/AudioDirector.ts`, `src/debug/DebugOverlay.ts`, the juice files in the Reduced-motion table (`FloatPopups`, `EraBanner`, `GameScene`, `Button`, `FoodSprite`, `CarcassSprite`, `Decorations`, `PregnancyHeart`, `SheepSprite` (breed markers only), `AlertPing`, `BetterPlace`, `Market`, `FarmBoost`, `BoostTimer`, `MoneyCounter`), possibly `HudScene.ts` for a `settings:changed` hook; docs: architecture, deferred-work, sprint-status.
- Variance: `sliderMath.ts` is a small new pure helper so the value math is testable; record it in the architecture as built.

### Project Context Rules

- Phaser 4 APIs only; check the bundled skills/source before using any call from memory.
- Pausing = GameScene stops accumulating; never `scene.pause()`. The Volume panel is opened from pause, so the sim is already stopped.
- No Phaser timers/tweens change `GameState` (none here do).
- Listener cleanup on SHUTDOWN; restarts must not double-subscribe.
- UI widgets in Overlay may `setInteractive`; gameplay input stays in `InputController`. Ignore shortcuts while a modal is open (already true).
- Audio only through `AudioDirector`; volumes come from settings, never hard-coded; respect the Web Audio unlock.
- No allocation, logging, `JSON.stringify` or `localStorage` in frame code — hence save-on-release.
- Only `src/save/` touches `localStorage`; keys `sheepciv.save.v1`, `sheepciv.settings`, `sheepciv.save.v1.bad` only; game runs with storage unavailable; settings survive Restart (mandatory test, already green).
- Reduced motion: screen shake, bounces and floaty popups respect it; gameplay animation never reduced; infection never colour-only (wobble + marker stay).
- Copy in `strings.ts`, no "!" (except "Last sheep!"); colours from `COLORS`/`COMPONENTS`.
- Desktop, mouse primary, 1280×720 FIT, legible at 960×540.
- Done = `npm test`, `npm run typecheck`, `npm run lint` pass; juice and audio verified manually in the browser.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 5.7: Volume and Accessibility Settings]
- [Source: _bmad-output/planning-artifacts/epics.md — UX-DR15, UX-DR20, UX-DR22, UX-DR44, UX-DR73, UX-DR76, UX-DR84, UX-DR85, UX-DR87–UX-DR90, UX-DR99; AR9]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-sheep-civilization-2026-10-05/EXPERIENCE.md — IA (Volume row, line 41), Component Patterns (Float popup, Menu button / Slider / Toggle, Panel), Game Feel & Juice (reduced motion, line 212), Accessibility Floor (lines 217–229)]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-sheep-civilization-2026-10-05/DESIGN.md — components slider/toggle (front matter ~175–185), Components (Panel, Slider and toggle, ~438–440)]
- [Source: _bmad-output/game-architecture.md — Overlay scene row (~208), Esc priority (~219), Settings (~231, ~247, ~340), directory tree (overlay/VolumePanel, widgets/Slider, Toggle, juice "respects reduced motion")]
- [Source: _bmad-output/project-context.md — Engine rules (Input, Audio, Listener cleanup), Performance, Persistence, UX invariants (reduced motion)]
- [Source: _bmad-output/implementation-artifacts/deferred-work.md — all "Reduced motion (Story 5.7)" entries, "Placeholder panels", "Volume panel (Story 5.7)", "Debug Captions label"]
- [Source: _bmad-output/implementation-artifacts/5-6-audio-pass-and-captions.md — settings store, AudioDirector, review findings]

## Change Log

- 2026-10-09: Story created (create-story).
- 2026-10-09: Implemented (dev-story): VolumePanel, Slider/Toggle widgets, sliderMath (+7 tests), `updateSettings(…, { persist })`, `AudioDirector.previewSfx()`, `reducedMotion()` across the juice per the Reduced-motion table, debug labels follow `settings:changed`, docs. Status → review.
- 2026-10-13: Code review (gds-code-review): 2 decisions, 11 patches applied — Slider ends a drag on blur, a lost release or shutdown and follows only its own pointer; track drop shadow; SFX preview one at a time; alert ping bob always runs (masked per frame); heart stack leaves no gap under reduced motion; VolumePanel follows `settings:changed` while open; linear suction fade; `tests/view/settings.test.ts` (+5); stale comments. 7.2 unticked with the open manual checks; the lift row set to Keep. 2 items deferred. Status → in-progress (manual checks open).
- 2026-10-13: Rylan accepted the story as done without the open manual checks. Status → done.

## Dev Agent Record

### Agent Model Used

Claude Opus 5.5 (1M context) — `claude-opus-5-5[1m]`

### Debug Log References

- Browser checks: throwaway scratchpad Playwright scripts (playwright-core from the npx cache, system Chrome, `--mute-audio`, `AudioBufferSourceNode.start` patched to log sprite offsets) against `vite --port 5179`. Not committed. Headless Chrome runs at ~7 FPS, so animation was compared on frames captured right after each trigger.

### Completion Notes List

- **Volume panel:** `VolumePanel` (480 × 354, centred) with Music/SFX sliders, Reduced motion/Captions toggles and Back; OverlayScene modal id `'volume'`; `closeSubPanel` handles it (Esc chain step 2). Stats and Credits keep the placeholder. The panel re-reads `getSettings()` each time it opens.
- **Widgets:** `Slider` (16 px track, 20 × 40 thumb, one full-length fill image cropped to the value; Zone input ≥ 40 px; drag via scene `POINTER_MOVE` / `POINTER_UP` / `POINTER_UP_OUTSIDE`; hidden mid-drag ends with `onRelease(v, false)`). `Toggle` (64 × 32 pill, 24 px knob, activates on release, pops via `button:activated`). Hover lightens the thumb/knob to `barkSoft`. All looks are baked `boxTexture`s. `sliderMath.ts` (`valueAt`, `thumbX`, 2-decimal rounding, NaN-safe) has 7 tests.
- **Settings:** `updateSettings(patch, { persist })` — `persist: false` applies and emits without writing; sliders use it while dragging and save once on release. `reducedMotion()` helper. `settingsStore.ts` unchanged except its header comment.
- **Audio:** `AudioDirector.previewSfx()` plays `sfx-bleat` (rate 1) forced past the repeat gap and voice cap; still gated by unlock/suspend and silent at SFX 0. Browser check: one bleat on SFX release.
- **Reduced motion (per the Dev Notes table):** Off — float popup rise, era banner slide (fades in place), reveal swell/shake (flash kept), suction spiral and sale hop (fade in place), Button squash, food bounce, carcass flop, decoration pop, pregnancy heart pop/bob, breed candidate pulse and pinned bob, alert ping pop/bob, Better Place ring/suck/gulp, Market pulse/flap/tag growth/nudge, Farm glow pulse (held at full; re-checked when the HUD unfreezes), boost timer pop, money roll. Keep — ineligible shake, infection wobble/marker, gait/wander/poses, particles, era crossfade, lose scrim fade, captions fade, title walks, held-medicine ×1.2, the held sheep's 4 px lift (a static "in hand" pose). No "revisits" comments left.
- **Debug overlay:** Captions and a new Reduced motion button; both labels follow `settings:changed` (page-lifetime listener).
- **Verified in headless Chrome:** panel opens from Pause and shows current values; Music drag stores nothing mid-drag (also while the pointer leaves the panel) and saves on release; SFX click-to-set saves and plays one bleat; both toggles flip and save; Esc mid-drag closes the panel and saves the last value; Esc resumes; reload keeps all four values; panel legible at a 960×540 window; with reduced motion the era banner appears centred (full motion: mid-slide) and the "+1" fades at its spawn line (full motion: risen); zero console errors.
- **Not verified here — Rylan's manual pass needed:** Firefox (not installed); releasing a drag outside the canvas; toggling reduced motion mid-boost and seeing the glow stop on Resume; Restart/Start over keeping settings in the browser (covered by the existing `wipeSave` unit test); blocked storage in the browser (covered by settingsStore unit tests); every Off row other than popups and the banner, by eye; the default sizes (`LABEL_W` 170, panel width 480) by eye.
- **Tests:** `npm test` 878 passed / 1 skipped (66 files); `npm run typecheck` and `npm run lint` clean; `npm run build` succeeds (pre-existing chunk-size warning only).

### File List

- `_bmad-output/game-architecture.md` (modified)
- `_bmad-output/implementation-artifacts/5-7-volume-and-accessibility-settings.md` (new)
- `_bmad-output/implementation-artifacts/deferred-work.md` (modified)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modified)
- `src/debug/DebugOverlay.ts` (modified)
- `src/save/settingsStore.ts` (modified: header comment)
- `src/view/audio/AudioDirector.ts` (modified)
- `src/view/field/AlertPing.ts` (modified)
- `src/view/field/BetterPlace.ts` (modified)
- `src/view/field/CarcassSprite.ts` (modified)
- `src/view/field/Decorations.ts` (modified)
- `src/view/field/EraBackground.ts` (modified: comment)
- `src/view/field/FoodSprite.ts` (modified)
- `src/view/field/Market.ts` (modified)
- `src/view/field/PregnancyHeart.ts` (modified)
- `src/view/field/SheepSprite.ts` (modified)
- `src/view/hud/BoostTimer.ts` (modified)
- `src/view/hud/EraBanner.ts` (modified)
- `src/view/hud/FarmBoost.ts` (modified)
- `src/view/hud/MoneyCounter.ts` (modified)
- `src/view/juice/FloatPopups.ts` (modified)
- `src/view/overlay/PlaceholderPanel.ts` (modified: comment)
- `src/view/overlay/VolumePanel.ts` (new)
- `src/view/scenes/GameScene.ts` (modified)
- `src/view/scenes/OverlayScene.ts` (modified)
- `src/view/settings.ts` (modified)
- `src/view/bus.ts` (modified, code review: comment)
- `src/view/strings.ts` (modified)
- `src/view/widgets/Button.ts` (modified)
- `src/view/widgets/Slider.ts` (new)
- `src/view/widgets/Toggle.ts` (new)
- `src/view/widgets/sliderMath.ts` (new)
- `tests/view/widgets/sliderMath.test.ts` (new)
- `tests/view/settings.test.ts` (new, code review)
