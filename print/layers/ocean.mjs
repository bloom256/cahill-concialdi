// ==================================================================
// LAYER: OCEAN (MAP BACKGROUND / OUTLINE FILL)
// ------------------------------------------------------------------

import { generateMapOutline, pointListsToPathData } from '../../map-geometry.mjs';
import { attrs } from '../svg.mjs';

export default {
  id     : 'ocean',
  space  : 'map',
  enabled: style => Boolean(style.ocean?.show),
  render : ctx => `<path${attrs({
    id    : 'ocean',
    d     : pointListsToPathData([generateMapOutline()], false),
    fill  : ctx.style.ocean.fill,
    stroke: 'none',
  })}/>`,
};
