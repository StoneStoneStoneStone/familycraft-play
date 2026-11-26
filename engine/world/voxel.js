// Block world: a box of cells (x, y, z), one byte per cell, drawn as textured cubes (one InstancedMesh per
// block type, only blocks with an open face). Textures are small pixel tiles made in code, so the world
// reads like a block game while keeping our warm colours. Physics, targeting and the camera read it.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

// Block registry. tool: which tool digs it fast; needs: tool required for it to drop anything;
// hard: seconds to dig by hand; drop: item id (or a function for random drops).
export const BLOCKS = [
  { id: 'air' },
  { id: 'grass',  solid: true, tool: 'shovel',  hard: .9,  drop: 'soil',   tex: ['grass_side', 'grass_side', 'grass_top', 'soil', 'grass_side', 'grass_side'] },
  { id: 'soil',   solid: true, tool: 'shovel',  hard: .75, drop: 'soil',   tex: 'soil' },
  { id: 'stone',  solid: true, tool: 'pickaxe', hard: 5,   drop: 'stone', needs: 'pickaxe', tex: 'stone' },
  { id: 'log',    solid: true, tool: 'axe',     hard: 3,   drop: 'log',    tex: ['log_side', 'log_side', 'log_top', 'log_top', 'log_side', 'log_side'] },
  { id: 'planks', solid: true, tool: 'axe',     hard: 2.5, drop: 'planks', tex: 'planks' },
  { id: 'leaves', solid: true, tool: 'any',     hard: .3,  drop: () => Math.random() < .2 ? 'apple' : null, tex: 'leaves' },
  { id: 'sand',   solid: true, tool: 'shovel',  hard: .75, drop: 'sand',   tex: 'sand' },
  { id: 'brick',  solid: true, tool: 'pickaxe', hard: 4,   drop: 'brick', needs: 'pickaxe', tex: 'brick' },
  { id: 'gold',   solid: true, tool: 'pickaxe', hard: 6,   drop: 'gold',  needs: 'pickaxe', tex: 'gold' },
  { id: 'bedrock', solid: true, tool: 'none',   hard: Infinity, tex: 'bedrock' },
  { id: 'bed',    solid: true, tool: 'axe',     hard: 1,   drop: 'bed',    tex: ['bed_side', 'bed_side', 'bed_top', 'planks', 'bed_side', 'bed_side'], short: true },
  { id: 'farmland', solid: true, tool: 'shovel', hard: .75, drop: 'soil', tex: ['soil', 'soil', 'farm_dry', 'soil', 'soil', 'soil'], farm: true },
  { id: 'farmwet',  solid: true, tool: 'shovel', hard: .75, drop: 'soil', tex: ['soil_wet', 'soil_wet', 'farm_wet', 'soil', 'soil_wet', 'soil_wet'], farm: true, wet: true },
  // ores (owner 2026-11-27): stone with coloured nuggets; a pickaxe digs out the material for better swords
  { id: 'iron_ore',    solid: true, tool: 'pickaxe', hard: 6, drop: 'iron',    needs: 'pickaxe', tex: 'iron_ore' },
  { id: 'copper_ore',  solid: true, tool: 'pickaxe', hard: 6, drop: 'copper',  needs: 'pickaxe', tex: 'copper_ore' },
  { id: 'silver_ore',  solid: true, tool: 'pickaxe', hard: 7, drop: 'silver',  needs: 'pickaxe', tex: 'silver_ore' },
  { id: 'diamond_ore', solid: true, tool: 'pickaxe', hard: 9, drop: 'diamond', needs: 'pickaxe', tex: 'diamond_ore' }
];
export const BLOCK = Object.fromEntries(BLOCKS.map((b, i) => [b.id, i]));

// ---- 16x16 pixel tiles, drawn once ----
function tile(draw){ const c = document.createElement('canvas'); c.width = c.height = 16; const g = c.getContext('2d'); draw(g);
  const t = new THREE.CanvasTexture(c); t.magFilter = THREE.NearestFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.anisotropy = 8; t.colorSpace = THREE.SRGBColorSpace; return t; }
