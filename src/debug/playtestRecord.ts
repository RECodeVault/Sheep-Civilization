// The playtest record (Story 3.6, AC 1): when this game first reached each pacing milestone, in game
// time, so the time to Village and to Town is read off the overlay instead of a stopwatch. DEV only;
// loaded with the debug overlay.
//
// The record lives in sessionStorage (Story 3.6 Open Question 4), so it survives the reloads the
// playtest makes (AC 6) without touching GameState or the save. sessionStorage is per tab and is gone
// when the tab closes. Every access is wrapped: private mode can throw.
import { formatGameTime, formatMoney } from '../core/format';
import { log } from '../core/log';
import type { SimEvent } from '../sim/events';
import { currentEra, eraIndex } from '../sim/selectors';
import type { GameState } from '../sim/state';

const KEY = 'sheepciv.debug.playtest';

export const MILESTONES = [
  'firstBreeding',
  'firstBirth',
  'firstSale',
  'firstDeath',
  'landI',
  'village',
  'town',
  'woolEmpire',
] as const;
export type Milestone = (typeof MILESTONES)[number];

const LABEL: Readonly<Record<Milestone, string>> = Object.freeze({
  firstBreeding: 'bred',
  firstBirth: 'born',
  firstSale: 'sold',
  firstDeath: 'died',
  landI: 'land I',
  village: 'Village',
  town: 'Town',
  woolEmpire: 'Empire',
});

/** A stamp: game-ms of the milestone. `approx` when it was found already reached (seeded from a save). */
interface Mark {
  at: number;
  approx?: boolean;
}

interface Stored {
  /** The latest game time seen, to tell a new game from a reload of this one. */
  lastTime: number;
  marks: Partial<{ [K in Milestone]: Mark }>;
}

// Telling a new game from the same game, without a run id in GameState:
// - Within a page, every Restart, New Game, Continue and debug Load gives GameScene a new state object.
//   The same game resumes at or after the time already seen (Main Menu saves before leaving), so a new
//   state object whose clock is behind lastTime is another game (or an older save of it: a new timeline).
// - After a page reload there is no object to compare. The game resumes from the last autosave (every 10 s
//   of real time, so up to 160 s of game time at ×16) or the hide-save: never far behind lastTime. A clock
//   much earlier than that, or a fresh start (under 5 s) after a game that ran longer, is another game.
const NEW_GAME_BEFORE_MS = 5_000;
const RELOAD_SLACK_MS = 200_000;

export class PlaytestRecord {
  private rec: Stored = read() ?? { lastTime: 0, marks: {} };
  /** The state object last followed; null until the first one this page. */
  private seen: Readonly<GameState> | null = null;

  /** Follows the live state (on the overlay's refresh): spots a new game, and seeds missed milestones. */
  sync(s: Readonly<GameState>): void {
    const t = s.time;
    let changed = this.follow(s);
    if (t > this.rec.lastTime) this.rec.lastTime = t;
    // A save continued in a fresh tab (or before this record existed) has milestones already behind it:
    // stamp them now, marked approximate. Births and breedings leave no trace in the state.
    const era = eraIndex(currentEra(s));
    if (era >= 1) changed = this.seed('village', t) || changed;
    if (era >= 2) changed = this.seed('town', t) || changed;
    if (era >= 3) changed = this.seed('woolEmpire', t) || changed;
    if (s.stats.sold > 0) changed = this.seed('firstSale', t) || changed;
    if (s.stats.died > 0) changed = this.seed('firstDeath', t) || changed;
    if (s.owned.includes('land1')) changed = this.seed('landI', t) || changed;
    if (changed) write(this.rec);
  }

  /**
   * Starts a fresh record when `s` is another game (see the rules above). Runs before every stamp, so an
   * event from a new game is never stamped into the old game's record. Returns whether it reset.
   */
  private follow(s: Readonly<GameState>): boolean {
    const t = s.time;
    const last = this.rec.lastTime;
    let newGame: boolean;
    if (this.seen === null) {
      newGame = (t < NEW_GAME_BEFORE_MS && last >= NEW_GAME_BEFORE_MS) || t + RELOAD_SLACK_MS < last;
    } else {
      newGame = s !== this.seen && t < last;
    }
    this.seen = s;
    if (!newGame) return false;
    this.rec = { lastTime: t, marks: {} };
    return true;
  }

