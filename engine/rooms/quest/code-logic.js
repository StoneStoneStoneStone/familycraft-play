// Code quest logic (pure: no three, no engine, runs in plain node). The child builds a program from command tiles and a small
// block robot runs it on a grid. Grid = array of rows (z = 0 is the north row, the top of the screen), one char per cell:
//   '.' floor   '#' wall (DIG clears it)   '~' hole (PLACE fills it)   'G' the goal flag (floor)
// dir 0 = north (up the screen), 1 = east, 2 = south, 3 = west. Cmd = 'F' | 'L' | 'R' | 'PLACE' | 'DIG' |
// { loop: n, body: Cmd[] } | { if: 'blocked', then: Cmd[], else: Cmd[] }. A tile's address is the index path of the tile in
// the program: [2] = third top-level tile, [1,'body',0] = first tile in the loop, [0,'then',1] = second tile of an if's then.
import { QUEST_DEFAULTS } from './common.js';

export const CODE = { maxLoop: 9, prims: ['F', 'L', 'R', 'PLACE', 'DIG'] };
export const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]];

const cellAt = (rows, x, z) => (z >= 0 && z < rows.length && x >= 0 && x < rows[z].length) ? rows[z][x] : null;
const walkable = c => c === '.' || c === 'G';
const setCell = (rows, x, z, ch) => rows.map((r, i) => i === z ? r.slice(0, x) + ch + r.slice(x + 1) : r);
const frontOf = s => [s.x + DIRS[s.dir][0], s.z + DIRS[s.dir][1]];
export const isBlocked = (rows, s) => { const [fx, fz] = frontOf(s); return !walkable(cellAt(rows, fx, fz)); };

// one primitive command on one state: { s, rows, bump?, cell?, did? } (never mutates its input)
function applyPrim(rows, s, cmd){
  const [fx, fz] = frontOf(s), c = cellAt(rows, fx, fz);
  if (cmd === 'L') return { s: { ...s, dir: (s.dir + 3) % 4 }, rows };
  if (cmd === 'R') return { s: { ...s, dir: (s.dir + 1) % 4 }, rows };
  if (cmd === 'F') return walkable(c) ? { s: { x: fx, z: fz, dir: s.dir }, rows } : { s, rows, bump: [fx, fz] };
  if (cmd === 'PLACE'){
    if (c === '~') return { s, rows: setCell(rows, fx, fz, '.'), cell: [fx, fz], did: 'place' };       // a block into the hole: floor again
    if (c === '.') return { s, rows: setCell(rows, fx, fz, '#'), cell: [fx, fz], did: 'place' };       // a block on open floor: a wall
    return { s, rows, bump: [fx, fz] };                                                                // a wall, the flag, the edge
  }
  if (cmd === 'DIG'){
    if (c === '#') return { s, rows: setCell(rows, fx, fz, '.'), cell: [fx, fz], did: 'dig' };
    return { s, rows, cell: [fx, fz], did: 'none' };                                                   // nothing to dig: harmless
  }
  return { s, rows };
}

// Runs a program: { path, placed, dug, grid, reached, error }. path[0] is the start; every executed primitive adds one entry
// { x, z, dir, cmd, at, cell?, did?, bump? } (cell = the cell a PLACE/DIG acted on, bump = the cell in front that blocked the robot).
// Loop iterations and if checks are not steps. maxSteps caps primitives (error 'steps'); an empty loop cannot hang the page either.
export function runProgram(grid, start, program, maxSteps = QUEST_DEFAULTS.codeMaxSteps){
  let rows = grid.slice(), s = { x: start.x, z: start.z, dir: start.dir | 0 };
  const path = [{ ...s, cmd: null, at: null }], placed = [], dug = [], tickCap = Math.max(maxSteps * 50, 1000);
  let steps = 0, ticks = 0, error = null;
  const prim = (cmd, at) => {
    if (!CODE.prims.includes(cmd)) return true;
    if (steps >= maxSteps){ error = 'steps'; return false; }
    steps++; const r = applyPrim(rows, s, cmd); rows = r.rows; s = r.s;
    const e = { x: s.x, z: s.z, dir: s.dir, cmd, at };
    if (r.cell){ e.cell = r.cell; e.did = r.did; if (r.did === 'place') placed.push(r.cell); if (r.did === 'dig') dug.push(r.cell); }
    if (r.bump){ e.bump = r.bump; path.push(e); error = 'bump'; return false; }
    path.push(e); return true;
  };
  const exec = (list, at) => {
    for (let i = 0; i < list.length; i++){
      const c = list[i], a = [...at, i];
      if (typeof c === 'string'){ if (!prim(c, a)) return false; }
      else if (c && c.loop !== undefined){
        const n = Math.max(0, Math.floor(Number(c.loop)) || 0);
        for (let k = 0; k < n; k++){ if (++ticks > tickCap){ error = 'steps'; return false; } if (!exec(c.body || [], [...a, 'body'])) return false; }
      } else if (c && c.if){
        if (++ticks > tickCap){ error = 'steps'; return false; }
        const key = isBlocked(rows, s) ? 'then' : 'else'; if (!exec(c[key] || [], [...a, key])) return false;
      }
    }
    return true;
  };
  exec(program || [], []);
  return { path, placed, dug, grid: rows, reached: cellAt(rows, s.x, s.z) === 'G', error };
}

