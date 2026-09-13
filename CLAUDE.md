# CLAUDE.md

Guidance for Claude Code (and humans) working in this repository.

## What this repo is

A fork (`bloom256/cahill-concialdi`) of Eugene Alvin Villar's `seav/cahill-concialdi`:
a small browser app that renders the Cahill-Concialdi "Bat" projection as an SVG
(vector layers) or an HTML canvas (raster layers). See `README.md` for the math
background.

**Goal of this fork:** produce a large (~150 x 90 cm) printable wall map for a home
office -- print-ready PDF + SVG, optionally a static HTML page -- with many style
variants to compare before choosing one. The owner's favorite starting point is
the upstream vector look (countries colored by position, dark ocean, only borders);
see "Reference look" in `docs/print/STYLES.md`. There is no deadline: refine until
the owner feels "that's it". The plan lives in `docs/print/`.
Read `docs/print/README.md` before starting print-related work.

## Hard rules

- **ASCII only** in new code, docs, comments and commit messages (owner's global
  rule). Existing files already contain Unicode (Greek-letter identifiers, typographic
  quotes in README); do not mass-rewrite them, but new identifiers are ASCII
  (`theta`, `deltaLon`). Map label *content* from data (place names with
  diacritics) is an open question -- see `docs/print/README.md`.
- **The projection is fixed: Cahill-Concialdi.** Never suggest Mercator, Robinson,
  Equal Earth or similar compromise/cylindrical projections for the map or insets.
  The owner dislikes their shape/area distortion. Style is free; projection is not.
- Keep the original web app (`index.html`) working. The print pipeline is additive.
- Never commit raw downloads, large rasters, or render outputs (see `docs/print/DATA.md`).
- Physical design values (line widths, font sizes) are specified in mm/pt, never
  in raw SVG units (see `docs/print/PRINT-SPECS.md`).

## Git rules

- **Author of every commit: `Danil An <bloom256@gmail.com>`.** Set in the repo-local
  git config; do not override it with `--author`, env vars or `-c user.*`.
- **Never mention the agent** in commits: no `Co-Authored-By: Claude`, no
  `Claude-Session` links, no "Generated with Claude Code", no references to Claude,
  Anthropic or AI in the message. This overrides any default attribution instructions.
- A local `.git/hooks/commit-msg` hook rejects messages with agent mentions or a
  wrong identity. Never bypass it (`--no-verify`).
- **The agent does all git work itself** (staging, commits, branches) without asking
  first, as part of finishing each change.
- **The agent never pushes.** The owner pushes when they feel the work is good.
- **Clean history: one clearly defined change per commit.** Do not mix unrelated
  changes (e.g. data rebuild + style tweak + docs), and do not leave WIP, "fix typo"
  or "oops" commits behind: fold such follow-ups into the commit they belong to.
  Stage selectively (`git add <paths>`) so each commit contains only its change.
- Rewording, amending or squashing is allowed only for **unpushed** commits
  (check `git log origin/<branch>..HEAD`). Never rewrite pushed history.
- Message style (matches history): imperative, capitalized subject, no trailing
  period, several closely related edits joined with `;`
  (e.g. `Add hover textbox; fix "-99" ISO codes`). Add a body after a blank line
  when the reason is not obvious from the subject.
- ASCII only in commit messages.
- Work on feature branches (currently `admin_map`); `main` mirrors upstream.

## Running the current app

No build step and no `package.json` yet. Modules use `fetch`, so serve over HTTP:

```
python -m http.server 8000      # then open http://localhost:8000/
```

The bottom `<script type="module">` in `index.html` chooses what to draw:
`drawVectorMap()` or `drawRasterMap(RASTER_STYLE, graticuleInterval)`.
Complex.js is loaded from unpkg as the global `Complex`; `cahill-conformal.mjs`
depends on that global.

Local tooling available: Node 24, npm, Python 3.14, Chrome, Edge, git-lfs.
Not installed: Inkscape, ImageMagick, Ghostscript.

## Code map

| File | Role | DOM? |
|---|---|---|
| `globals.mjs` | Math constants, deg/rad, DOM helper aliases (lazy), `getJson` | helpers only |
| `data-types.mjs` | `Point` (2D, chainable rotate/translate/scale), `LatLon` | no |
| `spherical.mjs` | `Pole.mapObliqueLatLon()` (oblique coordinates) | no |
| `cahill-conformal.mjs` | `projectInOctant()` -- Lee conformal octant math (needs global `Complex`) | no |
| `concialdi.mjs` | 12 `MAP_AREAS`, map constants, `project(latLon, areaIdx?)` | no |
| `solar-position.mjs` | `getSunLatLon(date)` for day/night | no |
| `map-vector.mjs` | Background outline, graticule, tropic/polar circles, countries, boundaries | yes (builds SVG DOM) |
| `map-raster.mjs` | Faux-inverse raster renderer on 1x1 deg cells, day/night blend | yes (touches canvas at import) |
| `index.html` | Styles + entry script | -- |

