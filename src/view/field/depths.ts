// GameScene's depth bands (UX-DR10 layers 1–2). World entities (sheep, pieces, carcasses) draw at
// depth = y, which stays well below these bands, so lower sprites draw in front. Above them come the
// screen-fixed shop panel (Story 3.2), a dragged sheep, then the world-overlay band: hearts and markers, then particles, then alert pings,
// with the sheep tooltip on top. The Better Place sits below the world, as ground decor. The decorations
// (Story 3.4) are world objects at depth = their foot's y, like the sheep; they need no band of their own. Under
// everything is the era background (Story 3.5). The HUD and Overlay scenes draw above all of GameScene.
export const FIELD_DEPTH = Object.freeze({
  /**
   * The era background (Story 3.5): under the ground decor, the fence's back rails (0) and every world
   * object. Its crossfade's incoming image uses background + 1.
   */
  background: -100,
  /** The Better Place's parts (glow, hole, ring, label): ground decor under everything that moves. */
  ground: -10,
  /**
   * The shop panel (Story 3.2): screen-fixed, above every world y, below a dragged sheep and the
   * world-overlay band, which must draw over it (UX-DR10, UX-DR63). Its parts use shop and shop + 1–2.
   */
  shop: 9_000,
  /**
   * Hearts and markers of a sheep (or pregnancy) standing under the open shop panel (Story 3.3 review):
   * above every world y, below the panel, so the panel hides them with their sheep. Pings stay above.
   */
  underShop: 8_999,
  /** A sheep being dragged (Story 2.7): above every world y, under its own hearts and markers. */
  dragged: 9_996,
  /** Ready, pinned and pregnancy hearts, the infection marker and the Market's price tag (3.1). */
  overlay: 9_997,
  /** The munch, poof and dust emitters. */
  particles: 9_998,
  /** Alert pings and their settled dots (UX-DR54). */
  ping: 9_999,
  /** The sheep tooltip. */
  tooltip: 10_000,
} as const);
