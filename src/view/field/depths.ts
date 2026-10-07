// GameScene's depth bands (UX-DR10 layers 1–2). World entities (sheep, pieces, carcasses) draw at
// depth = y, which stays well below these bands, so lower sprites draw in front. Above them come a
// dragged sheep, then the world-overlay band: hearts and markers, then particles, then alert pings,
// with the sheep tooltip on top. The Better Place sits below the world, as ground decor. The HUD and
// Overlay scenes draw above all of GameScene.
export const FIELD_DEPTH = Object.freeze({
  /** The Better Place's parts (glow, hole, ring, label): ground decor under everything that moves. */
  ground: -10,
  /** A sheep being dragged (Story 2.7): above every world y, under its own hearts and markers. */
  dragged: 9_996,
  /** Ready, pinned and pregnancy hearts and the infection marker. */
  overlay: 9_997,
  /** The munch, poof and dust emitters. */
  particles: 9_998,
  /** Alert pings and their settled dots (UX-DR54). */
  ping: 9_999,
  /** The sheep tooltip. */
  tooltip: 10_000,
} as const);
