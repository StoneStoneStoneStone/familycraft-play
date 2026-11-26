// Things in the world besides the player: dropped items (walk into them to pick up), critters with
// spawn points that come back after a timer (like field monsters in an online RPG), and small decorations.
import { CRITTER_LOOKS } from './critter-looks.js';
import { critterModel, upgrade } from './critter-models.js';
import * as THREE from 'three';
import { clay, shadowAll } from '../fx/materials.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { heldMesh } from './character.js';
import { Body } from '../physics/body.js';
import { ITEMS } from '../items/items.js';
import { BLOCK } from '../world/voxel.js';

import { TUNING } from '../data/tuning.js';
export class Drops {
  constructor(game){ this.g = game; this.list = []; }
  spawn(id, x, y, z, { pop = true, n = 1, uid, remote = false } = {}){
    if (!ITEMS[id]) return null; const net = this.g.net; uid = uid || (net ? net.id : 'L') + (this.c = (this.c || 0) + 1);
    if (this.list.some(d => d.uid === uid)) return null;
    const m = heldMesh(id); m.scale.setScalar(ITEMS[id].place !== undefined ? 1.1 : ITEMS[id].look !== undefined ? .8 : 1); m.position.set(x, y, z); this.g.scene.add(m);
    const d = { uid, id, n, m, body: new Body({ x, y, z, r: .15, h: .3 }), age: 0, bob: Math.random() * 6 };
    if (pop && !remote){ d.body.vy = 4; d.body.kx = (Math.random() - .5) * 2; d.body.kz = (Math.random() - .5) * 2; }
    this.list.push(d); if (!remote && net && net.on) net.send({ k: 'drop', uid, id, n, x: +x.toFixed(2), y: +y.toFixed(2), z: +z.toFixed(2) }); return d;
  }
  remove(uid){ const k = this.list.findIndex(d => d.uid === uid); if (k >= 0){ this.g.scene.remove(this.list[k].m); this.list.splice(k, 1); } }
  clear(){ this.list.forEach(d => this.g.scene.remove(d.m)); this.list = []; }
  update(dt, t){
    const P = this.g.player.body;
    for (let k = this.list.length - 1; k >= 0; k--){
      const d = this.list[k]; d.age += dt; d.body.step(this.g.world, dt, 14);
      const dx = P.x - d.body.x, dz = P.z - d.body.z, dist = Math.hypot(dx, dz), dy = d.body.y - P.y;
      if (d.age > .35 && dist < TUNING.pickup.magnet && dy > -1 && dy < 1.9){ d.pull = (d.pull || 0) + dt; const sp = 5 + d.pull * 22;
        d.body.x += dx / dist * dt * sp; d.body.z += dz / dist * dt * sp; d.m.scale.setScalar((d.base = d.base || d.m.scale.x) * (d.pull < .09 ? 1 + d.pull / .09 * .45 : Math.max(.45, 1.45 - (d.pull - .09) * 3.2)));
        if (dist < .55 && this.g.inv.add(d.id, d.n, true)){ this.g.scene.remove(d.m); this.list.splice(k, 1); this.g.pickup(d.id, d.n, d.m.position); if (this.g.net && this.g.net.on) this.g.net.send({ k: 'took', uid: d.uid }); continue; } }
      d.m.position.set(d.body.x, d.body.y + .12 + (d.body.ground ? Math.sin(t * 3 + d.bob) * .05 : 0), d.body.z); d.m.rotation.y += dt * 2.2;
    }
  }
  save(){ return this.list.map(d => [d.id, d.n, +d.body.x.toFixed(2), +d.body.y.toFixed(2), +d.body.z.toFixed(2)]); }
}

