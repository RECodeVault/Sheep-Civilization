import Phaser from 'phaser';
import { COLORS, COMPONENTS, LAYOUT, RADIUS, SPACING, type ColorToken } from '../../config/constants';
import { formatMoney } from '../../core/format';
import { invariant } from '../../core/invariant';
import { SHOP_ROWS, shopRequires, type ShopRowView } from '../../sim/selectors';
import type { ShopRowId } from '../../sim/state';
import { ATLAS, FRAME } from '../assetKeys';
import { FIELD_DEPTH } from '../field/depths';
import { SHOP_PANEL_W, SHOP_PANEL_X } from '../field/layout';
import { STRINGS } from '../strings';
import { boxTexture, DROP_PX, OUTLINE_PX, textStyle } from '../widgets/box';

const PANEL = COMPONENTS.shopPanel;
const ROW = COMPONENTS.shopItemRow;
// Geometry from mockups/hud.html `.shop` / `.row` / `.shop-hd` [ASSUMPTION, browser-checked]: the panel
// stands on the bottom bar at the left safe margin, 360 wide, with a 2 px wood border, 16 px padding, the
// "Shop" header on a 20 px line, then the 56 px rows 4 px apart.
const BAR_TOP = LAYOUT.canvasHeight - LAYOUT.hudBarHeight;
const PANEL_X = SHOP_PANEL_X;
const PANEL_W = SHOP_PANEL_W;
const HEADER_H = 20;
const ROW_GAP = 4;
const PANEL_H = OUTLINE_PX + PANEL.padding + HEADER_H + SHOP_ROWS.length * (ROW_GAP + ROW.height) + PANEL.padding;
const PANEL_Y = BAR_TOP - PANEL_H;
// Each row raises the panel's top (Story 4.5 code review): it must stay below the Pause button, which
// sits at the same left margin. 6 rows put the top at y 194; 4.7/4.8's 3 more would not fit.
invariant(
  PANEL_Y >= LAYOUT.safeMargin + COMPONENTS.buttonPause.height + SPACING[2],
  `ShopPanel: ${SHOP_ROWS.length} rows make the panel ${PANEL_H} px tall; its top (y ${PANEL_Y}) meets the Pause button`,
);
const ROW_X = PANEL_X + OUTLINE_PX + PANEL.padding;
const ROW_W = PANEL_W - (OUTLINE_PX + PANEL.padding) * 2;
const ROW_PAD = SPACING[2];
const ICON_SIZE = 28;
const ICON_SCALE = 2;
// The two text lines inside a 56 px row (name/price on a 22 px line, the effect on a 23 px one).
const LINE1_Y = 16;
const LINE2_Y = 39;
// SHOP_PANEL_RIGHT (layout.ts) is PANEL_X + PANEL_W, for the field camera.

// Land I–III share one icon; Medicine shows the slot's bottle (Story 4.5).
const SHOP_ICON: Readonly<Record<ShopRowId, string>> = Object.freeze({
  land1: FRAME.iconLand,
  land2: FRAME.iconLand,
  land3: FRAME.iconLand,
  flowerPatch: FRAME.iconFlowerPatch,
  scarecrow: FRAME.iconScarecrow,
  medicine: FRAME.iconMedicine,
});

/** What a row shows (UX-DR24): buyable, unaffordable, locked behind a Land tier, or owned. */
type Look = 'buy' | 'poor' | 'locked' | 'owned';

const LOOK_OF = (block: ShopRowView['block']): Look => (block === null ? 'buy' : block);

interface Row {
  readonly item: ShopRowId;
  readonly box: Phaser.GameObjects.Image;
  readonly name: Phaser.GameObjects.Text;
  readonly price: Phaser.GameObjects.Text;
  readonly effect: Phaser.GameObjects.Text;
  readonly zone: Phaser.GameObjects.Zone;
  look: Look | null;
  shownPrice: number;
  hovered: boolean;
  pressed: boolean;
}

/**
 * The `shop-panel` with its `shop-item-row`s (UX-DR23, UX-DR24). It is drawn by GameScene, not the HUD:
 * the world overlays (pings, markers, hearts, popups, particles, a dragged sheep, the sheep tooltip) must
 * draw above it (UX-DR10, UX-DR63), and they live in GameScene's world-overlay band, which the HUD and
 * Overlay scenes would cover. So every part is screen-fixed (scroll factor 0) in `FIELD_DEPTH.shop`, and
 * the rows are UI widgets with their own interactive zones in GameScene (the documented exception to
 * "UI widgets live in HUD/Overlay"). GameScene treats the open panel as a HUD control, so presses on it
 * never reach the field. The bar (HudScene, above) hides the panel's bottom corners.
 *
 * A row is bought by a press and release on it, with no confirm (UX-DR68). `update` redraws a row only
 * when its look changes. Built once per game; shown and hidden, never created or destroyed in play.
 */
