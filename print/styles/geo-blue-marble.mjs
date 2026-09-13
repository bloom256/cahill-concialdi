// ==================================================================
// STYLE: GEO-BLUE-MARBLE
// ------------------------------------------------------------------

// NASA Blue Marble Next Generation imagery (with topography and bathymetry)
// in the upright, North-Pole-centered view, with a faint white graticule and
// no country fills, borders, or labels.

export default {
  extends    : ['seav-upright'],
  name       : 'geo-blue-marble',
  description: 'NASA Blue Marble imagery, upright view, faint graticule',

  // December 2004, 21600x10800 (get it with npm run fetch-imagery)
  imagery: { show: true, source: 'data/raw/bmng/world.topo.bathy.200412.3x21600x10800.jpg', dpi: 150 },

  graticule: { stroke: '#ffffff', opacity: 0.18 },

  circles: { stroke: '#ffffff', opacity: 0.35 },

  land: { show: false },

  admin0: { show: false },
};
