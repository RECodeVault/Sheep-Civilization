import Phaser from 'phaser';
import {
  COLORS,
  COMPONENTS,
  LAYOUT,
  RADIUS,
  SPACING,
  type ColorToken,
  type RadiusToken,
  type TypographyToken,
} from '../../config/constants';
import { boxTexture, DROP_PX, textStyle, type BoxStyle } from './box';

/** The fields of a DESIGN.md button component (`COMPONENTS.buttonFarm`, `buttonMenu`, …). */
export interface ButtonSpec {
  readonly backgroundColor: ColorToken;
  readonly borderColor: ColorToken;
  readonly textColor: ColorToken;
  readonly typography: TypographyToken;
  readonly rounded: RadiusToken;
  readonly height: number;
  readonly hoverBackgroundColor?: ColorToken;
  readonly pressedBackgroundColor?: ColorToken;
  readonly padding?: number;
}

export interface ButtonOptions {
  /** Top-left corner and width in canvas px; the height comes from the spec. */
  x: number;
  y: number;
  width: number;
  label: string;
  /** Shortcut letter printed in a small key box at the right (UX-DR72), e.g. "F". */
  keyHint?: string;
  tooltip?: string;
  /** 'left' (default; HUD buttons, with room for the key hint) or 'center' (menu buttons, mockups `.btn-menu`). */
  labelAlign?: 'left' | 'center';
  /**
   * 'press' fires on left-button down (Farm: a clicker must feel snappy). 'release' fires on
   * left-button up over the button, only if the press started on it (menu buttons may use it).
   */
  activateOn: 'press' | 'release';
  onActivate: () => void;
}

type Visual = 'normal' | 'hover' | 'pressed' | 'disabled';

// mockups/hud.html `.key`: 26×26 wool box, 2 px bark border, rounded.sm, Pixelify 18/600.
const KEY_SIZE = 26;
const KEY_FONT_PX = 18;
// Squash juice (UX-DR77): a quick flatten from the bottom edge. Visual only.
const SQUASH = { scaleX: 1.05, scaleY: 0.85, durationMs: 80 } as const;

/**
 * A DESIGN.md button: drop + outline + fill, a label in `label` type and an optional key hint.
 * The visuals sit in a container anchored at the bottom centre, so `squash()` flattens towards the
 * bar; input uses a separate Zone so the squash never moves the hit area. Redraws on state change
 * only. HUD widgets may use setInteractive (project-context Input rule).
 */
export class Button {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly tooltip: string | undefined;
  private readonly scene: Phaser.Scene;
  private readonly spec: ButtonSpec;
  private readonly options: ButtonOptions;
  private readonly root: Phaser.GameObjects.Container;
  private readonly box: Phaser.GameObjects.Image;
  /** Baked box texture per visual state, built once in the constructor. */
  private readonly textures: Readonly<Record<Visual, string>>;
  private readonly label: Phaser.GameObjects.Text;
  private readonly zone: Phaser.GameObjects.Zone;
  private visual: Visual | null = null;
  private hovered = false;
  private pressed = false;
  private enabled = true;
  /** Real time the pointer entered, or -1 while not hovering or after a press (no tooltip). */
  private hoverSinceMs = -1;

