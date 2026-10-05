import { afterEach, describe, expect, it, vi } from 'vitest';
import { invariant } from '../../src/core/invariant';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe('invariant', () => {
  it('does nothing when the condition holds', () => {
    expect(() => invariant(true, 'fine')).not.toThrow();
    expect(() => invariant({}, 'fine')).not.toThrow();
  });

  it('throws in DEV when the condition fails', () => {
    expect(() => invariant(undefined, 'unknown sheep 7')).toThrow('Invariant: unknown sheep 7');
  });

  it('logs via log.error instead of throwing in production', () => {
    vi.stubEnv('DEV', false);
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => invariant(0, 'bad count')).not.toThrow();
    expect(err).toHaveBeenCalledWith('[sim] Invariant: bad count');
  });
});
