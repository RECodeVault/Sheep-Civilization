import Phaser from 'phaser';
import type { PublicPregnancy } from '../../sim/selectors';
import { ATLAS, FRAME } from '../assetKeys';
import type { PooledEntitySprite } from './EntityLayer';
import { FIELD_DEPTH } from './depths';

// Shown at 2× like the field art, floating this far above the point between the parents' centres
// (about a sheep's half-height plus the heart).
const SCALE = 2;
const LIFT_PX = 30;
// UX-DR82 juice: the heart pops in on breeding, then bobs until the lamb arrives. Visual only; Story
// 5.7's reduced motion revisits these.
const POP_MS = 200;
const BOB = { px: 4, durationMs: 500 } as const;

/**
 * The heart that floats between a breeding pair until their lamb is born (UX-DR56). Follows the
 * selector's spot (the parents' midpoint while they live) each frame; never holds game data.
 */
export class PregnancyHeart extends Phaser.GameObjects.Image implements PooledEntitySprite<PublicPregnancy> {
  private fresh = true;
  private readonly bob = { y: 0 };

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0, ATLAS.sheepWorld, FRAME.breedHeart);
    this.setOrigin(0.5, 1).setDepth(FIELD_DEPTH.overlay);
    scene.add.existing(this);
    this.reset();
  }

  bind(_id: number): void {
    this.fresh = true;
    this.setActive(true).setVisible(true);
  }

  sync(item: PublicPregnancy): void {
    if (this.fresh) {
      this.fresh = false;
      const tweens = this.scene.tweens;
      this.setScale(0);
      tweens.add({ targets: this, scale: SCALE, duration: POP_MS, ease: 'Back.easeOut' });
      tweens.add({ targets: this.bob, y: -BOB.px, duration: BOB.durationMs, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
    // The parents walk and the heart bobs, so this changes most frames; only a few pairs ever exist.
    const x = item.x;
    const y = item.y - LIFT_PX + this.bob.y;
    if (this.x !== x || this.y !== y) this.setPosition(x, y);
  }

  playExit(): void {
    this.reset();
  }

  reset(): void {
    this.scene.tweens.killTweensOf(this);
    this.scene.tweens.killTweensOf(this.bob);
    this.bob.y = 0;
    this.fresh = true;
    this.setScale(SCALE);
    this.setActive(false).setVisible(false);
  }
}
