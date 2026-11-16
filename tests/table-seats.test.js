import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../src/engine.js';

function legacyGame(){const s=E.newGame();s.spawnIn=1e9;s.objects=s.objects.filter(o=>o.type==='stove'||o.type==='server');s.objects.push({uid:'legacy-chair',type:'chair',x:3,y:5,dir:0});return s;}
const guest=(phase,x=3,y=5)=>({uid:'legacy-guest',zombieId:'wanderer',x,y,phase,wait:0,path:[],seat:'legacy-chair'});

test('one table activates only its four inward-facing adjacent chairs',()=>{
 const s=legacyGame();s.objects=s.objects.filter(o=>o.type!=='chair');s.objects.push({uid:'center-table',type:'table',x:3,y:3,dir:0});
 for(const [dir,x,y]of [[0,2,3],[1,3,2],[2,4,3],[3,3,4]])s.objects.push({uid:`table-chair-${dir}`,type:'chair',x,y,dir});
 s.objects.push({uid:'diagonal-chair',type:'chair',x:2,y:2,dir:0},{uid:'wrong-facing-chair',type:'chair',x:6,y:6,dir:3});
 assert.equal(E.seats(s).length,4);assert.ok(E.seats(s).every(seat=>seat.table.uid==='center-table'));
 const chair=s.objects.find(o=>o.uid==='table-chair-0');chair.dir=1;assert.equal(E.seats(s).length,3);chair.dir=0;assert.equal(E.seats(s).length,4);
});

test('tableless chairs remain legal decoration and a readonly helper explains missing tables and blocked access',()=>{
 const s=E.newGame();s.objects=s.objects.filter(o=>o.type!=='table'&&o.type!=='chair');assert.equal(E.place(s,{type:'chair',x:3,y:5,dir:0}),null);const chair=s.objects.find(o=>o.type==='chair'),before=JSON.stringify(s);
 assert.match(E.chairSeatProblem(s,chair),/앞.*식탁/);assert.equal(JSON.stringify(s),before);assert.equal(E.seats(s).length,0);
 assert.equal(E.place(s,{type:'table',x:4,y:5}),null);assert.equal(E.chairSeatProblem(s,chair),null);assert.equal(E.seats(s).length,1);
 for(const [i,[x,y]]of [[2,5],[3,4],[3,6]].entries())s.objects.push({uid:`blocked-chair-${i}`,type:'jars',x,y,dir:0});assert.match(E.chairSeatProblem(s,chair),/통로/);assert.equal(E.seats(s).length,0);
});

test('removing a table disables its chairs without deleting the furniture or its saved direction',()=>{
 const s=E.newGame(),table=E.seats(s)[0].table,chairs=s.objects.filter(o=>o.type==='chair').map(o=>[o.uid,o.dir]);assert.equal(E.removeFurniture(s,table.uid),null);assert.equal(E.seats(s).length,2);assert.deepEqual(s.objects.filter(o=>o.type==='chair').map(o=>[o.uid,o.dir]),chairs);
});

for(const phase of ['seating','waiting'])test(`an old tableless ${phase} reservation exits naturally and cancels held service safely`,()=>{
 const raw=legacyGame(),w=raw.waiters[0],counter=raw.objects.find(o=>o.type==='server'),c=guest(phase,phase==='seating'?3:3,phase==='seating'?5.3:5);c.worker=w.uid;if(phase==='seating')c.path=[[3,5]];raw.customers=[c];
 Object.assign(counter,{foodId:'rice',stock:0,reservedFood:'rice'});Object.assign(w,{x:3,y:3.3,path:[[3,4]],task:{kind:'serve',phase:'deliver',customer:c.uid,server:counter.uid,foodId:'rice',portion:1,picked:true,work:0}});
 const source=JSON.stringify(raw),s=E.validateSave(raw),loaded=s.customers[0],worker=s.waiters[0];assert.equal(JSON.stringify(raw),source);assert.equal(loaded.phase,'leaving');assert.equal(loaded.seat,null);assert.equal(loaded.worker,null);assert.equal(worker.task,null);assert.deepEqual([loaded.x,loaded.y],[c.x,c.y]);assert.deepEqual([worker.x,worker.y],[w.x,w.y]);assert.equal(s.objects.find(o=>o.uid===counter.uid).stock,1);assert.equal(s.objects.find(o=>o.uid===counter.uid).reservedFood,undefined);assert.equal(s.hunger,raw.hunger);
 for(let i=0;i<120&&s.customers.length;i++){const old={x:loaded.x,y:loaded.y};E.advance(s,.25);assert.ok(Math.hypot(loaded.x-old.x,loaded.y-old.y)<=.4+1e-6);assert.ok(!(Math.abs(loaded.x-Math.round(loaded.x))>1e-6&&Math.abs(loaded.y-Math.round(loaded.y))>1e-6));}
 assert.equal(s.customers.length,0);assert.equal(s.stats.sold,0);assert.equal(s.objects.find(o=>o.uid===counter.uid).stock,1);
});

test('an already eating tableless legacy guest finishes one meal, pays once, and the chair can still be cleaned',()=>{
 const raw=legacyGame();raw.customers=[{...guest('eating'),foodId:'rice',portion:1,eatUntil:1}];const s=E.validateSave(raw);assert.equal(s.customers[0].phase,'eating');assert.equal(E.seats(s).length,0);
 E.advance(s,25);assert.equal(s.stats.sold,1);assert.equal(s.album.wanderer,1);assert.equal(s.customers.length,0);assert.equal(s.objects.find(o=>o.uid==='legacy-chair').dirty,false);assert.equal(s.notifications.filter(n=>n.type==='payment').length,1);
 const c={uid:'new-tableless-guest',zombieId:'wanderer',x:0,y:7,phase:'queue',wait:0,path:[],seat:null};s.customers.push(c);E.advance(s,.25);assert.equal(c.seat,null);assert.equal(c.phase,'queue');
});
