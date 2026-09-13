// ==================================================================
// VECTOR MAP LAYERS DRAWING ROUTINES
// ------------------------------------------------------------------

import { fGID, fQS, fCSVGE, getJson } from './globals.mjs';
import { MAP_VIEW_ORIGIN, MAP_WIDTH, MAP_HEIGHT, MAP_TILT_DEG } from './concialdi.mjs';
import {
  DEFAULT_GRATICULE_INTERVAL,
  geoJsonToPathData,
  pointListsToPathData,
  getPositionColor,
  generateGraticule,
  generateEquator,
  generatePolarTropicCircles,
  generateMapOutline,
} from './map-geometry.mjs';

// ------------------------------------------------------------------

let VectorMapIsInit = false;

// ------------------------------------------------------------------

export function initVectorMap() {
  if (VectorMapIsInit) return;
  VectorMapIsInit = true;
  fQS('svg').setAttribute('viewBox', `${-MAP_VIEW_ORIGIN.x} ${-MAP_VIEW_ORIGIN.y} ${MAP_WIDTH} ${MAP_HEIGHT}`);
  fGID('svg-map-wrapper').setAttribute('transform', `rotate(${MAP_TILT_DEG})`);
}

// ------------------------------------------------------------------

export function drawVectorMap() {
  initVectorMap();
  drawBackground();
  drawGraticule(10);
  drawSpecialCircles();
  drawCountries();
  drawBoundaries();
}

// ------------------------------------------------------------------

// Create an SVG path element with the given path data
function createPath(pathData) {
  const path = fCSVGE('path');
  path.setAttribute('d', pathData);
  return path;
}

// ------------------------------------------------------------------

function drawCountries() {
  getJson('ne-country-areas.json').then(countries => {
    countries.forEach(country => {

      const path = createPath(geoJsonToPathData(country[1]));
      path.id = 'iso-' + country[0];
      path.onmouseover = () => {
        fGID('annotation').innerHTML = country[0];
      };

      const [red, green, blue] = getPositionColor(country[1]);
      const rgb = `rgb(${red},${green},${blue})`;
      path.setAttribute('fill'  , rgb);
      path.setAttribute('stroke', rgb);

      fGID('countries').appendChild(path);
    });
  });
}

// ------------------------------------------------------------------

function drawBoundaries() {
  getJson('ne-boundaries.json').then(boundaries => {
    boundaries.forEach(boundary => {
      const path = createPath(geoJsonToPathData(boundary[1]));
      if (!boundary[0]) path.classList.add('disputed');
      fGID('boundaries').appendChild(path);
    });
  });
}

// ------------------------------------------------------------------

export function drawGraticule(interval = DEFAULT_GRATICULE_INTERVAL) {
  const path = createPath(pointListsToPathData(generateGraticule(interval), false));
  fGID('graticule').appendChild(path);
}

// ------------------------------------------------------------------

// Draws the equator, tropic circles, and polar circles
export function drawSpecialCircles() {

  let path;

  // Draw equator
  path = createPath(pointListsToPathData(generateEquator(), false));
  path.classList.add('equator');
  fGID('circles').appendChild(path);

  // Draw tropic and polar circles
  path = createPath(pointListsToPathData(generatePolarTropicCircles(), false));
  path.classList.add('polar-tropic');
  fGID('circles').appendChild(path);
}

// ------------------------------------------------------------------

// Draw the map background/outline
function drawBackground() {
  fGID('background').setAttribute('d', pointListsToPathData([generateMapOutline()], false));
}
