// Normalize newly drawn upper bodies onto the established seated canvas.
// Head and pants/shoes are exact seated pixels; only the body and hands move.
export function registerEatingFrames(frames,meta,baseFrames,baseMeta,options={}){
 if(meta.poses.some(pose=>pose.registration?.armOnly))return registerArmOnlyFrames(frames,meta,baseFrames,baseMeta,options);
 if(meta.poses.some(pose=>pose.registration?.handOnly))return registerHandsOnlyFrames(frames,meta,baseFrames,baseMeta);
 const records=meta.poses.map((pose,index)=>{
  const r=pose.registration,base=baseFrames[r?.baseIndex],basePose=baseMeta.poses[r?.baseIndex],raw=frames[index];
  if(!raw||!base||!basePose?.hip||!pose.hip||!Number.isFinite(r?.scale)||r.scale<=0||!Number.isInteger(r.lowerBodyTopY)||r.lowerBodyTopY<0||r.lowerBodyTopY>=base.height)throw Error(`Invalid eating registration ${index}`);
  const image=document.createElement('canvas');image.width=base.width;image.height=base.height;const ctx=image.getContext('2d',{willReadFrequently:true});ctx.imageSmoothingEnabled=false;
  const dx=basePose.hip.x-pose.hip.x*r.scale,dy=basePose.hip.y-pose.hip.y*r.scale;
  ctx.drawImage(raw,dx,dy,raw.width*r.scale,raw.height*r.scale);
  const rawPixels=ctx.getImageData(0,0,image.width,image.height);
  const baseCtx=base.getContext('2d');
  if(r.lockLowerBody!==false)ctx.putImageData(baseCtx.getImageData(0,r.lowerBodyTopY,base.width,base.height-r.lowerBodyTopY),0,r.lowerBodyTopY);
  // Keep hair/eyes identical; mouth and raised hands remain animated.
  for(const rect of r.identityRects||[]){
   const {x,y,width,height}=rect;if(![x,y,width,height].every(Number.isInteger)||x<0||y<0||width<=0||height<=0||x+width>base.width||y+height>base.height)throw Error(`Invalid eating identity region ${index}`);
   ctx.putImageData(baseCtx.getImageData(x,y,width,height),x,y);
  }
  // Replace the complete head band, including transparent edge pixels, so
  // generated mouths, shifted outlines and crumbs cannot flicker around it.
  if(r.headBottomY!==undefined){
   if(!Number.isInteger(r.headBottomY)||r.headBottomY<=0||r.headBottomY>=r.lowerBodyTopY)throw Error(`Invalid fixed eating head ${index}`);
   ctx.putImageData(baseCtx.getImageData(0,0,base.width,r.headBottomY),0,0);
  }
  // Raised hands are foreground layers: restore only their outlined shapes
  // after locking the head, rather than cutting them at the head band's edge.
  for(const outline of r.foregroundHands||[]){
   if(outline.length<3||outline.some(point=>point.length!==2||point.some(n=>!Number.isFinite(n))))throw Error(`Invalid eating hand outline ${index}`);
   ctx.beginPath();outline.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();
   const foreground=ctx.getImageData(0,0,image.width,image.height);
   const minX=Math.max(0,Math.floor(Math.min(...outline.map(p=>p[0])))),maxX=Math.min(image.width,Math.ceil(Math.max(...outline.map(p=>p[0]))));
   const minY=Math.max(0,Math.floor(Math.min(...outline.map(p=>p[1])))),maxY=Math.min(image.height,Math.ceil(Math.max(...outline.map(p=>p[1]))));
   for(let y=minY;y<maxY;y++)for(let x=minX;x<maxX;x++)if(ctx.isPointInPath(x+.5,y+.5)){const offset=(y*image.width+x)*4;foreground.data.set(rawPixels.data.subarray(offset,offset+4),offset);}
   ctx.putImageData(foreground,0,0);
  }
  const pixels=ctx.getImageData(0,0,image.width,image.height).data;let x0=image.width,y0=image.height,x1=0,y1=0;
  for(let y=0;y<image.height;y++)for(let x=0;x<image.width;x++)if(pixels[(y*image.width+x)*4+3]>80){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);}
  frames[index]=image;
  return{hip:{...basePose.hip},bounds:{x:x0,y:y0,width:x1-x0+1,height:y1-y0+1},baseIndex:r.baseIndex,lowerBodyTopY:r.lowerBodyTopY,scale:r.scale,sourceHip:{...pose.hip}};
 });
 for(let dir=0;dir<4;dir++){
  const group=records.filter((r,index)=>meta.poses[index].dir===dir);if(!group.length)continue;
  const bounds=[baseMeta.poses[group[0].baseIndex].bounds,...group.map(r=>r.bounds)],x=Math.min(...bounds.map(b=>b.x)),y=Math.min(...bounds.map(b=>b.y)),right=Math.max(...bounds.map(b=>b.x+b.width)),bottom=Math.max(...bounds.map(b=>b.y+b.height));
  for(const record of group)record.previewBounds={x,y,width:right-x,height:bottom-y};
 }
 return records;
}

