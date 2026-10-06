---
baseline_commit: 41e37d1c581f18c3bddf466a61b854c1848d9278
---

# Story 2.1: Life Stages and the GDD Starting Flock

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a player,
I want my sheep to grow from lambs to adults to elders and eventually die of old age,
so that every sheep has a lifespan I must plan around.

## Acceptance Criteria

1. **Stage is derived, never stored (FR7).** Given a sheep record with `bornAt`, when the view or sim needs its stage, then `stageOf` derives it from age (`state.time - bornAt`): Lamb 0–60 s, Adult 60–300 s, Elder 300–420 s. The thresholds come from `TUNING`, and no stage field is ever added to `Sheep` or `GameState`.
2. **Old-age death (FR7, AR17).** Given an elder whose age reaches 420 s (`TUNING.oldAgeMs`), when the sim steps, then it dies through `killSheep(state, id, 'oldAge')`. This happens on the first tick where `age >= oldAgeMs`, not a tick earlier or later. `stats.died` increments, `SheepDied { cause: 'oldAge' }` is emitted, and if it was the last sheep, `Lost` follows.
3. **Stage visuals (UX-DR58, GDD Art).** Given sheep on the field, when they render, then lambs use a smaller sprite, adults the normal sprite and elders a greyer sprite. Each stage has its own Fed / Hungry / Starving frames (UX-DR57). A sheep that ages while its hunger stays the same switches frame on the frame where its stage changes. The hover tooltip shows the stage ("Lamb · Fed", "Elder · Hungry").
4. **GDD starting flock (FR6).** Given `createNewGame(seed)`, when a new game starts, then the flock is 2 adults aged 60 s (`bornAt = -startAdultAgeMs`) plus 1 newborn lamb (`bornAt = 0`), all at Fullness 60. The Farm bar is empty (`farmProgress = 0`) and there is no breeding food (the field does not exist yet: Story 2.2 adds it at 0). This replaces the Epic 1 interim flock of 3 adults.
5. **Save schema (AC conditional).** The `GameState` shape does **not** change in this story, so `SAVE_SCHEMA_VERSION` stays `2` and no migration is added. Existing v2 saves (including interim 3-adult flocks) load and age normally.
6. **Founders' lifespan scenario.** Given a seeded test that keeps the flock fed, when `runFor` reaches ~6 min, then both founding adults became elders at 240 s game time (~4 min) and died of old age at 360 s (~6 min). The lamb is still alive and an adult at that point, and becomes an elder at 300 s.
7. **No system runs after a loss within a tick** (deferred item from 1.8, "Systems after the loss tick"). `step()` stops running the remaining systems once `state.lostAt` is set mid-tick.
8. `npm test`, `npm run typecheck` and `npm run lint` all pass.

## Tasks / Subtasks

- [x] **Task 1: Tuning values (AC: 1, 2, 4)**
  - [x] 1.1 In `src/config/tuning.ts`, add `oldAgeMs: 420_000` beside `lambUntilMs`/`elderFromMs`, with a comment citing FR7 / GDD Life Stages ("Elder 300–420 s. Dies of old age at 420 s").
  - [x] 1.2 Replace `interimFlockAdults: 3` with `startFlockAdults: 2` and `startFlockLambs: 1`. Use the comment "GDD Starting flock: 2 adults aged 60 s and 1 newborn lamb" (FR6). Keep `startAdultAgeMs` and `startFullness`. Remove every reference to `interimFlockAdults`, including the comment in `state.ts`.
- [x] **Task 2: GDD starting flock in `createNewGame` (AC: 4, 5)**
  - [x] 2.1 In `src/sim/state.ts`, create the `startFlockAdults` adults first (`bornAt: -TUNING.startAdultAgeMs`), then the `startFlockLambs` lambs (`bornAt: 0`, which is `state.time` at a new game). Place every sheep with the same rng placement as today.
    - **Keep the order adults → lamb.** Existing tests read `state.sheep[0]` as an adult.
    - The rng calls per sheep are unchanged, so seeded positions stay identical to the interim flock's first three sheep.
  - [x] 2.2 Do **not** add `breedingFood` or any other field. Story 2.2 adds `breedingFood` together with its validation rule and the schema bump/migration.
