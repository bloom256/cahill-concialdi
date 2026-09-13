// ==================================================================
// STYLE: SEAV-UPRIGHT-STATS
// ------------------------------------------------------------------

// The upright original look with each country's name, population, GDP, and
// GDP per capita set inside the country.
// Changes vs. seav-upright: the country stats labels only.

export default {
  extends    : ['seav-upright'],
  name       : 'seav-upright-stats',
  description: 'Upright original look with country names, population, and GDP',

  countryStats: {
    show           : true,
    data           : 'data/build/country-stats.json',
    font           : 'Barlow Condensed',
    nameWeight     : 600,
    statsWeight    : 400,
    statsScale     : 0.72,     // stat line size relative to the name size
    lineHeight     : 1.1,      // line box height relative to its font size
    fill           : 0.9,      // block size relative to the space it fits in (margin)
    maxNameSize    : '28pt',
    minNameSize    : '8pt',    // below this, stats would drop under ~5.8 pt
    minNameOnlySize: '5pt',
    anglesDeg      : [0, -15, 15, -30, 30, -45, 45, -60, 60, -75, 75, -90],
    rotationPenalty: 1.35,     // rotated labels must be this much larger to win
    rotateFullBlock: false,    // only name-only labels may be rotated
    darkColor      : '#112233',
    lightColor     : '#f4f1ea',
  },
};
