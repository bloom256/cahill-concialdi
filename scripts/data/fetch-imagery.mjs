// ==================================================================
// IMAGERY SOURCES: NASA BLUE MARBLE NEXT GENERATION
// ------------------------------------------------------------------

// Downloads pinned high-resolution source images into data/raw/ (gitignored)
// and verifies their SHA-256, so imagery renders are reproducible. Files that
// already exist with the right checksum are skipped.
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
const BMNG_BASE_URL = 'https://eoimages.gsfc.nasa.gov/images/imagerecords/73000';

// Topography and bathymetry, 21600x10800 (60 px per degree)
const IMAGERY_SOURCES = [
  {
    file  : 'data/raw/bmng/world.topo.bathy.200406.3x21600x10800.jpg',
    url   : `${BMNG_BASE_URL}/73726/world.topo.bathy.200406.3x21600x10800.jpg`,
    sha256: 'd52c33cac35574937cbe3c07baf1e9b606a9d7010d7d7b02bee056b7969118a3',
  },
  {
    file  : 'data/raw/bmng/world.topo.bathy.200412.3x21600x10800.jpg',
    url   : `${BMNG_BASE_URL}/73909/world.topo.bathy.200412.3x21600x10800.jpg`,
    sha256: '3006c58b1272362db0a8c2df02dc07cea4b12dfe820b7dc4a159a075caf5d4d4',
  },
];

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
