# Story 1.1: Scaffold the Project from the Phaser Template

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want the project scaffolded from the official Phaser 4 + Vite + TypeScript template with our tooling, folders and tokens in place,
so that every later story builds on the agreed stack and boundaries.

## Acceptance Criteria

1. **Scaffold and pins.** Given an empty `src/` (today it holds only `.gitkeep`), when the project is created from the official Phaser template (`npm create @phaserjs/game@latest` → Web Bundler → Vite → TypeScript, or the same `phaserjs/template-vite-ts` source, see Dev Notes) and merged into the repo root, then `package.json` pins **Phaser 4.2.x, Vite 8.x, TypeScript 6.x (`strict: true`) and Vitest 4.1.x**, `.nvmrc` is `24`, and the template's sample scenes are removed.
2. **Scripts.** npm scripts `dev`, `build`, `preview`, `test`, `lint`, `typecheck`, `assets`, `zip` exist. `zip` may be a stub that exits 0 until Story 5.2. `assets` may be a stub that exits 0 until Story 1.2.
3. **Boot canvas.** When `npm run dev` is opened in Chrome, a 1280×720 canvas (`Phaser.AUTO`, `pixelArt: true`, Scale `FIT` + `CENTER_BOTH`, no `physics` key) shows a `BootScene` with the `dusk` background, letterboxed in `dusk-deep` (UX-DR98, UX-DR100, NFR5, AR2).
4. **Vite base.** `vite.config.ts` sets `base: './'`.
5. **Constants.** `src/config/constants.ts` exports `TICK_MS = 100`, canvas size, storage keys, `SAVE_SCHEMA_VERSION = 1`, and `COLORS` with the 20 DESIGN.md colour tokens, plus typography, radius and spacing tokens, the typography-role mapping, and component-spec constants mirroring DESIGN.md `components` (UX-DR1, UX-DR3, UX-DR4, UX-DR6, UX-DR7, AR13).
6. **Colour-rule comment.** A short comment block in `constants.ts` records the colour-usage rules: money = `hay`, boost = `halo`, `awning` never for alerts, `alert` never for Market, `void` never for panels, `infection` never on healthy things (UX-DR2). Also record that `pasture` is art reference only, not UI chrome.
7. **Tuning.** `src/config/tuning.ts` exists as a frozen object (values are added by later stories).
8. **Core modules.** `src/core/` contains `log.ts` (tagged levels; `debug`/`info` stripped in production), `invariant.ts` (throws in DEV, logs in production), `format.ts` (`formatGameTime`, `formatMoney`) and `eventBus.ts` (typed), each with unit tests (AR14).
9. **Lint boundaries.** When `npm run lint` runs, imports of `phaser`, `src/view`, `src/save`, `src/input`, and use of `Math.random`, `Date.now`, `window`, `document` or `localStorage` inside `src/sim/` or `src/core/` are errors (AR16).
10. **Green gate.** `npm test`, `npm run typecheck` and `npm run lint` all pass (AR1, AR16, AR24). `npm run build` also succeeds.
11. **Fonts.** Given Pixelify Sans and Nunito WOFF2 files in `public/assets/fonts/`, when `main.ts` boots, both fonts are loaded through the CSS Font Loading API before the Phaser game is created, with no requests to Google Fonts.

## Tasks / Subtasks

- [ ] **Task 1: Get the template and merge it into the repo root** (AC: 1)
  - [ ] 1.1 Scaffold into a scratch folder **outside** the repo, never into the repo root, because the CLI writes its own README, `.gitignore` and LICENSE. The `@phaserjs/create-game` 1.3.2 CLI is interactive only: it has no template or language flags. Choose one route:
    - **Preferred:** ask Rylan to run `! cd <scratch> && npm create @phaserjs/game@latest sheep-tmp` and pick Web Bundler → `vite-ts` (Vite + TypeScript) → **Minimal** → TypeScript.
    - **Fallback:** non-interactive `npx degit phaserjs/template-vite-ts <scratch>/sheep-tmp`. This is the same template the CLI uses. Record which route you took in the Dev Agent Record.
  - [ ] 1.2 Keep these files from the template, then adapt them as described below: `index.html`, `package.json`, `tsconfig.json`, `src/vite-env.d.ts` (optional, see Task 2.3) and `public/style.css` (optional).
  - [ ] 1.3 **Delete or do not copy** the following:
    - `log.js`. It is telemetry: an HTTPS GET to `gryzor.co` on every dev and build run, which breaks the no-network rule.
    - `src/game/`, including the sample scenes `Boot`, `Preloader`, `MainMenu`, `Game` and `GameOver`.
    - The `vite/` folder (`config.dev.mjs`, `config.prod.mjs`).
    - `public/assets/bg.png`, `public/assets/logo.png`, `public/favicon.png` and `screenshot.png`.
    - The template's `README.md`, `LICENSE` and `.gitignore`. The repo's own `.gitignore` already covers `node_modules/` and `dist/`.
  - [ ] 1.4 Delete `src/.gitkeep` and `tests/.gitkeep` once real files exist. Keep `assets/**/.gitkeep`.
