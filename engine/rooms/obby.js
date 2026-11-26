// Room: Obby quest. A course of raft rows over shallow water: each row has one plank block per answer, side by side, with a sign that
// shows (and in band a says aloud) the question. Step on the block with the right answer and the way builds on to the next row; a wrong block
// wobbles, then sinks after TUNING.quest.sinkDelay, the player drops into the water and is put back on the landing before the row (no hearts lost).
// Band a is shown side-on from a fixed camera in landscape (the course runs left to right, the blocks lie in lanes), behind the player in
// portrait; bands b and c are shown from behind, steeper for c. Every row is level, so nobody needs to jump. Pure logic: quest/obby-logic.js.
// Host: Pip the tree-frog jump coach (text only).
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
import { makeObby } from './quest/obby-logic.js';

const SIZE = 36, MID = (SIZE - 1) / 2;       // world size; the middle cell (the course is centred across)
const U0 = 4, Z0 = 31;                       // the course starts at cell x = U0 (side-on) or cell z = Z0 and runs to smaller z (from behind)
const TOP = 1, PERIOD = 4;                   // the top of a block (the pond bed is y = 0, the water plane sits at about .6); a 2-cell landing + a 2-cell block = 4 cells per row
                                             // (the landing is 2 deep so that the player, standing at its back, does not cover the labels of the row ahead)
const SIGN_LEAN = .85;                       // the sign leans back by this share of the camera pitch (so it faces the camera without being laid flat)
const SH = 1.5, SY0 = 1.2;                   // the question sign: height and height of its lower edge (its width is the row's width + a half block)
const GLOW = { bad: '#e0524a', ok: '#5ed47a', hint: '#46d4e6' };
const HUD_SEL = '#who,#stars,#gear,#bView,#bar,#joy,#act .btn,#hearts,#stam,#togChip,#hint';
const FONT = p => `700 ${p}px "Baloo 2", "Noto Sans Thai", "Nunito", system-ui, sans-serif`;
// camera pitches to try (steepest last), in the order of preference, per band and way of seeing the course
const PITCH = { side: [.78, .7, .62, .55], fwdA: [.9, .8, 1], fwdB: [.95, .85, 1.05], fwdC: [1.05, .95, 1.12], fwdMore: [.75, .65, .55, .45, 1.15] };      // fwdMore: only for screens where the preferred pitches do not fit

