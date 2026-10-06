import type Phaser from 'phaser';
import { COMPONENTS, RADIUS } from '../../config/constants';
import { ATLAS, FRAME } from '../assetKeys';
import { STRINGS } from '../strings';
import { boxTexture, textStyle } from '../widgets/box';

/** The DESIGN.md spec of a pip bar: `farm-progress` (hay) or `breeding-progress` (heart). */
type ProgressSpec = typeof COMPONENTS.farmProgress | typeof COMPONENTS.breedingProgress;

// 8 pips, then the count "{n}/8" (Rylan, 2026-10-06), under the 232 px Farm button. The 7×14 pip
// frames are solid colour, so showing them wider keeps them crisp.
const PIP_W = 14;
const PIP_H = 14;
const PIP_GAP = 2;
const TRACK_PAD = 3;
const COUNT_GAP = 4;
// The count right-aligned in a fixed-width box, so non-tabular digits do not jitter (UX-DR5).
const COUNT_BOX_W = 40;

function trackWidth(segments: number): number {
  return segments * PIP_W + (segments - 1) * PIP_GAP + TRACK_PAD * 2;
}

export const FARM_PROGRESS_W = trackWidth(COMPONENTS.farmProgress.segmentCount) + COUNT_GAP + COUNT_BOX_W;
export const FARM_PROGRESS_H = PIP_H + TRACK_PAD * 2;

/**
 * The `farm-progress` component (UX-DR29, FR3): the pips of the current Farm bar on a wool-shade
 * track, and its count "{n}/8". A full bar is 1 food. The breeding bar (`breeding-progress`, UX-DR30,
 * FR8) is the same widget with heart pips. `set` does work only when a value changes.
 */
export class FarmProgress {
  private readonly pips: Phaser.GameObjects.Image[] = [];
  private readonly count: Phaser.GameObjects.Text;
  private shownProgress = NaN;
  private shownPerFood = NaN;
  private readonly fillFrame: string;

  /**
   * (x, y) is the top-left of the track in canvas px. `spec` is the component spec, and `fillFrame` the
   * filled pip in its fill colour (the atlas pips are solid colour, so the colour lives in the art).
   */
  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    spec: ProgressSpec = COMPONENTS.farmProgress,
    fillFrame: string = FRAME.pipFood,
  ) {
    this.fillFrame = fillFrame;
    const trackW = trackWidth(spec.segmentCount);
    // The track is a borderless box: border and fill share the track colour.
    const trackKey = boxTexture(scene, trackW, FARM_PROGRESS_H, {
      fill: spec.trackColor,
      border: spec.trackColor,
      radius: RADIUS.sm,
      drop: false,
    });
    scene.add.image(x, y, trackKey).setOrigin(0, 0);
    for (let i = 0; i < spec.segmentCount; i++) {
      const pip = scene.add
        .image(x + TRACK_PAD + i * (PIP_W + PIP_GAP), y + TRACK_PAD, ATLAS.ui, FRAME.pipEmpty)
        .setOrigin(0, 0)
        .setDisplaySize(PIP_W, PIP_H);
      this.pips.push(pip);
    }
    this.count = scene.add
      .text(x + trackW + COUNT_GAP + COUNT_BOX_W, y + FARM_PROGRESS_H / 2, '', textStyle(spec.valueTypography, 'bark'))
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
    for (let i = 0; i < n; i++) this.pips[i].setFrame(i < filled ? this.fillFrame : FRAME.pipEmpty, false, false);
    this.count.setText(STRINGS.meterValue(progress, perFood));
  }
}
