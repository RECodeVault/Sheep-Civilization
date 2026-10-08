import { describe, expect, it } from 'vitest';
import { TICK_MS } from '../../../src/config/constants';
import { TUNING } from '../../../src/config/tuning';
import { applyCommand } from '../../../src/sim/commands';
import { drainEvents, type SimEvent } from '../../../src/sim/events';
import { currentEra } from '../../../src/sim/selectors';
import type { GameState } from '../../../src/sim/state';
import { step } from '../../../src/sim/step';
import { fillFlock, newGame, runFor } from '../helpers';

const VILLAGE = TUNING.eraThresholds[0];

function eraEvents(events: readonly SimEvent[]): SimEvent[] {
  return events.filter((e) => e.type === 'EraChanged');
}

/** A seeded game grown to `count` sheep and stepped once, so lastEra matches the flock. */
function grownGame(seed: number, count: number): GameState {
  const state = newGame(seed);
  fillFlock(state, count);
  runFor(state, TICK_MS);
  return state;
}

describe('eras scenario (FR27, FR28)', () => {
  it('epic AC: growing to the Village threshold and dropping one below fires exactly two EraChanged', () => {
    const state = newGame(3505);
    fillFlock(state, VILLAGE);
    const events = runFor(state, TICK_MS);

    // fillFlock adds adults, so the last sheep can be sold (a real removal path).
    applyCommand(state, { type: 'Sell', id: state.sheep[state.sheep.length - 1].id });
    events.push(...runFor(state, TICK_MS));
    expect(state.sheep).toHaveLength(VILLAGE - 1);

    expect(eraEvents(events)).toEqual([
      { type: 'EraChanged', from: 'pasture', to: 'village' },
      { type: 'EraChanged', from: 'village', to: 'pasture' },
    ]);
    expect(state.lastEra).toBe('pasture');
  });

  it('regresses through starvation once, on the tick the flock first drops below the threshold', () => {
    const state = grownGame(3506, VILLAGE);
    expect(state.lastEra).toBe('village');
    // Three sheep starve on three consecutive ticks; the rest are full.
    const drain = (TUNING.fullnessMax * TICK_MS) / TUNING.starveMs;
    for (const s of state.sheep) s.fullness = TUNING.fullnessMax;
    state.sheep[0].fullness = drain * 0.5;
    state.sheep[1].fullness = drain * 1.5;
    state.sheep[2].fullness = drain * 2.5;

    const firstTick = runFor(state, TICK_MS);
    expect(firstTick.filter((e) => e.type === 'SheepDied')).toHaveLength(1);
    expect(eraEvents(firstTick)).toEqual([{ type: 'EraChanged', from: 'village', to: 'pasture' }]);
    // EraChanged comes last: eras is the last system.
    expect(firstTick[firstTick.length - 1].type).toBe('EraChanged');

    const later = runFor(state, 2 * TICK_MS);
    expect(later.filter((e) => e.type === 'SheepDied')).toHaveLength(2);
    expect(eraEvents(later)).toEqual([]);
    expect(state.sheep).toHaveLength(VILLAGE - 3);
  });

  it('advances through a birth, after its LambBorn', () => {
    const state = grownGame(3507, VILLAGE - 1);
    expect(state.lastEra).toBe('pasture');
    // fillFlock's adults (after the three founders) are off cooldown; make two of them ready.
    const a = state.sheep[3];
    const b = state.sheep[4];
    a.breedReady = b.breedReady = true;
    applyCommand(state, { type: 'Breed', a: a.id, b: b.id });
    drainEvents(() => {});
    expect(state.pregnancies).toHaveLength(1);
    // A pending lamb holds a slot but is not alive, so no era change yet.
    expect(currentEra(state)).toBe('pasture');

    const events: SimEvent[] = [];
    let lambTick: SimEvent[] = [];
    // Gestation plus a margin, so a regression fails here instead of hanging.
    const maxTicks = TUNING.gestationMs / TICK_MS + 10;
    for (let t = 0; state.pregnancies.length > 0; t++) {
      if (t >= maxTicks) throw new Error('the lamb was never born');
      for (const s of state.sheep) s.fullness = TUNING.fullnessMax;
      step(state);
      const tick: SimEvent[] = [];
      drainEvents((e) => tick.push(e));
      if (tick.some((e) => e.type === 'LambBorn')) lambTick = tick;
      events.push(...tick);
    }
    expect(eraEvents(events)).toEqual([{ type: 'EraChanged', from: 'pasture', to: 'village' }]);
    const types = lambTick.map((e) => e.type);
    expect(types).toContain('EraChanged');
    expect(types.indexOf('LambBorn')).toBeLessThan(types.indexOf('EraChanged'));
  });

  it('a tick that loses the game emits no EraChanged', () => {
    const state = grownGame(3508, VILLAGE);
    expect(state.lastEra).toBe('village');
    for (const s of state.sheep) s.fullness = 0;

    const events = runFor(state, TICK_MS);
    expect(state.lostAt).toBe(state.time);
    expect(events.filter((e) => e.type === 'Lost')).toHaveLength(1);
    expect(eraEvents(events)).toEqual([]);
    expect(state.lastEra).toBe('village');
  });

  it('is deterministic across a threshold crossing', () => {
    function run(): { state: GameState; events: SimEvent[] } {
      const state = newGame(3509);
      fillFlock(state, VILLAGE - 1);
      const events = runFor(state, 1_000);
      fillFlock(state, VILLAGE);
      events.push(...runFor(state, 5_000));
      return { state, events };
    }
    const first = run();
    const second = run();
    expect(eraEvents(first.events)).toHaveLength(1);
    expect(second).toStrictEqual(first);
  });
});