// the pad picture of a "how many" option: dots in a tidy pattern
function dotsTexture(n){
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
  g.fillStyle = '#fff8e6'; g.fillRect(0, 0, 256, 256);
  const cols = n <= 3 ? n : n === 4 ? 2 : n <= 6 ? 3 : n === 9 ? 3 : 4, rows = Math.ceil(n / cols), cell = Math.min(232 / cols, 232 / rows), r = cell * .4;
  let i = 0; for (let y = 0; y < rows; y++){ const inRow = Math.min(cols, n - y * cols);
    for (let x = 0; x < inRow; x++, i++){ const cx = 128 + (x - (inRow - 1) / 2) * cell, cy = 128 + (y - (rows - 1) / 2) * cell;
      g.fillStyle = '#3d7fd9'; g.strokeStyle = '#3b2a1a'; g.lineWidth = Math.max(4, r * .18); g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill(); g.stroke();
      g.fillStyle = 'rgba(255,255,255,.55)'; g.beginPath(); g.arc(cx - r * .3, cy - r * .32, r * .26, 0, Math.PI * 2); g.fill(); } }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
// the font height of a labelTexture label as a share of the label's height (label.js picks it from the text length)
const labelFrac = text => { const n = String(text).length; return n <= 1 ? .7 : n <= 2 ? .55 : n <= 4 ? .38 : .26; };
// little pictures for the sign of a band a row, drawn in a 100 x 100 box (no emoji, no files)
const INK = '#3b2a1a';
const poly = (g, fill, pts) => { g.fillStyle = fill; g.strokeStyle = INK; g.lineWidth = 4; g.lineJoin = 'round'; g.beginPath(); pts.forEach(([x, y], i) => g[i ? 'lineTo' : 'moveTo'](x, y)); g.closePath(); g.fill(); g.stroke(); };
const oval = (g, fill, x, y, rx, ry = rx) => { g.fillStyle = fill; g.strokeStyle = INK; g.lineWidth = 4; g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, 7); g.fill(); g.stroke(); };
const line = (g, pts) => { g.strokeStyle = INK; g.lineWidth = 4; g.lineCap = 'round'; g.lineJoin = 'round'; g.beginPath(); pts.forEach(([x, y], i) => g[i ? 'lineTo' : 'moveTo'](x, y)); g.stroke(); };
const WORD_ICONS = {
  cat: g => { poly(g, '#f0a050', [[22, 40], [26, 10], [46, 28]]); poly(g, '#f0a050', [[78, 40], [74, 10], [54, 28]]); oval(g, '#f0a050', 50, 56, 32, 28); oval(g, INK, 39, 52, 4); oval(g, INK, 61, 52, 4); poly(g, '#e0524a', [[46, 62], [54, 62], [50, 67]]); line(g, [[20, 60], [36, 64]]); line(g, [[80, 60], [64, 64]]); },
  dog: g => { oval(g, '#8a5530', 20, 50, 12, 24); oval(g, '#8a5530', 80, 50, 12, 24); oval(g, '#d29a5c', 50, 52, 28, 30); oval(g, INK, 40, 46, 4); oval(g, INK, 60, 46, 4); oval(g, INK, 50, 62, 8, 6); },
  sun: g => { for (let i = 0; i < 8; i++){ const a = i * Math.PI / 4; line(g, [[50 + Math.cos(a) * 34, 50 + Math.sin(a) * 34], [50 + Math.cos(a) * 46, 50 + Math.sin(a) * 46]]); } oval(g, '#ffd21f', 50, 50, 26); },
  hat: g => { poly(g, '#3d7fd9', [[28, 70], [34, 28], [66, 28], [72, 70]]); oval(g, '#3d7fd9', 50, 72, 44, 10); line(g, [[31, 56], [69, 56]]); },
  pig: g => { poly(g, '#f4a0b0', [[24, 32], [30, 12], [42, 28]]); poly(g, '#f4a0b0', [[76, 32], [70, 12], [58, 28]]); oval(g, '#f4a0b0', 50, 54, 32, 28); oval(g, '#e8758c', 50, 62, 13, 9); oval(g, INK, 45, 62, 2.5); oval(g, INK, 55, 62, 2.5); oval(g, INK, 38, 46, 4); oval(g, INK, 62, 46, 4); },
  cup: g => { g.strokeStyle = INK; g.lineWidth = 6; g.beginPath(); g.arc(76, 48, 13, -1.4, 1.4); g.stroke(); poly(g, '#e0524a', [[22, 22], [78, 22], [70, 80], [30, 80]]); },
  bed: g => { poly(g, '#8a5530', [[10, 45], [90, 45], [90, 78], [10, 78]]); poly(g, '#e0524a', [[10, 45], [90, 45], [90, 58], [10, 58]]); oval(g, '#fff8e6', 26, 40, 14, 8); line(g, [[10, 45], [10, 28]]); },
  sit: g => { line(g, [[30, 15], [30, 82]]); poly(g, '#d29a5c', [[30, 50], [78, 50], [78, 60], [30, 60]]); line(g, [[74, 60], [74, 84]]); },
  hen: g => { oval(g, '#fff8e6', 46, 58, 30, 26); poly(g, '#e0524a', [[34, 34], [40, 22], [46, 32], [52, 20], [56, 34]]); poly(g, '#ffb000', [[72, 46], [88, 52], [72, 58]]); oval(g, INK, 62, 44, 4); line(g, [[44, 84], [44, 92]]); line(g, [[56, 84], [56, 92]]); },
  fox: g => { poly(g, '#e8742a', [[14, 22], [50, 86], [86, 22], [62, 40], [38, 40]]); poly(g, '#fff8e6', [[30, 56], [50, 86], [70, 56], [50, 64]]); oval(g, INK, 50, 84, 4); oval(g, INK, 38, 48, 3.5); oval(g, INK, 62, 48, 3.5); },
  map: g => { poly(g, '#f2d68c', [[14, 22], [40, 14], [62, 24], [86, 14], [86, 78], [62, 88], [40, 78], [14, 86]]); line(g, [[40, 14], [40, 78]]); line(g, [[62, 24], [62, 88]]); line(g, [[24, 62], [34, 46], [50, 58], [70, 36]]); line(g, [[68, 32], [76, 40]]); line(g, [[76, 32], [68, 40]]); },
  red: g => { oval(g, '#e0524a', 50, 50, 34); oval(g, 'rgba(255,255,255,.5)', 38, 38, 9, 6); },
  bus: g => { poly(g, '#f2c230', [[8, 28], [92, 28], [92, 72], [8, 72]]); for (let i = 0; i < 4; i++) poly(g, '#bfe9f2', [[14 + i * 20, 34], [28 + i * 20, 34], [28 + i * 20, 50], [14 + i * 20, 50]]); oval(g, INK, 28, 74, 9); oval(g, INK, 72, 74, 9); },
  pin: g => { line(g, [[50, 36], [50, 90]]); oval(g, '#e0524a', 50, 26, 17); },
  log: g => { poly(g, '#8a5530', [[10, 34], [78, 34], [78, 72], [10, 72]]); oval(g, '#d29a5c', 78, 53, 12, 19); oval(g, '#8a5530', 78, 53, 5, 9); },
  net: g => { g.strokeStyle = INK; g.lineWidth = 5; g.beginPath(); g.arc(42, 40, 28, 0, Math.PI * 2); g.stroke(); line(g, [[14, 40], [70, 40]]); line(g, [[42, 12], [42, 68]]); line(g, [[22, 22], [62, 58]]); line(g, [[62, 22], [22, 58]]); line(g, [[62, 62], [88, 90]]); }
};
// "more" / "fewer": a crowd of dots against a single dot with a > or < between
function compareIcon(g, more){
  const dots = (cx, n) => (n === 3 ? [[cx - 15, 70], [cx + 15, 70], [cx, 40]] : [[cx, 55]]).forEach(([x, y]) => { oval(g, '#3d7fd9', x, y, 14); });
  line(g, more ? [[46, 30], [60, 55], [46, 80]] : [[62, 30], [48, 55], [62, 80]]);
  if (more){ dots(20, 3); dots(84, 1); } else { dots(16, 1); dots(80, 3); }
}
// the sign: a cream board with a wood frame, one or two lines, 100 canvas px per world unit; a band a sign also has a picture on the left and room
// for the speaker button on the right. Returns { tex, px, h } (px = font size on the canvas)
function signTexture(text, sw, icon){
  const w = Math.round(sw * 100), h = Math.round(SH * 100), c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
  g.fillStyle = '#7a5632'; g.fillRect(0, 0, w, h); g.fillStyle = '#5a3414'; g.fillRect(6, 6, w - 12, h - 12); g.fillStyle = '#fff8e6'; g.fillRect(12, 12, w - 24, h - 24);
  const side = icon ? 150 : 30, room = w - 2 * side;
  if (icon){ g.save(); g.translate(30, (h - 108) / 2); g.scale(1.08, 1.08); if (icon.kind === 'compare') compareIcon(g, icon.more); else if (WORD_ICONS[icon.word]) WORD_ICONS[icon.word](g); g.restore(); }
  const words = String(text).split(' '); let lines = [String(text)];
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = INK;
  const fit = (ls, top) => { let p = top; do { g.font = FONT(p); p -= 2; } while (p > 28 && Math.max(...ls.map(l => g.measureText(l).width)) > room); return p + 2; };
  let px = fit(lines, 76);
  if (px < 56 && words.length > 1){ const cut = Math.ceil(words.length / 2), two = [words.slice(0, cut).join(' '), words.slice(cut).join(' ')], p2 = Math.min(fit(two, 58), 66); if (p2 > px){ lines = two; px = p2; } }
  g.font = FONT(px); lines.forEach((l, i) => g.fillText(l, w / 2, h / 2 + (i - (lines.length - 1) / 2) * (px * 1.1) + px * .04));
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4; return { tex, px, h };
}
// the speaker button on a band a sign
function speakerTexture(){
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  g.fillStyle = '#ffd21f'; g.strokeStyle = '#7a5632'; g.lineWidth = 8; g.beginPath(); g.arc(64, 64, 56, 0, 7); g.fill(); g.stroke();
  g.fillStyle = INK; g.beginPath(); g.moveTo(30, 52); g.lineTo(48, 52); g.lineTo(70, 34); g.lineTo(70, 94); g.lineTo(48, 76); g.lineTo(30, 76); g.closePath(); g.fill();
  g.strokeStyle = INK; g.lineWidth = 7; g.lineCap = 'round'; for (const r of [14, 28]){ g.beginPath(); g.arc(70, 64, r, -.9, .9); g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

export default {
  wordIcons: WORD_ICONS,
  id: 'obby', persist: false, size: SIZE, height: 8,
  words: {
    th: { ob_intro: 'ปิ๊บ (กบต้นไม้โค้ชกระโดด) ชวนข้ามแพ', ob_goal: 'ข้ามแล้ว {n}/{m} แถว', ob_wrong: 'โอ๊ะ ไม่ใช่อันนี้', ob_ok: 'ถูกแล้ว ไปต่อเลย', ob_fall: 'ตกน้ำ กลับไปเริ่มแถวนี้ใหม่', ob_last: 'ข้ามครบแล้ว เดินไปที่ฝั่งเลย',
          ob_done: 'ข้ามถึงฝั่งแล้ว เก่งมาก ได้ {n} ดาว', ob_next: 'ไปด่านต่อไป', ob_all: 'ครบทุกด่านแล้ว', ob_acorn: 'เจอลูกโอ๊กทองลับ' },
    en: { ob_intro: 'Pip the tree-frog jump coach invites you to cross the rafts', ob_goal: 'rows crossed {n}/{m}', ob_wrong: 'Oops, not that one', ob_ok: 'Right! On you go', ob_fall: 'Splash! Back to the start of this row', ob_last: 'All rows crossed. Walk to the shore',
          ob_done: 'You crossed! Great job. {n} stars', ob_next: 'next level', ob_all: 'All levels done', ob_acorn: 'Found the hidden golden acorn' }
  },
  rules: { build: false, damage: false },
  start: {},
  spawn: [0, 0],         // replaced by the landing of the current row (the engine spawns here after build)
  build(game){
    this.game = game; let stored = null; try { stored = localStorage.getItem('fc-band'); } catch (e) {}
    this.band = getBand(location.search, stored);
    this.grp = new THREE.Group(); game.scene.add(this.grp); this.timers = []; this.pads = []; this.padMap = new Map(); this.sign = null; this.orient = 'fwd'; this.ob = null;
    this.state = { index: -1, done: false, stars: 0, row: 0, result: null };
    this.quest = startQuest(game, { gameId: 'obby', band: this.band, levels: (band, i) => { const ob = makeObby(band, i); return { kind: ob.kind, target: 1, extra: 'clean', ob }; } });
    { let down = null; const cv = game.canvas;         // tap the speaker on the sign: the question is said again
      cv.addEventListener('pointerdown', e => { down = [e.clientX, e.clientY]; });
      cv.addEventListener('pointerup', e => { if (down && Math.hypot(e.clientX - down[0], e.clientY - down[1]) < 10) this.tapSign(e.clientX, e.clientY); down = null; }); }
    this.baseView = { yaw: Math.PI, pitch: .9, dist: 14 };        // replaced by the framed view of every level
    registerKeepClear(game, () => [this.sign, ...(this.pads || []).filter(p => p.grp).map(p => p.grp), this.walkRect()].filter(Boolean));      // the room buttons keep off the prompt sign, the answer pads and the walkway (landing + row + next landing)
    this.camRule = makeCameraRule(game, { band: this.band, base: () => this.view ? { yaw: Math.PI, pitch: this.view.pitch, dist: this.view.d } : this.baseView, focus: (t, c) => frameFocus(this.frame, t, c) });
    this.chip = makeBandChip(game, { band: this.band, onPick: b => this.switchBand(b) });
    addEventListener('resize', this.onResize = () => { if (this.ob && !this.state.done) this.reframe(); });
    watchHint(() => { if (this.ob && !this.state.done) this.reframe(); });      // the goal banner changed size: frame again
    this.startLevel(0);
  },
  // ---- course geometry: row k has a landing at u = 3k and its blocks at u = 3k+1..3k+2; v runs across the row ----
  cellF(orient, u, v){ return orient === 'side' ? [U0 + u, this.V0 + v] : [this.V0 + v, Z0 - u]; },
  // screen rect (css px) of the walkway the child uses now: the current landing, its row of pads and the next landing; null when off screen
  walkRect(){
    if (!this.pads || this.state.row >= this.R) return null; const cam = this.game.camera, k = this.state.row; cam.updateMatrixWorld();
    let l = 1e9, t = 1e9, r = -1e9, b = -1e9;
    for (const u of [PERIOD * k - .5, PERIOD * (k + 1) + 1.5]) for (const v of [-.5, this.Wd - .5]) for (const y of [TOP - .4, TOP + .1]){
      const q = this.wp(u, v, y).project(cam); if (q.z > 1) return null; const x = (q.x + 1) / 2 * innerWidth, yy = (1 - q.y) / 2 * innerHeight; l = Math.min(l, x); r = Math.max(r, x); t = Math.min(t, yy); b = Math.max(b, yy); }
    return r < 0 || b < 0 || l > innerWidth || t > innerHeight ? null : { l, t, r, b, walk: true };      // walk: floor, not a sign (tests tell them apart)
  },
  wp(u, v, y = TOP, orient = this.orient){ const W = this.game.world, [cx, cz] = this.cellF(orient, u, v); return new THREE.Vector3(W.wx(cx), y, W.wx(cz)); },
  uvOf(cx, cz){ return this.orient === 'side' ? [cx - U0, cz - this.V0] : [Z0 - cz, cx - this.V0]; },
  setCell(u, v, id){ const [cx, cz] = this.cellF(this.orient, u, v); this.game.world.set(cx, 0, cz, id); },
  // the band chip: same room, new band, level 1, nothing left of the old level
  switchBand(b){ this.band = b; setQuestBand(this.quest, b); this.camRule.setBand(b); this.chip.setBand(b);  this.startLevel(0); },
  // ---- level lifecycle ----
  startLevel(i){
    const game = this.game, q = this.quest;
    this.timers.forEach(clearTimeout); this.timers = [];
    q.start(i); this.ob = q.def.ob; this.n = this.ob.n; this.Wd = 2 * this.n; this.V0 = Math.round(MID - (this.Wd - 1) / 2); this.R = this.ob.rows.length;
    this.state = { index: i, done: false, stars: 0, row: 0, result: null }; this.rightSent = false; this.wetT = 0; this.onPad = null; this.secret = false; this.acorn = null;
    this.makePads(); this.pickView(); this.layoutAll(); this.refreshGoal(); this.placePlayer();
    if (i === 0){ game.hud.say(game.t('ob_intro'), 4200); this.timers.push(setTimeout(() => this.announceRow(), 4300)); } else this.announceRow();
  },
  // said aloud (band a): a list of { text, lang } parts, one voice each; guarded: no speech support, an exception, or no voice for a language just skips it
  speakParts(parts){
    try { if (typeof speechSynthesis === 'undefined' || typeof SpeechSynthesisUtterance === 'undefined') return;
      speechSynthesis.cancel(); const voices = (speechSynthesis.getVoices && speechSynthesis.getVoices()) || [];
      for (const { text, lang } of parts){ if (!text || (voices.length && !voices.some(v => String(v.lang).toLowerCase().startsWith(lang.slice(0, 2))))) continue;
        const u = new SpeechSynthesisUtterance(text); u.lang = lang; speechSynthesis.speak(u); } } catch (e) {}
  },
  // a sound row says the English target word with an English voice, then the question (Thai UI: in Thai; English UI: the whole prompt in English)
  speakRow(row){
    if (!row) return; const th = i18n.lang === 'th';
    if (row.word && th) return this.speakParts([{ text: row.word, lang: 'en-US' }, { text: row.prompt.th.replace(row.word, '').trim(), lang: 'th-TH' }]);
    this.speakParts([th ? { text: row.prompt.th, lang: 'th-TH' } : { text: row.prompt.say, lang: 'en-US' }]);
  },
  promptText(k = this.state.row){ const p = this.ob.rows[k].prompt; return p[i18n.lang] || p.en; },
  announceRow(){
    if (this.state.done || this.state.row >= this.R) return; const row = this.ob.rows[this.state.row];
    this.game.hud.say(this.promptText(), 4500); if (this.band === 'a') this.speakRow(row);
  },
  // ---- the pads (data first; the world and the meshes are laid out by layoutAll) ----
  makePads(){
    this.pads = this.ob.rows.map((row, k) => row.options.map((opt, j) => ({ k, j, opt, ok: opt.ok, state: 'idle', sinkAt: 0, sunkAt: 0, hintUntil: 0, grp: null, glow: null, born: 0 }))).flat();
    this.rowPads = k => this.pads.filter(p => p.k === k);
  },
  padCells(p){ const c = []; for (let du = 0; du < 2; du++) for (let dv = 0; dv < 2; dv++) c.push([PERIOD * p.k + 2 + du, 2 * p.j + dv]); return c; },
  // build every landing and row up to the current row, from the pads' own state (also the way to flip the course when the screen turns)
  layoutAll(){
    const game = this.game, W = game.world; W.cells.fill(0); W.dirty = true; this.grp.clear(); this.sign = null;
    for (const p of this.pads){ p.grp = null; p.glow = null; }
    for (let k = 0; k <= Math.min(this.state.row, this.R - 1); k++){ this.buildDock(k); for (const p of this.rowPads(k)) this.placePad(p); }
    if (this.state.row >= 1) this.buildSecret();
    if (this.state.row >= this.R) this.buildFinish();
    this.setPadMap(); this.showSign(); this.setDock();
  },
  buildDock(k){ for (let du = 0; du < 2; du++) for (let v = 0; v < this.Wd; v++) this.setCell(PERIOD * k + du, v, BLOCK.log); },
  buildFinish(){
    const u0 = PERIOD * this.R; for (let du = 0; du < 3; du++) for (let v = -1; v <= this.Wd; v++) this.setCell(u0 + du, v, BLOCK.grass);
    if (this.flag){ this.grp.remove(this.flag); }
    const g = this.flag = new THREE.Group(), pole = new THREE.Mesh(new THREE.BoxGeometry(.09, 1.7, .09), clay('#7a5632')); pole.position.y = .85; g.add(pole);
    const cloth = this.cloth = new THREE.Mesh(new THREE.BoxGeometry(.8, .5, .05), clay('#ffd21f', { emissive: '#ffb000', emissiveIntensity: .45 })); cloth.position.set(.45, 1.4, 0); g.add(cloth);
    g.position.copy(this.wp(u0 + 1, (this.Wd - 1) / 2, TOP + 1)); this.grp.add(g);
  },
  // the hidden golden acorn (third star): one log block stuck out beside the second landing, found by walking onto it (level, no jump)
  secretPos(){ return this.wp(PERIOD, this.Wd, TOP); },
  buildSecret(){
    this.setCell(PERIOD, this.Wd, BLOCK.log); if (this.secret) return;
    const g = this.acorn = new THREE.Group(), gold = clay('#ffd21f', { emissive: '#ffb000', emissiveIntensity: .5 });
    const nut = new THREE.Mesh(new THREE.SphereGeometry(.22, 14, 10), gold); nut.scale.y = 1.2; g.add(nut);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(.24, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), clay('#8a5530')); cap.position.y = .12; g.add(cap);
    g.position.copy(this.secretPos()).setY(TOP + .5); this.grp.add(g);
  },
  placePad(p){
    if (p.state === 'sunk') return;
    for (const [u, v] of this.padCells(p)) this.setCell(u, v, BLOCK.planks);
    const g = p.grp = new THREE.Group(); g.position.copy(this.wp(PERIOD * p.k + 2.5, 2 * p.j + .5, TOP));
    const flat = (w, y, mat) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, w), mat); m.rotation.x = -Math.PI / 2; m.position.y = y; g.add(m); return m; };
    p.glow = flat(2.0, .03, new THREE.MeshBasicMaterial({ color: GLOW.hint, transparent: true, opacity: 0, depthWrite: false }));
    flat(1.94, .045, new THREE.MeshBasicMaterial({ color: '#5a3414' }));
    flat(1.82, .06, new THREE.MeshBasicMaterial({ map: p.opt.dots ? dotsTexture(p.opt.dots) : labelTexture(p.opt.label, { bg: '#fff8e6', fg: '#3b2a1a', size: 256 }) }));
    this.grp.add(g); p.born = this.game.roomTime || 0;
  },
  setPadMap(){
    this.padMap = new Map(); if (this.state.row >= this.R) return;
    for (const p of this.rowPads(this.state.row)) for (const [u, v] of this.padCells(p)){ const [cx, cz] = this.cellF(this.orient, u, v); this.padMap.set(cx + ',' + cz, p); }
  },
  setDock(){ const k = Math.min(this.state.row, this.R); this.dock = this.wp(PERIOD * k, (this.Wd - 1) / 2, TOP); },
  // the question sign of the current row: a board on two posts over the row, facing the camera
  signW(){ return this.band === 'a' ? Math.max(this.Wd + .5, 6.6) : this.Wd + .5; },
  showSign(){
    if (this.sign){ this.grp.remove(this.sign); this.sign = null; } if (this.state.row >= this.R) return;
    const side = this.orient === 'side', sw = this.signW(), row = this.ob.rows[this.state.row], { tex, px, h } = signTexture(this.promptText(), sw, this.band === 'a' ? row.icon : null);
    const g = new THREE.Group(), board = new THREE.Mesh(new THREE.PlaneGeometry(sw, SH), new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide })); g.add(board); this.speaker = null;
    if (this.band === 'a'){ const sp = this.speaker = new THREE.Mesh(new THREE.PlaneGeometry(.95, .95), new THREE.MeshBasicMaterial({ map: speakerTexture(), transparent: true, side: THREE.DoubleSide })); sp.position.set(sw / 2 - .85, 0, .02); board.add(sp); }
    const post = new THREE.CylinderGeometry(.08, .08, SY0 + .1, 8), pm = clay('#7a5632');
    const c = side ? this.wp(PERIOD * this.state.row + 2.5, -1.6, SY0 + SH / 2) : this.wp(PERIOD * this.state.row + 4.1, (this.Wd - 1) / 2, SY0 + SH / 2);
    for (const s of [-1, 1]){ const m = new THREE.Mesh(post, pm); m.position.set(s * (sw / 2 - .1), -(SY0 + SH / 2) + (SY0 + .1) / 2 - .02, -.06); g.add(m); }
    g.position.copy(c); g.userData = { px, h, sw, board, born: this.game.roomTime || 0 }; this.grp.add(g); this.sign = g;
  },
  // ---- the camera: choose how to see the course (side-on or from behind), pitch and distance so that the current row's blocks, its sign and the
  //      player are inside the screen and clear of every HUD control, measured from the real HUD rectangles ----
  hudRects(){
    const rects = [...document.querySelectorAll(HUD_SEL)].map(e => e.getBoundingClientRect()).filter(q => q.width > 0 && q.height > 0);
    const h = document.getElementById('hint'), hr = h && h.getBoundingClientRect(), hw = Math.min(innerWidth <= 720 ? .7 * innerWidth : .6 * innerWidth, 420), top = hr && hr.height ? hr.top : (innerWidth <= 720 ? 78 : 14);
    rects.push({ left: (innerWidth - hw) / 2, right: (innerWidth + hw) / 2, top, bottom: top + Math.max(hr ? hr.height : 0, 52) + 6 });         // the hint bubble, with room for one more line than it has now
    return rects;
  },
  framePoints(orient, pitch){
    const V = THREE.Vector3, W = this.Wd, pts = [], P0 = this.wp(0, (W - 1) / 2, TOP, orient);
    for (let j = 0; j < this.n; j++){ for (const du of [1.5, 3.5]) for (const dv of [2 * j - .5, 2 * j + 1.5]) pts.push(this.wp(du, dv, TOP, orient)); pts.push(this.wp(2.5, 2 * j + .5, TOP, orient)); }
    const side = orient === 'side', sw = this.signW(), c = side ? this.wp(2.5, -1.6, 0, orient) : this.wp(4.1, (W - 1) / 2, 0, orient);
    const tilt = -pitch * SIGN_LEAN;       // the board leans back with the camera pitch (update), so its top edge sits a little further away
    for (const sx of [-1, -.5, 0, .5, 1]) for (const sy of [-.5, 0, .5]) pts.push(new V(c.x + sx * sw / 2, SY0 + SH / 2 + sy * SH * Math.cos(tilt), c.z + sy * SH * Math.sin(tilt)));      // the board's corners, edges and middle (its text)
    pts.push(P0.clone().add(new V(0, 1.5, 0)), P0.clone()); this.frameP0 = P0; return pts;
  },
  pickView(){
    const game = this.game, cam = game.camera, V = THREE.Vector3, portrait = innerWidth <= innerHeight, hud = this.hudRects();
    const clear = ([x, y]) => x > 14 && x < innerWidth - 14 && y > 14 && y < innerHeight - 14 && !hud.some(q => x > q.left - 8 && x < q.right + 8 && y > q.top - 8 && y < q.bottom + 8);      // a few px more than the check in the tests: the camera settles a hair off the model
    const tmp = this.tmpCam || (this.tmpCam = new THREE.PerspectiveCamera()); tmp.fov = cam.fov; tmp.aspect = cam.aspect; tmp.near = cam.near; tmp.far = cam.far; tmp.updateProjectionMatrix();
    const tries = []; if (this.band === 'a' && !portrait) for (const p of PITCH.side) tries.push(['side', p]);
    const fw = PITCH['fwd' + this.band.toUpperCase()]; for (const p of [...fw, ...PITCH.fwdMore.filter(x => !fw.includes(x))]) tries.push(['fwd', p]);
    let pick = null;
    for (const [orient, pitch] of tries){
      const pts = this.framePoints(orient, pitch), P0 = this.frameP0;
      const f = solveFrame(cam, pts.map(p => ({ p, w: 0, h: 0 })), { yaw: Math.PI, pitch }, new V(P0.x, P0.y + 1.01, P0.z), { hintRoom: 52 });      // the camera looks at the middle of the free screen area, not at the player (quest/frame.js)
      for (let d = Math.max(innerHeight < 500 ? 5 : 9, f.D); d <= 30.001; d += .25){
        if (pick && d >= pick.D) break;      // the closest camera wins (on a big screen every candidate stops at 9, so the first one stays)
        f.sc.position.copy(f.C).addScaledVector(f.dir, d); f.sc.lookAt(f.C); f.sc.updateMatrixWorld(true);
        if (pts.every(p => { const v = p.clone().project(f.sc); return clear([(v.x + 1) / 2 * innerWidth, (1 - v.y) / 2 * innerHeight]); })){ f.D = d; f.ppu = (innerHeight / 2) / (d * Math.tan(cam.fov * Math.PI / 360)); pick = { orient, pitch, d: Math.min(d, 16), D: d, fit: true }; this.frame = f; break; }      // the follow camera stops at 16; the rest of the distance is in the focus point (frameFocus)
      }
    }
    if (!pick){ pick = { orient: 'fwd', pitch: PITCH['fwd' + this.band.toUpperCase()][0], d: 16, fit: false }; this.frame = null; }
    this.orient = pick.orient; this.fitted = pick.fit; this.view = pick; this.camRule.reset(); game.cam.cur = pick.d; game.cam.inited = false;
  },
  // the screen changed shape: look again; if the way of seeing the course changed too, lay the course out again in place
  reframe(){
    const was = this.orient; this.pickView();
    if (this.orient !== was){ this.layoutAll(); this.respawn(true); }
  },
  placePlayer(){
    const p = this.game.player; this.spawn = [this.dock.x, this.dock.z]; p.spawn(this.dock.x, this.dock.z); p.face = this.orient === 'side' ? Math.PI / 2 : Math.PI; this.onPad = null;
  },
  tapSign(x, y){
    if (!this.speaker || this.state.done) return; const r = this.game.canvas.getBoundingClientRect(), V = THREE.Vector2, rc = this.ray || (this.ray = new THREE.Raycaster());
    rc.setFromCamera(new V((x - r.left) / r.width * 2 - 1, -((y - r.top) / r.height) * 2 + 1), this.game.camera);
    if (rc.intersectObject(this.speaker).length){ this.speakRow(this.ob.rows[this.state.row]); this.spoke = (this.spoke || 0) + 1; this.speaker.scale.setScalar(1.25); this.game.sound.play('pop'); }
  },
  // ---- play ----
  glowOf(p, kind, until = 0){ p.glowKind = kind; p.glowUntil = until; },
  press(pad){
    if (pad.state !== 'idle') return; const game = this.game;
    if (pad.ok) return this.solve(pad);
    pad.state = 'warn'; pad.sinkAt = game.roomTime + TUNING.quest.sinkDelay; this.glowOf(pad, 'bad', pad.sinkAt + 9); game.sound.play('no');
    this.onWrong(this.quest.wrong({ row: this.state.row, answer: pad.opt.label }).hint, pad);
  },
  onWrong(hint, pad){
    const game = this.game, row = this.rowPads(this.state.row), right = row.find(p => p.ok), now = game.roomTime, ms = TUNING.quest.peekMs;
    if (hint === 'replay'){ game.hud.say(this.promptText(), 5000); if (this.band === 'a') this.speakRow(this.ob.rows[this.state.row]); return; }
    game.hud.say(game.t('ob_wrong'), 3000);
    // highlight2 glows the right block and one other block that is still afloat; with only two blocks in a row (band a, level 1) the wrong one has just sunk, so it glows the right block alone, like show
    const decoy = row.find(p => !p.ok && p !== pad && p.state === 'idle');
    for (const p of hint === 'highlight2' ? [right, decoy] : [right]) if (p) p.hintUntil = now + ms * (hint === 'show' ? 2 : 1) / 1000;
  },
  solve(pad){
    const game = this.game, k = this.state.row; pad.state = 'solved'; this.glowOf(pad, 'ok', 1e9); game.sound.play('pickup');
    game.particles.burst(pad.grp.position.clone().setY(TOP + .6), { color: '#fff6c8', shape: 'star', n: 10, speed: 2.2, up: 2.5 });
    this.state.row = k + 1; this.refreshGoal();
    if (this.state.row >= this.R){ if (!this.rightSent){ this.rightSent = true; this.quest.right({ rows: this.R }); } }      // the shell hears "right" once: when the last row is crossed
    this.extend();
  },
  // the way builds on: the landing after the row, then the next row (or the shore after the last one)
  extend(){
    const game = this.game, k = this.state.row, W = game.world; this.setDock();
    if (k === 1) this.buildSecret();
    if (k < this.R){ this.buildDock(k); for (const p of this.rowPads(k)) this.placePad(p); }
    else this.buildFinish();
    this.setPadMap(); this.showSign(); this.onPad = null; W.dirty = true;
    const at = this.dock.clone().setY(TOP + .4); game.particles.burst(at, { color: '#ffd9a0', n: 14, speed: 2.6, up: 2 }); game.sound.play('place');
    if (k < this.R) this.timers.push(setTimeout(() => { if (!this.state.done && this.state.row === k) this.announceRow(); }, 900)); else game.hud.say(game.t('ob_last'), 4000);
  },
  respawn(quiet){
    const game = this.game, b = game.player.body; if (!quiet){ game.particles.burst(new THREE.Vector3(b.x, .7, b.z), { color: '#bfeaff', n: 16, speed: 3.2, up: 3.5, gravity: 12 }); game.sound.play('pop'); game.hud.say(game.t('ob_fall'), 2500); }
    this.placePlayer(); this.wetT = 0;
  },
  refreshGoal(){ this.game.hud.goal(this.game.t('ob_goal', { n: Math.min(this.state.row, this.R), m: this.R })); },
  finish(){
    const game = this.game, q = this.quest; this.state.done = true;
    const res = q.complete({ extraMet: q.level ? q.level.tries === 0 : false, secretFound: this.secret }); this.state.result = res; this.state.stars = res.stars;
    q.skill(this.band === 'a' ? 'counting' : this.band === 'b' ? 'multiplication' : 'fractions', 'obby'); saveQuest('obby', q); game.sound.play('star');
    game.particles.burst(this.wp(PERIOD * this.R + 1, (this.Wd - 1) / 2, TOP + 1.2), { color: '#ffc94d', shape: 'star', n: 24, speed: 4 });
    game.hud.say(game.t('ob_done', { n: res.stars }) + (res.next != null ? ' · ' + game.t('ob_next') : ' · ' + game.t('ob_all')), 4000);
    if (res.next != null) this.timers.push(setTimeout(() => this.startLevel(res.next), 4200));
  },
  update(game, dt, t){
    this.camRule.update(dt);
    if (!this.ob) return; const P = game.player.body, W = game.world, now = game.roomTime, pl = game.player;
    P.x = Math.max(W.wx(1), Math.min(W.wx(W.N - 2), P.x)); P.z = Math.max(W.wx(1), Math.min(W.wx(W.N - 2), P.z));
    pl.lastSafe = [this.dock.x, this.dock.z]; pl.wetT = 0;                // the engine's own sea rescue would use these: this room puts the player back itself
    if (!this.state.done){
      const stand = P.ground && P.y > .8, [cx, , cz] = W.cellOf(P.x, 0, P.z), pad = stand ? this.padMap.get(cx + ',' + cz) || null : null;
      if (pad !== this.onPad){ this.onPad = pad; if (pad) this.press(pad); }
      if (this.state.row >= this.R && stand){ const [u, v] = this.uvOf(cx, cz); if (u >= PERIOD * this.R + 1 && u <= PERIOD * this.R + 2 && v >= -1 && v <= this.Wd) this.finish(); }
      if (this.acorn && !this.secret && stand && this.state.row >= 1){ const c = this.secretPos(); if (Math.hypot(P.x - c.x, P.z - c.z) < .8){ this.secret = true; this.grp.remove(this.acorn); this.acorn = null; game.hud.say(game.t('ob_acorn'), 2500); game.sound.play('pickup'); this.quest.skill('exploring', 'hidden acorn'); } }
      if (P.y < .55 && P.ground){ this.wetT += dt; if (this.wetT > .3) this.respawn(); } else this.wetT = 0;
    }
    for (const p of this.pads){
      if (!p.grp) continue; const g = p.grp, age = Math.min(1, (now - p.born) / .35);
      if (p.state === 'warn'){ g.rotation.z = Math.sin(t * 45) * .035; g.rotation.x = Math.sin(t * 38) * .03; if (now >= p.sinkAt) this.sink(p); }
      else if (p.state === 'sunk'){ g.position.y -= dt * 2.2; g.rotation.z += dt * .8; if (g.position.y < -1.2){ this.grp.remove(g); p.grp = null; continue; } }
      else g.scale.setScalar(.6 + .4 * age * age * (3 - 2 * age));
      const kind = p.glowKind === 'ok' ? 'ok' : p.state === 'warn' || p.state === 'sunk' ? 'bad' : now < p.hintUntil ? 'hint' : null;
      p.glow.material.color.set(GLOW[kind || 'hint']); p.glow.material.opacity = !kind ? 0 : kind === 'hint' ? .35 + .4 * Math.abs(Math.sin(t * 7)) : kind === 'ok' ? .55 : .45 + .25 * Math.sin(t * 20);
    }
    if (this.sign){ if (this.speaker && this.speaker.scale.x > 1) this.speaker.scale.setScalar(Math.max(1, this.speaker.scale.x - dt * 1.5)); const s = this.sign, age = Math.min(1, (now - s.userData.born) / .3); s.userData.board.rotation.x = -game.cam.pitch * SIGN_LEAN; s.scale.setScalar(.5 + .5 * age * age * (3 - 2 * age)); }
    if (this.acorn){ const a = this.acorn; a.rotation.y = t * 1.8; a.position.y = TOP + .5 + Math.sin(t * 3) * .06; }
    if (this.cloth) this.cloth.rotation.y = Math.sin(t * 4) * .25;
  },
  sink(p){
    const game = this.game, W = game.world; p.state = 'sunk'; p.sunkAt = game.roomTime;
    for (const [u, v] of this.padCells(p)) this.setCell(u, v, 0); W.dirty = true;
    game.particles.burst(p.grp.position.clone().setY(.8), { color: '#bfeaff', n: 18, speed: 3.4, up: 3.2, gravity: 12 }); game.sound.play('land');
  },
  save(){ return {} }
};
