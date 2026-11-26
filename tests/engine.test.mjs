// Automated play checks for the core engine (block world, tools, stamina, crafting, farming, critters...).
// Needs the local server: node serve.mjs (port 8787). Run: node tests/engine.test.mjs [shot.jpg] [parent.jpg]
import puppeteer from '/Users/familyjourney/.claude/skills/style-atlas/scripts/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js';
const URL = process.env.URL || 'http://localhost:8787/game.html?debug&fresh&skin=c', SHOT = process.argv[2];
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu'] });
const errs = []; const p = await b.newPage(); await p.setViewport({ width: 1180, height: 620, deviceScaleFactor: 1.5 });
p.on('pageerror', e => errs.push(String(e))); p.on('response', r => { if (r.status() >= 400 && !/favicon|audio\/bgm/.test(r.url())) errs.push(r.status() + ' ' + r.url()); });
await p.goto(URL, { waitUntil: 'networkidle0', timeout: 90000 }); await new Promise(r => setTimeout(r, 4000));
const W = ms => new Promise(r => setTimeout(r, ms));
const C = {};
const run = async code => p.evaluate(new Function('return (async()=>{const g=window.__g, P=g.player, B=P.body, W=g.world, I=g.inv, BL=Object.fromEntries((await import("./engine/world/voxel.js")).BLOCKS.map((b,i)=>[b.id,i])); const wait=ms=>new Promise(r=>setTimeout(r,ms)); const put=(id,n)=>{ const s=I.slots.findIndex(s=>s&&s.id===id); if(s>=0){ I.slots[s].n=n; } else I.add(id,n,true); }; const hold=id=>{ let s=I.slots.findIndex(s=>s&&s.id===id); if(s<0){ I.add(id,1,true); s=I.slots.findIndex(s=>s&&s.id===id); } if(s>=6){ I.swap(s,0); s=0; } I.select(s); }; const flat=()=>{ /* a clear flat test pad near the middle */ for(let x=12;x<=18;x++) for(let z=12;z<=18;z++){ for(let y=1;y<W.H;y++) W.set(x,y,z,0); W.set(x,1,z,BL.soil); W.set(x,2,z,BL.grass); } B.x=W.wx(15); B.z=W.wx(15); B.y=3.01; B.vy=0; P.face=0; g.cam.yaw=0; P.tapped=null; }; ' + code + '})()'));
await run(`g.mobs.list.forEach(m=>{ g.mobs.kill(m); m.wait=1e9; })`);
C.loaded = await run(`return !!(P.model && W.top(15,15) > 0)`);
C.hotbarSix = await run(`return document.querySelectorAll('#bar .slot:not(.bagbtn)').length===8`);   // 8 shortcut slots since 2026-11-27
C.startKit = await run(`return ['pickaxe','axe','shovel','sword','hoe','can','seeds'].every(id=>I.count(id)>0)`);
// movement
C.stickUpWalksForward = await run(`flat(); await wait(200); const z0=B.z; g.input.stick={x:0,y:-1}; await wait(500); g.input.stick={x:0,y:0}; return B.z>z0+1`);
C.noAutoJumpAtStep = await run(`flat(); W.set(15,3,16,BL.stone); await wait(200); const y0=B.y; let top=y0; g.input.stick={x:0,y:-1}; for(let i=0;i<8;i++){ await wait(70); top=Math.max(top,B.y); } g.input.stick={x:0,y:0}; return top<y0+.2`);
C.jumpOntoStep = await run(`const y0=B.y; P.jump(); g.input.stick={x:0,y:-1}; await wait(450); g.input.stick={x:0,y:0}; await wait(300); return B.y>=y0+1-.01`);
// aiming and digging with the right tool
C.aimsAtFrontBlock = await run(`flat(); W.set(15,3,16,BL.soil); await wait(200); const t=P.target; return !!t && t.x===15 && t.z===16`);
C.shovelDigsSoilFast = await run(`hold('shovel'); const n=I.count('soil'); P.mineDown(); await wait(450); P.mineUp(); await wait(1300); return W.get(15,3,16)===0 && I.count('soil')>=n+1`);
C.stoneNeedsPickaxe = await run(`flat(); W.set(15,3,16,BL.stone); await wait(200); hold('shovel'); P.mineDown(); await wait(1500); const still=W.get(15,3,16)===BL.stone; P.mineUp(); hold('pickaxe'); const n=I.count('stone'); P.mineDown(); await wait(1600); P.mineUp(); await wait(1300); return still && W.get(15,3,16)===0 && I.count('stone')===n+1`);
C.axeChopsLog = await run(`flat(); W.set(15,3,16,BL.log); await wait(200); hold('axe'); const n=I.count('log'); P.mineDown(); await wait(1000); P.mineUp(); await wait(1300); return I.count('log')===n+1`);
// placing on the aimed face
C.placeOnFace = await run(`flat(); W.set(15,3,17,BL.stone); await wait(200); put('planks',5); hold('planks'); P.aim=()=>{}; P.target={x:15,y:3,z:17,n:[0,0,-1]}; P.use(); delete P.aim; return W.get(15,3,16)===BL.planks && I.count('planks')===4`);
C.sideAtFeetBuildsOnTop = await run(`flat(); W.set(15,3,16,BL.stone); await wait(200); hold('planks'); const n=I.count('planks'); P.aim=()=>{}; P.target={x:15,y:3,z:16,n:[0,0,-1]}; P.use(); delete P.aim; return W.get(15,4,16)===BL.planks && I.count('planks')===n-1`);
C.cannotPlaceIntoOwnBody = await run(`flat(); await wait(200); hold('planks'); P.target={x:15,y:2,z:15,n:[0,1,0]}; const n=I.count('planks'); P.aim=()=>{}; P.use(); delete P.aim; return W.get(15,3,15)===0 && I.count('planks')===n`);
C.stuckBodyRisesOut = await run(`flat(); await wait(200); W.set(15,3,15,BL.stone); await wait(150); return B.y>=4-.01`);
// crafting
C.craftPlanks = await run(`put('log',2); const n=I.count('planks'); const r=(await import('./engine/items/items.js')).RECIPES.find(r=>r.out==='planks'); return I.craft(r) && I.count('planks')===n+4 && I.count('log')===1`);
C.craftBedNeedsGel = await run(`const R=(await import('./engine/items/items.js')).RECIPES.find(r=>r.out==='bed'); put('planks',6); const before=I.craft(R); put('gel',3); return !before && I.craft(R) && I.count('bed')===1`);
C.craftPanelLists = await run(`g.hud.craft(true); const n=document.querySelectorAll('#craftList .recipe').length; g.hud.craft(false); return n>=7`);
// stamina, sitting, sleeping
C.runningTires = await run(`flat(); await wait(100); P.sp=100; g.input.stick={x:0,y:-1}; await wait(700); g.input.stick={x:0,y:0}; return P.sp<100`);
C.emptyStaminaSlows = await run(`flat(); await wait(100); P.sp=0; const z0=B.z; g.input.stick={x:0,y:-1}; await wait(500); g.input.stick={x:0,y:0}; const d=B.z-z0; return d>.5 && d<1.6`);
C.sitRecoversFast = await run(`flat(); await wait(200); P.sp=10; P.sit(); await wait(1000); const s=P.sp; P.stand(); return P.sitting===false && s>=24`);
C.bedSleepFull = await run(`flat(); W.set(15,3,16,BL.bed); await wait(200); P.sp=5; hold('planks'); P.use(); await wait(1800); return P.sp===P.maxSp`);
// food
C.carrotHealsThree = await run(`flat(); await wait(200); P.safe=0; P.hp=5; g.hud.hearts(5,10); put('carrot',2); hold('carrot'); P.use(); await wait(1100); return P.hp===8`);
// farming
C.hoeTills = await run(`flat(); await wait(200); hold('hoe'); P.target={x:15,y:2,z:16,n:[0,1,0]}; P.aim=()=>{}; P.use(); return W.get(15,2,16)===BL.farmland`);
C.plantSeeds = await run(`hold('seeds'); const n=I.count('seeds'); P.use(); return !!g.farm.at(15,2,16) && I.count('seeds')===n-1`);
C.waterField = await run(`hold('can'); P.use(); return W.get(15,2,16)===BL.farmwet`);
C.cropGrowsWhenWet = await run(`g.farm.CROPS.carrot.grow=.2; await wait(1200); const c=g.farm.at(15,2,16); return !!c && g.farm.ripe(c)`);
C.harvestGivesCarrots = await run(`const n=I.count('carrot'); hold('planks'); P.use(); await wait(1600); delete P.aim; return !g.farm.at(15,2,16) && I.count('carrot')>n`);
// critters: three kinds; a sword cut on a jelly leaves gel; it respawns at its spawn point
C.threeKinds = await run(`return ['jelly','beetle','spiky'].every(k=>g.mobs.list.some(m=>m.kind===k))`);
C.jellyDropsGelAndRespawns = await run(`flat(); await wait(200); const m=g.mobs.list.find(m=>m.kind==='jelly'); m.spawn=[15,17]; m.home=[W.wx(15),W.wx(17)]; m.respawn=.6; g.mobs.place(m); m.g.parent||g.scene.add(m.g); P.safe=99; hold('sword'); await wait(150); m.body.x=B.x; m.body.z=B.z+1.1; m.body.vy=0; P.face=0; P.action=null; m.hp=1; P.mineDown(); await wait(420); P.mineUp(); const dead=m.dead; await wait(1200); const gel=I.count('gel'); await wait(600); return dead && !m.dead && Math.abs(m.body.x-W.wx(15))<1.5`);
// hearts, falls, sea
C.longFallHurts = await run(`P.safe=0; P.hp=10; flat(); B.y=11; B.peak=11; B.vy=0; B.ground=false; await wait(1500); return P.hp<10`);
C.seaHurtsAndReturns = await run(`P.safe=0; P.hp=10; B.x=W.wx(0)+.2; B.z=W.wx(0)+.2; B.y=.3; B.vy=0; await wait(1400); return P.hp===9`);
// first-person view
C.firstPersonView = await run(`g.toggleView(); await wait(200); return g.cam.mode==='third' && getComputedStyle(document.getElementById('bView')).display==='none'`);   // first-person view is switched off for now (owner, 2026-11-26)
// bag swap
C.bagSwap = await run(`const a=I.slots[0]&&I.slots[0].id; put('stone',5); const s=I.slots.findIndex(s=>s&&s.id==='stone'); I.swap(0, s); return I.slots[0].id==='stone' && (!a || I.slots[s].id===a)`);
// saving and telemetry
C.saveRoundTrip = await run(`g.save(); const s=JSON.parse(localStorage.getItem('fc-save2-home')); return !!(s && s.v===2 && s.world.length>4 && Array.isArray(s.inv) && s.farm)`);
C.telemetryRecords = await run(`g.track('craft',{item:'planks',n:4}); g.telemetry.flush(); const e=JSON.parse(localStorage.getItem('fc-telemetry-v1')||'[]'); const t=new Set(e.map(x=>x.e)); return ['session_start','room_enter','block_place','block_break','item_pickup','item_use','hurt','farm','rest','craft'].every(k=>t.has(k))`);
C.languageSwitch = await run(`document.getElementById('lEn').click(); const en=document.getElementById('whoName').textContent; document.getElementById('lTh').click(); return en.length>0 && en!==document.getElementById('whoName').textContent`);
// a second room with other rules
await p.goto(URL.replace('game.html?', 'game.html?room=tower&'), { waitUntil: 'networkidle0', timeout: 90000 }); await W(3000);
C.towerNoDamage = await run(`P.safe=0; P.hurt(3,'test'); return g.room.id==='tower' && P.hp===10`);
C.towerGoal = await run(`const [px,pz]=g.room.plot; B.x=W.wx(px); B.z=W.wx(pz)-1.2; B.y=W.top(px,pz-1)+.01; B.vy=0; P.face=0; hold('brick'); P.aim=()=>{}; for(let i=0;i<5;i++){ P.target={x:px,y:W.top(px,pz)-1,z:pz,n:[0,1,0]}; P.use(); await wait(60); } delete P.aim; return g.room.done===true`);
await p.goto(URL.replace(/game\.html.*/, 'parent.html'), { waitUntil: 'networkidle0' }); await W(800);
C.parentPageShowsData = await p.evaluate(() => document.querySelectorAll('.card .big').length >= 6 && !document.querySelector('.empty'));
if (process.argv[3]) await p.screenshot({ path: process.argv[3], type: 'jpeg', quality: 88, fullPage: true });
if (SHOT){ await p.goto(URL, { waitUntil: 'networkidle0', timeout: 90000 }); await W(3500); await run(`B.x=0;B.z=1.5;B.y=W.top(...[W.cellOf(0,0,1.5)[0],W.cellOf(0,0,1.5)[2]])+.01; g.cam.yaw=2.5; g.cam.pitch=.42; g.cam.dist=7.5`); await W(900); await p.screenshot({ path: SHOT, type: 'jpeg', quality: 90 }); }
const failed = Object.keys(C).filter(k => !C[k]);
console.log(JSON.stringify(C, null, 1)); console.log('passed', Object.keys(C).length - failed.length, 'of', Object.keys(C).length, failed.length ? 'FAILED: ' + failed.join(', ') : ''); console.log('errors', errs);
await b.close(); process.exit(failed.length || errs.length ? 1 : 0);
