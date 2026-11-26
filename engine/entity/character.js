// Characters: load a rigged clay figure (GLB with bones hips, chest, head, armL/R, foreL/R, handL/R,
// legL/R, shinL/R) and drive it with code-made poses. One Animator per figure; it blends idle, walk,
// air, and one-shot actions (punch, slash, eat, hurt) and keeps the held item in the right hand.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { swayWear } from './wearables.js';
import { clay, roundBox, shadowAll } from '../fx/materials.js';

export const CHARACTERS = [
  { id: 'boy',   size: 1.45, sleeve: '#f2b62c', th: 'ต้นกล้า', en: 'Tonkla' },
  { id: 'stark', size: 1.45, sleeve: '#2f7fe0', th: 'ต้นข้าว', en: 'Tonkhao' },
  { id: 'girl',  size: 1.45, th: 'ใบข้าว',  en: 'Baikhao' },
  { id: 'boy2',  size: 1.45, th: 'ภูผา',    en: 'Phupha' },
  { id: 'girl2', size: 1.45, th: 'น้ำใส',   en: 'Namsai' },
  { id: 'boy3',  size: 1.45, th: 'ตะวัน',   en: 'Tawan' },
  { id: 'girl3', size: 1.45, th: 'มะลิ',    en: 'Mali' },
  { id: 'girl4', size: 1.45, th: 'น้ำผึ้ง',  en: 'Namphueng' },
  { id: 'man',   size: 1.85, sleeve: '#3a78c9', th: 'พ่อ',     en: 'Dad' },
  { id: 'woman', size: 1.8,  sleeve: '#d26f78', th: 'แม่',     en: 'Mum' }
];
const loader = new GLTFLoader(), cache = new Map();
// Each call returns a fresh copy (SkeletonUtils.clone), so two players can wear the same character.
function template(def){
  if (!cache.has(def.id)) cache.set(def.id, new Promise(res => loader.load(def.file || 'models/std-' + def.id + '.glb', gl => res(gl.scene), undefined, () => res(null))));
  return cache.get(def.id);
}
export async function loadCharacter(def){
  const src = await template(def); if (!src) return null;
  const m = cloneSkinned(src), w = new THREE.Group(); w.add(m); w.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(m), c = box.getCenter(new THREE.Vector3());
  m.position.set(-c.x, -box.min.y, -c.z); w.scale.setScalar(def.size / (box.max.y - box.min.y));
  m.traverse(o => { if (o.isMesh){ o.castShadow = true; o.receiveShadow = true; o.material = o.material.clone(); o.material.roughness = .8; o.material.metalness = 0; if (o.isSkinnedMesh) o.frustumCulled = false; } });
  let rig = null; m.traverse(o => { if (o.userData && o.userData.fc_down !== undefined) rig = o.userData; });
  m.updateMatrixWorld(true); const bones = {};
  m.traverse(o => { if (o.isBone) bones[o.name] = { b: o, rest: o.quaternion.clone(), pw: o.parent.getWorldQuaternion(new THREE.Quaternion()) }; });
  const D = rig ? rig.fc_down : 0;
  if (D) [['armL', -1], ['armR', 1]].forEach(([n, sg]) => { if (bones[n]) bones[n].pre = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), sg * D); });
  w.userData = { bones, rigid: !!(rig && rig.fc_rigid), def }; return w;
}

