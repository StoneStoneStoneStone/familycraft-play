// Dig quest logic (pure: no three, no engine). A site is a block of rock cut into layers (top to bottom) with finds
// buried in pockets. Site-local coordinates: x runs along the cross-section (0..sizeX-1), y is the layer row
// (0 = top layer, depth = y), z runs into the rock (0 = the front face the camera sees in band a).
import { seeded, QUEST_DEFAULTS } from './common.js';
import { BANKS } from './banks.js';

// band a is one block thick (a true side-on cross-section, nothing between the camera and the player); b and c are 3 thick.
// x 0..4 is a stair carved down to the dig floor (one block per step, so nobody needs to jump); the rock face starts at x = 5.
export const DIG = { sizeX: 11, stairs: 5, findX0: 6, findX1: { a: 8, b: 9, c: 9 }, sizeZ: { a: 1, b: 3, c: 3 }, maxPerEra: 2, free: 3 };
const PALETTE = ['grass', 'sand', 'soil', 'stone', 'brick'];                 // block id of each layer, top to bottom
// Era of each layer, newest on top. Ordered by the start year in BANKS.eras, so deeper is always older.
const CHAIN = ['greece', 'iron', 'egypt', 'bronze', 'stone'];
const RANK = Object.fromEntries(BANKS.eras.map(e => [e.id, e.from]));        // smaller = older

// Band b (Y3 curriculum) only knows three layers' worth of eras: Stone, Bronze, Iron. Egypt, Greece and the rest live on band c's timeline.
const B_ROWS = { iron: [1], bronze: [2, 3], stone: [4] };
export function eraForDepth(depth, band = 'c'){
  const d = Math.max(0, Math.floor(depth) || 0);
  if (band === 'b') return d <= 1 ? 'iron' : d <= 3 ? 'bronze' : 'stone';
  return CHAIN[Math.min(CHAIN.length - 1, d)];
}

// eraIds in the order the child placed them (left to right). True when oldest comes first; ties are fine.
export function checkTimeline(eraIds){
  if (!eraIds || !eraIds.length || eraIds.some(id => RANK[id] === undefined)) return false;
  for (let i = 1; i < eraIds.length; i++) if (RANK[eraIds[i]] < RANK[eraIds[i - 1]]) return false;
  return true;
}

// What a find is, per era (th/en names, shown as labels; letters are used for band a).
const ITEMS = {
  greece: [{ item: 'coin', th: 'เหรียญ', en: 'coin' }, { item: 'vase', th: 'แจกัน', en: 'vase' }],
  iron:   [{ item: 'nail', th: 'ตะปูเหล็ก', en: 'iron nail' }, { item: 'key', th: 'กุญแจเหล็ก', en: 'iron key' }],
  egypt:  [{ item: 'scarab', th: 'ด้วงสคารับ', en: 'scarab' }, { item: 'papyrus', th: 'กระดาษปาปิรัส', en: 'papyrus' }],
  bronze: [{ item: 'axe', th: 'ขวานสำริด', en: 'bronze axe' }, { item: 'bowl', th: 'ชามสำริด', en: 'bronze bowl' }],
  stone:  [{ item: 'flint', th: 'หินเหล็กไฟ', en: 'flint' }, { item: 'tooth', th: 'ฟันแมมมอธ', en: 'mammoth tooth' }]
};

