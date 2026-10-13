import type Phaser from 'phaser';
import { CANVAS_WIDTH, COMPONENTS, LAYOUT, SPACING, TYPOGRAPHY } from '../../config/constants';
import { ERAS } from '../../sim/selectors';
import type { Era } from '../../sim/state';
import { invariantFits } from '../fonts';
import { STRINGS } from '../strings';
import { boxTexture, textStyle } from '../widgets/box';

const SPEC = COMPONENTS.eraBadge;
// mockups/hud.html `.era-badge`: a 40 px pill with 16 px side padding, top-right at the safe margin. Fixed
// width, so the pill never resizes between eras: wide enough for "Wool Empire" in label type.
// [ASSUMPTION, browser-checked]
export const ERA_BADGE_W = 160;
export const ERA_BADGE_H = 40;
const PAD_X = SPACING[4];
const TEXT_MAX_W = ERA_BADGE_W - PAD_X * 2;

/**
 * The `era-badge` component (UX-DR36): a `dusk` pill naming the current era in `wool`, top-right of the
 * field. It lives in OverlayScene, above the modal scrim and below the panels, so it stays visible under
 * pause, its sub-panels, the start-over confirm and the lose screen (Story 1.10's deferred note). A pill
 * is status, not a button (UX-DR9): not interactive. `set` changes the text only when the era changes.
 * After a font timeout the fallback can be wider: the name shrinks to fit rather than overflow.
 */
export class EraBadge {
  private readonly text: Phaser.GameObjects.Text;
  private shown: Era | null = null;

  constructor(scene: Phaser.Scene, depth: number) {
    const key = boxTexture(scene, ERA_BADGE_W, ERA_BADGE_H, {
      fill: SPEC.backgroundColor,
      border: SPEC.backgroundColor,
      radius: ERA_BADGE_H / 2,
      drop: false,
    });
    // The texture carries DROP_PX of empty space right and below: anchor on the box, not the texture.
    const pill = scene.add.image(-ERA_BADGE_W / 2, -ERA_BADGE_H / 2, key).setOrigin(0, 0);
    this.text = scene.add.text(0, 0, '', textStyle(SPEC.typography, SPEC.textColor)).setOrigin(0.5, 0.5);
    if (import.meta.env.DEV) {
      for (const era of ERAS) {
        this.text.setText(STRINGS.eraName[era]);
        invariantFits(TYPOGRAPHY[SPEC.typography].fontFamily, this.text.width, TEXT_MAX_W, `EraBadge: "${STRINGS.eraName[era]}" does not fit the pill`);
      }
      this.text.setText('');
    }
    scene.add
      .container(CANVAS_WIDTH - LAYOUT.safeMargin - ERA_BADGE_W / 2, LAYOUT.safeMargin + ERA_BADGE_H / 2, [pill, this.text])
      .setDepth(depth);
  }

  /** Names `era`. Does work only when the era changes. */
  set(era: Era): void {
    if (era === this.shown) return;
    this.shown = era;
    this.text.setText(STRINGS.eraName[era]);
    // Only a fallback font (Pixelify Sans timed out) can run past the pill: shrink the name to fit.
    // `width` is the unscaled size, so the scale never compounds.
    this.text.setScale(Math.min(1, TEXT_MAX_W / this.text.width));
  }
}