// ---- program shape ----
export function countCmds(program){ let n = 0; for (const c of program || []){ n++; if (c && typeof c === 'object') n += countCmds(c.body) + countCmds(c.then) + countCmds(c.else); } return n; }
// { ok, reason }: only the tiles the band offers (a: arrows, place, dig; b: + loop; c: + if), loop counts 1..maxLoop, at most maxCmds tiles
export function validateProgram(program, band, maxCmds = Infinity){
  const walk = list => {
    if (!Array.isArray(list)) return 'not a list';
    for (const c of list){
      if (typeof c === 'string'){ if (!CODE.prims.includes(c)) return 'unknown command ' + c; continue; }
      if (c && c.loop !== undefined){ if (band === 'a') return 'loop is not in band a'; if (!Number.isInteger(c.loop) || c.loop < 1 || c.loop > 99) return 'bad loop count'; const r = walk(c.body); if (r) return r; continue; }
      if (c && c.if !== undefined){ if (band !== 'c') return 'if is not in band ' + band; if (c.if !== 'blocked') return 'unknown condition'; const r = walk(c.then || []) || walk(c.else || []); if (r) return r; continue; }
      return 'unknown command';
    }
    return null;
  };
  const reason = walk(program); if (reason) return { ok: false, reason };
  if (countCmds(program) > maxCmds) return { ok: false, reason: 'too many tiles' };
  return { ok: true, reason: null };
}

