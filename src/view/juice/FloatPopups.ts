import type Phaser from 'phaser';
import { COLORS, COMPONENTS } from '../../config/constants';
import { reducedMotion } from '../settings';
import { textStyle } from '../widgets/box';

const SPEC = COMPONENTS.floatPopup;
const POOL_SIZE = 8;
const STROKE_PX = 4;
// UX-DR44 [ASSUMPTION]: rises about 24 px and fades over 600 ms. Under reduced motion it fades in place
// (no rise; UX-DR84).
const RISE_PX = 24;
const DURATION_MS = 600;

/**
 * The `float-popup` component ("+1", "+2", "$10"): wool text with a bark outline that rises and
 * fades. A fixed pool built once; spawning reuses the oldest text, so nothing is created or
 * destroyed during play. Tweens are visual only.
 */
export class FloatPopups {
  private readonly scene: Phaser.Scene;
  private readonly pool: Phaser.GameObjects.Text[] = [];
  private next = 0;

  constructor(scene: Phaser.Scene, depth: number) {
    this.scene = scene;
    const style = { ...textStyle(SPEC.typography, SPEC.textColor), stroke: COLORS[SPEC.outlineColor], strokeThickness: STROKE_PX };
    for (let i = 0; i < POOL_SIZE; i++) {
      this.pool.push(scene.add.text(0, 0, '', style).setOrigin(0.5, 1).setDepth(depth).setVisible(false));
    }
  }

  /** Shows `text` with its bottom centre at (x, y), then rises and fades. */
  spawn(x: number, y: number, text: string): void {
    const t = this.pool[this.next];
    this.next = (this.next + 1) % this.pool.length;
    const tweens = this.scene.tweens;
    tweens.killTweensOf(t);
    t.setText(text).setPosition(x, y).setAlpha(1).setVisible(true);
    tweens.add({
      targets: t,
      y: reducedMotion() ? y : y - RISE_PX,
      alpha: 0,
      duration: DURATION_MS,
      ease: 'Quad.easeOut',
      onComplete: () => t.setVisible(false),
    });
  }
}
