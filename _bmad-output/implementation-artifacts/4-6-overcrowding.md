---
baseline_commit: 2ea66de
---

# Story 4.6: Overcrowding

Status: done

<!-- Created 2026-10-09 by create-story. Sixth story of Epic 4 (Should tier). A full pasture risks disease: while living sheep ≥ 90% of capacity, every 30 s one random sheep has a 20% chance to become infected (FR34), and the flock counter turns `alert` with a crowd icon (UX-DR35). Most pieces exist: `infectSheep` (virus.ts) already says it is "the shared helper for carcass eating, overcrowding (4.6) and debug"; the infection look, ping, threat count, 20 s death and medicine cure all follow from `infectedAt`; step.ts already reserves the slot ("virus → abomination → overcrowding → autoFeeder → eras"); the architecture names the deadline `nextOvercrowdRollAt` and the file `src/sim/systems/overcrowding.ts`; `COMPONENTS.flockCounter.crowdedColor = 'alert'` is defined and FlockCounter's doc says "The crowded style (≥ 90 %, `alert`) is Story 4.6's". New: one system, three TUNING values, one GameState deadline (schema 11 → 12), a `crowded` selector shared by the sim and the HUD, the crowded counter style and a crowd icon. Key risks: (1) the new rng draws change the random sequence in any existing seeded test whose flock is crowded for ≥ 30 s (several tests fill the flock past capacity), so the whole suite must be re-run and each failure triaged; (2) the counter has no spare width, so the crowd icon replaces the sheep icon rather than sitting beside it. -->

## Story

As a player,
I want a crowded pasture to risk disease,
so that buying land matters and reaching an era feels risky.

## Acceptance Criteria

1. **The crowding rule (FR34).** The flock is *crowded* when living sheep (`state.sheep.length`, the Abomination included, pending lambs **not** counted) ≥ `TUNING.overcrowdFraction` (0.9) × `capacity(state)`. One pure selector decides it for both the sim and the HUD. At the current land table that is ≥ 9/10, ≥ 23/25, ≥ 45/50, ≥ 90/100.
2. **The roll (FR34).** `GameState.nextOvercrowdRollAt` is an absolute game-ms deadline, `TUNING.overcrowdIntervalMs` (30 s) after new game. On the first tick where `state.time >= nextOvercrowdRollAt`, the system sets `nextOvercrowdRollAt = state.time + overcrowdIntervalMs` and, **only if crowded**, draws `rng(state) < TUNING.overcrowdInfectChance` (0.2); on a hit it picks one random living sheep (`rngInt(state, 0, n − 1)`) and calls `infectSheep`. The infection is a normal one: `Infected` event, green tint + bubble marker + wobble, alert ping, infected count in the threat summary, death `virusDeathMs` (20 s) later through `killSheep(…, 'virus')` leaving a carcass, curable by medicine (4.5).
3. **Not crowded means no roll.** When the deadline passes while the flock is below 90%, the deadline is rescheduled and **no rng is drawn** and nobody is infected. Crowding that ends before the deadline means no roll at it; crowding that starts again rolls at the next deadline (the 30 s cadence never stops or restarts).
4. **Edge cases.** A picked sheep that is already infected keeps its first deadline and nothing is emitted (`infectSheep` already does this; the roll is spent). The Abomination can be picked and infected like any lamb (no secret field read). A sheep being dragged can be picked. A lost game never rolls (`step` already returns). The system allocates nothing per tick.
5. **Crowded flock counter (UX-DR35, EXPERIENCE "Crowded (≥ 90%)").** While crowded, the counter's "{alive}/{capacity}" turns `alert` (`COMPONENTS.flockCounter.crowdedColor`) and the crowd icon shows in place of the sheep icon; below 90% it returns to `bark` and the sheep icon. It changes on the frame crowding changes and does no work otherwise (no per-frame `setText`/`setColor`/`setFrame`). Never colour-only: colour **and** icon change together. Nothing else in the bar moves.
6. **Save (AR9).** `GameState.nextOvercrowdRollAt: number`. `SAVE_SCHEMA_VERSION` 11 → 12 with migration step `11` setting it to `time + overcrowdIntervalMs` (no rng). `validateState` requires an integer in `[0, time + overcrowdIntervalMs]`; `normalizeTuned` clamps it down after a shorter retune.
7. **No new copy, no audio.** No toast (the Voice table has none for overcrowding; the infection tells are the signal) and no sound (AudioDirector is 5.6; record the deferrals).
8. **Done = `npm test`, `npm run typecheck` and `npm run lint` all pass**, every pre-existing test that changed outcome is triaged as described in Task 5, and the browser checks in Task 8 pass.

## Tasks / Subtasks

