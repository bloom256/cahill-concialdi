// ==================================================================
// LAYER: EQUATOR, TROPIC AND POLAR CIRCLES
// ------------------------------------------------------------------

import { generateEquator, generatePolarTropicCircles, pointListsToPathData } from '../../map-geometry.mjs';
import { attrs } from '../svg.mjs';

export default {
  id     : 'circles',
  space  : 'map',
  enabled: style => Boolean(style.circles?.show),
  render : ctx => {
    const { circles } = ctx.style;
    return (
      `<g${attrs({
        id            : 'circles',
        fill          : 'none',
        stroke        : circles.stroke,
        'stroke-width': ctx.len(circles.width),
      })}>` +
      `<path${attrs({
        class: 'equator',
        d    : pointListsToPathData(generateEquator(), false),
      })}/>` +
      `<path${attrs({
        class             : 'polar-tropic',
        d                 : pointListsToPathData(generatePolarTropicCircles(), false),
        'stroke-dasharray': ctx.lenList(circles.dash),
      })}/>` +
      '</g>'
    );
  },
};
