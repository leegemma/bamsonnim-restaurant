export const CAMERA_MIN_ZOOM=.7,CAMERA_MAX_ZOOM=1.8;
const finite=(n,fallback=0)=>Number.isFinite(n)?n:fallback;
export function clampZoom(n,limits){const min=finite(limits?.minZoom,CAMERA_MIN_ZOOM),max=Math.max(min,finite(limits?.maxZoom,CAMERA_MAX_ZOOM));return Math.max(min,Math.min(max,finite(n,1)));}
const bounded=clampZoom;
export function gameplayTile(viewport,size){const {width:W,height:H}=viewport,n=Math.max(1,finite(size,8));return Math.max(22,Math.min(83,(W-(W<800?165:260))/n,H<400?(H-30)/(n*.5+1.5):(H-155)/(n/2)));}
export function gameplayCameraLimits(viewport,size){const baseTile=gameplayTile(viewport,size),desiredTile=Math.max(70,Math.min(140,Math.min(viewport.width,viewport.height)*.28));return{minZoom:CAMERA_MIN_ZOOM,maxZoom:Math.max(1.4,Math.min(3.2,desiredTile/baseTile))};}
export const createCamera=()=>({zoom:1,panX:0,panY:0});

export function cameraTransform(camera,viewport,limits){
  const zoom=bounded(camera?.zoom,limits);return{zoom,x:viewport.width/2*(1-zoom)+finite(camera?.panX),y:viewport.height/2*(1-zoom)+finite(camera?.panY)};
}
export function sceneToScreen(point,camera,viewport,limits){const m=cameraTransform(camera,viewport,limits);return{x:point.x*m.zoom+m.x,y:point.y*m.zoom+m.y};}
export function screenToScene(point,camera,viewport,limits){const m=cameraTransform(camera,viewport,limits);return{x:(point.x-m.x)/m.zoom,y:(point.y-m.y)/m.zoom};}
export function visibleSceneRect(camera,viewport,limits){const p=screenToScene({x:0,y:0},camera,viewport,limits),zoom=bounded(camera?.zoom,limits);return{...p,width:viewport.width/zoom,height:viewport.height/zoom};}
export function clientToScreen(point,rect,viewport){return{x:(point.clientX-rect.left)*viewport.width/(rect.width||1),y:(point.clientY-rect.top)*viewport.height/(rect.height||1)};}

export function clampCamera(camera,viewport,bounds,limits){
  const result={zoom:bounded(camera?.zoom,limits),panX:finite(camera?.panX),panY:finite(camera?.panY)};
  if(!(viewport.width>0&&viewport.height>0))return result;
  const b=bounds||{x:0,y:0,width:viewport.width,height:viewport.height};
  for(const [axis,length,pan]of [['x','width','panX'],['y','height','panY']]){
    const center=viewport[length]/2,inset=Math.min(80,Math.max(0,b[length])*.2),low=Math.min(center,b[axis]+inset),high=Math.max(center,b[axis]+b[length]-inset);
    result[pan]=Math.max((center-high)*result.zoom,Math.min((center-low)*result.zoom,result[pan]));
  }
  return result;
}
export function zoomCameraAt(camera,factor,anchor,viewport,bounds,limits){
  const at=anchor||{x:viewport.width/2,y:viewport.height/2},scene=screenToScene(at,camera,viewport,limits),zoom=bounded(bounded(camera?.zoom,limits)*(Number.isFinite(factor)&&factor>0?factor:1),limits);
  return clampCamera({zoom,panX:at.x-viewport.width/2-(scene.x-viewport.width/2)*zoom,panY:at.y-viewport.height/2-(scene.y-viewport.height/2)*zoom},viewport,bounds,limits);
}
export function panCameraBy(camera,dx,dy,viewport,bounds,limits){return clampCamera({...camera,panX:finite(camera?.panX)+finite(dx),panY:finite(camera?.panY)+finite(dy)},viewport,bounds,limits);}
export function resizeCamera(camera,before,after,bounds,limits){
  return clampCamera({...camera,panX:finite(camera?.panX)*(before?.width>0?after.width/before.width:1),panY:finite(camera?.panY)*(before?.height>0?after.height/before.height:1)},after,bounds,limits);
}
export function wheelZoomFactor(deltaY,deltaMode=0,viewport={height:1}){const pixels=finite(deltaY)*(deltaMode===1?16:deltaMode===2?viewport.height:1);return Math.exp(-Math.max(-100,Math.min(100,pixels))*.0015);}

// The backdrop is a viewport layer; room zoom/pan must not magnify it again.
export function backgroundCover(image,viewport){
  const scale=Math.max(viewport.width/image.width,viewport.height/image.height),width=image.width*scale,height=image.height*scale;
  return{x:(viewport.width-width)/2,y:(viewport.height-height)/2,width,height};
}

// Only margins beyond the original cover image are reflected. The original
// central draw is identical at the default camera, including its color/alpha.
export function backgroundCopies(image,viewport,camera,limits){
  const {x,y,width,height}=backgroundCover(image,viewport),visible=visibleSceneRect(camera,viewport,limits),out=[];
  if(!(width>0&&height>0))return out;
  for(let row=Math.floor((visible.y-y)/height);row<Math.ceil((visible.y+visible.height-y)/height);row++)for(let col=Math.floor((visible.x-x)/width);col<Math.ceil((visible.x+visible.width-x)/width);col++)out.push({x:x+col*width,y:y+row*height,width,height,flipX:Math.abs(col%2)===1,flipY:Math.abs(row%2)===1});
  return out;
}
