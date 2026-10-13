import Phaser from 'phaser';
import { COMPONENTS, LAYOUT, RADIUS, SPACING, type ColorToken } from '../../config/constants';
import { boxTexture } from './box';
import { thumbX, valueAt } from './sliderMath';

const SPEC = COMPONENTS.slider;
// [ASSUMPTION, tune in the browser] DESIGN.md gives the thumb's height (40) only: a chunky 16 px track
// and a 20 px-wide thumb, both rounded.sm.
const TRACK_H = SPACING[4];
const THUMB_W = 20;
const THUMB_H = SPEC.height;
// Hover lightens the thumb (bark → bark-soft): visible, but no new colour token.
const THUMB_HOVER_COLOR: ColorToken = 'barkSoft';

export interface SliderOptions {
  /** Left edge of the track and top of the control, in canvas px. */
  x: number;
  y: number;
  /** Track length in px; the thumb overhangs each end by half its width. */
  width: number;
  value: number;
  /** Each change of value while pressing or dragging. */
  onChange: (value: number) => void;
  /**
   * Once per press, with the final value. `released` is false when the drag ended without a release
   * (hidden mid-drag by Esc or Back, a window blur, a lost release, a shutdown): the value still counts,
   * but nothing should be previewed.
   */
  onRelease: (value: number, released: boolean) => void;
}

/**
 * The `slider` component (DESIGN.md, UX-DR22): a `wool-shade` track, a `hay` fill from the left up to
 * the value and a 40 px `bark` thumb. Press anywhere on it to set the value there and drag; the drag
 * follows the pointer anywhere on the canvas and ends on release, even outside the canvas. Every look is
 * a baked texture (the fill is one full-length image cropped to the value), so nothing is redrawn per
 * frame. Input uses a Zone at least `hit-min` tall (UX-DR90), as Button does. Overlay widget: it may
 * setInteractive (project-context Input rule).
 */
export class Slider {
  /** The control's height in px (the thumb's). */
  static readonly HEIGHT = THUMB_H;
  /** How far the thumb overhangs each end of the track, in px (half its width). */
  static readonly OVERHANG = THUMB_W / 2;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  private readonly scene: Phaser.Scene;
  private readonly options: SliderOptions;
  private readonly track: Phaser.GameObjects.Image;
  private readonly fill: Phaser.GameObjects.Image;
  private readonly thumb: Phaser.GameObjects.Image;
  private readonly thumbTextures: Readonly<{ normal: string; hover: string }>;
  private readonly zone: Phaser.GameObjects.Zone;
  private value: number;
  private hovered = false;
  private dragging = false;
  // The pointer that started the drag: another pointer's moves and releases are ignored.
  private dragPointer = -1;

