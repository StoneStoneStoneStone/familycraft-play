// Thai / English words. Elements with data-t="key" are filled automatically; rooms can add their own words.
import { store } from './core.js';

const WORDS = {
  th: { load:'กำลังปั้นเกาะ…', swap:'แตะเพื่อเปลี่ยนตัว', set:'ตั้งค่า', langL:'ภาษา', skinL:'หน้าตาปุ่ม', skA:'ดินปั้น', skB:'ลูกกวาด', skC:'ช่างไม้',
        soundL:'เสียง', wardrobe:'ร้านแต่งตัว', tool_broke:'เครื่องมือพังแล้ว ไปประดิษฐ์อันใหม่ที่ปุ่มประดิษฐ์นะ', on:'เปิด', off:'ปิด', mission:'ไปภารกิจกันน้ำท่วม', goHome:'เกาะบ้าน', backFJ:'กลับ Family Journey', goTower:'ภารกิจหอคอย', parent:'หน้าพ่อแม่', close:'กลับไปเล่น', rest:'พักก่อนนะ แล้วลุยใหม่', saved:'บันทึกแล้ว', bag:'กระเป๋า', tired:'เหนื่อยแล้ว นั่งพักก่อนนะ', slept:'นอนหลับเต็มอิ่ม พลังเต็มแล้ว', craft:'ประดิษฐ์', craftHint:'มีของครบ กดเพื่อสร้าง', music:'เพลง', bagHint:'แตะของ แล้วแตะอีกช่องเพื่อสลับ' },
  en: { load:'Shaping the island…', swap:'tap to switch', set:'Settings', langL:'Language', skinL:'Button style', skA:'Clay', skB:'Candy', skC:'Workshop',
        soundL:'Sound', wardrobe:'Dress-up shop', tool_broke:'Your tool broke. Make a new one with the craft button', on:'On', off:'Off', mission:'Go to the flood mission', goHome:'Home island', backFJ:'Back to Family Journey', goTower:'Tower challenge', parent:'Parents', close:'Back to play', rest:'Take a rest, then try again', saved:'Saved', bag:'Bag', tired:'Tired. Sit down for a rest', slept:'A good sleep. Full of energy', craft:'Craft', craftHint:'Tap a recipe when you have everything', music:'Music', bagHint:'Tap an item, then another slot to swap' }
};
let lang = store.get('fc-lang', 'th'); if (lang !== 'th' && lang !== 'en') lang = 'th';
const listeners = [];

export const i18n = {
  get lang(){ return lang; },
  add(dict){ for (const l of ['th', 'en']) Object.assign(WORDS[l], dict[l] || {}); },
  t(key, vars){ let s = WORDS[lang][key] ?? WORDS.th[key] ?? key; if (vars) for (const k in vars) s = s.replace('{' + k + '}', vars[k]); return s; },
  set(l){ lang = l; store.set('fc-lang', l); this.apply(); listeners.forEach(f => f(l)); },
  onChange(f){ listeners.push(f); },
  apply(root = document){ document.documentElement.lang = lang; root.querySelectorAll('[data-t]').forEach(e => { e.textContent = this.t(e.dataset.t); }); }
};
