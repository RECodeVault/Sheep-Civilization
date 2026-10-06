---
title: Sheep Civilization - Game Design Document
game_type: idle-incremental
platforms: [desktop-web]
created: 2026-10-05
updated: 2026-10-05
status: final
version: 1.0
source_brief: _bmad-output/planning-artifacts/briefs/brief-sheep-civilization-2026-10-05/brief.md
---

# Sheep Civilization - Game Design Document

**Author:** Rylan
**Game Type:** Idle/Incremental (active clicker with creature care)
**Target Platform(s):** Desktop web (GitHub Pages, itch.io)

---

## Executive Summary

### Core Concept

Sheep Civilization is a 2D, single-screen, active clicker for the browser. The player farms food, feeds and breeds cute pixel sheep, and grows one pasture through four eras into a Wool Empire. Under the cozy surface, the systems are dark: sheep starve, carcasses spread a fatal virus, the Better Place takes a sheep in exchange for a food boost, and a killer lamb (the Abomination) hides among the flock.

**Core fantasy:** *You are the shepherd who notices.* The flock survives because the player watches it.

**Emotional target:** warm attachment, punctured by dark laughs. The player should feel slightly guilty choosing between selling and sacrificing a sheep, and slightly smug when they catch the Abomination.

### Target Audience

- **Primary:** portfolio reviewers (recruiters, hiring managers, developers) in a 2–3 minute visit. They must grasp the loop and the tone within 60 s, with no tutorial text beyond button labels and tooltips.
- **Secondary:** casual itch.io players who like cozy-but-dark games (Cult of the Lamb, Insaniquarium). They play 10–30 minute sessions on a persistent save.

### Unique Selling Points (USPs)

1. **A hidden killer inside a cozy clicker.** One lamb in the flock may be a murderer, and it can only be identified by watching how it behaves.
2. **Contagion through carcasses.** Neglect compounds: one death leads to a carcass, an infection, another death and another carcass. The chain is readable at a glance.
3. **Every sheep is a decision.** Selling, sacrificing and keeping each have a real cost. The dark option (the Better Place) is often the smart one.

Existing sheep clickers (itch.io, iOS) are "click sheep for coins". None of them combine survival, contagion and sacrifice. The search was not exhaustive.

### Comparables: Take / Leave

| Game | Take | Leave |
|---|---|---|
| Insaniquarium | Click to drop food, visible hunger, creatures that turn sick and die | Alien attacks. Its frantic pace is partly kept: "somewhat frantic", 120 s to starve (see decision log). |
| Cult of the Lamb | Cute sacrifice, corpse cleanup as hygiene pressure, sacrifice traded for a buff | Combat, deep base management |
| Cookie Clicker | Click feedback, upgrade shop | Prestige, huge numbers |
| Divide by Sheep / Flockers | Contrast between cute sheep and a grim fate | Puzzle structure |
| Plague Inc. | Infection spread you can read at a glance | Strategy layer |
| Viridi / Tamagotchi | Gentle needs | Decay while away (the game pauses when the tab is hidden) |
| RimWorld | Dark stories that emerge from simple systems | Simulation depth |

---

## Goals and Context

### Project Goals

1. **Ship a playable, polished build in 7 days**, solo: Must tier on days 1–4, Should tier on days 5–6, polish on day 7. Each tier must be playable before the next starts.
2. **Portfolio proof:** within a 2–3 minute visit, show that simple systems can combine into a game with a recognizable tone.
3. **Validate the MVP hypothesis:** is keeping the flock alive against hunger and carcass contagion compelling enough to make the sell/sacrifice choices feel meaningful?

### Background and Rationale

This is a solo portfolio piece built with Phaser 3, TypeScript and Vite. The game's edge is execution and feel, not technology. First impressions and polish count more than market reach. Art and audio come from free packs (e.g. Kenney.nl). There is no budget and no monetization.

---

## Core Gameplay

### Game Pillars

