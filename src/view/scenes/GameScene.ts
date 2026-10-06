import Phaser from 'phaser';
import { COLORS } from '../../config/constants';
import { FixedStepClock } from '../../core/fixedStep';
import { applyCommand, type Command } from '../../sim/commands';
import { clearEvents, drainEvents, type SimEvent } from '../../sim/events';
import { fenceBounds, selectPublicSheep, type PublicSheep } from '../../sim/selectors';
import { createNewGame, type GameState } from '../../sim/state';
import { step } from '../../sim/step';
import { bus } from '../bus';
import { EntityLayer } from '../field/EntityLayer';
import { Fence } from '../field/Fence';
import { ObjectPool } from '../field/ObjectPool';
import { SheepSprite } from '../field/SheepSprite';
import { reportError } from '../safetyNet';

const SHEEP_POOL_SIZE = 120;

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
  // Bound once so the per-tick drain allocates no closure.
  private readonly forwardEvent = (e: SimEvent): void => {
    bus.emit('sim', e);
  };

  constructor() {
    super('GameScene');
  }

  create(data?: GameSceneData): void {
    // Clear first, so events emitted while a game is built or loaded reach the first drain.
    clearEvents();
    // Math.random is fine in view code; Story 1.9 swaps this for load-or-new.
    this.state = data?.state ?? createNewGame(Math.floor(Math.random() * 2 ** 32));
    this.clock = new FixedStepClock();
    this.pendingCommands = [];
    this.publicSheep.length = 0;

    // Placeholder ground until the era backgrounds arrive in Epic 3 (`pasture` is an art tone).
    this.cameras.main.setBackgroundColor(COLORS.pasture);
    new Fence(this, fenceBounds(this.state));
    this.sheepLayer = new EntityLayer(new ObjectPool(() => new SheepSprite(this), SHEEP_POOL_SIZE));
    this.render();
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
    } catch (err) {
      // The remaining ticks of this frame are dropped, so a bad state throws once per frame at most.
      reportError('sim', err);
    }
  }

  // --- Debug API -------------------------------------------------------------------------------
  // Called only by src/debug/DebugOverlay.ts (DEV builds). Production ships these members, but
  // nothing calls them. GameScene never imports src/debug/.

  /** The live state, for debug counts and dumps. Read-only for every caller except debugMutate. */
  get simState(): Readonly<GameState> {
    return this.state;
  }

  /** The sim clock. Debug pause is `simClock.speed = 0`. */
  get simClock(): FixedStepClock {
    return this.clock;
  }

  /** Runs exactly one tick and renders it (debug step while paused). */
  stepOnce(): void {
    this.tick();
    this.render();
  }

  /**
   * The only sanctioned view-side mutation of GameState, for src/debug/ only. It runs from DOM
   * handlers, which run between animation frames, so it never lands mid-tick.
   */
  debugMutate(fn: (state: GameState) => void): void {
    fn(this.state);
    this.render();
  }

  /** Replaces the game by restarting the scene, so every pooled sprite, the fence and the clock reset. */
  loadState(state: GameState): void {
    const data: GameSceneData = { state };
    this.scene.restart(data);
  }

  private tick(): void {
    const cmds = this.pendingCommands;
    for (let i = 0; i < cmds.length; i++) applyCommand(this.state, cmds[i]);
    cmds.length = 0;
    step(this.state);
    drainEvents(this.forwardEvent);
  }

  private render(): void {
    selectPublicSheep(this.state, this.publicSheep);
    this.sheepLayer.sync(this.publicSheep, this.clock.alpha, this.state.time);
  }
}
