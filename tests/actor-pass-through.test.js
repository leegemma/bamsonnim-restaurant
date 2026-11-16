import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../src/engine.js';

function workerCorridor(){
 const s=E.newGame();s.spawnIn=1e9;s.objects=[];for(let x=0;x<8;x++)for(let y=0;y<8;y++)if(y!==3)s.objects.push({uid:`wall-${x}-${y}`,type:'jars',x,y,dir:0});
 s.objects.push({uid:'left-chair',type:'chair',x:0,y:3,dir:0,dirty:true},{uid:'right-chair',type:'chair',x:7,y:3,dir:2,dirty:true});
 const w=s.waiters[0];s.waiters=[{...w,x:1.3,y:3,path:[[2,3],[3,3],[4,3],[5,3],[6,3]],task:{kind:'clean',chair:'right-chair',work:0}},{...w,uid:'other-worker',name:'다른 직원',appearance:1,x:6.5,y:3,path:[[6,3],[5,3],[4,3],[3,3],[2,3],[1,3]],task:{kind:'clean',chair:'left-chair',work:0}}];s.objects.find(o=>o.uid==='left-chair').cleaner='other-worker';s.objects.find(o=>o.uid==='right-chair').cleaner=w.uid;return s;
}

test('workers cross head-on in a one-tile corridor without waiting or yielding',()=>{
 const s=workerCorridor();let crossed=false;for(let i=0;i<16;i++){
  const before=s.waiters.map(w=>({x:w.x,y:w.y}));E.advance(s,.25);if(Math.hypot(s.waiters[0].x-s.waiters[1].x,s.waiters[0].y-s.waiters[1].y)<1e-6)crossed=true;
  for(let n=0;n<2;n++)if(s.waiters[n].path.length)assert.ok(Math.hypot(s.waiters[n].x-before[n].x,s.waiters[n].y-before[n].y)>.64,'another worker never pauses a step');
 }assert.ok(crossed,'the two workers share a coordinate while passing');assert.equal(s.objects.some(o=>o.type==='chair'&&o.dirty),false);
});

test('a worker and a departing guest cross continuously without a collision response',()=>{
 const s=E.newGame();s.spawnIn=1e9;s.objects=[];for(let x=0;x<8;x++)for(let y=0;y<7;y++)if(x!==7||y!==6)s.objects.push({uid:`wall-${x}-${y}`,type:'jars',x,y,dir:0});s.objects.push({uid:'end-chair',type:'chair',x:7,y:7,dir:3,dirty:true},{uid:'end-table',type:'table',x:7,y:6,dir:0});
 Object.assign(s.waiters[0],{x:1.3,y:7,path:[[2,7],[3,7],[4,7],[5,7],[6,7]],task:{kind:'clean',chair:'end-chair',work:0}});const c={uid:'passing-guest',zombieId:'wanderer',x:6.55,y:7,phase:'leaving',wait:0,path:[[6,7],[5,7],[4,7],[3,7],[2,7],[1,7],[0,7]],seat:null};s.customers=[c];let crossed=false;
 for(let i=0;i<8;i++){const before={x:c.x,y:c.y};E.advance(s,.25);assert.ok(Math.hypot(c.x-before.x,c.y-before.y)>.39);assert.ok(Math.hypot(c.x-before.x,c.y-before.y)<=.4+1e-6);if(Math.hypot(c.x-s.waiters[0].x,c.y-s.waiters[0].y)<1e-6)crossed=true;}assert.ok(crossed);
});

test('empty and occupied chairs block intermediate paths while an explicit blocked destination remains reachable',()=>{
 const s=E.newGame();s.spawnIn=1e9;s.objects=[{uid:'solid-chair',type:'chair',x:3,y:3,dir:3},{uid:'solid-table',type:'table',x:3,y:2,dir:0}];const from={x:0,y:3};
 const crossing=E.path(s,from,[7,3]);assert.ok(crossing);assert.ok(!crossing.some(([x,y])=>x===3&&y===3));assert.deepEqual(E.path(s,from,[3,3]).at(-1),[3,3]);assert.equal(E.path(s,from,[3,3],{allowBlockedTarget:false}),null);
 s.customers=[{uid:'solid-sitter',zombieId:'wanderer',x:3,y:3,phase:'waiting',wait:0,path:[],seat:'solid-chair'}];assert.deepEqual(E.path(s,from,[7,3]),crossing);assert.deepEqual(E.path(s,from,[3,2]).at(-1),[3,2]);
});

test('two workers may use the same service access tile and reload without separation',()=>{
 const s=E.newGame();s.spawnIn=1e9;const w=s.waiters[0];s.waiters.push({...w,uid:'shared-worker',name:'두 번째 직원',appearance:1,path:[],task:null});Object.assign(s.objects.find(o=>o.type==='server'),{foodId:'rice',stock:20});for(const [i,[x,y]]of [[5,1],[4,0],[4,2]].entries())s.objects.push({uid:`access-wall-${i}`,type:'jars',x,y,dir:0});
 const chairs=s.objects.filter(o=>o.type==='chair');s.customers=chairs.slice(0,2).map((chair,i)=>({uid:`waiting-${i}`,zombieId:'wanderer',x:chair.x,y:chair.y,phase:'waiting',wait:0,path:[],seat:chair.uid}));
 const loaded=E.validateSave(s);assert.deepEqual(loaded.waiters.map(w=>[w.x,w.y]),[[3,3],[3,3]]);for(let i=0;i<5;i++)E.advance(loaded,.25);assert.ok(loaded.waiters.every(w=>w.x===3&&w.y===1));assert.equal(new Set(loaded.waiters.map(w=>w.task.customer)).size,2);assert.ok(loaded.waiters.every(w=>w.task.phase==='pickup'));
});

