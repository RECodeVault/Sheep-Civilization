# Sprint Change Proposal: Breeding Food Becomes a Farm Bar

- **Date:** 2026-10-06
- **Requested by:** Rylan
- **Trigger:** Story 2.2 (Farm Breeding Food), after its first implementation was ready for review
- **Scope:** Moderate. Planning docs, a rewrite of Story 2.2 (rework of its uncommitted code) and new rules for Story 2.3. Development is done by the Developer agent.
- **Status:** Approved by Rylan 2026-10-06; edits applied
- **Mode:** Batch

## 1. Issue Summary

Story 2.2 was built to the current spec. Each Farm Breeding Food click (or `G`) adds +1 to a breeding food stock (0–10), shown on a 10-heart meter. The Breed tool then spends 3 from it.

Rylan wants the breeding button to **work like the Farm button**, so that both producers feel the same:

- Each click fills a pip of an **8-pip bar** under the button. A full bar **drops a breeding-food piece** (a different colour from food) at a random spot in the pen.
- Pieces stay in the pen until eaten. Like food, they have **no cap** and **never spoil**.
- An adult that could breed walks to a piece and eats it. Eating makes it **ready to breed**.
- The **Breed tool pairs two ready adults.** There is no stock and no cost.

This is a design change from the designer, not a defect. The earlier proposal (Farm Progress Bar, same date) had kept breeding food "unchanged: +1 per click, cap 10". This proposal reverses that line.

### Design decisions taken (Rylan, 2026-10-06)

| # | Question | Decision |
|---|---|---|
| D1 | Clicks per breeding piece | **8**, as Farm, tunable (`TUNING.breedingPipsPerFood`). Never boosted, and Better Hoe does not apply. |
| D2 | Where a full bar's breeding food goes | It drops as a **breeding-food piece** (`heart` colour) at a seeded-random reachable spot in the pen. There is no stock. Leftover pips carry over. |
| D3 | Limit | **None.** Pieces pile up in the pen like food and never spoil. |
| D4 | Who eats a piece | **Adults that could breed:** adult stage, not already ready, not on breeding cooldown. Lambs (including the Abomination) and elders ignore pieces. **Normal food comes first:** a sheep that would seek food (Fullness < 90 and a food piece exists) seeks food, not breeding food. |
| D5 | What eating gives | The sheep becomes **ready to breed** (a small heart shows above it). It gives **no Fullness**. |
| D6 | A ready adult turns elder | **Readiness is lost** (elders cannot breed, FR7). |
| D7 | Breeding | The Breed tool pairs **two ready adults**, with no breeding-food cost. Both lose readiness and start the 60 s cooldown (FR10, unchanged). Capacity rules are unchanged (FR11, AR21). |

### Recommendations in this proposal (approve or change)

- **R1, popup:** the "+1" popup rises over the button only when a bar completes and drops a piece, as on Farm.
- **R2, breeding-piece look:** a small `heart`-coloured placeholder sprite (a pink treat). It is distinct from the hay food piece without depending on colour alone: give it a different shape, for example heart-shaped. It bounces on landing like food. [ASSUMPTION]
- **R3, ready marker:** a small `heart` icon floats above a ready sheep, always visible, not only on hover. That lets the player see which sheep can be paired. It is drawn in the world-overlay layer like the infection marker. [ASSUMPTION]
- **R4, Breed greyed reason:** "Needs 2 ready sheep." replaces "Needs 3 breeding food." [ASSUMPTION for the copy]
- **R5, tooltip:** "Farm Breeding Food: fill the bar for 1 breeding food (G)", mirroring Farm's.
- **R6, empty shake removed:** there is no breeding stock to run short of, so the "empty shake" on the breeding meter (UX-DR30, UX-DR83) goes. A greyed Breed tool already explains why breeding is blocked.
- **R7, other piece rules:**
  - Breeding pieces are **not food**: they do not count as "a food piece on the field" for carcass eating (FR14), and starving sheep never eat them.
  - The auto-feeder (Story 4.8) ignores them.
  - Field clicks still do nothing on them.

