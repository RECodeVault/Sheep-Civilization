import type Phaser from 'phaser';
import { CANVAS_HEIGHT, CANVAS_WIDTH, COMPONENTS, SPACING } from '../../config/constants';
import { STRINGS } from '../strings';
import { textStyle } from '../widgets/box';
import { Button } from '../widgets/Button';
import { Panel } from '../widgets/Panel';
import { guarded, lineBox, type Modal } from './MenuPanel';

const CANCEL = COMPONENTS.buttonMenu;
const START_OVER = COMPONENTS.buttonMenuDestructive;
// mockups/pause.html `.confirm`: padding 32 top, 24 sides and bottom; 24 px to the button pair;
// `.q` wraps at 440 px (two lines of title type); `.pair` 12 px apart.
const PAD_TOP = SPACING[6];
const PAD = SPACING[5];
const QUESTION_GAP = SPACING[5];
const PAIR_GAP = SPACING[3];
const WRAP_WIDTH = 440;
const QUESTION_LINES = 2;
const WIDTH = CANCEL.width + PAIR_GAP + START_OVER.width + PAD * 2;
const QUESTION_H = lineBox('title', QUESTION_LINES);
const HEIGHT = PAD_TOP + QUESTION_H + QUESTION_GAP + CANCEL.height + PAD;
const X = Math.round((CANVAS_WIDTH - WIDTH) / 2);
const Y = Math.round((CANVAS_HEIGHT - HEIGHT) / 2);

/**
 * The start-over confirm (UX-DR18): "Start over? Your flock will be lost." with Cancel (menu
 * button, left) and Start over (destructive: awning fill, wool label, hover alert, right). The only
 * confirmation in the game; the title's New Game (save exists) and the pause menu's Restart use it.
 */
export class ConfirmPanel implements Modal {
  private readonly panel: Panel;
  private readonly question: Phaser.GameObjects.Text;
  private readonly cancel: Button;
  private readonly confirm: Button;

  constructor(scene: Phaser.Scene, depth: number, onCancel: () => void, onConfirm: () => void) {
    const cx = CANVAS_WIDTH / 2;
    this.panel = new Panel(scene).setBounds(X, Y, WIDTH, HEIGHT).setDepth(depth);
    this.question = scene.add
      .text(cx, Y + PAD_TOP + QUESTION_H / 2, STRINGS.startOverQuestion, {
        ...textStyle('title', COMPONENTS.panel.textColor),
        align: 'center',
        wordWrap: { width: WRAP_WIDTH },
      })
      .setOrigin(0.5, 0.5)
      .setDepth(depth + 1);
    const by = Y + PAD_TOP + QUESTION_H + QUESTION_GAP;
    this.cancel = new Button(scene, CANCEL, {
      x: X + PAD,
      y: by,
      width: CANCEL.width,
      label: STRINGS.cancel,
      labelAlign: 'center',
      activateOn: 'release',
      onActivate: guarded(onCancel),
    }).setDepth(depth + 1);
    this.confirm = new Button(scene, START_OVER, {
      x: X + PAD + CANCEL.width + PAIR_GAP,
      y: by,
      width: START_OVER.width,
      label: STRINGS.startOver,
      labelAlign: 'center',
      activateOn: 'release',
      onActivate: guarded(onConfirm),
    }).setDepth(depth + 1);
    this.setVisible(false);
  }

  setVisible(visible: boolean): void {
    this.panel.setVisible(visible);
    this.question.setVisible(visible);
    this.cancel.setVisible(visible);
    this.confirm.setVisible(visible);
  }
}
