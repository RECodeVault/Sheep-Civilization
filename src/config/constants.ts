// Engine constants and DESIGN.md tokens. Pure data: no Phaser, no DOM.
// Source of truth for tokens: _bmad-output/planning-artifacts/ux-designs/ux-sheep-civilization-2026-10-05/DESIGN.md

export const TICK_MS = 100;
// Longest real frame the sim accumulator accepts; longer frames are clamped (no spiral of death).
export const MAX_FRAME_MS = 250;

export const CANVAS_WIDTH = 1280;
export const CANVAS_HEIGHT = 720;

export const SAVE_KEY = 'sheepciv.save.v1';
export const SETTINGS_KEY = 'sheepciv.settings';
export const SAVE_SCHEMA_VERSION = 1;

/*
 * Colour-usage rules (DESIGN.md Colors, Do's and Don'ts — UX-DR2):
 * - Money is `hay`, never `halo`.
 * - Boost is `halo`, so the Farm button echoes the Better Place.
 * - `awning` is the Market (commerce); never use it for alerts.
 * - `alert` is for threats; never use it for the Market.
 * - `void` is the Better Place hole and boost pill; never use it for panels.
 * - `infection` marks sickness only; never put it on healthy things.
 * - `pasture` is a reference tone for background art only, not UI chrome.
 * View code takes colours from COLORS only — no hex literals outside this file.
 */
export const COLORS = Object.freeze({
  wool: '#FBF4E4',
  woolShade: '#EADBBE',
  bark: '#3A2A1F',
  barkSoft: '#6B5444',
  pasture: '#86B85C',
  hay: '#E9A23B',
  hayDeep: '#B86F1C',
  heart: '#E27894',
  heartDeep: '#A8405D',
  awning: '#B8453A',
  wood: '#8E5A30',
  void: '#160E1C',
  halo: '#F6D86B',
  haze: '#8E5BB0',
  dusk: '#3B2540',
  duskDeep: '#22152A',
  infection: '#B4E03C',
  alert: '#E8503A',
  disabled: '#C9BCA6',
  disabledInk: '#6E6052',
} as const);

export type ColorToken = keyof typeof COLORS;

/** Numeric form of COLORS for Phaser tint/fill APIs (e.g. 0xfbf4e4). */
export const COLOR_INT: Readonly<Record<ColorToken, number>> = Object.freeze(
  Object.fromEntries(
    Object.entries(COLORS).map(([token, hex]) => [token, parseInt(hex.slice(1), 16)]),
  ) as Record<ColorToken, number>,
);

/** Freezes an object and every nested object/array (token tables are plain data). */
function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

export const FONT_FAMILIES = Object.freeze({
  pixel: 'Pixelify Sans',
  body: 'Nunito',
} as const);

export interface TypographyRole {
  readonly fontFamily: string;
  readonly fontSize: number;
  readonly fontWeight: number;
  readonly lineHeight: number;
}

export const TYPOGRAPHY = deepFreeze({
  display: { fontFamily: FONT_FAMILIES.pixel, fontSize: 56, fontWeight: 700, lineHeight: 1.1 },
  title: { fontFamily: FONT_FAMILIES.pixel, fontSize: 32, fontWeight: 600, lineHeight: 1.2 },
  label: { fontFamily: FONT_FAMILIES.pixel, fontSize: 20, fontWeight: 500, lineHeight: 1.2 },
  numeric: { fontFamily: FONT_FAMILIES.pixel, fontSize: 22, fontWeight: 600, lineHeight: 1 },
  body: { fontFamily: FONT_FAMILIES.body, fontSize: 18, fontWeight: 600, lineHeight: 1.35 },
  caption: { fontFamily: FONT_FAMILIES.body, fontSize: 18, fontWeight: 800, lineHeight: 1.3 },
  popup: { fontFamily: FONT_FAMILIES.pixel, fontSize: 24, fontWeight: 700, lineHeight: 1 },
} as const satisfies Record<string, TypographyRole>);

export type TypographyToken = keyof typeof TYPOGRAPHY;

