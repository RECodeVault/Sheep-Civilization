---
name: Sheep Civilization
status: final
created: 2026-10-05
updated: 2026-10-05
sources:
  - ../../briefs/brief-sheep-civilization-2026-10-05/brief.md
  - ../../gdds/gdd-sheep-civilization-2026-10-05/gdd.md
---

# EXPERIENCE.md — Sheep Civilization

Mockups illustrate; this spine wins on any conflict.

## Foundation

- **Platform:** desktop browsers only (Chrome, Firefox and Edge), hosted on GitHub Pages and itch.io. Mobile is not supported.
- **Input:** mouse first, with optional `F` / `G` / `Esc` keys.
- **Engine:** Phaser 4 + TypeScript + Vite (per game-architecture.md) on one fixed 16:9 canvas, scaled to fit the window. Everything, including menus, is drawn in-canvas. There is no DOM UI.
- **Screens:** one gameplay screen. Changed 2026-10-06 (Rylan): the field camera starts with the pen centred in the field above the bottom bar, and a right-drag pans it. Panning is pinned, so the whole pen always stays in view. The HUD and menus never move.
- **Visual reference:** [DESIGN.md](./DESIGN.md). Mechanics and numbers live in the [GDD](../../gdds/gdd-sheep-civilization-2026-10-05/gdd.md) and [epics](../../gdds/gdd-sheep-civilization-2026-10-05/epics.md). The GDD wins over the [brief](../../briefs/brief-sheep-civilization-2026-10-05/brief.md) on conflicts.
- **Context:** a solo 7-day portfolio build. Must-tier UX ships first, and items tagged *(Should)* follow GDD tiering.
- **Decisions:** Rylan's decisions are in [.decision-log.md](./.decision-log.md). Anything not decided there or in the sources is tagged [ASSUMPTION].

## Information Architecture

```
Boot/Load ──► Start screen ──► Game (pasture) ◄──► Pause menu ──► Volume · Stats · Credits
                │  Continue (only if save)      │        │ Restart ──► confirm ──► new game (save wiped)
                │  New Game (confirm if save)   │◄──► Shop panel (toggle, sim keeps running)
                │  Credits ──► Credits          │
                                                └──► Lose screen ──► Restart ──► new game
```

| Surface | Reached from | Contents | Sim |
|---|---|---|---|
| Start screen | Load | Title, **Continue** (only when a save exists), **New Game**, **Credits**. Sheep wander in the background. | Decorative sheep only |
| Game | Continue / New Game / Restart | Field, Market stall, Better Place, bottom-bar HUD | Running |
| Shop panel | Shop toggle | Land I–III, decorations, *(Should)* Better Hoe I–II, Auto-feeder, Medicine | **Running** (decision log) |
| Pause menu | `Esc` or the **Pause** button (top-left; added 2026-10-06, Rylan) | "Paused" header, then **Resume, Volume, Stats, Restart, Credits, Main Menu** (Main Menu added 2026-10-06, Rylan: saves and returns to the start screen, no confirm; Continue resumes) | Paused |
| Volume | Pause | Music slider, SFX slider, Reduced motion toggle, Captions toggle (confirmed) | Paused |
| Stats *(Should)* | Pause | Alive, sold, died, sacrificed, money earned | Paused |
| Credits | Start / Pause | Asset pack credits and licences, then Back | Paused in game; none from the start screen [ASSUMPTION] |
| Start-over confirm | New Game (save exists) / pause Restart | "Start over? Your flock will be lost." · **Cancel** · destructive **Start over** | Paused in game; none from the start screen [ASSUMPTION] |
| Lose screen | Flock reaches 0 | "The flock is gone.", time survived, peak flock, **Restart** | Stopped |

Nothing is more than one level deep from the game. Modals replace each other and never stack. The key surfaces are mocked in [mockups/title.html](./mockups/title.html) (start screen), [mockups/hud.html](./mockups/hud.html) (game with the shop open) and [mockups/pause.html](./mockups/pause.html) (pause menu and start-over confirm).

**HUD information hierarchy** (Q4: always visible):