- [x] **Task 3: Lifecycle system (AC: 2, 7)**
  - [x] 3.1 Create `src/sim/systems/lifecycle.ts` exporting `updateLifecycle(state)`. This is the architecture's "Life stages" home: ageing, old-age death, and later gestation/birth (2.3) and the Abomination victim's `doomedAt` (4.3). Write a header comment in the style of `hunger.ts`/`carcass.ts`.
  - [x] 3.2 Logic: capture `const sheep = state.sheep` before the loop (killSheep *replaces* the array; see the `carcass.ts` header). For each sheep, if `state.time - s.bornAt >= TUNING.oldAgeMs`, call `killSheep(state, s.id, 'oldAge')`.
    - Compare age directly against `oldAgeMs`. Do not call `stageOf`, and do not store or decrement anything: `bornAt` is the absolute deadline source.
    - No allocation per tick: a plain `for` loop with no closures.
    - Leave a one-line hook comment for Story 4.1: "the Abomination never dies of old age (skip `isAbomination`)". Do not add the field.
  - [x] 3.3 Register it in `src/sim/step.ts` `SYSTEMS` after `updateHunger`: `[updateMovement, updateFeeding, updateHunger, updateLifecycle]`, matching the declared order movement → feeding → hunger → lifecycle → …
  - [x] 3.4 Resolve the deferred "Systems after the loss tick" item. In `step()`'s loop, stop once `state.lostAt !== undefined`, for example `for (...) { SYSTEMS[i](state); if (state.lostAt !== undefined) return; }`. Update the deferred entry in `deferred-work.md` with "**Resolved in Story 2.1:** …".
- [x] **Task 4: Stage-aware sprites (AC: 3)**
  - [x] 4.1 Placeholder art in `assets/art/sheep/`: add `lamb-idle.png`, `lamb-hungry.png`, `lamb-starving.png`, `elder-idle.png`, `elder-hungry.png` and `elder-starving.png`.
    - **Elder:** keep the adult's 32×26 canvas and pose, recoloured greyer. Mute the wool toward `wool-shade` #EADBBE / `disabled` #C9BCA6, and the face/legs toward `bark-soft` #6B5444. A grey cast must not read as infection green or as the carcass look.
    - **Lamb:** a smaller canvas (about 22×18) with a proportionally bigger head and shorter legs, so it reads as small at the same 2× display scale. Use the same anchor convention (centred origin) and palette as the adult.
    - **Hungry/starving variants** mirror the adult ones (droop; thin/pinched).
    - Draw them the way Stories 1.2/1.5 did: a throwaway pure-Node PNG encoder script in the scratchpad, composed from the existing adult PNGs. **Commit only the PNGs, never the script.**
  - [x] 4.2 Run `npm run assets` and commit the regenerated `public/assets/atlases/sheep-world.{png,json}`. The build validates kebab-case frame names and duplicates.
  - [x] 4.3 In `src/view/assetKeys.ts`, add `FRAME.lambIdle/lambHungry/lambStarving/elderIdle/elderHungry/elderStarving` (kebab values matching the file names).
  - [x] 4.4 In `src/view/field/SheepSprite.ts`, replace `HUNGER_FRAME` with a frozen `Record<Stage, Record<Hunger, string>>` (`SHEEP_FRAME[stage][hunger]`).
    - Cache `shownStage` beside `shownHunger`, and re-set the frame when **either** changes. This is the deferred 1.5 item "Stage-aware sheep frames"; mark it resolved in `deferred-work.md`.
    - Reset `shownStage = null` in `reset()`.
    - Keep `SHEEP_SCALE = 2` for every stage: the lamb is smaller because its art is smaller.
    - Update the header comment, which currently says "One set for every stage until Story 2.1".
  - [x] 4.5 Hit-testing and the tooltip need no change: `sheepIndexAt` uses `displayWidth/Height` (a lamb gets a smaller hit box; it stays ≥ 40 px with the 6 px pad, UX-DR90). `SheepHover` already re-renders when `pub.stage` changes and uses `STRINGS.sheepTooltip` ("Lamb"/"Adult"/"Elder" already exist in `strings.ts`). Verify only.
  - [x] 4.6 In `assets/CREDITS.md`, extend the placeholder art row with the six new files.
