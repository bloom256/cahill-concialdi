// ==================================================================
// LAYER: COUNTRY STATS LABELS
// ------------------------------------------------------------------

// Sets each country's name, population, GDP, and GDP per capita on the map.
//
// Inside labels: for every polygon of the country, candidate centers (the
// pole of inaccessibility plus a grid of interior points) are tested at
// several angles, and the largest text block that fits entirely inside the
// polygon wins, so labels never cross borders or coastlines. Horizontal text
// is preferred; rotated text wins only when it is clearly larger.
//
// Countries too small for an inside label either get their name only or no
// label (default), or, with callouts enabled:
// 1. overlay: the small block sits right on the country (or a few mm off),
//    without a leader line, when that spot overlaps no other label;
// 2. callout: otherwise the block goes to the nearest free spot further away,
//    with a dot on the country and a leader line.
// Every small country's dot area is reserved first, so no label covers
// another small country. A country below `callouts.minLeaderPopulation` that
// would need a leader line is left unlabeled instead, and named in the notes:
// a handful of the tiniest states are not worth the clutter of a line.

import polylabel from 'polylabel';
import { LatLon } from '../../data-types.mjs';
import { project } from '../../concialdi.mjs';
import { measureText, getVerticalMetrics } from '../fonts.mjs';
import { attrs, escapeXml, formatNumber } from '../svg.mjs';
import { COLOR_MODES } from './land.mjs';
import { buildSdf, sampleSdf } from '../labels/sdf.mjs';
import { solveLabels } from '../labels/solver.mjs';

// ------------------------------------------------------------------

const POLYLABEL_PRECISION_MM  = 0.25;
const GRID_STEPS              = 12;    // candidate grid divisions per bounding box side
const SIZE_SEARCH_STEPS       = 10;    // binary search iterations for the font size
const GRID_PENALTY            = 1.08;  // a grid candidate must beat the pole by this much
const DARK_TEXT_MIN_LUMINANCE = 0.3;   // relative luminance of the fill
const AXIS_SWEEP_DEG          = 30;    // rotated labels are searched this far either side of the PCA axis
const AXIS_STEP_DEG           = 2.5;   // in steps this fine, then refined
const ALONG_AXIS_MIN_DEG      = 20;    // a block tilted less than this is not "lying along" its country

// Callouts: directions to try around the anchor (degrees, 0 = right,
// 90 = up), sideways first because the text is horizontal
const CALLOUT_DIRECTIONS_DEG = [0, 180, 30, -30, 150, -150, 60, -60, 120, -120, 90, -90];
const ANCHOR_CLEARANCE_MM    = 1.2;   // space kept free around small countries' dots
const PAGE_MARGIN_MM         = 2;
const LEADER_SAMPLE_MM       = 1;     // leader lines are registered as boxes this far apart
const LEADER_CLEARANCE_MM    = 0.4;   // half size of those boxes

// Compact number suffixes, largest first
const MAGNITUDES = [[1e12, 'T'], [1e9, 'B'], [1e6, 'M'], [1e3, 'K']];

// ------------------------------------------------------------------

// Formats a number with a magnitude suffix: 38.2M with 3 significant digits
// (the default), or 38M with `decimals: 0`. The magnitude is always chosen so
// the scaled value is at least 1, so rounding never produces "$0B".
function formatCompact(value, prefix = '', decimals = null) {
  const [divisor, suffix] = MAGNITUDES.find(([magnitude]) => value >= magnitude) ?? [1, ''];
  const scaled = value / divisor;
  const numDecimals = decimals ?? (scaled >= 100 ? 0 : scaled >= 10 ? 1 : 2);
  return prefix + String(Number(scaled.toFixed(numDecimals))) + suffix;
}

