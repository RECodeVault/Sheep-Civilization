---
baseline_commit: 7cccafd
---

# Story 2.7: Drag a Sheep into the Better Place

Status: review

<!-- Created 2026-10-07 by create-story. Builds on 2.3 (InputController modes, press hit-testing), 2.4 (removal pipeline N1, toasts, field clicks), 2.5/2.6 (SheepSprite overlay stack, infection, pings), 1.10 (Esc chain, PenCamera) and 1.9 (save encode/validate). -->

## Story

As a player,
I want to drag any sheep into the Better Place to remove it and get a food boost,
so that I can stop an infection and feed a big flock faster.

## Acceptance Criteria

1. **The Better Place (UX-DR47, UX-DR48).** The field shows a fixed round hole: a `void` interior and a `halo` rim, on a dirt ring, with a few `halo` sparkle pixels. It sits in the upper-left of the play area, outside the fence, at world (520, 108) (the mockup position; see Dev Notes, "Placement and camera"). It reads as the Market's opposite: round, cold-glowing and void, never warm, wooden or rectangular. It never moves, and sheep never walk into it (it is outside the fence).
2. **The camera keeps it in view.** Every game opens centred on the **play area**: the pen plus the Better Place. A right-drag pan stays pinned so the whole play area remains in view, so a dragged sheep can always reach the hole. (This changes the 1.10 "centred on the pen" rule; see Open Question 1.)
3. **Drag start (FR16, UX-DR66).** A left press on a sheep in the default (`idle`) mode that moves more than 6 px starts a drag. Below 6 px it is a click, which keeps its current behaviour: it clears a carcass under the press, or does nothing. The sheep is hit-tested at the **press** point, in world coordinates (pointer + camera scroll), with the existing `spriteIndexAt` padding. A right press, a press on the bottom bar or a HUD control, and any press in breed mode never start a drag.
4. **While dragging (FR16, UX-DR52, UX-DR60, UX-DR67).** `InputController` is in `dragging` mode.
   - The sheep follows the pointer **every frame**, not one tick behind. It keeps the offset from where it was grabbed, lifted 4 px, in a legs-dangling frame for its stage, drawn above every other sheep.
   - It stops wandering: a `PickUp` command sets `activity = 'dragged'`. A dragged sheep is not steered, pushed or clamped, does not push other sheep, and claims no food, breeding piece or carcass. Hunger, the virus and old age still run, so it can die mid-drag (see AC 9).
   - Its sheep tooltip hides and stays hidden for the whole drag.
   - Its overlays (infection marker and wobble, ready heart, alert ping) and the infection tint follow the drawn sheep.
   - The Better Place highlights (`drop-target-better-place`): the `halo` rim brightens, a `haze` glow appears, the dashed outer ring shows and spins, and a "+2× food" label (`void` tag, `halo` text, `label` type) shows under the hole. While the pointer is over the hole, the highlight **intensifies**: the hole visibly sucks (the void pulses inward) and the ring spins faster.
5. **Sacrifice (FR18, FR20, UX-DR68, UX-DR80, UX-DR93, AR17).** Releasing with the **pointer** over the hole sacrifices the sheep. There is no confirmation, and any sheep can be sacrificed: lamb, adult, elder, infected, Starving or ready.
   - A `Sacrifice` command removes the sheep through `removeSheep(state, id, 'sacrificed')` with **no carcass**, `stats.sacrificed += 1` and `stats.died` unchanged.
   - It emits `Sacrificed { id, wasAbomination: false }` before any `Lost`.
   - A cartoon suction plays: the sheep's body shrinks and spins into the hole centre, then a burst of `halo` sparkles.
   - An announcement toast reads "A sheep went to a Better Place." (names arrive in 5.3).
   - Sacrificing the last sheep loses the game, through `checkLastSheepAndLoss` (FR38): the lose screen follows as for a starvation.
6. **Drop elsewhere (UX-DR67).** Releasing anywhere else puts the sheep down where it is drawn (pointer + grab offset, without the lift), clamped to the nearest point inside the inner fence. This includes the bottom bar, a HUD control, outside the fence and the area around the hole. A `Drop` command sets the position and returns the sheep to `wander`. The sprite never slides there from its pickup spot: it is held at the drop point until the command applies, then snaps.
7. **Cancel.** The drag cancels, and the sheep goes back to its pickup spot (a `Drop` at the spot recorded at drag start), when:
   - `Esc` is pressed. This is the third step of the Esc chain, after closing the start-over confirm and a sub-panel and before exiting breed mode (UX-DR73). It consumes the press, so a second `Esc` opens pause.
   - the button is released outside the canvas;
   - the window loses focus or the tab hides;
   - any modal opens, or the game is lost.
8. **No snap-back or double image.** At no frame does the sheep appear at its old sim position after a release, or show both its sprite and the suction ghost.
9. **Sheep gone mid-drag.** If the dragged sheep dies during the drag (starved, old age or virus), the drag ends at once with no command. Its carcass lies where it was picked up (its sim position), and the next press works normally. The sprite does not linger at the pointer.
10. **Saves.** A save written mid-drag (autosave, hide, debug Copy save) records the dragged sheep as `wander` at its sim position. `encodeSave` maps it on a copy and never mutates the live state. `'dragged'` is never a saved value, so `validateState` still rejects it. `SAVE_SCHEMA_VERSION` is unchanged (no saved field changed shape). The `GameState` round-trip test stays green.
11. **Secrecy (AR18, UX-DR64).** The view reads only `PublicSheep`. `PublicSheep` gains no field, and nothing in `src/view/` or `src/input/` reads `isAbomination`, `stalk` or `wasAbomination`. 4.4 reads `wasAbomination` for the reveal. The `Sacrificed` toast for now is the same for every sheep.
12. `npm test`, `npm run typecheck` and `npm run lint` all pass. Browser checks (Task 10) pass with no console errors.

## Tasks / Subtasks

- [x] **Task 1: Sim: the `dragged` activity and the drag commands (AC: 3, 4, 6, 7, 9)**
  - [x] 1.1 `src/sim/state.ts`: add `'dragged'` to `SheepActivity`. Update its doc comment: "drag.ts owns dragged (2.7)", and remove "(2.7)" from "Later stories add …".
  - [x] 1.2 New `src/sim/systems/drag.ts`, with no update function (pick-up and drop are commands, like `breeding.ts`). Header comment: what owns `dragged`, and that a dragged sheep keeps its sim position (the pickup spot) until it is dropped.
    - `pickUp(state, id)`: ignore an unknown id or a sheep that is already dragged. Set `activity = 'dragged'` and `delete s.targetId` (any claim is released; the piece goes back to the pool next tick). Draws no rng and emits nothing.
    - `drop(state, id, x, y)`: ignore an unknown id or a sheep whose activity is not `'dragged'`, since a stale Drop is harmless. Clamp `x`, `y` into `innerFence(state)`; non-finite coordinates keep the current position. Set `activity = 'wander'`. Draws no rng and emits nothing.
  - [x] 1.3 `src/sim/commands.ts`: append three variants (keep the union exhaustive) and route them:
    - `{ type: 'PickUp'; id: number }`
    - `{ type: 'Drop'; id: number; x: number; y: number }` (world px; the sim clamps)
    - `{ type: 'Sacrifice'; id: number }`

    Update the "Later stories append …" comment.
  - [x] 1.4 `src/sim/systems/movement.ts`:
    - In pass 1, add `case 'dragged':`, which sets `vx[i] = vy[i] = 0` and `continue`s before separation. It is in the air: no walk and no push.
    - In the separation loop, skip neighbours whose activity is `'dragged'`. The grid still contains them, so skip on read; no allocation.
    - In pass 2, skip dragged sheep (no integrate, no clamp, no heading flip).
    - Keep the `assertNever` default.
  - [x] 1.5 Check that the other systems already ignore `'dragged'`, and add a test for each (Task 8):
    - `feeding.ts`: `mayEatFood` lists the free activities; `mayEatBreedingFood` needs `wander`; passes 1–2 handle only seek/eating.
    - `carcass.ts`: pass 1 handles only `seekCarcass`; pass 2's `free` excludes `dragged`.
    - `hunger.ts`, `virus.ts` and `lifecycle.ts` still run on it (AC 9).
    - Do not add `'dragged'` checks where the activity filter already excludes it.
