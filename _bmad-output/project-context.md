---
project_name: 'sheep-civilization'
user_name: 'Rylan'
date: '2026-10-05'
sections_completed:
  ['technology_stack', 'engine_rules', 'performance_rules', 'organization_rules', 'testing_rules', 'platform_rules', 'anti_patterns']
status: 'complete'
rule_count: 74
optimized_for_llm: true
---

# Project Context for AI Agents

_This file contains critical rules and patterns that AI agents must follow when implementing game code in this project. Focus on unobvious details that agents might otherwise miss._

---

## Technology Stack & Versions

- **Phaser 4.2.x** (4.2.1 "Giedi" at writing) — NOT Phaser 3. Most online examples and model training data are v3; check `node_modules/phaser/skills/` (incl. `v3-to-v4-migration`) or Context7 before using any API from memory.
- **TypeScript 6.x** — `strict: true`. Do NOT upgrade to TS 7 (native compiler) in v1.
- **Vite 8.x** — as installed by the official Phaser template; `base: './'`. Vite strips types only; type errors are caught by `npm run typecheck` (`tsc --noEmit`).
- **Node 24 LTS** for tooling and CI.
- **Vitest 4.1.x** — tests for `src/sim/` and `src/save/` only.
- **ESLint + typescript-eslint** — enforces architecture boundaries (see Code Organization).
- **free-tex-packer-core** — atlas packing in `scripts/build-assets.ts`.
- **No other runtime dependencies.** Do not add npm packages (state libraries, ECS, physics, UI kits, lodash, etc.) without the architecture being updated first.
- Source of truth: `_bmad-output/game-architecture.md`; UX: `_bmad-output/planning-artifacts/ux-designs/ux-sheep-civilization-2026-10-05/{DESIGN,EXPERIENCE}.md`; rules: GDD in `_bmad-output/planning-artifacts/gdds/gdd-sheep-civilization-2026-10-05/gdd.md`.

## Critical Implementation Rules

### Engine-Specific Rules (Phaser 4)

- **v4 API, not v3:** no `setTintFill()` → `setTint(c).setTintMode(Phaser.TintModes.FILL)` (infection tint, reveal flash). FX/masks are **Filters**; no `BitmapMask`, no `preFX`/`postFX`. Verify any other API via Context7 before use.
- **Game config:** `type: Phaser.AUTO`, 1280×720, `pixelArt: true` (nearest-neighbour; no `roundPixels` hacks), `scale: { mode: FIT, autoCenter: CENTER_BOTH }`, **no `physics` key** — Arcade/Matter are not used.
- **Scenes:** `BootScene → PreloadScene → TitleScene → GameScene` + `HudScene` and `OverlayScene` launched in parallel. Scene key string = class name. Only `GameScene` runs the sim loop; HUD/Overlay never step the sim.
- **Pausing:** pause = stop accumulating sim time in `GameScene`. Do NOT use `scene.pause()` on GameScene for gameplay pause (it also freezes the field rendering needed behind the pause scrim and breaks the accumulator).
- **No Phaser timers for game logic:** `this.time.addEvent`, `delayedCall`, tweens' `onComplete` must never change `GameState`. Tweens/timers are for visuals only.
- **No Phaser data stores for game state:** never `this.registry`, `setData()`/`getData()` or `scene.data` for anything that must be saved.
- **Listener cleanup:** every `bus.on`/`input.on`/`events.on` in a scene is removed in `this.events.once(Phaser.Scenes.Events.SHUTDOWN, …)`. Restart must not double-subscribe.
- **Input:** a single `InputController` registers pointer/keyboard listeners. Do not use `setInteractive()` + `on('pointerdown')` on individual sprites for gameplay actions; hit-testing goes through the controller (UI widgets in HUD/Overlay may use `setInteractive`). Disable the browser context menu on the canvas (right-click cancels breed mode).
- **Text:** HUD numbers that change often use `BitmapText` (or cached `Text` updated only on value change), never re-`setText` every frame.
- **Audio:** sounds play only through `AudioDirector`; respect the WebAudio unlock (first pointer input). Volumes come from settings, never hard-coded.
- **Fonts:** Pixelify Sans / Nunito must be loaded (CSS Font Loading API in `main.ts`) **before** any `Text` is created, or Phaser caches fallback metrics.

### Performance Rules

- **Budget:** 16.6 ms/frame at 100 sheep (Chrome + Firefox, integrated GPU). Sim tick (10 Hz) target ≤ 2 ms at 100 sheep; render/sync ≤ 6 ms.
- **No allocation in hot paths** (`step()`, systems, `update()`, `EntityLayer.sync`): no object/array literals, spreads, closures, `.map/.filter/.reduce` creating arrays, or string building per entity per tick/frame. Reuse scratch vectors/arrays at module scope. Exception: entity creation/removal events.
  - Note: `state.sheep = state.sheep.filter(...)` in `killSheep`/`removeSheep` is fine (rare event), not per tick.
