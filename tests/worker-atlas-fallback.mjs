import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/assets/workers-infected-browless-v1.png',route=>route.abort());
 await page.goto(process.env.BASE_URL||'http://127.0.0.1:5197',{waitUntil:'networkidle'});await page.waitForFunction(()=>window.__BAMSONNIM__?.view.ready);
 const results=await page.evaluate(async()=>{
  const g=window.__BAMSONNIM__,v=g.view,{workerInfectedSprite}=await import('/src/worker-art.js');g.pause();
  if(!v.failedAssets.includes('workersInfected'))throw Error('Missing atlas fixture did not fail');
  const results=[];
  for(let appearance=0;appearance<8;appearance++){
   const base=v.sprites.workers[appearance],filtered=workerInfectedSprite(base,{infected:true}),pixels=filtered.getContext('2d').getImageData(0,0,filtered.width,filtered.height).data;
   let samples=0,green=0;for(let i=0;i<pixels.length;i+=4)if(pixels[i+3]>128&&Math.max(...pixels.slice(i,i+3))>70){samples++;if(pixels[i+1]>pixels[i]&&pixels[i+1]>pixels[i+2])green++;}
   if(filtered===base||green/samples<.95)throw Error('Unsafe green fallback '+appearance);
   const s=g.engine.newGame(),w=s.waiters[0];Object.assign(w,{appearance,infectedUntil:300,x:0,y:0,path:[],task:null});s.objects=[];s.customers=[];
   const target=document.createElement('canvas');target.width=120;target.height=145;
   const q=Object.create(v);q.ctx=target.getContext('2d');q.tile=105;q.origin={x:60,y:130};q.hits=[];q.actorMarkers=[];q.animating=false;q.motionPreference={matches:false};q.walkingStates=new WeakMap();
   const used=[],sprite=q.sprite;q.sprite=function(key,...args){used.push(key);return sprite.call(this,key,...args);};
   q.drawPerson(s,w,true,.1);if(used[0]!=='workers')throw Error('Renderer did not select original fallback');
   const before=s.coins;if(g.engine.cure(s,w.uid)!==null||s.coins!==before-25)throw Error('Actual cure failed');
   q.ctx.clearRect(0,0,120,145);q.drawPerson(s,w,true,.1);const recovered=q.ctx.getImageData(0,0,120,145).data.slice();
   w.infectedUntil=s.time;q.ctx.clearRect(0,0,120,145);q.drawPerson(s,w,true,.1);const expired=q.ctx.getImageData(0,0,120,145).data;
   if(!recovered.every((x,i)=>x===expired[i]))throw Error('Cure/expiry mismatch');results.push({appearance,greenRatio:green/samples,cureCost:25,recoveredExact:true});
  }
  const s=g.state;s.level=30;s.coins=1e6;while(s.waiters.length<8)g.engine.hire(s);for(const w of s.waiters)w.infectedUntil=s.time+300;g.open('hire');return results;
 });
 assert.equal(results.length,8);const portraits=await page.locator('.staff-card > .sprite').evaluateAll(elements=>elements.map(e=>({image:e.style.backgroundImage,filter:getComputedStyle(e).filter})));
 assert.equal(portraits.length,8);assert.ok(portraits.every(p=>p.image.includes('/assets/workers.png')&&p.filter!=='none'));assert.deepEqual(errors,[]);
 console.log(JSON.stringify({results,portraits,pageErrors:errors}));
}finally{await browser.close();}
