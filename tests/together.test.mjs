// Two devices on one island, through the home Wi-Fi relay in serve.mjs. Run: node tests/together.test.mjs [shot.jpg]
import puppeteer from '/Users/familyjourney/.claude/skills/style-atlas/scripts/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js';
const BASE = process.env.BASE || 'http://localhost:8787/', SHOT = process.argv[2];
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu'] });
const errs = [];
async function open(url){ const ctx = await b.createBrowserContext(); const p = await ctx.newPage(); await p.setViewport({ width: 900, height: 560, deviceScaleFactor: 1 });
  p.on('pageerror', e => errs.push(String(e))); p.on('response', r => { if (r.status() >= 400 && !/favicon|audio\/bgm/.test(r.url())) errs.push(r.status() + ' ' + r.url()); });
  await p.goto(url, { waitUntil: 'networkidle0', timeout: 90000 }); await new Promise(r => setTimeout(r, 3500)); return p; }
const W = ms => new Promise(r => setTimeout(r, ms));
const run = (p, code) => p.evaluate(new Function('return (async()=>{const g=window.__g, P=g.player, B=P.body, W=g.world, I=g.inv, N=g.net, BL=Object.fromEntries((await import("./engine/world/voxel.js")).BLOCKS.map((b,i)=>[b.id,i])); const wait=ms=>new Promise(r=>setTimeout(r,ms)); const hold=id=>{ let s=I.slots.findIndex(s=>s&&s.id===id); if(s<0){ I.add(id,5,true); s=I.slots.findIndex(s=>s&&s.id===id); } if(s>=6){ I.swap(s,0); s=0; } I.select(s); }; const stand=(x,z)=>{ B.x=W.wx(x); B.z=W.wx(z); B.y=W.top(x,z)+.01; B.vy=0; P.face=0; }; ' + code + '})()'));
const A = await open(BASE + 'game.html?debug&fresh&skin=c'), Bp = await open(BASE + 'game.html?debug&fresh&skin=c');
const C = {};
await run(A, `g.mobs.list.forEach(m=>{ g.mobs.kill(m); m.wait=1e9; })`);
const code = await run(A, `await N.make(); return N.code`);
await run(Bp, `await N.join('${code}')`); await W(2500);
C.bothConnected = (await run(A, `return N.status`)) === 'together' && (await run(Bp, `return N.status`)) === 'together';
C.viaHomeWifi = (await run(A, `return N.via`)) === 'wifi';
C.guestGotHostIsland = (await run(A, `return W.save().join()`)) === (await run(Bp, `return W.save().join()`));
await run(A, `stand(15,13)`); await W(900);
C.hostSeenOnGuest = await run(Bp, `const r=[...N.remotes.values()][0]; return !!r && Math.hypot(r.pos.x-W.wx(15), r.pos.z-W.wx(13))<.3 && !!r.model`);
await run(Bp, `stand(13,13)`); await W(900);
C.guestSeenOnHost = await run(A, `const r=[...N.remotes.values()][0]; return !!r && Math.hypot(r.pos.x-W.wx(13), r.pos.z-W.wx(13))<.3`);
C.nameTagShown = await run(A, `const t=document.querySelector('.nametag'); return !!t && t.textContent.length>0`);
// a placed block shows on the other device
const placed = await run(A, `hold('planks'); const y=W.top(15,14); P.aim=()=>{}; P.target={x:15,y:y-1,z:14,n:[0,1,0]}; P.use(); delete P.aim; return [15,y,14]`); await W(800);
C.hostBlockOnGuest = await run(Bp, `return W.get(${placed[0]},${placed[1]},${placed[2]})===BL.planks`);
// a dug block disappears on the other device, its drop is shared, and the pickup removes it everywhere
const dug = await run(Bp, `const tb=W.topBlock(13,14); P.breakBlock({x:13,y:tb.y,z:14,n:[0,1,0]}, (await import('./engine/world/voxel.js')).BLOCKS[tb.b], true); return [13,tb.y,14]`); await W(250);
C.dropSeenOnHost = await run(A, `return g.drops.list.length`) > 0; await W(550);
C.guestDigOnHost = await run(A, `return W.get(${dug[0]},${dug[1]},${dug[2]})===0`);
await W(1800); C.pickupRemovesEverywhere = (await run(A, `return g.drops.list.filter(d=>!d.uid.startsWith(N.id)).length`)) === 0;
// farming is shared
await run(A, `hold('hoe'); const y=W.top(16,13)-1; P.aim=()=>{}; P.target={x:16,y,z:13,n:[0,1,0]}; P.use(); hold('seeds'); P.use(); hold('can'); P.use(); delete P.aim`); await W(900);
C.farmSharedToGuest = await run(Bp, `const y=W.top(16,13)-1; return W.get(16,y,13)===BL.farmwet && !!g.farm.at(16,y,13)`);
// stars are shared
// collectible stars are out of the home island for now (owner, 2026-11-26); both sides must agree there are none
C.starSharedToHost = (await run(A, `return g.room.meshes.length`)) === 0 && (await run(Bp, `return g.room.meshes.length`)) === 0;
// critters run on the host; a guest's sword cut counts there; the respawn shows on both
await run(A, `const m=g.mobs.list[0]; m.spawn=[18,13]; m.home=[W.wx(18),W.wx(13)]; m.respawn=4; g.mobs.place(m)`); await W(900);
await run(Bp, `const m=g.mobs.list[0]; hold('sword'); P.safe=99; B.x=m.body.x; B.z=m.body.z-1.1; B.y=m.body.y; B.vy=0; P.face=0; P.action=null; P.mineDown(); await wait(450); P.mineUp()`); await W(400);
C.guestHitKillsOnHost = await run(A, `return g.mobs.list[0].dead`);
C.deathSyncedToGuest = await run(Bp, `return g.mobs.list[0].dead`);
await W(4200); C.respawnSyncedToGuest = await run(Bp, `return !g.mobs.list[0].dead`);
C.guestDoesNotSave = await run(Bp, `const before=localStorage.getItem('fc-save2-home'); g.save(); return localStorage.getItem('fc-save2-home')===before`);
if (SHOT){ await W(300); await A.screenshot({ path: SHOT.replace('.jpg', '-host.jpg'), type: 'jpeg', quality: 85 }); await Bp.screenshot({ path: SHOT.replace('.jpg', '-guest.jpg'), type: 'jpeg', quality: 85 }); }
await run(Bp, `N.leave()`); await W(1200);
C.leaveNoticed = (await run(A, `return N.status`)) === 'waiting';
const failed = Object.keys(C).filter(k => !C[k]);
console.log(JSON.stringify(C, null, 1)); console.log('passed', Object.keys(C).length - failed.length, 'of', Object.keys(C).length, failed.length ? 'FAILED: ' + failed.join(', ') : ''); console.log('errors', errs);
await b.close(); process.exit(failed.length || errs.length ? 1 : 0);
