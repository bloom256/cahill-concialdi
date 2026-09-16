# Data

## Current data (web app)

| File | Content | Print suitability |
|---|---|---|
| `ne-country-areas.json` | `[isoA2, MultiPolygon]` x 241, 0.01 deg, ~100k vertices, NE 50m-level detail | Coarse at 150 cm (Iceland has 452 vertices) |
| `ne-boundaries.json` | `[isUndisputed, LineString]` x 362, ~20k vertices (22 dashed) | Coarse |
| `ne-i.jpg`, `ne-hypso.jpg`, `nasa-*.jpg` | 3600x1800 equirectangular, 10 px/deg | Unusable for print (~48 dpi) |
| `data/places.json` | Hand-kept label points `{ name, lat, lon }` for the `places` layer (print only) | Add a line to name any spot the country labels miss |

Keep these for the web app. Print builds go to `data/build/`.

**Local edits to this data** (upstream itself hand-fixed these files in `b9de364`):

| Date | Edit | Reason |
|---|---|---|
| 2026-09-16 | Crimea: the 72-point peninsula polygon moved from `RU` to `UA`, and the dashed boundary line at the Perekop isthmus removed | Draw Russia and Ukraine with their 1991 borders. Natural Earth's default shows the de facto situation (Crimea in Russia); the recognized border also matches the UN population and IMF GDP figures, which count Crimea in Ukraine |

## Target sources

Natural Earth 10m unless noted. Download pages:
<https://www.naturalearthdata.com/downloads/10m-cultural-vectors/>,
<https://www.naturalearthdata.com/downloads/10m-physical-vectors/>,
<https://www.naturalearthdata.com/downloads/10m-raster-data/>.
Direct zips are usually at `https://naciscdn.org/naturalearth/10m/{cultural,physical,raster}/<name>.zip`;
GeoJSON mirrors are in `github.com/nvkelso/natural-earth-vector` (`geojson/`).
**Verify exact names and URLs when implementing `fetch.mjs`.**

| Layer | Dataset | Useful fields |
|---|---|---|
| Countries (fill) | `ne_10m_admin_0_countries` | `ISO_A2`, `ADM0_A3`, `NAME`, `NAME_LONG`, `MAPCOLOR7/8/9/13`, `LABELRANK`, `LABEL_X`, `LABEL_Y`, `MIN_LABEL`, `MAX_LABEL` |
| Country borders | `ne_10m_admin_0_boundary_lines_land`, `ne_10m_admin_0_boundary_lines_disputed_areas` | `FEATURECLA`, `SCALERANK` |
| Coastline | `ne_10m_coastline` | `SCALERANK` |
| Admin-1 | `ne_10m_admin_1_states_provinces` (polygons), `ne_10m_admin_1_states_provinces_lines` | `adm0_a3`, `name`, `labelrank`, `scalerank`, `latitude/longitude` label point |
| Lakes | `ne_10m_lakes` (+ `ne_10m_lakes_europe`, `ne_10m_lakes_north_america`) | `scalerank`, `name` |
| Rivers | `ne_10m_rivers_lake_centerlines_scale_rank` (+ Europe / North America supplements) | `scalerank`, `name`, `strokeweig` |
| Cities | `ne_10m_populated_places` (or `_simple`) | `SCALERANK`, `FEATURECLA` (capitals), `POP_MAX`, `NAME` |
| Ocean/sea names | `ne_10m_geography_marine_polys` | `scalerank`, `name`, `featurecla` |
| Regions/mountains | `ne_10m_geography_regions_polys`, `_points`, `_elevation_points` | `scalerank`, `name` |
| Bathymetry (optional) | `ne_10m_bathymetry_all` (depth bands 0..10000 m) | `depth` |
| Ice (optional) | `ne_10m_glaciated_areas`, `ne_10m_antarctic_ice_shelves_polys` | |
| Reefs, minor islands (optional) | `ne_10m_reefs`, `ne_10m_minor_islands` | |
| Time zones (optional) | `ne_10m_time_zones` (the `tz` branch used a timezone-boundary-builder export) | `zone`, `utc_format` |
| Raster: hypsometric | NE "Cross Blended Hypso with Shaded Relief, Water, Drainages and Ocean Bottom" (21600x10800) | |
| Raster: NE I / NE II | NE1 / NE2 high-res with shaded relief and water (21600x10800) | |
| Raster: shaded relief | NE shaded relief / gray earth (21600x10800) | |
| Raster: Blue Marble NG | NASA Visible Earth, topography + bathymetry, 21600x10800 or 500 m tiles (86400x43200) | |
| Raster: Black Marble | NASA Earth at Night (2016), 3 km global or 500 m tiles | |

