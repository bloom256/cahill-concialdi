// ==================================================================
// WEB APP CAPTURE
// ------------------------------------------------------------------

// Loads index.html in headless Chrome and waits until every country and
// boundary is drawn. As a script, saves the SVG markup and a screenshot.
// Usage: node scripts/capture-web.mjs [outDir] [widthPx]

import puppeteer from 'puppeteer-core';
import { readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from './serve.mjs';

// ------------------------------------------------------------------

export const CHROME_PATH = process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';

const ROOT        = resolve(fileURLToPath(import.meta.url), '../..');
const MAP_ASPECT  = 178 / 302;  // MAP_HEIGHT / MAP_WIDTH
const TIMEOUT_MS  = 60000;
const SCRIPT_PORT = 8766;

// ------------------------------------------------------------------

// Opens the web app served on the given port in a new page of the browser
// and resolves to the page once the vector map is completely drawn
export async function openWebApp(browser, port, widthPx) {

  const countJsonRows = filename => JSON.parse(readFileSync(join(ROOT, filename), 'utf8')).length;
  const numCountries  = countJsonRows('ne-country-areas.json');
  const numBoundaries = countJsonRows('ne-boundaries.json');

  const page = await browser.newPage();
  page.on('pageerror', error => console.error('page error:', error.message));

  // The SVG is 100vw wide; match its height so nothing is cropped
  await page.setViewport({ width: widthPx, height: Math.ceil(widthPx * MAP_ASPECT) });
  await page.goto(`http://127.0.0.1:${port}/index.html`);
  await page.waitForFunction(
    (countries, boundaries) =>
      document.querySelectorAll('#countries path').length  === countries &&
      document.querySelectorAll('#boundaries path').length === boundaries,
    { timeout: TIMEOUT_MS },
    numCountries,
    numBoundaries,
  );
  return page;
}

// ------------------------------------------------------------------

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {

  const outDir  = process.argv[2] ?? join(ROOT, 'out', 'web');
  const widthPx = Number(process.argv[3]) || 1920;

  await mkdir(outDir, { recursive: true });
  const server  = await startServer(SCRIPT_PORT);
  const browser = await puppeteer.launch({ executablePath: CHROME_PATH, headless: true });

  try {
    const page = await openWebApp(browser, SCRIPT_PORT, widthPx);
    await writeFile(join(outDir, 'web-svg.html'), await page.$eval('svg', svg => svg.outerHTML));
    await page.screenshot({ path: join(outDir, 'web.png') });
    console.log(`Captured the web app into ${outDir}`);
  }
  finally {
    await browser.close();
    server.close();
  }
}