- [x] **Task 5: Tests (AC: 1, 2, 4, 6, 7, 8)**
  - [x] 5.1 New file `tests/sim/systems/lifecycle.test.ts`:
    - Boundary: an elder whose age will be `oldAgeMs - TICK_MS` after the next step is alive after that step, and dies on the following one (age exactly `oldAgeMs`).
    - The death goes through killSheep: the sheep is gone, `stats.died` is +1, and the events contain `SheepDied { cause: 'oldAge', id, x, y }`.
    - Adults and lambs are untouched.
    - Two elders dying on the same tick both die (the captured-array loop).
    - If the last sheep dies of old age, `Lost` follows `SheepDied` and `lostAt === time`.
    - Use `TUNING` values and `runFor`; keep sheep fed by setting `fullness` so hunger cannot interfere.
  - [x] 5.2 New scenario `tests/sim/scenarios/lifespan.test.ts` (AC 6):
    - `newGame(<literal seed>)`. Keep the flock fed by setting every sheep's `fullness = TUNING.fullnessMax` before each `step`. Add a local helper beside `runRecordingDeaths` in style; do not use `vi` timers.
    - Assert the founders are `adult` just before `elderFromMs - startAdultAgeMs` (240 s) and `elder` at that time, and that both die with cause `oldAge` at exactly `oldAgeMs - startAdultAgeMs` (360 s).
    - Assert the lamb is alive after the founders die, and that its stage is `lamb` before 60 s, `adult` after it, and `elder` at 300 s.
    - Assert no `Lost` occurs while the lamb lives.
    - Assert the state JSON round-trips.
  - [x] 5.3 Step-after-loss test (`tests/sim/step.test.ts`): when a system sets `lostAt` mid-tick, no later system runs. For example, starve the last sheep in hunger and assert no event follows `Lost` in that tick. Or add an elder that would die of old age in the same tick and assert it is not killed again: it is already gone, so assert `stats.died` and the event list.
  - [x] 5.4 Update the existing tests that encode the interim flock:
    - `tests/sim/state.test.ts`: the "interim Epic 1 flock" test becomes the GDD flock. 3 sheep: the first `startFlockAdults` have `bornAt = -startAdultAgeMs`, the last has `bornAt = 0`, all have `startFullness`, and `peakFlock = startFlockAdults + startFlockLambs`. The field-list test is unchanged.
    - `tests/sim/selectors.test.ts`: "reads the founding adults as adults at time 0" becomes 2 adults + 1 lamb; the `every stage === 'adult'` assertion in the selectPublicSheep test must account for the lamb; `peakFlock: TUNING.interimFlockAdults` becomes the start flock size.
    - `tests/sim/scenarios/starvation.test.ts`: replace the `interimFlockAdults` references with the start flock size. All 3 still start at Fullness 60, so they still starve on one tick.
    - `tests/sim/systems/carcass.test.ts`: `peakFlock`.
    - Grep `tests/` for `interimFlockAdults` until none are left.
  - [x] 5.5 Run `npm test`, `npm run typecheck` and `npm run lint`. Save tests (`tests/save/*`) must stay green unchanged: no schema bump.
