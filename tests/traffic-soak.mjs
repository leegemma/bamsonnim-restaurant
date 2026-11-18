import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';

// Explicit long-running diagnostic; deliberately excluded from npm test.
// ENGINE_DIR can point at a frozen source snapshot for before/after evidence.
const engineDir=path.resolve(process.env.ENGINE_DIR||'src');
const E=await import(pathToFileURL(path.join(engineDir,'engine.js')).href);
const {RECIPES}=await import(pathToFileURL(path.join(engineDir,'data.js')).href);
const seconds=Number(process.env.SOAK_SECONDS||1800);
const seatCounts=(process.env.SOAK_SEATS||'4,8,12').split(',').map(Number);
const output=process.env.SOAK_OUTPUT||'artifacts/traffic-soak';
const seed=Number(process.env.SOAK_SEED||67291);
const clutter=process.env.SOAK_CLUTTER==='1';
const source=await fs.readFile(path.join(engineDir,'engine.js'),'utf8');
const engineHash=createHash('sha256').update(source).digest('hex');
await fs.mkdir(output,{recursive:true});

function fixture(count){
 const s=E.newGame();s.level=30;s.coins=1e9;s.hearts=1e6;s.seed=seed;
 for(const r of RECIPES){s.mastery[r.id]=r.milestones.at(-1);s.knownRecipes[r.id]=true;}
 const add=(type,x,y,dir=0)=>{const problem=E.place(s,{type,x,y,dir});if(problem)throw new Error(`${count} seats: ${type}(${x},${y}): ${problem}`);};
 add('server',6,1);add('server',0,3);
 if(count>=8){add('table',2,2);add('chair',3,2,2);add('chair',2,3,3);add('table',5,2);add('chair',5,3,3);add('chair',6,2,2);}
 if(count>=12){add('table',2,6);add('chair',1,6,0);add('chair',2,7,3);add('table',5,6);add('chair',5,7,3);add('chair',6,6,2);}
 if(clutter){add('jars',0,4);add('bonsai',3,6);}
 while(s.waiters.length<8){const problem=E.hire(s);if(problem)throw new Error(problem);}
 s.objects.filter(o=>o.type==='server').forEach((o,i)=>Object.assign(o,{foodId:['rice','soup','skewer'][i],stock:100000}));
 if(E.seats(s).length!==count)throw new Error(`Expected ${count} reachable seats, got ${E.seats(s).length}`);
 return s;
}

