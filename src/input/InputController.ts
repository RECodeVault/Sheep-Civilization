import Phaser from 'phaser';
import { LAYOUT } from '../config/constants';
import { log } from '../core/log';
import { assertNever } from '../core/types';
import type { Command } from '../sim/commands';
import { bus } from '../view/bus';
import { reportError } from '../view/safetyNet';

/** What GameScene wires into the controller. */
export interface InputHooks {
  /** True while any modal is up (pause, sub-panel, confirm, lose): shortcuts are ignored. */
  modalOpen(): boolean;
  /**
   * The Esc chain (UX-DR73, agreed 2026-10-05), in order; each step returns true when it consumed
   * the press: close start-over confirm → close sub-panel → cancel drag (`cancelDrag`) → exit breed
   * mode (`exitBreedMode`) → close shop (3.2) → open/close pause.
   */
  readonly esc: readonly (() => boolean)[];
  /** Pans the field camera by a screen-space drag (PenCamera clamps it to the pen). */
  panBy(dx: number, dy: number): void;
  /** Id of the front-most sheep under a canvas (screen) point, or 0; hit-tested in world coordinates. */
  sheepAt(screenX: number, screenY: number): number;
  /** Id of the front-most carcass under a canvas (screen) point, or 0; hit-tested like sheepAt. */
  carcassAt(screenX: number, screenY: number): number;
  /** Whether the sheep may be picked by the Breed tool (this frame's PublicSheep.canBreed); false if gone. */
  canBreed(id: number): boolean;
  /** Shakes a sheep that cannot be picked (UX-DR70). View only. */
  shake(id: number): void;
  /** Queues a command for the next tick. */
  dispatch(cmd: Command): void;
  /**
   * A press on sheep `id` at canvas point (sx, sy) passed the drag threshold: pick it up (FR16).
   * False if it cannot be (its sprite is gone); the press is then dropped.
   */
  beginDrag(id: number, screenX: number, screenY: number): boolean;
  /** The held pointer is at canvas point (sx, sy); called every frame of a drag. */
  moveDrag(screenX: number, screenY: number): void;
  /** Released at canvas point (sx, sy): a sacrifice over the Better Place, otherwise a drop (UX-DR67). */
  endDrag(screenX: number, screenY: number): void;
  /** Puts the dragged sheep back where it was picked up. */
  cancelDrag(): void;
  /** False once the dragged sheep is gone (it died mid-drag): the drag ends with no command. */
  dragAlive(): boolean;
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
 * modal cancel it. 2.4 added field clicks in `idle` (a click on a carcass clears it, FR13). 2.7 added
 * `dragging` (FR16): a left press on a sheep in `idle` that moves past 6 px picks it up; the release
 * puts it down or sacrifices it, and Esc, a modal, blur or a release off the canvas cancel it. The
 * drag's geometry and commands live in the view (SheepDrag, through the hooks). Turns input into
 * commands or UI events; never touches GameState.
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
  // The input mode (AR8). pickA is breed mode's first-picked adult, 0 for none.
  private mode: 'idle' | 'breeding' | 'dragging' = 'idle';
  private pickA = 0;
  // A left press on the field, in either mode: a click if released within the threshold, acting on
  // what was under the press (hit-tested at the press, so a sheep wandering under a held pointer is
  // never picked instead): a carcass in idle, a sheep in breed mode. 0 = nothing. A press whose mode
  // changes before the release is dropped.
  private clickArmed = false;
  private clickMode: 'idle' | 'breeding' = 'idle';
  private clickDownX = 0;
  private clickDownY = 0;
  private clickTarget = 0;
  // The sheep under an idle press (hit-tested at the press, like clickTarget): moved past the threshold,
  // the press drags it. 0 = none, and always 0 in breed mode (no drags there).
  private dragTarget = 0;
  // The live drag's press (pointer.downTime): a different one means the button went up and down again
  // between two frames, so the drag ended.
  private dragDownTime = 0;
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
    input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.onUpOutside, this);
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

  /** True while a sheep is being dragged. */
  get dragging(): boolean {
    return this.mode === 'dragging';
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
    this.updateDrag();
    this.updateClick();
    this.updatePan();
  }

  /** The Breed tool (UX-DR31, UX-DR71): enters breed mode, or cancels it when it is on. */
  toggleBreedMode(): void {
    // The left button is busy with the sheep; the tool cannot really be clicked mid-drag.
    if (this.mode === 'dragging') return;
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

  /**
   * Cancels a drag: the sheep goes back where it was picked up. Returns true if one was live (the Esc
   * chain step, after closing a sub-panel and before exiting breed mode).
   */
  cancelDrag(): boolean {
    if (this.mode !== 'dragging') return false;
    this.mode = 'idle';
    // The sheep died since the last frame: nothing to cancel, so Esc goes on down the chain.
    if (!this.hooks.dragAlive()) return false;
    this.hooks.cancelDrag();
    return true;
  }

  /** Drops any press in progress (window blur or hide: its release may never arrive). */
  cancelPress(): void {
    this.panArmed = false;
    this.panning = false;
    this.clickArmed = false;
    this.cancelDrag();
  }

  destroy(): void {
    this.input.off('pointerdown', this.onPointerDown, this);
    this.input.off(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.onUpOutside, this);
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
    if (this.mode !== this.clickMode || this.hooks.modalOpen()) {
      this.clickArmed = false;
      return;
    }
    // Moving past the threshold makes it a drag (UX-DR66): an idle press on a sheep picks it up, and
    // anything else is simply dropped. Checked while held and again at the release point (upX/upY),
    // so a press, move and release inside one frame is a drag, not a click.
    const down = p.leftButtonDown();
    const dx = (down ? p.x : p.upX) - this.clickDownX;
    const dy = (down ? p.y : p.upY) - this.clickDownY;
    if (dx * dx + dy * dy > DRAG_THRESHOLD2) {
      this.clickArmed = false;
      // The sheep must still be under the press point: one that wandered off while the pointer was held
      // still is not snatched from afar.
      const target = this.dragTarget;
      if (
        this.mode === 'idle' &&
        target !== 0 &&
        this.hooks.sheepAt(this.clickDownX, this.clickDownY) === target &&
        this.hooks.beginDrag(target, this.clickDownX, this.clickDownY)
      ) {
        this.mode = 'dragging';
        this.dragDownTime = p.downTime;
        // Released in the same frame: put it down at once (updateDrag would see the release next frame,
        // but the pointer may be pressed again by then). Otherwise it is drawn at the pointer this frame.
        if (!down) this.finishDrag(p.upX, p.upY);
        else this.hooks.moveDrag(p.x, p.y);
      }
      return;
    }
    if (down) return;
    this.clickArmed = false;
    const mode = this.mode;
    switch (mode) {
      case 'idle':
        // FR13 / UX-DR65: a click on a carcass clears it; a sheep or empty field does nothing. A rare
        // event, so the command object is fine; the sim ignores a carcass that is already gone.
        if (this.clickTarget !== 0) this.hooks.dispatch({ type: 'ClearCarcass', id: this.clickTarget });
        return;
      case 'breeding':
        this.pick(this.clickTarget);
        return;
      default:
        assertNever(mode);
    }
  }

  /** Drops a field click in progress (released outside the canvas, pointer left it). */
  private cancelClick(): void {
    this.clickArmed = false;
  }

  /**
   * A release outside the canvas: no click, and a drag is cancelled. Leaving the canvas while holding
   * (GAME_OUT) does not cancel a drag: the sheep waits at the last point until the pointer comes back.
   */
  private onUpOutside(): void {
    this.cancelClick();
    // Only the left button holds the sheep: a right or middle release out there changes nothing.
    if (!this.input.activePointer.leftButtonDown()) this.cancelDrag();
  }

  /**
   * Each frame of a drag: follow the held pointer, put the sheep down on release, and cancel under a
   * modal. A sheep that died mid-drag ends it with no command (AC 9). Allocates nothing.
   */
  private updateDrag(): void {
    if (this.mode !== 'dragging') return;
    if (!this.hooks.dragAlive()) {
      this.mode = 'idle';
      return;
    }
    if (this.hooks.modalOpen()) {
      this.cancelDrag();
      return;
    }
    const p = this.input.activePointer;
    // A new downTime means a release and a new press both happened since the last frame: the release
    // ends the drag where it happened (the new press, swallowed while dragging, does nothing).
    if (p.leftButtonDown() && p.downTime === this.dragDownTime) this.hooks.moveDrag(p.x, p.y);
    else this.finishDrag(p.upX, p.upY);
  }

  private finishDrag(x: number, y: number): void {
    this.mode = 'idle';
    this.hooks.endDrag(x, y);
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
      // The left button holds the sheep: no new click, pan or right-click until it is put down.
      if (this.hooks.modalOpen() || this.mode === 'dragging') return;
      const onField = pointer.y < FIELD_BOTTOM;
      if (pointer.rightButtonDown()) {
        // A left press is under way (it may become a drag): no pan on top of it.
        if (pointer.leftButtonDown()) return;
        this.panArmed = true;
        this.panFromField = onField;
        this.panning = false;
        // Screen (canvas) coordinates: the camera moves under the pointer, so world ones would drift.
        this.panDownX = this.panLastX = pointer.x;
        this.panDownY = this.panLastY = pointer.y;
        return;
      }
      if (pointer.leftButtonDown() && onField && !this.hooks.pointerOnHud()) {
        this.clickArmed = true;
        this.clickMode = this.mode;
        this.clickDownX = pointer.x;
        this.clickDownY = pointer.y;
        // Breed mode only picks sheep; an idle click clears carcasses, even one with a sheep standing on
        // it, and an idle drag picks up the sheep under the press.
        const breeding = this.mode === 'breeding';
        const sheep = this.hooks.sheepAt(pointer.x, pointer.y);
        this.clickTarget = breeding ? sheep : this.hooks.carcassAt(pointer.x, pointer.y);
        this.dragTarget = breeding ? 0 : sheep;
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
