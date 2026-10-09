// AudioDirector (Story 5.6; architecture "Audio: src/view/audio/AudioDirector.ts"): every sound in the
// game plays through here, and nowhere else calls `sound`. It maps sim events and a few UI events to
// SFX from the one audio sprite, plays the music loop, and raises captions for the key cues when
// captions are on (UX-DR77–UX-DR83, UX-DR88). Sheep are quiet except when a lamb is born: no hunger
// bleats and no eating sounds.
//
// One per page, created by PreloadScene before the title (createAudioDirector). It outlives every scene,
// so the music never restarts on a scene change and its bus and game.events listeners are registered
// once for the page and never removed (GameScene/HudScene restart; they must not own it).
//
// Autoplay (project-context: nothing plays before the first user input): nothing plays and nothing is
// queued until the first pointer press or key press on the page AND Phaser has unlocked Web Audio. Both,
// because a browser may start the context running with no gesture at all (a site with high media
// engagement, or headless Chrome), and a sound started while locked would play on unlock, as a burst.
// The music starts at that point, on the title screen.
//
// Secrecy (AR18): death sounds are the same for every cause; the only truth it reads is
// Sacrificed.wasAbomination, the reveal channel (Story 4.4).
import Phaser from 'phaser';
import { log } from '../../core/log';
import { assertNever } from '../../core/types';
import type { Settings } from '../../save/settingsStore';
import type { SimEvent } from '../../sim/events';
import { AUDIO, SFX, type SfxMarker } from '../assetKeys';
import { bus } from '../bus';
import { reportError } from '../safetyNet';
import { getSettings } from '../settings';
import { STRINGS } from '../strings';

// Mixing, not settings: each cue's gain relative to the SFX volume. [ASSUMPTION, tune by ear]
const CUE_GAIN: Readonly<Record<SfxMarker, number>> = Object.freeze({
  'sfx-pop': 0.5,
  'sfx-thud': 0.9,
  'sfx-suction': 0.85,
  'sfx-screech': 0.8,
  'sfx-sting': 0.9,
  'sfx-ding': 0.6,
  'sfx-fanfare': 0.75,
  'sfx-descend': 0.6,
  'sfx-bleat': 0.4,
});
// [ASSUMPTION, tune by ear] The same cue never starts twice within this gap (a wipe of many sheep on
// one tick, or ×16 debug speed, is one thud), and at most MAX_VOICES SFX sound at once.
const SAME_CUE_GAP_MS = 60;
const MAX_VOICES = 8;
// Pitch variation for repeated cues, so they do not sound robotic (view-only, Math.random is fine).
const JITTER = 0.1;
// LambBorn bleats as a lamb, higher; a cure pops brighter than a click.
const LAMB_RATE = 1.4;
const CURE_RATE = 1.3;
// [ASSUMPTION] The same caption text is not raised again within this gap (a wipe of many sheep on one
// tick is one `[thud]`, not two identical boxes).
const SAME_CAPTION_GAP_MS = 1_000;

interface SpriteJson {
  spritemap?: Record<string, { start: number; end: number }>;
}

type SoundManager = Phaser.Game['sound'];
type Music = ReturnType<SoundManager['add']>;

export class AudioDirector {
  private readonly game: Phaser.Game;
  private readonly sound: SoundManager;
  /** Marker durations in seconds, from the sprite's JSON; empty when the sprite failed to load. */
  private readonly durations: Partial<Record<SfxMarker, number>> = {};
  private readonly sfxReady: boolean;
  private readonly musicReady: boolean;
  private music: Music | null = null;
  private pausedByHide = false;
  // The Web Audio context, when there is one; null with no audio. Its state is checked per play.
  private readonly ctx: AudioContext | null;
  // The first pointer or key press on the page has happened (autoplay gate; see header).
  private heard = false;
  private settings: Readonly<Settings>;
  // game.loop.time when each cue last started (SAME_CUE_GAP_MS).
  private readonly lastStart: Record<string, number> = {};
  // game.loop.time when each caption text was last raised (SAME_CAPTION_GAP_MS).
  private readonly lastCaption: Record<string, number> = {};
  // When each voice slot frees up (game.loop.time ms); a fixed ring, so playing allocates nothing.
  private readonly voiceEnds = new Float64Array(MAX_VOICES);

