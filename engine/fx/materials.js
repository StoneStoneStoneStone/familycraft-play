// Clay look shared by everything: soft rough material with a faint thumbprint bump, and rounded boxes.
import * as THREE from 'three';

function clayBump(){
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'), d = g.createImageData(256, 256);
  for (let i = 0; i < d.data.length; i += 4){ const v = 118 + Math.random() * 26; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; }
  g.putImageData(d, 0, 0); g.globalAlpha = .07; g.strokeStyle = '#000';
  for (let i = 0; i < 60; i++){ g.beginPath(); g.arc(Math.random() * 256, Math.random() * 256, 6 + Math.random() * 26, Math.random() * 6, Math.random() * 6 + 1); g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
const bump = clayBump(), cache = new Map();
export function clay(color, o = {}){
  const key = color + JSON.stringify(o); if (!o.fresh && cache.has(key)) return cache.get(key);
  const m = new THREE.MeshStandardMaterial(Object.assign({ color, roughness: .86, metalness: 0, bumpMap: bump, bumpScale: .018 }, o)); delete m.fresh; cache.set(key, m); return m;
}
export function roundBox(w, h, d, r){
  const s = new THREE.Shape(), x = -w / 2 + r, z = -d / 2 + r, W = w - 2 * r, D = d - 2 * r;
  s.moveTo(x, z); s.lineTo(x + W, z); s.lineTo(x + W, z + D); s.lineTo(x, z + D); s.lineTo(x, z);
  const g = new THREE.ExtrudeGeometry(s, { depth: h - 2 * r, bevelEnabled: true, bevelThickness: r, bevelSize: r * .9, bevelSegments: 4, curveSegments: 2 });
  g.rotateX(-Math.PI / 2); g.translate(0, r - h / 2, 0); g.computeVertexNormals(); return g;
}
export function shadowAll(o, cast = true, receive = true){ o.traverse(m => { if (m.isMesh){ m.castShadow = cast; m.receiveShadow = receive; } }); return o; }