- [x] **Task 6: Browser check (AC: 3, 4)**
  - [x] 6.1 `npm run dev`, then New Game:
    - 2 normal adults and 1 visibly smaller lamb wander. Hovering the lamb shows "Lamb · Hungry" (Fullness 60 is Hungry).
    - Debug overlay (backtick) ×16, keeping them fed: the lamb swaps to the adult frame at ~60 s, the founders turn grey at ~4 min and vanish at ~6 min with no console errors. There is no carcass yet (Story 2.4 turns `carcassesEnabled` on).
    - The tooltip updates the stage live.
  - [x] 6.2 Continue an existing v2 save made before this change: it loads, and its adults age and eventually die of old age.

## Dev Notes

### Current state of the code (read before editing)

- **`src/sim/selectors.ts`**: `stageOf(s, state)` **already exists** with `TUNING.lambUntilMs`/`elderFromMs`, and `PublicSheep.stage` and `selectPublicSheep` already carry the stage. AC 1 is mostly in place. Do not reimplement it; just update the "Story 2.1 adds the stage rules" comment. `stageOf` has no upper bound: a sheep past `oldAgeMs` is still `'elder'` until lifecycle kills it that tick. That is fine.
- **`src/sim/state.ts`**: `createNewGame` loops `TUNING.interimFlockAdults` with `bornAt: -TUNING.startAdultAgeMs`. `createSheep(state, { x, y, bornAt })` is the single creation path and also raises `stats.peakFlock`. Keep using it; do **not** switch to the architecture sketch's `createSheep({ stage })` signature in this story.
- **`src/sim/systems/carcass.ts`**: `killSheep` is the only death path. It *replaces* `state.sheep` (filter), increments `stats.died`, gates the carcass on `TUNING.carcassesEnabled` (still `false`; Story 2.4 flips it), emits `SheepDied`, then calls `checkLastSheepAndLoss`. `DeathCause` already includes `'oldAge'`.
- **`src/sim/systems/hunger.ts`** is the pattern to copy for `lifecycle.ts`: captured array, plain loop, `killSheep` inside.
- **`src/sim/step.ts`**: `SYSTEMS` array plus a documented order comment. A lost game returns before the time advance. Mid-tick loss is not yet guarded (Task 3.4).
- **`src/view/field/SheepSprite.ts`**: frame chosen by hunger only (`HUNGER_FRAME`, `shownHunger` cache), and there are no lamb/elder frames. Facing via `flipX` (the art faces right). Interpolation code must stay untouched.
- **`src/view/field/TitleFlock.ts`** (decorative, title screen) uses `FRAME.adultIdle`. Leave it as is.
- **`src/debug/DebugOverlay.ts` `addSheep`** spawns adults (`bornAt: s.time - startAdultAgeMs`). Leave it as is. It still compiles because `startAdultAgeMs` stays.
- **Save (`src/save/validate.ts`)** already validates `bornAt` (finite, not after `time`). A lamb with `bornAt = 0` at `time = 0` passes. There are no validator changes.

### What must be preserved

- Determinism: same seed → identical state. Positions of the 3 starting sheep stay the same as today's interim flock (same rng call sequence).
- Starvation timing: all 3 start sheep share Fullness 60 and starve on one tick at 72 s if unfed (`starvation.test.ts` relies on this).
- `state.sheep[0]` is an adult in a new game (several selector and command tests use it).
- No allocation in `step()`/systems/`SheepSprite.sync` hot paths.
- All 1.x save tests are unchanged and green; `SAVE_SCHEMA_VERSION` is unchanged.

### Architecture compliance

- New game rule → `src/sim/systems/lifecycle.ts`, `update<System>(state)`, registered in `step.ts` order (project-context Code Organization). Systems never call each other; `killSheep` is the allowed shared helper.
- Timers are absolute: old age is derived from `bornAt` and needs no new deadline field (architecture Game Time / State Patterns: "stage (from `bornAt`)" derived, never stored).
- Sim purity: no `Math.random`/`Date.now`/Phaser in `src/sim/` (lint-enforced).
- The view reads `PublicSheep` only; sprites hold no game data (N3). Stage reaches the sprite via `pub.stage`.
- Copy already lives in `strings.ts`; colours in art only (no hex in view code).
- The Abomination (Epic 4) must later skip ageing and old age (N2: "Never ages past lamb; never dies of old age; can starve"). `publicSheep` will force `'lamb'` for it. That is not built here, but don't design lifecycle in a way that blocks it.

