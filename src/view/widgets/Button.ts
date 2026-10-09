import Phaser from 'phaser';
import {
  COLOR_INT,
  COLORS,
  COMPONENTS,
  LAYOUT,
  RADIUS,
  SPACING,
  type ColorToken,
  type RadiusToken,
  type TypographyToken,
} from '../../config/constants';
import { ATLAS } from '../assetKeys';
import { boxTexture, DROP_PX, textStyle, type BoxStyle } from './box';
import type { TooltipSource } from './tooltipSource';

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
  /** The toggled-on look (`button-breed-tool` active: heart-deep fill, wool label). */
  readonly activeBackgroundColor?: ColorToken;
  readonly activeTextColor?: ColorToken;
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
  /** A `ui` atlas frame drawn left of the label, coloured like the label (the Breed tool's heart). */
  icon?: string;
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

type Visual = 'normal' | 'hover' | 'pressed' | 'disabled' | 'toggled';

// mockups/hud.html `.key`: 26×26 wool box, 2 px bark border, rounded.sm, Pixelify 18/600 (the `title`
// face at 18 px: a key is a letter, so it kept the pixel font when numbers moved to Nunito).
const KEY_SIZE = 26;
const KEY_FONT_PX = 18;
// Squash juice (UX-DR77): a quick flatten from the bottom edge. Visual only.
const SQUASH = { scaleX: 1.05, scaleY: 0.85, durationMs: 80 } as const;
// Icon art is drawn at 1×; shown at 2× like the field art.
const ICON_SCALE = 2;

/**
 * A DESIGN.md button: drop + outline + fill, a label in `label` type and an optional key hint.
 * The visuals sit in a container anchored at the bottom centre, so `squash()` flattens towards the
 * bar; input uses a separate Zone so the squash never moves the hit area. Redraws on state change
 * only. HUD widgets may use setInteractive (project-context Input rule).
 */
export class Button implements TooltipSource {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  private tooltipText: string | undefined;
  private readonly scene: Phaser.Scene;
  private readonly spec: ButtonSpec;
  private readonly options: ButtonOptions;
  private readonly root: Phaser.GameObjects.Container;
  private readonly box: Phaser.GameObjects.Image;
  /** Baked box texture per visual state, built once in the constructor. */
  private readonly textures: Readonly<Record<Visual, string>>;
  private readonly label: Phaser.GameObjects.Text;
  private icon: Phaser.GameObjects.Image | null = null;
  // undefined until the constructor's first setIcon, so a button without an icon still lays out its label.
  private iconFrame: string | null | undefined = undefined;
  private readonly zone: Phaser.GameObjects.Zone;
  private visual: Visual | null = null;
  private hovered = false;
  private pressed = false;
  private enabled = true;
  private toggled = false;
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
    this.tooltipText = options.tooltip;

    const w = this.width;
    const h = this.height;
    const pad = spec.padding ?? SPACING[3];
    this.root = scene.add.container(this.x + w / 2, this.y + h);
    this.textures = {
      normal: boxTexture(scene, w, h, this.boxStyle('normal')),
      hover: boxTexture(scene, w, h, this.boxStyle('hover')),
      pressed: boxTexture(scene, w, h, this.boxStyle('pressed')),
      disabled: boxTexture(scene, w, h, this.boxStyle('disabled')),
      // Only a spec with an active look can toggle; others never show this state.
      toggled: spec.activeBackgroundColor === undefined ? '' : boxTexture(scene, w, h, this.boxStyle('toggled')),
    };
    this.box = scene.add.image(-w / 2, -h, this.textures.normal).setOrigin(0, 0);
    this.label = scene.add.text(0, -h / 2, options.label, textStyle(spec.typography, spec.textColor));
    this.root.add([this.box, this.label]);
    this.setIcon(options.icon ?? null);

