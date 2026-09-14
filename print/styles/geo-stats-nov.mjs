// ==================================================================
// STYLE: GEO-STATS-NOV
// ------------------------------------------------------------------

// The November Blue Marble with thin country borders and every country's
// name, population, GDP, and GDP per capita: inside the country where it
// fits, otherwise as a small callout next to it with a leader line, so even
// the smallest countries are labeled. White text with a dark halo reads over
// the imagery.
// Changes vs. geo-blue-marble-11-nov: country borders and stats labels.

export default {
  extends    : ['geo-blue-marble-11-nov'],
  name       : 'geo-stats-nov',
  description: 'November Blue Marble with borders and population and GDP for every country',

  admin0: {
    show        : true,
    stroke      : '#ffffff',
    opacity     : 0.7,
    width       : '0.3mm',
    disputedDash: ['1mm', '0.6mm'],
  },

  countryStats: {
    show           : true,
    data           : 'data/build/country-stats.json',
    font           : 'Barlow Condensed',
    nameWeight     : 600,
    statsWeight    : 400,
    statsScale     : 0.72,     // stat line size relative to the name size
    lineHeight     : 1.1,      // line box height relative to its font size
    fill           : 0.9,      // block size relative to the space it fits in (margin)
    maxNameSize    : '22pt',
    minNameSize    : '5pt',    // smallest inside label; below this, a callout
    minNameOnlySize: '5pt',    // for countries without data (name only)
    anglesDeg      : [0],
    rotationPenalty: 1.35,
    rotateFullBlock: false,
    textColor      : 'fixed',
    color          : '#ffffff',
    haloColor      : '#02060d',
    haloWidthEm    : 0.28,     // halo stroke width relative to each line's font size
    haloOpacity    : 0.75,
    callouts       : {
      show           : true,
      nameSize       : '5pt',
      statsScale     : 0.8,    // callout stats are relatively larger, for legibility
      distancesMm    : [2, 4, 7, 11, 16, 22, 30, 40, 55, 75],
      dotRadius      : '0.35mm',
      leaderWidth    : '0.15mm',
      leaderHaloWidth: '0.35mm',
      color          : '#ffffff',
      opacity        : 0.9,
    },
  },
};
