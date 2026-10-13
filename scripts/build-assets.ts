// Asset pipeline (`npm run assets`): packs the source PNGs in assets/art/ into the two runtime
// atlases, syncs the fonts, CSS cursors and era backgrounds, and builds the SFX audio sprite and the
// music loop (Story 5.6), writing everything to public/assets/ (committed, so deploy is `vite build`
// only). Run by Node 24 type stripping: erasable TypeScript only, one file.
// Audio needs ffmpeg (with libvorbis and libmp3lame) on PATH; only this script does, never CI.
// `--no-audio` (`npm run assets:art`) skips the audio and leaves public/assets/audio/ as it is, so an
// art-only change needs no ffmpeg.
import { execFile, spawnSync } from 'node:child_process';
import { copyFile, mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { packAsync } from 'free-tex-packer-core';
import type { PackerExporterType, PackerType, TexturePackerOptions } from 'free-tex-packer-core';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ART = path.join(ROOT, 'assets', 'art');
const OUT_ATLASES = path.join(ROOT, 'public', 'assets', 'atlases');
const SRC_FONTS = path.join(ROOT, 'assets', 'fonts');
const OUT_FONTS = path.join(ROOT, 'public', 'assets', 'fonts');
// CSS cursors (the Breed tool's heart) are loose PNGs, not atlas frames: the browser draws them.
const SRC_CURSORS = path.join(ROOT, 'assets', 'cursors');
const OUT_CURSORS = path.join(ROOT, 'public', 'assets', 'cursors');
// Era backgrounds are 4 separate images, not atlas frames (architecture: large, swapped rarely). The file
// names are the sim's Era ids, which double as texture keys (Story 3.5).
const SRC_BACKGROUNDS = path.join(ART, 'backgrounds');
const OUT_BACKGROUNDS = path.join(ROOT, 'public', 'assets', 'backgrounds');
const ERA_BACKGROUNDS: readonly string[] = ['pasture.png', 'town.png', 'village.png', 'wool-empire.png'];

// Story 5.6: SFX sources (one sprite marker each, `sfx-<file name>`) and the one music loop.
const SRC_SFX = path.join(ROOT, 'assets', 'audio', 'sfx');
const SRC_MUSIC = path.join(ROOT, 'assets', 'audio', 'music', 'music.wav');
const OUT_AUDIO = path.join(ROOT, 'public', 'assets', 'audio');
// The sprite is decoded and joined as 16-bit mono PCM at this rate, whatever the sources are.
const AUDIO_RATE = 44_100;
// Silence after each sound: no bleed between markers, and room for the MP3 encoder's start delay
// (about 26 ms) to shift a marker without clipping its neighbour.
const SPRITE_GAP_S = 1;
// Project-context: audio at ≤ 128 kbps. Vorbis q3 is about 112 kbps at most; MP3 is a fixed 96 kbps.
const OGG_ARGS: readonly string[] = ['-c:a', 'libvorbis', '-q:a', '3'];
const MP3_ARGS: readonly string[] = ['-c:a', 'libmp3lame', '-b:a', '96k'];

const MAX_SIZE = 2048;
// Frame names are kebab-case `entity-state[-n]` (architecture, Game Assets naming).
const FRAME_NAME = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const ATLASES: readonly { name: string; folders: readonly string[] }[] = [
  { name: 'sheep-world', folders: ['sheep', 'world'] },
  { name: 'ui', folders: ['ui'] },
];

class AssetError extends Error {}

interface PackedAtlas {
  name: string;
  png: Buffer;
  json: Buffer;
  frames: number;
  width: number;
  height: number;
}

/** PNG frames in one art folder. Every configured folder must exist and be readable. */
async function listPngs(folder: string): Promise<string[]> {
  const dir = path.join(ART, folder);
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    throw new AssetError(`assets/art/${folder}/ is ${code === 'ENOENT' ? 'missing' : `unreadable (${code})`}`);
  }
  const pngs: string[] = [];
  for (const e of entries) {
    if (!e.name.toLowerCase().endsWith('.png')) continue;
    if (!e.isFile()) throw new AssetError(`${folder}/${e.name} is not a file`);
    if (!e.name.endsWith('.png')) throw new AssetError(`${folder}/${e.name}: use a lowercase .png extension`);
    pngs.push(e.name);
  }
  return pngs.sort();
}