- [ ] **Task 2: Set the toolchain versions and write the configs** (AC: 1, 2, 4, 10)
  - [ ] 2.1 Rewrite `package.json`:
    - Metadata: `"name": "sheep-civilization"`, `"private": true`, `"type": "module"`, `"engines": { "node": ">=24" }`.
    - **Dependencies:** `phaser` `~4.2.1`. This is the only runtime dependency. The template pins `4.0.0`, which is too old.
    - **devDependencies:**
      - `vite` `^8.3`
      - `typescript` `~6.0.3`. Pin with a tilde: TS 7 is now npm `latest` and breaks typescript-eslint.
      - `vitest` `~4.1.11`. Not 5.x, which is now npm `latest`.
      - `eslint` `^10`, `@eslint/js` `^10`, `typescript-eslint` `^8.71`
      - `@types/node` only if `scripts/` or the config files need it
    - **Remove** the template's `terser`. Vite 8 minifies with Oxc.
    - Do **not** add `free-tex-packer-core` yet; Story 1.2 adds it with the real asset script.
  - [ ] 2.2 Scripts:
    - `"dev": "vite"`, `"build": "vite build"`, `"preview": "vite preview"`
    - `"test": "vitest run"`, `"lint": "eslint ."`, `"typecheck": "tsc --noEmit"`
    - `"assets": "node scripts/build-assets.ts"`. Node 24 strips TS types natively. For now the script is a stub that logs `[assets] not implemented until Story 1.2` and exits 0.
    - `"zip"`: a stub that exits 0, e.g. `node -e "console.log('[zip] implemented in Story 5.2')"`.
  - [ ] 2.3 Write `tsconfig.json` for TS 6:
    - Options: `"strict": true`, `"target": "ES2023"`, `"module": "ESNext"`, `"moduleResolution": "bundler"`, `"lib": ["ES2023", "DOM", "DOM.Iterable"]`, `"noEmit": true`, `"verbatimModuleSyntax": true`, `"erasableSyntaxOnly": true`, `"noUnusedLocals": true`, `"noUnusedParameters": true`, `"noFallthroughCasesInSwitch": true`, `"skipLibCheck": true`, `"isolatedModules": true`.
    - **TS 6 defaults `types` to `[]`**, so set `"types": ["vite/client"]` or `import.meta.env` will not typecheck. If you set `types`, delete the template's `src/vite-env.d.ts`; otherwise keep it.
    - Do **not** use `moduleResolution: node`, `baseUrl` or `esModuleInterop: false`. All three are deprecated or errors in TS 6.
    - Do **not** copy the template's `strictPropertyInitialization: false`. Use `!` on Phaser scene fields instead.
    - `include`: `src`, `tests`, `scripts` and the root `*.config.ts` files.
  - [ ] 2.4 Create a single root `vite.config.ts` with `defineConfig({ base: './' })`.
    - Do **not** port the template's `rollupOptions.output.manualChunks: { phaser: [...] }`. The object form is unsupported in Vite 8 (Rolldown), and one fixed screen does not need chunk splitting.
    - No terser, and no `phasermsg` plugin.
  - [ ] 2.5 Create `vitest.config.ts` with `test: { include: ['tests/**/*.test.ts'], environment: 'node' }`. Do not enable `globals`; import `describe`/`it`/`expect` from `vitest`. Run `npm ls vite` and confirm Vitest 4.1 accepts Vite 8 with no peer-dependency error. If it does not, stop and report rather than upgrading Vitest to 5.
  - [ ] 2.6 Create `.nvmrc` containing `24`.
