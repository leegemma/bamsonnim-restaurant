export const WORKER_WALK_FPS=6;
export const WORKER_WALK_FRAME_COUNT=4;
// Coordinates were measured in the same alpha>80 trimmed canvases as cutAtlas.
// The top edge starts below the garment hem: faces, arms and apron never move.
export const WORKER_WALK_RIGS=Object.freeze([
 {width:283,height:399,footTop:369,split:165,stride:26},
 {width:301,height:412,footTop:382,split:180,stride:26},
 {width:298,height:394,footTop:364,split:184,stride:26},
 {width:308,height:411,footTop:382,split:195,stride:26},
 {width:267,height:411,footTop:381,split:143,stride:26},
 {width:276,height:402,footTop:373,split:158,stride:26},
 {width:287,height:409,footTop:380,split:170,stride:26},
 {width:290,height:396,footTop:367,split:177,stride:26},
].map(Object.freeze));
export const INFECTED_WORKER_WALK_RIG=Object.freeze({width:790,height:1140,footTop:1062,split:457,stride:74});
const cache=new WeakMap();
const poses=[ [{stride:-1,lift:.12},{stride:1,lift:-.65}], [{stride:0,lift:-.3},{stride:0,lift:0}], [{stride:1,lift:-.65},{stride:-1,lift:.12}], [{stride:0,lift:0},{stride:0,lift:-.3}] ];
const canvas=(base,width,height)=>{const out=base.ownerDocument.createElement('canvas');out.width=width;out.height=height;return out;};

// A split through a one-pixel inner trouser edge can leave a detached thread
// when the two feet cross. Remove only tiny detached packets below the hem;
// the protected torso and the complete shoe packets are never touched.
function removeDetachedThreads(out,width,height,footTop,scale){
 const seen=new Uint8Array(width*height),limit=Math.ceil(40*scale*scale);
 for(let y=footTop;y<height;y++)for(let x=0;x<width;x++){
  const start=y*width+x;if(seen[start]||out.data[start*4+3]<=20)continue;
  const queue=[start];seen[start]=1;let anchored=y===footTop;
  for(let n=0;n<queue.length;n++){const i=queue[n],xx=i%width,yy=Math.floor(i/width);if(yy===footTop)anchored=true;
   for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const nx=xx+dx,ny=yy+dy;if(nx<0||nx>=width||ny<footTop||ny>=height)continue;const j=ny*width+nx;if(!seen[j]&&out.data[j*4+3]>20){seen[j]=1;queue.push(j);}}
  }
  if(!anchored&&queue.length<limit)for(const i of queue)out.data.fill(0,i*4,i*4+4);
 }
}