async function packAtlas(name: string, folders: readonly string[]): Promise<PackedAtlas> {
  const images: { path: string; contents: Buffer }[] = [];
  const seen = new Map<string, string>();
  for (const folder of folders) {
    for (const file of await listPngs(folder)) {
      const frame = file.slice(0, -'.png'.length);
      if (!FRAME_NAME.test(frame)) {
        throw new AssetError(`${folder}/${file}: frame name "${frame}" is not kebab-case entity-state[-n]`);
      }
      const other = seen.get(frame);
      if (other !== undefined) {
        throw new AssetError(`${name}: frame "${frame}" exists in both ${other}/ and ${folder}/`);
      }
      seen.set(frame, folder);
      images.push({ path: file, contents: await readFile(path.join(ART, folder, file)) });
    }
  }
  if (images.length === 0) throw new AssetError(`${name}: no PNGs in assets/art/{${folders.join(',')}}/`);

  const options: TexturePackerOptions = {
    textureName: name,
    width: MAX_SIZE,
    height: MAX_SIZE,
    fixedSize: false,
    powerOfTwo: false,
    padding: 2,
    extrude: 1, // no nearest-neighbour bleed between frames
    allowRotation: false,
    allowTrim: false, // stable frame sizes keep animations aligned
    detectIdentical: true,
    removeFileExtension: true,
    prependFolderName: false,
    exporter: 'JsonHash' as PackerExporterType,
    packer: 'OptimalPacker' as PackerType,
    tinify: false, // never: it calls a web service
  };
  const files = await packAsync(images, options);

  const pngs = files.filter((f) => f.name.endsWith('.png'));
  const jsons = files.filter((f) => f.name.endsWith('.json'));
  if (pngs.length !== 1 || jsons.length !== 1) {
    throw new AssetError(`${name}: packed into ${pngs.length} textures; it must fit one ${MAX_SIZE}² atlas`);
  }
  const atlas = JSON.parse(jsons[0].buffer.toString('utf8')) as {
    frames: Record<string, unknown>;
    meta: { image: string; size: { w: number; h: number } };
  };
  if (atlas.meta.image !== `${name}.png`) {
    throw new AssetError(`${name}: atlas meta.image is "${atlas.meta.image}", expected "${name}.png"`);
  }

  return {
    name,
    png: pngs[0].buffer,
    json: jsons[0].buffer,
    frames: Object.keys(atlas.frames).length,
    width: atlas.meta.size.w,
    height: atlas.meta.size.h,
  };
}

/** Deletes files in `dir` that the pipeline no longer produces (no unused assets in public/). */
async function prune(dir: string, keep: ReadonlySet<string>): Promise<void> {
  for (const f of await readdir(dir)) {
    if (keep.has(f)) continue;
    await rm(path.join(dir, f), { recursive: true });
    console.log(`[assets] removed stale ${path.relative(ROOT, path.join(dir, f))}`);
  }
}

async function syncFonts(): Promise<void> {
  await mkdir(OUT_FONTS, { recursive: true });
  const fonts = (await readdir(SRC_FONTS)).filter((f) => f.endsWith('.woff2')).sort();
  for (const f of fonts) await copyFile(path.join(SRC_FONTS, f), path.join(OUT_FONTS, f));
  await prune(OUT_FONTS, new Set(fonts));
  console.log(`[assets] fonts: ${fonts.length} copied`);
}

async function syncCursors(): Promise<void> {
  await mkdir(OUT_CURSORS, { recursive: true });
  const cursors = (await readdir(SRC_CURSORS)).filter((f) => f.endsWith('.png')).sort();
  for (const f of cursors) await copyFile(path.join(SRC_CURSORS, f), path.join(OUT_CURSORS, f));
  await prune(OUT_CURSORS, new Set(cursors));
  console.log(`[assets] cursors: ${cursors.length} copied`);
}

