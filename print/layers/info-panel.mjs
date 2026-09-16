// ==================================================================
// LAYER: INFO PANEL
// ------------------------------------------------------------------

// A two-column panel set in empty ocean: title, how the projection works, a
// small map of equal circles showing its distortion, how to read the labels,
// what the lines mean, and the sources. The words live in print/info/content.mjs.
// Text uses the country labels' look (white with a dark halo) and every block
// is recorded in ctx.labelBoxes, so grid labels keep clear of it.

import { LatLon } from '../../data-types.mjs';
import { project } from '../../concialdi.mjs';
import { generateMapOutline, geoJsonToPathData } from '../../map-geometry.mjs';
import { measureText, getVerticalMetrics } from '../fonts.mjs';
import { attrs, escapeXml, formatNumber } from '../svg.mjs';
import { TITLE, SUBTITLE, COLUMNS, LABEL_EXAMPLES } from '../info/content.mjs';

// ------------------------------------------------------------------

const EARTH_RADIUS_KM = 6371;
const CIRCLE_POINTS   = 72;
const JUMP_UNITS      = 4;   // a jump this long between circle points means it crosses a tear

// ------------------------------------------------------------------

// Splits text into lines no wider than widthMm
function wrapText(text, font, weight, sizeMm, widthMm) {
  const lines = [];
  let line = '';
  for (const word of text.split(/\s+/)) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && measureText(candidate, font, weight, sizeMm) > widthMm) {
      lines.push(line);
      line = word;
    }
    else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}

// Points of a circle of radiusKm around (lat, lon) on the sphere
function sphereCircle(lat, lon, radiusKm) {
  const angular = radiusKm / EARTH_RADIUS_KM;
  const lat1 = lat * Math.PI / 180;
  const lon1 = lon * Math.PI / 180;
  const points = [];
  for (let i = 0; i < CIRCLE_POINTS; i++) {
    const bearing = 2 * Math.PI * i / CIRCLE_POINTS;
    const lat2 = Math.asin(Math.sin(lat1) * Math.cos(angular) + Math.cos(lat1) * Math.sin(angular) * Math.cos(bearing));
    const lon2 = lon1 + Math.atan2(
      Math.sin(bearing) * Math.sin(angular) * Math.cos(lat1),
      Math.cos(angular) - Math.sin(lat1) * Math.sin(lat2),
    );
    points.push(new LatLon(lat2 * 180 / Math.PI, ((lon2 * 180 / Math.PI + 540) % 360) - 180));
  }
  return points;
}

// ------------------------------------------------------------------

