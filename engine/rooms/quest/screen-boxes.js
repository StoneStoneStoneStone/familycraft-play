// Screen boxes of a room's 3D signs, for the room-owned buttons (band chip, reset view) to keep off them.
// A room registers a function that returns the objects to keep clear (or their screen rects); band-chip.js hudRects adds them
// when it places a button from scratch (load, resize, level start), so a button never lands on a sign the child has to read.
import * as THREE from 'three';

const sources = new Set();
// fn() -> array of THREE.Object3D (visible ones are projected) or {l,t,r,b} rects. Returns an unregister function.
export function registerKeepClear(game, fn){ const s = { game, fn }; sources.add(s); return () => sources.delete(s); }

const box = new THREE.Box3(), v = new THREE.Vector3();
// the screen rect (css px) of an object's world bounding box; null when it is behind the camera or not shown
export function screenRect(cam, obj){
  let vis = true; obj.traverseAncestors(a => { if (!a.visible) vis = false; }); if (!vis || !obj.visible) return null;
  obj.updateWorldMatrix(true, true); box.setFromObject(obj); if (box.isEmpty()) return null;
  let l = 1e9, t = 1e9, r = -1e9, b = -1e9;
  for (let i = 0; i < 8; i++){
    v.set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z).project(cam);
    if (v.z > 1) return null;
    const x = (v.x + 1) / 2 * innerWidth, y = (1 - v.y) / 2 * innerHeight; l = Math.min(l, x); r = Math.max(r, x); t = Math.min(t, y); b = Math.max(b, y);
  }
  if (r < 0 || b < 0 || l > innerWidth || t > innerHeight) return null;
  return { l, t, r, b };
}

// every registered sign's screen rect right now
export function keepClearRects(){
  const out = [];
  for (const { game, fn } of sources){
    let list = []; try { list = fn() || []; } catch (e) { continue; }
    const cam = game.camera; cam.updateMatrixWorld(); for (const o of list){ const r = o && o.isObject3D ? screenRect(cam, o) : o; if (r) out.push(r); }
  }
  return out;
}
