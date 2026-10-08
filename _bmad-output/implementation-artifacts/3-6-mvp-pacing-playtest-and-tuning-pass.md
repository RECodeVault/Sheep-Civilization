---
baseline_commit: 58eab5f
---

# Story 3.6: MVP Pacing Playtest and Tuning Pass

Status: done

<!-- Created 2026-10-08 by create-story. This closes Epic 3 and the Must tier. Unlike every story before it, the core of the work is a human playtest (Rylan) and design decisions; the dev agent's job is to make the build measurable and safe to retune before the session, then apply the numbers Rylan picks. Builds on every Epic 1–3 story, and works through the "3.6" items that 1.3, 1.7, 2.4, 2.5, 2.6, 2.8, 3.2, 3.3, 3.4 and 3.5 left in deferred-work.md. -->

## Story

As a game designer,
I want to playtest the complete Must-tier game and tune its numbers,
so that the MVP hypothesis is tested and pacing is close to the GDD targets before Should-tier work.

## Acceptance Criteria

1. **The session is played and timed (epic AC 1).** Rylan plays at least one full session of the Must-tier build at ×1 (the DEV build, with the debug overlay available but closed while playing). The time to Village (10 living sheep) and the time to Town (25) are recorded against the GDD targets: Village in 3–5 min, Town in 10–15 min. The DEV overlay records these milestones (Task 2), so nobody has to watch a stopwatch. The results go in the Playtest Record section of this file.
2. **Numbers change in `TUNING` only (epic AC 2).** Every gameplay number the playtest changes is a value in `src/config/tuning.ts`. Sim tests still pass, and they read `TUNING`, never re-typed literals. Each change is noted in the GDD decision log (`gdds/gdd-sheep-civilization-2026-10-05/decision-log.md`) with the old value, the new value and the reason, and the GDD tables that quote the number are updated to match.
   - The code changes in Tasks 1–3 are not tuning: they make a retune safe and measurable (bar width, save loading, copy built from `TUNING`, test coverage, the DEV tools). They change no gameplay number. See Open Question 2.
3. **Farm food bar (epic AC 2a).** `TUNING.farmPipsPerFood` (8 today) is tuned against the GDD feed-demand numbers (one piece per sheep every 42 s; at 8 pips, 10 sheep need about 1.9 Farm clicks/s and 25 sheep about 4.8). The decision log records:
   - the value chosen and why;
   - a decision on whether **Better Hoe** moves from Should (Story 4.7) to Must. If it moves, that is a scope change: record the decision here and in the decision log, and hand it to `gds-correct-course` afterwards. **Do not build Better Hoe in this story.**
4. **Breeding food bar (epic AC 2b).** `TUNING.breedingPipsPerFood` (8 today; one breeding needs 2 pieces, so 16 clicks) is tuned so the first breeding lands in the GDD pacing window ("1–5 min: the first adults, the first breeding and the first sale", GDD Difficulty Curve). The decision log records the value and why.
5. **The sim tick stays under 2 ms with big piles (epic AC 2a, 2b; NFR1 tick budget).** With 100 sheep at Land III, measured in Node by a benchmark (Task 3):
   - a 300-piece pile of food keeps the sim tick under 2 ms (mean, and p99 reported);
   - a mixed pile (150 food + 150 breeding pieces) keeps it under 2 ms;
   - both cases include the worst tick: the first tick on a fresh pile, when every hungry sheep claims a piece.
   The numbers, the machine and its load go in the Debug Log. The DEV overlay also shows the live tick time (Task 2), so Rylan can watch it while playing.
