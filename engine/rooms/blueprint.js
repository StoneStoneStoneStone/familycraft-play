// Room: Blueprint quest. Build blocks to match a target plan exactly (glass guide blocks + plan/front cards).
// Pattern for the quest rooms: pure logic in quest/blueprint-logic.js, shell controller from quest/use-shell.js,
// the room only draws, listens on game.bus and reports through the controller.
import * as THREE from 'three';
import { BLOCKS, BLOCK } from '../world/voxel.js';
import { clay } from '../fx/materials.js';
import { TUNING } from '../data/tuning.js';
import { i18n } from '../core/i18n.js';
import { getBand } from './quest/common.js';
import { labelTexture, titleTexture } from './quest/label.js';
import { solveFrame, frameFocus } from './quest/frame.js';
import { startQuest, saveQuest, setQuestBand } from './quest/use-shell.js';
import { makeCameraRule } from './quest/camera-rule.js';
import { makeBandChip } from './quest/band-chip.js';
import { registerKeepClear } from './quest/screen-boxes.js';
import { makeBlueprint, compareBuild } from './quest/blueprint-logic.js';

const COLOR = { brick: '#d9694a', planks: '#e0a458', stone: '#9aa3ab' };
const PLOT = [6, 8];
const TITLE_W = 2.4, TITLE_H = .86;
const CARD_AHEAD = -.3;                    // portrait: the cards stand level with the player (a bit toward the camera), so on screen they sit below the plot, not over its glass          // plan card title board (world units)                       // world cell of plot corner (x, z)
const FREE_MIN = 6;                        // free-build level: blocks needed to finish (default; TUNING.quest.blueprintFree is read at level start)
// base camera view by screen shape. A portrait screen is too narrow for the plot with a card on each side, so there the cards stand
// beside the player (see drawCards) and the camera sits a little farther and higher, turned so the plot is straight ahead
const compact = () => innerHeight < 500 && innerWidth >= innerHeight;      // a phone held sideways: wide and short
const portrait = () => innerWidth < innerHeight || compact();      // the framed arrangement (below) for every screen the desktop one does not suit
// portrait: the camera frames the plot, both cards and the player inside the HUD-free screen area (quest/frame.js), so nothing sits under the HUD.
// compact (landscape phone): straight on, the cards flank the plot (the screen is wide, not tall), so the whole picture is as big as the short screen allows
const viewFor = () => compact() ? { yaw: 0, pitch: .62, dist: 8, port: true, wide: true } : portrait() ? { yaw: .3, pitch: .8, dist: 8, port: true } : { yaw: .6, pitch: .5, dist: 8.5, port: false };

