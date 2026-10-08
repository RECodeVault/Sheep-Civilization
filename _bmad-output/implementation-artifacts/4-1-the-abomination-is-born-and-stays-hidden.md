---
baseline_commit: 82e20e5
---

# Story 4.1: The Abomination Is Born — and Stays Hidden

Status: done

<!-- Created 2026-10-08 by create-story. First story of Epic 4 (Should tier). It adds the Abomination's identity, spawn rule and secrecy only. The tells (4.2), kill cycle (4.3) and reveal (4.4) come later. Earlier stories left "Story 4.1" hooks in lifecycle.ts, feeding.ts, market.ts, betterPlace.ts, events.ts, DebugOverlay.ts and eslint.config.js; this story fills or updates each one. -->

## Story

As a player,
I want one lamb in my flock to secretly be a monster that looks exactly like any other lamb,
so that I have a mystery to watch for.

## Acceptance Criteria

1. **The spawn window is rolled at new game (FR29, AR18).** `createNewGame(seed)` sets `state.abomination = { birthsSeen: 0, guaranteedAtBirth }`, where `guaranteedAtBirth` is drawn from the seeded RNG with `rngInt(state, TUNING.abominationGuaranteedBirthMin, TUNING.abominationGuaranteedBirthMax)` (8 and 15). Across seeds it takes values throughout [8, 15] and never falls outside it.
2. **A birth can be the Abomination (FR29).** On every birth (a pregnancy that comes due in `lifecycle.ts` `births()`; never the founding lamb, debug-added sheep or anything else from `createSheep`), `birthsSeen` goes up by 1. Then the new lamb gets `isAbomination = true` when **no Abomination is alive** and either:
   - `birthsSeen === guaranteedAtBirth` (the guaranteed one, so it can happen once per save), or
   - `birthsSeen > guaranteedAtBirth` and a seeded roll `rng(state) < TUNING.abominationBirthChance` (5%).
   No roll is drawn for births before the guaranteed one, or while an Abomination is alive. If one is already alive at the guaranteed birth (only possible through the DEV tools), that guarantee is lost and later births use the 5% roll. At most one Abomination is ever alive.
3. **It stays a lamb for ever (FR30).** `stageOf()` returns `'lamb'` for an Abomination at any age. So:
   - it never dies of old age: `updateLifecycle` skips the old-age `killSheep` for it;
   - it never eats breeding food, is never ready and is never picked by the Breed tool (all these check for an adult);
   - it can never be sold: `sell()` gets price 0 from `salePrice('lamb')` and puts it down, as for any lamb, and the view's Market shows "Too young";
   - it drains Fullness and eats food (and carcasses, when Starving with no food in the pen) like any lamb, so it **can starve**, and it dies through `killSheep(…, 'starved')` with a carcass;
   - it counts toward capacity (`slotsUsed`) and eras (`currentEra`), because it is in `state.sheep`.
4. **The view only sees `PublicSheep` (AR16, AR18, UX-DR64).** `PublicSheep` gains `gait: 'normal' | 'offstep'` (`'offstep'` for an Abomination only). It has no `isAbomination` and no `stalk` field, and it reports `stage: 'lamb'` for the Abomination at any age. `publicSheep()` and `selectPublicSheep()` set `gait` the same way (`selectPublicSheep` still allocates nothing per frame). The ESLint rule that forbids reading `isAbomination` outside `src/sim/`, `src/debug/` and `src/save/` already exists (`eslint.config.js`). This story checks that it fires on view code and keeps it in place. No view, HUD, tooltip, toast, ping or threat-summary code changes behaviour. The view does not use `gait` yet: the off-step walk is Story 4.2.
5. **The mandatory secrecy test (AR12, project-context Testing Rules).** A test builds an Abomination and a normal lamb with equal fields, apart from the flag (same id, position, `bornAt`, Fullness, activity, readiness, cooldown and infection). It shows that `publicSheep()` returns objects that differ **only** in `gait`. A second case gives both an age past `elderFromMs` and checks that the Abomination still reports `stage: 'lamb'`, `ready: false` and `canBreed: false`, with no `isAbomination` or `stalk` key on the output.
6. **DEV "Reveal Abomination" (AR15).** The DEV debug overlay gets a **Reveal Abomination** toggle button. While it is on, the living Abomination (if any) gets an outline on the field that follows its drawn sprite, including while the camera pans. The button also shows whether the toggle is on. The outline exists only in DEV builds (it is in `src/debug/`, which production never loads) and only while the toggle is on. Production builds contain none of this.
7. **Saves carry the secret safely (AR9, NFR7).** `SAVE_SCHEMA_VERSION` goes from 8 to 9.
   - Migration 8 → 9 adds `isAbomination: false` to every sheep, plus `state.abomination = { birthsSeen: 0, guaranteedAtBirth }`, with `guaranteedAtBirth` drawn the same way as at new game, from the save's own `rng` (deterministic).
   - Validation rejects: a sheep without a boolean `isAbomination`; two or more living Abominations; a missing or non-object `abomination`; a `birthsSeen` that is not an integer ≥ 0; a `guaranteedAtBirth` outside [min, max].
   - The save round-trip test (busy game) includes a living Abomination and a non-zero `birthsSeen`.
