// View → sim player intents. Commands are applied at the start of the next tick, before step().
import { TUNING } from '../config/tuning';
import { assertNever } from '../core/types';
import type { GameState } from './state';

// Later stories append FarmBreeding, DropFood, ClearCarcass, Breed, Sell, Sacrifice, Buy, …
export type Command = { type: 'Farm' };

export function applyCommand(state: GameState, cmd: Command): void {
  switch (cmd.type) {
    case 'Farm':
      // FR3. Story 1.6 wires the Farm button and F key to this command.
      // Never lowers food that is already above the cap (e.g. an old save after a tuning change).
      if (state.food < TUNING.foodCap) {
        state.food = Math.min(TUNING.foodCap, state.food + TUNING.farmFoodPerClick);
      }
      return;
    default:
      // Narrow on the discriminant: a one-variant union does not narrow `cmd` itself to never.
      assertNever(cmd.type);
  }
}
