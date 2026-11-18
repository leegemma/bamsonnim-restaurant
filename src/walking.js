import {WALK_ANIMATION} from './data.js';

// Render-only state: neither animation progress nor facing belongs in a save.
export function walkingPose(actor,previous,{reducedMotion=false,active=true,time=0,seatedDirection=null,idleDirection=null,keys=WALK_ANIMATION.keys,frameCount=keys?.length||WALK_ANIMATION.keys.length,fps=WALK_ANIMATION.fps,sequence=null}={}){
  const dx=previous?actor.x-previous.x:0,dy=previous?actor.y-previous.y:0;
  const distance=Math.hypot(dx,dy),hasRoute=!!actor.path?.length;
  const moving=hasRoute&&active;
  const target=actor.path?.[0];
  // Isometric screen X is world X minus world Y.
  const screenX=distance>1e-6?dx-dy:!previous&&target?(target[0]-actor.x)-(target[1]-actor.y):0;
  const flip=Math.abs(screenX)>1e-6?screenX<0:previous?.flip||false;
  const tx=target?target[0]-actor.x:0,ty=target?target[1]-actor.y:0;
  const restDirection=Number.isInteger(idleDirection)&&idleDirection>=0&&idleDirection<4?idleDirection:previous?.direction??0;
  const direction=seatedDirection!==null?seatedDirection:hasRoute&&Math.hypot(tx,ty)>1e-6?(Math.abs(tx)>Math.abs(ty)?tx>0?0:2:ty>0?1:3):restDirection;
  const startedAt=moving&&previous?.moving?previous.startedAt:time;
  // Use interpolated simulation time: the engine moves in 250ms steps, while
  // render frames are continuous. Pausing or changing game speed stays in sync.
  const count=Number.isInteger(frameCount)&&frameCount>0?frameCount:WALK_ANIMATION.keys.length,rate=Number.isFinite(fps)&&fps>0?fps:WALK_ANIMATION.fps;
  const cycle=Array.isArray(sequence)&&sequence.length&&sequence.every(frame=>Number.isInteger(frame)&&frame>=0&&frame<count)?sequence:null,step=Math.floor(Math.max(0,time-startedAt)*rate);
  const frame=cycle?cycle[step%cycle.length]:step%count;
  return{x:actor.x,y:actor.y,flip,direction,frame:moving&&!reducedMotion?frame:0,startedAt,moving,key:moving&&!reducedMotion?keys?.[frame]??null:null};
}
