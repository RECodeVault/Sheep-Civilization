---
baseline_commit: c224c83
---

# Story 4.3: The Kill Cycle

Status: done

<!-- Created 2026-10-08 by create-story. Third story of Epic 4 (Should tier). It makes the Abomination dangerous: every 45–60 s it walks up to a random victim, lingers 1 s, walks away, and the victim dies 5–10 s later through killSheep(…, 'abomination'). Everything is sim-side (a new updateAbomination system, a 'stalking' activity, stalk/doomedAt/nextKillAt state, schema 9 → 10). The view needs no change for the toast: strings.ts already has "just… fell over." for cause 'abomination', and HudScene already toasts every SheepDied by cause. Key finding: with the 4.2 asymmetric spacing, the victim is pushed away by the Abomination's 36 px field, so a naive "walk until touching" chases the victim across the pen. "Contact" is therefore defined at abominationContactPx (30), inside the 36 px band and outside the Abomination's own 24 px. -->

## Story

As a player,
I want sheep to mysteriously die after the Abomination visits them,
so that the threat is real but only traceable by watching.

## Acceptance Criteria

1. **The cycle starts at `nextKillAt` (FR31, AR18).** `state.abomination.nextKillAt` is an absolute game-ms deadline. It is set whenever a sheep becomes the Abomination (at birth through `onBirth`, and through the DEV **Make Abomination**): `nextKillAt = time + rngInt(state, TUNING.abominationKillMinMs, TUNING.abominationKillMaxMs)` (45 000–60 000). When `time >= nextKillAt` and the living Abomination is free (`activity === 'wander'`, i.e. not seeking food, a carcass, eating or dragged), it picks a victim and starts its stalk: `activity = 'stalking'`, `stalk = { victimId, phase: 'approach', until: time + TUNING.abominationApproachMaxMs }`. While it is busy, the kill waits (the deadline stays due and the cycle starts on its first free tick). With no Abomination alive, nothing runs and no rng is drawn.
2. **The victim is random (FR31).** The candidates are every living sheep except the Abomination itself, a dragged sheep (it is in the air) and a sheep that is already doomed. One seeded draw (`rngInt(state, 0, count − 1)`) picks among them in `state.sheep` order. Over many seeded picks, every candidate is chosen and the Abomination never is.
3. **Approach, then contact (FR31).** During `'approach'`, `movement.ts` walks the Abomination straight at the victim's current position at walk speed, as a seeker walks to food. Contact is the first tick on which the centre distance is `<= TUNING.abominationContactPx` (30). Then `phase = 'linger'`, `until = time + TUNING.abominationLingerMs` (1 000), and it stands still (separation still nudges it, as a grazer). The 4.2 spacing stays as it is: the victim keeps being pushed away inside 36 px, and the contact radius sits inside that band, so the approach finishes without a chase (Dev Notes → "Why contact is 30 px").
4. **Linger, doom, leave, reschedule (FR31).** When the linger ends: if the victim is still alive, it gets `doomedAt = time + rngInt(state, TUNING.abominationDoomMinMs, TUNING.abominationDoomMaxMs)` (5 000–10 000). Then the Abomination turns its heading directly away from the victim (or keeps its heading if the victim is gone), `phase = 'leave'`, `until = time + TUNING.abominationLeaveMs`, and the next kill is scheduled: `nextKillAt = time + rngInt(KillMin, KillMax)`. During `'leave'` it walks along that heading at walk speed, with the same soft fence containment as a wanderer. When the leave ends, the stalk is removed (`delete stalk`) and `activity = 'wander'`.
5. **The delayed death (FR31, FR12, UX-DR92).** On the first tick with `time >= doomedAt`, the victim dies through `killSheep(state, id, 'abomination')`. That gives a carcass at its spot, `SheepDied { cause: 'abomination' }`, `CarcassSpawned` and the normal ping, and the HUD's existing toast: "A sheep just… fell over." (`STRINGS` `DEATH_TOAST.abomination`; it never states a cause). The doom stands whatever the Abomination does afterwards. It still lands if the Abomination is sacrificed, starves or is dragged. A doomed victim that dies of something else first (starvation, the virus, old age), or is sold or sacrificed first, dies or leaves only once, through that path.
6. **Victim lost before contact (FR31).** During `'approach'`, if the victim is gone (died, sold, sacrificed) or dragged, a new victim is picked on that tick by AC 2's rule, and `until` is reset. If there is no candidate, the Abomination idles: the stalk is removed, `activity = 'wander'`, and no rng is drawn. `nextKillAt` stays due, so the cycle restarts as soon as a candidate exists. A victim lost during `'linger'` or `'leave'` just gets no doom; the Abomination finishes the visit as normal.
7. **Interrupting the Abomination.** Picking the Abomination up (`pickUp`) removes its stalk. A drop always lands as `'wander'`, so the stalk can never come back half-done. A drag during `'approach'` or `'linger'` therefore saves the victim (no doom is set), and `nextKillAt` stays due. A drag during `'leave'` only cuts the walk short (the next kill was already scheduled). If the approach reaches `until` without contact (`abominationApproachMaxMs`, 20 s), the hunt is given up: no doom, the stalk is removed, `activity = 'wander'`, and the next kill is rescheduled as in AC 4.
8. **No tell beyond the visit (UX-DR64, AR18).** No new `SimEvent` is added, and nothing is emitted at the start of a stalk, at contact, in the linger, at the doom or in the leave. `PublicSheep` gains `activity`, which reports `'stalking'` as `'wander'`. It carries no `stalk` and no `doomedAt`, so a doomed victim looks the same as any other sheep. The view changes nothing for this story. The mandatory secrecy test is extended: a stalking Abomination (with a `stalk`) and a wandering normal lamb with otherwise equal fields give `publicSheep()` outputs that differ **only** in `gait`. A doomed sheep and an equal sheep that is not doomed give identical outputs.
9. **The secrecy lint covers the new fields** (decided here; deferred from 4.1). `SECRECY_SYNTAX` in `eslint.config.js` also blocks member reads of `stalk`, `doomedAt` and `nextKillAt`, plus the property keys `stalk` and `doomedAt`, outside `src/sim/`, `src/debug/` and `src/save/`. It also blocks the member read `.abomination` (the `state.abomination` bookkeeping), but **not** the property key `abomination`, because `DeathCause` keys use it in `strings.ts` and `HudScene`. The dev checks that the rule fires in `src/view/` and does not fire in the allowed folders.
10. **Saves (AR9, NFR7).** `SAVE_SCHEMA_VERSION` goes 9 → 10.
    - Migration 9 → 10 adds `abomination.nextKillAt`. With a living Abomination it is rolled as `time + rngInt(KillMin, KillMax)` from the save's own `rng` (deterministic; the advanced `rng` is written back). With none, it is `0`. Sheep need nothing: `stalk` and `doomedAt` are optional and absent.
    - Validation accepts the activity `'stalking'` only together with a `stalk`, and a `stalk` only on the Abomination with the activity `'stalking'`. `stalk` is an object: `victimId` is an integer ≥ 1 (it may name a sheep that is gone, like `targetId`), `phase` is one of the three, and `until` is an integer in (`time`, `time + bound`], where the bound is the phase's TUNING length. `doomedAt` is never on the Abomination, and is an integer in (`time`, `time + abominationDoomMaxMs`]. `nextKillAt` is an integer ≥ 0 and ≤ `time + abominationKillMaxMs`; a due one (≤ `time`) is allowed, because the cycle can be waiting for a busy Abomination.
    - `normalizeTuned` clamps `nextKillAt`, `doomedAt` and `stalk.until` down to their current bounds (the 3.6 retune-safe pattern).
    - The busy save round-trip includes a stalking Abomination, a doomed sheep and a set `nextKillAt`.
