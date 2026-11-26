// Island critters rebuilt to match the approved reference sheet (familycraft-home/art/gameplay/monsters.png, owner 2026-11-27):
// moss cube with two leaves, corn cube with a sprout, lava rock with a glowing crack, glossy water drop. No feet: they bounce.
// Day: cute faces (black eyes with a glint, smile, blush). Night: darker, glowing red eyes, two little fangs (eyes() in things.js).
// Every model sits on y = 0, faces +Z, about 0.5 tall; parts that should wobble carry userData.wig.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { clay } from '../fx/materials.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const rnd = seed => () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const tex = (draw, n = 128) => { const c = document.createElement('canvas'); c.width = c.height = n; draw(c.getContext('2d'), n); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; };
const shade = (hex, k) => { const c = new THREE.Color(hex); c.offsetHSL(0, 0, k); return '#' + c.getHexString(); };
const mesh = (geo, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; return m; };
const std = (o) => new THREE.MeshStandardMaterial(o);

// a soft felt / clay surface with speckles, used under most bodies
function feltTex(col, seed, extra){ return tex((x, n) => { const R = rnd(seed); x.fillStyle = col; x.fillRect(0, 0, n, n);
  for (let i = 0; i < 900; i++){ x.fillStyle = `rgba(${R() < .5 ? '255,255,255' : '0,0,0'},${R() * .07})`; x.fillRect(R() * n, R() * n, 1 + R() * 2, 1 + R() * 2); } if (extra) extra(x, n, R); }); }

// owner 2026-11-27: painted skins, not raised bumps: a soft top-lit gradient with broad diagonal bands of lighter and deeper tone
// and a few light flecks, like a hand-painted toy
function painted(col, seed, extra){ return tex((x, n) => { const R = rnd(seed), g = x.createLinearGradient(0, 0, 0, n); g.addColorStop(0, shade(col, .07)); g.addColorStop(1, shade(col, -.06)); x.fillStyle = g; x.fillRect(0, 0, n, n);
  x.save(); x.translate(n / 2, n / 2); x.rotate(-.6); for (let i = -6; i < 6; i++){ const w = 9 + R() * 6; x.fillStyle = i % 2 ? `rgba(255,255,255,.10)` : `rgba(0,0,0,.05)`; x.fillRect(-n, i * 18, n * 2, w); } x.restore();
  for (let i = 0; i < 26; i++){ x.fillStyle = `rgba(255,255,255,${.08 + R() * .12})`; x.beginPath(); x.ellipse(R() * n, R() * n, 1.5 + R() * 3, 1 + R() * 2, R() * 3, 0, 7); x.fill(); }
  if (extra) extra(x, n, R); }, 256); }
// the face: two big dark eyes with glints, a small smile, blush; pupils/eyes/night parts are registered on g.userData
function face(g, at, w = 1){ const U = g.userData, [fx, fy, fz] = at;
  for (const sg of [-1, 1]){
    const eye = mesh(new THREE.SphereGeometry(.5, 20, 14), clay('#2A1A12', { roughness: .25 }), sg * .11 * w + fx, fy, fz); eye.scale.set(.115, .14, .05); g.add(eye); U.pupils.push(eye); eye.userData.calm = eye.material;
    const gl = mesh(new THREE.SphereGeometry(.5, 10, 8), clay('#FFFFFF', { roughness: .2 }), sg * .11 * w + fx - .02, fy + .03, fz + .022); gl.scale.set(.04, .04, .015); g.add(gl); U.glints.push(gl);
    const halo = new THREE.Sprite(HALO); halo.scale.setScalar(.26); halo.position.set(sg * .11 * w + fx, fy, fz + .03); halo.visible = false; g.add(halo); U.night.push(halo);
    const bl = mesh(new THREE.SphereGeometry(.5, 12, 8), clay('#FF9A8A', { roughness: .8 }), sg * .175 * w + fx, fy - .07, fz - .006); bl.scale.set(.07, .04, .02); bl.material.transparent = true; bl.material.opacity = .75; g.add(bl); U.day.push(bl); }
  const smile = mesh(new THREE.TorusGeometry(.03, .008, 6, 14, Math.PI), clay('#2A1A12'), fx, fy - .06, fz + .004); smile.rotation.z = Math.PI; g.add(smile); U.day.push(smile);
  for (const sg of [-1, 1]){ const f = mesh(new THREE.ConeGeometry(.016, .04, 10), clay('#FFF8EC', { roughness: .3 }), fx + sg * .025, fy - .075, fz + .004); f.rotation.x = Math.PI; f.visible = false; g.add(f); U.night.push(f); }
}
export const HALO = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,110,80,1)'); gr.addColorStop(.3, 'rgba(255,50,30,.6)'); gr.addColorStop(1, 'rgba(255,0,0,0)'); x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
  return new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }); })();

