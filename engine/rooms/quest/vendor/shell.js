// VENDORED COPY of familycraft-games/shell/shell.js (2026-11-25). Do not edit; re-copy from the source.
// FamilyCraft sub-game shell: the rules every sub-game shares (levels, hints, stars, level suggestions,
// camera rotation by age, parent brief, break timing) and the telemetry calls it makes.
// Pure logic, no DOM and no three.js, so engine rooms and familycraft-games demos can both import it.
// Spec: familycraft-games/plan.html section 3. Tests: shell.test.mjs (node --test).

export const BANDS = ['4-6', '7-9', '10-12'];
export const LEVELS_PER_BAND = 4;

export function bandForAge(age){ return age >= 10 ? 2 : age >= 7 ? 1 : 0; }

// The game type picks the main view (side 2.5D, fixed 3D, rotatable 3D, front); the band picks how much
// the child may turn it: 4-6 never, 7-9 in 90 degree steps, 10-12 freely with a reset button.
export function cameraRule(band){
  return band >= 2 ? { rotate: 'free', reset: true } : band === 1 ? { rotate: 'step90', reset: false } : { rotate: 'lock', reset: false };
}

// levels: [band0[4], band1[4], band2[4]]; each { kind: 'goal'|'free', target, extra?, ... game data }
export function defineGame(def){
  if (!def.levels || def.levels.length !== 3) throw new Error(def.id + ': needs levels for 3 age bands');
  def.levels.forEach((band, b) => {
    if (band.length !== LEVELS_PER_BAND) throw new Error(def.id + ': band ' + BANDS[b] + ' needs 4 levels');
    if (band[3].kind !== 'free') throw new Error(def.id + ': level 4 of band ' + BANDS[b] + ' must be free build');
  });
  return Object.freeze({ ...def });
}

// Hint ladder for one slot: replay the sound (block bounces back), then highlight two choices, then show the answer.
export const HINT = Object.freeze({ REPLAY: 'replay', HIGHLIGHT2: 'highlight2', SHOW: 'show' });
const LADDER = [HINT.REPLAY, HINT.HIGHLIGHT2, HINT.SHOW];

export class Level {
  constructor({ kind = 'goal', target = 1, extra = null } = {}){
    this.kind = kind; this.target = target; this.extra = extra;
    this.value = 0; this.tries = 0; this.hints = 0; this.step = 0; this.done = false;
    this.t0 = Date.now();
  }
  _climb(){
    const h = LADDER[Math.min(this.step, LADDER.length - 1)];
    if (this.step < LADDER.length) this.step++;
    if (h !== HINT.REPLAY && !(h === HINT.SHOW && this._shown)) this.hints++;
    if (h === HINT.SHOW) this._shown = true;
    return h;
  }
  // a block dropped into a slot; ok = the game's own check
  place(ok){
    if (this.done) return { ok, done: true };
    if (!ok){ this.tries++; return { ok: false, hint: this._climb(), done: false }; }
    this.value++; this.step = 0; this._shown = false;
    if (this.value >= this.target) this.done = true;
    return { ok: true, done: this.done, value: this.value, target: this.target };
  }
  askHint(){ return this._climb(); }
  finish(){ if (this.kind === 'free') this.done = true; return { done: this.done }; }
  get sec(){ return Math.round((Date.now() - this.t0) / 1000); }
  // never docked for hints or tries
  stars({ extraMet = false, secretFound = false } = {}){
    if (!this.done) return 0;
    return 1 + (extraMet ? 1 : 0) + (secretFound ? 1 : 0);
  }
}

// Per game and band: best stars per level, and whether to offer a harder or easier band.
export class Progress {
  constructor(json){ this.bestStars = { ...(json?.best || {}) }; this.recent = [...(json?.recent || [])]; }
  record({ level, stars, hints = 0, tries = 0 }){
    this.bestStars[level] = Math.max(this.bestStars[level] || 0, stars);
    this.recent.push({ easy: stars >= 1 && hints === 0 && tries <= 1, helped: hints > 0 });
    this.recent = this.recent.slice(-3);
  }
  best(level){ return this.bestStars[level] || 0; }
  suggest(){
    const r = this.recent;
    if (r.length >= 3 && r.slice(-3).every(x => x.easy)) return 'up';
    if (r.length >= 2 && r.slice(-2).every(x => x.helped)) return 'down';
    return null;
  }
  toJSON(){ return { best: this.bestStars, recent: this.recent }; }
}

