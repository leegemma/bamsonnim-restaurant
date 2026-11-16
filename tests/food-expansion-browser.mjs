import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium,webkit} from 'playwright';
const browserName=process.env.BROWSER||'chromium',out=process.env.FOOD_OUTPUT||`artifacts/final-validation/food-${browserName}`,base=process.env.BASE_URL||'http://127.0.0.1:5173';
await fs.mkdir(out,{recursive:true});const browser=await({chromium,webkit}[browserName]).launch(),results={browser:browserName,scope:'Unlocked synthetic resources/layout; real touch controls and production-engine movement, serving, payment, cleaning. Instant completion uses the actual paid game action. Browser engine emulation, not an iOS device.',lifecycles:[],books:[]};
try{
 const context=await browser.newContext({viewport:{width:844,height:390},hasTouch:true,isMobile:true}),page=await context.newPage(),errors=[];
 await page.addInitScript(()=>{window.foodPointers=[];document.addEventListener('pointerdown',e=>foodPointers.push(e.pointerType),true);});page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base);await page.waitForFunction(()=>window.__BAMSONNIM__?.view.ready);await page.evaluate(()=>document.fonts.ready);
 const recipes=await page.evaluate(async()=>{window.__BAMSONNIM__.pause();return(await import('/src/data.js')).RECIPES;});assert.equal(recipes.length,43);
 for(const viewport of [{width:844,height:390},{width:568,height:320},{width:568,height:240}]){
  await page.setViewportSize(viewport);await page.locator('[data-act="cookbook"]').first().tap();const seen=[],tabs=[];
  for(let book=0;book<11;book++){
   await page.locator(`[data-act="book-tab"][data-n="${book}"]`).tap();await page.waitForFunction(book=>document.querySelector('.book-tabs .selected')?.dataset.n===String(book),book);
   const tab=await page.locator('.book-tabs .selected').evaluate(el=>{const r=el.getBoundingClientRect(),p=el.parentElement.getBoundingClientRect();return{book:el.dataset.n,left:r.left,right:r.right,parentLeft:p.left,parentRight:p.right,scroll:el.parentElement.scrollLeft};});assert.ok(tab.left>=tab.parentLeft-1&&tab.right<=tab.parentRight+1,'Selected tab stays inside horizontal scrollport');tabs.push(tab);
   for(;;){
    const ids=await page.locator('.recipe-page [data-act="cook"]').evaluateAll(es=>es.map(e=>e.dataset.id));seen.push(...ids);
    for(const id of ids){const button=page.locator(`[data-act="cook"][data-id="${id}"]`);await button.scrollIntoViewIfNeeded();const r=await button.boundingBox();assert.ok(r.x>=0&&r.y>=0&&r.x+r.width<=viewport.width+1&&r.y+r.height<=viewport.height+1,`${id} critical cook control visible`);}
    if(book===10)await page.screenshot({path:`${out}/last-book-${viewport.width}-${viewport.height}-${seen.length}.png`});
    const next=page.locator('[data-act="book-page"][data-n="1"]');if(await next.isDisabled())break;await next.tap();
   }
  }
  assert.deepEqual([...seen].sort(),recipes.map(r=>r.id).sort());assert.equal(seen.filter(id=>recipes.find(r=>r.id===id).book===10).length,5);results.books.push({viewport,ids:seen,tabs});await page.getByRole('button',{name:'창 닫기',exact:true}).tap();
 }
 await page.setViewportSize({width:844,height:390});
 // All registered food sprites must take the same physical surface transform and retain native aspect.
 results.rendering=await page.evaluate(async()=>{
  const g=window.__BAMSONNIM__,v=g.view,{RECIPES}=await import('/src/data.js'),{foodFrame}=await import('/src/assets.js'),s=g.state,cases=[];g.pause();
  for(const r of RECIPES)for(let dir=0;dir<4;dir++){
   const route=foodFrame(r.sprite),im=v.sprites[route.key]?.[route.index],calls=[],orig=v.sprite;v.sprite=function(key,index,x,y,w,h,...rest){if(key===route.key&&index===route.index)calls.push({key,index,x,y,w,h:h??w*im.height/im.width});return orig.call(this,key,index,x,y,w,h,...rest);};
   const table={uid:'food-table',type:'table',x:3,y:3,dir:0},[x,y]=[[2,3],[3,2],[4,3],[3,4]][dir],chair={uid:'food-chair',type:'chair',x,y,dir};s.objects=[table,chair];
   try{v.drawObject(s,{uid:'food-server',type:'server',x:5,y:1,dir,stock:20,foodId:r.id},0,null);v.drawPerson(s,{uid:'food-worker',x:2,y:2,path:[],appearance:0,task:{kind:'serve',picked:true,foodId:r.id}},true,0,false);v.drawMeal(s,{seat:chair.uid,foodId:r.id});}finally{v.sprite=orig;}
   cases.push({id:r.id,dir,route,source:{width:im?.width,height:im?.height},tile:v.tile,calls});
  }return cases;
 });
 for(const c of results.rendering){assert.equal(c.calls.length,3);for(let i=0;i<3;i++){const draw=c.calls[i];assert.ok(Math.abs(draw.w/c.tile-[.42,.30,.27][i])<1e-8);assert.ok(Math.abs(draw.w/draw.h-c.source.width/c.source.height)<1e-8);}}
 if(browserName==='chromium')for(const r of recipes.filter(r=>r.sprite>=16)){
  await page.evaluate(async()=>{const g=window.__BAMSONNIM__,{RECIPES}=await import('/src/data.js');Object.assign(g.state,g.engine.newGame());const s=g.state;s.coins=1e7;s.hearts=1e6;s.level=32;s.mastery=Object.fromEntries(RECIPES.map(r=>[r.id,999]));s.events.christmas='active';s.spawnIn=1e9;s.objects=[{uid:'life-stove',type:'stove',x:1,y:1,dir:0},{uid:'life-server',type:'server',x:5,y:1,dir:0},{uid:'life-table',type:'table',x:3,y:4,dir:0},{uid:'life-chair',type:'chair',x:3,y:5,dir:3}];g.pause();});
  await page.locator('[data-act="cookbook"]').first().tap();await page.locator(`[data-act="book-tab"][data-n="${r.book}"]`).tap();while(!await page.locator(`[data-act="cook"][data-id="${r.id}"]`).count())await page.locator('[data-act="book-page"][data-n="1"]').tap();
  await page.locator(`[data-act="cook"][data-id="${r.id}"]`).tap();await page.waitForFunction(()=>!document.querySelector('dialog').open);assert.equal(await page.evaluate(()=>window.__BAMSONNIM__.state.objects[0].cook.foodId),r.id);
  await page.evaluate(()=>window.__BAMSONNIM__.pause());const point=await page.evaluate(()=>{const v=window.__BAMSONNIM__.view,h=v.hits.find(h=>h.uid==='life-stove'&&h.kind==='stove'),r=v.canvas.getBoundingClientRect();return{x:r.x+h.x+h.w/2,y:r.y+h.y+h.h/2};});await page.touchscreen.tap(point.x,point.y);await page.locator('[data-act="instant"]').tap();await page.locator('[data-act="collect"]').tap();await page.waitForFunction(()=>!document.querySelector('dialog').open);
  const flow=await page.evaluate(async id=>{
   const g=window.__BAMSONNIM__,s=g.state,E=g.engine,v=g.view,{foodFrame}=await import('/src/assets.js'),{recipe}=await import('/src/data.js'),route=foodFrame(recipe(id).sprite),chair=s.objects.find(o=>o.type==='chair'),events=[],snapshots={};let transferred=false,spawned=false,dirty=false;
   const capture=stage=>{const calls=[],orig=v.sprite;v.sprite=function(key,index,x,y,w,h,...args){calls.push({key,index,x,y,w,h});return orig.call(this,key,index,x,y,w,h,...args);};try{v.draw(s,null,0,false);snapshots[stage]={time:s.time,calls,canvas:v.canvas.toDataURL()};}finally{v.sprite=orig;}};
   for(let i=0;i<1200;i++){
    E.advance(s,.25);const w=s.waiters[0],task=w.task;if(task&&(task.foodId===id||task.kind==='transfer'&&s.transfers.find(t=>t.uid===task.transfer)?.foodId===id)){const event=`${task.kind}-${!!task.picked}`;if(!events.includes(event))events.push(event);}
    const server=s.objects.find(o=>o.type==='server');if(!transferred&&server.stock>0){transferred=true;capture('stock');s.spawnIn=0;}
    if(s.customers.length&&!spawned){spawned=true;s.spawnIn=1e9;}
    if(!snapshots.eating&&s.customers.some(c=>c.phase==='eating'&&c.foodId===id))capture('eating');
    if(chair.dirty&&!dirty){dirty=true;capture('dirty');}
    if(dirty&&!chair.dirty){capture('clean');break;}
   }
   return{id,route,events,transferred,spawned,stats:s.stats,stock:s.objects.find(o=>o.type==='server').stock,notifications:s.notifications.filter(n=>n.type==='payment'),snapshots};
  },r.id);
  results.lifecycles.push(flow);assert.ok(flow.transferred&&flow.spawned,`${r.id} transfer/arrival`);assert.deepEqual(Object.keys(flow.snapshots),['stock','eating','dirty','clean'],`${r.id} entire lifecycle`);for(const phase of ['transfer-false','transfer-true','serve-false','serve-true'])assert.ok(flow.events.includes(phase),`${r.id} ${phase}`);assert.equal(flow.stats.cooked,1);assert.equal(flow.stats.sold,1);assert.equal(flow.stock,r.servings-r.portion);assert.ok(flow.notifications.length===1);assert.equal(flow.notifications[0].amount,r.price*r.portion,'Payment equals the served portion times unit price');
  const {key,index}=flow.route;assert.equal(flow.snapshots.eating.calls.filter(c=>c.key===key&&c.index===index).length,2,'Server pile plus table meal');assert.equal(flow.snapshots.dirty.calls.filter(c=>c.key==='emptyDish').length,1);assert.equal(flow.snapshots.clean.calls.filter(c=>c.key==='emptyDish').length,0);
  for(const [stage,snapshot]of Object.entries(flow.snapshots)){if(['gopchang-jeongol','hell-pizza-bun','spider-mandu'].includes(r.id))await fs.writeFile(`${out}/${r.id}-${stage}.png`,Buffer.from(snapshot.canvas.split(',')[1],'base64'));delete snapshot.canvas;}
  console.log(`lifecycle ${r.id}: passed`);
 }
 results.pointerTypes=await page.evaluate(()=>foodPointers);assert.ok(results.pointerTypes.length>0&&results.pointerTypes.every(t=>t==='touch'));assert.deepEqual(errors,[]);results.errors=errors;results.passed=true;
}catch(error){results.passed=false;results.error=error.stack;throw error;}finally{await fs.writeFile(`${out}/results.json`,JSON.stringify(results,null,2));await browser.close();}
