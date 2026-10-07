---
baseline_commit: f449be1
---

# Story 2.8: Sacrifice Food Boost

Status: done

<!-- Created 2026-10-07 by create-story. Builds on 2.7 (Sacrifice command, betterPlace.ts, Sacrificed event, "+2× food" label), 1.6/1.7 (Farm button, Farm progress bar, Farmed event, float popups), 2.6 (bottom-bar layout, threat summary slot) and 1.9/2.2–2.5 (save validate + migrations). -->

## Story

As a player,
I want each sacrifice to double my Farm clicks for 30 seconds,
so that the dark choice has a real payoff.

## Acceptance Criteria

1. **The boost starts on a sacrifice (FR19).** When a `Sacrifice` command removes a sheep, the sim sets `state.boostUntil = state.time + TUNING.boostMs` (30 000 ms). It emits `BoostStarted { until, renewed }` right after `Sacrificed` and before any `Lost`. `renewed` is true when a boost was already active (`state.time < boostUntil` before the change).
2. **Reset, never stack (FR19).** A sacrifice during an active boost sets `boostUntil` to `time + 30 s` again. Both the length and the multiplier stay the same: there is no ×4 and no 60 s.
3. **Double Farm pips (FR19, FR3).** While `state.time < state.boostUntil`, each `Farm` command fills `TUNING.farmPipsPerClick × TUNING.boostPipMultiplier` pips (2 today). Otherwise it fills `farmPipsPerClick` (1). The boost starts at the sacrifice tick and ends at exactly `boostUntil`, which is no longer boosted. Leftover pips carry over and a full bar still drops one piece, as before.
4. **Never the breeding bar (FR8).** `FarmBreeding` always fills `TUNING.breedingPipsPerClick` (1), boosted or not.
5. **The seeded test (epics AC).** After a sacrifice, a Farm click 29 s later fills 2 pips and one 31 s later fills 1. With a second sacrifice at 20 s, a click at 49.9 s still fills 2 pips and a click at 50 s fills 1: the boost ran 50 s in total.
6. **The boosted Farm button (UX-DR27, UX-DR80, DESIGN `button-farm-boosted`).** While a boost is active, the Farm button shows:
   - a pulsing `halo` outer glow (a 3 px `halo` ring plus a stepped soft glow, as in `mockups/hud.html` `.btn-farm.boosted`);
   - a small `void` pill badge, top-right of the button, with a 2 px `halo` border and "×2" in `halo` (mockup `.boost-badge`: 26 px tall, 18 px Pixelify 600, offset top −12, right −10).

   The button's fill, label, key hint, tooltip, squash and press behaviour are unchanged. Both the glow and the badge appear on the frame the boost starts and disappear on the frame it ends.
7. **Double pips are visible (UX-DR29).** The Farm progress bar already redraws on each change. While boosted, each click fills two pips (0/8 → 2/8 → 4/8 …). No change to `FarmProgress` is needed beyond what the sim produces.
8. **The boost timer (UX-DR38, DESIGN `boost-timer`).** While a boost is active, a `boost-timer` pill shows in the bottom bar, right of the threat summary: a `void` pill (`rounded.full`, 40 px tall, 12 px side padding) with "×2 0:{ss}" in `numeric` type and `halo` colour.
   - It counts down in whole seconds, rounded **up**: it shows "×2 0:30" at the start and "×2 0:01" in the last second, then hides at 0.
   - Every `BoostStarted` (first start and reset) gives it a short scale pop. A reset jumps it back to 0:30.
   - Its text changes only when the shown second changes, with no per-frame allocation.
   - It is hidden in a new game, after a restart and whenever no boost is active.
9. **Sacrifice juice (UX-DR44, UX-DR80).** On `BoostStarted`, a "×2" float popup rises over the Farm button, like the "+1" popups. The 2.7 suction, sparkle and toast are unchanged.
10. **Game time, not real time.** The boost is an absolute game-ms deadline (project-context Timers). It freezes while the game is paused, the tab is hidden or the game is lost, and it survives a save and reload exactly: a reload at 0:12 left resumes at 0:12 left, still boosted.
11. **Save (AR9, NFR7).**
    - `GameState` gains `boostUntil: number` (game-ms; 0 = no boost ever). `createNewGame` sets it to 0.
    - `SAVE_SCHEMA_VERSION` 5 → 6, with a migration step `5: (s) => ({ ...s, boostUntil: 0 })`.
    - `validateState` requires an integer in `[0, time + TUNING.boostMs]`.
    - The round-trip, corrupt-save and migration tests pass, and `busyGame` holds an active boost.
12. **Secrecy (AR18).** Nothing new reads `isAbomination`, and nothing branches on `wasAbomination`: every sacrifice boosts the same (GDD: the Abomination reveal has "no payout beyond the normal boost").
13. `npm test`, `npm run typecheck` and `npm run lint` all pass. Browser checks (Task 7) pass with no console errors.

## Tasks / Subtasks

- [x] **Task 1: Tuning, state and selectors (AC: 1–5, 11)**
  - [x] 1.1 `src/config/tuning.ts`: add, next to the Farm values:
    - `boostMs: 30_000` (FR19 / GDD Better Place: "for 30 s");
    - `boostPipMultiplier: 2` (FR19: "doubles the pips each Farm click fills").

    Update the `farmPipsPerFood` comment ("the boost (2.8) doubles them" → it does, through `farmPipsPerClick(state)`).
  - [x] 1.2 `src/sim/state.ts`: add `boostUntil: number` to `GameState`, with a doc comment: "Game-ms deadline of the sacrifice food boost (FR19); 0 = never boosted. Boosted is derived: `time < boostUntil`." Put it after `breedingPieces`/`pregnancies` or near `farmProgress`. `createNewGame` sets `boostUntil: 0`.
  - [x] 1.3 `src/sim/selectors.ts`:
    - `isBoosted(state): boolean` → `state.time < state.boostUntil`.
    - `boostRemainingMs(state): number` → `Math.max(0, state.boostUntil - state.time)`.
    - `farmPipsPerClick(state): number` → `TUNING.farmPipsPerClick * (isBoosted(state) ? TUNING.boostPipMultiplier : 1)`. Doc: "Better Hoe (4.7) raises the base here; the boost doubles whatever the base is."
    - `HudView` gains `boostRemainingMs: number` (0 when none). `selectHudView` fills it. Update the "Later stories add … boost" comment.
