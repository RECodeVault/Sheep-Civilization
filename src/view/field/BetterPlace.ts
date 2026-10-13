import type Phaser from 'phaser';
import { COMPONENTS, RADIUS } from '../../config/constants';
import { invariant } from '../../core/invariant';
import { ATLAS, FRAME } from '../assetKeys';
import { reducedMotion } from '../settings';
import { STRINGS } from '../strings';
import { boxTexture, textStyle } from '../widgets/box';
import { FIELD_DEPTH } from './depths';
import { BETTER_PLACE, BETTER_PLACE_GLOW_FRAME, WORLD_ART_SCALE } from './layout';

const SPEC = COMPONENTS.dropTargetBetterPlace;
// Placeholder art is drawn at half size and shown at 2× (layout.ts, which the layout checks use too).
const SCALE = WORLD_ART_SCALE;

// The dirt ring's centre sits 4 px below the hole's (the mockup), so the art is placed by its centre.
const ART_Y = BETTER_PLACE.y + 4;
// The "+2× food" tag sits under the dirt ring (mockup tag at y 150), with the mockup's 4/10 px padding.
const LABEL_TOP = 152;
const LABEL_PAD_X = 10;
const LABEL_PAD_Y = 4;

// The hole's place, its bounds and the glow's size and bounds live in layout.ts (Story 3.6).
const GLOW_FRAME = BETTER_PLACE_GLOW_FRAME;

/** True when world point (x, y) is in the hole: inside the outer ring's ellipse. Allocates nothing. */
export function inBetterPlace(x: number, y: number): boolean {
  const dx = (x - BETTER_PLACE.x) / BETTER_PLACE.hitRx;
  const dy = (y - BETTER_PLACE.y) / BETTER_PLACE.hitRy;
  return dx * dx + dy * dy <= 1;
}

/** off: just the hole. armed: a sheep is dragged (UX-DR52). hovered: the pointer is over the hole. */
export type BetterPlaceHighlight = 'off' | 'armed' | 'hovered';

// [ASSUMPTION, tune in the browser] Highlight motion. Under reduced motion (Story 5.7) the ring holds
// still, the hole neither sucks nor gulps; the lit rim, glow, ring and label are information and stay.
// The highlight only exists during a drag, and a modal cancels the drag, so the setting is read as each
// effect starts.
const BP_MOTION = {
  /** One ring frame per step: slow while armed, fast while hovered ("the ring spins"). */
  ringStepMs: 220,
  ringStepHoveredMs: 90,
  /** The hovered "suck": the hole squeezes in and back. */
  suckScale: 0.9,
  suckMs: 250,
  /** The one-shot gulp when a sheep goes in. */
  gulpScale: 0.8,
  gulpMs: 120,
} as const;
// Built once, so the per-step frame change allocates no string.
const RING_FRAMES: readonly string[] = Object.freeze([1, 2, 3].map((n) => `${FRAME.betterPlaceRingPrefix}${n}`));

/**
 * The Better Place (UX-DR47, UX-DR48, UX-DR52): a round void with a cold gold rim, the Market's
 * opposite. A fixed world object, built once per game from the sheep-world atlas (never created or
 * destroyed during play). It draws under everything that moves and holds no game data: GameScene feeds
 * it the drag highlight each frame, and the sacrifice itself is a command.
 */
export class BetterPlace {
  private readonly scene: Phaser.Scene;
  private readonly glow: Phaser.GameObjects.Image;
  private readonly hole: Phaser.GameObjects.Image;
  private readonly ring: Phaser.GameObjects.Image;
  private readonly labelBox: Phaser.GameObjects.Image;
  private readonly label: Phaser.GameObjects.Text;
  private level: BetterPlaceHighlight = 'off';
  private ringFrame = 0;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    const { x, y } = BETTER_PLACE;
    const d = FIELD_DEPTH.ground;
    this.glow = scene.add.image(x, y, ATLAS.sheepWorld, FRAME.betterPlaceGlow).setScale(SCALE).setDepth(d);
    if (import.meta.env.DEV) {
      invariant(
        this.glow.frame.realWidth === GLOW_FRAME.width && this.glow.frame.realHeight === GLOW_FRAME.height,
        'BetterPlace: the glow frame is not the size BETTER_PLACE_GLOW_BOUNDS assumes',
      );
    }
    this.hole = scene.add.image(x, ART_Y, ATLAS.sheepWorld, FRAME.betterPlace).setScale(SCALE).setDepth(d + 1);
    this.ring = scene.add
      .image(x, y, ATLAS.sheepWorld, RING_FRAMES[0])
      .setScale(SCALE)
      .setDepth(d + 2);
    this.label = scene.add
      .text(x, LABEL_TOP + LABEL_PAD_Y, STRINGS.betterPlaceLabel, textStyle('label', SPEC.labelColor))
      .setOrigin(0.5, 0)
      .setDepth(d + 4);
    const w = Math.ceil(this.label.width) + LABEL_PAD_X * 2;
    const h = Math.ceil(this.label.height) + LABEL_PAD_Y * 2;
    // A status tag, not a button: no drop offset (UX-DR9). `void` with a `halo` label (DESIGN tag).
    const key = boxTexture(scene, w, h, { fill: SPEC.holeColor, border: SPEC.holeColor, radius: RADIUS.sm, drop: false });
    this.labelBox = scene.add
      .image(x - w / 2, LABEL_TOP, key)
      .setOrigin(0, 0)
      .setDepth(d + 3);
    this.apply();
  }

  /** Sets the drag highlight. Does work only on a change; call every frame. */
  setHighlight(level: BetterPlaceHighlight): void {
    if (level === this.level) return;
    this.level = level;
    this.apply();
  }

  /** Spins the ring while armed: picks the frame from real time, setting it only on a change. No allocation. */
  update(now: number): void {
    if (this.level === 'off' || reducedMotion()) return;
    const step = this.level === 'hovered' ? BP_MOTION.ringStepHoveredMs : BP_MOTION.ringStepMs;
    const frame = Math.floor(now / step) % RING_FRAMES.length;
    if (frame === this.ringFrame) return;
    this.ringFrame = frame;
    this.ring.setFrame(RING_FRAMES[frame], false, false);
  }

  /** UX-DR80: the hole gulps as a sheep goes in. Visual only. */
  gulp(): void {
    if (reducedMotion()) return;
    const tweens = this.scene.tweens;
    tweens.killTweensOf(this.hole);
    this.hole.setScale(SCALE);
    tweens.add({
      targets: this.hole,
      scale: SCALE * BP_MOTION.gulpScale,
      duration: BP_MOTION.gulpMs,
      yoyo: true,
      ease: 'Sine.easeInOut',
      onComplete: () => this.apply(),
    });
  }

  private apply(): void {
    const lit = this.level !== 'off';
    this.hole.setFrame(lit ? FRAME.betterPlaceLit : FRAME.betterPlace, false, false);
    this.glow.setVisible(lit);
    this.ring.setVisible(lit);
    this.label.setVisible(lit);
    this.labelBox.setVisible(lit);
    const tweens = this.scene.tweens;
    tweens.killTweensOf(this.hole);
    this.hole.setScale(SCALE);
    if (this.level === 'hovered' && !reducedMotion()) {
      tweens.add({
        targets: this.hole,
        scale: SCALE * BP_MOTION.suckScale,
        duration: BP_MOTION.suckMs,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }
  }
}
