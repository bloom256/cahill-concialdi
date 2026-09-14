// ==================================================================
// STYLE: GEO-BLUE-MARBLE-07-JUL
// ------------------------------------------------------------------

// Blue Marble with the July 2004 imagery (midsummer, greenest north).
// Changes vs. geo-blue-marble: the source month only.

export default {
  extends    : ['geo-blue-marble'],
  name       : 'geo-blue-marble-07-jul',
  description: 'NASA Blue Marble, July 2004: midsummer, greenest north',

  imagery: { source: 'data/raw/bmng/world.topo.bathy.200407.3x21600x10800.jpg' },
};
