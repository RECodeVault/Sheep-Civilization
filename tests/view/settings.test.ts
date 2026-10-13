import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Settings } from '../../src/save/settingsStore';

// settings.ts keeps the live settings in module state: a fresh copy per test, with the store's
// load and save replaced so no storage is touched.
const saveSettings = vi.fn((_s: Readonly<Settings>) => true);
vi.mock('../../src/save/settingsStore', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../src/save/settingsStore')>();
  return { ...real, loadSettings: () => ({ ...real.DEFAULT_SETTINGS }), saveSettings };
});

const load = async () => {
  vi.resetModules();
  const settings = await import('../../src/view/settings');
  const { bus } = await import('../../src/view/bus');
  const seen: Readonly<Settings>[] = [];
  bus.on('settings:changed', (s) => seen.push(s));
  return { ...settings, seen };
};

describe('updateSettings', () => {
  beforeEach(() => saveSettings.mockClear());

  it('saves and announces the change by default', async () => {
    const { updateSettings, getSettings, seen } = await load();
    const next = updateSettings({ musicVolume: 0.3 });
    expect(next.musicVolume).toBe(0.3);
    expect(getSettings()).toBe(next);
    expect(saveSettings).toHaveBeenCalledOnce();
    expect(saveSettings).toHaveBeenCalledWith(next);
    expect(seen).toEqual([next]);
  });

  it('persist: false applies and announces without saving (a slider drag)', async () => {
    const { updateSettings, getSettings, seen } = await load();
    const next = updateSettings({ sfxVolume: 0.4 }, { persist: false });
    expect(getSettings().sfxVolume).toBe(0.4);
    expect(saveSettings).not.toHaveBeenCalled();
    expect(seen).toEqual([next]);
  });

  it('the release after a drag saves the last live value', async () => {
    const { updateSettings } = await load();
    updateSettings({ musicVolume: 0.2 }, { persist: false });
    updateSettings({ musicVolume: 0.1 }, { persist: false });
    updateSettings({ musicVolume: 0.1 });
    expect(saveSettings).toHaveBeenCalledOnce();
    expect(saveSettings.mock.calls[0][0].musicVolume).toBe(0.1);
  });

  it('keeps the current value for an invalid field', async () => {
    const { updateSettings } = await load();
    expect(updateSettings({ musicVolume: Number.NaN }).musicVolume).toBe(updateSettings({}).musicVolume);
  });

  it('reducedMotion() reads the live setting', async () => {
    const { updateSettings, reducedMotion } = await load();
    expect(reducedMotion()).toBe(false);
    updateSettings({ reducedMotion: true }, { persist: false });
    expect(reducedMotion()).toBe(true);
  });
});
