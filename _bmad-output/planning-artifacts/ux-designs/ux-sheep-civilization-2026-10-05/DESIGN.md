---
name: Sheep Civilization
description: Cute and warm pixel pasture UI with a dark undertone. Wool-and-hay surfaces on top, dusk-plum and void underneath. Every palette, font and spacing value below is an [ASSUMPTION] (Rylan gave no preference, Q11).
status: final
created: 2026-10-05
updated: 2026-10-05
sources:
  - ../../briefs/brief-sheep-civilization-2026-10-05/brief.md
  - ../../gdds/gdd-sheep-civilization-2026-10-05/gdd.md
colors:
  wool: '#FBF4E4'
  wool-shade: '#EADBBE'
  bark: '#3A2A1F'
  bark-soft: '#6B5444'
  pasture: '#86B85C'
  hay: '#E9A23B'
  hay-deep: '#B86F1C'
  heart: '#E27894'
  heart-deep: '#A8405D'
  awning: '#B8453A'
  wood: '#8E5A30'
  void: '#160E1C'
  halo: '#F6D86B'
  haze: '#8E5BB0'
  dusk: '#3B2540'
  dusk-deep: '#22152A'
  infection: '#B4E03C'
  alert: '#E8503A'
  disabled: '#C9BCA6'
  disabled-ink: '#6E6052'
typography:
  display:
    fontFamily: 'Pixelify Sans'
    fontSize: 56px
    fontWeight: '700'
    lineHeight: '1.1'
  title:
    fontFamily: 'Pixelify Sans'
    fontSize: 32px
    fontWeight: '600'
    lineHeight: '1.2'
  label:
    fontFamily: 'Pixelify Sans'
    fontSize: 20px
    fontWeight: '500'
    lineHeight: '1.2'
  numeric:
    fontFamily: 'Pixelify Sans'
    fontSize: 22px
    fontWeight: '600'
    lineHeight: '1'
  body:
    fontFamily: 'Nunito'
    fontSize: 18px
    fontWeight: '600'
    lineHeight: '1.35'
  caption:
    fontFamily: 'Nunito'
    fontSize: 18px
    fontWeight: '800'
    lineHeight: '1.3'
  popup:
    fontFamily: 'Pixelify Sans'
    fontSize: 24px
    fontWeight: '700'
    lineHeight: '1'
rounded:
  sm: 4px
  md: 8px
  lg: 12px
  full: 9999px
spacing:
  '1': 4px
  '2': 8px
  '3': 12px
  '4': 16px
  '5': 24px
  '6': 32px
  canvas-width: 1280px
  canvas-height: 720px
  safe-margin: 16px
  hud-bar-height: 112px
  hit-min: 40px
