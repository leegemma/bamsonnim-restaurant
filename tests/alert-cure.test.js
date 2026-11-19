import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../src/engine.js';

function bite(s,w){
 s.spawnIn=1e9;Object.assign(w,{x:3,y:3,path:[],task:null});
 s.customers=[{uid:'biter',zombieId:'red',red:true,x:3,y:4,path:[],phase:'chasing',seat:null,wait:0,chaseTime:0,target:w.uid}];
 E.advance(s,.25);
 return s.notifications.findLast(n=>n.type==='danger');
}
test('an actual bite carries stable staff identity through a save round trip',()=>{
 const s=E.newGame(),w=s.waiters[0];w.name='같은 이름';const event=bite(s,w);
 assert.ok(w.infectedUntil>s.time);assert.equal(event.staffUid,w.uid);
 w.name='바뀐 이름';const loaded=E.validateSave(s);assert.equal(loaded.notifications.find(n=>n.id===event.id).staffUid,w.uid);
});
test('cure charges once and only removes the cured staff notification',()=>{
 const s=E.newGame(),w=s.waiters[0];bite(s,w);
 E.notify(s,'다른 직원 감염','danger',{staffUid:'another-worker'});E.notify(s,'이름만 있는 옛 알림','danger');
 const before=s.coins,price=E.cureCost(s);assert.equal(E.cure(s,w.uid),null);
 assert.equal(s.coins,before-price);assert.equal(w.infectedUntil,0);
 assert.ok(!s.notifications.some(n=>n.staffUid===w.uid));assert.equal(s.notifications.filter(n=>n.type==='danger').length,2);
 assert.ok(E.cure(s,w.uid));assert.equal(s.coins,before-price);
});
test('insufficient funds, absent staff and recovered infections never debit coins',()=>{
 const s=E.newGame(),w=s.waiters[0];bite(s,w);s.coins=E.cureCost(s)-1;const before=s.coins;
 assert.match(E.cure(s,w.uid),/부족/);assert.equal(s.coins,before);assert.ok(w.infectedUntil>s.time);
 assert.ok(E.cure(s,'missing-worker'));assert.equal(s.coins,before);
 s.time=w.infectedUntil;assert.ok(E.cure(s,w.uid));assert.equal(s.coins,before);
});
test('two infected staff with equal names are cured independently by UID',()=>{
 const s=E.newGame();s.level=30;s.coins=1e6;assert.equal(E.hire(s),null);
 for(const w of s.waiters){w.name='같은 이름';w.infectedUntil=300;E.notify(s,'동명이인 감염','danger',{staffUid:w.uid});}
 const before=s.coins,price=E.cureCost(s),[a,b]=s.waiters;
 assert.equal(E.cure(s,b.uid),null);assert.ok(a.infectedUntil>s.time);assert.equal(b.infectedUntil,0);
 assert.equal(s.coins,before-price);assert.ok(s.notifications.some(n=>n.staffUid===a.uid));
});
