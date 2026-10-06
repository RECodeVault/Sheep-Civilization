import type Phaser from 'phaser';
import { CANVAS_HEIGHT, CANVAS_WIDTH, COMPONENTS, RADIUS, SPACING } from '../../config/constants';
import { formatGameTime } from '../../core/format';
import type { LoseView } from '../../sim/selectors';
import { STRINGS } from '../strings';
import { textStyle } from '../widgets/box';
import { Button } from '../widgets/Button';
import { Panel } from '../widgets/Panel';

const SPEC = COMPONENTS.losePanel;
const BUTTON = COMPONENTS.buttonMenu;
// [ASSUMPTION] Fixed size (boxTexture never evicts, so modal sizes stay constant): wide enough for
// "The flock is gone." in display type with at least 32 px each side, tall enough for the stack below.
const WIDTH = 680;
const HEIGHT = 248;
const X = (CANVAS_WIDTH - WIDTH) / 2;
const Y = (CANVAS_HEIGHT - HEIGHT) / 2;
const PAD = SPACING[6];
const TITLE_GAP = SPACING[4];
const BUTTON_GAP = SPACING[6];

/**
 * The `lose-panel` (UX-DR19): a dusk panel with "The flock is gone." in display type, the time
 * survived and peak flock in halo, and one Restart menu button. Built once, hidden; `show` fills the
 * stats line. Lives in OverlayScene, over the menu scrim.
 */
export class LosePanel {
  private readonly panel: Panel;
  private readonly title: Phaser.GameObjects.Text;
  private readonly stats: Phaser.GameObjects.Text;
  private readonly restart: Button;

  constructor(scene: Phaser.Scene, depth: number, onRestart: () => void) {
    const cx = CANVAS_WIDTH / 2;
    this.panel = new Panel(scene, { fill: SPEC.backgroundColor, radius: RADIUS[SPEC.rounded] })
      .setBounds(X, Y, WIDTH, HEIGHT)
      .setDepth(depth);
    this.title = scene.add
      .text(cx, Y + PAD, STRINGS.loseTitle, textStyle('display', SPEC.textColor))
      .setOrigin(0.5, 0)
      .setDepth(depth + 1);
    // [ASSUMPTION] numeric type: the docs give the stats only a colour (halo); UX-DR4 maps numbers to numeric.
    this.stats = scene.add
      .text(cx, this.title.y + this.title.height + TITLE_GAP, '', textStyle('numeric', SPEC.statColor))
      .setOrigin(0.5, 0)
      .setDepth(depth + 1);
    this.restart = new Button(scene, BUTTON, {
      x: cx - BUTTON.width / 2,
      y: this.stats.y + this.stats.height + BUTTON_GAP,
      width: BUTTON.width,
      label: STRINGS.restart,
      labelAlign: 'center',
      activateOn: 'release',
      onActivate: onRestart,
    }).setDepth(depth + 1);
    this.setVisible(false);
  }

  show(view: LoseView): void {
    this.stats.setText(STRINGS.loseStats(formatGameTime(view.survivedMs), view.peakFlock));
    this.setVisible(true);
  }

  setVisible(visible: boolean): void {
    this.panel.setVisible(visible);
    this.title.setVisible(visible);
    this.stats.setVisible(visible);
    this.restart.setVisible(visible);
  }
}