/** Which UI elements use which typography role (UX-DR4). */
export const TYPOGRAPHY_USAGE = deepFreeze({
  display: ['title logo', 'era banner', '"The flock is gone."'],
  title: ['menu headers ("Paused")', '"Last sheep!"'],
  label: ['all buttons', 'shop row names and prices', '"Shop" header', 'era badge'],
  numeric: ['meter values', 'money', 'flock/capacity', 'boost timer'],
  body: ['tooltips', 'announcement toasts'],
  caption: ['audio captions', 'shop row effect lines'],
  popup: ['"+1" / "+2" / "$10" float popups'],
} as const satisfies Record<TypographyToken, readonly string[]>);

export const RADIUS = Object.freeze({ sm: 4, md: 8, lg: 12, full: 9999 } as const);

export type RadiusToken = keyof typeof RADIUS;

export const SPACING = Object.freeze({ 1: 4, 2: 8, 3: 12, 4: 16, 5: 24, 6: 32 } as const);

export const LAYOUT = Object.freeze({
  canvasWidth: CANVAS_WIDTH,
  canvasHeight: CANVAS_HEIGHT,
  safeMargin: 16,
  hudBarHeight: 112,
  hitMin: 40,
} as const);

// Per-field token check for component specs: fields named `…Color` / `…Background` / `…Text` must
// be a COLORS key, `typography` / `…Typography` a TYPOGRAPHY key, `rounded` a RADIUS key.
type CheckedSpec<S> = {
  [K in keyof S]: K extends `${string}Color` | `${string}Background` | `${string}Text`
    ? ColorToken
    : K extends 'typography' | `${string}Typography`
      ? TypographyToken
      : K extends 'rounded'
        ? RadiusToken
        : S[K];
};

function defineComponents<const T extends Record<string, Record<string, string | number>>>(
  specs: T & { [N in keyof T]: CheckedSpec<T[N]> },
): { readonly [N in keyof T]: Readonly<T[N]> } {
  return deepFreeze(specs);
}

