# Styles

The final look is not chosen yet, so the pipeline is built to produce **many
variants cheaply** and compare them fairly. A variant is a small override file;
everything else is shared.

## Variants live side by side, not in branches (decided 2026-09-13)

- Each variant is one file in `print/styles/`. Any commit can render **all**
  of them: `npm run round` with no arguments renders every variant not marked archived.
- Git branches are only for renderer or data *code* experiments, merged back when
  done. A look never gets its own branch.
- Adding a look means adding a file, so the collection keeps growing: a geographic
  map (`geo-hypsometric`) and a random-colors map (`political-random-s42`)
  sit next to `seav-print` in the same build.
- Name variants by family prefix: `seav-*` (position colors), `political-*`
  (MAPCOLOR or random fills), `geo-*` (physical: relief, hypsometric, bathymetry),
  `mood-*` (midnight, parchment, blueprint, ...). Names in the tables below are provisional.
- A variant extends shared presets, then overrides them:

```js
// print/styles/political-random-s42.mjs
export default {
  extends: ['seav-base'],
  land: { mode: 'random', seed: 42, neighborsDistinct: true },
};
```

- Randomness is always seeded, so a take re-renders identically. A different seed
  is a different variant.
- A change to shared code affects every variant at once. That is intended: bug fixes
  and better data improve all looks. Each variant spells out its defining choices in
  its own file, not through base defaults, so edits to the base can't quietly change
  its identity. Past takes stay reproducible from the commit in their round manifest.
- To retire a variant, set `archived: true`: default renders skip it, but it can still
  be rendered. Delete the file only when it is clearly dead; old manifests still
  point to a commit that has it.

## Reference look: seav original (owner's favorite)

The owner liked the upstream vector map (`drawVectorMap()` in `index.html`) at first
sight. It is the baseline: every other variant is compared against it. Its recipe,
taken from `map-vector.mjs` and `index.html`:

| Element | Original value |
|---|---|
| Ocean / map background | `#123` |
| Graticule | every 10 deg, `#246`, 0.15 units (0.72 mm at print size) |
| Equator, tropic and polar circles | `#357`, 0.3 units; tropics and polar circles dashed `1 1` |
| Country fill | color from the country's mean vertex position (formula below) |
| Country stroke | same color as the fill, 0.01 units: hides seams only, so there is no coastline |
| Boundaries | `#234`, 0.1 units, round joins and caps; disputed dashed `0.5 0.2` |
| Labels, frame | none |

Color formula (per country; meanLat/meanLon = average of all its vertices):

```
r = 127.5 * (1 + meanLat / 90)
g = 127.5 * (1 + meanLon / 180)
b = 255 - (r + g) / 2                  // computed from r, g before the boost
r, g, b = min(255, 1.25 * r), min(255, 1.25 * g), min(255, 1.25 * b)
```

North leans red, east leans green, south-west leans blue. Neighbors get similar
colors, so the world reads as one smooth color field cut by dark borders.

**Keep:** the continuous position-based color field, the dark ocean, borders as the
only linework, and the quiet graticule.

**Possible improvements**, each as a separate variant so its effect can be judged on its own:

| Variant | Change vs. original | Why |
|---|---|---|
| `seav-original` | None: 50m data, same unit widths | Exact parity with the web app |
| `seav-upright` | No -5.4 deg tilt; North Pole on the vertical center line (`view.frame: 'pole-centered'`) | Owner's request: a symmetric, upright butterfly |
| `seav-upright-stats` | Adds each country's name, population, GDP and GDP per capita inside the country (Barlow Condensed) | Owner's request: the numbers behind each country |
| `seav-print` | Same colors and look; 10m geometry; line widths converted to printable mm | **The baseline for every comparison** |
| `seav-centroid` | Area-weighted centroid or NE label point instead of the vertex mean; option to freeze the original 50m colors in a lookup table | The vertex mean is pulled toward detailed coastlines (Norway, Canada, Chile, archipelagos) and colors would drift with 10m data |
| `seav-oklch` | Map lat/lon through OKLab/OKLCH instead of clamped RGB | Even lightness, smoother transitions, no clipped over-bright patches (the 1.25 boost pins many channels at 255) |
| `seav-soft`, `seav-vivid` | Same hues, lower or higher chroma | Matte paper vs. satin; how the colors feel in the room |
| `seav-flow` | Color each admin-1 region by its own position; admin-1 lines as hairlines | The gradient flows inside large countries (US, Russia, Brazil, China) |
| `seav-admin1` | One color per country; admin-1 lines in a darker tint of that country's color | Adds detail without gray clutter |
| `seav-borders-*` | Border color: navy `#234` vs. near-black vs. ocean-colored "paper gap" | Borders set the whole character of this look |
| `seav-deep` | Subtle bathymetry bands or a faint vignette in the `#123` ocean | Adds depth without new colors |
| `seav-light` | Same color field on a pale ocean | In case a large dark area feels too heavy in the room |
| `seav-labels` | Restrained labels; text color picked per label from the fill's luminance | The original has no labels, so this is the riskiest change |

