# Styles

The final look is not chosen yet, so the pipeline is built to produce **many
variants cheaply** and compare them fairly. A variant is a small override file;
everything else is shared.

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
| `blue-marble` | Photographic Earth | NASA Blue Marble NG + faint white borders/labels | yes | Imagery looks soft near face vertices |
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

## Comparison workflow

1. `npm run variants` renders every variant to `out/variants/<name>/`:
   `map.svg`, `preview.png` (2000 px wide), and `crops/*.png` at 100% print scale.
2. Fixed crop windows (each about A4 at print scale, 297 x 210 mm):
   Europe, East Asia, Caribbean, Indonesia and Philippines, Bering Strait tear,
   southern Africa and Madagascar, Antarctica edge.
3. `print/gallery.html`: grid of previews -> click for full pan/zoom -> A/B slider
   between two variants -> row of crops for side-by-side detail.
4. Shortlist 2-3. Print their A4 crops at 100% on a home printer, tape them to the
   office wall, and look from 1 m and 3 m, in daylight and lamp light.
5. Iterate tokens on the finalists; create derived variants (e.g. `midnight-gold-b`)
   instead of editing the originals, so comparisons stay reproducible.
6. Order a shop proof strip of the winner before the full print.

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
