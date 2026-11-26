// Quest common (pure: no three, no engine, runs in plain node). Browser-only label texture lives in label.js.
export const QUEST_DEFAULTS = { levels: 4, stars: 3, hintRungs: 3, sinkDelay: .6, codeStepMs: 450, codeMaxSteps: 200, digLayers: 5, peekMs: 3000 };

const BANDS = ['a', 'b', 'c'];

// Band from the address (?band=a|b|c), else the stored one, else the middle band.
export function getBand(search, stored){
  let q = null;
  try { q = new URLSearchParams(search || '').get('band'); } catch (e) {}
  if (BANDS.includes(q)) return q;
  if (BANDS.includes(stored)) return stored;
  return 'b';
}

// Same level + salt always gives the same sequence (mulberry32 over an FNV-1a hash).
export function seeded(level, salt){
  const s = `${level}:${salt}`;
  let h = 2166136261;
  for (let i = 0; i < s.length; i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
