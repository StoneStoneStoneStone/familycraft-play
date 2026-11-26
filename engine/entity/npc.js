// Talkable hosts that stand in the world (owner, 2026-11-26): walk up, a talk button appears, the camera lifts to
// frame the two of you, the host speaks in their own voice, you pick what to play, and their mini-game opens on
// top of the island. The island keeps running underneath, so coming back is instant.
// A host is data (NPCS); the engine part (Npcs) knows nothing about any one game.
import * as THREE from 'three';
import { loadCharacter, Animator } from './character.js';
import { clay } from '../fx/materials.js';
import { i18n } from '../core/i18n.js';
import { TUNING } from '../data/tuning.js';
import { TALK_SONGS } from '../fx/songs.js';

// Where the mini-games live. In dev serve.mjs mounts ../familycraft-home at /home/; in production deploy it at the same path.
const GAMES = 'home/';

export const NPCS = {
  sing: {
    id: 'sing', file: 'models/npc-sing.gltf.json', size: 1.5, th: 'จิ้งจอกซิ่ง', en: 'Zoomy Fox',
    bust: 'img/npc/sing/', ext: '.webp', voice: 'music/voice/jingjok-sing/', game: GAMES + 'race.html', prop: 'kart',
    subjects: [{ id: 'math', th: 'เลข', en: 'Maths' }, { id: 'en', th: 'อังกฤษ', en: 'English' }, { id: 'th', th: 'ไทย', en: 'Thai' }],
    levels: [{ th: 'ง่าย', en: 'Easy' }, { th: 'กลาง', en: 'Medium' }, { th: 'ยาก', en: 'Hard' }],
    // each line: [face, voice clip, text]; `s` is the chosen subject
    lines: {
      th: s => [['stop', 'talk-1', 'เฮ้ย หยุดก่อน! ฉันคือจิ้งจอกซิ่ง เร็วที่สุดบนเกาะนี้ อันดับสองคือลมนะ'],
                ['point', 'talk-2', 'วันนี้ฉันขอท้าเธอ มาแข่งแก้โจทย์กัน! กล้าไหมล่ะ หรือจะกลับไปนอนกลางวันดี'],
                ['smug', 'talk-3', 'ลอดประตูที่คำตอบถูก รถจะพุ่ง ถ้าชนะฉันได้ มีของดีให้แน่ แต่บอกไว้ก่อน ยังไม่มีใครชนะฉันเลย... ตั้งแต่เมื่อวาน']],
      en: s => [['stop', 'talk-1', 'Hey, hold up! I am Zoomy Fox, the fastest on this island. Second place is the wind.'],
                ['point', 'talk-2', 'Today I challenge you to a question race! Do you dare, or is it nap time?'],
                ['smug', 'talk-3', 'Drive through the gate with the right answer and your kart zooms. Beat me and there is a treat. Nobody has beaten me yet... since yesterday.']]
    },
    words: { th: { talk: 'คุยกับ', pick: 'เลือกโจทย์ที่จะแข่ง', subject: 'หมวด', level: 'ระดับ', next: 'ต่อไป', go: 'รับคำท้า!', later: 'ไว้ก่อน', close: 'ปิด', closer: 'เดินเข้าไปใกล้จิ้งจอกซิ่งอีกนิดนะ', won: 'ชนะจิ้งจอกซิ่งแล้ว เก่งมาก!', lost: 'เกือบแล้ว ลองท้าใหม่ได้เสมอ', right: 'ตอบถูก {a}/{b} ข้อ' },
             en: { talk: 'Talk to', pick: 'Pick what to race on', subject: 'Subject', level: 'Level', next: 'Next', go: 'Challenge accepted!', later: 'Not now', close: 'Close', closer: 'Walk a little closer to Zoomy Fox', won: 'You beat Zoomy Fox. Great job!', lost: 'So close. Challenge him again any time', right: '{a}/{b} correct' } }
  }
};

