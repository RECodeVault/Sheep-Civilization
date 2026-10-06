# Sprint Change Proposal: Farm Progress Bar

- **Date:** 2026-10-06
- **Requested by:** Rylan
- **Trigger:** Story 1.7 (Drop Food and Sheep Eat) review, before development
- **Scope:** Moderate. Planning docs plus a rework of the ready-for-dev Story 1.7. Development is done by the Developer agent.
- **Status:** Approved by Rylan 2026-10-06; edits applied

## 1. Issue Summary

Today (FR3, built in Story 1.6), every Farm click adds +1 food to a 20-pip food meter. Rylan wants farming to feel like filling a bar:

- Every Farm click (or `F`) fills one pip of an **8-pip progress bar** under the Farm button. Rylan first suggested 10, then lowered it to 8 so the player does not have to click as fast to keep up.
- When the bar fills, **+1 food** goes into the food stock and the bar resets.
- The food stock keeps its cap of 20 and start of 5. A field click still spends 1 food to drop a piece (Story 1.7).
- **New overflow rule:** if the stock is already full (20) when the bar fills, the food piece **drops straight onto the pasture** and stays there until a sheep that can eat (Fullness < 90) comes to eat it. The player can always keep clicking, so food can be stockpiled on the field.

This is a design change from the designer, not a defect. It came up while the Story 1.7 spec was being reviewed.

### Design decisions taken (Rylan, 2026-10-06)

| Question | Decision |
|---|---|
| Where a full bar's food goes | Into the food stock (cap 20). When the stock is full, onto the field as a piece. |
| Clicks per food | **8** (tunable) |
| Farm Breeding Food (G) | Unchanged: +1 breeding food per click, cap 10 |
| Better Hoe and boost | They fill more pips per click: base 1, Hoe I 2, Hoe II 3; the boost doubles the pips. Leftover pips carry into the next bar. |
| Clicking at the stock cap | Allowed without limit; the overflow piece drops onto the field |
| HUD | Under Farm: the 8-pip progress bar, then the stock as a hay icon and "{n}/20" |
| Field-drop click (Story 1.7) | Resolves on release (confirmed) |

### Recommendations in this proposal (approve or change)

- **R1, popups:** the "+1" popup shows when a full bar adds food to the stock. Each click's feedback is the squash plus the pip filling. When the food overflows onto the field, there is no popup over the button; the piece's bounce on the field is the feedback.
- **R2, overflow landing spot:** a random point inside the reachable fence area, drawn from the sim's seeded RNG. **[ASSUMPTION]** Alternatives: next to the Farm side of the pen, or next to the hungriest sheep. Hungriest-sheep is avoided because it would make farming do the auto-feeder's job.
- **R3, no cap on field pieces for now:** pieces never spoil. Story 3.6 (tuning) and 5.11 (performance) check that a large pile stays cheap. The feeding system must stay inside the 2 ms tick budget with 100 sheep and 300 pieces.
- **R4, button tooltip:** "Farm: fill the bar for 1 food (F)". It no longer depends on the hoe value, so Story 4.7 does not need to update it.

## 2. Impact Analysis

### Epic impact

| Epic | Impact |
|---|---|
| 1, Flock Survival Core (in progress) | **Changed.** Story 1.6 (done) built +1 per click; its Farm rule and food meter are reworked inside Story 1.7. Story 1.7 grows: progress bar, stock read-out, overflow drop. 1.8–1.10 are unaffected. |
| 2, Life, Death & Contagion | Story 2.2: breeding food stays +1 per click, but the "same as Farm" wording changes. Story 2.8: the boost doubles **pips per click**, not food per click. |
| 3, Economy & Eras | Story 3.6: the pacing pass must tune `farmPipsPerFood` (8) and check the field-pile performance. |
| 4, Hidden Threats & Upgrades | Story 4.7: Better Hoe gives 2 / 3 pips per click. Story 4.8 (auto-feeder): unchanged; it still takes food from the stock. |
| 5, Names, Feel & Ship | Story 5.8: the juice list says "+N popups"; that still holds. Story 5.11: add the field-pile check. |

