import type Phaser from 'phaser';
import { COMPONENTS, LAYOUT, RADIUS, SPACING } from '../../config/constants';
import { TUNING } from '../../config/tuning';
import { invariant } from '../../core/invariant';
import { STRINGS } from '../strings';
import { Button, type ButtonSpec } from '../widgets/Button';
import { OUTLINE_PX } from '../widgets/box';
import { Panel } from '../widgets/Panel';
import { FRAME } from '../assetKeys';
import { BOOST_TIMER_W, BoostTimer } from './BoostTimer';
import { FarmBoost } from './FarmBoost';
import { farmProgressWidth, FarmProgress } from './FarmProgress';
import { FLOCK_COUNTER_W, FlockCounter } from './FlockCounter';
import { MONEY_COUNTER_W, MoneyCounter } from './MoneyCounter';
import { THREAT_SUMMARY_W, ThreatSummary } from './ThreatSummary';

// Bar layout in canvas px (DESIGN.md Layout & Spacing; UX-DR25, UX-DR101). The mockup centres the
// Farm group in the 112 px bar, which would put the meter inside the 16 px safe margin; the spec wins,
// so the group sits higher and ends at or above canvasHeight - safeMargin.
const BAR_TOP = LAYOUT.canvasHeight - LAYOUT.hudBarHeight;
const FARM_X = LAYOUT.safeMargin;
const FARM_Y = BAR_TOP + 6;
const FARM_W = 232; // mockups/hud.html `.btn-farm`
const METER_GAP = 4;
// Each bar draws one pip per tuned pip (Story 3.6), so its width follows TUNING; it must fit under its
// button (checked after the button widths below). 14 px pips: Farm up to 11, breeding up to 9.
const FARM_PROGRESS_W = farmProgressWidth(TUNING.farmPipsPerFood);
const BREEDING_PROGRESS_W = farmProgressWidth(TUNING.breedingPipsPerFood);
const METER_Y = FARM_Y + COMPONENTS.buttonFarm.height + METER_GAP;
// Groups (a button with its meter) are SPACING[3] apart; the mockup's `.hud` gap is 10 px, the
// nearest spacing token is 12.
const GROUP_GAP = SPACING[3];
// Farm Breeding Food: right of the Farm group. The mockup's `.btn-breedfood` is 190 px, but in the
// canvas font "Farm Breeding" then runs into the key hint, so it is 200 (browser-checked).
const BREED_FOOD_X = FARM_X + FARM_W + GROUP_GAP;
const BREED_FOOD_W = 200;
// Story 3.6 code review: a pip bar never runs past its button. A retune that needs more pips narrows
// PIP_W in FarmProgress (or widens the button) instead of shifting the row.
invariant(
  FARM_PROGRESS_W <= FARM_W,
  `BottomBar: the Farm bar (${TUNING.farmPipsPerFood} pips, ${FARM_PROGRESS_W} px) is wider than its ${FARM_W} px button`,
);
invariant(
  BREEDING_PROGRESS_W <= BREED_FOOD_W,
  `BottomBar: the breeding bar (${TUNING.breedingPipsPerFood} pips, ${BREEDING_PROGRESS_W} px) is wider than its ${BREED_FOOD_W} px button`,
);
// The Breed tool (UX-DR31): right of the Farm Breeding Food group, 104 px wide (mockups/hud.html
// `.btn-breed`), top-aligned with the Farm buttons at their height (Rylan, 2026-10-07).
const BREED_X = BREED_FOOD_X + BREED_FOOD_W + GROUP_GAP;
const BREED_W = 104;
// The right end, in the mockup's order (Story 3.2 re-spaced it, deferred-work "A crowded bottom bar"):
// … threat summary (UX-DR39) · boost timer (UX-DR38) · Shop toggle (UX-DR40), packed one group gap
// apart from the 16 px safe edge. The Shop toggle is 80 px (mockups/hud.html `.shop-toggle`: "Shop" plus
// SPACING[4] each side). [ASSUMPTION, browser-checked]
const SHOP_W = 80;
const SHOP_X = LAYOUT.canvasWidth - LAYOUT.safeMargin - SHOP_W;
const SHOP_Y = BAR_TOP + (LAYOUT.hudBarHeight - COMPONENTS.shopToggle.height) / 2;
const BOOST_X = SHOP_X - GROUP_GAP - BOOST_TIMER_W;
const THREAT_X = BOOST_X - GROUP_GAP - THREAT_SUMMARY_W;
// The read-outs between Breed and the threat summary: money (UX-DR34, Story 3.2; "$n" with no coin)
// right after Breed, then the flock counter (UX-DR35, Story 3.3; mockup `.readout`). The Medicine slot
// (4.5) has no room reserved yet; it only shows while doses are owned, and 4.5 re-spaces the read-outs
// (deferred-work).
const MONEY_X = BREED_X + BREED_W + GROUP_GAP;
const FLOCK_X = MONEY_X + MONEY_COUNTER_W + GROUP_GAP;
invariant(
  FLOCK_X + FLOCK_COUNTER_W <= THREAT_X - GROUP_GAP,
  'BottomBar: the money and flock counters overrun the threat summary',
);
// The toggle's look from DESIGN.md `shop-toggle`: its open look is the Button's toggled one.
const SHOP_SPEC: ButtonSpec = {
  backgroundColor: COMPONENTS.shopToggle.backgroundColor,
  borderColor: COMPONENTS.shopToggle.borderColor,
  textColor: COMPONENTS.shopToggle.textColor,
  activeBackgroundColor: COMPONENTS.shopToggle.openBackgroundColor,
  activeTextColor: COMPONENTS.shopToggle.openTextColor,
  typography: COMPONENTS.shopToggle.typography,
  rounded: COMPONENTS.shopToggle.rounded,
  height: COMPONENTS.shopToggle.height,
};

