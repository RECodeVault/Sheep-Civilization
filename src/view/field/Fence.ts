import Phaser from 'phaser';
import type { Rect } from '../../config/tuning';
import { ATLAS, FRAME } from '../assetKeys';

const RAIL_THICKNESS = 4;
const RAIL_GAP = 8; // two rails per side, like the mockup
const POST_SPACING = 40;
const POST_HALF_WIDTH = 3; // fence-post frame is 6 px wide
const POST_RISE = 4; // posts stand a little taller than the rails

/**
 * The pasture fence, built once from atlas frames and rebuilt only when the bounds change: when land is
 * bought (Story 3.3), at most three times a game. A rebuild destroys and re-adds its rail and post
 * images; that is fine for so rare an event (pooling is for per-entity sprites).
 * The back (top) rails and side rails sit at depth 0; the front (bottom) rails and posts use their
 * y as depth, the same rule as sheep, so they draw in front of anything standing behind them.
 */
export class Fence {
  private readonly scene: Phaser.Scene;
  private readonly parts: Phaser.GameObjects.Image[] = [];

  constructor(scene: Phaser.Scene, bounds: Rect) {
    this.scene = scene;
    this.setBounds(bounds);
  }

  setBounds({ x, y, width, height }: Rect): void {
    for (const p of this.parts) p.destroy();
    this.parts.length = 0;

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
  }

  private rail(frame: string, x: number, y: number, w: number, h: number, depth: number): void {
    const img = this.scene.add.image(x, y, ATLAS.sheepWorld, frame).setOrigin(0, 0).setDisplaySize(w, h);
    this.parts.push(img.setDepth(depth));
  }

  private post(cx: number, railTop: number, depth: number): void {
    const img = this.scene.add.image(cx, railTop - POST_RISE, ATLAS.sheepWorld, FRAME.fencePost).setOrigin(0.5, 0);
    this.parts.push(img.setDepth(depth));
  }
}