### Library / framework notes

- Phaser `~4.2.1`: `Sprite.setFrame(name)` swaps atlas frames; a frame of a different size changes `displayWidth/Height` at the same scale, which is what makes the lamb smaller and gives it a smaller hit box. Do **not** use `setTint` to grey elders: tint is reserved for infection (Story 2.5, `setTint` + `setTintMode`), and an infected elder needs both.
- No new dependencies. TypeScript `~6.0.3`, Vitest `~4.1.11`.

### File list (expected)

| File | Change |
|---|---|
| `src/config/tuning.ts` | `oldAgeMs`, `startFlockAdults`, `startFlockLambs`; remove `interimFlockAdults` |
| `src/sim/state.ts` | GDD starting flock |
| `src/sim/systems/lifecycle.ts` | **new** |
| `src/sim/step.ts` | register lifecycle; stop after mid-tick loss |
| `src/sim/selectors.ts` | comment only |
| `src/view/assetKeys.ts` | 6 frame keys |
| `src/view/field/SheepSprite.ts` | stage × hunger frames |
| `assets/art/sheep/{lamb,elder}-{idle,hungry,starving}.png` | **new** placeholders |
| `public/assets/atlases/sheep-world.{png,json}` | regenerated |
| `assets/CREDITS.md` | placeholder row |
| `tests/sim/systems/lifecycle.test.ts`, `tests/sim/scenarios/lifespan.test.ts` | **new** |
| `tests/sim/{state,selectors,step}.test.ts`, `tests/sim/scenarios/starvation.test.ts`, `tests/sim/systems/carcass.test.ts` | updated |
| `_bmad-output/implementation-artifacts/deferred-work.md` | mark 2 items resolved |

### Testing standards

- Vitest, `tests/<same path as src>/`, scenarios in `tests/sim/scenarios/`. Use `newGame(seed)` / `runFor` from `tests/sim/helpers.ts`, literal seeds and `TUNING` values in assertions, never re-typed literals (240 s = `TUNING.elderFromMs - TUNING.startAdultAgeMs`, 360 s = `TUNING.oldAgeMs - TUNING.startAdultAgeMs`). No fake timers, no Phaser in tests. Assert on state and emitted `SimEvent`s.
- `runFor` requires multiples of `TICK_MS`.

### Previous story intelligence (Epic 1)

