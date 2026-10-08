// DEV-only debug overlay (architecture Debug Tools, AR15). Loaded by main.ts through a dynamic
// import behind `import.meta.env.DEV`, so production builds never contain it.
//
// A DOM panel, not a Phaser scene: buttons need no atlas frames or font metrics, clicks never reach
// the canvas or the gameplay InputController, and a real button click is the user gesture the
// Clipboard API needs. Backtick toggles it.
//
// Later stories add their buttons here. src/debug/ is the only non-sim code allowed to read
// isAbomination: Reveal Abomination (Story 4.1) rings it on the field, and the readout names it. Story
// 4.3's Kill now starts its visit at once, and the readout follows the visit and the doomed victim.
import Phaser from 'phaser';
import { COLOR_INT, COLORS, RADIUS, SPACING } from '../config/constants';
import { TUNING } from '../config/tuning';
import type { FixedStepClock } from '../core/fixedStep';
import { formatGameTime, formatMoney } from '../core/format';
import { log } from '../core/log';
import { decodeSave, encodeSave } from '../save/saveFile';
import { rngRange } from '../sim/rng';
import { boostRemainingMs, currentEra, fenceBounds, innerFence, stageOf } from '../sim/selectors';
import { createSheep, type GameState, type Sheep } from '../sim/state';
import { abominationAlive, makeAbomination } from '../sim/systems/abomination';
import { createCarcass } from '../sim/systems/carcass';
import { createBreedingPiece, createFoodPiece } from '../sim/systems/feeding';
import { infectSheep } from '../sim/systems/virus';
import { bus } from '../view/bus';
import { FIELD_DEPTH } from '../view/field/depths';
import type { GameScene } from '../view/scenes/GameScene';
import { PlaytestRecord } from './playtestRecord';

const SPEEDS = [1, 4, 16] as const;
// DOM text is rewritten at most this often, so the overlay barely affects the FPS it reports.
const REFRESH_MS = 250;
const ADD_FOOD = 5;
// Story 3.6: big piles for the 300-piece tick check (AC 5).
const ADD_PILE = 50;
const ADD_SHEEP = 10;
const ADD_MONEY = 100;
// Story 4.1: the Reveal Abomination ring, sized to circle a 64×52 sheep.
const OUTLINE_RADIUS = 40;
const OUTLINE_WIDTH = 2;

