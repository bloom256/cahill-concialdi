// ==================================================================
// JOINT LABEL PLACEMENT (CONTINUOUS POSE OPTIMIZATION)
// ------------------------------------------------------------------

// Places every label at once instead of one country at a time. Each label has
// a continuous pose - x, y, rotation - plus a font size, so the map is roughly
// a thousand continuous variables. One energy scores the whole arrangement:
//
//   - size        reward for large labels (the point of the exercise)
//   - containment penalty when a label's rectangle leaves its own country,
//                 read from that country's signed distance field
//   - separation  penalty for the penetration depth of any two labels
//   - tilt        gentle cost on rotation, so text stays readable
//   - attachment  cost for drifting away from the country's interior point;
//                 a label that ends up outside is what later draws a leader line
//
// Simulated annealing moves poses, with the step size falling on the schedule,
// then a zero-temperature polish. The greedy placement is the starting point,
// the random stream is seeded, so a given input always gives the same map.

import { sampleSdf } from './sdf.mjs';

// ------------------------------------------------------------------

const DEFAULTS = {
  iterations     : 300000,   // 2M was measured as no better, and 7x slower
  startTemp      : 2,
  endTemp        : 0.02,
  polishFraction : 0.15,   // share of the run spent at zero temperature
  gridMm         : 12,     // broad-phase cell for neighbour lookup
  seed           : 20260916,
  rejectOverlap  : true,   // overlap is a constraint, not a price worth paying
  swapFraction   : 0.15,   // share of moves that exchange two neighbours' places

  weightSize     : 1.0,    // per label, on size relative to its maximum
  weightInside   : 12.0,   // per mm^2 of rectangle outside its country (swept)
  weightOverlap  : 8.0,    // per mm^2 of penetration between two labels
  weightTilt     : 0.35,   // at 90 degrees, relative to a full-size label
  weightAttach   : 0.8,    // per mm^2 of drift beyond the country's roam radius

  stepMm         : 6,      // initial position step; scaled by temperature
  stepDeg        : 25,     // initial rotation step
  stepSize       : 0.12,   // initial relative size step
};

// ------------------------------------------------------------------

// Small, fast, seeded generator: the same seed must always give the same map
function makeRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Box-Muller, good enough for proposal noise
function makeGaussian(random) {
  return () => {
    const u = Math.max(1e-12, random());
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * random());
  };
}

// ------------------------------------------------------------------

// A label's rectangle as center, half extents and its two axis directions
export function getBox(label, pose) {
  const angle = pose.theta * Math.PI / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return {
    x      : pose.x,
    y      : pose.y,
    halfW  : label.unitWidth  * pose.size / 2,
    halfH  : label.unitHeight * pose.size / 2,
    axisX  : [cos, sin],
    axisY  : [-sin, cos],
  };
}

// Axis-aligned bounds of a rotated box, for broad-phase tests
export function getBounds(box) {
  const spanX = Math.abs(box.axisX[0]) * box.halfW + Math.abs(box.axisY[0]) * box.halfH;
  const spanY = Math.abs(box.axisX[1]) * box.halfW + Math.abs(box.axisY[1]) * box.halfH;
  return { minX: box.x - spanX, maxX: box.x + spanX, minY: box.y - spanY, maxY: box.y + spanY };
}

// The four corners of a rotated box
function getCorners(box) {
  const [ux, uy] = box.axisX;
  const [vx, vy] = box.axisY;
  const dx = ux * box.halfW;
  const dy = uy * box.halfW;
  const ex = vx * box.halfH;
  const ey = vy * box.halfH;
  return [
    [box.x - dx - ex, box.y - dy - ey],
    [box.x + dx - ex, box.y + dy - ey],
    [box.x + dx + ex, box.y + dy + ey],
    [box.x - dx + ex, box.y - dy + ey],
  ];
}

// Penetration depth of two rotated boxes (separating axis theorem): 0 when
// they are disjoint, otherwise the smallest overlap across the four axes
export function getPenetration(a, b) {
  const deltaX = b.x - a.x;
  const deltaY = b.y - a.y;
  let smallest = Infinity;

  for (const axis of [a.axisX, a.axisY, b.axisX, b.axisY]) {
    const [ax, ay] = axis;
    const distance = Math.abs(deltaX * ax + deltaY * ay);
    const reachA = Math.abs(a.axisX[0] * ax + a.axisX[1] * ay) * a.halfW +
                   Math.abs(a.axisY[0] * ax + a.axisY[1] * ay) * a.halfH;
    const reachB = Math.abs(b.axisX[0] * ax + b.axisX[1] * ay) * b.halfW +
                   Math.abs(b.axisY[0] * ax + b.axisY[1] * ay) * b.halfH;
    const overlap = reachA + reachB - distance;
    if (overlap <= 0) return 0;
    if (overlap < smallest) smallest = overlap;
  }
  return smallest;
}

// ------------------------------------------------------------------

