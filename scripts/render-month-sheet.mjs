// ==================================================================
// BLUE MARBLE MONTH SHEET
// ------------------------------------------------------------------

// Renders the geo-blue-marble look once for each month of 2004 and arranges
// the results in a labeled 4x3 contact sheet, to choose a month visually.
// Needs all 12 months in data/raw/bmng/ (npm run fetch-imagery).
// Usage: npm run month-sheet   -> out/sheets/blue-marble-months.png

import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadStyle } from '../print/styles.mjs';
import { renderMap } from '../print/render.mjs';
import { renderPng } from '../print/png.mjs';

// ------------------------------------------------------------------

const ROOT            = resolve(fileURLToPath(import.meta.url), '../..');
const OUT_FILE        = join(ROOT, 'out', 'sheets', 'blue-marble-months.png');
const TILE_WIDTH_PX   = 1200;
const LABEL_HEIGHT_PX = 70;
const NUM_COLUMNS     = 4;
const IMAGERY_DPI     = 40;   // plenty for 1200 px wide tiles
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// ------------------------------------------------------------------

// Renders a month name as a PNG strip the width of a tile, in the bundled font
function renderLabel(text) {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${TILE_WIDTH_PX}" height="${LABEL_HEIGHT_PX}">` +
    `<rect width="100%" height="100%" fill="#000"/>` +
    `<text x="${TILE_WIDTH_PX / 2}" y="${LABEL_HEIGHT_PX * 0.68}" fill="#f4f1ea" ` +
    `font-family="Barlow Condensed" font-weight="600" font-size="${LABEL_HEIGHT_PX * 0.55}" ` +
    `text-anchor="middle">${text} 2004</text></svg>`;
  return renderPng(svg, TILE_WIDTH_PX);
}

// ------------------------------------------------------------------

const baseStyle = await loadStyle('geo-blue-marble');
const tiles = [];

for (const [idx, month] of MONTHS.entries()) {
  const monthNumber = String(idx + 1).padStart(2, '0');
  const style = {
    ...baseStyle,
    imagery: {
      ...baseStyle.imagery,
      dpi   : IMAGERY_DPI,
      source: `data/raw/bmng/world.topo.bathy.2004${monthNumber}.3x21600x10800.jpg`,
    },
  };
  const { svg } = await renderMap(style);
  tiles.push({ map: renderPng(svg, TILE_WIDTH_PX), label: renderLabel(month) });
  console.log(`rendered ${month}`);
}

const { height: mapHeightPx } = await sharp(tiles[0].map).metadata();
const cellHeightPx = mapHeightPx + LABEL_HEIGHT_PX;
const numRows = Math.ceil(tiles.length / NUM_COLUMNS);

await mkdir(join(ROOT, 'out', 'sheets'), { recursive: true });
await sharp({
  create: {
    width     : NUM_COLUMNS * TILE_WIDTH_PX,
    height    : numRows * cellHeightPx,
    channels  : 3,
    background: '#000000',
  },
})
  .composite(tiles.flatMap(({ map, label }, idx) => {
    const left = (idx % NUM_COLUMNS) * TILE_WIDTH_PX;
    const top  = Math.floor(idx / NUM_COLUMNS) * cellHeightPx;
    return [
      { input: label, left, top },
      { input: map  , left, top: top + LABEL_HEIGHT_PX },
    ];
  }))
  .png()
  .toFile(OUT_FILE);

console.log(`Wrote ${OUT_FILE}`);
