// ==================================================================
// COUNTRY STATS SNAPSHOT: NAMES, POPULATION, GDP, GDP PER CAPITA
// ------------------------------------------------------------------

// Fetches the most recent values from the World Bank API for every country id
// in ne-country-areas.json and writes data/build/country-stats.json. That file
// is committed as the pinned snapshot, so renders never change silently.
// Countries the World Bank does not cover (Taiwan) come from the IMF.
// Usage: node scripts/data/fetch-country-stats.mjs

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// ------------------------------------------------------------------

const ROOT     = resolve(fileURLToPath(import.meta.url), '../../..');
const OUT_FILE = join(ROOT, 'data', 'build', 'country-stats.json');

const WORLD_BANK_URL = 'https://api.worldbank.org/v2/country/all/indicator/{indicator}?format=json&mrnev=1&per_page=1000';
const IMF_URL        = 'https://www.imf.org/external/datamapper/api/v1/{indicator}/{iso3}';

// Stat key -> World Bank indicator, IMF indicator, and IMF unit multiplier
const INDICATORS = {
  population     : { worldBank: 'SP.POP.TOTL'   , imf: 'LP'     , imfMultiplier: 1e6 },
  gdpUsd         : { worldBank: 'NY.GDP.MKTP.CD', imf: 'NGDPD'  , imfMultiplier: 1e9 },
  gdpPerCapitaUsd: { worldBank: 'NY.GDP.PCAP.CD', imf: 'NGDPDPC', imfMultiplier: 1   },
};

// Countries missing from the World Bank but covered by the IMF (ISO2 -> ISO3)
const IMF_FALLBACKS = { TW: 'TWN' };

// Map-friendly names where the built-in CLDR names read awkwardly, plus the
// non-ISO ids of Natural Earth features
const NAME_OVERRIDES = {
  'CD'   : 'DR Congo',
  'CG'   : 'Congo',
  'HK'   : 'Hong Kong',
  'MO'   : 'Macao',
  'MM'   : 'Myanmar',
  'PS'   : 'Palestine',
  'CY-TR': 'Northern Cyprus',
  'SO-SD': 'Somaliland',
  '-99f' : 'Siachen Glacier',
};

// ------------------------------------------------------------------

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  return response.json();
}

function getMostCommon(values) {
  const counts = new Map();
  values.forEach(value => counts.set(value, (counts.get(value) ?? 0) + 1));
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

// JSON with non-ASCII characters escaped, so the file stays ASCII-only while
// names keep their diacritics
const toAsciiJson = value => JSON.stringify(value).replace(
  /[^\x00-\x7f]/g,
  char => '\\u' + char.charCodeAt(0).toString(16).padStart(4, '0'),
);

// ------------------------------------------------------------------

const ids = JSON.parse(await readFile(join(ROOT, 'ne-country-areas.json'), 'utf8')).map(([id]) => id);
const displayNames = new Intl.DisplayNames(['en'], { type: 'region' });
const countries = Object.fromEntries(ids.map(id => [id, { name: NAME_OVERRIDES[id] ?? displayNames.of(id) }]));

for (const [key, indicator] of Object.entries(INDICATORS)) {

  const [, rows] = await fetchJson(WORLD_BANK_URL.replace('{indicator}', indicator.worldBank));
  rows
    .filter(row => row.value !== null && Object.hasOwn(countries, row.country.id))
    .forEach(row => {
      countries[row.country.id][key] = { value: Math.round(row.value), year: Number(row.date), source: 'World Bank' };
    });

  // Fallbacks use the year most World Bank values have, for comparability
  const year = getMostCommon(Object.values(countries).map(entry => entry[key]?.year).filter(Boolean));
  for (const [iso2, iso3] of Object.entries(IMF_FALLBACKS)) {
    if (countries[iso2][key]) continue;
    const url = IMF_URL.replace('{indicator}', indicator.imf).replace('{iso3}', iso3);
    const value = (await fetchJson(url)).values?.[indicator.imf]?.[iso3]?.[year];
    if (value !== undefined) {
      countries[iso2][key] = { value: Math.round(value * indicator.imfMultiplier), year, source: 'IMF' };
    }
  }

  const missing = ids.filter(id => !countries[id][key]);
  console.log(`${key}: ${ids.length - missing.length}/${ids.length} (most recent year ${year}); missing: ${missing.join(' ')}`);
}

const sources = {
  'World Bank': 'World Development Indicators API: SP.POP.TOTL, NY.GDP.MKTP.CD (current US$), NY.GDP.PCAP.CD (current US$); most recent non-empty value per country',
  'IMF'       : 'World Economic Outlook DataMapper API: LP, NGDPD, NGDPDPC; values for recent years may be IMF estimates',
};
const countryLines = Object.entries(countries).map(([id, entry]) => `    ${toAsciiJson(id)}: ${toAsciiJson(entry)}`);
await mkdir(dirname(OUT_FILE), { recursive: true });
await writeFile(OUT_FILE,
  '{\n' +
  `  "fetched": ${toAsciiJson(new Date().toISOString().slice(0, 10))},\n` +
  `  "sources": ${toAsciiJson(sources)},\n` +
  '  "countries": {\n' + countryLines.join(',\n') + '\n  }\n' +
  '}\n'
);
console.log(`Wrote ${OUT_FILE}`);
