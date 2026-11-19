import test from 'node:test';
import assert from 'node:assert/strict';
import {ZOMBIES,RECIPES} from '../src/data.js';
import {ASSET_MANIFEST,characterFrame,directionalCharacter,eatingCharacter} from '../src/assets.js';
import {APPROVED_ZOMBIE_ACTORS} from '../src/approved-zombie-atlases.js';
import {eatingSpriteFrame} from '../src/eating.js';
import {walkingPose} from '../src/walking.js';
test('only the three scoped actors append stable sprite routes and existing recipe gates',()=>{
 assert.deepEqual(ZOMBIES.slice(-3).map(z=>[z.id,z.sprite,z.level,z.favorite]),[
  ['nz-baduk-player',34,12,'xmas-soup'],['nz-golf-man',35,8,'gimbap'],['nz-futsal-man',36,4,'skewer']]);
 assert.equal(RECIPES.length,43);
 for(const a of APPROVED_ZOMBIE_ACTORS){const mapped=characterFrame(a.sprite);assert.equal(mapped.index,0);assert.equal(ASSET_MANIFEST[mapped.key].actorId,a.actorId);assert.match(ASSET_MANIFEST[mapped.key].url,/portrait.png$/);}
 assert.equal(characterFrame(0).key,'characters');assert.equal(characterFrame(33).key,'zombieClown');
});
test('final precomposed frames retain four directions, exact hip/foot anchors and phase routing',()=>{
 for(const a of APPROVED_ZOMBIE_ACTORS){const base=directionalCharacter(a.actorId),extra=eatingCharacter(a.actorId);
  assert.equal(base.trim,false);assert.equal(extra.trim,false);assert.equal(base.preRegistered,true);assert.equal(extra.preRegistered,true);
  assert.equal(base.poses.length,16);assert.equal(extra.poses.length,8);assert.equal(base.referenceHeight,a.referenceHeight);
  assert.deepEqual(base.sequence,[0,1,0,2]);assert.equal(base.fps,7);assert.equal(extra.fps,5);
  for(let d=0;d<4;d++)for(let f=0;f<3;f++){
   const r=eatingSpriteFrame(base,extra,d,f),m=ASSET_MANIFEST[r.key],p=m.poses[r.index];
   assert.equal(p.dir,d);assert.equal(p.state,f?'eat':'sit');assert.deepEqual(p.hip,{x:140,y:220});assert.deepEqual(p.anchor,{x:140,y:280});assert.equal(p.source.width,280);assert.equal(p.source.height,300);
  }
  const actor={x:0,y:0,path:[[1,0]]};let previous=null;const frames=[];for(let n=0;n<4;n++){previous=walkingPose(actor,previous,{time:n/7+.00001,frameCount:3,fps:7,sequence:base.sequence});frames.push(previous.frame);}assert.deepEqual(frames,[0,1,0,2]);
 }
});