export function installDebugOverlay(game: Phaser.Game): void {
  let visible = false;
  // The speed the developer chose (0 = paused) and the one to restore on Resume. Debug pause is
  // clock.speed = 0. The gameplay pause (GameScene.setPaused) stops accumulation its own way and never
  // resets these speeds.
  let wantSpeed = 1;
  let resumeSpeed = 1;
  // A GameScene restart (Load save) builds a new clock at ×1; the chosen speed is re-applied to it.
  let knownClock: FixedStepClock | null = null;

  // Frame-time window, sampled every frame by one bound handler.
  let sum = 0;
  let count = 0;
  let max = 0;
  let lastRefresh = 0;

  // Story 3.6 playtest instruments: the milestone record (survives reloads), the sim tick times
  // (GameScene.takeTickStats, DEV-timed) and a count of console warnings and errors since page load.
  const record = new PlaytestRecord();
  let tickSum = 0;
  let tickSamples = 0;
  let tickMax = 0;
  let problems = 0;
  // The overlay's own fallback warnings (a refused clipboard write) are not the game's: not counted.
  let ownWarning = false;
  let lastRecord = 0;
  // The latest window's tick stats, for the tick line.
  let windowTick = { count: 0, meanMs: 0, maxMs: 0 };
  for (const level of ['warn', 'error'] as const) {
    const original = console[level].bind(console);
    console[level] = (...args: unknown[]): void => {
      if (!ownWarning) problems++;
      original(...args);
    };
  }

  const panel = document.createElement('div');
  const ps = panel.style;
  ps.position = 'fixed';
  ps.top = `${SPACING[2]}px`;
  // Top-right: the game's Pause button sits at the top-left.
  ps.right = `${SPACING[2]}px`;
  ps.zIndex = '999';
  ps.display = 'none';
  ps.padding = `${SPACING[2]}px`;
  ps.borderRadius = `${RADIUS.sm}px`;
  ps.backgroundColor = COLORS.duskDeep;
  ps.color = COLORS.wool;
  ps.font = '12px/1.4 ui-monospace, monospace';
  ps.width = '260px';
  ps.opacity = '0.92';

  const lines = document.createElement('div');
  lines.style.whiteSpace = 'pre';
  panel.appendChild(lines);
  const fpsLine = line(lines);
  const frameLine = line(lines);
  const timeLine = line(lines);
  const sheepLine = line(lines);
  const abomLine = line(lines);
  const foodLine = line(lines);
  const tickLine = line(lines);
  const paceLine = line(lines);
  const firstLine = line(lines);
  const problemLine = line(lines);
  const statusLine = line(lines);

  const row1 = buttonRow(panel);
  const speedButtons = SPEEDS.map((sp) =>
    button(row1, `×${sp}`, () => {
      const scene = activeScene();
      if (scene === null) return;
      resumeSpeed = sp;
      setSpeed(scene, sp);
      refreshSim();
    }),
  );
  const pauseButton = button(row1, 'Pause', () => {
    const scene = activeScene();
    if (scene === null) return;
    if (scene.simClock.speed === 0) {
      setSpeed(scene, resumeSpeed);
    } else {
      resumeSpeed = scene.simClock.speed;
      setSpeed(scene, 0);
    }
    refreshSim();
  });
  const stepButton = button(row1, 'Step', () => {
    const scene = activeScene();
    if (scene === null || scene.simClock.speed !== 0) return;
    scene.stepOnce();
    refreshSim();
  });

  const row2 = buttonRow(panel);
  const foodButton = button(row2, `+${ADD_FOOD} food`, () => {
    activeScene()?.debugMutate((s) => {
      // Drops pieces in the pen like full Farm bars, but at Math.random spots (debug is view-side), so
      // the game's seeded rng stream is untouched. No FoodDropped: the pieces still bounce in on bind.
      const r = innerFence(s);
      for (let i = 0; i < ADD_FOOD; i++) {
        createFoodPiece(s, r.left + Math.random() * (r.right - r.left), r.top + Math.random() * (r.bottom - r.top));
      }
    });
    refreshSim();
  });
  const breedingButton = button(row2, `+${ADD_FOOD} breeding`, () => {
    activeScene()?.debugMutate((s) => {
      // As +food: Math.random spots, so the seeded rng stream is untouched; the pieces bounce in on bind.
      const r = innerFence(s);
      for (let i = 0; i < ADD_FOOD; i++) {
        createBreedingPiece(s, r.left + Math.random() * (r.right - r.left), r.top + Math.random() * (r.bottom - r.top));
      }
    });
    refreshSim();
  });
  // Story 3.6: as the buttons above, in piles of ADD_PILE for the tick-time check.
  const foodPileButton = button(row2, `+${ADD_PILE} food`, () => {
    activeScene()?.debugMutate((s) => {
      const r = innerFence(s);
      for (let i = 0; i < ADD_PILE; i++) {
        createFoodPiece(s, r.left + Math.random() * (r.right - r.left), r.top + Math.random() * (r.bottom - r.top));
      }
    });
    refreshSim();
  });
  const breedingPileButton = button(row2, `+${ADD_PILE} breeding`, () => {
    activeScene()?.debugMutate((s) => {
      const r = innerFence(s);
      for (let i = 0; i < ADD_PILE; i++) {
        createBreedingPiece(s, r.left + Math.random() * (r.right - r.left), r.top + Math.random() * (r.bottom - r.top));
      }
    });
    refreshSim();
  });
  const sheepButton = button(row2, `+${ADD_SHEEP} sheep`, () => {
    activeScene()?.debugMutate(addSheep);
    refreshSim();
  });
  // Makes every adult pickable by the Breed tool (ready, off cooldown), for checking breed mode fast.
  const readyButton = button(row2, 'Ready adults', () => {
    activeScene()?.debugMutate((s) => {
      for (const sheep of s.sheep) {
        if (stageOf(sheep, s) !== 'adult') continue;
        sheep.breedReady = true;
        sheep.cooldownUntil = 0;
      }
    });
    refreshSim();
  });
  // Sheep starve 72 s into a new game; Feed all keeps them fed. It cannot stop old age: every sheep
  // dies by 540 s and added sheep 480 s after the click, so a long run needs births (Ready adults,
  // then the Breed tool) to go on.
  const feedButton = button(row2, 'Feed all', () => {
    activeScene()?.debugMutate((s) => {
      for (const sheep of s.sheep) sheep.fullness = TUNING.fullnessMax;
    });
    refreshSim();
  });
  // Story 2.4: a carcass at a Math.random spot in the pen (the seeded rng stream is untouched). No
  // event, so it flops in on bind without the dust puff.
  const carcassButton = button(row2, 'Spawn carcass', () => {
    activeScene()?.debugMutate((s) => {
      const r = innerFence(s);
      createCarcass(s, r.left + Math.random() * (r.right - r.left), r.top + Math.random() * (r.bottom - r.top));
    });
    refreshSim();
  });
  // Empties one random sheep, so the next tick starves it through the real pipeline: toast, carcass
  // and dust (and the loss, if it was the last). It also stops walking to food: a seeker that reached
  // its piece next tick would eat (feeding runs before hunger) and live. A new claim cannot eat until
  // the tick after, so the sheep is gone first.
  const starveButton = button(row2, 'Starve one', () => {
    activeScene()?.debugMutate((s) => {
      if (s.sheep.length === 0) return;
      const sheep = s.sheep[Math.floor(Math.random() * s.sheep.length)];
      sheep.fullness = 0;
      sheep.activity = 'wander';
      delete sheep.targetId;
      // Story 4.3: a stalk exists only while stalking.
      delete sheep.stalk;
    });
    refreshSim();
  });
  // Story 2.5: infects one random healthy sheep through the real helper (its Infected event is drained
  // with the next tick), for checking the tint, marker, wobble and the 20 s virus death quickly.
  const infectButton = button(row2, 'Infect one', () => {
    activeScene()?.debugMutate((s) => {
      const healthy = s.sheep.filter((x) => x.infectedAt === undefined);
      if (healthy.length === 0) return;
      infectSheep(s, healthy[Math.floor(Math.random() * healthy.length)]);
    });
    refreshSim();
  });
  // Story 2.8: starts (or resets) the food boost without a sacrifice, for checking the Farm glow, the
  // badge and the timer. No BoostStarted event, so the timer does not pop and no "×2" popup rises.
  const boostButton = button(row2, 'Boost', () => {
    activeScene()?.debugMutate((s) => {
      s.boostUntil = s.time + TUNING.boostMs;
    });
    refreshSim();
  });

  // Story 3.2: money for trying the shop. Adds to the balance only, not stats.moneyEarned (it was
  // never earned; validation allows that on purpose).
  const moneyButton = button(row2, `+${formatMoney(ADD_MONEY)}`, () => {
    activeScene()?.debugMutate((s) => {
      s.money += ADD_MONEY;
    });
    refreshSim();
  });

  // Story 4.1: the Abomination. Reveal rings the living one on the field (POST_RENDER below) until
  // toggled off; it keeps working with the panel closed.
  let reveal = false;
  let outline: Phaser.GameObjects.Graphics | null = null;
  // Reused every frame by syncOutline.
  const drawnAt = { x: 0, y: 0 };
  const abomRow = buttonRow(panel);
  const revealButton = button(abomRow, 'Reveal Abomination', () => {
    reveal = !reveal;
    highlight(revealButton, reveal);
    syncOutline();
  });
  // Makes a new lamb the Abomination, at a Math.random spot in the pen (as the +food buttons place
  // pieces), so the reveal can be checked without breeding 8–15 lambs. It is not a birth: birthsSeen is
  // untouched. At most one is alive, as in play, so if this one is still alive at the save's guaranteed
  // birth, that guarantee is used up (onBirth) and later births only roll the 5% chance. createSheep
  // draws its heading from the seeded rng, as "+10 sheep" does.
  const makeButton = button(abomRow, 'Make Abomination', () => {
    const scene = activeScene();
    if (scene === null) return;
    if (abominationAlive(scene.simState)) {
      setStatus('an Abomination is already alive');
      return;
    }
    scene.debugMutate((s) => {
      const r = innerFence(s);
      const lamb = createSheep(s, {
        x: Math.round(r.left + Math.random() * (r.right - r.left)),
        y: Math.round(r.top + Math.random() * (r.bottom - r.top)),
        bornAt: s.time,
      });
      // The one spawn path (Story 4.3): it also schedules the first visit, 45–60 s from now.
      makeAbomination(s, lamb);
    });
    setStatus('made an Abomination');
    refreshSim();
  });
  // Story 4.3: makes the living Abomination's next visit due now, so the cycle can be watched without
  // waiting 45–60 s. It starts on the first tick the Abomination is free (wandering).
  const killNowButton = button(abomRow, 'Kill now', () => {
    const scene = activeScene();
    if (scene === null) return;
    if (!abominationAlive(scene.simState)) {
      setStatus('no Abomination is alive');
      return;
    }
    // Mid-visit the next leave would overwrite it, so say so instead of claiming it is due.
    if (findAbomination(scene.simState)?.stalk !== undefined) {
      setStatus('a visit is already under way');
      return;
    }
    scene.debugMutate((s) => {
      s.abomination.nextKillAt = s.time;
    });
    setStatus('next visit is due now');
    refreshSim();
  });

  const row3 = buttonRow(panel);
  const dumpButton = button(row3, 'Dump state', () => {
    const scene = activeScene();
    if (scene === null) return;
    // A snapshot, so the console does not show a live object that changes later.
    log.debug('debug', 'GameState', JSON.parse(JSON.stringify(scene.simState)));
    setStatus('state dumped to console');
  });
  const copyButton = button(row3, 'Copy save', () => {
    void copySave();
  });
  const loadButton = button(row3, 'Load save', () => {
    void loadSave();
  });
  // Story 3.6: the milestones and the run's end state as text, for the story's Playtest Record.
  const resultsButton = button(row3, 'Copy results', () => {
    const scene = activeScene();
    if (scene === null) return;
    takeTicks(scene);
    const tick = { meanMs: tickSamples > 0 ? tickSum / tickSamples : 0, maxMs: tickMax, samples: tickSamples };
    void copyText(record.summary(scene.simState, tick, problems), 'results');
  });

  const row4 = buttonRow(panel);
  button(row4, 'Throw test error', () => {
    // Throws inside Phaser's loop, which would stop it for good without the safety-net watchdog.
    game.events.once(Phaser.Core.Events.POST_STEP, () => {
      throw new Error('debug probe: thrown in game loop');
    });
    setStatus('test error queued');
  });
  button(row4, 'Reject test promise', () => {
    void Promise.reject(new Error('debug probe: rejected promise'));
    setStatus('test rejection raised');
  });

  const simButtons = [
    ...speedButtons,
    pauseButton,
    foodButton,
    breedingButton,
    foodPileButton,
    breedingPileButton,
    sheepButton,
    readyButton,
    feedButton,
    carcassButton,
    starveButton,
    infectButton,
    boostButton,
    moneyButton,
    revealButton,
    makeButton,
    killNowButton,
    dumpButton,
    copyButton,
    loadButton,
    resultsButton,
  ];

  // Milestones stamp at the exact tick: GameScene forwards each tick's events on the bus straight after
  // it, while simState.time is that tick's time. Subscribed once for the page, like POST_RENDER below.
  bus.on('sim', (e) => {
    const scene = activeScene();
    if (scene === null) return;
    // Runs inside GameScene's tick (the bus is drained there): a record bug must not drop sim ticks.
    try {
      record.onEvent(e, scene.simState);
    } catch (err) {
      setStatus(`playtest record error: ${String(err)}`);
    }
  });

  (document.getElementById('game-container') ?? document.body).appendChild(panel);

  window.addEventListener('keydown', (e) => {
    if (e.code !== 'Backquote' || e.repeat) return;
    visible = !visible;
    panel.style.display = visible ? 'block' : 'none';
    if (!visible) return;
    // A fresh frame-time window, so time spent hidden does not count.
    resetWindow();
    lastRefresh = performance.now();
    fpsLine.textContent = `FPS    ${Math.round(game.loop.actualFps)}`;
    frameLine.textContent = 'frame  —';
    refreshSim();
  });

  // One handler for the page lifetime; game.events belongs to the game, so a GameScene restart
  // does not register it twice.
  game.events.on(Phaser.Core.Events.POST_RENDER, () => {
    const scene = activeScene();
    if (scene !== null && scene.simClock !== knownClock) {
      knownClock = scene.simClock;
      knownClock.speed = wantSpeed;
    }
    // Story 3.6: the record and the tick totals follow the game with the overlay closed too (Rylan plays
    // with it closed), on the same cadence as the readout.
    const now = performance.now();
    if (scene !== null && now - lastRecord >= REFRESH_MS) {
      lastRecord = now;
      try {
        record.sync(scene.simState);
      } catch (err) {
        setStatus(`playtest record error: ${String(err)}`);
      }
      takeTicks(scene);
    }
    // Every frame, so the ring follows the drawn sprite (and the panned camera, as a world object).
    syncOutline();
    if (!visible) return;
    const d = game.loop.rawDelta;
    sum += d;
    count++;
    if (d > max) max = d;
    if (performance.now() - lastRefresh >= REFRESH_MS) {
      refreshPerf();
      refreshSim();
    }
  });

  /** Moves the scene's tick times into the page totals and the latest window. */
  function takeTicks(scene: GameScene): void {
    const t = scene.takeTickStats();
    if (t.count === 0) return;
    windowTick = t;
    tickSum += t.meanMs * t.count;
    tickSamples += t.count;
    if (t.maxMs > tickMax) tickMax = t.maxMs;
  }

  function activeScene(): GameScene | null {
    const scene = game.scene.getScene('GameScene') as GameScene | null;
    return scene !== null && scene.sys.isActive() ? scene : null;
  }

  // FPS and the frame-time window: written only from POST_RENDER, every REFRESH_MS.
  function refreshPerf(): void {
    lastRefresh = performance.now();
    fpsLine.textContent = `FPS    ${Math.round(game.loop.actualFps)}`;
    frameLine.textContent =
      count > 0 ? `frame  ${(sum / count).toFixed(1)} ms avg · ${max.toFixed(1)} max` : 'frame  —';
    resetWindow();
  }

  // Sim readout and button states: also written straight after each button press.
  function refreshSim(): void {
    const scene = activeScene();
    for (const b of simButtons) b.disabled = scene === null;
    if (scene === null) {
      timeLine.textContent = 'time   —';
      sheepLine.textContent = 'sheep  —';
      abomLine.textContent = 'abom   —';
      foodLine.textContent = 'food   —';
      stepButton.disabled = true;
      return;
    }
    const s = scene.simState;
    const speed = scene.simClock.speed;
    timeLine.textContent = `time   ${formatGameTime(s.time)} (${s.time} ms) · ${speed === 0 ? 'paused' : `×${speed}`}`;
    // Story 3.1: the balance and sales; 3.2: how many shop items are owned.
    sheepLine.textContent = `sheep  ${s.sheep.length} · carcasses ${s.carcasses.length} · infected ${countInfected(s)} · ${formatMoney(s.money)} · sold ${s.stats.sold} · owned ${s.owned.length} · era ${currentEra(s)}`;
    // Story 4.1: which sheep is the Abomination, and the birth count against the guaranteed birth.
    // Story 4.3: its visit (phase → victim, time left in the phase), the next visit and the doomed sheep.
    const abom = findAbomination(s);
    const st = abom?.stalk;
    const visit = st === undefined ? 'idle' : `stalk ${st.phase}→#${st.victimId} ${seconds(st.until - s.time)}`;
    const next = abom === null ? '' : ` · ${visit} · next kill ${seconds(s.abomination.nextKillAt - s.time)}`;
    abomLine.textContent = `abom   ${abom === null ? 'none' : `#${abom.id}`}${next} · births ${s.abomination.birthsSeen}/${s.abomination.guaranteedAtBirth}${doomedText(s)}`;
    foodLine.textContent = `food   pieces ${s.foodPieces.length} · bar ${s.farmProgress}/${TUNING.farmPipsPerFood} · boost ${formatGameTime(boostRemainingMs(s))}`;
    // Story 3.6: the latest window's sim tick times (NFR1 budget 2 ms) and the page's worst.
    tickLine.textContent = `tick   ${windowTick.meanMs.toFixed(2)} ms avg · ${windowTick.maxMs.toFixed(2)} max · worst ${tickMax.toFixed(2)}`;
    [paceLine.textContent, firstLine.textContent] = record.lines();
    problemLine.textContent = `warn   ${problems} console warnings/errors since the overlay started`;
    problemLine.style.color = problems > 0 ? COLORS.alert : '';
    pauseButton.textContent = speed === 0 ? 'Resume' : 'Pause';
    stepButton.disabled = speed !== 0;
    for (let i = 0; i < SPEEDS.length; i++) highlight(speedButtons[i], speed === SPEEDS[i]);
  }

  // Applies the chosen speed to a scene's clock. Also runs on CREATE after a Load, before that
  // scene's first update, so a debug-paused game stays paused from its first frame.
  function applyWantSpeed(scene: GameScene): void {
    knownClock = scene.simClock;
    knownClock.speed = wantSpeed;
  }

  function setSpeed(scene: GameScene, speed: number): void {
    wantSpeed = speed;
    knownClock = scene.simClock;
    knownClock.speed = speed;
  }

  /**
   * Places the Reveal ring on the living Abomination's drawn sprite, or hides it. The ring is drawn
   * once per GameScene and only moved after that. A scene restart (Load, New Game, Restart) destroys
   * it with the scene's other objects, and a new one is drawn in the new scene.
   */
  function syncOutline(): void {
    const scene = activeScene();
    const target = reveal && scene !== null && scene.simState.lostAt === undefined ? findAbomination(scene.simState) : null;
    if (scene === null || target === null) {
      if (outline !== null && outline.active) outline.setVisible(false);
      return;
    }
    if (outline === null || !outline.active || outline.scene !== scene) {
      outline = scene.add.graphics();
      outline.lineStyle(OUTLINE_WIDTH, COLOR_INT.alert);
      outline.strokeCircle(0, 0, OUTLINE_RADIUS);
      outline.setDepth(FIELD_DEPTH.overlay);
    }
    const at = scene.debugSheepDrawnAt(target.id, drawnAt) ?? target;
    outline.setPosition(at.x, at.y).setVisible(true);
  }

  function resetWindow(): void {
    sum = 0;
    count = 0;
    max = 0;
  }

  function setStatus(text: string): void {
    statusLine.textContent = text;
  }

  async function copySave(): Promise<void> {
    const scene = activeScene();
    if (scene === null) return;
    await copyText(encodeSave(scene.simState as GameState), 'save');
  }

  async function copyText(text: string, what: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      setStatus(`${what} copied`);
    } catch (err) {
      // No Clipboard API (insecure context, e.g. `vite --host` over a LAN IP) or the write was
      // refused (document not focused): hand the text over in a prompt to copy by hand.
      ownWarning = true;
      try {
        log.warn('debug', 'Clipboard write failed; showing the text in a prompt', err);
      } finally {
        ownWarning = false;
      }
      window.prompt(`Copy the ${what} (Ctrl+C):`, text);
      setStatus(`${what} shown in prompt`);
    }
  }

  async function loadSave(): Promise<void> {
    if (activeScene() === null) return;
    const raw = await readClipboard();
    if (raw === null) {
      setStatus('load cancelled');
      return;
    }
    const state = decodeSave(raw);
    if (state === null) {
      log.warn('debug', 'Clipboard text is not a valid save');
      setStatus('invalid save');
      return;
    }
    // Resolved again after the await: a prompt or permission dialog can outlast the scene.
    const scene = activeScene();
    if (scene === null) {
      setStatus('load failed: game not running');
      return;
    }
    scene.events.once(Phaser.Scenes.Events.CREATE, applyWantSpeed);
    if (!scene.loadState(state)) {
      scene.events.off(Phaser.Scenes.Events.CREATE, applyWantSpeed);
      setStatus('invalid save');
      return;
    }
    setStatus('save loaded');
  }
}

