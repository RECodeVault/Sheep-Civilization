import type Phaser from 'phaser';
import type { Hunger, PublicSheep, Stage } from '../../sim/selectors';
import { FRAME } from '../assetKeys';
import { STRINGS } from '../strings';
import { HOVER_DELAY_MS, type Tooltip } from '../widgets/Tooltip';
import type { EntityLayer } from './EntityLayer';
import { spriteIndexAt } from './hitTest';
import type { SheepSprite } from './SheepSprite';

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
  private shownCooldown: boolean | null = null;

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
    // World coordinates, like the sprites: the pointer plus this frame's camera scroll (zoom 1, no
    // rotation). Not pointer.worldX, which is only refreshed when this scene hit-tests an event, and
    // not camera.getWorldPoint, whose matrix is rebuilt only at render (one frame behind a pan).
    if (!this.input.manager.isOver) {
      this.clear();
      return;
    }
    const hit = spriteIndexAt(items, this.layer, p.x + this.camera.scrollX, p.y + this.camera.scrollY);
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
    // FR10 / UX-DR43: a heart outline after the second line while the sheep is on breeding cooldown.
    if (pub.onCooldown !== this.shownCooldown) {
      this.shownCooldown = pub.onCooldown;
      this.tooltip.setIcon(pub.onCooldown ? FRAME.heartOutline : null);
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
    this.shownCooldown = null;
    if (this.tooltip.visible) this.tooltip.hide();
  }
}
