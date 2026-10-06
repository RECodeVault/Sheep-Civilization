import Phaser from 'phaser';
import { COLORS } from '../../config/constants';
import { FixedStepClock } from '../../core/fixedStep';
import { log } from '../../core/log';
import { InputController } from '../../input/InputController';
import { allowSaving, startAutosave, wipeSave, writeSave } from '../../save/saveStore';
import { applyCommand, type Command } from '../../sim/commands';
import { clearEvents, drainEvents, type SimEvent } from '../../sim/events';
import {
  fenceBounds,
  isLost,
  selectFoodPieces,
  selectLoseView,
  selectPublicSheep,
  type PublicSheep,
} from '../../sim/selectors';
import { createNewGame, type FoodPiece, type GameState } from '../../sim/state';
import { step } from '../../sim/step';
import { ATLAS, FRAME } from '../assetKeys';
import { bus } from '../bus';
import { EntityLayer } from '../field/EntityLayer';
import { Fence } from '../field/Fence';
import { FoodSprite } from '../field/FoodSprite';
import { ObjectPool } from '../field/ObjectPool';
import { SheepHover } from '../field/SheepHover';
import { SheepSprite } from '../field/SheepSprite';
import { markGameStarted, reportError, setForceSave } from '../safetyNet';
import { Tooltip } from '../widgets/Tooltip';

const SHEEP_POOL_SIZE = 120;
// Architecture N3: pre-sized, grows on demand (pieces never spoil, so the count is unbounded).
const FOOD_POOL_SIZE = 60;
// UX-DR78 munch crumbs: a short hay burst where a piece was eaten. Visual only (Math.random inside
// the emitter is fine); the munch SFX arrives with AudioDirector in Story 5.6.
const MUNCH_CRUMBS = 6;
const MUNCH = {
  lifespan: 400,
  speed: { min: 30, max: 70 },
  angle: { min: 200, max: 340 },
  gravityY: 220,
  scale: 2,
  alpha: { start: 1, end: 0 },
} as const;
// Above every sheep (sheep depth = y ≤ 720). Sheep hover stays in this scene; HudScene draws above
// it, and sheep never reach the bar, so the two tooltips never overlap.
const TOOLTIP_DEPTH = 10_000;

/** Optional scene data: a state to resume instead of a new game (a loaded save, or debug Load save). */
export interface GameSceneData {
  state?: GameState;
}

// Owns the sim loop: accumulates real frame time into fixed ticks, applies pending commands at the
// start of each tick, steps the sim, forwards its events, then renders the field from selectors.
// Pause (hidden tab here, Esc in Story 1.10) = stop advancing the clock, never scene.pause().
// GameScene never reads storage: the save is loaded before it starts (PreloadScene, TitleScene in
// 1.10), so a plain restart can never resurrect a wiped save.
export class GameScene extends Phaser.Scene {
  private state!: GameState;
  private clock!: FixedStepClock;
  // FR41/AR25: true while the tab is hidden; the clock does not advance. Its own flag, so 1.10's Esc
  // pause can sit beside it (and the debug pause, simClock.speed = 0, stays separate).
  private hidden = false;
  // The first frame after the tab returns adds no time (no catch-up burst).
  private skipDelta = false;
  private stopAutosave: () => void = () => {};
  private pendingCommands: Command[] = [];
  private readonly publicSheep: PublicSheep[] = [];
  private sheepLayer!: EntityLayer<PublicSheep, SheepSprite>;
  private sheepHover!: SheepHover;
  private foodLayer!: EntityLayer<FoodPiece, FoodSprite>;
  private munch!: Phaser.GameObjects.Particles.ParticleEmitter;
  // Bound once so the per-tick drain allocates no closure.
  private readonly forwardEvent = (e: SimEvent): void => {
    bus.emit('sim', e);
  };
  // Field juice for sim events. Runs inside the tick's drain: a view error must not count as a sim
  // error or drop the frame's remaining ticks.
  private readonly onSim = (e: SimEvent): void => {
    if (e.type !== 'FoodEaten') return;
    try {
      this.munch.explode(MUNCH_CRUMBS, e.x, e.y);
    } catch (err) {
      reportError('ui', err);
    }
  };

  constructor() {
    super('GameScene');
  }

