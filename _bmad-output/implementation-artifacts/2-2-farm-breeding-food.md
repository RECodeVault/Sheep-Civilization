---
baseline_commit: ea2bcbc6d49a23167109e40ca80360ed1ae9d22e
---

# Story 2.2: Farm Breeding Food

Status: done

<!-- Rewritten 2026-10-06 after the approved sprint change "Breeding food becomes a Farm bar"
     (_bmad-output/planning-artifacts/sprint-change-proposal-2026-10-06-breeding-food.md).
     A first implementation of the old spec (+1 stock, 10-heart meter) is in the working tree, uncommitted; this story reworks it. -->

## Story

As a player,
I want a second farm button that fills a bar and drops breeding food into the pen,
so that my adults can eat it and become ready to breed.

## Acceptance Criteria

1. **Button and bar (UX-DR28, UX-DR30).** Given the bottom bar, when it renders, then the Farm Breeding Food button sits right of the Farm group.
   - It uses `button-breed-food`: `heart` fill, `heart-deep` border, label "Farm Breeding Food" on two lines, key hint "G", 64 px tall, 200 px wide.
   - Beneath it is a **breeding progress bar**: 8 `heart` pips on a `wool-shade` track and "{n}/8" in `numeric` type, starting at "0/8".
   - There is no 10-heart meter, no cost tick and no stock read-out.
2. **Filling the bar (FR8, FR43).** Given the button, when I click it or press `G`, then a `FarmBreeding` command fills `TUNING.breedingPipsPerClick` (1) pip.
   - The button squashes like Farm and the bar updates on the same frame.
   - Holding `G` gives one action per press. Ctrl/Cmd/Alt+G is left to the browser.
   - The bar is never boosted and Better Hoe never applies: the command reads no boost or hoe value.
3. **Full bar drops a piece (FR8, UX-DR30a, UX-DR44).** Given a press that completes the bar (8 pips, `TUNING.breedingPipsPerFood`), when it applies, then:
   - the bar resets, keeping leftover pips;
   - a **breeding-food piece** is created at a seeded-random reachable spot in the pen (inside the inner fence) and lands with a bounce;
   - a "+1" popup rises over the button.

   A press that does not complete a bar shows no popup. There is no cap: pieces pile up and never spoil.
4. **Adults eat breeding food (FR8a).** Given breeding pieces in the pen, then an adult that is **not ready** walks to a piece (60 px/s, like food) and eats it.
   - **Pairing:** the oldest unclaimed piece picks its nearest eligible sheep, the same claim model as food.
   - **Eating:** the sheep becomes ready (`breedReady = true`), stands munching for `eatMs`, and gains **no Fullness**. The piece is removed.
   - **Who ignores pieces:** lambs, elders and ready adults.
   - **Food first:**
     - While any food piece is on the field, a sheep below `seekBelowFullness` (90) is not eligible for breeding food.
     - A sheep already walking to a breeding piece switches to food when it becomes eligible for a food piece (Fullness < 90 and an unclaimed food piece exists).
   - Breeding pieces never count as food: carcass eating (FR14, Story 2.5) and the auto-feeder (4.8) ignore them.
   - Cooldown does not exist yet (Story 2.3). Leave a hook comment where "not on breeding cooldown" will be checked.
5. **Ready marker (UX-DR30a).** Given a ready sheep, when it renders, then a small heart icon floats above it and follows it, drawn above the sheep. It shows until the sheep stops being ready.
6. **Readiness lost at elder (FR8a).** Given a ready adult, when its age reaches `TUNING.elderFromMs`, then `breedReady` becomes false on that tick (lifecycle).
7. **Tooltip (UX-DR75).** Given the button, when hovered for the usual delay, then the tooltip reads "Farm Breeding Food: fill the bar for 1 breeding food (G)". It hides on press.
8. **Modals and loss (UX-DR20, FR38).** Under any modal, `G` and clicks do nothing. On a lost game the sim ignores `FarmBreeding`.
9. **Save (AR9, NFR6, NFR7).** `SAVE_SCHEMA_VERSION` is 3, and a version-2 save migrates with:
   - `breedingProgress: 0`
   - `breedingPieces: []`
   - `breedReady: false` on every sheep

   Validation rejects:
   - a bad `breedingProgress` (not an integer in `[0, breedingPipsPerFood − 1]`)
   - a breeding piece outside the inner fence or with a bad or duplicate id
   - a non-boolean `breedReady`
   - an unknown activity

   The round-trip and corrupt-save tests stay green.
10. `npm test`, `npm run typecheck` and `npm run lint` all pass.

## Tasks / Subtasks

