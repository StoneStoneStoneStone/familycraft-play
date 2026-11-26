#!/usr/bin/env node
// FamilyCraft home play server (no dependencies).
// Serves this folder and relays room messages between devices on the same Wi-Fi.
// Nothing is stored and nothing leaves your network.
//   node serve.mjs            -> open the printed address on both devices
//   PORT=9000 node serve.mjs  -> another port;  HOST=127.0.0.1 keeps it to this computer only
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PORT = +(process.env.PORT || 8787);
const HOST = process.env.HOST || '0.0.0.0';
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4', '.ico': 'image/x-icon' };

function lanIp() {
  for (const list of Object.values(os.networkInterfaces()))
    for (const a of list || []) if (a.family === 'IPv4' && !a.internal) return a.address;
  return '';
}

const rooms = new Map(); // code -> Set<{res,id}>
function cast(code, text, skipId) {
  for (const c of rooms.get(code) || []) if (!skipId || c.id !== skipId) c.res.write('data: ' + text + '\n\n');
}

const server = http.createServer((req, res) => {
  let u;
  try { u = new URL(req.url, 'http://x'); } catch (e) { res.writeHead(400); return res.end(); }
  const room = u.pathname.match(/^\/fc\/room\/([A-Z]{4})$/);

  if (u.pathname === '/fc/ping') {
    const ip = lanIp();
    res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    return res.end(JSON.stringify({ fc: 1, lan: ip ? `http://${ip}:${PORT}` : '' }));
  }

  if (room && req.method === 'GET') {
    const code = room[1], id = (u.searchParams.get('id') || '').replace(/[^A-Z]/g, '').slice(0, 16);
    res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store', connection: 'keep-alive', 'x-accel-buffering': 'no' });
    res.write(':ok\n\n');
    const c = { res, id }, set = rooms.get(code) || new Set();
    set.add(c); rooms.set(code, set);
    const keep = setInterval(() => res.write(':k\n\n'), 20000);
    req.on('close', () => {
      clearInterval(keep); set.delete(c);
      if (!set.size) rooms.delete(code); else if (id) cast(code, JSON.stringify({ k: 'bye', f: id }));
    });
    return;
  }

  if (room && req.method === 'POST') {
    let body = '', size = 0;
    req.on('data', d => { size += d.length; if (size > 65536) req.destroy(); else body += d; });
    req.on('end', () => {
      let msg;
      try { msg = JSON.parse(body); } catch (e) { res.writeHead(400); return res.end(); }
      if (!msg || typeof msg !== 'object') { res.writeHead(400); return res.end(); }
      cast(room[1], JSON.stringify(msg), typeof msg.f === 'string' ? msg.f : '');
      res.writeHead(204); res.end();
    });
    return;
  }

  // back office (admin.html): save game numbers to data/game-data.json. Only from this computer, JSON only, small.
  if (u.pathname === '/fc/data' && req.method === 'POST') {
    const ip = req.socket.remoteAddress || '';
    if (!/^(127\.0\.0\.1|::1|::ffff:127\.0\.0\.1)$/.test(ip)) { res.writeHead(403); return res.end('only from this computer'); }
    let body = '', size = 0;
    req.on('data', d => { size += d.length; if (size > 262144) req.destroy(); else body += d; });
    req.on('end', () => {
      let d; try { d = JSON.parse(body); } catch (e) { res.writeHead(400); return res.end('bad json'); }
      if (!d || typeof d !== 'object' || d.v !== 1) { res.writeHead(400); return res.end('bad data'); }
      const file = path.join(ROOT, 'data', 'game-data.json');
      fs.mkdirSync(path.dirname(file), { recursive: true });
      if (fs.existsSync(file)) fs.copyFileSync(file, file.replace(/\.json$/, '.prev.json'));   // one-step undo
      fs.writeFileSync(file, JSON.stringify(d, null, 2));
      res.writeHead(204); res.end();
    });
    return;
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); return res.end(); }
  let rel;
  try { rel = decodeURIComponent(u.pathname); } catch (e) { res.writeHead(400); return res.end(); }
  if (rel === '/') rel = '/index.html';
  // the hosts' mini-games (race etc.) live in the sibling folder; mounted read-only at /home/ so they share this origin
  let base = ROOT; if (rel.startsWith('/home/')){ base = path.join(ROOT, '..', 'familycraft-home'); rel = rel.slice(5); }
  const file = path.normalize(path.join(base, rel));
  if (!file.startsWith(base + path.sep) || rel.split('/').some(s => s.startsWith('.'))) { res.writeHead(403); return res.end(); }
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404, { 'content-type': 'text/plain' }); return res.end('not found'); }
    res.writeHead(200, { 'content-type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', 'content-length': st.size, 'cache-control': 'no-store' });
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(file).pipe(res);
  });
});

server.listen(PORT, HOST, () => {
  const ip = lanIp();
  console.log('\nFamilyCraft is ready');
  console.log('  This computer:          http://localhost:' + PORT + '/');
  if (ip && HOST !== '127.0.0.1') console.log('  Other devices (same Wi-Fi): http://' + ip + ':' + PORT + '/');
  console.log('  Stop with Ctrl+C\n');
});
