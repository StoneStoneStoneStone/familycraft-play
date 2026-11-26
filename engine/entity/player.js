// The player: movement, aiming at blocks, digging (hold), using the held item (place / eat), fighting,
// hearts and damage. Rooms can change the rules through `game.rules` (build, damage).
//
// Aiming: the block under the mouse (desktop), the block at the screen centre (first person), the block
// the player tapped (phones), or else the block just in front of the feet. Reach is 4.5 blocks.
import { mobColor } from './things.js';
import { TUNING } from '../data/tuning.js';
import * as THREE from 'three';
import { Body, SEA } from '../physics/body.js';
import { ITEMS } from '../items/items.js';
import { BLOCKS, BLOCK } from '../world/voxel.js';
import { angDiff } from '../core/core.js';

const REACH = 4.5, ray = new THREE.Raycaster(), v2 = new THREE.Vector2();

export class Player {
  constructor(game){
    this.g = game; this.body = new Body({ r: .28, h: 1.2 }); this.face = 0; this.phase = 0; this.speed = 0; this.action = null;
    this.hp = this.maxHp = TUNING.player.hp; this.sp = this.maxSp = TUNING.player.stamina; this.sitting = false; this.restT = 0; this.safe = 0; this.wetT = 0; this.lastSafe = [0, 0]; this.stepT = 0;
    this.target = null; this.tapped = null; this.mining = false; this.mineT = 0; this.mineKey = ''; this.swingT = 0; this.swing = 0;
    this.root = new THREE.Group(); game.scene.add(this.root); this.model = null; this.avatar = null;
    this.shadow = new THREE.Mesh(new THREE.CircleGeometry(.42, 20), new THREE.MeshBasicMaterial({ color: '#3a2a1a', transparent: true, opacity: .22, depthWrite: false })); this.shadow.rotation.x = -Math.PI / 2; game.scene.add(this.shadow);
    this.cursor = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1.01, 1.01, 1.01)), new THREE.LineBasicMaterial({ color: '#1b1208', transparent: true, opacity: .75 })); this.cursor.visible = false; game.scene.add(this.cursor);
    this.crackTex = cracks(); this.crack = new THREE.Mesh(new THREE.BoxGeometry(1.012, 1.012, 1.012), new THREE.MeshBasicMaterial({ map: this.crackTex[0], transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 })); this.crack.visible = false; game.scene.add(this.crack);
  }
  setModel(m, def){ if (this.model) this.root.remove(this.model); this.model = m; this.avatar = def; if (m){ this.root.add(m); this.body.h = def.size * .95; } }
  spawn(x, z){ const W = this.g.world, [cx, , cz] = W.cellOf(x, 0, z); this.body.x = x; this.body.z = z; this.body.y = W.top(cx, cz) + .01; this.body.vy = 0; this.body.peak = this.body.y; this.lastSafe = [x, z]; }
  eye(){ return new THREE.Vector3(this.body.x, this.body.y + this.body.h * .85, this.body.z); }
  // reach is counted in cells around the body: 1 = the ring of blocks touching the player, in every direction,
  // from one below the feet to one above the head. Items may set `reach` (cells) later; default 1 (user, 2026-11-22).
  inReach(t){ if (!t) return false; const W = this.g.world, b = this.body, R = this.g.inv.item.reach || 1,
    [cx, cy, cz] = W.cellOf(b.x, b.y + .05, b.z), top = W.cellOf(b.x, b.y + b.h - .05, b.z)[1];
    return Math.abs(t.x - cx) <= R && Math.abs(t.z - cz) <= R && t.y >= cy - R && t.y <= top + R; }

  aim(){
    const g = this.g, W = g.world, inp = g.input, cam = g.camera; let t = null;
    if (g.cam.mode === 'first'){ ray.setFromCamera(v2.set(0, 0), cam); t = W.raycast(ray.ray.origin, ray.ray.direction, REACH + 1); }
    else if (inp.hover){ ray.setFromCamera(v2.set(inp.hover.x / innerWidth * 2 - 1, -inp.hover.y / innerHeight * 2 + 1), cam); t = W.raycast(ray.ray.origin, ray.ray.direction, 40); if (t && !this.inReach(t)) t = null; }
    if (!t && this.tapped && this.inReach(this.tapped) && W.solid(this.tapped.x, this.tapped.y, this.tapped.z)) t = this.tapped;
    if (!t && g.cam.mode !== 'first' && !inp.hover){ const d = new THREE.Vector3(Math.sin(this.face) * Math.cos(.62), -Math.sin(.62), Math.cos(this.face) * Math.cos(.62)); t = W.raycast(this.eye(), d, 3); }
    if (t && !this.inReach(t)) t = null;
    this.target = t;
    this.cursor.visible = !!t; if (t) this.cursor.position.copy(W.center(t.x, t.y, t.z));
  }
  tap(sx, sy){ const g = this.g; ray.setFromCamera(v2.set(sx / innerWidth * 2 - 1, -sy / innerHeight * 2 + 1), g.camera); const t = g.world.raycast(ray.ray.origin, ray.ray.direction, 40); this.tapped = t && this.inReach(t) ? t : null; }

  jump(){ if (this.body.ground){ this.stand(); this.body.vy = this.sp > 0 ? TUNING.player.jump : TUNING.player.tiredJump; this.body.ground = false; this.tire(TUNING.stamina.jump); this.g.sound.play('jump'); } }
  // stamina: running uses a little, digging and fighting more; at zero you walk slowly until you rest
  tire(n){ if (this.g.rules.damage === false) return; const was = this.sp; this.sp = Math.max(0, this.sp - n); if (was > 0 && this.sp === 0){ this.g.hud.say(this.g.t('tired'), 2500); this.g.sound.play('no'); } }
  sit(){ if (this.sitting){ this.stand(); return; } if (!this.body.ground) return; this.sitting = true; this.restT = 0; this.mineUp(); this.g.sound.play('pop'); }
  stand(){ if (!this.sitting) return; this.sitting = false; if (this.restT > 1) this.g.track('rest', { kind: 'sit', sec: Math.round(this.restT) }); }
  sleep(){ const g = this.g; this.stand(); g.hud.fade(() => { this.sp = this.maxSp; this.hp = Math.min(this.maxHp, this.hp + 4); g.hud.hearts(this.hp, this.maxHp); g.hud.stamina(this.sp, this.maxSp); g.room.spawn = [this.body.x, this.body.z]; g.hud.say(g.t('slept'), 2500); g.track('rest', { kind: 'sleep', sec: 0 }); }); }
  // mine button / left mouse: hit a critter in front if there is one, otherwise dig the aimed block while held
  mineDown(){ this.stand(); this.mining = true; this.strikeMob(); }
  mineUp(){ this.mining = false; this.mineT = 0; this.mineKey = ''; this.crack.visible = false; if (this.action && this.action.type === 'mine') this.action = null; }
  strikeMob(){
    const g = this.g, it = g.inv.item, melee = it.melee || { dmg: 1, reach: 1.5 }, fwd = new THREE.Vector3(Math.sin(this.face), 0, Math.cos(this.face));
    let m = null, best = 1e9;   // nearest critter within one cell on any side; turn to face it
    for (const c of g.mobs.list){ if (c.dead) continue; const dx = c.body.x - this.body.x, dz = c.body.z - this.body.z, d = Math.hypot(dx, dz); if (d < melee.reach && d < best && Math.abs(c.body.y - this.body.y) < 1.3){ best = d; m = c; } }
    if (!m) return false; this.face = Math.atan2(m.body.x - this.body.x, m.body.z - this.body.z); if (this.action && this.action.type !== 'mine') return true;
    this.tire(TUNING.stamina.hit); const sword = it.kind === 'sword'; this.action = { type: sword ? 'slash' : 'punch', t: 0, dur: sword ? .42 : .3, at: sword ? .2 : .12, mob: m, melee };
    g.sound.play(this.action.type); return true;
  }
  dig(dt){
    const g = this.g, W = g.world, t = this.target; if (!t || !g.rules.build){ this.mineT = 0; this.crack.visible = false; return; }
    if (W.lock && W.lock(t.x, t.z)){ this.lockedSay(); this.mineT = 0; this.crack.visible = false; return; }
    // weapons (melee, no tool) only fight; they never dig or break blocks (user, 2026-11-22)
    const held = g.inv.item; if (held.melee && !held.tool){ if (!this.noDigT || performance.now() - this.noDigT > 900){ this.noDigT = performance.now(); g.sound.play('no'); } this.mineT = 0; this.crack.visible = false; return; }
    const crop = g.farm.at(t.x, t.y, t.z); if (crop){ if (g.farm.ripe(crop)) this.harvest(crop); else { const p = crop.m.position; g.farm.remove(crop); g.farm.share(t.x, t.y, t.z, 'crop', { type: crop.type, stage: -1 }); g.drops.spawn('seeds', p.x, p.y + .2, p.z); } this.mining = false; return; }
    const b = BLOCKS[W.get(t.x, t.y, t.z)]; if (!b || !b.solid || b.hard === Infinity) return;
    const key = t.x + ',' + t.y + ',' + t.z; if (key !== this.mineKey){ this.mineKey = key; this.mineT = 0; }
    const it = g.inv.item, right = !!it.tool && it.tool === b.tool, time = b.hard / (right ? (it.dig || 4) : TUNING.dig.wrongTool) * (this.sp > 0 ? 1 : TUNING.dig.tiredSlow);
    this.mineT += dt; this.tire(dt * TUNING.stamina.digPerSec); if (!this.action){ this.action = { type: 'mine', t: 0, dur: 99, at: 99 }; this.digClock = 0; }
    const cyc = .5, hit = .27, c0 = this.digClock || 0, c1 = c0 + dt; this.digClock = c1;   // the chop animation lands at .27 of each .5 s swing: the ground reacts exactly then
    if (Math.floor((c0 - hit) / cyc) !== Math.floor((c1 - hit) / cyc)){ const n = new THREE.Vector3(...t.n), at = W.center(t.x, t.y, t.z).add(n.clone().multiplyScalar(.51));
      if (!n.y){ at.y += .1; } else { const f = new THREE.Vector3(Math.sin(this.face), 0, Math.cos(this.face)).multiplyScalar(-.18); at.add(f); }
      g.sound.play('dig'); g.cam.shake = Math.max(g.cam.shake, .07); g.particles.chips(at, n, tint(b.id), b.id); this.struck = true; this.wearTool(); }
    const k = Math.min(.999, this.mineT / time); this.crack.visible = true; this.crack.position.copy(W.center(t.x, t.y, t.z)); this.crack.material.map = this.crackTex[Math.min(4, k * 5 | 0)];
    // the block breaks on a strike, never between strikes, so the break always lines up with the tool touching it
    if (this.mineT >= time && this.struck){ this.mineT = 0; this.mineKey = ''; this.crack.visible = false; this.breakBlock(t, b, right || !b.needs); }
    this.struck = false;
  }
  breakBlock(t, b, drops){
    const g = this.g, W = g.world, p = W.center(t.x, t.y, t.z);
    W.set(t.x, t.y, t.z, 0); g.deco.clear(t.x, t.z); if (this.tapped && this.tapped.x === t.x && this.tapped.y === t.y && this.tapped.z === t.z) this.tapped = null;
    g.particles.burst(p, { color: tint(b.id), n: 12, speed: 2.5 }); g.sound.play('pop'); g.cam.shake = .12;
    const item = drops ? (typeof b.drop === 'function' ? b.drop() : b.drop) : null; if (item) g.drops.spawn(item, p.x, p.y, p.z);
    if (b.id === 'grass' && Math.random() < .3) g.drops.spawn('seeds', p.x, p.y, p.z);
    const crop = g.farm.at(t.x, t.y, t.z); if (crop){ g.drops.spawn('seeds', p.x, p.y + .5, p.z); g.farm.remove(crop); }
    g.track('block_break', { block: b.id, x: t.x, y: t.y, z: t.z, tool: g.inv.item.id, dropped: !!item }); g.bus.emit('block_break', { x: t.x, y: t.y, z: t.z, b: 0 });
  }
  // use button / right mouse: place the held block on the aimed face, or eat
  use(){
    const g = this.g, it = g.inv.item, t0 = this.target;
    if (t0 && g.world.get(t0.x, t0.y, t0.z) === BLOCK.bed) return this.sleep();
    if (t0){ const crop = g.farm.at(t0.x, t0.y, t0.z); if (crop && g.farm.ripe(crop)) return this.harvest(crop); }
    if (it.farm) return this.farmUse(it, t0);
    if (it.food){ if (this.action || this.hp >= this.maxHp) return this.nope(g.inv.sel); this.action = { type: 'eat', t: 0, dur: .9, at: .62, food: it }; g.sound.play('eat'); return; }
    if (it.place === undefined) return this.nope(g.inv.sel);
    const W = g.world, t = this.target; if (!g.rules.build || !t) return this.nope();
    const B = this.body, inBody = (x, y, z) => Math.abs(B.x - W.wx(x)) < .5 + B.r && Math.abs(B.z - W.wx(z)) < .5 + B.r && y < B.y + B.h && y + 1 > B.y;
    let x = t.x + t.n[0], y = t.y + t.n[1], z = t.z + t.n[2];
    // aiming at the side of a block at your feet would build into yourself: build on top of it instead
    if (inBody(x, y, z) && t.n[1] === 0 && !W.solid(t.x, t.y + 1, t.z) && !inBody(t.x, t.y + 1, t.z)){ x = t.x; y = t.y + 1; z = t.z; }
    if (!W.inside(x, y, z) || W.solid(x, y, z) || y < 1 || inBody(x, y, z)) return this.nope();
    if (W.lock && W.lock(x, z)){ this.lockedSay(); return this.nope(); }
    const bx = W.wx(x), bz = W.wx(z);
    for (const m of g.mobs.list) if (!m.dead && Math.abs(m.body.x - bx) < .5 + m.body.r && Math.abs(m.body.z - bz) < .5 + m.body.r && y < m.body.y + m.body.h && y + 1 > m.body.y) return this.nope();
    g.inv.takeSel(); W.set(x, y, z, it.place); g.deco.clear(x, z);
    g.particles.burst(W.center(x, y, z), { color: tint(BLOCKS[it.place].id), n: 6, speed: 1.5, up: 1.5 }); g.sound.play('place'); this.swing = .25;
    g.track('block_place', { block: BLOCKS[it.place].id, x, y, z }); g.bus.emit('block_place', { x, y, z, b: it.place });
  }
  farmUse(it, t){
    const g = this.g, F = g.farm; if (!t || !g.rules.build) return this.nope();
    if (g.world.lock && g.world.lock(t.x, t.z)){ this.lockedSay(); return this.nope(); }
    const p = g.world.center(t.x, t.y, t.z).add(new THREE.Vector3(0, .5, 0)); let ok = false, what = it.farm;
    if (it.farm === 'till'){ ok = F.till(t.x, t.y, t.z); if (ok){ this.wearTool(); g.particles.burst(p, { color: '#b47a46', n: 8, speed: 1.5, up: 1.5, size: .7 }); g.sound.play('dig'); this.tire(TUNING.stamina.till); } }
    else if (it.farm === 'water'){ ok = F.water(t.x, t.y, t.z); if (ok){ this.wearTool(); g.particles.burst(p.clone().add(new THREE.Vector3(0, .5, 0)), { color: '#7fd7ff', n: 12, speed: 1.2, up: .2, size: .5, gravity: 14 }); g.sound.play('pop'); } }
    else if (it.farm === 'plant'){ ok = F.plant(t.x, t.y, t.z, it.crop); if (ok){ g.inv.takeSel(); g.sound.play('place'); } }
    if (!ok) return this.nope(); this.swing = .3;
    F.share(t.x, t.y, t.z, what === 'plant' ? 'crop' : what, what === 'plant' ? F.at(t.x, t.y, t.z) : null);
    g.track('farm', { action: what, crop: it.crop || '' }); g.saveSoon();
  }
  harvest(c){
    const g = this.g, F = g.farm, K = { carrot: { give: 'carrot', seeds: 'seeds' } }[c.type] || {}, p = c.m.position.clone().add(new THREE.Vector3(0, .3, 0));
    F.remove(c); F.share(c.x, c.y, c.z, 'crop', { type: c.type, stage: -1 });
    const n = 1 + (Math.random() * 2 | 0), s = 1 + (Math.random() < .5 ? 1 : 0); g.drops.spawn(K.give, p.x, p.y, p.z, { n }); g.drops.spawn(K.seeds, p.x, p.y, p.z, { n: s });
    g.particles.burst(p, { color: '#ff8a2a', n: 10, speed: 2 }); g.sound.play('pickup'); this.swing = .3;
    g.track('farm', { action: 'harvest', crop: c.type, n }); g.track('skill', { skill: 'growing', detail: c.type }); g.saveSoon();
  }
  // holding the button with nothing to hit still swings (sword slashes the air, tools chop, hands punch)
  airSwing(){ if (this.action && (this.action.air || this.action.type !== 'mine')) return; const it = this.g.inv.item, sword = it.melee && !it.tool;
    this.action = { type: sword ? 'slash' : it.tool ? 'mine' : 'punch', t: 0, dur: sword ? .42 : it.tool ? .4 : .3, at: 99, air: true };
    if (!it.tool) this.g.sound.play(sword ? 'slash' : 'punch'); this.tire(TUNING.stamina.airSwing); }
  strike(a){
    const g = this.g;
    if (a.type === 'eat'){ const s = g.inv.slots[g.inv.sel]; if (s && s.id === a.food.id){ g.inv.takeSel(); this.heal(a.food.food.heal); g.track('item_use', { item: a.food.id, effect: 'heal', amount: a.food.food.heal }); } return; }
    const m = a.mob; if (!m || m.dead) return; const pos = new THREE.Vector3(m.body.x, m.body.y + .5, m.body.z);
    g.particles.burst(pos, { color: '#fff6c8', n: 8, shape: 'star', speed: 3.5 }); g.sound.play('hit'); g.cam.shake = .3; g.floaters.add(pos, '-' + a.melee.dmg, 'dmg', .9 + Math.min(a.melee.dmg, 6) * .12);
    if (g.net && g.net.guest){ m.flash = .2; g.net.send({ k: 'hit', i: g.mobs.list.indexOf(m), dmg: a.melee.dmg, x: this.body.x, z: this.body.z }); return; }
    this.wearTool(); if (g.mobs.hit(m, a.melee.dmg, this.body)){ g.drops.spawn(m.K.drop, pos.x, pos.y, pos.z); g.particles.burst(pos, { color: mobColor(m), n: 14, speed: 4 }); g.particles.burst(pos, { color: '#FFF8EC', n: 6, speed: 3 }); g.track('mob_defeat', { mob: m.kind, weapon: g.inv.item.id, hits: m.hits }); g.bus.emit('mob_defeat', m); }
  }
  hurt(n, cause, from){
    const g = this.g; if (this.safe > 0 || !g.rules.damage) return; this.hp -= n; this.safe = 1.1; this.action = { type: 'hurt', t: 0, dur: .35, at: 9 };
    if (from){ const d = Math.hypot(this.body.x - from.x, this.body.z - from.z) || 1; this.body.kx = (this.body.x - from.x) / d * 6; this.body.kz = (this.body.z - from.z) / d * 6; this.body.vy = 4.5; }
    g.sound.play('hurt'); g.cam.shake = .5; g.hud.hurt(); g.floaters.add(new THREE.Vector3(this.body.x, this.body.y + 1.7, this.body.z), '-' + n, 'hurt', .9 + Math.min(n, 6) * .12); g.track('hurt', { cause, amount: n, hp: Math.max(0, this.hp) });
    if (this.hp <= 0){ g.track('respawn', { cause }); this.hp = this.maxHp; this.spawn(...g.room.spawn); g.hud.say(g.t('rest'), 3000); }
    g.hud.hearts(this.hp, this.maxHp);
  }
  heal(n){ this.hp = Math.min(this.maxHp, this.hp + n); this.g.hud.hearts(this.hp, this.maxHp); this.g.floaters.add(new THREE.Vector3(this.body.x, this.body.y + 1.6, this.body.z), '+' + n, 'heal', 1 + Math.min(n, 6) * .1); this.g.sound.tone(660, 990, .18, 'sine', .3); }
  lockedSay(){ const n = performance.now(); if (this.lockT && n - this.lockT < 2500) return; this.lockT = n; this.g.sound.play('no'); this.g.hud.say(this.g.t('home_locked'), 2500); }
  wearTool(){ const g = this.g, id = g.inv.item.icon; if (g.inv.wear(1)){ g.sound.play('no'); g.sound.tone(520, 180, .3, 'triangle', .3); g.cam.shake = .15;
      const p = new THREE.Vector3(this.body.x, this.body.y + .9, this.body.z); g.particles.burst(p, { color: '#c9d1d9', n: 10, speed: 3 }); g.hud.say(g.t('tool_broke'), 2500); g.track('tool_break', { item: id }); this.mineUp(); } }
  nope(slot){ this.g.sound.play('no'); this.g.hud.shake(slot); }

  update(dt, t){
    const g = this.g, inp = g.input, b = this.body, first = g.cam.mode === 'first';
    const mag = Math.min(1, Math.hypot(inp.move.x, inp.move.y));
    if (mag > .12 && this.sitting) this.stand();
    if (mag > .12){ const dir = g.cam.yaw + Math.atan2(-inp.move.x, -inp.move.y), sp = (this.sp > 0 ? TUNING.player.walk : TUNING.player.tiredWalk) * mag; this.tire(dt * TUNING.stamina.runPerSec * mag); b.vx = Math.sin(dir) * sp; b.vz = Math.cos(dir) * sp;
      if (!first) this.face += angDiff(this.face, dir) * Math.min(1, dt * 12); this.speed = sp; this.phase += dt * Math.min(1, mag * 1.4) * 7.6; }   // about 2.4 steps a second whatever the speed; the foot plants at each half turn of the phase
    else { b.vx = b.vz = 0; this.speed = 0; }
    if (first) this.face = g.cam.yaw;
    const lim = g.world.H0 + 3; b.x = Math.max(-lim, Math.min(lim, b.x)); b.z = Math.max(-lim, Math.min(lim, b.z));
    const wasGround = b.ground, r = b.step(g.world, dt);
    if (r.landed > 3.4) this.hurt(Math.min(6, Math.floor(r.landed - 2.4)), 'fall');
    if (!wasGround && b.ground) g.sound.play('land');
    // footsteps sound when a foot lands (each half walk cycle), with the sound of the ground under it
    const fall = Math.floor((this.phase + .25) / Math.PI); if (b.ground && this.speed > 0 && fall !== this.lastFall){ const [fx, fy, fz] = g.world.cellOf(b.x, b.y - .05, b.z), gb = BLOCKS[g.world.get(fx, fy, fz)]; g.sound.step(gb ? gb.id : 'grass'); } this.lastFall = fall;
    if (b.y < SEA + .1 && b.ground){ this.wetT += dt; if (this.wetT > .7){ this.wetT = 0; this.hurt(1, 'water'); this.spawn(...this.lastSafe); } }
    else if (b.ground){ this.wetT = 0; this.lastSafe = [b.x, b.z]; }
    // recover: a little while standing still, fast while sitting
    const rec = this.sitting ? TUNING.stamina.restSit : (this.speed === 0 && !this.mining ? TUNING.stamina.restIdle : 0); if (rec && this.sp < this.maxSp){ this.sp = Math.min(this.maxSp, this.sp + rec * dt); }
    if (this.sitting){ this.restT += dt; if (this.restT > 4 && this.hp < this.maxHp && ((this.restT * 10 | 0) % 60 === 0)){ this.hp++; this.g.hud.hearts(this.hp, this.maxHp); } }
    if ((this.spShown | 0) !== (this.sp | 0)){ this.spShown = this.sp; g.hud.stamina(this.sp, this.maxSp); }
    this.aim();
    if (this.mining && !(this.action && this.action.type !== 'mine')){ if (!this.strikeMob()){ this.dig(dt); if (!this.mineT) this.airSwing(); } }
    if (this.action){ const a = this.action; a.t += dt; if (!a.hit && a.t >= a.at){ a.hit = true; this.strike(a); } if (a.t >= a.dur) this.action = null; }
    if (this.swing > 0) this.swing -= dt;
    if (this.safe > 0){ this.safe -= dt; this.root.visible = !first && Math.sin(t * 40) > -.2; } else this.root.visible = !first;
    const hop = 0;   // the walk bob now comes from the Animator
    this.root.position.set(b.x, b.y + hop, b.z); this.root.rotation.y = this.face;
    const [sx, , sz] = g.world.cellOf(b.x, 0, b.z); this.shadow.position.set(b.x, g.world.top(sx, sz) + .03, b.z); this.shadow.visible = false;
    g.anim.update(dt, { model: this.model, speed: this.speed, phase: this.phase, ground: b.ground, vy: b.vy, action: this.action || (this.sitting ? { type: 'sit', t: 0, dur: 1 } : null), hold: g.holding(), face: this.face, t, hideHeld: first });
  }
}

function tint(id){ return { grass: '#62c24a', soil: '#c98a52', stone: '#9aa3ad', log: '#8a5530', planks: '#d29a5c', leaves: '#3fae4a', sand: '#f2d68c', brick: '#d4553a', gold: '#ffd23f' }[id] || '#fff3df'; }
function cracks(){
  return [1, 2, 3, 4, 5].map(stage => { const c = document.createElement('canvas'); c.width = c.height = 16; const g = c.getContext('2d'); g.strokeStyle = 'rgba(20,10,0,.75)'; g.lineWidth = 1;
    let s = 7; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < stage * 3; i++){ g.beginPath(); let x = 8, y = 8; g.moveTo(x, y); for (let k = 0; k < 2 + stage; k++){ x += (r() - .5) * 8; y += (r() - .5) * 8; g.lineTo(x, y); } g.stroke(); }
    const t = new THREE.CanvasTexture(c); t.magFilter = THREE.NearestFilter; return t; });
}