The contrasting directions below are there to stress-test the favorite, not to
replace it by default.

## Style tokens (`print/styles/base.mjs`)

All sizes are physical (mm or pt). Illustrative shape:

```js
export default {
  name: 'base',
  page:      { widthMm: 1500, heightMm: 900, mapWidthMm: 1450, color: '#f4efe6' },
  fonts:     { serif: 'EB Garamond', sans: 'Inter', mono: 'IBM Plex Mono' },
  ocean:     { show: true, fill: '#dfe8ec' },
  graticule: { show: true, intervalDeg: 15, strokeMm: 0.15, color: '#b9c9d1', aboveLand: false, oceanOnly: true },
  circles:   { show: true, strokeMm: 0.25, color: '#9fb4be', dash: [1.5, 1.0] },
  foldLines: { show: false, strokeMm: 0.2, color: '#00000022', dash: [3, 2] },
  land:      { show: true, mode: 'position', // 'position' (seav formula) | 'position-oklch' | 'mapcolor7' | 'single'
               palette: ['#e8d9c0', '#d7e3c8', '#f0d4c4', '#dcd4e6', '#f2e6b8', '#cfe0dd', '#e9cfd6'] },
  lakes:     { show: true, fill: '#dfe8ec', strokeMm: 0.1, stroke: '#9fb4be' },
  rivers:    { show: true, maxRank: 8, widthMm: [0.5, 0.12], color: '#8fb0c0' },
  admin1:    { show: true, countries: ['US', 'CA', 'BR', 'RU', 'CN', 'IN', 'AU'], strokeMm: 0.12, color: '#a89f93', dash: null },
  admin0:    { show: true, strokeMm: 0.35, color: '#7a6f62', disputedDash: [1.5, 0.8] },
  coast:     { show: false, strokeMm: 0.2, color: '#6f8793' },
  cities:    { show: true, maxRank: 4, dotMm: 1.0, capitalDotMm: 1.6, color: '#3a3330' },
  labels:    { show: true, orientation: 'page', color: '#3a3330', haloMm: 0.4, haloColor: '#f4efe6',
               sizesPt: { ocean: 48, country: [9, 28], city: 7, admin1: 6.5, river: 6.5 } },
  frame:     { show: true, border: 'double-rule', title: 'The World', subtitle: 'Cahill-Concialdi Bat Projection' },
};
```

## Contrasting variants

Build these after the `seav-*` family. They deliberately cover very different moods.

