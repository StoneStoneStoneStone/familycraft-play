// Framing for quest rooms whose task area is wider than a player-centred camera shows (dig, blueprint on a phone).
// solveFrame finds a look-at point C and a camera distance D so that every frame item fits, as big as possible, inside the largest
// screen rect the HUD leaves free; frameFocus then gives the camera rule the point to orbit, sliding C only when the player would leave that rect.
// follow.js keeps its own (clamped) distance: the rest of D is put in the focus point, along the view direction.
import * as THREE from 'three';
import { hudRects } from './band-chip.js';

export const FRAME_PAD = 3;       // px kept between the framed content and the free rect's edge
// The free rects: under the top HUD row, above a bottom row, between the bottom boxes that reach higher (joystick, action buttons).
// The rooms' own buttons (band chip, reset view) are left out: they dock away from the registered signs themselves.
export function freeRects(opts = {}){
  const vw = innerWidth, vh = innerHeight, skip = [...document.querySelectorAll('.fcq, #fcqMenu, #fcqShade')];
  const boxes = hudRects(skip, false, false).filter(b => b.r > b.l && b.b > b.t), top = boxes.filter(b => b.t < vh * .3), low = boxes.filter(b => b.t >= vh * .3);      // a button that starts below the top row (the escape goggles, mid-left) is a side box, not part of the top row
  const heads = top.map(b => ({ l: b.l, r: b.r, b: b.b + 4 })); const out = [];      // the top row, column by column: a gap is only kept clear of the top boxes above it (the band chip and stars at the far right do not push the middle down)
  const hint = document.getElementById('hint'); if (hint){ const r = hint.getBoundingClientRect(), hw = Math.min(vw * (vw < 720 ? .7 : .6), 420);
    if (r.height){ const room = vh > vw ? r.top + Math.max(r.height, 60) + 30 : r.top + Math.max(r.height, opts.hintRoom || 62) + 26;      // the goal banner can wrap to one more line later (it changes text after the intro): keep room for two lines
      heads.push({ l: (vw - hw) / 2, r: (vw + hw) / 2, b: room }); } }
  const topOf = (l, r) => Math.max(0, ...heads.filter(h => h.r > l && h.l < r).map(h => h.b));
  for (const B of [...new Set([...low.map(b => b.t), vh])].sort((p, q) => p - q)){
    const spans = low.filter(b => b.t < B).map(b => [Math.max(0, b.l), Math.min(vw, b.r)]).sort((p, q) => p[0] - q[0]);
    let x = 0; const gaps = []; for (const [l, r] of spans){ if (l > x) gaps.push([x, l]); x = Math.max(x, r); } if (x < vw) gaps.push([x, vw]);
    for (const [l, r] of gaps){ const T = topOf(l, r); if (r - l > 120 && B - 4 - T > 120) out.push({ l, r, t: T, b: B - 4 }); }
  }
  return out.length ? out : [{ l: 0, r: vw, t: topOf(0, vw), b: vh }];
}
// The goal banner changes size when its text changes (intro, goal, a hint): frame again then, so nothing ends up under it. Returns a stop function.
export function watchHint(fn){
  const h = document.getElementById('hint'); if (!h || typeof ResizeObserver === 'undefined') return () => {};
  let t = 0; const ro = new ResizeObserver(() => { clearTimeout(t); t = setTimeout(fn, 200); }); ro.observe(h);
  addEventListener('pagehide', () => ro.disconnect()); return () => { clearTimeout(t); ro.disconnect(); };
}
const dirOf = (yaw, pitch) => new THREE.Vector3(-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));      // look-at point -> camera, as follow.js
// camera: the game camera (fov); items: [{ p: Vector3, w, h }] (billboard-sized boxes facing the camera); view: { yaw, pitch };
// start: the first C (only its depth along the view matters: C moves across the screen, never toward the camera)
export function solveFrame(camera, items, view, start, opts){
  const V = THREE.Vector3, fov = camera.fov * Math.PI / 180, sc = new THREE.PerspectiveCamera(camera.fov, innerWidth / innerHeight, .1, 200);
  const dir = dirOf(view.yaw, view.pitch), up = new V(0, 1, 0), q = new V();
  const bbox = (C, D) => { sc.position.copy(C).addScaledVector(dir, D); sc.lookAt(C); sc.updateMatrixWorld(); const right = new V(1, 0, 0).applyQuaternion(sc.quaternion); right.y = 0; right.normalize();
    let l = 1e9, t = 1e9, r = -1e9, bt = -1e9;
    for (const it of items) for (const [i, j] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]){ q.copy(it.p).addScaledVector(right, i * it.w / 2).addScaledVector(up, j * it.h / 2).project(sc);
      const x = (q.x + 1) / 2 * innerWidth, y = (1 - q.y) / 2 * innerHeight; l = Math.min(l, x); r = Math.max(r, x); t = Math.min(t, y); bt = Math.max(bt, y); }
    return { l, t, r, b: bt, right }; };
  const ppuAt = D => (innerHeight / 2) / (D * Math.tan(fov / 2));
  const fit = rect => {
    const C = start.clone(); let D = 16, bb;
    for (let k = 0; k < 16; k++){
      bb = bbox(C, D); const ppu = ppuAt(D), rw = rect.r - rect.l - 2 * FRAME_PAD, rh = rect.b - rect.t - 2 * FRAME_PAD;
      C.addScaledVector(bb.right, ((bb.l + bb.r) / 2 - (rect.l + rect.r) / 2) / ppu); C.y -= ((bb.t + bb.b) / 2 - (rect.t + rect.b) / 2) / ppu / Math.cos(view.pitch);
      D = Math.max(5, Math.min(60, D * Math.max((bb.r - bb.l) / rw, (bb.b - bb.t) / rh)));
    }
    bb = bbox(C, D); return { C, D, rect, bb, right: bb.right, ppu: ppuAt(D) };
  };
  let best = null; for (const rect of freeRects(opts)){ const f = fit(rect); if (!best || f.D < best.D) best = f; }      // the nearest camera = the biggest picture
  best.dir = dir; best.sc = sc; best.pitch = view.pitch; sc.position.copy(best.C).addScaledVector(dir, best.D); sc.lookAt(best.C); sc.updateMatrixWorld();
  return best;
}
// the point the follow camera orbits (target = the player body, c = the follow camera): C, slid just enough to keep the player inside the free rect,
// pushed out along the current view so follow.js at its own distance c.dist ends up D away from C. follow.js looks at target + 1 up.
export function frameFocus(f, target, c){
  if (!f) return null; const V = THREE.Vector3, m = 28, C = f.C.clone(), r = f.rect, cosP = Math.cos(f.pitch);
  const px = y => { const v = new V(target.x, y, target.z).project(f.sc); return [(v.x + 1) / 2 * innerWidth, (1 - v.y) / 2 * innerHeight]; }, feet = px(target.y + .1), head = px(target.y + 1.8);
  if (feet[0] < r.l + m) C.addScaledVector(f.right, -(r.l + m - feet[0]) / f.ppu); else if (feet[0] > r.r - m) C.addScaledVector(f.right, (feet[0] - (r.r - m)) / f.ppu);
  if (head[1] < r.t + m) C.y += (r.t + m - head[1]) / f.ppu / cosP; else if (feet[1] > r.b - m) C.y -= (feet[1] - (r.b - m)) / f.ppu / cosP;
  const d = dirOf(c.yaw, c.pitch), off = Math.max(0, f.D - c.dist);
  return { x: C.x + d.x * off, y: C.y + d.y * off - 1, z: C.z + d.z * off };
}