// ---- levels ----
// 5 wide, 4 deep. need.placeAt = cells a goal-less build level wants a block on (ghost marks); need.count = a free level's blocks.
const L = (grid, start, solution, maxCmds, goalText, hint, need = {}, extra = {}) => ({ grid, start, solution, maxCmds, goalText, hint, need, ...extra });
const N = { x: 0, z: 3, dir: 0 };
const LEVELS = {
  a: [
    L(['.....', '...G.', '.....', '.....'], N, ['F', 'F', 'R', 'F', 'F', 'F'], 8,
      { th: 'พาหุ่นยนต์ไปที่ธงทอง', en: 'Take the robot to the gold flag' }, { th: 'ลูกศรขึ้น = เดินหน้า ลูกศรโค้ง = เลี้ยว', en: 'Up arrow = walk, curved arrow = turn' }),
    L(['..~..', '..~G.', '..~..', '..~..'], N, ['F', 'F', 'R', 'F', 'PLACE', 'F', 'F'], 8,
      { th: 'มีแม่น้ำขวางทาง วางบล็อกลงในน้ำ แล้วไปที่ธง', en: 'A river is in the way. Place a block in it, then reach the flag' }, { th: 'ใช้ปุ่มวางบล็อกตรงหน้าหุ่นยนต์', en: 'Use the place tile in front of the robot' }),
    L(['...G.', '#####', '.....', '.....'], N, ['F', 'DIG', 'F', 'F', 'R', 'F', 'F', 'F'], 9,
      { th: 'ขุดกำแพง แล้วไปที่ธง', en: 'Dig through the wall, then reach the flag' }, { th: 'หุ่นยนต์ชนกำแพง ใช้ปุ่มขุด', en: 'The robot is blocked by the wall. Use the dig tile' }),
    L(['.....', '.....', '.....', '.....'], N, ['PLACE', 'R', 'F', 'PLACE', 'L', 'PLACE', 'L', 'PLACE'], 12,
      { th: 'ด่านอิสระ วางบล็อก 4 ก้อนที่ไหนก็ได้', en: 'Free level: place 4 blocks anywhere' }, { th: 'วางบล็อกได้ทีละก้อนตรงหน้าหุ่นยนต์', en: 'Place one block at a time in front of the robot' }, { count: 4 }, { free: true })
  ],
  b: [
    L(['...G.', '.....', '.....', '.....'], N, [{ loop: 3, body: ['F', 'R', 'F', 'L'] }], 6,
      { th: 'ขึ้นบันไดไปที่ธง ใช้ลูปให้สั้นลง', en: 'Climb the stairs to the flag. Use a loop to keep it short' }, { th: 'เดินหน้า เลี้ยวขวา เดินหน้า เลี้ยวซ้าย ซ้ำ 3 รอบ', en: 'Walk, turn right, walk, turn left. Repeat 3 times' }),
    L(['.~~~.', '.~~~.', '.~~~G', '.~~~.'], { x: 0, z: 2, dir: 1 }, [{ loop: 3, body: ['PLACE', 'F'] }, 'F'], 5,
      { th: 'ถมสระ 3 ก้อนด้วยลูป แล้วไปที่ธง', en: 'Fill the pond with a loop, then reach the flag' }, { th: 'วางบล็อก เดินหน้า ซ้ำ 3 รอบ แล้วเดินหน้าอีกครั้ง', en: 'Place, walk. Repeat 3 times, then walk once more' }),
    L(['.....', '.....', '.....', '.....'], N, [{ loop: 3, body: ['PLACE', 'R', 'F', 'L'] }, 'PLACE'], 6,
      { th: 'สร้างกำแพงบนช่องสีทอง 4 ช่อง', en: 'Build a wall on the 4 gold squares' }, { th: 'วางบล็อก เดินไปข้างๆ หันกลับ แล้วซ้ำ', en: 'Place, step sideways, turn back, repeat' },
      { placeAt: [[0, 2], [1, 2], [2, 2], [3, 2]] }),
    L(['.....', '.....', '.....', '.....'], N, [{ loop: 4, body: ['PLACE', 'R', 'F', 'L'] }, 'PLACE'], 9,
      { th: 'ด่านอิสระ วางบล็อก 5 ก้อนที่ไหนก็ได้', en: 'Free level: place 5 blocks anywhere' }, { th: 'ลองใช้ลูปวางบล็อกเป็นแถว', en: 'Try a loop to place a row of blocks' }, { count: 5 }, { free: true })
  ],
  c: [
    L(['.....', '.....', '..#.G', '.....'], { x: 0, z: 2, dir: 1 }, [{ loop: 5, body: [{ if: 'blocked', then: ['DIG'], else: ['F'] }] }], 4,
      { th: 'ถ้าชนกำแพงให้ขุด ไม่งั้นเดินหน้า ไปที่ธง', en: 'If blocked, dig. Otherwise walk. Reach the flag' }, { th: 'ลูปซ้ำ: ถ้าชน ทำช่อง ✓ ไม่ชน ทำช่อง ✗', en: 'Repeat: if blocked do the check box, if not do the cross box' }),
    L(['.....', '.....', '.#.#G', '.....'], { x: 0, z: 2, dir: 1 }, [{ loop: 6, body: [{ if: 'blocked', then: ['DIG'], else: ['F'] }] }], 4,
      { th: 'มีกำแพง 2 ชั้นขวางทาง ใช้ถ้าชน ขุด ไม่งั้นเดินหน้า', en: 'Two walls in the way. If blocked dig, otherwise walk' }, { th: 'ซ้ำให้พอ: เดินหน้า 3 ครั้ง ขุด 2 ครั้ง', en: 'Repeat enough times to walk and dig your way through' }),
    L(['...G#', '.....', '.....', '.....'], N, [{ loop: 7, body: [{ if: 'blocked', then: ['R'], else: ['F'] }] }], 4,
      { th: 'ถ้าชนขอบให้เลี้ยวขวา ไม่งั้นเดินหน้า ไปที่ธง', en: 'If blocked turn right, otherwise walk. Reach the flag' }, { th: 'เดินจนชนขอบ แล้วเลี้ยวขวา', en: 'Walk until you hit the edge, then turn right' }),
    L(['.....', '.....', '.....', '.....'], N, [{ loop: 4, body: ['PLACE', 'R', 'F', 'L'] }, 'PLACE', 'L', 'PLACE'], 10,
      { th: 'ด่านอิสระ วางบล็อก 6 ก้อนที่ไหนก็ได้', en: 'Free level: place 6 blocks anywhere' }, { th: 'ลูปช่วยวางบล็อกเป็นแถวได้', en: 'A loop helps place a row of blocks' }, { count: 6 }, { free: true })
  ]
};

