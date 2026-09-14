// ==================================================================
// STYLE: GEO-LABELED-GRID
// ------------------------------------------------------------------

// The November Blue Marble with labeled meridians and parallels, and the
// equator, tropics, and polar circles named along their lines.
// Changes vs. geo-blue-marble: the graticule labels only.

export default {
  extends    : ['geo-blue-marble'],
  name       : 'geo-labeled-grid',
  description: 'November Blue Marble with labeled meridians, parallels, equator, tropics and polar circles',

  graticuleLabels: {
    show                   : true,
    font                   : 'Barlow Condensed',
    weight                 : 400,
    size                   : '8pt',
    specialSize            : '10pt',
    letterSpacing          : '0.03em',
    color                  : '#ffffff',
    opacity                : 0.92,
    haloColor              : '#02060d',
    haloWidth              : '1mm',
    haloOpacity            : 0.8,
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
