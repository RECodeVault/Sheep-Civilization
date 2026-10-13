import Phaser from 'phaser';
import { COMPONENTS } from '../../config/constants';
import type { SimEvent } from '../../sim/events';
import { currentEra, isLost, selectLoseView, selectStatsView, type LoseView, type StatsView } from '../../sim/selectors';
import { bus } from '../bus';
import { ConfirmPanel } from '../overlay/ConfirmPanel';
import { EraBadge } from '../overlay/EraBadge';
import { LosePanel } from '../overlay/LosePanel';
import { MenuPanel } from '../overlay/MenuPanel';
import { ModalController } from '../overlay/ModalController';
import { PlaceholderPanel } from '../overlay/PlaceholderPanel';
import { StatsPanel } from '../overlay/StatsPanel';
import { VolumePanel } from '../overlay/VolumePanel';
import { reportError } from '../safetyNet';
import { STRINGS } from '../strings';
import type { GameScene } from './GameScene';

// Within this scene: the scrim under every modal panel.
const SCRIM_DEPTH = 0;
// The era badge (Story 3.5): above the scrim, so a modal never dims it, and below the panels, which are
// centred and never reach its top-right corner.
const BADGE_DEPTH = 5;
const PANEL_DEPTH = 10;
// [ASSUMPTION] UX-DR19: "the sim stops, a scrim appears, then the lose panel". Visual only. Pause
// shows at once (approved by Rylan 2026-10-06).
const SCRIM_FADE_MS = 250;

type OverlayModal = 'pause' | 'volume' | 'stats' | 'subPanel' | 'confirm' | 'lose';

/**
 * In-game modals (UX-DR10 layer 4), launched by GameScene in parallel and drawn above the HUD, plus the
 * era badge, which must stay above their scrim (Story 3.5): the
 * pause menu (its last button, Main Menu, saves and returns to the title), its Volume (Story 5.7) and
 * Stats (Story 5.4) sub-panels and the Credits placeholder (until 5.9), the start-over confirm and the lose screen, one
 * at a time over one scrim (ModalController). Pause opens the stack and pauses the game (GameScene.setPaused) until it closes; the Esc chain calls `closeConfirm`, `closeSubPanel`
 * and `togglePause` through InputController. Never steps the sim; GameScene relaunches it on every
 * restart, so every listener is removed on SHUTDOWN.
 */
export class OverlayScene extends Phaser.Scene {
  private gameScene!: GameScene;
  private modals!: ModalController<OverlayModal>;
  private losePanel!: LosePanel;
  private subPanel!: PlaceholderPanel;
  private statsPanel!: StatsPanel;
  private badge!: EraBadge;
  private showingLose = false;
  private readonly loseView: LoseView = { survivedMs: 0, peakFlock: 0 };
  private readonly statsView: StatsView = { alive: 0, sold: 0, died: 0, sacrificed: 0, moneyEarned: 0 };

  constructor() {
    super('OverlayScene');
  }

  create(): void {
    this.gameScene = this.scene.get('GameScene') as GameScene;
    this.showingLose = false;
    this.modals = new ModalController<OverlayModal>(this, COMPONENTS.menuScrim, SCRIM_DEPTH);
    this.badge = new EraBadge(this, BADGE_DEPTH);
    this.losePanel = new LosePanel(this, PANEL_DEPTH, this.restart);
    this.subPanel = new PlaceholderPanel(this, PANEL_DEPTH, () => this.modals.back());
    this.statsPanel = new StatsPanel(this, PANEL_DEPTH, () => this.modals.back());
    this.modals
      .add('lose', this.losePanel)
      .add('subPanel', this.subPanel)
      .add('volume', new VolumePanel(this, PANEL_DEPTH, () => this.modals.back()))
      .add('stats', this.statsPanel)
      .add(
        'pause',
        new MenuPanel(this, PANEL_DEPTH, {
          header: STRINGS.paused,
          items: [
            { label: STRINGS.resume, onActivate: () => this.closePause() },
            { label: STRINGS.volume, onActivate: () => this.modals.open('volume') },
            { label: STRINGS.stats, onActivate: () => this.openStats() },
            { label: STRINGS.restart, onActivate: () => this.modals.open('confirm') },
            { label: STRINGS.credits, onActivate: () => this.openSubPanel(STRINGS.credits) },
            { label: STRINGS.mainMenu, onActivate: () => this.gameScene.quitToTitle() },
          ],
        }),
      )
      .add(
        'confirm',
        new ConfirmPanel(
          this,
          PANEL_DEPTH,
          () => this.modals.back(),
          () => this.gameScene.newGame(),
        ),
      );

    bus.on('sim', this.onSim, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      bus.off('sim', this.onSim, this);
    });

    // A state that is already lost (a lost save, or debug Load): show at once. Guarded: a throw
    // inside create() would leave Phaser's scene queue stuck.
    try {
      // The current era from the first frame (a new, continued or loaded game), with no banner.
      this.badge.set(currentEra(this.gameScene.simState));
      if (isLost(this.gameScene.simState)) this.showLose(false);
    } catch (err) {
      reportError('ui', err);
    }
  }

  // --- Esc chain (InputController, UX-DR73) ------------------------------------------------------
  // Each returns true when it consumed the press.

  /** Step 1: the start-over confirm goes back to the pause panel. */
  closeConfirm(): boolean {
    return this.modals.current === 'confirm' && this.modals.back();
  }

  /** Step 2: the Volume or Stats panel, or the Credits placeholder, goes back to the pause panel. */
  closeSubPanel(): boolean {
    const current = this.modals.current;
    return (current === 'volume' || current === 'stats' || current === 'subPanel') && this.modals.back();
  }

  /** Last step: opens or closes pause. Over a lost game it swallows the press and does nothing. */
  togglePause(): boolean {
    if (this.showingLose || isLost(this.gameScene.simState)) return true;
    if (this.modals.current === 'pause') this.closePause();
    else if (this.modals.current === null) this.openPause();
    return true;
  }

  /** Opens the pause menu (Esc, or the HUD's Pause button). Does nothing while another modal is up. */
  openPause(): void {
    if (this.modals.current !== null || this.showingLose || isLost(this.gameScene.simState)) return;
    this.gameScene.setPaused(true);
    this.modals.show('pause');
  }

  private closePause(): void {
    this.modals.hideAll();
    this.gameScene.setPaused(false);
  }

  /** Stats (Story 5.4): filled from the paused sim, then shown in the pause panel's place. */
  private openStats(): void {
    this.statsPanel.setView(selectStatsView(this.gameScene.simState, this.statsView));
    this.modals.open('stats');
  }

  private openSubPanel(header: string): void {
    this.subPanel.setHeader(header);
    this.modals.open('subPanel');
  }

  // Runs inside GameScene's tick (drainEvents → bus): a throw must not count as a sim error.
  private readonly onSim = (e: SimEvent): void => {
    try {
      // Always the current era (UX-DR36), under any modal too. The losing tick emits no EraChanged (AC 2),
      // so a one-tick wipe sets it from the derived era here.
      if (e.type === 'Lost') {
        this.badge.set(currentEra(this.gameScene.simState));
        this.showLose(true);
      } else if (e.type === 'EraChanged') this.badge.set(e.to);
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
    if (this.showingLose) return;
    this.showingLose = true;
    // The lose screen replaces any open modal (never two at once).
    this.losePanel.setView(selectLoseView(this.gameScene.simState, this.loseView));
    if (fade) this.modals.fadeInThenShow('lose', SCRIM_FADE_MS, (err) => reportError('ui', err));
    else this.modals.show('lose');
  }
}
