import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';

const engineDir=path.resolve(process.env.ENGINE_DIR||'src'),E=await import(pathToFileURL(path.join(engineDir,'engine.js'))),{RECIPES}=await import(pathToFileURL(path.join(engineDir,'data.js'))),seconds=Number(process.env.TRAFFIC_SECONDS||3600),output=process.env.TRAFFIC_OUTPUT||'artifacts/reference-traffic-validation';
const engineHash=createHash('sha256').update(await fs.readFile(path.join(engineDir,'engine.js'))).digest('hex');await fs.mkdir(output,{recursive:true});
const near=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y)<1e-6,integer=n=>Math.abs(n-Math.round(n))<1e-6,exit=s=>({x:0,y:s.size-1}),layout=s=>JSON.stringify(s.objects.map(o=>[o.uid,o.type,o.x,o.y,o.dir]));

function fresh(count,clutter){
 const s=E.newGame(1000);s.level=30;s.coins=1e9;s.hearts=1e6;s.seed=67291;s.mastery=Object.fromEntries(RECIPES.map(r=>[r.id,r.milestones.at(-1)]));
 const add=(type,x,y,dir=0)=>assert.equal(E.place(s,{type,x,y,dir}),null,`${count} seats: ${type}(${x},${y})`);
 if(count===4){add('server',6,1);add('server',0,3);}
 else{
  s.size=count===8?8:12;s.objects=[];Object.assign(s.waiters[0],{x:3,y:1});add('stove',1,1);add('stove',2,1);
  for(const [x,y]of count===8?[[4,1],[6,1],[0,3]]:[[4,1],[7,1],[10,1]])add('server',x,y);
  for(const [x,y]of count===8?[[2,3],[5,5]]:[[3,4],[8,4],[5,8]]){add('table',x,y);for(const [dx,dy,dir]of [[-1,0,0],[0,-1,1],[1,0,2],[0,1,3]])add('chair',x+dx,y+dy,dir);}
 }
 if(clutter){if(s.size===8){add('jars',7,3);add('bonsai',0,6);}else{add('jars',0,6);add('bonsai',10,7);}}
 while(s.waiters.length<8)assert.equal(E.hire(s),null);
 s.objects.filter(o=>o.type==='server').forEach((o,i)=>Object.assign(o,{foodId:['rice','soup','skewer'][i],stock:100000}));assert.equal(E.seats(s).length,count);return s;
}

function canExit(s,c){
 if(E.path(s,c,[0,s.size-1],{allowBlockedTarget:false})!==null)return true;
 const chair=c.phase==='seating'&&s.objects.find(o=>o.uid===c.seat);
 return !!chair&&E.path(s,c,[chair.x,chair.y])!==null&&E.path(s,chair,[0,s.size-1],{allowBlockedTarget:false})!==null;
}