  constructor(game: Phaser.Game) {
    this.game = game;
    this.sound = game.sound;
    this.settings = getSettings();
    this.ctx = this.sound instanceof Phaser.Sound.WebAudioSoundManager ? this.sound.context : null;
    const json = game.cache.json.get(AUDIO.sfx) as SpriteJson | undefined;
    // A JSON without a spritemap (a wrong or hand-edited file) only silences the SFX, never the music.
    const spritemap = typeof json?.spritemap === 'object' && json.spritemap !== null ? json.spritemap : null;
    const noAudio = this.sound instanceof Phaser.Sound.NoAudioSoundManager;
    this.sfxReady = !noAudio && spritemap !== null && game.cache.audio.exists(AUDIO.sfx);
    this.musicReady = !noAudio && game.cache.audio.exists(AUDIO.music);
    if (this.sfxReady && spritemap !== null) {
      for (const k in SFX) {
        const marker = SFX[k as keyof typeof SFX];
        const m = spritemap[marker];
        if (m === undefined) log.warn('audio', `Sprite has no marker ${marker}`);
        else this.durations[marker] = m.end - m.start;
      }
    }
    if (!this.sfxReady || !this.musicReady) {
      log.warn('audio', 'Audio missing; playing silently', { sfx: this.sfxReady, music: this.musicReady });
    }

    // Page-lifetime listeners (see header): never removed.
    bus.on('sim', this.onSim, this);
    bus.on('button:activated', this.onClick, this);
    bus.on('farm:pressed', this.onClick, this);
    bus.on('farmBreeding:pressed', this.onClick, this);
    bus.on('era:announced', this.onEra, this);
    bus.on('settings:changed', this.onSettings, this);
    game.events.on(Phaser.Core.Events.HIDDEN, this.onHidden, this);
    game.events.on(Phaser.Core.Events.VISIBLE, this.onVisible, this);

    // Capture phase on window: before Phaser's own body listeners that unlock the context. Phaser unlocks
    // on a key press too, so a keyboard-only player is heard as well.
    window.addEventListener('pointerdown', this.onFirstInput, { capture: true });
    window.addEventListener('keydown', this.onFirstInput, { capture: true });
  }

  private readonly onFirstInput = (): void => {
    window.removeEventListener('pointerdown', this.onFirstInput, { capture: true });
    window.removeEventListener('keydown', this.onFirstInput, { capture: true });
    if (this.heard) return;
    this.heard = true;
    if (this.sound.locked) this.sound.once(Phaser.Sound.Events.UNLOCKED, this.startMusic, this);
    else this.startMusic();
  };

  /** DEV ear check (debug overlay): every marker, `gapMs` apart. */
  playAll(gapMs: number): void {
    let delay = 0;
    for (const k in SFX) {
      this.play(SFX[k as keyof typeof SFX], 1, delay / 1000, true);
      delay += gapMs;
    }
  }

  // --- Event mapping ---------------------------------------------------------------------------

  // Runs inside GameScene's tick drain: an audio bug must never count as a sim error.
  private readonly onSim = (e: SimEvent): void => {
    try {
      switch (e.type) {
        case 'SheepDied':
          // Identical for every cause, 'abomination' included (deferred-work, Story 4.3 review).
          this.play(SFX.thud, 1);
          this.caption(STRINGS.captions.thud);
          break;
        case 'Sacrificed':
          this.play(SFX.suction, 1);
          this.caption(STRINGS.captions.suction);
          if (e.wasAbomination) {
            // The reveal (UX-DR81), with GameScene's true-form flash this frame: screech, then the sting.
            // Forced past the voice cap: the reveal must never lose its sting to a busy mix.
            this.play(SFX.screech, 1, 0, true);
            this.play(SFX.sting, 1, this.durations[SFX.screech] ?? 0, true);
            this.caption(STRINGS.captions.screech);
          }
          break;
        case 'Sold':
        case 'Bought':
          this.play(SFX.ding, 1);
          break;
        case 'LambBorn':
          this.play(SFX.bleat, LAMB_RATE * this.jitter());
          break;
        case 'Cured':
          this.play(SFX.pop, CURE_RATE);
          break;
        // Silent: the click already popped (Farmed); pings and juice carry these; eating makes no sound;
        // era cues come once per frame from HudScene ('era:announced'); the sacrifice's suction covers
        // its boost.
        case 'FoodEaten':
        case 'BreedingFoodEaten':
        case 'CarcassEaten':
        case 'CarcassSpawned':
        case 'CarcassCleared':
        case 'Infected':
        case 'Farmed':
        case 'FoodDropped':
        case 'BreedingFoodDropped':
        case 'Bred':
        case 'BoostStarted':
        case 'Lost':
        case 'EraChanged':
          break;
        default:
          assertNever(e);
      }
    } catch (err) {
      reportError('ui', err);
    }
  };

