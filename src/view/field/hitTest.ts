// Field hit tests against the rendered sprites, shared by the sheep hover and pointer clicks so they
// agree on what is under the pointer. World coordinates (pointer + camera scroll). Allocates nothing.

// UX-DR90: sheep hit targets are the sprite bounds plus 6 px; other field targets (carcasses) are also
// at least `hit-min` square, via `minHalf`.
const HIT_PAD_PX = 6;

/** What a hit test needs from a drawn sprite. */
export interface HitSprite {
  readonly x: number;
  readonly y: number;
  readonly displayWidth: number;
  readonly displayHeight: number;
}

/** Anything that maps an entity id to its drawn sprite, such as an EntityLayer. */
export interface SpriteLookup {
  spriteFor(id: number): HitSprite | undefined;
}

/**
 * Index in `items` of the front-most entity whose sprite contains (x, y), or -1. The box is the
 * sprite bounds plus HIT_PAD_PX, and at least `minHalf` from the centre on each axis. Lower sprites
 * draw in front (depth = y), so the largest y wins. Entities for which `skip` returns true are ignored.
 */
export function spriteIndexAt(
  items: readonly { readonly id: number }[],
  layer: SpriteLookup,
  x: number,
  y: number,
  minHalf = 0,
  skip?: (id: number) => boolean,
): number {
  let best = -1;
  let bestY = -Infinity;
  for (let i = 0; i < items.length; i++) {
    if (skip !== undefined && skip(items[i].id)) continue;
    const spr = layer.spriteFor(items[i].id);
    if (spr === undefined) continue;
    const halfW = Math.max(spr.displayWidth / 2 + HIT_PAD_PX, minHalf);
    const halfH = Math.max(spr.displayHeight / 2 + HIT_PAD_PX, minHalf);
    if (Math.abs(x - spr.x) <= halfW && Math.abs(y - spr.y) <= halfH && spr.y > bestY) {
      best = i;
      bestY = spr.y;
    }
  }
  return best;
}