// Critters. Each one belongs to a spawn point; when beaten it comes back there after `respawn` seconds.
// Kinds are data: hit points, speed, how they move, what they leave behind.
// Critter kinds. Every critter is a soft block with a two-tone "drip" skin, big eyes and one small detail;
// they differ by skin, detail and how they behave. sight = cells at which it notices you and gives chase.
export const KINDS = {
  // meadow critters (home island)
  jelly:  { hp: 2, speed: 2.2, hop: true,  drop: 'gel',   r: .27, h: .50, sight: 6, respawn: 15, roam: 8, top: '#f4b321', base: '#fff3d2', dark: '#b97a0c', look: 'honey' },    // honey cube: honey drips, tiny wings; bees notice you early
  beetle: { hp: 3, speed: 1.6, hop: false, drop: 'apple', r: .26, h: .43, sight: 3, respawn: 20, roam: 8, top: '#e2453c', base: '#fff1e6', dark: '#2a1c1c', look: 'dotbug' },   // dot bug: red shell, black dots; shy
  spiky:  { hp: 4, speed: 1.7, hop: false, drop: 'apple', r: .29, h: .56,  sight: 5, respawn: 30, roam: 8, top: '#8e6bd8', base: '#f4effd', dark: '#4f8f3a', look: 'thistle' },  // thistle cube: a pink flower tuft and leaves
  // for later maps (not spawned on the meadow)
  moss:   { hp: 3, speed: 1.8, hop: true,  drop: 'seeds', r: .28, h: .52, sight: 5, respawn: 20, roam: 8, top: '#5DAA3C', base: '#E9D7B0', dark: '#3E7A28', look: 'moss' },   // moss cube with two leaves (reference sheet)
  frost:  { hp: 3, speed: 2.0, hop: true,  drop: 'gel',   r: .27, h: .50, sight: 5, respawn: 20, roam: 8, top: '#5ec8f0', base: '#f2fbff', dark: '#2b8fc0', look: 'frost' }     // snow map: icy jelly with a snow cap
};
const skinCache = {};
function skin(K){            // side texture: dark-edged top colour dripping over a light base, with two blush squares
  const k = K.top; if (skinCache[k]) return skinCache[k];
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
  x.fillStyle = K.base; x.fillRect(0, 0, 128, 128); x.fillStyle = K.top; x.fillRect(0, 0, 128, 62);
  [[10, 18], [42, 26], [74, 18], [104, 24]].forEach(([l, w]) => { x.beginPath(); x.roundRect(l, 50, w, 26 + (l % 3) * 6, 7); x.fill(); });
  x.fillStyle = 'rgba(0,0,0,.08)'; x.fillRect(0, 0, 128, 8);
  x.fillStyle = '#ff7f8e'; x.beginPath(); x.roundRect(14, 44, 14, 11, 3); x.roundRect(100, 44, 14, 11, 3); x.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return skinCache[k] = t;
}
// textured skins: each kind gets its own painted surface with a matching bump, like the concept art (moss, kernels, shell, gloss)
const SKINS = {}, cv = () => { const c = document.createElement('canvas'); c.width = c.height = 128; return c; };
const shadeHex = (hex, k) => { const c = new THREE.Color(hex); c.offsetHSL(0, 0, k); return '#' + c.getHexString(); };
function critterSkin(kind, col){ if (SKINS[kind]) return SKINS[kind];
  const c = cv(), x = c.getContext('2d'), b = cv(), y = b.getContext('2d'), R = (n => () => (n = (n * 16807) % 2147483647) / 2147483647)(kind.length * 977 + 13);
  x.fillStyle = col; x.fillRect(0, 0, 128, 128); y.fillStyle = '#808080'; y.fillRect(0, 0, 128, 128);
  if (kind === 'spiky'){   // corn-kernel skin: rows of plump rounded kernels with dark gaps
    for (let r = 0; r < 8; r++) for (let q = 0; q < 8; q++){ const cx = q * 16 + (r % 2) * 8 + 8, cy = r * 16 + 8;
      x.fillStyle = shadeHex(col, (R() - .5) * .06 + .04); x.beginPath(); x.ellipse(cx, cy, 7, 6.5, 0, 0, 7); x.fill(); x.fillStyle = 'rgba(255,255,255,.35)'; x.beginPath(); x.ellipse(cx - 2, cy - 2, 2.5, 2, 0, 0, 7); x.fill();
      const gr = y.createRadialGradient(cx, cy, 1, cx, cy, 8); gr.addColorStop(0, '#ffffff'); gr.addColorStop(1, '#404040'); y.fillStyle = gr; y.beginPath(); y.ellipse(cx, cy, 7.5, 7, 0, 0, 7); y.fill(); }
  } else if (kind === 'beetle'){   // shell: big soft spots and a seam down the back
    for (let i = 0; i < 9; i++){ const cx = R() * 128, cy = R() * 128, r = 6 + R() * 8; x.fillStyle = shadeHex(col, -.12); x.beginPath(); x.arc(cx, cy, r, 0, 7); x.fill(); y.fillStyle = '#5a5a5a'; y.beginPath(); y.arc(cx, cy, r, 0, 7); y.fill(); }
    x.fillStyle = shadeHex(col, -.2); x.fillRect(62, 0, 4, 128); y.fillStyle = '#303030'; y.fillRect(62, 0, 4, 128);
    for (let i = 0; i < 400; i++){ x.fillStyle = `rgba(255,255,255,${R() * .06})`; x.fillRect(R() * 128, R() * 128, 1, 1); }
  } else if (kind === 'jelly'){   // glossy jelly: little bubbles and a soft inner glow
    const gr = x.createRadialGradient(64, 50, 8, 64, 64, 90); gr.addColorStop(0, shadeHex(col, .12)); gr.addColorStop(1, shadeHex(col, -.06)); x.fillStyle = gr; x.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 16; i++){ const cx = R() * 128, cy = R() * 128, r = 2 + R() * 5; x.strokeStyle = 'rgba(255,255,255,.45)'; x.lineWidth = 1.2; x.beginPath(); x.arc(cx, cy, r, 0, 7); x.stroke(); x.fillStyle = 'rgba(255,255,255,.18)'; x.beginPath(); x.arc(cx, cy, r, 0, 7); x.fill(); y.fillStyle = '#a0a0a0'; y.beginPath(); y.arc(cx, cy, r, 0, 7); y.fill(); }
  } else {   // fluffy snow: soft clumps
    for (let i = 0; i < 70; i++){ const cx = R() * 128, cy = R() * 128, r = 3 + R() * 7; x.fillStyle = `rgba(255,255,255,${.15 + R() * .25})`; x.beginPath(); x.arc(cx, cy, r, 0, 7); x.fill(); y.fillStyle = `rgba(255,255,255,${.3 + R() * .4})`; y.beginPath(); y.arc(cx, cy, r, 0, 7); y.fill(); }
  }
  const map = new THREE.CanvasTexture(c), bump = new THREE.CanvasTexture(b); map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = bump.anisotropy = 4;
  return SKINS[kind] = new THREE.MeshStandardMaterial({ map, bumpMap: bump, bumpScale: kind === 'spiky' ? 2.2 : 1.2, roughness: kind === 'jelly' ? .28 : kind === 'beetle' ? .45 : .75, metalness: 0 }); }