function rnd(seed){ let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; }
function noise(g, base, vary, seed, alpha = 1){ const r = rnd(seed); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++){ const k = (r() - .5) * vary; g.fillStyle = shade(base, k); g.globalAlpha = alpha; g.fillRect(x, y, 1, 1); } g.globalAlpha = 1; }
function shade(hex, k){ const n = parseInt(hex.slice(1), 16), f = v => Math.max(0, Math.min(255, Math.round(v + k * 255))); return `rgb(${f(n >> 16)},${f(n >> 8 & 255)},${f(n & 255)})`; }
function edge(g, k = -.06){ g.fillStyle = k < 0 ? `rgba(0,0,0,${-k})` : `rgba(255,255,255,${k})`; g.fillRect(0, 15, 16, 1); g.fillRect(15, 0, 1, 16); g.fillStyle = 'rgba(255,255,255,.05)'; g.fillRect(0, 0, 16, 1); g.fillRect(0, 0, 1, 16); }
// Look E (owner approved 2026-11-26, reference familycraft-plan/look-study.html): chunky 2-3 px clumps instead of per-pixel noise,
// CI colours, grass that hangs over the side as paint, and four variants of each ground kind so neighbours differ.
function clumps(g, r, n, cols, min = 2, max = 3){ for (let i = 0; i < n; i++){ g.fillStyle = cols[i % cols.length]; const w = min + (r() * (max - min + 1) | 0), h = min + (r() * (max - min + 1) | 0), x = r() * 16 | 0, y = r() * 16 | 0;
  g.fillRect(x, y, w, h); if (r() < .5) g.fillRect(x + 1, y + h, Math.max(1, w - 1), 1); } }
