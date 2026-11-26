// Camera with two modes:
//   third: orbits behind the player (drag to turn, wheel to zoom) and pulls in when a block would hide them
//   first: from the player's eyes; the right arm and held tool are drawn on top (vmScene); drag to look, aim with the centre
import * as THREE from 'three';
import { clamp, damp, store } from '../core/core.js';
import { heldMesh, inHand } from '../entity/character.js';
import { clay } from '../fx/materials.js';

export class FollowCamera {
  constructor(cam, world, scene){
    this.cam = cam; this.world = world; this.yaw = .6; this.pitch = .5; this.look = 0; this.dist = 8.5; this.cur = 8.5; this.at = new THREE.Vector3(); this.shake = 0; this.inited = false;
    this.mode = 'third'; scene.add(cam);   // first-person view is switched off for now (owner, 2026-11-26); the code stays for later
    // first-person hand, Minecraft style: its own little scene and camera, drawn after the world with the depth
    // cleared, so the arm and tool never sink into blocks and keep the same size whatever the world FOV is.
    this.vmScene = new THREE.Scene(); this.vmCam = new THREE.PerspectiveCamera(70, 1, .01, 10);
    this.vmScene.add(new THREE.HemisphereLight('#fff6e8', '#8a6a4a', 2.2)); const sun = new THREE.DirectionalLight('#ffffff', 1.6); sun.position.set(-1, 2, 1); this.vmScene.add(sun);
    this.vm = new THREE.Group(); this.vmScene.add(this.vm);                 // the hand point; the arm runs back from it to the lower right
    this.armG = new THREE.Group(); this.vm.add(this.armG);
    this.skin = clay('#f7c9a4'); this.sleeveMat = clay('#f2b62c');
    const fist = new THREE.Mesh(new THREE.BoxGeometry(.15, .15, .16), this.skin); this.armG.add(fist);
    const fore = new THREE.Mesh(new THREE.BoxGeometry(.13, .13, .34), this.skin); fore.position.z = .24; this.armG.add(fore);
    const sleeve = new THREE.Mesh(new THREE.BoxGeometry(.16, .16, .3), this.sleeveMat); sleeve.position.z = .52; this.armG.add(sleeve);
    this.armG.rotation.set(.32, -.32, 0);                                    // arm slants up and in from the bottom-right corner
    this.vmItem = null; this.vmId = ''; this.sw = 0;
  }
  toggle(){ this.mode = this.mode === 'first' ? 'third' : 'first'; store.set('fc-view', this.mode); if (this.mode === 'first') this.look = .1; this.inited = false; return this.mode; }
  sleeve(color){ if (color) this.sleeveMat.color.set(color); }
  viewModel(id, swing, t, moving){
    this.vm.visible = this.mode === 'first'; if (!this.vm.visible) return;
    if (id !== this.vmId){ if (this.vmItem) this.vm.remove(this.vmItem); this.vmId = id; this.vmItem = inHand(id) ? heldMesh(id) : null;
      if (this.vmItem){ this.vmItem.scale.setScalar(.62); this.vmItem.position.set(-.01, -.02, -.02); this.vmItem.rotation.set(-.55, .5, .55); this.vm.add(this.vmItem); } }
    // swing: hand dips down and to the left and the tool chops forward (like Minecraft), then springs back
    this.sw += ((swing > .02 ? Math.min(1, swing * 2) : 0) - this.sw) * .5; const k = this.sw;
    const bx = moving ? Math.sin(t * 7) * .018 : 0, by = moving ? -Math.abs(Math.cos(t * 7)) * .02 : Math.sin(t * 1.6) * .004;
    this.vm.position.set(.27 - k * .12 + bx, -.23 - k * .06 + by, -.62 - k * .08);
    this.vm.rotation.set(-k * .9, k * .35, k * .25);
  }
  renderHand(renderer){
    if (this.mode !== 'first') return; this.vmCam.aspect = this.cam.aspect; this.vmCam.updateProjectionMatrix();
    const a = renderer.autoClear; renderer.autoClear = false; renderer.clearDepth(); renderer.render(this.vmScene, this.vmCam); renderer.autoClear = a;
  }
  update(dt, target, h, look){
    if (this.mode === 'first'){
      this.yaw -= look.dx * .006; this.look = clamp(this.look + look.dy * .005, -1.4, 1.4);
      const eye = new THREE.Vector3(target.x, target.y + h * .85, target.z);
      this.cam.position.copy(eye); const d = new THREE.Vector3(Math.sin(this.yaw) * Math.cos(this.look), -Math.sin(this.look), Math.cos(this.yaw) * Math.cos(this.look));
      this.cam.lookAt(eye.clone().add(d)); if (this.shake > 0){ this.shake = Math.max(0, this.shake - dt * 3); this.cam.rotation.z += (Math.random() - .5) * this.shake * .05; } return;
    }
    this.yaw -= look.dx * .006; this.pitch = clamp(this.pitch + look.dy * .004, .12, 1.15); this.dist = clamp(this.dist + look.zoom * .01, 4, 16);
    const t = new THREE.Vector3(target.x, target.y + 1, target.z);
    const want = new THREE.Vector3(t.x - Math.sin(this.yaw) * Math.cos(this.pitch) * this.dist, t.y + Math.sin(this.pitch) * this.dist, t.z - Math.cos(this.yaw) * Math.cos(this.pitch) * this.dist);
    const hit = this.world.lineHit(t, want); const d = hit === null ? this.dist : Math.max(1.6, hit - .35);
    this.cur = d < this.cur ? d : damp(this.cur, d, 3, dt);
    const pos = t.clone().add(want.sub(t).normalize().multiplyScalar(this.cur));
    if (!this.inited){ this.cam.position.copy(pos); this.at.copy(t); this.inited = true; }
    this.cam.position.lerp(pos, Math.min(1, dt * 8)); this.at.lerp(t, Math.min(1, dt * 10));
    if (this.shake > 0){ this.shake = Math.max(0, this.shake - dt * 3); this.cam.position.x += (Math.random() - .5) * this.shake * .3; this.cam.position.y += (Math.random() - .5) * this.shake * .3; }
    this.cam.lookAt(this.at);
  }
}