Why 10m: at 150 cm wide the map is roughly 1:20M, so NE 10m (nominally 1:10M) has
about twice the detail needed -- enough headroom to simplify cleanly. 50m is visibly
angular at arm's length.

Why 60 px/deg rasters: the equator scale is ~5.3 mm/deg, so 200 dpi needs ~42 px/deg
and 300 dpi needs ~63 px/deg (see `PRINT-SPECS.md`). Antarctica and face vertices are
enlarged, so they will look softer than the rest regardless.

## Preprocessing (per layer)

Tool: `mapshaper` (npm, runs in Node) for filtering, topology-aware simplification,
cleaning and rounding; custom Node code for tear cutting and densifying.

1. **Filter fields** to what the renderer needs (ids, names, ranks, colors).
2. **Filter features** by rank where appropriate (e.g. rivers `scalerank <= 8`,
   cities by `SCALERANK` and capitals).
3. **Simplify** with topology preserved (shared borders stay shared, no slivers):
   Visvalingam weighted, `keep-shapes` so small islands survive. Target vertex spacing
   ~0.2-0.3 mm at print scale (~4-6 km).
4. **Clean and round:** `-clean`, then 0.01 deg precision (~1.1 km, ~0.05 mm at print);
   use 0.001 deg for tiny islands/lakes if rounding collapses them.
5. **Cut at tears and densify** (`ARCHITECTURE.md`, geometry pipeline). Re-apply the
   manual splits of the current data: Antarctica at 150W, Umnak Island at 168.5W.
6. **Write** compact JSON (same minimal style as the current files) to `data/build/`,
   and log feature/vertex counts and byte size per layer.

Special cases to carry over from the current data: ISO code fixes for features with
`-99` codes (e.g. France, Norway, Kosovo, Northern Cyprus, Somaliland) and removal of
the Ashmore and Cartier Islands polygons (see commit `b9de364`).

## Size budget

| Target | Budget |
|---|---|
| Master SVG (all layers, fonts embedded) | < 30 MB, < ~1.5M path vertices |
| Admin-1 lines | the largest layer; simplify hardest, filter by country if needed |
| Web page build | < 5 MB gzipped (50m base, fewer admin-1 lines, no fonts inline) |

## Storage policy (decided 2026-09-13)

Git stores everything needed to **reproduce** a render, plus the **decisions**.
It never stores the renders themselves: a take is fully defined by its commit and
variant name.

**In git:**

| What | Where |
|---|---|
| Render code, style variants, label overrides | `print/` |
| Data build scripts | `scripts/data/` |
| Data pins: Natural Earth version, source URLs, SHA-256 of each download | `scripts/data/sources.json` |
| Fonts (OFL) | `print/fonts/` |
| `package-lock.json` (pins renderer dependency versions) | repo root |
| Round manifests: variants, commits, changes, ratings, notes, decision | `docs/print/rounds/<round>.json` |
| Optional milestone thumbnails (~1200 px JPG, curated, never every take) | `docs/print/rounds/<round>/` |
| Build outputs under ~10 MB | `data/build/` |

**Not in git:**

| What | Where | How to recover |
|---|---|---|
| Raw downloads, high-res rasters | `data/raw/` | `npm run data` (verified against checksums) |
| Build outputs over ~10 MB | `data/build/` | `npm run data` |
| All renders: SVG, PNG, crops, tiles, PDFs | `out/` | Re-render from commit + variant; optionally back up `out/` to a synced folder (OneDrive/Google Drive) |
| Final print files | GitHub Release on tag `print-vN` (assets up to 2 GB each, outside git history) | Download from the release |

**Why:** one round of renders is 200-400 MB. Binaries in history grow the repo
forever, can only be removed by rewriting history, and hit GitHub limits
(a warning at 50 MB per file, a block at 100 MB, and a small free LFS quota). No Git LFS for now.

**Reproducibility rules:**
- A checksum mismatch on a download fails the build; data never changes silently.
- Renders never depend on system fonts; only fonts from `print/fonts/` are used.
- Bumping a data pin or a dependency goes in its own commit, so the takes before and after it are clearly separated.

## Country stats snapshot

`data/build/country-stats.json` (committed) holds, per country id in `ne-country-areas.json`:
display name, population, GDP and GDP per capita (current US$), each with year and source.
Regenerate with `node scripts/data/fetch-country-stats.mjs`; commit the refresh on its own.

