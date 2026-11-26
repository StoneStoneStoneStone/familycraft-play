// Code quest command panel (browser only): a palette of big command tiles and the child's program, built from DOM buttons
// styled like the rest of the game (cream tiles, wood edge, gem glow). Tap a palette tile to add it to the program, tap a placed tile
// to take it away. Loops and ifs open a section (the dashed + slot that is lit); tap another + slot to add there instead.
// Pure program editing lives in code-logic.js; this file only draws and reports clicks.
import { appendCmd, removeAt, setLoopCount, countCmds, CODE } from './code-logic.js';

const INK = '#4a2a0e';
const svg = (inner, w = 48) => `<svg class="ic" viewBox="0 0 48 48" width="${w}" height="${w}" aria-hidden="true" focusable="false">${inner}</svg>`;
const arrowTurn = flip => `<g${flip ? ' transform="translate(48 0) scale(-1 1)"' : ''}><path d="M35 43V27q0-9-9-9H19" fill="none" stroke="${INK}" stroke-width="13" stroke-linecap="round" stroke-linejoin="round"/><path d="M35 43V27q0-9-9-9H19" fill="none" stroke="#5db7e8" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/><path d="M21 5 4 18l17 13Z" fill="#5db7e8" stroke="${INK}" stroke-width="3.4" stroke-linejoin="round"/></g>`;
export const ICONS = {
  F: svg(`<path d="M24 4 42 25H30v19H18V25H6Z" fill="#f2b62c" stroke="${INK}" stroke-width="3.6" stroke-linejoin="round"/><path d="M24 11 33 22" stroke="#fff3c2" stroke-width="3" stroke-linecap="round" fill="none"/>`),
  L: svg(arrowTurn(false)), R: svg(arrowTurn(true)),
  PLACE: svg(`<path d="M21 3h6v10h7L24 24 14 13h7Z" fill="#f2b62c" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/><path d="M24 29 38 36 24 43 10 36Z" fill="#f08a6a" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/><path d="M10 36v7l14 5V43Z" fill="#c9553a" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/><path d="M38 36v7L24 48V43Z" fill="#a9432c" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>`),
  DIG: svg(`<path d="M11 43 31 17" stroke="${INK}" stroke-width="11" stroke-linecap="round"/><path d="M11 43 31 17" stroke="#c98a52" stroke-width="5.5" stroke-linecap="round"/><path d="M13 16Q29 3 44 19" fill="none" stroke="${INK}" stroke-width="12" stroke-linecap="round"/><path d="M13 16Q29 3 44 19" fill="none" stroke="#b9c2c9" stroke-width="6" stroke-linecap="round"/><rect x="30" y="38" width="7" height="7" rx="1.5" fill="#9aa3ab" stroke="${INK}" stroke-width="2.4"/><rect x="39" y="41" width="5" height="5" rx="1" fill="#9aa3ab" stroke="${INK}" stroke-width="2.2"/>`),
  LOOP: svg(`<path d="M38 26A14 14 0 1 1 28 12" fill="none" stroke="${INK}" stroke-width="12" stroke-linecap="round"/><path d="M38 26A14 14 0 1 1 28 12" fill="none" stroke="#b894f0" stroke-width="6" stroke-linecap="round"/><path d="M25 1 40 12 25 23Z" fill="#b894f0" stroke="${INK}" stroke-width="3.2" stroke-linejoin="round"/>`),
  IF: svg(`<rect x="8" y="26" width="32" height="19" rx="3" fill="#9aa3ab" stroke="${INK}" stroke-width="3.4"/><path d="M8 35.5h32M20 26v9.5M30 35.5V45" stroke="${INK}" stroke-width="2.6" fill="none"/><text x="24" y="21" text-anchor="middle" font-family="Baloo 2,Prompt,sans-serif" font-weight="800" font-size="25" fill="#2f8f4e" stroke="${INK}" stroke-width="1.6" paint-order="stroke">?</text>`),
  YES: svg(`<path d="M8 26 19 37 41 11" fill="none" stroke="${INK}" stroke-width="13" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 26 19 37 41 11" fill="none" stroke="#3fae5a" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>`),
  NO: svg(`<path d="M12 12 36 36M36 12 12 36" fill="none" stroke="${INK}" stroke-width="13" stroke-linecap="round"/><path d="M12 12 36 36M36 12 12 36" fill="none" stroke="#e0524a" stroke-width="7" stroke-linecap="round"/>`),
  RUN: svg(`<path d="M13 6 42 24 13 42Z" fill="#3fae5a" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/><path d="M17 14 30 22" stroke="#bff0c8" stroke-width="3" stroke-linecap="round" fill="none"/>`),
  TOOLBOX: svg(`<path d="M17 14v-4q0-3 3-3h8q3 0 3 3v4" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round"/><rect x="5" y="14" width="38" height="28" rx="5" fill="#f2b62c" stroke="${INK}" stroke-width="3.6"/><path d="M5 26h38" stroke="${INK}" stroke-width="3.2"/><rect x="20" y="22" width="8" height="9" rx="2" fill="#fff3df" stroke="${INK}" stroke-width="2.6"/>`),
  FLAGS: svg(`<rect x="3" y="30" width="42" height="14" rx="3" fill="#fff3df" stroke="${INK}" stroke-width="3"/><path d="M13 30v14M24 30v14M35 30v14" stroke="${INK}" stroke-width="2.4"/><path d="M12 28V4" stroke="${INK}" stroke-width="4" stroke-linecap="round"/><path d="M12 5h22l-6 7 6 7H12Z" fill="#ffd21f" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>`),
  RESET: svg(`<path d="M12 24A13 13 0 1 0 17 13" fill="none" stroke="${INK}" stroke-width="11" stroke-linecap="round"/><path d="M12 24A13 13 0 1 0 17 13" fill="none" stroke="#f2b62c" stroke-width="5.5" stroke-linecap="round"/><path d="M3 4 17 3 14 19Z" fill="#f2b62c" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>`)
};
const TINT = { F: '#ffe6a8', L: '#cfe9f7', R: '#cfe9f7', PLACE: '#f9c9b4', DIG: '#dedad0', LOOP: '#e3d6f8', IF: '#cdeccb', YES: '#cdeccb', NO: '#f9d3c7' };

