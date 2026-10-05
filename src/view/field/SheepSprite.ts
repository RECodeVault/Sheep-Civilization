import Phaser from 'phaser';
import type { PublicSheep } from '../../sim/selectors';
import { ATLAS, FRAME } from '../assetKeys';
import type { PooledEntitySprite } from './EntityLayer';

// Placeholder art is 32×26, shown at 2× (about 64×52 on the 1280×720 canvas, as in the mockup).
const SHEEP_SCALE = 2;

export class SheepSprite extends Phaser.GameObjects.Sprite implements PooledEntitySprite<PublicSheep> {
  private boundId = 0;

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0, ATLAS.sheepWorld, FRAME.adultIdle);
    this.setScale(SHEEP_SCALE);
    scene.add.existing(this);
    this.reset();
  }

  get id(): number {
    return this.boundId;
  }

  bind(id: number): void {
    this.boundId = id;
    this.setActive(true).setVisible(true);
  }

  // Story 1.3 adds interpolation between the previous and current tick positions (alpha).
  sync(pub: PublicSheep, _alpha: number): void {
    if (this.x !== pub.x || this.y !== pub.y) {
      this.setPosition(pub.x, pub.y);
      // Lower sheep draw in front.
      this.setDepth(pub.y);
    }
  }

  playExit(): void {
    this.reset();
  }

  reset(): void {
    this.boundId = 0;
    this.setActive(false).setVisible(false);
  }
}