function maskPixels(ctx,target,source,polygons,label,mode='copy'){
 if(!Array.isArray(polygons))throw Error(`Missing eating hand masks ${label}`);
 const {width,height}=target,covered=mode==='over'?new Uint8Array(width*height):null;
 for(const polygon of polygons){
  if(!Array.isArray(polygon)||polygon.length<3||polygon.some(point=>!Array.isArray(point)||point.length!==2||point.some(n=>!Number.isFinite(n))))throw Error(`Invalid eating hand mask ${label}`);
  ctx.beginPath();polygon.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();
  const left=Math.max(0,Math.floor(Math.min(...polygon.map(p=>p[0])))),right=Math.min(width,Math.ceil(Math.max(...polygon.map(p=>p[0]))));
  const top=Math.max(0,Math.floor(Math.min(...polygon.map(p=>p[1])))),bottom=Math.min(height,Math.ceil(Math.max(...polygon.map(p=>p[1]))));
  for(let y=top;y<bottom;y++)for(let x=left;x<right;x++)if(ctx.isPointInPath(x+.5,y+.5)){
   const pixel=y*width+x;if(covered?.[pixel])continue;if(covered)covered[pixel]=1;
   const offset=pixel*4;
   if(mode==='copy'||source.data[offset+3]===255){target.data.set(source.data.subarray(offset,offset+4),offset);continue;}
   // Finger gaps must reveal the fixed plate, not erase it. Composite only
   // inside the binary polygon so antialiasing cannot change protected pixels.
   const alpha=source.data[offset+3]/255;if(alpha===0)continue;
   const behind=target.data[offset+3]/255*(1-alpha),out=alpha+behind;
   for(let channel=0;channel<3;channel++)target.data[offset+channel]=Math.round((source.data[offset+channel]*alpha+target.data[offset+channel]*behind)/out);
   target.data[offset+3]=Math.round(out*255);
  }
 }
}

