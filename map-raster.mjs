// ==================================================================
// RASTER MAP DRAWING ROUTINES
// ------------------------------------------------------------------

import { fQS, MAX_COLOR_VALUE, DEGS_IN_CIRCLE, deg2Rad, SVG_NS } from './globals.mjs';
import { Point } from './data-types.mjs';
import { MAP_VIEW_ORIGIN, MAP_WIDTH, MAP_HEIGHT, MAP_TILT } from './concialdi.mjs';
import { forEachMapCell } from './map-raster-geometry.mjs';
import { initVectorMap, drawGraticule, drawSpecialCircles } from "./map-vector.mjs";
import { getSunLatLon } from './solar-position.mjs';

// ------------------------------------------------------------------

// Channels in Canvas data: RGBA
const NUM_CANVAS_DATA_CHANNELS = 4;

// Filenames of the source raster maps in plate carrée projection.
const NE_I_FILENAME       = 'ne-i.jpg';
const NE_HYPSO_FILENAME   = 'ne-hypso.jpg';
const NASA_BLUE_FILENAME  = 'nasa-blue-marble-ng.jpg';
const NASA_BLACK_FILENAME = 'nasa-black-marble.jpg';

// Source raster maps' pixels per degree measure.
// Note: All maps are expected to have 3600×1800 dimensions.
const SOURCE_RASTER_PPD = 10;

// HiDPI factor: Canvas dimensions will be upscaled by this factor
const CANVAS_PIXEL_DENSITY = 2;

// Min-max distance of the solar terminator in radians from the solar position;
// interval is used for terminator "blurring"
const MIN_TERMINATOR_DISTANCE = deg2Rad(89);
const MAX_TERMINATOR_DISTANCE = deg2Rad(92);

// ------------------------------------------------------------------

// Declare available raster map styles (data type and instances)

class RasterStyle {
  constructor(filenames, isDayNight, graticuleColor) {
    this.filenames = filenames;
    this.isDayNight = isDayNight;
    this.graticuleColor = graticuleColor;
  }
}

export const [
  RASTER_NE_I,
  RASTER_NE_HYPSO,
  RASTER_NASA_BLUE,
  RASTER_NASA_BLACK,
  RASTER_NE_I_DAY_NIGHT,
  RASTER_NE_HYPSO_DAY_NIGHT,
  RASTER_NASA_DAY_NIGHT,
] = [
  [[NE_I_FILENAME                          ], false, '#0002'],
  [[NE_HYPSO_FILENAME                      ], false, '#0002'],
  [[NASA_BLUE_FILENAME                     ], false, '#fff3'],
  [[NASA_BLACK_FILENAME                    ], false, '#fff3'],
  [[NE_I_FILENAME                          ], true , '#0002'],
  [[NE_HYPSO_FILENAME                      ], true , '#0002'],
  [[NASA_BLUE_FILENAME, NASA_BLACK_FILENAME], true , '#fff3'],
].map(params => new RasterStyle(...params));

// ------------------------------------------------------------------

let RasterMapIsInit = false;

// Main Canvas, Canvas context, and Canvas data
const Canvas = fQS('canvas');
const CanvasContext = Canvas.getContext('2d');
let CanvasData;

// Ratio of canvas length per SVG length
let CanvasPerSvgFactor;

// Current selected raster style
let CurrentRasterStyle;

// Source map(s)' raw image data
let SourceRasterRawData;

// Current position of the sun as a LatLon object in radians
let SunPosition;

// ------------------------------------------------------------------

