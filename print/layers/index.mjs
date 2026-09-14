// ==================================================================
// LAYER STACK (BOTTOM TO TOP)
// ------------------------------------------------------------------

// Order follows docs/print/LAYERS.md. Each layer module exports
// { id, space: 'map' | 'page', enabled(style), render(ctx) -> SVG string }
// where render may also return a Promise of the string. Layers render in this
// order, so label layers listed later avoid labels placed by earlier ones.

import paper           from './paper.mjs';
import ocean           from './ocean.mjs';
import imagery         from './imagery.mjs';
import graticule       from './graticule.mjs';
import circles         from './circles.mjs';
import land            from './land.mjs';
import admin0          from './admin0.mjs';
import countryStats    from './country-stats.mjs';
import graticuleLabels from './graticule-labels.mjs';

export default [
  paper,
  ocean,
  imagery,
  graticule,
  circles,
  land,
  admin0,
  countryStats,
  graticuleLabels,
];
