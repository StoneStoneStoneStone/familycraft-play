// Small shared pieces: event bus, safe storage, seeded random, maths helpers.

export class Bus {
  constructor(){ this.h = new Map(); }
  on(type, fn){ (this.h.get(type) || this.h.set(type, []).get(type)).push(fn); return () => this.off(type, fn); }
  off(type, fn){ const a = this.h.get(type); if (a) this.h.set(type, a.filter(f => f !== fn)); }
  emit(type, data){ (this.h.get(type) || []).slice().forEach(f => f(data)); (this.h.get('*') || []).forEach(f => f(type, data)); }
}

export const store = {
  get(k, def = null){ try{ const v = localStorage.getItem(k); return v === null ? def : JSON.parse(v); }catch(e){ return def; } },
  set(k, v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} },
  del(k){ try{ localStorage.removeItem(k); }catch(e){} }
};

export function rng(seed = 1){ let s = seed >>> 0 || 1; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; }
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
export const angDiff = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));
