// Sweeps the solver's weights and schedule to find a setting that actually
// beats the greedy placer: zero overlaps first, then as few labels outside
// their country as possible, then the largest mean size.
// Usage: node out/sweep-solver.mjs

import { buildLabelSet } from './label-fixture.mjs';
import { solveLabels } from '../print/labels/solver.mjs';

const PT = 25.4 / 72;

const { labels, start } = await buildLabelSet();
console.log(`${labels.length} labels\n`);

const base = solveLabels(labels, start, { iterations: 0 }).stats;
console.log(`start: ${base.overlapping} overlapping, ${base.outside} outside, ` +
  `mean ${(base.meanSize / PT).toFixed(1)} pt\n`);

const GRID = [];
for (const iterations of [300000, 2000000]) {
  for (const startTemp of [6, 2]) {
    for (const weightInside of [3, 12]) {
      for (const weightOverlap of [8, 30]) {
        GRID.push({ iterations, startTemp, weightInside, weightOverlap });
      }
    }
  }
}

const results = [];
for (const options of GRID) {
  const startedAt = Date.now();
  const { stats } = solveLabels(labels, start, options);
  results.push({
    ...options,
    ...stats,
    seconds: (Date.now() - startedAt) / 1000,
  });
  process.stdout.write('.');
}
console.log('\n');

results.sort((a, b) =>
  a.overlapping - b.overlapping ||
  a.outside - b.outside ||
  b.meanSize - a.meanSize
);

console.log('iters   temp  inside  overlap | overlapping  outside  mean pt  seconds');
for (const row of results) {
  console.log(
    `${String(row.iterations).padStart(7)} ${String(row.startTemp).padStart(5)} ` +
    `${String(row.weightInside).padStart(7)} ${String(row.weightOverlap).padStart(8)} | ` +
    `${String(row.overlapping).padStart(11)} ${String(row.outside).padStart(8)} ` +
    `${(row.meanSize / PT).toFixed(1).padStart(8)} ${row.seconds.toFixed(1).padStart(8)}`
  );
}
