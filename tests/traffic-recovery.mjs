import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';

// Reload genuinely congested saves produced by traffic-soak.mjs, then observe
// each original guest. A successful fresh game alone cannot prove recovery.
const engineDir=path.resolve(process.env.ENGINE_DIR||'src');
const E=await import(pathToFileURL(path.join(engineDir,'engine.js')).href);
const engineHash=createHash('sha256').update(await fs.readFile(path.join(engineDir,'engine.js'))).digest('hex');
const seconds=Number(process.env.RECOVERY_SECONDS||3600);
const output=process.env.RECOVERY_OUTPUT||'artifacts/traffic-recovery';
const files=process.argv.slice(2);
if(!files.length)for(const name of ['8-seats','12-seats','4-seats-clutter','8-seats-clutter','12-seats-clutter','12-seats-clutter-fractional-idle'])files.push(`tests/fixtures/traffic/${name}-final.json`);
await fs.mkdir(output,{recursive:true});
const results=[];
for(const file of files){
 const raw=JSON.parse(await fs.readFile(file,'utf8')),s=E.validateSave(raw),start=s.time,sold=s.stats.sold;
 const originals=new Map(s.customers.map(c=>[c.uid,{uid:c.uid,phase:c.phase,position:{x:c.x,y:c.y}}]));
 const leavers=new Map(s.customers.filter(c=>c.phase==='leaving').map(c=>[c.uid,{uid:c.uid,observedLeavingAt:start,original:true}]));let maxLeavingSeconds=0;
 const windows=[];let previousIds=new Set(s.customers.map(c=>c.uid)),arrivals=0,exits=0,overlapSamples=0,allowedGuestCrossings=0,maxCustomers=s.customers.length;
 let windowStart={arrivals:0,exits:0,sold:s.stats.sold};
 for(let tick=0;tick<seconds*4;tick++){
  E.advance(s,.25);const ids=new Set(s.customers.map(c=>c.uid));
  for(const c of s.customers)if(c.phase==='leaving'){if(!leavers.has(c.uid))leavers.set(c.uid,{uid:c.uid,observedLeavingAt:s.time,original:originals.has(c.uid)});maxLeavingSeconds=Math.max(maxLeavingSeconds,s.time-leavers.get(c.uid).observedLeavingAt);}
  for(const uid of ids)if(!previousIds.has(uid))arrivals++;
  for(const uid of previousIds)if(!ids.has(uid)){exits++;const old=originals.get(uid);if(old)old.exitedAfter=s.time-start;const leaver=leavers.get(uid);if(leaver){leaver.exitedAfter=s.time-start;leaver.leavingSeconds=s.time-leaver.observedLeavingAt;maxLeavingSeconds=Math.max(maxLeavingSeconds,leaver.leavingSeconds);}}
  previousIds=ids;maxCustomers=Math.max(maxCustomers,s.customers.length);
  const mobileGuests=new Set(s.customers.filter(c=>['queue','seating','leaving','chasing'].includes(c.phase))),positions=new Map();for(const a of [...s.waiters,...s.customers]){const k=`${a.x.toFixed(6)},${a.y.toFixed(6)}`,previous=positions.get(k)||[];for(const b of previous){if(mobileGuests.has(a)&&mobileGuests.has(b))allowedGuestCrossings++;else overlapSamples++;}previous.push(a);positions.set(k,previous);}
  if((tick+1)%240===0){windows.push({time:s.time-start,arrivals:arrivals-windowStart.arrivals,exits:exits-windowStart.exits,sales:s.stats.sold-windowStart.sold,customers:s.customers.length,remainingOriginals:[...originals.values()].filter(g=>g.exitedAfter===undefined).map(g=>g.uid)});windowStart={arrivals,exits,sold:s.stats.sold};}
 }
 const remainingOriginals=[...originals.values()].filter(g=>g.exitedAfter===undefined),tail=windows.slice(-5),findings=[];
 if(remainingOriginals.length)findings.push('Original congested guests remain after recovery interval');
 if(maxLeavingSeconds>120)findings.push('A guest waits over 120 seconds to leave during recovery');
 if(!tail.some(w=>w.arrivals)||!tail.some(w=>w.exits))findings.push('Arrival or exit flow stops in final five minutes');
 if(!tail.some(w=>w.sales))findings.push('No payment progress in final five minutes');
 if(overlapSamples)findings.push('Worker or seated guest positions overlap');
 const result={file,engineHash,seconds,originalCustomers:originals.size,originalLeaving:[...originals.values()].filter(g=>g.phase==='leaving').length,originals:[...originals.values()],remainingOriginals,allOriginalsExitedAfter:remainingOriginals.length?null:Math.max(...[...originals.values()].map(g=>g.exitedAfter)),arrivals,exits,sales:s.stats.sold-sold,maxCustomers,maxLeavingSeconds,leavers:[...leavers.values()],overlapSamples,windows,findings};
 result.collisionPolicy='Only pairs of mobile guests may pass through each other; workers and waiting/eating guests remain solid';result.allowedGuestCrossings=allowedGuestCrossings;
 results.push(result);console.log(JSON.stringify({...result,originals:undefined,leavers:undefined,windows:undefined}));
 await fs.writeFile(`${output}/${path.basename(path.dirname(file))}-${path.basename(file)}`,JSON.stringify(s,null,2));
 await fs.writeFile(`${output}/results.json`,JSON.stringify({engineDir,engineHash,results},null,2));
}
if(results.some(r=>r.findings.length))process.exitCode=1;
