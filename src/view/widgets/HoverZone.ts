import Phaser from 'phaser';
import type { TooltipSource } from './tooltipSource';

/**
 * A hover area with a tooltip and nothing else: no press, no hand cursor (UX-DR39: the threat
 * summary's counts are read-outs, and clicking them does nothing). Its hover tracking mirrors
 * Button's. HUD widgets may use setInteractive (project-context Input rule).
 */
export class HoverZone implements TooltipSource {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  private readonly scene: Phaser.Scene;
  private tooltipText: string | undefined;
  private hovered = false;
  /** Real time the pointer entered, or -1 while not hovering. */
  private hoverSinceMs = -1;

  /** (x, y) is the top-left in canvas px. */
  constructor(scene: Phaser.Scene, x: number, y: number, width: number, height: number) {
    this.scene = scene;
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    // Plain setInteractive: the default arrow, not the hand (it is not a button).
    const zone = scene.add.zone(x, y, width, height).setOrigin(0, 0).setInteractive();
    zone.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OVER, this.onOver, this);
    zone.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OUT, this.onOut, this);
    // Leaving the canvas emits only GAME_OUT (no gameobject out), as in Button.
    scene.input.on(Phaser.Input.Events.GAME_OUT, this.onOut, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      scene.input.off(Phaser.Input.Events.GAME_OUT, this.onOut, this);
    });
  }

  get tooltip(): string | undefined {
    return this.tooltipText;
  }

  /** Changes the tooltip; a shown tooltip picks it up on the next frame. */
  setTooltip(text: string | undefined): this {
    this.tooltipText = text;
    return this;
  }

  get isHovered(): boolean {
    return this.hovered;
  }

  get hoverSince(): number {
    return this.hoverSinceMs;
  }

  clearHover(): void {
    this.hovered = false;
    this.hoverSinceMs = -1;
  }

  private onOver(): void {
    this.hovered = true;
    this.hoverSinceMs = this.scene.game.loop.time;
  }

  private onOut(): void {
    this.hovered = false;
    this.hoverSinceMs = -1;
  }
}
