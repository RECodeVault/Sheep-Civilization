---
baseline_commit: ed1be12c2361d75ae69c6e97242b5d839c6b9d24
---

# Story 1.2: Simulation Core and Game Clock

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a player,
I want the pasture to run on a steady game clock with my starting flock on screen,
so that the game behaves the same on any monitor and can later be saved exactly.

## Acceptance Criteria

1. **New game state.** `createNewGame(seed)` in `src/sim/state.ts` returns a plain-data `GameState` with the fields `time`, `nextId`, `rng`, `sheep[]`, `food`, `foodPieces[]`, `carcasses[]`, `stats` and `lastEra`. It holds 3 adult sheep at Fullness 60, placed inside the starting fence, and 5 food. This is the interim Epic 1 flock; Epic 2 completes FR6.
   - `JSON.parse(JSON.stringify(state))` deep-equals `state` (NFR6, AR3).
2. **Seeded RNG.** `src/sim/rng.ts` implements mulberry32. The same seed gives the same sequence every time, and the RNG state lives in `state.rng` (AR10).
3. **Step and commands.** `step(state)` and `applyCommand(state, cmd)` exist, with typed `Command` and `SimEvent` unions. The per-tick event queue is kept outside `GameState`.
   - Each `step` advances `state.time` by exactly `TICK_MS`, and systems run in the fixed order declared in `step.ts`.
   - Every `switch` over the unions ends in `assertNever` (AR7).
4. **Fixed-step clock.** When `GameScene` receives frames of any length, an accumulator runs whole ticks only and clamps each frame's delta to 250 ms. A test helper `runFor(state, ms)` exists for sim tests (AR4).
5. **Pooled flock rendering.** When the game scene renders, each starting sheep appears as a pooled sprite reconciled by id through `EntityLayer` (pattern N3). No game data is stored on sprites (AR19).
6. **Asset pipeline and preload.**
   - Given source PNGs in `assets/art/{sheep,world,ui}/` (Kenney or placeholder art), `npm run assets` runs `scripts/build-assets.ts`.
   - free-tex-packer-core packs the `sheep-world` and `ui` atlases into `public/assets/atlases/`: JSON-hash format, each ≤ 2048², with kebab-case `entity-state[-n]` frame names.
   - `PreloadScene` loads both atlases behind a loading bar on `dusk` before `GameScene` starts, and finishes in under 5 s on broadband (AR6, AR11, UX-DR11). `TitleScene` arrives in Story 1.10; until then Preload goes straight to Game.
7. **Green gate.** `npm test`, `npm run typecheck`, `npm run lint` and `npm run build` all pass.

## Tasks / Subtasks

- [x] **Task 1: Tuning values and fence geometry** (AC: 1)
  - [x] 1.1 Add these keys to `TUNING` in `src/config/tuning.ts`. Each value comes from the GDD; keep a short comment with its source.
    - `startFullness: 60` (GDD Starting flock).
    - `startFood: 5` (FR3/FR6).
    - `foodCap: 20` and `farmFoodPerClick: 1` (FR3), needed by the `Farm` command (Task 4).
    - `startAdultAgeMs: 60_000` (the founding adults are aged 60 s).
    - `interimFlockAdults: 3` (the Epic 1 interim flock; Story 2.1 replaces it with 2 adults and 1 lamb).
  - [x] 1.2 Add `startFence: { x, y, width, height }` (canvas px) to `TUNING`, as a deep-frozen nested object. Starting value **[ASSUMPTION, tune in 3.6]**: `{ x: 556, y: 330, width: 380, height: 250 }`.
    - The Land I fence in `mockups/hud.html` spans about x 430–1061 and y 186–598, so this start sits inside it and can "grow in place" (UX-DR49).
    - It stays clear of the Better Place (x ≈ 450–590, upper-left) and the Market (right edge), and above the 112 px bottom bar (the field is y 0–608).
  - [x] 1.3 Add `spawnInset: 32` to `TUNING`, so no sheep spawns closer than this to the fence.
  - [x] 1.4 Freezing: `TUNING` uses `Object.freeze`. Nested objects must be frozen too; use the same `deepFreeze` approach as `constants.ts`, or freeze `startFence` explicitly.
  - [x] 1.5 Do **not** add values owned by later stories, such as drain rate, walk speed, separation, lamb/elder ages or `carcassesEnabled`.
- [x] **Task 2: `src/sim/rng.ts`** (AC: 2)
  - [x] 2.1 `export function rng(state: { rng: number }): number` returns a float in [0, 1) and writes the advanced 32-bit state back to `state.rng`. The parameter is typed structurally so the function is testable without a full state. Use exactly this mulberry32:
    ```ts
    let t = (state.rng = (state.rng + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    ```
    `state.rng` must always be an unsigned 32-bit integer (`>>> 0`), so it survives JSON and is never negative.
  - [x] 2.2 Also export `rngRange(state, min, max)` (float in [min, max)) and `rngInt(state, min, maxInclusive)`. Later stories need both: the kill-cycle window 45–60 s, and births 8–15.
  - [x] 2.3 Export `seedFromNumber(n)` (`n >>> 0`) so `createNewGame` normalises any number.
- [x] **Task 3: `src/sim/state.ts`: types, `nextId` and `createNewGame`** (AC: 1)
  - [x] 3.1 Types. Keep them plain data, as type aliases or interfaces with no classes:
    - `Sheep` is `{ id: number; x: number; y: number; bornAt: number; fullness: number; activity: SheepActivity }`.
    - `SheepActivity` is `'wander'` for now; later stories widen it to `seekFood`, `eating` and the rest.
    - `FoodPiece` is `{ id; x; y }`.
    - `Carcass` is `{ id; x; y; createdAt }`.
    - `Era` is `'pasture' | 'village' | 'town' | 'wool-empire'`. These ids are the background asset names from the architecture, so the view can use them as texture keys.
    - `Stats` is `{ died; sold; sacrificed; moneyEarned; peakFlock }`, all numbers. Story 1.8 needs `peakFlock` and Story 5.4 the rest.
    - `GameState` holds exactly the AC 1 fields: `time`, `nextId`, `rng`, `sheep`, `food`, `foodPieces`, `carcasses`, `stats` and `lastEra`.
    - Do **not** add `name`, `cooldownUntil`, `isAbomination`, `pregnancies`, `money`, `landTier` or other fields now; the stories that own them add them. Saving only exists from Story 1.9, so adding fields before then needs no migration.
  - [x] 3.2 `export function nextId(state): number` returns `state.nextId++`. Ids start at 1.
  - [x] 3.3 `createSheep(state, { x, y, bornAt })` is the entity factory from the architecture's Entity Patterns. It assigns the id from `nextId`, sets `fullness: TUNING.startFullness` and `activity: 'wander'`, and pushes the sheep into `state.sheep`. Put it in `state.ts` for now: `lifecycle.ts` is owned by Epic 2 and may move it there.
  - [x] 3.4 `createNewGame(seed: number): GameState`:
    - Start from `time 0`, `nextId 1`, `rng seedFromNumber(seed)`, `food TUNING.startFood`, empty `foodPieces` and `carcasses`, all `stats` at 0 except `peakFlock` (equal to the starting count), and `lastEra 'pasture'`.
    - Create `TUNING.interimFlockAdults` adults with `bornAt = -TUNING.startAdultAgeMs`. A negative `bornAt` is intended: the sheep were born before the save began.
    - Place them uniformly at random **via `rngRange`** inside `startFence` inset by `spawnInset`. Round x and y to integers so the state stays tidy.
    - The same seed must give a deep-equal state.
  - [x] 3.5 Put `fenceBounds(state)` in `src/sim/selectors.ts`. It returns `TUNING.startFence` for now; Epic 3 makes it depend on the land tier. The view and later sim systems read the fence through it, never through `TUNING.startFence` directly.