8. **Sacrifice reports the truth to the sim channel (prep for 4.4).** `sacrifice()` emits `Sacrificed { wasAbomination: s.isAbomination }`, read before `removeSheep`. The view still never branches on it: HudScene's toast and `GameScene.suck` are unchanged until Story 4.4.
9. **Done = `npm test`, `npm run typecheck` and `npm run lint` all pass.** Any seeded test whose numbers move because of the new RNG draw is fixed as described in Task 7, never by loosening an assertion. The pacing probe (`tests/sim/scenarios/pacing.test.ts`) still passes, or its result is reported to Rylan (see Open Questions).

## Tasks / Subtasks

- [x] **Task 1: State, tuning and the new-game roll (AC 1)**
  - [x] 1.1 `src/config/tuning.ts`: add `abominationGuaranteedBirthMin: 8`, `abominationGuaranteedBirthMax: 15` and `abominationBirthChance: 0.05`, each with a GDD citation comment (GDD "The Abomination (Should tier)" → Spawn). Put them in a new Abomination block near `personalSpacePx` (which 4.2 will pair with the 36 px value). Check `tests/config/tuning.test.ts` for any key or shape assertions that need the new keys.
  - [x] 1.2 `src/sim/state.ts`: add `isAbomination: boolean` to `Sheep`, with a doc comment that it is secret (sim, debug and save only; the view reads `PublicSheep`; AR18). `createSheep` sets it to `false`. Do not add `stalk`, `doomedAt` or `nextKillAt` here: Story 4.3 adds them.
  - [x] 1.3 `src/sim/state.ts`: add `export interface AbominationState { birthsSeen: number; guaranteedAtBirth: number }` and `abomination: AbominationState` on `GameState`, with doc comments (FR29). Story 4.3 adds `nextKillAt`.
  - [x] 1.4 `createNewGame`: build `abomination` with `birthsSeen: 0` and draw `guaranteedAtBirth` with `rngInt(...)` **after** the founding-flock loop. Then the founders' positions and headings for every seed stay exactly as they are today; only later draws shift by one.
  - [x] 1.5 Update the `SheepActivity` comment if it mentions 4.1. Leave `stalking` to 4.3.

- [x] **Task 2: The spawn rule (AC 2)**
  - [x] 2.1 Create `src/sim/systems/abomination.ts` (architecture System Location Mapping: "Abomination → `src/sim/systems/abomination.ts`: spawn rule, kill cycle, delayed victim death"). Give it a header comment like the other systems. In this story it exports only:
    - `abominationAlive(state): boolean`: a plain loop over `state.sheep` (no allocation). Used on births and by the DEV tools. Derived; never store an id.
    - `onBirth(state, lamb: Sheep): void`: increments `birthsSeen`, then applies AC 2 in this order: return if one is alive (no draw); guaranteed check; else if past the guarantee, `rng(state) < TUNING.abominationBirthChance`. Sets `lamb.isAbomination = true` on success. Emits **no** event: the view must not learn of the spawn.
  - [x] 2.2 `src/sim/systems/lifecycle.ts` `births()`: call `onBirth(state, lamb)` right after `createSheep`, before the `LambBorn` emit. This is the "shared helper owned by the concept" exception to "systems never call each other" (same as `killSheep` from `carcass.ts`). Note it in the header comment. Do **not** react to the `LambBorn` event inside the sim: events go to the view only, and no system consumes them.
  - [x] 2.3 Do not add an `updateAbomination` system to `step.ts` yet: nothing runs per tick until 4.3. Leave the intended-order comment in `step.ts` as it is.
  - [x] 2.4 Update the `LambBorn` comment in `src/sim/events.ts`: the Abomination is decided in the sim at birth (`abomination.ts` `onBirth`), not from this event, and `LambBorn` looks the same either way.

- [x] **Task 3: Forever a lamb (AC 3)**
  - [x] 3.1 `src/sim/selectors.ts` `stageOf`: return `'lamb'` first when `s.isAbomination`. This single change keeps it unsellable (`market.ts`), unable to breed (`canBreed`) and away from breeding food (`feeding.ts` `canUseBreedingFood`). Update the doc comment. `stageOf` runs per sheep per tick, so keep it a boolean check with no allocation.
  - [x] 3.2 `src/sim/systems/lifecycle.ts`: skip the old-age `killSheep` when `s.isAbomination` (the code already has a placeholder comment there). Leave the `breedReady` clearing as it is: an Abomination can never become ready.
  - [x] 3.3 Refresh the "Story 4.1" comments in `market.ts` (lines 4–6), `feeding.ts` (line 171) and `lifecycle.ts` (header and line 27) so they describe what now happens.
  - [x] 3.4 Hunger, feeding and carcass eating need no change: the Abomination is an ordinary sheep to them (it can starve). Do not add special cases.

