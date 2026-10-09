import type Phaser from 'phaser';
import type { Command } from '../../sim/commands';
import type { PublicSheep } from '../../sim/selectors';
import type { EntityLayer } from './EntityLayer';
import { spriteContains } from './hitTest';
import type { SheepSprite } from './SheepSprite';

/**
 * The geometry and command of a dose drag (FR26, UX-DR33, Story 4.5), like SheepDrag for a sheep.
 * InputController decides when it starts, ends or cancels; this tracks where the dose is held and which
 * infected sheep is under it, and on release over one sends ApplyMedicine. A drop anywhere else, or a
 * cancel, sends nothing: the dose was never taken from the sim, so it is simply back in the slot. Reads
 * only the frame's PublicSheep list; never touches GameState.
 *
 * A dose dropped on a sheep stays counted as "in hand" until a tick has run (`time > releasedAt`), so
 * the slot never shows the old count for a frame between the release and the sim's cure. Allocates
 * nothing per frame.
 */
export class MedicineDrag {
  private readonly camera: Phaser.Cameras.Scene2D.Camera;
  private readonly layer: EntityLayer<PublicSheep, SheepSprite>;
  private readonly dispatch: (cmd: Command) => void;
  private liveDose = false;
  /** The pointer, in canvas px: where the dose is drawn. */
  private heldX = 0;
  private heldY = 0;
  /** Not over a HUD control (the bar, the open shop): only then can it be dropped on a sheep. */
  private onField = false;
  /** The infected sheep under the dose this frame, 0 for none. */
  private targetId = 0;
  /** Doses dropped on a sheep whose ApplyMedicine has not applied yet, and when they were dropped. */
  private pendingN = 0;
  private releasedAt = 0;
  private frameSheep: readonly PublicSheep[] = [];

  constructor(
    camera: Phaser.Cameras.Scene2D.Camera,
    layer: EntityLayer<PublicSheep, SheepSprite>,
    dispatch: (cmd: Command) => void,
  ) {
    this.camera = camera;
    this.layer = layer;
    this.dispatch = dispatch;
  }

  /** True while the pointer holds a dose. */
  get live(): boolean {
    return this.liveDose;
  }

  get screenX(): number {
    return this.heldX;
  }

  get screenY(): number {
    return this.heldY;
  }

  /** True while the held dose is over an infected sheep (a release there cures it). */
  get overTarget(): boolean {
    return this.liveDose && this.targetId !== 0;
  }

  /** Doses out of the slot at `time`: the one held, plus any dropped on a sheep whose cure is still queued. */
  inHand(time: number): number {
    return (this.liveDose ? 1 : 0) + (time <= this.releasedAt ? this.pendingN : 0);
  }

  /**
   * Takes a dose, pressed at canvas point (sx, sy). False when none is free (`owned` doses, minus any in
   * hand at `time`).
   */
  begin(sx: number, sy: number, owned: number, time: number): boolean {
    if (this.liveDose || owned - this.inHand(time) < 1) return false;
    this.liveDose = true;
    this.heldX = sx;
    this.heldY = sy;
    this.onField = false;
    this.targetId = 0;
    return true;
  }

  /** The pointer moved to canvas point (sx, sy); `onHud` when it is on a HUD control. */
  move(sx: number, sy: number, onHud: boolean): void {
    if (!this.liveDose) return;
    this.heldX = sx;
    this.heldY = sy;
    this.onField = !onHud;
    this.targetId = this.onField ? this.infectedAt(sx, sy) : 0;
  }

  /** Released at canvas point (sx, sy): cures the infected sheep under it, else nothing. */
  end(sx: number, sy: number, onHud: boolean, time: number): void {
    if (!this.liveDose) return;
    this.move(sx, sy, onHud);
    this.liveDose = false;
    const id = this.targetId;
    this.targetId = 0;
    if (id === 0) return;
    // A rare event, so the command object is fine. The sim checks again (medicine.ts).
    this.dispatch({ type: 'ApplyMedicine', id });
    if (time > this.releasedAt) this.pendingN = 0;
    this.pendingN++;
    this.releasedAt = time;
  }

  /** Cancelled (Esc, blur, a modal, released off the canvas): the dose goes back, nothing is sent. */
  cancel(): void {
    this.liveDose = false;
    this.targetId = 0;
  }

  /**
   * Call every frame with the frame's PublicSheep list: re-tests the sheep under a still pointer (a
   * green sheep may wander under or away from it, or stop being infected).
   */
  sync(sheep: readonly PublicSheep[]): void {
    this.frameSheep = sheep;
    if (this.liveDose && this.onField) this.targetId = this.infectedAt(this.heldX, this.heldY);
  }

  /** Id of the front-most infected sheep whose sprite contains canvas point (sx, sy), or 0. */
  private infectedAt(sx: number, sy: number): number {
    const wx = sx + this.camera.scrollX;
    const wy = sy + this.camera.scrollY;
    const list = this.frameSheep;
    let best = 0;
    let bestY = -Infinity;
    for (let i = 0; i < list.length; i++) {
      const p = list[i];
      if (!p.infected) continue;
      const spr = this.layer.spriteFor(p.id);
      if (spr !== undefined && spr.y > bestY && spriteContains(spr, wx, wy)) {
        best = p.id;
        bestY = spr.y;
      }
    }
    return best;
  }
}
