---
baseline_commit: 8a2ed43
---

# Story 5.6: Audio Pass and Captions

Status: done

<!-- Created 2026-10-09 by create-story. First story created in Epic 5. Branch `story-5.6` off `main` at 8a2ed43 (Epic 4 closed).
The game has no audio yet: `assets/audio/` holds only `.gitkeep`, `src/view/audio/` holds only `.gitkeep`, `npm run assets` prints "audio: none yet (Story 5.6)", and nothing loads, plays or captions a sound.
This story adds: placeholder source audio (synthesised by a throwaway scratchpad script, like every art placeholder so far), the audio sprite and music build in `scripts/build-assets.ts`, loading in PreloadScene, a game-lifetime `AudioDirector` that maps sim and UI events to sounds and captions, hunger-scaled bleats, the `caption` HUD component, and a minimal settings store (`sheepciv.settings`) that the director reads.
It does NOT add the Volume panel UI (Story 5.7), the `LastSheep` event or banner (Story 5.5), names (5.3) or the juice pass (5.8).
Key risks: (1) `ffmpeg` is not installed on this machine and `sudo` needs a password, so OGG/MP3 encoding is blocked until Rylan installs it (Open Question 1); (2) sounds played while Web Audio is locked would burst on unlock, so the director must drop them; (3) 100 sheep must not turn into a bleat wall, and the bleat loop must not allocate per frame. -->

## Story

As a player,
I want cozy music and comedic sound effects, with optional captions,
so that the game feels alive and important sounds are never missed.

## Acceptance Criteria