async function run(count){
 const s=fixture(count),name=`${count}-seats${clutter?'-clutter':''}`,started=performance.now();
 await fs.writeFile(`${output}/${name}-initial.json`,JSON.stringify(s,null,2));
 const guests=new Map(),windows=[],collisions=[],snapshots=[];
 let lastIds=new Set(),arrivals=0,exits=0,maxCustomers=0,maxLeaving=0,maxLeaveSeconds=0,maxResidenceSeconds=0,overlapSamples=0,allowedGuestCrossings=0;
 let lastArrivalAt=0,lastExitAt=0,lastPaymentAt=0,maxArrivalGap=0,maxExitGap=0,maxPaymentGap=0;
 let windowStart={time:0,arrivals:0,exits:0,sold:0,served:0};
 const stateSummary=()=>{
  const phases={};let oldest=null;
  for(const c of s.customers){phases[c.phase]=(phases[c.phase]||0)+1;const g=guests.get(c.uid);if(g?.leavingAt!==undefined&&(!oldest||s.time-g.leavingAt>oldest.seconds))oldest={uid:c.uid,seconds:s.time-g.leavingAt,x:c.x,y:c.y,path:c.path};}
  return{time:s.time,customers:s.customers.length,phases,oldestLeaving:oldest,spawnIn:s.spawnIn,hunger:s.hunger,sold:s.stats.sold,served:s.stats.served};
 };
 for(let tick=0;tick<seconds*4;tick++){
  const soldBefore=s.stats.sold;E.advance(s,.25);
  const currentIds=new Set(s.customers.map(c=>c.uid));
  for(const c of s.customers){
   let g=guests.get(c.uid);
   if(!g){g={uid:c.uid,zombieId:c.zombieId,spawnAt:s.time,phases:[]};guests.set(c.uid,g);arrivals++;maxArrivalGap=Math.max(maxArrivalGap,s.time-lastArrivalAt);lastArrivalAt=s.time;}
   if(g.lastPhase!==c.phase){g.phases.push({time:s.time,phase:c.phase,seat:c.seat,x:c.x,y:c.y});if(c.phase==='leaving'&&g.leavingAt===undefined){g.leavingAt=s.time;g.paid=g.lastPhase==='eating';}g.lastPhase=c.phase;}
   g.lastPosition={x:c.x,y:c.y};
   if(g.leavingAt!==undefined)maxLeaveSeconds=Math.max(maxLeaveSeconds,s.time-g.leavingAt);
   maxResidenceSeconds=Math.max(maxResidenceSeconds,s.time-g.spawnAt);
  }
  for(const uid of lastIds)if(!currentIds.has(uid)){
   const g=guests.get(uid);g.exitedAt=s.time;g.residenceSeconds=s.time-g.spawnAt;if(g.leavingAt!==undefined){g.leavingSeconds=s.time-g.leavingAt;maxLeaveSeconds=Math.max(maxLeaveSeconds,g.leavingSeconds);}
   exits++;maxExitGap=Math.max(maxExitGap,s.time-lastExitAt);lastExitAt=s.time;
  }
  lastIds=currentIds;
  if(s.stats.sold>soldBefore){maxPaymentGap=Math.max(maxPaymentGap,s.time-lastPaymentAt);lastPaymentAt=s.time;}
  maxCustomers=Math.max(maxCustomers,s.customers.length);maxLeaving=Math.max(maxLeaving,s.customers.filter(c=>c.phase==='leaving').length);
  const mobileGuests=new Set(s.customers.filter(c=>['queue','seating','leaving','chasing'].includes(c.phase))),positions=new Map();for(const actor of [...s.waiters,...s.customers]){
   const key=`${actor.x.toFixed(6)},${actor.y.toFixed(6)}`;
   const previous=positions.get(key)||[];for(const other of previous){if(mobileGuests.has(actor)&&mobileGuests.has(other)){allowedGuestCrossings++;continue;}overlapSamples++;if(collisions.length<20)collisions.push({time:s.time,first:other.uid,second:actor.uid,phases:[other.phase||'worker',actor.phase||'worker'],x:actor.x,y:actor.y});}previous.push(actor);positions.set(key,previous);
  }
  if(!snapshots.length&&s.customers.some(c=>{const g=guests.get(c.uid);return g.leavingAt!==undefined&&s.time-g.leavingAt>=120;})){
   const file=`${name}-first-leaving-120s.json`;await fs.writeFile(`${output}/${file}`,JSON.stringify(s,null,2));snapshots.push({file,...stateSummary()});console.log(`[traffic] ${name} stuck-leaver snapshot at ${s.time}s`);
  }
  if((tick+1)%240===0){
   const summary=stateSummary();windows.push({...summary,arrivals:arrivals-windowStart.arrivals,exits:exits-windowStart.exits,sales:s.stats.sold-windowStart.sold,servings:s.stats.served-windowStart.served});
   windowStart={time:s.time,arrivals,exits,sold:s.stats.sold,served:s.stats.served};
   if((tick+1)%1200===0)console.log(`[traffic] ${name} ${s.time}/${seconds}s customers=${s.customers.length} leaving=${summary.phases.leaving||0} sold=${s.stats.sold} exited=${exits}`);
  }
 }
 maxArrivalGap=Math.max(maxArrivalGap,s.time-lastArrivalAt);maxExitGap=Math.max(maxExitGap,s.time-lastExitAt);maxPaymentGap=Math.max(maxPaymentGap,s.time-lastPaymentAt);
 const furnitureOnly={...s,customers:[],waiters:[]};
 const remaining=s.customers.map(c=>{
  const g=guests.get(c.uid);return{...g,residenceSeconds:s.time-g.spawnAt,leavingSeconds:null,snapshot:{phase:c.phase,x:c.x,y:c.y,seat:c.seat,path:c.path,wait:c.wait},furnitureExitPath:E.path(furnitureOnly,c,[0,s.size-1])!==null,occupiedSeatsExitPath:E.path(s,c,[0,s.size-1])!==null,allActorsExitPath:E.path(s,c,[0,s.size-1],{avoidActors:true})!==null};
 });
 for(const c of remaining)c.leavingSeconds=c.leavingAt===undefined?null:s.time-c.leavingAt;
 const tail=windows.slice(-5),tailProgress={arrivals:tail.reduce((n,w)=>n+w.arrivals,0),exits:tail.reduce((n,w)=>n+w.exits,0),sales:tail.reduce((n,w)=>n+w.sales,0)};
 const result={name,seatCount:count,workers:8,size:s.size,seconds,clutter,seed,engineHash,wallSeconds:(performance.now()-started)/1000,arrivals,exits,sold:s.stats.sold,served:s.stats.served,maxCustomers,maxLeaving,maxLeaveSeconds,maxResidenceSeconds,maxArrivalGap,maxExitGap,maxPaymentGap,lastArrivalAt,lastExitAt,lastPaymentAt,tailProgress,overlapSamples,collisions,windows,snapshots,remaining,guestTypes:[...new Set([...guests.values()].map(g=>g.zombieId))],foodStocks:s.objects.filter(o=>o.type==='server').map(o=>({uid:o.uid,foodId:o.foodId,stock:o.stock})),final:stateSummary()};
 result.findings=[];
 result.collisionPolicy='Only pairs of mobile guests may pass through each other; workers and waiting/eating guests remain solid';result.allowedGuestCrossings=allowedGuestCrossings;
 if(typeof E.__traffic==='function')result.debugTraffic=[...s.customers,...s.waiters].map(a=>({uid:a.uid,phase:a.phase||'worker',x:a.x,y:a.y,path:a.path,task:a.task,traffic:E.__traffic(a)}));
 if(maxLeaveSeconds>120)result.findings.push('Some leaving guest waits over 120 game seconds');
 if(!tailProgress.arrivals||!tailProgress.exits||!tailProgress.sales)result.findings.push('Arrival/exit/payment flow stops in the final five minutes');
 if(overlapSamples)result.findings.push('Worker or seated guest positions overlap');
 if(remaining.some(c=>c.snapshot.phase==='leaving'&&!c.furnitureExitPath))result.findings.push('A leaving guest has no furniture-only exit route');
 await fs.writeFile(`${output}/${name}-final.json`,JSON.stringify(s,null,2));
 await fs.writeFile(`${output}/${name}-guests.json`,JSON.stringify([...guests.values()],null,2));
 await fs.writeFile(`${output}/${name}-results.json`,JSON.stringify(result,null,2));
 console.log(JSON.stringify({name,seconds,wallSeconds:result.wallSeconds,arrivals,exits,sold:result.sold,maxCustomers,maxLeaving,maxLeaveSeconds,tailProgress,overlapSamples,findings:result.findings}));
 return result;
}

const results=[];
for(const count of seatCounts){results.push(await run(count));await fs.writeFile(`${output}/results.json`,JSON.stringify({engineDir,engineHash,seconds,results},null,2));}
if(results.some(r=>r.findings.length))process.exitCode=1;
