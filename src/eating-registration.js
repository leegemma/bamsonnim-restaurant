// Normalize newly drawn upper bodies onto the established seated canvas.
// Head and pants/shoes are exact seated pixels; only the body and hands move.
export function registerEatingFrames(frames,meta,baseFrames,baseMeta){
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
