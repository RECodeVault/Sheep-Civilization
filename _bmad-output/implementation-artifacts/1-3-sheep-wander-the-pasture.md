---
baseline_commit: 8842ba4a40eac8633a6f49755f44c71e50e5446a
---

# Story 1.3: Sheep Wander the Pasture

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a player,
I want my sheep to wander naturally inside the fence without piling on top of each other,
so that the flock feels alive and readable at a glance.

## Acceptance Criteria

1. **Steering movement.** Given sheep in the `wander` activity, when the sim steps, each sheep moves by steering (wander + separation + fence containment). Its speed never exceeds the walk speed from `TUNING` (60 px/s, so 6 px per 100 ms tick), and it never leaves the fenced area (FR5 walk speed, AR5).
2. **Separation through the grid.** Given two sheep closer than the 24 px personal-space radius (`TUNING`), when ticks run, separation pushes them apart.
   - Neighbour queries go through a 48 px uniform grid in `src/sim/grid.ts`, rebuilt once per tick. There is never an all-pairs loop (AR5).
3. **Smooth rendering.** Given the 10 Hz sim and a 60 Hz display, when sheep move, rendering interpolates between the previous and current tick positions. Those positions are stored **on the sprites**, so motion is smooth and `GameState` has no `prevX`/`prevY` (AR4).
4. **100-sheep scenario.** Given a seeded scenario test with 100 sheep, when 600 ticks run, all sheep stay inside the fence and the run is deterministic for the same seed.
5. **Green gate.** `npm test`, `npm run typecheck`, `npm run lint` and `npm run build` all pass.

## Tasks / Subtasks

- [x] **Task 1: Tuning values** (AC: 1, 2)
  - [x] 1.1 Add these keys to `TUNING` in `src/config/tuning.ts`, each with a short source comment:
    - `walkSpeedPxPerS: 60` (GDD: "Walk speed 60 px/s (tune)").
    - `personalSpacePx: 24` (GDD Abomination tells: "normal 24 px personal space (tune)"). Do **not** add the 36 px Abomination value; Story 4.2 owns it.
    - `gridCellPx: 48` (architecture: 48 px uniform grid).
    - Wander feel, all **[ASSUMPTION, tune in 3.6]**:
      - `wanderTurnRad: 0.35`: the most the heading can turn in one tick.
      - `wanderRestChance: 0.02`: per-tick chance that a walking sheep stops to graze. This gives a mean walk of about 5 s.
      - `wanderRestMinMs: 1_500` and `wanderRestMaxMs: 4_000`: how long a grazing stop lasts.
      - `separationWeight: 1.5`: separation speed at full overlap, as a multiple of walk speed, before the total cap.
      - `fenceTurnMarginPx: 24`: within this distance of the inner fence edge, the heading turns back toward the pen.
  - [x] 1.2 **Rename `spawnInset` → `fenceInset`** (same value, 40) and update its comment. It is now the sheep-centre margin from the fence for **both** spawning and movement. Update `createNewGame` and the `spawnInset` test in `tests/sim/state.test.ts`. There must be exactly one inset value, so spawn and containment can never disagree.
- [x] **Task 2: Sheep data for wandering** (AC: 1, 4)
  - [x] 2.1 Add two fields to `Sheep` in `src/sim/state.ts`:
    - `heading: number`: the wander direction in radians, persisted so a saved game resumes the same walk.
    - `restUntil: number`: absolute game-ms deadline. While `state.time < restUntil` the sheep grazes in place (no wander velocity, but separation still applies).
  - [x] 2.2 `createSheep` sets `heading` with `rngRange(state, 0, 2 * Math.PI)` and `restUntil: 0`. This adds rng draws during `createNewGame`, so spawn positions change versus 1.2. No test pins exact positions, so that is fine.
  - [x] 2.3 No save migration is needed: saving arrives in Story 1.9, so `SAVE_SCHEMA_VERSION` stays 1 (same reasoning as Story 1.2 Task 3.1).
  - [x] 2.4 Do **not** add velocity, `prevX`/`prevY`, a target id, or `isAbomination`. Velocity is recomputed every tick (Task 4), previous positions live on sprites (Task 6), and seek targets arrive with feeding in Story 1.7.
- [x] **Task 3: `src/sim/grid.ts`: the uniform spatial grid** (AC: 2)
  - [x] 3.1 The grid is **derived scratch data, not state.** Keep it in module-scope typed arrays (same precedent as the event queue in `events.ts`). It is never saved and is rebuilt every tick, so load and restart need no special handling.
  - [x] 3.2 Cover the whole canvas (`CANVAS_WIDTH` × `CANVAS_HEIGHT` from `config/constants.ts`) in `TUNING.gridCellPx` cells: 27 × 15 = 405 cells. Clamp positions into the grid range. That way the grid needs no change when the fence grows in Epic 3.
  - [x] 3.3 `rebuildGrid(sheep: readonly Sheep[]): void`. Use a counting sort (count per cell → prefix sums → fill an index array) into `Int32Array`s. Grow the index array only when the flock outgrows it, by doubling. Do not allocate per call otherwise.
  - [x] 3.4 `queryNeighbours(sheep, i, radius, out: number[]): number` writes into `out` the indices `j ≠ i` with distance < `radius`, scanning only the 3 × 3 block of cells around sheep `i`, and returns the count. Set `out.length` to the count, or document that callers read only `[0, count)`; reuse one module-scope `out` array in the caller.
    - `invariant(radius <= TUNING.gridCellPx, …)`: a 3 × 3 scan is only correct up to one cell of radius. The 36 px Abomination radius (Story 4.2) still fits.
  - [x] 3.5 The returned values are **indices into `state.sheep`**, valid only until `state.sheep` changes. Document this in a comment. Only movement uses the grid in Epic 1, and it runs first in the tick, before anything can remove a sheep.
