---
title: 'Game Architecture'
project: 'sheep-civilization'
date: '2026-10-05'
author: 'Rylan'
version: '1.0'
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8, 9]
status: 'complete'
engine: 'Phaser 4.2.x (TypeScript, Vite)'
platform: 'Desktop web (Chrome, Firefox, Edge)'

# Source Documents
gdd: 'planning-artifacts/gdds/gdd-sheep-civilization-2026-10-05/gdd.md'
epics: 'planning-artifacts/gdds/gdd-sheep-civilization-2026-10-05/epics.md'
brief: 'planning-artifacts/briefs/brief-sheep-civilization-2026-10-05/brief.md'
ux_design: 'planning-artifacts/ux-designs/ux-sheep-civilization-2026-10-05/DESIGN.md'
ux_experience: 'planning-artifacts/ux-designs/ux-sheep-civilization-2026-10-05/EXPERIENCE.md'
---

# Game Architecture

## Executive Summary

**Sheep Civilization** architecture is designed for **Phaser 4.2.x (TypeScript, Vite 8)** targeting **desktop web browsers** (GitHub Pages, itch.io).

**Key Architectural Decisions:**

- A pure-TypeScript simulation over one serializable `GameState`, stepped at a fixed 10 ticks per game-second with timers stored as absolute deadlines. Phaser is a read-only view that sends typed commands and receives typed events.
- Custom flock steering on a spatial grid (no physics engine) and a seeded PRNG stored in state, for 100 sheep at 60 FPS and fully reproducible tests.
- Versioned, validated localStorage saves with settings stored separately; a single death pipeline and a secrecy selector guarantee the contagion chain and keep the Abomination hidden.

**Project Structure:** Hybrid organization (`sim/` pure rules vs `view/` Phaser, one file per system) with 16 core systems.

**Implementation Patterns:** 8 patterns (4 novel, 4 standard) plus 10 enforced consistency rules ensure AI agent consistency.

**Ready for:** Epic implementation phase

## Document Status

**Status:** Complete — all 9 workflow steps finished on 2026-10-05.

## Project Context

### Game Overview

**Sheep Civilization** - a 2D single-screen active clicker: farm food, feed and breed pixel sheep, grow one pasture through four eras. Cozy surface; starvation, carcass contagion, sacrifice and a hidden killer lamb underneath.

### Technical Scope

**Platform:** Desktop web (Chrome, Firefox, Edge — latest 2), deployed to GitHub Pages and itch.io
**Genre:** Idle/incremental (active clicker with creature care)
**Project Level:** Low–medium complexity; solo, 7-day build; no networking

### Core Systems

| System | Complexity | GDD Reference |
|---|---|---|
| Simulation tick & game-time clock (pausable) | Medium | Mechanics, Platform-Specific (Pause) |
| Sheep entity model & life stages | Low | Life Stages |
| Hunger / Fullness & feeding (food pieces, seeking) | Medium | Hunger, Farming and Feeding |
| Movement & flock spacing (wander, seek, 24/36 px avoidance) | Medium | Abomination, Performance |
| Breeding (Breed tool, cooldown, gestation, capacity) | Low | Breeding |
| Carcasses & virus contagion chain | Medium | Carcasses, Virus |
| Drag & drop targets (Market, Better Place, medicine) | Medium | Market, Better Place, Controls |
| Better Place sacrifice, boost & reveal | Low | Better Place, Abomination |
| Abomination (spawn rules, kill cycle, tells) | High | Abomination |
| Economy & shop (money, land, upgrades, auto-feeder) | Low | Upgrade Trees, Automation |
| Eras (derived from live count, regress) | Low | Meta-Progression, Level Progression |
| Overcrowding infection roll | Low | Overcrowding |
| Save/load & visibility pause | Medium | Platform-Specific |
| HUD / UI scenes (start, pause, shop, lose, credits, toasts, captions) | Medium | UX EXPERIENCE.md |
| Audio (music, ~10 SFX, hunger-scaled bleats, captions) | Low | Audio |
| Juice / feedback (popups, particles, shake w/ reduced-motion) | Low | Core Click, UX Game Feel |

### Technical Requirements

- 60 FPS sustained with 100 sheep, 5-min run, Chrome + Firefox, integrated GPU
- Initial load < 5 s; total build < 8 MB
- Fixed 16:9 canvas scaled to fit (UX: 1280×720 base, 960×540 minimum)
- All game state in one plain serializable object (save + tests)
- Autosave to localStorage every 10 s and on tab hide; exact resume; Restart wipes save; settings stored separately
- Simulation fully stops on `visibilitychange` hidden
- Mouse primary; F / G / Esc shortcuts; 6 px click-vs-drag threshold
- No networking, no backend, no portal SDKs

### Complexity Drivers

- Sim/render separation required by the serializable-state rule
- ~10 concurrent game-time timers that must survive save/load exactly
- Flock spacing at 100 entities within the frame budget
- Context-dependent input modes (breed mode, drag, modal Esc priority)
- Novel: Abomination hidden identity + delayed kill + reveal; contagion chain; eras that regress

### Technical Risks

- 100-sheep performance on integrated GPU (draw calls, O(n²) spacing)
- 7-day scope — architecture must stay minimal
- Save corruption / schema drift across epics
- Abomination identity leaking via tooltip, debug UI or save inspection
- Asset size vs 8 MB budget

## Engine & Framework

### Selected Engine

**Phaser** v4.2.x (latest stable at writing: 4.2.1 "Giedi", 2026-07-09) with **TypeScript** and **Vite**

**Rationale:** Web-first 2D framework matching the desktop-browser target, small build footprint for the 8 MB budget, and WebGL sprite batching suited to 100 sheep. Phaser 4 chosen over the GDD's Phaser 3: the project is greenfield (zero migration cost), v4 is the maintained line, and v3 (3.90, May 2025) is legacy. The GDD's "Phaser 3" reference is superseded by this decision.

**v4 notes for agents:** FX and masks are unified as **Filters**; `setTintFill()` is removed — use `setTint(color).setTintMode(Phaser.TintModes.FILL)` (matters for the infection tint and the Abomination reveal flash). Consult `node_modules/phaser/skills/` and the v4 migration guide before using any v3-era example.

### Project Initialization

```bash
npm create @phaserjs/game@latest
# choose: Web Bundler → Vite → TypeScript
npm install
```

The template's sample scenes are replaced by the structure defined in Project Structure.

### Engine-Provided Architecture