- [x] **Task 1: Remove the old-spec pieces (AC: 1, 9)**
  - [x] 1.1 Delete `src/view/hud/BreedingMeter.ts`. Remove from `TUNING`: `breedingFoodPerClick`, `breedingFoodCap`, `breedCost`. Remove `GameState.breedingFood` and the `farmBreeding()` stock logic.
  - [x] 1.2 Remove the `added === 0` meter-bump branch in `HudScene.onSim`, the "Fill breeding" debug button, and `HudView.breedingFood/breedingFoodCap/breedCost`. Keep the `pip-breeding` art: the new bar reuses it.
  - [x] 1.3 **Keep:**
    - the `G` key handler and `'farmBreeding:pressed'`
    - `HudScene.farmBreeding` (squash, suppressTooltip, modal guard)
    - the button in `BottomBar` (200 px, two-line label)
    - the three-button tooltip array and `pointerOverControl`/`clearHover` wiring
    - the frozen `FARM_BREEDING` command
    - `SAVE_SCHEMA_VERSION = 3` and `MIGRATIONS[2]` (its body changes in Task 7)
  - [x] 1.4 Remove or rewrite the old-spec tests (stock to 10, `added: 0`, `breedingFood` validation cases, `busy.ts` `breedingFood > 0`) as you go. Nothing about a stock or cap may remain.
- [x] **Task 2: Tuning and state (AC: 2, 3, 4, 9)**
  - [x] 2.1 In `TUNING`, beside the Farm values, add `breedingPipsPerFood: 8` and `breedingPipsPerClick: 1`. Use a comment citing FR8 (changed 2026-10-06): "works like Farm; never boosted, Better Hoe does not apply".
  - [x] 2.2 In `GameState`, add:
    - `breedingProgress: number` (pips in the current breeding bar)
    - `breedingPieces: BreedingPiece[]`, where `export interface BreedingPiece { id: number; x: number; y: number }`
  - [x] 2.3 On `Sheep`, add a required `breedReady: boolean`. `createSheep` sets it to `false`; this does **not** change the rng call sequence.
  - [x] 2.4 Extend `SheepActivity` with `'seekBreedingFood'`. Update its doc comment: feeding owns it.
  - [x] 2.5 `createNewGame` sets `breedingProgress: 0` and `breedingPieces: []` (right after `farmProgress`/`foodPieces`), and makes no new rng calls.
- [x] **Task 3: Command and events (AC: 2, 3, 8)**
  - [x] 3.1 Add to the `SimEvent` union:
    - `BreedingFoodDropped { id, x, y }`
    - `BreedingFoodEaten { sheepId, pieceId, x, y }`

    `Farmed { resource: 'breedingFood', added }` stays, with `added` = breeding pieces dropped (0 until a bar completes), mirroring food. Update the header comment's variant list.
  - [x] 3.2 Rewrite `farmBreeding()` in `commands.ts` as the twin of `farm()`:
    - **Corrupt-bar guard:** if the bar is not an integer in `[0, breedingPipsPerFood)`, it becomes 0.
    - **Fill:** add `breedingPipsPerClick` pips.
    - **Drop loop:** while the bar is ≥ `breedingPipsPerFood`, subtract and call `createBreedingPiece` at `rngRange` inside `innerFence`, then emit `BreedingFoodDropped`.
    - **Report:** emit `Farmed { resource: 'breedingFood', added }`.
    - Never read a boost or hoe value. The lost-game guard in `applyCommand` already covers it.
  - [x] 3.3 `createBreedingPiece(state, x, y)` in `systems/feeding.ts`: the same clamping as `createFoodPiece`, pushed to `state.breedingPieces`.
- [x] **Task 4: Feeding: seek and eat breeding food (AC: 4)**
  - [x] 4.1 In `systems/feeding.ts`, extend `updateFeeding`. Keep the module's no-allocation rules (scratch arrays at module scope, grown on demand; use a second `Uint8Array` for breeding claims).
    - **Pass 1/2 (arrive and eat):** a `seekBreedingFood` sheep whose target is gone reverts to `wander`. In reach (`eatReachPx`), it removes the piece, sets `breedReady = true`, emits `BreedingFoodEaten`, and goes to `eating` with `restUntil = time + eatMs`. **No Fullness change.**
    - **Food claims (existing pass 3):** food eligibility is now `(activity === 'wander' || activity === 'seekBreedingFood') && fullness < seekBelowFullness`. A sheep switching from `seekBreedingFood` drops its breeding target. This is food-first for sheep already on their way.
    - **Breeding claims (new pass 4, after food):** the same oldest-piece/nearest-sheep loop over `breedingPieces`. Eligibility: `activity === 'wander'`, adult stage (`stageOf`), `!breedReady`, and **not** (`fullness < seekBelowFullness` and `foodPieces.length > 0`).
      - Leave a one-line hook for Story 2.3: "and not on breeding cooldown".
      - Leave a one-line hook for 4.1: "the Abomination is never an adult".
    - Update the header comment (feeding now owns `seekBreedingFood` too).
  - [x] 4.2 Add a selector `breedingPieceIndex(state, id)`, a plain loop like `pieceIndex`.
  - [x] 4.3 In `systems/movement.ts`, add a `case 'seekBreedingFood'` that walks to the claimed breeding piece exactly like `seekFood`. Share the walk code through a small local helper or by having both cases fall into one block, rather than copying it. The `assertNever` default must stay exhaustive.
  - [x] 4.4 Check every other `switch`/`if` on `activity` (grep `activity`) for the new value, for example any place that treats `seekFood` as "busy".