- [ ] **Task 3: Create the source tree from the architecture** (AC: 1, 3)
  - [ ] 3.1 Create these folders, each holding a `.gitkeep` until a later story fills it:
    - `src/sim/`, `src/sim/systems/`
    - `src/save/`, `src/input/`
    - `src/view/field/`, `src/view/hud/`, `src/view/overlay/`, `src/view/widgets/`, `src/view/juice/`, `src/view/audio/`
    - `src/debug/`
    - `tests/sim/`, `tests/save/`
    - `scripts/`

    Do **not** create placeholder `.ts` modules for systems that later stories own.
  - [ ] 3.2 `index.html`: a `<div id="game-container">` and `<script type="module" src="./src/main.ts">`.
    - There must be **no** `<link>` to `fonts.googleapis.com` or any CDN.
    - Body and container: `margin: 0`, full viewport (`100vw`/`100vh`), `overflow: hidden`, so that FIT scaling letterboxes.
    - Title: `Sheep Civilization`.
- [ ] **Task 4: `src/config/constants.ts`** (AC: 5, 6)
  - [ ] 4.1 Engine constants: `TICK_MS = 100`, `CANVAS_WIDTH = 1280`, `CANVAS_HEIGHT = 720`, `SAVE_KEY = 'sheepciv.save.v1'`, `SETTINGS_KEY = 'sheepciv.settings'`, `SAVE_SCHEMA_VERSION = 1`.
  - [ ] 4.2 `COLORS`: exactly the 20 tokens from DESIGN.md, as `'#RRGGBB'` strings, with camelCase keys. Values are in the Token Reference below.
    - Freeze the object (`Object.freeze({...} as const)`) and export `type ColorToken = keyof typeof COLORS`.
    - Also export a numeric form for Phaser tint and fill APIs, either `COLOR_INT: Record<ColorToken, number>` built once at module load or a `colorInt(token)` helper.
  - [ ] 4.3 Add the colour-rule comment block (AC 6) directly above `COLORS`.
  - [ ] 4.4 Add these token objects:
    - `TYPOGRAPHY`: 7 roles, each `{ fontFamily, fontSize, fontWeight, lineHeight }`, with numbers in px.
    - `TYPOGRAPHY_USAGE`: the role → usage mapping (UX-DR4).
    - `RADIUS`: `sm 4`, `md 8`, `lg 12`, `full 9999`.
    - `SPACING`: `1:4 … 6:32`.
    - `LAYOUT`: `canvasWidth`, `canvasHeight`, `safeMargin 16`, `hudBarHeight 112`, `hitMin 40`.
    - `FONT_FAMILIES`: `pixel: 'Pixelify Sans'`, `body: 'Nunito'`.
  - [ ] 4.5 `COMPONENTS`: all 35 entries of the DESIGN.md `components` map, listed in the Token Reference.
    - Colour references are **token names** (`'hayDeep'`), not hex values.
    - Typography and radius references are role/key names (`'label'`, `'md'`).
    - Px sizes are numbers.
    - Use `satisfies` with a type in which colour-valued fields are `ColorToken`, so a misspelt token fails `typecheck`. Freeze the object.
- [ ] **Task 5: `src/config/tuning.ts`** (AC: 7)
  - [ ] 5.1 `export const TUNING = Object.freeze({ /* GDD (tune) values — added by later stories */ });` Later stories add keys such as `carcassesEnabled`, `starveMs` and walk speed. Do not invent any values now.
