import { invariant } from '../core/invariant';

// The font families that really loaded at boot (main.ts). A face that failed or timed out falls back to
// a system font with other metrics, so a width measured in it says nothing about the shipped copy.
const loaded = new Set<string>();

/** main.ts: `family` loaded and was added to document.fonts. */
export function noteFontLoaded(family: string): void {
  loaded.add(family);
}

/** True when `family` loaded at boot (false for a fallback). */
export function fontLoaded(family: string): boolean {
  return loaded.has(family);
}

/**
 * A fixed-width box's fit check: `width` (text measured in `family`) must be at most `max`. Checked only
 * when the family loaded, so a fallback font after a font timeout never throws in DEV (Story 3.5 review).
 */
export function invariantFits(family: string, width: number, max: number, msg: string): void {
  if (fontLoaded(family)) invariant(width <= max, msg);
}