// items shown in the hand (and as drops in the world)
import { blockMaterials, BLOCK } from '../world/voxel.js';
import { ITEMS, MATS } from '../items/items.js';
const handle = (len = .5) => { const h = new THREE.Mesh(new THREE.CylinderGeometry(.03, .035, len, 8), clay('#a8693c')); h.position.y = len / 2 - .08; return h; };
// only weapons and tools are carried in the hand; blocks, food and seeds stay in the bag (user's call, 2026-11-22)
export const inHand = id => { const it = ITEMS[id]; return !!(it && (it.melee || it.tool || it.farm === 'water' || it.food)); };   // food is held too, so eating shows (owner 2026-11-27)
// Hand tools built to design/weapons/weapons-spec.md (drafted with Codex): origin at the handle bottom, +Y up the
// handle, +X toward the working edge. userData.g = grip height (where the fist closes). Tier colours: H handle,
// A head, B trim, D detail.
const TIERS = {
  wood:    { H: '#B57A4E', A: '#E0A86C', B: '#7A4A22', D: '#6BAF5D' },
  stone:   { H: '#B57A4E', A: '#9AA6B4', B: '#3A1F08', D: '#A7D8FF' },
  iron:    { H: '#7A4A22', A: '#A7D8FF', B: '#4A9BD8', D: '#2FB39E' },
  gold:    { H: '#7A4A22', A: '#FFC94D', B: '#B57A4E', D: '#F5E6D3' },
  crystal: { H: '#3A1F08', A: '#8E6BD8', B: '#A7D8FF', D: '#F5E6D3' }
};
const GRIP = { sword: .082, axe: .095, pickaxe: .105, shovel: .103, hoe: .11, can: .086 };
// Painted sword surfaces (owner 2026-11-27: "paint them nicely, with detail", smooth, no raised bumps): every material gets its own
// hand-painted canvas: wood grain and knots, speckled stone with chips, brushed metal with bright facet edges, copper with a little
// verdigris, warm gold with shine streaks, diamond with light and dark facets and sparkles. Blade and guard share the look; the grip is leather.
const SWP = {};
function swordPaint(mat, SW){ if (SWP[mat]) return SWP[mat];
  const cv = (w, h, draw) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); draw(x, w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };
  let seed = mat.length * 7919 + 17; const R = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const sh = (hex, k) => { const c = new THREE.Color(hex); c.offsetHSL(0, 0, k); return '#' + c.getHexString(); };
  const paint = (col, x, w, h, kind) => {
    const gr = x.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, sh(col, .06)); gr.addColorStop(1, sh(col, -.05)); x.fillStyle = gr; x.fillRect(0, 0, w, h);
    if (kind === 'wood'){ for (let i = 0; i < 26; i++){ const x0 = R() * w, a = 2 + R() * 4; x.strokeStyle = `rgba(110,60,25,${.18 + R() * .22})`; x.lineWidth = .8 + R() * 1.6; x.beginPath();
        for (let y = 0; y <= h; y += 8) x.lineTo(x0 + Math.sin(y / (30 + R() * 10) + i) * a, y); x.stroke(); }
      for (let i = 0; i < 3; i++){ const cx = R() * w, cy = R() * h; x.strokeStyle = 'rgba(100,50,20,.45)'; x.lineWidth = 1.2; for (let r = 2; r < 9; r += 2.5){ x.beginPath(); x.ellipse(cx, cy, r * .6, r * 1.4, 0, 0, 7); x.stroke(); } } }
    else if (kind === 'stone'){ for (let i = 0; i < 260; i++){ x.fillStyle = `rgba(${R() < .5 ? '60,60,70' : '255,255,255'},${R() * .22})`; x.fillRect(R() * w, R() * h, 1 + R() * 2.5, 1 + R() * 2.5); }
      for (let i = 0; i < 6; i++){ x.fillStyle = 'rgba(70,72,80,.18)'; x.beginPath(); x.ellipse(R() * w, R() * h, 6 + R() * 10, 4 + R() * 8, R() * 3, 0, 7); x.fill(); } }
    else if (kind === 'metal' || kind === 'gold' || kind === 'copper'){ for (let i = 0; i < 90; i++){ x.fillStyle = `rgba(255,255,255,${R() * .1})`; x.fillRect(R() * w, 0, .8, h); }   // brushed streaks along the blade
      for (let i = 0; i < 40; i++){ x.fillStyle = `rgba(0,0,0,${R() * .06})`; x.fillRect(R() * w, 0, 1, h); }
      x.fillStyle = 'rgba(255,255,255,.28)'; for (let i = 0; i < 2; i++){ const y = h * (.25 + i * .35); x.save(); x.translate(0, y); x.rotate(-.25); x.fillRect(-w, 0, w * 3, 5 + i * 3); x.restore(); }   // soft shine bands
      if (kind === 'copper') for (let i = 0; i < 7; i++){ x.fillStyle = 'rgba(47,179,158,.35)'; x.beginPath(); x.ellipse(R() * w, R() * h, 2 + R() * 4, 1.5 + R() * 3, 0, 0, 7); x.fill(); } }
    else if (kind === 'diamond'){ for (let i = 0; i < 40; i++){ const px = R() * w, py = R() * h, s = 10 + R() * 18; x.fillStyle = `rgba(${R() < .5 ? '255,255,255' : '20,120,150'},${.1 + R() * .18})`; x.beginPath(); x.moveTo(px, py); x.lineTo(px + s, py + s * .4); x.lineTo(px + s * .3, py + s); x.closePath(); x.fill(); }
      for (let i = 0; i < 12; i++){ const px = R() * w, py = R() * h; x.fillStyle = 'rgba(255,255,255,.9)'; x.fillRect(px - 3, py - .5, 7, 1.2); x.fillRect(px - .5, py - 3, 1.2, 7); } }
    if (kind !== 'wood'){ x.fillStyle = 'rgba(255,255,255,.35)'; for (let k = 0; k < 6; k++) x.fillRect(k * w / 6 - 1, 0, 2.5, h); }   // bright facet edges
  };
  const kind = { wood: 'wood', stone: 'stone', iron: 'metal', silver: 'metal', copper: 'copper', gold: 'gold', diamond: 'diamond' }[mat] || 'metal';
  const m = (tex, rough, metal, extra) => new THREE.MeshStandardMaterial(Object.assign({ map: tex, roughness: rough, metalness: metal, flatShading: true }, extra || {}));
  const shiny = kind === 'wood' || kind === 'stone' ? 0 : kind === 'diamond' ? .05 : .35;
  const blade = m(cv(192, 384, (x, w, h) => paint(SW.blade, x, w, h, kind)), kind === 'wood' ? .7 : kind === 'stone' ? .85 : kind === 'diamond' ? .12 : .32, shiny, kind === 'diamond' ? { emissive: '#7FF0F5', emissiveIntensity: .12 } : null);
  const guard = m(cv(128, 128, (x, w, h) => paint(SW.guard, x, w, h, kind)), kind === 'wood' ? .7 : kind === 'stone' ? .85 : .35, shiny);
  const grip = new THREE.MeshStandardMaterial({ map: cv(64, 128, (x, w, h) => { x.fillStyle = SW.grip; x.fillRect(0, 0, w, h); for (let i = 0; i < 160; i++){ x.fillStyle = `rgba(${R() < .5 ? '255,230,200' : '30,15,5'},${R() * .12})`; x.fillRect(R() * w, R() * h, 1.5, 1.5); } }), roughness: .85 });
  return SWP[mat] = { blade, guard, grip }; }