1. **Attention is the resource.** The pace is *somewhat frantic*: an unfed sheep dies in 120 s, so the player cannot look away for long. Every threat (hunger, carcasses, infection, the Abomination) shows a visible tell before it becomes fatal. A player who watches can always save the flock.
2. **Cute on the surface, consequences underneath.** Dark systems are presented comedically, never grimly. Death, contagion and sacrifice all play out through cute sprites, bleats and slapstick timing.
3. **Every sheep is a decision.** Each sheep can be kept, sold, sacrificed or bred, and each option costs something. The flock is never a pile of interchangeable coins.
4. **Growth you can see.** Progress is spatial and visual: more sheep on screen, more land, and the background changing as the flock reaches each era.

Pillar test: without pillar 1 the game is Cookie Clicker; without pillar 2 it is a tamagotchi; without pillar 3 sheep are just currency; without pillar 4 there is no reason to keep playing.

### Core Gameplay Loop

**Farm → Feed → Contain → Breed → Decide → Grow → (Farm…)**

| Step | Player action | Outcome / reward | Pillar |
|---|---|---|---|
| Farm | Click Farm (food) and Farm Breeding Food | Food meters fill | 1 |
| Feed | Click the field to drop food pieces | Sheep walk to the food and eat; Fullness refills | 1, 2 |
| Contain | Click carcasses away; drag infected or suspicious sheep to the Better Place | The contagion chain breaks; the sacrifice grants a food boost | 1, 2, 3 |
| Breed | Pair two adults using breeding food | A lamb is born (1 in 20 is the Abomination) | 3, 4 |
| Decide | Sell, sacrifice or keep each adult or elder | Money, a boost, or a bigger flock | 3 |
| Grow | Buy land and upgrades; reach era thresholds | Higher capacity, a new background, more sheep to manage | 4 → back to 1 |

**Why players run the loop a hundredth time:** a bigger flock makes the attention problem harder, since there are more mouths, more deaths and more carcasses. Every birth may be the Abomination. The loop gets more tense as the flock grows; it does not rely on new content.

### Win/Loss Conditions

- **Win:** none. The game is open-ended. The **Wool Empire** era (50 sheep alive) is the aspirational goal.
- **Loss:** the flock reaches **0 sheep alive**. A lose screen shows time survived and peak flock size, plus a **Restart** button, which wipes the save. This is a hard loss.
- A "**Last sheep!**" warning (Should tier) plays when the flock drops to 1.
- One surviving sheep cannot breed, so it will eventually die of old age. This is intended: the last-sheep state is a slow loss, not a soft-lock.
- **Hidden tab:** the game pauses while the browser tab is hidden. Nothing progresses while the player is away, so the player cannot lose while away.

---

## Game Mechanics

### Primary Mechanics

All timings are in game-seconds. The game is paused while the tab is hidden. Values marked **(tune)** are starting values for playtesting.

#### Hunger (Fullness stat)

Each sheep has a **Fullness** stat: 100 means full, and the sheep dies at 0. Players only see the Fed, Hungry and Starving states.

| Parameter | Value |
|---|---|
| Fullness range | 0–100 per sheep; the sheep dies at 0 |
| Drain | 100 → 0 over **120 s** (−0.83/s) |
| **Fed** (above 50) | normal walk and normal bleats |
| **Hungry** (50–25, starts 60 s after the last meal) | droops, bleats twice as often |
| **Starving** (below 25, starts at about 90 s) | visibly thin, frantic bleats; may eat carcasses |
| Food piece | **+35** Fullness, capped at 100 |
| Starting flock | 2 adults aged **60 s** and 1 newborn lamb, all at **Fullness 60**, so the first sheep goes thin at about 42 s. The founding adults become elders at about 4 min and die of old age at about 6 min. That gives a short visit its first carcass and a "sell the elders?" decision without any scripted event. |

#### Farming and Feeding

