import type Phaser from 'phaser';
import type { Command } from '../../sim/commands';
import { salePrice, type PublicSheep, type Stage } from '../../sim/selectors';
import { inBetterPlace, type BetterPlaceHighlight } from './BetterPlace';
import type { EntityLayer } from './EntityLayer';
import { inMarket, type MarketHighlight } from './Market';
import type { SheepSprite } from './SheepSprite';

/** A released drag waiting for its command to apply. Reused, never reallocated. */
interface Pending {
  /** 0 = free slot. */
  id: number;
  x: number;
  y: number;
  /** state.time at the release. */
  releasedAt: number;
  /** Released over the hole or sold on the stall: about to vanish, so it cannot be grabbed again. */
  leaving: boolean;
}

// Releases waiting for a tick at once: each needs about 100 ms, so a few slots are plenty; with all of
// them busy the oldest is let go early (it may slide a little).
const PENDING_SLOTS = 4;

/**
 * The geometry and commands of a sheep drag (FR16, Story 2.7). InputController decides when a drag
 * starts, ends or cancels; this decides where the sheep is drawn and what the release means: a
 * sacrifice over the Better Place, a sale on the Market (3.1; a lamb there is put down), otherwise a
 * drop. It sends commands, reads only the frame's PublicSheep list, and never touches GameState.
 *
 * The sim keeps a dragged sheep at its pickup spot; only the sprite follows the pointer. A release's
 * Drop, Sacrifice or Sell applies at the start of the next tick, so the sprite stays held at the release
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
  /** The pointer is over the Market stall (and not on a HUD control). Never true with overHole. */
  private overMarket = false;
  /** The dragged sheep's stage (begin, then each sync), for the Market's price tag and the sale. */
  private liveStage: Stage = 'lamb';
  /** The last PublicSheep list sync saw (GameScene's reused array), so begin can read the stage. */
  private frameSheep: readonly PublicSheep[] = [];
  private readonly pending: Pending[] = [];

  constructor(
    camera: Phaser.Cameras.Scene2D.Camera,
    layer: EntityLayer<PublicSheep, SheepSprite>,
    dispatch: (cmd: Command) => void,
  ) {
    this.camera = camera;
    this.layer = layer;
    this.dispatch = dispatch;
    for (let i = 0; i < PENDING_SLOTS; i++) this.pending.push({ id: 0, x: 0, y: 0, releasedAt: 0, leaving: false });
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
   * What the Market shows this frame: armed while an adult or elder is dragged (UX-DR51), hovered with
   * the pointer over the stall; a lamb leaves it plain until it is over the stall, then invalid
   * (UX-DR53, "Too young").
   */
  get marketHighlight(): MarketHighlight {
    if (this.liveId === 0) return 'off';
    if (salePrice(this.liveStage) === 0) return this.overMarket ? 'invalid' : 'off';
    return this.overMarket ? 'hovered' : 'armed';
  }

  /** The dragged sheep's sale price for the Market's tag (salePrice; 0 for a lamb or no drag). */
  get marketPrice(): number {
    return this.liveId === 0 ? 0 : salePrice(this.liveStage);
  }

  /**
   * Picks up sheep `id`, pressed at canvas point (sx, sy). False if its sprite is gone, or if it was
   * just released over the hole or sold (its Sacrifice or Sell is queued). A rare event, so the
   * command is fine.
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
      if (p.leaving) return false;
      x = p.x;
      y = p.y;
      // The live drag holds it from here.
      p.id = 0;
    }
    this.liveId = id;
    // Read now, not at the next sync: a press, move and release in one frame ends before that.
    const k = indexOf(this.frameSheep, id);
    this.liveStage = k < 0 ? 'lamb' : this.frameSheep[k].stage;
    this.originX = this.heldX = x;
    this.originY = this.heldY = y;
    this.grabDx = x - (sx + this.camera.scrollX);
    this.grabDy = y - (sy + this.camera.scrollY);
    this.overHole = false;
    this.overMarket = false;
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
    // is never a target: a release there drops on the field (2.7 AC 6). The two targets never overlap.
    this.overHole = !onHud && inBetterPlace(wx, wy);
    this.overMarket = !onHud && inMarket(wx, wy);
  }

  /**
   * Released at canvas point (sx, sy): sacrificed over the hole, sold on the stall (an adult or elder),
   * otherwise put down where drawn. A lamb on the stall is put down too: the sim clamps it inside the
   * fence, which is the "bounce back" (UX-DR53).
   */
  end(sx: number, sy: number, onHud: boolean, time: number): void {
    if (this.liveId === 0) return;
    this.move(sx, sy, onHud);
    const id = this.liveId;
    const sell = !this.overHole && this.overMarket && salePrice(this.liveStage) > 0;
    const leaving = this.overHole || sell;
    if (this.overHole) this.dispatch({ type: 'Sacrifice', id });
    else if (sell) this.dispatch({ type: 'Sell', id });
    // UX-DR67: where it is drawn; the sim clamps a drop outside the fence to just inside it.
    else this.dispatch({ type: 'Drop', id, x: this.heldX, y: this.heldY });
    this.settle(id, this.heldX, this.heldY, time, leaving);
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
   * hole or the stall), and lets a release go once its command has applied. A sheep that died mid-drag ends the drag
   * with no command (its carcass lies at the pickup spot).
   */
  sync(sheep: readonly PublicSheep[], time: number): void {
    this.frameSheep = sheep;
    if (this.liveId !== 0) {
      const i = indexOf(sheep, this.liveId);
      if (i < 0) {
        this.liveId = 0;
        this.overHole = false;
        this.overMarket = false;
      } else {
        // It ages while held: an adult that turns elder shows "$5" from this frame.
        this.liveStage = sheep[i].stage;
        this.layer.spriteFor(this.liveId)?.hold(this.heldX, this.heldY, true);
      }
    }
    for (let i = 0; i < this.pending.length; i++) {
      const p = this.pending[i];
      if (p.id === 0) continue;
      if (time > p.releasedAt || indexOf(sheep, p.id) < 0) this.releaseSlot(p);
      else this.layer.spriteFor(p.id)?.hold(p.x, p.y, p.leaving);
    }
  }

  private settle(id: number, x: number, y: number, time: number, leaving: boolean): void {
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
    slot.leaving = leaving;
    this.liveId = 0;
    this.overHole = false;
    this.overMarket = false;
  }

  private releaseSlot(p: Pending): void {
    this.layer.spriteFor(p.id)?.release();
    p.id = 0;
  }
}

function indexOf(list: readonly PublicSheep[], id: number): number {
  for (let i = 0; i < list.length; i++) if (list[i].id === id) return i;
  return -1;
}
