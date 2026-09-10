// Ein winziger Server, damit du "Deine Welt" auf deinem Computer anschauen kannst.
// Starten mit:  npm start     (oder:  node werkzeuge/server.js)
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 5173;
const ROOT = path.join(__dirname, '..');   // der Spielordner liegt eine Ebene hoeher
const TYPEN = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.json': 'application/json',
  '.ico': 'image/x-icon',
};

http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const datei = path.join(ROOT, path.normalize(p).replace(/^(\.\.[/\\])+/, ''));
  if (!datei.startsWith(ROOT)) { res.writeHead(403); return res.end('Nein.'); }
  fs.readFile(datei, (err, inhalt) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('Nicht gefunden: ' + p); }
    res.writeHead(200, { 'Content-Type': TYPEN[path.extname(datei)] || 'application/octet-stream' });
    res.end(inhalt);
  });
}).listen(PORT, () => console.log('Deine Welt laeuft auf  http://localhost:' + PORT));
