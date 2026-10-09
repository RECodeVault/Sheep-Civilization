import { describe, expect, it } from 'vitest';
import { TICK_MS } from '../../../src/config/constants';
import { TUNING } from '../../../src/config/tuning';
import { applyCommand } from '../../../src/sim/commands';
import { drainEvents, type SimEvent } from '../../../src/sim/events';
import { shopPrice } from '../../../src/sim/selectors';
import type { GameState } from '../../../src/sim/state';
import { step } from '../../../src/sim/step';
import { fillFlock, innerFence, newGame } from '../helpers';

type Timed = SimEvent & { at: number };

/**
 * The contagion chain's start (as tests/sim/scenarios/virus.test.ts): A is about to starve and B is
 * Starving 30 px away with no food on the field, so B eats A's carcass and is infected. The rest of
 * the flock is fed.
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

/**
 * Runs `ms` with every sheep but A and B kept fed. With `treat`, once B is infected the player buys a
 * dose (money set by hand) and drops it on B, through the real commands.
 */
function run(treat: boolean, ms: number): { state: GameState; events: Timed[]; b: number } {
  const { state, a, b } = setup();
  const events: Timed[] = [];
  let treated = false;
  for (let i = 0; i < ms / TICK_MS; i++) {
    for (const s of state.sheep) if (s.id !== a && s.id !== b) s.fullness = TUNING.fullnessMax;
    if (treat && !treated && events.some((e) => e.type === 'Infected' && e.id === b)) {
      state.money = shopPrice('medicine');
      applyCommand(state, { type: 'Buy', item: 'medicine' });
      applyCommand(state, { type: 'ApplyMedicine', id: b });
      treated = true;
    }
    step(state);
    drainEvents((e) => events.push({ ...e, at: state.time }));
    if (state.lostAt !== undefined) break;
  }
  return { state, events, b };
}

describe('medicine breaks the contagion chain (FR15, FR26)', () => {
  it('a treated sheep survives its virus window; the same sheep untreated dies of the virus', () => {
    const ms = TUNING.virusDeathMs + 5_000;
    const untreated = run(false, ms);
    const treated = run(true, ms);

    // Untreated: B dies of the virus and leaves a new carcass (the chain goes on).
    expect(untreated.events).toContainEqual(expect.objectContaining({ type: 'SheepDied', id: untreated.b, cause: 'virus' }));
    expect(untreated.state.carcasses).toHaveLength(1);

    // Treated: infected, then cured, then never a virus death; the only carcass was eaten.
    const iInfected = treated.events.findIndex((e) => e.type === 'Infected' && e.id === treated.b);
    const iCured = treated.events.findIndex((e) => e.type === 'Cured' && e.id === treated.b);
    expect(iInfected).toBeGreaterThanOrEqual(0);
    expect(iCured).toBeGreaterThan(iInfected);
    expect(treated.events.some((e) => e.type === 'SheepDied' && e.id === treated.b)).toBe(false);
    expect(treated.state.sheep.some((s) => s.id === treated.b && s.infectedAt === undefined)).toBe(true);
    expect(treated.state.carcasses).toHaveLength(0);
    expect(treated.state.medicine).toBe(0);
  });
});
