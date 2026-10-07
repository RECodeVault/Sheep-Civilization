// Global error safety net (architecture Error Handling, "Unhandled"): every uncaught error or
// rejection is logged once via log.error, the player sees a short toast instead of a stack trace,
// and the game keeps running.
//
// Phaser's RequestAnimationFrame.step calls the game loop *before* it requests the next frame, so a
// throw anywhere inside a frame ends the loop for good. After each reported error a watchdog checks
// that frames still advance and restarts the loop if they stopped.
//
// Toasts are DOM elements, not Phaser objects: they must work before any scene exists, without
// HudScene, and when the renderer itself is what broke.
import type Phaser from 'phaser';
import { COMPONENTS, COLORS, RADIUS, SPACING, TYPOGRAPHY } from '../config/constants';
import { log, type LogTag } from '../core/log';
import { blockSaving } from '../save/saveStore';
import { STRINGS } from './strings';

// EXPERIENCE.md: announcement toasts last about 4 s; up to 3 stack, newest on top.
const TOAST_MS = 4_000;
const MAX_TOASTS = 3;
// At most one error toast, and one "repeated" log line per message, per this window.
const ERROR_TOAST_COOLDOWN_MS = 10_000;
const REPEAT_SUMMARY_MS = 10_000;
// The watchdog compares frame counts this far apart; a loop is restarted only after two stalled
// checks in a row, so one long main-thread block (a prompt, a GC pause) is not mistaken for a stall.
const WATCHDOG_MS = 250;
const STALLED_CHECKS = 2;
// Each restart that does not lead to a healthy loop doubles the wait, up to 2^5 × 250 ms = 8 s.
const MAX_BACKOFF_SHIFT = 5;
// Bounds the dedupe table if every error message is unique (e.g. contains a counter).
const MAX_TRACKED_MESSAGES = 50;

interface Seen {
  readonly level: 'error' | 'warn';
  readonly tag: LogTag;
  readonly message: string;
  suppressed: number;
  timer: ReturnType<typeof setTimeout> | undefined;
}

let container: HTMLElement | null = null;
let game: Phaser.Game | null = null;
let installed = false;
let gameStarted = false;
// Set by GameScene while a game runs: writes the save (validated first) before the error toast and
// returns whether it was written.
let forceSave: (() => boolean) | null = null;
let toastStack: HTMLDivElement | null = null;
let lastErrorToastAt = Number.NEGATIVE_INFINITY;
const seen = new Map<string, Seen>();

// Watchdog state. `watchFrame` is the loop frame at the latest error (-1 = take a fresh snapshot).
let watchTimer: ReturnType<typeof setTimeout> | undefined;
let watchFrame = -1;
let stalledChecks = 0;
let failedRestarts = 0;

/** Installs the window handlers. Call first in main.ts, before fonts load, so boot errors are caught. */
export function installSafetyNet(host: HTMLElement | null): void {
  container = host;
  if (installed) return;
  installed = true;
  window.addEventListener('error', onWindowError);
  window.addEventListener('unhandledrejection', onUnhandledRejection);
}

/** Gives the safety net the game, so the loop watchdog and toast placement can use it. */
export function attachGame(g: Phaser.Game): void {
  game = g;
}

/**
 * Called when GameScene starts. Before that there is no flock, so errors show the boot toast
 * instead of claiming the flock was saved.
 */
export function markGameStarted(): void {
  gameStarted = true;
}

/** GameScene registers its save here on create and clears it on shutdown. */
export function setForceSave(fn: (() => boolean) | null): void {
  forceSave = fn;
}

/** Entry point for caught errors that should be treated like unhandled ones. Never throws. */
export function reportError(source: LogTag, err: unknown): void {
  try {
    logDeduped('error', source, `Unhandled error: ${describe(err)}`, err);
    // A sim error may leave a state that is valid yet throws every tick. Saving it would replace the
    // last good save with one the next boot rejects, so stop saving for this game (1.9 review).
    if (source === 'sim') blockSaving('the game hit an error');
    const now = performance.now();
    if (now - lastErrorToastAt >= ERROR_TOAST_COOLDOWN_MS) {
      lastErrorToastAt = now;
      // Before the toast, and on its cooldown: an error repeating every frame must not serialise the
      // game every frame. Never via reportError (it would recurse). The toast says the flock was saved
      // only when it was; otherwise reloading resumes the last good save.
      let saved = false;
      if (gameStarted && forceSave !== null) {
        try {
          saved = forceSave();
        } catch (saveErr) {
          console.error('[save] Forced save failed', saveErr);
        }
      }
      showToast(saved ? STRINGS.errorToast : STRINGS.bootErrorToast);
    }
    scheduleWatchdog();
  } catch (inner) {
    try {
      console.error('[ui] Safety net failed', inner, err);
    } catch {
      // Nothing left to report to.
    }
  }
}

