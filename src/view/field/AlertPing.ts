import type Phaser from 'phaser';
import { ATLAS, FRAME } from '../assetKeys';
import { FIELD_DEPTH } from './depths';

// The ping art is 10×10 (the dot about 5×5), shown at 2× like the field art: a 20 px `alert` circle
// with a 2 px `bark` outline (COMPONENTS.alertPing, UX-DR54, UX-DR85).
const SCALE = 2;
// UX-DR54: the ping pops in, bobs about 3 s, then settles to a small static dot. [ASSUMPTION, tune in
// the browser] values. The pop and bob are juice, which Story 5.7's reduced motion may turn off (appear
// at once, no bob); the ping and the dot themselves are information and must never be turned off.
export const PING = { bobMs: 3_000, bobPx: 3, bobPeriodMs: 400, popMs: 150, popFrom: 0.4 } as const;

type PingState = 'off' | 'bobbing' | 'settled';

/**
 * An alert ping over a threatened sheep or carcass (UX-DR54). Owned by its sprite and pooled with it,
 * like SheepSprite's hearts; never holds game data. The settle is timed on game time (`simTime`), not
 * with a Phaser timer, so a ping that pops just before the pause menu opens is still bobbing after
 * Resume. Every call does work only on a change and allocates nothing per frame.
 */
export class AlertPing {
  private readonly scene: Phaser.Scene;
  private readonly ping: Phaser.GameObjects.Image;
  private readonly dot: Phaser.GameObjects.Image;
  /** The bob offset, tweened (visual only). */
  private readonly bob = { y: 0 };
  private poppedAt = 0;
  private state: PingState = 'off';

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.ping = scene.add
      .image(0, 0, ATLAS.sheepWorld, FRAME.alertPing)
      .setScale(SCALE)
      .setOrigin(0.5, 1)
      .setDepth(FIELD_DEPTH.ping)
      .setVisible(false);
    this.dot = scene.add
      .image(0, 0, ATLAS.sheepWorld, FRAME.alertDot)
      .setScale(SCALE)
      .setOrigin(0.5, 1)
      .setDepth(FIELD_DEPTH.ping)
      .setVisible(false);
  }

  /** True while the ping or its dot shows. */
  get shown(): boolean {
    return this.state !== 'off';
  }

  /**
   * How much room the ping takes above its anchor (for stacking over it), 0 when off: the full ping
   * at the top of its bob, never its mid-pop scale, so whatever stacks above does not jitter.
   */
  get height(): number {
    if (this.state === 'off') return 0;
    return this.state === 'bobbing' ? this.ping.height * SCALE + PING.bobPx : this.dot.height * SCALE;
  }

  /** Pops the ping (again, if already shown): a new threat is news. Call `place` in the same frame. */
  pop(simTime: number): void {
    const tweens = this.scene.tweens;
    this.stopTweens();
    this.state = 'bobbing';
    this.poppedAt = simTime;
    this.dot.setVisible(false);
    this.ping.setVisible(true).setScale(SCALE * PING.popFrom);
    tweens.add({ targets: this.ping, scale: SCALE, duration: PING.popMs, ease: 'Back.easeOut' });
    tweens.add({
      targets: this.bob,
      y: -PING.bobPx,
      duration: PING.bobPeriodMs,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  /**
   * Every frame while shown: anchors the ping's bottom-centre at (x, y), and settles it to the dot
   * once it has bobbed for PING.bobMs of game time. A no-op while off.
   */
  place(x: number, y: number, simTime: number): void {
    if (this.state === 'off') return;
    if (this.state === 'bobbing') {
      if (simTime < this.poppedAt + PING.bobMs) {
        this.ping.setPosition(x, y + this.bob.y);
        return;
      }
      this.stopTweens();
      this.state = 'settled';
      this.ping.setVisible(false);
      this.dot.setVisible(true).setPosition(x, y);
      return;
    }
    if (this.dot.x !== x || this.dot.y !== y) this.dot.setPosition(x, y);
  }

  /** The threat resolved (or the sprite is released): hides both. */
  hide(): void {
    if (this.state === 'off') return;
    this.stopTweens();
    this.state = 'off';
    this.ping.setVisible(false);
    this.dot.setVisible(false);
  }

  private stopTweens(): void {
    const tweens = this.scene.tweens;
    tweens.killTweensOf(this.ping);
    tweens.killTweensOf(this.bob);
    this.bob.y = 0;
    this.ping.setScale(SCALE);
  }
}
