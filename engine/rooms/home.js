import { TUNING } from '../data/tuning.js';
// Room: the family's home island. Grass on soil on stone, block trees, beaches, stars to find, and
// critter spawn points that refill after a while. The world is saved, so what the family builds stays.
// A room is just this object: words, rules, size, start kit, spawn points, build(), update().
import * as THREE from 'three';
import { BLOCK } from '../world/voxel.js';
import { clay } from '../fx/materials.js';
import { rng } from '../core/core.js';
import { FoxQuest } from './quest-fox.js';
import { ISLAND, locked, buildTerrain, scatter, buildPier, buildRacePlot, addOres } from './home-island.js';

export default {
  id: 'home', persist: true, size: ISLAND.size, height: ISLAND.height, saveVer: ISLAND.ver,   // v2: the 64 x 64 island (design/island/layout-spec-v2.md)
  words: { th: { home_hint: 'เดินตามทางไม้ขึ้นเกาะ แล้วไปหาจิ้งจอกซิ่ง', home_done: 'เก็บดาวครบแล้ว เก่งมาก', home_locked: 'ตรงนี้เป็นที่ของชาวเกาะ ขุดหรือสร้างไม่ได้' },
           en: { home_hint: 'Follow the boardwalk and find Zoomy Fox', home_done: 'All stars collected. Well done', home_locked: 'This spot belongs to an islander. No digging or building here' } },
  rules: { build: true, damage: true },
  start: { pickaxe: 1, axe: 1, shovel: 1, sword: 1, hoe: 1, can: 1, seeds: 6, planks: 8, apple: 2 },
  spawn: [ISLAND.spawn[0] - (ISLAND.size - 1) / 2, ISLAND.spawn[1] - (ISLAND.size - 1) / 2], spawnFace: Math.PI,   // on the pier, looking north up the boardwalk
  locked,
  spawners: ISLAND.spawners,   // critters live in their own meadow, far from the pier and the islanders (respawn times come from KINDS)
  stars: [],   // collectible stars are out for now (owner, 2026-11-26): coins will replace them. ISLAND.stars keeps the designed spots.

  terrain(game){ buildTerrain(game, this.tree); scatter(game, 7); },
  tree(W, x, z, h, r){
    const tb = W.topBlock(x, z); if (!tb || tb.b !== BLOCK.grass) return; const y0 = tb.y + 1;
    for (let y = 0; y < h; y++) W.set(x, y0 + y, z, BLOCK.log);
    for (let dy = -2; dy <= 1; dy++){ const rad = dy === 1 ? 1 : 2; for (let dx = -rad; dx <= rad; dx++) for (let dz = -rad; dz <= rad; dz++){
      if (Math.abs(dx) === rad && Math.abs(dz) === rad && (dy === 1 || r() < .6)) continue; const yy = y0 + h + dy; if (!W.get(x + dx, yy, z + dz)) W.set(x + dx, yy, z + dz, BLOCK.leaves); } }
  },
  build(game, saved){
    const W = game.world;
    game.day.set(saved && saved.clock != null ? saved.clock : TUNING.clock.startHour); if (saved && saved.world){ W.load(saved.world); scatter(game, 9); if (!saved.ores) addOres(W); }   // islands saved before ores get them once
    else this.terrain(game);
    W.lock = locked;                                 // islanders' plots, the pier and the green cannot be dug or built on (owner, 2026-11-26)
    this.spawners.forEach(s => game.mobs.add(s.x, s.z, s));
    this.pier = buildPier(game); this.racePlot = buildRacePlot(game);
    const F = ISLAND.hosts.sing; this.fox = null; game.npcs.add('sing', F.at[0], F.at[1], { face: F.face, prop: F.kart, propFace: 0 }).then(n => { if (n) this.fox = new FoxQuest(game, n, this.racePlot, saved && saved.fox, { tree: [41, 48], rock: [36, 49] }); });
    this.racePlot.userData.banner.visible = false;
    if (!saved || !saved.player){ game.cam.yaw = Math.PI; game.cam.pitch = .38; game.player.face = Math.PI; }
    if (saved) for (const [id, n, x, y, z] of saved.drops || []) game.drops.spawn(id, x, y, z, { n, pop: false });
    this.got = new Set(saved ? saved.stars || [] : []); this.meshes = [];
    const shape = new THREE.Shape(); for (let i = 0; i < 10; i++){ const a = i * Math.PI / 5 - Math.PI / 2, rr = i % 2 ? .2 : .46; shape[i ? 'lineTo' : 'moveTo'](Math.cos(a) * rr, Math.sin(a) * rr); }
    const geo = new THREE.ExtrudeGeometry(shape, { depth: .12, bevelEnabled: true, bevelThickness: .07, bevelSize: .07, bevelSegments: 3 }); geo.center();
    this.stars.forEach(([x, z], k) => { const m = new THREE.Mesh(geo, clay('#ffc94d', { emissive: '#ff9d00', emissiveIntensity: .25, roughness: .5 }));
      m.position.set(W.wx(x), Math.max(W.top(x, z), 1) + 1.1, W.wx(z)); m.castShadow = true; m.userData.k = k; m.visible = !this.got.has(k); game.scene.add(m); this.meshes.push(m); });
    this.total = this.meshes.length; game.hud.goal(this.total ? this.got.size + '/' + this.total : '');
    game.hud.say(game.t('home_hint'));   // the fox quest takes the sign over as soon as it loads
  },
  update(game, dt, t){
    const P = game.player.body; this.fox && this.fox.update(dt, t);
    // the pier's rope rails hold: on the deck you cannot step off the sides (the open south end and the boardwalk stay free)
    const W = game.world, pz = P.z + W.H0; if (pz > 54.6 && pz < 63.6 && P.y > 2.6){ const a = W.wx(30) - .22, b = W.wx(32) + .22; if (P.x > a - .5 && P.x < b + .5) P.x = Math.max(a, Math.min(b, P.x)); }
    // protected ground shows its darker tone only around the player, so the island keeps its normal colours
    const cx = Math.round(P.x + W.H0), cz = Math.round(P.z + W.H0); if (cx !== W.px || cz !== W.pz){ W.px = cx; W.pz = cz; W.dirty = true; }
    for (const s of this.meshes){ if (!s.visible) continue; s.rotation.y = t * 1.6;
      if (Math.hypot(s.position.x - P.x, s.position.z - P.z) < .9 && Math.abs(s.position.y - P.y - .8) < 1.4) this.collect(game, s.userData.k, false); }
  },
  collect(game, k, remote){
    const s = this.meshes.find(s => s.userData.k === k); if (!s || !s.visible) return;
    s.visible = false; this.got.add(k); game.sound.play('star'); game.particles.burst(s.position, { color: '#ffc94d', shape: 'star', n: 14, speed: 3 });
    game.floaters.add(s.position, '+1', 'star'); game.hud.goal(this.got.size + '/' + this.total);
    if (!remote && game.net && game.net.on) game.net.send({ k: 'star', n: k });
    game.track('goal_progress', { goal: 'stars', value: this.got.size, target: this.total, together: !!(game.net && game.net.on) });
    if (this.got.size === this.total){ game.track('goal_complete', { goal: 'stars', sec: Math.round(game.roomTime) }); game.hud.say(game.t('home_done'), 4000); }
    game.saveSoon();
  },
  applySnapshot(game, m){
    const W = game.world; W.cells.fill(0); W.load(m.world); game.deco.clearAll();
    this.got = new Set(m.stars || []); this.meshes.forEach(s => s.visible = !this.got.has(s.userData.k)); game.hud.goal(this.got.size + '/' + this.total);
    game.drops.clear(); for (const [uid, id, n, x, y, z] of m.drops || []) game.drops.spawn(id, x, y, z, { uid, n, remote: true, pop: false });
    for (const c of [...game.farm.crops.values()]) game.farm.remove(c); game.farm.wet.clear(); game.farm.load(m.farm);
  },
  save(game){ return { clock: Math.round(game.day.h * 100) / 100, ores: 1, stars: [...this.got], fox: this.fox ? this.fox.save() : undefined }; }
};
