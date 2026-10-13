import Phaser from 'phaser';
import { CANVAS_HEIGHT, CANVAS_WIDTH, COMPONENTS, LAYOUT, SPACING } from '../../config/constants';
import type { Settings } from '../../save/settingsStore';
import { audioDirector } from '../audio/AudioDirector';
import { bus } from '../bus';
import { guarded } from '../safetyNet';
import { getSettings, updateSettings } from '../settings';
import { STRINGS } from '../strings';
import { textStyle } from '../widgets/box';
import { Button } from '../widgets/Button';
import { Panel } from '../widgets/Panel';
import { Slider } from '../widgets/Slider';
import { Toggle } from '../widgets/Toggle';
import { lineBox, type Modal } from './MenuPanel';

const BUTTON = COMPONENTS.buttonMenu;
const TEXT_COLOR = COMPONENTS.panel.textColor;
// Same frame as the pause panel and the placeholder: padding 16, 12 px under the header, 24 px above Back.
const PAD = SPACING[4];
const HEADER_GAP = SPACING[3];
const BODY_GAP = SPACING[5];
// Four rows (two sliders, two toggles), each as tall as the slider's thumb and never under hit-min.
const ROW_H = Math.max(LAYOUT.hitMin, Slider.HEIGHT);
const ROW_GAP = SPACING[3];
const ROWS = 4;
// [ASSUMPTION, tune in the browser] Room for "Reduced motion" in label type, then the controls,
// right-aligned; the sliders take the rest of the width.
const LABEL_W = 170;
const LABEL_GAP = SPACING[3];
const WIDTH = 480;
const HEIGHT = PAD + lineBox('title') + HEADER_GAP + ROWS * ROW_H + (ROWS - 1) * ROW_GAP + BODY_GAP + BUTTON.height + PAD;
const X = Math.round((CANVAS_WIDTH - WIDTH) / 2);
const Y = Math.round((CANVAS_HEIGHT - HEIGHT) / 2);
const CONTROLS_LEFT = X + PAD + LABEL_W + LABEL_GAP;
const CONTROLS_RIGHT = X + WIDTH - PAD;
const SLIDER_X = CONTROLS_LEFT + Slider.OVERHANG;
const SLIDER_W = CONTROLS_RIGHT - Slider.OVERHANG - SLIDER_X;

type Volume = 'musicVolume' | 'sfxVolume';

/**
 * The Volume panel (UX-DR15, Story 5.7), opened from Pause: Music and SFX sliders, Reduced motion and
 * Captions toggles, and Back. Every change goes through `updateSettings` and applies at once: a slider
 * updates live while dragging (no storage write) and saves on release; releasing the SFX slider
 * previews the level with a bleat (UX-DR22). Built once and hidden; showing it reads the current
 * settings first, and while shown it follows `settings:changed`, so it always shows the truth (after a
 * reload, or a debug toggle while it is open).
 */
export class VolumePanel implements Modal {
  private readonly panel: Panel;
  private readonly texts: Phaser.GameObjects.Text[] = [];
  private readonly music: Slider;
  private readonly sfx: Slider;
  private readonly motion: Toggle;
  private readonly captions: Toggle;
  private readonly back: Button;
  private shown = false;

  constructor(scene: Phaser.Scene, depth: number, onBack: () => void) {
    const cx = CANVAS_WIDTH / 2;
    const s = getSettings();
    this.panel = new Panel(scene).setBounds(X, Y, WIDTH, HEIGHT).setDepth(depth);
    let y = Y + PAD;
    this.texts.push(
      scene.add
        .text(cx, y + lineBox('title') / 2, STRINGS.volume, textStyle('title', TEXT_COLOR))
        .setOrigin(0.5, 0.5)
        .setDepth(depth + 1),
    );
    y += lineBox('title') + HEADER_GAP;

    const row = (label: string): number => {
      const top = y;
      this.texts.push(
        scene.add
          .text(X + PAD, top + ROW_H / 2, label, textStyle('label', TEXT_COLOR))
          .setOrigin(0, 0.5)
          .setDepth(depth + 1),
      );
      y += ROW_H + ROW_GAP;
      return top;
    };

    this.music = this.slider(scene, row(STRINGS.volumeMusic), 'musicVolume', s.musicVolume, false).setDepth(depth + 1);
    this.sfx = this.slider(scene, row(STRINGS.volumeSfx), 'sfxVolume', s.sfxVolume, true).setDepth(depth + 1);
    const toggleX = CONTROLS_RIGHT - Toggle.WIDTH;
    const toggleY = (top: number): number => top + (ROW_H - Toggle.HEIGHT) / 2;
    this.motion = new Toggle(scene, {
      x: toggleX,
      y: toggleY(row(STRINGS.reducedMotion)),
      on: s.reducedMotion,
      onToggle: guarded((on: boolean) => updateSettings({ reducedMotion: on })),
    }).setDepth(depth + 1);
    this.captions = new Toggle(scene, {
      x: toggleX,
      y: toggleY(row(STRINGS.captionsLabel)),
      on: s.captions,
      onToggle: guarded((on: boolean) => updateSettings({ captions: on })),
    }).setDepth(depth + 1);

    y += BODY_GAP - ROW_GAP;
    this.back = new Button(scene, BUTTON, {
      x: cx - BUTTON.width / 2,
      y,
      width: BUTTON.width,
      label: STRINGS.back,
      labelAlign: 'center',
      activateOn: 'release',
      onActivate: guarded(onBack),
    }).setDepth(depth + 1);
    this.setVisible(false);
    bus.on('settings:changed', this.onSettings, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => bus.off('settings:changed', this.onSettings, this));
  }

  setVisible(visible: boolean): void {
    this.shown = visible;
    if (visible) this.sync(getSettings());
    this.panel.setVisible(visible);
    for (const t of this.texts) t.setVisible(visible);
    // Hiding mid-drag (Esc, Back) ends the drag through the slider's onRelease(…, false): saved, no preview.
    this.music.setVisible(visible);
    this.sfx.setVisible(visible);
    this.motion.setVisible(visible);
    this.captions.setVisible(visible);
    this.back.setVisible(visible);
  }

  private onSettings(s: Readonly<Settings>): void {
    if (this.shown) this.sync(s);
  }

  // A slider mid-drag ignores setValue, so its own live updates never fight the pointer.
  private sync(s: Readonly<Settings>): void {
    this.music.setValue(s.musicVolume);
    this.sfx.setValue(s.sfxVolume);
    this.motion.setOn(s.reducedMotion);
    this.captions.setOn(s.captions);
  }

  private slider(scene: Phaser.Scene, top: number, key: Volume, value: number, preview: boolean): Slider {
    const patch = (v: number): Partial<Settings> => (key === 'musicVolume' ? { musicVolume: v } : { sfxVolume: v });
    return new Slider(scene, {
      x: SLIDER_X,
      y: top + (ROW_H - Slider.HEIGHT) / 2,
      width: SLIDER_W,
      value,
      // Live while dragging (the music follows the thumb); saved once, on release.
      onChange: guarded((v: number) => updateSettings(patch(v), { persist: false })),
      onRelease: guarded((v: number, released: boolean) => {
        updateSettings(patch(v));
        // After the update, so the bleat plays at the new level. Not when the panel closed mid-drag.
        if (preview && released) audioDirector()?.previewSfx();
      }),
    });
  }
}
