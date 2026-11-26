// Smoke tests for the quest mini-game rooms (needs the local server: node serve.mjs on 8787).
// Run: node tests/quest-rooms.test.mjs [blueprint-shot.jpg] [dig-shot.jpg] [escape-shot.jpg] [code-shot.jpg] [obby-shot.jpg]  (escape, code and obby also write -a and -phone variants; obby also -short)
import puppeteer from '/Users/familyjourney/.claude/skills/style-atlas/scripts/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js';
const BASE = process.env.BASE || 'http://localhost:8787/', SHOT = process.argv[2], DIGSHOT = process.argv[3], ESCSHOT = process.argv[4], CODESHOT = process.argv[5], OBBYSHOT = process.argv[6];
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu'] });
const errs = []; const C = {};
const W = ms => new Promise(r => setTimeout(r, ms));
async function open(url, vp = { width: 1180, height: 620, deviceScaleFactor: 1.5 }){
  const p = await b.newPage(); await p.setViewport(vp);
  p.on('pageerror', e => errs.push(String(e))); p.on('response', r => { if (r.status() >= 400 && !/favicon|audio\/bgm/.test(r.url())) errs.push(r.status() + ' ' + r.url()); });
  await p.goto(url, { waitUntil: 'networkidle0', timeout: 90000 }); await W(3500); return p;
}
const run = async (p, code) => { await p.bringToFront(); return p.evaluate(new Function('return (async()=>{const g=window.__g, R=g.room, W=g.world, wait=ms=>new Promise(r=>setTimeout(r,ms)); const BL=Object.fromEntries((await import("./engine/world/voxel.js")).BLOCKS.map((b,i)=>[b.id,i])); ' +
  // place every target cell like a child would (world set + block_place event), skipping any in `skip`
  'const build=(skip=[])=>{ R.bp.cells.forEach(([x,y,z,id],i)=>{ if(skip.includes(i)) return; const X=R.ox+x,Y=R.oy+y,Z=R.oz+z; W.set(X,Y,Z,BL[id]); g.bus.emit("block_place",{x:X,y:Y,z:Z,b:BL[id]}); }); }; ' + code + '})()')); };

// ---- band b, level 1 ----
const p = await open(BASE + 'game.html?room=blueprint&debug&fresh&band=b');
C.roomLoads = await run(p, `return R.id==='blueprint' && !!R.quest && R.band==='b' && R.state.index===0 && R.bp.cells.length>0 && R.guides.length===R.bp.cells.length`);
if (SHOT){ await W(500); await p.screenshot({ path: SHOT, type: 'jpeg', quality: 88 }); }
C.cardsDrawn = await run(p, `return R.cards.children.length===2 && R.grp.children.length>R.bp.cells.length`);
// a wrong block (outside the plan, inside the box) climbs the hint ladder and does not finish
C.wrongBlockHints = await run(p, `const [w,h,d]=R.bp.size; let ex=null; for(let x=0;x<w&&!ex;x++) for(let z=0;z<d&&!ex;z++) if(!R.bp.cells.some(c=>c[0]===x&&c[1]===0&&c[2]===z)) ex=[x,0,z]; if(!ex) return true; const X=R.ox+ex[0],Z=R.oz+ex[2]; W.set(X,R.oy,Z,BL.brick); g.bus.emit('block_place',{x:X,y:R.oy,z:Z,b:BL.brick}); const bad=R.state.done===false && R.quest.level.tries===1 && R.state.pct<100; W.set(X,R.oy,Z,0); g.bus.emit('block_break',{x:X,y:R.oy,z:Z,b:0}); return bad`);
C.partialNotDone = await run(p, `build([0]); return R.state.done===false && R.state.cmp.missing===1`);
C.perfectBuildCompletes = await run(p, `const c=R.bp.cells[0], X=R.ox+c[0],Y=R.oy+c[1],Z=R.oz+c[2]; W.set(X,Y,Z,BL[c[3]]); g.bus.emit('block_place',{x:X,y:Y,z:Z,b:BL[c[3]]}); return R.state.done===true && R.state.stars>0 && R.state.result.stars>0 && R.state.pct===100`);
C.nextLevelLoads = await run(p, `await wait(4800); return R.state.index===1 && R.state.done===false && W.get(R.ox,R.oy,R.oz)===0`);
// ---- band a, a mirror level, and an extra block blocks the finish ----
const a = await open(BASE + 'game.html?room=blueprint&debug&fresh&band=a');
C.bandALoads = await run(a, `return R.band==='a' && R.bp.size[1]===1 && R.bp.mirror==='x'`);
C.extraBlockBlocksFinish = await run(a, `const [w,h,d]=R.bp.size; let ex=null; for(let x=0;x<w&&!ex;x++) for(let z=0;z<d&&!ex;z++) if(!R.bp.cells.some(c=>c[0]===x&&c[2]===z)) ex=[x,0,z]; W.set(R.ox+ex[0],R.oy,R.oz+ex[2],BL.brick); build(); const stuck=R.state.done===false && R.state.cmp.extra===1; W.set(R.ox+ex[0],R.oy,R.oz+ex[2],0); g.bus.emit('block_break',{x:R.ox+ex[0],y:R.oy,z:R.oz+ex[2],b:0}); return stuck && R.state.done===true`);
// ---- band c ----
const c = await open(BASE + 'game.html?room=blueprint&debug&fresh&band=c');
C.bandCCompletes = await run(c, `build(); return R.state.done===true && R.bp.volume===R.bp.cells.length`);
// ---- free level (band b level 4) finishes after a few blocks ----
C.freeLevel = await run(p, `R.startLevel(3); if(!R.free) return false; for(let i=0;i<6;i++){ W.set(R.ox+i%3,R.oy+Math.floor(i/3),R.oz,BL.planks); g.bus.emit('block_place',{x:R.ox+i%3,y:R.oy+Math.floor(i/3),z:R.oz,b:BL.planks}); } return R.state.done===true`);

// ---- dig room ----
// helpers inside the page: dig out a find (clear the blocks above it, break events like the player's), walk to it, place on a shelf slot (world set + block_place event)
const DIGH = `const dug=async d=>{ const [x,y,z]=d.c; for(let yy=y+1;yy<=R.Y0;yy++){ W.set(x,yy,z,0); g.bus.emit('block_break',{x,y:yy,z,b:0}); } const P=g.player.body; P.x=W.wx(x); P.z=W.wx(z); P.y=y+.01; P.vy=0; await wait(300); return !!R.carry; };
 const slotFor=d=>{ const t=R.free?R.targets[0]:R.targets.find(t=>t.key===d.key); return t.slots.find(s=>!s.filled); };
 const put=s=>{ const [x,y,z]=s.c; W.set(x,y,z,BL.planks); g.bus.emit('block_place',{x,y,z,b:BL.planks}); };
 const solveAll=async()=>{ for(const d of R.finds){ if(d.taken) continue; if(!(await dug(d))) return false; put(slotFor(R.carry)); } return true; };`;
const d = await open(BASE + 'game.html?room=dig&debug&fresh&band=b');
if (DIGSHOT){ const ds = await open(BASE + 'game.html?room=dig&debug&fresh&band=b'); await ds.evaluate(() => { const g = window.__g, W = g.world, R = g.room, P = g.player.body, f = R.finds.find(x => x.f.y >= 4) || R.finds[0], [fx, fy, fz] = f.c, zf = R.sz + R.site.size.z - 1;       // mid-dig: a tunnel along the front plane to one find, carrying it
    for (let x = R.sx + 5; x <= fx; x++) for (let z = fz; z <= zf; z++){ W.set(x, fy, z, 0); W.set(x, fy + 1, z, 0); } P.x = W.wx(fx - 1); P.z = W.wx(fz); P.y = fy + .01; }); await W(1800); await ds.screenshot({ path: DIGSHOT, type: 'jpeg', quality: 88 }); await ds.close(); }
C.digRoomLoads = await run(d, `return R.id==='dig' && !!R.quest && R.band==='b' && R.state.index===0 && R.site.layers.length===5 && R.finds.length===R.site.finds.length && R.targets.length>=3 && Math.abs(g.cam.yaw-Math.PI)<1e-6`);
C.digFindsHiddenUnderBlocks = await run(d, `return R.finds.every(f=>W.get(f.c[0],f.c[1]+1,f.c[2])!==0 && W.get(f.c[0],f.c[1],f.c[2])===0) && !R.carry`);
C.digStairsWalkable = await run(d, `let ok=true; for(let i=0;i<5;i++){ const x=R.sx+i, z=R.sz+2; ok=ok && W.get(x,R.Y0-i,z)===0 && W.get(x,R.Y0-i-1,z)!==0 && (i===0 || W.get(x-1,R.Y0-i+1,z)!==0 || true); } return ok && W.get(R.sx+5,R.Y0-1,R.sz+2)!==0`);
C.digNoPickupFromAbove = await run(d, `const f=R.finds[0], P=g.player.body; P.x=W.wx(f.c[0]); P.z=W.wx(f.c[2]); P.y=R.Y0+1.01; await wait(400); const ok=!R.carry && !f.taken; P.x=W.wx(0); P.z=W.wx(R.sz+2); P.y=R.Y0+1.01; return ok`);
C.digWrongShelfRefused = await run(d, `${DIGH} const f=R.finds[0]; if(!(await dug(f))) return false; const wrong=R.targets.find(t=>t.key!==f.key).slots[0]; const had=g.inv.slots.find(s=>s&&s.id==='planks').n; put(wrong); return R.carry===f && W.get(...wrong.c)===0 && R.quest.level.tries===1 && R.state.placed===0 && g.inv.slots.find(s=>s&&s.id==='planks').n===had+1`);
C.digSecretGoldCounts = await run(d, `const s=R.secretCell; if(W.get(...s)!==BL.gold) return false; W.set(...s,0); g.bus.emit('block_break',{x:s[0],y:s[1],z:s[2],b:0}); return R.secret===true`);
C.digSolveAllCompletes = await run(d, `${DIGH} if(R.carry){ put(slotFor(R.carry)); } for(const d2 of R.finds){ if(d2.taken) continue; if(!(await dug(d2))) return false; put(slotFor(d2)); } return R.state.done===true && R.state.placed===R.finds.length && R.state.stars===2 && R.state.result.tries===1`);   // 1 wrong try: goal + secret, no clean star
C.digNextLevelLoads = await run(d, `await wait(4800); return R.state.index===1 && !R.state.done && R.finds.every(f=>!f.taken) && R.state.placed===0`);
// band a: letters, front plane, stay in the slab, free level
const da = await open(BASE + 'game.html?room=dig&debug&fresh&band=a');
if (DIGSHOT){ const dsa = await open(BASE + 'game.html?room=dig&debug&fresh&band=a'); await dsa.evaluate(() => { const g = window.__g, W = g.world, R = g.room, P = g.player.body, f = R.finds.find(x => x.f.y >= 2) || R.finds[0], [fx, fy, fz] = f.c, zf = R.sz + R.site.size.z - 1;       // mid-dig: a tunnel along the front plane to one find, carrying it
    for (let x = R.sx + 5; x <= fx; x++) for (let z = fz; z <= zf; z++){ W.set(x, fy, z, 0); W.set(x, fy + 1, z, 0); } P.x = W.wx(fx - 1); P.z = W.wx(fz); P.y = fy + .01; }); await W(1800); await dsa.screenshot({ path: DIGSHOT.replace(/\.jpg$/, '-a.jpg'), type: 'jpeg', quality: 88 }); await dsa.close(); }