No epic becomes obsolete, no new epic is needed, and the order is unchanged.

### Pacing risk (for Story 3.6)

Each sheep needs a piece about every 42 s, so feeding now costs about 8× the clicks:

| Flock | Pieces needed | Clicks/s at base (8 per food) | With Hoe II (3 pips) | Hoe II + boost (6 pips) |
|---|---|---|---|---|
| 3 | 1 per 14 s | 0.6 | 0.2 | 0.1 |
| 10 (Village) | 1 per 4.2 s | 1.9 | 0.6 | 0.3 |
| 25 (Town) | 1 per 1.7 s | 4.8 | 1.6 | 0.8 |

This is on top of the field clicks that drop each piece. At Town, base farming is very demanding, so Better Hoe and the boost become much more important. `farmPipsPerFood` is a `TUNING` value. Story 3.6 decides whether 8 holds or whether Better Hoe should move from Should to Must.

### Artifact conflicts

- **GDD:** Farming and Feeding table, Better Place boost bullets, Controls table, Core Click/Interaction, Upgrade table, Number Balancing, Difficulty Curve, Economy table, decision log.
- **GDD epic list (`gdds/.../epics.md`):** the Epic 1 and Epic 4 bullets.
- **epics.md:** FR3, FR19, FR24; UX-DR26, UX-DR27, UX-DR29, UX-DR44, UX-DR75; Stories 1.6 (note only), 1.7, 2.2, 2.8, 3.6, 4.7, 5.11.
- **UX:** EXPERIENCE.md (Component Patterns rows, State Patterns, tooltip copy, the Sam walkthrough); DESIGN.md (the `food-meter` component split into `farm-progress` + `food-stock`, the layout sketch, the Components prose). The mockups (`hud.html`) stay illustrative; the spec wins on conflict.
- **Architecture:** a small `GameState` addition (`farmProgress`) and Data Patterns `hudView`. No pattern or technology change.
- **Code (Story 1.6, done):** `commands.ts` (Farm), `events.ts` (`Farmed`), `state.ts`, `selectors.ts` (`HudView`), `tuning.ts`, `FoodMeter.ts`, `BottomBar.ts`, `HudScene.ts`, `strings.ts`, tests. All of it is reworked in Story 1.7.

## 3. Recommended Approach

**Direct adjustment.** Update the planning docs in place, and fold the Farm rework into Story 1.7, which is still ready-for-dev and not started.

- **Rollback:** not needed. The 1.6 widgets (`Button`, `Panel`, `FloatPopups`, the pip images and the box textures) are all reused. Only the Farm rule and the meter layout change.
- **MVP review:** not needed. The MVP scope is the same; only the economy curve shifts, and Story 3.6 already owns tuning.
- **Effort:** low–medium; about half a day added to Story 1.7.
- **Risk:** low technically. Medium for pacing, which Story 3.6 handles.
- **Save schema:** no bump. Saving starts in Story 1.9; `farmProgress` is part of the version-1 schema from the start.

## 4. Detailed Change Proposals

### 4.1 GDD (`gdds/gdd-sheep-civilization-2026-10-05/gdd.md`)

**Farming and Feeding table**

OLD:
```
| **Farm** button | +1 food per click. Food meter cap **20**. Start with 5. |
```
NEW:
```
| **Farm** button | Each click fills 1 pip of an **8-pip** progress bar (tune). A full bar adds **+1 food** to the food stock and resets; leftover pips carry over. Stock cap **20**, start with 5. When the stock is full, the food drops onto the field as a piece instead, so clicking is never wasted and food can be stockpiled on the field. |
```

**Better Place bullets**

