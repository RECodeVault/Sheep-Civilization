---
baseline_commit: 1132910
---

# Story 2.5: Carcass Eating and the Virus

Status: done

<!-- Created 2026-10-07 by create-story. Builds on 2.4 (carcasses, killSheep → CarcassSpawned, death toasts), 1.7/2.2 (feeding claims) and 1.3 (movement). -->

## Story

As a player,
I want starving sheep to eat carcasses and catch a deadly virus,
so that neglect spreads and I have to break the chain.

## Acceptance Criteria

1. **Seek a carcass (FR14).** Given a Starving sheep (`hungerOf(fullness) === 'starving'`, Fullness < 25) and **no food piece** on the field, when a carcass exists, then the sheep switches to `activity: 'seekCarcass'`, takes its nearest carcass as `targetId`, and walks to it at walk speed.
   - Breeding pieces never count as food here (FR14, 2.2).
   - Eligible from `wander` or `seekBreedingFood` (hunger beats breeding). A sheep that is `eating` or `seekFood` is not eligible.
   - It keeps its target until it eats it or the carcass is gone (cleared, or eaten by another sheep). Then it goes back to `wander` and may pick the next nearest carcass on the same tick.
   - Several starving sheep may walk to the same carcass. There is no exclusive claim (see Open Question 3).
2. **Food first (FR14).** While **any** food piece is on the field, no sheep seeks or eats a carcass:
   - A `seekCarcass` sheep that can claim food switches to `seekFood` (the feeding claim takes it).
   - Every other `seekCarcass` sheep goes back to `wander`.
   - A sheep that reaches a carcass while a food piece exists does not eat it.
3. **Eat it (FR14, FR15).** Given a `seekCarcass` sheep within `TUNING.eatReachPx` of its carcass and no food piece on the field, when the carcass system runs:
   - The carcass is removed.
   - The sheep gains `TUNING.carcassFullness` (capped at `fullnessMax`; see Open Question 1).
   - It munches (`activity: 'eating'`, `restUntil = time + eatMs`, `targetId` deleted).
   - It is infected 100% of the time: `infectedAt = state.time`.
   - The sim emits `CarcassEaten { sheepId, carcassId, x, y }`, then `Infected { id, x, y }`.
   - An already infected sheep keeps its first `infectedAt` and emits no second `Infected` (see Open Question 4).
4. **Virus death (FR15, N1).** Given an infected sheep, when `state.time >= infectedAt + TUNING.virusDeathMs` (20 s), then it dies through `killSheep(state, id, 'virus')`. It leaves a carcass (`CarcassSpawned`) and counts in `stats.died`. Dying as the last sheep loses the game.
   - Not one tick early.
   - A sheep that starves first dies as `starved`; that is the rule, not a bug.
5. **Infection visuals, never colour alone (UX-DR55, UX-DR58, UX-DR85).** Given a sheep whose `PublicSheep.infected` is true, when it renders, it shows all three of:
   - The `infection` tint via `setTint(COLOR_INT.infection).setTintMode(Phaser.TintModes.MULTIPLY)` (see Open Question 2).
   - The bobbing three-bubble `infection-marker` (16 px, lime bubbles, `bark` outline) above its head.
   - A sickly wobble in its walk.

   All three stay until it dies (later: until it is cured in 4.5, or sacrificed in 2.7). A reused pooled sprite never keeps any of them. Reduced motion (5.7) must never turn the wobble off (UX-DR84).
