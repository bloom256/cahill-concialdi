// ==================================================================
// STYLE: GEO-BLUE-MARBLE-05-MAY
// ------------------------------------------------------------------

// Blue Marble with the May 2004 imagery (late spring, forests turning green).
// Changes vs. geo-blue-marble: the source month only.

export default {
  extends    : ['geo-blue-marble'],
  name       : 'geo-blue-marble-05-may',
  description: 'NASA Blue Marble, May 2004: late spring, forests turning green',

  imagery: { source: 'data/raw/bmng/world.topo.bathy.200405.3x21600x10800.jpg' },
};
