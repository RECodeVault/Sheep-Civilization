// The Auto-feeder (FR25, GDD Automation Systems, Story 4.8): once bought, it drops 1 food piece next to
// the hungriest sheep every autoFeederIntervalMs. The food is free (Rylan, 2026-10-09): there has been
// no food stock to draw from since 2026-10-06, and its rate (about 4 sheep's worth) is the limit, so a
// growing flock still needs the Farm. Food pieces only: it never makes or reads a breeding piece.
// The clock is derived from `state.time`, not stored: it fires on the tick whose time crosses a multiple
// of the interval (robust to a saved time off the tick grid), so it needs no GameState field.
// The target is the living sheep with the lowest Fullness, ties to the lower index, a dragged one
// skipped; the piece lands autoFeederDropPx from it at a seeded angle (the one rng draw), clamped into
// the pen by createFoodPiece. Who eats it is feeding's claim model, untouched.
// Runs after overcrowding, so it never targets a sheep that died this tick. Never reads a secret
// field; the Abomination is fed like any lamb. Without the item it returns before any work; with it, no
// allocation per tick (the piece is an event, once per interval).
import { TICK_MS } from '../../config/constants';
import { TUNING } from '../../config/tuning';
import { emit } from '../events';
import { rngRange } from '../rng';
import { isOwned } from '../selectors';
import type { GameState } from '../state';
import { createFoodPiece } from './feeding';

export function updateAutoFeeder(state: GameState): void {
  if (!isOwned(state, 'autoFeeder')) return;
  const interval = TUNING.autoFeederIntervalMs;
  if (Math.floor(state.time / interval) === Math.floor((state.time - TICK_MS) / interval)) return;
  const target = hungriest(state);
  if (target < 0) return;
  const s = state.sheep[target];
  const a = rngRange(state, 0, 2 * Math.PI);
  const d = TUNING.autoFeederDropPx;
  const p = createFoodPiece(state, s.x + Math.cos(a) * d, s.y + Math.sin(a) * d);
  emit({ type: 'FoodDropped', id: p.id, x: p.x, y: p.y });
}

/** Index of the living sheep with the lowest Fullness, ties to the lower index; never a dragged one. -1 if none. */
function hungriest(state: GameState): number {
  const sheep = state.sheep;
  let best = -1;
  let bestFull = Infinity;
  for (let i = 0; i < sheep.length; i++) {
    const s = sheep[i];
    if (s.activity === 'dragged') continue;
    if (s.fullness < bestFull) {
      bestFull = s.fullness;
      best = i;
    }
  }
  return best;
}