async function readClipboard(): Promise<string | null> {
  try {
    if (typeof navigator.clipboard?.readText === 'function') return await navigator.clipboard.readText();
  } catch (err) {
    // Permission denied, or Firefox's paste prompt dismissed.
    log.warn('debug', 'Clipboard read failed; asking instead', err);
  }
  return window.prompt('Paste save JSON');
}

// Same placement as the fillFlock test helper: rng positions inside the inset fence, adults aged
// like the founding flock. Goes through createSheep, so the sheep are ordinary sim sheep.
function addSheep(s: GameState): void {
  const f = fenceBounds(s);
  const inset = TUNING.fenceInset;
  for (let i = 0; i < ADD_SHEEP; i++) {
    createSheep(s, {
      x: rngRange(s, f.x + inset, f.x + f.width - inset),
      y: rngRange(s, f.y + inset, f.y + f.height - inset),
      bornAt: s.time - TUNING.startAdultAgeMs,
    });
  }
}

function line(parent: HTMLElement): HTMLDivElement {
  const el = document.createElement('div');
  parent.appendChild(el);
  return el;
}

function buttonRow(parent: HTMLElement): HTMLDivElement {
  const el = document.createElement('div');
  el.style.display = 'flex';
  el.style.flexWrap = 'wrap';
  el.style.gap = `${SPACING[1]}px`;
  el.style.marginTop = `${SPACING[1]}px`;
  parent.appendChild(el);
  return el;
}

