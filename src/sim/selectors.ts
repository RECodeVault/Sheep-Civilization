// Read-only views of GameState. The view layer reads state only through these.
import { TUNING, type Rect } from '../config/tuning';
import type { GameState, Sheep } from './state';

/** The fenced area sheep live in. Epic 3 makes it depend on the land tier. */
export function fenceBounds(_state: GameState): Rect {
  return TUNING.startFence;
}

/** The only sheep shape the view may consume. Later stories add stage, hunger, gait, activity. */
export interface PublicSheep {
  id: number;
  x: number;
  y: number;
}

export function publicSheep(s: Sheep, _state: GameState): PublicSheep {
  return { id: s.id, x: s.x, y: s.y };
}

/**
 * Fills `out` with one PublicSheep per living sheep, reusing the objects already in `out` so a
 * per-frame call allocates nothing unless the flock has grown. Returns `out`.
 */
export function selectPublicSheep(state: GameState, out: PublicSheep[]): PublicSheep[] {
  const sheep = state.sheep;
  for (let i = 0; i < sheep.length; i++) {
    const s = sheep[i];
    let p = out[i];
    if (p === undefined) {
      p = { id: 0, x: 0, y: 0 };
      out[i] = p;
    }
    p.id = s.id;
    p.x = s.x;
    p.y = s.y;
  }
  out.length = sheep.length;
  return out;
}
