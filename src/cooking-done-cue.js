// Runtime-only observation: cooking batches and cue history never enter a save.
export function createCookingDoneCue(){
  let observedState=null,batches=new Map();
  function read(state){
    const result=[];
    for(const stove of state?.objects||[]){
      const cook=stove.cook;if(typeof stove.uid!=='string'||!cook||!Number.isFinite(state.time)||!Number.isFinite(cook.readyAt)||!Number.isFinite(cook.spoilAt))continue;
      const phase=cook.collecting?'collecting':state.time<cook.readyAt?'cooking':state.time>=cook.spoilAt?'spoiled':'done';
      const complete=phase==='done'||phase==='collecting'&&state.time>=cook.readyAt;
      result.push({id:stove.uid,cook,phase,complete});
    }
    return result;
  }
  const record=({cook,phase,complete},live=false)=>{const armed=phase==='cooking'||live&&complete;return{cook,foodId:cook.foodId,started:cook.started,armed,finished:!armed};};
  function sync(state){
    observedState=state;batches=new Map(read(state).map(batch=>[batch.id,record(batch)]));
  }
  function scan(state,{audible=true}={}){
    // A replacement state is a load/import, never a new completion to replay.
    if(state!==observedState){sync(state);return{completed:0,play:false};}
    let completed=0;const next=new Map();
    for(const batch of read(state)){
      // A new live batch may be cooked and instantly finished between frames.
      // sync() consumes pre-existing done batches before live scanning begins.
      const {id,cook,phase}=batch,previous=batches.get(id),same=previous&&previous.cook===cook&&previous.foodId===cook.foodId&&previous.started===cook.started,current=same?previous:record(batch,true);
      if(phase==='cooking')current.armed=true;
      else{
        if(batch.complete&&current.armed&&!current.finished)completed++;
        // Silent, spoiled and collected completions are consumed immediately.
        current.finished=true;
      }
      next.set(id,current);
    }
    // Collection now removes the pot's batch immediately. A batch observed
    // while cooking can still finish and be collected between two frames.
    for(const [id,previous] of batches)if(next.get(id)?.cook!==previous.cook&&previous.armed&&!previous.finished&&state.time>=previous.cook.readyAt&&state.time<previous.cook.spoilAt)completed++;
    batches=next;return{completed,play:!!audible&&completed>0};
  }
  return{sync,scan};
}
