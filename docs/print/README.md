# Cahill-Concialdi Wall Map -- Print Project

Goal: a large, beautiful and unique wall map for the home office, rendered
reproducibly from this repository in the Cahill-Concialdi projection.

## Deliverables

1. **Print master** -- PDF (vector, fonts embedded) plus the SVG source.
2. **Fallback** -- flattened TIFF/PNG at 200-300 dpi for print shops whose RIP
   struggles with very complex vector files.
3. **Optional** -- static HTML page (zoomable, style switcher), hostable on
   GitHub Pages from this fork.

## Decisions so far

| Topic | Decision | Decided |
|---|---|---|
| Print size | 190 x 99.6 cm, landscape (2 m of free wall; at 150 cm the smallest labels were too small to read). First plan was ~150 x 90 cm; the full bat shape is 190 x 108 cm before the bottom crop | 2026-09-15 |
| Bottom crop | 85 mm cut from the bottom of the page (`page.cropBottomMm`): below Cape Agulhas at 987 mm there is only empty ocean, so no land is lost and Antarctica (ending at 909 mm) is untouched | 2026-09-16 |
| Projection | Cahill-Concialdi only. No Mercator, Robinson, Equal Earth (or similar) anywhere, including insets: they distort country shapes/areas too much for the owner | 2026-09-13 |
| Reference look | seav's original vector map is the favorite, liked at first sight: every country filled with a color derived from its position (north = red, east = green), dark navy ocean, only country borders as linework. It is the baseline all variants are judged against (`STYLES.md`) | 2026-09-13 |
| Style | Not final: the original is "not enough, not perfect" yet. Refine it through focused variants and also stress-test it against contrasting directions, compared side by side | 2026-09-13 |
| Pace | No deadline. Iterate as long as needed until the owner looks at it and feels "that's it". Quality over speed | 2026-09-13 |
| Content | Admin-1 subdivisions, labels, rivers and lakes, frame and cartouche. Must stay extensible: more layers may be added later | 2026-09-13 |
| Docs | `CLAUDE.md` at repo root, plan in `docs/print/` | 2026-09-13 |
| Print grid | Thin line weights (graticule 0.2 mm, tropic and polar circles 0.35 mm) and grid labels on every map except `seav-original`, via `preset-print-grid` | 2026-09-14 |
| Crimea | Drawn as part of Ukraine: Russia and Ukraine get their 1991 borders, and the dashed line at Perekop is gone. Natural Earth's default (Crimea in Russia) is a de facto view; the UN population and IMF GDP figures count Crimea in Ukraine anyway | 2026-09-16 |
| Country stats layout | The three numbers share one line ("38.2M / $2.17T / $56.8K") and labels are 5-14 pt. The stacked four-line block was too tall, so too many names ended up off their country on leader lines | 2026-09-16 |
| Blue Marble month | June 2004, the current favorite ("my fav for now"); November was chosen first from all 12 months in round `2026-09-14-r1`. `geo-blue-marble` uses June | 2026-09-14 |
| Orientation | Every variant after `seav-original` uses the upright, North-Pole-centered view of `seav-upright` (no -5.4 deg tilt); new variants extend `seav-upright` or a descendant of it | 2026-09-13 |
| Variants | All variants live side by side as style files in the same commit, never in branches. Every build can render all of them, and the collection grows over time (e.g. a geographic map and a random-colors map next to `seav-print`) (`STYLES.md`) | 2026-09-13 |
| Variant comparison | Tiered outputs (SVG, 4000 px overview, fixed 100%-scale crops) reviewed in a local gallery with synced zoom, swipe, blink and pixel diff. PDFs, deep zoom and home-printed crops for finalists only (`STYLES.md`) | 2026-09-13 |
| Storage | Git holds what reproduces a render (code, styles, fonts, data pins, lockfile) plus round manifests with ratings and notes. Renders stay in `out/`; final print files go to a GitHub Release (`DATA.md`) | 2026-09-13 |

## Open decisions

- [ ] Final style (after the gallery comparison, see `STYLES.md`)
- [ ] Layout: margin width and what goes in the empty areas around the bat shape (`PRINT-SPECS.md`, `LAYERS.md`)
- [ ] Print medium: matte fine-art paper, satin/photo paper, or canvas; framed vs. poster rails (affects margins and bleed)
- [ ] Label language and diacritics: English names with native diacritics (recommended, e.g. "Cote d'Ivoire" spelled properly) vs. local-language names vs. plain ASCII
- [ ] Admin-1 coverage: every country, or only large countries (US, CA, BR, RU, CN, IN, AU, ...) to avoid clutter
- [ ] Antarctica treatment: full, visually subdued, or partially cropped (it is heavily inflated in this projection)
- [ ] Disputed borders: Natural Earth's de facto view is kept, except Crimea (decided
  2026-09-16, see the decision table). Open: whether to label Siachen Glacier at all, and
  how to mark areas without UN/IMF data (Northern Cyprus, Somaliland, Western Sahara)
- [ ] Vector-only vs. hybrid raster styles for the final print (raster needs multi-GB source downloads)
- [ ] Personal touches (see "Make it yours" in `STYLES.md`)

## Documents

| File | Contents |
|---|---|
| [ROADMAP.md](ROADMAP.md) | Phased plan with checkboxes and "done when" criteria |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Headless Node render pipeline, directory layout, layer/style contracts, geometry handling, export |
| [DATA.md](DATA.md) | Data sources, preprocessing, size budget, storage policy, licenses and credits |
| [LAYERS.md](LAYERS.md) | Layer stack, labels, frame and cartouche, adding a new layer, future layer ideas |
| [STYLES.md](STYLES.md) | Style tokens, starter variants, comparison workflow, color and font notes |
| [PRINT-SPECS.md](PRINT-SPECS.md) | Size math, unit conversion, minimum line/text sizes, resolution, media, handoff and proofing |

## Principles

1. **Projection is fixed; styling is free.**
2. **Reproducible:** `data -> render -> export` is fully scripted. Hand-tuning
   (label nudges, hidden features) lives in versioned JSON, never in edited output files.
3. **Design in physical units** (mm, pt), converted to SVG units at render time.
4. **Judge at 100% print scale**, not only on whole-map thumbnails.
5. **Vector first**; raster layers only where they clearly add beauty.
6. **Keep the original web app working.**
