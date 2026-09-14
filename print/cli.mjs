// ==================================================================
// PRINT RENDERER COMMAND LINE
// ------------------------------------------------------------------

// Usage:
//   npm run render -- <variant> [<variant> ...]
//     Working copies in out/latest/<variant>/.
//   npm run round -- <variant or prefix*> [...]
//     A comparison round in out/rounds/<round>/ with a gallery (index.html) and
//     by-view image folders, plus its manifest in docs/print/rounds/<round>.json.
//   npm run export -- <variant> [...] [--dpi 300]
//     Print files in out/export/<variant>/: map.svg, map.tif (LZW), map.jpg,
//     preview.jpg, and detail-europe.jpg (a 100% pixel crop to judge sharpness).
// render and round write map.svg, overview.png, thumb.jpg, and crops/*.png per
// variant. A name ending in * selects every style starting with that prefix.

import sharp from 'sharp';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readdir, stat, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LatLon } from '../data-types.mjs';
import { project } from '../concialdi.mjs';
import { loadStyle } from './styles.mjs';
import { renderMap } from './render.mjs';
import { renderPng, renderRaw } from './png.mjs';
import { renderCrops } from './crops.mjs';
import { writeGallery } from './gallery.mjs';
import { writeRoundViews } from './round-views.mjs';

// ------------------------------------------------------------------

const ROOT                = resolve(fileURLToPath(import.meta.url), '../..');
const MM_PER_INCH         = 25.4;
const OVERVIEW_WIDTH_PX   = 4000;
const THUMB_WIDTH_PX      = 1000;
const THUMB_QUALITY       = 85;
const EXPORT_DEFAULT_DPI  = 300;
const EXPORT_JPEG_QUALITY = 95;
const PREVIEW_WIDTH_PX    = 2400;
const DETAIL_CENTER       = { lat: 50, lon: 12 };  // central Europe
const DETAIL_WIDTH_PX     = 3000;
const DETAIL_HEIGHT_PX    = 2000;

// ------------------------------------------------------------------

// Renders one variant into outDir; returns its summary for rounds
async function renderVariant(name, outDir) {

  const startMs = performance.now();
  const style = await loadStyle(name);
  const { svg, notes, toPage } = await renderMap(style);

  await mkdir(join(outDir, 'crops'), { recursive: true });
  await writeFile(join(outDir, 'map.svg'), svg);
  const overview = renderPng(svg, OVERVIEW_WIDTH_PX);
  await writeFile(join(outDir, 'overview.png'), overview);
  await sharp(overview).resize({ width: THUMB_WIDTH_PX }).jpeg({ quality: THUMB_QUALITY }).toFile(join(outDir, 'thumb.jpg'));
  const crops = renderCrops(svg, toPage);
  for (const crop of crops) await writeFile(join(outDir, 'crops', `${crop.name}.png`), crop.png);

  const sizeMb  = (Buffer.byteLength(svg) / 1e6).toFixed(1);
  const seconds = ((performance.now() - startMs) / 1000).toFixed(1);
  console.log(`${name}: map.svg (${sizeMb} MB), overview, thumbnail, ${crops.length} crops in ${seconds} s -> ${outDir}`);
  notes.forEach(note => console.log(`  ${note}`));

  return { name, description: style.description ?? '', crops: crops.map(crop => crop.name) };
}

// ------------------------------------------------------------------