OLD:
```
- Each sacrifice grants **2× food per Farm click for 30 s**. Sacrificing again during a boost resets the timer to 30 s; boosts do not stack.
...
- The 20-food meter cap limits how much the boost is worth (about 10 Farm clicks saved per meter fill), so sacrificing a lamb just for the boost only pays off when feeding a large flock.
```
NEW:
```
- Each sacrifice **doubles the pips each Farm click fills, for 30 s**. Sacrificing again during a boost resets the timer to 30 s; boosts do not stack.
...
- Overflow food drops onto the field, so the stock cap no longer limits the boost. Its value is about 30 s of farming at double speed, which matters most when feeding a large flock.
```

**Controls table**

OLD: `| Left-click **Farm** / **Farm Breeding Food** | Add 1 food / 1 breeding food (×2 food while boosted) |`
NEW: `| Left-click **Farm** / **Farm Breeding Food** | Fill the Farm bar (8 clicks = 1 food; 2× pips while boosted) / add 1 breeding food |`

**Core Click/Interaction**

OLD:
```
- **Primary clicks:** Farm (+1 food) and Farm Breeding Food (+1 breeding food). ...
- **Click value progression:** Farm click upgrades take a click to +2 and then +3. The Better Place boost doubles the current click value for 30 s.
```
NEW:
```
- **Primary clicks:** Farm (fills the Farm bar; a full bar = 1 food) and Farm Breeding Food (+1 breeding food). ...
- **Click value progression:** a Farm click fills 1 pip; Better Hoe upgrades raise it to 2 and then 3 pips. The Better Place boost doubles the pips per click for 30 s.
```

**Upgrade table:** `Better Hoe I / II | … | Farm click +2 / +3` → `Farm click fills 2 / 3 pips`.

**Number Balancing → Feed demand:** add after the 25-sheep line:
```
  At 8 clicks per food, 10 sheep need about 1.9 Farm clicks/s and 25 sheep about 4.8 (before upgrades), plus one field click per piece. Better Hoe and the boost cut this to a half or a third. [ASSUMPTION, tune in the post-Epic 3 playtest]
```

**Difficulty Curve:** `The feed load approaches one click every 2–4 s.` → `The feed load approaches 2–5 Farm clicks per second before upgrades, which is where Better Hoe and the boost earn their keep.`

**Economy table:** `| Food | Farm click +1 (+2/+3 with upgrades, ×2 when boosted) | 1 per food piece | 20 |` → `| Food | 1 per full Farm bar (8 pips; a click fills 1, 2 or 3 pips with upgrades, ×2 when boosted) | 1 per food piece | 20 in stock; overflow drops onto the field (no field cap) |`

**Decision log:** add a "2026-10-06 · Farm progress bar (Rylan)" entry that summarises the decisions table in section 1.

### 4.2 GDD epic list (`gdds/.../epics.md`)

- Epic 1: `Farm button (+1 food, cap 20).` → `Farm button fills an 8-click bar; a full bar = +1 food (stock cap 20; overflow drops onto the field).`
- Epic 4: `Better Hoe I / II … raising a Farm click to +2 / +3` → `… raising a Farm click to 2 / 3 pips`.

### 4.3 epics.md

**FR3**

OLD: `FR3: The Farm button adds the current click value of food (base +1) to the food meter, capped at 20; the meter starts at 5.`
NEW: `FR3: Each Farm click fills the current click value of pips (base 1) on an 8-pip Farm progress bar; each full bar adds 1 food to the food stock and the bar resets, with leftover pips carrying over. The stock starts at 5 and is capped at 20; a bar completed while the stock is full drops 1 food piece at a random reachable spot on the field instead.`

**FR19:** `Each sacrifice grants 2× food per Farm click for 30 s` → `Each sacrifice doubles the pips per Farm click for 30 s`.

**FR24:** `raising a Farm click to +2/+3` → `raising a Farm click to 2/3 pips`.