const VARIANTS = 4, V = make => { const a = []; for (let v = 0; v < VARIANTS; v++) a.push(make(v + 1)); return a; };   // a tile with variants is an array
const T = {
  grass_top: V(s => tile(g => { const r = rnd(s * 7 + 3); g.fillStyle = '#62B451'; g.fillRect(0, 0, 16, 16); const n = [2, 5, 0, 3][s % 4]; clumps(g, r, n, ['#6EBD5A', '#58A94A', '#69B957'], 1, 4); if (s % 4 === 1 && r() < .7){ const x = 2 + r() * 11 | 0, y = 2 + r() * 11 | 0; g.fillStyle = '#FFFFFF'; g.fillRect(x, y, 1, 1); g.fillRect(x + 1, y + 1, 1, 1); g.fillStyle = '#FFC94D'; g.fillRect(x + 1, y, 1, 1); } })),
  grass_side: V(s => tile(g => { const r = rnd(s * 13 + 5); g.fillStyle = '#CF8748'; g.fillRect(0, 0, 16, 16); clumps(g, r, [2, 4, 1, 3][s % 4], ['#BC7640', '#DB9858'], 1, 4); g.fillStyle = '#62B451'; g.fillRect(0, 0, 16, 3); for (let x = 0; x < 16; x += 2){ const d = 3 + (r() * 4 | 0); g.fillStyle = r() < .5 ? '#62B451' : '#5A9C4D'; g.fillRect(x, 0, 2, d); } })),
  soil: V(s => tile(g => { const r = rnd(s * 11 + 9); g.fillStyle = '#CF8748'; g.fillRect(0, 0, 16, 16); clumps(g, r, [3, 6, 1, 5][s % 4], ['#BC7640', '#DB9858', '#C47E46'], 1, 4); })),
  stone: V(s => tile(g => { const r = rnd(s * 11 + 4); g.fillStyle = '#A9B0B8'; g.fillRect(0, 0, 16, 16); clumps(g, r, [2, 4, 1, 3][s % 4], ['#B4BBC2', '#A0A7AF'], 1, 4); g.fillStyle = '#8A929B'; g.fillRect(0, 7, 16, 1); g.fillRect(0, 15, 16, 1); const o = r() * 6 | 0; g.fillRect(4 + o, 0, 1, 7); g.fillRect((10 + o) % 16, 8, 1, 7); g.fillStyle = '#C6CCD2'; g.fillRect(0, 0, 16, 1); g.fillRect(0, 8, 16, 1); })),
  log_side:   tile(g => { for (let x = 0; x < 16; x++){ g.fillStyle = shade('#8a5530', (x % 4 === 0 ? -.08 : 0) + (Math.sin(x * 2.1) * .03)); g.fillRect(x, 0, 1, 16); } const r = rnd(2); g.fillStyle = 'rgba(40,20,5,.3)'; for (let i = 0; i < 5; i++) g.fillRect(r() * 16 | 0, r() * 13 | 0, 1, 3); edge(g); }),
  log_top:    tile(g => { g.fillStyle = '#8a5530'; g.fillRect(0, 0, 16, 16); g.fillStyle = '#d9a86a'; g.fillRect(1, 1, 14, 14); g.strokeStyle = '#b8844a'; g.lineWidth = 1; g.strokeRect(3.5, 3.5, 9, 9); g.strokeRect(6.5, 6.5, 3, 3); }),
  planks: tile(g => { const r = rnd(17); g.fillStyle = '#D9A066'; g.fillRect(0, 0, 16, 16); clumps(g, r, 5, ['#E4B27A', '#C98E55']); g.fillStyle = '#9A6436'; [3, 7, 11, 15].forEach(y => g.fillRect(0, y, 16, 1)); [[5, 0], [12, 4], [3, 8], [10, 12]].forEach(([x, y]) => g.fillRect(x, y, 1, 3)); }),
  leaves: V(s => tile(g => { const r = rnd(s * 5 + 19); g.fillStyle = '#4FAD47'; g.fillRect(0, 0, 16, 16); clumps(g, r, 6, ['#63C056', '#439A3E']); })),
  sand: V(s => tile(g => { const r = rnd(s * 11 + 23); g.fillStyle = '#F5D67F'; g.fillRect(0, 0, 16, 16); for (let i = 0; i < 4; i++){ const y = r() * 14 | 0, x = r() * 8 | 0; g.fillStyle = i % 2 ? '#E2C276' : '#F8E3A8'; g.fillRect(x, y, 5 + (r() * 5 | 0), 1); g.fillRect(x + 3, y + 1, 4, 1); } })),
  brick:      tile(g => { g.fillStyle = '#d8d0c4'; g.fillRect(0, 0, 16, 16); const r = rnd(8); for (let row = 0; row < 4; row++) for (let i = -1; i < 3; i++){ const x = i * 8 + (row % 2 ? 4 : 0); g.fillStyle = shade('#d4553a', (r() - .5) * .12); g.fillRect(x + 1, row * 4 + 1, 7, 3); } }),
  gold: tile(g => { const r = rnd(29); g.fillStyle = '#A9B0B8'; g.fillRect(0, 0, 16, 16); clumps(g, r, 4, ['#B9C0C7', '#98A0A8']); for (let i = 0; i < 6; i++){ g.fillStyle = i % 2 ? '#FFC94D' : '#F5A623'; const x = r() * 13 | 0, y = r() * 13 | 0; g.fillRect(x, y, 2 + (r() * 2 | 0), 2); } }),
  // ore tiles: the stone look with chunky nuggets, each with a dark edge and a light glint so they read at a distance
  ...Object.fromEntries([['iron_ore', '#7A8799', '#3E4756', 61], ['copper_ore', '#F08A4B', '#C25A2C', 67], ['silver_ore', '#F4F8FF', '#B8C6D8', 71], ['diamond_ore', '#7FF0F5', '#2FB3C6', 73]].map(([k, a, d, sd]) => [k, tile(g => {
    const r = rnd(sd); g.fillStyle = '#A9B0B8'; g.fillRect(0, 0, 16, 16); clumps(g, r, 3, ['#B4BBC2', '#A0A7AF'], 1, 3);
    [[2, 2], [9, 3], [4, 9], [11, 10], [7, 13]].forEach(([x, y], i) => { if (k === 'diamond_ore' && i > 3) return; const w = 2 + (r() * 2 | 0); g.fillStyle = '#6E757D'; g.fillRect(x, y + 1, w + 1, 2); g.fillStyle = d; g.fillRect(x, y, w, 2); g.fillStyle = a; g.fillRect(x, y, w - 1, 1); g.fillStyle = '#FFFFFF'; g.fillRect(x, y, 1, 1); });
  })])),
  bedrock: tile(g => { const r = rnd(31); g.fillStyle = '#55565E'; g.fillRect(0, 0, 16, 16); clumps(g, r, 8, ['#63646D', '#45464D']); }),
  farm_dry:   tile(g => { noise(g, '#b47a46', .12, 43); g.fillStyle = 'rgba(70,35,10,.45)'; [2, 6, 10, 14].forEach(y => g.fillRect(0, y, 16, 1)); g.fillStyle = 'rgba(255,220,170,.18)'; [1, 5, 9, 13].forEach(y => g.fillRect(0, y, 16, 1)); edge(g); }),
  farm_wet:   tile(g => { noise(g, '#6e4424', .12, 47); g.fillStyle = 'rgba(30,12,0,.5)'; [2, 6, 10, 14].forEach(y => g.fillRect(0, y, 16, 1)); g.fillStyle = 'rgba(160,200,255,.18)'; [1, 5, 9, 13].forEach(y => g.fillRect(0, y, 16, 1)); edge(g); }),
  soil_wet: tile(g => { const r = rnd(53); g.fillStyle = '#8A5A34'; g.fillRect(0, 0, 16, 16); clumps(g, r, 8, ['#7A4C2A', '#9A6A40']); }),
  bed_top:    tile(g => { g.fillStyle = '#e8574a'; g.fillRect(0, 0, 16, 16); noise(g, '#e8574a', .08, 37, .6); g.fillStyle = '#fff6e8'; g.fillRect(1, 1, 14, 5); g.fillStyle = 'rgba(0,0,0,.12)'; g.fillRect(0, 6, 16, 1); g.fillStyle = 'rgba(255,255,255,.25)'; for (let x = 2; x < 16; x += 4) g.fillRect(x, 9, 2, 5); }),
  bed_side:   tile(g => { noise(g, '#d29a5c', .1, 41); g.fillStyle = '#e8574a'; g.fillRect(0, 2, 16, 6); g.fillStyle = 'rgba(0,0,0,.2)'; g.fillRect(0, 8, 16, 1); g.fillStyle = '#8a5530'; g.fillRect(0, 12, 2, 4); g.fillRect(14, 12, 2, 4); })
};
const tex = (k, v = 0) => Array.isArray(T[k]) ? T[k][v % VARIANTS] : T[k];
const faces = b => Array.isArray(b.tex) ? b.tex : Array(6).fill(b.tex);
export const blockMaterials = BLOCKS.map(b => { if (!b.tex) return null; const cache = {}; return faces(b).map(k => cache[k] || (cache[k] = new THREE.MeshStandardMaterial({ map: tex(k), roughness: .92, metalness: 0 }))); });
// world materials: vertex colours carry the top-to-bottom shading of look E; leaves stay matte
const variantsOf = b => faces(b).some(k => Array.isArray(T[k])) ? VARIANTS : 1;
const worldMaterials = (b, v) => { const cache = {}; return faces(b).map(k => cache[k] || (cache[k] = new THREE.MeshStandardMaterial({ map: tex(k, v), vertexColors: true, roughness: b.id === 'leaves' ? 1 : .88, metalness: 0 }))); };
export function blockIcon(id){ const b = BLOCKS[BLOCK[id]]; if (!b || !b.tex) return ''; const f = Array.isArray(b.tex) ? b.tex : Array(6).fill(b.tex); return [tex(f[2]), tex(f[0])].map(t => t.image.toDataURL()); }