test('a worker standing at a furniture-free entrance does not block a new guest',()=>{
 const s=E.newGame();s.spawnIn=0;Object.assign(s.objects.find(o=>o.type==='server'),{foodId:'rice',stock:20});Object.assign(s.waiters[0],{x:0,y:7});E.advance(s,.25);const c=s.customers.find(c=>c.enteredAt===s.time);assert.ok(c);assert.equal(E.trafficStatus(s).entryBlocked,false);assert.deepEqual([s.waiters[0].x,s.waiters[0].y],[0,7]);assert.deepEqual([c.x,c.y],[0,7]);
});

test('an unreachable old seat reservation is released while the guest walks back out from its current floor',()=>{
 const raw=E.newGame();raw.spawnIn=1e9;raw.objects=[{uid:'isolated-chair',type:'chair',x:4,y:4,dir:0},{uid:'isolated-table',type:'table',x:5,y:4,dir:0},...[ [3,4],[4,3],[4,5] ].map(([x,y],i)=>({uid:`sealed-seat-${i}`,type:'jars',x,y,dir:0}))];raw.customers=[{uid:'old-unreachable-reservation',zombieId:'wanderer',x:0,y:7,phase:'seating',wait:0,path:[],seat:'isolated-chair'}];
 const s=E.validateSave(raw);assert.equal(s.customers[0].phase,'leaving');assert.equal(s.customers[0].seat,null);assert.deepEqual([s.customers[0].x,s.customers[0].y],[0,7]);E.advance(s,.25);assert.equal(s.customers.length,0);assert.equal(raw.customers[0].phase,'seating');
});

test('a decorative chair may be placed unless it seals the last free-floor approach to a counter',()=>{
 const s=E.newGame();s.spawnIn=1e9;s.objects=[];for(let x=0;x<8;x++)for(let y=0;y<7;y++)s.objects.push({uid:`placement-wall-${x}-${y}`,type:'jars',x,y,dir:0});const counter=s.objects.find(o=>o.x===4&&o.y===6);counter.type='server';Object.assign(s.waiters[0],{x:0,y:7});const coins=s.coins;
 assert.match(E.place(s,{type:'chair',x:3,y:7,dir:0}),/직원.*통로/);assert.equal(s.coins,coins);counter.type='jars';assert.equal(E.place(s,{type:'chair',x:3,y:7,dir:0}),null);assert.equal(E.seats(s).length,0);
});

test('legacy routes back away from a newly solid chair instead of crossing its center',()=>{
 const s=E.newGame();s.spawnIn=1e9;s.objects=[];for(let x=0;x<8;x++)for(let y=0;y<7;y++)s.objects.push({uid:`old-wall-${x}-${y}`,type:'jars',x,y,dir:0});s.objects.push({uid:'old-route-chair',type:'chair',x:2,y:7,dir:3});
 const c={uid:'old-crossing-guest',zombieId:'wanderer',x:2.6,y:7,phase:'leaving',wait:0,path:[[2,7],[1,7],[0,7]],seat:null};s.customers=[c];Object.assign(s.waiters[0],{x:1.6,y:7,path:[[2,7],[3,7]],task:null});
 E.advance(s,.25);assert.ok(Math.abs(c.x-3)<1e-6,'the departing guest walks back to its own side');assert.ok(s.waiters[0].x<=1.6,'the worker backs away on its original side');
 for(let i=0;i<40;i++)E.advance(s,.25);assert.ok(s.customers.includes(c));assert.equal(c.x,3);assert.ok(s.waiters[0].x<2);assert.equal(E.trafficStatus(s).exitBlocked,true);
});

test('isolated decorative chairs are legal and an old blocked layout can be repaired incrementally',()=>{
 const s=E.newGame();s.level=30;s.coins=1e9;s.spawnIn=1e9;s.objects=[{uid:'decor-wall-a',type:'jars',x:6,y:0,dir:0},{uid:'decor-wall-b',type:'jars',x:7,y:1,dir:0}];assert.equal(E.place(s,{type:'chair',x:7,y:0,dir:3}),null);assert.equal(E.seats(s).length,0);assert.equal(E.place(s,{type:'jars',x:1,y:1}),null);
 const old=E.newGame();old.level=30;old.coins=1e9;old.spawnIn=1e9;old.objects=[{uid:'blocked-chair',type:'chair',x:4,y:4,dir:0},{uid:'blocked-table',type:'table',x:5,y:4,dir:0},...[[3,4],[4,3],[4,5]].map(([x,y],i)=>({uid:`blocked-wall-${i}`,type:'jars',x,y,dir:0}))];assert.match(E.chairSeatProblem(old,'blocked-chair'),/통로/);assert.equal(E.place(old,{type:'jars',x:7,y:0}),null);assert.equal(E.removeFurniture(old,'blocked-wall-0'),null);assert.equal(E.chairSeatProblem(old,'blocked-chair'),null);
});
