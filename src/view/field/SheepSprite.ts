import Phaser from 'phaser';
import { COLOR_INT, TICK_MS } from '../../config/constants';
import type { Hunger, PublicSheep, Stage } from '../../sim/selectors';
import { ATLAS, FRAME } from '../assetKeys';
import { AlertPing } from './AlertPing';
import { FIELD_DEPTH } from './depths';
import type { PooledEntitySprite } from './EntityLayer';

// Placeholder art is shown at 2×: an adult or elder is 32×26 (about 64×52 on the 1280×720 canvas, as
// in the mockup). The lamb is drawn smaller at the bottom of a 22×26 frame, so with the shared centre
// origin its feet (and so depth sorting) line up with an adult's, and nothing jumps when it grows up.
const SHEEP_SCALE = 2;

// Facing changes only when a sheep moves more than this sideways in one tick (a quarter of walk
// speed), so grazing and small separation nudges in a crowd do not flip it back and forth.
const FACING_DEADBAND_PX = 1.5;

// UX-DR30a ready marker: a small heart floating just above a ready sheep's head, in the world-overlay
// band (FIELD_DEPTH.overlay) with the infection marker; the alert ping draws above them.
const READY_GAP_PX = 2;
// The lamb is drawn at the bottom of its frame (see the top of this file): its head starts 10 art rows
// down, so overlays over a lamb (the infection marker) drop by that much to sit on its head.
const LAMB_HEAD_INSET_PX = 10 * SHEEP_SCALE;