- [x] **Task 4: PublicSheep and the secrecy boundary (AC 4, 5)**
  - [x] 4.1 `PublicSheep`: add `gait: 'normal' | 'offstep'`, with a comment: the designed tell (FR32), the only field where an Abomination differs, drawn by Story 4.2. Export a `Gait` type if that reads better. Set it in `publicSheep()` and in `selectPublicSheep()`, both the placeholder literal for new slots and the per-frame assignment. Update the "Later stories add name, gait, activity" comment: gait is here now.
  - [x] 4.2 Do **not** add `activity` to `PublicSheep` (Story 4.3 adds it with the `stalking` → `wander` mapping) or `name` (Story 5.3).
  - [x] 4.3 Run `npm run typecheck`. Every place that builds a `PublicSheep` literal must now set `gait`. Today that is only `selectors.ts`, but check, and also check `GameScene`'s DEV probe (`selectPublicSheep(probe, [])` around line 958).
  - [x] 4.4 Check the lint boundary (AC 4). Temporarily add `s.isAbomination` to a file under `src/view/` and check that `npm run lint` reports "View code must use PublicSheep…". Then remove it. Also check that it does **not** fire in `src/sim/`, `src/debug/` and `src/save/`. Update the `eslint.config.js` comment "secrecy off: save validation and migrations must read isAbomination once Story 4.1 adds it" to the present tense. Do not widen the rule to `stalk` or `abomination` in this story (see Open Question 3).

- [x] **Task 5: Sacrifice and the DEV tools (AC 6, 8)**
  - [x] 5.1 `src/sim/systems/betterPlace.ts`: read the sheep (`state.sheep[i]`) and emit `wasAbomination: s.isAbomination`. The `Sacrificed` emit stays before `removeSheep`. Update the header comment. **Do not** touch `HudScene` (line ~322) or `GameScene.suck`: they must not branch on `wasAbomination` until 4.4. Update the deferred-work note "`Sacrificed.wasAbomination` is always false today" (Task 8).
  - [x] 5.2 `src/debug/DebugOverlay.ts`: add a **Reveal Abomination** toggle button, highlighted while on (use the existing `highlight(b, on)`). Add it to `simButtons` so it is disabled with no active GameScene.
  - [x] 5.3 The outline: in the existing page-lifetime `POST_RENDER` handler, while reveal is on and a GameScene is active, find the living Abomination in `scene.simState.sheep` (debug may read `isAbomination`). Place one outline at its **drawn** position. Do this through a small new DEV-only GameScene method, e.g. `debugSheepDrawnAt(id): { x: number; y: number } | null`, which reads `this.sheepLayer.spriteFor(id)` (`EntityLayer.spriteFor` exists). It takes an id, not a flag, so GameScene never reads `isAbomination`. Fall back to the sim position if no sprite is bound.
    - Create the outline once per GameScene: a `scene.add.graphics()` with one `lineStyle(2, COLOR_INT.alert)` + `strokeCircle(0, 0, r)` (r ≈ 40, enough to ring a 64×52 sheep). Then only `setPosition` / `setVisible` each frame. No redraw per frame (project rule: no `Graphics` redrawn per frame). Depth `FIELD_DEPTH.overlay` (`src/view/field/depths.ts`). It is a world object, so it pans with the field camera.
    - A GameScene restart (Load save, New Game, Restart) destroys the scene's display objects. Re-create the outline when the active scene changes or the graphics has been destroyed (`!g.active` / `g.scene !== scene`). Never leak one across restarts.
    - Hide it when reveal is off, there is no Abomination, or the game is lost.
    - Phaser 4 API: `Graphics.lineStyle` / `strokeCircle` / `setDepth` are unchanged from v3, but confirm in `node_modules/phaser/skills/graphics-and-shapes` before use (project rule: never write Phaser API from memory).
  - [x] 5.4 Optional but recommended, for checking AC 6 without breeding 8–15 lambs: a **Make Abomination** button. If none is alive, it makes a new lamb (`createSheep` at a `Math.random` spot inside `innerFence`, `bornAt: s.time`, as the +food buttons place pieces) and sets its flag, through `debugMutate`. It does not touch `birthsSeen`. If one is already alive, it does nothing and `setStatus` says so.
  - [x] 5.5 Readout: extend an existing line (e.g. `sheepLine`) or add one with `abom #id | none · births {birthsSeen}/{guaranteedAtBirth}`. DEV only, fine to read the secret here.
  - [x] 5.6 Update the overlay's header comment ("Later stories add their buttons here: Reveal Abomination (4.1)…").

- [x] **Task 6: Saves (AC 7)**
  - [x] 6.1 `src/config/constants.ts`: `SAVE_SCHEMA_VERSION = 9`.
  - [x] 6.2 `src/save/migrations.ts`: add step `8:`. Every sheep object gets `isAbomination: false`, using the same `Array.isArray`/`isObj` guards as steps 2 and 3, so malformed lists pass through to validation. Add `abomination: { birthsSeen: 0, guaranteedAtBirth }`, rolled with `rngInt` on a copy whose `rng` is the save's `rng` (write the advanced `rng` back). If `s.rng` is not a valid integer, set `abomination` anyway with `guaranteedAtBirth: TUNING.abominationGuaranteedBirthMax` and leave `rng` for validation to reject. A save from before Epic 4 starts counting births from its load. Comment why (births before the migration are not known).
  - [x] 6.3 `src/save/validate.ts`: per sheep, `typeof o.isAbomination === 'boolean'`; count `true`s and fail when there are 2 or more. At top level, `abomination` is an object, `int(abomination, 'birthsSeen', 'abomination', 0)` and `int(abomination, 'guaranteedAtBirth', 'abomination', TUNING.abominationGuaranteedBirthMin, TUNING.abominationGuaranteedBirthMax)`.
  - [x] 6.4 `src/save/normalize.ts`: clamp `abomination.guaranteedAtBirth` into the current [min, max] (both ends), so a later retune of the window does not reject a save. This follows Story 3.6's retune-safe pattern; validation stays strict.
  - [x] 6.5 `tests/save/busy.ts`: make one living lamb an Abomination (e.g. add a lamb through `createSheep` with `bornAt: state.time` and set the flag, or flag an existing sheep; keep the "Callers assert it is busy" checks happy). Set `birthsSeen` to a non-zero value, and update the doc comment's list of fields in use.
  - [x] 6.6 `tests/save/migrations.test.ts`: add `toVersion8()`, which deletes `abomination` and every sheep's `isAbomination`, and chain `toVersion7` from it. Test that a v8 state migrates to a valid v9 state with `birthsSeen 0`, a `guaranteedAtBirth` in range, and every sheep `isAbomination: false`; that the migration is deterministic for the same input; and that older versions still chain through.
  - [x] 6.7 `tests/save/validate.test.ts`: rejection cases from AC 7. `tests/save/normalize.test.ts`: the clamp.

