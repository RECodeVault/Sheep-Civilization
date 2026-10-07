import Phaser from 'phaser';
import { LAYOUT } from '../config/constants';
import { log } from '../core/log';
import type { Command } from '../sim/commands';
import { bus } from '../view/bus';
import { reportError } from '../view/safetyNet';

/** What GameScene wires into the controller. */
export interface InputHooks {
  /** True while any modal is up (pause, sub-panel, confirm, lose): shortcuts are ignored. */
  modalOpen(): boolean;
  /**
   * The Esc chain (UX-DR73, agreed 2026-10-05), in order; each step returns true when it consumed
   * the press: close start-over confirm → close sub-panel → cancel drag (2.7) → exit breed mode
   * (`exitBreedMode`) → close shop (3.2) → open/close pause.
   */
  readonly esc: readonly (() => boolean)[];
  /** Pans the field camera by a screen-space drag (PenCamera clamps it to the pen). */
  panBy(dx: number, dy: number): void;
  /** Id of the front-most sheep under a canvas (screen) point, or 0; hit-tested in world coordinates. */
  sheepAt(screenX: number, screenY: number): number;
  /** Whether the sheep may be picked by the Breed tool (this frame's PublicSheep.canBreed); false if gone. */
  canBreed(id: number): boolean;
  /** Shakes a sheep that cannot be picked (UX-DR70). View only. */
  shake(id: number): void;
  /** Queues a command for the next tick. */
  dispatch(cmd: Command): void;
  /** True while the pointer is on a HUD control (the Pause button can sit over the panned field). */
  pointerOnHud(): boolean;
}

// UX-DR66: a press becomes a drag after 6 px; below that it is a click. Right-drag pans the field
// (Rylan, 2026-10-06); a right-click that never passes it cancels breed mode (UX-DR74).
const DRAG_THRESHOLD_PX = 6;
const DRAG_THRESHOLD2 = DRAG_THRESHOLD_PX * DRAG_THRESHOLD_PX;
// Presses on the bottom bar are not field presses: they never pan or pick a sheep.
const FIELD_BOTTOM = LAYOUT.canvasHeight - LAYOUT.hudBarHeight;

/**
 * The single owner of gameplay pointer and keyboard input (AR8). 1.6 added F, 1.10 the Esc chain,
 * the modal check and right-drag panning, 2.2 G, 2.3 breed mode (`idle` / `breeding`): the Breed
 * tool toggles it, a left click picks adult A then adult B, and right-click, Esc, the tool again or a
 * modal cancel it. 2.4 adds idle-mode field clicks (carcass clearing) by generalising the breed-mode
 * click, and 2.7 drag. Turns input into commands or UI events; never touches GameState.
 */
export class InputController {
  private readonly keyboard: Phaser.Input.Keyboard.KeyboardPlugin | null;
  private readonly hooks: InputHooks;
  private readonly input: Phaser.Input.InputPlugin;
  // Right button: armed on any right press (a right-click cancels breed mode); it pans once past the
  // threshold, but only when the press began on the field.
  private panArmed = false;
  private panFromField = false;
  private panning = false;
  private panDownX = 0;
  private panDownY = 0;
  private panLastX = 0;
  private panLastY = 0;
  // The input mode (AR8): Story 2.7 adds 'dragging'. pickA is breed mode's first-picked adult, 0 for none.
  private mode: 'idle' | 'breeding' = 'idle';
  private pickA = 0;
  // A left press on the field in breed mode: a click if released within the threshold, acting on the
  // sheep that was under the press (hit-tested at the press, so a sheep wandering under a held
  // pointer is never picked instead). 0 = empty field.
  private clickArmed = false;
  private clickDownX = 0;
  private clickDownY = 0;
  private clickSheep = 0;
  // Phaser's KeyboardManager replays its whole per-step queue on every new key event, and its
  // duplicate check compares only with the event before, so with three or more key events in one
  // step an earlier keydown is dispatched again (KeyboardPlugin.update). Each handler ignores an
  // event object it already handled.
  private lastFarmKey: KeyboardEvent | null = null;
  private lastFarmBreedingKey: KeyboardEvent | null = null;
  private lastEscKey: KeyboardEvent | null = null;