// Zoomy Fox's kart, the same build as his race kart in familycraft-home/race.html makeKart('crate') (owner 2026-11-27: "the fox's kart
// should look like the one in the race game"): plank floor, slatted crate sides, red felt nose with yellow lamps, teal seat, a slat
// tail board over a red-and-yellow striped bumper, two exhaust pipes, small front wheels and big back wheels with yellow hubs.
// It is built as three assemblies (frame, wheels, rear) so the quest can show them as a ghost and fit them one by one.
const canvasTex = (draw, rx = 1, ry = 1) => { const c = document.createElement('canvas'); c.width = c.height = 16; draw(c.getContext('2d')); const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter; t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); return t; };
const plankTex = (rx, ry) => canvasTex(g => { g.fillStyle = '#D9A066'; g.fillRect(0, 0, 16, 16); g.fillStyle = '#E4B27A'; g.fillRect(2, 1, 5, 2); g.fillRect(9, 9, 4, 2); g.fillStyle = '#9A6436'; [3, 7, 11, 15].forEach(y => g.fillRect(0, y, 16, 1)); [[5, 0], [12, 4], [3, 8], [10, 12]].forEach(([x, y]) => g.fillRect(x, y, 1, 3)); }, rx, ry);
export function crateKart(){
  const g = new THREE.Group(), parts = { frame: new THREE.Group(), wheels: new THREE.Group(), rear: new THREE.Group() }; let cur = parts.frame; g.add(parts.frame, parts.wheels, parts.rear); g.userData.parts = parts;
  const tm = map => new THREE.MeshStandardMaterial({ map, roughness: .85 }), felt = c => clay(c, { roughness: .95 });
  const floor = tm(plankTex(1, 1.5)), slat = tm(plankTex(1.4, .6)), dk = clay('#4a3020'), wood = clay('#A5622B'), yel = felt('#F2B705'), red = felt('#D8343A'), teal = felt('#178F8A'), steel = clay('#8E99A4', { roughness: .45, metalness: .3 }), rim = clay('#5E6872');
  const stripe = tm(canvasTex(c => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++){ c.fillStyle = ((x + y) >> 2) % 2 ? '#E5484D' : '#FFC94D'; c.fillRect(x, y, 1, 1); } }, 3, 1));
  const box = (w, h, d, m, x, y, z) => { const e = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); e.position.set(x, y, z); e.castShadow = e.receiveShadow = true; cur.add(e); return e; };
  const cyl = (r, h, m, x, y, z, ax) => { const e = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 14), m); if (ax === 'z') e.rotation.x = Math.PI / 2; e.position.set(x, y, z); e.castShadow = true; cur.add(e); return e; };
  box(1.5, .3, 2.7, floor, 0, .5, 0);                                                        // plank floor
  box(.2, .62, 2.2, slat, -.76, .94, .1); box(.2, .62, 2.2, slat, .76, .94, .1);             // slatted crate sides
  box(1.1, .4, .8, red, 0, .6, -1.45); box(.8, .24, .3, felt('#B93A3F'), 0, .56, -1.95); box(1.6, .2, .2, wood, 0, .44, -1.82);   // felt nose and wooden bumper
  [-.3, .3].forEach(x => {                                                                   // headlamps: two round toy lamps sitting on the hood, looking forward
    cyl(.135, .16, dk, x, .93, -1.56, 'z');                                                   // housing
    const rimg = new THREE.Mesh(new THREE.TorusGeometry(.12, .03, 8, 20), clay('#F2B705')); rimg.position.set(x, .93, -1.645); cur.add(rimg);   // yellow rim
    const lens = new THREE.Mesh(new THREE.SphereGeometry(.1, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#FFF6C8', emissive: '#FFE58A', emissiveIntensity: .55, roughness: .25 }));
    lens.rotation.x = -Math.PI / 2; lens.scale.y = .45; lens.position.set(x, .93, -1.64); cur.add(lens);
    const glint = new THREE.Mesh(new THREE.SphereGeometry(.025, 8, 6), new THREE.MeshBasicMaterial({ color: '#FFFFFF' })); glint.position.set(x - .035, .965, -1.685); cur.add(glint); });
  box(.9, .2, .8, teal, 0, .74, .3); box(1, .56, .16, slat, 0, 1.1, .8);                     // seat and back rest
  box(1.34, .36, .2, slat, 0, 1.06, -.86); box(1.4, .08, .26, dk, 0, 1.26, -.86);          // dashboard across the front, so the wheel has something to stand on
  const ink = clay('#2E2118'), top = new THREE.Vector3(0, 1.42, -.36), foot = new THREE.Vector3(0, 1.1, -.78), v = top.clone().sub(foot);
  const col = new THREE.Mesh(new THREE.CylinderGeometry(.055, .065, v.length(), 10), dk); col.position.copy(foot).addScaledVector(v, .5); col.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), v.normalize()); col.castShadow = true; cur.add(col);
  const sw = new THREE.Group(), ring = new THREE.Mesh(new THREE.TorusGeometry(.25, .055, 8, 18), ink), hubm = new THREE.Mesh(new THREE.CylinderGeometry(.07, .07, .06, 12), ink), spoke = new THREE.Mesh(new THREE.BoxGeometry(.46, .06, .05), ink);
  hubm.rotation.x = Math.PI / 2; sw.add(ring, hubm, spoke); sw.position.copy(top); sw.rotation.x = -.62; cur.add(sw);   // wheel sits square on the end of its column
  cur = parts.wheels;
  const tread = tm(canvasTex(c => { c.fillStyle = '#2e2a28'; c.fillRect(0, 0, 16, 16); c.fillStyle = '#1d1a19'; for (let x = 0; x < 16; x += 4) c.fillRect(x, 0, 2, 16); }, 4, 1));
  const hub = tm(canvasTex(c => { c.fillStyle = '#4a3020'; c.fillRect(0, 0, 16, 16); c.fillStyle = '#3a2416'; c.beginPath(); c.arc(8, 8, 7, 0, 7); c.fill(); c.fillStyle = '#F5C21B'; c.beginPath(); c.arc(8, 8, 4, 0, 7); c.fill(); c.fillStyle = '#D99A0B'; c.fillRect(7, 7, 2, 2); }));
  [[-1.03, -1.02, .42, .38], [1.03, -1.02, .42, .38], [-1.13, .98, .56, .5], [1.13, .98, .56, .5]].forEach(([x, z, r, w]) => { const geo = new THREE.CylinderGeometry(r, r, w, 20); geo.rotateZ(Math.PI / 2);
    const m = new THREE.Mesh(geo, [tread, hub, hub]); m.position.set(x, r, z); m.castShadow = true; cur.add(m); });
  cur = parts.rear;
  box(1.72, .62, .2, slat, 0, .94, 1.24); box(1.72, .14, .16, dk, 0, 1.3, 1.22);             // tail board and its rail
  box(1.9, .46, .16, stripe, 0, .62, 1.42);                                                  // striped bumper
  cyl(.15, .1, yel, -.7, .62, 1.52, 'z'); cyl(.15, .1, yel, .7, .62, 1.52, 'z');             // tail lamps
  [-.34, .34].forEach(x => { cyl(.13, .5, steel, x, .36, 1.52, 'z'); cyl(.16, .1, rim, x, .36, 1.76, 'z'); });   // exhaust pipes
  g.scale.setScalar(.6); return g;
}
const PROPS = { kart: crateKart };
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };

export class Npcs {
  constructor(game){
    this.g = game; this.list = []; this.talking = null; this.near = null; this.audio = null; this.result = null;
    this.btn = { hidden: true };   // the on-screen Talk button is gone (owner, 2026-11-26): tap the islander or the bubble over their head
    // a tap or click on an islander's body talks to them; it is checked before the world gets the press
    game.canvas.addEventListener('pointerdown', e => { const n = this.hit(e.clientX, e.clientY); if (!n || this.talking) return; e.stopImmediatePropagation(); e.preventDefault(); this.tryTalk(n); }, true);
    addEventListener('keydown', e => { if (e.code === 'KeyE' && this.near && !this.talking && !(e.target.closest && e.target.closest('input,textarea'))) this.talk(this.near); if (e.code === 'Escape' && this.talking && !this.frameEl) this.end(); });
    addEventListener('message', e => { if (e.origin !== location.origin || !e.data) return; if (e.data.type === 'fc-race-result') this.result = e.data; if (e.data.type === 'fc-game-back') this.closeGame(); });
  }
  // x, z are cells; face is the yaw the host looks along when nobody is near; the prop stands to the host's left
  async add(id, x, z, { face = 0, prop = null, propFace } = {}){
    const def = NPCS[id], W = this.g.world; if (!def) return null;
    const m = await loadCharacter(def); if (!m) return null;
    const p = new THREE.Vector3(W.wx(x), Math.max(W.top(x, z), 1), W.wx(z)); m.position.copy(p); m.rotation.y = face; this.g.scene.add(m);
    const n = { def, m, p, home: face, face, anim: new Animator(this.g.scene), tag: el('button', 'npc-tag'), t: 0 }; n.tag.onclick = () => this.talking || this.tryTalk(n);
if (PROPS[def.prop]){ const k = PROPS[def.prop](), c = prop || [x + 2, z]; k.position.set(W.wx(c[0]), Math.max(W.top(c[0], c[1]), 1), W.wx(c[1])); k.rotation.y = (propFace ?? face) + Math.PI; this.g.scene.add(k); n.prop = k; }   // the kart's nose is its -z end
    document.body.appendChild(n.tag); this.list.push(n); return n;
  }
  // screen rectangle of an islander (feet to a little above the head), for taps
  hit(sx, sy){ const v = new THREE.Vector3(), cam = this.g.camera; for (const n of this.list){ v.set(n.p.x, n.p.y, n.p.z).project(cam); if (v.z > 1) continue; const fx = (v.x * .5 + .5) * innerWidth, fy = (-v.y * .5 + .5) * innerHeight;
      v.set(n.p.x, n.p.y + n.def.size * 1.05, n.p.z).project(cam); const ty = (-v.y * .5 + .5) * innerHeight, h = fy - ty, w = h * .42; if (sx > fx - w && sx < fx + w && sy > ty - h * .1 && sy < fy + h * .05) return n; } return null; }
  tryTalk(n){ const P = this.g.player.body, d = Math.hypot(P.x - n.p.x, P.z - n.p.z); if (d < TUNING.npc.talkRange + 1.2) this.talk(n); else { this.g.sound.play('pop'); this.g.hud.say(this.w(n, 'closer'), 2500); } }
  w(n, k, v){ let s = n.def.words[i18n.lang][k] || k; for (const a in v || {}) s = s.replace('{' + a + '}', v[a]); return s; }
  update(dt, t){
    const P = this.g.player.body, v = new THREE.Vector3(); let near = null;
    for (const n of this.list){
      const dx = P.x - n.p.x, dz = P.z - n.p.z, d = Math.hypot(dx, dz), close = d < TUNING.npc.talkRange && Math.abs(P.y - n.p.y) < 2;
      const want = d < TUNING.npc.noticeRange ? Math.atan2(dx, dz) : n.home; let df = want - n.face; df = Math.atan2(Math.sin(df), Math.cos(df)); n.face += df * Math.min(1, dt * 6); n.m.rotation.y = n.face;
      if (d < .62 && d > 1e-4){ P.x = n.p.x + dx / d * .62; P.z = n.p.z + dz / d * .62; }
      if (n.prop){ const kx = P.x - n.prop.position.x, kz = P.z - n.prop.position.z, kd = Math.hypot(kx, kz), R = n.def.propR || .8; if (kd < R && kd > 1e-4){ P.x = n.prop.position.x + kx / kd * R; P.z = n.prop.position.z + kz / kd * R; } }
      n.t += dt; const wave = d < TUNING.npc.noticeRange && !this.talking;
      n.anim.update(dt, { model: n.m, speed: 0, phase: 0, ground: true, vy: 0, action: wave ? { type: 'wave', t: n.t, dur: 99 } : null, hold: null, plainHands: true, face: n.face, t });
      if (close && (!near || d < near.d)) near = { n, d };
      v.set(n.p.x, n.p.y + n.def.size + .45, n.p.z).project(this.g.camera); const on = v.z < 1 && !this.talking && d < 14;
      n.tag.style.display = on ? '' : 'none'; if (on){ const key = n.def[i18n.lang] + (close ? 1 : 0); if (n.tagKey !== key){ n.tagKey = key; n.tag.innerHTML = '<i></i><span>' + n.def[i18n.lang] + '</span>'; n.tag.classList.toggle('near', close); } n.tag.style.transform = `translate(${(v.x * .5 + .5) * innerWidth}px,${(-v.y * .5 + .5) * innerHeight}px) translate(-50%,-100%)`; }
    }
    this.near = near && !this.talking ? near.n : null;
  }
  // called after the follow camera has moved: while talking, lift the camera to a side view that holds both faces
  frame(dt){
    const n = this.talking; if (!n) return; const g = this.g, P = g.player.body, cam = g.camera;
    const mid = new THREE.Vector3((P.x + n.p.x) / 2, (P.y + n.p.y) / 2 + 1.15, (P.z + n.p.z) / 2), dx = n.p.x - P.x, dz = n.p.z - P.z, d = Math.hypot(dx, dz) || 1;
    const side = new THREE.Vector3(-dz / d, 0, dx / d); if (!this.side){ const a = mid.clone().addScaledVector(side, 4), b = mid.clone().addScaledVector(side, -4), ha = g.world.lineHit(mid, a), hb = g.world.lineHit(mid, b);
      this.side = (ha === null) !== (hb === null) ? (ha === null ? 1 : -1) : a.distanceToSquared(this.cam0) < b.distanceToSquared(this.cam0) ? 1 : -1; }   // the side with a clear view, else the nearer one
    // the dialogue card covers the lower part of the screen, so aim below the pair: they sit in the upper half;
    // a tall phone screen needs the camera further back to hold both characters
    const low = innerHeight < 500 ? 1.15 : .75, tall = innerWidth < innerHeight ? 1.75 : 1, want = mid.clone().addScaledVector(side, this.side * (3 + d * .45) * tall); want.y += .9; const at = mid.clone(); at.y -= low;
    this.camP.lerp(want, Math.min(1, dt * 3.5)); this.camAt.lerp(at, Math.min(1, dt * 5));
    cam.position.copy(this.camP); cam.lookAt(this.camAt); g.player.face = Math.atan2(dx, dz);
  }
  // cards: [{ face, text, note?, ok?, later?, onOk?, onLater? }] from the islander's quest; without cards Talk runs the islander's own challenge
  say(n, cards){ if (!this.talking) this.talk(n, cards); }
  talk(n, cards){
    const g = this.g; if (this.talking) return; this.cards = cards || (n.quest && n.quest.script()) || null; this.ci = 0; this.talking = n; g.talking = true; this.btn.hidden = true; this.side = 0; this.step = 0;
    this.cam0 = g.camera.position.clone(); this.camP = g.camera.position.clone(); this.camAt = new THREE.Vector3(g.player.body.x, g.player.body.y + 1, g.player.body.z);
    this.pick = { s: 0, l: 0 }; document.body.classList.add('talking'); g.music && g.music.theme && g.music.theme(TALK_SONGS[n.def.id]);   // the islander's own song while you talk g.player.mineUp && g.player.mineUp(); g.sound.play('pop'); g.track('npc_talk', { npc: n.def.id });
    const d = this.dlg = el('div', 'npc-dlg', `<img class="bust" alt=""><div class="card"><b class="who"></b><p class="line"></p><small class="note"></small><div class="pick"></div><div class="row"><button class="later"></button><button class="next"></button></div></div>`);
    d.querySelector('.who').textContent = n.def[i18n.lang]; d.querySelector('.later').textContent = this.w(n, 'later'); d.querySelector('.later').onclick = () => { const c = this.cards && this.cards[this.ci]; this.end(); c && c.onLater && c.onLater(); };
    d.querySelector('.next').onclick = () => this.next(); document.body.appendChild(d); this.show();
  }
  lines(){ const n = this.talking; return n.def.lines[i18n.lang](n.def.subjects[this.pick.s]); }
  // steps: 0 hello, 1 pick subject + level, 2 the dare (names the subject), 3 the rules, then the game
  show(){
    if (this.cards) return this.showCard();
    const n = this.talking, d = this.dlg, L = this.lines(), picking = this.step === 1, line = picking ? null : L[[0, 0, 1, 2][this.step]];
    d.querySelector('.bust').src = n.def.bust + (line ? line[0] : 'dare') + (n.def.ext || '.png'); d.querySelector('.next').textContent = this.w(n, this.step === 3 ? 'go' : 'next'); d.classList.toggle('picking', picking);
    const p = d.querySelector('.line'), box = d.querySelector('.pick'); clearInterval(this.tw); this.tw = null; box.innerHTML = '';
    if (picking){ this.voice(null); p.style.minHeight = '0'; p.textContent = this.w(n, 'pick');
      const row = (label, list, key) => { const r = el('div', 'opts', `<small>${label}</small>`); list.forEach((o, i) => { const b = el('button', 'opt' + (this.pick[key] === i ? ' on' : '')); b.textContent = o[i18n.lang]; b.onclick = () => { this.pick[key] = i; this.g.sound.play('pop'); this.show(); }; r.appendChild(b); }); box.appendChild(r); };
      row(this.w(n, 'subject'), n.def.subjects, 's'); row(this.w(n, 'level'), n.def.levels, 'l'); return; }
    this.voice(line[1]); const txt = line[2]; let k = 0; this.fitLine(p, txt); this.full = txt;
    this.tw = setInterval(() => { k++; p.textContent = txt.slice(0, k); if (k >= txt.length){ clearInterval(this.tw); this.tw = null; } }, 28);
  }
  showCard(){
    const n = this.talking, d = this.dlg, c = this.cards[this.ci], last = this.ci === this.cards.length - 1, p = d.querySelector('.line');
    d.querySelector('.bust').src = n.def.bust + ({ grin: 'smug', wow: 'shock', clap: 'laugh' }[c.face] || c.face || 'smug') + (n.def.ext || '.png'); d.classList.remove('picking'); d.querySelector('.pick').innerHTML = ''; d.querySelector('.note').textContent = '';
    d.querySelector('.next').textContent = last ? (c.ok || this.w(n, 'close')) : this.w(n, 'next'); const lt = d.querySelector('.later'); lt.style.visibility = last && c.later ? '' : 'hidden'; if (c.later) lt.textContent = c.later;
    clearInterval(this.tw); const txt = this.full = c.text; let k = 0; this.fitLine(p, txt); this.note = c.note || '';
    this.tw = setInterval(() => { k++; p.textContent = txt.slice(0, k); if (k >= txt.length){ clearInterval(this.tw); this.tw = null; d.querySelector('.note').textContent = this.note; } }, 24);
  }
  // the panel is sized to the whole line before the typewriter starts: no empty band, and no jump while the words appear
  fitLine(p, txt){ p.style.minHeight = '0'; p.textContent = txt; p.style.minHeight = p.offsetHeight + 'px'; p.textContent = ''; }
  voice(clip){ if (this.audio){ this.audio.pause(); this.audio = null; } if (!clip || !this.g.sound.on) return; const a = this.audio = new Audio(this.talking.def.voice + clip + '.mp3'); a.volume = .95; a.play().catch(() => {}); }
  next(){
    if (this.tw){ clearInterval(this.tw); this.tw = null; this.dlg.querySelector('.line').textContent = this.full; if (this.cards) this.dlg.querySelector('.note').textContent = this.note; return; }   // first tap finishes the line
    if (this.cards){ this.g.sound.play('pop'); const c = this.cards[this.ci]; if (this.ci < this.cards.length - 1){ this.ci++; return this.showCard(); }
      const more = c.onOk && c.onOk(); if (more && more.length){ this.cards = more; this.ci = 0; return this.showCard(); } return this.end(); }
    this.g.sound.play('pop'); if (this.step < 3){ this.step++; this.show(); return; }
    const n = this.talking, s = n.def.subjects[this.pick.s]; this.g.track('npc_challenge', { npc: n.def.id, theme: s.id, level: this.pick.l }); if (n.def.id === 'sing') this.g.track('fox_race_started', { subject: s.id, difficulty: this.pick.l, party_size: 1 }); this.openGame(n, s.id, this.pick.l);
  }
  // the host's game opens in a frame over the island; it starts at its own 3-2-1 (auto=1) and tells us the result
  openGame(n, theme, lv){
    this.voice(null); this.dlg.remove(); this.dlg = null; this.result = null; this.g.music && this.g.music.stop();
    const back = new URL('back.html', location.href).href, f = this.frameEl = el('iframe', 'npc-game'); f.allow = 'autoplay; fullscreen';
    f.src = n.def.game + '?auto=1&theme=' + theme + '&lv=' + lv + '&back=' + encodeURIComponent(back); document.body.appendChild(f); f.focus();
  }
  closeGame(){
    if (!this.frameEl) return; this.frameEl.remove(); this.frameEl = null; const n = this.talking, r = this.result, g = this.g; this.end(); if (g.music && g.music.on && g.music.started) g.music.start();
    if (!r) return; const won = r.place === 1, more = n.quest && n.quest.result(r); if (more) setTimeout(() => this.say(n, more), 1200); g.track('npc_result', { npc: n.def.id, place: r.place, right: r.right, total: r.total, seconds: r.seconds, theme: r.theme, level: r.level });
    g.hud.say(this.w(n, won ? 'won' : 'lost') + ' · ' + this.w(n, 'right', { a: r.right, b: r.total }), 5000); g.sound.play(won ? 'star' : 'pop');
    if (won) g.particles.burst(new THREE.Vector3(n.p.x, n.p.y + 1.6, n.p.z), { color: '#ffc94d', shape: 'star', n: 16, speed: 3 });
  }
  end(){ this.voice(null); clearInterval(this.tw); if (this.dlg){ this.dlg.remove(); this.dlg = null; } this.talking = null; this.g.talking = false; document.body.classList.remove('talking'); this.g.music && this.g.music.theme && this.g.music.theme(null); this.g.cam.inited = false; }
}
