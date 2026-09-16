# Layers

## Stack (bottom to top)

Every layer is optional and toggled by the style (`<layer>.show`).

| # | Layer id | Space | Data | Notes |
|---|---|---|---|---|
| 1 | `paper` | page | -- | Page background color, optional grain texture |
| 2 | `ocean` | map | outline | Bat-shaped map background (from `drawBackground()`) |
| 3 | `bathymetry` | map | bathymetry | Depth bands; must be cut at all southern tears |
| 4 | `imagery` | page | raster | Implemented: equirectangular image reprojected with the shared cell inverse, bilinear sampling, embedded as JPEG clipped to the outline (`imagery: { source, dpi }`) |
| 5 | `graticule` | map | generated | 10 or 15 deg; option to draw only over ocean |
| 6 | `circles` | map | generated | Equator, tropics, polar circles |
| 7 | `fold-lines` | map | generated | Octahedron face edges as subtle "fold" marks |
| 8 | `land` | map | admin-0 polys | Country fills (`MAPCOLOR7` etc.) or a single land tone |
| 9 | `relief` | map | raster | Hillshade clipped to land, multiply-style (baked into raster) |
| 10 | `ice` | map | glaciers, ice shelves | Optional |
| 11 | `lakes` | map | lakes | Filled with water color, thin shore stroke |
| 12 | `rivers` | map | rivers | Width tapered by scale rank; rounded caps/joins |
| 13 | `admin1` | map | admin-1 lines | Thinnest border class; filter by country/rank |
| 14 | `admin0` | map | boundary lines | Includes dashed disputed borders |
| 15 | `coast` | map | coastline | Optional separate stroke, or waterlines/ripples |
| 16 | `thematic` | map | varies | Time zones, day/night, personal overlays |
| 17 | `cities` | map | populated places | Dots/symbols by rank; capitals distinct |
| 18 | `outline` | map | outline | Map edge stroke (neatline of the bat shape) |
| 19 | `labels` | page | many | See below |
| 20 | `frame` | page | -- | Border, title, cartouche, legend, credits, insets |

Keeping labels and frame in page space means text is never tilted by accident and
can be placed across the gaps between map lobes.

## Labels

**Implemented: `countryStats`** (`print/layers/country-stats.mjs`, page space). Each
country gets its name plus population, GDP and GDP per capita, placed entirely inside
one of its polygons:
- Candidate centers are the pole of inaccessibility plus an interior grid, tried at
  several angles. A binary search finds the largest text block that fits without
  crossing any edge.
- **Rotation is decided by shape** (`maxAngleDeg`, `rotateMinElongation`). Each polygon's
  principal axis and elongation (long/short spread ratio) come from PCA of its outline.
  A compact country (elongation below the threshold, `geo-stats-nov`: 2.2) is only ever
  tried horizontal, which reads best. A long, thin one is also searched densely within
  30 degrees of its own axis in 2.5 degree steps, then refined; coarse samples missed
  fits that exist (Portugal fits at -68 degrees and at no angle 15 degrees either side).
  Horizontal, centered placements still win near-ties (`rotationPenalty`).
- **Single line along the axis** (`singleLineAlongAxis`): when a country's block ends up
  tilted at least 20 degrees, it is set as one line instead, `PRT/10M/$346B/$33K`, lying
  along the country. Blocks that stay upright keep their lines even where one line would
  fit bigger (Sweden, Morocco), since there it becomes a huge diagonal ribbon.
- If the full block does not fit at `minNameSize`, the label falls back to the name only
  (down to `minNameOnlySize`), else it is hidden. The render prints the counts and the
  hidden names.
- `minStatsPopulation` (optional): countries below it, or without population data, get only
  their name, set in the regular stats weight instead of bold (`geo-stats-nov`: 1 million).
- `statsLayout`: `stacked` (default) gives each number its own labeled line
  ("Pop 38.2M"); `inline` puts all three on one line ("38.2M / $2.17T / $56.8K");
  `two-line` sets "FRA/67M" over "$3T/$51K", two lines of similar width, so the block is
  about as rectangular as this data gets (`geo-stats-nov`). Also available: `single-line`,
  `three-line`, `gdp-middle`, `stacked-plain`. With `nameSource: 'iso3'`, `statsDecimals: 0`
  and `statsSeparator: '/'` the block reads `DEU/84M` over `$5T/$60K`.
- **Joint position solver** (`solver: 'anneal'`, `print/labels/solver.mjs`): after the
  placement above, every label's position is optimized at once by simulated annealing.
  The energy rewards staying inside the country (read from its signed distance field,
  `print/labels/sdf.mjs`) and staying near its interior point, with overlap a hard
  constraint; neighbouring labels can swap places. A large country holds its label near the
  middle, a small one may roam. `geo-stats-nov` optimizes positions only
  (`solverOptions: { optimizeTheta: false, optimizeSize: false }`): angles come from PCA and
  sizes from the fit. Seeded, so the map is reproducible; about 2 s per render.
  `scripts/bench-labels.mjs` and `scripts/test-sdf.mjs` measure and check it.
- Text is dark or light depending on the fill's luminance, or a fixed color with a halo
  (`textColor: 'fixed'`, used over imagery).
