import Phaser from 'phaser';
import type { Rect } from '../../config/tuning';
import { invariant } from '../../core/invariant';
import { ATLAS, FRAME } from '../assetKeys';

const RAIL_THICKNESS = 4;
const RAIL_GAP = 8; // two rails per side, like the mockup
const POST_SPACING = 40;
const POST_HALF_WIDTH = 3; // fence-post frame is 6 px wide
const POST_RISE = 4; // posts stand a little taller than the rails
const POST_HEIGHT = 22; // fence-post frame is 22 px tall

/**
 * Everything a fence with `bounds` draws, posts included: the posts stand POST_RISE above the top rail,
 * reach below the front rails, and the side posts overhang the side rails. For layout checks (the
 * decorations, Story 3.4). Allocates.
 */
export function fenceDrawnBounds({ x, y, width, height }: Rect): Rect {
  const overhang = Math.max(0, POST_HALF_WIDTH - RAIL_THICKNESS / 2);
  const frontY = y + height - RAIL_GAP - RAIL_THICKNESS;
  const bottom = Math.max(y + height, frontY - POST_RISE + POST_HEIGHT);
  return { x: x - overhang, y: y - POST_RISE, width: width + overhang * 2, height: bottom - (y - POST_RISE) };
}

/**
 * The pasture fence, built from atlas frames and laid out again only when the bounds change: when land
 * is bought (Story 3.3), at most three times a game. A re-layout reuses its rail and post images and
 * adds only the extra ones a larger fence needs; nothing is destroyed during play (project rule).
 * The back (top) rails and side rails sit at depth 0; the front (bottom) rails and posts use their
 * y as depth, the same rule as sheep, so they draw in front of anything standing behind them.
 */
export class Fence {
  private readonly scene: Phaser.Scene;
  private readonly parts: Phaser.GameObjects.Image[] = [];
  /** How many of `parts` the current layout uses; the rest are hidden for a later, larger fence. */
  private used = 0;

  constructor(scene: Phaser.Scene, bounds: Rect) {
    this.scene = scene;
    this.setBounds(bounds);
    if (import.meta.env.DEV) {
      const post = scene.textures.getFrame(ATLAS.sheepWorld, FRAME.fencePost);
      invariant(
        post.realWidth === POST_HALF_WIDTH * 2 && post.realHeight === POST_HEIGHT,
        'Fence: the fence-post frame is not the size fenceDrawnBounds assumes',
      );
    }
  }

  setBounds({ x, y, width, height }: Rect): void {
    this.used = 0;

    const frontY = y + height - RAIL_GAP - RAIL_THICKNESS;
    for (const dy of [0, RAIL_GAP]) {
      this.rail(FRAME.fenceRailH, x, y + dy, width, RAIL_THICKNESS, 0);
      this.rail(FRAME.fenceRailH, x, frontY + dy, width, RAIL_THICKNESS, frontY);
    }
    this.rail(FRAME.fenceRailV, x, y, RAIL_THICKNESS, height, 0);
    this.rail(FRAME.fenceRailV, x + width - RAIL_THICKNESS, y, RAIL_THICKNESS, height, 0);

    // Post centres stay within the rails, so the end posts do not overhang the corners.
    const left = x + POST_HALF_WIDTH;
    const right = x + width - POST_HALF_WIDTH;
    const across = Math.max(1, Math.round((right - left) / POST_SPACING));
    for (let i = 0; i <= across; i++) {
      const px = left + ((right - left) * i) / across;
      this.post(px, y, 0);
      this.post(px, frontY, frontY);
    }
    // Side posts between the corners, centred on the side rails.
    const sideTop = y + RAIL_GAP + RAIL_THICKNESS;
    const down = Math.round((frontY - sideTop) / POST_SPACING);
    for (let i = 1; i < down; i++) {
      const py = sideTop + ((frontY - sideTop) * i) / down;
      this.post(x + RAIL_THICKNESS / 2, py, 0);
      this.post(x + width - RAIL_THICKNESS / 2, py, 0);
    }
    for (let i = this.used; i < this.parts.length; i++) this.parts[i].setVisible(false);
  }

  private rail(frame: string, x: number, y: number, w: number, h: number, depth: number): void {
    this.next(frame).setPosition(x, y).setOrigin(0, 0).setDisplaySize(w, h).setDepth(depth);
  }

  private post(cx: number, railTop: number, depth: number): void {
    this.next(FRAME.fencePost).setPosition(cx, railTop - POST_RISE).setOrigin(0.5, 0).setScale(1).setDepth(depth);
  }

  /** The next part image showing `frame`: a reused one, or a new one only when the fence has grown. */
  private next(frame: string): Phaser.GameObjects.Image {
    let img = this.parts[this.used];
    if (img === undefined) {
      img = this.scene.add.image(0, 0, ATLAS.sheepWorld, frame);
      this.parts.push(img);
    } else {
      img.setFrame(frame).setVisible(true);
    }
    this.used++;
    return img;
  }
}
