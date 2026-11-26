// The dress-up shop's catalogue (owner 2026-11-27): what can be worn, which slot, and its price in coins (TUNING.shop, admin.html).
// Owned items are kept in localStorage 'fc-owned'; what is worn now is 'fc-wear' (the game reads it when a character loads).
// Only hats exist so far; the other slots show as "coming soon" until their 3D items are designed (wearables must be real 3D).
import { TUNING } from './tuning.js';
import { store } from '../core/core.js';
export const SLOTS = [
  { id: 'hat',   th: 'หมวก',      en: 'Hats' },
  { id: 'top',   th: 'เสื้อ',       en: 'Tops',  soon: true },
  { id: 'bag',   th: 'กระเป๋า',    en: 'Bags',  soon: true },
  { id: 'shoes', th: 'รองเท้า',    en: 'Shoes', soon: true }
];
export const WARDROBE = [
  { id: 'explorer',      slot: 'hat', th: 'หมวกสีทราย', en: 'Sand hat',  price: () => TUNING.shop.hatSand, swatch: '#E0A86C' },
  { id: 'explorer_fern', slot: 'hat', th: 'หมวกสีใบไม้', en: 'Fern hat', price: () => TUNING.shop.hatFern, swatch: '#6BAF5D' },
  { id: 'explorer_sky',  slot: 'hat', th: 'หมวกสีฟ้า', en: 'Sky hat',  price: () => TUNING.shop.hatSky,  swatch: '#A7D8FF' }
];
export const owned = () => { const o = new Set(store.get('fc-owned', [])); WARDROBE.forEach(w => { if (!(w.price() > 0)) o.add(w.id); }); return o; };
export const own = id => { const o = owned(); o.add(id); store.set('fc-owned', [...o]); };
