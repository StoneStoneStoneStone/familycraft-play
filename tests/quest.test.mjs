// Quest common layer tests. Run: node tests/quest.test.mjs
import assert from 'node:assert/strict';
let fails = 0;
const check = async (name, fn) => { try { await fn(); console.log('PASS ' + name); } catch (e) { fails++; console.log('FAIL ' + name + ' -> ' + e.message); } };

await check('common.js: getBand / seeded / QUEST_DEFAULTS', async () => {
  const { getBand, seeded, QUEST_DEFAULTS } = await import('../engine/rooms/quest/common.js');
  assert.equal(getBand('?band=a', null), 'a');
  assert.equal(getBand('', 'c'), 'c');
  assert.equal(getBand('?band=z', null), 'b');
  assert.equal(seeded(2, 'x')(), seeded(2, 'x')());
  assert.notEqual(seeded(2, 'x')(), seeded(3, 'x')());
  const r = seeded(1, 'y'); const v = r(); assert.ok(v >= 0 && v < 1 && r() !== v);
  assert.equal(QUEST_DEFAULTS.levels, 4);
});
await check('banks.js: BANKS content', async () => {
  const { BANKS } = await import('../engine/rooms/quest/banks.js');
  for (const g of ['sh', 'ch', 'th', 'ai', 'ay']) assert.ok(BANKS.phonics.a.includes(g), g);
  assert.ok(BANKS.phonics.b.includes('-ment'));
  assert.ok(BANKS.phonics.c.includes('-cious'));
  assert.ok(BANKS.phonics.b.length && BANKS.phonics.c.length);
  assert.ok(BANKS.tables.b.includes(2) && BANKS.tables.b.includes(12));
  assert.ok(BANKS.fractions.c.length);
  assert.deepEqual(BANKS.eras.map(e => e.id), ['stone', 'bronze', 'iron', 'egypt', 'greece', 'maya']);
  assert.ok(BANKS.words.a.length && BANKS.words.b.length && BANKS.words.c.length);
});
await check('vendor/shell.js is an exact copy plus one comment line', async () => {
  const fs = await import('node:fs');
  const src = fs.readFileSync(new URL('../../familycraft-games/shell/shell.js', import.meta.url), 'utf8');
  const v = fs.readFileSync(new URL('../engine/rooms/quest/vendor/shell.js', import.meta.url), 'utf8');
  const [first, ...rest] = v.split('\n');
  assert.equal(first, '// VENDORED COPY of familycraft-games/shell/shell.js (2026-11-25). Do not edit; re-copy from the source.');
  assert.equal(rest.join('\n'), src);
});
await check('use-shell.js: startQuest maps band c to 2', async () => {
  if (!globalThis.localStorage) { const m = new Map(); globalThis.localStorage = { getItem: k => m.has(k) ? m.get(k) : null, setItem: (k, v) => m.set(k, String(v)) }; }
  const { startQuest } = await import('../engine/rooms/quest/use-shell.js');
  const game = { telemetry: { track() {}, room: 'home' } };
  const seen = [];
  const ctl = startQuest(game, { gameId: 'demo', band: 'c', levels: (band, i) => { seen.push([band, i]); return { kind: i === 3 ? 'free' : 'goal', target: 2, extra: 1 }; } });
  assert.equal(ctl.band, 2);
  ctl.start(0); assert.deepEqual(seen[0], ['c', 0]);
  assert.equal(startQuest(game, { gameId: 'demo', band: 'a', levels: () => ({ kind: 'goal', target: 1, extra: 0 }) }).band, 0);
  assert.equal(game.telemetry.room, 'sg-demo');
});
// ---- Task 2: blueprint logic ----
const bpKey = b => JSON.stringify([b.size, b.cells]);
const gridOf = bp => { const m = new Map(bp.cells.map(([x, y, z, id]) => [x + ',' + y + ',' + z, id])); return (x, y, z) => m.get(x + ',' + y + ',' + z) || 0; };
await check('blueprintLevelsDiffer: 4 levels per band differ', async () => {
  const { makeBlueprint } = await import('../engine/rooms/quest/blueprint-logic.js');
  for (const band of ['a', 'b', 'c']){
    const keys = new Set([0, 1, 2, 3].map(l => bpKey(makeBlueprint(band, l))));
    assert.equal(keys.size, 4, band);
    const x = makeBlueprint(band, 1); assert.ok(x.goalText.th && x.goalText.en && x.cells.length > 0);
    assert.deepEqual(bpKey(makeBlueprint(band, 1)), bpKey(x));
  }
  const a = makeBlueprint('a', 0); assert.ok(a.size[0] >= 3 && a.size[0] <= 4 && a.size[1] === 1);
  for (const l of [0, 1, 2, 3]){ const q = makeBlueprint('a', l), g = gridOf(q); for (const [x, y, z, id] of q.cells) assert.equal(g(q.size[0] - 1 - x, y, z), id, 'mirror'); }
  for (const l of [0, 1, 2, 3]){ const q = makeBlueprint('b', l); assert.ok(q.size[1] >= 2 && q.size[1] <= 3); }
});
await check('blueprintPerfectPasses', async () => {
  const { makeBlueprint, compareBuild } = await import('../engine/rooms/quest/blueprint-logic.js');
  for (const band of ['a', 'b', 'c']) for (const l of [0, 1, 2, 3]){
    const bp = makeBlueprint(band, l), r = compareBuild(bp, gridOf(bp));
    assert.deepEqual([r.missing, r.extra, r.matched, r.pct], [0, 0, bp.cells.length, 100], band + l);
  }
});
await check('blueprintMissingCounts', async () => {
  const { makeBlueprint, compareBuild } = await import('../engine/rooms/quest/blueprint-logic.js');
  const bp = makeBlueprint('b', 0), g = gridOf(bp), [x, y, z] = bp.cells[0], [x2, y2, z2] = bp.cells[1];
  const r = compareBuild(bp, (a, b, c) => (a === x && b === y && c === z) || (a === x2 && b === y2 && c === z2) ? 0 : g(a, b, c));
  assert.equal(r.missing, 2); assert.equal(r.extra, 0); assert.equal(r.matched, bp.cells.length - 2); assert.ok(r.pct < 100);
  assert.equal(compareBuild(bp, () => 0).matched, 0);
});
await check('blueprintExtraBlockFails', async () => {
  const { makeBlueprint, compareBuild } = await import('../engine/rooms/quest/blueprint-logic.js');
  const bp = makeBlueprint('a', 0), g = gridOf(bp); let ex = null;
  for (let x = 0; x < bp.size[0] && !ex; x++) for (let z = 0; z < bp.size[2] && !ex; z++) if (!g(x, 0, z)) ex = [x, 0, z];
  assert.ok(ex, 'has an empty cell');
  const r = compareBuild(bp, (a, b, c) => (a === ex[0] && b === ex[1] && c === ex[2]) ? 'brick' : g(a, b, c));
  assert.equal(r.extra, 1); assert.equal(r.missing, 0); assert.ok(r.pct < 100);
  const wrong = compareBuild(bp, (a, b, c) => g(a, b, c) ? 'stone' : 0); assert.equal(wrong.matched, 0); assert.ok(wrong.missing > 0 && wrong.extra > 0);
  assert.equal(compareBuild(bp, (a, b, c) => (a === 99 ? 'brick' : g(a, b, c))).extra, 0);    // outside the plot box is ignored
});
await check('blueprintBandCVolume: cells equal the stated volume', async () => {
  const { makeBlueprint } = await import('../engine/rooms/quest/blueprint-logic.js');
  for (const l of [0, 1, 2, 3]){
    const bp = makeBlueprint('c', l);
    assert.equal(bp.cells.length, bp.volume); assert.equal(bp.plan.flat().reduce((s, v) => s + v, 0), bp.volume);
    assert.ok(bp.goalText.en.includes(String(bp.volume)) && bp.goalText.th.includes(String(bp.volume)));
    assert.equal(bp.front.length, bp.size[0]);
  }
});