const PART = {}; function partSkin(col){ return PART[col] || (PART[col] = clay(col, { roughness: .45 })); }
const HALO = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,90,70,1)'); gr.addColorStop(.35, 'rgba(255,40,30,.55)'); gr.addColorStop(1, 'rgba(255,0,0,0)'); x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
  return new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }); })();
const DARK_EYE = new THREE.MeshStandardMaterial({ color: '#1c0d0d', roughness: .4 });
// the colour of a critter's body (its death puff matches it) and its eyes: calm by day, glowing red when hostile
export const mobColor = m => (m.g && m.g.userData.color) || '#9a7be0';
const RED_EYE = new THREE.MeshStandardMaterial({ color: '#ff4a3a', emissive: '#ff2010', emissiveIntensity: 3, roughness: .3, toneMapped: false });
export function eyes(m, mad){ if (m.mad === mad) return; m.mad = mad; const U = m.g.userData; (U.day || []).forEach(o => o.visible = !mad); (U.glints || []).forEach(o => o.visible = !mad);
  (U.body || []).forEach(b => { if (b.userData.c0 !== undefined) b.color.setHex(b.userData.c0).multiplyScalar(mad ? .62 : 1); }); (U.glow || []).forEach(gm => gm.emissiveIntensity = mad ? 3 : 1.6); (U.pupils || []).forEach(p => { p.material = mad ? RED_EYE : p.userData.calm; }); (U.eyes || []).forEach(e => { e.material = mad ? DARK_EYE : e.userData.calm; }); (U.night || []).forEach(o => o.visible = mad); }