- [x] **Task 4: `src/sim/commands.ts` and `src/sim/events.ts`** (AC: 3)
  - [x] 4.1 `events.ts`:
    - `export type SimEvent = { type: 'SheepDied'; id: number; cause: DeathCause; x: number; y: number }`, with `export type DeathCause = 'starved' | 'oldAge' | 'virus' | 'abomination'`.
    - The variant is **declared only**; Story 1.5 emits it. `name` is added with names in Story 5.3.
  - [x] 4.2 The per-tick queue in `events.ts` is a module-level `const queue: SimEvent[] = []`, outside `GameState`, so it is never saved. Export:
    - `emit(e)`, which pushes onto the queue.
    - `drainEvents(fn: (e: SimEvent) => void)`, which calls `fn` for each event in order and then sets `queue.length = 0`. It allocates nothing.
    - `clearEvents()`, for tests and New Game.
    - If a handler emits while draining, the new event must be delivered after the current ones, not lost. Iterate by index while `i < queue.length`.
  - [x] 4.3 `commands.ts`:
    - `export type Command = { type: 'Farm' }`. Later stories append `FarmBreeding`, `DropFood` and the rest.
    - `export function applyCommand(state, cmd): void` switches on `cmd.type` and ends with `default: assertNever(cmd)`.
    - `Farm` sets `state.food = Math.min(TUNING.foodCap, state.food + TUNING.farmFoodPerClick)`. This is the FR3 rule only. The button, `F` key, popups and meter belong to Story 1.6, which wires them to this command. It is included here so the command path is real and tested.
  - [x] 4.4 In `src/sim/step.ts`, `export function step(state: GameState): void`:
    - **First** `state.time += TICK_MS`, then each system in order, so systems see the new time when comparing deadlines (`state.time >= diesAt`). Write this ordering rule in a comment.
    - Declare the order as `const SYSTEMS: readonly ((s: GameState) => void)[] = []`. It is empty in this story; Story 1.3 adds `updateMovement`.
    - Add a comment giving the intended order: movement → feeding → hunger → lifecycle → virus → abomination → overcrowding → autoFeeder → eras. Later stories insert into this list and never call systems from elsewhere (architecture boundary 5).
    - Iterate with an indexed `for` loop; no closures are created per tick.
  - [x] 4.5 Commands are applied **at the start of the next tick**. `GameScene` holds a `pendingCommands: Command[]`; for each tick it calls `applyCommand` for every pending command, clears the array, then calls `step`. Expose `dispatch(cmd)` on `GameScene`; the bus and HUD wiring comes in Story 1.6.
- [x] **Task 5: Fixed-step accumulator** (AC: 4)
  - [x] 5.1 Create `src/core/fixedStep.ts` (pure and engine-free, so it is unit-testable):
    - `export class FixedStepClock` with `constructor(tickMs = TICK_MS, maxFrameMs = MAX_FRAME_MS)` and `advance(frameDeltaMs: number): number`.
    - `advance` clamps `frameDeltaMs` to [0, maxFrameMs], adds it to the accumulator, and returns how many whole ticks to run, leaving the remainder.
    - Also provide `alpha` (accumulator / tickMs, in [0, 1)) for interpolation in Story 1.3, and `reset()` (Story 1.9 resets the delta after the tab becomes visible again).
    - Add a `speed` multiplier, default 1, for the debug ×4/×16 in Story 1.4. Apply it **after** clamping (to the clamped delta), so one frame never runs more than `speed × 250 ms` of game time.
  - [x] 5.2 Add `MAX_FRAME_MS = 250` to `constants.ts`, next to `TICK_MS`.
  - [x] 5.3 Clamp non-finite or negative deltas to 0. A hidden tab can produce a huge first delta; the clamp handles it.
