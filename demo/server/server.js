// Local demo server: serves the GitHub Pages site from ../../docs and the Lawak Store API on /api.
// The API uses the same backend.js as the browser build, with data in memory.
// Usage: node server/server.js   (PORT defaults to 4173)
// API_MODE=browser serves the site as GitHub Pages does: the store keeps its in-browser backend.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { createBackend, memoryStorage } = require('../../docs/store/js/backend.js');

const PORT = Number(process.env.PORT || 4173);
const ROOT = path.resolve(__dirname, '../../docs');
const backend = createBackend(memoryStorage());
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(body === null ? '' : JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (c) => { data += c; if (data.length > 1e6) req.destroy(); });
    req.on('end', () => resolve(data));
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname.startsWith('/api/')) {
    const raw = await readBody(req);
    let body = {};
    if (raw) {
      try { body = JSON.parse(raw); } catch (e) { return sendJson(res, 400, { error: { code: 'BAD_JSON', message: 'The request body is not valid JSON.' } }); }
    }
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    const out = backend.handle({ method: req.method, path: url.pathname + url.search, body, token });
    return sendJson(res, out.status, out.body);
  }
  if (url.pathname === '/store/js/config.js' && process.env.API_MODE !== 'browser') {
    res.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'no-store' });
    return res.end("window.LAWAK_API_MODE = 'http';\n");
  }
  let file = path.normalize(path.join(ROOT, decodeURIComponent(url.pathname)));
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end('Forbidden'); }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain' }); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(data);
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Lawak Store demo: http://127.0.0.1:${PORT}/store/`);
  console.log(`Test dashboard:   http://127.0.0.1:${PORT}/dashboard/`);
  console.log(`API base:         http://127.0.0.1:${PORT}/api`);
});
