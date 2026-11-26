import { TUNING } from '../data/tuning.js';
// The home island, version 2 (64 x 64 cells). Layout designed in design/island/layout-spec-v2.md (map: map-v2.txt,
// generator: gen_map_v2.py). The numbers below are that spec; change the spec and these together.
// Cells are (x, z); north is -z. Rectangles are inclusive [x0, x1, z0, z1].
import * as THREE from 'three';
import { BLOCK } from '../world/voxel.js';
import { clay } from '../fx/materials.js';
import { rng } from '../core/core.js';

export const ISLAND = {
  size: 64, height: 16, ver: 2,
  ellipses: [[31, 31, 28, 23, 3], [31, 31, 25, 20, 4], [16, 18, 9, 9, 5], [16, 18, 6, 6, 6], [16, 18, 4, 4, 7], [16, 18, 2, 2, 8], [37, 29, 4, 4, 3]],   // cx, cz, rx, rz, top height (applied in order)
  rects: [[14, 18, 24, 28, 5], [20, 29, 28, 43, 4], [30, 32, 53, 54, 3]],                                                                               // x0, x1, z0, z1, top height
  pier: [30, 32, 55, 63], berth: [33, 34, 60, 62], landing: [30, 32, 53, 54], green: [28, 34, 43, 47], spawn: [31, 62],
  boardwalk: [[31, 31, 47, 54]],
  trails: [[16, 41, 45, 45], [41, 41, 36, 45], [33, 41, 36, 36], [33, 33, 24, 36], [16, 33, 24, 24], [16, 16, 17, 24], [16, 16, 24, 45], [41, 44, 39, 39],
           [17, 17, 24, 28], [16, 17, 28, 28], [31, 31, 45, 47], [18, 18, 45, 49], [18, 31, 49, 49], [31, 31, 36, 45], [31, 33, 36, 36]],
  track: [[40, 40, 41, 44]],
  trees: [[9, 22], [11, 27], [10, 32], [13, 33], [13, 18], [20, 16], [23, 17], [23, 21], [26, 18], [28, 16], [25, 46], [23, 47], [41, 48], [45, 45], [49, 32], [51, 35]],
  rocks: [[12, 30], [18, 18], [28, 21], [38, 28], [43, 33], [47, 28], [10, 40], [24, 50], [36, 49]],
  stars: [[31, 57], [31, 50], [31, 45], [35, 45], [41, 38], [41, 36], [36, 36], [36, 30], [33, 28], [26, 24], [16, 17], [16, 32], [20, 42], [21, 49], [28, 49]],
  spawners: [{ x: 49, z: 18, kind: 'jelly' }, { x: 50, z: 19, kind: 'beetle' }, { x: 53, z: 22, kind: 'spiky' }, { x: 47, z: 21, kind: 'moss' }, { x: 51, z: 16, kind: 'jelly' }],
  // islanders' plots: protected rectangle, standing cell, facing (yaw: 0 = south/+z, PI = north), 3 x 3 talk floor
  hosts: {
    sing:     { plot: [35, 41, 40, 45], at: [38, 42], face: 0,            floor: [37, 39, 43, 45], kart: [40, 42] },
    beaver:   { plot: [13, 18, 37, 41], at: [15, 39], face: Math.PI / 2,  floor: [16, 18, 38, 40] },
    mole:     { plot: [30, 35, 21, 27], at: [33, 23], face: 0,            floor: [32, 34, 24, 26] },
    pangolin: { plot: [42, 48, 37, 41], at: [45, 39], face: -Math.PI / 2, floor: [42, 44, 38, 40] },
    frog:     { plot: [14, 18, 24, 28], at: [16, 25], face: 0,            floor: [15, 17, 26, 28] }
  }
};
// no digging, no placing: the pier and its berth and landing, the arrival boardwalk, the village green and every islander's plot
export const PROTECTED = [ISLAND.pier, ISLAND.berth, ISLAND.landing, [31, 31, 47, 54], ISLAND.green, ...Object.values(ISLAND.hosts).map(h => h.plot)];
const inRect = (r, x, z) => x >= r[0] && x <= r[1] && z >= r[2] && z <= r[3];
export const locked = (x, z) => PROTECTED.some(r => inRect(r, x, z));

