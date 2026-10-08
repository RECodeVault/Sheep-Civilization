import { describe, expect, it } from 'vitest';
import { TICK_MS } from '../../../src/config/constants';
import { TUNING } from '../../../src/config/tuning';
import { applyCommand, type Command } from '../../../src/sim/commands';
import { drainEvents } from '../../../src/sim/events';
import {
  breedBlock,
  canBreed,
  capacity,
  currentEra,
  eraIndex,
  isOwned,
  onCooldown,
  salePrice,
  shopPrice,
  slotsUsed,
  stageOf,
} from '../../../src/sim/selectors';
import type { GameState } from '../../../src/sim/state';
import { step } from '../../../src/sim/step';
import { newGame } from '../helpers';

// The pacing probe (Story 3.6, Task 4): a scripted "reference player" plays a seeded new game through
// applyCommand only (the commands the view sends), with a fixed click budget, and reports when it first
// bred, reached Village and reached Town. It estimates a tuning candidate in a second instead of a
// 15-minute session. It proposes; Rylan's playtest decides (AC 1). If the two disagree, Rylan's times
// win: change this policy or REFERENCE_CPS, and note it in the story.
//
// The policy, one decision per click (a click is spent only when one is useful):
//   1. clear a carcass at once (it costs a click, as it does a player);
//   2. Farm while the food on the field and in the bar is short of the sheep that could eat a piece
//      without wasting it (Fullness at or below fullnessMax − foodPieceFullness);
//   3. otherwise Farm Breeding Food while the breeding pieces are short of the adults that could use one
//      (not ready, off cooldown) and there is room in the pen for their lambs;
//   4. otherwise rest.
// Free actions, as fast as a player would: breed two ready adults whenever breeding is allowed; once the
// living flock fills the pen, sell the oldest sheep first (elders, then adults) to raise money for Land I and
// buy it, but only when those sales can cover the price. The probe stops at Town, so it never needs Land II
// (the GDD wall: every sale costs era progress). No sacrifices: the boost is a bonus, not the baseline.
//
// Run `npx vitest run tests/sim/scenarios/pacing.test.ts --reporter=verbose` to see the table.

/** Clicks per second the reference player sustains: a comfortable human rate, not a sprint. */
const REFERENCE_CPS = 3;
/**
 * The rate at which this bot, with no boost and no Better Hoe (Should tier), reaches Town in the GDD's
 * 10–15 min (Story 3.6, Rylan 2026-10-08: farmPipsPerFood 6, breedingPipsPerFood 8, Land I $80, Better
 * Hoe stays Should). At 3–5 clicks/s the flock plateaus below 25: feeding and replacing old-age deaths use
 * the whole budget. A player gets there sooner with sacrifice boosts, which the bot never uses.
 */
const TOWN_CPS = 6;
const REPORT_CPS = [2, 3, 5, 6] as const;
const SEED = 3606;
/** The longest a probe plays, in game-ms (GDD: Town by 15 min, with slack). */
const LIMIT_MS = 20 * 60_000;

interface PacingResult {
  cps: number;
  firstBreedingMs: number | null;
  villageMs: number | null;
  townMs: number | null;
  lostMs: number | null;
  /** Clicks spent, the most sheep alive at once, and the run's deaths, sales and births. */
  clicks: number;
  peak: number;
  died: number;
  sold: number;
  births: number;
}

/** The food the bar and the field will provide: pieces down plus a partly filled bar. */
function foodInHand(s: GameState): number {
  return s.foodPieces.length + s.farmProgress / TUNING.farmPipsPerFood;
}

function wouldEatWithoutWaste(s: GameState): number {
  let n = 0;
  for (const sheep of s.sheep) if (sheep.fullness <= TUNING.fullnessMax - TUNING.foodPieceFullness) n++;
  return n;
}

/** Adults that a breeding piece would make ready, capped by the lambs the pen still has room for (2 per). */
function breedingWanted(s: GameState): number {
  let adults = 0;
  for (const sheep of s.sheep) {
    if (!sheep.breedReady && stageOf(sheep, s) === 'adult' && !onCooldown(sheep, s)) adults++;
  }
  const room = Math.max(0, capacity(s) - slotsUsed(s));
  return Math.min(adults, 2 * room);
}

/** The next click, or null when no click is useful this moment. */
function nextClick(s: GameState): Command | null {
  if (s.carcasses.length > 0) return { type: 'ClearCarcass', id: s.carcasses[0].id };
  if (foodInHand(s) < wouldEatWithoutWaste(s)) return { type: 'Farm' };
  if (s.breedingPieces.length + s.breedingProgress / TUNING.breedingPipsPerFood < breedingWanted(s)) {
    return { type: 'FarmBreeding' };
  }
  return null;
}

