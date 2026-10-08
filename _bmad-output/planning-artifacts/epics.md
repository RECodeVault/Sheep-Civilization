---
stepsCompleted: [1, 2, 3, 4]
inputDocuments:
  - _bmad-output/planning-artifacts/gdds/gdd-sheep-civilization-2026-10-05/gdd.md
  - _bmad-output/planning-artifacts/gdds/gdd-sheep-civilization-2026-10-05/epics.md
  - _bmad-output/game-architecture.md
  - _bmad-output/planning-artifacts/ux-designs/ux-sheep-civilization-2026-10-05/DESIGN.md
  - _bmad-output/planning-artifacts/ux-designs/ux-sheep-civilization-2026-10-05/EXPERIENCE.md
  - _bmad-output/project-context.md
---

# Sheep Civilization - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for Sheep Civilization, decomposing the requirements from the GDD, UX Design if it exists, and Architecture requirements into implementable stories.

## Requirements Inventory

### Functional Requirements

**Hunger & feeding**
FR1: Each sheep has a Fullness stat (0–100) that drains from 100 to 0 over 120 game-seconds; a sheep dies when Fullness reaches 0.
FR2: Sheep display three hunger states derived from Fullness: Fed (>50), Hungry (50–25), Starving (<25).
FR3: Each Farm click fills the current click value of pips (base 1) on a 6-pip Farm progress bar (Story 3.6, 2026-10-08; was 8), shown with its count "{n}/6"; every full bar drops 1 food piece at a random reachable spot in the pen and the bar resets, with leftover pips carrying over. There is no food stock.
FR4: (Removed 2026-10-06) Clicking the field no longer drops food; food comes only from full Farm bars (FR3).
FR5: The nearest sheep with Fullness below 90 walks (60 px/s) to the nearest food piece and eats it for +35 Fullness (capped at 100); uneaten pieces stay until eaten and never spoil.
FR6: A new game starts with 2 adults aged 60 s and 1 newborn lamb, all at Fullness 60, with an empty Farm bar, an empty breeding bar and no sheep ready to breed.

**Life stages & breeding**
FR7: Sheep age through Lamb (0–60 s), Adult (60–420 s) and Elder (420–540 s); elders die of old age at 540 s. (Changed 2026-10-07, Rylan: adulthood lengthened from 4 to 6 minutes to give time to breed.)
FR8: (Changed 2026-10-06) Each Farm Breeding Food click fills 1 pip of an 8-pip breeding bar, shown with its count "{n}/8"; every full bar drops 1 breeding-food piece at a random reachable spot in the pen and the bar resets, with leftover pips carrying over. There is no breeding food stock and no cap; pieces stay until eaten and never spoil. The bar is never boosted and Better Hoe does not apply.
FR8a: An adult that is not ready and not on breeding cooldown walks to the nearest breeding-food piece and eats it, becoming ready to breed (no Fullness). A sheep that would seek food (Fullness < 90 and a food piece exists) seeks food first. Lambs and elders ignore breeding pieces, and a ready adult that turns elder loses its readiness.
FR9: With the Breed tool, clicking ready adult A then ready adult B shows a heart, uses up both sheep's readiness, and a lamb is born beside them 10 s later. Breeding costs no breeding food.
FR10: Each adult has a 60 s breeding cooldown starting at breeding; a sheep on cooldown cannot breed and shows a heart-outline icon on hover.
FR11: Breeding is blocked (Breed greyed out) when living sheep plus pending lambs reach land capacity, or when fewer than 2 adults are ready to breed.

**Death, carcasses & virus**
FR12: Every death other than sacrifice (starvation, old age, virus, Abomination) leaves a carcass at the sheep's position.
FR13: A carcass stays until the player clicks it once to clear it.
FR14: A Starving sheep eats a carcass only when no food piece is on the field.
FR15: Eating a carcass infects the sheep 100% of the time; the sheep turns green immediately and dies 20 s later, leaving a carcass.

**Drag, Market & Better Place**
FR16: Sheep can be dragged; a pointer movement over 6 px starts a drag, otherwise it is a click.
FR17: Dropping an adult on the Market stall sells it for $10, an elder for $5; lambs cannot be sold.
FR18: Dropping any sheep (including lambs, infected sheep and the Abomination) into the Better Place removes it with no carcass.
FR19: Each sacrifice doubles the pips per Farm click for 30 s; a repeat sacrifice during a boost resets the timer to 30 s (no stacking).
FR20: Sell and sacrifice have no confirmation; dropping on the wrong target is allowed.

**Economy, shop & land**
FR21: Money is earned only by selling and has no cap.
FR22: The shop offers Land I/II/III ($80/$150/$400; Land I was $50 until Story 3.6) raising capacity 10 → 25 → 50 → 100, each tier requiring the previous one; land growth is shown as the fence expanding.
FR23: The shop offers Flower Patch ($40) and Scarecrow ($80) as cosmetic decorations.
FR24: (Should) The shop offers Better Hoe I/II ($30/$100) raising a Farm click to 2/3 pips.
FR25: (Should) The shop offers an Auto-feeder ($120, one only) that drops 1 food piece next to the hungriest sheep every 10 s [redesign pending since 2026-10-06: there is no food stock, so Story 4.8 decides what feeds it].
FR26: (Should) The shop sells Medicine ($15 per dose); dragging a dose onto an infected sheep cures it immediately.

**Eras**
FR27: Eras are derived from sheep alive right now: Pasture (start), Village (10), Town (25), Wool Empire (50).
FR28: An era change swaps the background with a ~1 s crossfade and an era-name banner; dropping below a threshold reverts to the previous era with the same transition.

**Hidden threats (Should)**
FR29: (Should) The first Abomination is guaranteed on a random birth between the 8th and 15th of a save; afterwards each birth has a 5% chance; at most one alive.
FR30: (Should) The Abomination looks like a normal lamb, never grows past the lamb stage, never dies of old age, eats normally (can starve), and counts toward capacity and eras.
FR31: (Should) Every 45–60 s the Abomination walks up to a random other sheep, pauses 1 s, walks away; the victim dies 5–10 s later leaving a carcass.
FR32: (Should) Tells: an off-step walk cycle, and other sheep keep 36 px from it instead of the normal 24 px.
FR33: (Should) Sacrificing reveals the truth: the Abomination flashes its true form with a screech and sting; an innocent shows the caption "…that was just {name}." ("…that was just a sheep." before names).
FR34: (Should) Overcrowding: while the flock is at ≥90% of capacity, every 30 s one random sheep has a 20% chance of becoming infected.

**Names, stats & warnings (Should)**
FR35: (Should) Each sheep gets a random name from a list of at least 100, shown on hover and used in death announcements.
FR36: (Should) A stats panel shows sheep alive, sold, died, sacrificed and money earned.
FR37: (Should) A "Last sheep!" warning plays when the flock drops to 1.

**Win/loss, save & pause**
FR38: The game is lost when 0 sheep are alive (including by selling or sacrificing the last one); the lose screen shows time survived and peak flock size with a Restart button that wipes the save.
FR39: The game has no win state; it is open-ended.
FR40: The game autosaves to localStorage every 10 s and when the tab is hidden, and resumes exactly where it stopped on load.
FR41: The simulation stops completely while the browser tab is hidden; there is no offline progress.
FR42: Hovering a sheep shows a tooltip with name, stage and hunger state.
FR43: Keyboard shortcuts: F = Farm, G = Farm Breeding Food, Esc = pause menu.
FR44: An Esc pause menu and a credits screen listing asset licences are available.

### NonFunctional Requirements

NFR1: 60 FPS sustained with 100 sheep on screen over 5 minutes in Chrome and Firefox on a mid-range laptop with an integrated GPU.
NFR2: Initial load under 5 s on broadband.
NFR3: Total build size under 8 MB.
NFR4: Desktop browsers only: Chrome, Firefox, Edge (latest 2 versions); mobile is not supported.
NFR5: Fixed 16:9 canvas scaled to fit the window (1280×720 logical, minimum 960×540).
NFR6: All game state lives in one plain serializable object used for saving and testing.
NFR7: No save corruption across 10 reload cycles.
NFR8: Zero console errors during a 30-minute session.
NFR9: First impression: a new player can start feeding without help within 60 s, using only button labels and tooltips (no tutorial text).
NFR10: Tone: death and sacrifice are presented comedically (slapstick, cartoon X-eyes), never gore.
NFR11: Deployable as a static site to GitHub Pages and itch.io (HTML5 embed); no backend, no monetization, no portal SDKs.
NFR12: Art and audio come from free packs with portfolio-compatible licences, credited in-game.

### Additional Requirements

**Starter template (Epic 1 Story 1):** scaffold with the official Phaser template — `npm create @phaserjs/game@latest` → Web Bundler → Vite → TypeScript — then merge into the repo root and replace sample scenes.

- AR1: Toolchain: Phaser 4.2.x, TypeScript 6.x (`strict`), Vite 8.x with `base: './'`, Node 24 LTS, Vitest 4.1.x, ESLint + typescript-eslint; no other runtime dependencies.
- AR2: Game config: 1280×720, `Phaser.AUTO`, `pixelArt: true`, Scale `FIT` + `CENTER_BOTH`, no physics.
- AR3: Pure-TS simulation in `src/sim/` (no Phaser/DOM/`Date.now()`/`Math.random()`), mutating a single plain-data `GameState` only through `step(state)` and `applyCommand(state, cmd)`.
- AR4: Fixed-step clock: `TICK_MS = 100`, accumulator in `GameScene` with 250 ms frame clamp; timers stored as absolute game-ms deadlines; rendering interpolates positions (previous positions stored on sprites).
- AR5: Movement via custom steering (wander, seek, separation 24/36 px, fence containment) with a 48 px uniform spatial grid rebuilt each tick; no physics engine.
- AR6: Scenes: Boot → Preload → Title → Game, with parallel Hud and Overlay scenes; scene keys equal class names.
- AR7: Typed `Command` union in (view → sim) and typed `SimEvent` union out (per-tick queue, not saved) re-emitted on a typed `EventBus`; UI events named `noun:verb`; listeners removed on scene shutdown.
- AR8: Single `InputController` state machine (idle / breeding / dragging) with 6 px threshold and Esc priority chain (confirm → sub-panel → cancel drag → exit breed mode → close shop → pause); right-click and re-clicking Breed cancel breed mode; F/G ignore key repeat.
- AR9: Save: localStorage key `sheepciv.save.v1` holding `{ schemaVersion, savedAt (ISO), state }`; parse → migrate → validate on load, falling back to New Game with a warning; settings separately in `sheepciv.settings`; every storage access wrapped in try/catch.
- AR10: Seeded mulberry32 PRNG with state stored in `GameState`; `Math.random()` allowed only for cosmetic view jitter.
- AR11: Asset pipeline: `scripts/build-assets.ts` (`npm run assets`) packs `sheep-world` and `ui` atlases with free-tex-packer-core and builds one SFX audio sprite (OGG + MP3); outputs committed under `public/assets/`; fonts (Pixelify Sans, Nunito) self-hosted WOFF2 and loaded before any Text is created.
- AR12: Vitest tests for `src/sim/` and `src/save/` only, seeded, using `runFor(state, ms)` and `TUNING` values; mandatory save round-trip, corrupt-save and Abomination-secrecy tests.
- AR13: `src/config/tuning.ts` holds every tunable number; `src/config/constants.ts` holds `TICK_MS`, canvas size, storage keys, `SAVE_SCHEMA_VERSION` and `COLORS` from DESIGN.md tokens.
- AR14: Cross-cutting core modules: `log` (tagged; debug/info stripped in production), `invariant` (throws in DEV, logs in production), global error handler (forces save + toast in production), `format` (`formatGameTime`, `formatMoney`).
- AR15: DEV-only debug overlay (backtick): FPS, counts, sim speed ×1/×4/×16, step tick, reveal Abomination, spawn carcass, infect sheep, add money/food, dump state, copy/load save via clipboard; tree-shaken from production.
- AR16: ESLint boundary rules: sim/core purity, `isAbomination` readable only in `src/sim/` and `src/debug/`, no `localStorage` outside `src/save/`.
- AR17: Novel pattern N1 — all non-sacrifice deaths via `killSheep(state, id, cause)`; sell/sacrifice via `removeSheep`; both run `checkLastSheepAndLoss`. Epic 1 gates carcass spawn with `TUNING.carcassesEnabled`.
- AR18: Novel pattern N2 — Abomination data (`isAbomination`, `stalk`, victim `doomedAt`, `state.abomination`) hidden behind the `PublicSheep` selector; the only tells are `gait: 'offstep'` and wider separation; truth only via `Sacrificed { wasAbomination }`.
- AR19: Novel pattern N3 — `EntityLayer` reconciles pooled sprites to sim entities by id each frame (pools 120 sheep / 60 food / 40 carcasses, grow on demand).
- AR20: Novel pattern N4 — era derived via `currentEra(state)`; `state.lastEra` only for emitting `EraChanged`.
- AR21: Capacity = living sheep + `state.pregnancies`.
- AR22: Player-facing copy centralised in `src/view/strings.ts`; colours only from `COLORS`.
- AR23: Deployment: GitHub Actions on push to `main` (npm ci → test → build → Pages); `npm run zip` for itch.io HTML5 upload (1280×720 embed, fullscreen button).
- AR24: npm scripts: `dev`, `build`, `preview`, `test`, `lint`, `typecheck`, `assets`, `zip`.
- AR25: Visibility handling: on hidden stop accumulation, force save, pause music; on visible resume with no overlay and reset frame delta.

