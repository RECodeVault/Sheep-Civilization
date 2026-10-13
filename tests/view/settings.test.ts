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

  it('a page closed mid-drag saves the live value on pagehide, once', async () => {
    const listeners: Record<string, () => void> = {};
    const addEventListener = vi.fn((type: string, fn: () => void) => (listeners[type] = fn));
    vi.stubGlobal('window', { addEventListener });
    try {
      const { updateSettings } = await load();
      updateSettings({ musicVolume: 0.2 }, { persist: false });
      updateSettings({ musicVolume: 0.15 }, { persist: false });
      expect(addEventListener).toHaveBeenCalledOnce();
      expect(saveSettings).not.toHaveBeenCalled();
      listeners.pagehide();
      expect(saveSettings).toHaveBeenCalledOnce();
      expect(saveSettings.mock.calls[0][0].musicVolume).toBe(0.15);
      listeners.pagehide();
      expect(saveSettings).toHaveBeenCalledOnce();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('pagehide after the release saves nothing more', async () => {
    const listeners: Record<string, () => void> = {};
    vi.stubGlobal('window', { addEventListener: (type: string, fn: () => void) => (listeners[type] = fn) });
    try {
      const { updateSettings } = await load();
      updateSettings({ sfxVolume: 0.3 }, { persist: false });
      updateSettings({ sfxVolume: 0.3 });
      listeners.pagehide();
      expect(saveSettings).toHaveBeenCalledOnce();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('a page hidden mid-drag saves the live value on visibilitychange (mobile may skip pagehide)', async () => {
    const onDoc: Record<string, () => void> = {};
    const doc = { visibilityState: 'visible', addEventListener: (type: string, fn: () => void) => (onDoc[type] = fn) };
    vi.stubGlobal('window', { addEventListener: () => undefined });
    vi.stubGlobal('document', doc);
    try {
      const { updateSettings } = await load();
      updateSettings({ musicVolume: 0.25 }, { persist: false });
      onDoc.visibilitychange();
      expect(saveSettings).not.toHaveBeenCalled();
      doc.visibilityState = 'hidden';
      onDoc.visibilitychange();
      expect(saveSettings).toHaveBeenCalledOnce();
      expect(saveSettings.mock.calls[0][0].musicVolume).toBe(0.25);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('a failed write on pagehide stays unsaved and is tried again', async () => {
    const listeners: Record<string, () => void> = {};
    vi.stubGlobal('window', { addEventListener: (type: string, fn: () => void) => (listeners[type] = fn) });
    try {
      const { updateSettings } = await load();
      updateSettings({ sfxVolume: 0.6 }, { persist: false });
      saveSettings.mockReturnValueOnce(false);
      listeners.pagehide();
      listeners.pagehide();
      expect(saveSettings).toHaveBeenCalledTimes(2);
      listeners.pagehide();
      expect(saveSettings).toHaveBeenCalledTimes(2);
    } finally {
      vi.unstubAllGlobals();
    }
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