- [x] **Task 2: The boost rule (AC: 1–5, 12)**
  - [x] 2.1 `src/sim/systems/betterPlace.ts` `sacrifice`, after the existing `Sacrificed` emit and **before** `removeSheep` (so `Lost` stays last):

    ```ts
    const renewed = state.time < state.boostUntil;
    state.boostUntil = state.time + TUNING.boostMs;
    emit({ type: 'BoostStarted', until: state.boostUntil, renewed });
    ```

    Update the file header: "Story 2.8 starts the food boost here" becomes a statement of fact. A missing id still returns before any of this (no boost for a sacrifice that did not happen). No rng and no id.
  - [x] 2.2 `src/sim/commands.ts` `farm()`: replace `state.farmProgress += TUNING.farmPipsPerClick` with `state.farmProgress += farmPipsPerClick(state)`. Update its doc comment. `farmBreeding()` is unchanged; keep and reword its "Never boosted (2.8)" comment to describe the rule.
  - [x] 2.3 `src/sim/events.ts`: add `| { type: 'BoostStarted'; until: number; renewed: boolean }` with a comment: "emitted by a sacrifice (FR19) after `Sacrificed`; `renewed` is a reset of an active boost (the HUD pops the timer)". Add it to the header's variant list.
    - **No `BoostEnded` event** (the architecture lists one): the end of a boost is derived (`time >= boostUntil`) and the HUD reads it every frame. Emitting it would need a per-tick system and a flag for no consumer. Note this in the events comment, so 5.6 (audio) can add a system if it wants an end cue.
- [x] **Task 3: Save (AC: 10, 11)**
  - [x] 3.1 `src/config/constants.ts`: `SAVE_SCHEMA_VERSION = 6`.
  - [x] 3.2 `src/save/migrations.ts`: add `5: (s) => ({ ...s, boostUntil: 0 })`, with the comment "Story 2.8: no boost was running in a version-5 save."
  - [x] 3.3 `src/save/validate.ts` `check`, near the bars: `int(s, 'boostUntil', 'state', 0, time + TUNING.boostMs)` (a sacrifice sets it at most `boostMs` ahead; 0 = never). A past deadline is valid: it is simply not boosted.
  - [x] 3.4 Nothing in `saveFile.ts` changes: `encodeSave`/`savable` copy the whole state.
- [x] **Task 4: The boosted Farm button (AC: 6, 7)**
  - [x] 4.1 New `src/view/hud/FarmBoost.ts`, a plain class like `FarmProgress`, built once by `BottomBar` around the Farm button's box (`x`, `y`, `width`, `height` are public on `Button`):
    - **Glow:** one `Image` from a texture baked once (cached in the TextureManager like `boxTexture`; key e.g. `farm-boost-glow-{w}x{h}`). It is a `make.graphics` → `generateTexture` of stepped `halo` rounded rects, outermost first: about 10 px out at alpha .2, 6 px out at .45, then the 3 px ring at 1 (mockup `0 0 0 3px halo, 0 0 16px 4px halo`). Pixel steps, no smooth gradient (the `better-place-glow` precedent). Created **before** the Farm button so it draws under it (same depth, display-list order), or at an explicit lower depth.
    - **Badge:** a `void` pill with a 2 px `halo` border, built via `boxTexture(scene, w, 26, { fill: 'void', border: 'halo', radius: RADIUS.full-capped (13), drop: false })`, plus a `Text` "×2" in `numeric` at 18 px (`textStyle('numeric', 'halo', 18)`; Button's key hint uses the same override). Placed at the button's top-right: right edge = button right + 10, top = button top − 12. Created **after** the Farm button so it draws above it.
    - `setBoosted(on: boolean)`: a no-op unless it changes. On: show both and start one looping alpha tween on the glow (about 1 → 0.55, 600 ms, yoyo, `Sine.easeInOut`, `repeat: -1`). Off: kill the tween and hide both. Put the motion constants in one `BOOST_MOTION` object (5.7 reduced motion).
    - Colours from `COMPONENTS.buttonFarmBoosted` (`glowColor`, `badgeColor`, `badgeTextColor`), never hex literals.
  - [x] 4.2 `src/view/hud/BottomBar.ts`: build `readonly farmBoost: FarmBoost` around the Farm button, and update the class comment (2.8: the boost glow and badge, the boost timer).
  - [x] 4.3 The Farm button's squash scales only the button's container; the glow and badge stay put. This is accepted (it is a 80 ms squash). Do not move them into `Button`.
- [x] **Task 5: The boost timer (AC: 8, 9)**
  - [x] 5.1 New `src/view/hud/BoostTimer.ts`:
    - A fixed-width `void` pill: `boxTexture(scene, BOOST_TIMER_W, 40, { fill: 'void', border: 'void', radius: 20, drop: false })`. Pills are read-outs, not buttons: no drop and no outline colour change (UX-DR9). Use `COMPONENTS.boostTimer` (`backgroundColor`, `textColor`, `typography`).
    - A `Text` in `numeric`/`halo`, centred. Size `BOOST_TIMER_W` to fit "×2 0:30" with 12 px padding each side (measure it in the browser; about 104 px). The width is fixed, so the pill never resizes.
    - Both live in one `Container` anchored at the pill's centre, so `pop()` scales from the middle.
    - `set(remainingMs)`: hidden at `remainingMs <= 0`. Otherwise `secs = Math.ceil(remainingMs / 1000)`, and only when `secs` differs from the shown value: `setText(STRINGS.boostTimer(formatGameTime(secs * 1000)))`. Use `formatGameTime` (architecture Formats), not a hand-built string.
    - `pop()`: `killTweensOf`, scale 1 → about 1.2 → 1, about 160 ms, yoyo (`BOOST_TIMER_MOTION`; 5.7).
  - [x] 5.2 `BottomBar`: place it at `x = THREAT_MAX_RIGHT + GROUP_GAP` (1092), vertically centred in the bar (`BAR_TOP + hudBarHeight / 2`), and assert with `invariant` that its right edge is at most `canvasWidth − safeMargin − SHOP_RESERVE`. Use `SHOP_RESERVE` = the space left for 3.2's Shop toggle (the mockup's `.shop-toggle` is about 80 px). If they do not fit, shrink the timer's padding; do not overlap. Update the layout comment that names "boost timer (2.8)".
  - [x] 5.3 `src/view/strings.ts`:
    - `boostTimer: (time: string): string => \`×2 ${time}\`` (UX-DR38, e.g. "×2 0:18");
    - `boostBadge: '×2'` (UX-DR27);
    - `boostPopup: '×2'` (UX-DR44).

    Update the `betterPlaceLabel` comment ("the boost is Story 2.8's" → the boost it promises is FR19). No "!".
  - [x] 5.4 `src/view/scenes/HudScene.ts`:
    - Add `boostRemainingMs: 0` to the `view` initialiser.
    - In `refresh`: `this.bar.farmBoost.setBoosted(v.boostRemainingMs > 0)` and `this.bar.boostTimer.set(v.boostRemainingMs)`. Both are no-ops without a change, so a frame with no change does nothing.
    - In `onSim`, on `BoostStarted`: `this.bar.boostTimer.pop()` and `this.popups.spawn(farm.x + farm.width / 2, farm.y - POPUP_LIFT_PX, STRINGS.boostPopup)`. Same frame as the 2.7 toast. Never read `wasAbomination`.
    - Because `refresh` runs on PRE_RENDER after the tick, the timer and glow show on the frame the sacrifice applies. `pop()` comes from `onSim` (inside the tick), before that frame's `set`. That is fine: `set` changes only text and visibility, and the pop tween owns the scale.