// Each era background's size in px (src/view/field/EraBackground.ts FRAME_W × FRAME_H): the strips it
// draws are cut at fixed texture coordinates, so other art fails the build rather than drawing wrong.
const BACKGROUND_W = 864;
const BACKGROUND_H = 344;

/**
 * Checks the four era backgrounds and returns their file names, before anything is written. Other files
 * (.DS_Store, Thumbs.db) are ignored; a missing, misnamed, non-file or wrongly sized background fails.
 */
async function listBackgrounds(): Promise<string[]> {
  let entries;
  try {
    entries = await readdir(SRC_BACKGROUNDS, { withFileTypes: true });
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    throw new AssetError(`assets/art/backgrounds/ is ${code === 'ENOENT' ? 'missing' : `unreadable (${code})`}`);
  }
  const pngs = entries.filter((e) => e.name.toLowerCase().endsWith('.png'));
  const names = pngs.map((e) => e.name).sort();
  if (names.join() !== ERA_BACKGROUNDS.join()) {
    throw new AssetError(`assets/art/backgrounds/ must hold exactly ${ERA_BACKGROUNDS.join(', ')}; found ${names.join(', ') || 'no PNGs'}`);
  }
  for (const e of pngs) {
    if (!e.isFile()) throw new AssetError(`backgrounds/${e.name} is not a file`);
    // PNG: 8-byte signature, then the IHDR chunk, whose data starts with width and height (big-endian).
    const head = (await readFile(path.join(SRC_BACKGROUNDS, e.name))).subarray(0, 24);
    if (head.length < 24 || head.toString('latin1', 12, 16) !== 'IHDR') {
      throw new AssetError(`backgrounds/${e.name} is not a PNG`);
    }
    const w = head.readUInt32BE(16);
    const h = head.readUInt32BE(20);
    if (w !== BACKGROUND_W || h !== BACKGROUND_H) {
      throw new AssetError(`backgrounds/${e.name} is ${w}×${h}; era backgrounds must be ${BACKGROUND_W}×${BACKGROUND_H}`);
    }
  }
  return names;
}

/** Copies the checked era backgrounds and prunes stale ones. */
async function syncBackgrounds(files: readonly string[]): Promise<void> {
  await mkdir(OUT_BACKGROUNDS, { recursive: true });
  for (const f of files) await copyFile(path.join(SRC_BACKGROUNDS, f), path.join(OUT_BACKGROUNDS, f));
  await prune(OUT_BACKGROUNDS, new Set(files));
  console.log(`[assets] backgrounds: ${files.length} copied`);
}

// --- Audio (Story 5.6) -----------------------------------------------------------------------

/** Phaser's audiosprite JSON: `spritemap` entries become markers of duration `end − start` (seconds). */
interface SpriteJson {
  resources: string[];
  spritemap: Record<string, { start: number; end: number; loop: boolean }>;
}

interface BuiltAudio {
  /** Temp dir holding the five outputs, moved into public/assets/audio/ only after everything built. */
  dir: string;
  files: readonly string[];
  sfx: number;
  spriteS: number;
  musicS: number;
}

const AUDIO_FILES: readonly string[] = ['sfx.json', 'sfx.ogg', 'sfx.mp3', 'music.ogg', 'music.mp3'];

/** ffmpeg on the PATH with both encoders the outputs need (some builds ship without libmp3lame). */
function requireFfmpeg(): void {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-encoders'], { encoding: 'utf8' });
  if (r.error !== undefined || r.status !== 0) {
    throw new AssetError('ffmpeg is required for audio (sudo apt install ffmpeg); nothing was written');
  }
  for (const enc of ['libvorbis', 'libmp3lame']) {
    if (!new RegExp(`\\b${enc}\\b`).test(r.stdout)) {
      throw new AssetError(`ffmpeg has no ${enc} encoder (install a full ffmpeg build); nothing was written`);
    }
  }
}

