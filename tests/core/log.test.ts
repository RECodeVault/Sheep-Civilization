import { afterEach, describe, expect, it, vi } from 'vitest';
import { log } from '../../src/core/log';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe('log', () => {
  it('formats messages as [tag] message, passing data through', () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const data = { sheep: 3 };
    log.error('sim', 'Broken', data);
    log.warn('save', 'Unreadable');
    expect(err).toHaveBeenCalledWith('[sim] Broken', data);
    expect(warn).toHaveBeenCalledWith('[save] Unreadable');
  });

  it('emits info and debug in DEV', () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    const debug = vi.spyOn(console, 'debug').mockImplementation(() => {});
    log.info('boot', 'Ready');
    log.debug('input', 'Pointer', { x: 1 });
    expect(info).toHaveBeenCalledWith('[boot] Ready');
    expect(debug).toHaveBeenCalledWith('[input] Pointer', { x: 1 });
  });

  it('drops info and debug in production but keeps warn and error', () => {
    vi.stubEnv('DEV', false);
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    const debug = vi.spyOn(console, 'debug').mockImplementation(() => {});
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    log.info('boot', 'Ready');
    log.debug('debug', 'Noise');
    log.warn('audio', 'Locked');
    log.error('sim', 'Bad');
    expect(info).not.toHaveBeenCalled();
    expect(debug).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledOnce();
    expect(err).toHaveBeenCalledOnce();
  });
});