function toolMesh(id, tier = 'stone'){
  const T = TIERS[tier] || TIERS.stone, g = new THREE.Group(), M = c => clay(c, { roughness: .6 });
  const cyl = (d, len, c, x, y, z = 0, axis = 'y') => { const m = new THREE.Mesh(new THREE.CylinderGeometry(d / 2, d / 2, len, 14), M(c)); m.position.set(x, y, z); if (axis === 'z') m.rotation.x = Math.PI / 2; g.add(m); return m; };
  const rb = (w, h, d, c, x, y, z = 0, rz = 0) => { const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, Math.min(.012, Math.min(w, h, d) / 4)), M(c)); m.position.set(x, y, z); m.rotation.z = rz; g.add(m); return m; };
  const fr = (b, t, len, c, x, y, z = 0, sides = 4) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(t / 2, b / 2, len, sides), M(c)); m.position.set(x, y, z); g.add(m); return m; };
  const SW = ITEMS[id] && ITEMS[id].kind === 'sword' ? MATS[ITEMS[id].mat] : null;
  if (SW){   // chunky short sword (owner 2026-11-27): faceted six-sided blade, round disc guard, wrapped grip, round pommel; colours from the material
    const P = swordPaint(ITEMS[id].mat, SW), met = (c, rough = .5) => c === SW.blade ? P.blade : P.guard, add = (geo, mat, y) => { const m = new THREE.Mesh(geo, mat); m.position.y = y; g.add(m); return m; };
    const bl = new THREE.CylinderGeometry(.066, .066, .44, 6); bl.rotateY(Math.PI / 2); add(bl, met(SW.blade, .42), .43).scale.z = .44;          // blade, edges toward ±X
    const tp = new THREE.ConeGeometry(.066, .13, 6); tp.rotateY(Math.PI / 2); add(tp, met(SW.blade, .42), .715).scale.z = .44;                    // point
    add(new THREE.CylinderGeometry(.104, .104, .036, 14), met(SW.guard), .192);                                                              // disc guard
    add(new THREE.CylinderGeometry(.026, .028, .17, 10), P.grip, .09);                                            // grip
    for (let k = 0; k < 4; k++){ const r = add(new THREE.TorusGeometry(.029, .0105, 6, 14), clay(SW.wrap, { roughness: .75 }), .025 + k * .042); r.rotation.x = Math.PI / 2 + .32; }   // wrapping
    add(new THREE.IcosahedronGeometry(.042, 1), met(SW.guard), -.018);                                                                       // pommel
    g.userData.g = GRIP.sword; return g; }
  if (id === 'axe'){ cyl(.044, .404, T.H, 0, .202); rb(.142, .076, .078, T.B, -.02, .376); rb(.13, .1, .07, T.A, .066, .382); rb(.118, .184, .066, T.A, .135, .365, 0, -.1);
    cyl(.04, .012, T.B, .123, .375, .035, 'z'); cyl(.022, .01, T.D, .123, .375, .043, 'z'); }
  else if (id === 'pickaxe'){ cyl(.044, .447, T.H, 0, .2235); rb(.106, .078, .072, T.A === '#9AA6B4' ? T.B : T.B, 0, .416);
    [-1, 1].forEach(sd => { rb(.144, .056, .058, T.A, sd * .094, .416, 0, -sd * .42); rb(.078, .036, .045, T.A, sd * .172, .369, 0, -sd * .8); }); rb(.022, .066, .01, T.D, 0, .418, .037, -.28); }
  else if (id === 'shovel'){ cyl(.042, .42, T.H, 0, .21); cyl(.065, .06, T.B, 0, .405); rb(.155, .122, .048, T.A, 0, .48);
    const toe = fr(.204, .1, .08, T.A, 0, .569); toe.rotation.y = Math.PI / 4; toe.scale.z = .32; const d = fr(.028, .01, .045, T.D, 0, .489, .024, 8); d.rotation.x = Math.PI; }
  else if (id === 'hoe'){ cyl(.042, .478, T.H, 0, .239); cyl(.064, .054, T.B, 0, .456); rb(.176, .048, .05, T.A, .071, .472); rb(.044, .103, .104, T.A, .148, .431, 0, -.13); cyl(.028, .012, T.D, .062, .472, .026, 'z'); }
  else if (id === 'can'){ cyl(.038, .172, T.H, 0, .086); rb(.118, .026, .035, T.H, .054, .014); rb(.118, .026, .035, T.H, .054, .158); rb(.22, .182, .162, T.A, .199, .085);
    cyl(.112, .022, T.B, .178, .181); const sp = cyl(.043, .152, T.B, .344, .125); sp.rotation.z = -1.08; const ro = fr(.041, .074, .042, T.A, .425, .169, 0, 14); ro.rotation.z = -1.08; rb(.02, .01, .038, T.D, .178, .194).rotation.y = .55; }
  else return null;
  g.userData.g = GRIP[id]; return g;
}
// Free CC0 models from KayKit (Kay Lousberg) and Kenney (assets/free, licences beside them), used as they come, colours included
// (owner 2026-11-27: "use these, they are well made"). Loaded once at start; until a file arrives the hand-built prop is shown.
// len: how tall the prop is held (world units at a 1.45 m child); grip: how far up the handle the fist closes.
const FREE = {
  pickaxe: { f: 'RPGTools/pickaxe.gltf', len: .5, grip: .1 }, axe: { f: 'RPGTools/axe.gltf', len: .44, grip: .09 },
  shovel:  { f: 'RPGTools/shovel.gltf',  len: .52, grip: .1, flip: true }, can: { f: 'RPGTools/bucket_metal.gltf', len: .26, grip: .2 },
  apple:   { f: 'Food/apple.glb' }, carrot: { f: 'Food/carrot.glb' }
}, FREE_SRC = {};
{ const L = new GLTFLoader(); for (const [id, d] of Object.entries(FREE)) L.load(new URL(`../../assets/free/${d.f}`, import.meta.url).href, gl => { FREE_SRC[id] = gl.scene; }, undefined, () => {}); }
function freeMesh(id){ const d = FREE[id], src = FREE_SRC[id]; if (!src) return null;
  const m = src.clone(true), g = new THREE.Group(); if (d.flip) m.rotation.x = Math.PI; const w = new THREE.Group(); w.add(m); g.add(w); w.updateMatrixWorld(true);   // flip: the model's working end is at the bottom
  const b = new THREE.Box3().setFromObject(w), s = b.getSize(new THREE.Vector3()), k = (d.len || .2) / (d.len ? s.y : Math.max(s.x, s.y, s.z));
  w.scale.setScalar(k); w.position.set(-(b.min.x + s.x / 2) * k, -b.min.y * k, -(b.min.z + s.z / 2) * k);
  m.traverse(o => { if (o.isMesh){ o.castShadow = true; o.material = o.material.clone(); o.material.roughness = Math.max(.45, o.material.roughness ?? .6); o.material.metalness = Math.min(.2, o.material.metalness ?? 0); } });
  g.userData.g = d.grip ?? .1; return g; }
