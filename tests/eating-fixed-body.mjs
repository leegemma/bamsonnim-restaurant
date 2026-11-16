import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium,webkit} from 'playwright';

const prepare=process.argv.includes('--prepare');
const base=process.env.BASE_URL||'http://localhost:5181';
const out=process.env.EATING_BODY_OUTPUT||'artifacts/eating-fixed-body-qa';
const targetIds=['student','scholar','office','guard','rider','hostess','hiker','merchant','nurse','dancer'];
const provisionalPath=process.env.EATING_PROVISIONAL_MASKS||'artifacts/eating-body-fixed-review/hand-only-masks.json';
const provisional=prepare?JSON.parse(await fs.readFile(provisionalPath,'utf8')):null;
await fs.mkdir(out,{recursive:true});
const results=[];
for(const type of [chromium,webkit]){
 const browser=await type.launch();
 try{
  const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(base);await page.waitForFunction(()=>window.__BAMSONNIM__?.view.ready);
  const result=await page.evaluate(async({prepare,targetIds,provisional})=>{
   const {ASSET_MANIFEST}=await import('/src/assets.js');
   const {EATING_ATLASES}=await import('/src/eating-atlases.generated.js');
   const {registerEatingFrames}=await import('/src/eating-registration.js');
   const {eatingAnimationFrame,eatingSpriteFrame,EATING_FPS}=await import('/src/eating.js');
   const game=window.__BAMSONNIM__,view=game.view;game.pause();
   // Independent point-in-polygon oracle; do not reuse the compositor's
   // canvas isPointInPath or its mask/copy/compositing implementation.
   const inside=(polygon,x,y)=>{
    let winding=0;
    for(let i=0;i<polygon.length;i++){
     const a=polygon[i],b=polygon[(i+1)%polygon.length],cross=(b[0]-a[0])*(y-a[1])-(b[1]-a[1])*(x-a[0]);
     if(Math.abs(cross)<1e-8&&x>=Math.min(a[0],b[0])-1e-8&&x<=Math.max(a[0],b[0])+1e-8&&y>=Math.min(a[1],b[1])-1e-8&&y<=Math.max(a[1],b[1])+1e-8)return true;
     if(a[1]<=y&&b[1]>y&&cross>0)winding++;
     if(a[1]>y&&b[1]<=y&&cross<0)winding--;
    }
    return winding!==0;
   };
   const mask=(w,h,polygons)=>Uint8Array.from({length:w*h},(_,i)=>polygons.some(p=>inside(p,i%w+.5,Math.floor(i/w)+.5))?1:0);
   const canvas=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;c.getContext('2d',{willReadFrequently:true});return c;};
   const pixels=c=>c.getContext('2d').getImageData(0,0,c.width,c.height).data;
   const image=(w,h,data)=>{const c=canvas(w,h);c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(data),w,h),0,0);return c;};
   const rect=(x,y,w,h)=>[[x,y],[x+w,y],[x+w,y+h],[x,y+h]];
   const copy=c=>image(c.width,c.height,pixels(c));
   const compare=(a,b,region=null)=>{let channels=0,maxDelta=0;for(let i=0;i<a.length;i++){if(region&&!region[Math.floor(i/4)])continue;const delta=Math.abs(a[i]-b[i]);if(delta)channels++;maxDelta=Math.max(maxDelta,delta);}return{channels,maxDelta};};
   const sourceOver=(background,source)=>{
    const alpha=source[3]/255,behind=background[3]/255*(1-alpha),out=alpha+behind;
    if(!alpha)return [...background];
    return [0,1,2].map(k=>Math.round((source[k]*alpha+background[k]*behind)/out)).concat(Math.round(out*255));
   };
   function verify(meta,frames,baseFrames,baseMeta,raw){
    const directions=[];
    for(let dir=0;dir<4;dir++){
     const poses=meta.poses.filter(p=>p.dir===dir),first=poses[0],r=first.registration,hands=r.handOnly;
     if(!hands||poses.length!==2)throw Error(`Missing hands-only direction ${meta.actorId}/${dir}`);
     const original=baseFrames[r.baseIndex],w=original.width,h=original.height,canonical=pixels(original);
     const neutral=mask(w,h,hands.neutralHandMasks),props=mask(w,h,hands.fixedPropMasks||[]);
     const moves=mask(w,h,poses.flatMap(p=>p.registration.handOnly.movingHandMasks));
     const allowed=Uint8Array.from(neutral,(v,i)=>v||moves[i]?1:0),protectedRegion=Uint8Array.from(allowed,v=>v?0:1);
     const opaque=canonical.reduce((n,v,i)=>n+(i%4===3&&v>80?1:0),0),allowedCount=allowed.reduce((n,v)=>n+v,0);
     // Reject a mask that simply legitimizes moving an entire avatar.
     if(allowedCount>opaque*.5)throw Error(`Allowed masks cover too much of ${meta.actorId}/${dir}: ${allowedCount}/${opaque} opaque pixels; designer measurement required`);
     for(const polygon of [...hands.neutralHandMasks,...poses.flatMap(p=>p.registration.handOnly.movingHandMasks)]){
      const width=Math.max(...polygon.map(p=>p[0]))-Math.min(...polygon.map(p=>p[0])),height=Math.max(...polygon.map(p=>p[1]))-Math.min(...polygon.map(p=>p[1]));
      if(width>=w*.7&&height>=h*.55)throw Error(`Broad full-body allowed polygon ${meta.actorId}/${dir}`);
     }
     const platePose=poses.find(p=>p.frame===(hands.bodyPlateFrame??2));if(!platePose)throw Error('Missing plate pose');
     const expectedPlate=new Uint8ClampedArray(canonical),plateRaw=pixels(raw[platePose.index]);
     for(let i=0;i<w*h;i++)if(neutral[i])expectedPlate.set(plateRaw.subarray(i*4,i*4+4),i*4);
     for(let i=0;i<w*h;i++)if(props[i])expectedPlate.set(canonical.subarray(i*4,i*4+4),i*4);
     const platePixels=pixels(image(w,h,expectedPlate));
     const checked=[];
     for(const pose of poses){
      const current=pixels(frames[pose.index]),moving=mask(w,h,pose.registration.handOnly.movingHandMasks),source=pixels(raw[pose.index]);
      const expected=new Uint8ClampedArray(platePixels);
      for(let i=0;i<w*h;i++)if(moving[i])expected.set(sourceOver(expected.subarray(i*4,i*4+4),source.subarray(i*4,i*4+4)),i*4);
      for(let i=0;i<w*h;i++)if(props[i])expected.set(canonical.subarray(i*4,i*4+4),i*4);
      const protectedDiff=compare(current,canonical,protectedRegion),propDiff=compare(current,canonical,props),oracleDiff=compare(current,pixels(image(w,h,expected)));
      if(protectedDiff.channels||propDiff.channels||oracleDiff.maxDelta>1){const expectedPixels=pixels(image(w,h,expected)),samples=[];for(let i=0;i<w*h&&samples.length<12;i++)if([0,1,2,3].some(k=>Math.abs(current[i*4+k]-expectedPixels[i*4+k])>1))samples.push({x:i%w,y:Math.floor(i/w),current:[...current.slice(i*4,i*4+4)],expected:[...expectedPixels.slice(i*4,i*4+4)],raw:[...source.slice(i*4,i*4+4)],plate:[...platePixels.slice(i*4,i*4+4)],neutral:neutral[i],moving:moving[i],prop:props[i]});throw Error(JSON.stringify({actor:meta.actorId,dir,frame:pose.frame,protectedDiff,propDiff,oracleDiff,samples}));}
      checked.push({frame:pose.frame,protectedDiff,propDiff,oracleDiff});
     }
     const fixedRegion=Uint8Array.from(moves,v=>v?0:1),firstPixels=pixels(frames[poses[0].index]),secondPixels=pixels(frames[poses[1].index]),fixedPlateDiff=compare(firstPixels,secondPixels,fixedRegion);
     if(fixedPlateDiff.channels)throw Error(`Plate moved ${meta.actorId}/${dir}: ${fixedPlateDiff.channels}`);
     const handMotion={neutralToFirst:compare(canonical,firstPixels,allowed).channels,firstToSecond:compare(firstPixels,secondPixels,allowed).channels,secondToNeutral:compare(secondPixels,canonical,allowed).channels};
     if(Object.values(handMotion).some(n=>n===0))throw Error(`Missing visible three-state hand movement ${meta.actorId}/${dir}: ${JSON.stringify(handMotion)}`);
     // Frame zero uses the exact canonical sit canvas, never a regenerated body.
     const neutralFrame=eatingSpriteFrame(baseMeta,meta,dir,0);
     if(neutralFrame.key!==baseMeta.key||neutralFrame.index!==r.baseIndex)throw Error(`Wrong neutral frame ${meta.actorId}/${dir}`);
     directions.push({dir,allowedPixels:allowedCount,canonicalOpaquePixels:opaque,allowedFractionOfOpaque:allowedCount/opaque,protectedPixels:protectedRegion.reduce((n,v)=>n+v,0),fixedPlateDiff,handMotion,states:[0,1,2],checked});
    }
    return directions;
   }
   const fixtures=(()=>{
    const w=18,h=18,bases=Array.from({length:4},()=>{const data=new Uint8ClampedArray(w*h*4);for(let i=0;i<w*h;i++)data.set([20,60,100,255],i*4);return image(w,h,data);});
    const originals=bases.map(c=>[...pixels(c)]),raw=Array.from({length:8},(_,index)=>{const data=new Uint8ClampedArray(w*h*4);for(let i=0;i<w*h;i++)data.set(index%2?[0,230,230,255]:[230,0,230,255],i*4);return image(w,h,data);});
    for(let i=0;i<8;i++){
     const ctx=raw[i].getContext('2d');if(i%2===0){ctx.fillStyle='rgb(190,40,60)';ctx.fillRect(5,6,6,5);ctx.clearRect(6,7,1,1);ctx.fillStyle='rgba(200,100,50,0.5)';ctx.fillRect(6,7,1,1);ctx.clearRect(7,7,1,1);}else{ctx.clearRect(3,11,1,1);ctx.fillStyle='rgb(40,180,60)';ctx.fillRect(11,8,3,3);}
    }
    const meta={actorId:'synthetic-hand-compositing',key:'fixtureEating',poses:raw.map((_,index)=>({index,dir:Math.floor(index/2),state:'eat',frame:index%2+1,hip:{x:index%2?9:7,y:12},registration:{baseIndex:Math.floor(index/2),scale:1,headBottomY:7,lowerBodyTopY:17,handOnly:{neutralHandMasks:[rect(2,10,3,3)],movingHandMasks:index%2?[rect(11,8,3,3)]:[rect(7,6,3,3),rect(7,6,3,3),rect(8,7,3,3),rect(-2,2,3,2)],bodyPlateFrame:2,fixedPropMasks:[rect(7,6,1,1),rect(4,12,1,1)]}}}))};
    const baseMeta={key:'fixtureBase',walkFrames:0,frames:{sit:0},poses:bases.map(()=>({hip:{x:9,y:12},bounds:{x:0,y:0,width:w,height:h}}))};
    const aligned=raw.map((c,i)=>{const a=canvas(w,h);a.getContext('2d').drawImage(c,i%2?0:2,0);return a;});
    const frames=raw.map(copy);registerEatingFrames(frames,meta,bases,baseMeta);
    const data=pixels(frames[0]),pixel=(x,y)=>[...data.slice((y*w+x)*4,(y*w+x)*4+4)];
    if(pixel(3,11)[3]!==0)throw Error('Neutral erase alpha zero did not erase the resting hand');
    if(JSON.stringify(pixel(9,7))!==JSON.stringify([20,60,100,255]))throw Error('Transparent moving hand erased its backdrop');
    const expectedHalf=sourceOver([20,60,100,255],[...pixels(aligned[0]).slice((7*w+8)*4,(7*w+8)*4+4)]);
    if(Math.max(...pixel(8,7).map((v,i)=>Math.abs(v-expectedHalf[i])))>1)throw Error('Semi-transparent hand or duplicate-mask union composited incorrectly');
    if(JSON.stringify(pixel(7,6))!==JSON.stringify([20,60,100,255])||JSON.stringify(pixel(4,12))!==JSON.stringify([20,60,100,255]))throw Error('Fixed prop was overwritten');
    if(!bases.every((c,i)=>JSON.stringify([...pixels(c)])===JSON.stringify(originals[i])))throw Error('Canonical inputs mutated');
    const directions=verify(meta,frames,bases,baseMeta,aligned);
    return{directions:directions.length,poses:frames.length,transparentHandKeepsPlate:true,neutralTransparentPixelErases:true,semiTransparentSingleComposition:true,overlappingAndDuplicateMasksAreUnion:true,fixedPropsPreserved:true,canonicalInputsUnchanged:true};
   })();
   const integrated=targetIds.filter(id=>EATING_ATLASES.find(a=>a.actorId===id)?.poses.every(p=>p.registration?.handOnly));
   const selected=prepare?['student']:targetIds,actors=[];
   for(const id of selected){
    const meta=structuredClone(EATING_ATLASES.find(a=>a.actorId===id));if(!meta)throw Error(`Missing actor ${id}`);
    const baseMeta=ASSET_MANIFEST[meta.baseAtlas],sourceImage=await view.getAssetSource(meta.key),raw=[];
    for(const pose of meta.poses){
     const original=view.sprites[baseMeta.key][pose.registration.baseIndex],crop=canvas(Math.ceil(pose.source.width),Math.ceil(pose.source.height)),cx=crop.getContext('2d');
     cx.drawImage(sourceImage,pose.source.x,pose.source.y,pose.source.width,pose.source.height,0,0,pose.source.width,pose.source.height);
     const aligned=canvas(original.width,original.height),ctx=aligned.getContext('2d');ctx.imageSmoothingEnabled=false;
     const r=pose.registration,bp=baseMeta.poses[r.baseIndex];ctx.drawImage(crop,bp.hip.x-pose.hip.x*r.scale,bp.hip.y-pose.hip.y*r.scale,crop.width*r.scale,crop.height*r.scale);raw.push(aligned);
     if(prepare){const d=provisional.actors[id].directions[pose.dir];pose.registration.handOnly={neutralHandMasks:d.neutralErase,movingHandMasks:d.poses[pose.frame].foreground,bodyPlateFrame:d.plateSource.frame,fixedPropMasks:d.fixedPropMasks||[]};}
    }
    if(!meta.poses.every(p=>p.registration.handOnly))throw Error(`Actual production metadata not integrated: ${id}`);
    const originalSprites=view.sprites[meta.key],originalRecords=view.eatingRegistrations[meta.key],frames=[];
    // The compositor receives unaligned source cells, exactly as runtime cutAtlas.
    for(const pose of meta.poses){const c=canvas(Math.ceil(pose.source.width),Math.ceil(pose.source.height));c.getContext('2d').drawImage(sourceImage,pose.source.x,pose.source.y,pose.source.width,pose.source.height,0,0,pose.source.width,pose.source.height);frames.push(c);}
    const canonicalBefore=new Map(meta.poses.map(p=>[p.registration.baseIndex,new Uint8ClampedArray(pixels(view.sprites[baseMeta.key][p.registration.baseIndex]))]));
    const records=registerEatingFrames(frames,meta,view.sprites[baseMeta.key],baseMeta),directions=verify(meta,frames,view.sprites[baseMeta.key],baseMeta,raw);
    for(const [index,before]of canonicalBefore)if(compare(before,pixels(view.sprites[baseMeta.key][index])).channels)throw Error(`Canonical seated input mutated ${id}/${index}`);
    let liveSamples=0;view.sprites[meta.key]=frames;view.eatingRegistrations[meta.key]=records;
    const seat=game.engine.seats(game.state)[0],chair=game.state.objects.find(o=>o.uid===seat.uid),oldDir=chair.dir,sprite=view.sprite;
    try{
     for(let dir=0;dir<4;dir++){
      chair.dir=dir;let neutralGeometry;
      for(const [sample,time]of [0,.2,.4,.6,.8,1].entries()){
       game.state.time=time+.001;game.state.fraction=0;const actor={uid:`body-qa-${id}`,zombieId:id,phase:'eating',seat:seat.uid,x:chair.x,y:chair.y,path:[],enteredAt:0},expectedFrame=[0,1,2,0,1,2][sample],selectedFrame=eatingSpriteFrame(baseMeta,meta,dir,expectedFrame),calls=[];
       if(eatingAnimationFrame(actor,game.state.time)!==expectedFrame||EATING_FPS!==5)throw Error('Eating clock is not three-state 5fps');
       view.sprite=function(key,index,...args){calls.push({key,index,args});return sprite.call(this,key,index,...args);};view.drawPerson(game.state,actor,false,0);
       const call=calls.find(c=>c.key===selectedFrame.key&&c.index===selectedFrame.index);if(!call)throw Error(`Wrong live frame ${id}/${dir}/${time}`);
       const geometry=call.args.slice(0,4);if(!neutralGeometry)neutralGeometry=geometry;if(geometry.some((n,i)=>Math.abs(n-neutralGeometry[i])>1e-7))throw Error(`Live seated body moved in world coordinates ${id}/${dir}/${time}`);
       liveSamples++;
      }
     }
    }finally{view.sprite=sprite;chair.dir=oldDir;view.sprites[meta.key]=originalSprites;view.eatingRegistrations[meta.key]=originalRecords;}
    actors.push({id,phase:prepare?'provisional-student-only':'production',directions,liveSamples,canonicalInputsUnchanged:true,visualReviewRequired:['resting-hand remnants','extra hands','finger clipping','tight minimal forearm masks']});
   }
   return{phase:prepare?'harness-preparation':'production-verification',fixtures,productionIntegrated:integrated.length,productionTotal:targetIds.length,productionIds:integrated,actors,failedAssets:view.failedAssets,allTenProductionVerified:!prepare&&integrated.length===10&&actors.length===10};
  },{prepare,targetIds,provisional});
  assert.deepEqual(errors,[]);assert.deepEqual(result.failedAssets,[]);
  if(!prepare){assert.equal(result.productionIntegrated,10);assert.equal(result.actors.length,10);assert.equal(result.allTenProductionVerified,true);}
  results.push({browser:type.name(),base,...result,passed:true});
  console.log(`${type.name()}: ${result.phase}; fixtures passed; actual metadata ${result.productionIntegrated}/10; checked ${result.actors.length} actor(s).`);
 }finally{await browser.close();}
}
await fs.writeFile(`${out}/${prepare?'preparation':'production'}-results.json`,JSON.stringify(results,null,2));
console.log(prepare?'Harness preparation passed; this is NOT a ten-character production approval.':'All ten production actors passed fixed-body, fixed-prop, compositing and live 5fps checks; designer visual review remains separate.');
