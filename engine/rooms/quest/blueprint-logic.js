// Blueprint quest logic (pure: no three, no engine). Cells are plot-local [x, y, z, blockId]; size is [w, h, d].
import { seeded } from './common.js';

const EMPTY = v => !v || v === 'air';

// Band a: one layer, 3x3 to 4x4, mirror line down the middle (left half drawn, right half copied).
function genA(level, k){
  const s = level >= 2 ? 4 : 3, r = seeded(level, 'bp-a-' + k), cells = [], id = level % 2 ? 'planks' : 'brick';
  for (let z = 0; z < s; z++) for (let x = 0; x < Math.ceil(s / 2); x++) if (r() < .62){
    cells.push([x, 0, z, id]); if (s - 1 - x !== x) cells.push([s - 1 - x, 0, z, id]);
  }
  if (cells.length < 4 || cells.length > s * s - 2) return null;
  const sorted = cells.sort((a, b) => a[2] - b[2] || a[0] - b[0]);
  return { cells: sorted, size: [s, 1, s], mirror: 'x', goalText: {
    th: `ต่อบล็อกให้เหมือนแผน ซ้ายกับขวาเหมือนกัน (${sorted.length} ก้อน)`,
    en: `Build it like the plan. Left and right match (${sorted.length} blocks)` } };
}

// Band b: 2-3 layers; a ring wall (perimeter target) or a filled floor (area target).
function genB(level, k){
  const r = seeded(level, 'bp-b-' + k), layers = level >= 2 ? 3 : 2, w = 3 + Math.floor(r() * 3), d = 3 + Math.floor(r() * 2);
  const mode = (level + k) % 2 ? 'area' : 'perimeter', id = level % 2 ? 'stone' : 'planks', cells = [];
  for (let y = 0; y < layers; y++) for (let z = 0; z < d; z++) for (let x = 0; x < w; x++)
    if (mode === 'area' || x === 0 || z === 0 || x === w - 1 || z === d - 1) cells.push([x, y, z, id]);
  const per = 2 * (w + d) - 4;
  return { cells, size: [w, layers, d], mode, layers, perimeter: per, area: w * d, goalText: mode === 'perimeter'
    ? { th: `สร้างกำแพงวงรอบ เส้นรอบรูป ${per} ก้อน สูง ${layers} ชั้น`, en: `Build a ring wall, ${per} blocks around, ${layers} layers high` }
    : { th: `ปูพื้นเต็ม ${w}×${d} (พื้นที่ ${w * d}) สูง ${layers} ชั้น`, en: `Fill a ${w} by ${d} floor (area ${w * d}), ${layers} layers high` } };
}

// Band c: a plan (height of each column) and a front elevation; the stated volume is the block count.
function genC(level, k){
  const r = seeded(level, 'bp-c-' + k), w = 3 + Math.floor(r() * 3), d = 3 + Math.floor(r() * 2), id = 'brick';
  const plan = [], cells = []; let vol = 0, hmax = 0;
  for (let z = 0; z < d; z++){ plan.push([]); for (let x = 0; x < w; x++){ const h = r() < .25 ? 0 : 1 + Math.floor(r() * 3); plan[z].push(h); vol += h; hmax = Math.max(hmax, h);
    for (let y = 0; y < h; y++) cells.push([x, y, z, id]); } }
  if (vol < 8 || vol > 26 || hmax < 2) return null;
  const front = Array.from({ length: w }, (_, x) => Math.max(...plan.map(row => row[x])));
  return { cells, size: [w, hmax, d], plan, front, volume: vol, goalText: {
    th: `สร้างให้ได้ ${vol} ก้อน ตามแผนผังด้านบนและด้านหน้า`, en: `Build ${vol} blocks to match the plan and the front view` } };
}

const GEN = { a: genA, b: genB, c: genC };

// makeBlueprint(band, level) -> { cells, size, goalText:{th,en}, free, ...band data }. Levels 0..3 of a band never repeat.
export function makeBlueprint(band, level){
  const gen = GEN[band] || GEN.b, seen = new Set(); let out = null;
  for (let l = 0; l <= level; l++){
    for (let k = 0; k < 60; k++){
      const bp = gen(l, k); if (!bp) continue;
      const key = JSON.stringify([bp.size, bp.cells]); if (seen.has(key)) continue;
      seen.add(key); out = bp; break;
    }
  }
  out.free = level === 3; out.band = band; out.level = level;
  return out;
}

// compareBuild(target, getBlock(x,y,z) -> id|0) scans the plot box (one layer of headroom) in plot-local coordinates.
// A target cell with the wrong block counts as missing; any block in the box that is not a target cell counts as extra.
export function compareBuild(target, getBlock){
  const [w, h, d] = target.size, want = new Map(target.cells.map(([x, y, z, id]) => [x + ',' + y + ',' + z, id]));
  let matched = 0, extra = 0;
  for (let y = 0; y < h + 1; y++) for (let z = 0; z < d; z++) for (let x = 0; x < w; x++){
    const have = getBlock(x, y, z), need = want.get(x + ',' + y + ',' + z);
    if (EMPTY(have)) continue;
    if (need === have) matched++; else extra++;
  }
  const missing = target.cells.length - matched;
  return { matched, missing, extra, pct: missing === 0 && extra === 0 ? 100 : Math.min(99, Math.round(100 * matched / (target.cells.length + extra))) };
}
