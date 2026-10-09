// Texture and frame keys, in one place so scenes and sprites never repeat string literals.
// Atlases are built by `npm run assets` from assets/art/ (kebab-case `entity-state[-n]` frames).
import type { Era } from '../sim/state';

export const ATLAS = Object.freeze({
  sheepWorld: 'sheep-world',
  ui: 'ui',
} as const);

export const FRAME = Object.freeze({
  adultIdle: 'adult-idle',
  adultHungry: 'adult-hungry',
  adultStarving: 'adult-starving',
  lambIdle: 'lamb-idle',
  lambHungry: 'lamb-hungry',
  lambStarving: 'lamb-starving',
  elderIdle: 'elder-idle',
  elderHungry: 'elder-hungry',
  elderStarving: 'elder-starving',
  // Story 2.7: legs dangling while dragged (UX-DR60).
  adultDragged: 'adult-dragged',
  lambDragged: 'lamb-dragged',
  elderDragged: 'elder-dragged',
  // Story 4.2: walk-cycle step frames, one per pose (legs apart; head and body as the pose). A walking
  // sheep alternates its pose frame with these; the Abomination's off-step is a rhythm on the same
  // lamb frames (gait.ts), never frames of its own.
  lambWalk: 'lamb-walk',
  lambHungryWalk: 'lamb-hungry-walk',
  lambStarvingWalk: 'lamb-starving-walk',
  adultWalk: 'adult-walk',
  adultHungryWalk: 'adult-hungry-walk',
  adultStarvingWalk: 'adult-starving-walk',
  elderWalk: 'elder-walk',
  elderHungryWalk: 'elder-hungry-walk',
  elderStarvingWalk: 'elder-starving-walk',
  fencePost: 'fence-post',
  fenceRailH: 'fence-rail-h',
  fenceRailV: 'fence-rail-v',
  foodPiece: 'food-piece',
  breedingPiece: 'breeding-piece',
  readyHeart: 'ready-heart',
  breedHeart: 'breed-heart',
  heartOutline: 'heart-outline',
  poof: 'poof',
  carcass: 'carcass',
  dust: 'dust',
  infectionMarker: 'infection-marker',
  alertPing: 'alert-ping',
  alertDot: 'alert-dot',
  munchCrumb: 'munch-crumb',
  // The Better Place (UX-DR47, UX-DR52) and its suction sparkle (UX-DR80).
  betterPlace: 'better-place',
  betterPlaceLit: 'better-place-lit',
  betterPlaceGlow: 'better-place-glow',
  betterPlaceRingPrefix: 'better-place-ring-',
  sparkle: 'sparkle',
  // The Market stall (UX-DR46, UX-DR51, UX-DR53): the stall, its awning-flap frame, the greyed "Too
  // young" look, and the drag outline in awning and in disabled.
  market: 'market',
  marketFlap: 'market-flap',
  marketDisabled: 'market-disabled',
  marketOutline: 'market-outline',
  marketOutlineInvalid: 'market-outline-invalid',
  // The decorations in the field (FR23, Story 3.4).
  flowerPatch: 'flower-patch',
  scarecrow: 'scarecrow',
  pipFood: 'pip-food',
  pipBreeding: 'pip-breeding',
  pipEmpty: 'pip-empty',
  iconHeart: 'icon-heart',
  iconStarving: 'icon-starving',
  iconInfected: 'icon-infected',
  iconCarcass: 'icon-carcass',
  // The flock counter's sheep (UX-DR35, Story 3.3).
  iconSheep: 'icon-sheep',
  // In its place while the flock is crowded (UX-DR35, Story 4.6).
  iconCrowd: 'icon-crowd',
  // The shop rows' icons (UX-DR24; Land I–III share one).
  iconLand: 'icon-land',
  iconFlowerPatch: 'icon-flower-patch',
  iconScarecrow: 'icon-scarecrow',
  // The Medicine slot, its dragged dose and its shop row (UX-DR33, Story 4.5).
  iconMedicine: 'icon-medicine',
  // Better Hoe I and II (FR24, Story 4.7): their shop rows and, once owned, the Farm button.
  iconHoe: 'icon-hoe',
  iconHoe2: 'icon-hoe-2',
} as const);

/** Relative URLs (no leading slash) so the build works under any subpath. */
export function atlasUrls(key: string): { png: string; json: string } {
  return { png: `assets/atlases/${key}.png`, json: `assets/atlases/${key}.json` };
}

/**
 * An era's field background (Story 3.5): a loose image, not an atlas frame (architecture: large, swapped
 * rarely). Its texture key is the Era id itself (state.ts). Relative URL, like atlasUrls.
 */
export function backgroundUrl(era: Era): string {
  return `assets/backgrounds/${era}.png`;
}

/**
 * The Breed tool's heart cursor (UX-DR31): a CSS cursor, so a loose PNG (assets/cursors/, copied by
 * `npm run assets`), hotspot at its centre, with the hand as the fallback. Relative URL, like atlasUrls.
 */
export const HEART_CURSOR = 'url(assets/cursors/heart.png) 16 16, pointer';