- [x] **Task 5: Lifecycle: readiness lost at elder (AC: 6)**
  - [x] 5.1 In `updateLifecycle`, in the same loop: `if (s.breedReady && state.time - s.bornAt >= TUNING.elderFromMs) s.breedReady = false;`. It must happen before the old-age kill check, which ends the loop iteration for that sheep. No allocation.
- [x] **Task 6: Selectors (AC: 1, 5)**
  - [x] 6.1 Add `PublicSheep.ready: boolean` (from `breedReady`), filled in `publicSheep` and `selectPublicSheep`, and in the reuse-object literal there.
  - [x] 6.2 Add `selectBreedingPieces(state)`, returning the live array like `selectFoodPieces`.
  - [x] 6.3 `HudView`: replace the old breeding fields with `breedingProgress` and `breedingPipsPerFood`, filled in `selectHudView`. Update `HudScene`'s initial `view` literal.
- [x] **Task 7: Save schema 3 (AC: 9)**
  - [x] 7.1 `MIGRATIONS[2]` adds `breedingProgress: 0`, `breedingPieces: []`, and `breedReady: false` on every sheep. Map over `sheep` defensively: if `sheep` is not an array, leave it for validation to reject. Update the `SAVE_SCHEMA_VERSION` comment in `constants.ts` ("3 since Story 2.2: breeding bar, breeding pieces and `breedReady` added").
  - [x] 7.2 In `validate.ts`:
    - `int(s, 'breedingProgress', 'state', 0, TUNING.breedingPipsPerFood - 1)`
    - `breedingPieces` is an array of objects. Each has `claimId` (shared id set, so ids are unique across all entities) and finite x/y inside the inner fence, the same as food pieces.
    - Every sheep has `typeof breedReady === 'boolean'`.
    - Add `'seekBreedingFood'` to `ACTIVITIES`.
    - A stale `targetId` stays tolerated; feeding releases it.
- [x] **Task 8: Art (AC: 3, 5)**
  - [x] 8.1 Placeholder PNGs in `assets/art/world/`:
    - `breeding-piece.png`: a small heart-shaped treat, about 8×7, `heart` #E27894 fill with a `heart-deep` #A8405D outline. Its shape must differ from the 8×6 hay `food-piece`.
    - `ready-heart.png`: a small heart, about 7×6, `heart` fill with a `bark` #3A2A1F outline.

    Draw them with a throwaway scratchpad encoder (the 2.1/2.2 pattern) and commit only the PNGs.
  - [x] 8.2 Run `npm run assets`. Only `sheep-world.{png,json}` should change (`ui` already has `pip-breeding`). Add `FRAME.breedingPiece` and `FRAME.readyHeart`, and extend the `assets/CREDITS.md` placeholder row.
- [x] **Task 9: Field view (AC: 3, 4, 5)**
  - [x] 9.1 Make `FoodSprite` take its frame as a constructor argument (default `FRAME.foodPiece`), so breeding pieces reuse the same sprite and bounce. Add a second `EntityLayer` in `GameScene` with a pool of 30 (`BREEDING_POOL_SIZE`, grows on demand; architecture N3), synced in `render()` from `selectBreedingPieces`.
  - [x] 9.2 Munch crumbs on `BreedingFoodEaten` too (the `onSim` check covers both event types).
  - [x] 9.3 **Ready marker:** each `SheepSprite` owns one small `Image` (`FRAME.readyHeart`, same 2× scale), created once in its constructor. No per-frame create or destroy.
    - In `sync`, show it when `pub.ready` and place it above the sprite's head at the interpolated position.
    - Set its depth above all sheep (for example `10_000 - 2`, below the munch emitter and the tooltip). The world-overlay layer arrives with pings in Story 2.6.
    - Hide it in `reset()`/`playExit()` and while the sprite is invisible. Use a shown-state cache so `setVisible` is called only on change.
