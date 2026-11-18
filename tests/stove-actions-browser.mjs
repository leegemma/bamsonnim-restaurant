import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium, webkit} from 'playwright';
import {recipe, SAVE_KEY} from '../src/data.js';

const baseURL=process.env.BASE_URL||'http://127.0.0.1:5202';
const output=process.env.STOVE_ACTIONS_OUTPUT||'artifacts/stove-actions';
const views=[
 {width:1280,height:800,touch:false},
 {width:844,height:390,touch:true},
];
const results=[];
const outputPath=`${output}/browser-results.json`;
await fs.mkdir(output,{recursive:true});

async function setup(page){
 await page.goto(baseURL);
 await page.waitForFunction(()=>window.__BAMSONNIM__?.view.ready);
 return page.evaluate(()=>{
  const g=window.__BAMSONNIM__,s=g.state,stove=s.objects.find(o=>o.type==='stove');
  s.spawnIn=1e9;
  s.settings.music=0;
  s.settings.sfx=0;
  const error=g.engine.cook(s,stove.uid,'rice');
  if(error)throw Error(error);
  g.advance(1);
  g.view.draw(s,null,0,false);
  const hit=g.view.hits.find(h=>h.kind==='stove'&&h.uid===stove.uid);
  const world=document.querySelector('#world').getBoundingClientRect();
  const screen=g.view.sceneToScreen({x:hit.x+hit.w/2,y:hit.y+hit.h/2});
  return {x:world.x+screen.x,y:world.y+screen.y};
 });
}

async function snapshot(page){
 return page.evaluate(saveKey=>{
  const g=window.__BAMSONNIM__,s=g.state,stove=s.objects.find(o=>o.type==='stove');
  const server=s.objects.find(o=>o.type==='server'),saved=JSON.parse(localStorage.getItem(saveKey));
  return {
   hearts:s.hearts,status:g.engine.stoveStatus(s,stove),stock:server.stock||0,cooked:s.stats.cooked,
   mastery:s.mastery.rice||0,foodId:server.foodId||null,savedHearts:saved.hearts,
   savedStock:saved.objects.find(o=>o.uid===server.uid).stock||0,
  };
 },SAVE_KEY);
}

async function press(page, act, input, holdMs, cdp, completesDuringPress=false){
 const button=page.locator(`#dialog [data-act="${act}"]`);
 const point=await button.evaluate(node=>{
  node.scrollIntoView({block:'nearest'});
  const {x,y,width,height}=node.getBoundingClientRect();
  const point={x:Math.round(x+width/2),y:Math.round(y+height/2)};
  const body=document.querySelector('#dialog-content'),wallet=document.querySelector('#hearts');
  const trace={node,events:[],refreshes:0,replacements:0};
  window.stovePressTrace=trace;
  const observer=new MutationObserver(records=>{
   for(const record of records){
    if(record.target===wallet)trace.refreshes++;
    if(record.target===body)trace.replacements++;
   }
  });
  observer.observe(wallet,{childList:true});
  observer.observe(body,{childList:true});
  const listeners=new AbortController();
  trace.stop=()=>{observer.disconnect();listeners.abort();};
  for(const type of ['pointerdown','pointerup','pointercancel','click']){
   const listen=event=>{
    const action=event.target.closest?.('[data-act]')?.dataset.act||null;
    trace.events.push({type,action,pointer:event.pointerType||null,trusted:event.isTrusted,time:performance.now()});
    if(type==='pointerdown')trace.refreshesAtDown=trace.refreshes;
   };
   document.addEventListener(type,listen,{capture:true,once:true,signal:listeners.signal});
  }
  if(!node.contains(document.elementFromPoint(point.x,point.y)))throw Error('Button is obscured');
  return point;
 });
 if(holdMs){
  if(input==='touch'){
   await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point]});
  }else{
   await page.mouse.move(point.x,point.y);
   await page.mouse.down();
  }
  if(completesDuringPress){
   await page.evaluate(()=>window.__BAMSONNIM__.advance(12));
   await page.locator('#dialog [data-act="collect"]').waitFor({state:'visible'});
  }
  await page.waitForFunction(holdMs=>{
   const t=window.stovePressTrace,down=t.events.find(e=>e.type==='pointerdown');
   return down&&performance.now()-down.time>=holdMs&&t.refreshes>t.refreshesAtDown;
  },holdMs);
 }else if(input==='touch'){
  await page.touchscreen.tap(point.x,point.y);
 }else{
  await page.mouse.click(point.x,point.y);
 }
 const beforeRelease=holdMs?await page.evaluate(()=>{
  const t=window.stovePressTrace;
  return {connected:t.node.isConnected,refreshes:t.refreshes-t.refreshesAtDown,replacements:t.replacements};
 }):null;
 if(holdMs){
  if(input==='touch')await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  else await page.mouse.up();
 }
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 return page.evaluate(beforeRelease=>{
  const t=window.stovePressTrace;
  t.stop();
  return {beforeRelease,events:t.events};
 },beforeRelease);
}

