// Shared by all five quest rooms: the age-band chip ("4–6" / "7–9" / "10–12"; tap opens three choices) and the placement helper
// that keeps room-owned buttons (this chip, the camera "reset view" button) clear of every HUD box at every screen size.
// The shell UI is not built yet, so the room owns this. A choice is stored under 'fc-band' and handed to onPick(band).
import { i18n } from '../../core/i18n.js';
import { keepClearRects } from './screen-boxes.js';

export const BAND_LABEL = { a: '4–6', b: '7–9', c: '10–12' };
const BANDS = ['a', 'b', 'c'];
const PAD = 4, MARGIN = 6;

const CSS = `.fcq{position:fixed;z-index:7;box-sizing:border-box;border:3px solid #7a5632;background:radial-gradient(circle at 40% 30%,#f4cf8f,#c98a52);box-shadow:0 0 0 2px #fff1b8,0 4px 0 #5a3414,0 7px 10px rgba(60,40,20,.3);
 display:flex;align-items:center;justify-content:center;gap:4px;padding:0;cursor:pointer;touch-action:manipulation;user-select:none;-webkit-user-select:none;font:700 17px Prompt,"Noto Sans Thai",sans-serif;color:#4a2a0e;line-height:1}
.fcq:active{transform:translateY(3px);box-shadow:0 0 0 2px #ffd21f,0 1px 0 #5a3414,0 3px 6px rgba(60,40,20,.3)}
.fcq svg{width:22px;height:22px;display:block;pointer-events:none;flex:0 0 auto}
#fcqChip{min-width:64px;height:48px;border-radius:16px;padding:0 10px}
#fcqReset{width:52px;height:52px;border-radius:50%}
#fcqReset svg{width:30px;height:30px}
#fcqMenu{position:fixed;z-index:9;display:flex;flex-direction:column;gap:8px;padding:10px;border-radius:18px;border:3px solid #7a5632;background:#fff4dc;box-shadow:0 6px 0 #5a3414,0 12px 18px rgba(60,40,20,.35)}
#fcqMenu button{position:static;min-width:132px;height:52px;border-radius:14px;font-size:20px}
#fcqMenu button.on{background:radial-gradient(circle at 40% 30%,#fff1b8,#ffc94d);border-color:#b8741a}
#fcqMenu small{font:600 12px Prompt,"Noto Sans Thai",sans-serif;opacity:.7;margin-left:2px}
#fcqShade{position:fixed;inset:0;z-index:8;background:rgba(70,45,25,.18)}`;

export function addStyle(){
  if (document.getElementById('fcqStyle')) return;
  const s = document.createElement('style'); s.id = 'fcqStyle'; s.textContent = CSS; document.head.appendChild(s);
}

// Every visible fixed/absolute box except `skip`, plus the goal banner's widest possible box (it grows with the text it shows).
// Room-owned buttons rank by data-fcq-prio (the chip 0, the reset button 1): a button gives way to the ones that rank before it and ignores the ones after it.
// signs = true adds the screen boxes of the room's registered 3D signs (screen-boxes.js): used when a button is placed from scratch,
// not by the twice-a-second collision check, so a sign sweeping past while the camera turns does not chase the button around.
export function hudRects(skip = [], signs = false, hint = true){
  const out = [], vw = innerWidth, vh = innerHeight, me = skip[0], rank = e => e && e.dataset && e.dataset.fcqPrio != null ? +e.dataset.fcqPrio : null;
  for (const e of document.body.querySelectorAll('*')){
    if (e.tagName === 'CANVAS' || skip.includes(e) || skip.some(s => s && s.contains(e)) || e.closest('[data-fcq-skip]')) continue;
    if (rank(e) !== null && rank(me) !== null && rank(e) > rank(me)) continue;
    const s = getComputedStyle(e); if (s.position !== 'fixed' && s.position !== 'absolute') continue;
    if (s.display === 'none' || s.visibility === 'hidden' || +s.opacity === 0) continue;
    const r = e.getBoundingClientRect(); if (r.width < 1 || r.height < 1 || r.width * r.height > vw * vh * .4) continue;
    out.push({ l: r.left, t: r.top, r: r.right, b: r.bottom });
  }
  const h = hint ? document.getElementById('hint') : null;
  if (h){ const r = h.getBoundingClientRect(), mw = innerWidth > 720 ? Math.min(innerWidth * .6, 420) : innerWidth * .7, cx = innerWidth / 2;
    out.push({ l: cx - mw / 2, t: r.top, r: cx + mw / 2, b: r.top + Math.max(r.height, 36) + 26 }); }
  if (signs) out.push(...keepClearRects());
  return out;
}
const hit = (a, b) => a.l < b.r + PAD && a.r + PAD > b.l && a.t < b.b + PAD && a.b + PAD > b.t;