export function heldMesh(id){
  const g = new THREE.Group(), it = ITEMS[id];
  const fm = freeMesh(id); if (fm) return shadowAll(fm);
  const tm = toolMesh(id, it && it.tier); if (tm) return shadowAll(tm);
  if (it && (it.place ?? it.look) !== undefined){ const m = new THREE.Mesh(new THREE.BoxGeometry(.28, .28, .28), blockMaterials[it.place ?? it.look]); m.position.y = .1; g.add(m); }
  else if (id === 'sword'){
    const b = new THREE.Mesh(roundBox(.1, .62, .04, .015), clay('#dfe8f2', { roughness: .35, metalness: .3 })); b.position.y = .42;
    const gd = new THREE.Mesh(roundBox(.3, .07, .08, .02), clay('#e9b949', { roughness: .4, metalness: .4 })); gd.position.y = .09;
    const h = new THREE.Mesh(new THREE.CylinderGeometry(.035, .035, .18, 8), clay('#a8693c')); h.position.y = -.02; g.add(b, gd, h);
  } else if (id === 'apple'){
    const a = new THREE.Mesh(new THREE.SphereGeometry(.17, 18, 14), clay('#ff4a3d', { roughness: .5 })); a.scale.y = .92;
    const l = new THREE.Mesh(new THREE.SphereGeometry(.07, 8, 6), clay('#4fcf5e')); l.position.set(.06, .18, 0); l.scale.set(1.4, .4, .8);
    const st = new THREE.Mesh(new THREE.CylinderGeometry(.015, .02, .1, 6), clay('#7a4a2b')); st.position.y = .19; g.add(a, l, st);
  } else if (id === 'shovel'){
    g.add(handle(.55)); const b = new THREE.Mesh(roundBox(.18, .2, .04, .02), clay('#c9d3de', { roughness: .4, metalness: .3 })); b.position.y = .52; g.add(b);
  } else if (id === 'axe'){
    g.add(handle(.55)); const b = new THREE.Mesh(roundBox(.2, .16, .05, .02), clay('#c9d3de', { roughness: .4, metalness: .3 })); b.position.set(.1, .4, 0); g.add(b);
  } else if (id === 'hoe'){
    g.add(handle(.55)); const b = new THREE.Mesh(roundBox(.18, .05, .1, .02), clay('#c9d3de', { roughness: .4, metalness: .3 })); b.position.set(.06, .47, 0); g.add(b);
  } else if (id === 'can'){
    const b = new THREE.Mesh(new THREE.CylinderGeometry(.11, .12, .2, 14), clay('#7fb3d9', { roughness: .35, metalness: .2 })); b.position.y = .08; const s = new THREE.Mesh(new THREE.CylinderGeometry(.02, .025, .22, 8), clay('#7fb3d9')); s.position.set(0, .14, .14); s.rotation.x = .9;
    const hd = new THREE.Mesh(new THREE.TorusGeometry(.07, .015, 6, 12, Math.PI), clay('#2a4a66')); hd.position.set(0, .2, -.02); g.add(b, s, hd);
  } else if (id === 'seeds'){
    const b = new THREE.Mesh(new THREE.SphereGeometry(.1, 10, 8), clay('#e9c98a')); b.scale.y = 1.2; b.position.y = .08; g.add(b);
  } else if (id === 'carrot'){
    const c = new THREE.Mesh(new THREE.ConeGeometry(.06, .26, 10), clay('#ff8a2a')); c.rotation.x = Math.PI; c.position.y = .05; const l = new THREE.Mesh(new THREE.ConeGeometry(.05, .14, 6), clay('#2f9a3c')); l.position.y = .24; g.add(c, l);
  } else if (id === 'gel'){
    const b = new THREE.Mesh(new THREE.SphereGeometry(.12, 12, 10), new THREE.MeshStandardMaterial({ color: '#7fd7ff', roughness: .15, transparent: true, opacity: .85 })); b.scale.y = .8; b.position.y = .06; g.add(b);
  } else if (id === 'pickaxe'){
    g.add(handle(.55)); const b = new THREE.Mesh(new THREE.TorusGeometry(.2, .03, 6, 16, Math.PI), clay('#c9d3de', { roughness: .4, metalness: .3 })); b.position.y = .32; g.add(b);
  }
  return shadowAll(g);
}

const AX = { x: new THREE.Vector3(1, 0, 0), y: new THREE.Vector3(0, 1, 0), z: new THREE.Vector3(0, 0, 1) };
const qa = new THREE.Quaternion(), qb = new THREE.Quaternion(), qc = new THREE.Quaternion(), hv = new THREE.Vector3();
function pose(B, name, rx, ry = 0, rz = 0){
  const o = B[name]; if (!o) return;
  qa.setFromAxisAngle(AX.x, rx); if (ry){ qb.setFromAxisAngle(AX.y, ry); qa.premultiply(qb); } if (rz){ qb.setFromAxisAngle(AX.z, rz); qa.premultiply(qb); }
  if (o.pre) qa.multiply(o.pre);
  qc.copy(o.pw).invert().multiply(qa).multiply(o.pw); o.b.quaternion.copy(qc).multiply(o.rest);
}


// Round clay fists: the scanned hands are flat and open, so each hand bone is shrunk and a soft ball fist sits
// at the palm. Held items are children of the right fist (they follow every arm move) and are gripped a third of
// the way up the handle, pointing forward and a little up when the arm hangs at rest.
const _v = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3();
function makeFists(m, B, skin = '#f6c6a2'){
  m.updateMatrixWorld(true);
  // the scan's hand vertices are weighted to the forearm; move every vertex past the wrist onto the hand bone (once per geometry)
  m.traverse(o => { if (!o.isSkinnedMesh || o.geometry.userData.fisted) return; o.geometry.userData.fisted = true;
    const bones = o.skeleton.bones, inv = o.skeleton.boneInverses, at = i => new THREE.Vector3().setFromMatrixPosition(inv[i].clone().invert());
    const si = o.geometry.attributes.skinIndex, sw = o.geometry.attributes.skinWeight, pos = o.geometry.attributes.position, v = new THREE.Vector3();
    for (const side of ['L', 'R']){ const hi = bones.indexOf(B['hand' + side].b), fi = bones.indexOf(B['fore' + side].b); if (hi < 0 || fi < 0) continue;
      const wrist = at(hi), dir = wrist.clone().sub(at(fi)).normalize(), back = wrist.distanceTo(at(fi)) * .5; let len = 0;
      for (let i = 0; i < si.count; i++){ let best = 0, bi = -1; for (let j = 0; j < 4; j++){ const w = sw.getComponent(i, j); if (w > best){ best = w; bi = si.getComponent(i, j); } }
        if (bi !== fi) continue; v.fromBufferAttribute(pos, i).applyMatrix4(o.bindMatrix);
        const d = v.clone().sub(wrist).dot(dir); if (d > -back){ si.setXYZW(i, hi, 0, 0, 0); sw.setXYZW(i, 1, 0, 0, 0); if (d > len) len = d; } }
      o.geometry.userData['hand' + side] = len;
    }
    si.needsUpdate = sw.needsUpdate = true; });
  for (const side of ['R']){                                              // only the hand that holds things changes
    const hb = B['hand' + side].b, fb = B['fore' + side].b; if (!hb || !fb) continue;
    const len = hb.position.length();                                        // forearm-to-wrist distance in bone units
    const dir = new THREE.Vector3(0, 1, 0).applyQuaternion(hb.quaternion);    // hand direction in forearm space
    fb.getWorldScale(_s); const k = 1 / _s.x, H = new THREE.Box3().setFromObject(m).getSize(_v).y, r = .042 * H;   // fist size follows body height
    const fist = new THREE.Mesh(new THREE.SphereGeometry(r * k, 16, 12), clay(skin, { roughness: .7 })); fist.scale.set(1, 1.05, .95);
    fist.position.copy(hb.position).addScaledVector(dir, r * k * .55); fist.castShadow = true; fb.add(fist);
    // grip: forward (+z of the character) and 35 degrees up, expressed in the fist's own space at rest
    fist.updateMatrixWorld(true); fist.getWorldQuaternion(_q); const inv = _q.clone().invert();
    m.getWorldQuaternion(_q); const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(_q), up = new THREE.Vector3(0, 1, 0);
    const want = fwd.multiplyScalar(Math.cos(-.35)).addScaledVector(up, Math.sin(-.35)).normalize().applyQuaternion(inv);
    const sideAx = new THREE.Vector3(1, 0, 0).applyQuaternion(_q).applyQuaternion(inv).normalize();
    fist.userData.grip = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), want);
    fist.userData.gripDir = want.clone();                                      // the item slides down this axis by its grip height
    fist.userData.k = k; fist.userData.r = r; fist.userData.skin = skin; fist.userData.side = sideAx; fist.userData.hb = hb; fist.visible = false; m.userData['fist' + side] = fist;
  }
}