const shuffle = (arr, r) => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--){ const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const COUNT = { b: [4, 5, 5, 6], c: [4, 4, 4, 4] };

// makeDigSite(band, level, layerCount, { free, maxPerEra }) -> { band, level, free, freeN, layers, size, finds, secret, task }
// free = finds a free level needs on the shelf, maxPerEra = most finds of one era (the room passes TUNING.quest.digFree / digMaxPerEra)
export function makeDigSite(band, level, layerCount = QUEST_DEFAULTS.digLayers, { free: freeN = DIG.free, maxPerEra = DIG.maxPerEra } = {}){
  freeN = Math.max(1, Math.min(6, Math.round(freeN) || DIG.free)); maxPerEra = Math.max(1, Math.round(maxPerEra) || DIG.maxPerEra);
  band = ['a', 'b', 'c'].includes(band) ? band : 'b';
  const n = Math.max(2, layerCount), layers = Array.from({ length: n }, (_, i) => PALETTE[i % PALETTE.length]);
  const sizeZ = DIG.sizeZ[band], r = seeded(level, 'dig-' + band), cols = range(DIG.findX0, DIG.findX1[band]), finds = [], used = new Set();
  const take = (x, y, z) => { used.add([x, y, z].join()); return { x, y, z }; };
  const free = level === 3; let task;
  if (band === 'a'){
    const words = shuffle(BANKS.words.a, seeded(0, 'dig-words')), word = words[level % words.length], xs = shuffle(cols, r).slice(0, word.length);
    shuffle([...word], r).forEach((ch, i) => { const y = 1 + Math.floor(r() * 2); finds.push({ ...take(xs[i], y, 0), item: 'letter', era: eraForDepth(y), label: ch }); });
    task = { type: 'letters', word, goalText: { th: `ขุดหาตัวอักษร แล้ววางเรียงเป็นคำว่า ${word}`, en: `Dig up the letters and place them to spell ${word}` } };
  } else {
    // One find per layer row (rows 1..4), x alternating between the two outer columns: enlarged labels are 1.9 cells wide, so two finds
    // in neighbouring rows must be at least 3 columns apart to keep their labels from touching. Level to level only x side, z and items change.
    const rows = range(1, Math.min(4, n - 1)), pool = {}, side = r() < .5 ? 0 : 1, xs = [cols[0], cols[cols.length - 1]];
    rows.forEach((y, i) => {
      const x = xs[(i + side) % 2], z = Math.floor(r() * 2), era = eraForDepth(y, band);      // z is one of the front two planes, so a tunnel from the stairs reaches it
      const list = ITEMS[era], it = list[(pool[era] = (pool[era] === undefined ? Math.floor(r() * list.length) : pool[era] + 1)) % list.length];
      if (finds.filter(f => f.era === era).length >= maxPerEra) return;      // an era already has its share of finds
      finds.push({ ...take(x, y, z), item: it.item, era, label: { th: it.th, en: it.en } });
    });
    if (band === 'b'){
      const perEra = {}; finds.forEach(f => perEra[f.era] = (perEra[f.era] || 0) + 1);
      const eras = Object.keys(perEra).sort((p, q) => RANK[p] - RANK[q]);
      task = { type: 'tag', eras, perEra, goalText: { th: 'ขุดซากโบราณ วางบนชั้นยุคเดียวกับชั้นดิน', en: 'Dig up the finds and put each on the shelf of its layer\'s era' } };
    } else {
      const order = [...finds].sort((p, q) => q.y - p.y).map(f => f.era);       // deepest (oldest) first
      task = { type: 'timeline', order, goalText: { th: 'เรียงของที่ขุดได้จากเก่าสุดไปใหม่สุด ชั้นลึกเก่ากว่า', en: 'Put the finds in time order, oldest first. Deeper means older' } };
    }
  }
  if (free) task = { ...task, goalText: { th: `ด่านอิสระ ขุดแล้ววางของ ${freeN} ชิ้นบนชั้น`, en: `Free dig: put ${freeN} finds on the shelf` } };
  // a gold block hidden in the rock for the third star (band a: in the front face, within reach of the stairs)
  const syy = band === 'a' ? 2 : Math.max(1, Math.min(n - 1, n - 2 + Math.floor(r() * 2))); let sx, sz2, t2 = 0;
  do { sx = cols[Math.floor(r() * cols.length)]; sz2 = band === 'a' ? 0 : Math.floor(r() * sizeZ); } while (used.has([sx, syy, sz2].join()) && ++t2 < 50);
  return { band, level, free, freeN: Math.min(freeN, finds.length), layers, size: { x: DIG.sizeX, z: sizeZ }, finds, secret: { x: sx, y: syy, z: sz2 }, task };
}
