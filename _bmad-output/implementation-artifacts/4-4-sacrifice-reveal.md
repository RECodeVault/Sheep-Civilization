---
baseline_commit: 4a25830
---

# Story 4.4: Sacrifice Reveal

Status: done

<!-- Created 2026-10-08 by create-story. Fourth story of Epic 4 (Should tier). The payoff for watching: when a sheep goes into the Better Place, the game tells the truth. The sim needs no change: `Sacrificed { wasAbomination }` has carried the real flag since Story 4.1 (betterPlace.ts), and the boost is the same for everyone (Story 2.8). This story is view work: GameScene.suck branches on wasAbomination (a true-form FILL-tint flash on the pooled ghost before the spiral), HudScene adds the reveal toast when the ghost lands in the hole, and strings.ts gets the two lines. Key findings: (1) there is no audio system yet (AudioDirector arrives in Story 5.6, like every other sound so far), so the screech, the sting and the `[screech]` caption are deferred there; (2) there is no "true form" art, so the flash is a FILL tint silhouette, which is exactly what the epic AC names; (3) the docs list both "{name} went to a Better Place." and the reveal lines, so both toasts show (default; see Open Questions). -->

## Story

As a player,
I want the Better Place to reveal whether I sacrificed the Abomination or an innocent,
so that catching it feels smug and guessing wrong feels funny.

## Acceptance Criteria