/**
 * The HUD bottom bar: a full-width wool surface with actions on the left (UX-DR25). Story 1.6 builds
 * the Farm button with the Farm progress bar and its count beneath it (1.7), 2.2 the Farm Breeding
 * Food button with the breeding bar, 2.3 the Breed tool, 2.6 the threat summary on the right, 2.8 the
 * Farm button's boosted glow and badge and the boost timer, 3.2 the money counter and the Shop toggle,
 * 3.3 the flock counter; 4.5 adds the Medicine slot between them.
 */
export class BottomBar {
  readonly farmButton: Button;
  readonly farmProgress: FarmProgress;
  readonly breedFoodButton: Button;
  readonly breedingProgress: FarmProgress;
  readonly breedButton: Button;
  readonly threats: ThreatSummary;
  readonly farmBoost: FarmBoost;
  readonly boostTimer: BoostTimer;
  readonly money: MoneyCounter;
  readonly flock: FlockCounter;
  readonly shopButton: Button;

  constructor(
    scene: Phaser.Scene,
    onFarm: () => void,
    onFarmBreeding: () => void,
    onBreed: () => void,
    onShop: () => void,
  ) {
    // The bar is a square Panel whose outline runs off the left, right and bottom canvas edges, so
    // only its 2 px bark top rule shows (mockups/hud.html `.hud` border-top).
    new Panel(scene, { radius: 0, drop: false }).setBounds(
      -OUTLINE_PX,
      BAR_TOP,
      LAYOUT.canvasWidth + OUTLINE_PX * 2,
      LAYOUT.hudBarHeight + OUTLINE_PX,
    );
    // Before the Farm button and the widgets right of it, so its glow draws under them.
    const farm = COMPONENTS.buttonFarm;
    this.farmBoost = new FarmBoost(scene, FARM_X, FARM_Y, FARM_W, farm.height, RADIUS[farm.rounded]);
    this.farmButton = new Button(scene, COMPONENTS.buttonFarm, {
      x: FARM_X,
      y: FARM_Y,
      width: FARM_W,
      label: STRINGS.farmLabel,
      keyHint: STRINGS.farmKey,
      tooltip: STRINGS.farmTooltip,
      activateOn: 'press',
      onActivate: onFarm,
    });
    this.farmProgress = new FarmProgress(scene, FARM_X, METER_Y, TUNING.farmPipsPerFood);
    this.breedFoodButton = new Button(scene, COMPONENTS.buttonBreedFood, {
      x: BREED_FOOD_X,
      y: FARM_Y,
      width: BREED_FOOD_W,
      label: STRINGS.farmBreedingLabel,
      keyHint: STRINGS.farmBreedingKey,
      tooltip: STRINGS.farmBreedingTooltip,
      activateOn: 'press',
      onActivate: onFarmBreeding,
    });
    this.breedingProgress = new FarmProgress(
      scene,
      BREED_FOOD_X,
      METER_Y,
      TUNING.breedingPipsPerFood,
      COMPONENTS.breedingProgress,
      FRAME.pipBreeding,
    );
    // No key hint: the Breed tool has no shortcut (UX-DR72). Greyed until two adults are ready.
    this.breedButton = new Button(scene, COMPONENTS.buttonBreedTool, {
      x: BREED_X,
      y: FARM_Y,
      width: BREED_W,
      label: STRINGS.breedLabel,
      icon: FRAME.iconHeart,
      tooltip: STRINGS.breedTooltip,
      labelAlign: 'center',
      activateOn: 'press',
      onActivate: onBreed,
    });
    const midY = BAR_TOP + LAYOUT.hudBarHeight / 2;
    this.money = new MoneyCounter(scene, MONEY_X, midY);
    this.flock = new FlockCounter(scene, FLOCK_X, midY);
    this.threats = new ThreatSummary(scene, THREAT_X, midY);
    this.boostTimer = new BoostTimer(scene, BOOST_X, midY);
    // No key hint (UX-DR72 has no shop key) and no tooltip: its label says it all (Story 3.2 Open
    // Question 7). Opens and closes the panel; Esc also closes it.
    this.shopButton = new Button(scene, SHOP_SPEC, {
      x: SHOP_X,
      y: SHOP_Y,
      width: SHOP_W,
      label: STRINGS.shopLabel,
      labelAlign: 'center',
      activateOn: 'release',
      onActivate: onShop,
    });
  }
}
