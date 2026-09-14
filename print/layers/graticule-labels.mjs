// ==================================================================
// LAYER: GRATICULE LABELS
// ------------------------------------------------------------------

// Labels meridians, parallels, and the special circles (equator, tropics,
// polar circles) directly on the map. Each label is set along its line: the
// text follows the line's local direction, is never upside down, and has a
// soft halo so it stays legible over imagery. A point that lies in several
// map areas (on a cut of the map) gets a label on each side.

import { EARTH_TILT, DEGS_IN_CIRCLE } from '../../globals.mjs';
import { LatLon } from '../../data-types.mjs';
import { MAP_AREAS, project } from '../../concialdi.mjs';
import { getVerticalMetrics } from '../fonts.mjs';
import { attrs, escapeXml, formatNumber } from '../svg.mjs';

// ------------------------------------------------------------------

const DEGREE_SIGN      = String.fromCharCode(176);
const DIRECTION_STEP   = 0.5;   // degrees used to measure a line's local direction
const DUPLICATE_MM     = 2;     // labels closer than this are the same label
const QUARTER_CIRCLE   = DEGS_IN_CIRCLE / 4;

// Special circles: name and latitude
const SPECIAL_CIRCLES = {
  equator         : { name: 'Equator'            , lat: 0                             },
  tropicOfCancer  : { name: 'Tropic of Cancer'   , lat: EARTH_TILT                    },
  tropicOfCapricorn: { name: 'Tropic of Capricorn', lat: -EARTH_TILT                   },
  arcticCircle    : { name: 'Arctic Circle'      , lat: QUARTER_CIRCLE - EARTH_TILT   },
  antarcticCircle : { name: 'Antarctic Circle'   , lat: -(QUARTER_CIRCLE - EARTH_TILT)},
};

// ------------------------------------------------------------------

function formatLon(lon) {
  const normalized = ((lon + 540) % 360) - 180;
  if (normalized === 0 || Math.abs(normalized) === 180) return Math.abs(normalized) + DEGREE_SIGN;
  return Math.abs(normalized) + DEGREE_SIGN + (normalized < 0 ? 'W' : 'E');
}

const formatLat = lat => Math.abs(lat) + DEGREE_SIGN + (lat < 0 ? 'S' : 'N');

// Returns the indices of all map areas that contain the point
function getAreaIndices(latLon) {
  return MAP_AREAS.flatMap((area, idx) => area.contains(latLon) ? [idx] : []);
}

// Returns placements { point: [x, y], angleDeg } in page mm for a point on a
// line, one per map area containing it. The direction comes from two nearby
// points along the line (parallel: along longitude; meridian: along latitude),
// flipped when needed so text is never upside down.
function getPlacements(ctx, lat, lon, isAlongParallel) {
  const latLon = new LatLon(lat, ((lon + 540) % 360) - 180);
  const placements = [];
  getAreaIndices(latLon).forEach(idx => {
    const area = MAP_AREAS[idx];
    const areaLon = area.hasAntimeridian && latLon.lon < 0 ? latLon.lon + DEGS_IN_CIRCLE : latLon.lon;
    const [deltaLat, deltaLon] = isAlongParallel ? [0, DIRECTION_STEP] : [DIRECTION_STEP, 0];
    const point = ctx.toPage(project(new LatLon(lat, areaLon), idx));
    const ahead = ctx.toPage(project(new LatLon(Math.min(90, lat + deltaLat), areaLon + deltaLon), idx));
    const behind = ctx.toPage(project(new LatLon(Math.max(-90, lat - deltaLat), areaLon - deltaLon), idx));
    let angleDeg = Math.atan2(ahead[1] - behind[1], ahead[0] - behind[0]) * 180 / Math.PI;
    if (angleDeg > 90) angleDeg -= 180;
    if (angleDeg <= -90) angleDeg += 180;
    if (!placements.some(other => Math.hypot(other.point[0] - point[0], other.point[1] - point[1]) < DUPLICATE_MM)) {
      placements.push({ point, angleDeg });
    }
  });
  return placements;
}

// ------------------------------------------------------------------

export default {
  id     : 'graticuleLabels',
  space  : 'page',
  enabled: style => Boolean(style.graticuleLabels?.show),
  render : ctx => {

    const config = ctx.style.graticuleLabels;
    const { ascender, descender } = getVerticalMetrics(config.font, config.weight);
    ctx.useFont(config.font, config.weight);

    const texts = [];

    // A label centered on its placement, shifted along the text's own "up"
    // direction by offsetMm (positive = above the line)
    const addLabel = (text, { point, angleDeg }, sizeMm, offsetMm = 0) => {
      const angle = angleDeg * Math.PI / 180;
      const x = point[0] + Math.sin(angle) * offsetMm;
      const y = point[1] - Math.cos(angle) * offsetMm + (ascender + descender) / 2 * sizeMm;
      texts.push(`<text${attrs({
        x,
        y,
        'font-size': sizeMm,
        transform  : `rotate(${formatNumber(angleDeg)} ${formatNumber(point[0])} ${formatNumber(point[1])})`,
      })}>${escapeXml(text)}</text>`);
    };

    const size = ctx.mm(config.size);
    const specialSize = ctx.mm(config.specialSize);

    // Meridians, labeled where they cross the chosen latitudes
    for (let lon = -180; lon < 180; lon += config.meridianEveryDeg) {
      config.meridianLabelLatitudes.forEach(lat => {
        getPlacements(ctx, lat, lon, false).forEach(placement => addLabel(formatLon(lon), placement, size));
      });
    }

    // Parallels, labeled at the chosen longitudes
    for (let lat = -90 + config.parallelEveryDeg; lat < 90; lat += config.parallelEveryDeg) {
      if (lat === 0) continue;
      config.parallelLabelLongitudes.forEach(lon => {
        getPlacements(ctx, lat, lon, true).forEach(placement => addLabel(formatLat(lat), placement, size));
      });
    }

    // Special circles, named beside their lines at the chosen longitudes
    Object.entries(config.specialCircles ?? {}).forEach(([key, longitudes]) => {
      const { name, lat } = SPECIAL_CIRCLES[key];
      longitudes.forEach(lon => {
        getPlacements(ctx, lat, lon, true).forEach(placement => addLabel(name, placement, specialSize, specialSize * 0.9));
      });
    });

    ctx.notes.push(`graticuleLabels: ${texts.length} labels`);

    return (
      `<g${attrs({
        id                : 'graticule-labels',
        'font-family'     : config.font,
        'font-weight'     : config.weight,
        'text-anchor'     : 'middle',
        fill              : config.color,
        'fill-opacity'    : config.opacity,
        stroke            : config.haloColor,
        'stroke-width'    : ctx.mm(config.haloWidth),
        'stroke-opacity'  : config.haloOpacity,
        'stroke-linejoin' : 'round',
        'paint-order'     : 'stroke',
        'letter-spacing'  : config.letterSpacing,
      })}>` +
      texts.join('') +
      '</g>'
    );
  },
};