- [x] **Task 6: Tests (AC: 1–5, 10–12).** Vitest covers sim and save only. Write each test red first, with `TUNING` values (never a literal 30 000 or 2) and literal seeds.
  - [x] 6.1 `tests/sim/systems/betterPlace.test.ts`:
    - A sacrifice sets `boostUntil = time + TUNING.boostMs` and emits exactly `[Sacrificed, BoostStarted { until, renewed: false }]`.
    - A second sacrifice 20 s later (via `runFor`) emits `renewed: true` and moves `boostUntil` to the new `time + boostMs`, not `+ 2 × boostMs`.
    - After the boost ends, the next sacrifice is `renewed: false`.
    - Sacrificing the last sheep emits `Sacrificed`, `BoostStarted`, then `Lost`, in that order.
    - An unknown id: no boost, no event, `boostUntil` unchanged.
  - [x] 6.2 `tests/sim/commands.test.ts`, a new `describe('Farm while boosted (FR19)')`:
    - Boosted: one click fills `farmPipsPerClick × boostPipMultiplier`. Four clicks complete a bar: one `FoodDropped`, `Farmed added 1`, and `farmProgress` 0.
    - Not boosted (`boostUntil` in the past, or 0): one pip.
    - Exactly at `time === boostUntil`: one pip (the end is exclusive).
    - The carry-over: progress 7 + 2 → 1 piece and progress 1.
    - `FarmBreeding` while boosted still fills `breedingPipsPerClick`.
    - The corrupt-bar guard still works while boosted (bad bar → 0, then `+ 2`).
  - [x] 6.3 New scenario `tests/sim/scenarios/boost.test.ts` (the epics test, AC 5). Use `newGame(seed)` + `fillFlock` so no sheep starves in 60 s (or feed them through `TUNING.fullnessMax`). Sacrifice by `applyCommand(state, { type: 'Sacrifice', id })` and step through `runFor`, so the boost runs on game time:
    - **One sacrifice:** `runFor(29_000)` → a click fills 2; reset the bar; then `runFor(2_000)` (31 s) → a click fills 1.
    - **Reset:** sacrifice at 0, `runFor(20_000)`, sacrifice again, then at 49.9 s a click fills 2 and at 50 s a click fills 1. Use `TICK_MS` multiples (`runFor` throws otherwise).
    - **Lost game:** sacrifice the last sheep: `boostUntil` set, the game lost, and `applyCommand` Farm does nothing.
  - [x] 6.4 `tests/sim/selectors.test.ts`: `isBoosted`, `boostRemainingMs` (0 when never boosted or expired, exact while active) and `selectHudView(...).boostRemainingMs`.
  - [x] 6.5 `tests/sim/state.test.ts`: a new game has `boostUntil === 0`.
  - [x] 6.6 Save:
    - `migrations.test.ts`: "migrates a version-5 state (before the boost) with `boostUntil: 0`"; and the chain from version 2 reaches version 6 with every field.
    - `saveFile.test.ts`: the decode tests for versions 2/3 (and any for 4/5) now also expect `boostUntil: 0`.
    - `validate.test.ts`: rejects a missing, non-integer, negative or `> time + boostMs` `boostUntil`; accepts 0 and a past deadline.
    - `tests/save/busy.ts`: set `state.boostUntil = state.time + TUNING.boostMs` before the final `runFor(1_000)` (directly; a Sacrifice would change the flock that other assertions rely on), and add `state.time < state.boostUntil` to `isBusy`. Update both doc comments.
    - The round trip of `busyGame` still passes (it now covers an active boost across a reload, AC 10).
  - [x] 6.7 Existing seeded tests must not change their expected values: none of them sacrifices and then farms. If one changes, the code changed behaviour by mistake.
  - [x] 6.8 `npm test`, `npm run typecheck` and `npm run lint` (record the baseline count first: 458 after 2.7's review).
- [x] **Task 7: Browser check (AC: 6–10, 13).** Use the scratchpad Playwright probe from 2.7 (see Previous Story Intelligence for the setup). Check:
  - [x] 7.1 **New game:** no glow, no badge, no timer.
  - [x] 7.2 **Sacrifice:** drag a sheep into the hole. On that frame the Farm button gets the pulsing gold glow and the "×2" badge, a "×2" popup rises over it, and the timer reads "×2 0:30" and pops. The 2.7 suction, sparkle and toast still play.
  - [x] 7.3 **Double pips:** click Farm and press `F`: each fills two pips (2/8, 4/8 …), and four clicks drop one food piece with "+1". Farm Breeding Food (`G`) still fills one heart pip.
  - [x] 7.4 **Countdown:** the timer ticks down once per second. Debug ×16 speed speeds it up (it is game time). It shows 0:01, then the glow, badge and timer all vanish on the same frame, and the next click fills one pip.
  - [x] 7.5 **Reset:** sacrifice again mid-boost: the timer jumps to 0:30 with a pop, and the badge still reads ×2 (no ×4).
  - [x] 7.6 **Pause / hide:** under the pause menu and a hidden tab the timer stops (game time); on resume it continues from the same second.
  - [x] 7.7 **Save:** mid-boost, hide the tab (forced save), reload, then Continue: still boosted, at the same remaining time (±1 s). Dump state shows `boostUntil`.
  - [x] 7.8 **Layout:** at 1280×720 and 960×540, the timer pill sits right of the threat summary with no overlap, inside the safe margin, and leaves room at the right for the 3.2 Shop toggle. The badge does not clip at the top of the bar or overlap the Farm Breeding Food button. The glow does not cover the Farm progress bar's count.
  - [x] 7.9 **Restart / lose:** sacrifice the last sheep: the lose screen. Restart: no glow, badge or timer.
  - [x] 7.10 **Performance:** about 100 sheep at ×1 with a boost active, against the 2.7 baseline (39 FPS idle in SwiftShader). There is one looping glow tween. `refresh` allocates nothing per frame while the shown second does not change.
  - [x] 7.11 No console errors or warnings beyond SwiftShader's GL notices.
- [x] **Task 8: Debug and bookkeeping**
  - [x] 8.1 Optional, DEV only: a `Boost` button in `DebugOverlay` row 2 that runs `debugMutate((s) => { s.boostUntil = s.time + TUNING.boostMs; })`, for checking the HUD without a sacrifice (no event, so no pop). Also add `boost {remaining}` to the readout's food line. Not required by any AC.
  - [x] 8.2 `deferred-work.md`:
    - Under the 2.6 "crowded bottom bar" note, record where the timer landed (x range) and what is left for 3.2's Shop toggle.
    - Add a 2.8 section:
      - **5.6:** a boost start cue (and an end cue, which would need a `BoostEnded` from a new system; see Task 2.3);
      - **5.7:** reduced motion for the glow pulse (`BOOST_MOTION`), the timer pop and the "×2" popup. The glow, badge and timer themselves are information and stay;
      - **4.7:** Better Hoe raises the base in `farmPipsPerClick(state)`, and the boost doubles it (2 → 4, 3 → 6);
      - **5.4:** the stats panel may want "boosts" or not (not in FR36; leave it out).
  - [x] 8.3 Architecture: update only if Rylan asks. Two one-line notes are worth offering: `BoostEnded` is not emitted (derived), and `BoostStarted` carries `{ until, renewed }`.

### Review Findings

- [x] [Review][Patch] A last-sheep sacrifice (or debug Boost after a loss) leaves the boost frozen behind the lose screen, and in the lost save: the glow pulses, the badge shows and the timer sticks at 0:30. `isBoosted` and `boostRemainingMs` should be false/0 once `lostAt` is set. [src/sim/selectors.ts:isBoosted]
- [x] [Review][Patch] The Farm glow keeps pulsing under the pause menu and other modals while the boost is frozen; pause the glow tween while a modal is open. [src/view/hud/FarmBoost.ts:setBoosted]
- [x] [Review][Patch] Task 8.2 is marked [x] but the 5.4 (stats panel) bullet is missing from deferred-work.md's 2.8 section. [_bmad-output/implementation-artifacts/deferred-work.md]
- [x] [Review][Patch] The "completes a bar" test divides farmPipsPerFood by the boosted click value; it only holds while that divides evenly. Use `Math.ceil` and assert the leftover. [tests/sim/commands.test.ts:Farm while boosted]
- [x] [Review][Defer] Save validation bounds `boostUntil` by the live `TUNING.boostMs`, so lowering it later rejects saves made mid-boost (as `cooldownUntil` already does with `breedCooldownMs`). [src/save/validate.ts:82] — deferred: the same pattern is already used for cooldownUntil; Story 3.6 (the tuning pass) should clamp both, or validate both against a fixed ceiling
- [x] [Review][Defer] `SHOP_RESERVE` is 64 px, not the mockup's ~80 px Shop toggle, instead of shrinking the timer's padding as Task 5.2 said. [src/view/hud/BottomBar.ts:SHOP_RESERVE] — deferred: 3.2 re-spaces the bar when it adds the toggle (already noted in deferred-work.md)

## Dev Notes

### Current code to build on (read these first)

- **`src/sim/systems/betterPlace.ts`:** `sacrifice(state, id)` checks `sheepIndex`, emits `Sacrificed { id, wasAbomination: false }`, then calls `removeSheep(state, id, 'sacrificed')`. Its header already says "Story 2.8 starts the food boost here (boostUntil)". The boost goes between the emit and `removeSheep`, so the order is `Sacrificed` → `BoostStarted` → `Lost`.
- **`src/sim/commands.ts` `farm()`:**
  - A corrupt-bar guard (`!(Number.isInteger(p) && p >= 0 && p < farmPipsPerFood)` → 0);
  - then `+= TUNING.farmPipsPerClick`;
  - then a `while` loop that drops one piece per full bar, then `Farmed { resource: 'food', added }`.

  Only the `+=` line changes. `farmBreeding()` mirrors it and must keep `TUNING.breedingPipsPerClick`. `commands.ts` already imports from `selectors.ts` (`innerFence`), so importing `farmPipsPerClick` is fine.
- **`src/sim/selectors.ts`:**
  - `HudView` and `selectHudView(state, out)` fill a reusable object in place; add `boostRemainingMs` the same way, with no allocation.
  - The comment "Later stories add money, flock, capacity and boost" names this story.
  - `breedBlock` is the model for a small derived selector.
- **`src/view/scenes/HudScene.ts`:**
  - `refresh` runs on `PRE_RENDER` (after the tick), so a change shows on the frame it happens.
  - `onSim` runs inside the tick: `Farmed` → "+N" popups via `this.popups.spawn(b.x + b.width / 2, b.y - POPUP_LIFT_PX, …)`, and `Sacrificed` → the toast.
  - `farm()` handles both the click and `F` and dispatches `{ type: 'Farm' }`. Nothing in it changes: the sim decides the pips.
  - Every listener is removed on SHUTDOWN. This story adds none: it reuses `bus.on('sim')` and PRE_RENDER.
- **`src/view/hud/BottomBar.ts`:**
  - It builds the Farm button (`FARM_X` 16, `FARM_Y` = bar top + 6, `FARM_W` 232, height 64) and the `FarmProgress` under it, then the breeding group, Breed, and the threat summary at `THREAT_X` 858.
  - `THREAT_MAX_RIGHT` = 1 080 leaves the right end "so the boost timer and the Shop toggle fit".
  - The layout comment names "boost timer (2.8)".
- **`src/view/hud/FarmProgress.ts`:** the model for a plain HUD widget class: build once with baked textures, then `set()` does work only on a change.
- **`src/view/widgets/box.ts`:**
  - `boxTexture(scene, w, h, { fill, border, radius, drop })` bakes and caches by key. A live `Graphics` is banned for anything on screen (measured cost; see its doc).
  - `textStyle(typography, color, sizeOverride?)`.
  - `DROP_PX`, `OUTLINE_PX`.
- **`src/view/widgets/Button.ts`:**
  - Public `x`, `y`, `width`, `height`.
  - The visuals sit in a container anchored at the bottom centre; `squash()` tweens it.
  - Hit zones are separate. Do not add boost logic to `Button`: it is generic (menu buttons use it).
- **`src/view/juice/FloatPopups.ts`:** a pooled `spawn(x, y, text)`. "×2" is one of UX-DR44's listed popups.
- **`src/core/format.ts` `formatGameTime(ms)`:** floors to whole seconds. Pass `Math.ceil(ms / 1000) * 1000` so the timer reads 0:30 at the start and never shows 0:00 while active.
- **`src/config/constants.ts`:**
  - `COMPONENTS.buttonFarmBoosted` (`backgroundColor: 'hay'`, `glowColor: 'halo'`, `badgeColor: 'void'`, `badgeTextColor: 'halo'`) and `COMPONENTS.boostTimer` (`backgroundColor: 'void'`, `textColor: 'halo'`, `typography: 'numeric'`, `rounded: 'full'`) already exist. Use them.
  - `RADIUS.full` is 9999. No pill is built yet (the era badge is 3.5), so pass `h / 2` as the `boxTexture` radius. This story sets the pill precedent.
- **`src/save/validate.ts`, `migrations.ts`:** 2.5's version-4 step and 2.3's version-3 step are the models. Each story that adds a field adds its migration, validation and tests together.
- **`tests/save/busy.ts`:** the "every saved field in use" fixture. Extend it and `isBusy`.

### The boost rule (exact semantics)

- **Window:** `[sacrificeTime, sacrificeTime + boostMs)`. A sacrifice command applies at the start of tick N (at `state.time = T`, before `step` advances time), so `boostUntil = T + 30 000`. A Farm applied at `state.time = T + 29 000` is boosted, and one at `T + 30 000` is not.
- **Reset:** `boostUntil = now + boostMs`. It is never `max(boostUntil, …)` and never `+=`. After a reset at 20 s, the boost ends at 50 s (the epics AC).
- **Multiplier on the click value:** `pips = TUNING.farmPipsPerClick × 2`. Better Hoe (4.7) will change the base: 2 → 4, 3 → 6 (GDD Progression: "the boost doubles the pips per click").
- **No food stock and no cap**, so the boost is never wasted (GDD). Nothing else changes: pieces still drop at seeded-random spots one per full bar, `Farmed.added` counts pieces, and the "+1" popup is per bar.
- **Every sacrifice boosts:** the Abomination (4.4) and innocents alike. Never read `isAbomination` for it.
- **A lost game:** the last-sheep sacrifice still sets `boostUntil` (simplest; harmless). The sim stops, so it never matters, and Restart builds a new state with 0.

### Save shape

- **Version 6 adds one required field.** It is required (0 = never), like `cooldownUntil`, rather than optional like `infectedAt`: it is a deadline, compared every Farm click, and an always-present number keeps `time < boostUntil` total.
- **Validation upper bound** `time + boostMs`: a sacrifice can set it at most that far ahead. A larger value is a corrupt save, which would otherwise give a boost lasting hours.
- **Migration chain:** a version-2 save now runs 2 → 3 → 4 → 5 → 6. Check that the existing decode tests that build old saves end with `boostUntil: 0`.

### Layout numbers (bottom bar, canvas px)

- Bar top 608, height 112, centre y 664.
- Threat summary: 858–1 080. Timer: from 1 092 (one `GROUP_GAP`), about 104 wide → about 1 196.
- That leaves about 68 px to the 1 264 safe edge for 3.2's Shop toggle (mockup about 80 px). This is tight, and the 2.6 deferral already says to re-space rather than overlap.
- Do the simple thing now: place the timer at 1 092, assert it fits, and record the numbers in `deferred-work.md` for 3.2. Do **not** re-space the rest of the bar in this story.
- **Badge:** the Farm button spans x 16–248 and y 614–678, so the badge sits at about x 210–258 and y 602–628. It pokes 6 px above the bar's top rule (608) into the field. That matches the mockup (top −12) and the HUD scene draws above the field. The Farm Breeding Food button starts at x 260 (16 + max(232, `FARM_PROGRESS_W` 176) + 12), so a badge ending at 258 clears it by only 2 px, and the glow (about 10 px out) reaches over it. Draw the breeding button above the glow (create order), and pull the badge's right offset in if the browser shows them touching.
- **Glow:** it extends about 10 px around the button and stays under the Farm progress bar's track (meter at y 682+). If it overlaps the meter, either draw the meter above the glow (create order) or trim the bottom band. The meter must stay readable.

### What must be preserved

- **The Farm command path:** the corrupt-bar guard, the bar loop, `FoodDropped` before `Farmed`, seeded spots, the `Farmed.added` semantics, and the breeding bar untouched.
- **2.7 sacrifice behaviour:** `Sacrificed` first, `removeSheep` last (so `Lost` is last); an unknown id silent; no rng and no `nextId`. Three existing `betterPlace.test.ts` expectations **change**, and these are the only intended edits to existing sim tests. Update them rather than add parallel tests:
  - line 31: "emits only Sacrificed" becomes `[Sacrificed, BoostStarted]`;
  - line 44: the last sheep gives `Sacrificed, BoostStarted, Lost`;
  - line 69: the three-sacrifice type list interleaves `BoostStarted`.
- **HUD:** `refresh` stays allocation-free on unchanged frames, and the tooltip list is unchanged (the timer and badge have no tooltip; UX-DR38 gives none). The drag-time `input.enabled` toggle is unaffected (nothing here is interactive).
- **Determinism:** the boost draws no rng. Existing seeded scenario expectations do not move.
- **Save:** the corrupt-save tests, the "newer version is rejected" test (now version 7) and the 2.7 `dragged` → `wander` mapping.

### Architecture compliance

- **Location:** "Better Place | `src/sim/systems/betterPlace.ts` | Sacrifice, boost, reveal event" (System Location Mapping). Farm pips stay in `commands.ts`, which owns Farm.
- **Timers:** "All timers are absolute deadlines (`… boostUntil …`)" (Game Time); the naming `…Until` follows the convention.
- **Events:** `BoostStarted` is in the architecture's event list. `BoostEnded` is deliberately not emitted (Task 2.3); offer the note in 8.3.
- **HUD read path:** `hudView(state)` → "`boostRemaining`" (Data Patterns example). This story names it `boostRemainingMs` to make the unit explicit.
- **View tree:** "hud/ … BoostTimer" (Project Structure). `FarmBoost.ts` sits beside it.
- **Commands in, events out;** the view never writes `boostUntil` (the debug overlay's `debugMutate` is the sanctioned DEV exception).

### Library / framework notes (Phaser 4.2.1 installed; no new dependencies)

- Everything used here is already in the codebase:
  - `scene.make.graphics({}, false)` + `generateTexture` (in `boxTexture`);
  - `tweens.add` with `yoyo`/`repeat: -1` and `killTweensOf`;
  - `Container` (`Button`);
  - `Text` with `textStyle`.
- No web research was needed: there are no library or version changes.
- Do not write Phaser 3 APIs from memory (`preFX.addGlow`, `postFX`, `setTintFill`, `BitmapMask`). The glow is a baked texture, not an FX pipeline. Phaser 4 replaced FX with filters, and the project avoids them for the 100-sheep FPS budget.

### Testing standards

- Vitest covers `src/sim/` and `src/save/` only, in `tests/<same path as src>/`.
- Helpers: `newGame(seed)`, `runFor` (multiples of `TICK_MS`), `fillFlock`, `innerFence` (`tests/sim/helpers.ts`); `busyGame`/`isBusy` (`tests/save/busy.ts`).
- No fake timers, no Phaser, no mocking. Use `structuredClone` with `toStrictEqual` for "nothing changed", and `drainEvents` to read events.
- The view (glow, badge, timer, pop, popup, layout) is browser-checked in Task 7.

### Previous story intelligence (2.7)

- **Review lessons that apply here:**
  - No per-frame allocation: 2.7's review caught a frame-name string built every step. The timer's `setText` must run only when the shown second changes.
  - Tests must use `TUNING` values, not literals: 2.7's review flagged literal hunger numbers.
  - Every browser check needs recorded evidence: 2.7's review flagged checks marked [x] without evidence.
- **The secrecy pattern:** `wasAbomination` is untouched in the view; 4.4 owns it.
- **HUD layering:** HudScene draws above GameScene, so the badge poking above the bar draws over the field. Pings live in GameScene's world-overlay band, so a ping near the bottom of the pen may sit under the badge. That is acceptable: the badge is small, and the pen sits above the bar (2.7's camera).
- **Browser probe setup:**
  - `playwright-core` from `/home/rylanevans/nr-csp/frontend/node_modules` with `/usr/bin/google-chrome` (SwiftShader).
  - Run the DEV server on its own port (5200 worked), and stop it with `kill <vite node pid>`, never `pkill -f`.
  - Plant saves through debug Load save (clipboard permissions granted), and read state with Dump state.
  - For drags, move the mouse in steps, waiting a frame between them.
- **Baseline FPS** (SwiftShader, 102 sheep, ×1, overlay open): 39 idle and 35 while dragging (2.7).
- **Commit style:** `Implement story 2.8: Sacrifice Food Boost`.

### Git intelligence

- Recent commits: `f449be1` (2.7 review fixes), `b871bde` (2.7), `7cccafd` (2.6), `d1289e6` (2.5), `1132910` (2.4 review).
- The per-story pattern: a sim rule plus unit and scenario tests; a save bump with a migration and validation when the state shape changes (2.2, 2.3, 2.5 did this); view widgets; `deferred-work.md` notes; and a Dev Agent Record with browser-probe results and FPS.
- 2.7 touched `betterPlace.ts`, `HudScene.ts` and `strings.ts`, the same files as here. Read their current versions, not the story text.

### Out of scope

- **3.2:** the Shop toggle and any re-spacing of the bar. **4.7:** Better Hoe; this story only makes the base pluggable through `farmPipsPerClick(state)`.
- **4.4:** the reveal flash and caption. **5.6:** boost SFX and captions. **5.7:** reduced motion (constants are grouped for it).
- **5.4:** the stats panel. A boost count is not in FR36.
- A boost on the breeding bar (FR8 forbids it); stacking; a `BoostEnded` event.

### Open questions (defaults chosen; confirm or change)

1. **`BoostEnded`.**
   - **Default:** not emitted; the end is derived each frame from `boostRemainingMs`.
   - **Alternative:** a tiny `updateBoost` system that emits `BoostEnded` once when `time` reaches `boostUntil`. It needs a "was boosted" flag or a reset of `boostUntil` to 0, and has no consumer until 5.6.
2. **"×2" popup on the sacrifice.**
   - **Default:** yes. UX-DR44 lists "×2" among the popups, and it explains the glow at the moment it appears.
   - **Alternative:** the glow, badge and timer only.
3. **Timer rounding.**
   - **Default:** round up, so it shows 0:30 → 0:01 and then hides.
   - **Alternative:** round down, so it shows 0:29 at the start (it reads as a lost second).
4. **The squash leaves the glow and badge behind** for 80 ms.
   - **Default:** accepted.
   - **Alternative:** give `Button` an "attachments" hook so they squash with it. This is more code in a generic widget.
5. **Timer position.**
   - **Default:** directly right of the threat summary (the mockup order). The Shop toggle (3.2) takes what is left, and 3.2 re-spaces the bar if needed.

### Project Structure Notes

- New files:
  - `src/view/hud/BoostTimer.ts` (named in the architecture tree)
  - `src/view/hud/FarmBoost.ts`
  - `tests/sim/scenarios/boost.test.ts`
- Modified:
  - `src/config/{tuning,constants}.ts` (constants: the schema version only)
  - `src/sim/{state,selectors,commands,events}.ts`
  - `src/sim/systems/betterPlace.ts`
  - `src/save/{migrations,validate}.ts`
  - `src/view/hud/BottomBar.ts`
  - `src/view/scenes/HudScene.ts`
  - `src/view/strings.ts`
  - `src/debug/DebugOverlay.ts` (optional, 8.1)
  - tests: `tests/sim/{commands,selectors,state}.test.ts`, `tests/sim/systems/betterPlace.test.ts`, `tests/save/{migrations,saveFile,validate}.test.ts`, `tests/save/busy.ts`
  - `_bmad-output/implementation-artifacts/deferred-work.md`
- No art and no atlas rebuild: the glow and the pills are baked from `COLORS` at runtime, like every other HUD box.
- No conflicts with the unified structure.

### Project Context Rules (from `_bmad-output/project-context.md`)

- **Boost:** "a sacrifice sets `boostUntil = time + 30 s` (reset, not stacked) and doubles **Farm (food) pips only**, never the breeding bar."
- **Timers** are absolute game-ms deadlines in state. Never use a countdown field decremented per tick, and never `setTimeout` or Phaser timers for game rules. The HUD countdown is derived from `boostUntil − time`.
- **The sim is pure:** no Phaser, DOM, `Date.now()` or `Math.random()` in `src/sim/`. Rules live only in `src/sim/`. The view reads selectors and dispatches commands.
- **TUNING** holds every number (`boostMs`, `boostPipMultiplier`); **COLORS/COMPONENTS** hold every colour; copy lives in `strings.ts` (no "!" except "Last sheep!").
- **The Abomination is secret:** the view never reads `isAbomination` and does not branch on `wasAbomination` before 4.4.
- **No allocation in hot paths;** bake textures once; never `new` or `destroy` during play; HUD widgets update only on change.
- **Save:** a shape change requires a `SAVE_SCHEMA_VERSION` bump, a migration and validation in the same story, and the round-trip and corrupt-save tests stay green. Storage access stays in `src/save/`.
- **Done:** `npm test`, `npm run typecheck` and `npm run lint` pass, plus the browser checks and the 100-sheep performance spot check.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.8; FR3, FR8, FR19; AR3, AR9, AR13, AR18; UX-DR2, UX-DR9, UX-DR25, UX-DR27, UX-DR29, UX-DR38, UX-DR44, UX-DR80]
- [Source: _bmad-output/planning-artifacts/gdds/gdd-sheep-civilization-2026-10-05/gdd.md#The Better Place (Sacrifice); Controls; Progression (click value); Feedback (gold glow while boosted)]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-sheep-civilization-2026-10-05/DESIGN.md: components `button-farm-boosted`, `boost-timer`; Colors (`halo` for boost, `void` for the pill); Layout (bar order: … threat summary · boost timer · Shop); Shapes (pills for read-outs)]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-sheep-civilization-2026-10-05/EXPERIENCE.md: Component Patterns (Farm button boosted, Boost timer: appears on a sacrifice, resets to 0:30 with a pop, disappears at 0); State Patterns (Boost active); Game Feel (Sacrifice: Farm button gold glow)]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-sheep-civilization-2026-10-05/mockups/hud.html: `.btn-farm.boosted`, `.boost-badge`, `.boost-timer`]
- [Source: _bmad-output/game-architecture.md: Game Time (`boostUntil`), Event System (`BoostStarted`, `BoostEnded`), Formats (`formatGameTime` for the boost timer), System Location Mapping (`betterPlace.ts`), Data Patterns (`hudView` … `boostRemaining`), Project Structure (`hud/` … `BoostTimer`)]
- [Source: _bmad-output/project-context.md: Boost; Timers; Save]
- [Source: _bmad-output/implementation-artifacts/deferred-work.md: "A crowded bottom bar (Stories 2.8, 3.2, 3.3, 4.5)"]
- [Source: _bmad-output/implementation-artifacts/2-7-drag-a-sheep-into-the-better-place.md (sacrifice pipeline, review findings, probe setup)]

## Dev Agent Record

### Agent Model Used

Claude Opus 5.5 (1M context), `claude-opus-5-5[1m]`

### Implementation Plan

- **Sim:**
  - `TUNING.boostMs` (30 000) and `boostPipMultiplier` (2).
  - `GameState.boostUntil` (0 = never).
  - Selectors `isBoosted`, `boostRemainingMs` and `farmPipsPerClick(state)`, and `HudView.boostRemainingMs`.
  - `sacrifice` emits `BoostStarted { until, renewed }` after `Sacrificed` and resets `boostUntil` before `removeSheep`, so `Lost` stays last.
  - `farm()` adds `farmPipsPerClick(state)`; `farmBreeding()` is unchanged.
- **Save:** `SAVE_SCHEMA_VERSION` 6; migration `5 → boostUntil: 0`; validation requires an integer in `[0, time + boostMs]`.
- **View:**
  - `hud/FarmBoost.ts`:
    - a baked, stepped `halo` glow (bands at 10/6/3 px out with alpha .2/.45/1), created before the Farm button so it draws under it and the widgets right of it;
    - a pulsing alpha tween while boosted;
    - a `void`/`halo` "×2" pill badge at depth 1.
  - `hud/BoostTimer.ts`: a fixed 104×40 `void` pill with "×2 0:{ss}" in `numeric`/`halo`. It rounds up and sets text only when the second changes; `pop()` is a scale yoyo.
  - `BottomBar` builds both. The timer sits at `BOOST_X` 1 092, with an invariant keeping `SHOP_RESERVE` 64 px for 3.2.
  - `HudScene.refresh` drives `setBoosted` and `set`. `onSim` handles `BoostStarted`: the timer pops and a "×2" popup rises over Farm.
- **Debug:** a DEV `Boost` button, and `boost m:ss` on the readout's food line.

### Debug Log References

- **Red phase:** 32 of 486 tests failed before implementation (missing `boostUntil`, selectors, `BoostStarted`, the schema-6 migration and validation). All 486 pass after it (458 before → 28 new; 3 existing `betterPlace` expectations updated as the story planned).
- **Deviations from the task text:**
  - **Badge order (4.1):** the badge is drawn at depth 1 (with its text at 2), not by creation order, so it never hides under the Farm Breeding Food button. The glow uses creation order, as planned.
  - **Timer pop (5.1):** 80 ms each way (yoyo, 160 ms total).
  - **Glow under pause:** the pulse is a HUD tween, so it keeps pulsing under the pause scrim while the timer itself is frozen. This is cosmetic, and left as is.
- **Browser probe:** scratchpad `playwright-core` with system Chrome (SwiftShader), against the DEV server on port 5200. No console errors or warnings beyond SwiftShader's GL notices. Results:
  - **7.1:** in a new game, `boostUntil` is 0, and there is no glow, badge or timer.
  - **7.2:** a sheep dragged into the hole. On that frame the Farm button has the gold ring and glow and the "×2" badge, the "×2" popup rises, the timer reads "×2 0:30", and the toast "A sheep went to a Better Place." shows.
  - **7.3:** after the sacrifice, `F` took the bar 0 → 2 and a click took it 2 → 4 (4/8 drawn as four pips). `G` filled 1 breeding pip.
  - **7.4:**
    - At ×1, state remaining 29.6 / 25.9 / 22.4 / 18.9 s showed 0:30 / 0:26 / 0:23 / 0:19.
    - At ×16, the boost ran out: no glow, badge or timer, and the next `F` filled 1 pip (4 → 5).
  - **7.5:** a second sacrifice mid-boost reset it to 29.4 s left and showed "×2 0:30", popped. The badge still read ×2.
  - **7.6:** under the pause menu, game time did not move over 2 s real, and the timer held.
  - **7.7:** forced a save by hiding the tab (schema 6, 26.4 s left), reloaded and pressed Continue. The game was still boosted, with 25.2 s left at the next dump (about 1 s of play after Continue).
  - **7.8:**
    - At 1280×720, the timer sits at x 1 092–1 196, right of the threat summary, with no overlap.
    - The badge (about x 214–258, y 602–628) clears Farm Breeding Food (x 260).
    - The glow does not cover the "0/8" count.
    - At 960×540, everything is legible and nothing overlaps.
  - **7.9:** sacrificing every sheep showed the lose screen; Restart started a new game with no glow, badge or timer.
  - **7.10:** 103 sheep, boosted, ×1, overlay open: 41 FPS (2.7 baseline 39). `setBoosted` and `set` return early without a change.
  - **7.11:** no errors.

### Completion Notes List

- 2026-10-07: Story created. The context engine analysis is complete, and this file is the developer guide.
- 2026-10-07: Implemented. All ACs are met; the Open Questions are implemented at their defaults:
  - no `BoostEnded` event;
  - the "×2" popup on a sacrifice;
  - the timer rounds up;
  - the squash leaves the glow and badge in place;
  - the timer sits right of the threat summary.
- AC evidence:
  - AC 1–5 and 12: unit tests and the `boost.test.ts` scenario (29 s → 2 pips, 31 s → 1; reset at 20 s → 49.9 s is 2 pips, 50 s is 1; breeding never boosted; a lost game ignores Farm).
  - AC 6–9: browser checks.
  - AC 10: the save round trip with an active boost, and the browser hide → reload → Continue.
  - AC 11: the migration, validation and `busyGame` tests.
  - AC 13: `npm test` (486), `npm run typecheck` and `npm run lint` pass.
- Task 8.3: the architecture is unchanged. Two notes are offered to Rylan: `BoostEnded` is not emitted, and `BoostStarted` carries `{ until, renewed }`.

### File List

- `src/config/tuning.ts` (modified)
- `src/config/constants.ts` (modified)
- `src/sim/state.ts` (modified)
- `src/sim/selectors.ts` (modified)
- `src/sim/commands.ts` (modified)
- `src/sim/events.ts` (modified)
- `src/sim/systems/betterPlace.ts` (modified)
- `src/save/migrations.ts` (modified)
- `src/save/validate.ts` (modified)
- `src/view/hud/FarmBoost.ts` (new)
- `src/view/hud/BoostTimer.ts` (new)
- `src/view/hud/BottomBar.ts` (modified)
- `src/view/scenes/HudScene.ts` (modified)
- `src/view/strings.ts` (modified)
- `src/debug/DebugOverlay.ts` (modified)
- `tests/sim/scenarios/boost.test.ts` (new)
- `tests/sim/systems/betterPlace.test.ts` (modified)
- `tests/sim/commands.test.ts` (modified)
- `tests/sim/selectors.test.ts` (modified)
- `tests/sim/state.test.ts` (modified)
- `tests/sim/scenarios/sacrifice.test.ts` (modified)
- `tests/save/busy.ts` (modified)
- `tests/save/migrations.test.ts` (modified)
- `tests/save/saveFile.test.ts` (modified)
- `tests/save/validate.test.ts` (modified)
- `_bmad-output/implementation-artifacts/deferred-work.md` (modified)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modified)
- `_bmad-output/implementation-artifacts/2-8-sacrifice-food-boost.md` (this story)

### Change Log

- 2026-10-07: Code review: 4 patch findings fixed, 2 deferred (the validation bound vs a retune, for 3.6; the Shop toggle space, for 3.2) and 7 dismissed. The fixes:
  - a lost game is never boosted (`isBoosted`/`boostRemainingMs` gate on `lostAt`), so a last-sheep sacrifice leaves no frozen glow, badge or timer;
  - the glow pulse pauses under a modal (`FarmBoost.setFrozen`);
  - the 5.4 deferred note;
  - the boosted bar test is robust to tuning.

  Tests: 487. Typecheck and lint are clean. Browser-checked: the glow holds still under pause and pulses again after Resume; the lose screen after a last-sheep sacrifice shows no boost. Status → done.
- 2026-10-07: Implemented Story 2.8. The sacrifice food boost:
  - `boostUntil`, ×2 Farm pips for 30 s, reset and never stacked, and the `BoostStarted` event;
  - save schema 6 with a migration and validation;
  - the boosted Farm glow and "×2" badge, the boost timer pill, the "×2" popup and a debug Boost button;
  - 28 new tests.

  Status → review.