/**
 * Wraps a handler Phaser calls from its own step (button, key, tween or timer callbacks), where a
 * throw would stop the game loop: errors are reported as `ui` instead.
 */
export function guarded<A extends unknown[]>(fn: (...args: A) => void): (...args: A) => void {
  return (...args: A) => {
    try {
      fn(...args);
    } catch (err) {
      reportError('ui', err);
    }
  };
}

/**
 * Shows a short top-centre toast that never blocks clicks. Up to 3 stack, newest on top. A message
 * toast (errors, notices) that is already up moves to the top and restarts its timer instead of
 * duplicating. An `announcement` (a death) always adds a new toast, and a full stack drops its oldest
 * announcement first, so a burst of deaths never pushes an error off before it can be read.
 */
export function showToast(text: string, { announcement = false }: { announcement?: boolean } = {}): void {
  const stack = toastStack ?? createStack();
  placeStack(stack);
  let el: HTMLDivElement | null = null;
  if (!announcement) {
    for (const child of Array.from(stack.children)) {
      if (child.textContent === text) el = child as HTMLDivElement;
    }
  }
  if (el === null) {
    el = createToast(text);
    if (announcement) el.dataset.announcement = '1';
    while (stack.children.length >= MAX_TOASTS) removeToast(oldestToEvict(stack));
  }
  stack.prepend(el);
  const timer = Number(el.dataset.timer);
  if (timer) clearTimeout(timer);
  const toast = el;
  el.dataset.timer = String(setTimeout(() => toast.remove(), TOAST_MS));
}

/** Removes every announcement toast (a new game starts: the last game's deaths are not news). */
export function clearAnnouncements(): void {
  if (toastStack === null) return;
  for (const child of Array.from(toastStack.children)) {
    if ((child as HTMLElement).dataset.announcement === '1') removeToast(child as HTMLDivElement);
  }
}

/** The oldest announcement, or the oldest toast when there is none. The stack is newest-first. */
function oldestToEvict(stack: HTMLDivElement): HTMLDivElement {
  for (let i = stack.children.length - 1; i >= 0; i--) {
    const child = stack.children[i] as HTMLDivElement;
    if (child.dataset.announcement === '1') return child;
  }
  return stack.lastElementChild as HTMLDivElement;
}

function removeToast(el: HTMLDivElement): void {
  const timer = Number(el.dataset.timer);
  if (timer) clearTimeout(timer);
  el.remove();
}

function onWindowError(event: Event): void {
  // Resource load failures (img/script elements) also fire 'error' but are not script errors.
  if (!(event instanceof ErrorEvent)) return;
  if (isForeign(event)) {
    // Browser extensions and cross-origin scripts are not the game: no toast, no watchdog.
    logDeduped('warn', 'ui', `Ignored error from outside the game: ${event.message}`, event.filename);
    return;
  }
  event.preventDefault();
  reportError('ui', event.error ?? event.message);
}

function onUnhandledRejection(event: PromiseRejectionEvent): void {
  event.preventDefault();
  reportError('ui', event.reason);
}

// Cross-origin script errors arrive sanitised ("Script error.", no error object); extension errors
// carry a chrome-extension:// or moz-extension:// filename. The game's own code is same-origin.
function isForeign(event: ErrorEvent): boolean {
  if (event.error == null && event.message === 'Script error.') return true;
  if (!event.filename) return false;
  try {
    return new URL(event.filename, location.href).origin !== location.origin;
  } catch {
    return false;
  }
}

function describe(err: unknown): string {
  if (err instanceof Error) return `${err.name}: ${err.message}`;
  try {
    return String(err);
  } catch {
    return 'Unprintable error';
  }
}

// The first occurrence of each message is logged in full (with the data, so DEV keeps the stack).
// Repeats within REPEAT_SUMMARY_MS are counted and logged as one summary line when the window ends.
function logDeduped(level: 'error' | 'warn', tag: LogTag, message: string, data?: unknown): void {
  const key = `${level}|${tag}|${message}`;
  const entry = seen.get(key);
  if (entry !== undefined) {
    entry.suppressed++;
    if (entry.timer === undefined) entry.timer = setTimeout(flushRepeats, REPEAT_SUMMARY_MS, entry);
    return;
  }
  if (seen.size >= MAX_TRACKED_MESSAGES) {
    for (const e of seen.values()) flushRepeats(e);
    seen.clear();
  }
  seen.set(key, { level, tag, message, suppressed: 0, timer: undefined });
  log[level](tag, message, data);
}

