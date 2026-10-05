import Phaser from 'phaser';
import { COLORS } from '../../config/constants';
import { log } from '../../core/log';

// First scene. Story 1.2 adds PreloadScene (loading bar) and moves on from here.
export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  create(): void {
    this.cameras.main.setBackgroundColor(COLORS.dusk);
    log.info('boot', 'Boot scene ready');
  }
}