6. **A clean session (epic AC 3).** Over the whole session: zero console errors or warnings from the game (the DEV log's `warn`/`error`, uncaught errors, rejected promises), and the save survived every reload: Rylan reloads the page at least 3 times during play (at least once mid-boost, once mid-breeding-cooldown and once with a pregnancy pending), and each time Continue resumes the same flock.
7. **A retune never loses a save.** A save made under the old tuning loads under the new tuning. Values a lower bound would now reject (a progress bar past the new bar size, a deadline further ahead than the new duration) are clamped on load, not rejected (Task 1.3). Unit tests cover each clamp.
8. **Done.** `npm test`, `npm run typecheck`, `npm run lint` and `npm run build` pass. The playtest record, the decision log entries and the deferred-work updates are written.

## Tasks / Subtasks

The work runs in three phases. **Phase B is Rylan's.** The dev agent must not invent playtest results. When Phase A is done, stop, hand over the build and the checklist, and wait for Rylan's results before Phase C.

### Phase A: get the build ready for the playtest (dev agent)

- [x] **Task 1: Make a retune safe (AC 2, 7)**
  - [x] 1.1 **Pip bars follow `TUNING` (deferred 1.7: "Farm bar size defined twice").** `COMPONENTS.farmProgress.segmentCount` and `COMPONENTS.breedingProgress.segmentCount` (`src/config/constants.ts:296`, `:304`) duplicate `TUNING.farmPipsPerFood` and `TUNING.breedingPipsPerFood`. Draw one pip per tuned pip: build each `FarmProgress` from the tuning value (pass the count into the constructor, or derive `segmentCount` from `TUNING` in `constants.ts`) and remove the scaling in `FarmProgress.set`, which is then 1:1.
    - Layout check: the widget sits under the 232 px Farm button. Width is `n × 14 + (n − 1) × 2 + 6` (track) `+ 4 + 40` (count box): 8 pips → 176 px, 10 → 210, 11 → 226, 12 → 242 (too wide). Add a DEV `invariant` in `BottomBar` (like the threat-summary slot check) that both bars fit their buttons, and if Rylan picks more than 11 pips, shrink `PIP_W` rather than overflow.
    - `FARM_PROGRESS_W` is a module constant used by `BottomBar`; keep it derived from the same count.
  - [x] 1.2 **The old-age copy follows `TUNING` (deferred 2.4).** `STRINGS` death toast `oldAge` says "A long, full nine minutes." (`src/view/strings.ts:23`), true only while `oldAgeMs` is 540 000. Build the minutes from `TUNING.oldAgeMs` (whole minutes as a word: "nine"; a small number-word table for 1–20 is enough, with a digit fallback), or keep the literal and add a test-free DEV `invariant` that `oldAgeMs === 540_000`. The first is preferred: lifespan is a likely retune. Keep the Voice-table wording otherwise.
  - [x] 1.3 **Retune-safe save loading (deferred 2.8: "Validation bounds follow live tuning").** `src/save/validate.ts` rejects a save whose values sit outside bounds taken from the live `TUNING`, so lowering a value would reject saves (the flock is lost). Clamp instead, for each bound that depends on a tunable:
    - `farmProgress` above `farmPipsPerFood − 1` and `breedingProgress` above `breedingPipsPerFood − 1` → clamp to the top (a non-integer or negative value still fails);
    - `boostUntil` beyond `time + boostMs` → clamp to `time + boostMs`;
    - each sheep's `cooldownUntil` beyond `time + breedCooldownMs` → clamp;
    - each pregnancy's `dueAt` beyond `time + gestationMs` → clamp;
    - an infection already "past its virus death" (`infectedAt + virusDeathMs <= time`, `validate.ts:159`) → accept it instead of failing: `updateVirus` already kills at `time >= infectedAt + virusDeathMs` (`systems/virus.ts:26`), so the sheep dies of the virus on the first tick. Test that;
    - `fullness` above `fullnessMax` → clamp.
    - Positions are bounded by the fence, which only grows today. If Rylan's numbers ever shrink a `landFences` rect, clamp positions into the new inner fence the same way; otherwise leave position checks as they are.
    - Do this as a normalise step inside `src/save/` (validation stays the single gate; a clamp is not a reject). Non-finite, wrong-type and structurally impossible values still fail. Update the existing `tests/save/validate.test.ts` cases that expect rejection for these bounds, and add one test per clamp. No `SAVE_SCHEMA_VERSION` bump: the shape does not change.
  - [x] 1.4 **Config-level layout tests (deferred 3.3, 3.4, 3.5: "Camera fit / decoration layout / coverage are DEV-only").** The fit, decoration and background-coverage invariants run only when a DEV build loads `GameScene` (`src/view/scenes/GameScene.ts:935–975`). A `landFences` retune must be covered by `npm test`.
    - Move the plain-number rects they need (`BETTER_PLACE_BOUNDS`, `BETTER_PLACE_GLOW_BOUNDS`, `MARKET_BOUNDS`, `DECORATION_BOUNDS`, `ERA_BACKGROUND_BOUNDS`, `SHOP_PANEL_RIGHT`, the field view size, and the pure helpers `union`, `contains`, `intersects`, `fitsView`, `fitsWithInset`, `viewExtent`, `fenceDrawnBounds`) into a Phaser-free module, for example `src/config/layout.ts` (or `src/view/field/layout.ts` if it must stay in the view layer; Vitest may import a view module only if it imports no `phaser`). The view files re-export or import from there; values do not change.
    - Add `tests/config/layout.test.ts` that runs the same checks for every tier. Keep the DEV invariants in `GameScene` (or have both call one shared `layoutProblems()` function that returns a list of messages, which the test expects to be empty).
    - Check `eslint.config.js` boundaries before choosing the folder: `src/config` must not import `src/view`.
  - [x] 1.5 **Un-pin the land capacities in the tuning test.** `tests/config/tuning.test.ts` asserts `landCapacities` equals `[10, 25, 50, 100]` literally. Replace that with the shape rules (four strictly rising positive integers, one per tier) so a capacity retune does not need a test edit. Keep the era-equals-capacity test: if Rylan parts the tables, change that test and log why (deferred 3.5 "Era thresholds").
  - [x] 1.6 **Claim timeout: decide, don't build blind (deferred 1.7: "Claims never time out").** Read the note. Today the only known stuck case (two resting sheep holding a seeker off) clears within 4 s. Add a test-backed claim timeout only if the playtest or the Task 3 pile scenarios show a seeker stuck for more than ~10 s; otherwise record "not needed, observed" in deferred-work. If it is built, its length is a new `TUNING` value.

- [x] **Task 2: DEV playtest instruments (AC 1, 5, 6)** — all in `src/debug/DebugOverlay.ts` (DEV only; production builds contain none of it)
  - [x] 2.1 **Milestones line.** Record the game time (`state.time`, formatted with `formatGameTime`) at which this game first reached: first breeding (`Bred`), first birth (`LambBorn`), first sale, first purchase of Land I, first death (any cause), **Village**, **Town**, and **Wool Empire**. Show them on one or two overlay lines, `—` until reached.
    - Read them without new sim state: watch `currentEra(s)` and the `stats` counters (`sold`, `died`) and `owned` on the overlay's refresh, and listen to the sim events on the view bus (`Bred`, `LambBorn`, `Sold`, `Bought`, `SheepDied`, `EraChanged`) if a cleaner signal is needed. The overlay refreshes every 250 ms, so a milestone is stamped with the game time at the refresh that first sees it (≤ 250 ms × speed late); state that in a comment. If exactness matters, take the time from the event instead.
    - **Reloads.** The overlay's memory dies with the page. Rylan reloads during the session (AC 6), so persist the milestone record in `sessionStorage` keyed by a run id. Project rule: only `src/save/` touches `localStorage`; `sessionStorage` in DEV-only debug code is acceptable, but wrap every access in try/catch. Reset the record when a new game starts (time goes back to 0, or `stats` reset).
    - **Copy results** button: puts the milestones, the final flock, money, stats and the tick-time summary on the clipboard as plain text (same clipboard fallback as Copy save), ready to paste into the Playtest Record.
  - [x] 2.2 **Tick-time line.** Time each sim tick in DEV: wrap `step(this.state)` in `GameScene.tick` (`src/view/scenes/GameScene.ts:738`) with `performance.now()` behind `import.meta.env.DEV`, keeping a rolling mean and max over the overlay's window (module-scope numbers, no allocation). Show `tick  0.42 ms avg · 1.10 max`. Production code must not pay for this: gate the timing itself, not just the display.
  - [x] 2.3 **Pile buttons.** `+5 food` / `+5 breeding` are too slow to build a 300-piece pile. Add `+50 food` and `+50 breeding` (or make the existing buttons add 50 with Shift held), same Math.random placement as today.
  - [x] 2.4 **Warn counter.** Show a count of `log.warn`/`log.error` calls and safety-net reports since page load (hook `src/core/log.ts` in DEV, or count in `safetyNet.ts`), so AC 6's "zero errors" is visible at a glance. Rylan also keeps the browser console open.

- [x] **Task 3: Pile benchmark (AC 5)**
  - [x] 3.1 Add `tests/perf/tick.bench.ts` using Vitest's `bench` (tinybench), and a `"bench": "vitest bench --run"` script in `package.json`. `vitest.config.ts` includes only `tests/**/*.test.ts`, so bench files never run in `npm test` (timing assertions there would be flaky, against the testing rules).
  - [x] 3.2 Cases, all with `newGame(<literal seed>)`, `owned` set to Land I–III, `fillFlock(state, 100)`, every sheep set below `seekBelowFullness` so all are eligible:
    - baseline: no pieces;
    - 300 food pieces;
    - 150 food + 150 breeding pieces (set the adults off cooldown and not ready, so breeding claims happen too);
    - each as **first tick on a fresh pile** (clone a prepared state in the bench's `beforeEach`/setup, outside the timed function) and as **steady state** (600 ticks from the same start).
    - Place pieces with `createFoodPiece`/`createBreedingPiece` and the state's seeded rng (`rngRange`), never `Math.random`.
  - [x] 3.3 Run `npm run bench`, record mean and p99 per case in the Debug Log with the machine and its load average (3.2–3.5 found the machine often loaded; note it). Pass bar: mean < 2 ms in every case. If a case fails, profile `updateFeeding`'s claim loop first (`claimPieces` is O(claims × (sheep + pieces)) per tick, and `pieceIndex`/`breedingPieceIndex` are linear scans per seeker), and fix it without changing behaviour; the existing feeding tests must stay green.
  - [x] 3.4 Add a deterministic correctness scenario next to it, `tests/sim/scenarios/pile.test.ts`: 100 sheep and a 300-piece mixed pile, run until the pile is gone or a fixed tick cap. Assert that no seeker holds the same claim for more than a bound (this is the evidence for Task 1.6), that every eaten piece is eaten once, and that the state survives a JSON round trip mid-run.

- [x] **Task 4: Reference pacing probe (AC 1, 3, 4; see Open Question 1)**
  - [x] 4.1 Add `tests/sim/scenarios/pacing.test.ts`: a scripted "reference player" drives a seeded new game through `applyCommand` only (the same commands the view sends), at a fixed click budget, and reports the game time of the first breeding, Village and Town. A starting policy (document it in the file):
    - clicks per second: a constant `REFERENCE_CPS` (start with 3, a comfortable sustained human rate; also report 2 and 5);
    - each click goes to Farm while the food pieces on the field are fewer than the sheep below `seekBelowFullness`, otherwise to Farm Breeding Food while ready-or-waiting adults lack pieces;
    - breed the first two ready adults whenever `breedBlock` allows;
    - when the flock is at capacity and Land I is not owned, sell the oldest adults (elders first) until $50, then Buy; same for later tiers only after reaching Town (the GDD wall: selling costs era progress);
    - clear carcasses at once; no sacrifices (the boost is a bonus, not the baseline).
  - [x] 4.2 Print a small table (`console.info` in the test is fine) of milestone times per CPS, so a tuning candidate can be compared in seconds instead of a 15-minute session. Run it before and after each candidate change, and paste the before/after table in the Debug Log.
  - [x] 4.3 Assertions: determinism (same seed → same times), the bot never loses at the reference CPS, and, once Rylan has confirmed the numbers in Phase C, the reference times fall in the GDD windows (Village 180–300 s, Town 600–900 s) at `REFERENCE_CPS`. Until then, leave the window assertion as `it.todo` (or behind a constant) so `npm test` stays green.
  - [x] 4.4 This probe proposes; Rylan's session decides. If Rylan's times and the bot's disagree, Rylan's times win: adjust the bot policy or the CPS and note it.

- [x] **Task 5: Prepare and hand over (stop here)**
  - [x] 5.1 `npm test`, `npm run typecheck`, `npm run lint`, `npm run build` all pass. Run `npm run bench` and `pacing.test.ts`, and record their output in the Debug Log.
  - [x] 5.2 Using the probe, write **tuning candidates** (not applied) in the Playtest Record: for each of `farmPipsPerFood`, `breedingPipsPerFood` and any other value that looks off, the current value, a proposed value and the probe's predicted effect. Cover at least the `[ASSUMPTION, tune in 3.6]` values listed in Dev Notes.
  - [x] 5.3 Set Status to `in-progress` (unchanged) and hand Rylan: how to start the DEV build (`npm run dev`), the session checklist (Phase B below), and the candidates. **Halt and wait for Rylan's results.**

### Phase B: the playtest session (Rylan)

- [x] **Task 6: Play and record (AC 1, 6)**
  - [x] 6.1 Start a new game in the DEV build at ×1, overlay closed (backtick opens it; it does not pause the game). Play normally from the title screen. Keep the browser console open.
  - [x] 6.2 Play until Town (or 20 minutes, whichever comes first). If the flock is lost, note when and why, and start again; each run is a row in the record.
  - [x] 6.3 Reload the page at least three times (mid-boost, mid-cooldown, with a pregnancy pending) and Continue. Note anything different after each reload.
  - [x] 6.4 Use **Copy results** at the end of each run and paste it into the Playtest Record, with notes on feel: when clicking felt too fast or too idle, when the first breeding felt late, what was boring, what was frantic, and the "3.6 feel" items below (wander, spacing, eating, the Land III density, the era banner).
  - [x] 6.5 Decide each tuning candidate (keep / change to X), and the Better Hoe question (AC 3).
  - [x] 6.6 Optional: a second run with the chosen numbers, to confirm.

### Phase C: apply the decisions (dev agent, with Rylan's results)

- [x] **Task 7: Apply and record (AC 2, 3, 4, 8)**
  - [x] 7.1 Change the chosen values in `src/config/tuning.ts` only. Keep the comment style: each value cites its FR/GDD source; replace `[ASSUMPTION, tune in 3.6]` with a short "Tuned in 3.6 (playtest 2026-10-xx): was X" note on every value that was reviewed, kept or changed.
  - [x] 7.2 `npm test`. A test that breaks because it re-typed a number is a test bug: change it to read `TUNING`. A test that breaks because behaviour changed (for example a scenario that assumed 8 clicks per piece produces a piece) needs its scenario rethought, not a new literal.
  - [x] 7.3 Turn on the pacing window assertion (Task 4.3), with whatever CPS Rylan's session supports.
  - [x] 7.4 Docs: add one decision-log entry ("2026-10-xx · MVP pacing playtest (Rylan)") listing every change with old → new and why, the measured Village/Town times, the bench results, and the Better Hoe decision. Update the GDD where it quotes a changed number (Farming and Feeding table, Number Balancing, Pacing target, Difficulty Curve, Economy table) and remove the `[ASSUMPTION, tune in the post-Epic 3 playtest]` flags that are now settled; update `epics.md` FR text that quotes a changed number (FR3 "8-pip", FR8). If a pip count changes, DESIGN.md's `farm-progress`/`breeding-progress` `segmentCount` and EXPERIENCE.md's "{n}/8" mentions change too.
  - [x] 7.5 If Better Hoe moves to Must, do not implement it: note in the Completion Notes that `gds-correct-course` should run next.
  - [x] 7.6 Re-run the bench and the probe with the final numbers; record them.

- [x] **Task 8: Deferred-work sweep (AC 8)**
  - [x] 8.1 Mark each "Story 3.6" item in `deferred-work.md` resolved (with what was done) or moved (with the story that now owns it and why). The list is in Dev Notes, "The 3.6 items in deferred-work".
  - [x] 8.2 Add new items the playtest found that are not fixed here, each with its owning story.

### Review Findings

- [x] [Review][Decision] Human playtest data for AC 1 / AC 6 — **Resolved (Rylan, 2026-10-08): waived.** The docs say the pacing is probe-validated and human times come in the 5.10 external playtest; Tasks 6.1–6.4 close as waived. Original: no Copy results text, Village/Town times, reload count or console count from Rylan's session; Tasks 6.1–6.4 open. Also decides two dependent doc claims: the GDD Assumptions line now says the pacing targets were "checked in Story 3.6" and the decision log says the build was "played through with the playtest instruments", both resting on the bot only; and the new deferred item hands the missing data to 5.10 while the story keeps AC 1 open. Options: paste the results, or waive AC 1/AC 6 data (then the docs say "probe-validated; human times deferred to 5.10").
- [x] [Review][Decision] Town guard has no 10-minute floor — **Resolved (Rylan, 2026-10-08): add the floor; Land I $50 → $80** (probe at 6 cps: Town 10:41 / 11:13 / 11:09; Village unchanged). Original: `pacing.test.ts` asserts Town ≤ 15 min at `TOWN_CPS` 6, but the probe reaches Town at 8:50–9:54 there, below the GDD's 10–15 min window; Task 4.3 asked for the window at `REFERENCE_CPS`, which no tuned value reaches. Options: accept and document "Town < 10 min at 6 cps is fine", pick another guard rate, or change the window.
- [x] [Review][Decision] First breeding lands before the GDD's "1–5 min" window (AC 4) — the probe breeds at 0:12–0:20 for every breeding-pip value (the founders start as adults); the GDD Difficulty Curve still says "1–5 min: … the first breeding". Options: accept and update the GDD line, or retune something else (e.g. start the founders younger). **Resolved (Rylan, 2026-10-08): accept; update the GDD Difficulty Curve line.**
- [x] [Review][Decision] Task 1.1 asked for a "bar fits its button" invariant; the code widens the row instead — a 10-pip breeding bar shifts the row 8 px silently, and 11 pips fail with the misleading "money and flock counters overrun" message. Options: add the per-button invariant (the bar may never exceed its button), or keep the row-shift design and improve the message. **Resolved (Rylan, 2026-10-08): add the per-button invariant.**
- [x] [Review][Patch] Decision 1: waive the human playtest data; reword the GDD Assumptions line, the decision-log session line and the Playtest Record; close Tasks 6.1–6.4 as waived [gdd.md, decision-log.md, story]
- [x] [Review][Patch] Decision 2: `landPrices` Land I $50 → $80; Town guard asserts 10–15 min at `TOWN_CPS` 6; update GDD/epics/decision log/shop copy that quote $50 [src/config/tuning.ts, tests/sim/scenarios/pacing.test.ts]
- [x] [Review][Patch] Decision 3: GDD Difficulty Curve — the first breeding comes in the first minute (founders start adult) [gdd.md:329]
- [x] [Review][Patch] Decision 4: DEV invariant that each pip bar fits under its button; drop the row-shift [src/view/hud/BottomBar.ts]
- [x] [Review][Patch] Town range quoted as "8:33–9:54" at 6 cps; 8:33 was a 7-cps run — correct value 8:50–9:54 [decision-log.md, deferred-work.md]
- [x] [Review][Patch] EXPERIENCE.md Sam journey still says "the eighth pops +1" (should be the sixth) [ux-sheep-civilization-2026-10-05/EXPERIENCE.md:253]
- [x] [Review][Patch] Task 7.1 notes incomplete — reviewed-and-kept pacing values (`breedCooldownMs`, `starveMs`, `foodPieceFullness`, life stages, land capacities/prices, sale prices, `personalSpacePx`) have no "kept in 3.6" note [src/config/tuning.ts]
- [x] [Review][Patch] Corrupt sessionStorage record (`marks: null`, non-number marks) passes `read()` and then throws inside the sim tick via the bus listener; the listener and sync have no try/catch [src/debug/playtestRecord.ts:150, src/debug/DebugOverlay.ts:303]
- [x] [Review][Patch] New-game detection is a time heuristic (spec: keyed by run) — a Restart first seen after 5 s of game time (×16) or a debug Load of a nearby-time save blends two games, and events before the next sync stamp into the old record [src/debug/playtestRecord.ts:53-64]
- [x] [Review][Patch] Warning counter labelled "since page load" but starts when the overlay installs (after boot and the record's own read), and counts the overlay's own clipboard warning [src/debug/DebugOverlay.ts:52-66]
- [x] [Review][Patch] Art scale defined twice — local `SCALE = 2` in BetterPlace/Decorations/Market draws while `layout.ts` `WORLD_ART_SCALE` sizes the tested bounds [src/view/field/BetterPlace.ts:12, Decorations.ts:9, Market.ts:12]
- [x] [Review][Patch] Pacing bot: the Land II/III branch is unreachable (`reachedTown` is always false inside the loop), and it can sell the whole flock without affording the land [tests/sim/scenarios/pacing.test.ts:117,141]
- [x] [Review][Patch] The "malformed value" test's NaN case is serialised to null by `envelope()`, so NaN is never tested [tests/save/normalize.test.ts:~95]
- [x] [Review][Patch] Bench numbers disagree across the story Debug Log ("did not recur"), deferred-work ("2 of 3 runs, p99 ≤ 0.9") and the decision log ("p99 ≤ 0.7"); Task 7.6's final run has no per-case table; Task 3.2 (half the flock fed in the mixed case) and Task 4.1 (Farm rule) deviations are not in the Completion Notes [story, decision-log.md, deferred-work.md]
- [x] [Review][Patch] deferred-work says the claim evidence covers 8 seeds and "the test fails if…", but the test runs one seed; the 8 seeds were an ad-hoc run [deferred-work.md]
- [x] [Review][Patch] Bench: `steadyBench` builds `pileGame` eagerly at collection time for nothing [tests/perf/tick.bench.ts]
- [x] [Review][Patch] Layout test's background check asserts x only, not y [tests/view/field/layout.test.ts]
- [x] [Review][Defer] Load-time clamping does not cover a fence (`landFences`/`fenceInset`), lifespan or capacity retune — positions are still validated against the live fence, so shrinking a fence would reject saves [src/save/normalize.ts] — deferred: not retuned in 3.6 (Task 1.3 scoped it to "if a fence ever shrinks")
- [x] [Review][Defer] Bench first-tick case allocates its 400-state pool in setup, so a GC pause can land in a timed sample (the 13–14 ms outlier) [tests/perf/tick.bench.ts] — deferred: already in deferred-work ("A rare 13–14 ms sample"); means and p99 unaffected

## Dev Notes

### What this story is (and is not)

- It is a **measure → decide → retune** pass. The new code is DEV tooling, retune safety and tests. No new mechanic, no new UI for players, no new art, no audio.
- **Never fabricate playtest data.** The time-to-Village/Town that counts is Rylan's (AC 1). The pacing probe is a cheap estimate to choose candidates, not the result. If Phase B has not happened, the story is not done.
- **Out of scope:** Better Hoe and every other Epic 4 item (even if AC 3 moves it to Must: that is a correct-course decision), real art (era backgrounds and decorations stay placeholders; the deferred "Real art (3.6 / 5.x)" notes move to 5.x), audio (5.6), reduced motion (5.7), the formal NFR1 100-sheep FPS run on real hardware (5.11), the external playtest with 3 people (5.10).

### Pacing math (GDD Number Balancing; worked numbers for choosing candidates)

- Drain: `fullnessMax / starveMs` = 100 / 120 s ≈ 0.833 Fullness/s per sheep. A piece is +35, so each sheep needs one piece per 42 s.
- Clicks per second to feed `n` sheep at `p` pips per food, 1 pip per click: `n × p / 42`.
  | sheep | p = 8 | p = 6 | p = 5 | p = 4 |
  |---|---|---|---|---|
  | 10 | 1.9 | 1.4 | 1.2 | 1.0 |
  | 25 | 4.8 | 3.6 | 3.0 | 2.4 |
  | 50 | 9.5 | 7.1 | 6.0 | 4.8 |
  The boost doubles pips per click; Better Hoe I/II (Should) make it 2 / 3 pips. The GDD wants attention pressure to be the soft cap ("Difficulty Curve: 5–15 min, the feed load approaches 2–5 Farm clicks/s before upgrades"), so 25 sheep at ~5 clicks/s is the intended "hard", not a bug. Whether that is fun without Better Hoe is AC 3's question.
- Breeding: one lamb = 2 breeding pieces = `2 × breedingPipsPerFood` clicks (16 today), plus the 60 s cooldown per adult, 10 s gestation and 60 s to adulthood. Every breeding click is a click not spent on food, so the two bars compete for the same click budget.
- Village needs 10 living sheep, which is also the starting capacity (no land needed). Town needs 25, which needs Land I ($50 = 5 adult sales, each one a sheep further from the era). The GDD hand-sim gave Village at about 3 min; the 2026-10-07 change (adulthood 60–420 s, old age 540 s) means the founders now die at ~8 min, which matters for Town.
- `TUNING.eraThresholds` equals `landCapacities[0..2]` on purpose (decision log "Overcrowding at era thresholds"). Change both together, or log why they part and update the tuning test.

### Values flagged for this pass (`src/config/tuning.ts`)

Review each; changing is optional, recording the decision is not.

- Pacing (the epic's focus): `farmPipsPerFood` 8, `breedingPipsPerFood` 8, `breedCooldownMs` 60 000, `starveMs` 120 000, `foodPieceFullness` 35, `eraThresholds` [10, 25, 50], `landCapacities`, `landPrices` [50, 150, 400], `sellPriceAdult`/`Elder` 10/5, life stages (`lambUntilMs` 60 000, `elderFromMs` 420 000, `oldAgeMs` 540 000).
- `[ASSUMPTION, tune in 3.6]` feel values: `eatReachPx` 12 (must stay above ~8 px; see its comment), `eatMs` 1 500, `carcassFullness` 35, the start fence and Land II/III fences (`landFences`; Task 1.4's tests must stay green), `wanderTurnRad`, `wanderRestChance`, `wanderRestMinMs`/`MaxMs`, `separationWeight` 1.5, `fenceTurnMarginPx` 24, and `personalSpacePx` 24 (1.3 noted that 64 × 52 sprites overlap visibly at 24 px; but 4.2's Abomination tell is 36 px vs 24, so keep a clear gap if it changes).
- Not tunable here: `walkSpeedPxPerS` interacts with the virus/kill timings of Epic 4; change only with a reason.

### The 3.6 items in deferred-work (Task 8 sweeps these)

| Item (source) | Handled by |
|---|---|
| Farm bar size defined twice (1.7) | Task 1.1 |
| Claims never time out (1.7) | Task 1.6 / 3.4 |
| Old-age toast vs tuning (2.4) | Task 1.2 |
| Four-digit threat counts (2.6) | Check during the session; still unreachable → leave open, owner "any time" |
| Validation bounds follow live tuning (2.8) | Task 1.3 |
| Performance re-check, shop open vs closed (3.2) | Rylan's real browser during Phase B: note FPS shop open vs closed at the largest flock. The formal run stays 5.11 |
| The Land III pen is dense (3.3) | Phase B feel note; if too dense, record the decision (bigger world / zoom) and move it to 5.x, do not rebuild the camera here |
| Pieces under the open shop (3.3) | Phase B feel note |
| Camera fit has no `npm test` coverage (3.3) | Task 1.4 |
| Real art for decorations / eras (3.4, 3.5) | Move to 5.x (out of scope) |
| Decoration layout checks are DEV-only (3.4) | Task 1.4 |
| Era thresholds (3.5) | Task 7 + Pacing math above |
| Coverage is DEV-only (3.5) | Task 1.4 |
| Banner flicker at a threshold, mid-fade snap, banner covers the awning (3.5) | Phase B feel notes ("playtest, any time" items); fix only if Rylan asks |
| Alert ping timings (2.6 story: "3.6: tuning the ping timings") | Phase B feel note; `PING` in `AlertPing.ts` is view tuning, not `TUNING` |

### Current code to build on (read these first)

- `src/config/tuning.ts`: the only place gameplay numbers change. Frozen; nested tables are frozen too (the tuning test checks it).
- `src/config/constants.ts:290–305`: `COMPONENTS.farmProgress` / `breedingProgress` with `segmentCount: 8`.
- `src/view/hud/FarmProgress.ts`: pips built from `spec.segmentCount`; `set(progress, perFood)` scales between them; `FARM_PROGRESS_W` exported for `BottomBar`.
- `src/view/hud/BottomBar.ts`: places the two bars under Farm and Farm Breeding Food; has `invariant` slot checks to copy.
- `src/view/strings.ts:16–25`: `DEATH_TOAST.oldAge`; the land effect strings are already built from `TUNING` (3.3), copy that idea.
- `src/save/validate.ts:77–81, 146–159, 190`: the live-`TUNING` bounds listed in Task 1.3. `SAVE_SCHEMA_VERSION` is 8 (`constants.ts:32`).
- `src/sim/systems/feeding.ts`: `updateFeeding` (release/eat passes, then `claimPieces` for food, then breeding). `pieceIndex`/`breedingPieceIndex` (`selectors.ts:328`) are linear scans. Scratch `claimed` is a module-scope `Uint8Array` grown on demand.
- `src/sim/commands.ts:80–115`: `farm`/`farmBreeding` loop `while (progress >= pipsPerFood)` and already reset a bad progress value on click.
- `src/debug/DebugOverlay.ts`: DOM panel; `refreshSim` (every 250 ms) writes the lines; `debugMutate` for state changes; `copySave` has the clipboard fallback to reuse; `SPEEDS` ×1/×4/×16.
- `src/view/scenes/GameScene.ts:729–740` `tick()`: where `step` runs (Task 2.2). `:935–975`: the DEV layout invariants (Task 1.4). `stateCanRun` probes a state before starting it.
- `tests/sim/helpers.ts`: `newGame(seed)`, `runFor(state, ms)` (multiple of `TICK_MS`), `fillFlock`, `innerFence`. `tests/sim/scenarios/wander100.test.ts`: the 100-sheep Land III setup to copy.
- `tests/config/tuning.test.ts`: land and era table tests (Task 1.5).
- GDD: `gdds/gdd-sheep-civilization-2026-10-05/gdd.md` (Farming and Feeding, Life Stages, Breeding, Number Balancing, Difficulty Curve, Economy and Resources, Success Metrics), `decision-log.md` (append-only; follow the existing `## date · title (Rylan)` entry style).

### What must be preserved

- Determinism: the sim never reads `Math.random`/`Date.now`/`performance.now`. Timing lives in `GameScene` (DEV) and the bench only. Debug pieces keep using `Math.random` (view side) so the seeded stream is untouched; the bench and tests use the seeded rng.
- No allocation in `step()`/systems; the DEV tick timer in `GameScene.tick` uses module-scope numbers.
- The architecture layers (lint-enforced): `src/sim` and `src/core` import nothing from view/save/phaser; only `src/save` touches `localStorage`; `src/debug` only behind `import.meta.env.DEV`.
- Every existing save test (round trip of a busy state, corrupt/old-schema fallback, settings survive Restart) stays green after Task 1.3.
- The HUD bars' look at 8 pips must not change (Task 1.1 is a refactor until Rylan picks a new count).
- The Abomination secrecy rule: nothing in the new debug lines or the bench output reads `isAbomination` except `src/debug/` (allowed) and only if needed (it is not, for this story).

### Architecture compliance

- New tunable → `config/tuning.ts` (a claim timeout, if built). New colour → `COLORS`. New copy → `strings.ts`.
- Tests: `tests/<same path as src>/…`; scenarios in `tests/sim/scenarios/`; `createNewGame` via `newGame(<literal>)`; `runFor`; assert on state and events; read `TUNING` in assertions.
- Benchmarks are not tests: `*.bench.ts`, run by `npm run bench`, never by `npm test`.
- Done = `npm test`, `npm run typecheck`, `npm run lint` (plus `npm run build` here, since DEV gating must strip the tick timer and overlay from production: check that `dist/` contains no `DebugOverlay` strings).

### Library / framework notes (no new dependencies)

- Vitest ~4.1: `bench()` from `vitest` (tinybench underneath) runs under `vitest bench`; options include `time`, `iterations`, `warmupIterations`, and `setup`/`teardown` hooks, and the report shows mean, p75, p99 and the number of samples. Bench mode is marked experimental in Vitest; if it misbehaves, fall back to a plain Node loop in a `*.bench.ts` file that `vitest run` excludes, reporting the same stats. Verify the options against `node_modules/vitest` before use, not from memory.
- `performance.now()` in Node and browsers: sub-millisecond; fine for 0.1 ms resolution.
- `sessionStorage`: same try/catch rules as storage elsewhere (private mode can throw).
- Phaser 4.2.1: nothing new is needed. If Task 1.1 changes pip sizes, check the `setDisplaySize`/origin behaviour noted in `FarmProgress.set` (atlas frames carry a 0.5 pivot).

### Previous story intelligence (3.5, 3.4, 3.3)

- The machine is often loaded (load average 4–10 from other sessions). 3.5's FPS A/B had to alternate branches, and Rylan asked to stop the FPS comparison. So: measure tick time in Node (bench) rather than browser FPS, report the load average, and keep browser FPS to Rylan's real-hardware notes.
- 3.3–3.5 each left a DEV-only layout invariant uncovered by `npm test`; Task 1.4 consolidates them. 3.5's background coverage uses `PenCamera.viewExtent`, which is already a pure function.
- 3.5's review moved a load-time sync (`syncEra`) into `GameScene.create`; a continued game never announces an era. The milestone recorder must not treat the first frame of a continued game as "reached Village now": seed it from the saved state, and only stamp changes.
- Rylan's decisions often change ACs mid-story (2.6 count alignment, 3.5 stale `lastEra`). Record each such decision in the Completion Notes and the Change Log as previous stories did.
- 3.2/3.3 learned that `hunger.test.ts`'s long loop can time out under load; it now has a 30 s timeout. The pacing probe runs 15+ game-minutes (9 000+ ticks per CPS case): give it an explicit timeout too.

### Git intelligence

- Recent commits: 58eab5f (3.5 eras), 8cf1e6a (3.4 decorations), 3f3f24e (3.3 review fixes), ebf276a (3.3 land), a903488 (3.2 shop). Each story is one commit on a `story/<key>` branch, merged to `main`; this story's branch is `story/3-6-mvp-pacing-playtest-and-tuning-pass`.
- The story file, `sprint-status.yaml` and `deferred-work.md` are committed with the code.

### Open questions (defaults chosen; confirm or change)

1. **Pacing probe assertion.** Default: the reference bot's Village/Town times become a test assertion (GDD windows at `REFERENCE_CPS`) after Rylan confirms the numbers, as a pacing regression guard for Epic 4. Alternative: report-only, no assertion.
2. **"Only `tuning.ts` changes."** Default reading: gameplay numbers change only in `TUNING`; the safety and tooling code in Tasks 1–4 is allowed because it changes no number and makes the retune safe. If Rylan wants this story strictly tuning-only, Tasks 1.1–1.4 move to a separate tech-debt story and the retune avoids lowering any value Task 1.3 protects.
3. **Old-age copy.** Default: build "nine minutes" from `TUNING.oldAgeMs`. Alternative: keep the literal with a DEV check.
4. **Milestones across reloads.** Default: `sessionStorage` in DEV debug code. Alternative: add milestone times to `GameState.stats` (a schema bump to 9 with a migration; Story 5.4's stats panel could reuse them).
5. **Better Hoe.** No default: Rylan decides after playing (AC 3).

### Project Structure Notes

- New: `tests/perf/tick.bench.ts`, `tests/sim/scenarios/pile.test.ts`, `tests/sim/scenarios/pacing.test.ts`, `tests/config/layout.test.ts`, and a Phaser-free layout module (`src/config/layout.ts` or `src/view/field/layout.ts`; check the lint boundaries).
- Changed: `src/config/tuning.ts` (Phase C), `src/config/constants.ts`, `src/view/hud/FarmProgress.ts`, `src/view/hud/BottomBar.ts`, `src/view/strings.ts`, `src/save/validate.ts` (or a new `src/save/normalize.ts`), `src/view/scenes/GameScene.ts` (DEV tick timer; invariants call the shared layout checks), the view files whose rects move, `src/debug/DebugOverlay.ts`, possibly `src/core/log.ts` (DEV warn counter), `package.json` (`bench` script), `tests/config/tuning.test.ts`, `tests/save/validate.test.ts`.
- Docs: GDD `gdd.md` and `decision-log.md`, `epics.md`, DESIGN.md / EXPERIENCE.md only if a pip count changes, `deferred-work.md`, `sprint-status.yaml`.

### Project Context Rules (from `_bmad-output/project-context.md`)

- Phaser 4.2 (not 3), TS 6 strict, Vite 8, Vitest 4.1; no new npm packages.
- Sim/core are pure TS: no `phaser`, DOM, `localStorage`, `Date.now()`, `Math.random()`.
- New tunable number → `config/tuning.ts`; tests use `TUNING` values, never re-typed literals.
- Tests: `src/sim` and `src/save` only (plus pure `config` tables); no Phaser, DOM or canvas; never mock Phaser; fixed literal seeds; `runFor`; no fake timers.
- Save: every storage access in try/catch; `GameState` shape changes need a `SAVE_SCHEMA_VERSION` bump and a migration (Task 1.3 changes no shape).
- Performance: 16.6 ms/frame at 100 sheep; sim tick ≤ 2 ms at 100 sheep; no allocation in tick or frame code; no logging, `JSON.stringify` or storage access in tick/frame code (the DEV overlay's 250 ms refresh is not a frame path, but keep `sessionStorage` writes to milestone changes only).
- DEV-only code behind `import.meta.env.DEV`; production contains none of it.
- Copy from `strings.ts`; colours from `COLORS`; no "!" except "Last sheep!"; never "corpse", "blood" or "kill".

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.6: MVP Pacing Playtest and Tuning Pass]
- [Source: _bmad-output/planning-artifacts/gdds/gdd-sheep-civilization-2026-10-05/gdd.md#Number Balancing, #Difficulty Curve, #Farming and Feeding, #Life Stages, #Upgrade Trees, #Success Metrics, #Assumptions and Dependencies]
- [Source: _bmad-output/planning-artifacts/gdds/gdd-sheep-civilization-2026-10-05/decision-log.md (2026-10-05 v0.3 pacing fix; 2026-10-06 Farm bar, no food stock, breeding food entries)]
- [Source: _bmad-output/planning-artifacts/sprint-change-proposal-2026-10-06.md, sprint-change-proposal-2026-10-06-breeding-food.md]
- [Source: _bmad-output/implementation-artifacts/deferred-work.md (every "Story 3.6" item)]
- [Source: _bmad-output/implementation-artifacts/3-5-eras-and-their-transitions.md#Dev Agent Record]
- [Source: _bmad-output/project-context.md]

## Playtest Record

<!-- Phase A fills "Tuning candidates"; Rylan fills the runs and decisions in Phase B; Phase C records what was applied. -->

### Tuning candidates (Phase A)

Reference probe (`tests/sim/scenarios/pacing.test.ts`), mean of seeds 3606 / 11 / 2026, after the bot fix noted in the Debug Log. "—" = not reached in 20 min. The bot never sacrifices (no boost) and only buys Land I before Town.

| farm / breeding pips | 2 cps: Village · Town · peak | 3 cps: Village · Town · peak | 5 cps: Village · Town · peak | first breeding (3 cps) |
|---|---|---|---|---|
| **8 / 8 (now)** | — · — · 9 | **4:28** · — · 12 | 3:41 · — · 19 | 0:17 |
| 6 / 8 | 6:17 · — · 10 | 4:02 · — · 15 | 3:33 · — · 23 | 0:14 |
| 6 / 6 | 6:15 · — · 10 | 3:43 · — · 16 | 3:31 · — · 24 | 0:14 |
| 5 / 8 | 4:26 · — · 12 | 3:51 · — · 17 | 3:38 · 9:17 · 25 | 0:11 |
| 5 / 6 | 4:48 · — · 12 | 3:44 · — · 18 | 3:31 · 9:04 · 25 | 0:11 |
| 5 / 4 | 4:07 · — · 13 | 3:35 · — · 18 | 3:28 · 8:28 · 25 | 0:10 |
| 4 / 4 | 3:41 · — · 15 | 3:39 · — · 21 | 3:28 · 8:28 · 25 | 0:09 |
| 6 / 6, lifespan +2 min (elder 540 s, old age 660 s) | 6:15 · — · 11 | 3:43 · — · 16 | 3:31 · 13:11 (1 of 3) · 24 | 0:14 |

What the probe says:
- **Village is already in the GDD window** (3–5 min) at 3 clicks/s with today's numbers (4:28). Cheaper bars bring it to about 3:40; below that the time gates (cooldown, gestation, 60 s to adulthood) set the floor (~3:30).
- **Town is click-bound.** At 3 clicks/s no candidate reaches 25 sheep: the flock plateaus where the food clicks (`sheep × farmPips / 42` per second) plus the breeding needed to replace old-age deaths use up the budget (12 sheep at 8 pips, ~21 at 4). Old age is most of the deaths after minute 8. Town in 10–15 min needs about 5 clicks/s with 5 food pips or fewer, or an upgrade: that is the GDD's own assumption ("Better Hoe and the boost cut this", Number Balancing). A longer lifespan does not fix it.
- **Breeding pips matter little**: 8 → 4 moves the first breeding from 0:17 to 0:09 and Village by about 10–50 s. Every candidate's first breeding is well before minute 1 (the founders start as adults).

| Value | Current | Proposed (not applied) | Why / probe prediction |
|---|---|---|---|
| `farmPipsPerFood` | 8 | **5** (or 6) | 3 cps: peak 12 → 17–18, Village 4:28 → ~3:45; 5 cps: Town at ~9:00–9:20 instead of never. Fits the bar (≤ 11 pips under the Farm button). |
| `breedingPipsPerFood` | 8 | 6 (or keep 8) | Small effect: first breeding ~0:17 → ~0:11; Village −10 to −40 s. Fits (≤ 9 pips under its button; 11 trips the BottomBar invariant). |
| Better Hoe Should → Must | Should | **Rylan decides** | At 8 pips, Hoe I (2 pips/click) costs like a 4-pip bar: probe 4/4 plateaus at ~21 at 3 cps and reaches Town at 8:28 at 5 cps. Moving it changes scope (correct-course); with `farmPipsPerFood` 5 it can stay Should. |
| `breedCooldownMs` | 60 000 | keep | Not re-measured after the bot fix. Town is click-bound, so a shorter cooldown should not help much (inference). |
| `elderFromMs` / `oldAgeMs` | 420 000 / 540 000 | keep | +2 min (6/6 row) leaves Village unchanged and does not bring Town in at 3 cps. |
| `eraThresholds` / `landCapacities` | 10/25/50 · 10/25/50/100 | keep | Village is in the window; Town depends on the click rate Rylan's session shows. |
| `starveMs`, `foodPieceFullness` | 120 000, 35 | keep | They set the feed demand with the pips; change one at a time. |
| Feel values: `eatReachPx` 12, `eatMs` 1 500, `carcassFullness` 35, `wander*`, `separationWeight` 1.5, `fenceTurnMarginPx` 24, `personalSpacePx` 24, `landFences` | — | keep; judge in play | The probe cannot judge feel. Look at the wander, spacing, eating and Land III density (feel notes). `npm test` now covers the fence layout (Task 1.4). |
| Probe `REFERENCE_CPS` | 3 | confirm in play | The click rate Rylan's run actually sustains decides which column counts. |

### Runs (Phase B)

| Run | Date | Build | First breeding | Village | Town | Lost? | Reloads OK | Console errors | Notes |
|---|---|---|---|---|---|---|---|---|---|
| Rylan | 2026-10-08 | Phase A (8/8 pips) | waived | waived | waived | — | waived | waived | Rylan reported "everything looks good" and, in the code review, waived recording per-run times (AC 1 / AC 6). Human times move to the external playtest (5.10). |

### Feel notes (Phase B)

- Rylan: "everything looks good". No feel issues raised (wander, spacing, eating, Land III density, era banner, pings, pieces under the shop all left as they are).

### Decisions (Phase B)

Rylan, 2026-10-08:

- `farmPipsPerFood`: **6** (was 8; the proposal was 5).
- `breedingPipsPerFood`: **8** (kept).
- Better Hoe Should → Must?: **no, stays Should** (no correct-course needed).
- Other values: **keep** all.

Applied (Phase C), probe after the change (seeds 3606 / 11 / 2026): Village 4:02 / 3:54 / 4:11 at 3 clicks/s; Town 9:26 / 8:50 / 9:54 at 6 clicks/s, not reached at 3–5 clicks/s (peak 15–23).

Code review decisions (Rylan, 2026-10-08): human times waived; Town must fall in 10–15 min, so **Land I $50 → $80**; the first breeding in the first minute is accepted (GDD updated); each pip bar must fit under its button. Probe after the review (bot fixed so it never sells for land it cannot afford), seeds 3606 / 11 / 2026 / 7 / 42 / 99: Village 4:02 / 3:54 / 4:11 / 4:11 / 4:04 / 3:54 at 3 clicks/s; Town 14:17 / 14:30 / 13:16 / 12:26 / 13:40 / 14:05 at 6 clicks/s and 12:08–12:49 at 7.

## Dev Agent Record

### Agent Model Used

Claude Opus 5.5 (claude-opus-5-5[1m])

### Implementation Plan

- **Retune safety (Task 1):** pip bars draw one pip per `TUNING` pip (`FarmProgress` takes the count; `BottomBar` sizes each bar from its own tuning value); the old-age toast builds its minutes with `formatMinutesInWords(TUNING.oldAgeMs)` (`src/core/format.ts`); `normalizeTuned` (`src/save/normalize.ts`) runs in `decodeSaveResult` between migrate and validate and clamps tuning-bounded values (bars, boost, cooldowns, gestation, Fullness; an overdue infection is moved so it dies on the first tick). `validateState` stays strict, since `writeSave` also uses it on the live state. The field layout (rects, camera limits, fence part sizes, art sizes, shop panel edge) moved to the Phaser-free `src/view/field/layout.ts` with one `layoutProblems()` check that GameScene asserts in DEV and `tests/view/field/layout.test.ts` runs in `npm test`.
- **Instruments (Task 2):** `GameScene.tick` times `step` in DEV only (`takeTickStats`); the overlay adds `tick`, `pace`, `first` and `warn` lines, `+50 food` / `+50 breeding`, and **Copy results**. `src/debug/playtestRecord.ts` stamps milestones from the bus's sim events at the exact tick, seeds already-passed ones as approximate (`≤`), tells a new game from a reload by time, and keeps the record in `sessionStorage` (Open Question 4 default; two `eslint-disable-next-line` comments with the reason). The overlay wraps `console.warn`/`console.error` to count them.
- **Bench (Task 3):** `tests/perf/tick.bench.ts` (`npm run bench`), tinybench through Vitest; first-tick cases consume a pool of identical states so no clone is timed.
- **Probe (Task 4):** `tests/sim/scenarios/pacing.test.ts`, a reference player driving `applyCommand` with a click budget (policy in the file header).

### Debug Log References

- **Baseline:** 585 tests green at 58eab5f; load average 0.09.
- **Bench (AC 5), `npm run bench`, Node 24, Vitest 4.1.11, this WSL2 machine.** Times in ms, mean / p99 / max (samples):

  | case (100 sheep, Land III) | run 1 (load 0.23) | run 2 (load 1.82) |
  |---|---|---|
  | no pieces · first tick | 0.040 / 0.215 / 0.33 (400) | 0.050 / 0.397 / 0.78 (400) |
  | 300 food · first tick | 0.199 / 0.482 / 14.4 (400) | 0.170 / 0.690 / 1.06 (400) |
  | 150 food + 150 breeding · first tick | 0.196 / 0.439 / 0.61 (400) | 0.206 / 0.435 / 0.91 (400) |
  | no pieces · steady 600 | 0.035 / 0.149 / 0.79 (600) | 0.034 / 0.218 / 0.53 (600) |
  | 300 food · steady 600 | 0.071 / 0.328 / 1.49 (600) | 0.067 / 0.370 / 1.45 (600) |
  | 150 + 150 · steady 600 | 0.054 / 0.189 / 0.79 (600) | 0.064 / 0.361 / 0.42 (600) |

  Every mean is under 0.21 ms (budget 2 ms); every p99 under 0.7 ms in these two runs. The single 14.4 ms sample in run 1 did not recur in run 2 (max 1.06 ms), but did in later runs (below).
- **Bench, Phase C and final (after the code review fixes):**

  | case | run 3 (load 0.83) | run 4, final (load 0.47) |
  |---|---|---|
  | no pieces · first tick | 0.041 / 0.254 / 0.46 | 0.044 / 0.312 / 0.50 |
  | 300 food · first tick | 0.213 / 0.899 / 13.1 | 0.205 / 0.589 / 15.0 |
  | 150 food + 150 breeding · first tick | 0.211 / 0.588 / 0.76 | 0.192 / 0.384 / 0.56 |
  | no pieces · steady 600 | 0.033 / 0.128 / 0.86 | 0.034 / 0.132 / 0.21 |
  | 300 food · steady 600 | 0.073 / 0.477 / 1.51 | 0.076 / 0.287 / 1.84 |
  | 150 + 150 · steady 600 | 0.056 / 0.150 / 0.29 | 0.054 / 0.156 / 0.25 |

  Over all 4 runs: means ≤ 0.21 ms, p99 ≤ 0.9 ms; one 13–15 ms sample in "300 food · first tick" in 3 of 4 runs, right after the bench builds its 400-state pool, so likely a GC pause in the harness (deferred-work).
- **Pile scenario (Task 3.4 / 1.6):** longest claim per seed (1–8): 16.9, 10.8, 10.4, 17.6, 16.7, 9.8, 17.1, 16.7 s; the walk across the Land III inner fence's diagonal is about 17 s; 250–251 claims for 250 pieces eaten. Bound in the test: 1.5 × walk + `eatMs` ≈ 27.1 s.
- **Pacing probe (Task 4):** the first sweep showed Village stuck at about 5:00 for every candidate. The cause was the bot: it sold for Land I as soon as `slotsUsed` (living + pending lambs) filled the pen, one birth before Village. Fixed to sell only once the *living* flock fills the pen; the tables in the Playtest Record are after the fix. Death causes at 8/8 (seed 3606, 3 cps, 20 min): 1 starved, 12 old age. `tuning.ts` was edited only in a scratch loop and restored after each sweep (`git diff` clean).
- **Browser checks (Chrome + SwiftShader via playwright-core, DEV server on port 5213, scratchpad probes `p1`–`p3`):**
  - HUD at 8 pips unchanged (`p1-a-hud.png`). With a temporary `farmPipsPerFood` 5 / `breedingPipsPerFood` 6 the bars draw 5 and 6 pips with "3/5" and "1/6" (`p3-pips.png`); with 11 breeding pips the `BottomBar` invariant fires ("the money and flock counters overrun the threat summary"), as intended. Restored afterwards.
  - Overlay: the `tick`, `pace`, `first` and `warn` lines show. A 103-sheep Land III pen with ~100 food and 150 breeding pieces reads `tick 0.40 ms avg · 0.60 max` (FPS 29 in the software renderer). Chrome's `performance.now` here resolves 0.1 ms, so the overlay's tick numbers are coarse; the bench is the precise measure.
  - "+10 sheep" stamps Village exactly (0:02); a reload past an autosave plus Continue keeps the record (Village 0:02 still shown), and a new game resets it. **Copy results** produced the text summary. No page or console errors in any run.
- **Production build:** `npm run build` passes; the overlay and record are absent from `dist/` ("Copy results", "sheepciv.debug" not found), and the `performance.now` count in `dist` equals the baseline build's (7), so the DEV timing branch is stripped. `takeTickStats` and its three counters ship unused, like the other GameScene debug members.

### Completion Notes List

- 2026-10-08: Story created. Ultimate context engine analysis completed - comprehensive developer guide created.
- 2026-10-08: **Phase A done (Tasks 1–5); halted for Rylan's playtest (Phase B) as the story requires.** Status stays `in-progress`. 609 tests pass (24 new) plus 1 todo (the pacing window, Task 7.3); typecheck, lint and build clean.
- **Task 1.1 deviation:** the story suggested a DEV invariant that each bar fits under its own button. Each bar's width now feeds the row layout instead (a wider bar pushes the groups right), and the existing read-out invariant catches a row that overflows. The measured limits: farm bar up to 11 pips without moving anything, breeding bar up to 9; 10 breeding pips shift the row by 8 px, 11 fail the invariant.
- **Task 1.3:** clamping happens on load only (`normalizeTuned` in the decode path); `validateState` keeps rejecting out-of-bound values on the live state (`writeSave`). The existing validation tests are unchanged and still pass; 10 new tests cover each clamp, an untouched save, malformed values (still rejected) and an overdue infection dying on the first tick.
- **Task 1.4:** `tests/view/field/layout.test.ts` is the first test under `tests/view/`. It imports only the Phaser-free `layout.ts`, so it keeps the "no Phaser in tests" rule.
- **Task 1.6:** no claim timeout; evidence in the Debug Log and deferred-work.
- **Task 2.4:** the warning counter counts every `console.warn`/`console.error` after the overlay installs (including a clipboard-fallback warning from the overlay itself).
- **Phase C (2026-10-08):** Rylan chose `farmPipsPerFood` 6 (not the proposed 5), kept `breedingPipsPerFood` 8, kept Better Hoe in Should and every other value. Only `tuning.ts` changed in gameplay numbers; no test needed an edit (they read `TUNING`). Task 7.3 turned the todo into two guards over 3 seeds: Village in 3–5 min at `REFERENCE_CPS` 3, and Town within 15 min at `TOWN_CPS` 6. The GDD's 10–15 min Town window is not asserted at 3 cps because the bot (no boosts, no Hoe) does not reach Town below ~6 cps with these numbers; that is recorded in the GDD, the decision log and deferred-work (for 4.7 and 5.10). Bench re-run on the final numbers: means ≤ 0.21 ms (load 0.83).
- **Open for AC 1 / AC 6:** Rylan reported that everything looks good but pasted no **Copy results** text, so the time to Village and Town from a human session, the reload count and the console count are not in the Playtest Record. Tasks 6.1–6.4 stay unchecked until that text is pasted (or Rylan waives it); 6.6 is optional and was not done.
- **Code review (2026-10-08):** Rylan waived recording human session times (AC 1 / AC 6 accepted on the probe; human times move to 5.10, and the GDD keeps the pacing as a partly validated assumption), so Tasks 6.1–6.4 and 6.6 close as waived. Land I went to $80 so the 10–15 min Town window holds at 6 clicks/s; the guard now asserts both bounds. The bot fix (sell only when the sales can pay for Land I; no unreachable Land II/III branch) moved Town later: 12:26–14:30 at 6 clicks/s over 6 seeds, about 30 s inside the limit on the slowest seed (7 clicks/s gives 12:08–12:49). Other fixes: per-button `BottomBar` invariant (the row no longer shifts), the art scale shared from `layout.ts`, a robust playtest record (validated on read, guarded calls, new game told apart by the state object within a page), the warning counter excludes the overlay's own warning and says "since the overlay started", a real NaN test for `normalizeTuned`, the layout test checks y, the bench builds its steady state in setup, the docs' numbers corrected (Town range, bench outlier 3 of 4 runs, p99 ≤ 0.9 ms, one committed pile seed), EXPERIENCE.md's "sixth", and "kept in 3.6" notes on every reviewed value. `shop.test.ts` now starts the flock with the money five sales no longer cover.
- **Deviations not listed earlier:** the bench and pile scenario feed half the flock in the mixed case (Task 3.2 said every sheep hungry), because only a fed adult claims breeding food while food lies in the pen; and the probe's Farm rule compares the food in hand with the sheep at or below Fullness 65 (Task 4.1 said below `seekBelowFullness`), so it does not farm for sheep a piece would overfill.
- **Not changed:** alert ping timings (the 2.6 note "3.6: tuning the ping timings") are kept; no issue was reported.
- **For Phase B:** start with `npm run dev`, open the page, and play from the title. Backtick toggles the overlay; the record keeps going while it is closed. Use **Copy results** at the end of each run. The playtest checklist is Task 6; the candidates are in the Playtest Record.

### File List

- `_bmad-output/implementation-artifacts/3-6-mvp-pacing-playtest-and-tuning-pass.md` (new)
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/deferred-work.md`
- `_bmad-output/planning-artifacts/epics.md`
- `_bmad-output/planning-artifacts/gdds/gdd-sheep-civilization-2026-10-05/decision-log.md`
- `_bmad-output/planning-artifacts/gdds/gdd-sheep-civilization-2026-10-05/gdd.md`
- `_bmad-output/planning-artifacts/ux-designs/ux-sheep-civilization-2026-10-05/DESIGN.md`
- `_bmad-output/planning-artifacts/ux-designs/ux-sheep-civilization-2026-10-05/EXPERIENCE.md`
- `package.json`
- `src/config/constants.ts`
- `src/config/tuning.ts`
- `src/core/format.ts`
- `src/debug/DebugOverlay.ts`
- `src/debug/playtestRecord.ts` (new)
- `src/save/normalize.ts` (new)
- `src/save/saveFile.ts`
- `src/view/field/BetterPlace.ts`
- `src/view/field/Decorations.ts`
- `src/view/field/EraBackground.ts`
- `src/view/field/Fence.ts`
- `src/view/field/layout.ts` (new)
- `src/view/field/Market.ts`
- `src/view/field/PenCamera.ts`
- `src/view/hud/BottomBar.ts`
- `src/view/hud/FarmProgress.ts`
- `src/view/hud/ShopPanel.ts`
- `src/view/scenes/GameScene.ts`
- `src/view/strings.ts`
- `tests/config/tuning.test.ts`
- `tests/core/format.test.ts`
- `tests/perf/tick.bench.ts` (new)
- `tests/save/normalize.test.ts` (new)
- `tests/sim/scenarios/pacing.test.ts` (new)
- `tests/sim/scenarios/pile.test.ts` (new)
- `tests/sim/scenarios/shop.test.ts`
- `tests/view/field/layout.test.ts` (new)

### Change Log

- 2026-10-08: Code review (Blind Hunter, Edge Case Hunter, Acceptance Auditor): 4 decisions resolved by Rylan (waive human times; Land I $80 with a 10–15 min Town guard; accept the first-minute breeding; per-button bar invariant), 17 patches applied, 2 deferred, 6 dismissed. 612 tests pass; typecheck, lint and build clean. Status → done.

- 2026-10-08: Phase C: Rylan's decisions applied (`farmPipsPerFood` 8 → 6; breeding 8, Better Hoe Should and everything else kept). Pacing guards on (Village 3–5 min at 3 cps, Town ≤ 15 min at 6 cps); GDD, decision log, epics FR3/UX-DR29, DESIGN.md and EXPERIENCE.md updated; deferred-work swept. Status stays in-progress until the playtest record (AC 1, AC 6) is filled or waived.

- 2026-10-08: Phase A implemented: retune-safe pip bars, old-age copy and save loading; field layout checks in `npm test`; DEV playtest instruments (tick time, milestone record across reloads, warning count, +50 piles, Copy results); the tick benchmark (`npm run bench`), the pile scenario and the pacing probe with tuning candidates. Halted for the playtest (Phase B). Status stays in-progress.