6. **Virus toast (UX-DR92).** Given a virus death, the toast reads "A sheep caught the carcass sickness." (or "{n} sheep caught the carcass sickness." for same-frame deaths, as in 2.4's grouping).
7. **Chain scenario.** Given a seeded scenario where a sheep starves next to a starving flockmate and no food is on the field, when the sim runs, then this chain is observed: death → carcass → the starving sheep eats it → `Infected` → a `virus` death 20 s later → a new carcass. Clearing the first carcass before it is reached prevents the chain: nobody is infected.
8. **Save (AR9).**
   - `SAVE_SCHEMA_VERSION` 4 → 5 with a migration step `4` (identity: no version-4 save holds either new thing).
   - Validation accepts the `seekCarcass` activity.
   - Validation accepts an optional `infectedAt`: absent, or an integer in [0, time].
   - The round-trip and corrupt-save tests stay green, and the busy fixture holds an infected sheep.
9. `npm test`, `npm run typecheck` and `npm run lint` all pass.

## Tasks / Subtasks

- [x] **Task 1: State, tuning, events (AC: 1, 3, 4)**
  - [x] 1.1 `src/sim/state.ts`:
    - `SheepActivity` gains `'seekCarcass'`. Update its doc comment: carcass.ts owns `seekCarcass`; 4.3 and 2.7 add the rest.
    - `Sheep` gains `infectedAt?: number`: game-ms of infection (FR15), omitted while healthy. Infected is derived (`infectedAt !== undefined`), never stored as a boolean. The death deadline is derived too (`infectedAt + virusDeathMs`): do not add a second timer field.
    - Update the `targetId` doc: a food piece, a breeding piece **or a carcass**.
    - `createSheep` is unchanged (no `infectedAt` key at all).
  - [x] 1.2 `src/config/tuning.ts`:
    - `virusDeathMs: 20_000`, citing FR15 / GDD Virus: "Death 20 s after infection".
    - `carcassFullness: 35`, marked `[ASSUMPTION, Open Question 1; tune in 3.6]`: a carcass feeds like a food piece, so the virus (not hunger) is what kills the eater.
  - [x] 1.3 `src/sim/events.ts`:
    - `CarcassEaten { sheepId; carcassId; x; y }`: (x, y) is where the carcass lay, the munch spot.
    - `Infected { id; x; y }`: a sheep became infected (FR15). Story 2.6 pings on it; 4.6 (overcrowding) emits it too. `Infected` is in the architecture's event list.
    - Update the header's variant list.
- [x] **Task 2: Carcass eating, in `src/sim/systems/carcass.ts` (AC: 1, 2, 3)**. The System Location Mapping puts "starving-eats-carcass" here.
  - [x] 2.1 `export function updateCarcassEating(state)`. Plain loops, no allocation, no rng. Two passes:
    - **Pass 1: release and eat.** For each `seekCarcass` sheep:
      - If any food piece exists, the sheep is no longer starving, or its target is gone (`carcassIndex < 0`): set `wander` and delete `targetId`.
      - Else, if it is within `eatReachPx` of the carcass: eat it (2.2).
    - **Pass 2: claim.** Skip it when any food piece exists or there are no carcasses. Each eligible sheep takes its nearest carcass (`dist2`; strict `<` gives ties to the lower index, so the run is deterministic). Eligible means:
      - activity `wander` or `seekBreedingFood`;
      - `hungerOf(s.fullness) === 'starving'` (use the selector; it has the float epsilon).

      Set `activity = 'seekCarcass'`, `targetId = carcass.id`. A replaced breeding target is simply overwritten, as feeding does.
  - [x] 2.2 Eating (a rare event, so splice and events are fine):
    - Splice the carcass out of `state.carcasses`.
    - `fullness = min(fullnessMax, fullness + carcassFullness)`.
    - `activity = 'eating'`, `restUntil = time + eatMs`, delete `targetId`.
    - Emit `CarcassEaten`, then call `infectSheep(state, s)` (Task 3.1). It sets `infectedAt` and emits `Infected` only if not already infected.
  - [x] 2.3 Header comment: replace "from Story 2.5 starving sheep eating them" with what is here now (FR14, food first, no exclusive claims, eating infects via virus.ts's `infectSheep`). `feeding.ts` still owns `eating`'s end (`restUntil` → `wander`), which works for a carcass munch unchanged.
- [x] **Task 3: Virus, new `src/sim/systems/virus.ts` (AC: 3, 4)**. "Infection, 20 s death" per System Location Mapping.
  - [x] 3.1 `export function infectSheep(state, s: Sheep): void`. If `s.infectedAt !== undefined`, return (one infection per sheep; the deadline never moves). Otherwise set `s.infectedAt = state.time` and emit `Infected { id, x, y }`. This is the shared helper that carcass eating, debug, overcrowding (4.6) and anything else use. Medicine (4.5) will `delete s.infectedAt`.
  - [x] 3.2 `export function updateVirus(state)`:
    - Capture `const sheep = state.sheep` before the loop (killSheep replaces the array; see the carcass.ts header).
    - `if (s.infectedAt !== undefined && state.time >= s.infectedAt + TUNING.virusDeathMs) killSheep(state, s.id, 'virus')`.
    - Deaths happen in array order. No rng.
  - [x] 3.3 Header comment: FR15; the death goes through N1; the Must-tier counters are feeding, clearing and sacrifice (2.7); Story 4.5 cures.
- [x] **Task 4: Step order (AC: 1–4)** in `src/sim/step.ts`.
  - [x] 4.1 The order becomes `updateMovement, updateFeeding, updateCarcassEating, updateHunger, updateLifecycle, updateVirus`.
    - Carcass eating runs after feeding, so food claims win first.
    - It runs before hunger, so a sheep that eats on the tick it would starve lives.
    - Virus runs after lifecycle, per the intended-order comment.
  - [x] 4.2 Update the intended-order comment: `movement → feeding → carcassEating → hunger → lifecycle → virus → abomination → overcrowding → autoFeeder → eras`.
- [x] **Task 5: Feeding and movement (AC: 1, 2)**
  - [x] 5.1 `src/sim/systems/feeding.ts`:
    - `mayEatFood` accepts `seekCarcass` too, so a food claim takes a carcass seeker off its way (as it does for `seekBreedingFood`). Update its doc and the "Food comes first" header line.
    - Passes 1–2 skip `seekCarcass` sheep already (they `continue` on any activity other than the two piece seeks). Keep it that way; carcass.ts owns their claim.
  - [x] 5.2 `src/sim/systems/movement.ts`:
    - Add `case 'seekCarcass'` to the seek branch. Look the target up with `carcassIndex` and steer exactly like `seekFood`: straight at it, slowing onto it, no walk if the target is missing.
    - Refactor the lookup into a small helper returning the target's index/array if that reads cleaner, but allocate nothing.
    - The `assertNever` default must stay. Update the comment ("food, breeding or carcass").
- [x] **Task 6: Selectors (AC: 5)** in `src/sim/selectors.ts`
  - [x] 6.1 `PublicSheep.infected: boolean` (`s.infectedAt !== undefined`). Not secret: the Abomination can be infected like any lamb.
    - Fill it in `publicSheep`, and in `selectPublicSheep` (including the new-object literal).
    - Update the "Later stories add…" comment (name, gait, activity remain).
  - [x] 6.2 No HUD or threat-count selector: 2.6 adds the threat summary.
- [x] **Task 7: Save (AC: 8)**
  - [x] 7.1 `src/config/constants.ts`: `SAVE_SCHEMA_VERSION = 5`.
  - [x] 7.2 `src/save/migrations.ts`: `4: (s) => s`, commented "Story 2.5: `infectedAt` (optional, absent = healthy) and the `seekCarcass` activity arrive. No version-4 save holds either, so the state is unchanged." The bump stops an older build from loading a v5 save and silently dropping an infection.
  - [x] 7.3 `src/save/validate.ts`:
    - Add `'seekCarcass'` to `ACTIVITIES`.
    - In the sheep loop: `if ('infectedAt' in o) int(o, 'infectedAt', p, 0, time)`. Infection happens on a tick, never after `time`.
    - A stale `seekCarcass` `targetId` is already tolerated (carcass.ts releases it).
- [x] **Task 8: Sheep visuals (AC: 5)** in `src/view/field/SheepSprite.ts`
  - [x] 8.1 Track `shownInfected`. On a change in `sync`:
    - **Infected:** `setTint(COLOR_INT.infection).setTintMode(Phaser.TintModes.MULTIPLY)` (`COLOR_INT` from `config/constants`, as `Button.ts` uses), show the marker, and start the marker bob and the wobble.
    - **Healthy:** `clearTint()`, hide the marker, kill both tweens, `setAngle(0)`.

    Phaser 4 API only: no `setTintFill`. Check `node_modules/phaser/skills/game-object-components` for `setTintMode` and `clearTint`.
  - [x] 8.2 **Marker:** an `Image` of `FRAME.infectionMarker` at `SHEEP_SCALE`, origin (0.5, 1), depth `READY_DEPTH`. It is owned and pooled with the sprite, like `readyHeart`.
    - It follows the drawn position each frame while infected: it bobs, so it moves every frame.
    - While both show, the ready/pinned heart stacks above it (shift the heart up by the marker's display height + `READY_GAP_PX`), so they never overlap.
    - The bob is a looping tween on a `markerBob = { y }` object (like `pinBob`): about 3 px over about 500 ms. Name the constants.
    - Story 2.6 moves world overlays (pings, markers) to their own layer above the HUD panels; until then `READY_DEPTH` is right (the existing comment says so).
  - [x] 8.3 **Wobble:** a looping tween on a `wobble = { angle }` object, about ±8° at about 220 ms per swing (`WOBBLE` constants, `[ASSUMPTION, tune in the browser]`). `sync` applies `setAngle(wobble.angle)` while infected.
    - `shake()` (breed mode) owns the angle while it runs: set a `shaking` flag in `shake()`, clear it in its `onComplete` and in `reset()`, and skip the wobble write while it is set.
    - Gameplay information: Story 5.7's reduced motion must not touch it (comment it).
  - [x] 8.4 `reset()`:
    - `clearTint()`, hide the marker, kill the `markerBob`/`wobble` tweens, zero both objects, `shownInfected = false`, `shaking = false`.
    - A pooled sprite reused for a healthy sheep must not inherit any of it.
- [x] **Task 9: Field juice and art (AC: 3, 5)**
  - [x] 9.1 `GameScene.onSim`: `CarcassEaten` → `this.munch.explode(MUNCH_CRUMBS, e.x, e.y)` (the carcass sprite leaves through the layer's sweep, with no clear puff). `Infected` needs nothing here: the sprite reads `PublicSheep.infected`, and 2.6 adds the ping.
  - [x] 9.2 Art: `assets/art/world/infection-marker.png`, about 9 × 8: three lime (`infection` #B4E03C) bubbles in a cluster, each with a 1 px `bark` (#3A2A1F) outline (2 px at 2×, UX-DR85).
    - Use a throwaway scratchpad encoder (the 2.1–2.4 pattern); commit only the PNG.
    - Run `npm run assets`: only the `sheep-world` atlas should change.
    - Add `FRAME.infectionMarker: 'infection-marker'` and extend the `assets/CREDITS.md` placeholder row.
  - [x] 9.3 The toast needs no code: `STRINGS.deathToast('virus', n)` exists and HudScene groups by cause. Verify it in the browser.
- [x] **Task 10: Debug overlay** in `src/debug/DebugOverlay.ts`
  - [x] 10.1 `Infect one`: `debugMutate` → pick a `Math.random` healthy living sheep and call `infectSheep(s, sheep)`.
    - Its `Infected` event is drained with the next tick, which is harmless.
    - Add it to `row2` and `simButtons`.
    - Update the header's "Later stories add…" list (2.5's button is here now).
  - [x] 10.2 The DEV overlay's counts line may add "infected N" if it is a one-liner. Optional.
- [x] **Task 11: Tests (AC: 1–4, 7, 8, 9)**. Write each to fail first; use `TUNING` values only and literal seeds.
  - [x] 11.1 `tests/sim/systems/carcass.test.ts`. Call `updateCarcassEating` directly, so movement's rng is not involved.
    - **Claims:**
      - A starving sheep with a carcass and no food becomes `seekCarcass` targeting the **nearest** of two carcasses.
      - With a food piece present, it does not.
      - With only breeding pieces present, it still does.
      - A hungry (not starving) sheep at exactly `starvingBelow` does not.
      - An `eating` or `seekFood` sheep is not taken.
      - A `seekBreedingFood` starving adult is taken.
    - **Release:**
      - The carcass is cleared → `wander`, then a re-pick of the other carcass on the same call.
      - A food piece appears → `wander`.
    - **Eat:**
      - Within reach and no food: the carcass is removed, fullness rises by `carcassFullness` (capped), `infectedAt === time`, the sheep is `eating` with `restUntil`, and events are exactly `[CarcassEaten, Infected]`.
      - Within reach but a food piece exists: nothing is eaten.
      - Two seekers on one carcass: the first in array order eats; the other is released on the next call.
      - An infected eater keeps its `infectedAt`, and its events are `[CarcassEaten]` only.
    - **Purity:** `state.rng` is unchanged, and a no-op call leaves `structuredClone` state `toStrictEqual`.
  - [x] 11.2 New `tests/sim/systems/virus.test.ts`:
    - `infectSheep` sets the time and emits once; a second call is a no-op.
    - `updateVirus` at `infectedAt + virusDeathMs - TICK_MS` keeps the sheep, and at `+ virusDeathMs` kills it: `SheepDied { cause: 'virus' }`, then `CarcassSpawned` at its spot.
    - Healthy sheep are untouched.
    - Two due on one tick die in array order.
    - The last sheep → `Lost` after its `SheepDied`/`CarcassSpawned`.
  - [x] 11.3 `tests/sim/systems/movement.test.ts`: a `seekCarcass` sheep moves toward its carcass by walk speed × DT (and does not overshoot when close). A missing target → no walk.
  - [x] 11.4 `tests/sim/systems/feeding.test.ts`: a `seekCarcass` sheep below `seekBelowFullness` claims a newly dropped food piece (`seekFood`).
  - [x] 11.5 `tests/sim/step.test.ts`: if it asserts the system list or order, update it; a `virus` death stops later systems on a loss like any other.
  - [x] 11.6 `tests/sim/selectors.test.ts`: `publicSheep`/`selectPublicSheep` report `infected` false/true, and a reused out-object updates it.
  - [x] 11.7 New scenario `tests/sim/scenarios/virus.test.ts`. Use the `runKeepingFed`-style helper from `scenarios/carcass.test.ts`, extended to keep a set of ids hungry; round-trip the JSON every 100 ticks.
    - **Chain:**
      - `newGame(seed)` + `fillFlock`, every sheep fed except two.
      - A (fullness near 0) and B (fullness just under `starvingBelow`, placed near A).
      - Assert, in order: A `SheepDied starved` → `CarcassSpawned` → B `CarcassEaten` → B `Infected`.
      - Then B `SheepDied virus` exactly `virusDeathMs` after its `Infected`, then a new `CarcassSpawned`.
    - **Prevented:** the same setup, with `ClearCarcass` applied on the tick after A's `CarcassSpawned`. No `Infected` ever, B is never `seekCarcass` after the clear, and B dies `starved` (or keep it alive by feeding later; either assertion is fine).
    - **Food first:** the same setup plus one food piece. B eats the food, not the carcass, and the carcass remains.
  - [x] 11.8 Save:
    - `tests/save/validate.test.ts`: accept `seekCarcass` and a valid `infectedAt`; reject a fractional, negative, `NaN`, string or later-than-`time` `infectedAt`.
    - `tests/save/migrations.test.ts`: a version-4 state migrates to 5 unchanged; update any test that hard-codes version 4 as current.
    - `tests/save/busy.ts`: infect one sheep (`infectSheep`, before the final `runFor(1_000)`, which is well under `virusDeathMs`) and have `isBusy` require `infectedAt` on some sheep. The busy state can't hold a `seekCarcass` sheep (it has food pieces, so food comes first). That is fine; 11.7 round-trips one.
  - [x] 11.9 Check every test that pins the exact event list, the activity set or the step order (the hunger, lifecycle, starvation, lifespan and carcass scenarios, `wander100`).
    - A flock left starving with a carcass now behaves differently: starving sheep walk to and eat carcasses (+35 Fullness) and die of the virus.
    - Fix test expectations or setups (for example, clear carcasses, or keep the flock fed), never the rule.
    - Note each changed expectation in the Debug Log.
  - [x] 11.10 Run `npm test`, `npm run typecheck` and `npm run lint` (baseline: 377 tests pass).
- [x] **Task 12: Browser check (AC: 2, 3, 5, 6, 7)**
  - [x] 12.1 Probe with a scratchpad Playwright script (the 2.3/2.4 pattern), driving the debug overlay through the DOM. Check:
    - **Chain:** new game, no feeding. At about 72 s the founders starve together (a loss), so first add sheep (`+N sheep`) and `Feed all` once to stagger them, then `Starve one`.
      - A starving sheep (thin pose) walks to the carcass and munches it (crumbs).
      - The carcass vanishes.
      - The sheep turns lime with the bubble marker bobbing and a visible wobble.
      - About 20 s later: "A sheep caught the carcass sickness.", a new carcass flops in with dust.
    - **Clear first:** click the carcass before the starving sheep reaches it. It turns back to wandering and nobody turns green.
    - **Food first:** with a carcass and a starving sheep, press F until a food piece drops. The sheep goes for the food, not the carcass.
    - **Infect one:** tint, marker and wobble appear at once. On death everything is gone, and a recycled sprite (a later lamb or added sheep) is a healthy white sheep.
    - **Breed mode:** an infected, ready adult shows the marker with the heart stacked above it. Clicking an ineligible infected sheep still shakes it, and the wobble resumes after.
    - **Elder and lamb:** both tint and show the marker at the right height.
    - **Reload and Continue:** an infected sheep stays infected, dies on schedule, and a seeking sheep keeps seeking.
    - **960 × 540:** the marker is legible.
    - No console errors or warnings.
  - [x] 12.2 Performance spot check (project rule for movement/rendering stories): DEV overlay at ×1 with about 100 sheep. Use `+10 sheep` ×10 and `Feed all`, then `Infect one` several times. FPS is in line with the 2.4 baseline and nothing allocates per frame (no new closures or literals in `sync`).
- [x] **Task 13: Bookkeeping**
  - [x] 13.1 `deferred-work.md`: nothing is due in 2.5. Add any review deferrals there.
  - [x] 13.2 Update the architecture only if Rylan asks.

### Review Findings

- [x] [Review][Decision] The infection wobble plays all the time (standing, eating, and under the pause menu) — AC 5 / UX-DR58 say "a sickly wobble in its walk". Today it is a looping tween from infection to death, like the breed-mode hearts that also keep pulsing while paused. The alternative wobbles only while the sheep moves, and holds still while the clock is stopped. — resolved (Rylan): keep it always on; a resting or munching infected sheep still reads as sick, matching the always-on breed-mode juice. No change.
- [x] [Review][Patch] A carcass seeker whose carcass a later sheep in the array ate keeps the stale target and stands still for a tick; re-target it in pass 2 like a wanderer [src/sim/systems/carcass.ts:360]
- [x] [Review][Patch] A Starving sheep needs two ticks to eat a fresh carcass it is already standing on (claim, then eat); eat in pass 2 when the claimed carcass is in reach [src/sim/systems/carcass.ts:375]
- [x] [Review][Patch] Carcasses are validated against the outer fence, but seekers are clamped to the inner one; a carcass in the 40 px band (corrupt save) traps its seeker until it starves. Validate against the inner fence, like pieces [src/save/validate.ts:176]
- [x] [Review][Patch] `infectedAt` accepts values a saved game can never hold: before the sheep's `bornAt`, or already past its virus deadline (`infectedAt + virusDeathMs <= time`) [src/save/validate.ts:136]
- [x] [Review][Patch] At the top of its bob the infection marker overlaps the stacked ready/pinned heart by 1 px; include the bob in the stack offset [src/view/field/SheepSprite.ts:183]
- [x] [Review][Patch] The pregnancy heart over an infected parent draws on top of its infection marker; lift it by the same stack offset [src/view/scenes/GameScene.ts:493]
- [x] [Review][Patch] Feeding can give a breeding piece to a Starving adult that carcass eating diverts on the same tick, wasting the piece's claim for a tick; skip Starving sheep for breeding food while a carcass and no food exist [src/sim/systems/feeding.ts:172]
- [x] [Review][Patch] The "clearing prevents it" scenario clears the carcass before B could ever claim it, and depends on `starveMs / 2`; clear it mid-approach (B is `seekCarcass`) and assert B goes back to wander [tests/sim/scenarios/virus.test.ts:84]
- [x] [Review][Patch] The food-first scenario never shows a carcass seeker switching to food; drop the piece after B starts for the carcass [tests/sim/scenarios/virus.test.ts:101]
- [x] [Review][Patch] Task 11.5: no `step()`-level test that a virus death of the last sheep loses the game [tests/sim/step.test.ts]
- [x] [Review][Patch] The marker art is 9×6 (18×12 on screen), short of the 9×8 / 16 px brief (AC 5, `COMPONENTS.infectionMarker.size`); redraw it 9×8 [assets/art/world/infection-marker.png]
- [x] [Review][Patch] `project-context.md` still names `TintModes.FILL` for the infection tint; Rylan accepted MULTIPLY (Open Question 2), so update the rule [_bmad-output/project-context.md:34]
- [x] [Review][Patch] Found while browser-checking the patches: the infection marker floated about 20 px above a lamb's head (the lamb is drawn at the bottom of an adult-height frame); overlays now sit on the drawn head for the stage [src/view/field/SheepSprite.ts:23]

## Dev Notes

### Current code to build on (read these first)

- **`src/sim/systems/carcass.ts`:**
  - `killSheep` (N1) removes the sheep, counts it, `createCarcass`, emits `SheepDied` → `CarcassSpawned`, then `checkLastSheepAndLoss`. It **replaces** `state.sheep`.
  - `clearCarcass` ignores a missing id. Carcass eating goes in this file.
- **`src/sim/systems/feeding.ts`:** the template for claim passes.
  - The module-scope scratch.
  - `dist2`.
  - Strict `<` tie-breaks.
  - The `eating` → `wander` end in pass 1 (`restUntil`).
  - `mayEatFood` decides who a food claim can take.
- **`src/sim/systems/movement.ts`:** the `seekFood`/`seekBreedingFood` case is the steering to copy. The `switch (s.activity)` ends in `assertNever`, so the new activity fails to compile until handled (intended).
- **`src/sim/systems/hunger.ts` / `lifecycle.ts`:** the capture-the-array-then-`killSheep` loop that `updateVirus` must copy.
- **`src/sim/selectors.ts`:**
  - `hungerOf` (with `FULLNESS_EPSILON`; use it, never `fullness < 25`).
  - `carcassIndex`.
  - `publicSheep`/`selectPublicSheep` (object reuse: update the literal and the field writes together).
- **`src/save/validate.ts`:** `ACTIVITIES`, the sheep loop, and the `'targetId' in o` pattern for optional fields.
- **`src/save/migrations.ts`:** steps 2 and 3 show the pattern; the table needs a step for every version below current.
- **`src/view/field/SheepSprite.ts`:**
  - `readyHeart`/`pinnedHeart` show how an owned, pooled overlay image and its bob tween are done.
  - `shake()` tweens `angle` on `this`.
  - `reset()` must undo everything.
  - The file comment already reserves tint for infection (elders are grey in their art).
- **`src/view/scenes/GameScene.ts`:** `onSim` (guarded juice), the `munch` emitter, `render()`.
- **`src/view/scenes/HudScene.ts`:** `deaths[cause]` counting and `flushDeathToasts` already cover `virus`.
- **`src/view/strings.ts`:** `DEATH_TOAST.virus` = "caught the carcass sickness." already.
- **`src/config/constants.ts`:** `COLOR_INT.infection` (numeric), `COMPONENTS.infectionMarker` (fill `infection`, outline `bark`, size 16).
- **`src/debug/DebugOverlay.ts`:** `Starve one` and `Spawn carcass` show the `debugMutate` + `Math.random` pattern.
- **`tests/sim/scenarios/carcass.test.ts`:** `runKeepingFed` (keep all but one fed, JSON round-trip every 100 ticks).

### What must be preserved

- **N1:** deaths only via `killSheep`; the virus death is just another cause. `removeSheep` (2.7) does not exist yet.
- **Determinism:** carcass eating and the virus draw **no rng**. Movement's rng draws are unchanged for sheep not seeking (a seeker draws nothing, as today).
- **No allocation** in `step()`, systems, `render()`, `sync()`: no closures, literals, `.filter/.map` per tick or frame. Only eating, infection and deaths (rare events) may allocate.
- **Feeding behaviour** for fed and hungry sheep is unchanged: food claims, breeding claims, the food-first rule and `eating` timing.
- **2.4:** carcass clicks, flop, dust, death toasts and their grouping; `ClearCarcass` on an eaten carcass id is a silent no-op (already true).
- **2.3 breed mode:** markers, shake, picking; an infected ready adult can still be picked.
- **Listener cleanup:** no new bus listeners are needed. If you add any, remove them on SHUTDOWN.

### Architecture compliance

- **System location:** carcass eating in `systems/carcass.ts`; infection and the 20 s death in a new `systems/virus.ts` (System Location Mapping), each registered in `step.ts`'s fixed order. Systems do not call each other's `update*`. `infectSheep` is a shared helper owned by virus.ts, like `killSheep` by carcass.ts.
- **State machine:** `seekCarcass` is the architecture's activity name; infected is derived from `infectedAt` (State Patterns: "Derived, never stored: … infected (from `infectedAt`)"). Timers are absolute game-ms (`infectedAt + virusDeathMs`), never countdowns.
- **Events:** `Infected` is in the architecture's list; `CarcassEaten` is new, past-tense PascalCase. Both go through the per-tick queue.
- **View:** reads `PublicSheep.infected` only. Colours via `COLOR_INT`, copy via `STRINGS`. Infection uses tint, never a per-sprite Filter (Performance Rules).
- **Secrecy (N2):** `infected` is not secret. Never add `isAbomination` logic here.
- **Tone (UX-DR97):** no "kill", "corpse", "blood" in UI text. Code identifiers like `killSheep` are fine.

### Library / framework notes (Phaser 4.2.1, installed)

- `setTint(color)` + `setTintMode(Phaser.TintModes.MULTIPLY | FILL | …)`; `setTintFill()` does not exist in v4 (`node_modules/phaser/skills/game-object-components/SKILL.md`, "v4 change"). `clearTint()` resets the colour; also set the mode back to `MULTIPLY` if you ever used `FILL`.
- MULTIPLY keeps the art's outline, eyes and the thin/droop poses (information, UX-DR84) and greens the wool. FILL would flatten the sheep to a lime silhouette.
- Tweens on plain objects (`pinBob`) and `killTweensOf` are already used in `SheepSprite`; no new APIs and no new dependencies.

### Testing standards

- Vitest covers `src/sim/` and `src/save/` only: `tests/<same path as src>/`, scenarios in `tests/sim/scenarios/`.
- Use `newGame(seed)`, `runFor`, `fillFlock` and `busyGame`. Assert on state and drained `SimEvent`s with `TUNING` values.
- No fake timers, no Phaser, no mocking. Use `structuredClone` + `toStrictEqual` for "nothing changed" cases (review caught tests passing without the code under test in 2.3).
- Visuals, wobble and toasts are browser-checked (Task 12).

### Previous story intelligence (2.4)

- Commands apply a tick after the click, so the sim re-checks everything. `clearCarcass` on an id a sheep already ate must stay a silent no-op (test it once).
- `killSheep` order: carcass → `SheepDied` → `CarcassSpawned` → loss. Virus deaths inherit it.
- Death toasts are grouped per cause per frame by HudScene (Rylan's review decision). Five virus deaths on one tick read "5 sheep caught the carcass sickness."
- A death consumes an id (the carcass). Tests counting `nextId` across a death must capture it before the death.
- Atlas frames carry a 0.5 pivot; `npm run assets` packs deterministically (only the touched atlas changes).
- **Browser probe:** `playwright-core` from `/home/rylanevans/nr-csp/frontend/node_modules` with `/usr/bin/google-chrome` (SwiftShader), DEV server on its own port (5199 worked). Stop it with `kill <vite node pid>`, never `pkill -f` (it kills the calling shell). Read state via the overlay's Dump state.
- The 2.4 placeholder carcass art deviated from the brief (side view, one X eye); that is fine for placeholders, but record any art deviation in the Dev Agent Record.
- **Commit style:** `Implement story 2.5: Carcass Eating and the Virus`.

### Git intelligence

- The last five commits are 2.3/2.4 implementation plus review fixes and the adulthood retune (`elderFromMs` 420 s, `oldAgeMs` 540 s).
- The pattern per story: the sim rule plus tests, save validation plus a fixture, view sprite and juice, placeholder art plus atlas, a debug button, `deferred-work.md` notes.

### Out of scope

- **2.6:** the alert ping on `Infected`/`CarcassSpawned`, and the threat summary's Infected/Carcasses counts (they will read `PublicSheep.infected` and `selectCarcasses`).
- **2.7:** dragging an infected sheep into the Better Place (`removeSheep`, no carcass).
- **4.5:** medicine (`ApplyMedicine` deletes `infectedAt`, emits `Cured`; the sprite's healthy branch in 8.1 already handles the un-infect).
- **4.6:** overcrowding infections (they call `infectSheep`).
- **5.3:** names in toasts. **5.6:** sickly bleat SFX and captions. **5.7:** reduced motion (the wobble is exempt).
- The tooltip does not show "Infected" (UX-DR43 lists stage and hunger only); do not add it.
- Infection does not affect breeding, selling, movement speed or hunger drain. Do not invent effects.

### Open questions (defaults chosen; confirm or change)

1. **Does a carcass feed the sheep?** No spec says.
   - **Default:** `+carcassFullness` (35, like a food piece). The eater then always dies of the virus 20 s later, which matches its green tell and the "carcass sickness" toast.
   - **Alternative:** no Fullness. A starving sheep then often starves (as `starved`) before the virus's 20 s, and the chain still continues through its carcass.
2. **Tint mode:**
   - **Default:** `MULTIPLY` (lime-green wool, art detail kept).
   - **Alternative:** `FILL`, a solid lime silhouette. `project-context.md` mentions FILL when it describes the v4 replacement for `setTintFill`.
3. **One carcass, many starving sheep:**
   - **Default:** no exclusive claim. Each starving sheep heads to its nearest carcass, the first to arrive eats it, and the others re-target.
   - **Alternative:** one seeker per carcass, like food pieces. The others wander and starve.
4. **An infected sheep eating again:**
   - **Default:** allowed (it is still a starving sheep), with the deadline unchanged and no second `Infected`.
   - **Alternative:** infected sheep never seek carcasses.
5. **`CarcassEaten` juice** [ASSUMPTION]: munch crumbs where the carcass was. Drop them if they read wrong on a carcass.

### Project Structure Notes

- New files:
  - `src/sim/systems/virus.ts`
  - `tests/sim/systems/virus.test.ts`
  - `tests/sim/scenarios/virus.test.ts`
  - `assets/art/world/infection-marker.png`
- All other changes are to existing files at the architecture's paths (`sim/systems/carcass.ts`, `virus.ts`, `view/field/SheepSprite.ts`).
- Regenerated: `public/assets/atlases/sheep-world.{png,json}`.

### Project Context Rules (from `_bmad-output/project-context.md`)

- **Phaser 4, not 3:** `setTint` + `setTintMode`, never `setTintFill`; infection uses tint, not a Filter.
- **Game logic only in `src/sim/`:** no `Math.random`/`Date.now` in the sim (debug's `Math.random` picks are view-side). Tweens never change `GameState`.
- **Every non-sacrifice death goes through `killSheep(state, id, cause)`:** never splice `state.sheep` elsewhere.
- **"A starving sheep eats a carcass only when no food piece is on the field. Eating a carcass = 100% infection; infected dies 20 s later."**
- **Where new code goes:**
  - A new rule → `src/sim/systems/<system>.ts` exporting `update<System>(state)`, registered in `step.ts`'s fixed order.
  - A new `SimEvent` → `events.ts`.
  - A tunable → `tuning.ts`.
  - `switch`es over unions end in `assertNever`.
- **Timers are absolute game-ms deadlines,** never per-tick countdowns.
- **No derived values stored:** infected is derived from `infectedAt`.
- **New fields need a `SAVE_SCHEMA_VERSION` bump and a migration** in `save/migrations.ts`.
- **Infection is never colour-only:** tint **plus** bubble marker **plus** wobble.
- **Hot paths:** no allocation; sim tick ≤ 2 ms at 100 sheep.
- **Done:** `npm test`, `npm run typecheck` and `npm run lint` pass; visuals verified in the browser.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.5; FR12, FR14, FR15; AR17; UX-DR55, UX-DR58, UX-DR84, UX-DR85, UX-DR92, UX-DR97]
- [Source: _bmad-output/planning-artifacts/gdds/gdd-sheep-civilization-2026-10-05/gdd.md: Carcasses, Virus; decision-log.md ("Infection in Must tier: stays fatal")]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-sheep-civilization-2026-10-05/EXPERIENCE.md: State Patterns (Infected), Component Patterns (Infection marker), Accessibility Floor (never colour-only), Voice and Tone (virus toast), Flow 2 step 4; DESIGN.md: infection-marker, Colors (`infection`), Do's and Don'ts]
- [Source: _bmad-output/game-architecture.md: N1 Single Death Pipeline, State Patterns (`seekCarcass`, `infectedAt`), System Location Mapping (carcass.ts, virus.ts), Event System (`Infected`), Engine v4 notes (tint)]
- [Source: _bmad-output/implementation-artifacts/2-4-carcasses-and-death-announcements.md; deferred-work.md]
- [Source: _bmad-output/project-context.md]

## Dev Agent Record

### Agent Model Used

Claude Opus 5.5 (1M context), `claude-opus-5-5[1m]`

### Implementation Plan

- **Sim:**
  - `seekCarcass` activity and optional `infectedAt` on `Sheep`.
  - `TUNING.virusDeathMs` (20 s) and `carcassFullness` (35, Open Question 1 default).
  - Events `CarcassEaten` and `Infected`.
  - `carcass.ts` `updateCarcassEating` (FR14):
    - Pass 1 releases seekers when food is on the field, the target is gone or the sheep is no longer Starving, and eats on arrival.
    - Pass 2 sends each free Starving sheep (`wander` or `seekBreedingFood`) to its nearest carcass.
    - No exclusive claims; no rng.
  - New `virus.ts`: `infectSheep` (one infection per sheep) and `updateVirus` (the death at `infectedAt + virusDeathMs` through `killSheep(…, 'virus')`).
  - Step order is `movement → feeding → carcassEating → hunger → lifecycle → virus`.
  - `mayEatFood` takes carcass seekers too.
  - Movement steers all three seeks through one allocation-free `seekTarget` helper.
  - `PublicSheep.infected`.
- **Save:**
  - `SAVE_SCHEMA_VERSION` 5 with an identity migration from 4.
  - `seekCarcass` is a valid activity.
  - `infectedAt` is absent, or an integer in [0, time].
- **View:**
  - `SheepSprite` handles a change of `infected`:
    - the tint, `setTint(COLOR_INT.infection).setTintMode(MULTIPLY)`;
    - the pooled `infection-marker` image, bobbing at the head (the ready or pinned heart stacks above it);
    - the ±8° wobble tween.
  - `shake()` owns the angle while it runs, and `reset()` undoes everything.
  - `CarcassEaten` plays munch crumbs.
- **Art:** `infection-marker.png` (9×6: three lime bubbles, bark outline).
- **Debug:** an **Infect one** button, and "infected N" on the counts line.

### Debug Log References

- **Red phase:**
  - The new tests failed first: missing `updateCarcassEating`, `virus.ts` and `infected`, and the seek/claim behaviour.
  - The `infected` field broke the existing `publicSheep` equality test until it was added.
  - The existing tests needed no other change: no flock in them is left Starving next to a carcass with no food (Task 11.9 audit).
- **Test spec adjusted:**
  - Task 11.1 said the second of two seekers on one carcass "is released on the next call". It is released in the same pass, since its carcass is gone by then; the test asserts that.
  - A planned "caps Fullness" test was dropped: a Starving sheep (< 25) + 35 can never reach 100, so the cap cannot be exercised through the rule.
- **Browser probe:**
  - Setup: scratchpad `playwright-core` (from nr-csp), system Chrome with SwiftShader, DEV server on port 5200 (5199 was held by another process, left alone). Saves were planted through the debug Load save button via the clipboard, and state was read with Dump state.
  - No console errors or warnings beyond SwiftShader's GL driver notices.
  - **Infect one:** a lamb turns lime, shows the bubble marker and wobbles. 20 s later the toast "A sheep caught the carcass sickness." appears and a carcass flops in.
  - **Chain** (planted: A at Fullness 1.5, B Starving 54 px away):
    - A starves.
    - B walks over, munches the carcass and turns green with the marker.
    - B dies of the virus about 20 s later, leaving a new carcass.
  - **Clear first:** a click on A's carcass right after it spawned. B stayed `wander`, uninfected.
  - **Food first:** with a food piece near B, B ate the food (Fullness 53). A's carcass stayed, and nobody was infected.
  - **Breed mode:** an infected ready adult shows its heart stacked above the bubbles. The infected lamb's marker sits at a lamb's head height. A click on the infected lamb shakes it, and the wobble resumes.
  - **Reload → Continue:** both infected sheep kept their `infectedAt`, and the first died on schedule.
  - **960×540:** the marker and tint are legible.
- **Performance** (Task 12.2):
  - 103 sheep at ×1 with the overlay open: 43–49 FPS with 20 infected, against 42–46 FPS with none (same SwiftShader setup).
  - No measurable cost; nothing new allocates per frame.

### Completion Notes List

- 2026-10-07: Story created. The context engine analysis is complete, and this file is the developer guide.
- Open questions are implemented at their defaults:
  - a carcass gives +35 Fullness;
  - MULTIPLY tint;
  - no exclusive carcass claim;
  - an infected sheep may eat again, with its deadline unchanged;
  - munch crumbs on `CarcassEaten`.
- AC 1: Starving sheep (`hungerOf`) in `wander`/`seekBreedingFood` seek their nearest carcass; breeding pieces don't count as food; targets are kept until gone, then re-picked. Unit tests (carcass, movement).
- AC 2: any food piece releases every carcass seeker and blocks eating; a feeding claim takes a carcass seeker to food. Unit tests (carcass, feeding) and the food-first scenario.
- AC 3: eating removes the carcass, gives +35, munches for `eatMs` and sets `infectedAt`; events are `CarcassEaten` → `Infected`. A re-infection keeps the first time and emits no event. Unit tests.
- AC 4: virus death at exactly `infectedAt + virusDeathMs` via `killSheep(…, 'virus')`, with a carcass, array order and a loss on the last sheep. Unit tests.
- AC 5: tint + marker + wobble, cleared on reset; the wobble is commented as exempt from reduced motion. Browser.
- AC 6: virus toast (existing copy and grouping). Browser.
- AC 7: the chain, clear-prevents and food-first scenarios, with JSON round-trips. Scenario tests and browser.
- AC 8: schema 5, identity migration, validation of `seekCarcass` and `infectedAt` (6 reject cases), and the busy fixture holds an infected sheep. Tests.
- AC 9: `npm test` (412 passed, from 377), `npm run typecheck` and `npm run lint` are clean.
- **Art:** the marker is 9×6 px (18×12 on screen), a little smaller than the "about 9×8 / 16 px" brief. Three lime bubbles with a bark outline; legible at 960×540.
- **Schema comment:** `constants.ts` already said optional fields need no bump. The new comment records why 2.5 bumps anyway: an older build would otherwise drop an infection silently.
- No `deferred-work.md` items were due or raised. The architecture was left unchanged.
- **Code review (2026-10-07):** 3 layers (Blind Hunter, Edge Case Hunter, Acceptance Auditor).
  - Totals: 1 decision, 12 patches applied (plus 1 found while verifying), 0 deferred, 13 dismissed.
  - **Decision (Rylan):** the infection wobble stays always on, also while the sheep stands, munches or the game is paused. No change.
  - **Sim patches:**
    - a seeker whose carcass a later sheep ate re-targets on the same tick;
    - a Starving sheep already in reach of a carcass eats it on the claim tick;
    - a Starving adult is not given a breeding piece while a carcass and no food lie in the pen.
  - **Save patches:**
    - carcasses must lie inside the inner fence;
    - `infectedAt` must be at or after `bornAt` and still before its virus death.
  - **View patches:**
    - the hearts stack clear of the marker's bob (`overlayLift`), and the pregnancy heart over an infected parent lifts the same way;
    - the marker is redrawn 9×8 (16 px tall on screen);
    - overlays over a lamb sit on its drawn head (`LAMB_HEAD_INSET_PX`).
  - **Test patches:**
    - the clearing scenario clears mid-approach and checks the release;
    - a new scenario drops food mid-approach and checks the switch to food;
    - a `step()` test covers a virus death of the last sheep losing the game.
  - **Docs:** `project-context.md` now names MULTIPLY for the infection tint.
  - **Dismissed:**
    - not re-picking a nearer new carcass (spec: keep the target until it is gone);
    - food anywhere releasing every carcass seeker (AC 2);
    - tint clobbering (no other tint on sheep);
    - marker destroy leak (scenes destroy their display lists; nothing is destroyed during play);
    - wobble overriding future angle tweens;
    - the identity-migration test;
    - no `seekCarcass` sheep in the busy fixture (spec);
    - debug `Math.random`;
    - the O(N·M) claim (Starving sheep only);
    - a carcass meal leaving a sheep Starving (impossible: < 25 + 35);
    - an allocation comment;
    - the debug `Infected` emitted outside a tick;
    - the dropped cap test (disclosed).
  - **Verification:** tests (420), typecheck and lint are clean. Re-checked in the browser: the hearts sit above the bubbles, the pregnancy heart is clear of an infected parent's marker, and the lamb's marker sits on its head.

### File List

- `src/config/constants.ts`, `src/config/tuning.ts` (modified)
- `src/sim/state.ts`, `src/sim/events.ts`, `src/sim/selectors.ts`, `src/sim/step.ts` (modified)
- `src/sim/systems/carcass.ts`, `src/sim/systems/feeding.ts`, `src/sim/systems/movement.ts` (modified)
- `src/sim/systems/virus.ts` (new)
- `src/save/migrations.ts`, `src/save/validate.ts` (modified)
- `src/view/assetKeys.ts`, `src/view/field/SheepSprite.ts`, `src/view/scenes/GameScene.ts` (modified)
- `src/debug/DebugOverlay.ts` (modified)
- `assets/art/world/infection-marker.png` (new)
- `assets/CREDITS.md` (modified)
- `public/assets/atlases/sheep-world.{png,json}` (regenerated)
- `tests/sim/systems/virus.test.ts`, `tests/sim/scenarios/virus.test.ts` (new)
- `tests/sim/systems/carcass.test.ts`, `tests/sim/systems/feeding.test.ts`, `tests/sim/systems/movement.test.ts`, `tests/sim/selectors.test.ts`, `tests/sim/step.test.ts` (modified)
- `tests/save/busy.ts`, `tests/save/validate.test.ts`, `tests/save/migrations.test.ts` (modified)
- `_bmad-output/implementation-artifacts/2-5-carcass-eating-and-the-virus.md` (new)
- `_bmad-output/implementation-artifacts/sprint-status.yaml`, `_bmad-output/project-context.md` (modified)

### Change Log

- 2026-10-07: Implemented carcass eating and the virus:
  - `seekCarcass` (food first), carcass eating with infection, and the 20 s virus death through `killSheep`;
  - the `CarcassEaten`/`Infected` events;
  - `PublicSheep.infected`, with the infection tint, bubble marker and wobble;
  - save schema 5;
  - the debug Infect one button.

  Status → review.
- 2026-10-07: Code review: wobble kept always on (Rylan's decision); 12 patches plus 1 found in verification applied. Status → done.