// How far the label's rectangle sticks out of its own country, as an area-like
// quantity: the field is sampled at the corners, the edge midpoints and the
// center, and every sample that is not at least `margin` inside is charged.
const SAMPLE_WEIGHTS   = 9;
const SOFT_MM          = 1;     // containment cost turns linear beyond this depth
const OVERLAP_EPSILON  = 0.01;  // mm of penetration treated as touching, not overlapping

export function getOutsideCost(label, box) {
  if (!label.sdf) return 0;

  const corners = getCorners(box);
  let cost = 0;
  let samples = 0;

  // Huber cost: quadratic for the first millimetre outside, linear after that.
  // A label on the wrong continent must be expensive, but not so expensive
  // that it drowns out every other term in the map.
  const charge = (x, y) => {
    const depth = label.margin - sampleSdf(label.sdf, x, y);
    if (depth > 0) cost += depth <= SOFT_MM ? depth * depth : SOFT_MM * (2 * depth - SOFT_MM);
    samples++;
  };

  charge(box.x, box.y);
  for (let i = 0; i < 4; i++) {
    const [x1, y1] = corners[i];
    const [x2, y2] = corners[(i + 1) % 4];
    charge(x1, y1);
    charge((x1 + x2) / 2, (y1 + y2) / 2);
  }
  return cost * (SAMPLE_WEIGHTS / samples);
}

// ------------------------------------------------------------------

// Uniform grid over label bounds, so a move only tests nearby labels
class Grid {

  constructor(cellMm) {
    this.cellMm = cellMm;
    this.cells = new Map();
  }

  // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

  keysFor(bounds) {
    const keys = [];
    const minCol = Math.floor(bounds.minX / this.cellMm);
    const maxCol = Math.floor(bounds.maxX / this.cellMm);
    const minRow = Math.floor(bounds.minY / this.cellMm);
    const maxRow = Math.floor(bounds.maxY / this.cellMm);
    for (let col = minCol; col <= maxCol; col++) {
      for (let row = minRow; row <= maxRow; row++) keys.push(col + ':' + row);
    }
    return keys;
  }

  // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

  insert(index, bounds) {
    for (const key of this.keysFor(bounds)) {
      if (!this.cells.has(key)) this.cells.set(key, new Set());
      this.cells.get(key).add(index);
    }
  }

  // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

  remove(index, bounds) {
    for (const key of this.keysFor(bounds)) this.cells.get(key)?.delete(index);
  }

  // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

  near(bounds, skipIndex) {
    const found = new Set();
    for (const key of this.keysFor(bounds)) {
      const cell = this.cells.get(key);
      if (!cell) continue;
      for (const index of cell) if (index !== skipIndex) found.add(index);
    }
    return found;
  }
}

// ------------------------------------------------------------------