export class Mobs {
  constructor(game){ this.g = game; this.list = []; }
  // built from the part tables in critter-looks.js (designed in design/critters/critters-spec.md); beads, feelers, nubs and puffs wiggle
  mesh(kind){
    const nm = critterModel(kind); if (nm){ upgrade(nm, kind, .5); return nm; }   // the reference-sheet models; the sculpted ones replace them once loaded
    // owner 2026-11-27: no feet (they bounce like marshmallows), bolder horns/beads/spikes, a textured skin per kind,
    // and at night glowing red eyes, dark eye whites and two little fangs
    const L = CRITTER_LOOKS[kind] || CRITTER_LOOKS.spiky, g = new THREE.Group(), inner = new THREE.Group(); inner.scale.setScalar(.9); g.add(inner); g.userData.inner = inner;
    const body = L.parts.find(p => /body/i.test(p.n)) || L.parts[0], drop = body.c[1] - body.d[1] / 2, bc = body.c;   // lower everything so the body sits on the ground
    g.userData.eyes = []; g.userData.pupils = []; g.userData.night = [];
    for (const p0 of L.parts){ if (/foot/i.test(p0.n)) continue;
      const p = { ...p0, d: [...p0.d], c: [p0.c[0], p0.c[1] - drop, p0.c[2]] };
      const extra = /bead|puff|nub|feeler|plate/i.test(p.n);
      if (extra){ const k = /plate/i.test(p.n) ? 1.12 : 1.45; p.d = p.d.map(v => v * k); for (const a of [0, 1, 2]) p.c[a] = (a === 1 ? bc[1] - drop : bc[a]) + (p.c[a] - (a === 1 ? bc[1] - drop : bc[a])) * 1.1; }   // bigger and pushed out a touch
      const [w, h, d] = p.d; let geo;
      if (p.s === 'rbox') geo = new RoundedBoxGeometry(w, h, d, 5, p.r || Math.min(w, h, d) * .2);
      else if (p.s === 'cone') geo = new THREE.CylinderGeometry((p.t || w * .6) / 2, w / 2, h, 20);
      else geo = new THREE.SphereGeometry(.5, 22, 16);
      const face = /eye|pupil|glint|mouth|grin|blush/i.test(p.n);
      const mat = p === p0 || !/body/i.test(p.n) ? (/body/i.test(p.n) ? critterSkin(kind, p.col) : extra ? partSkin(p.col) : clay(p.col, { roughness: /pupil|glint/i.test(p.n) ? .2 : face ? .35 : .6 })) : critterSkin(kind, p.col);
      const m = new THREE.Mesh(geo, /body/i.test(p.n) ? critterSkin(kind, p.col) : mat);
      if (p.s !== 'rbox' && p.s !== 'cone') m.scale.set(w, h, d);
      m.position.set(p.c[0], p.c[1], p.c[2]); m.castShadow = !face; m.userData.part = p.n;
      if (/bead|feeler|nub|puff/i.test(p.n) && !/tail|back/i.test(p.n)) m.userData.wig = p.c[0] < 0 ? -1 : 1;
      if (/pupil/i.test(p.n)){ g.userData.pupils.push(m); m.userData.calm = m.material;
        const halo = new THREE.Sprite(HALO); halo.scale.setScalar(2.6); halo.visible = false; m.add(halo); g.userData.night.push(halo); }
      if (/eye/i.test(p.n) && !/pupil/i.test(p.n)){ g.userData.eyes.push(m); m.userData.calm = m.material; }
      inner.add(m); }
    // two small fangs under the mouth, shown at night
    const mouth = L.parts.find(p => /mouth|grin/i.test(p.n)), fy = (mouth ? mouth.c[1] : .25) - drop - .035, fz = bc[2] + body.d[2] / 2 + .004;
    [-1, 1].forEach(sg => { const f = new THREE.Mesh(new THREE.ConeGeometry(.018, .045, 10), clay('#FFF8EC', { roughness: .3 })); f.rotation.x = Math.PI; f.position.set(sg * .03, fy, fz); f.visible = false; inner.add(f); g.userData.night.push(f); });
    g.userData.color = body.col;
    return g;
  }
  add(x, z, { kind = 'spiky', respawn, roam } = {}){ const KK = KINDS[kind] || KINDS.spiky; if (respawn === undefined) respawn = KK.respawn || 20; if (roam === undefined) roam = KK.roam || 8;
    const W = this.g.world; if (!W.top(x, z)) return; const K = KINDS[kind] || KINDS.spiky;
    const g = this.mesh(kind); const m = { kind, K, g, maxHp: K.hp, home: [W.wx(x), W.wx(z)], spawn: [x, z], respawn, roam, hop: Math.random() * 6, flash: 0, dead: false, wait: 0 };
    g.userData.onUpgrade = () => { m.mad = undefined; };   // the sculpted model arrived: let the eyes re-apply day/night
    this.place(m); this.list.push(m); return m;
  }
  place(m){ const W = this.g.world, [x, z] = m.spawn; m.body = new Body({ x: W.wx(x), y: W.top(x, z) + .01, z: W.wx(z), r: m.K.r, h: m.K.h }); m.hopT = Math.random(); m.hp = m.maxHp; m.hits = 0; m.dead = false; if (!m.g.parent) this.g.scene.add(m.g); }
  kill(m){ m.dead = true; m.wait = m.respawn; this.g.scene.remove(m.g); }
  revive(m){ this.place(m); this.g.particles.burst(new THREE.Vector3(m.body.x, m.body.y + .3, m.body.z), { color: '#fff3df', n: 10, speed: 2 }); }
  follow(l){ l.forEach((s, i) => { const m = this.list[i]; if (!m) return; if (s[4] && !m.dead){ this.g.particles.burst(m.g.position, { color: mobColor(m), n: 14, speed: 4 }); this.kill(m); } else if (!s[4] && m.dead) this.revive(m); m.net = s; }); }
  update(dt){
    const P = this.g.player.body, guest = this.g.net && this.g.net.guest, T = TUNING.mob, night = this.g.day && this.g.day.on ? this.g.day.night : 0;
    for (const m of this.list){
      if (m.dead){ if (!guest && (m.wait -= dt) <= 0) this.revive(m); continue; }
      if (guest){ if (m.net){ m.body.x += (m.net[0] - m.body.x) * Math.min(1, dt * 10); m.body.y += (m.net[1] - m.body.y) * Math.min(1, dt * 10); m.body.z += (m.net[2] - m.body.z) * Math.min(1, dt * 10); m.g.rotation.y = m.net[3]; } }
      else {
        const dx = P.x - m.body.x, dz = P.z - m.body.z, d = Math.hypot(dx, dz), home = Math.hypot(m.body.x - m.home[0], m.body.z - m.home[1]);
        let vx = 0, vz = 0, sp = m.K.speed;
        // owner 2026-11-27: by day critters leave you alone unless you hit one (then its own kind nearby joins in);
        // at night every critter turns hostile: glowing red eyes, sees further, runs a little faster and comes for you
        m.angry = Math.max(0, (m.angry || 0) - dt); const hostile = night > .5 || m.angry > 0; eyes(m, hostile);
        const sight = (m.K.sight || 5) * (night > .5 ? T.nightSight : 1); if (night > .5) sp *= T.nightSpeed;
        const sees = hostile && (d < sight || (m.chasing && d < sight + 2));   // notices you inside its sight, loses you a bit further out
        if (sees && !m.chasing && this.g.floaters) this.g.floaters.add(m.g.position.clone().add(new THREE.Vector3(0, m.K.h + .4, 0)), '!', 'dmg'); m.chasing = sees;
        if (sees && d > .5 && !m.body.kx && home < m.roam * (night > .5 ? 1.6 : 1)){ vx = dx / d * sp; vz = dz / d * sp; m.g.rotation.y = Math.atan2(dx, dz); }
        else if (home > 3){ vx = -(m.body.x - m.home[0]) / home * sp * .7; vz = -(m.body.z - m.home[1]) / home * sp * .7; m.g.rotation.y = Math.atan2(vx, vz); }
        else {   // calm: potter about near home
          m.wT = (m.wT || 0) - dt; if (m.wT <= 0){ m.wT = 2 + Math.random() * 3; m.goal = Math.random() < .45 ? null : [m.home[0] + (Math.random() - .5) * 5, m.home[1] + (Math.random() - .5) * 5]; }
          if (m.goal){ const gx = m.goal[0] - m.body.x, gz = m.goal[1] - m.body.z, gd = Math.hypot(gx, gz); if (gd > .3){ vx = gx / gd * sp * .35; vz = gz / gd * sp * .35; m.g.rotation.y = Math.atan2(vx, vz); } else m.goal = null; } }
        m.hopT -= dt; if (m.body.ground){ m.body.vx = m.body.vz = 0; if (m.hopT <= 0 && (vx || vz)){ m.body.vy = 5.2; m.hopT = .62; m.squash = .22; } } else { m.body.vx = vx * 1.35; m.body.vz = vz * 1.35; }   // no feet: every critter gets about by bouncing
        const wasG = m.body.ground, r = m.body.step(this.g.world, dt); if (r.bumped && m.body.ground) m.body.vy = 6.5; if (!wasG && m.body.ground) m.squash = .3;
        if (m.body.wet) this.place(m);
      }
      m.hop += dt * 7;
      m.g.userData.inner.children.forEach(c => { if (c.userData.wig) c.rotation.z = c.userData.wig * Math.sin(m.hop * 4) * .14; });
      // marshmallow squash and stretch: flattens on landing and before a jump, stretches in the air, jiggles softly at rest
      { m.squash = Math.max(0, (m.squash || 0) - dt); const pre = m.body.ground && m.hopT < .12 && m.chasing ? .12 : 0;
        const k = m.body.ground ? 1 - (m.squash * 1.9 + pre) + Math.sin(m.hop * .9) * .045 : 1.18; m.g.scale.set(1 / Math.sqrt(k), k, 1 / Math.sqrt(k)); m.g.position.set(m.body.x, m.body.y, m.body.z); }
      if (m.flash > 0){ m.flash -= dt; m.g.scale.multiplyScalar(1.25); }
      if ((night > .5 || m.angry > 0) && Math.hypot(P.x - m.body.x, P.z - m.body.z) < .8 && Math.abs(m.body.y - P.y) < 1) this.g.player.hurt(1, 'critter', m.body);   // calm critters do not bite
    }
  }
  hit(m, dmg, from){
    m.hp -= dmg; m.hits++; m.flash = .2; const T = TUNING.mob; m.angry = T.angryTime;
    for (const o of this.list) if (o !== m && !o.dead && o.kind === m.kind && !(o.angry > 0) && Math.hypot(o.body.x - m.body.x, o.body.z - m.body.z) < T.callRange){   // its own kind comes to help
      o.angry = T.angryTime; if (this.g.floaters) this.g.floaters.add(o.g.position.clone().add(new THREE.Vector3(0, o.K.h + .4, 0)), '!', 'dmg'); } const dx = m.body.x - from.x, dz = m.body.z - from.z, d = Math.hypot(dx, dz) || 1; m.body.kx = dx / d * 7; m.body.kz = dz / d * 7; m.body.vy = 4;
    if (m.hp <= 0){ this.kill(m); return true; } return false;
  }
}

