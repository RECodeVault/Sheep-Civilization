---
baseline_commit: 29a43ad348d7037a766ea5c41edeb4bd110d3d4a
---

# Story 2.3: Breed Two Adults

Status: done

<!-- Created 2026-10-07 by create-story. Builds on 2.2 (breeding bar, breeding pieces, breedReady, ready heart). -->

## Story

As a player,
I want to pick two ready adults with a Breed tool to make a lamb,
so that I can grow my flock.

## Acceptance Criteria

1. **Breed tool (UX-DR31, UX-DR75).** Given the bottom bar, when it renders, then a Breed tool sits right of the Farm Breeding Food group.
   - It uses `button-breed-tool`: `wool` fill, `heart-deep` border, a heart icon left of the label "Breed", 56 px tall, 104 px wide (mockups/hud.html `.btn-breed`), and vertically centred in the 112 px bar.
   - It has no key hint and no keyboard shortcut.
   - Its tooltip reads "Breed: pick two adults".
2. **Greyed (FR11, UX-DR31, UX-DR32, AR21).** Given living sheep + `state.pregnancies.length` ≥ capacity (`TUNING.baseCapacity` = 10 until Land, Story 3.3), or fewer than 2 **eligible** adults (adult stage, `breedReady`, not on cooldown), when the HUD renders, then:
   - Breed uses `button-disabled` (flat `disabled` fill, `disabled-ink` label, no drop offset), stays readable and is never hidden.
   - Its tooltip gives the reason: "No room. Buy land." (capacity; it wins when both apply) or "Needs 2 ready sheep.".
   - Hovering a greyed Breed shows that reason tooltip after the usual delay. Clicking it does nothing.
   - Capacity and the reason come from selectors, never stored.
3. **Enter breed mode (UX-DR31, UX-DR69, AR8).** Given an enabled Breed, when I left-click it, then `InputController` enters `breeding` mode:
   - The button shows its active look: `heart-deep` fill with a `wool` label (and a `wool` heart icon).
   - The canvas cursor becomes a heart (a CSS image cursor), except over HUD buttons, which keep the hand.
   - Every eligible adult shows a soft breed-mode marker: its ready heart gently pulses. Lambs, elders, adults that are not ready and adults on cooldown get no marker.