/** Runs ffmpeg with an argument array (never a shell string); optional stdin; resolves with stdout. */
function ffmpeg(args: readonly string[], input?: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const child = execFile(
      'ffmpeg',
      ['-y', '-hide_banner', '-loglevel', 'error', ...args],
      { encoding: 'buffer', maxBuffer: 256 * 1024 * 1024 },
      (err, stdout, stderr) => {
        if (err)
          reject(new AssetError(`ffmpeg ${args.join(' ')} failed: ${stderr.toString('utf8').trim() || err.message}`));
        else resolve(stdout);
      },
    );
    // An early ffmpeg exit closes stdin mid-write (EPIPE); the exit callback above reports the real error.
    child.stdin?.on('error', () => {});
    if (input !== undefined) child.stdin?.end(input);
  });
}

/**
 * The SFX sources, sorted. Every one must be a lowercase-.wav file with a kebab-case name; any other
 * file (an .ogg from a free pack, say) fails loudly rather than silently missing from the sprite.
 */
async function listSfx(): Promise<string[]> {
  let entries;
  try {
    entries = await readdir(SRC_SFX, { withFileTypes: true });
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    throw new AssetError(`assets/audio/sfx/ is ${code === 'ENOENT' ? 'missing' : `unreadable (${code})`}`);
  }
  const names: string[] = [];
  for (const e of entries) {
    if (e.name.startsWith('.')) continue;
    if (!e.name.toLowerCase().endsWith('.wav')) {
      throw new AssetError(`audio/sfx/${e.name}: only .wav sources are built (convert it first)`);
    }
    if (!e.isFile()) throw new AssetError(`audio/sfx/${e.name} is not a file`);
    if (!e.name.endsWith('.wav')) throw new AssetError(`audio/sfx/${e.name}: use a lowercase .wav extension`);
    const name = e.name.slice(0, -'.wav'.length);
    if (!FRAME_NAME.test(name)) throw new AssetError(`audio/sfx/${e.name}: "${name}" is not kebab-case`);
    names.push(name);
  }
  if (names.length === 0) throw new AssetError('no .wav files in assets/audio/sfx/');
  return names.sort();
}

const PCM_IN: readonly string[] = ['-f', 's16le', '-ac', '1', '-ar', String(AUDIO_RATE)];
const round3 = (s: number): number => Math.round(s * 1000) / 1000;

/** Builds the sprite and the music into a temp dir. Writes nothing under public/. */
async function buildAudio(): Promise<BuiltAudio> {
  requireFfmpeg();
  const names = await listSfx();
  try {
    if (!(await stat(SRC_MUSIC)).isFile()) throw new AssetError('assets/audio/music/music.wav is not a file');
  } catch (err) {
    if (err instanceof AssetError) throw err;
    throw new AssetError('assets/audio/music/music.wav is missing');
  }

  const gap = Buffer.alloc(Math.round(SPRITE_GAP_S * AUDIO_RATE) * 2);
  const parts: Buffer[] = [];
  const json: SpriteJson = { resources: ['sfx.ogg', 'sfx.mp3'], spritemap: {} };
  let samples = 0;
  for (const name of names) {
    // Decoded to the sprite's PCM format, so sources of any rate or channel count join cleanly.
    const pcm = await ffmpeg(['-i', path.join(SRC_SFX, `${name}.wav`), ...PCM_IN, '-']);
    if (pcm.length < 2) throw new AssetError(`audio/sfx/${name}.wav decoded to no audio`);
    const start = samples / AUDIO_RATE;
    samples += pcm.length / 2;
    json.spritemap[`sfx-${name}`] = { start: round3(start), end: round3(samples / AUDIO_RATE), loop: false };
    parts.push(pcm, gap);
    samples += gap.length / 2;
  }
  const joined = Buffer.concat(parts);

  const dir = await mkdtemp(path.join(os.tmpdir(), 'sheepciv-audio-'));
  try {
    const pcmArgs = [...PCM_IN, '-i', '-'];
    await ffmpeg([...pcmArgs, ...OGG_ARGS, path.join(dir, 'sfx.ogg')], joined);
    await ffmpeg([...pcmArgs, ...MP3_ARGS, path.join(dir, 'sfx.mp3')], joined);
    await writeFile(path.join(dir, 'sfx.json'), `${JSON.stringify(json, null, 2)}\n`);
    // Music: mono at the sprite's rate (half the size of stereo; the loop is a soft mono mix).
    const musicPcm = await ffmpeg(['-i', SRC_MUSIC, ...PCM_IN, '-']);
    await ffmpeg([...pcmArgs, ...OGG_ARGS, path.join(dir, 'music.ogg')], musicPcm);
    await ffmpeg([...pcmArgs, ...MP3_ARGS, path.join(dir, 'music.mp3')], musicPcm);
    return {
      dir,
      files: AUDIO_FILES,
      sfx: names.length,
      spriteS: samples / AUDIO_RATE,
      musicS: musicPcm.length / 2 / AUDIO_RATE,
    };
  } catch (err) {
    await rm(dir, { recursive: true, force: true });
    throw err;
  }
}