function leaf(len, col){ const g = new THREE.Group(), l = mesh(new THREE.SphereGeometry(.5, 18, 12), clay(col, { roughness: .55 })); l.scale.set(len * .72, .04, len); l.position.z = len * .45; g.add(l);
  const rib = mesh(new THREE.CylinderGeometry(.006, .006, len * .8, 6), clay(shade(col, -.15))); rib.rotation.x = Math.PI / 2; rib.position.set(0, .018, len * .42); g.add(rib); return g; }

const BUILD = {
  moss(g){ const U = g.userData, R = rnd(41), green = '#5DAA3C';
    const bm = std({ map: painted(green, 7), roughness: .85 }); U.body.push(bm);
    g.add(mesh(new RoundedBoxGeometry(.56, .46, .52, 5, .13), bm, 0, .23, 0));
    g.add(mesh(new RoundedBoxGeometry(.4, .26, .04, 4, .06), clay('#E9D7B0', { roughness: .8 }), 0, .2, .255));   // cream face patch
    const cm = [green, '#6DBA48', '#4E9632'].map(c => { const m = clay(c, { roughness: .8 }).clone(); U.body.push(m); return m; });
    for (let i = 0; i < 34; i++){ const a = R() * Math.PI * 2, top = R() < .55, r = .06 + R() * .05;   // moss clumps over the top and sides, never on the face
      let x, y, z; if (top){ x = (R() - .5) * .52; z = (R() - .5) * .48; y = .46; } else { const s = R() * 3 | 0; y = .14 + R() * .3; if (s === 0){ x = -.28; z = (R() - .5) * .5; } else if (s === 1){ x = .28; z = (R() - .5) * .5; } else { z = -.26; x = (R() - .5) * .52; } }
      if (z > .2 && y < .4 && Math.abs(x) < .24) continue; const c = mesh(new THREE.SphereGeometry(r, 16, 12), cm[i % 3], x, y, z); c.scale.y = .75; g.add(c); }
    for (const sg of [-1, 1]){ const l = leaf(.3, '#7CC24E'); l.rotation.order = 'ZXY'; l.position.set(sg * .06, .5, 0); l.rotation.set(-1.25, 0, -sg * .55); g.add(l); l.userData.wig = sg; }
    face(g, [0, .23, .277], 1); },
  corn(g){ const U = g.userData, yellow = '#F5C531';
    const kernels = painted(yellow, 9, (x, n, R) => { x.strokeStyle = 'rgba(190,120,15,.35)'; x.lineWidth = 2.2;   // kernels drawn as soft painted lines only, the surface stays smooth
      for (let r = 0; r < 6; r++) for (let q = -1; q < 6; q++){ const cx = q * 51.2 + (r % 2) * 25.6 + 25.6, cy = r * 51.2 + 25.6; x.beginPath(); x.ellipse(cx, cy, 23, 21, 0, 0, 7); x.stroke();
        x.fillStyle = 'rgba(255,255,255,.22)'; x.beginPath(); x.ellipse(cx - 7, cy - 8, 7, 4.5, -.3, 0, 7); x.fill(); } });
    const bm = std({ map: kernels, roughness: .55 }); U.body.push(bm);
    g.add(mesh(new RoundedBoxGeometry(.56, .5, .52, 6, .16), bm, 0, .25, 0));
    const st = mesh(new THREE.CylinderGeometry(.025, .035, .08, 10), clay('#5E9E35'), 0, .53, 0); g.add(st);
    for (const sg of [-1, 1]){ const l = leaf(.24, '#86C94F'); l.position.set(0, .56, 0); l.rotation.order = 'ZXY'; l.rotation.set(-1.1, 0, -sg * .85); g.add(l); l.userData.wig = sg; }
    face(g, [0, .24, .262], 1); },
  lava(g){ const U = g.userData, red = '#C8432F';
    const rock = std({ map: painted(red, 13, (x, n, R) => { for (let i = 0; i < 10; i++){ x.fillStyle = `rgba(120,30,15,${.08 + R() * .1})`; x.beginPath(); x.ellipse(R() * n, R() * n, 12 + R() * 20, 8 + R() * 12, R() * 3, 0, 7); x.fill(); } }), roughness: .8, flatShading: true }); U.body.push(rock);
    const b = mesh(new THREE.DodecahedronGeometry(.3, 0), rock, 0, .27, 0); b.scale.set(1.05, .88, .95); b.rotation.set(.15, .35, 0); g.add(b);
    for (const [x, y, z, s] of [[-.27, .16, .07, .1], [.28, .17, .05, .11], [-.1, .47, -.08, .09], [.15, .45, -.06, .08]]){ const r = mesh(new THREE.DodecahedronGeometry(s, 0), rock, x, y, z); r.rotation.set(x * 5, y * 4, z); g.add(r); if (Math.abs(x) > .2) r.userData.wig = x < 0 ? -1 : 1; }
    // the glowing crack down the front-top, zigzag
    const pts = [[-.05, .53, .02], [.0, .46, .14], [.07, .42, .2], [.03, .36, .26], [.1, .3, .28]].map(p => new THREE.Vector3(...p));
    const crack = mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, 'catmullrom', .1), 24, .016, 6), std({ color: '#FFD45A', emissive: '#FFB020', emissiveIntensity: 1.6, toneMapped: false }), 0, 0, 0); crack.castShadow = false; g.add(crack); U.glow.push(crack.material);
    const horn = mesh(new THREE.ConeGeometry(.045, .12, 10), clay('#E8892E'), .14, .55, -.02); horn.rotation.z = -.4; horn.visible = false; g.add(horn); U.night.push(horn);
    face(g, [0, .24, .27], .95); },
  drop(g){ const U = g.userData, blue = '#6CC4F2';
    const prof = []; for (let i = 0; i <= 28; i++){ const t = i / 28; prof.push(new THREE.Vector2(Math.max(.001, dropR(t)), t * .62)); }
    const bm = std({ map: painted(blue, 17), roughness: .12, metalness: 0, transparent: true, opacity: .95 }); U.body.push(bm);
    const b = mesh(new THREE.LatheGeometry(prof, 36), bm, 0, 0, 0); g.add(b);
    const hl = mesh(new THREE.SphereGeometry(.5, 14, 10), std({ color: '#FFFFFF', transparent: true, opacity: .75, roughness: .1 }), -.13, .4, .19); hl.scale.set(.09, .05, .03); hl.rotation.z = .6; g.add(hl); U.day.push(hl);
    const horn = mesh(new THREE.ConeGeometry(.04, .12, 12), std({ color: '#5AB8EE', roughness: .15 }), .2, .4, 0); horn.rotation.z = -.9; horn.visible = false; g.add(horn); U.night.push(horn);
    face(g, [0, .2, .3], 1); }
};
// teardrop radius along its height t (0 bottom .. 1 tip): a round belly that narrows to a soft point
function dropR(t){ const u = .06 + t * .94; return .31 * Math.pow(Math.sin(Math.PI * Math.pow(u, .78)), .9) * (1 - .1 * t); }   // round belly low down, narrowing to a soft point