| Component | Solution | Notes |
|---|---|---|
| Rendering | Phaser 4 WebGL renderer, auto-batched sprites | Texture atlases keep the flock to few draw calls |
| Physics | Arcade / Matter available | Whether to use either is decided in Architectural Decisions |
| Audio | Phaser Sound Manager (Web Audio) | Browser autoplay unlock on first input |
| Input | Phaser Input Plugin (pointer, keyboard, drag events) | 6 px click/drag threshold implemented on top |
| Scene Management | Phaser Scenes (start / launch parallel / pause) | Used for Boot, Preload, Title, Game, HUD, overlays |
| Scaling | Phaser Scale Manager (`FIT` + `CENTER_BOTH`) | 1280×720 base canvas, 16:9 |
| Timing | Game loop `update(time, delta)` | Game-time clock built on top |
| Build System | Vite (dev server, production bundle) | Static output for GitHub Pages and itch.io |

### Remaining Architectural Decisions

1. Simulation/render separation and the shape of the single serializable state object
2. Game-time clock, tick rate, and how timers are stored
3. Flock movement and spacing approach (custom steering vs Arcade physics; spatial partitioning)
4. Scene layout and scene-to-scene communication
5. Input mode handling (click vs drag, breed mode, Esc priority)
6. Save/load format, versioning and validation; settings storage
7. RNG strategy (seeded vs Math.random) for spawns, kill cycle, overcrowding
8. Asset pipeline (atlases, audio sprites, fonts) within 8 MB
9. Testing approach for the pure simulation
10. Tuning-data location and debug tooling (without leaking the Abomination)

### Development Environment — AI Tooling

- **Context7** (upstash/context7) MCP: agents fetch current Phaser 4 docs instead of relying on training data. Setup: `claude mcp add context7 -- npx -y @upstash/context7-mcp@latest` (verified 2026-10-05; see Development Environment)
- **Phaser bundled agent skills:** `node_modules/phaser/skills/` (including v3→v4 migration)
- No Phaser-specific MCP server is maintained; none used.

## Architectural Decisions

### Decision Summary

| # | Category | Decision | Version | Rationale |
|---|---|---|---|---|
| 1 | State management | Pure-TS simulation over one serializable `GameState`; Phaser is a read-only view that sends commands | — | GDD mandates one plain serializable object; testable without a browser; save is trivial |
| 2 | Game time | Fixed-step sim at 10 ticks/game-second via accumulator; timers stored as absolute game-time deadlines | — | Frame-rate independent; exact save/restore; pause = stop accumulating |
| 3 | Movement / AI | Custom steering (wander, seek, separation) in the sim + uniform spatial grid (48 px cells); no physics engine | — | Exact control of 24/36 px spacing; O(n) neighbour queries for 100 sheep |
| 4 | Scene structure | Boot → Preload → Title → Game + parallel Hud + Overlay; typed event bus out, typed commands in | Phaser 4.2.x | Clean separation of field, HUD and modals |
| 5 | Input | Single `InputController` state machine (`idle` / `breeding` / `dragging`) with 6 px threshold and Esc priority chain | — | One owner for all context-dependent input |
| 6 | Persistence | JSON in localStorage, versioned + validated; settings stored separately | — | Small save, exact resume, survives schema changes between epics |
| 7 | Randomness | Seeded mulberry32 PRNG, seed and state stored in `GameState` | — | Reproducible bugs and deterministic tests |
| 8 | Assets | 2 texture atlases (free-tex-packer), 1 SFX audio sprite, 1 music file, self-hosted fonts | free-tex-packer | Few draw calls; stays well under 8 MB |
| 9 | Testing | Vitest unit + seeded scenario tests on the pure sim; rendering verified manually | Vitest 4.1.x (verified 2026-10-05) | Proves GDD rules and save integrity cheaply |
| 10 | Tuning & debug | All (tune) values in `config/tuning.ts`; dev-only debug overlay stripped via `import.meta.env.DEV` | — | Fast tuning; production can never reveal the Abomination |
| 11 | Toolchain | Node 24 LTS; Vite 8.x (as installed by the Phaser template); TypeScript 6.x; TS 7 native compiler not adopted for v1 | Node 24, Vite 8.x, TS 6.x (verified 2026-10-05) | Stable, template-compatible; ESLint TS tooling may lag TS 7; Vite strips types so TS version only affects `tsc --noEmit` |
| 12 | Deployment | Vite `base: './'`; GitHub Actions → GitHub Pages on push to `main`; `npm run zip` → manual itch.io upload | — | One `dist/` works on both hosts |

### State Management

**Approach:** Pure TypeScript simulation over a single serializable state object.

- `GameState` is plain data only: numbers, strings, booleans, arrays and plain objects. No class instances, `Map`/`Set`, functions, Phaser objects or circular references. `JSON.stringify(state)` must round-trip losslessly.
- Entities (sheep, carcasses, food pieces) are stored in arrays of plain records with a stable numeric `id` from `state.nextId`. References between entities use ids, never object references.
- Only `src/sim/` mutates `GameState`. Entry points: `step(state)` (advance one tick) and `applyCommand(state, cmd)` (player intent). Both are pure in the sense of having no I/O, no Phaser and no `Date.now()`/`Math.random()`.
- The Farm bar lives in `state.farmProgress`: integer pips in the current bar (0 to `TUNING.farmPipsPerFood − 1`). Every full bar drops a food piece at a seeded-random reachable spot in the pen; there is no food stock (changes 2026-10-06).
- The breeding bar lives in `state.breedingProgress` (0 to `TUNING.breedingPipsPerFood − 1`). Every full bar drops a breeding piece into `state.breedingPieces: { id, x, y }[]` at a seeded-random reachable spot. A sheep that eats one gets `breedReady: true`; there is no breeding stock (changed 2026-10-06).
- Pending lambs live in `state.pregnancies: { parentA, parentB, dueAt, x, y }[]`; capacity checks count living sheep **plus** pregnancies.
- Derived values (current era, Fed/Hungry/Starving, flock count, capacity) are computed by selector functions, never stored, so they cannot drift. Era regression falls out naturally.
- The Abomination flag lives on the sheep record (`isAbomination`) but is **only** read by `sim/` and the reveal path; view and tooltip code must use selectors that do not expose it.

### Game Time

- The sim advances in fixed ticks of 100 ms of game-time (`TICK_MS = 100`). The Game scene accumulates real `delta` (clamped to 250 ms per frame to avoid spiral-of-death) and runs whole ticks.
- `state.time` is game-milliseconds since the save began. All timers are absolute deadlines (`diesAt`, `bornAt`, `cooldownUntil`, `boostUntil`, `nextKillAt`, `nextOvercrowdRollAt`), so saving and loading needs no timer rebuilding.
- Pause (Esc menu, `visibilitychange` hidden) stops accumulation; nothing else is required.
- Rendering interpolates sheep positions between the previous and current tick for smooth 60 FPS motion. Previous positions are stored **on the sprites** (each sprite remembers its last sim position); `GameState` has no `prevX`/`prevY`.

