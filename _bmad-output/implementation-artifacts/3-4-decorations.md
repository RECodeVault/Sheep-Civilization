---
baseline_commit: 3f3f24e
---

# Story 3.4: Decorations

Status: done

<!-- Created 2026-10-07 by create-story. Builds on 3.2 (`owned`, `Buy`/`Bought`, shop rows with "Owned", the decoration rows and icons), 3.3 (`isLand`, the land table, `growLand`'s once-per-frame pattern, the camera play area and its DEV invariants, `FIELD_DEPTH.underShop`), 3.1/2.7 (Market and Better Place geometry) and 1.3 (fence depth rules). No save schema bump: decorations are derived from `owned`. -->

## Story

As a player,
I want to buy a Flower Patch and a Scarecrow,
so that I can make my pasture my own.

## Acceptance Criteria

1. **Buying shows the decoration (FR23, UX-DR24).** When I buy the Flower Patch ($40) or the Scarecrow ($80) in the shop, the decoration appears in the field on the frame the purchase applies, at its own fixed spot, with a short [ASSUMPTION] pop-in and a dust puff at its foot. Its row shows "Owned". Story 3.2 already built the row, the price and the `Buy`; 3.4 keeps them as they are.
2. **Fixed spots that stay clear at every land tier (DESIGN Layout; Stories 2.7, 3.1, 3.3).** Each decoration has one fixed world position (see "Decoration spots"). At every land tier (0–III), and with the shop open or closed:
   - it lies outside the fence (fences only grow left and down, and every tier's top rail is at y 184, so a spot above y 180 is never covered);
   - it overlaps neither the Better Place (its bounds or its armed glow) nor the Market (its bounds, outline or price tag);
   - it lies inside the camera's play area, so the camera always shows it;
   - it lies right of the open shop panel's edge, so the player sees it appear while buying.

   A DEV `invariant`, next to the 3.3 ones in `GameScene`, checks all of this for every tier.
3. **No gameplay effect (FR23, "Cosmetic").** Owning a decoration changes nothing in the sim except `money` and `owned` at the moment of purchase. It draws no rng, sheep do not avoid it, and it blocks no click, hover, drag, drop, pan or food drop. A seeded scenario proves it: two games from the same seed, one owning both decorations, run the same commands and stay identical except for `money` and `owned`. The decorations are not interactive (no `setInteractive`, no tooltip, no hand cursor).
4. **Restored on load (AC 2 of the epic).** A saved game that owns decorations draws them from the start when it is continued or loaded, with no pop-in. Nothing new is saved: decorations come from `state.owned`, which 3.2 already saves and validates. `SAVE_SCHEMA_VERSION` stays **8**.
5. **Drawn like the world (UX-DR10 layer 1, architecture atlases).** Both decorations are atlas images from `sheep-world` (`flower-patch`, `scarecrow`), placeholder art drawn at half size and shown at 2×, like the sheep. They are built once per game in `create` (hidden until owned) and never created or destroyed during play. Their depth is their foot's y, the same rule as sheep and the fence's front rails. They draw above the back rails and the Better Place's ground decor, and below the shop panel, a dragged sheep and the world overlays.
6. **Secrecy and layering.** No `PublicSheep` or `HudView` change. `src/view/` only reads `owned` through a selector and never writes it. The sim stays pure, and no new tunable number goes in `TUNING`: decoration spots are view layout, like `BETTER_PLACE` and `MARKET`.
7. **Done.** `npm test`, `npm run typecheck` and `npm run lint` pass. The browser checks in Task 6 are recorded with evidence, including an FPS spot check at 100 sheep with both decorations owned.

## Tasks / Subtasks

- [x] **Task 1: Decoration selectors (AC 1, 3, 6)**
  - [x] 1.1 `src/sim/selectors.ts`: add `export type Decoration = 'flowerPatch' | 'scarecrow'` (a subset of `ShopItemId`), `export const DECORATIONS: readonly Decoration[] = Object.freeze(['flowerPatch', 'scarecrow'])` (shop order) and `isDecoration(item: ShopItemId): item is Decoration`, next to `isLand`. Write it as a type guard so GameScene can narrow `e.item`. Add a one-line doc: "A cosmetic shop item (FR23): owned, drawn, no effect."
  - [x] 1.2 Do **not** add a `GameState` field or a "decorations" array: the view reads `isOwned(state, d)` for each of `DECORATIONS` (at most 5 entries in `owned`; only called in `create` and on `Bought`, never per frame).
  - [x] 1.3 `src/sim/systems/economy.ts`: reword the "decorations (3.4)" forward reference in the header comment to say what is true now (decorations are drawn by the view from `owned` and have no sim effect).
- [x] **Task 2: Sim tests (AC 3, 4)**
  - [x] 2.1 `tests/sim/selectors.test.ts`: `isDecoration` picks out exactly `['flowerPatch', 'scarecrow']` from `SHOP_ITEMS`; `DECORATIONS` is that list in shop order; `isLand` and `isDecoration` together cover `SHOP_ITEMS` with no overlap (so a new Epic 4 item must be classified on purpose).
  - [x] 2.2 New `tests/sim/scenarios/decorations.test.ts`:
    - (a) **No effect at purchase.** With `state.money = shopPrice('flowerPatch') + shopPrice('scarecrow')`, `structuredClone` the state, apply both `Buy` commands with the scenario's `tickWith` (copy the helper from `shop.test.ts`), then compare against the clone run through the same tick with no Buy. Everything except `money` and `owned` is `toStrictEqual`; the events differ only by the two `Bought` events, and `owned` is `['flowerPatch', 'scarecrow']`.
    - (b) **No effect over time.** Two games from the same literal seed; game B owns both decorations (bought through the real `Buy` with money set first, then `money` reset to game A's value). Run both through the same command script (a few Farm and FarmBreeding clicks, a Sell if an adult exists) for a TUNING-derived time, for example `TUNING.lambUntilMs` (a multiple of `TICK_MS`). Then the states are `toStrictEqual` once `owned` is set equal, and so are the drained event lists.
    - (c) **No effect on capacity or the fence.** Owning both decorations and no land: `capacity` is `TUNING.landCapacities[0]`, `fenceBounds` is `TUNING.landFences[0]`, `landTier` is 0 (3.3 tests the mix with land; keep this case short).
  - [x] 2.3 Save (AC 4): `tests/save/busy.ts` already owns `['land1', 'flowerPatch']`. Add `'scarecrow'` so the busy round-trip covers both decorations, and update the doc comment ("three shop purchases"). Check that `isBusy` (or its equivalent) needs no change; if it asserts the owned list, update it. `tests/save/validate.test.ts` already accepts both decorations in any order and rejects a duplicate; add nothing unless a case is missing.
- [x] **Task 3: Placeholder art (AC 5)**
  - [x] 3.1 `assets/art/world/flower-patch.png`, about 28×14 px (56×28 shown): a low clump of 4–5 pixel flowers on short stems, petals in `heart` #E27894 and `wool` #FBF4E4 with `halo` #F6D86B centres, stems and leaves in the mockup glyph's stem green #4F8A34, a 1 px darker green base so it sits on the grass. Use the same flower as `icon-flower-patch.png` / the mockup's `g-flower` glyph, so the row icon and the field object read as one thing.
  - [x] 3.2 `assets/art/world/scarecrow.png`, about 20×32 px (40×64 shown, about a sheep's height): the mockup's `g-scarecrow` glyph scaled up. A `wood` #8E5A30 post and cross-arm, a `hay` #E9A23B / `hay-deep` #B86F1C straw head and hat, an `awning` #B8453A shirt, and a 1 px `bark` #3A2A1F outline so it reads on the pasture. Friendly, not spooky (NFR10 tone).
  - [x] 3.3 Make both with a throwaway scratchpad encoder, as in 2.x/3.1/3.2/3.3, and commit only the PNGs. Run `npm run assets` to regenerate `public/assets/atlases/sheep-world.{png,json}`. Add `FRAME.flowerPatch: 'flower-patch'` and `FRAME.scarecrow: 'scarecrow'` to `assetKeys.ts` with a one-line comment (FR23, Story 3.4). Add both files to the placeholder row in `assets/CREDITS.md` (the description and the `art/world/{…}` list).
- [x] **Task 4: Draw the decorations (AC 1, 2, 4, 5)**
  - [x] 4.1 New `src/view/field/Decorations.ts`, modelled on `BetterPlace.ts` / `Market.ts`:
    - `export const DECORATION_SPOTS: Readonly<Record<Decoration, { x: number; foot: number }>>` (world px; `x` is the centre, `foot` the bottom edge) and `export const DECORATION_BOUNDS: Readonly<Record<Decoration, Rect>>` (each sprite's shown rect, 2× its frame, derived from the spot and frame size; used by the DEV invariant). Values in "Decoration spots"; doc them as `[ASSUMPTION, tune in the browser]`.
    - `class Decorations`: the constructor adds one `Image` per decoration from `ATLAS.sheepWorld`, origin (0.5, 1) at its spot, `setScale(SCALE)` (2), `setDepth(foot)`, hidden. `show(state)` sets each image visible when `isOwned(state, d)`. It is called once from `create`, and has no pop. `pop(d)` makes `d` visible and plays the pop-in: a scale tween from about 0.6× to 2× with `Back.easeOut` over about 220 ms (visual only; it changes no state). Kill any tween on that image first. No `setInteractive`.
    - Class doc: a fixed world object built once per game; it holds no game data; GameScene tells it what is owned.
  - [x] 4.2 `GameScene`:
    - Create `this.decorations = new Decorations(this)` right after the Market and call `this.decorations.show(this.state)`, so a continued or loaded game draws them at once (AC 4).
    - In `onSim`, add `else if (e.type === 'Bought' && isDecoration(e.item)) this.decorationBought(e.item);` after the land branch. `decorationBought` calls `this.decorations.pop(item)` and `this.dust.explode(DECORATION_PUFFS, spot.x, spot.foot)` with a small new `DECORATION_PUFFS` (about 6) next to `DUST_SPAWN_PUFFS`. This stays inside `onSim`'s existing `ui` try/catch. A decoration can be bought only once, so this runs at most twice a game. Unlike land, no once-per-frame flag is needed: it moves no camera and rebuilds nothing.
    - Do not add the decorations to `playArea` or `focus`: the DEV invariant proves they are already inside it at every tier (Task 4.3). This keeps the 3.3 camera numbers unchanged.
  - [x] 4.3 DEV invariant, in the existing `if (import.meta.env.DEV)` block at the bottom of `GameScene.ts`. For each decoration and each tier `t`:
    - the decoration's bounds lie inside `union(union(landFences[t], BETTER_PLACE_BOUNDS), MARKET_BOUNDS)` (the play area);
    - they do not intersect the fence rect grown by the post rise (top − 4) and a 2 px margin (the fence's effective top is then y 178 from Land I up; the spots' feet are at 176);
    - they do not intersect `BETTER_PLACE_BOUNDS` or `MARKET_BOUNDS`, and they are clear of the Better Place's armed glow (see "Decoration spots" for its extent; export a `BETTER_PLACE_GLOW_BOUNDS` from `BetterPlace.ts`, or compute it there from the frame size × `SCALE`, rather than re-typing numbers);
    - their left edge is right of the Better Place's left edge. The Better Place is what the open shop protects (3.3), so this keeps them right of the panel too.

    Use a small local `intersects(a, b)` helper. Messages read like the 3.3 ones: "GameScene: a decoration …".
  - [x] 4.4 The open-shop sync (`syncUnderShop`) needs no change: the decorations are never under the panel (AC 2), and they have no overlays.
- [x] **Task 5: Other wiring and docs (AC 6)**
  - [x] 5.1 `src/view/field/depths.ts`: extend the header comment. Decorations are world objects at depth = foot y, like sheep. No new band.
  - [x] 5.2 `strings.ts` needs no change: the rows already read "Flower Patch" / "Scarecrow" / "Cosmetic", and the decorations have no tooltip or toast (none in the Voice table).
  - [x] 5.3 `ShopPanel.ts` needs no change. Check that both rows still show "Owned" after purchase and after reload (Task 6).
- [x] **Task 6: Verify in the browser (AC 1–5, 7)**. Use the DEV server and a scratchpad Playwright probe, as in 3.1–3.3 (see Previous story intelligence).
  - [x] 6.1 New game: no decorations in the field. Use DEV "+$100", open the shop and buy the Flower Patch. It pops in at its spot with a dust puff, right of the open panel, and the row reads "Owned". Buy the Scarecrow: the same. Screenshot both moments.
  - [x] 6.2 At tiers 0, I, II and III (buy the land, or load planted saves), with the shop closed and open: both decorations are fully on screen, outside the fence, and clear of the Better Place, the Market and the bar. Pan with a right-drag to every limit at tier 0 (the widest pan range): they stay in view. Screenshot each tier.
  - [x] 6.3 Drag a sheep: the Better Place glow and the Market outline and price tag do not overlap either decoration. Drop a sheep with the pointer over a decoration: it is a plain drop, clamped into the pen as usual. Hover a decoration: no tooltip, no hand cursor. Right-drag starting on a decoration pans.
  - [x] 6.4 A sheep walking along the top fence draws correctly against the decorations (no sheep is ever hidden behind one; the spots are outside the pen).
  - [x] 6.5 Save and reload: own both, go through Pause → Main Menu → page reload → Continue. Both are drawn at once with no pop-in, and both rows read "Owned". Also use debug Load with a planted save that owns only the Scarecrow: only the Scarecrow shows.
  - [x] 6.6 Window at 960×540: both decorations are legible and nothing overlaps.
  - [x] 6.7 FPS spot check: 100 sheep (DEV add sheep) at Land III with both decorations owned, ×1, overlay open. Compare with 3.3's median (31 on a loaded machine) and note the load average. Two static images should cost nothing measurable; a 2–3 minute spot check is enough unless it differs.
  - [x] 6.8 No console errors throughout.
- [x] **Task 7: Wrap-up**
  - [x] 7.1 `deferred-work.md`:
    - Mark "Decorations (Story 3.4)" (3.2 section) **Resolved in Story 3.4** with one line.
    - Add a 3.4 section: **3.5**, era backgrounds draw below `FIELD_DEPTH.ground` and the decorations keep their spots in every era; **5.6**, a purchase sound already covers decorations (no extra cue); **5.7**, the pop-in and dust puff are juice (show the decoration at once under reduced motion); **3.6/5.x**, real free-pack art replaces the placeholders, and keeps the spots and sizes or updates `DECORATION_SPOTS` and the invariant.
  - [x] 7.2 Fill in the Dev Agent Record (plan, debug log with browser evidence and FPS, completion notes, file list, change log), as in 3.3.

### Review Findings

- [x] [Review][Patch] Scenario (b) never asserts its Sell happened, and `t === ticks / 2` never matches when `ticks` is odd. Use `Math.floor(ticks / 2)` and assert that a `Sold` event is in the events [tests/sim/scenarios/decorations.test.ts:34]
- [x] [Review][Patch] Scenario (c) never asserts that the purchase applied: a future buy rule could make it pass with nothing owned. Assert `owned` [tests/sim/scenarios/decorations.test.ts:82]
- [x] [Review][Patch] Event lists use `toEqual`, not the `toStrictEqual` Task 2.2(b) asks for (scenarios a and b) [tests/sim/scenarios/decorations.test.ts:56]
- [x] [Review][Patch] The DEV invariant checks the Better Place's glow but never `BETTER_PLACE_BOUNDS` itself (Task 4.3). It is covered today only because the glow contains the hole [src/view/scenes/GameScene.ts:921]
- [x] [Review][Patch] The invariant's fence rect stops 4 px short of the front posts. They reach y + h + 6 (22 px post frame at `frontY − POST_RISE`), and their numbers are re-typed. Derive the drawn fence extent from `Fence.ts` constants [src/view/scenes/GameScene.ts:932]
- [x] [Review][Patch] `GLOW_FRAME` (140×78) is a literal with no DEV check against the atlas, unlike the decoration frames. New glow art could outgrow the bounds the invariant trusts [src/view/field/BetterPlace.ts:32]
- [x] [Review][Patch] The era badge and toast checks from Dev Notes ("Check both in 6.2") are not recorded. Record that the badge does not exist until 3.5 (projected world y 72–112, x ≥ 1112, clear of the Scarecrow at x ≤ 1020) and add a 3.5 check to deferred-work [story Debug Log]
- [x] [Review][Defer] The decoration layout and frame-size invariants are DEV-only and never run under `npm test`, as with 3.3's land fit [src/view/scenes/GameScene.ts:920] — deferred, pre-existing pattern (3.3 deferred note)

## Dev Notes

### Current code to build on (read these first)

- **`src/sim/state.ts:87`:** `ShopItemId = 'land1' | 'land2' | 'land3' | 'flowerPatch' | 'scarecrow'`. `owned: ShopItemId[]` (3.2) is in purchase order and saved. Epic 4 appends `hoe1 | hoe2 | autoFeeder`.
- **`src/sim/selectors.ts`:**
  - `isLand(item)` (line 10) is the model for `isDecoration`;
  - `SHOP_ITEMS` (line 94), `shopPrice` (flowerPatch → `TUNING.flowerPatchPrice` 40, scarecrow → `TUNING.scarecrowPrice` 80), `shopRequires` (null for decorations), `isOwned` (an `includes`, fine off the hot path) and `buyBlock`;
  - `landTier` already skips decorations (3.3 test "decorations do not count").
- **`src/sim/systems/economy.ts`:** `buy` spends, pushes to `owned` and emits `Bought { item, price }`. It needs no change for 3.4 (comment only).
- **`src/view/scenes/GameScene.ts`:**
  - `create` builds `Fence`, `BetterPlace` and `Market` in that order, then `buildPlayArea`, `PenCamera`, the pools and the emitters (`this.dust` is created **after** the Market, so `decorationBought` must only run from `onSim`, never from the constructor).
  - `onSim` (line 198) is the `ui`-guarded event juice: `Bought` with a land item sets `landBought`. Add the decoration branch here.
  - The DEV invariant block (line 873) checks every tier's play area and the fence against the Market and the Better Place. Add the decoration checks here, reusing `union`.
- **`src/view/field/BetterPlace.ts`:** `BETTER_PLACE` {520, 108}, `BETTER_PLACE_BOUNDS` {442, 72, 156×114}. The glow frame is 140×78 at scale 2, centred on (520, 108), so it is shown at **x 380–660, y 30–186** when armed. Keep decorations right of x 660.
- **`src/view/field/Market.ts`:** `MARKET_BOUNDS` {1080, 120, 196×270} covers the stall, the outline (1080–1276 × 170–390) and the price tag grown on hover (from y 120). Keep decorations left of x 1080 with a margin.
- **`src/view/field/Fence.ts`:** back rails at depth 0, front rails and posts at their y. Posts rise 4 px above the top rail (`POST_RISE`), so the fence's highest pixel is y 180 at every tier from Land I up (top 184), and y 326 at tier 0.
- **`src/view/field/depths.ts`:** world entities use depth = y, below every band (shop 9 000, underShop 8 999, dragged 9 996, …). Decorations follow the same rule.
- **`src/view/field/PenCamera.ts` + 3.3 camera table:** the play area always contains x 442–1276 × 72–580 or more, and it is kept fully in view (and, with the shop open, the Better Place stays right of screen x 392). Anything inside that rect and right of the Better Place's left edge is on screen at every tier, shop open or closed.
- **`src/view/hud/ShopPanel.ts`:** `SHOP_ICON` maps the decorations to `icon-flower-patch` / `icon-scarecrow` (ui atlas, 14×14). The rows already show "Owned".
- **`tests/save/busy.ts`:** `state.owned = ['land1', 'flowerPatch']` is set before the flock is placed.

### Decoration spots

These are [ASSUMPTION, browser-check; tune in the browser] world px (world = the mockup's canvas px). The mockup shows the Flower Patch owned but never draws it in the field, so the spots are ours.

| Decoration | Frame (drawn) | Shown (2×) | Spot: centre x, foot y | Shown rect (x, y, w, h) |
|---|---|---|---|---|
| Flower Patch | 28×14 | 56×28 | 724, 176 | 696, 148, 56×28 |
| Scarecrow | 20×32 | 40×64 | 1000, 176 | 980, 112, 40×64 |

- **Why the strip above the fence.** The grass between the Better Place (to x 598, its glow to x 660) and the Market (from x 1080), above y 180, is the one place that:
  - no land tier ever covers (every fence from Land I up has its top rail at 184, and fences only grow left and down; 3.3);
  - is always in the camera's play area and on screen (3.3 camera table);
  - is never under the open shop panel, so the player sees the purchase land;
  - is never under a sheep or a food piece: sheep and pieces stay inside the inner fence (top y 224 from Land I up), so a decoration can never hide a starving sheep, an infected one or a carcass. That would be a gameplay effect, which FR23 rules out.
- **At tier 0** the start fence's top is at 330, so the decorations stand in open grass above the small pen. From Land I they line the top fence. Both read as "my pasture".
- **Clear of the HUD:** the era badge (3.5) is screen top-right at the safe margin (screen x ≈ 1100–1264, y 16–56). At the Land II/III scroll (y 56) that is world y 72–112, x ≥ 1112, so it misses the Scarecrow (x ≤ 1020). Toasts (DOM, top-centre) may pass over the Flower Patch for 4 s; they are non-interactive and transient. Check both in 6.2.
- **Depth:** `foot` (176) is above the inner fence top (224 from Land I), so no sheep stands in front of or behind a decoration. A dragged sheep (9 996) draws above both.
- If the browser check shows a clash, move the spots within the strip (x 668–1064, foot ≤ 176) and keep the invariant green.

### Sim design notes

- **Derived, never stored.** What is drawn comes from `owned` every time. Do not add `decorations`, positions or visibility to `GameState`, and do not bump the save schema (project-context: storing derived values is a listed mistake).
- **Cosmetic means no sim code.** No system, no command, no event and no `TUNING` value is added. `Buy`/`Bought` already exist. The scenario in 2.2 (b) is the proof that the rest of the game cannot tell decorations exist.
- **Determinism.** Buying draws no rng. Existing seeded tests do not change, except `busyGame`'s `owned` (one more item: its round-trip assertions compare the state to itself, so they stay green).
- **Epic 4 note.** When 4.7/4.8 append items, `isLand`/`isDecoration` stay exact. The 2.1 coverage test then fails until the new item is classified (for example as an upgrade), which is the intent.

### What must be preserved

- **3.2 shop:** rows, prices, the "Owned" text, precedence (owned → locked → poor), the Esc chain and the panel input rules.
- **3.3 land:** the fence growth, `growLand` once per frame, the camera limits and the opening view (decorations are **not** added to `playArea`/`focus`, so these numbers do not move), the under-shop overlay rule, and every 3.3 DEV invariant.
- **3.1/2.7 drop targets:** `inMarket`, `inBetterPlace`, the highlights and the rule that a release over a HUD control or the panel is a plain drop. Decorations are not drop targets.
- **Input:** no `setInteractive` on decorations. The `InputController` hit tests (`sheepAt`, `carcassAt`) only look at sheep and carcasses, so decorations cannot block a pick.
- **Performance:** two static images; no per-frame work (no `show` per frame, no allocation in `render`/`update`).
- **Save:** schema 8, `savable`, the corrupt-save fallback and the backup slot.

### Architecture compliance

- `src/view/field/Decorations.ts` sits beside `BetterPlace.ts` and `Market.ts`: fixed world objects in `view/field/` (architecture tree). Art goes in the `sheep-world` atlas ("sheep-world (… Market, Better Place, decorations, fence)", architecture Asset pipeline).
- Selectors stay in `sim/selectors.ts`; economy stays in `systems/economy.ts`; no new system.
- **Commands in, events out:** the view reacts to the existing `Bought` event. No new command or `SimEvent`, so no `assertNever` switch changes.
- **Visual-only tweens:** the pop-in tween changes no `GameState` (project rule: tweens and timers are visuals only).

### Library / framework notes (Phaser 4.2.1 installed; no new dependencies)

- Everything needed is already in use: atlas `Image`s with `setOrigin`/`setScale`/`setDepth` (`BetterPlace.ts`, `Fence.ts`), `this.tweens.add` and `killTweensOf` (`GameScene.suck`, `Market.ts`), and particle `explode` (`this.dust`).
- Do not write Phaser 3 APIs from memory. If unsure, check `node_modules/phaser/skills/` or Context7.
- No web research is needed: no library or version changes.

### Testing standards

- Vitest covers `src/sim/`, `src/save/` and `src/config/` only; Phaser code (including `Decorations.ts`) is never tested. Test files go in `tests/<same path as src>/`, and scenarios in `tests/sim/scenarios/`.
- Helpers: `newGame(seed)` with a fixed literal seed, `runFor` (a multiple of `TICK_MS`) and `fillFlock` (`tests/sim/helpers.ts`), `busyGame` (`tests/save/busy.ts`), and the local `tickWith` pattern from `tests/sim/scenarios/shop.test.ts`.
- Every number comes from `TUNING`/`shopPrice`, never a literal: `shopPrice('scarecrow')`, not `80`.
- Buy in tests through the real `Buy` command after setting `money` (3.1 review lesson: exercise the real path).

### Previous story intelligence (3.3, 3.2, 3.1)

- **3.3 left this for 3.4:** "Decorations (Story 3.4): the Flower Patch and Scarecrow can be bought (they show "Owned"); 3.4 draws them from `owned`" (deferred-work, 3.2 section).
- **3.3 lessons:**
  - View work goes inside a `ui` guard (`onSim` already is one), never the sim's.
  - Do not create or destroy images during play: the review sent back `Fence.setBounds` for destroying images. Build the decorations once in `create`, then only toggle visibility.
  - Do not draw juice under the open shop panel: the review moved the dust burst off it. The decoration spots are never under the panel, and the DEV invariant guards that.
  - DEV invariants are not covered by `npm test` (3.3 deferred note). That is accepted here too. If you want test coverage, the spot numbers could move to a plain-data module that a config test imports, but that is optional.
  - Every Task 6 item needs recorded evidence (screenshots or probe output), or the review sends it back. FPS checks should run the length the task asks for.
- **3.2 review lessons:** a widget must show its change on the frame it happens: the decoration appears in the same frame as the `Bought` drain. Shop UI errors report as `ui`.
- **Browser probe setup:**
  - `playwright-core` from `/home/rylanevans/nr-csp/frontend/node_modules` with `/usr/bin/google-chrome` (SwiftShader);
  - run the DEV server on its own port (5200–5202 worked) and stop it with `kill <vite node pid>`, never `pkill -f`;
  - plant saves via debug Load save, and read state via Dump state;
  - move the mouse in steps.
  - Known flake: the first drag after the first debug Load sometimes never starts (deferred). Do not chase it.
- **FPS baseline:** 3.3 measured 103 sheep at Land III, ×1, 5 minutes: median 31 (min 25, max 35) on a loaded machine (load average 1.9 → 7.7).

### Git intelligence

- Recent commits: `3f3f24e` (3.3 review fixes), `ebf276a` (3.3), `a903488` (3.2), `e64819a` (3.1 review), `4281cec` (3.1).
- Per-story pattern: selectors and sim tests; a view object; placeholder art with an atlas rebuild; `deferred-work.md`; a Dev Agent Record with browser evidence and FPS.
- Commit message: `Implement story 3.4: Decorations`.
- Branch: `story/3-4-decorations` (already created from `main` at `3f3f24e`).

### Out of scope

- **3.5:** eras and their backgrounds (decorations keep their spots across eras).
- **4.x:** more shop items (Better Hoe, Auto-feeder, Medicine).
- **5.6:** a purchase sound (shared with land, on `Bought`).
- **5.7:** reduced motion for the pop-in.
- **5.8:** fancier juice (sway, idle animation, flowers bobbing).
- **v2 (GDD "Decorations with buffs"):** any gameplay effect, moving decorations, or sheep reacting to them.

### Open questions (defaults chosen; confirm or change)

1. **Where the decorations stand.**
   - **Default:** outside the pen, in the grass strip between the Better Place and the Market, above the fence line (Flower Patch at x ≈ 724, Scarecrow at x ≈ 1000). They are never covered by land, never hide a sheep or threat, and are always on screen.
   - **Alternative A, inside the start pen:** "in the pasture" literally. But sheep walk behind and through them, and they could hide a starving sheep, a carcass or a dropped piece, which is a gameplay effect.
   - **Alternative B, beside the Market** (below the stall, x ≈ 1100–1260, y ≈ 400–570): out of the way, but they may read as part of the stall, and they sit next to a drop target.
2. **Appearing cue.**
   - **Default:** a pop-in (scale tween) plus a small dust puff.
   - **Alternative:** they simply appear (no juice until 5.8).
3. **Scarecrow look.**
   - **Default:** a friendly straw scarecrow, as in the mockup glyph.
   - **Alternative:** a slightly spooky one, to foreshadow the Abomination (Epic 4). Its tone would need checking against NFR10.

### Project Structure Notes

- New files:
  - `src/view/field/Decorations.ts`
  - `tests/sim/scenarios/decorations.test.ts`
  - `assets/art/world/flower-patch.png`, `assets/art/world/scarecrow.png`
- Modified:
  - `src/sim/selectors.ts`, `src/sim/systems/economy.ts` (comment only)
  - `src/view/assetKeys.ts`
  - `src/view/field/depths.ts` (comment only), `src/view/field/BetterPlace.ts` (exported glow bounds, if you take that route)
  - `src/view/scenes/GameScene.ts`
  - `assets/CREDITS.md`
  - tests: `tests/sim/selectors.test.ts`, `tests/save/busy.ts`
  - `_bmad-output/implementation-artifacts/deferred-work.md`
- Regenerated: `public/assets/atlases/sheep-world.{png,json}`.
- No architecture deviations expected.

### Project Context Rules (from `_bmad-output/project-context.md`)

- **Derived, never stored:** owned decorations come from `state.owned`; no new `GameState` field, so no schema bump or migration.
- **The sim is pure:** no Phaser, DOM, `Date.now()` or `Math.random()` in `src/sim/`; tests use `TUNING`/`shopPrice`, never literals.
- **View rules:** game logic never lives in sprites, scenes or tweens (the pop-in is visual only). Colours come from `COLORS` and copy from `strings.ts` (this story adds neither). Sprites come from the atlases, to keep batching.
- **Pooling and performance:** never `new`/`destroy()` sprites during play. The two images are built once per game in `create`. Verify with 100 sheep at ×1 in the debug overlay.
- **Input:** gameplay hit-testing goes through `InputController`; decorations get no `setInteractive`.
- **Listeners:** no new `bus.on` (the decoration branch rides the existing `sim` handler). If one is added, remove it on SHUTDOWN.
- **No confirmations** on shop purchases (UX-DR68).
- **Tone (NFR10):** cute, never scary or gory; the scarecrow is friendly.
- **Done:** `npm test`, `npm run typecheck` and `npm run lint` pass, plus the browser checks.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.4; FR23; UX-DR10, UX-DR23, UX-DR24, UX-DR68]
- [Source: _bmad-output/planning-artifacts/gdds/gdd-sheep-civilization-2026-10-05/gdd.md: Upgrade Trees (Flower Patch $40, Scarecrow $80, Cosmetic, Must); Art list ("2 decorations"); v2 "Decorations with buffs" (out of scope)]
- [Source: _bmad-output/planning-artifacts/gdds/gdd-sheep-civilization-2026-10-05/decision-log.md: "Decorations: Flower Patch $40, Scarecrow $80 (cosmetic)"]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-sheep-civilization-2026-10-05/DESIGN.md: Layout & Spacing (Better Place, Market, toasts, era badge, fence grows in place)]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-sheep-civilization-2026-10-05/EXPERIENCE.md: Shop panel / shop item row (one-time items show "Owned")]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-sheep-civilization-2026-10-05/mockups/hud.html: `g-flower` and `g-scarecrow` glyphs; Flower Patch row "Owned", effect "Cosmetic"]
- [Source: _bmad-output/game-architecture.md: Asset pipeline (decorations in the `sheep-world` atlas); view/field layout]
- [Source: _bmad-output/implementation-artifacts/deferred-work.md: "Decorations (Story 3.4)"]
- [Source: _bmad-output/implementation-artifacts/3-3-buy-land-and-grow-the-fence.md (fence rects, camera table, review lessons, probe setup)]
- [Source: _bmad-output/project-context.md]

## Dev Agent Record

### Agent Model Used

Claude Opus 5.5 (1M context), `claude-opus-5-5[1m]`

### Implementation Plan

- **Sim:** no new state, system, command or event.
  - `selectors.ts` adds the `Decoration` type, `DECORATIONS` (shop order) and the `isDecoration` type guard, next to `isLand`.
  - Owned decorations come from `state.owned` (3.2), so there is no schema bump.
  - The `economy.ts` header comment now says decorations have no sim effect.
- **View:**
  - New `view/field/Decorations.ts`, a fixed world object like `BetterPlace`/`Market`. It builds one atlas image per decoration in `create` (hidden, origin at the foot, 2×, depth = foot y), has no `setInteractive`, and never creates or destroys images during play.
  - `show(state)` runs once per game, with no pop. `pop(d)` runs on `Bought` and plays a 0.6× → 2× `Back.easeOut` tween over 220 ms.
  - `GameScene` builds it after the Market. In `onSim` (inside the existing `ui` guard), a `Bought` with a decoration calls `decorationBought`: pop plus a 6-puff dust burst at the foot. The decorations are not added to `playArea`/`focus`, so the 3.3 camera numbers are unchanged.
  - Spots (world px, centre x / foot y): Flower Patch 724/176 (shown 696–752 × 148–176), Scarecrow 1000/176 (980–1020 × 112–176).
  - `BetterPlace.ts` exports `BETTER_PLACE_GLOW_BOUNDS` (x 380–660, y 30–186), computed from the glow frame size × `SCALE`.
- **DEV checks:**
  - In `GameScene`'s invariant block, for each decoration and every tier: clear of the Better Place glow and the Market, right of the Better Place's left edge (so right of the open panel), clear of each fence grown by the post rise and a 2 px margin, and inside each tier's play area.
  - In `Decorations`, each frame's real size must match `FRAME_SIZE`, so new art cannot outgrow the checked bounds.
- **Art:** `flower-patch.png` (28×14: five flowers in heart/wool with halo centres on green stems, bark-soft outline) and `scarecrow.png` (20×32: the mockup glyph scaled up, with a friendly face and a bark outline). Both were drawn with a throwaway scratchpad encoder; the `sheep-world` atlas was regenerated (41 frames).
- **Open Questions:** all three are implemented at their defaults: the strip above the fence, pop-in plus dust, and a friendly scarecrow.

### Debug Log References

- **Tests:**
  - New: `tests/sim/scenarios/decorations.test.ts` (3) covers:
    - a purchase changes only `money`/`owned` and emits only `Bought`, against a clone run through the same tick;
    - two seeded games, one owning both decorations, stay `toStrictEqual` (states and events) over `TUNING.lambUntilMs` of Farm, FarmBreeding and a Sell;
    - owning decorations leaves tier 0's capacity and fence.
  - Also new: two selector tests (`isDecoration`/`DECORATIONS`; every shop item is Land xor a decoration).
  - The tests were red before the selectors existed.
  - `busyGame` now owns `['land1', 'flowerPatch', 'scarecrow']`, so the round-trip covers both decorations.
  - `npm test`: 564 passed (559 before); `npm run typecheck` and `npm run lint` clean.
- **Browser:** Playwright + Chrome SwiftShader, DEV server on port 5203, scratchpad probes p1–p7. There were no console or page errors in any run.
  - 6.1: in a new game, the field has no decorations. With the shop open, buying the Flower Patch shows it popping in with dust (frame captured 90 ms after the click), right of the panel, and the row reads "Owned". The Scarecrow did the same. `owned` = `["flowerPatch","scarecrow"]`.
  - 6.2:
    - Tiers 0, I, II and III were bought through the shop and screenshotted with it open and closed. Both decorations were fully on screen, outside the fence and clear of the hole, the stall and the bar at every tier.
    - From Land I on, they stand just above the top rail.
    - Right-drag pans to the left, right, up and down limits at tier 0 kept both in view (contact sheet `p3-pans.png`).
  - 6.2, HUD clearance (code review): the era badge does not exist until 3.5, so it could not be checked in the browser. By the numbers, its projected spot at the Land II/III scroll (world y 72–112, x ≥ 1112) misses the Scarecrow (x ≤ 1020); 3.5 checks it on screen (deferred-work). Toasts were not captured over the Flower Patch in any probe. They are DOM, non-interactive and last 4 s, so they can only pass over it briefly.
  - 6.3:
    - While a sheep was dragged, the armed glow, the "+2× Food" label, the stall outline and the "$10" tag all stayed clear of both decorations.
    - Dropping the sheep with the pointer on the Scarecrow was a plain drop: it landed back in the pen at (878, 386), and sold, sacrificed and the flock size were unchanged.
    - Hovering either decoration gave canvas cursor `""` and no tooltip.
    - A right-drag starting on the Flower Patch panned the view.
  - 6.4: with 103 sheep packed into Land III, no sheep reached the decorations; the inner fence top is y 224, the feet are at 176 (`p7-100-land3.png`).
  - 6.5:
    - Pause → Main Menu → page reload → Continue: both decorations were drawn at full size on the first frame (screenshot 30 ms after the click: no pop, no dust), and both rows read "Owned".
    - A debug Load of a copied save that owns only the Scarecrow showed only the Scarecrow.
  - 6.6: at 960×540, both decorations are legible and nothing overlaps, with the shop open and closed.
  - 6.7: 103 sheep at Land III with both decorations, ×1, overlay open, 150 s sampled every 5 s (30 samples). Median 33, min 29, max 34. The load average rose from 2.3 to 7.9. 3.3's figure was 31 on a similarly loaded machine, so there is no regression.
  - 6.8: no console errors or page errors in any probe.

- **Code review fixes (2026-10-07)**: all 7 patches applied.
  - **Tests:**
    - Scenario (b) sells at `Math.floor(ticks / 2)` and asserts a `Sold` event happened.
    - Scenario (c) asserts `owned` after the purchase.
    - The event lists are compared with `toStrictEqual`.
  - **Layout invariant:**
    - It now checks `BETTER_PLACE_BOUNDS` as well as the glow.
    - Its fence rect comes from the new `fenceDrawnBounds` in `Fence.ts` (posts included: top − 4, bottom + 6, sides ± 1), plus the 2 px margin. The fence's margin top is still y 178 from Land I up, against the decorations' feet at 176.
  - **New DEV frame checks:** `Fence` checks the fence-post frame (6×22) and `BetterPlace` checks the glow frame (140×78) against the sizes the bounds assume.
  - **HUD clearance:** the era badge and toast note is added to the Debug Log, with a 3.5 era-badge check in deferred-work.
  - **Checks run:**
    - Tests 564 passed; typecheck and lint clean.
    - A DEV smoke run (port 5203) built the scene, bought both decorations and Land I–III through the shop, with no errors (every DEV invariant passed).

### Completion Notes List

- 2026-10-07: Story created. Ultimate context engine analysis completed - comprehensive developer guide created.
- 2026-10-07: Implemented. All ACs met:
  - AC 1: pop-in and dust on purchase, and the row reads "Owned" (6.1).
  - AC 2: fixed spots clear of the fence, the hole and the stall, in view at every tier, shop open or closed (DEV invariant; 6.2, 6.3).
  - AC 3: no gameplay effect (scenario tests; 6.3 drop, hover and pan).
  - AC 4: restored on Continue and Load with no pop; no schema bump (busy round-trip; 6.5).
  - AC 5: sheep-world atlas images built once, depth = foot y.
  - AC 6: no `PublicSheep`/`HudView` change; the view reads `owned` through `isOwned` only.
  - AC 7: tests, typecheck and lint pass, plus browser checks and FPS.
- Beyond the story text: a DEV check in `Decorations` that each frame's real size matches the size the layout invariant assumes (noted in deferred-work).

### File List

- New:
  - `src/view/field/Decorations.ts`
  - `assets/art/world/flower-patch.png`
  - `assets/art/world/scarecrow.png`
  - `tests/sim/scenarios/decorations.test.ts`
- Modified:
  - `src/sim/selectors.ts`
  - `src/sim/systems/economy.ts` (comment only)
  - `src/view/assetKeys.ts`
  - `src/view/field/BetterPlace.ts`
  - `src/view/field/Fence.ts` (code review)
  - `src/view/field/depths.ts` (comment only)
  - `src/view/scenes/GameScene.ts`
  - `assets/CREDITS.md`
  - `tests/save/busy.ts`
  - `tests/sim/selectors.test.ts`
  - `_bmad-output/implementation-artifacts/deferred-work.md`
  - `_bmad-output/implementation-artifacts/sprint-status.yaml`
- Regenerated:
  - `public/assets/atlases/sheep-world.json`
  - `public/assets/atlases/sheep-world.png`

### Change Log

- 2026-10-07: Story 3.4 implemented. The Flower Patch and Scarecrow are drawn at fixed spots above the fence from `owned` and pop in when bought. They have no sim effect and need no save change. Status set to review.
- 2026-10-07: Code review. 7 patches applied (tests tightened; the layout invariant covers the hole and the drawn fence; DEV frame checks for the fence post and the glow; HUD clearance recorded), 1 deferred (DEV-only layout checks not under `npm test`), 5 dismissed. Status set to done.