  constructor(scene: Phaser.Scene, spec: ButtonSpec, options: ButtonOptions) {
    this.scene = scene;
    this.spec = spec;
    this.options = options;
    this.x = options.x;
    this.y = options.y;
    this.width = options.width;
    this.height = spec.height;
    this.tooltip = options.tooltip;

    const w = this.width;
    const h = this.height;
    const pad = spec.padding ?? SPACING[3];
    this.root = scene.add.container(this.x + w / 2, this.y + h);
    this.textures = {
      normal: boxTexture(scene, w, h, this.boxStyle('normal')),
      hover: boxTexture(scene, w, h, this.boxStyle('hover')),
      pressed: boxTexture(scene, w, h, this.boxStyle('pressed')),
      disabled: boxTexture(scene, w, h, this.boxStyle('disabled')),
    };
    this.box = scene.add.image(-w / 2, -h, this.textures.normal).setOrigin(0, 0);
    const centred = options.labelAlign === 'center';
    this.label = scene.add
      .text(centred ? 0 : -w / 2 + pad, -h / 2, options.label, textStyle(spec.typography, spec.textColor))
      .setOrigin(centred ? 0.5 : 0, 0.5);
    this.root.add([this.box, this.label]);

    if (options.keyHint !== undefined) {
      const kx = w / 2 - pad - KEY_SIZE;
      const ky = -h / 2 - KEY_SIZE / 2;
      const key = scene.add
        .image(kx, ky, boxTexture(scene, KEY_SIZE, KEY_SIZE, { fill: 'wool', border: 'bark', radius: RADIUS.sm, drop: false }))
        .setOrigin(0, 0);
      const keyText = scene.add
        .text(kx + KEY_SIZE / 2, ky + KEY_SIZE / 2, options.keyHint, textStyle('numeric', 'bark', KEY_FONT_PX))
        .setOrigin(0.5, 0.5);
      this.root.add([key, keyText]);
    }

    // Covers the drop offset too, and never smaller than the 40 px hit minimum (UX-DR90).
    const hitH = Math.max(LAYOUT.hitMin, h + DROP_PX);
    this.zone = scene.add
      .zone(this.x, this.y, w + DROP_PX, hitH)
      .setOrigin(0, 0)
      .setInteractive({ useHandCursor: true });
    this.zone.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OVER, this.onOver, this);
    this.zone.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OUT, this.onOut, this);
    this.zone.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, this.onDown, this);
    this.zone.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, this.onUp, this);
    // Leaving the canvas emits only GAME_OUT (no gameobject out), so clear hover and press here too.
    scene.input.on(Phaser.Input.Events.GAME_OUT, this.onOut, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      scene.input.off(Phaser.Input.Events.GAME_OUT, this.onOut, this);
    });

    this.refresh();
  }

  setDepth(depth: number): this {
    this.root.setDepth(depth);
    // The hit zone too: Phaser's top-only input picks by depth, so a zone left at 0 under a raised
    // scrim would never receive the click.
    this.zone.setDepth(depth);
    return this;
  }

  /** Shows or hides the button; a hidden button takes no input and drops any hover or press. */
  setVisible(visible: boolean): this {
    this.root.setVisible(visible);
    // Not `visible && enabled`: a disabled button keeps its zone so it can hover for its reason
    // tooltip (UX-DR31); onDown already refuses to press or activate it while disabled.
    if (this.zone.input) this.zone.input.enabled = visible;
    // Hidden under the pointer (Resume hides the pause panel) Phaser never fires OUT, so the hand
    // cursor would stay over the field. Shown under a still pointer, a button gets no hover until
    // the pointer moves; a click still works (Phaser hit-tests on down), so nothing polls for it.
    if (!visible && this.hovered) this.scene.input.resetCursor();
    if (!visible) {
      this.hovered = false;
      this.pressed = false;
      this.hoverSinceMs = -1;
      this.refresh();
    }
    return this;
  }

  setEnabled(enabled: boolean): this {
    if (enabled === this.enabled) return this;
    this.enabled = enabled;
    if (!enabled) {
      this.pressed = false;
      this.hoverSinceMs = -1;
    }
    if (this.zone.input) this.zone.input.cursor = enabled ? 'pointer' : 'default';
    this.refresh();
    return this;
  }

  /** True while Phaser reports the pointer over the button. */
  get isHovered(): boolean {
    return this.hovered;
  }

  /**
   * Forgets hover and press, and resets the hand cursor. For a modal opening over the button: the
   * scrim takes the pointer, so Phaser never sends this button pointer-out, and the stale hover would
   * bring the tooltip, hover fill or hand cursor back. After the modal, hover returns once the pointer
   * leaves and re-enters.
   */
  clearHover(): void {
    if (this.hovered) this.scene.input.resetCursor();
    this.hovered = false;
    this.pressed = false;
    this.hoverSinceMs = -1;
    this.refresh();
  }

  /** Real time (ms) the pointer started hovering, or -1 if no tooltip should show. */
  get hoverSince(): number {
    return this.hoverSinceMs;
  }

  /** Hides the tooltip until the pointer next enters (a press, from the pointer or a key). */
  suppressTooltip(): void {
    this.hoverSinceMs = -1;
  }

  /** Bottom-centre flatten (juice). Restarts cleanly on rapid presses. */
  squash(): void {
    const tweens = this.scene.tweens;
    tweens.killTweensOf(this.root);
    this.root.setScale(1, 1);
    tweens.add({
      targets: this.root,
      scaleX: SQUASH.scaleX,
      scaleY: SQUASH.scaleY,
      duration: SQUASH.durationMs,
      yoyo: true,
      ease: 'Quad.easeOut',
    });
  }

  private onOver(): void {
    this.hovered = true;
    // Phaser processes a down before an over (first input after load, touch): no tooltip mid-press.
    if (this.enabled && !this.pressed) this.hoverSinceMs = this.scene.game.loop.time;
    this.refresh();
  }

  private onOut(): void {
    this.hovered = false;
    this.pressed = false;
    this.hoverSinceMs = -1;
    this.refresh();
  }

  private onDown(pointer: Phaser.Input.Pointer): void {
    if (!this.enabled || !pointer.leftButtonDown()) return;
    this.pressed = true;
    this.suppressTooltip();
    this.refresh();
    if (this.options.activateOn === 'press') this.options.onActivate();
  }

  private onUp(pointer: Phaser.Input.Pointer): void {
    if (!this.pressed || !pointer.leftButtonReleased()) return;
    this.pressed = false;
    this.refresh();
    if (this.enabled && this.options.activateOn === 'release') this.options.onActivate();
  }

  private refresh(): void {
    const v: Visual = !this.enabled ? 'disabled' : this.pressed ? 'pressed' : this.hovered ? 'hover' : 'normal';
    if (v === this.visual) return;
    this.visual = v;
    this.box.setTexture(this.textures[v]);
    this.label.setColor(COLORS[v === 'disabled' ? COMPONENTS.buttonDisabled.textColor : this.spec.textColor]);
  }

  private boxStyle(v: Visual): BoxStyle {
    const s = this.spec;
    const off = COMPONENTS.buttonDisabled;
    const fill =
      v === 'disabled'
        ? off.backgroundColor
        : v === 'pressed'
          ? (s.pressedBackgroundColor ?? s.backgroundColor)
          : v === 'hover'
            ? (s.hoverBackgroundColor ?? s.backgroundColor)
            : s.backgroundColor;
    return {
      fill,
      border: v === 'disabled' ? off.backgroundColor : s.borderColor,
      radius: RADIUS[s.rounded],
      drop: v === 'normal' || v === 'hover',
    };
  }
}