- [x] **Task 7: Tests (AC 1–5, 8, 9)**
  - [x] 7.1 `tests/sim/systems/abomination.test.ts` (new):
    - new game: `birthsSeen === 0`; `guaranteedAtBirth` within [min, max] for many seeds (e.g. 1..200), and the set of values seen covers min and max;
    - `onBirth` on births 1..g−1 flags nothing and draws no RNG (`state.rng` unchanged);
    - birth g flags the lamb;
    - birth g with an Abomination already alive: not flagged, and later births then use the 5% roll;
    - after g: across e.g. 4 000 seeded births, removing the Abomination after each spawn, the spawn rate is within [0.035, 0.065]. Seeded and deterministic, so the assertion is stable;
    - while one is alive: no spawn and no draw over many births.
  - [x] 7.2 `tests/sim/systems/lifecycle.test.ts`: an Abomination kept fed (top up `fullness` between `runFor` chunks) is alive after `TUNING.oldAgeMs + TICK_MS` and `stageOf` is `'lamb'`. A scenario test drives births through real pregnancies until birth `guaranteedAtBirth`, and the lamb born then is the Abomination (assert via `isAbomination`, which tests may read).
  - [x] 7.3 Starvation: an unfed Abomination dies at `TUNING.starveMs` with `SheepDied { cause: 'starved' }` and a `CarcassSpawned` (it is an ordinary death).
  - [x] 7.4 `tests/sim/systems/market.test.ts`: an Abomination aged past `lambUntilMs` is not sold (no `Sold`, money unchanged, still alive, put down if dragged).
  - [x] 7.5 `tests/sim/systems/feeding.test.ts` or `breeding.test.ts`: an adult-aged Abomination never claims a breeding piece and `canBreed` is false even with `breedReady` forced true.
  - [x] 7.6 Capacity and eras: an Abomination counts in `slotsUsed` and toward `currentEra` (e.g. 9 sheep + an Abomination reaches Village).
  - [x] 7.7 `tests/sim/selectors.test.ts`: the mandatory secrecy test (AC 5); update the existing exact-shape `publicSheep` assertion (line ~92) to include `gait: 'normal'`. Also check that `selectPublicSheep` matches `publicSheep` for a flock containing an Abomination.
  - [x] 7.8 `tests/sim/systems/betterPlace.test.ts`: sacrificing the Abomination emits `Sacrificed { wasAbomination: true }`; existing innocent cases stay `false`.
  - [x] 7.9 `tests/sim/state.test.ts`: `createNewGame` founders are unchanged by the new draw. Their positions are drawn before it, so a snapshot or comparison of the founders still holds. Every created sheep has `isAbomination: false`.
  - [x] 7.10 Run the full suite. The new draw at new game and the 5% draws after the guaranteed birth shift seeded sequences. When a seeded test's outcome changes:
    - fix it so it tests the same rule (e.g. reseed, or compute the expected value from state) and note it in the Debug Log;
    - never loosen what the test checks.
  - [x] 7.11 The pacing probe: a permanent lamb now joins the flock around birth 8–15 and never breeds or sells, so Village/Town times may move. Run `npx vitest run tests/sim/scenarios/pacing.test.ts --reporter=verbose` and record the before/after table in the Debug Log. If the GDD-window guard now fails, **do not retune**: stop and report to Rylan (Open Question 1).
  - [x] 7.12 Run `npm run bench` (Story 3.6): the tick must stay well under 2 ms at 100 sheep; `stageOf` gained one boolean check.

- [x] **Task 8: Docs and housekeeping**
  - [x] 8.1 `deferred-work.md`: mark "The Abomination stays unsellable (Story 4.1)" resolved (how: `stageOf`). Update the 4.4 reveal note: `wasAbomination` is now real; the view still ignores it. Add any new deferrals under a "Deferred from: story 4-1…" heading.
  - [x] 8.2 Manual check in the browser (`npm run dev`): Make Abomination (or breed until it spawns), turn on Reveal, and check that the outline follows it while it walks, while the camera pans and after a Load save. Hover it: the tooltip reads "Lamb · …". Drag it over the Market: "Too young". The threat summary and pings treat it as any lamb. Reveal off: no outline. Run `npm run build` and grep `dist/` for `Reveal Abomination` and `isAbomination`. The button label must be absent. `isAbomination` may appear in sim code (it ships with the sim, which is expected); it must not appear in any view-only path.