- [x] **Task 1: Tuning, state, save (AC 2, 6)**
  - [x] 1.1 `src/config/tuning.ts`, after the virus values: `overcrowdFraction: 0.9`, `overcrowdIntervalMs: 30_000`, `overcrowdInfectChance: 0.2`, with a comment in the file's style: `// FR34 / GDD Overcrowding (Should tier): "While the flock is at 90% or more of capacity, every 30 s one random sheep has a 20% chance to become infected." (tune)`. Check `tests/config/tuning.test.ts` for a pinned GDD-values block and add them if prices/odds are pinned there. Update the `eraThresholds` comment only if it needs to point at the rule ("the player enters each era at full capacity" → crowded; already says so via the decision log).
  - [x] 1.2 `src/sim/state.ts`: `nextOvercrowdRollAt: number` on `GameState` (after `boostUntil` or beside `abomination`; not secret), doc: "Game-ms deadline of the next overcrowding roll (FR34, Story 4.6, overcrowding.ts): every overcrowdIntervalMs from new game, rescheduled whether or not the flock is crowded; a roll happens only while crowded." `createNewGame`: `nextOvercrowdRollAt: TUNING.overcrowdIntervalMs` (time is 0; **no rng draw**, so new-game positions/headings and the Abomination roll keep their draws).
  - [x] 1.3 `src/config/constants.ts`: `SAVE_SCHEMA_VERSION = 12`.
  - [x] 1.4 `src/save/migrations.ts`: step `11: (s) => …` — if `Number.isInteger(s.time)` set `nextOvercrowdRollAt: s.time + TUNING.overcrowdIntervalMs`, else return `s` unchanged (validation rejects it). Comment in the file's style ("Story 4.6: the first overcrowding roll comes a full interval after the load (FR34); no rng.").
  - [x] 1.5 `src/save/validate.ts`: `int(s, 'nextOvercrowdRollAt', 'state', 0, time + TUNING.overcrowdIntervalMs);` beside `boostUntil`, comment (FR34: at most one interval ahead; a due one is fine).
  - [x] 1.6 `src/save/normalize.ts`: `clampDown(state, 'nextOvercrowdRollAt', t + TUNING.overcrowdIntervalMs, true)` beside `boostUntil` (a shorter retune pulls a saved deadline in).
  - [x] 1.7 Tests (`tests/save/`): `migrations.test.ts` (a version-11 state gains `nextOvercrowdRollAt = time + overcrowdIntervalMs`; the chain from the oldest supported version reaches 12; update "current version" literals and `fromVersion8.ts` expectations if they assert the full shape); `validate.test.ts` (rejects missing, negative, fractional, string, and > time + interval); `normalize.test.ts` (a deadline beyond `time + overcrowdIntervalMs` is clamped down; one inside is kept); `busy.ts` includes the field; `roundTrip.test.ts` stays green.

- [x] **Task 2: The crowded selector and HudView (AC 1, 5)**
  - [x] 2.1 `src/sim/selectors.ts`, next to `capacity`/`slotsUsed`:
    - `export function crowdedAt(alive: number, cap: number): boolean { return alive >= cap * TUNING.overcrowdFraction; }` — doc: FR34 / UX-DR35, living sheep only (pending lambs hold a slot, AR21, but are not alive; the counter shows the same number), so the HUD and the sim agree.
    - `export function isCrowded(state: GameState): boolean { return crowdedAt(state.sheep.length, capacity(state)); }`
  - [x] 2.2 `HudView.crowded: boolean` ("≥ 90% of capacity: the flock counter's crowded style (UX-DR35) and the overcrowding roll (FR34)"), filled in `selectHudView` from `out.flock`/`out.capacity` via `crowdedAt`. `HudScene`'s initial `view` object gains `crowded: false`.
  - [x] 2.3 Tests `tests/sim/selectors.test.ts`: `crowdedAt` boundaries for **every** `TUNING.landCapacities` entry, computed from TUNING (`Math.ceil(cap * overcrowdFraction)` is crowded, one less is not) — this also proves there is no float edge at 0.9 × 25 etc.; `isCrowded` ignores pregnancies (9 sheep + 1 pregnancy at 10 → crowded; 8 + 2 → not); `selectHudView(...).crowded`.

