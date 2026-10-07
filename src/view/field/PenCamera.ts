import type Phaser from 'phaser';
import { LAYOUT } from '../../config/constants';
import type { Rect } from '../../config/tuning';

// The field the camera shows: the canvas above the bottom bar.
export const VIEW_W = LAYOUT.canvasWidth;
export const VIEW_H = LAYOUT.canvasHeight - LAYOUT.hudBarHeight;
// The play area always stays this far inside the visible field.
export const EDGE = LAYOUT.safeMargin;

/** True when `area` fits the visible field inside the safe edge, so it can be held wholly in view. */
export function fitsView(area: Rect): boolean {
  return area.width <= VIEW_W - 2 * EDGE && area.height <= VIEW_H - 2 * EDGE;
}

/**
 * The field camera (Rylan, 2026-10-06): a game starts with the pen and the Better Place centred in the
 * field above the bottom bar, and a right-drag pans, pinned so the whole play area always stays in view
 * (you cannot drag it away). The play area is the pen plus the drop targets (Story 2.7: the Better
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
   * What the open shop must never cover (Story 3.3): the Better Place. The pen itself may slide under the
   * panel at the larger land tiers, which are too wide to fit right of it.
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
   * in view (Story 3.1: the focus is the pen and the Better Place, the area adds the Market). The
   * Better Place also stays at or right of `leftInset` (GameScene passes the open shop's edge), so
   * opening the shop never has to move the view (3.1 Open Question 1; Story 3.3's larger pens).
   */
  centreOn(focus: Rect, area: Rect, leftInset: number = EDGE): void {
    this.x = clamp(focus.x + focus.width / 2 - VIEW_W / 2, minX(area), maxX(area, this.protect, leftInset));
    this.y = clamp(focus.y + focus.height / 2 - VIEW_H / 2, minY(area), maxY(area));
    this.apply();
  }

  /**
   * Moves the view by a screen-space drag of (dx, dy): the field follows the pointer. The area's left edge
   * stays at or right of the safe edge, and the protected Better Place at or right of `leftInset`: the
   * safe edge, or the open shop panel's right edge plus the margin (Stories 3.2, 3.3), so the panel never
   * covers it.
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

// Area left edge at or right of EDGE on screen, and the protected rect's at or right of `leftInset` (EDGE
// unless the shop is open); right edge at or left of VIEW_W - EDGE; same for y with EDGE. The protected
// rect is inside the area, so with the shop closed the area's own edge is the limit.
const minX = (p: Rect): number => p.x + p.width - VIEW_W + EDGE;
const maxX = (p: Rect, protect: Rect, leftInset: number = EDGE): number => Math.min(p.x - EDGE, protect.x - leftInset);
const minY = (p: Rect): number => p.y + p.height - VIEW_H + EDGE;
const maxY = (p: Rect): number => p.y - EDGE;

// An area too big to fit has min > max: centre it on that axis. Every land tier fits (GameScene checks
// in DEV), so this is a guard only.
function clamp(v: number, min: number, max: number): number {
  if (min > max) return (min + max) / 2;
  return v < min ? min : v > max ? max : v;
}
