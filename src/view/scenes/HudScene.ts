import Phaser from 'phaser';
import type { Command } from '../../sim/commands';
import type { DeathCause, SimEvent } from '../../sim/events';
import { COMPONENTS, LAYOUT } from '../../config/constants';
import { selectHudView, type HudView } from '../../sim/selectors';
import { bus } from '../bus';
import { BottomBar } from '../hud/BottomBar';
import { FloatPopups } from '../juice/FloatPopups';
import { reportError, showToast } from '../safetyNet';
import { STRINGS } from '../strings';
import { Button } from '../widgets/Button';
import { HOVER_DELAY_MS, Tooltip } from '../widgets/Tooltip';
import type { TooltipSource } from '../widgets/tooltipSource';
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
  private tooltipFor: TooltipSource | null = null;
  // The text the tooltip shows for tooltipFor: a button's tooltip can change while shown (Breed's reason).
  private tooltipText: string | undefined = undefined;
  // Whether a modal was up last frame, to clear stale button hover once when one opens.
  private wasModal = false;
  private wasDragging = false;
  private readonly view: HudView = {
    farmProgress: 0,
    farmPipsPerFood: 0,
    breedingProgress: 0,
    breedingPipsPerFood: 0,
    breedBlock: 'notReady',
    boostRemainingMs: 0,
    threats: { starving: 0, infected: 0, carcasses: 0 },
  };
  // Deaths since the last frame, by cause: one toast per cause per frame (UX-DR41/UX-DR92), so a wipe
  // of many sheep on one tick reads "5 sheep starved." instead of overflowing the 3-toast stack.
  private readonly deaths: Record<DeathCause, number> = { starved: 0, oldAge: 0, virus: 0, abomination: 0 };
  // The buttons that can show a tooltip; built once, so hoveredButton allocates nothing per frame.
  private tooltipButtons: readonly Button[] = [];
  // Everything the one tooltip serves: the buttons, then the threat summary's counts (UX-DR39).
  private tooltipSources: readonly TooltipSource[] = [];

  constructor() {
    super('HudScene');
  }

  create(): void {
    this.gameScene = this.scene.get('GameScene') as GameScene;
    this.tooltipFor = null;
    this.tooltipText = undefined;
    this.wasModal = false;
    this.wasDragging = false;
    for (const k in this.deaths) this.deaths[k as DeathCause] = 0;
    this.bar = new BottomBar(this, this.farm, this.farmBreeding, this.breedTool);
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
    this.tooltipButtons = [this.pauseButton, this.bar.farmButton, this.bar.breedFoodButton, this.bar.breedButton];
    this.tooltipSources = [...this.tooltipButtons, ...this.bar.threats.sources];
    this.popups = new FloatPopups(this, POPUP_DEPTH);
    this.tooltip = new Tooltip(this, TOOLTIP_DEPTH);

    bus.on('sim', this.onSim, this);
    bus.on('farm:pressed', this.farm, this);
    bus.on('farmBreeding:pressed', this.farmBreeding, this);
    bus.on('breedMode:changed', this.onBreedMode, this);
    this.input.on(Phaser.Input.Events.POINTER_DOWN, this.onPointerDown, this);
    // Phaser updates scenes in REVERSE array order (SceneManager.update), so HudScene's update()
    // would run before GameScene ticks and show last frame's food. PRE_RENDER fires after every
    // scene has updated, so the meter shows a change on the frame it happens (UX-DR29).
    this.events.on(Phaser.Scenes.Events.PRE_RENDER, this.refresh, this);
    // Scene events persist across restarts, so this one is removed explicitly too.
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      bus.off('sim', this.onSim, this);
      bus.off('farm:pressed', this.farm, this);
      bus.off('farmBreeding:pressed', this.farmBreeding, this);
      bus.off('breedMode:changed', this.onBreedMode, this);
      this.input.off(Phaser.Input.Events.POINTER_DOWN, this.onPointerDown, this);
      this.events.off(Phaser.Scenes.Events.PRE_RENDER, this.refresh, this);
    });
  }

  private readonly refresh = (): void => {
    try {
      this.flushDeathToasts();
      const state = this.gameScene.simState;
      const v = selectHudView(state, this.view);
      this.bar.farmProgress.set(v.farmProgress, v.farmPipsPerFood);
      this.bar.breedingProgress.set(v.breedingProgress, v.breedingPipsPerFood);
      // FR11 / UX-DR31: greyed with the reason as its tooltip. Both calls are no-ops without a change.
      const breed = this.bar.breedButton;
      breed.setEnabled(v.breedBlock === null);
      breed.setTooltip(
        v.breedBlock === 'capacity' ? STRINGS.breedNoRoom : v.breedBlock === 'notReady' ? STRINGS.breedNotReady : STRINGS.breedTooltip,
      );
      // UX-DR39: live counts, redrawn only on a change.
      this.bar.threats.set(v.threats);
      // FR19 / UX-DR27 / UX-DR38: the boosted Farm look and the countdown, both no-ops without a change.
      this.bar.farmBoost.setBoosted(v.boostRemainingMs > 0);
      this.bar.boostTimer.set(v.boostRemainingMs);
      const modal = this.gameScene.modalOpen;
      // The boost's time stops under a modal, so its glow stops pulsing too.
      this.bar.farmBoost.setFrozen(modal);
      if (modal && !this.wasModal) for (const b of this.tooltipSources) b.clearHover();
      this.wasModal = modal;
      // A sheep dragged across the bar lights no button and pops no tooltip: the HUD's input is off for
      // the drag (presses cannot happen then anyway). Hover returns once the pointer next enters.
      const dragging = this.gameScene.dragging;
      if (dragging !== this.wasDragging) {
        this.wasDragging = dragging;
        this.input.enabled = !dragging;
        if (dragging) for (const b of this.tooltipSources) b.clearHover();
      }
      this.updateTooltip(this.game.loop.time, modal || dragging);
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
      // Never greyed today, but the key must not do what a greyed button would refuse.
      if (!b.isEnabled) return;
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
      if (!b.isEnabled) return;
      b.squash();
      b.suppressTooltip();
      this.gameScene.dispatch(FARM_BREEDING);
    } catch (err) {
      reportError('ui', err);
    }
  };

  /**
   * The Breed tool (UX-DR31): InputController owns breed mode, so the click only asks it to toggle.
   * Button refuses presses while greyed. Guarded like farm.
   */
  private readonly breedTool = (): void => {
    try {
      if (this.gameScene.modalOpen) return;
      this.bar.breedButton.suppressTooltip();
      bus.emit('breedTool:pressed', undefined);
    } catch (err) {
      reportError('ui', err);
    }
  };

  /**
   * A right press on one of this scene's controls never reaches GameScene (top-only input), so it is
   * passed on for the right-click that cancels breed mode. Presses off the controls reach it directly.
   */
  private readonly onPointerDown = (pointer: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]): void => {
    try {
      if (pointer.rightButtonDown() && over.length > 0) bus.emit('hud:rightPressed', undefined);
    } catch (err) {
      reportError('ui', err);
    }
  };

  /** The hovered HUD button, or null (GameScene restores its cursor after a breed-mode change). */
  get hoveredButton(): Button | null {
    const buttons = this.tooltipButtons;
    for (let i = 0; i < buttons.length; i++) if (buttons[i].isHovered) return buttons[i];
    return null;
  }

  /** The tool's active look follows breed mode (heart-deep fill, wool label). */
  private readonly onBreedMode = (e: { active: boolean }): void => {
    this.bar.breedButton.setToggled(e.active);
  };

  /**
   * True while the pointer is on a HUD control (a button or a threat count). The field camera can pan
   * the pen under the Pause button, so GameScene's sheep hover (which reads the raw pointer) skips
   * while this is true.
   */
  get pointerOverControl(): boolean {
    const sources = this.tooltipSources;
    for (let i = 0; i < sources.length; i++) if (sources[i].isHovered) return true;
    return false;
  }

  /** True when canvas point (x, y) is on a HUD control's box (a button or a threat count). No allocation. */
  controlAt(x: number, y: number): boolean {
    const sources = this.tooltipSources;
    for (let i = 0; i < sources.length; i++) {
      const s = sources[i];
      if (x >= s.x && x < s.x + s.width && y >= s.y && y < s.y + s.height) return true;
    }
    return false;
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
      } else if (e.type === 'SheepDied') {
        // Counted here, toasted once per frame in refresh (flushDeathToasts).
        this.deaths[e.cause]++;
      } else if (e.type === 'Sacrificed') {
        // UX-DR93: one at a time (a sheep is dragged in by hand). Never branches on wasAbomination: the
        // reveal is Story 4.4's.
        showToast(STRINGS.sacrificeToast, { announcement: true });
      } else if (e.type === 'BoostStarted') {
        // UX-DR38 / UX-DR44: the timer pops (on a start and a reset alike) and "×2" rises over Farm. The
        // glow and the timer's text follow in this frame's refresh.
        this.bar.boostTimer.pop();
        const b = this.bar.farmButton;
        this.popups.spawn(b.x + b.width / 2, b.y - POPUP_LIFT_PX, STRINGS.boostPopup);
      }
    } catch (err) {
      reportError('ui', err);
    }
  };

  /** One announcement per cause for the frame's deaths, in the deaths map's order. */
  private flushDeathToasts(): void {
    const d = this.deaths;
    for (const k in d) {
      const cause = k as DeathCause;
      const n = d[cause];
      if (n === 0) continue;
      d[cause] = 0;
      showToast(STRINGS.deathToast(cause, n), { announcement: true });
    }
  }

  private updateTooltip(now: number, modalOpen: boolean): void {
    // At most one source is hovered, so one tooltip serves them all.
    const sources = this.tooltipSources;
    let hovered = sources[0];
    for (let i = 1; i < sources.length && hovered.hoverSince < 0; i++) hovered = sources[i];
    const b = hovered;
    const since = b.hoverSince;
    // Under a modal the scrim takes the pointer, so the source never sees pointer-out: a hover that
    // began before Esc or the loss would otherwise pop its tooltip under the scrim.
    const show = !modalOpen && b.tooltip !== undefined && since >= 0 && now - since >= HOVER_DELAY_MS;
    if (!show) {
      if (this.tooltipFor !== null) {
        this.tooltip.hide();
        this.tooltipFor = null;
        this.tooltipText = undefined;
      }
      return;
    }
    if (this.tooltipFor === b && this.tooltipText === b.tooltip) return;
    this.tooltipFor = b;
    this.tooltipText = b.tooltip;
    this.tooltip.setText(b.tooltip);
    this.tooltip.showAt(b.x + b.width / 2, b.y, b.y + b.height);
  }
}
