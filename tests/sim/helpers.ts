import { TICK_MS } from '../../src/config/constants';
import { TUNING } from '../../src/config/tuning';
import { clearEvents, drainEvents, type SimEvent } from '../../src/sim/events';
import { rngRange } from '../../src/sim/rng';
import { fenceBounds } from '../../src/sim/selectors';
import { createNewGame, createSheep, type GameState } from '../../src/sim/state';
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

/** The rect sheep centres must stay inside: the fence inset by `fenceInset` on every side. */
export function innerFence(state: GameState): { left: number; right: number; top: number; bottom: number } {
  const f = fenceBounds(state);
  const i = TUNING.fenceInset;
  return { left: f.x + i, right: f.x + f.width - i, top: f.y + i, bottom: f.y + f.height - i };
}

/** Adds adults (aged like the founders, at the current time) inside the inner fence until the flock has `count` sheep. */
export function fillFlock(state: GameState, count: number): void {
  const r = innerFence(state);
  while (state.sheep.length < count) {
    createSheep(state, {
      x: rngRange(state, r.left, r.right),
      y: rngRange(state, r.top, r.bottom),
      bornAt: state.time - TUNING.startAdultAgeMs,
    });
  }
}