### Movement and Flock Spacing

- Steering behaviours computed per tick in `sim/movement.ts`: wander, seek target (food piece, carcass, kill victim), separation (24 px; 36 px from the Abomination), and fence containment.
- A uniform grid (48 px cells, rebuilt each tick) answers neighbour queries; no Arcade or Matter physics is enabled.
- Dragged sheep are excluded from steering until dropped; a drop outside the fence is clamped back inside (UX).

### Scene Structure and Communication

| Scene | Role |
|---|---|
| `Boot` | Minimal config, loading-bar assets |
| `Preload` | Loads atlases, audio sprite, music; waits for fonts |
| `Title` | Start screen (Continue / New Game / Credits), decorative sheep |
| `Game` | Owns the sim loop, renders field, sheep, carcasses, food, Market, Better Place |
| `Hud` | Bottom bar, meters, counters, threat summary, toasts, captions (parallel to Game) |
| `Overlay` | Pause, Volume, Stats, Credits, Shop panel, start-over confirm, Lose |

- **State → view:** scenes read `GameState` through selectors every frame; they never write it.
- **Sim → view events:** `sim/` pushes typed events (`SheepDied`, `CarcassSpawned`, `Infected`, `EraChanged`, `Sacrificed`, `Sold`, `BoostStarted`, `LastSheep`, `Lost`, …) into a per-tick event queue; the Game scene drains it and re-emits on a typed `EventBus` for HUD, audio, juice and captions.
- **View → sim:** input becomes typed `Command`s (`Farm`, `FarmBreeding`, `ClearCarcass`, `Breed`, `Sell`, `Sacrifice`, `Buy`, `ApplyMedicine`) applied at the start of the next tick.

### Input Handling

- One `InputController` (in `src/input/`) owns pointer and keyboard handling. Modes: `idle`, `breeding` (awaiting adult A / adult B), `dragging` (sheep or medicine).
- Pointer down + > 6 px movement → drag; otherwise click on release.
- **Esc priority:** close confirm → close sub-panel (Volume/Stats/Credits) → cancel drag → exit breed mode → close shop → open/close pause.
- Breed mode also cancels on right-click or clicking Breed again; it exits after one pair (UX).
- Right-drag (past the 6 px threshold) pans the field camera (`PenCamera`), pinned so the whole pen stays in view; every game opens centred on the pen above the bar. View state only, never saved (added 2026-10-06).

### Data Persistence

**Save system:** localStorage JSON.

- Key `sheepciv.save.v1`; payload `{ schemaVersion: number, savedAt: string (ISO), state: GameState }`.
- Autosave every 10 s of real time while playing and on `visibilitychange` → hidden.
- On load: parse → check `schemaVersion` (run migrations if older) → validate shape → resume. On any failure, log a warning, discard the save and offer New Game only.
- New Game (with save) and Restart wipe the save after the UX confirm; Lose → Restart wipes without confirm.
- Settings (music volume, SFX volume, reduced motion, captions) in `sheepciv.settings`, independent of the save.

### Randomness

- `sim/rng.ts`: mulberry32 seeded PRNG. `state.rng` holds the current 32-bit state; every random draw in the sim goes through it.
- `Math.random()` is allowed only in view-only cosmetic code (particle jitter, idle bleat variation).

### Asset Management

**Loading strategy:** Preload everything in `Preload` (one fixed screen; total well under 8 MB).

- Atlases: `sheep-world` (sheep frames, carcass, food, Market, Better Place, decorations, fence) and `ui` (buttons, panels, icons, pips). Packed with free-tex-packer to JSON-hash format Phaser reads natively. Pixel art: `pixelArt: true`, nearest-neighbour filtering.
- Era backgrounds: 4 separate images (large, swapped rarely).
- Audio: SFX in one audio sprite (OGG + MP3 fallback); one music loop. Audio unlocks on first pointer input.
- Fonts: Pixelify Sans and Nunito self-hosted as WOFF2 and loaded with the CSS Font Loading API before `Title` renders (no network calls to Google Fonts at runtime).

### Testing

- Vitest 4.1.x runs against `src/sim/` only (no Phaser in tests).
- Scenario tests use a fixed seed and step the sim N ticks, e.g. an unfed sheep dies at 120 s; the contagion chain; breeding cooldown; era regression; Abomination spawn window; save → JSON → load equality.
- Rendering, juice and audio are checked manually during the day-6 playtest.

### Tuning and Debug

- `src/config/tuning.ts` exports one frozen object containing every GDD value marked (tune) plus timings (drain rate, walk speed, spacing, cooldowns, costs, kill-cycle window, overcrowding odds).
- Debug overlay (backtick key) exists only when `import.meta.env.DEV` is true: FPS, sheep count, sim speed ×1/×4/×16, step-one-tick, reveal Abomination, spawn carcass. Tree-shaken from production builds.

### Architecture Decision Records

- **ADR-1 Pure simulation core.** *Context:* the GDD requires one serializable state, and AI agents will implement features in parallel. *Decision:* all game rules live in `src/sim/` with no Phaser dependency. *Consequence:* a little more upfront structure; in return saves, tests and agent boundaries are simple.
- **ADR-2 Fixed tick with absolute deadlines.** *Context:* about 10 concurrent timers must survive save/load exactly. *Decision:* a 100 ms fixed step, with timers stored as game-time deadlines. *Consequence:* deterministic and frame-rate independent; rendering needs interpolation.
- **ADR-3 No physics engine.** *Context:* flock spacing rules are behavioural, not physical. *Decision:* custom steering plus a spatial grid. *Consequence:* about 100 lines of owned code; nothing lives outside the saved state.
- **ADR-4 Seeded RNG in state.** *Context:* random spawns, kill cycles and overcrowding must be testable and reproducible. *Decision:* mulberry32 seeded PRNG with its state stored in `GameState`. *Consequence:* `Math.random()` is banned in the sim.

## Cross-cutting Concerns

These patterns apply to ALL systems and must be followed by every implementation.

### Error Handling

**Strategy:** Assert inside the sim, recover at the boundaries, global safety net on top.

**Error levels:**

| Level | Where | Behaviour |
|---|---|---|
| Invariant violation | `src/sim/` (impossible state) | `invariant()` throws in DEV; in production logs once via `log.error` and skips the offending entity/command |
| Recoverable boundary failure | Save load, localStorage quota/denied, audio unlock, font load | `try/catch` → `log.warn` → fallback (new game / silent audio / system font) |
| Unhandled | Anywhere | Global `window.onerror` + `unhandledrejection` → `log.error`; production shows toast "Something went wrong — your flock was saved." after forcing a save; game continues |

