// Room: Escape quest. Two players on one device: the parent holds the "goggles" button to see the clue (a card, shown
// at most TUNING.quest.peekMs per hold), the child walks onto the floor plates in the right order. A wrong or repeated
// plate resets the sequence. When the sequence is right the door blocks open; walking through ends the level.
// Pure logic: quest/escape-logic.js. Host: Bolt the pangolin inventor (text only).
import * as THREE from 'three';
import { BLOCK } from '../world/voxel.js';
import { clay } from '../fx/materials.js';
import { TUNING } from '../data/tuning.js';
import { i18n } from '../core/i18n.js';
import { getBand } from './quest/common.js';
import { labelTexture } from './quest/label.js';
import { startQuest, saveQuest, setQuestBand } from './quest/use-shell.js';
import { makeCameraRule } from './quest/camera-rule.js';
import { solveFrame, frameFocus, watchHint } from './quest/frame.js';
import { makeBandChip } from './quest/band-chip.js';
import { registerKeepClear } from './quest/screen-boxes.js';
import { makePuzzle, startState, pressPlate, ESCAPE } from './quest/escape-logic.js';

const DX = 9, DZ = 5, FLOOR_Y = 2;                     // door: three wide in the back wall, centred on cell x DX, wall row DZ; standing height
const BOUNDS = { x0: 1, x1: 18, z0: 6, z1: 13 };       // cells the player may walk on
const ORBIT = 8;             // the follow camera's own distance; the rest of the framed distance is put in the focus point (quest/frame.js)
const HIT = .55, SPOT = { x: 9, z: 10.6 };            // a plate is pressed when the player is this close (world units); the spawn spot
const RING = { idle: '#7a5632', lit: '#ffd21f', bad: '#e0524a', hint: '#46d4e6' };