// ---- dig (Task 3) ----
const digMod = () => import('../engine/rooms/quest/dig-logic.js');
await check('digFindsInsideLayers', async () => {
  const { makeDigSite, DIG } = await digMod(); const { QUEST_DEFAULTS } = await import('../engine/rooms/quest/common.js');
  for (const band of ['a', 'b', 'c']) for (const l of [0, 1, 2, 3]){
    const s = makeDigSite(band, l), seen = new Set();
    assert.equal(s.layers.length, QUEST_DEFAULTS.digLayers); assert.ok(s.finds.length >= 3);
    for (const f of s.finds){
      assert.ok(f.y >= 1 && f.y < s.layers.length, `${band}${l} y ${f.y}`);                // inside a layer, never in the open top row
      assert.ok(f.x >= DIG.findX0 && f.x <= DIG.findX1[band], `${band}${l} x ${f.x}`);         // inside the rock, away from the stairs
      assert.ok(f.z >= 0 && f.z < s.size.z);
      const k = [f.x, f.y, f.z].join(); assert.ok(!seen.has(k), 'distinct cells'); seen.add(k);
      assert.ok(f.item && f.label && f.era);
    }
    const sc = s.secret; assert.ok(sc && !seen.has([sc.x, sc.y, sc.z].join()), 'secret is not on a find');
  }
  assert.equal(makeDigSite('b', 0, 3).layers.length, 3);                                    // layer count is a parameter
  assert.deepEqual(makeDigSite('b', 1), makeDigSite('b', 1));
});
await check('digEraByDepth: deeper = older', async () => {
  const { eraForDepth } = await digMod(); const { BANKS } = await import('../engine/rooms/quest/banks.js');
  const from = id => BANKS.eras.find(e => e.id === id).from;
  for (let d = 1; d <= 4; d++) assert.ok(from(eraForDepth(d)) < from(eraForDepth(d - 1)), 'depth ' + d);
  assert.equal(eraForDepth(0), 'greece'); assert.equal(eraForDepth(4), 'stone'); assert.equal(eraForDepth(9), 'stone'); assert.equal(eraForDepth(-1), 'greece');
  const { makeDigSite } = await digMod();
  for (const l of [0, 1, 2, 3]) for (const f of makeDigSite('b', l).finds){ assert.equal(f.era, eraForDepth(f.y, 'b')); assert.ok(['stone', 'bronze', 'iron'].includes(f.era), 'band b: stone, bronze, iron only'); }
  const bf = id => BANKS.eras.find(e => e.id === id).from; for (let d = 1; d <= 4; d++) assert.ok(bf(eraForDepth(d, 'b')) <= bf(eraForDepth(d - 1, 'b')), 'b chain: deeper is not newer');
  assert.deepEqual([0, 1, 2, 3, 4].map(d => eraForDepth(d, 'b')), ['iron', 'iron', 'bronze', 'bronze', 'stone']);
});
await check('digTimelineOrder', async () => {
  const { makeDigSite, checkTimeline, eraForDepth } = await digMod();
  assert.equal(checkTimeline(['stone', 'bronze', 'iron', 'greece']), true);
  assert.equal(checkTimeline(['greece', 'iron', 'bronze', 'stone']), false);
  assert.equal(checkTimeline(['stone', 'iron', 'bronze']), false);
  assert.equal(checkTimeline(['stone', 'stone', 'iron']), true);
  assert.equal(checkTimeline(['nope', 'stone']), false); assert.equal(checkTimeline([]), false);
  for (const l of [0, 1, 2, 3]){
    const s = makeDigSite('c', l), eras = s.finds.map(f => f.era);
    assert.equal(new Set(eras).size, eras.length, 'c: every find has its own era');
    const sorted = [...s.finds].sort((p, q) => q.y - p.y).map(f => f.era);               // deepest first
    assert.equal(checkTimeline(sorted), true); assert.deepEqual(s.task.order, sorted); assert.equal(checkTimeline([...sorted].reverse()), false);
    assert.equal(s.task.type, 'timeline'); void eraForDepth;
  }
});
await check('digBandAReachable: no jumping, every find within 2 blocks of open ground', async () => {
  const { makeDigSite } = await digMod(); const { BANKS } = await import('../engine/rooms/quest/banks.js'); const words = new Set();
  for (const l of [0, 1, 2, 3]){
    const s = makeDigSite('a', l);
    for (const f of s.finds){ assert.ok(f.y <= 2 && f.y >= 1, 'depth ' + f.y); assert.equal(f.z, 0); }   // front plane of the cross-section
    assert.equal(s.task.type, 'letters'); assert.ok(BANKS.words.a.includes(s.task.word));
    assert.deepEqual(s.finds.map(f => f.label).sort(), [...s.task.word].sort()); assert.equal(new Set(s.finds.map(f => f.label)).size, s.finds.length);
    assert.ok(s.secret.y <= 2); assert.equal(s.size.z, 1);       // a true cross-section, one block thick
    words.add(s.task.word);
  }
  assert.equal(words.size, 4, 'four different words');
  for (const band of ['b', 'c']) for (const l of [0, 1, 2]) assert.ok(makeDigSite(band, l).size.z >= 3);
});
await check('digTagTask: band b shelves hold at most 2 per era', async () => {
  const { makeDigSite } = await digMod();
  for (const l of [0, 1, 2, 3]){ const s = makeDigSite('b', l), per = {}; s.finds.forEach(f => per[f.era] = (per[f.era] || 0) + 1);
    assert.ok(Object.keys(per).length >= 3 && Math.max(...Object.values(per)) <= 2); assert.equal(s.task.type, 'tag'); assert.deepEqual(s.task.perEra, per);
    assert.equal(s.free, l === 3); assert.ok(s.task.goalText.th && s.task.goalText.en); }
});

