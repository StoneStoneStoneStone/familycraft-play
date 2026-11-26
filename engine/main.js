// Entry point: pick the room from the address (?room=home) and start.
import { Game } from './game.js';
import { i18n } from './core/i18n.js';
import home from './rooms/home.js';
import tower from './rooms/tower.js';
import blueprint from './rooms/blueprint.js';
import dig from './rooms/dig.js';
import escape from './rooms/escape.js';
import obby from './rooms/obby.js';
import code from './rooms/code.js';
import { mountTogether } from './ui/together.js';
import { loadData } from './data/tuning.js';

const ROOMS = { home, tower, blueprint, dig, escape, code, obby };
const id = (location.search.match(/room=(\w+)/) || [])[1] || 'home';
i18n.apply();
// links from the Family Journey app: ?player=strong|stark|dad|mom (or a character id) picks who plays,
// ?back=<url> adds a "back to Family Journey" button (only familyjourney.io or this computer)
const QS = new URLSearchParams(location.search), WHO = { strong: 'boy', stark: 'stark', dad: 'man', mom: 'woman' };
const pl = (QS.get('player') || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 16);
const wr = (QS.get('wear') || '').toLowerCase().replace(/[^a-z]/g, '').slice(0, 16); if (QS.has('wear')){ try{ localStorage.setItem('fc-wear', JSON.stringify(wr || null)); }catch(e){} }
if (pl){ try{ localStorage.setItem('fc-avatar', JSON.stringify(WHO[pl] || pl)); localStorage.setItem('fc-profile', JSON.stringify(pl)); }catch(e){} }
const back = QS.get('back'); let backOk = false; try{ const u = new URL(back); backOk = (u.protocol === 'https:' && /(^|\.)familyjourney\.io$/.test(u.hostname)) || /^(localhost|127\.0\.0\.1)$/.test(u.hostname); }catch(e){}
if (backOk){ const a = document.getElementById('backFJ'); a.href = back; a.hidden = false; }
const game = new Game(document.getElementById('c'));
if (/[?&]debug/.test(location.search)) window.__g = game;
if (/[?&]fresh/.test(location.search)) localStorage.removeItem('fc-save-' + id);
loadData().then(() => game.enter(ROOMS[id] || home)).then(() => {
  const l = document.getElementById('load'); l.style.opacity = 0; setTimeout(() => l.remove(), 700);
  mountTogether(game); i18n.apply();
  const join = (location.search.match(/join=([A-Za-z]{4})/) || [])[1]; if (join) game.net.join(join);
});

// Landscape only (owner, 2026-11-26). On phones the first touch asks the browser to go full screen and hold landscape;
// Android does it, iPhone Safari does not allow it, so the #rotate screen (css/npc.css) asks the player to turn the phone.
if (matchMedia('(pointer:coarse)').matches){
  const lang = () => { const el = document.getElementById('rotate'); if (el) el.querySelectorAll('[data-th]').forEach(e => { e.textContent = e.dataset[i18n.lang] || e.dataset.th; }); };
  lang(); i18n.onChange(lang);
  const lock = () => { const d = document.documentElement, o = screen.orientation; if (!o || !o.lock) return; const go = () => o.lock('landscape').catch(() => {});
    if (document.fullscreenElement) go(); else if (d.requestFullscreen) d.requestFullscreen({ navigationUI: 'hide' }).then(go).catch(() => {}); };
  addEventListener('pointerup', lock, { once: true });
}
