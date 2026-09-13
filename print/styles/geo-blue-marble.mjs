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

  imagery: { show: true, source: 'nasa-blue-marble-ng.jpg', dpi: 100 },

  graticule: { stroke: '#ffffff', opacity: 0.18 },

  circles: { stroke: '#ffffff', opacity: 0.35 },

  land: { show: false },

  admin0: { show: false },
};