export function heightAt(x, z){
  let k = 0;
  for (const [cx, cz, rx, rz, h] of ISLAND.ellipses) if (((x - cx) / rx) ** 2 + ((z - cz) / rz) ** 2 <= 1) k = h;
  for (const r of ISLAND.rects) if (inRect(r, x, z)) k = r[4];
  return k;
}

// lays the whole island into the voxel world (a fresh world; saved worlds are loaded instead)
export function buildTerrain(game, tree){
  const W = game.world, N = W.N, r = rng(7);
  for (let x = 0; x < N; x++) for (let z = 0; z < N; z++){ const k = heightAt(x, z); if (!k) continue;
    for (let y = 0; y < k; y++){ let b = BLOCK.stone; if (y === 0) b = BLOCK.bedrock; else if (k === 3) b = y >= 1 ? BLOCK.sand : BLOCK.stone; else if (y === k - 1) b = BLOCK.grass; else if (y >= k - 3) b = BLOCK.soil;
      if (b === BLOCK.stone && r() < .06) b = BLOCK.gold; W.set(x, y, z, b); } }
  addOres(W, r);
  const top = (rects, b) => rects.forEach(([x0, x1, z0, z1]) => { for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++){ const y = W.top(x, z); if (y) W.set(x, y - 1, z, b); } });
  top(ISLAND.trails, BLOCK.soil); top(ISLAND.track, BLOCK.stone); top(ISLAND.boardwalk, BLOCK.planks);
  const [px0, px1, pz0, pz1] = ISLAND.pier; for (let x = px0; x <= px1; x++) for (let z = pz0; z <= pz1; z++) W.set(x, 2, z, BLOCK.planks);   // the deck, over open water
  ISLAND.rocks.forEach(([x, z]) => { const y = W.top(x, z); if (y) W.set(x, y, z, BLOCK.stone); });
  // trees: trunks go in even where a neighbour's leaves already hang over the cell
  ISLAND.trees.forEach(([x, z]) => { let y = W.H - 1; while (y > 0 && (!W.get(x, y, z) || W.get(x, y, z) === BLOCK.leaves)) y--; if (W.get(x, y, z) !== BLOCK.grass) return; const y0 = y + 1, h = x % 2 ? 4 : 5;
    for (let k = 0; k < h; k++) W.set(x, y0 + k, z, BLOCK.log);
    for (let dy = -2; dy <= 1; dy++){ const rad = dy === 1 ? 1 : 2; for (let dx = -rad; dx <= rad; dx++) for (let dz = -rad; dz <= rad; dz++){ if (Math.abs(dx) === rad && Math.abs(dz) === rad && (dy === 1 || r() < .6)) continue; const yy = y0 + h + dy; if (!W.get(x + dx, yy, z + dz)) W.set(x + dx, yy, z + dz, BLOCK.leaves); } } });
}
// flowers and grass tufts, away from paths (they only grow on grass) and out of the protected plots
export function scatter(game, seed = 9, n = 420){ const r = rng(seed), N = game.world.N; for (let i = 0; i < n; i++){ const x = 4 + (r() * (N - 8) | 0), z = 4 + (r() * (N - 8) | 0); if (!locked(x, z)) game.deco.add(x, z); } }

