// Capability checks only. Installation stays with the browser's own user action;
// no prompt, permission request, service worker or storage migration runs here.
export function isStandalone(scope=globalThis){
  return scope.navigator?.standalone===true||!!scope.matchMedia?.('(display-mode: standalone)').matches;
}

export function fullscreenAvailable(doc=globalThis.document){
  const element=doc?.documentElement;
  return !!element&&(doc.fullscreenEnabled!==false&&typeof element.requestFullscreen==='function'||doc.webkitFullscreenEnabled!==false&&typeof element.webkitRequestFullscreen==='function');
}

// Call directly from a click/tap handler, before another asynchronous operation.
// Browsers without userActivation still enforce the gesture requirement themselves.
export async function requestFullscreen(doc=globalThis.document,nav=globalThis.navigator){
  if(doc?.fullscreenElement||doc?.webkitFullscreenElement||doc?.webkitIsFullScreen)return true;
  if(!fullscreenAvailable(doc)||nav?.userActivation?.isActive===false)return false;
  const element=doc.documentElement,request=doc.fullscreenEnabled!==false&&typeof element.requestFullscreen==='function'?element.requestFullscreen:element.webkitRequestFullscreen;
  try{
    await request.call(element);
    return !!(doc.fullscreenElement||doc.webkitFullscreenElement||doc.webkitIsFullScreen);
  }catch{return false;}
}
