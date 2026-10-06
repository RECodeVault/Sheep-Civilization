import type Phaser from 'phaser';
import { LAYOUT } from '../config/constants';
import { log } from '../core/log';
import { bus } from '../view/bus';
import { reportError } from '../view/safetyNet';

/** What GameScene wires into the controller. */
export interface InputHooks {
  /** True while any modal is up (pause, sub-panel, confirm, lose): shortcuts are ignored. */
  modalOpen(): boolean;
  /**
   * The Esc chain (UX-DR73, agreed 2026-10-05), in order; each step returns true when it consumed
   * the press: close start-over confirm → close sub-panel → cancel drag (2.7) → exit breed mode
   * (2.3) → close shop (3.2) → open/close pause. Drag and breed mode belong to this controller, so
   * their steps will be its own methods placed in the same array, between the overlay's.
   */
  readonly esc: readonly (() => boolean)[];
  /** Pans the field camera by a screen-space drag (PenCamera clamps it to the pen). */
  panBy(dx: number, dy: number): void;
}

// UX-DR66: a press becomes a drag after 6 px; below that it is a click. Right-drag pans the field
// (Rylan, 2026-10-06); a right-click that never passes it stays a click (2.3: cancel breed mode).
const DRAG_THRESHOLD_PX = 6;
// Presses on the bottom bar never pan (the bar is not field).
const FIELD_BOTTOM = LAYOUT.canvasHeight - LAYOUT.hudBarHeight;

/**
 * The single owner of gameplay pointer and keyboard input (AR8). 1.6 added F, 1.10 the Esc chain,
 * the modal check and right-drag panning. Since 2026-10-06 food comes only from the Farm bar, so a
 * left click on the field does nothing yet: 2.4 adds pointer clicks (`idle` mode, the 6 px
 * click/drag threshold, carcass clearing; field hits must use the camera's world point), 2.3 breed
 * mode and 2.7 drag. Turns input into commands or UI events; never touches GameState.
 */
export class InputController {
  private readonly keyboard: Phaser.Input.Keyboard.KeyboardPlugin | null;
  private readonly hooks: InputHooks;
  private readonly input: Phaser.Input.InputPlugin;
  // Right-button pan: armed on a right press over the field, panning once past the threshold.
  private panArmed = false;
  private panning = false;
  private panDownX = 0;
  private panDownY = 0;
  private panLastX = 0;
  private panLastY = 0;
  // Phaser's KeyboardManager replays its whole per-step queue on every new key event, and its
  // duplicate check compares only with the event before, so with three or more key events in one
  // step an earlier keydown is dispatched again (KeyboardPlugin.update). Each handler ignores an
  // event object it already handled.
  private lastFarmKey: KeyboardEvent | null = null;
  private lastEscKey: KeyboardEvent | null = null;

  constructor(input: Phaser.Input.InputPlugin, hooks: InputHooks) {
    this.hooks = hooks;
    this.input = input;
    input.on('pointerdown', this.onPointerDown, this);
    // UX-DR74: the browser context menu is disabled once for the page in BootScene (Phaser adds a
    // listener per call that can never be removed).
    this.keyboard = input.keyboard;
    if (this.keyboard === null) {
      log.warn('input', 'No keyboard plugin; keyboard shortcuts are off');
      return;
    }
    // Event listeners, not addKey(): addKey captures the key, which would preventDefault it for the
    // whole page.
    this.keyboard.on('keydown-F', this.onFarmKey, this);
    this.keyboard.on('keydown-ESC', this.onEscKey, this);
  }

  /**
   * Call once per frame (GameScene.update). The pan follows the pointer's own state, not move events:
   * while the pointer is over a HUD button, Phaser's top-only input stops sending this scene moves
   * and ups. Allocates nothing.
   */
  update(): void {
    if (!this.panArmed) return;
    const p = this.input.activePointer;
    if (!p.rightButtonDown() || this.hooks.modalOpen()) {
      // Released (anywhere, even off the canvas), or a modal opened mid-drag. A release that never
      // passed the threshold is a right-click; Story 2.3 cancels breed mode on it here.
      this.cancelPan();
      return;
    }
    if (!this.panning) {
      const dx = p.x - this.panDownX;
      const dy = p.y - this.panDownY;
      if (dx * dx + dy * dy <= DRAG_THRESHOLD_PX * DRAG_THRESHOLD_PX) return;
      this.panning = true;
    }
    if (p.x !== this.panLastX || p.y !== this.panLastY) {
      this.hooks.panBy(p.x - this.panLastX, p.y - this.panLastY);
      this.panLastX = p.x;
      this.panLastY = p.y;
    }
  }

  /** Drops a right-drag pan in progress (window blur or hide: its release may never arrive). */
  cancelPan(): void {
    this.panArmed = false;
    this.panning = false;
  }

  destroy(): void {
    this.input.off('pointerdown', this.onPointerDown, this);
    this.keyboard?.off('keydown-F', this.onFarmKey, this);
    this.keyboard?.off('keydown-ESC', this.onEscKey, this);
  }

  private onFarmKey(event: KeyboardEvent): void {
    // One action per press, never on hold (FR43, UX-DR72); leave Ctrl/Cmd/Alt+F to the browser.
    if (event === this.lastFarmKey || event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
    this.lastFarmKey = event;
    // UX-DR20: shortcuts are ignored while a modal is up.
    if (this.hooks.modalOpen()) return;
    bus.emit('farm:pressed', undefined);
  }

  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    if (!pointer.rightButtonDown() || pointer.y >= FIELD_BOTTOM || this.hooks.modalOpen()) return;
    this.panArmed = true;
    this.panning = false;
    // Screen (canvas) coordinates: the camera moves under the pointer, so world ones would drift.
    this.panDownX = this.panLastX = pointer.x;
    this.panDownY = this.panLastY = pointer.y;
  }

  // Runs inside Phaser's input step, where a throw would stop the game loop.
  private onEscKey(event: KeyboardEvent): void {
    if (event === this.lastEscKey || event.repeat) return;
    this.lastEscKey = event;
    try {
      const steps = this.hooks.esc;
      for (let i = 0; i < steps.length; i++) if (steps[i]()) return;
    } catch (err) {
      reportError('ui', err);
    }
  }
}
