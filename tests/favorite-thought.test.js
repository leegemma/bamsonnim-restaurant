import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../src/engine.js';
import {needsFavoriteThought} from '../src/favorite-thought.js';

test('favorite thought starts on actual delivery, lasts four seconds and stops before payment',()=>{
 const s=E.newGame(),seat=E.seats(s)[0],chair=s.objects.find(o=>o.uid===seat.uid),counter=s.objects.find(o=>o.type==='server');s.spawnIn=1e9;
 Object.assign(counter,{foodId:'rice',stock:10});
 const guest={uid:'favorite-delivery',zombieId:'student',x:chair.x,y:chair.y,phase:'waiting',wait:0,path:[],seat:seat.uid,red:false};s.customers=[guest];
 assert.equal(needsFavoriteThought(guest,'rice',s.time),false);
 for(let i=0;i<240&&!s.waiters.some(w=>w.task?.picked);i++)E.advance(s,.25);
 assert.ok(s.waiters.some(w=>w.task?.picked));assert.equal(needsFavoriteThought(guest,'rice',s.time),false);
 for(let i=0;i<240&&guest.phase!=='eating';i++)E.advance(s,.25);
 assert.equal(guest.phase,'eating');assert.equal(needsFavoriteThought(guest,'rice',s.time),true);
 assert.equal(needsFavoriteThought(guest,'rice',guest.eatUntil-2.001),true);
 assert.equal(needsFavoriteThought(guest,'rice',guest.eatUntil-2),false);
 assert.equal(needsFavoriteThought(guest,'rice',guest.eatUntil),false);
 assert.equal(needsFavoriteThought({...guest,removed:true},'rice',s.time),false);
});

test('ordinary meals and customers without a favorite never show a green heart',()=>{
 const guest={phase:'eating',foodId:'rice',eatUntil:16};
 assert.equal(needsFavoriteThought(guest,'skewer',10),false);
 assert.equal(needsFavoriteThought(guest,null,10),false);
 for(const phase of ['queue','seating','waiting','leaving','chasing'])assert.equal(needsFavoriteThought({...guest,phase},'rice',10),false);
});
