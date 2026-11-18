import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as E from '../src/engine.js';
import {SAVE_KEY} from '../src/data.js';

const workerPattern='**/*offline-worker*.js*';

function fixture(seconds,stock){
 const now=Date.now(),state=E.newGame(now-seconds*1000);
 Object.assign(state.objects.find(o=>o.type==='server'),{foodId:'rice',stock});
 const expected=structuredClone(state),report=E.reconcileOffline(expected,now);
 return{raw:JSON.stringify(state),originalSavedAt:state.savedAt,expected:{coins:expected.coins,sold:expected.stats.sold,album:expected.album,stock:expected.objects.reduce((n,o)=>n+(o.stock||0),0),reportCoins:report.coins}};
}

async function seedOnce(page,raw,marker){
 await page.addInitScript(({key,raw,marker})=>{
  if(!sessionStorage.getItem(marker)){localStorage.setItem(key,raw);sessionStorage.setItem(marker,'1');}
 },{key:SAVE_KEY,raw,marker});
}

async function settled(page){
 await page.waitForFunction(()=>!!window.__BAMSONNIM__);
 await page.evaluate(()=>window.__BAMSONNIM__.pause());
 await page.waitForFunction(()=>window.__BAMSONNIM__.view.ready);
 return page.evaluate(key=>{
  const g=window.__BAMSONNIM__,saved=JSON.parse(localStorage.getItem(key));g.engine.validateSave(saved);
  return{coins:g.state.coins,sold:g.state.stats.sold,album:g.state.album,stock:g.state.objects.reduce((n,o)=>n+(o.stock||0),0),savedAt:saved.savedAt,paymentEvents:g.state.notifications.filter(n=>n.type==='payment').length,visualEffects:g.view.paymentEffects.length,dialogOpen:document.querySelector('dialog').open,dialogType:document.querySelector('dialog').className};
 },SAVE_KEY);
}

function checkSettlement(actual,expected){
 for(const key of ['coins','sold','album','stock'])assert.deepEqual(actual[key],expected[key],`Offline settlement ${key}`);
 assert.equal(actual.paymentEvents,0);assert.equal(actual.visualEffects,0);
 assert.equal(actual.dialogOpen,true);assert.equal(actual.dialogType,'offline');
}

async function heartbeat(page){
 return page.evaluate(async()=>{
  let ticks=0;const start=performance.now(),timer=setInterval(()=>ticks++,10);
  await new Promise(resolve=>setTimeout(resolve,100));clearInterval(timer);
  await new Promise(resolve=>requestAnimationFrame(resolve));
  return{ticks,elapsed:performance.now()-start,animationFrame:true};
 });
}