components:
  button-farm:
    backgroundColor: '{colors.hay}'
    borderColor: '{colors.hay-deep}'
    textColor: '{colors.bark}'
    typography: '{typography.label}'
    rounded: '{rounded.md}'
    height: 64px
    padding: '{spacing.3}'
  button-farm-boosted:
    backgroundColor: '{colors.hay}'
    glowColor: '{colors.halo}'
    badgeColor: '{colors.void}'
    badgeTextColor: '{colors.halo}'
  button-breed-food:
    backgroundColor: '{colors.heart}'
    borderColor: '{colors.heart-deep}'
    textColor: '{colors.bark}'
    typography: '{typography.label}'
    rounded: '{rounded.md}'
    height: 64px
  button-breed-tool:
    backgroundColor: '{colors.wool}'
    borderColor: '{colors.heart-deep}'
    textColor: '{colors.bark}'
    activeBackgroundColor: '{colors.heart-deep}'
    activeTextColor: '{colors.wool}'
    rounded: '{rounded.md}'
    height: 56px
  button-disabled:
    backgroundColor: '{colors.disabled}'
    textColor: '{colors.disabled-ink}'
    opacity: '1'
  button-menu:
    backgroundColor: '{colors.wool}'
    borderColor: '{colors.bark}'
    textColor: '{colors.bark}'
    hoverBackgroundColor: '{colors.hay}'
    typography: '{typography.label}'
    rounded: '{rounded.md}'
    width: 280px
    height: 52px
  button-menu-destructive:
    backgroundColor: '{colors.awning}'
    borderColor: '{colors.bark}'
    textColor: '{colors.wool}'
    hoverBackgroundColor: '{colors.alert}'
    typography: '{typography.label}'
    rounded: '{rounded.md}'
    width: 280px
    height: 52px
  shop-toggle:
    backgroundColor: '{colors.wood}'
    textColor: '{colors.wool}'
    openBackgroundColor: '{colors.hay}'
    openTextColor: '{colors.bark}'
    typography: '{typography.label}'
    rounded: '{rounded.md}'
    height: 56px
  panel:
    backgroundColor: '{colors.wool}'
    borderColor: '{colors.bark}'
    insetColor: '{colors.wool-shade}'
    textColor: '{colors.bark}'
    rounded: '{rounded.lg}'
    padding: '{spacing.4}'
  shop-panel:
    backgroundColor: '{colors.wool}'
    borderColor: '{colors.wood}'
    width: 360px
    headerTypography: '{typography.label}'
    rounded: '{rounded.lg}'
    padding: '{spacing.4}'
  shop-item-row:
    backgroundColor: '{colors.wool-shade}'
    textColor: '{colors.bark}'
    priceColor: '{colors.bark}'
    unaffordableTextColor: '{colors.disabled-ink}'
    typography: '{typography.label}'
    effectTypography: '{typography.caption}'
    rounded: '{rounded.md}'
    height: 56px
  slider:
    trackColor: '{colors.wool-shade}'
    fillColor: '{colors.hay}'
    thumbColor: '{colors.bark}'
    height: 40px
  toggle:
    offColor: '{colors.wool-shade}'
    onColor: '{colors.hay}'
    knobColor: '{colors.bark}'
    height: 32px
  menu-scrim:
    backgroundColor: '{colors.dusk-deep}'
    opacity: '0.72'
  menu-scrim-start:
    backgroundColor: '{colors.dusk-deep}'
    opacity: '0.4'
  farm-progress:
    trackColor: '{colors.wool-shade}'
    fillColor: '{colors.hay}'
    segmentCount: '8'
    valueTypography: '{typography.numeric}'
  breeding-meter:
    trackColor: '{colors.wool-shade}'
    fillColor: '{colors.heart}'
    segmentCount: '10'
    costMarkerColor: '{colors.heart-deep}'
    valueTypography: '{typography.numeric}'
  money-counter:
    textColor: '{colors.bark}'
    iconColor: '{colors.hay}'
    typography: '{typography.numeric}'
  flock-counter:
    textColor: '{colors.bark}'
    crowdedColor: '{colors.alert}'
    typography: '{typography.numeric}'
  era-badge:
    backgroundColor: '{colors.dusk}'
    textColor: '{colors.wool}'
    typography: '{typography.label}'
    rounded: '{rounded.full}'
  era-banner:
    backgroundColor: '{colors.dusk}'
    textColor: '{colors.halo}'
    regressTextColor: '{colors.wool-shade}'
    typography: '{typography.display}'
  boost-timer:
    backgroundColor: '{colors.void}'
    textColor: '{colors.halo}'
    typography: '{typography.numeric}'
    rounded: '{rounded.full}'
  threat-summary:
    textColor: '{colors.bark}'
    zeroTextColor: '{colors.disabled-ink}'
    starvingIconColor: '{colors.alert}'
    infectedIconColor: '{colors.infection}'
    carcassIconColor: '{colors.bark-soft}'
    typography: '{typography.numeric}'
  alert-ping:
    fillColor: '{colors.alert}'
    outlineColor: '{colors.bark}'
    glyphColor: '{colors.wool}'
    size: 20px
  infection-marker:
    fillColor: '{colors.infection}'
    outlineColor: '{colors.bark}'
    size: 16px
  tooltip:
    backgroundColor: '{colors.dusk-deep}'
    textColor: '{colors.wool}'
    accentColor: '{colors.heart}'
    typography: '{typography.body}'
    rounded: '{rounded.sm}'
    padding: '{spacing.2}'
  drop-target-market:
    highlightColor: '{colors.awning}'
    priceTagBackground: '{colors.awning}'
    priceTagText: '{colors.wool}'
    shape: rectangle
  drop-target-better-place:
    holeColor: '{colors.void}'
    ringColor: '{colors.halo}'
    glowColor: '{colors.haze}'
    labelColor: '{colors.halo}'
    shape: ring
  drop-target-invalid:
    tintColor: '{colors.disabled}'
  announcement-toast:
    backgroundColor: '{colors.dusk}'
    textColor: '{colors.wool}'
    nameColor: '{colors.halo}'
    typography: '{typography.body}'
    rounded: '{rounded.md}'
  last-sheep-banner:
    backgroundColor: '{colors.alert}'
    textColor: '{colors.bark}'
    typography: '{typography.title}'
  caption:
    backgroundColor: '{colors.dusk-deep}'
    textColor: '{colors.wool}'
    typography: '{typography.caption}'
    rounded: '{rounded.sm}'
  float-popup:
    textColor: '{colors.wool}'
    outlineColor: '{colors.bark}'
    typography: '{typography.popup}'
  lose-panel:
    backgroundColor: '{colors.dusk}'
    textColor: '{colors.wool}'
    statColor: '{colors.halo}'
    rounded: '{rounded.lg}'
  medicine-slot:
    backgroundColor: '{colors.wool}'
    iconColor: '{colors.infection}'
    textColor: '{colors.bark}'
    rounded: '{rounded.md}'