Players never see stack traces. Errors never pause the game unless the sim itself cannot step.

**Example:**

```typescript
// src/core/invariant.ts
export function invariant(cond: unknown, msg: string): asserts cond {
  if (cond) return;
  if (import.meta.env.DEV) throw new Error(`Invariant: ${msg}`);
  log.error('sim', `Invariant: ${msg}`);
}

// src/save/saveStore.ts — boundary
export function loadSave(): SaveFile | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    return migrateAndValidate(JSON.parse(raw));
  } catch (err) {
    log.warn('save', 'Save unreadable; starting fresh', err);
    return null;
  }
}
```

### Logging

**Format:** `[tag] message` with optional data object, via `src/core/log.ts`
**Destination:** browser console only; no external services

**Log levels:**

| Level | Use | Production |
|---|---|---|
| `error` | Invariant failures, unhandled errors | Kept |
| `warn` | Recovered boundary failures | Kept |
| `info` | Milestones: save written, era changed, game loaded | Stripped |
| `debug` | Diagnostics during development | Stripped |

Tags: `boot`, `save`, `sim`, `input`, `audio`, `ui`, `debug`. No logging inside per-tick sim loops or per-frame render code.

**Example:**

```typescript
log.info('save', 'Autosaved', { sheep: state.sheep.length, time: state.time });
log.warn('audio', 'Autoplay locked; waiting for first input');
```

### Configuration

**Approach:** three layers, all typed TypeScript modules (no runtime-fetched config).

| Layer | Location | Contents |
|---|---|---|
| Tuning | `src/config/tuning.ts` | Every GDD (tune) value and balance number: drain rate, food value, walk speed, spacing, ages, cooldowns, prices, capacities, era thresholds, kill-cycle window, overcrowding odds |
| Constants | `src/config/constants.ts` | `TICK_MS`, canvas 1280×720, save/settings keys, schema version, colour tokens mirrored from DESIGN.md |
| Player settings | localStorage `sheepciv.settings` | Music volume, SFX volume, reduced motion, captions |

Sim code reads tuning values from `TUNING`, never literals. View code reads colours from `COLORS`, never hex literals.

### Event System

**Pattern:** two typed channels.

