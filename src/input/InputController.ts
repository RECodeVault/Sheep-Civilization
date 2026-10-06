import type Phaser from 'phaser';
import { log } from '../core/log';
import { bus } from '../view/bus';

/**
 * The single owner of gameplay pointer and keyboard input (AR8). Story 1.6 handles only F; Story 1.7
 * adds the pointer and `idle` mode, 1.10 the Esc chain and the modal check, 2.3 breed mode and 2.7
 * drag. Turns input into commands or UI events; never touches GameState.
 */
export class InputController {
  private readonly keyboard: Phaser.Input.Keyboard.KeyboardPlugin | null;

  constructor(keyboard: Phaser.Input.Keyboard.KeyboardPlugin | null) {
    this.keyboard = keyboard;
    if (keyboard === null) {
      log.warn('input', 'No keyboard plugin; keyboard shortcuts are off');
      return;
    }
    // An event listener, not addKey('F'): addKey captures the key, which would preventDefault F
    // for the whole page.
    keyboard.on('keydown-F', this.onFarmKey, this);
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
