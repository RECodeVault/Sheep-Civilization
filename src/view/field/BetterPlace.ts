import type Phaser from 'phaser';
import { COMPONENTS, RADIUS } from '../../config/constants';
import type { Rect } from '../../config/tuning';
import { ATLAS, FRAME } from '../assetKeys';
import { STRINGS } from '../strings';
import { boxTexture, textStyle } from '../widgets/box';
import { FIELD_DEPTH } from './depths';

const SPEC = COMPONENTS.dropTargetBetterPlace;
// Placeholder art is drawn at half size and shown at 2×, like the sheep.
const SCALE = 2;

/**
 * Where the hole is, in world px (UX-DR47) [ASSUMPTION, mockups/hud.html; tune in the browser]. World
 * coordinates equal the mockup's canvas ones (TUNING.startFence sits inside its Land I fence), so the
 * hole stays clear of the fence when Story 3.3 grows it in place. `hit` is the outer ring: a drop counts
 * when the pointer is inside it (152×70 px, well above hit-min).
 */
export const BETTER_PLACE = Object.freeze({ x: 520, y: 108, hitRx: 76, hitRy: 35 } as const);
// The dirt ring's centre sits 4 px below the hole's (the mockup), so the art is placed by its centre.
const ART_Y = BETTER_PLACE.y + 4;
// The "+2× food" tag sits under the dirt ring (mockup tag at y 150), with the mockup's 4/10 px padding.
const LABEL_TOP = 152;
const LABEL_PAD_X = 10;
const LABEL_PAD_Y = 4;

/** The hole, its dirt ring and its label, for the camera's play area (PenCamera). */
export const BETTER_PLACE_BOUNDS: Rect = Object.freeze({ x: 442, y: 76, width: 156, height: 110 });

/** True when world point (x, y) is in the hole: inside the outer ring's ellipse. Allocates nothing. */
export function inBetterPlace(x: number, y: number): boolean {
  const dx = (x - BETTER_PLACE.x) / BETTER_PLACE.hitRx;
  const dy = (y - BETTER_PLACE.y) / BETTER_PLACE.hitRy;
  return dx * dx + dy * dy <= 1;
}

/** off: just the hole. armed: a sheep is dragged (UX-DR52). hovered: the pointer is over the hole. */
export type BetterPlaceHighlight = 'off' | 'armed' | 'hovered';

// [ASSUMPTION, tune in the browser] Highlight motion. Story 5.7's reduced motion revisits it: the ring
// may stop spinning and the hole stop sucking, but the lit rim, glow and label are information.
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
const RING_FRAMES = 3;

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
  private ringFrame = 1;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    const { x, y } = BETTER_PLACE;
    const d = FIELD_DEPTH.ground;
    this.glow = scene.add.image(x, y, ATLAS.sheepWorld, FRAME.betterPlaceGlow).setScale(SCALE).setDepth(d);
    this.hole = scene.add.image(x, ART_Y, ATLAS.sheepWorld, FRAME.betterPlace).setScale(SCALE).setDepth(d + 1);
    this.ring = scene.add
      .image(x, y, ATLAS.sheepWorld, `${FRAME.betterPlaceRingPrefix}1`)
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

  /** Spins the ring while armed: picks the frame from real time, setting it only on a change. */
  update(now: number): void {
    if (this.level === 'off') return;
    const step = this.level === 'hovered' ? BP_MOTION.ringStepHoveredMs : BP_MOTION.ringStepMs;
    const frame = (Math.floor(now / step) % RING_FRAMES) + 1;
    if (frame === this.ringFrame) return;
    this.ringFrame = frame;
    this.ring.setFrame(`${FRAME.betterPlaceRingPrefix}${frame}`, false, false);
  }

  /** UX-DR80: the hole gulps as a sheep goes in. Visual only. */
  gulp(): void {
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
    if (this.level === 'hovered') {
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