// The hidden golden bolt (third star): the first open floor cell, scanning from the bottom right, that sits next to the stated solution's
// way but is not on it (and is not a gold mark), so the child has to wander one step off the shortest way to find it.
function pickSecret(d){
  const run = runProgram(d.grid, d.start, d.solution), on = new Set(run.path.map(e => e.x + ',' + e.z)), marks = placedKeys(d.need.placeAt);
  for (let z = d.grid.length - 1; z >= 0; z--) for (let x = d.grid[z].length - 1; x >= 0; x--){
    if (d.grid[z][x] !== '.' || on.has(x + ',' + z) || marks.has(x + ',' + z)) continue;
    if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => on.has((x + dx) + ',' + (z + dz)))) return [x, z];
  }
  return null;
}
// A level: { band, index, grid, start, goal: [x,z]|null, need, maxCmds, solution, free, goalText, hint, secret: [x,z]|null }
// opts.freeCount: blocks a free level needs (the room passes TUNING.quest.codeFreeA/B/C; default = the level table's count)
export function makeCodeLevel(band, level, { freeCount } = {}){
  const b = LEVELS[band] ? band : 'b', i = Math.max(0, Math.min(3, level | 0)), d = LEVELS[b][i];
  let goal = null; d.grid.forEach((r, z) => { const x = r.indexOf('G'); if (x >= 0) goal = [x, z]; });
  const need = JSON.parse(JSON.stringify(d.need)); let goalText = d.goalText;
  if (d.free){ const n = Math.max(1, Math.min(20, Math.round(freeCount ?? need.count))); need.count = n;
    goalText = { th: `ด่านอิสระ วางบล็อก ${n} ก้อนที่ไหนก็ได้`, en: `Free level: place ${n} block${n === 1 ? '' : 's'} anywhere` }; }
  return { band: b, index: i, grid: d.grid.slice(), start: { ...d.start }, goal, need, maxCmds: d.maxCmds, solution: JSON.parse(JSON.stringify(d.solution)),
    free: !!d.free, goalText, hint: d.hint, secret: pickSecret(d) };
}

const key = c => c[0] + ',' + c[1];
const placedKeys = placed => new Set((placed || []).map(key));
// does a finished run win the level? Goal levels need the flag, build levels every marked cell, free levels enough different blocks.
export function levelPassed(level, run){
  if (!run || run.error) return false;
  const p = placedKeys(run.placed);
  if (level.free) return p.size >= (level.need.count || 1);
  if (level.goal && !run.reached) return false;
  const marks = level.need.placeAt || [];
  if (!level.goal && !marks.length) return false;
  return marks.every(c => p.has(key(c)));
}

// ---- shortest flat plan (used for hints and level checks) ----
// Breadth first over primitive commands. PLACE is only tried where it can help (a hole, or a marked cell), DIG only on walls.
function bfs(level, s0, rows0, placed0, maxDepth = 26, cap = 60000){
  if (level.free) return null;
  const marks = placedKeys(level.need.placeAt), want = level.need.placeAt || [];
  const ok = (s, rows, placed) => (!level.goal || cellAt(rows, s.x, s.z) === 'G') && want.every(c => placed.has(key(c))) && (level.goal || want.length > 0);
  const id = (s, rows, placed) => s.x + ',' + s.z + ',' + s.dir + '|' + rows.join('/') + '|' + [...placed].sort().join(';');
  const start = { s: s0, rows: rows0, placed: placedKeys(placed0), plan: [] };
  if (ok(start.s, start.rows, start.placed)) return [];
  const seen = new Set([id(start.s, start.rows, start.placed)]); let frontier = [start], n = 0;
  for (let depth = 0; depth < maxDepth && frontier.length; depth++){
    const next = [];
    for (const nd of frontier) for (const cmd of ['F', 'L', 'R', 'PLACE', 'DIG']){
      const [fx, fz] = frontOf(nd.s), c = cellAt(nd.rows, fx, fz);
      if (cmd === 'PLACE' && !(c === '~' || (c === '.' && marks.has(fx + ',' + fz)))) continue;
      if (cmd === 'DIG' && c !== '#') continue;
      const r = applyPrim(nd.rows, nd.s, cmd); if (r.bump) continue;
      let placed = nd.placed; if (r.did === 'place'){ placed = new Set(placed); placed.add(key(r.cell)); }
      const k = id(r.s, r.rows, placed); if (seen.has(k)) continue; seen.add(k); if (++n > cap) return null;
      const plan = [...nd.plan, cmd]; if (ok(r.s, r.rows, placed)) return plan;
      next.push({ s: r.s, rows: r.rows, placed, plan });
    }
    frontier = next;
  }
  return null;
}
// the shortest flat program for a level from its start, or null (free levels have none)
export function solvePlan(level){ return bfs(level, level.start, level.grid, []); }

