// Game numbers in one place. The code keeps sensible defaults (items.js, voxel.js, things.js and TUNING below);
// data/game-data.json, written by the back-office page (admin.html), overrides them at start-up. A "try it" copy
// in localStorage (fc-data-try) wins over the file so a designer can test without saving.
import { ITEMS, RECIPES } from '../items/items.js';
import { BLOCKS } from '../world/voxel.js';
import { KINDS } from '../entity/things.js';
import { store } from '../core/core.js';

export const TUNING = {
  player: { hp: 10, stamina: 100, walk: 3.6, tiredWalk: 2.0, jump: 7.4, tiredJump: 6.2 },
  stamina: { jump: 3, hit: 5, airSwing: 1, digPerSec: 4, runPerSec: 1.2, till: 3, restSit: 16, restIdle: 3 },
  npc: { talkRange: 2.6, noticeRange: 7 },   // hosts: the talk button shows within this many cells; they turn and wave within this many
  fox: { framePlanks: 6, wheelStone: 1, rearPlanks: 4, deliveryRange: 2.6, rewardApples: 2 },   // Zoomy Fox's fix-my-kart quest (design/island/fox-quest-spec.md)
  pickup: { magnet: 1.8, streakWindow: 1.2 },
  coins: { start: 0, bridgeJob: 10 },
  shop: { hatSand: 0, hatFern: 15, hatSky: 20 },   // dress-up shop prices in coins (0 = free starter item)
  clock: { dayMinutes: 20, startHour: 6, nightLight: .22, nightFogNear: 8, nightFogFar: 26, playerGlow: .6 },   // nightLight: lowest light at night (0-1); fog in cells; playerGlow: faint light round the player so small children are never lost
  mob: { nightSight: 1.7, nightSpeed: 1.15, angryTime: 12, callRange: 8 },   // critters: at night they see this many times further and run a bit faster; by day a hit one stays angry this many seconds and calls its kind within this many cells   // island day: real minutes of play per day, hour a new island starts at, lowest soft light at night (0-1)   // coins: what a new player starts with; Uncle Beaver's wage for a won bridge job (owner 2026-11-27)
  ore: { ironChance: .05, copperChance: .04, silverChance: .025, diamondChance: .012, silverDepth: 3, diamondDepth: 2 },   // chance a buried stone block is that ore; silver/diamond only at or below that layer (bedrock = 0)
  dig: { wrongTool: 1, swingEvery: .28, tiredSlow: 2 },
  quest: { levels: 4, stars: 3, hintRungs: 3, sinkDelay: .6, codeStepMs: 450, codeMaxSteps: 200, digLayers: 5, peekMs: 3000,
    codeMaxLoop: 9, codeFreeA: 4, codeFreeB: 5, codeFreeC: 6, blueprintFree: 6, digMaxPerEra: 2, digFree: 3, escapeFree: 3, escapeHit: .55 }   // quest mini-game rooms
};

// fields the editor may change, per group (anything else in the file is ignored)
export const FIELDS = {
  item:   ['dmg', 'reach', 'dig', 'heal', 'stack', 'dur'],
  block:  ['hard'],
  critter:['hp', 'speed', 'sight', 'respawn', 'roam'],
  tuning: Object.fromEntries(Object.entries(TUNING).map(([k, v]) => [k, Object.keys(v)]))
};
const num = v => typeof v === 'number' && isFinite(v) && v >= 0 && v < 1e5;

// the current values, as plain data (what the editor shows and what gets saved)
export function snapshot(){
  const items = {}, blocks = {}, critters = {};
  for (const [id, it] of Object.entries(ITEMS)){ const o = {};
    if (it.melee){ o.dmg = it.melee.dmg; o.reach = it.melee.reach; } if (it.tool) o.dig = it.dig ?? 4; if (it.food) o.heal = it.food.heal; if (it.stack) o.stack = it.stack; if (it.dur) o.dur = it.dur;
    if (Object.keys(o).length) items[id] = o; }
  for (const b of BLOCKS) if (b.solid && b.hard !== Infinity) blocks[b.id] = { hard: b.hard };
  for (const [id, k] of Object.entries(KINDS)) critters[id] = { hp: k.hp, speed: k.speed, sight: k.sight, respawn: k.respawn, roam: k.roam ?? 8 };
  return { v: 1, items, blocks, critters, recipes: RECIPES.map(r => ({ out: r.out, n: r.n, need: { ...r.need } })), tuning: JSON.parse(JSON.stringify(TUNING)) };
}

export function apply(d){
  if (!d || typeof d !== 'object') return;
  for (const [id, o] of Object.entries(d.items || {})){ const it = ITEMS[id]; if (!it || !o) continue;
    if (it.melee && num(o.dmg)) it.melee.dmg = o.dmg; if (it.melee && num(o.reach)) it.melee.reach = o.reach;
    if (it.tool && num(o.dig) && o.dig > 0) it.dig = o.dig; if (it.food && num(o.heal)) it.food.heal = o.heal; if (num(o.stack) && o.stack >= 1) it.stack = Math.round(o.stack); if (it.dur && num(o.dur) && o.dur >= 1) it.dur = Math.round(o.dur); }
  for (const [id, o] of Object.entries(d.blocks || {})){ const b = BLOCKS.find(x => x.id === id); if (b && o && num(o.hard) && o.hard > 0 && b.hard !== Infinity) b.hard = o.hard; }
  for (const [id, o] of Object.entries(d.critters || {})){ const k = KINDS[id]; if (!k || !o) continue; for (const f of FIELDS.critter) if (num(o[f])) k[f] = o[f]; }
  if (Array.isArray(d.recipes) && d.recipes.length){ const ok = d.recipes.filter(r => r && ITEMS[r.out] && num(r.n) && r.n >= 1 && r.need && Object.keys(r.need).length && Object.entries(r.need).every(([i, n]) => ITEMS[i] && num(n) && n >= 1));
    if (ok.length) RECIPES.splice(0, RECIPES.length, ...ok.map(r => ({ out: r.out, n: Math.round(r.n), need: Object.fromEntries(Object.entries(r.need).map(([i, n]) => [i, Math.round(n)])) }))); }
  for (const [g, fs] of Object.entries(FIELDS.tuning)) for (const f of fs){ const v = d.tuning && d.tuning[g] && d.tuning[g][f]; if (num(v)) TUNING[g][f] = v; }
}

// start-up: saved file first, then a "try it" copy from the editor if there is one
export async function loadData(){
  try{ const r = await fetch('data/game-data.json', { cache: 'no-store' }); if (r.ok) apply(await r.json()); }catch(e){}
  const t = store.get('fc-data-try', null); if (t) apply(t);
}