// ---------- props: simple clay shapes, palette from css/brand.css ----------
const C = { leaf: '#6BAF5D', oak: '#B57A4E', oakL: '#E0A86C', bark: '#5A3414', cream: '#F5E6D3', paper: '#FFF8EC', ink: '#3A1F08', sun: '#FFC94D', berry: '#E5484D', teal: '#2FB39E', steel: '#8E99A4' };
const mats = {}; const mat = c => mats[c] || (mats[c] = clay(c));
const box = (g, w, h, d, c, x, y, z) => { const e = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(c)); e.position.set(x, y, z); e.castShadow = e.receiveShadow = true; g.add(e); return e; };
const cyl = (g, r, h, c, x, y, z, seg = 12, r2 = r) => { const e = new THREE.Mesh(new THREE.CylinderGeometry(r2, r, h, seg), mat(c)); e.position.set(x, y, z); e.castShadow = true; g.add(e); return e; };
// a board with two lines of text (drawn on a canvas so Thai renders with the page fonts)
function board(lines, w, h, { bg = C.paper, fg = C.ink } = {}){
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = Math.round(512 * h / w); const x = cv.getContext('2d');
  x.fillStyle = bg; x.fillRect(0, 0, cv.width, cv.height); x.fillStyle = fg; x.textAlign = 'center'; x.textBaseline = 'middle';
  lines.forEach((t, i) => { const s = cv.height * (i ? .26 : .36); x.font = `700 ${s}px Mitr, Fredoka, Prompt, sans-serif`; x.fillText(t, cv.width / 2, cv.height * (lines.length === 1 ? .52 : i ? .74 : .34), cv.width * .92); });
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, roughness: .8 }));
}
// a sign on legs; the text faces +z (south) by default
function sign(lines, w = .88, h = .5, legs = .45){
  const g = new THREE.Group(); [-w * .36, w * .36].forEach(x => cyl(g, .045, legs + h * .5, C.oak, x, (legs + h * .5) / 2, -.03, 8));
  box(g, w + .08, h + .08, .07, C.bark, 0, legs + h / 2, 0); const b = board(lines, w, h); b.position.set(0, legs + h / 2, .04); g.add(b); return g;
}
function rope(g, a, b, sag = .11, c = C.cream, r = .025){
  const mid = a.clone().add(b).multiplyScalar(.5); mid.y -= sag;
  [[a, mid], [mid, b]].forEach(([p, q]) => { const d = q.clone().sub(p), e = new THREE.Mesh(new THREE.CylinderGeometry(r, r, d.length(), 6), mat(c)); e.position.copy(p).add(q).multiplyScalar(.5); e.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); g.add(e); });
}
export function buildPier(game){
  const W = game.world, g = new THREE.Group(), wx = i => W.wx(i), V = (x, y, z) => new THREE.Vector3(x, y, z);
  const posts = [];
  [55, 57, 59, 61, 63].forEach(z => [[30, -.3], [32, .3]].forEach(([x, dx]) => { const pile = z % 4 === 3, X = wx(x) + dx, Z = wx(z);
    if (pile){ cyl(g, .12, 2.05, C.bark, X, 2.375, Z); cyl(g, .14, .08, C.oakL, X, 3.44, Z); } else cyl(g, .06, .5, C.oak, X, 3.25, Z, 8);
    posts.push([x, X, Z]); }));
  [30, 32].forEach(x => { const col = posts.filter(p => p[0] === x); for (let i = 0; i < col.length - 1; i++) rope(g, V(col[i][1], 3.32, col[i][2]), V(col[i + 1][1], 3.32, col[i + 1][2])); });
  [[30, -.3], [32, .3]].forEach(([x, dx]) => { const l = new THREE.Group(); box(l, .2, .22, .2, C.sun, 0, .16, 0).material = new THREE.MeshStandardMaterial({ color: C.sun, emissive: '#ffb300', emissiveIntensity: .6, roughness: .5 });
    box(l, .24, .04, .24, C.bark, 0, .03, 0); box(l, .24, .04, .24, C.bark, 0, .29, 0); [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => box(l, .03, .24, .03, C.bark, a * .1, .16, b * .1)); l.position.set(wx(x) + dx, 3.48, wx(55)); g.add(l); if (game.day) game.day.lamp(new THREE.Vector3(wx(x) + dx, 3.7, wx(55)), l.children[0].material); });
  // the welcome sign and the race signs are out for now (owner, 2026-11-26)
  // the boat we arrived in: rounded oak hull, two seats, teal rails, moored in the berth with its bow to the north
  const b = new THREE.Group(), hull = new THREE.Mesh(new THREE.CapsuleGeometry(.5, 1.3, 6, 14), mat(C.oak)); hull.rotation.x = Math.PI / 2; hull.scale.set(1.1, 1, .55); hull.castShadow = true; b.add(hull);
  const well = new THREE.Mesh(new THREE.CapsuleGeometry(.4, 1.15, 6, 14), mat(C.oakL)); well.rotation.x = Math.PI / 2; well.scale.set(1.1, 1, .3); well.position.y = .18; b.add(well);
  box(b, .82, .06, .22, C.oakL, 0, .24, -.35); box(b, .82, .06, .22, C.oakL, 0, .24, .35); box(b, .05, .07, 1.5, C.teal, -.5, .27, 0); box(b, .05, .07, 1.5, C.teal, .5, .27, 0); cyl(b, .05, .12, C.cream, 0, .3, -.95, 8);
  b.position.set(wx(33) + .16, 2.93, wx(61)); g.add(b); g.userData.boat = b;
  rope(g, V(wx(32) + .3, 3.32, wx(61)), V(wx(33) + .16, 3.2, wx(60) + .1), .1, C.cream, .02);
  game.scene.add(g); return g;
}
// Zoomy Fox's plot: the stone strip gets a checkered start line, cones, a tyre stack and a sign now; the banner rises when his kart is built
export function buildRacePlot(game){
  const W = game.world, g = new THREE.Group(), wx = i => W.wx(i), y0 = 4;
  const line = new THREE.Group(); for (let r = 0; r < 2; r++) for (let i = 0; i < 4; i++) box(line, .24, .02, .19, (r + i) % 2 ? C.paper : C.ink, -.36 + i * .24, 0, r * .19); line.position.set(wx(40), y0 + .012, wx(44) + .04); g.add(line);
  [-.24, .24].forEach(dz => { const c = new THREE.Group(); box(c, .25, .04, .25, C.bark, 0, .02, 0); cyl(c, .11, .33, C.berry, 0, .2, 0, 12, .02); cyl(c, .085, .06, C.cream, 0, .17, 0, 12, .068); c.position.set(wx(36) + .02, y0, wx(43) + dz); g.add(c); });
  const t = new THREE.Group(); [0, 1, 2].forEach(i => cyl(t, .22, .15, C.ink, 0, .08 + i * .16, 0, 16)); cyl(t, .1, .02, C.bark, 0, .48, 0, 12); t.position.set(wx(41) + .22, y0, wx(42)); g.add(t);

  // start banner: two bark posts, a sun panel with checks at each end and a kart mark, bunting above
  const b = new THREE.Group(), bw = 2.84; [-1.48, 1.48].forEach(x => cyl(b, .09, 3.15, C.bark, x, 1.575, 0));
  box(b, bw, .82, .12, C.sun, 0, 2.61, 0); const face = new THREE.Group(); face.position.set(0, 2.61, .065); b.add(face);
  [-1, 1].forEach(sd => { for (let r = 0; r < 2; r++) for (let i = 0; i < 3; i++) box(face, .17, .17, .02, (r + i) % 2 ? C.paper : C.ink, sd * (bw / 2 - .16 - i * .17), .1 - r * .17, 0); });
  box(face, .62, .2, .02, C.ink, 0, .02, 0); box(face, .3, .16, .02, C.ink, -.06, .2, 0); [-.2, .2].forEach(x => { const w = cyl(face, .11, .03, C.ink, x, -.13, 0, 14); w.rotation.x = Math.PI / 2; const h = cyl(face, .045, .035, C.sun, x, -.13, 0, 10); h.rotation.x = Math.PI / 2; });
  const V = (x, y) => new THREE.Vector3(x, y, 0); rope(b, V(-1.48, 3.1), V(1.48, 3.1), .16, C.cream, .018);
  [-1, -.5, 0, .5, 1].forEach((x, i) => { const f = new THREE.Mesh(new THREE.ConeGeometry(.12, .22, 3), mat([C.teal, C.berry, C.cream][i % 3])); f.rotation.x = Math.PI; f.scale.z = .2; f.position.set(x, 2.96 - (1 - Math.abs(x)) * .13, 0); b.add(f); });
  b.position.set(wx(38), y0, wx(40)); g.userData.banner = b;   // the big banner is not shown for now; the quest still drives it harmlessly
  game.scene.add(g); return g;
}

// Ores (owner 2026-11-27): buried stone (stone with a block on top) sometimes turns into iron, copper, silver or diamond ore.
// Silver and diamond only lie deep. Also run once on islands saved before ores existed (home.js). Chances live in TUNING.ore.
export function addOres(W, r = Math.random){
  const O = TUNING.ore, N = W.N; let n = 0;
  for (let x = 0; x < N; x++) for (let z = 0; z < N; z++) for (let y = 1; y < W.H - 1; y++){
    if (W.get(x, y, z) !== BLOCK.stone || !W.get(x, y + 1, z)) continue;
    const u = r(); let b = 0, c = 0;
    if (y <= O.diamondDepth && u < (c += O.diamondChance)) b = BLOCK.diamond_ore;
    else if (y <= O.silverDepth && u < (c += O.silverChance)) b = BLOCK.silver_ore;
    else if (u < (c += O.copperChance)) b = BLOCK.copper_ore;
    else if (u < (c += O.ironChance)) b = BLOCK.iron_ore;
    if (b){ W.set(x, y, z, b); n++; } }
  return n;
}
