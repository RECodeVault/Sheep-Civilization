import type Phaser from 'phaser';
import { COMPONENTS, SPACING } from '../../config/constants';
import { TUNING } from '../../config/tuning';
import { formatGameTime } from '../../core/format';
import { invariant } from '../../core/invariant';
import { STRINGS } from '../strings';
import { reducedMotion } from '../settings';
import { boxTexture, textStyle } from '../widgets/box';

const SPEC = COMPONENTS.boostTimer;
// mockups/hud.html `.boost-timer`: a 40 px pill with 12 px side padding. Fixed width, so the pill
// never resizes as the seconds change: wide enough for "×2 0:30" in numeric type. [ASSUMPTION,
// browser-checked]
export const BOOST_TIMER_W = 104;
export const BOOST_TIMER_H = 40;
const PAD_X = SPACING[3];
const MS_PER_SECOND = 1000;
// A reset (or a start) pops the pill (EXPERIENCE: Boost timer). Juice: none under reduced motion (Story 5.7).
export const BOOST_TIMER_MOTION = Object.freeze({ popScale: 1.2, popMs: 80 });

/**
 * The `boost-timer` component (UX-DR38): a `void` pill reading "×2 0:{ss}" in `halo` while a sacrifice
 * boost runs, hidden otherwise. It counts whole seconds rounded up, so it starts at 0:30 and hides at 0
 * rather than showing 0:00. `set` changes the text only when the shown second changes.
 */
export class BoostTimer {
  private readonly scene: Phaser.Scene;
  private readonly root: Phaser.GameObjects.Container;
  private readonly text: Phaser.GameObjects.Text;
  private shownSecs = -1;

  /** (x, centreY): the pill's left edge and vertical centre in canvas px. */
  constructor(scene: Phaser.Scene, x: number, centreY: number) {
    this.scene = scene;
    const key = boxTexture(scene, BOOST_TIMER_W, BOOST_TIMER_H, {
      fill: SPEC.backgroundColor,
      border: SPEC.backgroundColor,
      radius: BOOST_TIMER_H / 2,
      drop: false,
    });
    // The texture carries DROP_PX of empty space right and below: anchor on the box, not the texture.
    const pill = scene.add.image(-BOOST_TIMER_W / 2, -BOOST_TIMER_H / 2, key).setOrigin(0, 0);
    this.text = scene.add.text(0, 0, STRINGS.boostTimer(formatGameTime(TUNING.boostMs)), textStyle(SPEC.typography, SPEC.textColor)).setOrigin(0.5, 0.5);
    invariant(this.text.width + PAD_X * 2 <= BOOST_TIMER_W, 'BoostTimer: "×2 0:30" does not fit the pill');
    this.root = scene.add.container(x + BOOST_TIMER_W / 2, centreY, [pill, this.text]).setVisible(false);
  }

  /** Shows the time left (hidden at 0). Does work only when the shown second changes. */
  set(remainingMs: number): void {
    const secs = remainingMs > 0 ? Math.ceil(remainingMs / MS_PER_SECOND) : 0;
    if (secs === this.shownSecs) return;
    this.shownSecs = secs;
    this.root.setVisible(secs > 0);
    if (secs > 0) this.text.setText(STRINGS.boostTimer(formatGameTime(secs * MS_PER_SECOND)));
  }

  /** A quick scale pop from the middle (a boost started or reset). Restarts cleanly. */
  pop(): void {
    const tweens = this.scene.tweens;
    tweens.killTweensOf(this.root);
    this.root.setScale(1);
    if (reducedMotion()) return;
    tweens.add({
      targets: this.root,
      scale: BOOST_TIMER_MOTION.popScale,
      duration: BOOST_TIMER_MOTION.popMs,
      yoyo: true,
      ease: 'Quad.easeOut',
    });
  }
}
