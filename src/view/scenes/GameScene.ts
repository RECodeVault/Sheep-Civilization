import Phaser from 'phaser';
import { COLOR_INT, COLORS, LAYOUT } from '../../config/constants';
import { FixedStepClock } from '../../core/fixedStep';
import { invariant } from '../../core/invariant';
import { log } from '../../core/log';
import { InputController } from '../../input/InputController';
import { savable } from '../../save/saveFile';
import { allowSaving, isSavingBlocked, startAutosave, wipeSave, writeSave } from '../../save/saveStore';
import { applyCommand, type Command } from '../../sim/commands';
import { clearEvents, drainEvents, type SimEvent } from '../../sim/events';
import {
  breedBlock,
  currentEra,
  fenceBounds,
  isDecoration,
  isLand,
  isLost,
  selectBreedingPieces,
  selectCarcasses,
  selectFoodPieces,
  selectLoseView,
  selectPregnancies,
  selectPublicSheep,
  selectShopView,
  type Decoration,
  type PublicPregnancy,
  type PublicSheep,
  type ShopRowView,
} from '../../sim/selectors';
import { createNewGame, type BreedingPiece, type Carcass, type FoodPiece, type GameState } from '../../sim/state';
import { step } from '../../sim/step';
import { syncEra } from '../../sim/systems/eras';
import { ATLAS, FRAME, HEART_CURSOR } from '../assetKeys';
import { bus } from '../bus';
import type { Rect } from '../../config/tuning';
import { BetterPlace } from '../field/BetterPlace';
import { CarcassSprite } from '../field/CarcassSprite';
import { Decorations } from '../field/Decorations';
import { FIELD_DEPTH } from '../field/depths';
import { EraBackground } from '../field/EraBackground';
import { EntityLayer } from '../field/EntityLayer';
import { Fence } from '../field/Fence';
import { FoodSprite } from '../field/FoodSprite';
import {
  BETTER_PLACE,
  BETTER_PLACE_BOUNDS,
  DECORATION_SPOTS,
  layoutProblems,
  MARKET,
  MARKET_BOUNDS,
  SHOP_PANEL_RIGHT,
  union,
} from '../field/layout';
import { Market } from '../field/Market';
import { ObjectPool } from '../field/ObjectPool';
import { PenCamera } from '../field/PenCamera';
import { PregnancyHeart } from '../field/PregnancyHeart';
import { spriteIndexAt } from '../field/hitTest';
import { SheepDrag } from '../field/SheepDrag';
import { SheepHover } from '../field/SheepHover';
import { SheepSprite } from '../field/SheepSprite';
import { ShopPanel } from '../hud/ShopPanel';
import { FloatPopups } from '../juice/FloatPopups';
import { clearAnnouncements, markGameStarted, reportError, setForceSave, showToast } from '../safetyNet';
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
// Architecture N3: carcasses stay until clicked (FR13), so the pool grows on demand.
const CARCASS_POOL_SIZE = 40;
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
// UX-DR59/UX-DR79 dust: a puff where a carcass lands, and a smaller one where it is cleared (click
// feedback). Visual only, like the munch.
const DUST_SPAWN_PUFFS = 8;
const DUST_CLEAR_PUFFS = 4;
// A small puff at a decoration's foot when it is bought (Story 3.4).
const DECORATION_PUFFS = 6;
// Fast and wide enough to clear the carcass's own (light) body, so the puff reads against the grass.
const DUST = {
  lifespan: 450,
  speed: { min: 60, max: 120 },
  angle: { min: 160, max: 380 },
  gravityY: 60,
  scale: { start: 2, end: 3 },
  alpha: { start: 1, end: 0 },
} as const;
// UX-DR80 suction: the sacrificed sheep's body spirals into the hole, then halo sparkles burst. A
// pooled ghost image plays it, so the real sprite leaves through the layer's sweep as usual (playExit
// stays synchronous). Visual only; Story 5.7's reduced motion revisits it. [ASSUMPTION, tune in the
// browser] values.
const SUCTION = { durationMs: 400, spinDeg: 360, ghosts: 3 } as const;
// UX-DR81 reveal (Story 4.4): before its spiral, the Abomination's ghost flashes its true form, a `void`
// FILL silhouette (there is no true-form art), swelling and shaking at the hole's rim: "as any
// sacrificed sheep falls in, the game shows the truth" (GDD Reveal). About flashes × 2 × flashMs
// (0.66 s) before the spiral. Visual only; Story 5.7's reduced motion drops the swell and shake, never
// the flash (the truth is information). [ASSUMPTION, tune in the browser] values.
const REVEAL = { flashes: 3, flashMs: 110, swellScale: 1.35, shakePx: 3 } as const;
// UX-DR82 sale: the sold sheep's body hops into the stall's counter, shrinking and fading, on the same
// pooled ghosts as the suction. Visual only; Story 5.7's reduced motion revisits it. [ASSUMPTION, tune
// in the browser] values; `toY` is the counter's middle (world).
const SALE = { durationMs: 250, toY: 330, scale: 0.5 } as const;
const SPARKLE_BURST = 10;
const SPARKLE = {
  lifespan: 500,
  speed: { min: 40, max: 110 },
  angle: { min: 0, max: 360 },
  gravityY: -30,
  scale: { start: 2, end: 1 },
  alpha: { start: 1, end: 0 },
} as const;

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
  // DEV sim tick timing for the debug overlay (Story 3.6, takeTickStats). Written only in DEV builds.
  private tickMsSum = 0;
  private tickCount = 0;
  private tickMsMax = 0;
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
  private carcassLayer!: EntityLayer<Carcass, CarcassSprite>;
  private readonly publicPregnancies: PublicPregnancy[] = [];
  private munch!: Phaser.GameObjects.Particles.ParticleEmitter;
  private poof!: Phaser.GameObjects.Particles.ParticleEmitter;
  private dust!: Phaser.GameObjects.Particles.ParticleEmitter;
  private sparkle!: Phaser.GameObjects.Particles.ParticleEmitter;
  private betterPlace!: BetterPlace;
  private market!: Market;
  /** The Flower Patch and the Scarecrow (Story 3.4), drawn from `owned`. */
  private decorations!: Decorations;
  /** The pasture fence, rebuilt in place when land is bought (Story 3.3). */
  private fence!: Fence;
  /** A land purchase was applied this frame: the fence grows once, after the ticks (growLand). */
  private landBought = false;
  /** The era art under the field (Story 3.5). */
  private eraBackground!: EraBackground;
  /** An EraChanged was emitted this frame: the background fades once, after the ticks, to the era now. */
  private eraChanged = false;
  /**
   * The shop panel (Story 3.2), drawn here so the world overlays draw above it (ShopPanel). Open or
   * closed is view state, never saved: every game starts with it closed.
   */
  private shopPanel!: ShopPanel;
  private shopOpen = false;
  private readonly shopRows: ShopRowView[] = [];
  // Whether a modal was up last frame, to clear stale row hover once when one opens.
  private wasModal = false;
  /** The sale's "$10"/"$5" coin popups, in world space over the stall (UX-DR82). */
  private worldPopups!: FloatPopups;
  private sheepDrag!: SheepDrag;
  /**
   * The pen plus both drop targets: what the camera keeps in view (Stories 2.7, 3.1). Rebuilt with the
   * fence when land is bought (Story 3.3; buildPlayArea).
   */
  private playArea!: Rect;
  /** The pen and the Better Place: what a game opens centred on (PenCamera.centreOn). */
  private focus!: Rect;
  /** UX-DR80 suction and UX-DR82 sale ghosts, reused round-robin (never created during play). */
  private readonly ghosts: Phaser.GameObjects.Image[] = [];
  /**
   * Per ghost, the reveal toast still owed by its sacrifice (sent when the ghost lands), or null. A
   * ghost reused before it lands sends it first: killTweensOf destroys a tween without onStop.
   */
  private readonly ghostLanding: ((() => void) | null)[] = [];
  private nextGhost = 0;
  // A carcass already clicked (its ClearCarcass is queued for the next tick) is skipped by carcassAt,
  // so a fast second click reaches the carcass under it. Bound once: no closure per click.
  private readonly clearQueued = (id: number): boolean => {
    const cmds = this.pendingCommands;
    for (let i = 0; i < cmds.length; i++) {
      const c = cmds[i];
      if (c.type === 'ClearCarcass' && c.id === id) return true;
    }
    return false;
  };
  // Bound once so the per-tick drain allocates no closure.
  private readonly forwardEvent = (e: SimEvent): void => {
    bus.emit('sim', e);
  };
  // Field juice for sim events. Runs inside the tick's drain: a view error must not count as a sim
  // error or drop the frame's remaining ticks.
  private readonly onSim = (e: SimEvent): void => {
    try {
      // A carcass a sheep ate (FR14) munches like a piece; its sprite leaves through the layer's sweep.
      if (e.type === 'FoodEaten' || e.type === 'BreedingFoodEaten' || e.type === 'CarcassEaten') {
        this.munch.explode(MUNCH_CRUMBS, e.x, e.y);
      } else if (e.type === 'LambBorn') this.poof.explode(POOF_PUFFS, e.x, e.y);
      else if (e.type === 'CarcassSpawned') this.dust.explode(DUST_SPAWN_PUFFS, e.x, e.y);
      else if (e.type === 'CarcassCleared') this.dust.explode(DUST_CLEAR_PUFFS, e.x, e.y);
      else if (e.type === 'Sacrificed') this.suck(e.id, e.wasAbomination);
      else if (e.type === 'Sold') this.sold(e.id, e.price);
      // Grown once per frame in update, however many tiers were bought in the frame's ticks.
      else if (e.type === 'Bought' && isLand(e.item)) this.landBought = true;
      else if (e.type === 'Bought' && isDecoration(e.item)) this.decorationBought(e.item);
      // Faded once per frame in update, straight to the era the state is in (×16 can change it twice).
      // The losing tick runs no eras system (AC 2), so a one-tick wipe would keep the old era's art:
      // follow the derived era (0 sheep → Pasture) as the badge does (AC 6).
      else if (e.type === 'EraChanged' || e.type === 'Lost') this.eraChanged = true;
    } catch (err) {
      reportError('ui', err);
    }
  };
  // UX-DR31: the heart cursor while in breed mode. setDefaultCursor writes the canvas cursor at once,
  // and Phaser sets a button's hand only on pointer-over, so a hovered HUD button gets its own back.
  private readonly onBreedMode = (e: { active: boolean }): void => {
    const manager = this.input.manager;
    manager.setDefaultCursor(e.active ? HEART_CURSOR : '');
    const hud = this.scene.get('HudScene') as HudScene;
    const b = hud.sys.isActive() ? hud.hoveredButton : null;
    if (b !== null) manager.canvas.style.cursor = b.isEnabled ? 'pointer' : 'default';
    // The same for a buyable shop row under the pointer (Story 3.2 review).
    else if (this.shopPanel.hoveringBuyable) manager.canvas.style.cursor = 'pointer';
  };

  constructor() {
    super('GameScene');
  }

  create(data?: GameSceneData): void {
    markGameStarted();
    // The previous game's death toasts are not news in this one (Restart, debug Load).
    clearAnnouncements();
    // Clear first, so events emitted while a game is built or loaded reach the first drain.
    clearEvents();
    // Math.random is fine in view code. A resumed save restores its own rng state.
    this.state = data?.state ?? createNewGame(Math.floor(Math.random() * 2 ** 32));
    // Phaser keeps restart data in settings.data and reuses it when a later restart passes none, so
    // consume it: a plain restart must start a new game, not resume this (by then mutated) state.
    if (data !== undefined) delete data.state;
    // A stale era cache (an old or edited save) must not announce a change on the first tick.
    syncEra(this.state);
    this.clock = new FixedStepClock();
    this.pendingCommands = [];
    this.publicSheep.length = 0;
    this.publicPregnancies.length = 0;

    // The era art (Story 3.5) covers every world point the camera can show; the pasture colour shows
    // only if a background failed to load. A continued or loaded game shows its era at once, no fade.
    this.cameras.main.setBackgroundColor(COLORS.pasture);
    this.eraBackground = new EraBackground(this);
    this.eraBackground.show(currentEra(this.state));
    this.eraChanged = false;
    // A loaded game with land draws its grown fence from the start (Story 3.3).
    this.fence = new Fence(this, fenceBounds(this.state));
    this.betterPlace = new BetterPlace(this);
    this.market = new Market(this);
    // A continued or loaded game draws its decorations from the start, with no pop (Story 3.4).
    this.decorations = new Decorations(this);
    this.decorations.show(this.state);
    // Every game (new, continued, restarted) opens with the pen and the Better Place centred above the
    // bar (Story 2.7; was the pen alone, 1.10), and the pan keeps the whole play area, the Market too,
    // in view (Story 3.1). The open shop never covers the Better Place (Stories 3.2, 3.3).
    this.buildPlayArea();
    this.penCamera = new PenCamera(this.cameras.main, BETTER_PLACE_BOUNDS);
    this.penCamera.centreOn(this.focus, this.playArea, SHOP_PANEL_RIGHT + LAYOUT.safeMargin);
    this.carcassLayer = new EntityLayer(new ObjectPool(() => new CarcassSprite(this), CARCASS_POOL_SIZE));
    this.foodLayer = new EntityLayer(new ObjectPool(() => new FoodSprite(this), FOOD_POOL_SIZE));
    this.breedingLayer = new EntityLayer(
      new ObjectPool(() => new FoodSprite(this, FRAME.breedingPiece), BREEDING_POOL_SIZE),
    );
    this.sheepLayer = new EntityLayer(new ObjectPool(() => new SheepSprite(this), SHEEP_POOL_SIZE));
    this.pregnancyLayer = new EntityLayer(new ObjectPool(() => new PregnancyHeart(this), PREGNANCY_POOL_SIZE));
    // One emitter for every munch; above the sheep and hearts, below the pings and the tooltip.
    this.munch = this.add
      .particles(0, 0, ATLAS.sheepWorld, { frame: FRAME.munchCrumb, emitting: false, ...MUNCH })
      .setDepth(FIELD_DEPTH.particles);
    this.poof = this.add
      .particles(0, 0, ATLAS.sheepWorld, { frame: FRAME.poof, emitting: false, ...POOF })
      .setDepth(FIELD_DEPTH.particles);
    this.dust = this.add
      .particles(0, 0, ATLAS.sheepWorld, { frame: FRAME.dust, emitting: false, ...DUST })
      .setDepth(FIELD_DEPTH.particles);
    this.sparkle = this.add
      .particles(0, 0, ATLAS.sheepWorld, { frame: FRAME.sparkle, emitting: false, ...SPARKLE })
      .setDepth(FIELD_DEPTH.particles);
    // Above the particles, below the pings: a coin popup over the stall.
    this.worldPopups = new FloatPopups(this, FIELD_DEPTH.particles);
    this.shopOpen = false;
    this.landBought = false;
    this.wasModal = false;
    this.shopRows.length = 0;
    // A rare event, so the command object is fine; the sim checks the purchase again (economy.ts).
    this.shopPanel = new ShopPanel(this, (item) => this.dispatch({ type: 'Buy', item }));
    this.ghosts.length = 0;
    // The last game's owed reveal toasts are dropped, never sent into this one (a restart mid-spiral).
    this.ghostLanding.length = 0;
    this.nextGhost = 0;
    for (let i = 0; i < SUCTION.ghosts; i++) {
      this.ghosts.push(this.add.image(0, 0, ATLAS.sheepWorld, FRAME.adultIdle).setDepth(FIELD_DEPTH.dragged).setVisible(false));
      this.ghostLanding.push(null);
    }
    // The sheep tooltip is the top of FIELD_DEPTH (above pings). Sheep hover stays in this scene;
    // HudScene draws above it. The panned pen can slide under the Pause button, so the sheep hover
    // skips while the pointer is on a HUD control (pointerOnHudControl) and the two tooltips never
    // show together.
    this.sheepHover = new SheepHover(this.input, this.cameras.main, this.sheepLayer, new Tooltip(this, FIELD_DEPTH.tooltip));
    // The Esc chain (UX-DR73). OverlayScene is launched after this and replaced on every restart,
    // so it is looked up on each press, never cached.
    const overlay = (): OverlayScene => this.scene.get('OverlayScene') as OverlayScene;
    const camera = this.cameras.main;
    const drag = new SheepDrag(camera, this.sheepLayer, (cmd) => this.dispatch(cmd));
    this.sheepDrag = drag;
    const input: InputController = new InputController(this.input, {
      modalOpen: () => this.modalOpen,
      esc: [
        () => overlay().closeConfirm(),
        () => overlay().closeSubPanel(),
        (): boolean => input.cancelDrag(),
        (): boolean => input.exitBreedMode(),
        () => this.closeShop(),
        () => overlay().togglePause(),
      ],
      panBy: (dx, dy) => this.penCamera.panBy(dx, dy, this.playArea, this.panLeftInset()),
      // World point as SheepHover takes it: the pointer plus this frame's scroll (zoom 1).
      sheepAt: (sx, sy) => {
        const i = spriteIndexAt(this.publicSheep, this.sheepLayer, sx + camera.scrollX, sy + camera.scrollY);
        return i < 0 ? 0 : this.publicSheep[i].id;
      },
      // UX-DR90: a carcass is at least hit-min square, beyond its bounds plus the pad.
      carcassAt: (sx, sy) => {
        const list = selectCarcasses(this.state);
        const i = spriteIndexAt(
          list,
          this.carcassLayer,
          sx + camera.scrollX,
          sy + camera.scrollY,
          LAYOUT.hitMin / 2,
          this.clearQueued,
        );
        return i < 0 ? 0 : list[i].id;
      },
      canBreed: (id) => {
        const list = this.publicSheep;
        for (let i = 0; i < list.length; i++) if (list[i].id === id) return list[i].canBreed;
        return false;
      },
      shake: (id) => this.sheepLayer.spriteFor(id)?.shake(),
      dispatch: (cmd) => this.dispatch(cmd),
      pointerOnHud: () => this.pointerOnHudControl(),
      beginDrag: (id, sx, sy) => drag.begin(id, sx, sy),
      moveDrag: (sx, sy) => drag.move(sx, sy, this.hudControlAt(sx, sy)),
      endDrag: (sx, sy) => drag.end(sx, sy, this.hudControlAt(sx, sy), this.state.time),
      cancelDrag: () => drag.cancel(this.state.time),
      dragAlive: () => drag.live,
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

  /** True while a sheep is dragged (HudScene turns its hover off meanwhile). */
  get dragging(): boolean {
    return this.inputController.dragging;
  }

  /** True while the shop panel is open (Story 3.2). */
  get shopIsOpen(): boolean {
    return this.shopOpen;
  }

  /** The Shop toggle (UX-DR40): opens or closes the panel. Not under a modal. */
  toggleShop(): void {
    if (this.modalOpen) return;
    this.setShopOpen(!this.shopOpen);
  }

  /**
   * The Esc chain's close-shop step (UX-DR73): true if the panel was open. Under a modal it passes, so
   * Esc reaches the pause step and resumes, and the shop is still open after (AC 4).
   */
  closeShop(): boolean {
    if (!this.shopOpen || this.modalOpen) return false;
    this.setShopOpen(false);
    return true;
  }

  private setShopOpen(open: boolean): void {
    if (open === this.shopOpen) return;
    this.shopOpen = open;
    this.shopPanel.setOpen(open);
    if (open) {
      this.refreshShop();
      // Keep the play area right of the panel, or at least the Better Place when the area is too wide
      // (Land II/III, Story 3.3): a view panned under it moves at once.
      this.penCamera.reclamp(this.playArea, this.panLeftInset());
    }
    bus.emit('shop:toggled', { open });
  }

  /** The pen ∪ Better Place focus and the play area (∪ Market) for the current fence. Allocates; rare. */
  private buildPlayArea(): void {
    this.focus = union(fenceBounds(this.state), BETTER_PLACE_BOUNDS);
    this.playArea = union(this.focus, MARKET_BOUNDS);
  }

  /**
   * Land was bought (Story 3.3, UX-DR49): the fence grows in place, with a dust burst along its new rails,
   * and the camera keeps the larger play area in view, moving only as far as its new limits require (no
   * re-centre). Runs once per frame after the ticks (two tiers bought in one frame grow once), as UI work.
   * A rare event: allocation is fine.
   */
  private growLand(): void {
    const f = fenceBounds(this.state);
    this.fence.setBounds(f);
    this.buildPlayArea();
    this.penCamera.reclamp(this.playArea, this.panLeftInset());
    // Dust only where it is seen: a burst under the open shop panel would draw over its rows.
    const cam = this.cameras.main;
    const right = f.x + f.width;
    const bottom = f.y + f.height;
    const midX = f.x + f.width / 2;
    const midY = f.y + f.height / 2;
    for (const [x, y] of [
      [f.x, f.y],
      [midX, f.y],
      [right, f.y],
      [right, midY],
      [right, bottom],
      [midX, bottom],
      [f.x, bottom],
      [f.x, midY],
    ]) {
      if (!this.shopPanel.contains(x - cam.scrollX, y - cam.scrollY)) this.dust.explode(DUST_SPAWN_PUFFS, x, y);
    }
  }

  /**
   * A decoration was bought (Story 3.4): it pops in at its spot with a dust puff at its foot. It moves no
   * camera and rebuilds nothing, so unlike land it runs right in the drain. At most twice a game.
   */
  private decorationBought(d: Decoration): void {
    this.decorations.pop(d);
    const spot = DECORATION_SPOTS[d];
    this.dust.explode(DECORATION_PUFFS, spot.x, spot.foot);
  }

  /**
   * The screen x the play area keeps right of (only the Better Place, when the area is too wide;
   * PenCamera): the safe edge, or past the open shop.
   */
  private panLeftInset(): number {
    return this.shopOpen ? SHOP_PANEL_RIGHT + LAYOUT.safeMargin : LAYOUT.safeMargin;
  }

  private refreshShop(): void {
    this.shopPanel.update(selectShopView(this.state, this.shopRows));
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
      // As a save would: a sheep mid-drag (its Drop still queued, now lost) is handed over standing.
      data = { unsaved: savable(this.state) };
    }
    this.stopAutosave();
    setForceSave(null);
    this.scene.stop('HudScene');
    this.scene.stop('OverlayScene');
    this.scene.start('TitleScene', data);
  }

  update(): void {
    // Input first, so a mode change or a pick is drawn this frame (markers never lag a frame), and a
    // command it dispatches applies in this frame's ticks. View-only work has its own guard: a bug
    // here is a UI error, and must not count as a sim error, which would stop saving.
    try {
      // FR11 / UX-DR31: a greyed Breed tool, or any modal, ends breed mode (a no-op when it is off).
      if (this.modalOpen || breedBlock(this.state) !== null) this.inputController.exitBreedMode();
      this.inputController.update();
    } catch (err) {
      reportError('ui', err);
    }
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
    try {
      if (this.landBought) {
        this.landBought = false;
        this.growLand();
      }
    } catch (err) {
      reportError('ui', err);
    }
    try {
      if (this.eraChanged) {
        this.eraChanged = false;
        this.eraBackground.fadeTo(currentEra(this.state));
      }
    } catch (err) {
      reportError('ui', err);
    }
    try {
      this.updateShop();
    } catch (err) {
      reportError('ui', err);
    }
    // The sheep tooltip reads the sprites just rendered; guarded like the input above.
    try {
      // SheepHover reads the raw pointer, not hit objects, so it would show under any modal's scrim
      // or through a HUD control the pen is panned under.
      // UX-DR60: and hidden for the whole of a drag.
      if (this.modalOpen || this.pointerOnHudControl() || this.inputController.dragging) this.sheepHover.clear();
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

  /**
   * The sim tick times since the last call (DEV builds time each `step`, Story 3.6): mean and max in ms
   * over `count` ticks, then the window restarts. The overlay calls it on its refresh.
   */
  takeTickStats(): { count: number; meanMs: number; maxMs: number } {
    const meanMs = this.tickCount > 0 ? this.tickMsSum / this.tickCount : 0;
    const out = { count: this.tickCount, meanMs, maxMs: this.tickMsMax };
    this.tickMsSum = 0;
    this.tickCount = 0;
    this.tickMsMax = 0;
    return out;
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
   * For src/debug/ only (Reveal Abomination, Story 4.1): writes into `out` the world spot where sheep
   * `id` is drawn this frame (its interpolated sprite) and returns it, or returns null when no sprite is
   * bound to it. A copy, so debug code never holds the pooled sprite. Takes an id, so this scene never
   * learns which sheep is the Abomination.
   */
  debugSheepDrawnAt<T extends { x: number; y: number }>(id: number, out: T): T | null {
    const sprite = this.sheepLayer.spriteFor(id);
    if (sprite === undefined) return null;
    out.x = sprite.x;
    out.y = sprite.y;
    return out;
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

  /**
   * True when canvas point (sx, sy) is on a HUD control. Geometric, not hover: HudScene turns its hover
   * off during a drag. The panned hole can slide under the Pause button, and a release there is no
   * sacrifice (AC 6).
   */
  private hudControlAt(sx: number, sy: number): boolean {
    // The open shop panel counts as a HUD control (Story 3.2): a release over it is a plain drop.
    if (this.shopPanel.contains(sx, sy)) return true;
    const hud = this.scene.get('HudScene') as HudScene;
    return hud.sys.isActive() && hud.controlAt(sx, sy);
  }

  private pointerOnHudControl(): boolean {
    // The open shop panel is no field: no field press, pan or sheep hover through it (Story 3.2).
    const p = this.input.activePointer;
    if (this.shopPanel.contains(p.x, p.y)) return true;
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
    if (import.meta.env.DEV) {
      // Story 3.6: the debug overlay's tick-time line (NFR1's 2 ms sim budget). DEV only, so production
      // neither times nor ships this branch; plain number fields, nothing allocated.
      const t0 = performance.now();
      step(this.state);
      const ms = performance.now() - t0;
      this.tickMsSum += ms;
      this.tickCount++;
      if (ms > this.tickMsMax) this.tickMsMax = ms;
    } else {
      step(this.state);
    }
    drainEvents(this.forwardEvent);
  }

  private render(): void {
    this.carcassLayer.sync(selectCarcasses(this.state), this.clock.alpha, this.state.time);
    this.foodLayer.sync(selectFoodPieces(this.state), this.clock.alpha, this.state.time);
    this.breedingLayer.sync(selectBreedingPieces(this.state), this.clock.alpha, this.state.time);
    selectPublicSheep(this.state, this.publicSheep);
    // Before the layer syncs: a dragged (or just released) sheep is drawn at its held point.
    this.sheepDrag.sync(this.publicSheep, this.state.time);
    this.sheepLayer.sync(this.publicSheep, this.clock.alpha, this.state.time);
    this.betterPlace.setHighlight(this.sheepDrag.highlight);
    this.betterPlace.update(this.game.loop.time);
    this.market.setHighlight(this.sheepDrag.marketHighlight, this.sheepDrag.marketPrice);
    this.market.update(this.game.loop.time);
    this.pregnancyLayer.sync(this.drawnPregnancies(), this.clock.alpha, this.state.time);
    this.syncBreedMarkers();
  }

  /**
   * The shop panel's per-frame work, outside render(): a bug here is a UI error, which must not count
   * as a sim error and stop saving (Story 3.2 review). Allocates nothing.
   */
  private updateShop(): void {
    // No row hover or press while a sheep is carried or the field is panned (like the HUD buttons).
    this.shopPanel.setLive(!this.inputController.dragging && !this.inputController.panningField);
    if (this.shopOpen) this.refreshShop();
    this.syncUnderShop();
    // The scrim takes the pointer without a pointer-out: drop the rows' stale hover once.
    const modal = this.modalOpen;
    if (modal && !this.wasModal) this.shopPanel.clearHover();
    this.wasModal = modal;
  }

  /**
   * Story 3.3 review: the hearts and markers of sheep and pending lambs under the open panel draw below
   * it, so the panel hides them with their sheep (alert pings stay above). A sheep in the hand is above
   * the panel, and so are its overlays. Plain loops: no allocation.
   */
  private syncUnderShop(): void {
    const panel = this.shopPanel;
    const open = this.shopOpen;
    const cam = this.cameras.main;
    const sheep = this.publicSheep;
    for (let i = 0; i < sheep.length; i++) {
      const spr = this.sheepLayer.spriteFor(sheep[i].id);
      if (spr === undefined) continue;
      const lifted = spr.depth === FIELD_DEPTH.dragged;
      spr.setUnderShop(open && !lifted && panel.contains(spr.x - cam.scrollX, spr.y - cam.scrollY));
    }
    const pregs = this.publicPregnancies;
    for (let i = 0; i < pregs.length; i++) {
      const heart = this.pregnancyLayer.spriteFor(pregs[i].id);
      if (heart !== undefined) heart.setUnderShop(open && panel.contains(heart.x - cam.scrollX, heart.y - cam.scrollY));
    }
  }

  /**
   * The pending lambs, with the heart's spot moved onto the parents' drawn (interpolated) sprites, so
   * it floats between them instead of running a tick ahead. Allocates nothing.
   */
  private drawnPregnancies(): readonly PublicPregnancy[] {
    const list = selectPregnancies(this.state, this.publicPregnancies);
    for (let i = 0; i < list.length; i++) {
      const g = list[i];
      const a = this.sheepLayer.spriteFor(g.parentA);
      const b = this.sheepLayer.spriteFor(g.parentB);
      if (a !== undefined && b !== undefined) {
        g.x = (a.x + b.x) / 2;
        // Lifted clear of an infected parent's bubbles (UX-DR55) and of a parent's alert ping (UX-DR54).
        g.y = (a.y + b.y) / 2 - Math.max(a.pregnancyLift, b.pregnancyLift);
      } else if (a !== undefined || b !== undefined) {
        const s = (a ?? b) as SheepSprite;
        g.x = s.x;
        g.y = s.y - s.pregnancyLift;
      }
    }
    return list;
  }

  /**
   * UX-DR80 / UX-DR81: sheep `id` went into the Better Place. Runs inside the tick's drain, before
   * render()'s sweep, so its sprite is still bound and drawn where it was dropped: a ghost copies it and
   * spirals in. The Abomination's ghost first flashes its true form (FR33). When the ghost lands, the
   * reveal toast follows (`sacrifice:landed`); with no ghost to play, on the next frame.
   */
  private suck(id: number, wasAbomination: boolean): void {
    const ghost = this.ghostOf(id);
    if (ghost === null) {
      // Next frame, so HudScene's "went to a Better Place" toast (from this same Sacrificed, whose
      // listener runs after this one) comes first. Visual only: it changes no game state.
      this.time.delayedCall(0, () => bus.emit('sacrifice:landed', { wasAbomination }));
      return;
    }
    const slot = this.ghosts.indexOf(ghost);
    // Closures per sacrifice: a rare event.
    const landed = (): void => {
      if (this.ghostLanding[slot] !== landed) return;
      this.ghostLanding[slot] = null;
      bus.emit('sacrifice:landed', { wasAbomination });
    };
    this.ghostLanding[slot] = landed;
    if (wasAbomination) this.revealTrueForm(ghost, landed);
    else this.spiral(ghost, landed);
  }

  /**
   * UX-DR81: the ghost toggles between a `void` FILL silhouette and its copied look, swelling and
   * shaking, then goes down the hole as the silhouette.
   */
  private revealTrueForm(ghost: Phaser.GameObjects.Image, landed: () => void): void {
    const tinted = ghost.isTinted;
    const tint = ghost.tint;
    const mode = ghost.tintMode;
    const x = ghost.x;
    const beats = REVEAL.flashes * 2;
    let beat = -1;
    this.tweens.add({
      targets: ghost,
      scale: ghost.scale * REVEAL.swellScale,
      duration: beats * REVEAL.flashMs,
      ease: 'Quad.easeOut',
      onUpdate: (tween: Phaser.Tweens.Tween) => {
        // The TweenData's progress: Tween.progress is only updated after onUpdate (Phaser 4.2.1
        // Tween.update), so it would lag a frame and a hitch could skip a beat.
        const p = (tween.data[0] as Phaser.Tweens.TweenData).progress;
        const b = Math.min(beats - 1, Math.floor(p * beats));
        if (b === beat) return;
        beat = b;
        // Even beats show the true form; the shake swaps sides on each beat.
        if (b % 2 === 0) ghost.setTint(COLOR_INT.void).setTintMode(Phaser.TintModes.FILL);
        else if (tinted) ghost.setTint(tint).setTintMode(mode);
        else ghost.clearTint();
        ghost.x = x + (b % 2 === 0 ? REVEAL.shakePx : -REVEAL.shakePx);
      },
      onComplete: () => {
        ghost.setTint(COLOR_INT.void).setTintMode(Phaser.TintModes.FILL);
        ghost.x = x;
        this.spiral(ghost, landed);
      },
    });
  }

  /** UX-DR80: the ghost spirals into the hole, then `landed`, the halo sparkle and the hole's gulp. */
  private spiral(ghost: Phaser.GameObjects.Image, landed: () => void): void {
    this.tweens.add({
      targets: ghost,
      x: BETTER_PLACE.x,
      y: BETTER_PLACE.y,
      scale: 0,
      angle: ghost.angle + SUCTION.spinDeg,
      duration: SUCTION.durationMs,
      ease: 'Cubic.easeIn',
      onComplete: () => {
        ghost.setVisible(false);
        // First, so a throw in the juice below cannot lose the reveal toast.
        landed();
        this.sparkle.explode(SPARKLE_BURST, BETTER_PLACE.x, BETTER_PLACE.y);
        this.betterPlace.gulp();
      },
    });
  }

  /**
   * UX-DR82: sheep `id` was sold for `price`. The coin popup rises from the top of the stall, where the
   * price tag was, and, as for the suction, a ghost of the still-bound sprite hops into the counter.
   */
  private sold(id: number, price: number): void {
    this.worldPopups.spawn(MARKET.x, MARKET.hit.y, STRINGS.salePopup(price));
    const ghost = this.ghostOf(id);
    if (ghost === null) return;
    // A closure per sale: a rare event.
    this.tweens.add({
      targets: ghost,
      x: MARKET.x,
      y: SALE.toY,
      scale: ghost.scale * SALE.scale,
      alpha: 0,
      duration: SALE.durationMs,
      ease: 'Quad.easeIn',
      onComplete: () => {
        ghost.setVisible(false);
        this.market.nudge();
      },
    });
  }

  /**
   * The next pooled ghost, made a copy of sheep `id`'s drawn sprite (frame, flip, scale, angle, tint,
   * position), or null when the sprite is gone. Stops any tween still playing on that ghost, first
   * sending the reveal toast its sacrifice still owes.
   */
  private ghostOf(id: number): Phaser.GameObjects.Image | null {
    const spr = this.sheepLayer.spriteFor(id);
    if (spr === undefined) return null;
    const slot = this.nextGhost;
    const ghost = this.ghosts[slot];
    this.nextGhost = (slot + 1) % this.ghosts.length;
    // A sacrifice whose ghost is reused before it lands still gets its reveal toast (Story 4.4).
    this.ghostLanding[slot]?.();
    this.tweens.killTweensOf(ghost);
    ghost
      .setFrame(spr.frame.name)
      .setFlipX(spr.flipX)
      .setScale(spr.scaleX)
      .setAngle(spr.angle)
      .setAlpha(1)
      .setPosition(spr.x, spr.y)
      .setVisible(true);
    if (spr.isTinted) ghost.setTint(spr.tint).setTintMode(spr.tintMode);
    else ghost.clearTint();
    return ghost;
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

// The layout checks (Stories 3.3–3.5): every land tier's play area fits one screen with the Better Place
// and the Market in view, shop open or closed; the era art covers every scroll; the decorations stay
// clear. Story 3.6 moved them to layout.ts so npm test runs them too (tests/view/field/layout.test.ts).
if (import.meta.env.DEV) {
  const problems = layoutProblems();
  invariant(problems.length === 0, `GameScene: the field layout is broken: ${problems.join('; ')}`);
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