- [x] **Task 4: `src/sim/systems/movement.ts`: `updateMovement(state)`** (AC: 1, 2)
  - [x] 4.1 This is the first file in `src/sim/systems/`. Export `updateMovement(state: GameState): void` (naming: `update<System>`).
  - [x] 4.2 **Two passes, so the result does not depend on array order:**
    1. `rebuildGrid(state.sheep)`. For each sheep, compute its velocity from **start-of-tick** positions and write it into module-scope `Float64Array` scratch (`vx`, `vy`), grown on demand.
    2. Then integrate every sheep: `x += vx * dt`, `y += vy * dt`, with `dt = TICK_MS / 1000`. Then clamp to the inner fence rect (4.6).
  - [x] 4.3 **Per-activity desired motion:** `switch (s.activity)` with only `case 'wander'` and a `default: assertNever(s.activity)`. Story 1.7 adds `seekFood` here. This switch narrows correctly, because `s.activity` is a string union and not the object (compare the `assertNever(cmd.type)` note from Story 1.2).
  - [x] 4.4 **Wander:**
    - If `state.time >= s.restUntil` (walking): first roll `rng(state) < TUNING.wanderRestChance`; on success set `restUntil = state.time + rngRange(state, wanderRestMinMs, wanderRestMaxMs)` and treat the sheep as grazing this tick. Otherwise turn the heading by `rngRange(state, -wanderTurnRad, wanderTurnRad)` and set the wander velocity to `(cos h, sin h) × walkSpeedPxPerS`.
    - If grazing: the wander velocity is 0, and the heading does not change.
    - Every rng draw goes through `state.rng`, in a fixed order per sheep in array order, so the run is deterministic.
  - [x] 4.5 **Separation:** for each neighbour `j` returned by `queryNeighbours(…, TUNING.personalSpacePx, …)`, add `unit(pi − pj) × (1 − d / r)`. Scale the sum by `separationWeight × walkSpeedPxPerS`.
    - **Exactly coincident sheep (`d === 0`):** use a deterministic direction without rng, for example along +x for the higher id and −x for the lower. Never divide by zero; a `NaN` position becomes `null` in JSON and breaks saves.
    - When the separation sum is non-zero and the sheep is walking, also turn the heading toward the separation direction (for example, set it to `atan2` of the combined vector). This keeps sheep from walking back into each other the next tick.
  - [x] 4.6 **Fence containment:**
    - Inner rect = `fenceBounds(state)` inset by `TUNING.fenceInset` on every side.
    - **Soft:** when a walking sheep is within `fenceTurnMarginPx` of an inner edge and heading outward, steer the heading toward the pen centre, so sheep turn back instead of sliding along the rail.
    - **Hard:** after integration, clamp `x` and `y` into the inner rect. If clamping happened on an axis, flip that axis of the heading so the next tick walks inward. The hard clamp is what guarantees AC 1 and AC 4; the soft turn is only for looks.
  - [x] 4.7 **Speed cap:** clamp the total velocity (wander + separation) to `walkSpeedPxPerS`, so no sheep ever moves more than 6 px in a tick (AC 1).
  - [x] 4.8 **No allocation:** no object or array literals, closures, spreads, `.map`/`.filter` or string building in `updateMovement`, `rebuildGrid` or `queryNeighbours`. Use plain numbers and the module-scope scratch.
- [x] **Task 5: Register the system** (AC: 1)
  - [x] 5.1 In `src/sim/step.ts`, set `SYSTEMS = [updateMovement]`. Keep the existing order comment (movement is first).
  - [x] 5.2 Update the `tests/sim/step.test.ts` test "emits nothing while no system is registered". Movement emits nothing, so keep the assertion and rename it, for example to "movement emits no events".
- [x] **Task 6: Interpolated rendering** (AC: 3)
  - [x] 6.1 Extend the N3 contract with the sim time, so sprites know when a new tick arrived:
    - `PooledEntitySprite.sync(item, alpha, simTime)` and `EntityLayer.sync(items, alpha, simTime)`.
    - `GameScene.render()` passes `this.state.time`.
  - [x] 6.2 `SheepSprite` keeps view-only fields `prevX`, `prevY`, `currX`, `currY`, `lastTick` and a `fresh` flag:
    - On the first `sync` after `bind`: `prev = curr = (pub.x, pub.y)` and `lastTick = simTime`, so a reused pooled sprite never slides in from its old position.
    - When `simTime !== lastTick`: `prev = curr`, `curr = (pub.x, pub.y)`, `lastTick = simTime`.
    - Draw at `prev + (curr − prev) × alpha`. Call `setPosition`/`setDepth` only when the drawn value changed.
    - `reset()` clears the fresh flag back to true.
    - If several ticks run in one frame, `prev` is the last tick this sprite saw. That is acceptable: the lerp segment is a little longer, and it only happens on slow frames or at debug speed.
  - [x] 6.3 Rendering is **one tick behind** the sim (standard fixed-step interpolation). Story 2.7's drag will need to snap; note it in a comment.
  - [x] 6.4 **Depth** = drawn (interpolated) y, the same rule as now, so the front fence rails still sort correctly.
  - [x] 6.5 **Facing:** the placeholder `adult-idle` frame faces **right**. Set `setFlipX(true)` when `currX − prevX < −0.5` and `false` when `> 0.5`; otherwise keep the last facing. That stops grazing sheep from flickering. Facing is view-only and derived from motion; do **not** add `heading` to `PublicSheep`.
  - [x] 6.6 Leave `PublicSheep` as `{ id, x, y }`. No walk-cycle art exists yet; walk frames and a bob are polish (Story 5.8). Do not add new atlas frames in this story.
