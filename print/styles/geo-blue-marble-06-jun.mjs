// ==================================================================
// STYLE: GEO-BLUE-MARBLE-06-JUN
// ------------------------------------------------------------------

// Blue Marble with the June 2004 imagery (early summer, green, little snow).
// Changes vs. geo-blue-marble: the source month only.

export default {
  extends    : ['geo-blue-marble'],
  name       : 'geo-blue-marble-06-jun',
  description: 'NASA Blue Marble, June 2004: early summer, green, little snow',

  imagery: { source: 'data/raw/bmng/world.topo.bathy.200406.3x21600x10800.jpg' },
};