---

# DESIGN.md — Sheep Civilization

Visual reference for a Phaser 4 desktop-browser game. Mechanics live in the [GDD](../../gdds/gdd-sheep-civilization-2026-10-05/gdd.md); behaviour lives in [EXPERIENCE.md](./EXPERIENCE.md). All sizes are canvas pixels on the base canvas, which is scaled to fit the window.

Mockups illustrate; this spine wins on any conflict.

> **[ASSUMPTION] scope:** Rylan set only the direction ("cute and warm, with a dark undertone", Q10) and gave no palette, font or spacing preference (Q11). Every hex value, font, size, radius and spacing token in this file is an [ASSUMPTION] for him to accept or swap.

## Brand & Style

A storybook pasture drawn in Kenney-style pixel art, with a dusk sky underneath. On top, everything is wool, hay and soft corners. The UI looks like a children's farm game: chunky buttons, cream panels, friendly type. The dark undertone is never gore. It is a colour temperature: plum-dusk scrims behind menus, a void-black hole with a sickly gold rim, acid-lime sickness. Cozy things are warm. Ominous things are cold and glow.

The UI frames the flock and never covers it. The field is the main surface. Chrome stays in one bottom bar and one shop panel, and the two dark set pieces (the Better Place and the lose screen) get the most contrast in the game.

## Colors

All hex values below are [ASSUMPTION].

| Group | Token | Hex | Use | Not used for |
|---|---|---|---|---|
| Warm surface | `wool` | `#FBF4E4` | Panels, bottom bar, menu buttons, text on dark | Field art |
| | `wool-shade` | `#EADBBE` | Meter tracks, insets, shop rows | Text |
| Ink | `bark` | `#3A2A1F` | All text on light surfaces, outlines on pings | Large fills |
| | `bark-soft` | `#6B5444` | Secondary text, carcass icon | Disabled state |
| Field | `pasture` | `#86B85C` | Reference tone for the Pasture background art | UI chrome |
| Food | `hay` | `#E9A23B` | Farm button, Farm progress fill, food pieces, hover, coin icon | Danger |
| | `hay-deep` | `#B86F1C` | Farm button border and pressed state | Text |
| Breeding | `heart` | `#E27894` | Farm Breeding Food button, breeding meter | Infection or death |
| | `heart-deep` | `#A8405D` | Breed tool active state, breed-cost marker | |
| Market (commerce, warm) | `awning` | `#B8453A` | Market awning stripes, sell highlight, price tag | Alerts |
| | `wood` | `#8E5A30` | Market counter, shop toggle, shop panel border | |
| Better Place (ominous) | `void` | `#160E1C` | Hole interior, boost-timer pill | Any panel |
| | `halo` | `#F6D86B` | Hole rim, sacrifice sparkle, boost glow, era-banner text | Money |
| | `haze` | `#8E5BB0` | Glow around the hole while a sheep is dragged | Text |
| Undertone | `dusk` | `#3B2540` | Era badge, toasts, lose panel | The field |
| | `dusk-deep` | `#22152A` | Menu scrim (72%; 40% on the start screen), tooltips, captions | |
| Threat | `infection` | `#B4E03C` | Infected tint, infection marker, HUD infected icon | Anything healthy |
| | `alert` | `#E8503A` | Alert pings, Starving count, crowded flock, empty-meter flash, "Last sheep!" | Market |
| Disabled | `disabled` / `disabled-ink` | `#C9BCA6` / `#6E6052` | Greyed buttons such as Breed at capacity | |

The boost glow uses `halo`, so the Farm button visibly borrows the Better Place's gold while a boost is active. The sacrifice and its reward share one colour.

