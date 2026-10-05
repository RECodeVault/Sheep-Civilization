---
title: "Game Brief: Sheep Civilization"
status: final
created: 2026-10-05
updated: 2026-10-05
---

# Game Brief: Sheep Civilization

## Executive Summary

Sheep Civilization is a 2D active clicker for the browser. The player farms food, feeds a flock of cute pixel sheep, breeds them, and builds the flock up from a single pasture into a sheep civilization. It looks cozy, but the systems underneath are not. Hungry sheep starve. Carcasses left in the field infect the sheep that eat them. Elders have to be sent to the Better Place, a hole in the field, before old age gets them. Sometimes a lamb is born that isn't really a lamb.

The game asks for the player's attention. It pauses when the tab is hidden and never punishes anyone for leaving. While the player is watching, though, the flock's survival depends on them noticing things: a sheep getting thin, a carcass nobody has cleared, a lamb walking slightly wrong.

This is a solo portfolio piece, built in one week with Phaser 3 and TypeScript and playable in any browser. It is meant to show, in a few minutes of play, that several simple systems can combine into a game with a recognizable tone.

## Vision

**Core concept:** Raise a cute, fragile flock from one pasture into a thriving sheep civilization, while keeping an eye out for the rot inside it.

**Core fantasy:** You are the shepherd who notices. The flock lives because you watch it closely.

**Emotional experience:** Warm attachment to the flock, punctured by dark laughs. The player should feel a little guilty when they choose between selling a sheep and dropping it into the Better Place, and a little smug when they catch the Abomination.

## Target Players

- **Primary: portfolio reviewers.** Recruiters, hiring managers, and other developers who open the link and play for about 2–3 minutes. They need to understand the loop right away and see polish, readable systems, and a distinct tone. No specific role is targeted.
- **Secondary: casual browser players** on itch.io who like cozy games with a dark streak, the kind of player who enjoys *Cult of the Lamb* or *Insaniquarium*. They play in 10–30 minute sittings and come back to a persistent save to push toward the next era.

## Core Fundamentals

**Genre:** Active clicker and creature-care sim, with light incremental progression.

**Core loop:**
1. **Farm.** Click to fill the food meter and the separate breeding food meter.
2. **Feed.** Drop food pieces. Sheep walk over to eat them; sheep that go unfed starve.
3. **Contain.** Clear carcasses before other sheep eat them. A sheep that eats a carcass gets infected, turns green, and dies.
4. **Breed.** Give breeding food to two adults to produce a lamb, which grows into an adult and then an elder.
5. **Decide.** Sell adults for money (land and upgrades), or sacrifice any sheep in the Better Place for a temporary food boost. Elders can't be sold, so they either go to the Better Place or die of old age and leave a carcass.
6. **Grow.** Land expands the flock's capacity, and population milestones advance the era.

**Gameplay pillars:**
1. **Attention is the resource.** The simulation runs only while the player watches, and it rewards watching. Hunger, infection, and the Abomination all show visible tells. Automation such as the auto-feeder helps, but walking away from the screen should never be a viable way to play.
2. **Cute on the surface, consequences underneath.** Every dark mechanic (starvation, the carcass virus, sacrifice, the Abomination) is shown in a cozy, comedic way, never a grim one.
3. **Every sheep is a decision.** Sell for money, sacrifice for food, breed for growth, or let it age. Each sheep is a resource the player spends, not a counter that only goes up.
4. **Growth you can see.** Eras change how the world looks as the flock grows, which gives the player a long-term goal across sessions.

## References & Differentiation

| Title | Take | Leave |
|---|---|---|
| *Insaniquarium* | Clicking to drop food, visible hunger, creatures that turn green and die | Its frantic pace and alien attacks |
| *Cult of the Lamb* | Cute sacrifice, corpse cleanup as pressure on the colony, sacrifice traded for a buff | Combat and deep base management |
| *Cookie Clicker* | Satisfying click feedback and an upgrade shop | Prestige layers and huge numbers |
| *Divide by Sheep* | The contrast between cute sheep and grim fates as the hook | Puzzle structure |
| *Plague Inc.* | Infection spread the player can read at a glance | The strategy layer |