// Renders one variant at print resolution into out/export/<variant>/
async function exportVariant(name, dpi) {

  const startMs = performance.now();
  const style = await loadStyle(name);
  if (style.imagery?.show) style.imagery = { ...style.imagery, dpi };
  const { svg, notes, toPage, page } = await renderMap(style);

  const outDir = join(ROOT, 'out', 'export', name);
  await mkdir(outDir, { recursive: true });
  await writeFile(join(outDir, 'map.svg'), svg);

  const pxPerMm = dpi / MM_PER_INCH;
  const { pixels, width, height } = renderRaw(svg, Math.round(page.widthMm * pxPerMm));
  const image = sharp(pixels, { raw: { width, height, channels: 4 }, limitInputPixels: false })
    .removeAlpha()
    .withMetadata({ density: dpi });

  await image.clone().tiff({ compression: 'lzw', predictor: 'horizontal' }).toFile(join(outDir, 'map.tif'));
  await image.clone().jpeg({ quality: EXPORT_JPEG_QUALITY, chromaSubsampling: '4:4:4' }).toFile(join(outDir, 'map.jpg'));
  await image.clone().resize({ width: PREVIEW_WIDTH_PX }).jpeg({ quality: THUMB_QUALITY }).toFile(join(outDir, 'preview.jpg'));

  const [centerX, centerY] = toPage(project(new LatLon(DETAIL_CENTER.lat, DETAIL_CENTER.lon)))
    .map(mm => Math.round(mm * pxPerMm));
  await image.clone()
    .extract({
      left  : Math.max(0, Math.min(width  - DETAIL_WIDTH_PX , centerX - DETAIL_WIDTH_PX  / 2)),
      top   : Math.max(0, Math.min(height - DETAIL_HEIGHT_PX, centerY - DETAIL_HEIGHT_PX / 2)),
      width : DETAIL_WIDTH_PX,
      height: DETAIL_HEIGHT_PX,
    })
    .jpeg({ quality: EXPORT_JPEG_QUALITY })
    .toFile(join(outDir, 'detail-europe.jpg'));

  const getSizeMb = async filename => ((await stat(join(outDir, filename))).size / 1e6).toFixed(0);
  const seconds = ((performance.now() - startMs) / 1000).toFixed(1);
  console.log(
    `${name}: ${width}x${height} px at ${dpi} dpi = ` +
    `${(page.widthMm / 10).toFixed(1)} x ${(page.heightMm / 10).toFixed(1)} cm in ${seconds} s -> ${outDir}`
  );
  console.log(
    `  map.tif ${await getSizeMb('map.tif')} MB, map.jpg ${await getSizeMb('map.jpg')} MB, ` +
    `map.svg ${await getSizeMb('map.svg')} MB, preview.jpg, detail-europe.jpg`
  );
  notes.forEach(note => console.log(`  ${note}`));
}

// ------------------------------------------------------------------

// Expands names ending in * to all style names with that prefix
async function expandVariantNames(patterns) {
  const available = (await readdir(join(ROOT, 'print', 'styles')))
    .filter(filename => filename.endsWith('.mjs'))
    .map(filename => filename.slice(0, -'.mjs'.length))
    .sort();
  return patterns.flatMap(pattern => {
    if (!pattern.endsWith('*')) return [pattern];
    const matches = available.filter(name => name.startsWith(pattern.slice(0, -1)));
    if (!matches.length) throw new Error(`No styles match ${pattern}`);
    return matches;
  });
}

// Returns the next free round name for today: YYYY-MM-DD-rN
function getNextRoundName() {
  const date = new Date().toISOString().slice(0, 10);
  for (let number = 1; ; number++) {
    const round = `${date}-r${number}`;
    if (
      !existsSync(join(ROOT, 'out', 'rounds', round)) &&
      !existsSync(join(ROOT, 'docs', 'print', 'rounds', `${round}.json`))
    ) return round;
  }
}

const runGit = args => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();

// ------------------------------------------------------------------

const [command, ...args] = process.argv.slice(2);

const dpiFlagIdx = args.indexOf('--dpi');
const dpi = dpiFlagIdx >= 0 ? Number(args[dpiFlagIdx + 1]) : EXPORT_DEFAULT_DPI;
const patterns = args.filter((_, idx) => dpiFlagIdx < 0 || (idx !== dpiFlagIdx && idx !== dpiFlagIdx + 1));

if (!['render', 'round', 'export'].includes(command) || patterns.length === 0 || !(dpi > 0)) {
  console.error(
    'Usage: npm run render -- <variant> [...]  |  npm run round -- <variant or prefix*> [...]  |  ' +
    'npm run export -- <variant> [...] [--dpi 300]'
  );
  process.exit(1);
}

const variantNames = await expandVariantNames(patterns);

if (command === 'render') {
  for (const name of variantNames) await renderVariant(name, join(ROOT, 'out', 'latest', name));
}
else if (command === 'export') {
  for (const name of variantNames) await exportVariant(name, dpi);
}
else {
  const round = getNextRoundName();
  const roundDir = join(ROOT, 'out', 'rounds', round);
  const variants = [];
  for (const name of variantNames) variants.push(await renderVariant(name, join(roundDir, name)));

  await writeGallery(roundDir, { round, variants });
  const viewsDir = await writeRoundViews(roundDir, variants);

  const manifest = {
    round,
    created : new Date().toISOString(),
    commit  : runGit(['rev-parse', '--short', 'HEAD']),
    dirty   : runGit(['status', '--porcelain']) !== '',
    variants: variants.map(({ name, description }) => ({ name, description, rating: null, notes: '' })),
    decision: '',
  };
  const manifestPath = join(ROOT, 'docs', 'print', 'rounds', `${round}.json`);
  await mkdir(join(ROOT, 'docs', 'print', 'rounds'), { recursive: true });
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');

  console.log(`Round ${round}: ${variants.length} variants`);
  console.log(`  gallery : ${join(roundDir, 'index.html')}`);
  console.log(`  images  : ${viewsDir} (one folder per view, files named by variant)`);
  console.log(`  manifest: ${manifestPath}`);
}
