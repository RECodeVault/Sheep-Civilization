import { describe, expect, it } from 'vitest';
import { TICK_MS } from '../../../src/config/constants';
import { TUNING } from '../../../src/config/tuning';
import { drainEvents, type SimEvent } from '../../../src/sim/events';
import { stageOf } from '../../../src/sim/selectors';
import type { GameState } from '../../../src/sim/state';
import { step } from '../../../src/sim/step';
import { newGame } from '../helpers';

/** Steps tick by tick until `untilMs` with every sheep kept full, recording events with their time. */
function runFedUntil(state: GameState, untilMs: number, log: { t: number; e: SimEvent }[]): void {
  while (state.time < untilMs) {
    for (const s of state.sheep) s.fullness = TUNING.fullnessMax;
    step(state);
    drainEvents((e) => log.push({ t: state.time, e }));
  }
}

describe('lifespan scenario (FR6, FR7)', () => {
  it('the founders turn elder at ~4 min and die of old age at ~6 min; the lamb lives on to 7 min', () => {
    const state = newGame(2101);
    const founders = state.sheep.slice(0, TUNING.startFlockAdults);
    const lamb = state.sheep[TUNING.startFlockAdults];
    const elderAt = TUNING.elderFromMs - TUNING.startAdultAgeMs;
    const deathAt = TUNING.oldAgeMs - TUNING.startAdultAgeMs;
    const log: { t: number; e: SimEvent }[] = [];

    expect(stageOf(lamb, state)).toBe('lamb');
    runFedUntil(state, TUNING.lambUntilMs - TICK_MS, log);
    expect(stageOf(lamb, state)).toBe('lamb');
    runFedUntil(state, TUNING.lambUntilMs, log);
    expect(stageOf(lamb, state)).toBe('adult');

    runFedUntil(state, elderAt - TICK_MS, log);
    for (const f of founders) expect(stageOf(f, state)).toBe('adult');
    runFedUntil(state, elderAt, log);
    for (const f of founders) expect(stageOf(f, state)).toBe('elder');
    expect(log).toEqual([]);

    // The lamb (born at 0) turns elder at elderFromMs, between the founders' ageing and death.
    runFedUntil(state, TUNING.elderFromMs - TICK_MS, log);
    expect(stageOf(lamb, state)).toBe('adult');
    runFedUntil(state, TUNING.elderFromMs, log);
    expect(stageOf(lamb, state)).toBe('elder');

    runFedUntil(state, deathAt, log);
    const deaths = log.filter((x) => x.e.type === 'SheepDied');
    expect(deaths.map((x) => x.t)).toEqual([deathAt, deathAt]);
    expect(deaths.map((x) => x.e)).toEqual(
      founders.map((f) => ({ type: 'SheepDied', id: f.id, cause: 'oldAge', x: f.x, y: f.y })),
    );
    expect(log.some((x) => x.e.type === 'Lost')).toBe(false);
    expect(state.sheep.map((s) => s.id)).toEqual([lamb.id]);
    expect(state.lostAt).toBeUndefined();
    expect(JSON.parse(JSON.stringify(state))).toStrictEqual(state);

    // The lamb dies of old age last, at oldAgeMs, and that is the loss.
    runFedUntil(state, TUNING.oldAgeMs, log);
    expect(log.map((x) => x.e.type).slice(-2)).toEqual(['SheepDied', 'Lost']);
    expect(log[log.length - 2]).toEqual({ t: TUNING.oldAgeMs, e: { type: 'SheepDied', id: lamb.id, cause: 'oldAge', x: lamb.x, y: lamb.y } });
  });
});