function flushRepeats(entry: Seen): void {
  if (entry.timer !== undefined) clearTimeout(entry.timer);
  entry.timer = undefined;
  if (entry.suppressed === 0) return;
  log[entry.level](entry.tag, `Repeated ${entry.suppressed}×: ${entry.message}`);
  entry.suppressed = 0;
}

// Re-armed by every error: the check always compares against the frame at the latest error, so a
// loop-killing error right after a harmless one is still caught.
function scheduleWatchdog(): void {
  if (game === null) return;
  watchFrame = game.loop.frame;
  stalledChecks = 0;
  if (watchTimer === undefined) watchTimer = setTimeout(checkLoop, WATCHDOG_MS << Math.min(failedRestarts, MAX_BACKOFF_SHIFT));
}

function checkLoop(): void {
  watchTimer = undefined;
  const g = game;
  // A loop that was stopped on purpose (game destroyed) is not ours to restart.
  if (g === null || !g.loop.running) return;
  if (document.hidden) {
    // Hidden tabs get no rAF callbacks, so a still counter means nothing. Keep watching, and take a
    // fresh snapshot once the tab is visible again (Phaser's onVisible never restarts a dead loop).
    watchFrame = -1;
    watchTimer = setTimeout(checkLoop, WATCHDOG_MS);
    return;
  }
  const frame = g.loop.frame;
  if (watchFrame === -1) {
    watchFrame = frame;
    stalledChecks = 0;
    watchTimer = setTimeout(checkLoop, WATCHDOG_MS);
    return;
  }
  if (frame !== watchFrame) {
    // Healthy: frames advance again.
    failedRestarts = 0;
    return;
  }
  if (++stalledChecks < STALLED_CHECKS) {
    watchTimer = setTimeout(checkLoop, WATCHDOG_MS);
    return;
  }
  failedRestarts++;
  logDeduped('warn', 'ui', 'Game loop restarted after error');
  try {
    g.loop.sleep();
    // wake() runs one frame synchronously; a throw there is reported (and re-arms the watchdog).
    g.loop.wake(true);
  } catch (err) {
    reportError('ui', err);
  }
  // If wake() succeeded but a later frame kills the loop again, the next error re-arms the watchdog.
  // Until a check sees frames advance, failedRestarts keeps the backoff growing.
  if (watchTimer === undefined) {
    watchFrame = g.loop.frame;
    stalledChecks = 0;
    watchTimer = setTimeout(checkLoop, WATCHDOG_MS << Math.min(failedRestarts, MAX_BACKOFF_SHIFT));
  }
}

function createStack(): HTMLDivElement {
  const el = document.createElement('div');
  const s = el.style;
  s.position = 'fixed';
  s.left = '50%';
  s.transform = 'translateX(-50%)';
  s.zIndex = '1000';
  s.pointerEvents = 'none';
  s.display = 'flex';
  s.flexDirection = 'column';
  s.alignItems = 'center';
  s.gap = `${SPACING[2]}px`;
  s.maxWidth = '80vw';
  (container ?? document.body).appendChild(el);
  toastStack = el;
  return el;
}

function createToast(text: string): HTMLDivElement {
  const spec = COMPONENTS.announcementToast;
  const type = TYPOGRAPHY[spec.typography];
  const el = document.createElement('div');
  el.setAttribute('role', 'status');
  const s = el.style;
  s.padding = `${SPACING[2]}px ${SPACING[4]}px`;
  s.borderRadius = `${RADIUS[spec.rounded]}px`;
  s.backgroundColor = COLORS[spec.backgroundColor];
  s.color = COLORS[spec.textColor];
  s.font = `${type.fontWeight} ${type.fontSize}px/${type.lineHeight} "${type.fontFamily}", sans-serif`;
  s.textAlign = 'center';
  el.textContent = text;
  return el;
}

// Top-centre of the canvas (DESIGN.md layout), below its top edge by the 16 px safe margin.
function placeStack(stack: HTMLDivElement): void {
  const top = game?.canvas?.getBoundingClientRect().top ?? 0;
  stack.style.top = `${Math.max(0, top) + SPACING[4]}px`;
}
