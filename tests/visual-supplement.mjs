import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium} from 'playwright';
const output=process.env.SUPPLEMENT_OUTPUT||'artifacts/visual-supplement',base=process.env.BASE_URL||'http://127.0.0.1:5173';
await fs.mkdir(output,{recursive:true});const browser=await chromium.launch(),results=[];
try{
 for(const viewport of [{width:1280,height:800},{width:844,height:390},{width:568,height:320}]){
  const context=await browser.newContext({viewport,hasTouch:viewport.width<900}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base);await page.waitForFunction(()=>window.__BAMSONNIM__?.view.ready);await page.evaluate(()=>document.fonts.ready);
  const timers=await page.evaluate(()=>{
   const g=window.__BAMSONNIM__,v=g.view,s=g.state;g.pause();s.waiters=[];s.customers=[];s.objects=[180,240,300].map((n,i)=>({uid:`timer-${i}`,type:'stove',x:3+i,y:0,dir:0,cook:{foodId:'tteok',readyAt:s.time+n,spoilAt:s.time+1000}}));
   const labels=[],bars=[],original=v.label,fill=v.ctx.fillRect;
   v.label=function(text,x,y,opts){if(/^\d+분$/.test(text)){this.ctx.font='14px NeoDunggeunmo';const w=Math.ceil(this.ctx.measureText(text).width)+16;labels.push({text,x,y,left:Math.round(x-w/2),top:Math.round(y-24),right:Math.round(x-w/2)+w,bottom:Math.round(y),font:14});}return original.call(this,text,x,y,opts);};
   v.ctx.fillRect=function(x,y,w,h){if(h===3)bars.push({x,y,w,h});return fill.call(this,x,y,w,h);};
   try{v.draw(s,null,0,false);}finally{v.label=original;v.ctx.fillRect=fill;}
   const overlap=[];for(let i=0;i<labels.length;i++)for(let j=i+1;j<labels.length;j++){const a=labels[i],b=labels[j];if(a.left<b.right&&b.left<a.right&&a.top<b.bottom&&b.top<a.bottom)overlap.push([i,j]);}
   return{tile:v.tile,labels,bars,overlap,offsets:s.objects.map((o,i)=>{const geometry=v.furnitureGeometry(o);return labels[i].y-(geometry.y+geometry.h*(geometry.meta.bounds?.y||0)/geometry.meta.height);})};
  });
  assert.equal(timers.labels.length,3);assert.deepEqual(timers.labels.map(l=>l.text),['3분','4분','5분']);assert.ok(timers.offsets.every((y,i)=>timers.labels[i].y===28||Math.abs(y+timers.tile*.12)<1e-6));
  await page.screenshot({path:`${output}/timers-${viewport.width}.png`});
  assert.deepEqual(timers.overlap,[],'Adjacent timer badges remain readable');
  const selected=[];for(let i=0;i<3;i++){
   const point=await page.evaluate(i=>{const v=window.__BAMSONNIM__.view,h=v.hits.find(h=>h.kind==='stove'&&h.uid===`timer-${i}`),r=v.canvas.getBoundingClientRect();return{x:r.x+h.x+h.w/2,y:r.y+h.y+h.h/2};},i);
   if(viewport.width<900)await page.touchscreen.tap(point.x,point.y);else await page.mouse.click(point.x,point.y);
   await page.locator('.stove-dialog').waitFor({state:'visible'});assert.equal(await page.locator('[data-act="instant"]').getAttribute('data-id'),`timer-${i}`);assert.equal(await page.locator('.cook-progress').getAttribute('value'),String(120-i*60));selected.push(`timer-${i}`);
   if(viewport.width<900)await page.getByRole('button',{name:'창 닫기',exact:true}).tap();else await page.getByRole('button',{name:'창 닫기',exact:true}).click();
  }results.push({check:'stove-timers',viewport,...timers,selected});
  if(viewport.width===1280){
   const uniform=await page.evaluate(async()=>{
    const {FURNITURE,RECIPES}=await import('/src/data.js'),g=window.__BAMSONNIM__,v=g.view,s=g.state,original=v.sprite,calls=[];
    const capture=(name,fn)=>{v.sprite=function(key,index,x,y,w,h,...args){const im=this.sprites[key]?.[index];if(im)calls.push({name,key,index,w,h:h||w*im.height/im.width,sourceWidth:im.width,sourceHeight:im.height});return original.call(this,key,index,x,y,w,h,...args);};try{fn();}finally{v.sprite=original;}};
    for(const f of FURNITURE.filter(f=>f.id!=='poster'))for(let dir=0;dir<4;dir++)capture(`${f.id}-${dir}`,()=>v.drawObject(s,{uid:'ratio',type:f.id,x:3,y:3,dir},0,null));
    for(const r of RECIPES){capture(`stove-food-${r.id}`,()=>v.drawObject(s,{uid:'ratio',type:'stove',x:3,y:3,dir:0,cook:{foodId:r.id,readyAt:s.time,spoilAt:s.time+100}},0,null));capture(`tray-food-${r.id}`,()=>v.drawPerson(s,{uid:'ratio',x:3,y:3,path:[],appearance:0,task:{picked:true,kind:'serve',foodId:r.id}},true,0,false));}
    let door=null;const draw=v.ctx.drawImage;v.ctx.drawImage=function(im,...args){if(im===v.sprites.woodenEntrance[0])door={w:args[2],h:args[3],sourceWidth:im.width,sourceHeight:im.height};return draw.call(this,im,...args);};try{v.draw(s,null,0,false);}finally{v.ctx.drawImage=draw;}
    return{calls,door};
   });
   for(const c of [...uniform.calls,uniform.door])assert.ok(Math.abs(c.w/c.h-c.sourceWidth/c.sourceHeight)<1e-8,`${c.name||'door'} uniform aspect`);results.push({check:'uniform-furniture-food',...uniform});
   await page.locator('[data-act="debug"]').click();await page.locator('[data-act="gallery"]').click();
   const gallery=await page.evaluate(async()=>{
    const {atlasForActor,getCoverage,drawAtlasFrame}=await import('/src/atlas-preview.js'),{ZOMBIES}=await import('/src/data.js'),g=window.__BAMSONNIM__,meta=atlasForActor('wanderer');
    const bounds=canvas=>{const data=canvas.getContext('2d').getImageData(0,0,280,280).data;let count=0,minX=280,minY=280,maxX=-1,maxY=-1;for(let i=3;i<data.length;i+=4)if(data[i]>80){count++;const n=(i-3)/4,x=n%280,y=Math.floor(n/280);minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);}return{count,minX,minY,maxX,maxY};};
    const frames=[...document.querySelectorAll('[data-directional-frame]')].map(canvas=>{const index=Number(canvas.dataset.directionalFrame),reference=document.createElement('canvas'),geometry=drawAtlasFrame(reference,g.view.sprites[meta.key][index],meta,index);return{index,geometry,bounds:bounds(canvas),matchesHelper:canvas.toDataURL()===reference.toDataURL()};});
    return{coverage:getCoverage(ZOMBIES),text:document.querySelector('.sprite-coverage').textContent,frames,poseCount:meta.poses.length,rosterCount:ZOMBIES.length,expectedEnabled:ZOMBIES.filter(z=>atlasForActor(z.id)).length,options:[...document.querySelector('#walk-actor').options].map(o=>({id:o.value,disabled:o.disabled}))};
   });
   assert.equal(gallery.frames.length,gallery.poseCount);for(const f of gallery.frames){assert.ok(f.matchesHelper);assert.ok(f.bounds.count>100&&f.bounds.minX>=11&&f.bounds.minY>=11&&f.bounds.maxX<=268&&f.bounds.maxY<=268,'Visible full silhouette stays inside preview');}
   assert.equal(gallery.options.length,gallery.rosterCount);assert.equal(gallery.options.filter(o=>!o.disabled).length,gallery.expectedEnabled);
   await page.locator('#walk-state').selectOption('sit');for(let dir=0;dir<4;dir++){await page.locator('#walk-direction').selectOption(String(dir));await page.waitForTimeout(50);const state=await page.locator('#walk-preview').getAttribute('data-frame');assert.ok(state);await page.locator('#walk-preview').screenshot({path:`${output}/preview-sit-${dir}.png`});}
   await page.locator('#walk-state').selectOption('walk');const before=await page.locator('#walk-preview').getAttribute('data-frame');await page.waitForFunction(before=>document.querySelector('#walk-preview').dataset.frame!==before,before);const after=await page.locator('#walk-preview').getAttribute('data-frame');assert.notEqual(before,after);await page.locator('[data-act="walk-preview-toggle"]').click();const frozen=await page.locator('#walk-preview').getAttribute('data-frame');await page.waitForTimeout(400);assert.equal(await page.locator('#walk-preview').getAttribute('data-frame'),frozen);
   await page.screenshot({path:`${output}/gallery.png`});results.push({check:'gallery-preview',...gallery,animated:true,paused:true});
  }
  assert.deepEqual(errors,[]);await context.close();
 }
 await fs.writeFile(`${output}/results.json`,JSON.stringify({functionalPassed:true,visualPassed:results.filter(r=>r.overlap).every(r=>r.overlap.length===0),results},null,2));console.log(JSON.stringify({passed:true,checks:results.map(r=>({check:r.check,viewport:r.viewport,overlap:r.overlap}))}));
}finally{await browser.close();}
