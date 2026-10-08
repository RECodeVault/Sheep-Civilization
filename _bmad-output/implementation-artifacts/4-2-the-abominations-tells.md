---
baseline_commit: e3ef9aa
---

# Story 4.2: The Abomination's Tells

Status: done

<!-- Created 2026-10-08 by create-story. Second story of Epic 4 (Should tier). It adds the Abomination's two designed tells: the off-step walk (view, from PublicSheep.gait, which 4.1 already exposes) and the wider 36 px avoidance (sim, movement.ts). No state fields are added, so there is no save schema bump. Key finding: sheep have NO walk animation today (static pose frames only; Story 1.3 deferred walk frames to 5.8), so this story must add a normal walk cycle for every stage before an off-step one can read as "wrong". -->

## Story

As a player,
I want the Abomination to walk slightly wrong and other sheep to keep their distance,
so that a careful watcher can identify it.

## Acceptance Criteria

1. **Every sheep walks (prerequisite for FR32).** Today a sheep slides around on one static pose frame. A sheep that is moving on the field now plays a two-beat walk cycle: its current pose frame (`{stage}-{idle|hungry|starving}`), then a new **step** frame for the same stage and hunger pose (legs apart), and so on. A sheep that is standing still (grazing, eating, resting, or nudged by less than the walk threshold) shows its pose frame. A dragged sheep shows the dangling frame as today. The walk cycle never hides the hunger pose. Both beats show the pose's head and body, and only the legs change. So Hungry and Starving stay readable while walking (UX-DR57/UX-DR58, "gameplay animation is never reduced", UX-DR84).
2. **The Abomination walks off-step (FR32, AR18).** A sheep whose `PublicSheep.gait` is `'offstep'` uses the **same lamb frames** as any lamb (GDD Art: "The Abomination uses the lamb sprite. Only its animation… gives it away"). Its rhythm is uneven: the two beats alternate long and short instead of even, and on the short beat the sprite dips a little (a limp or hitch). A normal lamb walking beside it at the same speed has an even rhythm and no dip. The difference is visible at the 960×540 minimum window. The view reads the tell **only** from `PublicSheep.gait`. No view code reads `isAbomination`, `Sheep` or `state.abomination` (AR16, UX-DR64).
3. **The gait is never reduced.** The off-step walk and the normal walk cycle play whatever the reduced-motion setting (UX-DR84: they are gameplay information, like the infection wobble). The setting arrives in Story 5.7. Its code must not touch the gait, so say so in a comment beside the gait constants.
4. **Other sheep keep 36 px from it (FR32).** In `movement.ts` separation, a sheep pushes away from the living Abomination over a radius of `TUNING.abominationSpacePx` (36) instead of `TUNING.personalSpacePx` (24), with the same linear falloff and `separationWeight`. The Abomination itself feels the **normal** 24 px from other sheep (asymmetric: the flock gives it room; it does not shy away). Both values are in `TUNING` with GDD citations. Resting sheep settle about 36 px from it and about 24 px from each other.
5. **No change without an Abomination.** With no Abomination alive (or the Abomination dragged, which pushes nobody, as today), `updateMovement` takes the same steps, in the same order, with the same rng draws, as before this story. Every existing seeded movement, feeding, pile and pacing result stays the same. A dragged Abomination still pushes nobody.
6. **The settle test (epic AC).** A seeded test with a flock that is settled, fed and resting/wandering, holding one Abomination and one normal lamb of the same age, samples over time the distance from each to its nearest neighbour. The Abomination's mean nearest-neighbour distance exceeds the normal lamb's. The test holds across several fixed seeds, and its assertion reads `TUNING`, not literals.
7. **Feeding still works next to it.** A hungry sheep whose food piece (or carcass) is next to the Abomination still reaches and eats it. A seeker held off by the 36 px push stops about `abominationSpacePx × (1 − 1 / separationWeight)` = 12 px from the Abomination, which equals `eatReachPx`. The dev must check this edge (Dev Notes → "The 12 px edge"). A scenario shows that a seeker eats a piece the Abomination stands on within the same bound the existing "resting sheep on a piece" case already accepts (deferred-work: it clears when the blocker stops resting).
8. **Performance (NFR1, project rules).** No allocation in `updateMovement` or in `SheepSprite.sync`. Neighbour queries still go through `sim/grid.ts` with a radius ≤ `gridCellPx` (`abominationSpacePx` ≤ 48: a tuning test asserts it). `npm run bench` stays well under 2 ms per tick at 100 sheep with an Abomination in the flock. With 100 sheep walking, the browser frame stays within budget at ×1 (DEV overlay FPS).
9. **Done = `npm test`, `npm run typecheck` and `npm run lint` all pass**, `npm run assets` has regenerated the committed atlas, and the walk and off-step have been checked by eye in the browser (Task 6).

## Tasks / Subtasks