// the little symbol of a band-a plate / clue item, drawn on a canvas 2D context in the box (x, y, s)
function drawShape(g, shape, hex, cx, cy, r){
  g.fillStyle = hex; g.strokeStyle = '#3b2a1a'; g.lineWidth = Math.max(3, r * .12); g.lineJoin = 'round'; g.beginPath();
  if (shape === 'circle') g.arc(cx, cy, r, 0, Math.PI * 2);
  else if (shape === 'square') g.rect(cx - r * .88, cy - r * .88, r * 1.76, r * 1.76);
  else if (shape === 'triangle'){ g.moveTo(cx, cy - r); g.lineTo(cx + r * 1.05, cy + r * .78); g.lineTo(cx - r * 1.05, cy + r * .78); g.closePath(); }
  else for (let i = 0; i < 10; i++){ const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * .5 : r * 1.08; g[i ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); }
  if (shape === 'star') g.closePath();
  g.fill(); g.stroke();
}
function plateTexture(p){
  if (!p.shape) return labelTexture(p.label, { bg: '#fff8e6', fg: '#3b2a1a', size: 256 });
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
  g.fillStyle = '#fff8e6'; g.fillRect(0, 0, 256, 256); drawShape(g, p.shape, p.hex, 128, 130, 84);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
const svgShape = (s, hex, px) => { const c = document.createElement('canvas'); c.width = c.height = 128; drawShape(c.getContext('2d'), s, hex, 64, 66, 46); return `<img alt="" width="${px}" height="${px}" src="${c.toDataURL()}">`; };
const clockSvg = ({ h, m }) => { const a = (v, len, w) => `<line x1="60" y1="60" x2="${(60 + Math.sin(v) * len).toFixed(1)}" y2="${(60 - Math.cos(v) * len).toFixed(1)}" stroke="#3b2a1a" stroke-width="${w}" stroke-linecap="round"/>`;
  let ticks = ''; for (let i = 0; i < 12; i++){ const t = i * Math.PI / 6; ticks += `<line x1="${(60 + Math.sin(t) * 47).toFixed(1)}" y1="${(60 - Math.cos(t) * 47).toFixed(1)}" x2="${(60 + Math.sin(t) * 53).toFixed(1)}" y2="${(60 - Math.cos(t) * 53).toFixed(1)}" stroke="#7a5632" stroke-width="${i % 3 ? 3 : 5}" stroke-linecap="round"/>`; }
  return `<svg viewBox="0 0 120 120" width="150" height="150"><circle cx="60" cy="60" r="57" fill="#fff8e6" stroke="#7a5632" stroke-width="5"/>${ticks}${a(((h % 12) + m / 60) * Math.PI / 6, 30, 7)}${a(m * Math.PI / 30, 44, 4.5)}<circle cx="60" cy="60" r="5" fill="#e0524a"/></svg>`; };
const GOGGLES = '<svg viewBox="0 0 48 34" width="40" height="28" aria-hidden="true"><path d="M2 14c6-3 8-3 11-3M46 14c-6-3-8-3-11-3" stroke="#4a2a0e" stroke-width="3.2" fill="none" stroke-linecap="round"/><rect x="9" y="6" width="14" height="19" rx="7" fill="#bfe9f2" stroke="#4a2a0e" stroke-width="3"/><rect x="25" y="6" width="14" height="19" rx="7" fill="#bfe9f2" stroke="#4a2a0e" stroke-width="3"/><path d="M12 12c1-2 3-3 5-3" stroke="#fff" stroke-width="2.4" fill="none" stroke-linecap="round"/><path d="M28 12c1-2 3-3 5-3" stroke="#fff" stroke-width="2.4" fill="none" stroke-linecap="round"/></svg>';
const CSS = `#esGoggles{position:fixed;z-index:7;left:calc(26px + env(safe-area-inset-left));bottom:calc(198px + env(safe-area-inset-bottom));width:76px;height:76px;border-radius:50%;border:4px solid #7a5632;
 background:radial-gradient(circle at 40% 32%,#f4cf8f,#c98a52);box-shadow:0 0 0 3px #fff1b8,0 6px 0 #5a3414,0 10px 16px rgba(60,40,20,.35);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;
 padding:0;cursor:pointer;touch-action:none;user-select:none;-webkit-user-select:none;font:700 15px Prompt,"Noto Sans Thai",sans-serif;color:#4a2a0e}
#esGoggles.down{transform:translateY(4px);box-shadow:0 0 0 3px #ffd21f,0 2px 0 #5a3414,0 4px 10px rgba(60,40,20,.35)}
#esClue{position:fixed;z-index:7;left:50%;top:32%;transform:translate(-50%,-50%);display:none;max-width:min(88vw,440px);padding:16px 22px 14px;text-align:center;pointer-events:none;
 background:#fff3df;border:6px solid #7a5632;border-radius:26px 30px 28px 32px/30px 26px 32px 28px;box-shadow:0 0 0 3px #fff1b8,0 10px 24px rgba(60,40,20,.4);color:#3b2a1a;font:700 22px Baloo 2,Prompt,"Noto Sans Thai",sans-serif}
#esClue .row{display:flex;gap:14px;align-items:center;justify-content:center;flex-wrap:wrap}#esClue .big{font-size:46px;line-height:1.1;letter-spacing:2px}#esClue .eq{font-size:34px;line-height:1.3;white-space:nowrap}
#esClue .cap{font-size:16px;color:#7a5632;margin-top:6px}#esClue .arrow{font-size:30px;color:#7a5632}
@media (max-height:480px){#esGoggles{bottom:calc(150px + env(safe-area-inset-bottom));left:calc(18px + env(safe-area-inset-left))}}
@media (max-width:520px){#esGoggles{left:calc(20px + env(safe-area-inset-left));bottom:calc(262px + env(safe-area-inset-bottom))}#esClue{top:36%}}`;

export default {
  id: 'escape', persist: false, size: 20, height: 12,
  words: {
    th: { es_intro: 'โบลต์ (ตัวนิ่มนักประดิษฐ์) ชวนหนีออกจากห้อง', es_goal: 'เหยียบถูก {n}/{m}', es_free_goal: 'เหยียบต่างกัน {n}/{m}', es_goggles: 'แว่น',
          es_exit: 'ออก', es_wrong: 'ผิดลำดับ เริ่มใหม่นะ', es_ok: 'ถูกแล้ว', es_open: 'ประตูเปิดแล้ว เดินออกไปเลย', es_done: 'หนีออกมาได้แล้ว เก่งมาก ได้ {n} ดาว', es_next: 'ไปด่านต่อไป', es_all: 'ครบทุกด่านแล้ว', es_cog: 'เจอเฟืองทองลับ', es_hold: 'กดแว่นค้างไว้เพื่อดูเบาะแส' },
    en: { es_intro: 'Bolt the pangolin inventor invites you to escape', es_goal: 'right plates {n}/{m}', es_free_goal: 'different plates {n}/{m}', es_goggles: 'Goggles',
          es_exit: 'EXIT', es_wrong: 'Wrong order, start again', es_ok: 'Right', es_open: 'The door is open. Walk through', es_done: 'Escaped! Great job. {n} stars', es_next: 'next level', es_all: 'All levels done', es_cog: 'Found the hidden golden cog', es_hold: 'Hold the goggles to see the clue' }
  },
  rules: { build: true, damage: false },
  start: { planks: 4 },
  spawn: [-.5, 2.3],       // cell (9, 11.8) (world = cell - 9.5): the camera follows the player, so the plates and the door sit around this spot
  build(game){
    this.game = game; const W = game.world; let stored = null; try { stored = localStorage.getItem('fc-band'); } catch (e) {}
    this.band = getBand(location.search, stored);
    for (let x = 0; x < W.N; x++) for (let z = BOUNDS.z0; z <= BOUNDS.z1; z++){ W.set(x, 0, z, BLOCK.bedrock); W.set(x, 1, z, BLOCK.stone); }
    for (let x = DX - 1; x <= DX + 1; x++) for (let z = 2; z < DZ; z++){ W.set(x, 0, z, BLOCK.bedrock); W.set(x, 1, z, BLOCK.stone); }       // the exit room behind the door
    for (let z = 1; z < DZ; z++) for (let y = FLOOR_Y; y < FLOOR_Y + 4; y++){ if (z > 1){ W.set(DX - 2, y, z, BLOCK.brick); W.set(DX + 2, y, z, BLOCK.brick); } else for (let x = DX - 2; x <= DX + 2; x++) W.set(x, y, z, BLOCK.brick); }
    for (let x = 0; x < W.N; x++) for (let y = FLOOR_Y; y < FLOOR_Y + 4; y++) W.set(x, y, DZ, BLOCK.brick);                 // back wall
    this.grp = new THREE.Group(); game.scene.add(this.grp); this.timers = []; this.plates = []; this.doorCells = [];
    const st = document.createElement('style'); st.id = 'esStyle'; st.textContent = CSS; document.head.appendChild(st); this.styleEl = st;
    this.cog = this.makeCog(); game.scene.add(this.cog);
    this.state = { index: -1, done: false, stars: 0, pos: 0, open: false, result: null };
    this.quest = startQuest(game, { gameId: 'escape', band: this.band, levels: (band, i) => { const puzzle = makePuzzle(band, i, { free: TUNING.quest.escapeFree }); return { kind: i === 3 ? 'free' : 'goal', target: 1, extra: 'clean', puzzle }; } });
    addEventListener('resize', this.onResize = () => { clearTimeout(this.reframeT); this.reframeT = setTimeout(() => this.frameView(), 250); });      // the screen changed shape: frame the room again
    watchHint(() => this.frameView());      // the goal banner changed size: frame again
    addEventListener('pagehide', this.pageHide = () => this.removeGoggles());
    registerKeepClear(game, () => [this.exitSign, ...this.plates.map(p => p.grp)]);      // the room buttons keep off the exit sign and the plates
    this.camRule = makeCameraRule(game, { band: this.band, base: () => this.baseView, focus: (t, c) => frameFocus(this.frame, t, c) });
    this.chip = makeBandChip(game, { band: this.band, onPick: b => this.switchBand(b) });
    this.startLevel(0);
  },
  makeCog(){
    const g = new THREE.Group(), m = clay('#ffd21f', { emissive: '#ffb000', emissiveIntensity: .45 }); g.add(new THREE.Mesh(new THREE.CylinderGeometry(.22, .22, .08, 14), m));
    for (let i = 0; i < 8; i++){ const t = new THREE.Mesh(new THREE.BoxGeometry(.1, .08, .12), m), a = i * Math.PI / 4; t.position.set(Math.cos(a) * .27, 0, Math.sin(a) * .27); t.rotation.y = -a; g.add(t); }
    g.rotation.x = Math.PI / 2 - .5; g.position.set(this.game.world.wx(1), FLOOR_Y + .55, this.game.world.wx(BOUNDS.z0)); return g;
  },
  // the band chip: same room, new band, level 1, nothing left of the old level
  switchBand(b){ this.band = b; setQuestBand(this.quest, b); this.camRule.setBand(b); this.chip.setBand(b);  this.startLevel(0); },
  // ---- level lifecycle ----
  startLevel(i){
    const game = this.game, q = this.quest, W = game.world;
    this.timers.forEach(clearTimeout); this.timers = []; this.grp.clear(); this.plates = []; this.pulse = []; this.onPlate = null; this.peeked = false; this.hidePeek();
    this.hit = TUNING.quest.escapeHit > 0 ? TUNING.quest.escapeHit : HIT; q.start(i); this.pz = q.def.puzzle; this.pst = startState(this.pz); this.free = this.pst.free; this.secret = false; this.cog.visible = true;
    this.state = { index: i, done: false, stars: 0, pos: 0, open: false, result: null };
    this.buildWall(); this.drawPlates(); this.drawDoorMarker(); this.refreshGoal(); this.setupGoggles();
    game.player.spawn(W.wx(SPOT.x), W.wx(SPOT.z)); this.baseView = { yaw: Math.PI, pitch: .85, dist: ORBIT }; this.frameView(); this.camRule.reset(); game.cam.cur = this.baseView.dist; game.cam.inited = false; this.timers.push(setTimeout(() => this.frameView(), 600));      // the HUD has settled by now (fresh load): frame once more
    const goal = this.goalStr = this.pz.goalText[i18n.lang];
    if (i === 0){ game.hud.say(game.t('es_intro'), 4500); this.timers.push(setTimeout(() => game.hud.say(goal), 4600)); } else game.hud.say(goal);
    if (this.band === 'a') this.speak(goal);
  },
  // ---- framing: every plate, the exit door and the player inside the screen area the HUD leaves free (quest/frame.js) ----
  frameItems(){
    const W = this.game.world, V = THREE.Vector3, out = this.plates.map(p => ({ p: new V(p.x, FLOOR_Y + .1, p.z), w: 1.5, h: .3 })), dz = W.wx(DZ) + .5, dx = W.wx(DX);
    out.push({ p: new V(dx, FLOOR_Y + 1.6, dz), w: 3.4, h: 3.2 }, { p: new V(W.wx(SPOT.x), FLOOR_Y + .95, W.wx(SPOT.z)), w: 2.7, h: 3.7 });      // the door (three wide, two high, sign and beacon) and the player's spawn spot
    return out;
  },
  frameView(){
    if (!this.baseView || !this.plates.length) return;
    const items = this.frameItems(), C = new THREE.Vector3(); for (const it of items) C.add(it.p); C.divideScalar(items.length);
    this.frame = solveFrame(this.game.camera, items, this.baseView, C); this.baseView.dist = Math.min(ORBIT, this.frame.D);
  },
  speak(text){
    try { if (typeof speechSynthesis === 'undefined' || typeof SpeechSynthesisUtterance === 'undefined') return;
      speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(text); u.lang = i18n.lang === 'th' ? 'th-TH' : 'en-US'; speechSynthesis.speak(u); } catch (e) {}
  },
  // ---- the door: three plank blocks wide and two high in the back wall, a brick lintel above ----
  buildWall(){
    const W = this.game.world; this.doorCells = [];
    for (let x = DX - 1; x <= DX + 1; x++) for (let y = FLOOR_Y; y < FLOOR_Y + 2; y++){ W.set(x, y, DZ, BLOCK.planks); this.doorCells.push([x, y, DZ]); }
  },
  openDoor(){
    const W = this.game.world; for (const c of this.doorCells) W.set(c[0], c[1], c[2], 0);
    this.state.open = true; this.beacon.visible = true; this.exitSign.visible = false; this.lamp.material.color.set('#7be07b');
    const p = new THREE.Vector3(W.wx(DX), FLOOR_Y + 1.2, W.wx(DZ) + .5); this.game.particles.burst(p, { color: '#ffc94d', shape: 'star', n: 18, speed: 3.5 }); this.game.sound.play('star');
  },
  // ---- drawing ----
  drawDoorMarker(){
    const W = this.game.world, x = W.wx(DX), z = W.wx(DZ), cone = this.beacon = new THREE.Mesh(new THREE.ConeGeometry(.28, .6, 10), new THREE.MeshBasicMaterial({ color: '#7be07b' }));
    cone.rotation.x = Math.PI; cone.position.set(x, FLOOR_Y + 2.7, z + .6); cone.visible = false; this.grp.add(cone);
    const lamp = this.lamp = new THREE.Mesh(new THREE.SphereGeometry(.2, 14, 10), new THREE.MeshBasicMaterial({ color: '#e0524a' })); lamp.position.set(x - 2.1, FLOOR_Y + 1.4, z + .6); this.grp.add(lamp);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1.3), new THREE.MeshBasicMaterial({ map: labelTexture(this.game.t('es_exit'), { bg: '#3b2a1a', fg: '#fff8e6', size: 256 }) })); sign.position.set(x, FLOOR_Y + 1.0, z + .53); this.grp.add(sign); this.exitSign = sign;   // painted on the door itself (hidden once it opens)
    const mat = new THREE.MeshBasicMaterial({ color: '#7be07b', transparent: true, opacity: .3, depthWrite: false });      // the exit tile beyond the door
    for (let xx = DX - 1; xx <= DX + 1; xx++) for (let zz = 2; zz < DZ; zz++){ const m = new THREE.Mesh(new THREE.PlaneGeometry(.9, .9), mat); m.rotation.x = -Math.PI / 2; m.position.set(W.wx(xx), FLOOR_Y + .03, W.wx(zz)); this.grp.add(m); }
  },
  drawPlates(){
    const W = this.game.world, ps = this.pz.plates, n = ps.length, cols = n <= 3 ? n : Math.ceil(n / 2), rows = Math.ceil(n / cols);
    ps.forEach((p, k) => {
      const c = k % cols, r = Math.floor(k / cols), x = W.wx(DX + (c - (cols - 1) / 2) * 2.7), z = W.wx(rows === 1 ? 8.3 : 7.1 + r * 2.4);
      const grp = new THREE.Group(); grp.position.set(x, FLOOR_Y + .04, z);
      const base = new THREE.Mesh(new THREE.CylinderGeometry(.98, 1.02, .1, 28), clay('#c98a52')); base.position.y = .0; grp.add(base);
      const ringMat = new THREE.MeshBasicMaterial({ color: RING.idle }), ring = new THREE.Mesh(new THREE.RingGeometry(.9, 1.08, 32), ringMat); ring.rotation.x = -Math.PI / 2; ring.position.y = .07; grp.add(ring);
      const face = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1.3), new THREE.MeshBasicMaterial({ map: plateTexture(p) })); face.rotation.x = -Math.PI / 2; face.position.y = .075; grp.add(face);
      this.grp.add(grp); this.plates.push({ p, x, z, grp, ringMat, lit: false, k });
    });
  },
  setRing(pl, kind){ pl.ringMat.color.set(RING[kind]); pl.lit = kind === 'lit'; },
  // ---- the goggles (parent) ----
  setupGoggles(){
    if (this.pz.clue.kind === 'free'){ this.removeGoggles(); return; }
    if (!this.btn){
      const b = this.btn = document.createElement('button'); b.id = 'esGoggles'; b.type = 'button'; b.setAttribute('aria-label', this.game.t('es_goggles'));
      b.innerHTML = GOGGLES + `<span>${this.game.t('es_goggles')}</span>`; document.body.appendChild(b);
      const card = this.card = document.createElement('div'); card.id = 'esClue'; card.setAttribute('role', 'status'); document.body.appendChild(card);
      const down = e => { e.preventDefault(); try { b.setPointerCapture(e.pointerId); } catch (x) {} this.showPeek(); };
      const up = () => this.hidePeek();
      b.addEventListener('pointerdown', down); ['pointerup', 'pointercancel', 'lostpointercapture', 'pointerleave'].forEach(t => b.addEventListener(t, up));
      b.addEventListener('contextmenu', e => e.preventDefault());
    }
    this.hidePeek();
  },
  removeGoggles(){
    this.hidePeek(); if (this.btn){ this.btn.remove(); this.btn = null; } if (this.card){ this.card.remove(); this.card = null; }
  },
  clueHtml(){
    const c = this.pz.clue, d = c.data;
    if (c.kind === 'sequence') return '<div class="row">' + d.items.map((it, i) => (i ? '<span class="arrow">&rarr;</span>' : '') + svgShape(it.shape, it.hex, 76)).join('') + '</div>';
    if (c.kind === 'clock') return `<div class="row">${clockSvg(d)}</div>`;
    if (c.kind === 'roman') return '<div class="row big">' + d.numerals.map((n, i) => (i ? '<span class="arrow">&rarr;</span>' : '') + `<span>${n}</span>`).join('') + '</div>';
    if (c.kind === 'equation') return d.eqs.map(e => `<div class="eq">${e.text}</div>`).join('');
    return '';
  },
  showPeek(){
    if (!this.card || this.state.done) return; clearTimeout(this.peekT); this.card.innerHTML = this.clueHtml(); this.card.style.display = 'block'; this.btn.classList.add('down'); this.peekShown = true;
    if (!this.peeked){ this.peeked = true; this.quest.skill('teamwork', 'goggles'); }
    this.peekT = setTimeout(() => this.hidePeek(), TUNING.quest.peekMs);          // at most peekMs per hold; release and press again to look again
  },
  hidePeek(){ clearTimeout(this.peekT); this.peekShown = false; if (this.card) this.card.style.display = 'none'; if (this.btn) this.btn.classList.remove('down'); },
  // ---- play ----
  press(pl){
    const game = this.game, r = pressPlate(this.pst, pl.p.id); this.pst = r.state; this.state.pos = this.pst.pos;
    if (r.result === 'wrong'){
      this.plates.forEach(x => this.setRing(x, 'idle')); this.setRing(pl, 'bad'); this.badUntil = game.roomTime + .7; this.badPlate = pl; game.sound.play('no');
      this.onWrong(this.quest.wrong({ plate: pl.p.id }).hint); this.refreshGoal(); return;
    }
    this.setRing(pl, 'lit'); this.pulse = []; game.sound.play('pickup');
    game.particles.burst(new THREE.Vector3(pl.x, FLOOR_Y + .3, pl.z), { color: '#fff6c8', shape: 'star', n: 6, speed: 1.5, up: 2 });
    this.refreshGoal();
    if (r.result === 'done'){ this.quest.right({ plate: pl.p.id, pos: this.pst.pos }); this.openDoor();      // the shell is told once, when the sequence is complete (its value never resets, the room's pos does)
      game.hud.say(game.t('es_open'), 4000); }
    else game.hud.say(game.t('es_ok'), 1200);
  },
  onWrong(hint){
    const game = this.game, until = game.roomTime + TUNING.quest.peekMs * (hint === 'show' ? 2 : 1) / 1000, next = this.plates.find(x => x.p.id === this.pst.answer[this.pst.pos]);
    if (hint === 'replay'){ game.hud.say(game.t('es_wrong') + ' · ' + this.pz.hint[i18n.lang], 5000); if (this.band === 'a') this.speak(this.pz.hint[i18n.lang]); return; }
    game.hud.say(game.t('es_wrong'), 3000);
    const decoy = this.plates.find(x => x !== next && x !== this.badPlate) || this.badPlate;
    this.pulse = (hint === 'highlight2' ? [next, decoy] : [next]).filter(Boolean).map(pl => ({ pl, until }));
  },
  refreshGoal(){ const m = this.free ? this.pst.need : this.pst.answer.length; this.game.hud.goal(this.game.t(this.free ? 'es_free_goal' : 'es_goal', { n: this.pst.pos, m })); },
  finish(){
    const game = this.game, q = this.quest; this.state.done = true; this.hidePeek();
    const res = q.complete({ extraMet: q.level ? q.level.tries === 0 : false, secretFound: this.secret }); this.state.result = res; this.state.stars = res.stars;
    saveQuest('escape', q); game.sound.play('star');
    game.particles.burst(new THREE.Vector3(game.world.wx(DX), FLOOR_Y + 1.5, game.world.wx(3)), { color: '#ffc94d', shape: 'star', n: 24, speed: 4 });
    game.hud.say(game.t('es_done', { n: res.stars }) + (res.next != null ? ' · ' + game.t('es_next') : ' · ' + game.t('es_all')), 4000);
    if (res.next != null) this.timers.push(setTimeout(() => this.startLevel(res.next), 4200)); else this.removeGoggles();
  },
  update(game, dt, t){
    this.camRule.update(dt);
    if (!this.pz) return; const P = game.player.body, W = game.world;
    P.x = Math.max(W.wx(BOUNDS.x0), Math.min(W.wx(BOUNDS.x1), P.x)); P.z = Math.max(W.wx(this.state.open ? 2 : BOUNDS.z0), Math.min(W.wx(BOUNDS.z1), P.z));      // stay on the floor
    if (!this.state.done){
      let on = null;
      if (!this.state.open) for (const pl of this.plates) if (Math.abs(P.x - pl.x) < this.hit && Math.abs(P.z - pl.z) < this.hit && Math.abs(P.y - (FLOOR_Y + .04)) < 1.2){ on = pl; break; }
      if (on !== this.onPlate){ this.onPlate = on; if (on) this.press(on); }
      if (this.state.open && P.z < W.wx(DZ) - .6) this.finish();
    }
    for (const pl of this.plates){ pl.grp.position.y = FLOOR_Y + .04 - (pl === this.onPlate ? .05 : 0); if (pl === this.badPlate && pl.ringMat && game.roomTime > this.badUntil && !pl.lit && this.pst.pos === 0) this.setRing(pl, 'idle'); }
    for (const h of this.pulse){ if (game.roomTime < h.until){ if (!h.pl.lit) h.pl.ringMat.color.set(Math.sin(t * 10) > 0 ? RING.hint : '#ffffff'); } else if (!h.pl.lit) this.setRing(h.pl, h.pl === this.badPlate && game.roomTime < this.badUntil ? 'bad' : 'idle'); }
    if (this.beacon) this.beacon.position.y = FLOOR_Y + 2.7 + Math.sin(t * 5) * .12;
    if (this.cog.visible){ this.cog.rotation.z = t * 1.6; if (Math.hypot(P.x - this.cog.position.x, P.z - this.cog.position.z) < 1.1){ this.cog.visible = false; this.secret = true; game.hud.say(game.t('es_cog'), 2500); game.sound.play('pickup'); this.quest.skill('exploring', 'hidden cog'); } }
  },
  save(){ return {} }
};