1. **Act now:** Farm and Farm Breeding Food buttons, the Farm progress bar ("{n}/8"), the breeding food meter (/10) and the Breed tool.
2. **Threat summary:** counts of Starving, Infected and Carcasses (see HUD & Diegetic UI).
3. **Status:** money, flock vs land capacity (`12/25`), current era, boost timer (only while active).
4. **Access:** the Shop toggle.

Stats live in the pause menu: Q4's "stats" means the threat summary in the HUD plus the full Stats panel in pause (confirmed).

## Voice and Tone

Microcopy is cozy with dark laughs: short, deadpan and storybook-polite about terrible things. Brand posture is in DESIGN.md. Sheep are always named once names exist *(Should)*. Before names exist, "A sheep" stands in.

| Moment | String |
|---|---|
| Flock drops to 1 | **"Last sheep!"** |
| Starvation | "{name} starved." |
| Old age | "{name} died of old age. A long, full seven minutes." [ASSUMPTION] |
| Virus | "{name} caught the carcass sickness." [ASSUMPTION] |
| Abomination victim | "{name} just… fell over." [ASSUMPTION; it must not state a cause, because that would be a tell] |
| Sold | "{name} sold. $10." / "$5." |
| Sacrifice (normal) | "{name} went to a Better Place." [ASSUMPTION] |
| Sacrifice reveal: innocent | **"…that was just {name}."** ("…that was just a sheep." before names) |
| Sacrifice reveal: Abomination | Screech, then "Good riddance." [ASSUMPTION] |
| Era up | Banner: "Village" / "Town" / "Wool Empire" |
| Era regress | Banner: "Back to {era}." [ASSUMPTION] |
| Start-over confirm | "Start over? Your flock will be lost." · **Cancel** · **Start over** |
| Pause menu header | "Paused" [ASSUMPTION] |
| Shop panel header | "Shop" [ASSUMPTION] |
| Lose | "The flock is gone." · "Survived 12:34 · Peak flock 18" · **Restart** [ASSUMPTION for the heading] |
| Breed greyed (capacity) | Tooltip: "No room. Buy land." [ASSUMPTION] |
| Breed greyed (food) | Tooltip: "Needs 3 breeding food." [ASSUMPTION] |
| Invalid sell | Tag: "Too young" |
| Button tooltips | "Farm: fill the bar for 1 food (F)", "Farm Breeding Food: +1 (G)", "Breed: pick two adults" |

There is no tutorial text beyond button labels and tooltips (Q9). There are no exclamation marks except "Last sheep!". Never write grim words such as "corpse", "blood" or "kill" in the UI; "carcass" is the strongest word allowed.

## Component Patterns

Behaviour only. Visual specs are in DESIGN.md, under Components.

