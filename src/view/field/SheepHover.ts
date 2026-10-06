import Phaser from 'phaser';
import type { Hunger, PublicSheep, Stage } from '../../sim/selectors';
import { STRINGS } from '../strings';
import { HOVER_DELAY_MS, type Tooltip } from '../widgets/Tooltip';
import type { EntityLayer } from './EntityLayer';
import type { SheepSprite } from './SheepSprite';

// UX-DR90: sheep hit targets are the sprite bounds plus 6 px.
const HIT_PAD_PX = 6;

/**
 * Index in `items` of the front-most sheep under (x, y), or -1, tested against the rendered sprites.
 * Shared so Story 2.4's pointer clicks agree with the hover on what counts as a sheep.
 * Allocates nothing.
 */
export function sheepIndexAt(
  items: readonly PublicSheep[],
  layer: EntityLayer<PublicSheep, SheepSprite>,
  x: number,
  y: number,
): number {
  let best = -1;
  let bestY = -Infinity;
  for (let i = 0; i < items.length; i++) {
    const spr = layer.spriteFor(items[i].id);
    if (spr === undefined) continue;
    const halfW = spr.displayWidth / 2 + HIT_PAD_PX;
    const halfH = spr.displayHeight / 2 + HIT_PAD_PX;
    // Lower sheep draw in front (depth = y), so the largest y wins.
    if (Math.abs(x - spr.x) <= halfW && Math.abs(y - spr.y) <= halfH && spr.y > bestY) {
      best = i;
      bestY = spr.y;
    }
  }
  return best;
}

// Reused for the pointer's world point: no allocation per frame.
const WORLD = new Phaser.Math.Vector2();

/**
 * Shows the sheep tooltip (FR42, UX-DR43) for the sheep under the pointer. Reads the pointer and the
 * rendered sprites only: it sends no commands and never touches GameState. Allocates nothing per frame.
 */
export class SheepHover {
  private readonly input: Phaser.Input.InputPlugin;
  private readonly camera: Phaser.Cameras.Scene2D.Camera;
  private readonly layer: EntityLayer<PublicSheep, SheepSprite>;
  private readonly tooltip: Tooltip;
  private hoveredId = 0;
  private hoverSince = 0;
  private shownStage: Stage | null = null;
  private shownHunger: Hunger | null = null;

  constructor(
    input: Phaser.Input.InputPlugin,
    camera: Phaser.Cameras.Scene2D.Camera,
    layer: EntityLayer<PublicSheep, SheepSprite>,
    tooltip: Tooltip,
  ) {
    this.input = input;
    this.camera = camera;
    this.layer = layer;
    this.tooltip = tooltip;
  }

  /** Call once per frame after the sprites are synced. `now` is real (view) time in ms. */
  update(items: readonly PublicSheep[], now: number): void {
    // Story 2.7: hide while dragging.
    const p = this.input.activePointer;
    // The input manager tracks whether the pointer is over the canvas; no listeners to clean up.
    // World coordinates, like the sprites. Taken from this camera each frame, not pointer.worldX:
    // that is only refreshed when this scene hit-tests a pointer event, so it goes stale while the
    // camera pans (PenCamera) or the pointer sits over the HUD.
    if (!this.input.manager.isOver) {
      this.clear();
      return;
    }
    this.camera.getWorldPoint(p.x, p.y, WORLD);
    const hit = sheepIndexAt(items, this.layer, WORLD.x, WORLD.y);
    if (hit < 0) {
      this.clear();
      return;
    }
    const pub = items[hit];
    if (pub.id !== this.hoveredId) {
      // A new sheep (or the last one died): the delay restarts.
      this.clear();
      this.hoveredId = pub.id;
      this.hoverSince = now;
      return;
    }
    if (now - this.hoverSince < HOVER_DELAY_MS) return;
    if (pub.stage !== this.shownStage || pub.hunger !== this.shownHunger) {
      this.shownStage = pub.stage;
      this.shownHunger = pub.hunger;
      this.tooltip.setText(STRINGS.sheepTooltip(pub.stage, pub.hunger));
    }
    const spr = this.layer.spriteFor(pub.id);
    if (spr === undefined) return;
    // The tooltip is fixed to the screen (Tooltip ignores camera scroll), so pass screen coordinates.
    const halfH = spr.displayHeight / 2;
    const sx = spr.x - this.camera.scrollX;
    const sy = spr.y - this.camera.scrollY;
    this.tooltip.showAt(sx, sy - halfH, sy + halfH);
  }

  /** Hides the tooltip and forgets the hover (also used while a modal is up). Allocates nothing. */
  clear(): void {
    this.hoveredId = 0;
    this.shownStage = null;
    this.shownHunger = null;
    if (this.tooltip.visible) this.tooltip.hide();
  }
}