**Market and Better Place must read as opposites at a glance (Q7).** The Market is warm, red-and-cream striped, rectangular and made of wood. The Better Place is a round void with a cold gold rim and a violet haze. Each differs from the other in hue, value and shape, so a player can tell them apart without colour.

**Contrast (WCAG 2.x ratios, computed):**

| Pair | Ratio | Use |
|---|---|---|
| `bark` on `wool` | 12.5:1 | Body and panel text |
| `bark-soft` on `wool` | 6.4:1 | Secondary text |
| `bark` on `wool-shade` | 10.0:1 | Shop rows, meter values |
| `bark` on `hay` | 6.3:1 | Farm label |
| `bark` on `heart` | 4.8:1 | Farm Breeding Food label |
| `wool` on `heart-deep` | 5.4:1 | Breed tool active label |
| `wool` on `dusk` | 12.6:1 | Toasts, era badge, lose panel |
| `wool` on `dusk-deep` | 15.9:1 | Tooltips, captions |
| `halo` on `void` | 13.4:1 | Boost timer, Better Place label |
| `halo` on `dusk` | 9.8:1 | Era banner, names in toasts |
| `wool` on `awning` | 4.9:1 | Market price tag |
| `bark` on `alert` | 3.7:1 | "Last sheep!" banner (title size, large text, ≥ 3:1 OK) |
| `disabled-ink` on `disabled` | 3.3:1 | Disabled labels (exempt, still legible) |

`infection` and `alert` against `pasture` are only about 1.5:1. That is why every infection marker and alert ping carries a 2 px `bark` outline and its own shape. The outline provides the contrast and the shape carries the meaning, so hue is never the only cue.

## Typography

Both families are free on Google Fonts. [ASSUMPTION]

- **Pixelify Sans** is used for display, titles, button labels, numbers and float popups. It is a pixel face that matches Kenney art without the illegibility of 5 px bitmap fonts.
- **Nunito**, a rounded sans, is used for tooltips, toasts, captions and credits, where sentences must stay readable at small sizes.

| Token | Size | Use |
|---|---|---|
| `display` | 56 | Title logo, era banner, "The flock is gone." |
| `title` | 32 | Menu headers ("Paused"), "Last sheep!" |
| `label` | 20 | All buttons, shop row names and prices, "Shop" header, era badge |
| `numeric` | 22 | Meter values, money, flock/capacity, boost timer |
| `body` | 18 | Tooltips, announcement toasts |
| `caption` | 18 (800 weight) | Audio captions, shop row effect lines |
| `popup` | 24 | "+1", "+2", "$10" float popups |

No text is smaller than 18 px on the base canvas, so it stays at least 13.5 px at the minimum window size (see EXPERIENCE.md, Responsive & Platform). Pixelify Sans digits are not guaranteed tabular, so numbers are right-aligned in fixed-width boxes to stop them jittering as values change. Text renders with `resolution` matched to the device pixel ratio so it stays crisp when scaled.

## Layout & Spacing

The base canvas is `{spacing.canvas-width}` × `{spacing.canvas-height}` (16:9), scaled to fit. The spacing scale is 4 / 8 / 12 / 16 / 24 / 32, and `{spacing.safe-margin}` keeps everything off the canvas edge. All values are [ASSUMPTION].

```
┌──────────────────────────────────────────────────────────────┐
│                    [toasts, top-centre]          [era badge] │
│ ┌ shop  ┐ ( Better Place )                        ┌────────┐ │
│ │ panel │  x ≈ 450–590                            │ MARKET │ │
│ │ (when │                                         │ stall  │ │
│ │ open) │  ·  fenced pasture (grows with Land)  · └────────┘ │
│ │       │                                                    │
│ └───────┘                [captions]                          │
├──────────────────────────────────────────────────────────────┤
│ [FARM F]    [FARM BREED G] [BREED] [MED] │ $ │ 🐑12/25 │ ⚠2 ✚1 ✖0 │ ×2 0:18 │ [SHOP] │
│ ▮▮▮▯▯▯▯▯ 3/8          ♥ ▮▮ 4/10                                       │
└──────────────────────────────────────────────────────────────┘
```
- **Bottom bar** (`{spacing.hud-bar-height}`), left to right: resource producers (each meter stacked under its button), then the Breed tool and the Medicine slot *(Should)*, then status read-outs, then the threat summary, the boost timer and the Shop toggle. Actions are on the left and information is on the right.
- **Market stall:** on the right edge of the field, outside the fence. (confirmed 2026-10-05)
- **Better Place:** a fixed hole in the upper-left quadrant of the field, just right of the shop panel's footprint (about x 450–590) so the open shop never covers it, and kept far from the Market so that a misdrop takes a real drag mistake, not a twitch. (upper-left confirmed 2026-10-05; exact position [ASSUMPTION])
- **Shop panel:** `{components.shop-panel.width}` wide, rising from the bottom bar on the left. It never covers the Market or the Better Place. (confirmed 2026-10-05)
- **Toasts** stack top-centre so the open shop never covers them [ASSUMPTION]. The transient era banner plays across the upper field, the era badge sits top-right in game and stays there under the pause and confirm modals [ASSUMPTION], and captions sit bottom-centre above the bar.
- The in-game layout with the shop open is drawn in [mockups/hud.html](./mockups/hud.html).
- The Pasture fence starts small and expands in place with each Land tier. The fence boundary is the visual statement of capacity.
- Hit targets are at least `{spacing.hit-min}`, except sheep, which use their sprite bounds plus 6 px of padding.

