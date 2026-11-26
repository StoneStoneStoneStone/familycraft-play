// Items and the inventory. What an item does is data:
//   place: block id        -> the use button builds it
//   tool:  'shovel'|'axe'|'pickaxe'  -> digs matching blocks fast (and lets hard blocks drop); dig: speed x (default 4)
//   dur: uses before the tool wears out and breaks (owner 2026-11-27, like a block game); a bar under the slot shows what is left
//   melee: { dmg, reach }  -> the mine button swings it at critters (reach in world units, 1.5 = one cell around)
//   reach: cells          -> how far this item digs/places (default 1); for future long tools
//   food:  { heal }        -> the use button eats it
// Inventory: 6 hotbar slots + 24 bag slots, each { id, n } or null.
import { BLOCK } from '../world/voxel.js';

export const ITEMS = {
  hand:    { icon: 'hand' },
  soil:    { place: BLOCK.soil,   stack: 64 }, grass: { place: BLOCK.grass, stack: 64 }, stone: { place: BLOCK.stone, stack: 64 },
  log:     { place: BLOCK.log,    stack: 64 }, planks: { place: BLOCK.planks, stack: 64 }, leaves: { place: BLOCK.leaves, stack: 64 },
  sand:    { place: BLOCK.sand,   stack: 64 }, brick: { place: BLOCK.brick, stack: 64 }, gold: { place: BLOCK.gold, stack: 64 },
  apple:   { icon: 'apple', food: { heal: 2 }, stack: 16 },
  shovel:  { icon: 'shovel',  tool: 'shovel',  melee: { dmg: 1, reach: 1.5 }, stack: 1, dur: 120 },
  axe:     { icon: 'axe',     tool: 'axe',     melee: { dmg: 2, reach: 1.5 }, stack: 1, dur: 120 },
  pickaxe: { icon: 'pickaxe', tool: 'pickaxe', melee: { dmg: 2, reach: 1.5 }, stack: 1, dur: 120 },
  bed:     { place: BLOCK.bed, stack: 1 },
  hoe:     { icon: 'hoe',     tool: 'hoe',     melee: { dmg: 1, reach: 1.5 }, stack: 1, farm: 'till', dur: 80 },
  can:     { icon: 'can',     stack: 1, farm: 'water', dur: 150 },
  seeds:   { icon: 'seeds',   stack: 64, farm: 'plant', crop: 'carrot' },
  carrot:  { icon: 'carrot',  food: { heal: 3 }, stack: 32 },
  gel:     { icon: 'gel', stack: 64 },
  plan_beaver: { icon: 'plan', stack: 1, quest: true }   // Beaver's workshop plan: the reward for the first race win against Zoomy Fox
};
// Crafting: what you put in -> what you get. Shown in the craft panel in this order.
export const RECIPES = [
  { out: 'planks',  n: 4, need: { log: 1 } },
  { out: 'bed',     n: 1, need: { planks: 3, gel: 3 } },
  { out: 'pickaxe', n: 1, need: { planks: 2, stone: 3 } },
  { out: 'axe',     n: 1, need: { planks: 2, stone: 2 } },
  { out: 'shovel',  n: 1, need: { planks: 2, stone: 1 } },
  { out: 'brick',   n: 4, need: { stone: 2, sand: 2 } },
  { out: 'hoe',     n: 1, need: { planks: 2, stone: 1 } },
  { out: 'can',     n: 1, need: { stone: 3 } }
];
// Swords by material (owner 2026-11-27): one chunky short-sword shape, recoloured per material; better material = harder hit, lasts longer.
// The first sword is wood (id 'sword', so old saves keep it). Iron, copper, silver and diamond are set up here but are not found in the world yet,
// so their recipes stay hidden until the player holds that material. Damage and uses can be tuned in admin.html (weapons tab).
export const MATS = {
  wood:    { th: 'ไม้',     en: 'Wood',    blade: '#E3AD72', guard: '#9A6334', grip: '#7A4A2B', wrap: '#C98B5A', metal: 0 },
  stone:   { th: 'หิน',     en: 'Stone',   blade: '#AEB6BF', guard: '#7E8792', grip: '#7A4A2B', wrap: '#C98B5A', metal: 0 },
  iron:    { th: 'เหล็ก',   en: 'Iron',    blade: '#B9C3CE', guard: '#7E8A98', grip: '#5A3A22', wrap: '#C97A5C', metal: .35 },
  copper:  { th: 'ทองแดง', en: 'Copper',  blade: '#E0703F', guard: '#A2462A', grip: '#5A3A22', wrap: '#2FB39E', metal: .4 },
  silver:  { th: 'เงิน',    en: 'Silver',  blade: '#F7FAFF', guard: '#DDE6F2', grip: '#3A4A6B', wrap: '#4A9BD8', metal: .5 },
  gold:    { th: 'ทอง',    en: 'Gold',    blade: '#FFD45E', guard: '#E5A92E', grip: '#6B2E2A', wrap: '#D9504A', metal: .5 },
  diamond: { th: 'เพชร',   en: 'Diamond', blade: '#A6EEF5', guard: '#53C3D6', grip: '#3A2E6B', wrap: '#8E6BD8', metal: .15 }
};
export const SWORDS = [   // [material, item id, damage, uses, recipe]
  ['wood',    'sword',         2,  60, { planks: 2 }],
  ['stone',   'sword_stone',   3, 100, { planks: 1, stone: 2 }],
  ['iron',    'sword_iron',    4, 160, { planks: 1, iron: 2 }],
  ['copper',  'sword_copper',  5, 200, { planks: 1, copper: 2 }],
  ['silver',  'sword_silver',  6, 260, { planks: 1, silver: 2 }],
  ['gold',    'sword_gold',    7, 320, { planks: 1, gold: 2 }],
  ['diamond', 'sword_diamond', 9, 500, { planks: 1, diamond: 2 }]
];
for (const m of ['iron', 'copper', 'silver', 'diamond']) ITEMS[m] = { icon: 'ore', mat: m, stack: 64, rare: true, look: BLOCK[m + '_ore'] };   // dug from ore blocks; shown as a small ore block
SWORDS.forEach(([mat, id, dmg, dur, need], i) => { ITEMS[id] = { icon: id, kind: 'sword', mat, melee: { dmg, reach: 1.5 }, stack: 1, dur }; RECIPES.splice(4 + i, 0, { out: id, n: 1, need }); });
for (const [id, it] of Object.entries(ITEMS)){ it.id = id; if (it.place !== undefined) it.icon = 'block'; }
export const HOTBAR = 8, BAG = 22;   // 8 shortcut slots (owner 2026-11-27); 30 slots in all, so older saves still fit