// ---- escape logic ----
const escMod = () => import('../engine/rooms/quest/escape-logic.js');
await check('escapeCorrectSequence: every band and level is solvable in order, plates unique, shapes right', async () => {
  const { makePuzzle, startState, pressPlate } = await escMod();
  for (const band of ['a', 'b', 'c']) for (const l of [0, 1, 2, 3]){
    const pz = makePuzzle(band, l), ids = pz.plates.map(p => p.id);
    assert.equal(new Set(ids).size, ids.length, 'unique plate ids'); assert.ok(pz.plates.every(p => p.id && p.label));
    assert.ok(pz.clue && pz.clue.kind && pz.clue.data !== undefined); assert.ok(pz.hint.th && pz.hint.en && pz.goalText.th && pz.goalText.en);
    if (l === 3){ assert.equal(pz.clue.kind, 'free'); assert.deepEqual(pz.answer, []); assert.ok(ids.length >= 3); continue; }
    assert.ok(pz.answer.length >= (band === 'a' ? 3 : 2) && pz.answer.every(a => ids.includes(a)), band + l);
    assert.ok(ids.length > pz.answer.length, 'has decoys'); assert.equal(new Set(pz.answer).size, pz.answer.length);
    if (band === 'a'){ assert.equal(pz.answer.length, 3); assert.equal(pz.clue.kind, 'sequence'); assert.ok(pz.plates.every(p => p.color && p.shape)); }
    let st = startState(pz), r;
    pz.answer.forEach((id, i) => { ({ state: st, result: r } = pressPlate(st, id)); assert.equal(r, i === pz.answer.length - 1 ? 'done' : 'ok', band + l + ' step ' + i); });
    assert.equal(pressPlate(st, ids[0]).result, 'done');                          // already open: stays done
  }
  assert.deepEqual(makePuzzle('b', 1), makePuzzle('b', 1));                       // seeded
  assert.notDeepEqual(makePuzzle('b', 0).clue, makePuzzle('b', 2).clue);
  const f = makePuzzle('a', 3); let st = startState(f), r;                        // free level: step on 3 different plates, any order, never wrong
  for (const id of [f.plates[2].id, f.plates[0].id, f.plates[2].id, f.plates[1].id]){ ({ state: st, result: r } = pressPlate(st, id)); assert.notEqual(r, 'wrong'); }
  assert.equal(r, 'done');
});
await check('escapeOrderResets: a wrong plate or a repeated plate sends the sequence back to 0', async () => {
  const { makePuzzle, startState, pressPlate } = await escMod();
  for (const band of ['a', 'b', 'c']){
    const pz = makePuzzle(band, 0), A = pz.answer; let st = startState(pz), r;
    ({ state: st, result: r } = pressPlate(st, A[0])); assert.equal(r, 'ok'); assert.equal(st.pos, 1);
    ({ state: st, result: r } = pressPlate(st, A[0])); assert.equal(r, 'wrong'); assert.equal(st.pos, 0);          // same plate twice
    ({ state: st } = pressPlate(st, A[0])); const other = pz.plates.map(p => p.id).find(id => id !== A[1]);
    ({ state: st, result: r } = pressPlate(st, other)); assert.equal(r, 'wrong'); assert.equal(st.pos, 0);          // wrong plate
    if (A.length > 2){ ({ state: st } = pressPlate(st, A[0])); ({ state: st, result: r } = pressPlate(st, A[2])); assert.equal(r, 'wrong'); assert.equal(st.pos, 0); }   // wrong order
    ({ state: st, result: r } = pressPlate(st, A[1])); assert.equal(r, 'wrong'); assert.equal(st.pos, 0);          // second plate first
    pz.answer.forEach(id => { ({ state: st, result: r } = pressPlate(st, id)); }); assert.equal(r, 'done');        // still solvable after resets
  }
  const pz = makePuzzle('b', 0), st0 = startState(pz); pressPlate(st0, pz.answer[0]); assert.equal(st0.pos, 0, 'input state is not mutated');
});
await check('escapeBandBClock: answer is the hour plate then the minutes plate, derived from clue.data', async () => {
  const { makePuzzle, romanToInt } = await escMod(); let clocks = 0, romans = 0;
  for (const l of [0, 1, 2, 3]){
    const pz = makePuzzle('b', l); if (pz.clue.kind === 'clock'){
      clocks++; const { h, m } = pz.clue.data; assert.ok(h >= 1 && h <= 12 && [15, 30, 45].includes(m));
      assert.deepEqual(pz.answer, [String(h), String(m)]); assert.deepEqual(pz.plates.filter(p => pz.answer.includes(p.id)).map(p => p.label).sort(), [String(h), String(m)].sort());
    } else if (pz.clue.kind === 'roman'){ romans++; assert.deepEqual(pz.answer, pz.clue.data.numerals.map(n => String(romanToInt(n)))); }
  }
  assert.ok(clocks >= 2 && romans >= 1); assert.equal(romanToInt('XIV'), 14); assert.equal(romanToInt('IX'), 9); assert.equal(romanToInt('VII'), 7);
});
await check('escapeBandC: missing-number equations, answer solves each in order', async () => {
  const { makePuzzle } = await escMod();
  for (const l of [0, 1, 2]){
    const pz = makePuzzle('c', l); assert.equal(pz.clue.kind, 'equation'); assert.ok(pz.clue.data.eqs.length >= 2);
    pz.clue.data.eqs.forEach((e, i) => { assert.ok(e.text.includes('?')); assert.equal(String(e.n), pz.answer[i]); assert.equal(e.a * e.n + e.c === e.r || e.n + e.a === e.r || e.n - e.a === e.r, true); });
  }
});

