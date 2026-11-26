// Effects: pooled clay particles (dust, chips, sparkles, hit stars), floating "+1" labels, camera shake,
// and tiny synthesized sounds (no audio files; WebAudio makes them on the fly).
import * as THREE from 'three';
import { clay } from './materials.js';
import { store } from '../core/core.js';

export class Particles {
  constructor(scene){ this.scene = scene; this.live = []; this.pool = []; this.geo = new THREE.SphereGeometry(.1, 8, 6); this.star = new THREE.OctahedronGeometry(.09, 0); }
  burst(pos, { color = '#fff3df', n = 8, speed = 3, up = 2.5, size = 1, life = .55, shape = 'ball', gravity = 9 } = {}){
    for (let i = 0; i < n; i++){
      const m = this.pool.pop() || new THREE.Mesh(this.geo, clay(color)); m.geometry = shape === 'star' ? this.star : this.geo; m.material = clay(color, shape === 'star' ? { emissive: color, emissiveIntensity: .5 } : {});
      m.position.copy(pos); const a = Math.random() * 6.283, s = speed * (.4 + Math.random() * .6);
      m.userData = { vx: Math.cos(a) * s, vy: up * (.5 + Math.random()), vz: Math.sin(a) * s, t: life * (.7 + Math.random() * .6), life, size: size * (.7 + Math.random() * .6), g: gravity };
      m.castShadow = false; this.scene.add(m); this.live.push(m);
    }
  }
  // a tool hitting a block: small cube chips in two or three shades fly off the face, plus a soft dust puff that grows and fades
  chips(pos, n, color, kind){ const c = new THREE.Color(color), sh = [c.clone().offsetHSL(0, 0, .08), c, c.clone().offsetHSL(0, -.05, -.12)];
    if (!this.cube) this.cube = new THREE.BoxGeometry(.11, .11, .11);
    for (let i = 0; i < 7; i++){ const m = this.pool.pop() || new THREE.Mesh(this.geo, clay(color)); m.geometry = this.cube; m.material = clay('#' + sh[i % 3].getHexString(), { roughness: .8 });
      m.position.copy(pos).add(new THREE.Vector3((Math.random() - .5) * .3, (Math.random() - .5) * .2, (Math.random() - .5) * .3)); const a = Math.random() * 6.283, s = 1.2 + Math.random() * 1.6;
      m.userData = { vx: Math.cos(a) * s + n.x * 1.6, vy: 2.2 + Math.random() * 2.4 + n.y * 1.2, vz: Math.sin(a) * s + n.z * 1.6, t: .55 + Math.random() * .3, life: .8, size: .45 + Math.random() * .55, g: 14, spin: (Math.random() - .5) * 14 };
      m.rotation.set(Math.random() * 3, Math.random() * 3, 0); m.castShadow = false; this.scene.add(m); this.live.push(m); }
    for (let i = 0; i < 3; i++){ const m = this.pool.pop() || new THREE.Mesh(this.geo, clay(color)); m.geometry = this.geo; m.material = new THREE.MeshStandardMaterial({ color: sh[0].clone().lerp(new THREE.Color('#ffffff'), .45), roughness: 1, transparent: true, opacity: .55, depthWrite: false });
      m.position.copy(pos).add(new THREE.Vector3((Math.random() - .5) * .25, .05, (Math.random() - .5) * .25)); m.userData = { vx: (Math.random() - .5) * .6 + n.x * .5, vy: .5 + Math.random() * .4, vz: (Math.random() - .5) * .6 + n.z * .5, t: .5, life: .5, size: 1.8 + Math.random(), g: 0, puff: true };
      this.scene.add(m); this.live.push(m); } }
  update(dt){
    for (let i = this.live.length - 1; i >= 0; i--){ const m = this.live[i], u = m.userData; u.t -= dt; u.vy -= u.g * dt;
      m.position.x += u.vx * dt; m.position.y += u.vy * dt; m.position.z += u.vz * dt; m.rotation.y += dt * 6; if (u.spin){ m.rotation.x += dt * u.spin; } m.scale.setScalar(Math.max(.01, u.puff ? u.size * (1.4 - u.t / u.life * .6) : u.size * Math.min(1, u.t / u.life * 2))); if (u.puff) m.material.opacity = .55 * Math.max(0, u.t / u.life);
      if (u.t <= 0){ this.scene.remove(m); this.live.splice(i, 1); this.pool.push(m); } }
  }
}

