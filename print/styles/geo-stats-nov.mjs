// ==================================================================
// STYLE: GEO-STATS-NOV
// ------------------------------------------------------------------

// The November Blue Marble with country borders and every country's name,
// population, GDP, and GDP per capita. The three numbers share one line
// ("38.2M / $2.17T / $56.8K"), so the block is two lines and fits inside far
// more countries. Labels are 7-14 pt on the 190 cm print (5 and 6 pt were
// readable only up close): inside the country where they fit, otherwise right
// on top of the small country, and only when that spot is taken, a few mm away
// with a leader line. Countries under 1 million people show only their name;
// the threshold stays at 1 million because small countries are interesting too.
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
    statsLayout       : 'inline',  // population / GDP / GDP per capita on one line
    minStatsPopulation: 1e6,      // smaller countries get only their name, in the stats weight
    lineHeight        : 1.1,      // line box height relative to its font size
    fill              : 0.95,     // block size relative to the space it fits in (margin)
    maxNameSize       : '14pt',
    minNameSize       : '7pt',    // smallest inside label; below this, a small label on top
    minNameOnlySize   : '7pt',    // for countries without data (name only)
    anglesDeg         : [0],
    rotationPenalty   : 1.35,
    rotateFullBlock   : false,
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