// ---- code logic ----
const codeMod = () => import('../engine/rooms/quest/code-logic.js');
const OPEN = ['.....', '.....', '.....', '.....'];                                   // 5 wide, 4 deep; z = 0 is the north (top) row, dir 0 = north
await check('codeForwardReaches: F moves one cell, L and R turn, reaching G reports reached', async () => {
  const { runProgram } = await codeMod();
  const g = ['...G.', '.....', '.....', '.....'];
  let r = runProgram(g, { x: 0, z: 3, dir: 0 }, ['F', 'F', 'F', 'R', 'F', 'F', 'F']);
  assert.equal(r.error, null); assert.equal(r.reached, true); assert.deepEqual(r.path.map(s => [s.x, s.z]).pop(), [3, 0]); assert.equal(r.path.length, 8, 'start + one entry per command');
  assert.deepEqual(r.path[0], { x: 0, z: 3, dir: 0, cmd: null, at: null });
  r = runProgram(g, { x: 0, z: 3, dir: 0 }, ['R', 'R', 'R', 'R', 'L']); assert.equal(r.path.pop().dir, 3); assert.equal(r.reached, false);        // four rights = back, then left = west
  r = runProgram(g, { x: 0, z: 3, dir: 0 }, ['F', 'F']); assert.equal(r.reached, false); assert.equal(r.error, null);
});
await check('codeBumpStops: a wall, a hole or the edge stops the run with error bump; later commands do not run', async () => {
  const { runProgram } = await codeMod();
  const g = ['.....', '.#...', '.~...', '.....'];
  let r = runProgram(g, { x: 1, z: 3, dir: 0 }, ['F', 'F', 'F']);                               // (1,2) is a hole: bump at once
  assert.equal(r.error, 'bump'); assert.equal(r.path.length, 2); assert.deepEqual(r.path[1].bump, [1, 2]); assert.equal(r.path[1].x, 1); assert.equal(r.path[1].z, 3);
  r = runProgram(g, { x: 1, z: 0, dir: 3 }, ['F', 'F']); assert.equal(r.error, 'bump'); assert.equal(r.path.length, 3); assert.deepEqual(r.path[2].bump, [-1, 0]);   // the edge
  r = runProgram(g, { x: 1, z: 0, dir: 2 }, ['F']); assert.equal(r.error, 'bump');             // wall at (1,1)
  assert.equal(runProgram(g, { x: 0, z: 3, dir: 0 }, ['F', 'F', 'F', 'F']).error, 'bump');     // walked off the north edge
});
await check('codePlaceDigChangeWorld: PLACE fills a hole or builds a wall, DIG clears a wall, PLACE on a wall bumps', async () => {
  const { runProgram } = await codeMod();
  const g = ['.....', '#....', '~....', '.G...'];
  let r = runProgram(g, { x: 0, z: 3, dir: 0 }, ['PLACE', 'F', 'F']);                            // hole filled, walked on, then the wall at (0,1) bumps
  assert.deepEqual(r.placed, [[0, 2]]); assert.equal(r.grid[2][0], '.'); assert.equal(r.error, 'bump'); assert.deepEqual(r.path[1].cell, [0, 2]);
  r = runProgram(g, { x: 0, z: 3, dir: 0 }, ['PLACE', 'F', 'DIG', 'F', 'F']);
  assert.equal(r.error, null); assert.deepEqual(r.dug, [[0, 1]]); assert.equal(r.grid[1][0], '.'); assert.deepEqual([r.path.at(-1).x, r.path.at(-1).z], [0, 0]);
  r = runProgram(OPEN, { x: 0, z: 3, dir: 0 }, ['PLACE']); assert.equal(r.grid[2][0], '#'); assert.deepEqual(r.placed, [[0, 2]]);   // a block on open floor becomes a wall
  r = runProgram(OPEN, { x: 0, z: 3, dir: 0 }, ['PLACE', 'PLACE']); assert.equal(r.error, 'bump'); assert.equal(r.placed.length, 1);   // not on a wall
  r = runProgram(OPEN, { x: 0, z: 3, dir: 0 }, ['DIG']); assert.equal(r.error, null); assert.deepEqual(r.dug, []);                  // nothing to dig is harmless
  r = runProgram(['.G...', '.....', '.....', '.....'], { x: 0, z: 0, dir: 1 }, ['PLACE']); assert.equal(r.error, 'bump');            // not on the goal flag
  const g2 = OPEN.slice(); runProgram(g2, { x: 0, z: 3, dir: 0 }, ['PLACE']); assert.deepEqual(g2, OPEN, 'input grid is not mutated');
});
await check('codeLoopExpands: loop n repeats its body, nested loops multiply, loop 0 does nothing', async () => {
  const { runProgram } = await codeMod();
  let r = runProgram(OPEN, { x: 0, z: 3, dir: 0 }, [{ loop: 3, body: ['F'] }]); assert.equal(r.path.length, 4); assert.equal(r.path.pop().z, 0);
  r = runProgram(OPEN, { x: 0, z: 3, dir: 0 }, [{ loop: 3, body: ['F', 'R', 'F', 'L'] }]); assert.deepEqual([r.path.at(-1).x, r.path.at(-1).z, r.path.at(-1).dir], [3, 0, 0]);   // three stairs up
  r = runProgram(['.....', '.....', '.....', '.....'], { x: 0, z: 3, dir: 1 }, [{ loop: 2, body: [{ loop: 2, body: ['F'] }, 'L'] }]); assert.equal(r.path.length - 1, 6);   // 2 x (2 F + 1 L)
  assert.equal(runProgram(OPEN, { x: 0, z: 3, dir: 0 }, [{ loop: 0, body: ['F'] }]).path.length, 1);
  r = runProgram(OPEN, { x: 0, z: 3, dir: 0 }, [{ loop: 3, body: ['F'] }]); assert.deepEqual(r.path.map(s => s.at), [null, [0, 'body', 0], [0, 'body', 0], [0, 'body', 0]]);   // which tile ran
});
await check('codeIfBranches: if blocked runs then, otherwise else; the check itself is not a step', async () => {
  const { runProgram } = await codeMod();
  const g = ['.....', '.....', '..#..', '.....'];
  const prog = [{ if: 'blocked', then: ['R'], else: ['F'] }];
  let r = runProgram(g, { x: 2, z: 3, dir: 0 }, prog); assert.equal(r.path.length, 2); assert.equal(r.path[1].cmd, 'R'); assert.equal(r.path[1].dir, 1); assert.deepEqual(r.path[1].at, [0, 'then', 0]);   // wall ahead
  r = runProgram(g, { x: 1, z: 3, dir: 0 }, prog); assert.equal(r.path[1].cmd, 'F'); assert.deepEqual([r.path[1].x, r.path[1].z], [1, 2]); assert.deepEqual(r.path[1].at, [0, 'else', 0]);
  r = runProgram(g, { x: 0, z: 0, dir: 0 }, prog); assert.equal(r.path[1].cmd, 'R');                        // the edge counts as blocked
  r = runProgram(g, { x: 0, z: 3, dir: 0 }, [{ if: 'blocked', then: ['R'] }]); assert.equal(r.path.length, 1);   // no else = nothing
  r = runProgram(['.....', '.....', '.....', '.....'], { x: 0, z: 3, dir: 0 }, [{ loop: 5, body: [{ if: 'blocked', then: ['R'], else: ['F'] }] }]);
  assert.deepEqual([r.path.at(-1).x, r.path.at(-1).z, r.path.at(-1).dir], [1, 0, 1]);                        // 3 F, turn at the edge, F
});
await check('runProgramStepCap: a runaway loop stops with error steps at codeMaxSteps', async () => {
  const { runProgram } = await codeMod(); const { QUEST_DEFAULTS } = await import('../engine/rooms/quest/common.js');
  const r = runProgram(OPEN, { x: 0, z: 3, dir: 0 }, [{ loop: 999, body: ['L'] }]);
  assert.equal(r.error, 'steps'); assert.equal(r.path.length - 1, QUEST_DEFAULTS.codeMaxSteps); assert.equal(r.reached, false);
  assert.equal(runProgram(OPEN, { x: 0, z: 3, dir: 0 }, [{ loop: 999, body: ['L'] }], 10).path.length - 1, 10);          // the cap is a parameter
  assert.equal(runProgram(OPEN, { x: 0, z: 3, dir: 0 }, [{ loop: 9999999, body: [] }]).error, 'steps');                   // empty loops cannot hang the page
  assert.equal(runProgram(OPEN, { x: 0, z: 3, dir: 0 }, [{ loop: 200, body: ['L'] }]).error, null);                       // exactly the cap is fine
});
await check('codeBandALimits: band a rejects loop and if, band b rejects if, c allows both, length is capped', async () => {
  const { validateProgram } = await codeMod();
  const loop = [{ loop: 2, body: ['F'] }], iff = [{ if: 'blocked', then: ['F'], else: ['L'] }];
  assert.equal(validateProgram(['F', 'L', 'R', 'PLACE', 'DIG'], 'a', 9).ok, true);
  assert.equal(validateProgram(loop, 'a', 9).ok, false); assert.equal(validateProgram(iff, 'a', 9).ok, false);
  assert.equal(validateProgram(loop, 'b', 9).ok, true); assert.equal(validateProgram(iff, 'b', 9).ok, false);
  assert.equal(validateProgram(loop, 'c', 9).ok, true); assert.equal(validateProgram(iff, 'c', 9).ok, true);
  assert.equal(validateProgram([{ loop: 2, body: [{ if: 'blocked', then: ['F'] }] }], 'b', 9).ok, false, 'nested if is still an if');
  assert.equal(validateProgram(['F', 'F', 'F'], 'a', 2).ok, false); assert.equal(validateProgram(['F', 'F'], 'a', 2).ok, true);
  assert.equal(validateProgram(['JUMP'], 'c', 9).ok, false); assert.equal(validateProgram([{ loop: 0, body: ['F'] }], 'c', 9).ok, false);
});
await check('codeLevels: 4 levels per band, the stated solution passes within maxCmds and the band limits; level 4 is free', async () => {
  const { makeCodeLevel, validateProgram, runProgram, levelPassed, countCmds } = await codeMod();
  const seen = new Set();
  for (const band of ['a', 'b', 'c']) for (const l of [0, 1, 2, 3]){
    const lv = makeCodeLevel(band, l); seen.add(JSON.stringify([lv.grid, lv.start, lv.need]));
    assert.ok(lv.grid.length === 4 && lv.grid.every(r => r.length === 5), band + l); assert.ok(lv.maxCmds >= 4 && lv.goalText.th && lv.goalText.en && lv.hint.th && lv.hint.en);
    assert.equal(lv.free, l === 3); assert.deepEqual(lv.start && Object.keys(lv.start).sort(), ['dir', 'x', 'z']);
    const v = validateProgram(lv.solution, band, lv.maxCmds); assert.ok(v.ok, band + l + ' ' + v.reason); assert.equal(countCmds(lv.solution) <= lv.maxCmds, true);
    const run = runProgram(lv.grid, lv.start, lv.solution); assert.equal(run.error, null, band + l); assert.equal(levelPassed(lv, run), true, band + l);
    if (lv.free){ assert.equal(lv.goal, null); assert.ok(lv.need.count >= 4); }
    else if (lv.goal){ assert.equal(lv.grid[lv.goal[1]][lv.goal[0]], 'G'); assert.equal(run.reached, true); }
    else { assert.equal(l, 2); assert.equal(band, 'b'); assert.equal(lv.need.placeAt.length, 4); }                // band b level 3: build a wall on the gold squares
    assert.equal(levelPassed(lv, runProgram(lv.grid, lv.start, [])), false, 'empty program never passes');
    assert.ok(lv.secret && lv.grid[lv.secret[1]][lv.secret[0]] === '.', band + l + ' hidden bolt on open floor'); assert.ok(!run.path.some(e => e.x === lv.secret[0] && e.z === lv.secret[1]), 'off the stated way');
    assert.ok(run.path.concat([lv.start]).some(e => Math.abs(e.x - lv.secret[0]) + Math.abs(e.z - lv.secret[1]) === 1), 'one step from the way');
  }
  assert.equal(seen.size, 12, 'all twelve levels differ');
  assert.deepEqual(makeCodeLevel('b', 1), makeCodeLevel('b', 1));
  const { solvePlan } = await codeMod();                                                                                   // the shortest flat program: band a fits it, b and c need loops (and c ifs)
  for (const l of [0, 1, 2]){ const a = makeCodeLevel('a', l), pa = solvePlan(a); assert.ok(pa && pa.length <= a.maxCmds, 'a' + l);
    for (const band of ['b', 'c']){ const v = makeCodeLevel(band, l), pv = solvePlan(v); assert.ok(pv && pv.length > v.maxCmds, band + l + ' flat ' + (pv && pv.length)); } }
});
await check('codeFreeLevel: placing the required number of blocks anywhere passes, fewer does not; goal levels need the flag and every required block', async () => {
  const { makeCodeLevel, runProgram, levelPassed } = await codeMod();
  const f = makeCodeLevel('a', 3);
  assert.equal(levelPassed(f, runProgram(f.grid, f.start, ['PLACE', 'R', 'F', 'PLACE', 'L', 'PLACE'])), false);          // 3 blocks of 4
  assert.equal(levelPassed(f, runProgram(f.grid, f.start, ['PLACE', 'R', 'F', 'PLACE', 'L', 'PLACE', 'L', 'PLACE'])), true);
  const a1 = makeCodeLevel('a', 1);                                                                                         // a river level: the flag is the goal, a bump never passes
  assert.equal(levelPassed(a1, { error: null, reached: true, placed: [[2, 1]] }), true); assert.equal(levelPassed(a1, { error: 'bump', reached: true, placed: [[2, 1]] }), false);
  assert.equal(levelPassed(a1, { error: null, reached: false, placed: [[2, 1]] }), false);
  const b2 = makeCodeLevel('b', 2);                                                                                         // a build level: every gold square needs a block, the flag does not exist
  assert.equal(levelPassed(b2, runProgram(b2.grid, b2.start, [{ loop: 3, body: ['PLACE', 'R', 'F', 'L'] }])), false);     // 3 of 4
  assert.equal(levelPassed(b2, runProgram(b2.grid, b2.start, b2.solution)), true);
});
await check('codeHints: bump -> the bump cell and tile; a wrong turn -> the first tile that can no longer win; show -> the next correct command', async () => {
  const { makeCodeLevel, runProgram, hintFor } = await codeMod();
  const lv = makeCodeLevel('a', 0);                                                                                           // F F R F F F from (0,3) north, flag at (3,1)
  let prog = ['F', 'F', 'F', 'F'], run = runProgram(lv.grid, lv.start, prog), h = hintFor(lv, prog, run);                    // walked off the north edge
  assert.equal(run.error, 'bump'); assert.deepEqual(h.bumpCell, [0, -1]); assert.deepEqual(h.bumpAt, [3]); assert.deepEqual(h.wrongAt, [2]); assert.equal(h.next, 'R');   // the third F already overshot the turn
  prog = ['F', 'R', 'F', 'F']; run = runProgram(lv.grid, lv.start, prog); h = hintFor(lv, prog, run);                          // turned too early (at (0,2): the flag is up one more row)
  assert.equal(run.error, null); assert.equal(run.reached, false); assert.deepEqual(h.wrongAt, [1]); assert.equal(h.bumpCell, null); assert.equal(h.next, 'F');
  prog = ['F', 'F', 'R', 'F']; run = runProgram(lv.grid, lv.start, prog); h = hintFor(lv, prog, run);                          // everything so far is fine, just unfinished
  assert.equal(h.wrongAt, null); assert.equal(h.next, 'F');
  h = hintFor(lv, [], runProgram(lv.grid, lv.start, [])); assert.equal(h.wrongAt, null); assert.equal(h.next, 'F');
  const a1 = makeCodeLevel('a', 1); prog = ['F', 'F', 'R', 'F']; run = runProgram(a1.grid, a1.start, prog); h = hintFor(a1, prog, run); assert.equal(h.next, 'PLACE');   // the hole is next
  const a2 = makeCodeLevel('a', 2); prog = ['F', 'F']; run = runProgram(a2.grid, a2.start, prog); assert.equal(run.error, 'bump'); h = hintFor(a2, prog, run); assert.equal(h.next, 'DIG'); assert.deepEqual(h.bumpCell, [0, 1]);
  const f = makeCodeLevel('a', 3); h = hintFor(f, ['F'], runProgram(f.grid, f.start, ['F'])); assert.equal(h.wrongAt, null); assert.ok(['PLACE', 'F', 'L', 'R'].includes(h.next));
});
await check('codeEditor: append at the cursor, loops and ifs open a section, removing a group closes it, cap on length, counts cycle', async () => {
  const { appendCmd, removeAt, setLoopCount, listAt, countCmds } = await codeMod();
  let st = { program: [], cursor: [] };
  st = appendCmd(st, 'F', 9); st = appendCmd(st, { loop: 2, body: [] }, 9); assert.deepEqual(st.cursor, [1, 'body']);
  st = appendCmd(st, 'R', 9); st = appendCmd(st, { if: 'blocked', then: [], else: [] }, 9); assert.deepEqual(st.cursor, [1, 'body', 1, 'then']);
  st = appendCmd(st, 'F', 9); st.cursor = [1, 'body', 1, 'else']; st = appendCmd(st, 'L', 9);
  assert.deepEqual(st.program, ['F', { loop: 2, body: ['R', { if: 'blocked', then: ['F'], else: ['L'] }] }]); assert.equal(countCmds(st.program), 6);
  assert.deepEqual(listAt(st.program, [1, 'body', 1, 'then']), ['F']);
  st = setLoopCount(st, [1], 5); assert.equal(st.program[1].loop, 5); st = setLoopCount(st, [1], 12, 9); assert.equal(st.program[1].loop, 9, 'clamped');
  st = removeAt(st, [1, 'body', 1]); assert.deepEqual(st.cursor, [1, 'body'], 'cursor leaves a removed group'); assert.deepEqual(st.program[1].body, ['R']);
  st = removeAt(st, [0]); assert.deepEqual(st.program, [{ loop: 9, body: ['R'] }]); assert.deepEqual(st.cursor, [0, 'body'], 'indexes shift');
  const full = appendCmd({ program: ['F', 'F'], cursor: [] }, 'F', 2); assert.equal(full.program.length, 2); assert.equal(full.full, true);
  const t = { program: ['F'], cursor: [] }; appendCmd(t, 'L', 9); assert.deepEqual(t.program, ['F'], 'append does not mutate its input');
});

