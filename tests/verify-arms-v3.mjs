// Independent v3 whole-arm oracle. Does not import the production compositor.
export function verifyArmOnly({meta,frames,baseFrames,baseMeta,raw,records}){
 const surface=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;c.getContext('2d',{willReadFrequently:true}).imageSmoothingEnabled=false;return c;};
 const read=c=>c.getContext('2d').getImageData(0,0,c.width,c.height).data;
 const image=(w,h,data)=>{const c=surface(w,h);c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(data),w,h),0,0);return c;};
 const inside=(polygon,x,y)=>{let winding=0;for(let i=0;i<polygon.length;i++){const a=polygon[i],b=polygon[(i+1)%polygon.length],cross=(b[0]-a[0])*(y-a[1])-(b[1]-a[1])*(x-a[0]);if(Math.abs(cross)<1e-8&&x>=Math.min(a[0],b[0])-1e-8&&x<=Math.max(a[0],b[0])+1e-8&&y>=Math.min(a[1],b[1])-1e-8&&y<=Math.max(a[1],b[1])+1e-8)return true;if(a[1]<=y&&b[1]>y&&cross>0)winding++;if(a[1]>y&&b[1]<=y&&cross<0)winding--;}return winding!==0;};
 const mask=(w,h,polygons)=>Uint8Array.from({length:w*h},(_,p)=>polygons.some(shape=>inside(shape,p%w+.5,Math.floor(p/w)+.5))?1:0);
 const diff=(a,b,region=null)=>{let channels=0,maxDelta=0,first=null;for(let p=0;p<a.length/4;p++){if(region&&!region[p])continue;for(let k=0;k<4;k++){const delta=Math.abs(a[p*4+k]-b[p*4+k]);if(delta){channels++;if(!first)first={pixel:p,channel:k,actual:a[p*4+k],expected:b[p*4+k]};}maxDelta=Math.max(maxDelta,delta);}}return{channels,maxDelta,first};};
 const over=(back,front)=>{const a=front[3]/255,b=back[3]/255*(1-a),alpha=a+b;if(!a)return[...back];return[0,1,2].map(k=>Math.round((front[k]*a+back[k]*b)/alpha)).concat(Math.round(alpha*255));};
 const fail=(reason,dir,frame,details)=>{throw Error(JSON.stringify({reason,actor:meta.actorId,dir,frame,...details}));};
 const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
 function foreground(pose){
  const cfg=pose.registration.armOnly,source=read(raw[pose.index]),w=raw[pose.index].width,h=raw[pose.index].height,neutral=new Map(cfg.neutralArms.map(a=>[a.id,a]));
  const arms=cfg.arms.map(arm=>{const anchor=neutral.get(arm.id)?.shoulder;if(!anchor||Math.hypot(anchor.x-arm.targetShoulder.x,anchor.y-arm.targetShoulder.y)>1e-6)fail('shoulder-left-canonical-anchor',pose.dir,pose.frame,{arm:arm.id});
   const include=mask(w,h,arm.mask),exclude=mask(w,h,arm.excludeMasks||[]);for(let p=0;p<include.length;p++)if(exclude[p])include[p]=0;
   const angle=(arm.rotationDegrees??arm.rotation??0)*Math.PI/180,c=Math.cos(angle),s=Math.sin(angle),tx=arm.targetShoulder.x-c*arm.sourceShoulder.x+s*arm.sourceShoulder.y,ty=arm.targetShoulder.y-s*arm.sourceShoulder.x-c*arm.sourceShoulder.y;
   return{descriptor:arm,include,matrix:[c,s,-s,c,tx,ty],target:arm.mask.map(poly=>poly.map(([x,y])=>[c*x-s*y+tx,s*x+c*y+ty]))};});
  const owner=new Int16Array(w*h).fill(-1),sourceUnion=new Uint8Array(w*h);for(let a=0;a<arms.length;a++)for(let p=0;p<w*h;p++)if(arms[a].include[p]){sourceUnion[p]=1;if(source[p*4+3])owner[p]=a;}
  const combined=surface(w,h),armLayers=[];
  for(let a=0;a<arms.length;a++){const cut=new Uint8ClampedArray(source.length);for(let p=0;p<w*h;p++)if(owner[p]===a)cut.set(source.subarray(p*4,p*4+4),p*4);const projected=surface(w,h),ctx=projected.getContext('2d');// Match native transform sequencing: a single precomputed matrix can shift
   // a nearest-neighbor tie by one texel due to floating-point cancellation.
   const descriptor=arms[a].descriptor;ctx.translate(descriptor.targetShoulder.x,descriptor.targetShoulder.y);ctx.rotate((descriptor.rotationDegrees??descriptor.rotation??0)*Math.PI/180);ctx.translate(-descriptor.sourceShoulder.x,-descriptor.sourceShoulder.y);ctx.drawImage(image(w,h,cut),0,0);combined.getContext('2d').drawImage(projected,0,0);armLayers.push(read(projected));}
  return{pixels:read(combined),mask:mask(w,h,arms.flatMap(a=>a.target)),sourceUnion,arms,armLayers};
 }
 const foregrounds=meta.poses.map(foreground),directions=[];
 for(let dir=0;dir<4;dir++){
  const poses=meta.poses.filter(p=>p.dir===dir);if(poses.length!==2||!poses.every(p=>p.registration.armOnly))fail('missing-v3-direction',dir,null,{});
  const first=poses[0],r=first.registration,cfg=r.armOnly,body=cfg.bodyPlate,base=baseFrames[r.baseIndex],w=base.width,h=base.height,canonical=read(base),neutral=mask(w,h,cfg.neutralArms.flatMap(a=>a.erase)),clear=mask(w,h,body.clearMasks??cfg.neutralArms.flatMap(a=>a.erase)),joint=mask(w,h,body.canonicalJointMasks||[]),props=mask(w,h,cfg.fixedPropMasks||[]),plate=new Uint8ClampedArray(canonical),resolved=new Uint8Array(w*h);
  if(poses.some(p=>p.registration.baseIndex!==r.baseIndex||!same(p.registration.armOnly.neutralArms,cfg.neutralArms)||!same(p.registration.armOnly.bodyPlate,body)||!same(p.registration.armOnly.fixedPropMasks||[],cfg.fixedPropMasks||[])))fail('different-shared-body-plate',dir,null,{});
  for(let p=0;p<w*h;p++)if(clear[p]){if(!neutral[p])fail('clear-leaves-original-arm',dir,null,{x:p%w,y:Math.floor(p/w)});plate.fill(0,p*4,p*4+4);}
  let dirtySamplesRejected=0,clones=0;
  const sourceFor=frame=>frame===0?{data:canonical,arms:neutral}:{data:read(raw[poses.find(p=>p.frame===frame)?.index]),arms:foregrounds[poses.find(p=>p.frame===frame)?.index].sourceUnion};
  const apply=(patch,tx,ty,sx,sy,exclude)=>{if(tx<0||ty<0||tx>=w||ty>=h||sx<0||sy<0||sx>=w||sy>=h)return;const p=ty*w+tx,sp=sy*w+sx;if(!clear[p]||resolved[p])return;const source=sourceFor(patch.source.frame);if(exclude[sp]||(source.arms[sp]&&source.data[sp*4+3]&&!(patch.source.frame===0&&patch.cleanFabricClone===true))){dirtySamplesRejected++;return;}plate.set(source.data.subarray(sp*4,sp*4+4),p*4);resolved[p]=1;if(patch.source.frame===0&&patch.cleanFabricClone===true)clones++;};
  for(const patch of body.patches){const target=mask(w,h,patch.targetMask),exclude=mask(w,h,patch.excludeMasks||[]),dx=patch.offset?.x??0,dy=patch.offset?.y??0;for(let p=0;p<w*h;p++)if(target[p])apply(patch,p%w,Math.floor(p/w),p%w-dx,Math.floor(p/w)-dy,exclude);}
  for(const patch of body.pixelPatches||[]){const exclude=mask(w,h,patch.excludeMasks||[]);for(let k=0;k<patch.samples.length;k+=4)apply(patch,...patch.samples.slice(k,k+4),exclude);}
  const transparent=mask(w,h,body.intentionalTransparentMasks||[]);let intentional=0;
  for(let p=0;p<w*h;p++)if(transparent[p]){if(!clear[p]||resolved[p])fail('transparent-repair-conflict',dir,null,{x:p%w,y:Math.floor(p/w)});plate.fill(0,p*4,p*4+4);resolved[p]=1;intentional++;}
  for(let p=0;p<w*h;p++)if(joint[p]||props[p]){plate.set(canonical.subarray(p*4,p*4+4),p*4);if(neutral[p])resolved[p]=1;}
  const unresolved=[];for(let p=0;p<w*h;p++)if(neutral[p]&&!resolved[p])unresolved.push(p);if(unresolved.length)fail('unresolved-clean-plate',dir,null,{pixels:unresolved.length,x:unresolved[0]%w,y:Math.floor(unresolved[0]/w)});
  const platePixels=read(image(w,h,plate)),moving=Uint8Array.from(neutral,(_,p)=>poses.some(pose=>foregrounds[pose.index].mask[p])?1:0),allowed=Uint8Array.from(neutral,(n,p)=>n||moving[p]?1:0),protectedMask=Uint8Array.from(allowed,a=>a?0:1),checked=[];
  for(const pose of poses){const fg=foregrounds[pose.index],expected=new Uint8ClampedArray(platePixels);for(let p=0;p<w*h;p++)if(fg.mask[p])expected.set(over(expected.subarray(p*4,p*4+4),fg.pixels.subarray(p*4,p*4+4)),p*4);for(let p=0;p<w*h;p++)if(props[p])expected.set(canonical.subarray(p*4,p*4+4),p*4);
   const actual=read(frames[pose.index]),protectedDiff=diff(actual,canonical,protectedMask),propDiff=diff(actual,canonical,props),oracleDiff=diff(actual,read(image(w,h,expected))),diagnostics=records[pose.index].armOnly?.plateDiagnostics;
   if(records[pose.index].mode!=='arms-only-v3'||protectedDiff.channels||propDiff.channels||oracleDiff.maxDelta>1||diagnostics?.unresolvedPixels!==0)fail('v3-composite-difference',dir,pose.frame,{protectedDiff,propDiff,oracleDiff,unresolved:diagnostics?.unresolvedPixels});
   checked.push({frame:pose.frame,protectedDiff,propDiff,oracleDiff,unresolved:diagnostics.unresolvedPixels,shouldersFixed:true});
  }
  const fixedRegion=Uint8Array.from(moving,n=>n?0:1),a=read(frames[poses[0].index]),b=read(frames[poses[1].index]),sharedPlateDiff=diff(a,b,fixedRegion);
  if(sharedPlateDiff.channels)fail('shared-plate-moved',dir,null,{sharedPlateDiff});
  const motion={neutralToFirst:diff(canonical,a,allowed).channels,firstToSecond:diff(a,b,allowed).channels,secondToNeutral:diff(b,canonical,allowed).channels};if(Object.values(motion).some(n=>n===0))fail('missing-arm-motion',dir,null,{motion});
  // Diagnose arm pixels separately from the rest of the avatar. Tight mask and
  // arm/hand connectivity remain explicit designer review; no new arbitrary
  // whole-body coverage threshold or hidden-fabric prohibition is introduced.
  const limbMotion=[];for(const arm of cfg.neutralArms){const perPose=poses.map(pose=>{const fg=foregrounds[pose.index],index=fg.arms.findIndex(a=>a.descriptor.id===arm.id);return index<0?null:{arm:fg.arms[index],pixels:fg.armLayers[index]};});if(perPose.some(p=>!p))continue;const region=mask(w,h,perPose.flatMap(p=>p.arm.target));limbMotion.push({id:arm.id,changedChannels:diff(perPose[0].pixels,perPose[1].pixels,region).channels,sourceExclusions:perPose.map(p=>p.arm.descriptor.excludeMasks?.length||0)});}
  directions.push({dir,checked,protectedPixels:protectedMask.reduce((n,v)=>n+v,0),allowedPixels:allowed.reduce((n,v)=>n+v,0),sharedPlateDiff,motion,limbMotion,cleanFabricClonePixels:clones,intentionalTransparentPixels:intentional,dirtySourceSamplesRejected:dirtySamplesRejected,designReviewRequired:['upper arm/forearm/hand joint connection','original/third arm silhouette remnants','tight source masks and explicit fabric clones']});
 }
 return directions;
}