  private readonly onClick = (): void => {
    try {
      this.play(SFX.pop, this.jitter());
    } catch (err) {
      reportError('ui', err);
    }
  };

  private readonly onEra = (e: { regress: boolean }): void => {
    try {
      this.play(e.regress ? SFX.descend : SFX.fanfare, 1);
      this.caption(e.regress ? STRINGS.captions.descendingNote : STRINGS.captions.fanfare);
    } catch (err) {
      reportError('ui', err);
    }
  };

  private readonly onSettings = (s: Readonly<Settings>): void => {
    try {
      this.settings = s;
      this.music?.setVolume(s.musicVolume);
    } catch (err) {
      reportError('ui', err);
    }
  };

  // --- Music -----------------------------------------------------------------------------------

  private startMusic(): void {
    try {
      if (!this.musicReady || this.music !== null || !this.heard) return;
      this.music = this.sound.add(AUDIO.music, { loop: true, volume: this.settings.musicVolume });
      // Unlocked while the tab was hidden: start it paused-by-hide, so the return resumes it.
      this.music.play();
      if (document.hidden) this.onHidden();
    } catch (err) {
      log.warn('audio', 'Music failed to start', err);
    }
  }

  // AR25: the music pauses while the tab is hidden. Phaser's pauseOnBlur (default on) may pause it too;
  // both paths check the state first, so neither double-pauses nor resumes the other's pause.
  private onHidden(): void {
    const m = this.music;
    if (m !== null && m.isPlaying) {
      m.pause();
      this.pausedByHide = true;
    }
  }

  private onVisible(): void {
    const m = this.music;
    if (this.pausedByHide && m !== null && m.isPaused) m.resume();
    this.pausedByHide = false;
  }

  // --- Playing ---------------------------------------------------------------------------------

  private jitter(): number {
    return 1 + (Math.random() * 2 - 1) * JITTER;
  }

  /**
   * Plays one marker at the SFX volume. Silent while locked or suspended (never queued), with no sprite,
   * inside the cue's repeat gap or with every voice busy. `delayS` is a sound delay in seconds
   * (visual-layer timing; it never touches GameState). `force` skips the repeat gap and the voice cap
   * and leaves no repeat-gap mark (the reveal; the DEV ear check, whose delays reach seconds ahead).
   */
  private play(marker: SfxMarker, rate: number, delayS = 0, force = false): void {
    if (!this.sfxReady || !this.heard || this.sound.locked) return;
    // pauseOnBlur suspends the context while the window is unfocused but the tab, and so the sim, still
    // runs: a sound started now would wait and play in a burst with all the others on refocus.
    if (this.ctx !== null && this.ctx.state !== 'running') return;
    const dur = this.durations[marker];
    if (dur === undefined) return;
    const now = this.game.loop.time;
    const startAt = now + delayS * 1000;
    if (!force && startAt - (this.lastStart[marker] ?? -Infinity) < SAME_CUE_GAP_MS) return;
    const ends = this.voiceEnds;
    let slot = -1;
    for (let i = 0; i < ends.length; i++) {
      if (ends[i] <= now) {
        slot = i;
        break;
      }
    }
    if (slot < 0 && !force) return;
    const volume = this.settings.sfxVolume * CUE_GAIN[marker];
    if (volume <= 0) return;
    // Config object per play: a played sound is an event, not per-frame work.
    if (!this.sound.playAudioSprite(AUDIO.sfx, marker, { volume, rate, delay: delayS })) return;
    if (!force) this.lastStart[marker] = startAt;
    if (slot >= 0) ends[slot] = startAt + (dur / rate) * 1000;
  }

  private caption(text: string): void {
    if (!this.settings.captions) return;
    const now = this.game.loop.time;
    if (now - (this.lastCaption[text] ?? -Infinity) < SAME_CAPTION_GAP_MS) return;
    this.lastCaption[text] = now;
    bus.emit('caption:requested', { text });
  }
}

let director: AudioDirector | null = null;

/** Creates the page's one AudioDirector (PreloadScene, after loading); later calls return the first. */
export function createAudioDirector(game: Phaser.Game): AudioDirector {
  if (director === null) director = new AudioDirector(game);
  return director;
}

/** The page's AudioDirector, or null before PreloadScene made it (or in a scene started without it). */
export function audioDirector(): AudioDirector | null {
  return director;
}