**What makes it different:** the hidden-killer mechanic (the Abomination) and contagion spread through carcasses, inside a cozy clicker. This mix is not found in other sheep or clicker games. Several sheep clickers exist on itch.io, but all are generic "click a sheep, get coins" games, and none found has survival, contagion, or sacrifice mechanics. Market positioning is not a goal for this project. Beyond that, the edge is execution and feel, not a technical advantage.

## Scope & MVP

- **Platform:** Desktop web browser, deployed to GitHub Pages and itch.io. Mobile is not a target.
- **Team:** Rylan, working solo. Rylan has some prior Phaser experience, so learning the engine doesn't take up the week.
- **Timeline:** 7 days. The tiers are built in order, and each tier must be playable before the next one starts. Day 7 is reserved for bug fixes and polish.
- **Budget:** None. Art comes from free asset packs such as Kenney.nl.
- **Tech:** Phaser 3, TypeScript, and Vite. Game state lives in a single plain object for easy saving and testing. The game autosaves to localStorage and pauses on `visibilitychange`. There is no offline progress.

**Must have (days 1–4):** farm and feed buttons; per-sheep hunger and starvation; lamb → adult → elder life stages (only adults can be bred or sold, and elders cannot be sold); old-age death; the Better Place (drag a sheep into it for a fixed sacrifice boost); carcass timer and removal; virus from eating carcasses; breeding food and breeding; market (selling adults); shop (land expansion and 1–2 decorations); **eras as visual milestones** (thresholds at 10 / 25 / 50 sheep, each with a background swap); a lose screen with restart; autosave; and pause when the tab is hidden.

**Should have (days 5–6):** the Abomination, medicine, a link between overcrowding and infection, click upgrades plus an auto-feeder, sheep names, juice and audio, and a stats panel.

**Nice to have (day 7, only if ahead):** a wolf or drought event, changing market prices, and achievements.

**Out of scope:** genetics, sheep jobs, prestige, offline progress, extra crop types, sheep-built buildings, and mobile.

**MVP hypothesis:** The Must-have tier alone should answer one question: *is keeping a cute flock alive against hunger and carcass contagion compelling enough that sell-or-sacrifice choices feel meaningful?*

## Content & Direction

- **Setting:** a single pasture, seen from one fixed screen, that changes its look with each era (Pasture → Village → Town).
- **Narrative:** no story text. Stories come out of the systems, and sheep names make each loss land harder.
- **Art:** cute pixel art from free packs. Infection is shown with a green tint. The Abomination's tells are animation and behavior (an off-step walk, other sheep keeping their distance), not a different sprite.
- **Audio:** light, cozy music and comedic bleats, also from free packs.
- **Content breadth:** 3 eras, 1–2 decorations, a few upgrades. Play time is open-ended, with the eras as the long-term goal.

## Risks & Open Questions

1. **Scope.** Even after the trims, the Must-have tier has about 14 systems for 4 solo days. Mitigation: build in the order feed, starve, carcass, infection, and keep each tier playable.
2. **Abomination clues may be too subtle.** At pixel scale, players may never spot it, and the deaths it causes would then feel random. Mitigation: playtest with at least one other person, and exaggerate the tells if needed.
3. **The dark twist may not show up in a 2-minute portfolio visit.** The developer chose not to script an early dark moment. Accepted risk: a quick viewer might see only the cozy layer.
4. **Fail state vs. attachment.** Losing the whole flock ends a long-term save. Decision: keep the hard lose screen. The stakes are the point, and the pause on a hidden tab means a loss is never caused by being away.
5. **Open for the GDD:** era thresholds and unlocks, the food economy and numbers, Abomination spawn and kill rates, how the auto-feeder is limited so it doesn't replace active play, and the camera and view.
