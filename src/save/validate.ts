// Save validation (AR9: parse → migrate → validate). Every rule here exists because a bad value
// breaks a system silently: NaN Fullness never starves, a piece outside the inner fence is never
// reached, a duplicate id overwrites another sheep's grid slot. Add a new field's rules in the story
// that adds the field, together with any SAVE_SCHEMA_VERSION bump.
//
// Pure: never mutates its input and never throws. Hand-written guards only (no schema library).
// Unknown extra keys are tolerated and kept: a field a later build added is harmless to this one.
import { TUNING } from '../config/tuning';
import { ERAS, fenceBounds, innerFence, SHOP_ITEMS, shopRequires } from '../sim/selectors';
import type { Era, GameState, SheepActivity, ShopItemId, StalkPhase } from '../sim/state';

export type ValidationResult = { ok: true; state: GameState } | { ok: false; reason: string };

type Obj = Record<string, unknown>;

// `dragged` is never saved (encodeSave writes it as `wander`), so a save holding it is rejected.
const ACTIVITIES: readonly SheepActivity[] = ['wander', 'seekFood', 'seekBreedingFood', 'seekCarcass', 'eating', 'stalking'];
// Story 4.3: how far ahead each phase of the Abomination's visit can end.
const STALK_LENGTH: Readonly<Record<StalkPhase, number>> = {
  approach: TUNING.abominationApproachMaxMs,
  linger: TUNING.abominationLingerMs,
  leave: TUNING.abominationLeaveMs,
};
const STAT_COUNTS = ['died', 'sold', 'sacrificed', 'peakFlock'] as const;
const RNG_MAX = 0xffffffff;
// Ceiling for time, ids and counters: 2^48 ms is about 8 900 years of play, and the headroom up to
// MAX_SAFE_INTEGER keeps them exact as they grow, so an accepted save can always be saved again.
const COUNTER_MAX = 2 ** 48;

/** Thrown inside validation only, to stop at the first bad field; never escapes validateState. */
class Invalid extends Error {}

function fail(reason: string): never {
  throw new Invalid(reason);
}

