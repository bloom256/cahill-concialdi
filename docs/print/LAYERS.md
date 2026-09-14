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
- Horizontal, centered placements win near-ties (`rotationPenalty`). Multi-line blocks
  stay horizontal (`rotateFullBlock: false`); name-only labels may follow a country's
  long axis (Norway, Chile, the United Kingdom).
- If the full block does not fit at `minNameSize`, the label falls back to the name only
  (down to `minNameOnlySize`), else it is hidden. The render prints the counts and the
  hidden names.
- Text is dark or light depending on the fill's luminance.

**Implemented: `graticuleLabels`** (`print/layers/graticule-labels.mjs`, page space).
Text on the grid itself:
- Meridian labels (e.g. 30 degrees E) where each labeled meridian crosses the chosen latitudes.
- Parallel labels (e.g. 60 degrees N) at the chosen longitudes.
- Names of the equator, tropics and polar circles beside their lines.

Each label follows its line's local direction (never upside down) and has a soft halo.
Points on a tear of the map get a label on each side.

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
