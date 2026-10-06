// Uniform spatial grid for neighbour queries (architecture: Movement and Flock Spacing). It is
// derived scratch data, not state: it lives in module scope like the event queue, is never saved,
// and is rebuilt from the sheep positions at the start of every movement tick.
//
// Results are indices into the array passed to rebuildGrid (state.sheep). They are valid only until
// that array changes: a system that runs after a death has filtered state.sheep must rebuild first.
import { CANVAS_HEIGHT, CANVAS_WIDTH } from '../config/constants';
import { TUNING } from '../config/tuning';
import { invariant } from '../core/invariant';

interface Point {
  readonly x: number;
  readonly y: number;
}

// The grid covers the whole canvas, so a growing fence (Epic 3) needs no change here. Positions
// outside the canvas fall into the edge cells.
const CELL = TUNING.gridCellPx;
const COLS = Math.ceil(CANVAS_WIDTH / CELL);
const ROWS = Math.ceil(CANVAS_HEIGHT / CELL);

// Counting sort: cellStart[c]..cellStart[c + 1] is the slice of `items` holding cell c's indices.
const cellStart = new Int32Array(COLS * ROWS + 1);
const fill = new Int32Array(COLS * ROWS);
let cellOf = new Int32Array(128);
let items = new Int32Array(128);

function col(x: number): number {
  const c = Math.floor(x / CELL);
  return c < 0 ? 0 : c >= COLS ? COLS - 1 : c;
}

function row(y: number): number {
  const r = Math.floor(y / CELL);
  return r < 0 ? 0 : r >= ROWS ? ROWS - 1 : r;
}

/** Re-buckets every position. Allocates only when the flock outgrows the index arrays. */
export function rebuildGrid(points: readonly Point[]): void {
  const n = points.length;
  if (n > items.length) {
    let size = items.length;
    while (size < n) size *= 2;
    cellOf = new Int32Array(size);
    items = new Int32Array(size);
  }
  cellStart.fill(0);
  for (let i = 0; i < n; i++) {
    const c = row(points[i].y) * COLS + col(points[i].x);
    cellOf[i] = c;
    cellStart[c + 1]++;
  }
  for (let c = 0; c < COLS * ROWS; c++) {
    cellStart[c + 1] += cellStart[c];
    fill[c] = cellStart[c];
  }
  for (let i = 0; i < n; i++) items[fill[cellOf[i]]++] = i;
}

/**
 * Writes into `out[0..count)` the indices of every point other than `i` closer than `radius` to
 * point `i`, scanning only the 3×3 cells around it, and returns `count`. Entries past `count` are
 * stale; `out` is meant to be one reused array.
 */
export function queryNeighbours(points: readonly Point[], i: number, radius: number, out: number[]): number {
  // A 3×3 scan finds everything only up to one cell of radius. The message is built only on failure,
  // so the hot path allocates nothing.
  if (radius > CELL) invariant(false, `queryNeighbours: radius ${radius} > cell ${CELL}`);
  const px = points[i].x;
  const py = points[i].y;
  const cx = col(px);
  const cy = row(py);
  const r2 = radius * radius;
  let count = 0;
  for (let gy = cy - 1; gy <= cy + 1; gy++) {
    if (gy < 0 || gy >= ROWS) continue;
    for (let gx = cx - 1; gx <= cx + 1; gx++) {
      if (gx < 0 || gx >= COLS) continue;
      const c = gy * COLS + gx;
      for (let k = cellStart[c]; k < cellStart[c + 1]; k++) {
        const j = items[k];
        if (j === i) continue;
        const dx = points[j].x - px;
        const dy = points[j].y - py;
        if (dx * dx + dy * dy < r2) out[count++] = j;
      }
    }
  }
  return count;
}
