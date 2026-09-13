// ==================================================================
// RENDER CONTEXT
// ------------------------------------------------------------------

// The context object passed to every layer: resolved style, view and page
// geometry, length conversion from physical units to map units, and cached data.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deg2Rad } from '../globals.mjs';
import { MAP_VIEW_ORIGIN, MAP_WIDTH, MAP_HEIGHT, MAP_TILT_DEG } from '../concialdi.mjs';
import { generateMapOutline } from '../map-geometry.mjs';
import { formatNumber } from './svg.mjs';

// ------------------------------------------------------------------

const ROOT      = resolve(fileURLToPath(import.meta.url), '../..');
const MM_PER_PT = 25.4 / 72;

// Length tokens: '0.15u' (map units), '0.3mm', '6pt'
const LENGTH_PATTERN = /^(-?\d+(?:\.\d+)?)(u|mm|pt)$/;

// ------------------------------------------------------------------

export function createContext(style) {

  const view = resolveView(style.view);
  const page = resolvePage(style.page, view);
  const mmPerUnit = page.mapWidthMm / view.width;
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
    view,
    page,
    mmPerUnit,
    len,

    // Converts a list of length tokens (e.g. a dash array) to an attribute value
    lenList: values => values?.map(value => formatNumber(len(value))).join(' '),

    // Transform from untilted map units to page millimeters
    mapTransform: [
      `translate(${formatNumber(page.mapOffsetMm.x, 8)} ${formatNumber(page.mapOffsetMm.y, 8)})`,
      `scale(${formatNumber(mmPerUnit, 8)})`,
      `translate(${formatNumber(-view.minX, 8)} ${formatNumber(-view.minY, 8)})`,
      `rotate(${formatNumber(view.tiltDeg, 8)})`,
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

// The view is the rectangle of tilted map coordinates placed on the page:
// - 'original'     : the web app's fixed viewBox (meant for the -5.4 deg tilt)
// - 'outline'      : tight bounds of the tilted map outline, plus padding
// - 'pole-centered': like 'outline', widened so the North Pole is centered horizontally
function resolveView(viewStyle = {}) {

  const tiltDeg = viewStyle.tiltDeg ?? MAP_TILT_DEG;
  const frame   = viewStyle.frame   ?? 'original';

  if (frame === 'original') {
    return { tiltDeg, minX: -MAP_VIEW_ORIGIN.x, minY: -MAP_VIEW_ORIGIN.y, width: MAP_WIDTH, height: MAP_HEIGHT };
  }
  if (frame !== 'outline' && frame !== 'pole-centered') throw new Error(`Unknown view.frame: ${frame}`);

  const tilt    = deg2Rad(tiltDeg);
  const padding = viewStyle.paddingUnits ?? 0;
  const points  = generateMapOutline().map(point => point.copy().rotate(tilt));
  const xs = points.map(point => point.x);
  const ys = points.map(point => point.y);
  let   minX = Math.min(...xs) - padding;
  let   maxX = Math.max(...xs) + padding;
  const minY = Math.min(...ys) - padding;
  const maxY = Math.max(...ys) + padding;

  // The North Pole projects to (0, 0), so center by making the bounds symmetric
  if (frame === 'pole-centered') {
    const halfWidth = Math.max(-minX, maxX);
    minX = -halfWidth;
    maxX = halfWidth;
  }

  return { tiltDeg, minX, minY, width: maxX - minX, height: maxY - minY };
}

// ------------------------------------------------------------------

// Page size defaults to the map extent; the map is centered on the page
function resolvePage(pageStyle, view) {
  const mapWidthMm  = pageStyle.mapWidthMm;
  const mapHeightMm = mapWidthMm * view.height / view.width;
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