11. **Done = `npm test`, `npm run typecheck` and `npm run lint` all pass.** Every existing seeded result without an Abomination is unchanged (no new draws unless one is alive). The pacing probe and `npm run bench` are run and recorded (Task 7). The full cycle is checked in the browser with the DEV tools (Task 8).

## Tasks / Subtasks

- [x] **Task 1: Tuning (AC 1–7)**
  - [x] 1.1 `src/config/tuning.ts`, Abomination block: add, each with its GDD citation (GDD "The Abomination (Should tier)" → Kill cycle: "Every 45–60 s (random) it picks a random victim (any sheep except itself), walks up to it, pauses for 1 s next to it, then walks away. The victim dies 5–10 s later (random)"):
    - `abominationKillMinMs: 45_000`, `abominationKillMaxMs: 60_000` (the interval, timed from the start of each leave, and from the spawn for the first kill);
    - `abominationLingerMs: 1_000`;
    - `abominationDoomMinMs: 5_000`, `abominationDoomMaxMs: 10_000`;
    - `abominationContactPx: 30` [ASSUMPTION]. "Next to it" for 44–64 px wide drawn sprites. It must stay above `personalSpacePx` and below `abominationSpacePx` (comment why: Dev Notes);
    - `abominationLeaveMs: 2_000` [ASSUMPTION]. About 120 px of walking away;
    - `abominationApproachMaxMs: 20_000` [ASSUMPTION]. The safety valve for a chase that never closes.
  - [x] 1.2 `tests/config/tuning.test.ts`: `personalSpacePx < abominationContactPx < abominationSpacePx`; each min ≤ max; all the ms values are integers and multiples of `TICK_MS` (rngInt needs integer bounds; deadlines land on ticks).

- [x] **Task 2: State and types (AC 1, 4, 5, 8)**
  - [x] 2.1 `src/sim/state.ts`: add `'stalking'` to `SheepActivity`, and update its comment (abomination.ts owns `stalking`, Story 4.3).
  - [x] 2.2 `Sheep`: add `stalk?: Stalk` and `doomedAt?: number`. Both have SECRET doc comments like `isAbomination`: read only in sim, debug and save. `stalk` is on the Abomination only, and is present exactly while `activity === 'stalking'`. `doomedAt` is the game-ms of the victim's delayed death (FR31) and is omitted otherwise. Export `interface Stalk { victimId: number; phase: StalkPhase; until: number }` and `type StalkPhase = 'approach' | 'linger' | 'leave'`, with `until` documented per phase (approach: give-up deadline; linger: linger end; leave: leave end).
  - [x] 2.3 `AbominationState`: add `nextKillAt: number` (game-ms; meaningful only while an Abomination is alive; 0 at new game). Update the "Story 4.3 adds `nextKillAt`" comment. `createNewGame` sets `nextKillAt: 0`, and the founders' draw order is unchanged (no new draw at new game).
  - [x] 2.4 `createSheep` adds no new fields (optional fields are omitted, not `undefined`; project rule).