export default {
  id: 'blueprint', persist: false, size: 16, height: 12,
  words: {
    th: { bp_intro: 'ลุงตอก (บีเวอร์ช่างใหญ่) ชวนต่อบล็อกให้เหมือนแผน', bp_goal: 'ตรงแผน {n}%', bp_free_goal: 'ต่อเอง {n}/{m}', bp_top: 'ด้านบน', bp_front: 'ด้านหน้า',
          bp_wrong: 'ก้อนนี้ไม่ตรงแผน ลองดูกระจกใส', bp_done: 'ตรงแผนเป๊ะ เก่งมาก ได้ {n} ดาว', bp_next: 'ไปด่านต่อไป', bp_all: 'ครบทุกด่านแล้ว', bp_free: 'ด่านอิสระ ต่อสิ่งที่ชอบ {m} ก้อน', bp_secret: 'เจอลูกโอ๊กลับ' },
    en: { bp_intro: 'Timber the beaver builder asks you to build it like the plan', bp_goal: 'plan match {n}%', bp_free_goal: 'free build {n}/{m}', bp_top: 'top', bp_front: 'front',
          bp_wrong: 'That block is not in the plan. Follow the glass', bp_done: 'Exactly the plan. Great! {n} stars', bp_next: 'next level', bp_all: 'All levels done', bp_free: 'Free build: place {m} blocks of your own', bp_secret: 'Found the hidden acorn' }
  },
  rules: { build: true, damage: false },
  start: { brick: 64, planks: 64, stone: 64, pickaxe: 1, axe: 1 },
  spawn: [-.5, -1.8],   // the default camera (yaw .6) looks toward +x +z, so the plot sits ahead of the player
  build(game){
    const W = game.world; this.game = game;
    for (let x = 0; x < W.N; x++) for (let z = 0; z < W.N; z++) this.ground(x, z);
    this.ox = PLOT[0]; this.oz = PLOT[1]; this.oy = W.top(this.ox, this.oz);
    let stored = null; try { stored = localStorage.getItem('fc-band'); } catch (e) {}
    this.band = getBand(location.search, stored);
    this.grp = new THREE.Group(); game.scene.add(this.grp); this.guides = []; this.cards = new THREE.Group(); game.scene.add(this.cards);
    this.hintCells = null; this.hintUntil = 0; this.timers = []; this.state = { index: -1, done: false, stars: 0, pct: 0, result: null };
    // the hidden thing for the third star: a little acorn behind the plot
    const acorn = this.acorn = new THREE.Mesh(new THREE.SphereGeometry(.2, 16, 12), clay('#a8742f')); acorn.position.set(W.wx(12), this.oy + .25, W.wx(5)); game.scene.add(acorn);
    this.quest = startQuest(game, { gameId: 'blueprint', band: this.band, levels: (band, i) => { const bp = makeBlueprint(band, i); return { kind: i === 3 ? 'free' : 'goal', target: bp.cells.length, extra: 'clean', bp }; } });
    this.baseView = viewFor();        // landscape: the engine's own third-person view, the plot sits ahead of the player; portrait: farther and higher
    addEventListener('resize', this.onResize = () => { const v = viewFor(); if (this.baseView && (v.port !== this.baseView.port || !!v.wide !== !!this.baseView.wide)){ Object.assign(this.baseView, v); if (this.bp) this.drawCards(); } clearTimeout(this.reframeT); this.reframeT = setTimeout(() => this.frameView(), 250); });
    registerKeepClear(game, () => [...this.cards.children, ...this.guides]);      // the room buttons keep off the plan cards and the glass guides
    this.camRule = makeCameraRule(game, { band: this.band, base: () => this.baseView, focus: (t, c) => this.frame ? frameFocus(this.frame, t, c) : null });
    this.chip = makeBandChip(game, { band: this.band, onPick: b => this.switchBand(b) });
    this.off = [game.bus.on('block_place', e => this.onBlock(e, true)), game.bus.on('block_break', e => this.onBlock(e, false))];
    this.startLevel(0);
  },
  // the island ground of one column (also what a level start puts back: a block set on grass turns it to soil)
  ground(x, z){ const W = this.game.world, d = Math.hypot(x - W.H0, z - W.H0); if (d < 7.4){ W.set(x, 0, z, BLOCK.bedrock); W.set(x, 1, z, d < 6 ? BLOCK.soil : BLOCK.sand); if (d < 6) W.set(x, 2, z, BLOCK.grass); } },
  // the band chip: same room, new band, level 1, nothing left of the old level
  switchBand(b){ this.band = b; setQuestBand(this.quest, b); this.camRule.setBand(b); this.chip.setBand(b); this.startLevel(0); },
  // ---- level lifecycle ----
  startLevel(i){
    const game = this.game, W = game.world, q = this.quest;
    this.timers.forEach(clearTimeout); this.timers = [];
    for (let x = 0; x < 10; x++) for (let y = 0; y < 8; y++) for (let z = 0; z < 10; z++) W.set(this.ox + x, this.oy + y, this.oz + z, 0);      // the whole plot and the air over it, so a band switch leaves nothing of the old level
    for (let x = 0; x < 10; x++) for (let z = 0; z < 10; z++) this.ground(this.ox + x, this.oz + z);
    this.camRule.reset(); q.start(i); this.bp = q.def.bp; this.free = this.bp.free; this.state = { index: i, done: false, stars: 0, pct: 0, result: null };
    this.secret = false; this.acorn.visible = true; this.hintCells = null;
    this.drawGuides(); this.drawCards(); this.frameView(); this.camRule.reset(); if (this.frame) game.cam.inited = false; this.timers.push(setTimeout(() => this.frameView(), 600));      // frame again once the HUD has settled
    this.freeMin = Math.max(1, Math.round(TUNING.quest.blueprintFree) || FREE_MIN); const lang = i18n.lang, goal = this.goalStr = this.free ? game.t('bp_free', { m: this.freeMin }) : this.bp.goalText[lang];
    this.refreshGoal(0);
    if (i === 0){ game.hud.say(game.t('bp_intro'), 3500); this.timers.push(setTimeout(() => game.hud.say(goal), 3600)); } else game.hud.say(goal);
    if (this.band === 'a') this.speak(goal);
  },
  speak(text){
    try { if (typeof speechSynthesis === 'undefined' || typeof SpeechSynthesisUtterance === 'undefined') return;
      speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(text); u.lang = i18n.lang === 'th' ? 'th-TH' : 'en-US'; speechSynthesis.speak(u); } catch (e) {}
  },
  // ---- drawing ----
  drawGuides(){
    const W = this.game.world; this.grp.clear(); this.guides = [];
    if (this.free) return;
    const geo = new THREE.BoxGeometry(.96, .96, .96), edge = new THREE.EdgesGeometry(geo);
    for (const [x, y, z, id] of this.bp.cells){
      const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: COLOR[id], transparent: true, opacity: .15, roughness: .2, depthWrite: false }));
      m.add(new THREE.LineSegments(edge, new THREE.LineBasicMaterial({ color: '#5a3512', transparent: true, opacity: 1 })));
      m.position.set(W.wx(this.ox + x), this.oy + y + .5, W.wx(this.oz + z)); m.userData = { x, y, z, id }; this.grp.add(m); this.guides.push(m);
    }
    // floor markers: faint tile under cells to build on, a grey cross on cells that must stay empty (the hole in a ring)
    const [w, , d] = this.bp.size, full = new Set(this.bp.cells.filter(c => c[1] === 0).map(c => c[0] + ',' + c[2]));
    const hole = new THREE.MeshBasicMaterial({ map: labelTexture('x', { bg: '#cdbd9c', fg: '#7a6a4a' }), transparent: true, opacity: .75 }), tile = new THREE.MeshBasicMaterial({ color: '#ffd21f', transparent: true, opacity: .3 });
    for (let x = 0; x < w; x++) for (let z = 0; z < d; z++){
      const on = full.has(x + ',' + z), m = new THREE.Mesh(new THREE.PlaneGeometry(on ? .9 : .5, on ? .9 : .5), on ? tile : hole);
      m.rotation.x = -Math.PI / 2; m.position.set(W.wx(this.ox + x), this.oy + .03, W.wx(this.oz + z)); this.grp.add(m);
    }
  },
  // portrait only: what has to be in frame (glass guides or the bare plot, both cards with their posts, the player at the spawn), then the camera for it
  frameView(){
    if (!this.bp || !this.baseView || !this.baseView.port){ this.frame = null; return; }
    const W = this.game.world, V = THREE.Vector3, [w, , d] = this.bp.size, items = [];
    for (const g of this.guides) items.push({ p: g.position.clone(), w: 1.35, h: 1.35 });
    for (const [x, z] of [[0, 0], [w, 0], [0, d], [w, d]]) items.push({ p: new V(W.wx(this.ox) - .5 + x, this.oy, W.wx(this.oz) - .5 + z), w: 0, h: 0 });
    for (const c of this.cards.children){ const bx = c.userData.box; items.push({ p: c.position.clone().add(new V(0, bx.cy, 0)), w: bx.w, h: bx.h }, { p: new V(c.position.x, this.oy, c.position.z), w: bx.w, h: 0 }); }
    items.push({ p: new V(this.spawn[0], this.oy + .95, this.spawn[1]), w: 1.1, h: 2.1 });
    const C = new V(); for (const it of items) C.addScaledVector(it.p, 1 / items.length);
    this.frame = solveFrame(this.game.camera, items, this.baseView, C); this.baseView.dist = Math.min(8, this.frame.D);
  },
  drawCards(){
    const game = this.game, W = game.world, [w, h, d] = this.bp.size, TILE = .34; this.cards.clear();
    const cols = new Map(); for (const [x, y, z, id] of this.bp.cells) cols.set(x + ',' + z, (cols.get(x + ',' + z) || 0) + 1);
    const ids = new Map(); this.bp.cells.forEach(c => ids.set(c[0] + ',' + c[1] + ',' + c[2], c[3]));
    // c grows with world x; the card faces the camera, so x is mirrored on the board
    const port = portrait(), wide = compact(), lift = 0, yaw = this.baseView ? this.baseView.yaw : .6;
    const card = (title, cw, ch, cx, cz, tile) => {
      const g = new THREE.Group(), bh = ch * TILE + 1.8 * TILE + .2; g.position.set(cx, this.oy + .3 + lift - .4 * TILE + bh / 2, cz); g.rotation.y = port ? Math.PI + yaw : Math.PI;   // facing the camera
      const back = new THREE.Mesh(new THREE.BoxGeometry(Math.max(cw * TILE + .3, TITLE_W), bh, .08), clay('#7a5632')); back.position.set(0, .4 * TILE, -.06); g.add(back);
      const post = new THREE.Mesh(new THREE.BoxGeometry(.1, .3 + lift, .1), clay('#7a5632')); post.position.y = .4 * TILE - bh / 2 - (.3 + lift) / 2; g.add(post);
      g.userData.keepClear = true; g.userData.box = { cy: .4 * TILE, w: Math.max(cw * TILE + .3, TITLE_W), h: bh };
      // the title: a wide board over the card (a square tile made a long Thai word tiny), at least TITLE_W wide so it reads at phone size
      const tw = Math.max(cw * TILE + .3, TITLE_W), th = TITLE_H, tt = titleTexture(title, tw / th);
      const head = new THREE.Mesh(new THREE.PlaneGeometry(tw, th), new THREE.MeshBasicMaterial({ map: tt.tex })); head.position.y = (ch / 2) * TILE + th / 2 - .02; head.position.z = .02; head.name = 'title'; head.userData.frac = tt.frac; g.add(head);
      for (let r = 0; r < ch; r++) for (let c = 0; c < cw; c++){
        const [text, id] = tile(c, r); const t = new THREE.Mesh(new THREE.PlaneGeometry(TILE * .94, TILE * .94), new THREE.MeshBasicMaterial({ map: labelTexture(text, { bg: id ? COLOR[id] : '#fff8e6', fg: id ? '#fff8e6' : '#b8a88c' }) }));
        t.position.set(-(c - (cw - 1) / 2) * TILE, ((ch - 1) / 2 - r) * TILE - TILE / 2, .01); g.add(t);
      }
      this.cards.add(g);
    };
    // landscape: the plan card right of the plot (nearer the camera than the plot, so no glass guide is drawn over it), the front card left of it.
    // portrait: one on each side of the player, a step toward the plot, across the view (perpendicular to the camera yaw): the screen is too
    // narrow for a card on each side of the plot, and a card behind the plot would sit under the glass guides or the top HUD
    let tp, fp;
    if (wide){ const xc = W.wx(this.ox) - .5 + w / 2, zc = W.wx(this.oz) - .5 + d / 2, off = w / 2 + 1 + Math.max(w * TILE + .3, TITLE_W) / 2; tp = [xc + off, zc]; fp = [xc - off, zc]; }      // yaw 0: screen-left is +x, so the plan card stands left of the plot, the front card right of it
    else if (port){ const sp = this.spawn, ahead = CARD_AHEAD, side = Math.max(w, d) * TILE / 2 + .9, bx = sp[0] + Math.sin(yaw) * ahead, bz = sp[1] + Math.cos(yaw) * ahead;
      tp = [bx + Math.cos(yaw) * side, bz - Math.sin(yaw) * side]; fp = [bx - Math.cos(yaw) * side, bz + Math.sin(yaw) * side]; }      // plan card left, front card right, as in landscape
    else { tp = [Math.min(W.wx(this.ox) + w + 1.8, 4.4), W.wx(this.oz) - .3]; fp = [W.wx(this.ox) - 1.6, W.wx(this.oz) + d + .9]; }
    card(game.t('bp_top'), w, d, tp[0], tp[1],
       (c, r) => { const z = d - 1 - r, n = cols.get(c + ',' + z) || 0, id = ids.get(c + ',0,' + z) || ''; return [this.band === 'a' || !n ? '' : String(n), id]; });
    card(game.t('bp_front'), w, h, fp[0], fp[1], (c, r) => { const y = h - 1 - r; for (let z = 0; z < d; z++){ const id = ids.get(c + ',' + y + ',' + z); if (id) return ['', id]; } return ['', '']; });
  },
  // ---- checking ----
  local(e){ const x = e.x - this.ox, y = e.y - this.oy, z = e.z - this.oz, [w, h, d] = this.bp.size; return x >= 0 && x < w && y >= 0 && y < h + 1 && z >= 0 && z < d ? [x, y, z] : null; },
  getLocal(x, y, z){ const b = this.game.world.get(this.ox + x, this.oy + y, this.oz + z); return b ? BLOCKS[b].id : 0; },
  onBlock(e, placed){
    if (!this.bp || this.state.done) return; const l = this.local(e); if (!l) return;
    if (placed && !e.remote){
      const id = BLOCKS[e.b] ? BLOCKS[e.b].id : null, info = { block: id, x: l[0], y: l[1], z: l[2] };
      const ok = this.free || this.bp.cells.some(c => c[0] === l[0] && c[1] === l[1] && c[2] === l[2] && c[3] === id);
      if (ok) this.quest.right(info); else this.onWrong(this.quest.wrong(info).hint);
    }
    this.check();
  },
  onWrong(hint){
    const game = this.game; game.hud.say(game.t('bp_wrong'), 3000);
    if (hint === 'replay'){ game.hud.say(this.goalStr, 4000); this.speakGoal(); return; }
    const miss = this.guides.filter(m => m.visible); const pick = hint === 'highlight2' ? miss.slice(0, 2) : miss;
    this.hintCells = pick; this.hintUntil = this.game.roomTime + TUNING.quest.peekMs * (hint === 'show' ? 2 : 1) / 1000;
  },
  speakGoal(){ if (this.band === 'a' && !this.free) this.speak(this.bp.goalText[i18n.lang]); },
  check(){
    const game = this.game;
    if (this.free){
      let n = 0; const [w, h, d] = this.bp.size; for (let y = 0; y < h + 1; y++) for (let z = 0; z < d; z++) for (let x = 0; x < w; x++) if (this.getLocal(x, y, z)) n++;
      game.hud.goal(game.t('bp_free_goal', { n: Math.min(n, this.freeMin), m: this.freeMin })); this.state.pct = Math.min(100, Math.round(100 * n / this.freeMin));
      if (n >= this.freeMin) this.finish(); return;
    }
    const r = compareBuild(this.bp, (x, y, z) => this.getLocal(x, y, z)); this.state.pct = r.pct; this.state.cmp = r;
    for (const m of this.guides){ const { x, y, z, id } = m.userData; m.visible = this.getLocal(x, y, z) !== id; }
    this.refreshGoal(r.pct);
    if (r.missing === 0 && r.extra === 0) this.finish();
  },
  refreshGoal(pct){ this.game.hud.goal(this.free ? this.game.t('bp_free_goal', { n: 0, m: this.freeMin }) : this.game.t('bp_goal', { n: pct })); },
  finish(){
    const game = this.game, q = this.quest; this.state.done = true;
    const res = q.complete({ extraMet: q.level ? q.level.tries === 0 : false, secretFound: this.secret }); this.state.result = res; this.state.stars = res.stars;
    saveQuest('blueprint', q);
    game.sound.play('star'); const p = new THREE.Vector3(game.world.wx(this.ox) + this.bp.size[0] / 2, this.oy + 1.5, game.world.wx(this.oz) + this.bp.size[2] / 2);
    game.particles.burst(p, { color: '#ffc94d', shape: 'star', n: 24, speed: 4 });
    game.hud.say(game.t('bp_done', { n: res.stars }) + (res.next != null ? ' · ' + game.t('bp_next') : ' · ' + game.t('bp_all')), 4000);
    if (res.next != null) this.timers.push(setTimeout(() => this.startLevel(res.next), 4200));
  },
  update(game, dt, t){
    this.camRule.update(dt);
    for (const m of this.guides) m.material.opacity = .14 + Math.sin(t * 2 + m.position.x) * .03;
    if (this.hintCells && game.roomTime < this.hintUntil) for (const m of this.hintCells) m.material.opacity = .55 + Math.sin(t * 8) * .3;
    else this.hintCells = null;
    if (this.acorn.visible){ const b = game.player.body; if (Math.hypot(b.x - this.acorn.position.x, b.z - this.acorn.position.z) < 1.1){ this.acorn.visible = false; this.secret = true; game.hud.say(game.t('bp_secret'), 2500); game.sound.play('pickup'); this.quest.skill('exploring', 'hidden acorn'); } }
  },
  save(){ return {}; }
};