export async function verifyOfflineStartup(page,baseURL,output){
 const context=page.context(),initial=fixture(120,6);await seedOnce(page,initial.raw,'startup-held-seeded');
 let release,requests=0;const gate=new Promise(resolve=>release=resolve);
 const hold=async route=>{requests++;await gate;await route.continue().catch(()=>{});};
 await context.route(workerPattern,hold);
 let during;
 try{
  await page.goto(baseURL,{waitUntil:'commit'});
  await page.locator('.initial-settlement').waitFor({state:'visible'});
  assert.equal(await page.locator('.initial-settlement[role="status"], .initial-settlement [role="status"]').count(),1);
  await page.waitForFunction(()=>!window.__BAMSONNIM__);
  const pulse=await heartbeat(page);assert.ok(pulse.ticks>=2&&pulse.animationFrame);
  // Cross the regular five-second autosave interval while the worker is held.
  await page.waitForTimeout(5100);
  const raw=await page.evaluate(key=>localStorage.getItem(key),SAVE_KEY);
  assert.equal(raw,initial.raw,'Pending startup must preserve the entire original save');assert.ok(requests>0);
  during={workerRequests:requests,heartbeat:pulse,holdBeyondAutosaveMs:5100,originalPreserved:true,savedAt:JSON.parse(raw).savedAt};
  await page.screenshot({path:`${output}/startup-settlement-pending.png`});
 }finally{release();}
 const completed=await settled(page);checkSettlement(completed,initial.expected);assert.ok(completed.savedAt>initial.originalSavedAt);
 await page.screenshot({path:`${output}/startup-settlement-complete.png`});
 await page.reload({waitUntil:'networkidle'});const reloaded=await settled(page);
 for(const key of ['coins','sold','album','stock'])assert.deepEqual(reloaded[key],completed[key],`Reload never pays the old interval twice: ${key}`);
 await context.unroute(workerPattern,hold);

 const fallback=fixture(60,2);await seedOnce(page,fallback.raw,'startup-fallback-seeded');let aborted=0;
 const abort=route=>{aborted++;return route.abort();};await context.route(workerPattern,abort);
 await page.goto(baseURL,{waitUntil:'commit'});const fallbackResult=await settled(page);
 checkSettlement(fallbackResult,fallback.expected);assert.ok(aborted>0,'Fallback ran after a worker script network failure');
 await page.screenshot({path:`${output}/startup-worker-fallback.png`});await context.unroute(workerPattern,abort);

 // A controlled visibility event reproduces a 120-second background interval
 // without waiting two real minutes. This tests the production event handler;
 // physical browser/app backgrounding is a separate, unverified device check.
 await page.getByRole('button',{name:'창 닫기',exact:true}).click();
 await page.locator('[data-act="menu"]').focus();
 let resumeRelease,resumeRequests=0;const resumeGate=new Promise(resolve=>resumeRelease=resolve);
 const holdResume=async route=>{resumeRequests++;await resumeGate;await route.continue().catch(()=>{});};
 await context.route(workerPattern,holdResume);
 const resumeOriginal=await page.evaluate(key=>{
  const g=window.__BAMSONNIM__;Object.assign(g.state,g.engine.newGame());Object.assign(g.state.objects.find(o=>o.type==='server'),{foodId:'rice',stock:6});g.pause(false);
  window.__visibilityFixture=false;Object.defineProperty(document,'hidden',{configurable:true,get:()=>window.__visibilityFixture});
  const now=Date.now;Date.now=()=>now()-120000;window.__visibilityFixture=true;document.dispatchEvent(new Event('visibilitychange'));Date.now=now;
  const original=localStorage.getItem(key);window.__visibilityFixture=false;document.dispatchEvent(new Event('visibilitychange'));return original;
 },SAVE_KEY);
 let resumeDuring;
 try{
  await page.locator('.recovery-overlay[role="status"]').waitFor({state:'visible'});
  const before=await page.evaluate(()=>({inert:document.querySelector('#app').inert,time:window.__BAMSONNIM__.state.time,canvas:window.__BAMSONNIM__.view.canvas.toDataURL()}));
  const pulse=await heartbeat(page);await page.waitForTimeout(5100);
  const after=await page.evaluate(key=>({inert:document.querySelector('#app').inert,time:window.__BAMSONNIM__.state.time,canvas:window.__BAMSONNIM__.view.canvas.toDataURL(),raw:localStorage.getItem(key),dialogOpen:document.querySelector('dialog').open}),SAVE_KEY);
  assert.ok(before.inert&&after.inert);assert.equal(after.time,before.time);assert.equal(after.canvas,before.canvas,'Canvas drawing is suspended during recovery');
  assert.equal(after.raw,resumeOriginal,'Background recovery preserves the saved interval while pending');assert.ok(pulse.ticks>=2);assert.equal(after.dialogOpen,false);
  // Repeated hide/return while recovery is pending must not create another UI
  // recovery or write over the first interval before it finishes.
  await page.evaluate(()=>{window.__visibilityFixture=true;document.dispatchEvent(new Event('visibilitychange'));window.__visibilityFixture=false;document.dispatchEvent(new Event('visibilitychange'));});
  assert.equal(await page.locator('.recovery-overlay').count(),1);
  assert.equal(await page.evaluate(key=>localStorage.getItem(key),SAVE_KEY),resumeOriginal);
  resumeDuring={workerRequests:resumeRequests,heartbeat:pulse,inert:true,originalPreserved:true,gameTimeFrozen:true,canvasFrozen:true,repeatedReturnOverlayCount:1};
  await page.screenshot({path:`${output}/resume-settlement-pending.png`});
 }finally{resumeRelease();}
 await page.locator('.recovery-overlay').waitFor({state:'hidden'});const resumed=await settled(page);
 checkSettlement(resumed,initial.expected);assert.equal(await page.locator('#app').evaluate(app=>app.inert),false);
 await page.screenshot({path:`${output}/resume-settlement-complete.png`});await context.unroute(workerPattern,holdResume);
 await page.getByRole('button',{name:'창 닫기',exact:true}).click();
 const focusRestored=await page.evaluate(()=>document.activeElement?.dataset.act==='menu');assert.equal(focusRestored,true,'Closing the offline report restores the previous trigger');
 await page.evaluate(()=>{delete document.hidden;});

 // Short smoke after the state swap: menu, cookbook and a real cooking action.
 await page.locator('[data-act="menu"]').click();await page.locator('dialog [data-act="cookbook"]').click();
 await page.locator('[data-act="cook"][data-id="rice"]').click();
 assert.ok(await page.evaluate(()=>window.__BAMSONNIM__.state.objects.some(o=>o.cook?.foodId==='rice')));
 const result={initial:{during,completed,reloaded},fallback:{aborted,completed:fallbackResult},resume:{during:resumeDuring,completed:resumed,focusRestored,visibility:'simulated event; physical device backgrounding not verified'},smoke:{menu:true,cookbook:true,cooking:true}};
 await fs.writeFile(`${output}/startup-results.json`,JSON.stringify(result,null,2));return result;
}