- **Small countries** (`callouts.show`): every country without an inside label gets its full
  block, at `callouts.nameSize`, after all inside labels are placed (most populous first).
  Every small country's dot area is reserved first, so no label covers another small country.
  1. **On top** (`overlayOffsetsMm`, `overlaySizes`): the block is centered on the country, or
     up to a few mm off, without a leader line, if that spot overlaps no other label. The sizes
     in `overlaySizes` are tried largest first (`geo-stats-nov`: 7, 6.5, 6 pt), because a label
     one step smaller on its own country reads better than a full-size one on a line.
  2. **Callout**: otherwise the block takes the nearest free spot in rings of growing distance
     (2 to 75 mm) and 12 directions, with a dot and a leader line.

  3. **Skipped** (`callouts.minLeaderPopulation`): a country below that population that
     would need a leader line is left unlabeled instead, so a few specks do not add lines
     across the map. Every skipped name is printed in the render notes.

  In `geo-stats-nov` (7 pt minimum on the 190 cm print, stats on one line, nothing under
  300 000 people on a leader line) the render prints where each label landed and which
  countries were skipped.

**Implemented: `places`** (`print/layers/places.mjs`, page space). Names for spots no
country label reaches, from the hand-kept list `data/places.json` (`{ name, lat, lon }`,
optional `size`): island groups far from their country's main body, such as Hawaii, whose
country label sits on the US mainland, or Kiribati's Line Islands. Each label sits on its
point, or a few millimeters off (`offsetsMm`) when another label is already there. Set in
the light weight so it reads as secondary to country names.

**Implemented: `graticuleLabels`** (`print/layers/graticule-labels.mjs`, page space).
Text on the grid itself:
- Meridian labels (e.g. 30 degrees E) where each labeled meridian crosses the chosen latitudes.
- Parallel labels (e.g. 60 degrees N) at the chosen longitudes.
- Names of the equator, tropics and polar circles beside their lines.

Each label follows its line's local direction (never upside down) and has a soft halo.
Points on a tear of the map get a label on each side.

**Label overlap:** label layers record their placed boxes in `ctx.labelBoxes`, and layers
render in stack order. Country labels are placed first. A grid label that would overlap
one slides along its own line in 2-degree steps (up to 12 degrees), and is skipped if no
free spot exists. The render prints how many labels moved or were skipped.

**Classes and priority** (higher first in collision resolution):

1. Oceans and major seas -- large, italic or small caps, letterspaced, optionally curved
2. Countries -- size by `LABELRANK`/projected area; long names wrap or abbreviate
3. Capitals and major cities -- dot + label, by `SCALERANK`
4. Admin-1 names -- only for selected large countries
5. Rivers -- italic, along the path, only major rivers
6. Physical regions (optional) -- deserts, mountain ranges, letterspaced

**Orientation** (style token `labels.orientation`):
- `page` -- horizontal on paper (compensates the -5.4 deg tilt). Most legible.
- `local` -- follows the local parallel direction on each face. Elegant, and it shows
  the projection's geometry, but it rotates strongly near face edges.

**Placement:**
1. Start from NE label points (`LABEL_X/LABEL_Y`, admin-1 `latitude/longitude`) or the
   pole of inaccessibility computed in projected space.
2. Fit size to the feature (shrink or move outside with a leader for small countries).
3. Greedy collision pass by priority, using real glyph metrics from opentype.js.
4. Apply `print/labels/overrides.json`, keyed by feature id:

```json
{
  "country:CL": { "dx": -4, "dy": 10, "rotate": 80, "size": 12 },
  "city:Singapore": { "anchor": "end" },
  "sea:Coral Sea": { "curve": true },
  "admin1:US-RI": { "hide": true }
}
```

(`dx`/`dy` in mm, `size` in pt.)

**Legibility:** halos via `paint-order: stroke` in the background color; never set text
across a tear; check minimum sizes in `PRINT-SPECS.md`.

## Frame and cartouche

The bat shape leaves empty areas inside the page rectangle: the upper-left and
upper-right corners, the bottom center between the southern lobes, and the lower
corners. Use them deliberately rather than shrinking the map.

Candidate content:
- Title and subtitle (e.g. "The World", projection name, a personal line)
- Projection explainer: small octahedron net diagram showing how the faces unfold
- Legend (only for classes actually shown: borders, disputed, capitals, depth bands)
- Note "Scale varies; about 1:20,000,000 at the equator" instead of a scale bar
- Credits block (see `DATA.md`), edition and date
- Optional insets -- orthographic globe views or polar azimuthal views only.
  **No Mercator, Robinson or Equal Earth insets.**

Border options per style: plain neatline, double rule, thin rule plus corner ornaments.
Graduated lat/lon edge ticks do not work here (the map edge is not a meridian or parallel).

## Adding a new layer

1. Add a data build script (if needed) in `scripts/data/`, output to `data/build/<name>.json`.
2. Create `print/layers/<id>.mjs` following the layer contract in `ARCHITECTURE.md`.
3. Register it in the stack in `print/render.mjs` at the right position, and add a row here.
4. Add default tokens (with `show: false`) to `print/styles/base.mjs`.
5. Enable it in the variants that should use it and re-run `npm run variants`.
6. Add preflight expectations (min widths/sizes) if the layer draws lines or text.

## Future layer ideas

- Personal places: where you have lived/visited, as refined pins or small dots
- Travel arcs: great-circle routes (must be cut at tears)
- Day/night terminator at a meaningful moment (birthday, move-in date, solstice)
- Time zones (reuse the `tz` branch coloring)
- Tissot indicatrices: small circles showing how little shapes distort -- a quiet
  argument for this projection over Mercator/Robinson/Equal Earth
- Octahedron fold lines (layer 7) with subtle face shading, "papercraft" look
- Bathymetry, ice shelves, reefs
- City lights glow (from Black Marble)
- Historical borders or eras (`eras-choropleth` branch idea)
- Lake "specimen" inset (`namerica-lakes` branch idea)