| Component | Behavioural rules |
|---|---|
| Farm button | Left-click or `F` fills the click value of pips on the 8-pip Farm progress bar ("{n}/8"), with a squash and a soft pop sound. When a bar completes, a food piece drops at a random spot in the pen with its landing bounce, and a "+1" popup rises over the button. There is no food stock (changed 2026-10-06). While boosted it uses `{components.button-farm-boosted}`. |
| Farm Breeding Food button | Same behaviour, using `G`. It is never boosted. |
| Farm progress / breeding food meter | Update the same frame as the change. An attempted breeding spend with too little triggers the empty shake (`{colors.alert}` flash) on the breeding meter. |
| Breed tool | Toggles breed mode (see Interaction Primitives). It greys out (`{components.button-disabled}`) at land capacity, including pending lambs, or when breeding food is below 3 [ASSUMPTION for the food case], and its tooltip gives the reason. |
| Shop toggle | Opens and closes the shop panel. `Esc` also closes it. The sim keeps running. |
| Shop panel / shop item row | Click a row to buy instantly, with no confirmation. The money counter ticks down and the item applies (for example, the fence grows). Unaffordable rows stay visible but greyed. A one-time item (Auto-feeder, decorations, Land tiers) shows "Owned" after purchase. [ASSUMPTION] Medicine can be bought repeatedly. |
| Medicine slot *(Should)* | Appears once at least one dose is owned. Drag a dose onto an infected sheep to cure it instantly. A drop anywhere else returns the dose to the slot. |
| Money counter / Flock counter | Read-only. The flock counter switches to its crowded style at 90% or more of capacity (overcrowding risk, *Should*). |
| Era badge / Era banner | The badge always shows the current era. The banner plays on any era change, together with the background crossfade of about 1 s. |
| Boost timer | Appears on a sacrifice and counts down from 30 s. A repeat sacrifice resets it to 0:30 with a pop. It disappears at 0. |
| Threat summary | Three live counts. Hover a count to get a tooltip such as "2 starving". [ASSUMPTION] Clicking does nothing in v1. |
| Alert ping | See HUD & Diegetic UI, layer 2. |
| Infection marker | Bobs above every infected sheep until it dies or is cured. It has no timer display. |
| Tooltip | Hover a sheep for about 300 ms [ASSUMPTION] to show two lines: the name, then stage and hunger state (Fed / Hungry / Starving), plus the heart-outline icon when the sheep is on breeding cooldown [ASSUMPTION for two lines]. The tooltip follows the sheep and is hidden while dragging. **An Abomination shows exactly like a lamb.** |
| Drop targets (Market, Better Place, invalid) | See Interaction Primitives. |
| Announcement toast | Up to 3 visible, stacking top-centre so the open shop never covers them, each lasting about 4 s [ASSUMPTION]. The newest is on top. Toasts never block clicks. |
| "Last sheep!" banner *(Should)* | Plays once each time the flock drops to 1, with a sting and a caption. |
| Caption | See Accessibility Floor. |
| Float popup | Rises about 24 px and fades over 600 ms [ASSUMPTION]. Under reduced motion it fades in place. |
| Menu button / Slider / Toggle | Hover highlights. Click activates. Sliders drag or click-to-set and preview the SFX level with a bleat on release. |
| Panel / menu scrim | Every modal (start, pause, Volume, Stats, Credits, lose) is one centred panel over the scrim. Clicking the scrim does nothing. [ASSUMPTION] Back returns to the previous modal, and from pause `Esc` resumes. |
| Pause button | Top-left of the field. Hover highlights and shows "Pause (Esc)"; click opens the pause menu, the same as `Esc`. Under any modal the scrim covers it. (added 2026-10-06, Rylan) |
| Lose panel | Appears over the stopped field. **Restart** wipes the save and starts a new game directly (no confirm: nothing is left to lose). |
| Start-over confirm | Shown by New Game when a save exists and by Restart in the pause menu. **Cancel** sits left and **Start over** (destructive style) right [ASSUMPTION]. **Start over** wipes the save and starts a new game; **Cancel** or `Esc` returns to the previous modal. This is the only confirmation in the game: sell, sacrifice and shop purchases never confirm (Q8). |

## State Patterns

| State | Surface | Treatment |
|---|---|---|
| Cold load | Boot | Loading bar on `{colors.dusk}`, finishing in under 5 s on broadband. |
| No save | Start screen | Continue is hidden, not greyed. [ASSUMPTION] |
| Save exists | Start screen | Continue is shown first and resumes exactly where play stopped. |
| Hidden tab | Game | The sim stops completely. When the tab returns, play resumes with no overlay. [ASSUMPTION] |
| **Fed** | Sheep | Normal walk and normal bleats. |
| **Hungry** | Sheep | Drooping posture, bleats twice as often. |
| **Starving** | Sheep | Thin sprite, frantic bleats, and an alert ping on entry. Counted in the threat summary. |
| **Infected** | Sheep | `{colors.infection}` tint **plus** an infection marker (bubbles) **plus** a sickly wobble in its walk [ASSUMPTION for the wobble]. Ping on entry. |
| **Elder** | Sheep | Greyer sprite. |
| Breeding cooldown | Sheep | Heart-outline icon on hover only. |
| Pregnant pair | Field | A heart floats between them, and a lamb pops out 10 s later. |
| Carcass | Field | X-eyes sprite and a dust puff on spawn, plus a ping on spawn. Stays until clicked. Counted in the threat summary. |
| Dragged | Sheep | Lifted 4 px, legs dangling, and it stops wandering. Both drop targets highlight. |
| **Breed at capacity** | HUD | Breed is greyed (`{components.button-disabled}`) with the tooltip "No room. Buy land." Breed mode exits if it was active. |
| **Boost active** | HUD | The Farm button glows `{colors.halo}` with a "×2" badge, the boost timer is visible, and each Farm click fills double pips. |
| Crowded (≥ 90%) *(Should)* | HUD | Flock counter in `{components.flock-counter.crowdedColor}` with the crowd icon. |
| **Era advance** | Field + HUD | Crossfade of about 1 s, `{components.era-banner}`, the era fanfare, and the badge updates. |
| **Era regress** | Field + HUD | The same crossfade back, plus the quieter "Back to {era}." banner with no fanfare. [ASSUMPTION: a soft descending note instead] |
| Last sheep *(Should)* | HUD | "Last sheep!" banner, sting and caption. Breed is greyed (no pair possible). |
| **Lose** | Modal | The sim stops, a `{components.menu-scrim}` dusk scrim appears, then `{components.lose-panel}`. The only action is Restart. |
| Paused | Modal | Dusk scrim over a frozen field. `Esc` or Resume returns to play. |
| Shop open | HUD | The panel is open, the toggle shows its `open` style, and the sim runs. Pings stay above the panel. |

