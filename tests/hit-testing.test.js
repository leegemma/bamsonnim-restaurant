import {test} from 'node:test';
import assert from 'node:assert/strict';
import {pickHit} from '../src/hit-testing.js';

test('transparent foreground pixels let the visible object behind receive the tap',()=>{
 const back={uid:'left-pot',x:0,y:0,w:20,h:20},front={uid:'right-pot',x:10,y:0,w:20,h:20,mask:{width:2,height:2,alpha:new Uint8Array([0,255,0,255])}};
 assert.equal(pickHit([back,front],{x:15,y:5}),back);
 assert.equal(pickHit([back,front],{x:25,y:5}),front);
 assert.equal(pickHit([back,front],{x:35,y:5}),null);
});

test('mirrored furniture uses the mirrored opaque pixels and preserves painter order',()=>{
 const back={uid:'table',x:0,y:0,w:20,h:20},front={uid:'flipped-pot',x:0,y:0,w:20,h:20,flip:true,mask:{width:2,height:1,alpha:new Uint8Array([0,255])}};
 assert.equal(pickHit([back,front],{x:5,y:5}),front);
 assert.equal(pickHit([back,front],{x:15,y:5}),back);
});
