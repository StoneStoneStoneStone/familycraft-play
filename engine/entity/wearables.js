// Wearables on the head bone (hat, face, mouth slots). Real 3D, built from design/headgear/explorer-spec.md
// (drafted by Codex). Coordinates are "kid head units": origin = head centre, +Y up, +Z forward, head width 0.62.
// fitHead() measures each character's real head from its skinned vertices and scales the set to it.
import * as THREE from 'three';
import { clay } from '../fx/materials.js';

const V2 = (r, y) => new THREE.Vector2(r, y);
const mat = (c, rough = .75) => clay(c, { roughness: rough, metalness: 0 });

function ellipseLathe(profile, sx, sz, color, rough){
  const g = new THREE.LatheGeometry(profile.map(([r, y]) => V2(r, y)), 40); g.scale(sx, 1, sz); g.computeVertexNormals();
  const m = new THREE.Mesh(g, mat(color, rough)); m.castShadow = true; return m;
}

export const HAT_VARIANTS = {
  sand: { crown: '#E0A86C', brim: '#D4975A', band: '#5A3414', stud: '#FFC94D' },
  fern: { crown: '#6BAF5D', brim: '#3F7F3A', band: '#F5E6D3', stud: '#FFC94D' },
  sky:  { crown: '#A7D8FF', brim: '#4A9BD8', band: '#7A4A22', stud: '#FFC94D' }
};

// ---- measure the real head (bind pose, vertices owned by the head bone) ----
// Everything below is sized from these numbers, so each piece is designed on our actual character:
//   y0/H   chin and height of the head incl. hair      faceZ(x, y)  front surface of the face at a point
//   earX/earZ  the ear tips (widest point at eye height) rim        the hat line, above the fringe
function measure(model, B){
  if (model.userData.head) return model.userData.head;
  if (!B.head) return null;
  // a grafted character has two meshes (body, head): use the one that owns the most head-bone vertices
  let sm = null, most = 0; model.traverse(o => { if (!o.isSkinnedMesh) return; const hi = o.skeleton.bones.indexOf(B.head.b); if (hi < 0) return;
    const si = o.geometry.attributes.skinIndex; let n = 0; for (let i = 0; i < si.count; i += 7) if (si.getX(i) === hi) n++; if (n > most){ most = n; sm = o; } });
  if (!sm) return null;
  const bones = sm.skeleton.bones, hi = bones.indexOf(B.head.b);
  if (!sm.geometry.userData.own){ sm.geometry = sm.geometry.clone(); sm.geometry.userData.own = true; }      // this model may reshape its hair
  const g = sm.geometry, si = g.attributes.skinIndex, sw = g.attributes.skinWeight, pos = g.attributes.position, v = new THREE.Vector3(), idx = [], pts = [];
  const bm = sm.bindMatrix, bmi = sm.bindMatrix.clone().invert();
  for (let i = 0; i < si.count; i++){ let best = 0, bi = -1; for (let j = 0; j < 4; j++){ const w = sw.getComponent(i, j); if (w > best){ best = w; bi = si.getComponent(i, j); } }
    if (bi === hi){ v.fromBufferAttribute(pos, i).applyMatrix4(bm); idx.push(i); pts.push(v.x, v.y, v.z); } }
  if (!idx.length) return null;
  let y0 = Infinity, y1 = -Infinity; for (let i = 1; i < pts.length; i += 3){ y0 = Math.min(y0, pts[i]); y1 = Math.max(y1, pts[i]); } const H = y1 - y0;
  const faceZ = (x, y, r = H * .035) => { let z = -Infinity; for (let i = 0; i < pts.length; i += 3) if (Math.abs(pts[i] - x) < r && Math.abs(pts[i + 1] - y) < r && pts[i + 2] > z) z = pts[i + 2]; return z; };
  const eyeY = y0 + H * .27, mouthY = y0 + H * .135;
  let earX = 0, earZ = 0; for (let i = 0; i < pts.length; i += 3) if (pts[i + 1] > y0 + H * .15 && pts[i + 1] < y0 + H * .27 && Math.abs(pts[i]) > earX){ earX = Math.abs(pts[i]); earZ = pts[i + 2]; }
  const frame = new THREE.Group(); frame.applyMatrix4(sm.skeleton.boneInverses[hi]); B.head.b.add(frame);       // frame space = bind space
  const M = { sm, idx, pts, pos, bm, bmi, y0, H, faceZ, eyeY, mouthY, earX, earZ, eyeX: H * .17, frame, orig: null };
  model.userData.head = M; model.userData.headFrame = frame; return M;
}

