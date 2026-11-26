// On-screen interface: profile chip with hearts, goal counter, hint sign, 6-slot hotbar + bag, action
// buttons (jump, dig/hit held, use/place) and view switch, settings. It shows state and forwards taps.
import { ITEMS, HOTBAR, RECIPES } from '../items/items.js';
import { BLOCKS, blockMaterials } from '../world/voxel.js';
import { i18n } from '../core/i18n.js';
import { store } from '../core/core.js';

const SVG = {
  plan: '<svg viewBox="0 0 32 32"><path d="M6 5h16l4 4v18H6Z" fill="#A7D8FF" stroke="#3A1F08" stroke-width="2" stroke-linejoin="round"/><path d="M10 21v-7l6-4 6 4v7Z" fill="none" stroke="#FFF8EC" stroke-width="2" stroke-linejoin="round"/><path d="M14 21v-4h4v4" fill="none" stroke="#FFF8EC" stroke-width="2"/></svg>',
  fist: '<svg viewBox="0 0 32 32"><path d="M6 13.2a3.3 3.3 0 0 1 6.4-1.1 3.3 3.3 0 0 1 6.2-.3 3.3 3.3 0 0 1 6.4 1.2c.6 1 1 2.2 1 3.600V20c0 5-3.600 8.500-8.600 8.500h-2.800C9.600 28.500 6 25.300 6 20.500Z" fill="#fff3d6" stroke="#5a3414" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/><path d="M12.500 12.200v5.200M18.700 11.900v5.500" fill="none" stroke="#5a3414" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/><rect x="8.500" y="17.600" width="15.500" height="6" rx="3" transform="rotate(-6 16 20.600)" fill="#fff3d6" stroke="#5a3414" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/></svg>',
  hand: '<svg viewBox="0 0 32 32"><g fill="none" stroke-linecap="round" stroke-linejoin="round"><g stroke="#5a3414" stroke-width="7.4"><path d="M11 18 9.8 9.5M14.6 17V6.6M18.4 17l.5-10M22 18.5l1.4-8.3M10 22.5 5.8 17.6"/></g><path d="M9 19.5c0-2 2-3.3 7-3.3s7.5 1.3 7.5 3.6c0 5-3 8.2-7.500 8.2S9 24.500 9 19.500Z" fill="#fff3d6" stroke="#5a3414" stroke-width="2"/><g stroke="#fff3d6" stroke-width="3.6"><path d="M11 18 9.8 9.5M14.6 17V6.6M18.4 17l.5-10M22 18.5l1.4-8.3M10.500 22.500 5.8 17.6"/></g></g></svg>',
  apple: '<svg viewBox="0 0 32 32"><path d="M16 10.5c-3-2.5-9.5-1.5-9.5 6C6.5 23 10.5 29 13.5 29c1.2 0 1.6-.8 2.5-.8s1.3.8 2.5.8c3 0 7-6 7-12.5 0-7.5-6.5-8.5-9.5-6Z" fill="#ff4a3d" stroke="#5a1410" stroke-width="2" stroke-linejoin="round"/><path d="M16 10.5C16 7 17.5 4.5 20 3.5" fill="none" stroke="#5a3414" stroke-width="2.4" stroke-linecap="round"/><path d="M17 7.5c2.5-3 6-2.5 7.5-1.5-1.5 3-5 3.5-7.5 1.5Z" fill="#4fcf5e" stroke="#1f6a2c" stroke-width="1.4"/></svg>',
  sword: '<svg viewBox="0 0 32 32"><path d="M28.5 3.5 27 12 14.5 24.5 7.5 17.5 20 5Z" fill="#fff3d6" stroke="#5a3414" stroke-width="2" stroke-linejoin="round"/><path d="M6 14.5 17.5 26 15 28.5 3.5 17Z" fill="#e9b949" stroke="#6b4a12" stroke-width="2" stroke-linejoin="round"/><path d="M8.5 22 10 23.5 5.5 28 4 26.5Z" fill="#a8693c" stroke="#5a3414" stroke-width="1.6"/></svg>',
  shovel: '<svg viewBox="0 0 32 32"><path d="M6 27 18 15" stroke="#5a3414" stroke-width="5" stroke-linecap="round"/><path d="M6 27 18 15" stroke="#c98a52" stroke-width="2.6" stroke-linecap="round"/><path d="M17 11.5 21.5 7c2-2 5-.6 5.5.9.5 1.5 1.9 3.5-.1 5.5L22.5 18Z" fill="#fff3d6" stroke="#5a3414" stroke-width="2" stroke-linejoin="round"/></svg>',
  axe: '<svg viewBox="0 0 32 32"><path d="M7 28 21 10" stroke="#5a3414" stroke-width="5" stroke-linecap="round"/><path d="M7 28 21 10" stroke="#c98a52" stroke-width="2.6" stroke-linecap="round"/><path d="M17.5 6.5C20 3 26 3 28.5 7.5L22.5 14 16 9.5Z" fill="#fff3d6" stroke="#5a3414" stroke-width="2" stroke-linejoin="round"/></svg>',
  gel: '<svg viewBox="0 0 32 32"><path d="M16 6c5 5 10 9 10 14a10 10 0 0 1-20 0c0-5 5-9 10-14Z" fill="#7fd7ff" stroke="#1f5d80" stroke-width="2" stroke-linejoin="round"/><path d="M11 19a5 5 0 0 1 3-5" stroke="#fff" stroke-width="2.4" stroke-linecap="round" fill="none"/></svg>',
  hoe: '<svg viewBox="0 0 32 32"><path d="M7 28 21 12" stroke="#5a3414" stroke-width="5" stroke-linecap="round"/><path d="M7 28 21 12" stroke="#c98a52" stroke-width="2.6" stroke-linecap="round"/><path d="M17 8.5 25.5 4.5 28 9l-5 3.5-5.5-1.5Z" fill="#fff3d6" stroke="#5a3414" stroke-width="2" stroke-linejoin="round"/></svg>',
  can: '<svg viewBox="0 0 32 32"><path d="M8 13h13v12a3 3 0 0 1-3 3h-7a3 3 0 0 1-3-3Z" fill="#7fb3d9" stroke="#2a4a66" stroke-width="2" stroke-linejoin="round"/><path d="M21 16 29 9" stroke="#2a4a66" stroke-width="3.4" stroke-linecap="round"/><path d="M11 13a4 4 0 0 1 7 0" fill="none" stroke="#2a4a66" stroke-width="2.4"/><path d="M27 6.5l3-1M28.5 9.5l2.5.8" stroke="#7fd7ff" stroke-width="2" stroke-linecap="round"/></svg>',
  seeds: '<svg viewBox="0 0 32 32"><path d="M9 11c0-3 3-4 7-4s7 1 7 4l2 14a3 3 0 0 1-3 3H10a3 3 0 0 1-3-3Z" fill="#e9c98a" stroke="#6b4a12" stroke-width="2" stroke-linejoin="round"/><path d="M11 11h10" stroke="#6b4a12" stroke-width="2"/><circle cx="14" cy="19" r="1.6" fill="#6b4a12"/><circle cx="18.5" cy="21.5" r="1.6" fill="#6b4a12"/><circle cx="16" cy="24.5" r="1.6" fill="#6b4a12"/><path d="M16 7c-1-3 1-5 4-5-1 2-1 4-4 5Z" fill="#4fcf5e" stroke="#1f6a2c" stroke-width="1.2"/></svg>',
  carrot: '<svg viewBox="0 0 32 32"><path d="M20 9c3 0 5 2 4 5L11 28c-1 1-3 0-2-2l7-14c1-2 2-3 4-3Z" fill="#ff8a2a" stroke="#7a3a08" stroke-width="2" stroke-linejoin="round"/><path d="M14 19l2 1M12.5 23l2 1M17 14.5l2 1" stroke="#7a3a08" stroke-width="1.6" stroke-linecap="round"/><path d="M21 8c-1-3 0-5 2-6M23 9c1-3 4-4 6-3M22.5 8.5C24 6 27 6 28 8" fill="none" stroke="#2f9a3c" stroke-width="2.4" stroke-linecap="round"/></svg>',
  pickaxe: '<svg viewBox="0 0 32 32"><path d="M7 28 21 12" stroke="#5a3414" stroke-width="5" stroke-linecap="round"/><path d="M7 28 21 12" stroke="#c98a52" stroke-width="2.6" stroke-linecap="round"/><path d="M6.5 9C12 3 21 2 28 6c-3-.5-7 .2-10.5 3.2L23 15c-3-1-6.5-4-7.5-5.5C12.5 8 9 8.2 6.5 9Z" fill="#fff3d6" stroke="#5a3414" stroke-width="2" stroke-linejoin="round"/></svg>'
};
const BOLT = '<svg viewBox="0 0 24 24"><path d="M13.5 2 5 13.5h6L9.5 22 19 9.5h-6.2Z"/></svg>';
const HEART = '<svg viewBox="0 0 24 24"><path d="M12 21C5 15.5 2.5 12 2.5 8.5 2.5 5.5 4.8 3.5 7.3 3.5c1.9 0 3.6 1 4.7 2.7C13.1 4.5 14.8 3.5 16.7 3.5c2.5 0 4.8 2 4.8 5C21.5 12 19 15.5 12 21Z"/><path class="sh" d="M6 8.5c0-1.5 1-2.5 2.2-2.6"/></svg>';
const $ = id => document.getElementById(id);

