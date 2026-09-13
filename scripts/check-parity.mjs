// ==================================================================
// PARITY CHECK: NODE RENDERER VS. WEB APP
// ------------------------------------------------------------------

// Verifies that the seav-original style reproduces the web app:
// 1. Every path matches exactly: path data, class, id, computed style, and
//    screen transform (both SVGs are laid out at the same pixel width).
// 2. The resvg overview looks like Chrome's screenshot; small differences
//    along edges are expected from different antialiasing.
// Usage: npm run parity   (outputs web.png, node.png, diff.png in out/parity/)

import puppeteer from 'puppeteer-core';
import { Resvg } from '@resvg/resvg-js';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from './serve.mjs';
import { CHROME_PATH, openWebApp } from './capture-web.mjs';
import { loadStyle } from '../print/styles.mjs';
import { renderMap } from '../print/render.mjs';

// ------------------------------------------------------------------

const ROOT               = resolve(fileURLToPath(import.meta.url), '../..');
const OUT_DIR            = join(ROOT, 'out', 'parity');
const PORT               = 8767;
const WIDTH_PX           = 1920;
const CTM_TOLERANCE      = 1e-3;   // pixels
const PIXEL_TOLERANCE    = 48;     // max channel delta still counted as equal
const MAX_MISMATCH_RATIO = 0.01;   // share of pixels allowed beyond tolerance
const MAX_LISTED_ISSUES  = 20;

// Matching path selectors: [web app, Node renderer]
const LAYER_PAIRS = [
  ['#background'     , '#ocean'         ],
  ['#graticule path' , '#graticule path'],
  ['#circles path'   , '#circles path'  ],
  ['#countries path' , '#land path'     ],
  ['#boundaries path', '#admin0 path'   ],
];

// ------------------------------------------------------------------

// Runs in the browser: geometry, computed style, and transform of each path
function extractPaths(selectors) {
  return selectors.map(selector =>
    [...document.querySelectorAll(selector)].map(path => {
      const style = getComputedStyle(path);
      const ctm = path.getScreenCTM();
      return {
        id       : path.id,
        className: path.getAttribute('class') ?? '',
        d        : path.getAttribute('d'),
        ctm      : [ctm.a, ctm.b, ctm.c, ctm.d, ctm.e, ctm.f],
        style    : [
          style.fill, style.stroke, style.strokeWidth, style.strokeDasharray,
          style.strokeLinejoin, style.strokeLinecap,
        ].join(' | '),
      };
    })
  );
}

// ------------------------------------------------------------------

// Runs in the browser: pixel comparison of two PNG data URLs; mismatching
// pixels are painted red over a darkened copy of the first image
async function comparePngs(firstUrl, secondUrl, tolerance) {

  const loadImage = src => new Promise((onLoad, onError) => {
    const image = new Image();
    image.onload = () => onLoad(image);
    image.onerror = onError;
    image.src = src;
  });
  const [firstImage, secondImage] = await Promise.all([loadImage(firstUrl), loadImage(secondUrl)]);
  const width  = Math.min(firstImage.width , secondImage.width );
  const height = Math.min(firstImage.height, secondImage.height);

  const newContext = () => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas.getContext('2d');
  };
  const getPixels = image => {
    const context = newContext();
    context.drawImage(image, 0, 0);
    return context.getImageData(0, 0, width, height).data;
  };
  const first  = getPixels(firstImage );
  const second = getPixels(secondImage);

  const diffContext = newContext();
  const diff = diffContext.createImageData(width, height);
  let numMismatches = 0;
  let sumDelta = 0;
  for (let idx = 0; idx < first.length; idx += 4) {
    const delta = Math.max(
      Math.abs(first[idx    ] - second[idx    ]),
      Math.abs(first[idx + 1] - second[idx + 1]),
      Math.abs(first[idx + 2] - second[idx + 2]),
    );
    sumDelta += delta;
    if (delta > tolerance) {
      numMismatches++;
      diff.data[idx] = 255;
    }
    else {
      const gray = (first[idx] + first[idx + 1] + first[idx + 2]) / 9;
      diff.data[idx] = diff.data[idx + 1] = diff.data[idx + 2] = gray;
    }
    diff.data[idx + 3] = 255;
  }
  diffContext.putImageData(diff, 0, 0);

  return {
    width,
    height,
    mismatchRatio: numMismatches / (width * height),
    meanDelta    : sumDelta / (width * height),
    diffUrl      : diffContext.canvas.toDataURL('image/png'),
  };
}

// ------------------------------------------------------------------