function button(parent: HTMLElement, label: string, onClick: () => void): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = label;
  // Never takes focus, so a later Space or Enter cannot re-fire the last debug action.
  b.tabIndex = -1;
  b.addEventListener('mousedown', preventFocus);
  const s = b.style;
  s.font = 'inherit';
  s.padding = `2px ${SPACING[2]}px`;
  s.borderRadius = `${RADIUS.sm}px`;
  s.border = `1px solid ${COLORS.barkSoft}`;
  s.cursor = 'pointer';
  highlight(b, false);
  b.addEventListener('click', onClick);
  parent.appendChild(b);
  return b;
}

function preventFocus(e: MouseEvent): void {
  e.preventDefault();
}

function highlight(b: HTMLButtonElement, on: boolean): void {
  b.style.backgroundColor = on ? COLORS.hay : COLORS.dusk;
  b.style.color = on ? COLORS.bark : COLORS.wool;
}

/** Game-ms as "12.3s" (negative when past due). */
function seconds(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}

/** " · doomed #5 in 6.2s" for each doomed sheep (Story 4.3), or "". */
function doomedText(s: Readonly<GameState>): string {
  let out = '';
  for (const sheep of s.sheep) if (sheep.doomedAt !== undefined) out += ` · doomed #${sheep.id} in ${seconds(sheep.doomedAt - s.time)}`;
  return out;
}

/** The living Abomination, or null (at most one is alive). */
function findAbomination(s: Readonly<GameState>): Sheep | null {
  for (const sheep of s.sheep) if (sheep.isAbomination) return sheep;
  return null;
}

/** Infected sheep, for the counts line (refreshed every REFRESH_MS, not per frame). */
function countInfected(s: Readonly<GameState>): number {
  let n = 0;
  for (const sheep of s.sheep) if (sheep.infectedAt !== undefined) n++;
  return n;
}