| Parameter | Value |
|---|---|
| **Farm** button | Each click fills 1 pip of an **8-pip** progress bar (tune). A full bar adds **+1 food** to the food stock and resets; leftover pips carry over. Stock cap **20**, start with 5. When the stock is full, the food drops onto the field as a piece instead (at a random reachable spot), so clicking is never wasted and food can be stockpiled on the field. |
| **Farm Breeding Food** button | +1 breeding food per click. Breeding meter cap **10**. Start with 0. |
| **Feed** (click the field) | Drops 1 food piece at the cursor and costs 1 food. No food means no drop and an empty-meter shake. |
| Sheep seek food | The nearest non-full sheep (Fullness below 90) walks to the nearest piece. Walk speed **60 px/s** (tune). |
| Uneaten pieces | Stay on the field until eaten. They never spoil. |

#### Life Stages

| Stage | Age | Can breed | Can sell | Notes |
|---|---|---|---|---|
| Lamb | 0–60 s | No | No | Smaller sprite |
| Adult | 60–300 s | Yes | Yes, **$10** | |
| Elder | 300–420 s | No | Yes, **$5** | Greyer sprite. Dies of old age at 420 s and leaves a carcass. |

#### Breeding

1. Choose the **Breed** tool.
2. Click adult A, then adult B.
3. This costs **3 breeding food**.
4. A heart appears, and a lamb is born beside them **10 s** later.

**Breeding cooldown:** each adult can breed once every **60 s** (tune). The cooldown starts at breeding, so a pair cannot breed again while their lamb is on the way. A sheep on cooldown shows a small heart-outline icon on hover.

Breeding is blocked (the button greys out) while the flock is at land capacity. A pending lamb occupies a capacity slot from the moment of breeding.

#### Market (Selling)

Drag an adult or elder onto the **Market stall** at the screen edge to sell it: adults for $10, elders for $5. Lambs cannot be sold.

The Market stall and the Better Place are both drop targets, so dropping a sheep on the wrong one is possible and played for comedy.

#### The Better Place (Sacrifice)

A hole in the field. Drag **any** sheep into it, including lambs, infected sheep and the Abomination.

- The sheep is gone and leaves **no carcass**.
- Each sacrifice **doubles the pips each Farm click fills, for 30 s**. Sacrificing again during a boost resets the timer to 30 s; boosts do not stack.
- The boost applies to the Farm (food) button only, not to Farm Breeding Food.
- Overflow food drops onto the field, so the stock cap no longer limits the boost. Its value is about 30 s of farming at double speed, which matters most when feeding a large flock.
- It is the player's **cheap cure for infection** in the Must tier: sacrificing an infected sheep removes it before it becomes a carcass.

#### Carcasses

| Parameter | Value |
|---|---|
| Source | Any death except a sacrifice: starvation, old age, virus or Abomination |
| Lifetime | Stays until cleared; never disappears on its own |
| Clearing | **1 click** removes it |
| Danger | Infectious from the moment it appears |
| Who eats them | A **Starving** sheep (Fullness below 25) eats a carcass only when no food piece is on the field |

#### Virus

| Parameter | Value |
|---|---|
| Infection | Eating a carcass infects the sheep 100% of the time |
| Tell | The sheep turns **green** right away |
| Outcome | Death **20 s** after infection, leaving a carcass, which continues the chain |
| Must-tier counters | Feed sheep so none starve; clear carcasses; sacrifice infected sheep |
| Should-tier counter | Medicine (see below) |

#### The Abomination (Should tier)

