// Play telemetry: every meaningful moment becomes one small event, so the parent back office can show
// play time, what the child did, what they learned and how they play. Events stay on the device for now
// (localStorage, capped); a sender for the family's account (Supabase) plugs into `flush`.
//
// Event record: { t: ms epoch, s: session id, p: profile id, r: room id, e: type, d: {data} }
// The catalogue below is the contract with the back office; add new types here first.
export const EVENTS = {
  session_start:  'game opened (d: device, lang)',
  session_end:    'game closed or hidden (d: activeSec, totalSec)',
  heartbeat:      'every 30 s of active play (d: activeSec since last)',
  room_enter:     'entered a room (d: room, mode)',
  coins_earned:   'got coins (d: n, reason, total)',
  coins_spent:    'spent coins (d: n, reason, total)',
  room_exit:      'left a room (d: room, sec)',
  goal_progress:  'a room goal moved (d: goal, value, target)',
  goal_complete:  'a room goal reached (d: goal, sec, tries)',
  block_place:    'placed a block (d: block, x, y, z)',
  block_break:    'dug a block (d: block, x, y, z)',
  item_pickup:    'picked up an item (d: item, n)',
  item_use:       'used a held item (d: item, effect)',
  mob_defeat:     'defeated a critter (d: mob, weapon, hits)',
  hurt:           'lost hearts (d: cause, amount, hp)',
  respawn:        'ran out of hearts (d: cause)',
  avatar_change:  'changed character (d: avatar)',
  setting_change: 'changed a setting (d: key, value)',
  skill:          'a learning moment the room recognised (d: skill, detail)',
  together_start: 'joined or made a play-together room (d: role host|guest, via)',
  together_end:   'left a play-together room (d: sec)',
  craft:          'crafted an item (d: item, n)',
  rest:           'sat down or slept to recover (d: kind sit|sleep, sec)',
  farm:           'a farming step (d: action till|plant|water|harvest, crop)',
  // quest mini-games (sub-games shell)
  level_start:    'a quest level began (d: room, level, age band)',
  level_complete: 'a quest level was finished (d: room, level, stars, seconds, hints)',
  hint_used:      'the player asked for a hint (d: room, level, rung)',
  level_quit:     'the player left a level before finishing (d: room, level, seconds)',
  role_set:       'a co-op role was chosen (d: room, role)',
  brief_applied:  'a quest brief (subject, year group) was applied (d: room, subject, year)'
};

const KEY = 'fc-telemetry-v1', CAP = 5000, IDLE_MS = 30000;
const safe = { get(k){ try{ return localStorage.getItem(k); }catch(e){ return null; } }, set(k,v){ try{ localStorage.setItem(k,v); }catch(e){} } };

export class Telemetry {
  constructor({ profile = 'child', room = '' } = {}){
    this.profile = profile; this.room = room;
    this.session = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    this.queue = []; this.lastInput = Date.now(); this.active = 0; this.started = Date.now(); this.sinceBeat = 0; this.ended = false;
    this.track('session_start', { device: /Mobi|Android|iPhone|iPad/.test(navigator.userAgent) ? 'mobile' : 'desktop', lang: document.documentElement.lang });
    const end = () => this.end(); addEventListener('pagehide', end); document.addEventListener('visibilitychange', () => { if (document.hidden) this.end(); else if (this.ended) this.resume(); });
  }
  track(type, data = {}){
    if (!(type in EVENTS)) console.warn('telemetry: unknown event', type);
    this.queue.push({ t: Date.now(), s: this.session, p: this.profile, r: this.room, e: type, d: data });
    if (this.queue.length >= 20 || type === 'session_end') this.flush();
  }
  input(){ this.lastInput = Date.now(); }              // call on any player input
  tick(dt){                                             // call every frame: counts only time with recent input
    if (this.ended) return;
    if (Date.now() - this.lastInput < IDLE_MS){ this.active += dt; this.sinceBeat += dt; }
    if (this.sinceBeat >= 30){ this.track('heartbeat', { activeSec: Math.round(this.sinceBeat) }); this.sinceBeat = 0; }
  }
  end(){ if (this.ended) return; this.ended = true; this.track('session_end', { activeSec: Math.round(this.active), totalSec: Math.round((Date.now() - this.started) / 1000) }); }
  resume(){ this.ended = false; this.started = Date.now(); this.active = 0; this.track('session_start', { resumed: true }); }
  flush(){
    if (!this.queue.length) return;
    let all = []; try{ all = JSON.parse(safe.get(KEY) || '[]'); }catch(e){}
    all = all.concat(this.queue).slice(-CAP); this.queue = [];
    safe.set(KEY, JSON.stringify(all));
    // TODO(account): also POST the batch to the family's account when signed in.
  }
}
export function readEvents(){ try{ return JSON.parse(safe.get(KEY) || '[]'); }catch(e){ return []; } }
