// Zoomy Fox's "fix my kart" quest: the first build-to-unlock quest (design/island/fox-quest-spec.md, by Codex).
// The kart starts as a see-through ghost. The family brings planks and a stone, fits three assemblies in order
// (frame, wheels, rear), the banner rises, and from then on talking to Fox opens his race.
// Built to the spec with these simplifications for the first play-test (listed in ENGINE.md): hints follow what is
// missing instead of a strict tutorial order, and co-op guests do not yet share the quest state.
import * as THREE from 'three';
import { i18n } from '../core/i18n.js';
import { TUNING } from '../data/tuning.js';
import { iconOf } from '../ui/hud.js';

const PARTS = [
  { id: 'frame',  item: 'planks', n: () => TUNING.fox.framePlanks, th: 'ฐานรถ', en: 'Frame',      done: 'D1', sound: 'place' },
  { id: 'wheels', item: 'stone',  n: () => TUNING.fox.wheelStone,  th: 'ชุดล้อ', en: 'Wheel set',  done: 'D2', sound: 'pop' },
  { id: 'rear',   item: 'planks', n: () => TUNING.fox.rearPlanks,  th: 'ชุดท้ายรถ', en: 'Rear',    done: 'D3', sound: 'star' }
];
const T = {
  th: { O1: 'ฉันซิ่งเก่งนะ แต่รถยังประกอบไม่เสร็จ!', O2: 'ช่วยฉันหาของมาประกอบรถได้ไหม?', A1: 'เริ่มที่ฐานรถกันเลย!',
        T1: 'ใช้ขวานตัดต้นไม้หลังลานนะ!', T2: 'ใช้ท่อนไม้ทำไม้แผ่นในเมนูประดิษฐ์นะ!', T3: 'ใช้อีเต้อขุดหินทางใต้ของลานนะ!',
        R1: 'ของยังไม่พอ มาหาเพิ่มกันเถอะ!', D0: 'ไปที่รถแล้วกดใส่ชิ้นส่วนเลย!', D1: 'ฐานแน่นแล้ว หางฉันไม่หล่นแน่!', D2: 'ล้อครบแล้ว เท้าฉันได้พักซะที!',
        D3: 'แถบท้ายรถจี๊ดกว่าหางฉันอีก!', F1: 'รถเสร็จแล้ว ชูธงเลย!', F2: 'พร้อมซิ่งเมื่อไหร่ มาคุยกับฉันนะ!', W1: 'เอาแบบเพิงช่างไปให้บีเวอร์เลย!',
        help: 'ช่วยซ่อม', later: 'ไว้ก่อน', next: 'ต่อไป', close: 'ปิด', fit: 'ใส่',
        g_offer: 'คุยกับจิ้งจอกซิ่ง', g_frame: 'ทำฐานรถ: ไม้แผ่น {a}/{b}', g_wheels: 'ใส่ล้อ: หิน {a}/{b}', g_rear: 'ใส่ท้ายรถ: ไม้แผ่น {a}/{b}', g_open: 'คุยกับจิ้งจอกซิ่งเพื่อแข่งรถ', g_won: 'เอาแบบไปให้บีเวอร์ (เร็วๆ นี้)',
        apples: 'จิ้งจอกซิ่งให้แอปเปิล {n} ลูก', plan: 'ได้ "แบบเพิงช่างบีเวอร์"' },
  en: { O1: "I'm fast, but my kart is still in pieces!", O2: 'Will you find the bits to build my kart?', A1: "Let's start with the frame!",
        T1: 'Use your axe on a tree past the pit!', T2: 'Turn a log into planks in the crafting menu!', T3: 'Use your pickaxe on the rock south of the pit!',
        R1: "We're a bit short, so let's find some more!", D0: 'Walk up to the kart and press Fit part!', D1: "That's a sturdy frame for my fluffy tail!", D2: 'Wheels on, paws off!',
        D3: 'Those stripes are flashier than my tail!', F1: 'Kart complete, raise the banner!', F2: "Talk to me when you're ready to race!", W1: 'Take the workshop plan to Beaver!',
        help: 'Help fix it', later: 'Not now', next: 'Next', close: 'Close', fit: 'Fit',
        g_offer: 'Talk to Zoomy Fox', g_frame: 'Build the frame: planks {a}/{b}', g_wheels: 'Fit the wheels: stone {a}/{b}', g_rear: 'Fit the rear: planks {a}/{b}', g_open: 'Talk to Zoomy Fox to race', g_won: 'Take the plan to Beaver (coming soon)',
        apples: 'Zoomy Fox gives you {n} apples', plan: 'You got "Beaver\'s Workshop Plan"' }
};
const FACE = { O1: 'grin', O2: 'wow', A1: 'grin', T1: 'grin', T2: 'wow', T3: 'grin', R1: 'wow', D0: 'grin', D1: 'clap', D2: 'clap', D3: 'wow', F1: 'clap', F2: 'grin', W1: 'clap' };

