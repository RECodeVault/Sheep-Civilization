import { describe, expect, it } from 'vitest';
import { TICK_MS } from '../../../src/config/constants';
import { TUNING } from '../../../src/config/tuning';
import type { SimEvent } from '../../../src/sim/events';
import { publicSheep, stageOf } from '../../../src/sim/selectors';
import type { GameState } from '../../../src/sim/state';
import { innerFence, newGame, runFor } from '../helpers';

/** Puts a lamb on the way from the two founding adults, due on the next tick (as breed() stores it). */
function dueNextTick(state: GameState): void {
  const [a, b] = state.sheep;
  const r = innerFence(state);
  state.pregnancies.push({
    id: state.nextId++,
    parentA: a.id,
    parentB: b.id,
    dueAt: state.time + TICK_MS,
    x: Math.min(r.right, Math.max(r.left, (a.x + b.x) / 2)),
    y: Math.min(r.bottom, Math.max(r.top, (a.y + b.y) / 2)),
  });
}

/** One birth through lifecycle.ts, with the flock kept fed. Returns the tick's events. */
function birth(state: GameState): SimEvent[] {
  for (const s of state.sheep) s.fullness = TUNING.fullnessMax;
  dueNextTick(state);
  return runFor(state, TICK_MS);
}

describe('the Abomination is born (FR29, FR30, Story 4.1)', () => {
  it('is the lamb of the guaranteed birth, through real pregnancies, and its LambBorn looks like any other', () => {
    const state = newGame(99);
    const g = state.abomination.guaranteedAtBirth;
    const shapes: string[][] = [];
    for (let n = 1; n <= g; n++) {
      const events = birth(state);
      const born = events.filter((e) => e.type === 'LambBorn');
      expect(born).toHaveLength(1);
      shapes.push(Object.keys(born[0]).sort());
      const lamb = state.sheep[state.sheep.length - 1];
      expect(lamb.isAbomination).toBe(n === g);
      expect(state.abomination.birthsSeen).toBe(n);
    }
    // The same event shape for every birth, the Abomination's included: the view learns nothing.
    for (const keys of shapes) expect(keys).toEqual(shapes[0]);
    expect(state.sheep.filter((s) => s.isAbomination)).toHaveLength(1);
  });

  it('never grows up: still a lamb in the sim and in PublicSheep long after lambUntilMs', () => {
    const state = newGame(99);
    const g = state.abomination.guaranteedAtBirth;
    for (let n = 1; n <= g; n++) birth(state);
    const abom = state.sheep.find((s) => s.isAbomination)!;
    for (let t = 0; t < TUNING.lambUntilMs * 2; t += 10_000) {
      for (const s of state.sheep) s.fullness = TUNING.fullnessMax;
      runFor(state, 10_000);
    }
    expect(state.sheep).toContain(abom);
    expect(state.time - abom.bornAt).toBeGreaterThan(TUNING.lambUntilMs);
    expect(stageOf(abom, state)).toBe('lamb');
    expect(publicSheep(abom, state)).toMatchObject({ stage: 'lamb', ready: false, canBreed: false, gait: 'offstep' });
  });
});
