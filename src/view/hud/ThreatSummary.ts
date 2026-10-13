import type Phaser from 'phaser';
import { COLORS, COMPONENTS, LAYOUT, SPACING } from '../../config/constants';
import { formatCapped } from '../../core/format';
import type { ThreatCounts } from '../../sim/selectors';
import { ATLAS, FRAME } from '../assetKeys';
import { STRINGS } from '../strings';
import { HoverZone } from '../widgets/HoverZone';
import { textStyle } from '../widgets/box';
import type { TooltipSource } from '../widgets/tooltipSource';

const SPEC = COMPONENTS.threatSummary;
// Icon art is drawn at 1×; shown at 2× like the other HUD icons. Each icon is centred in a slot as
// wide as the widest (the starving sheep, 28 px), so the three pairs line up.
const ICON_SCALE = 2;
const ICON_SLOT_W = 28;
const ICON_GAP = SPACING[1];
// The count sits in a fixed-width box wide enough for "100" in numeric type (40 px in Nunito 800,
// measured 2026-10-07; it was 33 in Pixelify Sans), so a growing count never moves the pairs (UX-DR5).
// It is left-aligned against its icon: right-aligned, a single digit sat nearer the next pair's icon
// than its own and read as belonging to it (browser check, 2026-10-07).
const COUNT_BOX_W = 40;
// Starving and infected are capped by capacity (100), but carcasses stay until cleared: a count past
// this shows "999+" (the tooltip keeps the exact number), shrunk to fit the box like any count that
// would run past it (Story 2.6 review).
const MAX_SHOWN = 999;
// mockups/hud.html `.threat` puts pairs 10 px apart, but its counts have no fixed box; with one, 12
// (SPACING[3]) keeps each pair visibly apart. [ASSUMPTION, browser-checked]
const PAIR_GAP = SPACING[3];
const PAIR_W = ICON_SLOT_W + ICON_GAP + COUNT_BOX_W;

/** The summary's width in canvas px, for the bar's layout. */
export const THREAT_SUMMARY_W = PAIR_W * 3 + PAIR_GAP * 2;

type ThreatKind = keyof ThreatCounts;
const KINDS: readonly ThreatKind[] = ['starving', 'infected', 'carcasses'];
const ICON: Readonly<Record<ThreatKind, string>> = Object.freeze({
  starving: FRAME.iconStarving,
  infected: FRAME.iconInfected,
  carcasses: FRAME.iconCarcass,
});

interface Pair {
  readonly kind: ThreatKind;
  readonly count: Phaser.GameObjects.Text;
  readonly zone: HoverZone;
  shown: number;
}

/**
 * The `threat-summary` component (UX-DR39): Starving, Infected and Carcasses, each an icon and a live
 * count. A zero count dims to `disabled-ink`; hovering a pair shows e.g. "2 starving"; clicking does
 * nothing. Fed from `HudView.threats`, so it counts only what the field shows (UX-DR64). `set` does
 * work only when a count changes.
 */
export class ThreatSummary {
  private readonly pairs: Pair[] = [];
  /** The pairs' hover zones, for HudScene's tooltip list. Built once. */
  readonly sources: readonly TooltipSource[];

  /** (x, centreY): the summary's left edge and vertical centre in canvas px. */
  constructor(scene: Phaser.Scene, x: number, centreY: number) {
    const zoneH = LAYOUT.hitMin;
    const sources: TooltipSource[] = [];
    for (let i = 0; i < KINDS.length; i++) {
      const kind = KINDS[i];
      const left = x + i * (PAIR_W + PAIR_GAP);
      scene.add.image(left + ICON_SLOT_W / 2, centreY, ATLAS.ui, ICON[kind]).setScale(ICON_SCALE);
      const count = scene.add
        .text(left + ICON_SLOT_W + ICON_GAP, centreY, '', textStyle(SPEC.typography, SPEC.textColor))
        .setOrigin(0, 0.5);
      // Covers the icon and the count; at least hit-min tall (UX-DR90).
      const zone = new HoverZone(scene, left, centreY - zoneH / 2, PAIR_W, zoneH);
      this.pairs.push({ kind, count, zone, shown: NaN });
      sources.push(zone);
    }
    this.sources = sources;
  }

  /** Shows `threats`; each pair redraws only when its count changes. */
  set(threats: ThreatCounts): void {
    for (let i = 0; i < this.pairs.length; i++) {
      const p = this.pairs[i];
      const n = threats[p.kind];
      if (n === p.shown) continue;
      p.shown = n;
      p.count.setText(formatCapped(n, MAX_SHOWN));
      // `width` is unscaled, so the scale never compounds.
      p.count.setScale(Math.min(1, COUNT_BOX_W / p.count.width));
      p.count.setColor(COLORS[n === 0 ? SPEC.zeroTextColor : SPEC.textColor]);
      p.zone.setTooltip(STRINGS.threatTooltip[p.kind](n));
    }
  }
}
