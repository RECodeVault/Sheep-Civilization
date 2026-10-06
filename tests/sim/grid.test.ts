import { describe, expect, it } from 'vitest';
import { CANVAS_HEIGHT, CANVAS_WIDTH } from '../../src/config/constants';
import { TUNING } from '../../src/config/tuning';
import { queryNeighbours, rebuildGrid } from '../../src/sim/grid';
import { rngRange } from '../../src/sim/rng';

type Point = { x: number; y: number };

function randomPoints(seed: number, n: number, w = CANVAS_WIDTH, h = CANVAS_HEIGHT): Point[] {
  const r = { rng: seed };
  const pts: Point[] = [];
  for (let i = 0; i < n; i++) pts.push({ x: rngRange(r, 0, w), y: rngRange(r, 0, h) });
  return pts;
}

function bruteForce(pts: readonly Point[], i: number, radius: number): number[] {
  const out: number[] = [];
  for (let j = 0; j < pts.length; j++) {
    if (j === i) continue;
    const dx = pts[i].x - pts[j].x;
    const dy = pts[i].y - pts[j].y;
    if (Math.sqrt(dx * dx + dy * dy) < radius) out.push(j);
  }
  return out;
}

function query(pts: readonly Point[], i: number, radius: number): number[] {
  const out: number[] = [];
  const n = queryNeighbours(pts, i, radius, out);
  return out.slice(0, n).sort((a, b) => a - b);
}

describe('grid', () => {
  it('matches a brute-force search for every sheep (dense and sparse)', () => {
    // Dense: 100 points in a 380×250 pen, so many cells hold several sheep.
    for (const [seed, w, h] of [
      [7, 380, 250],
      [8, CANVAS_WIDTH, CANVAS_HEIGHT],
    ]) {
      const pts = randomPoints(seed, 100, w, h);
      rebuildGrid(pts);
      for (const radius of [TUNING.personalSpacePx, TUNING.gridCellPx]) {
        for (let i = 0; i < pts.length; i++) expect(query(pts, i, radius)).toEqual(bruteForce(pts, i, radius));
      }
    }
  });

  it('finds neighbours across a cell boundary and never returns the sheep itself', () => {
    const c = TUNING.gridCellPx;
    const pts = [
      { x: c - 1, y: 10 },
      { x: c + 1, y: 10 },
      { x: c + 1 + TUNING.personalSpacePx, y: 10 },
    ];
    rebuildGrid(pts);
    expect(query(pts, 0, TUNING.personalSpacePx)).toEqual([1]);
    expect(query(pts, 1, TUNING.personalSpacePx)).toEqual([0]);
  });

  it('handles positions at or beyond the canvas edge', () => {
    const pts = [
      { x: 0, y: 0 },
      { x: -5, y: -5 },
      { x: CANVAS_WIDTH, y: CANVAS_HEIGHT },
      { x: CANVAS_WIDTH + 10, y: CANVAS_HEIGHT + 3 },
    ];
    expect(() => rebuildGrid(pts)).not.toThrow();
    expect(query(pts, 0, TUNING.personalSpacePx)).toEqual([1]);
    expect(query(pts, 2, TUNING.personalSpacePx)).toEqual([3]);
  });

  it('grows past its initial capacity and shrinks back', () => {
    const many = randomPoints(3, 1000);
    rebuildGrid(many);
    expect(query(many, 500, TUNING.gridCellPx)).toEqual(bruteForce(many, 500, TUNING.gridCellPx));
    const few = [
      { x: 100, y: 100 },
      { x: 110, y: 100 },
    ];
    rebuildGrid(few);
    expect(query(few, 0, TUNING.personalSpacePx)).toEqual([1]);
  });

  it('rejects a radius larger than one cell (DEV invariant)', () => {
    rebuildGrid([{ x: 1, y: 1 }]);
    expect(() => queryNeighbours([{ x: 1, y: 1 }], 0, TUNING.gridCellPx + 1, [])).toThrow(/Invariant/);
  });
});