### UX Design Requirements

Source: `_bmad-output/planning-artifacts/ux-designs/ux-sheep-civilization-2026-10-05/` DESIGN.md + EXPERIENCE.md (mockups: title.html, hud.html, pause.html — illustrative; spec wins on conflict).
Engine is Phaser 4 (game-architecture.md). Nearly all token values are [ASSUMPTION] in source (Rylan gave no preference) but are the working spec.
Items tagged **(Should)** follow GDD Should tier; everything else is Must.

#### Tokens

- UX-DR1: Define a color-token constants module with exactly these 20 tokens: wool #FBF4E4, wool-shade #EADBBE, bark #3A2A1F, bark-soft #6B5444, pasture #86B85C, hay #E9A23B, hay-deep #B86F1C, heart #E27894, heart-deep #A8405D, awning #B8453A, wood #8E5A30, void #160E1C, halo #F6D86B, haze #8E5BB0, dusk #3B2540, dusk-deep #22152A, infection #B4E03C, alert #E8503A, disabled #C9BCA6, disabled-ink #6E6052. All UI code references tokens, never raw hex. (DESIGN: front matter colors / Colors)
- UX-DR2: Enforce color-usage rules: money uses `hay` never `halo`; boost uses `halo` (echoes Better Place); `awning` never for alerts; `alert` never for Market; `void` never for panels; `infection` never on healthy things; `pasture` is art reference only, not UI chrome. (DESIGN: Colors table, Do's and Don'ts)
- UX-DR3: Define typography tokens: display Pixelify Sans 56px/700/lh1.1; title Pixelify Sans 32/600/1.2; label Pixelify Sans 20/500/1.2; numeric Pixelify Sans 22/600/1; body Nunito 18/600/1.35; caption Nunito 18/800/1.3; popup Pixelify Sans 24/700/1. Both fonts self-hosted as WOFF2 (no Google Fonts requests) and loaded before first text render (AR11). (DESIGN: typography / Typography)
- UX-DR4: Typography usage mapping: display = title logo, era banner, "The flock is gone."; title = menu headers ("Paused"), "Last sheep!"; label = all buttons, shop row names/prices, "Shop" header, era badge; numeric = meter values, money, flock/capacity, boost timer; body = tooltips, toasts; caption = audio captions, shop effect lines; popup = "+1"/"+2"/"$10" popups. (DESIGN: Typography)
- UX-DR5: No text smaller than 18px on the base canvas (≥13.5px at 960×540 min). Numbers right-aligned in fixed-width boxes so non-tabular digits do not jitter. Text rendered with `resolution` = device pixel ratio. (DESIGN: Typography; EXPERIENCE: Accessibility Floor)
- UX-DR6: Define radii tokens sm 4, md 8, lg 12, full 9999; spacing tokens 1=4, 2=8, 3=12, 4=16, 5=24, 6=32; layout tokens canvas-width 1280, canvas-height 720, safe-margin 16, hud-bar-height 112, hit-min 40. (DESIGN: rounded/spacing)
- UX-DR7: Define component-spec constants mirroring the DESIGN front-matter `components` map (button-farm, button-farm-boosted, button-breed-food, button-breed-tool, button-disabled, button-menu, button-menu-destructive, shop-toggle, panel, shop-panel, shop-item-row, slider, toggle, menu-scrim, menu-scrim-start, food-meter, breeding-progress, breeding-piece, ready-marker, money-counter, flock-counter, era-badge, era-banner, boost-timer, threat-summary, alert-ping, infection-marker, tooltip, drop-target-market, drop-target-better-place, drop-target-invalid, announcement-toast, last-sheep-banner, caption, float-popup, lose-panel, medicine-slot) referencing token names. (DESIGN: components)
- UX-DR8: Depth styling: no soft shadows; panels/buttons get a 2px darker outline plus a 2px offset "drop" in `bark` @40%; pressed buttons lose the offset; disabled buttons have no drop offset. (DESIGN: Elevation & Depth)
- UX-DR9: Shapes: pixel-stepped 9-slice corners — `rounded.md` (8px) for buttons, `rounded.lg` (12px) for panels; pills (`rounded.full`) reserved for non-clickable status read-outs (era badge, boost timer). Round "!" ping glyph and bubble-cluster glyph used nowhere else. (DESIGN: Shapes)
- UX-DR10: Four render layers bottom→top: (1) World: background, fence, sheep, food, carcasses, Market, Better Place; (2) World overlays: alert pings, infection markers, float popups — always above shop panel; (3) HUD: bottom bar, shop panel, toasts, captions, tooltip; (4) Modal: start/pause/credits/lose over scrim. Modals replace each other, never stack two deep. (DESIGN: Elevation & Depth)

#### Screens

- UX-DR11: Boot/load screen: loading bar on `dusk` background; cold load finishes in under 5s on broadband. (EXPERIENCE: State Patterns)
- UX-DR12: Start screen: title logo (display), menu buttons **Continue** (only when a save exists, shown first), **New Game**, **Credits**; decorative sheep milling in background (e.g. three) visible through lighter `menu-scrim-start` (dusk-deep @40%). No save → Continue hidden, not greyed. Continue resumes exactly where play stopped. (EXPERIENCE: IA, State Patterns; DESIGN: Elevation; mockups/title.html)
- UX-DR13: New Game with an existing save opens the start-over confirm; without a save it starts a new game directly. (EXPERIENCE: IA, Component Patterns)
- UX-DR14: Pause menu: opened by `Esc` or the top-left **Pause** button (`button-pause`, added 2026-10-06, Rylan: wool menu-style button, 40px, tooltip "Pause (Esc)"); centred `panel` headed "Paused" (title type) over `menu-scrim` (dusk-deep @72%) over a frozen field; buttons **Resume, Volume, Stats, Restart, Credits, Main Menu** in that order (Main Menu added 2026-10-06, Rylan: saves and returns to the start screen with no confirm); sim paused; `Esc` or Resume returns to play. (EXPERIENCE: IA, State Patterns; DESIGN: Components panel; mockups/pause.html)
- UX-DR15: Volume panel (from Pause): Music slider, SFX slider, Reduced motion toggle, Captions toggle, Back; sim paused. (EXPERIENCE: IA, Accessibility Floor)
- UX-DR16: **(Should)** Stats panel (from Pause): Alive, sold, died, sacrificed, money earned; Back; sim paused. (EXPERIENCE: IA)
- UX-DR17: Credits panel (from Start or Pause): asset pack credits and licences in body (Nunito) type, then Back; sim paused when opened in game. (EXPERIENCE: IA; DESIGN: Typography)
- UX-DR18: Start-over confirm: `panel` with text "Start over? Your flock will be lost.", **Cancel** (`button-menu`) on the left, **Start over** (`button-menu-destructive`: awning fill, wool label, hover → alert) on the right. Reached from New Game (save exists) and pause Restart. Start over wipes the save and starts a new game; Cancel or `Esc` returns to the previous modal. Only confirmation in the game. (EXPERIENCE: Component Patterns; DESIGN: Components; mockups/pause.html)
- UX-DR19: Lose screen: when flock reaches 0 the sim stops, `menu-scrim` appears, then `lose-panel` (dusk bg, wool text, rounded.lg) with title "The flock is gone." in display, stats "Survived {mm:ss} · Peak flock {n}" in `halo`, and single action **Restart**, which wipes the save and starts a new game with no confirm. (EXPERIENCE: IA, State Patterns, Component Patterns; DESIGN: Components)
- UX-DR20: Modal rules: every modal is one centred panel over the scrim; clicking the scrim does nothing; Back returns to previous modal; modals replace (never stack); nothing is more than one level deep from the game. Era badge remains visible top-right under pause and confirm modals. (EXPERIENCE: IA, Component Patterns; DESIGN: Layout)
- UX-DR21: Menu buttons (`button-menu`): 280×52, wool fill, bark outline, bark label (label type), hover fill `hay`, click activates; used on start, pause, lose, credits screens. (DESIGN: Components; EXPERIENCE: Component Patterns)
- UX-DR22: Slider (`slider`): wool-shade track, hay fill, bark thumb 40px tall; drag or click-to-set; on release previews SFX level with a bleat. Toggle (`toggle`): 32px tall, off wool-shade, on hay, bark knob; hover highlight, click toggles. (DESIGN: Components; EXPERIENCE: Component Patterns)
- UX-DR23: Shop panel (`shop-panel`): 360px wide, wool bg, wood border, rounded.lg, padding 16, header "Shop" in label type; rises from bottom bar on the left; opened/closed by Shop toggle or closed by `Esc`; sim keeps running while open; never covers Market, Better Place or toasts. Contents: Land I–III, decorations, **(Should)** Better Hoe I–II, Auto-feeder, Medicine. (EXPERIENCE: IA, Component Patterns; DESIGN: Components, Layout; mockups/hud.html)
- UX-DR24: Shop item row (`shop-item-row`): 56px tall, wool-shade bg, rounded.md; line 1 icon + name + price (label type), line 2 one-line effect from GDD (caption type). Click buys instantly with no confirmation; money counter ticks down and item applies (e.g. fence grows). Unaffordable rows stay visible, name/effect/price greyed to `disabled-ink`. One-time items (Auto-feeder, decorations, Land tiers) show "Owned" after purchase; Medicine repeat-purchasable; locked Land tier shows "Needs Land {n}" on effect line. (DESIGN: Components; EXPERIENCE: Component Patterns)

#### HUD

