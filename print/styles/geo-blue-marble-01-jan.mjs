// ==================================================================
// STYLE: GEO-BLUE-MARBLE-01-JAN
// ------------------------------------------------------------------

// Blue Marble with the January 2004 imagery (northern winter, heavy snow).
// Changes vs. geo-blue-marble: the source month only.

export default {
  extends    : ['geo-blue-marble'],
  name       : 'geo-blue-marble-01-jan',
  description: 'NASA Blue Marble, January 2004: northern winter, heavy snow',

  imagery: { source: 'data/raw/bmng/world.topo.bathy.200401.3x21600x10800.jpg' },
};