// ---- Task 6: obby logic ----
const obbyMod = () => import('../engine/rooms/quest/obby-logic.js');
await check('obbyOneCorrectPerRow: every band and level, exactly one ok option, distinct labels, constant option count', async () => {
  const { makeObby, OBBY } = await obbyMod();
  for (const band of ['a', 'b', 'c']) for (let level = 0; level < 4; level++){
    const o = makeObby(band, level); assert.ok(o.rows.length >= 3 && o.rows.length <= 6, band + level + ' rows');
    assert.equal(o.rows.length, OBBY.rows[band][level]); assert.equal(o.kind, level === 3 ? 'free' : 'goal');
    for (const r of o.rows){
      assert.equal(r.options.filter(x => x.ok).length, 1, `${band}${level} one ok`);
      assert.equal(r.options.length, o.n); assert.equal(new Set(r.options.map(x => x.label)).size, r.options.length, 'distinct labels');
      assert.ok(r.prompt.th && r.prompt.en && r.prompt.say, 'prompt text'); assert.ok(r.options.every(x => typeof x.label === 'string' && x.label.length));
    }
    assert.deepEqual(makeObby(band, level), o, 'same level, same course');
  }
  assert.notDeepEqual(makeObby('b', 0).rows.map(r => r.prompt.en), makeObby('b', 1).rows.map(r => r.prompt.en));
  assert.ok(new Set(makeObby('b', 1).rows.map(r => r.prompt.en)).size === makeObby('b', 1).rows.length, 'no repeated question in a level');
});
await check('obbyBandBTables: the ok answer equals x*y from the prompt; tables grow by level up to 12x12', async () => {
  const { makeObby } = await obbyMod(); const seen = new Set(); let maxX = 0;
  for (let level = 0; level < 4; level++) for (const r of makeObby('b', level).rows){
    const m = /^(\d+) × (\d+) = \?$/.exec(r.prompt.en); assert.ok(m, r.prompt.en); const x = +m[1], y = +m[2]; seen.add(x); maxX = Math.max(maxX, x, y);
    assert.equal(r.options.find(o => o.ok).label, String(x * y)); assert.ok(r.options.every(o => /^\d+$/.test(o.label) && +o.label > 0));
    assert.equal(r.prompt.th, r.prompt.en); assert.ok(r.prompt.say.includes('times'));
  }
  const first = makeObby('b', 0).rows.map(r => +/^(\d+)/.exec(r.prompt.en)[1]); assert.ok(first.every(x => [2, 5, 10].includes(x)), '2/5/10 first: ' + first);
  assert.ok(maxX <= 12 && maxX >= 10, 'up to 12: ' + maxX);
});
await check('obbyBandANoJump: band a rows are level (height step <= 1), the same for every band here', async () => {
  const { makeObby, maxStep, OBBY } = await obbyMod();
  for (let level = 0; level < 4; level++){ const o = makeObby('a', level); assert.ok(maxStep(o) <= 1, 'step ' + level); assert.ok(o.rows.every(r => r.y === 0)); }
  assert.equal(maxStep({ rows: [{ y: 0 }, { y: 1 }, { y: 0 }] }), 1); assert.equal(OBBY.maxStepA, 1);
});
await check('obbyBandA: dot pictures and initial sounds; fewer/more has one answer; letters never ambiguous', async () => {
  const { makeObby } = await obbyMod(); let dots = 0, sounds = 0, fewer = 0;
  for (let level = 0; level < 4; level++) for (const r of makeObby('a', level).rows){
    if (r.options[0].dots){ dots++; const ns = r.options.map(o => o.dots); assert.equal(new Set(ns).size, ns.length); assert.ok(ns.every(n => n >= 1 && n <= 9)); assert.ok(r.options.every(o => o.label === '●'.repeat(o.dots)));
      const isFewer = /fewer/.test(r.prompt.en); if (isFewer) fewer++; const want = isFewer ? Math.min(...ns) : Math.max(...ns); assert.equal(r.options.find(o => o.ok).dots, want); assert.ok(!/\d/.test(r.prompt.en + r.prompt.th), 'no digits in the prompt'); }
    else { sounds++; const w = /^(\w+) starts/.exec(r.prompt.en)[1]; assert.equal(r.options.find(o => o.ok).label, w[0]); assert.ok(r.options.every(o => o.label.length === 1)); assert.ok(r.prompt.say.includes(w)); assert.ok(!(w[0] === 'c' && r.options.some(o => o.label === 'k'))); }
  }
  assert.ok(dots >= 5 && sounds >= 3 && fewer >= 1, `dots ${dots} sounds ${sounds} fewer ${fewer}`);
});
await check('obbyBandC: same-as / biggest / smallest compare real values from the fractions bank', async () => {
  const { makeObby } = await obbyMod(); const { BANKS } = await import('../engine/rooms/quest/banks.js');
  const val = s => { const t = BANKS.fractions.c.find(x => s === x.f || s === String(x.d) || s === x.p + '%'); assert.ok(t, 'unknown value ' + s); return t.p; };
  let same = 0, big = 0, small = 0;
  for (let level = 0; level < 4; level++) for (const r of makeObby('c', level).rows){
    const ps = r.options.map(o => val(o.label)); assert.equal(new Set(ps).size, ps.length, 'distinct values'); const ok = val(r.options.find(o => o.ok).label);
    let m;
    if ((m = /^Which is the same as (.+)\?$/.exec(r.prompt.en))){ same++; assert.equal(ok, val(m[1])); assert.notEqual(r.options.find(o => o.ok).label, m[1], 'a different form of the same value'); }
    else if (/biggest/.test(r.prompt.en)){ big++; assert.equal(ok, Math.max(...ps)); } else if (/smallest/.test(r.prompt.en)){ small++; assert.equal(ok, Math.min(...ps)); } else assert.fail(r.prompt.en);
  }
  assert.ok(same >= 3 && big >= 3 && small >= 1, `${same} ${big} ${small}`);
});

