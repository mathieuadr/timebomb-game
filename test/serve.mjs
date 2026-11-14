// Serveur de développement : sert public/ sous /timebomb-game/ (comme GitHub Pages).
// Usage : npm start   → http://localhost:8099/timebomb-game/
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
const PORT = Number(process.env.PORT) || 8099;
const BASE = '/timebomb-game/';
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json',
};

export function start(port = PORT) {
  const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    if (!u.pathname.startsWith(BASE)) { res.writeHead(302, { location: BASE }); return res.end(); }
    let file = path.join(ROOT, path.normalize(decodeURIComponent(u.pathname.slice(BASE.length))));
    if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    if (!fs.existsSync(file)) { res.writeHead(404); return res.end('404'); }
    res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-cache' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(port, () => resolve({ server, url: `http://localhost:${port}${BASE}` })));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { url } = await start();
  console.log(`Coupe-Circuit : ${url}`);
}
