// Normalize newly drawn upper bodies onto the established seated canvas.
// Pants/shoes are copied as exact pixels, independent of hand/mouth motion.
export function registerEatingFrames(frames,meta,baseFrames,baseMeta){
 const records=meta.poses.map((pose,index)=>{
  const r=pose.registration,base=baseFrames[r?.baseIndex],basePose=baseMeta.poses[r?.baseIndex],raw=frames[index];
  if(!raw||!base||!basePose?.hip||!pose.hip||!Number.isFinite(r?.scale)||r.scale<=0||!Number.isInteger(r.lowerBodyTopY)||r.lowerBodyTopY<0||r.lowerBodyTopY>=base.height)throw Error(`Invalid eating registration ${index}`);
  const image=document.createElement('canvas');image.width=base.width;image.height=base.height;const ctx=image.getContext('2d',{willReadFrequently:true});ctx.imageSmoothingEnabled=false;
  const dx=basePose.hip.x-pose.hip.x*r.scale,dy=basePose.hip.y-pose.hip.y*r.scale;
  ctx.drawImage(raw,dx,dy,raw.width*r.scale,raw.height*r.scale);
  const baseCtx=base.getContext('2d');
  ctx.putImageData(baseCtx.getImageData(0,r.lowerBodyTopY,base.width,base.height-r.lowerBodyTopY),0,r.lowerBodyTopY);
  // Keep hair/eyes identical; mouth and raised hands remain animated.
  for(const rect of r.identityRects||[]){
   const {x,y,width,height}=rect;if(![x,y,width,height].every(Number.isInteger)||x<0||y<0||width<=0||height<=0||x+width>base.width||y+height>base.height)throw Error(`Invalid eating identity region ${index}`);
   ctx.putImageData(baseCtx.getImageData(x,y,width,height),x,y);
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
