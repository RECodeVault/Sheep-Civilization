// Save validation (AR9: parse → migrate → validate). Every rule here exists because a bad value
// breaks a system silently: NaN Fullness never starves, a piece outside the inner fence is never
// reached, a duplicate id overwrites another sheep's grid slot. Add a new field's rules in the story
// that adds the field, together with any SAVE_SCHEMA_VERSION bump.
//
// Pure: never mutates its input and never throws. Hand-written guards only (no schema library).
// Unknown extra keys are tolerated and kept: a field a later build added is harmless to this one.
import { TUNING } from '../config/tuning';
import { fenceBounds, innerFence } from '../sim/selectors';
import type { Era, GameState, SheepActivity } from '../sim/state';

export type ValidationResult = { ok: true; state: GameState } | { ok: false; reason: string };

type Obj = Record<string, unknown>;

const ACTIVITIES: readonly SheepActivity[] = ['wander', 'seekFood', 'seekBreedingFood', 'seekCarcass', 'eating'];
const ERAS: readonly Era[] = ['pasture', 'village', 'town', 'wool-empire'];
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
  if (!ERAS.includes(s.lastEra as Era)) fail('state.lastEra is not a known era');

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
  }

  // The fence is derived from state (land tier in Epic 3); the state is plain data, so this is safe.
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
  // A parent id at or above nextId was never issued: the next sheep created would inherit the pregnancy.
  for (let i = 0; i < pregnancies.length; i++) {
    const o = pregnancies[i];
    for (const k of ['parentA', 'parentB'] as const) {
      if ((o[k] as number) >= nextId) fail(`pregnancies[${i}].${k} ${String(o[k])} was never issued (nextId ${nextId})`);
    }
  }
}
