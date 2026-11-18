import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium} from 'playwright';
import {runExtendedChecks} from './browser-extended.mjs';

const baseURL=process.env.BASE_URL||'http://127.0.0.1:5173';
const output=process.env.BROWSER_OUTPUT||'artifacts/browser';await fs.mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true});
const results=[];
async function settle(page){await page.waitForFunction(()=>!!window.__BAMSONNIM__&&window.__BAMSONNIM__.view.ready);await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));}
async function activate(page,selector,touch,first=false){const loc=first?page.locator(selector).first():page.locator(selector);if(touch)await loc.tap();else await loc.click();}
async function tile(page,x,y,touch){const p=await page.evaluate(([x,y])=>{const p=window.__BAMSONNIM__.view.world(x,y),r=document.querySelector('#world').getBoundingClientRect();return{x:p.x+r.x,y:p.y+r.y};},[x,y]);if(touch)await page.touchscreen.tap(p.x,p.y);else await page.mouse.click(p.x,p.y);}
async function selectObject(page,uid,touch){await settle(page);const hit=await page.evaluate(uid=>window.__BAMSONNIM__.view.hits.filter(h=>h.kind==='object'&&h.uid===uid).at(-1),uid);assert.ok(hit,'Object must have a rendered hit area');const rect=await page.locator('#world').boundingBox(),x=rect.x+hit.x+hit.w*.5,y=rect.y+hit.y+hit.h*.45;if(touch)await page.touchscreen.tap(x,y);else await page.mouse.click(x,y);assert.equal(await page.evaluate(()=>window.__BAMSONNIM__.edit.ghost?.existing),uid);}
async function moveToConfirm(page){const b=await page.locator('[data-act="place"]').boundingBox();await page.mouse.move(b.x+b.width/2,b.y+b.height/2,{steps:30});}
try{
 for(const touch of [false,true]){
  const context=await browser.newContext({viewport:touch?{width:844,height:390}:{width:1280,height:800},isMobile:touch,hasTouch:touch});
  const page=await context.newPage(),errors=[];await page.addInitScript(()=>{window.__testPointers=[];document.addEventListener('pointerdown',event=>window.__testPointers.push(event.pointerType),true);});page.on('pageerror',e=>errors.push(e.message));await page.goto(baseURL,{waitUntil:'networkidle'});await settle(page);
  await activate(page,'[data-act="decorate"]',touch);await settle(page);
  await activate(page,'[data-act="buy-furniture"][data-id="table"]',touch);await tile(page,3,6,touch);if(!touch)await moveToConfirm(page);
  assert.deepEqual(await page.evaluate(()=>[window.__BAMSONNIM__.edit.ghost.x,window.__BAMSONNIM__.edit.ghost.y]),[3,6]);
  await activate(page,'[data-act="place"]',touch);let table=await page.evaluate(()=>window.__BAMSONNIM__.state.objects.find(o=>o.type==='table'&&o.x===3&&o.y===6));assert.ok(table);
  await selectObject(page,table.uid,touch);await activate(page,'[data-act="rotate"]',touch);assert.equal(await page.evaluate(()=>window.__BAMSONNIM__.edit.ghost.dir),1);await tile(page,4,6,touch);if(!touch)await moveToConfirm(page);await activate(page,'[data-act="place"]',touch);assert.deepEqual(await page.evaluate(uid=>{const o=window.__BAMSONNIM__.state.objects.find(o=>o.uid===uid);return[o.x,o.y,o.dir];},table.uid),[4,6,1]);
  await selectObject(page,table.uid,touch);await activate(page,'[data-act="store"]',touch);assert.ok(await page.evaluate(()=>window.__BAMSONNIM__.state.storage.includes('table')));
  const before=await page.evaluate(()=>window.__BAMSONNIM__.state.coins);await activate(page,'[data-act="shop-tab"][data-id="storage"]',touch);await activate(page,'[data-act="buy-furniture"][data-id="table"]',touch);await tile(page,4,6,touch);if(!touch)await moveToConfirm(page);await activate(page,'[data-act="place"]',touch);assert.equal(await page.evaluate(()=>window.__BAMSONNIM__.state.coins),before);table=await page.evaluate(()=>window.__BAMSONNIM__.state.objects.find(o=>o.type==='table'&&o.x===4&&o.y===6));
  await selectObject(page,table.uid,touch);await activate(page,'[data-act="sell"]',touch);assert.equal(await page.locator('dialog').evaluate(d=>d.open),true);await activate(page,'[data-act="confirm"]',touch);assert.equal(await page.evaluate(()=>window.__BAMSONNIM__.state.coins),before+50);
  await activate(page,'[data-act="shop-tab"][data-id="table"]',touch);await activate(page,'[data-act="buy-furniture"]',touch,true);await tile(page,2,4,touch);assert.equal(await page.locator('[data-act="place"]').isDisabled(),true);await activate(page,'[data-act="cancel-placement"]',touch);await page.screenshot({path:`${output}/placement-${touch?'touch':'mouse'}.png`});
  await activate(page,'[data-act="finish-edit"]',touch);await activate(page,'[data-act="cookbook"]',touch,true);await activate(page,'[data-act="book-open"][data-n="0"]',touch);await activate(page,'[data-act="cook"]',touch,true);await page.evaluate(()=>window.__BAMSONNIM__.advance(12));await settle(page);
  // Real canvas DONE click, not a direct collect() invocation.
  const done=await page.evaluate(()=>{const g=window.__BAMSONNIM__,o=g.state.objects.find(o=>o.type==='stove'&&o.cook);return g.view.hits.filter(h=>h.uid===o.uid).at(-1);});const rect=await page.locator('#world').boundingBox();if(touch)await page.touchscreen.tap(rect.x+done.x+done.w/2,rect.y+done.y+12);else await page.mouse.click(rect.x+done.x+done.w/2,rect.y+done.y+12);
  await page.evaluate(()=>window.__BAMSONNIM__.advance(90));assert.ok(await page.evaluate(()=>window.__BAMSONNIM__.state.stats.sold)>0);assert.ok(await page.evaluate(()=>window.__BAMSONNIM__.state.album.wanderer)>0);const pointerTypes=await page.evaluate(()=>window.__testPointers);assert.ok(pointerTypes.length>0);assert.ok(pointerTypes.every(type=>type===(touch?'touch':'mouse')));await page.reload({waitUntil:'networkidle'});await settle(page);assert.ok(await page.evaluate(()=>window.__BAMSONNIM__.state.album.wanderer)>0);assert.deepEqual(errors,[]);results.push({environment:touch?'844×390 touch':'1280×800 mouse',placement:true,rotation:true,move:true,storage:true,reuseWithoutCharge:true,saleConfirmation:true,invalidPlacementBlocked:true,cooking:true,onlineRegistration:true,persistence:true,pointerTypes:[...new Set(pointerTypes)],pointerEvents:pointerTypes.length,errors});await context.close();
 }
 await runExtendedChecks(browser,baseURL,output,results);
 const page=await browser.newPage();await page.goto(baseURL,{waitUntil:'networkidle'});await settle(page);
 if(process.env.RUN_AUDIO==='1'){
 const audio=await page.evaluate(async()=>{
  const {Sound}=await import('/src/audio.js');const summaries=[];
  for(const mode of ['normal','danger','fever']){
   const seconds=mode==='normal'?136:18,context=new OfflineAudioContext(2,44100*seconds,44100),sound=new Sound();sound.setup(context);sound.renderScore(seconds-1,mode);const buffer=await context.startRendering();let peak=0,power=0,nans=0;const d=buffer.getChannelData(0);for(let i=0;i<d.length;i++){if(!Number.isFinite(d[i]))nans++;peak=Math.max(peak,Math.abs(d[i]));power+=d[i]*d[i];}summaries.push({mode,seconds,peak,rms:Math.sqrt(power/d.length),nonFiniteSamples:nans});
  }return summaries;
 });for(const a of audio){assert.equal(a.nonFiniteSamples,0);assert.ok(a.peak>0&&a.peak<1);assert.ok(a.rms>.0001);}results.push({audio});
 }else results.push({audio:'full background soundtrack not rerun; coin effect and music mute checked separately; set RUN_AUDIO=1 for full render'});
 await fs.writeFile(`${output}/results.json`,JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));
}catch(error){await fs.writeFile(`${output}/results.json`,JSON.stringify({completed:results,failure:error.stack},null,2));throw error;}finally{await browser.close();}
