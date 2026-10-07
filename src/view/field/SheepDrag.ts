import type Phaser from 'phaser';
import type { Command } from '../../sim/commands';
import type { PublicSheep } from '../../sim/selectors';
import { inBetterPlace, type BetterPlaceHighlight } from './BetterPlace';
import type { EntityLayer } from './EntityLayer';
import type { SheepSprite } from './SheepSprite';

/** A released drag waiting for its command to apply. Reused, never reallocated. */
interface Pending {
  /** 0 = free slot. */
  id: number;
  x: number;
  y: number;
  /** state.time at the release. */
  releasedAt: number;
  /** Released over the hole: about to vanish, so it cannot be grabbed again. */
  sacrifice: boolean;
}

// Releases waiting for a tick at once: each needs about 100 ms, so a few slots are plenty; with all of
// them busy the oldest is let go early (it may slide a little).
const PENDING_SLOTS = 4;

/**
 * The geometry and commands of a sheep drag (FR16, Story 2.7). InputController decides when a drag
 * starts, ends or cancels; this decides where the sheep is drawn and what the release means. It sends
 * commands, reads only the frame's PublicSheep list, and never touches GameState.
 *
 * The sim keeps a dragged sheep at its pickup spot; only the sprite follows the pointer. A release's
 * Drop or Sacrifice applies at the start of the next tick, so the sprite stays held at the release
 * point (a pending slot, drawn put down) until a tick has run (`time > releasedAt`). That is the first
 * render after the tick that applied it, in the same frame, so the sheep snaps to where the sim put it
 * and never slides back from the pickup spot. Allocates nothing per frame.
 */
export class SheepDrag {
  private readonly camera: Phaser.Cameras.Scene2D.Camera;
  private readonly layer: EntityLayer<PublicSheep, SheepSprite>;
  private readonly dispatch: (cmd: Command) => void;
  // The live drag: the pointer still holds sheep `liveId` (0 = none).
  private liveId = 0;
  /** Sheep centre minus the press point, so the sheep does not jump to the pointer. */
  private grabDx = 0;
  private grabDy = 0;
  /** Where the sheep stood when picked up: a cancelled drag puts it back here. */
  private originX = 0;
  private originY = 0;
  /** Where the sheep is drawn (without the lift): the pointer plus the grab offset. */
  private heldX = 0;
  private heldY = 0;
  /** The pointer is over the Better Place (and not on a HUD control). */
  private overHole = false;
  private readonly pending: Pending[] = [];

  constructor(
    camera: Phaser.Cameras.Scene2D.Camera,
    layer: EntityLayer<PublicSheep, SheepSprite>,
    dispatch: (cmd: Command) => void,
  ) {
    this.camera = camera;
    this.layer = layer;
    this.dispatch = dispatch;
    for (let i = 0; i < PENDING_SLOTS; i++) this.pending.push({ id: 0, x: 0, y: 0, releasedAt: 0, sacrifice: false });
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
   * Picks up sheep `id`, pressed at canvas point (sx, sy). False if its sprite is gone, or if it was
   * just released over the hole (its Sacrifice is queued). A rare event, so the command is fine.
   */
  begin(id: number, sx: number, sy: number): boolean {
    const spr = this.layer.spriteFor(id);
    if (spr === undefined) return false;
    // Re-grabbed before its release applied: start from the release point, not the drawn sprite.
    let x = spr.x;
    let y = spr.y;
    for (let i = 0; i < this.pending.length; i++) {
      const p = this.pending[i];
      if (p.id !== id) continue;
      if (p.sacrifice) return false;
      x = p.x;
      y = p.y;
      // The live drag holds it from here.
      p.id = 0;
    }
    this.liveId = id;
    this.originX = this.heldX = x;
    this.originY = this.heldY = y;
    this.grabDx = x - (sx + this.camera.scrollX);
    this.grabDy = y - (sy + this.camera.scrollY);
    this.overHole = false;
    this.dispatch({ type: 'PickUp', id });
    return true;
  }

  /**
   * The pointer moved to canvas point (sx, sy); `onHud` when it is on a HUD control. World point =
   * pointer + this frame's scroll (zoom 1).
   */
  move(sx: number, sy: number, onHud: boolean): void {
    if (this.liveId === 0) return;
    const wx = sx + this.camera.scrollX;
    const wy = sy + this.camera.scrollY;
    this.heldX = wx + this.grabDx;
    this.heldY = wy + this.grabDy;
    // The player aims the cursor, not the sheep. A HUD control (the Pause button, panned over the hole)
    // is never the hole: a release there drops on the field (AC 6).
    this.overHole = !onHud && inBetterPlace(wx, wy);
  }

  /** Released at canvas point (sx, sy): sacrificed over the hole, otherwise put down where drawn. */
  end(sx: number, sy: number, onHud: boolean, time: number): void {
    if (this.liveId === 0) return;
    this.move(sx, sy, onHud);
    const id = this.liveId;
    const sacrifice = this.overHole;
    if (sacrifice) this.dispatch({ type: 'Sacrifice', id });
    // UX-DR67: where it is drawn; the sim clamps a drop outside the fence to just inside it.
    else this.dispatch({ type: 'Drop', id, x: this.heldX, y: this.heldY });
    this.settle(id, this.heldX, this.heldY, time, sacrifice);
  }

  /** Cancelled (Esc, blur, a modal, released off the canvas): put back where it was picked up. */
  cancel(time: number): void {
    if (this.liveId === 0) return;
    const id = this.liveId;
    this.dispatch({ type: 'Drop', id, x: this.originX, y: this.originY });
    this.settle(id, this.originX, this.originY, time, false);
  }

  /**
   * Call every frame before the sheep layer syncs, with the frame's PublicSheep list and state.time:
   * holds the dragged sheep (lifted) and each just-released one (put down, or still lifted over the
   * hole), and lets a release go once its command has applied. A sheep that died mid-drag ends the drag
   * with no command (its carcass lies at the pickup spot).
   */
  sync(sheep: readonly PublicSheep[], time: number): void {
    if (this.liveId !== 0) {
      if (!has(sheep, this.liveId)) {
        this.liveId = 0;
        this.overHole = false;
      } else {
        this.layer.spriteFor(this.liveId)?.hold(this.heldX, this.heldY, true);
      }
    }
    for (let i = 0; i < this.pending.length; i++) {
      const p = this.pending[i];
      if (p.id === 0) continue;
      if (time > p.releasedAt || !has(sheep, p.id)) this.releaseSlot(p);
      else this.layer.spriteFor(p.id)?.hold(p.x, p.y, p.sacrifice);
    }
  }

  private settle(id: number, x: number, y: number, time: number, sacrifice: boolean): void {
    // A free slot, or the oldest one (let go early).
    let slot = this.pending[0];
    for (let i = 0; i < this.pending.length; i++) {
      const p = this.pending[i];
      if (p.id === 0) {
        slot = p;
        break;
      }
      if (p.releasedAt < slot.releasedAt) slot = p;
    }
    if (slot.id !== 0) this.releaseSlot(slot);
    slot.id = id;
    slot.x = x;
    slot.y = y;
    slot.releasedAt = time;
    slot.sacrifice = sacrifice;
    this.liveId = 0;
    this.overHole = false;
  }

  private releaseSlot(p: Pending): void {
    this.layer.spriteFor(p.id)?.release();
    p.id = 0;
  }
}

function has(list: readonly PublicSheep[], id: number): boolean {
  for (let i = 0; i < list.length; i++) if (list[i].id === id) return true;
  return false;
}
