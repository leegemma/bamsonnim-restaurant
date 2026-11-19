import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium,webkit} from 'playwright';
const baseURL=process.env.BASE_URL||'http://127.0.0.1:5197',out=process.env.SEASON_OUTPUT||'/tmp/seasonal-render';await fs.mkdir(out,{recursive:true});
const results=[];
for(const [name,type] of [['chromium',chromium],['webkit',webkit]]){
 const browser=await type.launch({headless:true});
 try{for(const viewport of [{width:1280,height:800},{width:568,height:320}]){
  const context=await browser.newContext({viewport}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));let winterRequests=0;page.on('request',r=>{if(r.url().includes('night-ruins-winter-v1.png'))winterRequests++;});
  await page.goto(baseURL,{waitUntil:'networkidle'});await page.waitForFunction(()=>window.__BAMSONNIM__?.view.ready);await page.evaluate(()=>window.__BAMSONNIM__.pause());assert.equal(winterRequests,0);
  const hats=await page.evaluate(()=>{
   const g=window.__BAMSONNIM__,v=g.view,output=document.createElement('canvas');output.width=800;output.height=1640;const ctx=output.getContext('2d');ctx.fillStyle='#203930';ctx.fillRect(0,0,800,1640);ctx.fillStyle='#fff0cc';ctx.font='13px monospace';['ORIGINAL','SANTA','INFECTED SANTA','FLIPPED SANTA'].forEach((x,i)=>ctx.fillText(x,i*200+6,18));
   const checks=[],original=s=>s.getContext('2d').getImageData(0,0,s.width,s.height).data.slice();
   for(let appearance=0;appearance<8;appearance++){
    const source=v.sprites.workers[appearance],before=original(source),infectedSource=v.sprites.workersInfected[appearance],infectedBefore=original(infectedSource),idleHats=new Map();
    function render(season,infected,mode,transition=''){
     const canvas=document.createElement('canvas');canvas.width=200;canvas.height=200;const q=Object.create(v);Object.assign(q,{ctx:canvas.getContext('2d'),tile:105,origin:{x:100,y:190},hits:[],actorMarkers:[],staffSeasonalHats:[],animating:mode>0,motionPreference:{matches:false},walkingStates:new WeakMap()});
     const s=g.engine.newGame(),w={uid:'santa-'+appearance,name:'직원',appearance,x:0,y:0,path:mode?[[mode===2?-1:1,0]]:[],task:null,infectedUntil:infected?300:0};s.objects=[];s.customers=[];s.waiters=[w];s.time=1;s.events.christmas=season;
     if(transition==='cure'&&g.engine.cure(s,w.uid)!==null)throw Error('Actual cure failed');if(transition==='expire')s.time=300;
     const state=JSON.stringify(s);q.drawPerson(s,w,true,.1);if(JSON.stringify(s)!==state)throw Error('Cosmetic rendering mutated game state');
     return{canvas,pixels:original(canvas),hat:q.staffSeasonalHats[0]||null,marker:q.actorMarkers[0]||null};
    }
    for(let mode=0;mode<3;mode++)for(const infected of [false,true]){
     const beforeHat=render('upcoming',infected,mode),active=render('active',infected,mode),ended=render('ended',infected,mode);
     if(beforeHat.hat||ended.hat||!active.hat)throw Error('Hat season gate failed');if(!beforeHat.pixels.every((x,i)=>x===ended.pixels[i]))throw Error('Ended season did not restore original pixels');
     let changed=0;for(let i=0;i<active.pixels.length;i++)if(active.pixels[i]!==beforeHat.pixels[i])changed++;if(changed<100)throw Error('Hat not visible');
     const body=v.sprites[infected?'workersInfected':'workers'][appearance],protectedY=Math.ceil(195-105*1.02+105*1.02*.06);
     for(let y=protectedY;y<200;y++)for(let x=0;x<200*4;x++){const i=y*200*4+x;if(active.pixels[i]!==beforeHat.pixels[i])throw Error('Hat covered face/body below crown');}
     if(mode===0)idleHats.set(infected,active.hat);if(mode===1&&JSON.stringify(active.hat)!==JSON.stringify(idleHats.get(infected)))throw Error('Hat drifted while walking');
     if(infected){if(!active.marker||active.marker.y>=active.hat.y)throw Error('Cure marker overlaps hat');const cured=render('active',true,mode,'cure'),expired=render('active',true,mode,'expire'),healthy=render('active',false,mode);if(!cured.pixels.every((x,i)=>x===healthy.pixels[i]&&x===expired.pixels[i]))throw Error('Cure/expiry did not restore healthy hat appearance');}
     checks.push({appearance,mode,infected,changed,originalRestored:true});
     if(mode===0&&!infected){ctx.drawImage(beforeHat.canvas,0,appearance*200+32);ctx.drawImage(active.canvas,200,appearance*200+32);}if(mode===0&&infected)ctx.drawImage(active.canvas,400,appearance*200+32);if(mode===2&&!infected)ctx.drawImage(active.canvas,600,appearance*200+32);
    }
    const after=original(source),infectedAfter=original(infectedSource);if(!before.every((x,i)=>x===after[i])||!infectedBefore.every((x,i)=>x===infectedAfter[i]))throw Error('Source art was mutated');
   }
   return{checks,png:output.toDataURL()};
  });assert.equal(hats.checks.length,48);await fs.writeFile(`${out}/${name}-${viewport.width}-staff.png`,Buffer.from(hats.png.split(',')[1],'base64'));
  const lifecycle=await page.evaluate(async()=>{
   const g=window.__BAMSONNIM__,v=g.view,s=g.state;s.events.christmas='active';s.size=16;await v.ensureAsset('nightWinter');if(!(v.images.nightWinter instanceof HTMLImageElement)||v.sprites.nightWinter)throw Error('Backdrop was incorrectly cut into sprites');
   const originalDraw=v.ctx.drawImage,originalFill=v.ctx.fillRect,frames=[];let captures=[],bugs=0;
   v.ctx.drawImage=function(im,...args){if(im===v.images.night||im===v.images.nightWinter){const m=this.getTransform();captures.push({key:im===v.images.nightWinter?'winter':'normal',args,transform:[m.a,m.b,m.c,m.d,m.e,m.f]});}return originalDraw.call(this,im,...args);};v.ctx.fillRect=function(...args){if(/^rgba\(226,\s*220,\s*143,/.test(this.fillStyle))bugs++;return originalFill.call(this,...args);};
   try{for(const season of ['upcoming','active','ended'])for(const zoom of [.7,1.4,1.8]){s.events.christmas=season;v.commitCamera({zoom,panX:zoom===1.8?100:0,panY:zoom===.7?-40:0});captures=[];bugs=0;const before=JSON.stringify(s);v.draw(s,null,1,false);if(JSON.stringify(s)!==before)throw Error('Scene rendering mutated save');frames.push({season,zoom,captures,bugs,selected:v.seasonalBackground,effects:v.backgroundEffects.length});}}finally{v.ctx.drawImage=originalDraw;v.ctx.fillRect=originalFill;}
   s.events.christmas='active';g.save();return{frames,width:v.width,height:v.height,dpr:v.dpr};
  });
  for(const frame of lifecycle.frames){assert.equal(frame.captures.length,1);assert.equal(frame.selected.key,frame.season==='active'?'nightWinter':'night');assert.equal(frame.effects,frame.season==='active'?0:2);assert.equal(frame.bugs,frame.season==='active'?0:16);assert.deepEqual(frame.captures[0].transform,[lifecycle.dpr,0,0,lifecycle.dpr,0,0]);const [x,y,w,h]=frame.captures[0].args;assert.ok(x<=0&&y<=0&&x+w>=lifecycle.width-1e-6&&y+h>=lifecycle.height-1e-6);}
  for(const season of ['upcoming','active','ended']){const frames=lifecycle.frames.filter(f=>f.season===season);assert.ok(frames.every(f=>JSON.stringify(f.captures)===JSON.stringify(frames[0].captures)));}
  await page.reload({waitUntil:'networkidle'});await page.waitForFunction(()=>window.__BAMSONNIM__?.view.ready&&window.__BAMSONNIM__.view.seasonalBackground?.key==='nightWinter');assert.equal(await page.evaluate(()=>window.__BAMSONNIM__.state.events.christmas),'active');assert.deepEqual(errors,[]);results.push({browser:name,viewport,staff:hats.checks.length,lifecycle:lifecycle.frames,reload:'active season preserved'});console.log(name,viewport.width,'48 staff combinations + 9 scene frames + reload PASS');await context.close();
 }
  const context=await browser.newContext(),page=await context.newPage();let requests=0;await page.route('**/night-ruins-winter-v1.png',route=>{requests++;return route.abort();});await page.goto(baseURL,{waitUntil:'networkidle'});await page.waitForFunction(()=>window.__BAMSONNIM__?.view.ready);
  const fallback=await page.evaluate(async()=>{const g=window.__BAMSONNIM__,v=g.view,s=g.state;g.pause();s.events.christmas='active';await v.ensureAsset('nightWinter');for(let i=0;i<10;i++)v.draw(s,null,1,false);return{selected:v.seasonalBackground,effects:v.backgroundEffects.length,retry:v.optionalAssetRetryAt.has('nightWinter'),winterLoaded:!!v.images.nightWinter};});assert.equal(fallback.selected.key,'night');assert.equal(fallback.selected.fallback,true);assert.equal(fallback.effects,2);assert.equal(fallback.winterLoaded,false);assert.equal(fallback.retry,true);assert.equal(requests,1);results.push({browser:name,fallback,requests});console.log(name,'failed winter load safely retains original scene, retries bounded PASS');await context.close();
 }finally{await browser.close();}
}
await fs.writeFile(`${out}/results.json`,JSON.stringify(results,null,2));
