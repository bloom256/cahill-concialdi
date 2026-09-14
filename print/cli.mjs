// ==================================================================
// PRINT RENDERER COMMAND LINE
// ------------------------------------------------------------------

// Usage:
//   npm run render -- <variant> [<variant> ...]
//     Working copies in out/latest/<variant>/.
//   npm run round -- <variant or prefix*> [...]
//     A comparison round in out/rounds/<round>/ with a gallery (index.html),
//     plus its manifest in docs/print/rounds/<round>.json (commit it).
// Each variant folder gets map.svg, overview.png, thumb.jpg, and crops/*.png.
// A name ending in * selects every style starting with that prefix, in name order.

import sharp from 'sharp';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadStyle } from './styles.mjs';
import { renderMap } from './render.mjs';
import { renderPng } from './png.mjs';
import { renderCrops } from './crops.mjs';
import { writeGallery } from './gallery.mjs';
import { writeRoundViews } from './round-views.mjs';

// ------------------------------------------------------------------

const ROOT              = resolve(fileURLToPath(import.meta.url), '../..');
const OVERVIEW_WIDTH_PX = 4000;
const THUMB_WIDTH_PX    = 1000;
const THUMB_QUALITY     = 85;

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

const [command, ...patterns] = process.argv.slice(2);

if (!['render', 'round'].includes(command) || patterns.length === 0) {
  console.error('Usage: npm run render -- <variant> [...]  |  npm run round -- <variant or prefix*> [...]');
  process.exit(1);
}

const variantNames = await expandVariantNames(patterns);

if (command === 'render') {
  for (const name of variantNames) await renderVariant(name, join(ROOT, 'out', 'latest', name));
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
