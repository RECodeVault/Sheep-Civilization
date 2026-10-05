import { TICK_MS } from '../../src/config/constants';
import { clearEvents, drainEvents, type SimEvent } from '../../src/sim/events';
import { createNewGame, type GameState } from '../../src/sim/state';
import { step } from '../../src/sim/step';

/** A fresh game with an empty event queue. Seeds are fixed literals so tests are deterministic. */
export function newGame(seed = 1234): GameState {
  clearEvents();
  return createNewGame(seed);
}

/** Steps the sim for `ms` of game time and returns every event emitted along the way. */
export function runFor(state: GameState, ms: number): SimEvent[] {
  if (ms % TICK_MS !== 0) throw new Error(`runFor: ${ms} ms is not a multiple of TICK_MS (${TICK_MS})`);
  const events: SimEvent[] = [];
  for (let i = 0; i < ms / TICK_MS; i++) {
    step(state);
    drainEvents((e) => events.push(e));
  }
  return events;
}
