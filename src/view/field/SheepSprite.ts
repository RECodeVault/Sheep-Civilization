import Phaser from 'phaser';
import { TICK_MS } from '../../config/constants';
import type { Hunger, PublicSheep, Stage } from '../../sim/selectors';
import { ATLAS, FRAME } from '../assetKeys';
import type { PooledEntitySprite } from './EntityLayer';

// Placeholder art is shown at 2×: an adult or elder is 32×26 (about 64×52 on the 1280×720 canvas, as
// in the mockup). The lamb is drawn smaller at the bottom of a 22×26 frame, so with the shared centre
// origin its feet (and so depth sorting) line up with an adult's, and nothing jumps when it grows up.
const SHEEP_SCALE = 2;

// Facing changes only when a sheep moves more than this sideways in one tick (a quarter of walk
// speed), so grazing and small separation nudges in a crowd do not flip it back and forth.
const FACING_DEADBAND_PX = 1.5;

// UX-DR30a ready marker: a small heart floating just above a ready sheep's head. Drawn above every
// sheep (sheep depth = y ≤ 720) and below GameScene's munch crumbs and tooltip (10 000 − 1 and up);
// the world-overlay layer itself arrives with pings in Story 2.6.
export const READY_DEPTH = 9_998;
const READY_GAP_PX = 2;

/** UX-DR56/UX-DR69 breed-mode markers: none, a pulsing ready heart (may be picked), or A's pinned heart. */
export type BreedMarker = 'none' | 'candidate' | 'pinned';
// Breed-mode juice. Visual only; Story 5.7's reduced motion revisits these, so they are named here.
const CANDIDATE_PULSE = { scale: 1.3, durationMs: 300 } as const;
const PIN_BOB = { px: 4, durationMs: 400 } as const;
const SHAKE = { angle: 10, durationMs: 40, repeats: 2 } as const;

