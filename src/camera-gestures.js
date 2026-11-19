import {screenToScene,clampZoom,clampCamera,panCameraBy,zoomCameraAt,wheelZoomFactor} from './camera.js';

export function createCameraGestures({getCamera,setCamera,getViewport,getBounds,getLimits,onTap,onHover,onGestureChange,now=()=>Date.now()}){
  const pointers=new Map();let single=null,pinch=null,tainted=false,blockedUntil=0,gesturing=false;
  const change=value=>{if(value!==gesturing){gesturing=value;onGestureChange?.(value);}};
  const camera=()=>({...getCamera()}),viewport=()=>getViewport(),bounds=()=>getBounds?.(),limits=()=>getLimits?.();
  function rebase(){
    single=null;pinch=null;
    if(pointers.size>=2){const [a,b]=[...pointers.values()];pinch={ids:[a.id,b.id],distance:Math.hypot(a.x-b.x,a.y-b.y),mid:{x:(a.x+b.x)/2,y:(a.y+b.y)/2},camera:camera()};tainted=true;change(true);}
    else if(pointers.size===1){const p=pointers.values().next().value;single={id:p.id,x:p.x,y:p.y,camera:camera(),moved:tainted};change(tainted);}
    else change(false);
  }
  function down(p){
    if(p.button!==undefined&&p.button!==0||pointers.has(p.id))return false;
    if(!pointers.size){tainted=false;blockedUntil=0;}pointers.set(p.id,{...p});
    if(pointers.size<=2)rebase();else{tainted=true;change(true);}return true;
  }
  function move(p){
    if(!pointers.has(p.id)){if(!pointers.size&&(p.buttons===0||p.buttons===undefined&&p.pointerType!=='touch'))onHover?.(p);return;}
    pointers.set(p.id,{...p});
    if(pinch){
      const a=pointers.get(pinch.ids[0]),b=pointers.get(pinch.ids[1]);if(!a||!b){rebase();return;}if(!pinch.ids.includes(p.id))return;
      const distance=Math.hypot(a.x-b.x,a.y-b.y);if(pinch.distance<1){if(distance>=1)rebase();return;}
      const mid={x:(a.x+b.x)/2,y:(a.y+b.y)/2},v=viewport(),anchor=screenToScene(pinch.mid,pinch.camera,v,limits()),zoom=clampZoom(pinch.camera.zoom*distance/pinch.distance,limits());
      setCamera(clampCamera({zoom,panX:mid.x-v.width/2-(anchor.x-v.width/2)*zoom,panY:mid.y-v.height/2-(anchor.y-v.height/2)*zoom},v,bounds(),limits()));return;
    }
    if(single){const dx=p.x-single.x,dy=p.y-single.y;if(Math.abs(dx)+Math.abs(dy)>8)single.moved=true;if(single.moved){tainted=true;change(true);setCamera(panCameraBy(single.camera,dx,dy,viewport(),bounds(),limits()));}}
    // Hover is intentionally idle-only; edit ghosts must not move on a press.
  }
  function finish(p,cancelled=false){
    if(!pointers.has(p.id))return false;
    const tap=!cancelled&&pointers.size===1&&single?.id===p.id&&!single.moved&&!tainted&&Math.abs(p.x-single.x)+Math.abs(p.y-single.y)<=8;
    if(cancelled)tainted=true;pointers.delete(p.id);blockedUntil=now()+700;
    if(pinch&&pointers.has(pinch.ids[0])&&pointers.has(pinch.ids[1])){if(!pointers.size)rebase();}
    else rebase();
    if(tap)onTap?.(p);return tap;
  }
  function cancel(){tainted=true;pointers.clear();single=null;pinch=null;blockedUntil=now()+700;change(false);}
  function wheel(deltaY,anchor,deltaMode=0){
    if(pointers.size){tainted=true;change(true);blockedUntil=now()+700;}setCamera(zoomCameraAt(camera(),wheelZoomFactor(deltaY,deltaMode,viewport()),anchor,viewport(),bounds(),limits()));if(pointers.size)rebase();
  }
  function click({detail=0,isTrusted=false}={}){const allowed=detail===0&&!pointers.size&&(now()>=blockedUntil||isTrusted);blockedUntil=0;return allowed;}
  return{down,move,up:p=>finish(p),cancelPointer:p=>finish(p,true),cancel,wheel,click,get active(){return pointers.size>0;},get gesturing(){return gesturing;},get pointerIds(){return[...pointers.keys()];}};
}

export function bindCameraGestures(canvas,options){
  let consumedClick=null;
  const input=createCameraGestures(options),listeners=[],listen=(target,type,handler,settings)=>{target.addEventListener(type,handler,settings);listeners.push(()=>target.removeEventListener(type,handler,settings));},point=e=>({...options.toScreen(e),id:e.pointerId,button:e.button,buttons:e.buttons,pointerType:e.pointerType}),release=id=>{try{if(canvas.hasPointerCapture?.(id))canvas.releasePointerCapture(id);}catch{}};
  // A pointerup can open a modal before the browser dispatches its click. That
  // click may target the new modal, so a canvas-only listener cannot consume it.
  listen(canvas.ownerDocument,'pointerdown',()=>{consumedClick=null;},true);
  listen(canvas.ownerDocument,'click',e=>{
    const consumed=consumedClick;
    if(!consumed||e.detail===0)return;
    consumedClick=null;
    if(Math.hypot(e.clientX-consumed.x,e.clientY-consumed.y)<=8){e.preventDefault();e.stopImmediatePropagation();}
  },true);
  listen(canvas,'pointerdown',e=>{if(!input.down(point(e)))return;e.preventDefault();canvas.focus?.({preventScroll:true});try{canvas.setPointerCapture(e.pointerId);}catch{}});
  listen(canvas,'pointermove',e=>{input.move(point(e));if(input.active)e.preventDefault();});
  listen(canvas,'pointerup',e=>{if(!input.pointerIds.includes(e.pointerId))return;e.preventDefault();consumedClick={x:e.clientX,y:e.clientY};input.up(point(e));release(e.pointerId);});
  listen(canvas,'pointercancel',e=>{input.cancelPointer(point(e));release(e.pointerId);});
  listen(canvas,'lostpointercapture',e=>input.cancelPointer(point(e)));
  listen(canvas,'pointerleave',()=>{if(!input.active)options.onLeave?.();});
  listen(canvas,'click',e=>{e.preventDefault();e.stopImmediatePropagation();if(input.click(e))options.onTap?.(options.toScreen(e));});
  listen(canvas,'wheel',e=>{e.preventDefault();input.wheel(e.deltaY,options.toScreen(e),e.deltaMode);},{passive:false});
  listen(canvas,'contextmenu',e=>e.preventDefault());
  const cancel=()=>{const ids=input.pointerIds;input.cancel();ids.forEach(release);};listen(canvas.ownerDocument.defaultView,'blur',cancel);
  return{input,cancel,destroy(){cancel();listeners.forEach(remove=>remove());}};
}
