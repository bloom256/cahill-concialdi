// ==================================================================
// BUNDLED FONTS
// ------------------------------------------------------------------

// Fonts live in print/fonts/ (SIL OFL), so renders never depend on system
// fonts. This module measures text (opentype.js), lists font files for resvg,
// and builds @font-face rules with embedded data so browsers match the PNGs.

import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import opentype from 'opentype.js';

// ------------------------------------------------------------------

const FONT_DIR = resolve(fileURLToPath(import.meta.url), '../fonts');

// Family -> weight -> file name
const FONT_FILES = {
  'Barlow Condensed': {
    300: 'BarlowCondensed-Light.ttf',
    400: 'BarlowCondensed-Regular.ttf',
    500: 'BarlowCondensed-Medium.ttf',
    600: 'BarlowCondensed-SemiBold.ttf',
  },
};

// Absolute paths of all bundled font files
export const FONT_PATHS = Object.values(FONT_FILES)
  .flatMap(weights => Object.values(weights))
  .map(file => join(FONT_DIR, file));

// Parsed opentype.js fonts by file name
const ParsedFonts = new Map();

// ------------------------------------------------------------------

function getFontFile(family, weight) {
  const file = FONT_FILES[family]?.[weight];
  if (!file) throw new Error(`Font not bundled: ${family} ${weight}`);
  return file;
}

function getFont(family, weight) {
  const file = getFontFile(family, weight);
  if (!ParsedFonts.has(file)) {
    const buffer = readFileSync(join(FONT_DIR, file));
    ParsedFonts.set(file, opentype.parse(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)));
  }
  return ParsedFonts.get(file);
}

// ------------------------------------------------------------------

// Returns the advance width of text set at the given size (same unit as size)
export function measureText(text, family, weight, size) {
  return getFont(family, weight).getAdvanceWidth(text, size, { kerning: true });
}

// Returns the ascender and descender as fractions of the font size
// (the descender is negative)
export function getVerticalMetrics(family, weight) {
  const font = getFont(family, weight);
  return { ascender: font.ascender / font.unitsPerEm, descender: font.descender / font.unitsPerEm };
}

// Returns @font-face rules embedding the given [family, weight] pairs
export function getFontFaceCss(pairs) {
  return pairs
    .map(([family, weight]) => {
      const data = readFileSync(join(FONT_DIR, getFontFile(family, weight))).toString('base64');
      return `@font-face{font-family:"${family}";font-weight:${weight};src:url(data:font/ttf;base64,${data}) format("truetype")}`;
    })
    .join('\n');
}