// Returns the stat lines' texts for a country.
// 'stacked': one labeled line each, "Pop 38.2M" / "GDP $2.17T" / "GDP/cap $56.8K".
// 'inline': all three on one line, "38.2M / $2.17T / $56.8K". The line is much
// shorter than three stacked ones, so the block is two lines instead of four
// and fits inside far more countries. The '$' tells the numbers apart.
function getStatTexts(entry, layout, decimals = null, separator = ' / ') {
  const population      = entry.population      && formatCompact(entry.population.value, '', decimals);
  const gdp             = entry.gdpUsd          && formatCompact(entry.gdpUsd.value, '$', decimals);
  const gdpPerCapita    = entry.gdpPerCapitaUsd && formatCompact(entry.gdpPerCapitaUsd.value, '$', decimals);
  if (layout === 'inline') {
    const parts = [population, gdp, gdpPerCapita].filter(Boolean);
    return parts.length ? [parts.join(separator)] : [];
  }
  // 'stacked-plain': one number per line and no words, which makes the block
  // about as tall as it is wide - squarest of the three, but the reader has to
  // know the order (population, GDP, GDP per capita)
  // 'single-line' and 'gdp-middle' also start from the three separate numbers;
  // the layer pulls some of them up onto the name's line
  if (layout === 'stacked-plain' || layout === 'single-line' || layout === 'gdp-middle') {
    return [population, gdp, gdpPerCapita].filter(Boolean);
  }
  // 'three-line': the middle ground - population on its own line, the two GDP
  // figures sharing the next one, under the country code
  // 'three-line': code, then population, then both GDP figures
  // 'two-line': the layer pulls population up beside the code, leaving
  // "FRA/68M" over "$3T/$51K" - two lines of similar width, so the block is
  // about as rectangular as this data gets
  if (layout === 'three-line' || layout === 'two-line') {
    const gdps = [gdp, gdpPerCapita].filter(Boolean).join(separator);
    return [population, gdps].filter(Boolean);
  }
  return [
    population   && `Pop ${population}`,
    gdp          && `GDP ${gdp}`,
    gdpPerCapita && `GDP/cap ${gdpPerCapita}`,
  ].filter(Boolean);
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

// Returns the axis-aligned bounds of a width x height rectangle centered on
// (centerX, centerY) and rotated by angleDeg
function getBlockBox(centerX, centerY, width, height, angleDeg = 0) {
  const angle = angleDeg * Math.PI / 180;
  const halfWidth  = (Math.abs(Math.cos(angle)) * width + Math.abs(Math.sin(angle)) * height) / 2;
  const halfHeight = (Math.abs(Math.sin(angle)) * width + Math.abs(Math.cos(angle)) * height) / 2;
  return { minX: centerX - halfWidth, maxX: centerX + halfWidth, minY: centerY - halfHeight, maxY: centerY + halfHeight };
}

const doBoxesOverlap = (a, b) => a.minX < b.maxX && b.minX < a.maxX && a.minY < b.maxY && b.minY < a.maxY;

const isOffPage = (ctx, box) =>
  box.minX < PAGE_MARGIN_MM || box.maxX > ctx.page.widthMm  - PAGE_MARGIN_MM ||
  box.minY < PAGE_MARGIN_MM || box.maxY > ctx.page.heightMm - PAGE_MARGIN_MM;

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

// Angle in degrees of a ring's long axis, from the covariance of its points
// (principal component). This is the natural direction for a label inside an
// elongated country, and the first angle the fit search tries.
function getPrincipalAxisDeg(ring) {
  let sumX = 0;
  let sumY = 0;
  for (const [x, y] of ring) { sumX += x; sumY += y; }
  const meanX = sumX / ring.length;
  const meanY = sumY / ring.length;

  let varX = 0;
  let varY = 0;
  let covXY = 0;
  for (const [x, y] of ring) {
    const dx = x - meanX;
    const dy = y - meanY;
    varX  += dx * dx;
    varY  += dy * dy;
    covXY += dx * dy;
  }
  // The two eigenvalues of the covariance give the shape's spread along its
  // own axes; their ratio says how long and thin it is. Portugal comes out
  // around 3, France around 1.2.
  const mean = (varX + varY) / 2;
  const spread = Math.sqrt((varX - varY) * (varX - varY) / 4 + covXY * covXY);
  const major = mean + spread;
  const minor = Math.max(1e-9, mean - spread);

  return {
    axisDeg   : 0.5 * Math.atan2(2 * covXY, varX - varY) * 180 / Math.PI,
    elongation: Math.sqrt(major / minor),
  };
}

// Returns the area enclosed by a ring (shoelace formula)
function getRingArea(ring) {
  let doubleArea = 0;
  for (let idx = 0, prevIdx = ring.length - 1; idx < ring.length; prevIdx = idx++) {
    doubleArea += ring[prevIdx][0] * ring[idx][1] - ring[idx][0] * ring[prevIdx][1];
  }
  return Math.abs(doubleArea) / 2;
}

// ------------------------------------------------------------------

// Projects a GeoJSON polygon to page mm and precomputes its area and
// candidate label centers: the pole of inaccessibility first, then interior
// grid points
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

  return {
    rings,
    pole       : [pole[0], pole[1]],
    gridCenters,
    diagonal   : Math.hypot(maxX - minX, maxY - minY),
    area       : getRingArea(rings[0]),
    ...getPrincipalAxisDeg(rings[0]),   // axisDeg and elongation
  };
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

  const maxAngleDeg   = config.maxAngleDeg ?? null;   // null: use the anglesDeg list
  const angleStepDeg  = config.angleStepDeg ?? 15;
  const minElongation = config.rotateMinElongation ?? 2.2;
  const refineRounds = config.angleRefineRounds ?? 5;

  // Tilt is penalized in proportion to it, so a few degrees cost almost
  // nothing while a sideways label must be clearly larger to win
  const penaltyFor = angleDeg =>
    1 + (config.rotationPenalty - 1) * Math.min(1, Math.abs(angleDeg) / 90);

  let best = { size: 0, score: 0, center: null, angleDeg: 0, polygon: null };

  const tryAngle = (polygon, angleDeg) => {
    const anglePenalty = penaltyFor(angleDeg);
    const angle = angleDeg * Math.PI / 180;

    // Work in a frame rotated by -angle, where the rotated block is axis-aligned
    const rings = angle ? polygon.rings.map(ring => ring.map(point => rotatePoint(point, -angle))) : polygon.rings;
    const candidates = [polygon.pole, ...polygon.gridCenters];

    candidates.forEach((center, idx) => {
      const penalty = anglePenalty * (idx === 0 ? 1 : GRID_PENALTY);
      const rotatedCenter = angle ? rotatePoint(center, -angle) : center;
      const size = getLargestFit(rotatedCenter, unitBlock, rings, Math.max(minSize, best.score * penalty), maxSize);
      if (size && size / penalty > best.score) best = { size, score: size / penalty, center, angleDeg, polygon };
    });
  };

  // Quick reject: the block's width must fit within the polygon's diagonal
  const fittable = polygons.filter(polygon => polygon.diagonal >= unitBlock.width * minSize);

  if (maxAngleDeg === null) {
    config.anglesDeg.forEach(angleDeg => fittable.forEach(polygon => tryAngle(polygon, angleDeg)));
    return best;
  }

  // Horizontal first, then the polygon's own long axis, then a coarse sweep
  fittable.forEach(polygon => {
    tryAngle(polygon, 0);
    if (!maxAngleDeg) return;

    // Only a long, thin country earns a rotated label. A compact one reads
    // better horizontal whatever the fit says, so it is never even tried.
    // For the thin ones the search is dense around their own axis: a label
    // can fit at -68 degrees and at no angle 15 degrees either side of it
    // (Portugal), so a few samples miss it, and the refinement below only
    // starts once something has fitted.
    if (polygon.elongation < minElongation) return;
    for (let offset = -AXIS_SWEEP_DEG; offset <= AXIS_SWEEP_DEG; offset += AXIS_STEP_DEG) {
      const angleDeg = polygon.axisDeg + offset;
      if (Math.abs(angleDeg) <= maxAngleDeg) tryAngle(polygon, angleDeg);
    }
  });

  // Refine: hill-climb around the winning angle, halving the step each round
  for (let step = AXIS_STEP_DEG / 2, round = 0; best.angleDeg && round < refineRounds; step /= 2, round++) {
    const polygon = best.polygon;
    const angleDeg = best.angleDeg;
    if (Math.abs(angleDeg + step) <= maxAngleDeg) tryAngle(polygon, angleDeg + step);
    if (Math.abs(angleDeg - step) <= maxAngleDeg) tryAngle(polygon, angleDeg - step);
  }

  return best;
}

