import Phaser from 'phaser';
import { CANVAS_HEIGHT, CANVAS_WIDTH, COLOR_INT, COLORS } from '../../config/constants';
import { log } from '../../core/log';
import { ATLAS, atlasUrls } from '../assetKeys';

const BAR_WIDTH = 400;
const BAR_HEIGHT = 16;
const BAR_OUTLINE = 2;

// Loads every runtime asset behind a loading bar on dusk, then starts the game.
// TitleScene arrives in Story 1.10; until then Preload goes straight to GameScene.
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

    for (const key of [ATLAS.sheepWorld, ATLAS.ui]) {
      const urls = atlasUrls(key);
      this.load.atlas(key, urls.png, urls.json);
    }
  }

  create(): void {
    log.info('boot', 'Assets loaded');
    this.scene.start('GameScene');
  }
}
