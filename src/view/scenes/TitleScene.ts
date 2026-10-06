import Phaser from 'phaser';
import { COLORS, COMPONENTS, SPACING } from '../../config/constants';
import { discardSave, loadSave, wipeSave } from '../../save/saveStore';
import type { GameState } from '../../sim/state';
import { TitleFlock } from '../field/TitleFlock';
import { ConfirmPanel } from '../overlay/ConfirmPanel';
import { MenuPanel, type MenuItem } from '../overlay/MenuPanel';
import { ModalController } from '../overlay/ModalController';
import { PlaceholderPanel } from '../overlay/PlaceholderPanel';
import { guarded } from '../safetyNet';
import { STRINGS } from '../strings';
import { stateCanRun, type GameSceneData } from './GameScene';

// The decorative sheep (depth = y ≤ 720) under the 40% scrim, under the panels.
const SCRIM_DEPTH = 1_000;
const PANEL_DEPTH = 1_010;
// mockups/title.html `.title-panel`: 32 px padding, 24 px between the logo and the buttons.
// Width: the logo in display type measured 485 px, so 560 leaves 37 px each side (≥ 32 padding).
const TITLE_PAD = SPACING[6];
const TITLE_GAP = SPACING[5];
const TITLE_W = 560;

type TitleModal = 'title' | 'confirm' | 'credits';

/** Optional scene data: a game Main Menu could not save, offered for Continue from memory. */
export interface TitleSceneData {
  unsaved?: GameState;
}

/**
 * The start screen (UX-DR12): the logo and Continue (only when a save loads and can run) / New Game
 * / Credits in one wool panel over the lighter 40% scrim, with three sheep milling behind. It owns
 * the boot load decision (AR9): a save that does not load or cannot run is discarded and only New
 * Game is offered. New Game with a save asks first (UX-DR13, UX-DR18). Not gameplay, so it handles
 * its own Esc (InputController lives in GameScene). Never saves; GameScene starts autosave.
 */
export class TitleScene extends Phaser.Scene {
  private saved: GameState | null = null;
  private modals!: ModalController<TitleModal>;

  constructor() {
    super('TitleScene');
  }

  create(data?: TitleSceneData): void {
    const unsaved = data?.unsaved;
    // Phaser reuses start data when a later start passes none, so consume it (as GameScene does).
    if (data !== undefined) delete data.unsaved;
    if (unsaved !== undefined) {
      // Main Menu could not save (storage blocked or full): Continue resumes the live game.
      this.saved = stateCanRun(unsaved) ? unsaved : null;
    } else {
      const loaded = loadSave();
      this.saved = loaded !== null && stateCanRun(loaded) ? loaded : null;
      if (loaded !== null && this.saved === null) discardSave();
    }

    // Placeholder ground until the era backgrounds arrive in Epic 3, as in GameScene.
    this.cameras.main.setBackgroundColor(COLORS.pasture);
    this.modals = new ModalController<TitleModal>(this, COMPONENTS.menuScrimStart, SCRIM_DEPTH);

    const items: MenuItem[] = [];
    if (this.saved !== null) items.push({ label: STRINGS.continue, onActivate: this.continueGame });
    items.push({ label: STRINGS.newGame, onActivate: this.newGame });
    items.push({ label: STRINGS.credits, onActivate: () => this.modals.open('credits') });
    const title = new MenuPanel(this, PANEL_DEPTH, {
      header: STRINGS.gameTitle,
      headerType: 'display',
      padding: TITLE_PAD,
      headerGap: TITLE_GAP,
      width: TITLE_W,
      items,
    });
    const credits = new PlaceholderPanel(this, PANEL_DEPTH, () => this.modals.back()).setHeader(STRINGS.credits);
    const confirm = new ConfirmPanel(
      this,
      PANEL_DEPTH,
      () => this.modals.back(),
      () => {
        // Settings are kept (UX-DR89). Nothing autosaves on the title, so nothing can write it back.
        wipeSave();
        this.startGame({});
      },
    );
    this.modals.add('title', title).add('credits', credits).add('confirm', confirm);
    this.modals.show('title');

    new TitleFlock(this, { x: title.x, y: title.y, width: title.width, height: title.height });

    this.input.keyboard?.on('keydown-ESC', this.onEsc, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.keyboard?.off('keydown-ESC', this.onEsc, this);
      this.tweens.killAll();
      this.saved = null;
    });
  }

  private readonly continueGame = (): void => {
    if (this.saved !== null) this.startGame({ state: this.saved });
  };

  private readonly newGame = (): void => {
    if (this.saved !== null) this.modals.open('confirm');
    else this.startGame({});
  };

  // The confirm or credits go back to the title panel; on the title panel itself Esc does nothing.
  // Ignores key repeat, and an event Phaser's keyboard queue dispatches twice (see InputController).
  private lastEsc: KeyboardEvent | null = null;
  private readonly onEsc = guarded((event: KeyboardEvent): void => {
    if (event === this.lastEsc || event.repeat) return;
    this.lastEsc = event;
    this.modals.back();
  });

  /** Starts the game; `scene.start` shuts this scene down. Empty data means a new game. */
  private startGame(data: GameSceneData): void {
    this.scene.start('GameScene', data);
  }
}
