// ==================================================================
// STYLE: GEO-STATS-NOV
// ------------------------------------------------------------------

// The November Blue Marble with country borders and every country's name,
// population, GDP, and GDP per capita. Labels are small (3-10 pt, meant to be
// read up close on the high-resolution print): inside the country where they
// fit, otherwise right on top of the small country, and only when that spot
// is taken, a few mm away with a leader line. White text with a dark halo
// reads over the imagery.
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
    fill           : 0.95,     // block size relative to the space it fits in (margin)
    maxNameSize    : '10pt',
    minNameSize    : '3pt',    // smallest inside label; below this, a small label on top
    minNameOnlySize: '3pt',    // for countries without data (name only)
    anglesDeg      : [0],
    rotationPenalty: 1.35,
    rotateFullBlock: false,
    textColor      : 'fixed',
    color          : '#ffffff',
    haloColor      : '#02060d',
    haloWidthEm    : 0.28,     // halo stroke width relative to each line's font size
    haloOpacity    : 0.75,
    callouts       : {
      show            : true,
      nameSize        : '3pt',
      statsScale      : 0.8,   // small labels' stats are relatively larger, for legibility
      overlayOffsetsMm: [0, 1, 2, 3],  // first try right on the country, no leader line
      distancesMm     : [2, 4, 7, 11, 16, 22, 30, 40, 55, 75],
      dotRadius       : '0.3mm',
      leaderWidth     : '0.12mm',
      leaderHaloWidth : '0.3mm',
      color           : '#ffffff',
      opacity         : 0.9,
    },
  },
};
