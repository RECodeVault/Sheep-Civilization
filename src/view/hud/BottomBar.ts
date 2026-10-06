import type Phaser from 'phaser';
import { COMPONENTS, LAYOUT } from '../../config/constants';
import { TUNING } from '../../config/tuning';
import { STRINGS } from '../strings';
import { Button } from '../widgets/Button';
import { OUTLINE_PX } from '../widgets/box';
import { Panel } from '../widgets/Panel';
import { FoodMeter } from './FoodMeter';

// Bar layout in canvas px (DESIGN.md Layout & Spacing; UX-DR25, UX-DR101). The mockup centres the
// Farm group in the 112 px bar, which would put the meter inside the 16 px safe margin; the spec wins,
// so the group sits higher and ends at or above canvasHeight - safeMargin.
const BAR_TOP = LAYOUT.canvasHeight - LAYOUT.hudBarHeight;
const FARM_X = LAYOUT.safeMargin;
const FARM_Y = BAR_TOP + 6;
const FARM_W = 232; // mockups/hud.html `.btn-farm`
const METER_GAP = 4;
const METER_Y = FARM_Y + COMPONENTS.buttonFarm.height + METER_GAP;

/**
 * The HUD bottom bar: a full-width wool surface with actions on the left (UX-DR25). Story 1.6 builds
 * the Farm button and food meter; later stories add their widgets to the right.
 */
export class BottomBar {
  readonly farmButton: Button;
  readonly foodMeter: FoodMeter;

  constructor(scene: Phaser.Scene, onFarm: () => void) {
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
      tooltip: STRINGS.farmTooltip(TUNING.farmFoodPerClick),
      activateOn: 'press',
      onActivate: onFarm,
    });
    this.foodMeter = new FoodMeter(scene, FARM_X, METER_Y);
  }
}