// a little isometric cube drawn with the block's own pixel textures
const cubeCache = {};
function cube(blockId){
  if (cubeCache[blockId]) return cubeCache[blockId];
  const mats = blockMaterials[blockId], c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
  const img = i => mats[i].map.image, s = 22, cx = 32, top = 8;
  g.setTransform(1, .5, -1, .5, cx, top); g.drawImage(img(2), 0, 0, 16, 16, 0, 0, s, s);
  g.setTransform(1, .5, 0, 1, cx - s, top + s * .5); g.drawImage(img(4), 0, 0, 16, 16, 0, 0, s, s); g.fillStyle = 'rgba(0,0,0,.12)'; g.fillRect(0, 0, s, s);
  g.setTransform(1, -.5, 0, 1, cx, top + s); g.drawImage(img(0), 0, 0, 16, 16, 0, 0, s, s); g.fillStyle = 'rgba(0,0,0,.28)'; g.fillRect(0, 0, s, s);
  return cubeCache[blockId] = `<img src="${c.toDataURL()}" alt="">`;
}
// painted item pictures (owner 2026-11-27: the drawn icons looked cheap); items without one keep their drawn icon or block cube
const PAINTED = new Set(['axe', 'shovel', 'sword', 'sword_stone', 'sword_iron', 'sword_copper', 'sword_silver', 'sword_gold', 'sword_diamond', 'can', 'seeds', 'apple', 'carrot', 'gel', 'plan_beaver']);   // pickaxe and hoe join when their paintings pass review
export const iconOf = id => { if (PAINTED.has(id)) return `<img class="pic" src="${new URL(`../../img/items/${id}.png`, import.meta.url).href}" alt="" draggable="false">`; const it = ITEMS[id]; return it && it.look !== undefined ? cube(it.look) : it && it.place !== undefined ? cube(it.place) : (SVG[id] || SVG.hand); };