### Review Findings

- [x] [Review][Decision] Retune clamp of `guaranteedAtBirth` ignores `birthsSeen` — resolved by Rylan (2026-10-08): option A, which becomes the patch below.
- [x] [Review][Patch] Validate `guaranteedAtBirth` as an integer ≥ 1 only (AC 7 relaxed by Rylan); `normalizeTuned` clamps only a pending guarantee into [max(min, birthsSeen + 1), max] [src/save/validate.ts, src/save/normalize.ts:39]
- [x] [Review][Patch] Adult-aged Abomination with `breedReady: true` (crafted save) keeps a ready heart on a "lamb"; clear readiness by `stageOf(s) !== 'adult'`; fix the tautological `ready` assertion in the secrecy test [src/sim/systems/lifecycle.ts:29, tests/sim/selectors.test.ts]
- [x] [Review][Patch] Old-version decode fixtures never strip the v9 fields, so the end-to-end path doesn't prove the migration creates them [tests/save/saveFile.test.ts:24-66]
- [x] [Review][Patch] DEV "Make Abomination" before the guaranteed birth uses up the guarantee; say so at the button [src/debug/DebugOverlay.ts:265]
- [x] [Review][Patch] Stale deferred-work parent note still says `wasAbomination` "is always false today" [_bmad-output/implementation-artifacts/deferred-work.md:193]
- [x] [Review][Patch] `debugSheepDrawnAt` hands the live pooled sprite to debug code; return a position copy (write into an out object) [src/view/scenes/GameScene.ts:707]
- [x] [Review][Patch] Architecture N2 not updated: the spawn is called from `births()` (not on `LambBorn`), and the "always a lamb" check is in `stageOf` (not `publicSheep`) [_bmad-output/game-architecture.md:587,615]
- [x] [Review][Defer] The busy save fixture depends on its seed: any rng shift can need a seed hunt [tests/save/busy.ts:15] — deferred, pre-existing

## Dev Notes

### What this story is (and is not)

- **Is:** the secret flag, its spawn rule, "forever a lamb", the `PublicSheep.gait` field, the secrecy test, the DEV reveal, and saving all of it.
- **Is not:** the off-step walk or 36 px avoidance (4.2: the view draws `gait`, `movement.ts` widens separation); stalking, `doomedAt`, `nextKillAt` and the `'abomination'` death (4.3); the reveal flash, screech or "Good riddance." (4.4). Don't build ahead. Each later story adds its own fields and schema bump.
- After this story, an Abomination in play does nothing harmful. It is a lamb that never grows up. That is fine: Epic 4 is built up story by story.

### Current code to build on (read these first)

| File | Today | This story |
|---|---|---|
| `src/sim/state.ts` | `Sheep` without a flag; `createSheep` (the one place a sheep is added, keeps `peakFlock`); `createNewGame` draws positions then headings via `createSheep` | add `isAbomination`, `abomination` state, the new-game roll after the founders |
| `src/sim/selectors.ts` | `stageOf` derives from age; `publicSheep` / `selectPublicSheep` (reuses `out` objects, no allocation) | Abomination → `'lamb'`; add `gait` |
| `src/sim/systems/lifecycle.ts` | `births()` creates lambs from due pregnancies and emits `LambBorn`; the old-age loop has a `// Story 4.1` placeholder | call `onBirth`; skip old age |
| `src/sim/systems/betterPlace.ts` | emits `wasAbomination: false` | emit the real flag |
| `src/sim/systems/market.ts` | price from `salePrice(stageOf(...))`; 0 → put the lamb down | no code change (the comment only) |
| `src/sim/systems/feeding.ts` | `canUseBreedingFood` requires `stageOf === 'adult'` | no code change (the comment only) |
| `src/debug/DebugOverlay.ts` | DOM panel; `debugMutate`; page-lifetime `POST_RENDER` handler; `button`, `highlight`, `setStatus` helpers | Reveal toggle, outline, readout, optional Make |
| `src/view/scenes/GameScene.ts` | `simState`, `debugMutate`, private `sheepLayer: EntityLayer<PublicSheep, SheepSprite>` | add a DEV-only `debugSheepDrawnAt(id)` |
| `src/save/{migrations,validate,normalize}.ts` | schema 8; pattern of one migration step per bump; strict validation; retune clamps | step 8 → 9, new rules, one clamp |
| `eslint.config.js` | `SECRECY_SYNTAX` already blocks `isAbomination` member reads and property keys outside sim/debug/save | verify, update the comment |

### What must be preserved

- **Secrecy (UX-DR64).** No view path may tell the Abomination apart, except `gait`, which nothing draws yet. Today the view gets stage, hunger, ready, cooldown, canBreed and infected from `PublicSheep` only (`SheepSprite`, `SheepHover`, `SheepDrag`, `InputController.canBreed`, `ThreatSummary` via `selectHudView`). Keep it that way: no `Sheep` import in `src/view` or `src/input`.
- **No spawn event.** `LambBorn` must look the same for an Abomination. Don't add a field or an event.
- **The single death pipeline (N1).** An Abomination dies only through `killSheep` (starvation, virus) or leaves through `removeSheep` (sacrifice). Never splice `state.sheep`.
- **Determinism.** Every random draw goes through `rng(state)` / `rngInt`; the draw order is part of the save. Founders' positions must not move (draw after the loop).
- **No allocation in hot paths.** `stageOf` and `selectPublicSheep` run per sheep per tick/frame: a boolean check and a string assignment only. `abominationAlive` runs on births (rare), but write it as a plain loop anyway.
- **HUD behaviour on sacrifice stays as it is** (toast "A sheep went to a Better Place.", suction). 4.4 owns the branch.
- **`savable()`** in `saveFile.ts` copies sheep with spread when one is dragged: the flag rides along. No change needed, but the round-trip test must cover it (busy game).