- [x] **Task 7: Tests** (AC: 1, 2, 4)
  - [x] 7.1 `tests/sim/grid.test.ts`:
    - For 100 sheep at rng-seeded positions, `queryNeighbours` returns exactly the same index set as a brute-force distance check, for every sheep (brute force is fine in a test).
    - Neighbours across a cell boundary are found; a sheep never returns itself; positions at or beyond the canvas edge do not throw.
    - Querying with `radius > gridCellPx` hits the invariant in DEV.
  - [x] 7.2 `tests/sim/systems/movement.test.ts` (new folder, mirroring `src/sim/systems/`):
    - **Speed cap:** over 600 ticks, every sheep's per-tick displacement is ≤ `walkSpeedPxPerS × TICK_MS / 1000` (+ 1e-9).
    - **Lone walker moves:** a single sheep with `restUntil` in the past moves on most ticks over 10 s, and its total distance is > 0.
    - **Grazing:** a sheep with `restUntil` in the future and no neighbours does not move until then.
    - **Separation:** two grazing sheep 1 px apart (set `restUntil` far in the future, so only separation acts). Their distance increases on every tick while it is below `0.9 × personalSpacePx`, and reaches ≥ `0.9 × personalSpacePx` within 2 s. Separation falls off as `1 − d / r`, so asserting exactly `r` would never pass.
    - **Coincident sheep:** two sheep at the identical point separate, and all coordinates stay finite.
    - **Wall:** a sheep placed at the inner edge with its heading pointing straight out stays inside on every tick.
  - [x] 7.3 `tests/sim/scenarios/wander100.test.ts`, the AC 4 scenario:
    - Build with `newGame(seed)`, then add sheep with `createSheep` at rng positions inside the inset fence until there are 100.
    - Run 600 ticks. On **every** tick (not only at the end), every sheep is inside the inner rect and every coordinate is finite.
    - Two runs with the same seed are `toStrictEqual`; a different seed differs.
    - **Resume determinism:** after 300 ticks, `JSON.parse(JSON.stringify(state))` the state, run both the original and the copy 300 more ticks, and assert they are `toStrictEqual`. This proves no movement state hides outside `GameState` (it seeds the mandatory save test in Story 1.9).
    - 100 sheep do not fit comfortably in the starting fence, so do **not** assert spacing here. Spacing is covered by the separation unit test.
  - [x] 7.4 Add a shared helper to `tests/sim/helpers.ts` (for example `addSheep(state, n)` or `innerFence(state)`) if two or more test files need it. Use `TUNING` values in every assertion, never re-typed numbers.
  - [x] 7.5 Keep the existing `state.test.ts` JSON round-trip test: it now runs 10 s **with** movement, which is a useful extra check.