## Interaction Primitives

- **Click:** left-click on a button acts; on a carcass, clears it. A click on empty field does nothing: food comes from the Farm bar (changed 2026-10-06).
- **Drag vs click:** a press becomes a drag after **6 px** of movement. Below that it is a click, so a click on a sheep does nothing in the default mode. [ASSUMPTION]
- **Drag a sheep:**
  - On drag start, **both** drop targets highlight together (Q7). The Market shows `{components.drop-target-market}`: a rectangle with a "$10" or "$5" tag. The Better Place shows `{components.drop-target-better-place}`: a ring and a "+2× food" label.
  - The target under the cursor intensifies: the awning flaps, or the hole sucks.
  - A lamb (including the Abomination) dragged over the Market shows `{components.drop-target-invalid}` ("Too young"). If dropped there, it bounces back onto the field.
  - Release on the Market sells. Release in the Better Place sacrifices.
  - Release on the field puts the sheep down where it was dropped. Outside the fence, it is placed at the nearest point inside the fence. [ASSUMPTION]
- **No confirmations** on sell or sacrifice (Q8). The misdrop is part of the joke.
- **Breed mode** (Q6):
  - **Enter:** click Breed. The button fills with `{colors.heart-deep}`, the cursor becomes a heart, and eligible adults get a soft heart marker. Ineligible sheep (lambs, elders, sheep on cooldown) do not. [ASSUMPTION for the markers]
  - **Pair:** click adult A, which pins a heart above it, then adult B. 3 breeding food is spent, a heart appears, and a lamb is born 10 s later. Breed mode then **exits**. [ASSUMPTION]
  - **Invalid click:** clicking an ineligible sheep shakes it and keeps the mode active. Clicking empty field in breed mode drops no food. [ASSUMPTION]
  - **Cancel:** right-click, `Esc`, or clicking Breed again (Q6).
- **Keys:** `F` farms food and `G` farms breeding food (both repeat on each press, not on hold [ASSUMPTION]). `Esc` resolves in priority order (agreed 2026-10-05): close the start-over confirm, then a sub-panel, then cancel a drag, then exit breed mode, then close the shop, then open or close pause.
- **Right-click:** cancels breed mode. **Right-drag** (past the 6 px threshold) pans the field, pinned so the pen stays in view; a press on the bottom bar never pans (added 2026-10-06, Rylan). The browser context menu is suppressed on the canvas.
- **Hover:** shows the tooltip on sheep and buttons.
- **Banned:** confirmation dialogs on in-game actions, tutorial pop-ups, and timers that hide what kills a sheep.

## HUD & Diegetic UI

- **Diegetic:**
  - **Market stall:** a wooden striped stall at the field's right edge, which is the sell target.
  - **Better Place:** a hole in the upper-left field, right of the shop panel, which is the sacrifice target.
  - **Fence:** marks land. Its enclosed area *is* the land capacity, and it grows in place with each Land tier.
  - **Era backgrounds:** show progress.
  - **Sheep bodies:** carry hunger (thin, droop), age (grey) and sickness (green).
  - **Carcasses** sit on the field until cleared.
- **Non-diegetic** (drawn in [mockups/hud.html](./mockups/hud.html)):
  - The bottom bar (buttons with their meters stacked underneath, the Breed tool, the Medicine slot *(Should)*, counters, threat summary, boost timer, Shop toggle).
  - The era badge (top-right), the shop panel, toasts (top-centre), captions and the tooltip.