| Parameter | Value |
|---|---|
| Spawn | The **first** Abomination is guaranteed on a random birth between the **8th and 15th** birth of a save. After that, **5%** per birth. At most **1** alive at a time. |
| Appearance | The same sprite as a normal lamb |
| Ageing | **Never grows past the lamb stage**, so it can never be sold. This is a long-horizon tell for attentive players. It never dies of old age. |
| Fullness | Normal, so it eats like any lamb. It counts toward capacity and eras. |
| Kill cycle | Every **45–60 s** (random) it picks a random victim (any sheep except itself), walks up to it, pauses for **1 s** next to it, then walks away. The victim dies **5–10 s** later (random) and leaves a carcass. |
| Moment-to-moment tells | An **off-step walk cycle**; other sheep keep **36 px** from it instead of the normal **24 px** personal space (tune) |
| At the moment of contact | **No obvious tell**, only the brief visit followed by a delayed death |
| Removal | Sending it to the Better Place. A wrong guess costs an innocent sheep. |
| Reveal | As any sacrificed sheep falls in, the game shows the truth. The Abomination flashes its true form with a screech and a sting. An innocent sheep gets a comedic caption: "…that was just {name}." ("…that was just a sheep." before names exist). There is no payout. The payoff is the smug moment. |
| Readability fallback | If playtests show the tells are too subtle at pixel scale, exaggerate the off-step animation first. |

#### Medicine (Should tier)

Buy a dose for **$15** from the shop, then drag it onto a green sheep to cure it right away.

#### Overcrowding (Should tier)

While the flock is at **90% or more** of capacity, every **30 s** one random sheep has a **20%** chance to become infected. This links land to disease. (tune)

Each era threshold equals a land capacity (10, 25, 50), so the player always enters a new era at full capacity, while overcrowding rolls are active. **This is deliberate:** reaching an era should feel risky.

#### Sheep Names (Should tier)

Each sheep gets a random name from a list of at least 100. The name shows on hover, and deaths are announced with the sheep's name.

### Controls and Input

The game is mouse-only, with optional keyboard shortcuts.

| Input | Action |
|---|---|
| Left-click **Farm** / **Farm Breeding Food** | Fill the Farm bar (8 clicks = 1 food; 2× pips while boosted) / add 1 breeding food |
| Left-click an empty field | Drop a food piece |
| Left-click a carcass | Clear it |
| Drag a sheep → Better Place | Sacrifice |
| Drag a sheep → Market stall | Sell |
| **Breed** tool, then click adult A, then adult B | Breed |
| Hover over a sheep | Tooltip with name, stage and hunger state (Fed, Hungry or Starving) |
| `F` / `G` (optional) | Farm / Farm Breeding Food |
| `Esc` | Pause menu |

Dragging and clicking are told apart by a **6 px** movement threshold.

---

## Idle/Incremental Game Specific Elements

### Core Click/Interaction

- **Primary clicks:** Farm (fills the Farm bar; a full bar = 1 food) and Farm Breeding Food (+1 breeding food). Clicks are the only source of either resource. There is no passive income.
- **Click value progression:** a Farm click fills 1 pip; Better Hoe upgrades raise it to 2 and then 3 pips. The Better Place boost doubles the pips per click for 30 s.
- **Auto-click:** none. The auto-feeder automates *feeding*, not farming (see Automation Systems).
- **Combo/streak:** none.
- **Feedback:**
  - Every click gets a button squash, a "+N" popup and a soft pop sound.
  - Food pieces bounce when they land.
  - Eating plays a munch particle.
  - Death plays a comedic "baa-*thud*" with a dust puff.
  - A sacrifice plays a cartoon suction and a sparkle, and the button glows gold while the boost is active.

### Upgrade Trees

There is one flat shop with no branches.

| Upgrade | Category | Cost | Effect | Tier |
|---|---|---|---|---|
| Land I / II / III | Capacity | $50 / $150 / $400 | Capacity 10 → 25 → 50 → 100 | Must |
| Flower Patch | Decoration | $40 | Cosmetic | Must |
| Scarecrow | Decoration | $80 | Cosmetic | Must |
| Better Hoe I / II | Click power | $30 / $100 | Farm click fills 2 / 3 pips | Should |
| Auto-feeder | Automation | $120 | See Automation Systems | Should |
| Medicine (per dose) | Consumable | $15 | Cures 1 infected sheep | Should |

- **Unlock conditions:** each Land tier needs the previous one. Everything else is available from the start.
- **Synergies:** land raises capacity, which allows more sheep, more sales and more money. It also brings more overcrowding risk and more mouths to feed.
- **Meta-upgrades:** none. There is no prestige.

