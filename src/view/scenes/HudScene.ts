import Phaser from 'phaser';
import type { Command } from '../../sim/commands';
import type { SimEvent } from '../../sim/events';
import { COMPONENTS, LAYOUT } from '../../config/constants';
import { selectHudView, type HudView } from '../../sim/selectors';
import { bus } from '../bus';
import { BottomBar } from '../hud/BottomBar';
import { FloatPopups } from '../juice/FloatPopups';
import { reportError } from '../safetyNet';
import { STRINGS } from '../strings';
import { Button } from '../widgets/Button';
import { HOVER_DELAY_MS, Tooltip } from '../widgets/Tooltip';
import type { GameScene } from './GameScene';
import type { OverlayScene } from './OverlayScene';

// Within this scene: popups over the bar, the tooltip over everything.
const POPUP_DEPTH = 100;
const TOOLTIP_DEPTH = 200;
// Popups start just above the Farm button's top edge.
const POPUP_LIFT_PX = 4;
const FARM: Command = Object.freeze({ type: 'Farm' });
const FARM_BREEDING: Command = Object.freeze({ type: 'FarmBreeding' });
// [ASSUMPTION] Added 2026-10-06 (Rylan): the Pause button sits in the top-left corner of the field,
// clear of the toasts (top-centre) and the era badge (top-right). Size from COMPONENTS.buttonPause.
const PAUSE = COMPONENTS.buttonPause;

/**
 * The bottom bar, launched by GameScene in parallel and drawn above it. Reads the sim once per frame
 * (on PRE_RENDER, after the sim has ticked) through `selectHudView`, sends commands through `GameScene.dispatch`, and never steps the sim.
 * GameScene relaunches it on every restart, so every listener is removed on SHUTDOWN.
 */
export class HudScene extends Phaser.Scene {
  private gameScene!: GameScene;
  private bar!: BottomBar;
  private pauseButton!: Button;
  private popups!: FloatPopups;
  private tooltip!: Tooltip;
  private tooltipFor: Button | null = null;
  // Whether a modal was up last frame, to clear stale button hover once when one opens.
  private wasModal = false;
  private readonly view: HudView = { farmProgress: 0, farmPipsPerFood: 0, breedingProgress: 0, breedingPipsPerFood: 0 };
  // The buttons that can show a tooltip; built once, so updateTooltip allocates nothing per frame.
  private tooltipButtons: readonly Button[] = [];

  constructor() {
    super('HudScene');
  }