const CSS = `
#cdWrap{--t:56px;font:700 18px "Baloo 2",Prompt,"Noto Sans Thai",sans-serif;color:#3b2a1a;user-select:none;-webkit-user-select:none;touch-action:manipulation}
#cdPal,#cdProg{position:relative;box-sizing:border-box;padding:14px 9px 9px;border:5px solid #7a5632;border-radius:24px 28px 26px 30px/28px 24px 30px 26px;box-shadow:0 0 0 3px #fff1b8,0 8px 0 #5a3414,0 14px 20px rgba(60,40,20,.35)}
#cdPal{background:#fff3df}
#cdProg{background:#4b3220 repeating-linear-gradient(135deg,rgba(255,255,255,.045) 0 10px,rgba(0,0,0,.05) 10px 20px);border-color:#2f1d0f;box-shadow:0 0 0 3px #d9b98a,0 8px 0 #1f1208,0 14px 20px rgba(30,20,10,.45);color:#fff3df}
.cdBadge{position:absolute;top:-17px;left:12px;width:36px;height:36px;border-radius:50%;border:4px solid #7a5632;display:flex;align-items:center;justify-content:center;pointer-events:none;z-index:2;box-shadow:0 3px 0 #5a3414}
.cdBadge .ic{width:22px;height:22px;display:block}
#cdPal .cdBadge{background:#ffe6a8}#cdProg .cdBadge{background:#3fae5a;border-color:#1f6a35;box-shadow:0 3px 0 #123d1f}
#cdPal .cdBadge{top:-17px;left:auto;right:12px}
#cdWrap.land{display:contents}
#cdLeft{display:flex;flex-direction:column;gap:12px}
#cdWrap.land #cdLeft{position:fixed;z-index:7}
#cdWrap.land #cdProg{position:fixed;z-index:7;display:flex;flex-direction:column;min-height:104px}
#cdPal{width:100%}
#cdTiles{display:flex;flex-wrap:wrap;gap:8px;justify-content:center}
#cdStrip{display:flex;flex-wrap:wrap;gap:6px;align-content:flex-start;overflow-y:auto;overflow-x:hidden;min-height:0;flex:1 1 auto;padding:6px 8px;scrollbar-width:thin;scrollbar-color:#d9b98a transparent}
#cdBtns{display:flex;gap:8px;flex:0 0 auto}
.cdT{position:relative;flex:0 0 auto;width:var(--t);height:var(--t);padding:0;margin:0;cursor:pointer;display:flex;align-items:center;justify-content:center;border-radius:15px;border:4px solid #7a5632;
 background:var(--tint,#fff8e6);box-shadow:inset 0 3px 0 rgba(255,255,255,.7),inset 0 -5px 0 rgba(90,52,20,.16),0 4px 0 #5a3414;font:800 26px "Baloo 2",Prompt,sans-serif;color:#3b2a1a;touch-action:manipulation;-webkit-tap-highlight-color:transparent}
.cdT .ic{width:calc(var(--t)*.64);height:calc(var(--t)*.64);display:block;pointer-events:none}
.cdT:active{transform:translateY(3px);box-shadow:inset 0 3px 0 rgba(255,255,255,.7),inset 0 -5px 0 rgba(90,52,20,.16),0 1px 0 #5a3414}
.cdT.on{box-shadow:0 0 0 4px #ffd21f,0 0 14px 6px rgba(255,210,31,.8),0 4px 0 #5a3414;transform:translateY(-3px)}
.cdT.bad{border-color:#e0524a;box-shadow:0 0 0 4px #ffb3a8,0 4px 0 #8a2418;animation:cdBad .5s ease-in-out infinite alternate}
.cdT.hintp{box-shadow:0 0 0 4px #46d4e6,0 0 12px 5px rgba(70,212,230,.8),0 4px 0 #5a3414;animation:cdPulse .55s ease-in-out infinite alternate}
.cdT.full{filter:grayscale(.55) opacity(.7)}
.cdT.cnt{background:#fff3df;font-size:27px;letter-spacing:-1px}
.cdT.ghost{border:4px dashed #e8c995;background:rgba(255,243,223,.14);box-shadow:none;color:#e8c995;font-size:34px}
.cdT.ghost.cur{border:4px solid #ffb21f;background:#fff1b8;box-shadow:0 0 0 2px #fff,0 0 6px 3px rgba(255,178,31,.8);color:#a8630c;animation:cdPulse .7s ease-in-out infinite alternate}
.cdT.ghost.hintg{border:4px dashed #19a6bd;background:rgba(190,240,246,.85);opacity:.95;animation:cdPulse .55s ease-in-out infinite alternate}
.cdT.ghost.hintg .ic{opacity:.8}
.cdG{display:inline-flex;flex-wrap:wrap;gap:5px;align-items:center;padding:4px;border-radius:20px;border:3px solid #b894f0;background:rgba(184,148,240,.2)}
.cdG.if{border-color:#6fd48a;background:rgba(111,212,138,.18)}
.cdB{flex:1 1 0;min-width:56px;height:64px;min-height:44px;display:flex;align-items:center;justify-content:center;gap:8px;border-radius:18px;border:4px solid #3a7a47;background:radial-gradient(circle at 40% 28%,#9fe3ac,#4cb866);
 box-shadow:inset 0 3px 0 rgba(255,255,255,.55),0 5px 0 #245230;cursor:pointer;padding:0 8px;font:800 22px "Baloo 2",Prompt,sans-serif;color:#17391f;touch-action:manipulation;-webkit-tap-highlight-color:transparent}
.cdB:active{transform:translateY(3px);box-shadow:inset 0 3px 0 rgba(255,255,255,.55),0 2px 0 #245230}
.cdB .ic{width:38px;height:38px;display:block;pointer-events:none;flex:0 0 auto}
#cdReset{flex:0 0 64px;background:radial-gradient(circle at 40% 28%,#ffe6a8,#f2b62c);border-color:#a8730d;box-shadow:inset 0 3px 0 rgba(255,255,255,.6),0 5px 0 #7a5417}
.cdB.full b{color:#a8240f}
.cdPips{display:flex;flex-wrap:wrap;gap:3px;justify-content:center;align-content:center;max-width:130px}#cdBtns.dock .cdPips{max-width:84px}
.cdPips i{width:10px;height:10px;border-radius:50%;border:2px solid #245230;background:rgba(255,255,255,.55);box-sizing:border-box}
.cdPips i.f{background:#ffd21f;border-color:#7a5417}
.cdB.full .cdPips i.f{background:#e0524a;border-color:#8a2418}
#cdProg.lock .cdT:not(.on){pointer-events:none}#cdBtns.lock #cdRun,#cdPal.lock .cdT{pointer-events:none;filter:grayscale(.6) opacity(.75)}
@keyframes cdPulse{from{transform:scale(1)}to{transform:scale(1.1)}}
@keyframes cdBad{from{transform:translateX(-2px)}to{transform:translateX(2px)}}
#cdWrap.phone{display:flex;flex-direction:column;gap:16px;position:fixed;z-index:7}
#cdWrap.phone #cdLeft{display:contents}
#cdWrap.phone #cdPal,#cdWrap.phone #cdProg{width:auto;padding:14px 4px 4px;border-width:3px;box-shadow:0 0 0 2px #fff1b8,0 5px 0 #5a3414,0 9px 14px rgba(60,40,20,.3)}
#cdWrap.phone #cdProg{box-shadow:0 0 0 2px #d9b98a,0 5px 0 #1f1208,0 9px 14px rgba(30,20,10,.4)}
#cdWrap.phone #cdTiles{gap:3px;justify-content:center}
#cdWrap.phone #cdTiles.c7{display:grid;grid-template-columns:repeat(4,var(--t));justify-content:center}
#cdWrap.phone .cdBadge{width:30px;height:30px;top:-15px;border-width:3px}#cdWrap.phone .cdBadge .ic{width:18px;height:18px}
#cdWrap.phone #cdStrip{flex:0 0 auto;flex-wrap:nowrap;overflow-x:auto;overflow-y:hidden;align-items:center;padding:6px 8px;scrollbar-width:none;-webkit-overflow-scrolling:touch}
#cdWrap.phone #cdStrip::-webkit-scrollbar{display:none}
#cdWrap.phone .cdG{flex-wrap:nowrap;flex:0 0 auto}
#cdWrap.phone.wrap2 #cdStrip{height:calc(var(--t)*2 + 25px);flex:0 0 auto;flex-wrap:wrap;gap:3px;overflow-x:hidden;overflow-y:auto;padding:6px 8px;align-content:flex-start}
#cdWrap.phone.wrap2 .cdG{flex-wrap:wrap;gap:3px;flex:0 1 auto;max-width:100%}
#cdWrap.compact #cdTiles{flex-wrap:nowrap;overflow-x:auto;justify-content:flex-start;scrollbar-width:none;padding:0 0 6px}#cdWrap.compact{gap:14px}#cdWrap.compact #cdTiles.c7{display:flex}
#cdWrap.hscroll #cdStrip{min-height:calc(var(--t) + 20px);flex:0 0 auto;flex-wrap:nowrap;overflow-x:auto;overflow-y:hidden;align-items:center;padding:8px 12px}#cdWrap.hscroll .cdG{flex-wrap:nowrap;flex:0 0 auto}
#cdWrap.tight{gap:10px}#cdWrap.tight #cdPal,#cdWrap.tight #cdProg{padding-top:10px}#cdWrap.tight #cdStrip{padding:6px 8px 4px}#cdWrap.tight #cdTiles{padding-bottom:0}#cdWrap.tight .cdBadge{top:-12px;width:26px;height:26px}#cdWrap.tight .cdBadge .ic{width:15px;height:15px}
#cdBtns.dock{position:fixed;z-index:7;flex-direction:column;gap:8px}
#cdBtns.dock .cdB{flex:0 0 auto;width:100%}
#cdBtns.dock #cdRun{flex-direction:column;gap:0;padding:0}
#cdBtns.dock #cdReset{flex:0 0 auto}
#cdWrap.narrow #cdPal{display:flex;flex-direction:column}#cdWrap.narrow #cdTiles{overflow-y:auto;min-height:0;scrollbar-width:none;touch-action:pan-y;align-content:flex-start;padding:4px 0}#cdWrap.narrow #cdTiles::-webkit-scrollbar{display:none}
#cdBtns.row{position:fixed;z-index:7;flex-direction:row;gap:8px}
#cdBtns.row #cdRun{flex:1 1 auto}
#cdBtns.inline{margin-top:4px}
#cdBtns.inline #cdReset{flex:0 0 64px}
`;
const NS = 'cd';