// ---------------------------------------------------------------------------------------------------------
// Animator v2: keyframed procedural motion from design/motion/motion-spec.md (drafted by Codex).
// Every frame a target pose (angles per bone, root offset, squash) is sampled from the clips below and the
// shown pose eases toward it, so nothing pops. Angles follow pose(): arm -x = forward/up, z = open sideways,
// leg -x = forward, shin +x = knee bend, chest +x = lean forward.
const BONES = ['hips', 'chest', 'head', 'armL', 'armR', 'foreL', 'foreR', 'handL', 'handR', 'legL', 'legR', 'shinL', 'shinR'];
const E = { sine: t => .5 - .5 * Math.cos(Math.PI * t), out: t => 1 - Math.pow(1 - t, 3), in: t => t * t * t, io: t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2 };
const V3 = v => typeof v === 'number' ? [v, 0, 0] : v;
// P(): a pose from short notation; arm/fore/leg/shin take [L, R]
function P(o){ const q = { y: o.y || 0, sy: o.sy || 1, sp: o.sp ?? .9 };
  for (const k of ['hips', 'chest', 'head']) q[k] = V3(o[k] || 0);
  for (const n of ['arm', 'fore', 'hand', 'leg', 'shin']){ const v = o[n] || 0, L = Array.isArray(v) && v.length === 2 ? v : [v, v]; q[n + 'L'] = V3(L[0]); q[n + 'R'] = V3(L[1]); }
  return q; }
const mix = (a, b, t) => { const q = { y: a.y + (b.y - a.y) * t, sy: a.sy + (b.sy - a.sy) * t, sp: a.sp + (b.sp - a.sp) * t }; for (const k of BONES) q[k] = [0, 1, 2].map(i => a[k][i] + (b[k][i] - a[k][i]) * t); return q; };
const mirror = a => { const q = { y: a.y, sy: a.sy, sp: a.sp }; for (const k of ['hips', 'chest', 'head']) q[k] = [a[k][0], -a[k][1], -a[k][2]];
  for (const n of ['arm', 'fore', 'hand', 'leg', 'shin']){ const L = a[n + 'L'], R = a[n + 'R']; q[n + 'L'] = [R[0], -R[1], -R[2]]; q[n + 'R'] = [L[0], -L[1], -L[2]]; } return q; };
// clip(): keys = [[seconds into key, ease, pose], ...]; returns the pose at time t, starting from `from`
function clip(keys, t, from){ let prev = from, t0 = 0; for (const [d, e, p] of keys){ if (t < t0 + d) return mix(prev, p || from, E[e]((t - t0) / d)); t0 += d; prev = p || from; } return prev; }

