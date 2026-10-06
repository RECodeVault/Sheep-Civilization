// Read-only views of GameState. The view layer reads state only through these.
import { TUNING, type Rect } from '../config/tuning';
import type { GameState, Sheep } from './state';

/** The fenced area sheep live in. Epic 3 makes it depend on the land tier. */
export function fenceBounds(_state: GameState): Rect {
  return TUNING.startFence;
}

export type Hunger = 'fed' | 'hungry' | 'starving';

/** FR2: Fed above `fedAbove`, Starving below `starvingBelow`, Hungry in between. Never stored. */
export function hungerOf(fullness: number): Hunger {
  if (fullness > TUNING.fedAbove) return 'fed';
  if (fullness < TUNING.starvingBelow) return 'starving';
  return 'hungry';
}

export type Stage = 'lamb' | 'adult' | 'elder';

/** FR7: stage from age (`state.time - bornAt`). Never stored. Story 2.1 adds the stage rules. */
export function stageOf(s: Sheep, state: GameState): Stage {
  const age = state.time - s.bornAt;
  if (age < TUNING.lambUntilMs) return 'lamb';
  if (age < TUNING.elderFromMs) return 'adult';
  return 'elder';
}

/** The only sheep shape the view may consume. Later stories add name, infected, gait, activity. */
export interface PublicSheep {
  id: number;
  x: number;
  y: number;
  stage: Stage;
  hunger: Hunger;
}

export function publicSheep(s: Sheep, state: GameState): PublicSheep {
  return { id: s.id, x: s.x, y: s.y, stage: stageOf(s, state), hunger: hungerOf(s.fullness) };
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
      p = { id: 0, x: 0, y: 0, stage: 'adult', hunger: 'fed' };
      out[i] = p;
    }
    p.id = s.id;
    p.x = s.x;
    p.y = s.y;
    p.stage = stageOf(s, state);
    p.hunger = hungerOf(s.fullness);
  }
  out.length = sheep.length;
  return out;
}