// Telemetry for one visit to a sub-game. Reuses the island's Telemetry instance (never make a new one:
// that would start a new session and add listeners). Event names beyond the current EVENTS contract
// (level_start, level_quit, hint_used, role_set, brief_applied) are requested from the engine team.
export class Session {
  constructor(telemetry, { game, band = 0, mode = 'solo', device = 'same' }){
    this.tel = telemetry; this.game = game; this.band = band; this.mode = mode; this.device = device;
    this.level = null; this.t0 = 0; this.lt0 = 0;
  }
  get room(){ return 'sg-' + this.game; }
  goal(level = this.level){ return this.game + '.b' + this.band + '.l' + level; }
  _t(e, d){ this.tel.track(e, d); }
  enter(){
    this.prevRoom = this.tel.room; this.tel.room = this.room; this.t0 = Date.now();
    this._t('room_enter', { room: this.room, mode: this.mode });
    if (this.mode === 'coop') this._t('role_set', { role: 'parent', device: this.device });
  }
  levelStart(level){ this.level = level; this.lt0 = Date.now(); this._t('level_start', { game: this.game, level, band: this.band }); }
  place({ block, ok, slot, value, target, x = 0, y = 0, z = 0 }){
    this._t('block_place', { block, x, y, z, ok, slot });
    if (ok && value != null) this._t('goal_progress', { goal: this.goal(), value, target });
  }
  hint({ step, by = 'child' }){ this._t('hint_used', { game: this.game, level: this.level, step, by }); }
  skill(skill, detail){ this._t('skill', { skill, detail }); }
  brief(b){ this._t('brief_applied', { focus: b.words, words: b.words.length }); }
  complete({ stars, tries, hints }){
    this._t('goal_complete', { goal: this.goal(), sec: Math.round((Date.now() - this.lt0) / 1000), tries, stars, hints });
    this.level = null;
  }
  exit(){
    if (this.level != null) this._t('level_quit', { game: this.game, level: this.level, sec: Math.round((Date.now() - this.lt0) / 1000) });
    this._t('room_exit', { room: this.room, sec: Math.round((Date.now() - this.t0) / 1000) });
    this.tel.room = this.prevRoom;
  }
}

// Parent brief: focus words must exist in the game's bank (each needs a picture and recorded audio).
export function applyBrief(brief, bank){
  const focus = brief?.focus || [];
  return {
    words: focus.filter(w => w in bank),
    missing: focus.filter(w => !(w in bank)),
    minutes: brief?.minutes || 0,
    voice: brief?.voice || null
  };
}

// Suggest a break only between levels, never mid-level.
export function breakDue({ playedMin, limitMin, atLevelEnd }){
  return !!limitMin && atLevelEnd && playedMin >= limitMin;
}

// One call to run a sub-game. build(band, index) returns that level's definition ({kind, target, extra, ...});
// the returned controller is what the game's scene calls when the child acts.
export function startGame(telemetry, { game, age, band = age != null ? bandForAge(age) : 0, mode = 'solo', device = 'same', progress = {} }, build){
  const session = new Session(telemetry, { game, band, mode, device });
  const prog = [0, 1, 2].map(b => new Progress(progress[b]));
  let level = null, index = null, def = null;
  session.enter();
  const need = () => { if (!level) throw new Error(game + ': no level running, call start(index) first'); };
  const ctl = {
    get band(){ return session.band; },
    get camera(){ return cameraRule(session.band); },
    get progress(){ return prog[session.band]; },
    get level(){ return level; },
    get index(){ return index; },
    get def(){ return def; },
    start(i){
      if (level) session._t('level_quit', { game, level: index, sec: Math.round((Date.now() - session.lt0) / 1000) });
      index = i; def = build(session.band, i); level = new Level(def);
      session.levelStart(i); return def;
    },
    right(info = {}){ need(); const r = level.place(true); session.place({ ...info, ok: true, value: r.value, target: r.target }); return r; },
    wrong(info = {}){ need(); const r = level.place(false); session.place({ ...info, ok: false }); if (r.hint !== HINT.REPLAY) session.hint({ step: r.hint, by: 'child' }); return r; },
    hint(by = 'child'){ need(); const h = level.askHint(); session.hint({ step: h, by }); return h; },
    skill(id, detail){ session.skill(id, detail); },
    complete({ extraMet = false, secretFound = false } = {}){
      need(); if (level.kind === 'free') level.finish();
      const stars = level.stars({ extraMet, secretFound });
      session.complete({ stars, tries: level.tries, hints: level.hints });
      prog[session.band].record({ level: index, stars, hints: level.hints, tries: level.tries });
      const out = { stars, tries: level.tries, hints: level.hints, next: index < LEVELS_PER_BAND - 1 ? index + 1 : null, suggest: prog[session.band].suggest() };
      level = null; return out;
    },
    setBand(b){ session.band = Math.max(0, Math.min(2, b)); },
    exit(){ session.exit(); level = null; },
    save(){ return prog.map(p => p.toJSON()); }
  };
  return ctl;
}
