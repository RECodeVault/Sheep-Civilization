# Sheep Civilization

A 2D clicker / idle game where you farm crops, feed and breed a flock of sheep, keep disease from wiping them out, and grow a humble pasture into a thriving sheep civilization.

> Status: **In development (Epic 1).** Planning is done with [BMAD](https://github.com/bmad-code-org/BMAD-METHOD); the planning artifacts live in `_bmad-output/`.

**Stack:** Phaser 4.2, TypeScript 6 (`strict`), Vite 8, Vitest 4.1, ESLint 10 + typescript-eslint, Node 24 LTS. Desktop browsers only; deployed as a static site.

## Core loop

1. **Farm.** Click the farm button to grow crops and fill the food meter.
2. **Feed.** Click the feed button to drop food for the sheep. Sheep that go hungry die.
3. **Contain.** Clean up dead sheep quickly. Sheep that eat a carcass catch a virus that can spread through the flock.
4. **Breed.** Give breeding food to two sheep to produce a lamb.
5. **Sell or sacrifice.** Sell full-grown sheep at the market for money to buy land, upgrades and decorations, or send them to the Better Place before they die of old age.
6. **Hunt.** Breeding can rarely produce a hidden abomination that secretly kills the flock. Find it and send it to the Better Place.

You lose if every sheep dies.

## Repository layout

```
src/
  main.ts         Phaser game config, font loading, scene list
  config/         constants.ts (tick, canvas, storage keys, DESIGN.md tokens), tuning.ts (balance values)
  core/           Engine-free utilities: log, invariant, format, eventBus, types
  sim/            Pure game rules (no Phaser, no DOM) — lint-enforced
  save/           localStorage save/settings (the only code allowed to touch storage)
  input/          InputController
  view/           Phaser scenes, field sprites, HUD, overlays, widgets, juice, audio
  debug/          DEV-only debug overlay
tests/            Vitest tests, mirroring src/ (core, sim, save)
scripts/          Build-time tools (asset packing)
assets/           Source assets (art, audio, fonts + licences, CREDITS.md)
public/assets/    Built runtime assets served by the game
docs/             Concept notes; planning documents are in _bmad-output/
```

The architecture is in [`_bmad-output/game-architecture.md`](_bmad-output/game-architecture.md) and the rules for contributors (human or AI) are in [`_bmad-output/project-context.md`](_bmad-output/project-context.md).

## Getting started

```bash
nvm use          # Node 24 (.nvmrc)
npm install
npm run dev      # dev server
```

| Script | What it does |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run build` | Production build to `dist/` (relative base, works on any subpath) |
| `npm run preview` | Serve the production build locally |
| `npm test` | Vitest (core, sim and save tests) |
| `npm run lint` | ESLint, including the architecture boundary rules |
| `npm run typecheck` | `tsc --noEmit` for `src/` and `tests/`, then for `scripts/` (Node types) |
| `npm run assets` | Pack the texture atlases and sync fonts into `public/assets/` (see below) |
| `npm run zip` | Package `dist/` for itch.io (arrives in Story 5.2) |

### Assets

Source art lives in `assets/art/` as loose PNGs, one file per frame, named in kebab-case `entity-state[-n]` (for example `adult-walk-2.png`). `npm run assets` packs them with free-tex-packer-core into two JSON-hash atlases (each at most 2048×2048):

| Source folders | Atlas |
|---|---|
| `assets/art/sheep/`, `assets/art/world/` | `public/assets/atlases/sheep-world.{png,json}` |
| `assets/art/ui/` | `public/assets/atlases/ui.{png,json}` |

It also copies `assets/fonts/*.woff2` to `public/assets/fonts/`. The output is committed, so deploying needs only `vite build`. Re-run `npm run assets` after changing any source art or font, and credit new assets in `assets/CREDITS.md`. The audio sprite arrives in Story 5.6.

A change is done when `npm test`, `npm run typecheck` and `npm run lint` all pass.

See [`docs/concept/ideas.md`](docs/concept/ideas.md) for the original pitch and the expanded idea list.
