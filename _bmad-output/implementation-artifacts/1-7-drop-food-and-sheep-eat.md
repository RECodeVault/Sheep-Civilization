---
baseline_commit: 0156a7da258a7fc7cb939bd5a04aaf62e3400798
---

# Story 1.7: Drop Food and Sheep Eat

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a player,
I want to click the field to drop food that hungry sheep walk to and eat,
so that I can keep my flock alive.

> **Scope change (2026-10-06):** this story also reworks Story 1.6's Farm rule into an **8-pip Farm progress bar**. A full bar adds 1 food to the stock; when the stock is full, the food drops onto the field instead. Source: `_bmad-output/planning-artifacts/sprint-change-proposal-2026-10-06.md` (approved by Rylan). The planning docs (FR3, FR19, FR24, UX-DR26/27/29/44/75) are already updated.

## Acceptance Criteria

1. **Drop food (AR8, FR4, UX-DR78).** Given the single `InputController` in `src/input/` in `idle` mode, when I left-click empty fenced field with food ≥ 1:
   - A `DropFood` command creates one food piece at the cursor and spends 1 food from the stock.
   - The piece bounces on landing.
   - The food stock read-out shows the new value on the same frame as the change.
2. **No food (FR4, UX-DR61, UX-DR29).** Given food is 0, when I click the field:
   - Nothing drops and food stays 0.
   - The food stock read-out shakes and flashes `alert`.
3. **Seek and eat (FR5, UX-DR78).** Given a food piece on the field, when the sim steps:
   - The nearest sheep with Fullness < 90 switches to `seekFood` and walks (at most 60 px/s) to the nearest food piece.
   - On reaching it, the sheep eats it: +35 Fullness, capped at 100. The piece is removed and a munch particle plays where it was.
   - Uneaten pieces stay on the field indefinitely. They never spoil.
4. **Clicking a sheep (UX-DR65, UX-DR66).** Given a click on a sheep in `idle` mode, when it is released without moving 6 px, nothing happens: no food drops and nothing is spent.
5. **Scenario.** Given a seeded scenario, when a starving sheep has a piece dropped beside it, it eats within the expected travel time and its hunger state returns to Fed.
6. **Farm progress bar (FR3, UX-DR26, UX-DR29).** Given the Farm button and a food stock below 20, when I click Farm or press `F` 8 times:
   - Each click squashes the button and fills one pip of the 8-pip Farm progress bar, on the same frame.
   - The 8th click adds 1 food to the stock, empties the bar and pops "+1" over the button.
   - Clicks 1 to 7 pop nothing.
7. **Overflow (FR3, FR5).** Given the food stock at 20, when a Farm bar completes:
   - The stock stays 20 and the bar empties.
   - One food piece drops at a random reachable spot on the field and bounces on landing. There is no "+1" popup.
   - Sheep eat it like any other piece. Clicking Farm is never wasted.
8. **HUD (UX-DR29, UX-DR75).** Under the Farm button the HUD shows the 8-pip progress bar, then the food stock as a hay food icon and "{n}/20". The Farm tooltip reads "Farm: fill the bar for 1 food (F)".
9. **Green gate.** `npm test`, `npm run typecheck`, `npm run lint` and `npm run build` all pass. No existing test breaks except the Farm tests this story rewrites, and the debug overlay is still absent from `dist/`.

## Tasks / Subtasks

- [ ] **Task 1: Tuning values** (AC: 3, 6, 7)
  - [ ] 1.1 In `src/config/tuning.ts`, add with GDD-citing comments:
    - `seekBelowFullness: 90`: GDD Feeding, "the nearest non-full sheep (Fullness below 90)".
    - `foodPieceFullness: 35`: GDD Hunger table, "Food piece +35 Fullness, capped at 100". Cap at `fullnessMax`.
    - `foodPerDrop: 1`: GDD Feeding, "Drops 1 food piece … and costs 1 food".
    - `farmPipsPerFood: 8`: GDD Farming table (changed 2026-10-06), "8-pip progress bar (tune)".
    - `farmPipsPerClick: 1`: GDD Core Click, "a Farm click fills 1 pip". Better Hoe (4.7) raises it and the boost (2.8) doubles it.
    - `eatReachPx: 12`: **[ASSUMPTION, tune in 3.6]** a sheep eats when its centre is within this distance of the piece. It must be above 8 px (gotcha 4).
    - `eatMs: 1_500`: **[ASSUMPTION, tune in 3.6]** how long a sheep stands munching before it wanders again.
  - [ ] 1.2 **Remove** `farmFoodPerClick`. Update its comment block (FR3 now reads "stock starts at 5, capped at 20; 8 pips per food"). Fix every user: `commands.ts`, `BottomBar.ts`, `tests/sim/commands.test.ts` and `tests/sim/selectors.test.ts`.
  - [ ] 1.3 Never write 90, 35, 8, 12 or 1 500 as literals in sim code or tests. Read `TUNING`.
