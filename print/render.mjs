// ==================================================================
// MAP RENDERER (NODE, NO DOM)
// ------------------------------------------------------------------

import './setup.mjs';
import { createContext } from './context.mjs';
import { attrs, formatNumber } from './svg.mjs';
import LAYERS from './layers/index.mjs';

// ------------------------------------------------------------------

const SVG_NS = 'http://www.w3.org/2000/svg';

// ------------------------------------------------------------------

// Renders a resolved style (see styles.mjs) to a complete SVG document string.
// The SVG viewBox is in page millimeters; consecutive map-space layers share
// one group that scales, positions, and tilts untilted map coordinates.
export function renderMap(style) {

  const ctx = createContext(style);
  const parts = [];
  let isInMapGroup = false;

  LAYERS
    .filter(layer => layer.enabled(style))
    .forEach(layer => {
      const isMapLayer = layer.space === 'map';
      if (isMapLayer && !isInMapGroup) parts.push(`<g${attrs({ id: 'map', transform: ctx.mapTransform })}>`);
      if (!isMapLayer && isInMapGroup) parts.push('</g>');
      isInMapGroup = isMapLayer;
      parts.push(layer.render(ctx));
    });
  if (isInMapGroup) parts.push('</g>');

  const width  = formatNumber(ctx.page.widthMm , 3);
  const height = formatNumber(ctx.page.heightMm, 3);
  return (
    `<svg${attrs({
      xmlns  : SVG_NS,
      width  : `${width}mm`,
      height : `${height}mm`,
      viewBox: `0 0 ${width} ${height}`,
    })}>\n` +
    parts.join('\n') +
    '\n</svg>\n'
  );
}
