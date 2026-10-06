import type Phaser from 'phaser';
import { COMPONENTS, RADIUS, type ColorToken } from '../../config/constants';
import { boxTexture } from './box';

const SPEC = COMPONENTS.panel;

export interface PanelOptions {
  fill?: ColorToken;
  border?: ColorToken;
  /** Corner radius in px; defaults to `rounded.lg`. */
  radius?: number;
  /** The 2 px bark drop offset; defaults to on. */
  drop?: boolean;
}

/**
 * The `panel` component (DESIGN.md): a wool box with a bark outline and drop. Generic: the HUD bottom
 * bar uses it now; the lose, pause and confirm modals and the shop panel reuse it later.
 */
export class Panel {
  private readonly scene: Phaser.Scene;
  private readonly image: Phaser.GameObjects.Image;
  private readonly fill: ColorToken;
  private readonly border: ColorToken;
  private readonly radius: number;
  private readonly drop: boolean;

  constructor(scene: Phaser.Scene, options: PanelOptions = {}) {
    this.fill = options.fill ?? SPEC.backgroundColor;
    this.border = options.border ?? SPEC.borderColor;
    this.radius = options.radius ?? RADIUS[SPEC.rounded];
    this.drop = options.drop ?? true;
    this.scene = scene;
    // Invisible until setBounds gives it a size and a baked texture.
    this.image = scene.add.image(0, 0, '__WHITE').setOrigin(0, 0).setVisible(false);
  }

  /** Moves and resizes the panel. Call on layout changes only (a new size bakes a new texture). */
  setBounds(x: number, y: number, w: number, h: number): this {
    const key = boxTexture(this.scene, w, h, { fill: this.fill, border: this.border, radius: this.radius, drop: this.drop });
    this.image.setTexture(key).setPosition(x, y).setVisible(true);
    return this;
  }

  setDepth(depth: number): this {
    this.image.setDepth(depth);
    return this;
  }

  setVisible(visible: boolean): this {
    this.image.setVisible(visible);
    return this;
  }
}