// Additional guests use the original seated body as their immutable backdrop.
// Only measured neutral-hand holes and measured moving-hand shapes may differ.
// The legacy wanderer registration above intentionally keeps its approved path.
function registerHandsOnlyFrames(frames,meta,baseFrames,baseMeta){
 const raw=meta.poses.map((pose,index)=>{
  const r=pose.registration,base=baseFrames[r?.baseIndex],basePose=baseMeta.poses[r?.baseIndex],source=frames[index];
  if(!r?.handOnly||!source||!base||!basePose?.hip||!pose.hip||!Number.isFinite(r.scale)||r.scale<=0)throw Error(`Invalid hands-only eating registration ${index}`);
  const image=document.createElement('canvas');image.width=base.width;image.height=base.height;const ctx=image.getContext('2d',{willReadFrequently:true});ctx.imageSmoothingEnabled=false;
  ctx.drawImage(source,basePose.hip.x-pose.hip.x*r.scale,basePose.hip.y-pose.hip.y*r.scale,source.width*r.scale,source.height*r.scale);
  return{base,basePose,pixels:ctx.getImageData(0,0,image.width,image.height)};
 });
 const plates=new Map();
 for(let dir=0;dir<4;dir++){
  const indexes=meta.poses.map((pose,index)=>pose.dir===dir?index:-1).filter(index=>index>=0);if(!indexes.length)continue;
  const first=indexes[0],r=meta.poses[first].registration,hands=r.handOnly,plateFrame=hands.bodyPlateFrame??2;
  const plateIndex=indexes.find(index=>meta.poses[index].frame===plateFrame);if(plateIndex===undefined)throw Error(`Missing eating body plate source ${dir}/${plateFrame}`);
  for(const index of indexes){
   const other=meta.poses[index].registration;
   if(other.baseIndex!==r.baseIndex||JSON.stringify(other.handOnly.neutralHandMasks)!==JSON.stringify(hands.neutralHandMasks)||JSON.stringify(other.handOnly.fixedPropMasks||[])!==JSON.stringify(hands.fixedPropMasks||[])||(other.handOnly.bodyPlateFrame??2)!==plateFrame)throw Error(`Inconsistent eating body plate ${dir}`);
  }
  const {base}=raw[first],image=document.createElement('canvas');image.width=base.width;image.height=base.height;const ctx=image.getContext('2d',{willReadFrequently:true});ctx.drawImage(base,0,0);
  const pixels=ctx.getImageData(0,0,image.width,image.height);
  maskPixels(ctx,pixels,raw[plateIndex].pixels,hands.neutralHandMasks,`${dir}/neutral`);
  maskPixels(ctx,pixels,base.getContext('2d').getImageData(0,0,base.width,base.height),hands.fixedPropMasks||[],`${dir}/plate-props`);
  ctx.putImageData(pixels,0,0);plates.set(dir,{image,plateFrame});
 }
 const records=meta.poses.map((pose,index)=>{
  const r=pose.registration,hands=r.handOnly,{base,basePose}=raw[index],plate=plates.get(pose.dir);
  const image=document.createElement('canvas');image.width=base.width;image.height=base.height;const ctx=image.getContext('2d',{willReadFrequently:true});ctx.drawImage(plate.image,0,0);
  const pixels=ctx.getImageData(0,0,image.width,image.height);
  maskPixels(ctx,pixels,raw[index].pixels,hands.movingHandMasks,`${pose.dir}/${pose.frame}`,'over');
  maskPixels(ctx,pixels,base.getContext('2d').getImageData(0,0,base.width,base.height),hands.fixedPropMasks||[],`${pose.dir}/fixed-props`);
  ctx.putImageData(pixels,0,0);
  let left=image.width,top=image.height,right=-1,bottom=-1;
  for(let y=0;y<image.height;y++)for(let x=0;x<image.width;x++)if(pixels.data[(y*image.width+x)*4+3]>80){left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y);}
  frames[index]=image;
  return{hip:{...basePose.hip},bounds:{x:left,y:top,width:Math.max(0,right-left+1),height:Math.max(0,bottom-top+1)},baseIndex:r.baseIndex,lowerBodyTopY:r.lowerBodyTopY,scale:r.scale,sourceHip:{...pose.hip},mode:'hands-only',handOnly:{neutralHandMasks:hands.neutralHandMasks,movingHandMasks:hands.movingHandMasks,bodyPlateFrame:plate.plateFrame,fixedPropMasks:hands.fixedPropMasks||[]}};
 });
 for(let dir=0;dir<4;dir++){
  const group=records.filter((record,index)=>meta.poses[index].dir===dir);if(!group.length)continue;
  const bounds=[baseMeta.poses[group[0].baseIndex].bounds,...group.map(record=>record.bounds)],x=Math.min(...bounds.map(b=>b.x)),y=Math.min(...bounds.map(b=>b.y)),right=Math.max(...bounds.map(b=>b.x+b.width)),bottom=Math.max(...bounds.map(b=>b.y+b.height));
  for(const record of group)record.previewBounds={x,y,width:right-x,height:bottom-y};
 }
 return records;
}