export class Inventory {
  constructor(bus, start = []){
    this.bus = bus; this.slots = Array(HOTBAR + BAG).fill(null); this.sel = 0;
    if (Array.isArray(start)) start.forEach((s, i) => { if (s && ITEMS[s.id]) this.slots[i] = { id: s.id, n: s.n, ...(ITEMS[s.id].dur ? { d: s.d ?? ITEMS[s.id].dur } : {}) }; });
    else for (const [id, n] of Object.entries(start || {})) this.add(id, n, true);
  }
  get item(){ const s = this.slots[this.sel]; return s ? ITEMS[s.id] : ITEMS.hand; }
  count(id){ return this.slots.reduce((a, s) => a + (s && s.id === id ? s.n : 0), 0); }
  add(id, n = 1, quiet = false){
    const it = ITEMS[id]; if (!it) return 0; const max = it.stack || 1; let left = n, first = -1;
    for (let i = 0; i < this.slots.length && left; i++){ const s = this.slots[i]; if (s && s.id === id && s.n < max){ const k = Math.min(left, max - s.n); s.n += k; left -= k; if (first < 0) first = i; } }
    for (let i = 0; i < this.slots.length && left; i++) if (!this.slots[i]){ const k = Math.min(left, max); this.slots[i] = { id, n: k, ...(it.dur ? { d: it.dur } : {}) }; left -= k; if (first < 0) first = i; }
    if (!quiet) this.bus.emit('inv', { id, gained: n - left, slot: first }); return n - left;
  }
  takeSel(n = 1){ const s = this.slots[this.sel]; if (!s || s.n < n) return false; s.n -= n; if (!s.n) this.slots[this.sel] = null; this.bus.emit('inv', { gained: -n, slot: this.sel }); return true; }
  // one use of the held tool; at zero uses it breaks and leaves the slot (returns true when it broke)
  wear(n = 1){ const s = this.slots[this.sel], it = s && ITEMS[s.id]; if (!it || !it.dur) return false; s.d = Math.max(0, (s.d ?? it.dur) - n);
    if (s.d > 0){ this.bus.emit('inv', { wear: true, slot: this.sel }); return false; } this.slots[this.sel] = null; this.bus.emit('inv', { broke: s.id, slot: this.sel }); return true; }
  select(i){ if (i >= 0 && i < HOTBAR){ this.sel = i; this.bus.emit('inv', { select: true, slot: i }); } }
  swap(a, b){ [this.slots[a], this.slots[b]] = [this.slots[b], this.slots[a]]; this.bus.emit('inv', { swap: true }); }
  remove(id, n){ for (let i = this.slots.length - 1; i >= 0 && n; i--){ const s = this.slots[i]; if (s && s.id === id){ const k = Math.min(n, s.n); s.n -= k; n -= k; if (!s.n) this.slots[i] = null; } } }
  canCraft(r){ return Object.entries(r.need).every(([id, n]) => this.count(id) >= n); }
  craft(r){ if (!this.canCraft(r)) return false; for (const [id, n] of Object.entries(r.need)) this.remove(id, n); this.add(r.out, r.n); return true; }
  save(){ return this.slots.map(s => s && { id: s.id, n: s.n, ...(s.d !== undefined ? { d: s.d } : {}) }); }
}
