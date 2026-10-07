import { describe, expect, it } from 'vitest';
import { TICK_MS } from '../../../src/config/constants';
import { TUNING } from '../../../src/config/tuning';
import { applyCommand } from '../../../src/sim/commands';
import { drainEvents, type SimEvent } from '../../../src/sim/events';
import type { GameState } from '../../../src/sim/state';
import { step } from '../../../src/sim/step';
import { createFoodPiece } from '../../../src/sim/systems/feeding';
import { fillFlock, innerFence, newGame } from '../helpers';

type Timed = SimEvent & { at: number };

/**
 * Steps `ms` keeping every sheep fed except `hungry`, round-tripping the state through JSON every 100
 * ticks. `beforeTick` runs before each step (to send commands). Returns the state and timed events.
 */
function run(
  state: GameState,
  ms: number,
  hungry: ReadonlySet<number>,
  beforeTick: (s: GameState, events: readonly Timed[]) => void = () => {},
): { state: GameState; events: Timed[] } {
  const events: Timed[] = [];
  let s = state;
  for (let i = 0; i < ms / TICK_MS; i++) {
    for (const sheep of s.sheep) if (!hungry.has(sheep.id)) sheep.fullness = TUNING.fullnessMax;
    beforeTick(s, events);
    step(s);
    drainEvents((e) => events.push({ ...e, at: s.time }));
    if (i % 100 === 0) {
      const copy = JSON.parse(JSON.stringify(s)) as GameState;
      expect(copy).toEqual(s);
      s = copy;
    }
    if (s.lostAt !== undefined) break;
  }
  return { state: s, events };
}

/**
 * A fed flock with two hungry sheep side by side: A about to starve, and B Starving with plenty of
 * Fullness left (it would starve in about 29 s), 30 px away. No food is on the field.
 */
function setup(): { state: GameState; a: number; b: number } {
  const state = newGame(2505);
  fillFlock(state, 6);
  const r = innerFence(state);
  const cx = (r.left + r.right) / 2;
  const cy = (r.top + r.bottom) / 2;
  const [a, b] = [state.sheep[3], state.sheep[4]];
  a.x = cx;
  a.y = cy;
  a.fullness = 0.05;
  b.x = cx + 30;
  b.y = cy;
  b.fullness = TUNING.starvingBelow - 1;
  drainEvents(() => {});
  return { state, a: a.id, b: b.id };
}

describe('the contagion chain (FR12, FR14, FR15)', () => {
  it('death → carcass → a Starving sheep eats it → infected → virus death 20 s later → a new carcass', () => {
    const { state, a, b } = setup();
    const { state: end, events } = run(state, TUNING.virusDeathMs + 5_000, new Set([a, b]));

    const iDied = events.findIndex((e) => e.type === 'SheepDied' && e.id === a);
    expect(events[iDied]).toMatchObject({ cause: 'starved' });
    const spawned = events[iDied + 1];
    expect(spawned.type).toBe('CarcassSpawned');
    const carcassId = spawned.type === 'CarcassSpawned' ? spawned.id : -1;

    const iEaten = events.findIndex((e) => e.type === 'CarcassEaten');
    expect(iEaten).toBeGreaterThan(iDied);
    expect(events[iEaten]).toMatchObject({ sheepId: b, carcassId });
    const infected = events[iEaten + 1];
    expect(infected).toMatchObject({ type: 'Infected', id: b });

    const iVirus = events.findIndex((e) => e.type === 'SheepDied' && e.id === b);
    expect(events[iVirus]).toMatchObject({ cause: 'virus', at: infected.at + TUNING.virusDeathMs });
    const next = events[iVirus + 1];
    expect(next.type).toBe('CarcassSpawned');
    expect(next.type === 'CarcassSpawned' ? next.id : -1).not.toBe(carcassId);
    expect(end.carcasses).toHaveLength(1);
    expect(end.lostAt).toBeUndefined();
  });

  it('clearing the carcass while a sheep walks to it prevents the infection', () => {
    const { state, a, b } = setup();
    let cleared = false;
    let releasedAfterClear = false;
    // Until B has died (it starves without the carcass), bounded by a full starvation.
    const { state: end, events } = run(state, TUNING.starveMs, new Set([a, b]), (s) => {
      const sb = s.sheep.find((x) => x.id === b);
      if (sb === undefined) return;
      if (!cleared && sb.activity === 'seekCarcass' && sb.targetId !== undefined) {
        applyCommand(s, { type: 'ClearCarcass', id: sb.targetId });
        cleared = true;
      } else if (cleared && sb.activity === 'wander') {
        releasedAfterClear = true;
      }
    });
    expect(cleared).toBe(true);
    expect(releasedAfterClear).toBe(true);
    expect(events.some((e) => e.type === 'Infected' || e.type === 'CarcassEaten')).toBe(false);
    // B was never infected: it starved instead, leaving the only carcass.
    expect(events.find((e) => e.type === 'SheepDied' && e.id === b)).toMatchObject({ cause: 'starved' });
    expect(end.carcasses).toHaveLength(1);
  });

  it('a food piece landing while a sheep walks to a carcass sends it to the food instead', () => {
    const { state, a, b } = setup();
    let dropped = false;
    let switched = false;
    const { state: end, events } = run(state, 10_000, new Set([a, b]), (s) => {
      const sb = s.sheep.find((x) => x.id === b);
      if (sb === undefined) return;
      if (!dropped && sb.activity === 'seekCarcass') {
        createFoodPiece(s, sb.x + 40, sb.y + 20);
        dropped = true;
      } else if (dropped && !switched && sb.activity === 'seekFood') {
        switched = true;
      }
    });
    expect(dropped).toBe(true);
    expect(switched).toBe(true);
    expect(events).toContainEqual(expect.objectContaining({ type: 'FoodEaten', sheepId: b }));
    expect(events.some((e) => e.type === 'CarcassEaten' || e.type === 'Infected')).toBe(false);
    expect(end.carcasses).toHaveLength(1);
  });

  it('food comes first: with a food piece on the field the Starving sheep eats the food, not the carcass', () => {
    const { state, a, b } = setup();
    const sb = state.sheep.find((s) => s.id === b);
    if (sb === undefined) throw new Error('no B');
    // Nearer B than A, so the piece's nearest hungry sheep is B.
    createFoodPiece(state, sb.x + 20, sb.y);
    let seekedCarcass = false;
    const { state: end, events } = run(state, 10_000, new Set([a, b]), (s) => {
      if (s.sheep.some((x) => x.activity === 'seekCarcass')) seekedCarcass = true;
    });
    expect(events).toContainEqual(expect.objectContaining({ type: 'FoodEaten', sheepId: b }));
    expect(events.some((e) => e.type === 'CarcassEaten' || e.type === 'Infected')).toBe(false);
    expect(seekedCarcass).toBe(false);
    expect(end.carcasses).toHaveLength(1);
  });
});
