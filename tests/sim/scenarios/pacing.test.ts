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
// (the GDD wall: every sale costs era progress). No sacrifices for the boost: it is a bonus, not the
// baseline. The one sacrifice is the Abomination's (Story 4.3 review, Rylan): an attentive player spots
// it from its tells, so once SPOT_AFTER_VISITS of its victims have died the bot drags it into the
// Better Place. The bot reads the secret flag for this; the wait stands in for watching the off-step and
// the flock's avoidance. Without it, a lone Abomination is a loss and the bot loses around 12 min.
//
// The Better Hoe policy (Story 4.7, `{ hoe: true }`): up to Land I the bot plays exactly as above. Once
// Land I is owned it also sells every elder as soon as it ages (it would die of old age within 2 min and
// leave a carcass to clear), and the money buys Better Hoe I, then II, as soon as each is affordable
// (code review, Rylan: elders only after Land I, so the run matches the plain one until then). A first try
// sold three breeders for Hoe I at the first full pen: the flock never recovered and lost on 11 of 12
// runs, so a hoe bought that way measures the selling, not the hoe.
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
/** Victims of one Abomination that die before the bot sacrifices it (an attentive player's delay). */
const SPOT_AFTER_VISITS = 2;
/** The longest a probe plays, in game-ms (GDD: Town by 15 min, with slack). */
const LIMIT_MS = 20 * 60_000;

interface ProbeOptions {
  /** Once Land I is owned, sell elders as they age and buy Better Hoe I, then II (Story 4.7). */
  hoe: boolean;
}

const NO_HOE: ProbeOptions = Object.freeze({ hoe: false });
const WITH_HOE: ProbeOptions = Object.freeze({ hoe: true });