function observe(s,raw,name,kind){
 const started=s.time,sold=s.stats.sold,geometry=layout(s),initial=new Map(s.customers.map(c=>[c.uid,{phase:c.phase,canExit:canExit(s,c),exitedAfter:null}])),permanentlyBlocked=new Set([...initial].filter(([,g])=>!g.canExit&&g.phase!=='queue').map(([id])=>id));
 const meals=new Map(s.customers.filter(c=>c.phase==='eating').map(c=>[c.uid,{chair:c.seat,paid:false,cleaned:false,cleanable:E.chairSeatProblem(s,s.objects.find(o=>o.uid===c.seat))===null}])),windows=[],violations=[],leftAt=new Map(),usedSeats=new Set(),foodTypes=new Set();let maxLeaving=0,maxCustomers=s.customers.length,arrivals=0,departed=0,lastIds=new Set(s.customers.map(c=>c.uid)),windowStart={arrivals:0,departed:0,sold};
 const overlaps={workerWorker:0,workerGuest:0,guestGuest:0},fail=(type,details)=>{if(violations.length<20)violations.push({type,time:s.time,...details});};
 for(let tick=0;tick<seconds*4;tick++){
  const before=new Map([...s.waiters,...s.customers].map(a=>[a.uid,{x:a.x,y:a.y,phase:a.phase,seat:a.seat}]));E.advance(s,.25);maxCustomers=Math.max(maxCustomers,s.customers.length);const ids=new Set(s.customers.map(c=>c.uid));
  for(const id of ids)if(!lastIds.has(id))arrivals++;for(const id of lastIds)if(!ids.has(id)){departed++;if(initial.has(id))initial.get(id).exitedAfter=s.time-started;const old=before.get(id);if(old&&Math.hypot(old.x,old.y-(s.size-1))>.4+1e-6)fail('guest-removed-away-from-door',{uid:id,old});}lastIds=ids;
  const claims=new Set();for(const c of s.customers){if(c.seat){if(claims.has(c.seat))fail('duplicate-seat',{uid:c.uid,seat:c.seat});claims.add(c.seat);}if(['waiting','eating'].includes(c.phase))usedSeats.add(c.seat);if(c.phase==='eating')foodTypes.add(c.foodId);
   if(c.phase==='leaving'&&!permanentlyBlocked.has(c.uid)){if(!leftAt.has(c.uid))leftAt.set(c.uid,s.time);maxLeaving=Math.max(maxLeaving,s.time-leftAt.get(c.uid));}
   const meal=meals.get(c.uid);if(meal&&c.phase==='leaving')meal.paid=true;
  }
  for(const meal of meals.values())if(meal.paid&&!s.objects.find(o=>o.uid===meal.chair)?.dirty)meal.cleaned=true;
  const actors=[...s.waiters.map(a=>({a,worker:true})),...s.customers.map(a=>({a,worker:false}))];
  for(let i=0;i<actors.length;i++){
   const {a,worker}=actors[i],old=before.get(a.uid);if(old){const distance=Math.hypot(a.x-old.x,a.y-old.y);if(distance>.65+1e-6)fail('teleport',{uid:a.uid,distance});if(!integer(a.x)&&!integer(a.y))fail('off-grid-diagonal',{uid:a.uid,x:a.x,y:a.y});
    if(distance>1e-6){let segments;if(Math.abs(a.x-old.x)<1e-6||Math.abs(a.y-old.y)<1e-6)segments=[[old,a]];else{const corner=!integer(old.x)?{x:a.x,y:old.y}:{x:old.x,y:a.y};segments=[[old,corner],[corner,a]];}
     for(const [start,end]of segments)for(const object of s.objects){const horizontal=Math.abs(start.y-end.y)<1e-6,on=horizontal?Math.abs(object.y-start.y)<1e-6&&object.x>=Math.min(start.x,end.x)-1e-6&&object.x<=Math.max(start.x,end.x)+1e-6:Math.abs(object.x-start.x)<1e-6&&object.y>=Math.min(start.y,end.y)-1e-6&&object.y<=Math.max(start.y,end.y)+1e-6;if(!on||near(object,old))continue;const ownSeat=!worker&&old.phase==='seating'&&old.seat===object.uid&&near(object,a);if(!ownSeat)fail('intermediate-furniture-crossing',{uid:a.uid,object:object.uid,start:{x:start.x,y:start.y},end:{x:end.x,y:end.y}});}
    }
   }
   for(let j=0;j<i;j++)if(near(a,actors[j].a))overlaps[worker&&actors[j].worker?'workerWorker':worker||actors[j].worker?'workerGuest':'guestGuest']++;
  }
  if((tick+1)%240===0){windows.push({seconds:s.time-started,arrivals:arrivals-windowStart.arrivals,departures:departed-windowStart.departed,sales:s.stats.sold-windowStart.sold,customers:s.customers.length});windowStart={arrivals,departed,sold:s.stats.sold};}
 }
 const tail=windows.slice(-5),originals=[...initial].map(([uid,g])=>({uid,...g})),remaining=originals.filter(g=>g.exitedAfter===null),reachableRemaining=remaining.filter(g=>g.canExit),lostBlocked=[...permanentlyBlocked].filter(id=>!s.customers.some(c=>c.uid===id)),findings=violations.length?['A movement or seat invariant failed']:[];
 if(reachableRemaining.length)findings.push('An originally reachable guest did not exit');if(lostBlocked.length)findings.push('A permanently blocked old guest disappeared');if(layout(s)!==geometry)findings.push('Furniture geometry changed');if(maxLeaving>=120)findings.push('A reachable departing guest waited 120 seconds');if([...meals.values()].some(m=>!m.paid||m.cleanable&&!m.cleaned))findings.push('A legacy eating meal did not finish or its reachable dish was not cleaned');
 if(!permanentlyBlocked.size&&(!tail.some(w=>w.arrivals)||!tail.some(w=>w.departures)||!tail.some(w=>w.sales)))findings.push('Normal business stops in the final five minutes');
 if(kind==='fresh'&&usedSeats.size!==E.seats(s).length)findings.push('Not every active chair was occupied');if(permanentlyBlocked.size&&!E.trafficStatus(s).exitBlocked)findings.push('Blocked legacy layout has no exit notice');
 const result={name,kind,engineHash,seconds,chairs:E.seats(s).length,customers:s.customers.length,sales:s.stats.sold-sold,arrivals,departed,maxCustomers,maxLeavingSeconds:maxLeaving,usedSeats:usedSeats.size,foods:[...foodTypes],actorOverlapPolicy:'All actor pairs pass through; only furniture and exclusive chair reservations block',allowedOverlaps:overlaps,intermediateFurnitureCrossings:violations.filter(v=>v.type==='intermediate-furniture-crossing').length,originalGuests:originals,reachableOriginals:originals.filter(g=>g.canExit).length,reachableOriginalsExitedWithin:Math.max(0,...originals.filter(g=>g.canExit).map(g=>g.exitedAfter||0)),preservedBlockedOriginals:permanentlyBlocked.size,legacyMeals:[...meals.values()],exitBlocked:E.trafficStatus(s).exitBlocked,windows,violations,findings};
 return{result,state:s};
}

