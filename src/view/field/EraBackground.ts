import type Phaser from 'phaser';
import { COLOR_INT } from '../../config/constants';
import { invariant } from '../../core/invariant';
import { ERAS } from '../../sim/selectors';
import type { Era } from '../../sim/state';
import { FIELD_DEPTH } from './depths';
import { ERA_BACKGROUND_ART } from './layout';

// The art's size, scale and origin live in layout.ts with ERA_BACKGROUND_BOUNDS (Story 3.6).
const FRAME_W = ERA_BACKGROUND_ART.frameW;
const FRAME_H = ERA_BACKGROUND_ART.frameH;
const SCALE = ERA_BACKGROUND_ART.scale;
const ORIGIN_X = ERA_BACKGROUND_ART.originX;
const ORIGIN_Y = ERA_BACKGROUND_ART.originY;

/**
 * The parts of each texture that are drawn, in texture px. Only these hold era features: the far line
 * along the top (world y −16–32), the top band left of the Better Place (world x 0–380) and between it and
 * the Market (x 660–1080) down to world y 184, and everything right of the Market (x ≥ 1280). The rest
 * of the art is plain grass in the camera's pasture colour, so the camera's clear draws it for free: a
 * full-field image cost about 10 FPS at 100 sheep in the software-rendered probe (Story 3.5). Real art
 * must keep everything outside these strips flat `pasture`; DEV checks it (flatOutsideStrips).
 */
const STRIPS: readonly { readonly frame: string; readonly x: number; readonly y: number; readonly w: number; readonly h: number }[] =
  Object.freeze([
    Object.freeze({ frame: 'era-far', x: 0, y: 0, w: 640, h: 24 }),
    Object.freeze({ frame: 'era-left', x: 0, y: 24, w: 190, h: 76 }),
    Object.freeze({ frame: 'era-mid', x: 330, y: 24, w: 210, h: 76 }),
    Object.freeze({ frame: 'era-side', x: 640, y: 0, w: FRAME_W - 640, h: FRAME_H }),
  ]);

// [ASSUMPTION, tune in the browser] The era crossfade (UX-DR37: about 1 s). Reduced motion keeps it: a
// slow fade, not movement (Story 5.7).
const ERA_FADE_MS = 1_000;

/**
 * The field's era art (FR28, UX-DR37), under everything in GameScene. Two layers built once: `base`
 * shows the settled era, and `top` fades the next one in over it, then hands it to `base`. Each layer is
 * one image per strip (STRIPS). Visual only: nothing here touches GameState. A missing texture (a failed
 * load) leaves the layers hidden, so the camera's pasture background colour shows instead.
 */
export class EraBackground {
  private readonly scene: Phaser.Scene;
  private readonly base: Phaser.GameObjects.Container;
  private readonly top: Phaser.GameObjects.Container;
  /** The era the art shows, or is fading to. */
  private era: Era | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    for (const era of ERAS) {
      if (!scene.textures.exists(era)) continue;
      const tex = scene.textures.get(era);
      if (import.meta.env.DEV) {
        const frame = tex.get('__BASE');
        invariant(
          frame.realWidth === FRAME_W && frame.realHeight === FRAME_H,
          `EraBackground: the ${era} background is not the size ERA_BACKGROUND_BOUNDS assumes`,
        );
        if (!flatChecked.has(era)) {
          flatChecked.add(era);
          invariant(
            flatOutsideStrips(tex.getSourceImage() as CanvasImageSource),
            `EraBackground: the ${era} background has art outside STRIPS (it must be flat pasture there)`,
          );
        }
      }
      for (const s of STRIPS) if (!tex.has(s.frame)) tex.add(s.frame, 0, s.x, s.y, s.w, s.h);
    }
    this.base = this.layer(FIELD_DEPTH.background);
    this.top = this.layer(FIELD_DEPTH.background + 1);
  }

  /** Shows `era` at once, with no fade (a new, continued or loaded game). */
  show(era: Era): void {
    this.scene.tweens.killTweensOf(this.top);
    this.top.setVisible(false);
    this.era = era;
    if (!this.scene.textures.exists(era)) {
      this.base.setVisible(false);
      return;
    }
    setEra(this.base, era);
    this.base.setAlpha(1).setVisible(true);
  }

  /**
   * Crossfades to `era` over ERA_FADE_MS. A change during a fade snaps to the fade's target first, so
   * quick changes never leave a half-faded or wrong era. The era already shown does nothing.
   */
  fadeTo(era: Era): void {
    if (era === this.era) return;
    const previous = this.era;
    this.scene.tweens.killTweensOf(this.top);
    this.top.setVisible(false);
    if (previous !== null) this.show(previous);
    if (!this.scene.textures.exists(era) || !this.base.visible) {
      this.show(era);
      return;
    }
    this.era = era;
    setEra(this.top, era);
    this.top.setAlpha(0).setVisible(true);
    this.scene.tweens.add({
      targets: this.top,
      alpha: 1,
      duration: ERA_FADE_MS,
      ease: 'Sine.easeInOut',
      onComplete: () => this.show(era),
    });
  }

  private layer(depth: number): Phaser.GameObjects.Container {
    const images = STRIPS.map((s) =>
      this.scene.add
        .image(ORIGIN_X + s.x * SCALE, ORIGIN_Y + s.y * SCALE, ERAS[0])
        .setOrigin(0, 0)
        .setScale(SCALE),
    );
    return this.scene.add.container(0, 0, images).setDepth(depth).setVisible(false);
  }
}

// DEV: eras whose art was checked flat outside STRIPS (once per page load, not per scene create).
const flatChecked = new Set<Era>();

/**
 * DEV only: true when every texel outside STRIPS is exactly `pasture`, the camera colour that stands in
 * for it. Art drawn there would never show, and any other colour would show a seam.
 */
function flatOutsideStrips(src: CanvasImageSource): boolean {
  const canvas = document.createElement('canvas');
  canvas.width = FRAME_W;
  canvas.height = FRAME_H;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (ctx === null) return true;
  ctx.drawImage(src, 0, 0);
  const data = ctx.getImageData(0, 0, FRAME_W, FRAME_H).data;
  const r = (COLOR_INT.pasture >> 16) & 0xff;
  const g = (COLOR_INT.pasture >> 8) & 0xff;
  const b = COLOR_INT.pasture & 0xff;
  for (let y = 0; y < FRAME_H; y++) {
    for (let x = 0; x < FRAME_W; x++) {
      if (STRIPS.some((s) => x >= s.x && x < s.x + s.w && y >= s.y && y < s.y + s.h)) continue;
      const i = (y * FRAME_W + x) * 4;
      if (data[i] !== r || data[i + 1] !== g || data[i + 2] !== b) return false;
    }
  }
  return true;
}

/** Points every strip image of `layer` at `era`'s frames (STRIPS order). */
function setEra(layer: Phaser.GameObjects.Container, era: Era): void {
  const list = layer.list;
  for (let i = 0; i < STRIPS.length; i++) (list[i] as Phaser.GameObjects.Image).setTexture(era, STRIPS[i].frame);
}