// press the hair above the hat line into a snug cap shape (and put it back when the hat comes off)
function pressHair(M, cap){
  const { idx, pts, pos, bmi } = M, v = new THREE.Vector3();
  if (!M.orig) M.orig = pos.array.slice();
  else pos.array.set(M.orig);
  if (cap) for (let n = 0; n < idx.length; n++){ const x = pts[n * 3], y = pts[n * 3 + 1], z = pts[n * 3 + 2]; if (y < cap.y - cap.skirt) continue;
    if (y < cap.y){ const e = Math.hypot(x / cap.rx, (z - cap.z) / cap.rz); if (e > 1){ v.set(x / e, y, cap.z + (z - cap.z) / e).applyMatrix4(bmi); pos.setXYZ(idx[n], v.x, v.y, v.z); } continue; }
    const dx = x / cap.rx, dy = (y - cap.y) / cap.ry, dz = (z - cap.z) / cap.rz, d = Math.sqrt(dx * dx + dy * dy + dz * dz); if (d <= 1) continue;
    v.set(x / d, cap.y + (y - cap.y) / d, cap.z + (z - cap.z) / d).applyMatrix4(bmi); pos.setXYZ(idx[n], v.x, v.y, v.z); }
  pos.needsUpdate = true;
}

function lathe(profile, sx, sz, color, rough, side){
  const g = new THREE.LatheGeometry(profile.map(([r, y]) => V2(r, y)), 44); g.rotateY(Math.PI); g.scale(sx, 1, sz); g.computeVertexNormals();
  const m = new THREE.Mesh(g, mat(color, rough)); if (side){ m.material = m.material.clone(); m.material.side = side; } m.castShadow = true; return m;
}

// Explorer hat: a snug soft bucket-safari hat. The crown hugs the pressed hair; the short brim tips down.
function safariHat(M, variant = 'sand'){
  const C = HAT_VARIANTS[variant] || HAT_VARIANTS.sand, g = new THREE.Group(), H = M.H;
  const cap = { y: M.y0 + H * .63, z: 0, rx: H * .50, ry: H * .30, rz: H * .52, skirt: H * .09 };
  let zf = -Infinity, zb = Infinity; for (let i = 0; i < M.pts.length; i += 3) if (Math.abs(M.pts[i + 1] - cap.y) < H * .03){ zf = Math.max(zf, M.pts[i + 2]); zb = Math.min(zb, M.pts[i + 2]); }
  cap.z = (zf + zb) / 2; cap.rz = Math.min(cap.rz, (zf - zb) / 2 * .93); cap.rx = Math.min(cap.rx, cap.rz * .97);
  g.userData.cap = cap;
  const t = H * .034, ry = cap.ry + t;                                       // shell just outside the pressed hair
  const crown = []; for (let i = 0; i <= 14; i++){ const a = i / 14 * Math.PI / 2; crown.push([Math.max(.001, Math.cos(a)) * 1.0, Math.sin(a) * ry]); }
  crown.unshift([1.0, -H * .02]);
  const brimW = .2, drop = H * .06;
  const brim = [[.99, H * .012], [1 + brimW * .5, -drop * .35], [1 + brimW, -drop], [1 + brimW + .03, -drop - H * .012], [1 + brimW, -drop - H * .026], [1 + brimW * .5, -drop * .35 - H * .024], [.97, -H * .014]];
  const sx = cap.rx + t, sz = cap.rz + t;
  g.add(lathe(crown, sx, sz, C.crown, .8), lathe(crown.map(([r, y]) => [r * .97, y - t * .6]), sx, sz, C.crown, .85, THREE.BackSide), lathe(brim, sx, sz, C.brim, .8, THREE.DoubleSide));
  const band = [[1.012, H * .012], [1.03, H * .016], [1.03, H * .07], [1.012, H * .074]];
  g.add(lathe(band, sx, sz, C.band, .7, THREE.DoubleSide));
  const stud = new THREE.Mesh(new THREE.SphereGeometry(H * .028, 14, 10), mat(C.stud, .45)); stud.scale.z = .5; stud.position.set(sx * .55, H * .043, sz * .86); g.add(stud);
  g.position.set(0, cap.y, cap.z); g.userData.slot = 'hat'; return g;
}