  /** Stamps exact times from the sim events (forwarded on the view bus right after each tick). */
  onEvent(e: SimEvent, s: Readonly<GameState>): void {
    const time = s.time;
    if (this.follow(s)) write(this.rec);
    let m: Milestone | null = null;
    if (e.type === 'Bred') m = 'firstBreeding';
    else if (e.type === 'LambBorn') m = 'firstBirth';
    else if (e.type === 'Sold') m = 'firstSale';
    else if (e.type === 'SheepDied') m = 'firstDeath';
    else if (e.type === 'Bought' && e.item === 'land1') m = 'landI';
    else if (e.type === 'EraChanged') {
      if (e.to === 'village') m = 'village';
      else if (e.to === 'town') m = 'town';
      else if (e.to === 'wool-empire') m = 'woolEmpire';
    }
    if (m === null || this.rec.marks[m] !== undefined) return;
    this.rec.marks[m] = { at: time };
    // An era jump (debug "+N sheep") passes the lower eras in the same event.
    if (m === 'town' || m === 'woolEmpire') this.seed('village', time);
    if (m === 'woolEmpire') this.seed('town', time);
    write(this.rec);
  }

  /** Two overlay lines, e.g. "bred 1:12 · born 1:22 · sold — · …". `≤` marks an approximate stamp. */
  lines(): [string, string] {
    const part = (m: Milestone): string => `${LABEL[m]} ${this.show(m)}`;
    return [
      `pace   ${['village', 'town', 'woolEmpire'].map((m) => part(m as Milestone)).join(' · ')}`,
      `first  ${['firstBreeding', 'firstBirth', 'firstSale', 'firstDeath', 'landI'].map((m) => part(m as Milestone)).join(' · ')}`,
    ];
  }

  /** The record and the run's end state as plain text, for the story's Playtest Record (Copy results). */
  summary(s: Readonly<GameState>, tick: { meanMs: number; maxMs: number; samples: number }, problems: number): string {
    const rows = MILESTONES.map((m) => `  ${LABEL[m].padEnd(8)} ${this.show(m)}`);
    return [
      `Sheep Civilization playtest record (${new Date().toISOString()})`,
      `game time ${formatGameTime(s.time)} · era ${currentEra(s)} · sheep ${s.sheep.length} · peak ${s.stats.peakFlock}`,
      `money ${formatMoney(s.money)} · earned ${formatMoney(s.stats.moneyEarned)} · owned ${s.owned.join(', ') || 'nothing'}`,
      `sold ${s.stats.sold} · died ${s.stats.died} · sacrificed ${s.stats.sacrificed}${s.lostAt !== undefined ? ` · LOST at ${formatGameTime(s.lostAt)}` : ''}`,
      'milestones (game time; ≤ = already reached when first seen):',
      ...rows,
      `sim tick since this page loaded: mean ${tick.meanMs.toFixed(3)} ms · max ${tick.maxMs.toFixed(3)} ms over ${tick.samples} ticks`,
      `console warnings/errors since the overlay started (boot excluded; the overlay's own not counted): ${problems}`,
    ].join('\n');
  }

  private show(m: Milestone): string {
    const mark = this.rec.marks[m];
    if (mark === undefined) return '—';
    return `${mark.approx === true ? '≤' : ''}${formatGameTime(mark.at)}`;
  }

  private seed(m: Milestone, time: number): boolean {
    if (this.rec.marks[m] !== undefined) return false;
    this.rec.marks[m] = { at: time, approx: true };
    return true;
  }
}

function read(): Stored | null {
  try {
    // eslint-disable-next-line no-restricted-globals -- DEV-only playtest record, never game state (Story 3.6 OQ 4)
    const text = sessionStorage.getItem(KEY);
    if (text === null) return null;
    const r: unknown = JSON.parse(text);
    return isStored(r) ? (r as Stored) : null;
  } catch (err) {
    log.warn('debug', 'Playtest record unreadable; starting a new one', err);
    return null;
  }
}

/** A record this build can use: a numeric lastTime and a marks object of `{ at: number }` stamps. */
function isStored(x: unknown): boolean {
  if (typeof x !== 'object' || x === null) return false;
  const r = x as { lastTime?: unknown; marks?: unknown };
  if (typeof r.lastTime !== 'number' || !Number.isFinite(r.lastTime)) return false;
  if (typeof r.marks !== 'object' || r.marks === null || Array.isArray(r.marks)) return false;
  for (const m of Object.values(r.marks as object)) {
    if (typeof m !== 'object' || m === null || typeof (m as { at?: unknown }).at !== 'number') return false;
  }
  return true;
}

function write(r: Stored): void {
  try {
    // eslint-disable-next-line no-restricted-globals -- DEV-only playtest record, never game state (Story 3.6 OQ 4)
    sessionStorage.setItem(KEY, JSON.stringify(r));
  } catch {
    // Storage blocked or full: the record lives on in memory for this page.
  }
}
