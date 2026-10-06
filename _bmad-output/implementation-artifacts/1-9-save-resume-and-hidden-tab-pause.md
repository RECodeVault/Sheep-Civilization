---
baseline_commit: 2b0b0aa4fe7fcf4ce934c072338fb527b7dd22ba
---

# Story 1.9: Save, Resume and Hidden-Tab Pause

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a player,
I want my flock saved automatically and the game to pause when I switch tabs,
so that I never lose progress or lose sheep while away.

## Acceptance Criteria

1. **Autosave (FR40, AR9).** Given play is running, when 10 real seconds pass or the tab becomes hidden, `saveStore` writes `{ schemaVersion, savedAt (ISO), state }` to `localStorage['sheepciv.save.v1']`.
   - The timer is real time (`setInterval`), not game time, and runs outside tick and frame code.
   - A state that fails validation is never written. The previous save is kept and a warning is logged.
   - A failed write (quota, blocked storage) logs one `log.warn('save', …)` and the game keeps running. Repeated failures do not spam the console.
2. **Resume (FR40, NFR6).** Given a valid save exists, when the game loads, the save is parsed, migrated if older, validated, and play resumes exactly where it stopped: same sheep (ids, positions, Fullness, activity, targets), food pieces, Farm bar, rng, stats and `time`.
   - A saved **lost** game resumes straight to the lose screen (1.8's `OverlayScene` already shows it at once on a lost state).
   - Until Story 1.10's Title screen exists, a valid save resumes automatically and no save starts a new game.
3. **Bad saves fall back (AR9).** Given a corrupt or unreadable save, a save from a newer or unmigratable version, or storage that throws, when the game loads:
   - `log.warn('save', …)` is recorded with the reason;
   - the save is discarded (removed from storage, inside its own try/catch);
   - a new game starts (only New Game is offered);
   - the game never crashes.
4. **Hidden-tab pause (FR41, UX-DR62, AR25).** Given the tab becomes hidden, when `visibilitychange` fires:
   - sim accumulation stops completely (no ticks while hidden, no catch-up burst on return);
   - a save is forced;
   - on return, play resumes with no overlay and a reset frame delta (`clock.reset()` and the first frame's delta ignored).
5. **Restart wipes the save, settings survive (UX-DR89).** Given a save and `sheepciv.settings`, when Lose → **Restart** runs (`GameScene.newGame()`), the save is wiped with no confirm and a new game starts. `sheepciv.settings` is never touched. The old scene's autosave cannot write the old game back after the wipe.
6. **Error handler saves first.** Given the global error handler from Story 1.4, when an unhandled error occurs after the game has started, it forces a save (inside its own try/catch, through the same validate-before-write path) before showing the toast "Something went wrong — your flock was saved."
7. **Save tests (NFR7, AR12).** When `npm test` runs:
   - a busy seeded scenario round-trips through `encodeSave`/`decodeSave` unchanged;
   - 10 save/load cycles produce state identical to an uninterrupted run with the same seed;
   - corrupt, wrong-version and invalid-field saves are rejected with a reason;
   - storage that throws on read, write or access falls back cleanly;
   - wiping the save keeps `sheepciv.settings`.
8. **Green gate.** `npm test`, `npm run typecheck`, `npm run lint` and `npm run build` all pass, and the debug overlay is absent from `dist/`.

## Tasks / Subtasks

- [x] **Task 1: Constants and lint** (AC: 1, 8)
  - [x] 1.1 In `src/config/constants.ts`, add `AUTOSAVE_MS = 10_000` next to `SAVE_KEY`, with a comment: "Real-time autosave interval (FR40). Not a game-time value, so it is not in TUNING."
  - [x] 1.2 **No `SAVE_SCHEMA_VERSION` bump** (stays 2). This story adds no `GameState` field.
  - [x] 1.3 `eslint.config.js`: change `group(['src/save/**/*.ts'], { storage: false })` to `{ storage: false, secrecy: false }`, so save validation and migrations may read `isAbomination` when Story 4.1 adds it (deferred from 1.1). Nothing reads it yet.
- [x] **Task 2: Validation — `src/save/validate.ts` (new)** (AC: 2, 3, 7)
  - [x] 2.1 Export `validateState(x: unknown): ValidationResult`, where `type ValidationResult = { ok: true; state: GameState } | { ok: false; reason: string }`. It is pure, never mutates its input, never throws, and the reason names the first failing field (e.g. `"sheep[3].fullness is not finite"`). Hand-written guards only: **no zod or other package**.
  - [x] 2.2 Rules. These close every Story 1.9 item in `deferred-work.md`:
    - `state` is a plain object (not an array, not null).
    - `time`: finite integer ≥ 0.
    - `nextId`: finite integer ≥ 1, **greater than every entity id**.
    - `rng`: integer in `[0, 0xFFFFFFFF]`.
    - `farmProgress`: integer in `[0, TUNING.farmPipsPerFood)`.
    - `lastEra`: one of `'pasture' | 'village' | 'town' | 'wool-empire'`.
    - `stats`: plain object; `died`, `sold`, `sacrificed`, `peakFlock` are non-negative integers; `moneyEarned` is a finite number ≥ 0; `peakFlock ≥ sheep.length`.
    - `sheep`, `foodPieces`, `carcasses`: arrays of plain objects.
    - Every entity `id` is a positive integer, **unique across all three arrays** (one `nextId` counter feeds them all).
    - Each sheep: `x`, `y`, `heading`, `bornAt`, `restUntil` finite; `fullness` finite in `[0, TUNING.fullnessMax]`; `bornAt ≤ time`; `activity` one of `'wander' | 'seekFood' | 'eating'`; `targetId` either absent or a positive integer (a stale id is fine: feeding reverts the sheep to `wander`); `x`/`y` inside `fenceBounds(state)`.
    - Each food piece: `x`, `y` finite and inside `innerFence(state)` (`createFoodPiece` clamps there, so values are exact). This stops a seeker from pressing on the rail for ever (1.7 review, "Claims never time out").
    - Each carcass: `x`, `y`, `createdAt` finite (empty in Epic 1; Story 2.4 relies on the shape).
    - `lostAt`: absent, or an integer with `0 ≤ lostAt ≤ time`. `null` or any other type is rejected.
    - `sheep.length === 0` with no `lostAt` is rejected: an empty pen that is not lost would run for ever (1.8 review).
    - Sheep present with `lostAt` set is **accepted** (debug "+10 sheep" after a loss makes it; 1.8 decision).
  - [x] 2.3 Extra unknown keys are tolerated and kept (a later field read by an older build is harmless). Write a comment saying so.
  - [x] 2.4 Add a header comment: "Every rule here exists because a bad value breaks a system silently (NaN never starves, a piece outside the inner fence is never reached). Add the new fields' rules in the story that adds the field, together with any `SAVE_SCHEMA_VERSION` bump."
- [x] **Task 3: Migrations — `src/save/migrations.ts` (new)** (AC: 2, 3, 7)
  - [x] 3.1 Export `type Migration = (state: Record<string, unknown>) => Record<string, unknown>` and `MIGRATIONS: Readonly<Record<number, Migration>>`, keyed by the version a migration upgrades **from** (`MIGRATIONS[2]` turns a v2 state into v3). Today it is empty: no version-1 save was ever persisted (constants comment), so v1 is rejected.
  - [x] 3.2 Export `migrate(version: number, state: unknown, table = MIGRATIONS): { ok: true; state: unknown } | { ok: false; reason: string }`:
    - `version === SAVE_SCHEMA_VERSION` → unchanged.
    - `version > SAVE_SCHEMA_VERSION` → `"save is from a newer version (N)"`.
    - Not a positive integer → rejected.
    - Older → apply `table[v]` for each `v` up to the current version; a missing step → `"no migration from version v"`. A migration that throws → rejected with its message.
  - [x] 3.3 The `table` parameter exists so tests can prove the chain with a fake migration. Production callers never pass it.
- [x] **Task 4: `src/save/saveFile.ts` — parse → migrate → validate** (AC: 2, 3, 7)
  - [x] 4.1 Keep `encodeSave(state, now)` and `SaveFile` as they are.
  - [x] 4.2 Replace the shape checks in `decodeSave` with: JSON parse → envelope check (plain object, `schemaVersion` number, `savedAt` string, `state` present) → `migrate` → `validateState`.
  - [x] 4.3 Add `decodeSaveResult(raw: string): ValidationResult` that returns the reason. `decodeSave(raw)` keeps its signature (`GameState | null`) for the debug overlay and wraps it.
  - [x] 4.4 Update the header comment (remove "Story 1.9 replaces…"; it is done).
- [x] **Task 5: Storage — `src/save/saveStore.ts` (new)** (AC: 1, 3, 5, 6, 7)
  - [x] 5.1 Storage injection, so tests run in Vitest's `node` environment with no DOM and no real `localStorage`:
    ```ts
    export interface StorageLike {
      getItem(key: string): string | null;
      setItem(key: string, value: string): void;
      removeItem(key: string): void;
    }
    /** null when storage is unavailable. Reading `localStorage` itself can throw (sandboxed iframe, blocked cookies). */
    export function defaultStorage(): StorageLike | null {
      try { return globalThis.localStorage ?? null; } catch { return null; }
    }
    ```
    `globalThis.localStorage` is allowed in `src/save/` only (lint group). Every function below takes `storage: StorageLike | null = defaultStorage()`.
  - [x] 5.2 `loadSave(storage?): GameState | null`:
    - Returns null with **no** log when there is no save (`getItem` returns null) or no storage.
    - On a throw from `getItem`, or a rejected save: `log.warn('save', \`Save unreadable; starting fresh: ${reason}\`)`, then `removeItem(SAVE_KEY)` in its own try/catch (AC 3: discarded), and return null.
    - On success: `log.info('save', 'Save loaded', { sheep, time })`.
  - [x] 5.3 `writeSave(state, storage?, now = new Date()): boolean`:
    - Validate first: `validateState(JSON.parse(JSON.stringify(state)))`, the same path a load takes, so `NaN` (stringified to `null`) is caught. On failure, `log.warn` and return false. **Never write a state that would not load.**
    - Then `setItem(SAVE_KEY, encodeSave(state, now))` in try/catch.
    - Warn on the first failure only. A module-level `writeFailing` flag suppresses repeats until a write succeeds again (quota or blocked storage would otherwise warn every 10 s).
    - `log.info('save', 'Autosaved', …)` as the architecture's example shows. It is stripped from production.
    - Encode once and reuse the string: one `JSON.stringify` for validation and one for writing is fine (10 s timer, not a frame). Do not stringify more than twice.
  - [x] 5.4 `wipeSave(storage?): void` → `removeItem(SAVE_KEY)` in try/catch. It **never** touches `SETTINGS_KEY` (UX-DR89).
  - [x] 5.5 `startAutosave(getState: () => GameState, storage?): () => void` (architecture: "autosave timer, visibility hook"):
    - Sets `setInterval(save, AUTOSAVE_MS)`. The interval callback skips when `document.hidden` (the hide handler already saved, and nothing changes while hidden).
    - Adds a `document` `visibilitychange` listener that saves when `document.hidden`.
    - `save` wraps `writeSave(getState(), storage)` in try/catch → `log.warn`. A timer callback must never throw into the page.
    - Returns `stop()`, which clears the interval, removes the listener, and is idempotent.
    - `getState` is read on each save, so it always gets the scene's current state object.
- [x] **Task 6: Boot loads the save** (AC: 2, 3)
  - [x] 6.1 Extract the probe from `GameScene.loadState` into an exported function in `GameScene.ts`: `export function stateCanRun(state: GameState): boolean`. It runs the same probe on a JSON copy (`selectPublicSheep`, `fenceBounds`, `step`, `selectPublicSheep`, `selectLoseView`), clears events in `finally`, and logs `log.warn('save', …)` on a throw. `loadState` calls it. Keep its comment about Phaser's restart queue getting stuck.
  - [x] 6.2 In `PreloadScene.create`: `const saved = loadSave(); const state = saved !== null && stateCanRun(saved) ? saved : undefined;`. If a save loaded but cannot run, `wipeSave()`. Then `this.scene.start('GameScene', state ? { state } : {})`.
    - Update the header comment: TitleScene (1.10) will take over the Continue/New Game choice; until then a valid save resumes automatically.
  - [x] 6.3 `GameScene.create` keeps `data?.state ?? createNewGame(...)` and consumes `data.state` as today. Update the "Story 1.9 swaps this for load-or-new" comment: the load happens in PreloadScene (and Title in 1.10). GameScene never reads storage itself, so `restart({})` can never resurrect a wiped save.
- [x] **Task 7: GameScene — autosave, hidden-tab pause, wipe on Restart** (AC: 1, 4, 5)
  - [x] 7.1 In `create()`, after the state is set: `const stopAutosave = startAutosave(() => this.state);` and keep it as `this.stopAutosave`. Call it in the existing SHUTDOWN handler.
  - [x] 7.2 Hidden-tab clock (AR25):
    - Add `private hidden = false;`, initialised in `create()` from `document.hidden` (a game opened in a background tab must not tick on its first frame).
    - Subscribe to `this.game.events` `Phaser.Core.Events.HIDDEN` and `Phaser.Core.Events.VISIBLE` (Phaser's VisibilityHandler emits them from `visibilitychange`; check `node_modules/phaser/src/core/Game.js` `onHidden`/`onVisible` and the `events-system` skill, not memory).
    - **These are game-level emitters that outlive the scene:** remove both with `this.game.events.off(…, handler, this)` in SHUTDOWN, or every restart adds a handler.
    - HIDDEN: `this.hidden = true`. (Saving on hide is `startAutosave`'s listener, Task 5.5, so there is one save path.)
    - VISIBLE: `this.hidden = false; this.clock.reset(); this.skipDelta = true;`.
    - In `update()`: when `this.hidden`, do not call `clock.advance`. When `skipDelta`, call `advance(0)` once (or skip it) and clear the flag, so the first frame back adds nothing. Keep `render()` running.
    - Pending commands while hidden: none can arrive (no input in a hidden tab). Do not change command handling here; pausing and commands are 1.10's (deferred "Commands and pausing").
    - Phaser already calls `loop.pause()`/`resume()` → `resetDelta()` on hide/show, and the clock clamps frames to 250 ms. The explicit flag and reset still matter: they make the rule ours, testable in the browser, and safe if Phaser's behaviour changes. Say so in a comment.
    - **Do not** use `scene.pause()` (project rule).
  - [x] 7.3 `newGame()`: replace the hook comment with, in this order:
    1. `this.stopAutosave()`. Stop first: a timer firing between the wipe and the queued restart would write the lost game back.
    2. `wipeSave()`.
    3. `this.scene.restart({})`.
  - [x] 7.4 `loadState` (debug Load) is unchanged apart from using `stateCanRun`. The restarted scene autosaves the loaded state on its own timer.
- [x] **Task 8: Safety net forces a save** (AC: 6)
  - [x] 8.1 In `src/view/safetyNet.ts`, add `let forceSave: (() => void) | null = null;` and `export function setForceSave(fn: (() => void) | null): void`.
  - [x] 8.2 In `reportError`, replace the `// Story 1.9: forceSave()…` comment with: `if (gameStarted && forceSave) { try { forceSave(); } catch (e) { console.error('[save] Forced save failed', e); } }`. It sits before the toast. Do not call `reportError` from inside it (recursion).
  - [x] 8.3 In `GameScene.create`: `setForceSave(() => { writeSave(this.state); })`. In SHUTDOWN: `setForceSave(null)`. Restart re-registers it.
  - [x] 8.4 **Decision on deferred "Saving after a sim error" (1.4):** the forced save goes through `writeSave`, which validates first. A half-mutated state that is still valid is saved; one that is not valid is refused, and the last good autosave stays. Mark that deferred item resolved this way.
- [x] **Task 9: Tests (red first)** (AC: 2, 3, 5, 7)
  - [x] 9.1 `tests/save/validate.test.ts`:
    - A new game and a busy state (see 9.4) are `ok` and return the same object.
    - `it.each` rejections, one per rule in 2.2. Build each case from a valid state's JSON copy, changing one field:
      - non-finite `x`/`y`/`heading`/`fullness`/`bornAt`/`restUntil` (use `1e999` in raw JSON or set `NaN` on the object);
      - duplicate ids (sheep vs sheep, and sheep vs food piece);
      - `nextId` ≤ max id;
      - fractional, negative or `≥ farmPipsPerFood` `farmProgress`;
      - unknown `activity`;
      - `targetId: null` and `targetId: 1.5`;
      - a piece outside the inner fence;
      - a sheep outside the fence;
      - `fullness` above `fullnessMax`;
      - `rng` negative or above 2³²−1;
      - bad `lastEra`;
      - stats missing, negative, or with `peakFlock` below the flock size;
      - `lostAt` as `null`, a string, negative, fractional or `> time`;
      - zero sheep with no `lostAt`.
    - The reason string names the field.
    - Valid edge cases pass: zero sheep **with** `lostAt`; sheep with `lostAt` (debug case); an absent `targetId`; extra unknown keys.
    - The input is not mutated (compare to a `structuredClone` taken before).
  - [x] 9.2 `tests/save/migrations.test.ts`:
    - The current version passes unchanged.
    - Version 1 fails with "no migration from version 1".
    - A newer version fails.
    - `0`, `-1`, `1.5` and `'2'` fail.
    - The chain works: migrating from `SAVE_SCHEMA_VERSION - 1` with an injected table `{ [SAVE_SCHEMA_VERSION - 1]: s => ({ ...s, migrated: true }) }` returns a state with the marker.
    - A throwing migration is rejected with its message.
  - [x] 9.3 `tests/save/saveFile.test.ts` (extend): the existing reject cases still pass; add the envelope cases (`savedAt` missing or not a string) and a field-level case (`NaN` fullness) through `decodeSave`, and check that `decodeSaveResult` returns the reason.
  - [x] 9.4 `tests/save/roundTrip.test.ts`:
    - **Busy scenario:** seed fixed. `fillFlock(state, 12)`, apply `Farm` enough times to drop several pieces and leave the bar mid-way (e.g. `farmPipsPerFood * 3 + 3` commands through `applyCommand`), then `runFor` a few seconds, so some sheep are `seekFood` with a `targetId`, some `eating`, and pieces remain. Assert that the state really is busy (at least one `seekFood`, at least one piece, `farmProgress > 0`) before testing, so the test cannot pass vacuously. Then `decodeSave(encodeSave(state))` `toStrictEqual(state)`.
    - **10 cycles (NFR7):** two states from the same seed, set up the same way. A runs `runFor(10 × chunk)`. B, 10 times: `runFor(chunk)`, then `B = decodeSave(encodeSave(B))!`. Expect `B` `toStrictEqual(A)`, and the events after the reload to match too. Use `chunk = 5_000` (a multiple of `TICK_MS`).
    - **Lost game:** starve to loss, round-trip, `lostAt` kept, `isLost` true.
  - [x] 9.5 `tests/save/saveStore.test.ts` with a `MemoryStorage implements StorageLike` (a Map) and a `ThrowingStorage` (each method can be set to throw `DOMException`-like errors; plain `Error` is fine in node):
    - `writeSave` then `loadSave` returns an equal state; the stored JSON has `schemaVersion`, ISO `savedAt` (pass a fixed `now`) and `state`.
    - `loadSave` with nothing stored → null, no warn.
    - `loadSave` with garbage, `{}`, a v1 envelope and a NaN-field save → null, one `log.warn` with tag `save` (spy on `console.warn`; that is the log sink, not a sim internal), and the key is **removed**.
    - `getItem` throws → null and a warn, no throw. `removeItem` also throwing → still no throw.
    - `setItem` throws (quota) → `writeSave` returns false and warns once. A second failure does not warn again; a success re-arms the warning.
    - `writeSave` of an invalid state (set a sheep's `fullness = NaN`) returns false and leaves the earlier save in place.
    - `storage === null` → load returns null, write returns false, wipe is a no-op; none throw.
    - **Settings survive:** put a value under `SETTINGS_KEY`, write a save, `wipeSave` → the save key is gone and the settings value is unchanged.
    - `startAutosave` is not unit-tested (it needs timers and `document`, and fake timers are banned in sim tests). It is verified in the browser (Task 10).
  - [x] 9.6 Keep using `newGame(seed)` with fixed literal seeds, `runFor`, and `TUNING` values in assertions. No `vi.useFakeTimers()`.
- [x] **Task 10: Browser verification** (AC: 1–6)
  Use the 1.8 approach: a scratchpad `playwright-core` probe with system Chrome, a DEV server, and a temporary `window.__probeGame` hook removed afterwards. Check these:
  - **Autosave:** on a new game, `localStorage['sheepciv.save.v1']` appears within about 10 s and parses to the envelope. Its `time` advances on each later save.
  - **Resume:** farm a few pieces, wait for a save, record the saved `state`, then reload. After boot, the live state equals the saved one (with no `step` yet: compare before the first tick, or pause with debug speed 0 first via `simClock.speed = 0` before the save). Sheep ids and positions, pieces, the "{n}/8" bar and time all match.
  - **10 reloads (NFR7):** reload 10 times with saves in between. No console errors, and the state stays valid.
  - **Hidden tab:** simulate with `Object.defineProperty(document, 'hidden', { value: true, configurable: true })` and `Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })` plus `document.dispatchEvent(new Event('visibilitychange'))`, or use CDP `Page.setWebLifecycleState` / a second tab brought to the front. Check that:
    - a save is written at once;
    - `state.time` does not advance while hidden, even with the game loop running;
    - after making it visible, no overlay shows and `time` advances by at most one tick in the first frame (no burst).
  - **Lost game resume:** lose (×16), wait for a save or hide the tab, reload. The lose screen shows at once with the same stats.
  - **Restart wipes:** after the loss, set `localStorage['sheepciv.settings'] = '{"probe":1}'`, click Restart. The save key is gone at once (then rewritten by the new game's first autosave about 10 s later with `time` near 0). The settings value is unchanged. Reloading straight after Restart starts a fresh game, not the lost one.
  - **Corrupt save:** set the key to `'not json {'`, reload. A `[save]` warn appears, a new game starts, and the bad key is removed.
  - **Storage blocked:** add an init script that makes `Storage.prototype.getItem`/`setItem` throw. The game boots to a new game and plays; warnings show, and there are no errors or toasts.
  - **Error handler:** in the probe, throw inside a `setTimeout` (an unhandled error). The save is rewritten (`savedAt` changes) before the toast appears.
  - **Listener hygiene:** after 3 Restarts, `game.events.listenerCount('hidden')` and `('visible')` are unchanged from the first game (Phaser's own handler, plus exactly one from GameScene), and only one autosave interval is live: one write per 10 s.
  - Remove the probe hook afterwards and check that `dist/` has no `__probe`.
- [x] **Task 11: Docs and deferred work** (AC: 8)
  - [x] 11.1 In `_bmad-output/implementation-artifacts/deferred-work.md`, mark each Story 1.9 item **Resolved in Story 1.9** with one line on how:
    - "`isAbomination` lint rule versus saving" (1.1);
    - "Non-finite values in a save" and "Sprites across a state swap" (1.3): a load is always a scene start or restart, so sprites are rebuilt;
    - "Saving after a sim error" (1.4): validate before every write;
    - "Non-finite hunger fields" (1.5);
    - "Save validation for the new fields" (1.7);
    - the 1.9 part of "Claims never time out" (1.7 review);
    - "Restart wipes the save" and "Validating `lostAt`" (1.8);
    - "0 sheep without `lostAt`" and "`lostAt` shape" (1.8 review).
  - [x] 11.2 Add a new section, "Deferred from: story 1-9-save-resume-and-hidden-tab-pause", for anything that comes up. Expected: **(1.10)** TitleScene takes over the load decision from PreloadScene (Continue only when `loadSave` would succeed; New Game with a save → confirm → `wipeSave`); pause (Esc) and hidden-tab pause must both stop the clock without fighting each other (two flags, either one stops it). **(5.7)** `settingsStore.ts` (volumes, reduced motion, captions) under `SETTINGS_KEY` with the same try/catch pattern.

### Review Findings

- [x] [Review][Patch] Back up a rejected save before wiping it (Rylan: back up, then delete): copy the raw text to `sheepciv.save.v1.bad` (one slot), then remove the save; add the key to constants and project-context [src/save/saveStore.ts:47] (blind+edge)
- [x] [Review][Decision] Unreadable storage leaves the save in place — **Resolved (Rylan): keep the save.** A transient read failure must not destroy progress; Task 5.2 / AC 3 wording is superseded for this case (Dev Record deviation 3). (auditor+edge)
- [x] [Review][Patch] Stop saving after a sim error (Rylan): after a `sim`-source error, refuse all saves for the session so the last good save survives; the toast says "your flock was saved" only when the forced save wrote, otherwise a plain error toast [src/view/safetyNet.ts:97] (blind+edge+auditor)
- [x] [Review][Defer] Two open tabs overwrite one save; Restart in one tab is undone by the other [src/save/saveStore.ts:104] — deferred (Rylan): rare for this kind of game
- [x] [Review][Patch] Forced save can write the lost game back after Restart's wipe: clear it in `newGame()` (and `loadState`) [src/view/scenes/GameScene.ts:164] (blind+edge+auditor)
- [x] [Review][Patch] Validation-refused writes warn every 10 s: throttle like `writeFailing` [src/save/saveStore.ts:73] (blind+edge+auditor)
- [x] [Review][Patch] `writeSave` encode/parse is outside its try/catch [src/save/saveStore.ts:71] (blind)
- [x] [Review][Patch] The "removing throws too" test never reaches `removeItem`; test a rejected save with a throwing `removeItem` [tests/save/saveStore.test.ts:88] (blind+auditor+edge)
- [x] [Review][Patch] Module-level `writeFailing` leaks between tests: add a test-only reset used in `beforeEach` [src/save/saveStore.ts:32] (blind+edge)
- [x] [Review][Patch] Weak assertions: `'state that is null'` matches nearly any reason; `saveWarnings() > 0` does not pin the count [tests/save/validate.test.ts:79] (edge)
- [x] [Review][Patch] Counters accepted up to `MAX_SAFE_INTEGER` can overflow into an unsavable state: cap `time`, `nextId` and stats at a realistic maximum [src/save/validate.ts:38] (edge)
- [x] [Review][Patch] `project-context.md` still says `isAbomination` is read only in `src/sim/` and `src/debug/`; add `src/save/` [_bmad-output/project-context.md:97] (auditor)
- [x] [Review][Patch] `startAutosave` has no tests: cover the interval, skip-while-hidden, hide-save and idempotent `stop()` with a stubbed `document` and fake timers (save layer, not the sim) [src/save/saveStore.ts:104] (blind+edge)

## Dev Notes

### What exists today (read before changing)

- **`src/save/saveFile.ts`:** `encodeSave(state, now)` builds `{ schemaVersion: SAVE_SCHEMA_VERSION, savedAt: now.toISOString(), state }`. `decodeSave(raw)` does `JSON.parse` + a shape check (`schemaVersion === 2`, `time` finite, three arrays). It is used by the debug overlay's Copy/Load save. **Preserve** both signatures; `tests/save/saveFile.test.ts` covers them.
- **No `saveStore.ts`, `validate.ts`, `migrations.ts` or `settingsStore.ts` yet.** Nothing touches `localStorage` today.
- **`src/config/constants.ts`:** `SAVE_KEY = 'sheepciv.save.v1'`, `SETTINGS_KEY = 'sheepciv.settings'`, `SAVE_SCHEMA_VERSION = 2`, whose comment explains the 1.7 bump and the 1.8 no-bump rule.
- **`src/view/scenes/PreloadScene.ts`:** `create()` checks the atlases, then `this.scene.start('GameScene')` with no data. This is where the load goes (Task 6).
- **`src/view/scenes/GameScene.ts`:**
  - `create(data)` sets `this.state = data?.state ?? createNewGame(Math.floor(Math.random() * 2 ** 32))` and then deletes `data.state` (Phaser reuses restart data otherwise).
  - It builds the clock, pools, fence, hover and `InputController`; `bus.on('sim')` with a SHUTDOWN cleanup; it launches `HudScene` and `OverlayScene`.
  - `update()` skips ticking when `isLost`, and otherwise `clock.advance(this.game.loop.rawDelta)`. **Preserve** the `rawDelta` comment, the `reportError('sim')` guard and the lost branch.
  - `newGame()` holds the marked `// Story 1.9: saveStore.wipe() here` hook.
  - `loadState(state)` probes a JSON copy, then `scene.restart({ state })`.
  - The debug API (`simClock`, `stepOnce`, `debugMutate`) must keep working.
- **`src/core/fixedStep.ts`:** `FixedStepClock.advance(delta)` clamps to `MAX_FRAME_MS` (250) and handles non-finite deltas. `reset()` drops the accumulator ("e.g. after the tab becomes visible again"). It was built for this story.
- **`src/view/safetyNet.ts`:** `reportError` holds the marked `// Story 1.9: forceSave() here…` hook before the toast. `markGameStarted()` is called from `GameScene.create`. The watchdog already treats `document.hidden` specially; leave it alone.
- **`src/debug/DebugOverlay.ts`:** Copy save (`encodeSave`) and Load save (`decodeSave` → `scene.loadState`). With stricter `decodeSave`, hand-edited saves that were accepted before may now say "invalid save", which is correct. Speed ×16 and speed 0 are the browser-test tools.
- **`src/sim/selectors.ts`:** `fenceBounds(state)` and `innerFence(state)` are the bounds validation uses. They are pure, so `src/save/` may import them.
- **Phaser visibility:** `VisibilityHandler` emits `HIDDEN`/`VISIBLE` on `game.events`. `Game.onHidden` calls `loop.pause()`, and `onVisible` calls `loop.resume()` → `resetDelta()` and emits `RESUME`. Verified in `node_modules/phaser/src/core/Game.js` (lines ~565–615) and `TimeStep.js` (`resume`, `resetDelta`).

### Gotchas

1. **Stop autosave before wiping** (Task 7.3). Otherwise an interval tick between `wipeSave()` and the queued restart writes the lost game back, and a reload resurrects it.
2. **`game.events` outlives scenes.** HIDDEN/VISIBLE handlers added in `GameScene.create` must be removed on SHUTDOWN, or each Restart adds one more. The same goes for the `document` listener in `startAutosave`: its `stop()` runs on SHUTDOWN.
3. **Validate the JSON copy, not the live object.** `NaN` is `typeof 'number'` but becomes `null` in JSON. Validating `JSON.parse(JSON.stringify(state))` checks exactly what a load will see.
4. **`loadSave` must remove a bad save,** or it warns on every boot. But it must **not** remove a save just because `storage` is `null`.
5. **A newer-version save is discarded too** (AC 3). That only happens if a player loads an older cached build; acceptable per the architecture ("on any failure… discard").
6. **No logging, `JSON.stringify` or storage in tick or frame code.** Saving runs only from the interval, the visibility listener, the safety net and `newGame` (wipe). Never from `update()`.
7. **Do not read `document.hidden` per frame for the pause.** Use the flag set by the HIDDEN/VISIBLE events (and the initial value in `create`).
8. **Vitest runs in `node`:** there is no `localStorage`, `document` or `window`. `saveStore` must not touch `document` at import time, only inside `startAutosave`. Tests use the injected storage.
9. **Phaser 4, not 3:** check `node_modules/phaser/skills/{events-system,scenes}/` for `game.events` and `Phaser.Core.Events` names before writing them.
10. **`createNewGame` seed** stays `Math.random` in GameScene (view code). Resume restores `state.rng`, so a resumed game continues the same random sequence; that is what the 10-cycle test proves.
11. **Do not create `settingsStore.ts`** in this story. Nothing writes settings until 5.7. AC 5 is met by `wipeSave` touching only `SAVE_KEY`, which a test proves.
12. **Hidden-tab pause and Story 1.10's Esc pause** will both stop the clock. Keep `hidden` as its own flag so 1.10 can add `paused` alongside it, and do not reuse `simClock.speed = 0` (the debug pause) for either.

### Architecture compliance

- **Only `src/save/` touches storage** (lint-enforced). Scenes call `loadSave`/`writeSave`/`wipeSave`/`startAutosave`, never `localStorage`.
- **`src/sim/` stays pure.** Validation and migrations live in `src/save/` and may import from `sim` and `config`, never the reverse.
- **AR9 load order:** parse → schema check → migrate → validate → resume; any failure → `log.warn('save')` → discard → New Game.
- **AR25:** hidden → stop accumulation, force save (music pause arrives with AudioDirector in 5.6); visible → no overlay, reset delta.
- **Pause = stop accumulating**, never `scene.pause()`.
- **No new dependencies.**

### File list (expected)

- **New:** `src/save/saveStore.ts`, `src/save/validate.ts`, `src/save/migrations.ts`, `tests/save/validate.test.ts`, `tests/save/migrations.test.ts`, `tests/save/roundTrip.test.ts`, `tests/save/saveStore.test.ts`
- **Modified:**
  - `src/save/saveFile.ts`
  - `src/config/constants.ts` (`AUTOSAVE_MS`)
  - `src/view/scenes/GameScene.ts`, `src/view/scenes/PreloadScene.ts`, `src/view/safetyNet.ts`
  - `eslint.config.js`
  - `tests/save/saveFile.test.ts`
  - `_bmad-output/implementation-artifacts/deferred-work.md`

### Previous story intelligence (1.8)

- **Red first** for sim and save rules. Assert on state and drained events; use `TUNING`, fixed seeds and `runFor`.
- **Handlers that run outside the tick** (timers, DOM events, Phaser input) need their own try/catch; a throw there reaches the safety net as an unhandled error.
- **Listener hygiene across restarts** was checked with "exactly one listener after 3 restarts". Repeat it for `game.events` HIDDEN/VISIBLE and the autosave interval.
- **The 1.8 review found vacuous assertions** (`lostAt === state.time` always held). Make the busy-scenario test prove it is busy, and make the 10-cycle test compare against an uninterrupted run, not against itself.
- **1.8 left marked hooks** for this story: `GameScene.newGame` (wipe) and `safetyNet.reportError` (forceSave). Replace the comments; do not leave them.
- **Browser probes:** keep them in the scratchpad, remove the hook afterwards, and confirm `dist/` is clean.

### Git intelligence

- Commits follow "Implement story X", then "Apply story X code review fixes".
- This story's branch is `story/1-9-save-resume-and-hidden-tab-pause`, off `main` at `2b0b0aa`.
- `src/save/saveFile.ts` dates from 1.2 and changed in 1.7 (schema 2). `tests/save/saveFile.test.ts` gained the lost-game round trip in 1.8.

### Latest tech information

- No new dependencies. Stack pinned: Phaser ~4.2.1, TS ~6.0, Vite 8, Vitest ~4.1 (`environment: 'node'`), Node ≥ 24.
- **Web Storage:** `localStorage.setItem` throws `QuotaExceededError` (a `DOMException`) when full. Reading the `localStorage` property itself throws `SecurityError` when storage is blocked (third-party iframes with cookies blocked, which can hit the itch.io embed). Both need the try/catch in `defaultStorage` and around each call.
- **Page Visibility:** `visibilitychange` with `document.hidden === true` fires on tab switch, minimise, and on tab close / navigation away in current Chrome, Firefox and Edge. This makes it the reliable last chance to save (more so than `beforeunload`/`unload`). Background tabs throttle `setInterval` to at most once a minute, which is why the hide-save matters.
- Node 24's own `localStorage` global needs `--localstorage-file`; do not rely on it in tests. Inject `StorageLike`.

### Project Structure Notes

- `saveStore.ts`, `validate.ts` and `migrations.ts` go in `src/save/`, as the architecture's directory tree shows. Tests go in `tests/save/` (round-trip, migration, corrupt-save).
- **Variance:** the architecture puts "visibility hook" in `saveStore`. Here the hide-**save** is in `saveStore.startAutosave`, while the hide-**pause** (clock) is in `GameScene`, because only the scene owns the clock. Both hang off the same browser event.
- **Variance:** the load runs in `PreloadScene` until `TitleScene` (1.10) exists.

### Project Context Rules

- Only `src/save/` touches `localStorage`; wrap every access in try/catch, and the game must run with storage unavailable.
- Keys `sheepciv.save.v1` and `sheepciv.settings` only.
- Hidden tab = full pause; no offline progress, ever. On visible: no overlay, reset the frame delta.
- No logging, `JSON.stringify` or localStorage in tick or frame code; autosave runs on its own 10 s timer.
- `GameState` is plain JSON; adding a field means bumping `SAVE_SCHEMA_VERSION` and adding a migration (none added here).
- Listener cleanup on SHUTDOWN; restart must not double-subscribe.
- Vitest covers `src/sim/` and `src/save/` only; no fake timers; `TUNING` in assertions; the save tests are mandatory and stay green.
- Done = `npm test`, `npm run typecheck`, `npm run lint` and `npm run build` pass; behaviour is verified in the browser.

### References

- Epic story: `_bmad-output/planning-artifacts/epics.md`, "Story 1.9"; FR40, FR41, NFR6, NFR7, AR9, AR12, AR25, UX-DR62, UX-DR89.
- Architecture: `_bmad-output/game-architecture.md`:
  - Data Persistence;
  - Game Time (pause = stop accumulating);
  - Error Handling (boundary `loadSave` example, unhandled → force save);
  - Logging (`log.info('save', 'Autosaved', …)`);
  - Directory Structure (`src/save/`);
  - Consistency Rules.
- UX: `EXPERIENCE.md` State Patterns ("Hidden tab", "Save exists", "No save"); Accessibility Floor ("Settings persistence", "Pausing"); Component Patterns ("Lose panel": Restart wipes the save).
- GDD: `gdd.md` Save (autosave 10 s and on hide; exact resume; Restart after a loss clears the save), Pause, Success criteria ("No save corruption across 10 reload cycles").
- Project rules: `_bmad-output/project-context.md` (Platform & Build: Visibility, Persistence).
- Previous story: `1-8-losing-the-flock.md`. Deferred items: `deferred-work.md` (every "Story 1.9" entry).

### Questions for Rylan (non-blocking; the defaults above apply)

1. **Load before the Title screen:** until 1.10, a valid save resumes automatically at boot. OK, or should 1.9 always start new and leave resuming to 1.10's Continue?
2. **Discarding bad saves:** an invalid or newer-version save is removed from storage (AC 3, "discarded"). Prefer to keep it (just ignore it) until the next autosave overwrites it?
3. **Saving after a sim error:** the default is validate-then-save (an invalid state is never written; the last good save stays). Alternative: never force a save for `sim` errors.

## Dev Agent Record

### Agent Model Used

Claude Opus 5.5 (1M context), `claude-opus-5-5[1m]`

### Implementation Plan

- **Red first (save):** `validate`, `migrations`, `saveFile`, `roundTrip` and `saveStore` tests were written before the code. The red run had 5 failing files (missing modules, no `decodeSaveResult`).
- **`src/save/`:**
  - `validate.ts`: hand-written guards that stop at the first bad field and name it. Entities are checked before `nextId`, so a bad field is reported rather than the id it uses.
  - `migrations.ts`: an empty table and a `migrate()` chain (newer, bad, or missing-step versions are rejected).
  - `saveFile.ts`: `decodeSaveResult` (JSON → envelope → migrate → validate); `decodeSave` wraps it.
  - `saveStore.ts`: injected `StorageLike`; `loadSave` (discards bad saves), `writeSave` (validate the JSON copy, then write; warn once while failing), `wipeSave` (save key only), `startAutosave` (10 s interval skipped while hidden, plus a hide-save on `visibilitychange`; idempotent stop).
- **View:**
  - `PreloadScene` loads the save and starts `GameScene` with it if `stateCanRun`; otherwise it wipes and starts fresh.
  - `GameScene` starts autosave, registers the forced save, and pauses on Phaser's HIDDEN/VISIBLE game events (`hidden` flag; `clock.reset()` and a zero first delta on return). It removes all of these on SHUTDOWN. `newGame()` stops autosave, wipes, then restarts. The probe moved into the exported `stateCanRun`.
  - `safetyNet.reportError` calls the registered save before the toast.

### Debug Log References

- **Browser probe** (scratchpad `probe19.mjs`, `playwright-core` with system Chrome on SwiftShader, DEV server on port 5199, temporary `__probeGame` hook). **19/20 on the main run; the remaining check passed on a separate run (below):**
  - **Autosave:** no save at boot; the envelope appears at 10 s (`schemaVersion` 2, ISO `savedAt`, time 10 000).
  - **Hide:** saves the live state at once.
    - With Phaser's loop resumed by hand (18 frames ran), game time stayed at 10 000.
    - On return, the first frames added +0 ms and play resumed (+1 000 ms in 1 s) with no overlay.
  - **Reload resume:** same ids 1,2,3, bar 5/8, `nextId` and peak; time 11 000 → 11 000; no sheep moved.
  - **10 reloads:** the same game, time only grew, no console errors.
  - **Lost game:** saved with `lostAt`; on reload the lose screen shows at once with "Survived 0:12 · Peak flock 3".
  - **Restart:** the save key is gone at once and the settings key is unchanged. A reload straight afterwards is a fresh game (time 100).
  - **Listeners:** after 3 restarts the hidden/visible listener counts are 2,3 → 2,3, and there is exactly 1 autosave write in 10.6 s.
  - **Unhandled error** (`setTimeout` throw): `savedAt` changed, then the toast "Something went wrong — your flock was saved." showed. No other console errors.
  - **Blocked storage** (`Storage.prototype` methods throw): a new game runs, with 2 `[save]` warnings, no errors and no toast.
  - **Corrupt save:** this check failed in the main probe because of the probe's own timing, after a long run on that page. A separate run (`corrupt.mjs`) showed `[save] Save unreadable; starting fresh: not valid JSON`, the key removed, and a new game of 3 sheep at time 0.
- **Cleanup:** the hook was removed (`src/main.ts` has no diff from HEAD), the dev server was stopped, and `dist/` has no `__probe` or debug strings.

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created
- **AC verdicts:**
  - **AC 1:** the 10 s autosave and hide-save both write the envelope (browser). Invalid states are refused, and write failures warn once (unit tests).
  - **AC 2:** the busy round trip, and 10 cycles equal to an uninterrupted run (unit tests). Reload resumes the same game, and a lost save resumes to the lose screen (browser).
  - **AC 3:** corrupt, v1, newer-version, NaN-field and throwing-storage saves fall back: warn, remove, new game (unit tests and browser).
  - **AC 4:** no ticks while hidden even with the loop running, a save on hide, and no burst or overlay on return (browser).
  - **AC 5:** Restart stops autosave, wipes the save key only, and starts fresh. Settings are kept (unit test and browser).
  - **AC 6:** the forced save runs before the toast (browser).
  - **AC 7:** 91 new save tests; 244 in total across 26 files.
  - **AC 8:** `npm test`, typecheck, lint and build are clean (only the existing Phaser chunk-size warning), and `dist/` is clean.
- **Deviations and decisions:**
  1. **Forced save on the toast's cooldown.** `reportError` can run every frame while an error repeats, so the forced save runs only when the toast is shown (at most once per 10 s). The toast's claim still always follows a save.
  2. **The 10-cycle test drops one full Farm bar per chunk** in both runs, so feeding (≥ 5 `FoodEaten`) runs across the reloads. Without it, the comparison covered almost no eating. Seed 2 is used because seed 808 was not busy.
  3. **`loadSave` does not wipe when `getItem` itself throws:** the storage is unreadable, so removing would fail too. It warns and returns null.
  4. **No `SAVE_SCHEMA_VERSION` bump and no `settingsStore.ts`,** as the story planned.
- **For Rylan:** the three Dev Notes questions stand. The defaults are built: auto-resume at boot until 1.10, discard bad saves, and validate-then-save after errors.

### Review Follow-up (2026-10-06)

The review found 4 decisions, 9 patches, 0 deferred items and 6 dismissed. The decisions became 2 patches, 1 resolved as-is and 1 deferred.

- **Decisions (Rylan):**
  - Back up a rejected save, then delete it → patch.
  - Keep the save when storage cannot be read → resolved; it stays as built.
  - Stop saving after a sim error, and say "saved" only when it was → patch.
  - Two tabs → deferred ("rare for this kind of game").
- **Patches applied (11):**
  - **Backup:** `SAVE_BACKUP_KEY` (`sheepciv.save.v1.bad`). `discardSave` copies the raw save there before removing it; it is used by `loadSave` and by PreloadScene's `stateCanRun` fallback.
  - **Saving after errors:** `blockSaving`/`allowSaving`. `reportError('sim')` blocks saving, `GameScene.create` allows it again, and `forceSave` returns whether it wrote. The toast is "Something went wrong — your flock was saved." only when it did, otherwise "Something went wrong. Try reloading the page."
  - **Restart and debug Load:** `newGame()` and `loadState()` now stop autosave and clear the forced save before the wipe or restart.
  - **Warnings:** invalid-state and encode failures warn once until a successful write.
  - **`writeSave` never throws:** encode and parse are inside the try.
  - **Counter cap:** `time`, ids and counters are capped at 2^48 (`COUNTER_MAX`).
  - **Docs:** `project-context.md` now lists `src/save/` as an `isAbomination` reader, and the backup key under Persistence.
  - **Test fixes:** `resetSaveStoreForTests` runs in `beforeEach`; the rejected-save-with-throwing-`removeItem`/`setItem` case is now tested; the null-state and warning-count assertions were tightened.
  - **New tests:** `startAutosave` (interval, current state read on each save, hide-save, skip while hidden, idempotent `stop()`, a throwing `getState`) with stubbed `document` and fake timers; plus backup, block/allow, encode-failure and newer-version tests.
- **Result:** `npm test` 258/258 in 26 files. Typecheck, lint and build are clean, and `dist/` is clean.
- **Browser re-check** (`review19probe.mjs`, 10/10):
  - A corrupt save is backed up and removed.
  - A sim error gives the "Try reloading" toast, hide-saves are refused, the last good save is kept, and "Saving stopped" is warned once.
  - Restart wipes the save, and the new game saves again.
  - A UI error forces a save, and the toast says "saved".
  - Settings were untouched, and there were no unexpected errors.

### File List

- `src/save/validate.ts` (new)
- `src/save/migrations.ts` (new)
- `src/save/saveStore.ts` (new)
- `src/save/saveFile.ts` (modified: parse → migrate → validate, `decodeSaveResult`)
- `src/config/constants.ts` (modified: `AUTOSAVE_MS`)
- `src/view/scenes/GameScene.ts` (modified: autosave, forced save, hidden-tab pause, wipe on `newGame`, `stateCanRun`)
- `src/view/scenes/PreloadScene.ts` (modified: load the save at boot)
- `src/view/safetyNet.ts` (modified: `setForceSave`, save before the toast)
- `eslint.config.js` (modified: `src/save` secrecy off)
- `tests/save/busy.ts` (new: shared busy-game helper)
- `tests/save/validate.test.ts` (new)
- `tests/save/migrations.test.ts` (new)
- `tests/save/roundTrip.test.ts` (new)
- `tests/save/saveStore.test.ts` (new)
- `tests/save/saveFile.test.ts` (modified)
- `src/view/strings.ts` (modified in review: `bootErrorToast` comment)
- `_bmad-output/project-context.md` (modified in review)
- `_bmad-output/implementation-artifacts/deferred-work.md` (modified)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modified)
- `_bmad-output/implementation-artifacts/1-9-save-resume-and-hidden-tab-pause.md` (this story)

## Change Log

| Date | Change |
|---|---|
| 2026-10-06 | Story created (ready-for-dev). |
| 2026-10-06 | Implemented: save validation, migrations, `saveStore` (load/write/wipe/autosave/hide-save), boot resume, hidden-tab pause, Restart wipe, and a forced save on errors. 91 new tests (244 total). Browser probe: all checks pass (corrupt-save confirmed on a separate run). Status → review. |
| 2026-10-06 | Code review: 4 decisions (2 → patches, 1 kept as built, 1 deferred), 11 patches applied, 6 dismissed; 258 tests; browser re-check 10/10. Status → done. |