- [ ] **Task 6: Core modules + tests** (AC: 8)
  - [ ] 6.1 `src/core/log.ts`
    - Export `type LogTag = 'boot' | 'save' | 'sim' | 'input' | 'audio' | 'ui' | 'debug'` and `log.{error,warn,info,debug}(tag, message, data?)`. Output is formatted `[tag] message` (with `data` passed as a second console argument when present).
    - `info` and `debug` must be wrapped in `if (import.meta.env.DEV)`. Read the flag **inside** the function body: Vite still replaces it statically so production strips the code, and tests can toggle it with `vi.stubEnv('DEV', false)`.
  - [ ] 6.2 `src/core/invariant.ts`
    - Signature: `export function invariant(cond: unknown, msg: string): asserts cond`.
    - In DEV it throws `new Error(\`Invariant: ${msg}\`)`. Otherwise it calls `log.error('sim', \`Invariant: ${msg}\`)` and returns.
    - Follow the architecture's example exactly.
  - [ ] 6.3 `src/core/format.ts`
    - `formatGameTime(ms)` returns `m:ss` below one hour and `h:mm:ss` from one hour. Floor to whole seconds and clamp negatives to `0:00`. Examples: `0` → `0:00`, `65_000` → `1:05`, `3_600_000` → `1:00:00`, `3_725_000` → `1:02:05`.
    - `formatMoney(n)` returns `$` + floored whole number, with **no** K/M notation and **no** thousands separator. Examples: `145` → `$145`, `1450` → `$1450`.
  - [ ] 6.4 `src/core/eventBus.ts`
    - A **typed, engine-free** emitter: `class EventBus<Events extends Record<string, unknown>>` with `on(event, fn, context?)`, `once(...)`, `off(event, fn?, context?)`, `emit(event, payload)`, and `removeAllListeners(event?)`.
    - Payload types come from the `Events` map. **Do not import Phaser's EventEmitter** (core is engine-free; see Dev Notes, "Resolved conflicts").
    - `emit` must not allocate per call.
    - Removing a listener during `emit` must not skip or double-call other listeners. Use copy-on-write when adding or removing, or iterate over a snapshot taken when the listener set changed.
    - The concrete event maps (`sim` → `SimEvent`, UI `noun:verb` events) and the shared bus instance arrive in Story 1.2 and later stories. Do not define them now.
  - [ ] 6.5 `src/core/types.ts` exporting `assertNever(x: never): never`, which throws `Error('Unexpected variant: ' + JSON.stringify(x))`. Every later union `switch` depends on it.
  - [ ] 6.6 Tests under `tests/core/`: `log.test.ts`, `invariant.test.ts`, `format.test.ts`, `eventBus.test.ts` and `types.test.ts`.
    - Spy on `console` for log assertions.
    - Use `vi.stubEnv('DEV', false)` with `vi.unstubAllEnvs()` in `afterEach` to test the production branches: info/debug silent, and invariant logs instead of throwing.
    - eventBus cases: typed emit/on, `once` fires once, `off` by fn and by context, removal during emit, and `removeAllListeners`.
- [ ] **Task 7: ESLint flat config with boundary rules** (AC: 9, 10)
  - [ ] 7.1 Base `eslint.config.js`: `@eslint/js` recommended plus `tseslint.configs.recommended`. Global `ignores`: `dist/`, `node_modules/`, `public/`, `coverage/`, `_bmad/`, `_bmad-output/`, `.claude/`. Lint `src/`, `tests/`, `scripts/` and the root config files.
  - [ ] 7.2 **Purity block** for `files: ['src/sim/**/*.ts', 'src/core/**/*.ts', 'src/config/**/*.ts']`. `config/` is imported by the sim, so it must be pure too.
    - `no-restricted-imports`: error on `phaser` and on the patterns `**/view`, `**/view/**`, `**/save`, `**/save/**`, `**/input`, `**/input/**`.
    - `no-restricted-globals`: `window`, `document`, `localStorage`, `sessionStorage`.
    - `no-restricted-properties`: `Math.random` (message: use `rng(state)`) and `Date.now` (message: use `state.time`).
    - Also ban `globalThis.localStorage`, `globalThis.window` and `globalThis.document` via `no-restricted-properties`. Optionally ban `new Date()` via `no-restricted-syntax`, but only in `src/sim/**`.
  - [ ] 7.3 **Storage block** for `files: ['src/**/*.ts'], ignores: ['src/save/**']`: `no-restricted-globals` on `localStorage`/`sessionStorage`.
    - ⚠️ In flat config, a later block's setting for the **same rule** replaces the earlier one for the files both blocks match. Put the storage block **before** the purity block, and have the purity block re-list `localStorage`/`sessionStorage`.
    - Afterwards, run `npx eslint --print-config src/sim/x.ts` and `npx eslint --print-config src/view/x.ts` and check that both sets of restrictions are in effect.
  - [ ] 7.4 **Abomination-secrecy block** (AR16, cheap to add now) for `files: ['src/**/*.ts'], ignores: ['src/sim/**', 'src/debug/**']`: `no-restricted-syntax` on `MemberExpression[property.name='isAbomination']` and `Property[key.name='isAbomination']`, with the message "View code must use PublicSheep".
  - [ ] 7.5 Prove that each rule fires: add a throwaway `src/sim/_lintprobe.ts` and `src/view/_lintprobe.ts` containing a violation of each rule, run `npm run lint`, confirm the errors, then **delete the probes**. List the observed errors in the Completion Notes.
