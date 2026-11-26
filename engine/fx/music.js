// Background music (rewritten 2026-11-27). Songs are notes in songs.js, played by a small Web Audio synth:
// kalimba, marimba, electric piano, ukulele pluck and a whistle for tunes; a few bass styles; a quiet pad; light drums.
// The island song is the player's choice (music.html, stored as fc-bgm); while you talk to an islander their own
// song cross-fades in (theme()). If audio/bgm-<song>.mp3 exists (a recorded track), that file plays instead.
import { store } from '../core/core.js';
import { SONGS } from './songs.js';

const NAMES = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
const hz = m => 440 * Math.pow(2, (m - 69) / 12);
const midi = s => { const m = /^([A-G][#b]?)(\d)$/.exec(s); return m ? 12 * (+m[2] + 1) + NAMES[m[1]] : null; };
const parseBar = bar => bar.trim().split(/\s+/).map(t => { const [n, d] = t.split(':'); return [n === '-' ? null : midi(n), +d]; });
function chord(name){   // 'Am', 'E7', 'Fmaj7', 'Dm7', 'C' -> midi notes around octave 3, plus the root
  const m = /^([A-G][#b]?)(maj7|m7|m|7)?$/.exec(name), r = 48 + NAMES[m[1]], q = m[2] || '';
  const iv = { '': [0, 4, 7], m: [0, 3, 7], '7': [0, 4, 7, 10], maj7: [0, 4, 7, 11], m7: [0, 3, 7, 10] }[q];
  return { root: r, notes: iv.map(i => r + i) };
}
export const songList = () => Object.entries(SONGS).map(([id, s]) => ({ id, th: s.th, en: s.en, mood: s.mood }));

export class Music {
  constructor(sound){
    this.s = sound; this.on = store.get('fc-music', true); this.room = 'home'; this.song = store.get('fc-bgm', 'cider'); if (!SONGS[this.song]) this.song = 'cider'; this.talk = null; this.started = false;
    const go = () => { removeEventListener('pointerdown', go); removeEventListener('keydown', go); this.started = true; if (this.on) this.start(); };
    addEventListener('pointerdown', go); addEventListener('keydown', go);
  }
  set(on){ this.on = on; store.set('fc-music', on); if (on && this.started) this.start(); else this.stop(); }
  choose(id){ if (!SONGS[id]) return; this.song = id; store.set('fc-bgm', id); if (!this.talk && this.playing){ this.stop(); this.start(); } }
  // an islander's song while talking (null = back to the island song)
  theme(id){ const want = id && SONGS[id] ? id : null; if (want === this.talk) return; this.talk = want; if (this.playing){ this.stop(true); this.start(); } }
  current(){ return this.talk || this.song; }
  async start(){
    if (this.playing) return; this.playing = true; const id = this.current();
    try{ const url = 'audio/bgm-' + id + '.mp3', r = await fetch(url, { method: 'HEAD' });
      if (r.ok && this.playing){ this.file = Object.assign(new Audio(url), { loop: true, volume: 0 }); await this.file.play(); const f = this.file, t0 = performance.now(); const up = () => { if (this.file !== f) return; f.volume = Math.min(.5, (performance.now() - t0) / 1600 * .5); if (f.volume < .5) requestAnimationFrame(up); }; up(); return; } }catch(e){}
    if (SONGS[id].file || !SONGS[id].melody){ return; }   // a recorded song whose file is missing: stay quiet rather than play notes it does not have
    this.s.ensure(); const c = this.s.ctx; if (!c || !this.playing) return;
    const out = this.out = c.createGain(); out.gain.value = 0; out.gain.linearRampToValueAtTime(.5, c.currentTime + 1.2);
    const comp = c.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 3; out.connect(comp); comp.connect(c.destination);
    this.echo = c.createDelay(); this.echo.delayTime.value = .27; const fb = c.createGain(), ew = c.createGain(); fb.gain.value = .22; ew.gain.value = .25; this.echo.connect(fb); fb.connect(this.echo); this.echo.connect(ew); ew.connect(out);
    const S = this.S = SONGS[id]; this.beat = 60 / S.bpm; this.bar = 0; this.next = c.currentTime + .15;
    this.mel = S.melody.map(parseBar); this.chs = S.chords.map(chord);
    this.timer = setInterval(() => this.tick(), 60);
  }
  stop(quick){ this.playing = false; clearInterval(this.timer); this.timer = null; if (this.file){ this.file.pause(); this.file = null; }
    if (this.out){ const c = this.s.ctx, o = this.out; o.gain.cancelScheduledValues(c.currentTime); o.gain.setTargetAtTime(0, c.currentTime, quick ? .12 : .3); setTimeout(() => o.disconnect(), 1500); this.out = null; } }
  tick(){ const c = this.s.ctx; while (this.out && this.next < c.currentTime + .5){ this.playBar(this.bar, this.next); this.next += this.beat * this.S.beats; this.bar++; } }
  // swing pushes every off-beat eighth later
  sw(beatPos){ const f = beatPos % 1; return f > .4 && f < .6 ? this.S.swing * .17 : 0; }

  // ---------------- instruments ----------------
  osc(type, f, t, dur, vol, { attack = .005, decay = dur, dest, detune = 0, filter, glide } = {}){
    const c = this.s.ctx, o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.setValueAtTime(glide || f, t); if (glide) o.frequency.exponentialRampToValueAtTime(f, t + .06); o.detune.value = detune;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + attack); g.gain.setTargetAtTime(0, t + attack, Math.max(.02, decay / 3));
    let node = o; if (filter){ const fl = c.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.setValueAtTime(filter[0], t); fl.frequency.exponentialRampToValueAtTime(filter[1], t + dur); o.connect(fl); node = fl; }
    node.connect(g); g.connect(dest || this.out); o.start(t); o.stop(t + dur + 1.2); return o;
  }
  noise(t, dur, freq, vol, type = 'bandpass'){
    const c = this.s.ctx, n = Math.ceil(c.sampleRate * dur), b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n) ** 2;
    const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(); s.buffer = b; f.type = type; f.frequency.value = freq; g.gain.value = vol; s.connect(f); f.connect(g); g.connect(this.out); s.start(t);
  }
  lead(kind, m, t, dur){ const f = hz(m);
    if (kind === 'kalimba'){ this.osc('sine', f, t, 1.1, .16, { decay: .9 }); this.osc('sine', f * 3.01, t, .25, .025, { decay: .15 }); this.osc('sine', f, t, .9, .04, { decay: .7, dest: this.echo }); }
    else if (kind === 'marimba'){ this.osc('sine', f, t, .7, .17, { decay: .5 }); this.osc('sine', f * 4, t, .12, .03, { decay: .06 }); this.osc('sine', f, t, .5, .035, { decay: .4, dest: this.echo }); }
    else if (kind === 'epiano'){ const c = this.s.ctx, car = c.createOscillator(), mod = c.createOscillator(), mg = c.createGain(), g = c.createGain(); car.frequency.value = f; mod.frequency.value = f; mg.gain.setValueAtTime(f * 1.2, t); mg.gain.setTargetAtTime(f * .1, t, .15);
      mod.connect(mg); mg.connect(car.frequency); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.12, t + .01); g.gain.setTargetAtTime(0, t + .02, Math.max(.25, dur * .6)); car.connect(g); g.connect(this.out); car.start(t); mod.start(t); car.stop(t + dur + 2); mod.stop(t + dur + 2); }
    else if (kind === 'uke'){ this.osc('triangle', f, t, .5, .14, { decay: .35, filter: [3200, 700] }); this.osc('triangle', f * 2, t, .2, .03, { decay: .1 }); }
    else if (kind === 'whistle'){ const o = this.osc('sine', f, t, dur * .95, .12, { attack: .03, decay: dur * 1.2, glide: f * .94 }); this.osc('sine', f * 2, t, dur * .9, .012, { attack: .04, decay: dur });
      const c = this.s.ctx, l = c.createOscillator(), lg = c.createGain(); l.frequency.value = 5.5; lg.gain.value = f * .008; l.connect(lg); lg.connect(o.frequency); l.start(t + .1); l.stop(t + dur + .5); }
  }
  bassNote(kind, m, t, dur){ const f = hz(m - 12);
    if (kind === 'walk'){ this.osc('triangle', f, t, dur * .8, .22, { decay: dur * .5, filter: [900, 300] }); }
    else if (kind === 'bounce'){ this.osc('square', f, t, dur * .6, .06, { decay: dur * .3, filter: [1200, 300] }); this.osc('sine', f, t, dur * .6, .16, { decay: dur * .4 }); }
    else if (kind === 'pluck'){ this.osc('triangle', f, t, dur, .2, { decay: dur * .6, filter: [1400, 400] }); }
    else this.osc('sine', f, t, dur, .2, { attack: .02, decay: dur * .8 }); }
  playBar(i, t){
    const S = this.S, b = this.beat, N = S.beats, ch = this.chs[i % this.chs.length], mel = this.mel[i % this.mel.length], last = i % this.mel.length === this.mel.length - 1;
    // pad: a quiet sustained chord, very slow attack
    if (S.pad) ch.notes.slice(1).forEach(m => { this.osc('triangle', hz(m + 12), t, b * N, .018, { attack: .5, decay: b * N * 1.2, detune: -6, filter: [1500, 900] }); this.osc('triangle', hz(m + 12), t, b * N, .014, { attack: .6, decay: b * N * 1.2, detune: 7, filter: [1500, 900] }); });
    // bass
    const r = ch.root, fifth = r + 7, tones = ch.notes;
    if (S.bass === 'walk') [r, tones[1], fifth, tones[2] + 2 > r + 12 ? r + 10 : tones[2]].forEach((m, k) => this.bassNote('walk', m, t + k * b + this.sw(k), b * .9));
    else if (S.bass === 'bounce') [0, 1.5, 2, 3].forEach((k, j) => this.bassNote('bounce', j % 2 ? fifth : r, t + k * b, b * .5));
    else if (N === 3){ this.bassNote(S.bass, r, t, b * 1.8); this.bassNote(S.bass, fifth, t + 2 * b, b * .9); }
    else { this.bassNote(S.bass, r, t, b * 1.6); this.bassNote(S.bass, fifth, t + 2 * b, b * 1.4); }
    // tune
    let pos = 0; for (const [m, d] of mel){ if (m !== null) this.lead(S.lead, m, t + pos * b + this.sw(pos), d * b); pos += d; }
    // drums
    for (let k = 0; k < N; k++){ const at = t + k * b;
      if (S.drums === 'brush'){ if (k % 2) this.noise(at, .12, 3500, .05); this.noise(at + b * .5 + this.sw(.5), .05, 6000, .02, 'highpass'); if (k === 0) this.osc('sine', 90, at, .2, .12, { decay: .12, glide: 140 }); }
      else if (S.drums === 'shaker'){ this.noise(at, .06, 6500, k ? .025 : .035, 'highpass'); if (k === 0) this.osc('sine', 80, at, .25, .1, { decay: .15, glide: 120 }); }
      else if (S.drums === 'lofi'){ if (k === 0 || k === 2) this.osc('sine', 70, at, .3, .17, { decay: .18, glide: 130 }); if (k % 2) this.noise(at, .14, 1800, .07); this.noise(at + b * .5 + this.sw(.5), .04, 7000, .018, 'highpass'); }
      else if (S.drums === 'pop'){ if (k % 2 === 0) this.osc('sine', 85, at, .22, .17, { decay: .12, glide: 150 }); else this.noise(at, .1, 2200, .08); this.noise(at + b * .5, .03, 8000, .02, 'highpass'); }
      else if (S.drums === 'claps'){ if (k % 2){ this.noise(at, .05, 1500, .09); this.noise(at + .012, .07, 1300, .07); } if (k === 0) this.osc('sine', 75, at, .22, .15, { decay: .12, glide: 140 }); this.noise(at + b * .5 + this.sw(.5), .03, 7500, .02, 'highpass'); }
    }
    if (last && S.drums === 'claps') this.osc('sine', 330, t + b * (N - .5), .25, .06, { glide: 900, decay: .2 });   // a cheeky "boing" at the end of the phrase
  }
}
