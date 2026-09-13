// ==================================================================
// LAYER STACK (BOTTOM TO TOP)
// ------------------------------------------------------------------

// Order follows docs/print/LAYERS.md. Each layer module exports
// { id, space: 'map' | 'page', enabled(style), render(ctx) -> SVG string }.

import paper     from './paper.mjs';
import ocean     from './ocean.mjs';
import graticule from './graticule.mjs';
import circles   from './circles.mjs';
import land      from './land.mjs';
import admin0    from './admin0.mjs';

export default [
  paper,
  ocean,
  graticule,
  circles,
  land,
  admin0,
];
