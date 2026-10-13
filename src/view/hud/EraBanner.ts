import type Phaser from 'phaser';
import { CANVAS_WIDTH, COLORS, COMPONENTS, SPACING, TYPOGRAPHY } from '../../config/constants';
import { reducedMotion } from '../settings';
import { boxTexture, textStyle } from '../widgets/box';

const SPEC = COMPONENTS.eraBanner;
// The full-width `dusk` band (DESIGN: era-banner, "across the upper field"): display type (56 px × 1.1)
// with SPACING[3] above and below. [ASSUMPTION, browser-checked] Centred below the Pause button, the
// era badge and a full stack of three toasts (canvas y 16–152), so none of them covers it.
export const ERA_BANNER_H = Math.ceil(TYPOGRAPHY.display.fontSize * TYPOGRAPHY.display.lineHeight) + SPACING[3] * 2;
export const ERA_BANNER_CENTRE_Y = 204;
// [ASSUMPTION, tune in the browser] Slide in from the left, hold, fade out (UX-DR37). Under reduced motion
// it fades in over `slideMs` in place instead of sliding (UX-DR84).
export const ERA_BANNER_MOTION = Object.freeze({ slideMs: 300, holdMs: 2_000, fadeMs: 400 });

/**
 * The `era-banner` component (UX-DR37): a full-width `dusk` band with the new era's name in `halo`, or
 * "Back to {era}." in `wool-shade` on a regress. Built once and hidden; `play` slides it in (fades it in under
 * reduced motion), holds, then fades it out. Not interactive, so it never blocks a click, drag or drop under it.
 */
export class EraBanner {
  private readonly scene: Phaser.Scene;
  private readonly root: Phaser.GameObjects.Container;
  private readonly text: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, depth: number) {
    this.scene = scene;
    const key = boxTexture(scene, CANVAS_WIDTH, ERA_BANNER_H, {
      fill: SPEC.backgroundColor,
      border: SPEC.backgroundColor,
      radius: 0,
      drop: false,
    });
    const band = scene.add.image(0, -ERA_BANNER_H / 2, key).setOrigin(0, 0);
    this.text = scene.add
      .text(CANVAS_WIDTH / 2, 0, '', textStyle(SPEC.typography, SPEC.textColor))
      .setOrigin(0.5, 0.5);
    this.root = scene.add
      .container(0, ERA_BANNER_CENTRE_Y, [band, this.text])
      .setDepth(depth)
      .setVisible(false);
  }

  /** Shows `label` (halo, or wool-shade for a regress). A play during another restarts it cleanly. */
  play(label: string, regress: boolean): void {
    const tweens = this.scene.tweens;
    tweens.killTweensOf(this.root);
    this.text.setText(label).setColor(COLORS[regress ? SPEC.regressTextColor : SPEC.textColor]);
    if (reducedMotion()) {
      this.root.setPosition(0, ERA_BANNER_CENTRE_Y).setAlpha(0).setVisible(true);
      tweens.add({ targets: this.root, alpha: 1, duration: ERA_BANNER_MOTION.slideMs });
    } else {
      this.root.setPosition(-CANVAS_WIDTH, ERA_BANNER_CENTRE_Y).setAlpha(1).setVisible(true);
      tweens.add({
        targets: this.root,
        x: 0,
        duration: ERA_BANNER_MOTION.slideMs,
        ease: 'Cubic.easeOut',
      });
    }
    tweens.add({
      targets: this.root,
      alpha: 0,
      delay: ERA_BANNER_MOTION.slideMs + ERA_BANNER_MOTION.holdMs,
      duration: ERA_BANNER_MOTION.fadeMs,
      onComplete: () => this.root.setVisible(false),
    });
  }
}