## 2. Impact Analysis

### Checklist summary

| Item | Status | Finding |
|---|---|---|
| 1.1 Trigger story | [x] | Story 2.2, implemented to the old spec and uncommitted on branch `story/2-2-farm-breeding-food` |
| 1.2 Problem type | [x] | New requirement from the designer (feel and consistency between the two farm buttons) |
| 1.3 Evidence | [x] | Rylan's review of the built button; decisions D1–D7 above |
| 2.1 Current epic | [x] | Epic 2 can still be completed. 2.2 is rewritten and 2.3's rules change. |
| 2.2 Epic-level changes | [x] | No new or removed epics. Epic 2's goal is unchanged. |
| 2.3 Future epics | [x] | 2.8, 3.6, 4.7, 4.8, 5.11: wording or tuning notes only (below) |
| 2.4 Obsolete or new epics | [N/A] | None |
| 2.5 Order or priority | [N/A] | Unchanged |
| 3.1 GDD / FRs | [!] | FR6, FR8, FR9, FR11, FR43 and the GDD Farming, Breeding, Controls, Core Click and Economy sections change. MVP scope unchanged. |
| 3.2 Architecture | [!] | New state (bar, pieces, ready flag), a new sheep activity, `PublicSheep.ready`, and the feeding system's responsibility widens |
| 3.3 UX | [!] | The breeding meter is replaced by a breeding progress bar, plus a new breeding piece and ready marker. Tooltips, Breed greyed copy and breed-mode markers change. |
| 3.4 Other artifacts | [!] | `project-context.md` (one input line, one invariant); the `mockups/hud.html` meter is outdated (spec wins; note only) |
| 4.1 Direct adjustment | Viable | Effort medium, risk low. All changes sit in Epic 2 stories that are not done. |
| 4.2 Rollback | Not viable | Nothing is committed for 2.2; the rework happens in place |
| 4.3 MVP review | Not viable / not needed | MVP unchanged |

### Epic impact

| Epic | Impact |
|---|---|
| 2, Life, Death & Contagion (in progress) | **Changed.** Story 2.2 is rewritten (bar, breeding piece, eating, ready flag). Story 2.3 pairs ready adults with no cost. Story 2.8's "boost does not double breeding food" now reads "does not fill extra breeding pips". |
| 3, Economy & Eras | Story 3.6 also tunes `breedingPipsPerFood` (see pacing) and checks a mixed pile of food and breeding pieces. |
| 4, Hidden Threats & Upgrades | Story 4.7: Better Hoe applies to Farm only (clarified). Story 4.8: the auto-feeder ignores breeding pieces. The Abomination is a lamb forever, so it never eats breeding food or shows the ready heart: no new tell. |
| 5, Names, Feel & Ship | Story 5.11: the field-pile performance check includes breeding pieces. |

### Pacing risk (for Story 3.6)

- **Before:** one breeding cost 3 clicks.
- **After:** one breeding needs 2 pieces (one per parent), which is **16 clicks** at 8 pips per piece, plus the walk to each piece.

Breeding becomes slower and more deliberate. The 60 s cooldown and the 10 s gestation still dominate early pacing, so the "Village in 3–5 min" target probably holds. Story 3.6 checks it and can lower `breedingPipsPerFood` (for example to 4) if the first breeding comes too late.

### Technical impact

- **State (save schema 3; nothing committed yet, so 3 is defined by the reworked 2.2):**
  - `breedingProgress` (0–7)
  - `breedingPieces: { id, x, y }[]`
  - per-sheep `breedReady: boolean`

  The old 2.2 `breedingFood` stock is dropped. A version-2 save migrates with an empty bar, no pieces and no sheep ready.
