import { describe, expect, it } from 'vitest';
import { TICK_MS } from '../../../src/config/constants';
import { TUNING } from '../../../src/config/tuning';
import { drainEvents } from '../../../src/sim/events';
import { rngRange } from '../../../src/sim/rng';
import type { GameState } from '../../../src/sim/state';
import { step } from '../../../src/sim/step';
import { createBreedingPiece, createFoodPiece } from '../../../src/sim/systems/feeding';
import { fillFlock, innerFence, newGame } from '../helpers';

// Story 3.6 (AC 5, Task 3.4): the 300-piece pile the tick benchmark times (tests/perf/tick.bench.ts), run
// for real. Claims must resolve (the evidence for deferred 1.7 "Claims never time out"), every piece is
// eaten at most once, and the state stays JSON-safe mid-run.

const RUN_MS = 120_000;

/** 100 adults at Land III; half hungry (they go for food), half fed (they go for breeding food). */
function pileGame(seed: number): GameState {
  const state = newGame(seed);
  state.owned.push('land1', 'land2', 'land3');
  fillFlock(state, 100);
  state.sheep.forEach((s, i) => {
    s.fullness = i % 2 === 0 ? TUNING.seekBelowFullness - 30 : TUNING.fullnessMax;
    s.breedReady = false;
    s.cooldownUntil = 0;
  });
  const r = innerFence(state);
  for (let i = 0; i < 150; i++) createFoodPiece(state, rngRange(state, r.left, r.right), rngRange(state, r.top, r.bottom));
  for (let i = 0; i < 150; i++) {
    createBreedingPiece(state, rngRange(state, r.left, r.right), rngRange(state, r.top, r.bottom));
  }
  return state;
}

/** The farthest any sheep can be from a piece at Land III (the inner fence's diagonal). */
function diagonalPx(state: GameState): number {
  const r = innerFence(state);
  return Math.hypot(r.right - r.left, r.bottom - r.top);
}

describe('scenario: 100 sheep and a 300-piece mixed pile (Story 3.6)', () => {
  it('every claim resolves within the walk across the pen, and no piece is eaten twice', () => {
    const state = pileGame(3606);
    // A claim held longer than the walk across the whole pen (plus slack for crowding and a munch) is
    // stuck: the case a claim timeout would exist for.
    const walkMs = (diagonalPx(state) / TUNING.walkSpeedPxPerS) * 1000;
    const boundMs = walkMs * 1.5 + TUNING.eatMs;

    const since = new Map<number, { target: number; at: number }>();
    let longestMs = 0;
    const eaten = new Set<number>();
    let eatenCount = 0;
    let claims = 0;

    for (let t = 0; t < RUN_MS / TICK_MS; t++) {
      step(state);
      drainEvents((e) => {
        if (e.type === 'FoodEaten' || e.type === 'BreedingFoodEaten') {
          eaten.add(e.pieceId);
          eatenCount++;
        }
      });
      for (const s of state.sheep) {
        const seeking = s.activity === 'seekFood' || s.activity === 'seekBreedingFood';
        if (!seeking || s.targetId === undefined) {
          since.delete(s.id);
          continue;
        }
        const held = since.get(s.id);
        if (held === undefined || held.target !== s.targetId) {
          since.set(s.id, { target: s.targetId, at: state.time });
          claims++;
        } else {
          longestMs = Math.max(longestMs, state.time - held.at);
        }
      }
      if (t === RUN_MS / TICK_MS / 2) expect(JSON.parse(JSON.stringify(state))).toStrictEqual(state);
    }

    // Not vacuous: both claim passes ran, and most of the pile was eaten.
    expect(claims).toBeGreaterThan(100);
    expect(eatenCount).toBeGreaterThan(150);
    expect(eaten.size).toBe(eatenCount);
    expect(longestMs).toBeLessThan(boundMs);
    expect(JSON.parse(JSON.stringify(state))).toStrictEqual(state);
  });
});