### Automation Systems

- **Auto-feeder ($120, Should tier):**
  - Drops 1 food piece next to the hungriest sheep every **10 s**, taking it from the food meter.
  - With an empty meter it does nothing, so the player must still farm.
  - Its maximum output (+3.5 Fullness/s) sustains about **4 sheep**.
  - It supports active play without replacing it: at 25 or more sheep, the player still hand-feeds most of the flock.
  - Only one can be bought.
- **Manager/worker systems:** none.
- **Offline progression:** **none, deliberately.** The game pauses while the tab is hidden.
- **Active vs. idle balance:** fully active. Idling kills the flock in about 2 minutes.

### Prestige and Reset Mechanics

**Not applicable.** Prestige is out of scope. The only reset is the hard-loss Restart.

### Number Balancing

- **Scale:** small, linear numbers. Money stays in the hundreds, so there is no K/M/B notation.
- **Feed demand:** each sheep needs about 0.83 Fullness/s, roughly one food piece every 42 s.
  - 10 sheep need a piece about every **4.2 s**.
  - 25 sheep need one about every **1.7 s**.
  - At 8 clicks per food, 10 sheep need about 1.9 Farm clicks/s and 25 sheep about 4.8 (before upgrades), plus one field click per piece. Better Hoe and the boost cut this to a half or a third. [ASSUMPTION, tune in the post-Epic 3 playtest]

  Attention pressure grows with the flock, and that is the game's soft cap.
- **Time gates:** life stages (60 s to adulthood), the 10 s gestation, and the **60 s per-adult breeding cooldown**. Without the cooldown, Village arrived in about 90 s.
- **Pacing target:** in the Must-tier economy, **Village (10 sheep) in about 3–5 min** and **Town (25) in about 10–15 min** (tune). Hand-simulation with the cooldown, no losses and no sales gives Village at about 3 min. Sales for Land I ($50 = 5 adults) and founder deaths at about 6 min push Town later.
- **Walls:** the land costs. Getting past them means selling sheep, which is a direct trade-off against the era threshold, since eras count live sheep.

### Meta-Progression

- **Eras:**

  | Era | Sheep alive |
  |---|---|
  | Pasture | at the start |
  | Village | **10** |
  | Town | **25** |
  | Wool Empire | **50** |

  - Eras count **sheep alive right now**. Losses can drop the player **back an era**, and the background reverts with them. This makes plagues dramatic and keeps pillar 4 honest.
  - In v1, an era change is **only a background swap**.
- **Stats panel (Should tier):** sheep alive, sold, died, sacrificed, and money earned.
- **Achievements:** Nice-to-have (e.g. "Hunter": sacrifice the Abomination).
- **Endgame:** open-ended. The Wool Empire is the aspirational goal.

---

## Progression and Balance

### Player Progression

The player progresses through **flock size**: more land, more sheep and later eras. They also gain **mastery** in reading tells (thinness, green tint, off-step walk). No progression changes the rules. Progression changes the *scale* of the attention problem, which changes how the loop plays.

### Difficulty Curve

- **0–60 s:** 3 sheep, all half-hungry. The first one goes thin at about 42 s. The player learns Farm and Feed.
- **1–5 min:** the first adults, the first breeding and the first sale. The first death, from old age or neglect, introduces carcasses.
- **5–15 min (Village):** the flock reaches 10–25 sheep. The feed load approaches 2–5 Farm clicks per second before upgrades, which is where Better Hoe and the boost earn their keep. Contagion chains become the main threat.
- **15 min+ (Town → Wool Empire):** the attention load is the challenge. With the Should tier, the Abomination and overcrowding add pressure.

**Where the player coasts:** right after buying land (spare capacity) and during a sacrifice boost.
**Where they struggle:** era transitions, when the flock is at its largest relative to the player's tools.

### Economy and Resources

