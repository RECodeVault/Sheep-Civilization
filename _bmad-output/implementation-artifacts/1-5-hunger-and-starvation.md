---
baseline_commit: daf6955b6246a6bdd7d59d02df2f2240801f2311
---

# Story 1.5: Hunger and Starvation

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a player,
I want to see my sheep get hungry and starve if I neglect them,
so that I feel the pressure to pay attention.

## Acceptance Criteria

1. **Drain and starvation (FR1).** Given a sheep at Fullness 100, when 120 game-seconds pass with no food, its Fullness reaches 0 and it dies on that tick (tick 1 200, not 1 201). The drain rate comes from `TUNING`, not literals.
2. **Derived hunger state and visuals (FR2, UX-DR57).** Given Fullness values, when the view renders a sheep, its hunger state is derived and never stored:
   - **Fed** (> 50): normal sprite.
   - **Hungry** (50 to 25, both inclusive): drooping posture.
   - **Starving** (< 25): thin sprite.
3. **Single death pipeline (N1, AR17).** Given a sheep that reaches 0 Fullness, it dies through `killSheep(state, id, 'starved')`. `killSheep`:
   - removes the sheep,
   - increments `stats.died`,
   - emits `SheepDied { id, cause, x, y }`,
   - skips the carcass, because `TUNING.carcassesEnabled` is `false` in Epic 1.
   - No other code removes sheep from `state.sheep`.
4. **Sheep tooltip (FR42 partial, UX-DR43).** Given the pointer hovers a sheep for about 300 ms, a tooltip appears:
   - It reads "{Stage} · {Fed|Hungry|Starving}" (for example "Adult · Hungry").
   - It uses the `tooltip` style and follows the sheep.
   - It reads only from the `PublicSheep` selector.
5. **Scenario test.** Given a seeded new game (three sheep at Fullness 60), when `runFor(state, TUNING.starveMs)` runs with no food, all three sheep have died and three `SheepDied` events with `cause: 'starved'` were emitted.
6. **Green gate.** `npm test`, `npm run typecheck`, `npm run lint` and `npm run build` all pass. No existing test breaks.

## Tasks / Subtasks

- [x] **Task 1: Tuning values** (AC: 1, 2, 3)
  - [x] 1.1 Add the following to `TUNING` in `src/config/tuning.ts`, each with a one-line source comment in the existing style:
    - `fullnessMax: 100`. FR1 range 0–100. `+35` capping in Story 1.7 uses it too.
    - `starveMs: 120_000`. Time for Fullness to drain from `fullnessMax` to 0 (GDD Hunger: "100 → 0 over 120 s").
    - `fedAbove: 50`. Fed when Fullness > 50.
    - `starvingBelow: 25`. Starving when Fullness < 25; Hungry is everything in between, inclusive.
    - `carcassesEnabled: false`. N1 Epic 1 staging. Story 2.4 sets it to `true`.
    - `lambUntilMs: 60_000` and `elderFromMs: 300_000`. FR7 stage thresholds, needed for the tooltip's "{Stage}" (see Task 3.2).
  - [x] 1.2 Do not add a separate drain-per-second value. Derive it from `fullnessMax / starveMs`, so the two can never disagree.
  - [x] 1.3 Leave the existing `startFullness: 60` and `startAdultAgeMs: 60_000` unchanged.
