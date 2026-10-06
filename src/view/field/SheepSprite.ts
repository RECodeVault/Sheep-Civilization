import Phaser from 'phaser';
import type { PublicSheep } from '../../sim/selectors';
import { ATLAS, FRAME } from '../assetKeys';
import type { PooledEntitySprite } from './EntityLayer';

// Placeholder art is 32×26, shown at 2× (about 64×52 on the 1280×720 canvas, as in the mockup).
const SHEEP_SCALE = 2;

// Facing changes only when a sheep moves more than this sideways in one tick (a quarter of walk
// speed), so grazing and small separation nudges in a crowd do not flip it back and forth.
const FACING_DEADBAND_PX = 1.5;

/**
 * Draws a sheep between its previous and current tick positions (fixed-step interpolation), so the
 * 10 Hz sim looks smooth at any refresh rate. Rendering is one tick behind the sim; Story 2.7's drag
 * must snap to the pointer instead. The positions here are view state only, never game data.
 */
export class SheepSprite extends Phaser.GameObjects.Sprite implements PooledEntitySprite<PublicSheep> {
  private boundId = 0;
  private fresh = true;
  private prevX = 0;
  private prevY = 0;
  private currX = 0;
  private currY = 0;
  private lastTick = 0;

  constructor(scene: Phaser.Scene) {
    // The placeholder adult frame faces right; flipX makes it face left.
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

  sync(pub: PublicSheep, alpha: number, simTime: number): void {
    if (this.fresh) {
      // A newly bound (possibly reused) sprite starts at rest, never sliding in from an old spot.
      this.fresh = false;
      this.prevX = this.currX = pub.x;
      this.prevY = this.currY = pub.y;
      this.lastTick = simTime;
    } else if (simTime !== this.lastTick) {
      this.prevX = this.currX;
      this.prevY = this.currY;
      this.currX = pub.x;
      this.currY = pub.y;
      this.lastTick = simTime;
      const dx = this.currX - this.prevX;
      if (dx < -FACING_DEADBAND_PX) this.setFlipX(true);
      else if (dx > FACING_DEADBAND_PX) this.setFlipX(false);
    }
    const x = this.prevX + (this.currX - this.prevX) * alpha;
    const y = this.prevY + (this.currY - this.prevY) * alpha;
    if (this.x !== x || this.y !== y) {
      this.setPosition(x, y);
      // Lower sheep draw in front.
      this.setDepth(y);
    }
  }

  playExit(): void {
    this.reset();
  }

  reset(): void {
    this.boundId = 0;
    this.fresh = true;
    this.setFlipX(false);
    this.setActive(false).setVisible(false);
  }
}
