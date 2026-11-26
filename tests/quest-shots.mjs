// Screenshot sheet for the five quest rooms: every room x band (a, b, c), level 1, at 1180x620 and 812x375.
// Needs the local server (node serve.mjs on 8787). Does not restart it and does not touch other Chrome windows.
// Run: node tests/quest-shots.mjs [outDir]   -> <room>-<band>-<w>.jpg (30 files), sheet-desktop.jpg, sheet-phone.jpg
import puppeteer from '/Users/familyjourney/.claude/skills/style-atlas/scripts/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js';
import fs from 'node:fs'; import path from 'node:path';
const BASE = process.env.BASE || 'http://localhost:8787/';
const OUT = process.argv[2] || '/private/tmp/claude-501/-Users-familyjourney-Documents-game/140e8d69-e6b9-4631-ae4b-43d54382ad47/scratchpad/sdd/shots';
fs.mkdirSync(OUT, { recursive: true });
const ROOMS = ['blueprint', 'dig', 'escape', 'code', 'obby'], BANDS = ['a', 'b', 'c'];
const SIZES = [{ n: 'desktop', width: 1180, height: 620 }, { n: 'phone', width: 812, height: 375 }];
const W = ms => new Promise(r => setTimeout(r, ms));
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu'] });
const errs = [];
for (const s of SIZES) for (const room of ROOMS) for (const band of BANDS){
  const p = await b.newPage(); await p.setViewport({ width: s.width, height: s.height, deviceScaleFactor: 1, isMobile: s.n === 'phone', hasTouch: s.n === 'phone' });
  p.on('pageerror', e => errs.push(`${room}-${band}-${s.width}: ${e}`));
  await p.goto(`${BASE}game.html?room=${room}&band=${band}&fresh`, { waitUntil: 'networkidle0', timeout: 90000 }); await W(4000);
  await p.screenshot({ path: path.join(OUT, `${room}-${band}-${s.width}.jpg`), type: 'jpeg', quality: 82 }); await p.close();
}
// contact sheets: rows = rooms, columns = bands (desktop); rows = bands, columns = rooms (phone)
for (const s of SIZES){
  const cw = s.n === 'desktop' ? 560 : 300, ch = Math.round(cw * s.height / s.width);
  const cells = [];
  for (const room of ROOMS) for (const band of BANDS){
    const f = path.join(OUT, `${room}-${band}-${s.width}.jpg`); cells.push({ room, band, src: 'data:image/jpeg;base64,' + fs.readFileSync(f).toString('base64') });
  }
  const grid = s.n === 'desktop' ? `grid-template-columns:repeat(3,${cw}px)` : `grid-template-columns:repeat(5,${cw}px)`;
  const order = s.n === 'desktop' ? cells : BANDS.flatMap(band => ROOMS.map(room => cells.find(c => c.room === room && c.band === band)));
  const html = `<body style="margin:0;background:#F9FAFB;font:600 15px/1 Prompt,system-ui,sans-serif;color:#3A1F08"><div style="display:grid;${grid};gap:10px;padding:10px;width:max-content">` +
    order.map(c => `<figure style="margin:0"><div style="padding:0 0 5px">${c.room} · band ${c.band} · level 1 · ${s.width}x${s.height}</div><img src="${c.src}" width="${cw}" height="${ch}" style="display:block;border:2px solid #3A1F08;border-radius:8px"></figure>`).join('') + '</div></body>';
  const cols = s.n === 'desktop' ? 3 : 5, rows = 15 / cols, sp = await b.newPage();
  await sp.setViewport({ width: cols * (cw + 10) + 10, height: rows * (ch + 40) + 20, deviceScaleFactor: 1 });
  await sp.setContent(html); await W(500);
  await sp.screenshot({ path: path.join(OUT, `sheet-${s.n}.jpg`), type: 'jpeg', quality: 85, fullPage: true }); await sp.close();
}
await b.close();
console.log(errs.length ? 'PAGE ERRORS:\n' + errs.join('\n') : 'no page errors', '\n30 shots + 2 sheets in', OUT);