export class FoxQuest {
  // npc: the entry from Npcs.add (its prop is the kart, built with named parts); plot: the scene from buildRacePlot (has the banner)
  constructor(game, npc, plot, saved, spots){
    this.g = game; this.npc = npc; this.banner = plot.userData.banner; this.spots = spots; this.kart = npc.prop; npc.quest = this;
    this.s = Object.assign({ stage: 0, accepted: false, t0: 0, won: false, apples: false }, saved || {});   // stage: 0..2 = next part to fit, 3 = kart built
    this.ghost = new THREE.MeshStandardMaterial({ color: '#ffffff', transparent: true, opacity: .34, depthWrite: false, roughness: 1 });
    this.glow = new THREE.MeshStandardMaterial({ color: '#FFC94D', emissive: '#ffb300', emissiveIntensity: .5, transparent: true, opacity: .5, depthWrite: false });
    for (const p of PARTS) this.kart.userData.parts[p.id].traverse(o => { if (o.isMesh){ o.userData.solid = o.material; o.userData.shadow = o.castShadow; } });
    this.bannerY = this.banner.position.y; this.rise = this.s.stage >= 3 ? 1 : 0;
    this.btn = document.createElement('button'); this.btn.className = 'npc-talk fit'; this.btn.hidden = true; this.btn.onclick = () => this.fit(); document.body.appendChild(this.btn);
    const m = this.mark = new THREE.Group(), cone = new THREE.Mesh(new THREE.ConeGeometry(.22, .42, 4), new THREE.MeshStandardMaterial({ color: '#FFC94D', emissive: '#ffb300', emissiveIntensity: .7 })); cone.rotation.x = Math.PI; m.add(cone); game.scene.add(m);
    game.bus.on('inv', () => this.refresh()); this.paint(); this.refresh();
  }
  w(k, v){ let s = T[i18n.lang][k] || k; for (const a in v || {}) s = s.replace('{' + a + '}', v[a]); return s; }
  part(){ return PARTS[this.s.stage]; }
  have(){ const p = this.part(); return p ? this.g.inv.count(p.item) : 0; }
  // kart looks: fitted parts solid, the next one glowing, later ones faint
  paint(){ PARTS.forEach((p, i) => this.kart.userData.parts[p.id].traverse(o => { if (!o.isMesh) return; const solid = i < this.s.stage; o.material = solid ? o.userData.solid : i === this.s.stage && this.s.accepted ? this.glow : this.ghost; o.castShadow = solid && o.userData.shadow; })); }
  goal(){ const s = this.s; if (s.stage >= 3) return this.w(s.won ? 'g_won' : 'g_open'); if (!s.accepted) return this.w('g_offer'); const p = this.part(); return this.w('g_' + p.id, { a: Math.min(this.have(), p.n()), b: p.n() }); }
  refresh(){ if (this.g.hud) this.g.hud.say(this.goal()); this.btnKey = ''; }
  card(id, extra){ return Object.assign({ face: FACE[id], text: this.w(id) }, extra); }
  // what is still missing decides the hint: no logs and no planks -> chop; logs in the bag -> craft; stone -> dig
  hint(){ const p = this.part(), inv = this.g.inv; if (p.item === 'stone') return 'T3'; return inv.count('log') > 0 ? 'T2' : 'T1'; }
  // the cards Talk shows in the current state; null hands over to the islander's own mini-game challenge
  script(){
    const s = this.s; if (s.stage >= 3) return null;
    if (!s.accepted) return [this.card('O1'), this.card('O2', { ok: this.w('help'), later: this.w('later'), onOk: () => this.accept() })];
    return this.have() >= this.part().n() ? [this.card('D0')] : [this.card('R1'), this.card(this.hint())];
  }
  accept(){ const s = this.s; s.accepted = true; s.t0 = Date.now(); this.g.track('fox_offer_answered', { answer: 'help', party_size: this.party() }); this.paint(); this.refresh(); this.g.saveSoon();
    return [this.card('A1'), ...(this.have() >= this.part().n() ? [this.card('D0')] : [this.card(this.hint())])]; }
  party(){ return 1 + (this.g.net && this.g.net.peers ? this.g.net.peers.size || 0 : 0); }
  // "Fit part" at the kart: the whole assembly at once, or a reminder of what is missing
  fit(){
    const g = this.g, s = this.s, p = this.part(); if (!p || !s.accepted || g.talking || !this.nearKart()) return; const need = p.n(), have = this.have();
    if (have < need){ g.sound.play('no'); g.track('fox_delivery_attempted', { slot: p.id, outcome: 'short', missing_count: need - have, contributor_count: 1 }); return g.npcs.say(this.npc, [this.card('R1'), this.card(this.hint())]); }
    g.inv.remove(p.item, need); g.bus.emit('inv', { gained: -need, slot: -1 }); s.stage++; this.pop = .45; this.paint(); g.sound.play(p.sound); g.cam.shake = .15;
    g.particles.burst(this.kart.position.clone().add(new THREE.Vector3(0, .6, 0)), { color: '#ffc94d', shape: 'star', n: 14, speed: 3 });
    g.track('fox_delivery_attempted', { slot: p.id, outcome: 'fitted', missing_count: 0, contributor_count: 1 });
    const cards = [this.card(p.done)];
    if (s.stage >= 3){ cards.push(this.card('F1'), this.card('F2')); g.sound.play('star'); g.track('fox_kart_completed', { elapsed_since_accept_s: Math.round((Date.now() - s.t0) / 1000), party_size: this.party(), reward_granted: !s.apples });
      if (!s.apples){ s.apples = true; const n = TUNING.fox.rewardApples; g.inv.add('apple', n); cards[cards.length - 1].note = this.w('apples', { n }); } }
    this.refresh(); g.saveSoon(); g.save && g.save(); g.npcs.say(this.npc, cards);
  }
  // the race came back: the first win gives the plan Beaver will need for his place
  result(r){ const s = this.s, first = r.place === 1 && !s.won; this.g.track('fox_race_finished', { subject: r.theme, difficulty: r.level, result: r.place === 1 ? 'win' : 'loss', race_duration_s: r.seconds, first_win_reward_granted: first });
    if (!first) return null; s.won = true; this.g.inv.add('plan_beaver', 1); /* the plan is a real item in the bag; before it was only a message, so nothing arrived */ this.refresh(); this.g.saveSoon(); return [this.card('W1', { note: this.w('plan') })]; }
  nearKart(){ const P = this.g.player.body, K = this.kart.position; return Math.hypot(P.x - K.x, P.z - K.z) < TUNING.fox.deliveryRange; }
  update(dt, t){
    const g = this.g, s = this.s, P = g.player.body, K = this.kart.position, p = this.part();
    if (this.pop > 0){ this.pop -= dt; const k = 1 + Math.sin(Math.max(0, this.pop) / .45 * Math.PI) * .12; this.kart.scale.setScalar(.6 * k); }
    if (s.accepted && p){ this.glow.opacity = .38 + Math.sin(t * 4) * .16; }
    const up = s.stage >= 3 ? 1 : 0; this.rise += (up - this.rise) * Math.min(1, dt * 2.2); this.banner.position.y = this.bannerY - (1 - this.rise) * 3.4; this.banner.visible = this.rise > .02;
    // "Fit part" button near the kart
    const near = !!(s.accepted && p && !g.talking && this.nearKart()), key = near ? p.id + this.have() + i18n.lang : '';
    if (this.btn.hidden === near) this.btn.hidden = !near;
    if (key !== this.btnKey){ this.btnKey = key; if (near){ const have = Math.min(this.have(), p.n()), ok = have >= p.n(); this.btn.classList.toggle('short', !ok);
      this.btn.innerHTML = `<i class="it">${iconOf(p.item)}</i><span>${this.w('fit')}${p[i18n.lang]} ${have}/${p.n()}</span>`; } }
    // the bouncing marker shows where to go next: the tree or rock to gather from, or the kart when the items are ready
    let at = null; if (s.accepted && p && !g.talking){ const ready = this.have() >= p.n(), W = g.world;
      if (ready) at = [K.x, K.y + 1.5, K.z]; else { const c = p.item === 'stone' ? this.spots.rock : g.inv.count('log') ? null : this.spots.tree; if (c) at = [W.wx(c[0]), W.top(c[0], c[1]) + (p.item === 'stone' ? .6 : 1.2), W.wx(c[1])]; } }
    if ((this.sayT = (this.sayT || 0) + dt) > 1){ this.sayT = 0; const h = document.getElementById('hint'); if (h && h.style.opacity === '0' && !g.talking) g.hud.say(this.goal()); }   // after a passing message fades, the goal comes back
    this.mark.visible = !!at; if (at){ this.mark.position.set(at[0], at[1] + Math.sin(t * 4) * .14, at[2]); this.mark.rotation.y = t * 2; }
  }
  save(){ return { ...this.s }; }
}