- Placeholder art: throwaway scratchpad Node PNG encoder (Stories 1.2, 1.5), with only the PNGs committed; `npm run assets` regenerates the committed atlases.
- Reviews repeatedly caught: frames cached on one key only (the reason for AC 3's "ages while hunger is steady"), iterating `state.sheep` while killing, and float/tick off-by-ones. Test the exact boundary tick.
- Story 1.10 verified UI in a real browser with a scratchpad Playwright probe (system Chrome, DEV server, temporary probe hook). Optional here, but the frame swap at a stage change is worth one probe or a manual check at ×16.
- Commit style: `Implement story 2.1: …`, then `Apply story 2.1 code review fixes`.

### Out of scope (later stories)

- Carcass on old-age death and the "died of old age" toast: Story 2.4 (`carcassesEnabled = true`, toast copy UX-DR92).
- `breedingFood` state, the Farm Breeding Food button and its meter: Story 2.2.
- Breeding, pregnancies, `LambBorn`, cooldown: Story 2.3. Selling elders for $5: Story 3.1. Names: Story 5.3.

### Project Context Rules (from `_bmad-output/project-context.md`)

- Phaser 4, not 3. No `setTintFill`. Verify APIs in `node_modules/phaser/skills/` before using them from memory.
- Never put game logic in sprites, scenes, tweens or Phaser timers. Rules live in `src/sim/` only.
- Never store derived values (stage, hunger, era, flock count) in `GameState`.
- Adding `GameState` fields requires a `SAVE_SCHEMA_VERSION` bump and a migration. That does not apply here, since no fields are added.
- Hard-coded GDD numbers are forbidden; read `TUNING`.
- Every non-sacrifice death goes through `killSheep`. Never splice `state.sheep` elsewhere.
- Performance: no allocation in `step()`, systems, `update()` or `EntityLayer.sync`. Pooled sprites only, never `new`/`destroy()` during play.
- Done = `npm test`, `npm run typecheck` and `npm run lint` all pass; visuals verified manually in the browser.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.1: Life Stages and the GDD Starting Flock]
- [Source: _bmad-output/planning-artifacts/epics.md#Requirements Inventory: FR6, FR7, UX-DR43, UX-DR57, UX-DR58, AR17]
- [Source: _bmad-output/planning-artifacts/gdds/gdd-sheep-civilization-2026-10-05/gdd.md: Starting flock (line ~125), Life Stages table (~136–142), Art (~388, ~431)]
- [Source: _bmad-output/game-architecture.md: State Management, Game Time, N1 Single Death Pipeline, N2 (Abomination ageing rules), Entity/State Patterns, System Location Mapping ("Life stages → src/sim/systems/lifecycle.ts")]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-sheep-civilization-2026-10-05/EXPERIENCE.md: State Patterns (Elder: greyer sprite), Tooltip]
- [Source: _bmad-output/implementation-artifacts/deferred-work.md: "Stage-aware sheep frames (Story 2.1)", "Systems after the loss tick (Stories 2.1, 2.3)"]
- [Source: _bmad-output/project-context.md]

## Dev Agent Record

### Agent Model Used

Claude Opus 5.5 (1M context), `claude-opus-5-5[1m]`

### Implementation Plan

- **Sim:**
  - `TUNING.oldAgeMs` (420 s), plus `startFlockAdults`/`startFlockLambs` in place of `interimFlockAdults`.
  - `createNewGame` makes the adults first, then the lamb (`bornAt = state.time`, which is 0). The same rng calls per sheep keep seeded positions identical to the old interim flock.
  - New `systems/lifecycle.ts` (`updateLifecycle`): kills by `killSheep(…, 'oldAge')` when `time - bornAt >= oldAgeMs`, over the captured start-of-tick array. It is registered after hunger.
  - `step()` returns after any system that sets `lostAt`.
- **No `GameState` shape change:** `SAVE_SCHEMA_VERSION` stays 2 and there is no migration. `breedingFood` is left to Story 2.2.
- **View:** `SheepSprite` picks `SHEEP_FRAME[stage][hunger]` and caches both. Six new frames in `assetKeys`. The lamb is smaller through its 22×16 art at the same 2× scale, so its hit box shrinks with it (56×44 with the pad, still ≥ 40). Elders are grey in their art, not by tint.

### Debug Log References

- **Red phase:** the new `lifecycle.test.ts` and `lifespan.test.ts` failed before the system existed (4 failures).
  - One test bug was fixed along the way: `peakFlock` keeps the new-game peak after a test empties the flock, so the test now expects `state.stats.peakFlock`.
- **AC 6 wording:** the spec says the lamb is "still alive and an adult" when the founders die at 360 s. But the lamb is born at 0 and turns elder at 300 s (`elderFromMs`), before 360 s.
  - The code follows FR7; the scenario asserts the real order instead: lamb adult at 60 s, founders elder at 240 s, lamb elder at 300 s, founders die at 360 s, lamb dies at 420 s with `Lost`.
- **Placeholder art:** a throwaway scratchpad Python PNG codec (not committed).
  - Lamb: hand-drawn 22×16 pixel maps (idle; hungry with the head 3 rows lower; starving with a thin body and rib marks).
  - Elder: the adult frames recoloured with `wool` → `wool-shade`, `wool-shade` → `disabled`, `bark` ↔ `bark-soft`.
  - `npm run assets`: sheep-world 14 frames, 116×96.
