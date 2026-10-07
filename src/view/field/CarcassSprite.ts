import Phaser from 'phaser';
import type { Carcass } from '../../sim/state';
import { ATLAS, FRAME } from '../assetKeys';
import { AlertPing } from './AlertPing';
import type { PooledEntitySprite } from './EntityLayer';

// Placeholder art is about 32×22, shown at 2× like the sheep.
const CARCASS_SCALE = 2;
// UX-DR79 slapstick: the carcass starts a little higher, tipped onto its side, and falls flat with a
// bounce. Visual only; Story 5.7's reduced motion revisits it, so the values are named here.
const FLOP = { dropPx: 12, angle: -90, durationMs: 300 } as const;
// The ping's bottom sits this far above the carcass's top edge.
const PING_GAP_PX = 2;

/**
 * A carcass on the field (FR12, UX-DR59): X-eyes, legs up, no gore. Carcasses never move, so the
 * position is set once per binding; the only motion is the spawn flop. A carcass that exists when a
 * game is loaded flops in too, as food pieces bounce in (the dust puff follows the spawn event only).
 * Every carcass is a threat until it is cleared or eaten, so each one pops an alert ping when it
 * appears (UX-DR54), and the ping leaves with the sprite.
 */
export class CarcassSprite extends Phaser.GameObjects.Sprite implements PooledEntitySprite<Carcass> {
  private fresh = true;
  private readonly ping: AlertPing;
  // Where the ping sits: above the resting carcass, not its flop, so it does not bounce with it.
  private pingX = 0;
  private pingY = 0;
  /** state.time at the last sync, for a ping popped when the flop lands (between syncs). */
  private lastSimTime = 0;

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0, ATLAS.sheepWorld, FRAME.carcass);
    this.setScale(CARCASS_SCALE);
    scene.add.existing(this);
    this.ping = new AlertPing(scene);
    this.reset();
  }

  bind(_id: number): void {
    this.fresh = true;
    this.setActive(true).setVisible(true);
  }

  sync(c: Carcass, _alpha: number, simTime: number): void {
    this.lastSimTime = simTime;
    if (!this.fresh) {
      // The bob and the settle advance; the anchor never moves. A no-op until the flop lands.
      this.ping.place(this.pingX, this.pingY, simTime);
      return;
    }
    this.fresh = false;
    this.pingX = c.x;
    this.pingY = c.y - this.displayHeight / 2 - PING_GAP_PX;
    // Same y-depth rule as sheep and pieces, at its resting spot.
    this.setDepth(c.y);
    this.setPosition(c.x, c.y - FLOP.dropPx).setAngle(FLOP.angle);
    // The ping pops when the flop lands, so it never overlaps the falling, tipped carcass. A closure per
    // carcass (a rare event); reset() kills the tween, so a cleared carcass never pops.
    this.scene.tweens.add({
      targets: this,
      y: c.y,
      angle: 0,
      duration: FLOP.durationMs,
      ease: 'Bounce.easeOut',
      onComplete: () => {
        this.ping.pop(this.lastSimTime);
        this.ping.place(this.pingX, this.pingY, this.lastSimTime);
      },
    });
  }

  playExit(): void {
    this.reset();
  }

  reset(): void {
    this.scene.tweens.killTweensOf(this);
    this.fresh = true;
    this.ping.hide();
    this.setAngle(0);
    this.setActive(false).setVisible(false);
  }
}