- [ ] **Task 8: Fonts (self-hosted)** (AC: 11)
  - [ ] 8.1 Get the latin-subset **variable** WOFF2 for Pixelify Sans and Nunito (one file per family covers every weight we use: Pixelify 500/600/700 and Nunito 600/800). Sources:
    - The `@fontsource-variable/pixelify-sans` and `@fontsource-variable/nunito` 5.3.x tarballs. Use `npm pack` into the scratch dir; do **not** add them as dependencies.
    - Or gwfh.mranftl.com. If you use static fonts, get each weight separately.
  - [ ] 8.2 Commit the source copies plus each font's `OFL.txt` to `assets/fonts/`. Commit the runtime copies to `public/assets/fonts/` with kebab-case names (`pixelify-sans.woff2`, `nunito.woff2`).
  - [ ] 8.3 Create `assets/CREDITS.md`, listing both fonts with author, the SIL OFL 1.1 licence and the source URL (NFR12; the Credits screen later reads from this).
  - [ ] 8.4 In `src/main.ts`, `loadFonts()` creates the two faces and waits for both before the game is created:
    - `new FontFace('Pixelify Sans', "url(./assets/fonts/pixelify-sans.woff2) format('woff2')", { weight: '400 700' })`
    - the equivalent face for Nunito, with `weight: '200 1000'`
    - `await Promise.all(faces.map(f => f.load()))`, then `document.fonts.add(f)` for each face
    - Use **relative URLs** (`./assets/...`). Never use `/assets/...`; it breaks the GitHub Pages subpath and itch.io.
  - [ ] 8.5 If font loading fails, `log.warn('boot', 'Font load failed; using fallback', err)` and continue, so the game still boots on the system font.
- [ ] **Task 9: `main.ts` and `BootScene`** (AC: 3, 11)
  - [ ] 9.1 `src/main.ts`:
    1. Set the letterbox colour: `document.body.style.backgroundColor = COLORS.duskDeep`, applied to the container too. Take it from `COLORS`, with no hex literal.
    2. `await loadFonts()`.
    3. Create `new Phaser.Game(config)` with:
       - `type: Phaser.AUTO`
       - `width: CANVAS_WIDTH`, `height: CANVAS_HEIGHT`
       - `parent: 'game-container'`
       - `backgroundColor: COLORS.dusk`
       - `pixelArt: true`
       - `scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH }`
       - `scene: [BootScene]`
       - **no `physics` key**
    - Do not set `roundPixels` by hand. `pixelArt: true` implies it; v4 defaults it to false otherwise.
  - [ ] 9.2 `src/view/scenes/BootScene.ts`: `export class BootScene extends Phaser.Scene`, with `constructor() { super('BootScene') }`. The scene key string equals the class name.
    - In `create()`, call `this.cameras.main.setBackgroundColor(COLORS.dusk)` and `log.info('boot', 'Boot scene ready')`.
    - Draw nothing else. `PreloadScene` and the loading bar arrive in Story 1.2. Do not add `TitleScene`, `GameScene` or other stubs.
- [ ] **Task 10: Verify and document** (AC: 3, 10, 11)
  - [ ] 10.1 `npm test`, `npm run typecheck`, `npm run lint` and `npm run build` must all pass. Paste a short summary of each into the Completion Notes.
  - [ ] 10.2 Check the built `dist/` contains no `gryzor`, `fonts.googleapis` or `log.info` strings: `grep -r` over `dist/assets/*.js` for `Boot scene ready` should return nothing, because info logs are stripped.
  - [ ] 10.3 **Manual browser check.** If you cannot open a browser, use the `run` skill or ask Rylan:
    - `npm run dev` in Chrome shows a dusk canvas centred in a dusk-deep letterbox.
    - Resizing the window keeps 16:9 with FIT.
    - DevTools Network shows only local requests, with the fonts served from `./assets/fonts/`.
    - In the console, `document.fonts.check('20px "Pixelify Sans"')` and `document.fonts.check('18px Nunito')` both return `true`.
    - There are 0 console errors.
  - [ ] 10.4 Update the root `README.md`: replace "Engine and tech stack have not been chosen yet" with the stack (Phaser 4.2, TS 6, Vite 8, Node 24), the npm scripts, the setup command `nvm use && npm install`, and the real `src/` layout.

## Dev Notes

### Scope

This story only builds the foundation: toolchain, configs, tokens, core utilities, lint boundaries, fonts and an empty dusk `BootScene`. **Nothing here touches `GameState`.**

These later stories own the following. Do **not** start any of them here:

| Story | Owns |
|---|---|
| 1.2 | `GameState`, `step`, `rng`, `PreloadScene`, atlases, `free-tex-packer-core`, the real `assets` script |
| 1.4 | Global error handler, debug overlay |
| 1.6 | `strings.ts`, widgets |
| 1.9 | Saving |
| 5.1 / 5.2 | GitHub Actions, real `zip` |

### Resolved conflicts and gotchas (read these first)

1. **The template is outdated against our pins.** `template-vite-ts` currently pins `phaser 4.0.0`, `vite ^6.3.1`, `typescript ~5.7.2` and `terser`, and uses a 1024×768 canvas. All of these must be changed to our pins and to 1280×720. Its `package.json` description still says "Phaser 3"; replace it.
2. **npm `latest` is past our pins.** TypeScript `latest` is 7.0.2: pin `~6.0.3`, because typescript-eslint 8.71 supports TS `<6.1`. Vitest `latest` is 5.0.3: pin `~4.1.11`, per AR1 and the architecture. Do not "helpfully" upgrade either.
3. **`log.js` telemetry.** The template's `dev`/`build` scripts run `node log.js`, which calls `gryzor.co`. Delete it, along with the `*-nolog` script variants. Platform rule: no network calls.
4. **Vite 8 = Rolldown.** `build.rollupOptions` is now `build.rolldownOptions`, and the object form of `manualChunks` was removed. We need neither.
5. **The architecture says the `eventBus` is a "thin wrapper over Phaser's EventEmitter", but `src/core/` must never import `phaser`** (lint rule, AC 9). Resolution: write a minimal typed emitter in core. This also keeps it unit-testable without Phaser.
6. **The GDD says "Phaser 3".** The architecture supersedes it with Phaser 4. Never write v3 APIs (`setTintFill`, `preFX`/`postFX`, `BitmapMask`, Arcade bodies).
7. **TS 6 `types: []` default.** Without `"types": ["vite/client"]` (or the `vite-env.d.ts` reference), `import.meta.env.DEV` fails `typecheck`.
8. **Repo extras.** `.claude/` (BMAD skills, including Python), `_bmad/` and `_bmad-output/` are in the repo. Exclude them from ESLint and `tsconfig`, or lint and typecheck will fail on files we do not own.
9. **The CLI is interactive.** It cannot be driven by flags, so use the degit fallback or ask Rylan to run it with `!`.

### Architecture compliance

- **Layering** (architecture, Architectural Boundaries):
  - `src/sim/`, `src/core/` and (by this story) `src/config/` are pure TypeScript.
  - `src/view/` is Phaser.
  - Only `src/save/` touches `localStorage`.
  - `src/debug/` is imported only behind `import.meta.env.DEV`.
- **Naming:**
  - Phaser classes: PascalCase, with file name = class name (`BootScene.ts`).
  - core/config modules: camelCase files exporting functions or constants (`log.ts`, `eventBus.ts`).
  - Constants: `UPPER_SNAKE`.
  - Types: PascalCase, no `I` prefix.
  - Scene key = class name string.
  - Assets: kebab-case.
- **Colours** come only from `COLORS` (no hex in view code). The only hex literals in `src/` live in `constants.ts`.
- **Logging:** `log.<level>(tag, …)` only, never raw `console.*` outside `log.ts`. Tags: `boot`, `save`, `sim`, `input`, `audio`, `ui`, `debug`. No logging in tick or frame loops.
- **Error levels:**
  - Font load is a *recoverable boundary failure*: `try/catch` → `log.warn` → fallback.
  - `invariant` handles impossible states: it throws in DEV and logs in production.

### Token reference (copy exactly; source DESIGN.md front matter)

**COLORS** (camelCase key ← DESIGN token):

| Key ← DESIGN token | Hex | Key ← DESIGN token | Hex |
|---|---|---|---|
| `wool` | `#FBF4E4` | `wood` | `#8E5A30` |
| `woolShade` ← `wool-shade` | `#EADBBE` | `void` | `#160E1C` |
| `bark` | `#3A2A1F` | `halo` | `#F6D86B` |
| `barkSoft` ← `bark-soft` | `#6B5444` | `haze` | `#8E5BB0` |
| `pasture` | `#86B85C` | `dusk` | `#3B2540` |
| `hay` | `#E9A23B` | `duskDeep` ← `dusk-deep` | `#22152A` |
| `hayDeep` ← `hay-deep` | `#B86F1C` | `infection` | `#B4E03C` |
| `heart` | `#E27894` | `alert` | `#E8503A` |
| `heartDeep` ← `heart-deep` | `#A8405D` | `disabled` | `#C9BCA6` |
| `awning` | `#B8453A` | `disabledInk` ← `disabled-ink` | `#6E6052` |

