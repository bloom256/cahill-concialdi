# Roadmap

Phases are ordered by dependency. Phases 3 (styles) and 4-5 (cartography) can
iterate in parallel once the renderer and data exist. Check items off as they land.

**There is no deadline.** Phases 3-5 plus the proofing steps of phase 7 form a
refinement loop that repeats as often as needed, until the owner looks at a proof
and feels "that's it". Record every round in the iteration log at the bottom.

## Phase 0 -- Tooling foundation

- [x] `package.json` (`"type": "module"`), `complex.js` from npm instead of unpkg for Node
- [x] `npm run serve`: Node static server with correct MIME types (Python's server breaks `.mjs` on Windows)
- [ ] Dependencies, each added when first used: done `@resvg/resvg-js`, `puppeteer-core` (uses local Chrome); later `mapshaper`, `sharp`, `opentype.js`
- [ ] npm scripts: done `serve`, `render`, `parity`, `capture-web`; later `data`, `round`, `gallery`, `pdf`, `png`, `preflight`
- [x] `.gitignore`: `out/`, `data/raw/`; track `package-lock.json`
- [x] Storage policy: renders never in git, no LFS for now (`DATA.md`)

Done when: `npm install && npm run serve` works and the old app still renders.

## Phase 1 -- Headless SVG renderer (parity)

- [x] `print/render.mjs`: DOM-free `renderMap(style) -> string`
- [x] Vector geometry extracted into the shared `map-geometry.mjs`; `print/layers/` for paper, ocean, graticule, circles, land, admin0
- [x] Physical page wrapper: SVG sized in mm, with the map group scaled, positioned and tilted
- [x] `seav-original` style that reproduces the owner's favorite web look exactly (see `STYLES.md`)
- [x] `npm run parity`: all 608 paths identical to the web app (path data, computed style, transform), pixel mismatch 0.17% (edge smoothing only)

Done when: `npm run render -- seav-original` writes `out/latest/seav-original/map.svg` that matches the web app. **Done 2026-09-13.**

## Phase 2 -- Print-grade data (Natural Earth 10m)

- [ ] `scripts/data/sources.json`: Natural Earth version, URLs, SHA-256 pins
- [ ] `scripts/data/fetch.mjs`: download, verify checksums, unzip into `data/raw/`
- [ ] Geometry cutter: split at true tears, insert seam-crossing vertices, densify (`ARCHITECTURE.md`)
- [ ] Re-apply the 150W Antarctica split and 168.5W Umnak split on 10m data
- [ ] Build: admin-0 polygons (+ `MAPCOLOR7/9/13`, label points), boundary lines incl. disputed, coastline
- [ ] Build: admin-1 polygons + lines (with rank fields for filtering)
- [ ] Build: lakes, rivers (scale rank), populated places, marine label polygons
- [ ] Optional builds: bathymetry bands, glaciers/ice shelves, reefs, minor islands, time zones
- [ ] Simplify/round per layer to the print scale; report file sizes and vertex counts

Done when: all layers render at print scale with no stray cross-map lines, gaps, or missing islands.

## Phase 3 -- Style system and variant gallery

- [ ] `print/styles/base.mjs` tokens in mm/pt; deep-merge variant overrides
- [ ] `seav-print` baseline, then the `seav-*` improvement variants one at a time (`STYLES.md`)
- [ ] 4-6 contrasting variants to stress-test the favorite
- [ ] Variant composition: done `extends` presets; later seeded randomness, `archived` flag
- [x] `npm run round -- <variants or prefix*>`: map.svg, overview, thumbnail and crops per variant into `out/rounds/<round>/`, manifest in `docs/print/rounds/`
- [ ] Gallery: done a static `index.html` per round (grid; side by side, swipe or blink over the overview or any crop); later synced pan/zoom, pixel diff, ratings and notes saved to the manifest
- [ ] Font embedding (OFL fonts in `print/fonts/`)

Done when: the owner can open one page, compare all variants of a round in overview and detail, and record ratings and notes.

## Phase 4 -- Labels and cartography

- [ ] Label classes: oceans/seas, countries, admin-1 (filtered), cities, rivers, optional physical regions
- [ ] Placement: NE label points or pole of inaccessibility in projected space, size by rank/area
- [ ] Greedy collision pass by priority; halos
- [ ] `print/labels/overrides.json` for manual nudges/hides/curves
- [ ] Rivers tapered by scale rank; lakes knocked out of land

Done when: 100%-scale crops of dense regions (Europe, Caribbean, SE Asia) read cleanly.

## Phase 5 -- Frame and cartouche

- [ ] Layout grid for the empty areas around the bat shape
- [ ] Title/subtitle, legend, projection note with octahedron fold diagram, credits, edition/date
- [ ] Neatline/border styles per variant
- [ ] Optional insets (orthographic/polar views only -- no Mercator/Robinson/Equal Earth)

Done when: the whole page composes as one designed object, not a map with text pasted on.

## Phase 6 -- Raster layers (only if a chosen style needs them)

- [ ] Offline Node raster renderer (port `MapCell` inverse math, strips, bilinear sampling)
- [ ] 60 px/deg sources (NE hypsometric/shaded relief, NASA Blue/Black Marble)
- [ ] Clip to map outline or land; blend modes baked in the raster (not live SVG filters)
- [ ] Output at 200-300 dpi and embed into the SVG/PDF

Done when: raster crops at 100% look sharp with no seams at area edges or the antimeridian.

## Phase 7 -- Export, preflight, proofing

- [ ] `npm run pdf`: headless Chrome PDF at exact page size, backgrounds on, fonts embedded
- [ ] Shop-safe SVG variant with text converted to outlines
- [ ] Flattened TIFF/PNG fallback at 200-300 dpi
- [ ] `npm run preflight`: min stroke width, min font size, node count, file size, fonts, bounds
- [ ] Home proof: A4 crops at 100% scale taped to the wall, viewed from 1-3 m
- [ ] Shop proof strip of the finalist (e.g. 30 x 90 cm slice)

Done when: preflight passes and a physical proof has been approved.

## Phase 8 -- Static HTML page (optional)

- [ ] `web/` page: zoomable SVG, style switcher, credits
- [ ] Lighter data build for the browser if the print SVG is too heavy
- [ ] Publish via GitHub Pages on the fork

## Phase 9 -- Final print and archive

- [ ] Freeze the chosen style; tag the commit (e.g. `print-v1`)
- [ ] Attach PDF, SVG and flattened TIFF to a GitHub Release on the tag
- [ ] Order the print; note shop, paper and settings in `PRINT-SPECS.md`

## Iteration log

| Round | Date | Compared | Owner's reaction | Next changes |
|---|---|---|---|---|
| 0 | 2026-09-13 | seav original web app (vector) | Loved it at first sight: countries in different colors, only borders visible. Not enough, not perfect yet | Faithful print port (`seav-print`), then focused improvement variants |
| 1 | 2026-09-13 | `seav-original` vs. `seav-upright` | Upright with the pole centered "looks beautiful"; every later variant must use the centered-pole view | Add country stats labels |
| 2 | 2026-09-13 | `seav-upright-stats` | "So beautiful!" | Keep refining label fit; consider labels for microstates (outside with leaders) |
| 3 | 2026-09-14 | Round `2026-09-14-r1`: `geo-blue-marble-01-jan` ... `geo-blue-marble-12-dec` | Compared the months as image folders: "that is beautiful", chose November | `geo-blue-marble` uses November; export a 300 dpi print file; then consider labels or thin borders over the imagery |
| 4 | 2026-09-14 | 300 dpi export of `geo-blue-marble-11-nov` (150 x 85.3 cm TIFF) | "That is quite amazing!" | Page to 150 x 90 cm with title and NASA credit; thin borders or labels over the imagery |
| 5 | 2026-09-14 | 300 dpi export with grid labels (meridians, parallels, tropics) | Liked the labels ("quite smart"); lines look very thick at 100%; wants the grid on all maps; June is the favorite for now | Shared `preset-print-grid` (thin lines plus labels) for all maps; June becomes the main Blue Marble month; export June at 300 dpi |
| 6 | 2026-09-14 | Round `2026-09-14-r2` and the June 300 dpi export with thin lines and grid labels | Loved it: "this is fucking great!" | Page to 150 x 90 cm with title and NASA credit; borders or country names over the imagery |
| 7 | 2026-09-15 | `geo-stats-nov` at 400 dpi: borders, data for every country (3-10 pt), name only under 1 million people | "Wow, this looks very appealing" | Page to 150 x 90 cm with title and NASA credit; label the Leeward Islands without leader lines |
| 8 | 2026-09-15 | `geo-stats-nov` with UN population and IMF GDP instead of World Bank data | "Wow, looks cool!" | Frame, title and credits (NASA Earth Observatory, UN DESA, IMF, UN Statistics Division) |
