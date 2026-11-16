import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../src/engine.js';

const server=s=>s.objects.find(o=>o.type==='server');
function safeStep(s){
 const before=s.waiters.map(w=>({x:w.x,y:w.y}));E.advance(s,.25);
 const claims=s.customers.filter(c=>c.seat).map(c=>c.seat);assert.equal(new Set(claims).size,claims.length,'seat reservations stay exclusive');
 for(let i=0;i<s.waiters.length;i++){const w=s.waiters[i];assert.ok(Math.hypot(w.x-before[i].x,w.y-before[i].y)<=.65+1e-6,'a worker walks instead of teleporting');assert.ok(!(Math.abs(w.x-Math.round(w.x))>1e-6&&Math.abs(w.y-Math.round(w.y))>1e-6),'turns occur at tile centers');}
}
function idleGame(){const s=E.newGame();s.spawnIn=1e9;Object.assign(s.waiters[0],{x:7,y:6,path:[],task:null});return s;}
function firstParkingStep(s){for(let i=0;i<40;i++){safeStep(s);if(s.waiters[0].path.length&&(!Number.isInteger(s.waiters[0].x)||!Number.isInteger(s.waiters[0].y)))return;}assert.fail('an idle worker starts walking to a nearby counter');}

test('idle staff wait briefly, then walk to a legal counter-side floor position',()=>{
 const s=idleGame(),w=s.waiters[0],start={x:w.x,y:w.y};for(let i=0;i<4;i++)safeStep(s);assert.deepEqual({x:w.x,y:w.y},start,'idle delay preserves a short pause');
 firstParkingStep(s);for(let i=0;i<80;i++)safeStep(s);
 assert.ok(Math.abs(w.x-server(s).x)+Math.abs(w.y-server(s).y)<=3);assert.equal(w.task,null);assert.equal(w.path.length,0);
 assert.ok(!s.objects.some(o=>o.x===w.x&&o.y===w.y),'all furniture and empty chairs remain clear');assert.ok(w.x+Math.abs(w.y-(s.size-1))>2,'doorway stays clear');
});

test('several idle workers choose distinct reserved destinations and leave seat approaches open',()=>{
 const s=E.newGame();s.spawnIn=1e9;s.level=30;s.coins=1e6;while(s.waiters.length<8)assert.equal(E.hire(s),null);for(const [i,w] of s.waiters.entries())Object.assign(w,{x:i,y:7,path:[],task:null});const starts=new Map(s.waiters.map(w=>[w.uid,[w.x,w.y]]));
 for(let i=0;i<160;i++)safeStep(s);
 const moved=s.waiters.filter(w=>Math.hypot(w.x-starts.get(w.uid)[0],w.y-starts.get(w.uid)[1])>1e-6);assert.ok(moved.length>=3,'available resting places attract staff');
 for(const w of moved){assert.equal(w.task,null);assert.ok(Math.abs(w.x-server(s).x)+Math.abs(w.y-server(s).y)<=3);assert.ok(!s.objects.some(o=>o.x===w.x&&o.y===w.y));assert.ok(s.objects.filter(o=>o.type==='chair').every(ch=>Math.abs(ch.x-w.x)+Math.abs(ch.y-w.y)>1));}
 assert.equal(new Set(s.waiters.map(w=>`${w.x},${w.y}`)).size,8);
});

for(const kind of ['serve','clean'])test(`new ${kind} work interrupts a parking walk at a safe segment endpoint`,()=>{
 const s=idleGame(),w=s.waiters[0];firstParkingStep(s);
 if(kind==='serve'){Object.assign(server(s),{foodId:'rice',stock:20});const chair=s.objects.find(o=>o.type==='chair');s.customers.push({uid:'waiting-work',zombieId:'wanderer',x:chair.x,y:chair.y,phase:'waiting',wait:0,path:[],seat:chair.uid});}
 if(kind==='clean')s.objects.find(o=>o.type==='chair').dirty=true;
 safeStep(s);assert.equal(w.task?.kind,kind,'real work starts on the next tick');for(let i=0;i<20;i++)safeStep(s);
});

