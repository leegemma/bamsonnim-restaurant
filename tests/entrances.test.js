import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../src/engine.js';
import {cookingCountdown} from '../src/cooking-countdown.js';

test('cooking countdown rounds up and carries across second/minute boundaries',()=>{
 for(const [seconds,text] of [[120,'02:00'],[119,'01:59'],[60.01,'01:01'],[60,'01:00'],[59,'00:59'],[.01,'00:01'],[0,'00:00'],[-1,'00:00'],[7200,'120:00']])assert.equal(cookingCountdown(seconds),text);
});
test('ordinary and red customers enter at the guest doorway without replacing their identity',()=>{
 const seen=new Set();for(let seed=1;seed<40;seed++){
  const s=E.newGame();s.seed=seed;s.spawnIn=0;s.hunger=100;Object.assign(s.objects.find(o=>o.type==='server'),{foodId:'rice',stock:100});E.advance(s,.25);
  const c=s.customers[0];assert.ok(c);assert.deepEqual([c.x,c.y],[6,0]);assert.equal(s.zombieDoorOpenedAt,s.time);seen.add(c.red?'red':'ordinary');
 }assert.deepEqual([...seen].sort(),['ordinary','red']);
});
test('departing guests walk from the old west entrance to the right guest doorway',()=>{
 const s=E.newGame();s.spawnIn=1e9;const c={uid:'guest-exit',zombieId:'wanderer',x:0,y:7,path:[],phase:'leaving',wait:0,seat:null};s.customers=[c];
 for(let i=0;i<120&&s.customers.includes(c);i++){const before={x:c.x,y:c.y};E.advance(s,.25);assert.ok(Math.hypot(c.x-before.x,c.y-before.y)<=.4+1e-6);if(!s.customers.includes(c))assert.ok(Math.hypot(c.x-6,c.y)<1e-6);}
 assert.equal(s.customers.length,0);
});
test('both door tiles and their shared connecting corridor remain unbuildable',()=>{
 const s=E.newGame();s.level=30;s.coins=1e9;
 for(const p of [E.staffEntrance(s),E.zombieEntrance(s)])assert.match(E.place(s,{type:'jars',...p}),/출입구/);
 assert.equal(E.place(s,{type:'jars',x:5,y:0}),null);assert.match(E.place(s,{type:'jars',x:6,y:1}),/두 출입문/);
});
test('an old wall-filled save opens a guest door while preserving objects, stock and cooking',()=>{
 const raw=E.newGame();delete raw.zombieEntrance;raw.objects.push({uid:'old-counter-5',type:'server',x:5,y:1,dir:0,foodId:'rice',stock:20},{uid:'old-counter-6',type:'server',x:6,y:1,dir:0,foodId:'soup',stock:30});
 E.cook(raw,raw.objects.find(o=>o.type==='stove').uid,'rice');const before=structuredClone(raw),loaded=E.validateSave(raw),gate=E.zombieEntrance(loaded);
 assert.deepEqual(raw,before);assert.ok(E.path(loaded,E.staffEntrance(loaded),[gate.x,gate.y],{allowBlockedTarget:false}));assert.deepEqual(loaded.objects.map(({x,y,...o})=>o),raw.objects.map(({x,y,...o})=>o));
 assert.ok(loaded.objects.filter(o=>{const old=raw.objects.find(a=>a.uid===o.uid);return o.x!==old.x||o.y!==old.y;}).length<=1);
});
test('new hires enter at the wooden staff door and keep the guest door clear',()=>{
 const s=E.newGame();assert.equal(E.hire(s),null);const w=s.waiters.at(-1);assert.deepEqual([w.x,w.y],[0,7]);assert.equal(s.staffDoorOpenedAt,s.time);assert.ok(w.path.length);assert.notDeepEqual([w.x,w.y],[6,0]);
});
test('collection reaches a matching counter immediately without changing employee jobs',()=>{
 const s=E.newGame();s.spawnIn=1e9;const stove=s.objects.find(o=>o.type==='stove'),counter=s.objects.find(o=>o.type==='server');E.cook(s,stove.uid,'rice');E.advance(s,12);const employees=structuredClone(s.waiters);
 assert.equal(E.collect(s,stove.uid),null);assert.equal(counter.foodId,'rice');assert.equal(counter.stock,6);assert.equal(E.stoveStatus(s,stove),'empty');assert.deepEqual(s.waiters,employees);assert.equal(s.stats.cooked,1);assert.deepEqual(s.transfers,[]);assert.ok(E.collect(s,stove.uid));assert.equal(counter.stock,6);
});
test('collection works while employees cannot reach either pot or counter and preserves full-counter food',()=>{
 const s=E.newGame();s.spawnIn=1e9;const stove=s.objects.find(o=>o.type==='stove'),counter=s.objects.find(o=>o.type==='server');E.cook(s,stove.uid,'rice');E.advance(s,12);s.waiters[0].infectedUntil=s.time+300;
 Object.assign(counter,{foodId:'soup',stock:30});const cooked=structuredClone(stove.cook),before=s.stats.cooked;assert.match(E.collect(s,stove.uid),/서빙대/);assert.deepEqual(stove.cook,cooked);assert.equal(s.stats.cooked,before);
 counter.stock=0;for(const [i,[x,y]]of [[3,2],[2,3],[4,3],[3,4]].entries())s.objects.push({uid:`staff-wall-${i}`,type:'jars',x,y,dir:0});assert.equal(E.collect(s,stove.uid),null);assert.equal(counter.stock,6);assert.equal(counter.foodId,'rice');
});
test('a saved employee transfer is settled exactly once without resuming an employee delivery',()=>{
 const raw=E.newGame(),stove=raw.objects.find(o=>o.type==='stove'),counter=raw.objects.find(o=>o.type==='server'),w=raw.waiters[0];E.cook(raw,stove.uid,'rice');E.advance(raw,12);stove.cook.collecting=true;counter.reservedFood='rice';raw.transfers=[{uid:'legacy-transfer',stove:stove.uid,server:counter.uid,foodId:'rice',worker:w.uid}];w.task={kind:'transfer',transfer:'legacy-transfer',phase:'pickup',work:0};
 const s=E.validateSave(raw),target=s.objects.find(o=>o.uid===counter.uid);assert.equal(target.stock,6);assert.equal(s.stats.cooked,1);assert.deepEqual(s.transfers,[]);assert.equal(s.waiters[0].task,null);E.advance(s,1);assert.equal(target.stock,6);assert.equal(s.stats.cooked,1);assert.equal(raw.transfers.length,1);
});
