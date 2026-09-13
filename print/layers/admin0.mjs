// ==================================================================
// LAYER: ADMIN-0 BOUNDARIES (COUNTRY BORDERS)
// ------------------------------------------------------------------

import { geoJsonToPathData } from '../../map-geometry.mjs';
import { attrs } from '../svg.mjs';

export default {
  id     : 'admin0',
  space  : 'map',
  enabled: style => Boolean(style.admin0?.show),
  render : ctx => {

    const { admin0 } = ctx.style;
    const disputedDash = ctx.lenList(admin0.disputedDash);

    // Data rows are [isUndisputed, LineString]
    const paths = ctx.data(admin0.data).map(([isUndisputed, lineString]) => `<path${attrs({
      class             : isUndisputed ? undefined : 'disputed',
      d                 : geoJsonToPathData(lineString),
      'stroke-dasharray': isUndisputed ? undefined : disputedDash,
    })}/>`);

    return (
      `<g${attrs({
        id               : 'admin0',
        fill             : 'none',
        stroke           : admin0.stroke,
        'stroke-width'   : ctx.len(admin0.width),
        'stroke-linejoin': 'round',
        'stroke-linecap' : 'round',
      })}>` +
      paths.join('') +
      '</g>'
    );
  },
};
