---
title: Sheep Civilization - Development Epics
gdd: ./gdd.md
created: 2026-10-05
updated: 2026-10-05
---

# Sheep Civilization: Development Epics

The schedule is a 7-day solo build. Each epic must end in something playable before the next one starts. The build order inside the Must tier follows the brief's risk mitigation: **feed → starve → carcass → infection**.

---

## Epic 1: Flock Survival Core (Days 1–2, Must)

**Goal:** the smallest loop that can kill a sheep, and the controls that can save it.

**In scope:**
- A single pasture screen and a 16:9 canvas scaled to the window
- Sheep that wander (all sheep are adults for now)
- Hunger 0–100, drained over 120 s, with Fed, Hungry and Starving visual states
- Farm button fills an 8-click bar; every full bar drops a food piece at a random spot in the pen, and sheep walk to it and eat (+35). No food stock (changed 2026-10-06).
- Starting flock: 3 sheep at Fullness 60
- Starvation death. In this epic, the sheep simply disappears; carcasses come in Epic 2.
- Lose screen at 0 sheep, with a Restart button that wipes the save
- Autosave every 10 s and when the tab is hidden; resume on load; pause on `visibilitychange`
- Hover tooltip showing stage and hunger state
- Esc pause menu; optional F / G keyboard shortcuts for Farm / Farm Breeding Food

**Out of scope:** life stages, breeding, carcasses, money.

**Dependencies:** none.

**Playable deliverable:** a player can keep 3 sheep alive by farming and feeding, or watch them starve and lose.

**Stories (high level):**
1. Project scaffold, canvas and pasture screen
2. Sheep wandering and the sheep data model
3. Fullness drain and the hunger visual states
4. The Farm button, its 8-pip progress bar and the food pieces it drops
5. Sheep seeking and eating food
6. Starvation death and the lose screen with Restart
7. Save, load and pause on hidden tab

---

## Epic 2: Life, Death & Contagion (Days 2–3, Must)

**Goal:** the full dark loop: death leads to a carcass, then infection, then more death.

**In scope:**
- Life stages: lamb 0–60 s, adult 60–300 s, elder 300–420 s, then death from old age
- The Farm Breeding Food button fills a bar that drops breeding pieces; adults that eat one become ready (changed 2026-10-06). Breed tool: ready adult A, then ready adult B, lamb born after 10 s. Each adult has a 60 s breeding cooldown.
- Carcasses from every non-sacrifice death. They never disappear on their own and are cleared with 1 click.
- A Starving sheep eats a carcass only when no food piece is on the field
- Virus: eating a carcass means instant green tint, death after 20 s, and a new carcass
- The Better Place: drag any sheep in. No carcass is left, and Farm clicks give 2× food for 30 s (repeat sacrifices reset the timer).
- Drag versus click threshold of 6 px
- The starting flock becomes 2 adults aged 60 s and 1 newborn lamb (matching the GDD); the breeding bar starts empty

**Out of scope:** money, shop, eras, medicine.

**Dependencies:** Epic 1.

**Playable deliverable:** a neglected flock collapses through a contagion chain, and the player can break the chain by clearing carcasses or sacrificing infected sheep.

**Stories (high level):**
1. Life stages and old-age death
2. Breeding food bar and pieces, and the Breed tool
3. Carcass spawning and clearing
4. Carcass eating and virus infection
5. Better Place drag-to-sacrifice, the food boost, and handling for sheep dropped on the wrong target (Market vs Better Place)

---

## Epic 3: Economy & Eras (Day 4, Must). The MVP is complete here.

**Goal:** a reason to grow, and visible growth.

**In scope:**
- Market stall drop target: sell adults for $10 and elders for $5. Lambs cannot be sold.
- Money display and shop panel
- Land I / II / III for $50 / $150 / $400, raising capacity 10 → 25 → 50 → 100. Breeding is blocked at capacity.
- Decorations: Flower Patch ($40) and Scarecrow ($80), cosmetic only
- Eras by sheep alive right now: Pasture, Village (10), Town (25), Wool Empire (50). Four backgrounds with a crossfade and an era banner. Eras regress when the flock drops below a threshold.

