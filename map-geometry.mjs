// ==================================================================
// VECTOR MAP GEOMETRY (DOM-FREE)
// ------------------------------------------------------------------

// Pure functions that generate projected geometry, SVG path data, and colors
// for the vector map layers. Shared by the web app (map-vector.mjs) and the
// Node print renderer (print/), so both always draw identical shapes.

import { EARTH_TILT, MAX_COLOR_VALUE, DEGS_IN_CIRCLE } from './globals.mjs';
import { LatLon } from './data-types.mjs';
import { MAP_AREAS, project } from './concialdi.mjs';

// ------------------------------------------------------------------

// Graticule interval values in degrees
export const DEFAULT_GRATICULE_INTERVAL = 15;
const VALID_GRATICULE_INTERVALS = [1, 2, 5, 10, 15, 20, 30];

// ------------------------------------------------------------------

// Convert GeoJSON LineString or MultiPolygon coordinates to SVG path data,
// doing projection along the way
export function geoJsonToPathData(geoJson) {
  const isMultiPolygon = typeof geoJson[0][0] !== 'number';
  const lineStrings = isMultiPolygon ? [].concat(...geoJson) : [geoJson];
  return lineStrings
    .map(lineString =>
      lineString
        .map(lonLat => project(new LatLon(lonLat[1], lonLat[0])))
        .map((point, idx) => (idx ? 'L' : 'M') + point.toString())
        .join('') + (isMultiPolygon ? 'z' : '')
    )
    .join('');
}

// ------------------------------------------------------------------

// Convert a list of list of Point objects to SVG path data
export function pointListsToPathData(pointLists, isClosed) {
  return pointLists
    .map(list =>
      list.map((point, idx) => (idx ? 'L' : 'M') + point.toString()).join('') +
      (isClosed ? 'z' : '')
    )
    .join('');
}

// ------------------------------------------------------------------

// Compute a country's [red, green, blue] fill color based on its position,
// where the average of the country's coordinates is a proxy for position
export function getPositionColor(multiPolygon) {
  const flatLonLatList = [].concat(...[].concat(...multiPolygon));
  const numCoords = flatLonLatList.length;
  const sumLat = flatLonLatList.reduce((sum, lonLat) => sum + lonLat[1], 0);
  const sumLon = flatLonLatList.reduce((sum, lonLat) => sum + lonLat[0], 0);
  let red   = MAX_COLOR_VALUE/2 * (1 + sumLat / numCoords / (DEGS_IN_CIRCLE/4));
  let green = MAX_COLOR_VALUE/2 * (1 + sumLon / numCoords / (DEGS_IN_CIRCLE/2));
  let blue  = MAX_COLOR_VALUE - (red + green)/2;
  red   = Math.min(MAX_COLOR_VALUE, red  *1.25);
  green = Math.min(MAX_COLOR_VALUE, green*1.25);
  blue  = Math.min(MAX_COLOR_VALUE, blue *1.25);
  return [red, green, blue];
}

// ------------------------------------------------------------------

// Generate the graticule as a list of lists of Point objects
export function generateGraticule(interval = DEFAULT_GRATICULE_INTERVAL) {

  if (!VALID_GRATICULE_INTERVALS.includes(interval)) interval = DEFAULT_GRATICULE_INTERVAL;

  const pointLists = [];
  MAP_AREAS.forEach((area, idx) => {

    let points;

    let endLon = area.neCorner.lon;
    if (area.hasAntimeridian) endLon += DEGS_IN_CIRCLE;

    // Generate latitude lines
    for (
      let lat = Math.ceil (area.swCorner.lat/interval)*interval;
      lat <=    Math.floor(area.neCorner.lat/interval)*interval;
      lat += interval
    ) {
      points = [];
      for (let lon = area.swCorner.lon; lon <= endLon; lon++) {
        points.push(project(new LatLon(lat, lon), idx));
      }
      if (area.swCorner.lon % 1 !== endLon % 1) {
        // Account for the half-degree cut along the Bering Strait
        points.push(project(new LatLon(lat, endLon), idx));
      }
      pointLists.push(points);
    }

    // Generate longitude lines
    for (
      let lon = Math.ceil (area.swCorner.lon/interval)*interval;
      lon <=    Math.floor(endLon           /interval)*interval;
      lon += interval
    ) {
      points = [];
      for (let lat = area.swCorner.lat; lat <= area.neCorner.lat; lat++) {
        points.push(project(new LatLon(lat, lon), idx));
      }
      pointLists.push(points);
    }
  });

  return pointLists;
}

// ------------------------------------------------------------------

