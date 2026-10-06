import type Phaser from 'phaser';
import type { Hunger, PublicSheep, Stage } from '../../sim/selectors';
import { STRINGS } from '../strings';
import { HOVER_DELAY_MS, type Tooltip } from '../widgets/Tooltip';
import type { EntityLayer } from './EntityLayer';
import type { SheepSprite } from './SheepSprite';

// UX-DR90: sheep hit targets are the sprite bounds plus 6 px.
const HIT_PAD_PX = 6;

/**
 * Index in `items` of the front-most sheep under (x, y), or -1, tested against the rendered sprites.
 * Hover and the InputController both use it, so they always agree on what counts as a sheep.
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

/**
 * Shows the sheep tooltip (FR42, UX-DR43) for the sheep under the pointer. Reads the pointer and the
 * rendered sprites only: it sends no commands and never touches GameState. Allocates nothing per frame.
 */
export class SheepHover {
  private readonly input: Phaser.Input.InputPlugin;
  private readonly layer: EntityLayer<PublicSheep, SheepSprite>;
  private readonly tooltip: Tooltip;
  private hoveredId = 0;
  private hoverSince = 0;
  private shownStage: Stage | null = null;
  private shownHunger: Hunger | null = null;

  constructor(input: Phaser.Input.InputPlugin, layer: EntityLayer<PublicSheep, SheepSprite>, tooltip: Tooltip) {
    this.input = input;
    this.layer = layer;
    this.tooltip = tooltip;
  }

  /** Call once per frame after the sprites are synced. `now` is real (view) time in ms. */
  update(items: readonly PublicSheep[], now: number): void {
    // Story 2.7: hide while dragging.
    const p = this.input.activePointer;
    // The input manager tracks whether the pointer is over the canvas; no listeners to clean up.
    // World coordinates, like the sprites, so a camera shake or scroll cannot misalign the hit test.
    const hit = this.input.manager.isOver ? sheepIndexAt(items, this.layer, p.worldX, p.worldY) : -1;
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
    const halfH = spr.displayHeight / 2;
    this.tooltip.showAt(spr.x, spr.y - halfH, spr.y + halfH);
  }

  private clear(): void {
    this.hoveredId = 0;
    this.shownStage = null;
    this.shownHunger = null;
    if (this.tooltip.visible) this.tooltip.hide();
  }
}
