// ==================================================================
// LAYER: PLACE LABELS
// ------------------------------------------------------------------

// Names for places no country label reaches: island groups far from their
// country's main body (Hawaii belongs to the United States, whose label sits
// on the mainland), and any other spot worth naming. The points are a
// hand-kept list (`data/places.json`); each label sits on its point, or a few
// millimeters off it when that spot is already taken by another label.

import { LatLon } from '../../data-types.mjs';
import { project } from '../../concialdi.mjs';
import { measureText, getVerticalMetrics } from '../fonts.mjs';
import { attrs, escapeXml } from '../svg.mjs';
import { findOverlaySpot } from './country-stats.mjs';

// ------------------------------------------------------------------

export default {
  id     : 'places',
  space  : 'page',
  enabled: style => Boolean(style.places?.show),
  render : ctx => {

    const config = ctx.style.places;
    const places = ctx.data(config.data);
    const haloWidthEm = config.haloColor ? config.haloWidthEm : 0;
    const { ascender, descender } = getVerticalMetrics(config.font, config.weight);
    const offsetsMm = config.offsetsMm ?? [0];

    ctx.useFont(config.font, config.weight);

    const texts = [];
    let moved = 0;

    places.forEach(place => {

      const fontSize = ctx.mm(place.size ?? config.size);
      const anchor   = ctx.toPage(project(new LatLon(place.lat, place.lon)));
      const width    = measureText(place.name, config.font, config.weight, fontSize) + haloWidthEm * fontSize;
      const height   = fontSize * config.lineHeight;

      const spot = findOverlaySpot(ctx, anchor, width, height, offsetsMm, null);
      const centerX = spot ? spot.centerX : anchor[0];
      const centerY = spot ? spot.centerY : anchor[1];
      if (spot && (spot.centerX !== anchor[0] || spot.centerY !== anchor[1])) moved++;

      ctx.labelBoxes.push({
        minX: centerX - width / 2, maxX: centerX + width / 2,
        minY: centerY - height / 2, maxY: centerY + height / 2,
      });

      texts.push(`<text${attrs({
        x             : centerX,
        y             : centerY + (ascender + descender) / 2 * fontSize,
        'font-size'   : fontSize,
        'stroke-width': haloWidthEm ? haloWidthEm * fontSize : undefined,
      })}>${escapeXml(place.name)}</text>`);
    });

    ctx.notes.push(`places: ${texts.length} labels (${moved} moved to avoid other labels)`);

    return (
      `<g${attrs({
        id               : 'places',
        'font-family'    : config.font,
        'font-weight'    : config.weight,
        'text-anchor'    : 'middle',
        fill             : config.color,
        'fill-opacity'   : config.opacity,
        stroke           : config.haloColor,
        'stroke-opacity' : config.haloColor ? config.haloOpacity : undefined,
        'stroke-linejoin': config.haloColor ? 'round' : undefined,
        'paint-order'    : config.haloColor ? 'stroke' : undefined,
      })}>` +
      texts.join('') +
      '</g>'
    );
  },
};