  create(): void {
    this.gameScene = this.scene.get('GameScene') as GameScene;
    this.tooltipFor = null;
    this.wasModal = false;
    this.bar = new BottomBar(this, this.farm, this.farmBreeding);
    this.pauseButton = new Button(this, PAUSE, {
      x: LAYOUT.safeMargin,
      y: LAYOUT.safeMargin,
      width: PAUSE.width,
      label: STRINGS.pauseLabel,
      tooltip: STRINGS.pauseTooltip,
      labelAlign: 'center',
      activateOn: 'release',
      onActivate: this.pause,
    });
    this.tooltipButtons = [this.pauseButton, this.bar.farmButton, this.bar.breedFoodButton];
    this.popups = new FloatPopups(this, POPUP_DEPTH);
    this.tooltip = new Tooltip(this, TOOLTIP_DEPTH);

    bus.on('sim', this.onSim, this);
    bus.on('farm:pressed', this.farm, this);
    bus.on('farmBreeding:pressed', this.farmBreeding, this);
    // Phaser updates scenes in REVERSE array order (SceneManager.update), so HudScene's update()
    // would run before GameScene ticks and show last frame's food. PRE_RENDER fires after every
    // scene has updated, so the meter shows a change on the frame it happens (UX-DR29).
    this.events.on(Phaser.Scenes.Events.PRE_RENDER, this.refresh, this);
    // Scene events persist across restarts, so this one is removed explicitly too.
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      bus.off('sim', this.onSim, this);
      bus.off('farm:pressed', this.farm, this);
      bus.off('farmBreeding:pressed', this.farmBreeding, this);
      this.events.off(Phaser.Scenes.Events.PRE_RENDER, this.refresh, this);
    });
  }

  private readonly refresh = (): void => {
    try {
      const state = this.gameScene.simState;
      const v = selectHudView(state, this.view);
      this.bar.farmProgress.set(v.farmProgress, v.farmPipsPerFood);
      this.bar.breedingProgress.set(v.breedingProgress, v.breedingPipsPerFood);
      const modal = this.gameScene.modalOpen;
      if (modal && !this.wasModal) {
        this.pauseButton.clearHover();
        this.bar.farmButton.clearHover();
        this.bar.breedFoodButton.clearHover();
      }
      this.wasModal = modal;
      this.updateTooltip(this.game.loop.time, modal);
    } catch (err) {
      reportError('ui', err);
    }
  };

  /**
   * The one Farm action, for a click and the F key alike. The sim decides what it yields. Guarded:
   * it runs inside Phaser's input step, where a throw would stop the game loop.
   */
  private readonly farm = (): void => {
    try {
      // UX-DR20 / FR38: no farming under a modal (pause, confirm, lose; the sim ignores a lost game
      // too). The scrim blocks clicks, so this covers anything else that calls farm. Nothing queues
      // while paused, so nothing bursts on resume.
      if (this.gameScene.modalOpen) return;
      const b = this.bar.farmButton;
      b.squash();
      // A press hides the tooltip, from the key as from the pointer (Task 5.4).
      b.suppressTooltip();
      this.gameScene.dispatch(FARM);
    } catch (err) {
      reportError('ui', err);
    }
  };

  /**
   * The one Farm Breeding Food action, for a click and the G key alike (FR8). Guarded like farm.
   */
  private readonly farmBreeding = (): void => {
    try {
      if (this.gameScene.modalOpen) return;
      const b = this.bar.breedFoodButton;
      b.squash();
      b.suppressTooltip();
      this.gameScene.dispatch(FARM_BREEDING);
    } catch (err) {
      reportError('ui', err);
    }
  };

  /**
   * True while the pointer is on a HUD control. The field camera can pan the pen under the Pause
   * button, so GameScene's sheep hover (which reads the raw pointer) skips while this is true.
   */
  get pointerOverControl(): boolean {
    return this.pauseButton.isHovered || this.bar.farmButton.isHovered || this.bar.breedFoodButton.isHovered;
  }

  /** The top-left Pause button (UX-DR76: pause is mouse-reachable); the same menu as Esc. */
  private readonly pause = (): void => {
    try {
      if (this.gameScene.modalOpen) return;
      this.pauseButton.suppressTooltip();
      // Looked up on each click: OverlayScene is replaced on every GameScene restart.
      (this.scene.get('OverlayScene') as OverlayScene).openPause();
    } catch (err) {
      reportError('ui', err);
    }
  };

  // Runs inside GameScene's tick (drainEvents → bus): a throw must not count as a sim error or drop
  // the frame's remaining ticks.
  private readonly onSim = (e: SimEvent): void => {
    try {
      if (e.type === 'Farmed' && e.resource === 'food' && e.added > 0) {
        // A full bar pops "+N" over the button while its piece bounces into the pen.
        const b = this.bar.farmButton;
        this.popups.spawn(b.x + b.width / 2, b.y - POPUP_LIFT_PX, STRINGS.farmPopup(e.added));
      } else if (e.type === 'Farmed' && e.resource === 'breedingFood' && e.added > 0) {
        // The same for the breeding bar: "+N" when a full bar drops its breeding piece (FR8).
        const b = this.bar.breedFoodButton;
        this.popups.spawn(b.x + b.width / 2, b.y - POPUP_LIFT_PX, STRINGS.farmPopup(e.added));
      }
    } catch (err) {
      reportError('ui', err);
    }
  };

  private updateTooltip(now: number, modalOpen: boolean): void {
    // At most one button is hovered, so one tooltip serves them all.
    const buttons = this.tooltipButtons;
    let hovered = buttons[0];
    for (let i = 1; i < buttons.length && hovered.hoverSince < 0; i++) hovered = buttons[i];
    const b = hovered;
    const since = b.hoverSince;
    // Under a modal the scrim takes the pointer, so the button never sees pointer-out: a hover that
    // began before Esc or the loss would otherwise pop its tooltip under the scrim.
    const show = !modalOpen && b.tooltip !== undefined && since >= 0 && now - since >= HOVER_DELAY_MS;
    if (!show) {
      if (this.tooltipFor !== null) {
        this.tooltip.hide();
        this.tooltipFor = null;
      }
      return;
    }
    if (this.tooltipFor === b) return;
    this.tooltipFor = b;
    this.tooltip.setText(b.tooltip);
    this.tooltip.showAt(b.x + b.width / 2, b.y, b.y + b.height);
  }
}
