// Room: Code quest. The child builds a program from command tiles (code-panel.js); a small block robot runs it one step at a time
// (TUNING.quest.codeStepMs) on a 5 x 4 board and really places and digs blocks in the world to reach the gold flag.
// Fixed diorama camera, the player is parked (hidden) at the camera target. Pure logic: quest/code-logic.js. Host: Bolt the pangolin inventor (text only).
import * as THREE from 'three';
import { BLOCK } from '../world/voxel.js';
import { clay } from '../fx/materials.js';
import { TUNING } from '../data/tuning.js';
import { i18n } from '../core/i18n.js';
import { getBand } from './quest/common.js';
import { startQuest, saveQuest, setQuestBand } from './quest/use-shell.js';
import { makeCameraRule } from './quest/camera-rule.js';
import { makeBandChip } from './quest/band-chip.js';
import { registerKeepClear } from './quest/screen-boxes.js';
import { makeCodeLevel, runProgram, levelPassed, hintFor, validateProgram } from './quest/code-logic.js';
import { createCodePanel } from './quest/code-panel.js';
import { watchHint } from './quest/frame.js';

const BX = 5, BZ = 6, FL = 3;                    // board corner cell (x, z) and the height of the floor top (the floor block is y = 2)
const GW = 5, GD = 4;                            // board cells: 5 wide (x), 4 deep (z)
const PARK_Y = FL + 1.4;                         // the parked player hovers here; the follow camera aims one block above it
const BRICK = 'brick';