- [x] **Task 10: HUD (AC: 1, 3, 7)**
  - [x] 10.1 Make `FarmProgress` take a fill frame (default `FRAME.pipFood`; `FRAME.pipBreeding` for breeding). Use it for the breeding bar in `BottomBar` (`breedingProgress: FarmProgress`) under the breed-food button.
    - The pip and track sizes stay Farm's, so both bars look alike.
    - The 8-pip track with the "n/8" box is narrower than the 200 px button; that is fine.
  - [x] 10.2 `HudScene`:
    - `refresh` sets `this.bar.breedingProgress.set(v.breedingProgress, v.breedingPipsPerFood)`.
    - `onSim` pops "+N" over the breed-food button only for `Farmed { resource: 'breedingFood', added > 0 }`, mirroring food.
  - [x] 10.3 `STRINGS.farmBreedingTooltip = 'Farm Breeding Food: fill the bar for 1 breeding food (G)'` (UX-DR75). Fix the `farmPopup` comment.
- [x] **Task 11: Debug overlay**
  - [x] 11.1 Add a `+5 breeding` button, like `+5 food`: `createBreedingPiece` at `Math.random` spots inside `innerFence` (view-side; the rng stream is untouched), then `refreshSim`. Add it to `simButtons`.
- [x] **Task 12: Tests (AC: 2–6, 8–10)** (write each to fail first)
  - [x] 12.1 `tests/sim/commands.test.ts`, `FarmBreeding`:
    - One pip per press, and no piece until the bar is full.
    - A full bar empties and drops one piece inside the inner fence. Events: `BreedingFoodDropped`, then `Farmed { resource: 'breedingFood', added: 1 }`.
    - No cap: many bars keep dropping.
    - A corrupt bar (NaN, -1, 1.5, 1e20) starts over.
    - Deterministic placement per seed.
    - It does not touch `farmProgress`/`foodPieces`.
    - Lost game: ignored.

    Use `TUNING` values only.
  - [x] 12.2 `tests/sim/systems/feeding.test.ts`, breeding food:
    - **Walk and eat:** a fed adult (Fullness ≥ 90) walks to a breeding piece and eats it: `breedReady` true, Fullness unchanged, piece gone, `BreedingFoodEaten` emitted.
    - **Who ignores pieces:** a lamb, an elder and a ready adult never claim one.
    - **Food first, at claim time:** with a food piece and a breeding piece on the field, a hungry (< 90) adult claims the food.
    - **Food first, mid-walk:** a `seekBreedingFood` adult that becomes eligible for food (Fullness set < 90 with food present) switches to `seekFood`.
    - **Fed adult:** an adult at Fullness ≥ 90 with food present still takes the breeding piece.
    - **Claims:** two pieces and two adults give one claim each.
    - **Stale target:** reverts to `wander`.
  - [x] 12.3 `tests/sim/systems/lifecycle.test.ts`: a ready adult loses `breedReady` on the exact tick it reaches `elderFromMs` (not one tick earlier).
  - [x] 12.4 `tests/sim/systems/movement.test.ts`: a `seekBreedingFood` sheep moves toward its piece (or extend an existing seek test).
  - [x] 12.5 New scenario `tests/sim/scenarios/breedingFood.test.ts`:
    - From `newGame(seed)`, press `FarmBreeding` `breedingPipsPerFood × 2` times.
    - `runFor` with the flock kept fed (Fullness ≥ 90 each tick, as in `lifespan.test.ts`).
    - Both founding adults end ready, the lamb does not, and both pieces are gone.
    - The state JSON round-trips.
  - [x] 12.6 `tests/sim/state.test.ts` and `selectors.test.ts`:
    - The new game has the new fields (and the key list).
    - Every sheep starts with `breedReady === false`.
    - `PublicSheep.ready` follows `breedReady`.
    - `selectHudView` fills `breedingProgress`/`breedingPipsPerFood`.
    - `selectBreedingPieces` returns the live array.
  - [x] 12.7 Save:
    - **Migrations:** a version-2 state migrates to all three new fields and validates.
    - **`saveFile`:** a version-2 save decodes to the expected state.
    - **`validate`:** cases for a bad `breedingProgress`, a piece outside the inner fence, a duplicate piece id, a non-boolean `breedReady`, and a sheep with `seekBreedingFood` accepted.
    - **`busy.ts`:** breeding pieces on the field, a part-filled breeding bar and a ready sheep, with `isBusy` checking all three.
  - [x] 12.8 Run `npm test`, `npm run typecheck` and `npm run lint`.
- [x] **Task 13: Browser check (AC: 1–8)**
  - [x] 13.1 Probe (scratchpad Playwright, the 2.2 pattern):
    - New Game: pink "0/8" bar under the button.
    - Eight `G` presses: "+1" over the button, a pink heart piece bounces into the pen, and an adult walks to it, eats it (crumbs), and gets a heart above it. The lamb does not go for it.
    - Holding `G` adds one pip.
    - The tooltip shows the new text.
    - Pause blocks `G`.
    - Reload and Continue keeps the bar, the pieces and the ready heart.
    - A version-2 save continues with "0/8" and no hearts.
    - The HUD is legible at 960×540.
    - No console errors.