- [ ] **Task 2: State changes** (AC: 1, 3, 6)
  - [ ] 2.1 In `src/sim/state.ts`, widen `SheepActivity` to `'wander' | 'seekFood' | 'eating'`. Update its comment: later stories add `seekCarcass` (2.5), `stalking` (4.3) and `dragged` (2.7).
  - [ ] 2.2 Add `targetId?: number` to `Sheep`: the id of the food piece a `seekFood` sheep is walking to.
    - It is **optional and omitted** when there is no target. Clear it with `delete s.targetId`, never `= undefined` or `null` (project-context: optional fields are omitted). That keeps `JSON.parse(JSON.stringify(state))` deep-equal to `state`.
    - Keep the generic name. Story 2.5 (`seekCarcass`) and 4.3 (`stalking`) can reuse it for carcass and victim ids.
  - [ ] 2.3 Add `farmProgress: number` to `GameState`: the integer number of pips in the current Farm bar, `0` to `farmPipsPerFood − 1`. `createNewGame` sets it to `0`. Add a doc comment, and update the `state.test.ts` key list.
  - [ ] 2.4 Reuse `restUntil` as the deadline of the `eating` pause, and update its doc comment: "while `time < restUntil` the sheep stands still: grazing (`wander`) or munching (`eating`)". Do not add an `eatUntil` field.
  - [ ] 2.5 `FoodPiece` (`{ id, x, y }`) and `state.foodPieces` already exist; do not change them.
  - [ ] 2.6 **No `SAVE_SCHEMA_VERSION` bump.** No save is persisted until Story 1.9, so `farmProgress`, `targetId` and the wider `activity` are part of schema version 1 from the start. Append to `deferred-work.md` under a "Deferred from: story 1-7" heading that Story 1.9's validation must check:
    - `activity` is one of the union values;
    - `targetId`, when present, is a finite integer;
    - `farmProgress` is an integer in `[0, farmPipsPerFood)` (clamp or reject);
    - `food` stays a non-negative integer.
- [ ] **Task 3: Commands and events** (AC: 1, 2, 6, 7)
  - [ ] 3.1 In `src/sim/events.ts`:
    - **Change `Farmed`** to `{ type: 'Farmed'; resource: FarmResource; added: number; toField: number }`. `added` is the food that went into the stock (0 for most clicks; 1 when a bar completes below the cap). `toField` is the number of pieces that overflowed onto the field. Update its comment. Story 2.2 reuses it for breeding food with `toField: 0`.
    - Add `{ type: 'FoodDropped'; id: number; x: number; y: number }`: a piece was created (landing position after clamping). Both `DropFood` and Farm overflow emit it.
    - Add `{ type: 'FoodEaten'; sheepId: number; pieceId: number; x: number; y: number }`: the munch position is the piece's.
    - Add `{ type: 'SpendRefused'; resource: FarmResource }`: a spend failed for lack of the resource. Story 2.3 reuses it for the breeding meter shake (UX-DR30).
    - Update the header comments.
  - [ ] 3.2 In `src/sim/commands.ts`, widen `Command` with `{ type: 'DropFood'; x: number; y: number }` (canvas px). Update the "Later stories append…" comment.
    - With two variants, `switch (cmd.type)` narrows `cmd`. Change the default to `assertNever(cmd)` and delete the "one-variant union" comment.
  - [ ] 3.3 **Rewrite the `Farm` case** (FR3):
    1. `state.farmProgress += TUNING.farmPipsPerClick`. Leave a comment that 4.7 (hoe) changes the pips and 2.8 (boost) doubles them; both go through this one place.
    2. While `state.farmProgress >= TUNING.farmPipsPerFood`: subtract `farmPipsPerFood` (leftover pips carry over). Then:
       - if `state.food < TUNING.foodCap`, `state.food += 1` and count it in `added`;
       - otherwise drop a piece at a random reachable spot: `rngRange` x and y over the **inner fence** (fence rect inset by `fenceInset`), then `createFoodPiece`, `emit FoodDropped`, and count it in `toField`.
    3. Emit `Farmed { resource: 'food', added, toField }` once per Farm, **after** any `FoodDropped`.
    - Food already above the cap (old save or debug) is never lowered; such a bar overflows to the field.
    - The overflow point is drawn from `state.rng` (seeded, saved), never `Math.random`.
    - Pieces have no cap on the field (proposal R3).
  - [ ] 3.4 **The `DropFood` case**, in this order:
    1. If `x` or `y` is not finite, or the point is outside `fenceBounds(state)` (the whole fenced rect, edges inclusive), ignore it: no spend, no event. This is a guard; the view never sends that.
    2. If `state.food < TUNING.foodPerDrop`: `emit({ type: 'SpendRefused', resource: 'food' })` and return.
    3. Otherwise `state.food -= TUNING.foodPerDrop`, then `createFoodPiece(state, x, y)`, then emit `FoodDropped` with the piece's id and clamped position.
  - [ ] 3.5 Do not predict outcomes in the view. The view always dispatches `Farm` and `DropFood`; only the sim decides.