- **Neighbour queries go through `sim/grid.ts`** (48 px cells, rebuilt once per tick). Never loop all-sheep × all-sheep.
- **Pooling:** sheep, food pieces, carcasses, popups and particles come from pools (pre-sized 120/60/40, grow on demand). Never `new`/`destroy()` sprites during play.
- **Rendering:** all field/UI sprites come from the two atlases (`sheep-world`, `ui`) to keep batching; no `Graphics` objects redrawn per frame (pre-render to texture); avoid per-sprite blend modes and per-sprite Filters on sheep (infection uses tint, not a filter).
- **Selectors are cheap and cached per frame:** compute `hudView(state)` / public sheep list once per frame in the scene and pass it down; don't call selectors per widget.
- **No logging, no `JSON.stringify`, no localStorage access in tick or frame code** (autosave runs on its own 10 s timer).
- **Assets:** total build < 8 MB; initial load < 5 s. PNG atlases ≤ 2048², audio OGG+MP3 at ≤ 128 kbps; no unused assets in `public/assets/`.
- **Verify** with the debug overlay at ×1 speed, 100 sheep, 5 minutes, before closing any story that touches movement, rendering or pooling.

### Code Organization Rules

- **Layers (lint-enforced):** `src/sim/` + `src/core/` = pure TS — never import `phaser`, `src/view`, `src/save`, `src/input`, or touch `window`/`document`/`localStorage`/`Date.now()`/`Math.random()`. `src/view/` + `src/input/` never mutate `GameState`; they read selectors and `dispatch(Command)`. Only `src/save/` touches `localStorage`. `src/debug/` only behind `import.meta.env.DEV`.
- **Where new code goes:** a new game rule → `src/sim/systems/<system>.ts` exporting `update<System>(state)` and registered in the fixed order in `src/sim/step.ts`. New player action → add to the `Command` union in `sim/commands.ts`. New sim → view signal → add to the `SimEvent` union in `sim/events.ts`. New tunable number → `config/tuning.ts`. New colour → `config/constants.ts` `COLORS` (from DESIGN.md tokens).
- **Systems never call each other**; they communicate through `GameState` only. Shared helpers (e.g. `killSheep`, `removeSheep`, `createSheep`, `nextId`) are the exceptions and live in the system that owns the concept.
- **`GameState` is plain JSON data:** no classes, `Map`, `Set`, `Date`, `undefined`-vs-missing reliance, functions or cycles. Optional fields use `?:` and are omitted, not `null`, unless the schema says otherwise. Entity refs are numeric ids.
- **Naming:** Phaser classes/scenes PascalCase file = class (`SheepSprite.ts`); sim/core/save modules camelCase files exporting functions (`hunger.ts`); types PascalCase, no `I` prefix; constants `UPPER_SNAKE`; game-time fields are integer ms with `…At`/`…Until` suffix (`diesAt`, `boostUntil`); sim events PascalCase past tense (`SheepDied`); commands PascalCase imperative (`Farm`); UI events `noun:verb` (`shop:toggled`); assets/frames kebab-case `entity-state[-n]` (`adult-walk-2`).
- **Exhaustive unions:** `switch` over `Command['type']` / `SimEvent['type']` must end with an `assertNever(x)` default so new variants fail to compile until handled.
- **Strings:** all player-facing text comes from the EXPERIENCE.md Voice table; keep copy in `src/view/strings.ts`, not inline in components.

### Testing Rules

- **Scope:** Vitest covers `src/sim/` and `src/save/` only. No Phaser, DOM or canvas in tests; never mock Phaser — if a test needs Phaser, the logic is in the wrong layer.
- **Layout:** `tests/<same path as src>/<module>.test.ts` (e.g. `tests/sim/systems/hunger.test.ts`); multi-system scenarios in `tests/sim/scenarios/`.
- **Determinism:** always build state with `createNewGame(seed)` using a fixed literal seed; advance with a helper `runFor(state, ms)` that calls `step()` in `TICK_MS` increments. Never use real timers, `vi.useFakeTimers()` or `Math.random` in sim tests.
- **Assert on state and emitted `SimEvent`s**, not on internal helper calls; no spying on systems.
- **Use `TUNING` values in assertions** (e.g. `runFor(state, TUNING.starveMs)`), never re-typed literals, so tuning changes don't break tests.
- **Required per story touching the sim:** unit tests for the new rule + at least one scenario if it interacts with another system (e.g. carcass → virus → death).
- **Save tests (mandatory, keep green):** `JSON.parse(JSON.stringify(state))` deep-equals `state` after N ticks of a busy scenario; load of a corrupt/old-schema save falls back or migrates; settings survive Restart.
- **Abomination secrecy test:** `publicSheep()` output for an Abomination is indistinguishable from a lamb except `gait`.
- **Done = `npm test`, `npm run typecheck` and `npm run lint` all pass.** Rendering, juice and audio are verified manually in the browser.

### Platform & Build Rules