// Returns { centerX, centerY, box } for a block centered on the anchor or a
// few mm off it (close enough to need no leader line): the first spot among
// the center offsets that overlaps no placed label, or null. ignoreBox is
// the country's own reserved dot area.
function findOverlaySpot(ctx, anchor, width, height, offsetsMm, ignoreBox) {
  for (const offset of offsetsMm) {
    for (const directionDeg of offset === 0 ? [0] : CALLOUT_DIRECTIONS_DEG) {
      const direction = directionDeg * Math.PI / 180;
      const centerX = anchor[0] + Math.cos(direction) * offset;
      const centerY = anchor[1] - Math.sin(direction) * offset;
      const box = getBlockBox(centerX, centerY, width, height);
      if (isOffPage(ctx, box)) continue;
      if (ctx.labelBoxes.some(other => other !== ignoreBox && doBoxesOverlap(box, other))) continue;
      return { centerX, centerY, box };
    }
  }
  return null;
}

// Returns { centerX, centerY, box } for a callout block of the given size
// (mm) near the anchor: the first spot, searching outward ring by ring, that
// stays on the page and overlaps no placed label; or null
function findCalloutSpot(ctx, anchor, width, height, distancesMm) {
  for (const distance of distancesMm) {
    for (const directionDeg of CALLOUT_DIRECTIONS_DEG) {
      const direction = directionDeg * Math.PI / 180;
      const dirX = Math.cos(direction);
      const dirY = -Math.sin(direction);
      const halfExtent = Math.abs(dirX) * width / 2 + Math.abs(dirY) * height / 2;
      const centerX = anchor[0] + dirX * (distance + halfExtent);
      const centerY = anchor[1] + dirY * (distance + halfExtent);
      const box = getBlockBox(centerX, centerY, width, height);
      if (isOffPage(ctx, box)) continue;
      if (ctx.labelBoxes.some(other => doBoxesOverlap(box, other))) continue;
      return { centerX, centerY, box };
    }
  }
  return null;
}