    if (options.keyHint !== undefined) {
      const kx = w / 2 - pad - KEY_SIZE;
      const ky = -h / 2 - KEY_SIZE / 2;
      const key = scene.add
        .image(kx, ky, boxTexture(scene, KEY_SIZE, KEY_SIZE, { fill: 'wool', border: 'bark', radius: RADIUS.sm, drop: false }))
        .setOrigin(0, 0);
      const keyText = scene.add
        .text(kx + KEY_SIZE / 2, ky + KEY_SIZE / 2, options.keyHint, textStyle('title', 'bark', KEY_FONT_PX))
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

  /**
   * Greys the button out (`button-disabled`) or back. A disabled button still hovers, so its tooltip
   * can give the reason (UX-DR31); it only refuses presses. Under a still pointer the tooltip and the
   * cursor follow the change at once, with no need to leave and re-enter.
   */
  setEnabled(enabled: boolean): this {
    if (enabled === this.enabled) return this;
    this.enabled = enabled;
    if (!enabled) this.pressed = false;
    const cursor = enabled ? 'pointer' : 'default';
    if (this.zone.input) this.zone.input.cursor = cursor;
    if (this.hovered) {
      // Phaser sets the canvas cursor only on pointer over/out, so set it for a pointer already here.
      const m = this.scene.input.manager;
      m.canvas.style.cursor = enabled ? cursor : m.defaultCursor;
      if (this.hoverSinceMs < 0) this.hoverSinceMs = this.scene.game.loop.time;
    }
    this.refresh();
    return this;
  }

  /** The toggled-on look (an active tool). Disabled wins over it. */
  setToggled(on: boolean): this {
    if (on === this.toggled) return this;
    this.toggled = on;
    this.refresh();
    return this;
  }

  /**
   * Shows `frame` (a `ui` atlas frame) left of the label, or no icon for null, and lays the label out
   * again. A no-op unless it changes. The Breed tool's heart is set once; the Farm button's Better Hoe
   * icon changes with the hoe owned (Story 4.7).
   */
  setIcon(frame: string | null): this {
    if (frame === this.iconFrame) return this;
    this.iconFrame = frame;
    const w = this.width;
    const h = this.height;
    const pad = this.spec.padding ?? SPACING[3];
    const centred = this.options.labelAlign === 'center';
    if (frame === null) {
      this.icon?.setVisible(false);
      this.label.setOrigin(centred ? 0.5 : 0, 0.5).setX(centred ? 0 : -w / 2 + pad);
      return this;
    }
    if (this.icon === null) {
      this.icon = this.scene.add.image(0, -h / 2, ATLAS.ui, frame).setScale(ICON_SCALE).setOrigin(0, 0.5);
      this.root.add(this.icon);
    } else {
      // The atlas gives every frame a pivot, so setFrame resets the origin to it (0.5): set ours again.
      this.icon.setFrame(frame).setOrigin(0, 0.5).setVisible(true);
    }
    // The icon sits left of the label; centred, the pair is centred together (mockups `.btn-breed`).
    const iconW = this.icon.displayWidth + SPACING[2];
    const left = centred ? -(iconW + this.label.width) / 2 : -w / 2 + pad;
    this.icon.setX(left);
    this.label.setOrigin(0, 0.5).setX(left + iconW);
    // A new or changed icon takes the current state's tint (refresh skips an unchanged look). In the
    // constructor nothing is drawn yet; its own refresh() follows.
    if (this.visual !== null) {
      this.visual = null;
      this.refresh();
    }
    return this;
  }

  /** The tooltip text, or undefined for none. */
  get tooltip(): string | undefined {
    return this.tooltipText;
  }

  /** Changes the tooltip (the Breed tool's reason); a shown tooltip picks it up on the next frame. */
  setTooltip(text: string | undefined): this {
    this.tooltipText = text;
    return this;
  }

  /** True unless greyed out. */
  get isEnabled(): boolean {
    return this.enabled;
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
    // A disabled button hovers too, for its reason tooltip.
    if (!this.pressed) this.hoverSinceMs = this.scene.game.loop.time;
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
    const v: Visual = !this.enabled
      ? 'disabled'
      : this.toggled && this.textures.toggled !== ''
        ? 'toggled'
        : this.pressed
          ? 'pressed'
          : this.hovered
            ? 'hover'
            : 'normal';
    if (v === this.visual) return;
    this.visual = v;
    this.box.setTexture(this.textures[v]);
    const text =
      v === 'disabled'
        ? COMPONENTS.buttonDisabled.textColor
        : v === 'toggled'
          ? (this.spec.activeTextColor ?? this.spec.textColor)
          : this.spec.textColor;
    this.label.setColor(COLORS[text]);
    // The icon art is in the normal colour; other states fill it with their label colour.
    if (this.icon !== null) {
      if (text === this.spec.textColor) this.icon.clearTint();
      else this.icon.setTint(COLOR_INT[text]).setTintMode(Phaser.TintModes.FILL);
    }
  }

  private boxStyle(v: Visual): BoxStyle {
    const s = this.spec;
    const off = COMPONENTS.buttonDisabled;
    const fill =
      v === 'disabled'
        ? off.backgroundColor
        : v === 'toggled'
          ? (s.activeBackgroundColor ?? s.backgroundColor)
          : v === 'pressed'
          ? (s.pressedBackgroundColor ?? s.backgroundColor)
          : v === 'hover'
            ? (s.hoverBackgroundColor ?? s.backgroundColor)
            : s.backgroundColor;
    return {
      fill,
      border: v === 'disabled' ? off.backgroundColor : s.borderColor,
      radius: RADIUS[s.rounded],
      drop: v === 'normal' || v === 'hover' || v === 'toggled',
    };
  }
}
