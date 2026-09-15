// ==================================================================
// COUNTRY STATS SNAPSHOT: NAMES, POPULATION, GDP, GDP PER CAPITA
// ------------------------------------------------------------------

// Builds data/build/country-stats.json for every country id in
// ne-country-areas.json from:
// - population: UN World Population Prospects 2024, medium variant, 2025
// - GDP (current US$): the newest year available from the IMF World Economic
//   Outlook (DataMapper API, up to 2025) or the UN National Accounts Main
//   Aggregates (up to 2024); the IMF wins ties
// - GDP per capita: that GDP divided by the UN population of the same year,
//   so both numbers rest on one population source
// The output file is committed as the pinned snapshot, so renders never
// change silently. Downloads are cached in data/raw/stats/ (gitignored).
// Usage: node scripts/data/fetch-country-stats.mjs [--refresh]

import * as XLSX from 'xlsx';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';

// ------------------------------------------------------------------

const ROOT      = resolve(fileURLToPath(import.meta.url), '../../..');
const OUT_FILE  = join(ROOT, 'data', 'build', 'country-stats.json');
const CACHE_DIR = join(ROOT, 'data', 'raw', 'stats');

const UN_WPP_URL = 'https://population.un.org/wpp/assets/Excel%20Files/1_Indicator%20(Standard)/CSV_FILES/WPP2024_TotalPopulationBySex.csv.gz';
const IMF_GDP_URL = 'https://www.imf.org/external/datamapper/api/v1/NGDPD';
const UN_AMA_URL = 'https://unstats.un.org/unsd/amaapi/api/file/2';

const POPULATION_YEAR     = 2025;
const LATEST_GDP_YEAR     = 2025;
const EARLIEST_GDP_YEAR   = 2015;   // older values are not used
const IMF_GDP_MULTIPLIER  = 1e9;    // NGDPD is in billions of US$
const UN_WPP_MULTIPLIER   = 1e3;    // PopTotal is in thousands
const UN_AMA_GDP_INDICATOR = 'Gross Domestic Product (GDP)';

const SOURCE_UN_WPP = 'UN WPP 2024';
const SOURCE_IMF    = 'IMF WEO';
const SOURCE_UN_AMA = 'UN National Accounts';

// ISO2 codes whose IMF code is not the UN ISO3 code
const IMF_CODE_ALIASES = { XK: 'UVK', PS: 'WBG' };

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

const isRefresh = process.argv.includes('--refresh');

// Returns the file contents of a URL, cached in CACHE_DIR
async function download(url, filename) {
  const path = join(CACHE_DIR, filename);
  if (!isRefresh && existsSync(path)) return readFile(path);
  console.log(`download  ${url}`);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  await mkdir(CACHE_DIR, { recursive: true });
  await writeFile(path, buffer);
  return buffer;
}

// Splits a CSV line on commas outside double quotes and unquotes the fields
const parseCsvLine = line => line
  .split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/)
  .map(field => field.replace(/^"|"$/g, ''));

// JSON with non-ASCII characters escaped, so the file stays ASCII-only while
// names keep their diacritics
const toAsciiJson = value => JSON.stringify(value).replace(
  /[^\x00-\x7f]/g,
  char => '\\u' + char.charCodeAt(0).toString(16).padStart(4, '0'),
);

// Returns { year, value } of the newest non-empty entry of a year -> value map
// within [EARLIEST_GDP_YEAR, maxYear], or null
function getNewest(valuesByYear, maxYear) {
  for (let year = maxYear; year >= EARLIEST_GDP_YEAR; year--) {
    const value = valuesByYear?.[year];
    if (value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value))) {
      return { year, value: Number(value) };
    }
  }
  return null;
}

// ------------------------------------------------------------------

// UN WPP: ISO2 -> { iso3, locId, populationByYear }
async function loadUnPopulation() {
  const lines = gunzipSync(await download(UN_WPP_URL, 'WPP2024_TotalPopulationBySex.csv.gz'))
    .toString('utf8')
    .split(/\r?\n/);
  const header = parseCsvLine(lines[0].replace(/^\uFEFF/, ''));
  const column = name => header.indexOf(name);
  const [iso2Col, iso3Col, locIdCol, typeCol, variantCol, yearCol, popCol] =
    ['ISO2_code', 'ISO3_code', 'LocID', 'LocTypeName', 'Variant', 'Time', 'PopTotal'].map(column);

  const countries = new Map();
  for (const line of lines) {
    if (!line.includes(',Medium,')) continue;
    const fields = parseCsvLine(line);
    const year = Number(fields[yearCol]);
    if (fields[variantCol] !== 'Medium' || fields[typeCol] !== 'Country/Area' || !fields[iso2Col]) continue;
    if (year < EARLIEST_GDP_YEAR || year > POPULATION_YEAR) continue;
    if (!countries.has(fields[iso2Col])) {
      countries.set(fields[iso2Col], { iso3: fields[iso3Col], locId: Number(fields[locIdCol]), populationByYear: {} });
    }
    countries.get(fields[iso2Col]).populationByYear[year] = Number(fields[popCol]) * UN_WPP_MULTIPLIER;
  }
  return countries;
}

