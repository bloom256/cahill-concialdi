// ==================================================================
// LAYER: GRATICULE LABELS
// ------------------------------------------------------------------

// Labels meridians, parallels, and the special circles (equator, tropics,
// polar circles) directly on the map. Each label is set along its line: the
// text follows the line's local direction, is never upside down, and has a
// soft halo so it stays legible over imagery. A point that lies in several
// map areas (on a cut of the map) gets a label on each side.
//
// Labels avoid ones already placed (ctx.labelBoxes, e.g. country labels): a
// colliding label slides along its own line in small steps, and is skipped if
// no free spot is found.

import { EARTH_TILT, DEGS_IN_CIRCLE } from '../../globals.mjs';
import { LatLon } from '../../data-types.mjs';
import { MAP_AREAS, project } from '../../concialdi.mjs';
import { measureText, getVerticalMetrics } from '../fonts.mjs';
import { attrs, escapeXml, formatNumber } from '../svg.mjs';

// ------------------------------------------------------------------

const DEGREE_SIGN      = String.fromCharCode(176);
const DIRECTION_STEP   = 0.5;   // degrees used to measure a line's local direction
const DUPLICATE_MM     = 2;     // placements closer than this are the same label
const LINE_HEIGHT      = 1.2;   // label box height relative to the font size
const QUARTER_CIRCLE   = DEGS_IN_CIRCLE / 4;

// Degrees to slide a colliding label along its line, nearest first
const SHIFT_STEPS_DEG = [2, -2, 4, -4, 6, -6, 8, -8, 10, -10, 12, -12];

// Special circles: name and latitude
const SPECIAL_CIRCLES = {
  equator          : { name: 'Equator'            , lat: 0                              },
  tropicOfCancer   : { name: 'Tropic of Cancer'   , lat: EARTH_TILT                     },
  tropicOfCapricorn: { name: 'Tropic of Capricorn', lat: -EARTH_TILT                    },
  arcticCircle     : { name: 'Arctic Circle'      , lat: QUARTER_CIRCLE - EARTH_TILT    },
  antarcticCircle  : { name: 'Antarctic Circle'   , lat: -(QUARTER_CIRCLE - EARTH_TILT) },
};

// ------------------------------------------------------------------

const normalizeLon = lon => ((lon + 540) % 360) - 180;

function formatLon(lon) {
  const normalized = normalizeLon(lon);
  if (normalized === 0 || Math.abs(normalized) === 180) return Math.abs(normalized) + DEGREE_SIGN;
  return Math.abs(normalized) + DEGREE_SIGN + (normalized < 0 ? 'W' : 'E');
}

const formatLat = lat => Math.abs(lat) + DEGREE_SIGN + (lat < 0 ? 'S' : 'N');

const doBoxesOverlap = (a, b) => a.minX < b.maxX && b.minX < a.maxX && a.minY < b.maxY && b.minY < a.maxY;

// Returns { point: [x, y], angleDeg } in page mm for a point on a line within
// one map area, or null if the area does not contain the point. The direction
// comes from two nearby points along the line (parallel: along longitude;
// meridian: along latitude), flipped when needed so text is never upside down.
function getPlacement(ctx, lat, lon, areaIdx, isAlongParallel) {

  const latLon = new LatLon(lat, normalizeLon(lon));
  const area = MAP_AREAS[areaIdx];
  if (Math.abs(lat) >= QUARTER_CIRCLE || !area.contains(latLon)) return null;

  const areaLon = area.hasAntimeridian && latLon.lon < 0 ? latLon.lon + DEGS_IN_CIRCLE : latLon.lon;
  const [deltaLat, deltaLon] = isAlongParallel ? [0, DIRECTION_STEP] : [DIRECTION_STEP, 0];
  const point  = ctx.toPage(project(new LatLon(lat, areaLon), areaIdx));
  const ahead  = ctx.toPage(project(new LatLon(Math.min(90, lat + deltaLat), areaLon + deltaLon), areaIdx));
  const behind = ctx.toPage(project(new LatLon(Math.max(-90, lat - deltaLat), areaLon - deltaLon), areaIdx));

  let angleDeg = Math.atan2(ahead[1] - behind[1], ahead[0] - behind[0]) * 180 / Math.PI;
  if (angleDeg > 90) angleDeg -= 180;
  if (angleDeg <= -90) angleDeg += 180;
  return { point, angleDeg };
}

// ------------------------------------------------------------------

