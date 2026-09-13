// ==================================================================
// IMAGERY SOURCES: NASA BLUE MARBLE NEXT GENERATION
// ------------------------------------------------------------------

// Downloads the pinned high-resolution source images, all 12 months of 2004
// (topography and bathymetry, 21600x10800), into data/raw/bmng/ (gitignored)
// and verifies their SHA-256, so imagery renders are reproducible. Files that
// already exist with the right checksum are skipped. About 340 MB in total.
//
// Credit: "NASA Earth Observatory" (Blue Marble: Next Generation). NASA imagery
// is generally not subject to copyright in the United States; uses must not
// imply NASA endorsement.
//
// Usage: npm run fetch-imagery

import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream, existsSync } from 'node:fs';
import { mkdir, rename } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';

// ------------------------------------------------------------------

const ROOT          = resolve(fileURLToPath(import.meta.url), '../../..');
const BMNG_BASE_URL = 'https://assets.science.nasa.gov/content/dam/science/esd/eo/images/bmng/bmng-topography-bathymetry';

// Month folder on the NASA asset server and SHA-256 of that month's image
const MONTHS = [
  ['january'  , '5dbb5f101c3336f260506dcd574aaba4d5e9af2ff8533161367098affea86408'],
  ['february' , '4bc3184bcb23439349ead3ea0c008be36a23cdf4b8ee02a49dce8b5994c074bb'],
  ['march'    , '6ff7712100f27af328da7abf752df2d13acd6394666d30a64a34640f56cf0cea'],
  ['april'    , '7d3a8c58de56782a68156c67dd171074e210a7feec9283987622e569fa338f6a'],
  ['may'      , '7ea43b196400df9fd4b222dac6e144670a8329b865a3ddcec79987cb013cb353'],
  ['june'     , 'd52c33cac35574937cbe3c07baf1e9b606a9d7010d7d7b02bee056b7969118a3'],
  ['july'     , 'd225f1f35a6448a4d1d8f6de6e48f3433e470085b70a35800e64f384f269a7b0'],
  ['august'   , '05d984f723776f3d44fc473cc3d9eb67a48c425e82a56d7133e3761b2e231e86'],
  ['september', '863036b622ba3dab4eb4ffb7149730b02cfa433ce49672e9b7267022051e04a2'],
  ['october'  , 'af9bea6c86e684923d72842e629be0a9401d0d4f0cb76411199c8519519114ce'],
  ['november' , 'dbe2977b539562c4555b7df1fbc5b3313cdc4a0685fd8d5fe63dca2e1486ea21'],
  ['december' , '3006c58b1272362db0a8c2df02dc07cea4b12dfe820b7dc4a159a075caf5d4d4'],
];

const IMAGERY_SOURCES = MONTHS.map(([month, sha256], idx) => {
  const filename = `world.topo.bathy.2004${String(idx + 1).padStart(2, '0')}.3x21600x10800.jpg`;
  return {
    file: `data/raw/bmng/${filename}`,
    url : `${BMNG_BASE_URL}/${month}/${filename}`,
    sha256,
  };
});

// ------------------------------------------------------------------

async function hashFile(path) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest('hex');
}

// ------------------------------------------------------------------

for (const { file, url, sha256 } of IMAGERY_SOURCES) {

  const path = join(ROOT, file);
  if (existsSync(path) && await hashFile(path) === sha256) {
    console.log(`ok        ${file}`);
    continue;
  }

  await mkdir(dirname(path), { recursive: true });
  console.log(`download  ${url}`);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);

  const partialPath = path + '.part';
  await pipeline(Readable.fromWeb(response.body), createWriteStream(partialPath));
  const actualSha256 = await hashFile(partialPath);
  if (actualSha256 !== sha256) throw new Error(`Checksum mismatch for ${file}: ${actualSha256}`);
  await rename(partialPath, path);
  console.log(`ok        ${file}`);
}
