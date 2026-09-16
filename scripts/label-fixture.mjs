// Builds the real country label set for solver experiments: texts in the
// gdp-middle layout with ISO3 codes and whole numbers, measured block sizes,
// a signed distance field per country, and a starting pose at the country's
// interior point. Shared by the bench and the weight sweep.

import '../print/setup.mjs';
import polylabel from 'polylabel';
import { loadStyle } from '../print/styles.mjs';
import { createContext } from '../print/context.mjs';
import { measureText } from '../print/fonts.mjs';
import { buildSdf } from '../print/labels/sdf.mjs';
import { getBox, getPenetration, getOutsideCost } from '../print/labels/solver.mjs';
import { LatLon } from '../data-types.mjs';
import { project } from '../concialdi.mjs';

const MAGNITUDES = [[1e12, 'T'], [1e9, 'B'], [1e6, 'M'], [1e3, 'K']];

const compact = (value, prefix = '') => {
  const [divisor, suffix] = MAGNITUDES.find(([magnitude]) => value >= magnitude) ?? [1, ''];
  return prefix + String(Math.round(value / divisor)) + suffix;
};

// Shoelace area of a ring in page mm
const ringArea = ring => {
  let doubled = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    doubled += ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
  }
  return Math.abs(doubled) / 2;
};

export async function buildLabelSet(styleName = 'geo-stats-nov') {

  const style = await loadStyle(styleName);
  const ctx = createContext(style);
  const config = style.countryStats;
  const stats = ctx.data(config.data).countries;
  const areas = ctx.data(style.land.data);

  const minSize = ctx.mm(config.minNameSize);
  const maxSize = ctx.mm(config.maxNameSize);
  const margin = ctx.mm('0.35mm');

  const labels = [];
  const start = [];

  for (const [id, multiPolygon] of areas) {

    const entry = stats[id];
    if (!entry) continue;

    let best = null;
    for (const polygon of multiPolygon) {
      const rings = polygon.map(ring => ring.map(([lon, lat]) => ctx.toPage(project(new LatLon(lat, lon)))));
      const area = ringArea(rings[0]);
      if (!best || area > best.area) best = { rings, area };
    }
    if (!best || best.area < 1) continue;

    const code = entry.iso3 ?? entry.name;
    const population = entry.population && compact(entry.population.value);
    const gdp = entry.gdpUsd && compact(entry.gdpUsd.value, '$');
    const perCapita = entry.gdpPerCapitaUsd && compact(entry.gdpPerCapitaUsd.value, '$');
    const lines = [
      { text: population ? `${code}/${population}` : code, weight: config.nameWeight, scale: 1 },
      gdp       && { text: gdp      , weight: config.statsWeight, scale: config.statsScale },
      perCapita && { text: perCapita, weight: config.statsWeight, scale: config.statsScale },
    ].filter(Boolean);

    const unitWidth = Math.max(...lines.map(line => measureText(line.text, config.font, line.weight, line.scale))) / config.fill;
    const unitHeight = lines.reduce((sum, line) => sum + line.scale * config.lineHeight, 0) / config.fill;

    const pole = polylabel(best.rings, 0.25);
    const sdf = buildSdf(best.rings, { cellMm: 0.4, padMm: 6 });

    labels.push({
      id, lines, unitWidth, unitHeight, minSize, maxSize, margin, sdf,
      anchor: [pole[0], pole[1]],
      roamMm: Math.max(1, pole.distance),
      weight: 1,
    });

  }

  // A feasible starting arrangement, which is what the solver needs to improve
  // on rather than dig out of: biggest countries first, each label as large as
  // fits inside its own shape without touching one already placed. A label that
  // cannot fit inside even at the minimum size is pushed outward on a spiral
  // until it is clear - that is what a leader line would later point at.
  const order = labels.map((label, index) => index).sort((a, b) => labels[b].roamMm - labels[a].roamMm);
  const placedBoxes = [];
  const poses = new Array(labels.length);

  const clashes = box => placedBoxes.some(other => getPenetration(box, other) > 0.01);

  for (const index of order) {
    const label = labels[index];
    let chosen = null;

    for (let size = label.maxSize; size >= label.minSize; size *= 0.9) {
      const pose = { x: label.anchor[0], y: label.anchor[1], theta: 0, size };
      const box = getBox(label, pose);
      if (getOutsideCost(label, box) <= 0 && !clashes(box)) {
        chosen = pose;
        break;
      }
    }

    if (!chosen) {
      chosen = { x: label.anchor[0], y: label.anchor[1], theta: 0, size: label.minSize };
      for (let step = 0; step < 300 && clashes(getBox(label, chosen)); step++) {
        const angle = step * 2.399963;              // golden angle, so the spiral does not repeat
        const radius = 1.2 * Math.sqrt(step + 1);
        chosen.x = label.anchor[0] + Math.cos(angle) * radius;
        chosen.y = label.anchor[1] + Math.sin(angle) * radius;
      }
    }

    poses[index] = chosen;
    placedBoxes.push(getBox(label, chosen));
  }

  return { labels, start: poses, ctx, config, minSize, maxSize };
}