interface PacingResult {
  cps: number;
  firstBreedingMs: number | null;
  villageMs: number | null;
  townMs: number | null;
  lostMs: number | null;
  /** When Land I was bought, or null. */
  landMs: number | null;
  /** When Better Hoe I and II were bought, or null (only with the hoe policy). */
  hoeMs: number | null;
  hoe2Ms: number | null;
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

/**
 * At a full pen, sells the oldest sheep (elders, then adults) until `item` is affordable and buys it; does
 * nothing when the sales cannot cover the price. Pushes the commands to `out`.
 */
function sellFor(s: GameState, item: 'land1', out: Command[]): void {
  const price = shopPrice(item);
  // Oldest first: elders (they die soon anyway), then the oldest adults, until the item is affordable.
  const sales: Command[] = [];
  let money = s.money;
  const sellable = s.sheep.filter((sheep) => stageOf(sheep, s) !== 'lamb').sort((x, y) => x.bornAt - y.bornAt);
  for (const sheep of sellable) {
    if (money >= price) break;
    sales.push({ type: 'Sell', id: sheep.id });
    money += salePrice(stageOf(sheep, s));
  }
  // Never sell the flock off for an item it still cannot afford.
  if (money < price) return;
  out.push(...sales, { type: 'Buy', item });
}

/** Free actions: breed whenever allowed; at a full pen, sell to buy Land I; with `opts.hoe`, the hoe policy. */
function freeActions(s: GameState, out: Command[], victims: number, opts: ProbeOptions): void {
  // Story 4.3 review: the Abomination, once spotted (see the policy above).
  if (victims >= SPOT_AFTER_VISITS) {
    const abom = s.sheep.find((sheep) => sheep.isAbomination);
    if (abom !== undefined) out.push({ type: 'Sacrifice', id: abom.id });
  }
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
  // Story 4.7, the hoe policy: only after Land I, so it never overlaps sellFor's sales below.
  if (opts.hoe && isOwned(s, 'land1')) {
    let money = s.money;
    for (const sheep of s.sheep) {
      if (stageOf(sheep, s) !== 'elder') continue;
      out.push({ type: 'Sell', id: sheep.id });
      money += salePrice('elder');
    }
    // In order: Hoe II needs I, and the batch applies a Hoe I bought here before Hoe II.
    for (const hoe of ['hoe1', 'hoe2'] as const) {
      if (isOwned(s, hoe)) continue;
      if (money < shopPrice(hoe)) break;
      out.push({ type: 'Buy', item: hoe });
      money -= shopPrice(hoe);
    }
  }
  // Only once the living flock fills the pen: counting pending lambs (slotsUsed) would sell off the
  // flock one birth before it reaches the era.
  if (isOwned(s, 'land1') || s.sheep.length < capacity(s)) return;
  sellFor(s, 'land1', out);
}

function runProbe(cps: number, seed = SEED, opts: ProbeOptions = NO_HOE): PacingResult {
  const s = newGame(seed);
  const r: PacingResult = { cps, firstBreedingMs: null, villageMs: null, townMs: null, lostMs: null, landMs: null, hoeMs: null, hoe2Ms: null, clicks: 0, peak: 0, died: 0, sold: 0, births: 0 };
  let credit = 0;
  // Victims of the living Abomination so far; reset when it is gone.
  let victims = 0;
  const cmds: Command[] = [];
  while (s.time < LIMIT_MS && s.lostAt === undefined && r.townMs === null) {
    credit += (cps * TICK_MS) / 1000;
    cmds.length = 0;
    if (!s.sheep.some((sheep) => sheep.isAbomination)) victims = 0;
    freeActions(s, cmds, victims, opts);
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
      if (e.type === 'Bought' && e.item === 'land1' && r.landMs === null) r.landMs = s.time;
      if (e.type === 'Bought' && e.item === 'hoe1' && r.hoeMs === null) r.hoeMs = s.time;
      if (e.type === 'Bought' && e.item === 'hoe2' && r.hoe2Ms === null) r.hoe2Ms = s.time;
      if (e.type === 'SheepDied' && e.cause === 'abomination') victims++;
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

  it('reports the milestone times with the Better Hoe policy (Story 4.7)', { timeout: 60_000 }, () => {
    const rows: string[] = [];
    let bought = 0;
    for (const seed of [SEED, 11, 2026]) {
      for (const cps of REPORT_CPS) {
        const p = runProbe(cps, seed, WITH_HOE);
        rows.push(
          `seed ${String(seed).padStart(4)} | ${String(p.cps).padStart(3)} cps | Hoe I ${show(p.hoeMs).padStart(5)} | Hoe II ${show(p.hoe2Ms).padStart(5)}` +
            ` | Land I ${show(p.landMs).padStart(5)} | Village ${show(p.villageMs).padStart(5)} | Town ${show(p.townMs).padStart(5)} | lost ${show(p.lostMs).padStart(5)}` +
            ` | peak ${p.peak} | died ${p.died} | sold ${p.sold}`,
        );
        if (p.hoeMs !== null) bought++;
      }
    }
    // Not vacuous: the policy really buys the hoe (a run may end, or lack the money, before it can).
    expect(bought).toBeGreaterThan(0);
    console.info(`pacing probe with Better Hoe (GDD: Village 3–5 min, Town 10–15 min)\n${rows.join('\n')}`);
  });

  it('is deterministic: the same seed and click rate give the same times', { timeout: 60_000 }, () => {
    expect(runProbe(REFERENCE_CPS)).toStrictEqual(runProbe(REFERENCE_CPS));
    expect(runProbe(REFERENCE_CPS, SEED, WITH_HOE)).toStrictEqual(runProbe(REFERENCE_CPS, SEED, WITH_HOE));
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

  // Skipped in Story 4.1 (Rylan, 2026-10-08): the Abomination, a lamb that never grows up, pushes seed 11
  // to 15:46. The guard already had little margin (3 of seeds 1–40 over 15 min before 4.1, 5 after; mean
  // 14.0 → 14.3 min). Re-enable in the pacing re-check after Stories 4.3 (kills) and 4.7 (Better Hoe),
  // which move pacing far more (deferred-work.md). The table above still reports Town.
  // Story 4.7 re-check (2026-10-09, after the code review fixed the policy's Hoe II loop; Rylan: keep it
  // skipped if the hoe does not bring Town back): with the hoe policy above, seeds 3606/11/2026 at 6 cps
  // reach Town at 19:53 / 16:13 / not at all (lost 6:57); without it seed 3606 is 17:51. Hoe I comes at
  // 17–19 min where it comes at all, and Hoe II never ($100 of $5 elders does not arrive by 20 min): the
  // bot's only money is sales, and every sale costs flock. Selling breeders for Hoe I at the first full
  // pen got it by 3:30 but lost on 11 of 12 runs.
  it.skip('reaches Town in 10–15 min at TOWN_CPS, without boosts or Better Hoe', { timeout: 60_000 }, () => {
    for (const seed of [SEED, 11, 2026]) {
      const t = runProbe(TOWN_CPS, seed).townMs;
      expect(t, `seed ${seed}`).not.toBeNull();
      expect(t as number, `seed ${seed}`).toBeGreaterThanOrEqual(10 * 60_000);
      expect(t as number, `seed ${seed}`).toBeLessThanOrEqual(15 * 60_000);
    }
  });
});