- [x] **Task 2: Sim: removal and sacrifice (AC: 5, 11)**
  - [x] 2.1 `src/sim/systems/carcass.ts` (it owns N1):
    - Add `export type RemoveReason = 'sold' | 'sacrificed'`.
    - Add `removeSheep(state, id, reason)`. An unknown id is `invariant(false, …)` and a return, as in `killSheep`. It runs `state.sheep = state.sheep.filter(...)`, increments `stats.sacrificed` or `stats.sold`, creates **no carcass and emits no event** (the caller emits its own event before calling), and ends with `checkLastSheepAndLoss(state)`.
    - Update the file header ("removeSheep … arrives in Epic 2" → it is here) and `checkLastSheepAndLoss`'s doc.
    - 3.1 reuses it for selling (money there).
  - [x] 2.2 New `src/sim/systems/betterPlace.ts` (architecture System Location Mapping: "Sacrifice, boost, reveal event").
    - `sacrifice(state, id)`: `sheepIndex`; a missing id returns silently. A sacrifice racing a death on the same tick is normal, not an invariant.
    - Emit `Sacrificed { id, wasAbomination: false }`, then `removeSheep(state, id, 'sacrificed')`. That order puts `Lost` after `Sacrificed`.
    - Comments: 2.8 sets `boostUntil` here, and 4.1/4.4 read `isAbomination` here for `wasAbomination`.
    - No rng, no `nextId`.
  - [x] 2.3 `src/sim/events.ts`: add `| { type: 'Sacrificed'; id: number; wasAbomination: boolean }`, with a comment: "the view must not branch on `wasAbomination` until Story 4.4 (secrecy)". Add `Sacrificed` to the header's variant list. 5.3 adds `name`, as it does for `SheepDied`.
- [x] **Task 3: Save: never persist `dragged` (AC: 10)**
  - [x] 3.1 `src/save/saveFile.ts` `encodeSave`: if any sheep is `'dragged'`, serialise a shallow copy whose `sheep` array maps those sheep to `{ ...s, activity: 'wander' }`. Allocating only on a save (every 10 s) is fine. Otherwise serialise the state as is. The live state is never mutated.
    - Comment why: no drag survives a reload, so a sheep saved as `dragged` would hang in the air for ever.
    - `writeSave` validates the encoded text, so it sees `wander`. Debug Copy save also goes through `encodeSave`.
  - [x] 3.2 `src/save/validate.ts`: leave `ACTIVITIES` without `'dragged'`, and add a comment that it is never saved (`encodeSave`). No migration and no `SAVE_SCHEMA_VERSION` bump: the saved shape is unchanged.
- [x] **Task 4: The Better Place and the camera (AC: 1, 2, 4)**
  - [x] 4.1 New `src/view/field/BetterPlace.ts`:
    - Export `BETTER_PLACE` geometry `{ x: 520, y: 108, holeRx: 70, holeRy: 30, hitRx: 76, hitRy: 35 }`, marked `[ASSUMPTION, mockups/hud.html; tune in the browser]`.
    - Export `betterPlaceBounds: Rect`: the dirt ring plus the label, used for the camera.
    - Export `inBetterPlace(wx, wy)`: a point-in-ellipse test on the `hit` radii.
    - The class builds pooled-forever images once (no `destroy` during play) from the `sheep-world` atlas: the glow, dirt+hole (normal and lit frames), the dashed ring (frames cycled to spin) and a label (a `void` box via `boxTexture` plus a `Text` in `TYPOGRAPHY.label`, `halo`, `STRINGS.betterPlaceLabel`).
    - Depths: below 0 (a ground band). Nothing walks there, and the dragged sheep, sparkles and overlays draw above it.
  - [x] 4.2 `setHighlight(level: 'off' | 'armed' | 'hovered')`, a no-op unless the level changes:
    - `off`: the plain hole only; glow, ring and label hidden; no tweens.
    - `armed`: the lit rim, the glow at `armed` alpha, the ring shown and cycling its frames at a slow rate, the label shown.
    - `hovered`: as armed, plus a fast ring cycle and a looping inward "suck" (the hole and inner void scale to about 0.9 and back, about 250 ms, yoyo).

    Start and stop tweens only on a change. The ring cycle may be a Phaser animation (`anims.create` once, guarded by `exists`) or a tweened counter mapped to frames; no per-frame `setFrame` unless the frame changes. Put the named motion constants in one `BP_MOTION` object (5.7 reduced motion).
  - [x] 4.3 `gulp()`: a one-shot squash of the hole when a sheep goes in (visual only).
  - [x] 4.4 `src/view/field/PenCamera.ts`: separate the **focus** (what to centre) from the **pinned area** (what must stay in view).
    - `centreOn(area)` and `panBy(dx, dy, area)` take the play area (pen ∪ `betterPlaceBounds`, built once per game in GameScene; 3.1 adds the Market, 3.3 regrows it).
    - Keep the existing clamp, and its "too big to fit → centre" rule.
    - Update the class comment: a game opens centred on the play area, and the pan keeps the whole play area in view (Open Question 1).
  - [x] 4.5 `GameScene.create`: build `BetterPlace` (before the sheep layer is fine; depths decide the order). Compute `this.playArea` = the union of `fenceBounds(state)` and `betterPlaceBounds` (a small helper; it allocates once). Pass it to `centreOn` and `panBy`.
