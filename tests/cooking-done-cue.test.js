import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../src/engine.js';
import {createCookingDoneCue} from '../src/cooking-done-cue.js';

const none={completed:0,play:false};
function game(){const s=E.newGame(1000);s.spawnIn=1e9;return s;}
function start(s,index=0){const stove=s.objects.filter(o=>o.type==='stove')[index];assert.equal(E.cook(s,stove.uid,'rice'),null);return stove;}

test('cold scans, redraws and loaded meals never replay an already completed batch',()=>{
 const s=game();start(s);E.advance(s,12);const cue=createCookingDoneCue();assert.deepEqual(cue.scan(s),none);assert.deepEqual(cue.scan(s),none);cue.sync(s);assert.deepEqual(cue.scan(s),none);
 const loaded=E.validateSave(JSON.parse(JSON.stringify(s)));assert.deepEqual(cue.scan(loaded),none);assert.deepEqual(cue.scan(loaded),none);
});

test('a running batch emits exactly one completion at its real engine deadline without changing the save',()=>{
 const s=game(),cue=createCookingDoneCue();cue.sync(s);start(s);assert.deepEqual(cue.scan(s),none);E.advance(s,11.75);assert.deepEqual(cue.scan(s),none);E.advance(s,.25);const before=JSON.stringify(s);assert.deepEqual(cue.scan(s),{completed:1,play:true});assert.equal(JSON.stringify(s),before);
 for(let i=0;i<10;i++)assert.deepEqual(cue.scan(s),none);
});

test('instant completion keeps batch identity while a new same-clock batch on the same stove can ring again',()=>{
 const s=game(),stove=start(s),first=stove.cook,cue=createCookingDoneCue();cue.sync(s);assert.equal(E.instant(s,stove.uid),null);assert.equal(stove.cook,first);assert.equal(first.readyAt,s.time);assert.deepEqual(cue.scan(s),{completed:1,play:true});assert.deepEqual(cue.scan(s),none);
 assert.equal(E.discard(s,stove.uid),null);assert.equal(E.cook(s,stove.uid,'rice'),null);assert.notEqual(stove.cook,first);assert.equal(stove.cook.started,first.started);assert.equal(stove.cook.foodId,first.foodId);assert.deepEqual(cue.scan(s),none);assert.equal(E.instant(s,stove.uid),null);assert.deepEqual(cue.scan(s),{completed:1,play:true});assert.deepEqual(cue.scan(s),none);
});

test('cooking and instantly completing between animation frames still emits one live completion',()=>{
 const s=game(),cue=createCookingDoneCue();cue.sync(s);const stove=start(s);assert.equal(E.instant(s,stove.uid),null);assert.deepEqual(cue.scan(s),{completed:1,play:true});assert.deepEqual(cue.scan(s),none);
});

test('collecting immediately after instant completion cannot swallow the same-frame completion',()=>{
 const s=game(),stove=start(s),cue=createCookingDoneCue();cue.sync(s);assert.equal(E.instant(s,stove.uid),null);assert.equal(E.collect(s,stove.uid),null);assert.deepEqual(cue.scan(s),{completed:1,play:true});assert.deepEqual(cue.scan(s),none);
});

test('simultaneous pots retain two completion events but request only one frame bell',()=>{
 const s=game();start(s,0);start(s,1);const cue=createCookingDoneCue();cue.sync(s);E.advance(s,12);assert.deepEqual(cue.scan(s),{completed:2,play:true});assert.deepEqual(cue.scan(s),none);
});

test('silent scans consume completed batches without replay when audible mode returns',()=>{
 const s=game();start(s);const cue=createCookingDoneCue();cue.sync(s);E.advance(s,12);assert.deepEqual(cue.scan(s,{audible:false}),{completed:1,play:false});assert.deepEqual(cue.scan(s,{audible:true}),none);assert.deepEqual(cue.scan(s,{audible:false}),none);
});

test('offline reconciliation synchronizes old completions while a still-cooking loaded batch remains armed',()=>{
 const s=game();start(s);const cue=createCookingDoneCue();cue.sync(s);const report=E.reconcileOffline(s,16000);assert.equal(report.done,1);cue.sync(s);assert.deepEqual(cue.scan(s),none);
 const running=game();start(running);const loaded=E.validateSave(JSON.parse(JSON.stringify(running)));assert.deepEqual(cue.scan(loaded),none);E.advance(loaded,12);assert.deepEqual(cue.scan(loaded),{completed:1,play:true});
});

test('skipped time can also be consumed silently without queuing an audible event',()=>{
 const s=game();start(s);const cue=createCookingDoneCue();cue.sync(s);E.advance(s,12,{offline:true});assert.deepEqual(cue.scan(s,{audible:false}),{completed:1,play:false});assert.deepEqual(cue.scan(s),none);
});

test('spoilage, recovery and collection do not create another completion for the same batch',()=>{
 const s=game(),stove=start(s),cue=createCookingDoneCue();cue.sync(s);E.advance(s,193);assert.equal(E.stoveStatus(s,stove),'spoiled');assert.deepEqual(cue.scan(s),none);assert.equal(E.recover(s,stove.uid),null);assert.deepEqual(cue.scan(s),none);assert.equal(E.collect(s,stove.uid),null);assert.deepEqual(cue.scan(s),none);E.advance(s,20);assert.deepEqual(cue.scan(s),none);
});

test('discarded pots are forgotten and replacement batches still complete normally',()=>{
 const s=game(),stove=start(s),cue=createCookingDoneCue();cue.sync(s);assert.equal(E.discard(s,stove.uid),null);assert.deepEqual(cue.scan(s),none);E.advance(s,12);assert.deepEqual(cue.scan(s),none);assert.equal(E.cook(s,stove.uid,'rice'),null);assert.deepEqual(cue.scan(s),none);E.advance(s,12);assert.deepEqual(cue.scan(s),{completed:1,play:true});
});
