import Phaser from 'phaser';
import { CANVAS_HEIGHT, CANVAS_WIDTH, COLOR_INT, COMPONENTS } from '../../config/constants';
import type { SimEvent } from '../../sim/events';
import { isLost, selectLoseView, type LoseView } from '../../sim/selectors';
import { bus } from '../bus';
import { LosePanel } from '../overlay/LosePanel';
import { reportError } from '../safetyNet';
import type { GameScene } from './GameScene';

// Within this scene: the scrim under every modal panel.
const SCRIM_DEPTH = 0;
const PANEL_DEPTH = 10;
const SCRIM = COMPONENTS.menuScrim;
// [ASSUMPTION] UX-DR19: "the sim stops, a scrim appears, then the lose panel". Visual only.
const SCRIM_FADE_MS = 250;

/**
 * Modals (UX-DR10 layer 4), launched by GameScene in parallel and drawn above the HUD. Today: the
 * lose screen. Story 1.10 adds pause and the start-over confirm, reusing the one scrim. Never steps
 * the sim; GameScene relaunches it on every restart, so every listener is removed on SHUTDOWN.
 */
export class OverlayScene extends Phaser.Scene {
  private gameScene!: GameScene;
  private scrim!: Phaser.GameObjects.Rectangle;
  private losePanel!: LosePanel;
  private showing = false;
  private readonly loseView: LoseView = { survivedMs: 0, peakFlock: 0 };

  constructor() {
    super('OverlayScene');
  }

  create(): void {
    this.gameScene = this.scene.get('GameScene') as GameScene;
    this.showing = false;
    // Full canvas, interactive with no handlers: it swallows clicks ("clicking the scrim does
    // nothing"), and Phaser's global top-only input keeps them from the HUD below.
    this.scrim = this.add
      .rectangle(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT, COLOR_INT[SCRIM.backgroundColor], 1)
      .setOrigin(0, 0)
      .setDepth(SCRIM_DEPTH)
      .setInteractive();
    this.setScrim(false, 0);
    this.losePanel = new LosePanel(this, PANEL_DEPTH, this.restart);

    bus.on('sim', this.onSim, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      bus.off('sim', this.onSim, this);
    });

    // A state that is already lost (debug Load now, Story 1.9 resume later): show at once. Guarded:
    // a throw inside create() would leave Phaser's scene queue stuck.
    try {
      if (isLost(this.gameScene.simState)) this.showLose(false);
    } catch (err) {
      reportError('ui', err);
    }
  }

  // Runs inside GameScene's tick (drainEvents → bus): a throw must not count as a sim error.
  private readonly onSim = (e: SimEvent): void => {
    if (e.type !== 'Lost') return;
    try {
      this.showLose(true);
    } catch (err) {
      reportError('ui', err);
    }
  };

  // Runs inside Phaser's input step, where a throw would stop the game loop.
  private readonly restart = (): void => {
    try {
      this.gameScene.newGame();
    } catch (err) {
      reportError('ui', err);
    }
  };

  private showLose(fade: boolean): void {
    if (this.showing) return;
    this.showing = true;
    const view = selectLoseView(this.gameScene.simState, this.loseView);
    if (!fade) {
      this.setScrim(true, SCRIM.opacity);
      this.losePanel.show(view);
      return;
    }
    this.setScrim(true, 0);
    this.tweens.add({
      targets: this.scrim,
      alpha: SCRIM.opacity,
      duration: SCRIM_FADE_MS,
      ease: 'Quad.easeOut',
      // Visual only: shows the panel, never touches GameState.
      onComplete: () => {
        try {
          this.losePanel.show(view);
        } catch (err) {
          reportError('ui', err);
        }
      },
    });
  }

  private setScrim(visible: boolean, alpha: number): void {
    this.scrim.setVisible(visible).setAlpha(alpha);
    if (this.scrim.input) this.scrim.input.enabled = visible;
  }
}