- [x] **Task 3: The system (`src/sim/systems/overcrowding.ts`, new) (AC 2–4)**
  - [x] 3.1 Header comment in the systems' style: FR34 / GDD Overcrowding; the deadline cadence; rolls only while crowded (`isCrowded`); infection through `infectSheep` (virus.ts), so tells, ping, death and the medicine cure are the virus's; the era thresholds equal capacities on purpose (decision log "Overcrowding at era thresholds"), so entering an era is risky; plain code, no allocation; never reads a secret field.
  - [x] 3.2 `export function updateOvercrowding(state: GameState): void`:
    ```ts
    if (state.time < state.nextOvercrowdRollAt) return;
    state.nextOvercrowdRollAt = state.time + TUNING.overcrowdIntervalMs;
    if (!isCrowded(state)) return;            // AC 3: no draw
    if (rng(state) >= TUNING.overcrowdInfectChance) return;
    const sheep = state.sheep;                 // crowded implies ≥ 1 sheep (capacity ≥ 1)
    infectSheep(state, sheep[rngInt(state, 0, sheep.length - 1)]);
    ```
    Keep the draw order (chance, then victim) so tests can predict it; guard `sheep.length > 0` with an `invariant` or an early return (capacity is never 0 in the table, but be safe).
  - [x] 3.3 `src/sim/step.ts`: import and register `updateOvercrowding` right after `updateAbomination` (before `updateEras`), matching the order comment; add a line to the order comment (it rolls on the tick's flock after virus and Abomination deaths, so a sheep that just died is never picked and a just-emptied pen is not crowded).
  - [x] 3.4 `virus.ts`: update the `infectSheep` doc ("overcrowding (4.6)" → past tense, `overcrowding.ts`). `state.ts` `infectedAt` doc: add overcrowding as a cause if it lists causes.
  - [x] 3.5 Tests `tests/sim/systems/overcrowding.test.ts` (unit; build state with `newGame(seed)` + `fillFlock`, call `updateOvercrowding` directly or `runFor`):
    - New game: `nextOvercrowdRollAt === TUNING.overcrowdIntervalMs`.
    - Before the deadline: nothing, rng unchanged.
    - Not crowded at the deadline (e.g. 8/10): deadline → `time + interval`, rng unchanged, no `Infected`.
    - Crowded at the deadline: predict with a probe copy of the rng (`const probe = { rng: state.rng }; const hit = rng(probe) < chance; const victim = hit ? rngInt(probe, 0, n − 1) : -1`), then assert the outcome matches (state.rng === probe.rng; on a hit `infectedAt === time` on that sheep and exactly one `Infected`). Find seeds that give both a hit and a miss and test both (so neither branch is vacuous).
    - Odds sanity: over many rolls (e.g. loop 500 deadlines on a crowded flock, curing/clearing `infectedAt` between rolls) the hit rate is within a loose band around `overcrowdInfectChance` (e.g. 0.15–0.25).
    - Already-infected victim: forced by infecting every sheep first → no new event, every `infectedAt` unchanged, rng still advanced (the roll was spent).
    - Crowding ends: crowded, then sheep removed to below 90% before the deadline → no roll at it; crowded again → rolls at the next one.
    - Abomination: an infected Abomination (`makeAbomination`) stays the Abomination; the system never reads `isAbomination` (no special case needed, just the outcome test).
    - Lost game: `step` on a lost state does not move the deadline.
  - [x] 3.6 Scenario `tests/sim/scenarios/overcrowding.test.ts`: a full Pasture (10/10, kept fed — reuse the pattern other scenarios use to stop starvation interfering, e.g. topping `fullness` or long-lived adults within the run) run for several intervals until an overcrowding infection happens, then `runFor(TUNING.virusDeathMs)`: the victim dies with cause `virus` and leaves a carcass. **Paired:** the same seed at 8/10 over the same time has no infection from overcrowding. Plus: an overcrowding infection is cured by `ApplyMedicine` (dose set by hand) and the sheep survives the virus window.

- [x] **Task 4: The HUD (AC 5)**
  - [x] 4.1 Art: `assets/art/ui/icon-crowd.png`, 14×12 like `icon-sheep.png` (shown at 2×), [ASSUMPTION] two overlapping sheep (back one `wool-shade`, front one `wool`, `bark` outline, an `alert` accent such as the front sheep's outline or a small mark) so it reads as "many" and differs from the sheep icon in shape, not only colour. Same throwaway scratchpad encoder approach as 4.5 Task 4.1; commit only the PNG. `npm run assets` → regenerate `public/assets/atlases/ui.{png,json}`. `FRAME.iconCrowd: 'icon-crowd'` in `assetKeys.ts` (comment: the crowded flock counter, UX-DR35, Story 4.6). Add it to the placeholder row of `assets/CREDITS.md`.
  - [x] 4.2 `src/view/hud/FlockCounter.ts`: keep a reference to the icon `Image`; `set(alive, capacity, crowded)` — text as today (setText only when a number changes); on a `crowded` change only: `text.setColor(<hex of COMPONENTS.flockCounter.crowdedColor | textColor>)` and `icon.setFrame(crowded ? FRAME.iconCrowd : FRAME.iconSheep)`. Colours from tokens (`COLORS` lookup the way `textStyle` does), no hex literals. Update the class doc (remove "is Story 4.6's"). The `BOX_W` invariant is unchanged (same text, same font).
  - [x] 4.3 `HudScene.refresh`: `this.bar.flock.set(v.flock, v.capacity, v.crowded)`.
  - [x] 4.4 Layout: **no change**. The crowd icon takes the sheep icon's 28 px; the flock counter stays 684–804 and the `FLOCK_X + FLOCK_COUNTER_W <= THREAT_X − GROUP_GAP` invariant still holds (only 12 px spare, so nothing may be added beside the counter). If the browser check shows the swap reads badly, record it in deferred-work rather than re-spacing the bar.

- [x] **Task 5: Regression triage of existing seeded tests (AC 8)**
  - [x] 5.1 Before any change, run `npm test` on `2ea66de` and record the pass count (4.5 ended at 774 passed, 1 skipped).
  - [x] 5.2 After registering the system, re-run. Any test whose flock is crowded (≥ 90% of its capacity) for ≥ 30 s of `runFor` now draws extra rng and may infect a sheep. Likely candidates (they use `fillFlock` or reach era thresholds): `tests/sim/scenarios/{wander100,pacing,eras,land,pile,boost,feeding,carcass,virus,killCycle,abominationTells,decorations,shop,medicine}.test.ts`, `tests/sim/systems/{movement,breeding,eras,medicine}.test.ts`, `tests/save/busy.ts`, `tests/perf/tick.bench.ts`.
  - [x] 5.3 For each failure decide, and note it in the Debug Log: (a) the test is about something else and a crowded flock is incidental → opt out with a test helper `noOvercrowding(state)` in `tests/sim/helpers.ts` that sets `state.nextOvercrowdRollAt = Number.MAX_SAFE_INTEGER` (doc: test-only, never in a save round trip; validation would reject it), or fill to below 90% / buy land; (b) the test is a whole-game simulation where overcrowding is part of the design (`pacing.test.ts`, the 3.6 tuning pass) → keep the rule on and update the expectation with a comment, or opt out with a stated reason if the test pins pre-Should balance. Never weaken an assertion just to pass; never re-type a literal instead of TUNING.
  - [x] 5.4 `tests/perf/tick.bench.ts` (`npm run bench`): the system is O(1) per tick except the victim lookup; confirm the tick mean at 100 sheep is unchanged.

- [x] **Task 6: DEV tool (optional, small)**
  - [x] 6.1 `src/debug/DebugOverlay.ts` abomination/threat row: a "Crowd roll now" button that sets `state.nextOvercrowdRollAt = state.time` (rolls next tick, still 20% and only if crowded), DEV-gated like "Kill now". With "+N sheep" this makes the browser check practical. Optional; "Infect one" already covers the infection look.

- [x] **Task 7: Docs (AC 7)**
  - [x] 7.1 `_bmad-output/game-architecture.md`: the systems table row for Overcrowding (built: `updateOvercrowding`, `nextOvercrowdRollAt` top-level, fixed 30 s cadence, rolls only while crowded, `crowdedAt`/`isCrowded` shared with the HUD); schema 12; step order.
  - [x] 7.2 `deferred-work.md`: mark resolved "Crowded flock counter (Story 4.6)" (crowd icon replaces the sheep icon; colour + icon) and the 4.5 entry "Overcrowding (Story 4.6)". Add "Deferred from: story 4-6-overcrowding": **5.6** an optional cue when the flock becomes crowded (none in UX-DR88); **5.10** watch whether players notice the crowded counter before the first roll and whether 20%/30 s bites at era entry as intended; **5.4** no stat for overcrowding infections (FR36 has none); **5.8** the crowd icon is a placeholder; plus any pre-existing tests opted out in Task 5 with the reason.
  - [x] 7.3 Story file, `sprint-status.yaml` and `deferred-work.md` in the same commit as the code (repo pattern: "Implement story 4.6: Overcrowding").

- [x] **Task 8: Browser check (AC 2, 5, 8)**
  - [x] 8.1 `npm run dev`. Fresh game (3/10): counter `bark` with the sheep icon. DEV "+N sheep" to 8/10: unchanged. To 9/10: numbers `alert`, crowd icon, on the same frame; nothing else in the bar moves. Back to 8 (sell one): style returns.
  - [x] 8.2 Crowded, run at ×16 (or "Crowd roll now"): within a few rolls a sheep turns green with marker, wobble and ping, the threat summary's infected count rises, it dies 20 s later leaving a carcass. Medicine cures one.
  - [x] 8.3 Buy Land I at 10/10: counter "10/25" returns to `bark`/sheep icon; no more infections from crowding.
  - [x] 8.4 Both window sizes (1280×720, 960×540): "100/100" in `alert` with the crowd icon still fits before the threat summary.
  - [x] 8.5 Save while crowded, reload: style and cadence resume (next roll ≤ 30 s later). `npm run build`; no DEV strings in `dist/`.

### Review Findings

- [x] [Review][Patch] `crowdedAt` can miss the exact threshold after a retune (float: 0.56 × 25 = 14.000000000000002, so 14/25 is not crowded); the test's `Math.ceil(cap * fraction)` has the same error and would agree [src/sim/selectors.ts:208]
- [x] [Review][Patch] The step test checks only that the deadline moved, not that a roll infected anyone; use a hit seed and assert the infection after `step` [tests/sim/systems/overcrowding.test.ts]
- [x] [Review][Patch] Nothing tests the order claim (a virus death on the deadline tick that takes the flock below 90% means no roll); reordering `SYSTEMS` would fail nothing [src/sim/step.ts:35]
- [x] [Review][Patch] The "already-infected pick" test never asserts its roll hit (`p.hit`), so its precondition is implicit [tests/sim/systems/overcrowding.test.ts]
- [x] [Review][Patch] DEV "Crowd roll now" reports "due now" on a lost game, where no roll can happen ("Kill now" checks its precondition first) [src/debug/DebugOverlay.ts]
- [x] [Review][Patch] Dev Agent Record: "only 2 pre-existing tests changed" leaves out the type-only `crowded: false` fixture edits in `market.test.ts` / `sacrifice.test.ts`, and the odds test's deviation from Task 3.5 (2000 rolls, ±0.03 instead of ~500, 0.15–0.25) is not noted [_bmad-output/implementation-artifacts/4-6-overcrowding.md]

## Dev Notes

### What this story is (and is not)

- **Is:** one sim system (`overcrowding.ts`), three TUNING values, one deadline in GameState (schema 12), a shared `crowdedAt`/`isCrowded` selector, `HudView.crowded`, the crowded flock-counter style with a placeholder crowd icon, tests, and triage of seeded tests that the new rng draws affect.
- **Is not:** a new infection kind (it is the virus), a toast or sound, a stat, any change to capacity, breeding, eras or medicine, Better Hoe (4.7) or the Auto-feeder (4.8).

### Current code to build on (read these first)

| File | Today | This story |
|---|---|---|
| `src/sim/systems/virus.ts` | `infectSheep(state, s)` sets `infectedAt`, emits `Infected`; no-op if already infected. Doc names overcrowding (4.6) as a caller. `updateVirus` kills at `infectedAt + virusDeathMs`. | doc only; called by the new system |
| `src/sim/step.ts` | `SYSTEMS` = movement, feeding, carcassEating, hunger, lifecycle, virus, abomination, eras; comment reserves "abomination → overcrowding → autoFeeder → eras" | register `updateOvercrowding` after `updateAbomination` |
| `src/sim/systems/abomination.ts` | the model for a deadline-driven system: `nextKillAt` absolute deadline, `rng`/`rngInt` draws, plain loops | pattern only; **no change** |
| `src/sim/rng.ts` | `rng(state)` [0,1), `rngInt(state, min, maxInclusive)` | use |
| `src/sim/selectors.ts:206–215` | `capacity(state)` = `landCapacities[landTier]`; `slotsUsed` = sheep + pregnancies | add `crowdedAt`, `isCrowded` |
| `src/sim/selectors.ts:480–527` | `HudView` (`flock`, `capacity`, …), `selectHudView` fills in place | `crowded` |
| `src/sim/state.ts:164–209` | `GameState` (`boostUntil`, `abomination.nextKillAt`, `medicine`…), `createNewGame` (no rng drawn before founders) | `nextOvercrowdRollAt` |
| `src/save/{migrations,validate,normalize}.ts` | schema 11; step 10 adds `medicine`; `nextKillAt` validated `[0, time + max]` and clamped by `normalizeTuned` | step 11, validation, clamp |
| `src/config/tuning.ts:70–95` | `landCapacities [10,25,50,100]`, `eraThresholds [10,25,50]` (comment cites the overcrowding decision), `virusDeathMs` | three new values |
| `src/config/constants.ts:327` | `COMPONENTS.flockCounter { textColor: 'bark', crowdedColor: 'alert', typography: 'numeric' }` | use `crowdedColor` |
| `src/view/hud/FlockCounter.ts` | icon `Image` (not kept), `Text`, `set(alive, capacity)` with change detection; `BOX_W` 88 fits "100/100" | keep icon ref, `crowded` param |
| `src/view/hud/BottomBar.ts:55–75` | flock counter at `FLOCK_X` (684–804), threat summary at 816; invariant | **no change** |
| `src/view/scenes/HudScene.ts:160` | `this.bar.flock.set(v.flock, v.capacity)` | pass `v.crowded` |
| `src/view/field/SheepSprite.ts` | infection look and ping follow `PublicSheep.infected` | **no change** |
| `src/debug/DebugOverlay.ts` | "+N sheep", "Infect one", "Kill now" | optional "Crowd roll now" |

### What must be preserved

- **The virus pipeline.** Overcrowding only calls `infectSheep`; it never sets `infectedAt` itself, never kills, never emits its own event. Carcass eating still infects 100%; medicine still cures any infection.
- **Determinism and existing rng sequences when not crowded.** No rng draw unless the deadline is reached **and** the flock is crowded. `createNewGame` draws nothing new. A non-crowded game's random sequence is byte-identical to before.
- **Secrecy (AR18).** The system reads no `isAbomination`/`stalk`/`doomedAt`/`state.abomination`. An infected Abomination is infected like a lamb; nothing leaks through events.
- **No allocation per tick** in `updateOvercrowding` and `selectHudView`; no per-frame text/colour/frame changes in `FlockCounter`.
- **Bar layout** and its invariants (4.5 re-spaced it; 12 px spare after the counter).
- **One definition of crowded.** The sim and HUD both use `crowdedAt` with the same inputs (living sheep, land capacity), so the counter turns red exactly when rolls are live.

### Design decisions (defaults chosen; see Open Questions)

- **Fixed 30 s cadence from new game**, rescheduled at every deadline whether crowded or not, with the roll only while crowded. It matches the AC wording ("when `nextOvercrowdRollAt` is reached"; "when the next roll would occur, no roll happens"), needs no "crowding started" bookkeeping, and saves as one integer. Consequence: a flock that turns crowded 1 s before a deadline can roll 1 s later; that is a 20% chance and fits "reaching an era should feel risky".
- **Living sheep only** (pending lambs excluded), per the AC's "living sheep" and so the red counter shows the same number it judges.
- **Victim among all living sheep** (GDD: "one random sheep"); an already-infected pick spends the roll. Picking among healthy sheep only would be slightly harsher; not chosen.
- **Chance first, then victim:** a miss draws one number, a hit two.
- **Top-level `nextOvercrowdRollAt`** (the architecture's name and list of absolute deadlines), not secret, not nested.
- **Crowd icon replaces the sheep icon** (no room beside it: 12 px spare before the threat summary, and "100/100" fills the 88 px box).
- **No toast, no sound.** The infection's own tells, ping and threat count carry it; the red counter is the warning.

### Architecture compliance

- New rule → `src/sim/systems/overcrowding.ts` exporting `updateOvercrowding(state)`, registered in `step.ts` in the documented order (architecture systems table: "Overcrowding | `src/sim/systems/overcrowding.ts` | 90% capacity infection rolls").
- Timers are absolute deadlines in state (`nextOvercrowdRollAt`, named in the architecture's deadline list); no countdowns, no Phaser timers.
- Seeded rng in state (ADR-4); no `Math.random`/`Date.now`.
- Systems never call each other; `infectSheep` is the virus's shared helper (allowed exception), `isCrowded` a selector.
- New tunables → `TUNING`; schema change → bump + migration + validation + normalize.
- View reads `HudView` only; colours via `COMPONENTS`/`COLORS` tokens.

### Library / framework notes

- Phaser **4.2.1** (installed). Only `Text.setColor` and `Image.setFrame` are new to this widget; both exist in v4 (check `node_modules/phaser/types/phaser.d.ts` if in doubt). No tint or filter work.
- No new packages; no web research needed.

### Testing standards

- Vitest for `src/sim/` and `src/save/` only; the counter style is browser-checked.
- `newGame(seed)`, `fillFlock`, `createSheep`, `infectSheep`, `makeAbomination`, `applyCommand`, `runFor` in `TICK_MS` steps (`tests/sim/helpers.ts`). Assert on state and drained events; use `TUNING.overcrowdIntervalMs`, `overcrowdInfectChance`, `overcrowdFraction`, `virusDeathMs`, `landCapacities` — never literals.
- Predict rng outcomes with a probe copy (`{ rng: state.rng }`) rather than hard-coding seeds' results; still test a hit and a miss.
- Pair the scenario (crowded vs not) so "no infection" cannot pass vacuously (4.2/4.4/4.5 lesson).
- Save tests stay mandatory and green.

### Previous story intelligence (4.5 and earlier)

- 4.5 (Medicine): `infectSheep` infections are cured by `ApplyMedicine` with no extra work (deferred-work note written for this story). The bar was re-spaced (Farm 160 px); the flock counter is at 684–804 with 12 px to the threat summary. Review lessons: stale comments, one-frame ordering, vacuous tests, and recording built signatures that differ from the task text in the Dev Agent Record.
- 4.3 (Kill cycle): the pattern for a deadline field (`nextKillAt`): migration rolls/sets from the save's `time`, validation `[0, time + max]`, `normalizeTuned` clamp. Secret fields set by hand in tests.
- 4.1: `createNewGame` keeps the founders' draws first; do not insert a draw before them.
- 3.6 (pacing): `tests/sim/scenarios/pacing.test.ts` simulates whole-game pacing with eras at capacity thresholds — the most likely test to change; overcrowding at era entry is deliberate (decision log).
- 3.3: the flock counter's box was sized for "100/100" and browser-checked at both window sizes.
- Pattern from every story: code, story file, `deferred-work.md` and `sprint-status.yaml` in one "Implement story 4.6: Overcrowding" commit; review fixes in a separate commit.

### Git intelligence

- Recent: `2ea66de` 4.5 Medicine (schema 10 → 11, `medicine.ts`, MedicineSlot, MedicineDrag), `8e0283a` 4.4, `4a25830` 4.3 (schema 9 → 10, `nextKillAt` migration), `c224c83` 4.2, `e3ef9aa` 4.1.
- Branch: `story-4.6` (created from `main` at `2ea66de`).

### Open questions (defaults chosen; confirm or change)

1. **Cadence:** fixed 30 s clock from new game (default) vs a clock that starts when crowding starts (first roll 30 s after reaching 90%, reset when crowding ends). The latter is gentler and needs the deadline set/cleared on crowding changes.
2. **Victim pool:** any living sheep (default, GDD wording) vs healthy sheep only.
3. **Crowd icon:** replaces the sheep icon (default; no room) vs a small badge overlapping the sheep icon's corner.
4. **Warning:** no toast or sound when the flock first becomes crowded (default). Alternative: a Voice line such as "It's getting crowded." (needs copy approval; no "!").

### Project Structure Notes

- New: `src/sim/systems/overcrowding.ts`, `assets/art/ui/icon-crowd.png`, `tests/sim/systems/overcrowding.test.ts`, `tests/sim/scenarios/overcrowding.test.ts`.
- Modified: `src/config/{tuning,constants}.ts`, `src/sim/{state,selectors,step}.ts`, `src/sim/systems/virus.ts` (comment), `src/save/{migrations,validate,normalize}.ts`, `src/view/assetKeys.ts`, `src/view/hud/FlockCounter.ts`, `src/view/scenes/HudScene.ts`, optionally `src/debug/DebugOverlay.ts`, `assets/CREDITS.md`, `public/assets/atlases/ui.{png,json}` (regenerated), tests under `tests/save/` and `tests/sim/` (incl. `helpers.ts` if `noOvercrowding` is added), `_bmad-output/game-architecture.md`, `deferred-work.md`, `sprint-status.yaml`.
- `SAVE_SCHEMA_VERSION` 11 → 12.

### Project Context Rules (from `_bmad-output/project-context.md`)

- **Layers:** `src/sim/` pure TS (no Phaser, no `Math.random`, no `Date.now`); the view never mutates `GameState`.
- **New game rule** → `src/sim/systems/<system>.ts` exporting `update<System>(state)`, registered in the fixed order in `step.ts`; systems never call each other (shared helpers like `infectSheep` are the exception).
- **Timers are absolute game-ms deadlines** (`…At` suffix); never countdowns or Phaser timers.
- **State is plain JSON;** adding a field means bumping `SAVE_SCHEMA_VERSION` with a migration and validation.
- **Never store derived values:** "crowded" is derived every time, never stored.
- **Hard-coded GDD numbers are a listed mistake:** read `TUNING`.
- **The Abomination is secret;** view code uses `PublicSheep`/`HudView` only.
- **Infection is never colour-only** (unchanged: the virus look); the crowded counter is colour + icon.
- **Colours** from `COLORS`/`COMPONENTS` tokens; no hex literals in components.
- **HUD numbers** change text only on value change; no per-frame `setText`.
- **No allocation in hot paths;** selectors once per frame.
- **Tests:** fixed seeds, `runFor` in `TICK_MS`, assert on state and events, `TUNING` values; one scenario when systems interact (overcrowding → virus → carcass; overcrowding → medicine).
- **Done** = `npm test`, `npm run typecheck`, `npm run lint` green; rendering checked in the browser.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 4.6: Overcrowding]
- [Source: _bmad-output/planning-artifacts/epics.md#Requirements Inventory] FR34, FR15, FR26; UX-DR35; AR9, AR18, AR21
- [Source: _bmad-output/planning-artifacts/gdds/gdd-sheep-civilization-2026-10-05/gdd.md#Overcrowding (Should tier)], #Upgrade Trees (Synergies), #Difficulty curve
- [Source: _bmad-output/planning-artifacts/gdds/gdd-sheep-civilization-2026-10-05/decision-log.md] "Overcrowding at era thresholds: kept as deliberate pressure"; Should-tier values
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-sheep-civilization-2026-10-05/DESIGN.md] `flock-counter` (`crowdedColor: alert`); `alert` token use "crowded flock"
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-sheep-civilization-2026-10-05/EXPERIENCE.md] Component Patterns (Flock counter); State Patterns ("Crowded (≥ 90%)"); journey step 9
- [Source: _bmad-output/game-architecture.md] systems table (Overcrowding); deadline list (`nextOvercrowdRollAt`); ADR-4 seeded RNG; tuning location
- [Source: _bmad-output/implementation-artifacts/deferred-work.md] "Crowded flock counter (Story 4.6)", 4.5's "Overcrowding (Story 4.6)", "A crowded bottom bar"
- [Source: _bmad-output/implementation-artifacts/4-5-medicine.md], [4-3-the-kill-cycle.md], [3-6-mvp-pacing-playtest-and-tuning-pass.md], [3-3-buy-land-and-grow-the-fence.md]
- [Source: _bmad-output/project-context.md]

## Dev Agent Record

### Agent Model Used

Claude Opus 5.5 (claude-opus-5-5[1m])

### Implementation Plan

- Sim: three TUNING values (`overcrowdFraction` 0.9, `overcrowdIntervalMs` 30 s, `overcrowdInfectChance` 0.2). `GameState.nextOvercrowdRollAt` (top-level, set to one interval at new game with no rng draw; schema 12, migration 11 = `time + interval`, validation `[0, time + interval]`, `normalizeTuned` clamp). `selectors.ts` `crowdedAt(alive, cap)` / `isCrowded(state)` (living sheep only) and `HudView.crowded`. `systems/overcrowding.ts` `updateOvercrowding`: at the deadline, reschedule; if crowded, draw the chance, then on a hit a random living sheep → `infectSheep`. Registered after `updateAbomination`, before `updateEras`.
- View: `FlockCounter.set(alive, capacity, crowded)` swaps the text colour (`COMPONENTS.flockCounter.crowdedColor`) and the icon frame (`icon-crowd`) only when `crowded` changes. New 14×12 placeholder `icon-crowd.png` in the `ui` atlas.
- DEV: "Crowd roll now" sets the deadline to now (still the real roll).

### Debug Log References

- **Baseline (2ea66de):** 774 passed, 1 skipped. **After:** 798 passed, 1 skipped (+24: 10 overcrowding unit, 2 scenario, 3 crowding selectors, 1 tuning, 2 migration, 5 validation, 1 normalize). Typecheck and lint clean.
- **Red checks:** with `src/save/` reverted to HEAD and the schema at 11, 16 save tests failed (new migration, validation, normalize cases, and the migration-chain tests via `fromVersion8`). With `updateOvercrowding` removed from `step.ts`, 3 tests failed (both scenario tests and the step/lost-game unit test). The system tests failed before `overcrowding.ts` existed. The scenario is paired (10/10 infects and kills; 8/10 over the same time has no infection, no death, no carcass).
- **One test fixed in itself:** the "infects the Abomination" unit test first predicted the roll before `makeAbomination`, which draws its first visit from the rng; it now makes the Abomination first and searches seeds for a roll that hits it.
- **Task 5 triage:** only 2 pre-existing tests changed outcome (besides type-only `crowded: false` additions to the `HudView` fixtures in `tests/sim/scenarios/market.test.ts` and `sacrifice.test.ts`, needed for the new field). `tests/sim/state.test.ts` pins the GameState field list (added `nextOvercrowdRollAt`). `tests/sim/scenarios/abominationTells.test.ts` seed 3 failed: 21 sheep in the 10-sheep pen are crowded, and the roll at 30 s drew rng between its paired spacing runs. It is a spacing-only test, so it opts out like it already does for the kill cycle (`state.nextOvercrowdRollAt = Number.MAX_SAFE_INTEGER`, inline, beside `nextKillAt`). **Deviation from Task 5.3:** no shared `noOvercrowding` helper was added; one inline line beside the existing opt-out reads better for a single user. `pacing.test.ts`, `wander100`, `eras`, `land` and the rest stayed green with the rule on (no assertion changed).
- **Deviation (Task 3.5 odds test):** 2000 rolls with a ±0.03 band around `overcrowdInfectChance` instead of ~500 rolls and 0.15–0.25: stricter, still deterministic.
- **Bench (`npm run bench`, 100 sheep at Land III):** tick means 0.05–0.21 ms, unchanged against 3.6's ≤ 0.21 ms.
- **Browser (Task 8):** a scratchpad Playwright probe on the DEV server (GameScene exposed by patching its prototype from the page, no source change), 10 checks, passing at 1280×720 and at 960×540: fresh 3/10 `bark` + sheep icon; 8/10 unchanged; 9/10 `#E8503A` + `icon-crowd`; back to 8/10 restores; at 10/10 "Crowd roll now" infects a sheep within a few rolls, the threat summary counts 1, the next roll is 29.7 s ahead; at ×16 it dies of the virus and leaves a carcass; Land I 10/25 is `bark`; Land III 100/100 is crowded and the text ends at x 803 (≤ 804, before the threat summary); a save while crowded (23/25) reloads crowded with the next roll ≤ 30 s ahead. No console errors. Screenshots of the bar (9/10 and 100/100) read clearly: two sheep beside red numbers.
- **Build:** `npm run build` passes (the existing chunk-size warning only); "Crowd roll now", "Kill now" and "Make Abomination" are not in `dist/`; `icon-crowd` is in the built atlas.

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created
- Implemented overcrowding (FR34): while living sheep ≥ 90 % of land capacity, a roll every 30 s (a fixed clock from new game) has a 20 % chance to infect one random living sheep through the virus's own `infectSheep`, so the tint, marker, wobble, ping, threat count, 20 s death and the medicine cure all apply unchanged. Not crowded at a deadline: rescheduled, no rng draw.
- Crowded flock counter (UX-DR35): numbers in `alert` and a crowd icon in place of the sheep icon, from the same `crowdedAt` rule as the roll; no layout change.
- Save schema 12 (`nextOvercrowdRollAt`), with migration, validation and normalize.
- Open Question defaults kept: fixed cadence, victim among all living sheep (an infected pick spends the roll), icon swap, no toast or sound.
- Optional DEV button "Crowd roll now" added (Task 6).
- Code review (2026-10-09): 6 patches applied — `crowdThreshold(cap, fraction)` (rounds up after nudging the float product down, so a retune such as 0.56 × 25 = 14.000000000000002 still makes 14/25 crowded; tested with literals); the step test now proves a deadline tick infects exactly one sheep in ~20% of 200 seeds; a new ordering test (a virus death on the deadline tick leaves the flock below 90%: no roll in 200 seeds; red-checked by moving overcrowding before the virus); the already-infected test asserts its hit; "Crowd roll now" refuses on a lost game; these notes. 0 deferred, 7 dismissed.

### File List

- `src/sim/systems/overcrowding.ts` (new)
- `assets/art/ui/icon-crowd.png` (new)
- `tests/sim/systems/overcrowding.test.ts` (new)
- `tests/sim/scenarios/overcrowding.test.ts` (new)
- `src/config/constants.ts`
- `src/config/tuning.ts`
- `src/sim/state.ts`
- `src/sim/selectors.ts`
- `src/sim/step.ts`
- `src/sim/systems/virus.ts`
- `src/save/migrations.ts`
- `src/save/validate.ts`
- `src/save/normalize.ts`
- `src/view/assetKeys.ts`
- `src/view/hud/FlockCounter.ts`
- `src/view/scenes/HudScene.ts`
- `src/debug/DebugOverlay.ts`
- `assets/CREDITS.md`
- `public/assets/atlases/ui.json` (regenerated)
- `public/assets/atlases/ui.png` (regenerated)
- `tests/config/tuning.test.ts`
- `tests/save/busy.ts`
- `tests/save/fromVersion8.ts`
- `tests/save/migrations.test.ts`
- `tests/save/normalize.test.ts`
- `tests/save/validate.test.ts`
- `tests/sim/selectors.test.ts`
- `tests/sim/state.test.ts`
- `tests/sim/scenarios/abominationTells.test.ts`
- `tests/sim/scenarios/market.test.ts`
- `tests/sim/scenarios/sacrifice.test.ts`
- `_bmad-output/game-architecture.md`
- `_bmad-output/implementation-artifacts/deferred-work.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/4-6-overcrowding.md`

## Change Log

- 2026-10-09: Story 4.6 implemented. Overcrowding: 20 % every 30 s at ≥ 90 % of capacity (`overcrowding.ts`, `nextOvercrowdRollAt`, schema 12), crowded flock counter (`alert` + crowd icon), DEV "Crowd roll now". Gates: 798 passed, 1 skipped; typecheck and lint clean; browser probe 10/10 at both window sizes; build clean.
- 2026-10-09: Code review: 6 patches applied (float-safe `crowdThreshold`, roll-in-step and ordering tests, hit precondition, DEV lost-game guard, notes), 0 deferred, 7 dismissed. Gates: 801 passed, 1 skipped; typecheck, lint, build clean. Status → done.
