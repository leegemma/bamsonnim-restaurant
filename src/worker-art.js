// Pilot artwork is limited to the first employee's infected appearance.
export function workerFrame(appearance=0,{infected=false}={}){
  return infected&&appearance===0?{key:'infectedHaon',index:0}:{key:'workers',index:appearance};
}