const LOCKED = new THREE.Color(.80, .77, .72), FREE = new THREE.Color(1, 1, 1), TINT = new THREE.Color();
// grey light factor per vertex: top faces 1, sides from .98 at the top edge down to .74 at the foot (flat = no gradient, for leaves)
function shadeGeo(geo, grad){ const pos = geo.attributes.position, nrm = geo.attributes.normal, n = pos.count, c = new Float32Array(n * 3);
  for (let i = 0; i < n; i++){ const k = !grad || nrm.getY(i) > .6 ? 1 : .74 + .24 * (pos.getY(i) + .5); c.set([k, k, k], i * 3); } geo.setAttribute('color', new THREE.BufferAttribute(c, 3)); return geo; }
const hash = (x, y, z) => { let h = (x * 374761393 + y * 668265263 + z * 2147483647) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return (h ^ (h >>> 16)) >>> 0; };
const LEAF_BAND = [1.16, 1.04, .93, .83];   // a crown is painted in bands: brightest on top, darker toward its base   // cells nobody may dig or build on read a little darker and warmer
export class VoxelWorld {
  constructor(scene, { size = 32, height = 16 } = {}){
    this.N = size; this.H = height; this.H0 = (size - 1) / 2; this.cells = new Uint8Array(size * size * height);
    this.scene = scene; this.dirty = true; this.meshes = {};
    // look E: softly rounded clay blocks, lighter on top and darker toward the foot (vertex colours). Phones get a lighter bevel.
    const seg = matchMedia('(pointer:coarse)').matches ? 1 : 2, round = shadeGeo(new RoundedBoxGeometry(1, 1, 1, seg, .045), true), square = shadeGeo(new THREE.BoxGeometry(1, 1, 1), false);
    this.nv = {};
    this.core = new THREE.InstancedMesh(new THREE.BoxGeometry(.97, .97, .97), new THREE.MeshStandardMaterial({ color: '#3B2A1E', roughness: 1 }), size * size * 3); this.core.count = 0; this.core.frustumCulled = false; this.core.receiveShadow = true; scene.add(this.core);
    BLOCKS.forEach((b, i) => { if (!b.tex) return; const nv = this.nv[i] = variantsOf(b), big = i === BLOCK.soil || i === BLOCK.stone || i === BLOCK.grass || i === BLOCK.sand;
      for (let v = 0; v < nv; v++){ const im = new THREE.InstancedMesh(i === BLOCK.leaves ? square : round, worldMaterials(b, v), big ? size * size * 2 : 6000);   // leaves stay square so a crown reads as one painted shape
        im.castShadow = im.receiveShadow = true; im.frustumCulled = false; im.count = 0; scene.add(im); this.meshes[i + '_' + v] = im; } });
  }
  idx(x, y, z){ return (y * this.N + z) * this.N + x; }
  inside(x, y, z){ return x >= 0 && z >= 0 && y >= 0 && x < this.N && z < this.N && y < this.H; }
  get(x, y, z){ return this.inside(x, y, z) ? this.cells[this.idx(x, y, z)] : 0; }
  // lock(x, z): cells nobody may change once the room is built (islanders' plots, the pier); a room sets it after laying its terrain
  set(x, y, z, b){ if (!this.inside(x, y, z) || (this.lock && this.lock(x, z))) return false; this.cells[this.idx(x, y, z)] = b; this.dirty = true;
    if (b && this.get(x, y - 1, z) === BLOCK.grass) this.cells[this.idx(x, y - 1, z)] = BLOCK.soil;      // grass under a block turns to soil
    return true; }
  solid(x, y, z){ return !!(BLOCKS[this.get(x, y, z)] || {}).solid; }
  cellOf(px, py, pz){ return [Math.round(px + this.H0), Math.floor(py), Math.round(pz + this.H0)]; }
  wx(i){ return i - this.H0; }
  center(x, y, z){ return new THREE.Vector3(this.wx(x), y + .5, this.wx(z)); }
  top(x, z){ for (let y = this.H - 1; y >= 0; y--) if (this.solid(x, y, z)) return y + 1; return 0; }
  topBlock(x, z){ for (let y = this.H - 1; y >= 0; y--){ const b = this.get(x, y, z); if (b) return { y, b }; } return null; }
  boxHits(x0, y0, z0, x1, y1, z1){
    const H = this.H0;
    for (let x = Math.round(x0 + H); x <= Math.round(x1 + H); x++)
      for (let z = Math.round(z0 + H); z <= Math.round(z1 + H); z++)
        for (let y = Math.floor(y0); y <= Math.floor(y1 - 1e-6); y++) if (this.solid(x, y, z)) return true;
    return false;
  }
  lineHit(a, b, step = .12){
    const d = b.clone().sub(a), L = d.length(); d.normalize();
    for (let t = 0; t < L; t += step){ const p = a.clone().addScaledVector(d, t); const [x, y, z] = this.cellOf(p.x, p.y, p.z); if (this.solid(x, y, z)) return t; }
    return null;
  }
  // voxel ray walk (Amanatides & Woo). Returns the first solid cell and the face we came through.
  raycast(origin, dir, maxDist = 6){
    const o = { x: origin.x + this.H0 + .5, y: origin.y, z: origin.z + this.H0 + .5 }, d = dir.clone().normalize();
    let x = Math.floor(o.x), y = Math.floor(o.y), z = Math.floor(o.z);
    const sx = Math.sign(d.x), sy = Math.sign(d.y), sz = Math.sign(d.z);
    const tdx = sx ? Math.abs(1 / d.x) : Infinity, tdy = sy ? Math.abs(1 / d.y) : Infinity, tdz = sz ? Math.abs(1 / d.z) : Infinity;
    let tx = sx > 0 ? (x + 1 - o.x) * tdx : sx < 0 ? (o.x - x) * tdx : Infinity, ty = sy > 0 ? (y + 1 - o.y) * tdy : sy < 0 ? (o.y - y) * tdy : Infinity, tz = sz > 0 ? (z + 1 - o.z) * tdz : sz < 0 ? (o.z - z) * tdz : Infinity;
    let n = [0, 0, 0], t = 0;
    for (let i = 0; i < 64 && t <= maxDist; i++){
      if (this.solid(x, y, z)) return { x, y, z, n, t };
      if (tx < ty && tx < tz){ x += sx; t = tx; tx += tdx; n = [-sx, 0, 0]; } else if (ty < tz){ y += sy; t = ty; ty += tdy; n = [0, -sy, 0]; } else { z += sz; t = tz; tz += tdz; n = [0, 0, -sz]; }
    }
    return null;
  }
  rebuild(){
    if (!this.dirty) return; this.dirty = false; const M = new THREE.Matrix4(), n = {}; let nc = 0; for (const k in this.meshes) n[k] = 0;
    const N = this.N, H = this.H;
    for (let y = 0; y < H; y++) for (let z = 0; z < N; z++) for (let x = 0; x < N; x++){
      const b = this.get(x, y, z); if (!b || !this.nv[b]) continue;
      const leafy = b2 => !b2 || b2 === BLOCK.leaves;
      const open = leafy(this.get(x + 1, y, z)) || leafy(this.get(x - 1, y, z)) || leafy(this.get(x, y + 1, z)) || leafy(this.get(x, y, z + 1)) || leafy(this.get(x, y, z - 1)) || (y > 0 && leafy(this.get(x, y - 1, z)));
      if (!open) continue;
      const h = hash(x, y, z), key = b + '_' + (this.nv[b] > 1 ? h & 3 : 0), m = this.meshes[key];
      if (n[key] < m.instanceMatrix.count){
        // per-block tint: a small random lightness so no two blocks match, a darker warm tone on protected ground, bands on tree crowns
        let k = 1 + ((h >>> 8 & 255) / 255 - .5) * .035;   // a very small difference only: larger made a checkerboard far away
        if (b === BLOCK.leaves){ let up = 0; while (up < 3 && this.get(x, y + up + 1, z) === BLOCK.leaves) up++; k *= LEAF_BAND[up]; }
        TINT.copy(this.lock && this.px !== undefined && Math.abs(x - this.px) <= 2 && Math.abs(z - this.pz) <= 2 && this.lock(x, z) ? LOCKED : FREE).multiplyScalar(k); m.setColorAt(n[key], TINT);
        if (BLOCKS[b].short){ M.makeScale(1, .56, 1); M.setPosition(this.wx(x), y + .28, this.wx(z)); } else { M.makeTranslation(this.wx(x), y + .5, this.wx(z)); if (b !== BLOCK.leaves && nc < this.core.instanceMatrix.count) this.core.setMatrixAt(nc++, M); } m.setMatrixAt(n[key]++, M); }
    }
    this.core.count = nc; this.core.instanceMatrix.needsUpdate = true;
    for (const k in this.meshes){ this.meshes[k].count = n[k]; this.meshes[k].instanceMatrix.needsUpdate = true; if (this.meshes[k].instanceColor) this.meshes[k].instanceColor.needsUpdate = true; }
  }
  save(){ const out = []; let last = -1, run = 0; for (const v of this.cells){ if (v === last && run < 65535) run++; else { if (run) out.push(last, run); last = v; run = 1; } } out.push(last, run); return out; }
  load(rle){ let i = 0; for (let k = 0; k < rle.length; k += 2){ this.cells.fill(rle[k], i, i + rle[k + 1]); i += rle[k + 1]; } this.dirty = true; }
}
