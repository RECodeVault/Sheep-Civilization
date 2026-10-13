import type Phaser from 'phaser';
import { COMPONENTS, TYPOGRAPHY } from '../../config/constants';
import { formatMoney } from '../../core/format';
import { invariantFits } from '../fonts';
import { reducedMotion } from '../settings';
import { textStyle } from '../widgets/box';

const SPEC = COMPONENTS.moneyCounter;
// Just "$" and the number, no coin (Rylan, 2026-10-07; the mockup's `.readout` had one): left-aligned
// at the slot's start, so it sits against Breed and only its right end moves as digits change. The slot
// fits "$99999" (80 px in Nunito 800, measured; GDD: money stays in the hundreds), so the counter never
// reaches the flock counter after it. [ASSUMPTION, browser-checked]
const BOX_W = 80;
// A change shows on the frame it happens (AC 1): the roll starts one 60 Hz frame in, and each shown value
// is rounded toward the target, so the first frame already moves by at least $1.
const FIRST_STEP_MS = 16;
/** The counter's width in canvas px, for the bar's layout. */
export const MONEY_COUNTER_W = BOX_W;
// "The money counter ticks down" (EXPERIENCE Component Patterns): the shown number rolls to a new
// balance, up for a sale and down for a purchase. Juice: under reduced motion (Story 5.7) the new balance
// shows at once. [ASSUMPTION]
export const MONEY_MOTION = Object.freeze({ rollMs: 300 });

/**
 * The `money-counter` component (UX-DR34): "${n}" in `numeric` `bark`, read-only, with no coin icon
 * (Rylan, 2026-10-07). The sim changes `money` at once; the display rolls from what it shows to the new
 * balance over `MONEY_MOTION.rollMs` (ease-out), from the frame clock, and calls setText only when the
 * shown whole number changes. The first `set` shows the balance at once (load, restart, Continue).
 */
export class MoneyCounter {
  private readonly text: Phaser.GameObjects.Text;
  private target = Number.NaN;
  private from = 0;
  private startedAt = 0;
  private rolling = false;
  private shown = Number.NaN;

  /** (x, centreY): the counter's left edge and vertical centre in canvas px. */
  constructor(scene: Phaser.Scene, x: number, centreY: number) {
    this.text = scene.add
      .text(x, centreY, formatMoney(99999), textStyle(SPEC.typography, SPEC.textColor))
      .setOrigin(0, 0.5);
    invariantFits(TYPOGRAPHY[SPEC.typography].fontFamily, this.text.width, BOX_W, 'MoneyCounter: "$99999" does not fit its box');
  }

  /** Shows `money` (rolling to it after the first call); `now` is the frame clock in ms. */
  set(money: number, now: number): void {
    if (Number.isNaN(this.target)) {
      this.target = money;
      this.show(money);
      return;
    }
    if (money !== this.target && reducedMotion()) {
      this.target = money;
      this.rolling = false;
      this.show(money);
      return;
    }
    if (money !== this.target) {
      // A new change mid-roll starts from what is on screen, so the number never jumps.
      this.from = this.shown;
      this.target = money;
      this.startedAt = now - FIRST_STEP_MS;
      this.rolling = true;
    }
    if (!this.rolling) return;
    const t = Math.min(1, (now - this.startedAt) / MONEY_MOTION.rollMs);
    const eased = 1 - (1 - t) * (1 - t);
    if (t >= 1) this.rolling = false;
    const v = this.from + (this.target - this.from) * eased;
    this.show(this.target > this.from ? Math.ceil(v) : Math.floor(v));
  }

  private show(n: number): void {
    if (n === this.shown) return;
    this.shown = n;
    this.text.setText(formatMoney(n));
  }
}