- **Sim:**
  - The `FarmBreeding` command fills the bar and drops pieces (the same shape as `farm()`).
  - Feeding gains a `seekBreedingFood` activity: it pairs each breeding piece with the nearest eligible adult, and it runs after food so food takes priority.
  - Eating sets `breedReady`.
  - Lifecycle clears `breedReady` when a sheep turns elder.
- **View:**
  - The breeding bar reuses `FarmProgress` in `heart` instead of the 10-heart `BreedingMeter`, which is removed.
  - New: a breeding-piece sprite and pool, and the ready marker over sheep.
- **Unchanged from the built 2.2 and kept:** the `G` key, the button, squash and tooltip handling, the modal guards, the save-migration setup and the debug overlay hook (it becomes "+5 breeding pieces").

## 3. Recommended Approach

**Direct adjustment** inside Epic 2:

1. Apply the document edits below (GDD, epics, UX, architecture, project context).
2. Rewrite the Story 2.2 file to the new ACs and set it back to `in-progress`.
3. Rework the uncommitted 2.2 code on the same branch, then send it to code review as usual.
4. Story 2.3 is created later from the updated epics (Breed pairs ready adults).

**Effort:** medium (most of 2.2's plumbing stays; the bar widget already exists).
**Risk:** low. The feeding system is extended, not replaced.
**Timeline:** about one story's worth of rework. Epic order is unchanged.

## 4. Detailed Change Proposals

### 4.1 Epics (`_bmad-output/planning-artifacts/epics.md`)

**FR6**

OLD: `FR6: A new game starts with 2 adults aged 60 s and 1 newborn lamb, all at Fullness 60, an empty Farm bar and 0 breeding food.`

NEW: `FR6: A new game starts with 2 adults aged 60 s and 1 newborn lamb, all at Fullness 60, with an empty Farm bar, an empty breeding bar and no sheep ready to breed.`

**FR8**

OLD: `FR8: The Farm Breeding Food button adds +1 breeding food, capped at 10; it is never boosted.`

NEW: `FR8: (Changed 2026-10-06) Each Farm Breeding Food click fills 1 pip of an 8-pip breeding bar, shown with its count "{n}/8"; every full bar drops 1 breeding-food piece at a random reachable spot in the pen and the bar resets, with leftover pips carrying over. There is no breeding food stock and no cap; pieces stay until eaten and never spoil. The bar is never boosted and Better Hoe does not apply.`

**New FR8a** (inserted after FR8)

NEW: `FR8a: An adult that is not ready and not on breeding cooldown walks to the nearest breeding-food piece and eats it, becoming ready to breed (no Fullness). A sheep that would seek food (Fullness < 90 and a food piece exists) seeks food first. Lambs and elders ignore breeding pieces, and a ready adult that turns elder loses its readiness.`

**FR9**

OLD: `FR9: With the Breed tool, clicking adult A then adult B costs 3 breeding food, shows a heart, and a lamb is born beside them 10 s later.`

NEW: `FR9: With the Breed tool, clicking ready adult A then ready adult B shows a heart, uses up both sheep's readiness, and a lamb is born beside them 10 s later. Breeding costs no breeding food.`

**FR11**

OLD: `FR11: Breeding is blocked (Breed greyed out) when living sheep plus pending lambs reach land capacity, or when breeding food is below 3.`

NEW: `FR11: Breeding is blocked (Breed greyed out) when living sheep plus pending lambs reach land capacity, or when fewer than 2 adults are ready to breed.`

**FR43:** unchanged ("G = Farm Breeding Food").

**FR Coverage Map:** add `FR8a: Epic 2 - Adults eat breeding food and become ready`. Change `FR11: Epic 2 - Breeding blocked at capacity / fewer than 2 ready adults`.

**UX-DR25**

OLD: `Farm Breeding Food button (breeding meter beneath)`

NEW: `Farm Breeding Food button (breeding progress bar beneath)`

**UX-DR28**

OLD: `…64px; same click/squash/popup behaviour; never boosted.`

NEW: `…64px; same click/squash/popup behaviour as Farm: left-click or G fills a pip of the breeding bar, and a full bar drops a breeding-food piece into the pen with a "+1" popup over the button; never boosted.`

**UX-DR30**

OLD: `UX-DR30: Breeding food meter (breeding-meter): 10 heart pips on wool-shade track under Farm Breeding Food, value "{n}/10", heart-deep tick marking the 3-pip breed cost; same-frame update and empty shake/flash.`

NEW: `UX-DR30: (Changed 2026-10-06) Breeding progress (breeding-progress): stacked under Farm Breeding Food, 8 discrete heart pips on a wool-shade track showing the current bar, with its count "{n}/8" in numeric beside it (starts at "0/8"); updates on the frame of the change. There is no breeding stock, cost tick or empty shake.`

**New UX-DR30a** (after UX-DR30)

NEW: `UX-DR30a: Breeding-food piece: a small heart-coloured, heart-shaped treat on the field, distinct from the hay food piece by shape as well as colour; bounces on landing; a ready sheep shows a small heart icon above it (world-overlay layer, always visible) until it breeds or turns elder. [ASSUMPTION for sprite and marker]`

**UX-DR31**

OLD: `…Greyed (button-disabled) at land capacity (including pending lambs) or when breeding food < 3, with tooltip reason ("No room. Buy land." / "Needs 3 breeding food."); …`

NEW: `…Greyed (button-disabled) at land capacity (including pending lambs) or when fewer than 2 adults are ready, with tooltip reason ("No room. Buy land." / "Needs 2 ready sheep."); …`

**UX-DR56**

OLD: `Breed-mode markers: eligible adults show a soft heart marker; …`

NEW: `Breed-mode markers: ready adults show a soft heart marker; …`

**UX-DR61**

OLD: `…the empty shake remains for the breeding meter (UX-DR30).`

NEW: `…and since 2026-10-06 there is no breeding stock either, so no meter has an empty shake.`

**UX-DR69**

OLD: `…eligible adults get heart marker (lambs, elders, cooldown sheep don't).`

NEW: `…ready adults get heart marker (lambs, elders, sheep that are not ready or are on cooldown don't).`

**UX-DR70**

OLD: `…click adult A (pins heart), then adult B → 3 breeding food spent, heart appears, …`

NEW: `…click ready adult A (pins heart), then ready adult B → both lose readiness, heart appears, …`

**UX-DR75**

OLD: `"Farm Breeding Food: +1 (G)"`

NEW: `"Farm Breeding Food: fill the bar for 1 breeding food (G)"`

**UX-DR83**

OLD: `Empty meter: shake + alert flash.`

NEW: (removed)

**UX-DR96**

OLD: `"No room. Buy land." / "Needs 3 breeding food."`

NEW: `"No room. Buy land." / "Needs 2 ready sheep."`

**Epic 2 summary:** unchanged. FRs covered: add FR8a.

**Story 2.1 AC** (FR6 wording only; the story is done, so no code change)

OLD: `with an empty Farm bar and 0 breeding food (FR6)`

NEW: `with an empty Farm bar (FR6; the breeding bar arrives in 2.2)`

**Story 2.2: Farm Breeding Food** (replace the story body)

NEW:

```
As a player,
I want a second farm button that fills a bar and drops breeding food into the pen,
So that my adults can eat it and become ready to breed.

**Acceptance Criteria:**

**Given** the bottom bar
**When** it renders
**Then** a Farm Breeding Food button (`button-breed-food`: heart fill, heart-deep border, label "Farm Breeding Food", key hint "G") sits right of Farm, with a breeding progress bar beneath it: 8 `heart` pips and "{n}/8" in numeric type, starting at "0/8" (UX-DR28, UX-DR30)

**Given** the button
**When** I click it or press `G`
**Then** a `FarmBreeding` command fills 1 pip (FR8), with Farm's squash and a same-frame bar update; holding `G` gives one action per press (FR43)
**And** a full bar resets (keeping leftover pips) and drops a breeding-food piece at a seeded-random reachable spot in the pen, with a landing bounce and a "+1" popup over the button (UX-DR30a, UX-DR44)
**And** the bar is never boosted; there is no cap and pieces never spoil

**Given** breeding pieces in the pen
**When** an adult is not ready and not on breeding cooldown
**Then** the nearest such adult walks to the nearest piece and eats it, becomes ready (`breedReady`) and gains no Fullness; lambs, elders and ready adults ignore pieces (FR8a)
**And** a sheep that would seek food (Fullness < 90 and a food piece exists) seeks food first; breeding pieces never count as food for carcass eating (FR14)

**Given** a ready sheep
**When** it renders
**Then** a small heart icon shows above it until it breeds or turns elder; turning elder clears `breedReady` (FR8a, UX-DR30a)

**Given** the button tooltip
**When** hovered
**Then** it reads "Farm Breeding Food: fill the bar for 1 breeding food (G)" (UX-DR75)

**Given** a save from before this change
**When** it loads
**Then** it migrates with an empty breeding bar, no pieces and no sheep ready (`SAVE_SCHEMA_VERSION` bump)
```

**Story 2.3: Breed Two Adults** (changed ACs only)

- AC 1:
  - OLD: `**When** I click it with ≥ 3 breeding food and free capacity` … `eligible adults (not on cooldown, not lambs or elders) show a soft heart marker`
  - NEW: `**When** I click it with at least 2 ready adults and free capacity` … `ready adults show a soft heart marker`
- AC 2:
  - OLD: `**When** I click adult A then adult B` / `**Then** A gets a pinned heart, a `Breed` command spends 3 breeding food, …`
  - NEW: `**When** I click ready adult A then ready adult B` / `**Then** A gets a pinned heart, a `Breed` command clears both sheep's `breedReady` and starts their cooldown, …`
- AC 3, "ineligible sheep": now also covers a sheep that is not ready.
- Greyed AC:
  - OLD: `or breeding food < 3` / `"Needs 3 breeding food."`
  - NEW: `or fewer than 2 adults are ready` / `"Needs 2 ready sheep."`
- Remove any reference to the breeding meter's empty shake.

**Story 2.8**

OLD: `**Given** a boost` / `**When** I farm breeding food` / `**Then** it is not doubled (FR8)`

NEW: `**Given** a boost` / `**When** I farm breeding food` / `**Then** each click still fills 1 breeding pip (FR8)`

**Story 3.6** (append to the tuning AC)

NEW: `**And** `TUNING.breedingPipsPerFood` (8) is tuned so the first breeding lands in the GDD pacing window, and a mixed pile of food and breeding pieces keeps the sim tick under 2 ms`

**Story 4.7**

OLD: `**Then** a Farm click fills 2 then 3 pips (FR24); the Farm tooltip is unchanged`

NEW: `**Then** a Farm click fills 2 then 3 pips (FR24); the Farm tooltip is unchanged and the breeding bar still fills 1 pip per click`

**Story 4.8:** add to the redesign note: `It drops food pieces only; breeding pieces are never produced or targeted by it.`

### 4.2 GDD (`gdds/gdd-sheep-civilization-2026-10-05/gdd.md`)

**Core loop table, Farm row**

OLD: `| Farm | Click Farm (food) and Farm Breeding Food | Food meters fill | 1 |`

NEW: `| Farm | Click Farm (food) and Farm Breeding Food | Both bars fill; each full bar drops a piece in the pen | 1 |`

**Core loop table, Breed row**

OLD: `| Breed | Pair two adults using breeding food | …`

NEW: `| Breed | Adults eat breeding food to become ready; pair two ready adults | …`

**Farming and Feeding table**

OLD: `| **Farm Breeding Food** button | +1 breeding food per click. Breeding meter cap **10**. Start with 0. |`

NEW: `| **Farm Breeding Food** button | Works like Farm: each click fills 1 pip of an **8-pip** breeding bar (tune), shown "{n}/8". Every full bar drops **1 breeding-food piece** (a pink treat) at a random reachable spot in the pen; leftover pips carry over. No stock, no cap, never boosted (changed 2026-10-06). |`

Add a row after "Sheep seek food":

`| Sheep seek breeding food | An adult that is not ready and not on cooldown walks to the nearest breeding piece and eats it, becoming **ready to breed** (no Fullness). Food comes first: a sheep that would seek food does that instead. Lambs and elders ignore breeding pieces. A ready adult that turns elder loses its readiness. |`

**Breeding, steps 1–4**

OLD:

```
1. Choose the **Breed** tool.
2. Click adult A, then adult B.
3. This costs **3 breeding food**.
4. A heart appears, and a lamb is born beside them **10 s** later.
```

NEW:

```
1. Feed breeding food: adults that eat a breeding piece become **ready** (a small heart shows above them).
2. Choose the **Breed** tool.
3. Click ready adult A, then ready adult B. Breeding uses up both sheep's readiness and costs nothing else.
4. A heart appears, and a lamb is born beside them **10 s** later.
```

Add: `Breeding is also blocked while fewer than 2 adults are ready.`

**The Better Place:** `The boost applies to the Farm (food) button only, not to Farm Breeding Food.` stays as is.

**Controls**

OLD: `/ add 1 breeding food`

NEW: `/ fill the breeding bar (8 clicks = 1 breeding piece)`

**Core Click**

OLD: `Farm (fills the Farm bar; a full bar = 1 food) and Farm Breeding Food (+1 breeding food).`

NEW: `Farm (fills the Farm bar; a full bar = 1 food) and Farm Breeding Food (fills the breeding bar; a full bar = 1 breeding piece).`

**Economy table**

OLD: `| Breeding food | Farm Breeding Food click +1 | 3 per breeding | 10 |`

NEW: `| Breeding food | 1 piece per full breeding bar (8 pips; a click fills 1, never boosted) | Eaten by an adult that can breed (makes it ready; a breeding uses 2 ready adults) | None: pieces wait in the pen, never spoil |`

**Number Balancing, Time gates:** add `One breeding needs 2 breeding pieces (16 clicks at 8 pips) [ASSUMPTION, tune in the post-Epic 3 playtest].`

**GDD `epics.md` (planning summary, lines 53 and 59)**

- OLD: `The Farm Breeding Food button (+1, cap 10). Breed tool: adult A, then adult B, costs 3, …`
- NEW: `The Farm Breeding Food button fills a bar that drops breeding pieces; adults that eat one become ready. Breed tool: ready adult A, then ready adult B, …`
- OLD: `breeding food starts at 0`
- NEW: `the breeding bar starts empty`

### 4.3 UX

**DESIGN.md front matter:** replace `breeding-meter` with:

```yaml
  breeding-progress:
    trackColor: '{colors.wool-shade}'
    fillColor: '{colors.heart}'
    segmentCount: '8'
    valueTypography: '{typography.numeric}'
```

Add `breeding-piece` (fill `{colors.heart}`, outline `{colors.heart-deep}`) and `ready-marker` (fill `{colors.heart}`, outline `{colors.bark}`, size 14px). [ASSUMPTION for sizes]

**DESIGN.md colours table**

OLD: `| | heart-deep | #A8405D | Breed tool active state, breed-cost marker | |`

NEW: `| | heart-deep | #A8405D | Breed tool active state, breeding-piece outline | |`

The `heart` row adds "breeding bar, breeding piece, ready marker".

**DESIGN.md layout sketch**

OLD: `│ ▮▮▮▯▯▯▯▯ 3/8          ♥ ▮▮ 4/10 …`

NEW: `│ ▮▮▮▯▯▯▯▯ 3/8          ▮▮▯▯▯▯▯▯ 2/8 …`

**DESIGN.md Components**

- OLD: `- **Breeding food meter** (`breeding-meter`): 10 `heart` pips, stacked under the Farm Breeding Food button. A `heart-deep` tick marks the 3-pip breed cost.`
- NEW: `- **Breeding progress** (`breeding-progress`): 8 discrete `heart` pips on a `wool-shade` track, stacked under the Farm Breeding Food button, with the count "2/8" beside it (it starts at "0/8"). A full bar drops 1 breeding piece into the pen and empties. (changed 2026-10-06)`
- Add: `- **Breeding piece** and **ready marker**: a small heart-shaped `heart` treat on the field, and a small `heart` icon above a ready sheep. [ASSUMPTION]`

**EXPERIENCE.md**

- **HUD hierarchy:**
  - OLD: `the breeding food meter (/10)`
  - NEW: `the breeding progress bar ("{n}/8")`
- **Voice table:**
  - OLD: `| Breed greyed (food) | Tooltip: "Needs 3 breeding food." [ASSUMPTION] |`
  - NEW: `| Breed greyed (not ready) | Tooltip: "Needs 2 ready sheep." [ASSUMPTION] |`
- **Button tooltips:**
  - OLD: `"Farm Breeding Food: +1 (G)"`
  - NEW: `"Farm Breeding Food: fill the bar for 1 breeding food (G)"`
- **Component Patterns, Farm Breeding Food button:**
  - OLD: `Same behaviour, using G. It is never boosted.`
  - NEW: `Same behaviour as Farm, using G: each click fills a pip of the 8-pip breeding bar, and a full bar drops a breeding piece at a random spot in the pen with a "+1" popup. Adults that can breed walk to it and eat it, becoming ready. It is never boosted.`
- **Component Patterns, progress row:**
  - OLD: `| Farm progress / breeding food meter | Update the same frame as the change. An attempted breeding spend with too little triggers the empty shake (…) on the breeding meter. |`
  - NEW: `| Farm progress / breeding progress | Update the same frame as the change. |`
- **Component Patterns, Breed tool:**
  - OLD: `or when breeding food is below 3 [ASSUMPTION for the food case]`
  - NEW: `or when fewer than 2 adults are ready`
- **State Patterns:** add a row `| Ready to breed | Sheep | Small heart icon above the sheep until it breeds or turns elder. |`
- **Breed mode:**
  - Enter: `eligible adults get a soft heart marker. Ineligible sheep (lambs, elders, sheep on cooldown) do not.` → `ready adults get a soft heart marker. Other sheep (lambs, elders, adults not ready) do not.`
  - Pair: `3 breeding food is spent, a heart appears` → `both sheep stop being ready, a heart appears`
- **Game Feel:**
  - Add `| Breeding piece drop | Piece bounces on landing |` and `| Eating breeding food | Munch particle, then the ready heart pops in |`
  - Remove "Empty meter: shake + alert flash".

**mockups/hud.html:** not edited. Its 10-heart meter is now out of date, and the spec wins on conflict. Add a one-line note at the top of the file's comment block: `Breeding meter superseded 2026-10-06 by an 8-pip breeding progress bar (see DESIGN.md).`

### 4.4 Architecture (`_bmad-output/game-architecture.md`)

- **State Management:** add after the Farm-bar bullet:
  `- The breeding bar lives in `state.breedingProgress` (0 to `TUNING.breedingPipsPerFood − 1`). Every full bar drops a breeding piece into `state.breedingPieces: { id, x, y }[]` at a seeded-random reachable spot. A sheep that eats one gets `breedReady: true`; there is no breeding stock (changed 2026-10-06).`
- **Capacity / pregnancies bullet:** unchanged.
- **PublicSheep:** add `ready: boolean` (from `breedReady`). It is not secret; the Abomination is never ready because it never grows past the lamb stage.
- **State Patterns, `activity`:**
  - Add `seekBreedingFood` (`wander` → `seekBreedingFood` → `eating` → `wander`).
  - In `nextActivity`, after the `seekFood` line: `if (canEatBreedingFood(s, state) && state.breedingPieces.length) return 'seekBreedingFood';`
  - `canEatBreedingFood` = adult stage, `!breedReady`, not on cooldown.
- **System Location Mapping:**
  - Farming & feeding: `Farm progress, food pieces (dropped by full Farm bars), eating` → `Farm and breeding progress, food and breeding pieces (dropped by full bars), eating both`
  - Breeding: `Pair validation, cost, cooldown, capacity` → `Pair validation (two ready adults), cooldown, capacity`
  - Life stages: add `clears breedReady on turning elder`.
- **N3 pools:** add a breeding-piece pool (pre-size 30, grows on demand).

### 4.5 Project context (`_bmad-output/project-context.md`)

- **Critical Don't-Miss, Capacity bullet**
  - OLD: `Breeding is blocked at capacity; Breed greys out with the reason tooltip.`
  - NEW: `Breeding is blocked at capacity or with fewer than 2 ready adults; Breed greys out with the reason tooltip. Breeding food is a field piece adults eat to become ready (no stock).`
- **Boost bullet:** `doubles **Farm (food) only**, not breeding food.` → `doubles **Farm (food) pips only**, never the breeding bar.`

### 4.6 Story 2.2 file and code (implementation)

- **Story file:** rewrite `_bmad-output/implementation-artifacts/2-2-farm-breeding-food.md` from the new Story 2.2 above.
  - Keep the reusable parts of the Dev Notes: G-key handling, Button wiring, modal guards, schema bump/migration/validation pattern, browser-probe notes, and the 200 px button width.
  - Drop the `BreedingMeter` and stock-specific tasks.
- **Status:** `review` → `in-progress` (story file and sprint-status). Nothing is committed for 2.2, so there is nothing to revert in git.
- **Code to remove:**
  - `BreedingMeter.ts`
  - `TUNING.breedingFoodPerClick/breedingFoodCap/breedCost`
  - `GameState.breedingFood`
  - the `added === 0` bump path
  - the "Fill breeding" debug button
- **Code to add:**
  - `breedingProgress`, `breedingPieces`, `Sheep.breedReady`
  - `seekBreedingFood`
  - a breeding-piece sprite (art and atlas) and pool
  - the ready marker
  - lifecycle clearing readiness at elder
  - the save schema 3 migration for the new fields
  - a "+5 breeding pieces" debug button

## 5. Implementation Handoff

- **Scope:** Moderate. The docs, Story 2.2 and the backlog wording change. No epics are added or removed. Sprint-status changes only for 2.2's status.
- **Handoff:**
  - **Developer agent (this session), on approval:**
    1. Apply the edits in 4.1–4.5.
    2. Rewrite the Story 2.2 file (4.6) and set it to `in-progress`.
    3. Run `/gds-dev-story` to rework the code.
    4. Code review.
  - **Story 2.3 creation (later):** use the updated epics. Breed pairs ready adults.
  - **Story 3.6 (later):** tune `breedingPipsPerFood` against pacing.
- **Success criteria:**
  - Every doc names breeding food the same way: a bar of 8 pips, pieces in the pen, ready adults. No doc still mentions a breeding stock, cap 10, cost 3 or "Needs 3 breeding food".
  - Story 2.2 passes its new ACs, with tests for the bar, piece drops, food-first priority, ready on eat, readiness lost at elder, and the save migration.
  - `npm test`, `npm run typecheck` and `npm run lint` pass. Browser check of the new button, pieces and ready hearts.
