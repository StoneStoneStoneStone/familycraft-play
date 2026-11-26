// Coins (owner 2026-11-27, asked in the Top 20 window: "a UI that counts money"). One purse per player on this device,
// kept across rooms and visits like the other saves. Rooms pay and charge through game.coins; the HUD listens to 'coins' on game.bus.
//   game.coins.get()             -> how many coins now
//   game.coins.add(n, reason)    -> adds n (whole, > 0), returns what was added
//   game.coins.spend(n, reason)  -> true and takes n if there are enough, otherwise false and nothing changes
// Each change is recorded for the parent page as coins_earned / coins_spent with the reason (e.g. 'bridge_job', 'shop_hat').
// Wages per job live in TUNING.coins (admin.html).
import { store } from './core.js';
import { TUNING } from '../data/tuning.js';
const KEY = 'fc-coins';
export class Coins {
  constructor(game){ this.g = game; const v = store.get(KEY, null); this.n = v === null ? Math.max(0, TUNING.coins.start | 0) : Math.max(0, v | 0); }
  get(){ return this.n; }
  add(n, reason = 'other'){ n = Math.round(n); if (!(n > 0)) return 0; this.n += n; this.save();
    this.g.bus.emit('coins', { n: this.n, delta: n, reason }); this.g.track('coins_earned', { n, reason, total: this.n }); return n; }
  spend(n, reason = 'other'){ n = Math.round(n); if (!(n > 0)) return false;
    if (n > this.n){ this.g.bus.emit('coins', { n: this.n, delta: 0, reason, short: n - this.n }); return false; }
    this.n -= n; this.save(); this.g.bus.emit('coins', { n: this.n, delta: -n, reason }); this.g.track('coins_spent', { n, reason, total: this.n }); return true; }
  save(){ store.set(KEY, this.n); }
}
