import Phaser from 'phaser';
import type { Command } from '../../sim/commands';
import type { SimEvent } from '../../sim/events';
import { selectHudView, type HudView } from '../../sim/selectors';
import { bus } from '../bus';
import { BottomBar } from '../hud/BottomBar';
import { FloatPopups } from '../juice/FloatPopups';
import { reportError } from '../safetyNet';
import { STRINGS } from '../strings';
import type { Button } from '../widgets/Button';
import { HOVER_DELAY_MS, Tooltip } from '../widgets/Tooltip';
import type { GameScene } from './GameScene';

// Within this scene: popups over the bar, the tooltip over everything.
const POPUP_DEPTH = 100;
const TOOLTIP_DEPTH = 200;
// Popups start just above the Farm button's top edge.
const POPUP_LIFT_PX = 4;
const FARM: Command = Object.freeze({ type: 'Farm' });

/**
 * The bottom bar, launched by GameScene in parallel and drawn above it. Reads the sim once per frame
 * through `selectHudView`, sends commands through `GameScene.dispatch`, and never steps the sim.
 * GameScene relaunches it on every restart, so every listener is removed on SHUTDOWN.
 */
export class HudScene extends Phaser.Scene {
  private gameScene!: GameScene;
  private bar!: BottomBar;
  private popups!: FloatPopups;
  private tooltip!: Tooltip;
  private tooltipFor: Button | null = null;
  private readonly view: HudView = { food: 0, foodCap: 0 };

  constructor() {
    super('HudScene');
  }

  create(): void {
    this.gameScene = this.scene.get('GameScene') as GameScene;
    this.tooltipFor = null;
    this.bar = new BottomBar(this, this.farm);
    this.popups = new FloatPopups(this, POPUP_DEPTH);
    this.tooltip = new Tooltip(this, TOOLTIP_DEPTH);

    bus.on('sim', this.onSim, this);
    bus.on('farm:pressed', this.farm, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      bus.off('sim', this.onSim, this);
      bus.off('farm:pressed', this.farm, this);
    });
  }

  update(): void {
    try {
      // GameScene updates first (scene order), so this frame's ticks are already applied.
      const v = selectHudView(this.gameScene.simState, this.view);
      this.bar.foodMeter.set(v.food, v.foodCap);
      this.updateTooltip(this.game.loop.time);
    } catch (err) {
      reportError('ui', err);
    }
  }

  /** The one Farm action, for a click and the F key alike. The sim decides what it yields. */
  private readonly farm = (): void => {
    this.bar.farmButton.squash();
    this.gameScene.dispatch(FARM);
  };

  private readonly onSim = (e: SimEvent): void => {
    if (e.type !== 'Farmed' || e.resource !== 'food') return;
    const b = this.bar.farmButton;
    if (e.added > 0) this.popups.spawn(b.x + b.width / 2, b.y - POPUP_LIFT_PX, STRINGS.farmPopup(e.added));
    else this.bar.foodMeter.bump();
  };

  private updateTooltip(now: number): void {
    const b = this.bar.farmButton;
    const since = b.hoverSince;
    const show = b.tooltip !== undefined && since >= 0 && now - since >= HOVER_DELAY_MS;
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