### Review Findings

- [x] [Review][Decision] Hungry adult idles while every food piece is claimed: Resolved (Rylan, 2026-10-06): keep it as written; food always comes first, even when that means waiting. Detail: AC 4's food-first rule counts claimed food pieces. With fewer food pieces than hungry sheep, the extra hungry adults neither seek food (all claimed) nor breeding food ("food lies in the pen"), even with breeding pieces waiting. The behaviour matches the AC as written, but it may not be what you want.
- [x] [Review][Patch] A sheep on its way to a breeding piece that turns elder (or is already ready, or is a lamb from a corrupt save) still eats it, wasting the piece; its claim also blocks eligible adults while it walks. Release the claim instead [src/sim/systems/feeding.ts:56]
- [x] [Review][Patch] A lamb with `breedReady: true` (corrupt save) stays ready through adulthood: lifecycle should clear readiness for any non-adult, not only elders [src/sim/systems/lifecycle.ts:16]
- [x] [Review][Patch] The breeding bar reads `COMPONENTS.farmProgress`; the new `COMPONENTS.breedingProgress` is never used. Pass the spec into `FarmProgress` [src/view/hud/FarmProgress.ts:7]
- [x] [Review][Patch] Test gap: no test that a bar-completing `FarmBreeding` press leaves `farmProgress`/`foodPieces` alone [tests/sim/commands.test.ts]
- [x] [Review][Patch] Test gap: validation of a bad (non-integer, missing) and a duplicate breeding-piece id (AC 9) [tests/save/validate.test.ts]
- [x] [Review][Patch] The busy save fixture never has a `seekBreedingFood` seeker, so round-trip tests never carry a breeding claim [tests/save/busy.ts]
- [x] [Review][Patch] Tidy: the ready heart is repositioned every frame even when the sheep has not moved; the lifecycle header comment runs past the line width; the feeding header overstates the food-first rule [src/view/field/SheepSprite.ts:104, src/sim/systems/lifecycle.ts:1, src/sim/systems/feeding.ts:7]

## Dev Notes

### Where the working tree is (read first)

The first 2.2 implementation (old spec) is in the working tree, uncommitted, on branch `story/2-2-farm-breeding-food`. `git diff ea2bcbc` shows all of it. Rework it rather than starting over:

| Keep as is | Change | Remove |
|---|---|---|
| `InputController` G handler, `bus` `'farmBreeding:pressed'`, `STRINGS.farmBreedingLabel/Key`, `BottomBar` button (200 px), `HudScene.farmBreeding`, tooltip array, `pointerOverControl`, `clearHover`, `pip-breeding.png` and the `ui` atlas, `SAVE_SCHEMA_VERSION = 3`, the `assertNever(cmd)` switch | `commands.ts` `farmBreeding()`, `events.ts` (`FarmResource` stays `'food' \| 'breedingFood'`), `selectors.ts` `HudView`, `migrations.ts` `MIGRATIONS[2]` body, `validate.ts`, `STRINGS.farmBreedingTooltip`, `HudScene.onSim`, tests | `BreedingMeter.ts`, `TUNING.breedingFood*`/`breedCost`, `GameState.breedingFood`, the debug "Fill breeding" button |

### Current code to build on

- **`systems/feeding.ts`:**
  - Owns `seekFood`/`eating`.
  - Claim model: a seeker keeps `targetId` until it eats or the piece goes, and each piece has at most one seeker.
  - Pass 3 pairs the oldest unclaimed piece with its nearest eligible sheep, then that sheep takes its own nearest unclaimed piece.
  - It uses a module-scope `Uint8Array` grown on demand (no allocation per tick).
  - Breeding food copies this model over `breedingPieces`.
  - `eating` is shared: after a breeding piece the sheep munches for `eatMs`, and Pass 1 returns it to `wander`.
- **`systems/movement.ts`:** the `seekFood` case walks straight at `state.foodPieces[pieceIndex(...)]`, slowing onto it. The new case is the same walk over `breedingPieces`.
- **`commands.ts` `farm()`:** the exact template for `farmBreeding()` (corrupt-bar guard, while-loop drop, `emit` order: Dropped events, then `Farmed`).
- **`systems/lifecycle.ts`:** a captured-array loop that kills at `oldAgeMs`. Add the elder check inside it.
- **`view/field/FoodSprite.ts`:** bounce on first bind, depth = y. **`EntityLayer`/`ObjectPool`:** generic. **`GameScene.render()`** syncs `foodLayer` from `selectFoodPieces`; copy that for breeding pieces.
- **`view/hud/FarmProgress.ts`:** a fixed 8-pip widget with an early-return `set`. Only the fill frame needs to become a parameter.
- **`SheepSprite`:** interpolates `x`/`y` per frame. The ready heart must follow the drawn (interpolated) position, not `pub.x`/`pub.y`, or it lags the sheep by a tick.

