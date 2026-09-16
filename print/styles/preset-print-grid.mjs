// ==================================================================
// PRESET: PRINT GRID
// ------------------------------------------------------------------

// Shared grid settings for printed maps, not a map on its own:
// - line weights in millimeters sized for a 150 cm print (the web app's widths
//   print 3-4 times heavier: 0.7 mm graticule, 1.4 mm circles)
// - labels on meridians, parallels, the equator, tropics and polar circles
// Line colors stay with each style family.

export default {
  name: 'preset-print-grid',

  // 190 cm wide print (2 m of free wall); height follows the map shape (~108 cm),
  // less the empty ocean below Africa's tip: the lowest land on the page is Cape
  // Agulhas at 987 mm, so cutting 85 mm leaves a 9 mm margin under it and no land
  page: { mapWidthMm: 1900, cropTopMm: 45, cropBottomMm: 85 },

  graticule: { width: '0.2mm' },

  circles: { width: '0.35mm', dash: ['2.5mm', '1.5mm'] },

  graticuleLabels: {
    show                   : true,
    font                   : 'Barlow Condensed',
    weight                 : 400,
    size                   : '8pt',
    specialSize            : '10pt',
    letterSpacing          : '0.03em',
    color                  : '#ffffff',
    opacity                : 1,
    haloColor              : '#02060d',
    haloWidth              : '1mm',
    haloOpacity            : 1,        // fully opaque text and halo
    clearance              : '0.8mm',  // minimum gap to country labels, leader lines and dots
    meridianEveryDeg       : 30,
    meridianLabelLatitudes : [40, -40],  // not 45 S: that parallel is a tear between 25 W and 65 E
    parallelEveryDeg       : 30,
    parallelLabelLongitudes: [-165, -105, -45, 15, 75, 135],
    specialCircles         : {
      equator          : [-45, 85],
      tropicOfCancer   : [-45, 165],
      tropicOfCapricorn: [-45, 85],
      arcticCircle     : [-35, 160],
      antarcticCircle  : [-45, 120],
    },
  },
};