- **Population:** UN World Population Prospects 2024 (UN DESA), total population, medium
  variant, 2025 (a projection from the 2023 base).
- **GDP (current US$):** the newest year in the UN National Accounts Main Aggregates
  Database (UNSD, UNdata), 2024 for every country. Tanzania is reported in two parts
  (Mainland and Zanzibar) and summed. The UN publishes nothing for Taiwan, so its 2024 GDP
  comes from DGBAS, Taiwan's statistics office ("Principal Figures" table, nominal GDP in
  million US$), under the Open Government Data License, version 1.0, which allows commercial
  use with attribution. The credit is on the info panel.
- **No IMF data** (decided 2026-09-16): the IMF requires permission for commercial reuse
  of its data, and the map is meant to be sold. UNdata "may be copied freely, duplicated and
  further distributed provided that UNdata is cited".
- **Licenses for selling the print:** NASA imagery is public domain (credit NASA Earth
  Observatory, imply no endorsement, no NASA logos); Natural Earth is public domain; UN WPP
  is CC BY 3.0 IGO (credit and license name); UNdata needs a citation; Barlow is SIL OFL
  (prints and embedded files may be sold, not the font itself); the projection code is MIT,
  which covers copies of the code, not maps made with it. The info panel carries the credits.
- **GDP per capita:** that GDP divided by the UN population of the same year, so both numbers
  use one population source.
- **No World Bank data** is used (owner's preference, 2026-09-15).
- Downloads are cached in `data/raw/stats/`; `--refresh` fetches them again.
- **No data:** Antarctica, Northern Cyprus, Somaliland, Siachen Glacier and small territories
  the UN does not list separately (e.g. Aland, Christmas Island, Pitcairn). These get a
  name-only label.
- **Names:** English CLDR region names (`Intl.DisplayNames`) with map-friendly overrides
  (DR Congo, Congo, Myanmar, Palestine, Hong Kong, Macao) and names for Natural Earth's
  non-ISO ids. Non-ASCII characters are stored as `\u` escapes, so the file stays ASCII
  while labels keep their diacritics.

## Imagery sources

`npm run fetch-imagery` downloads the pinned NASA Blue Marble: Next Generation images
(topography and bathymetry, 21600x10800, 60 px per degree) into `data/raw/bmng/` and
verifies their SHA-256 (see `scripts/data/fetch-imagery.mjs`):

- **All 12 months of 2004** are pinned: `world.topo.bathy.2004MM.3x21600x10800.jpg`,
  27-30 MB each (about 340 MB in total), from the NASA Science asset server
  (`.../bmng/bmng-topography-bathymetry/<month>/`). These are the same files as the
  Visible Earth image records (e.g. 73580 January, 73726 June, 73909 December).
- `npm run month-sheet` renders all 12 months side by side in the `geo-blue-marble`
  look (`out/sheets/blue-marble-months.png`), to choose a season.
- The repo's `nasa-blue-marble-ng.jpg` (3600x1800) is a winter month, closest to December.
  It remains the web app's source.
- **Resolution check** (150 cm print, upright view, 60 px per degree source):
  median about 370 dpi, 340-390 dpi over Europe and the USA. It drops to about
  110-130 dpi only at the four equator face corners (open ocean) and in parts of
  Antarctica, where the projection stretches most. 500 m tiles also exist for every
  month (8 tiles of 21600x21600, `...3x21600x21600.A1.jpg` to `D2`, about 53-58 MB
  each), but they would only improve those few spots, or much larger prints and a
  deep-zoom web page.
- **License:** NASA states its images "generally are not subject to copyright in the
  United States" and asks that NASA be acknowledged, without implying endorsement.
  The Blue Marble page asks users to credit **"NASA Earth Observatory"**.

## Licenses and credits (for the cartouche)

- **Projection:** Cahill-Concialdi Bat, Luca Concialdi (2015), a rearrangement of
  B.J.S. Cahill's conformal butterfly (1909); conformal octant math after L.P. Lee (1976).
- **Code:** Eugene Alvin Villar (MIT, see `LICENSE.md`); octant projection ported from
  Justin Kunimune's Map-Projections (see that repository's license).
- **Data:** Natural Earth (public domain; credit appreciated). NASA Visible Earth /
  Earth Observatory imagery (public domain; credit NASA).
- **Fonts:** list each font and its SIL Open Font License.
