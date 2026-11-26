// KayKit animations on our own characters (owner 2026-11-27: "keep our characters, use only their skeleton and animation pack").
// A hidden KayKit Rig_Medium skeleton plays the clip; every frame each of our bones copies how far its KayKit bone has turned
// away from KayKit's rest pose. Our rest pose (arms down) differs from KayKit's (T-pose), so each of our bones is first turned
// to KayKit's rest direction (R0), then given KayKit's motion. Animations: assets/free/anim (KayKit Character Animations, CC0).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// our bone -> [KayKit bone, KayKit child used to measure its direction]
export const KAY_MAP = {
  hips: ['hips', 'spine'], chest: ['chest', 'head'], head: ['head', null],
  armL: ['upperarm.l', 'lowerarm.l'], foreL: ['lowerarm.l', 'wrist.l'], handL: ['hand.l', 'handslot.l'],
  armR: ['upperarm.r', 'lowerarm.r'], foreR: ['lowerarm.r', 'wrist.r'], handR: ['hand.r', 'handslot.r'],
  legL: ['upperleg.l', 'lowerleg.l'], shinL: ['lowerleg.l', 'foot.l'],
  legR: ['upperleg.r', 'lowerleg.r'], shinR: ['lowerleg.r', 'foot.r']
};
const OUR_CHILD = { hips: 'chest', chest: 'head', armL: 'foreL', foreL: 'handL', armR: 'foreR', foreR: 'handR', legL: 'shinL', legR: 'shinR' };
const FILES = ['General', 'MovementBasic', 'MovementAdvanced', 'Tools', 'Simulation', 'CombatMelee'];
const loader = new GLTFLoader(); let LIB = null;
// loads the KayKit skeleton and every clip once; resolves { rig, clips: {name: AnimationClip} }
export function kayLibrary(base = new URL('../../assets/free/anim/', import.meta.url).href){
  return LIB || (LIB = Promise.all(FILES.map(f => new Promise(res => loader.load(`${base}Rig_Medium_${f}.glb`, res, undefined, () => res(null))))).then(gls => {
    const ok = gls.filter(Boolean), clips = {}; ok.forEach(gl => gl.animations.forEach(c => { clips[c.name] = c; }));
    return { scene: ok[0].scene, clips }; })); }

const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _m = new THREE.Matrix4();
const rootQ = (o, root) => { const q = o.getWorldQuaternion(new THREE.Quaternion()), r = root.getWorldQuaternion(new THREE.Quaternion()); return r.invert().multiply(q); };
const rootP = (o, root) => root.worldToLocal(o.getWorldPosition(new THREE.Vector3()));

export class KayRetarget {
  // model: our character group from loadCharacter (userData.bones = { name: { b: Bone } }); lib: kayLibrary() result
  constructor(model, lib, { swapSides = false } = {}){
    this.model = model; this.kay = lib.scene.clone(true); this.clips = lib.clips; this.mixer = new THREE.AnimationMixer(this.kay); this.cur = null;
    const K = {}; this.kay.traverse(o => { if (o.isBone) K[o.name] = o; }); this.K = K;
    const B = model.userData.bones, side = n => swapSides ? n.replace(/\.l$/, '.X').replace(/\.r$/, '.l').replace(/\.X$/, '.r') : n;
    this.kay.updateMatrixWorld(true); model.updateMatrixWorld(true);
    this.list = [];
    for (const [ours, [kn, kc]] of Object.entries(KAY_MAP)){ const ob = B[ours] && B[ours].b, kb = K[side(kn)]; if (!ob || !kb) continue;
      const kRest = rootQ(kb, this.kay), oRest = rootQ(ob, model);
      // R0 turns our bone's rest direction onto KayKit's rest direction (both measured in their own model space)
      let R0 = new THREE.Quaternion();
      const oc = OUR_CHILD[ours] && B[OUR_CHILD[ours]] && B[OUR_CHILD[ours]].b, kcb = kc && K[side(kc)];
      if (oc && kcb){ const od = rootP(oc, model).sub(rootP(ob, model)).normalize(), kd = rootP(kcb, this.kay).sub(rootP(kb, this.kay)).normalize(); R0.setFromUnitVectors(od, kd); }
      this.list.push({ ob, kb, kRestInv: kRest.clone().invert(), base: R0.multiply(oRest) }); }
    // hips height: KayKit's hip bounce and sit drop, scaled to our hip height
    const kh = K.hips, oh = B.hips && B.hips.b; if (kh && oh){ this.hip = { ob: oh, kRest: rootP(kh, this.kay), oRest: oh.position.clone(), k: rootP(oh, model).y / Math.max(.01, rootP(kh, this.kay).y) }; }
  }
  play(name, { loop = true, fade = .2, speed = 1 } = {}){ const c = this.clips[name]; if (!c) return null; if (this.cur && this.cur.getClip() === c) return this.cur;
    const a = this.mixer.clipAction(c); a.reset(); a.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity); a.clampWhenFinished = !loop; a.timeScale = speed;
    if (this.cur) a.crossFadeFrom(this.cur, fade, false); a.play(); this.cur = a; return a; }
  update(dt){ this.mixer.update(dt); this.kay.updateMatrixWorld(true); const M = this.model;
    for (const e of this.list){   // parents come first in KAY_MAP order, so each parent is already posed
      const now = rootQ(e.kb, this.kay), target = now.multiply(e.kRestInv).multiply(e.base);    // our rest, turned onto KayKit's rest, then given its motion
      const par = e.ob.parent, pq = rootQ(par, M); e.ob.quaternion.copy(pq.invert().multiply(target)); e.ob.updateMatrixWorld(true); }
    if (this.hip){ const H = this.hip, d = rootP(this.K.hips, this.kay).sub(H.kRest).multiplyScalar(H.k), par = H.ob.parent;
      _m.copy(par.matrixWorld).invert(); const w = M.localToWorld(rootP(H.ob, M).set(0, 0, 0)); // origin of model space
      const a = M.localToWorld(new THREE.Vector3(0, 0, 0)), b = M.localToWorld(d.clone()); a.applyMatrix4(_m); b.applyMatrix4(_m);
      H.ob.position.copy(H.oRest).add(b.sub(a)); H.ob.updateMatrixWorld(true); } }
}
