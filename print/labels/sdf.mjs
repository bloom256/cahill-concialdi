// ==================================================================
// SIGNED DISTANCE FIELD FOR A POLYGON
// ------------------------------------------------------------------

// Turns a polygon (outer ring plus holes, in page millimeters) into a signed
// distance field: positive inside, negative outside, in millimeters. Sampling
// it is O(1), so a label solver can ask "how far inside its country is this
// corner?" millions of times without touching the polygon again.
//
// Build: scanline fill for the inside mask, then an exact Euclidean distance
// transform (Felzenszwalb and Huttenlocher, 2012) of the mask and of its
// complement, subtracted to give the signed value.

const FAR = 1e20;

// Cell size limits: fine enough that the smallest island still has an inside,
// coarse enough that one field never costs more than a few tens of megabytes
const MIN_CELL_MM = 0.02;
const MAX_CELLS   = 6e6;

// ------------------------------------------------------------------

// Exact squared distance transform of one row of costs (Felzenszwalb and
// Huttenlocher): `values` in, `out` filled with the lower envelope of the
// parabolas rooted at each sample. `parabolaAt` and `boundary` are scratch.
function transform1d(values, length, out, parabolaAt, boundary) {

  let numParabolas = 0;
  parabolaAt[0] = 0;
  boundary[0] = -FAR;
  boundary[1] = FAR;

  for (let q = 1; q < length; q++) {
    let cross;
    for (;;) {
      const p = parabolaAt[numParabolas];
      cross = ((values[q] + q * q) - (values[p] + p * p)) / (2 * q - 2 * p);
      if (cross > boundary[numParabolas]) break;
      numParabolas--;
    }
    numParabolas++;
    parabolaAt[numParabolas] = q;
    boundary[numParabolas] = cross;
    boundary[numParabolas + 1] = FAR;
  }

  for (let q = 0, k = 0; q < length; q++) {
    while (boundary[k + 1] < q) k++;
    const p = parabolaAt[k];
    out[q] = (q - p) * (q - p) + values[p];
  }
}

// Squared Euclidean distance (in cells) from every cell to the nearest cell
// where `isSeed` is true, over a cols x rows grid
function distanceSquared(isSeed, cols, rows) {

  const distances = new Float64Array(cols * rows);
  for (let i = 0; i < distances.length; i++) distances[i] = isSeed[i] ? 0 : FAR;

  const longest = Math.max(cols, rows);
  const column = new Float64Array(longest);
  const result = new Float64Array(longest);
  const parabolaAt = new Int32Array(longest);
  const boundary = new Float64Array(longest + 1);

  for (let x = 0; x < cols; x++) {
    for (let y = 0; y < rows; y++) column[y] = distances[y * cols + x];
    transform1d(column, rows, result, parabolaAt, boundary);
    for (let y = 0; y < rows; y++) distances[y * cols + x] = result[y];
  }

  for (let y = 0; y < rows; y++) {
    const rowStart = y * cols;
    for (let x = 0; x < cols; x++) column[x] = distances[rowStart + x];
    transform1d(column, cols, result, parabolaAt, boundary);
    for (let x = 0; x < cols; x++) distances[rowStart + x] = result[x];
  }

  return distances;
}

// ------------------------------------------------------------------

// Fills the inside mask by scanline, using the even-odd rule over every ring
// (so holes punch themselves out). Cell centers decide.
function rasterize(rings, minX, minY, cellMm, cols, rows) {

  const mask = new Uint8Array(cols * rows);
  const crossings = [];

  for (let row = 0; row < rows; row++) {
    const y = minY + (row + 0.5) * cellMm;
    crossings.length = 0;

    for (const ring of rings) {
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [x1, y1] = ring[i];
        const [x2, y2] = ring[j];
        if ((y1 > y) === (y2 > y)) continue;
        crossings.push(x1 + (y - y1) * (x2 - x1) / (y2 - y1));
      }
    }
    if (!crossings.length) continue;

    crossings.sort((a, b) => a - b);
    const rowStart = row * cols;
    for (let pair = 0; pair + 1 < crossings.length; pair += 2) {
      const from = Math.max(0, Math.ceil((crossings[pair] - minX) / cellMm - 0.5));
      const to = Math.min(cols - 1, Math.floor((crossings[pair + 1] - minX) / cellMm - 0.5));
      for (let col = from; col <= to; col++) mask[rowStart + col] = 1;
    }
  }

  return mask;
}