1. **Sim events (sim → view):** the sim appends to a per-tick `SimEvent[]` queue kept outside `GameState` (events are never saved); after each tick the Game scene drains it and publishes on the `EventBus`. Synchronous, ordered.
2. **UI events (UI ↔ UI):** typed `EventBus` (thin wrapper over Phaser's EventEmitter with a type map).

**Event naming:** sim events are past-tense PascalCase discriminated-union `type`s (`SheepDied`, `CarcassSpawned`, `Infected`, `Cured`, `EraChanged`, `Sacrificed`, `AbominationRevealed`, `Sold`, `BoostStarted`, `BoostEnded`, `LambBorn`, `LastSheep`, `Lost`). UI events are `noun:verb` strings (`shop:toggled`, `pause:opened`, `settings:changed`). Listeners are removed in the scene's `shutdown` handler.

**Example:**

```typescript
// src/sim/events.ts
export type SimEvent =
  | { type: 'SheepDied'; id: number; name: string; cause: 'starved' | 'oldAge' | 'virus' | 'abomination'; x: number; y: number }
  | { type: 'EraChanged'; from: Era; to: Era }
  | { type: 'Sacrificed'; id: number; name: string; wasAbomination: boolean };

// Game scene, after stepping
for (const e of drainEvents()) bus.emit('sim', e);

// Hud scene
bus.on('sim', (e) => { if (e.type === 'SheepDied') toasts.push(deathToast(e)); }, this);
```

Note: `cause: 'abomination'` is used for audio/stat logic only; the death toast for that cause must use the deliberately vague UX string ("{name} just… fell over.").

### Formats

| Data | Format | Helper |
|---|---|---|
| Game-time display (lose screen, stats, boost timer) | `m:ss`; `h:mm:ss` from one hour | `formatGameTime(ms)` in `src/core/format.ts` |
| Money | `$` + whole number, no K/M notation | `formatMoney(n)` |
| Save timestamp | ISO 8601 string (`savedAt`) | `new Date().toISOString()` in `src/save/` only |
| Internal time | integer game-milliseconds | — |

### Build and Deployment

- `vite.config.ts` sets `base: './'` so one `dist/` works on GitHub Pages (subpath) and itch.io.
- `.github/workflows/deploy.yml`: on push to `main` → `npm ci` → `npm test` → `npm run build` → deploy `dist/` to GitHub Pages.
- `npm run zip` packages `dist/` as `sheep-civilization.zip` for manual itch.io HTML5 upload.
- Scripts: `dev`, `build`, `preview`, `test`, `lint`, `typecheck` (`tsc --noEmit`), `assets`, `zip`.

### Debug Tools

**Available tools (DEV builds only):**

- FPS and frame-time readout, sheep / carcass / food counts
- Sim speed ×1 / ×4 / ×16, pause, step one tick
- Reveal Abomination (outline), spawn carcass, infect random sheep, add money / food
- Dump `GameState` to console; copy save JSON to clipboard; load save from clipboard

**Activation:** backtick (`` ` ``) toggles the overlay. Module is imported only under `if (import.meta.env.DEV)` so it is tree-shaken from production builds.

## Project Structure

### Organization Pattern

**Pattern:** Hybrid — layered at the top (`sim/` pure rules vs `view/` Phaser), by feature/system within each layer.

**Rationale:** The top-level split physically enforces ADR-1 (pure simulation core); one file per GDD system inside `sim/systems/` lets agents work on separate systems in parallel without collisions. Keeps the repo's existing `src/`, `tests/`, `assets/`, `docs/` folders.

### Directory Structure

```
sheep-civilization/
├── .github/workflows/deploy.yml  # build + test + GitHub Pages
├── index.html
├── package.json · tsconfig.json · vite.config.ts · vitest.config.ts
├── assets/                       # SOURCE assets (not shipped directly)
│   ├── art/{sheep,world,ui,backgrounds}/   # loose PNGs from Kenney etc.
│   ├── audio/{sfx,music}/                  # source WAV/OGG
│   ├── fonts/                              # Pixelify Sans, Nunito (WOFF2 + licences)
│   └── CREDITS.md                          # asset licences → Credits screen
├── public/assets/                # BUILT runtime assets (generated, committed)
│   ├── atlases/{sheep-world,ui}.{png,json}
│   ├── backgrounds/{pasture,village,town,wool-empire}.png
│   ├── audio/{sfx.ogg,sfx.mp3,sfx.json,music.ogg,music.mp3}
│   └── fonts/*.woff2
├── scripts/
│   └── build-assets.ts           # free-tex-packer + audio sprite → public/assets (`npm run assets`)
├── src/
│   ├── main.ts                   # Phaser.Game config, font load, scene list
│   ├── config/
│   │   ├── tuning.ts             # every (tune) value
│   │   └── constants.ts          # TICK_MS, canvas, keys, COLORS (from DESIGN.md)
│   ├── core/                     # shared, engine-free utilities
│   │   ├── log.ts · invariant.ts · eventBus.ts · types.ts · format.ts
│   ├── sim/                      # PURE GAME RULES — no Phaser, no DOM
│   │   ├── state.ts              # GameState type + createNewGame(seed)
│   │   ├── step.ts               # step(state): runs systems in fixed order
│   │   ├── commands.ts           # Command union + applyCommand()
│   │   ├── events.ts             # SimEvent union + per-tick queue
│   │   ├── selectors.ts          # era, hunger state, flock count, capacity, public sheep view
│   │   ├── rng.ts                # mulberry32
│   │   ├── grid.ts               # spatial grid
│   │   └── systems/
│   │       ├── hunger.ts · feeding.ts · movement.ts · lifecycle.ts
│   │       ├── breeding.ts · carcass.ts · virus.ts · market.ts
│   │       ├── betterPlace.ts · economy.ts · eras.ts · overcrowding.ts
│   │       ├── abomination.ts · medicine.ts · autoFeeder.ts · names.ts
│   ├── save/
│   │   ├── saveStore.ts          # load/save/wipe, autosave timer, visibility hook
│   │   ├── migrations.ts · validate.ts
│   │   └── settingsStore.ts
│   ├── input/
│   │   └── InputController.ts    # idle / breeding / dragging, Esc chain
│   ├── view/                     # PHASER — reads state, sends commands
│   │   ├── scenes/
│   │   │   ├── BootScene.ts · PreloadScene.ts · TitleScene.ts
│   │   │   ├── GameScene.ts · HudScene.ts · OverlayScene.ts
│   │   ├── field/                # SheepSprite, FoodSprite, CarcassSprite, Market, BetterPlace, Fence, EraBackground
│   │   ├── hud/                  # meters, counters, ThreatSummary, Toasts, Captions, BoostTimer
│   │   ├── overlay/              # PausePanel, VolumePanel, StatsPanel, CreditsPanel, ShopPanel, ConfirmPanel, LosePanel
│   │   ├── widgets/              # Button, Panel, Slider, Toggle, Tooltip (DESIGN.md components)
│   │   ├── juice/                # popups, particles, shake (respects reduced motion)
│   │   ├── strings.ts            # all player-facing copy (EXPERIENCE.md Voice table)
│   │   └── audio/AudioDirector.ts  # maps SimEvents → SFX, captions, hunger bleats
│   └── debug/
│       └── DebugOverlay.ts       # DEV only
├── tests/
│   ├── sim/                      # one test file per system + scenarios/
│   └── save/                     # round-trip, migration, corrupt-save
└── docs/                         # short README pointing to _bmad-output/ planning artifacts
```

`public/assets/` is generated by `npm run assets` and **committed**, so deployment is `vite build` only. Planning documents remain in `_bmad-output/`; `docs/` links to them rather than duplicating.

### System Location Mapping

| System | Location | Responsibility |
|---|---|---|
| Game state & new game | `src/sim/state.ts` | `GameState` type, `createNewGame(seed)` (starting flock, empty Farm bar) |
| Tick orchestration | `src/sim/step.ts` | Advances `state.time`, runs systems in fixed order |
| Player commands | `src/sim/commands.ts` | Validates and applies `Command`s |
| Hunger | `src/sim/systems/hunger.ts` | Fullness drain, starvation death |
| Farming & feeding | `src/sim/systems/feeding.ts` | Farm and breeding progress, food and breeding pieces (dropped by full bars), eating both |
| Movement & spacing | `src/sim/systems/movement.ts` + `src/sim/grid.ts` | Wander, seek, separation, fence containment |
| Life stages | `src/sim/systems/lifecycle.ts` | Ageing, elder (clears `breedReady`), old-age death, gestation/birth |
| Breeding | `src/sim/systems/breeding.ts` | Pair validation (two ready adults), cooldown, capacity |
| Carcasses | `src/sim/systems/carcass.ts` | Spawn on death, clear, starving-eats-carcass |
| Virus | `src/sim/systems/virus.ts` | Infection, 20 s death |
| Market | `src/sim/systems/market.ts` | Selling rules and prices |
| Better Place | `src/sim/systems/betterPlace.ts` | Sacrifice, boost, reveal event |
| Economy & shop | `src/sim/systems/economy.ts` | Money, purchases, land tiers, upgrades |
| Eras | `src/sim/systems/eras.ts` + `selectors.ts` | Derived era; emits `EraChanged` on change |
| Overcrowding | `src/sim/systems/overcrowding.ts` | 90% capacity infection rolls |
| Abomination | `src/sim/systems/abomination.ts` | Spawn rule, kill cycle, delayed victim death |
| Medicine | `src/sim/systems/medicine.ts` | Cure command |
| Auto-feeder | `src/sim/systems/autoFeeder.ts` | 10 s drop next to hungriest sheep |
| Names | `src/sim/systems/names.ts` | Name list, assignment via RNG |
| Save / settings | `src/save/` | localStorage, versioning, validation, autosave, visibility pause |
| Input | `src/input/InputController.ts` | Click/drag, breed mode, Esc chain → commands |
| Field rendering | `src/view/field/` + `GameScene.ts` | Sprites, interpolation, era background crossfade |
| HUD | `src/view/hud/` + `HudScene.ts` | Bottom bar, threat summary, toasts, captions |
| Menus & modals | `src/view/overlay/` + `OverlayScene.ts`, `TitleScene.ts` | Title, pause, shop, confirm, lose, credits, settings |
| Juice | `src/view/juice/` | Popups, particles, shake (reduced-motion aware) |
| Audio | `src/view/audio/AudioDirector.ts` | Event → SFX/caption mapping, music, volumes |
| Debug | `src/debug/DebugOverlay.ts` | DEV-only tools |
| Asset build | `scripts/build-assets.ts` | Atlases, audio sprite |

### Naming Conventions

#### Files

- Phaser classes and scenes: PascalCase file = class name (`GameScene.ts`, `SheepSprite.ts`)
- Sim, core, save modules: camelCase file exporting functions (`hunger.ts`, `saveStore.ts`)
- Tests: `<module>.test.ts`, mirroring the source path (`tests/sim/hunger.test.ts`)

#### Code Elements

| Element | Convention | Example |
|---|---|---|
| Types / interfaces | PascalCase, no `I` prefix | `Sheep`, `GameState`, `SimEvent` |
| Classes | PascalCase | `InputController`, `SheepSprite` |
| Functions / variables | camelCase | `dropFood`, `cooldownUntil` |
| Constants | UPPER_SNAKE | `TICK_MS`, `TUNING`, `COLORS` |
| Scene keys | PascalCase string = class name | `'HudScene'` |
| Sim events | PascalCase past tense, `type` discriminant | `SheepDied` |
| UI events | `noun:verb` | `shop:toggled` |
| Commands | PascalCase imperative, `type` discriminant | `Farm`, `Sacrifice` |
| Game-time fields | ms of game-time, suffix `At` / `Until` | `diesAt`, `boostUntil` |
| Sim system entry | `update<System>(state)` | `updateHunger(state)` |

#### Game Assets

- kebab-case, `entity-state[-frame]`: `adult-walk`, `adult-hungry-walk`, `carcass`, `btn-farm`, `icon-infection`
- Audio sprite markers: `sfx-<name>`: `sfx-pop`, `sfx-thud`, `sfx-suction`, `sfx-fanfare`, `sfx-sting`
- Backgrounds: era id: `pasture`, `village`, `town`, `wool-empire`

### Architectural Boundaries

1. `src/sim/` and `src/core/` never import `phaser`, `src/view/`, `src/save/`, `src/input/`, or DOM APIs (enforced by an ESLint `no-restricted-imports` rule).
2. `src/view/` and `src/input/` never mutate `GameState`; they read via selectors and dispatch `Command`s.
3. Only `src/save/` touches `localStorage`.
4. `src/debug/` is imported only behind `import.meta.env.DEV`.
5. Sim systems are called only from `step.ts` in a fixed order; they communicate only through `GameState` and never call each other.
6. View code never reads `isAbomination` directly; it uses the public sheep selector.

## Implementation Patterns

These patterns ensure consistent implementation across all AI agents.

### Novel Patterns

#### N1 — Single Death Pipeline (Contagion Chain)

**Purpose:** Guarantee every non-sacrifice death leaves a carcass so the contagion chain (death → carcass → infection → death) can never be broken by an implementation that forgets a step.

**Components:**
- `killSheep(state, id, cause)` in `src/sim/systems/carcass.ts` — the only way a sheep dies
- `removeSheep(state, id, reason)` — the only way a sheep leaves without dying (`sold`, `sacrificed`)

**Data Flow:** hunger / lifecycle / virus / abomination detect a death condition → `killSheep` → stats updated, `SheepDied` emitted, carcass created at the sheep's position → carcass system lets starving sheep eat it → virus system infects the eater → `killSheep(…, 'virus')` after 20 s.

**Implementation Guide:**

```typescript
export type DeathCause = 'starved' | 'oldAge' | 'virus' | 'abomination';

export function killSheep(state: GameState, id: number, cause: DeathCause): void {
  const s = findSheep(state, id);
  invariant(s, `killSheep: unknown sheep ${id}`);
  state.sheep = state.sheep.filter((x) => x.id !== id);
  state.stats.died += 1;
  state.carcasses.push({ id: nextId(state), x: s.x, y: s.y, createdAt: state.time });
  emit({ type: 'SheepDied', id, name: s.name, cause, x: s.x, y: s.y });
  checkLastSheepAndLoss(state);
}
```

**Usage:** Any system that ends a sheep's life calls `killSheep`. Selling and sacrifice call `removeSheep`, which also calls `checkLastSheepAndLoss(state)` — selling or sacrificing the last sheep is a loss. No other code splices `state.sheep`.

**Epic 1 staging:** Epic 1 implements `killSheep` with the carcass spawn gated by `TUNING.carcassesEnabled` (false in Epic 1, true from Epic 2), so the single death path exists from day 1.

#### N2 — Abomination: Hidden Identity, Delayed Kill, Reveal

**Purpose:** A killer that is indistinguishable from a lamb in every data path the view can see, except the designed tells.

**Components:**
- Sheep record fields (sim-only): `isAbomination: boolean`, `stalk?: { victimId: number; phase: 'approach' | 'linger' | 'leave'; until: number }`
- Victim field: `doomedAt?: number` (game-time of delayed death, 5–10 s after contact)
- `state.abomination`: `{ birthsSeen: number; guaranteedAtBirth: number; nextKillAt: number }`
- `publicSheep(s)` selector — the only sheep shape the view may consume
- `Sacrificed { wasAbomination }` event — the only moment the view learns the truth

**Data Flow:**
1. **Spawn:** on each birth, `lifecycle.ts` `births()` calls `abomination.ts` `onBirth(state, lamb)` (a helper owned by the concept, like `killSheep`; systems never consume `SimEvent`s, and `LambBorn` looks the same either way). It counts the birth, then sets `isAbomination` when none is alive and `birthsSeen === guaranteedAtBirth` (rolled 8–15 at new game) or, past that birth, RNG < 5% (Story 4.1).
2. **Kill cycle:** at `nextKillAt` (45–60 s window) pick a random victim ≠ self → `stalk.phase = 'approach'` (seek victim) → on contact `'linger'` for 1 s → set victim `doomedAt` → `'leave'` → schedule next.
   - (Story 4.3) `updateAbomination` in `abomination.ts` runs after the virus. `makeAbomination` (births and DEV alike) sets the first `nextKillAt`; each leave sets the next. The visit starts only while the Abomination is `wander`: a busy one (seeking, eating, dragged) makes it wait, so hunger always gets its turn. Feeding and carcass eating never claim a `stalking` sheep.
   - **Contact** is a centre distance ≤ `TUNING.abominationContactPx` (30), between `personalSpacePx` (24) and `abominationSpacePx` (36). Inside 36 px the victim is pushed away by the 4.2 spacing; at 30 px it eases off at 15 px/s, so the Abomination reaches it without a chase, and during the linger the victim visibly steps away a little.
   - Victims: any living sheep but the Abomination, a dragged one or an already doomed one (one draw over them; none → idle with no draw, the visit stays due). A victim gone or lifted before contact is re-picked on that tick; one lost during the linger just gets no doom.
   - Interruptions: `pickUp` deletes the stalk, so lifting the Abomination before the doom spares the victim from that visit (the next visit is due at once and may pick it again). A victim held in the air when the linger ends is not doomed. An approach keeps its first deadline across re-picks; with no contact by `abominationApproachMaxMs` (20 s) it is given up and rescheduled. (Story 4.3 review, Rylan.)
   - **Loss:** the game is lost when no sheep but the Abomination is alive (`checkLastSheepAndLoss`; Story 4.3 review, Rylan): a lone Abomination can never breed or be sold.
   - `stalk` exists exactly while the activity is `stalking`; `pickUp` and the leave's end remove it.
3. **Delayed death:** `updateAbomination` (not lifecycle; Story 4.3 follows the System Location Mapping) calls `killSheep(state, victimId, 'abomination')` on the first tick with `state.time >= doomedAt`. The doom stands even if the Abomination is sacrificed, starves or is lifted afterwards. Already-doomed sheep are never picked again.
4. **Reveal:** sacrifice emits `Sacrificed { wasAbomination: true }` → view plays true-form flash, screech, "Good riddance."; innocent → "…that was just {name}."

**Rules and edge cases:**
- Never ages past lamb (`stageOf` returns `'lamb'` for it, so it cannot be sold, bred or fed breeding food); never dies of old age; **can starve** (eats normally) so a lone Abomination still produces a loss.
- If the victim dies, is sold or is sacrificed before contact, choose a new victim. If no other sheep exists, idle until one does.
- It counts toward capacity and eras.
- Tells exposed through `publicSheep`: `gait: 'offstep'`. Wider separation (36 px) is applied inside the sim, so other sheep visibly avoid it.
  - (Story 4.2) The off-step is a **rhythm on the shared lamb frames**: every sheep walks by alternating its pose frame with a `-walk` step frame, evenly; the Abomination's beats alternate long and short with a one-art-pixel dip on the short one (`src/view/field/gait.ts`). There are no `lamb-offstep-*` frames, so its art is exactly a lamb's.
  - (Story 4.2) The avoidance is **asymmetric**: every other sheep separates from it over `TUNING.abominationSpacePx` (36), while the Abomination feels only `personalSpacePx` (24) from them, so the flock gives it room and it does not shy away (`movement.ts`). With no Abomination alive the steering path is unchanged.
- Death toast for `cause: 'abomination'` uses the vague UX string.
- (Story 4.3) Nothing is emitted for a visit: no event at its start, contact, doom or leave. `PublicSheep.activity` reports `stalking` as `wander`, and `PublicSheep` carries no `stalk` or `doomedAt`. The ESLint secrecy rule blocks `isAbomination`, `stalk`, `doomedAt`, `nextKillAt` and member reads of `.abomination` outside `src/sim/`, `src/debug/` and `src/save/` (not the `abomination` property key, which `DeathCause` maps use).

**Implementation Guide:**

```typescript
export interface PublicSheep {
  id: number; name: string; x: number; y: number;
  stage: 'lamb' | 'adult' | 'elder';
  hunger: 'fed' | 'hungry' | 'starving';
  infected: boolean; onCooldown: boolean;
  ready: boolean;            // breedReady; not secret: the Abomination never grows past a lamb, so it is never ready
  gait: 'normal' | 'offstep';
  activity: PublicActivity;  // Exclude<SheepActivity, 'stalking'>: 'stalking' reported as 'wander'
}

export function publicSheep(s: Sheep, state: GameState): PublicSheep {
  return {
    id: s.id, name: s.name, x: s.x, y: s.y,
    stage: stageOf(s, state),   // stageOf returns 'lamb' for the Abomination at any age (Story 4.1), so the sim agrees
    hunger: hungerOf(s),
    infected: s.infectedAt !== undefined,
    onCooldown: state.time < s.cooldownUntil,
    ready: s.breedReady,
    gait: s.isAbomination ? 'offstep' : 'normal',
    activity: s.activity === 'stalking' ? 'wander' : s.activity,
  };
}
```

**Usage:** `src/view/**`, tooltips, HUD and debug-free code paths consume only `PublicSheep`. Only `src/debug/` may read `isAbomination`.

#### N3 — Sprite ↔ Entity Reconciliation

**Purpose:** Keep Phaser objects in sync with sim entities across ticks, saves, loads and restarts without per-frame allocation.

**Components:** `EntityLayer<TPublic>` (generic, in `src/view/field/`), per-type sprite class, `ObjectPool`.

**Data Flow:** every frame: build id set from selectors → for new ids acquire a pooled sprite and `bind(id)` → for existing ids `sync(public, alpha)` (interpolated position) → for missing ids play exit animation then release to pool.

**Implementation Guide:**

```typescript
sync(items: readonly PublicSheep[], alpha: number): void {
  this.seen.clear();
  for (const it of items) {
    this.seen.add(it.id);
    let spr = this.live.get(it.id);
    if (!spr) { spr = this.pool.acquire(); spr.bind(it.id); this.live.set(it.id, spr); }
    spr.sync(it, alpha);
  }
  for (const [id, spr] of this.live) {
    if (!this.seen.has(id)) { this.live.delete(id); spr.playExit(() => this.pool.release(spr)); }
  }
}
```

**Usage:** sheep, carcasses, food pieces. Sprites hold no game data beyond their bound id and animation state. Pools are pre-sized to 120 sheep, 60 food, 30 breeding pieces, 40 carcasses and **grow on demand** (food and breeding pieces never spoil, so counts are unbounded).

#### N4 — Derived Era with Change Signal

**Purpose:** Eras follow live flock size (and regress) without a stored "progress" value that can drift.

**Components:** `currentEra(state)` selector; `state.lastEra` (cache for change detection only); `updateEras(state)` system; `EraChanged` event.

**Data Flow:** each tick `updateEras` computes `currentEra(state)`; if different from `lastEra`, emits `EraChanged { from, to }` and updates `lastEra`. View listens: background crossfade (~1 s), banner, fanfare (up) or soft note (down).

```typescript
export function updateEras(state: GameState): void {
  const era = currentEra(state);
  if (era !== state.lastEra) {
    emit({ type: 'EraChanged', from: state.lastEra, to: era });
    state.lastEra = era;
  }
}
```

**Usage:** Nothing else reads `lastEra`; all era display uses `currentEra`.

### Communication Patterns

**Pattern:** Commands in, events out; systems share data only via `GameState`.

```typescript
// view/input → sim
dispatch({ type: 'Sacrifice', sheepId: id });
// sim → view (after tick)
bus.on('sim', (e) => { if (e.type === 'Sacrificed') juice.sparkle(e); }, this);
```

### Entity Patterns

**Creation:** Factory functions in the sim (`createSheep`, `createFoodPiece`, `createCarcass`) assign `id` from `state.nextId`, name via RNG and initial timers. View objects come from pools (N3).

```typescript
export function createSheep(state: GameState, o: { stage: Stage; x: number; y: number }): Sheep {
  const bornAt = state.time - ageForStage(o.stage);
  const s: Sheep = { id: nextId(state), name: pickName(state), x: o.x, y: o.y, bornAt,
    fullness: TUNING.startFullness, activity: 'wander', cooldownUntil: 0, isAbomination: false };
  state.sheep.push(s);
  return s;
}
```

### State Patterns

**Pattern:** One explicit `activity` state machine per sheep; everything else derived.

- `activity`: `wander` → `seekFood` → `eating` → `wander`; `wander` → `seekBreedingFood` → `eating` → `wander` (an adult that is not ready and not on cooldown, when no food comes first; changed 2026-10-06); `seekCarcass` (starving, no food on field); `stalking` (Abomination only); `dragged` (set by drag command, cleared on drop).
- Derived, never stored: hunger state (from `fullness`), stage (from `bornAt`), infected (from `infectedAt`), on-cooldown (from `cooldownUntil`).
- Transitions happen only inside sim systems during `step`, never in view code.

```typescript
function nextActivity(s: Sheep, state: GameState): SheepActivity {
  if (s.activity === 'dragged') return 'dragged';
  if (s.isAbomination && s.stalk) return 'stalking'; // feeding/carcass eating never claim it (Story 4.3)
  if (s.fullness < TUNING.seekThreshold && state.foodPieces.length) return 'seekFood';
  if (canEatBreedingFood(s, state) && state.breedingPieces.length) return 'seekBreedingFood'; // adult, !breedReady, not on cooldown
  if (hungerOf(s) === 'starving' && !state.foodPieces.length && state.carcasses.length) return 'seekCarcass';
  return 'wander';
}
```

### Data Patterns

**Access:** View reads only through `selectors.ts`; sim systems read `state` and `TUNING` directly; nobody reads `localStorage` except `src/save/`.

```typescript
// HudScene.update()
const v = hudView(state); // { farmProgress, farmPipsPerFood, breedFood, money, flock, capacity, era, threats, boostRemaining }
this.farmProgress.set(v.farmProgress, v.farmPipsPerFood);
```

### Consistency Rules

| Pattern | Convention | Enforcement |
|---|---|---|
| Sim purity | No `phaser`, DOM, `Date.now()`, `Math.random()` in `src/sim/` | ESLint `no-restricted-imports` / `no-restricted-globals` |
| Deaths | Only via `killSheep`; removals only via `removeSheep` | Code review; scenario tests |
| Abomination secrecy | View uses `PublicSheep` only | ESLint restricted property rule on `isAbomination` outside `src/sim/` and `src/debug/` |
| Timers | Absolute game-ms deadlines (`…At`, `…Until`) | Code review; save round-trip test |
| Tuning values | From `TUNING`, never literals | Code review |
| Colours | From `COLORS` (DESIGN.md tokens), never hex literals in view | Code review |
| Randomness | `rng(state)` in sim; `Math.random()` only for cosmetic view jitter | ESLint in `src/sim/` |
| Entities in view | Pooled, reconciled by id (N3) | Code review; 100-sheep perf check |
| Events | Sim: PascalCase past tense; UI: `noun:verb`; listeners removed on scene shutdown | Type unions; code review |
| Logging | `log.<level>(tag, …)` only; no logs in tick/frame loops | Code review |

## Architecture Validation

### Validation Summary

| Check | Result | Notes |
|---|---|---|
| Decision Compatibility | Pass | 12 decisions mutually consistent |
| GDD Coverage | Pass | 16/16 systems and all technical requirements, including deployment |
| Pattern Completeness | Pass | 4 novel + 4 standard patterns; format, error, logging and event rules |
| Epic Mapping | Pass | Epics 1–5 map to `sim/systems/*` and `view/*`; Epic 1 carcass flag staging |
| Document Completeness | Pass | No placeholders; toolchain versions verified 2026-10-05 |

### Coverage Report

**Systems Covered:** 16/16
**Patterns Defined:** 8 (4 novel, 4 standard)
**Decisions Made:** 12 (+4 ADRs)

### Issues Resolved

1. Deployment unspecified → `base: './'`, GitHub Actions to Pages, `npm run zip` for itch.io
2. Loss not triggered when the last sheep is sold/sacrificed → `removeSheep` runs `checkLastSheepAndLoss`
3. Interpolation storage, pending-lamb capacity and food-piece pool growth clarified
4. Epic 1 vs single death pipeline → `TUNING.carcassesEnabled` flag
5. Toolchain versions pinned: Node 24 LTS, Vite 8.x, TypeScript 6.x (TS 7 deferred)
6. Format rules added: `formatGameTime`, `formatMoney`, ISO `savedAt`

### Validation Date

2026-10-05

## Development Environment

### Prerequisites

- Node.js 24 LTS (npm included)
- Git; a GitHub repository with Pages enabled (Source: GitHub Actions)
- A modern desktop browser (Chrome, Firefox or Edge) for testing
- An itch.io account for the HTML5 upload
- Claude Code (or another MCP-capable agent) for AI-assisted development

### AI Tooling (MCP Servers)

The following MCP server was selected during architecture to enhance AI-assisted development:

| MCP Server | Purpose | Install Type |
|---|---|---|
| Context7 (upstash/context7) | Current Phaser 4, Vite and Vitest documentation lookup instead of relying on training data | npx (local stdio) or remote HTTP |

**Setup:**

```bash
claude mcp add context7 -- npx -y @upstash/context7-mcp@latest
# or remote: claude mcp add --transport http context7 https://mcp.context7.com/mcp
claude mcp list   # verify
```

No Phaser-specific MCP server is maintained. Agents should also read Phaser's bundled skills in `node_modules/phaser/skills/` (including `v3-to-v4-migration`) before using any v3-era example.

### Setup Commands

```bash
# 1. Scaffold into a temporary folder, then merge into the repo root
npm create @phaserjs/game@latest   # Web Bundler → Vite → TypeScript
# copy package.json, tsconfig.json, vite.config.ts, index.html into the repo; delete template sample scenes

# 2. Add project dev dependencies
npm install
npm install -D vitest@^4.1 eslint typescript-eslint free-tex-packer-core

# 3. Verify
npm run dev        # dev server
npm test           # Vitest
npm run typecheck  # tsc --noEmit
```

### First Steps

1. Scaffold the project with the commands above, set `base: './'` and `pixelArt: true`, and create the `src/` tree from Project Structure.
2. Add the ESLint boundary rules (sim purity, `isAbomination` restriction) and the `log`, `invariant`, `eventBus` and `format` core modules before any gameplay code.
3. Configure MCP servers per the AI Tooling instructions above.
4. Implement `GameState`, `createNewGame`, `step`, `rng` and the save round-trip test — the foundation for Epic 1 — then build Epic 1 stories in order.
