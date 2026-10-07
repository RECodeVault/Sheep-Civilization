import Phaser from 'phaser';
import { COLORS } from '../../config/constants';
import { FixedStepClock } from '../../core/fixedStep';
import { log } from '../../core/log';
import { InputController } from '../../input/InputController';
import { allowSaving, isSavingBlocked, startAutosave, wipeSave, writeSave } from '../../save/saveStore';
import { applyCommand, type Command } from '../../sim/commands';
import { clearEvents, drainEvents, type SimEvent } from '../../sim/events';
import {
  breedBlock,
  fenceBounds,
  isLost,
  selectBreedingPieces,
  selectFoodPieces,
  selectLoseView,
  selectPregnancies,
  selectPublicSheep,
  type PublicPregnancy,
  type PublicSheep,
} from '../../sim/selectors';
import { createNewGame, type BreedingPiece, type FoodPiece, type GameState } from '../../sim/state';
import { step } from '../../sim/step';
import { ATLAS, FRAME, HEART_CURSOR } from '../assetKeys';
import { bus } from '../bus';
import { EntityLayer } from '../field/EntityLayer';
import { Fence } from '../field/Fence';
import { FoodSprite } from '../field/FoodSprite';
import { ObjectPool } from '../field/ObjectPool';
import { PenCamera } from '../field/PenCamera';
import { PregnancyHeart } from '../field/PregnancyHeart';
import { SheepHover, sheepIndexAt } from '../field/SheepHover';
import { SheepSprite } from '../field/SheepSprite';
import { markGameStarted, reportError, setForceSave, showToast } from '../safetyNet';
import { STRINGS } from '../strings';
import type { TitleSceneData } from './TitleScene';
import { Tooltip } from '../widgets/Tooltip';
import type { HudScene } from './HudScene';
import type { OverlayScene } from './OverlayScene';

const SHEEP_POOL_SIZE = 120;
// Architecture N3: pre-sized, grows on demand (pieces never spoil, so the count is unbounded).
const FOOD_POOL_SIZE = 60;
// Breeding pieces (FR8) never spoil either.
const BREEDING_POOL_SIZE = 30;
// Pending lambs (FR9): few at once (each pair is on a 60 s cooldown); grows on demand.
const PREGNANCY_POOL_SIZE = 10;
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
// UX-DR82 birth poof: a small wool burst where a lamb arrives. Visual only, like the munch.
const POOF_PUFFS = 8;
const POOF = {
  lifespan: 400,
  speed: { min: 20, max: 60 },
  angle: { min: 0, max: 360 },
  gravityY: -20,
  scale: { start: 2, end: 3 },
  alpha: { start: 1, end: 0 },
} as const;
// Above every sheep (sheep depth = y ≤ 720). Sheep hover stays in this scene; HudScene draws above
// it. The panned pen can slide under the Pause button, so the sheep hover skips while the pointer is
// on a HUD control (pointerOnHudControl) and the two tooltips never show together.
const TOOLTIP_DEPTH = 10_000;

/** Optional scene data: a state to resume instead of a new game (a loaded save, or debug Load save). */
export interface GameSceneData {
  state?: GameState;
}