// FR7 / UX-DR58: the stage picks the art (lamb smaller, elder greyer); FR2 / UX-DR57: the hunger
// state picks the pose within it (normal, drooping, thin). Elders are grey in their art, not by tint:
// tint is the infection cue (Story 2.5), and an infected elder needs both.
const SHEEP_FRAME: Readonly<Record<Stage, Readonly<Record<Hunger, string>>>> = Object.freeze({
  lamb: Object.freeze({ fed: FRAME.lambIdle, hungry: FRAME.lambHungry, starving: FRAME.lambStarving }),
  adult: Object.freeze({ fed: FRAME.adultIdle, hungry: FRAME.adultHungry, starving: FRAME.adultStarving }),
  elder: Object.freeze({ fed: FRAME.elderIdle, hungry: FRAME.elderHungry, starving: FRAME.elderStarving }),
});

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
  /** The stage and hunger whose frame is showing; null forces the next sync to set it. */
  private shownStage: Stage | null = null;
  private shownHunger: Hunger | null = null;
  /** The ready heart, owned by this sprite and pooled with it; shown while the sheep is ready (FR8a). */
  private readonly readyHeart: Phaser.GameObjects.Image;
  private shownReady = false;
  /** Breed mode's pinned heart over adult A (UX-DR56), owned and pooled like the ready heart. */
  private readonly pinnedHeart: Phaser.GameObjects.Image;
  private marker: BreedMarker = 'none';
  /** The pinned heart's bob offset, tweened (visual only). */
  private readonly pinBob = { y: 0 };

  constructor(scene: Phaser.Scene) {
    // The placeholder adult frame faces right; flipX makes it face left.
    super(scene, 0, 0, ATLAS.sheepWorld, FRAME.adultIdle);
    this.setScale(SHEEP_SCALE);
    scene.add.existing(this);
    this.readyHeart = scene.add
      .image(0, 0, ATLAS.sheepWorld, FRAME.readyHeart)
      .setScale(SHEEP_SCALE)
      .setOrigin(0.5, 1)
      .setDepth(READY_DEPTH)
      .setVisible(false);
    this.pinnedHeart = scene.add
      .image(0, 0, ATLAS.sheepWorld, FRAME.breedHeart)
      .setScale(SHEEP_SCALE)
      .setOrigin(0.5, 1)
      .setDepth(READY_DEPTH)
      .setVisible(false);
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
    // Either may change alone: a sheep ages while its hunger holds steady, and the reverse.
    if (pub.stage !== this.shownStage || pub.hunger !== this.shownHunger) {
      this.shownStage = pub.stage;
      this.shownHunger = pub.hunger;
      this.setFrame(SHEEP_FRAME[pub.stage][pub.hunger]);
    }
    if (this.fresh) {
      // A newly bound (possibly reused) sprite starts at rest, never sliding in from an old spot.
      this.fresh = false;
      this.prevX = this.currX = pub.x;
      this.prevY = this.currY = pub.y;
      this.lastTick = simTime;
    } else if (simTime !== this.lastTick) {
      const ticks = (simTime - this.lastTick) / TICK_MS;
      if (ticks > 1) {
        // Several ticks ran since the last frame (a hitch, or debug speed). Blend over the last tick
        // only, starting from an estimate of the T-1 position on the straight line from the old
        // spot, so the sprite does not lurch through several ticks of motion at once.
        const back = 1 - 1 / ticks;
        this.prevX = this.currX + (pub.x - this.currX) * back;
        this.prevY = this.currY + (pub.y - this.currY) * back;
      } else if (ticks === 1) {
        this.prevX = this.currX;
        this.prevY = this.currY;
      } else {
        // Time went backwards (a new or loaded game): snap, never slide from the old run.
        this.prevX = pub.x;
        this.prevY = pub.y;
      }
      this.currX = pub.x;
      this.currY = pub.y;
      this.lastTick = simTime;
      const dx = this.currX - this.prevX;
      if (dx < -FACING_DEADBAND_PX) this.setFlipX(true);
      else if (dx > FACING_DEADBAND_PX) this.setFlipX(false);
    }
    const x = this.prevX + (this.currX - this.prevX) * alpha;
    const y = this.prevY + (this.currY - this.prevY) * alpha;
    const moved = this.x !== x || this.y !== y;
    if (moved) {
      this.setPosition(x, y);
      // Lower sheep draw in front.
      this.setDepth(y);
    }
    // The pinned heart takes the ready heart's place while this sheep is A.
    const ready = pub.ready && this.marker !== 'pinned';
    const shown = ready !== this.shownReady;
    if (shown) {
      this.shownReady = ready;
      this.readyHeart.setVisible(ready);
    }
    // Follows the drawn (interpolated) position. Only adults are ready, so the frame height is steady.
    const headY = y - this.displayHeight / 2 - READY_GAP_PX;
    if (ready && (moved || shown)) this.readyHeart.setPosition(x, headY);
    // Bobbing, so it moves every frame; only one sheep is ever pinned.
    if (this.marker === 'pinned') this.pinnedHeart.setPosition(x, headY + this.pinBob.y);
  }

  /**
   * Breed mode's marker for this sheep (UX-DR56, UX-DR69). Called every frame by GameScene; does work
   * only on a change, so no tween is created per frame.
   */
  setBreedMarker(marker: BreedMarker): void {
    if (marker === this.marker) return;
    this.clearMarker();
    this.marker = marker;
    const tweens = this.scene.tweens;
    if (marker === 'candidate') {
      tweens.add({
        targets: this.readyHeart,
        scale: SHEEP_SCALE * CANDIDATE_PULSE.scale,
        duration: CANDIDATE_PULSE.durationMs,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    } else if (marker === 'pinned') {
      this.pinnedHeart.setVisible(true).setPosition(this.x, this.y - this.displayHeight / 2 - READY_GAP_PX);
      tweens.add({ targets: this.pinBob, y: -PIN_BOB.px, duration: PIN_BOB.durationMs, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
  }

  /** UX-DR70: a short wobble for a sheep breed mode cannot pick. Rotation only: sync owns the position. */
  shake(): void {
    const tweens = this.scene.tweens;
    tweens.killTweensOf(this);
    this.setAngle(-SHAKE.angle);
    tweens.add({
      targets: this,
      angle: SHAKE.angle,
      duration: SHAKE.durationMs,
      yoyo: true,
      repeat: SHAKE.repeats,
      ease: 'Sine.easeInOut',
      onComplete: () => this.setAngle(0),
    });
  }

  private clearMarker(): void {
    const tweens = this.scene.tweens;
    tweens.killTweensOf(this.readyHeart);
    tweens.killTweensOf(this.pinBob);
    this.readyHeart.setScale(SHEEP_SCALE);
    this.pinBob.y = 0;
    this.pinnedHeart.setVisible(false);
    this.marker = 'none';
  }

  playExit(): void {
    this.reset();
  }

  reset(): void {
    this.boundId = 0;
    this.fresh = true;
    this.shownStage = null;
    this.shownHunger = null;
    this.shownReady = false;
    this.readyHeart.setVisible(false);
    this.clearMarker();
    this.scene.tweens.killTweensOf(this);
    this.setAngle(0);
    this.setFlipX(false);
    this.setActive(false).setVisible(false);
  }
}
