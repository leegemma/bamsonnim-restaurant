import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium,webkit} from 'playwright';

const base=process.env.BASE_URL||'http://127.0.0.1:5173',out=process.env.HUNGER_OUTPUT||'/tmp/hunger-bubble-1';
await fs.mkdir(out,{recursive:true});const results=[];
for(const [name,type] of [['chromium',chromium],['webkit',webkit]]){
 const browser=await type.launch();
 try{
  const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));await page.goto(base);
  await page.waitForFunction(()=>window.__BAMSONNIM__?.view.ready);
  const coverage=await page.evaluate(async()=>{
   const {ZOMBIES}=await import('/src/data.js'),g=window.__BAMSONNIM__,v=g.view;g.pause();
   if(v.failedAssets.length)throw new Error(`Missing assets: ${v.failedAssets}`);
   const asset=v.sprites.hungerThought[0];if(asset.width!==777||asset.height!==1015)throw new Error('Asset must trim to visible alpha bounds');
   const state=g.engine.newGame(),records=[];
   const canvas=document.createElement('canvas');canvas.width=1280;canvas.height=ZOMBIES.length*180;
   const ctx=canvas.getContext('2d');ctx.fillStyle='#173936';ctx.fillRect(0,0,canvas.width,canvas.height);
   const oldCtx=v.ctx,oldWorld=v.world,oldTile=v.tile;v.ctx=ctx;v.tile=110;
   for(const [row,z] of ZOMBIES.entries())for(let seated=0;seated<2;seated++)for(let dir=0;dir<4;dir++){
    const col=seated*4+dir,point={x:col*160+80,y:row*180+165};v.world=()=>point;
    const chair={uid:'pose-chair',type:'chair',x:3,y:3,dir};state.objects=seated?[chair,{uid:'pose-table',type:'table',x:3+[[1,0],[0,1],[-1,0],[0,-1]][dir][0],y:3+[[1,0],[0,1],[-1,0],[0,-1]][dir][1],dir:0}]:[];
    const actor={uid:`${z.id}-${seated}-${dir}`,zombieId:z.id,x:3,y:3,phase:seated?'waiting':'seating',seat:seated?chair.uid:null,path:seated?[]:[[[4,3],[3,4],[2,3],[3,2]][dir]],wait:29,red:!!z.red};
    v.hungerLayout=[];v.labelRects=[];v.guestLabels=[];v.drawPerson(state,actor,false,0,false);v.drawHungerBubbles();
    const b=v.hungerLayout[0];if(!b||!Number.isFinite(b.x)||Math.abs(b.w-110*.4257234042553192)>1e-8||Math.abs(b.x+b.w/2-b.head.x)>1e-8||b.y+b.h>=b.head.y)throw new Error(`Head alignment failed: ${actor.uid}`);
    if(v.guestLabels.length)throw new Error('Waiting speech overlaps hunger bubble');
    records.push({actor:z.id,seated:!!seated,dir,atlas:b.atlas,index:b.index});
    ctx.fillStyle='#eee';ctx.font='11px sans-serif';ctx.fillText(`${z.id} ${seated?'sit':'walk'} ${dir}`,col*160+5,row*180+178);
   }
   v.ctx=oldCtx;v.world=oldWorld;v.tile=oldTile;
   window.hungerPoseMontage=canvas.toDataURL();return records;
  });
  await fs.writeFile(`${out}/${name}-all-poses.png`,Buffer.from((await page.evaluate(()=>window.hungerPoseMontage)).split(',')[1],'base64'));
  await page.evaluate(()=>{
   const g=window.__BAMSONNIM__;Object.assign(g.state,g.engine.newGame());g.state.stats.served=1;
   for(let i=0;i<200&&!g.state.customers.some(c=>c.phase==='waiting');i++)g.engine.advance(g.state,.25);
   const c=g.state.customers.find(c=>c.phase==='waiting');if(!c)throw new Error('Waiting fixture not reached');
   window.hungryUid=c.uid;g.view.draw(g.state,null,0,false);
  });
  const snapshot=()=>page.evaluate(()=>{const g=window.__BAMSONNIM__,c=g.state.customers.find(c=>c.uid===window.hungryUid);g.view.draw(g.state,g.edit,0,false);return {phase:c?.phase,uid:c?.uid,bubble:g.view.hungerLayout.some(b=>b.uid===window.hungryUid),stock:g.state.objects.find(o=>o.type==='server').stock||0,task:g.state.waiters[0].task,dialogue:g.view.dialogueLayout};});
  assert.equal((await snapshot()).bubble,true);
  await page.screenshot({path:`${out}/${name}-before-stock.png`});
  await page.evaluate(()=>{const g=window.__BAMSONNIM__;Object.assign(g.state.objects.find(o=>o.type==='server'),{foodId:'rice',stock:100});g.engine.advance(g.state,.25);});
  const stocked=await snapshot();assert.ok(stocked.stock>0);assert.equal(stocked.bubble,true);assert.equal(stocked.phase,'waiting');assert.equal(stocked.task.customer,stocked.uid);
  await page.screenshot({path:`${out}/${name}-stocked-undelivered.png`});
  await page.evaluate(()=>{const g=window.__BAMSONNIM__;for(let i=0;i<200&&!g.state.waiters.some(w=>w.task?.customer===window.hungryUid&&w.task.picked);i++)g.engine.advance(g.state,.25);});
  const inTransit=await snapshot();assert.equal(inTransit.phase,'waiting');assert.equal(inTransit.bubble,true);assert.equal(inTransit.task.picked,true);
  await page.screenshot({path:`${out}/${name}-carried-undelivered.png`});
  await page.evaluate(()=>{const g=window.__BAMSONNIM__;for(let i=0;i<200&&g.state.customers.find(c=>c.uid===window.hungryUid)?.phase!=='eating';i++)g.engine.advance(g.state,.25);});
  const delivered=await snapshot();assert.equal(delivered.phase,'eating');assert.equal(delivered.bubble,false);assert.ok(delivered.dialogue.length,'Eating dialogue remains available');
  await page.screenshot({path:`${out}/${name}-delivered.png`});
  await page.evaluate(()=>{const g=window.__BAMSONNIM__;g.state.customers.find(c=>c.uid===window.hungryUid).phase='leaving';});
  assert.equal((await snapshot()).bubble,false);
  const exclusions=await page.evaluate(()=>{
   const g=window.__BAMSONNIM__,v=g.view,c=g.state.customers.find(c=>c.uid===window.hungryUid),labels=[],label=v.label;
   v.label=function(text,...args){labels.push(text);return label.call(this,text,...args);};
   c.phase='waiting';c.removed=true;v.draw(g.state,null,0,false);const removed=!v.hungerLayout.some(b=>b.uid===c.uid);
   delete c.removed;c.red=true;g.state.waiters[0].infectedUntil=g.state.time+100;
   v.draw(g.state,null,0,false);const danger=labels.includes('!'),infection=labels.includes('치료'),workerExcluded=v.hungerLayout.every(b=>!g.state.waiters.some(w=>w.uid===b.uid));
   delete c.red;g.state.waiters[0].infectedUntil=0;v.label=label;return {removed,danger,infection,workerExcluded};
  });
  assert.deepEqual(exclusions,{removed:true,danger:true,infection:true,workerExcluded:true});
  // The same scene coordinates are transformed by the shared camera matrix.
  const camera=await page.evaluate(()=>{const g=window.__BAMSONNIM__,c=g.state.customers.find(c=>c.uid===window.hungryUid);c.phase='waiting';const keys=Object.keys(c);g.view.draw(g.state,null,0,false);const a=g.view.hungerLayout.find(b=>b.uid===c.uid),before=g.view.sceneToScreen(a);g.view.zoomCamera(1.2);const zoomed=g.view.sceneToScreen(a);g.view.commitCamera({...g.view.camera,panX:g.view.camera.panX+15});g.view.draw(g.state,null,0,false);const b=g.view.hungerLayout.find(b=>b.uid===c.uid),after=g.view.sceneToScreen(b);return {same:JSON.stringify(a)===JSON.stringify(b),zoomed:before.x!==zoomed.x||before.y!==zoomed.y,panned:after.x!==zoomed.x,noFlags:JSON.stringify(keys)===JSON.stringify(Object.keys(c))};});
  assert.deepEqual(camera,{same:true,zoomed:true,panned:true,noFlags:true});
  await page.locator('[data-act="decorate"]').click();await page.waitForFunction(()=>!!window.__BAMSONNIM__.edit);
  await page.evaluate(()=>{const g=window.__BAMSONNIM__;g.view.draw(g.state,g.edit,0,false);});
  assert.equal(await page.evaluate(()=>window.__BAMSONNIM__.view.hungerLayout.length),0);
  assert.deepEqual(errors,[]);results.push({browser:name,poses:coverage.length,actors:new Set(coverage.map(p=>p.actor)).size,stocked,inTransit,delivered,exclusions,camera,passed:true});
  console.log(`${name}: ${coverage.length} actor poses, actual stock/delivery lifecycle, dialogue, camera and decoration PASS`);
 }finally{await browser.close();}
}
await fs.writeFile(`${out}/results.json`,JSON.stringify(results,null,2));