export class ShopPanel {
  private readonly scene: Phaser.Scene;
  private readonly onBuy: (item: ShopRowId) => void;
  private readonly parts: Phaser.GameObjects.GameObject[] = [];
  private readonly rows: Row[] = [];
  private readonly rowNormal: string;
  private readonly rowHover: string;
  private open = false;
  // False while a sheep is dragged or the field is panned: the rows neither hover nor take presses,
  // like the HUD buttons, whose input HudScene turns off for a drag (Story 3.2 review).
  private live = true;

  constructor(scene: Phaser.Scene, onBuy: (item: ShopRowId) => void) {
    this.scene = scene;
    this.onBuy = onBuy;
    const depth = FIELD_DEPTH.shop;
    // Taller by the corner radius, so the bottom corners sit under the bar (mockup `border-bottom: none`).
    const key = boxTexture(scene, PANEL_W, PANEL_H + RADIUS[PANEL.rounded], {
      fill: PANEL.backgroundColor,
      border: PANEL.borderColor,
      radius: RADIUS[PANEL.rounded],
      drop: true,
    });
    this.add(scene.add.image(PANEL_X, PANEL_Y, key).setOrigin(0, 0).setDepth(depth));
    this.add(
      scene.add
        .text(ROW_X, PANEL_Y + OUTLINE_PX + PANEL.padding + HEADER_H / 2, STRINGS.shopHeader, textStyle(PANEL.headerTypography, 'bark'))
        .setOrigin(0, 0.5)
        .setDepth(depth + 1),
    );
    const rowStyle = (fill: ColorToken): string =>
      boxTexture(scene, ROW_W, ROW.height, { fill, border: fill, radius: RADIUS[ROW.rounded], drop: false });
    this.rowNormal = rowStyle(ROW.backgroundColor);
    // [ASSUMPTION] A buyable row's hover is the menu buttons' `hay` (DESIGN gives the row no hover).
    this.rowHover = rowStyle('hay');
    for (let i = 0; i < SHOP_ROWS.length; i++) this.rows.push(this.buildRow(SHOP_ROWS[i], i, depth + 1));
    scene.input.on(Phaser.Input.Events.GAME_OUT, this.clearHover, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      scene.input.off(Phaser.Input.Events.GAME_OUT, this.clearHover, this);
    });
    this.setOpen(false);
  }

  get isOpen(): boolean {
    return this.open;
  }

  setOpen(open: boolean): void {
    this.open = open;
    for (const p of this.parts) (p as unknown as Phaser.GameObjects.Components.Visible).setVisible(open);
    this.applyInput();
    if (!open) this.clearHover();
  }

  /**
   * Turns the rows' input off while a sheep is dragged or the field is panned, and back on after, so a
   * sheep carried across the panel lights no row. A no-op without a change; call it every frame.
   */
  setLive(live: boolean): void {
    if (live === this.live) return;
    this.live = live;
    this.applyInput();
    if (!live) this.clearHover();
  }

  /** True while the pointer is on a row that can be bought (GameScene restores the hand cursor). */
  get hoveringBuyable(): boolean {
    for (const r of this.rows) if (r.hovered && r.look === 'buy') return true;
    return false;
  }

  private applyInput(): void {
    const on = this.open && this.live;
    for (const r of this.rows) if (r.zone.input) r.zone.input.enabled = on;
  }

  /** True when canvas point (sx, sy) is on the open panel (its box and drop). No allocation. */
  contains(sx: number, sy: number): boolean {
    return this.open && sx >= PANEL_X && sx < PANEL_X + PANEL_W + DROP_PX && sy >= PANEL_Y && sy < BAR_TOP;
  }

  /** Forgets hover and press (a modal opened over the panel, or it closed). */
  readonly clearHover = (): void => {
    for (const r of this.rows) {
      if (r.hovered) this.scene.input.resetCursor();
      r.hovered = false;
      r.pressed = false;
      this.paintBox(r);
    }
  };

  /** Shows this frame's rows; each redraws only when its look or price changes. */
  update(view: readonly ShopRowView[]): void {
    for (let i = 0; i < this.rows.length; i++) {
      const r = this.rows[i];
      const v = view[i];
      const look = LOOK_OF(v.block);
      if (look === r.look && v.price === r.shownPrice) continue;
      r.look = look;
      r.shownPrice = v.price;
      this.paint(r);
    }
  }

  private add<T extends Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.ScrollFactor>(o: T): T {
    o.setScrollFactor(0);
    this.parts.push(o);
    return o;
  }

  private buildRow(item: ShopRowId, i: number, depth: number): Row {
    const s = this.scene;
    const y = PANEL_Y + OUTLINE_PX + PANEL.padding + HEADER_H + ROW_GAP + i * (ROW.height + ROW_GAP);
    const box = this.add(s.add.image(ROW_X, y, this.rowNormal).setOrigin(0, 0).setDepth(depth));
    this.add(
      s.add
        .image(ROW_X + ROW_PAD + ICON_SIZE / 2, y + ROW.height / 2, ATLAS.ui, SHOP_ICON[item])
        .setScale(ICON_SCALE)
        .setDepth(depth + 1),
    );
    const textX = ROW_X + ROW_PAD + ICON_SIZE + ROW_PAD;
    const name = this.add(
      s.add.text(textX, y + LINE1_Y, STRINGS.shopName[item], textStyle(ROW.typography, ROW.textColor)).setOrigin(0, 0.5).setDepth(depth + 1),
    );
    const price = this.add(
      s.add.text(ROW_X + ROW_W - ROW_PAD, y + LINE1_Y, '', textStyle(ROW.priceTypography, ROW.priceColor)).setOrigin(1, 0.5).setDepth(depth + 1),
    );
    const effect = this.add(
      s.add.text(textX, y + LINE2_Y, '', textStyle(ROW.effectTypography, 'barkSoft')).setOrigin(0, 0.5).setDepth(depth + 1),
    );
    const zone = this.add(s.add.zone(ROW_X, y, ROW_W, ROW.height).setOrigin(0, 0).setInteractive({ useHandCursor: true }));
    const row: Row = { item, box, name, price, effect, zone, look: null, shownPrice: Number.NaN, hovered: false, pressed: false };
    zone.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OVER, () => {
      row.hovered = true;
      this.paintBox(row);
    });
    zone.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OUT, () => {
      row.hovered = false;
      row.pressed = false;
      this.paintBox(row);
    });
    zone.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, (p: Phaser.Input.Pointer) => {
      if (row.look === 'buy' && p.leftButtonDown()) row.pressed = true;
    });
    zone.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, (p: Phaser.Input.Pointer) => {
      // Only a press that began on this row buys (UX-DR24); the sim checks again when it applies.
      if (!row.pressed || !p.leftButtonReleased()) return;
      row.pressed = false;
      if (row.look === 'buy') this.onBuy(row.item);
    });
    return row;
  }

  /** Text, colours and cursor for the row's look (UX-DR24). */
  private paint(r: Row): void {
    const look = r.look;
    const grey = look === 'poor' || look === 'locked';
    const ink = (c: ColorToken): string => COLORS[grey ? ROW.unaffordableTextColor : c];
    r.name.setColor(ink(ROW.textColor));
    r.price.setText(look === 'owned' ? STRINGS.shopOwned : formatMoney(r.shownPrice));
    r.price.setColor(look === 'owned' ? COLORS.barkSoft : ink(ROW.priceColor));
    const req = shopRequires(r.item);
    r.effect.setText(look === 'locked' && req !== null ? STRINGS.shopNeeds(STRINGS.shopName[req]) : STRINGS.shopEffect[r.item]);
    r.effect.setColor(ink('barkSoft'));
    const buyable = look === 'buy';
    if (!buyable) r.pressed = false;
    const cursor = buyable ? 'pointer' : 'default';
    if (r.zone.input) r.zone.input.cursor = cursor;
    // Phaser sets the canvas cursor only on pointer over/out: set it for a pointer already here.
    if (r.hovered) this.scene.input.manager.canvas.style.cursor = buyable ? cursor : this.scene.input.manager.defaultCursor;
    this.paintBox(r);
  }

  private paintBox(r: Row): void {
    const key = r.hovered && r.look === 'buy' ? this.rowHover : this.rowNormal;
    if (r.box.texture.key !== key) r.box.setTexture(key);
  }
}
