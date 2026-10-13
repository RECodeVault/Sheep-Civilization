import Phaser from 'phaser';
import { COMPONENTS, LAYOUT, SPACING, type ColorToken } from '../../config/constants';
import { bus } from '../bus';
import { boxTexture } from './box';

const SPEC = COMPONENTS.toggle;
// [ASSUMPTION, tune in the browser] DESIGN.md gives the height (32) only: a pill twice as wide as it
// is tall, with a round knob inset 4 px.
const H = SPEC.height;
const W = H * 2;
const INSET = SPACING[1];
const KNOB = H - INSET * 2;
// Hover lightens the knob (bark → bark-soft), as the Slider's thumb.
const KNOB_HOVER_COLOR: ColorToken = 'barkSoft';

export interface ToggleOptions {
  /** Top-left corner in canvas px. */
  x: number;
  y: number;
  on: boolean;
  onToggle: (on: boolean) => void;
}

/**
 * The `toggle` component (DESIGN.md, UX-DR22): a 32 px pill, `wool-shade` off and `hay` on, with a
 * `bark` knob at the left (off) or right (on). A click (press and release on it) toggles and pops like
 * a Button (`button:activated`). Baked textures only; a Zone at least `hit-min` tall takes the input
 * (UX-DR90). Overlay widget: it may setInteractive (project-context Input rule).
 */
export class Toggle {
  static readonly WIDTH = W;
  static readonly HEIGHT = H;
  readonly x: number;
  readonly y: number;
  private readonly scene: Phaser.Scene;
  private readonly options: ToggleOptions;
  private readonly pill: Phaser.GameObjects.Image;
  private readonly knob: Phaser.GameObjects.Image;
  private readonly textures: Readonly<{ off: string; on: string; knob: string; knobHover: string }>;
  private readonly zone: Phaser.GameObjects.Zone;
  private on: boolean;
  private hovered = false;
  private pressed = false;

  constructor(scene: Phaser.Scene, options: ToggleOptions) {
    this.scene = scene;
    this.options = options;
    this.x = options.x;
    this.y = options.y;
    this.on = options.on;
    const pillR = H / 2;
    const knobR = KNOB / 2;
    this.textures = {
      off: boxTexture(scene, W, H, { fill: SPEC.offColor, border: 'bark', radius: pillR, drop: true }),
      on: boxTexture(scene, W, H, { fill: SPEC.onColor, border: 'bark', radius: pillR, drop: true }),
      knob: boxTexture(scene, KNOB, KNOB, { fill: SPEC.knobColor, border: 'bark', radius: knobR, drop: false }),
      knobHover: boxTexture(scene, KNOB, KNOB, { fill: KNOB_HOVER_COLOR, border: 'bark', radius: knobR, drop: false }),
    };
    this.pill = scene.add.image(this.x, this.y, this.textures.off).setOrigin(0, 0);
    this.knob = scene.add.image(0, this.y + INSET, this.textures.knob).setOrigin(0, 0);

    const hitH = Math.max(LAYOUT.hitMin, H);
    this.zone = scene.add
      .zone(this.x, this.y + H / 2 - hitH / 2, W, hitH)
      .setOrigin(0, 0)
      .setInteractive({ useHandCursor: true });
    this.zone.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OVER, this.onOver, this);
    this.zone.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OUT, this.onOut, this);
    this.zone.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, this.onDown, this);
    this.zone.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, this.onUp, this);
    // Leaving the canvas emits only GAME_OUT (no gameobject out), as in Button.
    scene.input.on(Phaser.Input.Events.GAME_OUT, this.onOut, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      scene.input.off(Phaser.Input.Events.GAME_OUT, this.onOut, this);
    });

    this.refresh();
  }

  /** Shows `on` without calling back (the stored setting, when the panel opens). */
  setOn(on: boolean): this {
    if (on === this.on) return this;
    this.on = on;
    this.refresh();
    return this;
  }

  setDepth(depth: number): this {
    this.pill.setDepth(depth);
    this.knob.setDepth(depth);
    // Phaser's top-only input picks by depth (Button.setDepth).
    this.zone.setDepth(depth);
    return this;
  }

  /** Shows or hides the toggle; a hidden toggle takes no input and drops any hover or press. */
  setVisible(visible: boolean): this {
    this.pill.setVisible(visible);
    this.knob.setVisible(visible);
    if (this.zone.input) this.zone.input.enabled = visible;
    if (!visible) {
      // Hidden under the pointer, Phaser never fires OUT: drop the hand cursor (Button.setVisible).
      if (this.hovered) this.scene.input.resetCursor();
      this.hovered = false;
      this.pressed = false;
      this.refresh();
    }
    return this;
  }

  private refresh(): void {
    this.pill.setTexture(this.on ? this.textures.on : this.textures.off);
    this.knob
      .setTexture(this.hovered ? this.textures.knobHover : this.textures.knob)
      .setX(this.on ? this.x + W - INSET - KNOB : this.x + INSET);
  }

  private onOver(): void {
    this.hovered = true;
    this.refresh();
  }

  private onOut(): void {
    this.hovered = false;
    this.pressed = false;
    this.refresh();
  }

  private onDown(pointer: Phaser.Input.Pointer): void {
    if (pointer.leftButtonDown()) this.pressed = true;
  }

  private onUp(pointer: Phaser.Input.Pointer): void {
    if (!this.pressed || !pointer.leftButtonReleased()) return;
    this.pressed = false;
    this.on = !this.on;
    this.refresh();
    // Pops like every Button activation (Story 5.6): AudioDirector hears it before the change runs.
    bus.emit('button:activated', undefined);
    this.options.onToggle(this.on);
  }
}
