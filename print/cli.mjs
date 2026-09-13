// ==================================================================
// PRINT RENDERER COMMAND LINE
// ------------------------------------------------------------------

// Usage: npm run render -- <variant> [<variant> ...]
// Writes out/latest/<variant>/map.svg and overview.png (working copies;
// comparison rounds are snapshotted separately).

import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadStyle } from './styles.mjs';
import { renderMap } from './render.mjs';
import { renderPng } from './png.mjs';

// ------------------------------------------------------------------

const ROOT              = resolve(fileURLToPath(import.meta.url), '../..');
const OVERVIEW_WIDTH_PX = 4000;

// ------------------------------------------------------------------

const [command, ...variantNames] = process.argv.slice(2);

if (command !== 'render' || variantNames.length === 0) {
  console.error('Usage: npm run render -- <variant> [<variant> ...]');
  process.exit(1);
}

for (const name of variantNames) {

  const startMs = performance.now();
  const { svg, notes } = renderMap(await loadStyle(name));

  const outDir = join(ROOT, 'out', 'latest', name);
  await mkdir(outDir, { recursive: true });
  await writeFile(join(outDir, 'map.svg'), svg);
  await writeFile(join(outDir, 'overview.png'), renderPng(svg, OVERVIEW_WIDTH_PX));

  const sizeMb  = (Buffer.byteLength(svg) / 1e6).toFixed(1);
  const seconds = ((performance.now() - startMs) / 1000).toFixed(1);
  console.log(`${name}: map.svg (${sizeMb} MB) + overview.png (${OVERVIEW_WIDTH_PX} px) in ${seconds} s -> ${outDir}`);
  notes.forEach(note => console.log(`  ${note}`));
}
