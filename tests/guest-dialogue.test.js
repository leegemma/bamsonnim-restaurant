import {test} from 'node:test';
import assert from 'node:assert/strict';
import {guestDialogue} from '../src/guest-dialogue.js';

test('a hungry guest speaks once for four seconds, with varied lines across visits',()=>{
 const actor={uid:'guest1',zombieId:'wanderer',phase:'waiting',wait:27.99};
 assert.equal(guestDialogue(actor),null);actor.wait=28;const line=guestDialogue(actor);assert.ok(line);
 actor.wait=31.999;assert.equal(guestDialogue(actor),line);actor.wait=32;assert.equal(guestDialogue(actor),null);actor.wait=50;assert.equal(guestDialogue(actor),null);
 const lines=new Set(Array.from({length:40},(_,i)=>guestDialogue({...actor,uid:`guest${i}`,wait:29})));assert.equal(lines.size,4);
});

test('ordinary and favorite meals keep one line for four seconds then disappear before payment',()=>{
 const actor={uid:'guest1',zombieId:'wanderer',phase:'eating',foodId:'rice',eatUntil:106};
 for(const favorite of [false,true]){const line=guestDialogue(actor,{favorite,time:100});assert.ok(line);assert.equal(guestDialogue({...actor},{favorite,time:103.999}),line);assert.equal(guestDialogue(actor,{favorite,time:104}),null);}
 assert.equal(guestDialogue({...actor,phase:'leaving'},{time:104}),null);
});