**Three threat-surfacing layers** (Q5, confirmed):

1. **On-sheep cues:** the thin and drooping sprite, the green tint plus the infection marker, carcass X-eyes, and bleat frequency rising with hunger. This is the primary layer; a player who watches the field needs nothing else.
2. **Alert pings:** `{components.alert-ping}` pops once above the sheep or carcass when it enters Starving, becomes Infected, or a carcass spawns. A ping bobs for about 3 s and then settles to a small static dot until the state resolves. [ASSUMPTION] Pings draw above the shop panel.
3. **HUD summary:** `{components.threat-summary}` shows the counts of Starving, Infected and Carcasses in the bottom bar.

**The Abomination never surfaces in any layer.** It gets no ping, no count and no tooltip difference. Its victim's death surfaces normally, as a carcass ping and a toast with no cause given. The off-step walk and the flock's avoidance are its only tells (see the GDD).

## Input Schemes

- **Mouse (primary, required):** every action is reachable with left-click, drag and right-click, including pausing through the top-left Pause button (added 2026-10-06, Rylan).
- **Keyboard (optional):** `F` farms food, `G` farms breeding food, and `Esc` follows the priority above. Key hints are printed on the buttons.
- **Not supported:** touch, gamepad, and key remapping (not in sources; out of scope for 7 days).

## Game Feel & Juice

These come from the GDD feedback list. Every one also has an audio cue.

| Trigger | Juice |
|---|---|
| Any button click | Button squash, "+N" float popup, soft pop |
| Food drop | Piece bounces on landing |
| Eating | Munch particle, munch SFX |
| Death | Comedic "baa-*thud*", slapstick pose, dust puff, then a carcass |
| Sacrifice | Cartoon suction, `{colors.halo}` sparkle, Farm button gold glow |
| Abomination reveal *(Should)* | True-form flash, screech and sting |
| Breeding | A heart pops; the lamb arrives 10 s later with a small poof |
| Sale | Coin popup "$10", cash-register ding [ASSUMPTION] |
| Era change | Crossfade of about 1 s, banner, fanfare |
| Empty meter | Meter shake and `{colors.alert}` flash |
| Last sheep *(Should)* | Banner and sting |

**Reduced motion** turns off meter shake (it flashes only), banner slide-in (it fades instead), floating popups (they fade in place) and any screen shake added later. **Gameplay animation is never reduced.** The Abomination's off-step walk, the thin and droop poses and the infection wobble are information, not decoration.

## Accessibility Floor

- **Infection is never colour-only (Q12):** the green tint is backed by the bubble marker shape and the alert ping icon. Pings and markers have `{colors.bark}` outlines for contrast against grass. Text contrast meets 4.5:1, or 3:1 for large text (see DESIGN.md, Colors).
- **Separate music and SFX volume (Q13):** two sliders in Pause → Volume.
- **Reduced motion and shake toggle (Q13):** in Pause → Volume, with effects as listed under Game Feel & Juice.
- **Captions for key audio cues (Q13):**
  - Captions use `{components.caption}`, are shown bottom-centre for about 2.5 s, and hold at most 2 at once.
  - The captioned cues are:
    - `[thud]` for a death
    - `[frantic bleating]` the first time a sheep starts starving each minute
    - `[suction]` for a sacrifice
    - `[screech]` for the Abomination reveal
    - `[fanfare]` for an era up
    - `[descending note]` for an era down
    - `[sting] Last sheep!`
  - Captions are off by default. [ASSUMPTION]
- **Settings persistence:** settings are stored separately from the save, so Restart keeps them. [ASSUMPTION]
- **Readability:** no text is under `{typography.body.fontSize}` on the base canvas, and every hit target is at least `{spacing.hit-min}`.
- **Pausing:** the game pauses whenever the tab is hidden, and `Esc` pauses at any time. No action needs speed beyond the GDD's 120 s starvation window.

## Responsive & Platform

