import Phaser from 'phaser';
import type { FoodPiece } from '../../sim/state';
import { ATLAS, FRAME } from '../assetKeys';
import type { PooledEntitySprite } from './EntityLayer';

// Placeholder art is 8×6, shown at 2× like the sheep.
const FOOD_SCALE = 2;
// UX-DR78: the piece drops a little and bounces as it lands. Visual only. Story 5.7's reduced motion
// turns this off; keep both values here.
const BOUNCE_DROP_PX = 16;
const BOUNCE_MS = 350;

/**
 * A food piece on the field. Pieces never move, so the position is set once per binding; the only
 * motion is the landing bounce. Pieces that exist when a game is loaded bounce in as well.
 */
export class FoodSprite extends Phaser.GameObjects.Sprite implements PooledEntitySprite<FoodPiece> {
  private fresh = true;

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0, ATLAS.sheepWorld, FRAME.foodPiece);
    this.setScale(FOOD_SCALE);
    scene.add.existing(this);
    this.reset();
  }

  bind(_id: number): void {
    this.fresh = true;
    this.setActive(true).setVisible(true);
  }

  sync(piece: FoodPiece): void {
    if (!this.fresh) return;
    this.fresh = false;
    // Same y-depth rule as sheep and the front fence rails, at the landing spot.
    this.setDepth(piece.y);
    this.setPosition(piece.x, piece.y - BOUNCE_DROP_PX);
    this.scene.tweens.add({ targets: this, y: piece.y, duration: BOUNCE_MS, ease: 'Bounce.easeOut' });
  }

  playExit(): void {
    this.reset();
  }

  reset(): void {
    this.scene.tweens.killTweensOf(this);
    this.fresh = true;
    this.setActive(false).setVisible(false);
  }
}
