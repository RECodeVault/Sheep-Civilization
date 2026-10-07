---
baseline_commit: e72bdb8e251c198ccb5f852395a2236a95e79e9b
---

# Story 2.4: Carcasses and Death Announcements

Status: done

<!-- Created 2026-10-07 by create-story. Builds on 1.8 (killSheep / loss), 2.1 (old age) and 2.3 (breed-mode clicks). -->

## Story

As a player,
I want every death to leave a carcass I can click away, with a short announcement,
so that I notice deaths and can keep the pasture clean.

## Acceptance Criteria

1. **Carcass on death (FR12, AR17, N1).** Given `TUNING.carcassesEnabled = true`, when a sheep dies of starvation or old age, then `killSheep` creates a carcass `{ id, x, y, createdAt }` at the sheep's position:
   - `id` comes from `nextId`, `createdAt` is `state.time`, and no rng is drawn.
   - The sim emits `SheepDied`, then `CarcassSpawned { id, x, y }`, then `Lost` if that was the last sheep.
   - `removeSheep` (sell or sacrifice, Epic 2/3) will never leave one; nothing in this story removes a sheep any other way.
2. **Carcass visuals (UX-DR59, UX-DR79, NFR10).** Given a carcass, when it renders, then:
   - It shows an X-eyes sprite: a sheep on its back with its legs up. No red, no blood, no gore.
   - On spawn it plays a slapstick flop: it starts a little higher, tipped onto its side, and falls flat with a bounce.
   - A dust puff bursts where it lands.
   - It is y-sorted with sheep and pieces (depth = y).
   - A carcass that exists when a game is loaded also flops in, as food pieces bounce in (no dust: the puff follows the spawn event).
3. **Click to clear (FR13, UX-DR65).** Given a carcass, when I left-click it in the default (`idle`) input mode, then a `ClearCarcass { id }` command removes it on the next tick, the sim emits `CarcassCleared { id, x, y }`, and a small dust puff plays where it was.
   - A click is a left press on the field and a release within 6 px, hit-tested at the **press** point in world coordinates (pointer + camera scroll).
   - The carcass hit box is its sprite bounds plus 6 px, and at least 40 × 40 px (`LAYOUT.hitMin`, UX-DR90). If two overlap, the front-most (largest y) wins.
   - A carcass under a sheep is still cleared: in idle mode a click on a sheep does nothing, so the carcass under it takes the click.
   - A click on empty field, on a sheep with no carcass under it, on the bottom bar, or while the pointer is on a HUD control does nothing.
   - Nothing happens under a modal (pause, confirm, lose).
   - Carcasses never disappear on their own.
4. **Sim authority.** `ClearCarcass` with an id that is not a carcass (already cleared, a double click within one tick, a sheep id) does nothing: no state change, no event, no throw. A lost game ignores it (the existing `applyCommand` guard).
5. **Death toast (UX-DR41, UX-DR92, UX-DR97).** Given a `SheepDied` event, when HudScene receives it, then an `announcement-toast` (`dusk` card, `wool` body text) shows top-centre:
   - "A sheep starved." for `starved`
   - "A sheep died of old age. A long, full nine minutes." for `oldAge`
   - Up to 3 stack, newest on top, each about 4 s, never blocking clicks.
   - **Every death gets its own toast:** three sheep starving on one tick show three toasts, never one merged toast.
   - Names arrive in Story 5.3; until then the copy says "A sheep".
6. **No carcass tooltip.** Given the pointer over a carcass, when the hover delay passes, then no sheep tooltip shows (unless a living sheep is over the carcass, which shows that sheep's tooltip as usual).
7. **Save (AR9).** The `GameState` shape does not change (`carcasses` has existed since schema 2), so `SAVE_SCHEMA_VERSION` stays 4. Validation is tightened: each carcass's x/y lies inside the fence (as a sheep's does), and `createdAt` is an integer in [0, time]. The round-trip and corrupt-save tests stay green, and the busy fixture holds a carcass.
8. `npm test`, `npm run typecheck` and `npm run lint` all pass.

## Tasks / Subtasks