### What must be preserved

- **Farm (food):** its bar, drops, popup and F key are unchanged. Food-feeding behaviour for sheep with no breeding pieces around is unchanged; the existing feeding tests stay green unedited, except where a test enumerates activities.
- **Determinism:** `createNewGame` and `createSheep` make the same rng calls as before. `FarmBreeding` draws rng only when a bar completes (the drop spot), like `farm()`.
- **No allocation in `step()`, systems, `render()`, `sync()`.**
- **Listener cleanup** on SHUTDOWN, **modal guards**, and **same-frame HUD updates** via `PRE_RENDER`.
- **Story 2.1 behaviour:** ageing, old-age death, stage frames.

### Architecture compliance

- **State and rules:**
  - Architecture State Management (updated 2026-10-06): `breedingProgress`, `breedingPieces: { id, x, y }[]`, `Sheep.breedReady`.
  - Feeding owns `seekBreedingFood`, and lifecycle clears readiness at elder.
  - `PublicSheep.ready` is not secret: the Abomination never grows past a lamb.
- **Pools:** pre-sized (30 breeding pieces), grow on demand. Field sprites come from the `sheep-world` atlas.
- **Copy and colours:** copy from `strings.ts`; colours only in art and `COMPONENTS` tokens. If you add `breedingProgress`/`breedingPiece`/`readyMarker` specs to `COMPONENTS` (mirroring DESIGN.md's new front matter), replace the old `breedingMeter` entry. The old entry has no consumers after Task 1.
- **New `GameState` fields** come with the schema bump, migration and validation in this story.

### Library / framework notes

- Phaser `~4.2.1`: `scene.add.image`, `setFrame`, `setVisible`, `setDepth`, tweens and particle `explode` are all already used in the codebase. No new dependencies.

### Testing standards

- Vitest, `tests/<same path as src>/`, scenarios in `tests/sim/scenarios/`.
- Use `newGame(seed)`/`runFor`/`fillFlock` from `tests/sim/helpers.ts`, literal seeds, and `TUNING` in assertions.
- Assert on state and drained `SimEvent`s. No fake timers, no Phaser.

### Previous story intelligence

- **2.1:** the captured-array loop in lifecycle; test the exact boundary tick; review caught tests that passed without the code under test.
- **2.2 (first build):**
  - TypeScript narrowing is lost on a `let` button variable in `updateTooltip` (already fixed).
  - The two-line label needs a 200 px button.
  - `npm run assets` packs deterministically, so only touched atlases change.
  - The browser probe uses `playwright-core` from `/home/rylanevans/nr-csp/frontend/node_modules` with `/usr/bin/google-chrome`. `pkill -f` on the vite command line also kills the calling shell, so stop the server with `kill <pid>` instead.
- **Commit style:** `Implement story 2.2: Farm Breeding Food`.

### Out of scope

- **Story 2.3:** the Breed tool, pairing ready adults, cooldown (`cooldownUntil`), pregnancies, capacity, the "Needs 2 ready sheep." greyed state and breed-mode markers.
- **Story 2.5:** carcass eating. It must ignore breeding pieces, which falls out of `foodPieces` only.
- **Story 2.6:** pings and the formal world-overlay layer.
- **Story 5.6:** audio.

### Project Context Rules (from `_bmad-output/project-context.md`)

- Phaser 4, not 3. Game logic only in `src/sim/`. No `Math.random`/`Date.now` in the sim.
- Never store derived values. `breedReady` is not derivable (it comes from eating), so it is stored. The stage stays derived.
- Timers are absolute deadlines; nothing here needs one beyond the existing `restUntil`.
- Breeding is blocked at capacity or with fewer than 2 ready adults (2.3). Breeding food is a field piece adults eat to become ready (no stock).
- The boost doubles Farm (food) pips only, never the breeding bar.
- Done = `npm test`, `npm run typecheck` and `npm run lint` pass; visuals verified in the browser.

### References

- [Source: _bmad-output/planning-artifacts/sprint-change-proposal-2026-10-06-breeding-food.md (decisions D1–D7, R1–R7)]
- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.2; FR6, FR8, FR8a, FR9, FR11; UX-DR28, UX-DR30, UX-DR30a, UX-DR75]
- [Source: _bmad-output/planning-artifacts/gdds/gdd-sheep-civilization-2026-10-05/gdd.md: Farming and Feeding, Breeding, Economy]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-sheep-civilization-2026-10-05/DESIGN.md: breeding-progress, breeding-piece, ready-marker; EXPERIENCE.md: Component Patterns, State Patterns]
- [Source: _bmad-output/game-architecture.md: State Management, State Patterns (`seekBreedingFood`), System Location Mapping, N3 pools]
- [Source: _bmad-output/project-context.md]

