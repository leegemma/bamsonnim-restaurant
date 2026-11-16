import {test} from 'node:test';
import assert from 'node:assert/strict';
import {eatingAnimationFrame,eatingSpriteFrame} from '../src/eating.js';

test('eating uses three drawings at five fps, while all other phases and reduced motion stay neutral',()=>{
 const actor={phase:'eating',enteredAt:10};
 assert.deepEqual([0,.2,.4,.6,.8,1].map(t=>eatingAnimationFrame(actor,10+t)),[0,1,2,0,1,2]);
 for(const phase of ['queue','seating','waiting','leaving','chasing'])assert.equal(eatingAnimationFrame({...actor,phase},10.4),0);
 assert.equal(eatingAnimationFrame(actor,10.4,{reducedMotion:true}),0);
 assert.equal(eatingAnimationFrame(actor,NaN),0);
});

test('the visit clock survives a save copy and a fixed simulation time holds the current eating pose',()=>{
 const actor={uid:'guest',phase:'eating',enteredAt:2.25,eatUntil:18};
 const first=eatingAnimationFrame(actor,12.65);assert.equal(first,eatingAnimationFrame(JSON.parse(JSON.stringify(actor)),12.65));
 assert.equal(first,eatingAnimationFrame(actor,12.65));assert.notEqual(first,eatingAnimationFrame(actor,12.85));
});

test('each direction reuses its existing seat and selects only the two added eating images',()=>{
 const base={key:'base',walkFrames:3,frames:{sit:3}},extra={key:'eat',poses:Array.from({length:8},(_,index)=>({index,dir:Math.floor(index/2),frame:index%2+1,state:'eat'}))};
 for(let dir=0;dir<4;dir++){
  assert.deepEqual(eatingSpriteFrame(base,extra,dir,0),{key:'base',index:dir*4+3,frame:0});
  for(const frame of [1,2])assert.deepEqual(eatingSpriteFrame(base,extra,dir,frame),{key:'eat',index:dir*2+frame-1,frame});
  assert.equal(eatingSpriteFrame(base,null,dir,2).key,'base');
 }
 assert.equal(eatingSpriteFrame(base,extra,5,1),null);
});
