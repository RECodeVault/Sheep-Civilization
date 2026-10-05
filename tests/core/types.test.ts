import { describe, expect, it } from 'vitest';
import { assertNever } from '../../src/core/types';

describe('assertNever', () => {
  it('throws naming the unexpected variant', () => {
    const rogue = { type: 'Rogue' } as never;
    expect(() => assertNever(rogue)).toThrow('Unexpected variant: {"type":"Rogue"}');
  });

  it('still reports the variant when it cannot be JSON-serialised', () => {
    expect(() => assertNever(10n as never)).toThrow('Unexpected variant: 10');
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(() => assertNever(circular as never)).toThrow('Unexpected variant: [object Object]');
    expect(() => assertNever(undefined as never)).toThrow('Unexpected variant: undefined');
  });
});