### Architecture compliance

- Pattern N2 (game-architecture.md §Novel Patterns): sheep-record fields are sim-only; `state.abomination` holds `{ birthsSeen, guaranteedAtBirth, nextKillAt }`. 4.1 adds the first two, and 4.3 adds `nextKillAt`. `publicSheep` is the only sheep shape for the view; truth reaches the view only through `Sacrificed { wasAbomination }`.
- The architecture sketch writes `stage: s.isAbomination ? 'lamb' : stageOf(s, state)` inside `publicSheep`. This story puts that check **in `stageOf` itself** instead, so the sim (Market, breeding, breeding food) and the view agree from one rule. Deferred-work says the same: "`market.ts` relies on `stageOf` reporting the Abomination as a lamb". Both give the same result for the view.
- Systems communicate through `GameState`. `onBirth` is a helper owned by `abomination.ts` and called from `lifecycle.ts`, like `killSheep` (owned by `carcass.ts`, called from hunger, lifecycle and virus).
- Every new number lives in `TUNING`; tests read `TUNING`, never literals.
- `GameState` stays plain JSON: `isAbomination` is a required boolean (architecture's `createSheep` sketch sets `isAbomination: false`); `abomination` is a plain object.
- Adding fields → bump `SAVE_SCHEMA_VERSION` + migration + validation in the same story (project-context anti-pattern list).

### Library / framework notes (no new dependencies)

- No new packages. Phaser is 4.2.1 (`node_modules/phaser/package.json`). The only Phaser API this story touches is `Graphics` in the DEV overlay. Check `node_modules/phaser/skills/graphics-and-shapes` and `v3-to-v4-migration` before writing it.
- The overlay already imports from `src/view` (`bus`, `GameScene` type); importing `FIELD_DEPTH` and `COLOR_INT` is fine (debug is not a pure layer).

### Testing standards

- Vitest, `tests/<same path as src>/…`; scenarios in `tests/sim/scenarios/`. Build state with `newGame(seed)` (`tests/sim/helpers.ts`), advance with `runFor(state, ms)` (multiples of `TICK_MS`). Assert on state and emitted `SimEvent`s; no spies, no fake timers, no `Math.random`.
- Tests are outside the ESLint secrecy groups (`src/**` only), so tests may set and read `isAbomination` directly.
- To force a birth in tests without breeding mechanics, push a `Pregnancy` with `dueAt: state.time + TICK_MS` (see `busy.ts` for the shape and inner-fence clamp) and `runFor` one tick. Or call `onBirth` directly for unit tests.

### Previous story intelligence (3.6 and Epic 3)

- 3.6 added `normalizeTuned` (load-only clamps) and kept `validateState` strict for `writeSave`. Follow it for `guaranteedAtBirth`.
- 3.6 added the pacing probe and `npm run bench`. Both are regression guards for anything that changes the flock's make-up; a permanent lamb is such a change.
- 3.6's DEV instruments (`PlaytestRecord`, tick stats) live in the same `POST_RENDER` handler you will extend. It is registered once per page on `game.events`, so do not register a second one per scene.
- Epic 2/3 reviews often found: listeners or objects leaking across GameScene restarts, comments left stale after behaviour changed, and seeded tests "fixed" by loosening. Avoid all three.
- Each schema bump so far (2.2, 2.3, 2.5, 2.8, 3.1, 3.2) added a `toVersionN` helper in `migrations.test.ts` and chained the older ones through it. Do the same.

### Git intelligence

- Recent commits (`3.3` → `3.6`) follow: implement → code review fixes as a separate commit; story file, `deferred-work.md` and `sprint-status.yaml` updated in the same commit as the code. Branch for this story: `story/4-1-the-abomination-is-born-and-stays-hidden` (already created).

### Open questions (defaults chosen; confirm or change)

1. **Pacing with a permanent lamb.** If the pacing probe's Village/Town guard fails once the Abomination joins, the default is to stop and ask Rylan, not to retune or change the probe's policy. (4.3's kills will move pacing much more; a pacing re-check may belong after 4.3.)
2. **Old saves.** Default: a pre-Epic-4 save starts counting births from the migration, so its first Abomination comes 8–15 births after loading. The alternative (estimate past births) has no reliable data.
3. **Lint scope.** Default: the secrecy lint rule stays on `isAbomination` only (as the architecture and AC say). `stalk` arrives in 4.3, and that story should decide whether to add it to `SECRECY_SYNTAX`. `state.abomination` reads in the view are not blocked by lint; review catches them.
4. **Make Abomination (DEV).** Task 5.4 is not in the AC. It is recommended so AC 6 can be checked without breeding 8–15 lambs. Drop it if unwanted.

### Project Structure Notes

- New: `src/sim/systems/abomination.ts`, `tests/sim/systems/abomination.test.ts` (and a scenario under `tests/sim/scenarios/` if 7.2's birth-driven case reads better there).
- Modified: `src/config/{tuning,constants}.ts`, `src/sim/{state,selectors,events}.ts`, `src/sim/systems/{lifecycle,betterPlace,market,feeding}.ts` (market/feeding: comments only), `src/debug/DebugOverlay.ts`, `src/view/scenes/GameScene.ts` (DEV-only method), `src/save/{migrations,validate,normalize}.ts`, `eslint.config.js` (comment), tests listed in Task 7, `_bmad-output/implementation-artifacts/deferred-work.md`.
- No conflicts with the architecture tree (`src/sim/systems/abomination.ts` is the planned location).

### Project Context Rules (from `_bmad-output/project-context.md`)

- **The Abomination is secret.** View, HUD, tooltip, toast, stats and save-inspection code use `PublicSheep` only; `isAbomination`/`stalk` are read only in `src/sim/`, `src/debug/` and `src/save/`. It always displays as a lamb, and it never ages or dies of old age but **can starve**.
- `src/sim/` is pure TS: no Phaser, DOM, `Date.now()`, `Math.random()` (lint-enforced). Use `rng(state)`.
- New rule → `src/sim/systems/<system>.ts`; new tunable → `TUNING`; new state fields → schema bump + migration + validation.
- Timers are absolute game-ms deadlines (none needed in 4.1).
- No allocation in `step()`/systems/`update()`/selectors called per frame.
- `src/debug/` exists only behind `import.meta.env.DEV`; production contains none of it.
- No Graphics redrawn per frame; draw once, move it.
- Listener and object cleanup on scene shutdown; restart must not double-subscribe or leak.
- Phaser 4, not 3: verify APIs in `node_modules/phaser/skills/`.
- Done = `npm test`, `npm run typecheck`, `npm run lint` all green; rendering checked manually in the browser.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 4.1: The Abomination Is Born — and Stays Hidden]
- [Source: _bmad-output/planning-artifacts/epics.md#Requirements Inventory] FR29, FR30, FR32, FR33; AR12, AR15, AR16, AR18; UX-DR53, UX-DR64
- [Source: _bmad-output/planning-artifacts/gdds/gdd-sheep-civilization-2026-10-05/gdd.md#The Abomination (Should tier)]
- [Source: _bmad-output/game-architecture.md#N2 — Abomination: Hidden Identity, Delayed Kill, Reveal]
- [Source: _bmad-output/game-architecture.md#State Patterns] (`stalking` activity: 4.3)
- [Source: _bmad-output/project-context.md#Critical Don't-Miss Rules]
- [Source: _bmad-output/implementation-artifacts/deferred-work.md] "The Abomination stays unsellable (Story 4.1)", "The reveal (Story 4.4)"
- [Source: _bmad-output/implementation-artifacts/3-6-mvp-pacing-playtest-and-tuning-pass.md] normalizeTuned, pacing probe, bench

## Dev Agent Record

### Agent Model Used

Claude Opus 5.5 (claude-opus-5-5[1m])

### Implementation Plan

- The spawn decision lives in the sim at birth: `lifecycle.ts births()` calls `abomination.ts onBirth` (a helper owned by the concept, like `killSheep`); no event is emitted, and `LambBorn` is unchanged.
- "Forever a lamb" is one rule in `stageOf`, so the Market, breeding, breeding food and `PublicSheep` all agree; `lifecycle.ts` skips the old-age death.
- `PublicSheep.gait` is the only field that differs; the view does not use it yet (4.2).
- Saves: schema 9; the 8 → 9 migration rolls `guaranteedAtBirth` from the save's own rng; validation allows at most one Abomination; `normalizeTuned` clamps the window.
- DEV: Reveal ring (one Graphics per GameScene, drawn once, moved on `POST_RENDER`, re-created after a restart), Make Abomination, and an `abom` readout line.

### Debug Log References

- **Seeded fixture moved (7.10):** the new-game draw shifted `busyGame(31337)`'s rng so every food piece was eaten in its 1 s run (no `seekFood`, so `isBusy` failed). Reseeded to 31339 (the first seed for which every busy condition holds), with a comment. No assertion was loosened.
- **Older-version migrations (7.10):** every pre-9 save now passes through the 8 → 9 roll, so the expected states in `migrations.test.ts` and `saveFile.test.ts` apply `migratedFrom8()` (`tests/save/fromVersion8.ts`), which states the spec rule (roll from the save's own rng).
- **Founders unchanged:** positions and headings for seeds 1, 1234 and 0xffffffff were recorded on 82e20e5 before the change, and `state.test.ts` asserts them.
- **Pacing probe (7.11), seed 3606, before → after:**
  - 2 cps: Village 5:36 → 4:20; Town — → —
  - 3 cps: Village 4:02 → 3:51
  - 5 cps: Village 3:32 → 3:37
  - 6 cps: Village 3:35 → 3:32; Town 14:17 → 15:00
  - The Town guard (6 cps, seeds 3606/11/2026) now fails on seed 11: 15:46 (limit 15:00). Over seeds 1–40 at 6 cps, with the Abomination: mean 14.26 min, 5/40 over 15 min; with it disabled (same rng shift): mean 14.03 min, 3/40 over. The guard had thin margin before; the Abomination adds about 0.2 min on average. Per Open Question 1, nothing was retuned; I reported the numbers to Rylan, with 7 clicks/s for comparison (all 40 seeds in 12.5–14.2 min, but guard seed 3606 at 14:56).
  - **Rylan's decision (2026-10-08): defer the guard.** The Town test is `it.skip` with its reason in a comment, and a re-check after 4.3 (kills) and 4.7 (Better Hoe) is logged in deferred-work.md. The Village guard, determinism, no-loss and report-table tests still run.
- **Bench (7.12), `npm run bench`:** every mean ≤ 0.21 ms, p99 ≤ 0.72 ms (budget 2 ms), the same as 3.6. The known one-off 10–14 ms first-tick sample (GC in the bench setup, already deferred) appeared again.
- **Lint boundary (4.4):** a probe file reading `s.isAbomination` was flagged in `src/view/` and `src/input/` ("View code must use PublicSheep…") and not in `src/sim/`, `src/debug/` or `src/save/`. Probe files removed.
- **Browser (8.2):** a scratchpad Playwright probe on the DEV build (`main.ts` exposed the game temporarily; restored, no diff). All passed: Make makes one (a second does nothing); the ring stays on the drawn sprite while it walks (0 px), after a 60 px camera pan (world object) and after a restart through `loadState` (one ring, no leak); the tooltip reads "Lamb · Fed"; an elder-aged Abomination dragged over the stall shows "Too young" and is not sold; Reveal off hides the ring; the ring stays when the panel is closed; no console errors (headless GL `ReadPixels` warnings from screenshots filtered). `npm run build`: no "Reveal Abomination", "Make Abomination" or `abom` readout in `dist/`; `isAbomination` appears only through the bundled sim/save code.

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created
- Implemented the Abomination's identity, spawn rule (guaranteed birth 8–15, then 5%, at most one alive), "forever a lamb" via `stageOf`, `PublicSheep.gait`, the real `Sacrificed.wasAbomination`, schema 9 with migration, validation and normalize, and the DEV Reveal/Make tools.
- Tests added: `tests/sim/systems/abomination.test.ts` (window, guaranteed birth, lost guarantee, rate within ±30% of 5% over 4 000 births, no draws while alive, no event), `tests/sim/scenarios/abomination.test.ts` (real pregnancies up to the guaranteed birth; same LambBorn shape; still a lamb after lambUntilMs), the mandatory secrecy test and capacity/era cases in `selectors.test.ts`, old age and starvation in `lifecycle.test.ts`, the Market and breeding food, sacrifice `wasAbomination`, founders unchanged, and the save migration, validation and normalize cases.
- Pacing (7.11): the Town guard is skipped by Rylan's decision and deferred to a re-check after 4.3/4.7 (Debug Log, deferred-work.md). No gameplay number changed.

### File List

- `src/sim/systems/abomination.ts` (new)
- `src/sim/state.ts`
- `src/sim/selectors.ts`
- `src/sim/events.ts`
- `src/sim/systems/lifecycle.ts`
- `src/sim/systems/betterPlace.ts`
- `src/sim/systems/market.ts`
- `src/sim/systems/feeding.ts`
- `src/config/tuning.ts`
- `src/config/constants.ts`
- `src/save/migrations.ts`
- `src/save/validate.ts`
- `src/save/normalize.ts`
- `src/debug/DebugOverlay.ts`
- `src/view/scenes/GameScene.ts`
- `eslint.config.js`
- `tests/sim/systems/abomination.test.ts` (new)
- `tests/sim/scenarios/abomination.test.ts` (new)
- `tests/save/fromVersion8.ts` (new)
- `tests/sim/selectors.test.ts`
- `tests/sim/state.test.ts`
- `tests/sim/systems/lifecycle.test.ts`
- `tests/sim/systems/market.test.ts`
- `tests/sim/systems/feeding.test.ts`
- `tests/sim/systems/betterPlace.test.ts`
- `tests/save/busy.ts`
- `tests/save/migrations.test.ts`
- `tests/save/saveFile.test.ts`
- `tests/save/validate.test.ts`
- `tests/save/normalize.test.ts`
- `tests/sim/scenarios/pacing.test.ts` (Town guard skipped, Rylan's decision)
- `_bmad-output/implementation-artifacts/deferred-work.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/4-1-the-abomination-is-born-and-stays-hidden.md`

## Change Log

- 2026-10-08: Story 4.1 implemented. The Abomination's identity, spawn rule and secrecy; `PublicSheep.gait`; the real `Sacrificed.wasAbomination`; save schema 9 (migration, validation, normalize); DEV Reveal/Make Abomination and an `abom` readout. Town pacing guard skipped by Rylan's decision until the 4.3/4.7 pacing re-check.
- 2026-10-08: Code review (Blind Hunter, Edge Case Hunter, Acceptance Auditor): 1 decision, 7 patches applied, 1 deferred, 7 dismissed. **AC 7 relaxed by Rylan:** validation accepts any `guaranteedAtBirth` ≥ 1 (not only the live window), and `normalizeTuned` moves only a pending guaranteed birth into the window, above `birthsSeen`. Readiness is now cleared by `stageOf`, so a crafted ready Abomination shows no heart. Old-save decode fixtures strip the v9 fields. `debugSheepDrawnAt` returns a position copy. Architecture N2 is updated. Gates: 648 passed, 1 skipped; typecheck and lint clean; browser probe passes 3 of 3 runs.
