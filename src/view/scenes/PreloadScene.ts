import Phaser from 'phaser';
import { CANVAS_HEIGHT, CANVAS_WIDTH, COLOR_INT, COLORS } from '../../config/constants';
import { log } from '../../core/log';
import { ERAS } from '../../sim/selectors';
import { ATLAS, atlasUrls, AUDIO, audioSpriteUrls, backgroundUrl, musicUrls } from '../assetKeys';
import { createAudioDirector } from '../audio/AudioDirector';
import { showToast } from '../safetyNet';
import { STRINGS } from '../strings';

const BAR_WIDTH = 400;
const BAR_HEIGHT = 16;
const BAR_OUTLINE = 2;
const ATLASES = [ATLAS.sheepWorld, ATLAS.ui] as const;

// Loads every runtime asset behind a loading bar on dusk, creates the page's AudioDirector, then shows
// the title, which decides between Continue and New Game (it owns the save load).
// A failed file is a recoverable boundary failure: log a warning, tell the player once, carry on.
export class PreloadScene extends Phaser.Scene {
  constructor() {
    super('PreloadScene');
  }

  preload(): void {
    this.cameras.main.setBackgroundColor(COLORS.dusk);

    const x = (CANVAS_WIDTH - BAR_WIDTH) / 2;
    const y = (CANVAS_HEIGHT - BAR_HEIGHT) / 2;
    const track = this.add.graphics();
    track.fillStyle(COLOR_INT.wool, 1);
    track.fillRect(x - BAR_OUTLINE, y - BAR_OUTLINE, BAR_WIDTH + BAR_OUTLINE * 2, BAR_HEIGHT + BAR_OUTLINE * 2);
    track.fillStyle(COLOR_INT.duskDeep, 1);
    track.fillRect(x, y, BAR_WIDTH, BAR_HEIGHT);
    const fill = this.add.graphics();

    // Redrawn on progress events only, never per frame.
    this.load.on(Phaser.Loader.Events.PROGRESS, (value: number) => {
      fill.clear();
      fill.fillStyle(COLOR_INT.hay, 1);
      fill.fillRect(x, y, Math.round(BAR_WIDTH * value), BAR_HEIGHT);
    });
    this.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, (file: Phaser.Loader.File) => {
      log.warn('boot', `Asset failed to load: ${file.key}`, file.src);
    });

    for (const key of ATLASES) {
      const urls = atlasUrls(key);
      this.load.atlas(key, urls.png, urls.json);
    }
    // The era backgrounds (Story 3.5), keyed by Era id.
    for (const era of ERAS) this.load.image(era, backgroundUrl(era));
    // Story 5.6: the SFX audio sprite and the music loop (OGG first, MP3 fallback).
    const sfx = audioSpriteUrls();
    this.load.audioSprite(AUDIO.sfx, sfx.json, sfx.audio);
    this.load.audio(AUDIO.music, musicUrls());
  }

  create(): void {
    // Checks the outcome, not loader events: a file that downloads but fails to parse (e.g. an HTML
    // fallback page served for a missing .json) never fires FILE_LOAD_ERROR.
    const missing = [...ATLASES, ...ERAS].filter((key) => !this.textures.exists(key));
    if (missing.length > 0) {
      log.warn('boot', 'Textures missing after load', missing);
      showToast(STRINGS.assetLoadFailed);
    } else {
      log.info('boot', 'Assets loaded');
    }
    // Missing audio only warns (inside the director) and plays silently: no toast blocks play (AC 2).
    // Made once per page, before the title, so the music starts there on the first input.
    // A failure here is a recoverable boundary failure: the game runs silent rather than not at all.
    try {
      createAudioDirector(this.game);
    } catch (err) {
      log.warn('audio', 'Audio unavailable; playing silently', err);
    }
    this.scene.start('TitleScene');
  }
}
