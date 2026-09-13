// ==================================================================
// LAYER: GRATICULE
// ------------------------------------------------------------------

import { generateGraticule, pointListsToPathData } from '../../map-geometry.mjs';
import { attrs } from '../svg.mjs';

export default {
  id     : 'graticule',
  space  : 'map',
  enabled: style => Boolean(style.graticule?.show),
  render : ctx => {
    const { graticule } = ctx.style;
    return (
      `<g${attrs({
        id            : 'graticule',
        fill          : 'none',
        stroke          : graticule.stroke,
        'stroke-width'  : ctx.len(graticule.width),
        'stroke-opacity': graticule.opacity,
      })}>` +
      `<path${attrs({ d: pointListsToPathData(generateGraticule(graticule.intervalDeg), false) })}/>` +
      '</g>'
    );
  },
};
