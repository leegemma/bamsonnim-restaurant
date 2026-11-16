import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../src/engine.js';

test('an editor placement can cover a frozen mid-step employee and safely restore them to floor',()=>{
 const s=E.newGame();s.level=30;s.coins=10000;s.spawnIn=1e9;
 s.objects=[{uid:'old-endpoint',type:'jars',x:2,y:2,dir:0}];
 const w=s.waiters[0];Object.assign(w,{x:2.5,y:2,path:[[3,2]],infectedUntil:300});const identity={uid:w.uid,name:w.name,appearance:w.appearance,infectedUntil:w.infectedUntil};
 assert.equal(E.placementProblem(s,'jars',3,2),'직원이 걷는 칸 옆에 빈 공간을 남겨주세요.');
 assert.equal(E.placementProblem(s,'jars',3,2,0,null,{ignoreStaff:true}),null);
 assert.equal(E.place(s,{type:'jars',x:3,y:2,editing:true}),null);
 assert.equal(s.waiters[0],w);assert.deepEqual({uid:w.uid,name:w.name,appearance:w.appearance,infectedUntil:w.infectedUntil},identity);
 assert.ok(Number.isInteger(w.x)&&Number.isInteger(w.y));assert.ok(!s.objects.some(o=>o.x===w.x&&o.y===w.y));
 E.advance(s,2);assert.ok(!s.objects.some(o=>o.x===w.x&&o.y===w.y));
});

test('hiding staff in the editor does not disable doorway and furniture overlap safeguards',()=>{
 const s=E.newGame();s.level=30;s.coins=10000;
 assert.equal(E.place(s,{type:'jars',x:0,y:7,editing:true}),'출입구는 비워주세요.');
 assert.equal(E.place(s,{type:'jars',x:1,y:1,editing:true}),'다른 가구와 겹쳐요.');
 const w=s.waiters[0];assert.equal(E.place(s,{type:'jars',x:w.x,y:w.y,editing:true}),null);assert.ok(!s.objects.some(o=>o.x===w.x&&o.y===w.y));
});
