function polygon(context,points){context.beginPath();points.forEach(([x,y],i)=>i?context.lineTo(x,y):context.moveTo(x,y));context.closePath();}

// Companion masks belong to a pose's local pixels; never alter the source PNG.
export function splitGroundCompanions(frames,asset){
 return frames.map((owner,index)=>(asset.poses?.[index]?.companions||[]).filter(item=>item.drawMode==='ground').map(item=>{
  const {source,erasePolygon}=item;
  if(!source||!erasePolygon?.length)return null;
  const image=document.createElement('canvas');image.width=source.width;image.height=source.height;
  const crop=image.getContext('2d');crop.save();crop.translate(-source.x,-source.y);polygon(crop,erasePolygon);crop.clip();crop.drawImage(owner,0,0);crop.restore();
  const context=owner.getContext('2d');context.save();context.globalCompositeOperation='destination-out';polygon(context,erasePolygon);context.fill();context.restore();
  return {...item,image};
 }).filter(Boolean));
}
