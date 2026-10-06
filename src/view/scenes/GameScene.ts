import Phaser from 'phaser';
import { COLORS } from '../../config/constants';
import { FixedStepClock } from '../../core/fixedStep';
import { log } from '../../core/log';
import { InputController } from '../../input/InputController';
import { applyCommand, type Command } from '../../sim/commands';
import { clearEvents, drainEvents, type SimEvent } from '../../sim/events';
import { fenceBounds, selectPublicSheep, type PublicSheep } from '../../sim/selectors';
import { createNewGame, type GameState } from '../../sim/state';
import { step } from '../../sim/step';
import { bus } from '../bus';
import { EntityLayer } from '../field/EntityLayer';
import { Fence } from '../field/Fence';
import { ObjectPool } from '../field/ObjectPool';
import { SheepHover } from '../field/SheepHover';
import { SheepSprite } from '../field/SheepSprite';
import { markGameStarted, reportError } from '../safetyNet';
import { Tooltip } from '../widgets/Tooltip';

const SHEEP_POOL_SIZE = 120;
// Above every sheep (sheep depth = y ≤ 720). Sheep hover stays in this scene; HudScene draws above
// it, and sheep never reach the bar, so the two tooltips never overlap.
const TOOLTIP_DEPTH = 10_000;

/** Optional scene data: a state to resume instead of a new game (debug load now, Story 1.9 later). */
export interface GameSceneData {
  state?: GameState;
}

// Owns the sim loop: accumulates real frame time into fixed ticks, applies pending commands at the
// start of each tick, steps the sim, forwards its events, then renders the field from selectors.
// Pause (Stories 1.9/1.10) = stop advancing the clock, never scene.pause().
export class GameScene extends Phaser.Scene {
  private state!: GameState;
  private clock!: FixedStepClock;
  private pendingCommands: Command[] = [];
  private readonly publicSheep: PublicSheep[] = [];
  private sheepLayer!: EntityLayer<PublicSheep, SheepSprite>;
  private sheepHover!: SheepHover;
  // Bound once so the per-tick drain allocates no closure.
  private readonly forwardEvent = (e: SimEvent): void => {
    bus.emit('sim', e);
  };

  constructor() {
    super('GameScene');
  }

  create(data?: GameSceneData): void {
    markGameStarted();
    // Clear first, so events emitted while a game is built or loaded reach the first drain.
    clearEvents();
    // Math.random is fine in view code; Story 1.9 swaps this for load-or-new.
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
    this.sheepLayer = new EntityLayer(new ObjectPool(() => new SheepSprite(this), SHEEP_POOL_SIZE));
    this.sheepHover = new SheepHover(this.input, this.sheepLayer, new Tooltip(this, TOOLTIP_DEPTH));
    const input = new InputController(this.input.keyboard);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => input.destroy());
    this.render();
    // Runs in parallel, drawn above. `launch` restarts a running HudScene, so every GameScene restart
    // rebuilds the HUD fresh.
    this.scene.launch('HudScene');
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

  update(): void {
    // A throw inside a Phaser frame would stop the game loop for good, so sim and render errors are
    // caught here and reported; the frame finishes and the game keeps running.
    try {
      // rawDelta, not the smoothed `delta` argument: Phaser caps the smoothed delta at 1/60 s for
      // 120 frames after start or refocus and while unfocused, which would slow the sim on 30 Hz
      // displays. The clock does its own 250 ms clamp. rawDelta is only the real frame time while no
      // `fps.limit` is set in the game config (with a limit, update runs once per several rAFs but
      // rawDelta holds just the last one); do not add an FPS limit without revisiting this.
      const ticks = this.clock.advance(this.game.loop.rawDelta);
      for (let t = 0; t < ticks; t++) this.tick();
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
   * First runs a copy of the state through the selectors and one tick: a state that would throw in
   * create() would leave Phaser's restart queue stuck for good. Returns false (game unchanged) if
   * the copy throws. Story 1.9 replaces this probe with real save validation.
   */
  loadState(state: GameState): boolean {
    try {
      const probe = JSON.parse(JSON.stringify(state)) as GameState;
      selectPublicSheep(probe, []);
      fenceBounds(probe);
      step(probe);
      selectPublicSheep(probe, []);
    } catch (err) {
      log.warn('save', 'State cannot run; keeping the current game', err);
      return false;
    } finally {
      // The probe tick's events are not the current game's. The queue is empty between frames.
      clearEvents();
    }
    const data: GameSceneData = { state };
    this.scene.restart(data);
    return true;
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
    selectPublicSheep(this.state, this.publicSheep);
    this.sheepLayer.sync(this.publicSheep, this.clock.alpha, this.state.time);
  }
}