| Variant | Mood | Key choices | Raster? | Risks |
|---|---|---|---|---|
| `atlas-classic` | Timeless reference atlas | Pastel political fills via `MAPCOLOR7`, pale blue ocean, serif labels | no | Can feel generic |
| `midnight-gold` | Dark, elegant, office-friendly | Ocean `#0f1b2d`, land `#1c2a3f`, gold borders `#c9a45c`, ivory small-caps labels | no | Dark fills can print muddy; proof needed |
| `parchment` | Antique chart | Warm paper `#efe3c8` with grain, sepia coast, waterline ripples along coasts, italic serif | texture only | Kitsch if overdone; ripples add heavy geometry |
| `swiss-minimal` | Quiet, modern | White paper, near-white land, hairline borders, one accent color, Inter/Plex labels | no | Too quiet for a large wall |
| `blueprint` | Technical drawing | Blue ground `#123e6b`, white linework in 3 weights, mono caps labels, visible fold lines | no | Strong "tech" look |
| `papercraft` | Unique to this projection | Octahedron faces subtly shaded like folded paper, fold lines, soft shadows at tears | subtle | Needs careful restraint |
| `bathymetric` | Ocean-focused | Depth bands in 6-8 blues, land one warm tone, minimal borders | no | Bathymetry must be cut at all tears |
| `hypsometric-relief` | Physical atlas | NE cross-blended hypso + thin borders + light labels | yes (60 px/deg) | Big downloads; raster renderer |
| `geo-blue-marble` (built) | Photographic Earth, early winter | NASA Blue Marble NG, November 2004 (owner's choice), faint white graticule; no fills, borders or labels | yes (21600x10800 source, rendered at 150 dpi) | Imagery softer near face vertices; large file |
| `geo-labeled-grid` (built) | Photographic Earth with a readable grid | November Blue Marble plus labels on meridians (every 30 deg), parallels (30/60 N and S) and the equator, tropics and polar circles | yes | Label density near the tears |
| `geo-blue-marble-01-jan` ... `geo-blue-marble-12-dec` (built) | One per month of 2004, from winter snow to green summer | Same look with that month's imagery; compare them in a round | yes | Same |
| `night-lights` | Dramatic | NASA Black Marble, faint coast, gold city labels | yes | Large black areas; banding |
| `day-night-moment` | Personal, unique | Blue/Black Marble blended at a chosen date/time (existing day/night logic) | yes | Needs a meaningful moment |
| `riso-duotone` | Graphic print | Two inks (e.g. `#ff48b0` + `#0078bf`), overprint look, halftone patterns | no | Fluorescent colors are outside CMYK gamut |
| `time-zones` | Colorful, useful | `tz` branch hues, desaturated, over a light base | no | Busy with admin-1 on |

## Make it yours

Ideas that make the map unique to the owner:
- Custom title/subtitle in the cartouche (a name, a motto, the office location)
- Day/night terminator at a meaningful moment
- Personal places layer (lived, visited, family origins), subtle and consistent
- A small marker at the home office coordinates
- Tissot indicatrices or a fold-net diagram explaining why this projection was chosen

## Comparison workflow (decided 2026-09-13)

We don't make a PDF for every take or full-resolution PNGs: they're slow, huge, and
can't be compared side by side. Instead, outputs are tiered by purpose:

| Tier | Output | Used for | Produced |
|---|---|---|---|
| 1 | `map.svg` | Source for every other output | Every render |
| 2 | `overview.png`, 4000 px wide | Composition and color balance; the view from 2-3 m | Every variant |
| 2 | `crops/<window>.png` at 100% print scale, 150 dpi | Line weights, text sizes, clutter; the view from 1 m | Every variant |
| 3 | Gallery (`npm run gallery`) | Comparing tiers 1-2 | Always |
| 4 | Deep-zoom tiles (200 dpi), `map.pdf`, A4 crops printed at home | Checking finalists | Shortlist only |

**Crop windows** stay fixed so every variant is judged on the same places. Each is
about A4 at print scale (297 x 210 mm): Europe, East Asia, Caribbean, Indonesia and
Philippines, Bering Strait tear, southern Africa and Madagascar, Antarctica edge.

**Round layout.** Renders go under `out/` (not in git). The manifest is in git:

```
out/rounds/2026-09-20-r1/            <- renders, gitignored
  seav-print/   map.svg  overview.png  crops/*.png
  seav-oklch/   ...
docs/print/rounds/2026-09-20-r1.json <- manifest, committed
```

```json
{
  "round": "2026-09-20-r1",
  "baseline": "seav-print",
  "variants": [
    {
      "name": "seav-oklch",
      "commit": "abc1234",
      "changes": { "land.mode": "position-oklch" },
      "rating": 4,
      "notes": "Smoother gradient, but Africa feels dull"
    }
  ],
  "decision": "Keep OKLCH; try higher chroma next round"
}
```

**Gallery features:**
- Grid of overviews showing name, one-line change vs. baseline, and rating
- 2-4 variants side by side with synchronized pan/zoom
- Swipe slider and blink toggle (flips A/B in place; the best way to spot subtle color or width changes)
- Pixel-diff highlight between two variants
- Crop rows: the same window across all variants
- Rating and notes per variant, saved straight into the round manifest by the local gallery server

**Round loop:**
1. Change one thing per variant. Derive a new variant (`seav-oklch-b`) rather than editing
   one that has already been compared.
2. `npm run round -- seav-print seav-oklch ...` renders tiers 1-2 into a new round
   and writes its manifest.
3. Review in the gallery, then rate and note each variant.
4. Commit the manifest (`Record round 2026-09-20-r1 review`). Add a line to the
   iteration log in `ROADMAP.md`. Optionally keep one curated ~1200 px JPG
   per milestone in `docs/print/rounds/<round>/`.
5. For the shortlist, produce tier 4: PDF, deep zoom, and A4 crops printed at 100%,
   taped to the wall, and viewed from 1 m and 3 m in daylight and lamp light.
6. For the final candidate, order a shop proof strip before the full print.

**Screen caveat:** monitors show dark and saturated colors brighter than paper does.
Judge composition and detail on screen; decide final colors from physical proofs.

## Evaluation checklist

- [ ] Readable at 1 m; clear composition at 3 m
- [ ] Clear hierarchy: ocean vs. land vs. borders vs. labels
- [ ] Not busy: admin-1 lines and rivers stay secondary
- [ ] Tears look intentional, not like errors
- [ ] Antarctica does not dominate the composition
- [ ] Typography is consistent and well spaced
- [ ] Colors fit the room (wall color, furniture, light)
- [ ] Dark or saturated areas survive printing (proof)
- [ ] Would still be enjoyable after a year on the wall

## Color notes

- Author in sRGB. Avoid neon greens, blues and oranges that fall outside print gamut;
  ask the shop for a soft proof or a proof strip.
- Large flat dark fills and smooth gradients can band: add 1-2% noise or subtle texture.
- Thin light lines on dark backgrounds lose weight in print (ink spread): make them
  ~20-30% heavier than on light styles.
- `MAPCOLOR7/8/9/13` (Natural Earth) give neighbor-distinct color indices for
  political fills without computing a graph coloring.

## Fonts (SIL OFL candidates)

- Serif: EB Garamond, Cormorant Garamond, Source Serif 4, Libre Caslon, IM Fell English
- Sans: Inter, IBM Plex Sans / Plex Sans Condensed, Barlow Condensed, Josefin Sans
- Mono: IBM Plex Mono
- Fallback with wide diacritic coverage: Noto Sans / Noto Serif

Store font files in `print/fonts/` and record each license in the credits.