// Explorer glasses: thick round frames that sit on the face, follow its curve, and arms that reach the ears.
function explorerGlasses(M){
  const g = new THREE.Group(), frame = mat('#5A3414', .55), H = M.H, R = H * .105, T = H * .021, ex = M.eyeX, ey = M.eyeY;
  const zc = M.faceZ(0, ey), ze = M.faceZ(ex, ey), zo = M.faceZ(ex + R, ey);     // face surface: centre, at the eye, at the outer rim
  const yaw = Math.atan2(ze - zo, R) * .8;                                         // rings turn with the cheek
  for (const sx of [-1, 1]){
    const eye = new THREE.Group(); eye.position.set(sx * ex, ey, Math.max(ze, zc - H * .01) + T * 1.15); eye.rotation.y = sx * yaw; g.add(eye);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(R, T, 12, 40), frame); ring.castShadow = true; eye.add(ring);
    const lens = new THREE.Mesh(new THREE.CircleGeometry(R, 36), new THREE.MeshStandardMaterial({ color: '#CFEBFF', transparent: true, opacity: .16, depthWrite: false, roughness: .05 })); lens.renderOrder = 2; eye.add(lens);
    const glare = new THREE.Mesh(new THREE.PlaneGeometry(R * .5, R * .13), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: .7, depthWrite: false })); glare.position.set(-R * .35, R * .45, T * .2); glare.rotation.z = -.5; glare.renderOrder = 3; eye.add(glare);
    // arm: hinge at the outer rim -> along the temple -> over the ear, tip curling down behind it
    eye.updateMatrix(); const hinge = new THREE.Vector3(sx * R, 0, 0).applyMatrix4(eye.matrix);
    const earX = M.earX - T * .2, pth = [hinge, new THREE.Vector3(sx * (hinge.x * sx * .35 + earX * .65), ey + H * .004, (hinge.z + M.earZ) / 2 + H * .03),
      new THREE.Vector3(sx * earX, ey + H * .012, M.earZ + H * .02), new THREE.Vector3(sx * (earX - T * .4), ey - H * .03, M.earZ - H * .06)];
    g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pth, false, 'centripetal'), 24, T * .72, 8, false), frame));
    const cap = new THREE.Mesh(new THREE.SphereGeometry(T * .9, 10, 8), frame); cap.position.copy(pth[3]); g.add(cap);
    const pad = new THREE.Mesh(new THREE.SphereGeometry(T * 1.25, 10, 8), frame); pad.position.copy(hinge); g.add(pad);
  }
  const zb = M.faceZ(0, ey + R * .25) + T * 1.3, in1 = ex - R * Math.cos(yaw);
  const bridge = new THREE.CatmullRomCurve3([new THREE.Vector3(-in1, ey + R * .22, zb - T * .2), new THREE.Vector3(0, ey + R * .38, zb + T * .3), new THREE.Vector3(in1, ey + R * .22, zb - T * .2)]);
  g.add(new THREE.Mesh(new THREE.TubeGeometry(bridge, 12, T * .8, 8, false), frame));
  g.userData.slot = 'face'; return g;
}

function mouthLeaf(M){
  const H = M.H, g = new THREE.Group(), px = H * .045, P = new THREE.Vector3(px, M.mouthY, M.faceZ(px, M.mouthY, H * .03) - H * .004); g.position.copy(P); g.userData.slot = 'mouth'; g.userData.sway = true;
  const tip = new THREE.Vector3(H * .075, -H * .04, H * .06);
  g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.LineCurve3(new THREE.Vector3(0, 0, 0), tip), 2, H * .007, 8, false), mat('#7A4A22', .72)));
  const L = H * .2, s = new THREE.Shape(); s.moveTo(0, 0); s.quadraticCurveTo(L * .4, L * .38, L, 0); s.quadraticCurveTo(L * .42, -L * .34, 0, 0);
  const geo = new THREE.ExtrudeGeometry(s, { depth: H * .008, bevelEnabled: true, bevelThickness: H * .004, bevelSize: H * .004, bevelSegments: 2, curveSegments: 8 }); geo.translate(0, 0, -H * .004);
  const leaf = new THREE.Mesh(geo, mat('#6BAF5D', .7)); leaf.castShadow = true;
  const U = new THREE.Vector3(.9, -.3, .32).normalize(), N0 = new THREE.Vector3(-.2, .25, .95), Vv = new THREE.Vector3().crossVectors(N0, U).normalize(), N = new THREE.Vector3().crossVectors(U, Vv).normalize();
  leaf.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(U, Vv, N)); leaf.position.copy(tip);
  const vein = new THREE.Mesh(new THREE.CylinderGeometry(H * .003, H * .003, L * .7, 6), mat('#A8DB8C', .7)); vein.rotation.z = -Math.PI / 2; vein.position.set(L * .45, 0, H * .009); leaf.add(vein);
  g.add(leaf); return g;
}

// v1 shows hats only (user, 2026-11-24): glasses and mouth items are kept in code but not worn yet.
export const SETS = { explorer: M => [safariHat(M, 'sand')], explorer_fern: M => [safariHat(M, 'fern')], explorer_sky: M => [safariHat(M, 'sky')] };

export function wear(model, B, setId){
  const M = measure(model, B); if (!M) return;
  for (const c of [...M.frame.children]) M.frame.remove(c);
  const parts = setId && SETS[setId] ? SETS[setId](M) : [];
  const hat = parts.find(p => p.userData.slot === 'hat'); pressHair(M, hat ? hat.userData.cap : null);
  parts.forEach(p => M.frame.add(p)); model.userData.wearing = setId || null;
}

export function swayWear(model, t){
  const f = model.userData.headFrame; if (!f) return;
  for (const c of f.children) if (c.userData.sway){ c.rotation.y = 4 * Math.PI / 180 * Math.sin(2 * Math.PI * t / 2.4); c.rotation.z = 3 * Math.PI / 180 * Math.sin(2 * Math.PI * t / 2.4 + Math.PI / 2); }
}
