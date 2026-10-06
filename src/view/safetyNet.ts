// Global error safety net (architecture Error Handling, "Unhandled"): every uncaught error or
// rejection is logged once via log.error, the player sees a short toast instead of a stack trace,
// and the game keeps running.
//
// Phaser's RequestAnimationFrame.step calls the game loop *before* it requests the next frame, so a
// throw anywhere inside a frame ends the loop for good. After each reported error a watchdog checks
// that frames still advance and restarts the loop if they stopped.
//
// The toast is a DOM element, not a Phaser object: it must work before any scene exists, without
// HudScene, and when the renderer itself is what broke.
import type Phaser from 'phaser';
import { COMPONENTS, COLORS, RADIUS, SPACING, TYPOGRAPHY } from '../config/constants';
import { log, type LogTag } from '../core/log';
import { STRINGS } from './strings';

// EXPERIENCE.md: announcement toasts last about 4 s.
const TOAST_MS = 4_000;
// At most one error toast, and one "repeated" log line per message, per this window.
const ERROR_TOAST_COOLDOWN_MS = 10_000;
const REPEAT_SUMMARY_MS = 10_000;
// How long after an error the loop must have produced a frame.
const WATCHDOG_MS = 250;
// Bounds the dedupe table if every error message is unique (e.g. contains a counter).
const MAX_TRACKED_MESSAGES = 50;

interface Seen {
  suppressed: number;
  lastLoggedAt: number;
}

let container: HTMLElement | null = null;
let game: Phaser.Game | null = null;
let installed = false;
let toastEl: HTMLDivElement | null = null;
let toastTimer: ReturnType<typeof setTimeout> | undefined;
let lastErrorToastAt = Number.NEGATIVE_INFINITY;
let watchdogPending = false;
const seen = new Map<string, Seen>();

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

/** Entry point for caught errors that should be treated like unhandled ones. Never throws. */
export function reportError(source: LogTag, err: unknown): void {
  try {
    logOnce(source, err);
    // Story 1.9: forceSave() here, inside its own try/catch, before the toast claims the flock was saved.
    const now = performance.now();
    if (now - lastErrorToastAt >= ERROR_TOAST_COOLDOWN_MS) {
      lastErrorToastAt = now;
      showToast(STRINGS.errorToast);
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

/** Shows a short top-centre toast that never blocks clicks. Replaces any toast already showing. */
export function showToast(text: string): void {
  const el = toastEl ?? createToast();
  el.textContent = text;
  placeToast(el);
  el.style.display = 'block';
  if (toastTimer !== undefined) clearTimeout(toastTimer);
  toastTimer = setTimeout(hideToast, TOAST_MS);
}

function onWindowError(event: Event): void {
  // Resource load failures (img/script elements) also fire 'error' but are not script errors.
  if (!(event instanceof ErrorEvent)) return;
  event.preventDefault();
  reportError('ui', event.error ?? event.message);
}

function onUnhandledRejection(event: PromiseRejectionEvent): void {
  event.preventDefault();
  reportError('ui', event.reason);
}

function describe(err: unknown): string {
  if (err instanceof Error) return `${err.name}: ${err.message}`;
  try {
    return String(err);
  } catch {
    return 'Unprintable error';
  }
}

// The first occurrence of each message is logged in full (with the Error, so DEV keeps the stack);
// repeats are counted and summarised at most every REPEAT_SUMMARY_MS.
function logOnce(source: LogTag, err: unknown): void {
  const message = describe(err);
  const key = `${source}|${message}`;
  const now = performance.now();
  const entry = seen.get(key);
  if (entry === undefined) {
    if (seen.size >= MAX_TRACKED_MESSAGES) seen.clear();
    seen.set(key, { suppressed: 0, lastLoggedAt: now });
    log.error(source, `Unhandled error: ${message}`, err);
    return;
  }
  entry.suppressed++;
  if (now - entry.lastLoggedAt >= REPEAT_SUMMARY_MS) {
    log.error(source, `Repeated ${entry.suppressed}×: ${message}`);
    entry.suppressed = 0;
    entry.lastLoggedAt = now;
  }
}

function scheduleWatchdog(): void {
  const g = game;
  if (g === null || watchdogPending) return;
  watchdogPending = true;
  const frameAtError = g.loop.frame;
  setTimeout(() => {
    watchdogPending = false;
    // Hidden tabs get no rAF callbacks, so a still frame counter means nothing there.
    if (document.hidden || !g.loop.running || g.loop.frame !== frameAtError) return;
    log.warn('ui', 'Game loop restarted after error');
    try {
      g.loop.sleep();
      // wake() runs one frame synchronously; a throw there is reported like any other.
      g.loop.wake(true);
    } catch (err) {
      reportError('ui', err);
    }
  }, WATCHDOG_MS);
}

function createToast(): HTMLDivElement {
  const spec = COMPONENTS.announcementToast;
  const type = TYPOGRAPHY[spec.typography];
  const el = document.createElement('div');
  el.setAttribute('role', 'status');
  const s = el.style;
  s.position = 'fixed';
  s.left = '50%';
  s.transform = 'translateX(-50%)';
  s.zIndex = '1000';
  s.pointerEvents = 'none';
  s.display = 'none';
  s.maxWidth = '80vw';
  s.padding = `${SPACING[2]}px ${SPACING[4]}px`;
  s.borderRadius = `${RADIUS[spec.rounded]}px`;
  s.backgroundColor = COLORS[spec.backgroundColor];
  s.color = COLORS[spec.textColor];
  s.font = `${type.fontWeight} ${type.fontSize}px/${type.lineHeight} "${type.fontFamily}", sans-serif`;
  s.textAlign = 'center';
  (container ?? document.body).appendChild(el);
  toastEl = el;
  return el;
}

// Top-centre of the canvas (DESIGN.md layout), below its top edge by the 16 px safe margin.
function placeToast(el: HTMLDivElement): void {
  const top = game?.canvas?.getBoundingClientRect().top ?? 0;
  el.style.top = `${Math.max(0, top) + SPACING[4]}px`;
}

function hideToast(): void {
  toastTimer = undefined;
  if (toastEl !== null) toastEl.style.display = 'none';
}
