// ==================================================================
// DETAIL CROPS AT 100% PRINT SCALE
// ------------------------------------------------------------------

// Fixed windows, each A4 landscape at print scale and centered on a place.
// Every variant is cropped at the same places, so crops compare directly and
// show line weights and text sizes as they will look up close.

import { LatLon } from '../data-types.mjs';
import { project } from '../concialdi.mjs';
import { renderPng } from './png.mjs';
import { formatNumber } from './svg.mjs';

// ------------------------------------------------------------------

const CROP_WIDTH_MM  = 297;
const CROP_HEIGHT_MM = 210;
const CROP_DPI       = 150;
const MM_PER_INCH    = 25.4;

export const CROP_WINDOWS = [
  { name: 'europe'         , lat:  50, lon:   12 },
  { name: 'east-asia'      , lat:  35, lon:  122 },
  { name: 'caribbean'      , lat:  16, lon:  -72 },
  { name: 'southeast-asia' , lat:   5, lon:  112 },
  { name: 'southern-africa', lat: -20, lon:   32 },
  { name: 'bering-tear'    , lat:  62, lon:  176 },
  { name: 'antarctica-edge', lat: -70, lon:   45 },
];

// ------------------------------------------------------------------

// Returns [{ name, png }] for every crop window, given a rendered SVG string
// and the renderer's toPage function (map Point -> page mm)
export function renderCrops(svg, toPage) {
  const widthPx = Math.round(CROP_WIDTH_MM / MM_PER_INCH * CROP_DPI);
  return CROP_WINDOWS.map(({ name, lat, lon }) => {
    const [centerX, centerY] = toPage(project(new LatLon(lat, lon)));
    const viewBox = [
      centerX - CROP_WIDTH_MM / 2,
      centerY - CROP_HEIGHT_MM / 2,
      CROP_WIDTH_MM,
      CROP_HEIGHT_MM,
    ].map(value => formatNumber(value, 3)).join(' ');
    const cropSvg = svg.replace(
      /width="[^"]*" height="[^"]*" viewBox="[^"]*"/,
      `width="${CROP_WIDTH_MM}mm" height="${CROP_HEIGHT_MM}mm" viewBox="${viewBox}"`,
    );
    return { name, png: renderPng(cropSvg, widthPx) };
  });
}
