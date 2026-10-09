// The field's fixed layout as plain numbers, and the checks that every land tier keeps it sound
// (Story 3.6; deferred 3.3–3.5 "the layout checks are DEV-only"). No Phaser here, value or type: Vitest
// imports this module (tests/view/field/layout.test.ts), so a retune of TUNING.landFences or new art sizes
// is covered by `npm test`, not only by a DEV build loading GameScene. The view classes (BetterPlace,
// Market, Decorations, EraBackground, Fence, PenCamera, ShopPanel) read their geometry from here.
import { COMPONENTS, LAYOUT, SPACING } from '../../config/constants';
import { TUNING, type Rect } from '../../config/tuning';
import { DECORATIONS, type Decoration } from '../../sim/selectors';

// --- Rect helpers --------------------------------------------------------------------------------

/** True when the two rects overlap (touching edges do not). */
export function intersects(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

/** True when `inner` lies wholly inside `outer`. */
export function contains(outer: Rect, inner: Rect): boolean {
  return (
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.width <= outer.x + outer.width &&
    inner.y + inner.height <= outer.y + outer.height
  );
}

/** The smallest rect holding both. Allocates; called once per game and per land purchase. */
export function union(a: Rect, b: Rect): Rect {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return {
    x,
    y,
    width: Math.max(a.x + a.width, b.x + b.width) - x,
    height: Math.max(a.y + a.height, b.y + b.height) - y,
  };
}

// --- The field camera's view (PenCamera) ---------------------------------------------------------

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
 * True when the x limits for `area` are not crossed with `leftInset` (the open shop's edge): the
 * Better Place `protect` can sit right of it while the area's right edge stays in view. False means
 * clamp would fall back to centring, which breaks both limits (Story 3.3 review).
 */
export function fitsWithInset(area: Rect, protect: Rect, leftInset: number): boolean {
  return minX(area) <= maxX(area, protect, leftInset);
}

/**
 * The world rect the camera can show for `area` (Story 3.5): its whole scroll range, from the limits
 * centreOn and panBy clamp to, plus the field. The layout checks require the era background to cover it
 * at every land tier, shop open and closed. Allocates; checks only.
 */
export function viewExtent(area: Rect, protect: Rect, leftInset: number = EDGE): Rect {
  const x0 = Math.min(minX(area), maxX(area, protect, leftInset));
  const x1 = Math.max(minX(area), maxX(area, protect, leftInset));
  const y0 = Math.min(minY(area), maxY(area));
  const y1 = Math.max(minY(area), maxY(area));
  return { x: x0, y: y0, width: x1 - x0 + VIEW_W, height: y1 - y0 + VIEW_H };
}

// The camera's scroll limits for a play area `p`. Right edge at or left of VIEW_W - EDGE on screen.
// Left: the area's edge at or right of `leftInset` (EDGE, or the open shop's edge plus EDGE) while the
// whole area fits right of it; when it does not, the area's edge at or right of EDGE and the protected
// rect's at or right of `leftInset`. The smaller x scroll is the right-hand limit either way. Same for y
// with EDGE.
export function minX(p: Rect): number {
  return p.x + p.width - VIEW_W + EDGE;
}
export function maxX(p: Rect, protect: Rect, leftInset: number = EDGE): number {
  if (p.width <= VIEW_W - EDGE - leftInset) return p.x - leftInset;
  return Math.min(p.x - EDGE, protect.x - leftInset);
}
export const minY = (p: Rect): number => p.y + p.height - VIEW_H + EDGE;
export const maxY = (p: Rect): number => p.y - EDGE;

// --- The fence (Fence) ---------------------------------------------------------------------------

export const FENCE_PARTS = Object.freeze({
  railThickness: 4,
  railGap: 8, // two rails per side, like the mockup
  postSpacing: 40,
  postHalfWidth: 3, // fence-post frame is 6 px wide
  postRise: 4, // posts stand a little taller than the rails
  postHeight: 22, // fence-post frame is 22 px tall
} as const);

/**
 * Everything a fence with `bounds` draws, posts included: the posts stand postRise above the top rail,
 * reach below the front rails, and the side posts overhang the side rails. For layout checks (the
 * decorations, Story 3.4). Allocates.
 */
export function fenceDrawnBounds({ x, y, width, height }: Rect): Rect {
  const f = FENCE_PARTS;
  const overhang = Math.max(0, f.postHalfWidth - f.railThickness / 2);
  const frontY = y + height - f.railGap - f.railThickness;
  const bottom = Math.max(y + height, frontY - f.postRise + f.postHeight);
  return { x: x - overhang, y: y - f.postRise, width: width + overhang * 2, height: bottom - (y - f.postRise) };
}

// --- The Better Place (BetterPlace) --------------------------------------------------------------

// Placeholder world art is drawn at half size and shown at 2×, like the sheep.
export const WORLD_ART_SCALE = 2;

/**
 * Where the hole is, in world px (UX-DR47) [ASSUMPTION, mockups/hud.html; tune in the browser]. World
 * coordinates equal the mockup's canvas ones, and every land tier's fence (TUNING.landFences) has its top
 * at y 184, under the hole, so the hole stays clear of the fence as it grows (Story 3.3). `hit` is the outer ring: a drop counts
 * when the pointer is inside it (152×70 px, well above hit-min).
 */
export const BETTER_PLACE = Object.freeze({ x: 520, y: 108, hitRx: 76, hitRy: 35 } as const);

/** The hole's hit ellipse (top y 73), dirt ring and label, for the camera's play area (PenCamera). */
export const BETTER_PLACE_BOUNDS: Rect = Object.freeze({ x: 442, y: 72, width: 156, height: 114 });

// The haze glow's drawn size (assets/art/world/better-place-glow.png), shown at WORLD_ART_SCALE around
// the hole. BetterPlace checks the atlas frame against it in DEV.
export const BETTER_PLACE_GLOW_FRAME = Object.freeze({ width: 140, height: 78 } as const);

/**
 * Where the armed glow draws (x 380–660, y 30–186): wider than the hole, so fixed world objects placed
 * near it (the decorations, Story 3.4) keep clear of this, not just of BETTER_PLACE_BOUNDS.
 */
export const BETTER_PLACE_GLOW_BOUNDS: Rect = Object.freeze({
  x: BETTER_PLACE.x - (BETTER_PLACE_GLOW_FRAME.width * WORLD_ART_SCALE) / 2,
  y: BETTER_PLACE.y - (BETTER_PLACE_GLOW_FRAME.height * WORLD_ART_SCALE) / 2,
  width: BETTER_PLACE_GLOW_FRAME.width * WORLD_ART_SCALE,
  height: BETTER_PLACE_GLOW_FRAME.height * WORLD_ART_SCALE,
});

// --- The Market (Market) -------------------------------------------------------------------------

/**
 * Where the stall is, in world px (UX-DR46) [ASSUMPTION, mockups/hud.html mid-drag state; tune in the
 * browser]. World coordinates equal the mockup's canvas ones, so the stall (awning 1100–1260 from y 190,
 * counter down to y 370) stays clear of the Land I fence (x ≤ 1062) when Story 3.3 grows it, and far
 * from the Better Place (x ≤ 598), so a misdrop takes a real drag mistake (DESIGN Layout). `x` is the
 * stall's centre and `bottom` the foot of its counter; `hit` is the mockup's inner drag outline
 * (180×204 px, well above hit-min): a drop counts when the pointer is inside it.
 */
export const MARKET = Object.freeze({
  x: 1180,
  bottom: 372,
  hit: Object.freeze({ x: 1088, y: 178, width: 180, height: 204 }) satisfies Rect,
} as const);

/**
 * Everything the Market can draw, for the camera's pinned play area (PenCamera): the outer outline
 * (1080–1276 × 170–390) and the tag grown on hover above it. It overlaps neither BETTER_PLACE_BOUNDS
 * (x 442–598) nor the Land I fence (x 430–1062).
 */
export const MARKET_BOUNDS: Rect = Object.freeze({ x: 1080, y: 120, width: 196, height: 270 });

// --- The decorations (Decorations) ---------------------------------------------------------------

// Each frame's drawn size (assets/art/world/{flower-patch,scarecrow}.png). Decorations checks it against
// the atlas in DEV, so new art cannot silently outgrow the bounds the layout checks use.
export const DECORATION_FRAME_SIZE: Readonly<Record<Decoration, { readonly width: number; readonly height: number }>> =
  Object.freeze({
    flowerPatch: Object.freeze({ width: 28, height: 14 }),
    scarecrow: Object.freeze({ width: 20, height: 32 }),
  });

/**
 * Where each decoration stands, in world px (FR23) [ASSUMPTION, tune in the browser]: `x` is its centre
 * and `foot` its bottom edge. Both stand in the grass strip between the Better Place's glow (to x 660)
 * and the Market (from x 1080), above the fence: every land tier from Land I has its top rail at y 184
 * (posts to y 180) and fences only grow left and down, so no tier covers them. That strip is always in the
 * camera's play area and right of the open shop panel, and no sheep or piece ever stands there.
 * layoutProblems checks all of this for every tier.
 */
export const DECORATION_SPOTS: Readonly<Record<Decoration, { readonly x: number; readonly foot: number }>> =
  Object.freeze({
    flowerPatch: Object.freeze({ x: 724, foot: 176 }),
    scarecrow: Object.freeze({ x: 1000, foot: 176 }),
  });

/** The rect each decoration is shown in (its frame at WORLD_ART_SCALE, standing on its spot). */
export const DECORATION_BOUNDS: Readonly<Record<Decoration, Rect>> = Object.freeze({
  flowerPatch: shownRect('flowerPatch'),
  scarecrow: shownRect('scarecrow'),
});

function shownRect(d: Decoration): Rect {
  const { x, foot } = DECORATION_SPOTS[d];
  const width = DECORATION_FRAME_SIZE[d].width * WORLD_ART_SCALE;
  const height = DECORATION_FRAME_SIZE[d].height * WORLD_ART_SCALE;
  return Object.freeze({ x: x - width / 2, y: foot - height, width, height });
}

// --- The era backgrounds (EraBackground) ---------------------------------------------------------

/**
 * Each era background's drawn size (assets/art/backgrounds/*.png), shown at `scale` with
 * nearest-neighbour pixels, and the image's top-left in world px. EraBackground checks every texture
 * against the size in DEV, so new art cannot shrink the coverage below. With these numbers it covers
 * x 0–1728 and y −16–672: every point the camera can show at any land tier, shop open or closed
 * (layoutProblems checks it).
 */
export const ERA_BACKGROUND_ART = Object.freeze({ frameW: 864, frameH: 344, scale: 2, originX: 0, originY: -16 } as const);

/** The world rect every era background covers (Story 3.5). */
export const ERA_BACKGROUND_BOUNDS: Rect = Object.freeze({
  x: ERA_BACKGROUND_ART.originX,
  y: ERA_BACKGROUND_ART.originY,
  width: ERA_BACKGROUND_ART.frameW * ERA_BACKGROUND_ART.scale,
  height: ERA_BACKGROUND_ART.frameH * ERA_BACKGROUND_ART.scale,
});

// --- The shop panel (ShopPanel) ------------------------------------------------------------------

/** The shop panel's left edge and width in canvas px: it stands on the bar at the left safe margin. */
export const SHOP_PANEL_X = LAYOUT.safeMargin;
export const SHOP_PANEL_W = COMPONENTS.shopPanel.width;
/** The panel's right edge in canvas px, for the field camera (it keeps the play area right of it). */
export const SHOP_PANEL_RIGHT = SHOP_PANEL_X + SHOP_PANEL_W;
// Geometry from mockups/hud.html `.shop` / `.row` / `.shop-hd` [ASSUMPTION, browser-checked]: a 2 px wood
// border (widgets/box OUTLINE_PX; ShopPanel checks they agree), 16 px padding, the "Shop" header on a
// 20 px line, then the rows SHOP_ROW_GAP apart. Rows are COMPONENTS.shopItemRow.height (50 since 4.7).
export const SHOP_PANEL_BORDER = 2;
export const SHOP_HEADER_H = 20;
export const SHOP_ROW_GAP = 4;
/**
 * The most rows the panel must hold (Story 4.7, Rylan 2026-10-09): Land I–III, two decorations, Better
 * Hoe I–II, the Auto-feeder (Story 4.8) and Medicine.
 */
export const SHOP_PANEL_MAX_ROWS = 9;
/** The highest the panel's top may reach: 8 px below the Pause button at the top-left (HudScene). */
export const SHOP_PANEL_MIN_TOP = LAYOUT.safeMargin + COMPONENTS.buttonPause.height + SPACING[2];

/** The panel's height in canvas px with `rows` rows (it stands on the bar and grows upward). */
export function shopPanelHeight(rows: number): number {
  const p = COMPONENTS.shopPanel.padding;
  return SHOP_PANEL_BORDER + p + SHOP_HEADER_H + rows * (SHOP_ROW_GAP + COMPONENTS.shopItemRow.height) + p;
}

/** The panel's top edge in canvas px with `rows` rows. */
export function shopPanelTop(rows: number): number {
  return LAYOUT.canvasHeight - LAYOUT.hudBarHeight - shopPanelHeight(rows);
}

// --- The checks ----------------------------------------------------------------------------------

/** The play area the camera keeps in view for a fence: the pen, the Better Place and the Market. */
export function playAreaFor(fence: Rect): Rect {
  return union(union(fence, BETTER_PLACE_BOUNDS), MARKET_BOUNDS);
}

/**
 * Every way the layout is broken for the current TUNING.landFences, as messages (empty when sound).
 * Story 3.3: at every land tier the whole play area fits one screen (GDD Camera), so the Market and the
 * Better Place are always in view, also with the shop open (the hole right of the panel); the fence stays
 * clear of the stall and under the hole (the 2 px overlap with its label is the mockup's). Story 3.4: each
 * decoration stays clear of everything every tier's fence draws (posts included) by a 2 px margin, clear
 * of the Better Place (the hole and its armed glow) and the Market, inside the play area (so always in
 * view), and right of the Better Place's left edge, which the open shop keeps right of the panel.
 * Story 3.5: no bare canvas colour at any scroll, shop closed or open. GameScene runs this in DEV, and
 * tests/view/field/layout.test.ts under `npm test`.
 */
export function layoutProblems(fences: readonly Rect[] = TUNING.landFences): string[] {
  const out: string[] = [];
  fences.forEach((f, tier) => {
    const at = `land tier ${tier}`;
    const area = playAreaFor(f);
    if (!fitsView(area)) out.push(`${at}: the play area does not fit the field`);
    if (!fitsWithInset(area, BETTER_PLACE_BOUNDS, SHOP_PANEL_RIGHT + EDGE)) {
      out.push(`${at}: the play area cannot keep the Better Place right of the open shop`);
    }
    for (const inset of [EDGE, SHOP_PANEL_RIGHT + EDGE]) {
      if (!contains(ERA_BACKGROUND_BOUNDS, viewExtent(area, BETTER_PLACE_BOUNDS, inset))) {
        out.push(`${at}: an era background does not cover the view (left inset ${inset})`);
      }
    }
    if (!(f.x + f.width < MARKET_BOUNDS.x)) out.push(`${at}: the fence reaches the Market`);
    if (!(f.y >= BETTER_PLACE_BOUNDS.y + BETTER_PLACE_BOUNDS.height - 2)) out.push(`${at}: the fence reaches the Better Place`);
  });
  for (const d of DECORATIONS) {
    const r = DECORATION_BOUNDS[d];
    if (intersects(r, BETTER_PLACE_BOUNDS)) out.push(`${d} overlaps the Better Place`);
    if (intersects(r, BETTER_PLACE_GLOW_BOUNDS)) out.push(`${d} overlaps the Better Place's glow`);
    if (intersects(r, MARKET_BOUNDS)) out.push(`${d} overlaps the Market`);
    if (r.x < BETTER_PLACE_BOUNDS.x) out.push(`${d} can slide under the open shop`);
    fences.forEach((f, tier) => {
      const drawn = fenceDrawnBounds(f);
      const fence: Rect = { x: drawn.x - 2, y: drawn.y - 2, width: drawn.width + 4, height: drawn.height + 4 };
      if (intersects(r, fence)) out.push(`land tier ${tier}: the fence reaches ${d}`);
      if (!contains(playAreaFor(f), r)) out.push(`land tier ${tier}: ${d} is outside the play area`);
    });
  }
  return out;
}