test('a saved taskless parking walk remains interruptible without adding new save fields',()=>{
 const original=idleGame();firstParkingStep(original);const s=E.validateSave(structuredClone(original)),w=s.waiters[0],chair=s.objects.find(o=>o.type==='chair');Object.assign(server(s),{foodId:'rice',stock:20});s.customers.push({uid:'work-after-reload',zombieId:'wanderer',x:chair.x,y:chair.y,phase:'waiting',wait:0,path:[],seat:chair.uid});
 safeStep(s);assert.equal(w.task?.kind,'serve');assert.ok(!Object.hasOwn(w,'parking'));for(let i=0;i<16;i++)safeStep(s);
});

test('a counter with only narrow entrance and seating routes does not attract an idle worker',()=>{
 const s=E.newGame();s.spawnIn=1e9;s.objects=[];for(let x=0;x<8;x++)for(let y=0;y<7;y++)s.objects.push({uid:`wall-${x}-${y}`,type:'jars',x,y,dir:0});s.objects.find(o=>o.x===4&&o.y===6).type='server';Object.assign(s.waiters[0],{x:6,y:7,path:[],task:null});
 for(let i=0;i<40;i++)safeStep(s);assert.deepEqual([s.waiters[0].x,s.waiters[0].y],[6,7]);assert.equal(s.waiters[0].path.length,0);
});

test('a departing guest crosses a head-on worker without entering the chair bay',()=>{
 const s=E.newGame();s.zombieEntrance=E.staffEntrance(s);s.spawnIn=1e9;s.objects=[];const floor=new Set(['0,7','0,6','0,5','1,5','2,5','3,5','1,4','3,4','4,4']);
 for(let x=0;x<8;x++)for(let y=0;y<8;y++)if(!floor.has(`${x},${y}`))s.objects.push({uid:`pocket-wall-${x}-${y}`,type:'jars',x,y,dir:0});
 s.objects.push({uid:'temporary-chair-bay',type:'chair',x:1,y:4,dir:0},{uid:'work-chair',type:'chair',x:3,y:4,dir:0,dirty:true},{uid:'work-table',type:'table',x:4,y:4,dir:0});
 const w=s.waiters[0];Object.assign(w,{x:0,y:5,path:[[1,5],[2,5],[3,5]],task:{kind:'clean',chair:'work-chair',work:0}});s.objects.find(o=>o.uid==='work-chair').cleaner=w.uid;
 s.customers=[{uid:'head-on-departure',zombieId:'wanderer',x:1,y:5,phase:'leaving',wait:0,path:[[0,5],[0,6],[0,7]],seat:null}];let usedBay=false;
 for(let i=0;i<100&&s.customers.length;i++){safeStep(s);if(s.customers.some(c=>c.x===1&&c.y===4))usedBay=true;}
 assert.equal(s.customers.length,0,'the paid guest eventually reaches the door');assert.equal(usedBay,false,'chairs remain furniture even when actors meet');
});

test('an available doorway admits another guest while a distant guest is leaving',()=>{
 const s=E.newGame();s.spawnIn=0;Object.assign(server(s),{foodId:'rice',stock:20});s.customers.push({uid:'far-departure',zombieId:'wanderer',x:7,y:6,phase:'leaving',wait:0,path:[],seat:null});
 safeStep(s);assert.ok(s.customers.some(c=>c.uid==='far-departure'));assert.ok(s.customers.some(c=>c.uid!=='far-departure'&&c.enteredAt===s.time),'departures do not close an otherwise available entrance');
});

test('actors at a free doorway may cross while actual furniture still blocks entry',()=>{
 for(const barrier of ['mobile','worker','seated','furniture']){
  const s=E.newGame();s.spawnIn=0;const gate=E.zombieEntrance(s);Object.assign(server(s),{foodId:'rice',stock:20});
  if(barrier==='mobile')s.customers.push({uid:'near-departure',zombieId:'wanderer',x:gate.x+.4,y:gate.y,phase:'leaving',wait:0,path:[[gate.x,gate.y]],seat:null});
  if(barrier==='worker')Object.assign(s.waiters[0],gate);
  if(barrier==='seated'){s.objects.push({uid:'door-chair',type:'chair',x:gate.x,y:gate.y,dir:0});s.customers.push({uid:'door-sitter',zombieId:'wanderer',x:gate.x,y:gate.y,phase:'waiting',wait:0,path:[],seat:'door-chair'});}
  if(barrier==='furniture')s.objects.push({uid:'door-wall',type:'jars',x:gate.x,y:gate.y,dir:0});
  safeStep(s);const newcomers=s.customers.filter(c=>c.enteredAt===s.time);assert.equal(newcomers.length,['mobile','worker'].includes(barrier)?1:0,barrier);
 }
});

