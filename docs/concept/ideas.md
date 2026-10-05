# Sheep Civilization: Concept and Ideas

## Original pitch

Sheep civilization 2D clicker game.

- Farm crops by clicking the farm button to build up the food meter
- Click the feed button to drop food pieces to the sheep to feed them and keep them alive
- If you don't feed your sheep, they can die
- When a sheep dies and is not attended to, other sheep can come and eat it, and then a virus spreads that can kill more
- Breeding food: if fed to two sheep, they breed and create a new sheep
- If all sheep die, you lose
- Sell full-grown sheep at a market for money to grow land and buy decorations

## Expanded ideas

These are suggestions to explore during the brief and GDD. None of them are decisions yet.

### 1. Sheep lifecycle and needs
- **Life stages:** lamb → adult → elder. Only adults can breed or be sold, and elders eventually die of old age, so the carcass mechanic happens even when you play well.
- **Hunger shown on the sheep:** each sheep has its own hunger level, and you can see it in the sprite: it gets thinner, droops, and bleats more often.
- **Happiness/health stat** that affects breeding success and sale price.
- **Named sheep:** sheep get random names (players can rename them) so losing one hurts.
- **Traits/genetics:** wool color, appetite, speed, and disease resistance get passed down when sheep breed. Rare traits like golden wool sell for more.

### 2. Crops and food
- **Several crop types:** grass (basic food), wheat or clover (breeding food), carrots (a health boost), and a rare golden clover (big boost or a guaranteed rare trait).
- **Growth timers and plots:** clicking speeds up growth, and more plots mean more food.
- **Food spoilage:** dropped food goes bad if nothing eats it, so overfeeding wastes resources.

### 3. Death and disease (the tension system)
- **Carcass decay timer:** a dead sheep has a countdown. Click it to bury or remove it before others come to eat it.
- **Infection spread:** sheep that eat a carcass become infected and show visible symptoms. Infection can spread to nearby sheep by contact.
- **Counter-play:** buy medicine or a vaccine at the market, build a quarantine pen to isolate sick sheep, or hire a shepherd or vet.
- **Overcrowding:** too many sheep in too little land raises the infection risk, which ties disease to land expansion.
- **Last sheep warning:** a dramatic alert and a short grace period when the flock gets close to wiped out.

### 4. Economy and market
- **Changing market prices:** sheep prices go up and down. Players can wait for a better price or sell now.
- **Wool shearing:** shearing gives steady income without selling sheep. Players choose between selling now and shearing for income over time.
- **Things to buy:** land expansions, pens, crop plots, auto-feeders, medicine, and decorations.
- **Decorations with buffs:** for example, a fountain makes sheep happier and a scarecrow protects crops.

### 5. Clicker and idle progression
- **Click upgrades:** better tools make each farm click produce more food.
- **Automation:** sheepdogs herd sheep, auto-farmers plant crops, and feeders release food on a timer. The game moves from active clicking to managing the flock.
- **Offline progress:** you earn some resources while away, but hunger keeps ticking too (maybe capped so the flock can't die while you're offline).
- **Prestige (rebirth):** a "New Flock" restart that gives permanent bonuses.

### 6. The "civilization" angle
- **Eras:** as the flock grows, sheep society advances: Pasture → Village → Town → Wool Empire. Each era unlocks new buildings, art, and music.
- **Sheep jobs:** assign adult sheep as farmers, guards, or healers. They can automate tasks but can't be sold or bred while working.
- **Buildings that sheep build:** barns, a hospital, a market stall, and a statue of the oldest sheep.
- **Milestones and achievements:** "First lamb", "Survived an outbreak", "100 sheep", "Golden fleece".

### 7. Threats and events
- **Wolves** that attack at night unless you have guards or fences.
- **Weather and seasons:** drought slows crop growth, winter increases hunger, and spring boosts breeding.
- **Random events:** a traveling merchant with rare items, a plague outbreak, or a lost lamb that wanders in.

### 8. Presentation and feel
- Cute pixel art with a darkly comedic edge, since the cannibal sheep zombie virus is part of the charm.
- Satisfying click feedback: particles, food pieces bouncing, sheep running to eat.
- A stats panel showing population over time, total deaths, sheep sold, and money earned.
- Save and load, plus autosave.

## Open questions for BMAD planning
- Target platform: web browser, desktop, or mobile?
- Engine: for example Phaser/TypeScript (web), Godot, or Unity?
- How much of the game is active clicking and how much is idle?
- Session length, and whether the game has an ending (the final era) or is endless.
- Tone: cozy or darkly comedic?
- Monetization, if any: none, premium purchase, or cosmetic purchases.

## One-week scope

The game has to be built in one week, so the list above is cut down to three tiers. Build the tiers in order and only start the next one when the current one is finished and playable.

### Must have (days 1–4): the core game
- Farm button: each click adds food to the meter
- Feed button: drops food pieces, and sheep walk over and eat them
- Each sheep has a hunger level and starves when it reaches empty
- Three life stages: lamb → adult → elder (only adults can breed or be sold; elders sell for less)
- Old age: an elder that isn't sold or sent to the Better Place eventually dies and leaves a carcass
- The Better Place: a hole in the field. Drag a sheep into it to sacrifice it, which removes it cleanly with no carcass and no infection risk
- Sacrifice boost: each sacrifice gives a temporary boost to crop production (e.g. 2x food per click for 60 seconds), so you have to choose between selling a sheep for money and sacrificing it for food
- Carcass timer: click a dead sheep to remove it before it's eaten
- Virus: a sheep that eats a carcass gets infected, shows it (turns green), and dies after a delay unless it's cured
- Breeding food, a separate crop: feed it to two adults to get a lamb
- Market: sell adults for money
- Shop: land expansion (raises how many sheep the field can hold) and 3–5 decorations
- Lose screen when all sheep die, with a restart button
- Autosave using localStorage

### Should have (days 5–6): makes it fun
- The Abomination: a small chance (around 5%) that breeding produces an abomination. It looks like a normal lamb but secretly kills other sheep. Its victims leave carcasses, which feed the virus system. The player has to work out which sheep it is and send it to the Better Place. Sacrificing the wrong sheep costs an innocent one. Clues:
  - A slightly wrong walk cycle: off timing, a stutter, or one leg out of sync. Easy to miss unless you watch it closely.
  - Nearby sheep keep a little extra distance from it. It's a slight bias in where they wander, not obvious fleeing, so you only notice the pattern over time.
  - Victims die near it, often when the player isn't watching (off screen or during a long idle period)
  - Reward for finding it: a bonus payout or a "Hunter" achievement
- Medicine in the shop to cure infected sheep
- Overcrowding raises infection chance, which ties land to disease
- Click upgrades (2–3 levels) and one automation item (an auto-feeder)
- Random sheep names, shown on hover
- Juice: bouncing food, particles, bleat sounds, a "last sheep!" warning
- Simple stats: sheep alive, sold, died, money earned

### Nice to have (day 7, only if ahead)
- One wolf event or a seasonal drought
- Changing market prices
- Eras as visual milestones (the background changes at 10 and 25 sheep)
- A handful of achievements

### Out of scope for this week
Genetics/traits, sheep jobs, prestige, offline progress, multiple crop types beyond food and breeding food, buildings the sheep build.

### Suggested tech for speed
Phaser 3 + TypeScript + Vite, playable in a browser and deployable to GitHub Pages. Keep game state in one plain object so saving and testing are simple. Use free asset packs (e.g. Kenney.nl) instead of drawing art. Day 7 is for bug fixing and polish, not new features.