export function createCodePanel({ band, t, maxCmds, maxLoop, onRun, onReset, onChange }){
  const loopMax = () => { const v = typeof maxLoop === 'function' ? maxLoop() : maxLoop; return Number.isFinite(v) && v >= 2 ? Math.round(v) : CODE.maxLoop; };      // read on every tap: TUNING is loaded before the room starts
  const el = (tag, cls, id) => { const e = document.createElement(tag); if (cls) e.className = cls; if (id) e.id = id; return e; };
  const st = { program: [], cursor: [] }; let max = maxCmds, locked = false, marks = new Map(), hintCmd = null, onEdit = null;
  if (!document.getElementById('cdStyle')){ const s = el('style', '', 'cdStyle'); s.textContent = CSS; document.head.appendChild(s); }
  const pal = el('div', 'cdBox', 'cdPal'), prog = el('div', 'cdBox', 'cdProg'), strip = el('div', '', 'cdStrip'), btns = el('div', '', 'cdBtns');
  pal.setAttribute('role', 'group'); pal.setAttribute('aria-label', t('cd_tiles')); prog.setAttribute('role', 'group'); prog.setAttribute('aria-label', t('cd_program'));
  const tile = (kind, cls = '', label = '') => { const b = el('button', 'cdT ' + cls); b.type = 'button'; b.style.setProperty('--tint', TINT[kind] || '#fff8e6'); b.setAttribute('aria-label', label || t('cd_' + kind.toLowerCase())); if (ICONS[kind]) b.innerHTML = ICONS[kind]; return b; };
  const cmds = ['F', 'L', 'R', 'PLACE', 'DIG']; if (band !== 'a') cmds.push('LOOP'); if (band === 'c') cmds.push('IF');
  const tiles = el('div', '', 'cdTiles'); pal.appendChild(tiles); const palTile = {};
  for (const c of cmds){ const b = tile(c); b.dataset.cmd = c; b.addEventListener('click', () => add(c)); tiles.appendChild(b); palTile[c] = b; }
  const run = el('button', 'cdB', 'cdRun'); run.type = 'button'; run.setAttribute('aria-label', t('cd_run')); run.innerHTML = ICONS.RUN + (band === 'a' ? '<span class="cdPips" id="cdPips"></span>' : '<b id="cdCount"></b>');
  const reset = el('button', 'cdB', 'cdReset'); reset.type = 'button'; reset.setAttribute('aria-label', t('cd_reset')); reset.innerHTML = ICONS.RESET;
  run.addEventListener('click', () => { if (!locked && onRun) onRun(); }); reset.addEventListener('click', () => { if (onReset) onReset(); });
  btns.append(run, reset); prog.append(strip); const left = el('div', '', 'cdLeft'); left.append(pal, btns); const wrap = el('div', '', 'cdWrap'); wrap.append(prog, left);
  const badge = (icon, host) => { const b = el('span', 'cdBadge'); b.innerHTML = ICONS[icon]; b.setAttribute('aria-hidden', 'true'); host.prepend(b); };
  badge('TOOLBOX', pal); badge('FLAGS', prog); document.body.append(wrap);
  const count = run.querySelector('#cdCount'), pips = run.querySelector('#cdPips');
  const same = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);
  const tag = (e, at) => { e.dataset.at = JSON.stringify(at); return e; };

  function add(cmd){
    if (locked) return;
    const c = cmd === 'LOOP' ? { loop: 2, body: [] } : cmd === 'IF' ? { if: 'blocked', then: [], else: [] } : cmd;
    const r = appendCmd(st, c, max); if (r.full){ flash(palTile[cmd]); if (onEdit) onEdit('full'); return; }
    st.program = r.program; st.cursor = r.cursor; hintCmd = null; marks.clear(); draw(true); if (onChange) onChange(st.program);
  }
  function flash(b){ if (!b) return; b.classList.remove('bad'); void b.offsetWidth; b.classList.add('bad'); setTimeout(() => b.classList.remove('bad'), 700); }
  function remove(at){ if (locked) return; const r = removeAt(st, at); st.program = r.program; st.cursor = r.cursor; marks.clear(); hintCmd = null; draw(); if (onChange) onChange(st.program); }
  function cycle(at){ if (locked) return; let n = (at.reduce((l, k) => l[k], st.program)).loop + 1; if (n > loopMax()) n = 2; const r = setLoopCount(st, at, n, loopMax()); st.program = r.program; marks.clear(); draw(); if (onChange) onChange(st.program); }
  const ghost = container => { const g = tile('', 'ghost' + (same(container, st.cursor) ? ' cur' : '')); g.textContent = '+'; g.dataset.ghost = JSON.stringify(container); g.setAttribute('aria-label', t('cd_slot'));
    if (hintCmd && same(container, st.cursor)){ g.classList.add('hintg'); g.innerHTML = ICONS[hintCmd] || ICONS.F; g.dataset.cmd = hintCmd; g.addEventListener('click', () => add(hintCmd)); }
    else g.addEventListener('click', () => { if (locked) return; st.cursor = container.slice(); draw(); });
    return g; };
  function list(items, container, out){
    items.forEach((c, i) => {
      const at = [...container, i];
      if (typeof c === 'string'){ const b = tile(c); tag(b, at); b.addEventListener('click', () => remove(at)); out.push(b); return; }
      const g = el('div', 'cdG ' + (c.if ? 'if' : 'loop')), head = tile(c.if ? 'IF' : 'LOOP'); tag(head, at); head.addEventListener('click', () => remove(at)); g.appendChild(head);
      if (c.loop !== undefined){ const n = tile('', 'cnt'); n.textContent = '×' + c.loop; n.dataset.count = JSON.stringify(at); n.setAttribute('aria-label', t('cd_count', { n: c.loop })); n.addEventListener('click', () => cycle(at)); g.appendChild(n);
        const kids = []; list(c.body, [...at, 'body'], kids); kids.forEach(k => g.appendChild(k)); g.appendChild(ghost([...at, 'body'])); }
      else {
        const yes = tile('YES', 'cnt'); yes.dataset.section = JSON.stringify([...at, 'then']); yes.addEventListener('click', () => { if (!locked){ st.cursor = [...at, 'then']; draw(); } }); g.appendChild(yes);
        const k1 = []; list(c.then || [], [...at, 'then'], k1); k1.forEach(k => g.appendChild(k)); g.appendChild(ghost([...at, 'then']));
        const no = tile('NO', 'cnt'); no.dataset.section = JSON.stringify([...at, 'else']); no.addEventListener('click', () => { if (!locked){ st.cursor = [...at, 'else']; draw(); } }); g.appendChild(no);
        const k2 = []; list(c.else || [], [...at, 'else'], k2); k2.forEach(k => g.appendChild(k)); g.appendChild(ghost([...at, 'else']));
      }
      out.push(g);
    });
  }
  function draw(follow){
    const keep = strip.scrollLeft; strip.textContent = ''; const out = []; list(st.program, [], out); out.push(ghost([])); out.forEach(e => strip.appendChild(e));
    const n = countCmds(st.program); if (count) count.textContent = n + '/' + max; if (pips){ pips.textContent = ''; for (let i = 0; i < max; i++){ const d = document.createElement('i'); if (i < n) d.className = 'f'; pips.appendChild(d); } pips.setAttribute('aria-label', n + '/' + max); } run.classList.toggle('full', n >= max);
    for (const c of cmds) palTile[c].classList.toggle('full', n >= max); for (const c of cmds) palTile[c].classList.toggle('hintp', hintCmd === c);
    for (const [k, cls] of marks){ const e = strip.querySelector(`[data-at='${k}']`); if (e) e.classList.add(cls); }
    strip.scrollLeft = keep; if (follow){ const cur = strip.querySelector('.ghost.cur'); if (cur) strip.scrollLeft = Math.max(0, cur.offsetLeft - strip.clientWidth + 90); strip.scrollTop = strip.scrollHeight; }
  }
  // ---- placement from the real HUD rects (re-run on resize and by the room's frame()) ----
  // level 0 = full size, 1 = single-row scrolling palette and strip (phones), 2 = smaller tiles too. Returns nothing; the room measures the result.
  function layout(level = 0, tile = 56){
    const phone = innerHeight > innerWidth, rc = id => { const e = document.getElementById(id); if (!e) return null; const r = e.getBoundingClientRect(); return r.width ? r : null; };
    const bar = rc('bar'), joy = rc('joy'), pcard = rc('pcard'), stars = rc('stars'), gear = rc('gear'), bView = rc('bView'), safeL = 0;
    const acts = [...document.querySelectorAll('#act .btn')].map(e => e.getBoundingClientRect()).filter(r => r.width);
    const short = !phone && innerHeight < 540, narrow = !phone && innerWidth < 720, T = tile;
    wrap.style.setProperty('--t', T + 'px'); wrap.className = (phone ? 'phone' : 'land') + (phone && level === 0 && band !== 'c' ? ' wrap2' : '') + (phone && level >= 1 ? ' compact' : '') + (short ? ' hscroll' : '') + (short ? ' narrow' : '') + (phone && level >= 2 ? ' tight' : '');
    tiles.classList.toggle('c7', phone && level === 0 && cmds.length === 7);
    ['left', 'right', 'top', 'bottom', 'width', 'maxHeight', 'height'].forEach(k => { wrap.style[k] = left.style[k] = prog.style[k] = btns.style[k] = pal.style[k] = ''; });
    let inline = short;
    if (phone){
      wrap.style.left = wrap.style.right = '4px'; wrap.style.bottom = (innerHeight - (bar ? bar.top - 8 : innerHeight - 232)) + 'px';
      const dockTop = (bar ? bar.bottom : innerHeight - 140) + 8, dockBottom = joy ? joy.bottom : innerHeight - 20;
      const gl = (joy ? joy.right : 114) + 8, gr = Math.min(innerWidth - 8, ...acts.filter(r => r.bottom > dockTop).map(r => r.left)) - 8, gw = gr - gl;
      if (gw >= 56 && dockBottom - dockTop >= 2 * 44 + 8){
        const w = Math.min(94, gw), avail = dockBottom - dockTop, rh = Math.max(44, Math.min(72, avail - 8 - Math.min(56, (avail - 8) / 2))), sh = Math.max(44, Math.min(56, avail - 8 - rh));
        btns.className = 'dock'; btns.style.left = (gl + (gw - w) / 2) + 'px'; btns.style.width = w + 'px'; btns.style.top = (dockBottom - rh - 8 - sh) + 'px'; run.style.height = rh + 'px'; reset.style.height = sh + 'px'; inline = false;
      } else inline = true;
    } else {
      const top = (pcard ? pcard.bottom : 110) + 22, lw = (narrow ? 2 : 3) * T + 16 + 28;
      left.style.left = (14 + safeL) + 'px'; left.style.top = top + 'px'; left.style.width = lw + 'px';
      const ptop = Math.max(stars ? stars.bottom : 68, gear ? gear.bottom : 64, bView ? bView.bottom : 64) + 22, pw = innerWidth < 720 ? 204 : short ? 292 : 356;      // 640x360: the program panel is narrow, so the board keeps a middle
      prog.style.right = '14px'; prog.style.top = ptop + 'px'; prog.style.width = pw + 'px';
      const px0 = innerWidth - 14 - pw, below = acts.filter(r => r.right > px0 && r.top > ptop).map(r => r.top);
      prog.style.maxHeight = ((below.length ? Math.min(...below) - 10 : innerHeight - 20) - ptop) + 'px';
      if (short && joy) pal.style.maxHeight = Math.max(110, joy.top - 8 - top) + 'px';      // short landscape: the palette scrolls between the top row and the joystick (at 640 wide it is also only two tiles wide, to stay left of the goal banner)
      if (short){      // short landscape: Run and Reset sit in a row under the board, between the joystick and the round buttons (there is no height left for them in the program panel)
        const h = Math.max(44, Math.min(48, T)), bt = (bar ? bar.top : innerHeight - 56) - 8, gl = (joy ? joy.right : 114) + 8, gr = Math.min(innerWidth - 8, ...acts.filter(r => r.bottom > bt - h && r.left > gl).map(r => r.left)) - 8;
        btns.className = 'row'; btns.style.left = gl + 'px'; btns.style.width = Math.max(120, gr - gl) + 'px'; btns.style.top = (bt - h) + 'px'; run.style.height = reset.style.height = h + 'px'; inline = false;
      }
    }
    if (inline){ btns.className = 'inline'; if (btns.parentNode !== prog) prog.appendChild(btns); run.style.height = reset.style.height = Math.max(44, T) + 'px'; }
    else { if (btns.className !== 'dock' && btns.className !== 'row') btns.className = ''; if (btns.parentNode !== left) left.appendChild(btns); if (!phone && btns.className !== 'row') run.style.height = reset.style.height = ''; }
    btns.classList.toggle('lock', locked); draw();
  }
  addEventListener('resize', () => layout(wrap.dataset.level | 0, wrap.dataset.tile | 0 || 56));
  draw();
  return {
    layout(level = 0, tile = 56){ wrap.dataset.level = level; wrap.dataset.tile = tile; layout(level, tile); },
    el: { pal, prog, run, reset, strip, wrap },
    getProgram: () => JSON.parse(JSON.stringify(st.program)),
    setMax(n){ max = n; draw(); },
    clear(){ st.program = []; st.cursor = []; marks.clear(); hintCmd = null; draw(); },
    lock(on){ locked = !!on; pal.classList.toggle('lock', locked); prog.classList.toggle('lock', locked); btns.classList.toggle('lock', locked); },
    setActive(at){ strip.querySelectorAll('.on').forEach(e => e.classList.remove('on')); if (!at) return; const e = strip.querySelector(`[data-at='${JSON.stringify(at)}']`); if (e){ e.classList.add('on'); e.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } },
    mark(at, cls = 'bad'){ if (!at) return; marks.set(JSON.stringify(at), cls); draw(); const e = strip.querySelector(`[data-at='${JSON.stringify(at)}']`); if (e) e.scrollIntoView({ block: 'nearest', inline: 'nearest' }); },
    showNext(cmd){ hintCmd = cmd; draw(true); },
    clearHints(){ marks.clear(); hintCmd = null; draw(); },
    onEdit(fn){ onEdit = fn; },
    destroy(){ wrap.remove(); }
  };
}