## Elevation & Depth

There are four flat layers, from bottom to top:

1. **World:** background, fence, sheep, food, carcasses, the Market and the Better Place.
2. **World overlays:** alert pings, infection markers and float popups. They always draw above the shop panel.
3. **HUD:** the bottom bar, shop panel, toasts, captions and tooltip.
4. **Modal:** the start, pause, credits and lose screens over a `{components.menu-scrim}` dusk scrim. The start screen uses the lighter `{components.menu-scrim-start}` (40%) so its milling sheep stay visible. [ASSUMPTION]

Pixel art takes no soft shadows. Depth comes from a 2 px darker outline plus a 2 px offset "drop" in `bark` at 40% under panels and buttons. Pressed buttons lose the offset. Modals replace each other and never stack two deep.

## Shapes

Corners are pixel-stepped 9-slice versions of `{rounded.md}` (8 px) for buttons and `{rounded.lg}` (12 px) for panels. They are soft and chunky, like stitched felt. Pills (`{rounded.full}`) are kept for status read-outs (era badge, boost timer) so status never looks clickable.

Shape language for targets is load-bearing: **the Market is rectangular and the Better Place is round**. Pings are round with a "!", and infection markers are a bubble cluster. Nothing else in the UI uses those two glyph shapes.

## Components

Each component's behaviour is in EXPERIENCE.md, under Component Patterns. The key screens are drawn in [mockups/title.html](./mockups/title.html) (start screen), [mockups/hud.html](./mockups/hud.html) (bottom bar, shop panel, threat layers, drop targets) and [mockups/pause.html](./mockups/pause.html) (pause panel, start-over confirm).

