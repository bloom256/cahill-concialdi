// ==================================================================
// LAYER: LAND (COUNTRY FILLS)
// ------------------------------------------------------------------

import { geoJsonToPathData, getPositionColor } from '../../map-geometry.mjs';
import { attrs, formatColor } from '../svg.mjs';

// ------------------------------------------------------------------

// Fill color modes: functions from a country's MultiPolygon to [red, green, blue]
export const COLOR_MODES = {
  position: getPositionColor,
};

// ------------------------------------------------------------------

export default {
  id     : 'land',
  space  : 'map',
  enabled: style => Boolean(style.land?.show),
  render : ctx => {

    const { land } = ctx.style;
    const getColor = COLOR_MODES[land.mode];
    if (!getColor) throw new Error(`Unknown land.mode: ${land.mode}`);

    // Each country is stroked with its own fill color to hide seams between
    // adjacent polygons (sealWidth), as in the original web app
    const paths = ctx.data(land.data).map(([isoCode, multiPolygon]) => {
      const color = formatColor(getColor(multiPolygon));
      return `<path${attrs({
        id    : 'iso-' + isoCode,
        d     : geoJsonToPathData(multiPolygon),
        fill  : color,
        stroke: color,
      })}/>`;
    });

    return (
      `<g${attrs({
        id               : 'land',
        'stroke-width'   : ctx.len(land.sealWidth),
        'stroke-linejoin': 'round',
      })}>` +
      paths.join('') +
      '</g>'
    );
  },
};
