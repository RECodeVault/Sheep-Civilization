import type Phaser from 'phaser';
import { CANVAS_HEIGHT, CANVAS_WIDTH, COMPONENTS, SPACING, TYPOGRAPHY, type TypographyToken } from '../../config/constants';
import { guarded } from '../safetyNet';
import { textStyle } from '../widgets/box';
import { Button } from '../widgets/Button';
import { Panel } from '../widgets/Panel';

const BUTTON = COMPONENTS.buttonMenu;
const TEXT_COLOR = COMPONENTS.panel.textColor;
// mockups pause.html / title.html `.stack`: menu buttons 12 px apart.
const STACK_GAP = SPACING[3];

/**
 * The line box of one line of `role` text (font size × line height, DESIGN.md typography). Modal
 * layouts use it instead of measured Text heights, so every panel size is a fixed number (box
 * textures are cached per size and never evicted) and does not shift with a fallback font.
 */
export function lineBox(role: TypographyToken, lines = 1): number {
  const t = TYPOGRAPHY[role];
  return Math.round(t.fontSize * t.lineHeight * lines);
}

/** Anything a ModalController can show and hide. */
export interface Modal {
  setVisible(visible: boolean): void;
}

export interface MenuItem {
  readonly label: string;
  readonly onActivate: () => void;
}

export interface MenuPanelOptions {
  /** Header text; omitted for a panel of buttons only. */
  readonly header?: string;
  /** `title` for menu headers ("Paused"), `display` for the title logo (UX-DR4). */
  readonly headerType?: 'title' | 'display';
  /** Inner padding on every side (mockups: 16 for the pause panel, 32 for the title panel). */
  readonly padding?: number;
  /** Gap between the header line and the first button (12 pause, 24 title). */
  readonly headerGap?: number;
  /** Panel width; defaults to the button width plus padding. */
  readonly width?: number;
  readonly items: readonly MenuItem[];
}

/**
 * A wool `panel` (DESIGN.md) holding an optional header and a centred stack of `button-menu`
 * buttons (280 × 52, label type, hover hay, centred labels, activate on release). Centred on the
 * canvas, built once and hidden; the pause menu and the title screen use it. Its size follows from
 * the tokens and the item count only, so each menu bakes one box texture.
 */
export class MenuPanel implements Modal {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  private readonly panel: Panel;
  private readonly header: Phaser.GameObjects.Text | null;
  private readonly buttons: Button[] = [];

  constructor(scene: Phaser.Scene, depth: number, o: MenuPanelOptions) {
    const pad = o.padding ?? SPACING[4];
    const headerType = o.headerType ?? 'title';
    const headerH = o.header === undefined ? 0 : lineBox(headerType) + (o.headerGap ?? SPACING[3]);
    const n = o.items.length;
    this.width = o.width ?? BUTTON.width + pad * 2;
    this.height = pad * 2 + headerH + n * BUTTON.height + Math.max(0, n - 1) * STACK_GAP;
    this.x = Math.round((CANVAS_WIDTH - this.width) / 2);
    this.y = Math.round((CANVAS_HEIGHT - this.height) / 2);
    const cx = CANVAS_WIDTH / 2;

    this.panel = new Panel(scene).setBounds(this.x, this.y, this.width, this.height).setDepth(depth);
    this.header =
      o.header === undefined
        ? null
        : scene.add
            .text(cx, this.y + pad + lineBox(headerType) / 2, o.header, textStyle(headerType, TEXT_COLOR))
            .setOrigin(0.5, 0.5)
            .setDepth(depth + 1);
    let y = this.y + pad + headerH;
    for (const item of o.items) {
      this.buttons.push(
        new Button(scene, BUTTON, {
          x: cx - BUTTON.width / 2,
          y,
          width: BUTTON.width,
          label: item.label,
          labelAlign: 'center',
          activateOn: 'release',
          onActivate: guarded(item.onActivate),
        }).setDepth(depth + 1),
      );
      y += BUTTON.height + STACK_GAP;
    }
    this.setVisible(false);
  }

  setVisible(visible: boolean): void {
    this.panel.setVisible(visible);
    this.header?.setVisible(visible);
    for (const b of this.buttons) b.setVisible(visible);
  }
}
