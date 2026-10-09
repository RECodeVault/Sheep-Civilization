/**
 * Anything HudScene's one tooltip can serve: a Button, or a non-clickable HoverZone (the threat
 * summary's counts). (x, y, width, height) is the box the tooltip anchors to, in canvas px.
 */
export interface TooltipSource {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  /** The tooltip text, or undefined for none. */
  readonly tooltip: string | undefined;
  /** Real time (ms) the pointer started hovering, or -1 if no tooltip should show. */
  readonly hoverSince: number;
  /** True while Phaser reports the pointer over it. */
  readonly isHovered: boolean;
  /**
   * False while the source is hidden (the Medicine slot with no dose, Story 4.5): it is then no HUD
   * control and shows no tooltip. Omitted = always active.
   */
  readonly active?: boolean;
  /** Forgets the hover (a modal opened over it). */
  clearHover(): void;
}