// Helpers exposed for debugging and tests
export {
  isInPolygon, isRectInPolygon, preparePolygon, measureBlock, getLargestFit, findBestFit,
  findOverlaySpot, findCalloutSpot,
};

// ------------------------------------------------------------------

export default {
  id     : 'countryStats',
  space  : 'page',
  enabled: style => Boolean(style.countryStats?.show),
  render : ctx => {

    const config = ctx.style.countryStats;
    const callouts = config.callouts?.show ? config.callouts : null;
    const stats = ctx.data(config.data).countries;
    const getFillColor = COLOR_MODES[ctx.style.land.mode];
    const maxNameSize = ctx.mm(config.maxNameSize);
    const minNameSize = ctx.mm(config.minNameSize);
    const minNameOnlySize = ctx.mm(config.minNameOnlySize);
    const haloWidthEm = config.haloColor ? config.haloWidthEm : 0;
    const { ascender, descender } = getVerticalMetrics(config.font, config.nameWeight);

    ctx.useFont(config.font, config.nameWeight);
    ctx.useFont(config.font, config.statsWeight);

    // Placements are collected rather than drawn as they are decided, so the
    // whole arrangement exists as data before anything is emitted
    const placements = [];
    const leaders = [];
    const leaderRequests = [];
    const hiddenNames = [];
    const skippedNames = [];
    const calloutNames = [];
    const singleLineNames = [];
    const fullLabelNames = [];
    const counts = { full: 0, nameOnly: 0, rotated: 0, overlays: 0, shrunk: 0, callouts: 0, forced: 0, belowStatsPopulation: 0 };

    // Records a text block (lines stacked around the center) and its box.
    // `meta` carries the country the block belongs to - the polygon it was
    // placed in and that polygon's interior point - which the joint solver
    // needs for its containment and attachment terms.
    const addBlock = (lines, nameSize, centerX, centerY, angleDeg, color, meta = {}) => {

      const blockWidth  = Math.max(...lines.map(line => measureText(line.text, config.font, line.weight, line.scale * nameSize)));
      const blockHeight = lines.reduce((sum, line) => sum + line.scale * nameSize * config.lineHeight, 0);
      const box = getBlockBox(centerX, centerY, blockWidth + haloWidthEm * nameSize, blockHeight, angleDeg);
      ctx.labelBoxes.push(box);

      placements.push({ lines, size: nameSize, x: centerX, y: centerY, angleDeg, color, ...meta });
      return box;
    };

    // Turns one placement into its <text> element
    const drawBlock = ({ lines, size, x, y, angleDeg, color }) => {

      let lineTop = y - lines.reduce((sum, line) => sum + line.scale * size * config.lineHeight, 0) / 2;
      const tspans = lines.map(line => {
        const fontSize = line.scale * size;
        const lineBox = fontSize * config.lineHeight;
        const baseline = lineTop + lineBox / 2 + (ascender + descender) / 2 * fontSize;
        lineTop += lineBox;
        return `<tspan${attrs({
          x             : x,
          y             : baseline,
          'font-size'   : fontSize,
          'font-weight' : line.weight,
          'stroke-width': haloWidthEm ? haloWidthEm * fontSize : undefined,
        })}>${escapeXml(line.text)}</tspan>`;
      });

      return `<text${attrs({
        fill     : color,
        transform: angleDeg
          ? `rotate(${angleDeg} ${formatNumber(x)} ${formatNumber(y)})`
          : undefined,
      })}>${tspans.join('')}</text>`;
    };

    // Pass 1: inside labels; small countries wait for pass 2
    const pending = [];

    ctx.data(ctx.style.land.data).forEach(([id, multiPolygon]) => {

      const entry = stats[id];
      if (!entry) return;

      // Countries below minStatsPopulation (or without population data) get
      // only their name, set in the regular stats weight
      const isBelowStatsPopulation = Boolean(config.minStatsPopulation) &&
        !(entry.population?.value >= config.minStatsPopulation);
      if (isBelowStatsPopulation) counts.belowStatsPopulation++;

      // `nameSource: 'iso3'` sets three-letter codes instead of names, which
      // makes every block much shorter; entries without a code (Northern
      // Cyprus, Somaliland, Siachen Glacier) keep their name
      const separator = config.statsSeparator ?? ' / ';
      let nameText = config.nameSource === 'iso3' ? entry.iso3 ?? entry.name : entry.name;
      let statTexts = isBelowStatsPopulation
        ? []
        : getStatTexts(entry, config.statsLayout, config.statsDecimals ?? null, separator);

      // Layouts that pull numbers up onto the name's line: all of them for
      // 'single-line' (DEU/84M/$5T/$60K), the population only for 'gdp-middle',
      // which leaves GDP as the middle line of three
      const pullsUp = config.statsLayout === 'single-line' ||
                      config.statsLayout === 'gdp-middle' ||
                      config.statsLayout === 'two-line';
      if (statTexts.length && pullsUp) {
        const pulled = config.statsLayout === 'single-line' ? statTexts : statTexts.slice(0, 1);
        nameText = [nameText, ...pulled].join(separator);
        statTexts = statTexts.slice(pulled.length);
      }

      const nameLine = {
        text  : nameText,
        weight: isBelowStatsPopulation ? config.statsWeight : config.nameWeight,
        scale : 1,
      };
      const statLines = statTexts.map(text => ({ text, weight: config.statsWeight, scale: config.statsScale }));

      const polygons = multiPolygon.map(polygon => preparePolygon(ctx, polygon));
      const fillRgb = getFillColor ? getFillColor(multiPolygon) : [0, 0, 0];
      const color = config.textColor === 'fixed'
        ? config.color
        : getLuminance(fillRgb) >= DARK_TEXT_MIN_LUMINANCE ? config.darkColor : config.lightColor;

      // Multi-line blocks stay horizontal unless the style allows rotating them
      const fullBlockConfig = config.rotateFullBlock ? config : { ...config, anglesDeg: [0] };
      let lines = [nameLine, ...statLines];
      let fit = statLines.length
        ? findBestFit(polygons, measureBlock(lines, config), minNameSize, maxNameSize, fullBlockConfig)
        : findBestFit(polygons, measureBlock(lines, config), minNameOnlySize, maxNameSize, config);

      // A very large, compact country (Russia, China, India, the United States)
      // has room for the readable labeled form with its full name:
      //   Russia / Pop 144M / GDP $2.17T / GDP/cap $14.9K
      // Selected by area on the page and PCA elongation, set horizontal, and
      // used only when it fits at the minimum size or larger. With
      // `roundNumbers: false` its figures keep 3 significant digits, since
      // whole numbers make China and India both read "1B".
      if (config.fullLabel && statLines.length) {
        const largest = polygons.reduce((best, polygon) => polygon.area > best.area ? polygon : best);
        const isLarge = largest.area >= config.fullLabel.minAreaMm2;
        const isCompact = largest.elongation < (config.fullLabel.maxElongation ?? config.rotateMinElongation ?? 2.2);
        if (isLarge && isCompact) {
          const fullLines = [
            { text: entry.name, weight: config.nameWeight, scale: 1 },
            ...getStatTexts(entry, 'stacked', config.fullLabel.roundNumbers === false ? null : config.statsDecimals ?? null)
              .map(text => ({ text, weight: config.statsWeight, scale: config.statsScale })),
          ];
          const fullFit = findBestFit(polygons, measureBlock(fullLines, config), minNameSize, maxNameSize,
            { ...config, maxAngleDeg: 0 });
          if (fullFit.size) {
            lines = fullLines;
            fit = fullFit;
            fullLabelNames.push(entry.name);
          }
        }
      }

      // A long, thin country like Portugal reads best as one line lying along
      // its axis: PRT/10M/$346B/$33K. The trigger is the two-line block itself
      // ending up rotated: that happens only where the country is too thin for
      // it to sit upright. Countries whose block stays horizontal keep two
      // lines, even when a single line would fit bigger (Sweden, Morocco:
      // there it becomes a huge diagonal ribbon).
      if (config.singleLineAlongAxis && statLines.length && fit.size &&
          Math.abs(fit.angleDeg) >= ALONG_AXIS_MIN_DEG) {
        const singleLines = [{
          text  : [nameLine.text, ...statLines.map(line => line.text)].join(separator),
          weight: config.nameWeight,
          scale : 1,
        }];
        const singleFit = findBestFit(polygons, measureBlock(singleLines, config), minNameSize, maxNameSize, fullBlockConfig);
        if (singleFit.size && Math.abs(singleFit.angleDeg) >= ALONG_AXIS_MIN_DEG) {
          lines = singleLines;
          fit = singleFit;
          singleLineNames.push(entry.name);
        }
      }

      if (fit.size) {
        counts[statLines.length ? 'full' : 'nameOnly']++;
        if (fit.angleDeg) counts.rotated++;
        addBlock(lines, fit.size, fit.center[0], fit.center[1], fit.angleDeg, color,
          { id, polygon: fit.polygon, anchor: fit.polygon?.pole ?? fit.center });
        return;
      }

      if (callouts) {
        const largest = polygons.reduce((best, polygon) => polygon.area > best.area ? polygon : best);
        pending.push({ id, entry, lines, anchor: largest.pole, polygon: largest });
        return;
      }

      // Without callouts: fall back to the name only, else hide
      const nameFit = findBestFit(polygons, measureBlock([nameLine], config), minNameOnlySize, maxNameSize, config);
      if (!nameFit.size) {
        hiddenNames.push(entry.name);
        return;
      }
      counts.nameOnly++;
      if (nameFit.angleDeg) counts.rotated++;
      addBlock([nameLine], nameFit.size, nameFit.center[0], nameFit.center[1], nameFit.angleDeg, color,
        { id, polygon: nameFit.polygon, anchor: nameFit.polygon?.pole ?? nameFit.center });
    });

    // Pass 2: small countries, most populous first. Every small country's dot
    // area is reserved up front, so no label covers another small country.
    if (callouts) {

      const nameSize = ctx.mm(callouts.nameSize);
      // Sizes tried for a label placed on its own country, largest first
      const overlaySizes = (callouts.overlaySizes ?? [callouts.nameSize]).map(token => ctx.mm(token));
      const dotRadius = ctx.mm(callouts.dotRadius);
      const color = callouts.color ?? config.lightColor ?? config.color;

      pending.forEach(item => {
        item.anchorBox = {
          minX: item.anchor[0] - ANCHOR_CLEARANCE_MM, maxX: item.anchor[0] + ANCHOR_CLEARANCE_MM,
          minY: item.anchor[1] - ANCHOR_CLEARANCE_MM, maxY: item.anchor[1] + ANCHOR_CLEARANCE_MM,
        };
        ctx.labelBoxes.push(item.anchorBox);
      });
      pending.sort((a, b) => (b.entry.population?.value ?? 0) - (a.entry.population?.value ?? 0));

      pending.forEach(({ id, entry, lines, anchor, anchorBox, polygon }) => {

        const smallLines = lines.map(line => ({ ...line, scale: line.scale === 1 ? 1 : callouts.statsScale }));
        const measure = size => ({
          width : Math.max(...smallLines.map(line => measureText(line.text, config.font, line.weight, line.scale * size)))
            + haloWidthEm * size,
          height: smallLines.reduce((sum, line) => sum + line.scale * size * config.lineHeight, 0),
        });

        // 1. Right on the country, when that spot is free: no leader line.
        // Sizes are tried largest first, because a label one step smaller on
        // its own country reads better than a full-size one on a leader line.
        if (callouts.overlayOffsetsMm) {
          for (const size of overlaySizes) {
            const { width, height } = measure(size);
            const overlay = findOverlaySpot(ctx, anchor, width, height, callouts.overlayOffsetsMm, anchorBox);
            if (!overlay) continue;
            counts.overlays++;
            if (size < overlaySizes[0]) counts.shrunk++;
            addBlock(smallLines, size, overlay.centerX, overlay.centerY, 0, color, { id, polygon, anchor });
            return;
          }
        }

        const { width, height } = measure(nameSize);

        // 2. The tiniest countries are left unlabeled rather than put on a
        // leader line; their reserved dot area is released as well
        if (callouts.minLeaderPopulation &&
            !(entry.population?.value >= callouts.minLeaderPopulation)) {
          skippedNames.push(entry.name);
          const boxIdx = ctx.labelBoxes.indexOf(anchorBox);
          if (boxIdx >= 0) ctx.labelBoxes.splice(boxIdx, 1);
          return;
        }

        // 3. Further away, with a dot and a leader line
        let spot = findCalloutSpot(ctx, anchor, width, height, callouts.distancesMm);
        if (!spot) {
          counts.forced++;
          spot = { centerX: anchor[0] + callouts.distancesMm[0] + width / 2, centerY: anchor[1] };
        }
        counts.callouts++;
        calloutNames.push(entry.name);

        const box = addBlock(smallLines, nameSize, spot.centerX, spot.centerY, 0, color, { id, polygon, anchor });

        // The line itself is drawn after any joint solve, since the label it
        // points at may still move; only its obstacle boxes are reserved now
        leaderRequests.push({ anchor, index: placements.length - 1 });

        const targetX = Math.min(box.maxX, Math.max(box.minX, anchor[0]));
        const targetY = Math.min(box.maxY, Math.max(box.minY, anchor[1]));
        const leaderLength = Math.hypot(targetX - anchor[0], targetY - anchor[1]);
        if (leaderLength > ctx.mm(callouts.dotRadius) * 2) {

          // Register the leader as a chain of small boxes, so labels placed
          // later keep clear of it
          const numSamples = Math.ceil(leaderLength / LEADER_SAMPLE_MM);
          for (let sample = 1; sample < numSamples; sample++) {
            const x = anchor[0] + (targetX - anchor[0]) * sample / numSamples;
            const y = anchor[1] + (targetY - anchor[1]) * sample / numSamples;
            ctx.labelBoxes.push({
              minX: x - LEADER_CLEARANCE_MM, maxX: x + LEADER_CLEARANCE_MM,
              minY: y - LEADER_CLEARANCE_MM, maxY: y + LEADER_CLEARANCE_MM,
            });
          }
        }
      });
    }

    ctx.notes.push(
      `countryStats: ${counts.full} full labels, ${counts.nameOnly} name only (${counts.rotated} rotated), ` +
      `${counts.belowStatsPopulation} below the stats population, ` +
      `${counts.overlays} small labels on their country (${counts.shrunk} a size smaller), ` +
      `${counts.callouts} with leader lines ` +
      `(${counts.forced} without a free spot), ${hiddenNames.length} hidden` +
      (hiddenNames.length ? ` (${hiddenNames.join(', ')})` : '')
    );
    if (fullLabelNames.length) {
      ctx.notes.push(`countryStats: full labeled block for ${fullLabelNames.join(', ')}`);
    }
    if (singleLineNames.length) {
      ctx.notes.push(`countryStats: single line along the country for ${singleLineNames.join(', ')}`);
    }
    if (calloutNames.length) {
      ctx.notes.push(`countryStats: leader lines for ${calloutNames.join(', ')}`);
    }
    if (skippedNames.length) {
      ctx.notes.push(
        `countryStats: ${skippedNames.length} countries under ${formatCompact(callouts.minLeaderPopulation)} ` +
        `people left unlabeled instead of put on a leader line (${skippedNames.join(', ')})`
      );
    }

    // The size of a placement's block, and the box it occupies
    const blockOf = ({ lines, size, x, y, angleDeg }) => {
      const width = Math.max(...lines.map(line => measureText(line.text, config.font, line.weight, line.scale * size)));
      const height = lines.reduce((sum, line) => sum + line.scale * size * config.lineHeight, 0);
      return getBlockBox(x, y, width + haloWidthEm * size, height, angleDeg);
    };

    // Joint solve: the greedy arrangement above becomes the starting point for
    // a continuous optimization over every label's position, angle and size at
    // once. Off unless the style asks for it.
    if (config.solver === 'anneal') {

      const fields = new Map();
      const margin = ctx.mm(config.solverMarginMm ?? '0.35mm');

      const solverLabels = placements.map(placement => {

        // The same box the greedy placer uses: measured width plus the halo,
        // and no `fill` margin. With an inflated box the arrangement greedy
        // handed over would not even be feasible here, and the hard constraint
        // can only prevent new overlaps, never repair inherited ones.
        const unitWidth = Math.max(...placement.lines.map(line =>
          measureText(line.text, config.font, line.weight, line.scale))) + haloWidthEm;
        const unitHeight = placement.lines.reduce((sum, line) => sum + line.scale * config.lineHeight, 0);
        let sdf = null;
        if (placement.polygon) {
          if (!fields.has(placement.polygon)) {
            fields.set(placement.polygon, buildSdf(placement.polygon.rings, { cellMm: 0.4, padMm: 6 }));
          }
          sdf = fields.get(placement.polygon);
        }
        const anchor = placement.anchor ?? [placement.x, placement.y];

        // How far a label may drift before it starts paying. A big country
        // holds its label near the middle, where it belongs; a small one has
        // to be free, because only the solver knows where there is room.
        const inradius = sdf ? Math.max(1, sampleSdf(sdf, anchor[0], anchor[1])) : 1;
        const roamMm = Math.max(2.5, Math.min(25, 25 / inradius));

        return {
          id        : placement.id,
          unitWidth,
          unitHeight,
          minSize   : placement.size,   // the solver may grow or move a label, never shrink it
          maxSize   : maxNameSize,
          margin,
          sdf,
          anchor,
          roamMm,
          weight    : 1,
        };
      });

      const startPoses = placements.map(placement => ({
        x: placement.x, y: placement.y, theta: placement.angleDeg, size: placement.size,
      }));

      const { poses, stats } = solveLabels(solverLabels, startPoses, config.solverOptions ?? {});
      poses.forEach((pose, index) => {
        placements[index].x = pose.x;
        placements[index].y = pose.y;
        placements[index].angleDeg = pose.theta;
        placements[index].size = pose.size;
      });

      ctx.notes.push(
        `countryStats: solver moved ${stats.accepted} of ${stats.iterations} times, ` +
        `${stats.overlapping} overlapping, ${stats.outside} not fully inside their country, ` +
        `mean size ${(stats.meanSize / (25.4 / 72)).toFixed(1)} pt`
      );
    }

    // Leaders are drawn now, against wherever each label finally sits
    if (callouts) {
      const dotRadius = ctx.mm(callouts.dotRadius);
      for (const { anchor, index } of leaderRequests) {
        const box = blockOf(placements[index]);
        const targetX = Math.min(box.maxX, Math.max(box.minX, anchor[0]));
        const targetY = Math.min(box.maxY, Math.max(box.minY, anchor[1]));
        leaders.push(`<circle${attrs({ cx: anchor[0], cy: anchor[1], r: dotRadius })}/>`);
        if (Math.hypot(targetX - anchor[0], targetY - anchor[1]) > dotRadius * 2) {
          leaders.push(`<line${attrs({ x1: anchor[0], y1: anchor[1], x2: targetX, y2: targetY })}/>`);
        }
      }
    }

    const texts = placements.map(drawBlock);

    // Leader lines and dots under the text, drawn twice: halo, then line
    const leaderMarkup = leaders.join('');
    const leaderGroups = callouts && leaderMarkup
      ? (config.haloColor
          ? `<g${attrs({
              id               : 'country-stats-leader-halo',
              stroke           : config.haloColor,
              fill             : config.haloColor,
              'stroke-width'   : ctx.mm(callouts.leaderWidth) + ctx.mm(callouts.leaderHaloWidth),
              'stroke-opacity' : config.haloOpacity,
              'fill-opacity'   : config.haloOpacity,
              'stroke-linecap' : 'round',
            })}>${leaderMarkup}</g>`
          : '') +
        // stroke/fill opacity instead of group opacity: resvg panics on an
        // opacity group whose content lies entirely outside the rendered view
        `<g${attrs({
          id              : 'country-stats-leaders',
          stroke          : callouts.color ?? config.color,
          fill            : callouts.color ?? config.color,
          'stroke-width'  : ctx.mm(callouts.leaderWidth),
          'stroke-opacity': callouts.opacity,
          'fill-opacity'  : callouts.opacity,
          'stroke-linecap': 'round',
        })}>${leaderMarkup}</g>`
      : '';

    return (
      leaderGroups +
      `<g${attrs({
        id               : 'country-stats',
        'font-family'    : config.font,
        'text-anchor'    : 'middle',
        stroke           : config.haloColor,
        'stroke-opacity' : config.haloColor ? config.haloOpacity : undefined,
        'stroke-linejoin': config.haloColor ? 'round' : undefined,
        'paint-order'    : config.haloColor ? 'stroke' : undefined,
      })}>` +
      texts.join('') +
      '</g>'
    );
  },
};
