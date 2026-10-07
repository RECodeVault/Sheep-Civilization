import type Phaser from 'phaser';
import { COMPONENTS, LAYOUT, SPACING } from '../../config/constants';
import { STRINGS } from '../strings';
import { Button } from '../widgets/Button';
import { OUTLINE_PX } from '../widgets/box';
import { Panel } from '../widgets/Panel';
import { FRAME } from '../assetKeys';
import { FARM_PROGRESS_W, FarmProgress } from './FarmProgress';

// Bar layout in canvas px (DESIGN.md Layout & Spacing; UX-DR25, UX-DR101). The mockup centres the
// Farm group in the 112 px bar, which would put the meter inside the 16 px safe margin; the spec wins,
// so the group sits higher and ends at or above canvasHeight - safeMargin.
const BAR_TOP = LAYOUT.canvasHeight - LAYOUT.hudBarHeight;
const FARM_X = LAYOUT.safeMargin;
const FARM_Y = BAR_TOP + 6;
const FARM_W = 232; // mockups/hud.html `.btn-farm`
const METER_GAP = 4;
const METER_Y = FARM_Y + COMPONENTS.buttonFarm.height + METER_GAP;
// Groups (a button with its meter) are SPACING[3] apart; the mockup's `.hud` gap is 10 px, the
// nearest spacing token is 12.
const GROUP_GAP = SPACING[3];
// Farm Breeding Food: right of the Farm group. The mockup's `.btn-breedfood` is 190 px, but in the
// canvas font "Farm Breeding" then runs into the key hint, so it is 200 (browser-checked).
const BREED_FOOD_X = FARM_X + Math.max(FARM_W, FARM_PROGRESS_W) + GROUP_GAP;
const BREED_FOOD_W = 200;
// The Breed tool (UX-DR31): right of the Farm Breeding Food group, 104 px wide (mockups/hud.html
// `.btn-breed`), centred in the bar like the mockup (`.hud` align-items: center).
const BREED_X = BREED_FOOD_X + Math.max(BREED_FOOD_W, FARM_PROGRESS_W) + GROUP_GAP;
const BREED_W = 104;
const BREED_Y = BAR_TOP + (LAYOUT.hudBarHeight - COMPONENTS.buttonBreedTool.height) / 2;

/**
 * The HUD bottom bar: a full-width wool surface with actions on the left (UX-DR25). Story 1.6 builds
 * the Farm button with the Farm progress bar and its count beneath it (1.7), 2.2 the Farm Breeding
 * Food button with the breeding bar, 2.3 the Breed tool; later stories add their widgets to the right.
 */
export class BottomBar {
  readonly farmButton: Button;
  readonly farmProgress: FarmProgress;
  readonly breedFoodButton: Button;
  readonly breedingProgress: FarmProgress;
  readonly breedButton: Button;

  constructor(scene: Phaser.Scene, onFarm: () => void, onFarmBreeding: () => void, onBreed: () => void) {
    // The bar is a square Panel whose outline runs off the left, right and bottom canvas edges, so
    // only its 2 px bark top rule shows (mockups/hud.html `.hud` border-top).
    new Panel(scene, { radius: 0, drop: false }).setBounds(
      -OUTLINE_PX,
      BAR_TOP,
      LAYOUT.canvasWidth + OUTLINE_PX * 2,
      LAYOUT.hudBarHeight + OUTLINE_PX,
    );
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
    this.farmProgress = new FarmProgress(scene, FARM_X, METER_Y);
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
    this.breedingProgress = new FarmProgress(scene, BREED_FOOD_X, METER_Y, COMPONENTS.breedingProgress, FRAME.pipBreeding);
    // No key hint: the Breed tool has no shortcut (UX-DR72). Greyed until two adults are ready.
    this.breedButton = new Button(scene, COMPONENTS.buttonBreedTool, {
      x: BREED_X,
      y: BREED_Y,
      width: BREED_W,
      label: STRINGS.breedLabel,
      icon: FRAME.iconHeart,
      tooltip: STRINGS.breedTooltip,
      labelAlign: 'center',
      activateOn: 'press',
      onActivate: onBreed,
    });
  }
}