4. **Pick a pair (FR9, UX-DR56, UX-DR70, UX-DR82).** Given breeding mode, when I left-click eligible adult A, then a pinned heart appears above A (a larger heart than the ready heart, bobbing gently). When I then left-click a different eligible adult B:
   - A `Breed { a, b }` command is dispatched and breed mode exits at once (cursor, button and markers return to normal).
   - On the next tick the sim clears both sheep's `breedReady`, sets both `cooldownUntil = time + TUNING.breedCooldownMs` (60 s), pushes a pregnancy `{ id, parentA, parentB, dueAt: time + TUNING.gestationMs, x, y }` (x, y = the parents' midpoint, clamped to the inner fence) and emits `Bred`.
   - A heart pops in and floats between the two parents (following their midpoint while both live, else staying at the pregnancy's spot) until the birth.
   - `TUNING.gestationMs` (10 s) later a lamb (`bornAt = time`) is born at the living parents' midpoint (or the stored spot if both are gone), clamped to the inner fence, with a small poof; the sim emits `LambBorn`.
   - Breeding costs nothing else (FR9).
5. **Invalid picks (UX-DR70).** Given breeding mode:
   - Clicking an ineligible sheep (lamb, elder, not ready, on cooldown) shakes it briefly and keeps breed mode, and A stays pinned.
   - Clicking A again does nothing.
   - Clicking empty field does nothing (no food, no shake).
   - If A stops being eligible before B is picked (turned elder, died, cooldown, readiness gone), its pinned heart is dropped and breed mode stays active, waiting for a new A.
   - Clicks are resolved like 2.4's planned clicks: a left press on the field that moves no more than 6 px before release is a click, hit-tested in world coordinates at the press point with `sheepIndexAt`. A left press on the bottom bar, or while the pointer is on a HUD control, is not a field click.
6. **Cancel (UX-DR71, UX-DR73, UX-DR74, AR8).** Given breeding mode, then each of these exits it, clearing A:
   - a right-click: a right press and release that never passes 6 px, anywhere on the canvas. A right-drag still pans and does not cancel.
   - `Esc`, at its agreed chain position: confirm → sub-panel → (2.7 drag) → **exit breed mode** → (3.2 shop) → pause. An `Esc` that exits breed mode does not also open pause.
   - clicking Breed again.
   - Breed becoming greyed (AC 2), for example when the last free slot is taken or a pick leaves fewer than 2 eligible adults.
   - any modal opening (pause button, lose screen) or the game restarting.
7. **Cooldown (FR10, UX-DR43, UX-DR58).** Given a parent that bred, then until `state.time >= cooldownUntil`:
   - it cannot be paired: the view treats it as ineligible, and the sim's `Breed` refuses it;
   - it does not seek or eat breeding pieces (the 2.2 hook in `mayEatBreedingFood`);
   - its hover tooltip shows a heart-outline icon in `heart` after the "{Stage} · {Hunger}" line. No icon shows off cooldown, and none in breed mode or elsewhere.
8. **Sim authority (AR3, FR11).** `Breed` is ignored, with no state change and no event, unless:
   - `a !== b` and both sheep exist;
   - both are adults, `breedReady` and off cooldown;
   - living sheep + pregnancies < capacity;
   - the game is not lost.

   A pending lamb takes a capacity slot from the moment of breeding.
9. **Save (AR9, NFR6, NFR7).** `SAVE_SCHEMA_VERSION` is 4. A version-3 save migrates with `cooldownUntil: 0` on every sheep and `pregnancies: []`. Validation rejects:
   - a non-finite or negative `cooldownUntil`, or one later than `time + breedCooldownMs`;
   - a pregnancy with a bad or duplicate id (shared id set), non-integer parent ids ≥ 1, a non-finite `dueAt` or one later than `time + gestationMs`, or x/y outside the inner fence.

   Parent ids that no longer exist are valid: a parent may die while its lamb is on the way. The round-trip and corrupt-save tests stay green.
10. `npm test`, `npm run typecheck` and `npm run lint` all pass.

## Tasks / Subtasks

- [x] **Task 1: Tuning, state and selectors (AC: 2, 4, 7, 8)**
  - [x] 1.1 `TUNING`:
    - `breedCooldownMs: 60_000` (FR10, "tune")
    - `gestationMs: 10_000` (FR9)
    - `baseCapacity: 10` (GDD Economy: capacity 10 before Land I; Story 3.3 adds the land tiers)

    Each gets a comment citing its FR/GDD line.
  - [x] 1.2 `Sheep.cooldownUntil: number`: a game-ms deadline, 0 = never bred. `createSheep` sets 0; this does not change the rng call sequence.
  - [x] 1.3 `export interface Pregnancy { id: number; parentA: number; parentB: number; dueAt: number; x: number; y: number }` and `GameState.pregnancies: Pregnancy[]`. `createNewGame` sets `[]` (after `breedingPieces`) with no rng calls.
    - The `id` (from `nextId`) is an addition to the architecture's shape: N3 reconciles view objects by id.
  - [x] 1.4 `selectors.ts` (all derived, never stored):
    - `capacity(state)` returns `TUNING.baseCapacity`.
    - `slotsUsed(state)` returns `state.sheep.length + state.pregnancies.length` (AR21).
    - `onCooldown(s, state)` returns `state.time < s.cooldownUntil`.
    - `canBreed(s, state)` returns `s.breedReady && stageOf(s, state) === 'adult' && !onCooldown(s, state)`. This is the one eligibility rule, used by the sim's `Breed` and through `PublicSheep` by the view.
    - `breedBlock(state)` returns `'capacity' | 'notReady' | null`. Capacity wins. "Not ready" means fewer than 2 sheep pass `canBreed`. It is a plain loop with no allocation.
  - [x] 1.5 `PublicSheep`: add `onCooldown: boolean` and `canBreed: boolean`. Fill both in `publicSheep`, in `selectPublicSheep` and in its reuse-object literal.
    - Neither is secret: the Abomination (4.1) stays a lamb, so it is never ready and never bred.
  - [x] 1.6 `selectPregnancies(state, out: PublicPregnancy[])` fills `{ id, x, y }` in place, reusing `out`'s objects like `selectPublicSheep`.
    - x, y = the midpoint of the parents that are still alive (one parent: that parent's spot), else the stored x, y.
    - Use a plain id loop (`sheepIndex(state, id)` helper, like `pieceIndex`); no `find`, no closures.
  - [x] 1.7 `HudView`: add `breedBlock: 'capacity' | 'notReady' | null`, filled by `selectHudView`. Update `HudScene`'s initial `view` literal.
- [x] **Task 2: Breed command and events (AC: 4, 8)**
  - [x] 2.1 Add `{ type: 'Breed'; a: number; b: number }` to the `Command` union and its `case` in `applyCommand`. The `assertNever` default stays.
  - [x] 2.2 Write `breed(state, a, b)` in **`src/sim/systems/breeding.ts`** (architecture System Location Mapping: pair validation, cooldown, capacity). `commands.ts` calls it, as `farm` calls `createFoodPiece`. It:
    - validates per AC 8 (look sheep up by id with a plain loop);
    - sets `breedReady = false` and `cooldownUntil = time + breedCooldownMs` on both;
    - computes the midpoint and clamps it to `innerFence`;
    - pushes `{ id: nextId(state), parentA: a, parentB: b, dueAt: time + gestationMs, x, y }`;
    - emits `Bred { pregnancyId, parentA, parentB, x, y }`.

    No rng draw. If either parent is walking to a breeding piece (impossible, since ready sheep do not seek, but a corrupt save could), leave it: feeding releases a claim once `canUseBreedingFood` fails.
  - [x] 2.3 `events.ts`: add `Bred { pregnancyId; parentA; parentB; x; y }` and `LambBorn { id; pregnancyId; x; y }`, and update the header's variant list. `LambBorn` is the hook Story 4.1 spawns the Abomination from; leave a comment.
- [x] **Task 3: Gestation and birth in lifecycle (AC: 4)**
  - [x] 3.1 In `updateLifecycle`, **before** the ageing/old-age loop, run births:
    - Every pregnancy with `state.time >= dueAt` is born. `createSheep(state, { x, y, bornAt: state.time })` at the living parents' midpoint (else the stored spot), clamped to `innerFence`.
    - Remove the pregnancy and emit `LambBorn`.
    - Iterate the pregnancies array backwards, or rebuild it only when a birth happens; births are rare events, so a `splice` is fine. Nothing may allocate on ticks with no birth.
    - Births run first so that a lamb due on the tick the last adult dies of old age keeps the flock alive. The ageing loop then captures `state.sheep` after the births: a newborn is age 0, so it does nothing there.
  - [x] 3.2 Update the lifecycle header comment: gestation and birth are here now; doomedAt is still 4.3.
  - [x] 3.3 A pregnancy whose parents have both died is still born (it already holds a capacity slot). If the flock reaches 0 first, the game is lost (FR38 unchanged: loss = 0 living sheep) and the sim stops, so the pending lamb is never born. See Open Questions.
- [x] **Task 4: Feeding cooldown hook (AC: 7)**
  - [x] 4.1 In `feeding.ts`, `canUseBreedingFood` becomes `!s.breedReady && stageOf(...) === 'adult' && state.time >= s.cooldownUntil`. That covers both the claim (`mayEatBreedingFood`) and the in-flight release. Replace the 2.2 hook comment ("Story 2.3 adds…").
- [x] **Task 5: Save schema 4 (AC: 9)**
  - [x] 5.1 `SAVE_SCHEMA_VERSION = 4`, with a comment in `constants.ts`: "4 since Story 2.3: sheep `cooldownUntil` and `pregnancies`".
  - [x] 5.2 `MIGRATIONS[3]` adds `pregnancies: []` and `cooldownUntil: 0` on every sheep, mapping `sheep` defensively exactly like `MIGRATIONS[2]`.
  - [x] 5.3 `validate.ts`:
    - Each sheep's `cooldownUntil` is finite, `>= 0` and `<= time + TUNING.breedCooldownMs`.
    - `pregnancies` is an array of objects. For each one: `claimId`; `int(parentA|parentB, 1)`; `dueAt` finite and `<= time + gestationMs`; x/y inside `inner` (it is clamped there).
    - Do **not** validate capacity: debug "+10 sheep" can legally exceed it.
- [x] **Task 6: Button widget gaps (deferred from 1.6; AC: 1, 2, 3)** in `src/view/widgets/Button.ts`:
  - [x] 6.1 **Disabled tooltip:** a disabled button still starts `hoverSinceMs` on over (only presses are refused), so HudScene can show the reason. `onOver`'s `this.enabled &&` check goes; `setEnabled(false)` keeps the hover time if hovered.
  - [x] 6.2 **Changeable tooltip:** `tooltip` becomes a getter backed by a private field, with `setTooltip(text)`. HudScene's `updateTooltip` must re-`setText` when the hovered button's text changes (cache the shown string, not just the button).
  - [x] 6.3 **Re-enabled under the pointer:** `setEnabled(true)` while hovered sets `hoverSinceMs` if it is -1, so the tooltip comes back without leaving and re-entering.
  - [x] 6.4 **Cursor while hovered:** when the enabled state changes under the pointer, also set the live canvas cursor (`scene.input.manager.canvas.style.cursor`, or `setCursor`/`resetCursor` on the zone's interactive object), not just `zone.input.cursor`.
  - [x] 6.5 **Active visual:** an optional toggled state, `setToggled(on: boolean)` (not `setActive`, which reads like Phaser's GameObject method), using the spec's `activeBackgroundColor`/`activeTextColor`. Disabled wins over toggled.
    - Extend `ButtonSpec` with the two optional fields, and add a baked `active` texture only when the spec has them.
  - [x] 6.6 **Icon:** an optional `icon` (a `ui` atlas frame) drawn left of the label, with `SPACING[2]` gap. It takes the label colour per state (tint it, or use two frames; see Task 8).
  - [x] 6.7 **F path:** `HudScene.farm`/`farmBreeding` return early when their button is not enabled. They are always enabled today, but the check is cheap and closes the gap.
- [x] **Task 7: Input: breed mode in InputController (AC: 3–6)**
  - [x] 7.1 Add a mode: `private mode: 'idle' | 'breeding' = 'idle'`, `private pickA = 0`. Public:
    - `get breeding(): boolean` and `get pickedA(): number`;
    - `toggleBreedMode()`;
    - `exitBreedMode(): boolean`, which returns true if it was active (the Esc step).
  - [x] 7.2 Extend `InputHooks`:
    - `sheepAt(screenX, screenY): number` returns the id of the front-most sheep, or 0. GameScene implements it with `sheepIndexAt` on `pointer + camera.scroll`, the same world mapping as `SheepHover`.
    - `canBreed(id): boolean` reads the frame's `PublicSheep.canBreed`.
    - `dispatch(cmd)`.
    - `pointerOnHud(): boolean`, the existing `pointerOnHudControl`.
    - `onBreedModeChanged(active, pickedA)`, so GameScene and HudScene update visuals.
  - [x] 7.3 **Left click in breeding mode:**
    - On `pointerdown`, if the left button is down, the mode is breeding, `y < FIELD_BOTTOM`, there is no modal and `!pointerOnHud()`: arm and record the down point.
    - In `update()`, follow `activePointer` like the pan does. Track the maximum distance; past 6 px, disarm (no drag behaviour in 2.3). On release (`!leftButtonDown()`), resolve at the **down** point.
    - Resolution:
      - id 0: nothing;
      - `!canBreed(id)`: emit a shake (the hook, or `bus.emit('sheep:shake', id)`);
      - id === A: nothing;
      - no A: pin A;
      - otherwise dispatch `{ type: 'Breed', a: A, b: id }` and exit.
    - `pointerupoutside` / `GAME_OUT` / blur / modal disarm, like `cancelPan`. Reuse its shape: a `cancelClick()` called from `onBlur`/`onHidden` too.
    - Keep allocation out of `update()`. The Breed command object is created per pair, which is a rare event and fine.
  - [x] 7.4 **Right click cancels:**
    - `onPointerDown` now arms a right press anywhere on the canvas when not under a modal. It records whether the press began on the field: only a field press may pan.
    - In `update()`, where the release without passing the threshold is detected (the marked "Story 2.3" comment), call `exitBreedMode()`.
  - [x] 7.5 **A goes stale:** each frame in `update()`, if `pickA !== 0 && !canBreed(pickA)` (this also covers a dead A, since `canBreed` of a missing id is false), unpin it and notify.
  - [x] 7.6 Update the class header comment (2.3 adds breed mode; 2.4 idle clicks; 2.7 drag).
- [x] **Task 8: Art (AC: 1, 3, 4, 7)**
  - [x] 8.1 Placeholder PNGs, drawn with a throwaway scratchpad encoder (the 2.1/2.2 pattern); commit only the PNGs:
    - `assets/art/ui/icon-heart.png`: about 9×8, a `heart-deep` heart. For the active state, either tint it `wool` at runtime (UI icon tint is fine; the "tint = infection" rule is about sheep) or add `icon-heart-active.png` in `wool`.
    - `assets/art/world/heart-outline.png`: about 7×6, a `heart` outline with a transparent centre, for the cooldown tooltip icon.
    - `assets/art/world/breed-heart.png`: about 9×8, a `heart` fill with a `bark` outline. Use it for the pinned heart over A and the pregnancy heart (shown at 2×; pinned and pregnancy may share it).
    - `assets/art/world/poof.png`: about 4×4, a `wool` puff, for the birth particles.
    - `assets/cursors/heart.png`: a 32×32 heart cursor (16×16 art at 2×) in `heart` with a `bark` outline, hotspot at the centre.
  - [x] 8.2 Extend `scripts/build-assets.ts` to copy `assets/cursors/*.png` to `public/assets/cursors/` (with the same prune as fonts), then run `npm run assets`. Only the `ui` and `sheep-world` atlases plus the cursor should change.
  - [x] 8.3 Add `FRAME.iconHeart`, `FRAME.heartOutline`, `FRAME.breedHeart` and `FRAME.poof`. Add a cursor URL helper beside `atlasUrls` (relative, no leading slash): `'url(assets/cursors/heart.png) 16 16, pointer'`. Extend the `assets/CREDITS.md` placeholder row.
- [x] **Task 9: HUD (AC: 1, 2, 3, 6)**
  - [x] 9.1 `BottomBar`: add `breedButton: Button`.
    - Spec: `COMPONENTS.buttonBreedTool` (add `typography: 'label'` to it if `ButtonSpec` needs it; DESIGN lists none, so `label` like the other HUD buttons).
    - `x = BREED_FOOD_X + Math.max(BREED_FOOD_W, FARM_PROGRESS_W) + GROUP_GAP`, `y = BAR_TOP + (hudBarHeight − 56) / 2`, width 104, label `STRINGS.breedLabel`, icon `FRAME.iconHeart`.
    - `activateOn: 'press'`, like Farm.
  - [x] 9.2 `STRINGS`:
    - `breedLabel: 'Breed'`
    - `breedTooltip: 'Breed: pick two adults'`
    - `breedNoRoom: 'No room. Buy land.'`
    - `breedNotReady: 'Needs 2 ready sheep.'`

    Cite UX-DR75/UX-DR96 in a comment.
  - [x] 9.3 `HudScene`:
    - **Click:** the Breed click emits `bus.emit('breedTool:pressed')`. Add it to the `BusEvents` map. InputController listens and calls `toggleBreedMode()`, and cleans up in `destroy()`.
    - **Each frame in `refresh`:** `breedButton.setEnabled(v.breedBlock === null)` and `setTooltip(…)` by reason; both are no-ops when nothing changed.
    - **Active look:** set from a `breedMode:changed` bus event (`{ active: boolean }`), emitted by InputController, never by reading GameScene internals.
    - **Hover wiring:** add the button to `tooltipButtons`, `pointerOverControl` and the modal `clearHover` list.
- [x] **Task 10: Field visuals in GameScene (AC: 3, 4, 5, 6, 7)**
  - [x] 10.1 **Esc chain:** insert `() => input.exitBreedMode()` after `closeSubPanel` and before `togglePause`. Update the comment, since 2.7's drag and 3.2's shop still slot in around it.
  - [x] 10.2 **Exit on block or modal:** in `update()`, after `render()`, exit breed mode when `breedBlock(this.state) !== null` or `this.modalOpen`. Call `exitBreedMode()`; it is a no-op when idle.
  - [x] 10.3 **Cursor:** on `breedMode:changed`, `this.input.manager.setDefaultCursor(active ? HEART_CURSOR : '')`. Reset it to `''` on SHUTDOWN, so the title screen never keeps a heart.
  - [x] 10.4 **Breed-mode markers on `SheepSprite`:**
    - Add `setBreedMarker(mode: 'none' | 'candidate' | 'pinned')`, called from `render()` per sheep: `pinned` for A, `candidate` for any other `canBreed` sheep while breeding, else `none`. Change-only, like `shownReady`.
    - **`candidate`:** a looping scale pulse tween on the ready heart, 1 → 1.3 → 1, about 600 ms yoyo.
    - **`pinned`:** a second owned `Image` (`FRAME.breedHeart`, created once in the constructor, depth `READY_DEPTH`), bobbing above the ready heart, which hides while pinned.
    - Kill the tweens and reset scale in `reset()`. No per-frame tween creation.
  - [x] 10.5 **Shake:** `SheepSprite.shake()` is a short angle wobble tween (±10°, 3 yoyos, about 240 ms; it does not touch position, which `sync` owns). It is triggered from InputController via the hook. Kill it in `reset()`.
  - [x] 10.6 **Pregnancy hearts:**
    - A new `src/view/field/PregnancyHeart.ts` implements `PooledEntitySprite<PublicPregnancy>`: an `Image` of `FRAME.breedHeart` at 2×, depth `READY_DEPTH`.
    - It pops in (scale 0 → 1, about 200 ms, `Back.easeOut`) on bind, then bobs (y offset tween), following the selector's x, y minus about 30 px each frame. Only reposition on change.
    - Add a third `EntityLayer` (pool 10, `PREGNANCY_POOL_SIZE`, grows on demand), synced in `render()` from `selectPregnancies` into a reused array field.
  - [x] 10.7 **Birth poof:** on `LambBorn`, explode about 8 `FRAME.poof` particles at x, y. Use a second emitter like `munch` (`wool`-coloured art, spread 0–360°, low gravity, about 400 ms). Extend `onSim`'s type check.
  - [x] 10.8 **Hooks:** wire `sheepAt`, `canBreed` (look up `this.publicSheep` by id with a plain loop), `dispatch`, `pointerOnHud` and `onBreedModeChanged` into the `InputController` constructor.
- [x] **Task 11: Tooltip cooldown icon (AC: 7)**
  - [x] 11.1 `Tooltip` gains `setIcon(frame: string | null)`:
    - one owned `Image` (`sheep-world` atlas), `setScrollFactor(0)`, placed after the last text line with `SPACING[1]` gap, with the box width grown to fit;
    - redrawn only on change, like `setText`;
    - `hide()` hides it.
  - [x] 11.2 `SheepHover` caches `shownCooldown` beside stage/hunger, and calls `setIcon(pub.onCooldown ? FRAME.heartOutline : null)` on change.
- [x] **Task 12: Debug overlay**
  - [x] 12.1 Add a `Ready adults` button: `debugMutate` sets `breedReady = true` and `cooldownUntil = 0` on every adult. Add it to `simButtons`.
  - [x] 12.2 Update the "Feed all" comment: births exist now, so a long run no longer has to end at 420 s. In `deferred-work.md`, mark the 2.1 item "Long dev runs end by ~7 min (Story 2.3)" as resolved by births plus this button.
- [x] **Task 13: Tests (AC: 2, 4, 7–10)** (write each to fail first; `TUNING` values only, literal seeds)
  - [x] 13.1 New `tests/sim/systems/breeding.test.ts`. A `Breed` of two ready adults:
    - clears both `breedReady`, sets both `cooldownUntil = time + breedCooldownMs`, adds one pregnancy (`dueAt`, midpoint inside the inner fence) and emits `Bred`;
    - is ignored (state deep-equal, no event) for each of: a === b; an unknown id; a lamb; an elder; a not-ready adult; an adult on cooldown; at capacity (sheep + pregnancies = `baseCapacity`, with pending pregnancies counted); a lost game;
    - makes no rng draw (`state.rng` unchanged).
  - [x] 13.2 `tests/sim/systems/lifecycle.test.ts`:
    - A lamb is born on the exact tick `time >= dueAt`, not one tick earlier. It has `bornAt = time` and stage `lamb`, and appears at the parents' midpoint (clamped). `LambBorn` is emitted and the pregnancy removed.
    - With both parents dead, it is born at the stored spot.
    - Births run before old age: a lamb due on the tick the last sheep dies of old age keeps the game alive.
  - [x] 13.3 `tests/sim/systems/feeding.test.ts`:
    - An adult on cooldown (not ready) does not claim a breeding piece.
    - It claims once `time >= cooldownUntil`.
    - A seeker whose `cooldownUntil` is set mid-walk (corrupt-save path) releases its claim.
  - [x] 13.4 New scenario `tests/sim/scenarios/breeding.test.ts`:
    - From `newGame(seed)`, keep the flock fed, farm 2 breeding bars and run until both founders are ready.
    - `Breed` them, then `runFor(gestationMs)`: the flock is 4 and the newborn is a lamb.
    - A second `Breed` of the same pair before `breedCooldownMs` is ignored. After `breedCooldownMs` (and fresh breeding food) it succeeds.
    - The state JSON round-trips throughout.
  - [x] 13.5 `tests/sim/selectors.test.ts`:
    - `capacity`, `slotsUsed` (counting pregnancies), `canBreed` and `onCooldown` cover their boundaries (`time === cooldownUntil` is off cooldown).
    - `breedBlock`: capacity wins over notReady; 1 eligible gives notReady; 2 give null.
    - `PublicSheep.onCooldown/canBreed` are filled.
    - `selectPregnancies` gives the live-parent midpoint, the one-parent spot and the stored spot, and reuses `out`.
    - `selectHudView.breedBlock`.
  - [x] 13.6 `tests/sim/state.test.ts`: the new game has `pregnancies: []` (update the key list), every sheep has `cooldownUntil === 0`, and the rng sequence is unchanged (existing determinism tests stay green).
  - [x] 13.7 Save:
    - **Migrations:** a version-3 state gets `cooldownUntil: 0` and `pregnancies: []` and validates.
    - **`saveFile`:** a version-3 save decodes.
    - **`validate`:** cases for a bad `cooldownUntil` (NaN, -1, above `time + breedCooldownMs`); a bad pregnancy (duplicate id, id shared with a sheep, parentA 0 or 1.5, `dueAt` NaN or too late, x outside the inner fence); and a pregnancy with a dead parent id accepted.
    - **`busy.ts`:** add a pregnancy and a sheep on cooldown, with `isBusy` checking both. Keep `seekBreedingFood` seekers: breed two sheep that are not the ones fed for breeding pieces.
  - [x] 13.8 `tests/config/constants.test.ts`: update any `COMPONENTS` field count if `buttonBreedTool` gains `typography`.
  - [x] 13.9 Run `npm test`, `npm run typecheck` and `npm run lint`.
- [x] **Task 14: Browser check (AC: 1–7)**
  - [x] 14.1 Probe with a scratchpad Playwright script (the 2.2 pattern: real mouse and keys, no code hooks). Check that:
    - **New Game:** Breed is greyed with "Needs 2 ready sheep." on hover.
    - **16 `G` presses:** both founders get hearts, and Breed enables with the "Breed: pick two adults" tooltip.
    - **Breed mode:** clicking Breed fills it heart-deep with a wool label, the cursor is a heart and both founders' hearts pulse. The lamb has no marker.
    - **Invalid click:** clicking the lamb makes it shake and the mode stays.
    - **Picking:** clicking founder A pins a heart; clicking B pops a heart between them and the mode exits.
    - **Birth:** about 10 s later a lamb poofs in and the flock is 4.
    - **Cooldown tooltip:** hovering a parent shows the heart-outline icon, which is gone after 60 s.
    - **Cancelling:** right-click, Esc (pause does not open) and Breed again each cancel; a right-drag still pans and does not cancel.
    - **Pause:** the pause button exits breed mode and the cursor returns to normal.
    - **Reload and Continue:** a pending pregnancy is kept, and the lamb is born on time.
    - **Version-3 save:** it continues.
    - **960×540:** legible.
    - No console errors.
  - [x] 14.2 Check capacity with the debug "+10 sheep" button: Breed greys with "No room. Buy land.", and an active breed mode exits.

### Review Findings

- [x] [Review][Patch] A right-click on a HUD button (Farm, Farm Breeding Food, Breed, Pause) does not cancel breed mode: HudScene's button zones capture the press, so GameScene never sees it (AC 6, Task 7.4) [src/input/InputController.ts:285]
- [x] [Review][Patch] Entering or leaving breed mode while the pointer is on a HUD button replaces its hand cursor with the heart or the arrow until the pointer re-enters (AC 3) [src/view/scenes/GameScene.ts:116]
- [x] [Review][Patch] A breed-mode click is not disarmed on GAME_OUT or a release outside the canvas, and a press, >6 px move and release within one frame counts as a click (Task 7.3) [src/input/InputController.ts:322]
- [x] [Review][Patch] The click is hit-tested at release with that frame's sprites and camera scroll, not at the press point; resolve the sheep at press time (AC 5) [src/input/InputController.ts:337]
- [x] [Review][Patch] Breed markers lag a frame behind mode changes, and on picking A the ready heart and the pinned heart both show for a frame [src/view/scenes/GameScene.ts:322]
- [x] [Review][Patch] The pregnancy heart follows the parents' tick positions while the sheep are drawn interpolated, so it runs up to a tick ahead [src/view/field/PregnancyHeart.ts:40]
- [x] [Review][Patch] Births due on the same tick are made in reverse pregnancy order (ids and rng draws reversed); loop forward [src/sim/systems/lifecycle.ts:30]
- [x] [Review][Patch] Save validation accepts a pregnancy with parentA === parentB or a parent id ≥ nextId (a later sheep would inherit the pregnancy) [src/save/validate.ts:159]
- [x] [Review][Patch] The busy save fixture stores an unclamped parents' midpoint while validation requires the inner fence: a seed or tuning change could break every round-trip test [tests/save/busy.ts:63]
- [x] [Review][Patch] Breed mode is a boolean, not the `'idle' | 'breeding'` mode the task and AR8 specify (2.7 adds `dragging`) [src/input/InputController.ts:61]
- [x] [Review][Patch] deferred-work.md still says sheep die by 420 s in the resolved long-dev-run item; add the 540 s update [_bmad-output/implementation-artifacts/deferred-work.md:150]

## Dev Notes

### Current code to build on (read these first)

- **`src/sim/state.ts`:**
  - `Sheep` has `breedReady` and no cooldown yet.
  - `createSheep(state, { x, y, bornAt })` draws one rng value (the heading) and updates `stats.peakFlock`. Births must go through it.
  - `createNewGame` makes 3 sheep with fixed rng order.
- **`src/sim/commands.ts`:**
  - `Command` is `Farm | FarmBreeding`. `applyCommand` returns early on a lost game.
  - Add the `Breed` case; put the rule in `systems/breeding.ts` (a new file).
- **`src/sim/systems/lifecycle.ts`:**
  - A captured-array loop that clears readiness outside the adult stage and kills at `oldAgeMs`.
  - `killSheep` replaces `state.sheep`, so capture the array **after** births.
- **`src/sim/systems/feeding.ts`:**
  - `canUseBreedingFood(s, state)` is used by both the claim and the in-flight release.
  - Adding the cooldown there is the whole of Task 4.
- **`src/sim/step.ts`:**
  - It returns after any system that sets `lostAt`.
  - The system order is unchanged; breeding is a command, not a per-tick system (cooldown and capacity are checked at command time), so `breeding.ts` has no `updateBreeding`.
- **`src/sim/selectors.ts`:**
  - `stageOf`, `publicSheep`, `selectPublicSheep` (a reuse array), `pieceIndex`, `HudView`/`selectHudView` (in place), `innerFence` (allocates; events only).
- **`src/input/InputController.ts`:**
  - Right-button pan state lives in `update()`, with the comment "Story 2.3 cancels breed mode on it here".
  - It contains the key-event duplicate guards. Keep its patterns: everything inside Phaser callbacks is wrapped with `reportError('ui', …)` where it can throw.
- **`src/view/scenes/GameScene.ts`:**
  - Builds the `InputController` with `{ modalOpen, esc: [...], panBy }`.
  - Owns `publicSheep`, `sheepLayer`, `foodLayer`, `breedingLayer`, the `munch` emitter, `pointerOnHudControl()` and `onBlur`/`onHidden` (`cancelPan`).
- **`src/view/scenes/HudScene.ts`:**
  - `refresh` runs on `PRE_RENDER`.
  - `updateTooltip` caches `tooltipFor` (a button). Change it to also cache the text, so a changed reason updates.
  - `pointerOverControl` and the modal `clearHover` list are hand-maintained: add Breed to both.
- **`src/view/widgets/Button.ts`:**
  - `setEnabled` exists. `onOver` refuses the hover time while disabled, which is the deferred gap.
  - `tooltip` is readonly.
  - It has no active state and no icon.
- **`src/view/field/SheepSprite.ts`:**
  - Owns `readyHeart` (depth 9 998), positioned only on move or show-change.
  - Add the pinned heart and the pulse/shake here, in the same style.
- **`src/view/field/SheepHover.ts`:**
  - `sheepIndexAt(items, layer, worldX, worldY)` is shared for clicks.
  - The world point is `pointer + camera.scroll`, **not** `camera.getWorldPoint` (its matrix lags a pan by a frame). Use the same for breed clicks.
- **`src/view/widgets/Tooltip.ts`:**
  - Generic, `setScrollFactor(0)`, redraws on text change only.
- **Debug:** `DebugOverlay` has `+5 food`, `+5 breeding`, `+10 sheep`, `Feed all` and a `simButtons` list.

### What must be preserved

- **2.2 behaviour:**
  - The breeding bar, pieces and the ready heart.
  - Food first.
  - The claim model.
  - Readiness is cleared outside the adult stage.
  - The feeding tests stay green unedited, except where they enumerate state keys.
- **Determinism:**
  - `Breed` draws no rng.
  - A birth draws exactly one value (the heading, inside `createSheep`).
  - `createNewGame` is unchanged.
- **No allocation** in `step()`, systems, `render()`, `sync()`, `InputController.update()`, or `SheepHover.update()` on frames with no change.
- **Listener cleanup on SHUTDOWN:**
  - the new `bus` events (`breedTool:pressed`, `breedMode:changed`, any `sheep:shake`) in every scene or controller that subscribes;
  - the default cursor reset.

  Restarting must not double-subscribe.
- **Modal guards:**
  - nothing in breed mode works under a modal;
  - F/G still work while breed mode is on (they are separate actions);
  - the Esc chain order.
- **Right-drag pan:** unchanged on the field. A press on the bar still never pans.

### Architecture compliance

- **State and rules:**
  - Pregnancies live in `state.pregnancies`, and capacity counts living sheep plus pregnancies (architecture State Management, AR21).
  - Timers are absolute deadlines: `cooldownUntil` and `dueAt`.
  - Capacity, eligibility, the block reason and on-cooldown are derived by selectors, never stored.
- **Ownership:**
  - `systems/breeding.ts` handles pair validation, cooldown and capacity.
  - `lifecycle.ts` handles gestation and birth (System Location Mapping).
  - `InputController` owns modes `idle`/`breeding` (AR8); `dragging` arrives in 2.7.
  - The view never mutates state; it dispatches `Breed`.
- **Events:** `LambBorn` is in the architecture's event list. `Bred` is new and past tense, per the naming rule.
- **Visuals:**
  - Pooled hearts follow N3: a new `EntityLayer` for pregnancies, and owned images per sheep for the markers. Never `new`/`destroy` during play.
  - Colours only from `COLORS` and the art; copy only from `strings.ts`. The "No room." / "Needs 2 ready sheep." strings are from the Voice table.
- **Secrecy:** `PublicSheep` is the only sheep shape the view and input read. `canBreed`/`onCooldown` reveal nothing about the Abomination.

### Library / framework notes (Phaser 4.2.1, installed)

- **Cursor:** `scene.input.manager.setDefaultCursor(css)` sets `canvas.style.cursor` and the reset target. Hovered interactive zones (`useHandCursor`) still override it, which is what we want.
  - Use a relative URL: `url(assets/cursors/heart.png) 16 16, pointer` (the hotspot comes after the URL; `pointer` is the fallback).
  - Firefox and Chrome accept PNG cursors up to 128 px; 32×32 is safe.
- **Tweens:** already used (`tweens.add`, `killTweensOf`, `yoyo`, `repeat: -1` for a loop). **Particles:** `scene.add.particles(0, 0, atlas, { frame, emitting: false, ... }).explode(n, x, y)`, as `munch` does.
- Check any other API against `node_modules/phaser/skills/` (for example `input-keyboard-mouse-touch`, `tweens`, `v3-to-v4-migration`), not from memory. No new dependencies.

### Testing standards

- Vitest covers `src/sim/` and `src/save/` only: `tests/<same path as src>/`, scenarios in `tests/sim/scenarios/`.
- Use `newGame(seed)`, `runFor`, `fillFlock` and `busyGame` from the helpers. Assert on state and drained `SimEvent`s, with `TUNING` in every assertion.
- No fake timers, no Phaser, no mocking.
- The input and visuals are checked in the browser (Task 14).

### Previous story intelligence

- **2.2:**
  - The 2.2 review caught a stale claim (a seeker that turned elder ate the piece). Apply the same thinking to A going stale (Task 7.5) and to `Breed` validation at apply time: the view's eligibility is a frame old by the time the command applies.
  - Test the exact boundary tick (`dueAt`, `cooldownUntil`); review caught tests that passed without the code under test.
  - `npm run assets` packs deterministically, so only touched atlases change.
  - **Browser probe:** `playwright-core` from `/home/rylanevans/nr-csp/frontend/node_modules` with `/usr/bin/google-chrome` (SwiftShader), DEV server on its own port. Stop it with `kill <pid>`, never `pkill -f` (that kills the calling shell).
- **2.1:** the captured-array loop in lifecycle; `step()` returns after a loss.
- **1.10:**
  - `Button.setDepth` moves the zone too.
  - `clearHover` exists for modals.
  - Phaser updates scenes in reverse order, so HUD reads on `PRE_RENDER`.
- **Commit style:** `Implement story 2.3: Breed Two Adults`.

### Deferred work this story picks up (`deferred-work.md`)

- **"Button disabled state (Story 2.3)":** all four gaps (Tasks 6.1–6.4, 6.7).
- **"Field camera… 2.3":** a right-click (under 6 px) cancels breed mode, in `InputController.update` (Task 7.4).
- **"Long dev runs end by ~7 min (Story 2.3)":** births plus the `Ready adults` debug button (Task 12).

When done, mark each **Resolved in Story 2.3** in `deferred-work.md`.

### Out of scope

- **2.4:** idle-mode field clicks and carcass clearing. Build the breed-mode click so 2.4 can generalise it.
- **2.7:** drag, the `dragging` mode and its Esc step.
- **3.2:** the shop's Esc step.
- **3.3:** land and capacity tiers.
- **4.1:** the Abomination on `LambBorn`.
- **5.3:** names (toasts and tooltip name line).
- **5.5:** "Last sheep!".
- **5.6:** audio (heart pop and poof SFX).
- **5.7:** reduced motion for pulse and shake. Keep the durations as named constants.
- **UX-DR35:** the flock counter "{alive}/{capacity}". No story here owns it; do not add it.

### Open questions (defaults chosen; confirm or change)

1. **Pending lamb vs loss:** if every sheep dies while a lamb is on the way, the game is lost at once (FR38 as written) and the lamb is never born. The alternative is to keep the game alive until the birth. Default: FR38 as written.
2. **Re-clicking A:** it does nothing. The alternative is to unpin it.
3. **Breed-mode marker:** the existing ready heart pulses. UX-DR69 asks for "a soft heart marker" on ready adults, but 2.2 already shows a ready heart at all times.

### Project Structure Notes

- New files:
  - `src/sim/systems/breeding.ts`
  - `src/view/field/PregnancyHeart.ts`
  - `tests/sim/systems/breeding.test.ts`
  - `tests/sim/scenarios/breeding.test.ts`
  - the art in Task 8, and `public/assets/cursors/heart.png` (generated)
- All other changes are to existing files. The paths follow the architecture's directory structure.

### Project Context Rules (from `_bmad-output/project-context.md`)

- Phaser 4, not 3. Game logic only in `src/sim/`; no `Math.random`/`Date.now` in the sim.
- **Capacity:** it counts living sheep + `state.pregnancies`. Breeding is blocked at capacity or with fewer than 2 ready adults; Breed greys out with the reason tooltip.
- **Timers:** absolute game-ms deadlines (`cooldownUntil`, `dueAt`); never countdown fields or Phaser timers for rules.
- **Derived values:** never store them (capacity, on-cooldown, stage).
- **New `GameState` fields:** bump `SAVE_SCHEMA_VERSION`, add a migration and add validation.
- **Input:**
  - A single `InputController`; field hit tests use world coordinates.
  - Right-click cancels breed mode.
  - The `Esc` priority chain.
  - No `setInteractive` on sheep sprites.
- **Code style:**
  - `switch`es over `Command['type']` end with `assertNever`.
  - Listener cleanup on SHUTDOWN.
  - Copy from `strings.ts`, colours from `COLORS`.
  - No "!" in copy.
- Done = `npm test`, `npm run typecheck` and `npm run lint` pass; visuals verified in the browser.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.3; FR9, FR10, FR11; AR8, AR21; UX-DR31, UX-DR32, UX-DR43, UX-DR56, UX-DR58, UX-DR69–UX-DR75, UX-DR82, UX-DR96]
- [Source: _bmad-output/planning-artifacts/gdds/gdd-sheep-civilization-2026-10-05/gdd.md: Breeding (steps 1–4, cooldown, capacity), Economy (capacity 10 → 25 → 50 → 100), Pacing]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-sheep-civilization-2026-10-05/EXPERIENCE.md: Interaction Primitives (Breed mode), State Patterns, Voice and Tone; DESIGN.md: button-breed-tool, button-disabled, tooltip, Layout; mockups/hud.html `.btn-breed`]
- [Source: _bmad-output/game-architecture.md: State Management, Game Time, Input Handling, Event System, N2 PublicSheep (`onCooldown`, `ready`), N3, System Location Mapping, State Patterns]
- [Source: _bmad-output/implementation-artifacts/2-2-farm-breeding-food.md; deferred-work.md]
- [Source: _bmad-output/project-context.md]

## Dev Agent Record

### Agent Model Used

Claude Opus 5.5 (1M context), `claude-opus-5-5[1m]`

### Implementation Plan

- **Sim:**
  - `TUNING.breedCooldownMs/gestationMs/baseCapacity` (60 s / 10 s / 10).
  - `Sheep.cooldownUntil`; `GameState.pregnancies: Pregnancy[]` with an `id` for view reconciliation.
  - Selectors: `onCooldown`, `canBreed` (the one pairing rule), `capacity`, `slotsUsed`, `breedBlock` (capacity wins), `sheepIndex`, `pregnancySpot` (live-parent midpoint, the one parent left, or the stored spot) and `selectPregnancies`. `PublicSheep.onCooldown/canBreed`; `HudView.breedBlock`.
  - `systems/breeding.ts` `breed()` re-checks everything, then clears readiness, starts both cooldowns, pushes a pregnancy at the clamped midpoint and emits `Bred`. No rng.
  - `lifecycle.ts` runs births before ageing (so a due lamb keeps the flock alive), via `createSheep` at the clamped `pregnancySpot`, emitting `LambBorn`.
  - `feeding.ts` `canUseBreedingFood` adds "off cooldown" (both the claim and the release).
- **Save schema 4:** `MIGRATIONS[3]` adds `pregnancies: []` and `cooldownUntil: 0`. Validation covers `cooldownUntil` in [0, time + cooldown] and pregnancies (shared ids, parent id shape, `dueAt` ≤ time + gestation, spot inside the inner fence).
- **Button:** a disabled button still hovers (reason tooltip); `setTooltip`; the cursor and tooltip follow an enable change under a still pointer; `setToggled` with the spec's active colours; an optional `ui` icon tinted (FILL) to the label colour; `isEnabled`.
- **Input:**
  - `InputController` gains breed mode (`toggleBreedMode`, `exitBreedMode`, `breeding`, `pickedA`) and breed-mode left clicks (armed on a field press outside HUD controls, resolved on release within 6 px at the press point through the `sheepAt` hook).
  - A right-click anywhere cancels; only field presses pan; a stale A is dropped each frame.
  - It notifies through `breedMode:changed` on the bus. `cancelPan` became `cancelPress`.
- **View:**
  - `BottomBar.breedButton` (104×56, centred in the bar, heart icon).
  - `HudScene` greys and enables it with the reason tooltip, shows the toggled look and emits `breedTool:pressed`.
  - `GameScene`:
    - Esc step between sub-panel and pause;
    - exits breed mode on a block or a modal;
    - heart CSS cursor (reset on SHUTDOWN);
    - per-sheep markers (`SheepSprite.setBreedMarker`: candidate pulse, pinned bobbing heart);
    - `shake` (angle wobble);
    - a `PregnancyHeart` layer (pool 10) and a poof emitter on `LambBorn`.
  - `Tooltip.setIcon` (heart outline after the last line); `SheepHover` shows it while the sheep is on cooldown.
- **Art:** `icon-heart` (ui), `breed-heart`, `heart-outline`, `poof` (world) and the 32×32 `assets/cursors/heart.png`. `npm run assets` now copies `assets/cursors/` to `public/assets/cursors/`. Debug gains **Ready adults**.

### Debug Log References

- **Red phase:** the new and changed tests failed first across the save, selector, lifecycle, feeding and breeding files, mostly through the busy fixture's unknown `Breed`. They passed after Tasks 1–5.
- **Test fixes, not code:**
  - The busy fixture's 12 sheep are over capacity, so its `Breed` was refused; the fixture now sets a pregnancy and cooldowns directly.
  - In the scenario's second round the first lamb has grown up and took breeding pieces; the other sheep are marked ready so the pieces go to the founders.
- **Browser bug found and fixed:** the tooltip's heart outline overlapped the text. The atlas frames carry a 0.5 pivot, which `setFrame` applies as the origin. `Tooltip.setIcon` now calls `setFrame(frame, true, false)`.
- **Browser probe** (scratchpad, `playwright-core` from nr-csp, system Chrome with SwiftShader, DEV server on port 5199, real mouse and keys, saves planted through localStorage). All checks passed with no console errors or warnings:
  - **New game:** Breed is greyed, and hovering shows "Needs 2 ready sheep."; clicking it does nothing.
  - **Two ready founders:** "Breed: pick two adults". Clicking fills heart-deep with a wool label, the cursor is the heart, and the founders' hearts pulse. The lamb has no marker.
  - **Lamb click:** it shakes and the mode stays. An empty-field click does nothing.
  - **Picking:** A shows the pinned heart; clicking B pops a heart between them and the mode exits (cursor reset).
  - **Birth:** the lamb is born about 10 s later (4 sheep); parents' `cooldownUntil` is time + 60 s.
  - **Parent tooltip:** "Adult · Fed" plus the heart outline.
  - **Cancelling:** right-click on the field, right-click on the bar, Esc (pause did not open), Breed again and the Pause button each cancel; a right-drag keeps breed mode; G works in breed mode.
  - **Capacity:** "+10 sheep" (debug) in breed mode exits it, and Breed shows "No room. Buy land.".
  - **Reload:** a saved pregnancy shows its heart and is born on time.
  - **Version-3 save:** continues as schema 4 with no pregnancies and cooldown 0.
  - **960×540:** legible.
  - The dev server was stopped by PID (the npx wrapper's PID did not stop it; the vite node process was killed by its own PID).

### Completion Notes List

- 2026-10-07: Story created; the context engine analysis is complete, and this is the developer guide.
- Open questions kept at their defaults, approved by Rylan ("ok this is good"):
  - a flock that dies with a lamb on the way is lost (FR38 as written);
  - re-clicking A does nothing;
  - the breed-mode marker is the ready heart pulsing.
- AC 1: the Breed tool (104×56, heart icon, centred in the bar, no key) with "Breed: pick two adults". Browser.
- AC 2: greyed by `breedBlock` with the reason tooltip, hover works while greyed, a click does nothing. Unit tests (selectors) and browser.
- AC 3: breed mode with the active look, heart cursor and candidate pulse. Browser.
- AC 4: A pinned, B dispatches `Breed`. The sim clears readiness, starts the cooldown, adds a pregnancy and emits `Bred`. The heart floats between the parents, and the lamb is born 10 s later with a poof and `LambBorn`. Unit tests (breeding, lifecycle), scenario and browser.
- AC 5: an ineligible click shakes, the empty field does nothing, re-clicking A does nothing, and a stale A is dropped. Browser (shake, empty); the stale-A path is code-reviewed.
- AC 6: right-click (field and bar), Esc at its chain slot, Breed again, a greyed tool and a modal all cancel; a right-drag pans and keeps the mode. Browser.
- AC 7: cooldown blocks pairing and breeding food, and the tooltip shows the heart outline. Unit tests (breeding, feeding, selectors), scenario and browser.
- AC 8: `Breed` is ignored without a state change for every invalid case. Unit tests.
- AC 9: schema 4, with migration, validation, decode and the round trip through the busy fixture (now with a pregnancy and cooldowns). Tests.
- AC 10: `npm test` (355 passed), `npm run typecheck` and `npm run lint` all pass.
- `deferred-work.md`: the Button disabled-state gaps, the right-click cancel and the long-dev-run items are marked resolved in 2.3.

- Code review (2026-10-07): 3 layers (Blind Hunter, Edge Case Hunter, Acceptance Auditor). 0 decisions, 11 patches applied, 0 deferred, 7 dismissed:
  - the lost-lamb behaviour (an approved Open Question default);
  - the tooltip re-arming on an enable flip under the pointer (the intended reason tooltip);
  - a supposedly missing `sheepIndexAt` export (it existed);
  - the "draws no rng" test (rng is a number, so it is not vacuous);
  - "Needs 2 ready sheep." with a ready sheep on cooldown (only corrupt or debug states);
  - the one-parent heart wording and the hook-versus-bus wording (both contradictions inside the spec; the code follows the tasks).
- Review patches:
  - A right press on a HUD control is forwarded (`hud:rightPressed`), so a right-click on any button cancels breed mode.
  - A hovered button keeps its hand cursor when breed mode toggles.
  - A breed-mode click is disarmed on `POINTER_UP_OUTSIDE` and `GAME_OUT`, measured again at the release point, and hit-tested at the press.
  - Input runs before render, and `SheepSprite.setBreedMarker` swaps the hearts at once, so markers never lag and never show two hearts.
  - The pregnancy heart follows the parents' drawn sprites (`PublicPregnancy.parentA/parentB`).
  - Births run forwards (pregnancy order).
  - Validation rejects a pregnancy naming one parent twice or a parent id at or above `nextId`.
  - The busy fixture clamps its pregnancy spot.
  - `InputController.mode` is `'idle' | 'breeding'`.
  - `deferred-work.md` notes the 540 s lifespan.
  - Tests: 358 pass, typecheck and lint are clean, and the browser was re-checked (HUD right-clicks cancel, the hand stays on Breed, a release outside picks nothing, a single pinned heart, a pair still breeds).
- 2026-10-07 (Rylan): the Breed button is 64 px tall and top-aligned with Farm and Farm Breeding Food (was 56 px, centred). DESIGN.md and UX-DR31 updated.

### File List

- `src/config/tuning.ts`, `src/config/constants.ts` (modified)
- `src/sim/state.ts`, `src/sim/commands.ts`, `src/sim/events.ts`, `src/sim/selectors.ts` (modified)
- `src/sim/systems/breeding.ts` (new)
- `src/sim/systems/lifecycle.ts`, `src/sim/systems/feeding.ts` (modified)
- `src/save/migrations.ts`, `src/save/validate.ts` (modified)
- `src/input/InputController.ts` (modified)
- `src/view/bus.ts`, `src/view/strings.ts`, `src/view/assetKeys.ts` (modified)
- `src/view/widgets/Button.ts`, `src/view/widgets/Tooltip.ts` (modified)
- `src/view/hud/BottomBar.ts`, `src/view/scenes/HudScene.ts`, `src/view/scenes/GameScene.ts` (modified)
- `src/view/field/SheepSprite.ts`, `src/view/field/SheepHover.ts` (modified)
- `src/view/field/PregnancyHeart.ts` (new)
- `src/debug/DebugOverlay.ts` (modified)
- `scripts/build-assets.ts` (modified)
- `assets/art/ui/icon-heart.png`, `assets/art/world/breed-heart.png`, `assets/art/world/heart-outline.png`, `assets/art/world/poof.png`, `assets/cursors/heart.png` (new)
- `public/assets/atlases/sheep-world.{png,json}`, `public/assets/atlases/ui.{png,json}` (regenerated)
- `public/assets/cursors/heart.png` (new, generated)
- `assets/CREDITS.md` (modified)
- `tests/sim/systems/breeding.test.ts`, `tests/sim/scenarios/breeding.test.ts` (new)
- `tests/sim/systems/lifecycle.test.ts`, `tests/sim/systems/feeding.test.ts`, `tests/sim/selectors.test.ts`, `tests/sim/state.test.ts` (modified)
- `tests/save/busy.ts`, `tests/save/migrations.test.ts`, `tests/save/saveFile.test.ts`, `tests/save/validate.test.ts` (modified)
- `_bmad-output/implementation-artifacts/2-3-breed-two-adults.md` (new)
- `_bmad-output/implementation-artifacts/sprint-status.yaml`, `_bmad-output/implementation-artifacts/deferred-work.md` (modified)
- `_bmad-output/planning-artifacts/gdds/gdd-sheep-civilization-2026-10-05/{gdd,epics}.md`, `_bmad-output/planning-artifacts/epics.md`, `_bmad-output/planning-artifacts/ux-designs/ux-sheep-civilization-2026-10-05/{DESIGN,EXPERIENCE}.md` (modified: the 6-minute adulthood and the 64 px Breed button)

### Change Log

- 2026-10-07: Implemented breeding: the Breed tool and breed mode, the `Breed` command with cooldown and capacity, gestation and birth, pregnancy hearts and the birth poof, the cooldown tooltip icon, save schema 4, the Button and Tooltip widget extensions, and the debug "Ready adults" button. Status → review.
- 2026-10-07: Adulthood lengthened to 6 minutes (adult 60–420 s, elder to 540 s; Rylan).
- 2026-10-07: Breed button set to 64 px and aligned with the Farm buttons (Rylan). Code review: 11 patches applied. Status → done.
