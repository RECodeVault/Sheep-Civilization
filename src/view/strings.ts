// All player-facing copy (EXPERIENCE.md Voice and Tone). Components read text from here, never
// inline literals. Rules: no "!" except "Last sheep!"; never "corpse", "blood" or "kill".
import type { Hunger, Stage } from '../sim/selectors';

const STAGE: Readonly<Record<Stage, string>> = Object.freeze({ lamb: 'Lamb', adult: 'Adult', elder: 'Elder' });
const HUNGER: Readonly<Record<Hunger, string>> = Object.freeze({ fed: 'Fed', hungry: 'Hungry', starving: 'Starving' });

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
  // Sheep tooltip (UX-DR43, UX-DR96), e.g. "Adult · Hungry". Story 5.3 adds the name line above it.
  sheepTooltip: (stage: Stage, hunger: Hunger): string => `${STAGE[stage]} · ${HUNGER[hunger]}`,
  // Farm button (UX-DR26, UX-DR75, UX-DR96). The tooltip does not depend on Better Hoe (2026-10-06).
  farmLabel: 'Farm',
  farmKey: 'F',
  farmTooltip: 'Farm: fill the bar for 1 food (F)',
  // Float popup (UX-DR44), e.g. "+1" when a full Farm bar drops a piece.
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
