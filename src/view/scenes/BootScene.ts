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
    // UX-DR74: right-click is reserved (right-drag pans the field; 2.3 cancels breed mode), so the
    // browser menu never shows on the canvas. Once per page: BootScene runs once, and Phaser adds a
    // listener per call that can never be removed. The mouse manager has its canvas target by now.
    this.input.mouse?.disableContextMenu();
    log.info('boot', 'Boot scene ready');
    this.scene.start('PreloadScene');
  }
}
