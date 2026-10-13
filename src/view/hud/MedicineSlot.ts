import Phaser from 'phaser';
import { COMPONENTS, RADIUS, TYPOGRAPHY } from '../../config/constants';
import { ATLAS, FRAME } from '../assetKeys';
import { bus } from '../bus';
import { reportError } from '../safetyNet';
import { invariantFits } from '../fonts';
import { STRINGS } from '../strings';
import { boxTexture, OUTLINE_PX, textStyle } from '../widgets/box';
import type { TooltipSource } from '../widgets/tooltipSource';

const SPEC = COMPONENTS.medicineSlot;
// mockups/hud.html `.med` [ASSUMPTION, browser-checked]: a 64×56 tile, the 12×16 bottle at 2× and the
// count side by side, 2 px apart, centred.
const W = 64;
const H = 56;
const ICON_SCALE = 2;
const ICON_W = 12 * ICON_SCALE;
const GAP = 2;
// The count's box fits "×99"; more doses than that show "×99" (an unreal case: $1 485 of medicine).
const MAX_SHOWN = 99;
// The mockup's count is 20 px; at 20 "×99" (36 px) and the bottle overrun the tile's 60 px inside, so it
// is 18, the smallest allowed (UX-DR5). Measured in the browser, 2026-10-08.
const COUNT_FONT_PX = 18;
// The dose in hand: the bottle at the pointer, a little larger over an infected sheep (the only drop
// cue; information, so reduced motion keeps it). [ASSUMPTION]
const HELD_SCALE = 2;
const HELD_TARGET_SCALE = 2.4;
/** The slot's width in canvas px, for the bar's layout. */
export const MEDICINE_SLOT_W = W;

/**
 * The `medicine-slot` component (UX-DR33, Story 4.5): a `wool` tile right after Breed with the
 * infection-coloured bottle and "×{n}" in `numeric` `bark`. It shows only while at least one dose is
 * owned; hidden it takes no input and is no HUD control (`active`), but its space stays reserved. A left
 * press emits `medicine:pressed`; InputController turns a press that moves 6 px into a dose drag (the
 * slot's zone captures the press, so GameScene never sees it). It also draws the dose in hand, which
 * must show above the bar. Built once per game; `set` redraws only on a change.
 */
export class MedicineSlot implements TooltipSource {
  readonly x: number;
  readonly y: number;
  readonly width = W;
  readonly height = H;
  private readonly scene: Phaser.Scene;
  private readonly box: Phaser.GameObjects.Image;
  private readonly icon: Phaser.GameObjects.Image;
  private readonly text: Phaser.GameObjects.Text;
  private readonly zone: Phaser.GameObjects.Zone;
  private readonly held: Phaser.GameObjects.Image;
  private shown = Number.NaN;
  private visible = true;
  private hovered = false;
  private hoverSinceMs = -1;

  /** (x, centreY): the slot's left edge and vertical centre in canvas px; `heldDepth` for the dose in hand. */
  constructor(scene: Phaser.Scene, x: number, centreY: number, heldDepth: number) {
    this.scene = scene;
    this.x = x;
    this.y = Math.round(centreY - H / 2);
    this.box = scene.add
      .image(x, this.y, boxTexture(scene, W, H, { fill: SPEC.backgroundColor, border: SPEC.borderColor, radius: RADIUS[SPEC.rounded], drop: true }))
      .setOrigin(0, 0);
    this.icon = scene.add.image(0, centreY, ATLAS.ui, FRAME.iconMedicine).setScale(ICON_SCALE).setOrigin(0, 0.5);
    this.text = scene.add.text(0, centreY, STRINGS.medicineCount(MAX_SHOWN), textStyle(SPEC.typography, SPEC.textColor, COUNT_FONT_PX)).setOrigin(0, 0.5);
    invariantFits(TYPOGRAPHY[SPEC.typography].fontFamily, ICON_W + GAP + this.text.width, W - OUTLINE_PX * 2, 'MedicineSlot: "×99" does not fit the tile');
    this.zone = scene.add.zone(x, this.y, W, H).setOrigin(0, 0).setInteractive({ useHandCursor: true });
    this.zone.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OVER, this.onOver, this);
    this.zone.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OUT, this.onOut, this);
    this.zone.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, this.onDown, this);
    // Leaving the canvas emits only GAME_OUT (no gameobject out), as in Button.
    scene.input.on(Phaser.Input.Events.GAME_OUT, this.onOut, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      scene.input.off(Phaser.Input.Events.GAME_OUT, this.onOut, this);
    });
    this.held = scene.add.image(0, 0, ATLAS.ui, FRAME.iconMedicine).setScale(HELD_SCALE).setDepth(heldDepth).setVisible(false);
    this.set(0, 0);
  }

  get active(): boolean {
    return this.visible;
  }

  get tooltip(): string | undefined {
    return STRINGS.medicineTooltip;
  }

  get isHovered(): boolean {
    return this.hovered;
  }

  get hoverSince(): number {
    return this.hoverSinceMs;
  }

  /** Forgets hover and resets the hand cursor (a drag or a modal starting over the slot), as Button does. */
  clearHover(): void {
    if (this.hovered) this.scene.input.resetCursor();
    this.hovered = false;
    this.hoverSinceMs = -1;
  }

  /**
   * Shows `owned` doses minus those `inHand` (held, or dropped on a sheep whose cure is still queued),
   * so it may read "×0" with the last one held. The slot shows while any dose is owned. No work without
   * a change.
   */
  set(owned: number, inHand: number): void {
    const visible = owned >= 1;
    if (visible !== this.visible) {
      this.visible = visible;
      this.box.setVisible(visible);
      this.icon.setVisible(visible);
      this.text.setVisible(visible);
      if (this.zone.input) this.zone.input.enabled = visible;
      if (!visible) {
        this.clearHover();
      }
    }
    const n = Math.min(MAX_SHOWN, Math.max(0, owned - inHand));
    if (n === this.shown) return;
    this.shown = n;
    this.text.setText(STRINGS.medicineCount(n));
    // Bottle and count centred together in the tile.
    const left = this.x + Math.round((W - (ICON_W + GAP + this.text.width)) / 2);
    this.icon.setX(left);
    this.text.setX(left + ICON_W + GAP);
  }

  /** Draws the dose in hand at canvas point (x, y), larger over an infected sheep. */
  setHeld(x: number, y: number, overTarget: boolean): void {
    this.held.setVisible(true).setPosition(x, y).setScale(overTarget ? HELD_TARGET_SCALE : HELD_SCALE);
  }

  /** No dose in hand. */
  hideHeld(): void {
    if (this.held.visible) this.held.setVisible(false);
  }

  private onOver(): void {
    this.hovered = true;
    this.hoverSinceMs = this.scene.game.loop.time;
  }

  private onOut(): void {
    this.hovered = false;
    this.hoverSinceMs = -1;
  }

  // Runs inside Phaser's input step, where a throw would stop the game loop.
  private onDown(pointer: Phaser.Input.Pointer): void {
    try {
      if (!this.visible || !pointer.leftButtonDown()) return;
      // As a pressed Button: no tooltip until the pointer next enters (it is about to drag a dose).
      this.hoverSinceMs = -1;
      bus.emit('medicine:pressed', undefined);
    } catch (err) {
      reportError('ui', err);
    }
  }
}
