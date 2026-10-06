import type Phaser from 'phaser';
import { CANVAS_HEIGHT, CANVAS_WIDTH, COMPONENTS, SPACING } from '../../config/constants';
import { STRINGS } from '../strings';
import { textStyle } from '../widgets/box';
import { Button } from '../widgets/Button';
import { Panel } from '../widgets/Panel';
import { guarded } from '../safetyNet';
import { lineBox, type Modal } from './MenuPanel';

const BUTTON = COMPONENTS.buttonMenu;
const TEXT_COLOR = COMPONENTS.panel.textColor;
// Same frame as the pause panel: padding 16, 12 px under the header; 24 px above Back.
const PAD = SPACING[4];
const HEADER_GAP = SPACING[3];
const BODY_GAP = SPACING[5];
const WIDTH = BUTTON.width + PAD * 2;
const HEIGHT = PAD + lineBox('title') + HEADER_GAP + lineBox('body') + BODY_GAP + BUTTON.height + PAD;
const X = Math.round((CANVAS_WIDTH - WIDTH) / 2);
const Y = Math.round((CANVAS_HEIGHT - HEIGHT) / 2);

/**
 * Stand-in for the Volume, Stats and Credits sub-panels (Stories 5.7, 5.4 and 5.9 replace it): a
 * header in title type, "Coming soon." in body type (Nunito, as credits will be: UX-DR17) and one
 * Back button. One fixed size for all three; `setHeader` swaps the header text only.
 */
export class PlaceholderPanel implements Modal {
  private readonly panel: Panel;
  private readonly header: Phaser.GameObjects.Text;
  private readonly body: Phaser.GameObjects.Text;
  private readonly back: Button;

  constructor(scene: Phaser.Scene, depth: number, onBack: () => void) {
    const cx = CANVAS_WIDTH / 2;
    this.panel = new Panel(scene).setBounds(X, Y, WIDTH, HEIGHT).setDepth(depth);
    let y = Y + PAD;
    this.header = scene.add
      .text(cx, y + lineBox('title') / 2, '', textStyle('title', TEXT_COLOR))
      .setOrigin(0.5, 0.5)
      .setDepth(depth + 1);
    y += lineBox('title') + HEADER_GAP;
    this.body = scene.add
      .text(cx, y + lineBox('body') / 2, STRINGS.comingSoon, textStyle('body', TEXT_COLOR))
      .setOrigin(0.5, 0.5)
      .setDepth(depth + 1);
    y += lineBox('body') + BODY_GAP;
    this.back = new Button(scene, BUTTON, {
      x: cx - BUTTON.width / 2,
      y,
      width: BUTTON.width,
      label: STRINGS.back,
      labelAlign: 'center',
      activateOn: 'release',
      onActivate: guarded(onBack),
    }).setDepth(depth + 1);
    this.setVisible(false);
  }

  setHeader(text: string): this {
    if (this.header.text !== text) this.header.setText(text);
    return this;
  }

  setVisible(visible: boolean): void {
    this.panel.setVisible(visible);
    this.header.setVisible(visible);
    this.body.setVisible(visible);
    this.back.setVisible(visible);
  }
}
