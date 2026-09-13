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
| Print size | ~150 x 90 cm, landscape | 2026-09-13 |
| Projection | Cahill-Concialdi only. No Mercator, Robinson, Equal Earth (or similar) anywhere, including insets: they distort country shapes/areas too much for the owner | 2026-09-13 |
| Reference look | seav's original vector map is the favorite, liked at first sight: every country filled with a color derived from its position (north = red, east = green), dark navy ocean, only country borders as linework. It is the baseline all variants are judged against (`STYLES.md`) | 2026-09-13 |
| Style | Not final: the original is "not enough, not perfect" yet. Refine it through focused variants and also stress-test it against contrasting directions, compared side by side | 2026-09-13 |
| Pace | No deadline. Iterate as long as needed until the owner looks at it and feels "that's it". Quality over speed | 2026-09-13 |
| Content | Admin-1 subdivisions, labels, rivers and lakes, frame and cartouche. Must stay extensible: more layers may be added later | 2026-09-13 |
| Docs | `CLAUDE.md` at repo root, plan in `docs/print/` | 2026-09-13 |

## Open decisions

- [ ] Final style (after the gallery comparison, see `STYLES.md`)
- [ ] Layout: margin width and what goes in the empty areas around the bat shape (`PRINT-SPECS.md`, `LAYERS.md`)
- [ ] Print medium: matte fine-art paper, satin/photo paper, or canvas; framed vs. poster rails (affects margins and bleed)
- [ ] Label language and diacritics: English names with native diacritics (recommended, e.g. "Cote d'Ivoire" spelled properly) vs. local-language names vs. plain ASCII
- [ ] Admin-1 coverage: every country, or only large countries (US, CA, BR, RU, CN, IN, AU, ...) to avoid clutter
- [ ] Antarctica treatment: full, visually subdued, or partially cropped (it is heavily inflated in this projection)
- [ ] Disputed borders: Natural Earth default de facto view vs. a point-of-view edition
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
