// Checks the signed distance field against shapes with known answers, then
// measures what it costs to build one for every country on the print page.
// Usage: node out/test-sdf.mjs

import '../print/setup.mjs';
import { buildSdf, sampleSdf } from '../print/labels/sdf.mjs';
import { loadStyle } from '../print/styles.mjs';
import { createContext } from '../print/context.mjs';
import { LatLon } from '../data-types.mjs';
import { project } from '../concialdi.mjs';
import polylabel from 'polylabel';

let failures = 0;
const check = (label, actual, expected, tolerance) => {
  const ok = Math.abs(actual - expected) <= tolerance;
  if (!ok) failures++;
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${label}: ${actual.toFixed(3)} (expected ${expected} +- ${tolerance})`);
};

// --- a 100 x 100 mm square: distance inside is the gap to the nearest edge
console.log('square 100 x 100 mm');
const square = [[[0, 0], [100, 0], [100, 100], [0, 100]]];
const squareSdf = buildSdf(square, { cellMm: 0.25, padMm: 10 });
check('center'          , sampleSdf(squareSdf, 50, 50)  ,  50, 0.3);
check('3 mm from a side', sampleSdf(squareSdf, 3, 50)   ,   3, 0.3);
check('on the edge'     , sampleSdf(squareSdf, 0, 50)   ,   0, 0.3);
check('5 mm outside'    , sampleSdf(squareSdf, -5, 50)  ,  -5, 0.3);
check('outside a corner', sampleSdf(squareSdf, -3, -4)  ,  -5, 0.4);

// Far beyond the padded box the field has no data: it must still return a
// finite, monotone reading (and must not recurse)
check('200 mm off a side'  , sampleSdf(squareSdf, -200, 50)  , -200  , 1.0);
check('far off a corner'   , sampleSdf(squareSdf, -100, -100), -141.4, 1.5);
check('far past the far side', sampleSdf(squareSdf, 400, 50) , -300  , 1.0);

// --- the same square with a 20 mm hole in the middle
console.log('\nsquare with a hole');
const holed = [square[0], [[40, 40], [60, 40], [60, 60], [40, 60]]];
const holedSdf = buildSdf(holed, { cellMm: 0.25, padMm: 10 });
check('inside the hole'   , sampleSdf(holedSdf, 50, 50), -10, 0.4);
check('beside the hole'   , sampleSdf(holedSdf, 25, 50),  15, 0.4);

// --- every country on the real page: cost and a sanity check per shape
console.log('\nbuilding a field for every country polygon on the 190 cm page');
const style = await loadStyle('geo-stats-nov');
const ctx = createContext(style);
const areas = ctx.data(style.land.data);

let cells = 0;
let polygons = 0;
let degenerate = 0;
const offenders = [];
const startedAt = Date.now();

for (const [id, multiPolygon] of areas) {
  for (let idx = 0; idx < multiPolygon.length; idx++) {
    const polygon = multiPolygon[idx];
    const rings = polygon.map(ring => ring.map(([lon, lat]) => ctx.toPage(project(new LatLon(lat, lon)))));
    const sdf = buildSdf(rings, { cellMm: 0.4, padMm: 8 });
    cells += sdf.cols * sdf.rows;
    polygons++;

    // The pole of inaccessibility is the deepest point inside, and polylabel
    // reports its distance: the field must agree there
    // Shapes thinner than a printed hairline have no interior to speak of, and
    // polylabel and the field can only agree to about one cell anyway
    const xs1 = rings[0].map(point => point[0]);
    const ys1 = rings[0].map(point => point[1]);
    const minSide = Math.min(Math.max(...xs1) - Math.min(...xs1), Math.max(...ys1) - Math.min(...ys1));
    if (minSide < 0.5) {
      degenerate++;
      continue;
    }

    const pole = polylabel(rings, 0.25);
    const sampled = sampleSdf(sdf, pole[0], pole[1]);
    const error = Math.abs(sampled - pole.distance);
    // Two sources of disagreement: the field's cell size, and polylabel's own
    // 0.25 mm precision, which matters most on islands only a few cells across
    if (error > Math.max(0.6, 2 * sdf.cellMm + 0.25)) {
      let deepest = -Infinity;
      for (const value of sdf.field) if (value > deepest) deepest = value;
      const xs2 = rings[0].map(point => point[0]);
      const ys2 = rings[0].map(point => point[1]);
      offenders.push({
        id, idx, error, sampled,
        polylabelDistance: pole.distance,
        deepest,
        rings: rings.length,
        ringSizes: rings.map(ring => ring.length).join('+'),
        box: `${(Math.max(...xs2) - Math.min(...xs2)).toFixed(1)} x ${(Math.max(...ys2) - Math.min(...ys2)).toFixed(1)} mm`,
        cell: sdf.cellMm,
      });
    }
  }
}

const seconds = (Date.now() - startedAt) / 1000;
console.log(`  ${polygons} polygons, ${(cells / 1e6).toFixed(1)}M cells, ${seconds.toFixed(1)} s, ` +
  `${(cells * 4 / 1e6).toFixed(0)} MB if all kept at once`);
console.log(`  ${degenerate} degenerate polygons skipped (thinner than 0.5 mm on the page)`);
console.log(`  polygons disagreeing with polylabel by more than the tolerance: ${offenders.length}`);
offenders.sort((a, b) => b.error - a.error).slice(0, 8).forEach(item =>
  console.log(`    ${item.id}[${item.idx}] error ${item.error.toFixed(2)} mm: field ${item.sampled.toFixed(2)}, ` +
    `polylabel ${item.polylabelDistance.toFixed(2)}, field max ${item.deepest.toFixed(2)}, ` +
    `rings ${item.rings} (${item.ringSizes}), box ${item.box}, cell ${item.cell.toFixed(3)} mm`));
if (offenders.length) failures++;

console.log(failures ? `\n${failures} FAILURE(S)` : '\nall checks passed');
