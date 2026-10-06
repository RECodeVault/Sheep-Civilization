import Phaser from 'phaser';
import { CANVAS_HEIGHT, CANVAS_WIDTH, COLOR_INT, COLORS } from '../../config/constants';
import { log } from '../../core/log';
import { ATLAS, atlasUrls } from '../assetKeys';
import { showToast } from '../safetyNet';
import { STRINGS } from '../strings';

const BAR_WIDTH = 400;
const BAR_HEIGHT = 16;
const BAR_OUTLINE = 2;
const ATLASES = [ATLAS.sheepWorld, ATLAS.ui] as const;

// Loads every runtime asset behind a loading bar on dusk, then shows the title, which decides
// between Continue and New Game (it owns the save load).
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
  }

  create(): void {
    // Checks the outcome, not loader events: a file that downloads but fails to parse (e.g. an HTML
    // fallback page served for a missing .json) never fires FILE_LOAD_ERROR.
    const missing = ATLASES.filter((key) => !this.textures.exists(key));
    if (missing.length > 0) {
      log.warn('boot', 'Atlases missing after load', missing);
      showToast(STRINGS.assetLoadFailed);
    } else {
      log.info('boot', 'Assets loaded');
    }
    this.scene.start('TitleScene');
  }
}