// Generate the equator as a list of lists of Point objects
export function generateEquator() {

  const pointLists = [];
  let points;

  points = [];
  points.push(project(MAP_AREAS[0].swCorner));
  points.push(project(MAP_AREAS[1].swCorner));
  points.push(project(MAP_AREAS[2].swCorner));
  points.push(project(MAP_AREAS[3].swCorner));
  points.push(project(MAP_AREAS[4].swCorner));
  points.push(project(MAP_AREAS[0].swCorner, 4));
  pointLists.push(points);
  points = [];
  points.push(project(new LatLon(0, MAP_AREAS[5].swCorner.lon), 5));
  points.push(project(MAP_AREAS[5].neCorner));
  pointLists.push(points);
  points = [];
  points.push(project(MAP_AREAS[4].swCorner));
  points.push(project(MAP_AREAS[11].neCorner, 11));
  pointLists.push(points);

  return pointLists;
}

// ------------------------------------------------------------------

// Generate the tropic and polar circles as a list of lists of Point objects
export function generatePolarTropicCircles() {

  const pointLists = [];
  let points;

  // Generate Tropic of Cancer and Arctic Circle
  [EARTH_TILT, DEGS_IN_CIRCLE/4 - EARTH_TILT].forEach(lat => {
    points = [project(new LatLon(lat, MAP_AREAS[0].swCorner.lon))];
    for (let lon = Math.trunc(MAP_AREAS[0].swCorner.lon); lon < MAP_AREAS[4].neCorner.lon + DEGS_IN_CIRCLE; lon++) {
      points.push(project(new LatLon(lat, lon)));
    }
    points.push(project(new LatLon(lat, MAP_AREAS[4].neCorner.lon), 4));
    pointLists.push(points);
  });

  // Generate Tropic of Capricorn
  points = [];
  for (let lon = MAP_AREAS[5].swCorner.lon; lon <= MAP_AREAS[6].neCorner.lon; lon++) {
    points.push(project(new LatLon(-EARTH_TILT, lon)));
  }
  pointLists.push(points);
  points = [];
  for (let lon = MAP_AREAS[8].swCorner.lon; lon <= MAP_AREAS[8].neCorner.lon; lon++) {
    points.push(project(new LatLon(-EARTH_TILT, lon), 8));
  }
  pointLists.push(points);
  points = [];
  for (let lon = MAP_AREAS[10].swCorner.lon; lon <= MAP_AREAS[11].neCorner.lon + DEGS_IN_CIRCLE; lon++) {
    points.push(project(new LatLon(-EARTH_TILT, lon), points.length === 0 ? 10 : undefined));
  }
  pointLists.push(points);

  // Generate Antarctic Circle
  points = [];
  for (let lon = MAP_AREAS[5].swCorner.lon; lon <= MAP_AREAS[7].neCorner.lon; lon++) {
    points.push(project(new LatLon(-DEGS_IN_CIRCLE/4 + EARTH_TILT, lon)));
  }
  pointLists.push(points);
  points = [];
  for (let lon = MAP_AREAS[9].swCorner.lon; lon <= MAP_AREAS[11].neCorner.lon + DEGS_IN_CIRCLE; lon++) {
    points.push(project(new LatLon(-DEGS_IN_CIRCLE/4 + EARTH_TILT, lon), points.length === 0 ? 9 : undefined));
  }
  pointLists.push(points);

  return pointLists;
}

// ------------------------------------------------------------------

// Generate the map background/outline as a list of Point objects
export function generateMapOutline() {

  const points = [];
  points.push(project(new LatLon(MAP_AREAS[5].neCorner.lat, MAP_AREAS[5].swCorner.lon), 5));
  for (let lat = 0; lat >= -DEGS_IN_CIRCLE/4; lat--) {
    points.push(project(new LatLon(lat, MAP_AREAS[5].swCorner.lon), 5));
  }
  for (let lon = MAP_AREAS[7].neCorner.lon; lon >= MAP_AREAS[7].swCorner.lon; lon--) {
    points.push(project(new LatLon(MAP_AREAS[7].neCorner.lat, lon)));
  }
  points.push(project(MAP_AREAS[6].neCorner, 6));
  for (let lon = MAP_AREAS[8].swCorner.lon; lon <= MAP_AREAS[8].neCorner.lon; lon++) {
    points.push(project(new LatLon(MAP_AREAS[8].swCorner.lat, lon), 8));
  }
  points.push(project(MAP_AREAS[8].neCorner));
  for (let lon = MAP_AREAS[9].neCorner.lon; lon >= MAP_AREAS[9].swCorner.lon; lon--) {
    points.push(project(new LatLon(MAP_AREAS[9].neCorner.lat, lon), 9));
  }
  for (let lat = -DEGS_IN_CIRCLE/4; lat <= 0; lat++) {
    points.push(project(new LatLon(lat, MAP_AREAS[11].neCorner.lon), 11));
  }
  points.push(project(MAP_AREAS[10].neCorner));
  for (let lat = 0; lat < DEGS_IN_CIRCLE/4; lat++) {
    points.push(project(new LatLon(lat, MAP_AREAS[4].neCorner.lon), 4));
  }
  for (let lat = DEGS_IN_CIRCLE/4; lat >= 0; lat--) {
    points.push(project(new LatLon(lat, MAP_AREAS[0].swCorner.lon)));
  }
  points.push(project(MAP_AREAS[5].neCorner));

  return points;
}
