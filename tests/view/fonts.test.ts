import { describe, expect, it, vi } from 'vitest';
import { fontLoaded, invariantFits, noteFontLoaded } from '../../src/view/fonts';

describe('invariantFits (fixed-width text boxes)', () => {
  it('a family that fell back (font timeout) never throws: an overflow warns, once per message', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      expect(fontLoaded('Fallback Only')).toBe(false);
      expect(() => invariantFits('Fallback Only', 100, 128, 'fits')).not.toThrow();
      expect(warn).not.toHaveBeenCalled();
      expect(() => invariantFits('Fallback Only', 200, 128, 'too wide')).not.toThrow();
      invariantFits('Fallback Only', 200, 128, 'too wide');
      expect(warn).toHaveBeenCalledOnce();
      expect(String(warn.mock.calls[0])).toMatch(/too wide/);
    } finally {
      warn.mockRestore();
    }
  });

  it('checks the fit once the family has loaded', () => {
    noteFontLoaded('Loaded Face');
    expect(fontLoaded('Loaded Face')).toBe(true);
    expect(() => invariantFits('Loaded Face', 128, 128, 'too wide')).not.toThrow();
    expect(() => invariantFits('Loaded Face', 129, 128, 'too wide')).toThrow(/too wide/);
  });
});
