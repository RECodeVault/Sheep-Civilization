import type Phaser from 'phaser';
import { COMPONENTS, SPACING } from '../../config/constants';
import { invariant } from '../../core/invariant';
import { ATLAS, FRAME } from '../assetKeys';
import { STRINGS } from '../strings';
import { textStyle } from '../widgets/box';

const SPEC = COMPONENTS.flockCounter;
// Icon art is drawn at 1× (14×12) and shown at 2×, like the other HUD icons.
const ICON_SCALE = 2;
const ICON_W = 28;
const ICON_GAP = SPACING[1];
// The count's box fits "100/100" in `numeric` (Nunito 800): the largest flock at the largest land, so
// the slot never grows into the threat summary (UX-DR5). Left-aligned against its icon, like the money
// counter. [ASSUMPTION, browser-checked]
const BOX_W = 88;
/** The counter's width in canvas px, for the bar's layout. */
export const FLOCK_COUNTER_W = ICON_W + ICON_GAP + BOX_W;

/**
 * The `flock-counter` component (UX-DR35): a sheep icon and "{alive}/{capacity}" in `numeric` `bark`,
 * read-only (no press, no hover, no tooltip). `alive` is the living sheep; pending lambs hold a capacity
 * slot (AR21) but are not counted, so Breed can be greyed at "9/10". `set` builds the string and calls
 * setText only when either number changes. The crowded style (≥ 90 %, `alert`) is Story 4.6's.
 */
export class FlockCounter {
  private readonly text: Phaser.GameObjects.Text;
  private alive = Number.NaN;
  private capacity = Number.NaN;

  /** (x, centreY): the counter's left edge and vertical centre in canvas px. */
  constructor(scene: Phaser.Scene, x: number, centreY: number) {
    scene.add.image(x + ICON_W / 2, centreY, ATLAS.ui, FRAME.iconSheep).setScale(ICON_SCALE);
    this.text = scene.add
      .text(x + ICON_W + ICON_GAP, centreY, STRINGS.flockCount(100, 100), textStyle(SPEC.typography, SPEC.textColor))
      .setOrigin(0, 0.5);
    invariant(this.text.width <= BOX_W, 'FlockCounter: "100/100" does not fit its box');
  }

  /** Shows `alive` over `capacity`; no work unless one of them changed. */
  set(alive: number, capacity: number): void {
    if (alive === this.alive && capacity === this.capacity) return;
    this.alive = alive;
    this.capacity = capacity;
    this.text.setText(STRINGS.flockCount(alive, capacity));
  }
}
