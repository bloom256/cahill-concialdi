// ==================================================================
// MAP RENDERER (NODE, NO DOM)
// ------------------------------------------------------------------

import './setup.mjs';
import { createContext } from './context.mjs';
import { getFontFaceCss } from './fonts.mjs';
import { attrs, formatNumber } from './svg.mjs';
import LAYERS from './layers/index.mjs';

// ------------------------------------------------------------------

const SVG_NS = 'http://www.w3.org/2000/svg';

// ------------------------------------------------------------------

// Renders a resolved style (see styles.mjs) to a Promise of
// { svg, notes, toPage }: a complete SVG document string, remarks from layers,
// and the map Point to page mm mapping. The SVG viewBox is in page
// millimeters; consecutive map-space layers share one group that scales,
// positions, and tilts untilted map coordinates.
export async function renderMap(style) {

  const ctx = createContext(style);
  const parts = [];
  let isInMapGroup = false;

  for (const layer of LAYERS.filter(layer => layer.enabled(style))) {
    const isMapLayer = layer.space === 'map';
    if (isMapLayer && !isInMapGroup) parts.push(`<g${attrs({ id: 'map', transform: ctx.mapTransform })}>`);
    if (!isMapLayer && isInMapGroup) parts.push('</g>');
    isInMapGroup = isMapLayer;
    parts.push(await layer.render(ctx));
  }
  if (isInMapGroup) parts.push('</g>');

  // Embed the fonts layers used, so browsers render the same text as resvg
  const usedFonts = ctx.getUsedFonts();
  if (usedFonts.length) parts.unshift(`<defs><style>\n${getFontFaceCss(usedFonts)}\n</style></defs>`);

  const width  = formatNumber(ctx.page.widthMm , 3);
  const height = formatNumber(ctx.page.heightMm, 3);
  const svg = (
    `<svg${attrs({
      xmlns  : SVG_NS,
      width  : `${width}mm`,
      height : `${height}mm`,
      viewBox: `0 0 ${width} ${height}`,
    })}>\n` +
    parts.join('\n') +
    '\n</svg>\n'
  );
  return { svg, notes: ctx.notes, toPage: ctx.toPage, page: ctx.page };
}
