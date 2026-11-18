import {reconcileOffline} from './engine.js';

// The worker runs the same engine and returns the same save/report. It never
// writes storage; closing this loading screen leaves the original save intact.
export async function reconcileAtStartup(state,now=Date.now()){
  if(now-state.savedAt<3000)return{state,report:reconcileOffline(state,now)};
  try{return await new Promise((resolve,reject)=>{
    const worker=new Worker(new URL('./offline-worker.js',import.meta.url),{type:'module'});
    const timeout=setTimeout(()=>{worker.terminate();reject(new Error('정산 응답 지연'));},120000);
    const finish=()=>{clearTimeout(timeout);worker.terminate();};
    worker.onmessage=({data})=>{finish();data.error?reject(new Error(data.error)):resolve(data);};
    worker.onerror=error=>{error.preventDefault();finish();reject(error);};
    try{worker.postMessage({state,now});}catch(error){finish();reject(error);}
  });}catch{
    // Older browsers can still open their save. Paint the loading notice first
    // and reconcile a fresh copy if a worker could not start or failed.
    await new Promise(resolve=>setTimeout(resolve,0));
    const copy=structuredClone(state);return{state:copy,report:reconcileOffline(copy,now)};
  }
}
