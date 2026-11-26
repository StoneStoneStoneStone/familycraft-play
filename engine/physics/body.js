// Kinematic bodies against the block world: an upright box that moves one axis at a time and stops at
// solid cells. Handles gravity, ground contact, knockback, auto-step-up (small hops onto one block, like
// Minecraft on phones), fall height and water.
export const SEA = .62;

export class Body {
  constructor({ x = 0, y = 0, z = 0, r = .28, h = 1.2 } = {}){
    Object.assign(this, { x, y, z, r, h, vx: 0, vy: 0, vz: 0, kx: 0, kz: 0, ground: false, peak: y, wet: false, autoStep: false });
  }
  hits(world, x, y, z){ return world.boxHits(x - this.r, y, z - this.r, x + this.r, y + this.h, z + this.r); }
  // returns { landed: fall height or 0, bumped: true when blocked sideways }
  step(world, dt, gravity = 20){
    const out = { landed: 0, bumped: false };
    // never stay inside a block: if something solid appeared in us, rise to the first free spot above
    if (this.hits(world, this.x, this.y, this.z)){ for (let k = 1; k <= 4; k++){ const ny = Math.floor(this.y) + k; if (!this.hits(world, this.x, ny, this.z)){ this.y = ny; this.vy = 0; this.peak = ny; break; } } }
    this.vy = Math.max(this.vy - gravity * dt, -24);
    const mx = (this.vx + this.kx) * dt, mz = (this.vz + this.kz) * dt;
    this.kx *= Math.exp(-6 * dt); this.kz *= Math.exp(-6 * dt); if (Math.hypot(this.kx, this.kz) < .2) this.kx = this.kz = 0;
    // horizontal, with a one-block step-up while on the ground
    for (const [ax, d] of [['x', mx], ['z', mz]]){
      if (!d) continue;
      const nx = ax === 'x' ? this.x + d : this.x, nz = ax === 'z' ? this.z + d : this.z;
      if (!this.hits(world, nx, this.y, nz)){ this.x = nx; this.z = nz; continue; }
      out.bumped = true;
      if (this.autoStep && this.ground && !this.hits(world, nx, this.y + 1.01, nz) && !this.hits(world, this.x, this.y + 1.01, this.z)){ this.vy = Math.max(this.vy, 7.2); this.ground = false; }
    }
    // vertical
    const ny = this.y + this.vy * dt;
    if (this.vy <= 0 && this.hits(world, this.x, ny, this.z)){
      const fy = Math.floor(ny) + 1; if (!this.ground) out.landed = Math.max(0, this.peak - fy);
      this.y = Math.max(fy, ny); if (this.hits(world, this.x, this.y, this.z)) this.y = fy; this.vy = 0; this.ground = true; this.peak = this.y;
    } else if (this.vy > 0 && this.hits(world, this.x, ny, this.z)){ this.vy = 0; }
    else { this.y = ny; this.ground = false; this.peak = Math.max(this.peak, this.y); }
    if (this.y < 0){ this.y = 0; this.vy = 0; if (!this.ground) out.landed = 0; this.ground = true; this.peak = 0; }
    this.wet = this.y < SEA - .2;
    return out;
  }
}