function isObj(v: unknown): v is Obj {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function finite(o: Obj, key: string, path: string): number {
  const v = o[key];
  if (typeof v !== 'number' || !Number.isFinite(v)) fail(`${path}.${key} is not finite`);
  return v;
}

function int(o: Obj, key: string, path: string, min: number, max = COUNTER_MAX): number {
  const v = o[key];
  if (!Number.isInteger(v) || (v as number) < min || (v as number) > max) {
    fail(`${path}.${key} is not an integer in [${min}, ${max}]`);
  }
  return v as number;
}

function array(o: Obj, key: string): Obj[] {
  const v = o[key];
  if (!Array.isArray(v)) fail(`${key} is not an array`);
  for (let i = 0; i < v.length; i++) if (!isObj(v[i])) fail(`${key}[${i}] is not an object`);
  return v as Obj[];
}

function within(v: number, lo: number, hi: number, what: string): void {
  if (v < lo || v > hi) fail(`${what} is outside the fence`);
}

/** Checks that `x` is a GameState the sim can run. Returns the same object on success. */
export function validateState(x: unknown): ValidationResult {
  try {
    check(x);
    return { ok: true, state: x as GameState };
  } catch (err) {
    if (err instanceof Invalid) return { ok: false, reason: err.message };
    return { ok: false, reason: `validation failed: ${err instanceof Error ? err.message : String(err)}` };
  }
}

function check(x: unknown): void {
  if (!isObj(x)) fail('state is not an object');
  const s = x;
  const time = int(s, 'time', 'state', 0);
  const nextId = int(s, 'nextId', 'state', 1);
  int(s, 'rng', 'state', 0, RNG_MAX);
  int(s, 'farmProgress', 'state', 0, TUNING.farmPipsPerFood - 1);
  int(s, 'breedingProgress', 'state', 0, TUNING.breedingPipsPerFood - 1);
  // FR19: a sacrifice sets the boost at most boostMs ahead; 0 = never. A past deadline is just not
  // boosted, but a far-future one would be an hours-long boost from a corrupt save.
  int(s, 'boostUntil', 'state', 0, time + TUNING.boostMs);
  // FR21: whole dollars, no cap beyond the counter ceiling. Not checked against stats.moneyEarned: the
  // DEV "+$100" button (3.2) adds money that was never earned.
  int(s, 'money', 'state', 0);
  // FR22 / FR23: known one-time items in purchase order, each bought once, every Land tier after the one
  // before it. Not checked against money or earnings (the DEV "+$100" button breaks any such link).
  // Checked before any position: the fence below is derived from the owned land tier (Story 3.3).
  const owned = s.owned;
  if (!Array.isArray(owned)) fail('state.owned is not an array');
  for (let i = 0; i < owned.length; i++) {
    const item = owned[i] as ShopItemId;
    if (typeof item !== 'string' || !SHOP_ITEMS.includes(item)) fail(`state.owned[${i}] is not a known shop item`);
    if (owned.indexOf(item) !== i) fail(`state.owned has ${item} twice`);
    // In purchase order: a tier's prerequisite was bought before it.
    const req = shopRequires(item);
    if (req !== null && !(owned.indexOf(req) >= 0 && owned.indexOf(req) < i)) fail(`state.owned has ${item} before ${req}`);
  }
  if (!ERAS.includes(s.lastEra as Era)) fail('state.lastEra is not a known era');
  // FR29 (Story 4.1): births are counted from 0. The guaranteed birth is any birth number, not checked
  // against the live spawn window: one already passed must stay passed through a retune of the window
  // (Rylan, 4.1 code review), and normalizeTuned moves a pending one into the window.
  if (!isObj(s.abomination)) fail('state.abomination is not an object');
  int(s.abomination, 'birthsSeen', 'abomination', 0);
  int(s.abomination, 'guaranteedAtBirth', 'abomination', 1);
  // FR31 (Story 4.3): set at most a full interval ahead. A due one (≤ time) is fine: the visit waits
  // for a busy Abomination. 0 while none was ever alive.
  int(s.abomination, 'nextKillAt', 'abomination', 0, time + TUNING.abominationKillMaxMs);

  const sheep = array(s, 'sheep');
  const pieces = array(s, 'foodPieces');
  const breedingPieces = array(s, 'breedingPieces');
  const pregnancies = array(s, 'pregnancies');
  const carcasses = array(s, 'carcasses');

  if (!isObj(s.stats)) fail('stats is not an object');
  for (const k of STAT_COUNTS) int(s.stats, k, 'stats', 0);
  const money = finite(s.stats, 'moneyEarned', 'stats');
  if (money < 0 || money > COUNTER_MAX) fail(`stats.moneyEarned is outside [0, ${COUNTER_MAX}]`);
  if ((s.stats.peakFlock as number) < sheep.length) fail('stats.peakFlock is below the flock size');

  if ('lostAt' in s) {
    const lostAt = s.lostAt;
    if (!Number.isInteger(lostAt) || (lostAt as number) < 0 || (lostAt as number) > time) {
      fail('state.lostAt is not an integer in [0, time]');
    }
  } else if (sheep.length === 0) {
    // An empty pen that is not lost would run for ever (1.8 review).
    fail('sheep is empty but the game is not lost');
  } else if (sheep.every((o) => o.isAbomination === true)) {
    // Nor would a pen holding only the Abomination: that is a loss too (Story 4.3 review).
    fail('sheep holds only the Abomination but the game is not lost');
  }

  // The fence is derived from the owned land tier (selectors.ts landTier), validated above; the state is
  // plain data, so this is safe.
  const f = fenceBounds(s as unknown as GameState);
  const inner = innerFence(s as unknown as GameState);
  const ids = new Set<number>();
  let maxId = 0;
  const claimId = (o: Obj, path: string): void => {
    const id = int(o, 'id', path, 1);
    if (ids.has(id)) fail(`${path}.id ${id} is used twice`);
    ids.add(id);
    if (id > maxId) maxId = id;
  };

  let abominations = 0;
  for (let i = 0; i < sheep.length; i++) {
    const o = sheep[i];
    const p = `sheep[${i}]`;
    claimId(o, p);
    const sx = finite(o, 'x', p);
    const sy = finite(o, 'y', p);
    finite(o, 'heading', p);
    finite(o, 'restUntil', p);
    const bornAt = finite(o, 'bornAt', p);
    if (bornAt > time) fail(`${p}.bornAt is after time`);
    const full = finite(o, 'fullness', p);
    if (full < 0 || full > TUNING.fullnessMax) fail(`${p}.fullness is outside [0, ${TUNING.fullnessMax}]`);
    if (!ACTIVITIES.includes(o.activity as SheepActivity)) fail(`${p}.activity is not a known activity`);
    if (typeof o.breedReady !== 'boolean') fail(`${p}.breedReady is not a boolean`);
    // FR29: at most one Abomination is ever alive.
    if (typeof o.isAbomination !== 'boolean') fail(`${p}.isAbomination is not a boolean`);
    if (o.isAbomination && ++abominations > 1) fail(`${p} is a second Abomination`);
    // FR31 (Story 4.3): the visit is the Abomination's only, present exactly while it is stalking, and
    // each phase ends after `time` (the tick that reaches `until` moves it on) within its length. The
    // victim id may name a sheep that is gone, as targetId may: the visit picks another.
    if (o.activity === 'stalking' || 'stalk' in o) {
      if (!o.isAbomination) fail(`${p}.stalk is on a sheep that is not the Abomination`);
      if (o.activity !== 'stalking') fail(`${p}.stalk is set but the activity is not stalking`);
      const st = o.stalk;
      if (!isObj(st)) fail(`${p}.stalk is not an object`);
      // Never its own id (it never visits itself); that the id was issued is checked after nextId below.
      if (int(st, 'victimId', `${p}.stalk`, 1) === o.id) fail(`${p}.stalk.victimId is the Abomination itself`);
      const phase = st.phase as StalkPhase;
      // An own key only: `in` would also accept inherited names such as "constructor".
      if (typeof phase !== 'string' || !Object.hasOwn(STALK_LENGTH, phase)) fail(`${p}.stalk.phase is not a known phase`);
      int(st, 'until', `${p}.stalk`, time + 1, time + STALK_LENGTH[phase]);
    }
    // A victim's delayed death, still ahead (the tick that reaches it kills), at most doomMax away.
    if ('doomedAt' in o) {
      if (o.isAbomination) fail(`${p}.doomedAt is on the Abomination`);
      int(o, 'doomedAt', p, time + 1, time + TUNING.abominationDoomMaxMs);
    }
    // A deadline Breed set at most breedCooldownMs ago, or 0 for never bred.
    const cool = finite(o, 'cooldownUntil', p);
    if (cool < 0 || cool > time + TUNING.breedCooldownMs) fail(`${p}.cooldownUntil is outside [0, time + breedCooldownMs]`);
    // A stale target is fine (feeding reverts the sheep to wander); a malformed one is not.
    if ('targetId' in o) int(o, 'targetId', p, 1);
    // Absent while healthy; infection happens on a tick in the sheep's life, never after `time`, and a
    // saved infection is still running: the virus kills at infectedAt + virusDeathMs (FR15).
    if ('infectedAt' in o) {
      const inf = int(o, 'infectedAt', p, 0, time);
      if (inf < bornAt) fail(`${p}.infectedAt is before bornAt`);
      if (inf + TUNING.virusDeathMs <= time) fail(`${p}.infectedAt is past its virus death`);
    }
    within(sx, f.x, f.x + f.width, `${p}.x`);
    within(sy, f.y, f.y + f.height, `${p}.y`);
  }

  for (let i = 0; i < pieces.length; i++) {
    const o = pieces[i];
    const p = `foodPieces[${i}]`;
    claimId(o, p);
    // createFoodPiece clamps to the inner fence, so a piece outside it could never be reached.
    within(finite(o, 'x', p), inner.left, inner.right, `${p}.x`);
    within(finite(o, 'y', p), inner.top, inner.bottom, `${p}.y`);
  }

  for (let i = 0; i < breedingPieces.length; i++) {
    const o = breedingPieces[i];
    const p = `breedingPieces[${i}]`;
    claimId(o, p);
    // Clamped like food pieces, so one outside the inner fence could never be reached.
    within(finite(o, 'x', p), inner.left, inner.right, `${p}.x`);
    within(finite(o, 'y', p), inner.top, inner.bottom, `${p}.y`);
  }

  for (let i = 0; i < pregnancies.length; i++) {
    const o = pregnancies[i];
    const p = `pregnancies[${i}]`;
    claimId(o, p);
    // Parent ids may name sheep that have since died (the lamb is still born), but must be two sheep;
    // that they were issued is checked after nextId below.
    if (int(o, 'parentB', p, 1) === int(o, 'parentA', p, 1)) fail(`${p}.parentB is the same sheep as parentA`);
    if (finite(o, 'dueAt', p) > time + TUNING.gestationMs) fail(`${p}.dueAt is after time + gestationMs`);
    // Breed clamps the spot to the inner fence, where a lamb born there can move.
    within(finite(o, 'x', p), inner.left, inner.right, `${p}.x`);
    within(finite(o, 'y', p), inner.top, inner.bottom, `${p}.y`);
  }

  for (let i = 0; i < carcasses.length; i++) {
    const o = carcasses[i];
    const p = `carcasses[${i}]`;
    claimId(o, p);
    // Where a sheep died, so inside the inner fence a sheep centre keeps to; one outside it could
    // never be eaten (FR14) and would trap its seeker. Created at a tick time, never later.
    within(finite(o, 'x', p), inner.left, inner.right, `${p}.x`);
    within(finite(o, 'y', p), inner.top, inner.bottom, `${p}.y`);
    int(o, 'createdAt', p, 0, time);
  }

  // After the entities, so a bad entity field is reported rather than the id it happens to use.
  if (nextId <= maxId) fail(`state.nextId ${nextId} is not above every id (max ${maxId})`);
  // A visit's victim id at or above nextId was never issued: the next sheep created would be doomed by it.
  for (let i = 0; i < sheep.length; i++) {
    const st = sheep[i].stalk;
    if (isObj(st) && (st.victimId as number) >= nextId) {
      fail(`sheep[${i}].stalk.victimId ${String(st.victimId)} was never issued (nextId ${nextId})`);
    }
  }
  // A parent id at or above nextId was never issued: the next sheep created would inherit the pregnancy.
  for (let i = 0; i < pregnancies.length; i++) {
    const o = pregnancies[i];
    for (const k of ['parentA', 'parentB'] as const) {
      if ((o[k] as number) >= nextId) fail(`pregnancies[${i}].${k} ${String(o[k])} was never issued (nextId ${nextId})`);
    }
  }
}
