// Dragging a sheep (FR16, Story 2.7): the player picks a sheep up and puts it down. Pick-up and drop are
// commands, not a per-tick rule, so this module has no update function (like breeding.ts). It owns the
// `dragged` activity: movement neither steers nor pushes a dragged sheep, and feeding and carcass eating
// never claim for it, but hunger, the virus and old age still run on it.
//
// A dragged sheep keeps its sim position (where it was picked up) until it is dropped; only the view
// draws it at the pointer. So a sheep that dies mid-drag leaves its carcass at the pickup spot, and a
// cancelled drag is a drop back at that spot. A sacrifice (betterPlace.ts) takes a sheep from any
// activity. encodeSave writes `dragged` as `wander`: no drag survives a reload.
import { innerFence, sheepIndex } from '../selectors';
import type { GameState } from '../state';

/** Lifts sheep `id` off the field. Ignores an unknown or already dragged sheep. No rng, no event. */
export function pickUp(state: GameState, id: number): void {
  const i = sheepIndex(state, id);
  if (i < 0) return;
  const s = state.sheep[i];
  if (s.activity === 'dragged') return;
  s.activity = 'dragged';
  // Any claim (a piece or a carcass) is released; the piece is free for another sheep next tick.
  delete s.targetId;
}

/**
 * Puts dragged sheep `id` down at (x, y), clamped to the nearest point a sheep centre may occupy
 * (UX-DR67: a drop outside the fence lands just inside it). Non-finite coordinates keep the current
 * spot. A sheep that is not dragged is ignored: the view is a tick behind, so a stale Drop is harmless.
 */
export function drop(state: GameState, id: number, x: number, y: number): void {
  const i = sheepIndex(state, id);
  if (i < 0) return;
  const s = state.sheep[i];
  if (s.activity !== 'dragged') return;
  // A rare event, so innerFence's allocation is fine.
  const r = innerFence(state);
  if (Number.isFinite(x) && Number.isFinite(y)) {
    s.x = Math.min(r.right, Math.max(r.left, x));
    s.y = Math.min(r.bottom, Math.max(r.top, y));
  }
  s.activity = 'wander';
}