// Owns the sim loop: accumulates real frame time into fixed ticks, applies pending commands at the
// start of each tick, steps the sim, forwards its events, then renders the field from selectors.
// Pause (hidden tab, or the pause menu) = stop advancing the clock, never scene.pause(): the field
// stays drawn, frozen behind the scrim. GameScene never reads storage: the save is loaded before it
// starts (TitleScene), so a plain restart can never resurrect a wiped save.
export class GameScene extends Phaser.Scene {
  private state!: GameState;
  private clock!: FixedStepClock;
  // FR41/AR25: true while the tab is hidden; the clock does not advance.
  private hidden = false;
  // UX-DR14: true while any in-game modal is up (pause, a sub-panel, the start-over confirm), set by
  // OverlayScene. Either flag stops the clock, and neither touches the other: the tab coming back
  // never closes the pause menu. The debug pause (simClock.speed = 0) stays separate from both.
  private paused = false;
  // The first frame after the tab returns or the menu closes adds no time (no catch-up burst).
  private skipDelta = false;
  private stopAutosave: () => void = () => {};
  private pendingCommands: Command[] = [];
  private readonly publicSheep: PublicSheep[] = [];
  private sheepLayer!: EntityLayer<PublicSheep, SheepSprite>;
  private sheepHover!: SheepHover;
  private inputController!: InputController;
  private penCamera!: PenCamera;
  private foodLayer!: EntityLayer<FoodPiece, FoodSprite>;
  private breedingLayer!: EntityLayer<BreedingPiece, FoodSprite>;
  private pregnancyLayer!: EntityLayer<PublicPregnancy, PregnancyHeart>;
  private readonly publicPregnancies: PublicPregnancy[] = [];
  private munch!: Phaser.GameObjects.Particles.ParticleEmitter;
  private poof!: Phaser.GameObjects.Particles.ParticleEmitter;
  // Bound once so the per-tick drain allocates no closure.
  private readonly forwardEvent = (e: SimEvent): void => {
    bus.emit('sim', e);
  };
  // Field juice for sim events. Runs inside the tick's drain: a view error must not count as a sim
  // error or drop the frame's remaining ticks.
  private readonly onSim = (e: SimEvent): void => {
    try {
      if (e.type === 'FoodEaten' || e.type === 'BreedingFoodEaten') this.munch.explode(MUNCH_CRUMBS, e.x, e.y);
      else if (e.type === 'LambBorn') this.poof.explode(POOF_PUFFS, e.x, e.y);
    } catch (err) {
      reportError('ui', err);
    }
  };
  // UX-DR31: the heart cursor while in breed mode. HUD buttons keep their hand (Phaser sets it on over).
  private readonly onBreedMode = (e: { active: boolean }): void => {
    this.input.manager.setDefaultCursor(e.active ? HEART_CURSOR : '');
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
    this.publicPregnancies.length = 0;

    // Placeholder ground until the era backgrounds arrive in Epic 3 (`pasture` is an art tone).
    this.cameras.main.setBackgroundColor(COLORS.pasture);
    new Fence(this, fenceBounds(this.state));
    // Every game (new, continued, restarted) opens with the pen centred above the bar (Rylan).
    this.penCamera = new PenCamera(this.cameras.main);
    this.penCamera.centreOn(fenceBounds(this.state));
    this.foodLayer = new EntityLayer(new ObjectPool(() => new FoodSprite(this), FOOD_POOL_SIZE));
    this.breedingLayer = new EntityLayer(
      new ObjectPool(() => new FoodSprite(this, FRAME.breedingPiece), BREEDING_POOL_SIZE),
    );
    this.sheepLayer = new EntityLayer(new ObjectPool(() => new SheepSprite(this), SHEEP_POOL_SIZE));
    this.pregnancyLayer = new EntityLayer(new ObjectPool(() => new PregnancyHeart(this), PREGNANCY_POOL_SIZE));
    // One emitter for every munch; above the sheep, below the tooltip.
    this.munch = this.add
      .particles(0, 0, ATLAS.sheepWorld, { frame: FRAME.munchCrumb, emitting: false, ...MUNCH })
      .setDepth(TOOLTIP_DEPTH - 1);
    this.poof = this.add
      .particles(0, 0, ATLAS.sheepWorld, { frame: FRAME.poof, emitting: false, ...POOF })
      .setDepth(TOOLTIP_DEPTH - 1);
    this.sheepHover = new SheepHover(this.input, this.cameras.main, this.sheepLayer, new Tooltip(this, TOOLTIP_DEPTH));
    // The Esc chain (UX-DR73). OverlayScene is launched after this and replaced on every restart,
    // so it is looked up on each press, never cached.
    const overlay = (): OverlayScene => this.scene.get('OverlayScene') as OverlayScene;
    const camera = this.cameras.main;
    const input: InputController = new InputController(this.input, {
      modalOpen: () => this.modalOpen,
      esc: [
        () => overlay().closeConfirm(),
        () => overlay().closeSubPanel(),
        // Story 2.7's cancel drag slots in here, and 3.2's close shop after breed mode.
        (): boolean => input.exitBreedMode(),
        () => overlay().togglePause(),
      ],
      panBy: (dx, dy) => this.penCamera.panBy(dx, dy, fenceBounds(this.state)),
      // World point as SheepHover takes it: the pointer plus this frame's scroll (zoom 1).
      sheepAt: (sx, sy) => {
        const i = sheepIndexAt(this.publicSheep, this.sheepLayer, sx + camera.scrollX, sy + camera.scrollY);
        return i < 0 ? 0 : this.publicSheep[i].id;
      },
      canBreed: (id) => {
        const list = this.publicSheep;
        for (let i = 0; i < list.length; i++) if (list[i].id === id) return list[i].canBreed;
        return false;
      },
      shake: (id) => this.sheepLayer.spriteFor(id)?.shake(),
      dispatch: (cmd) => this.dispatch(cmd),
      pointerOnHud: () => this.pointerOnHudControl(),
    });
    this.inputController = input;
    bus.on('sim', this.onSim, this);
    bus.on('breedMode:changed', this.onBreedMode, this);
    // Saving (FR40): every 10 s and on hide (saveStore), and before the error toast (safety net).
    // A new or loaded game lifts any block left by a sim error in the previous one.
    allowSaving();
    this.stopAutosave = startAutosave(() => this.state);
    setForceSave(() => writeSave(this.state));
    // Hidden-tab pause (AR25). Phaser also pauses its loop and resets its delta on hide/show, and the
    // clock clamps long frames, but the rule is ours: no tick while hidden, nothing added on return.
    // game.events outlives this scene, so both handlers are removed on SHUTDOWN.
    this.hidden = document.hidden;
    this.paused = false;
    this.skipDelta = false;
    this.game.events.on(Phaser.Core.Events.HIDDEN, this.onHidden, this);
    this.game.events.on(Phaser.Core.Events.VISIBLE, this.onVisible, this);
    // A right-drag released while the window has no focus (alt-tab) never reaches Phaser, so the
    // pan is dropped on blur and on hide.
    this.game.events.on(Phaser.Core.Events.BLUR, this.onBlur, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      input.destroy();
      bus.off('sim', this.onSim, this);
      bus.off('breedMode:changed', this.onBreedMode, this);
      // The heart cursor must not outlive the game (title screen, restart).
      this.input.manager.setDefaultCursor('');
      this.stopAutosave();
      setForceSave(null);
      this.game.events.off(Phaser.Core.Events.HIDDEN, this.onHidden, this);
      this.game.events.off(Phaser.Core.Events.VISIBLE, this.onVisible, this);
      this.game.events.off(Phaser.Core.Events.BLUR, this.onBlur, this);
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

  /** True while any modal is up, the lose screen included: shortcuts, Farm and tooltips are off. */
  get modalOpen(): boolean {
    return this.paused || isLost(this.state);
  }

  /** OverlayScene's pause menu. Does not touch the hidden-tab flag. */
  setPaused(paused: boolean): void {
    if (paused === this.paused) return;
    this.paused = paused;
    // No clock.reset(): the leftover accumulator keeps interpolation continuous, so sheep do not
    // snap back. Nothing queued while paused (Farm is ignored under a modal), so nothing bursts.
    if (!paused) this.skipDelta = true;
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

  /**
   * Pause → Main Menu (Rylan, 2026-10-06): saves now, then leaves for the title, where Continue
   * resumes this game. No confirm, and nothing is lost (code review decision, Rylan):
   * - the save wrote: the title loads it as usual;
   * - it failed (storage blocked or full, invalid state): the live game is handed to the title, so
   *   Continue still resumes it from memory;
   * - saving is blocked after a sim error: the live state may be the bad one, so the game stays open
   *   (paused) with a toast, and the last good save is kept.
   * HUD and Overlay are stopped with the game; Phaser queues the ops, so input handlers may call it.
   */
  quitToTitle(): void {
    let data: TitleSceneData = {};
    if (!writeSave(this.state)) {
      if (isSavingBlocked()) {
        showToast(STRINGS.quitSaveFailed);
        return;
      }
      data = { unsaved: this.state };
    }
    this.stopAutosave();
    setForceSave(null);
    this.scene.stop('HudScene');
    this.scene.stop('OverlayScene');
    this.scene.start('TitleScene', data);
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
      } else if (!this.hidden && !this.paused) {
        // FR41 / UX-DR14: nothing advances while the tab is hidden or the menu is up; the first frame
        // back adds no time.
        const ticks = this.clock.advance(this.skipDelta ? 0 : this.game.loop.rawDelta);
        this.skipDelta = false;
        for (let t = 0; t < ticks; t++) this.tick();
      }
      this.render();
    } catch (err) {
      // The remaining ticks of this frame are dropped, so a bad state throws once per frame at most.
      reportError('sim', err);
    }
    // View-only work (the pan and the sheep tooltip) has its own guard: a bug here is a UI error, and
    // must not count as a sim error, which would stop saving.
    try {
      // FR11 / UX-DR31: a greyed Breed tool, or any modal, ends breed mode (a no-op when it is off).
      if (this.modalOpen || breedBlock(this.state) !== null) this.inputController.exitBreedMode();
      this.inputController.update();
      // SheepHover reads the raw pointer, not hit objects, so it would show under any modal's scrim
      // or through a HUD control the pen is panned under.
      if (this.modalOpen || this.pointerOnHudControl()) this.sheepHover.clear();
      else this.sheepHover.update(this.publicSheep, this.game.loop.time);
    } catch (err) {
      reportError('ui', err);
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

  private pointerOnHudControl(): boolean {
    // Launched after this scene and replaced on every restart: look it up, and only trust it live.
    const hud = this.scene.get('HudScene') as HudScene;
    return hud.sys.isActive() && hud.pointerOverControl;
  }

  private onBlur(): void {
    this.inputController.cancelPress();
  }

  private onHidden(): void {
    this.hidden = true;
    this.inputController.cancelPress();
  }

  // Never touches `paused`: a menu open before the tab hid is still open after.
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
    this.breedingLayer.sync(selectBreedingPieces(this.state), this.clock.alpha, this.state.time);
    selectPublicSheep(this.state, this.publicSheep);
    this.sheepLayer.sync(this.publicSheep, this.clock.alpha, this.state.time);
    this.pregnancyLayer.sync(selectPregnancies(this.state, this.publicPregnancies), this.clock.alpha, this.state.time);
    this.syncBreedMarkers();
  }

  /** UX-DR56/UX-DR69: in breed mode A shows its pinned heart and every other pickable adult a pulse. */
  private syncBreedMarkers(): void {
    const input = this.inputController;
    const breeding = input.breeding;
    const a = input.pickedA;
    const list = this.publicSheep;
    for (let i = 0; i < list.length; i++) {
      const p = list[i];
      const spr = this.sheepLayer.spriteFor(p.id);
      if (spr === undefined) continue;
      spr.setBreedMarker(!breeding ? 'none' : p.id === a ? 'pinned' : p.canBreed ? 'candidate' : 'none');
    }
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