// Places every label. `labels` carry their geometry and limits; `start` the
// initial poses (from the greedy placement). Returns the poses and a report.
export function solveLabels(labels, start, options = {}) {

  const settings = { ...DEFAULTS, ...options };
  const random = makeRandom(settings.seed);
  const gaussian = makeGaussian(random);

  const poses = start.map(pose => ({ ...pose }));
  const boxes = labels.map((label, index) => getBox(label, poses[index]));
  const bounds = boxes.map(getBounds);

  const grid = new Grid(settings.gridMm);
  bounds.forEach((box, index) => grid.insert(index, box));

  // Energy of one label on its own: size reward, containment, tilt, drift
  const selfEnergy = (index, pose, box) => {
    const label = labels[index];
    const sizeTerm = -settings.weightSize * (pose.size / label.maxSize) * label.weight;
    const insideTerm = settings.weightInside * getOutsideCost(label, box);
    const tiltTerm = settings.weightTilt * (pose.theta / 90) * (pose.theta / 90) * label.weight;
    const drift = Math.hypot(pose.x - label.anchor[0], pose.y - label.anchor[1]) - label.roamMm;
    const attachTerm = drift > 0 ? settings.weightAttach * drift * drift : 0;
    return sizeTerm + insideTerm + tiltTerm + attachTerm;
  };

  // Energy between one label and its neighbours
  const pairEnergy = (index, box, aabb) => {
    let total = 0;
    for (const other of grid.near(aabb, index)) {
      const depth = getPenetration(box, boxes[other]);
      if (depth > 0) total += settings.weightOverlap * depth * depth;
    }
    return total;
  };

  const energyAt = (index, pose) => {
    const box = getBox(labels[index], pose);
    const aabb = getBounds(box);
    return { energy: selfEnergy(index, pose, box) + pairEnergy(index, box, aabb), box, aabb };
  };

  let total = 0;
  for (let index = 0; index < labels.length; index++) {
    total += selfEnergy(index, poses[index], boxes[index]);
    total += pairEnergy(index, boxes[index], bounds[index]) / 2;
  }

  // Energy of one label as it currently stands: its own terms plus its share
  // of any collisions
  const localEnergy = index =>
    selfEnergy(index, poses[index], boxes[index]) + pairEnergy(index, boxes[index], bounds[index]);

  // Moves a label, keeping the broad-phase grid in step
  const applyPose = (index, pose) => {
    const box = getBox(labels[index], pose);
    const aabb = getBounds(box);
    grid.remove(index, bounds[index]);
    poses[index] = pose;
    boxes[index] = box;
    bounds[index] = aabb;
    grid.insert(index, aabb);
  };

  // Puts a label back exactly as it was, for a rejected swap
  const restore = (index, saved) => {
    grid.remove(index, bounds[index]);
    poses[index] = saved.pose;
    boxes[index] = saved.box;
    bounds[index] = saved.aabb;
    grid.insert(index, saved.aabb);
  };

  const overlapsAny = index => {
    for (const other of grid.near(bounds[index], index)) {
      if (getPenetration(boxes[index], boxes[other]) > OVERLAP_EPSILON) return true;
    }
    return false;
  };

  // - - - annealing - - -

  const polishFrom = Math.floor(settings.iterations * (1 - settings.polishFraction));
  const cooling = Math.log(settings.endTemp / settings.startTemp);
  let accepted = 0;

  for (let step = 0; step < settings.iterations; step++) {

    const progress = step / settings.iterations;
    const isPolishing = step >= polishFrom;
    const temperature = isPolishing ? 0 : settings.startTemp * Math.exp(cooling * progress);
    const scale = isPolishing ? 0.15 : Math.max(0.15, 1 - progress);

    // A swap exchanges two neighbours' places. Single moves alone leave the
    // map frozen: a label cannot grow while its neighbour sits in the way, and
    // one move can never shift both.
    if (settings.swapFraction && random() < settings.swapFraction) {

      const first = Math.floor(random() * labels.length);
      const neighbours = [...grid.near(bounds[first], first)];
      if (!neighbours.length) continue;
      const second = neighbours[Math.floor(random() * neighbours.length)];

      // Each label keeps its own size and takes the other's position and angle
      const poseFirst = { x: poses[second].x, y: poses[second].y, theta: poses[second].theta, size: poses[first].size };
      const poseSecond = { x: poses[first].x, y: poses[first].y, theta: poses[first].theta, size: poses[second].size };

      const savedFirst = { pose: poses[first], box: boxes[first], aabb: bounds[first] };
      const savedSecond = { pose: poses[second], box: boxes[second], aabb: bounds[second] };
      const before = localEnergy(first) + localEnergy(second);

      applyPose(first, poseFirst);
      applyPose(second, poseSecond);

      const feasible = !settings.rejectOverlap || (!overlapsAny(first) && !overlapsAny(second));
      const delta = localEnergy(first) + localEnergy(second) - before;

      if (feasible && (delta <= 0 || (temperature > 0 && random() < Math.exp(-delta / temperature)))) {
        total += delta;
        accepted++;
      }
      else {
        restore(first, savedFirst);
        restore(second, savedSecond);
      }
      continue;
    }

    const index = Math.floor(random() * labels.length);
    const label = labels[index];
    const current = poses[index];

    const proposal = {
      x    : current.x + gaussian() * settings.stepMm * scale,
      y    : current.y + gaussian() * settings.stepMm * scale,
      theta: current.theta + gaussian() * settings.stepDeg * scale,
      size : current.size * Math.exp(gaussian() * settings.stepSize * scale),
    };
    proposal.theta = Math.max(-90, Math.min(90, proposal.theta));
    proposal.size = Math.max(label.minSize, Math.min(label.maxSize, proposal.size));

    const before = energyAt(index, current);
    const after = energyAt(index, proposal);

    // Overlap is a constraint: a move that makes two labels collide is not
    // weighed against the size reward, it is simply refused
    if (settings.rejectOverlap) {
      let worst = 0;
      for (const other of grid.near(after.aabb, index)) {
        const depth = getPenetration(after.box, boxes[other]);
        if (depth > worst) worst = depth;
      }
      if (worst > OVERLAP_EPSILON) continue;
    }

    const delta = after.energy - before.energy;

    if (delta <= 0 || (temperature > 0 && random() < Math.exp(-delta / temperature))) {
      applyPose(index, proposal);
      total += delta;
      accepted++;
    }
  }

  // - - - report - - -

  let overlapping = 0;
  let outside = 0;
  for (let index = 0; index < labels.length; index++) {
    if (getOutsideCost(labels[index], boxes[index]) > 0) outside++;
    for (const other of grid.near(bounds[index], index)) {
      if (other > index && getPenetration(boxes[index], boxes[other]) > OVERLAP_EPSILON) overlapping++;
    }
  }

  return {
    poses,
    stats: {
      energy    : total,
      accepted,
      iterations: settings.iterations,
      overlapping,
      outside,
      meanSize  : poses.reduce((sum, pose) => sum + pose.size, 0) / poses.length,
    },
  };
}
