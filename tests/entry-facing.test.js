import {test} from 'node:test';
import assert from 'node:assert/strict';
import {walkingPose} from '../src/walking.js';

test('a stationary door queue can face left without changing the actor or animation state',()=>{
 const actor={x:6,y:0,path:[],phase:'queue'},before=structuredClone(actor),previous={x:6,y:0,direction:0,flip:false,moving:false};
 const pose=walkingPose(actor,previous,{idleDirection:1,time:10,keys:null,frameCount:3});
 assert.equal(pose.direction,1);assert.equal(pose.frame,0);assert.equal(pose.moving,false);assert.deepEqual(actor,before);
});

test('actual walking and seated directions keep priority over the idle facing hint',()=>{
 const actor={x:6,y:0,path:[[7,0]]};
 assert.equal(walkingPose(actor,null,{idleDirection:1}).direction,0);
 assert.equal(walkingPose(actor,null,{idleDirection:1,seatedDirection:2}).direction,2);
 assert.equal(walkingPose({...actor,path:[]},{x:6,y:0,direction:3},{idleDirection:null}).direction,3);
});
