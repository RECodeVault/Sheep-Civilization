// Asset pipeline (`npm run assets`): packs the source PNGs in assets/art/ into the two runtime
// atlases and syncs the fonts and CSS cursors, writing everything to public/assets/ (committed, so deploy is
// `vite build` only). Run by Node 24 type stripping: erasable TypeScript only, one file.
import { copyFile, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
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

async function main(): Promise<void> {
  // Pack everything before writing anything, so a failure never leaves public/assets/ half-updated.
  const packed: PackedAtlas[] = [];
  for (const a of ATLASES) packed.push(await packAtlas(a.name, a.folders));

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
  console.log('[assets] audio: none yet (Story 5.6)');
}

main().catch((err: unknown) => {
  console.error(err instanceof AssetError ? `[assets] ${err.message}` : err);
  process.exitCode = 1;
});