**UX-DR26 (Farm button):** `Left-click or F adds click value, squash animation, "+N" float popup and pop SFX. At cap (20) still squashes but no popup and meter does a small bump.` → `Left-click or F fills the click value of pips on the Farm progress bar, with a squash and a soft pop SFX. When a bar completes into the stock, a "+1" float popup rises over the button; when it completes with the stock full, the piece drops onto the field with its landing bounce instead (no popup).`

**UX-DR27:** `popups show doubled value` → `each click fills double pips`.

**UX-DR29 (food meter) → split:**
`UX-DR29: Farm progress and food stock, stacked under Farm: (a) farm-progress: 8 discrete hay pips on a wool-shade track showing the current bar; (b) food-stock: hay food icon + "{n}/20" in numeric. Both update on the frame of the change. An empty or insufficient spend makes the food-stock read-out flash alert and shake (flash only under reduced motion).`

**UX-DR44:** examples unchanged ("+1", "+2", "$10", "×2"); remove any implication that every Farm click pops.

**UX-DR75 / UX-DR96:** `"Farm: +1 food (F)"` → `"Farm: fill the bar for 1 food (F)"`.

**Story 1.6:** add a note under its ACs: *"Superseded in part by the 2026-10-06 change: the Farm rule (FR3) and the food meter (UX-DR29) are reworked in Story 1.7."* Its status stays done.

**Story 1.7:** add the Farm rework to its acceptance criteria:
```
**Given** the Farm button and food stock below 20
**When** I click Farm or press F 8 times
**Then** each click fills one pip of the 8-pip Farm progress bar (squash, same-frame update), and the 8th adds 1 food to the stock, resets the bar and pops "+1" (FR3, UX-DR26, UX-DR29)

**Given** the food stock at 20
**When** a Farm bar completes
**Then** the stock stays 20 and one food piece drops at a random reachable spot on the field, bouncing on landing, and sheep eat it like any other piece (FR3, FR5)

**Given** the HUD
**When** it renders
**Then** under Farm it shows the 8-pip progress bar and the food stock as an icon and "{n}/20"; the Farm tooltip reads "Farm: fill the bar for 1 food (F)"
```
The "food is 0" AC changes `the food meter shakes and flashes alert` → `the food stock read-out shakes and flashes alert`.

**Story 2.2:** `with the same squash, "+1" popup and same-frame meter update as Farm` → `with Farm's squash and same-frame meter update, and a "+1" popup on every click (breeding food has no progress bar)`.

**Story 2.8:** `Farm clicks give 2× the current click value` → `each Farm click fills 2× the current pips`; `popups show the doubled value` → `each click visibly fills double pips`; test line `Farm gives 2 food at 29 s and 1 food at 31 s` → `a Farm click fills 2 pips at 29 s and 1 pip at 31 s`.

**Story 3.6:** add `tune TUNING.farmPipsPerFood (8) against the feed-demand table, and decide whether Better Hoe moves from Should to Must; confirm a 300-piece field pile keeps the tick under 2 ms`.

**Story 4.7:** `a Farm click gives +2 then +3 food; popups and the Farm tooltip reflect the new value` → `a Farm click fills 2 then 3 pips`; `the boost doubles the current click value (+4 / +6)` → `(4 / 6 pips)`. The tooltip no longer changes (R4).

**Story 5.11:** add `field food pile: 100 sheep and 300 pieces hold 60 FPS`.

### 4.4 UX: EXPERIENCE.md

- Component Patterns, **Farm button** row: replace with the UX-DR26 text above.
- **Food meter / Breeding food meter** row → `Farm progress / food stock / breeding food meter`: same-frame updates; an attempted spend with too little triggers the empty shake on the food stock read-out (or the breeding meter).
- State Patterns, **Boost active:** `popups show the doubled value` → `each Farm click fills double pips`.
- State Patterns, **Empty food meter:** `The meter shakes` → `The food stock read-out shakes`.
- Voice table, button tooltips: `"Farm: +1 food (F)"` → `"Farm: fill the bar for 1 food (F)"`.
- IA "Act now" line: `the food meter (/20)` → `the Farm progress bar and food stock (/20)`.
- Key Flows, Sam step 5: `Sam finds **Farm** (squash, "+1") and refills it.` → `Sam finds **Farm**: each click fills a pip, and every eighth pops "+1" into the stock.`

