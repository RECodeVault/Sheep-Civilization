---
baseline_commit: 2ca9296
---

# Story 5.4: Stats Panel

Status: done

<!-- Created 2026-10-13 by create-story. Branch `story-5.4` off `main` at 2ca9296 (Story 5.7 done).
The sim already keeps every counter this story needs: `GameState.stats { died, sold, sacrificed, moneyEarned, peakFlock }`
exists since Epic 1/3, is updated in `killSheep` / `removeSheep` (`src/sim/systems/carcass.ts`) and `sell` (`market.ts`),
is validated on load (`src/save/validate.ts` STAT_COUNTS) and is part of every save. "Alive" is derived (`state.sheep.length`).
So this story is a view story: a `StatsPanel` in place of the pause menu's "Coming soon." placeholder, a small
selector to read the numbers, strings, and tests that pin the counters and their save round trip.
It does NOT add: new `GameState` fields, a `SAVE_SCHEMA_VERSION` bump (stays 12), deaths by cause, a boost count,
names (5.3), the Credits panel (5.9 — keeps `PlaceholderPanel`), or a Stats entry on the title screen. -->

## Story

As a player,
I want a stats panel in the pause menu,
so that I can see the story of my flock.

## Acceptance Criteria

1. **The Stats panel (FR36, UX-DR16, UX-DR20).** Given the pause menu, when I click **Stats**, then the "Coming soon." placeholder is replaced by a `StatsPanel`: a wool `panel` headed "Stats" (title type), then five rows in this order — **Alive**, **Sold**, **Died**, **Sacrificed**, **Money earned** — each with its label in label type on the left and its value in numeric type right-aligned on the right, then **Back** (`button-menu`). The sim stays paused while it is open. **Back** and `Esc` return to the pause menu (Esc chain step 2, UX-DR73). The scrim swallows clicks outside the panel. **Credits** still opens the placeholder.
2. **The numbers are the truth.** Each time the panel opens it shows the current values: Alive = living sheep right now (`state.sheep.length`, the same number as the flock counter's left side; pending lambs and carcasses are not alive); Sold = `stats.sold`; Died = `stats.died` (every non-sacrifice death, whatever the cause); Sacrificed = `stats.sacrificed`; Money earned = `stats.moneyEarned` shown with `formatMoney` (e.g. "$130"). Money spent in the shop never lowers it, and the DEV "Add money" never raises it.
3. **Counters update and survive save/load.** Given sheep are sold, die (starvation, old age, virus, the Abomination's victim) or are sacrificed and money is earned, then each counter goes up by exactly one per event (money by the sale price), and the values survive a save → load (encode/decode, autosave, Continue, Main Menu → Continue). A new game (Restart → Start over, Lose → Restart, New Game) starts them at 0.
4. **Secrecy (UX-DR64, AR18).** The panel never distinguishes the Abomination: no "Abomination" line, no deaths-by-cause; its victims count in Died like any death, a sacrificed Abomination counts in Sacrificed like any sacrifice, and a living Abomination counts in Alive like any lamb. The view reads only the selector, never `isAbomination`.
5. **Copy and look (UX-DR4, UX-DR5, UX-DR95, UX-DR97).** Labels from `strings.ts`; no "!" ; colours from `COMPONENTS` / `COLORS`; numbers right-aligned against a fixed right edge so they do not jitter; no text under 18 px; legible at a 960×540 window.
6. **Done = `npm test`, `npm run typecheck`, `npm run lint` all pass**, and the browser checks in Task 6 pass. Zero console errors (NFR8).

## Tasks / Subtasks

- [x] **Task 1: Selector (AC 2, 4)** — `src/sim/selectors.ts`, next to `LoseView` / `selectLoseView` (~line 606)
  - [x] 1.1 `export interface StatsView { alive: number; sold: number; died: number; sacrificed: number; moneyEarned: number }` with a doc comment citing FR36 / UX-DR16.
  - [x] 1.2 `export function selectStatsView(state: GameState, out: StatsView): StatsView` — fills `out` in place (no allocation, the `selectLoseView` pattern) and returns it. `alive = state.sheep.length`. Nothing else is derived; do not read `isAbomination`, `pregnancies` or `carcasses`.
  - [x] 1.3 No change to `GameState`, `createNewGame`, `validate.ts`, `migrations.ts`, `normalize.ts` or `SAVE_SCHEMA_VERSION`. If you find you need one, stop — the counters already exist (see Dev Notes "Current code").

- [x] **Task 2: Strings (AC 1, 5)** — `src/view/strings.ts`, in the pause-menu group after the Volume row labels
  - [x] 2.1 `statsAlive: 'Alive'`, `statsSold: 'Sold'`, `statsDied: 'Died'`, `statsSacrificed: 'Sacrificed'`, `statsMoneyEarned: 'Money earned'`, marked `[ASSUMPTION] Not in the Voice table` like the other panel strings; wording from EXPERIENCE IA ("Alive, sold, died, sacrificed, money earned"), capitalised as row labels. The header reuses `STRINGS.stats`. Values are plain numbers (`String(n)`) and `formatMoney(n)`; add a `statsCount: (n: number): string => String(n)` only if you want a single place for it.
  - [x] 2.2 Update the `comingSoon` comment: the placeholder now serves Credits only (until 5.9).

- [x] **Task 3: StatsPanel (AC 1, 2, 5)** — new `src/view/overlay/StatsPanel.ts` implementing `Modal` (architecture tree lists `StatsPanel` under `overlay/`)
  - [x] 3.1 Same frame as `PlaceholderPanel` / `VolumePanel`: `PAD = SPACING[4]`, `HEADER_GAP = SPACING[3]`, `BODY_GAP = SPACING[5]`, `lineBox()` heights, centred on the canvas, **one fixed size** (`Panel.setBounds` bakes a texture per size and `boxTexture` never evicts). `[ASSUMPTION, tune in the browser]` width: start at `BUTTON.width + PAD * 2` (312, the pause panel's width) and widen (e.g. 360–400) only if "Money earned" plus a 7-digit money value does not fit with a clear gap. Rows `ROW_H = lineBox('label')` (or `lineBox('numeric')`, whichever is taller) apart by `ROW_GAP = SPACING[2]`; all named constants at the top, no inline pixel literals.
  - [x] 3.2 Each row: label `Text` at `X + PAD`, origin (0, 0.5), `textStyle('label', TEXT_COLOR)`; value `Text` at `X + WIDTH - PAD`, origin (1, 0.5) — right-aligned on a fixed edge (UX-DR5) — `textStyle('numeric', TEXT_COLOR)` (UX-DR4: numbers in numeric). `TEXT_COLOR = COMPONENTS.panel.textColor` (bark). Build all Texts once in the constructor; keep the five value Texts in fields.
  - [x] 3.3 `setView(view: StatsView): void` — writes each value Text only when its string changed (`if (t.text !== s) t.setText(s)`, the `PlaceholderPanel.setHeader` pattern). Money via `formatMoney`.
  - [x] 3.4 Back: centred `Button` with `COMPONENTS.buttonMenu`, `labelAlign: 'center'`, `activateOn: 'release'`, `onActivate: guarded(onBack)` — copy `PlaceholderPanel` exactly.
  - [x] 3.5 `setVisible(visible)` shows/hides the panel, header, every label and value Text, and Back (Back's `setVisible` already clears hover/press and the cursor). Constructor ends with `this.setVisible(false)`.
  - [x] 3.6 Doc comment: what it shows (FR36, UX-DR16), that it is filled on open (the sim is paused, so it never needs a live update), and that it never reads the Abomination (UX-DR64).

- [x] **Task 4: OverlayScene wiring (AC 1, 2)** — `src/view/scenes/OverlayScene.ts`
  - [x] 4.1 Add `'stats'` to `OverlayModal`; field `private statsPanel!: StatsPanel;` and `private readonly statsView: StatsView = { alive: 0, sold: 0, died: 0, sacrificed: 0, moneyEarned: 0 };` (reused, like `loseView`).
  - [x] 4.2 In `create()`: `this.statsPanel = new StatsPanel(this, PANEL_DEPTH, () => this.modals.back());` and `.add('stats', this.statsPanel)`.
  - [x] 4.3 Pause item **Stats** → `() => this.openStats()`, where `openStats()` calls `this.statsPanel.setView(selectStatsView(this.gameScene.simState, this.statsView))` **then** `this.modals.open('stats')`. `MenuPanel` already wraps every item's `onActivate` in `guarded` (MenuPanel.ts:91), so a throw is reported, not escaped.
  - [x] 4.4 `closeSubPanel()` returns true for `'volume'`, `'stats'` **and** `'subPanel'` (Esc chain step 2). Keep `openSubPanel(...)` and the placeholder for **Credits** only.
  - [x] 4.5 Update the class doc comment (Stats is real since 5.4; only Credits is a placeholder until 5.9) and the `closeSubPanel` comment.
  - [x] 4.6 `src/view/overlay/PlaceholderPanel.ts`: update its doc comment (stands in for Credits only, in pause and on the title).

- [x] **Task 5: Tests (AC 2, 3, 4)**
  - [x] 5.1 `tests/sim/selectors.test.ts` — new `describe('selectStatsView (FR36)')`: fresh game → alive 3 (`TUNING.startFlockAdults + TUNING.startFlockLambs`), all others 0; fills `out` in place and returns the same object; `alive` excludes pending lambs and carcasses; spending money (buy a shop item) leaves `moneyEarned` unchanged.
  - [x] 5.2 New scenario `tests/sim/scenarios/stats.test.ts` (it spans market, Better Place, hunger, virus and the Abomination): from `newGame(<literal seed>)` drive real commands/ticks — sell an adult (and an elder if cheap to set up) with `applyCommand(state, { type: 'Sell', id })`, sacrifice one with `{ type: 'Sacrifice', id }` (commands.ts), let one starve (`runFor` past `TUNING.starveMs` with Fullness forced low), infect one (`infectSheep` or eat a carcass) and run `TUNING.virusDeathMs`. Assert each counter moved by exactly one per event and `moneyEarned` by `TUNING.sellPriceAdult` (+ `sellPriceElder`). Use the same command/helper style as `tests/sim/systems/market.test.ts` and `betterPlace.test.ts` — read them first, don't invent new helpers if one exists. Use `TUNING` values, never literals.
  - [x] 5.3 Secrecy (AC 4) in the same file: an Abomination victim's death (`killSheep(..., 'abomination')` or the kill-cycle path used in `tests/sim/systems/abomination.test.ts`) adds 1 to `died`, and sacrificing the Abomination adds 1 to `sacrificed`; `selectStatsView` of a state with a living Abomination equals that of the same state with `isAbomination` false (the `betterPlace.test.ts` "withAbom" comparison pattern).
  - [x] 5.4 Save (AC 3): after the scenario, `decodeSave(encodeSave(state))` returns a state whose `selectStatsView` deep-equals the original's. A `createNewGame` after that has all-zero stats. (`tests/save/roundTrip.test.ts` already covers `stats` inside the busy state; this pins the panel's numbers explicitly. Put it in `tests/save/` if importing `src/save` from a sim scenario breaks the test layout rule — `tests/<same path as src>`.)
  - [x] 5.5 No Phaser in tests; `StatsPanel` and wiring are verified in the browser (Task 6).

- [x] **Task 6: Verify and docs (AC 6)**
  - [x] 6.1 `npm test`, `npm run typecheck`, `npm run lint` — green. Every existing test unchanged.
  - [x] 6.2 Browser (`npm run dev`), Chrome (Firefox if available):
    - Pause → Stats: five rows in order, values match the HUD flock counter and what you did; Back and Esc return to Paused; Esc again resumes. Credits still shows "Coming soon.". Volume still works.
    - Sell, sacrifice, let one starve, then reopen Stats: each counter moved by one; Money earned rose by the sale price; buy something in the shop → Money earned unchanged. DEV "Add money" → unchanged.
    - Reload (Continue) and Main Menu → Continue: same numbers. Restart → Start over: all 0, Alive 3.
    - A big number (DEV: sell many / edit a save with `moneyEarned` 9999999): the value stays inside the panel, right-aligned, not overlapping its label.
    - 960×540 window: legible. Zero console errors.
    - **Run in headless Chrome (2026-10-13):** pause → Stats on a new game (3/0/0/0/$0); Esc and Back return to Paused; Credits still "Coming soon."; a save edited to sold 4 / died 7 / sacrificed 2 / earned $9999999 → Continue → panel shows them, $9999999 right-aligned clear of its label; a sheep starving live → Died 1, Alive 2 matching the HUD's 2/10; Restart → Start over → all 0, Alive 3; 960×540 legible; zero console errors. **Not run in the browser:** Firefox; sell and sacrifice by drag; a shop purchase and DEV Add money leaving Money earned unchanged; Volume still working (unchanged code). The counter rules behind those are covered by `stats.test.ts` and `selectors.test.ts`.
  - [x] 6.3 `_bmad-output/game-architecture.md` (as built): `StatsPanel` in `view/overlay/StatsPanel.ts`, modal id `'stats'`, `selectStatsView` in `selectors.ts`, counters live in `GameState.stats` (unchanged).
  - [x] 6.4 `_bmad-output/implementation-artifacts/deferred-work.md`: mark resolved — the "Placeholder panels" entry's Stats part (~line 150–151; Credits remains for 5.9), "Stats panel (Story 5.4)" (~220: boosts left out), "Stats by cause (Story 5.4)" (~377: no by-cause lines, Abomination deaths counted with the rest). Add an entry for anything you defer.
  - [x] 6.5 `sprint-status.yaml`: 5-4 → `review` when done (create-story already set `ready-for-dev`).

### Review Findings

Code review 2026-10-13 (Blind Hunter, Edge Case Hunter, Acceptance Auditor; 16 dismissed).

- [x] [Review][Decision] Open browser checks (AC 6, Task 6.2) — Firefox; sell and sacrifice by drag; a shop purchase and DEV "Add money" leaving Money earned unchanged; Volume still working. The counter rules are unit-tested (the DEV Add money path is not tested anywhere), but AC 6 says the browser checks pass. Run them by hand, or accept the headless Chrome run plus unit tests (as for 5.7). **Resolved 2026-10-13: Rylan accepted the headless Chrome run plus unit tests as covering 6.2; Task 6.2 ticked.**
- [x] [Review][Patch] Dev Agent Record says "+14 tests"; the diff adds 9 (4 + 4 + 1) [5-4-stats-panel.md:187]
- [x] [Review][Patch] No old-age death case, though AC 3 names old age [tests/sim/scenarios/stats.test.ts:41]
- [x] [Review][Patch] Literal `fullness = 100` instead of `TUNING.fullnessMax` (Task 5.2: no literals) [tests/sim/scenarios/stats.test.ts:42]
- [x] [Review][Patch] Round-trip test relies on a 3-sheep start with `sheep[0]` sellable, and empties the flock so it saves a lost game rather than a mid-game one [tests/save/roundTrip.test.ts:130]
- [x] [Review][Defer] A money value far past 7 digits (validation allows up to 2^48) would overlap "Money earned"; nothing measures or scales it [src/view/overlay/StatsPanel.ts:25] — deferred, pre-existing (the HUD MoneyCounter has the same fixed-box approach; unreachable in normal play)

## Dev Notes

### What this story is (and is not)

- **Is:** `StatsPanel`, `selectStatsView` / `StatsView`, five strings, OverlayScene wiring (`'stats'` modal, Esc step 2), tests pinning the counters and their round trip, docs.
- **Is not:** any sim rule or `GameState` change; a schema bump; deaths by cause; boost count; peak flock / time survived (those are the lose screen's — see Open Question 1); names (5.3); Credits (5.9); a title-screen Stats entry (IA: Stats lives under Pause only).

### Current code to build on (read these first)

- `src/sim/state.ts` — `interface Stats { died; sold; sacrificed; moneyEarned; peakFlock }` (~line 137); `createNewGame` sets them all to 0; `createSheep` maintains `peakFlock`.
- `src/sim/systems/carcass.ts` — `killSheep` (`stats.died += 1`, every cause, incl. `'abomination'`), `removeSheep(state, id, 'sold' | 'sacrificed')` (`stats.sold` / `stats.sacrificed += 1`). Pattern N1: these are the only exits from `state.sheep`.
- `src/sim/systems/market.ts:29` — `stats.moneyEarned += price` on a sale. `economy.ts` (purchases) never touches it; `DebugOverlay.ts:266` "Add money" deliberately doesn't either.
- `src/save/validate.ts` — `STAT_COUNTS = ['died','sold','sacrificed','peakFlock']` and the `moneyEarned` range check: stats are already validated and saved. No change.
- `src/sim/selectors.ts` ~606–620 — `LoseView` / `selectLoseView(state, out)`: the exact shape to copy for `StatsView` / `selectStatsView`.
- `src/view/scenes/OverlayScene.ts` — `ModalController<'pause' | 'volume' | 'subPanel' | 'confirm' | 'lose'>`; the pause `MenuPanel` items; `openSubPanel(header)` (placeholder); `closeSubPanel()` (Esc step 2, called by GameScene's InputController hooks); `loseView` reused object; `showLose` calls `losePanel.setView(selectLoseView(...))` before showing — the same "fill, then show" order you need.
- `src/view/overlay/PlaceholderPanel.ts` — the frame to copy (PAD, HEADER_GAP, BODY_GAP, `lineBox`, centred X/Y, Back button). `src/view/overlay/LosePanel.ts` — `setView` filling Texts. `src/view/overlay/VolumePanel.ts` — label-left / control-right rows (`X + PAD` left, `X + WIDTH - PAD` right).
- `src/view/overlay/MenuPanel.ts` — `lineBox(role, lines)`, `Modal` interface.
- `src/view/overlay/ModalController.ts` — `open(id)` remembers the way back; `back()` returns; modals replace, never stack.
- `src/view/widgets/box.ts` — `textStyle(role, color)`; `src/view/widgets/Button.ts`, `Panel.ts`.
- `src/core/format.ts` — `formatMoney(n)` (`$` + whole number, no separators; `$0` for ≤0/NaN).
- `src/config/constants.ts` — `COMPONENTS.panel`, `COMPONENTS.buttonMenu`, `SPACING`, `TYPOGRAPHY`, `CANVAS_WIDTH/HEIGHT`.

### What must be preserved

- Pause menu order and behaviour (Resume, Volume, Stats, Restart, Credits, Main Menu); Volume panel; start-over confirm; lose screen; the era badge above the scrim.
- Esc chain order (confirm → sub-panel → drag → breed → shop → pause); Stats is a sub-panel.
- Credits (pause and title) still use `PlaceholderPanel` with "Coming soon.".
- Every seeded sim test and the save tests (round trip, corrupt save, settings survive Restart) unchanged and green.
- Secrecy: nothing in `src/view/` reads `isAbomination` (lint-enforced).

### Design decisions (defaults chosen; see Open Questions)

- **Fill on open, no live updates:** the sim is paused whenever the panel is up, so `setView` once before `modals.open('stats')` is enough; no `bus` listener, nothing to clean up on SHUTDOWN beyond what Button does.
- **Own modal id `'stats'`** (as Volume got `'volume'`), so the placeholder keeps serving Credits until 5.9.
- **Alive = `state.sheep.length`**, matching the flock counter (UX-DR35) and including a living Abomination (it is a lamb to the player). Not `alive + pregnancies` (that is capacity, AR21).
- **Money earned, not balance:** `stats.moneyEarned` (every dollar ever earned by selling). The current balance is already on the HUD.

### Architecture compliance

- View never mutates `GameState`; it reads through a selector (`selectStatsView`) that fills a reused object (no allocation per open beyond the strings `setText` needs — fine, it's a click, not a frame).
- Copy in `strings.ts`; colours from `COMPONENTS` / `COLORS`; typography via `textStyle`; no hex or text literals in the component.
- `src/view/overlay/StatsPanel.ts` matches the architecture tree (`overlay/ … StatsPanel`).
- Overlay callbacks run inside Phaser's input step: wrap with `guarded` / try → `reportError('ui', …)`; never let a throw escape.
- No new npm packages. No sim, save-schema or asset change.

### Library / framework notes

- Phaser 4.2.x, not 3: `scene.add.text(x, y, s, style).setOrigin(1, 0.5)` for right-aligned values; `Text.setText` only on change (project-context: cached Text updated only on value change). Nothing new from the engine is used; the patterns all exist in `PlaceholderPanel` / `LosePanel` / `VolumePanel`.
- No web research needed: the stack is pinned (Phaser 4.2.x, TS 6, Vite 8, Vitest 4.1) and this story adds no API or dependency.

### Testing standards

- Vitest for `src/sim/` and `src/save/` (plus pure view helpers with no Phaser import). Sim tests: `createNewGame(<literal seed>)` / `newGame(seed)` from `tests/sim/helpers.ts`, `runFor(state, ms)`, `TUNING` values in assertions, assert on state and `SimEvent`s, no fake timers, no `Math.random`.
- Layout: `tests/sim/selectors.test.ts` (selector), `tests/sim/scenarios/stats.test.ts` (multi-system), save round trip in `tests/save/` if it needs `src/save`.
- Panel and wiring: browser only (Task 6). Never mock Phaser.

### Previous story intelligence (5.7 and earlier)

- 5.7 built the sub-panel pattern this story copies: own modal id, `closeSubPanel` covering it, fixed panel size, label-left / control-right rows, Back with `activateOn: 'release'` and `guarded(onBack)`, refresh from the truth **before** showing.
- Reviews keep flagging: stale doc comments (e.g. "placeholders until 5.4"), literal pixel numbers instead of named `[ASSUMPTION]` constants, listener double-subscription after restart, per-frame `setText`, and hover/cursor glitches when a modal hides a control under the pointer (Button.setVisible handles it — use Button).
- 5.7 left `grep -rn "5.4" src` hits in comments ("placeholders until 5.4 / 5.9" in OverlayScene and PlaceholderPanel, `comingSoon` in strings.ts): update them to as-built text.
- Stories end with an as-built pass on `game-architecture.md`, `deferred-work.md` and `sprint-status.yaml`, then one commit per story after code review.

### Git intelligence

- Recent commits: "Implement story 5.7: Volume and Accessibility Settings", "Implement story 5.6: Audio Pass and Captions" — one commit per story, containing code, story file, deferred-work, architecture "as built" and sprint-status. Same here on branch `story-5.4`.
- Story 5.3 (Sheep Names) is still backlog: there are no names yet; this panel needs none.

### Open questions (defaults chosen; confirm or change)

1. **Extra rows.** FR36 lists exactly five. `stats.peakFlock` and time survived (`state.time`) are free to show and would fit "the story of my flock". Default: **not shown** (spec as written; the lose screen shows them).
2. **Deaths by cause.** Default: one "Died" line (deferred-work: never an Abomination line). A starved / old age / sickness split is possible but must lump `abomination` into an unnamed bucket — not worth it now.
3. **Labels.** Default "Alive", "Sold", "Died", "Sacrificed", "Money earned". "Went to a Better Place" would match the sacrifice toast's tone but is long.

### Project Structure Notes

- New: `src/view/overlay/StatsPanel.ts`, `tests/sim/scenarios/stats.test.ts` (and possibly a stats case in `tests/save/`).
- Modified: `src/sim/selectors.ts` (StatsView, selectStatsView), `src/view/strings.ts`, `src/view/scenes/OverlayScene.ts`, `src/view/overlay/PlaceholderPanel.ts` (comment), `tests/sim/selectors.test.ts`; docs: `_bmad-output/game-architecture.md`, `deferred-work.md`, `sprint-status.yaml`.
- No variance from the architecture tree.

### Project Context Rules

- Phaser 4 APIs only; check bundled skills/source before using a call from memory.
- Pausing = GameScene stops accumulating; never `scene.pause()`. The panel opens from pause, so the sim is already stopped.
- `src/sim/` stays pure (no Phaser/DOM/`Date.now()`/`Math.random()`); the new selector is pure and allocation-free.
- `GameState` stays plain JSON; no derived values stored (Alive is derived); any new field would need a schema bump and migration — none is needed here.
- Abomination secrecy: view/HUD/stats use public data only; `isAbomination` readable only in `src/sim/`, `src/debug/`, `src/save/`.
- Listener cleanup on SHUTDOWN (OverlayScene restarts with GameScene); the panel adds no bus listener.
- Copy in `strings.ts`, no "!" except "Last sheep!", never "corpse"/"blood"/"kill" in UI text; colours from `COLORS`/`COMPONENTS`.
- Text ≥ 18 px; numbers right-aligned in fixed boxes; legible at 960×540.
- Done = `npm test`, `npm run typecheck`, `npm run lint` pass; UI verified manually in the browser.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 5.4: Stats Panel]
- [Source: _bmad-output/planning-artifacts/epics.md — FR36; UX-DR4, UX-DR5, UX-DR14, UX-DR16, UX-DR20, UX-DR64, UX-DR73, UX-DR95, UX-DR97, UX-DR99; AR17, AR18]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-sheep-civilization-2026-10-05/EXPERIENCE.md — IA (line 28, Stats row line 42, line 56), Panel/menu scrim (line 112)]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-sheep-civilization-2026-10-05/DESIGN.md — Panel (line 438)]
- [Source: _bmad-output/planning-artifacts/gdds/gdd-sheep-civilization-2026-10-05/gdd.md — Stats panel (line 314)]
- [Source: _bmad-output/game-architecture.md — Overlay scene row (~208), Esc priority (~219), directory tree overlay/StatsPanel (~460), killSheep data flow (~560)]
- [Source: _bmad-output/project-context.md — Code Organization, Testing, Critical Don't-Miss Rules (N1, secrecy)]
- [Source: _bmad-output/implementation-artifacts/deferred-work.md — "Placeholder panels" (~150), "Stats panel (Story 5.4)" (~220), "Stats by cause (Story 5.4)" (~377)]
- [Source: _bmad-output/implementation-artifacts/5-7-volume-and-accessibility-settings.md — sub-panel pattern, review findings]

## Change Log

- 2026-10-13: Story created (create-story).
- 2026-10-13: Implemented (dev-story): `selectStatsView`, `StatsPanel`, OverlayScene `'stats'` modal, strings, +9 tests, docs. Headless Chrome checks done; Firefox and drag-based sell/sacrifice checks open (6.2). Status → review.
- 2026-10-13: Code review: 1 decision (6.2 accepted as covered), 4 patches applied (test count corrected to +9; old-age death added to the scenario test; `TUNING.fullnessMax` instead of a literal; round-trip test keeps a game in progress), 1 deferred (very long Stats values), 16 dismissed. Status → done.

## Dev Agent Record

### Agent Model Used

Claude Opus 5.5 (1M context) — `claude-opus-5-5[1m]`

### Debug Log References

- Browser checks: throwaway scratchpad Playwright scripts (playwright-core from the npx cache, system Chrome, `--mute-audio`) against `vite --port 5181`; saves edited through `localStorage` to set big counters and a starving sheep. Not committed.

### Completion Notes List

- **No sim or save change:** the counters already lived in `GameState.stats` and were saved and validated; `SAVE_SCHEMA_VERSION` stays 12. Added `StatsView` / `selectStatsView(state, out)` next to `selectLoseView` (fills in place; `alive = state.sheep.length`).
- **StatsPanel** (`view/overlay/StatsPanel.ts`): 312 px wide (the pause panel's width), header "Stats", five rows (label type left, numeric type right-aligned on the panel's inner edge), Back. Values are rewritten only when they change. A 7-digit money value fits with room to spare.
- **OverlayScene:** modal id `'stats'`; the Stats item calls `openStats()` (fill from `simState`, then `modals.open('stats')`); `closeSubPanel` covers `'stats'` (Esc step 2). Credits keeps `PlaceholderPanel`.
- **Strings:** `statsAlive`, `statsSold`, `statsDied`, `statsSacrificed`, `statsMoneyEarned` (`[ASSUMPTION]`, EXPERIENCE IA wording); `comingSoon` and the `PlaceholderPanel` / OverlayScene doc comments updated.
- **Tests (+9):** `selectors.test.ts` (4: new game, reads stats, alive excludes pregnancies/carcasses, shop spend leaves money earned); `scenarios/stats.test.ts` (4: sell adult + elder, sacrifice, starvation, virus, old age each move exactly their counter; shop spend; Abomination alive like a lamb; its victim in Died and its sacrifice in Sacrificed); `save/roundTrip.test.ts` (1: panel numbers survive encode/decode in a game in progress; a new game starts at 0). The scenario tests passed on first run because the counters predate this story; the selector tests were red first.
- **Open questions** in Dev Notes kept their defaults (five rows only, one Died line, IA labels).
- `npm test` 892 passed / 1 skipped (68 files); `npm run typecheck`, `npm run lint` clean; `npm run build` succeeds (existing chunk-size warning only).
- **Task 6.2 is left open:** see its "Not run in the browser" list — needs Rylan's manual pass or acceptance.

### File List

- `_bmad-output/game-architecture.md` (modified)
- `_bmad-output/implementation-artifacts/5-4-stats-panel.md` (new)
- `_bmad-output/implementation-artifacts/deferred-work.md` (modified)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modified)
- `src/sim/selectors.ts` (modified)
- `src/view/overlay/PlaceholderPanel.ts` (modified: comment)
- `src/view/overlay/StatsPanel.ts` (new)
- `src/view/scenes/OverlayScene.ts` (modified)
- `src/view/strings.ts` (modified)
- `tests/save/roundTrip.test.ts` (modified)
- `tests/sim/scenarios/stats.test.ts` (new)
- `tests/sim/selectors.test.ts` (modified)