  constructor(input: Phaser.Input.InputPlugin, hooks: InputHooks) {
    this.hooks = hooks;
    this.input = input;
    input.on('pointerdown', this.onPointerDown, this);
    bus.on('breedTool:pressed', this.toggleBreedMode, this);
    bus.on('hud:rightPressed', this.onHudRightPress, this);
    // A press released outside the canvas, or a pointer that leaves it, is no click (Task 7.3).
    input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.cancelClick, this);
    input.on(Phaser.Input.Events.GAME_OUT, this.cancelClick, this);
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
    this.keyboard.on('keydown-G', this.onFarmBreedingKey, this);
    this.keyboard.on('keydown-ESC', this.onEscKey, this);
  }

  /** True while in breed mode. */
  get breeding(): boolean {
    return this.mode === 'breeding';
  }

  /** The first-picked adult in breed mode, or 0. */
  get pickedA(): number {
    return this.pickA;
  }

  /**
   * Call once per frame (GameScene.update). Presses follow the pointer's own state, not move or up
   * events: while the pointer is over a HUD button, Phaser's top-only input stops sending this scene
   * moves and ups. Allocates nothing.
   */
  update(): void {
    // A picked adult that can no longer breed (turned elder, died, readiness gone) is dropped; breed
    // mode stays, waiting for a new A (UX-DR70).
    if (this.pickA !== 0 && !this.hooks.canBreed(this.pickA)) {
      this.pickA = 0;
      this.notifyBreedMode();
    }
    this.updateClick();
    this.updatePan();
  }

  /** The Breed tool (UX-DR31, UX-DR71): enters breed mode, or cancels it when it is on. */
  toggleBreedMode(): void {
    if (this.mode === 'breeding') {
      this.exitBreedMode();
      return;
    }
    if (this.hooks.modalOpen()) return;
    this.mode = 'breeding';
    this.pickA = 0;
    this.notifyBreedMode();
  }

  /** Leaves breed mode, forgetting A. Returns true if it was on (the Esc chain step). */
  exitBreedMode(): boolean {
    if (this.mode !== 'breeding') return false;
    this.mode = 'idle';
    this.pickA = 0;
    this.clickArmed = false;
    this.notifyBreedMode();
    return true;
  }

  /** Drops any press in progress (window blur or hide: its release may never arrive). */
  cancelPress(): void {
    this.panArmed = false;
    this.panning = false;
    this.clickArmed = false;
  }

  destroy(): void {
    this.input.off('pointerdown', this.onPointerDown, this);
    this.input.off(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.cancelClick, this);
    this.input.off(Phaser.Input.Events.GAME_OUT, this.cancelClick, this);
    bus.off('breedTool:pressed', this.toggleBreedMode, this);
    bus.off('hud:rightPressed', this.onHudRightPress, this);
    this.keyboard?.off('keydown-F', this.onFarmKey, this);
    this.keyboard?.off('keydown-G', this.onFarmBreedingKey, this);
    this.keyboard?.off('keydown-ESC', this.onEscKey, this);
  }

  private updateClick(): void {
    if (!this.clickArmed) return;
    const p = this.input.activePointer;
    if (this.mode !== 'breeding' || this.hooks.modalOpen()) {
      this.clickArmed = false;
      return;
    }
    // Moving past the threshold makes it a drag, which breed mode ignores (2.7 adds sheep drags).
    // Checked while held and again at the release point (upX/upY), so a press, move and release
    // inside one frame is no click either.
    const down = p.leftButtonDown();
    const dx = (down ? p.x : p.upX) - this.clickDownX;
    const dy = (down ? p.y : p.upY) - this.clickDownY;
    if (dx * dx + dy * dy > DRAG_THRESHOLD2) {
      this.clickArmed = false;
      return;
    }
    if (down) return;
    this.clickArmed = false;
    this.pick(this.clickSheep);
  }

  /** Drops a breed-mode click in progress (released outside the canvas, pointer left it). */
  private cancelClick(): void {
    this.clickArmed = false;
  }

  /**
   * A right press on a HUD control (HudScene). Its button zone captures the press, so this scene never
   * sees it; it still counts for the right-click that cancels breed mode, but never pans.
   */
  private onHudRightPress(): void {
    if (this.hooks.modalOpen()) return;
    const p = this.input.activePointer;
    this.panArmed = true;
    this.panFromField = false;
    this.panning = false;
    this.panDownX = this.panLastX = p.x;
    this.panDownY = this.panLastY = p.y;
  }

  /** UX-DR70: a click in breed mode on sheep `id` (0 = empty field). */
  private pick(id: number): void {
    // Empty field, or A again: nothing (no food, no shake).
    if (id === 0 || id === this.pickA) return;
    if (!this.hooks.canBreed(id)) {
      this.hooks.shake(id);
      return;
    }
    if (this.pickA === 0) {
      this.pickA = id;
      this.notifyBreedMode();
      return;
    }
    // A rare event, so the command object is fine. The sim checks the pair again (breeding.ts).
    this.hooks.dispatch({ type: 'Breed', a: this.pickA, b: id });
    this.exitBreedMode();
  }

  private updatePan(): void {
    if (!this.panArmed) return;
    const p = this.input.activePointer;
    const modal = this.hooks.modalOpen();
    if (!p.rightButtonDown() || modal) {
      // Released (anywhere, even off the canvas), or a modal opened mid-press. A release that never
      // passed the threshold is a right-click: it cancels breed mode (UX-DR71, UX-DR74).
      const rightClick = !this.panning && !modal;
      this.panArmed = false;
      this.panning = false;
      if (rightClick) this.exitBreedMode();
      return;
    }
    if (!this.panning) {
      const dx = p.x - this.panDownX;
      const dy = p.y - this.panDownY;
      if (dx * dx + dy * dy <= DRAG_THRESHOLD2) return;
      // Past the threshold it is no click. A press from the bar never pans: it is simply dropped.
      if (!this.panFromField) {
        this.panArmed = false;
        return;
      }
      this.panning = true;
    }
    if (p.x !== this.panLastX || p.y !== this.panLastY) {
      this.hooks.panBy(p.x - this.panLastX, p.y - this.panLastY);
      this.panLastX = p.x;
      this.panLastY = p.y;
    }
  }

  private notifyBreedMode(): void {
    // A mode change is a rare event, so the payload object is fine.
    bus.emit('breedMode:changed', { active: this.mode === 'breeding', pickedA: this.pickA });
  }

  private onFarmKey(event: KeyboardEvent): void {
    // One action per press, never on hold (FR43, UX-DR72); leave Ctrl/Cmd/Alt+F to the browser.
    if (event === this.lastFarmKey || event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
    this.lastFarmKey = event;
    // UX-DR20: shortcuts are ignored while a modal is up.
    if (this.hooks.modalOpen()) return;
    bus.emit('farm:pressed', undefined);
  }

  private onFarmBreedingKey(event: KeyboardEvent): void {
    // As onFarmKey, with its own duplicate guard: one action per press (FR43), Ctrl/Cmd/Alt+G left
    // to the browser, nothing under a modal.
    if (event === this.lastFarmBreedingKey || event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
    this.lastFarmBreedingKey = event;
    if (this.hooks.modalOpen()) return;
    bus.emit('farmBreeding:pressed', undefined);
  }

  // Runs inside Phaser's input step, where a throw would stop the game loop.
  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    try {
      if (this.hooks.modalOpen()) return;
      const onField = pointer.y < FIELD_BOTTOM;
      if (pointer.rightButtonDown()) {
        this.panArmed = true;
        this.panFromField = onField;
        this.panning = false;
        // Screen (canvas) coordinates: the camera moves under the pointer, so world ones would drift.
        this.panDownX = this.panLastX = pointer.x;
        this.panDownY = this.panLastY = pointer.y;
        return;
      }
      if (pointer.leftButtonDown() && this.mode === 'breeding' && onField && !this.hooks.pointerOnHud()) {
        this.clickArmed = true;
        this.clickDownX = pointer.x;
        this.clickDownY = pointer.y;
        this.clickSheep = this.hooks.sheepAt(pointer.x, pointer.y);
      }
    } catch (err) {
      reportError('ui', err);
    }
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
