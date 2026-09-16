// ==================================================================
// STYLE: GEO-STATS-NOV
// ------------------------------------------------------------------

// The November Blue Marble with country borders and every country's code,
// population, GDP, and GDP per capita, as a two-line block of similar widths:
// "FRA/67M" over "$3T/$51K". Labels are 7-14 pt on the 190 cm print (5 and 6 pt
// were readable only up close).
// - Rotation is decided by shape (PCA): only a long, thin country turns its
//   label along its own axis; compact ones stay horizontal, which reads best.
//   A country that long gets its block as one line: PRT/10M/$346B/$33K.
// - The largest compact countries get the readable labeled form instead, with
//   exact figures: Russia / Pop 144M / GDP $2.17T / GDP/cap $14.9K.
// - Positions are then optimized for all labels at once (joint solver); angles
//   and sizes are left exactly as placed.
// Countries under 1 million people show only their name; the threshold stays
// at 1 million because small countries are interesting too.
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

  // Island groups the country labels never reach (the US name sits on the mainland)
  places: {
    show       : true,
    data       : 'data/places.json',
    font       : 'Barlow Condensed',
    weight     : 300,      // Light, like the names of countries under 1 million people
    size       : '6pt',
    lineHeight : 1.1,
    color      : '#ffffff',
    opacity    : 1,
    haloColor  : '#02060d',
    haloWidthEm: 0.28,
    haloOpacity: 1,
    offsetsMm  : [0, 1, 2, 3, 5, 8],
  },

  countryStats: {
    show              : true,
    data              : 'data/build/country-stats.json',
    font              : 'Barlow Condensed',
    nameWeight        : 500,      // Medium: thinner glyphs stay crisp inside the outline
    statsWeight       : 300,      // Light
    statsScale        : 0.72,     // stat line size relative to the name size
    statsLayout       : 'two-line',  // "FRA/67M" over "$3T/$51K"
    statsSeparator    : '/',         // no spaces
    statsDecimals     : 0,           // whole numbers only
    nameSource        : 'iso3',    // three-letter codes instead of names
    minStatsPopulation: 1e6,      // smaller countries get only their name, in the stats weight
    lineHeight        : 1.1,      // line box height relative to its font size
    fill              : 0.95,     // block size relative to the space it fits in (margin)
    maxNameSize       : '14pt',
    minNameSize       : '7pt',    // smallest inside label; below this, a small label on top
    minNameOnlySize   : '7pt',    // for countries without data (name only)
    anglesDeg          : [0],
    rotationPenalty    : 1.35,
    rotateFullBlock    : true,
    maxAngleDeg        : 90,     // a thin country's label may lie along its own axis
    rotateMinElongation: 2.2,    // PCA long/short ratio; below this a label is never rotated
    singleLineAlongAxis: true,   // a rotated label becomes one line when that fits larger
    // Every country whose largest piece covers at least 3000 mm2 of the print
    // gets the full labeled block with exact figures, provided it fits; the
    // text stays at the usual size, never larger than 14 pt
    fullLabel          : { minAreaMm2: 3000, roundNumbers: false },
    solver             : 'anneal',
    solverOptions      : { optimizeTheta: false, optimizeSize: false },  // positions only
    textColor         : 'fixed',
    color             : '#ffffff',
    haloColor         : '#02060d',
    haloWidthEm       : 0.28,     // halo stroke width relative to each line's font size
    haloOpacity       : 1,        // fully opaque: a translucent halo made letters look see-through
    callouts          : {
      show            : true,
      nameSize        : '7pt',
      overlaySizes    : ['7pt', '6.5pt', '6pt'],  // on its own country, shrink rather than take a leader line
      statsScale      : 0.8,   // small labels' stats are relatively larger, for legibility
      overlayOffsetsMm    : [0, 1, 2, 3],  // first try right on the country, no leader line
      minLeaderPopulation : 3e5,   // below this, leave the country unlabeled rather than draw a line
      distancesMm     : [2, 4, 7, 11, 16, 22, 30, 40, 55, 75],
      dotRadius       : '0.3mm',
      leaderWidth     : '0.12mm',
      leaderHaloWidth : '0.3mm',
      color           : '#ffffff',
      opacity         : 1,
    },
  },
};
