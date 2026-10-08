import type Phaser from 'phaser';
import type { Rect } from '../../config/tuning';
import { EDGE, maxX, maxY, minX, minY, VIEW_H, VIEW_W } from './layout';

// The view size, the scroll limits and the fit checks live in layout.ts (Story 3.6), Phaser-free.

/**
 * The field camera (Rylan, 2026-10-06): a game starts with the pen and the Better Place centred in the
 * field above the bottom bar, as far as the open shop's limit allows (see centreOn), and a right-drag
 * pans, pinned so the whole play area always stays in view (you cannot drag it away). The play area is the pen plus the drop targets (Story 2.7: the Better
 * Place; 3.1: the Market), so a dragged sheep can always reach them. The Market is in the pinned area
 * but not the centred focus: centring on all three would put the hole under 3.2's shop panel (3.1 Open
 * Question 1). View state only; never saved. The camera shows whole pixels so the pixel art does not
 * shimmer; the exact scroll is kept here, so small scaled pointer steps (a 960 px window moves the
 * pointer in 4/3 px) add up instead of being rounded away. The HUD and Overlay scenes have their
 * own cameras and never move.
 */
export class PenCamera {
  private readonly camera: Phaser.Cameras.Scene2D.Camera;
  /**
   * What the open shop must never cover (Story 3.3): the Better Place. While the whole play area fits
   * right of the panel (no land, Land I) it all stays right of it, as in 3.2; at the larger tiers, too
   * wide for that, only this does, and the pen may slide under the panel.
   */
  private readonly protect: Rect;
  private x = 0;
  private y = 0;

  constructor(camera: Phaser.Cameras.Scene2D.Camera, protect: Rect) {
    this.camera = camera;
    this.protect = protect;
  }

  /**
   * Centres `focus` in the field above the bar, kept within the limits that hold the whole play `area`
   * in view (Story 3.1: the focus is the pen and the Better Place, the area adds the Market). It also
   * keeps the open shop's limit for `leftInset` (GameScene passes the panel's edge), so opening the shop
   * from the opening view never moves it (3.1 Open Question 1; Story 3.3's larger pens). After a pan it
   * may: reclamp then moves only as far as the limit requires.
   */
  centreOn(focus: Rect, area: Rect, leftInset: number = EDGE): void {
    this.x = clamp(focus.x + focus.width / 2 - VIEW_W / 2, minX(area), maxX(area, this.protect, leftInset));
    this.y = clamp(focus.y + focus.height / 2 - VIEW_H / 2, minY(area), maxY(area));
    this.apply();
  }

  /**
   * Moves the view by a screen-space drag of (dx, dy): the field follows the pointer. The area's left edge
   * stays at or right of `leftInset` (the safe edge, or the open shop panel's right edge plus the margin)
   * when the area fits right of it, and otherwise just the protected Better Place does (Stories 3.2, 3.3),
   * so the panel never covers the hole.
   */
  panBy(dx: number, dy: number, area: Rect, leftInset: number = EDGE): void {
    this.x = clamp(this.x - dx, minX(area), maxX(area, this.protect, leftInset));
    this.y = clamp(this.y - dy, minY(area), maxY(area));
    this.apply();
  }

  /**
   * Keeps the current view inside the limits (the shop opened: a new `leftInset`; land grew: a new
   * `area`). Moves only as far as the limits require; no move if inside.
   */
  reclamp(area: Rect, leftInset: number = EDGE): void {
    this.panBy(0, 0, area, leftInset);
  }

  private apply(): void {
    const x = Math.round(this.x);
    const y = Math.round(this.y);
    if (x !== this.camera.scrollX || y !== this.camera.scrollY) this.camera.setScroll(x, y);
  }
}

// An area too big to fit has min > max: centre it on that axis. Every land tier fits, shop open or not
// (GameScene checks fitsView and fitsWithInset in DEV), so this is a guard only.
function clamp(v: number, min: number, max: number): number {
  if (min > max) return (min + max) / 2;
  return v < min ? min : v > max ? max : v;
}