// ---- hints ----
// For a program that did not win: bumpCell/bumpAt (where the robot hit something), wrongAt (the first top-level tile that wasted a
// step: it did not bring the robot one step nearer for every primitive it ran), and next (the next correct command from the state
// just before that tile, or from the end of the program when nothing was wasted).
export function hintFor(level, program, run){
  const bumpE = run && run.path.find(e => e.bump), out = { wrongAt: null, bumpAt: bumpE ? bumpE.at : null, bumpCell: bumpE ? bumpE.bump : null, next: null };
  if (level.free){ const r = run && run.path.length ? run.path[run.path.length - 1] : level.start; out.next = isBlocked(run ? run.grid : level.grid, r) ? 'R' : 'PLACE'; return out; }
  const dist = (st, rows, placed) => { const p = bfs(level, st, rows, placed); return p ? p.length : Infinity; };
  let prev = { s: level.start, rows: level.grid, placed: [], steps: 0, d: dist(level.start, level.grid, []) }, before = prev;
  for (let i = 0; i < (program || []).length; i++){
    const r = runProgram(level.grid, level.start, program.slice(0, i + 1)), last = r.path[r.path.length - 1], st = { x: last.x, z: last.z, dir: last.dir };
    const cur = { s: st, rows: r.grid, placed: r.placed, steps: r.path.length - 1, d: dist(st, r.grid, r.placed) };
    const did = cur.steps - prev.steps, wasted = did > 0 && (cur.d === Infinity ? prev.d !== Infinity : cur.d > prev.d - did);
    if (wasted){ out.wrongAt = [i]; break; }
    prev = cur; before = cur;
  }
  const base = out.wrongAt ? before : prev, plan = bfs(level, base.s, base.rows, base.placed); out.next = plan && plan.length ? plan[0] : null;
  return out;
}

// ---- program editing (pure: each returns a new { program, cursor }) ----
// cursor = address of the list new tiles go to: [] (top level), [1,'body'], [1,'body',0,'then'] ...
const clone = o => JSON.parse(JSON.stringify(o));
export function listAt(program, container){ let l = program; for (let i = 0; i < container.length; i += 2) l = l[container[i]][container[i + 1]]; return l; }
export function appendCmd(st, cmd, maxCmds = Infinity){
  if (countCmds(st.program) >= maxCmds) return { program: clone(st.program), cursor: st.cursor.slice(), full: true };
  const program = clone(st.program), list = listAt(program, st.cursor), c = typeof cmd === 'string' ? cmd : clone(cmd); list.push(c);
  let cursor = st.cursor.slice(); if (typeof c === 'object') cursor = [...cursor, list.length - 1, c.loop !== undefined ? 'body' : 'then'];
  return { program, cursor, full: false };
}
const startsWith = (a, p) => p.length <= a.length && p.every((v, i) => a[i] === v);
export function removeAt(st, path){
  const program = clone(st.program), parent = path.slice(0, -1), idx = path[path.length - 1];
  listAt(program, parent).splice(idx, 1);
  let cursor = st.cursor.slice();
  if (startsWith(cursor, path)) cursor = parent;
  else if (startsWith(cursor, parent) && cursor.length > parent.length && cursor[parent.length] > idx) cursor[parent.length]--;
  return { program, cursor };
}
export function setLoopCount(st, path, n, max = CODE.maxLoop){
  const program = clone(st.program); let l = program; for (let i = 0; i < path.length - 1; i += 2) l = l[path[i]][path[i + 1]];
  l[path[path.length - 1]].loop = Math.max(1, Math.min(max, n | 0)); return { program, cursor: st.cursor.slice() };
}
