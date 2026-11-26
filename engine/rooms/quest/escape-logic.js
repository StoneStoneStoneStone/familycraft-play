// Escape quest logic (pure: no three, no engine). A puzzle is a clue (shown only while the parent holds the goggles)
// plus floor plates; the child steps on the plates in the answer order. Wrong or repeated plate = back to the start.
import { seeded, QUEST_DEFAULTS } from './common.js';

export const ESCAPE = { free: 3, peekMs: QUEST_DEFAULTS.peekMs };

const COLORS = [{ id: 'red', hex: '#e0524a', th: 'แดง', en: 'red' }, { id: 'blue', hex: '#3d7fd9', th: 'น้ำเงิน', en: 'blue' },
                { id: 'yellow', hex: '#f2c230', th: 'เหลือง', en: 'yellow' }, { id: 'green', hex: '#4aa35a', th: 'เขียว', en: 'green' }];
const SHAPES = [{ id: 'circle', th: 'วงกลม', en: 'circle' }, { id: 'square', th: 'สี่เหลี่ยม', en: 'square' },
                { id: 'triangle', th: 'สามเหลี่ยม', en: 'triangle' }, { id: 'star', th: 'ดาว', en: 'star' }];
const ROMAN = [['X', 10], ['IX', 9], ['V', 5], ['IV', 4], ['I', 1]];

