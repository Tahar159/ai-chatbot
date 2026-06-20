// Tiny static file server for the Snake game.
// Open http://localhost:5174 after running `npm start` (or `node server.mjs`).
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 5174;
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.json': 'application/json; charset=utf-8',
};

const server = http.createServer(async (req, res) => {
  let urlPath = decodeURIComponent(new URL(req.url, `http://${req.headers.host}`).pathname);
  if (urlPath === '/') urlPath = '/index.html';
  // Prevent path traversal
  if (urlPath.includes('..')) { res.writeHead(400); res.end('Bad path'); return; }
  const filePath = join(__dirname, urlPath);
  try {
    const s = await stat(filePath);
    if (s.isDirectory()) { res.writeHead(404); res.end('Not Found'); return; }
    const data = await readFile(filePath);
    const ext = extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }
});

server.listen(PORT, () => {
  console.log(`\n  🐍 Snake game running at:  http://localhost:${PORT}\n`);
});