/** Free actions: breed whenever allowed; at a full pen, sell to buy Land I when the sales can pay for it. */
function freeActions(s: GameState, out: Command[]): void {
  if (breedBlock(s) === null) {
    let a = -1;
    for (const sheep of s.sheep) {
      if (!canBreed(sheep, s)) continue;
      if (a < 0) a = sheep.id;
      else {
        out.push({ type: 'Breed', a, b: sheep.id });
        break;
      }
    }
  }
  // Only once the living flock fills the pen: counting pending lambs (slotsUsed) would sell off the
  // flock one birth before it reaches the era.
  if (isOwned(s, 'land1') || s.sheep.length < capacity(s)) return;
  const price = shopPrice('land1');
  // Oldest first: elders (they die soon anyway), then the oldest adults, until the land is affordable.
  const sales: Command[] = [];
  let money = s.money;
  const sellable = s.sheep.filter((sheep) => stageOf(sheep, s) !== 'lamb').sort((x, y) => x.bornAt - y.bornAt);
  for (const sheep of sellable) {
    if (money >= price) break;
    sales.push({ type: 'Sell', id: sheep.id });
    money += salePrice(stageOf(sheep, s));
  }
  // Never sell the flock off for land it still cannot afford.
  if (money < price) return;
  out.push(...sales, { type: 'Buy', item: 'land1' });
}

function runProbe(cps: number, seed = SEED): PacingResult {
  const s = newGame(seed);
  const r: PacingResult = { cps, firstBreedingMs: null, villageMs: null, townMs: null, lostMs: null, clicks: 0, peak: 0, died: 0, sold: 0, births: 0 };
  let credit = 0;
  const cmds: Command[] = [];
  while (s.time < LIMIT_MS && s.lostAt === undefined && r.townMs === null) {
    credit += (cps * TICK_MS) / 1000;
    cmds.length = 0;
    freeActions(s, cmds);
    for (const c of cmds) applyCommand(s, c);
    while (credit >= 1) {
      const c = nextClick(s);
      if (c === null) break;
      applyCommand(s, c);
      credit -= 1;
      r.clicks++;
    }
    // A player cannot bank idle seconds into a burst later.
    credit = Math.min(credit, 1);
    step(s);
    drainEvents((e) => {
      if (e.type === 'Bred' && r.firstBreedingMs === null) r.firstBreedingMs = s.time;
      if (e.type === 'LambBorn') r.births++;
    });
    const era = eraIndex(currentEra(s));
    if (era >= 1 && r.villageMs === null) r.villageMs = s.time;
    if (era >= 2 && r.townMs === null) r.townMs = s.time;
    if (s.sheep.length > r.peak) r.peak = s.sheep.length;
  }
  if (s.lostAt !== undefined) r.lostMs = s.lostAt;
  r.died = s.stats.died;
  r.sold = s.stats.sold;
  return r;
}

function show(ms: number | null): string {
  if (ms === null) return '—';
  const sec = Math.round(ms / 1000);
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
}

describe('pacing probe: a scripted reference player (Story 3.6)', () => {
  it('reports the milestone times per click rate', { timeout: 60_000 }, () => {
    const results = REPORT_CPS.map((cps) => runProbe(cps));
    const rows = results.map(
      (p) =>
        `${String(p.cps).padStart(3)} cps | bred ${show(p.firstBreedingMs).padStart(5)} | Village ${show(p.villageMs).padStart(5)}` +
        ` | Town ${show(p.townMs).padStart(5)} | lost ${show(p.lostMs).padStart(5)} | peak ${p.peak} | born ${p.births}` +
        ` | died ${p.died} | sold ${p.sold} | clicks ${p.clicks}`,
    );
    console.info(
      `pacing probe (seed ${SEED}; farmPipsPerFood ${TUNING.farmPipsPerFood}, breedingPipsPerFood ${TUNING.breedingPipsPerFood}; GDD: Village 3–5 min, Town 10–15 min)\n${rows.join('\n')}`,
    );
    // Not vacuous: the probe played, bred and grew.
    for (const p of results) {
      expect(p.clicks).toBeGreaterThan(0);
      expect(p.firstBreedingMs).not.toBeNull();
    }
  });

  it('is deterministic: the same seed and click rate give the same times', { timeout: 60_000 }, () => {
    expect(runProbe(REFERENCE_CPS)).toStrictEqual(runProbe(REFERENCE_CPS));
  });

  it('never loses the flock at the reference click rate', { timeout: 60_000 }, () => {
    expect(runProbe(REFERENCE_CPS).lostMs).toBeNull();
  });

  // Story 3.6 Phase C: pacing guards for the tuned numbers (GDD Number Balancing: Village 3–5 min,
  // Town 10–15 min). Each holds on several seeds, not just SEED.
  it('reaches Village in 3–5 min at REFERENCE_CPS', { timeout: 60_000 }, () => {
    for (const seed of [SEED, 11, 2026]) {
      const v = runProbe(REFERENCE_CPS, seed).villageMs;
      expect(v, `seed ${seed}`).not.toBeNull();
      expect(v as number, `seed ${seed}`).toBeGreaterThanOrEqual(3 * 60_000);
      expect(v as number, `seed ${seed}`).toBeLessThanOrEqual(5 * 60_000);
    }
  });

  it('reaches Town in 10–15 min at TOWN_CPS, without boosts or Better Hoe', { timeout: 60_000 }, () => {
    for (const seed of [SEED, 11, 2026]) {
      const t = runProbe(TOWN_CPS, seed).townMs;
      expect(t, `seed ${seed}`).not.toBeNull();
      expect(t as number, `seed ${seed}`).toBeGreaterThanOrEqual(10 * 60_000);
      expect(t as number, `seed ${seed}`).toBeLessThanOrEqual(15 * 60_000);
    }
  });
});