/** Mirrors DESIGN.md front matter `components`. Colours are COLORS keys, sizes are px. */
export const COMPONENTS = defineComponents({
  buttonFarm: {
    backgroundColor: 'hay',
    // UX-DR26: the pressed state uses hay-deep (and loses its drop offset).
    pressedBackgroundColor: 'hayDeep',
    borderColor: 'hayDeep',
    textColor: 'bark',
    typography: 'label',
    rounded: 'md',
    height: 64,
    padding: SPACING[3],
  },
  buttonFarmBoosted: {
    backgroundColor: 'hay',
    glowColor: 'halo',
    badgeColor: 'void',
    badgeTextColor: 'halo',
  },
  buttonBreedFood: {
    backgroundColor: 'heart',
    borderColor: 'heartDeep',
    textColor: 'bark',
    typography: 'label',
    rounded: 'md',
    height: 64,
  },
  buttonBreedTool: {
    backgroundColor: 'wool',
    borderColor: 'heartDeep',
    textColor: 'bark',
    activeBackgroundColor: 'heartDeep',
    activeTextColor: 'wool',
    rounded: 'md',
    height: 56,
  },
  buttonDisabled: {
    backgroundColor: 'disabled',
    textColor: 'disabledInk',
    opacity: 1,
  },
  buttonMenu: {
    backgroundColor: 'wool',
    borderColor: 'bark',
    textColor: 'bark',
    hoverBackgroundColor: 'hay',
    typography: 'label',
    rounded: 'md',
    width: 280,
    height: 52,
  },
  buttonMenuDestructive: {
    backgroundColor: 'awning',
    borderColor: 'bark',
    textColor: 'wool',
    hoverBackgroundColor: 'alert',
    typography: 'label',
    rounded: 'md',
    width: 280,
    height: 52,
  },
  shopToggle: {
    backgroundColor: 'wood',
    textColor: 'wool',
    openBackgroundColor: 'hay',
    openTextColor: 'bark',
    typography: 'label',
    rounded: 'md',
    height: 56,
  },
  panel: {
    backgroundColor: 'wool',
    borderColor: 'bark',
    insetColor: 'woolShade',
    textColor: 'bark',
    rounded: 'lg',
    padding: SPACING[4],
  },
  shopPanel: {
    backgroundColor: 'wool',
    borderColor: 'wood',
    width: 360,
    headerTypography: 'label',
    rounded: 'lg',
    padding: SPACING[4],
  },
  shopItemRow: {
    backgroundColor: 'woolShade',
    textColor: 'bark',
    priceColor: 'bark',
    unaffordableTextColor: 'disabledInk',
    typography: 'label',
    effectTypography: 'caption',
    rounded: 'md',
    height: 56,
  },
  slider: {
    trackColor: 'woolShade',
    fillColor: 'hay',
    thumbColor: 'bark',
    height: 40,
  },
  toggle: {
    offColor: 'woolShade',
    onColor: 'hay',
    knobColor: 'bark',
    height: 32,
  },
  menuScrim: {
    backgroundColor: 'duskDeep',
    opacity: 0.72,
  },
  menuScrimStart: {
    backgroundColor: 'duskDeep',
    opacity: 0.4,
  },
  foodMeter: {
    trackColor: 'woolShade',
    fillColor: 'hay',
    segmentCount: 20,
    emptyFlashColor: 'alert',
    valueTypography: 'numeric',
  },
  breedingMeter: {
    trackColor: 'woolShade',
    fillColor: 'heart',
    segmentCount: 10,
    costMarkerColor: 'heartDeep',
    valueTypography: 'numeric',
  },
  moneyCounter: {
    textColor: 'bark',
    iconColor: 'hay',
    typography: 'numeric',
  },
  flockCounter: {
    textColor: 'bark',
    crowdedColor: 'alert',
    typography: 'numeric',
  },
  eraBadge: {
    backgroundColor: 'dusk',
    textColor: 'wool',
    typography: 'label',
    rounded: 'full',
  },
  eraBanner: {
    backgroundColor: 'dusk',
    textColor: 'halo',
    regressTextColor: 'woolShade',
    typography: 'display',
  },
  boostTimer: {
    backgroundColor: 'void',
    textColor: 'halo',
    typography: 'numeric',
    rounded: 'full',
  },
  threatSummary: {
    textColor: 'bark',
    zeroTextColor: 'disabledInk',
    starvingIconColor: 'alert',
    infectedIconColor: 'infection',
    carcassIconColor: 'barkSoft',
    typography: 'numeric',
  },
  alertPing: {
    fillColor: 'alert',
    outlineColor: 'bark',
    glyphColor: 'wool',
    size: 20,
  },
  infectionMarker: {
    fillColor: 'infection',
    outlineColor: 'bark',
    size: 16,
  },
  tooltip: {
    backgroundColor: 'duskDeep',
    textColor: 'wool',
    accentColor: 'heart',
    typography: 'body',
    rounded: 'sm',
    padding: SPACING[2],
  },
  dropTargetMarket: {
    highlightColor: 'awning',
    priceTagBackground: 'awning',
    priceTagText: 'wool',
    shape: 'rectangle',
  },
  dropTargetBetterPlace: {
    holeColor: 'void',
    ringColor: 'halo',
    glowColor: 'haze',
    labelColor: 'halo',
    shape: 'ring',
  },
  dropTargetInvalid: {
    tintColor: 'disabled',
  },
  announcementToast: {
    backgroundColor: 'dusk',
    textColor: 'wool',
    nameColor: 'halo',
    typography: 'body',
    rounded: 'md',
  },
  lastSheepBanner: {
    backgroundColor: 'alert',
    textColor: 'bark',
    typography: 'title',
  },
  caption: {
    backgroundColor: 'duskDeep',
    textColor: 'wool',
    typography: 'caption',
    rounded: 'sm',
  },
  floatPopup: {
    textColor: 'wool',
    outlineColor: 'bark',
    typography: 'popup',
  },
  losePanel: {
    backgroundColor: 'dusk',
    textColor: 'wool',
    statColor: 'halo',
    rounded: 'lg',
  },
  medicineSlot: {
    backgroundColor: 'wool',
    iconColor: 'infection',
    textColor: 'bark',
    rounded: 'md',
  },
});
