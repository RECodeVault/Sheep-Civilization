import type Phaser from 'phaser';
import { COMPONENTS, RADIUS } from '../../config/constants';
import { ATLAS, FRAME } from '../assetKeys';
import { STRINGS } from '../strings';
import { boxTexture, textStyle } from '../widgets/box';

const SPEC = COMPONENTS.farmProgress;
// 8 pips, then the count "{n}/8" (Rylan, 2026-10-06), under the 232 px Farm button. The 7×14 pip
// frames are solid colour, so showing them wider keeps them crisp.
const PIP_W = 14;
const PIP_H = 14;
const PIP_GAP = 2;
const TRACK_PAD = 3;
const COUNT_GAP = 4;
// The count right-aligned in a fixed-width box, so non-tabular digits do not jitter (UX-DR5).
const COUNT_BOX_W = 40;

const TRACK_W = SPEC.segmentCount * PIP_W + (SPEC.segmentCount - 1) * PIP_GAP + TRACK_PAD * 2;
export const FARM_PROGRESS_W = TRACK_W + COUNT_GAP + COUNT_BOX_W;
export const FARM_PROGRESS_H = PIP_H + TRACK_PAD * 2;

/**
 * The `farm-progress` component (UX-DR29, FR3): the pips of the current Farm bar on a wool-shade
 * track, and its count "{n}/8". A full bar is 1 food. `set` does work only when a value changes.
 */
export class FarmProgress {
  private readonly pips: Phaser.GameObjects.Image[] = [];
  private readonly count: Phaser.GameObjects.Text;
  private shownProgress = NaN;
  private shownPerFood = NaN;

  /** (x, y) is the top-left of the track in canvas px. */
  constructor(scene: Phaser.Scene, x: number, y: number) {
    // The track is a borderless box: border and fill share the track colour.
    const trackKey = boxTexture(scene, TRACK_W, FARM_PROGRESS_H, {
      fill: SPEC.trackColor,
      border: SPEC.trackColor,
      radius: RADIUS.sm,
      drop: false,
    });
    scene.add.image(x, y, trackKey).setOrigin(0, 0);
    for (let i = 0; i < SPEC.segmentCount; i++) {
      const pip = scene.add
        .image(x + TRACK_PAD + i * (PIP_W + PIP_GAP), y + TRACK_PAD, ATLAS.ui, FRAME.pipEmpty)
        .setOrigin(0, 0)
        .setDisplaySize(PIP_W, PIP_H);
      this.pips.push(pip);
    }
    this.count = scene.add
      .text(x + FARM_PROGRESS_W, y + FARM_PROGRESS_H / 2, '', textStyle(SPEC.valueTypography, 'bark'))
      .setOrigin(1, 0.5);
  }

  /** Shows `progress` of `perFood` pips, scaled onto the drawn pips if the tuning differs from 8. */
  set(progress: number, perFood: number): void {
    if (progress === this.shownProgress && perFood === this.shownPerFood) return;
    this.shownProgress = progress;
    this.shownPerFood = perFood;
    const n = this.pips.length;
    const filled = perFood > 0 ? Math.max(0, Math.min(n, Math.floor((progress / perFood) * n))) : 0;
    // updateSize/updateOrigin false: the atlas frames carry a 0.5 pivot, which would otherwise reset
    // the top-left origin (and the display size) on every swap.
    for (let i = 0; i < n; i++) this.pips[i].setFrame(i < filled ? FRAME.pipFood : FRAME.pipEmpty, false, false);
    this.count.setText(STRINGS.meterValue(progress, perFood));
  }
}
