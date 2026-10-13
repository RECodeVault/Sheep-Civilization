import type Phaser from 'phaser';
import { CANVAS_HEIGHT, CANVAS_WIDTH, COMPONENTS, SPACING } from '../../config/constants';
import { formatMoney } from '../../core/format';
import type { StatsView } from '../../sim/selectors';
import { guarded } from '../safetyNet';
import { STRINGS } from '../strings';
import { textStyle } from '../widgets/box';
import { Button } from '../widgets/Button';
import { Panel } from '../widgets/Panel';
import { lineBox, type Modal } from './MenuPanel';

const BUTTON = COMPONENTS.buttonMenu;
const TEXT_COLOR = COMPONENTS.panel.textColor;
// Same frame as the pause panel and the other sub-panels: padding 16, 12 px under the header, 24 px
// above Back.
const PAD = SPACING[4];
const HEADER_GAP = SPACING[3];
const BODY_GAP = SPACING[5];
// Five rows: label (label type) on the left, value (numeric type, UX-DR4) on the right.
const ROW_H = Math.max(lineBox('label'), lineBox('numeric'));
const ROW_GAP = SPACING[2];
const ROWS = 5;
// The least room between a label and its value. A value that would come closer (save validation allows
// counters up to 2^48, 15 digits) shrinks to fit rather than overlap the label.
const MIN_LABEL_GAP = SPACING[3];
// [ASSUMPTION, tune in the browser] The pause panel's width: "Money earned" and a 7-digit amount fit
// side by side with room between.
const WIDTH = BUTTON.width + PAD * 2;
const HEIGHT = PAD + lineBox('title') + HEADER_GAP + ROWS * ROW_H + (ROWS - 1) * ROW_GAP + BODY_GAP + BUTTON.height + PAD;
const X = Math.round((CANVAS_WIDTH - WIDTH) / 2);
const Y = Math.round((CANVAS_HEIGHT - HEIGHT) / 2);

/**
 * The Stats panel (FR36, UX-DR16, Story 5.4), opened from Pause: sheep alive, sold, died, sacrificed
 * and money earned, then Back. Values are right-aligned on a fixed edge so they never jitter (UX-DR5).
 * Built once and hidden; OverlayScene calls `setView` just before showing it. The sim is paused while it
 * is up, so it never needs a live update. It shows `StatsView` only, which never tells the Abomination
 * apart (UX-DR64).
 */
export class StatsPanel implements Modal {
  private readonly panel: Panel;
  private readonly texts: Phaser.GameObjects.Text[] = [];
  // Each value's widest unscaled width before it must shrink: the row less its label and the gap.
  private readonly maxValueW = new Map<Phaser.GameObjects.Text, number>();
  private readonly alive: Phaser.GameObjects.Text;
  private readonly sold: Phaser.GameObjects.Text;
  private readonly died: Phaser.GameObjects.Text;
  private readonly sacrificed: Phaser.GameObjects.Text;
  private readonly moneyEarned: Phaser.GameObjects.Text;
  private readonly back: Button;

  constructor(scene: Phaser.Scene, depth: number, onBack: () => void) {
    const cx = CANVAS_WIDTH / 2;
    this.panel = new Panel(scene).setBounds(X, Y, WIDTH, HEIGHT).setDepth(depth);
    let y = Y + PAD;
    this.texts.push(
      scene.add
        .text(cx, y + lineBox('title') / 2, STRINGS.stats, textStyle('title', TEXT_COLOR))
        .setOrigin(0.5, 0.5)
        .setDepth(depth + 1),
    );
    y += lineBox('title') + HEADER_GAP;

    const row = (label: string): Phaser.GameObjects.Text => {
      const mid = y + ROW_H / 2;
      const labelText = scene.add
        .text(X + PAD, mid, label, textStyle('label', TEXT_COLOR))
        .setOrigin(0, 0.5)
        .setDepth(depth + 1);
      this.texts.push(labelText);
      const value = scene.add
        .text(X + WIDTH - PAD, mid, '', textStyle('numeric', TEXT_COLOR))
        .setOrigin(1, 0.5)
        .setDepth(depth + 1);
      this.texts.push(value);
      // At least 1 px: a label that left no room must not give a zero or negative (mirrored) scale.
      this.maxValueW.set(value, Math.max(1, WIDTH - PAD * 2 - labelText.width - MIN_LABEL_GAP));
      y += ROW_H + ROW_GAP;
      return value;
    };
    this.alive = row(STRINGS.statsAlive);
    this.sold = row(STRINGS.statsSold);
    this.died = row(STRINGS.statsDied);
    this.sacrificed = row(STRINGS.statsSacrificed);
    this.moneyEarned = row(STRINGS.statsMoneyEarned);
    y += BODY_GAP - ROW_GAP;

    this.back = new Button(scene, BUTTON, {
      x: cx - BUTTON.width / 2,
      y,
      width: BUTTON.width,
      label: STRINGS.back,
      labelAlign: 'center',
      activateOn: 'release',
      onActivate: guarded(onBack),
    }).setDepth(depth + 1);
    this.setVisible(false);
  }

  /** Fills the values; each Text is rewritten (and refitted) only when its string changes. */
  setView(view: StatsView): void {
    this.setValue(this.alive, String(view.alive));
    this.setValue(this.sold, String(view.sold));
    this.setValue(this.died, String(view.died));
    this.setValue(this.sacrificed, String(view.sacrificed));
    this.setValue(this.moneyEarned, formatMoney(view.moneyEarned));
  }

  private setValue(t: Phaser.GameObjects.Text, s: string): void {
    if (t.text === s) return;
    t.setText(s);
    // `width` is unscaled, so the scale never compounds. Right-aligned: it shrinks towards the edge.
    t.setScale(Math.min(1, (this.maxValueW.get(t) ?? t.width) / t.width));
  }

  setVisible(visible: boolean): void {
    this.panel.setVisible(visible);
    for (const t of this.texts) t.setVisible(visible);
    this.back.setVisible(visible);
  }
}
