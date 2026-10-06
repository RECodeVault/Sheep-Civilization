// All player-facing copy (EXPERIENCE.md Voice and Tone). Components read text from here, never
// inline literals. Rules: no "!" except "Last sheep!"; never "corpse", "blood" or "kill".

export const STRINGS = Object.freeze({
  // Global safety net toast (architecture Error Handling).
  errorToast: 'Something went wrong — your flock was saved.',
  // [ASSUMPTION] Not in the Voice table: errors before GameScene starts, when no flock exists yet.
  bootErrorToast: 'Something went wrong. Try reloading the page.',
  // [ASSUMPTION] Not in the Voice table: shown once when an atlas fails to load (Story 1.4).
  assetLoadFailed: "Some of the pasture didn't load. Try reloading the page.",
} as const);