1. **The Abomination's true form flashes (FR33, UX-DR81).** When `Sacrificed { wasAbomination: true }` reaches `GameScene`, the pooled ghost that copies the sheep's sprite (`ghostOf`) plays a true-form flash **before** the normal spiral: it toggles between `setTint(COLOR_INT.void).setTintMode(Phaser.TintModes.FILL)` (a solid silhouette) and its copied look, `REVEAL.flashes` times over `REVEAL.flashMs` each, while it swells to `REVEAL.swellScale` × its scale and shakes a few px side to side. Then it spirals into the hole exactly as today (`SUCTION`), and the sparkle and `betterPlace.gulp()` follow as today. Phaser 4 API only (`setTintFill` does not exist in v4). All `REVEAL` values are `[ASSUMPTION, tune in the browser]` constants beside `SUCTION`.
2. **An innocent goes in as today.** `Sacrificed { wasAbomination: false }` plays the unchanged suction (no flash, no swell). An infected innocent keeps its green MULTIPLY tint on the ghost, as today.
3. **The reveal toast lands with the sheep (FR33, UX-DR93).** The existing "A sheep went to a Better Place." toast still shows at once on every `Sacrificed` (HudScene, unchanged). When the ghost reaches the hole (the spiral's end), a second announcement toast shows:
   - Abomination: **"Good riddance."**
   - Innocent: **"…that was just a sheep."** (with the real ellipsis `…`, U+2026, as in `DEATH_TOAST.abomination`)
   GameScene tells HudScene through a new UI bus event `'sacrifice:landed': { wasAbomination: boolean }`; HudScene owns the toast (it already owns every toast). If no ghost can play (the sprite is already gone), the event is sent at once, so the line never goes missing. If the ghost's tween is stopped early (the ghost is reused by a later sacrifice or sale before it lands), the event is still sent once (`onStop` as well as `onComplete`, guarded so it fires only once).
4. **No payout beyond the normal boost (FR33, GDD "There is no payout").** Sacrificing the Abomination changes state exactly as sacrificing an innocent does: removed through `removeSheep` (no carcass), `stats.sacrificed` + 1, `boostUntil = time + boostMs`, `Sacrificed` then `BoostStarted`. No money, no extra boost, no other event. A pending victim's `doomedAt` still lands (Story 4.3 AC 5; deferred-work "A pending doom survives the reveal": kept, see Open Question 2). **No sim code changes in this story.**
5. **The next Abomination can come later at 5% per birth.** After the Abomination is sacrificed, none is alive, so births past `guaranteedAtBirth` roll `abominationBirthChance` again (`onBirth`, unchanged). The guaranteed birth is never re-used (`birthsSeen` is already past it). A new one gets a fresh `nextKillAt` (`makeAbomination`). A sim test proves this through the real `Sacrifice` command (not by clearing the flag by hand, as the 4.1 rate test does).
6. **Secrecy holds until the reveal (UX-DR64, AR18).** The only new read of the truth in `src/view/` is `e.wasAbomination` on the `Sacrificed` event, which is the designed channel. No view code reads `isAbomination`, `stalk`, `doomedAt`, `nextKillAt` or `state.abomination`; `npm run lint` stays clean with the secrecy rule unchanged. The ghost of an Abomination looks exactly like a lamb's ghost until the flash starts.
7. **Audio and captions are deferred to Story 5.6** (no `AudioDirector` exists; every sound so far is deferred there). Record in `deferred-work.md`: the screech then the sting on `Sacrificed { wasAbomination: true }` (UX-DR81), timed to the flash's start, and the `[screech]` caption (UX-DR88). The `[suction]` caption plays for every sacrifice (already deferred from 2.7).
8. **Reduced motion is deferred to Story 5.7.** Record: the swell and shake are juice (reduced motion drops them), but the flash itself is information (the truth) and stays, like the infection wobble (EXPERIENCE "Gameplay animation is never reduced").
9. **Done = `npm test`, `npm run typecheck` and `npm run lint` all pass.** The reveal is checked in the browser with the DEV tools (Task 5).

## Tasks / Subtasks

- [x] **Task 1: Strings (AC 3)**
  - [x] 1.1 `src/view/strings.ts`: next to `sacrificeToast`, add `revealInnocent: '…that was just a sheep.'` and `revealAbomination: 'Good riddance.'`, with a comment: UX-DR93 / EXPERIENCE Voice table ("Sacrifice reveal"); Story 5.3 puts the name in place of "a sheep" (`"…that was just {name}."`, the name in `halo`); "Good riddance." is an `[ASSUMPTION]` in the Voice table. No "!" (UX-DR97).

- [x] **Task 2: The bus event (AC 3)**
  - [x] 2.1 `src/view/bus.ts`: add `'sacrifice:landed': { wasAbomination: boolean }` with a comment: GameScene, when a sacrificed sheep's ghost reaches the hole (or at once if no ghost plays); HudScene shows the reveal toast (FR33, Story 4.4).

- [x] **Task 3: The reveal on the field (`src/view/scenes/GameScene.ts`) (AC 1–3, 6)**
  - [x] 3.1 Add a `REVEAL` constant after `SUCTION`, with the same comment style: `{ flashes: 3, flashMs: 110, swellScale: 1.35, shakePx: 3 }` `[ASSUMPTION, tune in the browser]`. Comment: UX-DR81, the true form is a `void` FILL silhouette (no true-form art exists; GDD art list has none; Story 5.8 may add art); flash before the spiral, "as it falls in" (GDD Reveal). Total extra time about `flashes × 2 × flashMs` ≈ 0.7 s.
  - [x] 3.2 `onSim`: `else if (e.type === 'Sacrificed') this.suck(e.id, e.wasAbomination);`. Update the comment of `suck` (UX-DR80 + UX-DR81).
  - [x] 3.3 `suck(id, wasAbomination)`:
    - `ghostOf(id)` as today. If `null`, `bus.emit('sacrifice:landed', { wasAbomination })` at once and return.
    - Innocent: the existing spiral tween, unchanged values; its end sends the event (3.4).
    - Abomination: a short flash phase on the ghost, then the same spiral. Use `this.tweens.chain({ targets: ghost, tweens: [...] })` (Phaser 4.2.1 has `TweenManager.chain`, verified in `node_modules/phaser/types/phaser.d.ts`) or one tween whose `onComplete` starts the spiral. The flash toggles the tint in an `onYoyo`/`onRepeat` callback (`setTint(COLOR_INT.void).setTintMode(Phaser.TintModes.FILL)` on, then back to the copied look: re-apply the sprite's own tint and mode if it had one, else `clearTint()`). Keep the copied tint state in locals captured once per sacrifice (closure per sacrifice is fine: a rare event, the existing code's comment says so). The swell and shake can ride the same tween (`scale`, `x` with `yoyo`). End the flash phase un-tinted? **No:** end it on the silhouette, so the true form is what goes down the hole.
    - Factor the spiral into a small private method (`spiral(ghost, onLanded)`) used by both branches, so the innocent path keeps exactly today's values.
  - [x] 3.4 Landing: in the spiral's `onComplete`, after the sparkle and `gulp()`, `bus.emit('sacrifice:landed', { wasAbomination })`. Guard with a local `let sent = false` and also send from `onStop` (Phaser calls `onStop`, not `onComplete`, when `killTweensOf` stops a tween; `ghostOf` kills the ghost's tweens when it reuses it). For the chain/flash phase, make sure a kill during the flash also sends it (a ghost reused mid-flash: send once, hide the ghost). A scene shutdown (Restart, Main Menu) mid-tween must **not** send it into the next game: the bus listeners are removed on shutdown, and `clearAnnouncements` runs on a new game; check that the order holds (if not, check `this.sys.isActive()` before emitting).
  - [x] 3.5 `ghostOf` already resets frame, flip, scale, angle, alpha, tint and position, so a reused ghost never keeps the silhouette. The mode is reset too: Phaser 4.2.1's `clearTint()` sets the tint to white and the mode to `MULTIPLY` (verified in `node_modules/phaser/src/gameobjects/components/Tint.js:154`). Use `clearTint()` for "back to the copied look" on an untinted ghost.
  - [x] 3.6 Depth: the ghost is at `FIELD_DEPTH.dragged`, so the flash draws above the flock and the hole. No change.
  - [x] 3.7 Do **not** touch `SheepSprite`/`EntityLayer`: the real sprite leaves through the layer's sweep as today (`playExit` stays synchronous; deferred-work 2.4/2.7 decision).

