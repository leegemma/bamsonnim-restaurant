import {test} from 'node:test';
import assert from 'node:assert/strict';
import {walkingPose} from '../src/walking.js';

const actor=()=>({x:2,y:3,path:[[3,3],[4,3]]});

test('legacy walking keeps its four named frames while an eight-frame atlas shows every step',()=>{
 const a=actor(),legacy=walkingPose(a,null,{time:0});
 assert.equal(legacy.key,'walk1');assert.equal(walkingPose(a,legacy,{time:3.1/7}).key,'walk4');
 const options={frameCount:8,fps:14,keys:null},start=walkingPose(a,null,{...options,time:0});
 const frames=Array.from({length:8},(_,i)=>walkingPose(a,start,{...options,time:(i+.1)/14}));
 assert.deepEqual(frames.map(p=>p.frame),[0,1,2,3,4,5,6,7]);assert.ok(frames.every(p=>p.key===null));
 assert.equal(walkingPose(a,start,{...options,time:8.1/14}).frame,0);
 assert.equal(walkingPose(a,legacy,{time:4.1/7}).frame,0,'both formats keep the same complete-step duration');
});

test('walking interpolates the simulation clock between fixed ticks without restarting on turns',()=>{
 const a=actor(),options={frameCount:8,fps:14,keys:null};let pose=walkingPose(a,null,{...options,time:10});
 pose=walkingPose(a,pose,{...options,time:10.16});assert.equal(pose.frame,2);assert.equal(pose.startedAt,10);
 a.path=[[2,4]];pose=walkingPose(a,pose,{...options,time:10.24});assert.equal(pose.direction,1);assert.equal(pose.frame,3);assert.equal(pose.startedAt,10);
 a.path=[[1,3]];pose=walkingPose(a,pose,{...options,time:10.31});assert.equal(pose.direction,2);assert.equal(pose.frame,4);
 a.path=[[2,2]];pose=walkingPose(a,pose,{...options,time:10.39});assert.equal(pose.direction,3);assert.equal(pose.frame,5);
 a.path=[];pose=walkingPose(a,pose,{...options,time:10.4});assert.equal(pose.direction,3);assert.equal(pose.frame,0);assert.equal(pose.key,null);
});

test('pause and reduced motion show a still pose and seated facing overrides the walking route',()=>{
 const a=actor(),options={frameCount:8,fps:14,keys:null},start=walkingPose(a,null,{...options,time:0});
 const paused=walkingPose(a,start,{...options,time:.3,active:false});assert.equal(paused.moving,false);assert.equal(paused.frame,0);
 const still=walkingPose(a,start,{...options,time:.3,reducedMotion:true});assert.equal(still.frame,0);assert.equal(still.startedAt,0);
 const resumed=walkingPose(a,still,{...options,time:.4});assert.equal(resumed.frame,5);assert.equal(resumed.startedAt,0);
 const seated=walkingPose({...a,path:[]},resumed,{...options,time:.5,seatedDirection:2});assert.equal(seated.direction,2);assert.equal(seated.frame,0);
});

test('custom walking keys determine the default frame count without changing the actor or its save',()=>{
 const a=actor(),before=JSON.stringify(a),keys=['step-a','step-b','step-c'],start=walkingPose(a,null,{time:0,keys,fps:6});
 assert.equal(walkingPose(a,start,{time:2.1/6,keys,fps:6}).key,'step-c');assert.equal(walkingPose(a,start,{time:3.1/6,keys,fps:6}).key,'step-a');assert.equal(JSON.stringify(a),before);
});

test('a three-drawing gait repeats neutral between alternating left and right steps',()=>{
 const a=actor(),options={frameCount:3,fps:7,keys:null,sequence:[0,1,0,2]},start=walkingPose(a,null,{...options,time:0});
 const frames=Array.from({length:8},(_,step)=>walkingPose(a,start,{...options,time:(step+.1)/7}).frame);
 assert.deepEqual(frames,[0,1,0,2,0,1,0,2]);assert.equal(new Set(frames).size,3);
 for(const [dir,point]of [[0,[3,3]],[1,[2,4]],[2,[1,3]],[3,[2,2]]]){a.path=[point];const pose=walkingPose(a,start,{...options,time:3.1/7});assert.equal(pose.direction,dir);assert.equal(pose.frame,2);assert.equal(pose.startedAt,0);}
 const still=walkingPose(a,start,{...options,time:3.1/7,reducedMotion:true});assert.equal(still.frame,0);assert.equal(still.key,null);
});
