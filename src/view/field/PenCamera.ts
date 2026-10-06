import type Phaser from 'phaser';
import { LAYOUT } from '../../config/constants';
import type { Rect } from '../../config/tuning';

// The field the camera shows: the canvas above the bottom bar.
const VIEW_W = LAYOUT.canvasWidth;
const VIEW_H = LAYOUT.canvasHeight - LAYOUT.hudBarHeight;
// The pen always stays this far inside the visible field.
const EDGE = LAYOUT.safeMargin;

/**
 * The field camera (Rylan, 2026-10-06): a game starts with the pen centred in the field above the
 * bottom bar, and a right-drag pans, pinned so the whole pen always stays in view (you cannot drag it
 * away). View state only; never saved. The camera shows whole pixels so the pixel art does not
 * shimmer; the exact scroll is kept here, so small scaled pointer steps (a 960 px window moves the
 * pointer in 4/3 px) add up instead of being rounded away. The HUD and Overlay scenes have their
 * own cameras and never move.
 */
export class PenCamera {
  private readonly camera: Phaser.Cameras.Scene2D.Camera;
  private x = 0;
  private y = 0;

  constructor(camera: Phaser.Cameras.Scene2D.Camera) {
    this.camera = camera;
  }

  /** Centres `pen` in the field above the bar. */
  centreOn(pen: Rect): void {
    this.x = clamp(pen.x + pen.width / 2 - VIEW_W / 2, minX(pen), maxX(pen));
    this.y = clamp(pen.y + pen.height / 2 - VIEW_H / 2, minY(pen), maxY(pen));
    this.apply();
  }

  /** Moves the view by a screen-space drag of (dx, dy): the field follows the pointer. */
  panBy(dx: number, dy: number, pen: Rect): void {
    this.x = clamp(this.x - dx, minX(pen), maxX(pen));
    this.y = clamp(this.y - dy, minY(pen), maxY(pen));
    this.apply();
  }

  private apply(): void {
    const x = Math.round(this.x);
    const y = Math.round(this.y);
    if (x !== this.camera.scrollX || y !== this.camera.scrollY) this.camera.setScroll(x, y);
  }
}

// Pen left edge at or right of EDGE on screen, right edge at or left of VIEW_W - EDGE; same for y.
const minX = (p: Rect): number => p.x + p.width - VIEW_W + EDGE;
const maxX = (p: Rect): number => p.x - EDGE;
const minY = (p: Rect): number => p.y + p.height - VIEW_H + EDGE;
const maxY = (p: Rect): number => p.y - EDGE;

// A pen too big to fit (later land tiers) has min > max: centre it on that axis.
function clamp(v: number, min: number, max: number): number {
  if (min > max) return (min + max) / 2;
  return v < min ? min : v > max ? max : v;
}