**Out of scope:** click upgrades, auto-feeder, medicine.

**Dependencies:** Epic 2.

**Playable deliverable:** the full Must-tier game. Test the MVP hypothesis here.

**Stories (high level):**
1. Market stall selling
2. Shop panel and money
3. Land capacity upgrades
4. Decorations
5. Era thresholds, backgrounds and regression

---

## Epic 4: Hidden Threats & Upgrades (Day 5, Should)

**Goal:** the hook (a killer lamb), counterplay against disease, and the upgrade shop, so that day 7 stays free for polish.

**In scope:**
- The Abomination:
  - The first one is guaranteed on a random birth between the 8th and 15th; after that, 5% per birth; at most 1 alive
  - Stays a lamb forever, never dies of old age, and counts toward capacity and eras
  - Off-step walk cycle; other sheep keep 36 px from it instead of the normal 24 px
  - Kill cycle every 45–60 s: it walks up to any other sheep, pauses for 1 s, walks away, and the victim dies 5–10 s later, leaving a carcass
- Sacrifice reveal: the Abomination flashes its true form with a sting; an innocent sheep gets the caption "…that was just a sheep."
- Medicine for $15: drag it onto a green sheep to cure it
- Overcrowding: at 90% or more of capacity, every 30 s a random sheep has a 20% chance of infection
- Better Hoe I / II for $30 / $100, raising a Farm click to 2 / 3 pips
- Auto-feeder for $120 (only 1): drops 1 piece next to the hungriest sheep every 10 s [redesign pending since 2026-10-06: there is no food stock, so Story 4.8 decides what feeds it]

**Out of scope:** an Abomination payout or achievement.

**Dependencies:** Epic 3 (the shop, for medicine and upgrades; capacity, for overcrowding).

**Playable deliverable:** the full Should-tier ruleset. An attentive player can spot the Abomination and remove it.

**Stories (high level):**
1. Abomination spawn rules and stats
2. Off-step animation and flock-avoidance behavior
3. Kill cycle with a delayed victim death
4. Sacrifice reveal
5. Medicine purchase and cure
6. Overcrowding infection roll
7. Click upgrades and auto-feeder

---

## Epic 5: Names, Juice & Ship (Days 6–7, Should + Polish)

**Goal:** feel, first impressions and a deployed build. Day 6 covers the content below, plus a playtest. Day 7 is juice, audio, fixes and deployment only.

**In scope:**
- Day 6:
  - Random sheep names (a list of at least 100), shown on hover, in death announcements, and in the reveal caption ("…that was just {name}.")
  - Stats panel: alive, sold, died, sacrificed, money earned
  - The "Last sheep!" warning at a flock of 1
  - Playtest with at least 1 other person (Abomination readability, first 60 s)
- Day 7:
  - Juice: button squash, +N popups, bouncing food, munch particles, death puff, sacrifice sparkle, boost glow
  - Audio: about 10 SFX and 1 music loop
  - Credits screen
  - Performance check: 60 FPS with 100 sheep
  - Deployment to GitHub Pages and itch.io

**Out of scope:** everything in the GDD's Nice-to-have list.

**Dependencies:** Epic 4. Juice and audio can start earlier if time allows.

**Playable deliverable:** the shipped portfolio build.

**Stories (high level):**
1. Names and death announcements
2. Stats panel and the last-sheep warning
3. Visual juice pass
4. Audio pass
5. Performance check and deployment

---

## Mechanic → Epic coverage

| Mechanic | Epic |
|---|---|
| Hunger, Farm, Feed, starvation, lose, save and pause | 1 |
| Life stages, breeding, carcasses, virus, Better Place | 2 |
| Market, land, decorations, eras | 3 |
| Abomination, sacrifice reveal, medicine, overcrowding, click upgrades, auto-feeder | 4 |
| Names, stats, last-sheep warning, juice, audio, deployment | 5 |