export const MODEL_KIND = { jelly: 'drop', spiky: 'corn', beetle: 'lava', moss: 'moss' };
export function critterModel(kind){ const look = MODEL_KIND[kind]; if (!look) return null;
  const g = new THREE.Group(), inner = new THREE.Group(); inner.scale.setScalar(.9); g.add(inner);
  Object.assign(inner.userData, { pupils: [], glints: [], night: [], day: [], body: [], glow: [] }); BUILD[look](inner);
  inner.userData.body.forEach(m => { m.userData.c0 = m.color.getHex(); });
  g.userData.inner = inner; Object.assign(g.userData, inner.userData); g.userData.color = '#' + new THREE.Color(inner.userData.body[0].color.getHex()).getHexString();
  if (look === 'moss') g.userData.color = '#5DAA3C'; if (look === 'corn') g.userData.color = '#F5C531'; if (look === 'lava') g.userData.color = '#C8432F'; if (look === 'drop') g.userData.color = '#6CC4F2';
  return g; }

// ---- sculpted versions (owner 2026-11-27: "your modelling is rough, match the reference"): each critter is turned into 3D straight from the
// reference art with Hunyuan3D-2 on this Mac (tools/gen3d.py + paint3d.py, legs cut off in the picture). The file is models/mon-<look>.glb.
// The game shows the hand-built version until the sculpted one has loaded, then swaps it in. NIGHT_EYES are the eye centres on the
// sculpt (model space, height normalised to 1) where the glowing night eyes and fangs go.
const loader = new GLTFLoader(), SCULPT = {};
export const NIGHT_EYES = { moss: null, corn: null, lava: null, drop: null };
function sculpt(look){ return SCULPT[look] || (SCULPT[look] = new Promise(res => loader.load(new URL(`../../models/mon-${look}.glb`, import.meta.url).href, gl => res(gl.scene), undefined, () => res(null)))); }
export function upgrade(g, kind, height){ const look = MODEL_KIND[kind]; if (!look) return;
  sculpt(look).then(src => { if (!src) return; const inner = g.userData.inner, m = src.clone(true);
    const box = new THREE.Box3().setFromObject(m), size = box.getSize(new THREE.Vector3()), k = height / size.y;
    m.scale.setScalar(k); m.position.set(-(box.min.x + size.x / 2) * k, -box.min.y * k, -(box.min.z + size.z / 2) * k);
    const body = []; m.traverse(o => { if (o.isMesh){ o.castShadow = true; o.material = o.material.clone(); o.material.roughness = Math.max(.35, o.material.roughness ?? .6); o.material.metalness = 0; o.material.userData.c0 = o.material.color.getHex(); body.push(o.material); } });
    for (const c of [...inner.children]) inner.remove(c);
    const U = inner.userData; U.pupils = []; U.glints = []; U.day = []; U.glow = []; U.night = []; U.body = body; inner.add(m);
    const E = NIGHT_EYES[look]; if (E){ for (const [x, y, z, r] of E){   // glowing night eyes sit on top of the painted ones
        const eye = new THREE.Mesh(new THREE.SphereGeometry(r * height, 16, 12), new THREE.MeshStandardMaterial({ color: '#ff4a3a', emissive: '#ff2010', emissiveIntensity: 3, toneMapped: false })); eye.scale.z = .45; eye.position.set(x * height, y * height, z * height); eye.visible = false; inner.add(eye); U.night.push(eye);
        const halo = new THREE.Sprite(HALO); halo.scale.setScalar(r * height * 5.5); halo.position.copy(eye.position); halo.position.z += .01; halo.visible = false; inner.add(halo); U.night.push(halo); }
      const mx = (E[0][0] + E[1][0]) / 2 * height, my = (Math.min(E[0][1], E[1][1]) - E[0][3] * 1.6) * height, mz = Math.max(E[0][2], E[1][2]) * height;
      for (const sg of [-1, 1]){ const f = new THREE.Mesh(new THREE.ConeGeometry(.016, .04, 10), clay('#FFF8EC', { roughness: .3 })); f.rotation.x = Math.PI; f.position.set(mx + sg * .028, my, mz); f.visible = false; inner.add(f); U.night.push(f); } }
    Object.assign(g.userData, { pupils: U.pupils, glints: U.glints, day: U.day, glow: U.glow, night: U.night, body: U.body });
    if (g.userData.onUpgrade) g.userData.onUpgrade(); }); }