test('indoor capacity continues to count every departing guest',()=>{
 const s=E.newGame();s.spawnIn=0;Object.assign(server(s),{foodId:'rice',stock:20});const capacity=E.trafficStatus(s).capacity;
 for(let i=0;i<capacity;i++)s.customers.push({uid:`full-leaver-${i}`,zombieId:'wanderer',x:7,y:1+i,phase:'leaving',wait:0,path:[],seat:null});safeStep(s);
 assert.equal(s.customers.length,capacity);assert.equal(s.customers.filter(c=>c.enteredAt===s.time).length,0);
});

test('a worker in the only exit corridor does not block admission',()=>{
 const s=E.newGame();s.zombieEntrance=E.staffEntrance(s);s.spawnIn=0;s.objects=[];const allowed=new Set(['0,5','0,6','0,7','1,5','2,5','4,1']);
 for(let x=0;x<8;x++)for(let y=0;y<8;y++)if(!allowed.has(`${x},${y}`))s.objects.push({uid:`entry-wall-${x}-${y}`,type:'jars',x,y,dir:0});
 s.objects.push({uid:'route-chair',type:'chair',x:1,y:5,dir:0},{uid:'route-table',type:'table',x:2,y:5,dir:0},{uid:'route-food',type:'server',x:4,y:1,dir:0,foodId:'rice',stock:20});Object.assign(s.waiters[0],{x:0,y:6,path:[],task:null});s.customers=[{uid:'sealed-route-leaver',zombieId:'wanderer',x:0,y:5,phase:'leaving',wait:0,path:[],seat:null}];
 assert.equal(E.trafficStatus(s).entryBlocked,false);safeStep(s);assert.equal(s.customers.some(c=>c.enteredAt===s.time),true,'the staff member is not a terrain obstacle');
});

test('clean free seats are shuffled with the saved RNG, independently of the legacy seat cursor',()=>{
 const chosen=new Set();for(let seed=1;seed<=12;seed++){
  const s=E.newGame();s.spawnIn=1e9;s.seed=seed;s.seatCursor=3;const before=s.objects.map(o=>o.uid),loaded=E.validateSave(structuredClone(s));
  for(const game of [s,loaded])game.customers.push({uid:'shuffle-seat-guest',zombieId:'wanderer',x:0,y:7,phase:'queue',wait:0,path:[],seat:null});
  safeStep(s);safeStep(loaded);assert.equal(s.customers[0].seat,loaded.customers[0].seat);assert.equal(s.seed,loaded.seed);assert.equal(s.seatCursor,3,'legacy cursor stays readable but does not drive selection');assert.deepEqual(s.objects.map(o=>o.uid),before);chosen.add(s.customers[0].seat);
 }
 assert.ok(chosen.size>=3,'different saved seeds produce different seats rather than a fixed cursor order');
});

test('random seating still excludes dirty and already-reserved table-side chairs',()=>{
 const s=E.newGame();s.spawnIn=1e9;const chairs=s.objects.filter(o=>o.type==='chair');chairs[0].dirty=true;chairs[1].dirty=true;
 s.customers=[{uid:'reserved-seat',zombieId:'wanderer',x:0,y:6,phase:'seating',wait:0,path:[],seat:chairs[2].uid},{uid:'free-seat-guest',zombieId:'wanderer',x:0,y:7,phase:'queue',wait:0,path:[],seat:null}];safeStep(s);assert.equal(s.customers.find(c=>c.uid==='free-seat-guest').seat,chairs[3].uid);
});
