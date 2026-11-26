// The game: owns renderer, scene, loop and every system, and runs one room at a time.
// Order each frame: input -> player -> world things -> room rules -> effects -> camera -> render.
import { wear } from './entity/wearables.js';
import * as THREE from 'three';
import { Bus, store } from './core/core.js';
import { i18n } from './core/i18n.js';
import { Input } from './core/input.js';
import { VoxelWorld } from './world/voxel.js';
import { SEA } from './physics/body.js';
import { FollowCamera } from './camera/follow.js';
import { Particles, Floaters, Sound } from './fx/fx.js';
import { Npcs } from './entity/npc.js';
import { TUNING } from './data/tuning.js';
import { Music } from './fx/music.js';
import { clay } from './fx/materials.js';
import { Inventory, ITEMS, HOTBAR } from './items/items.js';
import { CHARACTERS, loadCharacter, Animator } from './entity/character.js';
import { Player } from './entity/player.js';
import { Drops, Mobs, Deco } from './entity/things.js';
import { Farm } from './world/farm.js';
import { Hud } from './ui/hud.js';
import { Telemetry } from './telemetry/telemetry.js';
import { Net } from './net/net.js';

import { Coins } from './core/coins.js';
import { Clock } from './world/clock.js';
const SAVE = 'fc-save2-';

