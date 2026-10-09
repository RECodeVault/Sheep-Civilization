import type Phaser from 'phaser';
import { COLOR_INT, COMPONENTS, LAYOUT, RADIUS, SPACING, TYPOGRAPHY } from '../../config/constants';
import { textStyle } from '../widgets/box';

const SPEC = COMPONENTS.caption;
// UX-DR45: `duskDeep` at 85% behind the text (the text itself stays opaque).
const BG_ALPHA = 0.85;
// UX-DR45: about 2.5 s on screen, at most 2 at once (a third replaces the oldest).
export const CAPTION_MS = 2_500;
const MAX_CAPTIONS = 2;
// [ASSUMPTION, tune in the browser] A quick fade out at the end of the 2.5 s.
const FADE_MS = 200;
// [ASSUMPTION] Padding inside the box, and the gaps: above the bar, and between two captions.
const PAD_X = SPACING[3];
const PAD_Y = SPACING[1];
const GAP = SPACING[2];
const BOX_H = Math.ceil(TYPOGRAPHY[SPEC.typography].fontSize * TYPOGRAPHY[SPEC.typography].lineHeight) + PAD_Y * 2;
// The bottom bar's top edge (UX-DR10 layer 3: captions sit bottom-centre, above the bar).
const BAR_TOP = LAYOUT.canvasHeight - LAYOUT.hudBarHeight;

interface Slot {
  readonly box: Phaser.GameObjects.Graphics;
  readonly text: Phaser.GameObjects.Text;
  /** Order shown, to find the oldest; 0 = free. */
  shownSeq: number;
}

/**
 * The `caption` component (UX-DR45, UX-DR88; Story 5.6): bracketed audio captions bottom-centre above
 * the bar, raised by AudioDirector when captions are on. Two pooled boxes built once; the box is
 * redrawn only when a caption is shown (an event, never per frame). Not interactive, so it never
 * blocks a click. HudScene rebuilds it on every restart, so old captions never carry over.
 */
export class Captions {
  private readonly scene: Phaser.Scene;
  private readonly slots: Slot[] = [];
  private seq = 0;

  constructor(scene: Phaser.Scene, depth: number) {
    this.scene = scene;
    for (let i = 0; i < MAX_CAPTIONS; i++) {
      const box = scene.add.graphics().setDepth(depth).setVisible(false);
      const text = scene.add
        .text(0, 0, '', textStyle(SPEC.typography, SPEC.textColor))
        .setOrigin(0.5, 0.5)
        .setDepth(depth)
        .setVisible(false);
      this.slots.push({ box, text, shownSeq: 0 });
    }
  }

  /** Shows `text` as the newest caption, replacing the oldest when both are up. */
  show(text: string): void {
    let slot = this.slots[0];
    for (const s of this.slots) {
      if (s.shownSeq === 0) {
        slot = s;
        break;
      }
      if (s.shownSeq < slot.shownSeq) slot = s;
    }
    const tweens = this.scene.tweens;
    tweens.killTweensOf([slot.box, slot.text]);
    slot.shownSeq = ++this.seq;
    slot.text.setText(text);
    const w = Math.ceil(slot.text.width) + PAD_X * 2;
    slot.box.clear();
    slot.box.fillStyle(COLOR_INT[SPEC.backgroundColor], BG_ALPHA);
    slot.box.fillRoundedRect(-w / 2, -BOX_H / 2, w, BOX_H, RADIUS[SPEC.rounded]);
    for (const o of [slot.box, slot.text]) o.setAlpha(1).setVisible(true);
    tweens.add({
      targets: [slot.box, slot.text],
      alpha: 0,
      delay: CAPTION_MS - FADE_MS,
      duration: FADE_MS,
      onComplete: () => {
        slot.shownSeq = 0;
        slot.box.setVisible(false);
        slot.text.setVisible(false);
        this.layout();
      },
    });
    this.layout();
  }

  // The newest just above the bar, an older one stacked above it.
  private layout(): void {
    const x = LAYOUT.canvasWidth / 2;
    let row = 0;
    // Newest first: at most two slots, so a pairwise order is enough (no sort, no array).
    const [a, b] = this.slots;
    const order = a.shownSeq >= b.shownSeq ? [a, b] : [b, a];
    for (const s of order) {
      if (s.shownSeq === 0) continue;
      const y = BAR_TOP - GAP - BOX_H / 2 - row * (BOX_H + GAP);
      s.box.setPosition(x, y);
      s.text.setPosition(x, y);
      row++;
    }
  }
}