await check('obbyBandAIcons: every band a row has a sign picture; sound rows carry the English word, compare rows say more or fewer', async () => {
  const { makeObby } = await obbyMod(); const { BANKS } = await import('../engine/rooms/quest/banks.js'); let words = 0, cmp = 0;
  for (let level = 0; level < 4; level++) for (const r of makeObby('a', level).rows){
    assert.ok(r.icon && r.icon.kind, 'icon');
    if (r.icon.kind === 'word'){ words++; assert.ok(BANKS.words.a.includes(r.word)); assert.equal(r.icon.word, r.word); assert.ok(r.prompt.th.includes(r.word) && r.prompt.say.includes(r.word)); }
    else { cmp++; assert.equal(r.icon.more, !/fewer/.test(r.prompt.en)); assert.equal(r.word, undefined); }
  }
  assert.ok(words >= 3 && cmp >= 5);
  assert.ok(makeObby('b', 0).rows.every(r => !r.icon));
});

// ---- Task 7: stars are never docked for hints; the band switch keeps the controller ----
await check('starsNotDockedByHints: complete after 3 hints keeps all 3 stars', async () => {
  if (!globalThis.localStorage) { const m = new Map(); globalThis.localStorage = { getItem: k => m.has(k) ? m.get(k) : null, setItem: (k, v) => m.set(k, String(v)) }; }
  const { startQuest, setQuestBand } = await import('../engine/rooms/quest/use-shell.js');
  const events = [];
  const game = { telemetry: { track(e, d) { events.push([e, d]); }, room: 'home' } };
  const ctl = startQuest(game, { gameId: 'demo7', band: 'b', levels: (band, i) => ({ kind: i === 3 ? 'free' : 'goal', target: 2, extra: 'clean' }) });
  ctl.start(0);
  assert.equal(ctl.hint('child'), 'replay'); assert.equal(ctl.hint('child'), 'highlight2'); assert.equal(ctl.hint('child'), 'show');
  assert.equal(ctl.wrong({ block: 'x' }).hint, 'show');              // a wrong block on top of the hints: the ladder is already at the top
  ctl.right({ block: 'a' }); ctl.right({ block: 'a' });
  assert.ok(ctl.level.hints >= 2 && ctl.level.done);
  const r = ctl.complete({ extraMet: true, secretFound: true });
  assert.equal(r.stars, 3); assert.ok(r.hints >= 2 && r.tries >= 1);
  assert.equal(ctl.progress.best(0), 3);
  // band switch: the controller carries on at the new band and level 1 starts clean
  setQuestBand(ctl, 'c'); assert.equal(ctl.band, 2); assert.equal(ctl.camera.rotate, 'free'); assert.equal(ctl.camera.reset, true);
  ctl.start(0); assert.equal(ctl.level.hints, 0); assert.equal(ctl.level.tries, 0);
  setQuestBand(ctl, 'a'); assert.equal(ctl.camera.rotate, 'lock'); setQuestBand(ctl, 'b'); assert.equal(ctl.camera.rotate, 'step90');
  assert.ok(events.some(([e]) => e === 'hint_used'));
});