/** Copies the built audio into public/assets/audio/ and prunes stale files (main removes the temp dir). */
async function syncAudio(a: BuiltAudio): Promise<void> {
  await mkdir(OUT_AUDIO, { recursive: true });
  let bytes = 0;
  for (const f of a.files) {
    await copyFile(path.join(a.dir, f), path.join(OUT_AUDIO, f));
    bytes += (await stat(path.join(OUT_AUDIO, f))).size;
  }
  await prune(OUT_AUDIO, new Set(a.files));
  console.log(
    `[assets] audio: ${a.sfx} sfx in sprite (${a.spriteS.toFixed(1)} s), music ${a.musicS.toFixed(1)} s, total ${Math.round(bytes / 1024)} KB`,
  );
}

const NO_AUDIO_FLAG = '--no-audio';

/** True for `--no-audio`; any other argument is an error, so a typo never silently skips the audio. */
function parseArgs(args: readonly string[]): { audio: boolean } {
  for (const a of args) if (a !== NO_AUDIO_FLAG) throw new AssetError(`unknown argument ${a} (only ${NO_AUDIO_FLAG})`);
  return { audio: !args.includes(NO_AUDIO_FLAG) };
}

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));
  // Pack everything before writing anything, so a failure never leaves public/assets/ half-updated.
  const packed: PackedAtlas[] = [];
  for (const a of ATLASES) packed.push(await packAtlas(a.name, a.folders));
  const backgrounds = await listBackgrounds();
  if (!opts.audio) {
    await writeAll(packed, backgrounds, null);
    console.log(`[assets] audio: skipped (${NO_AUDIO_FLAG}); public/assets/audio/ left as it is`);
    return;
  }
  const audio = await buildAudio();
  try {
    await writeAll(packed, backgrounds, audio);
  } finally {
    // Gone after a failed write as well as a good one (syncAudio has already copied out of it).
    await rm(audio.dir, { recursive: true, force: true });
  }
}

/** `audio` null: skipped (`--no-audio`). */
async function writeAll(packed: PackedAtlas[], backgrounds: string[], audio: BuiltAudio | null): Promise<void> {
  await mkdir(OUT_ATLASES, { recursive: true });
  const keep = new Set<string>();
  for (const a of packed) {
    await writeFile(path.join(OUT_ATLASES, `${a.name}.json`), a.json);
    await writeFile(path.join(OUT_ATLASES, `${a.name}.png`), a.png);
    keep.add(`${a.name}.json`).add(`${a.name}.png`);
    console.log(`[assets] ${a.name}: ${a.frames} frames, ${a.width}×${a.height}`);
  }
  await prune(OUT_ATLASES, keep);
  await syncFonts();
  await syncCursors();
  await syncBackgrounds(backgrounds);
  if (audio !== null) await syncAudio(audio);
}

main().catch((err: unknown) => {
  console.error(err instanceof AssetError ? `[assets] ${err.message}` : err);
  process.exitCode = 1;
});
