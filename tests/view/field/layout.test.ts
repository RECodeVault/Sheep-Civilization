import { describe, expect, it } from 'vitest';
import { TUNING, type Rect } from '../../../src/config/tuning';
import {
  BETTER_PLACE_BOUNDS,
  EDGE,
  ERA_BACKGROUND_BOUNDS,
  fitsView,
  layoutProblems,
  MARKET_BOUNDS,
  playAreaFor,
  SHOP_PANEL_RIGHT,
  VIEW_H,
  VIEW_W,
  viewExtent,
} from '../../../src/view/field/layout';

// Story 3.6 (deferred 3.3, 3.4, 3.5): the field layout checks that ran only when a DEV build loaded
// GameScene now run under npm test, so a retune of TUNING.landFences cannot break the camera fit, the
// decorations or the era background coverage unnoticed. layout.ts is Phaser-free on purpose.

/** The land table with tier `tier`'s fence replaced. */
function withFence(tier: number, fence: Rect): Rect[] {
  return TUNING.landFences.map((f, i) => (i === tier ? fence : f));
}

describe('field layout (Stories 3.3–3.5, checked in npm test since 3.6)', () => {
  it('is sound at every land tier for the current TUNING', () => {
    expect(layoutProblems()).toEqual([]);
  });

  it('checks every tier, not just the first', () => {
    // Not vacuous: the largest tier's play area is the widest, and still fits.
    const areas = TUNING.landFences.map(playAreaFor);
    expect(areas[areas.length - 1].width).toBeGreaterThan(areas[0].width);
    for (const a of areas) expect(fitsView(a)).toBe(true);
  });

  it('reports a fence that reaches the Market', () => {
    const last = TUNING.landFences.length - 1;
    const f = TUNING.landFences[last];
    const problems = layoutProblems(withFence(last, { ...f, width: MARKET_BOUNDS.x - f.x + 10 }));
    expect(problems).toContain(`land tier ${last}: the fence reaches the Market`);
  });

  it('reports a fence that rises into the Better Place and the decorations', () => {
    const f = TUNING.landFences[1];
    const problems = layoutProblems(withFence(1, { ...f, y: BETTER_PLACE_BOUNDS.y + 20, height: f.height + 40 }));
    expect(problems).toContain('land tier 1: the fence reaches the Better Place');
    expect(problems.some((p) => p.startsWith('land tier 1: the fence reaches flowerPatch'))).toBe(true);
  });

  it('reports a play area too big for one screen', () => {
    const problems = layoutProblems(withFence(3, { x: 0, y: 184, width: 1062, height: VIEW_H }));
    expect(problems).toContain('land tier 3: the play area does not fit the field');
  });

  it('keeps the era art over every scroll, shop closed and open', () => {
    for (const f of TUNING.landFences) {
      const area = playAreaFor(f);
      for (const inset of [EDGE, SHOP_PANEL_RIGHT + EDGE]) {
        const v = viewExtent(area, BETTER_PLACE_BOUNDS, inset);
        expect(v.width).toBeGreaterThanOrEqual(VIEW_W);
        expect(v.x).toBeGreaterThanOrEqual(ERA_BACKGROUND_BOUNDS.x);
        expect(v.x + v.width).toBeLessThanOrEqual(ERA_BACKGROUND_BOUNDS.x + ERA_BACKGROUND_BOUNDS.width);
        expect(v.height).toBeGreaterThanOrEqual(VIEW_H);
        expect(v.y).toBeGreaterThanOrEqual(ERA_BACKGROUND_BOUNDS.y);
        expect(v.y + v.height).toBeLessThanOrEqual(ERA_BACKGROUND_BOUNDS.y + ERA_BACKGROUND_BOUNDS.height);
      }
    }
  });
});