await check('speech.js: a Thai goal with an English word is split by voice', async () => {
  const { splitSpeech } = await import('../engine/rooms/quest/speech.js');
  const { makeDigSite } = await import('../engine/rooms/quest/dig-logic.js');
  for (let l = 0; l < 3; l++){ const t = makeDigSite('a', l).task; const parts = splitSpeech(t.goalText.th, 'th');
    assert.deepEqual(parts.map(p => p.lang), ['th-TH', 'en-US'], t.goalText.th); assert.equal(parts[1].text, t.word); assert.ok(!/[A-Za-z]/.test(parts[0].text)); }
  assert.deepEqual(splitSpeech('Dig up the letters to spell map', 'en'), [{ text: 'Dig up the letters to spell map', lang: 'en-US' }]);
  assert.deepEqual(splitSpeech('ด่านอิสระ ขุดแล้ววางของ 3 ชิ้นบนชั้น', 'th').map(p => p.lang), ['th-TH']);
  assert.deepEqual(splitSpeech('', 'th'), []);
  // the other rooms' Thai goals carry no English word, so one Thai voice is right for them
  const { makeBlueprint } = await import('../engine/rooms/quest/blueprint-logic.js');
  for (const b of ['a', 'b', 'c']) for (let l = 0; l < 3; l++) assert.equal(splitSpeech(makeBlueprint(b, l).goalText.th, 'th').length, 1);
});