- [x] **Task 1: Sim: carcasses on, create, clear (AC: 1, 3, 4)**
  - [x] 1.1 `TUNING.carcassesEnabled: true`. Update its comment: Epic 1 staging is over (architecture N1); every non-sacrifice death leaves a carcass from Story 2.4. Keep the flag (the epic AC names it).
  - [x] 1.2 In `src/sim/systems/carcass.ts`:
    - Add `createCarcass(state, x, y): Carcass`, the factory the architecture names (Entity Patterns): `{ id: nextId(state), x, y, createdAt: state.time }`, pushed to `state.carcasses`. No rng, no event (the debug button uses it too).
    - `killSheep` calls it when the flag is on, then emits `CarcassSpawned { id, x, y }` **after** `SheepDied` and before `checkLastSheepAndLoss`.
    - Add `clearCarcass(state, id)`: find the index with a plain loop (a `carcassIndex(state, id)` selector, like `pieceIndex`); return silently if it is -1 (no `invariant`: a double click legitimately sends two commands for one id before the tick removes it). Otherwise `splice` it out and emit `CarcassCleared { id, x, y }`.
    - Update the header comment: carcasses are on; `clearCarcass` lives here; 2.5 adds starving-eats-carcass here too (System Location Mapping).
  - [x] 1.3 `src/sim/commands.ts`: add `{ type: 'ClearCarcass'; id: number }` to `Command` and its `case` calling `clearCarcass`. The `assertNever` default stays. Update the "Later stories append…" comment (`ClearCarcass` is here now).
  - [x] 1.4 `src/sim/events.ts`: add `CarcassSpawned { id; x; y }` and `CarcassCleared { id; x; y }` (both in the architecture's past-tense naming; `CarcassSpawned` is in its event list). Update the header's variant list. Note on `CarcassSpawned`: Story 2.6 pings on it.
  - [x] 1.5 `src/sim/selectors.ts`: `carcassIndex(state, id)` (plain loop) and `selectCarcasses(state): readonly Carcass[]` returning the live array (carcasses hold no secrets: an Abomination victim's carcass is just a carcass), like `selectFoodPieces`.
  - [x] 1.6 `src/sim/state.ts`: a doc comment on `Carcass` (FR12/FR13: left by every non-sacrifice death at the sheep's spot; stays until a `ClearCarcass`; `createdAt` is game-ms).
- [x] **Task 2: Save validation (AC: 7)**
  - [x] 2.1 In `validate.ts`'s carcass loop: `within(x, f.x, f.x + f.width)` and `within(y, f.y, f.y + f.height)`, the outer fence, as for sheep (a carcass is where a sheep stood); `createdAt` via `int(o, 'createdAt', p, 0, time)`.
  - [x] 2.2 No `SAVE_SCHEMA_VERSION` bump and no migration: the shape is unchanged, and no saved game ever held a carcass (the flag was off).
- [x] **Task 3: Toasts (AC: 5)**
  - [x] 3.1 `src/view/safetyNet.ts`: `showToast(text, { merge = true } = {})`. With `merge: false` it always adds a new toast (no lookup of an identical one). Error toasts keep merging. The DOM stack (top-centre, 3 max, ~4 s, `pointer-events: none`, `announcementToast` styling) is reused as is: do **not** build a second toast system.
  - [x] 3.2 `src/view/strings.ts`: `deathToast: Readonly<Record<DeathCause, string>>` (import the type from `sim/events`), frozen like `STAGE`:
    - `starved`: "A sheep starved."
    - `oldAge`: "A sheep died of old age. A long, full nine minutes." (still true: sheep die at `oldAgeMs` = 540 s)
    - `virus`: "A sheep caught the carcass sickness." (Story 2.5 fires it)
    - `abomination`: "A sheep just… fell over." (U+2026 ellipsis; Story 4.3 fires it; it must never state a cause, UX-DR64/UX-DR92)
    
    A `Record` over `DeathCause` keeps the mapping exhaustive. Comment: UX-DR92/UX-DR97; Story 5.3 replaces "A sheep" with the name in `halo`.
  - [x] 3.3 `HudScene.onSim`: on `SheepDied`, `showToast(STRINGS.deathToast[e.cause], { merge: false })`. The listener is already registered and removed on SHUTDOWN, and already guarded by `try/catch → reportError('ui', …)`.
- [x] **Task 4: Input: idle-mode field clicks (AC: 3)** in `src/input/InputController.ts`
  - [x] 4.1 Add the hook `carcassAt(screenX, screenY): number` to `InputHooks`: the id of the front-most carcass under a canvas point, or 0, hit-tested in world coordinates.
  - [x] 4.2 Generalise the breed-mode click to both modes (this is the 1.7 Task 9 design that `deferred-work.md` hands to 2.4):
    - `onPointerDown`: arm a left press when `onField && !pointerOnHud()` in **any** mode. Record the mode at the press (`clickMode`) and the target hit-tested at the press: `carcassAt` in `idle`, `sheepAt` in `breeding`.
    - `updateClick`: disarm when a modal is up **or** the mode changed since the press (for example breed mode exited because Breed greyed). Keep the threshold checks (while held and at the release point) unchanged.
    - Resolve with `switch (this.mode)` ending in `assertNever`: `idle` → if the target is not 0, `dispatch({ type: 'ClearCarcass', id })` (a rare event, so the command object is fine); `breeding` → `pick(id)` as today.
    - A moved press stays a no-op in both modes (2.7 adds the sheep drag).
  - [x] 4.3 Rename `clickSheep` to something mode-neutral (`clickTarget`). Update the class header and the `clickArmed` field comment ("a left press on the field, in either mode").
  - [x] 4.4 Breed mode ignores carcasses: a click there still only picks sheep (see Open Questions).
- [x] **Task 5: Shared hit test (AC: 3, 6)**
  - [x] 5.1 Move `sheepIndexAt` out of `SheepHover.ts` into a new `src/view/field/hitTest.ts` as a generic, allocation-free `spriteIndexAt(items, layer, x, y, minHalf = 0)`:
    - `items: readonly { id: number }[]`; `layer` is anything with `spriteFor(id)` returning a sprite with `x`, `y`, `displayWidth`, `displayHeight` (or undefined).
    - Half extents are `max(display / 2 + HIT_PAD_PX, minHalf)`; the largest y wins.
  - [x] 5.2 `SheepHover` and GameScene's `sheepAt` use it with `minHalf` 0 (sheep: bounds + 6 px, UX-DR90). GameScene's `carcassAt` uses it with `minHalf = LAYOUT.hitMin / 2`.
- [x] **Task 6: Carcass sprite and field juice (AC: 2, 3)**
  - [x] 6.1 New `src/view/field/CarcassSprite.ts`, `PooledEntitySprite<Carcass>`, modelled on `FoodSprite` (position set once per binding, `fresh` flag, `reset()` kills tweens):
    - `Sprite` of `FRAME.carcass` from the `sheep-world` atlas at 2× (like sheep).
    - On its first sync: `setDepth(c.y)`, then the flop: start `FLOP.dropPx` (about 12) higher at `angle = FLOP.angle` (about -90, tipped on its side) and tween to (x, y), angle 0 over `FLOP.durationMs` (about 300) with `Bounce.easeOut`.
    - Name the constants (Story 5.7 reduced motion revisits them; this is juice, not gameplay information).
  - [x] 6.2 `GameScene`:
    - `CARCASS_POOL_SIZE = 40` (architecture N3), a `carcassLayer` `EntityLayer` built **before** `sheepLayer`, synced in `render()` from `selectCarcasses`.
    - A `dust` emitter like `poof` (frame `FRAME.dust`, about 8 particles, about 400 ms, spread upward, low gravity, alpha fade), depth `TOOLTIP_DEPTH - 1`.
    - `onSim`: `CarcassSpawned` → `dust.explode(8, x, y)`; `CarcassCleared` → `dust.explode(4, x, y)`.
    - Wire the `carcassAt` hook: `spriteIndexAt(selectCarcasses(this.state), this.carcassLayer, sx + camera.scrollX, sy + camera.scrollY, LAYOUT.hitMin / 2)` → id or 0. The hit test reads the drawn sprites, as `sheepAt` does.
  - [x] 6.3 The sheep sprite still hides at once on death (`playExit`); the carcass flop is the death's slapstick beat. See Open Questions and Task 9.2.
- [x] **Task 7: Art (AC: 2, 3)**
  - [x] 7.1 Placeholder PNGs with a throwaway scratchpad encoder (the 2.1–2.3 pattern); commit only the PNGs:
    - `assets/art/world/carcass.png`, about 32 × 22: a sheep on its back, four legs up, two X eyes, `wool` body with a `bark` outline and `bark` X eyes. No red, no `alert`, no `infection`.
    - `assets/art/world/dust.png`, about 4 × 4: a `wool-shade` puff with a `bark-soft` edge (distinct from the `wool` birth poof).
  - [x] 7.2 Run `npm run assets`. Only the `sheep-world` atlas should change.
  - [x] 7.3 Add `FRAME.carcass` and `FRAME.dust`. Extend the `assets/CREDITS.md` placeholder row.
- [x] **Task 8: Debug overlay**
  - [x] 8.1 `Spawn carcass`: `debugMutate` → `createCarcass` at a `Math.random` spot in the inner fence (the `+5 food` pattern: the seeded rng stream stays untouched). No event, so it flops in on bind without dust.
  - [x] 8.2 `Starve one`: `debugMutate` sets one random living sheep's `fullness` to 0, so the next tick starves it through the real pipeline (toast, carcass, dust; a loss if it was the last). For checking AC 1, 2 and 5 quickly.
  - [x] 8.3 Add both to `simButtons`, and update the header's "Later stories add…" list (2.4's button is here now).
- [x] **Task 9: Bookkeeping**
  - [x] 9.1 `deferred-work.md`: mark resolved in 2.4: **"Pointer input (Story 2.4)"** (idle-mode clicks rebuilt) and the **2.4 part of "Field camera"** (carcass clicks hit-test in world coordinates; 2.7's drag part stays open).
  - [x] 9.2 `deferred-work.md` **"Exit animations (Story 2.4)"**: re-defer to Stories 2.7 / 3.1 (sacrifice suction, sale), noting that 2.4 put the death beat on the carcass's spawn instead, so `playExit()` stays synchronous for now.
  - [x] 9.3 Update the architecture's N1 "Epic 1 staging" line only if Rylan asks; the flag simply reads true now.
- [x] **Task 10: Tests (AC: 1, 3, 4, 7, 8)** (write each to fail first; `TUNING` values only, literal seeds)
  - [x] 10.1 `tests/sim/systems/carcass.test.ts`:
    - Replace "leaves no carcass while carcasses are disabled" with: `TUNING.carcassesEnabled` is true; a death adds one carcass at the sheep's x/y with `createdAt === time` and `id === ` the old `nextId` (and `nextId` advances by 1).
    - Events are exactly `[SheepDied, CarcassSpawned]` for a death, and `[SheepDied, CarcassSpawned, Lost]` for the last sheep (update the existing loss test).
    - The death draws no rng (`state.rng` unchanged).
    - `clearCarcass`: removes exactly that carcass, keeps the others in order, emits `CarcassCleared`; an unknown id, a sheep's id, and a second clear of the same id each change nothing, emit nothing and do not throw.
  - [x] 10.2 `tests/sim/commands.test.ts`: `ClearCarcass` applies; two `ClearCarcass` for one id in one batch remove it once with one event; it is ignored on a lost game.
  - [x] 10.3 `tests/sim/systems/lifecycle.test.ts` (or `hunger.test.ts`): an old-age death and a starvation each leave a carcass at the sheep's last position.
  - [x] 10.4 New scenario `tests/sim/scenarios/carcass.test.ts`: from `newGame(seed)` plus `fillFlock`, starve one sheep (set its Fullness low) while the rest stay fed; after the death there is one carcass; it is still there after a long `runFor` (it never expires); `ClearCarcass` removes it; the state JSON round-trips throughout.
  - [x] 10.5 `tests/sim/selectors.test.ts`: `carcassIndex` and `selectCarcasses` (returns the live array).
  - [x] 10.6 Save:
    - `tests/save/validate.test.ts`: reject a carcass with x or y outside the fence, a fractional, negative or later-than-`time` `createdAt`; accept a valid one (the existing NaN case stays).
    - `tests/save/busy.ts`: add a carcass (via `createCarcass` inside the fence) and have `isBusy` require one.
  - [x] 10.7 Check every test that counts `nextId` or ids across a death (hunger, lifecycle, starvation and lifespan scenarios, `step.test.ts`, `state.test.ts`): a death now consumes an id. Fix test expectations, never the rule.
  - [x] 10.8 Run `npm test`, `npm run typecheck` and `npm run lint` (baseline: 358 tests pass).
- [x] **Task 11: Browser check (AC: 2, 3, 5, 6)**
  - [x] 11.1 Probe with a scratchpad Playwright script (the 2.3 pattern: real mouse and keys; debug buttons through the DOM overlay). Check:
    - **Starvation:** a new game left unfed: the three founders starve together at about 72 s, three "A sheep starved." toasts stack (not one), three carcasses flop in with dust, then the lose screen.
    - **Starve one / Spawn carcass:** one toast, one carcass with the flop and dust; Spawn carcass flops without dust.
    - **Clear:** a left click on a carcass removes it with a small puff; a click on empty field does nothing; a 10 px drag from a carcass does not clear it; a click on a carcass with a sheep standing on it clears it.
    - **Panned camera:** right-drag the pen, then click a carcass: the right one clears.
    - **Breed mode:** a click on a carcass does nothing (breed mode stays); a click on a ready adult still picks.
    - **Modal:** under pause, a click on a carcass does nothing.
    - **Hover:** hovering a carcass shows no tooltip.
    - **Old age:** with the debug clock at ×16, a founder's death reads "A sheep died of old age. A long, full nine minutes."
    - **Reload and Continue:** carcasses are kept and flop in; a version-4 save without carcasses continues.
    - **960 × 540:** toasts and carcasses legible.
    - No console errors or warnings.

### Review Findings

- [x] [Review][Decision] More than 3 deaths on one tick show only 3 toasts — resolved (Rylan): group same-frame deaths of one cause into one toast ("3 sheep starved."); one death keeps "A sheep …". Now a patch below.
- [x] [Review][Patch] Group same-frame deaths by cause into one toast ("{n} sheep starved."), flushed once per frame in HudScene [src/view/scenes/HudScene.ts:230]
- [x] [Review][Patch] Death toasts evict a visible error toast (its 10 s cooldown means it never comes back); evict the oldest announcement, never an error toast [src/view/safetyNet.ts:145]
- [x] [Review][Patch] Death toasts carry into the next game (Lose → Restart within 4 s, debug Load): clear announcement toasts when GameScene starts [src/view/scenes/GameScene.ts:135]
- [x] [Review][Patch] A fast double click on two stacked carcasses clears only one: the second press re-hits the same front-most carcass before the tick removes it; skip carcasses already dispatched for clearing [src/view/scenes/GameScene.ts:215]
- [x] [Review][Patch] killSheep emits SheepDied before creating the carcass; the spec's N1 order is carcass → SheepDied → CarcassSpawned (event order unchanged) [src/sim/systems/carcass.ts:29]
- [x] [Review][Patch] Lifecycle tests take the expected carcass id from the state under test; capture `nextId` before the death, as carcass.test.ts does [tests/sim/systems/lifecycle.test.ts:52]
- [x] [Review][Patch] Debug "Starve one" can silently fail when the picked sheep eats a food piece on the next tick (feeding runs before hunger); also drop its target and set it to wander [src/debug/DebugOverlay.ts:154]
- [x] [Review][Patch] Task 7.1 is checked but the art shows two legs and one wool X eye (side view) instead of four legs and two bark X eyes; record the deviation in the Dev Agent Record [assets/art/world/carcass.png]
- [x] [Review][Defer] The old-age toast's "nine minutes" is copy tied to `TUNING.oldAgeMs` (540 s) by a comment only; a retune leaves it wrong [src/view/strings.ts:12] — deferred, pre-existing (Voice-table copy; revisit in the 3.6 tuning pass)

## Dev Notes

### Current code to build on (read these first)

- **`src/sim/systems/carcass.ts`:** `killSheep` already pushes `{ id, x, y, createdAt }` behind `TUNING.carcassesEnabled` (false), emits `SheepDied`, then runs `checkLastSheepAndLoss`. `killSheep` *replaces* `state.sheep` (callers loop over a captured array).
- **`src/sim/state.ts`:** `Carcass { id, x, y, createdAt }` and `GameState.carcasses` already exist; `createNewGame` sets `[]`.
- **`src/sim/commands.ts`:** `Farm | FarmBreeding | Breed`; `applyCommand` returns early on a lost game. Breed's rule lives in `systems/breeding.ts`; follow the same split (`commands.ts` calls `clearCarcass` in `carcass.ts`).
- **`src/sim/events.ts`:** `SheepDied { id, cause, x, y }` and the per-tick queue. `DeathCause = 'starved' | 'oldAge' | 'virus' | 'abomination'`.
- **`src/sim/selectors.ts`:** `pieceIndex`, `breedingPieceIndex`, `selectFoodPieces` (live array): copy their shape for carcasses.
- **`src/save/validate.ts`:** the carcass loop checks only `claimId` and finite x/y/createdAt. Sheep use `within(…, f.x, f.x + f.width)` on the outer fence `f`; pieces use `inner`.
- **`src/input/InputController.ts`:** the 2.3 click machinery: `clickArmed/clickDownX/clickDownY/clickSheep`, `updateClick` (threshold while held and at `upX/upY`), `cancelClick` on `POINTER_UP_OUTSIDE`/`GAME_OUT`, `cancelPress` on blur/hide, `onPointerDown` arming only in breed mode. Its `mode` is `'idle' | 'breeding'`.
- **`src/view/field/SheepHover.ts`:** `sheepIndexAt` (bounds + 6 px, largest y wins). World point = pointer + camera scroll, **not** `camera.getWorldPoint` (its matrix lags a pan by a frame).
- **`src/view/field/FoodSprite.ts`:** the static pooled sprite with a landing bounce on first sync; the template for `CarcassSprite`.
- **`src/view/scenes/GameScene.ts`:** owns the layers, the `munch`/`poof` emitters, `onSim` (field juice, guarded), the `InputController` hooks and `render()`.
- **`src/view/scenes/HudScene.ts`:** `onSim` already handles `Farmed` popups, guarded; the SHUTDOWN cleanup is in place.
- **`src/view/safetyNet.ts`:** `showToast` is the DOM toast stack (top-centre, 3 max, 4 s, `announcementToast` colours and type, `pointer-events: none`). It **merges identical text**: that is why Task 3.1 adds `merge: false`.
- **`src/debug/DebugOverlay.ts`:** `+5 food` shows the `Math.random`-spot pattern; it already prints "carcasses N".

### What must be preserved

- **N1:** `killSheep` stays the only way a sheep dies; order inside it: remove → `stats.died` → carcass → `SheepDied` → `CarcassSpawned` → loss check.
- **Determinism:** no rng in `createCarcass`, `clearCarcass` or `killSheep`; `createNewGame` unchanged.
- **No allocation** in `step()`, systems, `render()`, `sync()`, `InputController.update()` or the hover on frames with no change. `CarcassSprite.sync` does nothing after its first call. A death or a clear may allocate (rare events).
- **2.3 breed mode:** picking, shaking, A going stale, right-click/Esc/Breed cancels and the exit on a greyed tool all behave exactly as before. The click thresholds and press-point hit test are unchanged.
- **Right-drag pan**, the Esc chain, and modal guards are untouched.
- **Listener cleanup:** no new bus events or listeners are needed (both scenes already listen to `sim`). If you add any, remove them on SHUTDOWN.

### Architecture compliance

- **State and rules:** carcasses are plain records with numeric ids (State Management); `clearCarcass` and `createCarcass` live in `systems/carcass.ts` (System Location Mapping: "Spawn on death, clear, starving-eats-carcass"); the view dispatches `ClearCarcass` and never mutates state.
- **Events:** `CarcassSpawned` is in the architecture's event list; `CarcassCleared` is new, past-tense PascalCase. Both go through the per-tick queue.
- **Input (AR8):** one `InputController`, modes `idle`/`breeding`, click = < 6 px, resolved on release at the press point, world-coordinate hit tests; no `setInteractive` on carcass sprites.
- **Visuals (N3):** a pooled `EntityLayer` for carcasses (pre-sized 40, grows on demand); never `new`/`destroy()` during play. Colours only from `COLORS` and the art; copy only from `strings.ts`.
- **Secrecy (N2):** toasts use the cause only to pick copy; `abomination` maps to the vague line. Carcasses carry no sheep data.
- **Tone (NFR10, UX-DR97):** X-eyes and dust, never red; copy never says "corpse", "blood" or "kill"; no "!".

### Library / framework notes (Phaser 4.2.1, installed)

- Everything needed is already used in the codebase: `tweens.add` with `Bounce.easeOut` (`FoodSprite`), `killTweensOf`, particle emitters with `emitting: false` + `explode(n, x, y)` (`munch`, `poof`), `setAngle`/`angle` tweening (`SheepSprite.shake`). No new APIs and no new dependencies.
- Check anything else against `node_modules/phaser/skills/` (`tweens`, `particles`, `v3-to-v4-migration`), not from memory.

### Testing standards

- Vitest covers `src/sim/` and `src/save/` only: `tests/<same path as src>/`, scenarios in `tests/sim/scenarios/`.
- Use `newGame(seed)`, `runFor`, `fillFlock` and `busyGame`. Assert on state and drained `SimEvent`s with `TUNING` values. No fake timers, no Phaser, no mocking.
- Input, toasts and juice are checked in the browser (Task 11).

### Previous story intelligence

- **2.3:**
  - The click machinery was built so 2.4 could generalise it; review hardened it (press-point hit test, `POINTER_UP_OUTSIDE`/`GAME_OUT` disarm, threshold at release). Keep all of it.
  - Commands apply a tick (up to ~6 frames) after the click, so the view's picture is stale by then: the sim must re-check (`clearCarcass` ignores a missing id).
  - Test the exact boundary and the "no change" cases with `structuredClone` + `toStrictEqual`; review caught tests passing without the code under test.
  - Atlas frames carry a 0.5 pivot; `setFrame(frame, true, false)` if you ever swap frames on an image.
- **2.2/2.3 browser probe:** `playwright-core` from `/home/rylanevans/nr-csp/frontend/node_modules` with `/usr/bin/google-chrome` (SwiftShader), DEV server on its own port (5199 worked). Stop it by the vite node process's PID with `kill <pid>`, never `pkill -f` (it kills the calling shell); the npx wrapper's PID does not stop it.
- `npm run assets` packs deterministically: only the touched atlas changes.
- **Commit style:** `Implement story 2.4: Carcasses and Death Announcements`.

### Deferred work this story touches (`deferred-work.md`)

- **"Pointer input (Story 2.4)":** resolved here (Task 4).
- **"Field camera… 2.4 / 2.7":** the 2.4 half (world-coordinate field clicks) is resolved here; 2.7's drag stays.
- **"Exit animations (Story 2.4)":** re-deferred to 2.7 / 3.1 (Task 9.2), unless Rylan picks the alternative in Open Question 1.

### Out of scope

- **2.5:** starving sheep eating carcasses (`seekCarcass`), infection, the virus toast firing.
- **2.6:** alert pings (on `CarcassSpawned`) and the threat summary's carcass count.
- **2.7:** sheep drag (a moved press from a carcass or sheep stays a no-op here), `removeSheep`.
- **4.3:** Abomination victims (the vague toast string exists, nothing fires it).
- **5.3:** names in toasts (`halo` name colour).
- **5.6:** "baa-thud" SFX and the `[thud]` caption (UX-DR79, UX-DR88).
- **5.7:** reduced motion for the flop and dust (named constants only).
- A hand cursor over carcasses is not specified anywhere; do not add one.

### Open questions (defaults chosen; confirm or change)

1. **Where the slapstick lives:** default, the carcass sprite flops in (tips over and bounces) with a dust puff, and the living sheep sprite hides at once. The alternative is the architecture's `playExit(done)`: the sheep sprite plays a tip-over before release and the carcass appears after it, which changes `EntityLayer`'s sweep and every pooled sprite.
2. **Carcass clicks in breed mode:** default, ignored (breed mode only picks sheep; the carcass can be cleared after). The alternative is clearing it when no sheep is under the click.
3. **Toast merging:** default, every death gets its own toast (up to 3 at once). The alternative keeps today's merge, which would show one "A sheep starved." for a whole flock dying on one tick.
4. **`CarcassCleared` puff** [ASSUMPTION]: no spec names clear feedback; a small dust puff confirms the click. Drop it if it reads as noise.

### Project Structure Notes

- New files:
  - `src/view/field/CarcassSprite.ts`
  - `src/view/field/hitTest.ts` (the generic hit test moved out of `SheepHover.ts`)
  - `tests/sim/scenarios/carcass.test.ts`
  - `assets/art/world/carcass.png`, `assets/art/world/dust.png`
- All other changes are to existing files; paths follow the architecture's directory structure (`view/field/CarcassSprite` is named there).

### Project Context Rules (from `_bmad-output/project-context.md`)

- Phaser 4, not 3. Game logic only in `src/sim/`; no `Math.random`/`Date.now` in the sim (debug's `Math.random` spots are view-side).
- **Every non-sacrifice death goes through `killSheep(state, id, cause)`** (spawns a carcass). Never splice `state.sheep` anywhere else.
- **New `Command`** → `sim/commands.ts`; **new `SimEvent`** → `sim/events.ts`; `switch`es over either end with `assertNever`.
- **Input:** a single `InputController`, world-coordinate field hit tests, click vs drag = 6 px, shortcuts and clicks ignored under a modal; no `setInteractive` on field sprites.
- **Pooling:** carcasses come from a pool pre-sized 40 that grows on demand; never `new`/`destroy()` sprites during play.
- **Timers:** none here; a carcass has no expiry (it stays until clicked).
- **UX:** colours from `COLORS`, copy from `strings.ts`; never "corpse", "blood" or "kill"; no "!" except "Last sheep!"; death is X-eyes and a dust puff, never gore.
- **Save:** a new or changed field needs a schema bump and migration; this story changes no field shape, only tightens validation.
- Done = `npm test`, `npm run typecheck` and `npm run lint` pass; visuals verified in the browser.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.4; FR12, FR13; NFR10; AR17, AR19; UX-DR41, UX-DR59, UX-DR65, UX-DR79, UX-DR90, UX-DR92, UX-DR97]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-sheep-civilization-2026-10-05/EXPERIENCE.md: Voice and Tone (death toasts), Component Patterns (announcement toast), State Patterns (Carcass), Interaction Primitives (Click, Drag vs click), Game Feel & Juice (Death); DESIGN.md: announcement-toast, Do's and Don'ts (X-eyes and a dust puff), Layout (toasts top-centre)]
- [Source: _bmad-output/game-architecture.md: N1 Single Death Pipeline, N3 Sprite ↔ Entity Reconciliation, Event System, Input Handling, Entity Patterns (`createCarcass`), System Location Mapping, Debug Tools (spawn carcass)]
- [Source: _bmad-output/implementation-artifacts/2-3-breed-two-adults.md; 1-7-drop-food-and-sheep-eat.md Task 9; deferred-work.md]
- [Source: _bmad-output/project-context.md]

## Dev Agent Record

### Agent Model Used

Claude Opus 5.5 (1M context), `claude-opus-5-5[1m]`

### Implementation Plan

- **Sim:**
  - `TUNING.carcassesEnabled` is true.
  - `carcass.ts` gains `createCarcass` (no rng, no event) and `clearCarcass` (splices; an id that is not a carcass is a silent no-op).
  - `killSheep` emits `SheepDied`, then `CarcassSpawned`, then the loss check.
  - New `ClearCarcass` command; new `CarcassSpawned` and `CarcassCleared` events.
  - Selectors: `carcassIndex`, plus `selectCarcasses` (returns the live array).
- **Save:** carcass x/y must lie inside the fence, and `createdAt` must be an integer in [0, time]. No schema bump.
- **Toasts:**
  - `showToast(text, { announcement })` reuses the DOM stack. An announcement never merges, and a full stack evicts the oldest announcement before any error toast. `clearAnnouncements()` runs when a game starts.
  - `STRINGS.deathToast(cause, n)` gives "A sheep starved." for one death or "3 sheep starved." for several.
  - `HudScene` counts `SheepDied` per cause and shows one toast per cause per frame (code review decision).
- **Input:**
  - The 2.3 click now arms in both modes. It records the press mode and the target hit-tested at the press: a carcass in `idle`, a sheep in `breeding`.
  - It disarms if the mode changes before release, and resolves through a `switch` ending in `assertNever`.
  - `idle` dispatches `ClearCarcass`.
- **View:**
  - `spriteIndexAt` (new `view/field/hitTest.ts`) replaces `sheepIndexAt`; its `minHalf` gives carcasses the 40 px `hit-min`.
  - `CarcassSprite` flops in on bind: tipped -90°, 12 px up, falling to rest with `Bounce.easeOut` over 300 ms.
  - `GameScene` gets a carcass layer (pool 40, synced before food and sheep), a `dust` emitter for `CarcassSpawned` (8 puffs) and `CarcassCleared` (4 puffs), and the `carcassAt` hook.
- **Art:**
  - `carcass` (the adult flipped onto its back, legs up, a wool X eye on the dark face) and `dust` (wool-shade with a bark-soft edge).
  - Debug gains **Spawn carcass** and **Starve one**.

### Debug Log References

- **Red phase:** 114 tests failed first, most of them through the busy fixture's missing `createCarcass`. Then 8 existing tests whose expected event lists now include `CarcassSpawned`; those were updated (test expectations only).
- **Browser probe:** a scratchpad `playwright-core` script (from nr-csp), system Chrome with SwiftShader, DEV server on port 5199, real mouse and keys, game state read through the debug overlay's Dump state. All checks passed with no console errors or warnings:
  - **Starve one:** "A sheep starved." toast top-centre; the carcass (legs up, X eye) flops in with dust at the sheep's spot.
  - **Clear:**
    - A click clears with a small puff.
    - A 10 px drag and an empty-field click keep the carcass.
    - A carcass under a resting sheep clears, and the sheep stays.
  - **Breed mode:** a carcass click does nothing and the mode stays (pulsing hearts).
  - **Pause:** a click under the scrim does nothing.
  - **Pan:** after a right-drag, the carcass clears at its new screen spot, not the old one.
  - **Hover:** no tooltip over a carcass.
  - **Unfed new game:** at 1:12 three "A sheep starved." toasts stack (not merged) over the lose screen.
  - **Old age** (planted save, elder 1.5 s from 540 s): "A sheep died of old age. A long, full nine minutes."
  - **Reload and Continue:** saved carcasses flop back in.
  - **960×540:** legible.
- **Tuning:** the first dust puff hid over the carcass's light body, so `DUST` is faster and wider (60–120 px/s, 160–380°).
- **False alarm, not a bug:** a probe click meant for the scrim landed on the pause menu's Volume button, so the next Esc closed the sub-panel. The baseline build behaves the same.

### Completion Notes List

- 2026-10-07: Story created; the context engine analysis is complete, and this is the developer guide.
- Open questions are implemented at their defaults:
  - the carcass flop carries the slapstick, and `playExit` stays synchronous (re-deferred to 2.7/3.1);
  - breed mode ignores carcasses;
  - every death gets its own toast;
  - a small puff plays on clear.
- AC 1: `killSheep` leaves a carcass (next id, `createdAt` = time, no rng) and emits `SheepDied` → `CarcassSpawned` → `Lost`. Unit tests (carcass, hunger, lifecycle, step) and the scenario.
- AC 2: X-eyes art, the spawn flop, dust on `CarcassSpawned`, depth = y; loaded carcasses flop without dust. Browser.
- AC 3: `idle` clicks hit-test the press point in world coordinates, with bounds + 6 px and at least 40 px. The front-most carcass wins, even under a sheep. Drags, empty field, the bar, HUD controls and modals do nothing. Browser; the command is unit-tested.
- AC 4: `ClearCarcass` on a missing or sheep id, a double clear in one batch, and a lost game each change nothing. Unit tests.
- AC 5: death toasts by cause, never merged, 3 max, about 4 s, not blocking clicks. Browser.
- AC 6: no tooltip over a carcass. Browser.
- AC 7: tighter carcass validation (7 new reject cases); the busy fixture holds a carcass; no schema bump. Tests.
- AC 8: `npm test` (377 passed), `npm run typecheck` and `npm run lint` are clean.
- `deferred-work.md` updates:
  - "Pointer input" and the 2.4 half of "Field camera" are resolved;
  - "Exit animations" is moved to 2.7/3.1.
- Task 9.3: the architecture was left unchanged (nobody asked for an update).
- **Art (Task 7.1 deviation):** the placeholder carcass is the adult art flipped onto its back. Seen side-on, it shows two legs and one X eye, drawn in `wool` on the dark face so it reads. The task asked for four legs and two `bark` X eyes. The tone rules hold: no red, no `alert`, no `infection`.
- **Code review (2026-10-07):** 3 layers (Blind Hunter, Edge Case Hunter, Acceptance Auditor).
  - Totals: 1 decision, 8 patches applied, 1 deferred, 5 dismissed.
  - **Decision (Rylan):** same-frame deaths of one cause are grouped into one toast ("3 sheep starved."). This replaces AC 5's "every death gets its own toast", which the 3-toast stack could not honour beyond 3 deaths.
  - **Patches:**
    - death toasts no longer push out an error toast;
    - toasts are cleared when a game starts;
    - a fast double click clears two stacked carcasses (`carcassAt` skips carcasses already queued for clearing);
    - `killSheep` creates the carcass before `SheepDied` (event order unchanged);
    - the lifecycle tests capture `nextId` before the death;
    - debug Starve one also stops walking to food;
    - the art deviation is noted above.
  - **Dismissed:**
    - a stale sprite on in-place state replacement (loads always restart the scene);
    - the flop-time hit-box offset (covered by the 40 px minimum);
    - the rng identity test (rng is a number);
    - an integer `createdAt` (time is whole ticks);
    - one comment finding, folded into the decision.
  - **Deferred:** the old-age copy is tied to `oldAgeMs` only by a comment (3.6).
  - **Verification:** tests (377), typecheck and lint are clean. Re-checked in the browser:
    - an unfed flock of 13 shows "10 sheep starved." and "3 sheep starved.";
    - Lose → Restart clears the toasts;
    - a double click on two stacked carcasses clears both.

### File List

- `src/config/tuning.ts`, `src/sim/state.ts`, `src/sim/commands.ts`, `src/sim/events.ts`, `src/sim/selectors.ts`, `src/sim/systems/carcass.ts` (modified)
- `src/save/validate.ts` (modified)
- `src/input/InputController.ts` (modified)
- `src/view/safetyNet.ts`, `src/view/strings.ts`, `src/view/assetKeys.ts` (modified)
- `src/view/scenes/GameScene.ts`, `src/view/scenes/HudScene.ts`, `src/view/field/SheepHover.ts` (modified)
- `src/view/field/CarcassSprite.ts`, `src/view/field/hitTest.ts` (new)
- `src/debug/DebugOverlay.ts` (modified)
- `assets/art/world/carcass.png`, `assets/art/world/dust.png` (new)
- `public/assets/atlases/sheep-world.{png,json}` (regenerated)
- `assets/CREDITS.md` (modified)
- `tests/sim/scenarios/carcass.test.ts` (new)
- `tests/sim/systems/carcass.test.ts`, `tests/sim/systems/hunger.test.ts`, `tests/sim/systems/lifecycle.test.ts`, `tests/sim/step.test.ts`, `tests/sim/scenarios/lifespan.test.ts`, `tests/sim/commands.test.ts`, `tests/sim/selectors.test.ts` (modified)
- `tests/save/busy.ts`, `tests/save/validate.test.ts` (modified)
- `_bmad-output/implementation-artifacts/2-4-carcasses-and-death-announcements.md` (new)
- `_bmad-output/implementation-artifacts/sprint-status.yaml`, `_bmad-output/implementation-artifacts/deferred-work.md` (modified)

### Change Log

- 2026-10-07: Implemented carcasses and death announcements:
  - carcasses on every death, with the `ClearCarcass` command and the `CarcassSpawned`/`CarcassCleared` events;
  - idle-mode field clicks;
  - the shared hit test;
  - `CarcassSprite` with the flop and dust;
  - unmerged death toasts;
  - tighter carcass save validation;
  - the debug Spawn carcass and Starve one buttons.
  
  Status → review.
- 2026-10-07: Code review: grouped same-frame death toasts (Rylan's decision) and 8 patches applied. Status → done.