- [ ] **Task 4: Feeding system, `src/sim/systems/feeding.ts`** (AC: 3, 5, 7)
  - [ ] 4.1 **`createFoodPiece(state, x, y): FoodPiece`**, the factory for the concept this system owns (architecture Entity Patterns). It clamps `(x, y)` into the **inner fence**, takes `nextId(state)`, pushes the piece and returns it.
    - Why clamp: sheep centres can never come closer than `fenceInset` (40 px) to a rail. A piece in that band would be out of reach for ever, and its seeker would walk at the rail until it starved (gotcha 3).
    - Also export a small `innerFence(state)` helper (or reuse one if you extract it from `movement.ts`), so `movement.ts`, `feeding.ts` and the Farm overflow agree on one rect.
  - [ ] 4.2 **`updateFeeding(state)`**, once per tick, in three passes:
    1. **Release stale claims.** A `seekFood` sheep whose `targetId` names no piece goes back to `wander` (`delete s.targetId`). An `eating` sheep with `state.time >= s.restUntil` goes back to `wander`.
    2. **Arrivals.** For each `seekFood` sheep within `TUNING.eatReachPx` of its target piece:
       - `s.fullness = Math.min(TUNING.fullnessMax, s.fullness + TUNING.foodPieceFullness)`.
       - Remove the piece from `state.foodPieces` (a rare event, so a `splice` is fine).
       - `emit({ type: 'FoodEaten', sheepId, pieceId, x, y })`.
       - `s.activity = 'eating'`, `delete s.targetId`, `s.restUntil = state.time + TUNING.eatMs`.
    3. **Assign claims.** Repeat while there is an unclaimed piece and an eligible sheep (activity `wander` and `fullness < TUNING.seekBelowFullness`):
       - Take the oldest unclaimed piece (lowest index in `state.foodPieces`).
       - Find the **nearest** eligible sheep to it.
       - That sheep claims its own **nearest unclaimed** piece (often the same one): `activity = 'seekFood'`, `targetId = piece.id`.
       - This matches both halves of FR5. Each piece has at most one seeker and each sheep at most one piece. A piece with no seeker waits; it never spoils.
       - Ties go to the lower array index (strict `<`), so the result is deterministic.
  - [ ] 4.3 **No rng and no allocation per tick.** Use plain `for` loops and module-scope scratch, for example a `Uint8Array` "claimed" mark per piece index, grown on demand like the movement buffers. No `.find`, `.map`, `.filter` or closures in the per-tick path; only the arrival removal, which is an event.
    - **Big field piles are now normal** (Farm overflow, no field cap). Keep claim assignment cheap: stop the pass 3 loop as soon as there are no eligible sheep, and skip the work entirely when no sheep is eligible.
    - Budget: a tick with 100 sheep and 300 pieces stays well under 2 ms. Add a scenario test that runs it and asserts correctness; time it once in the browser in Task 12.
  - [ ] 4.4 Only `feeding.ts` changes `activity` to or from `seekFood` and `eating`. Movement reads `activity`; it never changes it.
  - [ ] 4.5 A sheep that dies while seeking takes its claim with it (claims live on the sheep), so the piece is re-assigned on the next pass. `killSheep` needs no change.
  - [ ] 4.6 Register it in `src/sim/step.ts`: `SYSTEMS = [updateMovement, updateFeeding, updateHunger]`, the order the header comment already plans.