C.digBandALoads = await run(da, `return R.band==='a' && R.task.type==='letters' && R.finds.every(f=>f.f.y<=2) && R.targets.length===3 && R.targets.every(t=>t.slots[0].ghost) && Math.abs(g.cam.yaw-Math.PI)<1e-6`);
C.digBandAStaysInSlab = await run(da, `const P=g.player.body; P.z=W.wx(0); await wait(200); const a=P.z>=W.wx(R.sz)-1e-6; P.z=W.wx(19); await wait(200); return a && P.z<=W.wx(R.sz+2)+1e-6`);
C.digBandASpellsWord = await run(da, `${DIGH} const ok=await solveAll(); return ok && R.state.done===true && R.state.stars>=1 && R.targets.every(t=>t.slots[0].filled && t.slots[0].filled.f.label===t.key)`);
C.digFreeLevel = await run(da, `${DIGH} R.startLevel(3); if(!R.free) return false; for(let i=0;i<3;i++){ const d2=R.finds.find(x=>!x.taken); if(!(await dug(d2))) return false; put(R.targets[0].slots[i]); } return R.state.done===true && R.state.placed===3`);
// band c: timeline order (oldest first)
const dc = await open(BASE + 'game.html?room=dig&debug&fresh&band=c');
C.digBandCOrder = await run(dc, `${DIGH} const newest=[...R.finds].sort((p,q)=>p.f.y-q.f.y)[0]; if(!(await dug(newest))) return false; put(R.targets[0].slots[0]); const refused=R.carry===newest && R.quest.level.tries===1; if(!refused) return false; put(slotFor(newest)); for(const d2 of R.finds){ if(d2.taken) continue; if(!(await dug(d2))) return false; put(slotFor(d2)); } return R.state.done===true && R.state.placed===4`);

// band a: every find, at every level, is reached by WALKING (joystick) down the stairs and along a dug tunnel; no teleport, no jump
const dw = await open(BASE + 'game.html?room=dig&debug&fresh&band=a');
C.digBandAWalkReach = await run(dw, `const got=[]; for(const l of [0,1,2,3]){ R.startLevel(l); const n=R.finds.length; for(let i=0;i<n;i++){ R.startLevel(l); const f=R.finds[i], [fx,,fz]=f.c; R.finds.forEach(d=>{ if(d!==f) d.taken=true; });   // only this find can be collected
  for(let x=R.sx+5;x<fx;x++){ W.set(x,R.Y0-2,fz,0); W.set(x,R.Y0-1,fz,0); }       // the tunnel the child digs along the landing (depth 2), two blocks high
  g.input.stick={x:1,y:0}; let t=0; while(!R.carry && t<12000){ await wait(100); t+=100; } g.input.stick={x:0,y:0}; got.push(R.carry===f); } } return got.length>=12 && got.every(Boolean)`);
await dw.close();
// hint ladder: three wrong shelves climb replay -> highlight -> show, and the right shelf cells pulse
C.digHintLadder = await run(dc, `${DIGH} R.startLevel(1); const f=R.finds[0]; if(!(await dug(f))) return false; const sel=g.inv.sel; const wrong=R.targets.find(t=>t.key!==f.key).slots[0]; const steps=[]; for(let i=0;i<3;i++){ put(wrong); steps.push(R.pulse.length); } return sel===g.inv.slots.findIndex(s=>s&&s.id==='planks') && steps[0]===0 && steps[1]>0 && steps[2]>=steps[1] && R.quest.level.tries===3 && R.carry===f`);

// ---- escape room ----
// helpers inside the page: stand a plate's centre, step off, solve the sequence (the smoke test sets the body position, as the brief allows)
const ESCH = `const P=g.player.body, plate=id=>R.plates.find(p=>p.p.id===id); const stand=async pl=>{P.x=pl.x;P.z=pl.z;P.y=2.05;P.vy=0;await wait(170);}; const off=async()=>{P.x=W.wx(9);P.z=W.wx(10.6);P.y=2.05;await wait(130);};
 const solve=async()=>{ for(const id of R.pz.answer) await stand(plate(id)); }; const out=async()=>{ P.x=W.wx(9);P.z=W.wx(3.5);P.y=2.05;await wait(250); };`;
const eb = await open(BASE + 'game.html?room=escape&debug&fresh&band=b');
C.escapeRoomLoads = await run(eb, `return R.id==='escape' && !!R.quest && R.band==='b' && R.state.index===0 && R.plates.length===R.pz.plates.length && R.doorCells.length===6 && R.doorCells.every(c=>c[2]===5) && R.doorCells.every(c=>W.get(...c)!==0) && !R.state.open && !!document.getElementById('esGoggles')`);
C.escapeGogglesShowClue = await run(eb, `const btn=document.getElementById('esGoggles'), card=document.getElementById('esClue'); const hidden0=getComputedStyle(card).display==='none';
  btn.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerId:7})); await wait(80); const shown=getComputedStyle(card).display!=='none' && card.textContent.length+card.querySelectorAll('svg,img').length>0;
  btn.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,pointerId:7})); await wait(80); return hidden0 && shown && getComputedStyle(card).display==='none'`);
C.escapeGogglesNoOverlap = await run(eb, `const r=document.getElementById('esGoggles').getBoundingClientRect(), j=document.getElementById('joy').getBoundingClientRect(); const hit=(a,b)=>!(a.right<=b.left||a.left>=b.right||a.bottom<=b.top||a.top>=b.bottom); const others=['bar','hint','who','gear','hearts','act','stam','bView','togChip'].map(i=>document.getElementById(i)).filter(Boolean).filter(e=>e.offsetParent!==null||getComputedStyle(e).position==='fixed').map(e=>e.getBoundingClientRect()).filter(q=>q.width>0); return r.width>=56 && r.height>=56 && !hit(r,j) && !others.some(q=>hit(r,q))`);
C.escapePeekCapped = await run(eb, `const btn=document.getElementById('esGoggles'), card=document.getElementById('esClue'); btn.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerId:8})); await wait(300); const on=getComputedStyle(card).display!=='none'; await wait(3300); const capped=getComputedStyle(card).display==='none'; btn.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,pointerId:8})); return on && capped`);
if (ESCSHOT){ const el = await open(BASE + 'game.html?room=escape&debug&fresh&band=b'); await W(6500); await el.screenshot({ path: ESCSHOT.replace(/\.jpg$/, '-land.jpg'), type: 'jpeg', quality: 88 }); await el.close();
  const es = await open(BASE + 'game.html?room=escape&debug&fresh&band=b'); await W(1500);
  await es.evaluate(() => document.getElementById('esGoggles').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 3 }))); await W(600); await es.screenshot({ path: ESCSHOT, type: 'jpeg', quality: 88 }); await es.close(); }
C.escapeWrongPlateResets = await run(eb, `${ESCH} await stand(plate(R.pz.answer[0])); const one=R.state.pos===1 && R.plates.filter(p=>p.lit).length===1; const bad=R.pz.plates.find(p=>!R.pz.answer.includes(p.id)); await stand(plate(bad.id)); return one && R.state.pos===0 && R.quest.level.tries===1 && R.plates.every(p=>!p.lit) && !R.state.done`);
C.escapeRepeatedPlateWrong = await run(eb, `${ESCH} const t0=R.quest.level.tries; await off(); await stand(plate(R.pz.answer[0])); const first=R.state.pos===1; await off(); await stand(plate(R.pz.answer[0])); await off(); return first && R.state.pos===0 && R.quest.level.tries===t0+1`);
C.escapeSolvedOpensDoor = await run(eb, `${ESCH} await off(); await solve(); return R.state.open===true && R.doorCells.every(c=>W.get(...c)===0) && R.state.pos===R.pz.answer.length && !R.state.done`);
C.escapeWalkThroughCompletes = await run(eb, `${ESCH} await out(); return R.state.done===true && R.state.stars>=1 && R.state.result.stars>=1`);
C.escapeNextLevelLoads = await run(eb, `await wait(4600); return R.state.index===1 && R.state.done===false && !R.state.open && R.doorCells.every(c=>W.get(...c)!==0) && R.pz.clue.kind==='roman' && R.plates.every(p=>!p.lit) && !!document.getElementById('esGoggles')`);
C.escapeRomanLevelSolves = await run(eb, `${ESCH} await off(); await solve(); await out(); return R.state.done===true`);
C.escapeFreeLevel = await run(eb, `${ESCH} R.startLevel(3); if(!R.free || document.getElementById('esGoggles')) return false; await off(); for(let i=0;i<3;i++){ await stand(R.plates[i]); } const open=R.state.open && R.quest.level.tries===0; await out(); return open && R.state.done===true`);
C.escapeGogglesRemovedAtEnd = await run(eb, `R.startLevel(2); R.quest.level; const before=!!document.getElementById('esGoggles'); R.pst.pos=0; ${ESCH} await off(); await solve(); await out(); await wait(4600); R.startLevel(3); await off(); for(let i=0;i<3;i++){ await stand(R.plates[i]); } await out(); await wait(300); return before && R.state.done===true && !document.getElementById('esGoggles') && !document.getElementById('esClue')`);
// band a: shapes on plates and no reading needed; band c: missing-number equations
const ea = await open(BASE + 'game.html?room=escape&debug&fresh&band=a');
C.escapeBandA = await run(ea, `return R.band==='a' && R.pz.clue.kind==='sequence' && R.pz.answer.length===3 && R.pz.plates.every(p=>p.shape && p.color) && R.plates.length===R.pz.plates.length`);
C.escapeBandAClueIsPictures = await run(ea, `const btn=document.getElementById('esGoggles'); btn.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerId:5})); await wait(100); const n=document.querySelectorAll('#esClue img').length; const txt=document.getElementById('esClue').textContent.replace(/[\\u2192\\s]/g,''); btn.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,pointerId:5})); return n===3 && txt===''`);
if (ESCSHOT){ const eas = await open(BASE + 'game.html?room=escape&debug&fresh&band=a'); await W(1500); await eas.screenshot({ path: ESCSHOT.replace(/\.jpg$/, '-a.jpg'), type: 'jpeg', quality: 88 }); await eas.close(); }
C.escapeBandASolves = await run(ea, `${ESCH} await off(); await solve(); await out(); return R.state.done===true`);
const ec = await open(BASE + 'game.html?room=escape&debug&fresh&band=c');
C.escapeBandC = await run(ec, `return R.band==='c' && R.pz.clue.kind==='equation' && R.pz.clue.data.eqs.length>=2`);
C.escapeBandCSolves = await run(ec, `${ESCH} await off(); await solve(); await out(); return R.state.done===true`);
if (ESCSHOT){ const ecs = await open(BASE + 'game.html?room=escape&debug&fresh&band=c', { width: 812, height: 375, deviceScaleFactor: 2, isMobile: true, hasTouch: true }); await W(6500);        // goggles NOT held: all plates and the door in view
  await ecs.screenshot({ path: ESCSHOT.replace(/\.jpg$/, '-phone.jpg'), type: 'jpeg', quality: 88 }); await ecs.close(); }