- [x] **Task 4: The reveal toast (`src/view/scenes/HudScene.ts`) (AC 3)**
  - [x] 4.1 Subscribe to `'sacrifice:landed'` where the other bus listeners are registered, with the scene as context, and remove it in the SHUTDOWN handler (project rule: no double toasts after Restart).
  - [x] 4.2 Handler: `showToast(e.wasAbomination ? STRINGS.revealAbomination : STRINGS.revealInnocent, { announcement: true })`, inside `try/catch` → `reportError('ui', err)` like `onSim`.
  - [x] 4.3 Update the `Sacrificed` comment in `onSim`: it no longer says "Never branches on wasAbomination: the reveal is Story 4.4's". The sacrifice toast still never branches (it shows at once for every sheep); the reveal line follows on `'sacrifice:landed'`.
  - [x] 4.4 Stack: toasts stack up to 3, newest on top (`MAX_TOASTS`). A sacrifice now makes 2 announcement toasts. Check in the browser that a quick run of sacrifices (drag several in a row) evicts the oldest cleanly and the reveal line is readable.

- [x] **Task 5: Sim tests (AC 4, 5)**
  - [x] 5.1 `tests/sim/systems/betterPlace.test.ts`: "sacrificing the Abomination pays out nothing more": two states from the same seed and flock, one sacrifices a flagged Abomination (`makeAbomination`), one an equal innocent lamb. Compare everything except the `wasAbomination` flag on the event: `money`, `stats`, `boostUntil`, carcasses (none), and the drained event types and order (`Sacrificed`, `BoostStarted`). Paired, so it fails if a payout is ever added to one branch only.
  - [x] 5.2 `tests/sim/systems/abomination.test.ts`: "after the Abomination is sacrificed, a later birth can spawn another at the chance rate": build past the guaranteed birth with an Abomination alive (as the existing helpers do), `applyCommand(state, { type: 'Sacrifice', id })`, then births: the first birth rolls (rng advances by the one roll), a winning roll flags the lamb and sets `nextKillAt` in `[time + KillMin, time + KillMax]`; never two alive. Use a seed you find to win within a few births, or compute the roll from a copy of the rng (4.3's pattern); never loosen the rate test.
  - [x] 5.3 The existing "still lands after the Abomination is sacrificed" test (4.3) covers the doom. Leave it; reference it in the Dev Notes record.
  - [x] 5.4 No new seeded fallout is expected: the sim is unchanged. If any existing test moves, stop: something touched the sim.

- [x] **Task 6: Browser check (AC 1–3, 6, 9)**
  - [x] 6.1 `npm run dev`, DEV overlay: **Make Abomination** (Reveal off), drag it into the Better Place:
    - it flashes as a dark silhouette 3 times, swelling and shaking, then spirals in; sparkle and gulp as usual;
    - "A sheep went to a Better Place." at once, then "Good riddance." as it lands;
    - the ×2 boost starts as for any sacrifice; no money popup.
  - [x] 6.2 Drag an innocent adult in: the usual suction, then "…that was just a sheep." as it lands. Drag an infected one: green ghost, same line.
  - [x] 6.3 Drag 4 sheep in quickly (×1 and ×4): every landing gives its line once; the toast stack evicts cleanly; no stuck ghost on the field.
  - [x] 6.4 Sacrifice, then press Esc (pause) mid-spiral, and separately Restart from the pause menu mid-flash: no reveal toast in the new game; no console errors.
  - [x] 6.5 Sacrifice the last innocent with only the Abomination left (the loss rule from 4.3): the lose panel shows; the reveal line may show under it. Note what happens in the Debug Log.
  - [x] 6.6 `npm run build`; the `dist/` bundle has no DEV strings ("Make Abomination", "Kill now").

- [x] **Task 7: Docs (AC 7, 8)**
  - [x] 7.1 `_bmad-output/game-architecture.md` N2 step 4: record the reveal as built: the FILL silhouette flash on the pooled ghost, then the spiral; the `'sacrifice:landed'` UI event; the two toasts; no sim change; audio in 5.6.
  - [x] 7.2 `deferred-work.md`:
    - mark resolved "The reveal (Story 4.4)" (GameScene.suck and HudScene branch on `wasAbomination`);
    - mark "A pending doom survives the reveal (Story 4.4)" as decided: kept (no payout; Open Question 2);
    - add a "Deferred from: story 4-4-sacrifice-reveal" section: **5.6** the screech then the sting on the Abomination's reveal, started with the flash, and the `[screech]` caption; **5.7** reduced motion drops the swell and shake, keeps the flash; **5.3** "…that was just {name}." with the name in `halo` (and "{name} went to a Better Place."); **5.8** true-form art could replace the silhouette (GDD art list has none); **5.10** the flash values and whether the double toast reads well.
  - [x] 7.3 Story file, `sprint-status.yaml` and `deferred-work.md` go in the same commit as the code (repo pattern).

### Review Findings

- [x] [Review][Patch] The flash's beat reads `tween.progress` one frame late (Phaser 4.2.1 fires `onUpdate` from TweenData before `Tween.update` sets `progress`), so a frame hitch can skip toggles; read the TweenData's own progress [src/view/scenes/GameScene.ts:924]
- [x] [Review][Patch] With no ghost to play, `sacrifice:landed` is emitted inside GameScene's `onSim`, which runs before HudScene's, so the reveal toast lands under (before) "A sheep went to a Better Place."; send it after this frame's sim events [src/view/scenes/GameScene.ts:893]
- [x] [Review][Patch] `landed()` runs last in the spiral's `onComplete`, so a throw in the sparkle or gulp loses the reveal toast; send it first [src/view/scenes/GameScene.ts:956]
- [x] [Review][Patch] AC 5 test: `state.time` never moves, so the first Abomination's `nextKillAt` already satisfies the "fresh schedule" range (vacuous); `rolled > 0` can't fail; the sacrifice's events are left undrained in the global queue. Advance time after the sacrifice, assert the schedule is new, drain the events [tests/sim/systems/abomination.test.ts:233]
- [x] [Review][Defer] Ghost reuse cuts the reveal short: with 3 round-robin ghosts shared with sales, a 3rd sacrifice or sale within ~1.06 s reuses the Abomination's ghost, dropping its flash/spiral (the toast still comes, early) [src/view/scenes/GameScene.ts:997] — deferred, already logged in deferred-work (Story 4.4 entry); needs fast hand drags

## Dev Notes

### What this story is (and is not)

- **Is:** the view's reaction to `Sacrificed.wasAbomination`: a true-form flash on the Abomination's ghost, the reveal toast for both cases when the ghost lands, two strings, a UI bus event, two sim tests that pin "no payout" and "can spawn again", and docs.
- **Is not:** any sim, state or save change (no schema bump); the screech/sting/caption (5.6: no audio exists); reduced motion (5.7); names (5.3); true-form art (none planned). If you find yourself editing `src/sim/**` or `src/save/**`, stop: the event already tells the truth.

### Current code to build on (read these first)

| File | Today | This story |
|---|---|---|
| `src/sim/systems/betterPlace.ts` | `sacrifice()` emits `Sacrificed { id, wasAbomination: state.sheep[i].isAbomination }`, then `BoostStarted`, then `removeSheep(…, 'sacrificed')` | **no change** |
| `src/sim/events.ts:43` | `{ type: 'Sacrificed'; id: number; wasAbomination: boolean }` | no change |
| `src/view/scenes/GameScene.ts:117–133` | `SUCTION { durationMs: 400, spinDeg: 360, ghosts: 3 }`, `SPARKLE`, `SALE` constants | add `REVEAL` |
| `GameScene.ts:234` `onSim` | `Sacrificed` → `this.suck(e.id)` | pass `wasAbomination` |
| `GameScene.ts:874` `suck(id)` | ghost spiral to `BETTER_PLACE` (scale 0, +360°, `Cubic.easeIn`), then hide, sparkle, `betterPlace.gulp()` | flash phase for the Abomination; `spiral()` helper; emit `'sacrifice:landed'` |
| `GameScene.ts:922` `ghostOf(id)` | round-robin of 3 pooled images; kills the ghost's tweens; copies frame/flip/scale/angle/alpha/position/tint+mode | check the tint-mode reset (3.5) |
| `src/view/scenes/HudScene.ts:321` | `Sacrificed` → `showToast(STRINGS.sacrificeToast, { announcement: true })` | comment only; new `'sacrifice:landed'` listener |
| `src/view/bus.ts` | typed `BusEvents` (`sim`, `farm:pressed`, …, `shop:toggled`) | add `'sacrifice:landed'` |
| `src/view/strings.ts` | `sacrificeToast: 'A sheep went to a Better Place.'` | add `revealInnocent`, `revealAbomination` |
| `src/view/safetyNet.ts:137` | `showToast(text, { announcement })`: DOM stack, max 3, newest on top, `TOAST_MS` | no change |

### What must be preserved

- **Secrecy (UX-DR64).** The view learns the truth only from `Sacrificed.wasAbomination`, and only once the sheep is already gone. Nothing before the drop may differ: no ghost difference, no highlight on the Better Place, no label change while dragging the Abomination (`betterPlaceLabel` is the same "+2× food" for all). The lint rule needs no change (`wasAbomination` is not a secret name).
- **The sacrifice pipeline (N1, Story 2.7/2.8).** No carcass, boost reset not stacked, `Lost` after `Sacrificed` and `BoostStarted` when the last (non-Abomination) sheep goes.
- **`playExit()` stays synchronous**; the ghost carries all the juice (deferred-work 2.4 / 2.7 decision). The real sprite is swept as usual.
- **No game logic in tweens.** The tween callbacks only touch the ghost, particles, the hole's gulp and the UI bus. They never dispatch a command or touch `GameState`.
- **Listener cleanup.** The new HudScene listener is removed on SHUTDOWN; GameScene's tweens die with the scene. A Restart must not toast the old game's reveal.
- **No allocation in hot paths.** All of this runs per sacrifice (rare). Closures per sacrifice are fine (existing comment).

### Design decisions (defaults chosen; see Open Questions)

- **Silhouette colour `void` (#160E1C)**: the Better Place's "ominous" token (DESIGN colour table), a dark shape against the grass, the hole's interior and the halo rim. `alert` was considered but is the colour of pings and starving, which would read as "a warning", not "a monster". `COLOR_INT.void` is already exported.
- **Flash before the spiral, at the drop spot**: "As any sacrificed sheep falls in, the game shows the truth" (GDD). The drop spot is over the hole, so the flash plays at the rim and then goes down.
- **Both toasts**: the Voice table has a "Sacrifice (normal)" line and the two reveal lines; every sacrifice is one or the other, so the normal line would never show if the reveal replaced it. The normal line comes at once (as today), the reveal at the landing, which gives the joke a beat. Alternative in Open Question 1.
- **The reveal toast is HudScene's** (it owns every toast); GameScene only knows when the ghost lands. Hence the UI bus event (`noun:verb`, as the architecture names UI events).

### Architecture compliance

- **N2 step 4:** "sacrifice emits `Sacrificed { wasAbomination: true }` → view plays true-form flash, screech, 'Good riddance.'; innocent → '…that was just {name}.'" This story implements it, minus the screech (5.6). The architecture's event list names an `AbominationRevealed` event; it was never created and is not needed (`Sacrificed.wasAbomination` is the channel, Story 4.1). Note this in N2.
- **Phaser 4:** `setTint(c).setTintMode(Phaser.TintModes.FILL)`; never `setTintFill` (removed in v4; `node_modules/phaser/skills/game-object-components/SKILL.md`). `TweenManager.chain` exists in 4.2.1.
- **Colours** from `COLOR_INT` (no hex in components); **copy** from `strings.ts`.
- **UI events** are `noun:verb` on the typed `bus` (architecture Event naming).

### Library / framework notes

- Phaser **4.2.1** (installed). APIs used: `Image.setTint`, `setTintMode`, `clearTint`, `isTinted`, `tint`, `tintMode` (already used in `ghostOf` and `SheepSprite.ts:352`), `this.tweens.add` / `this.tweens.chain`, tween `onComplete` / `onStop` / `onYoyo` / `onRepeat`. Check any callback name you use against `node_modules/phaser/types/phaser.d.ts` (TweenBuilderConfig) before relying on it.
- No new packages. No web research needed beyond the installed typings.

### Testing standards

- Vitest covers `src/sim/` and `src/save/` only; the flash and toasts are checked in the browser (project rule: never mock Phaser).
- Sim tests: `newGame(seed)`, `createSheep`, `makeAbomination`, `applyCommand`, `runFor` in `TICK_MS` steps (`tests/sim/helpers.ts`). Assert on state and drained events; read `TUNING`, never literals.
- The "no payout" test must be **paired** (Abomination vs innocent from the same start), so it is not vacuous (4.2 lesson).

### Previous story intelligence (4.1–4.3)

- 4.1: `Sacrificed.wasAbomination` is real; the DEV **Reveal** ring and **Make Abomination** exist (`src/debug/DebugOverlay.ts`). The 4.1 rate test clears the flag by hand; 5.2 here proves the real path.
- 4.2: the off-step and the 36/24 spacing; nothing in this story may change how it looks before the drop.
- 4.3: the kill cycle; the loss rule (only the Abomination left = lost); a doom survives the Abomination's sacrifice (tested: "still lands after the Abomination is sacrificed"); the pacing bot sacrifices the Abomination after its 2nd victim (`SPOT_AFTER_VISITS` in `tests/sim/scenarios/pacing.test.ts`), unaffected here. 4.3's browser probe found that **toasts are DOM, not Phaser text**: a probe that reads toasts must read the DOM stack.
- Review lessons (Epics 2–4): stale comments after behaviour changes (here: the HudScene `Sacrificed` comment, `suck`'s doc, the betterPlace.ts header "which reveals it in Story 4.4" → now true, reword to past), DEV/scene objects leaking across restarts, vacuous tests.

### Git intelligence

- Pattern: one "Implement story 4.4: Sacrifice Reveal" commit with code, story file, `deferred-work.md` and `sprint-status.yaml`; a separate "Apply story 4.4 code review fixes" commit if the review finds patches.
- Branch: `story/4-4-sacrifice-reveal` (created from `main` at `4a25830`).

### Open questions (defaults chosen; confirm or change)

1. **Two toasts per sacrifice** ("A sheep went to a Better Place." at once, then the reveal line at the landing). Alternative: the reveal line **replaces** the sacrifice toast (one toast per sacrifice; "went to a Better Place" would then never show).
2. **A pending doom still lands after the Abomination is sacrificed** (no payout, as the epic says; FR31 timing). Alternative: sacrificing it cancels every `doomedAt` (catching it in time saves its last victim; a sim change with a test).
3. **Silhouette in `void`**, 3 flashes, swell ×1.35, about 0.7 s before the spiral. Alternatives: `alert` red, or `haze` purple.
4. **The screech and sting wait for Story 5.6** with all other sounds. Alternative: pull a minimal `AudioDirector` forward (bigger story; needs assets and the unlock rule).

### Project Structure Notes

- Modified: `src/view/scenes/GameScene.ts`, `src/view/scenes/HudScene.ts`, `src/view/bus.ts`, `src/view/strings.ts`, `src/sim/systems/betterPlace.ts` (header comment only), `tests/sim/systems/betterPlace.test.ts`, `tests/sim/systems/abomination.test.ts`, `_bmad-output/game-architecture.md`, `_bmad-output/implementation-artifacts/deferred-work.md`, `_bmad-output/implementation-artifacts/sprint-status.yaml`.
- New: none.
- No save schema change (`SAVE_SCHEMA_VERSION` stays 10).

### Project Context Rules (from `_bmad-output/project-context.md`)

- **Phaser 4, not 3:** `setTint(c).setTintMode(Phaser.TintModes.FILL)` is named for exactly this flash; no `setTintFill`, `preFX` or per-sprite Filters on sheep.
- **No Phaser timers or tween callbacks change `GameState`**; tweens are visuals only.
- **The Abomination is secret**; the truth is revealed only by `Sacrificed { wasAbomination }`. View code uses `PublicSheep` and never reads `isAbomination`/`stalk`/`doomedAt`/`nextKillAt`/`state.abomination`.
- **Audio** only through `AudioDirector` (Story 5.6), volumes from settings; key sounds raise captions when captions are on.
- **Colours** from `COLORS`/`COLOR_INT`; **copy** from `strings.ts`; no "!" except "Last sheep!"; never "corpse", "blood" or "kill".
- **Listener cleanup** on SHUTDOWN for every `bus.on`.
- **Reduced motion** (5.7) applies to juice (swell, shake), never to information (the flash).
- **Pooling:** no `new`/`destroy()` of sprites during play; the reveal reuses the pooled ghosts.
- Done = `npm test`, `npm run typecheck`, `npm run lint` all green; rendering checked manually in the browser.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 4.4: Sacrifice Reveal]
- [Source: _bmad-output/planning-artifacts/epics.md#Requirements Inventory] FR33; AR18; UX-DR64, UX-DR81, UX-DR88, UX-DR93, UX-DR97
- [Source: _bmad-output/planning-artifacts/gdds/gdd-sheep-civilization-2026-10-05/gdd.md#The Abomination (Should tier)] Reveal row ("There is no payout. The payoff is the smug moment.")
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-sheep-civilization-2026-10-05/EXPERIENCE.md] Voice and Tone (Sacrifice reveal rows); Game Feel & Juice (Abomination reveal); Accessibility Floor (`[screech]`, reduced motion); journey step 8
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-sheep-civilization-2026-10-05/DESIGN.md] Colour table (`void`, `halo`, `haze`)
- [Source: _bmad-output/game-architecture.md#N2 — Abomination: Hidden Identity, Delayed Kill, Reveal] step 4; Phaser v4 notes; Event naming
- [Source: _bmad-output/implementation-artifacts/deferred-work.md] "The reveal (Story 4.4)"; "A pending doom survives the reveal (Story 4.4)"; Audio (Story 5.6) entries
- [Source: _bmad-output/implementation-artifacts/4-3-the-kill-cycle.md], [4-1-the-abomination-is-born-and-stays-hidden.md], [2-7-drag-a-sheep-into-the-better-place.md]
- [Source: _bmad-output/project-context.md]

## Dev Agent Record

### Agent Model Used

Claude Opus 5.5 (claude-opus-5-5[1m])

### Implementation Plan

- No sim change. `GameScene.suck(id, wasAbomination)`: an innocent's ghost spirals as before (`spiral()`, the old tween unchanged); the Abomination's ghost first runs `revealTrueForm()`: one tween swells it to `REVEAL.swellScale` over `flashes × 2 × flashMs` while its `onUpdate` toggles a `void` FILL silhouette and the copied look per beat and shakes it ±`shakePx`; it ends on the silhouette, then spirals.
- Landing: each sacrifice registers a `landed` callback in `ghostLanding[slot]`; the spiral's `onComplete` calls it, and it sends `sacrifice:landed` once. HudScene shows the reveal toast on that event (listener removed on SHUTDOWN).
- Strings `revealInnocent` / `revealAbomination`; bus event `sacrifice:landed`.

### Debug Log References

- **Baseline (4a25830):** 749 passed, 1 skipped. After: 751 passed, 1 skipped (the two new sim tests). No existing test moved (the sim is unchanged).
- **Deviation from Task 3.4 (`onStop`):** Phaser 4.2.1's `killTweensOf` and the scene shutdown call `tween.destroy()`, which fires no `onStop` (`BaseTween.destroy`, `TweenManager.killAll`; checked in `node_modules/phaser/src/tweens`). So a reused ghost's owed toast is sent by `ghostOf` before it kills the ghost's tweens (`ghostLanding[slot]?.()`), and `create` clears `ghostLanding` so a restart drops the old game's owed toast. Same outcome as the AC: sent once, never into the next game.
- **Red check (5.1):** a temporary `money += 1` for the Abomination in `sacrifice()` made the paired test fail; reverted (the file's only diff is the header comment).
- **Browser (Task 6):** a scratchpad Playwright probe on the DEV server (`main.ts` exposed the game temporarily; restored, no diff). Passed 3 runs in a row after fixing a probe timing flake (it sampled the ghost before the 10 Hz tick had run the sacrifice). Results: the Abomination's ghost shows the `void` FILL silhouette and toggles back between flashes, swells (scale 2 → 2.7); "A sheep went to a Better Place." at about 45 ms, "Good riddance." at about 1.16–1.19 s (flash 0.66 s + spiral 0.4 s); boost started, money unchanged, no carcass. An innocent: no silhouette, "…that was just a sheep." at about 0.44 s. An infected innocent: green MULTIPLY ghost, same line. Four sacrifices in one frame (Abomination + 3; 3 ghosts, so one is reused): four reveal lines, one "Good riddance." (sent early, at the reuse; deferred-work), no stuck ghost, toast stack ≤ 3. Restart 250 ms into the flash: no "Good riddance." in the new game. Sacrificing every innocent with the Abomination left: lost (4.3 rule); the three reveal lines still show over the lose screen (6.5: noted, harmless). No console errors. A frozen-tween crop confirmed the dark lamb silhouette on screen.
- **Build (6.6):** `npm run build` passes; no "Make Abomination", "Kill now", "Reveal Abomination" or the probe hook in `dist/`; both reveal strings are bundled.

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created
- Implemented the sacrifice reveal (FR33, UX-DR81, UX-DR93): the Abomination's ghost flashes a `void` FILL silhouette, swelling and shaking, before it spirals into the hole; "Good riddance." when it lands. An innocent spirals as before; "…that was just a sheep." when it lands. "A sheep went to a Better Place." still shows at once for every sacrifice (Open Question 1 default).
- No sim/save change; no payout beyond the boost; a pending doom still lands (Open Question 2 default). Tests: a paired "no payout" test (`betterPlace.test.ts`) and a respawn-after-sacrifice test through the real `Sacrifice` command (`abomination.test.ts`).
- Audio (screech, sting, `[screech]`) deferred to 5.6, reduced motion to 5.7, names to 5.3 (deferred-work); architecture N2 step 4 records the reveal as built.
- Open Question defaults kept (two toasts, doom lands, `void` silhouette, audio in 5.6); all still open for Rylan to change.

### File List

- `src/view/scenes/GameScene.ts`
- `src/view/scenes/HudScene.ts`
- `src/view/bus.ts`
- `src/view/strings.ts`
- `src/sim/systems/betterPlace.ts` (header comment)
- `tests/sim/systems/betterPlace.test.ts`
- `tests/sim/systems/abomination.test.ts`
- `_bmad-output/game-architecture.md`
- `_bmad-output/implementation-artifacts/deferred-work.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/4-4-sacrifice-reveal.md`

## Change Log

- 2026-10-08: Code review (Blind Hunter, Edge Case Hunter, Acceptance Auditor): 0 decisions, 4 patches applied, 1 deferred, 7 dismissed. Fixes: the flash's beat reads the TweenData's progress (`Tween.progress` is set after `onUpdate` in Phaser 4.2.1, so it lagged a frame); with no ghost to play, the reveal toast is sent on the next frame, so it follows "A sheep went to a Better Place." (probe: the order is now sacrifice → reveal); the spiral sends `landed` before the sparkle and gulp; the AC 5 test advances time past the old schedule, asserts a new `nextKillAt` (red-checked: it fails if the spawn skips the schedule) and drains the sacrifice's events. Deferred: ghost reuse can cut the reveal short (sales share the pool). Gates: 751 passed, 1 skipped; typecheck and lint clean; browser probe passes 3 runs; build clean.
- 2026-10-08: Story 4.4 implemented. True-form flash (`void` FILL silhouette, swell, shake) on the Abomination's sacrifice ghost; reveal toasts "Good riddance." / "…that was just a sheep." when the ghost lands (`sacrifice:landed`); no sim change. Gates: 751 passed, 1 skipped; typecheck and lint clean; browser probe passes 3 runs; build clean.