function verifyPress(trace,act,input){
 if(trace.beforeRelease){
  assert.ok(trace.beforeRelease.refreshes>=1,'held across a live UI refresh');
  assert.equal(trace.beforeRelease.connected,true,'pressed button survives refresh');
  assert.equal(trace.beforeRelease.replacements,0,'dialog subtree survives refresh');
 }
 for(const type of ['pointerdown','pointerup','click']){
  const events=trace.events.filter(event=>event.type===type);
  assert.equal(events.length,1,`one ${type}`);
  assert.equal(events[0].action,act,`${type} targets the same button`);
  assert.equal(events[0].trusted,true,`native ${type}`);
  if(type!=='click')assert.equal(events[0].pointer,input);
 }
 assert.equal(trace.events.some(e=>e.type==='pointercancel'),false);
}

for(const browserType of [chromium,webkit]){
 if(process.env.STOVE_BROWSER&&process.env.STOVE_BROWSER!==browserType.name())continue;
 const browser=await browserType.launch();
 try{
  for(const {width,height,touch} of views){
   const scenarios=[{input:touch?'touch':'mouse',holdMs:0}];
   // WebKit's public Playwright API supports native taps only. Test its
   // landscape layout with native touch taps and split mouse presses.
   const holdInput=touch&&browserType===chromium?'touch':'mouse';
   for(const holdMs of [410,800])scenarios.push({input:holdInput,holdMs});
   for(const {input,holdMs} of scenarios){
    const context=await browser.newContext({viewport:{width,height},isMobile:touch,hasTouch:touch});
    try{
     const page=await context.newPage(),errors=[];
     page.on('pageerror',error=>errors.push(error.message));
     const cdp=holdMs&&input==='touch'?await context.newCDPSession(page):null;
     const point=await setup(page);
     if(touch)await page.touchscreen.tap(point.x,point.y);
     else await page.mouse.click(point.x,point.y);
     const instant=page.locator('#dialog [data-act="instant"]');
     await instant.waitFor({state:'visible',timeout:5000});
     const before=await snapshot(page);
     const first=await press(page,'instant',input,holdMs,cdp);
     if(first.events.some(event=>event.type==='click'&&event.action==='instant')){
      await page.waitForFunction(hearts=>window.__BAMSONNIM__.state.hearts===hearts-1,before.hearts,{timeout:1500}).catch(()=>{});
     }
     const afterInstant=await snapshot(page);

     // A failed instant press is recorded before advancing time, so the same
     // negative run can exercise and record the independent collect failure.
     if(afterInstant.status==='cooking')await page.evaluate(()=>window.__BAMSONNIM__.advance(12));
     await page.locator('#dialog [data-act="collect"]').waitFor({state:'visible'});
     const beforeCollect=await snapshot(page);
     const second=await press(page,'collect',input,holdMs,cdp);
     const afterCollect=await snapshot(page);
     const dialogClosed=await page.locator('#dialog').evaluate(node=>!node.open);
     let crossing=null;
     if(holdMs&&afterCollect.status==='empty'){
      await page.evaluate(()=>{
       const g=window.__BAMSONNIM__,s=g.state,stove=s.objects.find(o=>o.type==='stove');
       const error=g.engine.cook(s,stove.uid,'rice');
       if(error)throw Error(error);
       g.open('stove',{stove:stove.uid});
      });
      const start=await snapshot(page);
      const trace=await press(page,'instant',input,holdMs,cdp,true);
      crossing={start,trace,end:await snapshot(page)};
     }
     const checks={
      instant:()=>verifyPress(first,'instant',input),
      instantState:()=>{
       assert.equal(afterInstant.status,'done');
       assert.equal(afterInstant.hearts,before.hearts-1);
       assert.equal(afterInstant.savedHearts,afterInstant.hearts);
       assert.equal(afterInstant.stock,before.stock);
       assert.equal(afterInstant.cooked,before.cooked);
      },
      collect:()=>verifyPress(second,'collect',input),
      collectState:()=>{
       assert.equal(afterCollect.status,'empty');
       assert.equal(afterCollect.hearts,beforeCollect.hearts);
       assert.equal(afterCollect.stock,beforeCollect.stock+recipe('rice').servings);
       assert.equal(afterCollect.savedStock,afterCollect.stock);
       assert.equal(afterCollect.foodId,'rice');
       assert.equal(afterCollect.cooked,beforeCollect.cooked+1);
       assert.equal(afterCollect.mastery,beforeCollect.mastery+1);
       assert.equal(dialogClosed,true);
      },
      crossing:()=>{
       if(!crossing)return;
       assert.equal(crossing.trace.beforeRelease.connected,false);
       assert.equal(crossing.end.status,'done');
       assert.equal(crossing.end.hearts,crossing.start.hearts);
       assert.equal(crossing.end.stock,crossing.start.stock);
       assert.equal(crossing.end.cooked,crossing.start.cooked);
      },
      pageErrors:()=>assert.deepEqual(errors,[]),
     };
     const failures={};
     for(const [label,check] of Object.entries(checks)){
      try{check();}catch(error){failures[label]=error.message;}
     }
     const name=`${browserType.name()}-${width}x${height}-${input}-${holdMs}`;
     results.push({name,before,first,afterInstant,beforeCollect,second,afterCollect,dialogClosed,crossing,failures});
     await fs.writeFile(outputPath,JSON.stringify({baseURL,results},null,2));
     console.log(name,Object.keys(failures).length?JSON.stringify(failures):'passed');
    }finally{await context.close();}
   }
  }
 }finally{await browser.close();}
}
assert.ok(results.length&&results.every(result=>!Object.keys(result.failures).length),'stove input regressions');
