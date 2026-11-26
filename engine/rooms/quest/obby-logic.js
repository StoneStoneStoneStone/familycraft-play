// Obby quest logic (pure: no three, no engine, runs in plain node). A course is a list of rows; each row has a prompt (shown on a sign
// and, in band a, said aloud) and one block per option. Exactly one option per row is right: step on it to build the way on, a wrong
// block sinks. Every row is level here (height step 0, the walking limit is 1 for band a, so nobody has to jump).
// Band a: compare quantities with dot pictures, and initial sounds (the child hears the word). Band b: times tables.
// Band c: order and compare fractions, decimals and percentages.
import { seeded, QUEST_DEFAULTS } from './common.js';
import { BANKS } from './banks.js';

export const OBBY = {
  rows:    { a: [3, 3, 4, 5], b: [3, 4, 5, 6], c: [3, 4, 5, 6] },     // rows per level (the fourth level is the free level)
  options: { a: [2, 3, 3, 3], b: [3, 3, 3, 3], c: [3, 3, 3, 3] },     // blocks per row, constant inside a level
  pad: 2, gap: 0, dock: 1,                                          // a block is 2x2 cells, blocks touch side by side (a row of n is 2n cells wide), 1 cell of landing between rows
  maxStepA: 1,                                                      // the most a band a row may rise over the one before (no jump needed)
  sinkDelay: QUEST_DEFAULTS.sinkDelay
};

