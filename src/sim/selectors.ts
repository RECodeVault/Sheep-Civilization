// Read-only views of GameState. The view layer reads state only through these.
import { TUNING, type Rect } from '../config/tuning';
import { assertNever } from '../core/types';
import type { BreedingPiece, Carcass, Era, FoodPiece, GameState, Pregnancy, Sheep, SheepActivity, ShopItemId, ShopRowId } from './state';

/** A land tier: 0 before any land, then 1–3 for Land I–III (FR22). Indexes TUNING's land table. */
export type LandTier = 0 | 1 | 2 | 3;

/** True for the shop's Land tiers (FR22), as opposed to the decorations. */
export function isLand(item: ShopRowId): boolean {
  return item === 'land1' || item === 'land2' || item === 'land3';
}

/** A cosmetic shop item (FR23): owned, drawn, no effect. */
export type Decoration = 'flowerPatch' | 'scarecrow';

/** The decorations, in shop order. The view draws each one owned (Story 3.4). */
export const DECORATIONS: readonly Decoration[] = Object.freeze(['flowerPatch', 'scarecrow']);

/** True for the shop's decorations (FR23), as opposed to the Land tiers. */
export function isDecoration(item: ShopRowId): item is Decoration {
  return item === 'flowerPatch' || item === 'scarecrow';
}

/** Better Hoe I and II (FR24, Story 4.7). */
export type Hoe = 'hoe1' | 'hoe2';

/**
 * True for Better Hoe I and II (FR24, Story 4.7): neither Land nor a decoration, so buying one moves no
 * fence and drops nothing. Today only the "every item is classified" test uses it; the click value reads
 * the tier (hoeTier).
 */
export function isHoe(item: ShopRowId): item is Hoe {
  return item === 'hoe1' || item === 'hoe2';
}

/**
 * The highest Land tier owned (Story 3.3). Derived from `owned`, never stored. Save validation and the
 * shop's lock guarantee every lower tier is owned too. Movement calls this every tick (via fenceBounds),
 * so it is a plain loop: no allocation.
 */
export function landTier(state: GameState): LandTier {
  const owned = state.owned;
  let tier: LandTier = 0;
  for (let i = 0; i < owned.length; i++) {
    const item = owned[i];
    if (item === 'land3') return 3;
    if (item === 'land2') tier = 2;
    else if (item === 'land1' && tier < 1) tier = 1;
  }
  return tier;
}

/**
 * The fenced area sheep live in, for the owned land tier (FR22, UX-DR49). Each tier's fence contains
 * the one before, so it only grows. A frozen TUNING rect: no allocation.
 */
export function fenceBounds(state: GameState): Rect {
  return TUNING.landFences[landTier(state)];
}