/** UX-DR56/UX-DR69 breed-mode markers: none, a pulsing ready heart (may be picked), or A's pinned heart. */
export type BreedMarker = 'none' | 'candidate' | 'pinned';
// Breed-mode juice. Visual only; Story 5.7's reduced motion revisits these, so they are named here.
const CANDIDATE_PULSE = { scale: 1.3, durationMs: 300 } as const;
const PIN_BOB = { px: 4, durationMs: 400 } as const;
const SHAKE = { angle: 10, durationMs: 40, repeats: 2 } as const;
// UX-DR55/UX-DR58 infection: the marker bobs above the head, and the sheep wobbles. The wobble is
// gameplay information, not juice: Story 5.7's reduced motion must never turn it off (UX-DR84).
// [ASSUMPTION, tuned in the browser] values.
const MARKER_BOB = { px: 3, durationMs: 500 } as const;
const WOBBLE = { angle: 8, durationMs: 220 } as const;

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
  /** pub.ready at the last sync, so a marker change can show or hide the ready heart at once. */
  private lastReady = false;
  /** The pinned heart's bob offset, tweened (visual only). */
  private readonly pinBob = { y: 0 };
  /** UX-DR55 infection marker, owned and pooled like the hearts; shown while the sheep is infected. */
  private readonly infectionMarker: Phaser.GameObjects.Image;
  private shownInfected = false;
  /** The marker's bob offset and the sickly wobble's angle, tweened while infected. */
  private readonly markerBob = { y: 0 };
  private readonly wobble = { angle: 0 };
  /** True while shake() owns the angle; the wobble waits for it. */
  private shaking = false;
  /** UX-DR54 alert ping, owned and pooled like the hearts; shown while Starving or infected. */
  private readonly ping: AlertPing;
  /** The threats the ping last saw, so each new one (false → true) pops it again. */
  private pingStarving = false;
  private pingInfected = false;

  constructor(scene: Phaser.Scene) {
    // The placeholder adult frame faces right; flipX makes it face left.
    super(scene, 0, 0, ATLAS.sheepWorld, FRAME.adultIdle);
    this.setScale(SHEEP_SCALE);
    scene.add.existing(this);
    this.readyHeart = scene.add
      .image(0, 0, ATLAS.sheepWorld, FRAME.readyHeart)
      .setScale(SHEEP_SCALE)
      .setOrigin(0.5, 1)
      .setDepth(FIELD_DEPTH.overlay)
      .setVisible(false);
    this.pinnedHeart = scene.add
      .image(0, 0, ATLAS.sheepWorld, FRAME.breedHeart)
      .setScale(SHEEP_SCALE)
      .setOrigin(0.5, 1)
      .setDepth(FIELD_DEPTH.overlay)
      .setVisible(false);
    this.infectionMarker = scene.add
      .image(0, 0, ATLAS.sheepWorld, FRAME.infectionMarker)
      .setScale(SHEEP_SCALE)
      .setOrigin(0.5, 1)
      .setDepth(FIELD_DEPTH.overlay)
      .setVisible(false);
    this.ping = new AlertPing(scene);
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
    const infectedChanged = pub.infected !== this.shownInfected;
    if (infectedChanged) this.setInfected(pub.infected);
    // The pinned heart takes the ready heart's place while this sheep is A.
    this.lastReady = pub.ready;
    const ready = pub.ready && this.marker !== 'pinned';
    const shown = ready !== this.shownReady;
    if (shown) {
      this.shownReady = ready;
      this.readyHeart.setVisible(ready);
    }
    // Follows the drawn (interpolated) position. The stage can change the frame height (a lamb grows),
    // so it is read each time.
    const headY = this.headY(y);
    const heartY = this.heartY(y);
    if (ready && (moved || shown || infectedChanged)) this.readyHeart.setPosition(x, heartY);
    // Bobbing, so it moves every frame; only one sheep is ever pinned.
    if (this.marker === 'pinned') this.pinnedHeart.setPosition(x, heartY + this.pinBob.y);
    if (this.shownInfected) {
      // Both bob or wobble, so they change every frame.
      this.infectionMarker.setPosition(x, headY + this.markerBob.y);
      if (!this.shaking) this.setAngle(this.wobble.angle);
    }
    // UX-DR54: a ping pops when the sheep enters Starving or becomes infected (each entry is news, so
    // a second threat pops it again) and stays, settling to a dot, until neither is true. Read from
    // PublicSheep only (UX-DR64). A fresh sprite saw neither, so a threatened sheep pops on load.
    const starving = pub.hunger === 'starving';
    const infected = pub.infected;
    if ((starving && !this.pingStarving) || (infected && !this.pingInfected)) this.ping.pop(simTime);
    else if (!starving && !infected) this.ping.hide();
    this.pingStarving = starving;
    this.pingInfected = infected;
    if (this.ping.shown) this.ping.place(x, this.stackTopY(y), simTime);
  }

  /**
   * How far a heart over this sheep (ready, pinned or pregnancy) is lifted to clear the infection
   * bubbles at the top of their bob: 0 while healthy.
   */
  get overlayLift(): number {
    return this.shownInfected ? this.infectionMarker.displayHeight + READY_GAP_PX + MARKER_BOB.px : 0;
  }

  /**
   * How far the pregnancy heart over this parent is lifted (UX-DR56): clear of the infection bubbles
   * and of the alert ping, which sits over the head stack. 0 while healthy and unpinged.
   */
  get pregnancyLift(): number {
    return this.overlayLift + (this.ping.shown ? this.ping.height + READY_GAP_PX : 0);
  }

  /** Where the ready or pinned heart sits: over the head, or stacked above the infection bubbles. */
  private heartY(y: number): number {
    return this.headY(y) - this.overlayLift;
  }

  /**
   * The top of this sheep's overlay stack, where the ping sits: above the heart if one shows (at the
   * top of its bob or pulse), else above the infection bubbles, else over the head.
   */
  private stackTopY(y: number): number {
    let top = this.heartY(y);
    if (this.marker === 'pinned') top -= this.pinnedHeart.height * SHEEP_SCALE + PIN_BOB.px + READY_GAP_PX;
    else if (this.shownReady) {
      const pulse = this.marker === 'candidate' ? CANDIDATE_PULSE.scale : 1;
      top -= this.readyHeart.height * SHEEP_SCALE * pulse + READY_GAP_PX;
    }
    return top;
  }

  /** Just above the drawn head at sprite centre `y`, for the stage showing. */
  private headY(y: number): number {
    const inset = this.shownStage === 'lamb' ? LAMB_HEAD_INSET_PX : 0;
    return y - this.displayHeight / 2 + inset - READY_GAP_PX;
  }

  /**
   * UX-DR55/UX-DR58/UX-DR85: infection is never colour only. The `infection` tint (MULTIPLY keeps the
   * outline, eyes and hunger poses), plus the bubble marker, plus the wobble; all undone on recovery
   * (medicine, Story 4.5). Called on a change only, so no tween is created per frame.
   */
  private setInfected(infected: boolean): void {
    this.shownInfected = infected;
    this.stopInfection();
    if (!infected) return;
    const tweens = this.scene.tweens;
    this.setTint(COLOR_INT.infection).setTintMode(Phaser.TintModes.MULTIPLY);
    this.infectionMarker.setVisible(true).setPosition(this.x, this.headY(this.y));
    tweens.add({
      targets: this.markerBob,
      y: -MARKER_BOB.px,
      duration: MARKER_BOB.durationMs,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    this.wobble.angle = -WOBBLE.angle;
    tweens.add({
      targets: this.wobble,
      angle: WOBBLE.angle,
      duration: WOBBLE.durationMs,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  /** Clears the tint, marker and wobble. */
  private stopInfection(): void {
    const tweens = this.scene.tweens;
    tweens.killTweensOf(this.markerBob);
    tweens.killTweensOf(this.wobble);
    this.markerBob.y = 0;
    this.wobble.angle = 0;
    this.clearTint();
    this.infectionMarker.setVisible(false);
    if (!this.shaking) this.setAngle(0);
  }

  /**
   * Breed mode's marker for this sheep (UX-DR56, UX-DR69). Called every frame by GameScene; does work
   * only on a change, so no tween is created per frame.
   */
  setBreedMarker(marker: BreedMarker): void {
    if (marker === this.marker) return;
    this.clearMarker();
    this.marker = marker;
    // Swap the hearts now, not at the next sync: no frame shows both, or neither.
    const ready = this.lastReady && marker !== 'pinned';
    if (ready !== this.shownReady) {
      this.shownReady = ready;
      this.readyHeart.setVisible(ready);
      if (ready) this.readyHeart.setPosition(this.x, this.heartY(this.y));
    }
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
      this.pinnedHeart.setVisible(true).setPosition(this.x, this.heartY(this.y));
      tweens.add({ targets: this.pinBob, y: -PIN_BOB.px, duration: PIN_BOB.durationMs, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
    // The stack changed under the ping: move it now, not at the next sync.
    if (this.ping.shown) this.ping.place(this.x, this.stackTopY(this.y), this.lastTick);
  }

  /** UX-DR70: a short wobble for a sheep breed mode cannot pick. Rotation only: sync owns the position. */
  shake(): void {
    const tweens = this.scene.tweens;
    tweens.killTweensOf(this);
    // The shake owns the angle while it runs; an infected sheep's wobble resumes after it.
    this.shaking = true;
    this.setAngle(-SHAKE.angle);
    tweens.add({
      targets: this,
      angle: SHAKE.angle,
      duration: SHAKE.durationMs,
      yoyo: true,
      repeat: SHAKE.repeats,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        this.shaking = false;
        this.setAngle(0);
      },
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
    this.lastReady = false;
    this.readyHeart.setVisible(false);
    this.clearMarker();
    this.scene.tweens.killTweensOf(this);
    // A reused sprite must never come back green, bubbled or wobbling.
    this.shaking = false;
    this.shownInfected = false;
    this.stopInfection();
    // A reused sprite must never come back pinged.
    this.ping.hide();
    this.pingStarving = false;
    this.pingInfected = false;
    this.setAngle(0);
    this.setFlipX(false);
    this.setActive(false).setVisible(false);
  }
}