// Small decorations on top of grass (grass tufts, flowers); cleared when the column changes.
export class Deco {
  constructor(game){ this.g = game; this.byCell = new Map(); }
  add(x, z, kind = Math.random() < .5 ? 'flower' : 'grass'){
    const W = this.g.world, tb = W.topBlock(x, z); if (!tb || tb.b !== BLOCK.grass) return;
    const y = tb.y + 1, g = new THREE.Group(); g.position.set(W.wx(x) + (Math.random() - .5) * .5, y, W.wx(z) + (Math.random() - .5) * .5);
    if (kind === 'flower'){ const st = new THREE.Mesh(new THREE.CylinderGeometry(.03, .03, .3, 6), clay('#5fb85e')); st.position.y = .15; g.add(st);
      const c = ['#ffd166', '#ff8fa3', '#ffffff', '#b79cf0'][Math.random() * 4 | 0]; for (let i = 0; i < 5; i++){ const p = new THREE.Mesh(new THREE.SphereGeometry(.075, 8, 6), clay(c)); p.position.set(Math.cos(i * 1.257) * .1, .32, Math.sin(i * 1.257) * .1); g.add(p); }
      const m = new THREE.Mesh(new THREE.SphereGeometry(.06, 8, 6), clay('#ffb52e')); m.position.y = .34; g.add(m);
    } else for (let i = 0; i < 3; i++){ const b = new THREE.Mesh(new THREE.ConeGeometry(.07, .34, 6), clay('#5ccf4a')); b.position.set((i - 1) * .1, .17, 0); b.rotation.z = (i - 1) * -.35; g.add(b); }
    shadowAll(g, true, false); this.g.scene.add(g); const k = x + ',' + z; (this.byCell.get(k) || this.byCell.set(k, []).get(k)).push(g);
  }
  clear(x, z){ const k = x + ',' + z; (this.byCell.get(k) || []).forEach(g => this.g.scene.remove(g)); this.byCell.delete(k); }
  clearAll(){ for (const k of [...this.byCell.keys()]) this.clear(...k.split(',').map(Number)); }
}
