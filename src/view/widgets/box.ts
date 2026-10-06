import type Phaser from 'phaser';
import { COLOR_INT, COLORS, TYPOGRAPHY, type ColorToken, type TypographyToken } from '../../config/constants';

/** UX-DR8: outlines are 2 px; the "drop" sits 2 px right and 2 px down in bark at 40%. */
export const OUTLINE_PX = 2;
export const DROP_PX = 2;
const DROP_ALPHA = 0.4;

export interface BoxStyle {
  fill: ColorToken;
  border: ColorToken;
  /** Corner radius in px (a RADIUS token value, or 0 for square). */
  radius: number;
  /** Pressed and disabled widgets have no drop offset. */
  drop: boolean;
}

/**
 * Returns the key of a texture holding a DESIGN.md box (drop, outline, fill) of `w`×`h` px, plus
 * DROP_PX on the right and bottom for the drop. Widgets show it as an Image: a live Graphics replays
 * and re-tessellates its commands every frame (measured: five HUD Graphics cost ~5 FPS at 100 sheep),
 * so boxes are baked once and cached in the game's TextureManager across scene restarts.
 */
export function boxTexture(scene: Phaser.Scene, w: number, h: number, style: BoxStyle): string {
  const key = `box-${w}x${h}-${style.fill}-${style.border}-r${style.radius}-${style.drop ? 'd' : 'n'}`;
  if (!scene.textures.exists(key)) {
    const g = scene.make.graphics({}, false);
    drawBox(g, w, h, style);
    g.generateTexture(key, w + DROP_PX, h + DROP_PX);
    g.destroy();
  }
  return key;
}

/**
 * Draws a DESIGN.md box (drop, outline, fill) into `g` at (0, 0) with size `w`×`h`, replacing what
 * was there. Prefer `boxTexture` for anything that stays on screen. Corners use `fillRoundedRect`,
 * not pixel-stepped 9-slices (UX-DR9 nice-to-have, left for the art pass).
 */
export function drawBox(g: Phaser.GameObjects.Graphics, w: number, h: number, style: BoxStyle): void {
  const r = style.radius;
  g.clear();
  if (style.drop) {
    g.fillStyle(COLOR_INT.bark, DROP_ALPHA);
    fillRect(g, DROP_PX, DROP_PX, w, h, r);
  }
  // Outline as a filled outer box under an inset fill: crisp at any radius, unlike a stroke.
  g.fillStyle(COLOR_INT[style.border], 1);
  fillRect(g, 0, 0, w, h, r);
  g.fillStyle(COLOR_INT[style.fill], 1);
  fillRect(g, OUTLINE_PX, OUTLINE_PX, w - OUTLINE_PX * 2, h - OUTLINE_PX * 2, Math.max(0, r - OUTLINE_PX));
}

function fillRect(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, r: number): void {
  if (r > 0) g.fillRoundedRect(x, y, w, h, r);
  else g.fillRect(x, y, w, h);
}

/**
 * A Phaser text style for a DESIGN.md typography role. Resolution 1 on purpose (Story 1.5 review
 * decision): the game draws into a fixed 1280×720 nearest-filtered framebuffer, where a
 * devicePixelRatio texture is point-sampled down and looks rougher.
 */
export function textStyle(
  role: TypographyToken,
  color: ColorToken,
  fontSize: number = TYPOGRAPHY[role].fontSize,
): Phaser.Types.GameObjects.Text.TextStyle {
  const t = TYPOGRAPHY[role];
  return {
    fontFamily: t.fontFamily,
    fontSize: `${fontSize}px`,
    fontStyle: String(t.fontWeight),
    color: COLORS[color],
    resolution: 1,
  };
}
