import { invariant } from '../core/invariant';
import { log } from '../core/log';

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

// Fallback overflows already warned about: once per message, so a box rebuilt on restart stays quiet.
const warned = new Set<string>();

/**
 * A fixed-width box's fit check: `width` (text measured in `family`) must be at most `max`. Asserted only
 * when the family loaded, so a fallback font after a font timeout never throws in DEV (Story 3.5 review);
 * in a fallback, an overflow is a warning, once per message, so it is still seen.
 */
export function invariantFits(family: string, width: number, max: number, msg: string): void {
  if (fontLoaded(family)) {
    invariant(width <= max, msg);
    return;
  }
  if (width <= max || warned.has(msg)) return;
  warned.add(msg);
  log.warn('ui', `${msg} (in the fallback for ${family})`);
}