- UX-DR25: Bottom bar: 112px tall, wool surface, left→right: Farm button (Farm progress bar beneath), Farm Breeding Food button (breeding progress bar beneath), Breed tool, Medicine slot (Should), money, flock counter, threat summary, boost timer, Shop toggle. Actions left, information right. Always visible (Q4). (DESIGN: Layout; EXPERIENCE: IA, HUD & Diegetic UI)
- UX-DR26: Farm button (`button-farm`): 64px tall, hay fill, hay-deep border, bark label "Farm", key hint "F", rounded.md, padding 12. Left-click or `F` fills the click value of pips on the Farm progress bar, with a squash and a soft pop SFX. When a bar completes, its food piece drops into the pen with a landing bounce and a "+1" float popup rises over the button. Pressed state uses hay-deep / loses drop offset. (DESIGN: Components; EXPERIENCE: Component Patterns)
- UX-DR27: Farm button boosted (`button-farm-boosted`): pulsing `halo` outer glow and a small `void` badge with `halo` text "×2"; each click fills double pips. (DESIGN: Components; EXPERIENCE: State Patterns)
- UX-DR28: Farm Breeding Food button (`button-breed-food`): same anatomy, heart fill, heart-deep border, bark label "Farm Breeding Food", key hint "G", 64px; same click/squash/popup behaviour as Farm: left-click or `G` fills a pip of the breeding bar, and a full bar drops a breeding-food piece into the pen with a "+1" popup over the button; never boosted. (DESIGN/EXPERIENCE: Components)
- UX-DR29: Farm progress (`farm-progress`), stacked under Farm: 6 discrete hay pips (one per `TUNING.farmPipsPerFood`; 8 until Story 3.6) on a wool-shade track showing the current bar, with its count "{n}/6" in numeric beside it (starts at "0/6"); updates on the frame of the change. (Changed 2026-10-06: no food stock.)
- UX-DR30: (Changed 2026-10-06) Breeding progress (`breeding-progress`): stacked under Farm Breeding Food, 8 discrete heart pips on a wool-shade track showing the current bar, with its count "{n}/8" in numeric beside it (starts at "0/8"); updates on the frame of the change. There is no breeding stock, cost tick or empty shake. (DESIGN/EXPERIENCE: Components)
- UX-DR30a: Breeding-food piece: a small heart-coloured, heart-shaped treat on the field, distinct from the hay food piece by shape as well as colour; bounces on landing; a ready sheep shows a small heart icon above it (world-overlay layer, always visible) until it breeds or turns elder. [ASSUMPTION for sprite and marker] (Sprint change 2026-10-06, breeding food)
- UX-DR31: Breed tool (`button-breed-tool`): 64px (was 56px; aligned with the Farm buttons, Rylan 2026-10-07), wool fill, heart-deep border, heart icon, label "Breed"; active: heart-deep fill, wool label, heart cursor. Greyed (`button-disabled`) at land capacity (including pending lambs) or when fewer than 2 adults are ready, with tooltip reason ("No room. Buy land." / "Needs 2 ready sheep."); becoming greyed exits active breed mode. (DESIGN/EXPERIENCE: Components; State Patterns)
- UX-DR32: Disabled button (`button-disabled`): flat `disabled` fill, `disabled-ink` label, opacity 1, no drop offset; actions are greyed with readable label, never hidden. (DESIGN: Components, Do's)
- UX-DR33: **(Should)** Medicine slot (`medicine-slot`): small wool tile right after Breed, infection-colored bottle icon, bark "×{n}" count, rounded.md; only appears while ≥1 dose owned; drag a dose onto an infected sheep cures instantly; drop elsewhere returns dose to slot. (DESIGN/EXPERIENCE: Components)
- UX-DR34: Money counter (`money-counter`): hay coin icon + "${n}" in numeric bark; read-only; ticks down on purchase. (DESIGN/EXPERIENCE: Components)
- UX-DR35: Flock counter (`flock-counter`): sheep icon + "{alive}/{capacity}" numeric bark; read-only. **(Should)** At ≥90% capacity numbers turn `alert` and a small crowd icon appears. (DESIGN: Components; EXPERIENCE: State Patterns)
- UX-DR36: Era badge (`era-badge`): dusk pill, wool label-type text with current era name (e.g. "Village"), top-right of field; always shows current era; updates on era change. (DESIGN/EXPERIENCE: Components)
- UX-DR37: Era banner (`era-banner`): full-width dusk band across upper field, era name in display type `halo` ("Village"/"Town"/"Wool Empire") on advance with ~1s background crossfade and fanfare; on regress text "Back to {era}." in `wool-shade`, no fanfare (soft descending note). Slides in (fades under reduced motion). (DESIGN/EXPERIENCE: Components; State Patterns; Game Feel)
- UX-DR38: Boost timer (`boost-timer`): void pill, "×2 0:{ss}" in numeric `halo`; appears on sacrifice counting down from 0:30; repeat sacrifice resets to 0:30 with a pop; hidden at 0 / when no boost. (DESIGN/EXPERIENCE: Components)
- UX-DR39: Threat summary (`threat-summary`): three icon+count pairs — Starving (alert drooping sheep), Infected (infection bubbles), Carcasses (bark-soft X-eyes); numeric bark text; zero counts dim to `disabled-ink`; live counts; hover shows tooltip e.g. "2 starving"; click does nothing in v1. Abomination never counted/distinguished. (DESIGN/EXPERIENCE: Components; HUD & Diegetic UI)
- UX-DR40: Shop toggle (`shop-toggle`): 56px, wood fill, wool "Shop" label; open state hay fill + bark label; toggles shop panel. (DESIGN/EXPERIENCE: Components)
- UX-DR41: Announcement toast (`announcement-toast`): dusk card, wool body text, sheep name in `halo`, rounded.md; up to 3 visible, stacking top-centre, newest on top, each ~4s; never block clicks (non-interactive). (DESIGN/EXPERIENCE: Components)
- UX-DR42: **(Should)** "Last sheep!" banner (`last-sheep-banner`): alert band, bark text in title type; plays once each time flock drops to 1, with sting and caption "[sting] Last sheep!"; Breed greyed (no pair possible). (DESIGN/EXPERIENCE: Components; State Patterns)
- UX-DR43: Tooltip (`tooltip`): dusk-deep box, wool body text, rounded.sm, padding 8. Sheep hover ~300ms shows two lines: name (label type) then "{Stage} · {Fed|Hungry|Starving}" (e.g. "Adult · Hungry"), plus heart-outline icon in `heart` when on breeding cooldown; follows the sheep; hidden while dragging. Also shows on buttons. Abomination tooltip identical to a lamb's. (DESIGN/EXPERIENCE: Components)
- UX-DR44: Float popup (`float-popup`): wool text with bark outline, popup type; "+1", "+2", "$10", "×2"; rises ~24px and fades over 600ms; under reduced motion fades in place. Farm pops "+1" only when a bar completes, not on every click. (DESIGN/EXPERIENCE: Components)
- UX-DR45: Caption (`caption`): dusk-deep @85%, wool caption-type text, rounded.sm, bracketed text (e.g. "[thud]"); bottom-centre above the bar; ~2.5s; max 2 at once. (DESIGN: Components; EXPERIENCE: Accessibility Floor)

#### Field

- UX-DR46: Market stall (diegetic): wooden red-and-cream striped rectangular stall on the field's right edge, outside the fence; it is the sell target. (EXPERIENCE: HUD & Diegetic UI; DESIGN: Layout, Colors)
- UX-DR47: Better Place (diegetic): fixed round hole (void interior, halo rim) in upper-left quadrant at approx x 450–590, right of the shop panel footprint and far from the Market; sacrifice target. (DESIGN: Layout; EXPERIENCE: HUD & Diegetic UI)
- UX-DR48: Market and Better Place must read as opposites in hue, value, shape and motion: Market warm/rectangular/wood, Better Place cold-glow/round/void; distinguishable without color. (DESIGN: Colors, Shapes, Do's)
- UX-DR49: Fence: enclosed area visually represents land capacity; starts small and expands in place with each Land tier purchase. (DESIGN: Layout; EXPERIENCE: HUD & Diegetic UI)
- UX-DR50: Era backgrounds show progress; era change crossfades background over ~1s. (EXPERIENCE: HUD & Diegetic UI, State Patterns)
- UX-DR51: Market drop target (`drop-target-market`): while dragging, pulsing `awning` rectangle outline with price tag (awning bg, wool text) "$10" (adult) / "$5"; when hovered, awning flaps and tag grows. (DESIGN: Components; EXPERIENCE: Interaction Primitives)
- UX-DR52: Better Place drop target (`drop-target-better-place`): while dragging, `halo` ring brightens, `haze` glow appears, label "+2× food" in halo; when hovered, hole visibly sucks and ring spins. (DESIGN: Components; EXPERIENCE: Interaction Primitives)
- UX-DR53: Invalid drop target (`drop-target-invalid`): lamb (incl. Abomination) dragged over Market → target desaturates to `disabled`, tag reads "Too young"; drop there bounces sheep back onto the field. (DESIGN: Components; EXPERIENCE: Interaction Primitives)
- UX-DR54: Alert ping (`alert-ping`): 20px alert circle, wool "!" glyph, 2px bark outline; pops once above sheep/carcass when it enters Starving, becomes Infected, or a carcass spawns; bobs ~3s then settles to small static dot until state resolves; drawn above shop panel. Abomination never pinged. (DESIGN: Components; EXPERIENCE: HUD & Diegetic UI)
- UX-DR55: Infection marker (`infection-marker`): 16px cluster of three lime (`infection`) bubbles with bark outline, bobbing above an infected sheep's head on top of green tint, until death or cure; no timer display. (DESIGN/EXPERIENCE: Components)
- UX-DR56: Breed-mode markers: ready adults show a soft heart marker; first-selected adult A gets a pinned heart above it; pregnant pair shows a heart floating between them; lamb pops out 10s later with small poof. (EXPERIENCE: Interaction Primitives, State Patterns, Game Feel)

#### States

- UX-DR57: Sheep hunger visuals: Fed — normal walk/bleats; Hungry — drooping posture, bleats 2× as often; Starving — thin sprite, frantic bleats, alert ping on entry, counted in threat summary. (EXPERIENCE: State Patterns)
- UX-DR58: Infected sheep: `infection` tint + infection marker + sickly wobble walk; ping on entry. Elder: greyer sprite. Breeding cooldown: heart-outline icon on hover only. (EXPERIENCE: State Patterns)
- UX-DR59: Carcass: X-eyes sprite and dust puff on spawn, ping on spawn; stays until clicked; counted in threat summary. Death shows no red blood/gore. (EXPERIENCE: State Patterns; DESIGN: Do's)
- UX-DR60: Dragged sheep: lifted 4px, legs dangling, stops wandering; both drop targets highlight. (EXPERIENCE: State Patterns)
- UX-DR61: (Removed 2026-10-06) There is no food stock, so there is no empty food meter; and since 2026-10-06 there is no breeding stock either, so no meter has an empty shake.
- UX-DR62: Hidden tab: sim stops completely (and game saves); on return play resumes with no overlay. (EXPERIENCE: State Patterns, Accessibility Floor, Key Flows)
- UX-DR63: Shop open state: panel open, toggle in open style, sim running, pings stay above the panel. (EXPERIENCE: State Patterns)
- UX-DR64: Abomination must be visually identical to a lamb in every UI element: no ping, no count, no tooltip difference; its victim's death surfaces normally with a cause-less toast. Off-step walk and flock avoidance are its only tells. (EXPERIENCE: HUD & Diegetic UI; DESIGN: Do's)

#### Interaction

- UX-DR65: Click: left-click on a button acts; on a carcass clears it; on empty field or a sheep in default mode does nothing (food comes from the Farm bar since 2026-10-06). (EXPERIENCE: Interaction Primitives)
- UX-DR66: Drag threshold: a press becomes a drag after 6px of movement; below that it is a click. (EXPERIENCE: Interaction Primitives)
- UX-DR67: Drag a sheep: on drag start both drop targets highlight together; target under cursor intensifies; release on Market sells, in Better Place sacrifices; release on field places sheep where dropped; release outside the fence places it at the nearest point inside the fence. (EXPERIENCE: Interaction Primitives)
- UX-DR68: No confirmations on sell, sacrifice or shop purchases; no confirmation dialogs on in-game actions, no tutorial pop-ups, no timers that hide what kills a sheep. (EXPERIENCE: Interaction Primitives, Component Patterns)
- UX-DR69: Breed mode enter: click Breed → button heart-deep fill, cursor becomes heart, ready adults get heart marker (lambs, elders, sheep that are not ready or are on cooldown don't). (EXPERIENCE: Interaction Primitives)
- UX-DR70: Breed mode pair: click ready adult A (pins heart), then ready adult B → both lose readiness, heart appears, lamb born 10s later, breed mode exits. Clicking an ineligible sheep shakes it and keeps mode active; clicking empty field in breed mode drops no food. (EXPERIENCE: Interaction Primitives)
- UX-DR71: Breed mode cancel: right-click, `Esc`, or clicking Breed again. (EXPERIENCE: Interaction Primitives)
- UX-DR72: Keys: `F` farms food, `G` farms breeding food, one action per keypress (no repeat on hold). Key hints printed on buttons. No touch, gamepad or remapping. (EXPERIENCE: Interaction Primitives, Input Schemes)
- UX-DR73: `Esc` priority chain (agreed 2026-10-05): close start-over confirm → close sub-panel (Volume/Stats/Credits) → cancel drag → exit breed mode → close shop → open/close pause. (EXPERIENCE: Interaction Primitives, Component Patterns; game-architecture.md)
- UX-DR74: Right-click cancels breed mode; right-drag (past 6px) pans the field camera, pinned so the whole pen stays in view (added 2026-10-06, Rylan); browser context menu suppressed on the canvas. (EXPERIENCE: Interaction Primitives)
- UX-DR75: Hover shows tooltip on sheep and buttons; button tooltips: "Farm: fill the bar for 1 food (F)", "Farm Breeding Food: fill the bar for 1 breeding food (G)", "Breed: pick two adults". (EXPERIENCE: Interaction Primitives, Voice and Tone)
- UX-DR76: Mouse-only completeness: every action reachable via left-click, drag, right-click. (EXPERIENCE: Input Schemes)

#### Feel

- UX-DR77: Button click juice: button squash, "+N" float popup, soft pop SFX. (EXPERIENCE: Game Feel & Juice)
- UX-DR78: Food drop: piece bounces on landing. Eating: munch particle + munch SFX. (EXPERIENCE: Game Feel & Juice)
- UX-DR79: Death: comedic "baa-thud" SFX, slapstick pose, dust puff, then carcass. (EXPERIENCE: Game Feel & Juice)
- UX-DR80: Sacrifice: cartoon suction, `halo` sparkle, Farm button gold glow. (EXPERIENCE: Game Feel & Juice; DESIGN: Colors)
- UX-DR81: **(Should)** Abomination reveal: true-form flash, screech and sting. (EXPERIENCE: Game Feel & Juice)
- UX-DR82: Breeding: heart pops; lamb arrives 10s later with small poof. Sale: coin popup "$10" (or "$5") and cash-register ding. (EXPERIENCE: Game Feel & Juice)
- UX-DR83: Era change: ~1s crossfade, banner, fanfare (regress: soft descending note). **(Should)** Last sheep: banner + sting. Every juice item has an audio cue. (EXPERIENCE: Game Feel & Juice)

#### Accessibility

- UX-DR84: Reduced motion toggle (Pause → Volume): disables meter shake (flash only), banner slide-in (fade instead), floating popups (fade in place), and any screen shake; never reduces gameplay animation (Abomination off-step walk, thin/droop poses, infection wobble). (EXPERIENCE: Game Feel & Juice, Accessibility Floor)
- UX-DR85: Infection never color-only: green tint backed by bubble-marker shape and alert-ping icon; pings/markers carry 2px bark outline for contrast against grass (infection/alert vs pasture only ~1.5:1). (EXPERIENCE: Accessibility Floor; DESIGN: Colors)
- UX-DR86: Text contrast ≥4.5:1 (≥3:1 large text) per DESIGN contrast table (e.g. bark/wool 12.5, bark/heart 4.8, wool/awning 4.9, bark/alert 3.7 title-size only); a test verifies listed token pairs meet thresholds. (DESIGN: Colors contrast table; EXPERIENCE: Accessibility Floor)
- UX-DR87: Separate Music and SFX volume sliders in Pause → Volume. (EXPERIENCE: Accessibility Floor)
- UX-DR88: Captions toggle (off by default) in Pause → Volume; captioned cues: `[thud]` death, `[frantic bleating]` first starving per minute, `[suction]` sacrifice, `[screech]` Abomination reveal, `[fanfare]` era up, `[descending note]` era down, `[sting] Last sheep!`. (EXPERIENCE: Accessibility Floor)
- UX-DR89: Settings (volumes, reduced motion, captions) persisted separately from the game save; Restart/Start over keep them. (EXPERIENCE: Accessibility Floor)
- UX-DR90: Hit targets ≥40px (`hit-min`), except sheep which use sprite bounds + 6px padding. (DESIGN: Layout; EXPERIENCE: Accessibility Floor)
- UX-DR91: Game pauses whenever tab hidden; `Esc` pauses at any time; no action requires speed beyond the GDD's 120s starvation window. (EXPERIENCE: Accessibility Floor)

#### Copy

- UX-DR92: Death toasts: "{name} starved." / "{name} died of old age. A long, full nine minutes." / "{name} caught the carcass sickness." / Abomination victim "{name} just… fell over." (must not state a cause). (EXPERIENCE: Voice and Tone)
- UX-DR93: Action toasts: sold "{name} sold. $10." / "{name} sold. $5."; sacrifice "{name} went to a Better Place."; reveal innocent "…that was just {name}." ("…that was just a sheep." before names); reveal Abomination: screech then "Good riddance.". (EXPERIENCE: Voice and Tone)
- UX-DR94: Banners: era up "Village" / "Town" / "Wool Empire"; era regress "Back to {era}."; "Last sheep!" (Should). (EXPERIENCE: Voice and Tone)
- UX-DR95: Screen strings: "Paused"; "Shop"; start-over "Start over? Your flock will be lost." · "Cancel" · "Start over"; lose "The flock is gone." · "Survived {mm:ss} · Peak flock {n}" · "Restart"; menu labels "Continue", "New Game", "Credits", "Resume", "Volume", "Stats", "Restart", "Back", "Main Menu"; shop "Owned", "Needs Land {n}". (EXPERIENCE: Voice and Tone, IA, Component Patterns; DESIGN: Components)
- UX-DR96: HUD strings: Breed greyed tooltips "No room. Buy land." / "Needs 2 ready sheep."; invalid sell tag "Too young"; drop labels "$10"/"$5" and "+2× food"; button labels "Farm" (F), "Farm Breeding Food" (G), "Breed"; button tooltips per UX-DR75; threat hover "{n} starving" (and equivalents); sheep tooltip "{Stage} · {Hunger}". (EXPERIENCE: Voice and Tone, Component Patterns)
- UX-DR97: Copy rules: centralise strings in one module; sheep always named once names exist (Should), "A sheep" before; no exclamation marks except "Last sheep!"; banned words "corpse", "blood", "kill" (carcass is strongest allowed); no tutorial text beyond labels and tooltips. (EXPERIENCE: Voice and Tone)

#### Layout

- UX-DR98: Canvas fixed 16:9, base 1280×720, Phaser Scale FIT, centred, letterboxed in `dusk-deep`; everything (incl. menus) drawn in-canvas, no DOM UI; one gameplay screen; the field camera opens centred on the pen above the bottom bar and right-drag pans it, pinned to the pen (changed 2026-10-06, Rylan; HUD and menus never move). (EXPERIENCE: Foundation, Responsive & Platform)
- UX-DR99: Minimum supported window 960×540 (text floor guaranteed down to this); below it canvas keeps scaling; no mobile adaptation; desktop Chrome/Firefox/Edge. itch.io embed 1280×720 with fullscreen button. (EXPERIENCE: Responsive & Platform, Foundation)
- UX-DR100: `pixelArt: true` (nearest-neighbour) for sprites; no smoothing on pixel art. (EXPERIENCE: Responsive; DESIGN: Do's)
- UX-DR101: Positions: 16px safe margin from canvas edge; Pause button top-left (added 2026-10-06); bottom bar full-width 112px; era badge top-right; toasts top-centre; era banner across upper field; captions bottom-centre above bar; shop panel left, rising from bar; Better Place upper-left (~x 450–590); Market right edge outside fence; no HUD floats over mid-field. (DESIGN: Layout & Spacing; EXPERIENCE: HUD & Diegetic UI; mockups/hud.html)

### FR Coverage Map

FR1: Epic 1 - Fullness drain and starvation
FR2: Epic 1 - Fed / Hungry / Starving states
FR3: Epic 1 - Farm button and progress bar (drops food)
FR4: Removed 2026-10-06
FR5: Epic 1 - Sheep seek and eat food
FR6: Epic 2 - GDD starting flock (Epic 1 uses an interim 3-adult flock)
FR7: Epic 2 - Life stages and old-age death
FR8: Epic 2 - Farm Breeding Food bar (drops breeding pieces)
FR8a: Epic 2 - Adults eat breeding food and become ready
FR9: Epic 2 - Breed tool and gestation
FR10: Epic 2 - Breeding cooldown
FR11: Epic 2 - Breeding blocked at capacity / fewer than 2 ready adults
FR12: Epic 2 - Carcass on every non-sacrifice death
FR13: Epic 2 - Click to clear carcass
FR14: Epic 2 - Starving sheep eat carcasses when no food
FR15: Epic 2 - Virus infection and death
FR16: Epic 2 - Drag vs click threshold
FR17: Epic 3 - Market selling
FR18: Epic 2 - Better Place sacrifice
FR19: Epic 2 - Sacrifice food boost
FR20: Epic 2 (sacrifice) / Epic 3 (sell) - No confirmations
FR21: Epic 3 - Money
FR22: Epic 3 - Land tiers and fence growth
FR23: Epic 3 - Decorations
FR24: Epic 4 - Better Hoe upgrades
FR25: Epic 4 - Auto-feeder
FR26: Epic 4 - Medicine
FR27: Epic 3 - Derived eras
FR28: Epic 3 - Era transitions and regression
FR29: Epic 4 - Abomination spawn rules
FR30: Epic 4 - Abomination traits
FR31: Epic 4 - Kill cycle and delayed death
FR32: Epic 4 - Abomination tells
FR33: Epic 4 - Sacrifice reveal
FR34: Epic 4 - Overcrowding infection
FR35: Epic 5 - Sheep names
FR36: Epic 5 - Stats panel
FR37: Epic 5 - "Last sheep!" warning
FR38: Epic 1 - Loss at 0 sheep and lose screen
FR39: Epic 1 - Open-ended (no win state)
FR40: Epic 1 - Autosave and resume
FR41: Epic 1 - Hidden-tab pause
FR42: Epic 1 (stage, hunger) / Epic 5 (name) - Sheep tooltip
FR43: Epic 1 - F / G / Esc shortcuts
FR44: Epic 1 (pause menu) / Epic 5 (credits)

## Epic List

### Epic 1: Flock Survival Core (Must)
Players open the game from a title screen and keep a small flock alive by farming and dropping food — or watch it starve and lose. Progress saves and the game pauses on a hidden tab. Establishes the starter template, sim core, tokens, widgets, input controller, saving and debug overlay.
**FRs covered:** FR1, FR2, FR3, FR5, FR38, FR39, FR40, FR41, FR42 (stage/hunger), FR43, FR44 (pause menu)

### Epic 2: Life, Death & Contagion (Must)
Sheep are born, age and die; neglect spreads a carcass → infection chain, which the player breaks by clearing carcasses or sacrificing infected sheep in the Better Place. Includes the colour-independent infection cue, alert pings and threat summary.
**FRs covered:** FR6, FR7, FR8, FR8a, FR9, FR10, FR11, FR12, FR13, FR14, FR15, FR16, FR18, FR19, FR20 (sacrifice)

### Epic 3: Economy & Eras (Must — MVP complete)
Players sell sheep for money, buy land and decorations, and watch the pasture move through four eras (which can regress). Ends with the first pacing playtest.
**FRs covered:** FR17, FR20 (sell), FR21, FR22, FR23, FR27, FR28

### Epic 4: Hidden Threats & Upgrades (Should)
An attentive player can spot and remove the Abomination, cure infections with medicine, manage overcrowding, and buy click upgrades and the auto-feeder.
**FRs covered:** FR24, FR25, FR26, FR29, FR30, FR31, FR32, FR33, FR34

### Epic 5: Names, Feel & Ship (Should + polish)
The flock feels personal and the game feels finished: names, stats, last-sheep warning, juice, audio, accessibility options (Volume panel, reduced motion, captions) and credits, deployed to GitHub Pages and itch.io. **Deployment stories come first** and may be pulled forward to run straight after Epic 3, so a playable build is online early.
**FRs covered:** FR35, FR36, FR37, FR42 (name), FR44 (credits)

**Dependencies:** Epic 1 → 2 → 3 → 4 → 5; each epic is playable without later epics. Epic 5's deployment stories depend only on Epic 1.


## Epic 1: Flock Survival Core

Players open the game from a title screen and keep a small flock alive by farming and dropping food — or watch it starve and lose. Progress saves and the game pauses on a hidden tab. Establishes the starter template, sim core, tokens, widgets, input controller, saving and debug overlay.

### Story 1.1: Scaffold the Project from the Phaser Template

As a developer,
I want the project scaffolded from the official Phaser 4 + Vite + TypeScript template with our tooling, folders and tokens in place,
So that every later story builds on the agreed stack and boundaries.

**Acceptance Criteria:**

**Given** an empty `src/` in the repo
**When** the project is created with `npm create @phaserjs/game@latest` (Web Bundler → Vite → TypeScript) and merged into the repo root
**Then** `package.json` pins Phaser 4.2.x, Vite 8.x, TypeScript 6.x (`strict: true`) and Vitest 4.1.x, `.nvmrc` is `24`, and the template's sample scenes are removed
**And** npm scripts `dev`, `build`, `preview`, `test`, `lint`, `typecheck`, `assets`, `zip` exist (`zip` may be a stub that exits 0 until Story 5.2)

**Given** the scaffold
**When** `npm run dev` is opened in Chrome
**Then** a 1280×720 canvas (`Phaser.AUTO`, `pixelArt: true`, Scale `FIT` + `CENTER_BOTH`, no physics) shows a `BootScene` with the `dusk` background, letterboxed in `dusk-deep` (UX-DR98, UX-DR100, NFR5, AR2)
**And** `vite.config.ts` sets `base: './'`

**Given** the folder layout in the architecture's Project Structure
**When** the story is complete
**Then** `src/config/constants.ts` exports `TICK_MS = 100`, canvas size, storage keys, `SAVE_SCHEMA_VERSION = 1`, and `COLORS` with the 20 DESIGN.md colour tokens plus typography, radius and spacing tokens, the typography-role mapping and component-spec constants mirroring DESIGN.md `components` (UX-DR1, UX-DR3, UX-DR4, UX-DR6, UX-DR7, AR13)
**And** a short comment block in `constants.ts` records the colour-usage rules (money = `hay`, boost = `halo`, `awning` never for alerts, `alert` never for Market, `void` never for panels, `infection` never on healthy things) (UX-DR2)
**And** `src/config/tuning.ts` exists as a frozen object (values added by later stories)
**And** `src/core/` contains `log.ts` (tagged levels; `debug`/`info` stripped in production), `invariant.ts` (throws in DEV, logs in production), `format.ts` (`formatGameTime`, `formatMoney`) and `eventBus.ts` (typed), each with unit tests (AR14)

**Given** ESLint with typescript-eslint
**When** `npm run lint` runs
**Then** imports of `phaser`, `src/view`, `src/save`, `src/input` and use of `Math.random`, `Date.now`, `window`, `document`, `localStorage` inside `src/sim/` or `src/core/` are errors
**And** `npm test`, `npm run typecheck` and `npm run lint` all pass (AR1, AR16, AR24)

**Given** Pixelify Sans and Nunito WOFF2 files in `public/assets/fonts/`
**When** `main.ts` boots
**Then** both fonts are loaded via the CSS Font Loading API before the Phaser game is created, with no requests to Google Fonts

### Story 1.2: Simulation Core and Game Clock

As a player,
I want the pasture to run on a steady game clock with my starting flock on screen,
So that the game behaves the same on any monitor and can later be saved exactly.

**Acceptance Criteria:**

**Given** `src/sim/state.ts`
**When** `createNewGame(seed)` is called
**Then** it returns a plain-data `GameState` (`time`, `nextId`, `rng`, `sheep[]`, `food` (removed 2026-10-06), `foodPieces[]`, `carcasses[]`, `stats`, `lastEra`) with 3 adult sheep at Fullness 60 placed inside the starting fence and 5 food (interim Epic 1 flock; FR6 is completed in Epic 2)
**And** `JSON.parse(JSON.stringify(state))` deep-equals `state` (NFR6, AR3)

**Given** `src/sim/rng.ts`
**When** the same seed is used twice
**Then** the mulberry32 sequence is identical, and the RNG state is stored in `state.rng` (AR10)

**Given** `step(state)` and `applyCommand(state, cmd)` with typed `Command` and `SimEvent` unions and a per-tick event queue kept outside `GameState`
**When** `step` runs
**Then** `state.time` advances by exactly `TICK_MS` and systems run in the fixed order declared in `step.ts`
**And** `switch` statements over the unions end in `assertNever` (AR7)

**Given** `GameScene`
**When** frames of any length arrive
**Then** an accumulator runs whole ticks only, clamping each frame's delta to 250 ms, and a test helper `runFor(state, ms)` exists for sim tests (AR4)

**Given** the starting flock
**When** the game scene renders
**Then** each sheep appears via a pooled sprite reconciled by id through `EntityLayer` (N3), with no game data stored on sprites (AR19)

**Given** source PNGs in `assets/art/{sheep,world,ui}/` (Kenney or placeholder art)
**When** `npm run assets` runs `scripts/build-assets.ts`
**Then** free-tex-packer-core packs the `sheep-world` and `ui` atlases (JSON-hash, ≤ 2048², kebab-case `entity-state[-n]` frame names) into `public/assets/atlases/`, and `PreloadScene` loads them behind a loading bar on `dusk` before `TitleScene`/`GameScene` start, finishing in under 5 s on broadband (AR6, AR11, UX-DR11)

### Story 1.3: Sheep Wander the Pasture

As a player,
I want my sheep to wander naturally inside the fence without piling on top of each other,
So that the flock feels alive and readable at a glance.

**Acceptance Criteria:**

**Given** sheep in the `wander` activity
**When** the sim steps
**Then** each sheep moves by steering (wander + separation + fence containment) at the walk speed from `TUNING` (60 px/s), never leaving the fenced area

**Given** two sheep closer than the 24 px personal-space radius (`TUNING`)
**When** ticks run
**Then** separation pushes them apart, using neighbour queries from the 48 px uniform grid in `sim/grid.ts` rebuilt once per tick (never an all-pairs loop) (AR5)

**Given** the 10 Hz sim and a 60 Hz display
**When** sheep move
**Then** rendering interpolates between the previous and current tick positions stored on the sprites, so motion is smooth with no `prevX/prevY` in `GameState`

**Given** a seeded scenario test with 100 sheep
**When** 600 ticks run
**Then** all sheep remain inside the fence and the run is deterministic for the same seed

### Story 1.4: Developer Debug Overlay and Error Safety Net

As a developer,
I want an in-game debug overlay and a global error handler,
So that I can speed up, inspect and reproduce the simulation while players never see a stack trace.

**Acceptance Criteria:**

**Given** a DEV build
**When** I press backtick
**Then** an overlay shows FPS, frame time and sheep/food/carcass counts, with controls for sim speed ×1/×4/×16, pause, step one tick, add food, dump `GameState` to console, and copy/load save JSON via the clipboard (AR15)

**Given** a production build (`vite build`)
**When** the bundle is inspected
**Then** the debug module is absent (imported only behind `import.meta.env.DEV`)

**Given** an unhandled error or rejection
**When** it occurs
**Then** the global handler logs it via `log.error`; in production it shows the toast "Something went wrong — your flock was saved." and the game keeps running (save forcing is wired once saving exists in Story 1.9)

### Story 1.5: Hunger and Starvation

As a player,
I want to see my sheep get hungry and starve if I neglect them,
So that I feel the pressure to pay attention.

**Acceptance Criteria:**

**Given** a sheep at Fullness 100
**When** 120 game-seconds pass with no food
**Then** its Fullness reaches 0 and it dies (FR1); drain rate comes from `TUNING`

**Given** Fullness values
**When** the view renders a sheep
**Then** hunger state is derived (never stored): Fed > 50 normal walk, Hungry 50–25 drooping posture, Starving < 25 thin sprite (FR2, UX-DR57)

**Given** a sheep that reaches 0 Fullness
**When** it dies
**Then** death goes through `killSheep(state, id, 'starved')` (N1), which removes it, increments `stats.died`, emits `SheepDied`, and skips the carcass because `TUNING.carcassesEnabled` is `false` in Epic 1
**And** no other code removes sheep from `state.sheep`

**Given** the pointer hovers a sheep for ~300 ms
**When** the tooltip appears
**Then** it shows "{Stage} · {Fed|Hungry|Starving}" (e.g. "Adult · Hungry") in the `tooltip` style, follows the sheep, and reads from the `PublicSheep` selector (FR42 partial, UX-DR43)

**Given** a seeded test starting at Fullness 60
**When** `runFor(state, TUNING.starveMs)` runs with no food
**Then** all three sheep have died and `SheepDied` events were emitted

### Story 1.6: HUD Bottom Bar, Farm Button and Food Meter

As a player,
I want a Farm button and a food meter in a bottom bar,
So that I can grow food to feed my flock.

**Acceptance Criteria:**

**Given** the game is running
**When** `HudScene` is launched in parallel with `GameScene`
**Then** a 112 px full-width `wool` bottom bar is drawn with the Farm button at the left and the food meter beneath it, using `COLORS` and shared widgets (`Button`, `Panel`, `Tooltip`) in `src/view/widgets/`, respecting the 16 px safe margin and the layout positions in DESIGN.md (UX-DR25, UX-DR8, UX-DR9, UX-DR101)

**Given** food below 20
**When** I click Farm or press `F`
**Then** a `Farm` command adds 1 food (FR3), the button squashes, a "+1" float popup rises ~24 px and fades over 600 ms, and the meter updates the same frame (UX-DR26, UX-DR44, UX-DR77)

**Given** food at 20
**When** I farm
**Then** the button still squashes but no popup appears and the meter does a small bump

**Given** I hold `F`
**When** the key repeats
**Then** only one Farm action occurs per key press (`event.repeat` ignored) (FR43, UX-DR72)

**Given** the food meter
**When** it renders
**Then** it shows 20 discrete `hay` pips on a `wool-shade` track and "{n}/20" in numeric type (UX-DR29); the Farm tooltip reads "Farm: +1 food (F)" (UX-DR75)
**And** all player-facing strings, including HUD labels and tooltips, come from `src/view/strings.ts` (AR22, UX-DR96)

> **Note (2026-10-06):** superseded in part by sprint-change-proposal-2026-10-06: the Farm rule (FR3) and the food meter (UX-DR29) are reworked in Story 1.7.

### Story 1.7: Drop Food and Sheep Eat

As a player,
I want each full Farm bar to drop food in the pen that hungry sheep walk to and eat,
So that I can keep my flock alive.

> Changed 2026-10-06 (sprint-change-proposal-2026-10-06 and its addendum): there is no food stock and no click-to-drop. Food comes only from the Farm bar.

**Acceptance Criteria:**

**Given** the Farm button
**When** I click Farm or press `F` 8 times
**Then** each click fills one pip of the 8-pip Farm progress bar and its count "{n}/8" (squash, same-frame update); the 8th drops 1 food piece at a random reachable spot in the pen, which bounces on landing (UX-DR78), resets the bar to "0/8" and pops "+1" (FR3, UX-DR26, UX-DR29)

**Given** a food piece in the pen
**When** the sim steps
**Then** the nearest sheep with Fullness < 90 switches to `seekFood`, walks to the nearest piece and eats it for +35 Fullness capped at 100, with a munch particle (FR5, UX-DR78)
**And** uneaten pieces stay in the pen indefinitely, with no cap, so food can be stockpiled there

**Given** a click on the field or on a sheep in `idle` mode
**When** it is released
**Then** nothing happens (UX-DR65)

**Given** the HUD
**When** it renders
**Then** under Farm it shows the 8-pip progress bar and its count "{n}/8" (starting at "0/8"); the Farm tooltip reads "Farm: fill the bar for 1 food (F)" (UX-DR29, UX-DR75)

**Given** a seeded scenario
**When** a starving sheep has a piece land beside it
**Then** it eats within the expected travel time and its hunger state returns to Fed

### Story 1.8: Losing the Flock

As a player,
I want a clear lose screen when my last sheep dies,
So that I know the run is over and can start again.

**Acceptance Criteria:**

**Given** the flock drops to 0 sheep
**When** `checkLastSheepAndLoss` runs inside `killSheep`
**Then** the sim stops, a `Lost` event fires, and `OverlayScene` shows the `menu-scrim` and `lose-panel` (FR38, UX-DR19)

**Given** the lose panel
**When** it renders
**Then** it shows "The flock is gone." in display type and "Survived {m:ss} · Peak flock {n}" in `halo`, using `formatGameTime` and a peak-flock stat tracked in state

**Given** the lose panel
**When** I click **Restart**
**Then** a new game starts immediately with no confirmation

**Given** the game is running
**When** no loss has occurred
**Then** there is no win state or end screen (FR39)

### Story 1.9: Save, Resume and Hidden-Tab Pause

As a player,
I want my flock saved automatically and the game to pause when I switch tabs,
So that I never lose progress or lose sheep while away.

**Acceptance Criteria:**

**Given** play is running
**When** 10 real seconds pass, or the tab becomes hidden
**Then** `saveStore` writes `{ schemaVersion, savedAt (ISO), state }` to `localStorage['sheepciv.save.v1']` (FR40, AR9)

**Given** a valid save exists
**When** the game loads
**Then** the save is parsed, migrated if older, validated and play resumes exactly where it stopped (same sheep, Fullness, food and time)

**Given** a corrupt or unreadable save, or storage that throws
**When** the game loads
**Then** `log.warn('save', …)` is recorded, the save is discarded and only New Game is offered; the game never crashes (AR9)

**Given** the tab becomes hidden
**When** `visibilitychange` fires
**Then** sim accumulation stops completely, a save is forced, and on return play resumes with no overlay and a reset frame delta (FR41, UX-DR62, AR25)

**Given** settings (`sheepciv.settings`) and the save
**When** Restart wipes the save
**Then** settings are kept (UX-DR89)

**Given** the global error handler from Story 1.4
**When** an unhandled error occurs in production
**Then** it now forces a save before showing the toast

**Given** save tests
**When** `npm test` runs
**Then** a busy seeded scenario round-trips through JSON unchanged, 10 save/load cycles produce identical state (NFR7), and a corrupt-save test falls back cleanly (AR12)

### Story 1.10: Title Screen, Pause Menu and Start-Over Confirm

As a player,
I want a title screen to continue or start a game and a pause menu I can open with Esc,
So that I can control my session.

**Acceptance Criteria:**

**Given** the game loads
**When** `TitleScene` shows
**Then** the title logo appears in display type over a lighter `menu-scrim-start` (40%) with decorative sheep wandering behind, and `button-menu` buttons **Continue** (only if a save exists, listed first — hidden, not greyed, otherwise), **New Game** and **Credits** (Credits shows a placeholder panel until Epic 5) (UX-DR12, UX-DR21)

**Given** a save exists
**When** I click **New Game**
**Then** the start-over confirm appears: "Start over? Your flock will be lost." with **Cancel** (left, `button-menu`) and **Start over** (right, `button-menu-destructive`) (UX-DR13, UX-DR18)
**And** **Start over** wipes the save and starts a new game; **Cancel** or `Esc` returns to the title

**Given** play is running
**When** I press `Esc`
**Then** the pause menu opens: panel headed "Paused" over the 72% `menu-scrim` and a frozen (still rendered) field, with **Resume, Volume, Stats, Restart, Credits** (Volume/Stats/Credits show placeholder panels until later epics); sim accumulation stops without calling `scene.pause()` on `GameScene` (UX-DR14, FR44 partial)
**And** `Esc` or **Resume** returns to play; **Restart** opens the start-over confirm

**Given** any modal
**When** it is open
**Then** it is one centred panel; clicking the scrim does nothing; modals replace each other and never stack; `F`/`G` shortcuts are ignored (UX-DR20)

**Given** all menu and screen strings ("Paused", "Continue", "New Game", "Credits", "Resume", "Volume", "Stats", "Restart", "Back", the confirm copy)
**When** they render
**Then** they come from `strings.ts` exactly as written in EXPERIENCE.md (UX-DR95)

**Given** a mouse-only player
**When** they use the game
**Then** every action is reachable by left-click, drag or right-click, `Esc` pauses at any time, and no action needs speed beyond the 120 s starvation window (UX-DR76, UX-DR91)

**Given** the `Esc` priority chain in `InputController`
**When** `Esc` is pressed
**Then** it follows the agreed chain (FR43): close start-over confirm → close sub-panel → cancel drag → exit breed mode → close shop → open/close pause (drag, breed mode and shop arrive in later epics and plug into this chain) (UX-DR73)

## Epic 2: Life, Death & Contagion

Sheep are born, age and die; neglect spreads a carcass → infection chain, which the player breaks by clearing carcasses or sacrificing infected sheep in the Better Place. Includes the colour-independent infection cue, alert pings and threat summary.

### Story 2.1: Life Stages and the GDD Starting Flock

As a player,
I want my sheep to grow from lambs to adults to elders and eventually die of old age,
So that every sheep has a lifespan I must plan around.

**Acceptance Criteria:**

**Given** a sheep record with `bornAt`
**When** the view or sim needs its stage
**Then** stage is derived from age: Lamb 0–60 s, Adult 60–420 s, Elder 420–540 s (thresholds in `TUNING`) and never stored (FR7)

**Given** an elder reaching 540 s of age
**When** the sim steps
**Then** it dies through `killSheep(state, id, 'oldAge')` (FR7)

**Given** stage visuals
**When** sheep render
**Then** lambs use the smaller sprite, adults the normal sprite and elders a greyer sprite; the tooltip shows the stage (UX-DR58)

**Given** `createNewGame(seed)`
**When** a new game starts
**Then** the flock is 2 adults aged 60 s plus 1 newborn lamb, all at Fullness 60, with an empty Farm bar (FR6; the breeding bar arrives in 2.2), replacing the Epic 1 interim flock
**And** `SAVE_SCHEMA_VERSION` is bumped with a migration if the state shape changed

**Given** a seeded test
**When** `runFor` reaches ~6 min with the flock fed
**Then** both founding adults have become elders at ~4 min and died of old age at ~6 min

### Story 2.2: Farm Breeding Food

As a player,
I want a second farm button that fills a bar and drops breeding food into the pen,
So that my adults can eat it and become ready to breed.

> **Changed 2026-10-06** (sprint-change-proposal-2026-10-06-breeding-food.md): breeding food works like the Farm bar and drops pieces that adults eat; there is no breeding stock.

**Acceptance Criteria:**

**Given** the bottom bar
**When** it renders
**Then** a Farm Breeding Food button (`button-breed-food`: heart fill, heart-deep border, label "Farm Breeding Food", key hint "G") sits right of Farm, with a breeding progress bar beneath it: 8 `heart` pips and "{n}/8" in numeric type, starting at "0/8" (UX-DR28, UX-DR30)

**Given** the button
**When** I click it or press `G`
**Then** a `FarmBreeding` command fills 1 pip (FR8), with Farm's squash and a same-frame bar update; holding `G` gives one action per press (FR43)
**And** a full bar resets (keeping leftover pips) and drops a breeding-food piece at a seeded-random reachable spot in the pen, with a landing bounce and a "+1" popup over the button (UX-DR30a, UX-DR44)
**And** the bar is never boosted; there is no cap and pieces never spoil

**Given** breeding pieces in the pen
**When** an adult is not ready and not on breeding cooldown
**Then** the nearest such adult walks to the nearest piece and eats it, becomes ready (`breedReady`) and gains no Fullness; lambs, elders and ready adults ignore pieces (FR8a)
**And** a sheep that would seek food (Fullness < 90 and a food piece exists) seeks food first; breeding pieces never count as food for carcass eating (FR14)

**Given** a ready sheep
**When** it renders
**Then** a small heart icon shows above it until it breeds or turns elder; turning elder clears `breedReady` (FR8a, UX-DR30a)

**Given** the button tooltip
**When** hovered
**Then** it reads "Farm Breeding Food: fill the bar for 1 breeding food (G)" (UX-DR75)

**Given** a save from before this change
**When** it loads
**Then** it migrates with an empty breeding bar, no pieces and no sheep ready (`SAVE_SCHEMA_VERSION` bump)

### Story 2.3: Breed Two Adults

As a player,
I want to pick two adults with a Breed tool to make a lamb,
So that I can grow my flock.

**Acceptance Criteria:**

**Given** the Breed tool (`button-breed-tool`: wool fill, heart-deep border, heart icon, label "Breed") right of the breeding progress bar
**When** I click it with at least 2 ready adults and free capacity
**Then** `InputController` enters `breeding` mode: the button fills `heart-deep` with a `wool` label, the cursor becomes a heart, and ready adults show a soft heart marker (UX-DR31, UX-DR69)

**Given** breeding mode
**When** I click ready adult A then ready adult B
**Then** A gets a pinned heart, a `Breed` command clears both sheep's `breedReady` and starts their cooldown, a heart floats between them, a pregnancy `{ parentA, parentB, dueAt, x, y }` is added to `state.pregnancies`, and breed mode exits (FR9, UX-DR70)
**And** 10 s later a lamb is born beside them with a small poof and a `LambBorn` event (UX-DR56, UX-DR82)

**Given** breeding mode
**When** I click an ineligible sheep (not a ready adult)
**Then** it shakes and breed mode stays active; clicking empty field drops no food (UX-DR70)

**Given** breeding mode
**When** I right-click, press `Esc` or click Breed again
**Then** breed mode is cancelled, using the agreed `Esc` chain position (UX-DR71, UX-DR73, UX-DR74)

**Given** a parent that just bred
**When** 60 s have not yet passed (`cooldownUntil`)
**Then** it cannot breed and its tooltip shows the heart-outline icon (FR10)

**Given** living sheep + pending pregnancies equal capacity (10 before land), or fewer than 2 adults are ready
**When** the HUD renders
**Then** Breed is greyed (`button-disabled`) with tooltip "No room. Buy land." or "Needs 2 ready sheep.", and an active breed mode exits (FR11, UX-DR31, UX-DR32)
**And** capacity is computed by a selector as living sheep + `state.pregnancies.length` (AR21)

### Story 2.4: Carcasses and Death Announcements

As a player,
I want every death to leave a carcass I can click away, with a short announcement,
So that I notice deaths and can keep the pasture clean.

**Acceptance Criteria:**

**Given** `TUNING.carcassesEnabled = true`
**When** a sheep dies of starvation or old age
**Then** `killSheep` creates a carcass at its position with an X-eyes sprite, a dust puff and a slapstick pose, with no gore (FR12, NFR10, UX-DR59, UX-DR79, AR17)

**Given** a carcass
**When** I left-click it
**Then** a `ClearCarcass` command removes it (FR13); carcasses never disappear on their own

**Given** a `SheepDied` event
**When** the HUD receives it
**Then** an announcement toast (`announcement-toast`: dusk card, wool body text) shows at top-centre — "A sheep starved." / "A sheep died of old age. A long, full nine minutes." — up to 3 stacked, newest on top, ~4 s each, never blocking clicks (UX-DR41, UX-DR92; names arrive in Epic 5)

**Given** the hover tooltip
**When** I hover a carcass
**Then** no sheep tooltip is shown

### Story 2.5: Carcass Eating and the Virus

As a player,
I want starving sheep to eat carcasses and catch a deadly virus,
So that neglect spreads and I have to break the chain.

**Acceptance Criteria:**

**Given** a Starving sheep (Fullness < 25) and no food piece on the field
**When** a carcass exists
**Then** the sheep switches to `seekCarcass`, walks to the nearest carcass and eats it, removing it (FR14)
**And** if any food piece exists, it seeks food instead

**Given** a sheep eats a carcass
**When** it finishes
**Then** it is infected 100% of the time (`infectedAt` set), emits `Infected`, and dies of the virus 20 s later via `killSheep(…, 'virus')`, leaving a new carcass (FR15)

**Given** an infected sheep
**When** it renders
**Then** it shows the `infection` tint (via `setTint` + `setTintMode`, Phaser 4) **plus** the bobbing three-bubble `infection-marker` with a bark outline **plus** a sickly wobble walk — never colour alone (UX-DR55, UX-DR58, UX-DR85)

**Given** a virus death
**When** the toast appears
**Then** it reads "A sheep caught the carcass sickness." (UX-DR92)

**Given** a seeded scenario: an unfed flock with one carcass
**When** the sim runs
**Then** the chain death → carcass → starving eats → infected → death → carcass is observed, and clearing the carcass early prevents it

### Story 2.6: Alert Pings and Threat Summary

As a player,
I want threats to ping on the field and a live threat count in the HUD,
So that I can spot problems across a big flock.

**Acceptance Criteria:**

**Given** a sheep enters Starving, a sheep becomes infected, or a carcass spawns
**When** the event occurs
**Then** an `alert-ping` (20 px `alert` circle, wool "!" glyph, 2 px bark outline) pops above it, bobs ~3 s, then settles to a small static dot until the state resolves (UX-DR54)
**And** pings draw above the HUD panels layer (world-overlay layer) (UX-DR10)

**Given** the bottom bar
**When** it renders
**Then** a `threat-summary` shows three icon + count pairs — Starving, Infected, Carcasses — updated live; zero counts dim to `disabled-ink`; hovering a count shows e.g. "2 starving"; clicking does nothing (UX-DR39)

**Given** these surfaces
**When** they are built
**Then** they read only from selectors / `PublicSheep`, so the Abomination (Epic 4) can never be pinged or counted separately (UX-DR64)

### Story 2.7: Drag a Sheep into the Better Place

As a player,
I want to drag any sheep into the Better Place to remove it and get a food boost,
So that I can stop an infection and feed a big flock faster.

**Acceptance Criteria:**

**Given** the field
**When** it renders
**Then** the Better Place is a fixed round hole (`void` interior, `halo` rim) in the upper-left quadrant (~x 450–590) (UX-DR47, UX-DR48)

**Given** I press on a sheep and move more than 6 px
**When** `InputController` detects the drag
**Then** it enters `dragging` mode: the sheep lifts 4 px with legs dangling and stops wandering (`activity = 'dragged'`), its tooltip hides, and the Better Place highlights (`halo` ring brightens, `haze` glow, label "+2× food"), intensifying while hovered (FR16, UX-DR52, UX-DR60, UX-DR66, UX-DR67)

**Given** I release the sheep in the Better Place
**When** the `Sacrifice` command applies
**Then** the sheep is removed via `removeSheep` with **no carcass** and no confirmation, `stats.sacrificed` increments, a `Sacrificed { wasAbomination }` event fires, and a cartoon suction with a `halo` sparkle plays; the toast reads "A sheep went to a Better Place." (FR18, FR20, UX-DR68, UX-DR80, UX-DR93)
**And** removing the last sheep this way triggers the loss (AR17)

**Given** I release on the field or outside the fence
**When** the drop resolves
**Then** the sheep is placed where dropped, or at the nearest point inside the fence (UX-DR67)

**Given** a drag in progress
**When** I press `Esc`
**Then** the drag cancels and the sheep returns to where it was picked up

### Story 2.8: Sacrifice Food Boost

As a player,
I want each sacrifice to double my Farm clicks for 30 seconds,
So that the dark choice has a real payoff.

**Acceptance Criteria:**

**Given** a sacrifice
**When** `Sacrificed` applies
**Then** `boostUntil = time + 30 s` and each Farm click fills 2× the current pips until then (FR19)
**And** a sacrifice during an active boost resets the timer to 30 s; boosts never stack

**Given** an active boost
**When** the HUD renders
**Then** Farm uses `button-farm-boosted` (pulsing `halo` glow, `void` badge "×2"), each click visibly fills double pips, and a `boost-timer` pill shows "×2 0:{ss}" counting down; a reset pops the pill; both disappear when the boost ends (UX-DR27, UX-DR38)

**Given** a boost
**When** I farm breeding food
**Then** each click still fills 1 breeding pip (FR8)

**Given** a seeded test
**When** a sacrifice happens, then 29 s and 31 s pass
**Then** a Farm click fills 2 pips at 29 s and 1 pip at 31 s; a second sacrifice at 20 s extends the boost to 50 s total

## Epic 3: Economy & Eras

Players sell sheep for money, buy land and decorations, and watch the pasture move through four eras (which can regress). Completes the MVP and ends with the first pacing playtest.

### Story 3.1: Sell Sheep at the Market

As a player,
I want to drag adults and elders onto the Market stall to sell them,
So that I can earn money — at the cost of a smaller flock.

**Acceptance Criteria:**

**Given** the field
**When** it renders
**Then** the Market stall is a wooden red-and-cream striped rectangular stall on the right edge, outside the fence, reading as the opposite of the Better Place in hue, value, shape and motion (UX-DR46, UX-DR48)

**Given** I start dragging any sheep
**When** the drag begins
**Then** both drop targets highlight together: the Market shows a pulsing `awning` outline with a price tag "$10" (adult) or "$5" (elder), and the Better Place highlights as before; the hovered target intensifies (awning flaps, tag grows) (UX-DR51, UX-DR67)

**Given** I drop an adult or elder on the Market
**When** the `Sell` command applies
**Then** the sheep is removed via `removeSheep` with no carcass and no confirmation, money increases by $10 / $5, `stats.sold` increments, a "$10"/"$5" coin popup and cash-register ding play, and the toast reads "A sheep sold. $10." / "A sheep sold. $5." (FR17, FR20, FR21, UX-DR82, UX-DR93)
**And** selling the last sheep triggers the loss

**Given** I drag a lamb over the Market
**When** it hovers
**Then** the target desaturates to `disabled` with the tag "Too young", and dropping there bounces the lamb back onto the field (FR17, UX-DR53)

**Given** a misdrop (sheep meant for the Better Place lands on the Market, or vice versa)
**When** it resolves
**Then** the action happens as dropped — no confirm, no undo (UX-DR68)

### Story 3.2: Money and the Shop Panel

As a player,
I want to see my money and open a shop panel,
So that I can spend earnings while keeping an eye on the flock.

**Acceptance Criteria:**

**Given** the bottom bar
**When** it renders
**Then** a `money-counter` shows a hay coin icon and "${n}" via `formatMoney` (no K/M notation), and a `shop-toggle` ("Shop", wood fill; open state hay fill + bark label) sits at the right end (UX-DR34, UX-DR40)

**Given** I click the Shop toggle
**When** the panel opens
**Then** a 360 px `shop-panel` with header "Shop" rises from the bottom bar on the left, never covering the Market, the Better Place or toasts, and the sim **keeps running** (UX-DR23, UX-DR63)
**And** `Esc` closes it at its position in the agreed chain; clicking the toggle again closes it

**Given** a shop row (`shop-item-row`, 56 px)
**When** it renders
**Then** line 1 shows icon, name and price; line 2 shows the one-line effect in caption type; unaffordable rows stay visible with name, effect and price greyed to `disabled-ink` (UX-DR24)

**Given** an affordable row
**When** I click it
**Then** a `Buy` command applies immediately with no confirmation, money ticks down, and one-time items show "Owned" (UX-DR24, UX-DR68)

**Given** the shop is open
**When** threats occur
**Then** alert pings still draw above the panel

### Story 3.3: Buy Land and Grow the Fence

As a player,
I want to buy land that visibly expands my fence and raises capacity,
So that my flock can grow.

**Acceptance Criteria:**

**Given** the shop
**When** it lists land
**Then** Land I ($50), Land II ($150), Land III ($400) appear in order; a tier whose predecessor isn't owned shows "Needs Land {n}" and cannot be bought (FR22, UX-DR24)

**Given** I buy a land tier
**When** the purchase applies
**Then** capacity rises 10 → 25 → 50 → 100 and the fence visibly expands in place (FR22, UX-DR49)

**Given** the bottom bar
**When** it renders
**Then** a `flock-counter` shows a sheep icon and "{alive}/{capacity}" (UX-DR35); capacity checks for breeding use living sheep + pregnancies

**Given** sheep already in the pasture (fences only ever grow)
**When** land is bought
**Then** existing sheep keep their positions and can now wander the larger area

### Story 3.4: Decorations

As a player,
I want to buy a Flower Patch and a Scarecrow,
So that I can make my pasture my own.

**Acceptance Criteria:**

**Given** the shop
**When** I buy the Flower Patch ($40) or Scarecrow ($80)
**Then** the decoration appears at a fixed spot in the pasture, has no gameplay effect, and its row shows "Owned" (FR23)

**Given** a saved game with decorations
**When** it reloads
**Then** owned decorations are restored

### Story 3.5: Eras and Their Transitions

As a player,
I want the pasture to change through four eras as my flock grows — and fall back when it shrinks,
So that I can see my progress and feel the cost of losses.

**Acceptance Criteria:**

**Given** the live sheep count
**When** `currentEra(state)` is computed
**Then** it returns Pasture (< 10), Village (≥ 10), Town (≥ 25) or Wool Empire (≥ 50); the era is never stored except `lastEra` for change detection (FR27, N4, AR20)

**Given** the era changes upward
**When** `updateEras` emits `EraChanged`
**Then** the background crossfades over ~1 s to the new era's art, a full-width `dusk` `era-banner` shows the era name ("Village"/"Town"/"Wool Empire") in display type `halo`, and the era fanfare plays (FR28, UX-DR37, UX-DR50, UX-DR94)

**Given** the flock drops below a threshold
**When** the era regresses
**Then** the previous background returns with the same crossfade and the banner reads "Back to {era}." in `wool-shade` with no fanfare (FR28, UX-DR37)

**Given** the field
**When** it renders
**Then** an `era-badge` (dusk pill) top-right always shows the current era, including under the pause and confirm modals (UX-DR36, UX-DR20)

**Given** a seeded test
**When** the flock grows to 10 then drops to 9
**Then** exactly two `EraChanged` events fire (Pasture → Village, Village → Pasture)

### Story 3.6: MVP Pacing Playtest and Tuning Pass

As a game designer,
I want to playtest the complete Must-tier game and tune its numbers,
So that the MVP hypothesis is tested and pacing is close to the GDD targets before Should-tier work.

**Acceptance Criteria:**

**Given** the Must-tier build
**When** at least one full session is played (Rylan, with the debug overlay available)
**Then** time-to-Village and time-to-Town are recorded against the GDD targets (Village 3–5 min, Town 10–15 min)

**Given** the results
**When** numbers are off
**Then** only values in `config/tuning.ts` are changed, sim tests still pass using `TUNING` references, and changes are noted in the GDD decision log
**And** `TUNING.farmPipsPerFood` (8) is tuned against the GDD feed-demand numbers, with a decision on whether Better Hoe moves from Should to Must, and a 300-piece field pile keeps the sim tick under 2 ms
**And** `TUNING.breedingPipsPerFood` (8) is tuned so the first breeding lands in the GDD pacing window, and a mixed pile of food and breeding pieces keeps the sim tick under 2 ms

**Given** the session
**When** it ends
**Then** zero console errors were logged and saves survived reloads during play

## Epic 4: Hidden Threats & Upgrades

An attentive player can spot and remove the Abomination, cure infections with medicine, manage overcrowding, and buy click upgrades and the auto-feeder.

### Story 4.1: The Abomination Is Born — and Stays Hidden

As a player,
I want one lamb in my flock to secretly be a monster that looks exactly like any other lamb,
So that I have a mystery to watch for.

**Acceptance Criteria:**

**Given** a new game
**When** `createNewGame(seed)` runs
**Then** `state.abomination.guaranteedAtBirth` is rolled via the seeded RNG between 8 and 15, and `birthsSeen` starts at 0 (FR29, AR18)

**Given** a lamb is born (`LambBorn`)
**When** `birthsSeen` equals `guaranteedAtBirth` for the first time, or afterwards the RNG roll is < 5%
**Then** the lamb gets `isAbomination = true`, provided no Abomination is currently alive (max one) (FR29)

**Given** an Abomination
**When** time passes
**Then** it never ages past the lamb stage, never dies of old age, drains and eats like any lamb (so it **can starve**), and counts toward capacity and eras; it can never be sold ("Too young") (FR30)

**Given** all view, HUD, tooltip, toast, ping and threat-summary code
**When** it reads sheep
**Then** it uses only the `PublicSheep` selector, which reports stage `lamb`, no `isAbomination` and no `stalk` field; an ESLint rule forbids reading `isAbomination` outside `src/sim/` and `src/debug/` (AR16, AR18, UX-DR64)

**Given** the mandatory secrecy test
**When** `publicSheep()` is called for an Abomination and a normal lamb with equal fields
**Then** the outputs differ only in `gait`

**Given** the DEV debug overlay
**When** "Reveal Abomination" is toggled
**Then** it is outlined on the field (DEV only)

### Story 4.2: The Abomination's Tells

As a player,
I want the Abomination to walk slightly wrong and other sheep to keep their distance,
So that a careful watcher can identify it.

**Acceptance Criteria:**

**Given** an Abomination
**When** it walks
**Then** its sprite plays the off-step walk cycle (`gait: 'offstep'` from `PublicSheep`) (FR32)

**Given** other sheep near an Abomination
**When** separation runs in the sim
**Then** they keep 36 px from it instead of the normal 24 px (values in `TUNING`), visibly giving it room (FR32)

**Given** a seeded test
**When** sheep settle around an Abomination
**Then** the average nearest-neighbour distance to it exceeds that of a normal lamb

### Story 4.3: The Kill Cycle

As a player,
I want sheep to mysteriously die after the Abomination visits them,
So that the threat is real but only traceable by watching.

**Acceptance Criteria:**

**Given** an alive Abomination
**When** `state.abomination.nextKillAt` is reached (random 45–60 s window via RNG)
**Then** it picks a random victim (any sheep except itself), sets `stalk.phase = 'approach'` and walks to the victim; `PublicSheep.activity` reports `wander` (FR31, AR18)

**Given** it reaches the victim
**When** contact occurs
**Then** it lingers 1 s (`'linger'`), sets the victim's `doomedAt = time + 5–10 s` (RNG), then walks away (`'leave'`) and schedules the next kill (FR31)

**Given** `time >= doomedAt`
**When** the sim steps
**Then** the victim dies via `killSheep(…, 'abomination')`, leaving a carcass, with the vague toast "A sheep just… fell over." — never stating a cause (UX-DR92)

**Given** the victim dies, is sold or sacrificed before contact
**When** the approach is in progress
**Then** a new victim is picked; with no other sheep alive it idles

**Given** the moment of contact
**When** it happens
**Then** there is no visual or audio tell beyond the visit itself

### Story 4.4: Sacrifice Reveal

As a player,
I want the Better Place to reveal whether I sacrificed the Abomination or an innocent,
So that catching it feels smug and guessing wrong feels funny.

**Acceptance Criteria:**

**Given** I sacrifice the Abomination
**When** `Sacrificed { wasAbomination: true }` fires
**Then** it flashes its true form (Phaser 4 `setTint` + `setTintMode(FILL)`), a screech and sting play, and the toast reads "Good riddance." (FR33, UX-DR81, UX-DR93)

**Given** I sacrifice any other sheep
**When** `Sacrificed { wasAbomination: false }` fires
**Then** the caption toast reads "…that was just a sheep." (FR33)

**Given** either case
**When** the reveal plays
**Then** there is no payout beyond the normal boost, and the next Abomination can spawn later at 5% per birth

### Story 4.5: Medicine

As a player,
I want to buy medicine and drag it onto an infected sheep,
So that I can save a sheep instead of sacrificing it.

**Acceptance Criteria:**

**Given** the shop
**When** I buy Medicine ($15)
**Then** the dose count increases (repeat-purchasable) and a `medicine-slot` (wool tile, infection-coloured bottle icon, "×{n}") appears right after Breed while at least one dose is owned (FR26, UX-DR33)

**Given** I drag a dose from the slot
**When** I drop it on an infected sheep
**Then** an `ApplyMedicine` command cures it immediately (clears `infectedAt`, tint and marker), consumes one dose and emits `Cured`

**Given** I drop a dose anywhere else, or press `Esc` mid-drag
**When** the drop resolves
**Then** the dose returns to the slot unused

### Story 4.6: Overcrowding

As a player,
I want a crowded pasture to risk disease,
So that buying land matters and reaching an era feels risky.

**Acceptance Criteria:**

**Given** living sheep ≥ 90% of capacity
**When** `nextOvercrowdRollAt` (every 30 s) is reached
**Then** one random sheep has a 20% chance (seeded RNG) to become infected, with the normal infection tells, ping and 20 s death (FR34)

**Given** crowding ≥ 90%
**When** the HUD renders
**Then** the flock counter numbers turn `alert` and a small crowd icon appears (UX-DR35)

**Given** crowding drops below 90%
**When** the next roll would occur
**Then** no roll happens

### Story 4.7: Better Hoe Upgrades

As a player,
I want to buy better hoes that increase food per Farm click,
So that I can keep up with a growing flock.

**Acceptance Criteria:**

**Given** the shop
**When** I buy Better Hoe I ($30) then Better Hoe II ($100, requires I)
**Then** a Farm click fills 2 then 3 pips (FR24); the Farm tooltip is unchanged and the breeding bar still fills 1 pip per click

**Given** an active sacrifice boost
**When** I farm with a hoe
**Then** the boost doubles the current pips per click (4 / 6 pips)

### Story 4.8: Auto-feeder

As a player,
I want an auto-feeder that drops food for the hungriest sheep,
So that I get a little help without the game playing itself.

> **Redesign pending (2026-10-06):** there is no food stock any more, so "taking 1 from the food meter" and "the food meter is 0" no longer apply. Decide what feeds the auto-feeder when this story is created. It drops food pieces only; breeding pieces are never produced or targeted by it.

**Acceptance Criteria:**

**Given** the shop
**When** I buy the Auto-feeder ($120, one only)
**Then** its row shows "Owned" (FR25)

**Given** an owned auto-feeder and food ≥ 1
**When** every 10 s passes
**Then** it drops 1 food piece next to the hungriest sheep, taking 1 from the food meter

**Given** the food meter is 0
**When** the auto-feeder fires
**Then** it does nothing

**Given** a seeded test with 4 sheep and a steadily refilled meter
**When** 5 minutes run with no manual feeding
**Then** no sheep starves; with 8 sheep, some do

## Epic 5: Names, Feel & Ship

The flock feels personal and the game feels finished: names, stats, last-sheep warning, juice, audio, accessibility options and credits, deployed to GitHub Pages and itch.io. Deployment stories come first and depend only on Epic 1, so they may be pulled forward to run straight after Epic 3.

### Story 5.1: Continuous Deployment to GitHub Pages

As a developer,
I want every push to `main` to test, build and publish the game to GitHub Pages,
So that a playable build is always online for portfolio reviewers.

**Acceptance Criteria:**

**Given** `.github/workflows/deploy.yml`
**When** a commit is pushed to `main`
**Then** the workflow runs `npm ci` → `npm test` → `npm run typecheck` → `npm run build` on Node 24 and deploys `dist/` to GitHub Pages (AR23)
**And** a failing test blocks the deploy

**Given** the deployed site at its GitHub Pages subpath
**When** it is opened in Chrome, Firefox and Edge
**Then** all assets load via relative URLs (`base: './'`), the game reaches the title screen with no console errors, and there are no runtime network requests other than the site's own files (NFR4, NFR11)

### Story 5.2: itch.io Release Package

As a developer,
I want a one-command zip for itch.io,
So that I can publish the HTML5 build there too.

**Acceptance Criteria:**

**Given** a production build
**When** I run `npm run zip`
**Then** `sheep-civilization.zip` contains `index.html` at its root plus all assets, and is under 8 MB (NFR3)

**Given** the zip uploaded to itch.io as an HTML5 project
**When** embedded at 1280×720 with the fullscreen button enabled
**Then** the game loads inside the iframe, scales correctly in fullscreen, and saves persist between visits (UX-DR99)

### Story 5.3: Sheep Names

As a player,
I want every sheep to have a name,
So that each loss lands harder.

**Acceptance Criteria:**

**Given** a name list of at least 100 names in `sim/systems/names.ts`
**When** any sheep is created (including the starting flock and lambs)
**Then** it gets a name picked with the seeded RNG, stored on the sheep record (FR35); `SAVE_SCHEMA_VERSION` is bumped with a migration that names existing sheep

**Given** I hover a sheep
**When** the tooltip shows
**Then** it has two lines: the name (label type), then "{Stage} · {Hunger}", plus the heart-outline icon on cooldown (FR42, UX-DR43)

**Given** death, sale, sacrifice and reveal events
**When** toasts and captions appear
**Then** they use the sheep's name, shown in `halo`: "{name} starved." / "{name} died of old age. A long, full nine minutes." / "{name} caught the carcass sickness." / "{name} just… fell over." / "{name} sold. $10." / "{name} went to a Better Place." / "…that was just {name}." (UX-DR41, UX-DR92, UX-DR93, UX-DR97)

### Story 5.4: Stats Panel

As a player,
I want a stats panel in the pause menu,
So that I can see the story of my flock.

**Acceptance Criteria:**

**Given** the pause menu
**When** I click **Stats**
**Then** the placeholder is replaced by a panel showing sheep alive, sold, died, sacrificed and money earned, with **Back** returning to the pause menu (FR36, UX-DR16)

**Given** the stats in `GameState`
**When** sheep are sold, die or are sacrificed and money is earned
**Then** each counter updates and survives save/load

### Story 5.5: "Last Sheep!" Warning

As a player,
I want a loud warning when only one sheep is left,
So that I get a last chance to react.

**Acceptance Criteria:**

**Given** the flock drops to exactly 1
**When** `LastSheep` fires (from `checkLastSheepAndLoss`)
**Then** a `last-sheep-banner` (alert band, bark title-type text "Last sheep!") plays once with the sting and the caption "[sting] Last sheep!" (FR37, UX-DR42)
**And** it plays again each time the flock drops back to 1

**Given** one sheep left
**When** the HUD renders
**Then** Breed is greyed (no pair possible)

### Story 5.6: Audio Pass and Captions

As a player,
I want cozy music and comedic sound effects, with optional captions,
So that the game feels alive and important sounds are never missed.

**Acceptance Criteria:**

**Given** source audio in `assets/audio/`
**When** `npm run assets` runs
**Then** about 10 SFX are packed into one audio sprite (OGG + MP3, ≤ 128 kbps, markers `sfx-<name>`) plus one music loop in `public/assets/audio/` (AR11)

**Given** `AudioDirector`
**When** sim events arrive
**Then** it maps them to sounds: click pop, munch, death "baa-thud", suction, cash-register ding, era fanfare / descending note, screech, sting; bleats get more frequent as hunger worsens; all sounds play only through `AudioDirector` (UX-DR77–UX-DR83)

**Given** the browser autoplay policy
**When** the page loads
**Then** nothing plays until the first pointer input; music starts on the title screen after it

**Given** captions are on (setting, default off)
**When** key cues play
**Then** `caption` boxes (dusk-deep 85%, bracketed text, bottom-centre above the bar, ~2.5 s, max 2) show `[thud]`, `[frantic bleating]` (first starving per minute), `[suction]`, `[screech]`, `[fanfare]`, `[descending note]`, `[sting] Last sheep!` (UX-DR45, UX-DR88)

### Story 5.7: Volume and Accessibility Settings

As a player,
I want to set music and SFX volume, reduce motion and turn on captions,
So that I can play comfortably.

**Acceptance Criteria:**

**Given** the pause menu
**When** I click **Volume**
**Then** the placeholder is replaced by a panel with a Music slider, an SFX slider, a Reduced motion toggle and a Captions toggle, plus **Back** (UX-DR15, UX-DR22, UX-DR87)
**And** releasing the SFX slider previews the level with a bleat

**Given** I change a setting
**When** it is applied
**Then** it takes effect immediately and is stored in `sheepciv.settings`, separate from the save, surviving Restart and Start over (UX-DR89)

**Given** reduced motion is on
**When** juice plays
**Then** meter shake becomes flash only, banners fade instead of sliding, popups fade in place, and screen shake is off — but gameplay animation (the Abomination's off-step walk and flock avoidance, thin/droop poses, infection wobble) is unchanged (UX-DR84)

### Story 5.8: Juice Polish Pass

As a player,
I want every action to feel snappy and funny,
So that the game is satisfying in the first minute.

**Acceptance Criteria:**

**Given** the juice list in EXPERIENCE.md
**When** the pass is complete
**Then** each item exists, has an audio cue and respects reduced motion: button squash + "+N" popups, food bounce, munch particles, death pose + dust puff, sacrifice suction + `halo` sparkle + Farm glow, heart pop + lamb poof, "$10" coin popup, era crossfade + banner, empty-meter shake + flash (UX-DR77–UX-DR83)

**Given** juice effects
**When** they spawn
**Then** particles and popups come from pools, with no allocation in hot paths

### Story 5.9: Credits Screen

As a player,
I want a credits screen,
So that the free asset creators are properly credited.

**Acceptance Criteria:**

**Given** the title screen or pause menu
**When** I click **Credits**
**Then** the placeholder is replaced by a panel listing every asset pack, author and licence from `assets/CREDITS.md` in body type, with **Back** (FR44, UX-DR17, NFR12)

**Given** `assets/CREDITS.md`
**When** an asset is used anywhere in `public/assets/`
**Then** its source and licence are listed

### Story 5.10: External Playtest

As a game designer,
I want at least one other person to play the near-final build,
So that I can check first impressions and whether the Abomination is readable.

**Acceptance Criteria:**

**Given** the Should-tier build
**When** at least one other person plays (ideally 3) with Rylan watching and no instructions
**Then** these are recorded against the GDD success metrics: starts feeding within 60 s; audible reaction to a death or sacrifice; pauses over sell vs sacrifice; identifies and sacrifices the Abomination unprompted (NFR9)

**Given** no tester identifies the Abomination
**When** the results are reviewed
**Then** the off-step animation is exaggerated first (GDD readability fallback), with changes logged in the GDD decision log

### Story 5.11: Performance and Release Check

As a developer,
I want a final performance and quality check,
So that the shipped build meets every technical target.

**Acceptance Criteria:**

**Given** a production build on a mid-range laptop with an integrated GPU
**When** 100 sheep run for 5 minutes in Chrome and in Firefox (debug overlay in a DEV build for counting, production build for timing)
**Then** the game holds 60 FPS (NFR1)
**And** a field food pile of 300 pieces with 100 sheep also holds 60 FPS

**Given** the deployed build
**When** loaded on broadband
**Then** initial load is under 5 s and total size under 8 MB (NFR2, NFR3)

**Given** a 30-minute session
**When** it is played
**Then** zero console errors occur (NFR8)

**Given** the DESIGN.md contrast table
**When** a unit test checks the listed token pairs
**Then** text pairs meet ≥ 4.5:1 (≥ 3:1 for large text) (UX-DR86)

**Given** the 960×540 minimum window
**When** the HUD is checked
**Then** no text is below 13.5 px effective size, numbers don't jitter, and every control meets the 40 px hit target (sheep use sprite bounds + 6 px) (UX-DR5, UX-DR90)