### 4.5 UX: DESIGN.md

- Front matter: replace `food-meter` with
  ```yaml
  farm-progress:
    trackColor: '{colors.wool-shade}'
    fillColor: '{colors.hay}'
    segmentCount: '8'
  food-stock:
    iconColor: '{colors.hay}'
    emptyFlashColor: '{colors.alert}'
    valueTypography: '{typography.numeric}'
  ```
- Components prose: replace the **Food meter** bullet with matching `farm-progress` and `food-stock` bullets.
- Layout sketch, line 2: `▮▮▮ 12/20` → `▮▮▮▯▯▯▯▯ 🌾12/20`.
- `src/config/constants.ts` `COMPONENTS` mirrors this; the constants test that counts 35 components becomes 36.

### 4.6 Architecture (`game-architecture.md`)

- State Management: add `farmProgress` (integer pips in the current Farm bar, 0 to `farmPipsPerFood − 1`) to the `GameState` fields.
- Data Patterns: the `hudView` comment adds `farmProgress, farmPipsPerFood`.
- System Location Mapping, Farming & feeding: `Food meters, food pieces, eating` → `Farm progress, food stock, overflow drops, food pieces, eating`.
- No change to patterns, ADRs or the stack.

### 4.7 Story 1.7 file (`implementation-artifacts/1-7-drop-food-and-sheep-eat.md`)

Rework it once this proposal is approved:

- Add the three ACs from 4.3.
- **Sim tasks:**
  - TUNING gets `farmPipsPerFood: 8` and `farmPipsPerClick: 1`; `farmFoodPerClick` is removed.
  - `GameState.farmProgress` starts at 0.
  - `applyCommand('Farm')`: add pips, and while `farmProgress >= farmPipsPerFood`, subtract a bar and either add 1 food (below the cap) or `createFoodPiece` at an rng point in the inner fence.
  - `Farmed` carries `{ pips, toStock, toField }` so the HUD can pop "+1" and the field can bounce.
  - `HudView` adds `farmProgress` and `farmPipsPerFood`.
  - Tests: 8 clicks = 1 food; carry-over; overflow at the cap drops a piece that a sheep eats; determinism.
- **View tasks:**
  - Rework `FoodMeter` into a `FarmProgress` pip bar (8 pips, reusing the pip art at a width that fits under the 232 px button) and a `FoodStock` read-out (hay icon + "{n}/20", owning the refuse shake and flash).
  - Update `BottomBar`, `HudScene.onSim` (popup only when `toStock > 0`), `STRINGS.farmTooltip` and the `constants.ts` component specs.
  - Add one placeholder `icon-food` frame to the `ui` atlas.
- Gotchas, references and the file list are updated to match.

## 5. Implementation Handoff

- **Scope:** Moderate. Backlog edits plus a story rework; no replanning.
- **Developer agent (this session, on approval):**
  1. Apply edits 4.1 to 4.6 to the planning docs.
  2. Rework the Story 1.7 file (4.7); it stays `ready-for-dev`.
  3. Leave `sprint-status.yaml` unchanged: no stories are added or removed.
- **Then:** `/gds-dev-story` on Story 1.7, then `/gds-code-review`.
- **Success criteria:**
  - The docs agree: 8 pips per food, stock cap 20, overflow drops onto the field, the boost and hoes fill more pips, breeding food is unchanged.
  - Story 1.7 implements and tests the new Farm rule along with food drops and eating.
  - Story 3.6 carries the pacing check.