**TYPOGRAPHY:**

| Role | Family | Size (px) | Weight | Line height |
|---|---|---|---|---|
| `display` | Pixelify Sans | 56 | 700 | 1.1 |
| `title` | Pixelify Sans | 32 | 600 | 1.2 |
| `label` | Pixelify Sans | 20 | 500 | 1.2 |
| `numeric` | Pixelify Sans | 22 | 600 | 1 |
| `body` | Nunito | 18 | 600 | 1.35 |
| `caption` | Nunito | 18 | 800 | 1.3 |
| `popup` | Pixelify Sans | 24 | 700 | 1 |

**TYPOGRAPHY_USAGE** (UX-DR4):

| Role | Used for |
|---|---|
| `display` | Title logo, era banner, "The flock is gone." |
| `title` | Menu headers ("Paused"), "Last sheep!" |
| `label` | All buttons, shop row names and prices, "Shop" header, era badge |
| `numeric` | Meter values, money, flock/capacity, boost timer |
| `body` | Tooltips, announcement toasts |
| `caption` | Audio captions, shop row effect lines |
| `popup` | "+1", "+2" and "$10" float popups |

**RADIUS:** `sm` 4, `md` 8, `lg` 12, `full` 9999.

**SPACING:** `1` 4, `2` 8, `3` 12, `4` 16, `5` 24, `6` 32.

**LAYOUT:** `canvasWidth` 1280, `canvasHeight` 720, `safeMargin` 16, `hudBarHeight` 112, `hitMin` 40.

**COMPONENTS (35).** Transcribe each entry's fields verbatim from DESIGN.md (`_bmad-output/planning-artifacts/ux-designs/ux-sheep-civilization-2026-10-05/DESIGN.md`, front matter `components:`), converting `'{colors.x-y}'` → `'xY'`, `'{typography.label}'` → `'label'`, `'{rounded.md}'` → `'md'`, `'{spacing.3}'` → `12`, `'64px'` → `64`, and `opacity: '0.72'` → `0.72`.

| Group | Entries |
|---|---|
| Buttons | `button-farm`, `button-farm-boosted`, `button-breed-food`, `button-breed-tool`, `button-disabled`, `button-menu`, `button-menu-destructive` |
| Shop | `shop-toggle`, `shop-panel`, `shop-item-row` |
| Panels and controls | `panel`, `slider`, `toggle`, `menu-scrim`, `menu-scrim-start` |
| Bottom-bar read-outs | `food-meter`, `breeding-meter`, `money-counter`, `flock-counter` |
| Era and boost | `era-badge`, `era-banner`, `boost-timer` |
| Threat signals | `threat-summary`, `alert-ping`, `infection-marker` |
| Text and notices | `tooltip`, `announcement-toast`, `last-sheep-banner`, `caption`, `float-popup`, `lose-panel` |
| Drop targets | `drop-target-market`, `drop-target-better-place`, `drop-target-invalid` |
| Inventory | `medicine-slot` |

Use camelCase keys (`buttonFarm`, `menuScrimStart`, …). Keep non-token values such as `segmentCount: 20` and `shape: 'ring'` as their natural types.

### Library / framework requirements (verified 2026-10-05 from the npm registry)

| Package | Pin | Notes |
|---|---|---|
| phaser | `~4.2.1` | 4.2.1 "Giedi" (2026-07-09). Ships `node_modules/phaser/skills/` (28 skills, incl. `v3-to-v4-migration`, `game-setup-and-config`, `scale-and-responsive`). **Read `game-setup-and-config` and `scale-and-responsive` before writing `main.ts`.** In v4, `roundPixels` defaults to false and `pixelArt: true` turns it on. The Canvas renderer is deprecated; AUTO picks WebGL. |
| vite | `^8.3` | Rolldown + Oxc. Needs Node ≥22.12. |
| typescript | `~6.0.3` | Not 7.x. |
| vitest | `~4.1.11` | Not 5.x. |
| eslint / @eslint/js | `^10` | Flat config only. ESLint 9.39 is acceptable if 10 causes plugin issues. |
| typescript-eslint | `^8.71` | Supports ESLint 8–10 and TS `<6.1`. |
| Fonts | Pixelify Sans, Nunito | Both SIL OFL 1.1, self-hosted WOFF2. Do not add them as npm dependencies. |