// the shell is told "right" once, when the sequence is complete: a reset must not leave progress behind (3-answer band a puzzle)
const ec3 = await open(BASE + 'game.html?room=escape&debug&fresh&band=a');
C.escapeResetKeepsLadder = await run(ec3, `${ESCH} const A=R.pz.answer, bad=R.pz.plates.find(p=>!A.includes(p.id)); await off(); await stand(plate(A[0])); await stand(plate(bad.id)); await stand(plate(A[0])); await stand(plate(A[1]));
  const L=R.quest.level, early=L.done, v=L.value, st=L.step, t=L.tries; await stand(plate(bad.id)); const ok1=!early && v===0 && R.state.pos===0 && L.tries===t+1 && L.step===st+1 && !L.done;
  for(const id of A) await stand(plate(id)); return ok1 && R.state.open===true && L.done===true && L.value===1`);
// framing: every plate centre, the door and the player are on screen and clear of the HUD buttons, at phone and landscape size, level 1 of each band
const FRAME = `const P=g.player.body, cam=g.camera, V=cam.position.constructor; const ndc=(x,y,z)=>{ const v=new V(x,y,z).project(cam); return [(v.x+1)/2*innerWidth,(1-v.y)/2*innerHeight]; };
  const hud=[...document.querySelectorAll('#who,#stars,#gear,#bView,#bar,#joy,#act .btn,#esGoggles,#hearts,#stam,#togChip,#hint')].map(e=>e.getBoundingClientRect()).filter(q=>q.width>0&&q.height>0);
  const clear=([x,y])=>x>8&&x<innerWidth-8&&y>8&&y<innerHeight-8 && !hud.some(q=>x>q.left-4&&x<q.right+4&&y>q.top-4&&y<q.bottom+4);
  const pts=R.plates.map(p=>ndc(p.x,2.1,p.z)); pts.push(ndc(W.wx(9),3.0,W.wx(5)+.5), ndc(W.wx(9)-.65,3.65,W.wx(5)+.5), ndc(W.wx(9)+.65,3.65,W.wx(5)+.5), ndc(W.wx(9)-1.4,3.0,W.wx(5)+.5), ndc(W.wx(9)+1.4,3.0,W.wx(5)+.5), ndc(P.x,P.y+.6,P.z)); const bad=pts.filter(q=>!clear(q)); window.__bad=JSON.stringify(bad); return bad.length===0;`;
for (const [name, vp] of [['Landscape', undefined], ['Phone', { width: 812, height: 375, deviceScaleFactor: 2, isMobile: true, hasTouch: true }]])
  for (const band of ['a', 'b', 'c']){
    const fp = await open(BASE + `game.html?room=escape&debug&fresh&band=${band}`, vp); await W(1200);
    C['escapeFramed' + name + band.toUpperCase()] = await run(fp, `${FRAME}`); if (!C['escapeFramed' + name + band.toUpperCase()]) console.log('frame', name, band, await fp.evaluate(() => window.__bad)); await fp.close();
  }
// walking (joystick) from one answer plate to the next, around the plates in between, never presses a wrong one (band b level 1)
const ew = await open(BASE + 'game.html?room=escape&debug&fresh&band=b');
C.escapeWalkBetweenPlates = await run(ew, `const P=g.player.body, plate=id=>R.plates.find(p=>p.p.id===id);
  const go=async(x,z)=>{ let t=0; while(t<9000){ const dx=x-P.x, dz=z-P.z, d=Math.hypot(dx,dz); if(d<.12) break; g.input.stick={x:dx/d,y:dz/d}; await wait(40); t+=40; } g.input.stick={x:0,y:0}; await wait(120); };
  const lane=W.wx(8.3); for(const id of R.pz.answer){ const pl=plate(id); if(P.z>W.wx(10.2)){ await go(pl.x+1.3, P.z); await go(pl.x+1.3, lane); } else await go(P.x, lane); await go(pl.x, lane); await go(pl.x, pl.z); }
  return R.quest.level.tries===0 && R.state.open===true && R.state.pos===R.pz.answer.length`);
// hint ladder: three wrong plates climb replay -> highlight two -> show the next plate
const eh = await open(BASE + 'game.html?room=escape&debug&fresh&band=b');
C.escapeHintLadder = await run(eh, `${ESCH} const bad=R.pz.plates.find(p=>!R.pz.answer.includes(p.id)); const steps=[]; for(let i=0;i<3;i++){ await off(); await stand(plate(bad.id)); steps.push(R.pulse.length); } return steps[0]===0 && steps[1]===2 && steps[2]===1 && R.quest.level.tries===3`);

// ---- code room ----
// helpers inside the page: feed a program through the panel like a child would (DOM clicks on the tiles), run it, wait for the run to end.
// codeStepMs is turned down for the test (the room reads TUNING at run time).
const CDH = `const T=(await import('./engine/data/tuning.js')).TUNING; T.quest.codeStepMs=70; const click=sel=>{ const e=document.querySelector(sel); if(!e) throw new Error('no '+sel); e.click(); };
 const cmd=c=>click('#cdPal [data-cmd="'+c+'"]'); const cnt=at=>"[data-count='"+JSON.stringify(at)+"']";
 const enter=async(list,cont)=>{ for(let i=0;i<list.length;i++){ const c=list[i], at=[...cont,i]; if(typeof c==='string') cmd(c);
   else if(c.loop!==undefined){ cmd('LOOP'); let n=0; while(document.querySelector(cnt(at)).textContent!=='\\u00d7'+c.loop && n++<12) click(cnt(at)); await enter(c.body,[...at,'body']); click("[data-ghost='"+JSON.stringify(cont)+"']"); }
   else { cmd('IF'); await enter(c.then||[],[...at,'then']); click("[data-section='"+JSON.stringify([...at,'else'])+"']"); await enter(c.else||[],[...at,'else']); click("[data-ghost='"+JSON.stringify(cont)+"']"); } } };
 const runIt=async()=>{ document.getElementById('cdRun').click(); const t0=Date.now(); while((R.state.running||R.run) && Date.now()-t0<25000) await wait(60); await wait(120); };
 const solve=async()=>{ R.panel.clear(); await enter(R.lv.solution,[]); await runIt(); };
 const tiles=()=>[...document.querySelectorAll('#cdStrip .cdT:not(.ghost)')];`;
// the older sections left many pages open and rendering: blank them, then drive every code room test through ONE page that is reloaded per band (the game loop runs slowly with many pages)
for (const pg of await b.pages()) await pg.goto('about:blank').catch(() => {});
const go = async (p, url, vp = { width: 1180, height: 620, deviceScaleFactor: 1.5 }) => { await p.setViewport(vp); await p.goto(url, { waitUntil: 'networkidle0', timeout: 90000 }); await W(3500); return p; };
const cb = await open(BASE + 'game.html?room=code&debug&fresh&band=b'), cp = cb;
C.codeRoomLoads = await run(cb, `return R.id==='code' && !!R.quest && R.band==='b' && R.state.index===0 && R.lv.band==='b' && !!R.panel && (()=>{ let n=0; R.robot.root.traverse(o=>{ if(o.isMesh) n++; }); return n>=12; })() && R.robot.root.getObjectByProperty('isSkinnedMesh',true)===undefined && !!document.getElementById('cdPal') && !!document.getElementById('cdProg') && R.flag.visible && Math.abs(g.cam.yaw-Math.PI)<1e-6`);
C.codePaletteByBand = await run(cb, `const ids=[...document.querySelectorAll('#cdPal [data-cmd]')].map(e=>e.dataset.cmd); return ids.join()==='F,L,R,PLACE,DIG,LOOP'`);
C.codePaletteAndProgramDistinct = await run(cb, `const pal=document.getElementById('cdPal'), prog=document.getElementById('cdProg'); const bg=e=>getComputedStyle(e).backgroundColor; const lum=c=>{ const m=c.match(/\\d+/g).map(Number); return (m[0]*299+m[1]*587+m[2]*114)/1000; };
  return !!pal.querySelector('.cdBadge svg') && !!prog.querySelector('.cdBadge svg') && pal.querySelector('.cdBadge').innerHTML!==prog.querySelector('.cdBadge').innerHTML && bg(pal)!==bg(prog) && lum(bg(prog))<lum(bg(pal))-80`);
C.codeTilesBigAndReadable = await run(cb, `const all=[...document.querySelectorAll('#cdPal .cdT, #cdRun, #cdReset, #cdStrip .cdT')]; const ok=all.every(e=>{ const r=e.getBoundingClientRect(); return r.width>=56 && r.height>=56; }); const ic=[...document.querySelectorAll('#cdPal .ic')].every(e=>e.getBoundingClientRect().width>=20); const fs=parseFloat(getComputedStyle(document.getElementById('cdCount')).fontSize)>=20; return ok && ic && fs`);
C.codeTapAddsAndRemoves = await run(cb, `${CDH} R.panel.clear(); cmd('F'); cmd('R'); cmd('F'); const a=JSON.stringify(R.panel.getProgram()); tiles()[0].click(); const b=JSON.stringify(R.panel.getProgram()); return a==='["F","R","F"]' && b==='["R","F"]' && document.getElementById('cdCount').textContent==='2/'+R.lv.maxCmds`);
C.codeLoopCountCycles = await run(cb, `${CDH} R.panel.clear(); cmd('LOOP'); const at=[0], seen=[]; for(let i=0;i<9;i++){ seen.push(document.querySelector(cnt(at)).textContent); click(cnt(at)); } return seen.join()==='×2,×3,×4,×5,×6,×7,×8,×9,×2' && R.panel.getProgram()[0].loop===3`);
C.codeProgramCapped = await run(cb, `${CDH} R.panel.clear(); for(let i=0;i<R.lv.maxCmds+3;i++) cmd('F'); return R.panel.getProgram().length===R.lv.maxCmds && document.getElementById('cdCount').textContent===R.lv.maxCmds+'/'+R.lv.maxCmds && document.getElementById('cdRun').classList.contains('full')`);
C.codeEmptyRunDoesNothing = await run(cb, `${CDH} R.panel.clear(); document.getElementById('cdRun').click(); await wait(200); return !R.run && R.quest.level.tries===0 && !R.state.running`);
// the bumping program: three F then a fourth that walks off the north edge. The ladder climbs replay -> highlight -> show and never finishes the level.
C.codeBumpHintLadder = await run(cb, `${CDH} const L=R.quest.level, steps=[], pre=Object.keys(R.state).length; for(let k=0;k<3;k++){ R.panel.clear(); for(const c of ['F','F','F','F']) cmd(c); await runIt(); steps.push([R.lastHint, document.querySelectorAll('#cdStrip .cdT.bad').length, document.querySelectorAll('#cdStrip .cdT.hintg, #cdPal .cdT.hintp').length, R.pulses.length]); }
  return steps[0][0]==='replay' && steps[1][0]==='highlight2' && steps[1][1]===1 && steps[2][0]==='show' && steps[2][2]>=2 && steps.every(x=>x[3]>=1) && L.tries===3 && L.value===0 && !L.done && R.state.done===false && R.state.stars===0`);