export class Game {
  constructor(canvas){
    this.canvas = canvas; this.bus = new Bus(); this.t = (k, v) => i18n.t(k, v);
    const R = this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true }); R.setPixelRatio(Math.min(devicePixelRatio, 2)); R.shadowMap.enabled = true; R.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene = new THREE.Scene(); const sky = new THREE.Color('#7ed2f8'); this.scene.background = sky; this.scene.fog = new THREE.Fog(sky, 36, 70);   // a little bluer, haze starts further out (owner 2026-11-27: colours looked washed out)
    this.camera = new THREE.PerspectiveCamera(42, 1, .1, 200);
    this.hemi = new THREE.HemisphereLight('#fff1dc', '#7fcf9a', 1.3); this.scene.add(this.hemi);
    const sun = this.sun = new THREE.DirectionalLight('#ffe2b8', 3.4); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.radius = 5; sun.shadow.bias = -.0006; sun.shadow.normalBias = .03;
    Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: 1, far: 60 }); this.scene.add(sun, sun.target);
    const water = this.water = new THREE.Mesh(new THREE.CircleGeometry(90, 48), new THREE.MeshStandardMaterial({ color: '#0fb0dd', roughness: .25, transparent: true, opacity: .86 })); water.rotation.x = -Math.PI / 2; water.position.y = SEA; water.receiveShadow = true; this.scene.add(water);
    const bed = new THREE.Mesh(new THREE.CircleGeometry(90, 48), clay('#ffd98a')); bed.rotation.x = -Math.PI / 2; bed.position.y = -.02; this.scene.add(bed);
    this.sound = new Sound(); this.music = new Music(this.sound); this.particles = new Particles(this.scene); this.floaters = new Floaters(this.camera); this.npcs = new Npcs(this); this.anim = new Animator(this.scene);
    const $ = id => document.getElementById(id);
    this.input = new Input({ joy: $('joy'), knob: $('knob'), canvas, buttons: { jump: $('bJump'), bag: $('bUse'), sit: $('bSit') }, holds: { main: $('bMine') }, onAny: () => this.telemetry && this.telemetry.input() });
    addEventListener('resize', () => this.fit()); this.fit(); this.clock = new THREE.Clock(); this.saveT = 0;
    this.avatarIdx = Math.max(0, CHARACTERS.findIndex(c => c.id === store.get('fc-avatar', 'boy')));
  }
  fit(){ const w = innerWidth, h = innerHeight; this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.fov = w < h ? 56 : 42; this.camera.updateProjectionMatrix(); }
  track(type, data){ this.telemetry.track(type, data); }

  async enter(room){
    this.room = room; i18n.add(room.words || {}); this.rules = Object.assign({ build: true, harvest: true, damage: true }, room.rules);
    this.world = new VoxelWorld(this.scene, { size: room.size, height: room.height });
    this.mobs = new Mobs(this); this.drops = new Drops(this); this.deco = new Deco(this); this.farm = new Farm(this);
    this.cam = new FollowCamera(this.camera, this.world, this.scene);
    let saved = room.persist ? store.get(SAVE + room.id) : null;
    if (saved && (saved.rv || 1) !== (room.saveVer || 1)){ store.set(SAVE + room.id + '-old' + (saved.rv || 1), saved); saved = null; }   // the room was rebuilt bigger: keep the old save aside and start the new one
    this.inv = new Inventory(this.bus, saved ? saved.inv : room.start);
    this.coins = this.coins || new Coins(this); this.day = this.day || new Clock(this); this.day.show(room.id === 'home'); this.net = new Net(this); this.player = new Player(this); this.hud = new Hud(this);
    this.telemetry = new Telemetry({ profile: store.get('fc-profile', 'child'), room: room.id });
    room.build(this, saved); if (saved) this.farm.load(saved.farm); this.world.rebuild();
    if (saved && saved.player){ this.player.spawn(saved.player.x, saved.player.z); this.player.hp = saved.player.hp; this.player.sp = saved.player.sp ?? 100; this.player.face = saved.player.face || 0; }
    else { this.player.spawn(...room.spawn); if (room.spawnFace !== undefined) this.player.face = room.spawnFace; }
    this.hud.hearts(this.player.hp, this.player.maxHp);
    const inp = this.input;
    inp.on('jump', () => this.talking || this.player.jump()); inp.on('use', () => this.talking || this.player.use()); inp.on('mineDown', () => this.talking || this.player.mineDown()); inp.on('mineUp', () => this.player.mineUp());
    inp.on('mainDown', () => { if (this.talking) return; this.hud.mainUses ? this.player.use() : this.player.mineDown(); }); inp.on('mainUp', () => this.player.mineUp());   // the on-screen main button: use what is held, or dig / hit
    inp.on('tap', p => this.player.tap(p.x, p.y)); inp.on('slot', i => this.inv.select(i)); inp.on('view', () => this.toggleView()); inp.on('sit', () => this.player.sit()); inp.on('craft', () => this.hud.craft(!document.getElementById('craftP').classList.contains('on'))); inp.on('bag', () => this.hud.bag(!document.getElementById('bagP').classList.contains('on')));
    this.bus.on('block_place', () => this.saveSoon()); this.bus.on('block_break', () => this.saveSoon()); this.bus.on('inv', () => this.saveSoon());
    const shareBlock = e => { if (!e.remote && this.net.on) this.net.send({ k: 'blk', x: e.x, y: e.y, z: e.z, b: e.b && this.world.get(e.x, e.y, e.z) ? e.b : 0 }); };
    this.bus.on('block_place', shareBlock); this.bus.on('block_break', e => shareBlock({ ...e, b: 0 }));
    addEventListener('pagehide', () => this.save());
    await this.setAvatar(this.avatarIdx, false);
    this.track('room_enter', { room: room.id, mode: 'solo' }); this.roomTime = 0; i18n.apply();
    this.loop();
  }
  async setAvatar(i, track = true){
    this.avatarIdx = (i + CHARACTERS.length) % CHARACTERS.length; const def = CHARACTERS[this.avatarIdx];
    const m = await loadCharacter(def); if (!m) return this.setAvatar(i + 1, track);
    this.player.setModel(m, def); this.cam && this.cam.sleeve(def.sleeve); if (m) wear(m, m.userData.bones, store.get('fc-wear', null)); this.hud.who(); store.set('fc-avatar', def.id); if (track) this.track('avatar_change', { avatar: def.id });
  }
  nextAvatar(){ return this.setAvatar(this.avatarIdx + 1); }
  pickup(id, n, pos){ this.bus.emit('inv', { id, gained: n, slot: this.inv.slots.findIndex(s => s && s.id === id) }); const now = performance.now(); this.streak = now - (this.streakT || 0) < TUNING.pickup.streakWindow * 1000 ? (this.streak || 0) + 1 : 0; this.streakT = now;
    const step = [0, 2, 4, 7, 9, 12, 14, 16, 19][Math.min(this.streak, 8)], f = 880 * Math.pow(2, step / 12);
    this.sound.play('pickup'); if (this.streak) this.sound.tone(f, f * 1.5, .14, 'triangle', .35);
    this.particles.burst(pos, { color: '#fff6c8', shape: 'star', n: 5 + Math.min(this.streak, 6) * 2, speed: 1.8, up: 2.2 });
    this.hud.fly(id, pos, this.inv.slots.findIndex(s => s && s.id === id)); this.track('item_pickup', { item: id, n }); }
  toggleView(){ return;   // first-person view is off for now (owner, 2026-11-26)
    const m = this.cam.toggle(); if (m === 'first') this.cam.yaw = this.player.face; this.hud.view(m); this.track('setting_change', { key: 'view', value: m }); }
  saveSoon(){ this.saveT = 1.5; }
  holding(){ const s = this.inv.slots[this.inv.sel]; return s ? s.id : 'hand'; }
  applySnapshot(m){ if (this.room.applySnapshot) this.room.applySnapshot(this, m); this.world.dirty = true; this.player.spawn(...this.room.spawn); this.hud.say(this.t('together_in'), 3000); }
  save(){ if (!this.room.persist || this.guest) return;
    const P = this.player; store.set(SAVE + this.room.id, { v: 2, rv: this.room.saveVer || 1, world: this.world.save(), inv: this.inv.save(), drops: this.drops.save(), player: { x: P.body.x, z: P.body.z, hp: P.hp, sp: P.sp, face: P.face }, farm: this.farm.save(), ...this.room.save(this) }); }
  loop(){
    const dt = Math.min(this.clock.getDelta(), .05), t = this.clock.elapsedTime; this.roomTime += dt;
    this.input.update(); const look = this.input.takeLook(); if (this.talking){ this.input.move.x = this.input.move.y = 0; look.dx = look.dy = look.zoom = 0; }
    this.player.update(dt, t); this.net.update(dt, t); this.drops.update(dt, t); this.mobs.update(dt); this.farm.update(dt, t);
    this.room.update && this.room.update(this, dt, t); this.npcs.update(dt, t);
    this.world.rebuild(); this.particles.update(dt); this.floaters.update(dt);
    this.cam.update(dt, this.player.body, this.player.body.h, look); this.npcs.frame(dt); this.cam.viewModel(this.holding(), Math.max(this.player.swing || 0, this.player.action && ['mine', 'punch', 'slash'].includes(this.player.action.type) ? (Math.sin(t * 14) + 1) / 2 * .5 : 0), t, this.player.speed > 0); this.water.position.y = SEA + Math.sin(t * .9) * .03;
    this.day.update(dt); const p = this.player.body, D = this.day.dir; this.day.follow(this.camera, p); this.sun.position.set(p.x + D.x * 27, D.y * 27, p.z + D.z * 27); this.sun.target.position.set(p.x, 0, p.z);
    this.telemetry.tick(dt); if (this.saveT > 0 && (this.saveT -= dt) <= 0) this.save();
    this.renderer.render(this.scene, this.camera); this.cam.renderHand(this.renderer); requestAnimationFrame(() => this.loop());
  }
}