- The canvas is fixed at **16:9** with a base of `{spacing.canvas-width}` × `{spacing.canvas-height}` [ASSUMPTION]. It uses Phaser Scale FIT, is centred, and is letterboxed in `{colors.dusk-deep}`.
- **Minimum window: 960 × 540** [ASSUMPTION]. Below that, the canvas keeps scaling down, but the text floor is no longer guaranteed. In the itch.io embed, set the frame to 1280 × 720 with a fullscreen button.
- Sprites use `pixelArt: true` (nearest-neighbour). Text is rendered at device pixel ratio.
- On a narrow or mobile browser there is no adaptation; mobile is out of scope.

## Key Flows

The developer gave no player journeys. Both flows below are [ASSUMPTION] drafts built from the GDD's two audiences.

### Flow 1: Sam, portfolio reviewer, 2–3 minute visit [ASSUMPTION]

Sam, a hiring manager, opens the GitHub Pages link from a résumé. They have never played the game, and they must understand the loop and the tone within 60 s.

1. The page loads in under 5 s. The start screen shows the title with three sheep milling about. There is no save, so the only options are New Game and Credits.
2. Sam clicks New Game. Two adults and a lamb wander a small fenced pasture. The Farm bar under the button reads 0/8.
3. Sam hovers a sheep. The tooltip reads "Biscuit", then "Adult · Hungry". It has a name, so Sam is attached.
4. At about 40 s one sheep goes thin, a `{components.alert-ping}` pops above it, and the Starving count in the HUD ticks to 1.
5. Sam clicks the field near the thin sheep; nothing happens. Sam tries **Farm**: each click fills a pip, and the eighth pops "+1" and drops a food piece into the pen. It bounces, the thin sheep trots over and munches, and the ping clears.
6. Sam tries the Breed tool on the two adults. A heart appears, and a lamb pops out 10 s later.
7. **Climax (about 2:30):** Sam drags a sheep to see what the stall does. Both targets light up: the striped Market says "$10", and the glowing hole says "+2× food". Curious, Sam drops it in the hole. There is a slurp, a gold sparkle, the Farm button glows "×2", and a toast reads "Pudding went to a Better Place." Sam laughs. They have the tone.
8. Sam closes the tab. The game pauses on hide and saves, so nothing is lost if they return.

Failure path: if Sam never feeds, the first sheep dies at about 72 s with a thud, an X-eyed carcass and the toast "{name} starved." That is the dark beat delivered anyway.

### Flow 2: Alex, itch.io player, 25-minute session [ASSUMPTION]

Alex likes Cult of the Lamb and returns to a Village-era save (14/25 sheep) to push for Town.

1. Start screen → **Continue**. The game resumes exactly where it stopped.
2. Alex runs the loop: farming, feeding in bursts, breeding pairs. With the shop open, they buy Better Hoe I. Pings stay visible above the panel.
3. An elder dies of old age. Alex, busy breeding, misses the carcass ping.
4. A starving adult eats the carcass. It turns green, grows an infection marker and pings, and the HUD Infected count reads 1.
5. Alex spots it and drags it toward the Better Place. In a hurry, they drop it on the Market instead: "$10", and it is gone with no confirmation. It is sold, which also broke the chain. Alex laughs.
6. A second carcass appears. Alex clears it with one click. The threat summary reads 0 · 0 · 0.
7. Earlier, Alex had noticed one lamb walking slightly wrong and the flock giving it room. Now a sheep "just… fell over."
8. **Climax:** Alex drags the odd lamb into the Better Place. It flashes its true form, there is a screech and a sting, and the caption reads "[screech]". The toast says "Good riddance." Alex feels smug.
9. Alex reaches 25 sheep. The Town banner and fanfare play, and the flock counter goes crowded. Alex buys Land II before overcrowding bites.

Failure path: if Alex guesses wrong in step 8, the reveal shows "…that was just Clover." and the real killer keeps hunting. In the worse case, if the chain runs away and the flock falls to 1, "Last sheep!" plays. At 0, the lose screen shows "The flock is gone. Survived 41:07 · Peak flock 26" and Restart.

## Resolved Questions

All open questions from the draft were resolved on 2026-10-05 (see [.decision-log.md](./.decision-log.md)): Q5 means all three threat layers; HUD "stats" is the threat summary plus the pause Stats panel; New Game (with a save) and pause Restart confirm; accessibility toggles live under Pause → Volume; the Abomination-victim toast stays as written and should be watched in playtests; the Market sits on the right edge, the Better Place upper-left, and the shop panel on the left.
