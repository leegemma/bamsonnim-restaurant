import {reconcileOffline} from './engine.js';

self.onmessage=({data})=>{
  try{const state=data.state,report=reconcileOffline(state,data.now);self.postMessage({state,report});}
  catch(error){self.postMessage({error:error.message});}
};