- [x] **Task 8: Verification** (AC: 1, 3, 5)
  - [x] 8.1 `npm test`, `npm run typecheck`, `npm run lint` and `npm run build` are green. Record the counts.
  - [x] 8.2 **Tick budget:** with a throwaway script in the scratchpad (not committed), time 6 000 `step` calls on a 100-sheep state. The mean must be ≤ 2 ms per tick (project-context performance budget). Record the number.
  - [x] 8.3 **Browser check** (`npm run dev`, headless Chrome as in Stories 1.1 and 1.2, or a real browser):
    - The 3 sheep wander, graze, turn back at the fence and never overlap the rails.
    - Motion is smooth at 60 Hz, with no 10 Hz stepping.
    - Facing flips with direction and does not flicker while grazing.
    - Sheep in front of the bottom rail and behind it sort correctly.
  - [x] 8.4 **100-sheep visual check:** temporarily set `interimFlockAdults` to 100 locally, look for smoothness and stutter, then **revert** it. The debug overlay with its FPS counter arrives in Story 1.4, so record what you saw (and Chrome's FPS meter if you use it), and note that the formal 5-minute 100-sheep perf check runs once the overlay exists.
  - [x] 8.5 Record evidence for every manual check in the Dev Agent Record (a lesson from the 1.1 review).

### Review Findings

Code review 2026-10-06 (Blind Hunter + Edge Case Hunter + Acceptance Auditor) on `8842ba4..09d896b`. The auditor judged AC 1–5 met and the three disclosed deviations justified.

- [x] [Review][Patch] Hot-path string building: `queryNeighbours` evaluates its invariant template literal on every call (100 strings per tick at 100 sheep), and `rngRange`, now called per walking sheep per tick, does the same. In production a radius over one cell would also silently return an incomplete set; build the message only on failure [src/sim/grid.ts:67, src/sim/rng.ts:20]
- [x] [Review][Patch] The hard clamp flips the heading even when the sheep already faces inward, so a sheep pushed into the rail by a neighbour can be turned to face the fence, or flip every tick; flip only when the heading points outward [src/sim/systems/movement.ts:119]
- [x] [Review][Patch] When a frame runs 2+ ticks (hitches, debug ×4/×16), `prev` is N ticks old, so the sprite lurches through N ticks of motion in one tick of alpha and the facing deadband is measured over N ticks [src/view/field/SheepSprite.ts:51]
- [x] [Review][Patch] `wrapAngle` can return exactly 2π (tiny negative input) or -0, breaking the [0, 2π) range and the strict JSON round-trip [src/sim/systems/movement.ts:19]
- [x] [Review][Patch] The comment claims the result "does not depend on array order", but pass 1 draws rng in array order; only the position update is order-independent [src/sim/systems/movement.ts:25]
- [x] [Review][Patch] Tests that pass vacuously or miss paths: the "differs for another seed" and speed-cap tests pass with a no-op `updateMovement`; nothing checks the soft fence turn or the `vx`/`vy` growth past 128 sheep; the grid test is misnamed "shrinks back" and the redundant `total > 0` adds nothing [tests/sim/scenarios/wander100.test.ts:30, tests/sim/systems/movement.test.ts:33, tests/sim/grid.test.ts:72]
- [x] [Review][Patch] The Dev Agent Record does not mention that `SheepSprite.reset()` now also clears `flipX` [src/view/field/SheepSprite.ts]
- [x] [Review][Defer] A non-finite `x`/`y`/`heading` (e.g. from a corrupt save) passes the hard clamp (`NaN < left` is false) and stays NaN forever; one NaN point in `rebuildGrid` also overwrites another sheep's grid slot [src/sim/systems/movement.ts:111, src/sim/grid.ts:28] — deferred to Story 1.9, whose save validation must reject non-finite numbers and duplicate ids
- [x] [Review][Defer] Sprites keep `lastTick` and prev/curr positions if `GameScene` swaps `state` in place while the layer lives (ids restart at 1), so sheep slide from old-run spots or freeze for a tick [src/view/field/SheepSprite.ts:45] — deferred to Story 1.9 (load-or-new); today `create()` rebuilds the layer
- [x] [Review][Defer] Grid results are indices into `state.sheep` with no guard that the array is unchanged since `rebuildGrid`; a query after a removal can read past the end [src/sim/grid.ts:62] — deferred to the first story that queries neighbours outside movement (4.2/4.3); documented in the `grid.ts` header

## Dev Notes

### Scope

| Story | Owns (do **not** start here) |
|---|---|
| 1.4 | Debug overlay (FPS, sim speed via `FixedStepClock.speed`), the formal 100-sheep perf check |
| 1.5 | `hunger.ts`, `killSheep`, hunger visuals (droop, thin), tooltip, `PublicSheep.stage/hunger` |
| 1.7 | `seekFood`/`eating` activities, `feeding.ts`, `InputController` (it adds a `case` to the movement switch) |
| 1.9 | Saving and migrations. Fields added before then need none. |
| 1.10 | `TitleScene` decorative wandering sheep (may reuse this movement) |
| 2.7 | `dragged` activity: excluded from steering; drop outside the fence is clamped inside |
| 3.3 | Fence growth (`fenceBounds` by land tier) |
| 4.2 | Abomination 36 px avoidance and off-step `gait` |
| 5.8 | Walk-cycle frames, bobs and other juice |

### Resolved decisions and gotchas (read first)

1. **The total speed is capped at walk speed.** AC 1 says sheep move "at the walk speed". Capping wander plus separation at 60 px/s keeps that true and keeps the 1.7 travel-time maths simple. Separation still wins when crowded, because it also turns the heading (Task 4.5).
2. **Grazing stops are an [ASSUMPTION].** Nothing in the GDD or UX says sheep pause. Without them, 3 sheep marching nonstop at 60 px/s cross the 300 px pen in 5 s and look frantic, not "alive". The stop is a `restUntil` deadline inside the `wander` activity, not a new activity, so Story 1.7's `nextActivity` stays as the architecture shows it. Remove it by setting `wanderRestChance: 0` if Rylan disagrees.
3. **Two passes.** Updating positions in place while looping would make sheep later in the array see moved neighbours. That is deterministic but order-biased. Compute all velocities first, then integrate.
4. **One inset value.** `spawnInset` becomes `fenceInset`, the margin for spawning and containment alike. Its value (40) already clears a 64 × 52 sheep plus the rails; it was raised from 32 in the 1.2 review for exactly that reason. Do not lower it.
5. **The grid is not state.** It lives in module scope like the event queue, and is rebuilt from `state.sheep` at the start of every movement tick. Never put it, or velocities, in `GameState`.
6. **The grid stores indices.** They are valid only within the movement tick. If a later system needs neighbours after a death has filtered `state.sheep`, it must rebuild first. Write this in the `grid.ts` header comment.
7. **Interpolation needs a tick signal.** `alpha` alone cannot tell a sprite that a new tick arrived: a sheep standing still for a tick would keep lerping between two stale points. Pass `state.time` through `EntityLayer.sync` (Task 6.1).
8. **Positions are floats.** Do not round them in the sim: rounding to integers at 6 px per tick would distort headings. Finite floats survive JSON exactly. The tests assert finiteness because `NaN` would turn into `null` in a save.
9. **Phaser 4:** `setFlipX`, `setPosition` and `setDepth` are unchanged from v3 (verified in `node_modules/phaser/skills/sprites-and-images/SKILL.md`). Do not add Arcade bodies or physics: the config has no `physics` key, and ADR-3 forbids it.
10. **`step.ts` runs time first, then systems** (Story 1.2 decision 3). So `restUntil` compares with `state.time >= s.restUntil` after the time advance.

### Current state of files this story changes

- **`src/config/tuning.ts`**: frozen `TUNING` with `startFullness`, `startFood`, `foodCap`, `farmFoodPerClick`, `startAdultAgeMs`, `interimFlockAdults`, `startFence` (`{ x: 556, y: 330, width: 380, height: 250 }`) and `spawnInset: 40`; exports `Rect`. **Changes:** new movement keys and the `spawnInset` → `fenceInset` rename. **Preserve:** the deep-freeze of `startFence`, and no imports from `sim/` or `view/`.
- **`src/sim/state.ts`**: `Sheep { id, x, y, bornAt, fullness, activity }`, `createSheep`, `createNewGame` (positions via `rngRange` inside the inset fence, rounded to integers). **Changes:** `heading` and `restUntil`, plus the rename. **Preserve:** the exact `GameState` key set (a test asserts it), integer spawn positions, `peakFlock` set from the start count.
- **`src/sim/step.ts`**: time advances first, then an empty indexed `SYSTEMS` loop. **Changes:** register `updateMovement`.
- **`src/sim/selectors.ts`**: `fenceBounds(state)` returns `TUNING.startFence`; `selectPublicSheep` fills a reused array with `{ id, x, y }`. **No change.** Movement reads the fence **through `fenceBounds`**, never `TUNING.startFence` directly, so Epic 3 can grow it in one place.
- **`src/view/field/EntityLayer.ts`**: generic N3 reconciler with a persistent `Map`/`Set` and a once-bound `sweep`; `PooledEntitySprite { bind, sync(item, alpha), playExit }`. **Changes:** add `simTime` to `sync`. **Preserve:** no per-frame allocation, and `playExit()` without a callback (that change is deferred to Story 2.4).
- **`src/view/field/SheepSprite.ts`**: 2× placeholder sprite, holds only `boundId`, sets position and depth = y when they change. **Changes:** prev/curr interpolation and facing.
- **`src/view/scenes/GameScene.ts`**: applies commands, `step`, `drainEvents` per tick, using `this.game.loop.rawDelta` (**keep `rawDelta`**: the smoothed delta slowed the sim at 30 Hz in 1.2), then `render()` with `clock.alpha`. **Changes:** pass `this.state.time` to the layer.
- **`tests/sim/state.test.ts` and `tests/sim/step.test.ts`**: the rename and the test name (Tasks 1.2 and 5.2).

### Architecture compliance

- `src/sim/**` is pure, and lint enforces it: no Phaser, DOM, `Math.random`, `Date.now` or timers. `Math.cos`, `Math.sin`, `Math.atan2` and `Math.hypot` are fine. Use `Math.sqrt(dx*dx + dy*dy)` in the hot path rather than `Math.hypot`, which is slower in V8.
- Systems are called only from `step.ts`. `grid.ts` is a sim helper module (architecture: "Movement & spacing: `movement.ts` + `grid.ts`"), not a system.
- The view never mutates `GameState`. Interpolation fields live on the sprite as view state, which N3 allows ("bound id and animation state").
- Naming: `movement.ts` and `grid.ts` are camelCase modules; `updateMovement`; TUNING keys are camelCase with units in the name (`…PxPerS`, `…Px`, `…Ms`, `…Rad`).
- Logging: nothing in `updateMovement`, the grid or `SheepSprite.sync`.

### Library / framework requirements

No new packages. Phaser `~4.2.1`, TypeScript `~6.0.3` and Vitest `~4.1.11` stay as installed. Do not add a steering, vector, ECS or physics library (ADR-3: about 100 lines of owned code). `Float64Array` and `Int32Array` are standard JS.

### File structure

| File | Status |
|---|---|
| `src/sim/grid.ts` | new |
| `src/sim/systems/movement.ts` | new (creates `src/sim/systems/`) |
| `src/sim/step.ts` | modified |
| `src/sim/state.ts` | modified |
| `src/config/tuning.ts` | modified |
| `src/view/field/EntityLayer.ts` | modified |
| `src/view/field/SheepSprite.ts` | modified |
| `src/view/scenes/GameScene.ts` | modified |
| `tests/sim/grid.test.ts` | new |
| `tests/sim/systems/movement.test.ts` | new |
| `tests/sim/scenarios/wander100.test.ts` | new |
| `tests/sim/helpers.ts`, `tests/sim/state.test.ts`, `tests/sim/step.test.ts` | modified |

### Testing requirements

- Vitest, node environment. Tests import only from `src/sim`, `src/config` and `src/core`; never Phaser.
- Seeds are fixed literals; time advances only through `runFor` or `step`. No fake timers, no `Math.random`.
- Assert on state, not on internal calls. No spying on `queryNeighbours`. The grid test may call the grid's exported functions directly, because the grid is its own module.
- Use `TUNING` in every assertion.
- **Done = `npm test`, `npm run typecheck` and `npm run lint` green**, plus `npm run build` and the browser checks in Task 8.

### Project context rules (from `_bmad-output/project-context.md`)

- **Performance:** 16.6 ms per frame at 100 sheep; sim tick ≤ 2 ms at 100 sheep; render/sync ≤ 6 ms. No allocation in `step()`, systems, `update()` or `EntityLayer.sync`. Neighbour queries go through `sim/grid.ts` (48 px cells, rebuilt once per tick). Never loop all sheep × all sheep.
- Pools: sheep come from the 120-sprite pool; never `new` or `destroy()` sprites during play.
- No `Graphics` redrawn per frame; sheep come from the `sheep-world` atlas.
- Timers are absolute game-ms deadlines with `…At`/`…Until` suffixes (`restUntil`). Never decrement a countdown per tick, and never use `setTimeout` or Phaser timers or tweens to change `GameState`.
- `GameState` is plain JSON: no classes, `Map`, `Set`, `undefined` or `NaN`.
- Never store derived values in `GameState`. Facing is derived in the view; velocity is recomputed per tick.
- New tunable numbers go in `TUNING`, never as literals in the sim.
- Common mistakes: Phaser 3 APIs, Arcade physics bodies on sheep, game logic in sprites or `update()`, `Math.random` in the sim.
- Verify movement and rendering with 100 sheep for 5 minutes at ×1 before closing a movement story. The debug overlay arrives in 1.4, so do the interim check in Task 8.4 and leave the formal one to 1.4.

### Previous story intelligence (1.2)

- **`rawDelta`, not the smoothed delta.** Phaser 4's `TimeStep.smoothDelta` caps the delta for 120 frames after start or refocus, which slowed the sim. Keep `this.game.loop.rawDelta`.
- **`assertNever` on a single-variant union** fails if you pass the object; pass the discriminant (`cmd.type`, `s.activity`).
- **The `_` prefix** marks intentionally unused parameters (ESLint `argsIgnorePattern: '^_'`). Remove the `_` from `_alpha` in `SheepSprite.sync` now that it is used.
- **No per-frame closures:** `EntityLayer` binds `sweep` once and `GameScene` binds `forwardEvent` once. Do the same for any callback you add.
- **Headless verification** used system `google-chrome` driven by `playwright-core` installed in the scratchpad, not as a project dependency. Reuse it for Task 8.3.
- **Review lessons:** record evidence for every manual check; do not claim a test-first run that did not happen; list every deviation from the story text.
- **Deferred items** (`deferred-work.md`): none target 1.3. Do not take on `playExit(done)` (2.4) or fence pooling (3.3) here.

### Git intelligence

- `8842ba4` implemented 1.2: the sim core, `FixedStepClock`, scenes, `EntityLayer`/`ObjectPool`/`SheepSprite`/`Fence`, the atlas pipeline and the tests. `ed1be12` was the 1.1 scaffold.
- This story's work is on branch `story/1-3-sheep-wander-the-pasture`, created from `main` at `8842ba4`.
- Commit style: one commit per story, "Implement story 1.3: sheep wander the pasture".

### Latest technical notes (checked 2026-10-05)

- No new libraries are involved. The pinned stack is unchanged since 1.2 (Phaser 4.2.1, Vite 8.3.2, TypeScript 6.0.3, Vitest 4.1.11).
- Phaser 4 `Sprite.setFlipX(bool)`, `flipX`, `setPosition` and `setDepth` were confirmed in the bundled `sprites-and-images` skill and `phaser.d.ts`.
- Steering follows Reynolds' classic wander and separation behaviours, reduced to heading jitter plus a linear-falloff separation; no flocking alignment or cohesion is needed.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.3: Sheep Wander the Pasture]
- [Source: _bmad-output/planning-artifacts/epics.md#Additional Requirements] AR4, AR5, AR19
- [Source: _bmad-output/game-architecture.md#Game Time] (interpolation, previous positions on sprites), [#Movement and Flock Spacing], [#Architecture Decision Records] ADR-2, ADR-3, [#N3 — Sprite ↔ Entity Reconciliation], [#State Patterns], [#System Location Mapping], [#Architectural Boundaries]
- [Source: _bmad-output/planning-artifacts/gdds/gdd-sheep-civilization-2026-10-05/gdd.md] Walk speed 60 px/s (tune); 24 px personal space (tune)
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-sheep-civilization-2026-10-05/EXPERIENCE.md#Game Feel & Juice] (gameplay animation is never reduced)
- [Source: _bmad-output/project-context.md] Performance and Testing rules
- [Source: _bmad-output/implementation-artifacts/1-2-simulation-core-and-game-clock.md] Dev Agent Record and Review Findings

## Dev Agent Record

### Agent Model Used

Claude Opus 5.5 (claude-opus-5-5[1m]) via Claude Code, gds-dev-story workflow.

### Implementation Plan

- **Tuning:** `walkSpeedPxPerS`, `personalSpacePx`, `gridCellPx`, the wander and separation assumptions, and `fenceTurnMarginPx`. `spawnInset` was renamed to `fenceInset` (still 40).
- **State:** `Sheep.heading` (radians, drawn in `createSheep` via `rngRange`) and `Sheep.restUntil` (deadline, starts at 0).
- **`src/sim/grid.ts`:** a counting sort into module-scope `Int32Array`s covering the whole 1280 × 720 canvas (27 × 15 cells). Positions outside the canvas fall into the edge cells. The index arrays double when the flock outgrows them. `queryNeighbours(points, i, radius, out)` scans 3 × 3 cells, distance-filters, excludes `i`, and returns a count (callers read `out[0..count)`). Inputs are typed structurally (`{ x, y }`) so the grid tests need no full `GameState`.
- **`src/sim/systems/movement.ts`:**
  - Pass 1, velocities from start-of-tick positions: the wander switch (rest roll, heading jitter, soft fence turn); separation with a `1 − d/r` falloff and an id-based split for coincident sheep; then the walk-speed cap. A crowded walker's heading turns with the push.
  - Pass 2: integrate, hard-clamp into the inner fence, and flip the heading on a clamped axis.
  - Scratch `Float64Array`s are grown on demand; nothing else is allocated per tick.
- **`step.ts`:** `SYSTEMS = [updateMovement]`.
- **View:** `EntityLayer.sync` and `PooledEntitySprite.sync` take `simTime`. `SheepSprite` keeps view-only prev/curr/lastTick/fresh fields, draws at the blended position with depth = drawn y, and flips with a 1.5 px sideways deadband. `GameScene` passes `state.time`.

### Debug Log References

- **Red phase:** with the new tests written and no implementation, `vitest run` gave 4 failed files and 10 failed tests (the `grid` import was missing, and sheep had no `heading`/`restUntil`). After implementation: 75/75.
- **Tick budget (Task 8.2):** a scratchpad Vitest bench (not committed) stepped 6 000 ticks after a 600-tick warm-up. Results: **0.048 ms/tick at 100 sheep** and 0.062 ms/tick at 120, against a 2 ms budget.
- **Browser, 3 sheep (Task 8.3):** headless system Chrome (SwiftShader) with scratchpad `playwright-core`, through a temporary DEV probe in `main.ts`, sampling every frame for 8 s:
  - 481 frames, average frame 16.6 ms, p95 16.7 ms.
  - Per-frame sprite step: median 1.00 px and **max 1.008 px**. Without blending, a walking sheep would jump 6 px once per tick.
  - 0 sprites over the fence rails; depth equals the drawn y for every sprite in every frame.
  - 9 facing changes in 24 sheep-seconds; 0 console or page errors.
  - Screenshot: sheep face both ways, and the lower sheep draws in front.
- **Browser, 100 sheep (Task 8.4):** with `interimFlockAdults` set to 100 locally for 10 s:
  - 603 frames, average 16.6 ms, p95 16.7 ms; max per-frame step 1.008 px.
  - 0 sprites outside the fence, 0 errors.
  - The value was reverted to 3 (`git diff` shows no change to that line).
  - Headless SwiftShader is not the target laptop GPU. The formal 5-minute, 100-sheep check still belongs to Story 1.4's overlay.
- **Facing flicker at 100 sheep:** with the story's 0.5 px deadband, the crowd produced 1 612 facing changes in 10 s (about 1.6 per sheep per second). Measured alternatives:
  - 1.5 px: 1 037 changes (3 sheep: 7).
  - 2 px: 933 changes (3 sheep: 10).
  - Kept 1.5 px. The remaining changes are real direction reversals as sheep push past each other in a pen holding 10× its capacity of 10 sheep.
- **Probe cleanup:** `window.__probeGame` was removed from `main.ts`; `grep` finds it in neither `src/` nor `dist/`.
- **Tooling note:** `pkill -f 'vite --port 5179'` also matched the shell running it and killed that command (exit 144). The dev server was stopped, and the gates were rerun separately.

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created
- **AC 1:**
  - Every sheep's per-tick displacement stays ≤ 6 px over 600 ticks with 30 sheep.
  - A lone walker moves on most ticks, and a grazing sheep holds still until `restUntil`.
  - Sheep walking straight at each of the four inner edges stay inside on every tick.
- **AC 2:**
  - Separation pushes two grazing sheep that start 1 px apart strictly further apart each tick, to ≥ 0.9 × 24 px within 2 s, and they stay apart.
  - Coincident sheep separate, with all values finite.
  - The grid matches brute force for 100 points (dense pen and full canvas) at radius 24 and 48. It finds neighbours across cell boundaries, handles positions off the canvas, grows to 1 000 points and shrinks back, and hits the DEV invariant for a radius over one cell.
- **AC 3:** prev/curr positions live on `SheepSprite` only; `GameState` has no previous positions. The browser measurements are in the Debug Log.
- **AC 4:** in `tests/sim/scenarios/wander100.test.ts`, 100 sheep over 600 ticks stay inside the inner fence on every tick with finite values. The same seed gives `toStrictEqual` states, and a different seed differs. A JSON copy taken after 30 s resumes identically for another 30 s.
- **AC 5:** `npm test` 75/75 in 15 files; `npm run typecheck` (both configs) clean; `npm run lint` clean; `npm run build` OK (`dist/` 1.5 MB; the existing Phaser chunk-size warning only).
- **Deviations from the story text:**
  1. **Soft fence turn:** near an inner edge, a walker heading outward has its heading **mirrored** back into the pen, rather than rotated toward the pen centre. It is cheap, deterministic and reads as turning back. The hard clamp is unchanged.
  2. **Facing deadband:** 1.5 px, not 0.5 px (see Debug Log).
  3. **`queryNeighbours`** does not set `out.length`; callers read `[0, count)` (an option the story allowed). The grid functions take `{ x, y }` points structurally.
  4. **Grazing headings:** the clamp-axis flip also applies to a grazing sheep that separation pushes into the fence, so its heading can change while grazing. It only affects the walk direction after the stop.
  5. **Test helpers:** `innerFence(state)` and `fillFlock(state, count)` in `tests/sim/helpers.ts`.
- **For Rylan:**
  - With 64 × 52 sprites, the GDD's 24 px personal space still lets sheep overlap visibly (see the screenshots). Revisit `personalSpacePx` in the 3.6 tuning pass if the flock should read as more spread out.
  - The grazing stops (`wanderRestChance`) are the assumption flagged in the story.

### Review Follow-up (2026-10-06)

All 7 review patches applied; 3 items deferred to `deferred-work.md`.

- **Hot-path strings:**
  - `queryNeighbours`, `rngRange` and `rngInt` now build their invariant message only when the check fails (`if (bad) invariant(false, …)`), so a tick allocates no strings.
  - In production an oversize radius still logs and returns the 3×3 result.
- **Clamp heading:** the pass-2 clamp flips the heading only when it points outward on the clamped axis.
  - New test: an inward-facing grazing sheep pushed into the rail keeps heading 0, checked on every tick.
  - Mutation check: with the old unconditional flip restored, the test fails, because the heading toggles each tick. An end-only check had passed, since 10 toggles land back on 0, so the test now checks every tick.
- **Multi-tick frames:** when `simTime` jumps by N > 1 ticks, `SheepSprite` starts the blend from an estimate of the T-1 position (`curr + (pub − curr) × (1 − 1/N)`), so it covers one tick of motion. Facing is measured over that one tick.
  - If time goes backwards (a new or loaded game), the sprite snaps.
  - Browser, 3 sheep at debug speed ×16 (temporary probe, removed): max per-frame step **16.1 px**, the ideal 60 × 16 / 60 = 16 px. The old code reached **25.3 px**. Facing changes fell from 92 to 56.
  - At ×4 both versions matched, max 4.03 px, because there is still less than one tick per frame.
- **`wrapAngle`** returns 0 instead of 2π for tiny negative input, and `+ 0` turns -0 into 0. The 100-sheep scenario now asserts every heading is in [0, 2π) and never -0 on every tick.
- **Comment:** the movement header now says the two passes stop sheep seeing already-moved neighbours, and that rng draws still follow array order.
- **Tests:**
  - The speed-cap test and the same-seed test now also assert that the flock moved (more than half the sheep-ticks, and more than 90 of 100 sheep).
  - New test: the soft fence turn brings a walker back before the rail. It fails with the soft turn removed (mutation-checked).
  - New test: 300 sheep (past the 128-slot scratch) stay finite and inside, and move.
  - The grid growth test checks all 1 000 queries against brute force and is renamed.
  - The redundant `total > 0` was removed.
- **Record:** `SheepSprite.reset()` also clears `flipX`, so a reused pooled sprite never keeps an old facing. This was not listed among the deviations before.
- **Gate:** `npm test` 78/78 in 15 files. Typecheck, lint and build are clean; `__probeGame` appears in neither `src/` nor `dist/`.

### File List

- `src/sim/grid.ts` (new)
- `src/sim/systems/movement.ts` (new)
- `src/sim/step.ts` (modified)
- `src/sim/state.ts` (modified)
- `src/config/tuning.ts` (modified)
- `src/view/field/EntityLayer.ts` (modified)
- `src/view/field/SheepSprite.ts` (modified)
- `src/view/scenes/GameScene.ts` (modified)
- `tests/sim/grid.test.ts` (new)
- `tests/sim/systems/movement.test.ts` (new)
- `tests/sim/scenarios/wander100.test.ts` (new)
- `tests/sim/helpers.ts` (modified)
- `tests/sim/state.test.ts` (modified)
- `tests/sim/step.test.ts` (modified)
- `src/sim/rng.ts` (modified in review: invariant messages built only on failure)
- `_bmad-output/implementation-artifacts/deferred-work.md` (modified in review)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modified)
- `_bmad-output/implementation-artifacts/1-3-sheep-wander-the-pasture.md` (this story)

## Change Log

| Date | Change |
|---|---|
| 2026-10-06 | Implemented steering movement (wander with grazing stops, grid-based separation, fence containment), the 48 px spatial grid, and interpolated sheep rendering with facing. Added grid, movement and 100-sheep scenario tests (75/75). Status → review. |
| 2026-10-06 | Code review: 7 patches applied (hot-path invariant strings, inward-safe clamp flip, multi-tick interpolation, `wrapAngle` range, order comment, non-vacuous and new tests, record note). 3 items deferred to `deferred-work.md`. Tests 78/78. Status → done. |