  constructor(scene: Phaser.Scene, options: SliderOptions) {
    this.scene = scene;
    this.options = options;
    this.x = options.x;
    this.y = options.y;
    this.width = options.width;
    this.value = options.value;
    const w = this.width;
    const midY = this.y + THUMB_H / 2;
    const r = RADIUS.sm;

    this.track = scene.add
      .image(this.x, midY - TRACK_H / 2, boxTexture(scene, w, TRACK_H, { fill: SPEC.trackColor, border: 'bark', radius: r, drop: true }))
      .setOrigin(0, 0);
    this.fill = scene.add
      // No drop of its own: it sits on the track, whose drop shows under it.
      .image(this.x, midY - TRACK_H / 2, boxTexture(scene, w, TRACK_H, { fill: SPEC.fillColor, border: 'bark', radius: r, drop: false }))
      .setOrigin(0, 0);
    this.thumbTextures = {
      normal: boxTexture(scene, THUMB_W, THUMB_H, { fill: SPEC.thumbColor, border: 'bark', radius: r, drop: true }),
      hover: boxTexture(scene, THUMB_W, THUMB_H, { fill: THUMB_HOVER_COLOR, border: 'bark', radius: r, drop: true }),
    };
    this.thumb = scene.add.image(0, this.y, this.thumbTextures.normal).setOrigin(0, 0);

    // The whole track plus the thumb's overhang, never shorter than the hit minimum.
    const hitH = Math.max(LAYOUT.hitMin, THUMB_H);
    this.zone = scene.add
      .zone(this.x - THUMB_W / 2, midY - hitH / 2, w + THUMB_W, hitH)
      .setOrigin(0, 0)
      .setInteractive({ useHandCursor: true });
    this.zone.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OVER, this.onOver, this);
    this.zone.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OUT, this.onOut, this);
    this.zone.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, this.onDown, this);
    const input = scene.input;
    input.on(Phaser.Input.Events.POINTER_MOVE, this.onMove, this);
    input.on(Phaser.Input.Events.POINTER_UP, this.onUp, this);
    input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.onUp, this);
    // Leaving the canvas emits only GAME_OUT (no gameobject out), as in Button. A drag goes on: the
    // release outside still ends it (POINTER_UP_OUTSIDE).
    input.on(Phaser.Input.Events.GAME_OUT, this.onOut, this);
    // A release while the window is unfocused never arrives: end the drag on blur (as GameScene does).
    scene.game.events.on(Phaser.Core.Events.BLUR, this.onBlur, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      // Shut down mid-drag (a restart): the live value is still saved.
      this.endDrag(false);
      scene.game.events.off(Phaser.Core.Events.BLUR, this.onBlur, this);
      input.off(Phaser.Input.Events.POINTER_MOVE, this.onMove, this);
      input.off(Phaser.Input.Events.POINTER_UP, this.onUp, this);
      input.off(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.onUp, this);
      input.off(Phaser.Input.Events.GAME_OUT, this.onOut, this);
    });

    this.layout();
  }

  /** Shows `value` without calling back (the stored setting, when the panel opens). Ignored mid-drag. */
  setValue(value: number): this {
    if (this.dragging || value === this.value) return this;
    this.value = value;
    this.layout();
    return this;
  }

  setDepth(depth: number): this {
    this.track.setDepth(depth);
    this.fill.setDepth(depth);
    this.thumb.setDepth(depth);
    // Phaser's top-only input picks by depth (Button.setDepth).
    this.zone.setDepth(depth);
    return this;
  }

  /**
   * Shows or hides the slider. A hidden slider takes no input; hidden mid-drag, the drag ends with
   * `onRelease(value, false)` (so the value is kept but not previewed).
   */
  setVisible(visible: boolean): this {
    this.track.setVisible(visible);
    this.fill.setVisible(visible);
    this.thumb.setVisible(visible);
    if (this.zone.input) this.zone.input.enabled = visible;
    // The fill hides at 0 (an empty crop), so lay it out again rather than show it blindly.
    if (visible) this.layout();
    else {
      // Hidden under the pointer, Phaser never fires OUT: drop the hand cursor (Button.setVisible).
      if (this.hovered || this.dragging) this.scene.input.resetCursor();
      this.hovered = false;
      this.endDrag(false);
      this.refresh();
    }
    return this;
  }

  private layout(): void {
    const w = this.width;
    const filled = Math.round(this.value * w);
    // One full-length fill texture, cropped to the value: no texture per value.
    this.fill.setCrop(0, 0, filled, TRACK_H).setVisible(this.track.visible && filled > 0);
    this.thumb.setX(Math.round(thumbX(this.value, this.x, w) - THUMB_W / 2));
  }

  private refresh(): void {
    this.thumb.setTexture(this.hovered || this.dragging ? this.thumbTextures.hover : this.thumbTextures.normal);
  }

  private setFromPointer(px: number): void {
    const v = valueAt(px, this.x, this.width);
    if (v === this.value) return;
    this.value = v;
    this.layout();
    this.options.onChange(v);
  }

  private endDrag(released: boolean): void {
    if (!this.dragging) return;
    this.dragging = false;
    this.refresh();
    this.options.onRelease(this.value, released);
  }

  private onOver(): void {
    this.hovered = true;
    this.refresh();
  }

  private onOut(): void {
    this.hovered = false;
    this.refresh();
  }

  private onBlur(): void {
    this.endDrag(false);
  }

  private onDown(pointer: Phaser.Input.Pointer): void {
    if (this.dragging || !pointer.leftButtonDown()) return;
    this.dragging = true;
    this.dragPointer = pointer.id;
    this.refresh();
    this.setFromPointer(pointer.x);
  }

  private onMove(pointer: Phaser.Input.Pointer): void {
    if (!this.dragging || pointer.id !== this.dragPointer) return;
    // The release was lost (outside the window, a context menu): the move's buttons say the left
    // button is up, so the drag is over.
    if (!pointer.leftButtonDown()) {
      this.endDrag(false);
      return;
    }
    this.setFromPointer(pointer.x);
  }

  private onUp(pointer: Phaser.Input.Pointer): void {
    if (!this.dragging || pointer.id !== this.dragPointer || !pointer.leftButtonReleased()) return;
    this.endDrag(true);
  }
}