function armSurface(width,height){
 const image=document.createElement('canvas');image.width=width;image.height=height;
 const ctx=image.getContext('2d',{willReadFrequently:true});ctx.imageSmoothingEnabled=false;return{image,ctx};
}
function armMask(width,height,polygons,label){
 if(!Array.isArray(polygons))throw Error(`Missing arm masks ${label}`);
 const {ctx}=armSurface(width,height),mask=new Uint8Array(width*height);
 for(const p of polygons){
  if(!Array.isArray(p)||p.length<3||p.some(point=>!Array.isArray(point)||point.length!==2||point.some(n=>!Number.isFinite(n))))throw Error(`Invalid arm mask ${label}`);
  ctx.beginPath();p.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();
  const left=Math.max(0,Math.floor(Math.min(...p.map(q=>q[0])))),right=Math.min(width,Math.ceil(Math.max(...p.map(q=>q[0]))));
  const top=Math.max(0,Math.floor(Math.min(...p.map(q=>q[1])))),bottom=Math.min(height,Math.ceil(Math.max(...p.map(q=>q[1]))));
  for(let y=top;y<bottom;y++)for(let x=left;x<right;x++)if(ctx.isPointInPath(x+.5,y+.5))mask[y*width+x]=1;
 }
 return mask;
}
function armPoint(point,label){if(!point||![point.x,point.y].every(Number.isFinite))throw Error(`Missing arm shoulder ${label}`);return point;}