- [ ] **Task 5: Movement for the new activities, `src/sim/systems/movement.ts`** (AC: 3)
  - [ ] 5.1 Add `case 'seekFood'` to the velocity switch:
    - Look up the target piece by id with a plain loop (no `.find`). If it is missing, use zero velocity this tick; feeding releases the claim next tick.
    - Desired velocity: the unit vector to the piece × `min(walk, dist / DT)`, so the sheep slows onto the piece and never overshoots or orbits it.
    - Set `s.heading` to the travel direction.
    - No rest roll and no rng draw.
    - Leave `walking` false for seekers, so the crowd-turn rule (which rewrites a walker's heading from the separation push) never fights the seek direction.
  - [ ] 5.2 Add `case 'eating'`: no walk velocity. Separation still applies.
  - [ ] 5.3 Keep separation, the walk-speed cap and the pass 2 hard clamp unchanged for every activity. `assertNever(s.activity)` stays as the default.
  - [ ] 5.4 **Determinism:** wander rng draws must stay exactly as today for wandering sheep. `wander100.test.ts` has no food, so it must pass unchanged.
- [ ] **Task 6: Selectors** (AC: 1, 3, 6, 8)
  - [ ] 6.1 In `src/sim/selectors.ts`, add `selectFoodPieces(state): readonly FoodPiece[]`, returning `state.foodPieces` itself (no copy). Food pieces hold no secrets.
  - [ ] 6.2 Extend `HudView` with `farmProgress` and `farmPipsPerFood` (from `TUNING`), filled in place by `selectHudView`.
  - [ ] 6.3 Do **not** add `activity` or `targetId` to `PublicSheep` (N2 secrecy: activity must be filtered when it is exposed later).
- [ ] **Task 7: Component specs and art** (AC: 1, 3, 8)
  - [ ] 7.1 In `src/config/constants.ts`, replace `COMPONENTS.foodMeter` with the two DESIGN.md components (already updated there):
    - `farmProgress: { trackColor: 'woolShade', fillColor: 'hay', segmentCount: 8 }`
    - `foodStock: { iconColor: 'hay', emptyFlashColor: 'alert', valueTypography: 'numeric' }`
    - Update `tests/config/constants.test.ts`: 35 → 36 components, and its test name.
  - [ ] 7.2 **Placeholder art** (throwaway scratchpad PNG encoder, as in 1.2, 1.5 and 1.6; DESIGN.md palette; commit only the PNGs):
    - `assets/art/world/food-piece.png`: a small `hay` clump, for example 8×6 with a 1 px `hayDeep` lower edge, drawn at 2× in game.
    - `assets/art/world/munch-crumb.png`: a 2×2 or 3×3 `hay` crumb.
    - `assets/art/ui/icon-food.png`: a 16×16 hay food icon for the stock read-out, matching the piece.
    - Keep `pip-food` / `pip-empty` (7×14). The progress bar shows them wider (Task 10.1).
  - [ ] 7.3 Run `npm run assets` and commit the regenerated `sheep-world` and `ui` atlases. Add `foodPiece`, `munchCrumb` and `iconFood` to `FRAME` in `src/view/assetKeys.ts`, and extend the placeholder row in `assets/CREDITS.md`.
- [ ] **Task 8: Field rendering** (AC: 1, 3, 7)
  - [ ] 8.1 **`src/view/field/FoodSprite.ts`**, a `Phaser.GameObjects.Sprite` implementing `PooledEntitySprite<FoodPiece>`, modelled on `SheepSprite`:
    - `bind(id)`: show it and mark it fresh.
    - `sync(piece, …)`: pieces never move. On the first sync after `bind`, set the position once, `setDepth(piece.y)`, and start the bounce. Later syncs do nothing.
    - **Bounce (UX-DR78):** tween `y` from `piece.y - BOUNCE_DROP_PX` (about 16) to `piece.y`, `ease: 'Bounce.easeOut'`, about 350 ms. Keep both values as named constants together for Story 5.7's reduced motion.
    - `playExit()` / `reset()`: `killTweensOf(this)`, hide, deactivate, clear the id and fresh flag. Never `destroy()`.
    - Pieces present when a game is loaded also bounce in. That is acceptable; note it.
  - [ ] 8.2 **In `GameScene`:** `this.foodLayer = new EntityLayer(new ObjectPool(() => new FoodSprite(this), FOOD_POOL_SIZE))` with `FOOD_POOL_SIZE = 60` (N3; the pool grows on demand). Create it before the sheep layer and sync it in `render()` with `selectFoodPieces(this.state)`.
  - [ ] 8.3 **Munch particle (UX-DR78):** one emitter for the field, created once: `this.add.particles(0, 0, ATLAS.sheepWorld, { frame: FRAME.munchCrumb, emitting: false, … })`, with a lifespan of about 400 ms, a small upward speed, gravity, and alpha fading to 0. On `FoodEaten`, call `emitter.explode(~6, e.x, e.y)`. Give it a depth that shows over the eating sheep.
    - Check `node_modules/phaser/skills/particles/SKILL.md`. `this.add.particles()` returns the emitter.
    - `Math.random` inside the emitter is fine (view-only jitter). The munch SFX arrives in 5.6; leave a one-line comment.
  - [ ] 8.4 `bus.on('sim', this.onSim, this)` in `create` (bound once as a class field), removed in the existing SHUTDOWN handler. Handle `FoodEaten` with a plain `if`, inside `try/catch` → `reportError('ui', err)`.
- [ ] **Task 9: `InputController`, pointer and `idle` mode** (AC: 1, 2, 4)
  - [ ] 9.1 Extend `src/input/InputController.ts`. It remains the single owner of gameplay input (AR8) and never touches `GameState`.
    - Constructor: `(input: Phaser.Input.InputPlugin, deps: InputDeps)`, with `InputDeps = { dispatch(cmd: Command): void; fence(): Rect; sheepAt(x: number, y: number): boolean }`. GameScene passes `fenceBounds(this.state)`, read on each call because the state object is replaced on restart.
    - Keep the keyboard from `input.keyboard` with its `null` handling. The F behaviour is unchanged.
    - Update the class doc comment.
  - [ ] 9.2 **Mode:** `private mode: InputMode = 'idle'`, with `type InputMode = 'idle'` (2.3 adds `breeding`, 2.7 `dragging`). Resolve a click with `switch (this.mode)` ending in `assertNever`.
  - [ ] 9.3 **Click vs drag (UX-DR66):** a click is a left-button press and release with less than 6 px of movement in between.
    - `pointerdown` with `pointer.leftButtonDown()`: remember `worldX`/`worldY` and arm the press.
    - `pointermove` while armed: once the pointer is ≥ `DRAG_THRESHOLD_PX` (6) from the down position, mark the press moved. Track the maximum distance, not just down-to-up.
    - `pointerup` (armed, not moved): resolve a click at the **down** position, then disarm.
    - `pointerupoutside` and `GAME_OUT`: disarm without acting.
    - A moved press does nothing (2.7 adds drag). Every listener is removed in `destroy()`.
  - [ ] 9.4 **Resolving a click in `idle` (UX-DR65).** Resolve on **release** (confirmed by Rylan 2026-10-06):
    1. If `deps.sheepAt(x, y)`: nothing.
    2. Else if inside `deps.fence()`: `deps.dispatch({ type: 'DropFood', x, y })`. A click on an existing piece counts as empty field.
    3. Else: nothing. Story 2.4 adds carcass clicks before step 2.
  - [ ] 9.5 **Sheep hit test:** extract `SheepHover`'s private `hitTest` into one shared, allocation-free function, for example `sheepIndexAt(items, layer, x, y)` (bounds + 6 px pad, front-most wins). `SheepHover` and `sheepAt` both use it, so hover and click agree.
  - [ ] 9.6 Call `input.mouse?.disableContextMenu()` once (UX-DR74).
  - [ ] 9.7 Guard every pointer handler body with `try/catch` → `reportError('input', err)`.
  - [ ] 9.8 The bottom bar (y ≥ 608) lies outside the fence (bottom at y 580), so HUD clicks never drop food. No cross-scene `topOnly` handling.
- [ ] **Task 10: HUD rework: Farm progress, food stock, refuse shake** (AC: 2, 6, 7, 8)
  - [ ] 10.1 **Replace `src/view/hud/FoodMeter.ts`** with two components, keeping its change-only `set()` pattern, baked `boxTexture` track and `setFrame(name, false, false)` pip swaps:
    - **`FarmProgress.ts`** (`COMPONENTS.farmProgress`): a `woolShade` track with 8 pips (`segmentCount`), each a `pip-food` / `pip-empty` image shown at about 14×14 via `setDisplaySize`, with a 2 px gap and 3 px padding (about 132 px wide). `set(progress, perFood)` fills `progress` pips.
    - **`FoodStock.ts`** (`COMPONENTS.foodStock`): the `icon-food` image plus "{n}/{cap}" (`STRINGS.meterValue`) in `numeric` `bark`, right-aligned in the fixed 62 px value box (UX-DR5). `set(food, cap)`. It owns `refuse()` (Task 10.3).
    - Delete `FoodMeter.ts` and its `bump()`. The at-cap bump no longer exists: at the cap, the click overflows to the field instead.
  - [ ] 10.2 **`BottomBar`:** under the Farm button (`METER_Y` row), place `FarmProgress` at `FARM_X`, then `FoodStock` to its right, so the row stays within the 232 px Farm width. Leave the remaining space for the 2.2 Farm Breeding Food group. The Farm tooltip becomes the constant `STRINGS.farmTooltip` = `'Farm: fill the bar for 1 food (F)'` (no parameter). Expose `farmProgress` and `foodStock` instead of `foodMeter`.
  - [ ] 10.3 **`FoodStock.refuse()` (UX-DR61, UX-DR29):**
    - **Flash:** an `alert` overlay built once with `boxTexture` over the read-out, hidden by default. On refuse, show it at alpha 1 and tween to 0 over about 300 ms.
    - **Shake:** tween the container's `x` about ±4 px, 3 to 4 cycles, about 250 ms, ending exactly at home.
    - `killTweensOf` both first and restore home `x` and alpha, so repeated refusals never drift. Keep the motion values together for Story 5.7 (the shake turns off under reduced motion; the flash stays).
  - [ ] 10.4 **`HudScene`:**
    - `refresh` (PRE_RENDER): `farmProgress.set(v.farmProgress, v.farmPipsPerFood)` and `foodStock.set(v.food, v.foodCap)`. Both are change-only.
    - `onSim`: for `Farmed` with `resource === 'food'`, spawn the "+N" popup (`STRINGS.farmPopup(e.added)`) **only when `e.added > 0`**; do nothing for `toField` (the field bounce is the feedback). For `SpendRefused` with `resource === 'food'`, call `foodStock.refuse()`. Use plain `if`s and keep the `try/catch`.
    - `farm()` (squash + dispatch) is unchanged.
  - [ ] 10.5 Update `deferred-work.md`: the 1.6 "Farm tooltip value (Story 4.7)" item is resolved by this change (the tooltip no longer depends on the hoe).
- [ ] **Task 11: Tests** (AC: 1–9)
  - [ ] 11.1 `tests/sim/commands.test.ts`. **Rewrite the Farm tests** (the +1-per-click tests no longer hold):
    - `farmPipsPerFood − 1` Farms raise `farmProgress` and leave food unchanged, each emitting `Farmed { added: 0, toField: 0 }`.
    - The next Farm adds 1 food, resets `farmProgress` to 0 and emits `added: 1`.
    - With `farmPipsPerClick` raised in a local test (or `farmProgress` preset), leftover pips carry over.
    - At the cap: food stays at the cap, one piece appears inside the inner fence, and `FoodDropped` comes before `Farmed { added: 0, toField: 1 }`. Above the cap: food is not lowered and it overflows the same way.
    - The overflow is deterministic for a seed: the same position twice.
  - [ ] 11.2 `commands.test.ts`, `DropFood`:
    - With food ≥ 1, food drops by `foodPerDrop`, a piece exists at the click, and `FoodDropped` carries it.
    - A click in the inset band is clamped into the inner fence.
    - With food 0: no piece, food stays 0, exactly one `SpendRefused`.
    - Outside the fence, `NaN` or `Infinity`: no piece, no spend, no event.
  - [ ] 11.3 `tests/sim/systems/feeding.test.ts` (new):
    - The nearest eligible sheep claims a piece; a sheep at ≥ `seekBelowFullness` is never assigned.
    - Two pieces and two sheep: one each, never two seekers on one piece.
    - Arrival: +`foodPieceFullness` capped at `fullnessMax`, piece gone, one `FoodEaten`, `eating` then `wander` after `eatMs`.
    - With no eligible sheep, pieces persist through a long `runFor`.
    - A stale `targetId` reverts to `wander` with `'targetId' in s` false.
    - A seeker that starves frees its piece, which is re-claimed.
    - A piece under a grazing sheep is still eaten (gotcha 4).
  - [ ] 11.4 `tests/sim/systems/movement.test.ts`: a `seekFood` sheep moves toward its piece at ≤ `walkSpeedPxPerS`, never overshoots, and stays inside the inner fence. An `eating` sheep does not walk.
  - [ ] 11.5 `tests/sim/scenarios/feeding.test.ts` (new):
    - **AC 5:** a sheep at a starving `TUNING` value (it must end above `fedAbove` after one piece, for example `starvingBelow − 5`) gets a `DropFood` beside it. It eats within distance / `walkSpeedPxPerS` plus a few ticks of slack, and `hungerOf` reads `'fed'`. JSON round-trip mid-seek and after eating.
    - **Overflow:** at the cap, `farmPipsPerFood` Farms put a piece on the field that a hungry sheep then eats.
    - **Pile:** 100 sheep (`fillFlock`) and 300 pieces run for some seconds. No piece has two seekers, pieces only decrease, and the run is deterministic for a seed.
  - [ ] 11.6 `tests/sim/selectors.test.ts`: `selectHudView` fills `farmProgress` / `farmPipsPerFood`. Fix the old "Farm on the next read" test for the new rule. `state.test.ts`: the `GameState` key list gains `farmProgress`. `events.test.ts`: keep narrowing on `type`.
  - [ ] 11.7 View code is not unit-tested (no Phaser in tests). It is verified in Task 12.
- [ ] **Task 12: Verification** (AC: 1–9)
  - [ ] 12.1 `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`. The debug overlay strings are absent from `dist/`.
  - [ ] 12.2 Browser checks (headless `playwright-core` + probe hook as in 1.6, removed afterwards, or by hand):
    - 7 Farm clicks fill 7 pips with no popup; the 8th empties the bar, pops "+1", and the stock goes up by 1 on that frame. `F` does the same.
    - At 20/20, the 8th click drops a bouncing piece onto the field (no popup); a hungry sheep goes to eat it.
    - A field click drops one piece where clicked (bounce) and the stock drops by 1 on that frame.
    - At 0 food a field click drops nothing; the stock read-out shakes and flashes `alert` and ends at home after repeated clicks.
    - A hungry sheep walks to a piece and eats it (munch crumbs); its sprite returns to the fed frame if it crossed 50.
    - Clicking a sheep does nothing. A press moved ≥ 6 px does nothing. A click in the rail band drops a piece just inside, which is reached.
    - Right-click shows no browser menu. The tooltip reads "Farm: fill the bar for 1 food (F)". The HUD row is inside the 16 px margin at 1280×720 and legible at 960×540.
    - After 3 debug Loads, one field click drops exactly one piece and one Farm click fills exactly one pip.
    - No console errors.
  - [ ] 12.3 Performance: about 100 sheep at ×1 with a pile of about 300 pieces. Compare with the 1.4 SwiftShader baseline (about 51.7 FPS mean) and report the numbers; Rylan decides on any follow-up.

## Dev Notes

### What exists today (read before changing)

- **`src/sim/commands.ts`:** only `Farm` (+`farmFoodPerClick` up to the cap; emits `Farmed { resource, added }`, with `added: 0` at the cap). Ends in `assertNever(cmd.type)`. Rewritten in Task 3.
- **`src/view/hud/FoodMeter.ts`** (1.6): a container of a baked track, 20 pip images and the value text; change-only `set()`; `bump()` for the at-cap case. Replaced by `FarmProgress` + `FoodStock` (Task 10). Reuse its techniques: baked `boxTexture` track, `setFrame(name, false, false)`, fixed-width right-aligned value.
- **`src/view/hud/BottomBar.ts`:** bar `Panel`, Farm `Button` at (16, 614), 232×64, with the meter row at `METER_Y` (track at y 682, ending ≤ 704 for the safe margin). Keep those positions.
- **`src/view/scenes/HudScene.ts`:** reads `selectHudView` on PRE_RENDER (same-frame updates), owns `farm()`, reacts to `Farmed` in `onSim` with a `reportError('ui')` guard, and removes listeners on SHUTDOWN. **Preserve** all of that.
- **`src/input/InputController.ts`:** keyboard only (F → `bus 'farm:pressed'`, ignoring repeats and Ctrl/Cmd/Alt). Only the constructor changes for keyboard.
- **`src/view/scenes/GameScene.ts`:** the sim loop (commands at the start of each tick, `step`, drain → `bus`), the sheep `EntityLayer`, `SheepHover`. **Preserve** the `reportError('sim')` guard, consuming `data.state`, and `launch('HudScene')`.
- **`src/view/field/SheepHover.ts`:** a private `hitTest` (bounds + 6 px pad, largest y wins). Extracted in Task 9.5.
- **`src/sim/systems/movement.ts`:** two passes; only `wander` exists. Do not change wanderers' rng draw order.
- **`src/sim/systems/carcass.ts` `killSheep`:** replaces `state.sheep` with a filtered array. Feeding uses no grid, so stale grid indices are not a concern here.
- **Debug overlay:** "+5 food" and "Feed all" mutate state through `debugMutate`; the food line already shows `pieces N`. "+5 food" can push the stock over 20; a Farm bar then overflows to the field, which is correct.

### Gotchas

1. **Architecture typo:** the State Patterns example uses `state.food.length`. Here `state.food` is the stock number; the pieces are `state.foodPieces`.
2. **`nextActivity` sketch:** the architecture's example recomputes activity every tick. Do not copy that; it would re-target sheep every tick and make them jitter. Use the claim model (Task 4.2). Story 2.5 adds `seekCarcass` into this system.
3. **Unreachable pieces:** a piece in the 40 px inset band is never eaten. Both `DropFood` and the Farm overflow go through `createFoodPiece`, which clamps into the inner fence.
4. **Separation vs reach:** a sheep standing on a piece pushes the seeker back to about `personalSpace × (1 − 1/separationWeight)` = 8 px. `eatReachPx` (12) must stay above that.
5. **Overshoot:** at 60 px/s a tick moves 6 px; use `min(walk, dist / DT)`.
6. **Phaser input:** scene-level `pointerdown/up/move/upoutside` on `this.input`, `pointer.worldX/worldY`. Check `node_modules/phaser/skills/input-keyboard-mouse-touch/`; no Phaser 3 code from memory.
7. **Commands while debug-paused** queue and apply on the next tick, like Farm today. Story 1.10 decides pause handling.
8. **`EntityLayer.playExit`** still releases immediately (the `playExit(done)` change is deferred to 2.4). An eaten piece vanishes at once; the crumbs cover it.
9. **Farm events order:** emit `FoodDropped` before `Farmed`, so the field has the piece before the HUD reacts. The HUD pops only when `added > 0`; it never pops for overflow.
10. **One Farm, one event.** A single Farm click with `farmPipsPerClick` > `farmPipsPerFood` (not possible at the base value, but possible when 2.8 and 4.7 stack) can complete more than one bar. The while loop and the counts in `added` / `toField` handle it; test it with a preset `farmProgress`.

### Architecture compliance

- Sim purity: `feeding.ts` and `commands.ts` import only `config`, `core` and `sim`. The overflow position uses `rngRange(state, …)`.
- Systems never call each other; `createFoodPiece` is a shared helper owned by the feeding system and called from `commands.ts`.
- Timers are absolute deadlines (`restUntil = time + eatMs`).
- No allocation in `step()`, systems, `update()` or `EntityLayer.sync`. Food sprites are pooled; crumbs come from one emitter.
- Colours only from `COLORS` / `COMPONENTS`. All copy comes from `STRINGS`; the only copy change is the Farm tooltip.
- Naming: `DropFood` (command), `FoodDropped` / `FoodEaten` / `SpendRefused` (events), `updateFeeding`, `FoodSprite.ts`, `FarmProgress.ts`, `FoodStock.ts`.

### File list (expected)

- **New:** `src/sim/systems/feeding.ts`, `src/view/field/FoodSprite.ts`, `src/view/hud/FarmProgress.ts`, `src/view/hud/FoodStock.ts`, `tests/sim/systems/feeding.test.ts`, `tests/sim/scenarios/feeding.test.ts`, `assets/art/world/food-piece.png`, `assets/art/world/munch-crumb.png`, `assets/art/ui/icon-food.png`, possibly `src/view/field/sheepHitTest.ts`.
- **Deleted:** `src/view/hud/FoodMeter.ts`.
- **Modified:** `src/config/tuning.ts`, `src/config/constants.ts`, `src/sim/state.ts`, `src/sim/commands.ts`, `src/sim/events.ts`, `src/sim/selectors.ts`, `src/sim/step.ts`, `src/sim/systems/movement.ts`, `src/input/InputController.ts`, `src/view/scenes/GameScene.ts`, `src/view/scenes/HudScene.ts`, `src/view/hud/BottomBar.ts`, `src/view/field/SheepHover.ts`, `src/view/strings.ts`, `src/view/assetKeys.ts`, `public/assets/atlases/{sheep-world,ui}.{png,json}`, `assets/CREDITS.md`, `tests/config/constants.test.ts`, `tests/sim/{commands,selectors,state,events}.test.ts`, `tests/sim/systems/movement.test.ts`, `_bmad-output/implementation-artifacts/deferred-work.md`.

### Previous story intelligence (1.6)

- The HUD reads state on scene `PRE_RENDER`, because Phaser updates scenes in **reverse** array order. Do not move it to `update()`.
- Handlers running inside the tick's drain or Phaser's input step need their own `try/catch` → `reportError`.
- Scene events persist across restarts; remove every listener on SHUTDOWN. Repeat the "exactly one listener after 3 Loads" check for the pointer listeners.
- Static shapes are baked with `boxTexture` (live `Graphics` cost about 5 FPS). Use it for the track and the flash overlay.
- `Image.setFrame(name)` resets the origin to the atlas pivot; use `setFrame(name, false, false)`.
- Placeholder PNGs come from a throwaway scratchpad encoder; commit only the PNGs, then `npm run assets`.
- Testing: red first for sim rules, assert on state and events, `TUNING` values only, narrow `SimEvent` on `type`.

### Git intelligence

Commits follow "Implement story X" then "Apply story X code review fixes". The branch `story/1-7-drop-food-and-sheep-eat` is already created off `main`. The sprint change proposal and the planning-doc edits for the Farm change are on this branch, uncommitted, alongside this story file.

### Latest tech information

No new dependencies; the stack is pinned (Phaser ~4.2.1, Vite 8, TS ~6.0, Vitest ~4.1). For particles, pointer events and tweens, `node_modules/phaser/skills/{particles,input-keyboard-mouse-touch,tweens}/` is the source of truth. The particle API is the v3.60+ style: `this.add.particles(x, y, texture, config)` returns the emitter; `explode(count, x, y)`.

### Project Structure Notes

- Feeding, the food stock rule and overflow drops live in `src/sim/` (`commands.ts` for Farm/DropFood, `systems/feeding.ts` for pieces and eating), as the updated System Location Mapping says.
- `FarmProgress` / `FoodStock` go in `src/view/hud/`; `FoodSprite` in `src/view/field/`.
- No conflicts with the unified structure.

### Project Context Rules

- Phaser 4, not 3. No physics; no `setInteractive` on sprites for gameplay input.
- No Phaser timers, tween `onComplete` or data stores for game state; tweens here are visual only.
- Listener cleanup on SHUTDOWN.
- Determinism: fixed seeds, `runFor`, no fake timers, `TUNING` in assertions; overflow placement uses the sim RNG.
- Derived values are never stored. `activity`, `targetId` and `farmProgress` are real state, not derived.
- Done = `npm test`, `npm run typecheck`, `npm run lint` (and `npm run build`) pass.

### References

- Change: `_bmad-output/planning-artifacts/sprint-change-proposal-2026-10-06.md`.
- Epic story: `_bmad-output/planning-artifacts/epics.md`, "Story 1.7" (updated ACs); FR3, FR4, FR5, AR8, UX-DR26, UX-DR29, UX-DR61, UX-DR65, UX-DR66, UX-DR74, UX-DR75, UX-DR78, UX-DR84, UX-DR90.
- GDD: `gdds/gdd-sheep-civilization-2026-10-05/gdd.md`, Farming and Feeding table, Hunger table, Core Click, Economy table; `decision-log.md` (2026-10-06).
- UX: `EXPERIENCE.md` (Component Patterns, State Patterns, Voice table); `DESIGN.md` (`farm-progress`, `food-stock`).
- Architecture: `_bmad-output/game-architecture.md`, State Management (`farmProgress`), Movement, Input Handling, State Patterns, Entity Patterns, N3, System Location Mapping.
- Project rules: `_bmad-output/project-context.md`.
- Previous story: `1-6-hud-bottom-bar-farm-button-and-food-meter.md`.
- Deferred items: `deferred-work.md`.

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created
- Reworked 2026-10-06 for the approved Farm progress bar change (sprint-change-proposal-2026-10-06)

### File List