// Rounds rgb() components so fractional web colors match rounded hex colors
const normalizeStyle = style => style.replace(
  /rgb\(([^)]*)\)/g,
  (_, channels) => `rgb(${channels.split(',').map(channel => Math.round(parseFloat(channel))).join(', ')})`,
);

function compareLayers(webLayers, nodeLayers) {
  const issues = [];
  LAYER_PAIRS.forEach(([, nodeSelector], layerIdx) => {
    const webPaths  = webLayers [layerIdx];
    const nodePaths = nodeLayers[layerIdx];
    if (webPaths.length !== nodePaths.length) {
      issues.push(`${nodeSelector}: ${webPaths.length} web paths vs. ${nodePaths.length} node paths`);
      return;
    }
    webPaths.forEach((webPath, pathIdx) => {
      const nodePath = nodePaths[pathIdx];
      const label = `${nodeSelector}[${pathIdx}]${nodePath.id ? ' #' + nodePath.id : ''}`;
      if (webPath.d !== nodePath.d) issues.push(`${label}: path data differs`);
      if (webPath.className !== nodePath.className) issues.push(`${label}: class "${webPath.className}" vs. "${nodePath.className}"`);
      if (webPath.id.startsWith('iso-') && webPath.id !== nodePath.id) issues.push(`${label}: id ${webPath.id} vs. ${nodePath.id}`);
      if (normalizeStyle(webPath.style) !== normalizeStyle(nodePath.style)) {
        issues.push(`${label}: style differs\n    web : ${webPath.style}\n    node: ${nodePath.style}`);
      }
      if (webPath.ctm.some((value, idx) => Math.abs(value - nodePath.ctm[idx]) > CTM_TOLERANCE)) {
        issues.push(`${label}: transform differs\n    web : ${webPath.ctm}\n    node: ${nodePath.ctm}`);
      }
    });
  });
  return issues;
}

// ------------------------------------------------------------------

const svg = renderMap(await loadStyle('seav-original'));
const nodePng = new Resvg(svg, { fitTo: { mode: 'width', value: WIDTH_PX } }).render().asPng();

await mkdir(OUT_DIR, { recursive: true });
const server  = await startServer(PORT);
const browser = await puppeteer.launch({ executablePath: CHROME_PATH, headless: true });

let isPassing = false;
try {

  // Web app paths and screenshot
  const webPage   = await openWebApp(browser, PORT, WIDTH_PX);
  const webLayers = await webPage.evaluate(extractPaths, LAYER_PAIRS.map(pair => pair[0]));
  const webPng    = await webPage.screenshot({ encoding: 'base64' });

  // Node SVG laid out in Chrome at the same pixel width
  const nodePage = await browser.newPage();
  await nodePage.setContent(`<body style="margin:0">${svg}</body>`);
  await nodePage.evaluate(width => {
    const svgElement = document.querySelector('svg');
    svgElement.setAttribute('width', width);
    svgElement.removeAttribute('height');
  }, WIDTH_PX);
  const nodeLayers = await nodePage.evaluate(extractPaths, LAYER_PAIRS.map(pair => pair[1]));

  const issues = compareLayers(webLayers, nodeLayers);
  const numPaths = webLayers.reduce((sum, paths) => sum + paths.length, 0);
  console.log(`Paths compared: ${numPaths}; issues: ${issues.length}`);
  issues.slice(0, MAX_LISTED_ISSUES).forEach(issue => console.log('  ' + issue));

  // Visual comparison
  const visual = await nodePage.evaluate(
    comparePngs,
    'data:image/png;base64,' + webPng,
    'data:image/png;base64,' + nodePng.toString('base64'),
    PIXEL_TOLERANCE,
  );
  await writeFile(join(OUT_DIR, 'web.png'), Buffer.from(webPng, 'base64'));
  await writeFile(join(OUT_DIR, 'node.png'), nodePng);
  await writeFile(join(OUT_DIR, 'diff.png'), Buffer.from(visual.diffUrl.split(',')[1], 'base64'));
  console.log(
    `Pixels compared: ${visual.width}x${visual.height}; ` +
    `mismatching: ${(visual.mismatchRatio * 100).toFixed(3)}%; ` +
    `mean channel delta: ${visual.meanDelta.toFixed(2)}`
  );

  isPassing = issues.length === 0 && visual.mismatchRatio <= MAX_MISMATCH_RATIO;
  console.log(isPassing ? 'PARITY OK' : 'PARITY FAILED');
}
finally {
  await browser.close();
  server.close();
}

process.exit(isPassing ? 0 : 1);
