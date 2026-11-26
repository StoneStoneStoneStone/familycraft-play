// Farming, in the spirit of Harvest Moon / Stardew Valley: till grass or soil with a hoe (the ground stays,
// it becomes a field), plant seeds, water with the can (the field darkens and dries again later), and the
// crop grows one stage each time it has had enough water. Ripe crops give food and seeds back.
// Growth runs on the room owner's device (or alone); others receive crop states.
import * as THREE from 'three';
import { BLOCK } from './voxel.js';
import { clay, shadowAll } from '../fx/materials.js';

export const CROPS = {
  carrot: { stages: 4, grow: 20, give: 'carrot', seeds: 'seeds' }       // grow: seconds of wet soil per stage
};
const DRY = 45;                                                         // a watered field dries after this many seconds

export class Farm {
  constructor(game){ this.g = game; this.crops = new Map(); this.wet = new Map(); this.CROPS = CROPS; }
  key(x, y, z){ return x + ',' + y + ',' + z; }
  till(x, y, z){ const W = this.g.world, b = W.get(x, y, z); if ((b !== BLOCK.grass && b !== BLOCK.soil) || W.get(x, y + 1, z)) return false; W.set(x, y, z, BLOCK.farmland); this.g.deco.clear(x, z); return true; }
  water(x, y, z){ const W = this.g.world, b = W.get(x, y, z); if (b !== BLOCK.farmland && b !== BLOCK.farmwet) return false; W.set(x, y, z, BLOCK.farmwet); this.wet.set(this.key(x, y, z), DRY); return true; }
  plant(x, y, z, type, stage = 0){ const W = this.g.world, b = W.get(x, y, z), k = this.key(x, y, z); if ((b !== BLOCK.farmland && b !== BLOCK.farmwet) || this.crops.has(k)) return false;
    const c = { x, y, z, type, stage, t: 0, m: null }; this.crops.set(k, c); this.draw(c); return true; }
  at(x, y, z){ return this.crops.get(this.key(x, y, z)); }
  ripe(c){ return c.stage >= CROPS[c.type].stages - 1; }
  remove(c){ if (c.m) this.g.scene.remove(c.m); this.crops.delete(this.key(c.x, c.y, c.z)); }
  set(x, y, z, type, stage){ const c = this.at(x, y, z); if (stage < 0){ if (c) this.remove(c); return; } if (c){ c.stage = stage; this.draw(c); } else this.plant(x, y, z, type, stage); }
  draw(c){
    if (c.m) this.g.scene.remove(c.m); const W = this.g.world, g = new THREE.Group(), s = c.stage, leaf = clay(s ? '#4fbf4a' : '#7fd36a');
    const n = [3, 5, 7, 8][s] || 8, h = [.12, .26, .38, .44][s] || .44;
    for (let i = 0; i < n; i++){ const a = i / n * Math.PI * 2, l = new THREE.Mesh(new THREE.ConeGeometry(.045 + s * .01, h, 5), leaf); l.position.set(Math.cos(a) * .06, h / 2, Math.sin(a) * .06); l.rotation.set(Math.sin(a) * .35, 0, -Math.cos(a) * .35); g.add(l); }
    if (s >= 2){ const top = new THREE.Mesh(new THREE.ConeGeometry(.09 + (s - 2) * .04, .16, 10), clay('#ff8a2a')); top.rotation.x = Math.PI; top.position.y = .02; g.add(top); }
    if (this.ripe(c)){ const spark = new THREE.Mesh(new THREE.OctahedronGeometry(.06), clay('#fff3a0', { emissive: '#ffd23f', emissiveIntensity: .6 })); spark.position.y = h + .15; spark.userData.spark = true; g.add(spark); }
    g.position.copy(W.center(c.x, c.y, c.z)).add(new THREE.Vector3(0, .5, 0)); c.m = shadowAll(g, true, false); this.g.scene.add(c.m);
  }
  update(dt, t){
    const W = this.g.world, owner = !(this.g.net && this.g.net.guest);
    for (const [k, left] of this.wet){ const [x, y, z] = k.split(',').map(Number); if (W.get(x, y, z) !== BLOCK.farmwet){ this.wet.delete(k); continue; }
      const nl = left - dt; if (nl <= 0 && owner){ this.wet.delete(k); W.set(x, y, z, BLOCK.farmland); this.share(x, y, z, 'dry'); } else this.wet.set(k, nl); }
    for (const c of this.crops.values()){
      const b = W.get(c.x, c.y, c.z); if (b !== BLOCK.farmland && b !== BLOCK.farmwet){ this.remove(c); continue; }
      if (W.get(c.x, c.y + 1, c.z)){ this.remove(c); continue; }
      if (c.m){ c.m.rotation.z = Math.sin(t * 1.5 + c.x) * .04; c.m.children.forEach(o => { if (o.userData.spark){ o.rotation.y = t * 3; o.position.y += Math.sin(t * 4) * .002; } }); }
      if (owner && b === BLOCK.farmwet && !this.ripe(c)){ c.t += dt; if (c.t >= CROPS[c.type].grow){ c.t = 0; c.stage++; this.draw(c); this.g.particles.burst(c.m.position.clone().add(new THREE.Vector3(0, .3, 0)), { color: '#9be07a', n: 5, speed: 1, up: 1.5, size: .5 }); this.share(c.x, c.y, c.z, 'crop', c); } }
    }
  }
  share(x, y, z, what, c){ const n = this.g.net; if (n && n.on) n.send({ k: 'farm', x, y, z, w: what, ty: c ? c.type : '', st: c ? c.stage : -1 }); }
  save(){ return { crops: [...this.crops.values()].map(c => [c.x, c.y, c.z, c.type, c.stage, Math.round(c.t)]), wet: [...this.wet].map(([k, v]) => [k, Math.round(v)]) }; }
  load(s){ if (!s) return; for (const [x, y, z, type, stage, t] of s.crops || []){ if (CROPS[type] && this.plant(x, y, z, type, stage)) this.at(x, y, z).t = t || 0; } for (const [k, v] of s.wet || []) this.wet.set(k, v); }
}
