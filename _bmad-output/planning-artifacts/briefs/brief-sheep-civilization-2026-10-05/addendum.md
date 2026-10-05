---
title: "Game Brief Addendum: Sheep Civilization"
created: 2026-10-05
updated: 2026-10-05
---

# Addendum: Research Digest (2026-10-05)

Background research gathered during discovery. It feeds the References, Scope, and Risks sections of the brief, and later the GDD.

## Comparable Titles

- **Insaniquarium:** the closest mechanical match (click to drop food, visible hunger, fish that turn green and then die, payouts as they grow). Take: the food-drop loop and visible hunger stages. Leave: its constant-attention pace and alien attacks. Source: https://strategywiki.org/wiki/Insaniquarium!_Deluxe/Gameplay
- **Cult of the Lamb:** the tonal match (cute sacrifice; bodies left lying around make other followers sick). Take: corpse cleanup as hygiene pressure, and sacrifice traded for a buff. Leave: the dungeon crawling and deep base management. Source: https://commonsensegamer.com/cult-of-the-lamb-how-to-bury-bodies/
- **Cookie Clicker:** Take: click feedback and an escalating shop. Leave: prestige layers.
- **Plague Inc.** (from general knowledge, unverified): Take: infection spread that is easy to read.
- **Viridi / Tamagotchi:** Take: gentle creature needs. Leave: punishing decay while the player is away. Source: https://en.wikipedia.org/wiki/Viridi
- **RimWorld** (from general knowledge): Take: dark emergent stories from simple systems.
- **Divide by Sheep / Flockers:** precedent for the "cute sheep, gruesome fate" contrast as a hook. Source: https://www.windowscentral.com/divide-sheep-review

## Existing Sheep Clickers

Shep Clicker, Sheep Game (idle clicker), Sheep Annoyer, Can't Sleep Count Sheep (itch.io), and Shleep! (iOS) are all generic "click sheep for coins" loops. None was found with starvation, contagion, sacrifice, or a hidden killer. The search was not exhaustive.

## Browser Landscape

Source for this section (a single secondary source): https://app.cinevva.com/guides/web-game-monetization

- **Poki:** reports about 100M monthly active players. Requires an initial download under 8 MB, a 16:9 canvas that works on mobile, and its SDK. Revenue share is about 50%.
- **CrazyGames:** runs a basic-launch traffic test of roughly two weeks. Revenue share is about 60% on ads and 70% on in-app purchases.
- **itch.io:** pays developers 90% by default, but you bring your own traffic. Most paid itch.io games earn under $50 a month.
- **General:** on the web, the first one to three minutes decide whether a player stays.

## Genre Risks Flagged

1. **Fail states in idle games:** a sudden wipe while the player is away reads as unfair. Possible mitigations: pause the simulation when the tab is hidden, or have no offline decay, plus a clear cleanup affordance. Source: https://game-wisdom.com/?p=20898
2. **Abomination clues too subtle:** at pixel scale or in short sessions, overly subtle clues make deaths feel random. Needs a playtest, and maybe a guaranteed tell.
3. **A slow first minute:** the first feed, the first death threat, and a hint of menace need to land within about 60 seconds.
