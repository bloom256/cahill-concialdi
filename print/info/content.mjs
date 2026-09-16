// ==================================================================
// INFO PANEL CONTENT
// ------------------------------------------------------------------

// The words on the map's info panel, kept apart from the layout code so they
// can be edited on their own. Each column is a list of blocks, drawn top to
// bottom: { heading }, { text } (wrapped to the column), { distortion } (the
// small map of equal circles), { labelKey } (example labels), { gap } in mm.

// Example labels in the key, set exactly as on the map, with what they mean
export const LABEL_EXAMPLES = [
  { lines: ['Russia', 'Pop 144M', 'GDP $2.59T', 'GDP/cap $18K'],
    explain: 'Population, GDP, GDP per capita.' },
  { lines: ['DEU/84M', '$5T/$60K'],
    explain: 'Code/population, GDP/GDP per capita.' },
  { lines: ['PRT/10M/$346B/$33K'],
    explain: 'The same, on one line.' },
];

export const TITLE    = 'The World';
export const SUBTITLE = 'Cahill-Concialdi Bat projection';

export const COLUMNS = [
  [
    { heading: 'The projection' },
    { text:
      'The globe is cut into eight triangles, one for each octant, and each is ' +
      'flattened with a conformal formula, so small shapes keep their true form ' +
      'everywhere. Luca Concialdi arranged the triangles in 2015 as the Bat, a ' +
      'rearrangement of B.J.S. Cahill\'s butterfly map of 1909, so that the whole ' +
      'northern hemisphere stays in one piece.' },
    { gap: 2 },
    { text:
      'The only cut in the north runs through the Bering Strait at 168.5 W. The ' +
      'southern oceans are torn instead, where no land is lost. Continents are ' +
      'neither sheared nor stretched, and their sizes stay close to true; the ' +
      'price is paid by the open ocean and by Antarctica, which appears far too large.' },
    { gap: 5 },
    { heading: 'Distortion' },
    { distortion: true },
    { gap: 2 },
    { text:
      'Every circle above has the same size on the globe, a radius of 700 km. ' +
      'They stay round everywhere, because shapes are true; only their size ' +
      'changes. Circles grow toward the corners of the eight triangles, and most ' +
      'of all around Antarctica.' },
  ],
  [
    { heading: 'Reading the labels' },
    { labelKey: true },
    { gap: 3 },
    { text:
      'Population in 2025; GDP and GDP per capita in 2024, in US dollars. ' +
      'K thousand, M million, B billion, T trillion. ' +
      'Codes are ISO three-letter codes: CHE is Switzerland, CZE is Czechia.' },
    { gap: 5 },
    { heading: 'Lines' },
    { text:
      'Meridians and parallels every 30 degrees. The equator is solid; the ' +
      'tropics and the polar circles are dashed. White lines are borders, and ' +
      'dashed borders are disputed or de facto lines.' },
    { gap: 5 },
    { heading: 'Sources' },
    { text: 'Imagery: NASA Earth Observatory, Blue Marble: Next Generation, November 2004.' },
    { text: 'Borders: Natural Earth, public domain.' },
    { text: 'Population: UN DESA, World Population Prospects 2024, 2025 (CC BY 3.0 IGO).' },
    { text: 'GDP: UN Statistics Division, National Accounts Main Aggregates, 2024 (UNdata).' },
  ],
];
