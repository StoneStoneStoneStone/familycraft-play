// The camera rule every quest room shares. The room picks the base view (yaw, pitch, dist) for the level; the age band only limits turning:
//   a = 'lock'   every frame the view goes back to the base view (a drag has no lasting effect)
//   b = 'step90' you may turn while dragging; when the drag ends the yaw eases to the nearest base yaw + k * 90 degrees; pitch and distance stay at base
//   c = 'free'   nothing is held, and a "reset view" button puts the base view back
// The mode comes from the shell's cameraRule(band). follow.js is not touched: the room calls update(dt) from its own update.
// First person breaks the framing of these rooms, so the engine's first-person button (#bView) is hidden while a quest room is up,
// and a camera that is in first person goes back to third person.
import { cameraRule } from './vendor/shell.js';
import { i18n } from '../../core/i18n.js';
import { addStyle, keepClear } from './band-chip.js';

const BAND = { a: 0, b: 1, c: 2 };
const QUARTER = Math.PI / 2;
const RESET_LABEL = { th: 'กลับมุมมองเดิม', en: 'Reset view' };
const ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="#4a2a0e" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12a8 8 0 1 1-2.6-5.9"/><path d="M20.5 3.5v5h-5"/><circle cx="12" cy="12" r="2" fill="#4a2a0e"/></svg>';

// Where the reset button would like to sit (keepClear takes the first free one, else scans from the top left): docked under the band chip,
// then left of it, then down the right edge under the top HUD, then above the right-hand round buttons (use / sit / jump). These are HUD
// columns, away from the room's signs (keepClear also checks each spot against the signs' screen boxes).
function dockSpots(w, h){
  const out = [], chip = document.getElementById('fcqChip'), G = 8;
  if (chip && chip.isConnected && chip.style.display !== 'none'){ const r = chip.getBoundingClientRect();
    if (r.width){ out.push({ x: r.right - w, y: r.bottom + G }, { x: r.left + (r.width - w) / 2, y: r.bottom + G }, { x: r.left - w - G, y: r.top + (r.height - h) / 2 }, { x: r.left - w - 4, y: r.top + (r.height - h) / 2 });
      for (let y = r.bottom + G; y < innerHeight - h; y += 4) out.push({ x: innerWidth - 6 - w, y });      // down the right edge, just under the top HUD (phone: under the goal and the banner), else lower down that edge
    } }
  const right = ['bUse', 'bSit', 'bJump', 'bMine'].map(id => document.getElementById(id)).filter(e => e && getComputedStyle(e).display !== 'none').map(e => e.getBoundingClientRect()).filter(r => r.width && r.left > innerWidth / 2);
  if (right.length){ const top = Math.min(...right.map(r => r.top)), rr = Math.max(...right.map(r => r.right)); out.push({ x: rr - w, y: top - h - G - 4 }); }
  return out;
}