export function workerWalkRig(base,{appearance=0,infected=false}={}){
 if(!Number.isInteger(appearance)||appearance<0||appearance>=WORKER_WALK_RIGS.length)throw Error('Invalid worker walk appearance');
 const measured=infected&&appearance===0&&base.height>700?INFECTED_WORKER_WALK_RIG:WORKER_WALK_RIGS[appearance];
 return{footTop:Math.round(measured.footTop*base.height/measured.height),split:Math.round(measured.split*base.width/measured.width),stride:Math.round(measured.stride*base.height/measured.height)};
}
export function getWorkerWalkFrame(base,{appearance=0,infected=false,phase=0,moving=true,reducedMotion=false}={}){
 if(!base?.getContext||!base.width||!base.height)throw Error('Worker walk requires a source canvas');
 if(!moving||reducedMotion)return{image:base,offsetX:0,offsetY:0,baseWidth:base.width,baseHeight:base.height,phase:null};
 if(!Number.isInteger(phase)||phase<0||phase>=WORKER_WALK_FRAME_COUNT)throw Error('Invalid worker walk phase');
 let variants=cache.get(base);if(!variants){variants=new Map();cache.set(base,variants);}
 const key=`${appearance}/${!!infected}`;
 if(!variants.has(key)){
  const rig=workerWalkRig(base,{appearance,infected}),padding=rig.stride+8,width=base.width+padding*2,height=base.height+Math.ceil((base.height-rig.footTop)*.12)+2;
  const source=base.getContext('2d',{willReadFrequently:true}).getImageData(0,0,base.width,base.height),frames=[];
  for(let frame=0;frame<WORKER_WALK_FRAME_COUNT;frame++){
   const image=canvas(base,width,height),ctx=image.getContext('2d',{willReadFrequently:true}),out=ctx.createImageData(width,height);
   // putImageData, rather than a scaled draw, keeps protected RGBA exact.
   for(let y=0;y<rig.footTop;y++)out.data.set(source.data.subarray(y*base.width*4,(y+1)*base.width*4),(y*width+padding)*4);
   for(const side of [0,1]){
    const pose=poses[frame][side],dx=pose.stride*rig.stride,depth=base.height-rig.footTop,ankle=Math.max(2,Math.round(depth*.32)),dy=Math.round(ankle*pose.lift),joint=rig.footTop+ankle+dy;
    for(let y=rig.footTop;y<height;y++){
     // Only the short sock/ankle connection stretches. The complete shoe
     // packet translates rigidly, retaining its native shape and colors.
     const ankleRow=y<joint,sourceY=ankleRow?Math.floor(rig.footTop+(y-rig.footTop+.5)*ankle/(ankle+dy)):y-dy;if(sourceY>=base.height)continue;
     const shift=ankleRow?dx*(sourceY-rig.footTop)/ankle:dx;
     for(let x=0;x<width;x++){
      const sourceX=Math.floor(x-padding-shift+.5);if(sourceX<0||sourceX>=base.width||(sourceX<rig.split?0:1)!==side)continue;
      const from=(sourceY*base.width+sourceX)*4,to=(y*width+x)*4,alpha=source.data[from+3];if(!alpha)continue;
      // The other foot can cross behind this one; transparent packet pixels
      // reveal it rather than punch holes through the stationary torso.
      const a=alpha/255,b=out.data[to+3]/255*(1-a),total=a+b;
      for(let c=0;c<3;c++)out.data[to+c]=Math.round((source.data[from+c]*a+out.data[to+c]*b)/total);
      out.data[to+3]=Math.round(total*255);
     }
    }
   }
   removeDetachedThreads(out,width,height,rig.footTop,base.height/400);
   ctx.putImageData(out,0,0);frames.push({image,offsetX:-padding,offsetY:0,baseWidth:base.width,baseHeight:base.height,phase:frame,rig});
  }
  variants.set(key,frames);
 }
 return variants.get(key)[phase];
}

// Placement always describes the unpadded original. No path, bob, tray or food
// coordinate is changed here. Return false to use the original idle renderer.
export function drawWorkerWalk(ctx,base,placement,{flip=placement.flip||false,filter='',clock=0,appearance=0,infected=false,moving=false,reducedMotion=false}={}){
 if(!moving||reducedMotion||!base?.getContext)return false;
 const frame=getWorkerWalkFrame(base,{appearance,infected,phase:Math.floor(Math.max(0,clock)*WORKER_WALK_FPS)%WORKER_WALK_FRAME_COUNT}),sx=placement.width/frame.baseWidth,sy=placement.height/frame.baseHeight;
 const previousFilter=ctx.filter;ctx.save();ctx.imageSmoothingEnabled=false;if(filter&&typeof previousFilter==='string')ctx.filter=filter;ctx.translate(placement.x+placement.width/2,placement.y);if(flip)ctx.scale(-1,1);
 ctx.drawImage(frame.image,-placement.width/2+frame.offsetX*sx,frame.offsetY*sy,frame.image.width*sx,frame.image.height*sy);ctx.restore();if(ctx.filter!==previousFilter)ctx.filter=previousFilter;return true;
}
