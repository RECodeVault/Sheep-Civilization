import type Phaser from 'phaser';
import { log } from '../core/log';
import { bus } from '../view/bus';

/**
 * The single owner of gameplay pointer and keyboard input (AR8). 1.6 added F. Since 2026-10-06 food
 * comes only from the Farm bar, so a field click does nothing yet: 2.4 adds pointer clicks (`idle`
 * mode, the 6 px click/drag threshold, carcass clearing), 1.10 the Esc chain and the modal check,
 * 2.3 breed mode and 2.7 drag. Turns input into commands or UI events; never touches GameState.
 */
export class InputController {
  private readonly keyboard: Phaser.Input.Keyboard.KeyboardPlugin | null;

  constructor(input: Phaser.Input.InputPlugin) {
    // UX-DR74: right-click is reserved (it cancels breed mode in 2.3); never show the browser menu.
    input.mouse?.disableContextMenu();
    this.keyboard = input.keyboard;
    if (this.keyboard === null) {
      log.warn('input', 'No keyboard plugin; keyboard shortcuts are off');
      return;
    }
    // An event listener, not addKey('F'): addKey captures the key, which would preventDefault F
    // for the whole page.
    this.keyboard.on('keydown-F', this.onFarmKey, this);
  }

  destroy(): void {
    this.keyboard?.off('keydown-F', this.onFarmKey, this);
  }

  private onFarmKey(event: KeyboardEvent): void {
    // One action per press, never on hold (FR43, UX-DR72); leave Ctrl/Cmd/Alt+F to the browser.
    if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
    // Story 1.10: ignore shortcuts while a modal is open.
    bus.emit('farm:pressed', undefined);
  }
}
