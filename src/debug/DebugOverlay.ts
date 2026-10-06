// DEV-only debug overlay (architecture Debug Tools, AR15). Loaded by main.ts through a dynamic
// import behind `import.meta.env.DEV`, so production builds never contain it.
//
// A DOM panel, not a Phaser scene: buttons need no atlas frames or font metrics, clicks never reach
// the canvas or the gameplay InputController, and a real button click is the user gesture the
// Clipboard API needs. Backtick toggles it.
//
// Later stories add their buttons here: Spawn carcass (2.4), Infect sheep (2.5), Add money (3.2),
// Reveal Abomination (4.1). src/debug/ is the only non-sim code allowed to read isAbomination.
import Phaser from 'phaser';
import { COLORS, RADIUS, SPACING } from '../config/constants';
import { TUNING } from '../config/tuning';
import type { FixedStepClock } from '../core/fixedStep';
import { formatGameTime } from '../core/format';
import { log } from '../core/log';
import { decodeSave, encodeSave } from '../save/saveFile';
import { rngRange } from '../sim/rng';
import { fenceBounds } from '../sim/selectors';
import { createSheep, type GameState } from '../sim/state';
import type { GameScene } from '../view/scenes/GameScene';

const SPEEDS = [1, 4, 16] as const;
// DOM text is rewritten at most this often, so the overlay barely affects the FPS it reports.
const REFRESH_MS = 250;
const ADD_FOOD = 5;
const ADD_SHEEP = 10;

export function installDebugOverlay(game: Phaser.Game): void {
  let visible = false;
  // The speed the developer chose (0 = paused) and the one to restore on Resume. Debug pause is
  // clock.speed = 0. Story 1.10's gameplay pause stops accumulation its own way and must not reset
  // these speeds.
  let wantSpeed = 1;
  let resumeSpeed = 1;
  // A GameScene restart (Load save) builds a new clock at ×1; the chosen speed is re-applied to it.
  let knownClock: FixedStepClock | null = null;

  // Frame-time window, sampled every frame by one bound handler.
  let sum = 0;
  let count = 0;
  let max = 0;
  let lastRefresh = 0;

  const panel = document.createElement('div');
  const ps = panel.style;
  ps.position = 'fixed';
  ps.top = `${SPACING[2]}px`;
  ps.left = `${SPACING[2]}px`;
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
  const foodLine = line(lines);
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
      // Respects the cap, so a debug session never makes a state the sim could not.
      s.food = Math.min(TUNING.foodCap, s.food + ADD_FOOD);
    });
    refreshSim();
  });
  const sheepButton = button(row2, `+${ADD_SHEEP} sheep`, () => {
    activeScene()?.debugMutate(addSheep);
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

  const simButtons = [...speedButtons, pauseButton, foodButton, sheepButton, dumpButton, copyButton, loadButton];

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
      foodLine.textContent = 'food   —';
      stepButton.disabled = true;
      return;
    }
    const s = scene.simState;
    const speed = scene.simClock.speed;
    timeLine.textContent = `time   ${formatGameTime(s.time)} (${s.time} ms) · ${speed === 0 ? 'paused' : `×${speed}`}`;
    sheepLine.textContent = `sheep  ${s.sheep.length} · carcasses ${s.carcasses.length}`;
    foodLine.textContent = `food   ${s.food}/${TUNING.foodCap} · pieces ${s.foodPieces.length}`;
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
    const text = encodeSave(scene.simState as GameState);
    try {
      await navigator.clipboard.writeText(text);
      setStatus('save copied');
    } catch (err) {
      // No Clipboard API (insecure context, e.g. `vite --host` over a LAN IP) or the write was
      // refused (document not focused): hand the text over in a prompt to copy by hand.
      log.warn('debug', 'Clipboard write failed; showing the save in a prompt', err);
      window.prompt('Copy the save JSON (Ctrl+C):', text);
      setStatus('save shown in prompt');
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
  if (s.sheep.length > s.stats.peakFlock) s.stats.peakFlock = s.sheep.length;
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