- [x] **Task 1: Tuning (AC 4, 8)**
  - [x] 1.1 `src/config/tuning.ts`: add `abominationSpacePx: 36` in the Abomination block beside `personalSpacePx`. Cite GDD "The Abomination (Should tier)" → Moment-to-moment tells: "other sheep keep 36 px from it instead of the normal 24 px personal space (tune)". Update the `personalSpacePx` comment ("Story 4.2 adds the 36 px value") to the present tense.
  - [x] 1.2 `tests/config/tuning.test.ts`: `abominationSpacePx > personalSpacePx` (the tell needs the gap) and `abominationSpacePx <= gridCellPx` (the 3×3 grid scan's limit, `grid.ts` `queryNeighbours` invariant).

- [x] **Task 2: Wider separation in the sim (AC 4, 5, 7, 8)**
  - [x] 2.1 `src/sim/systems/movement.ts`: at the top of `updateMovement`, find the living Abomination's **index** in `state.sheep` with one plain loop (−1 if none, or if it is `dragged`, since a dragged sheep pushes nobody). Keep it in a local; never store it in state (it is derived). Do **not** call `abominationAlive` and then search again. A single loop that returns the index is enough. If `abomination.ts` should own it, export `abominationIndex(state): number` from there (rare-event helper pattern from 4.1) and use it here.
  - [x] 2.2 In the separation block, for each sheep `i`:
    - **If `i` is the Abomination:** query and push exactly as today (24 px). It feels the normal space (AC 4, asymmetric).
    - **Otherwise:** query at 24 px as today, but **skip** the Abomination's index inside the loop. Then, if an Abomination index exists, add its push once by a direct distance check with `space = TUNING.abominationSpacePx` (same falloff `w = 1 − d / abomSpace`, same coincident-point split by id). The Abomination is only one sheep, so this is one extra distance check per sheep per tick. It needs no wider grid query and allocates nothing.
    - With no Abomination (index −1), the code path, arithmetic order and rng draws are **identical** to today (AC 5). Do not reorder the existing accumulation. Floating-point order matters for the seeded tests.
  - [x] 2.3 Update the header comment and the "Separation:" comment: 24 px between ordinary sheep; 36 px around the Abomination for everyone else (FR32); the Abomination itself feels 24.
  - [x] 2.4 Secrecy: `movement.ts` is in `src/sim/`, so reading `isAbomination` is allowed. Emit no event and change no `PublicSheep` field for this. The wider spacing must be **visible only as spacing**.
  - [x] 2.5 Do not touch `feeding.ts`, `carcass.ts`, `eatReachPx` or `separationWeight` unless the 12 px check (Task 4.4) fails. If it fails, stop and report to Rylan before retuning (Open Question 2).

- [x] **Task 3: Walk-cycle art (AC 1, 2)**
  - [x] 3.1 Placeholder art in `assets/art/sheep/`: one **step** frame for every existing pose, 9 new PNGs: `lamb-walk.png`, `lamb-hungry-walk.png`, `lamb-starving-walk.png`, `adult-walk.png`, `adult-hungry-walk.png`, `adult-starving-walk.png`, `elder-walk.png`, `elder-hungry-walk.png`, `elder-starving-walk.png`. Each is the matching pose PNG at the **same size** (lamb 22×26; adult and elder 32×26) with only the leg pixels moved to a "legs apart" stride. Head, body, wool, outline and hunger pose stay unchanged. Then the sprite does not jump, depth sorting (feet line) holds, and the hunger read survives both beats.
    - Make them with a throwaway scratchpad script that reads each pose PNG and rewrites the leg rows (the established pattern from Stories 1.2–3.5: a scratchpad PNG codec, commit only the PNGs). Do not add the script or a dependency to the repo. Do not import `sharp`/`jimp` from the repo.
    - **No `lamb-offstep` frames.** The off-step is a rhythm on the same lamb frames (AC 2; GDD Art line "uses the lamb sprite"). This differs from the architecture's example frame name `lamb-offstep-1`, which was only an illustration of the naming. Note it in the Debug Log.
  - [x] 3.2 `npm run assets`. It validates kebab names and duplicates, and regenerates `public/assets/atlases/sheep-world.{png,json}`. Commit both.
  - [x] 3.3 `src/view/assetKeys.ts`: add the 9 `FRAME` keys (e.g. `lambWalk`, `lambHungryWalk`, `lambStarvingWalk`, …), grouped with a "Story 4.2: walk-cycle step frames" comment.
  - [x] 3.4 `assets/CREDITS.md`: extend the placeholder-art row (description and file list) with the step frames.

- [x] **Task 4: The gait in the view (AC 1, 2, 3, 8)**
  - [x] 4.1 New pure module `src/view/field/gait.ts` (no Phaser import, like `layout.ts`). It holds the gait constants and two allocation-free functions:
    - `GAIT` constants (frozen): `stepPx` (stride distance per beat, e.g. 10 px, so about 6 beats/s at 60 px/s), `walkMinPxPerTick` (below this a tick's drawn movement counts as standing, e.g. 1 px; a full walk step is 6 px/tick), `offstepLong` / `offstepShort` (beat-length multipliers for the off-step, e.g. 1.6 / 0.4, mean 1 so it covers ground at the same speed), `offstepDipPx` (e.g. 2 world px on the short beat). Mark these `[ASSUMPTION, tuned in the browser]`. Add the GDD readability fallback: "if playtests find the tell too subtle, exaggerate the off-step first" (GDD Risks #2). Add the reduced-motion note (AC 3).
    - `isStepBeat(gait: Gait, phasePx: number): boolean`: whether the step frame shows at this stride phase. Normal: even beats of `stepPx`. Off-step: a cycle of `stepPx × (offstepLong + offstepShort)`, with the pose beat long and the step beat short (or the reverse, whichever reads better in the browser).
    - `gaitDipPx(gait: Gait, phasePx: number): number`: 0 for normal; `offstepDipPx` during the off-step's short beat, else 0. (A small eased dip instead of a square one is fine if it reads better; keep it allocation-free.)
    - Import `Gait` from `src/sim/selectors.ts` (the view may import types from selectors; it is how `Stage`/`Hunger` reach `SheepSprite`).
  - [x] 4.2 `tests/view/field/gait.test.ts` (precedent: `tests/view/field/layout.test.ts`, pure view helpers with no Phaser):
    - normal: over a long run of phases the step beat is shown about half the time, and beats are of equal length;
    - off-step: the beat lengths alternate long and short (measure the run lengths), the mean beat length equals `stepPx`, and the dip is non-zero only on the short beat;
    - `gaitDipPx('normal', p) === 0` for all sampled p;
    - assertions read `GAIT`, not literals.
  - [x] 4.3 `src/view/field/SheepSprite.ts`:
    - Add a `STEP_FRAME: Record<Stage, Record<Hunger, string>>` beside `SHEEP_FRAME`, frozen the same way.
    - Keep a stride phase (`stridePx`) on the sprite. Each new tick (the `simTime !== this.lastTick` branch, where `prevX/currX` are rolled), measure the tick's movement `hypot(currX − prevX, currY − prevY)`. If it is ≥ `GAIT.walkMinPxPerTick`, the sheep is **walking** for that tick. Between ticks, advance the phase by the drawn distance this frame (or by the tick distance × the alpha delta), so the stride follows on-screen speed, not frame rate. While not walking, show the pose frame. Keep the phase, or reset it to 0; whichever looks less twitchy.
    - Frame choice: `lifted` → `DRAGGED_FRAME` (unchanged); else walking and `isStepBeat(pub.gait, stridePx)` → `STEP_FRAME`; else `SHEEP_FRAME`. Extend the existing change-cache (`shownStage`/`shownHunger`/`shownLifted`) with a `shownStep` boolean, so `setFrame` runs **only on a change** (no per-frame `setFrame`).
    - The dip: draw the sprite at `y + gaitDipPx(...)`, but keep **depth** (`const depth = lifted ? … : y`) and the overlay anchors (hearts, infection marker, ping) on the un-dipped `y`. Then the dip never reorders sheep or makes the markers jitter. Only while walking and not held.
    - Facing (`FACING_DEADBAND_PX`), the infection wobble (angle), `shake()` (angle) and the hold/snap logic are unchanged. The gait touches only the frame and a y offset. `reset()` clears the phase and `shownStep`, so a pooled sprite never comes back mid-stride.
    - Comment: the gait is read only from `pub.gait` (UX-DR64; never `isAbomination`); it is never reduced (AC 3).
  - [x] 4.4 Hit testing (`hitTest.ts`) reads `spr.y`. The dip moves that by at most `offstepDipPx` (2 px), well inside the 6 px pad, so no change is needed. Write that in the Debug Log, and do not move the hit box.
  - [x] 4.5 Leave `TitleFlock.ts` (title-screen sheep, tweened) as it is. Static title sheep are fine, and giving them the walk is polish for 5.8. Log it in deferred-work (Task 7).

- [x] **Task 5: Sim tests (AC 4–7)**
  - [x] 5.1 `tests/sim/systems/movement.test.ts`:
    - **36 vs 24 settle:** two resting adults (`restUntil: FAR_FUTURE`) placed 1 px apart settle to ≥ 0.9 × `personalSpacePx` and stay < `abominationSpacePx` (as today). The same pair with one flagged `isAbomination` settles to ≥ 0.9 × `abominationSpacePx`. Both read `TUNING`.
    - **Asymmetric:** a resting Abomination and a resting normal sheep 30 px apart (between 24 and 36): after one tick the normal sheep has moved away and the Abomination has not moved (it feels 24 px only).
    - **Dragged Abomination pushes nobody:** set its activity to `dragged`, put a resting sheep 30 px away: it does not move.
    - **No Abomination = unchanged:** **before** editing `movement.ts`, record on the baseline (`e3ef9aa`) the exact `x`, `y` and `heading` of every sheep, plus `state.rng`, after a short seeded run (e.g. `newGame(11)` + `fillFlock(state, 30)`, 200 ticks). Assert those recorded values (`toEqual`, exact) after the change. This guards AC 5's "identical path" claim, the same way 4.1 pinned the founders in `state.test.ts`. Comparing against a second run of the new code would pass trivially, so don't do that. The existing walk-speed cap test also still holds with an Abomination in the flock: add one to its flock or add a sibling case.
  - [x] 5.2 `tests/sim/scenarios/abominationTells.test.ts` (new): the epic's settle test (AC 6). For several fixed seeds (e.g. 3–5): build a flock of about 12–20 adults in the start pen (or Land I), add one lamb flagged Abomination and one normal lamb, both `bornAt: state.time`. Keep everyone fed (top up `fullness` between `runFor` chunks, as in the 4.1 lifecycle test) so nobody seeks food. Let it settle for a few seconds. Then sample every ~500 ms for about 60 s the nearest-neighbour distance from each lamb to the rest of the flock. Expect `mean(abom) > mean(lamb)` for every seed. Also check that both lambs stayed lambs and alive (the run is under `lambUntilMs`; extend `bornAt` back if needed so the normal lamb does not grow up mid-test, or use `stageOf`). If the margin is thin, pack the pen tighter (more sheep); never loosen to `>=`.
  - [x] 5.3 **The 12 px edge (AC 7):** in `tests/sim/scenarios/feeding.test.ts` (or the new file): the Abomination rests on a food piece (`restUntil` some seconds ahead, fed so it does not claim the piece); one hungry adult seeks that piece. Assert that the seeker eats it, emitting the eat event or the piece is gone, its fullness rose, within the Abomination's rest end + a walk margin. This is the same bound the existing deferred-work note accepts for two resting sheep. If it **never** eats while the Abomination rests, that is the 12 px tie. Report it rather than silently changing `eatReachPx` (Open Question 2).
  - [x] 5.4 Run the full suite. Expected fallout: `tests/save/busy.ts` already flags an Abomination **before** its 1 s `runFor`, so the busy fixture's positions shift and `isBusy` may fail (deferred-work: "the busy save fixture depends on its seed"). Fix it the way 4.1 did (reseed to the next seed that satisfies every busy condition, with a comment) or, better, flag the Abomination after the `runFor`, if that still meets the fixture's intent. Record which in the Debug Log. Never loosen an assertion.
  - [x] 5.5 Pacing probe (`npx vitest run tests/sim/scenarios/pacing.test.ts --reporter=verbose`): the spacing change touches only sheep near the Abomination, so the times should barely move. Record the before/after table in the Debug Log. The Town guard stays skipped (Rylan's 4.1 decision, deferred to the 4.3/4.7 re-check). Do not un-skip or retune.
  - [x] 5.6 `npm run bench`: add (or note) a case with one Abomination among the 100 sheep, and record mean/p99 in the Debug Log (budget 2 ms; 4.1 measured ≤ 0.21 ms mean, ≤ 0.72 ms p99).

- [x] **Task 6: Browser check (AC 1–3, 8, 9)**
  - [x] 6.1 **(Rylan's eye check passed, 2026-10-08: "looks good".)** `npm run dev`. Use the DEV overlay's **Make Abomination** (Story 4.1) and **Reveal Abomination** to find it, then turn Reveal **off** and confirm the tell reads on its own:
    - every sheep (lamb, adult, elder; fed, hungry, starving) walks with a two-beat cycle and stands still on its pose frame when grazing or eating;
    - the Abomination limps (uneven beats, dip on the short beat) next to a normal lamb with an even step;
    - resting sheep visibly leave a wider gap around it;
    - the hunger poses still read mid-walk; an infected walking sheep still wobbles and shows its marker; hearts, markers and the ping do not jitter with the dip;
    - drag and drop, the hover tooltip ("Lamb · …") and Market "Too young" behave as before;
    - at a 960×540 window the off-step is still noticeable.
  - [x] 6.2 FPS: 100 sheep (DEV tools), ×1, about a minute, with no drop versus before (project rule: verify movement/rendering stories with the overlay at 100 sheep). Record it.
  - [x] 6.3 `npm run build`, then grep `dist/` for `isAbomination`: it should appear only in the bundled sim/save code, as in 4.1, and never in view-only paths. `gait` and `offstep` are allowed (they are the designed tell).
  - [x] 6.4 Record the GAIT values you settled on in the Debug Log, with a short note on how they read (e.g. "1.6/0.4 with a 2 px dip reads at 960×540; 1.3/0.7 was too subtle").

- [x] **Task 7: Docs and housekeeping**
  - [x] 7.1 `deferred-work.md`: add a "Deferred from: story 4-2-the-abominations-tells" section. It should include: title-screen sheep don't walk-animate (5.8); eat/munch frames and a fuller multi-frame walk are still 5.8 polish; the off-step parameters await the external playtest (5.10, GDD success metric "at least 1 tester identifies the Abomination"); a note for **4.3** that the Abomination approaching a victim is held only at the normal 24 px (it feels 24, not 36), so "contact" must be defined at or beyond the separation equilibrium (about 8 px at 24 px space: `24 × (1 − 1/1.5)`), or the stalk must reach it.
  - [x] 7.2 `_bmad-output/game-architecture.md` N2 "Tells": state that the off-step is a rhythm on the shared lamb frames (no `lamb-offstep` frames), and that the 36 px avoidance is asymmetric (others avoid it; it feels 24). Update the asset-naming example only if it would mislead.
  - [x] 7.3 Story file, `sprint-status.yaml` and `deferred-work.md` go in the same commit as the code (repo pattern).

### Review Findings

- [x] [Review][Decision] The 36 px radius can hold a seeker exactly at `eatReachPx` (12 = 36 × (1 − 1/1.5)); a fence-pinned Abomination can stall a seeker. Resolved by Rylan (2026-10-08): option 1, which becomes the patch below.
- [x] [Review][Patch] Raise `eatReachPx` 12 → 14 so it clears the 12 px hold-off around the Abomination; add the tuning invariant test and a fence-pinned feeding test; re-record (never loosen) any seeded results that move [src/config/tuning.ts:85]
- [x] [Review][Patch] The paired settle test's comment overstates it: the two runs are not identical with the tell off (summation order), and one of the 5 seeds passes anyway. Fix the comment, and assert no natural Abomination appears in the unflagged run [tests/sim/scenarios/abominationTells.test.ts:31]
- [x] [Review][Patch] Task 6.1 is ticked, but the "checked by eye at 960×540" gate (AC 2, AC 9) is Rylan's, and still open. Untick it and mark it pending [_bmad-output/implementation-artifacts/4-2-the-abominations-tells.md:Task 6.1]
- [x] [Review][Patch] FPS "no drop versus before" (Task 6.2, AC 8) has no baseline. Measure the same probe on `e3ef9aa` [Debug Log]
- [x] [Review][Patch] The no-change pin rounds to 1e-9 before hashing, so it isn't exact as Task 5.1 asks. Hash the full-precision values (re-recorded on `e3ef9aa`) [tests/sim/systems/movement.test.ts:pathHash]
- [x] [Review][Patch] The AC 7 test doesn't check that the seeker's fullness rose (Task 5.3) and sets an odd `seeker.restUntil = 1e9` [tests/sim/scenarios/abominationTells.test.ts:68]
- [x] [Review][Patch] The reduced-motion note is in the file header, not beside `GAIT` (AC 3) [src/view/field/gait.ts:12]
- [x] [Review][Patch] The tuning comment and test give the grid's 3×3 scan as the reason for `abominationSpacePx ≤ gridCellPx`, but the 36 px push is a direct check that never queries the grid. Give the real reason [src/config/tuning.ts:121, tests/config/tuning.test.ts]
- [x] [Review][Patch] The gait test "same mean beat length" only checks constants (tautological). Measure it from `isStepBeat` beats [tests/view/field/gait.test.ts]

## Dev Notes

### What this story is (and is not)

- **Is:** a normal two-beat walk cycle for every sheep (the baseline the tell needs), the off-step rhythm for `gait: 'offstep'`, and the 36 px avoidance in the sim. Tests for the spacing and the gait helper.
- **Is not:** stalking, `stalk`, `doomedAt`, `nextKillAt`, `stalking` activity or the kill (4.3); the reveal flash, screech, "Good riddance." (4.4); eating/munching frames, title-screen walk, or other juice (5.8); the reduced-motion setting (5.7). No new `GameState` fields → **no `SAVE_SCHEMA_VERSION` bump**, no migration.
- **Why a normal walk cycle is in scope:** today sheep glide on a static pose frame (Story 1.3 Task 6.6 deferred walk frames to 5.8). An "off-step walk" cannot read as off if no sheep has a step. The GDD asset list (Art, "Sheep sprite set") already plans "idle, walk, eat, thin and drag variants, plus … an off-step walk variant". This story brings forward the minimum of that list: one step frame per pose.

### Current code to build on (read these first)

| File | Today | This story |
|---|---|---|
| `src/sim/systems/movement.ts` | two-pass steering; separation via `queryNeighbours(sheep, i, 24, neighbours)`, linear falloff `w = 1 − d/space`, coincident split by id, skip `dragged` neighbours; velocity capped at walk speed; crowd-turn for walkers | add the Abomination index and its 36 px push for everyone else; identical path when none |
| `src/sim/grid.ts` | 48 px cells, `queryNeighbours` 3×3 scan, `invariant(radius <= CELL)` | no change (the direct check needs no wider query) |
| `src/sim/selectors.ts` | `PublicSheep.gait` (`'offstep'` for the Abomination, set in `publicSheep` and `selectPublicSheep`), `type Gait` exported | no change: the view starts using it |
| `src/sim/systems/abomination.ts` | `abominationAlive`, `onBirth` | optionally add `abominationIndex` (Task 2.1) |
| `src/config/tuning.ts` | `personalSpacePx: 24` ("Story 4.2 adds the 36 px value"), Abomination block | add `abominationSpacePx: 36` |
| `src/view/field/SheepSprite.ts` | frame from `SHEEP_FRAME[stage][hunger]` or `DRAGGED_FRAME[stage]`, cached by `shownStage/shownHunger/shownLifted`; interpolates `prevX→currX` per frame; depth = y; overlays anchored on the drawn y; wobble/shake own `angle` | add `STEP_FRAME`, stride phase, `shownStep`, the dip offset (sprite only) |
| `src/view/assetKeys.ts` | `FRAME` keys for idle/hungry/starving/dragged × 3 stages | add 9 step-frame keys |
| `assets/art/sheep/*.png` | 12 frames: lamb 22×26, adult/elder 32×26, shown at 2× | add 9 step frames, same sizes |
| `tests/save/busy.ts` | flags an Abomination, then `runFor(1_000)` | may need a reseed or reorder (Task 5.4) |

### What must be preserved

- **Secrecy (UX-DR64, AR16/AR18).** The view distinguishes the Abomination **only** by `gait`. Tooltip, ping, threat summary, toast, Market "Too young", breed markers, frame art: all identical to a lamb. `SheepSprite` must never import `Sheep` or read `isAbomination`. ESLint already blocks `isAbomination` in `src/view`, and review catches `state.abomination`.
- **Hunger and infection readability.** Hunger poses must show on both beats, and the infection tint (MULTIPLY), marker and wobble continue while walking. The walk must not override `setTint` or `angle`.
- **Frame caching.** `setFrame` only when the chosen frame changes (project rule: no per-frame churn). Step changes are about 6 per second per walking sheep. That is fine, because it is a change.
- **Sim determinism and seeded tests (AC 5).** With no Abomination, `updateMovement` is bit-identical. The spec reason: dozens of seeded tests (pile, pacing, feeding, wander100, busy save) depend on exact float paths.
- **No allocation in hot paths.** One integer index per tick, plus one distance check per sheep. The view uses scalar fields only; `gait.ts` returns primitives.
- **Pooling.** `SheepSprite.reset()` must clear the stride state (a reused sprite never starts mid-step or dipped).
- **Interpolation/hold logic.** Don't measure "walking" from the held position or the snap after a drop. A drop is a jump, not a walk (the same reason the facing ignores `snapNext`).

### The 12 px edge (read before Task 5.3)

- Separation balance for a seeker walking at `walk` toward a point next to a sheep: the push `(1 − d/space) × separationWeight × walk` equals `walk` at `d = space × (1 − 1/separationWeight)`. For 24 px that is 8 px, and `eatReachPx` (12) was chosen to sit above it (tuning.ts comment). For **36 px it is exactly 12 px** = `eatReachPx`, and feeding checks `d² > reach²`, so a seeker approaching asymptotically from outside may hover just above 12 px and not eat until the Abomination moves. The seek speed also slows near the target (`min(walk, d/DT)`), which pushes the balance point further out.
- The Abomination does not rest for ever: a wandering sheep's rest lasts at most `wanderRestMaxMs` (4 s), and eating lasts `eatMs`. So the block clears on its own, the same as the existing "two resting sheep on a piece hold a seeker off" case (deferred-work, Story 3.6 observed it as fine). Task 5.3 proves it.
- If you find a permanent hold (e.g. the Abomination is fed, idle and grazing in a loop over the piece), **don't** retune silently. Options for Rylan: (a) `eatReachPx` 12 → 14; (b) a seeker ignores the Abomination's extra radius while seeking (keeps 24 for seekers; a softer tell); (c) accept. Default: (c) if 5.3 passes within the bound.

### Architecture compliance

- **ADR-3 / Movement & Flock Spacing:** custom steering in the sim; the architecture explicitly lists "separation (24 px; 36 px from the Abomination)". The spacing lives in `movement.ts`, not in the view.
- **N2 Tells:** "exposed through `publicSheep`: `gait: 'offstep'`. Wider separation (36 px) is applied inside the sim, so other sheep visibly avoid it." This story implements exactly that. Asymmetry (others avoid; it feels 24) is this story's reading of the GDD's "other sheep keep 36 px from it". Record it in N2 (Task 7.2).
- **Layering:** `gait.ts` is view code (`src/view/field/`), pure TS with no Phaser, so it is testable (precedent `layout.ts` + `tests/view/field/layout.test.ts`). It is not a sim rule: rhythm and dip are presentation and never affect state.
- **TUNING vs view constants:** the 36 px is a game rule, so it goes in `TUNING`. Stride length, beat ratios and dip are view feel, so they go in `GAIT` in `gait.ts` (as other view juice constants live beside their sprite, e.g. `WOBBLE`, `MARKER_BOB`).
- **Systems never call each other:** `movement.ts` reads `isAbomination` from state directly (or calls a helper owned by `abomination.ts`, the accepted shared-helper exception).

### Library / framework notes (no new dependencies)

- Phaser 4.2.1. The only API used is `Sprite.setFrame`, `setPosition` and `setDepth`, all already used in `SheepSprite`. No animation manager (`anims.create`) is needed: the frame is chosen per change from the stride phase, which keeps the gait tied to the sim's movement (not wall-clock) and to `gait`. If you prefer `anims`, check `node_modules/phaser/skills/` first (v4 API, never v3 from memory), and note that a time-based anim would not follow movement speed or stop when the sheep stops.
- `npm run assets` uses free-tex-packer-core (devDep). It validates names. Don't add packages.

### Testing standards

- Vitest; `tests/<same path as src>/…`; scenarios in `tests/sim/scenarios/`; pure view helpers in `tests/view/field/` (precedent). Build with `newGame(seed)` and `createSheep`, then advance with `runFor(state, ms)` in `TICK_MS` multiples. Assert on state and events; no spies, fake timers or `Math.random`.
- Tests may read and set `isAbomination` (the lint secrecy groups cover `src/**` only).
- `gameWith(...)` and `centre(...)` in `movement.test.ts` are the local helpers for hand-placed flocks. `FAR_FUTURE` keeps sheep resting.
- Use `TUNING.personalSpacePx`, `TUNING.abominationSpacePx`, `TUNING.eatReachPx` and `GAIT.*` in assertions; never re-typed literals.

### Previous story intelligence (4.1)

- 4.1 gave `PublicSheep.gait` and the secrecy test ("outputs differ only in `gait`"). Do not change the gait field's shape. The secrecy test must stay green.
- 4.1's DEV tools: **Make Abomination** (spawns a lamb flagged, without touching `birthsSeen`) and **Reveal Abomination** (alert ring on the drawn sprite, repositioned on `POST_RENDER`, via `GameScene.debugSheepDrawnAt`). With the dip, the ring follows the dipped sprite. That is fine (DEV only).
- 4.1 reseeded `busyGame` (31337 → 31339) after an rng shift and logged the fixture's seed fragility as deferred. This story will likely shift it again through movement (Task 5.4).
- 4.1's pacing probe: Town guard `it.skip` by Rylan's decision until the 4.3/4.7 re-check. Leave it skipped.
- 4.1 review lessons: stale comments after behaviour changes (update the `personalSpacePx` comment, the movement header, SheepSprite's header about frames); DEV objects leaking across restarts (no new DEV objects here); tests that can pass trivially (the "no Abomination = unchanged" test must compare positions, not just "no crash").
- Epic 2/3 lesson: per-sprite state must be cleared in `reset()` for pooling.

### Git intelligence

- Pattern: one "Implement story X" commit with code, story file, `deferred-work.md` and `sprint-status.yaml`; then a separate "Apply story X code review fixes" commit when review finds patches. Regenerated atlases (`public/assets/atlases/sheep-world.{png,json}`) are committed alongside the source PNGs.
- Branch: `story/4-2-the-abominations-tells` (already created from `main` at `e3ef9aa`).

### Open questions (defaults chosen; confirm or change)

1. **Walk cycle scope.** Default: add a minimal two-beat walk (one step frame per stage × hunger pose, 9 placeholder frames) to every sheep, so the off-step has a baseline. Alternative: animate only lambs (3 frames); adults and elders keep gliding. That is cheaper, but then the walk is a lamb-only signal and less natural. A third option is a code-only bob with no new art: cheapest, but it is not a "walk cycle".
2. **The 12 px tie.** Default: accept, if Task 5.3 shows the seeker eats once the Abomination stops resting. If not, ask Rylan to choose between `eatReachPx` 14 and "seekers use 24 px around it".
3. **Asymmetric avoidance.** Default: others avoid it at 36 px, and it feels only 24 px from them (GDD wording: "other sheep keep 36 px from it"; also helps 4.3's approach). Alternative: symmetric 36 px for both. It looks similar at rest, but the Abomination would also look shy.
4. **Off-step look.** Default: uneven beats (long/short) plus a small dip on the short beat. Final values are tuned by eye in Task 6 and checked again at the 5.10 external playtest.

### Project Structure Notes

- New: `src/view/field/gait.ts`, `tests/view/field/gait.test.ts`, `tests/sim/scenarios/abominationTells.test.ts`, 9 PNGs in `assets/art/sheep/`.
- Modified: `src/config/tuning.ts`, `src/sim/systems/movement.ts` (and optionally `abomination.ts`), `src/view/field/SheepSprite.ts`, `src/view/assetKeys.ts`, `public/assets/atlases/sheep-world.{png,json}` (regenerated), `assets/CREDITS.md`, `tests/config/tuning.test.ts`, `tests/sim/systems/movement.test.ts`, `tests/sim/scenarios/feeding.test.ts` (or the new scenario), possibly `tests/save/busy.ts` and `tests/perf/tick.bench.ts`, `_bmad-output/game-architecture.md` (N2), `_bmad-output/implementation-artifacts/deferred-work.md`.
- No conflict with the architecture tree. The variance from the architecture (no `lamb-offstep-*` frames) is recorded in N2.

### Project Context Rules (from `_bmad-output/project-context.md`)

- **The Abomination is secret.** View code uses `PublicSheep` only; `isAbomination` is read only in `src/sim/`, `src/debug/`, `src/save/`. The off-step walk and the flock's avoidance are its only tells (UX-DR64).
- **Phaser 4, not 3:** verify any API beyond what `SheepSprite` already uses in `node_modules/phaser/skills/`.
- **No game logic in sprites/tweens/timers:** the spacing is a sim rule in `movement.ts`; the gait is presentation only and never writes state.
- **No allocation in hot paths** (`step()`, systems, `update()`, `EntityLayer.sync` → `SheepSprite.sync`). Neighbour queries go through `sim/grid.ts`; never all-sheep × all-sheep (one direct check against a single Abomination is O(n), not O(n²)).
- **Rendering:** all sheep frames come from the `sheep-world` atlas; no `Graphics` redrawn per frame; no per-sprite filters or blend modes.
- **New tunable number → `config/tuning.ts`**, with a GDD citation; tests read `TUNING`.
- **Gameplay animation is never reduced** (reduced motion, UX-DR84): the off-step and the infection wobble are information.
- **Placeholder art:** throwaway scratchpad encoder; commit only PNGs and the regenerated atlas; credit in `assets/CREDITS.md`.
- **Verify movement/rendering stories** with the debug overlay at ×1, 100 sheep, before closing.
- **Done = `npm test`, `npm run typecheck`, `npm run lint` all green**; rendering checked manually in the browser.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 4.2: The Abomination's Tells]
- [Source: _bmad-output/planning-artifacts/epics.md#Requirements Inventory] FR32; AR16, AR18; UX-DR57, UX-DR58, UX-DR64, UX-DR84
- [Source: _bmad-output/planning-artifacts/gdds/gdd-sheep-civilization-2026-10-05/gdd.md#The Abomination (Should tier)] Moment-to-moment tells; Readability fallback
- [Source: gdd.md#Art] "The Abomination uses the lamb sprite. Only its animation (off-step) and the other sheep's spacing behavior give it away."; Sheep sprite set (walk + off-step variants)
- [Source: gdd.md#Risks] #2 tells too subtle → exaggerate the off-step first; Success Metrics: Abomination readability
- [Source: _bmad-output/game-architecture.md#N2 — Abomination: Hidden Identity, Delayed Kill, Reveal] Tells
- [Source: _bmad-output/game-architecture.md] Decision 3 (custom steering, 24/36 px), Movement & Flock Spacing, asset naming
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-sheep-civilization-2026-10-05/EXPERIENCE.md] HUD & Diegetic UI ("The Abomination never surfaces in any layer"), Game Feel (reduced motion never reduces the off-step), Key Flows step 7
- [Source: _bmad-output/implementation-artifacts/1-3-sheep-wander-the-pasture.md] Task 6.6 (no walk-cycle art; deferred to 5.8)
- [Source: _bmad-output/implementation-artifacts/4-1-the-abomination-is-born-and-stays-hidden.md] gait field, secrecy test, DEV Make/Reveal, busy fixture reseed, pacing guard skip
- [Source: _bmad-output/implementation-artifacts/deferred-work.md] resting-sheep-on-a-piece hold-off; busy fixture seed fragility
- [Source: _bmad-output/project-context.md#Critical Don't-Miss Rules]

## Dev Agent Record

### Agent Model Used

Claude Opus 5.5 (claude-opus-5-5[1m])

### Implementation Plan

- Sim: `abomination.ts` gains `abominationIndex` (`abominationAlive` now uses it). `movement.ts` finds the index once per tick (−1 if none or if dragged). Every other sheep skips it in the 24 px grid loop and then takes its push by one direct distance check over `abominationSpacePx`. The Abomination's own separation is the unchanged 24 px path. With −1 the arithmetic and draw order are the old ones.
- View: a pure `gait.ts` (`GAIT`, `isStepBeat`, `gaitDipPx`) sets the rhythm from the stride travelled. `SheepSprite` measures walking per tick, advances the stride by the drawn distance, and swaps between the pose and step frames on a change only. The dip is drawn by lowering the **origin**, so `x/y` (hit tests, the tooltip, drag pickup, depth, overlays, the DEV ring) never move with it. Otherwise the Abomination's tooltip would have limped too.
- Art: 9 step frames made by a scratchpad script that splays the two leg columns under the body (back leg back, front leg forward, by `⌈row/2⌉` px down the leg); head, body and hunger pose untouched.

### Debug Log References

- **Baseline pin (5.1, AC 5):** before editing `movement.ts`, on `e3ef9aa`: `newGame(11)` + 30 sheep, 20 s → path hash `e1a5bfcd`, rng 298150454; `newGame(2026)` → `e066c951`, rng 3073683637 (positions and headings rounded to 1e-9, FNV-1a). Asserted exactly after the change; it passes, so with no Abomination the steering path is unchanged. Every existing seeded test passed untouched.
- **Busy fixture (5.4):** no reseed needed. `busyGame(31339)` still meets every busy condition with the Abomination taking part in its 1 s run.
- **Settle test (5.2, AC 6):** the spec's first design (an Abomination and a different normal lamb in one run) also passed with the tell switched off (`abominationSpacePx` 24.0001), because it mostly measured where each lamb stood. I replaced it with a **paired** test: the same seed and the same lamb, run once flagged and once not. A probe over 10 seeds × 20/30 sheep gave flagged − plain = +1.1 to +6.6 px (mean nearest-neighbour), 20/20 positive. With the tell off (`abominationSpacePx` 24) 4 of the 5 test seeds fail; the fifth differs only by float accumulation order. Nothing was loosened.
- **The 12 px edge (5.3, AC 7, Open Question 2):** no tie. In the AC 7 setup, the seeker ate at 1.0 s next to a resting Abomination and at 0.7 s next to a normal sheep. As the seeker closes in, its 24 px push nudges the Abomination (which feels only 24 px) about 8 px off the piece. Default (accept) holds; `eatReachPx` is unchanged.
- **Pacing (5.5), seed 3606, before (4.1) → after:** 2 cps Village 4:20 → 4:20; 3 cps 3:51 → 3:51; 5 cps 3:37 → 3:37; 6 cps Village 3:32 → 3:32, Town 15:00 → 14:34. The Town guard stays skipped (Rylan's 4.1 decision).
- **Bench (5.6):** new case "300 food + Abomination · steady": mean 0.052 ms, p99 0.137 ms. Every case's mean ≤ 0.21 ms (budget 2 ms). The known one-off 13.5 ms first-tick GC sample appeared again (deferred).
- **Architecture variance (3.1):** no `lamb-offstep-*` frames. The off-step is a rhythm on the shared lamb frames (GDD Art: "uses the lamb sprite"). N2 and the asset-naming example are updated.
- **Hit test (4.4):** unchanged. The dip moves only the drawn image (origin), not `spr.y`, so hit boxes, the tooltip and drag pickup do not move at all.
- **Browser (Task 6):** a scratchpad Playwright probe on the DEV server (`main.ts` exposed the game temporarily; restored, no diff), at 1280×720 and 960×540, all passed. Results:
  - Over 10 s at 60 fps, the Abomination walks with a pose beat of about 15 px and a step beat of about 3 px (the step frame shows 20% of the time). The dip shows on its step beat only, and never while it stands.
  - A normal lamb walks with even 9 px beats (49–50% step) and never dips. The Abomination uses only `lamb-idle` / `lamb-walk`.
  - The `adult/lamb-{hungry,starving}-walk` frames show while hungry sheep walk.
  - In a resting flock, the Abomination's nearest neighbour is about 36–37 px away; ordinary sheep's minimum is 24 px.
  - 104 sheep at ×1 ran at 56 FPS (headless SwiftShader). There were no page errors.
  - Screenshots show the splayed legs mid-walk. **Not checked by a person:** whether the limp *reads* to a human eye at 960×540. That is for Rylan's own look and the 5.10 playtest (deferred-work).
- **Build (6.3):** `npm run build`. `isAbomination` appears only in the bundled sim/save code (stageOf, selectors, createSheep, validate, migrations, betterPlace, abominationIndex). There is no "Reveal Abomination". `offstep` and `lamb-walk` ship (the designed tell).
- **Code review fixes (2026-10-08):**
  - **`eatReachPx` 12 → 14 (Rylan's decision).** A probe reproduced the tie: with the Abomination pinned in a fence corner on a piece, a seeker coming in diagonally hovered at 12.009 px and never ate at reach 12, and ate on tick 9 at reach 14. Added the corner-pinned test (red at 12, green at 14) and the tuning invariant (reach > hold-off for 24 and 36 px). No seeded test moved. Pacing, seed 3606, before → after: 2 cps Village 4:20 → 5:13; 3 cps 3:51 → 4:03; 5 cps 3:37 → 3:41; 6 cps Village 3:32 → 3:30, Town 14:34 → 14:57. The Village guard at REFERENCE_CPS still passes; the Town guard stays skipped (4.1 decision). Note that 2 cps is now just past the GDD's 3–5 min Village window, but it is not a guard rate.
  - **Exact no-change pin:** the path hash now uses each number's full round-trip string. Re-recorded on `e3ef9aa` in a temporary worktree: seed 11 → `15e0eb22`, seed 2026 → `4e7e4452`, with the same rng values. The new code matches exactly.
  - **FPS baseline (6.2):** the same probe (103 sheep, ×1, 20 one-second samples, headless SwiftShader, run alternately). `e3ef9aa` gave a mean of 38.6 / 34.9 fps; the new code gave 39.1 / 35.7. No drop. Both are lower than the earlier 56 because two dev servers shared the machine.
  - The settle test's comment now says what it really proves, and it asserts that no other Abomination appears. The AC 7 test checks fullness, and the seeker's odd `restUntil` is gone. The reduced-motion note sits on `GAIT`. The tuning comment gives the real reason for the grid-cell bound. The gait mean-beat test now measures beats from `isStepBeat`.
- **GAIT values (6.4):** `stepPx` 10, `walkMinPxPerTick` 1, `offstepLong`/`offstepShort` 1.6/0.4, `offstepDipPx` 2 (one art pixel), kept as the story's defaults. The probe confirms the rhythm; the human readability call is open.

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created
- Implemented both tells. The sim's asymmetric 36 px avoidance (`TUNING.abominationSpacePx`) leaves the steering path unchanged when no Abomination is alive. The view gets a two-beat walk cycle for every sheep (9 step frames) and the Abomination's off-step (uneven beats plus a one-art-pixel dip), read only from `PublicSheep.gait`.
- Tests added: tuning (gap, grid fit); movement (24 vs 36 settle, asymmetric push, a dragged Abomination pushes nobody, coincident split, the walk-speed cap with an Abomination, baseline path pins for 2 seeds); `scenarios/abominationTells.test.ts` (paired settle test over 5 seeds, lamb-age guard, eating a piece the resting Abomination stands on); `tests/view/field/gait.test.ts` (even/uneven beats, mean beat length, the dip on the short beat only, frozen); a bench case.
- Rylan's defaults kept for all four open questions. Open Question 2 needed no action (no 12 px tie).

### File List

- `src/config/tuning.ts`
- `src/sim/systems/abomination.ts`
- `src/sim/systems/movement.ts`
- `src/view/field/gait.ts` (new)
- `src/view/field/SheepSprite.ts`
- `src/view/assetKeys.ts`
- `assets/art/sheep/{lamb,adult,elder}{,-hungry,-starving}-walk.png` (9 new)
- `assets/CREDITS.md`
- `public/assets/atlases/sheep-world.png` (regenerated)
- `public/assets/atlases/sheep-world.json` (regenerated)
- `tests/config/tuning.test.ts`
- `tests/sim/systems/movement.test.ts`
- `tests/sim/scenarios/abominationTells.test.ts` (new)
- `tests/view/field/gait.test.ts` (new)
- `tests/perf/tick.bench.ts`
- `_bmad-output/game-architecture.md`
- `_bmad-output/implementation-artifacts/deferred-work.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/4-2-the-abominations-tells.md`

## Change Log

- 2026-10-08: Rylan checked the walk and the off-step in the browser ("looks good"); Task 6.1 closed; story done.
- 2026-10-08: Code review (Blind Hunter, Edge Case Hunter, Acceptance Auditor): 1 decision, 8 patches, 5 dismissed. **Rylan's decision:** `eatReachPx` 12 → 14, so a seeker clears the 12 px hold-off of a fence-pinned Abomination. All 9 patches were applied: corner-pinned and invariant tests, an exact path pin, an FPS baseline, test and comment fixes. Task 6.1 (the human eye check of the limp) is reopened as Rylan's. Gates: 673 passed, 1 skipped; typecheck and lint clean.
- 2026-10-08: Story 4.2 implemented. Asymmetric 36 px avoidance around the Abomination (`abominationSpacePx`); a two-beat walk cycle for every sheep, with 9 step frames; the off-step rhythm and dip from `PublicSheep.gait` (`gait.ts`). No save change. Settle test made paired (the unpaired design could not tell the tell from noise). Gates: 671 passed, 1 skipped; typecheck and lint clean; browser probe passes at 1280×720 and 960×540.
