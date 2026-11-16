import {test} from 'node:test';import assert from 'node:assert/strict';import {EATING_ATLASES} from '../src/eating-atlases.generated.js';import {ZOMBIE_ATLASES} from '../src/zombie-atlases.generated.js';import {ZOMBIES} from '../src/data.js';import {eatingSpriteFrame} from '../src/eating.js';
test('the first eleven guests each have two additional seated eating poses in every direction',()=>{
 for(const z of ZOMBIES.slice(0,11)){
  const extra=EATING_ATLASES.find(a=>a.actorId===z.id),base=ZOMBIE_ATLASES.find(a=>a.actorId===z.id);
  assert.ok(extra,z.id);assert.equal(extra.baseAtlas,base.key);assert.equal(extra.poses.length,8);
  for(let dir=0;dir<4;dir++)for(const frame of [1,2]){
   const selected=eatingSpriteFrame(base,extra,dir,frame),pose=extra.poses[selected.index],r=pose.registration;
   assert.equal(selected.key,extra.key);assert.equal(pose.dir,dir);assert.equal(pose.frame,frame);
   assert.equal(r.baseIndex,dir*(base.walkFrames+1)+base.frames.sit);
   assert.ok(r.headBottomY>0&&r.headBottomY<r.lowerBodyTopY);assert.ok(r.scale>0);
   assert.ok(pose.source.x+pose.source.width<=extra.width+.01);assert.ok(pose.source.y+pose.source.height<=extra.height+.01);
   if(z.id==='wanderer')assert.ok(Array.isArray(r.foregroundHands));
   else{
    assert.ok(r.armOnly?.arms.length,z.id+' must animate complete arms');
    assert.ok(r.armOnly.bodyPlate,z.id+' must keep one fixed body plate');
    for(const arm of r.armOnly.arms){
     const neutral=r.armOnly.neutralArms.find(a=>a.id===arm.id);
     assert.ok(neutral,z.id+' must identify each canonical shoulder');
     assert.deepEqual(arm.targetShoulder,neutral.shoulder);
     assert.ok(arm.mask.length&&arm.mask.every(p=>p.length>=3));
    }
   }
  }
 }
});
test('the hiker uses the short black hair appearance in walking, sitting and eating',()=>{assert.match(ZOMBIE_ATLASES.find(a=>a.actorId==='hiker').url,/short-black-hair/);assert.match(ZOMBIES.find(z=>z.id==='hiker').description,/검정 짧은 머리/);assert.ok(EATING_ATLASES.find(a=>a.actorId==='hiker'));});