- [x] **Task 5: Dragging in `InputController` (AC: 3, 4, 6, 7, 9)**
  - [x] 5.1 Mode becomes `'idle' | 'breeding' | 'dragging'`. Update the class and field comments (remove "2.7 adds drag" placeholders). Add `get dragging(): boolean`.
  - [x] 5.2 On a left press on the field in `idle` mode, record:
    - the carcass target (today's `clickTarget`);
    - **and** `dragTarget = hooks.sheepAt(x, y)`, from the same press-time hit test.

    In breed mode `dragTarget = 0`.
  - [x] 5.3 In `updateClick`, once the press passes the threshold (today it disarms):
    - If `mode === 'idle'` and `dragTarget !== 0`, call `hooks.beginDrag(dragTarget, downX, downY)`. If it returns true, enter `dragging`.
    - Otherwise disarm as now.
    - The click branch (release within the threshold) is unchanged.
  - [x] 5.4 New `updateDrag()`, called from `update()` after the pick check and before `updateClick`:
    - If the sheep is gone (`!hooks.dragAlive()`), go back to `idle` and send no command (AC 9).
    - If a modal is open, call `cancelDrag()`.
    - While the left button is down, call `hooks.moveDrag(p.x, p.y)`.
    - On release, call `hooks.endDrag(p.upX, p.upY)`, then go back to `idle`.

    It allocates nothing.
  - [x] 5.5 `cancelDrag(): boolean` returns true if a drag was live (it calls `hooks.cancelDrag()` and returns to `idle`). It is the Esc chain step.
    - `cancelPress()` (blur, hide) and `POINTER_UP_OUTSIDE` call it too.
    - `GAME_OUT` does **not** cancel a drag: the sheep waits at the last in-canvas point, and only a release outside cancels. Today `GAME_OUT` → `cancelClick` must keep doing exactly what it does for clicks.
  - [x] 5.6 While dragging, ignore new left and right presses (no pan, no breed-mode toggle). `toggleBreedMode` does nothing while dragging.
  - [x] 5.7 Extend `InputHooks` with `beginDrag(id, screenX, screenY): boolean`, `moveDrag(screenX, screenY)`, `endDrag(screenX, screenY)`, `cancelDrag()` and `dragAlive(): boolean`, with doc comments. Update the `esc` doc ("cancel drag (2.7)").
- [x] **Task 6: The drag view (`SheepDrag`) and GameScene wiring (AC: 4–9)**
  - [x] 6.1 New `src/view/field/SheepDrag.ts`, a plain class like `SheepHover`. It owns the geometry and the commands, so `InputController` stays a mode machine. It allocates nothing per frame and holds:
    - `heldId` (0 = none) and `live` (the pointer still holds it);
    - `grabDx/Dy` (sprite centre − press world point);
    - `originX/Y` (the sprite's drawn position at `begin`, for cancel);
    - `heldX/Y` (where the sheep is drawn, without the lift);
    - `releasedAt` (the `state.time` at release, or -1);
    - `overHole`.
  - [x] 6.2 Its methods:
    - `begin(id, sx, sy, state)`: look up `layer.spriteFor(id)`; if missing, return false. Record the offset, origin and held point, and dispatch `PickUp`.
    - `move(sx, sy)`: the world point = screen + camera scroll. `held = world + grab`. `overHole = inBetterPlace(world)`, using the **pointer**, not the sheep.
    - `end(sx, sy, state)`: update as in move. If `overHole`, dispatch `Sacrifice`; else dispatch `Drop` at the held point. Then `live = false` and `releasedAt = state.time`.
    - `cancel(state)`: dispatch `Drop` at the origin, set `held = origin`, `live = false`, `releasedAt = state.time`.
    - `alive()`: the sprite for `heldId` still exists.
    - `sync(state)`, each frame after `sheepLayer.sync`: drop the hold (`heldId = 0`, `sprite.release()`) once the sprite is gone, or once not live and `state.time > releasedAt`. Commands apply at the start of the next tick, and render runs after that tick in the same frame, so the snap lands on the frame the sim moves the sheep (AC 6, 8). Otherwise call `sprite.hold(heldX, heldY)`.
    - `highlight`: `live ? (overHole ? 'hovered' : 'armed') : 'off'`, fed to `BetterPlace.setHighlight` each frame (a no-op unless changed).
  - [x] 6.3 `GameScene`:
    - Wire the new hooks to `SheepDrag`.
    - Add `() => input.cancelDrag()` to the Esc chain between `closeSubPanel` and `exitBreedMode` (replace the "Story 2.7's cancel drag slots in here" comment).
    - In `update`, clear `sheepHover` while `inputController.dragging` (as for a modal or a HUD hover; AC 4).
    - In `render()`, call `this.sheepDrag.sync(this.state)` right after `sheepLayer.sync`, before `pregnancyLayer.sync`, so a dragged parent's heart follows it, then set the Better Place highlight.
    - `newGame`/restart rebuild everything (create builds a fresh `SheepDrag`).
  - [x] 6.4 Suction (UX-DR80). In `onSim`, on `Sacrificed`:
    - `const spr = this.sheepLayer.spriteFor(e.id)`; it is still bound, because `onSim` runs inside the tick and `render()`'s sweep comes later in the same frame.
    - If found, start a **ghost** from a small fixed pool (3 `Image`s built in `create`, reused round-robin; never `new` during play). The ghost copies the sprite's frame, `flipX`, tint and tint mode, scale, position and angle, at depth `FIELD_DEPTH.dragged`.
    - Tween it to the hole centre: scale → 0 and angle +360, about 400 ms, `Cubic.easeIn`, with `[ASSUMPTION]` constants in a `SUCTION` object.
    - On landing, burst `halo` sparkles (a new emitter with `FRAME.sparkle`, like `dust`) and call `betterPlace.gulp()`.
    - The real sprite leaves through the normal sweep the same frame (AC 8). `EntityLayer`/`playExit` are unchanged; see Dev Notes, "Exit animation".
  - [x] 6.5 `FIELD_DEPTH` (`depths.ts`): add `dragged: 9_996`, under `overlay` so the dragged sheep's own markers and hearts still draw over it, and above every world y. Add `ground: -10` (or similar) for the Better Place parts, with a comment.
- [x] **Task 7: `SheepSprite` hold, dangle and lift (AC: 4, 6, 8)**
  - [x] 7.1 Add `hold(x, y)` and `release()`.
    - `hold` marks the sprite held for this frame's draw point. `GameScene` calls it after `sync` each frame, so the hold wins.
    - It sets the position to `(x, y - LIFT_PX)` (`LIFT_PX = 4`, UX-DR60), depth `FIELD_DEPTH.dragged`, and the stage's `*-dragged` frame.
    - It re-places every overlay (ready or pinned heart, infection marker, ping) at the new point, through the same helpers `sync` uses: factor the overlay placement out of `sync` into `placeOverlays(x, y, simTime)` rather than duplicating it.
  - [x] 7.2 `sync` while held keeps tracking ticks (`prev/curr/lastTick`), so nothing is stale, but does not set the position.
    - The first `sync` after `release()` snaps: `prevX = currX = pub.x`, `prevY = currY = pub.y`, `lastTick = simTime`, the depth back to `y`, and the frame back to `SHEEP_FRAME[stage][hunger]` (force it with `shownStage = null`).
    - Update the class comment: "Story 2.7's drag snaps instead" (it currently says "must snap to the pointer instead").
  - [x] 7.3 `reset()` clears the held and snap state. A recycled sprite never comes back held, dangling or lifted.
  - [x] 7.4 Facing while held: keep the facing it had at pickup. The deadband logic runs only on tick changes and must not flip a held sheep.
- [x] **Task 8: Tests (AC: 3–7, 9–12)**. Vitest covers sim and save only; the view is browser-checked. Write each test red first, with `TUNING` values and literal seeds.
  - [x] 8.1 New `tests/sim/systems/drag.test.ts`:
    - **`PickUp`:** it sets `dragged` and removes `targetId`; an unknown id, or a sheep already dragged, changes nothing (use `structuredClone` with `toStrictEqual`); it draws no rng.
    - **`Drop`:** inside the inner fence it places exactly; outside, it clamps to each edge and corner; NaN or Infinity keeps the position; a sheep that is not dragged is ignored; afterwards the sheep is `wander`.
    - **A lost game:** `applyCommand` ignores all three commands.
  - [x] 8.2 `tests/sim/systems/movement.test.ts`:
    - A dragged sheep's position and heading are unchanged after `runFor(…, 2_000)`.
    - No push either way. Put a grazing sheep (`activity: 'wander'`, `restUntil` far in the future, so it does not walk) a few px from a dragged one, and step. Neither position changes. Without the drag, the same setup separates them; assert this as a control in the same test. This design is deterministic: a resting sheep draws no rng.
  - [x] 8.3 Feeding and carcass:
    - A dragged Hungry sheep with a food piece in reach is not claimed.
    - A dragged ready-to-be adult ignores breeding pieces.
    - A dragged Starving sheep ignores a carcass.
    - After `Drop`, each behaves normally again (it claims next tick).
    - A seeker that is picked up frees its piece, which another sheep claims.
  - [x] 8.4 `carcass.test.ts`, `removeSheep`:
    - It removes exactly that sheep, keeping order; no carcass; `stats.sacrificed` +1 (and `sold` +1 for `'sold'`); `died` unchanged; no rng; `nextId` unchanged; no events of its own.
    - An unknown id throws in DEV (the invariant) and leaves the state unchanged.
    - Removing the last sheep sets `lostAt` and emits `Lost`.
  - [x] 8.5 New `tests/sim/systems/betterPlace.test.ts`:
    - `Sacrifice` emits exactly `[{ type: 'Sacrificed', id, wasAbomination: false }]`, with no `SheepDied` or `CarcassSpawned`.
    - The last sheep: `Sacrificed` then `Lost`, and `lostAt === time`.
    - An unknown id is silently ignored: no change, no event.
    - Works on a dragged, an infected, a lamb and an elder sheep.
  - [x] 8.6 New scenario `tests/sim/scenarios/sacrifice.test.ts`:
    - **Breaking the chain (GDD: "cheap cure for infection"):** infect a sheep, sacrifice it, then `runFor(state, TUNING.virusDeathMs + TICK_MS)`: no `SheepDied`, no carcass, `infected` count 0.
    - **A pregnancy outlives a sacrificed parent:** the lamb is still born.
    - **A picked-up sheep starves mid-drag:** its carcass lies at its pickup position.
  - [x] 8.7 Save tests (`tests/save/saveFile.test.ts` / `roundTrip.test.ts`):
    - `encodeSave` of a state with a dragged sheep decodes with that sheep `wander`, and leaves the live state `toStrictEqual` its clone.
    - `writeSave` succeeds mid-drag.
    - `validateState` rejects `'dragged'`.
    - Existing round-trip tests stay green.
  - [x] 8.8 `npm test`, `npm run typecheck` and `npm run lint` (record the baseline count first). The ESLint `isAbomination` rule must stay green with no new disables.
- [x] **Task 9: Art and copy (AC: 1, 4, 5)**. Placeholder pixel art in the DESIGN palette, made with a throwaway scratchpad encoder (the 2.1–2.6 pattern). Commit only the PNGs.
  - [x] 9.1 `assets/art/sheep/{adult,elder}-dragged.png` (32×26) and `lamb-dragged.png` (22×26, drawn at the bottom of its frame like `lamb-idle`):
    - legs hanging straight down and a little longer, with no ground shadow (mockup `#s-dragged`);
    - elder in its greyer wool.
  - [x] 9.2 `assets/art/world/better-place.png`, about 78×36 (shown at 2×):
    - a dirt ring `#5E4A2C` (the mockup tone);
    - a `void` (#160E1C) ellipse with a 1–2 px `halo` (#F6D86B) rim;
    - a deeper inner void `#0B0610`;
    - 4 `halo` sparkle pixels.
  - [x] 9.3 `better-place-lit.png`: the same, with a thicker and brighter rim (mockup stroke 6 vs 3).
  - [x] 9.4 `better-place-glow.png`, about 140×78: a `haze` (#8E5BB0) glow in 3 stepped alpha bands (about .85/.35/0; pixel art, no smooth gradient).
  - [x] 9.5 `better-place-ring-1.png` … `-3.png`, about 76×35: a dashed `halo` ellipse at 50 % alpha, with the dashes shifted one step per frame so cycling reads as spinning.
  - [x] 9.6 `assets/art/world/sparkle.png`: a 2×2 or 3×3 `halo` plus-shape for the suction burst.
  - [x] 9.7 Run `npm run assets` (only `sheep-world` changes). Add the `FRAME` keys (`adultDragged`, `lambDragged`, `elderDragged`, `betterPlace`, `betterPlaceLit`, `betterPlaceGlow`, `betterPlaceRing1..3`, `sparkle`), and extend `assets/CREDITS.md`'s placeholder row and file list.
  - [x] 9.8 `src/view/strings.ts`:
    - `betterPlaceLabel: '+2× food'` (UX-DR96).
    - `sacrificeToast: 'A sheep went to a Better Place.'` (UX-DR93; 5.3 puts the name in, in `halo`).
    - No "!" and no banned words.

    `HudScene.onSim` shows it on `Sacrificed` as an announcement (`showToast(…, { announcement: true })`), one per event.
- [x] **Task 10: Browser check (AC: 1–9, 12)**. Use a scratchpad Playwright probe (the 2.3–2.6 pattern), driving the mouse with `page.mouse.move/down/up` in steps. Check:
  - [x] 10.1 **Layout:** a new game opens with the pen and the hole both in view, the hole upper-left, clear of the Pause button and the bar. Right-drag in every direction: the hole and pen never leave the view. Check at 960×540 too.
  - [x] 10.2 **Click vs drag:** a 4 px wiggle on a sheep does nothing; a click on a carcass still clears it; 8 px on a sheep starts a drag.
  - [x] 10.3 **While dragging:** the sheep is glued to the pointer with no tick lag, at the grab offset, lifted and dangling, and above the other sheep. The tooltip is hidden. The hole is armed (lit rim, glow, spinning ring, "+2× food"). Hover over the hole: it sucks and spins faster; leave: it goes back to armed.
  - [x] 10.4 **Overlays follow:** drag an infected, Starving, ready adult. The tint, bubbles, wobble, heart and ping travel with it, stacked as on the ground.
  - [x] 10.5 **Sacrifice:** drop on the hole. The suction ghost spirals in, sparkles burst, the hole gulps, the toast reads "A sheep went to a Better Place.", and there is no carcass. Dump state: `stats.sacrificed` +1. The threat counts update (an infected sheep sacrificed → Infected −1). There is no frame with both the sprite and the ghost.
  - [x] 10.6 **Drop:** on the field (placed where drawn, no slide), outside the fence (clamped inside, no slide), over the bottom bar and over the Pause button (dropped on the field and clamped; no button activates).
  - [x] 10.7 **Cancel:** Esc mid-drag → back at the pickup spot, and a second Esc opens pause. Alt-tab or hide → cancelled. Release outside the canvas → cancelled. Leave the canvas and come back while holding → still dragging.
  - [x] 10.8 **Last sheep:** sacrifice down to 0 → the lose screen ("The flock is gone."), and Restart works.
  - [x] 10.9 **Death mid-drag:** `Starve one`, pick that sheep up and hold. When it starves, the sprite vanishes from the pointer, a carcass appears at the pickup spot, and the next drag works.
  - [x] 10.10 **Breed mode:** a moving press on a sheep in breed mode does not drag. Breed (A, B) still works. Sacrificing a pinned A drops the pin.
  - [x] 10.11 **Save mid-drag:** start a drag, hide the tab (forced save), come back; reload → Continue: the sheep is on the ground wandering at its pickup spot.
  - [x] 10.12 **Recycling:** after a sacrifice, add sheep (`+10 sheep`). The reused sprites are clean: no lift, no dangling frame, no drag depth.
  - [x] 10.13 **Performance** (rendering story): about 100 sheep at ×1 with the overlay open, idle and while dragging, against the 2.6 baseline (37–40 FPS in SwiftShader). The armed Better Place adds at most two tweens. No per-frame allocation in `SheepDrag.sync`, `hold` or `setHighlight`.
  - [x] 10.14 No console errors or warnings beyond SwiftShader's GL notices.
- [x] **Task 11: Bookkeeping**
  - [x] 11.1 `deferred-work.md`:
    - Mark resolved: "`removeSheep` (Story 2.7 …)" (resolved for sacrifice; 3.1 adds sell); the 2.7 parts of the field-camera note (world-coordinate drag hit test; targets placed and the camera pinned to the play area); and "Exit animations" (2.7 used a pooled ghost for the suction, so `playExit` stays synchronous; 3.1 can reuse the ghost for the sale).
    - Add new items:
      - **3.1:** add the Market to the play area, plus its highlight and the invalid target;
      - **3.3:** a fence growing toward the hole: Land I stays clear, but check the later tiers;
      - **4.3:** a victim picked up mid-approach;
      - **4.4:** branch on `wasAbomination`;
      - **5.6:** the `[suction]` caption and SFX;
      - **5.7:** reduced motion for the suction, ring spin, suck pulse and lift.
  - [x] 11.2 Update the architecture only if Rylan asks. The camera change (Open Question 1) is worth a one-line note in `game-architecture.md` Input Handling if he confirms it.

## Dev Notes

### Current code to build on (read these first)

- **`src/input/InputController.ts`:**
  - Modes are `'idle' | 'breeding'`. Presses are tracked by **polling** `activePointer` in `update()` (`updateClick`, `updatePan`), not by up/move events: over a HUD button, Phaser's top-only input stops sending this scene moves and ups.
  - The press hit-test happens at the press (`clickTarget`), so a sheep wandering under a held pointer is never picked instead.
  - Threshold: `DRAG_THRESHOLD2` (6 px, squared). `FIELD_BOTTOM` excludes the bar. `pointerOnHud()` excludes the Pause button over the panned field.
  - `POINTER_UP_OUTSIDE` and `GAME_OUT` → `cancelClick`; `cancelPress()` runs on blur and hide.
  - The Esc handler walks `hooks.esc` in order.
  - The duplicate-keydown guards (`lastEscKey`, …) must stay.
- **`src/view/scenes/GameScene.ts`:**
  - `update()`: input (guarded as `ui`), then ticks, then `render()` (guarded as `sim`), then sheep hover.
  - `tick()` applies `pendingCommands` at the start of the tick, then steps and drains events into `bus` (`onSim` runs **inside** the tick, before `render()`).
  - `render()` syncs carcasses → pieces → sheep → pregnancies → breed markers.
  - The Esc chain has a marked slot for 2.7. `clearQueued` is the precedent for reading `pendingCommands`.
  - `onSim` holds the field juice (munch, poof, dust emitters at `FIELD_DEPTH.particles`).
- **`src/view/field/SheepSprite.ts`:**
  - Interpolation: `fresh`, `prev/curr`, `lastTick`, the multi-tick blend and the "time went backwards → snap" rule.
  - The overlay stack: `headY`, `heartY`, `stackTopY`, `overlayLift`, `pregnancyLift`.
  - Infection (tint MULTIPLY, marker, wobble); `shake` (owns the angle).
  - `reset()` must undo everything.
  - `SHEEP_FRAME[stage][hunger]` picks the frame; `shownStage`/`shownHunger` cache it.
- **`src/view/field/hitTest.ts`:** `spriteIndexAt` (sprite bounds + 6 px, front-most by y), shared by hover and clicks; reuse it for the drag pick.
- **`src/view/field/SheepHover.ts`:** the model for a per-frame view helper: world point = pointer + camera scroll (not `pointer.worldX`, and not `getWorldPoint`, which is a frame behind a pan). Its "Story 2.7: hide while dragging" comment is resolved by GameScene clearing it.
- **`src/view/field/PenCamera.ts`:** `centreOn(pen)`, `panBy(dx, dy, pen)`, clamp helpers, whole-pixel scroll with an exact float kept.
- **`src/view/field/EntityLayer.ts`:** `spriteFor(id)`; the sweep calls `playExit()` and releases at once.
- **`src/sim/systems/carcass.ts`:** `killSheep` (the pattern for `removeSheep`: filter, stats, events, then `checkLastSheepAndLoss`), and its header contract that callers loop over a captured array.
- **`src/sim/selectors.ts`:** `innerFence` (allocates; fine in a command), `sheepIndex`, `fenceBounds`.
- **`src/sim/systems/breeding.ts`:** the model for a command-only system module (no update function; re-checks rules because the view is a tick behind).
- **`src/view/scenes/HudScene.ts` `onSim`:** death toasts are counted and flushed per frame; the sacrifice toast is simpler (one per event).
- **`src/view/safetyNet.ts` `showToast(text, { announcement })`:** DOM toasts at top-centre, 3 max, about 4 s.
- **`src/save/saveFile.ts` `encodeSave`** and **`src/save/saveStore.ts` `writeSave`** (validates the encoded text before writing).
- **`src/config/constants.ts`:** `COMPONENTS.dropTargetBetterPlace` (`holeColor: 'void'`, `ringColor: 'halo'`, `glowColor: 'haze'`, `labelColor: 'halo'`, `shape: 'ring'`) already exists; use it. Also `TYPOGRAPHY.label`, `RADIUS.sm`, `SPACING`, `LAYOUT`.
- **`src/debug/DebugOverlay.ts`:** `Starve one`, `Infect one`, `+10 sheep`, `Ready adults`, Dump/Copy/Load save cover every check. No new button is needed. An optional DEV "Sacrifice one" is fine but not required.

### Placement and camera

- **World coordinates equal the mockup's canvas coordinates.** `TUNING.startFence` (556, 330, 380×250) was chosen inside the mockup's Land I fence (430–1062 × 184–598). The mockup's hole is the ellipse at (520, 108), rx 70 / ry 30, with a dirt ring rx 78 / ry 36 and a dashed outer ring rx 76 / ry 35 when armed. A label tag ("+2× food", `void`/`halo`) sits under it at about (474, 150). Using these world values keeps the hole clear of the Land I fence when 3.3 grows it in place.
- **Why the camera must change:** the 1.10 camera centres on the pen (scroll ≈ (106, 151)), which puts world y 108 at screen y −43, off the top. Centring on the play area (pen ∪ hole and label, about x 442–936, y 76–186+) gives a scroll of about (49, 24). The hole then lands at about screen x 471 (DESIGN.md: "about x 450–590"), and the pen sits at screen y about 306–556, above the bar (608). Pinning the pan to the play area means the hole can never be panned away mid-session. Record the measured numbers in the Dev Agent Record.
- **The hit test uses the pointer, not the sheep.** The player aims the cursor. Use the ellipse `(dx/hitRx)² + (dy/hitRy)² ≤ 1` at `BETTER_PLACE`; 152×70 px is well above `hit-min` (UX-DR90).

### Hold and snap (why the sheep never slides)

- The sim position of a dragged sheep stays at its pickup spot; only the sprite follows the pointer.
- On release, the `Drop` or `Sacrifice` applies at the start of the **next** tick. Until then the sim still says "at the pickup spot". If the sprite fell back to interpolation, it would jump there for a few frames, then slide to the drop point.
- `SheepDrag` therefore keeps holding the sprite at the drop point until `state.time > releasedAt`. That is the first `render()` after the tick that applied the command, in the same frame.
- `SheepSprite` then snaps `prev = curr = pub`, exactly as `fresh` does.
- While the sim is paused (menu, hidden tab, debug pause), time does not advance, so the hold simply continues. A cancel through a modal therefore shows the sheep at its pickup spot until play resumes.

### Exit animation (the suction)

- The N3 contract in the architecture is `playExit(done)` (asynchronous release), but the code has a synchronous `playExit()`, and the deferral moved the decision to 2.7/3.1.
- **Default:** a pooled ghost image in GameScene, started from `onSim`'s `Sacrificed` while the real sprite is still bound. Nothing in `EntityLayer` or the pools changes, and the sprite's overlays vanish with it.
- **Alternative:** async `playExit(done)` with a "leaving" set in `EntityLayer`. It is more general but touches every pooled sprite. It is only needed if a later story wants overlays to animate out too.

### What must be preserved

- **Click semantics:** an idle click (≤ 6 px) on a carcass clears it, a click on a sheep or empty field does nothing, and breed-mode picks and shakes are unchanged. The threshold is checked while held **and** at `upX/upY`, so a press, move and release inside one frame is a drag, not a click.
- **Right button:** right-click cancels breed mode, right-drag pans (with the new pinned area), and a press from the bar never pans.
- **The Esc chain order and duplicate-key guards;** shortcuts are ignored under a modal.
- **Movement determinism:** rng draws still happen in array order for non-dragged sheep. A dragged sheep draws nothing. Existing seeded movement/scenario tests must not change: no test should need new expected values, because none of them has a dragged sheep. If one changes, the code under test changed behaviour by mistake.
- **N1:** `killSheep` is unchanged; `removeSheep` is the only other remover; nothing else splices `state.sheep`.
- **2.5/2.6 visuals on a dragged or recycled sprite:** tint, marker bob, wobble, shake, ping pop and settle, hearts, and the pregnancy heart between parents.
- **Saves:** schema 5; the round-trip, corrupt-save and migration tests unchanged.
- **No allocation** in `update`, `render`, `sync`, `hold`, `SheepDrag.sync`, `setHighlight` or the movement tick. Commands and events are rare and may allocate.
- **Listener cleanup:** no new scene-level listeners are needed (input is polled). If any are added, remove them on SHUTDOWN.

### Architecture compliance

- **Locations:** `systems/betterPlace.ts` (architecture mapping); `removeSheep` in `systems/carcass.ts` (N1 owner); `systems/drag.ts` for pick-up and drop (new rule module, command-only); `view/field/BetterPlace.ts` (architecture tree: "field/ … BetterPlace"); `view/field/SheepDrag.ts`; `InputController` remains the single input owner (AR8).
- **State pattern:** `activity: 'dragged'` "set by drag command, cleared on drop" (architecture State Patterns). Movement: "dragged sheep are excluded from steering until dropped; a drop outside the fence is clamped back inside".
- **Commands in, events out:** `PickUp`, `Drop`, `Sacrifice` → sim; `Sacrificed` → view. The view never mutates `GameState`. Tweens and timers never change state.
- **Secrecy:** `Sacrificed.wasAbomination` exists for 4.4 only. The view must not branch on it yet. Add nothing to `PublicSheep`.
- **Copy and colours:** strings in `strings.ts`; colours from `COLORS`/`COMPONENTS`. The PNGs carry their own palette colours.

### Library / framework notes (Phaser 4.2.1 installed; no new dependencies)

- Already used in this codebase: tweens on objects and plain objects, `killTweensOf`, particle emitters with `explode`, `setTint` + `setTintMode`, `boxTexture`, `Text` with `textStyle`.
- For the ring spin, `this.anims.create({ key, frames: this.anims.generateFrameNames(ATLAS.sheepWorld, { prefix: 'better-place-ring-', start: 1, end: 3 }), frameRate, repeat: -1 })` with a guard `if (!this.anims.exists(key))` (animations are global and survive restarts), and `sprite.play(key)` / `anims.timeScale` for faster on hover.
  - This would be the first animation in the codebase: verify the v4 signatures in `node_modules/phaser/skills/` or `node_modules/phaser/types` before use.
  - A tweened counter that calls `setFrame` on a change is an acceptable fallback.
- Do not write Phaser 3 APIs from memory (`setTintFill`, `preFX`, `BitmapMask`, …). No containers or filters are needed.
- No web research was needed: no library or version changes.

### Testing standards

- Vitest covers `src/sim/` and `src/save/` only, in `tests/<same path as src>/`.
- Helpers: `newGame(seed)`, `runFor`, `fillFlock`, `innerFence` (`tests/sim/helpers.ts`) and `busyGame`/`isBusy` (`tests/save/busy.ts`; do **not** add a dragged sheep to `busyGame`, since validation rejects `dragged` by design).
- No fake timers, no Phaser, no mocking. Use `structuredClone` with `toStrictEqual` for "nothing changed". Drain events with `drainEvents`.
- The view (drag feel, hold and snap, highlight, suction, camera) is browser-checked in Task 10.

### Previous story intelligence (2.6, 2.5, 2.4)

- **Overlays follow the drawn position**, and every bob amplitude is part of the stacking offsets. Extract placement into one helper used by both `sync` and `hold` (Task 7.1) so the held sheep's stack can never drift from the grounded one.
- **`reset()` undoes everything:** 2.5 and 2.6 both verified recycled sprites. Do the same for hold, lift and the dangling frame (10.12).
- **Game-time, not Phaser timers,** decides view-rule timing (2.6's ping settle). Here the hold release keys off `state.time`.
- **Review learnings:** a comment orphaned when constants move (2.6); a ping overlapping a flopping carcass (2.6, fixed by popping on landing). Here, start the suction ghost from the **drawn** sprite transform (position, angle, flip, tint), not the sim position.
- **Browser probe:** `playwright-core` from `/home/rylanevans/nr-csp/frontend/node_modules` with `/usr/bin/google-chrome` (SwiftShader).
  - Run the DEV server on its own port (5200 worked).
  - Stop it with `kill <vite node pid>`, never `pkill -f`.
  - Plant saves through debug Load save (clipboard permissions granted), and read state with Dump state.
  - For drags, move the mouse in several steps (the threshold is checked per frame), and wait a frame or two between steps.
- **Art:** `npm run assets` packs deterministically. 2.5's marker was first drawn too small, so check the sizes against the mockup in the browser.
- **Commit style:** `Implement story 2.7: Drag a Sheep into the Better Place`.

### Git intelligence

- Recent commits: `7cccafd` (2.6 pings + summary), `d1289e6` (2.5 virus), `1132910`/`45bf67c` (2.4 carcasses, grouped death toasts), `e72bdb8` (2.3 review).
- The per-story pattern: a sim rule plus unit and scenario tests; a save touch if needed; a view sprite and juice; placeholder art and atlas; `deferred-work.md` notes; the Dev Agent Record with browser-probe results and FPS.

### Out of scope

- **2.8:** the boost (`boostUntil`, ×2 pips, the Farm glow, the boost timer). The "+2× food" label shows now because the AC asks for it; it becomes true in 2.8.
- **3.1:** the Market target, the invalid "Too young" target, selling, `Sold`, and money. Keep `removeSheep`'s `'sold'` reason ready.
- **4.1–4.4:** the Abomination, `wasAbomination: true`, and the reveal flash or caption. **4.3:** a victim picked up or sacrificed mid-approach.
- **4.5:** the medicine drag (InputController's `dragging` covers sheep only now; keep the mode name generic).
- **5.3:** names in the toast. **5.4:** the stats panel shows `sacrificed`. **5.6:** `[suction]` SFX and caption. **5.7:** reduced motion.
- Touch or keyboard dragging; dragging food pieces, carcasses or pregnancies; dragging in breed mode.

### Open questions (defaults chosen; confirm or change)

1. **Camera centring.**
   - **Default:** a game opens centred on the play area (the pen plus the Better Place; the Market joins in 3.1), and the pan is pinned to it. This revises Rylan's 1.10 rule ("every game opens centred on the pen above the bar"), which predates the drop targets.
   - **Alternative:** keep pen-centred and only clamp, so the hole stays in view. The pen then sits higher and the hole lands at about screen x 414, left of DESIGN's 450–590.
2. **Hole placement.**
   - **Default:** fixed world (520, 108), from the mockup, clear of the Land I fence.
   - **Alternative:** relative to the current pen (for example 60 px above its top-left). It moves when the land grows, so it is not "fixed".
3. **What counts as "in the hole".**
   - **Default:** the pointer is inside the outer-ring ellipse.
   - **Alternative:** the sheep's centre, or any overlap of the sheep's bounds.
4. **Drag in breed mode.**
   - **Default:** no; a moving press in breed mode does nothing, as today.
   - **Alternative:** a drag exits breed mode and starts.
5. **Right-click during a drag.**
   - **Default:** ignored (no pan, no cancel).
   - **Alternative:** it cancels the drag, like breed mode.
6. **Leaving the canvas while holding.**
   - **Default:** the drag continues, and only a release outside cancels.
   - **Alternative:** leaving cancels at once.
7. **The dangling frame drops the hunger pose** (one dragged frame per stage) [ASSUMPTION]. The tint and overlays still show infection and Starving (the ping).

### Project Structure Notes

- New files:
  - `src/sim/systems/{drag,betterPlace}.ts`
  - `src/view/field/{BetterPlace,SheepDrag}.ts`
  - `tests/sim/systems/{drag,betterPlace}.test.ts`
  - `tests/sim/scenarios/sacrifice.test.ts`
  - `assets/art/sheep/{adult,lamb,elder}-dragged.png`
  - `assets/art/world/{better-place,better-place-lit,better-place-glow,better-place-ring-1,better-place-ring-2,better-place-ring-3,sparkle}.png`
- Modified:
  - `src/sim/{state,commands,events}.ts`
  - `src/sim/systems/{carcass,movement}.ts`
  - `src/save/{saveFile,validate}.ts` (validate: comment only)
  - `src/input/InputController.ts`
  - `src/view/field/{SheepSprite,PenCamera,depths}.ts`
  - `src/view/scenes/{GameScene,HudScene}.ts`
  - `src/view/{strings,assetKeys}.ts`
  - `assets/CREDITS.md`
  - tests for carcass, movement, feeding, saveFile and roundTrip
- Regenerated: `public/assets/atlases/sheep-world.{png,json}`.
- No conflicts with the unified structure. `drag.ts` is a new system module not named in the architecture's list. It is command-only, like `breeding.ts`, and owns the `dragged` activity.

### Project Context Rules (from `_bmad-output/project-context.md`)

- **Phaser 4, not 3.** Verify any API not already used here (the animation API is new to this codebase).
- **The sim is pure:** no Phaser, DOM, `Date.now()` or `Math.random()`. Game rules live only in `src/sim/`. The view reads selectors and dispatches commands, and never mutates `GameState`.
- **N1:** non-sacrifice deaths go through `killSheep`; sacrifice and sale through `removeSheep`; both end with `checkLastSheepAndLoss`. Never splice `state.sheep` anywhere else.
- **The Abomination is secret:** `PublicSheep` only in the view; `wasAbomination` is the only truth channel (4.4).
- **No confirmations** on sacrifice; a misdrop is the joke (FR20, UX-DR68).
- **Timers** are absolute game-ms deadlines; nothing here adds one (the boost is 2.8).
- **No allocation in hot paths;** pool view objects (the ghost pool, BetterPlace parts built once); never `new`/`destroy` during play.
- **Sprites from the atlases;** no `Graphics` redrawn per frame (the label box is baked via `boxTexture`).
- **Copy** in `strings.ts` (no "!" except "Last sheep!"; never "corpse", "blood" or "kill"); **colours** from `COLORS`.
- **Input:** a single `InputController`; no `setInteractive` on field sprites; the field hit test uses pointer + camera scroll; the context menu stays disabled.
- **Save:** no field shape change → no `SAVE_SCHEMA_VERSION` bump. Wrap nothing new in storage (`encodeSave` is pure).
- **Done:** `npm test`, `npm run typecheck` and `npm run lint` pass, plus the browser checks and the 100-sheep performance spot check.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.7; FR16, FR18, FR20, FR38; AR8, AR17, AR18, AR19; UX-DR10, UX-DR47, UX-DR48, UX-DR52, UX-DR60, UX-DR64, UX-DR66, UX-DR67, UX-DR68, UX-DR73, UX-DR80, UX-DR90, UX-DR93, UX-DR96]
- [Source: _bmad-output/planning-artifacts/gdds/gdd-sheep-civilization-2026-10-05/gdd.md#The Better Place (Sacrifice); Controls (6 px threshold)]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-sheep-civilization-2026-10-05/DESIGN.md: Colors (`void`/`halo`/`haze`), components `drop-target-better-place`, Layout (Better Place x ≈ 450–590, Pause button clear of it), Elevation (four layers), Shapes (Market rectangular vs Better Place round), Do's and Don'ts]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-sheep-civilization-2026-10-05/EXPERIENCE.md: Interaction Primitives (drag, 6 px, both targets highlight, release rules, no confirmations, Esc chain), State Patterns (Dragged), Component Patterns (Tooltip hidden while dragging), Game Feel (Sacrifice), Voice (sacrifice toast)]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-sheep-civilization-2026-10-05/mockups/hud.html: the Better Place ellipse at (520, 108) normal and mid-drag (haze glow, rim stroke 6, dashed ring), the "+2× food" tag, `#s-dragged`]
- [Source: _bmad-output/game-architecture.md: Input Handling, Movement and Flock Spacing (dragged excluded, clamp on drop), State Patterns (`dragged`), N1 (`removeSheep`), N3, System Location Mapping (`betterPlace.ts`), Event System (`Sacrificed`)]
- [Source: _bmad-output/implementation-artifacts/deferred-work.md: `removeSheep` (1.8), Exit animations (1.2), Field camera (1.10), Pings above shop (2.6)]
- [Source: _bmad-output/implementation-artifacts/2-6-alert-pings-and-threat-summary.md (overlay stack, review findings, probe setup)]
- [Source: _bmad-output/project-context.md]

## Dev Agent Record

### Agent Model Used

Claude Opus 5.5 (1M context), `claude-opus-5-5[1m]`

### Implementation Plan

- **Sim:**
  - `SheepActivity` gains `dragged`. New command-only `systems/drag.ts`: `pickUp` sets `dragged` and drops any claim; `drop` clamps into `innerFence`, keeps the spot for non-finite input and returns the sheep to `wander`.
  - `removeSheep(state, id, 'sold' | 'sacrificed')` in `carcass.ts` (N1): no carcass, no event, counts the stat, ends with the loss check.
  - New `systems/betterPlace.ts` `sacrifice`: emits `Sacrificed { id, wasAbomination: false }`, then calls `removeSheep`.
  - Commands `PickUp`, `Drop` and `Sacrifice`.
  - Movement gives a dragged sheep no velocity and no separation, skips it as a neighbour, and neither integrates nor clamps it. No other system needed a change: their activity filters already exclude `dragged` (tested).
- **Save:** `encodeSave` writes a copy in which dragged sheep are `wander`, only when one exists. Validation still rejects `dragged`. No schema bump.
- **View:**
  - `field/BetterPlace.ts`:
    - `BETTER_PLACE` at world (520, 108), `BETTER_PLACE_BOUNDS` and `inBetterPlace` (pointer in the outer-ring ellipse);
    - glow, hole (plain and lit frames), dashed ring and a "+2× food" tag, built once at `FIELD_DEPTH.ground`;
    - `setHighlight('off' | 'armed' | 'hovered')`, `update(now)` (the ring spins by cycling frames from real time, changing the frame only on a step) and `gulp()`.
  - `field/SheepDrag.ts`:
    - It holds the grab offset, the pickup origin and the held point, and dispatches `PickUp`, `Drop` or `Sacrifice`.
    - A released sheep stays held (`pending`) until `state.time > releasedAt`, so it never slides back.
    - A sheep that dies mid-drag clears `live` with no command.
  - `SheepSprite.hold(x, y)` / `release()`:
    - While held, sync draws at the held point, lifted 4 px, in the stage's `*-dragged` frame, at `FIELD_DEPTH.dragged`. The overlays follow through the same code path.
    - On release, the next sync snaps `prev = curr = pub`, without flipping the facing.
  - `PenCamera` centres on and pins to the play area (pen ∪ Better Place).
  - `InputController`:
    - adds the `dragging` mode, and a `dragTarget` hit-tested at the press (idle only);
    - starts a drag past 6 px, including a press, move and release within one frame;
    - adds `updateDrag` and the `cancelDrag` Esc step;
    - `POINTER_UP_OUTSIDE`, blur, hide and any modal cancel; `GAME_OUT` does not;
    - ignores presses while dragging, and the Breed tool does nothing then.
  - `GameScene` wires the hooks, the Esc step, the hover hide, the hold sync (before the sheep layer syncs) and the highlight, plus the suction: a pooled ghost from `Sacrificed`, then a sparkle burst and a gulp.
  - The HUD shows the sacrifice toast.
- **Art:**
  - `sheep/{adult,lamb,elder}-dragged` (legs hanging straight, no feet);
  - `world/better-place{,-lit,-glow,-ring-1..3}` and `world/sparkle`;
  - `sheep-world` atlas rebuilt (34 frames, 230×233).

### Debug Log References

- **Red phase:** the new tests failed first. Two files could not load (no `drag` or `betterPlace` module yet), and 8 tests failed: unknown command variants, `removeSheep` not a function, and the dragged-save expectations. All pass after implementation: 425 → 458 tests (33 new, counting each `it.each` case).
- **Deviations from the task text:**
  - **Hold order (Task 6.2 / 7.1):** `SheepDrag.sync` runs **before** the sheep layer syncs and calls `hold(x, y)` for that frame. The held point is then the draw point inside `sync`, so the overlays (hearts, marker, ping) use the existing placement code and no `placeOverlays` refactor was needed.
  - **`dragAlive`** is `SheepDrag.live`, which `sync` clears when the dragged sheep is gone from state.
  - **Ring spin (Task 4.2):** `BetterPlace.update(now)` cycles frames instead of a Phaser animation (the story's allowed fallback).
  - **Geometry:** the `BETTER_PLACE` constant keeps only the centre and hit radii; the art is positioned by its centre.
- **Browser probe:** scratchpad `playwright-core` with system Chrome (SwiftShader) against the DEV server on port 5200; saves planted through debug Copy/Load save. Checks, all passing, with no console errors or warnings:
  - **Layout:** the game opens with the pen and the hole in view (scroll 49, 24); the hole sits at screen ≈ (471, 84), x 393–549.
  - **Panning:** right-drag in all four directions keeps the hole and the pen in view.
  - **960×540:** legible.
  - **Click vs drag:** a 3 px wiggle does not move the sheep.
  - **Armed and hovered:** the rim lights, the haze glow and dashed ring show, "+2× food" appears, and over the hole it sucks and spins faster.
  - **Overlays:** an infected, Starving sheep carries its tint, bubbles and ping while dragged.
  - **Sacrifice:** the ghost spirals in and the toast shows; no carcass; `stats.sacrificed` is 1; the threat counts drop.
  - **Drop:** at world (720, 500) the sheep lands exactly there, with no slide across 4 frames right after release. A drop at (1100, 200) clamps to (896, 370). A drop over the bottom bar is clamped into the pen.
  - **Cancel:** Esc returns the sheep to its pickup spot, and a second Esc opens pause. A release off the canvas (1600-wide viewport) cancels. Leaving the canvas and returning while holding keeps the drag.
  - **Breed mode:** a moving press does not drag.
  - **Death mid-drag:** the sheep starves, its carcass lies at the pickup spot (650, 420), and the next drag works.
  - **Autosave mid-drag (after 10 s):** the save holds the sheep as `wander`.
  - **Last sheep:** sacrificing down to 0 shows "The flock is gone." with both toasts.
  - **Recycling:** after a sacrifice, +100 sheep come back clean.
- **Performance** (Task 10.13; SwiftShader, 102 sheep, ×1, overlay open): 39 FPS idle (2.6 baseline 37–40) and 35 FPS while dragging continuously (Playwright mouse moves each frame, armed glow and ring). Per frame, `SheepDrag.sync`, `hold`, `setHighlight` and `BetterPlace.update` allocate nothing.

### Completion Notes List

- 2026-10-07: Story created. The context engine analysis is complete, and this file is the developer guide.
- 2026-10-07: Implemented. All ACs are met; the Open Questions are implemented at their defaults:
  - the camera centres on and pins to the play area;
  - the hole is fixed at the mockup position;
  - the pointer decides "in the hole";
  - no drag in breed mode;
  - a right press is ignored while dragging;
  - leaving the canvas keeps the drag;
  - one dangling frame per stage.
- AC 1–2: Better Place and play-area camera (browser). AC 3–4: drag start and the dragged state (tests and browser). AC 5: `Sacrifice` → `removeSheep` → `Sacrificed`, then `Lost` (tests); suction and toast (browser). AC 6–8: drop, clamp, cancel and no slide (tests and browser). AC 9: death mid-drag (tests and browser). AC 10: save mapping (tests and browser autosave). AC 11: no `PublicSheep` change; `wasAbomination` is unused in the view. AC 12: `npm test` (458), `npm run typecheck` and `npm run lint` pass.
- `deferred-work.md`: resolved `removeSheep`, Exit animations and the 2.7 parts of the field-camera note; added a 2.7 section (3.1 Market, 3.3 fence vs hole, 4.3 dragged victim, 4.4 reveal, 5.6 audio, 5.7 reduced motion).

### File List

- `src/sim/state.ts` (modified)
- `src/sim/commands.ts` (modified)
- `src/sim/events.ts` (modified)
- `src/sim/systems/carcass.ts` (modified)
- `src/sim/systems/movement.ts` (modified)
- `src/sim/systems/drag.ts` (new)
- `src/sim/systems/betterPlace.ts` (new)
- `src/save/saveFile.ts` (modified)
- `src/save/validate.ts` (modified, comment only)
- `src/input/InputController.ts` (modified)
- `src/view/field/BetterPlace.ts` (new)
- `src/view/field/SheepDrag.ts` (new)
- `src/view/field/SheepSprite.ts` (modified)
- `src/view/field/PenCamera.ts` (modified)
- `src/view/field/depths.ts` (modified)
- `src/view/scenes/GameScene.ts` (modified)
- `src/view/scenes/HudScene.ts` (modified)
- `src/view/strings.ts` (modified)
- `src/view/assetKeys.ts` (modified)
- `assets/art/sheep/adult-dragged.png`, `assets/art/sheep/lamb-dragged.png`, `assets/art/sheep/elder-dragged.png` (new)
- `assets/art/world/better-place.png`, `better-place-lit.png`, `better-place-glow.png`, `better-place-ring-1.png`, `better-place-ring-2.png`, `better-place-ring-3.png`, `sparkle.png` (new)
- `assets/CREDITS.md` (modified)
- `public/assets/atlases/sheep-world.png`, `public/assets/atlases/sheep-world.json` (regenerated)
- `tests/sim/systems/drag.test.ts` (new)
- `tests/sim/systems/betterPlace.test.ts` (new)
- `tests/sim/scenarios/sacrifice.test.ts` (new)
- `tests/sim/systems/carcass.test.ts` (modified)
- `tests/save/saveFile.test.ts` (modified)
- `tests/save/saveStore.test.ts` (modified)
- `tests/save/validate.test.ts` (modified)
- `_bmad-output/implementation-artifacts/deferred-work.md` (modified)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modified)
- `_bmad-output/implementation-artifacts/2-7-drag-a-sheep-into-the-better-place.md` (this story)

### Change Log

- 2026-10-07: Implemented Story 2.7. Dragging sheep (`dragged` activity; `PickUp`/`Drop`/`Sacrifice` commands), `removeSheep` and the `Sacrificed` event, the Better Place with drag highlight and suction, the play-area camera, the save mapping for mid-drag saves, placeholder art and 33 new tests. Status → review.