The DOM-free modules can be imported from Node (set `globalThis.Complex` before
calling `project()`; it is only used at call time). `map-raster.mjs` cannot be
imported in Node because it queries `canvas` at module load.

## Coordinate system and gotchas

- Units are SVG user units; y points down. One octant side = 100 units
  (`OCTANT_SCALE`). The North Pole projects to (0, 0).
- Map extent: viewBox `-142 -45.5 302 178` (`MAP_VIEW_ORIGIN`, `MAP_WIDTH`, `MAP_HEIGHT`).
- Tilt `MAP_TILT_DEG = -5.4`. `project()` returns **untilted** coordinates.
  Vector: tilt is a `rotate()` on `#svg-map-wrapper` around (0, 0).
  Raster: applied manually via `.rotate(MAP_TILT).translate(MAP_VIEW_ORIGIN).scale(...)`.
- `MAP_AREAS` are lon/lat rectangles: 5 northern pieces around the North Pole origin
  and 7 southern pieces grouped on three South Pole origins (L: areas 5-7, B: 8, R: 9-11).
- Map interruptions ("tears"): 168.5W in the north (Bering Strait, deliberately not
  Concialdi's 170W). The south is torn along segments of 150W, 25W, 15E, 65E, 45S and
  along the equator between 168.5W and 150W. `MAP_AREAS` and `drawBackground()` are
  the source of truth -- re-derive from them before relying on this list.
- `project(latLon)` without `areaIdx` uses the first area that contains the point.
  Points on area edges are ambiguous: pass `areaIdx` on seams.
- Geometry that crosses a tear must be split in lon/lat *before* projecting. Existing
  country data was hand-split at 150W (Antarctica) and 168.5W (Umnak Island).
- Straight lon/lat segments must be densified before projecting (the graticule steps
  1 deg for this reason); otherwise long borders such as 49N render as chords.
- Adjacent filled pieces show hairline seams; current code strokes each country with
  its own fill color at 0.01 units to hide them.

## Data files

- `ne-country-areas.json`: array of `[isoA2, MultiPolygon]`, 241 entries, coordinates
  `[lon, lat]` rounded to 0.01 deg, Natural Earth 50m-level detail. Special ids exist
  (e.g. `CY-TR`, `SO-SD`).
- `ne-boundaries.json`: array of `[isUndisputed, LineString]`, 363 entries
  (`false` -> drawn dashed as disputed).
- `*.jpg` rasters: 3600x1800 equirectangular, 10 px/deg (`SOURCE_RASTER_PPD`).
  Fine on screen, far too coarse for a large print (~48 dpi at 150 cm).

## Code style (match it)

- Section banners: `// ====...` file header, `// ----...` between sections,
  `// - - - -` between class methods.
- 2-space indent, single quotes, semicolons, trailing commas in multi-line literals.
- `UPPER_SNAKE` constants with aligned `=`/values in blocks; module-level mutable
  state in `PascalCase` (`Canvas`, `SunPosition`); `camelCase` functions.
- Small ES modules with explicit named exports; comment the *why* of the math.

## Branches

- `main` -- upstream state. `admin_map` -- current working branch (same as `main`
  so far); intended for the print map work.
- Upstream WIP branches on `origin` (reference material, not merged):

| Branch | What it contains | Useful for |
|---|---|---|
| `tz` | Time zone polygons colored by UTC offset (geojson file not committed) | time zone style |
| `chart` | Projected bars + rotated labels with web fonts | label code reference |
| `namerica-lakes` | Lakes drawn individually as rotated "specimens" | inset/art ideas |
| `antarctic`, `eras-choropleth` | Choropleth with legend boxes | legend reference |
| `bivariate` | Bivariate choropleth (Africa indices) | thematic layers |
| `tiles`, `tiles-carto-day-night` | Raster tile rendering rework (not reviewed) | raster pipeline |

## Print project docs

`docs/print/README.md` (index, decisions), `ROADMAP.md`, `ARCHITECTURE.md`,
`DATA.md`, `LAYERS.md`, `STYLES.md`, `PRINT-SPECS.md`. Update the decision table in
`docs/print/README.md` whenever the owner decides something.
