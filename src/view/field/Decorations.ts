import type Phaser from 'phaser';
import type { Rect } from '../../config/tuning';
import { invariant } from '../../core/invariant';
import { DECORATIONS, isOwned, type Decoration } from '../../sim/selectors';
import type { GameState } from '../../sim/state';
import { ATLAS, FRAME } from '../assetKeys';

// Placeholder art is drawn at half size and shown at 2×, like the sheep and the Better Place.
const SCALE = 2;

const DECORATION_FRAME: Readonly<Record<Decoration, string>> = Object.freeze({
  flowerPatch: FRAME.flowerPatch,
  scarecrow: FRAME.scarecrow,
});

// Each frame's drawn size (assets/art/world/{flower-patch,scarecrow}.png). DEV checks it against the
// atlas, so new art cannot silently outgrow the bounds the layout invariant checks.
const FRAME_SIZE: Readonly<Record<Decoration, { readonly width: number; readonly height: number }>> = Object.freeze({
  flowerPatch: Object.freeze({ width: 28, height: 14 }),
  scarecrow: Object.freeze({ width: 20, height: 32 }),
});

/**
 * Where each decoration stands, in world px (FR23) [ASSUMPTION, tune in the browser]: `x` is its centre
 * and `foot` its bottom edge. Both stand in the grass strip between the Better Place's glow (to x 660)
 * and the Market (from x 1080), above the fence: every land tier from Land I has its top rail at y 184
 * (posts to y 180) and fences only grow left and down, so no tier covers them. That strip is always in the
 * camera's play area and right of the open shop panel, and no sheep or piece ever stands there.
 * GameScene's DEV invariant checks all of this for every tier.
 */
export const DECORATION_SPOTS: Readonly<Record<Decoration, { readonly x: number; readonly foot: number }>> =
  Object.freeze({
    flowerPatch: Object.freeze({ x: 724, foot: 176 }),
    scarecrow: Object.freeze({ x: 1000, foot: 176 }),
  });

/** The rect each decoration is shown in (its frame at SCALE, standing on its spot). */
export const DECORATION_BOUNDS: Readonly<Record<Decoration, Rect>> = Object.freeze({
  flowerPatch: shownRect('flowerPatch'),
  scarecrow: shownRect('scarecrow'),
});

function shownRect(d: Decoration): Rect {
  const { x, foot } = DECORATION_SPOTS[d];
  const width = FRAME_SIZE[d].width * SCALE;
  const height = FRAME_SIZE[d].height * SCALE;
  return Object.freeze({ x: x - width / 2, y: foot - height, width, height });
}

// [ASSUMPTION, tune in the browser] The pop-in when one is bought. Story 5.7's reduced motion shows it at
// once instead.
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