export class Floaters {      // "+1" style labels that rise and fade over a 3D point
  constructor(camera){ this.cam = camera; this.items = []; this.root = document.createElement('div'); this.root.className = 'floaters'; document.body.appendChild(this.root); }
  // size: 1 = normal, bigger amounts read bigger; labels born close together fan out sideways so numbers never sit on each other
  add(pos, text, cls = '', size = 1){ const e = document.createElement('div'); e.className = 'floater ' + cls; e.textContent = text; this.root.appendChild(e);
    const near = this.items.filter(f => f.t < .45 && f.p.distanceToSquared(pos) < 1.2).length, ox = near ? (near % 2 ? 1 : -1) * Math.ceil(near / 2) * 34 : 0;
    this.items.push({ e, p: pos.clone(), t: 0, s: size, ox, oy: -near * 6 }); }
  update(dt){
    const v = new THREE.Vector3();
    for (let i = this.items.length - 1; i >= 0; i--){ const f = this.items[i]; f.t += dt; f.p.y += dt * .9; v.copy(f.p).project(this.cam);
      f.e.style.transform = `translate(${(v.x * .5 + .5) * innerWidth}px,${(-v.y * .5 + .5) * innerHeight}px) translate(-50%,-50%) translate(${f.ox}px,${f.oy}px) scale(${f.s * (f.t < .1 ? .4 + f.t * 10 : Math.max(1, 1.4 - (f.t - .1) * 2.5))})`; f.e.style.opacity = Math.max(0, 1 - Math.max(0, f.t - .55) * 2);
      if (f.t > 1.1){ f.e.remove(); this.items.splice(i, 1); } }
  }
}

export class Sound {
  constructor(){ this.on = store.get('fc-sound', true); this.ctx = null; const unlock = () => { this.ensure(); removeEventListener('pointerdown', unlock); }; addEventListener('pointerdown', unlock); }
  ensure(){ if (!this.ctx){ try{ this.ctx = new (window.AudioContext || window.webkitAudioContext)(); this.master = this.ctx.createGain(); this.master.gain.value = .35; this.master.connect(this.ctx.destination); }catch(e){} } if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }
  set(on){ this.on = on; store.set('fc-sound', on); }
  tone(f0, f1, dur, type = 'sine', vol = .5, delay = 0){
    if (!this.on || !this.ctx) return; const c = this.ctx, t = c.currentTime + delay, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + .01); g.gain.exponentialRampToValueAtTime(.001, t + dur); o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur + .02);
  }
  noise(dur, freq = 900, vol = .4){
    if (!this.on || !this.ctx) return; const c = this.ctx, n = c.sampleRate * dur, buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n); const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = buf; f.type = 'bandpass'; f.frequency.value = freq; g.gain.value = vol; s.connect(f); f.connect(g); g.connect(this.master); s.start();
  }
  noiseAt(t, dur, freq, vol, dest){
    if (!this.on || !this.ctx) return; const c = this.ctx, n = c.sampleRate * dur, buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n); const s = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain();
    s.buffer = buf; fl.type = 'highpass'; fl.frequency.value = freq; g.gain.value = vol; s.connect(fl); fl.connect(g); g.connect(dest || this.master); s.start(t);
  }
  step(kind){ if (!this.on || !this.ctx) return; const r = Math.random();
    if (kind === 'planks' || kind === 'log'){ this.tone(150 + r * 30, 110, .07, 'triangle', .18); return this.noise(.04, 700, .06); }
    if (kind === 'stone' || kind === 'brick' || kind === 'gold'){ this.tone(420 + r * 60, 300, .03, 'square', .05); return this.noise(.035, 2200, .07); }
    if (kind === 'sand'){ return this.noise(.09, 1500 + r * 500, .07); }
    return this.noise(.06, 260 + r * 120, .14); }   // grass and soil: a soft low thump
  play(name){
    switch (name){
      case 'step':   return this.noise(.05, 500 + Math.random() * 300, .12);
      case 'jump':   return this.tone(320, 640, .16, 'triangle', .3);
      case 'land':   return this.noise(.08, 300, .25);
      case 'place':  this.tone(220, 160, .08, 'square', .12); return this.noise(.06, 700, .25);
      case 'dig':    return this.noise(.14, 380, .4);
      case 'punch':  return this.noise(.07, 1200, .25);
      case 'slash':  return this.noise(.12, 2600, .25);
      case 'hit':    this.tone(180, 90, .12, 'square', .2); return this.noise(.08, 900, .3);
      case 'pickup': this.tone(660, 990, .07, 'sine', .3); return this.tone(990, 1320, .08, 'sine', .25, .06);
      case 'eat':    this.noise(.08, 1500, .2); this.noise(.08, 1300, .2); return this.tone(500, 700, .1, 'sine', .15, .3);
      case 'hurt':   return this.tone(420, 180, .22, 'sawtooth', .18);
      case 'star':   [880, 1110, 1320, 1760].forEach((f, i) => this.tone(f, f, .12, 'triangle', .22, i * .07)); return;
      case 'no':     return this.tone(200, 150, .12, 'square', .12);
      case 'pop':    return this.tone(500, 900, .1, 'sine', .2);
    }
  }
}