**No other runtime dependencies** (project-context). Context7 MCP is available for current Phaser 4, Vite and Vitest docs; prefer it, or the bundled Phaser skills, over memory.

### File structure after this story

```
.nvmrc · index.html · package.json · package-lock.json · tsconfig.json
vite.config.ts · vitest.config.ts · eslint.config.js · README.md (updated)
assets/CREDITS.md · assets/fonts/{pixelify-sans,nunito}.woff2 + OFL licences
public/assets/fonts/{pixelify-sans,nunito}.woff2
scripts/build-assets.ts            (stub, exits 0)
src/main.ts
src/config/{constants,tuning}.ts
src/core/{log,invariant,format,eventBus,types}.ts
src/view/scenes/BootScene.ts
src/{sim,sim/systems,save,input,debug,view/{field,hud,overlay,widgets,juice,audio}}/.gitkeep
tests/core/{log,invariant,format,eventBus,types}.test.ts
tests/{sim,save}/.gitkeep
```

### Testing requirements

- Vitest, `environment: 'node'`. The tests in this story cover `src/core/` (required by AC 8). Sim and save tests start in Story 1.2.
- No Phaser, DOM or canvas in tests. Never mock Phaser.
- Tests live at `tests/<same path as src>/<module>.test.ts`.
- Use `vi.stubEnv('DEV', false)` for the production branches, and restore with `vi.unstubAllEnvs()`.
- **Done = `npm test`, `npm run typecheck` and `npm run lint` all green**, plus `npm run build` and the manual browser check in Task 10.3.

### Project context rules (from `_bmad-output/project-context.md`)

- **Engine:** Phaser 4.2.x; never v3 APIs.
- **Game config:**
  - `type: Phaser.AUTO`, 1280×720, `pixelArt: true` (no `roundPixels` hacks)
  - FIT + CENTER_BOTH
  - no `physics` key
- **Scenes:** the chain will be Boot → Preload → Title → Game, plus parallel Hud and Overlay scenes; the scene key is the class name.
- **Fonts:** Pixelify Sans and Nunito must load through the CSS Font Loading API in `main.ts` **before** any `Text` is created, or Phaser caches fallback metrics.
- **Platform:**
  - Desktop only.
  - No backend, network, CDN or Google Fonts at runtime; no service worker; no portal SDKs.
  - Relative asset URLs only.
- **Dev-only code** is gated by `import.meta.env.DEV`; production contains none of it.
- **Persistence keys:** `sheepciv.save.v1` and `sheepciv.settings` only, and every storage access goes through try/catch. Saving itself arrives in Story 1.9; this story only defines the constants.
- **Additions:**
  - A new tunable number goes in `config/tuning.ts`.
  - A new colour goes in `COLORS`, from DESIGN.md tokens.
  - Player copy goes in `src/view/strings.ts`, which arrives in Story 1.6.
- **Exhaustive unions** end with `assertNever`, which is provided by `src/core/types.ts` in this story.
- **No `I`-prefixed types. No logging in hot paths.**

### Previous story / git intelligence

This is the first story. There is no prior implementation and the repo holds only planning artifacts. The recent commits (`40817f4`, `790c075`, `2d6281c`, `12a2554`, `1be6681`) add BMAD docs and tooling only. Work is on branch `story/1-1-scaffold-the-project-from-the-phaser-template`.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.1: Scaffold the Project from the Phaser Template]
- [Source: _bmad-output/planning-artifacts/epics.md#Additional Requirements] (AR1, AR2, AR11, AR13, AR14, AR16, AR24)
- [Source: _bmad-output/planning-artifacts/epics.md#UX Design Requirements] (UX-DR1–7, UX-DR98, UX-DR100)
- [Source: _bmad-output/game-architecture.md#Project Initialization], [#Directory Structure], [#Architectural Boundaries], [#Error Handling], [#Logging], [#Configuration], [#Event System], [#Formats], [#Build and Deployment], [#Development Environment]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-sheep-civilization-2026-10-05/DESIGN.md] (front matter tokens, Colors, Typography)
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-sheep-civilization-2026-10-05/EXPERIENCE.md#Responsive & Platform]
- [Source: _bmad-output/project-context.md]
- External, checked 2026-10-05:
  - github.com/phaserjs/template-vite-ts
  - npmjs.com/package/@phaserjs/create-game (1.3.2)
  - vite.dev/guide/migration (Vite 8)
  - devblogs.microsoft.com/typescript/announcing-typescript-6-0

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created

### File List
