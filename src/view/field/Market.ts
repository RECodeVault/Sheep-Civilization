import type Phaser from 'phaser';
import { COLORS, COMPONENTS, RADIUS, type ColorToken } from '../../config/constants';
import { ATLAS, FRAME } from '../assetKeys';
import { reducedMotion } from '../settings';
import { STRINGS } from '../strings';
import { boxTexture, DROP_PX, textStyle } from '../widgets/box';
import { FIELD_DEPTH } from './depths';
import { MARKET, WORLD_ART_SCALE } from './layout';

const SPEC = COMPONENTS.dropTargetMarket;
const INVALID = COMPONENTS.dropTargetInvalid;
// Placeholder art is drawn at half size and shown at 2× (layout.ts, which the layout checks use too).
const SCALE = WORLD_ART_SCALE;

// The stall's place and bounds live in layout.ts (Story 3.6).
// The drag outline's centre: the mockup's outer ring spans 1080–1276 × 170–390.
const OUTLINE_X = 1178;
const OUTLINE_Y = 280;
// The price tag sits on the outline (mockup tag top 146), with the Better Place label's 4/10 px padding.
const TAG_BOTTOM = 172;
const TAG_PAD_X = 10;
const TAG_PAD_Y = 4;

/** True when world point (x, y) is on the stall: inside the drag outline. Allocates nothing. */
export function inMarket(x: number, y: number): boolean {
  const r = MARKET.hit;
  return x >= r.x && x < r.x + r.width && y >= r.y && y < r.y + r.height;
}

/**
 * off: just the stall. armed: an adult or elder is dragged (UX-DR51). hovered: the pointer is over the
 * stall with one. invalid: the pointer is over the stall with a lamb (UX-DR53, "Too young").
 */
export type MarketHighlight = 'off' | 'armed' | 'hovered' | 'invalid';

// [ASSUMPTION, tune in the browser] Highlight motion. Under reduced motion (Story 5.7) the outline holds
// at full alpha, the awning does not flap, the tag does not grow and the stall does not nudge; the
// outline, tag and "Too young" are information and stay. The highlight only exists during a drag, and a
// modal cancels the drag, so the setting is read as each effect starts.
const MARKET_MOTION = {
  /** The armed outline pulses between full and this alpha. */
  pulseAlpha: 0.45,
  pulseMs: 450,
  /** One awning frame per step while hovered ("the awning flaps"). */
  flapStepMs: 120,
  /** The hovered tag grows to this scale ("the tag grows"). */
  tagScale: 1.25,
  tagGrowMs: 120,
  /** The one-shot nudge when a sheep is sold into the stall. */
  nudgeScale: 1.06,
  nudgeMs: 100,
} as const;
// Built once, so the per-step frame change allocates no array.
const FLAP_FRAMES: readonly string[] = Object.freeze([FRAME.market, FRAME.marketFlap]);

/**
 * The Market stall (UX-DR46, UX-DR48, UX-DR51, UX-DR53): a warm, striped, wooden rectangle, the Better
 * Place's opposite. A fixed world object, built once per game from the sheep-world atlas (never created
 * or destroyed during play). It draws under everything that moves and holds no game data: GameScene
 * feeds it the drag highlight each frame, and the sale itself is a command.
 */