// v3 keeps the seated body fixed and moves complete, shoulder-attached arms.
// Clean plate patches cannot sample any of the source pose's visible arms.
function registerArmOnlyFrames(frames,meta,baseFrames,baseMeta,options){
 const raw=meta.poses.map((pose,index)=>{
  const r=pose.registration,base=baseFrames[r?.baseIndex],basePose=baseMeta.poses[r?.baseIndex],source=frames[index];
  if(!r?.armOnly||!base||!basePose?.hip||!source||!pose.hip||!Number.isFinite(r.scale)||r.scale<=0)throw Error(`Invalid v3 arm registration ${index}`);
  const surface=armSurface(base.width,base.height);
  surface.ctx.drawImage(source,basePose.hip.x-pose.hip.x*r.scale,basePose.hip.y-pose.hip.y*r.scale,source.width*r.scale,source.height*r.scale);
  return{base,basePose,...surface,pixels:surface.ctx.getImageData(0,0,base.width,base.height),basePixels:base.getContext('2d').getImageData(0,0,base.width,base.height)};
 });
 const foregrounds=meta.poses.map((pose,index)=>{
  const config=pose.registration.armOnly,{base,pixels}=raw[index],width=base.width,height=base.height;
  if(!Array.isArray(config.neutralArms)||!Array.isArray(config.arms))throw Error(`Missing complete arm descriptors ${index}`);
  const neutral=new Map(config.neutralArms.map(a=>[a.id,a]));
  if(neutral.size!==config.neutralArms.length)throw Error(`Duplicate neutral arm id ${index}`);
  const sources=config.arms.map(arm=>{
   const fixed=neutral.get(arm.id);if(!fixed)throw Error(`Missing neutral arm ${index}/${arm.id}`);
   const sourceShoulder=armPoint(arm.sourceShoulder,`${index}/${arm.id}/source`),targetShoulder=armPoint(arm.targetShoulder,`${index}/${arm.id}/target`),canonical=armPoint(fixed.shoulder,`${index}/${arm.id}/canonical`);
   if(Math.hypot(targetShoulder.x-canonical.x,targetShoulder.y-canonical.y)>1e-6)throw Error(`Arm target left canonical shoulder ${index}/${arm.id}`);
   const rotationDegrees=arm.rotationDegrees??arm.rotation??0;if(!Number.isFinite(rotationDegrees))throw Error(`Invalid arm rotation ${index}/${arm.id}`);
   const radians=rotationDegrees*Math.PI/180,cos=Math.cos(radians),sin=Math.sin(radians),transform=([x,y])=>[targetShoulder.x+(x-sourceShoulder.x)*cos-(y-sourceShoulder.y)*sin,targetShoulder.y+(x-sourceShoulder.x)*sin+(y-sourceShoulder.y)*cos];
   const mask=armMask(width,height,arm.mask,`${index}/${arm.id}`),excluded=armMask(width,height,arm.excludeMasks||[],`${index}/${arm.id}/excluded`);for(let i=0;i<mask.length;i++)if(excluded[i])mask[i]=0;
   return{id:arm.id,sourceShoulder,targetShoulder,rotationDegrees,sourceMasks:arm.mask,sourceExclusionMasks:arm.excludeMasks||[],targetExclusionMasks:(arm.excludeMasks||[]).map(p=>p.map(transform)),targetMasks:arm.mask.map(p=>p.map(transform)),mask};
  });
  // A source pixel shared by two measured limbs belongs to the frontmost one.
  const ownership=new Uint16Array(width*height),sourceUnion=new Uint8Array(width*height);
  for(let a=0;a<sources.length;a++)for(let i=0;i<ownership.length;i++)if(sources[a].mask[i]){sourceUnion[i]=1;if(pixels.data[i*4+3])ownership[i]=a+1;}
  const foreground=armSurface(width,height),targetPolygons=[];
  for(let a=0;a<sources.length;a++){
   const arm=sources[a],cut=armSurface(width,height),cutPixels=cut.ctx.createImageData(width,height);
   for(let i=0;i<ownership.length;i++)if(ownership[i]===a+1)cutPixels.data.set(pixels.data.subarray(i*4,i*4+4),i*4);
   cut.ctx.putImageData(cutPixels,0,0);
   const projected=armSurface(width,height);projected.ctx.translate(arm.targetShoulder.x,arm.targetShoulder.y);projected.ctx.rotate(arm.rotationDegrees*Math.PI/180);projected.ctx.translate(-arm.sourceShoulder.x,-arm.sourceShoulder.y);projected.ctx.drawImage(cut.image,0,0);
   foreground.ctx.drawImage(projected.image,0,0);targetPolygons.push(...arm.targetMasks);
  }
  return{...foreground,pixels:foreground.ctx.getImageData(0,0,width,height),sourceUnion,targetPolygons,arms:sources.map(({mask,...arm})=>arm)};
 });
 const plates=new Map();
 for(let dir=0;dir<4;dir++){
  const indexes=meta.poses.map((pose,index)=>pose.dir===dir?index:-1).filter(i=>i>=0);if(!indexes.length)continue;
  const first=indexes[0],r=meta.poses[first].registration,config=r.armOnly,{base,basePixels}=raw[first],width=base.width,height=base.height;
  for(const index of indexes){const other=meta.poses[index].registration;if(other.baseIndex!==r.baseIndex||['neutralArms','bodyPlate','fixedPropMasks'].some(key=>JSON.stringify(other.armOnly[key]??[])!==JSON.stringify(config[key]??[])))throw Error(`Inconsistent v3 body plate ${dir}`);}
  const body=config.bodyPlate;if(!body||!Array.isArray(body.patches))throw Error(`Missing v3 clean body patches ${dir}`);
  const neutralPolygons=config.neutralArms.flatMap(a=>a.erase),neutral=armMask(width,height,neutralPolygons,`${dir}/neutral`),clear=armMask(width,height,body.clearMasks??neutralPolygons,`${dir}/clear`),joint=armMask(width,height,body.canonicalJointMasks||[],`${dir}/joint`),props=armMask(width,height,config.fixedPropMasks||[],`${dir}/props`),common=armMask(width,height,body.commonShoulderMasks||[],`${dir}/common`);
  const plate=armSurface(width,height);plate.ctx.drawImage(base,0,0);const pixels=plate.ctx.getImageData(0,0,width,height),resolved=new Uint8Array(width*height),outsideNeutralClear=[];let restoredPixels=0,skippedArmSamples=0,cleanFabricClonePixels=0,intentionalTransparentPixels=0;const skippedSamplesByFrame={0:0,1:0,2:0},skippedSampleExamples=[];
  for(let i=0;i<clear.length;i++){if(clear[i]&&!neutral[i]){outsideNeutralClear.push([i%width,Math.floor(i/width)]);if(!options.allowUnresolvedArmPlate)throw Error(`V3 clear region leaves original arms ${dir}/${i%width}/${Math.floor(i/width)}`);neutral[i]=1;}if(clear[i])pixels.data.fill(0,i*4,i*4+4);}
  for(const patch of body.patches){
   const frame=patch.source?.frame,index=frame===0?first:indexes.find(i=>meta.poses[i].frame===frame);
   if(index===undefined||![0,1,2].includes(frame))throw Error(`Invalid v3 plate patch source ${dir}`);
   const source=frame===0?basePixels:raw[index].pixels,sourceArms=frame===0?neutral:foregrounds[index].sourceUnion,target=armMask(width,height,patch.targetMask,`${dir}/patch`),exclude=armMask(width,height,patch.excludeMasks||[],`${dir}/exclude`),dx=patch.offset?.x??0,dy=patch.offset?.y??0;
   if(!Number.isInteger(dx)||!Number.isInteger(dy))throw Error(`V3 clean patch offset must use integer pixels ${dir}`);
   for(let i=0;i<target.length;i++)if(target[i]&&clear[i]&&!resolved[i]){
    const x=i%width-dx,y=Math.floor(i/width)-dy;if(x<0||y<0||x>=width||y>=height)continue;const si=y*width+x;
    if(exclude[si]||(sourceArms[si]&&source.data[si*4+3]&&!(frame===0&&patch.cleanFabricClone===true))){skippedArmSamples++;skippedSamplesByFrame[frame]++;if(skippedSampleExamples.length<12)skippedSampleExamples.push({frame,target:[i%width,Math.floor(i/width)],source:[si%width,Math.floor(si/width)],alpha:source.data[si*4+3],explicitExclude:!!exclude[si]});continue;}
    pixels.data.set(source.data.subarray(si*4,si*4+4),i*4);resolved[i]=1;restoredPixels++;if(frame===0&&patch.cleanFabricClone===true)cleanFabricClonePixels++;
   }
  }
  // Measurement prototypes can contain thousands of tiny clean clone patches.
  // Flat target/source samples avoid allocating one canvas/mask per source pixel.
  for(const patch of body.pixelPatches||[]){
   const frame=patch.source?.frame,index=frame===0?first:indexes.find(i=>meta.poses[i].frame===frame);
   if(index===undefined||![0,1,2].includes(frame)||!Array.isArray(patch.samples)||patch.samples.length%4)throw Error(`Invalid compact v3 plate samples ${dir}`);
   const source=frame===0?basePixels:raw[index].pixels,sourceArms=frame===0?neutral:foregrounds[index].sourceUnion,exclude=armMask(width,height,patch.excludeMasks||[],`${dir}/sample-exclude`);
   for(let sample=0;sample<patch.samples.length;sample+=4){
    const [tx,ty,sx,sy]=patch.samples.slice(sample,sample+4);if(![tx,ty,sx,sy].every(Number.isInteger))throw Error(`Invalid v3 clean sample coordinates ${dir}`);
    if(tx<0||ty<0||tx>=width||ty>=height||sx<0||sy<0||sx>=width||sy>=height)continue;
    const i=ty*width+tx,si=sy*width+sx;if(!clear[i]||resolved[i])continue;
    if(exclude[si]||(sourceArms[si]&&source.data[si*4+3]&&!(frame===0&&patch.cleanFabricClone===true))){skippedArmSamples++;skippedSamplesByFrame[frame]++;if(skippedSampleExamples.length<12)skippedSampleExamples.push({frame,target:[i%width,Math.floor(i/width)],source:[si%width,Math.floor(si/width)],alpha:source.data[si*4+3],explicitExclude:!!exclude[si]});continue;}
    pixels.data.set(source.data.subarray(si*4,si*4+4),i*4);resolved[i]=1;restoredPixels++;if(frame===0&&patch.cleanFabricClone===true)cleanFabricClonePixels++;
   }
  }
  const transparent=armMask(width,height,body.intentionalTransparentMasks||[],`${dir}/intentional-transparent`);
  for(let i=0;i<transparent.length;i++)if(transparent[i]){
   if(!clear[i]||resolved[i])throw Error(`V3 transparent plate region conflicts with measured repair ${dir}/${i%width}/${Math.floor(i/width)}`);
   pixels.data.fill(0,i*4,i*4+4);resolved[i]=1;intentionalTransparentPixels++;
  }
  for(let i=0;i<joint.length;i++)if(joint[i]||props[i]){pixels.data.set(basePixels.data.subarray(i*4,i*4+4),i*4);if(neutral[i])resolved[i]=1;}
  const unresolved=[],unresolvedMask=new Uint8Array(width*height);let clearPixels=0,jointPixels=0,commonPixels=0,commonMinimumAlpha=255;
  for(let i=0;i<neutral.length;i++){
   if(clear[i])clearPixels++;if(joint[i])jointPixels++;
   if(neutral[i]&&!resolved[i]){unresolvedMask[i]=1;unresolved.push([i%width,Math.floor(i/width)]);}
   if(common[i]){commonPixels++;for(const index of indexes)commonMinimumAlpha=Math.min(commonMinimumAlpha,foregrounds[index].pixels.data[i*4+3]);}
  }
  const diagnostics={clearPixels,restoredPixels,jointPixels,intentionalTransparentPixels,cleanFabricClonePixels,skippedArmSamples,skippedSamplesByFrame,skippedSampleExamples,outsideNeutralClearPixels:outsideNeutralClear.length,outsideNeutralClearCoordinates:outsideNeutralClear,unresolvedPixels:unresolved.length,unresolvedCoordinates:unresolved,commonPixels,commonMinimumAlpha:commonPixels?commonMinimumAlpha:null,commonMaximumTransmission:commonPixels?(255-commonMinimumAlpha)/255:null};
  if(unresolved.length&&!options.allowUnresolvedArmPlate){const error=Error(`Unrestored v3 body plate ${meta.actorId||meta.key}/${dir}: ${unresolved.length} pixels; first ${unresolved[0]}`);error.armPlateDiagnostics=diagnostics;throw error;}
  plate.ctx.putImageData(pixels,0,0);plates.set(dir,{...plate,diagnostics,unresolvedMask});
 }
 const records=meta.poses.map((pose,index)=>{
  const r=pose.registration,config=r.armOnly,{base,basePose,basePixels}=raw[index],plate=plates.get(pose.dir),foreground=foregrounds[index],surface=armSurface(base.width,base.height);surface.ctx.drawImage(plate.image,0,0);const pixels=surface.ctx.getImageData(0,0,base.width,base.height);
  maskPixels(surface.ctx,pixels,foreground.pixels,foreground.targetPolygons,`${pose.dir}/${pose.frame}/arms`,'over');maskPixels(surface.ctx,pixels,basePixels,config.fixedPropMasks||[],`${pose.dir}/fixed-props`);surface.ctx.putImageData(pixels,0,0);
  let left=base.width,top=base.height,right=-1,bottom=-1;for(let y=0;y<base.height;y++)for(let x=0;x<base.width;x++)if(pixels.data[(y*base.width+x)*4+3]>80){left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y);}
  frames[index]=surface.image;
  return{hip:{...basePose.hip},bounds:{x:left,y:top,width:Math.max(0,right-left+1),height:Math.max(0,bottom-top+1)},baseIndex:r.baseIndex,scale:r.scale,sourceHip:{...pose.hip},mode:'arms-only-v3',armOnly:{neutralArms:config.neutralArms,arms:foreground.arms,targetMasks:foreground.targetPolygons,fixedPropMasks:config.fixedPropMasks||[],bodyPlate:config.bodyPlate,plateDiagnostics:plate.diagnostics}};
 });
 for(let dir=0;dir<4;dir++){const group=records.filter((r,index)=>meta.poses[index].dir===dir);if(!group.length)continue;const bounds=[baseMeta.poses[group[0].baseIndex].bounds,...group.map(r=>r.bounds)],x=Math.min(...bounds.map(b=>b.x)),y=Math.min(...bounds.map(b=>b.y)),right=Math.max(...bounds.map(b=>b.x+b.width)),bottom=Math.max(...bounds.map(b=>b.y+b.height));for(const record of group)record.previewBounds={x,y,width:right-x,height:bottom-y};}
 return records;
}
