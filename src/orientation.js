// Installed apps may lock their screen; Safari browser tabs need a rotation gate.
export async function requestLandscape(scope=globalThis){
 try{
  if(typeof scope.screen?.orientation?.lock!=='function')return false;
  await scope.screen.orientation.lock('landscape');
  return true;
 }catch{return false;}
}

export function installLandscapeMode(gate,scope=globalThis){
 const portrait=scope.matchMedia('(pointer: coarse) and (orientation: portrait)');
 const coarse=scope.matchMedia('(pointer: coarse)');
 const sync=()=>{
  if(portrait.matches){
   // Reinsert in the top layer when another game dialog opened behind this gate.
   if(gate.open)gate.close();
   gate.showModal();
  }else if(gate.open)gate.close();
 };
 const lock=()=>{
  if(coarse.matches&&(scope.navigator?.standalone||scope.matchMedia('(display-mode: standalone)').matches||scope.document.fullscreenElement||scope.document.webkitFullscreenElement))void requestLandscape(scope);
 };
 gate.addEventListener('cancel',event=>event.preventDefault());
 portrait.addEventListener('change',sync);
 scope.document.addEventListener('fullscreenchange',lock);
 scope.document.addEventListener('webkitfullscreenchange',lock);
 sync();lock();
 return sync;
}
