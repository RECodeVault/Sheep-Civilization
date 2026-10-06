import Phaser from 'phaser';
import { LAYOUT } from '../../config/constants';
import { TUNING, type Rect } from '../../config/tuning';
import { ATLAS, FRAME } from '../assetKeys';
import { guarded } from '../safetyNet';

const COUNT = 3;
// Same 2× scale as SheepSprite (placeholder art is 32×26).
const SHEEP_SCALE = 2;
// Keeps a whole sheep on screen and clear of the panel it mills around.
const EDGE_PX = 48;
const PANEL_MARGIN_PX = 40;
// Tries per walk to find a spot outside the panel before settling for the last one.
const PICK_TRIES = 12;

/**
 * The title screen's decorative sheep (UX-DR12): three sprites walking between random spots in the
 * visible meadow around the title panel, resting between walks. Cosmetic view code only: tweens and
 * Math.random() are fine here because nothing touches GameState, and no sim runs on the title (only
 * GameScene steps the sim). Callbacks are guarded, since Phaser calls them from its step. The owning
 * scene kills the tweens on shutdown.
 */
export class TitleFlock {
  private readonly scene: Phaser.Scene;
  private readonly avoid: Rect;

  constructor(scene: Phaser.Scene, avoid: Rect) {
    this.scene = scene;
    this.avoid = avoid;
    for (let i = 0; i < COUNT; i++) {
      const p = this.pick();
      const sheep = scene.add.sprite(p.x, p.y, ATLAS.sheepWorld, FRAME.adultIdle).setScale(SHEEP_SCALE).setDepth(p.y);
      sheep.setFlipX(Math.random() < 0.5);
      this.rest(sheep);
    }
  }

  private rest(sheep: Phaser.GameObjects.Sprite): void {
    const ms = Phaser.Math.Between(TUNING.wanderRestMinMs, TUNING.wanderRestMaxMs);
    this.scene.time.delayedCall(ms, guarded(() => this.walk(sheep)));
  }

  private walk(sheep: Phaser.GameObjects.Sprite): void {
    const to = this.pick();
    const dist = Phaser.Math.Distance.Between(sheep.x, sheep.y, to.x, to.y);
    sheep.setFlipX(to.x < sheep.x);
    this.scene.tweens.add({
      targets: sheep,
      x: to.x,
      y: to.y,
      duration: (dist / TUNING.walkSpeedPxPerS) * 1000,
      ease: 'Linear',
      // Lower sheep draw in front, as on the field.
      onUpdate: guarded(() => sheep.setDepth(sheep.y)),
      onComplete: guarded(() => this.rest(sheep)),
    });
  }

  /** A random spot on the canvas (above nothing but the meadow) outside the avoided panel rect. */
  private pick(): { x: number; y: number } {
    const a = this.avoid;
    let x = 0;
    let y = 0;
    for (let i = 0; i < PICK_TRIES; i++) {
      x = Phaser.Math.Between(EDGE_PX, LAYOUT.canvasWidth - EDGE_PX);
      y = Phaser.Math.Between(EDGE_PX, LAYOUT.canvasHeight - EDGE_PX);
      const inside =
        x > a.x - PANEL_MARGIN_PX &&
        x < a.x + a.width + PANEL_MARGIN_PX &&
        y > a.y - PANEL_MARGIN_PX &&
        y < a.y + a.height + PANEL_MARGIN_PX;
      if (!inside) break;
    }
    return { x, y };
  }
}