export class Market {
  private readonly scene: Phaser.Scene;
  private readonly stall: Phaser.GameObjects.Image;
  private readonly outline: Phaser.GameObjects.Image;
  private readonly tag: Phaser.GameObjects.Container;
  private readonly tagBox: Phaser.GameObjects.Image;
  private readonly tagText: Phaser.GameObjects.Text;
  private level: MarketHighlight = 'off';
  private price = 0;
  private flapFrame = 0;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    const d = FIELD_DEPTH.ground;
    this.stall = scene.add
      .image(MARKET.x, MARKET.bottom, ATLAS.sheepWorld, FRAME.market)
      .setOrigin(0.5, 1)
      .setScale(SCALE)
      .setDepth(d);
    this.outline = scene.add
      .image(OUTLINE_X, OUTLINE_Y, ATLAS.sheepWorld, FRAME.marketOutline)
      .setScale(SCALE)
      .setDepth(d + 1);
    // A status tag, not a button: no drop offset (UX-DR9). Its box is re-baked per distinct text.
    // boxTexture leaves DROP_PX of room right and below for a drop it does not draw here, so the box and
    // text sit that much up and right of the container's anchor.
    this.tagText = scene.add.text(-DROP_PX / 2, -TAG_PAD_Y - DROP_PX, '', textStyle('numeric', SPEC.priceTagText)).setOrigin(0.5, 1);
    this.tagBox = scene.add.image(0, 0, '__DEFAULT').setOrigin(0.5, 1);
    // Anchored at the tag's bottom centre, so it grows upward off the outline. The tag is information,
    // so it draws in the world-overlay band, above a sheep held near the top of the stall.
    this.tag = scene.add.container(MARKET.x, TAG_BOTTOM, [this.tagBox, this.tagText]).setDepth(FIELD_DEPTH.overlay);
    this.apply();
  }

  /** Sets the drag highlight and the price the tag shows. Does work only on a change; call every frame. */
  setHighlight(level: MarketHighlight, price: number): void {
    if (level === this.level && price === this.price) return;
    const levelChanged = level !== this.level;
    this.level = level;
    this.price = price;
    if (levelChanged) this.apply();
    else this.applyTag();
  }

  /** Flaps the awning while hovered: picks the frame from real time, setting it only on a change. No allocation. */
  update(now: number): void {
    if (this.level !== 'hovered' || reducedMotion()) return;
    const frame = Math.floor(now / MARKET_MOTION.flapStepMs) % FLAP_FRAMES.length;
    if (frame === this.flapFrame) return;
    this.flapFrame = frame;
    this.stall.setFrame(FLAP_FRAMES[frame], false, false);
  }

  /** UX-DR82: the stall nudges as a sold sheep goes in. Visual only. */
  nudge(): void {
    if (reducedMotion()) return;
    const tweens = this.scene.tweens;
    tweens.killTweensOf(this.stall);
    this.stall.setScale(SCALE);
    tweens.add({
      targets: this.stall,
      scaleX: SCALE * MARKET_MOTION.nudgeScale,
      scaleY: SCALE / MARKET_MOTION.nudgeScale,
      duration: MARKET_MOTION.nudgeMs,
      yoyo: true,
      ease: 'Sine.easeInOut',
    });
  }

  private apply(): void {
    const level = this.level;
    const invalid = level === 'invalid';
    this.flapFrame = 0;
    this.stall.setFrame(invalid ? FRAME.marketDisabled : FRAME.market, false, false);
    const lit = level !== 'off';
    this.outline.setVisible(lit).setFrame(invalid ? FRAME.marketOutlineInvalid : FRAME.marketOutline, false, false);
    this.tag.setVisible(lit);
    const tweens = this.scene.tweens;
    tweens.killTweensOf(this.outline);
    tweens.killTweensOf(this.tag);
    this.outline.setAlpha(1);
    this.tag.setScale(1);
    if (reducedMotion()) {
      this.applyTag();
      return;
    }
    if (level === 'armed' || level === 'hovered') {
      tweens.add({
        targets: this.outline,
        alpha: MARKET_MOTION.pulseAlpha,
        duration: MARKET_MOTION.pulseMs,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }
    if (level === 'hovered') {
      tweens.add({ targets: this.tag, scale: MARKET_MOTION.tagScale, duration: MARKET_MOTION.tagGrowMs, ease: 'Back.easeOut' });
    }
    this.applyTag();
  }

  /** The tag's text and colours for the current level and price; re-bakes its box only on a change. */
  private applyTag(): void {
    if (this.level === 'off') return;
    const invalid = this.level === 'invalid';
    const text = invalid ? STRINGS.marketTooYoung : STRINGS.marketPrice(this.price);
    const fill: ColorToken = invalid ? INVALID.tintColor : SPEC.priceTagBackground;
    const ink: ColorToken = invalid ? COMPONENTS.buttonDisabled.textColor : SPEC.priceTagText;
    if (text === this.tagText.text && this.tagText.style.color === COLORS[ink]) return;
    this.tagText.setText(text).setColor(COLORS[ink]);
    const w = Math.ceil(this.tagText.width) + TAG_PAD_X * 2;
    const h = Math.ceil(this.tagText.height) + TAG_PAD_Y * 2;
    this.tagBox.setTexture(boxTexture(this.scene, w, h, { fill, border: fill, radius: RADIUS.sm, drop: false }));
  }
}
