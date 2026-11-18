import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {verifyOfflineStartup} from './browser-startup.mjs';

// Each check owns a fresh browser storage context. Fixture changes are local to
// that context; actual serving, transactions, registration and cleaning use the
// production engine, and input regressions use real browser input events.
export async function runExtendedChecks(browser,baseURL,output,results){
 const failures=[];
 async function check(name,run,options={}){
  if(process.env.BROWSER_CHECK&&!new RegExp(process.env.BROWSER_CHECK).test(name))return;
  console.log(`[browser] ${name}: start`);
  const context=await browser.newContext({viewport:{width:1280,height:800},...options});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  try{
   const evidence=await run(page);
   assert.deepEqual(errors,[],'No uncaught browser errors');
   results.push({check:name,passed:true,...evidence});console.log(`[browser] ${name}: passed`);
   await page.screenshot({path:`${output}/${name}.png`});
  }catch(error){
   failures.push(`${name}: ${error.message}`);console.log(`[browser] ${name}: FAILED ${error.message}`);
   results.push({check:name,passed:false,error:error.stack,errors});
   await page.screenshot({path:`${output}/${name}-failure.png`}).catch(()=>{});
  }finally{await context.close();}
 }
 async function ready(page){
  await page.goto(baseURL,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>window.__BAMSONNIM__?.view.ready);
  await page.evaluate(()=>document.fonts.ready);
 }

 await check('offline-startup-worker',page=>verifyOfflineStartup(page,baseURL,output));

 for(const touch of [false,true])await check(`table-required-chair-${touch?'touch':'mouse'}`,async page=>{
  await ready(page);
  const activate=async locator=>touch?locator.tap():locator.click();
  // Remove tables through real UI: chairs become decoration. Restoring the tables re-enables a complete meal.
  await activate(page.locator('[data-act="decorate"]'));
  const tables=await page.evaluate(()=>window.__BAMSONNIM__.state.objects.filter(o=>o.type==='table').map(o=>({...o})));
  for(const {uid} of tables){
   if(!await page.locator('#keyboard-placement').evaluate(el=>el.open))await activate(page.locator('#keyboard-placement summary'));
   await page.locator('#furniture-select').selectOption(uid);
   await activate(page.locator('[data-act="store"]'));
  }
  await activate(page.locator('[data-act="finish-edit"]'));
  await activate(page.locator('[data-act="cookbook"]').first());
  await activate(page.locator('[data-act="book-open"][data-n="0"]'));
  await activate(page.locator('[data-act="cook"]').first());
  await page.evaluate(()=>{const g=window.__BAMSONNIM__;g.pause();g.advance(12);});
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  const point=await page.evaluate(()=>{const g=window.__BAMSONNIM__,o=g.state.objects.find(o=>o.cook),h=g.view.hits.filter(h=>h.uid===o.uid).at(-1),r=g.view.canvas.getBoundingClientRect();return{x:r.x+h.x+h.w/2,y:r.y+h.y+12};});
  if(touch)await page.touchscreen.tap(point.x,point.y);else await page.mouse.click(point.x,point.y);
  assert.equal(await page.evaluate(()=>window.__BAMSONNIM__.state.objects.find(o=>o.cook)?.cook.collecting),true,'DONE starts physical transfer');
  const unpaired=await page.evaluate(()=>{const g=window.__BAMSONNIM__;g.advance(60);return{seats:g.engine.seats(g.state).length,sold:g.state.stats.sold,stock:g.state.objects.reduce((n,o)=>n+(o.stock||0),0),seated:g.state.customers.filter(c=>['seating','waiting','eating'].includes(c.phase)).length};});
  assert.equal(unpaired.seats,0);assert.equal(unpaired.sold,0);assert.equal(unpaired.seated,0);assert.ok(unpaired.stock>0,'Food is present while tableless chairs remain inactive');
  await activate(page.locator('[data-act="decorate"]'));
  for(const table of tables){
   await activate(page.locator('[data-act="shop-tab"][data-id="storage"]'));
   await activate(page.locator('[data-act="buy-furniture"][data-id="table"]'));
   if(!await page.locator('#keyboard-placement').evaluate(el=>el.open))await activate(page.locator('#keyboard-placement summary'));
   await page.locator('[data-coordinate="x"]').fill(String(table.x+1));await page.locator('[data-coordinate="y"]').fill(String(table.y+1));
   await activate(page.locator('[data-act="place"]'));
  }
  await activate(page.locator('[data-act="finish-edit"]'));
  const trace=await page.evaluate(()=>{
   const g=window.__BAMSONNIM__,trace=[],seen=new Set(),snapshots={};
   const capture=name=>{if(!snapshots[name]){g.view.draw(g.state,null,g.state.time,false);snapshots[name]=g.view.canvas.toDataURL('image/png');}};
   let paidChair=null,sawDirty=false,cleaned=false;
   for(let i=0;i<960;i++){
    g.engine.advance(g.state,.25);
    for(const c of g.state.customers){
     const k=`${c.uid}:${c.phase}`;
     if(['waiting','eating'].includes(c.phase))capture(c.phase);
     if(!seen.has(k)){seen.add(k);trace.push({time:g.state.time,guest:c.uid,phase:c.phase,seat:c.seat,sold:g.state.stats.sold,album:{...g.state.album}});}
    }
    const dirty=g.state.objects.find(o=>o.type==='chair'&&o.dirty);
    if(dirty){paidChair=dirty.uid;sawDirty=true;capture('paid-dirty');}
    if(sawDirty&&!g.state.objects.find(o=>o.uid===paidChair)?.dirty){cleaned=true;capture('cleaned');break;}
   }
   return{snapshots,trace,seats:g.engine.seats(g.state).length,tables:g.state.objects.filter(o=>o.type==='table').length,served:g.state.stats.served,sold:g.state.stats.sold,album:g.state.album,sawDirty,cleaned};
  });
  const screens=[];for(const [phase,data] of Object.entries(trace.snapshots)){const file=`${output}/table-required-${touch?'touch':'mouse'}-${phase}.png`;await fs.writeFile(file,Buffer.from(data.split(',')[1],'base64'));screens.push(file);}delete trace.snapshots;trace.screens=screens;
  trace.unpaired=unpaired;assert.equal(trace.tables,tables.length);assert.equal(trace.seats,4);
  for(const phase of ['seating','waiting','eating','leaving'])assert.ok(trace.trace.some(x=>x.phase===phase),`Observed ${phase}`);
  assert.ok(trace.trace.filter(x=>x.sold===0).every(x=>!x.album.wanderer),'No registration before payment');
  assert.ok(trace.served>0&&trace.sold>0&&trace.album.wanderer>0);
  assert.ok(trace.sawDirty&&trace.cleaned,'Paid seat becomes dirty and worker cleans it');
  return trace;
 },touch?{viewport:{width:844,height:390},isMobile:true,hasTouch:true}:{});

 await check('keyboard-placement',async page=>{
  await ready(page);
  await page.locator('[data-act="decorate"]').focus();await page.keyboard.press('Enter');
  await page.locator('#keyboard-placement summary').focus();await page.keyboard.press('Enter');
  // macOS headless Chromium cannot operate its native select popup with arrows
  // (also reproduced on a minimal HTML select). Select through Playwright, then
  // exercise the game's complete canvas keyboard path without pointer input.
  await page.locator('#furniture-select').focus();
  const uid=await page.locator('#furniture-select option').nth(1).getAttribute('value');
  await page.locator('#furniture-select').selectOption(uid);
  const before=await page.evaluate(()=>({...window.__BAMSONNIM__.edit.ghost}));
  assert.ok(before.existing,'Native select change chooses an existing object');
  assert.equal(await page.evaluate(()=>document.activeElement.id),'world');
  await page.keyboard.press('ArrowRight');await page.keyboard.press('ArrowDown');await page.keyboard.press('r');
  const selected=await page.evaluate(()=>({...window.__BAMSONNIM__.edit.ghost}));
  assert.equal(selected.x,before.x+1);assert.equal(selected.y,before.y+1);assert.equal(selected.dir,(before.dir+1)%4);
  assert.equal(await page.locator('[data-act="place"]').isDisabled(),false);
  await page.keyboard.press('Enter');
  const placed=await page.evaluate(uid=>window.__BAMSONNIM__.state.objects.find(o=>o.uid===uid),before.existing);
  assert.deepEqual([placed.x,placed.y,placed.dir],[selected.x,selected.y,selected.dir]);
  await page.locator('#furniture-select').selectOption(placed.uid);await page.keyboard.press('Escape');
  assert.equal(await page.evaluate(()=>window.__BAMSONNIM__.edit.ghost),null);
  await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>window.__BAMSONNIM__.edit),null);
  return{before,placed,cancelled:true,selectionMethod:'Playwright selectOption; native popup keyboard selection is not verified in macOS headless Chromium',keyboardVerified:['open placement menu','ArrowRight','ArrowDown','R','Enter','Escape']};
 });

 await check('stove-focus',async page=>{
  await ready(page);
  const button=page.locator('#stove-a11y button').first();await button.focus();
  await page.evaluate(()=>window.__focusedStove=document.activeElement);
  await page.waitForTimeout(1200);
  const focus=await page.evaluate(()=>({same:document.activeElement===window.__focusedStove,connected:window.__focusedStove.isConnected,label:document.activeElement.textContent}));
  assert.ok(focus.same&&focus.connected,'HUD updates preserve the original focused button');
  assert.doesNotMatch(focus.label,/\b(empty|cooking|done|spoiled|collecting)\b/);
  await page.keyboard.press('Enter');await page.waitForFunction(()=>document.querySelector('dialog').open);
  return focus;
 });

 await check('initial-click-delayed-image',async page=>{
  let release;const gate=new Promise(resolve=>release=resolve);let held=0;
  await page.route('**/assets/food.png',async route=>{held++;await gate;await route.continue();});
  await page.goto(baseURL,{waitUntil:'domcontentloaded'});
  try{
   await page.waitForFunction(()=>!!window.__BAMSONNIM__);
   assert.equal(await page.evaluate(()=>window.__BAMSONNIM__.view.ready),false);
   await page.locator('[data-act="cookbook"]').first().click();
   await page.waitForFunction(()=>document.querySelector('dialog').open,{},{timeout:2000});
   assert.ok(held>0);return{imagePending:true,cookbookOpened:true};
  }finally{release();await page.waitForFunction(()=>window.__BAMSONNIM__.view.ready);}
 });

 await check('image-failure',async page=>{
  await page.route('**/assets/food.png',route=>route.abort());
  await ready(page);
  const failed=await page.evaluate(()=>window.__BAMSONNIM__.view.failedAssets);
  assert.ok(failed.length>0,'Image failure is recorded');
  assert.equal(await page.locator('#asset-status').isVisible(),true);
  assert.equal(await page.locator('[data-act="retry-assets"]').isVisible(),true);
  await page.screenshot({path:`${output}/image-failure-before-retry.png`});
  await page.locator('[data-act="cookbook"]').first().click();
  assert.equal(await page.locator('dialog').evaluate(d=>d.open),true);
  await page.locator('dialog [data-act="close"]').click();
  await page.unroute('**/assets/food.png');
  await page.locator('[data-act="retry-assets"]').click();
  await page.waitForFunction(()=>window.__BAMSONNIM__.view.ready&&window.__BAMSONNIM__.view.failedAssets.length===0);
  assert.equal(await page.locator('#asset-status').isVisible(),false);
  return{failed,inputResponsive:true,retryRecovered:true};
 });

 await check('directional-sprites',async page=>{
  await ready(page);await page.evaluate(()=>window.__BAMSONNIM__.pause());
  const liveWalk=await page.evaluate(async()=>{
   const {directionalCharacter}=await import('/src/assets.js'),meta=directionalCharacter('wanderer'),g=window.__BAMSONNIM__,v=g.view,original=v.sprite,frames=new Set(),count=meta.walkFrames||meta.frames.walk.length,sequence=meta.sequence||meta.frames.walk;
   // A real seating mission keeps the SE route valid. A leaving actor already
   // at the entrance should correctly exit instead of obeying an arbitrary path.
   const chair={uid:'live-walk-chair',type:'chair',x:7,y:6,dir:3},table={uid:'live-walk-table',type:'table',x:7,y:5,dir:0};g.state.objects.push(chair,table);g.state.spawnIn=10000;
   const actor={uid:'live-walk-check',zombieId:'wanderer',x:0,y:6,phase:'seating',path:Array.from({length:7},(_,i)=>[i+1,6]),seat:chair.uid,wait:0};g.state.customers=[actor];
   v.sprite=function(key,index,...args){if(key===meta.key)frames.add(index);return original.call(this,key,index,...args);};
   g.pause(false);
   try{await new Promise(resolve=>setTimeout(resolve,(sequence.length/(meta.fps||7)*2+.15)*1000));}finally{g.pause();v.sprite=original;}
   const result={key:meta.key,count,sequence,fps:meta.fps,frames:[...frames].sort((a,b)=>a-b),moved:actor.x>0,x:actor.x};g.state.customers=[];g.state.objects=g.state.objects.filter(o=>o.uid!==chair.uid&&o.uid!==table.uid);return result;
  });
  assert.equal(liveWalk.count,3,'Three actual pictures per direction');assert.deepEqual(liveWalk.sequence,[0,1,0,2]);assert.equal(liveWalk.fps,7);assert.equal(liveWalk.moved,true);assert.deepEqual(liveWalk.frames,Array.from({length:liveWalk.count},(_,i)=>i),'Actual game movement cycles every registered SE walk frame');
  const evidence=await page.evaluate(async()=>{
   const {directionalCharacter}=await import('/src/assets.js'),meta=directionalCharacter('wanderer'),count=meta.walkFrames||meta.frames.walk.length,sequence=meta.sequence||meta.frames.walk,g=window.__BAMSONNIM__,v=g.view,s=g.state,atlas=v.sprites[meta.key]||[],original=v.sprite;
   const directions=[[1,0],[0,1],[-1,0],[0,-1]],walk=[],sit=[],paused=[];
   function draw(actor,time,active=true){
    const calls=[];s.time=time;s.fraction=0;
    v.sprite=function(key,index,...args){calls.push({key,index,flip:args.at(-1)?.flip});return original.call(this,key,index,...args);};
    try{v.drawPerson(s,actor,false,time,active);}finally{v.sprite=original;}
    return calls.find(x=>x.key===meta.key)||calls[0];
   }
   for(let dir=0;dir<4;dir++){
    const [dx,dy]=directions[dir],actor={uid:`direction-${dir}`,zombieId:'wanderer',x:3,y:3,phase:'leaving',path:[[3+dx*2,3+dy*2]],wait:0};
    const frames=[];draw(actor,10);
    for(let f=0;f<sequence.length*2;f++){actor.x+=dx*.05;actor.y+=dy*.05;frames.push(draw(actor,10+(f+.2)/(meta.fps||7)));}
    walk.push({dir,frames});paused.push([draw(actor,20,false),draw(actor,21,false)]);
    const chair=s.objects.find(o=>o.type==='chair');chair.dir=dir;
    sit.push({dir,waiting:draw({...actor,path:[],phase:'waiting',seat:chair.uid},30),eating:draw({...actor,path:[],phase:'eating',seat:chair.uid,foodId:'rice'},30)});
   }
   return{key:meta.key,count,sequence,poses:meta.poses,walk,sit,paused,tiles:atlas.map(c=>({width:c.width,height:c.height,opaque:c.getContext('2d').getImageData(0,0,c.width,c.height).data.some((n,i)=>i%4===3&&n>80)}))};
  });
  assert.equal(evidence.tiles.length,4*(evidence.count+1),'Registered walk frames and one sitting pose per direction');
  assert.ok(evidence.tiles.every((t,i)=>{const p=evidence.poses[i],source=p.source||p;return t.opaque&&t.width===source.width&&t.height===source.height;}),'Each frame uses its own declared source bounds and has visible pixels');
  for(const {dir,frames} of evidence.walk){assert.deepEqual(frames.map(f=>f.key),Array(evidence.sequence.length*2).fill(evidence.key));assert.deepEqual(frames.map(f=>f.index),[...evidence.sequence,...evidence.sequence].map(f=>dir*(evidence.count+1)+f),'Two exact 0,1,0,2 cycles, including repeated neutral pose');assert.ok(frames.every(f=>!f.flip),'Separate direction artwork is not mirrored');}
  for(const {dir,waiting,eating} of evidence.sit)for(const frame of [waiting,eating]){assert.equal(frame.key,evidence.key);assert.equal(frame.index,dir*(evidence.count+1)+evidence.count);}
  for(const pair of evidence.paused)assert.deepEqual(pair[0],pair[1],'Paused actor does not cycle frames');
  evidence.chairFrames=await page.evaluate(async()=>{
   const {furnitureArt}=await import('/src/furniture-placement.js');const g=window.__BAMSONNIM__,v=g.view,original=v.sprite,frames=[];
   for(let dir=0;dir<4;dir++){
    v.sprite=function(key,index,...args){const art=furnitureArt('chair',dir);if(key===art.key)frames.push({dir,key,index,expected:art.index});return original.call(this,key,index,...args);};
    try{v.drawObject(g.state,{uid:`chair-frame-${dir}`,type:'chair',x:3,y:3,dir},0,null);}finally{v.sprite=original;}
   }return frames;
  });
  assert.equal(evidence.chairFrames.length,4);assert.deepEqual(evidence.chairFrames.map(frame=>frame.index),evidence.chairFrames.map(frame=>frame.expected),'Chair directions use the selected metadata mapping');
  return{...evidence,liveWalk};
 });

 await check('reduced-motion-canvas',async page=>{
  await ready(page);await page.emulateMedia({reducedMotion:'reduce'});
  const evidence=await page.evaluate(()=>{
   const g=window.__BAMSONNIM__,v=g.view,s=g.state;g.pause();
   const stoves=s.objects.filter(o=>o.type==='stove');g.engine.cook(s,stoves[0].uid,'rice');g.engine.cook(s,stoves[1].uid,'rice');
   stoves[0].cook.readyAt=s.time;stoves[0].cook.spoilAt=s.time+999;
   s.customers.push({uid:'motion-check',zombieId:'wanderer',x:3,y:4,path:[[4,4]],phase:'leaving',wait:0});
   const pixels=clock=>{v.draw(s,null,clock,false);return v.ctx.getImageData(0,0,v.canvas.width,v.canvas.height).data;};
   const a=pixels(10),b=pixels(10.6);let changed=0;
   for(let i=0;i<a.length;i++)if(a[i]!==b[i])changed++;
   return{changedChannels:changed,simulationTime:s.time,includes:['DONE','cooking steam','fireflies','waiter bob','walking guest']};
  });
  assert.equal(evidence.changedChannels,0,'Reduced motion keeps decorative Canvas pixels static while gameplay is paused');
  return evidence;
 });

 await check('persistent-errors-and-shop-limits',async page=>{
  await ready(page);
  await page.locator('#save-file').setInputFiles({name:'invalid-save.json',mimeType:'application/json',buffer:Buffer.from('{bad json')});
  const error=page.locator('.toast.danger');await error.waitFor({state:'visible'});
  await page.waitForTimeout(4700);
  assert.equal(await error.isVisible(),true,'Error remains past the former 4.4-second timeout');
  await page.screenshot({path:`${output}/persistent-error.png`});
  await error.getByRole('button',{name:'오류 알림 닫기'}).click();assert.equal(await error.count(),0);
  await page.locator('[data-act="decorate"]').click();await page.locator('[data-act="shop-tab"][data-id="stove"]').click();
  const stove=page.locator('[data-act="buy-furniture"][data-id="stove"]'),text=await stove.textContent();
  assert.equal(await stove.isDisabled(),true);assert.match(text,/2\/2/);assert.match(text,/Lv\.4/);
  const typography=await page.evaluate(()=>Object.fromEntries(['#hunger-value','.shop-tabs button','#edit-info'].map(selector=>[selector,getComputedStyle(document.querySelector(selector)).fontSize])));
  return{errorPersists:true,errorDismissed:true,shopLimit:text,typography};
 });

 await check('actor-depth-order',async page=>{
  await ready(page);
  const evidence=await page.evaluate(()=>{
   const g=window.__BAMSONNIM__,s=g.state,v=g.view,original=v.drawPerson;g.pause();
   s.waiters=[{...s.waiters[0],uid:'depth-worker',x:3,y:2.95,path:[],task:null}];
   s.customers=[{uid:'depth-customer',zombieId:'wanderer',x:3,y:3,phase:'waiting',path:[],wait:0,seat:null}];
   let order=[];v.drawPerson=function(state,actor,...args){order.push(actor.uid);return original.call(this,state,actor,...args);};
   try{v.draw(s,null,0,false);const behind=order;order=[];s.waiters[0].y=3.05;v.draw(s,null,0,false);return{syntheticFixture:true,behind,inFront:order};}finally{v.drawPerson=original;}
  });
  assert.deepEqual(evidence.behind,['depth-worker','depth-customer']);
  assert.deepEqual(evidence.inFront,['depth-customer','depth-worker']);
  return evidence;
 });

 await check('eight-worker-actor-pass-through-business',async page=>{
  await ready(page);
  const evidence=await page.evaluate(()=>{
   const g=window.__BAMSONNIM__,s=g.state,E=g.engine;g.pause();s.level=30;s.coins=1_000_000;
   while(s.waiters.length<8){const problem=E.hire(s);if(problem)throw new Error(problem);}
   Object.assign(s.objects.find(o=>o.type==='server'),{foodId:'rice',stock:1000});
   const duplicateSeats=[],furnitureCrossings=[],movementViolations=[],allowedOverlaps={workerWorker:0,workerGuest:0,guestGuest:0};let maxActors=0;
   const integer=n=>Math.abs(n-Math.round(n))<1e-6,near=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y)<1e-6;
   function observe(before){
    const actors=[...s.waiters,...s.customers],workers=new Set(s.waiters),reserved=new Set();maxActors=Math.max(maxActors,actors.length);
    for(const c of s.customers)if(c.seat){if(reserved.has(c.seat)&&duplicateSeats.length<20)duplicateSeats.push({time:s.time,seat:c.seat,guest:c.uid});reserved.add(c.seat);}
    for(let i=0;i<actors.length;i++)for(let j=i+1;j<actors.length;j++)if(near(actors[i],actors[j]))allowedOverlaps[workers.has(actors[i])&&workers.has(actors[j])?'workerWorker':workers.has(actors[i])||workers.has(actors[j])?'workerGuest':'guestGuest']++;
    if(!before)return;
    for(const actor of actors){const old=before.get(actor.uid);if(!old)continue;const distance=Math.hypot(actor.x-old.x,actor.y-old.y);if(distance<1e-6)continue;
     if(distance>.65+1e-6||!integer(actor.x)&&!integer(actor.y)){if(movementViolations.length<20)movementViolations.push({time:s.time,uid:actor.uid,old,now:{x:actor.x,y:actor.y},distance});}
     const segments=Math.abs(old.x-actor.x)<1e-6||Math.abs(old.y-actor.y)<1e-6?[[old,actor]]:!integer(old.x)?[[old,{x:actor.x,y:old.y}],[{x:actor.x,y:old.y},actor]]:[[old,{x:old.x,y:actor.y}],[{x:old.x,y:actor.y},actor]];
     for(const[from,to]of segments)for(const object of s.objects){if(near(object,old))continue;const ownedSeat=!workers.has(actor)&&object.uid===actor.seat&&near(object,actor)&&['seating','waiting','eating'].includes(actor.phase);if(ownedSeat)continue;
      const onSegment=Math.abs(from.x-to.x)<1e-6?Math.abs(object.x-from.x)<1e-6&&object.y>=Math.min(from.y,to.y)-1e-6&&object.y<=Math.max(from.y,to.y)+1e-6:Math.abs(object.y-from.y)<1e-6&&object.x>=Math.min(from.x,to.x)-1e-6&&object.x<=Math.max(from.x,to.x)+1e-6;
      if(onSegment&&furnitureCrossings.length<20)furnitureCrossings.push({time:s.time,uid:actor.uid,object:object.uid,type:object.type,from:{x:from.x,y:from.y},to:{x:to.x,y:to.y}});
     }
    }
   }
   observe();for(let i=0;i<480;i++){const before=new Map([...s.waiters,...s.customers].map(a=>[a.uid,{x:a.x,y:a.y,phase:a.phase,seat:a.seat}]));E.advance(s,.25);observe(before);}
   return{policy:'All actor pairs may pass through; furniture cannot be traversed and chair reservations stay exclusive.',seconds:120,sampleInterval:.25,workers:s.waiters.length,maxActors,allowedOverlaps,duplicateSeats,furnitureCrossings,movementViolations,served:s.stats.served,sold:s.stats.sold};
  });
  assert.deepEqual(evidence.duplicateSeats,[],'Each seat has at most one guest reservation');
  assert.deepEqual(evidence.furnitureCrossings,[],'Furniture, including empty chairs, is never an intermediate route cell');
  assert.deepEqual(evidence.movementViolations,[],'Movement remains continuous along tile edges');
  assert.ok(evidence.maxActors>8&&evidence.served>0&&evidence.sold>0,'Eight-worker business continues');
  return evidence;
 });

 await check('all-four-chairs-used',async page=>{
  await ready(page);
  const evidence=await page.evaluate(()=>{
   const g=window.__BAMSONNIM__,s=g.state,E=g.engine;g.pause();
   Object.assign(s.objects.find(o=>o.type==='server'),{foodId:'rice',stock:200});
   const seats=E.seats(s).map(seat=>({uid:seat.uid,x:seat.chair.x,y:seat.chair.y,dir:seat.chair.dir})),lower=seats.filter(seat=>seat.dir===3&&seat.y===5),waiting=new Set(),eating=new Set(),snapshots={},firstUse=[];
   for(let i=0;i<720;i++){
    E.advance(s,.25);
    for(const customer of s.customers){
     if(customer.phase==='waiting'){if(!waiting.has(customer.seat))firstUse.push({time:s.time,seat:customer.seat,guest:customer.uid});waiting.add(customer.seat);}
     if(customer.phase==='eating')eating.add(customer.seat);
     if(lower.some(seat=>seat.uid===customer.seat)&&['waiting','eating'].includes(customer.phase)){
      const key=`${customer.seat}-${customer.phase}`;if(!snapshots[key]){g.view.draw(s,null,s.time,false);snapshots[key]=g.view.canvas.toDataURL('image/png');}
     }
    }
   }
   return{seconds:180,seats,lower,waiting:[...waiting],eating:[...eating],firstUse,snapshots,sold:s.stats.sold};
  });
  const screens=[];for(const [key,data] of Object.entries(evidence.snapshots)){const file=`${output}/chair-${key}.png`;await fs.writeFile(file,Buffer.from(data.split(',')[1],'base64'));screens.push(file);}delete evidence.snapshots;evidence.screens=screens;
  assert.equal(evidence.seats.length,4);assert.equal(evidence.lower.length,2);
  assert.deepEqual(evidence.waiting.sort(),evidence.seats.map(seat=>seat.uid).sort());assert.deepEqual(evidence.eating.sort(),evidence.waiting);
  assert.equal(screens.length,4,'Both lower/back-facing chairs have waiting and eating screenshot evidence');assert.ok(evidence.sold>0);
  return evidence;
 });

 await check('two-food-serving-and-blocked-counter',async page=>{
  await ready(page);
  const scenarios=await page.evaluate(async()=>{
   const g=window.__BAMSONNIM__,E=g.engine,{zombie}=await import('/src/data.js');g.pause();const results=[];
   for(const blocked of [false,true]){
    Object.assign(g.state,E.newGame());const s=g.state;s.coins=10000;
    const problem=E.place(s,{type:'server',x:6,y:1});if(problem)throw new Error(problem);
    const servers=s.objects.filter(o=>o.type==='server');Object.assign(servers[0],{foodId:'rice',stock:200});Object.assign(servers[1],{foodId:'skewer',stock:200});
    if(blocked)for(const [x,y] of [[5,1],[7,1],[6,0],[6,2]])s.objects.push({uid:`block-${x}-${y}`,type:'jars',x,y,dir:0});
    const eaten=new Set(),paid=new Set(),favorites=new Set();let previous=[];
    for(let i=0;i<480;i++){
     E.advance(s,.25);
     for(const customer of s.customers){if(zombie(customer.zombieId)?.favorite)favorites.add(customer.zombieId);if(customer.phase==='eating')eaten.add(customer.foodId);const before=previous.find(c=>c.uid===customer.uid);if(before?.phase==='eating'&&customer.phase==='leaving')paid.add(before.foodId);}
     previous=s.customers.map(c=>({uid:c.uid,phase:c.phase,foodId:c.foodId}));
    }
    results.push({blocked,seconds:120,stocks:servers.map(o=>({foodId:o.foodId,remaining:o.stock})),eaten:[...eaten].sort(),paid:[...paid].sort(),favoriteGuests:[...favorites],sold:s.stats.sold});
   }
   return results;
  });
  const [normal,blocked]=scenarios;
  assert.deepEqual(normal.favoriteGuests,[]);assert.deepEqual(normal.eaten,['rice','skewer']);assert.deepEqual(normal.paid,['rice','skewer']);assert.ok(normal.stocks.every(s=>s.remaining<200));
  assert.equal(blocked.stocks.find(s=>s.foodId==='skewer').remaining,200);assert.ok(blocked.stocks.find(s=>s.foodId==='rice').remaining<200&&blocked.sold>0);assert.deepEqual(blocked.paid,['rice'],'Unreachable counter falls back to accessible food');
  return{scenarios};
 });

 await check('wooden-entrance-and-business',async page=>{
  await ready(page);
  const evidence=await page.evaluate(()=>{
   const g=window.__BAMSONNIM__,s=g.state,v=g.view,c=v.ctx,original=c.drawImage,doorCalls=[];g.pause();
   c.drawImage=function(image,...args){if(image===v.sprites.woodenEntrance?.[0]){const m=this.getTransform();doorCalls.push({args,matrix:{a:m.a,b:m.b,c:m.c,d:m.d,e:m.e,f:m.f}});}return original.call(this,image,...args);};
   try{v.draw(s,null,0,false);}finally{c.drawImage=original;}
   const entrance={x:0,y:s.size-1},seat=g.engine.seats(s)[0];
   const route=g.engine.path(s,entrance,[seat.chair.x,seat.chair.y]);
   Object.assign(s.objects.find(o=>o.type==='server'),{foodId:'rice',stock:3});
   const entered=new Set(),exited=new Set(),phases=new Set();let previous=[];
   for(let i=0;i<600;i++){
    g.engine.advance(s,.25);const current=s.customers.map(customer=>customer.uid);
    for(const uid of previous)if(!current.includes(uid))exited.add(uid);
    for(const customer of s.customers){entered.add(customer.uid);phases.add(customer.phase);}previous=current;
   }
   return{doorCalls,route,entranceBlocked:s.objects.some(o=>o.x===entrance.x&&o.y===entrance.y),entered:entered.size,exited:exited.size,phases:[...phases],sold:s.stats.sold};
  });
  assert.equal(evidence.doorCalls.length,1,'Door artwork is actually drawn');
  assert.deepEqual(Object.values(evidence.doorCalls[0].matrix).slice(0,4),[1,-.5,0,1],'Door follows the left wall projection');
  assert.equal(evidence.entranceBlocked,false);assert.ok(evidence.route?.length>0);
  assert.ok(evidence.entered>0&&evidence.exited>0&&evidence.sold>0);assert.ok(evidence.phases.includes('eating')&&evidence.phases.includes('leaving'));
  return evidence;
 });

 await check('new-furniture-and-posters',async page=>{
  await ready(page);
  const evidence=await page.evaluate(async()=>{
   const {furnitureArt}=await import('/src/furniture-placement.js');const g=window.__BAMSONNIM__,v=g.view,calls=[],transforms=[],sprite=v.sprite,transform=v.ctx.transform;g.pause();
   v.sprite=function(key,index,...args){calls.push({key,index});return sprite.call(this,key,index,...args);};
   v.ctx.transform=function(...args){transforms.push(args);return transform.apply(this,args);};
   try{
    v.draw(g.state,null,0,false);
    v.drawObject(g.state,{uid:'left-poster-check',type:'poster',x:0,y:3,dir:0},0,null);
   }finally{v.sprite=sprite;v.ctx.transform=transform;}
   return{expected:['stove','server'].map(type=>furnitureArt(type).key),keys:[...new Set(calls.map(c=>c.key))],posterTransforms:transforms.filter(t=>t[0]===1&&Math.abs(t[1])===.5&&t[2]===0&&t[3]===1),failedAssets:v.failedAssets};
  });
  assert.ok(evidence.expected.every(key=>evidence.keys.includes(key)));
  assert.deepEqual([...new Set(evidence.posterTransforms.map(t=>t[1]))].sort(),[-.5,.5]);
  assert.deepEqual(evidence.failedAssets,[]);
  return evidence;
 });

 await check('eight-worker-appearances',async page=>{
  await ready(page);await page.evaluate(()=>{const g=window.__BAMSONNIM__;g.pause();g.state.level=30;g.state.coins=1_000_000;});
  await page.locator('[data-act="menu"]').click();await page.locator('[data-act="hire"]').click();
  for(let i=0;i<7;i++)await page.locator('[data-act="hire-now"]').click();
  assert.equal(await page.locator('.staff-card').count(),8);
  assert.equal(await page.locator('[data-act="hire-now"]').isDisabled(),true);
  const evidence=await page.evaluate(()=>{
   const g=window.__BAMSONNIM__,v=g.view,original=v.sprite,calls=[];
   v.sprite=function(key,index,...args){calls.push({key,index});return original.call(this,key,index,...args);};
   try{for(const worker of g.state.waiters)v.drawPerson(g.state,worker,true,0,false);}finally{v.sprite=original;}
   const appearances=g.state.waiters.map(w=>w.appearance);g.save();
   return{appearances,frames:v.sprites.workers.length,drawn:calls.filter(c=>c.key==='workers').map(c=>c.index),cards:[...document.querySelectorAll('.staff-card .sprite')].map(el=>({image:getComputedStyle(el).backgroundImage,position:getComputedStyle(el).backgroundPosition}))};
  });
  assert.equal(evidence.frames,8);assert.deepEqual(evidence.appearances,[0,1,2,3,4,5,6,7]);assert.deepEqual(evidence.drawn,evidence.appearances);
  assert.equal(new Set(evidence.cards.map(c=>c.position)).size,8);assert.ok(evidence.cards.every(c=>c.image.includes('workers.png')));
  await page.screenshot({path:`${output}/eight-workers-hire.png`});
  await page.reload({waitUntil:'networkidle'});await page.waitForFunction(()=>window.__BAMSONNIM__?.view.ready);
  assert.deepEqual(await page.evaluate(()=>window.__BAMSONNIM__.state.waiters.map(w=>w.appearance)),evidence.appearances);
  return evidence;
 });

 await check('worker-tray-transfer-and-serving',async page=>{
  await ready(page);
  const evidence=await page.evaluate(()=>{
   const g=window.__BAMSONNIM__,s=g.state,v=g.view,E=g.engine,w=s.waiters[0],original=v.sprite;g.pause();s.spawnIn=10000;s.customers=[];
   const trace=[];
   function capture(stage){
    const calls=[];v.sprite=function(key,index,x,y,...args){calls.push({key,index,x,y});return original.call(this,key,index,x,y,...args);};
    try{v.drawPerson(s,w,true,s.time,false);}finally{v.sprite=original;}
    trace.push({stage,time:s.time,task:w.task?{...w.task}:null,calls});
   }
   function until(predicate){for(let i=0;i<600;i++){if(predicate())return;E.advance(s,.25);}throw new Error('Worker did not reach expected pickup/drop state');}
   capture('idle');
   const stove=s.objects.find(o=>o.type==='stove');if(E.cook(s,stove.uid,'rice'))throw new Error('Fixture could not cook');E.advance(s,12);
   if(E.collect(s,stove.uid))throw new Error('Fixture could not collect');
   until(()=>w.task?.kind==='transfer');capture('transfer-before-pickup');
   until(()=>w.task?.picked);capture('transfer-picked');
   until(()=>!w.task);capture('transfer-dropped');
   const seat=E.seats(s).find(seat=>seat.table),customer={uid:'tray-customer',zombieId:'wanderer',phase:'waiting',x:seat.chair.x,y:seat.chair.y,path:[],seat:seat.uid,wait:0};s.customers=[customer];
   until(()=>w.task?.kind==='serve');capture('serve-before-pickup');
   until(()=>w.task?.picked);capture('serve-picked');
   until(()=>!w.task);capture('serve-dropped');
   const meal=[];v.sprite=function(key,index,x,y,...args){meal.push({key,index,x,y});return original.call(this,key,index,x,y,...args);};
   try{v.drawMeal(s,customer);}finally{v.sprite=original;}
   return{trace,meal,customerPhase:customer.phase,table:v.world(seat.table.x,seat.table.y),tile:v.tile,trayLoaded:!!v.sprites.waiterTray?.[0]};
  });
  assert.ok(evidence.trayLoaded,'Empty tray image is loaded');
  for(const frame of evidence.trace){
   assert.equal(frame.calls.filter(call=>call.key==='waiterTray').length,1,`${frame.stage}: staff always carry one tray`);
   const food=frame.calls.filter(call=>call.key==='food');
   assert.equal(food.length,frame.stage.endsWith('-picked')?1:0,`${frame.stage}: food appears only after pickup and disappears on drop`);
   if(food.length){const tray=frame.calls.find(call=>call.key==='waiterTray');assert.equal(food[0].x,tray.x);assert.ok(food[0].y<tray.y,'Picked food is drawn above the tray');}
  }
  assert.equal(evidence.customerPhase,'eating');assert.equal(evidence.meal.filter(call=>call.key==='food').length,1);
  assert.ok(Math.abs(evidence.meal[0].x-evidence.table.x)<evidence.tile*.5&&evidence.meal[0].y<evidence.table.y,'Delivered food is now on the guest table');
  return evidence;
 });

 await check('shared-table-meals',async page=>{
  await ready(page);
  const evidence=await page.evaluate(()=>{
   const g=window.__BAMSONNIM__,s=g.state,v=g.view;g.pause();
   const table=s.objects.find(o=>o.type==='table'),places=g.engine.seats(s).filter(seat=>seat.table?.uid===table.uid);
   s.customers=places.map((seat,i)=>({uid:`meal-${i}`,zombieId:'wanderer',x:seat.chair.x,y:seat.chair.y,phase:'eating',path:[],seat:seat.uid,wait:0,foodId:i?'skewer':'rice'}));
   const calls=[],originalSprite=v.sprite,originalPerson=v.drawPerson;let person=false;
   v.drawPerson=function(...args){person=true;try{return originalPerson.apply(this,args);}finally{person=false;}};
   v.sprite=function(key,index,x,y,width,height,...rest){if(key==='food'){
    const im=v.sprites.food[index],data=im.getContext('2d').getImageData(0,0,im.width,im.height).data;let minY=im.height,maxY=0;
    for(let yy=0;yy<im.height;yy++)for(let xx=0;xx<im.width;xx++)if(data[(yy*im.width+xx)*4+3]>80){minY=Math.min(minY,yy);maxY=Math.max(maxY,yy);}
    let minX=im.width,maxX=0;const baseY=Math.ceil(maxY-(maxY-minY)*.18);for(let yy=baseY;yy<=maxY;yy++)for(let xx=0;xx<im.width;xx++)if(data[(yy*im.width+xx)*4+3]>80){minX=Math.min(minX,xx);maxX=Math.max(maxX,xx);}
    calls.push({index,x,y,width,height,person,imageAspect:im.width/im.height,base:{left:x-width/2+width*minX/im.width,right:x-width/2+width*(maxX+1)/im.width,top:y-height+height*baseY/im.height,bottom:y-height+height*(maxY+1)/im.height}});
   }return originalSprite.call(this,key,index,x,y,width,height,...rest);};
   try{v.draw(s,null,0,false);}finally{v.sprite=originalSprite;v.drawPerson=originalPerson;}
   return{seats:places.length,table:v.world(table.x,table.y),tile:v.tile,food:calls};
  });
  assert.equal(evidence.seats,2);assert.equal(evidence.food.length,2,'Each guest has one meal');
  assert.ok(evidence.food.every(meal=>!meal.person),'Meals on the table are not duplicated in guests’ hands');
  assert.equal(new Set(evidence.food.map(meal=>`${meal.x},${meal.y}`)).size,2,'Shared table has distinct plate positions');
  const [first,second]=evidence.food;
  const overlapX=Math.min(first.base.right,second.base.right)-Math.max(first.base.left,second.base.left);
  const overlapY=Math.min(first.base.bottom,second.base.bottom)-Math.max(first.base.top,second.base.top);
  assert.ok(overlapX<=0||overlapY<=0,'The two plate bases occupy separate tabletop positions');
  assert.ok(evidence.food.every(meal=>Math.abs(meal.width/meal.height-meal.imageAspect)<1e-6),'Food preserves its original aspect ratio');
  assert.ok(evidence.food.every(meal=>Math.abs(meal.x-evidence.table.x)<evidence.tile*.5&&meal.y<evidence.table.y&&meal.y>evidence.table.y-evidence.tile*.7),'Meals stay above their shared tabletop');
  return evidence;
 });

 await check('online-payment-sound',async page=>{
  await ready(page);
  await page.evaluate(async()=>{
   const g=window.__BAMSONNIM__,audioURL=performance.getEntriesByType('resource').find(entry=>/\/src\/audio\.js(?:\?|$)/.test(entry.name))?.name||'/src/audio.js',{Sound}=await import(audioURL);g.pause();
   window.__paymentEffects=[];const original=Sound.prototype.effect;
   Sound.prototype.effect=function(kind){window.__paymentEffects.push(kind);return original.call(this,kind);};
   window.__paymentVisualEvents=[];const add=g.view.addPaymentEffect;g.view.addPaymentEffect=function(event){window.__paymentVisualEvents.push({...event});return add.call(this,event);};
   Object.assign(g.state.objects.find(o=>o.type==='server'),{foodId:'rice',stock:1000});
   g.advance(90);
  });
  await page.waitForFunction(()=>window.__paymentEffects.includes('payment')&&window.__BAMSONNIM__.view.paymentEffects.length>0);
  const before=await page.evaluate(()=>{const g=window.__BAMSONNIM__;window.__lastPayment={...g.view.paymentEffects.at(-1)};return{sounds:window.__paymentEffects.filter(x=>x==='payment').length,sold:g.state.stats.sold,fxCalls:window.__paymentVisualEvents.length,effect:window.__lastPayment,event:window.__paymentVisualEvents.at(-1),walletBump:document.querySelector('#coins').closest('.currency').classList.contains('coin-pop')};});
  assert.equal(before.effect.amount,before.event.amount);assert.equal(before.effect.xp,before.event.xp);assert.ok(before.effect.amount>0&&before.effect.xp>0&&before.walletBump);
  await page.evaluate(()=>window.__BAMSONNIM__.advance(90,true));await page.waitForTimeout(800);
  const after=await page.evaluate(()=>({sounds:window.__paymentEffects.filter(x=>x==='payment').length,sold:window.__BAMSONNIM__.state.stats.sold,fxCalls:window.__paymentVisualEvents.length}));
  assert.ok(before.sounds>0&&before.sold>0);assert.ok(after.sold>before.sold);assert.equal(after.sounds,before.sounds,'Offline payments never trigger the coin sound');
  assert.equal(after.fxCalls,before.fxCalls,'Offline payments never create floating rewards');
  await page.waitForFunction(()=>window.__BAMSONNIM__.view.paymentEffects.length===0,null,{timeout:4000});
  const motion=[];
  for(const preference of ['no-preference','reduce']){
   await page.emulateMedia({reducedMotion:preference});
   const samples=await page.evaluate(()=>{
    const v=window.__BAMSONNIM__.view,original=v.label;let labels=[];
    v.label=function(text,x,y,...args){labels.push({text,x,y,alpha:this.ctx.globalAlpha});return original.call(this,text,x,y,...args);};
    const draw=age=>{labels=[];v.paymentEffects=[{...window.__lastPayment,startedAt:0}];v.drawPaymentEffects(age);return{labels,effects:v.paymentEffects.length};};
    try{return{early:draw(.1),later:draw(.5),late:draw(1.7),expired:draw(1.91)};}finally{v.label=original;}
   });
   assert.ok(!samples.early.labels.some(label=>label.text.includes('XP')));assert.ok(samples.later.labels.some(label=>label.text.includes('XP')));
   assert.equal(samples.expired.effects,0);assert.equal(samples.expired.labels.length,0);
   const earlyCoin=samples.early.labels.find(label=>label.text.includes('코인')),laterCoin=samples.later.labels.find(label=>label.text.includes('코인'));
   if(preference==='reduce'){assert.equal(earlyCoin.y,laterCoin.y);assert.ok(samples.late.labels.every(label=>label.alpha===1),'Reduced motion has no rising or stepped fading');}
   else assert.ok(laterCoin.y<earlyCoin.y,'Normal payment reward rises');
   motion.push({preference,...samples});
  }
  const audio=await page.evaluate(async()=>{
   const {Sound}=await import('/src/audio.js'),context=new OfflineAudioContext(2,44100,44100),sound=new Sound();sound.setup(context);
   const rendering=context.startRendering();sound.coinJingle();const buffer=await rendering;
   let peak=0,power=0,nonFinite=0;for(const value of buffer.getChannelData(0)){if(!Number.isFinite(value))nonFinite++;peak=Math.max(peak,Math.abs(value));power+=value*value;}
   return{seconds:1,peak,rms:Math.sqrt(power/buffer.length),nonFinite};
  });
  assert.equal(audio.nonFinite,0);assert.ok(audio.peak>0&&audio.peak<1);assert.ok(audio.rms>0);
  return{before,after,audio,motion};
 });

 await check('cookbook-price-visibility',async page=>{
  const screens=[];
  for(const [width,height] of [[1280,800],[844,390],[640,400],[320,640]]){
   await page.setViewportSize({width,height});await ready(page);await page.evaluate(()=>window.__BAMSONNIM__.pause());
   if(await page.locator('#orientation-dialog').isVisible())await page.setViewportSize({width:height,height:width});
   const definitions=await page.evaluate(async()=>{const {RECIPES}=await import('/src/data.js');return RECIPES.map(({id,coins,hearts,price})=>({id,coins,hearts,price}));});
   const seen=[];await page.locator('[data-act="cookbook"]').first().click();
   const books=await page.evaluate(async()=>{const {BOOKS,RECIPES}=await import('/src/data.js');for(const r of RECIPES)__BAMSONNIM__.state.mastery[r.id]=r.milestones.at(-1);return BOOKS.map((_,i)=>String(i));});
   for(const book of books){
    while(!await page.locator(`[data-act="book-open"][data-n="${book}"]`).count())await page.locator('[data-act="book-shelf-page"][data-n="1"]').click();
    await page.locator(`[data-act="book-open"][data-n="${book}"]`).click();
    for(;;){
     const cards=page.locator('.recipe-page');
     for(let i=0;i<await cards.count();i++){
      const card=cards.nth(i),prices=card.locator('.recipe-prices'),id=await card.locator('[data-act="cook"]').getAttribute('data-id'),definition=definitions.find(r=>r.id===id);
      await prices.scrollIntoViewIfNeeded();
      const detail=await prices.evaluate(el=>{
       const r=el.getBoundingClientRect(),dialog=document.querySelector('dialog').getBoundingClientRect();
       return{cost:el.querySelector(':scope > div:first-child dd').textContent.trim(),saleLabel:el.querySelector(':scope > div:last-child dt').textContent.trim(),sale:el.querySelector(':scope > div:last-child dd').textContent.replace(/\s/g,''),visible:el.checkVisibility(),overflow:el.scrollWidth>el.clientWidth,inViewport:r.left>=0&&r.right<=innerWidth&&r.top>=dialog.top&&r.bottom<=dialog.bottom,fonts:[...el.querySelectorAll('dt,dd,small')].map(n=>Number.parseFloat(getComputedStyle(n).fontSize))};
      });
      assert.equal(detail.cost,definition.hearts?`${definition.hearts}심장`:definition.coins?`${definition.coins}코인`:'무료');
      assert.equal(detail.saleLabel,'1개당 판매가');assert.equal(detail.sale,`${definition.price}코인`);assert.ok(detail.visible&&detail.inViewport&&!detail.overflow,`${width}px ${id}: price block is readable without clipping`);assert.ok(detail.fonts.every(size=>size>=12));
      seen.push({id,locked:await card.locator('[data-act="cook"]').isDisabled(),...detail});
      if(book==='0'&&i===0)await page.screenshot({path:`${output}/cookbook-prices-${width}.png`});
     }
     const next=page.locator('[data-act="book-page"][data-n="1"]');if(await next.isDisabled())break;await next.click();
    }
    await page.locator('[data-act="book-back"]').click();
   }
   assert.deepEqual([...new Set(seen.map(r=>r.id))].sort(),definitions.map(r=>r.id).sort(),'Every registered recipe exposes its price');assert.ok(seen.some(r=>r.locked));screens.push({width,height,recipes:seen});
  }
  return{screens};
 });

 await check('cookbook-live-stock-fixed-price',async page=>{
  await ready(page);
  await page.evaluate(()=>{const g=window.__BAMSONNIM__,s=g.state;g.pause();s.coins=10000;const problem=g.engine.place(s,{type:'server',x:6,y:1});if(problem)throw new Error(problem);const servers=s.objects.filter(o=>o.type==='server');Object.assign(servers[0],{foodId:'rice',stock:6});Object.assign(servers[1],{foodId:'rice',stock:0});window.__stockFixture={stockedUid:servers[0].uid,emptyUid:servers[1].uid};s.objects=[servers[1],...s.objects.filter(o=>o.uid!==servers[1].uid)];s.spawnIn=0;});
  await page.locator('[data-act="cookbook"]').first().click();
  await page.locator('[data-act="book-open"][data-n="0"]').click();
  const card=page.locator('.recipe-page').filter({has:page.locator('[data-act="cook"][data-id="rice"]')}),stock=card.locator('[data-food-stock="rice"]'),sale=card.locator('.recipe-prices > div').nth(1).locator('dd');
  const snapshots=[];
  async function record(stage,expected){await page.waitForFunction(expected=>document.querySelector('[data-food-stock="rice"]').textContent===`${expected}개`,expected);const unitPrice=(await sale.textContent()).trim();assert.equal(unitPrice,'1코인');snapshots.push({stage,stock:await stock.textContent(),unitPrice});}
  await record('initial',6);
  const afterSale=await page.evaluate(()=>{
   const g=window.__BAMSONNIM__,s=g.state;
   for(let i=0;i<600&&s.stats.served===0;i++){g.engine.advance(s,.25);if(s.customers.length)s.spawnIn=10000;}
   if(!s.stats.served)throw new Error('No actual serving occurred');return s.objects.reduce((n,o)=>n+(o.foodId==='rice'?(o.stock||0):0),0);
  });
  assert.equal(afterSale,5);await record('after-serving',afterSale);
  const afterBatch=await page.evaluate(()=>{
   const g=window.__BAMSONNIM__,s=g.state,E=g.engine,stove=s.objects.find(o=>o.type==='stove');
   if(E.cook(s,stove.uid,'rice'))throw new Error('Cooking failed');E.advance(s,12);if(E.collect(s,stove.uid))throw new Error('Collection failed');
   for(let i=0;i<600&&s.stats.cooked===0;i++)E.advance(s,.25);
   if(s.stats.cooked!==1)throw new Error('Batch was not delivered');return s.objects.reduce((n,o)=>n+(o.foodId==='rice'?(o.stock||0):0),0);
  });
  assert.equal(afterBatch,afterSale+6);await record('after-new-batch',afterBatch);
  const batchStocks=await page.evaluate(()=>{const s=window.__BAMSONNIM__.state,f=window.__stockFixture;return{stocked:s.objects.find(o=>o.uid===f.stockedUid).stock,empty:s.objects.find(o=>o.uid===f.emptyUid).stock};});
  assert.deepEqual(batchStocks,{stocked:11,empty:0},'A new batch stacks on the matching stock even when an empty counter appears first');
  // Preserve and display a second same-food stock from an existing save; this
  // fixture checks aggregation without asking the engine to split a new batch.
  await page.evaluate(()=>{window.__BAMSONNIM__.state.objects.find(o=>o.uid===window.__stockFixture.emptyUid).stock=7;});
  await record('including-existing-second-counter',afterBatch+7);
  return{snapshots,batchStocks,modalStayedOpen:await page.locator('dialog').evaluate(dialog=>dialog.open)};
 });

 await check('muted-music-payment-effect',async page=>{
  await ready(page);await page.evaluate(()=>window.__BAMSONNIM__.pause());
  await page.locator('#sound-button').click();
  await page.waitForFunction(()=>document.querySelector('#sound-button').getAttribute('aria-label')==='음악 끄기');
  await page.locator('#sound-button').click();
  assert.equal(await page.locator('#sound-button').getAttribute('aria-label'),'음악 켜기');
  const evidence=await page.evaluate(async()=>{
   const g=window.__BAMSONNIM__,sound=g.sound,analyser=sound.context.createAnalyser();analyser.fftSize=256;sound.effectsBus.connect(analyser);
   let paymentCalls=0;const original=sound.effect;sound.effect=function(kind){if(kind==='payment')paymentCalls++;return original.call(this,kind);};
   Object.assign(g.state.objects.find(o=>o.type==='server'),{foodId:'rice',stock:1000});g.advance(60);
   let peak=0;const samples=new Float32Array(analyser.fftSize);
   for(let i=0;i<60;i++){analyser.getFloatTimeDomainData(samples);for(const sample of samples)peak=Math.max(peak,Math.abs(sample));await new Promise(resolve=>setTimeout(resolve,20));}
   sound.effect=original;sound.effectsBus.disconnect(analyser);
   return{musicMuted:sound.musicMuted,contextState:sound.context.state,musicGain:sound.musicBus.gain.value,effectsGain:sound.effectsBus.gain.value,paymentCalls,effectsPeak:peak,sold:g.state.stats.sold};
  });
  assert.equal(evidence.musicMuted,true);assert.equal(evidence.contextState,'running');assert.ok(evidence.musicGain<.0001);
  assert.ok(evidence.effectsGain>0&&evidence.paymentCalls>0&&evidence.effectsPeak>0&&evidence.sold>0,'Muted background music preserves an audible payment effect');
  return evidence;
 });

 await fs.writeFile(`${output}/${process.env.BROWSER_CHECK?'focused-results':'extended-results'}.json`,JSON.stringify(results,null,2));
 assert.deepEqual(failures,[],failures.join('\n'));
}
