import type Phaser from 'phaser';
import { COLORS, COMPONENTS, SPACING } from '../../config/constants';
import { TUNING } from '../../config/tuning';
import { invariant } from '../../core/invariant';
import { ATLAS, FRAME } from '../assetKeys';
import { STRINGS } from '../strings';
import { textStyle } from '../widgets/box';

const SPEC = COMPONENTS.flockCounter;
// Icon art is drawn at 1× (14×12) and shown at 2×, like the other HUD icons.
const ICON_SCALE = 2;
const ICON_W = 28;
const ICON_GAP = SPACING[1];
// The count's box fits the largest flock at the largest land ("100/100" in `numeric`, Nunito 800), so the
// slot never grows into the threat summary (UX-DR5). Left-aligned against its icon, like the money
// counter. [ASSUMPTION, browser-checked]
const BOX_W = 88;
// The widest count the box must hold: full at the largest capacity, read from the land table so a 3.6
// retune is measured too.
const MAX_CAPACITY = TUNING.landCapacities[TUNING.landCapacities.length - 1];
/** The counter's width in canvas px, for the bar's layout. */
export const FLOCK_COUNTER_W = ICON_W + ICON_GAP + BOX_W;

/**
 * The `flock-counter` component (UX-DR35): a sheep icon and "{alive}/{capacity}" in `numeric` `bark`,
 * read-only (no press, no hover, no tooltip). `alive` is the living sheep; pending lambs hold a capacity
 * slot (AR21) but are not counted, so Breed can be greyed at "9/10". `set` builds the string and calls
 * setText only when either number changes. While crowded (≥ 90 %, HudView.crowded, the overcrowding
 * rule's own test; Story 4.6) the numbers turn `crowdedColor` (`alert`) and the crowd icon takes the
 * sheep icon's place: colour and shape together, and no wider (the bar has 12 px to spare).
 */
export class FlockCounter {
  private readonly icon: Phaser.GameObjects.Image;
  private readonly text: Phaser.GameObjects.Text;
  private alive = Number.NaN;
  private capacity = Number.NaN;
  private crowded = false;

  /** (x, centreY): the counter's left edge and vertical centre in canvas px. */
  constructor(scene: Phaser.Scene, x: number, centreY: number) {
    this.icon = scene.add.image(x + ICON_W / 2, centreY, ATLAS.ui, FRAME.iconSheep).setScale(ICON_SCALE);
    this.text = scene.add
      .text(
        x + ICON_W + ICON_GAP,
        centreY,
        STRINGS.flockCount(MAX_CAPACITY, MAX_CAPACITY),
        textStyle(SPEC.typography, SPEC.textColor),
      )
      .setOrigin(0, 0.5);
    invariant(this.text.width <= BOX_W, 'FlockCounter: a full flock at the largest capacity does not fit its box');
  }

  /** Shows `alive` over `capacity`, in the crowded style while `crowded`; no work unless something changed. */
  set(alive: number, capacity: number, crowded: boolean): void {
    if (crowded !== this.crowded) {
      this.crowded = crowded;
      this.text.setColor(COLORS[crowded ? SPEC.crowdedColor : SPEC.textColor]);
      this.icon.setFrame(crowded ? FRAME.iconCrowd : FRAME.iconSheep);
    }
    if (alive === this.alive && capacity === this.capacity) return;
    this.alive = alive;
    this.capacity = capacity;
    this.text.setText(STRINGS.flockCount(alive, capacity));
  }
}