// Top-left-most spot of size w x h (px) that touches no box in `boxes` and stays on screen; null when the screen has none.
export function findSpot(w, h, boxes){
  const vw = innerWidth, vh = innerHeight; let best = null, bs = 1e9;
  for (let y = MARGIN; y + h <= vh - MARGIN; y += 4) for (let x = MARGIN; x + w <= vw - MARGIN; x += 4){
    const sc = y + .3 * Math.min(x, vw - w - x); if (sc >= bs) continue;
    const q = { l: x, t: y, r: x + w, b: y + h }; if (!boxes.some(b => hit(q, b))){ best = { x, y }; bs = sc; }
  }
  return best;
}

// The first preferred spot that is on screen and touches no box, else null. prefer() -> [{ x, y }] (top-left corners, px).
export function preferredSpot(w, h, boxes, prefer){
  for (const p of (prefer ? prefer(w, h) : []) || []){
    if (!p || !isFinite(p.x) || !isFinite(p.y)) continue; const q = { l: p.x, t: p.y, r: p.x + w, b: p.y + h };
    if (q.l >= MARGIN && q.t >= MARGIN && q.r <= innerWidth - MARGIN && q.b <= innerHeight - MARGIN && !boxes.some(b => hit(q, b))) return { x: Math.round(p.x), y: Math.round(p.y) };
  }
  return null;
}

// Keeps `el` clear of the HUD: re-checks now, on resize, and twice a second (panels and the banner change); moves only when it collides.
// A forced check places it from scratch: the preferred spots first (opts.prefer), then the top-left-most free spot; both keep off the room's signs.
export function keepClear(el, opts = {}){
  const w = () => el.offsetWidth, h = () => el.offsetHeight;
  const check = (force) => {
    if (!el.isConnected || el.style.display === 'none') return;
    const r = el.getBoundingClientRect(), mine = { l: r.left, t: r.top, r: r.right, b: r.bottom };
    if (!force && r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight && !hudRects([el]).some(b => hit(mine, b))) return;
    const boxes = hudRects([el], true), mates = [...document.querySelectorAll('.fcq')].filter(e => e !== el && e.isConnected && e.style.display !== 'none' && !e.closest('[data-fcq-skip]')).map(e => { const q = e.getBoundingClientRect(); return { l: q.left, t: q.top, r: q.right, b: q.bottom }; });
    const p = preferredSpot(w(), h(), boxes, opts.prefer) || findSpot(w(), h(), boxes) || findSpot(w(), h(), hudRects([el])) || findSpot(w(), h(), hudRects([el], true, false)) || findSpot(w(), h(), mates);
    // late resorts: the long intro banner can leave no free spot for a few seconds (then only its own box counts, not the room it may grow into; a change of its text re-checks: see below); at least never on the other room button
    if (p && (Math.round(r.left) !== p.x || Math.round(r.top) !== p.y)){ el.style.left = p.x + 'px'; el.style.top = p.y + 'px'; el.style.right = 'auto'; el.style.bottom = 'auto';
      dispatchEvent(new CustomEvent('fcqmoved', { detail: el })); }      // the other room button checks at once (the chip moving onto the reset button would otherwise wait for the next tick)
  };
  const onResize = () => check(true); addEventListener('resize', onResize);
  const onMoved = e => { if (e.detail !== el) setTimeout(() => check(false), 0); }; addEventListener('fcqmoved', onMoved);
  const hintEl = document.getElementById('hint'), mo = hintEl && window.MutationObserver ? new MutationObserver(() => { setTimeout(() => check(false), 50); setTimeout(() => check(false), 700); }) : null; if (mo) mo.observe(hintEl, { childList: true, characterData: true, subtree: true, attributes: true });      // the banner changed size: move off it now
  let warm = 0, iv = null; const tick = () => { check(warm++ < 5); iv = setTimeout(tick, warm < 5 ? 500 : 1500); }; iv = setTimeout(tick, 500); check(true);      // the HUD is still settling for the first seconds: place again from scratch, then only when something collides
  return { check, stop(){ removeEventListener('resize', onResize); removeEventListener('fcqmoved', onMoved); if (mo) mo.disconnect(); clearTimeout(iv); } };
}

