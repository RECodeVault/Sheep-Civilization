import { describe, expect, it } from 'vitest';
import { fontLoaded, invariantFits, noteFontLoaded } from '../../src/view/fonts';

describe('invariantFits (fixed-width text boxes)', () => {
  it('skips the check for a family that fell back (font timeout), so the fallback never throws', () => {
    expect(fontLoaded('Fallback Only')).toBe(false);
    expect(() => invariantFits('Fallback Only', 200, 128, 'too wide')).not.toThrow();
  });

  it('checks the fit once the family has loaded', () => {
    noteFontLoaded('Loaded Face');
    expect(fontLoaded('Loaded Face')).toBe(true);
    expect(() => invariantFits('Loaded Face', 128, 128, 'too wide')).not.toThrow();
    expect(() => invariantFits('Loaded Face', 129, 128, 'too wide')).toThrow(/too wide/);
  });
});
