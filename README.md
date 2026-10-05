# Sheep Civilization

A 2D clicker / idle game where you farm crops, feed and breed a flock of sheep, keep disease from wiping them out, and grow a humble pasture into a thriving sheep civilization.

> Status: **Pre-production.** Planning is being done with [BMAD](https://github.com/bmad-code-org/BMAD-METHOD). Engine and tech stack have not been chosen yet.

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
docs/
  concept/        Original pitch and brainstormed ideas
  design/         Game Design Document (GDD), UX/HUD specs
  architecture/   Technical architecture decisions
src/              Game source code (layout decided once the engine is chosen)
tests/            Automated tests
assets/
  art/            Sprites, UI art, backgrounds
  audio/          Music and sound effects
  fonts/          Fonts
```

BMAD installs its own folders (for example `_bmad/` and `_bmad-output/`) when you set it up. Commit those as well so the planning artifacts stay with the code.

## Getting started

See [`docs/concept/ideas.md`](docs/concept/ideas.md) for the original pitch and the expanded idea list. That file is the starting input for the BMAD game brief and GDD.
