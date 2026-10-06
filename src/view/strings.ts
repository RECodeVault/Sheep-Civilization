// All player-facing copy (EXPERIENCE.md Voice and Tone). Components read text from here, never
// inline literals. Rules: no "!" except "Last sheep!"; never "corpse", "blood" or "kill".
import type { Hunger, Stage } from '../sim/selectors';

const STAGE: Readonly<Record<Stage, string>> = Object.freeze({ lamb: 'Lamb', adult: 'Adult', elder: 'Elder' });
const HUNGER: Readonly<Record<Hunger, string>> = Object.freeze({ fed: 'Fed', hungry: 'Hungry', starving: 'Starving' });

export const STRINGS = Object.freeze({
  // Global safety net toast (architecture Error Handling).
  errorToast: 'Something went wrong — your flock was saved.',
  // [ASSUMPTION] Not in the Voice table: errors before GameScene starts, when no flock exists yet.
  bootErrorToast: 'Something went wrong. Try reloading the page.',
  // [ASSUMPTION] Not in the Voice table: shown once when an atlas fails to load (Story 1.4).
  assetLoadFailed: "Some of the pasture didn't load. Try reloading the page.",
  stage: STAGE,
  hunger: HUNGER,
  // Sheep tooltip (UX-DR43, UX-DR96), e.g. "Adult · Hungry". Story 5.3 adds the name line above it.
  sheepTooltip: (stage: Stage, hunger: Hunger): string => `${STAGE[stage]} · ${HUNGER[hunger]}`,
  // Farm button (UX-DR26, UX-DR75, UX-DR96). The tooltip does not depend on Better Hoe (2026-10-06).
  farmLabel: 'Farm',
  farmKey: 'F',
  farmTooltip: 'Farm: fill the bar for 1 food (F)',
  // Float popup (UX-DR44), e.g. "+1" when a Farm bar fills the stock.
  farmPopup: (n: number): string => `+${n}`,
  // Meter and stock value (UX-DR29), e.g. "12/20".
  meterValue: (n: number, cap: number): string => `${n}/${cap}`,
} as const);