const IDLE_A = P({ chest: .01, arm: [[0, 0, .08], [0, 0, -.10]], fore: [-.16, -.22] });
const IDLE_B = P({ chest: -.02, head: .015, arm: [[-.02, 0, .10], [-.02, 0, -.12]], fore: [-.19, -.25], y: .003 });
const READY = P({ chest: .02, arm: [[0, 0, .08], [-.45, 0, -.12]], fore: [-.18, -.8] });           // holding a tool, at rest
const W = [   // half a walk cycle (left foot forward); the second half is mirrored. Contact at 0 (heel down, body lowest), passing at .25 (foot lifted, body highest)
  [0,   P({ hips: [0, .10, 0], chest: [.07, -.14, 0], head: [-.05, .06, 0], leg: [-.58, .44], shin: [.08, .20], arm: [[.42, 0, .08], [-.42, 0, -.08]], fore: [-.22, -.45], y: -.022, sy: .97 })],
  [.12, P({ hips: [0, .08, .05], chest: [.09, -.11, -.04], head: [-.06, .04, .025], leg: [-.38, .48], shin: [.30, .78], arm: [[.40, 0, .08], [-.42, 0, -.08]], fore: [-.18, -.47], y: -.008, sy: .99 })],
  [.25, P({ hips: [0, 0, .06], chest: [.07, 0, -.045], head: [-.05, 0, .025], leg: [.02, -.22], shin: [.18, 1.15], arm: [[.05, 0, .08], [-.09, 0, -.08]], fore: [-.24, -.50], y: .034, sy: 1.02 })],
  [.38, P({ hips: [0, -.05, .03], chest: [.07, .08, -.025], head: [-.05, -.03, .015], leg: [.30, -.52], shin: [.12, .50], arm: [[-.30, 0, .08], [.30, 0, -.08]], fore: [-.42, -.25], y: .010 })]
];
const J = {   // leg, shin, fore: [left, right]; arm: [[left], [right]]
  stretch: P({ hips: .02, chest: -.12, head: .09, leg: [-.95, .42], shin: [1.15, .32], arm: [[.55, 0, .24], [-2.75, 0, -.16]], fore: [-.30, -.12], y: .018, sy: 1.04 }),
  tuck:    P({ hips: .04, chest: -.06, head: .05, leg: [-1.08, .55], shin: [1.28, .52], arm: [[.72, 0, .30], [-2.60, 0, -.20]], fore: [-.42, -.18] }),
  reach:   P({ chest: .08, head: -.04, leg: [-.40, .22], shin: [.50, .30], arm: [[-.80, 0, .55], [-1.50, 0, -.50]], fore: [-.25, -.25] }),
  land:    P({ hips: -.05, chest: .23, head: -.12, leg: [-.47, -.43], shin: [.86, .80], arm: [[-.56, 0, .17], [-.48, 0, -.17]], fore: -.43, y: -.055, sy: .95 })
};
const SIT = {   // y is filled in from the measured seat height (fraction S of it)
  bend:  P({ hips: -.04, chest: .25, head: -.16, leg: -.49, shin: .88, arm: [[-.54, 0, .16], [-.48, 0, -.16]], fore: -.32, y: -.07 }),
  reach: P({ chest: -.20, head: .20, leg: [[-1.14, 0, .14], [-1.14, 0, -.14]], shin: .42, arm: [[-.80, 0, .12], [-.80, 0, -.12]], fore: -.30, hand: 0 }),
  seat:  P({ chest: -.36, head: .34, leg: [[-1.60, 0, .14], [-1.60, 0, -.14]], shin: .24, arm: [[-.62, 0, .05], [-.62, 0, -.05]], fore: -.28, hand: 0 }),
  bounce:P({ chest: -.29, head: .28, leg: [[-1.57, 0, .14], [-1.57, 0, -.14]], shin: .24, arm: [[-.62, 0, .05], [-.62, 0, -.05]], fore: -.28, hand: 0 }),
  rest:  P({ chest: -.33, head: .31, leg: [[-1.60, 0, .14], [-1.60, 0, -.14]], shin: .24, arm: [[-.62, 0, .05], [-.62, 0, -.05]], fore: -.28, hand: 0 })
};
const PUNCH = [
  [.08, 'out', P({ hips: [0, .16, 0], chest: [.04, .32, 0], head: [-.02, -.24, 0], arm: [[-.39, 0, .18], [.43, 0, -.23]], fore: [-.79, -1.24], leg: [-.20, .10], shin: [.38, .24], y: -.018 })],
  [.04, 'in',  P({ hips: [0, -.25, 0], chest: [.18, -.54, 0], head: [-.09, .39, 0], arm: [[.30, 0, .23], [-1.53, 0, -.19]], fore: [-.66, -.16], leg: [-.22, .18], shin: [.27, .21], y: -.007 })],
  [.05, 'out', P({ hips: [0, -.29, 0], chest: [.21, -.62, 0], head: [-.12, .43, 0], arm: [[.40, 0, .24], [-1.44, 0, -.21]], fore: [-.59, -.27], leg: [-.20, .19], shin: [.32, .22], y: -.014 })],
  [.13, 'io', null]
];
const SLASH = [
  [.13, 'out', P({ hips: [0, .12, 0], chest: [-.10, .20, 0], head: [.05, -.14, 0], arm: [[-.40, 0, .20], [-2.50, 0, -.05]], fore: [-.60, -.30], leg: [-.25, .07], shin: [.41, .24], y: -.006, sp: -.45 })],
  [.07, 'in',  P({ hips: [0, -.10, 0], chest: [.20, -.20, 0], head: [-.08, .14, 0], arm: [[.25, 0, .22], [-1.05, 0, .30]], fore: [-.55, -.20], leg: [-.24, .19], shin: [.30, .22], y: -.020, sp: 1.30 })],
  [.07, 'out', P({ hips: [0, -.14, 0], chest: [.24, -.26, 0], head: [-.10, .18, 0], arm: [[.35, 0, .24], [-.62, 0, .34]], fore: [-.45, -.30], leg: [-.22, .20], shin: [.37, .27], y: -.026, sp: 1.75 })],
  [.15, 'io', null]
];
const DIG = [   // one chop, nominal .5 s; contact at .27 (owner 2026-11-27: raise, then strike down to the middle in front)
  [.18, 'out',  P({ hips: [0, .05, 0], chest: [-.10, .08, 0], head: [.08, -.04, 0], arm: [[-1.10, 0, -.10], [-2.55, 0, .05]], fore: [-.55, -.35], leg: [-.12, -.07], shin: [.20, .16], y: .010, sp: -.35 })],
  [.09, 'in',   P({ hips: [0, -.04, 0], chest: [.30, -.06, 0], head: [-.14, .04, 0], arm: [[-.80, 0, -.28], [-.70, 0, .30]], fore: [-.35, -.20], leg: [-.27, -.21], shin: [.50, .41], y: -.032, sp: 1.45 })],
  [.07, 'out',  P({ hips: [0, -.02, 0], chest: [.22, -.04, 0], head: [-.12, .03, 0], arm: [[-.72, 0, -.24], [-.88, 0, .24]], fore: [-.40, -.32], leg: [-.21, -.16], shin: [.36, .31], y: -.018, sp: 1.15 })],
  [.16, 'sine', P({ chest: .07, head: -.03, arm: [[-.14, 0, .17], [-.91, 0, -.24]], fore: [-.33, -.50], leg: [-.16, -.12], shin: [.26, .22], y: -.008 })]
];
// Carrying hand (owner 2026-11-27): fruit, vegetables and other round things are not gripped like a handle (the fist used to sink
// into the apple). The thing rests against the palm, a little in front of the fist, scaled to fit the hand, and four clay fingers
// sit ON its surface (three below-front, a thumb on top) so the hand reads as holding it. Works for any future food or produce.
function cupHold(it, fist){
  const U = fist.userData, r = U.r, body = it.userData.body || (it.userData.body = it.children.slice());
  if (!it.userData.fit){   // recentre on the thing's own middle and size it to about 1.25 fist radii
    const par = it.parent; if (par) par.remove(it); it.position.set(0, 0, 0); it.quaternion.identity(); it.scale.setScalar(1); it.updateMatrixWorld(true);
    const bx = new THREE.Box3().setFromObject(it), bs = { center: bx.getCenter(new THREE.Vector3()), radius: Math.max(...bx.getSize(new THREE.Vector3()).toArray()) / 2 }; if (par) par.add(it); const sc = THREE.MathUtils.clamp(1.25 * r / bs.radius, .3, 3);   // half the longest side, so a leaf or stem does not shrink the fruit
    body.forEach(o => { o.position.sub(bs.center).multiplyScalar(sc); o.scale.multiplyScalar(sc); }); it.userData.fit = 1.25 * r; }
  const R = it.userData.fit;
  it.quaternion.copy(U.grip); it.scale.setScalar(U.k);
  it.position.copy(U.gripDir).multiplyScalar((r * 1.05 + R * .8) * U.k);   // rests on the palm with only a slight press
  (it.userData.fingers || []).forEach(f => it.remove(f));
  const skin = clay(U.skin || '#f0c8a0', { roughness: .7 }), fr = r * .36, F = [];
  const finger = (th, y, len) => { const ro = Math.sqrt(Math.max(0, R * R - y * y)) + fr * .55, f = new THREE.Mesh(new THREE.SphereGeometry(fr, 10, 8), skin);
    f.position.set(Math.sin(th) * ro, y, Math.cos(th) * ro); f.scale.set(1, len, .8); f.rotation.set(-y / R * .6, th, 0); f.castShadow = true; it.add(f); F.push(f); };
  [-.55, 0, .55].forEach(th => finger(Math.PI / 2 + th, -R * .45, 1.5));   // fingers wrap the lower side
  finger(-Math.PI / 2, -R * .1, 1.6);                                     // thumb on the other side
  it.userData.fingers = F;
}
const EAT = [
  [.27, 'out',  P({ chest: .06, head: .10, arm: [[-.19, 0, .12], [-.89, 0, -.27]], fore: [-.37, -1.10], hand: [0, .12], y: -.006 })],
  [.21, 'sine', P({ chest: .04, head: [.12, -.10, 0], arm: [[-.19, 0, .13], [-1.10, 0, -.30]], fore: [-.39, -1.28], hand: [0, .16], y: -.004 })],
  [.14, 'io',   P({ chest: .07, head: [.20, -.09, 0], arm: [[-.23, 0, .12], [-1.19, 0, -.27]], fore: [-.40, -1.40], hand: [0, .19], y: -.010 })],
  [.16, 'out',  P({ chest: .03, head: .07, arm: [[-.13, 0, .10], [-.54, 0, -.20]], fore: [-.27, -.56], hand: [0, .07], y: -.004 })],
  [.12, 'sine', null]
];
const HURT = [
  [.06, 'out',  P({ hips: .08, chest: -.28, head: -.16, arm: [[-.92, 0, .28], [-.80, 0, -.25]], fore: [-.73, -.62], leg: [-.18, -.23], shin: [.29, .36], y: -.017 })],
  [.09, 'sine', P({ hips: -.04, chest: .13, head: -.10, arm: [[-.71, 0, .18], [-.64, 0, -.18]], fore: [-.58, -.50], leg: [-.28, -.30], shin: [.52, .55], y: -.035, sy: .97 })],
  [.20, 'io', null]
];
const UPPER = ['hips', 'chest', 'head', 'armL', 'armR', 'foreL', 'foreR', 'handL', 'handR'];

