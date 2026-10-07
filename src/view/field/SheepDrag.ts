import type Phaser from 'phaser';
import type { Command } from '../../sim/commands';
import { sheepIndex, type PublicSheep } from '../../sim/selectors';
import type { GameState } from '../../sim/state';
import { inBetterPlace, type BetterPlaceHighlight } from './BetterPlace';
import type { EntityLayer } from './EntityLayer';
import type { SheepSprite } from './SheepSprite';

/**
 * The geometry and commands of a sheep drag (FR16, Story 2.7). InputController decides when a drag
 * starts, ends or cancels; this decides where the sheep is drawn and what the release means. It sends
 * commands and never touches GameState.
 *
 * The sim keeps a dragged sheep at its pickup spot; only the sprite follows the pointer. A release's
 * Drop or Sacrifice applies at the start of the next tick, so the sprite stays held at the release
 * point (`pending`) until a tick has run (`state.time > releasedAt`). That is the first render after the
 * tick that applied it, in the same frame, so the sheep snaps to where the sim put it and never slides
 * back from the pickup spot. Allocates nothing per frame.
 */
export class SheepDrag {
  private readonly camera: Phaser.Cameras.Scene2D.Camera;
  private readonly layer: EntityLayer<PublicSheep, SheepSprite>;
  private readonly dispatch: (cmd: Command) => void;
  // The live drag: the pointer still holds sheep `liveId` (0 = none).
  private liveId = 0;
  /** Sprite centre minus the press point, so the sheep does not jump to the pointer. */
  private grabDx = 0;
  private grabDy = 0;
  /** Where the sheep was drawn when picked up: a cancelled drag puts it back here. */
  private originX = 0;
  private originY = 0;
  /** Where the sheep is drawn (without the lift): the pointer plus the grab offset. */
  private heldX = 0;
  private heldY = 0;
  /** The pointer is over the Better Place. */
  private overHole = false;
  // A released drag waiting for its command to apply (0 = none): held at (pendingX, pendingY).
  private pendingId = 0;
  private pendingX = 0;
  private pendingY = 0;
  private releasedAt = 0;

  constructor(
    camera: Phaser.Cameras.Scene2D.Camera,
    layer: EntityLayer<PublicSheep, SheepSprite>,
    dispatch: (cmd: Command) => void,
  ) {
    this.camera = camera;
    this.layer = layer;
    this.dispatch = dispatch;
  }

  /** True while the pointer holds a sheep that is still alive (cleared by sync if it dies). */
  get live(): boolean {
    return this.liveId !== 0;
  }

  /** What the Better Place shows this frame (UX-DR52): armed while dragging, hovered over the hole. */
  get highlight(): BetterPlaceHighlight {
    if (this.liveId === 0) return 'off';
    return this.overHole ? 'hovered' : 'armed';
  }

  /**
   * Picks up sheep `id`, pressed at canvas point (sx, sy). False if its sprite is gone. A rare event, so
   * the command object is fine.
   */
  begin(id: number, sx: number, sy: number): boolean {
    const spr = this.layer.spriteFor(id);
    if (spr === undefined) return false;
    // Re-grabbed before its drop applied: the live drag holds it from here.
    if (this.pendingId === id) this.pendingId = 0;
    this.liveId = id;
    this.originX = this.heldX = spr.x;
    this.originY = this.heldY = spr.y;
    this.grabDx = spr.x - (sx + this.camera.scrollX);
    this.grabDy = spr.y - (sy + this.camera.scrollY);
    this.overHole = false;
    this.dispatch({ type: 'PickUp', id });
    return true;
  }

  /** The pointer moved to canvas point (sx, sy). World point = pointer + this frame's scroll (zoom 1). */
  move(sx: number, sy: number): void {
    if (this.liveId === 0) return;
    const wx = sx + this.camera.scrollX;
    const wy = sy + this.camera.scrollY;
    this.heldX = wx + this.grabDx;
    this.heldY = wy + this.grabDy;
    // The player aims the cursor, not the sheep.
    this.overHole = inBetterPlace(wx, wy);
  }

  /** Released at canvas point (sx, sy): sacrificed over the hole, otherwise put down where drawn. */
  end(sx: number, sy: number, time: number): void {
    if (this.liveId === 0) return;
    this.move(sx, sy);
    const id = this.liveId;
    if (this.overHole) this.dispatch({ type: 'Sacrifice', id });
    // UX-DR67: where it is drawn; the sim clamps a drop outside the fence to just inside it.
    else this.dispatch({ type: 'Drop', id, x: this.heldX, y: this.heldY });
    this.settle(id, this.heldX, this.heldY, time);
  }

  /** Cancelled (Esc, blur, a modal, released off the canvas): put back where it was picked up. */
  cancel(time: number): void {
    if (this.liveId === 0) return;
    const id = this.liveId;
    this.dispatch({ type: 'Drop', id, x: this.originX, y: this.originY });
    this.settle(id, this.originX, this.originY, time);
  }

  /**
   * Call every frame before the sheep layer syncs: holds the dragged (or just released) sprite at its
   * point, and lets a release go once its command has applied. A sheep that died mid-drag ends the drag
   * with no command (its carcass lies at the pickup spot).
   */
  sync(state: GameState): void {
    if (this.liveId !== 0) {
      if (sheepIndex(state, this.liveId) < 0) {
        this.liveId = 0;
        this.overHole = false;
      } else {
        this.layer.spriteFor(this.liveId)?.hold(this.heldX, this.heldY);
      }
    }
    if (this.pendingId !== 0) {
      if (state.time > this.releasedAt || sheepIndex(state, this.pendingId) < 0) this.releasePending();
      else this.layer.spriteFor(this.pendingId)?.hold(this.pendingX, this.pendingY);
    }
  }

  private settle(id: number, x: number, y: number, time: number): void {
    // A second drop before the first applied (a very quick re-grab) lets the first go now.
    if (this.pendingId !== 0 && this.pendingId !== id) this.releasePending();
    this.pendingId = id;
    this.pendingX = x;
    this.pendingY = y;
    this.releasedAt = time;
    this.liveId = 0;
    this.overHole = false;
  }

  private releasePending(): void {
    this.layer.spriteFor(this.pendingId)?.release();
    this.pendingId = 0;
  }
}
