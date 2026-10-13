// All player-facing copy (EXPERIENCE.md Voice and Tone). Components read text from here, never
// inline literals. Rules: no "!" except "Last sheep!"; never "corpse", "blood" or "kill".
import { TUNING } from '../config/tuning';
import { formatMinutesInWords, formatMoney } from '../core/format';
import type { DeathCause } from '../sim/events';
import type { Hunger, Stage } from '../sim/selectors';
import type { Era, ShopRowId } from '../sim/state';

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
// name in place of "A sheep", in `halo`. The Abomination's victims never get a cause (UX-DR64). The
// old-age lifespan is built from TUNING.oldAgeMs (540 s: "nine minutes"), so a retune keeps it true
// (Story 3.6).
const DEATH_TOAST: Readonly<Record<DeathCause, string>> = Object.freeze({
  starved: 'starved.',
  oldAge: `died of old age. A long, full ${formatMinutesInWords(TUNING.oldAgeMs)}.`,
  virus: 'caught the carcass sickness.',
  abomination: 'just… fell over.',
});

// Shop rows (UX-DR24; mockups/hud.html, GDD Upgrade Trees): the name, and the one-line effect. Each Land
// tier's effect is built from TUNING's land table, so a retune (3.6) changes the row too.
/** "Capacity 10 → 25": what Land tier `tier` (1–3) does to capacity. */
function landEffect(tier: 1 | 2 | 3): string {
  const c = TUNING.landCapacities;
  return `Capacity ${c[tier - 1]} → ${c[tier]}`;
}
/** "Farm click fills 2 pips": what Better Hoe tier `tier` (1–2) does to a Farm click (FR24, Story 4.7). */
function hoeEffect(tier: 1 | 2): string {
  return `Farm click fills ${TUNING.hoePipsPerClick[tier - 1]} pips`;
}
/** "Drops food every 10 s": the Auto-feeder's row (mockups/hud.html; FR25, Story 4.8), from TUNING. */
function autoFeederEffect(): string {
  return `Drops food every ${TUNING.autoFeederIntervalMs / 1000} s`;
}
// UX-DR94 / UX-DR95: the era names, for the era badge and the era-up banner.
const ERA_NAME: Readonly<Record<Era, string>> = Object.freeze({
  pasture: 'Pasture',
  village: 'Village',
  town: 'Town',
  'wool-empire': 'Wool Empire',
});

const SHOP_NAME: Readonly<Record<ShopRowId, string>> = Object.freeze({
  land1: 'Land I',
  land2: 'Land II',
  land3: 'Land III',
  flowerPatch: 'Flower Patch',
  scarecrow: 'Scarecrow',
  hoe1: 'Better Hoe I',
  hoe2: 'Better Hoe II',
  autoFeeder: 'Auto-feeder',
  medicine: 'Medicine',
});
const SHOP_EFFECT: Readonly<Record<ShopRowId, string>> = Object.freeze({
  land1: landEffect(1),
  land2: landEffect(2),
  land3: landEffect(3),
  flowerPatch: 'Cosmetic',
  scarecrow: 'Cosmetic',
  // GDD Upgrade Trees: "Farm click fills 2 / 3 pips" (FR24, Story 4.7). The mockup's "Farm click +2" is
  // the wording from before the Farm bar (2026-10-06).
  hoe1: hoeEffect(1),
  hoe2: hoeEffect(2),
  // The mockup's "Drops food every 10 s" (GDD Upgrade Trees: "See Automation Systems"; FR25, Story 4.8).
  autoFeeder: autoFeederEffect(),
  // GDD Upgrade Trees: "Cures 1 infected sheep" (FR26, Story 4.5).
  medicine: 'Cures 1 infected sheep',
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
  // The Medicine slot (UX-DR33, Story 4.5): the doses owned, e.g. "×2" (U+00D7, as the boost badge), and
  // its hover. [ASSUMPTION] UX-DR75 lists no Medicine tooltip; "green" is the GDD's word for infected.
  medicineCount: (n: number): string => `×${n}`,
  medicineTooltip: 'Drag onto a green sheep to cure it.',
  // Sacrifice toast (UX-DR93). Story 5.3 puts the name in place of "A sheep", in `halo`.
  sacrificeToast: 'A sheep went to a Better Place.',
  // Sacrifice reveal toasts (FR33, UX-DR93; EXPERIENCE Voice "Sacrifice reveal"), shown as the sheep
  // lands in the hole. Story 5.3 puts the name in place of "a sheep" ("…that was just {name}.", the
  // name in `halo`). "Good riddance." is an [ASSUMPTION] in the Voice table.
  revealInnocent: '…that was just a sheep.',
  revealAbomination: 'Good riddance.',
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
  // Meter value (UX-DR29), e.g. "3/6" for the Farm bar.
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
  // [ASSUMPTION] Not in the Voice table (approved by Rylan 2026-10-06): the Stats and Credits
  // placeholders until Stories 5.4 and 5.9 (Volume became a real panel in 5.7).
  comingSoon: 'Coming soon.',
  // [ASSUMPTION] Not in the Voice table: the Volume panel's row labels (Story 5.7), named as in
  // EXPERIENCE IA ("Music slider, SFX slider, Reduced motion toggle, Captions toggle"). The header is `volume`.
  volumeMusic: 'Music',
  volumeSfx: 'SFX',
  reducedMotion: 'Reduced motion',
  captionsLabel: 'Captions',
  // [ASSUMPTION] Not in the Voice table: the top-left Pause button (added 2026-10-06, Rylan).
  pauseLabel: 'Pause',
  pauseTooltip: 'Pause (Esc)',
  // The Shop toggle and panel (UX-DR40, UX-DR23, UX-DR95): the toggle's label, the panel header, a
  // bought one-time item's price slot, and a locked Land tier's effect line, e.g. "Needs Land I".
  shopLabel: 'Shop',
  shopHeader: 'Shop',
  shopOwned: 'Owned',
  shopNeeds: (name: string): string => `Needs ${name}`,
  shopName: SHOP_NAME,
  // The flock counter (UX-DR35): living sheep over land capacity, e.g. "12/25".
  flockCount: (alive: number, capacity: number): string => `${alive}/${capacity}`,
  shopEffect: SHOP_EFFECT,
  // The era badge and banner (UX-DR36, UX-DR37; EXPERIENCE Voice, UX-DR94): the era's name, and the
  // regress banner, e.g. "Back to Pasture." (a full stop, never "!").
  eraName: ERA_NAME,
  eraBack: (name: string): string => `Back to ${name}.`,
  // Audio captions (UX-DR88, EXPERIENCE Accessibility Floor; Story 5.6), bracketed. `lastSheep` is for
  // Story 5.5's sting, and the one "!" the copy allows.
  captions: Object.freeze({
    thud: '[thud]',
    suction: '[suction]',
    screech: '[screech]',
    fanfare: '[fanfare]',
    descendingNote: '[descending note]',
    lastSheep: '[sting] Last sheep!',
  }),
} as const);