- **Browser probe** (scratchpad `p2.mjs`/`p3.mjs`): `playwright-core`, system Chrome (SwiftShader), DEV server on port 5199, real mouse clicks, no code hooks. All checks passed:
  - **New Game:** 2 adults plus a visibly smaller lamb inside the pen, Farm bar 0/8.
  - **Ageing a real save:** after the 10 s autosave, the saved ages were edited (founder A 299 s, founder B 418 s, lamb 59 s; all full), the page reloaded and Continue clicked. Note this resumed a v2 save made by this build, not one from before the change.
    - About 0.75 s in: B grey (elder), the tooltip live ("Adult · Fed").
    - About 4 s later: B gone (old age); A grey; the lamb swapped to the adult frame and size.
  - No console errors.
  - Not observed: the lamb's own tooltip. The probe's hover landed where an adult stood in front of the lamb, so the screenshot shows an adult's tooltip. The stage text is driven by `pub.stage`, unchanged since 1.5.

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created
- AC 1: `stageOf` already derived the stage from `TUNING` thresholds; there is no stored stage, and the comment is updated.
- AC 2: `updateLifecycle` kills through `killSheep(state, id, 'oldAge')` on exactly the tick age reaches `oldAgeMs`. Unit tests cover the boundary tick, other stages untouched, two same-tick deaths in array order, and the last sheep → `Lost`.
- AC 3: lamb/elder × idle/hungry/starving frames. The sprite re-frames when stage or hunger changes. Verified in the browser.
- AC 4: GDD starting flock (2 adults aged 60 s plus a newborn lamb, all Fullness 60, bar 0/8, no breeding food field).
- AC 5: no shape change, so no schema bump; all save tests pass unchanged. The browser probe resumed a v2 save made by this build.
- AC 6: `tests/sim/scenarios/lifespan.test.ts` (with the timing correction noted above).
- AC 7: `step()` stops after a mid-tick loss. Test in `tests/sim/step.test.ts`.
  - It is a regression guard rather than a red test: with today's systems a loss always empties the flock, so lifecycle has nothing left to act on.
- AC 8: `npm test` passes all 264 tests, and `npm run typecheck` and `npm run lint` pass.
- Two items in `deferred-work.md` are marked resolved.

### File List

- `src/config/tuning.ts` (modified)
- `src/sim/state.ts` (modified)
- `src/sim/step.ts` (modified)
- `src/sim/selectors.ts` (modified, comment)
- `src/sim/systems/lifecycle.ts` (new)
- `src/view/assetKeys.ts` (modified)
- `src/view/field/SheepSprite.ts` (modified)
- `assets/art/sheep/lamb-idle.png`, `lamb-hungry.png`, `lamb-starving.png` (new)
- `assets/art/sheep/elder-idle.png`, `elder-hungry.png`, `elder-starving.png` (new)
- `public/assets/atlases/sheep-world.png`, `public/assets/atlases/sheep-world.json` (regenerated)
- `assets/CREDITS.md` (modified)
- `tests/sim/systems/lifecycle.test.ts` (new)
- `tests/sim/scenarios/lifespan.test.ts` (new)
- `tests/sim/state.test.ts`, `tests/sim/selectors.test.ts`, `tests/sim/step.test.ts` (modified)
- `tests/sim/scenarios/starvation.test.ts`, `tests/sim/systems/carcass.test.ts` (modified)
- `_bmad-output/implementation-artifacts/deferred-work.md` (modified)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modified)
- `_bmad-output/implementation-artifacts/2-1-life-stages-and-the-gdd-starting-flock.md` (new)

### Change Log

- 2026-10-06: Implemented Story 2.1. Life stages with old-age death (lifecycle system), the GDD starting flock, stage-aware lamb/elder sprites, and no systems after a mid-tick loss. Status → review.