export default {
  id: 'code', persist: false, size: 16, height: 12,
  words: {
    th: { cd_intro: 'โบลต์ (ตัวนิ่มนักประดิษฐ์) ชวนเขียนโปรแกรมสั่งหุ่นยนต์', cd_goal: 'ถึงธง {n}/1', cd_goal_build: 'วางบล็อก {n}/{m}', cd_goal_free: 'วางบล็อก {n}/{m}',
          cd_run: 'เริ่ม', cd_reset: 'เริ่มใหม่', cd_f: 'เดินหน้า', cd_l: 'เลี้ยวซ้าย', cd_r: 'เลี้ยวขวา', cd_place: 'วางบล็อก', cd_dig: 'ขุด', cd_loop: 'ทำซ้ำ', cd_if: 'ถ้าชน', cd_yes: 'ถ้าชน ทำนี้', cd_no: 'ไม่ชน ทำนี้',
          cd_count: 'ซ้ำ {n} ครั้ง', cd_slot: 'ช่องว่าง', cd_tiles: 'ปุ่มคำสั่ง', cd_program: 'โปรแกรมของเรา',
          cd_empty: 'แตะปุ่มคำสั่งเพื่อต่อโปรแกรมก่อนนะ', cd_full: 'โปรแกรมเต็มแล้ว ลองให้สั้นลง', cd_bump: 'หุ่นยนต์ชนเข้าแล้ว ดูช่องที่ชน', cd_short: 'ยังไม่ถึงเป้าหมาย ลองดูคำสั่งอีกครั้ง', cd_steps: 'ทำซ้ำเยอะเกินไป ลองน้อยลง',
          cd_secret: 'เจอน็อตทองลับ', cd_done: 'โปรแกรมทำงานได้ เก่งมาก ได้ {n} ดาว', cd_next: 'ไปด่านต่อไป', cd_all: 'ครบทุกด่านแล้ว' },
    en: { cd_intro: 'Bolt the pangolin inventor asks you to program the robot', cd_goal: 'reach the flag {n}/1', cd_goal_build: 'blocks placed {n}/{m}', cd_goal_free: 'blocks placed {n}/{m}',
          cd_run: 'Run', cd_reset: 'Reset', cd_f: 'walk', cd_l: 'turn left', cd_r: 'turn right', cd_place: 'place a block', cd_dig: 'dig', cd_loop: 'repeat', cd_if: 'if blocked', cd_yes: 'if blocked, do this', cd_no: 'if not, do this',
          cd_count: 'repeat {n} times', cd_slot: 'empty slot', cd_tiles: 'command tiles', cd_program: 'our program',
          cd_empty: 'Tap the command tiles to build a program first', cd_full: 'The program is full. Try a shorter one', cd_bump: 'The robot bumped. Look at the square it hit', cd_short: 'Not there yet. Look at the commands again', cd_steps: 'Too many repeats. Try fewer',
          cd_secret: 'Found the hidden golden bolt', cd_done: 'The program works! Great job. {n} stars', cd_next: 'next level', cd_all: 'All levels done' }
  },
  rules: { build: false, damage: false },
  start: {},
  spawn: [-.5, 0],         // the middle of the board; the player is parked at the camera target every frame and hidden
  build(game){
    this.game = game; const W = game.world; let stored = null; try { stored = localStorage.getItem('fc-band'); } catch (e) {}
    this.band = getBand(location.search, stored);
    for (let x = 0; x < W.N; x++) for (let z = 0; z < W.N; z++){ const d = Math.hypot(x - W.H0, z - W.H0); if (d < 7.4){ W.set(x, 0, z, BLOCK.bedrock); W.set(x, 1, z, BLOCK.soil); W.set(x, 2, z, d < 6.2 ? BLOCK.grass : BLOCK.sand); } }
    for (let x = BX - 1; x <= BX + GW; x++) for (let z = BZ - 1; z <= BZ + GD; z++) W.set(x, 2, z, BLOCK.planks);                 // a flat wooden frame round the board
    this.grp = new THREE.Group(); game.scene.add(this.grp); this.timers = []; this.water = new Map(); this.pulses = [];
    this.robot = this.makeRobot(); game.scene.add(this.robot.root); this.flag = this.makeFlag(); game.scene.add(this.flag); this.bolt = this.makeBolt(); game.scene.add(this.bolt);
    this.gridLines = this.makeGrid(); game.scene.add(this.gridLines);
    this.state = { index: -1, done: false, stars: 0, running: false, runs: 0, result: null };
    this.quest = startQuest(game, { gameId: 'code', band: this.band, levels: (band, i) => ({ kind: i === 3 ? 'free' : 'goal', target: 1, extra: 'clean', level: makeCodeLevel(band, i, { freeCount: TUNING.quest['codeFree' + String(band).toUpperCase()] }) }) });
    this.panel = this.makePanel();
    this.baseView = { yaw: Math.PI, pitch: .9, dist: 14 };        // replaced by the framed view of every level
    registerKeepClear(game, () => [this.flag]);      // the room buttons keep off the goal flag
    this.camRule = makeCameraRule(game, { band: this.band, base: () => this.baseView });
    this.chip = makeBandChip(game, { band: this.band, onPick: b => this.switchBand(b) });
    addEventListener('resize', this.onResize = () => { if (this.lv) this.frame(); }); addEventListener('pagehide', this.pageHide = () => { this.panel.destroy(); }); watchHint(() => { if (this.lv) this.frame(); });
    this.startLevel(0);
  },
  // the program panel is built for a band (the tiles it offers), so a band switch builds a new one
  makePanel(){
    const game = this.game, p = createCodePanel({ band: this.band, t: (k, v) => game.t(k, v), maxCmds: 8, maxLoop: () => TUNING.quest.codeMaxLoop, onRun: () => this.startRun(), onReset: () => this.reset(), onChange: () => this.onProgramChange() });
    p.onEdit(k => { if (k === 'full') game.hud.say(game.t('cd_full'), 2500); }); return p;
  },
  // ---- the robot: a few clay boxes, no character model ----
  makeRobot(){
    const root = new THREE.Group(), body = new THREE.Group(); root.add(body); root.scale.setScalar(1.15);
    const M = { b: clay('#ea7658'), w: clay('#fff3df'), d: clay('#5a3414'), g: clay('#ffd21f', { emissive: '#ffb000', emissiveIntensity: .3 }), v: new THREE.MeshStandardMaterial({ color: '#233a5a', roughness: .35 }), e: new THREE.MeshBasicMaterial({ color: '#7be7f5' }) };
    const box = (w, h, d, m, x, y, z, p = body) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); o.castShadow = true; p.add(o); return o; };
    box(.66, .14, .78, M.d, 0, .09, 0); box(.2, .12, .8, M.d, -.36, .11, 0); box(.2, .12, .8, M.d, .36, .11, 0);        // treads
    box(.56, .38, .5, M.b, 0, .4, 0);                                                                                      // torso
    box(.34, .12, .02, M.g, 0, .42, .26);                                                                                  // chest plate
    const head = new THREE.Group(); head.position.set(0, .8, .02); body.add(head);
    box(.5, .34, .44, M.w, 0, 0, 0, head); box(.42, .17, .05, M.v, 0, .02, .23, head); box(.08, .08, .03, M.e, -.1, .02, .26, head); box(.08, .08, .03, M.e, .1, .02, .26, head);
    box(.05, .2, .05, M.d, .13, .26, 0, head); box(.11, .11, .11, M.g, .13, .39, 0, head);                                // antenna
    const hand = new THREE.Group(); hand.position.set(0, .34, .3); body.add(hand);                                         // the hand that places and digs
    box(.12, .12, .34, M.b, -.34, .46, .1); box(.12, .12, .34, M.b, .34, .46, .1);                                         // arms
    box(.3, .1, .22, M.g, 0, 0, .1, hand); box(.1, .1, .12, M.d, 0, 0, .24, hand);
    return { root, body, head, hand, base: root.position };
  },
  makeGrid(){       // thin lines between the board cells, so every square reads
    const W = this.game.world, pts = [], x0 = W.wx(BX) - .5, z0 = W.wx(BZ) - .5, y = FL + .015;
    for (let i = 0; i <= GW; i++) pts.push(x0 + i, y, z0, x0 + i, y, z0 + GD); for (let j = 0; j <= GD; j++) pts.push(x0, y, z0 + j, x0 + GW, y, z0 + j);
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    return new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: '#8a5a2b', transparent: true, opacity: .5 }));
  },
  makeFlag(){
    const g = new THREE.Group(), pole = new THREE.Mesh(new THREE.BoxGeometry(.07, 1.05, .07), clay('#7a5632')); pole.position.y = .52; g.add(pole);
    const cloth = this.cloth = new THREE.Mesh(new THREE.BoxGeometry(.5, .32, .04), clay('#ffd21f', { emissive: '#ffb000', emissiveIntensity: .45 })); cloth.position.set(.27, .9, 0); g.add(cloth);
    const tile = new THREE.Mesh(new THREE.PlaneGeometry(.92, .92), new THREE.MeshBasicMaterial({ color: '#ffd21f', transparent: true, opacity: .45, depthWrite: false })); tile.rotation.x = -Math.PI / 2; tile.position.y = .03; g.add(tile);
    return g;
  },
  makeBolt(){       // the hidden golden bolt (third star): a hex nut on a floor cell off the shortest way
    const g = new THREE.Group(), inner = new THREE.Group(), m = clay('#ffd21f', { emissive: '#ffb000', emissiveIntensity: .5 }), nut = new THREE.Mesh(new THREE.CylinderGeometry(.22, .22, .14, 6), m); inner.add(nut);
    const hole = new THREE.Mesh(new THREE.CylinderGeometry(.09, .09, .16, 10), clay('#5a3414')); inner.add(hole); g.add(inner); g.userData.inner = inner; g.rotation.x = .45; return g;
  },
  // ---- geometry: board cell (x, z) <-> world ----
  wp(x, z){ const W = this.game.world; return new THREE.Vector3(W.wx(BX + x), FL, W.wx(BZ + z)); },
  paint(rows){
    const W = this.game.world;
    for (let z = 0; z < GD; z++) for (let x = 0; x < GW; x++){
      const X = BX + x, Z = BZ + z, c = rows[z][x];
      if (c === '~'){ W.set(X, 3, Z, 0); W.set(X, 2, Z, 0); W.set(X, 1, Z, 0); }
      else { W.set(X, 1, Z, BLOCK.soil); W.set(X, 2, Z, BLOCK.sand); W.set(X, 3, Z, c === '#' ? BLOCK.stone : 0); }
    }
  },
  // the band chip: same room, new band, level 1, nothing left of the old level
  switchBand(b){ this.band = b; setQuestBand(this.quest, b); this.camRule.setBand(b); this.chip.setBand(b); this.panel.destroy(); this.panel = this.makePanel(); this.startLevel(0); },
  // ---- level lifecycle ----
  startLevel(i){
    const game = this.game, q = this.quest;
    this.timers.forEach(clearTimeout); this.timers = []; this.run = null; this.panel.lock(false);
    q.start(i); this.lv = q.def.level; this.free = this.lv.free; this.secret = false; this.dirty = false; this.lastRes = null;
    this.state = { index: i, done: false, stars: 0, running: false, runs: 0, result: null, placed: 0 };
    this.panel.clear(); this.panel.setMax(this.lv.maxCmds); this.draw(); this.frame(); this.refreshGoal(0);
    const goal = this.goalStr = this.lv.goalText[i18n.lang];
    if (i === 0){ game.hud.say(game.t('cd_intro'), 4500); this.timers.push(setTimeout(() => game.hud.say(goal), 4600)); } else game.hud.say(goal);
    if (this.band === 'a') this.speak(goal);
  },
  speak(text){
    try { if (typeof speechSynthesis === 'undefined' || typeof SpeechSynthesisUtterance === 'undefined') return;
      speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(text); u.lang = i18n.lang === 'th' ? 'th-TH' : 'en-US'; speechSynthesis.speak(u); } catch (e) {}
  },
  // the world and the overlay marks for the start of the level (also what Reset and a new run go back to)
  draw(){
    const lv = this.lv; this.cur = lv.grid.slice(); this.paint(lv.grid); this.grp.clear(); this.water.clear(); this.pulses = [];
    const wm = new THREE.MeshBasicMaterial({ color: '#2f9fd6', transparent: true, opacity: .78, depthWrite: false });
    lv.grid.forEach((row, z) => [...row].forEach((c, x) => { if (c !== '~') return; const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), wm); m.rotation.x = -Math.PI / 2; const p = this.wp(x, z); m.position.set(p.x, FL - .35, p.z); this.grp.add(m); this.water.set(x + ',' + z, m); }));
    const gold = new THREE.MeshBasicMaterial({ color: '#ffd21f', transparent: true, opacity: .5, depthWrite: false });
    for (const [x, z] of lv.need.placeAt || []){ const m = new THREE.Mesh(new THREE.PlaneGeometry(.86, .86), gold); m.rotation.x = -Math.PI / 2; const p = this.wp(x, z); m.position.set(p.x, FL + .03, p.z); this.grp.add(m); }
    this.flag.visible = !!lv.goal; if (lv.goal){ const p = this.wp(lv.goal[0], lv.goal[1]); this.flag.position.set(p.x, FL, p.z); }
    this.secretCell = lv.secret; this.bolt.visible = !!lv.secret && !this.secret; if (lv.secret){ const p = this.wp(lv.secret[0], lv.secret[1]); this.bolt.position.set(p.x, FL + .3, p.z); }
    this.rs = { x: lv.start.x, z: lv.start.z, ang: this.angOf(lv.start.dir), bump: 0, act: 0, kind: '' }; this.placeRobot();
  },
  angOf(dir){ const d = [[0, -1], [1, 0], [0, 1], [-1, 0]][dir]; return Math.atan2(d[0], d[1]); },
  placeRobot(){ const p = this.wp(this.rs.x, this.rs.z), r = this.robot; r.root.position.set(p.x, FL, p.z); r.root.rotation.y = this.rs.ang; },
  // The diorama camera: fixed yaw and pitch, then the closest distance (and the camera target, by moving the parked player) at which the
  // whole board, the robot and the flag sit inside the free area between the HUD and this room's panels.
  freeRect(portrait){
    const box = id => { const e = document.getElementById(id); if (!e) return null; const r = e.getBoundingClientRect(); return r.width ? r : null; };
    const hint = box('hint'), top = Math.max(hint ? hint.top + Math.max(hint.height, 62) + 6 : 0, portrait ? 156 : 72);      // the goal banner is not up yet when the level frames: always leave its room
    if (portrait){ const w = box('cdWrap'); return { l: 10, r: innerWidth - 10, t: top, b: (w ? w.top : innerHeight * .55) - 14 }; }      // 14: the badge on the program frame hangs above it
    const pal = box('cdPal'), prog = box('cdProg'), bar = box('bar'), btns = box('cdBtns'), row = btns && document.getElementById('cdBtns').classList.contains('row'), lcol = Math.max(pal ? pal.right : 250, btns && !row && btns.left < 300 ? btns.right : 0);
    return { l: lcol + 10, r: (prog ? prog.left : innerWidth - 290) - 10, t: top, b: Math.min((bar ? bar.top : innerHeight - 90) - 8, row ? btns.top - 8 : 1e9) };      // row: Run / Reset under the board (640 wide)
  },
  // Searches pitch and distance for the largest board that fits the free area (target moved by the parked player); returns { d, pitch, T, fit }.
  fitBoard(rect, pitches){
    const game = this.game, W = game.world, cam = game.camera, V = THREE.Vector3, TY = PARK_Y + 1, cx = W.wx(BX + (GW - 1) / 2), cz = W.wx(BZ + (GD - 1) / 2);
    const tmp = this.tmpCam || (this.tmpCam = new THREE.PerspectiveCamera()); tmp.fov = cam.fov; tmp.aspect = cam.aspect; tmp.near = cam.near; tmp.far = cam.far; tmp.updateProjectionMatrix();
    const proj = (pitch, T, d, p) => { tmp.position.set(T.x, T.y + Math.sin(pitch) * d, T.z + Math.cos(pitch) * d); tmp.lookAt(T); tmp.updateMatrixWorld(true); const v = p.clone().project(tmp); return [(v.x + 1) / 2 * innerWidth, (1 - v.y) / 2 * innerHeight]; };
    const mid = new V(cx, FL, cz), hw = GW / 2, hd = GD / 2, pts = [];
    for (const sx of [-1, 1]) for (const sz of [-1, 1]){ pts.push(new V(cx + sx * hw, FL, cz + sz * hd)); if (sz < 0) pts.push(new V(cx + sx * (hw - .3), FL + 1.3, cz + sz * (hd - .3))); }      // the floor corners, and the height of a flag or robot on the far row
    const want = [(rect.l + rect.r) / 2, (rect.t + rect.b) / 2], cands = []; let fallback = null;
    for (const pitch of pitches){
      let hit = null;
      for (let d = 5; d <= 16.001 && !hit; d += .25){
        const T = new V(cx, TY, cz);
        for (let k = 0; k < 8; k++){ const a = proj(pitch, T, d, mid), bx = proj(pitch, T.clone().add(new V(.1, 0, 0)), d, mid), bz = proj(pitch, T.clone().add(new V(0, 0, .1)), d, mid);
          T.x += (want[0] - a[0]) / ((bx[0] - a[0]) / .1 || -1); T.z += (want[1] - a[1]) / ((bz[1] - a[1]) / .1 || -1); }
        const q = pts.map(p => proj(pitch, T, d, p)), inside = q.every(p => p[0] > rect.l + 4 && p[0] < rect.r - 4 && p[1] > rect.t + 4 && p[1] < rect.b - 4);
        if (inside) hit = { d, pitch, T, fit: true, score: Math.abs(q[5][0] - q[2][0]) };
        else if (d >= 16 && !fallback) fallback = { d: 16, pitch, T, fit: false, score: 0 };
      }
      if (hit) cands.push(hit);
    }
    if (!cands.length) return fallback;
    const top = Math.max(...cands.map(c => c.score));
    return cands.find(c => c.score >= top * .85);       // the steepest pitch that is nearly as big as the best one
  },
  // do this room's panels (palette, program, Run/Reset) clear every HUD element?
  panelsClear(){
    const r = id => { const e = document.getElementById(id); if (!e) return null; const q = e.getBoundingClientRect(); return q.width && q.height ? q : null; };
    const mine = ['cdPal', 'cdProg', 'cdRun', 'cdReset'].map(r).filter(Boolean), hud = ['pcard', 'stars', 'gear', 'bView', 'bar', 'joy', 'hint'].map(r).concat([...document.querySelectorAll('#act .btn')].map(e => e.getBoundingClientRect())).filter(Boolean);
    const hit = (a, b) => !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom);
    return !mine.some(m => hud.some(h => hit(m, h)));
  },
  frame(){
    const game = this.game, portrait = innerHeight > innerWidth, pitches = portrait ? [.85, .7, .55, .45, .35] : [.95, .8, .65, .5], want = portrait ? 170 : 200; let pick = null;
    const cfgs = []; for (const level of [0, 1]) for (const tile of [56, 52, 48, 44]) cfgs.push([level, tile]); for (const tile of [52, 48, 44]) cfgs.push([2, tile]);       // the panels shrink (largest tile that fits first, then single rows, then tight) before the board is clipped or left tiny
    for (const [level, tile] of cfgs){
      this.panel.layout(level, tile); if (!this.panelsClear()) continue; const b = this.fitBoard(this.freeRect(portrait), pitches);
      if (b && b.fit && b.score >= want){ pick = { ...b, level, tile }; break; }
      if (b && b.fit && (!pick || b.score > pick.score)) pick = { ...b, level, tile };
    }
    if (!pick){ this.panel.layout(2, 44); pick = { ...this.fitBoard(this.freeRect(portrait), pitches), level: 2, tile: 44 }; }
    else this.panel.layout(pick.level, pick.tile);
    this.layoutLevel = pick.level; this.fitted = !!pick.fit;
    this.baseView = { yaw: Math.PI, pitch: pick.pitch, dist: pick.d }; this.camRule.reset(); game.cam.cur = pick.d; game.cam.inited = false; this.park = { x: pick.T.x, z: pick.T.z };
  },
  // ---- running a program ----
  onProgramChange(){ if (this.dirty && !this.run) this.reset(true); else this.panel.clearHints(); },
  reset(keepProgram){
    if (this.state.done) return; this.run = null; this.panel.lock(false); this.panel.setActive(null); this.dirty = false; this.draw(); this.panel.clearHints();
    this.state.running = false; if (!keepProgram) this.panel.clear(); this.refreshGoal(0);
  },
  startRun(){
    const game = this.game; if (this.run || this.state.done) return;
    const prog = this.panel.getProgram(); if (!prog.length){ game.hud.say(game.t('cd_empty'), 3000); game.sound.play('no'); return; }
    const v = validateProgram(prog, this.band, this.lv.maxCmds); if (!v.ok){ game.hud.say(game.t('cd_full'), 3000); return; }
    this.draw(); this.panel.clearHints(); this.panel.lock(true); this.dirty = true; this.state.running = true; this.state.runs++;
    const res = runProgram(this.lv.grid, this.lv.start, prog, TUNING.quest.codeMaxSteps); this.lastRes = res; this.lastProg = prog;
    this.run = { res, prog, i: 1, t: 0, applied: false, begun: false };
    game.sound.play('pop');
  },
  stepMs(){ return Math.max(40, TUNING.quest.codeStepMs); },
  // the world part of one step (called halfway through it)
  effect(e){
    const game = this.game, W = game.world; if (!e.cell || e.did === 'none') return; const [cx, cz] = e.cell, X = BX + cx, Z = BZ + cz, key = cx + ',' + cz, p = this.wp(cx, cz);
    if (e.did === 'place'){
      if (this.cur[cz][cx] === '~'){ W.set(X, 2, Z, BLOCK[BRICK]); const w = this.water.get(key); if (w){ this.grp.remove(w); this.water.delete(key); } this.cur[cz] = this.cur[cz].slice(0, cx) + '.' + this.cur[cz].slice(cx + 1); }
      else { W.set(X, FL, Z, BLOCK[BRICK]); this.cur[cz] = this.cur[cz].slice(0, cx) + '#' + this.cur[cz].slice(cx + 1); }
      game.sound.play('place'); game.particles.burst(p.clone().setY(FL + .5), { color: '#f0a07a', n: 8, speed: 2, up: 2 });
    } else if (e.did === 'dig'){
      W.set(X, FL, Z, 0); this.cur[cz] = this.cur[cz].slice(0, cx) + '.' + this.cur[cz].slice(cx + 1);
      game.sound.play('dig'); game.particles.burst(p.clone().setY(FL + .5), { color: '#b6bcc2', n: 12, speed: 2.5, up: 2 });
    }
  },
  // a pulsing square on a board cell; a cell off the board (the robot hit the edge) lights the robot's own square instead
  pulseCell(cell, color = '#e0524a', secs = 4, from = null){
    if (cell && (cell[0] < 0 || cell[0] >= GW || cell[1] < 0 || cell[1] >= GD)) cell = from; if (!cell) return; const p = this.wp(cell[0], cell[1]);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(.94, .94), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .6, depthWrite: false })); m.rotation.x = -Math.PI / 2; m.position.set(p.x, FL + .05, p.z); this.grp.add(m);
    this.pulses.push({ m, until: this.game.roomTime + secs });
  },
  stepRun(dt){
    const r = this.run, res = r.res, ms = this.stepMs() / 1000;
    if (r.i >= res.path.length){ this.endRun(); return; }
    const e = res.path[r.i], p = res.path[r.i - 1];
    if (!r.begun){ r.begun = true; this.panel.setActive(e.at); }
    r.t += dt; const k = Math.min(1, r.t / ms), s = this.rs, ease = k * k * (3 - 2 * k);
    s.kind = e.cmd; s.act = 0; s.bump = 0;
    if (e.cmd === 'F' && !e.bump){ s.x = p.x + (e.x - p.x) * ease; s.z = p.z + (e.z - p.z) * ease; }
    else { s.x = p.x; s.z = p.z; }
    if (e.cmd === 'L' || e.cmd === 'R'){ const a0 = this.angOf(p.dir); let a1 = this.angOf(e.dir), d = a1 - a0; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; s.ang = a0 + d * ease; }
    else s.ang = this.angOf(p.dir);
    if (e.cmd === 'PLACE' || e.cmd === 'DIG') s.act = Math.sin(k * Math.PI);
    if (e.bump) s.bump = Math.sin(k * Math.PI);
    if (!r.applied && k >= .5){ r.applied = true; if (e.bump){ this.game.sound.play('no'); this.pulseCell(e.bump, '#e0524a', 4, [e.x, e.z]); } else this.effect(e); }
    if (k >= 1){
      s.x = e.x; s.z = e.z; s.ang = this.angOf(e.dir); r.i++; r.t = 0; r.applied = false; r.begun = false; s.act = 0; s.bump = 0;
      if (e.cmd === 'F' && !e.bump) this.game.sound.play('step');
      if (this.lv.secret && !this.secret && e.x === this.lv.secret[0] && e.z === this.lv.secret[1]){ this.secret = true; this.bolt.visible = false; this.game.hud.say(this.game.t('cd_secret'), 2500); this.game.sound.play('pickup'); this.quest.skill('exploring', 'hidden bolt'); }
    }
  },
  endRun(){
    const game = this.game, res = this.run.res, prog = this.run.prog; this.run = null; this.panel.setActive(null); this.state.running = false; this.panel.lock(false);
    const placedN = new Set(res.placed.map(c => c.join())).size, ok = levelPassed(this.lv, res);
    this.refreshGoal(this.lv.goal ? (res.reached ? 1 : 0) : this.free ? placedN : (this.lv.need.placeAt || []).filter(c => res.placed.some(p => p[0] === c[0] && p[1] === c[1])).length);
    if (ok){ this.quest.right({ steps: res.path.length - 1, cmds: prog.length }); this.finish(res, prog); return; }
    const hint = this.quest.wrong({ error: res.error, steps: res.path.length - 1 }).hint; this.onWrong(hint, res, prog);
  },
  onWrong(hint, res, prog){
    const game = this.game, h = hintFor(this.lv, prog, res), until = 4, msg = game.t(res.error === 'bump' ? 'cd_bump' : res.error === 'steps' ? 'cd_steps' : 'cd_short');
    game.sound.play('no'); this.lastHint = hint;
    if (hint === 'replay'){ game.hud.say(msg + ' · ' + this.lv.hint[i18n.lang], 5000); if (this.band === 'a') this.speak(this.goalStr); return; }
    game.hud.say(msg, 3500); if (h.bumpCell){ const last = res.path[res.path.length - 1]; this.pulseCell(h.bumpCell, '#e0524a', until, [last.x, last.z]); }
    this.panel.mark(h.wrongAt || h.bumpAt, 'bad');
    if (hint === 'show' && h.next){ this.panel.showNext(h.next); }
  },
  refreshGoal(n){
    const lv = this.lv, game = this.game; if (!lv) return;
    if (this.free) game.hud.goal(game.t('cd_goal_free', { n, m: lv.need.count }));
    else if (lv.goal) game.hud.goal(game.t('cd_goal', { n }));
    else game.hud.goal(game.t('cd_goal_build', { n, m: (lv.need.placeAt || []).length }));
  },
  finish(res, prog){
    const game = this.game, q = this.quest; this.state.done = true; this.panel.lock(true);
    const usesLoop = JSON.stringify(prog).includes('"loop"'), usesIf = JSON.stringify(prog).includes('"if"'); if (usesLoop) q.skill('repeating', 'loop'); if (usesIf) q.skill('conditions', 'if blocked');
    const out = q.complete({ extraMet: q.level ? q.level.tries === 0 : false, secretFound: this.secret }); this.state.result = out; this.state.stars = out.stars;
    saveQuest('code', q); game.sound.play('star');
    const at = this.lv.goal ? this.wp(this.lv.goal[0], this.lv.goal[1]) : this.wp(2, 1); game.particles.burst(at.clone().setY(FL + 1), { color: '#ffc94d', shape: 'star', n: 24, speed: 4 });
    game.hud.say(game.t('cd_done', { n: out.stars }) + (out.next != null ? ' · ' + game.t('cd_next') : ' · ' + game.t('cd_all')), 4000);
    if (out.next != null) this.timers.push(setTimeout(() => this.startLevel(out.next), 4200));
  },
  update(game, dt, t){
    this.camRule.update(dt);
    if (!this.lv) return; const P = game.player.body, pl = game.player;
    P.x = this.park.x; P.z = this.park.z; P.y = PARK_Y; P.vy = 0; P.peak = P.y; pl.root.visible = false; if (pl.shadow) pl.shadow.visible = false;      // the camera target: parked above the board, out of sight
    if (this.run) this.stepRun(dt);
    const s = this.rs, r = this.robot, p = this.wp(s.x, s.z);
    r.root.position.set(p.x, FL, p.z); r.root.rotation.y = s.ang;
    const moving = this.run && s.kind === 'F' && !s.bump; r.body.position.y = moving ? Math.abs(Math.sin(t * 14)) * .05 : Math.sin(t * 2) * .012;
    r.body.position.z = s.bump ? Math.sin(s.bump * Math.PI) * .12 : 0; r.body.rotation.z = s.bump ? Math.sin(t * 60) * .08 * s.bump : 0;
    r.hand.position.set(0, .34 - s.act * .22, .3 + s.act * .12); r.hand.rotation.x = s.kind === 'DIG' ? Math.sin(s.act * Math.PI * 2) * .6 : s.act * .5; r.head.rotation.y = this.run ? 0 : Math.sin(t * 1.3) * .12;
    this.cloth.rotation.y = Math.sin(t * 4) * .25; this.cloth.position.x = .27 + Math.sin(t * 4) * .02;
    if (this.bolt.visible){ this.bolt.userData.inner.rotation.y = t * 1.8; this.bolt.position.y = FL + .34 + Math.sin(t * 3) * .05; }
    this.pulses = this.pulses.filter(h => { if (game.roomTime < h.until){ h.m.material.opacity = .35 + .3 * Math.abs(Math.sin(t * 7)); return true; } this.grp.remove(h.m); return false; });
  },
  save(){ return {} }
};
