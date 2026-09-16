# Print Specs

Target: **190 x 95.1 cm, landscape** (map 1900 mm wide, with 45 mm cropped off the top
and 85 mm off the bottom, where the bat shape holds only empty ocean; untrimmed it would
be 190 x 108 cm). The sides give almost nothing: land comes within 15 mm of the right
edge, and cropping asymmetrically would push the North Pole off center.
The 150 x 90 cm figures below are the original plan, kept for the layout math.

## Size math

The projected map extent is 302 x 178 SVG units (aspect 1.697). The page
150 x 90 cm has aspect 1.667, so the map nearly fills the page.

| Layout | Map width | mm per unit | Map height | Side margin | Top/bottom margin |
|---|---|---|---|---|---|
| A: edge to edge | 1500 mm | 4.967 | 884 mm | 0 | 8 mm |
| B: slim margin (default) | 1450 mm | 4.801 | 855 mm | 25 mm | 23 mm |
| C: wide margin | 1400 mm | 4.636 | 825 mm | 50 mm | 37 mm |
| D: current print | 1900 mm | 5.962 | 1081 mm, cropped to 951 mm | 0 (15 mm to the nearest land) | 0 (10 mm of ocean above Kiritimati, 9 mm below Cape Agulhas) |

`mmPerUnit = mapWidthMm / view.width`, where the view is 302 units wide with the
`original` frame and 318.7 units with `pole-centered`, which every print map uses
(it widens the view so the North Pole sits in the middle). Frame elements mostly live
in the empty areas around the bat shape. For canvas wraps add 40-50 mm of
extended background per side; for paper add the shop's bleed (usually 3-5 mm).

**Scale:** in layout B, 90 deg of equator = 100 units = 480 mm, so about 1:20.9M at the
equator (~5.3 mm per degree). Scale varies across each face (conformal: shapes kept,
sizes change; Antarctica is strongly enlarged). Print "scale varies", not a scale bar.

## Unit conversion (layout B)

| From | To SVG map units |
|---|---|
| 1 mm | 0.208 units |
| 1 pt (0.3528 mm) | 0.0735 units |
| 1 unit | 4.80 mm = 13.6 pt |

On the current 190 cm print (layout D) 1 unit = 5.96 mm = 16.9 pt, 1 mm = 0.168 units,
1 pt = 0.059 units.

Always write style tokens in mm/pt; `ctx.mm()` / `ctx.pt()` convert them, so changing
the print size later keeps physical line weights and text sizes intact.

## Recommended sizes

For a viewing distance of 0.5-3 m.

| Element | Recommended | Minimum |
|---|---|---|
| Graticule, admin-1 lines | 0.12-0.25 mm | 0.1 mm (~0.25 pt) |
| Coastline | 0.2-0.35 mm | 0.1 mm |
| Country borders | 0.3-0.6 mm | 0.15 mm |
| Disputed borders | same width, dash 1.5 mm / gap 0.8 mm | -- |
| Rivers | 0.5 mm (major) tapering to 0.12 mm | 0.1 mm |
| City dots | 0.8-2 mm | 0.6 mm |
| City and admin-1 labels | 6-9 pt | 5 pt |
| Country labels | 9-28 pt by size | 7 pt |
| Ocean labels | 30-72 pt, letterspaced | -- |
| Title | 80-160 pt | -- |
| Label halo | 0.3-0.6 mm | -- |

Current web app values at print scale (layout B), for reference:
graticule 0.15 units = 0.72 mm (too heavy), tropic/polar circles 0.3 units = 1.44 mm
(too heavy), boundaries 0.1 units = 0.48 mm (fine), country seam stroke 0.01 units =
0.05 mm (below printable width; acceptable only as a seam sealer).

## Resolution

- Vector layers are resolution-independent.
- Raster layers: **200 dpi** is enough at 1-3 m; **300 dpi** for close inspection.
- Required source density at the equator: ~42 px/deg (200 dpi) to ~63 px/deg (300 dpi).
  Use 60 px/deg sources (21600x10800). The current 10 px/deg images give ~48 dpi.
- Flattened full page: 11811 x 7087 px at 200 dpi; 17717 x 10630 px (~188 MP) at 300 dpi.

## Media and printing

- Large-format pigment inkjet ("giclee") is the usual choice for a single print.
- Paper: matte fine-art (e.g. Hahnemuehle Photo Rag) for muted/antique styles;
  satin or photo paper for dark and imagery styles; canvas for a stretched wrap.
- Roll widths: 914 mm (36"), 1067 mm (42"), 1118 mm (44"), 1372 mm (54"), 1524 mm (60").
  The 900 mm short side barely fits a 36" roll; 42"/44" is safer (trimmed).
- 150 x 90 cm is not a stock frame size in most places: custom frame, poster hanger
  rails, or canvas stretcher. Check local stock sizes (e.g. 100 x 140, 100 x 150)
  before freezing the layout; extra height can go to margins and cartouche.

## Handoff formats

| File | Spec |
|---|---|
| `map.pdf` (primary) | Page = trim size (+ bleed if requested); fonts embedded; rasters at >= 200 dpi effective; sRGB |
| `map-flat.tif` (fallback) | 200-300 dpi, sRGB, LZW compression |
| `map-outlined.svg` | Text as outlines; for vector-savvy shops |
| `map.svg` | Master source (fonts embedded) |

Chrome-generated PDFs are RGB and not PDF/X. Photo and giclee shops normally accept
RGB PDF/TIFF. An offset printer would need PDF/X-4 conversion with a prepress tool
(not installed locally).

## Preflight checklist

- [ ] Page size exact; bleed present if requested
- [ ] No stroke below 0.1 mm; no text below 5 pt
- [ ] All fonts embedded or outlined; no missing glyphs (diacritics)
- [ ] No SVG filters or blend modes left live in the print file
- [ ] Rasters >= 200 dpi effective; no seams at area edges or 180 deg
- [ ] No stray cross-map lines at tears; no gaps between adjacent fills
- [ ] Credits and title present and spelled correctly
- [ ] File opens quickly in a PDF viewer at 100% zoom (RIP-friendliness proxy)

## Proofing

1. Home proof: A4 crops at 100% scale (see crop windows in `STYLES.md`), on the wall,
   viewed from 1 m and 3 m.
2. Shop proof strip: e.g. a 30 x 90 cm vertical slice through Europe and Africa on the
   final paper.
3. Final print. Record shop, paper, printer profile and date below.

## Print log

| Date | Variant | Shop | Media | Size | Notes |
|---|---|---|---|---|---|
| | | | | | |