// ------------------------------------------------------------------

// Builds the field for one polygon. `rings` is [outer, ...holes], each an
// array of [x, y] in page mm. `cellMm` is the sampling step and `padMm` how
// far outside the polygon the field still carries useful (negative) values.
export function buildSdf(rings, { cellMm = 0.4, padMm = 30 } = {}) {

  const xs = rings[0].map(point => point[0]);
  const ys = rings[0].map(point => point[1]);
  const width = Math.max(...xs) - Math.min(...xs);
  const height = Math.max(...ys) - Math.min(...ys);

  // A polygon smaller than one cell would rasterize to nothing, so the cell
  // shrinks for small shapes; it grows again if that would blow up the grid
  let cell = Math.min(cellMm, Math.max(MIN_CELL_MM, Math.min(width, height) / 4));
  let cols = 0;
  let rows = 0;
  for (;;) {
    cols = Math.ceil((width + 2 * padMm) / cell);
    rows = Math.ceil((height + 2 * padMm) / cell);
    if (cols * rows <= MAX_CELLS) break;
    cell *= 1.5;
  }

  const minX = Math.min(...xs) - padMm;
  const minY = Math.min(...ys) - padMm;
  const cellMmUsed = cell;

  const inside = rasterize(rings, minX, minY, cellMmUsed, cols, rows);
  const outside = new Uint8Array(inside.length);
  for (let i = 0; i < inside.length; i++) outside[i] = inside[i] ? 0 : 1;

  // Distance to the nearest cell of the other kind, in cells, then signed mm.
  // Clamped to the grid diagonal so an all-outside grid (a shape that still
  // rasterized to nothing) reports "far away", never the infinite sentinel.
  const toOutside = distanceSquared(outside, cols, rows);
  const toInside = distanceSquared(inside, cols, rows);
  const limit = Math.hypot(cols, rows) * cellMmUsed;
  const field = new Float32Array(inside.length);
  for (let i = 0; i < field.length; i++) {
    const distance = inside[i]
      ? Math.sqrt(toOutside[i]) * cellMmUsed
      : -Math.sqrt(toInside[i]) * cellMmUsed;
    field[i] = Math.max(-limit, Math.min(limit, distance));
  }

  return { minX, minY, cellMm: cellMmUsed, cols, rows, field };
}

// Bilinear sample of the field at a page point, in millimeters: positive
// inside, negative outside. Points beyond the padded box read as far outside.
export function sampleSdf(sdf, x, y) {

  const { minX, minY, cellMm, cols, rows, field } = sdf;

  // Grid coordinates, clamped into the field. Beyond the padded box the field
  // holds no data, so the reading is the nearest edge value minus the distance
  // out to the point: "outside, and this much further out" - a slope to follow
  // rather than a cliff that swamps every other term. Inside, `awayMm` is 0.
  const rawX = (x - minX) / cellMm - 0.5;
  const rawY = (y - minY) / cellMm - 0.5;
  const gridX = Math.min(Math.max(rawX, 0), cols - 1);
  const gridY = Math.min(Math.max(rawY, 0), rows - 1);
  const awayMm = Math.hypot(rawX - gridX, rawY - gridY) * cellMm;

  const col = Math.floor(gridX);
  const row = Math.floor(gridY);
  const fx = gridX - col;
  const fy = gridY - row;
  const col2 = Math.min(cols - 1, col + 1);
  const row2 = Math.min(rows - 1, row + 1);

  const top = field[row * cols + col] * (1 - fx) + field[row * cols + col2] * fx;
  const bottom = field[row2 * cols + col] * (1 - fx) + field[row2 * cols + col2] * fx;
  return top * (1 - fy) + bottom * fy - awayMm;
}
