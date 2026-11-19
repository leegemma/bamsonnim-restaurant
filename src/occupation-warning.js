export const OCCUPATION_WARNING_DURATION=3800;
export const OCCUPATION_WARNING_TITLE='악한 좀비에게 점령당했다!';

// No game state, RNG or audio is touched. The initial observation is a sync,
// so opening a saved/settled restaurant at 100 does not replay an old warning.
export function createOccupationWarning(root=document.body,{clock=()=>performance.now(),duration=OCCUPATION_WARNING_DURATION,setTimer=setTimeout,clearTimer=clearTimeout}={}){
 const document=root.ownerDocument,layer=document.createElement('div'),title=document.createElement('strong');
 layer.className='occupation-warning';layer.hidden=true;layer.setAttribute('role','status');layer.setAttribute('aria-live','polite');layer.setAttribute('aria-atomic','true');
 title.className='occupation-warning-title';layer.append(title);root.append(layer);
 let observed=null,previous=null,until=0,timer=null,destroyed=false;
 function hide(){if(timer!==null)clearTimer(timer);timer=null;until=0;layer.hidden=true;title.textContent='';}
 function sync(state){hide();observed=state;previous=Number.isFinite(state?.hunger)?state.hunger:0;}
 function update(state,{editing=false,reconciling=false}={}){
  if(destroyed)return false;
  if(state!==observed||previous===null||editing||reconciling){sync(state);return false;}
  const hunger=Number.isFinite(state?.hunger)?state.hunger:0,entered=previous<100&&hunger>=100;previous=hunger;
  if(until&&clock()>=until)hide();
  if(!entered)return false;
  hide();title.textContent=OCCUPATION_WARNING_TITLE;layer.hidden=false;until=clock()+duration;
  timer=setTimer(hide,duration);return true;
 }
 function destroy(){if(destroyed)return;hide();destroyed=true;layer.remove();}
 return{update,sync,destroy};
}
