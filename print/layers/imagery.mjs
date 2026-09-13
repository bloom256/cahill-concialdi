// ==================================================================
// LAYER: IMAGERY (RASTER BASE MAP)
// ------------------------------------------------------------------

// Reprojects an equirectangular source image (e.g. NASA Blue Marble) onto the
// page with the 1x1 deg cell inverse projection from map-raster-geometry.mjs,
// samples it bilinearly at pixel centers, and embeds the result as a JPEG
// clipped to the map outline.

import sharp from 'sharp';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Point } from '../../data-types.mjs';
import { forEachMapCell } from '../../map-raster-geometry.mjs';
import { generateMapOutline, pointListsToPathData } from '../../map-geometry.mjs';
import { attrs } from '../svg.mjs';

// ------------------------------------------------------------------

const ROOT         = resolve(fileURLToPath(import.meta.url), '../../..');
const MM_PER_INCH  = 25.4;
const NUM_CHANNELS = 3;
const JPEG_QUALITY = 92;

// ------------------------------------------------------------------

// Loads an image as { data, width, height } with raw RGB bytes
async function loadSource(filename) {
  const { data, info } = await sharp(resolve(ROOT, filename))
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

// Writes the bilinearly interpolated color of an equirectangular source at
// lat/lon (degrees) into the output buffer at the given index; longitudes wrap
// around the antimeridian and latitudes clamp at the poles
function sampleBilinear(source, lat, lon, output, outputIdx) {

  const { data, width, height } = source;
  const sourceX = (lon + 180) / 360 * width  - 0.5;
  const sourceY = (90  - lat) / 180 * height - 0.5;
  const x0 = Math.floor(sourceX);
  const y0 = Math.floor(sourceY);
  const fractionX = sourceX - x0;
  const fractionY = sourceY - y0;

  const left   = ((x0 % width) + width) % width;
  const right  = (left + 1) % width;
  const top    = Math.min(height - 1, Math.max(0, y0));
  const bottom = Math.min(height - 1, Math.max(0, y0 + 1));

  for (let channel = 0; channel < NUM_CHANNELS; channel++) {
    const topValue =
      data[(top * width + left ) * NUM_CHANNELS + channel] * (1 - fractionX) +
      data[(top * width + right) * NUM_CHANNELS + channel] * fractionX;
    const bottomValue =
      data[(bottom * width + left ) * NUM_CHANNELS + channel] * (1 - fractionX) +
      data[(bottom * width + right) * NUM_CHANNELS + channel] * fractionX;
    output[outputIdx + channel] = topValue * (1 - fractionY) + bottomValue * fractionY;
  }
}

// ------------------------------------------------------------------

export default {
  id     : 'imagery',
  space  : 'page',
  enabled: style => Boolean(style.imagery?.show),
  render : async ctx => {

    const config   = ctx.style.imagery;
    const pxPerMm  = config.dpi / MM_PER_INCH;
    const widthPx  = Math.ceil(ctx.page.widthMm  * pxPerMm);
    const heightPx = Math.ceil(ctx.page.heightMm * pxPerMm);
    const source   = await loadSource(config.source);
    const pixels   = Buffer.alloc(widthPx * heightPx * NUM_CHANNELS);

    const toPixel = point => {
      const [x, y] = ctx.toPage(point);
      return new Point(x * pxPerMm, y * pxPerMm);
    };

    forEachMapCell(toPixel, cell => {
      const xs = cell.maskCorners.map(corner => corner.x);
      const ys = cell.maskCorners.map(corner => corner.y);
      const minX = Math.max(0           , Math.floor(Math.min(...xs)));
      const maxX = Math.min(widthPx  - 1, Math.ceil (Math.max(...xs)));
      const minY = Math.max(0           , Math.floor(Math.min(...ys)));
      const maxY = Math.min(heightPx - 1, Math.ceil (Math.max(...ys)));
      for (let x = minX; x <= maxX; x++) {
        for (let y = minY; y <= maxY; y++) {
          const pixelCenter = new Point(x + 0.5, y + 0.5);
          if (!cell.isInMask(pixelCenter)) continue;
          const latLon = cell.isPolar
            ? cell.getPolarInverseLatLon(pixelCenter)
            : cell.getInverseLatLon     (pixelCenter);
          sampleBilinear(source, latLon.lat, latLon.lon, pixels, (y * widthPx + x) * NUM_CHANNELS);
        }
      }
    });

    const jpeg = await sharp(pixels, { raw: { width: widthPx, height: heightPx, channels: NUM_CHANNELS } })
      .jpeg({ quality: JPEG_QUALITY })
      .toBuffer();
    ctx.notes.push(`imagery: ${config.source} at ${config.dpi} dpi (${widthPx}x${heightPx} px, JPEG ${(jpeg.length / 1e6).toFixed(1)} MB)`);

    const clipId = 'imagery-clip';
    return (
      `<clipPath${attrs({ id: clipId })}>` +
      `<path${attrs({ d: pointListsToPathData([generateMapOutline()], true), transform: ctx.mapTransform })}/>` +
      '</clipPath>' +
      `<image${attrs({
        href               : 'data:image/jpeg;base64,' + jpeg.toString('base64'),
        x                  : 0,
        y                  : 0,
        width              : widthPx  / pxPerMm,
        height             : heightPx / pxPerMm,
        preserveAspectRatio: 'none',
        'clip-path'        : `url(#${clipId})`,
      })}/>`
    );
  },
};