export default {
  id     : 'graticuleLabels',
  space  : 'page',
  enabled: style => Boolean(style.graticuleLabels?.show),
  render : ctx => {

    const config = ctx.style.graticuleLabels;
    const { ascender, descender } = getVerticalMetrics(config.font, config.weight);
    const letterSpacingEm = parseFloat(config.letterSpacing ?? '0') || 0;
    const haloMm = ctx.mm(config.haloWidth);
    ctx.useFont(config.font, config.weight);

    const texts = [];
    let numShifted = 0;
    let numSkipped = 0;

    // Places a label on a line at lat/lon in every map area containing it,
    // offset along the text's own "up" direction by offsetMm (positive =
    // beside the line), sliding along the line to avoid placed labels
    const placeLabel = (text, lat, lon, isAlongParallel, sizeMm, offsetMm = 0) => {

      const width  = measureText(text, config.font, config.weight, sizeMm) + letterSpacingEm * sizeMm * text.length + haloMm;
      const height = sizeMm * LINE_HEIGHT + haloMm;
      const placedPoints = [];

      MAP_AREAS.forEach((_, areaIdx) => {

        const origin = getPlacement(ctx, lat, lon, areaIdx, isAlongParallel);
        if (!origin) return;
        if (placedPoints.some(point => Math.hypot(point[0] - origin.point[0], point[1] - origin.point[1]) < DUPLICATE_MM)) return;
        placedPoints.push(origin.point);

        for (const shiftDeg of [0, ...SHIFT_STEPS_DEG]) {

          const placement = shiftDeg === 0
            ? origin
            : isAlongParallel
              ? getPlacement(ctx, lat, lon + shiftDeg, areaIdx, true)
              : getPlacement(ctx, lat + shiftDeg, lon, areaIdx, false);
          if (!placement) continue;

          const angle = placement.angleDeg * Math.PI / 180;
          const centerX = placement.point[0] + Math.sin(angle) * offsetMm;
          const centerY = placement.point[1] - Math.cos(angle) * offsetMm;
          const halfWidth  = (Math.abs(Math.cos(angle)) * width + Math.abs(Math.sin(angle)) * height) / 2;
          const halfHeight = (Math.abs(Math.sin(angle)) * width + Math.abs(Math.cos(angle)) * height) / 2;
          const box = { minX: centerX - halfWidth, maxX: centerX + halfWidth, minY: centerY - halfHeight, maxY: centerY + halfHeight };
          if (ctx.labelBoxes.some(other => doBoxesOverlap(box, other))) continue;

          ctx.labelBoxes.push(box);
          if (shiftDeg !== 0) numShifted++;
          texts.push(`<text${attrs({
            x          : centerX,
            y          : centerY + (ascender + descender) / 2 * sizeMm,
            'font-size': sizeMm,
            transform  : `rotate(${formatNumber(placement.angleDeg)} ${formatNumber(centerX)} ${formatNumber(centerY)})`,
          })}>${escapeXml(text)}</text>`);
          return;
        }
        numSkipped++;
      });
    };

    const size = ctx.mm(config.size);
    const specialSize = ctx.mm(config.specialSize);

    // Special circles first (fewest, most important), named beside their lines
    Object.entries(config.specialCircles ?? {}).forEach(([key, longitudes]) => {
      const { name, lat } = SPECIAL_CIRCLES[key];
      longitudes.forEach(lon => placeLabel(name, lat, lon, true, specialSize, specialSize * 0.9));
    });

    // Meridians, labeled where they cross the chosen latitudes
    for (let lon = -180; lon < 180; lon += config.meridianEveryDeg) {
      config.meridianLabelLatitudes.forEach(lat => placeLabel(formatLon(lon), lat, lon, false, size));
    }

    // Parallels, labeled at the chosen longitudes
    for (let lat = -90 + config.parallelEveryDeg; lat < 90; lat += config.parallelEveryDeg) {
      if (lat === 0) continue;
      config.parallelLabelLongitudes.forEach(lon => placeLabel(formatLat(lat), lat, lon, true, size));
    }

    ctx.notes.push(`graticuleLabels: ${texts.length} labels (${numShifted} moved to avoid other labels, ${numSkipped} skipped)`);

    return (
      `<g${attrs({
        id               : 'graticule-labels',
        'font-family'    : config.font,
        'font-weight'    : config.weight,
        'text-anchor'    : 'middle',
        fill             : config.color,
        'fill-opacity'   : config.opacity,
        stroke           : config.haloColor,
        'stroke-width'   : haloMm,
        'stroke-opacity' : config.haloOpacity,
        'stroke-linejoin': 'round',
        'paint-order'    : 'stroke',
        'letter-spacing' : config.letterSpacing,
      })}>` +
      texts.join('') +
      '</g>'
    );
  },
};
