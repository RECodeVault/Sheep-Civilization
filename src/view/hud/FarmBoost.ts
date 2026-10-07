import type Phaser from 'phaser';
import { COLOR_INT, COMPONENTS } from '../../config/constants';
import { boxTexture, textStyle } from '../widgets/box';
import { STRINGS } from '../strings';

const SPEC = COMPONENTS.buttonFarmBoosted;
// mockups/hud.html `.btn-farm.boosted`: a 3 px halo ring plus a 16 px soft halo glow. Pixel art has no
// smooth blur, so the glow is stepped bands, outermost first: [px out from the button, alpha].
// [ASSUMPTION, browser-checked]
const GLOW_BANDS: readonly (readonly [number, number])[] = [
  [10, 0.2],
  [6, 0.45],
  [3, 1],
];
const GLOW_OUT = GLOW_BANDS[0][0];
// mockups/hud.html `.boost-badge`: 26 px tall, 8 px side padding, 18 px Pixelify 600, a 2 px halo
// border, poking out 12 px above and 10 px right of the button.
const BADGE_H = 26;
const BADGE_PAD = 8;
const BADGE_FONT_PX = 18;
const BADGE_OUT_TOP = 12;
const BADGE_OUT_RIGHT = 10;
// Above the bar's widgets (depth 0), below the popups and the tooltip.
const BADGE_DEPTH = 1;
// The glow pulses while boosted (UX-DR27). Juice, so Story 5.7's reduced motion may hold it at full.
export const BOOST_MOTION = Object.freeze({ glowMinAlpha: 0.55, glowPulseMs: 600 });

/**
 * The `button-farm-boosted` look (UX-DR27, UX-DR80): a pulsing `halo` glow around the Farm button and
 * a `void` "×2" badge at its top-right, shown while a sacrifice boost runs. Built once by BottomBar
 * **before** the Farm button, so the glow draws under it; the badge sits at a raised depth.
 * `setBoosted` does work only on a change. The button itself is untouched (its squash leaves the glow
 * in place for 80 ms; accepted, Story 2.8 Open Question 4).
 */
export class FarmBoost {
  private readonly scene: Phaser.Scene;
  private readonly glow: Phaser.GameObjects.Image;
  private readonly badge: Phaser.GameObjects.Image;
  private readonly badgeText: Phaser.GameObjects.Text;
  private boosted = false;
  private frozen = false;
  private pulse: Phaser.Tweens.Tween | null = null;

  /** (x, y, w, h) is the Farm button's box in canvas px. */
  constructor(scene: Phaser.Scene, x: number, y: number, w: number, h: number, radius: number) {
    this.scene = scene;
    this.glow = scene.add
      .image(x - GLOW_OUT, y - GLOW_OUT, glowTexture(scene, w, h, radius))
      .setOrigin(0, 0)
      .setVisible(false);
    this.badgeText = scene.add
      .text(0, 0, STRINGS.boostBadge, textStyle('numeric', SPEC.badgeTextColor, BADGE_FONT_PX))
      .setOrigin(0.5, 0.5)
      .setDepth(BADGE_DEPTH + 1)
      .setVisible(false);
    const badgeW = Math.ceil(this.badgeText.width) + BADGE_PAD * 2;
    const right = x + w + BADGE_OUT_RIGHT;
    const top = y - BADGE_OUT_TOP;
    this.badge = scene.add
      .image(right - badgeW, top, boxTexture(scene, badgeW, BADGE_H, { fill: SPEC.badgeColor, border: SPEC.glowColor, radius: BADGE_H / 2, drop: false }))
      .setOrigin(0, 0)
      .setDepth(BADGE_DEPTH)
      .setVisible(false);
    this.badgeText.setPosition(right - badgeW / 2, top + BADGE_H / 2);
  }

  /** Shows or hides the glow and badge; starts or stops the pulse. A no-op unless it changes. */
  setBoosted(on: boolean): void {
    if (on === this.boosted) return;
    this.boosted = on;
    const tweens = this.scene.tweens;
    tweens.killTweensOf(this.glow);
    this.pulse = null;
    this.glow.setAlpha(1).setVisible(on);
    this.badge.setVisible(on);
    this.badgeText.setVisible(on);
    if (!on) return;
    this.pulse = tweens.add({
      targets: this.glow,
      alpha: BOOST_MOTION.glowMinAlpha,
      duration: BOOST_MOTION.glowPulseMs,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
      paused: this.frozen,
    });
  }

  /**
   * Holds the pulse still while the boost is frozen (a modal is open: pause, confirm, lose), so nothing
   * on the HUD moves while the game time does not. A no-op unless it changes.
   */
  setFrozen(frozen: boolean): void {
    if (frozen === this.frozen) return;
    this.frozen = frozen;
    if (this.pulse === null) return;
    if (frozen) this.pulse.pause();
    else this.pulse.resume();
  }
}

/** The stepped glow for a w×h button, baked once and cached across scene restarts (like boxTexture). */
function glowTexture(scene: Phaser.Scene, w: number, h: number, radius: number): string {
  const key = `farm-boost-glow-${w}x${h}-r${radius}`;
  if (!scene.textures.exists(key)) {
    const g = scene.make.graphics({}, false);
    for (const [out, alpha] of GLOW_BANDS) {
      g.fillStyle(COLOR_INT[SPEC.glowColor], alpha);
      g.fillRoundedRect(GLOW_OUT - out, GLOW_OUT - out, w + out * 2, h + out * 2, radius + out);
    }
    g.generateTexture(key, w + GLOW_OUT * 2, h + GLOW_OUT * 2);
    g.destroy();
  }
  return key;
}
