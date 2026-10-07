// GameScene's depth bands (UX-DR10 layers 1–2). World entities (sheep, pieces, carcasses) draw at
// depth = y, which stays well below these bands, so lower sprites draw in front. Everything above
// them is the world-overlay band: hearts and markers, then particles, then alert pings, with the
// sheep tooltip on top. The HUD and Overlay scenes draw above all of GameScene.
export const FIELD_DEPTH = Object.freeze({
  /** Ready, pinned and pregnancy hearts and the infection marker. */
  overlay: 9_997,
  /** The munch, poof and dust emitters. */
  particles: 9_998,
  /** Alert pings and their settled dots (UX-DR54). */
  ping: 9_999,
  /** The sheep tooltip. */
  tooltip: 10_000,
} as const);
