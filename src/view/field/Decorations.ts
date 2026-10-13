import type Phaser from 'phaser';
import { invariant } from '../../core/invariant';
import { DECORATIONS, isOwned, type Decoration } from '../../sim/selectors';
import type { GameState } from '../../sim/state';
import { ATLAS, FRAME } from '../assetKeys';
import { DECORATION_FRAME_SIZE, DECORATION_SPOTS, WORLD_ART_SCALE } from './layout';
import { reducedMotion } from '../settings';

// Placeholder art is drawn at half size and shown at 2× (layout.ts, which sizes DECORATION_BOUNDS too).
const SCALE = WORLD_ART_SCALE;

const DECORATION_FRAME: Readonly<Record<Decoration, string>> = Object.freeze({
  flowerPatch: FRAME.flowerPatch,
  scarecrow: FRAME.scarecrow,
});

// Each frame's drawn size and each spot live in layout.ts (Story 3.6), with the bounds the layout
// checks use.
const FRAME_SIZE = DECORATION_FRAME_SIZE;

// [ASSUMPTION, tune in the browser] The pop-in when one is bought. Under reduced motion it shows at once
// (Story 5.7).
const POP = { fromScale: 0.6, durationMs: 220 } as const;

/**
 * The shop's decorations (FR23, Story 3.4): the Flower Patch and the Scarecrow, standing at fixed spots
 * in the pasture. A fixed world object, built once per game from the sheep-world atlas (never created or
 * destroyed during play); it holds no game data. GameScene tells it what is owned: `show` when a game
 * starts or loads, `pop` when one is bought. Not interactive, and drawn at depth = foot y like the sheep.
 */
export class Decorations {
  private readonly scene: Phaser.Scene;
  private readonly images: Record<Decoration, Phaser.GameObjects.Image>;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.images = {
      flowerPatch: this.build('flowerPatch'),
      scarecrow: this.build('scarecrow'),
    };
  }

  /** Shows every owned decoration at once, with no pop (a new, continued or loaded game). */
  show(state: GameState): void {
    for (let i = 0; i < DECORATIONS.length; i++) {
      const d = DECORATIONS[i];
      this.images[d].setVisible(isOwned(state, d)).setScale(SCALE);
    }
  }

  /** `d` was just bought: it pops in at its spot. Visual only. */
  pop(d: Decoration): void {
    const img = this.images[d];
    const tweens = this.scene.tweens;
    tweens.killTweensOf(img);
    if (reducedMotion()) {
      img.setScale(SCALE).setVisible(true);
      return;
    }
    img.setScale(SCALE * POP.fromScale).setVisible(true);
    tweens.add({ targets: img, scale: SCALE, duration: POP.durationMs, ease: 'Back.easeOut' });
  }

  private build(d: Decoration): Phaser.GameObjects.Image {
    const { x, foot } = DECORATION_SPOTS[d];
    const img = this.scene.add
      .image(x, foot, ATLAS.sheepWorld, DECORATION_FRAME[d])
      .setOrigin(0.5, 1)
      .setScale(SCALE)
      .setDepth(foot)
      .setVisible(false);
    if (import.meta.env.DEV) {
      invariant(
        img.frame.realWidth === FRAME_SIZE[d].width && img.frame.realHeight === FRAME_SIZE[d].height,
        `Decorations: the ${d} frame is not the size DECORATION_BOUNDS assumes`,
      );
    }
    return img;
  }
}
