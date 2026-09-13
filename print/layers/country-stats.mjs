// ==================================================================
// LAYER: COUNTRY STATS LABELS
// ------------------------------------------------------------------

// Sets each country's name, population, GDP, and GDP per capita inside the
// country. For every polygon of the country, candidate centers (the pole of
// inaccessibility plus a grid of interior points) are tested at several
// angles, and the largest text block that fits entirely inside the polygon
// wins, so labels never cross borders or coastlines. Horizontal text is
// preferred; rotated text wins only when it is clearly larger (long, narrow
// countries such as Chile or the United Kingdom). Countries too small for the
// full block get their name only, or no label at all.

import polylabel from 'polylabel';
import { LatLon } from '../../data-types.mjs';
import { project } from '../../concialdi.mjs';
import { measureText, getVerticalMetrics } from '../fonts.mjs';
import { attrs, escapeXml, formatNumber } from '../svg.mjs';
import { COLOR_MODES } from './land.mjs';

// ------------------------------------------------------------------

const POLYLABEL_PRECISION_MM  = 0.25;
const GRID_STEPS              = 12;    // candidate grid divisions per bounding box side
const SIZE_SEARCH_STEPS       = 10;    // binary search iterations for the font size
const GRID_PENALTY            = 1.08;  // a grid candidate must beat the pole by this much
const DARK_TEXT_MIN_LUMINANCE = 0.3;   // relative luminance of the fill

// Compact number suffixes, largest first
const MAGNITUDES = [[1e12, 'T'], [1e9, 'B'], [1e6, 'M'], [1e3, 'K']];

// ------------------------------------------------------------------

// Formats a number with 3 significant digits and a magnitude suffix: 38.2M
function formatCompact(value, prefix = '') {
  const [divisor, suffix] = MAGNITUDES.find(([magnitude]) => value >= magnitude) ?? [1, ''];
  const scaled = value / divisor;
  const numDecimals = scaled >= 100 ? 0 : scaled >= 10 ? 1 : 2;
  return prefix + String(Number(scaled.toFixed(numDecimals))) + suffix;
}

