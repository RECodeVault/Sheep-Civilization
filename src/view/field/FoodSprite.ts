import Phaser from 'phaser';
import type { BreedingPiece, FoodPiece } from '../../sim/state';
import { ATLAS, FRAME } from '../assetKeys';
import type { PooledEntitySprite } from './EntityLayer';
import { reducedMotion } from '../settings';

// Placeholder art is 8×6 (food) or 8×7 (breeding), shown at 2× like the sheep.
const FOOD_SCALE = 2;
// UX-DR78: the piece drops a little and bounces as it lands. Visual only. Under reduced motion it lands
// at once (Story 5.7).
const BOUNCE_DROP_PX = 16;
const BOUNCE_MS = 350;

/**
 * A food piece on the field, or a breeding piece (FR8) when built with `FRAME.breedingPiece`. Pieces
 * never move, so the position is set once per binding; the only motion is the landing bounce. Pieces
 * that exist when a game is loaded bounce in as well.
 */
export class FoodSprite extends Phaser.GameObjects.Sprite implements PooledEntitySprite<FoodPiece | BreedingPiece> {
  private fresh = true;

  constructor(scene: Phaser.Scene, frame: string = FRAME.foodPiece) {
    super(scene, 0, 0, ATLAS.sheepWorld, frame);
    this.setScale(FOOD_SCALE);
    scene.add.existing(this);
    this.reset();
  }

  bind(_id: number): void {
    this.fresh = true;
    this.setActive(true).setVisible(true);
  }

  sync(piece: FoodPiece | BreedingPiece): void {
    if (!this.fresh) return;
    this.fresh = false;
    // Same y-depth rule as sheep and the front fence rails, at the landing spot.
    this.setDepth(piece.y);
    if (reducedMotion()) {
      this.setPosition(piece.x, piece.y);
      return;
    }
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