const shuffle = (arr, rnd) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--){ const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
export function romanToInt(s){ let n = 0, i = 0; const t = String(s).toUpperCase(); while (i < t.length){ const two = t.slice(i, i + 2), hit2 = ROMAN.find(r => r[0] === two); if (hit2){ n += hit2[1]; i += 2; } else { n += (ROMAN.find(r => r[0] === t[i]) || [0, 0])[1]; i++; } } return n; }
export function intToRoman(n){ let out = ''; for (const [s, v] of ROMAN) while (n >= v){ out += s; n -= v; } return out; }

// ---- puzzles ----
function bandA(level, rnd){
  // level 0: four plates, every colour and shape different. Later levels add plates that share a colour or a shape, so both must match.
  let items;
  if (level === 0){ const cs = shuffle(COLORS, rnd), ss = shuffle(SHAPES, rnd); items = cs.map((c, i) => ({ color: c.id, shape: ss[i].id })); }
  else { const all = []; for (const c of COLORS) for (const s of SHAPES) all.push({ color: c.id, shape: s.id }); items = shuffle(all, rnd).slice(0, level === 1 ? 5 : 6); }
  const plates = items.map(it => { const c = COLORS.find(x => x.id === it.color), s = SHAPES.find(x => x.id === it.shape);
    return { id: it.color + '-' + it.shape, label: c.en + ' ' + s.en, name: { th: s.th + c.th, en: c.en + ' ' + s.en }, color: it.color, shape: it.shape, hex: c.hex }; });
  const order = shuffle(plates, rnd).slice(0, 3);
  return { clue: { kind: 'sequence', data: { items: order.map(p => ({ color: p.color, shape: p.shape, hex: p.hex })) } }, plates, answer: order.map(p => p.id),
    hint: { th: 'ดูลำดับสัญลักษณ์ แล้วเดินเหยียบให้ตรงทีละแผ่น', en: 'Look at the pattern, then step on the same shapes in order' },
    goalText: { th: 'พ่อแม่ถือแว่น ดูลำดับ ลูกเหยียบแผ่นพื้นให้ตรง', en: 'Parent holds the goggles to see the pattern. Child steps on the plates in order' } };
}
function bandB(level, rnd){
  const labels = ns => ns.map(n => ({ id: String(n), label: String(n) }));
  if (level === 1){      // Roman numerals (Y3): three numerals up to XII, plates are the ordinary numbers
    const ns = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], rnd), ans = ns.slice(0, 3), decoys = ns.slice(3, 5);
    return { clue: { kind: 'roman', data: { numerals: ans.map(intToRoman) } }, plates: shuffle(labels([...ans, ...decoys]), rnd), answer: ans.map(String),
      hint: { th: 'อ่านเลขโรมัน แล้วเหยียบเลขธรรมดาที่ตรงกัน ทีละตัว', en: 'Read each Roman numeral and step on the matching number, one by one' },
      goalText: { th: 'พ่อแม่ถือแว่น อ่านเลขโรมัน ลูกเหยียบเลขที่ตรงกัน', en: 'Parent holds the goggles and reads the Roman numerals. Child steps on the matching numbers' } };
  }
  const h = 1 + Math.floor(rnd() * 12), m = [15, 30, 45][Math.floor(rnd() * 3)];       // the answer: the hour plate, then the minutes plate
  const hs = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].filter(x => x !== h), rnd), ms = shuffle([5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].filter(x => x !== m && x !== h), rnd);
  const ds = level === 0 ? [hs[0], ms[0], hs[1]] : [hs[0], ms[0], hs[1], ms[1]];
  return { clue: { kind: 'clock', data: { h, m } }, plates: shuffle(labels([h, m, ...ds]), rnd), answer: [String(h), String(m)],
    hint: { th: 'ดูนาฬิกา เหยียบเลขชั่วโมงก่อน แล้วเลขนาที', en: 'Read the clock: step on the hour first, then on the minutes' },
    goalText: { th: 'พ่อแม่ถือแว่น อ่านนาฬิกา ลูกเหยียบชั่วโมง แล้วนาที', en: 'Parent holds the goggles and reads the clock. Child steps on the hour, then the minutes' } };
}
function bandC(level, rnd){      // Y6 algebra: each equation hides one number; the answers are stepped on in the order of the equations
  const mk = form => { const n = 2 + Math.floor(rnd() * 13);
    if (form === 'add'){ const a = 3 + Math.floor(rnd() * 15); return { form, a, c: 0, n, r: n + a, text: `? + ${a} = ${n + a}` }; }
    if (form === 'sub'){ const a = 2 + Math.floor(rnd() * 8); return { form, a, c: 0, n, r: n - a, text: `? − ${a} = ${n - a}` }; }
    if (form === 'mul'){ const a = 2 + Math.floor(rnd() * 8); return { form, a, c: 0, n, r: a * n, text: `${a} × ? = ${a * n}` }; }
    const a = 2 + Math.floor(rnd() * 4), c = 1 + Math.floor(rnd() * 9); return { form, a, c, n, r: a * n + c, text: `${a} × ? + ${c} = ${a * n + c}` }; };
  const forms = [['add', 'sub'], ['mul', 'sub'], ['lin', 'mul']][Math.min(level, 2)]; let eqs, tries = 0;
  do { eqs = forms.map(mk); tries++; } while (eqs[0].n === eqs[1].n && tries < 200);      // seeded, so the same level always ends on the same pair
  if (eqs[0].n === eqs[1].n) throw new Error('escape: equation answers must differ');
  const ans = eqs.map(e => e.n), pool = []; for (let v = 1; v <= 18; v++) if (!ans.includes(v)) pool.push(v);
  const decoys = shuffle(pool, rnd).slice(0, level === 0 ? 3 : 4), labels = [...ans, ...decoys].map(n => ({ id: String(n), label: String(n) }));
  return { clue: { kind: 'equation', data: { eqs } }, plates: shuffle(labels, rnd), answer: ans.map(String),
    hint: { th: 'หาเลขที่หายไปในแต่ละสมการ แล้วเหยียบตามลำดับสมการ', en: 'Find the missing number in each equation, then step on them in that order' },
    goalText: { th: 'พ่อแม่ถือแว่น ดูสมการ ลูกเหยียบเลขที่หายไปตามลำดับ', en: 'Parent holds the goggles and reads the equations. Child steps on the missing numbers in order' } };
}
// the free level: no clue, no wrong plate; just step on ESCAPE.free different plates
function freeLevel(band, rnd, need = ESCAPE.free){
  const base = band === 'a' ? bandA(0, rnd) : band === 'b' ? bandB(0, rnd) : bandC(0, rnd), plates = base.plates.slice(0, 4);
  return { clue: { kind: 'free', data: {} }, plates, answer: [], need,
    hint: { th: `เหยียบแผ่นพื้นอะไรก็ได้ ${need} แผ่น`, en: `Step on any ${need} different plates` },
    goalText: { th: `ด่านอิสระ เหยียบแผ่นพื้น ${need} แผ่นที่ต่างกัน`, en: `Free level: step on ${need} different plates` } };
}
// opts.free: plates the free level needs (the room passes TUNING.quest.escapeFree)
export function makePuzzle(band, level, { free = ESCAPE.free } = {}){
  const rnd = seeded(level, 'escape' + band), b = ['a', 'b', 'c'].includes(band) ? band : 'b', l = Math.max(0, Math.min(3, level | 0));
  if (l === 3) return freeLevel(b, rnd, Math.max(1, Math.min(4, Math.round(free) || ESCAPE.free)));
  return (b === 'a' ? bandA : b === 'b' ? bandB : bandC)(l, rnd);
}

// ---- plate presses (pure: returns a new state) ----
export function startState(puzzle){ return { pos: 0, answer: puzzle.answer.slice(), free: puzzle.clue.kind === 'free', need: puzzle.need ?? ESCAPE.free, seen: [] }; }
export function pressPlate(state, plateId){
  if (state.free){
    const seen = state.seen.includes(plateId) ? state.seen : [...state.seen, plateId];
    return { state: { ...state, seen, pos: seen.length }, result: seen.length >= state.need ? 'done' : 'ok' };
  }
  if (state.pos >= state.answer.length) return { state, result: 'done' };                                    // door already open
  if (plateId === state.answer[state.pos]){ const pos = state.pos + 1; return { state: { ...state, pos }, result: pos >= state.answer.length ? 'done' : 'ok' }; }
  return { state: { ...state, pos: 0 }, result: 'wrong' };                                                // wrong order or a repeated plate
}
