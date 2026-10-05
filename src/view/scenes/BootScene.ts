import Phaser from 'phaser';
import { COLORS } from '../../config/constants';
import { log } from '../../core/log';

// First scene: sets the dusk background and hands over to PreloadScene (loading bar + assets).
export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  create(): void {
    this.cameras.main.setBackgroundColor(COLORS.dusk);
    log.info('boot', 'Boot scene ready');
    this.scene.start('PreloadScene');
  }
}