| Resource | Earned | Spent | Cap |
|---|---|---|---|
| Food | 1 per full Farm bar (8 pips; a click fills 1, 2 or 3 pips with upgrades, ×2 when boosted) | 1 per food piece | 20 in stock; overflow drops onto the field (no field cap) |
| Breeding food | Farm Breeding Food click +1 | 3 per breeding | 10 |
| Money | Sell adult $10 / elder $5 | Shop | None |
| Sheep | Breeding | Selling, sacrifice, death | Land capacity |

Selling is the only source of money, and each sale pushes the flock further from the next era. This is the core tension of pillar 3.

---

## Level Design Framework

### Level Types

There is **one fixed screen**: the pasture. It contains:

- the Market stall at one edge
- the Better Place hole, fixed in position
- the Farm buttons and HUD in a bottom bar
- the shop panel

There is no camera movement. Land upgrades enlarge the fenced area that sheep can roam, shown as visible fence expansion within the same screen, and raise capacity.

### Level Progression

The four eras each have their own background:

1. **Pasture:** an open field.
2. **Village:** huts and a path.
3. **Town:** buildings and a wall.
4. **Wool Empire:** banners and a castle silhouette.

Swaps are instant with a short crossfade (about 1 s) and an era-name banner. When the flock drops back below a threshold, the previous background returns with the same transition.

---

## Narrative

There is no story text. Stories emerge from the systems: the sheep that starved while the player chased a carcass, or the lamb that was never quite right. Names (Should tier) make each loss land harder, so death announcements use the sheep's name.

---

## Art and Audio Direction

### Art Style

- **Style:** cute pixel art. Sources are free packs (Kenney.nl or similar) with recolors.
- **Readability rules:**
  - Hunger shows through body shape (thin) and posture (drooping).
  - Infection shows as a **green tint**.
  - Elders are greyer.
  - The Abomination uses the **lamb sprite**. Only its animation (off-step) and the other sheep's spacing behavior give it away.
- **Tone:** death is slapstick (comedic poses, a dust puff), never gore. Carcasses are cartoon "X-eyes" sheep.

### Audio and Music

- **Music:** light, cozy, looping (one track for v1).
- **SFX:**
  - Comedic bleats, with frequency rising as hunger worsens
  - Click pop and munch
  - Death "thud"
  - Better Place suction
  - Era fanfare
  - "Last sheep!" sting (Should tier)
- **Sources:** free packs.

---

## Technical Specifications

### Performance Requirements

- **60 FPS sustained** with **100 sheep** on screen, measured over 5 minutes of play in Chrome and Firefox on a mid-range laptop (integrated GPU).
- **Initial load under 5 s** on broadband. Total build **under 8 MB**, which keeps it within the Poki limit in case the game is ported later.

### Platform-Specific Details

- **Engine:** Phaser 3, TypeScript, Vite.
- **Platform:** desktop browsers only; Chrome, Firefox and Edge, latest 2 versions. Mobile is not supported.
- **Deployment:** GitHub Pages and itch.io (HTML5 embed).
- **Canvas:** fixed **16:9** aspect, scaled to fit the window.
- **State:** all game state lives in one plain serializable object, which is used both for saving and for testing.
- **Portals:** Poki and CrazyGames are **not** targets for v1. Their SDKs and mobile requirements are out of scope.
- **Save:**
  - Autosave to localStorage every **10 s** and whenever the tab is hidden.
  - On load, the game resumes exactly where it stopped.
  - Restart after a loss clears the save.
- **Pause:** the simulation stops completely on `visibilitychange` (hidden).

### Asset Requirements

| Asset | Requirement |
|---|---|
| Sheep sprite set | Lamb, adult and elder. Each needs idle, walk, eat, thin and drag variants, plus a carcass pose. Lambs also need an off-step walk variant for the Abomination. |
| Era backgrounds | 4 |
| UI | Buttons, meters, shop panel, Market stall, Better Place hole, 2 decorations |
| Audio | About 10 SFX and 1 music loop |

---

## Development Epics

### Epic Structure

