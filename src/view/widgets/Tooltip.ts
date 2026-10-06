import Phaser from 'phaser';
import { COLOR_INT, COLORS, COMPONENTS, LAYOUT, RADIUS, TYPOGRAPHY } from '../../config/constants';

const SPEC = COMPONENTS.tooltip;
const TYPE = TYPOGRAPHY[SPEC.typography];
const PAD = SPEC.padding;
// Gap between the anchor point and the box.
const OFFSET = 6;

/**
 * The `tooltip` component (DESIGN.md): a dusk-deep box with wool body text. Built once and reused;
 * the background is redrawn only when the text changes, never per frame. Generic: sheep hover uses
 * it now, and Story 1.6 reuses it for button tooltips.
 */
export class Tooltip {
  private readonly box: Phaser.GameObjects.Graphics;
  private readonly label: Phaser.GameObjects.Text;
  private text = '';
  private width = 0;
  private height = 0;

  constructor(scene: Phaser.Scene, depth: number) {
    this.box = scene.add.graphics().setDepth(depth);
    this.label = scene.add
      .text(0, 0, '', {
        fontFamily: TYPE.fontFamily,
        fontSize: `${TYPE.fontSize}px`,
        fontStyle: String(TYPE.fontWeight),
        color: COLORS[SPEC.textColor],
        // Crisp under FIT scaling (DESIGN.md Typography). src/view may read window.
        resolution: window.devicePixelRatio || 1,
      })
      .setDepth(depth);
    this.hide();
  }

  setText(text: string): void {
    if (text === this.text) return;
    this.text = text;
    this.label.setText(text);
    this.width = Math.ceil(this.label.width) + PAD * 2;
    this.height = Math.ceil(this.label.height) + PAD * 2;
    this.box.clear();
    this.box.fillStyle(COLOR_INT[SPEC.backgroundColor], 1);
    this.box.fillRoundedRect(0, 0, this.width, this.height, RADIUS[SPEC.rounded]);
  }

  /**
   * Shows the box centred above (x, anchorTop), or below (x, anchorBottom) when there is no room
   * above, clamped inside the canvas safe margin.
   */
  showAt(x: number, anchorTop: number, anchorBottom: number): void {
    const m = LAYOUT.safeMargin;
    let left = Math.round(x - this.width / 2);
    left = Math.max(m, Math.min(LAYOUT.canvasWidth - m - this.width, left));
    let top = Math.round(anchorTop - OFFSET - this.height);
    if (top < m) top = Math.round(anchorBottom + OFFSET);
    top = Math.max(m, Math.min(LAYOUT.canvasHeight - m - this.height, top));
    if (this.box.x !== left || this.box.y !== top) {
      this.box.setPosition(left, top);
      this.label.setPosition(left + PAD, top + PAD);
    }
    this.box.setVisible(true);
    this.label.setVisible(true);
  }

  hide(): void {
    this.box.setVisible(false);
    this.label.setVisible(false);
  }

  get visible(): boolean {
    return this.label.visible;
  }
}