const LABEL = { th: { chip: 'เลือกช่วงอายุ', age: 'อายุ' }, en: { chip: 'Choose age band', age: 'age' } };

// opts: { band: 'a'|'b'|'c', onPick(band) }. Returns { el, setBand(b), open(), close(), destroy() }.
export function makeBandChip(game, { band, onPick }){
  addStyle(); const L = () => LABEL[i18n.lang] || LABEL.en;
  let cur = band, menu = null, shade = null;
  const el = document.createElement('button'); el.id = 'fcqChip'; el.type = 'button'; el.className = 'fcq'; el.dataset.fcqPrio = '0';
  const paint = () => { el.innerHTML = `<span>${BAND_LABEL[cur]}</span><svg viewBox="0 0 24 24" fill="none" stroke="#4a2a0e" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>`; el.setAttribute('aria-label', L().chip + ': ' + BAND_LABEL[cur]); };
  const close = () => { if (menu) menu.remove(); if (shade) shade.remove(); menu = shade = null; el.setAttribute('aria-expanded', 'false'); };
  const open = () => {
    if (menu) return close();
    shade = document.createElement('div'); shade.id = 'fcqShade'; shade.setAttribute('data-fcq-skip', ''); shade.addEventListener('pointerdown', e => { e.preventDefault(); close(); });
    menu = document.createElement('div'); menu.id = 'fcqMenu'; menu.setAttribute('data-fcq-skip', ''); menu.setAttribute('role', 'menu');
    for (const b of BANDS){
      const o = document.createElement('button'); o.type = 'button'; o.className = 'fcq' + (b === cur ? ' on' : ''); o.dataset.band = b; o.setAttribute('role', 'menuitemradio'); o.setAttribute('aria-checked', String(b === cur));
      o.innerHTML = `${BAND_LABEL[b]}<small>${L().age}</small>`; o.addEventListener('click', () => pick(b)); menu.appendChild(o);
    }
    document.body.append(shade, menu); el.setAttribute('aria-expanded', 'true');
    const r = el.getBoundingClientRect(), mh = menu.offsetHeight, mw = menu.offsetWidth;
    const top = r.bottom + 8 + mh <= innerHeight - 6 ? r.bottom + 8 : Math.max(6, r.top - 8 - mh);
    menu.style.top = top + 'px'; menu.style.left = Math.max(6, Math.min(innerWidth - mw - 6, r.left)) + 'px';
  };
  const pick = b => {
    close(); if (b === cur) return; cur = b; paint();
    try { localStorage.setItem('fc-band', b); } catch (e) {}
    onPick(b);
  };
  el.addEventListener('click', open); paint(); document.body.appendChild(el);
  const kc = keepClear(el), onHide = () => destroy(); addEventListener('pagehide', onHide);
  function destroy(){ close(); kc.stop(); removeEventListener('pagehide', onHide); el.remove(); }
  return { el, setBand(b){ cur = b; paint(); kc.check(true); }, open, close, pick, place(){ kc.check(true); }, destroy };
}