// Returns the WCAG relative luminance of a [red, green, blue] color
function getLuminance(rgb) {
  const [red, green, blue] = rgb.map(channel => {
    const value = Math.min(255, Math.max(0, channel)) / 255;
    return value <= 0.03928 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

// Rotates the point [x, y] around the origin by the angle in radians
// (SVG orientation: positive is clockwise on the page)
function rotatePoint([x, y], angle) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return [x * cos - y * sin, x * sin + y * cos];
}

// ------------------------------------------------------------------

// Ray casting: true if the point [x, y] is inside the ring
function isInRing([x, y], ring) {
  let isInside = false;
  for (let idx = 0, prevIdx = ring.length - 1; idx < ring.length; prevIdx = idx++) {
    const [x1, y1] = ring[idx];
    const [x2, y2] = ring[prevIdx];
    if ((y1 > y) !== (y2 > y) && x < (x2 - x1) * (y - y1) / (y2 - y1) + x1) isInside = !isInside;
  }
  return isInside;
}

// True if the point is inside the outer ring and outside every hole
const isInPolygon = (point, rings) =>
  isInRing(point, rings[0]) && !rings.slice(1).some(hole => isInRing(point, hole));

// True if segments ab and cd cross each other
function doSegmentsCross(a, b, c, d) {
  const cross = (p, q, r) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
  return (
    (cross(c, d, a) > 0) !== (cross(c, d, b) > 0) &&
    (cross(a, b, c) > 0) !== (cross(a, b, d) > 0)
  );
}

// True if the axis-aligned rectangle lies inside the polygon: all corners are
// inside and no polygon edge enters the rectangle
function isRectInPolygon({ minX, minY, maxX, maxY }, rings) {
  const corners = [[minX, minY], [maxX, minY], [maxX, maxY], [minX, maxY]];
  if (!corners.every(corner => isInPolygon(corner, rings))) return false;
  for (const ring of rings) {
    for (let idx = 0, prevIdx = ring.length - 1; idx < ring.length; prevIdx = idx++) {
      const a = ring[prevIdx];
      const b = ring[idx];
      if (
        Math.max(a[0], b[0]) < minX || Math.min(a[0], b[0]) > maxX ||
        Math.max(a[1], b[1]) < minY || Math.min(a[1], b[1]) > maxY
      ) continue;
      if (b[0] > minX && b[0] < maxX && b[1] > minY && b[1] < maxY) return false;
      for (let side = 0; side < 4; side++) {
        if (doSegmentsCross(a, b, corners[side], corners[(side + 1) % 4])) return false;
      }
    }
  }
  return true;
}

// ------------------------------------------------------------------

// Projects a GeoJSON polygon to page mm and precomputes its candidate label
// centers: the pole of inaccessibility first, then interior grid points
function preparePolygon(ctx, polygon) {

  const rings = polygon.map(ring => ring.map(([lon, lat]) => ctx.toPage(project(new LatLon(lat, lon)))));
  const xs = rings[0].map(point => point[0]);
  const ys = rings[0].map(point => point[1]);
  const [minX, minY, maxX, maxY] = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];

  const pole = polylabel(rings, POLYLABEL_PRECISION_MM);
  const gridCenters = [];
  for (let col = 1; col < GRID_STEPS; col++) {
    for (let row = 1; row < GRID_STEPS; row++) {
      const point = [minX + (maxX - minX) * col / GRID_STEPS, minY + (maxY - minY) * row / GRID_STEPS];
      if (isInPolygon(point, rings)) gridCenters.push(point);
    }
  }

  return { rings, pole: [pole[0], pole[1]], gridCenters, diagonal: Math.hypot(maxX - minX, maxY - minY) };
}

// Returns the block's { width, height } at name size 1, enlarged by the
// style's fill ratio to keep a margin; lines are { text, weight, scale }
function measureBlock(lines, config) {
  const width  = Math.max(...lines.map(line => measureText(line.text, config.font, line.weight, line.scale)));
  const height = lines.reduce((sum, line) => sum + line.scale * config.lineHeight, 0);
  return { width: width / config.fill, height: height / config.fill };
}

// Returns the largest size in [minSize, maxSize] at which the unit block
// centered on the point fits in the polygon, or 0 if even minSize does not fit
function getLargestFit(center, unitBlock, rings, minSize, maxSize) {
  if (minSize > maxSize) return 0;
  const fits = size => isRectInPolygon({
    minX: center[0] - unitBlock.width  * size / 2,
    maxX: center[0] + unitBlock.width  * size / 2,
    minY: center[1] - unitBlock.height * size / 2,
    maxY: center[1] + unitBlock.height * size / 2,
  }, rings);
  if (fits(maxSize)) return maxSize;
  if (!fits(minSize)) return 0;
  let low = minSize;
  let high = maxSize;
  for (let step = 0; step < SIZE_SEARCH_STEPS; step++) {
    const mid = (low + high) / 2;
    if (fits(mid)) low = mid;
    else high = mid;
  }
  return low;
}

// Returns { size, center, angleDeg } of the best fit over all polygons and
// angles, or { size: 0 } if nothing fits. Candidates compete on a score:
// their size divided by penalties for being a grid point instead of the pole
// and for being rotated, so centered horizontal labels win near-ties.
function findBestFit(polygons, unitBlock, minSize, maxSize, config) {

  let best = { size: 0, score: 0, center: null, angleDeg: 0 };

  config.anglesDeg.forEach(angleDeg => {
    const anglePenalty = angleDeg === 0 ? 1 : config.rotationPenalty;
    const angle = angleDeg * Math.PI / 180;

    polygons.forEach(polygon => {

      // Quick reject: the block's width must fit within the polygon's diagonal
      if (polygon.diagonal < unitBlock.width * minSize) return;

      // Work in a frame rotated by -angle, where the rotated block is axis-aligned
      const rings = angle ? polygon.rings.map(ring => ring.map(point => rotatePoint(point, -angle))) : polygon.rings;
      const candidates = [polygon.pole, ...polygon.gridCenters];

      candidates.forEach((center, idx) => {
        const penalty = anglePenalty * (idx === 0 ? 1 : GRID_PENALTY);
        const rotatedCenter = angle ? rotatePoint(center, -angle) : center;
        const size = getLargestFit(rotatedCenter, unitBlock, rings, Math.max(minSize, best.score * penalty), maxSize);
        if (size && size / penalty > best.score) best = { size, score: size / penalty, center, angleDeg };
      });
    });
  });

  return best;
}

// Helpers exposed for debugging and tests
export { isInPolygon, isRectInPolygon, preparePolygon, measureBlock, getLargestFit, findBestFit };

// ------------------------------------------------------------------

export default {
  id     : 'countryStats',
  space  : 'page',
  enabled: style => Boolean(style.countryStats?.show),
  render : ctx => {

    const config = ctx.style.countryStats;
    const stats = ctx.data(config.data).countries;
    const getFillColor = COLOR_MODES[ctx.style.land.mode];
    const maxNameSize = ctx.mm(config.maxNameSize);
    const minNameSize = ctx.mm(config.minNameSize);
    const minNameOnlySize = ctx.mm(config.minNameOnlySize);
    const { ascender, descender } = getVerticalMetrics(config.font, config.nameWeight);

    ctx.useFont(config.font, config.nameWeight);
    ctx.useFont(config.font, config.statsWeight);

    const texts = [];
    const hiddenNames = [];
    let numFull = 0;
    let numNameOnly = 0;
    let numRotated = 0;

    ctx.data(ctx.style.land.data).forEach(([id, multiPolygon]) => {

      const entry = stats[id];
      if (!entry) return;

      const nameLine = { text: entry.name, weight: config.nameWeight, scale: 1 };
      const statLines = [
        entry.population      && `Pop ${formatCompact(entry.population.value)}`,
        entry.gdpUsd          && `GDP ${formatCompact(entry.gdpUsd.value, '$')}`,
        entry.gdpPerCapitaUsd && `GDP/cap ${formatCompact(entry.gdpPerCapitaUsd.value, '$')}`,
      ]
        .filter(Boolean)
        .map(text => ({ text, weight: config.statsWeight, scale: config.statsScale }));

      const polygons = multiPolygon.map(polygon => preparePolygon(ctx, polygon));

      // Prefer the full block; fall back to the name only; else hide
      let lines = [nameLine, ...statLines];
      // Multi-line blocks stay horizontal unless the style allows rotating them
      const fullBlockConfig = config.rotateFullBlock ? config : { ...config, anglesDeg: [0] };
      let fit = statLines.length
        ? findBestFit(polygons, measureBlock(lines, config), minNameSize, maxNameSize, fullBlockConfig)
        : { size: 0 };
      if (fit.size) {
        numFull++;
      }
      else {
        lines = [nameLine];
        fit = findBestFit(polygons, measureBlock(lines, config), minNameOnlySize, maxNameSize, config);
        if (!fit.size) {
          hiddenNames.push(entry.name);
          return;
        }
        numNameOnly++;
      }
      if (fit.angleDeg) numRotated++;

      const fillRgb = getFillColor ? getFillColor(multiPolygon) : [0, 0, 0];
      const color = getLuminance(fillRgb) >= DARK_TEXT_MIN_LUMINANCE ? config.darkColor : config.lightColor;

      // Stack lines from the top of the block; each baseline centers the
      // font's ascender-descender box within its line box
      const [centerX, centerY] = fit.center;
      let lineTop = centerY - lines.reduce((sum, line) => sum + line.scale * fit.size * config.lineHeight, 0) / 2;
      const tspans = lines.map(line => {
        const fontSize = line.scale * fit.size;
        const lineBox = fontSize * config.lineHeight;
        const baseline = lineTop + lineBox / 2 + (ascender + descender) / 2 * fontSize;
        lineTop += lineBox;
        return `<tspan${attrs({
          x            : centerX,
          y            : baseline,
          'font-size'  : fontSize,
          'font-weight': line.weight,
        })}>${escapeXml(line.text)}</tspan>`;
      });
      texts.push(`<text${attrs({
        fill     : color,
        transform: fit.angleDeg
          ? `rotate(${fit.angleDeg} ${formatNumber(centerX)} ${formatNumber(centerY)})`
          : undefined,
      })}>${tspans.join('')}</text>`);
    });

    ctx.notes.push(
      `countryStats: ${numFull} full labels, ${numNameOnly} name only (${numRotated} rotated in total), ` +
      `${hiddenNames.length} hidden` + (hiddenNames.length ? ` (${hiddenNames.join(', ')})` : '')
    );

    return (
      `<g${attrs({ id: 'country-stats', 'font-family': config.font, 'text-anchor': 'middle' })}>` +
      texts.join('') +
      '</g>'
    );
  },
};