1. **The build (AR11, NFR3, project-context Performance "audio OGG+MP3 at ≤ 128 kbps").** Given source audio in `assets/audio/sfx/*.wav` and `assets/audio/music/music.wav`, when `npm run assets` runs, then:
   - every SFX source is packed into **one** audio sprite, `public/assets/audio/sfx.ogg` + `sfx.mp3`, with `public/assets/audio/sfx.json` in Phaser's audiosprite format (`{ "resources": [...], "spritemap": { "sfx-<name>": { "start", "end", "loop": false } } }`), one marker per source file, named `sfx-<file name without .wav>`;
   - the music loop is encoded to `public/assets/audio/music.ogg` + `music.mp3`;
   - every output is ≤ 128 kbps; stale files in `public/assets/audio/` are pruned; nothing is written if any step fails (the script's "pack everything before writing anything" rule);
   - the source set is the ~~11~~ 9 markers in the SFX table in Dev Notes (about 10, as the GDD says); `sfx-munch` and `sfx-bleat-frantic` were cut.
2. **Loading.** PreloadScene loads the sprite (`load.audioSprite`) and the music (`load.audio`) with relative URLs, OGG first then MP3. A missing or undecodable audio file is a recoverable boundary failure: `log.warn('audio', …)`, the game runs silently, and no error toast blocks play. Missing textures keep their existing toast; audio failure adds no toast.
3. **The director (UX-DR77–UX-DR83, architecture "Audio: src/view/audio/AudioDirector.ts").** One `AudioDirector`, created once per page, maps events to sounds:

   | Trigger | Sound | Caption (when captions on) |
   |---|---|---|
   | Any `Button` activation, and the F / G keys (`farm:pressed`, `farmBreeding:pressed`) | `sfx-pop` | — |
   | ~~`FoodEaten`, `BreedingFoodEaten`, `CarcassEaten`~~ (cut: eating is silent) | ~~`sfx-munch`~~ | — |
   | `SheepDied` (every cause, identical) | `sfx-thud` ("baa-*thud*") | `[thud]` |
   | `Sacrificed` (every sacrifice) | `sfx-suction` | `[suction]` |
   | `Sacrificed { wasAbomination: true }` (in addition) | `sfx-screech`, then `sfx-sting` after it | `[screech]` |
   | `Sold`, `Bought` | `sfx-ding` (cash register) | — |
   | Era advance (once per frame, as the banner) | `sfx-fanfare` | `[fanfare]` |
   | Era regress (once per frame, as the banner) | `sfx-descend` | `[descending note]` |
   | `LambBorn` | `sfx-bleat` at a higher pitch | — |
   | `Cured` | `sfx-pop` at a higher pitch | — |

   **[Cut after implementation at Rylan's request; see Change Log.]** ~~Hunger bleats: sheep bleat at random, and more often as hunger worsens: a Hungry sheep about twice as often as a Fed one, a Starving sheep more often still with `sfx-bleat-frantic` (GDD Hunger table, EXPERIENCE State Patterns). The first sheep to **enter** Starving in any 60 s of game time also raises `[frantic bleating]`.~~ Sheep are silent except for the `LambBorn` bleat.
   **All sounds play only through `AudioDirector`** (project-context Engine rules): no other file calls `this.sound`.
4. **Autoplay (project-context Platform "Audio autoplay").** Given the browser autoplay policy, when the page loads, nothing plays (and nothing is queued to play) until the first user input (a pointer press or a key press; amended in code review) unlocks Web Audio. After that, the music loop starts on the title screen and keeps playing, without restarting, through Title → Game, Restart, Main Menu and back.
5. **Hidden tab and pause (AR25, FR41).** When the tab is hidden the music pauses and resumes when it comes back. While the sim is not advancing (pause menu, a sub-panel, the start-over confirm, the lose screen, a hidden tab, debug speed 0), ~~hunger bleats stop~~ (cut with the hunger bleats). The music keeps playing under the pause menu and the lose screen.
6. **Captions (UX-DR45, UX-DR88, UX-DR10).** Given captions are on (setting, default **off**), when a captioned cue plays, then a `caption` box shows its text: `duskDeep` background at 85% alpha, `wool` text in caption type (Nunito 18/800), `rounded.sm`, bracketed text, bottom-centre just above the bottom bar, about 2.5 s, at most 2 at once (a third replaces the oldest). Captions draw in HudScene (render layer 3), never block clicks, and are cleared on Restart. With captions off, no caption is ever shown.
7. **Settings (UX-DR89, architecture Data Persistence).** Volumes and the captions flag come from `sheepciv.settings` through a new `src/save/settingsStore.ts`, never hard-coded in the director. Missing, corrupt or out-of-range settings fall back to the defaults per field; storage that is unavailable or throws never stops the game. Restart, Start over and Lose → Restart keep the settings. A DEV debug-overlay button toggles captions so this story can be tested before Story 5.7's Volume panel exists.
8. **Secrecy (AR18, deferred-work "Death sounds must not tell the cause").** The death sound and `[thud]` are identical for every `cause`, including `'abomination'`. The only place audio branches on the truth is `Sacrificed.wasAbomination`, the reveal channel since Story 4.4. ~~Bleats, the starving caption and~~ Every other cue treats the Abomination as any lamb (its birth bleats like any lamb's).
9. **No hot-path allocation, no Phaser timers on state (project-context Performance and Engine rules).** ~~The per-frame bleat update allocates nothing, never reads `isAbomination`, and never touches `GameState` beyond reading `simState.time`.~~ (Cut with the hunger bleats: the director has no per-frame update; playing a cue allocates nothing beyond its config.) Sound `delay` (for the sting) is visual-layer timing only and never changes `GameState`.
10. **Credits (NFR12).** `assets/CREDITS.md` gets an **Audio** table listing every audio file (placeholder, original, "Same as the project", made by a throwaway script, to be replaced by free-pack audio), in the existing table style.
11. **Done = `npm test`, `npm run typecheck` and `npm run lint` all pass**, and the browser checks in Task 9 pass.

## Tasks / Subtasks

- [x] **Task 0: Unblock encoding (AC 1)** — see Open Question 1
  - [x] 0.1 Run `ffmpeg -version`. If it is missing, **stop and ask Rylan** to run `! sudo apt install -y ffmpeg` (the session cannot sudo). Do not add an npm package (`ffmpeg-static`, `audiosprite`, `lamejs`, …) without Rylan's OK: project-context forbids new packages without an architecture update.
  - [x] 0.2 Confirm the build has the encoders: `ffmpeg -hide_banner -encoders | grep -E "libvorbis|libmp3lame"`. Both must be listed.

- [x] **Task 1: Placeholder source audio (AC 1, 10)** — `assets/audio/{sfx,music}/`
  - [x] 1.1 Write a throwaway synth script **in the scratchpad, not the repo** (the art-placeholder pattern, Stories 1.2–4.8: "keep that script in the scratchpad, commit only the outputs"). Pure Node: oscillators, noise, ADSR envelopes, written as 16-bit PCM mono WAV at 44.1 kHz. Python is also available.
  - [x] 1.2 Make the 11 SFX in the SFX table (Dev Notes) as `assets/audio/sfx/<name>.wav`. Keep them short (most ≤ 0.6 s, the fanfare ≤ 1.5 s), cute and comedic (NFR10: slapstick, never gory). Normalise peaks to about −3 dBFS so no cue is far louder than another.
  - [x] 1.3 Make one cozy music loop `assets/audio/music/music.wav`: 20–40 s, soft (peaks around −12 dBFS, so SFX sit on top), seamlessly looping (start and end at a zero crossing, same harmony). A simple I–V–vi–IV pad + plucked melody is plenty.
  - [x] 1.4 Delete `assets/audio/.gitkeep` once real files exist.
  - [x] 1.5 `assets/CREDITS.md`: add an `## Audio` section with one placeholder row, same columns as Art: description, "Sheep Civilization project (original)", "Same as the project", "Synthesised as placeholders; to be replaced by free-pack audio", and the file list `audio/sfx/{…}.wav`, `audio/music/music.wav`.

- [x] **Task 2: Build the sprite and the music (AC 1)** — `scripts/build-assets.ts`
  - [x] 2.1 Add `SRC_AUDIO = assets/audio`, `OUT_AUDIO = public/assets/audio`. Keep the file erasable TypeScript only (it runs by Node 24 type stripping; no enums, no parameter properties), as the header says.
  - [x] 2.2 `listSfx()`: every `*.wav` in `assets/audio/sfx/` (lowercase `.wav` only, `isFile()`, kebab-case name by the existing `FRAME_NAME` regex), sorted. Fail with `AssetError` on none, a bad name, or a non-file, like `listPngs`.
  - [x] 2.3 Find ffmpeg once (`spawnSync('ffmpeg', ['-version'])` from `node:child_process`). If it is missing, throw `AssetError('ffmpeg is required for audio (sudo apt install ffmpeg); nothing was written')`. Call it with `execFile`/`spawn` and an argument array, never a shell string.
  - [x] 2.4 Decode each SFX with ffmpeg to raw `s16le`, mono, 44 100 Hz on stdout (`-f s16le -ac 1 -ar 44100 -`), so sources of any rate or channel count work. Concatenate in Node with **1 s of silence** between sounds (and after the last), recording each marker's `start` and `end` in seconds (rounded to 3 decimals). Pad markers by nothing; the silence absorbs encoder delay (MP3 adds about 26 ms at the start).
  - [x] 2.5 Encode the joined PCM (stdin, `-f s16le -ac 1 -ar 44100 -i -`) to `sfx.ogg` (`-c:a libvorbis -q:a 3`, about 96–112 kbps) and `sfx.mp3` (`-c:a libmp3lame -b:a 96k`). Encode `music.wav` the same way to `music.ogg` / `music.mp3` (stereo allowed for music; mono is fine and smaller). `-y -hide_banner -loglevel error`. Write ffmpeg outputs to a temp dir (`os.tmpdir()` / `mkdtemp`) and move them in only after every step succeeded, keeping "nothing written on failure".
  - [x] 2.6 Write `sfx.json`: `{ "resources": ["sfx.ogg", "sfx.mp3"], "spritemap": { "sfx-pop": { "start": 0, "end": 0.12, "loop": false }, … } }`. Phaser turns each entry into a marker of `duration = end − start` (`BaseSoundManager.addAudioSprite`).
  - [x] 2.7 `prune(OUT_AUDIO, keep)` with the five outputs. Replace the log line `'[assets] audio: none yet (Story 5.6)'` with `[assets] audio: 11 sfx in sprite (Ns), music Ns, total N KB`.
  - [x] 2.8 Run `npm run assets`; commit `assets/audio/**` and `public/assets/audio/**`. Check total audio is well under 1 MB (NFR3 is 8 MB for the whole build). `npm run typecheck` covers `scripts/` (`tsc -p scripts`).

- [x] **Task 3: Keys and loading (AC 2)**
  - [x] 3.1 `src/view/assetKeys.ts`: add `AUDIO = Object.freeze({ sfx: 'sfx', music: 'music' } as const)`, an `SFX` map of marker names (`pop: 'sfx-pop'`, …, one per table row, typed `as const`), and `audioSpriteUrls()` / `musicUrls()` returning relative URLs (`assets/audio/sfx.json`, `['assets/audio/sfx.ogg', 'assets/audio/sfx.mp3']`, …), like `atlasUrls`. No leading slash.
  - [x] 3.2 `PreloadScene.preload`: `this.load.audioSprite(AUDIO.sfx, urls.json, urls.audio)` and `this.load.audio(AUDIO.music, musicUrls())`. The existing `FILE_LOAD_ERROR` handler already logs.
  - [x] 3.3 `PreloadScene.create`: check `this.cache.json.exists(AUDIO.sfx)` and `this.cache.audio.exists(…)` for both keys; if either is missing, `log.warn('audio', 'Audio missing after load; playing silently', missing)` — **no toast** (AC 2). Then create the director (Task 5.1) before `scene.start('TitleScene')`.

- [x] **Task 4: Settings store (AC 7)** — new `src/save/settingsStore.ts`, tests in `tests/save/settingsStore.test.ts`
  - [x] 4.1 `export interface Settings { musicVolume: number; sfxVolume: number; reducedMotion: boolean; captions: boolean }` and `DEFAULT_SETTINGS` (frozen): `musicVolume: 0.5`, `sfxVolume: 0.8`, `reducedMotion: false`, `captions: false` — the volumes are `[ASSUMPTION, tune by ear]`; captions off is UX-DR88. Put the defaults in `src/config/tuning.ts`? **No**: they are player settings, not GDD tunables; keep them in the store, documented.
  - [x] 4.2 `loadSettings(storage = defaultStorage()): Settings` — reads `SETTINGS_KEY` (already in `constants.ts`), parses, and takes **each field** that is valid (volumes finite in [0, 1], flags boolean), the default for any other. Never throws: unreadable storage, bad JSON or a non-object returns the defaults (with one `log.warn('save', …)` for a corrupt value).
  - [x] 4.3 `saveSettings(s: Settings, storage = defaultStorage()): boolean` — writes JSON; try/catch, warn once, never throws. Reuse `StorageLike` / `defaultStorage` from `saveStore.ts` (export them if needed; they are exported already).
  - [x] 4.4 Tests (fake `StorageLike`, the `saveStore.test.ts` pattern): defaults with no key; round trip; each bad field falls back alone; non-JSON and non-object fall back; a throwing `getItem`/`setItem` never throws; `wipeSave` leaves the settings key (UX-DR89 — "settings survive Restart" is a mandatory save test in project-context).
  - [x] 4.5 The live settings: `src/view/settings.ts` holds the current `Settings` (loaded once on first use), with `getSettings()` and `updateSettings(patch)` that merges, saves, and emits the UI event `'settings:changed'` (architecture names it) on the bus with the new settings. Add `'settings:changed': Readonly<Settings>` to `BusEvents` in `src/view/bus.ts`. Story 5.7's Volume panel will call `updateSettings`; this story's only caller is the debug button (Task 8).

- [x] **Task 5: AudioDirector (AC 3, 4, 5, 8, 9)** — new `src/view/audio/AudioDirector.ts` (delete `src/view/audio/.gitkeep`)
  - [x] 5.1 A class owning `game.sound`, created **once per page** from PreloadScene (`createAudioDirector(game)`; a module-level instance, like `bus`, with a guard so a second call returns the first). It lives for the page, so its `bus.on` subscriptions are never removed — say so in its header comment, as the debug overlay does for its page-lifetime handler. It must not be created in GameScene/HudScene (both restart; music would restart and listeners would double).
  - [x] 5.2 **Locked = silent.** Every play helper first returns if `sound.locked` or the sound manager is a `NoAudioSoundManager`/the cache keys are missing (AC 2). Never call `play` while locked: Web Audio would start the backlog on unlock (AC 4).
  - [x] 5.3 **Music.** On construction, if unlocked start it, else `sound.once(Phaser.Sound.Events.UNLOCKED, startMusic)`. One retained instance: `sound.add(AUDIO.music, { loop: true, volume })`. Never stopped by scene changes. Start only after the title exists (the director is created right before `TitleScene` starts, so this holds).
  - [x] 5.4 **Hidden tab (AC 5).** `game.events.on(Phaser.Core.Events.HIDDEN, …)` pauses the music; `VISIBLE` resumes it if it was paused by hiding. Phaser's own `pauseOnBlur` (default true) also pauses on window blur; keep the default and make both paths idempotent (check `isPlaying`/`isPaused`, never double-resume).
  - [x] 5.5 **SFX helper** `play(marker, rate = 1)`: `sound.playAudioSprite(AUDIO.sfx, marker, { volume: sfxVolume, rate })`. Throttle per marker: skip if the same marker started less than `SAME_CUE_GAP_MS` ago (`[ASSUMPTION]` 60 ms; a 100-sheep wipe in one tick is one thud, not 100). Cap total simultaneous SFX at `MAX_VOICES` (`[ASSUMPTION]` 8) using `sound.getAllPlaying().length` only on a play call (not per frame) — or a small counter decremented on `complete`; either way, no per-frame allocation. Pitch variation (`rate` 0.9–1.1 from `Math.random`, allowed in view-only cosmetic code) for bleats, munch and pop so repeats don't sound robotic.
  - [x] 5.6 **Sim events** — `bus.on('sim', onSim)` with a `switch (e.type)` over the whole `SimEvent` union ending in `default: assertNever(e)` (project-context "Exhaustive unions"; `assertNever` from `src/core/types.ts`). Cases per the AC 3 table; silent cases are listed explicitly (`CarcassSpawned`, `CarcassCleared`, `Infected`, `Farmed`, `FoodDropped`, `BreedingFoodDropped`, `Bred`, `BoostStarted`, `Lost`, `EraChanged` — era cues come from the HUD's once-per-frame flush, Task 5.8). When Story 5.5 adds `LastSheep`, the compiler forces its sting + `[sting] Last sheep!` case here (Open Question 2).
  - [x] 5.7 **Reveal.** On `Sacrificed`: suction + `[suction]` always. If `wasAbomination`: screech at once with `[screech]`, then the sting with `delay` = the screech marker's duration (read from the sprite's marker, not a literal). GameScene's flash starts in the same frame (`suck → revealTrueForm`), so sound and flash line up.
  - [x] 5.8 **Era cues once per frame.** HudScene already folds a frame's `EraChanged` events into one banner (`flushEraBanner`: first `from`, last `to`, nothing for a flip back). Emit a new UI event from there, `'era:announced': { regress: boolean }` (add to `BusEvents`), right where it calls `banner.play`; the director plays fanfare / descend and the caption from it. Do not listen to `EraChanged` for audio (×16 would play twice).
  - [x] 5.9 **Clicks.** Add a UI event `'button:activated': undefined` to `BusEvents`, emitted by `Button` just before it calls `options.onActivate()` (both the press and release paths, `Button.ts` `onDown`/`onUp`). The director plays `sfx-pop` on it and on `farm:pressed` / `farmBreeding:pressed` (the F/G key paths, which never go through a Button). A greyed button never activates, so it never pops. Shop rows are not `Button`s: their purchase is heard through `Bought` (ding), so no pop is needed there.
  - [x] 5.10 **Settings.** Read volumes and captions from `getSettings()` at construction and on `'settings:changed'`: set the music instance's volume at once; SFX use the current `sfxVolume` per play. Never hard-code a volume except the relative per-cue mix (`CUE_GAIN` map, e.g. `bleat: 0.6`), which is mixing, not a setting.
  - [x] 5.11 **Captions.** A helper `caption(text)` that emits `'caption:requested': { text: string }` (add to `BusEvents`) only when `settings.captions` is true. Strings come from `STRINGS.captions` (Task 7.1), never inline.
  - [x] 5.12 Every bus handler body is wrapped in try/catch → `reportError('ui', err)`, like HudScene's handlers: `onSim` runs inside GameScene's tick drain, and an audio bug must never count as a sim error.

- [x] ~~**Task 6: Hunger bleats (AC 3, 5, 8, 9)**~~ **Cut after implementation (see Change Log); the code was removed.**
  - [x] 6.1 ~~`AudioDirector.updateFlock(sheep: readonly PublicSheep[], simTimeMs: number, dtMs: number): void`, called by GameScene **once per frame, only on frames where the clock advanced** (inside the `!this.hidden && !this.paused` branch of `update()`, after the ticks, with `this.publicSheep` from the previous `render()`; or move the call after `render()` and pass `ticks > 0`). Pass `game.loop.rawDelta` clamped to 250 ms (the clock's own clamp). Wrap the call in GameScene's existing view-error guard style (`try … reportError('ui', err)`), not inside the sim guard.~~
  - [x] 6.2 ~~One loop over `sheep` counting `fed`, `hungry`, `starving` (plain number locals; no arrays, closures or `.filter`). The flock's bleat rate per second = `fed × BLEAT_RATE + hungry × 2 × BLEAT_RATE + starving × FRANTIC_RATE`, capped at `MAX_BLEATS_PER_S` so a big flock stays a murmur. `[ASSUMPTION, tune by ear]`: `BLEAT_RATE = 1/20` per sheep per s, `FRANTIC_RATE = 1/4`, `MAX_BLEATS_PER_S = 1.2`. Each frame: `if (Math.random() < rate × dt / 1000)` play one bleat — frantic with probability `starving × FRANTIC_RATE / rate`, else normal. Named constants at the top of the file with the GDD/EXPERIENCE source in a comment.~~
  - [x] 6.3 ~~**Starving entry → `[frantic bleating]`.** Keep the previous frame's starving count. When it rises, play one `sfx-bleat-frantic` immediately (the entry cue), and if `simTimeMs − lastFranticCaptionAt ≥ 60_000` (game time, so pause and a hidden tab do not count) raise the caption and store the time. `resetFlock()` (called from GameScene `create`) sets the previous count to "unknown" so a loaded save full of starving sheep does not fire on its first frame, and resets the caption clock.~~
  - [x] 6.4 ~~The Abomination is a lamb in `PublicSheep`; nothing here may look further (AC 8).~~

- [x] **Task 7: Strings and the caption widget (AC 6)**
  - [x] 7.1 `src/view/strings.ts`: a `captions` group with the UX-DR88 texts: `thud: '[thud]'`, ~~`franticBleating: '[frantic bleating]'`~~ (cut), `suction: '[suction]'`, `screech: '[screech]'`, `fanfare: '[fanfare]'`, `descendingNote: '[descending note]'`, `lastSheep: '[sting] Last sheep!'` (for 5.5; the only "!" allowed in copy).
  - [x] 7.2 New `src/view/hud/Captions.ts`: a pool of 2 caption boxes built once (box texture via `boxTexture` from `widgets/box.ts` with `COMPONENTS.caption` colours and `RADIUS.sm`, text via `textStyle('caption', 'wool')`), hidden until used. `show(text)`: take a free box, else the oldest; set text, resize the box to the text (`boxTexture` per size is cached by key; or a nine-slice/scaled image — follow how `Tooltip.ts` sizes its box), alpha 0.85 for the background only (text at full alpha), show for `CAPTION_MS = 2_500`, then fade out quickly. Visual tweens/timers are fine (they never touch GameState).
  - [x] 7.3 Layout: bottom-centre, the newest just above the bottom bar's top edge with `SPACING[2]` gap, the older one stacked above it. The bar top is `LAYOUT.canvasHeight − LAYOUT.hudBarHeight` (720 − 112 = 608; `constants.ts`) — no literal pixel values except named `[ASSUMPTION]` constants. Make sure captions do not overlap the float popups' rise zone over Farm in a way that hides "+1" (Farm is left; captions are centred — check in the browser). Not interactive (no `setInteractive`).
  - [x] 7.4 HudScene: build `Captions` in `create` at a depth between the banner and the popups (e.g. `CAPTION_DEPTH = 60`); `bus.on('caption:requested', …)` and `bus.on` removal in the SHUTDOWN handler (project-context: listener cleanup); emit `'era:announced'` in `flushEraBanner` (Task 5.8). A restart rebuilds HudScene, so old captions are gone (AC 6).

- [x] **Task 8: Debug hook (AC 7)** — `src/debug/DebugOverlay.ts`
  - [x] 8.1 Add a "Captions: on/off" button that calls `updateSettings({ captions: !getSettings().captions })` and shows the state. DEV only (the file already is).
  - [x] 8.2 Optionally a "Play all SFX" button that plays each marker 400 ms apart for an ear check (through the director's public API, never `sound` directly).

- [x] **Task 9: Verify (AC 11)**
  - [x] 9.1 `npm test`, `npm run typecheck`, `npm run lint` — all green. The sim is untouched, so all seeded tests must be byte-identical; the new tests are `settingsStore.test.ts` (and `bus` typing via typecheck).
  - [x] 9.2 `npm run build` and `npm run preview`; in Chrome and Firefox:
    - Load the page: silent. First click on the title: music starts. Press F/G in game: pops. Restart / Main Menu → Continue: the music does not restart or double.
    - Feed, let a sheep eat (munch), starve one (frantic bleats, then a thud and a dust puff), sell (ding), buy (ding), sacrifice (suction), reveal the Abomination with the debug overlay's tools and sacrifice it (screech then sting, in time with the flash), cross an era up and down with debug Add sheep / sell (fanfare / descending note, once each even at ×16).
    - Toggle captions on in the debug overlay: each captioned cue shows bottom-centre, about 2.5 s, max 2; off: none. Reload: the setting persisted. Restart: still on.
    - Hide the tab: music pauses; come back: it resumes. Pause menu: bleats stop, music plays.
    - 100 sheep (debug Add sheep) at ×1 for 2 minutes: bleats stay a murmur; the debug overlay shows no FPS loss against the same run with audio muted (NFR1).
    - Zero console errors (NFR8). Network tab: only the site's own files (NFR11).
  - [x] 9.3 `ls -l public/assets/audio` — report the sizes in the completion notes.

- [x] **Task 10: Docs and deferred work**
  - [x] 10.1 `_bmad-output/game-architecture.md`: in Asset Management / Event System, record as built: the sprite format and ffmpeg dev-time requirement; the director's page lifetime (created in PreloadScene); the UI events added (`button:activated`, `era:announced`, `caption:requested`, `settings:changed`); and that `src/view/settings.ts` holds the live settings.
  - [x] 10.2 `README.md` (or `docs/`): one line that `npm run assets` needs `ffmpeg` with libvorbis and libmp3lame. CI does not run `assets` (outputs are committed), so CI needs nothing.
  - [x] 10.3 `_bmad-output/implementation-artifacts/deferred-work.md`: mark the audio entries this story resolves (Music on hide; suction; boost cue — decide: no boost cue, see Design decisions; ding on Sold; purchase on Bought; land/decoration/hoe/feeder purchase; era fanfare; death sounds don't tell the cause; screech/sting/[screech]; cure sound) as done in 5.6, and add new entries for: `LastSheep` sting + caption (5.5, already forced by `assertNever`), Volume panel wiring (5.7), real free-pack audio replacing the placeholders, and medicine pick-up/put-back sounds (not in scope).

### Review Findings

- [x] [Review][Patch] (decided: keys count as first input; amend project-context) Keyboard-only players never hear audio — the gate needs a `pointerdown`; Phaser also unlocks on `keydown`, so a player who only uses F/G/Esc gets no music or SFX all session. AC 4 says "first user input", project-context says "first pointer input".
- [x] [Review][Patch] (decided: amend in place, marked as cut) Story ACs and tasks still describe the cut hunger bleats and munch — AC 1 (11 markers), AC 3 (munch row, hunger-bleat paragraph), AC 5, AC 9, the SFX table, Task 6 (ticked) and Task 7.1 still describe removed work; only the Change Log records the cut.
- [x] [Review][Patch] Cues pile up while the window is blurred but visible: pauseOnBlur suspends the AudioContext while the sim keeps running, so every cue started then plays at once on refocus [src/view/audio/AudioDirector.ts:play]
- [x] [Review][Patch] Captions are not throttled: a mass death sends one `[thud]` caption per sheep, which churns tweens and stacks two identical boxes [src/view/audio/AudioDirector.ts:caption]
- [x] [Review][Patch] `updateSettings` merges unvalidated values (NaN, out of range, undefined) into live state, the audio graph and storage [src/view/settings.ts:updateSettings]
- [x] [Review][Patch] The reveal sting can be dropped by the voice cap after the suction and screech take the last slots [src/view/audio/AudioDirector.ts:onSim Sacrificed]
- [x] [Review][Patch] "Play all SFX" records `lastStart` up to about 5 s in the future, muting real cues after the ear check [src/view/audio/AudioDirector.ts:play]
- [x] [Review][Patch] The LambBorn bleat has no pitch jitter (Task 5.5), so every birth sounds identical [src/view/audio/AudioDirector.ts:onSim LambBorn]
- [x] [Review][Patch] ffmpeg stdin has no error listener: an early ffmpeg exit crashes the script with a raw EPIPE instead of the AssetError [scripts/build-assets.ts:ffmpeg]
- [x] [Review][Patch] The audio temp dir leaks if any later sync step throws [scripts/build-assets.ts:main]
- [x] [Review][Patch] `requireFfmpeg` does not check for the libvorbis and libmp3lame encoders [scripts/build-assets.ts:requireFfmpeg]
- [x] [Review][Patch] A non-.wav file in assets/audio/sfx is silently left out of the sprite [scripts/build-assets.ts:listSfx]
- [x] [Review][Patch] Nothing checks that the `SFX` keys match `sfx.json`'s markers (a renamed source ships silently) [src/view/assetKeys.ts:SFX]
- [x] [Review][Patch] The constructor throws if `sfx.json` has no `spritemap`, which also loses the music [src/view/audio/AudioDirector.ts:constructor]
- [x] [Review][Patch] Docs are stale after the cut: deferred-work says "11 SFX"; game-architecture.md:72 still says "hunger-scaled bleats" and :236 still says "idle bleat variation"; the Completion Notes still give 11 SFX, 17.3 s and 1013 KB; the GDD/UX hunger-bleat requirement is not flagged anywhere [_bmad-output/...]
- [x] [Review][Defer] AudioDirector has no unit tests (Phaser does not load in the node test environment; needs a fake SoundManager harness) [src/view/audio/AudioDirector.ts] — deferred, test harness out of scope
- [x] [Review][Defer] `npm run assets` needs ffmpeg even for art-only changes [scripts/build-assets.ts:main] — deferred, by design for now
- [x] [Review][Defer] Re-encoded OGG/MP3 are not byte-reproducible, so each assets run can create binary diffs [scripts/build-assets.ts:buildAudio] — deferred, revisit with real audio
- [x] [Review][Defer] MP3 encoder delay can clip marker tails and leave a gap at the loop seam in Safari [scripts/build-assets.ts:buildAudio] — deferred, check on Safari with real audio
- [x] [Review][Defer] The AudioDirector singleton is never torn down (Vite HMR leaves a stale director) [src/view/audio/AudioDirector.ts:createAudioDirector] — deferred, DEV-only
- [x] [Review][Defer] The debug "Captions" label does not follow `settings:changed` [src/debug/DebugOverlay.ts] — deferred to Story 5.7
- [x] [Review][Defer] If `context.resume()` rejects, UNLOCKED never fires and the page stays silent [src/view/audio/AudioDirector.ts:onFirstPointer] — deferred, rare browser failure

## Dev Notes

### What this story is (and is not)

- **Is:** audio assets (placeholders) + build + load, `AudioDirector` (all sounds, music, bleats, captions), the caption HUD widget, a minimal settings store and live settings module, three small bus events, a debug toggle.
- **Is not:** the Volume panel, sliders, toggles or reduced motion (5.7); `LastSheep` (5.5); names in any text (5.3); any new juice visuals (5.8); credits screen (5.9). **No sim change at all**: no `SimEvent` variant, no `GameState` field, no `SAVE_SCHEMA_VERSION` bump (stays 12).

### SFX table (the sprite's markers)

| Marker | Used for | Character |
|---|---|---|
| `sfx-pop` | button click, F/G, cure (rate 1.3) | soft bubble pop, ~80 ms |
| ~~`sfx-munch`~~ (cut) | ~~eating food, breeding food, a carcass~~ | ~~two quick crunchy noise bursts, ~250 ms~~ |
| `sfx-thud` | every death | short "baa" glide down + a low thump, ~500 ms |
| `sfx-suction` | every sacrifice | rising filtered-noise slurp, ~500 ms |
| `sfx-screech` | Abomination reveal | harsh detuned saw sweep, ~450 ms (comedic, not horror) |
| `sfx-sting` | after the screech; later "Last sheep!" (5.5) | two-note low brass-like stab, ~600 ms |
| `sfx-ding` | sale, purchase | cash-register bell + coin, ~400 ms |
| `sfx-fanfare` | era up | rising major arpeggio, ≤ 1.5 s |
| `sfx-descend` | era down | soft descending three notes, ~800 ms |
| `sfx-bleat` | ambient bleat; lamb born (rate 1.4) | "baa" with vibrato, ~400 ms |
| ~~`sfx-bleat-frantic`~~ (cut) | ~~starving bleat~~ | ~~faster, higher, shakier "baa-aa", ~450 ms~~ |

Eleven sounds plus one music loop matches GDD "About 10 SFX and 1 music loop" and the architecture's marker examples (`sfx-pop`, `sfx-thud`, `sfx-suction`, `sfx-fanfare`, `sfx-sting`).

### Current code to build on (read these first)

- `src/sim/events.ts` — the `SimEvent` union (19 variants). Note: `SheepDied` has **no `name`** yet (5.3), and there is **no `LastSheep`** (5.5) and no `BoostEnded`. Comments at `BoostStarted`, `Bought`, `Cured` already anticipate 5.6.
- `src/view/bus.ts` — `BusEvents` type map. Existing UI events: `farm:pressed`, `farmBreeding:pressed`, `breedTool:pressed`, `hud:rightPressed`, `breedMode:changed`, `shop:toggled`, `sacrifice:landed`, `medicine:pressed`. Add yours with a one-line comment each, in the same style.
- `src/core/eventBus.ts` — emit allocates nothing (copy-on-write lists). Listeners added during an emit run from the next emit.
- `src/view/scenes/PreloadScene.ts` — loads atlases + backgrounds, warns on missing textures with a toast, then starts `TitleScene`. Add audio here (Task 3).
- `src/view/scenes/GameScene.ts` — `update()` (line ~638): input guard → sim guard (`clock.advance`, `tick()`, `render()`) → land / era / shop guards. `tick()` drains sim events onto the bus inside the tick, so `onSim` handlers run mid-tick. `publicSheep` is refilled in `render()`. `hidden`/`paused`/`isLost` gate the clock. `create()` relaunches HudScene and OverlayScene on every restart.
- `src/view/scenes/HudScene.ts` — `onSim` (toasts, popups), `flushEraBanner()` (once-per-frame era fold), SHUTDOWN cleanup pattern, depth constants (`BANNER_DEPTH 50`, `POPUP_DEPTH 100`, `HELD_DOSE_DEPTH 150`, `TOOLTIP_DEPTH 200`).
- `src/view/widgets/Button.ts` — `onDown` / `onUp` call `options.onActivate()` (lines ~324–337). Used by the bottom bar, the Pause button, menus, confirm, lose, placeholders.
- `src/view/hud/EraBanner.ts`, `src/view/widgets/Tooltip.ts`, `src/view/widgets/box.ts` — how HUD components build a box texture and text from `COMPONENTS` / `TYPOGRAPHY`; follow them for `Captions`.
- `src/config/constants.ts` — `SETTINGS_KEY = 'sheepciv.settings'` (exists, unused), `COMPONENTS.caption = { backgroundColor: 'duskDeep', textColor: 'wool', typography: 'caption', rounded: 'sm' }`, `TYPOGRAPHY.caption` (Nunito 18/800/1.3), `LAYOUT`, `SPACING`.
- `src/save/saveStore.ts` — `StorageLike`, `defaultStorage()`, the try/catch + warn-once style, `wipeSave` never touches the settings key.
- `scripts/build-assets.ts` — `AssetError`, `prune`, the "pack everything before writing anything" `main()`; the last line prints the audio placeholder.
- `src/debug/DebugOverlay.ts` — DOM panel, add buttons in its existing style; page-lifetime handlers on `game.events`.
- Phaser 4 audio: `node_modules/phaser/skills/audio-and-sound/SKILL.md` (read it). Verified in the installed source: `load.audioSprite(key, jsonURL, audioURL)`; `addAudioSprite` builds markers from `spritemap[name].start/end` (`BaseSoundManager.js` ~221–240); `WebAudioSoundManager.unlock` listens for `mousedown`/`mouseup`/`keydown`/touch on `document.body` and sets `locked = false`, firing `UNLOCKED`.

### What must be preserved

- Every seeded sim test, unchanged (no sim edits).
- Toast behaviour (DOM, `safetyNet.ts`) — captions are a separate Phaser component, not toasts.
- HudScene's once-per-frame era fold; the banner still plays exactly as before.
- Button behaviour: emitting `'button:activated'` must not change when `onActivate` runs, and a greyed button still never activates.
- The asset script's guarantees: fails before writing on any error; prunes stale outputs; existing atlas/font/cursor/background steps unchanged.
- Secrecy lint: `src/view/audio/` is a view folder, so the secrecy rule applies; `wasAbomination` is a normal property read and allowed (Story 4.4).
- PreloadScene's missing-texture toast stays; audio failure only warns.

### Design decisions (defaults chosen; see Open Questions)

- **Placeholder audio, synthesised** — the project's art is all original placeholders made by throwaway scratchpad scripts and credited as such; audio follows the same pattern so the story is self-contained. Real free-pack audio (Kenney CC0 etc.) can replace the WAVs later with no code change (same file names).
- **ffmpeg as a dev-time tool**, not an npm dependency. Outputs are committed, so CI and deploy never need it.
- **Director lives for the page**, created in PreloadScene, so music survives scene changes and listeners are never doubled by restarts.
- **Locked sounds are dropped, not queued**, so the first click never fires a burst of queued cues.
- **Throttle + voice cap** so a mass death or ×16 speed never stacks dozens of identical sounds.
- **No boost-start/-end cue**: the suction already marks the sacrifice that starts the boost; adding a `BoostEnded` system is a sim change outside this story (deferred-work entry from 2.8 → close as "not needed").
- **No purchase pop on shop rows**: `Bought` → ding is the purchase sound for land, decorations, hoes, feeder and medicine.
- **Era cues from HudScene's fold** via `'era:announced'`, not from `EraChanged`.
- **Settings store now, panel later**: 5.6 needs captions (default off) and volumes to be real settings; 5.7 adds the UI on the same store.

### Architecture compliance

- Sounds only through `AudioDirector` (project-context Engine rules) — nothing else calls `scene.sound` / `game.sound`.
- Only `src/save/` touches `localStorage` (lint-enforced): the store is in `src/save/settingsStore.ts`; `src/view/settings.ts` calls it.
- Copy from `strings.ts`, colours/typography from `COMPONENTS`/`TYPOGRAPHY` (no hex or text literals in components).
- Exhaustive `switch` over `SimEvent['type']` with `assertNever`.
- Listener cleanup on SHUTDOWN for scene-owned listeners (HudScene captions); the director's page-lifetime listeners are documented as such.
- Relative asset URLs only (`base: './'`, GitHub Pages subpath, itch.io iframe).
- No new npm packages.

### Library / framework notes

- **Phaser 4.2.x, not 3.** The sound API is the same shape as v3, but verify any call against the installed source or the bundled skill, not memory. `this.sound` is one shared manager across scenes (`game.sound`).
- `sound.playAudioSprite(key, marker, config)` is fire-and-forget (auto-destroyed on complete). For the music use a retained `sound.add(…, { loop: true })`.
- `SoundConfig.delay` is in **seconds**; marker `start`/`duration` are seconds.
- Web Audio unlock is automatic (body listeners); `sound.locked` and `Phaser.Sound.Events.UNLOCKED` tell you when.
- Encoding: `libvorbis -q:a 3` ≈ 112 kbps max for mono speech-like content (≤ 128 kbps rule); `libmp3lame -b:a 96k`. Desktop Chrome/Firefox/Edge all decode OGG Vorbis and MP3; Phaser picks the first supported URL.

### Testing standards

- Vitest covers `src/sim/` and `src/save/` only — so `settingsStore` gets unit tests; `AudioDirector`, captions and the asset script are verified in the browser (project-context: "Rendering, juice and audio are verified manually"). Never mock Phaser.
- Layout: `tests/save/settingsStore.test.ts`. Use a fake `StorageLike`, no DOM.
- Keep all existing tests green and unchanged.

### Previous story intelligence (Epic 4 and earlier)

- Placeholder assets: a throwaway scratchpad generator, only outputs committed, credited in `assets/CREDITS.md` placeholder rows (1.2, 2.1, 3.4, 4.8).
- Every HUD handler is try/catch → `reportError('ui', …)`, because sim-event handlers run inside GameScene's tick drain (a view throw must not count as a sim error and stop saving).
- Once-per-frame folding (deaths per cause, era banner) exists to survive ×16 debug speed; follow it for sounds.
- Reviews have repeatedly flagged: per-frame allocation, listener double-subscription after restart, literals instead of named `[ASSUMPTION]` constants, and docs left stale. Name every magic number, comment its source.
- Story 4.4 left "screech, sting and `[screech]` wait for AudioDirector (Story 5.6)"; Story 4.3's review requires death audio to be cause-blind.

### Git intelligence

- Recent commits (4.5–4.8, "Close Epic 4") follow: implement → code review with decisions/patches/deferrals → docs (architecture "as built", deferred-work, sprint-status) in the same commit. Commit message style: `Implement story 5.6: Audio pass and captions` with a bullet summary and the Co-Authored-By line.
- 4.8 touched `tuning.ts`, `events.ts`, `assets/CREDITS.md`, atlases, architecture and deferred-work — expect a similar spread here plus `scripts/build-assets.ts` and new `public/assets/audio/`.

### Open questions (defaults chosen; confirm or change)

1. **ffmpeg (blocking for AC 1).** Not installed, and `sudo` needs a password. Default: Rylan runs `! sudo apt install -y ffmpeg` before Task 2. Alternative if that is not wanted: ship WAV only (no OGG/MP3, larger files, breaks AR11's wording) — not recommended.
2. **Story order.** Sprint order is 5.5 (Last sheep) before 5.6. Default: 5.6 ships the sting, the caption string and the director's exhaustive switch; 5.5 adds `LastSheep` and the compiler forces the audio case. If 5.5 is done first instead, add the case here.
3. **Placeholder vs real audio.** Default: synthesised placeholders now (consistent with the art). If Rylan prefers real CC0 packs (e.g. Kenney "Interface Sounds", "Impact Sounds", a CC0 bleat from Freesound, a CC0 cozy loop from OpenGameArt), drop them into `assets/audio/sfx/` with the same names and credit each — the pipeline is format-agnostic (ffmpeg decodes WAV/OGG/MP3/FLAC alike); widen `listSfx` to those extensions if so.
4. **Default volumes** (music 0.5, SFX 0.8) and bleat rates are guesses; tune by ear in Task 9.

### Project Structure Notes

- New: `assets/audio/sfx/*.wav` (11), `assets/audio/music/music.wav`, `public/assets/audio/{sfx.ogg,sfx.mp3,sfx.json,music.ogg,music.mp3}`, `src/view/audio/AudioDirector.ts`, `src/view/hud/Captions.ts`, `src/view/settings.ts`, `src/save/settingsStore.ts`, `tests/save/settingsStore.test.ts`.
- Modified: `scripts/build-assets.ts`, `src/view/assetKeys.ts`, `src/view/bus.ts`, `src/view/strings.ts`, `src/view/widgets/Button.ts`, `src/view/scenes/PreloadScene.ts`, `src/view/scenes/GameScene.ts` (bleat call + `resetFlock`), `src/view/scenes/HudScene.ts` (captions, `era:announced`), `src/debug/DebugOverlay.ts`, `assets/CREDITS.md`, `README.md`, architecture, deferred-work, sprint-status.
- Removed: `assets/audio/.gitkeep`, `src/view/audio/.gitkeep`.
- Matches the architecture tree (`assets/audio/{sfx,music}/`, `public/assets/audio/…`, `src/save/settingsStore.ts`, `src/view/audio/AudioDirector.ts`, HUD "Captions"). Variance: `src/view/settings.ts` (live settings + event) is new; the architecture does not name where live settings live — record it (Task 10.1).

### Project Context Rules

- Phaser 4 APIs only; check the bundled skills/source before using any call from memory.
- No Phaser timers/tweens/sound callbacks may change `GameState`.
- Audio: sounds play only through `AudioDirector`; respect the Web Audio unlock; volumes come from settings, never hard-coded.
- Audio autoplay: nothing plays before the first input; music starts on the Title screen after that input.
- Visibility: on hidden, pause music (AR25).
- No allocation in hot paths (the per-frame bleat update); no logging or `localStorage` in frame code.
- Only `src/save/` touches `localStorage`; wrap every access in try/catch; the game must run with storage unavailable. Keys: `sheepciv.save.v1`, `sheepciv.settings`, `sheepciv.save.v1.bad` only.
- Settings survive Restart (mandatory save test).
- Secrecy: view code uses `PublicSheep` only; `Sacrificed.wasAbomination` is the only truth channel.
- Copy in `strings.ts`; colours from `COLORS`/`COMPONENTS`; no "!" except "Last sheep!".
- Assets: audio OGG+MP3 at ≤ 128 kbps; no unused assets in `public/assets/`; total build < 8 MB; relative URLs only.
- No new npm packages without an architecture update.
- Done = `npm test`, `npm run typecheck`, `npm run lint` pass; audio verified manually in the browser.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 5.6: Audio Pass and Captions]
- [Source: _bmad-output/planning-artifacts/epics.md — AR11, AR25, UX-DR4, UX-DR10, UX-DR45, UX-DR77–UX-DR83, UX-DR87–UX-DR89, NFR3, NFR10, NFR12]
- [Source: _bmad-output/game-architecture.md — Asset Management; Event System; Directory Structure; Naming (audio sprite markers `sfx-<name>`); N2 Abomination (Story 4.4 note on screech/sting)]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-sheep-civilization-2026-10-05/EXPERIENCE.md — Game Feel & Juice; Accessibility Floor (captions); State Patterns (hunger bleats, era regress note)]
- [Source: _bmad-output/planning-artifacts/gdds/gdd-sheep-civilization-2026-10-05/gdd.md — Audio and Music; Hunger table]
- [Source: _bmad-output/project-context.md — Engine rules (Audio), Platform (Audio autoplay, Visibility, Persistence), Performance (Assets)]
- [Source: _bmad-output/implementation-artifacts/deferred-work.md — every "Audio (Story 5.6)" entry, "Music on hide", "Death sounds must not tell the cause"]
- [Source: node_modules/phaser/skills/audio-and-sound/SKILL.md; node_modules/phaser/src/sound/BaseSoundManager.js; src/sound/webaudio/WebAudioSoundManager.js]

## Change Log

- 2026-10-09: Story created (create-story).
- 2026-10-09: Implemented (dev-story): placeholder audio, sprite + music build, AudioDirector, hunger bleats, captions, settings store, debug hooks, docs. Added a first-pointer gate to the autoplay rule (headless Chrome showed a context can start running with no gesture). Status → review.
- 2026-10-09: Cut at Rylan's request: hunger bleats (Task 6, AC 3's bleat part, the `[frantic bleating]` caption) and the munch on eating. Sheep now sound only when a lamb is born (`LambBorn` bleat). Removed `updateFlock`/`resetFlock`, GameScene's `simFrameMs` hook, `sfx-munch` and `sfx-bleat-frantic` (sources, markers, gains) and the caption string; sprite rebuilt (9 SFX, 14.5 s, 973 KB of audio).
- 2026-10-09: Code review: 15 patches applied (incl. keyboard unlock and the AC amendments), 7 deferred, 9 dismissed. Status → done.

## Dev Agent Record

### Agent Model Used

Claude Opus 5.5 (1M context) — `claude-opus-5-5[1m]`
### Debug Log References

- Browser smoke checks: throwaway scratchpad Playwright scripts (playwright-core from the npx cache, system Chrome, Chrome's real autoplay policy, `--mute-audio`) against the dev server, patching `AudioBufferSourceNode.prototype.start/stop` to log which sprite marker or music source played. Not committed.
- First run: the music started with **no input**. Headless Chrome creates the AudioContext `running`, so Phaser never reports `locked`. Fixed by also gating on the first `pointerdown` on `window` (capture, once); re-run: 0 plays before the click.
### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created
- **Task 0:** ffmpeg 8.0.1 installed by Rylan; libvorbis and libmp3lame present.
- **Assets:** 9 SFX (11 before the cut) + a 38.4 s cozy loop (I–V–vi–IV, 100 bpm), synthesised by a throwaway scratchpad Node script (only the WAVs are committed), credited as placeholders. `npm run assets` builds `sfx.ogg` 54 KB (~25 kbps), `sfx.mp3` 209 KB (96 kbps), `sfx.json`, `music.ogg` 312 KB (~65 kbps), `music.mp3` 461 KB (96 kbps). After the cut: a 14.5 s sprite, 973 KB of audio; `dist/` is 2.7 MB in all (NFR3 < 8 MB). Atlases unchanged.
- **Build:** ffmpeg via `execFile` with argument arrays; outputs go to a temp dir and are copied in only after the whole pipeline (atlases included) has built; stale files pruned; a missing ffmpeg fails before anything is written.
- **AudioDirector:** page-lifetime, created in `PreloadScene.create` (wrapped: a failure runs silent). Exhaustive `SimEvent` switch with `assertNever`. Per-cue 60 ms repeat gap and an 8-slot voice ring (a `Float64Array`, no allocation per play beyond Phaser's config object). Music pause on `HIDDEN` / resume on `VISIBLE`. Volumes and captions from `getSettings()`, updated on `settings:changed`.
- **Autoplay gate:** plays need the first page `pointerdown` or `keydown` *and* `!sound.locked`; the music starts on that input. Code review added `keydown` so keyboard-only players hear audio; project-context now says "first user input (a pointer press or a key press)".
- **Bleats (later cut, see Change Log):** `updateFlock` runs after the sim guard in `GameScene.update`, only on frames whose real time went into the clock at speed > 0 (`simFrameMs`), so pause, hidden tab, loss and debug speed 0 are silent. A rise in the Starving count plays a frantic bleat and the `[frantic bleating]` caption at most once per 60 s of game time; `resetFlock()` in `GameScene.create`.
- **Captions:** `src/view/hud/Captions.ts`, two pooled Graphics + Text boxes (box redrawn only when shown), bottom-centre above the bar (y 608), 2.5 s with a 200 ms fade, the oldest replaced. HudScene depth 60, `caption:requested` removed on SHUTDOWN.
- **Bus events added:** `button:activated` (Button.activate, both press and release paths), `era:announced` (HudScene `flushEraBanner`, which now computes `regress` once), `caption:requested`, `settings:changed`.
- **Settings:** `src/save/settingsStore.ts` (defaults music 0.5, SFX 0.8, reduced motion off, captions off; field-by-field fallback; warn once on a failing write) + `src/view/settings.ts`. 19 new tests in `tests/save/settingsStore.test.ts`, including "settings survive Restart".
- **Debug overlay:** "Captions: on/off" and "Play all SFX" (forced plays skip the repeat gap and voice cap).
- **Verified (automated, headless Chrome, before the cut and the code-review fixes; not re-run since):** silent before the first click, music on the first click and started exactly once through New Game; pops on New Game and F ×4; munch on eating; thud on a death; fanfare on +10 sheep (Village) and descend on the regress at ×16; bleats and frantic bleats; all 11 markers decode and play; `[fanfare]` caption drawn bottom-centre above the bar (screenshot); music stops on a simulated hidden tab and resumes at its offset on return; zero console errors, no outside network requests.
- **Not verified here — Rylan's manual pass needed:** listening to the mix by ear; the sacrifice screech → sting timing against the flash (needs a drag into the Better Place); Firefox; FPS with 100 sheep on real hardware (headless runs at ~25 FPS with or without audio, so it says nothing).
- **Code review fixes (2026-10-09):** cues are skipped while the AudioContext is suspended (window blur); the same caption text is not raised again within 1 s; the reveal's screech and sting are forced past the voice cap; forced plays leave no repeat-gap mark (Play all no longer mutes real cues); the lamb bleat gets pitch jitter; a sprite JSON without a spritemap silences only the SFX; `updateSettings` validates every field through `validSettings`. Build: ffmpeg's stdin errors are swallowed (the exit reports), the temp dir is removed in a `finally`, `requireFfmpeg` checks for libvorbis and libmp3lame, and a non-.wav SFX source fails the build. New tests: `validSettings` (3) and `tests/view/assetKeys.test.ts` (SFX keys match `sfx.json`).
- **Tests:** `npm test` 871 passed / 1 skipped (65 files), `npm run typecheck` and `npm run lint` clean.

### File List

- `_bmad-output/game-architecture.md` (modified)
- `_bmad-output/implementation-artifacts/5-6-audio-pass-and-captions.md` (new)
- `_bmad-output/implementation-artifacts/deferred-work.md` (modified)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modified)
- `_bmad-output/project-context.md` (modified: audio unlock on first user input)
- `README.md` (modified)
- `assets/CREDITS.md` (modified)
- `assets/audio/.gitkeep` (deleted)
- `assets/audio/music/music.wav` (new)
- `assets/audio/sfx/{bleat,descend,ding,fanfare,pop,screech,sting,suction,thud}.wav` (new, 9 files; `munch` and `bleat-frantic` were cut)
- `public/assets/audio/{sfx.json,sfx.ogg,sfx.mp3,music.ogg,music.mp3}` (new, generated)
- `scripts/build-assets.ts` (modified)
- `src/debug/DebugOverlay.ts` (modified)
- `src/save/settingsStore.ts` (new)
- `src/view/assetKeys.ts` (modified)
- `src/view/audio/.gitkeep` (deleted)
- `src/view/audio/AudioDirector.ts` (new)
- `src/view/bus.ts` (modified)
- `src/view/hud/Captions.ts` (new)
- `src/view/scenes/GameScene.ts` (comment only, after the bleat cut)
- `src/view/scenes/HudScene.ts` (modified)
- `src/view/scenes/PreloadScene.ts` (modified)
- `src/view/settings.ts` (new)
- `src/view/strings.ts` (modified)
- `src/view/widgets/Button.ts` (modified)
- `tests/save/settingsStore.test.ts` (new)
- `tests/view/assetKeys.test.ts` (new, code review)
