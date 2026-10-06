// Hunger (FR1): every sheep's Fullness drains from fullnessMax to 0 over starveMs, and a sheep
// whose Fullness runs out starves through the single death pipeline.
import { TICK_MS } from '../../config/constants';
import { TUNING } from '../../config/tuning';
import { FULLNESS_EPSILON } from '../selectors';
import type { GameState } from '../state';
import { killSheep } from './carcass';

const DRAIN_PER_TICK = (TUNING.fullnessMax * TICK_MS) / TUNING.starveMs;

export function updateHunger(state: GameState): void {
  // killSheep replaces state.sheep, so iterate the start-of-tick array. Deaths happen in array order.
  const sheep = state.sheep;
  for (let i = 0; i < sheep.length; i++) {
    const s = sheep[i];
    s.fullness -= DRAIN_PER_TICK;
    // Float drift: 1 200 subtractions of 100/1 200 leave about 1e-13, not 0, so a plain `<= 0`
    // check would starve a full sheep one tick late. Anything this close to empty is empty.
    if (s.fullness <= FULLNESS_EPSILON) {
      s.fullness = 0;
      killSheep(state, s.id, 'starved');
    }
  }
}
