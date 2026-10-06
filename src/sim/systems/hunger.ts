// Hunger (FR1): every sheep's Fullness drains from fullnessMax to 0 over starveMs, and a sheep
// whose Fullness runs out starves through the single death pipeline.
import { TICK_MS } from '../../config/constants';
import { TUNING } from '../../config/tuning';
import type { GameState } from '../state';
import { killSheep } from './carcass';

const DRAIN_PER_TICK = (TUNING.fullnessMax * TICK_MS) / TUNING.starveMs;

// Float drift: 1 200 subtractions of 100/1 200 leave about 1e-13, not 0, so a plain `<= 0` check
// starves a full sheep one tick late. Anything this close to empty counts as empty.
const FULLNESS_EPSILON = 1e-6;

export function updateHunger(state: GameState): void {
  // killSheep replaces state.sheep, so iterate the start-of-tick array. Deaths happen in array order.
  const sheep = state.sheep;
  for (let i = 0; i < sheep.length; i++) {
    const s = sheep[i];
    s.fullness = Math.max(0, s.fullness - DRAIN_PER_TICK);
    if (s.fullness <= FULLNESS_EPSILON) {
      s.fullness = 0;
      killSheep(state, s.id, 'starved');
    }
  }
}
