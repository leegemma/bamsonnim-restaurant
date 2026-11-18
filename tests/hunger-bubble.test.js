import {test} from 'node:test';
import assert from 'node:assert/strict';
import {needsHungerBubble,visibleHeadBounds,hungerBubbleGeometry} from '../src/hunger-bubble.js';

test('only customers awaiting actual delivery are hungry, regardless of counter stock or assignment',()=>{
 for(const phase of ['queue','seating','waiting']){
  assert.equal(needsHungerBubble({phase,worker:'waiter',foodId:'rice'}),true);
  assert.equal(needsHungerBubble({phase,removed:true}),false);
 }
 for(const phase of ['eating','leaving','chasing',undefined])assert.equal(needsHungerBubble({phase}),false);
});

test('head measurement ignores padding, lower body width and faint alpha noise',()=>{
 const width=100,height=100,alpha=new Uint8Array(width*height);
 for(let y=20;y<80;y++)for(let x=y<46?40:10;x<(y<46?70:90);x++)alpha[y*width+x]=255;
 alpha[0]=30;
 assert.deepEqual(visibleHeadBounds({width,height,alpha}),{x:55,y:20,width:30});
 assert.equal(visibleHeadBounds({width,height,alpha:new Uint8Array(10000)}),null);
});

test('D bubble uses visible head width and exact sprite transform including flip and seated attachment',()=>{
 const head={x:55,y:20,width:30},placement={x:120,y:40,width:50,height:50,sourceWidth:100,sourceHeight:100};
 const box=hungerBubbleGeometry(head,placement,1015/777);
 assert.equal(box.w,9);assert.equal(box.head.x,147.5);assert.equal(box.head.y,50);
 assert.equal(box.x+box.w/2,box.head.x);assert.ok(box.y+box.h<box.head.y);
 const flipped=hungerBubbleGeometry(head,{...placement,flip:true},1015/777);
 assert.equal(flipped.head.x,142.5);
 const seated=hungerBubbleGeometry(head,{...placement,x:95,y:22},1015/777);
 assert.equal(seated.head.x,122.5);assert.equal(seated.head.y,32);
});
