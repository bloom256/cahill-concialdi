# Architecture

Status: **proposed**. Nothing below exists yet except the original web app modules.

## Pipeline

```
 Natural Earth / NASA downloads                  data/raw/        (gitignored)
            |
            v
 scripts/data/*.mjs   filter fields, simplify, round,
                      cut at tears, densify (lon/lat space)
            |
            v
 data/build/*.json    projection-ready lon/lat geometry
            |
            v
 print/render.mjs     Node, no DOM
   = styles/<variant>.mjs + layers/*.mjs + concialdi.mjs
            |
            v
 out/rounds/<round>/<variant>/map.svg
            +--> export-png  (resvg-js)          -> overview.png, crops/*.png
            +--> export-pdf  (headless Chrome)   -> map.pdf           (finalists)
            +--> deep-zoom tiles (sharp)         -> tiles/            (finalists)
            +--> outline text (opentype.js)      -> map-outlined.svg  (final)
            |
            v
 gallery (npm run gallery) <-> docs/print/rounds/<round>.json   web/ (optional static page)
```

## Directory layout

```
package.json             "type": "module"
scripts/data/            sources.json (pins), fetch.mjs, build-<layer>.mjs, cut.mjs
data/raw/                downloads (gitignored)
data/build/              processed geometry (see DATA.md storage policy)
docs/print/rounds/       round manifests with ratings and notes (committed)
print/
  cli.mjs                render | round | gallery | pdf | png | preflight
  render.mjs             renderMap({ style, page }) -> SVG string
  context.mjs            units, projection helpers, defs registry, data loader
  geometry.mjs           cut / densify / project / path-string helpers
  layers/                one module per layer (see LAYERS.md)
  styles/                base.mjs + one module per variant
  labels/overrides.json  hand-tuned label placement
  fonts/                 OFL font files
  raster/                offline raster renderer (Phase 6)
  gallery/               gallery page + tiny local server (reads/writes round manifests)
out/rounds/              render outputs per round and variant (gitignored)
web/                     optional static page
```

## Reusing the existing code

- `concialdi.mjs`, `cahill-conformal.mjs`, `spherical.mjs`, `data-types.mjs`,
  `solar-position.mjs` are DOM-free and are imported as-is.
- `Complex` is a browser global. In Node, a small `print/setup.mjs` does
  `import Complex from 'complex.js'; globalThis.Complex = Complex;` and is imported
  first. (It is only needed at call time, not at import time.) A later cleanup could
  make `cahill-conformal.mjs` import Complex and give `index.html` an import map.
- Vector geometry (outline, graticule, circles, GeoJSON to path data, position
  colors) lives in the DOM-free root module `map-geometry.mjs`. Both `map-vector.mjs`
  (web app) and `print/layers/` use it, so one fix reaches both outputs.
- `map-raster.mjs` is still DOM-bound; its cell inverse math gets the same
  extraction in Phase 6.
- The web app keeps working unchanged.

## Render context (passed to every layer)

```js
{
  style,                 // resolved tokens: deep merge of base.mjs + variant
  page,                  // { widthMm, heightMm, mapWidthMm, mapOffsetMm: { x, y } }
  mm(value),             // millimeters -> SVG units of the map group
  pt(value),             // points -> SVG units of the map group
  project(latLon, idx),  // untilted map coordinates (from concialdi.mjs)
  toPage(point),         // map coordinates -> page mm (applies scale, tilt, offset)
  data(name),            // loads data/build/<name>.json (cached)
  defs,                  // defs.add(id, svg) for gradients, patterns, clipPaths
}
```

## Layer contract

```js
export default {
  id      : 'rivers',
  space   : 'map',               // 'map' = inside tilted map group; 'page' = page mm
  data    : ['rivers'],
  enabled : style => style.rivers.show,
  render  : ctx => '<g id="rivers">...</g>',
};
```

- Layers return strings; `render.mjs` orders them by the stack in `LAYERS.md`.
- `space: 'page'` layers (labels, frame, cartouche) never inherit the -5.4 deg tilt,
  so text can be set horizontal on paper; they use `ctx.toPage()` to anchor to map features.

## Style contract

- Plain JS object, deep-merged over `styles/base.mjs`.
- All sizes in `mm` or `pt`; colors as hex; every layer has a `show` flag.
- A variant may override layer order only through explicit, named options
  (e.g. `graticule.aboveLand: true`), not by editing the stack.

## SVG structure

```xml
<svg xmlns="http://www.w3.org/2000/svg" width="1500mm" height="900mm" viewBox="0 0 1500 900">
  <defs>fonts (@font-face), clipPaths, patterns, gradients</defs>
  <g id="page-background">...</g>
  <g id="map" transform="translate(ox oy) scale(s) rotate(-5.4)">
    <!-- map-space layers, untilted projected coordinates -->
  </g>
  <g id="page-layers"><!-- labels, frame, cartouche in mm --></g>
</svg>
```

The page viewBox is in millimeters, so page-space layers use mm directly and
`s = mapWidthMm / 302` converts map units.

## Geometry pipeline

1. **Cut at true tears** (lon/lat space). Land-type data only meets 168.5W (north) and
   150W (Antarctica). Ocean-type data (bathymetry, marine polygons, time zones,
   graticule) crosses all southern tears too. Source of truth: `MAP_AREAS` and
   `drawBackground()` in the original code.
2. **Insert vertices at area-boundary crossings** (every MapArea edge, torn or not),
   so segments bend where the projection changes faces.
3. **Densify** segments longer than ~0.25 deg, so borders following parallels curve.
4. **Project** each vertex with its containing area; vertices lying exactly on a tear
   use the piece's area-group hint.
5. **Serialize** with 2 decimals in map units (0.01 unit ~ 0.05 mm at print size).
6. **Seams:** splitting only at true tears keeps adjacent pieces unsplit and avoids
   hairline gaps. Where splits are unavoidable, dissolve after projection or use a
   same-color micro stroke (what the current app does).

Polar edge cases: Antarctica's polygon edge along 90S collapses to a pole point per
south-pole origin; verify the ring stays valid after projection.

## Export

- **SVG:** physical `width/height` in mm. Fonts embedded as base64 `@font-face` for
  the master; a second, shop-safe file with text converted to paths via opentype.js.
- **PDF:** `puppeteer-core` driving the local Chrome
  (`C:/Program Files/Google/Chrome/Application/chrome.exe`):
  `page.pdf({ width: '1500mm', height: '900mm', printBackground: true })`.
  SVG filters (blur, turbulence) and blend modes may be rasterized at low resolution
  or dropped -- avoid them in print styles or bake them into a high-res raster.
- **PNG/TIFF:** `@resvg/resvg-js` for previews, crops and the flattened fallback
  (deterministic, no browser); `sharp` to write TIFF and to stitch strips if needed.

## Raster renderer (Phase 6)

- Port `MapCell` (cell corners, quadratic inverse, polar inverse) to `print/raster/`.
- Read sources with `sharp` as raw RGB buffers; render the output in horizontal strips
  to bound memory (a 300 dpi page is ~188 megapixels).
- Replace nearest-pixel lookup with bilinear sampling; wrap longitude at +/-180.
- Mask with the projected outline (or land polygons) and write PNG/TIFF at the target dpi,
  then reference it from the SVG with `<image>`.

## Quality checks

- `npm run preflight` on each render: min stroke width (mm), min font size (pt),
  path node count, SVG/PDF size, fonts embedded, nothing outside the page.
- Parity test: `seav-original` style vs. the web app.
- Geometry tests: known tear crossings produce split pieces; no segment in projected
  space longer than a threshold (catches cross-map jumps).
