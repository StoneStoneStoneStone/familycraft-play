// Play together: two (or more) devices on one island through a 4-letter room code.
// The device that makes the room is the host: its island is the shared world, and it runs the critters.
// Carriers, first that works: the family's Supabase (fc-config.js), the home Wi-Fi server (serve.mjs),
// or another window on the same device (BroadcastChannel).
//
// Messages (all small JSON, `f` = sender id):
//   hello {name, av}            a device arrived (host answers with snap)
//   snap  {world, trees, stars, drops, room}   the host's island for a newcomer
//   st    {x,y,z,fa,sp,ph,g,vy,a,at,h,av,nm}  player state, 10 per second
//   blk   {x,y,z,b}             a block changed (b = 0 dug)
//   drop  {id,i,x,y,z}          an item fell     | took {id}  someone picked it up
//   star  {n}                   star number n was collected
//   tree  {x,z}                 a tree was hit (shake)
//   mobs  {l:[[x,y,z,ry,dead]]} critter positions from the host | hit {i,dmg,x,z}  a guest hit a critter
//   bye   {}                    leaving
import * as THREE from 'three';
import { CHARACTERS, loadCharacter, Animator } from '../entity/character.js';
import { i18n } from '../core/i18n.js';
import { ITEMS } from '../items/items.js';
import { BLOCKS } from '../world/voxel.js';

const rid = n => { let s = ''; for (let i = 0; i < n; i++) s += 'ABCDEFGHJKLMNPQRSTUVWXYZ'[Math.random() * 24 | 0]; return s; };
function loadScript(src){ return new Promise((ok, no) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = no; document.head.appendChild(s); }); }

