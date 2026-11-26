// Island day clock (owner 2026-11-27; design/economy/economy-spec.md section 2, drafted by Codex).
// One island day = TUNING.clock.dayMinutes of active play. It only runs on the home island while someone is playing:
// it pauses during a talk, in mini-games and when the tab is hidden. Time away does not count.
// Sky, fog and sunlight blend between four moments; night is a soft blue (a four-year-old can still play), never dark.
// A small paper dial at the top right shows the time: midnight at the top, clockwise, with sunrise, sun, evening and moon marks.
import * as THREE from 'three';
import { TUNING } from '../data/tuning.js';
import { i18n } from '../core/i18n.js';

// hour, sun height (deg), sun direction (deg, 0 = north, clockwise), sky, sunlight colour, sunlight strength, fill light (0-1, floored by TUNING.clock.nightLight), fog near/far (cells; 0 = night values from TUNING)
// owner 2026-11-27: night is properly dark (dark navy sky, stars and a moon, you only see a short way), so lamps matter
const KEYS = [
  [5.5,  -8,  80, '#1c2658', '#A7C4FF', 0,   .30, 0,  0],
  [6.5,  20,  90, '#9ad9f8', '#FFE6C4', 2.6, .85, 36, 70],
  [12,   70, 180, '#7ed2f8', '#FFF4E0', 3.4, 1,   36, 70],
  [17,   18, 270, '#F6C98A', '#F2B27A', 2.3, .85, 32, 64],
  [19,    3, 285, '#D9826A', '#E8845A', .9,  .55, 20, 46],
  [20.5, -12, 300, '#0a0f26', '#8FB0FF', 0,  0,   0,  0]
];
const PHASES = [[6, 'clk_morning'], [11, 'clk_day'], [17, 'clk_evening'], [19.5, 'clk_night']];
i18n.add({ th: { clk_morning: 'เช้า', clk_day: 'กลางวัน', clk_evening: 'เย็น', clk_night: 'กลางคืน' },
           en: { clk_morning: 'Morning', clk_day: 'Daytime', clk_evening: 'Evening', clk_night: 'Night' } });
const cA = new THREE.Color(), cB = new THREE.Color();

// stars and a soft round moon on a far dome that follows the camera; they fade in as night falls (fog does not touch them)
function skyDome(){
  const g = new THREE.Group(), n = 520, pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++){ const u = Math.random(), v = Math.random() * .92 + .06, th = u * Math.PI * 2, ph = Math.acos(v); pos.set([Math.sin(ph) * Math.cos(th) * 90, Math.cos(ph) * 90, Math.sin(ph) * Math.sin(th) * 90], i * 3); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const stars = new THREE.Points(geo, new THREE.PointsMaterial({ color: '#fffbe8', size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false })); g.add(stars);
  const moon = new THREE.Group(), mm = new THREE.MeshBasicMaterial({ color: '#F4F1DE', transparent: true, opacity: 0, fog: false, depthWrite: false });
  moon.add(new THREE.Mesh(new THREE.CircleGeometry(5, 40), mm));
  const cm = new THREE.MeshBasicMaterial({ color: '#D9D5C0', transparent: true, opacity: 0, fog: false, depthWrite: false });
  [[1.6, 1.2, 1.1], [-1.8, -.6, .8], [.4, -2.2, .6], [-.6, 2.2, .5]].forEach(([x, y, r]) => { const c = new THREE.Mesh(new THREE.CircleGeometry(r, 24), cm); c.position.set(x, y, .01); moon.add(c); });
  const halo = new THREE.Mesh(new THREE.CircleGeometry(9, 40), new THREE.MeshBasicMaterial({ color: '#8FB0FF', transparent: true, opacity: 0, fog: false, depthWrite: false })); halo.position.z = -.02; moon.add(halo);
  g.add(moon); g.renderOrder = -1; g.traverse(o => { o.frustumCulled = false; o.renderOrder = -1; });
  return { g, stars, moon, mats: [mm, cm], halo };
}

