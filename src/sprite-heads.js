// Generated walk frames share a direction-specific head, so eye/mouth/hair
// pixels never change during a step. The source PNG remains untouched.
export function lockDirectionalHeads(frames,meta){
 if(!meta.lockHeads)return[];
 const count=meta.walkFrames||meta.frames?.walk?.length,records=[];
 for(let dir=0;dir<4;dir++){
  const first=dir*(count+1),reference=frames[first],canonical=meta.poses?.[first];
  if(!reference||!canonical?.headPolygon||!canonical?.neckAnchor)continue;
  const copy=document.createElement('canvas');copy.width=reference.width;copy.height=reference.height;copy.getContext('2d').drawImage(reference,0,0);
  for(let frame=0;frame<count;frame++){
   const index=first+frame,image=frames[index],pose=meta.poses?.[index],ctx=image?.getContext('2d');if(!ctx||!pose?.headPolygon||!pose?.neckAnchor)continue;
   const trace=(polygon,dx=0,dy=0)=>{ctx.beginPath();polygon.forEach(([x,y],i)=>i?ctx.lineTo(x+dx,y+dy):ctx.moveTo(x+dx,y+dy));ctx.closePath();};
   ctx.save();trace(pose.headPolygon);ctx.clip();ctx.clearRect(0,0,image.width,image.height);ctx.restore();
   const dx=pose.neckAnchor.x-canonical.neckAnchor.x,dy=pose.neckAnchor.y-canonical.neckAnchor.y;
   ctx.save();trace(canonical.headPolygon,dx,dy);ctx.clip();ctx.drawImage(copy,dx,dy);ctx.restore();
   records.push({dir,frame,index,reference:first,neck:{...pose.neckAnchor},offset:{x:dx,y:dy}});
  }
 }
 return records;
}
