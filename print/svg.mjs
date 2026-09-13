// ==================================================================
// SVG STRING HELPERS
// ------------------------------------------------------------------

import { MAX_COLOR_VALUE } from '../globals.mjs';

// ------------------------------------------------------------------

const XML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };

// ------------------------------------------------------------------

// Returns a number as a short string rounded to at most numPlaces decimals
export function formatNumber(value, numPlaces = 4) {
  return String(Number(value.toFixed(numPlaces)));
}

// ------------------------------------------------------------------

// Returns a [red, green, blue] color (0-255, may be fractional) as #rrggbb
export function formatColor(rgb) {
  return '#' + rgb
    .map(channel => Math.round(Math.min(MAX_COLOR_VALUE, Math.max(0, channel))))
    .map(channel => channel.toString(16).padStart(2, '0'))
    .join('');
}

// ------------------------------------------------------------------

// Returns an attribute string like ' fill="#123" stroke-width="0.1"';
// skips undefined/null values and formats numbers
export function attrs(attributes) {
  return Object.entries(attributes)
    .filter(([, value]) => value !== undefined && value !== null)
    .map(([name, value]) => {
      const text = typeof value === 'number' ? formatNumber(value) : String(value);
      return ` ${name}="${text.replace(/[&<>"]/g, char => XML_ESCAPES[char])}"`;
    })
    .join('');
}
