// Room: Dig quest. Dig through rock layers with the shovel and pickaxe, find buried things (room-owned label meshes,
// picked up by walking to them) and answer by placing each find on a shelf / letter slot (block_place on shelf cells).
// Pure logic: quest/dig-logic.js. Host: Tunny the mole archaeologist (text only).
import * as THREE from 'three';
import { BLOCK } from '../world/voxel.js';
import { TUNING } from '../data/tuning.js';
import { i18n } from '../core/i18n.js';
import { BANKS } from './quest/banks.js';
import { getBand } from './quest/common.js';
import { labelTexture } from './quest/label.js';
import { startQuest, saveQuest, setQuestBand } from './quest/use-shell.js';
import { makeCameraRule } from './quest/camera-rule.js';
import { makeBandChip } from './quest/band-chip.js';
import { solveFrame, frameFocus, watchHint } from './quest/frame.js';
import { speakMixed } from './quest/speech.js';
import { registerKeepClear } from './quest/screen-boxes.js';
import { makeDigSite, eraForDepth, DIG } from './quest/dig-logic.js';

const ERA = Object.fromEntries(BANKS.eras.map(e => [e.id, e]));
const PLINTH = 'planks';                    // the block the child places on a shelf cell (the room gives some)
const SPAWN_STAIR = { a: 4, b: 1, c: 3 };   // stair of 0..4 (the rock face starts at 5): band a on its flat landing (depth 2) next to the face; band b three steps up, left of
                                            // its era signs (they float in front of stair 4, so a player on stair 3 would stand behind them); band c one step above the dig floor
// base camera view per band. The camera does not orbit the player: it frames the cut (rock face, finds, era / shelf signs, letter slots and
// the player on the stairs) inside the screen area the HUD leaves free (frameView), and only slides when the player walks out of that area.
const VIEW = { a: { pitch: .4 }, bc: { pitch: .5 } }, ORBIT = 8;      // ORBIT: the follow camera's own distance; the rest of the framed distance is in the focus point
const viewFor = band => ({ yaw: Math.PI, pitch: VIEW[band === 'a' ? 'a' : 'bc'].pitch, dist: ORBIT });
// label scale of a find: NEAR when the player is close (letters stay under one cell wide, so neighbours never touch); names are already sized for a phone (FONT)
const NEAR = { letter: 1.1, wide: 1 }, FAR = { letter: 1, wide: 1 };
const SIGN_UP = .45, SIGN_STEP = .95;                        // shelf signs float this high over the surface, in front of the shelf: clear of the row-1 finds' labels below
// A label board sized to its text: the font is a fixed share of the board height, the board as wide as the text needs (full names, one line),
// so the text height in the world is always `font` units: FONT.find / FONT.sign keep it >= 16 css px on a 375-wide phone (frame solver ~40 px per block).
const FONT = { find: .63, sign: .63 }, CANVAS_H = 128, FONT_PX = 100, PAD_PX = 18;      // board height = font / .78 (+ its frame): two rows' labels, one block apart, never touch
function board(text, font, { bg = '#fff8e6', fg = '#3b2a1a', edge = '#7a5632' } = {}){
  const c = document.createElement('canvas'), g = c.getContext('2d'), f = `700 ${FONT_PX}px "Baloo 2", "Noto Sans Thai", "Nunito", system-ui, sans-serif`;
  g.font = f; const cw = Math.ceil(g.measureText(String(text)).width + 2 * PAD_PX); c.width = cw; c.height = CANVAS_H;
  g.fillStyle = edge; g.fillRect(0, 0, cw, CANVAS_H); g.fillStyle = bg; g.fillRect(4, 4, cw - 8, CANVAS_H - 8);
  g.font = f; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = fg; g.fillText(String(text), cw / 2, CANVAS_H / 2 + FONT_PX * .04);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  const frac = FONT_PX / CANVAS_H, h = font / frac; return { tex: t, w: h * cw / CANVAS_H, h, frac };
}
const eraName = id => ERA[id] ? ERA[id][i18n.lang] || ERA[id].en : id;

