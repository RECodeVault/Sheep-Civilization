import Phaser from 'phaser';
import type { Carcass } from '../../sim/state';
import { ATLAS, FRAME } from '../assetKeys';
import type { PooledEntitySprite } from './EntityLayer';

// Placeholder art is about 32×22, shown at 2× like the sheep.
const CARCASS_SCALE = 2;
// UX-DR79 slapstick: the carcass starts a little higher, tipped onto its side, and falls flat with a
// bounce. Visual only; Story 5.7's reduced motion revisits it, so the values are named here.
const FLOP = { dropPx: 12, angle: -90, durationMs: 300 } as const;

/**
 * A carcass on the field (FR12, UX-DR59): X-eyes, legs up, no gore. Carcasses never move, so the
 * position is set once per binding; the only motion is the spawn flop. A carcass that exists when a
 * game is loaded flops in too, as food pieces bounce in (the dust puff follows the spawn event only).
 */
export class CarcassSprite extends Phaser.GameObjects.Sprite implements PooledEntitySprite<Carcass> {
  private fresh = true;

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0, ATLAS.sheepWorld, FRAME.carcass);
    this.setScale(CARCASS_SCALE);
    scene.add.existing(this);
    this.reset();
  }

  bind(_id: number): void {
    this.fresh = true;
    this.setActive(true).setVisible(true);
  }

  sync(c: Carcass): void {
    if (!this.fresh) return;
    this.fresh = false;
    // Same y-depth rule as sheep and pieces, at its resting spot.
    this.setDepth(c.y);
    this.setPosition(c.x, c.y - FLOP.dropPx).setAngle(FLOP.angle);
    this.scene.tweens.add({ targets: this, y: c.y, angle: 0, duration: FLOP.durationMs, ease: 'Bounce.easeOut' });
  }

  playExit(): void {
    this.reset();
  }

  reset(): void {
    this.scene.tweens.killTweensOf(this);
    this.fresh = true;
    this.setAngle(0);
    this.setActive(false).setVisible(false);
  }
}