// opts: { band: 'a'|'b'|'c', base: () => ({ yaw, pitch, dist }), focus?: (target, cam) => ({ x, y, z }) | null } ; returns { update(dt), reset(), setBand(b), mode, destroy() }
// focus (optional) replaces the point the follow camera orbits (normally the player): a room can frame a fixed area and only follow the player at the edges.
export function makeCameraRule(game, { band, base, focus }){
  let replace = null, mode = cameraRule(BAND[band] ?? 1).rotate, last = null, dxSeen = false, down = false, turning = false, idle = 0, btn = null, kc = null;
  const cam = () => game.cam;
  const bv = () => document.getElementById('bView');
  // leave first person for this room only: like cam.toggle() but without saving 'fc-view', so the player's own choice survives
  const noFirstPerson = () => { const b = bv(); if (b) b.style.display = 'none'; const c = cam(); if (c.mode === 'first'){ c.mode = 'third'; c.inited = false; if (game.hud && game.hud.view) game.hud.view('third'); } };
  const showFirstPersonButton = () => { const b = bv(); if (b) b.style.display = ''; };

  const canvas = game.canvas, onDown = e => { if (e.target === canvas) down = true; }, onUp = () => { down = false; };
  addEventListener('pointerdown', onDown, true); addEventListener('pointerup', onUp, true); addEventListener('pointercancel', onUp, true); addEventListener('blur', onUp);

  // game.js runs room.update before cam.update, and cam.update applies the drag. So the drag is cut off inside cam.update itself:
  // lock gets no turn, pitch or zoom; step90 gets turns only (and the real dx tells us a drag is going on). Original restored in destroy.
  const orig = cam().update;
  cam().update = function(dt, target, h, look){
    if (this.mode === 'first') return orig.call(this, dt, target, h, look);
    if (focus){ const f = focus(target, this); if (f) target = f; }
    if (mode === 'free' || !look) return orig.call(this, dt, target, h, look);
    if (mode === 'step90'){ if (look.dx) dxSeen = true; return orig.call(this, dt, target, h, { ...look, dy: 0, zoom: 0 }); }
    return orig.call(this, dt, target, h, { ...look, dx: 0, dy: 0, zoom: 0 });
  };
  function setBase(){ const c = cam(), b = base(); if (!b) return; c.yaw = b.yaw; c.pitch = b.pitch; c.dist = b.dist; last = c.yaw; turning = false; idle = 0; }
  function ensureButton(){
    if (mode !== 'free'){ if (btn) btn.style.display = 'none'; return; }
    if (!btn){
      addStyle(); btn = document.createElement('button'); btn.id = 'fcqReset'; btn.type = 'button'; btn.className = 'fcq'; btn.dataset.fcqPrio = '1'; btn.innerHTML = ICON;
      const lab = (RESET_LABEL[i18n.lang] || RESET_LABEL.en); btn.setAttribute('aria-label', lab); btn.title = lab;
      btn.addEventListener('click', () => setBase()); document.body.appendChild(btn); kc = keepClear(btn, { prefer: dockSpots });
    }
    if (btn.style.display === 'none'){ btn.style.display = ''; kc.check(true); }
  }
  addEventListener('pagehide', destroy);
  noFirstPerson(); ensureButton();

  function update(dt){
    const c = cam(), b = base(); if (!b) return;
    if (c.mode === 'first') noFirstPerson();
    if (mode === 'lock'){ c.yaw = b.yaw; c.pitch = b.pitch; c.dist = b.dist; last = c.yaw; return; }
    if (mode === 'free'){ ensureButton(); return; }
    // step90: pitch and distance stay at base; the yaw may be dragged, then eases to the nearest quarter turn
    c.pitch = b.pitch; c.dist = b.dist;
    if (dxSeen){ turning = true; idle = 0; dxSeen = false; } else idle++;           // look.dx seen by cam.update: a drag is turning the view
    if (turning && ((!down && idle >= 1) || idle >= 40)){
      const target = b.yaw + Math.round((c.yaw - b.yaw) / QUARTER) * QUARTER, d = target - c.yaw;
      if (Math.abs(d) < .003){ c.yaw = target; turning = false; } else c.yaw += d * Math.min(1, Math.max(dt, .016) * 10);
    }
    last = c.yaw;
  }
  function destroy(){
    cam().update = orig; showFirstPersonButton(); removeEventListener('pagehide', destroy); removeEventListener('pointerdown', onDown, true); removeEventListener('pointerup', onUp, true); removeEventListener('pointercancel', onUp, true); removeEventListener('blur', onUp);
    clearTimeout(replace); if (kc) kc.stop(); if (btn) btn.remove(); btn = null;
  }
  return {
    update, destroy,
    view: () => base(),                                    // the base view the rule holds the camera to
    get mode(){ return mode; },
    // level start or the reset button: the base view comes back (and a first-person camera goes to third person)
    reset(){ noFirstPerson(); setBase(); if (kc){ clearTimeout(replace); replace = setTimeout(() => kc.check(true), 400); } },      // a new level moves the signs: place the button again once the camera has settled
    setBand(b){ mode = cameraRule(BAND[b] ?? 1).rotate; ensureButton(); },
    get button(){ return btn; }
  };
}
