import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium,webkit} from 'playwright';
const base=process.env.BASE_URL||'http://127.0.0.1:5181',out=process.env.HUD_OUTPUT||'artifacts/dokkaebi-hud';
await fs.mkdir(out,{recursive:true});const results=[];
for(const [browserName,type] of [['chromium',chromium],['webkit',webkit]]){
 const browser=await type.launch();try{for(const viewport of [{width:1280,height:800},{width:1024,height:768},{width:768,height:600},{width:844,height:390},{width:568,height:320},{width:568,height:240}]){
  const p=await browser.newPage({viewport}),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto(base);await p.waitForFunction(()=>window.__BAMSONNIM__?.view.ready);
  const result=await p.evaluate(()=>{
   const g=window.__BAMSONNIM__,v=g.view,s=g.state;g.pause();s.hunger=85;s.spawnIn=9999;
   const w=s.waiters[0],a={uid:'red-review',zombieId:'red',red:true,x:3,y:3,path:[],phase:'chasing',wait:0,chaseTime:0,target:w.uid,enteredAt:s.time};s.customers=[a];
   const original=v.sprite,calls=[];v.sprite=function(...args){calls.push({key:args[0],index:args[1],filter:args[6]?.filter||''});return original.apply(this,args);};
   const frames=[];
   try{for(const [dx,dy] of [[1,0],[0,1],[-1,0],[0,-1]]){a.path=[[a.x+dx,a.y+dy]];v.walkingStates.delete(a);calls.length=0;v.drawPerson(s,a,false,0);frames.push({...calls.find(c=>c.key==='zombieDokkaebi')});}
    const chair=s.objects.find(o=>o.type==='chair');a.seat=chair.uid;a.x=chair.x;a.y=chair.y;
    for(const phase of ['waiting','eating']){a.phase=phase;a.foodId='rice';calls.length=0;v.drawPerson(s,a,false,0);frames.push({...calls.find(c=>c.key==='zombieDokkaebi')});}
   }finally{v.sprite=original;}
   Object.assign(a,{x:w.x+1.4,y:w.y,path:[],phase:'chasing',seat:null});g.pause();
   const rect=el=>{const r=el.getBoundingClientRect();return{x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};
   return {frames,header:rect(document.querySelector('.topbar')),items:[...document.querySelector('.topbar').children].filter(el=>getComputedStyle(el).display!=='none').map(el=>({name:el.className,...rect(el)})),hungerInHeader:!!document.querySelector('.topbar .hunger-card'),caption:!!document.querySelector('#hunger-caption'),hunger:document.querySelector('[role=progressbar]').getAttribute('aria-valuenow'),failedAssets:v.failedAssets};
  });
  assert.equal(result.hungerInHeader,true);assert.equal(result.caption,false);assert.equal(result.hunger,'85');assert.deepEqual(result.failedAssets,[]);
  assert.equal(result.frames.length,6);for(const [i,frame] of result.frames.entries()){assert.equal(frame.key,'zombieDokkaebi');assert.equal(frame.filter,'');if(i<4)assert.equal(Math.floor(frame.index/4),i);else assert.equal(frame.index%4,3);}
  for(const item of result.items){assert.ok(item.x>=result.header.x-1&&item.right<=result.header.right+1,`${item.name} outside header at ${viewport.width}`);assert.ok(item.bottom<=result.header.bottom+1);}
  for(let i=1;i<result.items.length;i++)assert.ok(result.items[i].x>=result.items[i-1].right-1,`Header items overlap at ${viewport.width}`);
  await p.screenshot({path:`${out}/${browserName}-${viewport.width}x${viewport.height}.png`});
  const bite=await p.evaluate(()=>{const g=window.__BAMSONNIM__,s=g.state,w=s.waiters[0],a=s.customers[0];a.x=w.x;a.y=w.y;g.advance(.25);return {duration:w.infectedUntil-s.time,notification:s.notifications.at(-1).message,redId:a.zombieId};});assert.equal(bite.duration,300);assert.match(bite.notification,/물렸어요/);assert.equal(bite.redId,'red');assert.deepEqual(errors,[]);
  results.push({browserName,viewport,...result,bite});console.log(browserName,viewport.width,viewport.height,'passed');await p.close();
 }}finally{await browser.close();}
}
await fs.writeFile(`${out}/results.json`,JSON.stringify(results,null,2));console.log(`${results.length} art and HUD cases passed`);