await check('tuning params: free-level counts, digMaxPerEra and loop max come in as parameters (defaults unchanged)', async () => {
  const { makeCodeLevel, setLoopCount } = await codeMod(), { makeDigSite } = await digMod(), { makePuzzle, startState, pressPlate } = await escMod();
  assert.equal(makeCodeLevel('b', 3).need.count, 5); const c7 = makeCodeLevel('b', 3, { freeCount: 7 }); assert.equal(c7.need.count, 7); assert.match(c7.goalText.th, /7/); assert.match(c7.goalText.en, /7 blocks/);
  assert.equal(makeCodeLevel('b', 0, { freeCount: 7 }).need.count, undefined, 'goal levels ignore freeCount');
  assert.equal(setLoopCount({ program: [{ loop: 2, body: [] }], cursor: [] }, [0], 9, 4).program[0].loop, 4);
  const d = makeDigSite('b', 3, 5, { free: 2 }); assert.equal(d.freeN, 2); assert.match(d.task.goalText.en, /put 2 finds/); assert.equal(makeDigSite('b', 3).freeN, 3);
  for (const l of [0, 1, 2]){ const s = makeDigSite('b', l, 5, { maxPerEra: 1 }), per = {}; s.finds.forEach(f => per[f.era] = (per[f.era] || 0) + 1); assert.ok(Object.values(per).every(n => n <= 1)); assert.deepEqual(s.task.perEra, per); }
  const f = makePuzzle('a', 3, { free: 2 }); let st = startState(f), r; assert.equal(st.need, 2); assert.match(f.goalText.en, /2 different/);
  r = pressPlate(st, f.plates[0].id); r = pressPlate(r.state, f.plates[1].id); assert.equal(r.result, 'done');
  assert.equal(startState(makePuzzle('a', 3)).need, 3);
});
console.log(fails ? `\n${fails} FAILED` : '\nall passed');
process.exit(fails ? 1 : 0);
