export const EATING_FPS=5;
export const EATING_SEQUENCE=[0,1,2];

// The original animation clock keeps running between waiting and eating.
// Use existing visit time so no animation state enters the save format.
export function eatingAnimationFrame(actor,time,{reducedMotion=false}={}){
 if(actor?.phase!=='eating'||reducedMotion||!Number.isFinite(time))return 0;
 const elapsed=Math.max(0,time-(Number.isFinite(actor.enteredAt)?actor.enteredAt:0));
 return Math.floor(elapsed*EATING_FPS+1e-8)%EATING_SEQUENCE.length;
}

export function eatingSpriteFrame(base,extra,direction,frame=0){
 if(!base||!Number.isInteger(direction)||direction<0||direction>3)return null;
 const neutral=()=>({key:base.key,index:direction*(base.walkFrames+1)+base.frames.sit,frame:0});
 if(frame===0||!extra)return neutral();
 const pose=extra.poses.find(p=>p.dir===direction&&p.frame===frame&&p.state==='eat');
 return pose?{key:extra.key,index:pose.index,frame}:neutral();
}
