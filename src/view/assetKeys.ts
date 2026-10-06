// Texture and frame keys, in one place so scenes and sprites never repeat string literals.
// Atlases are built by `npm run assets` from assets/art/ (kebab-case `entity-state[-n]` frames).

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
  fencePost: 'fence-post',
  fenceRailH: 'fence-rail-h',
  fenceRailV: 'fence-rail-v',
  foodPiece: 'food-piece',
  munchCrumb: 'munch-crumb',
  pipFood: 'pip-food',
  pipEmpty: 'pip-empty',
} as const);

/** Relative URLs (no leading slash) so the build works under any subpath. */
export function atlasUrls(key: string): { png: string; json: string } {
  return { png: `assets/atlases/${key}.png`, json: `assets/atlases/${key}.json` };
}