export default {
  id: 'dig', persist: false, size: 20, height: 12,
  words: {
    th: { dg_intro: 'ตุ่นนี่ (ตุ่นนักโบราณคดี) ชวนขุดหาของโบราณ', dg_goal: 'วางแล้ว {n}/{m}', dg_wrong: 'ยังไม่ใช่ที่ของมัน ลองดูป้ายอีกที', dg_wrong_a: 'ลองดูตัวอักษรจาง ๆ ให้ตรงกัน',
          dg_found: 'เจอแล้ว {n}', dg_first: 'ขุดหาของก่อนนะ', dg_done: 'เก่งมาก ขุดครบแล้ว ได้ {n} ดาว', dg_next: 'ไปด่านต่อไป', dg_all: 'ครบทุกด่านแล้ว', dg_secret: 'เจอก้อนทองที่ซ่อนอยู่', dg_old: 'เก่าสุด', dg_new: 'ใหม่สุด', dg_shelf: 'ของที่ขุดได้', dg_hands: 'วางของที่ถืออยู่ก่อนนะ' },
    en: { dg_intro: 'Tunny the mole archaeologist invites you to dig for old finds', dg_goal: 'placed {n}/{m}', dg_wrong: 'Not its place yet. Look at the signs again', dg_wrong_a: 'Match the faint letter',
          dg_found: 'Found {n}', dg_first: 'Dig something up first', dg_done: 'Well done, all dug up! {n} stars', dg_next: 'next level', dg_all: 'All levels done', dg_secret: 'Found the hidden gold', dg_old: 'oldest', dg_new: 'newest', dg_shelf: 'Finds', dg_hands: 'Put down what you are holding first' }
  },
  rules: { build: true, damage: false },
  start: { shovel: 1, pickaxe: 1, planks: 24 },
  spawn: [-9.5, .5],           // placeholder: startLevel replaces it with the first stair of the cut (see there)
  build(game){
    this.game = game; let stored = null; try { stored = localStorage.getItem('fc-band'); } catch (e) {}
    this.band = getBand(location.search, stored); this.n = Math.max(3, Math.min(8, TUNING.quest.digLayers));
    this.grp = new THREE.Group(); game.scene.add(this.grp); this.bill = []; this.timers = []; this.carry = null; this.head = null;
    this.state = { index: -1, done: false, stars: 0, placed: 0, result: null };
    this.quest = startQuest(game, { gameId: 'dig', band: this.band, levels: (band, i) => { const site = makeDigSite(band, i, this.n, { free: TUNING.quest.digFree, maxPerEra: TUNING.quest.digMaxPerEra }); return { kind: i === 3 ? 'free' : 'goal', target: i === 3 ? site.freeN : site.finds.length, extra: 'clean', site }; } });
    this.off = [game.bus.on('block_place', e => this.onPlace(e)), game.bus.on('block_break', e => this.onBreak(e))];
    registerKeepClear(game, () => this.signs || []);      // the room buttons keep off the era / shelf signs and the letter slots
    this.camRule = makeCameraRule(game, { band: this.band, base: () => this.baseView, focus: (t, c) => this.focus(t, c) });
    addEventListener('resize', this.onResize = () => { clearTimeout(this.reframeT); this.reframeT = setTimeout(() => this.frameView(), 250); });      // turning the phone: frame the cut again for the new screen shape
    watchHint(() => this.frameView());      // the goal banner changed size: frame again
    this.chip = makeBandChip(game, { band: this.band, onPick: b => this.switchBand(b) });
    this.startLevel(0);
  },
  // ---- geometry: site-local (x along the cut, y = layer row, z into the rock; z = 0 is the front face, world z is flipped) <-> world cells ----
  cell(x, y, z){ return [this.sx + x, this.Y0 - y, this.sz + this.site.size.z - 1 - z]; },
  wpos(c, up = .5){ const W = this.game.world; return new THREE.Vector3(W.wx(c[0]), c[1] + up, W.wx(c[2])); },
  terrain(){
    const W = this.game.world, site = this.site, a = this.band === 'a', n = this.n, Y0 = this.Y0 = n, X = site.size.x, Z = site.size.z;
    this.sx = 1; this.sz = 9; W.cells.fill(0); W.dirty = true;
    const ground = (x, z) => { W.set(x, 0, z, BLOCK.bedrock); for (let y = 1; y < Y0; y++) W.set(x, y, z, BLOCK.soil); W.set(x, Y0, z, BLOCK.grass); };
    for (let x = 0; x < W.N; x++) for (let z = 0; z < W.N; z++){
      if (z >= this.sz && z < this.sz + Z) ground(x, z);          // a slab: the cross-section is its front face
    }
    for (let r = 0; r < n; r++) for (let x = 0; x < X; x++) for (let z = 0; z < Z; z++) W.set(this.sx + x, Y0 - r, this.sz + z, BLOCK[site.layers[r]]);
    const deep = a ? 2 : n - 1;      // band a never needs to go below depth 2: the landing stops there
    for (let i = 0; i < DIG.stairs; i++) for (let r = 0; r <= Math.min(i, deep); r++) for (let z = 0; z < Z; z++) W.set(this.sx + i, Y0 - r, this.sz + z, 0);   // stairs down, one block per step
    for (const f of site.finds) W.set(...this.cell(f.x, f.y, f.z), 0);                                 // the pocket each find sits in
    const s = site.secret; this.secretCell = this.cell(s.x, s.y, s.z); W.set(...this.secretCell, BLOCK.gold);
  },
  // the band chip: same room, new band, level 1, nothing left of the old level
  switchBand(b){ this.band = b; setQuestBand(this.quest, b); this.camRule.setBand(b); this.chip.setBand(b);  this.startLevel(0); },
  // ---- level lifecycle ----
  startLevel(i){
    const game = this.game, q = this.quest, W = game.world;
    this.timers.forEach(clearTimeout); this.timers = []; this.grp.clear(); this.bill = []; this.signs = []; this.setCarry(null);
    q.start(i); this.site = q.def.site; this.free = this.site.free; this.task = this.site.task; this.state = { index: i, done: false, stars: 0, placed: 0, result: null };
    this.secret = false; this.pulse = []; this.lastAct = game.roomTime || 0; game.drops.clear(); this.terrain();
    this.drawFinds(); this.drawTargets();
    // spawn inside the cut, at the slab's middle plane (band a's slab is one block deep, b/c three); frameView puts this stair in frame with the cut.
    // this.spawn is the room spawn game.js uses right after build and player.js uses on a respawn, so it must be the same spot.
    const a = this.band === 'a', sp = this.spawn = [W.wx(this.sx + SPAWN_STAIR[this.band]), W.wx(this.sz + (this.site.size.z >> 1))]; game.player.spawn(...sp);
    this.baseView = viewFor(this.band); this.frameView(); this.camRule.reset(); game.cam.cur = this.baseView.dist; game.cam.inited = false;          // the cut face toward the camera, +x runs to the right (band a: side-on)
    this.timers.push(setTimeout(() => this.frameView(), 600));      // the HUD has settled by now (fresh load): frame once more
    const goal = this.goalStr = this.task.goalText[i18n.lang]; this.refreshGoal();
    if (i === 0){ game.hud.say(game.t('dg_intro'), 3500); this.timers.push(setTimeout(() => game.hud.say(goal), 3600)); } else game.hud.say(goal);
    if (a) this.speak(goal);
  },
  // ---- framing: what has to be on screen, and a camera that shows all of it as big as the free screen area allows ----
  frameBoxes(){ return [...(this.signs || []), ...(this.finds || []).filter(d => !d.taken).map(d => d.m)]; },      // every label a child reads (tests check these)
  frameItems(){
    const W = this.game.world, V = THREE.Vector3, out = [];
    for (const s of this.signs) if (s.visible !== false) out.push({ p: s.position.clone(), w: s.userData.size[0] * s.scale.x, h: s.userData.size[1] * s.scale.x });
    for (const d of this.finds) if (!d.taken){ const k = d.f.item === 'letter' ? NEAR.letter : NEAR.wide; out.push({ p: this.wpos(d.c).add(new V(d.m.userData.dx || 0, 0, d.m.userData.lift)), w: d.m.userData.size[0] * k, h: d.m.userData.size[1] * k }); }      // as big as they grow
    for (const s of this.slotAt.values()) out.push({ p: s.tile.position.clone(), w: .9, h: .1 });
    const st = SPAWN_STAIR[this.band], py = this.Y0 - Math.min(st, this.band === 'a' ? 2 : this.n - 1); out.push({ p: new V(this.spawn[0], py + .95, this.spawn[1]), w: 1.1, h: 2.1 });      // the player on the spawn stair
    const fz = W.wx(this.sz + this.site.size.z - 1) + .5, deep = this.band === 'a' ? 2 : this.n - 1;      // the rock face of the cut: from the top of the surface down to the dig floor
    out.push({ p: new V(W.wx(this.sx + DIG.stairs) - .5, this.Y0 + 1, fz), w: 0, h: 0 }, { p: new V(W.wx(this.sx + DIG.stairs), this.Y0 - deep, fz), w: 0, h: 0 });      // (its right part beyond the last find column is plain rock)
    return out;
  },
  // the camera: the frame items as big as the HUD-free screen area allows (quest/frame.js), looked at from just in front of the rock face
  frameView(){
    if (!this.site || !this.baseView) return;
    const W = this.game.world, items = this.frameItems(), C = new THREE.Vector3(0, 0, W.wx(this.sz + this.site.size.z - 1) + 1.1);
    for (const it of items){ C.x += it.p.x / items.length; C.y += it.p.y / items.length; }
    this.frame = solveFrame(this.game.camera, items, this.baseView, C); this.baseView.dist = Math.min(ORBIT, this.frame.D);
  },
  focus(target, c){ return frameFocus(this.frame, target, c); },      // slides only when the player walks out of the framed area
  speak(text){ speakMixed(text, i18n.lang); },      // the English word of a band a goal gets an English voice (quest/speech.js)
  // ---- drawing ----
  tag(find, scale = 1){      // the label mesh of a find: letters on a square tile, names on a wide sign
    const letter = find.item === 'letter', txt = letter ? find.label : find.label[i18n.lang];
    const bd = letter ? null : board(txt, FONT.find), tex = letter ? labelTexture(txt, { bg: '#fff0c8', fg: '#3b2a1a', size: 128 }) : bd.tex, w = letter ? .62 : bd.w, h = letter ? .62 : bd.h, g = new THREE.Group();
    g.userData.frac = letter ? .7 : bd.frac; g.userData.textH = letter ? .62 : bd.h;      // font size / board height, board height (tests: on-screen text size)
    const back = new THREE.Mesh(new THREE.PlaneGeometry(w + .1, h + .1), new THREE.MeshBasicMaterial({ color: '#5a3512', side: THREE.DoubleSide })); back.position.z = -.01; g.add(back);
    g.add(new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }))); g.scale.setScalar(scale); g.userData.size = [w + .1, h + .1]; g.name = (letter ? 'letter:' : 'find:') + txt; return g;
  },
  sign(text, x, y, z, fixed = false, right = false){      // right: x is the sign's right edge (era signs stop short of the first find column)
    const bd = board(text, FONT.sign, { bg: '#3b2a1a', fg: '#fff8e6', edge: '#7a5632' }), w = bd.w, h = bd.h, g = new THREE.Group(), p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: bd.tex, side: THREE.DoubleSide }));
    g.add(p); g.position.set(right ? x - w / 2 : x, y, z); g.userData.size = [w, h]; g.userData.frac = bd.frac; g.userData.textH = h; g.name = 'sign:' + text; this.grp.add(g); this.signs.push(g); if (!fixed) this.bill.push(g); return g;   // fixed = flat on the cut face, facing the front
  },
  drawFinds(){ const W = this.game.world;
    this.finds = this.site.finds.map(f => { const c = this.cell(f.x, f.y, f.z), m = this.tag(f); m.position.copy(this.wpos(c)); this.grp.add(m); this.bill.push(m);
      m.userData.lift = f.z + .85; m.children.forEach(ch => { ch.userData.z0 = ch.position.z; ch.userData.x0 = ch.position.x; });
      if (f.item !== 'letter'){ const half = m.userData.size[0] * NEAR.wide / 2, left = W.wx(this.sx + DIG.stairs) + .12, right = W.wx(this.sx + DIG.sizeX - 1) + .5, x = m.position.x;      // a long name slides along the face to stay off the era signs (left) and inside the cut (right)
        m.userData.dx = Math.max(0, left - (x - half)) + Math.min(0, right - (x + half)); } setLabelScale(m, f.item === 'letter' ? FAR.letter : FAR.wide);      // the label stands just in front of the rock face, so the rock round its pocket never hides part of it
      const b = new THREE.Mesh(new THREE.ConeGeometry(.22, .5, 8), new THREE.MeshBasicMaterial({ color: '#ffd21f' })); b.rotation.x = Math.PI; b.position.set(m.position.x, this.Y0 + 1.7, m.position.z); b.visible = false; this.grp.add(b);
      return { f, c, m, beacon: b, taken: false, key: null }; });
    const type = this.task.type, order = this.task.order;
    for (const d of this.finds) d.key = this.free ? '*' : type === 'letters' ? d.f.label : type === 'tag' ? d.f.era : order.indexOf(d.f.era);
    // layer signs on the cut face (band b: which era each layer is); band c has to work it out from "deeper = older"
    if (this.band === 'b'){ const W = this.game.world, spans = [];      // one sign per era, centred on the rows the era covers (bronze spans two)
      for (let r = 1; r < this.n; r++){ const e = eraForDepth(r, 'b'), last = spans[spans.length - 1]; if (last && last.e === e) last.rows.push(r); else spans.push({ e, rows: [r] }); }
      for (const sp of spans){ const c = this.cell(DIG.stairs, sp.rows[0], 0), y = sp.rows.reduce((m, r) => m + this.wpos(this.cell(DIG.stairs, r, 0)).y, 0) / sp.rows.length;
        this.sign(eraName(sp.e), W.wx(c[0]) - .02, y, W.wx(c[2]) + .53, true, true); } }      // right edge just short of the first face column; the band b spawn stair is left of them
    // the hidden gold sits in the rock as a real gold block (see secretCell); nothing to draw
  },
  drawTargets(){
    const W = this.game.world, Y = this.Y0 + 1, N = this.free ? this.site.freeN : this.finds.length, type = this.task.type; this.targets = []; this.slotAt = new Map();
    const tile = new THREE.MeshBasicMaterial({ color: '#ffd21f', transparent: true, opacity: .32, depthWrite: false });
    const addT = (key, cells, label) => { const t = { key, label, slots: [] }; for (const c of cells){ const s = { c, t, filled: null, tile: null };
        s.tile = new THREE.Mesh(new THREE.PlaneGeometry(.9, .9), tile.clone()); s.tile.rotation.x = -Math.PI / 2; s.tile.position.set(W.wx(c[0]), Y + .03, W.wx(c[2])); this.grp.add(s.tile);
        t.slots.push(s); this.slotAt.set(c.join(), s); } this.targets.push(t); return t; };
    const zf = this.sz + this.site.size.z - 1, X0 = this.sx + DIG.stairs;        // shelves stand on the surface above the cut (x 6..10), so they are always near the work and on screen
    if (this.free){
      const t = addT('*', range(N).map(i => [X0 + i, Y, zf]));
      this.sign(this.game.t('dg_shelf'), W.wx(t.slots[1].c[0]), Y + SIGN_UP, W.wx(zf) + 1.4);
    } else if (type === 'letters'){
      this.task.word.split('').forEach((ch, i) => { const t = addT(ch, [[X0 + i, Y, zf]]), s = t.slots[0];
        const ghost = this.tag({ item: 'letter', label: ch }, .8); ghost.position.set(W.wx(X0 + i), Y + 1.1, W.wx(zf)); ghost.traverse(o => { if (o.material){ o.material.transparent = true; o.material.opacity = .5; } }); ghost.name = 'slot:' + ch; this.grp.add(ghost); this.bill.push(ghost); this.signs.push(ghost); s.ghost = ghost; });
    } else if (type === 'tag'){
      this.task.eras.forEach((era, j) => { const k = this.task.perEra[era], cells = range(k).map(i => [X0 + 2 * j, Y, zf - i]);
        addT(era, cells, era); this.sign(eraName(era), W.wx(X0 + 2 * j), Y + SIGN_UP + (j % 2) * SIGN_STEP, W.wx(zf) + 1.4); });      // shelves are 2 blocks apart and a full era name is wider: every other sign one step up
    } else {
      this.task.order.forEach((era, i) => addT(i, [[X0 + i, Y, zf]]));      // oldest at the left end
      const first = this.targets[0].slots[0].c, last = this.targets[this.targets.length - 1].slots[0].c;
      this.sign(this.game.t('dg_old'), W.wx(first[0]), Y + SIGN_UP, W.wx(zf) + 1.4); this.sign(this.game.t('dg_new'), W.wx(last[0]), Y + SIGN_UP, W.wx(zf) + 1.4);
    }
    const mid = this.targets[Math.floor(this.targets.length / 2)].slots[0].c; this.shelfPos = new THREE.Vector3(W.wx(mid[0]), Y + 1, W.wx(mid[2]));
  },
  setCarry(d){
    this.carry = d; if (this.head){ this.game.scene.remove(this.head); this.head = null; }
    if (d){ this.head = this.tag(d.f, d.f.item === 'letter' ? 2.1 : 1.3); this.head.traverse(o => { if (o.material){ o.material.depthTest = false; o.material.depthWrite = false; o.material.transparent = true; o.renderOrder = 999; } }); this.game.scene.add(this.head); this.bill.push(this.head); }     // big, and drawn over the rock so a roof block never clips it
  },
  // ---- play ----
  topUp(){ const inv = this.game.inv; if (!inv.slots.some(s => s && s.id === PLINTH && s.n > 0)) inv.add(PLINTH, 4, true); },      // a carried find can always be placed
  hold(on){      // while a find is carried the plinth block is in the child's hand, so right-click / the use button puts it on a shelf; afterwards the tool comes back
    const inv = this.game.inv, k = on ? inv.slots.findIndex(s => s && s.id === PLINTH) : inv.slots.findIndex(s => s && s.id === 'shovel');
    if (on && inv.sel !== k) this.prevSel = inv.sel; if (k >= 0) inv.select(on ? k : (this.prevSel ?? k));
  },
  onBreak(e){
    if (!this.site || this.state.done || e.remote) return;
    const s = this.secretCell; if (!this.secret && e.x === s[0] && e.y === s[1] && e.z === s[2]){ this.secret = true; this.game.hud.say(this.game.t('dg_secret'), 2500); this.game.sound.play('star'); this.quest.skill('exploring', 'hidden gold'); }
    const slot = this.slotAt.get([e.x, e.y, e.z].join()); if (slot && slot.filled) this.game.world.set(e.x, e.y, e.z, BLOCK[PLINTH]);       // a filled shelf cell stays put
  },
  onPlace(e){
    if (!this.site || this.state.done || e.remote) return; const slot = this.slotAt.get([e.x, e.y, e.z].join()); if (!slot) return;
    const game = this.game, W = game.world, d = this.carry; this.lastAct = game.roomTime;
    const undo = () => { W.set(e.x, e.y, e.z, 0); game.inv.add(PLINTH, 1, true); };      // take the block back: the shelf cell stays open
    if (slot.filled){ undo(); return; }
    if (!d){ undo(); game.hud.say(game.t('dg_first'), 2500); return; }
    const info = { block: PLINTH, x: e.x - this.sx, y: this.Y0 - e.y, z: e.z - this.sz, find: d.f.item };
    const ok = this.free || slot.t.key === d.key;
    if (!ok){ undo(); this.onWrong(this.quest.wrong(info).hint); return; }
    this.quest.right(info); slot.filled = d; if (slot.ghost) slot.ghost.visible = false;
    const m = this.tag(d.f, d.f.item === 'letter' ? .8 : .7); m.position.set(W.wx(e.x), e.y + 1.45, W.wx(e.z)); this.grp.add(m); this.bill.push(m); slot.tile.visible = false;
    this.setCarry(null); this.hold(false); this.state.placed++; this.refreshGoal(); game.sound.play('pickup');
    if (this.state.placed >= (this.free ? this.site.freeN : this.finds.length)) this.finish();
  },
  onWrong(hint){
    const game = this.game; game.hud.say(game.t(this.band === 'a' ? 'dg_wrong_a' : 'dg_wrong'), 3000); this.applyHint(hint);
  },
  applyHint(h){
    const game = this.game, until = game.roomTime + TUNING.quest.peekMs * (h === 'show' ? 2 : 1) / 1000;
    if (h === 'replay'){ game.hud.say(this.goalStr, 4000); if (this.band === 'a') this.speak(this.goalStr); return; }
    if (this.carry){
      const t = this.free ? this.targets[0] : this.targets.find(t => t.key === this.carry.key), open = t ? t.slots.filter(s => !s.filled) : [];
      this.pulse = (h === 'highlight2' ? open.slice(0, 2) : open).map(s => ({ m: s.tile, until }));
    } else {
      const left = this.finds.filter(d => !d.taken); this.pulse = (h === 'highlight2' ? left.slice(0, 2) : left).map(d => ({ m: d.beacon, until, beacon: true }));
    }
  },
  idleHint(){      // a nudge only: no shell hint is asked, so hint telemetry and Progress.suggest stay clean
    const game = this.game, until = game.roomTime + TUNING.quest.peekMs / 1000; game.hud.say(this.goalStr, 4000); if (this.band === 'a') this.speak(this.goalStr);
    if (this.carry){ const t = this.free ? this.targets[0] : this.targets.find(t => t.key === this.carry.key); this.pulse = (t ? t.slots.filter(s => !s.filled) : []).map(s => ({ m: s.tile, until })); }
    else this.pulse = this.finds.filter(d => !d.taken).slice(0, 2).map(d => ({ m: d.beacon, until, beacon: true }));
  },
  refreshGoal(){ const m = this.free ? this.site.freeN : this.finds.length; this.game.hud.goal(this.game.t('dg_goal', { n: this.state.placed, m })); },
  finish(){
    const game = this.game, q = this.quest; this.state.done = true;
    const res = q.complete({ extraMet: q.level ? q.level.tries === 0 : false, secretFound: this.secret }); this.state.result = res; this.state.stars = res.stars;
    saveQuest('dig', q);
    game.sound.play('star'); game.particles.burst(this.shelfPos.clone(), { color: '#ffc94d', shape: 'star', n: 24, speed: 4 });
    game.hud.say(game.t('dg_done', { n: res.stars }) + (res.next != null ? ' · ' + game.t('dg_next') : ' · ' + game.t('dg_all')), 4000);
    if (res.next != null) this.timers.push(setTimeout(() => this.startLevel(res.next), 4200));
  },
  update(game, dt, t){
    this.camRule.update(dt);
    if (!this.site) return; const P = game.player.body, W = game.world, cam = game.camera.position;
    { const lo = W.wx(this.sz), hi = W.wx(this.sz + this.site.size.z - 1); P.z = Math.max(lo, Math.min(hi, P.z)); }     // stay on the slab
    { const at = game.cam.at, ry = Math.atan2(cam.x - at.x, cam.z - at.z); for (const m of this.bill) m.rotation.y = ry; }      // labels face the view direction (all parallel to the screen), so wide ones are never skewed into their neighbours
    let nearest = null, nd = 4.5;
    for (const d of this.finds){ if (d.taken) continue; const k = Math.hypot(P.x - d.m.position.x, P.z - d.m.position.z); if (k < nd && Math.abs(P.y - d.c[1]) < 3.5){ nd = k; nearest = d; } }
    if (this.head){ const dx = cam.x - P.x, dz = cam.z - P.z, L = Math.hypot(dx, dz) || 1;       // held find floats in front of the player (toward the camera) so rock overhead never hides it
      this.head.position.set(P.x + dx / L * 1.9 + dz / L * 1.1, P.y - .1 + Math.sin(t * 3) * .04, P.z + dz / L * 1.9 - dx / L * 1.1); }      // held find: in front of the player's feet (toward the camera), so it covers neither the head, nor the cut-face signs, nor the finds above
    for (const d of this.finds){
      if (d.taken) continue; d.m.position.y = d.c[1] + .5 + Math.sin(t * 2 + d.c[0]) * .04;
      // finds within 5 cells grow to a sign a child can read (drawn over the rock); far ones stay small tags in their pockets
      const near = !!nearest && Math.hypot(P.x - d.m.position.x, P.z - d.m.position.z) < 5 && Math.abs(P.y - d.c[1]) < 3.5; if (near !== d.near){ d.near = near; setLabelScale(d.m, (near ? NEAR : FAR)[d.f.item === 'letter' ? 'letter' : 'wide']); d.m.traverse(o => { if (o.material){ o.material.depthTest = !near; o.material.transparent = near; o.renderOrder = near ? 500 : 0; } }); }
      // band a's window is wider below: a row-1 find is collected from the depth-2 landing tunnel, so nobody has to climb
      if (!this.carry && !this.state.done){ const dx = P.x - d.m.position.x, dz = P.z - d.m.position.z, dy = P.y - d.c[1];
        if (Math.hypot(dx, dz) < 1.15 && dy > (this.band === 'a' ? -1.1 : -.7) && dy < (this.band === 'a' ? 1.1 : .9)){ d.taken = true; d.m.visible = false; d.beacon.visible = false; this.setCarry(d); this.topUp(); this.hold(true); this.lastAct = game.roomTime; game.sound.play('pickup');
          game.particles.burst(d.m.position.clone(), { color: '#fff6c8', shape: 'star', n: 6, speed: 1.5, up: 2 }); const n = this.finds.filter(x => x.taken).length;
          game.hud.say(game.t('dg_found', { n }) + ' · ' + (d.f.item === 'letter' ? d.f.label : d.f.label[i18n.lang]), 2500); } }
    }
    for (const s of this.slotAt.values()) if (!s.filled) s.tile.material.opacity = .28 + Math.sin(t * 2 + s.c[0]) * .05;
    for (const p of this.pulse){ if (game.roomTime < p.until){ if (p.beacon){ p.m.visible = true; p.m.position.y = this.Y0 + 1.7 + Math.sin(t * 6) * .15; } else p.m.material.opacity = .65 + Math.sin(t * 8) * .3; } else if (p.beacon) p.m.visible = false; }
    if (!this.state.done && game.roomTime - this.lastAct > 55){ this.lastAct = game.roomTime; this.idleHint(); }
  },
  save(){ return {}; }
};
const range = n => Array.from({ length: n }, (_, i) => i);
// a find's label at scale k: its planes sit userData.lift in front of the find (toward the camera: the group faces it), whatever the scale
function setLabelScale(m, k){ m.scale.setScalar(k); for (const ch of m.children){ ch.position.z = ch.userData.z0 + (m.userData.lift || 0) / k; ch.position.x = (ch.userData.x0 || 0) + (m.userData.dx || 0) / k; } }