- [x] **Task 3: The kill cycle (`src/sim/systems/abomination.ts`) (AC 1–7)**
  - [x] 3.1 `makeAbomination(state, s)`: sets `s.isAbomination = true` and `state.abomination.nextKillAt = time + rngInt(KillMin, KillMax)`. `onBirth` calls it in both spawn branches, in place of the two `lamb.isAbomination = true` lines. The DEV **Make Abomination** button calls it too (Task 6). That keeps the one spawn path shared. The draw comes after the spawn roll, so no birth draws anything new unless it spawns the Abomination.
  - [x] 3.2 `export function updateAbomination(state)`, in this order:
    1. **Doomed deaths (AC 5).** Loop over the array captured at the start (`const sheep = state.sheep`). `killSheep` replaces `state.sheep`, so never re-read it mid-loop (carcass.ts header; the same pattern as `updateHunger`/`updateVirus`). For each `s.doomedAt !== undefined && state.time >= s.doomedAt`: `killSheep(state, s.id, 'abomination')`. After a loss, return (step() also stops, but don't touch the cycle on a lost game).
    2. **The cycle.** `const i = abominationIndex(state)` on the **new** array; return if −1. Then switch on its state:
       - `activity === 'stalking'` → advance the stalk (approach / linger / leave, AC 3, 4, 6, 7);
       - `activity === 'wander'` and `time >= nextKillAt` → `pickVictim`; with none, return (idle, no draw); else start the approach;
       - anything else (seeking, eating, dragged) → do nothing (the kill waits).
  - [x] 3.3 `pickVictim(state, abomIndex): number`, the victim's index or −1. First a counting pass over the candidates (not self, not `dragged`, `doomedAt === undefined`). If the count is 0, return −1 with **no draw**. Otherwise one `rngInt(0, count − 1)`, then a second pass to find that candidate. No allocation (no filtered array).
  - [x] 3.4 Contact test in the system (not in movement): `dx² + dy² <= contactPx²` against the victim's position after this tick's movement. The system runs after movement, so contact is tested on the moved positions. Linger and leave end on `time >= until`.
  - [x] 3.5 The leave heading is `atan2(s.y − v.y, s.x − v.x)`, wrapped to [0, 2π) as in movement's `wrapAngle`. Move `wrapAngle` to a shared spot or copy it with a comment; don't import movement internals. If the victim is gone, keep the current heading.
  - [x] 3.6 Header comment: describe the kill cycle and the delayed death, and drop "Story 4.3 adds…". Say that it reads its victim through `sheepIndex` (O(n), once per tick, one sheep), and that it emits no event (the visit is the only tell; UX-DR64).
  - [x] 3.7 `src/sim/step.ts`: register `updateAbomination` after `updateVirus` and before `updateEras`, per the intended order comment (`… lifecycle → virus → abomination → …`). Update the comment. Eras stays last.
  - [x] 3.8 `src/sim/systems/lifecycle.ts` header: "Story 4.3 adds the Abomination victim's delayed death (doomedAt)" is now wrong. The death lives in `abomination.ts` (architecture System Location Mapping: "spawn rule, kill cycle, delayed victim death"). Fix the comment, and note the variance from N2 step 3 ("the lifecycle check calls killSheep") in Task 9.
  - [x] 3.9 `src/sim/systems/carcass.ts` header already lists the Abomination (4.3) as a `killSheep` caller. Keep it, and check that the wording is still true.

- [x] **Task 4: Movement for `stalking` (AC 3, 4)**
  - [x] 4.1 `src/sim/systems/movement.ts`: add `case 'stalking'` to the switch (`assertNever` forces it). By `s.stalk.phase`:
    - `'approach'`: look up the victim with `sheepIndex(state, stalk.victimId)`. If it is missing or `dragged`, no walk this tick (the system re-picks after movement). Otherwise seek its position exactly like the seek case: `v = min(walk, d / DT)`, set the heading, `walking = false`. Factor the seek arithmetic into a small local helper used by both cases, if you can do it without changing the existing seek case's floating-point order (the 4.2 path pins must stay exact).
    - `'linger'`: stand (no walk); separation still applies.
    - `'leave'`: walk at `s.heading` with wander's soft containment mirror (the `margin` checks), without the random turn. `walking = true`, so the crowd-turn applies.
    - A `stalking` sheep without `stalk` (impossible by validation) is treated as standing. Guard it with `invariant` and don't crash.
  - [x] 4.2 No change to separation. The victim keeps fleeing the 36 px field and the Abomination keeps feeling 24 px. This is what makes the visit look natural: the victim steps away from it during the linger.
  - [x] 4.3 Header comment: add "the Abomination's stalk: approach (seek the victim), linger (stand), leave (walk away)".
  - [x] 4.4 Path pins: `tests/sim/systems/movement.test.ts`'s exact baseline hashes (no Abomination) must still pass **untouched**. If they move, the change has altered the ordinary path. Fix the code, never the pin.

- [x] **Task 5: Feeding, carcasses, drag and secrecy (AC 6–9)**
  - [x] 5.1 Feeding and carcass eating need **no code change**. `mayEatFood`, `mayEatBreedingFood` and carcass pass 2's `free` all list only specific activities, and `'stalking'` is not one of them. So a stalking Abomination is never claimed, and after the leave it is a wanderer again and eats normally (it can still starve). Add a comment line in each where the eligible activities are listed ("not `stalking`: the visit is not interrupted for food").
  - [x] 5.2 `src/sim/systems/drag.ts` `pickUp`: also `delete s.stalk` beside `delete s.targetId`, with a comment (AC 7: a lifted Abomination's visit is over; a drop lands as `wander`). Update the header. `savable()` in `saveFile.ts` writes `dragged` as `wander`, and with this the saved state never holds a `stalk` without `stalking`.
  - [x] 5.3 `src/sim/selectors.ts`: add `export type PublicActivity = Exclude<SheepActivity, 'stalking'>` and `activity: PublicActivity` to `PublicSheep`, set in `publicSheep()` and `selectPublicSheep()` (placeholder literal + per-frame assignment) as `s.activity === 'stalking' ? 'wander' : s.activity`. Update the PublicSheep doc ("Later stories add name (5.3) and activity (4.3)") and the architecture-style comment: the field exists so the view can never learn of a stalk from activity. No view code reads it yet (the view's walk is from movement deltas, Story 4.2).
  - [x] 5.4 `npm run typecheck`, and fix every `PublicSheep` literal (the exact-shape assertion in `tests/sim/selectors.test.ts`; GameScene's DEV probe passes `[]`, so it is fine).
  - [x] 5.5 `eslint.config.js` (AC 9): extend `SECRECY_SYNTAX` with `MemberExpression[property.name=/^(stalk|doomedAt|nextKillAt|abomination)$/]` (or one entry each), the bracket-string variants as for `isAbomination`, and `Property[key.name=/^(stalk|doomedAt)$/]`. **Not** a `Property` rule for `abomination` (DeathCause keys in `strings.ts`/`HudScene.ts`). Rename `SECRET_MSG` if it reads "isAbomination is sim/debug only", so the message covers the new names. Probe with a temporary file in `src/view/` (expect errors) and in `src/sim/`, `src/debug/`, `src/save/` (expect none), then delete the probes. Check that the existing `src/view` and `src/input` code still lints clean (`grep` found no reads today).

- [x] **Task 6: DEV tools (`src/debug/DebugOverlay.ts`)**
  - [x] 6.1 **Make Abomination** calls `makeAbomination(s, lamb)` in place of setting the flag, so a made one gets its `nextKillAt` like a born one.
  - [x] 6.2 Add a **Kill now** button in the Abomination row. If one is alive, it sets `nextKillAt = s.time` through `debugMutate`, so the cycle can be watched without waiting 45 s. Otherwise `setStatus` says there is none. Add it to `simButtons`.
  - [x] 6.3 Extend the `abomLine` readout: `abom #12 · stalk approach→#5 2.4s | idle · next kill 31.0s · doomed #5 in 6.2s`, using `formatGameTime` or a plain `(ms / 1000).toFixed(1)`. It is DEV only, so it may read the secrets.
  - [x] 6.4 Optional: while Reveal is on, also ring a doomed sheep (a second Graphics, created and re-created like the first, drawn once, moved on `POST_RENDER`, never redrawn per frame). Skip it if the readout is enough to check AC 5 by eye.

- [x] **Task 7: Saves (AC 10)**
  - [x] 7.1 `src/config/constants.ts`: `SAVE_SCHEMA_VERSION = 10`.
  - [x] 7.2 `src/save/migrations.ts` step `9:`. If `s.abomination` is an object and some sheep object has `isAbomination === true` and `s.rng`/`s.time` are valid integers, roll `nextKillAt = time + rngInt(roll, KillMin, KillMax)` on a `{ rng }` copy and write the advanced rng back (step 8's pattern). Otherwise set `nextKillAt: 0`. Leave a malformed `abomination` for validation. Comment: no version-9 save holds `stalking`, `stalk` or `doomedAt`.
  - [x] 7.3 `src/save/validate.ts`: add `'stalking'` to `ACTIVITIES`. Per sheep, check the `stalk` ⇔ `stalking` ⇔ `isAbomination` rule and the `stalk` shape and bounds. `doomedAt` is not allowed on the Abomination, and has its bounds. At the top level, `int(s.abomination, 'nextKillAt', 'abomination', 0, time + KillMax)` (after `time` is read).
  - [x] 7.4 `src/save/normalize.ts`: clamp down `abomination.nextKillAt` to `time + KillMax`, each sheep's `doomedAt` to `time + DoomMax`, and `stalk.until` to `time + (the phase's length)`. Only well-formed values, as the existing clamps do. Note that a clamped `doomedAt` must stay > `time`. A clamp to `time + max` with max ≥ 1 tick does that.
  - [x] 7.5 `tests/save/busy.ts`: after the Abomination is made (use `makeAbomination`), set `state.abomination.nextKillAt = state.time` so a stalk starts inside the 1 s run, and give one other sheep `doomedAt = state.time + TUNING.abominationDoomMaxMs` (it outlives the run). Update the doc comment's field list. The callers' `isBusy` checks may need a `stalking` / `doomedAt` condition. If the fixture stops being busy, reseed it as 4.1 did and log it (deferred: the fixture is seed-fragile).
  - [x] 7.6 `tests/save/migrations.test.ts`: `toVersion9()` strips `nextKillAt` (and maps any `stalking` to `wander`, deletes `stalk`/`doomedAt`), chaining older helpers through it. Test: a v9 state without an Abomination gets `nextKillAt: 0` and an unchanged rng; with one, a deterministic `nextKillAt` in [time + min, time + max]; older versions chain through. Update `fromVersion8.ts`/`saveFile.test.ts` fixtures that rebuild the expected migrated state (4.1 pattern: state the rule, don't snapshot).
  - [x] 7.7 `tests/save/validate.test.ts`: reject `stalking` without `stalk`; `stalk` on a non-Abomination; `stalk` with `wander`; a bad phase; `until` ≤ time or past its bound; `doomedAt` on the Abomination; `doomedAt` ≤ time or > time + DoomMax; `nextKillAt` negative or beyond its bound. Accept a due `nextKillAt`. `tests/save/normalize.test.ts`: the three clamps.

- [x] **Task 8: Tests (AC 1–8, 11)**
  - [x] 8.1 `tests/sim/systems/abomination.test.ts` (extend). Build the flock by hand (`createSheep`, `makeAbomination`, a fixed seed), and run `updateAbomination` directly or `runFor`:
    - spawn: `onBirth` at the guaranteed birth sets `nextKillAt` in [time + min, time + max]; a birth that does not spawn draws nothing new (rng unchanged, as 4.1's tests check);
    - nothing happens before `nextKillAt`; at it, a free Abomination stalks; one that is `seekFood`, `eating` or `dragged` waits, then starts on its first `wander` tick;
    - `pickVictim`: never self, never dragged, never doomed; over many seeded picks every candidate appears; with only the Abomination (or only dragged sheep) it idles with **no draw** and `nextKillAt` stays due;
    - the full cycle: contact at ≤ `abominationContactPx` → linger exactly `abominationLingerMs` → `doomedAt` in [t + DoomMin, t + DoomMax] → leave for `abominationLeaveMs` → `wander` with no `stalk`, and `nextKillAt` in [leaveStart + KillMin, leaveStart + KillMax];
    - the victim gone (`removeSheep`, `killSheep`) or dragged mid-approach → re-picked on that tick; no candidates → idle;
    - a victim lost during the linger → no doom, and the leave still happens;
    - the Abomination picked up mid-approach / mid-linger → no stalk, no doom; after the drop it can start again (still due);
    - the approach timeout → no doom, `wander`, rescheduled;
    - the doom: `SheepDied { cause: 'abomination' }` + `CarcassSpawned` on exactly the first tick with `time >= doomedAt`; the doom still lands after the Abomination is sacrificed (`sacrifice`) or starves; a doomed victim sold first → only `Sold`, no death; a doomed victim that dies of the virus first → one `SheepDied` (`virus`) only;
    - a doom that takes the last sheep → `Lost` follows the `SheepDied`;
    - **no tell:** across a full cycle, the only events are the death's (`SheepDied`, `CarcassSpawned`, and `Lost` if it applies). There is nothing at the stalk start, the contact, the linger, the doom set or the leave.
  - [x] 8.2 `tests/sim/scenarios/killCycle.test.ts` (new): for 3–5 fixed seeds, a fed flock of about 12 in Land I with one Abomination (`makeAbomination`; keep everyone fed by topping up `fullness` between `runFor` chunks), run about 4 minutes. Assert: at least 3 `abomination` deaths; consecutive kill deaths are spaced at least `KillMin` apart (each death comes 5–10 s after a contact, and contacts are ≥ KillMin apart); every approach that started ended in contact within `abominationApproachMaxMs` (no timeouts in a normal pen; record the max approach time in the Debug Log); `selectPublicSheep` never reports `'stalking'` and the Abomination's PublicSheep differs from a lamb only in `gait` at every sampled tick. Assertions read `TUNING`.
  - [x] 8.3 `tests/sim/systems/movement.test.ts`: approach walks toward the victim at ≤ walk speed and closes the gap; linger: no walk (a lone pair, no other neighbours, moves only by separation); leave walks away from the victim's position. The existing exact path pins are untouched and still pass.
  - [x] 8.4 `tests/sim/selectors.test.ts`: the extended secrecy test (AC 8). Update the exact-shape assertion with `activity`. Check that `selectPublicSheep` matches `publicSheep` for a flock with a stalking Abomination and a doomed sheep.
  - [x] 8.5 `tests/sim/systems/drag.test.ts`: `pickUp` deletes `stalk`; a drop gives `wander` with no `stalk`.
  - [x] 8.6 `tests/sim/step.test.ts` (if it lists the system order): `updateAbomination` is registered after virus and before eras.
  - [x] 8.7 Run the full suite. No seeded test without an Abomination should move (no new draws). Tests that make or breed an Abomination will move: the spawn now draws `nextKillAt`, and kills change the flock. Fix each one to test the same rule (reseed, or compute from state), log it, and never loosen an assertion. The 4.1 scenario that breeds up to the guaranteed birth is the likely one.
  - [x] 8.8 Pacing probe (`npx vitest run tests/sim/scenarios/pacing.test.ts --reporter=verbose`): the kills land around the Abomination's birth (8th–15th) and after. Record the before/after table in the Debug Log. **If the Village guard (REFERENCE_CPS) fails, do not retune: stop and report to Rylan** (Open Question 1). The Town guard stays skipped (4.1 decision; it is re-checked after 4.7). Record the Town times anyway, for that re-check.
  - [x] 8.9 `npm run bench`: add a case with a stalking Abomination and a doomed sheep among 100. Record mean/p99 (budget 2 ms; 4.2: means ≤ 0.21 ms).

- [x] **Task 9: Browser check and docs (AC 3, 5, 8, 11)**
  - [x] 9.1 `npm run dev`. **Make Abomination**, then **Kill now**, with Reveal on, then repeat with it off:
    - it walks to a sheep, stands about 1 s right beside it (the victim steps away a little), and walks off;
    - 5–10 s later, the victim falls over with the normal death (carcass, dust, ping) and the toast "A sheep just… fell over.";
    - nothing at the moment of contact (no ping, no toast, no tint, no sound);
    - hover the Abomination mid-stalk: "Lamb · …"; hover the doomed sheep: as normal;
    - lift the Abomination mid-approach: after the drop it wanders; the readout shows no doom;
    - lift the victim mid-approach: the readout shows a new victim;
    - leave it running about 3 minutes at ×4: kills keep coming at about 45–60 s plus the approach.
  - [x] 9.2 `npm run build`; grep `dist/` for "Kill now" (must be absent) and for `stalk`/`doomedAt` (only in bundled sim/save code).
  - [x] 9.3 `_bmad-output/game-architecture.md` N2: record the contact radius and why (no chase with the 4.2 spacing); the death living in `abomination.ts` (not lifecycle); the busy-wait (the cycle waits for a free Abomination); the drag and timeout rules; `PublicSheep.activity`; the lint extension. Also check the `nextActivity` sketch in State Patterns: feeding never claims a `stalking` sheep.
  - [x] 9.4 `deferred-work.md`:
    - mark resolved "A victim picked up mid-approach (Story 4.3)" (re-picked, AC 6);
    - mark resolved "Approach and contact for the kill cycle (Story 4.3)" (contact 30 px);
    - mark resolved "Secrecy lint covers `isAbomination` only (Story 4.3)" (AC 9);
    - add a "Deferred from: story 4-3-the-kill-cycle" section with: **5.6** the death SFX/caption must not differ by cause (`[thud]` for all; `cause: 'abomination'` is never a tell); **5.4** stats may count deaths by cause only if the Stats panel never shows an Abomination line (UX-DR64); **5.3** the victim toast becomes "{name} just… fell over." with names; **4.4** sacrificing the Abomination does not cancel a pending doom (AC 5); **5.10** the contact radius, linger and leave values await the playtest; the pacing re-check (Town guard) still waits for 4.7.
  - [x] 9.5 Story file, `sprint-status.yaml` and `deferred-work.md` go in the same commit as the code (repo pattern).

### Review Findings

- [x] [Review][Decision] A victim lifted during the linger is still doomed — resolved by Rylan (2026-10-08): option 1, which becomes the patch below.
- [x] [Review][Decision] Each re-pick restarts the 20 s approach timer — resolved by Rylan (2026-10-08): option 1, which becomes the patch below.
- [x] [Review][Patch] A victim that is dragged when the linger ends gets no doom (Rylan's decision) [src/sim/systems/abomination.ts:135]
- [x] [Review][Patch] A re-pick keeps the approach's give-up deadline, so one visit's approach lasts at most abominationApproachMaxMs in total (Rylan's decision; AC 6 "until is reset" superseded) [src/sim/systems/abomination.ts:94]
- [x] [Review][Patch] Rylan (2026-10-08): the game is lost when only the Abomination is left — `checkLastSheepAndLoss` counts living non-Abomination sheep (pending lambs do not count, as today); validation rejects a not-lost save holding only the Abomination; tests; re-run the pacing probe and report [src/sim/systems/carcass.ts:160]
- [x] [Review][Patch] Stalk phase check uses `in`, so `"constructor"`/`"toString"` pass validation with no `until` bound and then throw in the sim; use an own-key check [src/save/validate.ts:178]
- [x] [Review][Patch] `stalk.victimId` equal to the Abomination's own id (or ≥ nextId) passes validation; it then dooms and kills itself. Reject both. The validate acceptance test's "gone victim" (`nextId − 1`) is in fact the Abomination itself: use a really gone id [src/save/validate.ts:177, tests/save/validate.test.ts]
- [x] [Review][Patch] Secrecy lint misses destructuring (`const { abomination } = state`, `{ nextKillAt }`): add an ObjectPattern rule for `abomination`/`nextKillAt` (object literals stay allowed for DeathCause keys) [eslint.config.js]
- [x] [Review][Patch] A victim lost during the linger leaves the Abomination on its approach heading, so it walks through the victim's spot instead of away: turn around [src/sim/systems/abomination.ts:139]
- [x] [Review][Patch] DEV "Kill now" during a visit is overwritten at the next leave but reports "due now": refuse while stalking [src/debug/DebugOverlay.ts]
- [x] [Review][Patch] DEV "Starve one" sets `wander` without deleting `stalk`, breaking stalk ⇔ stalking until the next tick (saves refused while paused) [src/debug/DebugOverlay.ts:216]
- [x] [Review][Patch] Scenario test gaps (Task 8.2): no per-tick "PublicSheep differs from a lamb only in gait" check; death spacing not asserted (the spec's "≥ KillMin" is not provable, since doom delays vary 5–10 s: assert ≥ KillMin − (DoomMax − DoomMin) and say why) [tests/sim/scenarios/killCycle.test.ts]
- [x] [Review][Patch] The "makeAbomination draws nothing on a non-spawning birth" test is vacuous (birth 1 can never draw): test a failed 5% roll after the guaranteed birth instead [tests/sim/systems/abomination.test.ts]
- [x] [Review][Patch] Tuning test checks doom bounds for tick alignment, which protects nothing (dooms land on any ms): keep only the visit phases and the kill interval in that check [tests/config/tuning.test.ts]
- [x] [Review][Patch] Docs: "8 seeds" for the 7.3 s max approach came from a scratchpad probe, the committed test runs 4; the tuning comment omits that a timed-out approach also reschedules; "lifting the Abomination saves the victim" means only "from this visit" (the next visit is due at once and may pick it again); `mayEatBreedingFood` lacks the "not stalking" comment (Task 5.1); DEV readout lacks the `stalk ` prefix (Task 6.3) [deferred-work.md, src/config/tuning.ts, src/sim/systems/drag.ts, src/sim/systems/feeding.ts, src/debug/DebugOverlay.ts]
- [x] [Review][Defer] Validation hard-rejects a `stalk`/`stalking` mismatch, so a future system that changes the Abomination's activity without deleting `stalk` would make saves fail to load; a normalize repair would be safer [src/save/validate.ts:174] — deferred, no such system exists yet

## Dev Notes

### What this story is (and is not)

- **Is:** the stalk (approach → linger → leave), victim choice, the doomed victim's delayed death through `killSheep(…, 'abomination')`, the `stalking` activity hidden behind `PublicSheep.activity`, DEV tools to trigger and watch it, schema 10, and the lint extension.
- **Is not:** the sacrifice reveal flash, screech or "Good riddance." (4.4); names in the toast (5.3); death sounds and captions (5.6); stats (5.4). **No view change is needed for the toast.** `STRINGS.deathToast('abomination', n)` already reads "A sheep just… fell over." (`src/view/strings.ts:26`), and `HudScene.onSim` counts every `SheepDied` by cause and toasts once per frame (`HudScene.ts:314`, `flushDeathToasts`). Don't touch either.

### Current code to build on (read these first)

| File | Today | This story |
|---|---|---|
| `src/sim/systems/abomination.ts` | `abominationIndex`, `abominationAlive`, `onBirth` (sets the flag in 2 branches) | `makeAbomination`, `updateAbomination`, `pickVictim` |
| `src/sim/step.ts` | movement → feeding → carcassEating → hunger → lifecycle → virus → eras | add `updateAbomination` after virus |
| `src/sim/systems/movement.ts` | `switch (s.activity)` with wander / seek×3 / eating / dragged; asymmetric 36/24 separation; exact path pins in tests | add `case 'stalking'` |
| `src/sim/state.ts` | `SheepActivity` without `stalking`; `AbominationState { birthsSeen, guaranteedAtBirth }` | add `stalking`, `stalk?`, `doomedAt?`, `nextKillAt` |
| `src/sim/selectors.ts` | `PublicSheep` has no `activity`; `publicSheep`/`selectPublicSheep` (no allocation) | add `activity` with the `stalking → wander` mapping |
| `src/sim/systems/drag.ts` | `pickUp` sets `dragged`, deletes `targetId`; `drop` sets `wander` | also delete `stalk` |
| `src/sim/systems/carcass.ts` | `killSheep` (filters `state.sheep`, carcass, `SheepDied`, `CarcassSpawned`, loss check) | no change; called with `'abomination'` |
| `src/sim/events.ts` | `DeathCause` already includes `'abomination'` | no change; no new event |
| `src/sim/systems/feeding.ts`, `carcass.ts` | claim only `wander`/`seek…` sheep | comments only |
| `src/save/{migrations,validate,normalize}.ts` | schema 9; step 8 rolls from the save's rng; strict validation; retune clamps | step 9 → 10, rules, clamps |
| `src/debug/DebugOverlay.ts` | Reveal / Make Abomination, `abomLine` readout | Make via `makeAbomination`, Kill now, richer readout |
| `eslint.config.js` | `SECRECY_SYNTAX` blocks `isAbomination` only | add `stalk`, `doomedAt`, `nextKillAt`, `.abomination` |

### What must be preserved

- **Secrecy (UX-DR64, AR18).** The view still tells the Abomination apart only by `gait` and by spacing. The stalk shows only as walking and standing, which every sheep does. A doomed victim shows nothing until it dies. The death surfaces like any death, with no cause in the toast.
- **The single death pipeline (N1).** The victim dies only through `killSheep`. Never splice or filter `state.sheep` yourself.
- **Loop safety.** `killSheep` replaces `state.sheep`, so the doom loop iterates the captured array. The cycle then re-finds the Abomination's index on the new array. The grid is not used here (`movement.ts` rebuilds it each tick).
- **Determinism.** With no Abomination alive: no draws, no code path change (the movement pins, pacing before the spawn, every existing seeded test). Every draw goes through `rng`/`rngInt`.
- **No allocation in hot paths.** `updateAbomination` runs every tick. Use plain loops, no filtered arrays, and no closures. `stalk` objects are created only at the start of a stalk (a rare event; fine) and mutated in place afterwards.
- **Feeding still feeds it.** The Abomination must still eat and still be able to starve (FR30). The busy-wait rule (AC 1) means hunger always gets its turn between visits.
- **The 4.2 tells are unchanged:** the 36/24 spacing and the off-step.

### Why contact is 30 px (read before Task 4)

- From 4.2: other sheep separate from the Abomination over 36 px at up to `separationWeight × walk` (90 px/s, capped at walk 60). The Abomination itself feels only 24 px.
- A victim at distance `d` < 36 is pushed away at `90 × (1 − d/36)` px/s. If "contact" meant touching (about 8–12 px), the victim would flee at the walk cap once the Abomination is inside about 12 px. The two balance at about 19–20 px, and the Abomination would chase it across the pen. That is a huge tell, and it is not "walks up to it".
- At 30 px, the victim drifts away at only 15 px/s, while the Abomination closes at 60 (its own 24 px push is 0 there). So contact comes quickly. On screen, the sprites (44–64 px wide at 2×) are touching: "next to it". During the 1 s linger, the victim eases out to about 36 px, which looks like a sheep stepping away from something odd. That is on-brand for the tell.
- Constraint: `personalSpacePx < abominationContactPx < abominationSpacePx` (24 < 30 < 36). Below 24, the Abomination's own push slows the approach; at or above 36, the victim feels no push at contact and the linger looks too cosy, and "contact" is already met at the normal resting gap. Task 1.2 asserts it.
- A victim that is walking away at full speed outruns the Abomination (both 60 px/s) until it turns, rests (2% per tick, mean walk about 5 s) or hits the fence. The 20 s approach timeout (AC 7) is the safety valve. Task 8.2 records the real maximum.

### Edge-case decisions (defaults chosen; see Open Questions)

- **Victim dragged before contact:** re-picked, like a sacrificed or sold one (most drags end in a sale or sacrifice anyway). Resolves deferred-work "A victim picked up mid-approach".
- **Already-doomed sheep** are not candidates, so one victim is never visited twice.
- **The Abomination dragged:** the visit ends. Before the doom is set (approach, linger), the victim is saved and the kill stays due.
- **Doom after the Abomination is gone:** it still lands. The visit already happened. GDD: "the victim dies 5–10 s later".
- **Timing of the interval:** 45–60 s from the start of each leave; the first one is from the spawn.

### Architecture compliance

- **N2 Kill cycle** (game-architecture.md): `stalk { victimId, phase, until }`, victim `doomedAt`, `state.abomination.nextKillAt`, `killSheep(…, 'abomination')`, `PublicSheep.activity` mapping `stalking → wander`. This story implements exactly those shapes.
- **Variance:** N2 step 3 says "the lifecycle check calls killSheep … when time >= doomedAt". The System Location Mapping puts "delayed victim death" in `abomination.ts`. This story follows the mapping (one system owns the whole concept, and lifecycle stays about age). Record it in N2 (Task 9.3).
- **State Patterns:** `stalking` is an explicit activity; transitions happen only in `updateAbomination` (and `pickUp` ends it, like any claim). Movement only reads it, as it reads the seek activities.
- **Systems never call each other:** `updateAbomination` calls `killSheep` (the N1 shared helper). `onBirth`/`makeAbomination` stay helpers owned by `abomination.ts`. `drag.ts` deleting `stalk` is the drag owner releasing a claim, like `targetId`.
- **Timers are absolute deadlines** (`nextKillAt`, `doomedAt`, `stalk.until`); no countdowns.
- **New numbers → `TUNING`**, with GDD citations; tests read `TUNING`.
- **Schema bump with migration + validation + normalize** in the same story.

### Library / framework notes

- No new packages and no Phaser API: this story is sim, save, lint and debug only. The optional doomed ring (Task 6.4) uses the same `Graphics` calls as 4.1's Reveal ring (`lineStyle`, `strokeCircle`, `setPosition`, `setVisible`), already verified against Phaser 4.2.1.
- Web research is not needed: no library or API is introduced.

### Testing standards

- Vitest; `tests/<same path as src>/…`; scenarios in `tests/sim/scenarios/`. Use `newGame(seed)`, `createSheep`, `runFor(state, ms)` in `TICK_MS` multiples (`tests/sim/helpers.ts`). Assert on state and `SimEvent`s; no spies, fake timers or `Math.random`.
- Tests may read and set `isAbomination`, `stalk`, `doomedAt` and `nextKillAt` (the lint covers `src/**` only).
- To trigger a kill in a test: `makeAbomination(state, lamb)`, then `state.abomination.nextKillAt = state.time`. To test the doom alone: set `victim.doomedAt = state.time + TICK_MS`.
- Use `TUNING.abomination*` in assertions, never literals.

### Previous story intelligence (4.1, 4.2)

- 4.1: the spawn is decided in `onBirth` (no event); `stageOf` keeps it a lamb; `Sacrificed.wasAbomination` is real. The DEV Make/Reveal tools and `debugSheepDrawnAt` exist. The busy fixture was reseeded (31337 → 31339) and is seed-fragile (deferred). The Town pacing guard is skipped until after 4.3/4.7.
- 4.2: the asymmetric 36/24 spacing; `eatReachPx` 14 (so seekers clear the 12 px hold-off); exact movement path pins recorded on `e3ef9aa` (must stay green). Its deferred note for this story is the contact problem solved above. The settle test is paired, because an unpaired one measured noise. Use the same discipline: a test that passes with the feature off proves nothing. For example, the "no tell" event test must also see the death events, so it is not vacuous.
- Review lessons (Epics 2–4): stale comments after behaviour changes (lifecycle header, `SheepActivity` comment, `PublicSheep` doc, the `step.ts` order comment, `AbominationState` doc); DEV objects leaking across GameScene restarts; seeded tests "fixed" by loosening; trivial assertions.

### Git intelligence

- Pattern: one "Implement story 4.3: The Kill Cycle" commit with code, story file, `deferred-work.md` and `sprint-status.yaml`; then a separate "Apply story 4.3 code review fixes" commit if the review finds patches.
- Branch: `story/4-3-the-kill-cycle` (created from `main` at `c224c83`).

### Open questions (defaults chosen; confirm or change)

1. **Pacing.** A kill every ~50 s from the Abomination's birth (around birth 8–15) will slow Village/Town. Default: record, don't retune; if the Village guard fails, stop and ask Rylan. The Town guard stays skipped until after 4.7.
2. **Contact radius 30 px** (between 24 and 36) instead of touching. Alternative: the victim ignores the Abomination's 36 px push during the stalk, so it can come right up to it. That is a code change in separation, and it creates a tell: the victim alone doesn't avoid it.
3. **A dragged victim is re-picked** (vs. the Abomination waiting for the drop and following the sheep, which is a stronger tell).
4. **Dragging the Abomination ends the visit** and can save the victim if done before the doom. Alternative: the stalk resumes after the drop.
5. **A pending doom survives the Abomination's sacrifice.** Alternative: sacrificing it cancels all dooms (a bigger reward for catching it, but it contradicts "the victim dies 5–10 s later").
6. **The approach timeout of 20 s** gives up the hunt and reschedules. Alternative: re-pick a new victim at the timeout.
7. **`PublicSheep.activity` is added now** (the epic AC names it), although no view code reads it yet.

### Project Structure Notes

- New: `tests/sim/scenarios/killCycle.test.ts`.
- Modified: `src/config/{tuning,constants}.ts`, `src/sim/{state,selectors,step}.ts`, `src/sim/systems/{abomination,movement,drag,lifecycle,feeding,carcass}.ts` (feeding/carcass/lifecycle: comments only), `src/save/{migrations,validate,normalize}.ts`, `src/debug/DebugOverlay.ts`, `eslint.config.js`, the tests in Tasks 7–8 (`tests/config/tuning.test.ts`, `tests/sim/systems/{abomination,movement,drag}.test.ts`, `tests/sim/selectors.test.ts`, possibly `tests/sim/step.test.ts`, `tests/save/{busy,migrations.test,validate.test,normalize.test,saveFile.test,fromVersion8}.ts`, `tests/perf/tick.bench.ts`), `_bmad-output/game-architecture.md`, `_bmad-output/implementation-artifacts/deferred-work.md`.
- No view files change. If you find yourself editing `src/view/**` for anything other than a type fix, stop: the toast and the death juice already exist.

### Project Context Rules (from `_bmad-output/project-context.md`)

- **The Abomination is secret.** `isAbomination`/`stalk` are read only in `src/sim/`, `src/debug/`, `src/save/`. Its stalking shows as `wander`, and its victims' toast is the vague "… just… fell over." The truth comes only through `Sacrificed { wasAbomination }`. It never ages or dies of old age, but **can starve**.
- **Every non-sacrifice death goes through `killSheep(state, id, cause)`.**
- **Timers are absolute game-ms deadlines in state** (`doomedAt`, `nextKillAt`…); never countdowns, `setTimeout` or Phaser timers.
- `src/sim/` is pure TS: no Phaser, DOM, `Date.now()` or `Math.random()`. Use `rng(state)`.
- A new rule goes in `src/sim/systems/<system>.ts`, registered in the fixed order in `step.ts`. A new tunable goes in `TUNING`. New state fields need a schema bump, a migration and validation.
- Exhaustive switches end with `assertNever` (the movement switch gains `stalking`).
- No allocation in `step()`/systems/selectors run per frame.
- Copy comes from `strings.ts`; no "kill" in UI text (the cause id `'abomination'` is code, not copy).
- `src/debug/` exists only behind `import.meta.env.DEV`.
- Done = `npm test`, `npm run typecheck`, `npm run lint` all green; rendering checked manually in the browser.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 4.3: The Kill Cycle]
- [Source: _bmad-output/planning-artifacts/epics.md#Requirements Inventory] FR12, FR31; AR17, AR18; UX-DR59, UX-DR64, UX-DR92, UX-DR97
- [Source: _bmad-output/planning-artifacts/gdds/gdd-sheep-civilization-2026-10-05/gdd.md#The Abomination (Should tier)] Kill cycle; At the moment of contact
- [Source: _bmad-output/game-architecture.md#N2 — Abomination: Hidden Identity, Delayed Kill, Reveal]; #N1 — Single Death Pipeline; #State Patterns; #System Location Mapping; #Game Time
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-sheep-civilization-2026-10-05/EXPERIENCE.md] Voice table ("{name} just… fell over."); "The Abomination never surfaces in any layer"
- [Source: _bmad-output/implementation-artifacts/4-1-the-abomination-is-born-and-stays-hidden.md], [4-2-the-abominations-tells.md]
- [Source: _bmad-output/implementation-artifacts/deferred-work.md] "A victim picked up mid-approach (Story 4.3)"; "Secrecy lint covers isAbomination only (Story 4.3)"; "Approach and contact for the kill cycle (Story 4.3)"; Town pacing guard
- [Source: _bmad-output/project-context.md#Critical Don't-Miss Rules]

## Dev Agent Record

### Agent Model Used

Claude Opus 5.5 (claude-opus-5-5[1m])

### Implementation Plan

- Sim: `abomination.ts` gains `makeAbomination` (the one spawn path: flag + first `nextKillAt`, used by `onBirth` and the DEV tools), `pickVictim` (two counting passes, one draw, none → no draw) and `updateAbomination` (doomed deaths over the captured array, then the visit on the re-found Abomination). It is registered after `updateVirus`, so contact is tested on the tick's moved positions and a hungry Abomination is claimed for food before a visit can start.
- Movement: a `stalking` case (approach seeks the victim like a food seeker; linger stands; leave walks its heading with wander's soft containment). Separation is untouched. `wrapAngle` moved to `src/sim/angle.ts` (identical code) so both systems share it. The seek arithmetic is duplicated rather than factored, to keep the seek case's float order exactly as pinned.
- Secrecy: `PublicSheep.activity` (`stalking` → `wander`), no `stalk`/`doomedAt` on PublicSheep, no new event; the lint rule now also covers `stalk`, `doomedAt`, `nextKillAt` and `.abomination` member reads.
- Saves: schema 10; the 9 → 10 step rolls `nextKillAt` from the save's own rng when an Abomination is alive (else 0); validation ties `stalk` ⇔ `stalking` ⇔ the Abomination, and bounds every deadline; `normalizeTuned` clamps the three deadlines.

### Debug Log References

- **Baseline (c224c83):** 673 passed, 1 skipped. Movement path pins (no Abomination) passed untouched after the change, so the ordinary steering path is unchanged.
- **Seeded fallout (8.7), fixed to test the same rule, nothing loosened:** three tests flagged an Abomination by hand with `nextKillAt` 0, so it began visiting and killing. The 4.2 settle test, the 4.2 feeding-next-to-it tests and the 4.1 starvation test now set `nextKillAt` past their run, with a comment that the kill cycle is not under test there. The 4.1 "flags the guaranteed birth" test asserted no rng draw at that birth; it now asserts exactly the one kill-schedule draw (computed from a copy of the rng). The busy save fixture uses `makeAbomination`, makes the visit due, and dooms one sheep; it stayed busy on seed 31339 (no reseed). The save tests that move `time` forward now move the fixture's kill-cycle deadlines with it, as they already did for its infection.
- **Doom times are any game-ms:** `rngInt(DoomMin, DoomMax)` is not tick-aligned, so the death lands on the first tick at or after `doomedAt` (the test computes that tick). The tuning test's reason text says so.
- **Scenario (8.2), fed Land I flock of 12, 4 min (a scratchpad probe over 8 seeds; the committed test runs 4 of them):** 3–4 visits and 3–4 deaths per run, every approach made contact, max approach 7.3 s (limit 20 s).
- **Pacing (8.8), seed 3606, before → after:** 2 cps Village 5:13 → 5:13; 3 cps 4:03 → 4:03; 5 cps 3:41 → 3:41; 6 cps Village 3:30 → 3:30, Town 14:57 → — (not reached in 20 min). The Village guard passes; the Town guard stays skipped (4.1 decision). Cause, from a scratchpad snapshot per minute at 6 cps: at Village the bot sells 8 of its 10 sheep for Land I, the Abomination is born by 6:00, and a 2–4 sheep flock cannot out-breed a visit every ~50 s; by 14:00 only the Abomination is left (the bot never sacrifices). Per Open Question 1, nothing was retuned. Reported to Rylan, and logged in deferred-work for the 4.7 re-check.
- **Bench (8.9), `npm run bench`:** new case "Abomination visiting + 10 doomed · steady": mean 0.051 ms, p99 0.134 ms. Every case's mean ≤ 0.21 ms (budget 2 ms). The known one-off first-tick GC sample (15.8 ms) appeared again (already deferred).
- **Lint probe (5.5):** a probe file reading `s.stalk`, `s.doomedAt`, `s['isAbomination']`, `st.abomination.nextKillAt` and keys `stalk`/`doomedAt`/`abomination` gave 7 errors each in `src/view/` and `src/input/` (the `abomination` key allowed), and none in `src/sim/`, `src/debug/`, `src/save/`. Probe files removed.
- **Browser (9.1):** a scratchpad Playwright probe on the DEV server (`main.ts` exposed the game temporarily; restored, no diff). All passed, twice: Kill now with none alive says so; Make schedules a visit 45–60 s ahead; the readout shows idle/phase/next kill/doomed; contact at 25.7–27.7 px; the Abomination's sim position is still for the whole linger; the victim is doomed 5–10 s after the linger; no toast appears during the visit; the victim dies with a carcass and the DOM toast "A sheep just… fell over."; the tooltip mid-approach reads "Lamb · Fed"; lifting the Abomination mid-approach ends the visit with no doom; lifting the victim re-picks; ×4 for about 3 game-min gave 4 deaths; no console errors. (My first probe read toasts from Phaser text, but toasts are DOM; fixed so the "no toast during the visit" check is not vacuous.)
- **Build (9.2):** `npm run build`; no "Kill now", "Make Abomination" or "Reveal Abomination" in `dist/`; `stalk`/`doomedAt` appear only in bundled sim/save code (validate, normalize, the selector mapping, drag, the kill cycle).
- **Task notes:** 6.4 (optional doomed ring) not added: the readout names the doomed sheep and its time left, which was enough to check AC 5 (logged in deferred-work). 8.6: `step.test.ts` has no system-order list, so nothing to update; the order is covered by "a doomed victim that dies of the virus first dies once".

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created
- Implemented the kill cycle: every 45–60 s a free Abomination stalks a random victim (approach, contact at 30 px, 1 s linger, 2 s leave), and the victim dies 5–10 s later through `killSheep(…, 'abomination')` with the existing vague toast. Victims lost or lifted before contact are re-picked; lifting the Abomination ends the visit; a 20 s approach timeout reschedules. No event or PublicSheep field reveals a visit. Schema 10 with migration, validation and normalize. DEV Kill now and a visit readout. Lint covers the new secrets.
- Tests added: tuning invariants; 25 kill-cycle unit cases (`tests/sim/systems/abomination.test.ts`); a 4-seed 4-minute scenario (`tests/sim/scenarios/killCycle.test.ts`); stalking movement; pickUp ends a visit; three secrecy cases; v9 → v10 migration (with/without an Abomination, malformed); 15 validation rejections plus an acceptance case; three normalize clamps; a bench case.
- All Open Question defaults kept. Pacing finding reported (Debug Log); no retune.

### File List

- `src/sim/angle.ts` (new)
- `src/sim/systems/abomination.ts`
- `src/sim/systems/movement.ts`
- `src/sim/systems/drag.ts`
- `src/sim/systems/feeding.ts` (comment)
- `src/sim/systems/carcass.ts` (comment)
- `src/sim/systems/lifecycle.ts` (comment)
- `src/sim/state.ts`
- `src/sim/selectors.ts`
- `src/sim/step.ts`
- `src/config/tuning.ts`
- `src/config/constants.ts`
- `src/save/migrations.ts`
- `src/save/validate.ts`
- `src/save/normalize.ts`
- `src/debug/DebugOverlay.ts`
- `eslint.config.js`
- `tests/config/tuning.test.ts`
- `tests/sim/systems/abomination.test.ts`
- `tests/sim/systems/movement.test.ts`
- `tests/sim/systems/drag.test.ts`
- `tests/sim/systems/lifecycle.test.ts`
- `tests/sim/selectors.test.ts`
- `tests/sim/scenarios/killCycle.test.ts` (new)
- `tests/sim/scenarios/abominationTells.test.ts`
- `tests/save/busy.ts`
- `tests/save/fromVersion8.ts`
- `tests/save/migrations.test.ts`
- `tests/save/validate.test.ts`
- `tests/save/normalize.test.ts`
- `tests/perf/tick.bench.ts`
- `tests/sim/systems/carcass.test.ts` (code review: loss rule)
- `tests/sim/scenarios/pacing.test.ts` (code review: the bot sacrifices the Abomination)
- `_bmad-output/game-architecture.md`
- `_bmad-output/implementation-artifacts/deferred-work.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/4-3-the-kill-cycle.md`

## Change Log

- 2026-10-08: Code review (Blind Hunter, Edge Case Hunter, Acceptance Auditor): 2 decisions, 13 patches, 1 deferred, 2 dismissed. **Rylan's rules:** the game is lost when only the Abomination is left; a victim held in the air when the linger ends is not doomed; an approach keeps its first 20 s deadline across re-picks (AC 6's "until is reset" superseded). Fixes: stalk phase checked as an own key (inherited names like "constructor" passed); a victim id that is the Abomination's own or never issued is rejected; destructuring reads covered by the secrecy lint; the Abomination turns around when its victim is lost in the linger; DEV Kill now refuses mid-visit and Starve one clears the stalk; scenario checks secrecy every tick and the death spacing; a vacuous spawn test and the tuning test fixed; docs corrected. The new deadline test found a real bug: a victim lifted every tick made the re-pick skip the timeout check (now checked first). **Pacing (Rylan's choice):** with the loss rule the bot lost at about 12 min at every rate, so it now sacrifices the Abomination after its 2nd victim dies; seed 3606: Village 5:13 / 4:03 / 3:41 / 3:30 (unchanged), no loss, Town at 6 cps 18:00 (guard still skipped). Gates: 750 tests (749 passed, 1 skipped); typecheck and lint clean.

- 2026-10-08: Story 4.3 implemented. The Abomination's kill cycle (approach, contact at 30 px, linger, doom, leave, reschedule) and the victims' delayed death through `killSheep(…, 'abomination')`; `stalking` hidden as `wander` in `PublicSheep`; save schema 10 (migration, validation, normalize); DEV Kill now and visit readout; the secrecy lint covers the new fields. Pacing: Village unchanged, Town no longer reached by the bot (reported; Town guard stays skipped). Gates: 735 passed, 1 skipped; typecheck and lint clean; browser probe passes twice.
