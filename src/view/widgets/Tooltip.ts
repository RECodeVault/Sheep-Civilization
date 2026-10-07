import Phaser from 'phaser';
import { COLOR_INT, COLORS, COMPONENTS, LAYOUT, RADIUS, SPACING, TYPOGRAPHY } from '../../config/constants';
import { ATLAS, FRAME } from '../assetKeys';

const SPEC = COMPONENTS.tooltip;
const TYPE = TYPOGRAPHY[SPEC.typography];
const PAD = SPEC.padding;
// Gap between the anchor point and the box.
const OFFSET = 6;
// [ASSUMPTION] Widest box before the text wraps, so long copy never runs off the canvas.
const MAX_WIDTH = 360;
// The optional trailing icon (the sheep tooltip's heart outline, FR10) is world art shown at 2×.
const ICON_SCALE = 2;
const ICON_GAP = SPACING[1];

/** UX [ASSUMPTION] "about 300 ms" of hover before any tooltip (sheep or button) shows. View feel. */
export const HOVER_DELAY_MS = 300;

/**
 * The `tooltip` component (DESIGN.md): a dusk-deep box with wool body text. Built once and reused;
 * the background is redrawn only when the text or icon changes, never per frame. Generic: sheep hover
 * uses it in GameScene and the HUD's buttons in HudScene. An optional icon (a `sheep-world` frame)
 * follows the last line of text, e.g. the heart outline of a sheep on breeding cooldown.
 */
export class Tooltip {
  private readonly box: Phaser.GameObjects.Graphics;
  private readonly label: Phaser.GameObjects.Text;
  private readonly icon: Phaser.GameObjects.Image;
  private text = '';
  private iconFrame: string | null = null;
  private width = 0;
  private height = 0;
  // The icon's offset from the box's top-left corner.
  private iconX = 0;
  private iconY = 0;

  constructor(scene: Phaser.Scene, depth: number) {
    // Fixed to the screen: showAt takes screen coordinates and clamps to the canvas, so a scrolled
    // field camera (PenCamera) must not move it. The HUD camera never scrolls, so this is harmless there.
    this.box = scene.add.graphics().setDepth(depth).setScrollFactor(0);
    this.label = scene.add
      .text(0, 0, '', {
        fontFamily: TYPE.fontFamily,
        fontSize: `${TYPE.fontSize}px`,
        fontStyle: String(TYPE.fontWeight),
        color: COLORS[SPEC.textColor],
        wordWrap: { width: MAX_WIDTH - PAD * 2 },
        // Resolution 1 on purpose: the game draws into a fixed 1280×720 framebuffer with nearest
        // filtering (pixelArt), so a devicePixelRatio texture would be point-sampled down and look
        // rougher, not crisper. True HiDPI text needs a higher renderer resolution (architecture).
        resolution: 1,
      })
      .setDepth(depth)
      .setScrollFactor(0);
    this.icon = scene.add
      .image(0, 0, ATLAS.sheepWorld, FRAME.heartOutline)
      .setScale(ICON_SCALE)
      .setOrigin(0, 0.5)
      .setDepth(depth)
      .setScrollFactor(0);
    this.hide();
  }

  setText(text: string): void {
    if (text === this.text) return;
    this.text = text;
    this.label.setText(text);
    this.layout();
  }

  /** Shows `frame` after the last line of text, or no icon for null. Redraws only on a change. */
  setIcon(frame: string | null): void {
    if (frame === this.iconFrame) return;
    this.iconFrame = frame;
    // Keep the left-centre origin: atlas frames carry a 0.5 pivot, which setFrame would apply.
    if (frame !== null) this.icon.setFrame(frame, true, false);
    this.layout();
  }

  private layout(): void {
    const textW = Math.ceil(this.label.width);
    const textH = Math.ceil(this.label.height);
    let w = textW;
    let h = textH;
    if (this.iconFrame !== null) {
      // After the last line: wrapped lines are rare (and this runs on a change only, so the allocation is fine).
      const lines = Math.max(1, this.label.getWrappedText().length);
      const lineH = textH / lines;
      const lastW = lines === 1 ? textW : Math.ceil(this.label.context.measureText(this.lastLine()).width);
      this.iconX = PAD + lastW + ICON_GAP;
      this.iconY = PAD + textH - lineH / 2;
      w = Math.max(textW, lastW + ICON_GAP + Math.ceil(this.icon.displayWidth));
      h = Math.max(textH, Math.ceil(this.icon.displayHeight));
    }
    this.width = w + PAD * 2;
    this.height = h + PAD * 2;
    this.box.clear();
    this.box.fillStyle(COLOR_INT[SPEC.backgroundColor], 1);
    this.box.fillRoundedRect(0, 0, this.width, this.height, RADIUS[SPEC.rounded]);
    // Force showAt to place the label and icon again.
    this.box.setPosition(-1, -1);
  }

  private lastLine(): string {
    const lines = this.label.getWrappedText();
    return lines[lines.length - 1] ?? '';
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
      this.icon.setPosition(left + this.iconX, top + this.iconY);
    }
    this.box.setVisible(true);
    this.label.setVisible(true);
    this.icon.setVisible(this.iconFrame !== null);
  }

  hide(): void {
    this.box.setVisible(false);
    this.label.setVisible(false);
    this.icon.setVisible(false);
  }

  get visible(): boolean {
    return this.label.visible;
  }
}
