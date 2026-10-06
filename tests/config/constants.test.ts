import { describe, expect, it } from 'vitest';
import { COLOR_INT, COLORS, COMPONENTS, RADIUS, TYPOGRAPHY, TYPOGRAPHY_USAGE } from '../../src/config/constants';

describe('design tokens', () => {
  it('defines exactly the 20 DESIGN.md colours as #RRGGBB', () => {
    expect(Object.keys(COLORS)).toHaveLength(20);
    for (const hex of Object.values(COLORS)) expect(hex).toMatch(/^#[0-9A-F]{6}$/);
  });

  it('derives numeric colours from the hex tokens', () => {
    expect(COLOR_INT.wool).toBe(0xfbf4e4);
    expect(COLOR_INT.duskDeep).toBe(0x22152a);
  });

  it('mirrors all 36 DESIGN.md components (button-pause added 2026-10-06) and references only known colour tokens', () => {
    expect(Object.keys(COMPONENTS)).toHaveLength(36);
    for (const spec of Object.values(COMPONENTS)) {
      for (const [field, value] of Object.entries(spec)) {
        if (field.endsWith('Color') || field.endsWith('Background') || field.endsWith('Text')) {
          expect(COLORS).toHaveProperty(String(value));
        }
        if (field === 'typography' || field.endsWith('Typography')) expect(TYPOGRAPHY).toHaveProperty(String(value));
        if (field === 'rounded') expect(RADIUS).toHaveProperty(String(value));
      }
    }
  });

  it('is deep-frozen', () => {
    expect(Object.isFrozen(COLORS)).toBe(true);
    expect(Object.isFrozen(COMPONENTS)).toBe(true);
    for (const spec of Object.values(COMPONENTS)) expect(Object.isFrozen(spec)).toBe(true);
    for (const role of Object.values(TYPOGRAPHY)) expect(Object.isFrozen(role)).toBe(true);
    for (const uses of Object.values(TYPOGRAPHY_USAGE)) expect(Object.isFrozen(uses)).toBe(true);
  });
});