export class Clock {
  constructor(game){ this.g = game; this.h = TUNING.clock.startHour; this.night = 0; this.dir = new THREE.Vector3(-14, 22, 10).normalize(); this.el = document.getElementById('clock'); this.phase = null; this.on = false;
    this.sky = skyDome(); game.scene.add(this.sky.g); this.sky.g.visible = false;
    this.glow = new THREE.PointLight('#ffd9a0', 0, 7, 1.6); game.scene.add(this.glow); this.lamps = []; }
  // a lamp in the world: its glowing material brightens at night and it gets a real light (pier lanterns, later torches)
  lamp(pos, mat){ const l = new THREE.PointLight('#ffc46b', 0, 10, 1.4); l.position.copy(pos); this.g.scene.add(l); this.lamps.push({ l, mat, base: mat ? mat.emissiveIntensity : 0 }); }
  set(h){ this.h = ((+h || TUNING.clock.startHour) % 24 + 24) % 24; this.apply(); }
  show(on){ this.lamps.forEach(L => this.g.scene.remove(L.l)); this.lamps = []; this.on = on; if (this.el) this.el.hidden = !on; if (!on) this.reset(); else this.apply(); }
  running(){ const g = this.g; return this.on && !document.hidden && !(g.npcs && g.npcs.talking); }
  update(dt){ if (!this.running()) return; this.h = (this.h + dt * 24 / (Math.max(1, TUNING.clock.dayMinutes) * 60)) % 24; this.apply(); }
  // blend between the two moments around the current hour (wrapping past midnight)
  sample(){ const h = this.h; let i = KEYS.length - 1; for (let k = 0; k < KEYS.length; k++) if (h >= KEYS[k][0]) i = k;
    const a = KEYS[i], b = KEYS[(i + 1) % KEYS.length], span = ((b[0] - a[0]) + 24) % 24 || 24, f = (((h - a[0]) + 24) % 24) / span, s = f * f * (3 - 2 * f);
    const L = (x, y) => x + (y - x) * s, ang = (x, y) => { let d = ((y - x + 540) % 360) - 180; return x + d * s; };
    const C = TUNING.clock, fn = v => v || C.nightFogNear, ff = v => v || C.nightFogFar;
    return { el: L(a[1], b[1]), az: ang(a[2], b[2]), sky: cA.set(a[3]).lerp(cB.set(b[3]), s).getHex(), sun: new THREE.Color(a[4]).lerp(new THREE.Color(b[4]), s).getHex(), k: L(a[5], b[5]), fill: L(a[6], b[6]), near: L(fn(a[7]), fn(b[7])), far: L(ff(a[8]), ff(b[8])) }; }
  apply(){ if (!this.on) return; const g = this.g, S = this.sample(), el = Math.max(8, S.el) * Math.PI / 180, az = S.az * Math.PI / 180;
    g.scene.background.setHex(S.sky); g.scene.fog.color.setHex(S.sky); if (g.water && g.water.material && g.water.material.color && !g.water.userData.c0) g.water.userData.c0 = g.water.material.color.getHex();
    g.sun.color.setHex(S.sun); g.sun.intensity = S.k * Math.min(1, Math.max(0, (S.el + 12) / 20));   // fades out as the sun sets
    if (g.hemi) g.hemi.intensity = 1.3 * Math.max(TUNING.clock.nightLight, S.fill);
    g.scene.fog.near = S.near; g.scene.fog.far = S.far;
    this.night = Math.min(1, Math.max(0, (6 - S.el) / 14));                                       // 0 by day, 1 once the sun is well down
    const n = this.night, sk = this.sky; sk.g.visible = n > .02; sk.stars.material.opacity = n; sk.mats.forEach(m => m.opacity = n); sk.halo.material.opacity = n * .12;
    if (g.water) g.water.material.color.set('#0fb0dd').lerp(cB.set('#0c2a4e'), n * .85);   // the sea darkens with the sky
    for (const L of this.lamps){ L.l.intensity = n * 9; if (L.mat) L.mat.emissiveIntensity = L.base + n * 2.2; }
    this.glow.intensity = n * TUNING.clock.playerGlow * 4;
    this.dir.set(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el));
    this.dial(); }
  // keep the star dome on the camera, the moon opposite the sun, and the soft glow on the player (called every frame)
  follow(cam, p){ if (!this.on) return; this.sky.g.position.copy(cam.position); const az = this.sample().az * Math.PI / 180 + Math.PI;
    this.sky.moon.position.set(Math.sin(az) * 70, 38, -Math.cos(az) * 70); this.sky.moon.lookAt(cam.position); this.glow.position.set(p.x, p.y + 1.6, p.z); }
  reset(){ const g = this.g; if (g.water) g.water.material.color.set('#0fb0dd'); this.night = 0; if (this.sky) this.sky.g.visible = false; if (this.glow) this.glow.intensity = 0; (this.lamps || []).forEach(L => L.l.intensity = 0); g.scene.fog.near = 36; g.scene.fog.far = 70; g.scene.background.set('#7ed2f8'); g.scene.fog.color.set('#7ed2f8'); g.sun.color.set('#ffe2b8'); g.sun.intensity = 3.4; if (g.hemi) g.hemi.intensity = 1.3; this.dir.set(-14, 22, 10).normalize(); }
  dial(){ if (!this.el) return; const p = this.el.querySelector('.hand'); if (p) p.setAttribute('transform', `rotate(${this.h / 24 * 360} 24 24)`);
    let k = PHASES[PHASES.length - 1][1]; for (const [hh, key] of PHASES) if (this.h >= hh) k = key; if (this.h < 5.8) k = 'clk_night';
    if (k !== this.phase){ this.phase = k; const t = i18n.t(k); this.el.querySelector('b').textContent = t; this.el.setAttribute('aria-label', t); } }
}
