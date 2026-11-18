import {test} from 'node:test';import assert from 'node:assert/strict';import * as E from '../src/engine.js';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
test('heart upgrades charge the displayed cost once, cap at five and preserve other employees',()=>{
 const s=E.newGame();E.hire(s);s.hearts=100;const [w,other]=s.waiters,otherBefore=structuredClone(other),coins=s.coins;
 for(const kind of ['speed','kindness'])for(const cost of [2,4,6,8,10]){assert.equal(E.staffUpgradeCost(w,kind),cost);const before=s.hearts;assert.equal(E.upgradeStaff(s,w.uid,kind),null);assert.equal(s.hearts,before-cost);}
 assert.equal(s.hearts,40);assert.equal(w.speedLevel,5);assert.equal(w.kindnessLevel,5);assert.ok(E.upgradeStaff(s,w.uid,'speed'));assert.equal(s.hearts,40);assert.equal(s.coins,coins);assert.deepEqual(other,otherBefore);assert.equal(E.staffSpeedMultiplier(w),1.5);assert.equal(E.staffTipChance(w),.5);
});
test('invalid or unaffordable upgrades never spend hearts or change a level',()=>{
 const s=E.newGame(),w=s.waiters[0];s.hearts=1;const before=structuredClone(w);assert.ok(E.upgradeStaff(s,w.uid,'speed'));assert.ok(E.upgradeStaff(s,'missing','kindness'));assert.ok(E.upgradeStaff(s,w.uid,'invalid'));assert.deepEqual(w,before);assert.equal(s.hearts,1);
});
test('speed upgrades increase actual movement while retaining infection slowdown',()=>{
 for(const infected of [false,true])for(const level of [0,5]){const s=E.newGame(),w=s.waiters[0];s.spawnIn=1e9;Object.assign(w,{x:3,y:3,path:[[3,4],[3,5]],task:null,speedLevel:level,infectedUntil:infected?300:0});E.advance(s,.25);near(w.y-3,(infected?1.5:2.6)*(1+level*.1)*.25);}
});
test('speed upgrades shorten real cleaning work without removing the infection penalty',()=>{
 for(const [infected,level,expected] of [[false,0,1.25],[false,5,1],[true,0,1.75],[true,5,1.25]]){const s=E.newGame(),w=s.waiters[0],chair=s.objects.find(o=>o.type==='chair');s.spawnIn=1e9;chair.dirty=true;chair.cleaner=w.uid;Object.assign(w,{x:chair.x+1,y:chair.y,path:[],speedLevel:level,infectedUntil:infected?300:0,task:{kind:'clean',chair:chair.uid,work:0}});let t=0;while(chair.dirty&&t<5){E.advance(s,.25);t+=.25;}assert.equal(t,expected);}
});
function tipGame(seed,level=5){const s=E.newGame(),w=s.waiters[0],chair=s.objects.find(o=>o.type==='chair'),server=s.objects.find(o=>o.type==='server');s.spawnIn=1e9;Object.assign(server,{foodId:'rice',stock:19});const c={uid:'tip-customer',zombieId:'wanderer',x:chair.x,y:chair.y,path:[],phase:'waiting',wait:0,seat:chair.uid,worker:w.uid};s.customers=[c];Object.assign(w,{x:chair.x+1,y:chair.y,path:[],kindnessLevel:level,task:{kind:'serve',customer:c.uid,server:server.uid,foodId:'rice',portion:1,phase:'deliver',picked:true,work:0}});E.advance(s,.75);assert.equal(c.phase,'eating');s.seed=seed;return{s,w,c};}
test('friendliness is attached to the served meal and a real payment credits the tip exactly once',()=>{
 const {s,c}=tipGame(1);assert.equal(c.tipChance,.5);const before=s.coins;E.advance(s,6.25);assert.equal(s.stats.sold,1);assert.equal(s.coins,before+2);assert.equal(s.stats.earned,2);assert.equal(s.stats.tips,1);const payment=s.notifications.find(n=>n.type==='payment');assert.equal(payment.amount,2);assert.equal(payment.tip,1);E.advance(s,2);assert.equal(s.stats.tips,1);
});
test('tip chance can miss and unupgraded meals never roll an extra random number',()=>{
 const {s}=tipGame(2147483648);const before=s.coins;E.advance(s,6.25);assert.equal(s.coins,before+1);assert.equal(s.stats.tips||0,0);
 const plain=tipGame(12345,0);assert.equal(plain.c.tipChance,undefined);E.advance(plain.s,6.25);assert.equal(plain.s.seed,12345);assert.equal(plain.s.stats.tips||0,0);
});
test('old saves gain safe zero levels and valid upgrades survive a round trip',()=>{
 const s=E.newGame();s.hearts=100;E.upgradeStaff(s,s.waiters[0].uid,'speed');E.upgradeStaff(s,s.waiters[0].uid,'kindness');assert.deepEqual(E.validateSave(s),s);
 const old=structuredClone(s);delete old.waiters[0].speedLevel;delete old.waiters[0].kindnessLevel;const loaded=E.validateSave(old);assert.equal(loaded.waiters[0].speedLevel,0);assert.equal(loaded.waiters[0].kindnessLevel,0);assert.equal(old.waiters[0].speedLevel,undefined);
 for(const level of [-1,6,1.5,'1',null]){const bad=structuredClone(s);bad.waiters[0].speedLevel=level;assert.throws(()=>E.validateSave(bad),/강화/);}
});
test('new visitor graphics are announced on first online appearance, independently from album collection',()=>{
 const s=E.newGame();Object.assign(s.objects.find(o=>o.type==='server'),{foodId:'rice',stock:100});s.spawnIn=0;E.advance(s,.25);const c=s.customers[0];assert.ok(s.seenVisitors.includes(c.zombieId));assert.equal(s.album[c.zombieId],undefined);assert.equal(s.notifications.filter(n=>n.type==='new-guest').length,1);s.spawnIn=0;E.advance(s,.25);assert.equal(s.notifications.filter(n=>n.type==='new-guest').length,1);assert.deepEqual(E.validateSave(s).seenVisitors,s.seenVisitors);
});
test('offline simulation does not consume the first visual visitor announcement',()=>{
 const s=E.newGame();Object.assign(s.objects.find(o=>o.type==='server'),{foodId:'rice',stock:100});s.spawnIn=0;E.advance(s,.25,{offline:true});assert.equal(s.notifications.some(n=>n.type==='new-guest'),false);assert.equal(s.seenVisitors.length,0);E.advance(s,.25);assert.equal(s.notifications.filter(n=>n.type==='new-guest').length,1);
});