/** Edges of the area a sheep centre (and so a food piece) may occupy: the fence inset by fenceInset. */
export interface InnerFence {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/** Allocates; for events (piece creation), not per-tick loops. Movement inlines the same rect. */
export function innerFence(state: GameState): InnerFence {
  const f = fenceBounds(state);
  const i = TUNING.fenceInset;
  return { left: f.x + i, right: f.x + f.width - i, top: f.y + i, bottom: f.y + f.height - i };
}

export type Hunger = 'fed' | 'hungry' | 'starving';

/**
 * Float tolerance for Fullness comparisons. The per-tick drain (100/1 200) is not exact, so a value
 * that should be exactly 50 or 25 reads 50.0000000000016 or 24.9999999999993, and an empty sheep
 * reads about 1e-13. Values this close to a bound count as on it. Numerical, not a balance value.
 */
export const FULLNESS_EPSILON = 1e-6;

/** FR2: Fed above `fedAbove`, Starving below `starvingBelow`, Hungry in between (inclusive). Never stored. */
export function hungerOf(fullness: number): Hunger {
  if (fullness > TUNING.fedAbove + FULLNESS_EPSILON) return 'fed';
  if (fullness < TUNING.starvingBelow - FULLNESS_EPSILON) return 'starving';
  return 'hungry';
}

export type Stage = 'lamb' | 'adult' | 'elder';

/**
 * FR7: stage from age (`state.time - bornAt`). Never stored. There is no upper bound: lifecycle.ts
 * kills an elder on the tick it reaches oldAgeMs. FR30: the Abomination is a lamb at any age, so the
 * one rule keeps it unsellable (market.ts), unable to breed or eat breeding food, and a lamb in
 * PublicSheep.
 */
export function stageOf(s: Sheep, state: GameState): Stage {
  if (s.isAbomination) return 'lamb';
  const age = state.time - s.bornAt;
  if (age < TUNING.lambUntilMs) return 'lamb';
  if (age < TUNING.elderFromMs) return 'adult';
  return 'elder';
}

/**
 * FR17: what the Market pays for a sheep of `stage`, from TUNING; 0 for a lamb, which cannot be sold.
 * The one price rule, for the sim's Sell (market.ts) and the Market's price tag alike.
 */
export function salePrice(stage: Stage): number {
  if (stage === 'adult') return TUNING.sellPriceAdult;
  if (stage === 'elder') return TUNING.sellPriceElder;
  return 0;
}

/**
 * The one-time shop items, in display order (GDD Upgrade Trees, mockups/hud.html), the Auto-feeder last
 * (Story 4.8). Save validation trusts this list for `owned`, so it never holds a consumable.
 */
export const SHOP_ITEMS: readonly ShopItemId[] = Object.freeze([
  'land1',
  'land2',
  'land3',
  'flowerPatch',
  'scarecrow',
  'hoe1',
  'hoe2',
  'autoFeeder',
]);

/**
 * The shop panel's rows, in display order (GDD Upgrade Trees): the one-time items, then the consumables
 * (Story 4.5). Better Hoe (4.7) and the Auto-feeder (4.8) are in SHOP_ITEMS, so they come before Medicine.
 */
export const SHOP_ROWS: readonly ShopRowId[] = Object.freeze([...SHOP_ITEMS, 'medicine']);

/** What `item` costs, from TUNING (FR22, FR23, FR26). */
export function shopPrice(item: ShopRowId): number {
  switch (item) {
    case 'land1':
      return TUNING.landPrices[0];
    case 'land2':
      return TUNING.landPrices[1];
    case 'land3':
      return TUNING.landPrices[2];
    case 'flowerPatch':
      return TUNING.flowerPatchPrice;
    case 'scarecrow':
      return TUNING.scarecrowPrice;
    case 'hoe1':
      return TUNING.hoePrices[0];
    case 'hoe2':
      return TUNING.hoePrices[1];
    case 'autoFeeder':
      return TUNING.autoFeederPrice;
    case 'medicine':
      return TUNING.medicinePrice;
    default:
      return assertNever(item);
  }
}

/**
 * The item `item` needs first, or null (GDD Upgrade Trees: "each Land tier needs the previous one.
 * Everything else is available from the start"), and Better Hoe II needs I (epics Story 4.7).
 */
export function shopRequires(item: ShopRowId): ShopItemId | null {
  if (item === 'land2') return 'land1';
  if (item === 'land3') return 'land2';
  if (item === 'hoe2') return 'hoe1';
  return null;
}

export function isOwned(state: GameState, item: ShopItemId): boolean {
  return state.owned.includes(item);
}

/** Why `item` cannot be bought now, or null when it can. */
export type BuyBlock = 'owned' | 'locked' | 'poor' | null;

/**
 * UX-DR24: the one purchase rule, for the sim's Buy (economy.ts) and the shop rows alike. Owned wins
 * over locked, and locked over poor, so a row always shows its most telling reason. Medicine is
 * repeatable (FR26): never owned, never locked, only ever poor.
 */
export function buyBlock(state: GameState, item: ShopRowId): BuyBlock {
  if (item !== 'medicine' && isOwned(state, item)) return 'owned';
  const req = shopRequires(item);
  if (req !== null && !isOwned(state, req)) return 'locked';
  if (state.money < shopPrice(item)) return 'poor';
  return null;
}

/** One shop row as the panel shows it. */
export interface ShopRowView {
  item: ShopRowId;
  price: number;
  block: BuyBlock;
}

/**
 * Fills `out` in place with one row per SHOP_ROWS entry, reusing its entries (no allocation once it
 * holds them all), and returns it.
 */
export function selectShopView(state: GameState, out: ShopRowView[]): ShopRowView[] {
  for (let i = 0; i < SHOP_ROWS.length; i++) {
    const item = SHOP_ROWS[i];
    let row = out[i];
    if (row === undefined) out[i] = row = { item, price: 0, block: null };
    row.item = item;
    row.price = shopPrice(item);
    row.block = buyBlock(state, item);
  }
  out.length = SHOP_ROWS.length;
  return out;
}

/** FR10: true until the tick time reaches cooldownUntil. Derived, never stored. */
export function onCooldown(s: Sheep, state: GameState): boolean {
  return state.time < s.cooldownUntil;
}

/**
 * FR9/FR10: the one pairing rule, for the sim's Breed and (through PublicSheep) the Breed tool: a
 * ready adult that is off cooldown.
 */
export function canBreed(s: Sheep, state: GameState): boolean {
  return s.breedReady && stageOf(s, state) === 'adult' && !onCooldown(s, state);
}

/** Land capacity (FR11, FR22): 10 before any land, then 25 / 50 / 100 for Land I–III (Story 3.3). */
export function capacity(state: GameState): number {
  return TUNING.landCapacities[landTier(state)];
}

/**
 * FR34 / UX-DR35: `alive` living sheep are crowded at land capacity `cap` when they fill at least
 * overcrowdFraction of it. Living sheep only: pending lambs hold a capacity slot (AR21) but are not alive,
 * and the flock counter shows the same number, so the HUD turns red exactly when overcrowding rolls are
 * live (overcrowding.ts). Derived, never stored.
 */
export function crowdedAt(alive: number, cap: number): boolean {
  return alive >= crowdThreshold(cap, TUNING.overcrowdFraction);
}

/**
 * The fewest living sheep that are crowded at capacity `cap`: `fraction` of it, rounded up. The product
 * is nudged down by a hair first, because float multiplication can overshoot a whole number (0.56 × 25
 * is 14.000000000000002, which would make 14/25 not crowded at exactly 56 %).
 */
export function crowdThreshold(cap: number, fraction: number): number {
  return Math.ceil(cap * fraction - 1e-9);
}

/** FR34: the living flock is at overcrowdFraction of its land capacity or more (crowdedAt). */
export function isCrowded(state: GameState): boolean {
  return crowdedAt(state.sheep.length, capacity(state));
}

/** AR21: capacity counts living sheep plus pending lambs. */
export function slotsUsed(state: GameState): number {
  return state.sheep.length + state.pregnancies.length;
}

/** Why the Breed tool is greyed (FR11, UX-DR31), or null when breeding is possible. */
export type BreedBlock = 'capacity' | 'notReady' | null;

/** Capacity wins when both apply. A plain loop: no allocation. */
export function breedBlock(state: GameState): BreedBlock {
  if (slotsUsed(state) >= capacity(state)) return 'capacity';
  let eligible = 0;
  const sheep = state.sheep;
  for (let i = 0; i < sheep.length && eligible < 2; i++) if (canBreed(sheep[i], state)) eligible++;
  return eligible < 2 ? 'notReady' : null;
}

/**
 * How a sheep walks (FR32): `offstep` is the Abomination's designed tell, the only PublicSheep field in
 * which it differs from a lamb (Story 4.1; Story 4.2 draws it).
 */
export type Gait = 'normal' | 'offstep';

/**
 * What the view may know a sheep is doing: `stalking` (the Abomination's visit, Story 4.3) is reported as
 * `wander`, so the view can never learn of a visit from it (AR18).
 */
export type PublicActivity = Exclude<SheepActivity, 'stalking'>;

/**
 * The only sheep shape the view may consume (AR18). It never carries the Abomination's secret: no
 * `isAbomination` and no kill-cycle state (`stalk`, `doomedAt`), and the Abomination is a lamb here at
 * any age. Story 5.3 adds name.
 */
export interface PublicSheep {
  id: number;
  x: number;
  y: number;
  stage: Stage;
  hunger: Hunger;
  /** Ready to breed (FR8a). Not secret: the Abomination never grows past a lamb, so it is never ready. */
  ready: boolean;
  /** On breeding cooldown (FR10): the tooltip's heart-outline icon. */
  onCooldown: boolean;
  /** May be picked by the Breed tool (canBreed). Not secret either: the Abomination is never an adult. */
  canBreed: boolean;
  /** Infected (FR15): the tint, marker and wobble. Not secret: the Abomination can catch it like any lamb. */
  infected: boolean;
  /** The walk (FR32): `offstep` for the Abomination, else `normal`. */
  gait: Gait;
  /** What it is doing; a visit reads as `wander` (Story 4.3). No view code reads it yet. */
  activity: PublicActivity;
}

/** `stalking` → `wander` (AR18); every other activity as it is. */
function publicActivity(a: SheepActivity): PublicActivity {
  return a === 'stalking' ? 'wander' : a;
}

export function publicSheep(s: Sheep, state: GameState): PublicSheep {
  return {
    id: s.id,
    x: s.x,
    y: s.y,
    stage: stageOf(s, state),
    hunger: hungerOf(s.fullness),
    ready: s.breedReady,
    onCooldown: onCooldown(s, state),
    canBreed: canBreed(s, state),
    infected: s.infectedAt !== undefined,
    gait: s.isAbomination ? 'offstep' : 'normal',
    activity: publicActivity(s.activity),
  };
}

/**
 * Fills `out` with one PublicSheep per living sheep, reusing the objects already in `out` so a
 * per-frame call allocates nothing unless the flock has grown. Returns `out`.
 */
export function selectPublicSheep(state: GameState, out: PublicSheep[]): PublicSheep[] {
  const sheep = state.sheep;
  for (let i = 0; i < sheep.length; i++) {
    const s = sheep[i];
    let p = out[i];
    if (p === undefined) {
      p = {
        id: 0,
        x: 0,
        y: 0,
        stage: 'adult',
        hunger: 'fed',
        ready: false,
        onCooldown: false,
        canBreed: false,
        infected: false,
        gait: 'normal',
        activity: 'wander',
      };
      out[i] = p;
    }
    p.id = s.id;
    p.x = s.x;
    p.y = s.y;
    p.stage = stageOf(s, state);
    p.hunger = hungerOf(s.fullness);
    p.ready = s.breedReady;
    p.onCooldown = onCooldown(s, state);
    p.canBreed = canBreed(s, state);
    p.infected = s.infectedAt !== undefined;
    p.gait = s.isAbomination ? 'offstep' : 'normal';
    p.activity = publicActivity(s.activity);
  }
  out.length = sheep.length;
  return out;
}

/** Index of the sheep with `id` in state.sheep, or -1. A plain loop: no closure per call. */
export function sheepIndex(state: GameState, id: number): number {
  const sheep = state.sheep;
  for (let i = 0; i < sheep.length; i++) if (sheep[i].id === id) return i;
  return -1;
}

/** A lamb on the way, as the view draws it: a heart between the parents (UX-DR56). */
export interface PublicPregnancy {
  id: number;
  /** The parents' ids (not secret), so the view can place the heart between their drawn sprites. */
  parentA: number;
  parentB: number;
  x: number;
  y: number;
}

/**
 * Where a pending lamb is (UX-DR56) and is born (FR9): the midpoint of the parents still alive, the
 * one left, or the stored spot. Writes into `out` (no allocation) and returns it.
 */
export function pregnancySpot<T extends { x: number; y: number }>(state: GameState, g: Pregnancy, out: T): T {
  const a = sheepIndex(state, g.parentA);
  const b = sheepIndex(state, g.parentB);
  if (a >= 0 && b >= 0) {
    out.x = (state.sheep[a].x + state.sheep[b].x) / 2;
    out.y = (state.sheep[a].y + state.sheep[b].y) / 2;
  } else if (a >= 0 || b >= 0) {
    const s = state.sheep[a >= 0 ? a : b];
    out.x = s.x;
    out.y = s.y;
  } else {
    out.x = g.x;
    out.y = g.y;
  }
  return out;
}

/** Fills `out` with one PublicPregnancy per pending lamb, reusing its objects like selectPublicSheep. */
export function selectPregnancies(state: GameState, out: PublicPregnancy[]): PublicPregnancy[] {
  const list = state.pregnancies;
  for (let i = 0; i < list.length; i++) {
    let p = out[i];
    if (p === undefined) {
      p = { id: 0, parentA: 0, parentB: 0, x: 0, y: 0 };
      out[i] = p;
    }
    p.id = list[i].id;
    p.parentA = list[i].parentA;
    p.parentB = list[i].parentB;
    pregnancySpot(state, list[i], p);
  }
  out.length = list.length;
  return out;
}

/** Index of the food piece with `id` in state.foodPieces, or -1. A plain loop: no closure per call. */
export function pieceIndex(state: GameState, id: number): number {
  const pieces = state.foodPieces;
  for (let i = 0; i < pieces.length; i++) if (pieces[i].id === id) return i;
  return -1;
}

/** Index of the breeding piece with `id` in state.breedingPieces, or -1. A plain loop, like pieceIndex. */
export function breedingPieceIndex(state: GameState, id: number): number {
  const pieces = state.breedingPieces;
  for (let i = 0; i < pieces.length; i++) if (pieces[i].id === id) return i;
  return -1;
}

/** Breeding pieces hold no secrets either: the live array, as selectFoodPieces. */
export function selectBreedingPieces(state: GameState): readonly BreedingPiece[] {
  return state.breedingPieces;
}

/** Index of the carcass with `id` in state.carcasses, or -1. A plain loop, like pieceIndex. */
export function carcassIndex(state: GameState, id: number): number {
  const list = state.carcasses;
  for (let i = 0; i < list.length; i++) if (list[i].id === id) return i;
  return -1;
}

/**
 * Carcasses hold no secrets either (an Abomination victim's carcass is just a carcass): the live
 * array, as selectFoodPieces.
 */
export function selectCarcasses(state: GameState): readonly Carcass[] {
  return state.carcasses;
}

/** Food pieces hold no secrets: the view reads the live array (no copy, no allocation). */
export function selectFoodPieces(state: GameState): readonly FoodPiece[] {
  return state.foodPieces;
}

/**
 * The threat summary's live counts (UX-DR39). A sheep that is both Starving and infected counts in
 * both. Derived exactly as PublicSheep's `hunger` and `infected`, so the HUD never counts anything the
 * field does not show (the Abomination counts like any lamb, never on its own account; UX-DR64).
 */
export interface ThreatCounts {
  starving: number;
  infected: number;
  carcasses: number;
}

/**
 * FR19: a sacrifice food boost is running. It ends exactly at boostUntil. A lost game is never boosted:
 * time stops with the loss (often a last-sheep sacrifice), so its deadline would otherwise stay ahead.
 */
export function isBoosted(state: GameState): boolean {
  return state.lostAt === undefined && state.time < state.boostUntil;
}

/** Game-ms left of the food boost, or 0 when none is running (the HUD's boost timer). */
export function boostRemainingMs(state: GameState): number {
  return isBoosted(state) ? state.boostUntil - state.time : 0;
}

/** The Better Hoe owned (FR24): 0 for none, 1 or 2. Derived from `owned`, never stored. */
export type HoeTier = 0 | 1 | 2;

/**
 * The highest Better Hoe owned (Story 4.7). II is checked first, so it wins even in a hand-built state
 * without I (validation and the shop's lock keep I before II in real saves).
 */
export function hoeTier(state: GameState): HoeTier {
  if (isOwned(state, 'hoe2')) return 2;
  if (isOwned(state, 'hoe1')) return 1;
  return 0;
}

/**
 * The pips one Farm click fills (FR3, FR19, FR24): farmPipsPerClick, or a Better Hoe's
 * hoePipsPerClick in its place; the boost doubles whatever the base is (2 / 4 / 6). The breeding bar
 * never uses this (FR8).
 */
export function farmPipsPerClick(state: GameState): number {
  const tier = hoeTier(state);
  const base = tier === 0 ? TUNING.farmPipsPerClick : TUNING.hoePipsPerClick[tier - 1];
  return base * (isBoosted(state) ? TUNING.boostPipMultiplier : 1);
}

/** The eras in order (FR27). Era `i ≥ 1` needs TUNING.eraThresholds[i − 1] living sheep. */
export const ERAS: readonly Era[] = Object.freeze(['pasture', 'village', 'town', 'wool-empire']);

/**
 * FR27 / pattern N4: the era, derived from the living flock every time and never stored. Counts
 * state.sheep only: pending lambs hold a capacity slot (AR21) but are not alive, and carcasses are
 * not sheep. Eras regress (FR28). Runs every tick and every frame, so it is a plain comparison.
 */
export function currentEra(state: GameState): Era {
  const n = state.sheep.length;
  const t = TUNING.eraThresholds;
  if (n >= t[2]) return 'wool-empire';
  if (n >= t[1]) return 'town';
  if (n >= t[0]) return 'village';
  return 'pasture';
}

/** An era's place in ERAS, so the view can tell an advance from a regress (Story 3.5). */
export function eraIndex(era: Era): number {
  return ERAS.indexOf(era);
}

/**
 * What the HUD shows. The era is not here: the era badge lives in OverlayScene (above the modal scrim)
 * and reads currentEra itself (Story 3.5).
 */
export interface HudView {
  /** Pips in the current Farm bar, out of farmPipsPerFood (FR3). */
  farmProgress: number;
  farmPipsPerFood: number;
  /** Pips in the current breeding bar, out of breedingPipsPerFood (FR8). */
  breedingProgress: number;
  breedingPipsPerFood: number;
  /** Why Breed is greyed, or null (FR11). */
  breedBlock: BreedBlock;
  /** Game-ms left of the food boost, 0 when none (FR19): the Farm glow and the boost timer. */
  boostRemainingMs: number;
  /** Whole dollars to spend (FR21): the money counter (UX-DR34). */
  money: number;
  /** Living sheep (the flock counter, UX-DR35). Pending lambs hold a capacity slot but are not counted. */
  flock: number;
  /** Land capacity (FR11): the flock counter's "/{capacity}". */
  capacity: number;
  /** Doses of medicine owned (FR26): the Medicine slot's "×{n}" (UX-DR33). */
  medicine: number;
  /** ≥ 90% of capacity (crowdedAt): the flock counter's crowded style (UX-DR35) and the overcrowding roll (FR34). */
  crowded: boolean;
  /** The Better Hoe owned (FR24): the hoe icon on the Farm button (Story 4.7). */
  hoeTier: HoeTier;
  /** The threat summary (UX-DR39), filled in place. */
  threats: ThreatCounts;
}

/** Fills `out` in place (no allocation) and returns it. HudScene calls this once per frame. */
export function selectHudView(state: GameState, out: HudView): HudView {
  out.farmProgress = state.farmProgress;
  out.farmPipsPerFood = TUNING.farmPipsPerFood;
  out.breedingProgress = state.breedingProgress;
  out.breedingPipsPerFood = TUNING.breedingPipsPerFood;
  out.breedBlock = breedBlock(state);
  out.boostRemainingMs = boostRemainingMs(state);
  out.money = state.money;
  out.flock = state.sheep.length;
  out.capacity = capacity(state);
  out.medicine = state.medicine;
  out.crowded = crowdedAt(out.flock, out.capacity);
  out.hoeTier = hoeTier(state);
  const t = out.threats;
  let starving = 0;
  let infected = 0;
  const sheep = state.sheep;
  for (let i = 0; i < sheep.length; i++) {
    const s = sheep[i];
    if (hungerOf(s.fullness) === 'starving') starving++;
    if (s.infectedAt !== undefined) infected++;
  }
  t.starving = starving;
  t.infected = infected;
  t.carcasses = state.carcasses.length;
  return out;
}

/** FR38: the flock reached 0 and the sim has stopped. Derived from state.lostAt. */
export function isLost(state: GameState): boolean {
  return state.lostAt !== undefined;
}

/** What the lose screen shows (UX-DR19). */
export interface LoseView {
  /** Game-ms survived: the loss time, or the current time while still playing. */
  survivedMs: number;
  peakFlock: number;
}

/** Fills `out` in place (no allocation) and returns it. */
export function selectLoseView(state: GameState, out: LoseView): LoseView {
  out.survivedMs = state.lostAt ?? state.time;
  out.peakFlock = state.stats.peakFlock;
  return out;
}

/**
 * What the pause menu's Stats panel shows (FR36, UX-DR16). `alive` is living sheep right now, as the
 * flock counter counts them (pending lambs and carcasses are not alive); the rest are the lifetime
 * counters in `state.stats`. Public: an Abomination is alive, dies and is sacrificed like any sheep.
 */
export interface StatsView {
  alive: number;
  sold: number;
  died: number;
  sacrificed: number;
  moneyEarned: number;
}

/** Fills `out` in place (no allocation) and returns it. */
export function selectStatsView(state: GameState, out: StatsView): StatsView {
  out.alive = state.sheep.length;
  out.sold = state.stats.sold;
  out.died = state.stats.died;
  out.sacrificed = state.stats.sacrificed;
  out.moneyEarned = state.stats.moneyEarned;
  return out;
}