- **Desktop browsers only** (Chrome, Firefox, Edge — latest 2). No mobile/touch code paths, no portal SDKs (Poki/CrazyGames), no service worker, no backend or network calls at runtime (fonts self-hosted; no Google Fonts/CDN requests).
- **Canvas:** fixed 1280×720 logical size, FIT-scaled; all layout in logical pixels from DESIGN.md. Minimum supported window 960×540 — HUD must stay legible there.
- **Input:** mouse primary; keys `F` (Farm), `G` (Farm Breeding Food), `Esc` (priority chain: confirm → sub-panel → cancel drag → exit breed mode → close shop → pause). Ignore key repeats for F/G (`event.repeat`), and ignore shortcuts while a modal is open. Click vs drag threshold = 6 px.
- **Visibility:** on `document.visibilitychange` → hidden: stop sim accumulation, force a save, pause music. On visible: resume with no overlay and reset the frame delta (no catch-up burst).
- **Persistence:** `localStorage` keys `sheepciv.save.v1` and `sheepciv.settings` only. Wrap every access in try/catch (private mode / quota / blocked storage) and fall back gracefully; the game must run with storage unavailable.
- **Audio autoplay:** nothing plays before the first pointer input; music starts on the Title screen after that input.
- **Build:** `vite build` with `base: './'` → `dist/` works from any subpath (GitHub Pages) and inside the itch.io iframe. Use relative asset URLs only; never absolute `/assets/...`.
- **Dev-only code** is gated by `import.meta.env.DEV` (debug overlay, `invariant` throws, `log.debug/info`). Production builds must contain none of it.
- **Deploy:** push to `main` → GitHub Actions (test → build → Pages). itch.io: `npm run zip`, upload as HTML5, embed size 1280×720 with fullscreen button enabled.

### Critical Don't-Miss Rules

**Game-rule invariants**
- **Every non-sacrifice death goes through `killSheep(state, id, cause)`** (spawns a carcass). Sell/sacrifice go through `removeSheep` (no carcass). Both run `checkLastSheepAndLoss` — selling or sacrificing the last sheep is a loss. Never splice `state.sheep` anywhere else.
- **The Abomination is secret.** View, HUD, tooltip, toast, stats and save-inspection code use `PublicSheep` only; `isAbomination`/`stalk` are read only in `src/sim/` and `src/debug/`. It always displays as a lamb, its stalking shows as `wander`, its victims' toast is the vague "{name} just… fell over.", and the truth is revealed only by `Sacrificed { wasAbomination }`. It never ages or dies of old age but **can starve**.
- **Era is derived** from live sheep count every time (`currentEra`). Never store or increment an era; `lastEra` exists only to emit `EraChanged`. Eras regress.
- **Capacity counts living sheep + `state.pregnancies`.** Breeding is blocked at capacity; Breed greys out with the reason tooltip.
- **Timers are absolute game-ms deadlines** in state (`diesAt`, `doomedAt`, `cooldownUntil`, `boostUntil`, `nextKillAt`…). Never countdown fields decremented per tick, never `setTimeout`/Phaser timers for game rules.
- **Boost:** a sacrifice sets `boostUntil = time + 30 s` (reset, not stacked) and doubles **Farm (food) only**, not breeding food.
- **A starving sheep eats a carcass only when no food piece is on the field.** Eating a carcass = 100% infection; infected dies 20 s later.
- **No confirmations** on sell, sacrifice or shop purchases (a misdrop is the joke). The only confirm is start-over (New Game with a save / pause Restart); Lose → Restart wipes without confirm.
- **Hidden tab = full pause.** Nothing progresses while away; no offline progress, ever.

**UX invariants**
- Colours come from `COLORS` (DESIGN.md tokens); copy comes from `strings.ts`. No hex or text literals in components.
- Infection is never colour-only: green tint **plus** the bubble marker **plus** wobble.
- Screen shake, bounces and floaty popups respect the **reduced-motion** setting; key sounds raise **captions** when captions are on.
- No tutorial pop-ups; no "!" in copy except "Last sheep!"; never "corpse", "blood" or "kill" in UI text.

**Common agent mistakes to avoid**
- Writing Phaser 3 code from memory (`setTintFill`, `preFX`, `BitmapMask`, Arcade physics bodies on sheep).
- Putting game logic in sprites, scenes, tweens or `update()` instead of `src/sim/`.
- Using `Math.random()`/`Date.now()` in the sim (breaks determinism and save restore).
- Storing derived values (hunger state, stage, era, flock count) in `GameState`.
- Adding fields to `GameState` without bumping `SAVE_SCHEMA_VERSION` and adding a migration in `save/migrations.ts`.
- Forgetting to remove event listeners on scene shutdown (duplicate toasts/sounds after Restart).
- Hard-coding GDD numbers instead of reading `TUNING`.

---

## Usage Guidelines

**For AI Agents:**

- Read this file before implementing any game code
- Follow ALL rules exactly as documented
- When in doubt, prefer the more restrictive option
- Update this file if new patterns emerge

**For Humans:**

- Keep this file lean and focused on agent needs
- Update when technology stack changes
- Review quarterly for outdated rules
- Remove rules that become obvious over time

Last Updated: 2026-10-05
