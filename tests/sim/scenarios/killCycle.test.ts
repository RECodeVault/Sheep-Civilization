// Story 4.3: the kill cycle in a running pen (FR31). A fed Land I flock with one Abomination, run for
// four minutes: it keeps visiting, every visit makes contact, every victim dies 5–10 s after the linger
// through the death pipeline, and the view never sees a visit.
import { describe, expect, it } from 'vitest';
import { TICK_MS } from '../../../src/config/constants';
import { TUNING } from '../../../src/config/tuning';
import { drainEvents, type SimEvent } from '../../../src/sim/events';
import { publicSheep, selectPublicSheep, type PublicSheep } from '../../../src/sim/selectors';
import type { Sheep } from '../../../src/sim/state';
import { createSheep, type GameState } from '../../../src/sim/state';
import { step } from '../../../src/sim/step';
import { makeAbomination } from '../../../src/sim/systems/abomination';
import { fillFlock, innerFence, newGame } from '../helpers';

const RUN_MS = 240_000;

interface VisitLog {
  /** Game-ms of each approach start, contact (approach → linger) and leave start. */
  approaches: number[];
  contacts: number[];
  leaves: number[];
  /** The victim doomed at each leave, with its doom time. */
  dooms: { id: number; at: number }[];
  /** Every abomination death, with its time. */
  deaths: { id: number; time: number }[];
  maxApproachMs: number;
  publicStalking: number;
  /** The visit phase when the run ended (an approach may still be under way). */
  endPhase: string | undefined;
}

function run(seed: number): VisitLog {
  const state: GameState = newGame(seed);
  state.owned = ['land1'];
  fillFlock(state, 12);
  const r = innerFence(state);
  const abom = createSheep(state, { x: (r.left + r.right) / 2, y: (r.top + r.bottom) / 2, bornAt: state.time });
  makeAbomination(state, abom);
  drainEvents(() => {});
  const rec: VisitLog = { approaches: [], contacts: [], leaves: [], dooms: [], deaths: [], maxApproachMs: 0, publicStalking: 0, endPhase: undefined };
  const pub: PublicSheep[] = [];
  let phase: string | undefined;
  for (let t = 0; t < RUN_MS; t += TICK_MS) {
    // Everyone fed, so the run is about visits, not hunger.
    for (const s of state.sheep) s.fullness = TUNING.fullnessMax;
    step(state);
    drainEvents((e: SimEvent) => {
      if (e.type === 'SheepDied' && e.cause === 'abomination') rec.deaths.push({ id: e.id, time: state.time });
    });
    const now = abom.stalk?.phase;
    if (now !== phase) {
      if (now === 'approach' && phase !== 'approach') rec.approaches.push(state.time);
      if (now === 'linger') {
        rec.contacts.push(state.time);
        rec.maxApproachMs = Math.max(rec.maxApproachMs, state.time - rec.approaches[rec.approaches.length - 1]);
      }
      if (now === 'leave') {
        rec.leaves.push(state.time);
        const v = state.sheep.find((s) => s.id === abom.stalk!.victimId);
        if (v?.doomedAt !== undefined) rec.dooms.push({ id: v.id, at: v.doomedAt });
      }
      phase = now;
    }
    for (const p of selectPublicSheep(state, pub)) if ((p.activity as string) === 'stalking') rec.publicStalking++;
    // AC 8 at every tick: the Abomination's PublicSheep is that of an ordinary newborn lamb with the
    // same fields (wandering, no visit), apart from gait.
    const twin: Sheep = { ...abom, isAbomination: false, bornAt: state.time, activity: abom.activity === 'stalking' ? 'wander' : abom.activity };
    delete twin.stalk;
    const p = pub.find((x) => x.id === abom.id)!;
    expect(p.gait).toBe('offstep');
    expect({ ...p, gait: 'normal' }).toStrictEqual(publicSheep(twin, state));
  }
  expect(state.sheep).toContain(abom);
  rec.endPhase = phase;
  return rec;
}

describe('the kill cycle in a running pen (FR31, Story 4.3)', () => {
  it.each([3, 42, 2026, 31337])('keeps visiting and every victim dies after its visit (seed %i)', (seed) => {
    const rec = run(seed);
    // The first visit comes 45–60 s after the spawn, then at most every 60 s plus the visit itself.
    expect(rec.deaths.length).toBeGreaterThanOrEqual(3);
    // Every approach made contact (none timed out), well inside the approach limit.
    const open = rec.endPhase === 'approach' ? 1 : 0;
    expect(rec.contacts.length).toBe(rec.approaches.length - open);
    expect(rec.maxApproachMs).toBeLessThan(TUNING.abominationApproachMaxMs);
    // Visits are spaced by the kill interval: a contact comes at least KillMin after the previous leave.
    for (let k = 1; k < rec.contacts.length; k++) {
      expect(rec.contacts[k] - rec.leaves[k - 1]).toBeGreaterThanOrEqual(TUNING.abominationKillMinMs);
    }
    // Each visit dooms its victim 5–10 s after the linger, and each abomination death is a doom coming due.
    expect(rec.dooms.length).toBe(rec.leaves.length);
    for (let k = 0; k < rec.leaves.length; k++) {
      expect(rec.dooms[k].at - rec.leaves[k]).toBeGreaterThanOrEqual(TUNING.abominationDoomMinMs);
      expect(rec.dooms[k].at - rec.leaves[k]).toBeLessThanOrEqual(TUNING.abominationDoomMaxMs);
    }
    // Deaths are spaced by the interval too, less the spread of the doom delay: each death is 5–10 s after
    // its leave, and a leave comes at least KillMin + the linger after the one before.
    const minGap = TUNING.abominationKillMinMs + TUNING.abominationLingerMs - (TUNING.abominationDoomMaxMs - TUNING.abominationDoomMinMs);
    for (let k = 1; k < rec.deaths.length; k++) expect(rec.deaths[k].time - rec.deaths[k - 1].time).toBeGreaterThanOrEqual(minGap);
    for (const d of rec.deaths) {
      const doom = rec.dooms.find((x) => x.id === d.id);
      expect(doom).toBeDefined();
      expect(d.time).toBeGreaterThanOrEqual(doom!.at);
      expect(d.time - doom!.at).toBeLessThan(TICK_MS);
    }
    // The view never sees a visit.
    expect(rec.publicStalking).toBe(0);
  });
});