export async function openTransport(code, id, onMsg){
  const cfg = window.FC_CONFIG || {}, want = (location.search.match(/net=(\w+)/) || [])[1];
  if ((!want || want === 'supabase') && cfg.supabaseUrl && cfg.supabaseAnonKey){
    try{
      if (!window.supabase) await loadScript('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js');
      const sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, { auth: { persistSession: false, autoRefreshToken: false }, realtime: { params: { eventsPerSecond: 20 } } });
      const ch = sb.channel('familycraft-' + code, { config: { broadcast: { self: false } } });
      ch.on('broadcast', { event: 'm' }, e => onMsg(e.payload));
      await new Promise((ok, no) => { const to = setTimeout(() => no(new Error('timeout')), 8000);
        ch.subscribe(s => { if (s === 'SUBSCRIBED'){ clearTimeout(to); ok(); } else if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT'){ clearTimeout(to); no(new Error(s)); } }); });
      return { via: 'supabase', send: m => ch.send({ type: 'broadcast', event: 'm', payload: m }), close: () => sb.removeChannel(ch) };
    }catch(e){ console.warn('FamilyCraft: Supabase failed, trying home Wi-Fi', e && e.message); }
  }
  if (want !== 'bc' && /^https?:$/.test(location.protocol)){
    try{
      const r = await fetch('fc/ping', { cache: 'no-store' }), j = r.ok ? await r.json() : null;
      if (j && j.fc){ const url = 'fc/room/' + code, es = new EventSource(url + '?id=' + id);
        es.onmessage = e => { try{ onMsg(JSON.parse(e.data)); }catch(_){} };
        await new Promise((ok, no) => { es.onopen = ok; es.onerror = no; setTimeout(no, 5000); }); es.onerror = null;
        let q = Promise.resolve();
        return { via: 'wifi', lan: j.lan || '', send: m => { const b = JSON.stringify(m); q = q.then(() => fetch(url, { method: 'POST', body: b })).catch(() => {}); }, close: () => es.close() }; }
    }catch(e){}
  }
  if (window.BroadcastChannel){ const bc = new BroadcastChannel('familycraft-' + code); bc.onmessage = e => onMsg(e.data); return { via: 'window', send: m => bc.postMessage(m), close: () => bc.close() }; }
  return null;
}

class Remote {        // another player as seen on this device
  constructor(net, id){ this.net = net; this.id = id; this.root = new THREE.Group(); net.g.scene.add(this.root); this.anim = new Animator(net.g.scene); this.s = null; this.t = 0; this.model = null; this.av = '';
    this.tag = document.createElement('div'); this.tag.className = 'nametag'; document.body.appendChild(this.tag); this.pos = new THREE.Vector3(); this.face = 0; }
  async avatar(av){ if (av === this.av) return; this.av = av; const def = CHARACTERS.find(c => c.id === av) || CHARACTERS[0], m = await loadCharacter(def);
    if (this.av !== av || !m) return; if (this.model) this.root.remove(this.model); this.model = m; this.root.add(m); this.def = def; }
  set(s){ if (!this.s) this.pos.set(s.x, s.y, s.z), this.face = s.fa; this.s = s; this.seen = performance.now(); this.avatar(s.av); this.tag.textContent = s.nm || ''; }
  update(dt, t){
    const s = this.s; if (!s) return; this.pos.lerp(new THREE.Vector3(s.x, s.y, s.z), Math.min(1, dt * 12)); this.face += Math.atan2(Math.sin(s.fa - this.face), Math.cos(s.fa - this.face)) * Math.min(1, dt * 12);
    this.root.position.copy(this.pos); this.root.rotation.y = this.face; this.phase = (this.phase || 0) + dt * s.sp * 2;
    const act = s.a ? { type: s.a, t: s.at, dur: 1 } : null;
    this.anim.update(dt, { model: this.model, speed: s.sp, phase: this.phase, ground: !!s.g, vy: s.vy, action: act, hold: s.h, face: this.face, t });
    const v = this.pos.clone().add(new THREE.Vector3(0, (this.def ? this.def.size : 1.25) + .35, 0)).project(this.net.g.camera);
    const on = v.z < 1; this.tag.style.display = on ? '' : 'none'; if (on) this.tag.style.transform = `translate(${(v.x * .5 + .5) * innerWidth}px,${(-v.y * .5 + .5) * innerHeight}px) translate(-50%,-100%)`;
  }
  remove(){ this.net.g.scene.remove(this.root); this.tag.remove(); Object.values(this.anim.held).forEach(m => this.net.g.scene.remove(m)); }
}

export class Net {
  constructor(game){ this.g = game; this.id = rid(8); this.tx = null; this.code = ''; this.host = false; this.remotes = new Map(); this.sendT = 0; this.mobT = 0; this.dropN = 0; this.status = 'off'; this.listeners = []; }
  get on(){ return !!this.tx; }
  get guest(){ return this.on && !this.host; }
  onStatus(f){ this.listeners.push(f); }
  setStatus(s){ this.status = s; this.listeners.forEach(f => f(s)); }
  async start(code, host){
    this.leave(); this.code = code; this.host = host; this.setStatus('connecting');
    this.tx = await openTransport(code, this.id, m => this.recv(m));
    if (!this.tx){ this.setStatus('fail'); return false; }
    this.via = this.tx.via; this.lan = this.tx.lan || '';
    this.setStatus(host ? 'waiting' : 'joining'); this.send({ k: 'hello', av: this.g.player.avatar && this.g.player.avatar.id, nm: this.name() });
    this.g.track('together_start', { role: host ? 'host' : 'guest', via: this.via });
    addEventListener('pagehide', this.byeFn = () => this.send({ k: 'bye' }));
    if (!host){ this.g.guest = true; this.joinTimer = setTimeout(() => { if (this.status === 'joining') this.setStatus('nohost'); }, 9000); }
    return true;
  }
  make(){ return this.start(rid(4), true); }
  join(code){ return this.start(code.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4), false); }
  leave(){ if (!this.tx) return; this.send({ k: 'bye' }); try{ this.tx.close(); }catch(e){} this.tx = null; for (const r of this.remotes.values()) r.remove(); this.remotes.clear();
    if (this.started) this.g.track('together_end', { sec: Math.round((Date.now() - this.started) / 1000) }); this.started = 0; this.g.guest = false; this.setStatus('off'); }
  name(){ const a = this.g.player.avatar; return a ? a[i18n.lang] : ''; }
  send(m){ if (!this.tx) return; m.f = this.id; try{ this.tx.send(m); }catch(e){} }
  peer(id){ let r = this.remotes.get(id); if (!r){ r = new Remote(this, id); this.remotes.set(id, r); if (!this.started) this.started = Date.now(); this.setStatus('together'); this.g.sound.play('pop'); } return r; }

  recv(m){
    if (!m || m.f === this.id || typeof m.k !== 'string') return; const g = this.g, W = g.world;
    const num = v => Number.isFinite(v) ? v : 0, int = v => Number.isInteger(v) ? v : -1;
    switch (m.k){
      case 'hello': if (this.host) this.send(this.snapshot()); this.peer(m.f); this.sendT = 0; break;
      case 'snap': if (!this.host && m.room === g.room.id){ clearTimeout(this.joinTimer); g.applySnapshot(m); this.peer(m.f); } break;
      case 'st': this.peer(m.f).set({ x: num(m.x), y: num(m.y), z: num(m.z), fa: num(m.fa), sp: num(m.sp), ph: 0, g: !!m.g, vy: num(m.vy), a: ['punch', 'slash', 'eat', 'hurt', 'mine', 'sit'].includes(m.a) ? m.a : null, at: num(m.at), h: ITEMS[m.h] ? m.h : 'hand', av: String(m.av || '').slice(0, 12), nm: String(m.nm || '').slice(0, 16) }); break;
      case 'blk': { const x = int(m.x), y = int(m.y), z = int(m.z), b = int(m.b); if (W.inside(x, y, z) && b >= 0 && b < BLOCKS.length && BLOCKS[b].id !== 'bedrock'){ W.set(x, y, z, b); g.deco.clear(x, z); g.bus.emit(b ? 'block_place' : 'block_break', { x, y, z, b, remote: true }); } break; }
      case 'drop': if (typeof m.id === 'string' && ITEMS[m.id] && typeof m.uid === 'string') g.drops.spawn(m.id, num(m.x), num(m.y), num(m.z), { uid: m.uid, n: Math.max(1, Math.min(64, int(m.n))), remote: true }); break;
      case 'took': g.drops.remove(String(m.uid)); break;
      case 'farm': { const x = int(m.x), y = int(m.y), z = int(m.z); if (!W.inside(x, y, z)) break;
        if (m.w === 'till') g.farm.till(x, y, z); else if (m.w === 'water') g.farm.water(x, y, z); else if (m.w === 'dry'){ if (W.get(x, y, z) === BLOCKS.findIndex(b => b.id === 'farmwet')) W.set(x, y, z, BLOCKS.findIndex(b => b.id === 'farmland')); }
        else if (m.w === 'crop' && typeof m.ty === 'string') g.farm.set(x, y, z, m.ty, Math.max(-1, Math.min(9, int(m.st)))); break; }
      case 'star': g.room.collect && g.room.collect(g, int(m.n), true); break;
      case 'mobs': if (!this.host && Array.isArray(m.l)) g.mobs.follow(m.l); break;
      case 'hit': if (this.host){ const mob = g.mobs.list[int(m.i)]; if (mob && !mob.dead){ const killed = g.mobs.hit(mob, Math.min(5, num(m.dmg)), { x: num(m.x), z: num(m.z) });
        if (killed){ const p = mob.body; g.drops.spawn(mob.K.drop, p.x, p.y + .5, p.z); g.track('mob_defeat', { mob: mob.kind, weapon: 'partner', hits: mob.hits }); } } } break;
      case 'bye': { const r = this.remotes.get(m.f); if (r){ r.remove(); this.remotes.delete(m.f); } if (!this.remotes.size) this.setStatus(this.host ? 'waiting' : 'nohost'); break; }
    }
  }
  snapshot(){ const g = this.g; return { k: 'snap', room: g.room.id, world: g.world.save(), farm: g.farm.save(), stars: g.room.got ? [...g.room.got] : [], drops: g.drops.list.map(d => [d.uid, d.id, d.n, +d.body.x.toFixed(2), +d.body.y.toFixed(2), +d.body.z.toFixed(2)]) }; }
  update(dt, t){
    if (!this.tx) return; const P = this.g.player, b = P.body;
    if ((this.sendT -= dt) <= 0){ this.sendT = .1; const a = P.action;
      this.send({ k: 'st', x: +b.x.toFixed(3), y: +b.y.toFixed(3), z: +b.z.toFixed(3), fa: +P.face.toFixed(3), sp: +P.speed.toFixed(2), g: b.ground ? 1 : 0, vy: +b.vy.toFixed(2), a: a ? a.type : null, at: a ? +a.t.toFixed(2) : 0, h: this.g.holding(), av: P.avatar && P.avatar.id, nm: this.name() }); }
    if (this.host && this.remotes.size && (this.mobT -= dt) <= 0){ this.mobT = .1; this.send({ k: 'mobs', l: this.g.mobs.list.map(m => [+m.body.x.toFixed(2), +m.body.y.toFixed(2), +m.body.z.toFixed(2), +m.g.rotation.y.toFixed(2), m.dead ? 1 : 0]) }); }
    for (const [id, r] of this.remotes){ r.update(dt, t); if (performance.now() - r.seen > 12000){ r.remove(); this.remotes.delete(id); if (!this.remotes.size) this.setStatus(this.host ? 'waiting' : 'nohost'); } }
  }
  joinUrl(){ const base = (this.lan && /localhost|127\.0\.0\.1/.test(location.hostname)) ? this.lan + location.pathname.replace(/^.*\//, '/') : location.origin + location.pathname; return base + '?join=' + this.code; }
}