export default {
  id     : 'infoPanel',
  space  : 'page',
  enabled: style => Boolean(style.infoPanel?.show),
  render : ctx => {

    const config = ctx.style.infoPanel;
    const labels = ctx.style.countryStats;
    const font = config.font;
    const left = ctx.mm(config.x);
    const top = ctx.mm(config.y);
    const columnWidth = ctx.mm(config.columnWidth);
    const columnGap = ctx.mm(config.columnGap);
    const titleSize = ctx.mm(config.titleSize);
    const subtitleSize = ctx.mm(config.subtitleSize);
    const headingSize = ctx.mm(config.headingSize);
    const bodySize = ctx.mm(config.bodySize);
    const lineHeight = config.lineHeight;
    const haloEm = config.haloWidthEm;

    [config.titleWeight, config.headingWeight, config.bodyWeight].forEach(weight => ctx.useFont(font, weight));
    ctx.useFont(labels.font, labels.nameWeight);
    ctx.useFont(labels.font, labels.statsWeight);

    const texts = [];
    const graphics = [];
    const boxes = [];

    // One line of text with its top edge at `y`; returns its height
    const addLine = (text, x, y, size, weight, { family = font, anchor = 'start' } = {}) => {
      const { ascender, descender } = getVerticalMetrics(family, weight);
      const box = size * lineHeight;
      const baseline = y + box / 2 + (ascender + descender) / 2 * size;
      const width = measureText(text, family, weight, size);
      texts.push(`<text${attrs({
        x              : x,
        y              : baseline,
        'font-family'  : family,
        'font-size'    : size,
        'font-weight'  : weight,
        'stroke-width' : haloEm * size,
        'text-anchor'  : anchor === 'start' ? undefined : anchor,
      })}>${escapeXml(text)}</text>`);
      const minX = anchor === 'middle' ? x - width / 2 : x;
      boxes.push({ minX, maxX: minX + width, minY: y, maxY: y + box });
      return box;
    };

    // - - - title - - -

    let y = top;
    y += addLine(TITLE, left, y, titleSize, config.titleWeight);
    y += addLine(SUBTITLE, left, y, subtitleSize, config.headingWeight);
    const columnsTop = y + ctx.mm(config.titleGap);

    // - - - the distortion map - - -

    const drawDistortion = (x, yTop, width) => {
      const scale = width / ctx.view.width;                 // mm per map unit
      const height = ctx.view.height * scale;
      const unit = mm => mm / scale;
      const transform = [
        `translate(${formatNumber(x, 6)} ${formatNumber(yTop, 6)})`,
        `scale(${formatNumber(scale, 8)})`,
        `translate(${formatNumber(-ctx.view.minX, 6)} ${formatNumber(-ctx.view.minY, 6)})`,
        `rotate(${formatNumber(ctx.view.tiltDeg, 6)})`,
      ].join(' ');

      const outline = generateMapOutline();
      const outlineD = 'M' + outline.map(point => `${formatNumber(point.x, 3)} ${formatNumber(point.y, 3)}`).join('L') + 'Z';
      const landD = ctx.data(ctx.style.land.data).map(([, multiPolygon]) => geoJsonToPathData(multiPolygon)).join('');

      // Circles of equal size on the globe; any that crosses a tear is left out
      const circles = [];
      // Rows alternate their longitudes, and the rows nearest the poles keep
      // only every other circle, so enlarged circles do not pile up there
      const { latitudes, lonStepDeg, sparseFromLat } = config.distortion;
      for (const [row, lat] of latitudes.entries()) {
        const step = Math.abs(lat) >= sparseFromLat ? 2 * lonStepDeg : lonStepDeg;
        const offset = row % 2 ? lonStepDeg / 2 : 0;
        for (let lon = -180 + offset + lonStepDeg / 4; lon < 180; lon += step) {
          const projected = sphereCircle(lat, lon, config.distortion.radiusKm).map(point => project(point));
          const crossesTear = projected.some((point, i) => {
            const next = projected[(i + 1) % projected.length];
            return Math.hypot(next.x - point.x, next.y - point.y) > JUMP_UNITS;
          });
          if (crossesTear) continue;
          circles.push('M' + projected.map(point => `${formatNumber(point.x, 3)} ${formatNumber(point.y, 3)}`).join('L') + 'Z');
        }
      }

      graphics.push(
        `<g${attrs({ transform })}>` +
        `<path${attrs({ d: outlineD, fill: config.distortion.oceanColor })}/>` +
        `<path${attrs({ d: landD, fill: config.distortion.landColor })}/>` +
        `<path${attrs({
          d               : circles.join(''),
          fill            : config.distortion.circleColor,
          stroke          : config.distortion.circleStroke,
          'stroke-width'  : unit(0.15),
        })}/>` +
        `<path${attrs({ d: outlineD, fill: 'none', stroke: config.distortion.edgeColor, 'stroke-width': unit(0.25) })}/>` +
        '</g>'
      );
      boxes.push({ minX: x, maxX: x + width, minY: yTop, maxY: yTop + height });
      return height;
    };

    // - - - the label key: real example labels, each with its explanation - - -

    const drawLabelKey = (x, yTop, width) => {
      const exampleWidth = ctx.mm(config.labelKey.exampleWidth);
      const textX = x + exampleWidth + ctx.mm('4mm');
      const textWidth = width - exampleWidth - ctx.mm('4mm');
      const nameSize = ctx.mm(labels.maxNameSize) * 0.5 + ctx.mm(labels.minNameSize) * 0.5;
      let cursor = yTop;

      for (const example of LABEL_EXAMPLES) {
        const lines = example.lines.map((text, index) => ({
          text,
          weight: index === 0 && !example.light ? labels.nameWeight : labels.statsWeight,
          size  : index === 0 ? nameSize : nameSize * labels.statsScale,
        }));
        const blockHeight = lines.reduce((sum, line) => sum + line.size * labels.lineHeight, 0);
        const explanation = wrapText(example.explain, font, config.bodyWeight, bodySize, textWidth);
        const explanationHeight = explanation.length * bodySize * lineHeight;
        const rowHeight = Math.max(blockHeight, explanationHeight);

        let lineTop = cursor + (rowHeight - blockHeight) / 2;
        for (const line of lines) {
          const { ascender, descender } = getVerticalMetrics(labels.font, line.weight);
          const box = line.size * labels.lineHeight;
          texts.push(`<text${attrs({
            x             : x + exampleWidth / 2,
            y             : lineTop + box / 2 + (ascender + descender) / 2 * line.size,
            'font-family' : labels.font,
            'font-size'   : line.size,
            'font-weight' : line.weight,
            'stroke-width': labels.haloWidthEm * line.size,
            'text-anchor' : 'middle',
          })}>${escapeXml(line.text)}</text>`);
          lineTop += box;
        }

        let textTop = cursor + (rowHeight - explanationHeight) / 2;
        for (const line of explanation) textTop += addLine(line, textX, textTop, bodySize, config.bodyWeight);

        boxes.push({ minX: x, maxX: x + exampleWidth, minY: cursor, maxY: cursor + rowHeight });
        cursor += rowHeight + ctx.mm(config.labelKey.rowGap);
      }
      return cursor - yTop;
    };

    // - - - the columns - - -

    COLUMNS.forEach((blocks, columnIndex) => {
      const x = left + columnIndex * (columnWidth + columnGap);
      let cursor = columnsTop;
      for (const block of blocks) {
        if (block.gap) cursor += ctx.mm(`${block.gap}mm`);
        if (block.heading) {
          cursor += addLine(block.heading, x, cursor, headingSize, config.headingWeight);
          cursor += ctx.mm(config.headingGap);
        }
        if (block.text) {
          for (const line of wrapText(block.text, font, config.bodyWeight, bodySize, columnWidth)) {
            cursor += addLine(line, x, cursor, bodySize, config.bodyWeight);
          }
        }
        if (block.distortion) cursor += drawDistortion(x, cursor, columnWidth);
        if (block.labelKey) cursor += drawLabelKey(x, cursor, columnWidth);
      }
    });

    // The panel must not cover labels placed earlier (small islands' names)
    const overlaps = (a, b) => a.minX < b.maxX && b.minX < a.maxX && a.minY < b.maxY && b.minY < a.maxY;
    const covered = ctx.labelBoxes.filter(other => boxes.some(box => overlaps(box, other)));
    if (covered.length) {
      ctx.notes.push(`infoPanel: WARNING covers ${covered.length} map label(s) at ` +
        covered.map(box => `(${((box.minX + box.maxX) / 2).toFixed(0)}, ${((box.minY + box.maxY) / 2).toFixed(0)})`).join(', '));
    }

    // ...nor any land, however small. Islands are tested by their bounding box
    // (they are specks); a large piece by its true outline, since the box of
    // a continent reaches far into open ocean.
    const coveredLand = [];
    const touchesOutline = (box, ring) => {
      const inBox = ([x, y]) => x > box.minX && x < box.maxX && y > box.minY && y < box.maxY;
      if (ring.some(inBox)) return true;
      const corners = [[box.minX, box.minY], [box.maxX, box.minY], [box.maxX, box.maxY], [box.minX, box.maxY]];
      return corners.some(([x, y]) => {
        let inside = false;
        for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
          const [x1, y1] = ring[i];
          const [x2, y2] = ring[j];
          if ((y1 > y) !== (y2 > y) && x < (x2 - x1) * (y - y1) / (y2 - y1) + x1) inside = !inside;
        }
        return inside;
      });
    };
    for (const [id, multiPolygon] of ctx.data(ctx.style.land.data)) {
      for (const polygon of multiPolygon) {
        const points = polygon[0].map(([lon, lat]) => ctx.toPage(project(new LatLon(lat, lon))));
        const xs = points.map(point => point[0]);
        const ys = points.map(point => point[1]);
        const bounds = { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
        const isSpeck = Math.hypot(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY) < 20;
        if (boxes.some(box => overlaps(box, bounds) && (isSpeck || touchesOutline(box, points)))) {
          coveredLand.push(`${id} (${((bounds.minX + bounds.maxX) / 2).toFixed(0)}, ${((bounds.minY + bounds.maxY) / 2).toFixed(0)})`);
        }
      }
    }
    if (coveredLand.length) {
      ctx.notes.push(`infoPanel: WARNING covers land: ${coveredLand.join(', ')}`);
    }

    ctx.labelBoxes.push(...boxes);
    const extent = boxes.reduce((all, box) => ({
      minX: Math.min(all.minX, box.minX), maxX: Math.max(all.maxX, box.maxX),
      minY: Math.min(all.minY, box.minY), maxY: Math.max(all.maxY, box.maxY),
    }), { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity });
    ctx.notes.push(
      `infoPanel: x ${extent.minX.toFixed(0)}..${extent.maxX.toFixed(0)} mm, ` +
      `y ${extent.minY.toFixed(0)}..${extent.maxY.toFixed(0)} mm`
    );

    return (
      graphics.join('') +
      `<g${attrs({
        id               : 'info-panel',
        fill             : config.color,
        stroke           : config.haloColor,
        'stroke-linejoin': 'round',
        'paint-order'    : 'stroke',
      })}>` +
      texts.join('') +
      '</g>'
    );
  },
};
