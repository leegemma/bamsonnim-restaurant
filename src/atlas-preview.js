import {directionalCharacter,ASSET_MANIFEST} from './assets.js';

// A missing actor keeps its own missing state; another character is never a fallback.
export function atlasForActor(id){return typeof id==='string'?directionalCharacter(id):null;}

const wrap=(value,length)=>((Math.trunc(value)%length)+length)%length;
function directionIndex(meta,dir){
  if(Number.isFinite(dir))return wrap(dir,4);
  const found=meta?.directions?.findIndex(d=>d.id===dir);return found>=0?found:null;
}

export function frameForPose(meta,dir=0,state='walk',frame=0){
  if(!meta||!['walk','sit','idle'].includes(state))return null;
  const direction=directionIndex(meta,dir),walk=meta.frames?.walk;
  if(direction===null||!Array.isArray(walk)||!walk.length)return null;
  const column=state==='sit'?meta.frames.sit:state==='idle'?(meta.frames.idle??walk[0]):walk[wrap(Number.isFinite(frame)?frame:0,walk.length)];
  if(!Number.isInteger(column)||column<0||column>walk.length)return null;
  const index=direction*(walk.length+1)+column,pose=meta.poses?.find(p=>p.index===index);
  return pose&&pose.dir===direction&&pose.state===(state==='sit'?'sit':'walk')?index:null;
}

function dedicatedSeating(id,manifest){
  return Object.values(manifest).find(meta=>meta.type==='seated-atlas'&&[0,1,2,3].every(dir=>meta.poses?.some(p=>p.state==='sit'&&p.dir===dir&&(p.actorId===id||!p.actorId&&meta.actorId===id))));
}

// Counts describe registered metadata, not a promise that an image loaded or passed visual review.
// `unregistered` means no directional atlas; it can include actors with sit-only legacy art.
export function getCoverage(roster,{resolveAtlas=atlasForActor,manifest=ASSET_MANIFEST}={}){
  const ids=[...new Set(roster.filter(actor=>typeof actor==='string'||!actor.event).map(actor=>typeof actor==='string'?actor:actor.id).filter(id=>typeof id==='string'))];
  const entries=ids.map(id=>{
    const meta=resolveAtlas(id),count=meta?.frames?.walk?.length||0;
    let walkPoses=0,sitPoses=0;
    for(let dir=0;dir<4;dir++){for(let frame=0;frame<count;frame++)if(frameForPose(meta,dir,'walk',frame)!==null)walkPoses++;if(frameForPose(meta,dir,'sit')!==null)sitPoses++;}
    const walk=count>0&&walkPoses===count*4,directionalSit=sitPoses===4,seated=directionalSit?meta:dedicatedSeating(id,manifest),sit=!!seated;
    return{id,registered:!!meta,walk,sit,complete:walk&&sit,walkKey:walk?meta.key:null,sitKey:seated?.key||null,walkFrames:count,walkPoses,sitPoses:sit?4:sitPoses,sitOnly:!walk&&sit};
  });
  return{total:entries.length,walking:entries.filter(e=>e.walk).length,sitting:entries.filter(e=>e.sit).length,complete:entries.filter(e=>e.complete).length,
    missingWalk:entries.filter(e=>!e.walk).map(e=>e.id),missingSit:entries.filter(e=>!e.sit).map(e=>e.id),unregistered:entries.filter(e=>!e.registered).map(e=>e.id),entries};
}

export function drawAtlasFrame(canvas,image,meta,index,{showSeatAnchor=false,companions=[],registration=null}={}){
  const size=280,ctx=canvas?.getContext?.('2d');if(!ctx)return null;
  if(canvas.width!==size)canvas.width=size;if(canvas.height!==size)canvas.height=size;
  ctx.clearRect(0,0,size,size);
  const pose=meta?.poses?.find(p=>p.index===index),source=pose?.source||pose;
  if(!image||!pose||![source?.x,source?.y,source?.width,source?.height].every(Number.isFinite)||source.width<=0||source.height<=0)return null;
  const seated=['sit','eat'].includes(pose.state),hip=seated&&(registration?.hip||pose.hip),anchor=hip||pose.anchor||meta.anchor||{x:image.width/2,y:image.height},target={x:140,y:seated?196:256},bounds=registration?.previewBounds||registration?.bounds||pose.bounds||{x:0,y:0,width:image.width,height:image.height};
  if(![anchor.x,anchor.y,bounds.x,bounds.y,bounds.width,bounds.height].every(Number.isFinite))return null;
  const reference=meta.referenceHeight>0?meta.referenceHeight:source.height,padding=12;
  let scale=232/reference;
  for(const [extent,space]of [[anchor.x-bounds.x,target.x-padding],[bounds.x+bounds.width-anchor.x,size-padding-target.x],[anchor.y-bounds.y,target.y-padding],[bounds.y+bounds.height-anchor.y,size-padding-target.y]])if(extent>0)scale=Math.min(scale,space/extent);
  const destination={x:target.x-anchor.x*scale,y:target.y-anchor.y*scale,width:image.width*scale,height:image.height*scale};
  // The renderer already cut this image to the untrimmed cell. Source metadata
  // supplies cell-local geometry; applying its atlas offsets again would crop it twice.
  ctx.save();ctx.imageSmoothingEnabled=false;
  for(const companion of companions){const offset=companion.relativeGroundOffset||{x:0,y:0},foot=companion.footAnchor,im=companion.image;ctx.drawImage(im,140+offset.x*reference*scale-foot.x*scale,256+offset.y*reference*scale-foot.y*scale,im.width*scale,im.height*scale);}
  ctx.drawImage(image,destination.x,destination.y,destination.width,destination.height);
  if(showSeatAnchor){ctx.strokeStyle=hip?'#f6ce75':'#8dd7c9';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(target.x-7,target.y);ctx.lineTo(target.x+7,target.y);ctx.moveTo(target.x,target.y-7);ctx.lineTo(target.x,target.y+7);ctx.stroke();}
  ctx.restore();
  return{source:{x:source.x,y:source.y,width:source.width,height:source.height},destination,scale,anchor:{...anchor},target,anchorKind:hip?'hip':'foot',measuredHip:!!hip};
}
