import type Phaser from 'phaser';
import { COMPONENTS, RADIUS } from '../../config/constants';
import { ATLAS, FRAME } from '../assetKeys';
import { STRINGS } from '../strings';
import { boxTexture, textStyle } from '../widgets/box';

const SPEC = COMPONENTS.foodMeter;
// mockups/hud.html `.pips` / `.pip` / `.num`: 7×14 pips, 2 px gaps, 3 px track padding, an 8 px gap,
// then the value right-aligned in a fixed-width box so non-tabular digits do not jitter (UX-DR5).
const PIP_W = 7;
const PIP_H = 14;
const PIP_GAP = 2;
const TRACK_PAD = 3;
const VALUE_GAP = 8;
const VALUE_BOX_W = 62;
// Small "nothing happened" bump when farming at the cap (UX-DR26). Visual only.
const BUMP = { scale: 1.08, durationMs: 120 } as const;

export const FOOD_METER_TRACK_W = SPEC.segmentCount * PIP_W + (SPEC.segmentCount - 1) * PIP_GAP + TRACK_PAD * 2;
export const FOOD_METER_H = PIP_H + TRACK_PAD * 2;
export const FOOD_METER_W = FOOD_METER_TRACK_W + VALUE_GAP + VALUE_BOX_W;

/**
 * The `food-meter` component (UX-DR29): discrete hay pips on a wool-shade track plus "{n}/{cap}".
 * `set` does work only when a value changes, so calling it every frame costs nothing.
 * Story 1.7 adds the empty-spend shake and alert flash.
 */
export class FoodMeter {
  private readonly scene: Phaser.Scene;
  private readonly root: Phaser.GameObjects.Container;
  private readonly pips: Phaser.GameObjects.Image[] = [];
  private readonly value: Phaser.GameObjects.Text;
  private shownFood = NaN;
  private shownCap = NaN;

  /** (x, y) is the top-left of the track in canvas px. */
  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.scene = scene;
    // Anchored at the meter's centre so the bump grows evenly.
    const cx = FOOD_METER_W / 2;
    const cy = FOOD_METER_H / 2;
    this.root = scene.add.container(x + cx, y + cy);

    // The track is a borderless box: border and fill share the track colour.
    const trackKey = boxTexture(scene, FOOD_METER_TRACK_W, FOOD_METER_H, {
      fill: SPEC.trackColor,
      border: SPEC.trackColor,
      radius: RADIUS.sm,
      drop: false,
    });
    this.root.add(scene.add.image(-cx, -cy, trackKey).setOrigin(0, 0));

    for (let i = 0; i < SPEC.segmentCount; i++) {
      const pip = scene.add
        .image(-cx + TRACK_PAD + i * (PIP_W + PIP_GAP), -cy + TRACK_PAD, ATLAS.ui, FRAME.pipEmpty)
        .setOrigin(0, 0);
      this.pips.push(pip);
      this.root.add(pip);
    }

    this.value = scene.add
      .text(-cx + FOOD_METER_W, 0, '', textStyle(SPEC.valueTypography, 'bark'))
      .setOrigin(1, 0.5);
    this.root.add(this.value);
  }

  /** Shows `food` of `cap`. Food above the cap (old save, debug) fills every pip and shows the number. */
  set(food: number, cap: number): void {
    if (food === this.shownFood && cap === this.shownCap) return;
    this.shownFood = food;
    this.shownCap = cap;
    const n = this.pips.length;
    const filled = cap > 0 ? Math.max(0, Math.min(n, Math.floor((food / cap) * n))) : 0;
    // updateSize/updateOrigin false: the atlas frames carry a 0.5 pivot, which would otherwise reset
    // the pips' top-left origin on every swap.
    for (let i = 0; i < n; i++) this.pips[i].setFrame(i < filled ? FRAME.pipFood : FRAME.pipEmpty, false, false);
    this.value.setText(STRINGS.meterValue(food, cap));
  }

  bump(): void {
    const tweens = this.scene.tweens;
    tweens.killTweensOf(this.root);
    this.root.setScale(1);
    tweens.add({ targets: this.root, scale: BUMP.scale, duration: BUMP.durationMs, yoyo: true, ease: 'Quad.easeOut' });
  }
}