const results=[];
for(const clutter of [false,true])for(const count of [4,8,12]){
 const name=`fresh-${count}${clutter?'-clutter':''}`,s=fresh(count,clutter),raw=structuredClone(s);await fs.writeFile(`${output}/${name}-initial.json`,JSON.stringify(raw,null,2));const {result,state}=observe(s,raw,name,'fresh');results.push(result);await fs.writeFile(`${output}/${name}-final.json`,JSON.stringify(state,null,2));console.log(JSON.stringify({name,sales:result.sales,maxLeaving:result.maxLeavingSeconds,overlaps:result.allowedOverlaps,findings:result.findings}));
}
for(const name of ['8-seats','12-seats','4-seats-clutter','8-seats-clutter','12-seats-clutter','12-seats-clutter-fractional-idle']){
 const raw=JSON.parse(await fs.readFile(`tests/fixtures/traffic/${name}-final.json`)),s=E.validateSave(raw),{result,state}=observe(s,raw,`legacy-${name}`,'legacy');results.push(result);await fs.writeFile(`${output}/legacy-${name}-final.json`,JSON.stringify(state,null,2));console.log(JSON.stringify({name:result.name,sales:result.sales,reachableOriginals:result.reachableOriginals,preservedBlocked:result.preservedBlockedOriginals,maxLeaving:result.maxLeavingSeconds,findings:result.findings}));
}
await fs.writeFile(`${output}/results.json`,JSON.stringify({engineDir,engineHash,seconds,results},null,2));if(results.some(r=>r.findings.length))process.exitCode=1;
