// ==================================================================
// PNG AND RAW RASTER EXPORT
// ------------------------------------------------------------------

import { Resvg } from '@resvg/resvg-js';
import { FONT_PATHS } from './fonts.mjs';

// ------------------------------------------------------------------

// Creates a resvg renderer fitted to the given pixel width, using bundled
// fonts only
function createResvg(svg, widthPx) {
  return new Resvg(svg, {
    fitTo: { mode: 'width', value: widthPx },
    font : { fontFiles: FONT_PATHS, loadSystemFonts: false, defaultFontFamily: 'Barlow Condensed' },
  });
}

// ------------------------------------------------------------------

// Rasterizes an SVG string to a PNG buffer of the given pixel width
export function renderPng(svg, widthPx) {
  return createResvg(svg, widthPx).render().asPng();
}

// Rasterizes an SVG string to raw RGBA pixels of the given pixel width;
// returns { pixels, width, height }
export function renderRaw(svg, widthPx) {
  const image = createResvg(svg, widthPx).render();
  return { pixels: image.pixels, width: image.width, height: image.height };
}