| # | Epic | Days | Tier | Playable deliverable |
|---|---|---|---|---|
| 1 | Flock Survival Core | 1–2 | Must | Sheep wander, get hungry and starve. Farm and Feed keep them alive. Lose screen; save and pause work. |
| 2 | Life, Death & Contagion | 2–3 | Must | Life stages, breeding, carcasses, the virus and the Better Place. The full dark loop is playable. |
| 3 | Economy & Eras | 4 | Must | Market, shop (land and decorations) and the four era backgrounds. **The MVP is complete.** |
| 4 | Hidden Threats & Upgrades | 5 | Should | The Abomination with its sacrifice reveal, medicine, overcrowding, click upgrades and the auto-feeder |
| 5 | Names, Juice & Ship | 6–7 | Should + polish | Names, stats panel and a playtest on day 6. Juice, audio, fixes and deployment on day 7. |

**Sequence:** 1 → 2 → 3 → 4 → 5. Each epic must be playable before the next one starts. The detailed breakdown is in [`epics.md`](./epics.md).

---

## Success Metrics

### Technical Metrics

- 60 FPS with 100 sheep (see Performance Requirements).
- No save corruption across 10 reload cycles.
- Zero console errors during a 30-minute session.

### Gameplay Metrics

These are measured by informal playtests with at least 3 people, with Rylan watching.

- **Pillar 1 and the first impression:** at least 2 of 3 testers start feeding without help within **60 s**.
- **Pillar 2:** at least 2 of 3 testers react audibly (a laugh or a groan) to a death or a sacrifice.
- **Pillar 3:** at least 2 of 3 testers stop to consider selling versus sacrificing at least once.
- **Abomination readability:** at least 1 tester identifies and sacrifices the Abomination without being told it exists. If none do, exaggerate the tells.

---

## Risks and Mitigations

| # | Risk | Mitigation / status |
|---|---|---|
| 1 | **Scope:** about 14 Must-tier systems in 4 days | Build in this order: feed → starve → carcass → infection (Epics 1–2). Each epic must be playable before the next starts. |
| 2 | **The Abomination's tells are too subtle at pixel scale** | Playtest with at least one other person and exaggerate the off-step animation first (see Success Metrics) |
| 3 | **A 2-minute visit may not see the dark twist** | Accepted in the brief: no dark moment is scripted. Partly offset by the starting flock being half-hungry, so a sheep goes thin at about 42 s. |
| 4 | **A hard loss wipes a long save and breaks attachment** | Accepted. The game pauses when the tab is hidden, so the player never loses while away. A "Last sheep!" warning plays at a flock of 1 (Should tier). |

---

## Out of Scope

**Cut from v1.0:**

- Genetics and traits (wool colors, golden wool)
- A happiness or health stat
- Sheep jobs, and buildings the sheep build
- Prestige or rebirth
- Offline progress
- More crop types, crop plots and growth timers
- Food spoilage
- Contact-spread infection, vaccines, a quarantine pen, and hiring a vet or shepherd
- Wool shearing
- Decorations with buffs
- Sheepdogs and auto-farmers
- Seasons and night-time wolves
- Mobile support
- Monetization
- Renaming sheep
- Era unlocks beyond the background swap
- A grace period when the flock is down to its last sheep (only the warning stays)
- Random events: a traveling merchant, a plague outbreak, a lost lamb
- A bonus payout for finding the Abomination
- A statue of the oldest sheep, and all other sheep-built structures

**Nice-to-have, post-launch:**

- A wolf event or drought event
- Changing market prices
- Achievements, including "Hunter"
- A population-over-time stat
- Era-specific music

---

## Assumptions and Dependencies

**Dependencies:**

- Free art and audio packs with licenses that allow use in a portfolio. Credits will appear on an in-game credits screen.
- Phaser 3 and Vite build tooling.
- Hosting on GitHub Pages and itch.io.

**Assumptions:**

- [ASSUMPTION: The Must-tier pacing targets (Village in 3–5 min, Town in 10–15 min) are reachable with the listed numbers. Validate them in the first playtest after Epic 3.]
