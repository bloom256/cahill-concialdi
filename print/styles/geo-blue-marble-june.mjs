// ==================================================================
// STYLE: GEO-BLUE-MARBLE-JUNE
// ------------------------------------------------------------------

// Blue Marble with the June 2004 imagery: a green northern summer with
// little snow. Changes vs. geo-blue-marble: the source month only.

export default {
  extends    : ['geo-blue-marble'],
  name       : 'geo-blue-marble-june',
  description: 'NASA Blue Marble imagery (June 2004), upright view, faint graticule',

  imagery: { source: 'data/raw/bmng/world.topo.bathy.200406.3x21600x10800.jpg' },
};
