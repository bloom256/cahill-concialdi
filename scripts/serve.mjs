// ==================================================================
// STATIC FILE SERVER FOR LOCAL DEVELOPMENT
// ------------------------------------------------------------------

// Python's http.server on Windows serves .mjs files as text/plain, which
// browsers refuse to run as module scripts, so this server sets MIME types
// explicitly. Usage: node scripts/serve.mjs [port]

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// ------------------------------------------------------------------

const ROOT         = resolve(fileURLToPath(import.meta.url), '../..');
const DEFAULT_PORT = 8000;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.mjs' : 'text/javascript; charset=utf-8',
  '.js'  : 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css' : 'text/css; charset=utf-8',
  '.svg' : 'image/svg+xml',
  '.png' : 'image/png',
  '.jpg' : 'image/jpeg',
};

// ------------------------------------------------------------------

// Starts serving the repository root on 127.0.0.1; resolves to the server
export function startServer(port = DEFAULT_PORT) {
  const server = createServer(async (request, response) => {
    const urlPath  = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const filePath = normalize(join(ROOT, urlPath.endsWith('/') ? urlPath + 'index.html' : urlPath));
    if (!filePath.startsWith(ROOT)) {
      response.writeHead(403).end();
      return;
    }
    try {
      const body = await readFile(filePath);
      response.writeHead(200, { 'Content-Type': MIME_TYPES[extname(filePath)] ?? 'application/octet-stream' });
      response.end(body);
    }
    catch {
      response.writeHead(404).end();
    }
  });
  return new Promise(resolveServer => server.listen(port, '127.0.0.1', () => resolveServer(server)));
}

// ------------------------------------------------------------------

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.argv[2]) || DEFAULT_PORT;
  await startServer(port);
  console.log(`Serving ${ROOT} at http://127.0.0.1:${port}/`);
}
