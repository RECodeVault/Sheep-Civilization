import type Phaser from 'phaser';
import { CANVAS_HEIGHT, CANVAS_WIDTH, COLOR_INT, type ColorToken } from '../../config/constants';
import { invariant } from '../../core/invariant';
import type { Modal } from './MenuPanel';

/** A scrim component spec: `COMPONENTS.menuScrim` (72%, in game) or `menuScrimStart` (40%, title). */
export interface ScrimSpec {
  readonly backgroundColor: ColorToken;
  readonly opacity: number;
}

/**
 * The one scrim and "which panel is up" (UX-DR20, layer 4), for the title (40% scrim) and the
 * in-game overlay (72%). Modals replace each other and never stack: `show` hides the current panel
 * first. A confirm or sub-panel opened with `open` remembers the panel it came from, and `back`
 * returns there. View-only: no GameState, no bus.
 */
export class ModalController<Id extends string> {
  private readonly scene: Phaser.Scene;
  private readonly opacity: number;
  private readonly scrim: Phaser.GameObjects.Rectangle;
  private readonly panels = new Map<Id, Modal>();
  private currentId: Id | null = null;
  private previousId: Id | null = null;

  constructor(scene: Phaser.Scene, scrim: ScrimSpec, depth: number) {
    this.scene = scene;
    this.opacity = scrim.opacity;
    // Full canvas, interactive with no handlers: it swallows clicks ("clicking the scrim does
    // nothing"), and Phaser's global top-only input keeps them from the scenes below.
    this.scrim = scene.add
      .rectangle(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT, COLOR_INT[scrim.backgroundColor], 1)
      .setOrigin(0, 0)
      .setDepth(depth)
      .setInteractive();
    this.setScrim(false, 0);
  }

  add(id: Id, panel: Modal): this {
    this.panels.set(id, panel);
    return this;
  }

  /** The panel showing, or null when no modal is up. */
  get current(): Id | null {
    return this.currentId;
  }

  /** Shows `id` (hiding any other) over the full-opacity scrim. Clears the way back. */
  show(id: Id): void {
    this.previousId = null;
    this.swap(id);
    this.setScrim(true, this.opacity);
  }

  /**
   * Shows `id` in the current panel's place; `back` returns to the current panel. Needs a panel up:
   * with none there would be no way back (use `show`).
   */
  open(id: Id): void {
    const from = this.currentId;
    invariant(from !== null, `ModalController.open('${id}') with no panel up; use show()`);
    this.swap(id);
    this.previousId = from;
    this.setScrim(true, this.opacity);
  }

  /** Returns to the panel `open` came from. False (nothing changes) when there is none. */
  back(): boolean {
    const to = this.previousId;
    if (to === null) return false;
    this.previousId = null;
    this.swap(to);
    return true;
  }

  /** Hides every panel and the scrim; the scrim stops taking input. */
  hideAll(): void {
    this.swap(null);
    this.previousId = null;
    this.setScrim(false, 0);
  }

  /**
   * Fades the scrim in with no panel, then shows `id` (the lose screen: "the sim stops, a scrim
   * appears, then the lose panel"). Visual only: the tween never touches GameState.
   */
  fadeInThenShow(id: Id, durationMs: number, onError: (err: unknown) => void): void {
    this.swap(null);
    this.previousId = null;
    this.setScrim(true, 0);
    this.scene.tweens.add({
      targets: this.scrim,
      alpha: this.opacity,
      duration: durationMs,
      ease: 'Quad.easeOut',
      onComplete: () => {
        try {
          this.swap(id);
        } catch (err) {
          onError(err);
        }
      },
    });
  }

  private swap(id: Id | null): void {
    if (this.currentId !== null && this.currentId !== id) this.panels.get(this.currentId)?.setVisible(false);
    this.currentId = id;
    if (id !== null) this.panels.get(id)?.setVisible(true);
  }

  private setScrim(visible: boolean, alpha: number): void {
    this.scene.tweens.killTweensOf(this.scrim);
    this.scrim.setVisible(visible).setAlpha(alpha);
    if (this.scrim.input) this.scrim.input.enabled = visible;
  }
}
