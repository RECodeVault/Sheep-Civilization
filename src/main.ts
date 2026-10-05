import Phaser from 'phaser';
import { CANVAS_HEIGHT, CANVAS_WIDTH, COLORS, FONT_FAMILIES } from './config/constants';
import { log } from './core/log';
import { BootScene } from './view/scenes/BootScene';

const CONTAINER_ID = 'game-container';

// Self-hosted variable WOFF2 files; relative URLs so the build works under any subpath.
const FONT_FACES = [
  { family: FONT_FAMILIES.pixel, url: './assets/fonts/pixelify-sans.woff2', weight: '400 700' },
  { family: FONT_FAMILIES.body, url: './assets/fonts/nunito.woff2', weight: '200 900' },
] as const;

// A stalled font request must not hold the boot hostage (load budget is < 5 s).
const FONT_TIMEOUT_MS = 3000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timed out after ${ms} ms`)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err: unknown) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

// Fonts must be ready before any Text is created, or Phaser caches fallback metrics.
// Each face loads independently: one failure or stall falls back for that family only.
async function loadFonts(): Promise<void> {
  await Promise.all(
    FONT_FACES.map(async (f) => {
      try {
        const face = new FontFace(f.family, `url(${f.url}) format('woff2')`, { weight: f.weight });
        document.fonts.add(await withTimeout(face.load(), FONT_TIMEOUT_MS));
      } catch (err) {
        log.warn('boot', `Font load failed for ${f.family}; using fallback`, err);
      }
    }),
  );
}

async function start(): Promise<void> {
  document.body.style.backgroundColor = COLORS.duskDeep;
  document.getElementById(CONTAINER_ID)?.style.setProperty('background-color', COLORS.duskDeep);

  await loadFonts();

  new Phaser.Game({
    type: Phaser.AUTO,
    width: CANVAS_WIDTH,
    height: CANVAS_HEIGHT,
    parent: CONTAINER_ID,
    backgroundColor: COLORS.dusk,
    pixelArt: true,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    scene: [BootScene],
  });
}

start().catch((err: unknown) => log.error('boot', 'Startup failed', err));