// Draws a MapCell's portion of the raster map by writing into the global
// CanvasData object and reading from the SourceRasterRawData object
function drawCell(cell) {

  const xs = cell.maskCorners.map(point => point.x);
  const ys = cell.maskCorners.map(point => point.y);
  const minX = Math.floor(Math.min(...xs));
  const maxX = Math.ceil (Math.max(...xs));
  const minY = Math.floor(Math.min(...ys));
  const maxY = Math.ceil (Math.max(...ys));

  for   (let x = minX; x <= maxX; x++) {
    for (let y = minY; y <= maxY; y++) {

      const pixelPos = new Point(x, y);

      if (!cell.isInMask(pixelPos)) continue;

      const latLon = cell.isPolar
        ? cell.getPolarInverseLatLon(pixelPos)
        : cell.getInverseLatLon     (pixelPos);
      const pixelOffset = new Point(
        (latLon.lon + DEGS_IN_CIRCLE/2) % DEGS_IN_CIRCLE,
        DEGS_IN_CIRCLE/4 - latLon.lat,
      );
      const srcDataIdx = NUM_CANVAS_DATA_CHANNELS * (
        Math.floor(SOURCE_RASTER_PPD * pixelOffset.y) * DEGS_IN_CIRCLE * SOURCE_RASTER_PPD +
        Math.floor(SOURCE_RASTER_PPD * pixelOffset.x)
      );
      const destDataIdx = NUM_CANVAS_DATA_CHANNELS * (y * Canvas.width + x);

      const pixelData = [
        SourceRasterRawData[0][srcDataIdx    ],
        SourceRasterRawData[0][srcDataIdx + 1],
        SourceRasterRawData[0][srcDataIdx + 2],
      ];

      if (CurrentRasterStyle.isDayNight) {
        const distance = SunPosition.getDistanceTo(latLon.toRadians());
        let dayRatio =
          distance <= MIN_TERMINATOR_DISTANCE
            ? 1
            : distance >= MAX_TERMINATOR_DISTANCE
              ? 0
              : 1 - (distance - MIN_TERMINATOR_DISTANCE) / (MAX_TERMINATOR_DISTANCE - MIN_TERMINATOR_DISTANCE);
        const has2SourceImages = SourceRasterRawData.length === 2;
        if (!has2SourceImages) dayRatio = (dayRatio + 1)/2;
        pixelData[0] *= dayRatio;
        pixelData[1] *= dayRatio;
        pixelData[2] *= dayRatio;
        if (has2SourceImages && dayRatio < 1) {
          pixelData[0] += SourceRasterRawData[1][srcDataIdx    ] * (1 - dayRatio);
          pixelData[1] += SourceRasterRawData[1][srcDataIdx + 1] * (1 - dayRatio);
          pixelData[2] += SourceRasterRawData[1][srcDataIdx + 2] * (1 - dayRatio);
        }
      }

      CanvasData.data[destDataIdx    ] = pixelData[0];
      CanvasData.data[destDataIdx + 1] = pixelData[1];
      CanvasData.data[destDataIdx + 2] = pixelData[2];
      CanvasData.data[destDataIdx + 3] = MAX_COLOR_VALUE;
    }
  }
}

// ------------------------------------------------------------------

function initRasterMap() {
  if (RasterMapIsInit) return;
  RasterMapIsInit = true;
  Canvas.width = Canvas.clientWidth * CANVAS_PIXEL_DENSITY;
  CanvasPerSvgFactor = Canvas.width / MAP_WIDTH;
  Canvas.height = CanvasPerSvgFactor * MAP_HEIGHT;
  CanvasData = CanvasContext.getImageData(0, 0, Canvas.width, Canvas.height);
}

// ------------------------------------------------------------------

export function drawRasterMap(style, graticuleInterval = null) {

  initRasterMap();

  CanvasContext.clearRect(0, 0, Canvas.width, Canvas.height);

  CurrentRasterStyle = style;

  if (style.isDayNight) SunPosition = getSunLatLon().toRadians();

  SourceRasterRawData = [];
  const images = [];
  let numImagesLoaded = 0;

  const onloadHandler = function() {

    numImagesLoaded++;
    if (numImagesLoaded < style.filenames.length) return;

    images.forEach(image => {
      const sourceCanvas = document.createElement('canvas');
      sourceCanvas.width = image.width;
      sourceCanvas.height = image.height;
      const sourceContext = sourceCanvas.getContext('2d')
      sourceContext.drawImage(image, 0, 0);
      SourceRasterRawData.push(sourceContext.getImageData(0, 0, image.width, image.height).data);
    });

    // Rotate, translate, and scale projected cell corners into Canvas pixels
    forEachMapCell(
      point => point.rotate(MAP_TILT).translate(MAP_VIEW_ORIGIN).scale(CanvasPerSvgFactor),
      drawCell,
    );
    if (graticuleInterval !== null) drawRasterGraticule(graticuleInterval);
    CanvasContext.putImageData(CanvasData, 0, 0);
  }

  style.filenames.forEach(filename => {
    const image = new Image();
    image.src = filename;
    image.onload = onloadHandler;
    images.push(image);
  });
}

// ------------------------------------------------------------------

function drawRasterGraticule(interval) {

  initVectorMap();
  drawGraticule(interval);
  drawSpecialCircles();

  const mapSvg = fQS('svg');
  const tempSvg = document.createElement('svg');
  tempSvg.innerHTML = mapSvg.innerHTML;
  tempSvg.setAttributeNS(SVG_NS, 'viewBox', mapSvg.getAttribute('viewBox'));
  tempSvg.setAttribute('xmlns', SVG_NS);
  tempSvg.setAttribute('width', Canvas.width);
  tempSvg.setAttribute('height', Canvas.height);
  mapSvg.style.display = 'none';
  Array.from(tempSvg.querySelectorAll('path')).forEach(path => {
    path.setAttribute('stroke', CurrentRasterStyle.graticuleColor);
  });

  const image = new Image();
  image.src = 'data:image/svg+xml,' + encodeURIComponent(tempSvg.outerHTML);
  image.onload = function() {
    CanvasContext.drawImage(image, 0, 0);
  };
}