// IMF WEO: IMF code -> { year: GDP in US$ }
async function loadImfGdp() {
  const json = JSON.parse((await download(IMF_GDP_URL, 'imf-weo-ngdpd.json')).toString('utf8'));
  const gdpByCode = {};
  Object.entries(json.values.NGDPD).forEach(([code, valuesByYear]) => {
    gdpByCode[code] = Object.fromEntries(
      Object.entries(valuesByYear).map(([year, value]) => [year, value * IMF_GDP_MULTIPLIER])
    );
  });
  return gdpByCode;
}

// UN National Accounts: UN M49 LocID -> { year: GDP in US$ }
async function loadUnAmaGdp() {
  const workbook = XLSX.read(await download(UN_AMA_URL, 'un-ama-gdp-current-usd.xlsx'));
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1, blankrows: false });
  const headerIdx = rows.findIndex(row => row[0] === 'CountryID');
  const header = rows[headerIdx];
  const gdpByLocId = {};
  rows.slice(headerIdx + 1)
    .filter(row => row[2] === UN_AMA_GDP_INDICATOR)
    .forEach(row => {
      gdpByLocId[row[0]] = Object.fromEntries(
        header.map((year, idx) => [year, row[idx]]).filter(([year]) => typeof year === 'number')
      );
    });
  return gdpByLocId;
}

// ------------------------------------------------------------------

const [unPopulation, imfGdp, unAmaGdp] = await Promise.all([loadUnPopulation(), loadImfGdp(), loadUnAmaGdp()]);

const ids = JSON.parse(await readFile(join(ROOT, 'ne-country-areas.json'), 'utf8')).map(([id]) => id);
const displayNames = new Intl.DisplayNames(['en'], { type: 'region' });
const countries = {};
const sourceCounts = {};
const warnings = [];

for (const id of ids) {

  const entry = { name: NAME_OVERRIDES[id] ?? displayNames.of(id) };
  countries[id] = entry;

  const un = unPopulation.get(id);
  if (!un) continue;

  const population = un.populationByYear[POPULATION_YEAR];
  if (population) entry.population = { value: Math.round(population), year: POPULATION_YEAR, source: SOURCE_UN_WPP };

  // Newest GDP year across both sources; the IMF wins ties
  const imfValue = getNewest(imfGdp[IMF_CODE_ALIASES[id] ?? un.iso3], LATEST_GDP_YEAR);
  const unValue  = getNewest(unAmaGdp[un.locId], LATEST_GDP_YEAR);
  const gdp = imfValue && (!unValue || imfValue.year >= unValue.year)
    ? { ...imfValue, source: SOURCE_IMF }
    : unValue && { ...unValue, source: SOURCE_UN_AMA };
  if (!gdp) continue;

  entry.gdpUsd = { value: Math.round(gdp.value), year: gdp.year, source: gdp.source };
  sourceCounts[gdp.source] = (sourceCounts[gdp.source] ?? 0) + 1;

  const gdpYearPopulation = un.populationByYear[gdp.year];
  if (gdpYearPopulation) {
    entry.gdpPerCapitaUsd = {
      value : Math.round(gdp.value / gdpYearPopulation),
      year  : gdp.year,
      source: `${gdp.source}; ${SOURCE_UN_WPP}`,
    };
  }
  else {
    warnings.push(`${id}: no UN population for ${gdp.year}, so no GDP per capita`);
  }
}

// ------------------------------------------------------------------

const sources = {
  [SOURCE_UN_WPP]: 'UN DESA, World Population Prospects 2024, total population, medium variant (2025 values are projections)',
  [SOURCE_IMF]   : 'IMF World Economic Outlook via the DataMapper API, NGDPD, GDP in current US$ (recent years may be IMF estimates)',
  [SOURCE_UN_AMA]: 'UN Statistics Division, National Accounts Main Aggregates Database, GDP at current prices in US$',
  method         : 'GDP: newest year from IMF (to 2025) or UN National Accounts (to 2024), IMF on ties; GDP per capita = that GDP / UN WPP population of the same year',
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

const entries = Object.values(countries);
const withPopulation = entries.filter(entry => entry.population).length;
const withGdp = entries.filter(entry => entry.gdpUsd).length;
const bigWithoutGdp = Object.entries(countries)
  .filter(([, entry]) => entry.population?.value >= 1e6 && !entry.gdpUsd)
  .map(([id, entry]) => `${id} ${entry.name}`);
console.log(`population: ${withPopulation}/${ids.length} (UN WPP ${POPULATION_YEAR})`);
console.log(`GDP: ${withGdp}/${ids.length} (${Object.entries(sourceCounts).map(([source, count]) => `${source} ${count}`).join(', ')})`);
console.log(`1M+ people without GDP: ${bigWithoutGdp.join(', ') || 'none'}`);
warnings.forEach(warning => console.log(`warning: ${warning}`));
console.log(`Wrote ${OUT_FILE}`);