const shuffle = (arr, r) => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--){ const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const pick = (arr, r) => arr[Math.floor(r() * arr.length)];
const clampLevel = l => Math.max(0, Math.min(3, l | 0));

// largest rise from one row to the next (the rows' own heights, in blocks)
export function maxStep(obby){ let m = 0; for (let i = 1; i < obby.rows.length; i++) m = Math.max(m, Math.abs(obby.rows[i].y - obby.rows[i - 1].y)); return m; }

// ---- band a ----
function dotsRow(level, n, rnd){
  const top = level === 0 ? 5 : 6, fewer = level >= 1 && rnd() < .45, counts = shuffle(Array.from({ length: top }, (_, i) => i + 1), rnd).slice(0, n);
  const want = fewer ? Math.min(...counts) : Math.max(...counts);
  return { prompt: fewer ? { th: 'อันไหนน้อยกว่า', en: 'Which has fewer?', say: 'Which has fewer dots?' } : { th: 'อันไหนมากกว่า', en: 'Which has more?', say: 'Which has more dots?' },
    icon: { kind: 'compare', more: !fewer },                      // the picture on the sign (band a has no digits and no need to read)
    options: counts.map(c => ({ label: '●'.repeat(c), dots: c, ok: c === want })) };
}
const LIKE = { c: 'k', k: 'c' };                                         // two letters that say the same first sound: never offered together
function soundRow(n, rnd, used){
  const words = BANKS.words.a.filter(w => !used.has(w)), w = pick(words.length ? words : BANKS.words.a, rnd); used.add(w);
  const right = w[0], pool = BANKS.phonics.a.filter(g => g.length === 1 && g !== right && g !== LIKE[right]);
  const options = shuffle([right, ...shuffle(pool, rnd).slice(0, n - 1)], rnd).map(l => ({ label: l, ok: l === right }));
  return { prompt: { th: `${w} ขึ้นต้นด้วยตัวอะไร`, en: `${w} starts with...?`, say: `${w}. Which letter does ${w} start with?` },
    word: w, icon: { kind: 'word', word: w }, options };            // word: the English target word, spoken with an English voice; icon: its picture on the sign
}
function bandA(level, rnd){
  const n = OBBY.options.a[level], count = OBBY.rows.a[level], used = new Set(), rows = [];
  for (let i = 0; i < count; i++) rows.push(level <= 1 ? dotsRow(level, n, rnd) : level === 2 ? soundRow(n, rnd, used) : (i % 2 ? soundRow(n, rnd, used) : dotsRow(1, n, rnd)));
  return rows;
}

// ---- band b ----
const TABLES = [[2, 5, 10], [3, 4], [6, 8, 9], BANKS.tables.b];          // the bank's order: 2/5/10 first, then up to 12
function bandB(level, rnd){
  const n = OBBY.options.b[level], count = OBBY.rows.b[level], xs = TABLES[level], top = level <= 1 ? 10 : 12, seen = new Set(), rows = [];
  for (let i = 0; i < count; i++){
    let x, y, key, tries = 0;
    do { x = pick(xs, rnd); y = 2 + Math.floor(rnd() * (top - 1)); key = x + 'x' + y; tries++; } while (seen.has(key) && tries < 200);
    seen.add(key); const ans = x * y;
    const near = [x * (y + 1), x * (y - 1), (x + 1) * y, (x - 1) * y, ans + 10, ans - 10, ans + 2, ans - 2, x + y].filter((v, k, a) => v > 0 && v !== ans && a.indexOf(v) === k);
    const decoys = shuffle(near, rnd).slice(0, n - 1);
    rows.push({ prompt: { th: `${x} × ${y} = ?`, en: `${x} × ${y} = ?`, say: `${x} times ${y}` },
      options: shuffle([ans, ...decoys], rnd).map(v => ({ label: String(v), ok: v === ans })) });
  }
  return rows;
}

// ---- band c ----
const fmt = (t, form) => form === 'f' ? t.f : form === 'd' ? String(t.d) : t.p + '%';
// what a block shows: at most 4 characters (so the label stays big enough to read on a block); a longer form (0.125, 12.5%) is shown as the fraction
const lab = (t, form) => { const s = fmt(t, form); return s.length > 4 ? t.f : s; };
function sameRow(n, rnd, bank){
  const t = pick(bank, rnd), forms = shuffle(['f', 'd', 'p'], rnd), from = forms[0], to = forms[1];
  const others = shuffle(bank.filter(x => x.p !== t.p), rnd).slice(0, n - 1);
  return { prompt: { th: `อันไหนเท่ากับ ${fmt(t, from)}`, en: `Which is the same as ${fmt(t, from)}?`, say: `Which is the same as ${fmt(t, from)}?` },
    options: shuffle([t, ...others], rnd).map(x => ({ label: lab(x, to), ok: x === t })) };
}
function orderRow(n, rnd, bank, mixed){
  const ts = shuffle(bank, rnd).slice(0, n), big = rnd() < .5, want = big ? Math.max(...ts.map(t => t.p)) : Math.min(...ts.map(t => t.p)), one = pick(['f', 'd', 'p'], rnd);
  return { prompt: big ? { th: 'อันไหนมากที่สุด', en: 'Which is the biggest?', say: 'Which is the biggest?' } : { th: 'อันไหนน้อยที่สุด', en: 'Which is the smallest?', say: 'Which is the smallest?' },
    options: ts.map(t => ({ label: lab(t, mixed ? pick(['f', 'd', 'p'], rnd) : one), ok: t.p === want })) };
}
function bandC(level, rnd){
  const n = OBBY.options.c[level], count = OBBY.rows.c[level], all = BANKS.fractions.c, easy = all.slice(0, 6), rows = [];
  for (let i = 0; i < count; i++){
    if (level === 0) rows.push(sameRow(n, rnd, easy));
    else if (level === 1) rows.push(orderRow(n, rnd, easy, false));
    else if (level === 2) rows.push(orderRow(n, rnd, all, true));
    else rows.push(i % 2 ? sameRow(n, rnd, all) : orderRow(n, rnd, all, i % 4 === 0));
  }
  return rows;
}

// A whole course: { band, level, kind, n, rows: [{ prompt: {th, en, say}, options: [{ label, ok, dots? }], y }] }.
export function makeObby(band, level){
  const b = ['a', 'b', 'c'].includes(band) ? band : 'b', l = clampLevel(level), rnd = seeded(l, 'obby' + b);
  const rows = (b === 'a' ? bandA : b === 'b' ? bandB : bandC)(l, rnd).map(r => ({ ...r, y: 0 }));
  return { band: b, level: l, kind: l === 3 ? 'free' : 'goal', n: OBBY.options[b][l], rows };
}
