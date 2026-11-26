// Browser only: a text label as a canvas texture (imports three, so it stays out of common.js).
import * as THREE from 'three';

export function labelTexture(text, { bg = '#fff8e6', fg = '#3b2a1a', size = 128 } = {}){
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, size, size);
  const len = String(text).length;
  let px = size * (len <= 1 ? .7 : len <= 2 ? .55 : len <= 4 ? .38 : .26);
  g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = `700 ${px}px "Baloo 2", "Nunito", system-ui, sans-serif`;
  while (g.measureText(String(text)).width > size * .9 && px > 8){ px -= 2; g.font = `700 ${px}px "Baloo 2", "Nunito", system-ui, sans-serif`; }
  g.fillText(String(text), size / 2, size / 2 + px * .04);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

// A one-line title on a wide board: returns { tex, frac } where frac = the font size as a share of the board height (tests use it
// to check the title's on-screen size). aspect = board width / height.
export function titleTexture(text, aspect, { bg = '#3b2a1a', fg = '#fff8e6' } = {}){
  const h = 128, w = Math.max(128, Math.round(h * aspect)), c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); g.fillStyle = bg; g.fillRect(0, 0, w, h);
  let px = Math.round(h * .66); const font = p => `700 ${p}px "Baloo 2", "Noto Sans Thai", "Nunito", system-ui, sans-serif`;
  g.font = font(px); while (g.measureText(String(text)).width > w * .9 && px > 10){ px -= 2; g.font = font(px); }
  g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(text), w / 2, h / 2 + px * .04);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  return { tex, frac: px / h };
}
