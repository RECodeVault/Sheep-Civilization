// All player-facing copy (EXPERIENCE.md Voice and Tone). Components read text from here, never
// inline literals. Rules: no "!" except "Last sheep!"; never "corpse", "blood" or "kill".
import { formatMoney } from '../core/format';
import type { DeathCause } from '../sim/events';
import type { Hunger, Stage } from '../sim/selectors';

const STAGE: Readonly<Record<Stage, string>> = Object.freeze({ lamb: 'Lamb', adult: 'Adult', elder: 'Elder' });
const HUNGER: Readonly<Record<Hunger, string>> = Object.freeze({ fed: 'Fed', hungry: 'Hungry', starving: 'Starving' });
// Threat summary hover (UX-DR39, UX-DR96), e.g. "2 starving". "carcass" is allowed (UX-DR97).
const THREAT_TOOLTIP = Object.freeze({
  starving: (n: number): string => `${n} starving`,
  infected: (n: number): string => `${n} infected`,
  carcasses: (n: number): string => (n === 1 ? '1 carcass' : `${n} carcasses`),
});
// Death toasts (UX-DR92, UX-DR97), after the subject: "A sheep starved.", or "3 sheep starved." for
// deaths of one cause in the same frame (code review decision, Rylan 2026-10-07). Story 5.3 puts the
// name in place of "A sheep", in `halo`. The Abomination's victims never get a cause (UX-DR64). Old
// age is 540 s: nine minutes.
const DEATH_TOAST: Readonly<Record<DeathCause, string>> = Object.freeze({
  starved: 'starved.',
  oldAge: 'died of old age. A long, full nine minutes.',
  virus: 'caught the carcass sickness.',
  abomination: 'just… fell over.',
});

export const STRINGS = Object.freeze({
  // Global safety net toast (architecture Error Handling).
  errorToast: 'Something went wrong — your flock was saved.',
  // [ASSUMPTION] Not in the Voice table: errors before GameScene starts (no flock yet), or when the
  // forced save did not write (saving stopped after a sim error, storage failed): reloading resumes
  // the last good save.
  bootErrorToast: 'Something went wrong. Try reloading the page.',
  // [ASSUMPTION] Not in the Voice table: shown once when an atlas fails to load (Story 1.4).
  assetLoadFailed: "Some of the pasture didn't load. Try reloading the page.",
  stage: STAGE,
  hunger: HUNGER,
  deathToast: (cause: DeathCause, n: number): string => `${n === 1 ? 'A sheep' : `${n} sheep`} ${DEATH_TOAST[cause]}`,
  // Sheep tooltip (UX-DR43, UX-DR96), e.g. "Adult · Hungry". Story 5.3 adds the name line above it.
  sheepTooltip: (stage: Stage, hunger: Hunger): string => `${STAGE[stage]} · ${HUNGER[hunger]}`,
  // Farm button (UX-DR26, UX-DR75, UX-DR96). The tooltip does not depend on Better Hoe (2026-10-06).
  farmLabel: 'Farm',
  farmKey: 'F',
  farmTooltip: 'Farm: fill the bar for 1 food (F)',
  // Farm Breeding Food button (UX-DR28, UX-DR75, UX-DR96). The Voice-table label is "Farm Breeding
  // Food"; the button shows it on two lines (mockups/hud.html), since one line does not fit beside
  // the key hint.
  farmBreedingLabel: 'Farm Breeding\nFood',
  farmBreedingKey: 'G',
  farmBreedingTooltip: 'Farm Breeding Food: fill the bar for 1 breeding food (G)',
  // Breed tool (UX-DR31, UX-DR75, UX-DR96): the label, its tooltip, and the greyed reasons in its place.
  breedLabel: 'Breed',
  breedTooltip: 'Breed: pick two adults',
  breedNoRoom: 'No room. Buy land.',
  breedNotReady: 'Needs 2 ready sheep.',
  threatTooltip: THREAT_TOOLTIP,
  // The Better Place's drop label while a sheep is dragged (UX-DR52, UX-DR96): the food boost (FR19).
  betterPlaceLabel: '+2× food',
  // The food boost (FR19): the Farm button's badge (UX-DR27), the popup when a sacrifice starts it
  // (UX-DR44) and the bottom-bar timer (UX-DR38), e.g. "×2 0:18".
  boostBadge: '×2',
  boostPopup: '×2',
  boostTimer: (time: string): string => `×2 ${time}`,
  // Sacrifice toast (UX-DR93). Story 5.3 puts the name in place of "A sheep", in `halo`.
  sacrificeToast: 'A sheep went to a Better Place.',
  // The Market's drag tag (UX-DR51, UX-DR96): the sale price, "$10" (adult) or "$5" (elder); "Too
  // young" over the stall with a lamb (UX-DR53).
  marketPrice: (price: number): string => formatMoney(price),
  marketTooYoung: 'Too young',
  // The coin popup rising from the stall on a sale (UX-DR44, UX-DR82), e.g. "$10".
  salePopup: (price: number): string => formatMoney(price),
  // Sale toast (UX-DR93), e.g. "A sheep sold. $10.". Story 5.3 puts the name in place of "A sheep", in
  // `halo`.
  soldToast: (price: number): string => `A sheep sold. ${formatMoney(price)}.`,
  // Float popup (UX-DR44), e.g. "+1" when a full Farm or breeding bar drops a piece.
  farmPopup: (n: number): string => `+${n}`,
  // Meter value (UX-DR29), e.g. "3/8" for the Farm bar.
  meterValue: (n: number, cap: number): string => `${n}/${cap}`,
  // Lose screen (UX-DR19, UX-DR95; EXPERIENCE Voice), e.g. "Survived 12:34 · Peak flock 18".
  loseTitle: 'The flock is gone.',
  loseStats: (time: string, peak: number): string => `Survived ${time} · Peak flock ${peak}`,
  restart: 'Restart',
  // Title screen (UX-DR12, UX-DR95): the logo, then Continue (only with a save), New Game, Credits.
  gameTitle: 'Sheep Civilization',
  continue: 'Continue',
  newGame: 'New Game',
  credits: 'Credits',
  // Pause menu (UX-DR14, UX-DR95): Resume, Volume, Stats, Restart (above), Credits, Main Menu; Back
  // in sub-panels.
  paused: 'Paused',
  resume: 'Resume',
  volume: 'Volume',
  stats: 'Stats',
  back: 'Back',
  // [ASSUMPTION] Not in the Voice table (Rylan asked for it 2026-10-06): the last pause-menu button,
  // back to the title screen.
  mainMenu: 'Main Menu',
  // [ASSUMPTION] Not in the Voice table: Main Menu could not save after a sim error, so the game stays
  // open (code review decision, Rylan 2026-10-06).
  quitSaveFailed: "Your flock couldn't be saved, so it stays here.",
  // Start-over confirm (UX-DR18; EXPERIENCE Voice): the only confirmation in the game.
  startOverQuestion: 'Start over? Your flock will be lost.',
  cancel: 'Cancel',
  startOver: 'Start over',
  // [ASSUMPTION] Not in the Voice table (approved by Rylan 2026-10-06): the Volume, Stats and Credits
  // placeholders until Stories 5.7, 5.4 and 5.9.
  comingSoon: 'Coming soon.',
  // [ASSUMPTION] Not in the Voice table: the top-left Pause button (added 2026-10-06, Rylan).
  pauseLabel: 'Pause',
  pauseTooltip: 'Pause (Esc)',
} as const);