C.codeHintCmdAppends = await run(cb, `${CDH} const g2=document.querySelector('#cdStrip .ghost.hintg'); if(!g2) return false; const n=R.panel.getProgram().length, c=g2.dataset.cmd; g2.click(); const p=R.panel.getProgram(); return p.length===n+1 && p[p.length-1]===c`);
C.codeResetRestores = await run(cb, `${CDH} R.panel.clear(); cmd('PLACE'); await runIt(); const X=5+R.lv.start.x, Z=6+R.lv.start.z-1; const built=W.get(X,3,Z)===BL.brick; document.getElementById('cdReset').click(); await wait(100); const gone=W.get(X,3,Z)===0; return built && gone && R.panel.getProgram().length===0 && R.rs.x===R.lv.start.x && R.rs.z===R.lv.start.z && !R.state.done`);
C.codeBandBAllLevels = await run(cb, `${CDH} const out=[]; for(const l of [0,1,2,3]){ R.startLevel(l); await wait(250); await solve(); out.push(R.state.done && R.state.stars>=2); } return out.every(Boolean)`);
C.codeHostNamedInTextOnly = await run(cp, `return R.words.en.cd_intro.includes('Bolt the pangolin inventor') && R.words.th.cd_intro.includes('โบลต์ (ตัวนิ่มนักประดิษฐ์)') && !R.robot.root.getObjectByProperty('isSkinnedMesh',true)`);
// the robot really places and digs: a river cell fills with a brick, a wall cell becomes air
const ca = await go(cp, BASE + 'game.html?room=code&debug&fresh&band=a');
C.codeBandAPalette = await run(ca, `const ids=[...document.querySelectorAll('#cdPal [data-cmd]')].map(e=>e.dataset.cmd); const txt=[...document.querySelectorAll('#cdPal button')].map(e=>e.textContent).join('').trim(); return ids.join()==='F,L,R,PLACE,DIG' && txt==='' && !document.querySelector('#cdPal [data-cmd="LOOP"]')`);
C.codeBandAPipsNotNumbers = await run(ca, `${CDH} R.panel.clear(); const n0=document.querySelectorAll('#cdPips i').length, f0=document.querySelectorAll('#cdPips i.f').length; cmd('F'); cmd('R'); const f2=document.querySelectorAll('#cdPips i.f').length; return n0===R.lv.maxCmds && f0===0 && f2===2 && !document.getElementById('cdCount') && document.getElementById('cdRun').textContent.trim()===''`);
C.codeSolutionCompletes = await run(ca, `${CDH} const L=R.quest.level; await solve(); return R.state.done===true && R.state.stars>=2 && L.done===true && L.value===1 && L.tries===0 && R.state.result.stars>=2`);
C.codePlacesRealBlock = await run(ca, `${CDH} await wait(4600); R.startLevel(1); await wait(200); const [gx,gz]=[2,1], X=5+gx, Z=6+gz, before=W.get(X,2,Z); const hadWater=R.water.size>0; await solve(); return before===0 && hadWater && W.get(X,2,Z)===BL.brick && !R.water.has(gx+','+gz) && R.water.size===3 && R.state.done===true`);
C.codeDigsRealWall = await run(ca, `${CDH} R.startLevel(2); await wait(200); const X=5, Z=6+1, before=W.get(X,3,Z); await solve(); return before===BL.stone && W.get(X,3,Z)===0 && R.state.done===true && R.state.stars>=2`);
C.codeBumpIntoWallNoFinish = await run(ca, `${CDH} R.startLevel(2); await wait(200); const L=R.quest.level; R.panel.clear(); cmd('F'); cmd('F'); cmd('F'); await runIt(); return R.state.done===false && L.tries===1 && L.value===0 && R.lastHint==='replay' && W.get(5,3,7)===BL.stone && R.pulses.length>=1`);
C.codeSecretBoltThirdStar = await run(ca, `${CDH} R.startLevel(0); await wait(200); const sec=R.lv.secret; R.panel.clear(); for(const c of ['R','F','L','F','F','R','F','F']) cmd(c); const vis0=R.bolt.visible; await runIt(); return JSON.stringify(sec)==='[1,3]' && vis0 && R.secret===true && R.state.done===true && R.state.stars===3`);
C.codeFreeLevel = await run(ca, `${CDH} R.startLevel(3); await wait(200); if(!R.free || R.lv.goal) return false; R.panel.clear(); for(const c of ['PLACE','R','F','PLACE','L','PLACE']) cmd(c); await runIt(); const short=R.state.done===false && R.quest.level.tries===1; R.panel.clear(); await enter(R.lv.solution,[]); await runIt(); return short && R.state.done===true`);
C.codeBandAAllLevels = await run(ca, `${CDH} const out=[]; for(const l of [0,1,2,3]){ R.startLevel(l); await wait(250); await solve(); out.push(R.state.done); } return out.every(Boolean)`);
C.codeBandBlocksLoopBandA = await run(ca, `return !document.querySelector('#cdPal [data-cmd="LOOP"]') && !document.querySelector('#cdPal [data-cmd="IF"]')`);
// band c: if blocked; every level of every band solves through the panel
const cc = await go(cp, BASE + 'game.html?room=code&debug&fresh&band=c');
C.codeBandCPalette = await run(cc, `const ids=[...document.querySelectorAll('#cdPal [data-cmd]')].map(e=>e.dataset.cmd); return ids.join()==='F,L,R,PLACE,DIG,LOOP,IF'`);
C.codeBandCIfBlocked = await run(cc, `${CDH} const out=[]; for(const l of [0,1,2,3]){ R.startLevel(l); await wait(250); await solve(); out.push(R.state.done); } return out.every(Boolean)`);
C.codeNextLevelLoads = await run(cc, `${CDH} R.startLevel(0); await wait(200); await solve(); await wait(4700); return R.state.index===1 && !R.state.done && R.panel.getProgram().length===0 && R.lv.index===1`);
if (CODESHOT){
  await go(cp, BASE + 'game.html?room=code&debug&fresh&band=b'); await run(cp, `${CDH} R.panel.clear(); await enter(R.lv.solution,[]); T.quest.codeStepMs=800; document.getElementById('cdRun').click(); await wait(3700); return true`);
  await cp.screenshot({ path: CODESHOT, type: 'jpeg', quality: 88 });
  await go(cp, BASE + 'game.html?room=code&debug&fresh&band=a'); await W(1200); await cp.screenshot({ path: CODESHOT.replace(/\.jpg$/, '-a.jpg'), type: 'jpeg', quality: 88 });
  await go(cp, BASE + 'game.html?room=code&debug&fresh&band=c', { width: 812, height: 375, deviceScaleFactor: 2, isMobile: true, hasTouch: true }); await W(1200); await cp.screenshot({ path: CODESHOT.replace(/\.jpg$/, '-phone.jpg'), type: 'jpeg', quality: 88 });
}
// framing: the board corners, the robot and the flag are on screen and clear of every HUD button and of the command panels, at phone and landscape size, level 1 of each band
const CFRAME = `const cam=g.camera, V=cam.position.constructor; const ndc=(x,y,z)=>{ const v=new V(x,y,z).project(cam); return [(v.x+1)/2*innerWidth,(1-v.y)/2*innerHeight]; };
  const hud=[...document.querySelectorAll('#who,#stars,#gear,#bView,#bar,#joy,#act .btn,#hearts,#stam,#togChip,#hint,#cdPal,#cdProg,#cdRun,#cdReset')].map(e=>e.getBoundingClientRect()).filter(q=>q.width>0&&q.height>0);
  const clear=([x,y])=>x>8&&x<innerWidth-8&&y>8&&y<innerHeight-8 && !hud.some(q=>x>q.left-4&&x<q.right+4&&y>q.top-4&&y<q.bottom+4);
  const c0=R.wp(0,0), pts=[]; for(const [dx,dz] of [[-.5,-.5],[4.5,-.5],[-.5,3.5],[4.5,3.5]]) pts.push(ndc(c0.x+dx,c0.y,c0.z+dz)); const rp=R.robot.root.position, f=R.flag.position;
  pts.push(ndc(rp.x,rp.y+.9,rp.z), ndc(rp.x,rp.y,rp.z), ndc(f.x,f.y+1.15,f.z), ndc(f.x,f.y,f.z));
  const mine=['cdPal','cdProg','cdRun','cdReset'].map(i=>document.getElementById(i).getBoundingClientRect()), hit=(a,b)=>!(a.right<=b.left||a.left>=b.right||a.bottom<=b.top||a.top>=b.bottom);
  const others=[...document.querySelectorAll('#who,#stars,#gear,#bView,#bar,#joy,#act .btn,#hearts,#stam,#togChip,#hint')].map(e=>e.getBoundingClientRect()).filter(q=>q.width>0&&q.height>0);
  const panelsClear=!mine.some(m=>others.some(o=>hit(m,o))); const bad=pts.filter(q=>!clear(q)); const boardW=Math.abs(pts[3][0]-pts[2][0]); window.__bad=JSON.stringify({bad,panelsClear,boardW,fitted:R.fitted,level:R.layoutLevel}); return bad.length===0 && panelsClear && R.fitted===true && boardW>=120;`;      // 120: the smallest the board gets (640x360 with the panels at their tightest), still a readable 24px per cell