  create(data?: GameSceneData): void {
    markGameStarted();
    // Clear first, so events emitted while a game is built or loaded reach the first drain.
    clearEvents();
    // Math.random is fine in view code. A resumed save restores its own rng state.
    this.state = data?.state ?? createNewGame(Math.floor(Math.random() * 2 ** 32));
    // Phaser keeps restart data in settings.data and reuses it when a later restart passes none, so
    // consume it: a plain restart must start a new game, not resume this (by then mutated) state.
    if (data !== undefined) delete data.state;
    this.clock = new FixedStepClock();
    this.pendingCommands = [];
    this.publicSheep.length = 0;

    // Placeholder ground until the era backgrounds arrive in Epic 3 (`pasture` is an art tone).
    this.cameras.main.setBackgroundColor(COLORS.pasture);
    new Fence(this, fenceBounds(this.state));
    this.foodLayer = new EntityLayer(new ObjectPool(() => new FoodSprite(this), FOOD_POOL_SIZE));
    this.sheepLayer = new EntityLayer(new ObjectPool(() => new SheepSprite(this), SHEEP_POOL_SIZE));
    // One emitter for every munch; above the sheep, below the tooltip.
    this.munch = this.add
      .particles(0, 0, ATLAS.sheepWorld, { frame: FRAME.munchCrumb, emitting: false, ...MUNCH })
      .setDepth(TOOLTIP_DEPTH - 1);
    this.sheepHover = new SheepHover(this.input, this.sheepLayer, new Tooltip(this, TOOLTIP_DEPTH));
    const input = new InputController(this.input);
    bus.on('sim', this.onSim, this);
    // Saving (FR40): every 10 s and on hide (saveStore), and before the error toast (safety net).
    // A new or loaded game lifts any block left by a sim error in the previous one.
    allowSaving();
    this.stopAutosave = startAutosave(() => this.state);
    setForceSave(() => writeSave(this.state));
    // Hidden-tab pause (AR25). Phaser also pauses its loop and resets its delta on hide/show, and the
    // clock clamps long frames, but the rule is ours: no tick while hidden, nothing added on return.
    // game.events outlives this scene, so both handlers are removed on SHUTDOWN.
    this.hidden = document.hidden;
    this.skipDelta = false;
    this.game.events.on(Phaser.Core.Events.HIDDEN, this.onHidden, this);
    this.game.events.on(Phaser.Core.Events.VISIBLE, this.onVisible, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      input.destroy();
      bus.off('sim', this.onSim, this);
      this.stopAutosave();
      setForceSave(null);
      this.game.events.off(Phaser.Core.Events.HIDDEN, this.onHidden, this);
      this.game.events.off(Phaser.Core.Events.VISIBLE, this.onVisible, this);
    });
    this.render();
    // Run in parallel, drawn above (Overlay on top). `launch` restarts a running scene, so every
    // GameScene restart rebuilds the HUD and the overlay fresh.
    this.scene.launch('HudScene');
    this.scene.launch('OverlayScene');
  }

  // --- Scene API -------------------------------------------------------------------------------
  // For HudScene (every frame) and src/debug/DebugOverlay.ts.

  /**
   * The live state. Read-only for every caller except debugMutate. The object is replaced on
   * restart, so read it each frame; never cache it.
   */
  get simState(): Readonly<GameState> {
    return this.state;
  }

  /** Queues a player command; it is applied at the start of the next tick. */
  dispatch(cmd: Command): void {
    this.pendingCommands.push(cmd);
  }

  /**
   * Starts a fresh game by restarting the scene (pools, fence, clock, HUD and overlay all rebuild).
   * Lose → Restart calls it with no confirm. Phaser queues the restart, so input handlers may call it.
   */
  newGame(): void {
    // Stop first: an autosave or forced save between the wipe and the queued restart would write the
    // old game back.
    this.stopAutosave();
    setForceSave(null);
    // Lose → Restart wipes without confirm; settings are kept (UX-DR89).
    wipeSave();
    // create() consumed any earlier data.state, so empty data means createNewGame.
    this.scene.restart({});
  }

  update(): void {
    // A throw inside a Phaser frame would stop the game loop for good, so sim and render errors are
    // caught here and reported; the frame finishes and the game keeps running.
    try {
      // rawDelta, not the smoothed `delta` argument: Phaser caps the smoothed delta at 1/60 s for
      // 120 frames after start or refocus and while unfocused, which would slow the sim on 30 Hz
      // displays. The clock does its own 250 ms clamp. rawDelta is only the real frame time while no
      // `fps.limit` is set in the game config (with a limit, update runs once per several rAFs but
      // rawDelta holds just the last one); do not add an FPS limit without revisiting this.
      if (isLost(this.state)) {
        // FR38: the sim has stopped; the field stays drawn, frozen behind the lose screen. Presses
        // that queued before the loss are dropped (applyCommand would ignore them anyway).
        this.pendingCommands.length = 0;
      } else if (!this.hidden) {
        // FR41: nothing advances while the tab is hidden; the first frame back adds no time.
        const ticks = this.clock.advance(this.skipDelta ? 0 : this.game.loop.rawDelta);
        this.skipDelta = false;
        for (let t = 0; t < ticks; t++) this.tick();
      }
      this.render();
      this.sheepHover.update(this.publicSheep, this.game.loop.time);
    } catch (err) {
      // The remaining ticks of this frame are dropped, so a bad state throws once per frame at most.
      reportError('sim', err);
    }
  }

  // --- Debug API -------------------------------------------------------------------------------
  // Called only by src/debug/DebugOverlay.ts (DEV builds). Production ships these members, but
  // nothing calls them. GameScene never imports src/debug/.

  /** The sim clock. Debug pause is `simClock.speed = 0`. */
  get simClock(): FixedStepClock {
    return this.clock;
  }

  /** Runs exactly one tick and renders it (debug step while paused). */
  stepOnce(): void {
    try {
      this.tick();
      this.render();
    } catch (err) {
      reportError('sim', err);
    }
  }

  /**
   * The only sanctioned view-side mutation of GameState, for src/debug/ only. It runs from DOM
   * handlers, which run between animation frames, so it never lands mid-tick.
   */
  debugMutate(fn: (state: GameState) => void): void {
    fn(this.state);
    this.render();
  }

  /**
   * Replaces the game by restarting the scene, so every pooled sprite, the fence and the clock reset.
   * Returns false (game unchanged) if the state cannot run (see stateCanRun).
   */
  loadState(state: GameState): boolean {
    if (!stateCanRun(state)) return false;
    // As in newGame: the old game must not be saved over the loaded one before the restart runs.
    this.stopAutosave();
    setForceSave(null);
    const data: GameSceneData = { state };
    this.scene.restart(data);
    return true;
  }

  private onHidden(): void {
    this.hidden = true;
  }

  private onVisible(): void {
    this.hidden = false;
    this.clock.reset();
    this.skipDelta = true;
  }

  private tick(): void {
    const cmds = this.pendingCommands;
    try {
      for (let i = 0; i < cmds.length; i++) applyCommand(this.state, cmds[i]);
    } finally {
      // Always emptied: a command that throws drops itself and the rest of its batch, instead of
      // re-applying the commands before it and throwing again on every frame.
      cmds.length = 0;
    }
    step(this.state);
    drainEvents(this.forwardEvent);
  }

  private render(): void {
    this.foodLayer.sync(selectFoodPieces(this.state), this.clock.alpha, this.state.time);
    selectPublicSheep(this.state, this.publicSheep);
    this.sheepLayer.sync(this.publicSheep, this.clock.alpha, this.state.time);
  }
}

/**
 * Runs a copy of the state through the selectors and one tick. A state that would throw in
 * GameScene.create would leave Phaser's restart queue stuck for good, so a state is probed before a
 * scene starts on it. Save validation runs first; this catches anything it does not know about.
 */
export function stateCanRun(state: GameState): boolean {
  try {
    const probe = JSON.parse(JSON.stringify(state)) as GameState;
    selectPublicSheep(probe, []);
    fenceBounds(probe);
    step(probe);
    selectPublicSheep(probe, []);
    // A lost state skips step(), and OverlayScene.create reads it through this.
    selectLoseView(probe, { survivedMs: 0, peakFlock: 0 });
    return true;
  } catch (err) {
    log.warn('save', 'State cannot run; not starting it', err);
    return false;
  } finally {
    // The probe tick's events are not the current game's. The queue is empty between frames.
    clearEvents();
  }
}