- **Farm button** (`button-farm`): a chunky `hay` block with a bark label "Farm" and a key hint "F". It squashes on press. **Boosted** (`button-farm-boosted`): a pulsing `halo` outer glow and a small `void` badge reading "×2".
- **Farm Breeding Food button** (`button-breed-food`): the same anatomy in `heart`, with label "Farm Breeding Food" and key hint "G".
- **Breed tool** (`button-breed-tool`): a heart icon with the label "Breed". When active it fills with `heart-deep`, its label turns `wool`, and the cursor becomes a heart. When greyed it uses `button-disabled`.
- **Disabled button** (`button-disabled`): a flat `disabled` fill with no drop offset. It stays legible; it does not just go transparent.
- **Menu button** (`button-menu`): 280 × 52 `wool` with a bark outline. On hover it fills with `hay`. Used on the start, pause, lose and credits screens.
- **Destructive menu button** (`button-menu-destructive`): the menu button in `awning` with a `wool` label. It is used only for **Start over** in the start-over confirm, which is a `panel` with the `Cancel` menu button to its left (Cancel left, Start over right). [ASSUMPTION]
- **Shop toggle** (`shop-toggle`): a `wood` button reading "Shop". While the panel is open it shows the `hay` fill.
- **Panel** (`panel`): the `wool` 9-slice with a bark outline, used by every modal and sub-panel (Volume, Stats, Credits). The pause panel is headed "Paused" in `title`. [ASSUMPTION]
- **Shop panel** (`shop-panel`) and **shop item row** (`shop-item-row`): a `wool` panel with a `wood` border, headed "Shop" in `label` so all rows fit above the bar. Each row shows the icon, the name and price on its first line, and a one-line effect (strings from the GDD) in `caption` type on its second. An unaffordable row greys its name, effect and price to `disabled-ink` but stays readable. A locked Land tier shows "Needs Land {n}" on its effect line. [ASSUMPTION]
- **Slider** (`slider`) and **toggle** (`toggle`): a chunky track with a `hay` fill and a `bark` thumb that is 40 px tall for easy grabbing.
- **Farm progress** (`farm-progress`): 8 discrete `hay` pips on a `wool-shade` track, stacked under the Farm button, with the count "3/8" beside it (it starts at "0/8"). Each click fills a pip (more with Better Hoe or the boost); a full bar drops 1 food piece into the pen and empties.
- **Breeding food meter** (`breeding-meter`): 10 `heart` pips, stacked under the Farm Breeding Food button. A `heart-deep` tick marks the 3-pip breed cost.
- **Money counter** (`money-counter`): a hay coin icon and "$145".
- **Flock counter** (`flock-counter`): a sheep icon and "12/25", meaning alive over capacity. At 90% or more of capacity the numbers turn `alert` and a small crowd icon appears.
- **Era badge** (`era-badge`): a `dusk` pill at the top-right of the field, for example "Village".
- **Era banner** (`era-banner`): a full-width `dusk` band showing the era name in `display`/`halo`. On regress the text is `wool-shade`, quieter.
- **Boost timer** (`boost-timer`): a `void` pill with "×2 0:18" in `halo`. It is hidden when no boost is active.
- **Threat summary** (`threat-summary`): three icon-and-count pairs: Starving (`alert` drooping sheep), Infected (`infection` bubbles) and Carcasses (`bark-soft` X-eyes). A count of zero dims to `disabled-ink`.
- **Alert ping** (`alert-ping`): a 20 px `alert` circle with a `wool` "!" and a 2 px bark outline, floating above the sheep or carcass.
- **Infection marker** (`infection-marker`): a 16 px cluster of three lime bubbles with a bark outline, bobbing above an infected sheep's head on top of the green tint.
- **Tooltip** (`tooltip`): a `dusk-deep` box with two lines: the name in `label`, then "Adult · Hungry". When the sheep is on breeding cooldown, a heart-outline icon in `heart` is added to the second line. [ASSUMPTION]
- **Market drop target** (`drop-target-market`): while dragging, a pulsing `awning` rectangle outline appears with a price tag ("$10" / "$5"). When hovered, the awning flaps and the tag grows.
- **Better Place drop target** (`drop-target-better-place`): while dragging, the `halo` ring brightens, a `haze` glow appears and the label "+2× food" shows. When hovered, the hole visibly sucks and the ring spins.
- **Invalid target** (`drop-target-invalid`): for example a lamb over the Market. The target desaturates to `disabled` and its tag reads "Too young".
- **Announcement toast** (`announcement-toast`): a `dusk` card with the sheep's name in `halo`.
- **"Last sheep!" banner** (`last-sheep-banner`): an `alert` band in `title`.
- **Caption** (`caption`): `dusk-deep` at 85%, with bracketed text such as "[thud]".
- **Float popup** (`float-popup`): `wool` text with a bark outline, used for "+1", "+2", "$10" and "×2".
- **Lose panel** (`lose-panel`): a `dusk` panel with the title in `display` and the stats in `halo`.
- **Medicine slot** (`medicine-slot`): a small `wool` tile in the bottom bar, right after Breed, with a bottle icon and a "×2" count. It only appears while doses are owned. (Should tier)

## Do's and Don'ts

| Do | Don't |
|---|---|
| Keep warm (wool, hay, heart, awning) for cozy and commerce, and cold-glow (void, halo, haze, dusk) for death and sacrifice | Use red blood, gore or grim realism; death is X-eyes and a dust puff |
| Outline every threat glyph in `bark` so it reads against grass | Rely on the green tint alone for infection |
| Make the Market and the Better Place differ in hue, shape and motion | Give the two drop targets similar highlights |
| Keep chrome in the bottom bar and the shop panel | Float HUD over the middle of the field |
| Use `halo` for the boost so it echoes the Better Place | Use `halo` for money; money is `hay` |
| Use crisp pixel scaling (`pixelArt: true`) for sprites | Blur pixel art with smoothing |
| Grey out disabled actions with a readable label | Hide disabled actions |
| Leave the Abomination visually identical to a lamb in every UI element | Mark it in the tooltip, threat summary or pings |