export class Hud {
  constructor(game){
    this.g = game; if (game._coinOff) game._coinOff(); game._coinOff = game.bus.on('coins', e => game.hud && game.hud.coins(e)); queueMicrotask(() => this.coins());
    this.bar = $('bar'); this.heartsEl = $('hearts'); this.bagEl = $('bagGrid');
    for (let i = 0; i < HOTBAR; i++){ const d = document.createElement('div'); d.className = 'slot'; d.onclick = () => game.inv.select(i); this.bar.appendChild(d); }
    const bagBtn = document.createElement('div'); bagBtn.className = 'slot bagbtn'; bagBtn.id = 'bBag'; bagBtn.innerHTML = '<svg viewBox="0 0 32 32"><path d="M8 11h16l1.5 16h-19Z" fill="#c98a52" stroke="#4a2a0e" stroke-width="2" stroke-linejoin="round"/><path d="M12 11V9a4 4 0 0 1 8 0v2" fill="none" stroke="#4a2a0e" stroke-width="2.2"/><path d="M11 17h10" stroke="#ffd76b" stroke-width="2.4" stroke-linecap="round"/></svg>';
    bagBtn.onclick = () => this.bag(true); bagBtn.hidden = true; bagBtn.style.display = 'none'; this.bar.appendChild(bagBtn);   // the bag now opens from the round button beside the main one
    this.heartsEl.innerHTML = HEART.repeat(5); $('stam').innerHTML = '<i></i><u></u>';
    if (!document.getElementById('hdefs')) document.body.insertAdjacentHTML('beforeend', '<svg id="hdefs" width="0" height="0" style="position:absolute"><defs><linearGradient id="halfHeart"><stop offset=".5" stop-color="#ff3f4d"/><stop offset=".5" stop-color="#5a3a2a"/></linearGradient></defs></svg>');
    const cr = document.createElement('div'); cr.className = 'slot bagbtn'; cr.id = 'bCraft'; cr.innerHTML = '<svg viewBox="0 0 32 32"><path d="M6 26 17 15" stroke="#4a2a0e" stroke-width="5" stroke-linecap="round"/><path d="M6 26 17 15" stroke="#c98a52" stroke-width="2.6" stroke-linecap="round"/><path d="M14.5 8.5 20 3l9 9-5.5 5.5Z" fill="#fff3d6" stroke="#5a3414" stroke-width="2" stroke-linejoin="round"/></svg>'; cr.onclick = () => this.craft(true); this.bar.appendChild(cr);
    game.bus.on('inv', e => { this.slots(); if (e.gained > 0 && e.slot >= 0) this.bump(e.slot); });
    const setP = $('set'); $('gear').onclick = () => setP.classList.add('on'); $('setX').onclick = () => setP.classList.remove('on');
    setP.addEventListener('pointerdown', e => { if (e.target === setP) setP.classList.remove('on'); });
    $('lTh').onclick = () => { i18n.set('th'); game.track('setting_change', { key: 'lang', value: 'th' }); }; $('lEn').onclick = () => { i18n.set('en'); game.track('setting_change', { key: 'lang', value: 'en' }); };
    $('sOn').onclick = () => { game.sound.set(true); this.syncSet(); }; $('sOff').onclick = () => { game.sound.set(false); this.syncSet(); };
    document.querySelectorAll('#skins button').forEach(b => b.onclick = () => this.skin(b.dataset.s));
    this.skin((location.search.match(/skin=([abc])/) || [])[1] || store.get('fc-skin', 'c'));
    i18n.onChange(() => { this.syncSet(); this.who(); });
    $('who').onclick = () => game.nextAvatar();
    $('bView').onclick = () => game.toggleView();
    $('craftX').onclick = () => this.craft(false); $('craftP').addEventListener('pointerdown', e => { if (e.target === $('craftP')) this.craft(false); });
    $('mOn').onclick = () => { game.music.set(true); this.syncSet(); }; $('mOff').onclick = () => { game.music.set(false); this.syncSet(); };
    $('bagX').onclick = () => this.bag(false); $('bagP').addEventListener('pointerdown', e => { if (e.target === $('bagP')) this.bag(false); });
    this.slots(); this.syncSet(); this.view(game.cam ? game.cam.mode : 'third');
  }
  skin(k){ document.body.classList.remove('skin-a', 'skin-b', 'skin-c'); document.body.classList.add('skin-' + k); store.set('fc-skin', k); document.querySelectorAll('#skins button').forEach(b => b.classList.toggle('on', b.dataset.s === k)); }
  syncSet(){ $('lTh').classList.toggle('on', i18n.lang === 'th'); $('lEn').classList.toggle('on', i18n.lang === 'en'); $('sOn').classList.toggle('on', this.g.sound.on); $('sOff').classList.toggle('on', !this.g.sound.on); $('mOn').classList.toggle('on', this.g.music.on); $('mOff').classList.toggle('on', !this.g.music.on); }
  slotHtml(s){ if (!s) return ''; const it = ITEMS[s.id], k = it.dur && s.d !== undefined ? s.d / it.dur : 1;
    const bar = k < 1 ? `<i class="dur"><u style="width:${Math.max(4, k * 100).toFixed(0)}%;background:${k > .5 ? '#6BCB4F' : k > .2 ? '#FFC94D' : '#E5484D'}"></u></i>` : '';   // wear bar, shown once used
    return iconOf(s.id) + (it.stack > 1 ? `<b class="n">${s.n}</b>` : '') + bar; }
  slots(){
    const inv = this.g.inv;
    for (let i = 0; i < HOTBAR; i++){ const c = this.bar.children[i]; c.innerHTML = this.slotHtml(inv.slots[i]); c.classList.toggle('on', i === inv.sel); c.classList.toggle('none', !inv.slots[i]); }
    // one main button whose picture follows what is held (owner, 2026-11-26): hammer = digging tools, sword = weapons, hand = nothing,
    // watering can = watering, box = things you place, sprout = seeds, apple = food. The pictures are painted buttons in img/ui/b/.
    const it = inv.item, kind = it.melee && !it.tool ? 'sword' : it.tool ? 'hammer' : it.farm === 'water' ? 'water' : it.farm === 'plant' ? 'sprout' : it.food ? 'apple' : it.place !== undefined ? 'box' : 'hand';
    const m = $('bMine'); if (m.dataset.kind !== kind){ m.dataset.kind = kind; m.innerHTML = ''; m.classList.remove('swap'); void m.offsetWidth; m.classList.add('swap'); }
    this.mainUses = ['water', 'sprout', 'apple', 'box'].includes(kind);   // these act once per press (place, plant, water, eat); the rest dig or hit while held
    if ($('bagP').classList.contains('on')) this.drawBag(); if ($('craftP').classList.contains('on')) this.drawCraft();
  }
  bag(open){ $('bagP').classList.toggle('on', open); if (open){ this.pick = null; this.drawBag(); } }
  drawBag(){
    const inv = this.g.inv, el = this.bagEl; el.innerHTML = '';
    inv.slots.forEach((s, i) => { const d = document.createElement('div'); d.className = 'slot' + (i < HOTBAR ? ' hot' : '') + (i === this.pick ? ' on' : ''); d.innerHTML = this.slotHtml(s);
      d.onclick = () => { if (this.pick === null || this.pick === undefined){ this.pick = i; } else { if (this.pick !== i) inv.swap(this.pick, i); this.pick = null; } this.drawBag(); };
      el.appendChild(d); if (i === HOTBAR - 1){ const br = document.createElement('div'); br.className = 'bagsep'; el.appendChild(br); } });
  }
  craft(open){ $('craftP').classList.toggle('on', open); if (open) this.drawCraft(); }
  drawCraft(){
    const inv = this.g.inv, el = $('craftList'); el.innerHTML = '';
    RECIPES.forEach(r => { if (Object.keys(r.need).some(i => ITEMS[i] && ITEMS[i].rare && !inv.count(i))) return;   // recipes needing a material not found yet stay hidden
      const ok = inv.canCraft(r), d = document.createElement('button'); d.className = 'recipe' + (ok ? ' ok' : '');
      d.innerHTML = `<span class="out">${iconOf(r.out)}${r.n > 1 ? `<b class="n">${r.n}</b>` : ''}</span><span class="eq">=</span>` + Object.entries(r.need).map(([id, n]) => `<span class="ing ${inv.count(id) >= n ? 'have' : 'miss'}">${iconOf(id)}<b class="n">${inv.count(id)}/${n}</b></span>`).join('');
      d.onclick = () => { if (inv.craft(r)){ this.g.sound.play('star'); this.g.track('craft', { item: r.out, n: r.n }); this.drawCraft(); } else { this.g.sound.play('no'); d.classList.remove('no'); void d.offsetWidth; d.classList.add('no'); } };
      el.appendChild(d); });
  }
  stamina(sp, max){ const k = Math.max(0, sp / max); $('stam').firstChild.style.width = $('stam').lastChild.style.width = (k * 100).toFixed(1) + '%'; $('stam').classList.toggle('low', k < .25); $('stam').classList.toggle('empty', sp <= 0); }
  fade(mid){ const f = $('fade'); f.classList.add('on'); setTimeout(() => { mid && mid(); setTimeout(() => f.classList.remove('on'), 600); }, 900); }
  bump(i){ const c = this.bar.children[i]; if (!c) return; c.classList.remove('got'); void c.offsetWidth; c.classList.add('got'); }
  shake(i){ const c = i === undefined ? this.bar : this.bar.children[i]; if (!c) return; c.classList.remove('no'); void c.offsetWidth; c.classList.add('no'); }
  hearts(hp, max){ const was = this.hpWas; this.hpWas = hp; [...this.heartsEl.children].forEach((h, i) => { const v = hp - i * 2; h.style.display = i < max / 2 ? '' : 'none'; h.classList.toggle('off', v <= 0); h.classList.toggle('half', v === 1); });  
    if (was !== undefined && was !== hp) [...this.heartsEl.children].forEach((h, i) => { const lo = Math.min(was, hp), hi = Math.max(was, hp); if (i * 2 < hi && (i + 1) * 2 > lo){ const c = hp < was ? 'lost' : 'gain'; h.classList.remove('lost', 'gain'); void h.getBoundingClientRect(); h.classList.add(c); setTimeout(() => h.classList.remove(c), 700); } }); }
  // a picked-up item flies from where it was in the world to its hotbar slot, then the slot bumps
  fly(id, pos, slot){ const c = this.bar.children[slot]; if (!c || slot < 0 || slot >= HOTBAR) return; const v = pos.clone().project(this.g.camera), r = c.getBoundingClientRect(), e = document.createElement('div');
    e.className = 'flyitem'; e.innerHTML = iconOf(id); const x0 = (v.x * .5 + .5) * innerWidth, y0 = (-v.y * .5 + .5) * innerHeight; e.style.transform = `translate(${x0}px,${y0}px) translate(-50%,-50%) scale(1.2)`; document.body.appendChild(e);
    requestAnimationFrame(() => requestAnimationFrame(() => { e.style.transform = `translate(${r.left + r.width / 2}px,${r.top + r.height / 2}px) translate(-50%,-50%) scale(.7)`; e.style.opacity = '.85'; }));
    setTimeout(() => { e.remove(); this.bump(slot); }, 380); }
  hurt(){ this.heartsEl.classList.remove('hit'); void this.heartsEl.offsetWidth; this.heartsEl.classList.add('hit'); $('hurt').classList.add('on'); setTimeout(() => $('hurt').classList.remove('on'), 120); }
  who(){ const d = this.g.player.avatar; if (!d) return; $('whoName').textContent = d[i18n.lang]; $('faceImg').src = 'img/face-' + d.id + '.png'; }
  view(mode){ document.body.classList.toggle('fp', mode === 'first'); }
  goal(text){ $('goalN').textContent = text; $('stars').style.display = text ? 'flex' : 'none'; document.body.classList.toggle('goal-on', !!text); }
  // coin counter: counts up a little at a time and bounces when coins come in; shakes when there are not enough
  coins(e){ const el = $('coins'), nEl = $('coinN'); if (!el) return; const to = e ? e.n : this.g.coins.get();
    if (e && e.short){ el.classList.remove('short'); void el.offsetWidth; el.classList.add('short'); this.g.sound.play('no'); return; }
    cancelAnimationFrame(this.coinRaf); const from = this.coinShown ?? to; this.coinShown = to;
    if (!e || from === to){ nEl.textContent = to; return; }
    if (e.delta > 0){ el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); this.g.sound.play('star'); }
    const t0 = performance.now(), dur = Math.min(1200, 300 + Math.abs(to - from) * 40);
    const step = now => { const k = Math.min(1, (now - t0) / dur), v = Math.round(from + (to - from) * (1 - (1 - k) ** 3)); nEl.textContent = v; if (k < 1) this.coinRaf = requestAnimationFrame(step); };
    this.coinRaf = requestAnimationFrame(step); }
  say(text, ms = 0){ const h = $('hint'); h.textContent = text; h.style.opacity = 1; clearTimeout(this.sayT); if (ms) this.sayT = setTimeout(() => h.style.opacity = 0, ms); }
  hideHint(ms = 0){ clearTimeout(this.sayT); this.sayT = setTimeout(() => $('hint').style.opacity = 0, ms); }
}
