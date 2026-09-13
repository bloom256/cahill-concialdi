// ==================================================================
// RENDER CONTEXT
// ------------------------------------------------------------------

// The context object passed to every layer: resolved style, page geometry,
// length conversion from physical units to map units, and cached data.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MAP_VIEW_ORIGIN, MAP_WIDTH, MAP_HEIGHT, MAP_TILT_DEG } from '../concialdi.mjs';
import { formatNumber } from './svg.mjs';

// ------------------------------------------------------------------

const ROOT      = resolve(fileURLToPath(import.meta.url), '../..');
const MM_PER_PT = 25.4 / 72;

// Length tokens: '0.15u' (map units), '0.3mm', '6pt'
const LENGTH_PATTERN = /^(-?\d+(?:\.\d+)?)(u|mm|pt)$/;

// ------------------------------------------------------------------

export function createContext(style) {

  const page = resolvePage(style.page);
  const mmPerUnit = page.mapWidthMm / MAP_WIDTH;
  const dataCache = new Map();

  // Converts a length token or a plain number (map units) to map units
  const len = value => {
    if (typeof value === 'number') return value;
    const match = LENGTH_PATTERN.exec(value);
    if (!match) throw new Error(`Invalid length: ${value}`);
    const amount = Number(match[1]);
    switch (match[2]) {
      case 'u' : return amount;
      case 'mm': return amount / mmPerUnit;
      case 'pt': return amount * MM_PER_PT / mmPerUnit;
    }
  };

  return {
    style,
    page,
    mmPerUnit,
    len,

    // Converts a list of length tokens (e.g. a dash array) to an attribute value
    lenList: values => values?.map(value => formatNumber(len(value))).join(' '),

    // Transform from untilted map units to page millimeters
    mapTransform: [
      `translate(${formatNumber(page.mapOffsetMm.x, 8)} ${formatNumber(page.mapOffsetMm.y, 8)})`,
      `scale(${formatNumber(mmPerUnit, 8)})`,
      `translate(${MAP_VIEW_ORIGIN.x} ${MAP_VIEW_ORIGIN.y})`,
      `rotate(${MAP_TILT_DEG})`,
    ].join(' '),

    // Loads and caches a JSON data file (path relative to the repo root)
    data: filename => {
      if (!dataCache.has(filename)) {
        dataCache.set(filename, JSON.parse(readFileSync(resolve(ROOT, filename), 'utf8')));
      }
      return dataCache.get(filename);
    },
  };
}

// ------------------------------------------------------------------

// Page size defaults to the map extent; the map is centered on the page
function resolvePage(pageStyle) {
  const mapWidthMm  = pageStyle.mapWidthMm;
  const mapHeightMm = mapWidthMm * MAP_HEIGHT / MAP_WIDTH;
  const widthMm     = pageStyle.widthMm  ?? mapWidthMm;
  const heightMm    = pageStyle.heightMm ?? mapHeightMm;
  return {
    widthMm,
    heightMm,
    mapWidthMm,
    mapHeightMm,
    mapOffsetMm: { x: (widthMm - mapWidthMm)/2, y: (heightMm - mapHeightMm)/2 },
  };
}