export class Animator {
  constructor(scene){ this.held = {}; this.scene = scene; this.cur = null; this.w = 0; this.sitT = -1; this.standT = -1; this.landT = 9; this.airT = 0; this.mineT = 0; this.wasGround = true; this.blink = 3; this.swordPitch = .9; }
  mesh(id){ if (!this.held[id]){ this.held[id] = heldMesh(id); this.held[id].visible = false; } return this.held[id]; }
  // s: { model, speed, phase, ground, vy, action:{type,t,dur}|null, hold, face, t, hideHeld }
  update(dt, s){
    const m = s.model; for (const k in this.held) this.held[k].visible = false; if (!m) return;
    const B = m.userData.bones, A = s.action, U = m.userData, t = s.t || 0, tool = inHand(s.hold);
    if (U.legH === undefined){ m.updateWorldMatrix(true, true); const v = new THREE.Vector3(), box = new THREE.Box3().setFromObject(m), H = box.max.y - box.min.y; (B.legL || B.hips).b.getWorldPosition(v);
      U.legH = Math.min(H * .5, Math.max(0, v.y - box.min.y - H * .06)); U.baseY = m.position.y; U.H = H; U.s0 = m.scale.x; }
    if (!U.fistR && !s.plainHands && B.handR && B.foreR) makeFists(m, B, s.skin);   // islanders keep their own modelled hands
    swayWear(m, t);
    // ---- locomotion base: idle <-> walk
    const breath = E.sine((t % 3.4) / 3.4 < .5 ? (t % 3.4) / 1.7 : 2 - (t % 3.4) / 1.7), shift = Math.sin(t * 2 * Math.PI / 5.6);
    let base = mix(IDLE_A, IDLE_B, breath); base.hips = [0, 0, .035 * shift]; base.chest[2] = -.025 * shift; base.head[2] = -.01 * shift;
    this.blink -= dt; if (this.blink < 0) this.blink = 5 + (m.id % 5); const bl = this.blink > .31 ? 0 : this.blink > .22 ? E.out((.31 - this.blink) / .09) : E.sine(this.blink / .22); base.head[0] += .07 * bl; base.head[2] += .05 * bl;
    if (tool) base = mix(base, READY, .85);
    const moving = s.speed > .1 && s.ground; this.w += ((moving ? 1 : 0) - this.w) * Math.min(1, dt * (moving ? 6.5 : 5.5));
    if (this.w > .01){ let u = ((s.phase / (2 * Math.PI)) % 1 + 1) % 1, flip = u >= .5; if (flip) u -= .5; let i = 0; while (i < 3 && u >= W[i + 1][0]) i++;
      const a = W[i][1], b = i < 3 ? W[i + 1][1] : mirror(W[0][1]), t1 = i < 3 ? W[i + 1][0] : .5; let wp = mix(a, b, E.sine((u - W[i][0]) / (t1 - W[i][0]))); if (flip) wp = mirror(wp);
      if (tool){ wp.armR = [-.45 + wp.armR[0] * .35, 0, -.12]; wp.foreR = [-.8, 0, 0]; }
      base = mix(base, wp, this.w); }
    let tgt = base, rate = 14;
    // ---- air: stretch on the way up, tuck near the top, reach on the way down, squash on landing
    if (!s.ground){ this.airT += dt; this.landT = 9; const v = s.vy; tgt = v > 3 ? mix(J.tuck, J.stretch, Math.min(1, (v - 3) / 3)) : v > -3 ? J.tuck : mix(J.tuck, J.reach, Math.min(1, (-v - 3) / 3)); if (tool){ tgt = mix(tgt, tgt, 1); tgt.armR = [-.7, 0, -.2]; tgt.foreR = [-.7, 0, 0]; if (v > -3){ tgt.armL = [-2.6, 0, .2]; tgt.foreL = [-.15, 0, 0]; } } rate = 16; }   // the tool hand stays down, so the free hand does the fist-up
    else { if (!this.wasGround && this.airT > .18) this.landT = 0; this.airT = 0; this.landT += dt;
      if (this.landT < .265) tgt = this.landT < .075 ? mix(tgt, J.land, E.out(this.landT / .075)) : mix(J.land, tgt, E.sine((this.landT - .075) / .19)), rate = 26; }
    this.wasGround = s.ground;
    // ---- sitting (own clock: the caller only says "sitting")
    const sitting = !!(A && A.type === 'sit');
    if (sitting){ if (this.sitT < 0){ this.sitT = 0; this.standT = -1; } this.sitT += dt; } else if (this.sitT >= 0){ this.standT = 0; this.sitT = -1; }
    let seat = 0;
    if (sitting){ const T = this.sitT, sway = Math.sin(t * 2 * Math.PI / 3.6) * .02, wig = Math.max(0, Math.sin(t * 2.2)) * Math.sin(t * 15) * .05;
      const rest = mix(SIT.rest, SIT.rest, 0); rest.chest[2] = sway; rest.head[2] = -sway; rest.shinL[0] += wig;
      tgt = clip([[.18, 'io', SIT.bend], [.20, 'in', SIT.reach], [.13, 'out', SIT.seat], [.09, 'out', SIT.bounce], [.15, 'sine', rest]], T, base); if (T > .75) tgt = rest;
      seat = T < .18 ? 0 : T < .38 ? .65 * E.in((T - .18) / .2) : T < .51 ? .65 + .35 * E.out((T - .38) / .13) : T < .6 ? 1 - .03 * E.out((T - .51) / .09) : 1; rate = 22; }
    else if (this.standT >= 0){ const T = this.standT; this.standT += dt;
      const gather = P({ chest: -.20, head: .20, leg: [[-1.02, 0, .13], [-1.02, 0, -.13]], shin: 1.35, arm: [[.53, 0, .18], [.53, 0, -.18]], fore: -.10, hand: .45 }), push = P({ hips: -.04, chest: .32, head: -.20, leg: -.63, shin: 1.12, arm: [[-.28, 0, .15], [-.28, 0, -.15]], fore: -.33 }), rise = P({ chest: .06, head: -.04, leg: -.12, shin: .22, arm: -.20, fore: -.20, y: -.012 });
      tgt = clip([[.22, 'sine', gather], [.18, 'io', push], [.24, 'out', rise], [.16, 'sine', null]], T, base);
      seat = T < .22 ? 1 : T < .40 ? 1 - .28 * E.io((T - .22) / .18) : T < .64 ? .72 * (1 - E.out((T - .40) / .24)) : 0; rate = 22; if (T > .8) this.standT = -1; }
    // ---- actions (their own clocks give the hit timing)
    this.mineT = A && A.type === 'mine' ? this.mineT + dt : 0;
    let act = null;
    if (A && A.type === 'punch') act = clip(PUNCH, A.t, base); else if (A && A.type === 'slash') act = clip(SLASH, A.t, base);
    else if (A && A.type === 'mine') act = clip(DIG, this.mineT % .5, DIG[3][2]); else if (A && A.type === 'eat') act = clip(EAT, A.t % .9, base);
    else if (A && A.type === 'hurt') act = clip(HURT, A.t, base);
    else if (A && A.type === 'wave'){ const s = Math.sin(A.t * 9); act = mix(base, base, 0); act.armR = [-1.75, 0, -.2 + s * .12]; act.foreR = [-.5, 0, s * .5]; }   // a host waving hello: right arm up, forearm swinging
    else if (A && A.type === 'cheer'){ const w = Math.sin(A.t * 10), d = -(140 + w * 18) * Math.PI / 180; act = mix(base, base, 0); act.armL = [d, 0, .3 + w * .1]; act.armR = [d, 0, -.3 - w * .1]; act.foreL = [-.3, 0, 0]; act.foreR = [-.3, 0, 0]; act.y = Math.abs(Math.sin(A.t * 10)) * .035; }   // happy: both arms up, bouncing
    else if (A && A.type === 'raise'){ const d = -(A.deg ?? 150) * Math.PI / 180; act = mix(base, base, 0); act.armL = [d, 0, .12]; act.armR = [d, 0, -.12]; act.foreL = [-.12, 0, 0]; act.foreR = [-.12, 0, 0]; }
    if (act){ if (moving || !s.ground || sitting){ const o = mix(tgt, tgt, 0); for (const k of UPPER) o[k] = act[k]; o.sp = act.sp; if (sitting){ o.hips = tgt.hips; o.chest = [tgt.chest[0] * .5 + act.chest[0] * .5, act.chest[1], act.chest[2]]; } act = o; } tgt = act; rate = 34; }
    // ---- ease the shown pose toward the target (no pops), then apply
    if (!this.cur || this.model !== m){ this.cur = mix(tgt, tgt, 0); this.model = m; this.seat = seat; }
    const k = Math.min(1, dt * rate), c = this.cur; for (const b of BONES) for (let i = 0; i < 3; i++) c[b][i] += (tgt[b][i] - c[b][i]) * k;
    c.y += (tgt.y - c.y) * k; c.sy += (tgt.sy - c.sy) * Math.min(1, dt * 22); c.sp += (tgt.sp - c.sp) * k; this.seat += (seat - this.seat) * Math.min(1, dt * 24); this.swordPitch = c.sp;
    for (const b of BONES){ if (U.rigid && /^(fore|shin)/.test(b)){ pose(B, b, 0); continue; } pose(B, b, c[b][0], c[b][1], c[b][2]); }
    // a tail bone (Uncle Beaver) sways gently, swishes when walking, and flaps up and wags fast when happy
    if (B.tail){ const happy = A && (A.type === 'cheer' || A.type === 'raise'), sp = happy ? 11 : moving ? 6 : 2.2; this.tailT = (this.tailT || 0) + dt * sp; this.tailH = (this.tailH || 0) + ((happy ? 1 : 0) - (this.tailH || 0)) * Math.min(1, dt * 6);
      const amp = happy ? .32 : moving ? .14 : .05; pose(B, 'tail', -this.tailH * (.35 + .2 * Math.abs(Math.sin(this.tailT))), 0, Math.sin(this.tailT) * amp); }
    m.position.y = U.baseY + c.y * U.H - U.legH * this.seat; const sy = c.sy, sx = 1 / Math.sqrt(sy); m.scale.set(U.s0 * sx, U.s0 * sy, U.s0 * sx);
    // ---- held item rides in the right grip hand
    const away = this.seat > .25;   // sitting down: the tool is put away and both hands rest on the knees (owner, 2026-11-26)
    const fist = U.fistR, it = tool && !away ? this.mesh(s.hold) : null, holding = !!(fist && it);
    if (fist && fist.visible !== holding){ fist.visible = holding; fist.userData.hb.scale.setScalar(holding ? .3 : 1); }
    if (fist && it && !s.hideHeld){ if (it.parent !== fist){ fist.add(it); if (ITEMS[s.hold] && ITEMS[s.hold].food) cupHold(it, fist); else { it.quaternion.copy(fist.userData.grip); it.position.copy(fist.userData.gripDir).multiplyScalar(-(it.userData.g || .1) * fist.userData.k); it.scale.setScalar(fist.userData.k); } }
      it.visible = true; fist.rotation.set(0, 0, 0); fist.rotateOnAxis(fist.userData.side, (this.swordPitch - .9) * .35); }
  }
}