const PH = (w, h) => ({ width: w, height: h, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
for (const [name, vp] of [['Landscape', undefined], ['Phone360', PH(640, 360)], ['Phone390', PH(844, 390)], ['ShortLandscape', { width: 812, height: 375, deviceScaleFactor: 2, isMobile: true, hasTouch: true }]])
  for (const band of ['a', 'b', 'c']){
    await go(cp, BASE + `game.html?room=code&debug&fresh&band=${band}`, vp); await W(1500);
    C['codeFramed' + name + band.toUpperCase()] = await run(cp, `${CFRAME}`); if (!C['codeFramed' + name + band.toUpperCase()]) console.log('code frame', name, band, await cp.evaluate(() => window.__bad));
    if (name === 'ShortLandscape' && band === 'a') C.codeShortLandscapeTiles = await run(cp, `const w=document.querySelector('#cdPal .cdT').getBoundingClientRect().width; return w>=48 && R.fitted===true`);       // the largest tile that fits, not the smallest
    if (name.startsWith('Phone') && band === 'c') C['codeGhostGlowVisible' + name] = await run(cp, `const gh=document.querySelector('#cdStrip .ghost.cur'), sp=document.getElementById('cdStrip').getBoundingClientRect(); return gh.getBoundingClientRect().left-sp.left>=7 && gh.getBoundingClientRect().top-sp.top>=4`);
  }
// a long program in the phone panel must not move the panels (the board stays framed): fill a band a program to the cap and check the panels have not grown over the board
C.codePhonePanelStable = await run(cp, `const top0=document.getElementById('cdWrap').getBoundingClientRect().top; for(let i=0;i<R.lv.maxCmds;i++) document.querySelector('#cdPal [data-cmd="F"]').click(); await wait(100); const top1=document.getElementById('cdWrap').getBoundingClientRect().top; return Math.abs(top0-top1)<1`);

// ---- obby room ----
// helpers inside the page: stand a pad's centre / the landing / the shore (the smoke test sets the body position, as the brief allows; one test WALKS)
const OBH = `const P=g.player.body, T=(await import('./engine/data/tuning.js')).TUNING; const place=async(x,z)=>{P.x=x;P.z=z;P.y=1.05;P.vy=0;await wait(230);};
 const rowPad=(k,ok)=>R.pads.find(p=>p.k===k&&p.ok===ok&&p.state==='idle'), stand=async p=>place(p.grp.position.x,p.grp.position.z), toDock=async()=>place(R.dock.x,R.dock.z);
 const solveRow=async()=>{ await toDock(); await stand(rowPad(R.state.row,true)); }; const shore=async()=>{ const c=R.wp(4*R.R+1.5,(R.Wd-1)/2); await place(c.x,c.z); await wait(150); };
 const solveAll=async()=>{ while(R.state.row<R.R) await solveRow(); await shore(); };
 const glowing=()=>R.pads.filter(p=>p.k===R.state.row&&p.hintUntil>g.roomTime&&p.state==='idle').length;`;
for (const pg of await b.pages()) await pg.goto('about:blank').catch(() => {});
const ob = await go(cp, BASE + 'game.html?room=obby&debug&fresh&band=b');
C.obbyRoomLoads = await run(ob, `${OBH} const k0=R.rowPads(0); const [cx,cz]=R.cellF(R.orient,R.padCells(k0[0])[0][0],R.padCells(k0[0])[0][1]);
  return R.id==='obby' && !!R.quest && R.band==='b' && R.state.index===0 && R.n===3 && k0.length===3 && R.pads.length===R.R*3 && W.get(cx,0,cz)===BL.planks && R.pads.filter(p=>p.grp).length===3 && W.get(...R.cellF(R.orient,0,0).concat([0]).slice(0,1),0,R.cellF(R.orient,0,0)[1])===BL.log && !!R.sign && R.orient==='fwd' && R.fitted===true
   && R.quest.level.kind==='goal' && g.rules.damage===false`);
C.obbyHostNamedInTextOnly = await run(ob, `return R.words.en.ob_intro.includes('Pip the tree-frog jump coach') && R.words.th.ob_intro.includes('ปิ๊บ (กบต้นไม้โค้ชกระโดด)')`);
C.obbyPlayerStartsOnLanding = await run(ob, `${OBH} await wait(300); const [cx,,cz]=W.cellOf(P.x,0,P.z), [u,v]=R.uvOf(cx,cz); return P.ground && P.y>.9 && u>=0 && u<=1 && v>=0 && v<R.Wd && R.padMap.get(cx+','+cz)===undefined && g.player.hp===g.player.maxHp`);
// a wrong block wobbles, sinks after sinkDelay, the player drops and is put back on the landing; no heart is lost; the shell counts a try
C.obbyWrongSinks = await run(ob, `${OBH} const bad=rowPad(0,false); const cells=R.padCells(bad).map(c=>R.cellF(R.orient,...c)); const solid=()=>cells.every(([x,z])=>W.get(x,0,z)===BL.planks);
  await stand(bad); const warned=bad.state==='warn' && solid() && R.quest.level.tries===1 && R.quest.level.value===0;
  await wait(Math.max(0,T.quest.sinkDelay*1000-(Date.now()%1)) * .4); const stillThere=solid();
  await wait(T.quest.sinkDelay*1000+500); const gone=cells.every(([x,z])=>W.get(x,0,z)===0) && bad.state==='sunk';
  await wait(1800); const [cx,,cz]=W.cellOf(P.x,0,P.z), [u,v]=R.uvOf(cx,cz);
  return warned && stillThere && gone && P.y>.9 && P.ground && u>=0 && u<=1 && g.player.hp===g.player.maxHp && R.state.row===0 && R.quest.level.tries===1`);
C.obbyHintLadder = await run(ob, `${OBH} R.startLevel(0); await wait(400); const steps=[]; const L=R.quest.level;       // the shell's ladder climbs with every wrong block of the level; a right row does not reset it
  await stand(R.rowPads(0).find(p=>!p.ok)); steps.push(glowing()); await solveRow(); await wait(500);
  const bads=R.rowPads(1).filter(p=>!p.ok); await stand(bads[0]); steps.push(glowing()); await toDock(); await stand(bads[1]); steps.push(glowing());
  return steps.join()==='0,2,1' && L.tries===3 && L.value===0 && !L.done && L.step===3 && R.state.row===1`);
C.obbyReplaySpeaksAndSays = await run(ob, `${OBH} R.startLevel(0); await wait(300); const said=[]; const sp=window.speechSynthesis; const orig=sp&&sp.speak; if(sp) sp.speak=u=>said.push(u.text); await stand(R.rowPads(0).find(p=>!p.ok)); const hint=document.getElementById('hint').textContent; if(sp) sp.speak=orig;
  return hint.includes(R.promptText()) && (!sp || R.band!=='a' || said.length>=1)`);
C.obbyRightOnceAtEnd = await run(ob, `${OBH} R.startLevel(0); await wait(300); const L=R.quest.level; let calls=0; const orig=R.quest.right.bind(R.quest); R.quest.right=i=>{ calls++; return orig(i); };
  const mid=[]; while(R.state.row<R.R){ await solveRow(); mid.push([L.value,L.done,calls]); } const before=mid.slice(0,-1).every(m=>m[0]===0&&!m[1]&&m[2]===0); const lastOk=L.value===1 && L.done && calls===1 && R.rightSent;
  const sink=!R.state.done; await shore(); await wait(300); return before && lastOk && sink && R.state.done===true && R.state.stars>=2 && R.state.result.stars>=2 && calls===1 && L.tries===0`);
C.obbyNextLevelLoads = await run(ob, `await wait(4700); return R.state.index===1 && !R.state.done && R.quest.level.value===0 && R.state.row===0 && R.pads.filter(p=>p.grp).length===R.n && R.ob.level===1`);
C.obbyAllLevelsSolve = await run(ob, `${OBH} const out=[]; for(const l of [0,1,2,3]){ R.startLevel(l); await wait(300); const kind=R.quest.level.kind; await solveAll(); out.push(R.state.done && R.state.stars>=1 && (l===3?kind==='free':kind==='goal')); } return out.every(Boolean)`);
// ---- band a: WALK (joystick only, never jump) across level 1: every row's right block, then the shore ----
const oa = await go(cp, BASE + 'game.html?room=obby&debug&fresh&band=a');
C.obbyBandA = await run(oa, `return R.band==='a' && R.n===2 && R.pads.every(p=>p.opt.dots) && R.orient==='side' && R.ob.rows.every(r=>r.y===0)`);
C.obbyBandAWalksNoJump = await run(oa, `${OBH} await wait(300); let maxVy=0, jumps=0; const mon=setInterval(()=>{ maxVy=Math.max(maxVy,P.vy); },15); const orig=g.player.jump.bind(g.player); g.player.jump=()=>{ jumps++; return orig(); };
  const go=async(x,z,ms=12000)=>{ let t=0; while(t<ms){ const dx=x-P.x, dz=z-P.z, d=Math.hypot(dx,dz); if(d<.12) break; g.input.stick={x:dx/d,y:dz/d}; await wait(40); t+=40; } g.input.stick={x:0,y:0}; await wait(120); };
  const L=R.quest.level; const y0=P.y; let minY=9; const mon2=setInterval(()=>{ minY=Math.min(minY,P.y); },15);
  for(let k=0;k<R.R;k++){ const t=R.pads.find(p=>p.k===k&&p.ok), a=R.wp(4*k,2*t.j+.5), f=R.wp(4*k+2.5,2*t.j+.5); await go(a.x,a.z); await go(f.x,f.z); if(R.state.row!==k+1) return false; }
  const s=R.wp(4*R.R+1.5,(R.Wd-1)/2); await go(s.x,s.z); clearInterval(mon); clearInterval(mon2); await wait(200);
  return R.state.done===true && L.done && L.value===1 && L.tries===0 && jumps===0 && maxVy<.5 && minY>.9 && R.state.stars>=2`);
C.obbyBandAFewerAndSpoken = await run(oa, `${OBH} const l1=R.ob; R.startLevel(1); await wait(300); const lv=R.ob; R.startLevel(2); await wait(300); const letters=R.pads.every(p=>!p.opt.dots && p.opt.label.length===1) && R.n===3 && /starts with/.test(R.ob.rows[0].prompt.en); const said=[]; const sp=window.speechSynthesis, orig=sp&&sp.speak; if(sp) sp.speak=u=>said.push(u.text); R.announceRow(); if(sp) sp.speak=orig;
  return letters && lv.n===3 && (!sp || said.some(t=>t.includes(R.ob.rows[0].prompt.en.split(' ')[0])))`);
// the sign of band a: a picture for every bank word, said aloud with the right voices (guarded), a speaker you tap to hear it again
C.obbySignPictures = await run(oa, `const { BANKS } = await import('./engine/rooms/quest/banks.js'); return BANKS.words.a.every(w=>typeof R.wordIcons[w]==='function') && R.sign && R.speaker && R.ob.rows.every(r=>r.icon)`);
C.obbySoundRowSpeaksEnglishWordThenThai = await run(oa, `const { i18n } = await import('./engine/core/i18n.js'); R.startLevel(2); await wait(300); const sp=window.speechSynthesis; if(!sp||!window.SpeechSynthesisUtterance) return true; const said=[], o=sp.speak, ov=sp.getVoices; sp.speak=u=>said.push([u.text,u.lang]); sp.getVoices=()=>[];
  const w=R.ob.rows[0].word, lang=i18n.lang; i18n.set('th'); R.speakRow(R.ob.rows[0]); const th=said.splice(0); i18n.set('en'); R.speakRow(R.ob.rows[0]); const en=said.splice(0);
  sp.getVoices=()=>[{lang:'en-US'}]; i18n.set('th'); R.speakRow(R.ob.rows[0]); const noThai=said.splice(0); sp.getVoices=()=>{ throw new Error('x'); }; let threw=false; try{ R.speakRow(R.ob.rows[0]); }catch(e){ threw=true; }
  sp.speak=o; sp.getVoices=ov; i18n.set(lang);
  return th.length===2 && th[0][0]===w && th[0][1]==='en-US' && th[1][1]==='th-TH' && !th[1][0].includes(w) && th[1][0].length>3 && en.length===1 && en[0][1]==='en-US' && en[0][0].includes(w) && noThai.length===1 && noThai[0][0]===w && !threw`);
await run(oa, `R.startLevel(1); await wait(1100); window.__said=[]; const sp=window.speechSynthesis; if(sp){ sp.getVoices=()=>[]; sp.speak=u=>window.__said.push(u.text); } const V=g.camera.position.constructor, w=R.speaker.getWorldPosition(new V()).project(g.camera); window.__spk=[(w.x+1)/2*innerWidth,(1-w.y)/2*innerHeight]; return true`);
const spk = await oa.evaluate(() => window.__spk); await oa.mouse.click(spk[0], spk[1]); await W(300);
C.obbySpeakerTapSaysAgain = await run(oa, `return R.spoke>=1 && (!window.speechSynthesis || window.__said.length>=1)`);
await oa.mouse.click(30, 300); await W(200);
C.obbyTapElsewhereSilent = await run(oa, `return R.spoke===1`);
// a hidden golden acorn on a side block of the second landing: walking onto it is the third star
C.obbyThreeStars = await run(ob, `${OBH} R.startLevel(0); await wait(300); const L=R.quest.level; const hiddenAtFirst=!R.acorn; await solveRow(); await wait(300); const shown=!!R.acorn; const sp=R.secretPos(); const [cx,cz]=R.cellF(R.orient,4,R.Wd); const solid=W.get(cx,0,cz)===BL.log; await place(sp.x,sp.z); await wait(200); const got=R.secret===true && !R.acorn;
  while(R.state.row<R.R) await solveRow(); await shore(); await wait(300); return hiddenAtFirst && shown && solid && got && R.state.done && L.tries===0 && R.state.result.stars===3`);
// ---- the window shrinks to a landscape phone (the game is landscape-only now): band a is side-on on the big window and from behind on the short one; the course is laid out again in place, progress is kept ----
C.obbyTurnKeepsProgress = await run(oa, `${OBH} R.startLevel(0); await wait(300); await solveRow(); await wait(300); const row=R.state.row, before=R.orient; window.__before=before; return row===1 && before==='side'`);
await oa.setViewport({ width: 812, height: 375, deviceScaleFactor: 1.5 }); await W(900);        // not isMobile: changing that reloads the page, this must be a plain resize
C.obbyResizedToPhone = await run(oa, `${OBH} await wait(400); const [cx,,cz]=W.cellOf(P.x,0,P.z), [u,v]=R.uvOf(cx,cz); const rows=R.rowPads(1).filter(p=>p.grp).length===R.n && R.rowPads(0).filter(p=>p.grp).length===R.n; const d0=R.rowPads(0).find(p=>p.ok); const [x0,z0]=R.cellF(R.orient,...R.padCells(d0)[0]);
  return R.orient==='fwd' && window.__before==='side' && R.state.row===1 && rows && W.get(x0,0,z0)===BL.planks && u>=4 && u<=5 && P.ground && P.y>.9 && R.fitted===true`);
// ---- framing: the current row's blocks, the sign and the player are on screen and clear of every HUD control, at five sizes, every level of each band ----
const OFRAME = `const P=g.player.body, cam=g.camera, V=cam.position.constructor; const ndc=(x,y,z)=>{ const v=new V(x,y,z).project(cam); return [(v.x+1)/2*innerWidth,(1-v.y)/2*innerHeight]; };
  const hud=[...document.querySelectorAll('#who,#stars,#gear,#bView,#bar,#joy,#act .btn,#hearts,#stam,#togChip,#hint')].map(e=>e.getBoundingClientRect()).filter(q=>q.width>0&&q.height>0);
  const clear=([x,y])=>x>8&&x<innerWidth-8&&y>8&&y<innerHeight-8 && !hud.some(q=>x>q.left-4&&x<q.right+4&&y>q.top-4&&y<q.bottom+4);
  const pts=[]; for(const p of R.pads.filter(p=>p.k===R.state.row&&p.grp)){ const c=p.grp.position; for(const dx of [-1,0,1]) for(const dz of [-1,0,1]) pts.push(ndc(c.x+dx,c.y+.05,c.z+dz)); }
  const bd=R.sign.userData.board, sw=R.sign.userData.sw; for(const sx of [-.5,-.25,0,.25,.5]) for(const sy of [-.5,0,.5]) pts.push((()=>{ const w=bd.localToWorld(new V(sx*sw,sy*1.5,0)); return ndc(w.x,w.y,w.z); })());
  pts.push(ndc(P.x,P.y+1.4,P.z), ndc(P.x,P.y,P.z)); const bad=pts.filter(q=>!clear(q)); window.__bad=JSON.stringify(bad.slice(0,4)); return bad.length===0 && R.fitted===true;`;
const OPH = (w, h) => ({ width: w, height: h, deviceScaleFactor: 2, isMobile: w < 500 || h < 400, hasTouch: w < 500 || h < 400 });
for (const [name, vp] of [['Landscape', undefined], ['Phone', OPH(812, 375)], ['Phone360', OPH(640, 360)], ['Phone390', OPH(844, 390)]])
  for (const band of ['a', 'b', 'c']){
    await go(cp, BASE + `game.html?room=obby&debug&fresh&band=${band}`, vp); await W(900); const res = [];
    for (const l of [0, 1, 2, 3]){ await run(cp, `R.startLevel(${l}); await wait(1100); return true`); const ok = await run(cp, OFRAME); res.push(ok); if (!ok) console.log('obby frame', name, band, l, await cp.evaluate(() => window.__bad)); }
    C['obbyFramed' + name + band.toUpperCase()] = res.every(Boolean);
  }
// readability at 1180x620: the question sign and the option labels are at least 20 css px tall in the letters
await go(cp, BASE + 'game.html?room=obby&debug&fresh&band=c'); await W(900);
const READ = `const cam=g.camera, V=cam.position.constructor; const ndc=(x,y,z)=>{ const v=new V(x,y,z).project(cam); return [(v.x+1)/2*innerWidth,(1-v.y)/2*innerHeight]; };
  const bd=R.sign.userData.board, ud=R.sign.userData, a=bd.localToWorld(new V(0,-.75,0)), b=bd.localToWorld(new V(0,.75,0)), pa=ndc(a.x,a.y,a.z), pb=ndc(b.x,b.y,b.z), signPx=Math.abs(pa[1]-pb[1])*(ud.px/ud.h);
  let labelPx=1e9, dotPx=1e9; for(const p of R.pads.filter(p=>p.k===R.state.row&&p.grp)){ const c=p.grp.position, n=String(p.opt.label).length, q=ndc(c.x,c.y,c.z-.91), r=ndc(c.x,c.y,c.z+.91), h=Math.abs(q[1]-r[1]);
    if(p.opt.dots){ const m=p.opt.dots, cols=m<=3?m:m===4?2:m<=6?3:m===9?3:4, rows=Math.ceil(m/cols), cell=Math.min(232/cols,232/rows); dotPx=Math.min(dotPx,h*(cell*.8/256)*.9); } else labelPx=Math.min(labelPx,h*(n<=1?.7:n<=2?.55:n<=4?.38:.26)*.9); }
  window.__px=JSON.stringify({signPx,labelPx,dotPx}); return signPx>=20 && labelPx>=20 && dotPx>=14;`;      // letters and numbers 20 px; a dot in a picture of dots 14 px (they are counted, not read)
C.obbyReadableBandC = true; for (const l of [0, 1, 2, 3]){ await run(cp, `R.startLevel(${l}); await wait(1100); return true`); if (!await run(cp, READ)){ C.obbyReadableBandC = false; console.log('obby readable c', l, await cp.evaluate(() => window.__px)); } }
for (const band of ['a', 'b']){ await go(cp, BASE + `game.html?room=obby&debug&fresh&band=${band}`); await W(900); C['obbyReadableBand' + band.toUpperCase()] = true;
  for (const l of [0, 1, 2, 3]){ await run(cp, `R.startLevel(${l}); await wait(1100); return true`); if (!await run(cp, READ)){ C['obbyReadableBand' + band.toUpperCase()] = false; console.log('obby readable', band, l, await cp.evaluate(() => window.__px)); } } }
// band a on a landscape phone (812x375): framed and readable (signs and letters 20 px, a dot 14 px) at every level
await go(cp, BASE + 'game.html?room=obby&debug&fresh&band=a', OPH(812, 375)); await W(900); C.obbyBandAPhoneFramedReadable = true;
for (const l of [0, 1, 2, 3]){ await run(cp, `R.startLevel(${l}); await wait(1100); return true`); const f = await run(cp, OFRAME), r = await run(cp, READ); if (!f || !r){ C.obbyBandAPhoneFramedReadable = false; console.log('obby a phone', l, f, r, await cp.evaluate(() => window.__bad + window.__px)); } }
// the hint ladder in every band (three wrong blocks: replay, two glow, one glows)
for (const band of ['a', 'b', 'c']){ await go(cp, BASE + `game.html?room=obby&debug&fresh&band=${band}`); await W(600);
  C['obbyHintLadderBand' + band.toUpperCase()] = await run(cp, `${OBH} R.startLevel(1); await wait(500); const L=R.quest.level, steps=[]; await stand(R.rowPads(0).find(p=>!p.ok)); steps.push(glowing()); await solveRow(); await wait(500); const bads=R.rowPads(1).filter(p=>!p.ok); await stand(bads[0]); steps.push(glowing()); await toDock(); await stand(bads[1]); steps.push(glowing());
    return steps.join()==='0,2,1' && L.tries===3 && !L.done`); }
// walking over the sunk block's water never costs a heart, and the engine's own sea rescue does not fight the room (the player is back on the landing, not on a gone block)
await go(cp, BASE + 'game.html?room=obby&debug&fresh&band=b'); await W(600);
C.obbyNoHeartLostFalling = await run(cp, `${OBH} const hp=g.player.hp; await place(R.wp(0,-2).x,R.wp(0,-2).z); await wait(1500); const [cx,,cz]=W.cellOf(P.x,0,P.z), [u,v]=R.uvOf(cx,cz); return g.player.hp===hp && P.y>.9 && u>=0 && u<=1 && R.quest.level.tries===0`);
if (OBBYSHOT){
  await go(cp, BASE + 'game.html?room=obby&debug&fresh&band=b'); await W(900); await run(cp, `${OBH} await solveRow(); await toDock(); await wait(200); await stand(R.rowPads(1).find(p=>!p.ok)); await wait(1500); await toDock(); await wait(2500); return true`);
  await cp.screenshot({ path: OBBYSHOT, type: 'jpeg', quality: 88 });
  await go(cp, BASE + 'game.html?room=obby&debug&fresh&band=a'); await W(5200); await cp.screenshot({ path: OBBYSHOT.replace(/\.jpg$/, '-a.jpg'), type: 'jpeg', quality: 88 });
  await go(cp, BASE + 'game.html?room=obby&debug&fresh&band=c', OPH(812, 375)); await W(5200); await cp.screenshot({ path: OBBYSHOT.replace(/\.jpg$/, '-phone.jpg'), type: 'jpeg', quality: 88 });
  await go(cp, BASE + 'game.html?room=obby&debug&fresh&band=a', OPH(812, 375)); await W(5200); await cp.screenshot({ path: OBBYSHOT.replace(/\.jpg$/, '-short.jpg'), type: 'jpeg', quality: 88 });
}

// ---- Task 7: camera rule per band, first person off, band chip clear of the HUD, band switch rebuilds ----
const ROOMS = ['blueprint', 'dig', 'escape', 'code', 'obby'];
const url = (room, band) => BASE + `game.html?room=${room}&debug&fresh&band=${band}`;
// something of the old level a switch must wipe (where the room's own level start clears it)
const MESS = { blueprint: `W.set(R.ox,R.oy,R.oz,BL.planks); W.set(R.ox+5,R.oy+6,R.oz+7,BL.brick);`, dig: `W.set(R.sx+3,R.Y0+1,R.sz+1,BL.planks);`, escape: ``, code: ``, obby: `W.set(10,4,10,BL.planks);` };
const FP = `const h=a=>{let x=2166136261;for(let i=0;i<a.length;i++){x^=a[i];x=Math.imul(x,16777619);}return x>>>0;}; const ids=[...document.body.querySelectorAll('[id]')].map(e=>e.id).filter(i=>!/^fcq|^toast|^hint$/.test(i)).sort().join(); return JSON.stringify({cells:h(W.cells),grp:R.grp.children.length,scene:g.scene.children.length,ids});`;
for (const room of ROOMS){
  const Rm = room[0].toUpperCase() + room.slice(1);
  await go(cp, url(room, 'c')); const fresh = await run(cp, FP);
  await go(cp, url(room, 'a')); await run(cp, `R.startLevel(1); await wait(300); ${MESS[room]} return true`);
  await cp.click('#fcqChip'); await W(300); await cp.click('#fcqMenu button[data-band="c"]'); await W(1500);       // the real chip, like a child
  const sw = await run(cp, `return JSON.stringify({ band:R.band, q:R.quest.band, qi:R.quest.index, si:R.state.index, ls:localStorage.getItem('fc-band'), chip:document.getElementById('fcqChip').textContent.trim(), menu:!!document.getElementById('fcqMenu'), fp:${'(()=>{'}${FP}${'})()'} })`);
  const j = JSON.parse(sw), same = j.fp === fresh;
  C['bandSwitchRebuilds' + Rm] = j.band === 'c' && j.q === 2 && j.qi === 0 && j.si === 0 && j.ls === 'c' && j.chip.startsWith('10') && !j.menu && same;
  if (!C['bandSwitchRebuilds' + Rm]) console.log('bandSwitch', room, sw, fresh);
}
for (const room of ROOMS){
  const Rm = room[0].toUpperCase() + room.slice(1);
  await go(cp, url(room, 'a'));
  C['cameraLockBandA' + Rm] = await run(cp, `const cam=g.cam, rule=R.camRule, b=rule.view(); cam.yaw=b.yaw+1.1; cam.pitch=.2; cam.dist=5; await wait(250); const direct=Math.abs(cam.yaw-b.yaw)<1e-6;
    let worst=0; for(let i=0;i<12;i++){ g.input.look.dx=-300; g.input.look.dy=100; g.input.look.zoom=500; await new Promise(r=>requestAnimationFrame(r)); worst=Math.max(worst,Math.abs(cam.yaw-b.yaw),Math.abs(cam.pitch-b.pitch),Math.abs(cam.dist-b.dist)); }      // a drag through the engine's input path never shows, not even for one frame
    return direct && worst<1e-9 && rule.mode==='lock' && Math.abs(cam.yaw-b.yaw)<1e-6 && Math.abs(cam.pitch-b.pitch)<1e-6 && Math.abs(cam.dist-b.dist)<1e-6 && !document.getElementById('fcqReset')`);
  C['firstPersonOff' + Rm] = await run(cp, `const bv=document.getElementById('bView'); const hidden=getComputedStyle(bv).display==='none'; g.toggleView(); await wait(300); const back=g.cam.mode==='third'; g.toggleView(); R.startLevel(0); const lvl=g.cam.mode==='third'; return hidden && back && lvl`);
  await run(cp, `R.switchBand('b'); await wait(900); return true`);
  C['cameraStep90BandB' + Rm] = await run(cp, `const cam=g.cam, rule=R.camRule, b=rule.view(); addEventListener('pointerdown',e=>e.stopPropagation(),true); const dn=()=>g.canvas.dispatchEvent(new PointerEvent('pointerdown')), up=()=>g.canvas.dispatchEvent(new PointerEvent('pointerup'));      // the engine's own drag handler never sees the fake press
    dn(); g.input.look.dx=-100; g.input.look.dy=60; g.input.look.zoom=300; await wait(250); const held=Math.abs(cam.yaw-(b.yaw+.6))<.01 && Math.abs(cam.dist-b.dist)<1e-6; up(); await wait(900); const a1=Math.abs(cam.yaw-b.yaw)<.01;
    g.input.look.dx=-217; await wait(900); const a2=Math.abs(cam.yaw-(b.yaw+Math.PI/2))<.01; return rule.mode==='step90' && held && a1 && a2 && Math.abs(cam.pitch-b.pitch)<1e-6 && !document.getElementById('fcqReset')`);
  await run(cp, `R.switchBand('c'); await wait(900); return true`);
  const free = await run(cp, `const cam=g.cam, rule=R.camRule, b=rule.view(); cam.yaw=b.yaw+1; await wait(300); const btn=document.getElementById('fcqReset'), r=btn.getBoundingClientRect(); return rule.mode==='free' && Math.abs(cam.yaw-(b.yaw+1))<1e-6 && r.width>=48 && r.height>=48 && getComputedStyle(btn).display!=='none'`);
  await cp.click('#fcqReset'); await W(200);
  C['cameraFreeResetBandC' + Rm] = free && await run(cp, `const b=R.camRule.view(); return Math.abs(g.cam.yaw-b.yaw)<1e-6 && Math.abs(g.cam.pitch-b.pitch)<1e-6 && Math.abs(g.cam.dist-b.dist)<1e-6`);
}
// a player who chose first person keeps that choice: the room leaves first person without saving it
await go(cp, url('blueprint', 'b'));
C.firstPersonChoiceKept = await run(cp, `localStorage.setItem('fc-view','"first"'); g.cam.mode='first'; await wait(300); const left=g.cam.mode==='third'; const kept1=localStorage.getItem('fc-view')==='"first"'; dispatchEvent(new Event('pagehide')); await wait(100); return left && kept1 && localStorage.getItem('fc-view')==='"first"' && document.getElementById('bView').style.display===''`);
// the chip and the reset button never touch the HUD or a room panel: five sizes, band c (both are on screen)
const CLEAR = `const chip=document.getElementById('fcqChip'), rs=document.getElementById('fcqReset'); if(!chip||!rs) return false; const vw=innerWidth, vh=innerHeight, bad=[]; const rc=[chip,rs].map(e=>e.getBoundingClientRect());
  for(const q of rc) if(q.left<0||q.top<0||q.right>vw||q.bottom>vh) bad.push('offscreen');
  if(rc[0].left<rc[1].right && rc[0].right>rc[1].left && rc[0].top<rc[1].bottom && rc[0].bottom>rc[1].top) bad.push('chip/reset');
  if(rc[0].height<48||rc[1].height<48||rc[1].width<48) bad.push('small');
  for(const e of document.body.querySelectorAll('*')){ if(e===chip||e===rs||e.tagName==='CANVAS'||e.closest('[data-fcq-skip]')) continue; const s=getComputedStyle(e); if(s.position!=='fixed'&&s.position!=='absolute') continue; if(s.display==='none'||s.visibility==='hidden'||+s.opacity===0) continue; const r=e.getBoundingClientRect(); if(r.width<1||r.height<1||r.width*r.height>vw*vh*.4) continue;
    for(const q of rc) if(q.left<r.right && q.right>r.left && q.top<r.bottom && q.bottom>r.top) bad.push(e.id||e.className); }
  window.__bad=bad.join(); return bad.length===0;`;
for (const room of ROOMS){
  const Rm = room[0].toUpperCase() + room.slice(1); C['bandChipClear' + Rm] = true;
  for (const [name, vp] of [['Landscape', undefined], ['Phone', OPH(812, 375)], ['Phone360', OPH(640, 360)], ['Phone390', OPH(844, 390)]]){
    await go(cp, url(room, 'c'), vp); await W(1200); if (!await run(cp, CLEAR)){ C['bandChipClear' + Rm] = false; console.log('chip clear', room, name, await cp.evaluate(() => window.__bad)); }
    if (room === 'obby' && name === 'Landscape' && !process.env.SKIPSHOT){ /* menu screenshot is taken by the shot script */ }
  }
}
// the opening of the menu keeps the room running and a tap outside closes it
await go(cp, url('dig', 'b')); await cp.click('#fcqChip'); await W(200);
C.bandChipMenuOpensAndCloses = await run(cp, `return !!document.getElementById('fcqMenu') && document.querySelectorAll('#fcqMenu button').length===3 && document.getElementById('fcqMenu').querySelector('.on').dataset.band==='b'`) && (await cp.mouse.click(5, 300), await W(200), await run(cp, `return !document.getElementById('fcqMenu') && R.band==='b' && R.state.index===0`));
// ---- final fix wave: fresh-load framing (no startLevel call: exactly what a child sees after opening the room) ----
// shared: screen point of a world point, the HUD boxes (incl. the goal banner's widest box) and "on screen, clear of the HUD"
const FR = `const cam=g.camera, V=cam.position.constructor; cam.updateMatrixWorld(); const ndc=(x,y,z)=>{ const v=new V(x,y,z).project(cam); return [(v.x+1)/2*innerWidth,(1-v.y)/2*innerHeight]; };
  const BC=await import('./engine/rooms/quest/band-chip.js'), SB=await import('./engine/rooms/quest/screen-boxes.js'); const hud=BC.hudRects([]);
  const inView=([x,y])=>x>4&&x<innerWidth-4&&y>4&&y<innerHeight-4, clear=q=>inView(q)&&!hud.some(b=>q[0]>b.l&&q[0]<b.r&&q[1]>b.t&&q[1]<b.b); const bad=[];`;
// dig: the player stands on the slab inside the cut, the camera is not pulled in by rock, the player and the cut face are on screen and clear of the HUD
const DIGFRAME = `${FR} const P=g.player.body, Z=R.site.size.z, zc=W.wx(R.sz+(Z>>1)), b=R.baseView, [cx,,cz]=W.cellOf(P.x,0,P.z);
  if(Math.abs(P.z-zc)>Z/2) bad.push('offSlab z '+P.z); if(cx<R.sx||cx>R.sx+4) bad.push('notInCut x '+cx); if(Math.abs(P.y-W.top(cx,cz))>.15||P.y<R.Y0-R.n) bad.push('notOnStair y '+P.y);
  if(g.cam.cur<.8*b.dist) bad.push('camPulledIn '+g.cam.cur.toFixed(2)+'/'+b.dist);
  if(R.spawn[0]!==P.x&&Math.abs(R.spawn[0]-P.x)>.6) bad.push('roomSpawnDiffers');
  const deep=R.band==='a'?2:R.n-1, face=W.wx(R.sz+Z-1)+.5;
  const pts={ feet:ndc(P.x,P.y+.1,P.z), head:ndc(P.x,P.y+1.5,P.z), cutFace:ndc(W.wx(R.sx+5),R.Y0+1-deep/2,face) }; for(const [k,q] of Object.entries(pts)) if(!clear(q)) bad.push(k+' '+q.map(Math.round));
  /* every shelf / era sign, find label and letter slot (fresh load: 1180x620 and 812x375, all bands): fully inside the viewport, touching no other label and no HUD box (action buttons, joystick, hotbar, #hint banner, chip, reset) */
  const hit=(a,b)=>a.l<b.r&&a.r>b.l&&a.t<b.b&&a.b>b.t, all=BC.hudRects([]), labs=R.frameBoxes().map(o=>({n:o.name,r:SB.screenRect(cam,o)}));
  if(labs.length<3) bad.push('labels '+labs.length);
  for(const x of labs){ const r=x.r; if(!r){ bad.push('hidden '+x.n); continue; } if(r.l<0||r.t<0||r.r>innerWidth||r.b>innerHeight) bad.push('clipped '+x.n+' '+[r.l,r.t,r.r,r.b].map(Math.round));
    for(const h of all) if(hit(r,h)){ bad.push('underHud '+x.n); break; } }
  for(let i=0;i<labs.length;i++) for(let j=i+1;j<labs.length;j++) if(labs[i].r&&labs[j].r&&hit(labs[i].r,labs[j].r)) bad.push('touch '+labs[i].n+' / '+labs[j].n);
  /* the text a child reads is at least 16 css px: the board height on screen times the font's share of it (userData.frac), every dig label */
  const V3=cam.position.constructor, sy=v=>{ v.project(cam); return (1-v.y)/2*innerHeight; };
  for(const o of R.frameBoxes()){ if(!o.visible) continue; o.updateWorldMatrix(true,true); const c=new V3(); o.children[o.children.length-1].getWorldPosition(c); const hh=(o.userData.textH||0)*o.scale.x/2;
    const px=Math.abs(sy(c.clone().add(new V3(0,hh,0)))-sy(c.clone().add(new V3(0,-hh,0))))*(o.userData.frac||0); if(!(px>=16)) bad.push('smallText '+o.name+' '+px.toFixed(1)+'px'); }
  window.__bad=bad.join('; '); return bad.length===0;`;
// blueprint: the plot's four floor corners and both plan cards are inside the viewport
const BPFRAME = `${FR} const [w,,d]=R.bp.size, x0=W.wx(R.ox)-.5, z0=W.wx(R.oz)-.5;
  for(const [dx,dz] of [[0,0],[w,0],[0,d],[w,d]]){ const q=ndc(x0+dx,R.oy,z0+dz); if(!inView(q)) bad.push('plot '+q.map(Math.round)); }
  for(const c of R.cards.children){ const r=SB.screenRect(cam,c); if(!r||r.l<0||r.t<0||r.r>innerWidth||r.b>innerHeight) bad.push('card '+JSON.stringify(r&&[r.l,r.t,r.r,r.b].map(Math.round))); }
  if(R.cards.children.length!==2) bad.push('cards '+R.cards.children.length); window.__bad=bad.join('; '); return bad.length===0;`;
// every room: no registered 3D sign's screen box overlaps the reset button, the band chip or a round action button (jump, dig, use, sit)
const SIGNCLEAR = `${FR} const els=['fcqReset','fcqChip','bJump','bMine','bUse','bSit'].map(i=>document.getElementById(i)).filter(e=>e&&e.style.display!=='none'&&getComputedStyle(e).display!=='none'&&e.getBoundingClientRect().width>0); const signs=SB.keepClearRects().filter(s=>!s.walk);
  for(const e of els){ const r=e.getBoundingClientRect(); for(const s of signs) if(r.left<s.r&&r.right>s.l&&r.top<s.b&&r.bottom>s.t) bad.push(e.id+' x sign '+[s.l,s.t,s.r,s.b].map(Math.round)); }
  window.__bad=bad.join('; ')+' signs:'+signs.length; return bad.length===0 && signs.length>0;`;
// blueprint on a phone: the card titles render at least 16 css px, and no card covers a glass guide (card face corners vs the guide cubes' corners, projected)
const BPCARDS = `${FR} const V3=cam.position.constructor, rect=pts=>{ let l=1e9,t=1e9,r=-1e9,b=-1e9; for(const p of pts){ const [x,y]=ndc(p.x,p.y,p.z); l=Math.min(l,x); r=Math.max(r,x); t=Math.min(t,y); b=Math.max(b,y); } return {l,t,r,b}; };
  const hit=(a,c)=>a.l<c.r&&a.r>c.l&&a.t<c.b&&a.b>c.t, guides=R.guides.map(m=>{ const p=m.position, pts=[]; for(const i of [-.48,.48]) for(const j of [-.48,.48]) for(const k of [-.48,.48]) pts.push(new V3(p.x+i,p.y+j,p.z+k)); return rect(pts); });
  for(const c of R.cards.children){ c.updateMatrixWorld(true); const bx=c.userData.box, face=rect([[-1,-1],[-1,1],[1,-1],[1,1]].map(([i,j])=>c.localToWorld(new V3(i*bx.w/2,bx.cy+j*bx.h/2,0))));
    const tl=c.children.find(x=>x.name==='title'), tg=tl.geometry.parameters, tr=rect([[-1,-1],[-1,1],[1,-1],[1,1]].map(([i,j])=>tl.localToWorld(new V3(i*tg.width/2,j*tg.height/2,0)))), px=(tr.b-tr.t)*tl.userData.frac;
    if(px<16) bad.push('title '+px.toFixed(1)+'px'); guides.forEach((gr,i)=>{ if(hit(face,gr)) bad.push('card over guide '+i); }); }
  window.__bad=bad.join('; '); return bad.length===0 && R.cards.children.length===2;`;
for (const [name, vp] of [['Desk', undefined], ['Phone', OPH(812, 375)]])
  for (const room of ROOMS) for (const band of ['a', 'b', 'c']){
    await go(cp, url(room, band), vp); await W(800);
    const Rm = room[0].toUpperCase() + room.slice(1), key = 'signsClearOfButtons' + Rm;
    if (C[key] === undefined) C[key] = true;
    if (!await run(cp, SIGNCLEAR)){ C[key] = false; console.log('signs', room, band, name, await cp.evaluate(() => window.__bad)); }
    if (room === 'dig' && name === 'Desk' || room === 'dig' && name === 'Phone'){ const k = 'digFramed' + band.toUpperCase(); if (C[k] === undefined) C[k] = true;
      if (!await run(cp, DIGFRAME)){ C[k] = false; console.log('dig frame', band, name, await cp.evaluate(() => window.__bad)); } }
    if (room === 'blueprint'){ const k = 'blueprintFramed' + name; if (C[k] === undefined) C[k] = true;
      if (!await run(cp, BPFRAME)){ C[k] = false; console.log('blueprint frame', band, name, await cp.evaluate(() => window.__bad)); } }
    if (room === 'blueprint' && name === 'Phone'){ if (C.blueprintPhoneCardsReadable === undefined) C.blueprintPhoneCardsReadable = true;
      if (!await run(cp, BPCARDS)){ C.blueprintPhoneCardsReadable = false; console.log('blueprint cards', band, await cp.evaluate(() => window.__bad)); } }
  }
// shrinking to a landscape phone re-picks the base view (dig and blueprint), and blueprint lays its cards out again (beside the plot, straight on)
await go(cp, url('blueprint', 'b')); const bpLand = await run(cp, `return R.baseView.dist`); await cp.setViewport(OPH(812, 375)); await W(1500);
C.blueprintResizeReframes = bpLand === 8.5 && await run(cp, `${BPFRAME}`) && await run(cp, `return R.baseView.port===true && !!R.frame && R.frame.D>8.5 && R.frame.rect.r<=innerWidth && Math.abs(g.cam.dist-R.baseView.dist)<1e-6`);
await go(cp, url('dig', 'a')); await cp.setViewport(OPH(812, 375)); await W(1500);
C.digResizeReframes = await run(cp, `return !!R.frame && R.frame.rect.r<=innerWidth && R.frame.rect.b<=innerHeight && Math.abs(g.cam.dist-R.baseView.dist)<1e-6`) && await run(cp, DIGFRAME);
// a respawn (player.js uses room.spawn) lands on the same stair as the level start
C.digRespawnOnSlab = await run(cp, `const P=g.player.body; P.x=W.wx(15); P.z=W.wx(10); await wait(200); g.player.spawn(...g.room.spawn); await wait(400);      /* what player.js does on a respawn (dig has damage off) */ const [cx,,cz]=W.cellOf(P.x,0,P.z); return cx===R.sx+4 && Math.abs(P.z-W.wx(R.sz))<.6 && Math.abs(P.y-W.top(cx,cz))<.2`);
// band a says the English word of its goal with an English voice, the rest with a Thai one
C.digBandASpeaksEnglishWord = await run(cp, `const { i18n } = await import('./engine/core/i18n.js'); const sp=window.speechSynthesis; if(!sp||!window.SpeechSynthesisUtterance) return true; const said=[], o=sp.speak, ov=sp.getVoices; sp.speak=u=>said.push([u.text,u.lang]); sp.getVoices=()=>[];
  const lang=i18n.lang; i18n.set('th'); R.speak(R.task.goalText.th); const th=said.splice(0); sp.getVoices=()=>[{lang:'th-TH'}]; R.speak(R.task.goalText.th); const noEn=said.splice(0); sp.speak=o; sp.getVoices=ov; i18n.set(lang);
  return th.length===2 && th[0][1]==='th-TH' && th[1][1]==='en-US' && th[1][0]===R.task.word && noEn.length===1 && noEn[0][1]==='th-TH'`);
// the admin's tuning reaches the rooms at level start: band b's free code level asks for TUNING.quest.codeFreeB blocks (goal text too)
await go(cp, url('code', 'b'));
C.codeFreeBFromTuning = await run(cp, `const { TUNING } = await import('./engine/data/tuning.js'); const old=TUNING.quest.codeFreeB; TUNING.quest.codeFreeB=7; R.startLevel(3); await wait(200);
  const ok=R.free && R.lv.need.count===7 && /7/.test(R.lv.goalText.th) && /7/.test(R.lv.goalText.en) && !/5/.test(R.lv.goalText.en); TUNING.quest.codeFreeB=old; R.startLevel(3); await wait(200); return ok && R.lv.need.count===old`);
C.noPageErrors = errs.length === 0;
let ok = 0; for (const [k, v] of Object.entries(C)){ console.log((v ? 'PASS ' : 'FAIL ') + k); if (v) ok++; }
if (errs.length) console.log(errs.slice(0, 8).join('\n'));
console.log(`${ok}/${Object.keys(C).length}`); await b.close(); process.exit(ok === Object.keys(C).length ? 0 : 1);
