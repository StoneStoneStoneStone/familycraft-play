// Room: a small build challenge, to show how a room changes the rules with data only.
// No damage, no critters, plenty of blocks; goal: build a tower 5 blocks tall on the glowing plot.
import * as THREE from 'three';
import { BLOCK } from '../world/voxel.js';
import { clay } from '../fx/materials.js';

export default {
  id: 'tower', persist: false, size: 16, height: 12,
  words: { th: { tower_hint: 'สร้างหอคอยให้สูง 5 ก้อนบนแปลงที่เรืองแสง', tower_done: 'หอคอยสูงพอแล้ว เยี่ยมมาก', tower_goal: 'สูง {n}/5' },
           en: { tower_hint: 'Build a tower 5 blocks tall on the glowing plot', tower_done: 'Tall enough. Brilliant', tower_goal: 'height {n}/5' } },
  rules: { build: true, damage: false },
  start: { brick: 16, stone: 16, planks: 16, shovel: 1 },
  spawn: [0, 2.5],
  build(game){
    const W = game.world; for (let x = 0; x < W.N; x++) for (let z = 0; z < W.N; z++){ const d = Math.hypot(x - W.H0, z - W.H0); if (d < 7.4){ W.set(x, 0, z, BLOCK.bedrock); W.set(x, 1, z, d < 6 ? BLOCK.soil : BLOCK.sand); if (d < 6) W.set(x, 2, z, BLOCK.grass); } }
    this.plot = [8, 6]; const m = new THREE.Mesh(new THREE.CylinderGeometry(.62, .62, .06, 32), clay('#ffd21f', { emissive: '#ffb000', emissiveIntensity: .6 }));
    m.position.set(W.wx(this.plot[0]), W.top(...this.plot) + .04, W.wx(this.plot[1])); game.scene.add(m); this.marker = m; this.base = W.top(...this.plot); this.done = false; this.best = 0;
    game.hud.goal(game.t('tower_goal', { n: 0 })); game.hud.say(game.t('tower_hint'));
    this.off = game.bus.on('block_place', e => this.check(game, e));
  },
  check(game, e){
    if (e.x !== this.plot[0] || e.z !== this.plot[1] || this.done) return;
    const h = game.world.top(...this.plot) - this.base; this.marker.position.y = this.base + h + .04;
    if (h > this.best){ this.best = h; game.hud.goal(game.t('tower_goal', { n: Math.min(h, 5) })); game.track('goal_progress', { goal: 'tower', value: h, target: 5 }); }
    if (h >= 5){ this.done = true; game.sound.play('star'); game.particles.burst(this.marker.position, { color: '#ffc94d', shape: 'star', n: 20, speed: 4 });
      game.track('goal_complete', { goal: 'tower', sec: Math.round(game.roomTime) }); game.track('skill', { skill: 'stacking', detail: 'tower of 5' }); game.hud.say(game.t('tower_done'), 4000); }
  },
  update(game, dt, t){ this.marker.material.emissiveIntensity = .4 + Math.sin(t * 4) * .25; },
  save(){ return {}; }
};