- [x] **Task 2: `killSheep`, the single death pipeline, in `src/sim/systems/carcass.ts`** (AC: 3)
  - [x] 2.1 Create `src/sim/systems/carcass.ts` (the architecture's home for N1) and export `killSheep(state: GameState, id: number, cause: DeathCause): void`.
    - Find the sheep. If it is unknown, call `invariant(false, …)` and return. Build the message only on failure.
    - Replace the array: `state.sheep = state.sheep.filter((x) => x.id !== id)`. Allocation is fine here, because a death is a rare event (project-context Performance Rules).
    - `state.stats.died += 1`.
    - If `TUNING.carcassesEnabled` is true, push `{ id: nextId(state), x: s.x, y: s.y, createdAt: state.time }` to `state.carcasses`, exactly as in the architecture's N1 guide. This branch is dead in Epic 1; Story 2.4 enables and tests it.
    - `emit({ type: 'SheepDied', id, cause, x: s.x, y: s.y })`. The `SheepDied` shape already exists in `events.ts`. Do **not** add `name`; Story 5.3 does.
    - Leave one marked comment for Story 1.8: `// Story 1.8: checkLastSheepAndLoss(state) here.` Add no stub function and no `Lost` event.
  - [x] 2.2 `killSheep` is a shared helper (the documented exception to "systems never call each other"). It is **not** a system: do not register it in `step.ts`.
  - [x] 2.3 Update the comment on `SimEvent` in `events.ts` ("Story 1.5 emits SheepDied") to say it is emitted by `killSheep`.
- [x] **Task 3: Hunger selectors and `PublicSheep`** (AC: 2, 4)
  - [x] 3.1 In `src/sim/selectors.ts`, add:
    - `export type Hunger = 'fed' | 'hungry' | 'starving'`.
    - `export function hungerOf(fullness: number): Hunger`, which returns `'fed'` if `fullness > TUNING.fedAbove`, `'starving'` if `fullness < TUNING.starvingBelow`, and `'hungry'` otherwise.
    - The sim's hunger system uses these too (Story 1.7's seek rule and 2.5's carcass rule will). Never store the result in `GameState`.
  - [x] 3.2 Also add `export type Stage = 'lamb' | 'adult' | 'elder'` and `export function stageOf(s: Sheep, state: GameState): Stage`.
    - With `age = state.time - s.bornAt`: `age < lambUntilMs` → lamb; `age < elderFromMs` → adult; otherwise elder.
    - The founding adults are aged exactly 60 s, so they must read "Adult" at time 0. That is why the lamb check is `<`.
    - This is the minimum the tooltip needs. Story 2.1 owns the stage **rules** (old-age death, lamb/elder sprites, the GDD starting flock) and reuses this selector. See decision D2.
  - [x] 3.3 Extend `PublicSheep` with `stage: Stage` and `hunger: Hunger`. Fill them in both `publicSheep()` and `selectPublicSheep()`.
    - `selectPublicSheep` must still allocate nothing per frame: assign the string literals into the reused objects, and initialise new objects with `stage: 'adult', hunger: 'fed'`.
    - Keep the shape the architecture's N2 guide shows. Do not add `name`, `infected`, `onCooldown`, `gait` or `activity` yet; later stories add them.
- [x] **Task 4: The hunger system, `src/sim/systems/hunger.ts`** (AC: 1, 3)
  - [x] 4.1 Export `updateHunger(state: GameState): void`. For each sheep, `s.fullness = Math.max(0, s.fullness - drainPerTick)`, with `drainPerTick = (TUNING.fullnessMax * TICK_MS) / TUNING.starveMs` computed once at module scope.
  - [x] 4.2 **Float drift (read gotcha 1).** Repeated subtraction of 100/1 200 leaves a tiny positive remainder, so a plain `fullness <= 0` check kills a sheep that started at 100 on tick 1 201 instead of 1 200. Measured with Node: start 100 → 1 201 ticks; start 35 → 421; start 60 → 720.
    - Treat anything at or below a small epsilon as empty: `if (s.fullness <= FULLNESS_EPSILON)`, with `const FULLNESS_EPSILON = 1e-6` at module scope and a comment that explains why.
    - The epsilon is numerical, not a balance value, so it lives in `hunger.ts`, not `TUNING`.
  - [x] 4.3 **Killing while iterating.** `killSheep` replaces `state.sheep` with a new array.
    - Iterate over a local `const sheep = state.sheep` captured before the loop, and call `killSheep(state, s.id, 'starved')` for each sheep that empties.
    - Deaths happen in array order, which keeps the run deterministic.
    - Allocation-free when nobody dies.
  - [x] 4.4 Register it in `src/sim/step.ts` in the declared order: `[updateMovement, updateHunger]`. The fixed-order comment already lists `movement → feeding → hunger`; Story 1.7 inserts `updateFeeding` between them.
  - [x] 4.5 Do not touch `movement.ts`. Starving sheep keep wandering at normal speed in Epic 1. Seeking food is Story 1.7; carcass eating is Story 2.5.
- [x] **Task 5: Hunger visuals on `SheepSprite`** (AC: 2)
  - [x] 5.1 Add two placeholder frames to `assets/art/sheep/`: `adult-hungry.png` (drooping posture: head and ears lower, back sagging) and `adult-starving.png` (thin: narrower body, ribs or a pinched waist, visibly bonier).
    - Use the same 32×26 canvas, palette and anchor as `adult-idle.png`, so frames swap without a jump.
    - Draw them with a throwaway scratchpad script, as Story 1.2 did (a pure Node PNG encoder). Commit only the PNGs, never the script.
    - Starving must read as different from Hungry at a glance and at 960×540. Shape carries the meaning, not colour: no `alert` red on the sheep (UX-DR2).
  - [x] 5.2 Run `npm run assets` and commit the regenerated `public/assets/atlases/sheep-world.{png,json}`.
  - [x] 5.3 Add `FRAME.adultHungry = 'adult-hungry'` and `FRAME.adultStarving = 'adult-starving'` in `src/view/assetKeys.ts`. Extend the placeholder row in `assets/CREDITS.md` with the two new files.
  - [x] 5.4 In `SheepSprite.sync`, pick the frame from `pub.hunger` (fed → `adultIdle`, hungry → `adultHungry`, starving → `adultStarving`).
    - Call `setFrame` **only when the hunger value changes**. Keep the last applied value in a private field and reset it in `reset()`, so a reused pooled sprite always re-applies its frame.
    - Use one frame for every stage for now. Story 2.1 adds lamb and elder frames.
  - [x] 5.5 Do not reduce or skip these poses under reduced motion (UX-DR84: thin and droop poses are information). No alert ping (Story 2.6), no bleats (Story 5.6) and no threat count (Story 2.6) in this story.
- [x] **Task 6: The tooltip widget, `src/view/widgets/Tooltip.ts`** (AC: 4)
  - [x] 6.1 Create a generic, reusable `Tooltip` class. Story 1.6 reuses it for button tooltips ("Farm: +1 food (F)"), so it knows nothing about sheep.
    - It takes a scene, and has `setText(text: string)`, `showAt(x, y)` and `hide()`.
    - It is built once and reused: one `Phaser.GameObjects.Graphics` background plus one `Phaser.GameObjects.Text`, in a container or positioned together.
  - [x] 6.2 Style it from `COMPONENTS.tooltip`:
    - background `COLORS.duskDeep`, text `COLORS.wool`, `TYPOGRAPHY.body` (Nunito 18/600), corner `RADIUS.sm`, padding `COMPONENTS.tooltip.padding`.
    - No hex literals. Use `COLOR_INT` for Graphics fills, as `PreloadScene` does.
  - [x] 6.3 Redraw the background only inside `setText`, and only when the text actually changes. Never redraw `Graphics` or call `setText` per frame (project-context Rendering, Text rules).
  - [x] 6.4 This is the project's **first Phaser `Text`**. Fonts are already loaded in `main.ts` before the game is created, so the metrics are correct.
    - Set the text `resolution` to the device pixel ratio, for example `resolution: window.devicePixelRatio`, so it stays crisp when the canvas is FIT-scaled (DESIGN.md Typography). `src/view/` may read `window`.
    - Check the `text-and-bitmaptext` skill in `node_modules/phaser/skills/` for the v4 style keys before writing the style object.
  - [x] 6.5 **Placement.**
    - Centre it horizontally on the anchor and place it above the anchor point.
    - Clamp it inside the canvas with the `LAYOUT` safe margin (16 px). If there is no room above, flip it below.
    - Give it a depth above every sheep: sheep use `depth = y`, which is at most 720. Use a named constant, for example `TOOLTIP_DEPTH = 10_000`.
  - [x] 6.6 Delete `src/view/widgets/.gitkeep`.
- [x] **Task 7: Hover a sheep, `src/view/field/SheepHover.ts`** (AC: 4)
  - [x] 7.1 Create a small class owned by `GameScene` that, once per frame after `render()`:
    1. Reads the pointer from `this.input.activePointer` (`x`/`y` are canvas coordinates; the camera never moves).
    2. Hit-tests the **rendered** sheep: interpolated sprite positions, not sim positions. The hit box is the sprite's display bounds plus 6 px padding (UX-DR90). If several sheep overlap, pick the front-most one (highest depth, which is the largest y).
    3. Tracks the hovered id and when hovering began, in real time (`this.time.now`, or the frame time Phaser passes to `update`). This is a view-only timer, which is allowed. Never use `GameState` time for it, since the sim may be paused or at ×16.
    4. After `HOVER_DELAY_MS = 300` on the same sheep, shows the tooltip. This is a view constant in `SheepHover.ts`, not a `TUNING` value: it is UI feel, not a game rule (UX [ASSUMPTION] "about 300 ms").
       - Text: `STRINGS.sheepTooltip(stage, hunger)`.
       - It follows the sheep's sprite every frame.
       - It updates its text only when the stage or hunger changes, so a sheep turning Hungry under the cursor updates live.
    5. Hides the tooltip and resets the timer when:
       - the pointer leaves the sheep or moves to another sheep (the 300 ms restarts),
       - the sheep's id is no longer in the public list (it died),
       - the pointer leaves the canvas.
  - [x] 7.2 To support step 2, add a read-only lookup to `EntityLayer`, for example `spriteFor(id: number): TSprite | undefined`, backed by the existing `live` map. Do not expose the map.
  - [x] 7.3 **Pointer leaving the canvas.** Use `this.input.on(Phaser.Input.Events.GAME_OUT, …)` and `GAME_OVER` (both exist in Phaser 4.2.1, `src/input/events/index.js`) to track whether the pointer is over the game.
    - Register them in `create()` and remove them in `this.events.once(Phaser.Scenes.Events.SHUTDOWN, …)`, so `loadState`'s restart does not double-subscribe (project-context Listener cleanup).
  - [x] 7.4 **Not gameplay input.** Hover only reads the pointer to show information. It sends no `Command` and does not use `setInteractive()` on sheep sprites, so Story 1.7's single `InputController` can later take hover over unchanged.
    - Story 2.7 will hide the tooltip while dragging. Leave one comment for it, and no code.
  - [x] 7.5 **Allocation and cost.** No closures, arrays or strings per frame.
    - The hit test is one pass over the public sheep list (at most 100 sheep): cheap, and no grid is needed in the view.
    - Build the tooltip string only when the hovered sheep's (stage, hunger) pair changes.
  - [x] 7.6 The Abomination arrives in Story 4.1. Because the tooltip reads only `PublicSheep`, it will look like a lamb's with no extra work. Do not read `Sheep` records in the view.
- [x] **Task 8: Strings** (AC: 4)
  - [x] 8.1 Add the following to `STRINGS` in `src/view/strings.ts`:
    - `stage: { lamb: 'Lamb', adult: 'Adult', elder: 'Elder' }`
    - `hunger: { fed: 'Fed', hungry: 'Hungry', starving: 'Starving' }`
    - `sheepTooltip(stage: Stage, hunger: Hunger): string`, returning `` `${STRINGS.stage[stage]} · ${STRINGS.hunger[hunger]}` `` with a middle dot (U+00B7) and single spaces, exactly as in EXPERIENCE.md ("Adult · Hungry").
    - `STRINGS` is frozen `as const`. A function member is fine; keep the object frozen.
  - [x] 8.2 The tooltip has one line until names arrive. UX-DR43's first line (the name) is added by Story 5.3. Do not show a placeholder name line (decision D3).
- [x] **Task 9: Debug overlay helper** (supports manual checks and the deferred NFR1 run)
  - [x] 9.1 Sheep now die 72 s after a new game, so the "+10 sheep" ×10, 5-minute performance run in `deferred-work.md` can no longer run unattended.
    - Add a **Feed all** button to `src/debug/DebugOverlay.ts` that sets every sheep's `fullness` to `TUNING.fullnessMax` through `scene.debugMutate`. This stays within rule limits (debug gotcha 5 from Story 1.4).
    - Put it next to "+10 sheep" and include it in the buttons that are disabled while no game is running.
  - [x] 9.2 Update the NFR1 entry in `deferred-work.md` to say: press **Feed all** at least every 2 minutes during the run, until Story 1.7's feeding exists.
- [x] **Task 10: Tests** (AC: 1, 3, 5, 6)
  - [x] 10.1 `tests/sim/systems/hunger.test.ts`:
    - A sheep at `fullnessMax` is alive at `starveMs - TICK_MS` and dead at exactly `starveMs`.
    - Fullness strictly decreases each tick, by the derived drain, and never goes below 0.
    - A sheep at 60 dies at exactly `60 / fullnessMax * starveMs` (72 s).
    - Two sheep that empty on the same tick both die, in array order, with two events.
    - Use `createSheep` plus direct `fullness` assignment to set up states, as `movement.test.ts` does.
  - [x] 10.2 `tests/sim/systems/carcass.test.ts` (for `killSheep`):
    - It removes exactly that sheep and keeps the others' order.
    - It increments `stats.died`.
    - It emits `SheepDied` with the sheep's `id`, `cause` and last `x`/`y`.
    - It creates no carcass while `TUNING.carcassesEnabled` is false.
    - An unknown id throws in DEV (invariant), and `state` is unchanged.
  - [x] 10.3 `tests/sim/selectors.test.ts` (new or extended):
    - `hungerOf` at the boundaries: 100 / 50.0001 → fed; 50 / 25 → hungry; 24.9999 / 0 → starving. Use `TUNING.fedAbove` and `TUNING.starvingBelow`, not literals.
    - `stageOf` at its boundaries, including a founding adult at time 0 → `'adult'`.
    - `selectPublicSheep` fills `stage`/`hunger` and reuses the objects already in `out`.
  - [x] 10.4 `tests/sim/scenarios/starvation.test.ts`: AC 5 exactly.
    - `newGame(<literal seed>)`, then `runFor(state, TUNING.starveMs)`.
    - `state.sheep` is empty, `stats.died === 3`, and there are three `SheepDied` events with `cause: 'starved'` and distinct ids.
    - Also check that `JSON.parse(JSON.stringify(state))` deep-equals `state` afterwards.
  - [x] 10.5 **Check every existing test still passes.** Founding sheep now die at 72 s.
    - Today's longest runs are 60 s (`wander100.test.ts`), so they should be unaffected. Re-run them anyway.
    - If any test needs a longer run, set `fullness` high instead of weakening its assertions.
    - `step.test.ts` "movement emits no events" runs 2 s and stays valid; rename it to "emits no events before any sheep starves" if that is clearer.
  - [x] 10.6 No Phaser, DOM or view imports in tests. `Tooltip`, `SheepHover` and the sprite frames are verified manually (Task 11).
- [x] **Task 11: Manual verification in the browser, with evidence** (AC: 2, 4)
  - [x] 11.1 `npm run dev`. Use the debug overlay at ×4 or ×16 to watch the three sheep go Fed → Hungry (droop) → Starving (thin) → gone. Record the times: Hungry at about 12 s of game time, Starving at about 42 s and death at 72 s, from Fullness 60.
  - [x] 11.2 Hover a sheep:
    - The tooltip appears after about 300 ms, reads "Adult · Fed" and follows the sheep.
    - It changes live to "Adult · Hungry" when the sheep crosses 50.
    - It disappears when the sheep dies, when the pointer leaves it, and when the pointer leaves the canvas.
    - Check it at the 960×540 minimum window too: the text must stay legible and the box inside the canvas.
  - [x] 11.3 Debug **Load** a save (restart path), then hover again: one tooltip only, with no duplicate listeners.
  - [x] 11.4 Run the gate: `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`. Confirm the debug overlay is still absent from `dist/` (Story 1.4's grep).
  - [x] 11.5 Headless checks follow Story 1.4's method: `playwright-core` in the scratchpad, never a project dependency. Remove any temporary probe and grep-verify that it is gone from `src/` and `dist/`.

### Review Findings

Code review 2026-10-06 (Blind Hunter + Edge Case Hunter + Acceptance Auditor) on `daf6955..07e36d4`. The auditor judged AC 1–6 met and the four declared deviations justified, and re-ran the gate green. 12 findings were dismissed as noise or already handled.

- [x] [Review][Patch] (Decision 2026-10-06, Rylan: render at resolution 1, the 1280×720 framebuffer's own scale; truly crisp HiDPI text would need a renderer-resolution change in the architecture) The tooltip `Text` at `resolution: devicePixelRatio` is drawn smaller into a fixed 1280×720 framebuffer with NEAREST filtering (`pixelArt: true`). On DPR > 1 this drops texels, so the text is less crisp than at resolution 1, which contradicts the story's "crisp under FIT scaling" intent. DPR is also read only once. [src/view/widgets/Tooltip.ts:31]
- [x] [Review][Patch] Hunger bands drift one tick off the spec's inclusive bounds because of float drain: from 60, tick 420 reads 24.999999999999307 (Starving a tick early); from 100, tick 600 reads 50.00000000000165 (Fed a tick too long). Apply the shared `FULLNESS_EPSILON` in `hungerOf` [src/sim/selectors.ts:14]
- [x] [Review][Patch] The NFR1 note's Feed all instructions are wrong: sheep start at Fullness 60 (dead at 72 s), "every 2 minutes" is borderline at exactly 120 s, and "close the overlay" conflicts with pressing an overlay button [_bmad-output/implementation-artifacts/deferred-work.md]
- [x] [Review][Patch] `killSheep` replaces `state.sheep` (by design, N1), but nothing in its header tells future callers (2.1, 2.5, 4.3) to iterate a captured array [src/sim/systems/carcass.ts:17]
- [x] [Review][Patch] The drain test is named "never goes below 0" but never reaches 0, and the `Math.max(0, …)` clamp is redundant with the epsilon branch [src/sim/systems/hunger.ts:19]
- [x] [Review][Patch] Hover hit-tests `activePointer.x/y` (screen) against world sprite positions; use `worldX/worldY` so a later camera shake or scroll (Story 5.8 juice) cannot misalign it [src/view/field/SheepHover.ts:38]
- [x] [Review][Patch] The selectors test hard-codes three adults instead of deriving from the flock size [tests/sim/selectors.test.ts:62]
- [x] [Review][Defer] A non-finite or missing `fullness` (or `bornAt`) from a loaded save makes a sheep immortal (`NaN <= ε` is false) and leaves `hungerOf` returning 'hungry' forever [src/sim/systems/hunger.ts:19] — deferred to Story 1.9 save validation
- [x] [Review][Defer] A tooltip wider or taller than the canvas is pinned at the left or top margin and overflows the opposite edge; there is no wrap. It is unreachable with current copy [src/view/widgets/Tooltip.ts:55] — deferred to Story 1.6 / 5.3 (longer copy)
- [x] [Review][Defer] `SheepSprite` caches only `shownHunger`, so once stage frames exist a sheep that ages with unchanged hunger will not swap frames [src/view/field/SheepSprite.ts:sync] — deferred to Story 2.1

## Dev Notes

### Scope

| Story | Owns (do **not** start here) |
|---|---|
| 1.5 (this) | `hunger.ts`, `killSheep` in `carcass.ts`, `hungerOf`/`stageOf`, hunger frames, the `Tooltip` widget, sheep hover |
| 1.6 | `HudScene`, bottom bar, `Button`/`Panel` widgets, button tooltips (reuses this story's `Tooltip`) |
| 1.7 | `InputController`, `DropFood`, `feeding.ts`, `seekFood` activity, using `fullnessMax` as the +35 cap |
| 1.8 | `checkLastSheepAndLoss`, the `Lost` event, the lose panel (hook comment left in `killSheep`) |
| 2.1 | Stage **rules**: old-age death via `killSheep(…, 'oldAge')`, lamb/elder sprites, the GDD starting flock |
| 2.4 | `carcassesEnabled = true`, carcass sprites, death toasts |
| 2.6 | Alert ping on entering Starving, the threat summary's Starving count |
| 5.3 | Names: the tooltip's first line and `SheepDied.name` |
| 5.6 | Hunger-scaled bleats, `[frantic bleating]` caption |

### Resolved decisions and gotchas (read first)

1. **Float drift kills a tick late.** 1 200 × (100/1 200) does not sum to exactly 100. Without the epsilon, the AC-1 sheep dies at 120.1 s. Measured: start 100 → 1 201 ticks without the epsilon, 1 200 with it. Test the exact tick.
2. **D2: stage is derived now, with real thresholds.** The AC needs "{Stage}", and the architecture says stage is derived from `bornAt`, never stored. A hard-coded `'adult'` would become a lie once feeding (1.7) keeps sheep alive past age 300 s. So `stageOf` is real now.
   - Side effect: in Epic 1, an interim adult fed until age 300 s shows "Elder" in the tooltip but keeps the adult sprite and never dies of old age, until Story 2.1.
   - This is accepted; flag it for Rylan.
3. **D3: one tooltip line until names exist.** UX-DR43 specifies two lines (name, then stage · hunger). Names are Story 5.3 (Should tier). Before names, show only the stage · hunger line. Do not invent "A sheep" as a name line: UX-DR97's "A sheep" is for toasts and captions.
4. **The tooltip lives in `GameScene` for now.** DESIGN.md puts tooltips in the HUD layer, but `HudScene` does not exist until Story 1.6. Build `Tooltip` as a scene-agnostic widget, so 1.6 can move sheep hover into `HudScene`, or leave it in `GameScene` at a high depth. Either is fine; record the choice in the completion notes.
5. **`killSheep` lives in `carcass.ts`** per the architecture (N1 "Components"), even though there are no carcasses yet. Do not put it in `hunger.ts` or `state.ts`. Lifecycle (2.1), virus (2.5) and abomination (4.3) will import it from there.
6. **Never splice `state.sheep` anywhere else.** The debug overlay's "+10 sheep" adds through `createSheep`, which is fine. Nothing in the debug overlay removes sheep. If you need a debug "kill one" button, it must call `killSheep`, but none is required.
7. **No `GameState` shape change, so no schema bump.** `fullness` already exists and is saved. `SAVE_SCHEMA_VERSION` stays 1. Hunger and stage are derived, so they are never saved.
8. **The view never mutates state.** `SheepHover` and `SheepSprite` read `PublicSheep` only. The one exception is still `GameScene.debugMutate` from `src/debug/` (Feed all).
9. **Existing scene restart path.** `loadState` probes a copy with `step(probe)`. A loaded save whose sheep are near 0 may now emit `SheepDied` during the probe. The probe already calls `clearEvents()` in `finally`, so this is safe. Keep it.
10. **Sheep left on the field after the flock dies.** At 0 sheep nothing happens until Story 1.8 (an empty pasture keeps ticking). That is expected for this story; do not add a loss.

### Current state of files this story changes

- **`src/sim/step.ts`** has `SYSTEMS = [updateMovement]`, time advances first, and its comment lists the intended order. **Change:** append `updateHunger`. **Preserve:** time advances before systems; the loop allocates nothing.
- **`src/sim/selectors.ts`** has `fenceBounds`, `PublicSheep { id, x, y }`, `publicSheep()` and the allocation-free `selectPublicSheep(state, out)`. **Change:** add `hungerOf`, `stageOf`, their types and two fields. **Preserve:** reuse of the `out` objects, and `out.length = sheep.length`.
- **`src/sim/events.ts`:** `DeathCause` and `SimEvent = SheepDied` already exist (declared in 1.2, not emitted). `drainEvents` and `clearEvents` are unchanged. **Change:** the comment only.
- **`src/sim/state.ts`:** `Sheep` has `fullness`, `bornAt` and `activity: 'wander'`; `Stats.died` exists; `nextId()` exists. **No change.**
- **`src/view/field/SheepSprite.ts`:** a pooled sprite with interpolation, a facing dead-band, and `reset()` on exit. **Change:** a frame swap on hunger change. **Preserve:** interpolation (`fresh`, `lastTick`, multi-tick blend), facing, depth = y, and no per-frame allocation.
- **`src/view/field/EntityLayer.ts`:** generic N3 reconcile with a `live` map. **Change:** add the read-only `spriteFor(id)`. **Preserve:** the bound `sweep`, no per-frame allocation.
- **`src/view/scenes/GameScene.ts`:**
  - `create(data)` consumes `data.state`, clears events, and builds the `Fence` and the sheep `EntityLayer`.
  - `update()` has the try/catch with `rawDelta`.
  - It has the debug API (`simState`, `simClock`, `stepOnce`, `debugMutate`, `loadState` with a probe).
  - **Change:** build `SheepHover` in `create`, update it after `render()` inside the existing try/catch, and register/remove the GAME_OUT/OVER listeners.
  - **Preserve:** everything else, especially `rawDelta`, `forwardEvent` bound once, `delete data.state`, and the probe's `clearEvents()`.
- **`src/view/strings.ts`:** frozen `STRINGS` with three toast strings. **Change:** add the stage/hunger labels and `sheepTooltip`.
- **`src/view/assetKeys.ts`:** `FRAME.adultIdle` etc. **Change:** two frames.
- **`src/debug/DebugOverlay.ts`:** has the speed, pause, step, "+5 food", "+10 sheep", dump, copy and load controls, plus the safety-net probes. `simButtons` lists the buttons disabled without a game. **Change:** add Feed all.
- **`tests/sim/helpers.ts`:** `newGame(seed)` (clears events), `runFor(state, ms)` (returns the events), `innerFence`, `fillFlock`. **Reuse; do not duplicate.**

### Architecture compliance

- **Purity (lint-enforced):** `src/sim/**` and `src/config/**` import no Phaser or view code, and use no `window`, `Math.random` or `Date.now`. `hunger.ts` and `carcass.ts` use only `TUNING`, `TICK_MS`, `invariant`, `emit` and `nextId`.
- **Systems:** `update<System>(state)` is registered in `step.ts` only. Systems never call each other; `killSheep` is the documented shared-helper exception.
- **Timers:** none are added. Fullness is a stat, not a countdown timer, and it is fine to decrement it per tick (the architecture's "absolute deadlines" rule is about timers like `diesAt`).
- **Derived, never stored:** hunger state and stage.
- **Secrecy (N2):** the view consumes `PublicSheep` only. Adding `stage` and `hunger` keeps it Abomination-safe; Story 4.1 forces `stage: 'lamb'` there.
- **Strings and colours:** copy from `strings.ts`, colours from `COLORS`/`COLOR_INT`, and no inline literals in components.
- **Naming:** `hunger.ts`, `carcass.ts` (camelCase sim modules); `Tooltip.ts`, `SheepHover.ts` (PascalCase classes); frames `adult-hungry`, `adult-starving` (kebab `entity-state`).

### Library / framework requirements

- **No new packages.** Phaser `~4.2.1`, Vite `^8.3.2`, TypeScript `~6.0.3` and Vitest `~4.1.11` stay as installed (re-checked in `package.json` for this story).
- **Phaser 4 APIs this story needs.** Verify each in `node_modules/phaser/src` or `node_modules/phaser/skills/`; do not write v3 code from memory.
  - `this.add.text(x, y, text, style)` with `resolution`. `TextStyle.resolution` exists (default 0 = game config); see the `text-and-bitmaptext` skill.
  - `this.add.graphics()`, `fillStyle`, `fillRoundedRect(x, y, w, h, radius)` (`Graphics.js:711`).
  - `this.add.container` (optional) or two objects moved together; see the `groups-and-containers` skill.
  - `sprite.setFrame(name)`.
  - `this.input.activePointer` (`x`, `y`), and `Phaser.Input.Events.GAME_OUT`/`GAME_OVER` (`src/input/events/index.js:22-23`).
  - `this.events.once(Phaser.Scenes.Events.SHUTDOWN, …)`.
- **Placeholder art:** the same throwaway Node PNG encoder approach as Story 1.2, kept in the scratchpad. `npm run assets` validates kebab frame names and duplicates.

### File structure

| File | Status |
|---|---|
| `src/sim/systems/hunger.ts` | new |
| `src/sim/systems/carcass.ts` | new (`killSheep` only for now) |
| `src/view/widgets/Tooltip.ts` | new (delete `src/view/widgets/.gitkeep`) |
| `src/view/field/SheepHover.ts` | new |
| `assets/art/sheep/adult-hungry.png`, `adult-starving.png` | new |
| `public/assets/atlases/sheep-world.{png,json}` | regenerated |
| `src/config/tuning.ts` | modified |
| `src/sim/selectors.ts`, `src/sim/step.ts`, `src/sim/events.ts` | modified |
| `src/view/field/SheepSprite.ts`, `src/view/field/EntityLayer.ts` | modified |
| `src/view/scenes/GameScene.ts`, `src/view/strings.ts`, `src/view/assetKeys.ts` | modified |
| `src/debug/DebugOverlay.ts` | modified |
| `assets/CREDITS.md`, `_bmad-output/implementation-artifacts/deferred-work.md` | modified |
| `tests/sim/systems/hunger.test.ts`, `tests/sim/systems/carcass.test.ts`, `tests/sim/scenarios/starvation.test.ts` | new |
| `tests/sim/selectors.test.ts` | new (no selectors test file exists yet) |

### Testing requirements

- Vitest, node environment, for `src/sim/` and `src/save/` only. Import only from `src/sim`, `src/config`, `src/core` and `src/save`.
- Use fixed literal seeds and advance with `runFor` from `tests/sim/helpers.ts`. No fake timers, no `Math.random`.
- Assert on state and emitted `SimEvent`s, using `TUNING` values (`TUNING.starveMs`, `TUNING.fedAbove`, …), never re-typed literals.
- `invariant` throws in tests (Vitest runs with `import.meta.env.DEV` true), so "unknown id" can use `expect(() => …).toThrow(/killSheep/)`.
- **Done = `npm test`, `npm run typecheck`, `npm run lint` green**, plus `npm run build` and the Task 11 evidence.

### Project context rules (from `_bmad-output/project-context.md`)

- **Every non-sacrifice death goes through `killSheep(state, id, cause)`.** Never splice `state.sheep` anywhere else.
- **Derived values are never stored** (hunger state, stage, era, flock count).
- **Read `TUNING`, never hard-code GDD numbers.** Tests use `TUNING` values too.
- **No allocation in hot paths** (`step()`, systems, `update()`, `EntityLayer.sync`): the drain loop, the frame swap and the hover hit test allocate nothing per tick or frame. `state.sheep.filter` in `killSheep` is the allowed rare-event exception.
- **No `Graphics` redrawn per frame; no `setText` per frame.** The tooltip redraws only on text change.
- **No Phaser timers or tweens for game logic.** The 300 ms hover delay is view-only and changes no state.
- **Listener cleanup:** every `input.on` in a scene is removed on `SHUTDOWN`; a restart must not double-subscribe.
- **Input:** no `setInteractive()` plus `on('pointerdown')` on sheep for gameplay. Hover reads the pointer only, and Story 1.7's `InputController` owns gameplay input.
- **Strings** come from `strings.ts`; **colours** from `COLORS`. No "!" in copy, and never "corpse", "blood" or "kill" in UI text. Internal identifiers like `killSheep` are code, not UI text.
- **Verify** with the debug overlay before closing any story that touches rendering. 100 sheep at ×1 now needs Feed all (Task 9).
- Common mistakes: Phaser 3 APIs from memory, storing derived values, hard-coding GDD numbers, forgetting to remove listeners on restart.

### Previous story intelligence (1.4)

- **Debug API on `GameScene`:** `simState`, `simClock` (pause = `speed = 0`), `stepOnce`, `debugMutate` (the only sanctioned view-side mutation, from `src/debug/` only) and `loadState` (probe, then restart). Use `debugMutate` for Feed all.
- **`create(data)` deletes `data.state`.** Phaser keeps restart data in `settings.data`. Any new per-game view state (`SheepHover`) must be built fresh in `create`, never carried in a field across restarts without a reset.
- **Sim errors are caught in `GameScene.update`** and reported via `reportError('sim', …)`. A throw from `killSheep`'s invariant in DEV shows the error toast instead of freezing. Put the hover update inside the same try/catch.
- **Hot-path strings:** build `invariant` messages only on failure (`if (!s) invariant(false, …)`).
- **Headless verification** used scratchpad `playwright-core` with system Chrome. Temporary `window.__probeGame` hooks must be removed and grep-verified absent. Stop servers by PID, not `pkill -f` (it matched its own shell in 1.3).
- **Review lessons (1.3, 1.4):**
  - Record evidence for every manual check.
  - List every deviation from the story text in the completion notes.
  - Do not claim a red phase that did not happen.
  - 1.4's review found 17 patches, mostly lifecycle edge cases (restart data, listener and focus leftovers). Apply the same scrutiny to the hover listeners and tooltip lifecycle across `loadState` restarts.
- **Deferred items relevant here:**
  - NFR1 on hardware (5.11): now needs Feed all (Task 9.2).
  - Exit animations (2.4): `playExit()` still releases immediately, so a starved sheep simply vanishes. That is expected until 2.4's death puff.

### Git intelligence

- Recent commits: `daf6955` (1.4 review fixes), `2ccdc8e` (1.4), `4d2d1da` (1.3 review fixes), `09d896b` (1.3), `8842ba4` (1.2). The style is one commit per story ("Implement story 1.5: hunger and starvation"), plus a separate commit for review fixes.
- Branch: `story/1-5-hunger-and-starvation`, created from `main` at `daf6955`.
- 1.4 tests: 97 passing in 16 files. Expect about 20 more from this story.

### Latest technical notes (checked 2026-10-06)

- The stack is unchanged since 1.4 (Phaser 4.2.1, Vite 8.3.2, TypeScript 6.0.3, Vitest 4.1.11). There are no new libraries, so no version research is needed.
- Phaser 4.2.1 `TextStyle.resolution` defaults to 0, meaning it uses the game config's resolution. Set it explicitly to the DPR for crisp text under FIT scaling.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.5: Hunger and Starvation]
- [Source: _bmad-output/planning-artifacts/epics.md#Requirements Inventory] FR1, FR2, FR42; AR3, AR7, AR12, AR13, AR17, AR18, AR19, AR22; UX-DR43, UX-DR57, UX-DR84, UX-DR90, UX-DR96, UX-DR97
- [Source: _bmad-output/planning-artifacts/gdds/gdd-sheep-civilization-2026-10-05/gdd.md#Hunger (Fullness stat)] Drain 100 → 0 over 120 s; Fed > 50, Hungry 50–25, Starving < 25; starting flock at Fullness 60
- [Source: _bmad-output/game-architecture.md#N1 — Single Death Pipeline], [#N2 — Abomination] (`PublicSheep` shape), [#State Patterns] (derived hunger/stage), [#Project Structure] (`systems/hunger.ts`, `systems/carcass.ts`, `view/widgets/Tooltip`)
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-sheep-civilization-2026-10-05/EXPERIENCE.md#Component Patterns] (Tooltip), [#State Patterns] (Fed/Hungry/Starving), [#Game Feel & Juice] (reduced motion never reduces thin/droop)
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-sheep-civilization-2026-10-05/DESIGN.md] `tooltip` component (dusk-deep, wool, body, rounded.sm, padding 8), Typography (body 18, DPR resolution), Elevation (tooltip in the HUD layer)
- [Source: _bmad-output/project-context.md] Critical Don't-Miss Rules, Performance Rules, Testing Rules
- [Source: _bmad-output/implementation-artifacts/1-4-developer-debug-overlay-and-error-safety-net.md] Debug API, Review Findings, Completion Notes
- [Source: _bmad-output/implementation-artifacts/deferred-work.md] NFR1 on hardware; Exit animations (2.4)

## Dev Agent Record

### Agent Model Used

Claude Opus 5.5 (1M context), `claude-opus-5-5[1m]`

### Implementation Plan

- **Red first:** wrote `hunger`, `carcass`, `selectors` and `starvation` tests before the code. 12 tests failed as expected; then the sim code went green.
- **Sim:**
  - `killSheep` in `systems/carcass.ts` (N1).
  - `updateHunger` in `systems/hunger.ts`, registered after movement.
  - `hungerOf`/`stageOf` in `selectors.ts`.
  - `PublicSheep` gains `stage` and `hunger`.
  - No `GameState` shape change, so no schema bump.
- **View:**
  - `SheepSprite` swaps frames only when hunger changes.
  - A generic `Tooltip` widget.
  - `SheepHover` hit-tests the rendered sprites each frame and shows the tooltip after 300 ms.
- **Art:** two placeholder frames composed from `adult-idle.png` by a throwaway scratchpad script (pure Node PNG codec, not committed).

### Debug Log References

- **Float drift check (Node):** without the epsilon, starting Fullness 100 dies on tick 1 201; with `FULLNESS_EPSILON = 1e-6`, ticks are 1 200 / 720 / 420 for starting Fullness 100 / 60 / 35.
- **Browser verification:** headless Chrome (SwiftShader) through scratchpad `playwright-core`, with a DEV server on port 5199 and a temporary `window.__probeGame` hook in `main.ts`. 26/26 checks passed:
  - **Timeline at ×16 (starting Fullness 60):**
    - First Hungry seen at 12.5 s; first Starving at 42.1 s; deaths at 72.5 s. Sampling is about every 50 ms of real time, roughly 0.8 s of game time per sample, which matches the expected 12 / 42 / 72 s.
    - The sprite frame matched the hunger state in every sample.
    - `stats.died` = 3, no sprites left, no console errors.
  - **Tooltip at 1280×820 and 960×620** (letterboxed, so the pointer can really leave the canvas):
    - Hidden at 120 ms; "Adult · Fed" after 300 ms, above the sheep and inside the margin.
    - Live change to "Adult · Hungry".
    - Hidden when the pointer leaves the canvas; shown again on re-hover.
    - Hidden when the hovered sheep starves.
    - After a debug Load (scene restart): exactly one tooltip `Text`, and hover works.
    - No console errors.
  - **Follows the sheep:** over 40 samples at ×1 the box stayed centred on the moving sprite.
  - **Edge clamp:** the widget, shown at (1275, 10), stays inside the 16 px margin and flips below the anchor.
  - **Screenshots** (scratchpad, not committed): starving sheep (thin, ribs, drooped head); the tooltip at 960×540-scale, which is legible.
  - **First run:** 6 checks failed because of test setup, not the game: the hovered sheep was a different, overlapping one; a synthetic `mouseout` in a viewport the canvas fills; and moving a sheep outside the fence. I fixed the test and re-ran: 26/26.
- **Cleanup:**
  - `src/main.ts` restored byte-identical to HEAD (`git diff --quiet`).
  - `grep` finds no `__probeGame` in `src/` or `dist/`, and no overlay strings ("Feed all") in `dist/`.
  - The dev server was stopped by its listening PID.

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created
- **AC 1:** a sheep at 100 is alive at `starveMs - TICK_MS` and dead on exactly the `starveMs` tick. The drain is derived from `TUNING.fullnessMax / starveMs`. (`hunger.test.ts`)
- **AC 2:** `hungerOf` is derived in selectors and never stored; frames are `adult-idle` / `adult-hungry` / `adult-starving`. Boundaries are tested; the frames were verified in the browser.
- **AC 3:** `killSheep` removes the sheep, counts the death, emits `SheepDied`, and creates no carcass while `carcassesEnabled` is false. It is the only code that filters `state.sheep`. (`carcass.test.ts`)
- **AC 4:** the tooltip reads "{Stage} · {Hunger}" after about 300 ms, follows the sheep, uses the `tooltip` component tokens, and reads only `PublicSheep`. Verified in the browser.
- **AC 5:** `starvation.test.ts`: seed 2026, `runFor(TUNING.starveMs)`; 3 deaths, 3 `SheepDied { cause: 'starved' }` events, and the state still survives a JSON round-trip.
- **AC 6:** `npm test` 113/113 in 20 files (was 97). Typecheck, lint and build are clean (the existing Phaser chunk-size warning only). No existing test needed changes; one was renamed (Task 10.5).
- **Deviations from the story text:**
  1. **Pointer leaving the canvas (Task 7.3):** `SheepHover` reads `input.manager.isOver`, which Phaser keeps current from the same GAME_OVER/GAME_OUT DOM events, instead of subscribing to them. It registers no listeners, so a restart has nothing to leak or double-subscribe.
  2. **`Tooltip.showAt(x, anchorTop, anchorBottom)`** takes both anchor edges, so it can flip below the sheep when there is no room above (Task 6.5). It also exposes a `visible` getter.
  3. **Time source:** hover timing uses `game.loop.time` (real frame time), so it works while the sim is paused or at ×16.
  4. **Tooltip placement:** decision 4 asked to record whether the tooltip stays in `GameScene`. It is in `GameScene` at `TOOLTIP_DEPTH = 10_000`; Story 1.6 may move sheep hover into `HudScene`.
- **Known limitation (pre-existing, debug-only):** `debugMutate` moving a sheep is not drawn until the next tick, because `SheepSprite` updates positions only when `state.time` changes. This does not affect play.
- **For Rylan:**
  - Decision D2: stage is derived now, so an interim adult fed past age 300 s reads "Elder" before Story 2.1.
  - Decision D3: one tooltip line until names exist.
  - The hunger frames are placeholders.
  - A new **Feed all** debug button exists, and the NFR1 note in `deferred-work.md` says to use it.

### Review Follow-up (2026-10-06)

The one decision is resolved (Rylan: tooltip text at resolution 1). All 7 patches were applied. 3 items are deferred to `deferred-work.md`.

- **Hunger bands:**
  - `FULLNESS_EPSILON` (1e-6) now lives in `selectors.ts` and is shared: `hungerOf` treats values within ε of 50 and 25 as on the bound, and `updateHunger` imports it for the empty check.
  - Two new tests: exact band-crossing ticks from `fullnessMax`, and every half-point start value checked tick by tick against the exact band. Both were confirmed to fail against the old `hungerOf`.
  - A Node sweep over 200 start values shows 0 mismatches. Rounding Fullness every tick was tried and rejected, because its error accumulates.
- **Drain clamp:** `Math.max(0, …)` was removed, because the ε branch sets 0. The misnamed test was renamed, and a new test checks that a sheep dies at exactly 0.
- **`killSheep` header:** it now documents that callers must loop over a captured array and rebuild the grid after a death.
- **Hover:** it uses `activePointer.worldX/worldY`.
- **Tooltip `Text`:** `resolution: 1`, with a comment explaining why DPR made the text rougher under `pixelArt` in a fixed 1280×720 framebuffer. This replaces the story's Task 6.4 instruction, by Rylan's decision.
- **Selectors test:** it derives from the flock size.
- **`deferred-work.md` NFR1 note:** it now gives the correct Feed all timing (within 60 s, then about every 90 s; reopen the overlay with backtick).
- **Verification:**
  - `npm test` 116/116; typecheck, lint and build are clean.
  - Headless browser re-run 26/26 with the temporary probe; it was removed afterwards and `src/main.ts` matches HEAD.

### File List

- `src/sim/systems/hunger.ts` (new)
- `src/sim/systems/carcass.ts` (new)
- `src/view/widgets/Tooltip.ts` (new)
- `src/view/field/SheepHover.ts` (new)
- `assets/art/sheep/adult-hungry.png` (new)
- `assets/art/sheep/adult-starving.png` (new)
- `public/assets/atlases/sheep-world.png`, `public/assets/atlases/sheep-world.json` (regenerated)
- `src/config/tuning.ts` (modified)
- `src/sim/selectors.ts` (modified)
- `src/sim/step.ts` (modified)
- `src/sim/events.ts` (modified)
- `src/view/field/SheepSprite.ts` (modified)
- `src/view/field/EntityLayer.ts` (modified)
- `src/view/scenes/GameScene.ts` (modified)
- `src/view/strings.ts` (modified)
- `src/view/assetKeys.ts` (modified)
- `src/debug/DebugOverlay.ts` (modified)
- `assets/CREDITS.md` (modified)
- `tests/sim/systems/hunger.test.ts` (new)
- `tests/sim/systems/carcass.test.ts` (new)
- `tests/sim/selectors.test.ts` (new)
- `tests/sim/scenarios/starvation.test.ts` (new)
- `tests/sim/step.test.ts` (modified: test renamed)
- `src/view/widgets/.gitkeep` (deleted)
- `_bmad-output/implementation-artifacts/deferred-work.md` (modified)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modified)
- `_bmad-output/implementation-artifacts/1-5-hunger-and-starvation.md` (this story)

## Change Log

| Date | Change |
|---|---|
| 2026-10-06 | Implemented hunger drain and starvation (`updateHunger`), the single death pipeline (`killSheep`, carcass gated off), derived hunger and stage selectors, hunger sprite frames, the reusable `Tooltip` widget with sheep hover, and a Feed all debug button. Tests 113/113; browser checks 26/26. Status → review. |
| 2026-10-06 | Code review: 1 decision (tooltip resolution 1), 7 patches applied (shared Fullness epsilon in `hungerOf`, drain clamp cleanup, `killSheep` caller note, world-coordinate hover, test fixes, NFR1 Feed all wording), 3 deferred. Tests 116/116. Status → done. |
