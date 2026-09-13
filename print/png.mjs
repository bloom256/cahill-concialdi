// ==================================================================
// PNG EXPORT
// ------------------------------------------------------------------

import { Resvg } from '@resvg/resvg-js';
import { FONT_PATHS } from './fonts.mjs';

// ------------------------------------------------------------------

// Rasterizes an SVG string to a PNG buffer of the given pixel width,
// using bundled fonts only
export function renderPng(svg, widthPx) {
  return new Resvg(svg, {
    fitTo: { mode: 'width', value: widthPx },
    font : { fontFiles: FONT_PATHS, loadSystemFonts: false, defaultFontFamily: 'Barlow Condensed' },
  }).render().asPng();
}