- [x] **Task 6: Asset pipeline (`scripts/build-assets.ts`)** (AC: 6)
  - [x] 6.1 `npm i -D free-tex-packer-core@~0.3.9 @types/node@^24`. free-tex-packer-core 0.3.9 is the latest (2026-07-24). It brings `sharp` and `jimp`; neither is a runtime dependency and neither ships in `dist/`.
    - **Never** set `tinify: true`; it calls the TinyPNG web service.
    - Do not import its transitive dependencies (`sharp`, `jimp`) directly.
  - [x] 6.2 Close the deferred `scripts/` typing item (`deferred-work.md`):
    - Remove `"scripts"` from the root `tsconfig.json` `include`.
    - Add `scripts/tsconfig.json` that extends the root and sets `"types": ["node"]`, `"module": "nodenext"`, `"moduleResolution": "nodenext"`, `"allowImportingTsExtensions": true` and `"include": ["./**/*.ts"]`. Keep `erasableSyntaxOnly`, which Node's type stripping needs.
    - Change the `typecheck` script to `tsc --noEmit && tsc --noEmit -p scripts`.
    - This keeps Node globals out of `src/`.
  - [x] 6.3 Script behaviour (one file, run with `node scripts/build-assets.ts` on Node 24's native type stripping):
    - **Atlas inputs:** `sheep-world` ← `assets/art/sheep/*.png` + `assets/art/world/*.png`; `ui` ← `assets/art/ui/*.png`. Sort inputs by name so output is deterministic and commits don't churn.
    - **Frame names:** validate each against `/^[a-z0-9]+(-[a-z0-9]+)*$/` (kebab `entity-state[-n]`) and fail on a duplicate across folders of the same atlas.
    - **Packer options:**
      - `textureName` = the atlas name; `width: 2048`, `height: 2048`.
      - `padding: 2`, `extrude: 1`, so there is no nearest-neighbour bleed.
      - `allowRotation: false` and `allowTrim: false`, so frame sizes stay stable for animation alignment.
      - `detectIdentical: true`.
      - `removeFileExtension: true` and `prependFolderName: false`, so frame names are bare kebab names.
      - `exporter: 'JsonHash'`, `packer: 'OptimalPacker'`, `powerOfTwo: false`.
    - **Fail** (exit 1, with a message) if the packer returns more than one texture for an atlas, which means it went over 2048².
    - Write `public/assets/atlases/{sheep-world,ui}.{png,json}`. Check that the JSON's `meta.image` matches the PNG file name.
    - **Font sync** (closes the second deferred item): copy `assets/fonts/*.woff2` → `public/assets/fonts/`, overwriting. Do not copy the OFL `.txt` files.
    - **Audio sprite:** out of scope until Story 5.6. Log `[assets] audio: none yet (Story 5.6)` and continue.
    - Log a one-line summary per atlas (frame count, size). Use plain `console.log`/`console.error`; the `log` module is for `src/`.
  - [x] 6.4 Interop: free-tex-packer-core is CommonJS. From ESM use `import packer from 'free-tex-packer-core'` and `const { packAsync } = packer`, or a named import if Node's CJS lexer exposes it. Run the script and check rather than guessing.
- [x] **Task 7: Source art (placeholder is fine)** (AC: 6)
  - [x] 7.1 Add PNGs. Kenney CC0 art is preferred where a fitting asset exists; otherwise draw simple placeholder pixel art in the DESIGN.md palette (wool body, bark face and legs).
    - The minimum frame set:
      - `assets/art/sheep/adult-idle.png`.
      - `assets/art/world/fence-post.png`, `fence-rail-h.png` and `fence-rail-v.png`.
      - `assets/art/ui/pip-food.png` and `pip-empty.png`, so the `ui` atlas is real and non-empty; Story 1.6 uses them.
    - Suggested source size: adult sheep 32×26, rendered at scale 2 so it shows at about 64×52, like the mockup.
  - [x] 7.2 If you generate placeholders with a throwaway script, keep that script in the scratchpad, not the repo. Commit only the PNGs.
  - [x] 7.3 Add every source (Kenney pack name and licence, or "placeholder, original") to `assets/CREDITS.md`.
  - [x] 7.4 Remove `assets/art/.gitkeep` once real files exist. Then run `npm run assets` and commit `public/assets/atlases/*`. The architecture commits built assets, so deploy is `vite build` only.
- [x] **Task 8: Scenes: Boot → Preload → Game** (AC: 4, 5, 6)
  - [x] 8.1 `BootScene.create()` keeps setting the dusk background and then calls `this.scene.start('PreloadScene')`. Update its header comment.
  - [x] 8.2 `src/view/scenes/PreloadScene.ts`:
    - In `preload()`, draw the loading bar once:
      - centred, about 400×16;
      - track in `duskDeep` with a 2 px `wool` outline, fill in `hay`, all from `COLOR_INT`, on a `dusk` camera;
      - **[ASSUMPTION]** these colours. No text is needed.
    - Update the fill only on `this.load.on('progress', v => …)`, never per frame.
    - Queue `this.load.atlas('sheep-world', 'assets/atlases/sheep-world.png', 'assets/atlases/sheep-world.json')` and the same for `ui`. Use relative URLs with **no leading slash**.
    - On a `loaderror` event, `log.warn('boot', …)` and continue.
    - In `create()`, `this.scene.start('GameScene')`.
    - Before writing the loader code, read `node_modules/phaser/skills/loading-assets/SKILL.md`.
  - [x] 8.3 Put texture and frame keys in one module, `src/view/assetKeys.ts`, for example `ATLAS.sheepWorld = 'sheep-world'` and `FRAME.adultIdle = 'adult-idle'`, so scenes and sprites never repeat string literals.
  - [x] 8.4 `src/view/scenes/GameScene.ts`:
    - In `create()`, `this.state = createNewGame(seed)` with `seed = Math.floor(Math.random() * 2 ** 32)`. `Math.random` is allowed in view code; Story 1.9 swaps this for load-or-new.
    - Call `clearEvents()` on create.
    - Camera background `pasture`. This is placeholder ground art, which UX-DR2 allows: `pasture` is an art tone. The era background images arrive in Epic 3.
    - Build the `Fence` view and the sheep `EntityLayer`.
    - Each frame, in `update(_time, delta)`:
      1. `const ticks = clock.advance(delta)`.
      2. For each tick: apply pending commands, `step(state)`, then `drainEvents(e => bus.emit('sim', e))`.
      3. After the ticks, call `selectPublicSheep(state, this.publicSheep)` once, then `sheepLayer.sync(this.publicSheep, clock.alpha)`.
    - **No logging in `update`.**
  - [x] 8.5 Register `PreloadScene` and `GameScene` in `main.ts` `scene: [BootScene, PreloadScene, GameScene]`. Do not add `TitleScene`, `HudScene` or `OverlayScene` yet.
  - [x] 8.6 Shut-down hygiene: anything the scene subscribes to (bus or input) is removed in `this.events.once(Phaser.Scenes.Events.SHUTDOWN, …)`. Restart must not double-subscribe.
- [x] **Task 9: `EntityLayer`, pool and sprites (pattern N3)** (AC: 5)
  - [x] 9.1 Selectors. In `src/sim/selectors.ts`, add `PublicSheep = { id: number; x: number; y: number }` for now; later stories add `stage`, `hunger`, `gait` and `activity` per the architecture.
    - Also add `selectPublicSheep(state, out: PublicSheep[]): PublicSheep[]`, which **reuses** the objects in `out`: it grows `out` only when the flock grows, mutates fields in place, and sets `out.length` to the sheep count.
    - Reason: the architecture's `publicSheep(s)` example allocates per sheep per frame, which breaks the no-allocation rule. Keep a single-sheep `publicSheep(s, state)` too (tooltips in 1.5 use it).
  - [x] 9.2 `src/view/field/ObjectPool.ts`: a generic `ObjectPool<T>` with `acquire()` and `release(obj)`. It is pre-filled with a factory to the given size and grows on demand. Use a pre-size of 120 for sheep (later 60 for food and 40 for carcasses).
  - [x] 9.3 `src/view/field/EntityLayer.ts`: the generic `EntityLayer<TPublic extends { id: number }, TSprite extends PooledEntitySprite<TPublic>>`, following the architecture's N3 `sync()`.
    - Use a persistent `live: Map<number, TSprite>` and a persistent `seen: Set<number>`, cleared rather than reallocated each frame.
    - New ids → `pool.acquire()` + `bind(id)`. Present ids → `sync(item, alpha)`. Gone ids → `playExit(done)`, then release.
    - For now `playExit` just hides the sprite and calls `done` at once; juice comes later.
    - No per-frame closures: pass a stored bound callback, or have `playExit` return and release directly.
  - [x] 9.4 `src/view/field/SheepSprite.ts`:
    - `class SheepSprite extends Phaser.GameObjects.Sprite`, using the `sheep-world` atlas and the `adult-idle` frame.
    - Methods: `bind(id)`, `sync(pub, alpha)`, `playExit(done)` and `reset()`.
    - It stores **only** its bound id plus view state. The previous and current positions for interpolation are added in Story 1.3; here `sync` sets `x`/`y` from `pub`.
    - Never use `setData`, the registry, or a reference to the `Sheep` record.
    - Depth sort by `y` so lower sheep draw in front. Set this in `sync`, and only when `y` changed.
  - [x] 9.5 `src/view/field/Fence.ts`: draws the `fenceBounds(state)` rectangle **once** from the atlas fence frames (posts and rails) when created. It is not redrawn per frame. It exposes `setBounds(rect)` for Epic 3 growth.
  - [x] 9.6 `src/view/bus.ts`: `export type BusEvents = { sim: SimEvent }` and `export const bus = new EventBus<BusEvents>()`. This is the shared instance that Story 1.1 deferred. UI `noun:verb` events are added to `BusEvents` by later stories.
- [x] **Task 10: Tests** (AC: 1–4, 7)
  - [x] 10.1 `tests/sim/helpers.ts`:
    - `runFor(state, ms)` throws if `ms % TICK_MS !== 0`. Otherwise it calls `step` `ms / TICK_MS` times and, after each step, drains events into a returned `SimEvent[]` (tests may allocate).
    - Also export `newGame(seed = 1234)`, a wrapper around `createNewGame` that calls `clearEvents()` first.
  - [x] 10.2 `tests/sim/rng.test.ts`:
    - The same seed gives an identical sequence of 1000 values. Different seeds diverge.
    - Values lie in [0, 1).
    - `state.rng` advances and stays an integer in [0, 2³²).
    - Known-answer vector, which pins the algorithm:
      - seed `1` → `0.6270739405881613`, `0.002735721180215478`, `0.5274470399599522`, leaving `state.rng === 1199730144` after three draws;
      - seed `42` → first value `0.6011037519201636`.
    - `rngInt` stays within its inclusive bounds over many draws.
  - [x] 10.3 `tests/sim/state.test.ts`:
    - The field set equals exactly the AC 1 list.
    - The flock has 3 sheep, each with `fullness === TUNING.startFullness` and `bornAt === -TUNING.startAdultAgeMs`.
    - Every sheep lies inside `fenceBounds` inset by `spawnInset`.
    - `food === TUNING.startFood`; `foodPieces` and `carcasses` are empty; `lastEra === 'pasture'`.
    - Ids are unique, and `nextId` is greater than every id.
    - **JSON round-trip deep-equal** (`toStrictEqual`) on a fresh state and after `runFor(state, 10_000)`.
    - The same seed gives a deep-equal state; different seeds give different positions.
  - [x] 10.4 `tests/sim/step.test.ts`:
    - One step advances time by exactly `TICK_MS`; `runFor(state, 5_000)` gives `time === 5_000`.
    - Stepping is deterministic for the same seed, comparing two runs.
    - No events are emitted by an empty system list.
  - [x] 10.5 `tests/sim/commands.test.ts`: `Farm` adds `farmFoodPerClick` and caps at `foodCap`. Use `TUNING` values, never literals.
  - [x] 10.6 `tests/sim/events.test.ts`: `emit`/`drainEvents` keep order and empty the queue; an emit made during a drain is delivered in the same drain; `clearEvents` works.
  - [x] 10.7 `tests/core/fixedStep.test.ts`:
    - Six 16.67 ms frames give 1 tick in total, with the remainder carried.
    - A 1000 ms frame is clamped to 250 ms, giving 2 ticks with 50 ms remaining.
    - `alpha` stays in [0, 1).
    - `reset()` zeroes the accumulator.
    - NaN or negative deltas give 0 ticks.
    - `speed` 4 with a 100 ms frame gives 4 ticks.
- [x] **Task 11: Verify and document** (AC: 5–7)
  - [x] 11.1 `npm run assets`, `npm test`, `npm run typecheck`, `npm run lint` and `npm run build` all pass. Paste a short summary of each into the Completion Notes.
  - [x] 11.2 **Manual browser check** (headless Chrome via a scratchpad playwright-core, as in Story 1.1, or ask Rylan). Under `npm run dev`:
    - The loading bar shows on dusk.
    - The field then shows the pasture fill, the starting fence and 3 sheep inside it.
    - 0 console errors.
    - Network requests are local only, and the atlases come from `./assets/atlases/`.
    - Repeat on the production build served from a subpath (`/sheep/`).
    - Record the cold load time; it must be under 5 s.
  - [x] 11.3 Prove the accumulator is frame-rate independent. Use a DEV-only `log.debug` **outside** the update loop, or a temporary probe, then remove it. For example, after 10 real seconds `state.time` is about 10 000 at both 60 Hz and 144 Hz. Record what you saw.
  - [x] 11.4 Update `README.md`: describe what `npm run assets` does, and the `assets/art/{sheep,world,ui}` → `public/assets/atlases/` flow.
  - [x] 11.5 Update `deferred-work.md`: mark the two Story 1.2 items (scripts typing and font sync) as resolved.

### Review Findings

Code review 2026-10-05 (Blind Hunter + Edge Case Hunter + Acceptance Auditor). The auditor found every AC met and judged all four recorded deviations justified.

- [x] [Review][Defer] A failed atlas load still starts `GameScene`: sheep and fence render as missing-texture boxes with no player-facing message [src/view/scenes/PreloadScene.ts:37] — deferred to Story 1.4 (decision 2026-10-05: keep the log-and-continue behaviour from Task 8.2; the global error safety net owns player-facing errors)
- [x] [Review][Patch] Sim events are re-delivered when a drain handler throws: the queue is cleared only after the loop, so an exception leaves already-delivered events queued [src/sim/events.ts:21]
- [x] [Review][Patch] `FixedStepClock.speed` is unguarded: `Infinity` hangs the tick loop, `NaN` freezes the sim permanently and a negative value returns negative ticks; `tickMs <= 0` divides by zero [src/core/fixedStep.ts:20]
- [x] [Review][Patch] The asset build treats a missing or unreadable art folder as "no PNGs", so the build passes without the fence frames and they render as stretched whole-atlas images; `.PNG` files are also mishandled [scripts/build-assets.ts:28]
- [x] [Review][Patch] The asset build never removes stale outputs, and writes each atlas as soon as it is packed, so a later failure leaves `public/assets/` mixed [scripts/build-assets.ts:86]
- [x] [Review][Patch] `spawnInset` (32) is measured from the sprite centre, so 64×52 sheep spawn over the fence rails; the front rail also never draws in front of sheep [src/config/tuning.ts:24]
- [x] [Review][Patch] The fence end posts overhang the rails by 3 px, and the side rails have no posts (Task 9.5 asks for posts and rails) [src/view/field/Fence.ts:31]
- [x] [Review][Patch] `rngInt` and `rngRange` accept inverted or non-integer bounds and return values outside their contract [src/sim/rng.ts:17]
- [x] [Review][Patch] `Farm` lowers food when it is already above `foodCap`, e.g. from an old save [src/sim/commands.ts:13]
- [x] [Review][Patch] `GameScene.create` clears the event queue after `createNewGame`, which would drop any event emitted while a game is built [src/view/scenes/GameScene.ts:37]
- [x] [Review][Patch] Record in code that `rawDelta` is only correct while no `fps.limit` is configured [src/view/scenes/GameScene.ts:58]
- [x] [Review][Defer] Commands dispatched between scene shutdown and `create()` are dropped, and Farm presses pile up with no bound while the clock is paused [src/view/scenes/GameScene.ts:52] — deferred to Story 1.10, which adds pausing
- [x] [Review][Defer] `PooledEntitySprite.playExit()` has no completion callback, unlike the architecture's N3 contract [src/view/field/EntityLayer.ts:8] — deferred to the first story with exit animations (2.4)
- [x] [Review][Defer] `Fence.setBounds` destroys and re-creates its images and `GameScene` keeps no reference to the fence, so growing the fence during play would break the no-destroy rule [src/view/field/Fence.ts:20] — deferred to Story 3.3

## Dev Notes

### Scope

This story builds the deterministic simulation skeleton and the render path for a static starting flock. Sheep do **not** move yet; movement, the grid and interpolation belong to Story 1.3.

| Story | Owns (do **not** start here) |
|---|---|
| 1.3 | `movement.ts`, `grid.ts`, walk speed and separation tuning, sprite interpolation (prev/curr on sprites) |
| 1.4 | Debug overlay (uses `FixedStepClock.speed`), global error handler |
| 1.5 | `hunger.ts`, `killSheep`, emitting `SheepDied`, `carcassesEnabled`, tooltip, `PublicSheep.stage/hunger` |
| 1.6 | `HudScene`, widgets, `strings.ts`, Farm button and `F` key → `dispatch({ type: 'Farm' })` |
| 1.7 | `InputController`, `DropFood`, `feeding.ts` |
| 1.8 | `checkLastSheepAndLoss`, `Lost`, `OverlayScene`, `peakFlock` updates |
| 1.9 | `src/save/*`, autosave, visibility pause (uses `FixedStepClock.reset()`), schema migrations from then on |
| 1.10 | `TitleScene`, pause menu (pause = stop calling `clock.advance` / skip ticks, **not** `scene.pause()`) |
| 2.1 | GDD starting flock (2 adults + lamb), life stages and `names` |
| 5.6 | Audio sprite in `build-assets.ts` |

### Resolved decisions and gotchas (read first)

1. **The `Command` union starts with `Farm`.** A union needs at least one real variant for `assertNever` and the command path to be meaningful, and FR3's rule is a single line. Story 1.6 only adds UI that dispatches it. If Rylan prefers to keep `Farm` wholly in 1.6, the alternative is a no-variant union, which makes AC 3's `switch` untestable. Flagged in the completion questions.
2. **The `SimEvent` union starts with `SheepDied`**, declared but not emitted. Story 1.5 emits it.
3. **`step()` advances time first, then runs systems.** All deadline checks therefore use `>=` against the new time. Be consistent; later stories rely on it.
4. **Commands are applied before the tick's `step`,** never in the middle of a tick. The pending queue lives in `GameScene`, not in `GameState`.
5. **Allocation:** the architecture's `publicSheep(s)` and N3 `sync()` examples allocate per frame. Follow the no-allocation rule instead: reused `PublicSheep` objects, and persistent `Map` and `Set` instances in `EntityLayer`. `Map`/`Set` in **view** code is fine; they are banned only in `GameState`.
6. **`Era` ids are kebab-case** (`'wool-empire'`) so they double as background texture keys (architecture Game Assets naming). Display names come from `strings.ts` later.
7. **The fence position is not specified anywhere.** The values in Task 1.2 are an assumption derived from `mockups/hud.html`. They live in `TUNING` and are read only through `fenceBounds(state)`, so Epic 3 and the 3.6 pacing pass can change them in one place.
8. **Phaser's `update(time, delta)` delta is smoothed** by the game loop. That is fine: the accumulator clamps it anyway. Do not use `this.time` events or tweens to drive ticks.
9. **Phaser 4, not 3.** The loader API (`this.load.atlas`, `progress`/`complete` events) is unchanged from v3. Still, read the bundled skills `loading-assets`, `scenes` and `sprites-and-images` in `node_modules/phaser/skills/` before writing scene code, and never use v3-only APIs (`setTintFill`, `preFX`, `BitmapMask`).
10. **`config/` is pure and lint-enforced.** `tuning.ts` must not import from `view/` or `sim/`. Put the fence-rect type in `tuning.ts`, or as a plain inline type.
11. **`isAbomination` is not added in this story.** The secrecy lint rule therefore has nothing to catch yet; leave it as is.
12. **The asset script runs on Node 24 type stripping:** no enums, namespaces or parameter properties (`erasableSyntaxOnly`), and relative imports need explicit `.ts` extensions. Keep the script in one file to avoid needing relative imports.

### Architecture compliance

- **Layers:**
  - `src/sim/*` and `src/config/*` stay pure: no Phaser, DOM, `Math.random`, `Date.now` or timers. ESLint enforces this, so run lint early.
  - `src/core/fixedStep.ts` must also be pure; it receives the delta as an argument.
  - Only `GameScene` steps the sim. View code reads through selectors and never mutates `GameState`, except the scene calling `applyCommand` and `step` inside its tick loop.
- **Naming:**
  - Scenes and sprite classes are PascalCase, with the file name equal to the class (`PreloadScene.ts`, `SheepSprite.ts`, `EntityLayer.ts`, `ObjectPool.ts`, `Fence.ts`).
  - Sim and core modules are camelCase (`state.ts`, `rng.ts`, `step.ts`, `fixedStep.ts`).
  - Atlas frame names are kebab-case `entity-state[-n]`.
  - The scene key string equals the class name.
- **GameState rules:**
  - Plain JSON only: no `undefined` values, `Map`, `Set`, `Date` or class instances.
  - Entity references are numeric ids.
  - Optional fields use `?:` and are omitted (none exist yet).
- **Timers** are absolute game-ms deadlines (`…At`/`…Until`). `bornAt` follows this.
- **Logging:**
  - `log.info('boot', …)` milestones in Preload are fine.
  - Nothing in `step`, the systems or `update()`.
  - Never use raw `console.*` in `src/`. `scripts/` may use `console`.
- **Colours** come only from `COLORS`/`COLOR_INT`.

### Files touched

```
NEW  src/sim/{state,rng,step,commands,events,selectors}.ts
NEW  src/core/fixedStep.ts
NEW  src/view/assetKeys.ts · src/view/bus.ts
NEW  src/view/scenes/{PreloadScene,GameScene}.ts
NEW  src/view/field/{ObjectPool,EntityLayer,SheepSprite,Fence}.ts
NEW  scripts/tsconfig.json
NEW  assets/art/{sheep,world,ui}/*.png · public/assets/atlases/{sheep-world,ui}.{png,json}
NEW  tests/sim/{helpers.ts,rng,state,step,commands,events}.test.ts · tests/core/fixedStep.test.ts
UPD  src/config/tuning.ts        (empty frozen object → GDD values + startFence)
UPD  src/config/constants.ts     (+ MAX_FRAME_MS)
UPD  src/main.ts                 (scene list only; keep font loading, timeout and error logging as is)
UPD  src/view/scenes/BootScene.ts (start PreloadScene)
UPD  scripts/build-assets.ts     (stub → real pipeline)
UPD  package.json                (+ free-tex-packer-core, @types/node; typecheck script)
UPD  tsconfig.json               (drop "scripts" from include)
UPD  assets/CREDITS.md · README.md · deferred-work.md
DEL  src/sim/.gitkeep (if present), tests/sim/.gitkeep, assets/art/.gitkeep
```

**Current state of the files being updated, and what to keep:**

- `src/main.ts`: per-font loading with a 3 s timeout, the letterbox colour, `start().catch(log.error)`. Change only the `scene` array.
- `BootScene.ts`: sets the dusk background and logs `Boot scene ready`. Keep both, then start Preload.
- `tuning.ts`: `Object.freeze({})` with a header comment. Keep the comment.
- `vite.config.ts`: the production `manualPureFunctions: ['log.info', 'log.debug']`. Do not name any new variable `log`; the lint guard enforces this.
- `eslint.config.js`: disjoint file groups. New `src/sim/**` files automatically get the pure rules. If you add a new top-level folder, add it to a group.
- `tests/sim/.gitkeep` exists. Delete it once the tests exist.

### Library / framework requirements

| Package | Pin | Notes |
|---|---|---|
| phaser | `~4.2.1` (installed) | `this.load.atlas(key, png, json)` reads JSON-hash. Read the bundled skills before use. |
| free-tex-packer-core | `~0.3.9` (devDep, new) | Latest, published 2026-07-24. CJS. Deps: `sharp` ^0.35, `jimp` ^1.6, `maxrects-packer`, `tinify` (never enable). The `JsonHash` exporter is Phaser-compatible. |
| @types/node | `^24` (devDep, new) | Used only through `scripts/tsconfig.json`. |
| vitest / typescript / vite / eslint | unchanged | Do not upgrade TypeScript to 7 or Vitest to 5. |

There are no new runtime dependencies. Do not add an ECS, state or physics library.

### Testing requirements

- Vitest, node environment. Sim tests import only from `src/sim`, `src/config` and `src/core`, never from Phaser. Put the `fixedStep` tests in `tests/core/`.
- Seeds are fixed literals, and time advances only through `runFor`. No `vi.useFakeTimers`, no `Math.random`.
- Assert with `TUNING` values, never re-typed numbers. The exception is the rng known-answer vector, which pins the algorithm itself.
- The JSON round-trip test is the seed of the mandatory save test in Story 1.9; keep it.
- **Done = `npm test`, `npm run typecheck`, `npm run lint` all green**, plus `npm run build`, `npm run assets` and the manual browser check.

### Project context rules (from `_bmad-output/project-context.md`)

- Only `GameScene` runs the sim loop. HUD and Overlay never step it.
- Pausing means stopping the accumulation, never `scene.pause()` on `GameScene`.
- No Phaser timers or tweens may change `GameState`. Never store game data with `registry`, `setData` or `scene.data`.
- **Hot paths:**
  - No allocation in `step()`, systems, `update()` or `EntityLayer.sync`.
  - Selectors are computed once per frame in the scene.
  - No logging, `JSON.stringify` or `localStorage` there.
- Pools are pre-sized to 120 sheep, 60 food and 40 carcasses, and grow on demand. Never call `new` or `destroy()` on sprites during play.
- All field sprites come from the two atlases, so draws batch. No `Graphics` redrawn per frame. A one-time loading bar, updated on progress events, is acceptable.
- Assets:
  - The atlases are ≤ 2048².
  - Relative URLs only (`assets/...`, never `/assets/...`).
  - The build stays under 8 MB.
  - Nothing unused goes in `public/assets/`.
- **New-code placement:**
  - A tunable number goes in `TUNING`.
  - A new command goes in the `Command` union, and a new event in the `SimEvent` union.
  - A rule goes in `sim/systems/<name>.ts`, registered in `step.ts`.
- Common mistakes to avoid: v3 APIs, game logic in sprites or scenes, `Math.random`/`Date.now` in the sim, storing derived values (stage, hunger, era, flock count), hard-coded GDD numbers.

### Previous story intelligence (1.1)

- The stack is phaser 4.2.1, vite 8.3.2, typescript 6.0.3, vitest 4.1.11, eslint 10.12 and typescript-eslint 8.71.1, on Node 24.16 locally.
- **EventBus** (`src/core/eventBus.ts`):
  - It is typed through a mapped-type constraint, so `interface` maps also work.
  - `off()` takes effect mid-emit, and `emit` allocates only when a `once` listener fires.
  - Pass `this` as the context on `bus.on` so `off(event, undefined, this)` can clean up at shutdown.
- **Tokens:** `COLORS` and `COLOR_INT` (numeric, for Phaser fill and tint) are deep-frozen. Hex literals are allowed only in `constants.ts`.
- **Lint** is organised as disjoint groups. The `log` guard bans any other binding named `log`, and production tree-shaking relies on that name.
- **Headless verification** used the system `google-chrome` driven by `playwright-core`, installed in the scratchpad and not as a project dependency. Reuse that approach for Task 11.2.
- **Review lessons:**
  - Record evidence for every manual check; the "resize" item was ticked without evidence and got flagged.
  - Record lint and print-config verification.
  - Do not claim a test-first run that did not happen.
- **Deferred items this story must close:** `scripts/` typing (`@types/node`, `.ts` import extensions) and font sync in `npm run assets`.

### Git intelligence

- `ed1be12` implements 1.1: the scaffold, tokens, core modules, the lint rewrite and fonts. `36ea966`, `40817f4` and `790c075` are planning artifacts.
- Work for this story is on branch `story-1.2`, created from `main` at `ed1be12`.

### Latest technical notes (checked 2026-10-05)

- free-tex-packer-core 0.3.9 is current. Its options include `exporter` (`JsonHash`/`JsonArray`/`Phaser3`/…), `packer: 'OptimalPacker'` (recommended), `extrude`, `allowTrim`, `allowRotation`, `removeFileExtension`, `prependFolderName` and `tinify` (keep off). `packAsync(images, options)` resolves to `[{ name, buffer }]`.
- Phaser 4 `this.load.atlas` accepts the TexturePacker JSON-hash format, which free-tex-packer's `JsonHash` exporter produces.
- Node 24 runs `.ts` files directly through type stripping, with no flag. Only erasable syntax is allowed.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.2: Simulation Core and Game Clock]
- [Source: _bmad-output/planning-artifacts/epics.md#Additional Requirements] AR3, AR4, AR6, AR7, AR10, AR11, AR12, AR13, AR19
- [Source: _bmad-output/game-architecture.md#State Management], [#Game Time], [#Randomness], [#Asset Management], [#Scene Structure and Communication], [#Event System], [#N3 — Sprite ↔ Entity Reconciliation], [#Entity Patterns], [#State Patterns], [#Directory Structure], [#Architectural Boundaries]
- [Source: _bmad-output/planning-artifacts/gdds/gdd-sheep-civilization-2026-10-05/gdd.md] Starting flock (Fullness 60, adults aged 60 s), food meter start 5 and cap 20
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-sheep-civilization-2026-10-05/EXPERIENCE.md#State Patterns] Cold load: loading bar on dusk, < 5 s
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-sheep-civilization-2026-10-05/DESIGN.md#Layout & Spacing] and `mockups/hud.html` (fence and sheep scale)
- [Source: _bmad-output/project-context.md]
- [Source: _bmad-output/implementation-artifacts/1-1-scaffold-the-project-from-the-phaser-template.md] and `deferred-work.md`

## Dev Agent Record

### Agent Model Used

Claude Opus 5.5 (claude-opus-5-5[1m]) via Claude Code, gds-dev-story workflow.

### Implementation Plan

- **Sim (`src/sim/`):**
  - `rng.ts`: mulberry32 exactly as specified, plus `rngRange`, `rngInt` and `seedFromNumber`.
  - `state.ts`: the AC 1 types, `nextId`, `createSheep` and `createNewGame`. Positions come from `rngRange` inside `fenceBounds` inset by `spawnInset`, rounded to integers.
  - `selectors.ts`: `fenceBounds`, `PublicSheep` `{ id, x, y }`, `publicSheep`, and an allocation-free `selectPublicSheep(state, out)`.
  - `events.ts`: a module-level queue with `emit`, `drainEvents(fn)` (indexed, so re-entrant emits are delivered in the same drain) and `clearEvents`.
  - `commands.ts`: `Command = { type: 'Farm' }` with the FR3 rule.
  - `step.ts`: advances time first, then runs the (still empty) `SYSTEMS` list in an indexed loop. The intended order is written in a comment.
- **Clock:** `src/core/fixedStep.ts` `FixedStepClock` with `advance`, `alpha`, `reset` and `speed` (applied after the 250 ms clamp). `MAX_FRAME_MS = 250` was added to `constants.ts`.
- **View:**
  - Scenes run Boot → Preload → Game. Preload draws the loading bar once and redraws the fill only on `progress` events.
  - `GameScene` owns the state, clock, pending commands and a reused `PublicSheep[]`. Each tick it applies commands, calls `step`, then `drainEvents(forwardEvent)`, where `forwardEvent` is bound once.
  - `EntityLayer` uses a persistent `Map` and `Set`, and a once-bound `sweep` callback for `Map.forEach`, so `sync` creates no iterators or closures per frame.
  - `ObjectPool` is pre-sized to 120. `SheepSprite` holds only its bound id, uses depth = y, and is drawn at 2×. `Fence` is built once from atlas frames. `bus.ts` and `assetKeys.ts` were added.
- **Pipeline:** `scripts/build-assets.ts` is one erasable-TS file. It uses the named `packAsync` import (works with Node's CJS lexer) and type-only casts for the packer's type-only enums.
  - **Validates:** kebab frame names; duplicate frames within an atlas; one texture per atlas; `meta.image` matches the PNG name.
  - **Also:** syncs the fonts and logs the audio skip.
  - `scripts/tsconfig.json` (Node types, `nodenext`, `allowImportingTsExtensions`) is split from the root config, and `typecheck` runs both.

### Debug Log References

- **Phaser's smoothed `delta` slows the sim.** This was found in the frame-rate check (Task 11.3).
  - With the `update(_time, delta)` argument and requestAnimationFrame forced to 30 Hz, the sim ran only 8 700 ms per 10 000 ms of real time.
  - Cause: Phaser 4 `TimeStep.smoothDelta` caps the delta at 1/60 s for `panicMax` (120) frames after start or refocus, and permanently while the window is unfocused.
  - Fix: `GameScene` feeds `this.game.loop.rawDelta` to the clock, which does its own 250 ms clamp.
  - After the fix, 10 s of real time gives exactly 10 000 ms of sim time at 30, 60 and 144 Hz.
  - This **contradicts Dev Notes item 8** ("smoothed delta is fine"). Later stories should keep `rawDelta`.
- **Single-variant union:** `assertNever(cmd)` fails typecheck, because a one-variant union does not narrow the object to `never`. Used `assertNever(cmd.type)`, with a comment.
- **ESLint vs `_`-prefixed parameters:** `no-unused-vars` flagged `_state` in `fenceBounds` and `publicSheep`. Added `argsIgnorePattern: '^_'` to `eslint.config.js`, matching tsc's `noUnusedParameters` convention.
- **Temporary probe:** a DEV-only `window.__probeGame` line in `main.ts`, used for the browser timing checks, was removed afterwards. `grep` finds 0 matches in `src/` and in `dist/`.

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created
- **Red before green:** all 7 new test files were written first. The run failed (6 files could not import the missing modules) before any sim code existed, then passed once the modules were added.
- **AC 1:**
  - `createNewGame` returns exactly the 9 fields, 3 adults at Fullness 60 with `bornAt -60000`, and food 5.
  - All sheep are inside the inset fence for 5 seeds.
  - The JSON round-trip (`toStrictEqual`) holds fresh and after 10 s, and the state is deterministic per seed.
- **AC 2:** the known-answer vector matches (seed 1 → 0.6270739405881613, 0.002735721180215478, 0.5274470399599522, `rng` 1199730144; seed 42 → 0.6011037519201636). 1000 values repeat for the same seed, and the state stays a uint32.
- **AC 3:** each step adds exactly `TICK_MS`. Systems run in the declared order (empty for now). `applyCommand` ends in `assertNever`, and the unknown-variant test throws.
- **AC 4:** `FixedStepClock` tests cover whole ticks with the remainder carried, the 1000→250 ms clamp, alpha in [0, 1), reset, NaN/negative/∞ deltas, and speed after the clamp. `runFor` throws on non-tick durations.
- **AC 5:** headless Chrome (system google-chrome + scratchpad playwright-core) on `npm run dev` shows the pasture fill, the starting fence and 3 visible pooled sprites at the sim positions. No game data is on the sprites; the id is the only bound field.
- **AC 6:**
  - `npm run assets` packs `sheep-world` (4 frames, 60×38) and `ui` (2 frames, 18×44), and running it twice gives byte-identical output.
  - Preload shows the loading bar on dusk; captured mid-load at 3 of 4 files by delaying `ui.png`.
  - Cold load: canvas plus GameScene active in 662 ms (dev) and 288 ms (production), far under 5 s.
  - Only localhost or blob requests were made. The atlases load from `./assets/atlases/`, including from the `/sheep/` subpath in production. 0 console errors (only headless GL readback warnings from the screenshot).
- **AC 7:** `npm test` 55/55 in 12 files. `npm run typecheck` is clean for both configs, `npm run lint` is clean and `npm run build` is OK. `dist/` is 1.5 MB, and "Boot scene ready" and "Assets loaded" appear 0 times in it.
- **Placeholder art:** original pixel PNGs in the DESIGN.md palette, made by a throwaway scratchpad script (a pure Node PNG encoder, not committed). Credited in `assets/CREDITS.md` as placeholders.
- **Deviations from the story text:**
  1. `rawDelta` instead of the `delta` argument (see Debug Log).
  2. `assertNever(cmd.type)` instead of `assertNever(cmd)`.
  3. The ESLint `argsIgnorePattern` rule.
  4. `EntityLayer.playExit()` takes no `done` callback; the layer releases right after it. The story allowed this ("or have `playExit` return and release directly").
- Not done here, by design: movement and interpolation (1.3), the debug overlay (1.4), HUD dispatch of `Farm` (1.6).

### Review Follow-up (2026-10-05)

All 10 review patches applied; the atlas-load decision was resolved as defer (Story 1.4).

- **Event queue:** `drainEvents` clears in `finally`. If a handler throws, the delivered events, including the one that threw, are removed and the rest stay queued. New test.
- **Clock guards:** `FixedStepClock.speed` is now a guarded accessor. NaN, Infinity or a negative value hits `invariant`, which throws in DEV; in production the value is ignored. The constructor checks `tickMs` and `maxFrameMs`. New tests cover DEV and production.
- **rng bounds:** `rngInt` requires integer bounds with min ≤ max, and `rngRange` requires min ≤ max, both via `invariant`. New test.
- **Farm cap:** `Farm` no longer lowers food that is already above `foodCap`. New test.
- **GameScene:** `clearEvents()` now runs before `createNewGame`. Added a comment that `rawDelta` assumes no `fps.limit`.
- **Spawn inset:** `spawnInset` 32 → 40, which clears a 64×52 sheep plus the rails. The existing inset test now enforces the new value.
- **Fence:**
  - Post centres stay within the rails, and there are posts along the side rails.
  - The front rails and posts sort by y, like sheep; the back and side parts stay at depth 0.
  - Re-checked in headless Chrome on the production build from `/sheep/`.
- **Asset script:**
  - A missing or unreadable configured folder, an uppercase `.PNG`, or a directory named `*.png` now fails with a clear message and exit 1.
  - All atlases are packed before anything is written, and stale files in `public/assets/atlases/` and `public/assets/fonts/` are pruned.
  - Each path was exercised in a scratch copy: a missing `world/` exits 1 and writes nothing, and the stale `old.json` and `gone.woff2` were removed.
  - Real output is byte-identical to before.
- **Gate:** `npm test` 60/60 in 12 files. Typecheck, lint and build are clean.
- **Browser note:** in 1 of 3 headless runs, a "WebGL context lost" warning appeared as the browser closed. Phaser's renderer never calls `loseContext`, so this is Chrome tearing down headless WebGL, not the app.

### File List

- `src/sim/state.ts` (new)
- `src/sim/rng.ts` (new)
- `src/sim/step.ts` (new)
- `src/sim/commands.ts` (new)
- `src/sim/events.ts` (new)
- `src/sim/selectors.ts` (new)
- `src/core/fixedStep.ts` (new)
- `src/view/assetKeys.ts` (new)
- `src/view/bus.ts` (new)
- `src/view/scenes/PreloadScene.ts` (new)
- `src/view/scenes/GameScene.ts` (new)
- `src/view/field/ObjectPool.ts` (new)
- `src/view/field/EntityLayer.ts` (new)
- `src/view/field/SheepSprite.ts` (new)
- `src/view/field/Fence.ts` (new)
- `src/view/field/.gitkeep` (deleted)
- `src/view/scenes/BootScene.ts` (modified)
- `src/main.ts` (modified: scene list)
- `src/config/tuning.ts` (modified)
- `src/config/constants.ts` (modified: `MAX_FRAME_MS`)
- `scripts/build-assets.ts` (modified: stub → pipeline)
- `scripts/tsconfig.json` (new)
- `tsconfig.json` (modified: `scripts` removed from `include`)
- `package.json`, `package-lock.json` (modified: free-tex-packer-core, @types/node, `typecheck` script)
- `eslint.config.js` (modified: `argsIgnorePattern`)
- `assets/art/sheep/adult-idle.png` (new)
- `assets/art/world/fence-post.png`, `assets/art/world/fence-rail-h.png`, `assets/art/world/fence-rail-v.png` (new)
- `assets/art/ui/pip-food.png`, `assets/art/ui/pip-empty.png` (new)
- `assets/art/.gitkeep` (deleted)
- `assets/CREDITS.md` (modified)
- `public/assets/atlases/sheep-world.png`, `public/assets/atlases/sheep-world.json`, `public/assets/atlases/ui.png`, `public/assets/atlases/ui.json` (new, generated)
- `tests/sim/helpers.ts` (new)
- `tests/sim/rng.test.ts`, `tests/sim/state.test.ts`, `tests/sim/step.test.ts`, `tests/sim/commands.test.ts`, `tests/sim/events.test.ts` (new)
- `tests/core/fixedStep.test.ts` (new)
- `tests/sim/.gitkeep` (deleted)
- `README.md` (modified)
- `_bmad-output/implementation-artifacts/deferred-work.md` (modified)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modified)
- `_bmad-output/implementation-artifacts/1-2-simulation-core-and-game-clock.md` (this story)

## Change Log

| Date | Change |
|---|---|
| 2026-10-05 | Implemented the sim core (state, rng, step, commands, events, selectors), the fixed-step clock, the Boot → Preload → Game scenes with the pooled `EntityLayer`, and the atlas pipeline with placeholder art. Closed the two Story 1.2 deferred items. Found and fixed a frame-rate dependence (Phaser smoothed delta → `rawDelta`). Status → review. |
| 2026-10-05 | Code review: 10 patches applied (event redelivery, clock speed guards, rng bounds, Farm cap, event clear order, rawDelta note, spawn inset, fence posts and depth, asset script folder checks and pruning). 4 items deferred to `deferred-work.md`. Status → done. |
