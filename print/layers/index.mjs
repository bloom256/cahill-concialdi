// ==================================================================
// LAYER STACK (BOTTOM TO TOP)
// ------------------------------------------------------------------

// Order follows docs/print/LAYERS.md. Each layer module exports
// { id, space: 'map' | 'page', enabled(style), render(ctx) -> SVG string }
// where render may also return a Promise of the string.

import paper           from './paper.mjs';
import ocean           from './ocean.mjs';
import imagery         from './imagery.mjs';
import graticule       from './graticule.mjs';
import circles         from './circles.mjs';
import land            from './land.mjs';
import admin0          from './admin0.mjs';
import graticuleLabels from './graticule-labels.mjs';
import countryStats    from './country-stats.mjs';

export default [
  paper,
  ocean,
  imagery,
  graticule,
  circles,
  land,
  admin0,
  graticuleLabels,
  countryStats,
];