## Dev Agent Record

### Agent Model Used

Claude Opus 5.5 (1M context), `claude-opus-5-5[1m]`

### Implementation Plan

- **Sim:**
  - `TUNING.breedingPipsPerFood/breedingPipsPerClick` (8/1).
  - `GameState.breedingProgress` and `breedingPieces: BreedingPiece[]`, `Sheep.breedReady`, and the `seekBreedingFood` activity.
  - `farmBreeding()` is the twin of `farm()`: corrupt-bar guard, then a drop loop with `BreedingFoodDropped`, then `Farmed { resource: 'breedingFood', added }`.
- **Feeding:**
  - One eat pass handles both kinds of piece. Food raises Fullness and emits `FoodEaten`; breeding sets `breedReady` and emits `BreedingFoodEaten`, with no Fullness.
  - Claiming is one generic `claimPieces(state, pieces, food, eligible)`, run for food and then for breeding pieces, using module-level eligibility functions (no per-tick closures) and one shared `Uint8Array` scratch.
  - **Food first:** food eligibility includes `seekBreedingFood` sheep (its target is replaced). Breeding eligibility excludes hungry sheep while any food piece is on the field.
- **Movement:** `seekFood` and `seekBreedingFood` share one case that picks the piece array.
- **Lifecycle:** clears `breedReady` once `age >= elderFromMs`, before the old-age check.
- **Selectors:** `PublicSheep.ready`, `breedingPieceIndex`, `selectBreedingPieces`, and `HudView.breedingProgress/breedingPipsPerFood`.
- **Save (schema 3):**
  - `MIGRATIONS[2]` adds the bar, the pieces and `breedReady: false`. A non-array `sheep` passes through for validation to reject.
  - Validation covers the bar range, breeding pieces (shared id set, inner fence), the `breedReady` boolean and the new activity.
- **View:**
  - The breeding bar is `FarmProgress` with a fill-frame parameter (heart pips). `BreedingMeter.ts` is deleted.
  - `FoodSprite` takes a frame, so breeding pieces reuse its bounce in a second `EntityLayer` (pool 30). Munch crumbs show on both eat events.
  - Each `SheepSprite` owns a pooled ready-heart `Image` at depth 9 998. It is shown on change only and follows the interpolated position.
- **Debug:** a "+5 breeding" button (Math.random spots).
- **Art:** `breeding-piece.png` (an 8×7 heart, heart-deep outline, wool glint) and `ready-heart.png` (7×6, bark outline), drawn by a throwaway scratchpad script. Only `sheep-world` changed on rebuild.
- **COMPONENTS:** `breedingMeter` is replaced by `breedingProgress`, `breedingPiece` and `readyMarker`, mirroring DESIGN.md's new front matter. The count test went from 36 to 38.

### Debug Log References

- **Red phase:** after the tests were rewritten for the new spec, 42 failed across 9 files. All 306 passed after the sim and save work. The COMPONENTS count test failed first at 38, as intended.
- **Activity uses:** a grep (Task 4.4) found no `activity` checks outside feeding, movement, state and validate. Nothing else needed the new value.
- **Browser probe** (scratchpad `p4.mjs`): `playwright-core` from `/home/rylanevans/nr-csp/frontend/node_modules`, system Chrome with SwiftShader, DEV server on port 5199, real mouse and keys, no code hooks. All checks passed:
  - **New game:** shows "0/8".
  - **7 presses:** "7/8".
  - **8th press:** "+1" over the button, a heart piece bounces in and the bar reads "0/8".
  - **Eating:** within 7 s an adult walked to the piece and ate it, and a heart showed over it. The lamb ignored it.
  - **Held `G`:** one pip.
  - **Tooltip:** "Farm Breeding Food: fill the bar for 1 breeding food (G)".
  - **Paused:** `G` and a click left the bar at 1/8.
  - **Second piece:** 7 more presses dropped it, and the other founder ate it.
  - **Autosave:** stored `schemaVersion 3`, `breedingProgress 0`, no pieces and `breedReady [true, true, false]`. Continue showed both hearts.
  - **Version-2 save:** the three fields removed and the version set to 2. It continued at 0/8 with no hearts.
  - **960×540:** legible.
  - No console errors or warnings.
  - The dev server was stopped by PID (the first 2.2 run's `pkill -f` had also killed its own shell).

### Completion Notes List

- 2026-10-06: Story rewritten after the approved breeding-food sprint change; the first build (old spec) is in the working tree, to be reworked.
- AC 1: pink button (200 px, two-line label, `G`) with an 8-heart-pip bar "{n}/8" under it. The 10-heart meter, cost tick and stock are gone. Browser-verified.
- AC 2: `FarmBreeding` fills 1 pip with a squash and a same-frame update. `G` once per press. No boost or hoe read. Unit tests and the browser cover it.
- AC 3: a full bar resets (leftover pips kept), drops a breeding piece in the inner fence with a bounce, and pops "+1". No cap. Deterministic per seed. Unit tests and the browser cover it.
- AC 4: non-ready adults eat breeding pieces and become ready, with no Fullness. Lambs, elders and ready adults ignore them. Food first at claim time and mid-walk. Unit tests, a scenario and the browser cover it.
- AC 5: the ready heart follows the sheep. Browser-verified.
- AC 6: `breedReady` is cleared on the exact tick a sheep turns elder. Unit test.
- AC 7: tooltip text. Browser-verified.
- AC 8: modal and lost-game guards. Unit test (lost game) and browser (pause).
- AC 9: schema 3 with migration and validation. Tests: migration, version-2 decode, validation cases, and round-trip via `busyGame` (now with a part-filled breeding bar, pieces and a ready sheep).
- AC 10: `npm test` (306 passed), `npm run typecheck` and `npm run lint` all pass.

- Code review (2026-10-06): 3 layers (Blind Hunter, Edge Case Hunter, Acceptance Auditor). 1 decision (food-first kept as written), 7 patches applied, 0 deferred, 5 dismissed:
  - two false positives (HUD popup routing, the heart on a sheep's exit);
  - the tooltip fallback (verified fine);
  - hay munch crumbs on breeding pieces (cosmetic; no colour specified);
  - the shared claim buffer (works, and already documented).
- Review patches:
  - A `seekBreedingFood` claim is released once the sheep is no longer an adult or is already ready, so a sheep that turns elder on the way no longer eats (wastes) the piece. It was reproduced by a test first.
  - Lifecycle clears readiness for any non-adult, so a corrupt-save lamb cannot stay ready.
  - The breeding bar reads `COMPONENTS.breedingProgress`.
  - New tests: a bar-completing press leaves food alone, bad or duplicate breeding-piece ids, and the busy fixture now carries a `seekBreedingFood` claim.
  - The ready heart is repositioned only on move or show.
  - Comment fixes.
  - 313 tests pass, typecheck and lint are clean, and the browser was re-checked.

### File List

- `src/config/tuning.ts`, `src/config/constants.ts` (modified)
- `src/sim/state.ts`, `src/sim/commands.ts`, `src/sim/events.ts`, `src/sim/selectors.ts` (modified)
- `src/sim/systems/feeding.ts`, `src/sim/systems/movement.ts`, `src/sim/systems/lifecycle.ts` (modified)
- `src/save/migrations.ts`, `src/save/validate.ts` (modified)
- `src/input/InputController.ts`, `src/view/bus.ts`, `src/view/strings.ts`, `src/view/assetKeys.ts` (modified)
- `src/view/hud/BottomBar.ts`, `src/view/hud/FarmProgress.ts`, `src/view/scenes/HudScene.ts`, `src/view/scenes/GameScene.ts` (modified)
- `src/view/field/FoodSprite.ts`, `src/view/field/SheepSprite.ts` (modified)
- `src/debug/DebugOverlay.ts` (modified)
- `assets/art/ui/pip-breeding.png`, `assets/art/world/breeding-piece.png`, `assets/art/world/ready-heart.png` (new)
- `public/assets/atlases/ui.{png,json}`, `public/assets/atlases/sheep-world.{png,json}` (regenerated)
- `assets/CREDITS.md` (modified)
- `tests/sim/commands.test.ts`, `tests/sim/selectors.test.ts`, `tests/sim/state.test.ts` (modified)
- `tests/sim/systems/feeding.test.ts`, `tests/sim/systems/movement.test.ts`, `tests/sim/systems/lifecycle.test.ts` (modified)
- `tests/sim/scenarios/breedingFood.test.ts` (new)
- `tests/save/busy.ts`, `tests/save/migrations.test.ts`, `tests/save/saveFile.test.ts`, `tests/save/validate.test.ts` (modified)
- `tests/config/constants.test.ts` (modified)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modified)
- `_bmad-output/implementation-artifacts/2-2-farm-breeding-food.md` (new)
- The planning-doc edits from the sprint change (epics, GDD, UX, architecture, project context, proposal) are part of the same working tree.

### Change Log

- 2026-10-06: First implementation to the old spec (+1 stock, 10-heart meter), status review.
- 2026-10-06: Spec changed by sprint change proposal (breeding food becomes a Farm bar that drops pieces adults eat); story rewritten, status back to in-progress.
- 2026-10-06: Reworked to the new spec: breeding bar, breeding pieces, adults eat to become ready, ready heart, readiness lost at elder, save schema 3 for the new fields. Status → review.
- 2026-10-06: Code review fixes (claim release for sheep that can no longer use breeding food, readiness cleared for non-adults, breeding bar spec, extra tests). Status → done.
